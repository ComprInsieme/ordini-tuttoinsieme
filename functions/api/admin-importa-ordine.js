export async function onRequestPost(context) {
  const { request, env } = context;

  // Controllo che chi chiama sia un admin loggato
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return new Response(JSON.stringify({ errore: "Token mancante" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessione = await env.DB.prepare(
    "SELECT * FROM admin_sessioni WHERE token = ?"
  )
    .bind(token)
    .first();

  if (!sessione) {
    return new Response(JSON.stringify({ errore: "Sessione admin non valida" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let dati;
  try {
    dati = await request.json();
  } catch {
    return new Response(JSON.stringify({ errore: "Dati non validi" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const nome_ordine = (dati.nome_ordine || "").trim();
  const lettera = (dati.lettera || "").trim().toUpperCase();
  const righe = dati.righe || []; // [{ socio_id, totale }, ...] — già risolte, nessun nome_scritto grezzo

  if (!nome_ordine) {
    return new Response(JSON.stringify({ errore: "Manca il nome ordine" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!lettera) {
    return new Response(JSON.stringify({ errore: "Manca la letterina" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(righe) || righe.length === 0) {
    return new Response(JSON.stringify({ errore: "Nessuna riga da importare" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Recupero la regola della letterina scelta
  const progetto = await env.DB.prepare(
    "SELECT * FROM progetti WHERE lettera = ?"
  )
    .bind(lettera)
    .first();

  if (!progetto) {
    return new Response(JSON.stringify({ errore: "Letterina non trovata" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const percentuale = progetto.percentuale || 0;
  const toccaSaldo = progetto.tocca_saldo === 1;

  const data_oggi = new Date().toISOString().slice(0, 10);

  let righeImportate = 0;
  const errori = [];

  for (const riga of righe) {
    const socio_id = riga.socio_id;
    const importo_prodotto = parseFloat(riga.totale);

    if (!socio_id || isNaN(importo_prodotto)) {
      errori.push(`Riga saltata: dati mancanti (socio_id=${socio_id}, totale=${riga.totale})`);
      continue;
    }

    // La maggiorazione si calcola sempre (serve comunque per tenere traccia,
    // es. il 4% WITT che la consulente dovrà versare), ma tocca il saldo del
    // socio solo se la letterina lo prevede (progetto.tocca_saldo).
    const maggiorazione = Math.round((importo_prodotto * percentuale) / 100 * 100) / 100;
    const importo_totale = toccaSaldo
      ? Math.round((importo_prodotto + maggiorazione) * 100) / 100
      : importo_prodotto;

    await env.DB.prepare(
      `INSERT INTO righe_cassa
        (socio_id, data, descrizione, tipo, importo_prodotto, lettera, maggiorazione, importo_totale, ordine_origine)
       VALUES (?, ?, ?, 'spesa', ?, ?, ?, ?, ?)`
    )
      .bind(
        socio_id,
        data_oggi,
        nome_ordine,
        importo_prodotto,
        lettera,
        maggiorazione,
        importo_totale,
        nome_ordine
      )
      .run();

    righeImportate++;
  }

  return new Response(
    JSON.stringify({ ok: true, righe_importate: righeImportate, errori }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
