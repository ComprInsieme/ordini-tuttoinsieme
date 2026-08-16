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

  const soci_trovati = dati.soci_trovati || [];

  if (!Array.isArray(soci_trovati) || soci_trovati.length === 0) {
    return new Response(JSON.stringify({ errore: "Nessun socio da abbinare" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Prendo tutti i soprannomi già salvati, e tutti i soci, una volta sola
  const soprannomiEsistenti = await env.DB.prepare(
    "SELECT soprannome, socio_id FROM soprannomi"
  ).all();
  const elencoSoci = await env.DB.prepare(
    "SELECT id, nome FROM soci"
  ).all();

  const mappaSoprannomi = {};
  soprannomiEsistenti.results.forEach((s) => {
    mappaSoprannomi[s.soprannome.trim().toLowerCase()] = s.socio_id;
  });

  const mappaNomiSoci = {};
  elencoSoci.results.forEach((s) => {
    mappaNomiSoci[s.nome.trim().toLowerCase()] = s.id;
  });

  // Cerca l'id socio per una chiave (soprannome o nome esatto, minuscolo)
  function trovaSocioPerChiave(chiave) {
    if (mappaSoprannomi[chiave] !== undefined) return mappaSoprannomi[chiave];
    if (mappaNomiSoci[chiave] !== undefined) return mappaNomiSoci[chiave];
    return null;
  }

  const risultato = soci_trovati.map((riga) => {
    const chiave = (riga.nome_scritto || "").trim().toLowerCase();

    let socio_id = trovaSocioPerChiave(chiave);

    // Se non trovato, e il nome finisce con un numero (es. "Maria 1",
    // "Maria2"), riprovo togliendo il numero: capita spesso quando un
    // socio fa più ordini distinti nello stesso foglio (per sé, per la
    // sorella, per un'amica) numerandoli per tenerli separati.
    if (socio_id === null) {
      const matchNumero = chiave.match(/^(.*?)\s*\d+$/);
      if (matchNumero) {
        const chiaveBase = matchNumero[1].trim();
        if (chiaveBase) {
          socio_id = trovaSocioPerChiave(chiaveBase);
        }
      }
    }

    return {
      nome_scritto: riga.nome_scritto,
      totale: riga.totale,
      prodotti: riga.prodotti || null,
      socio_id: socio_id, // null se non riconosciuto
    };
  });

  return new Response(
    JSON.stringify({ ok: true, risultato, elenco_soci: elencoSoci.results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
