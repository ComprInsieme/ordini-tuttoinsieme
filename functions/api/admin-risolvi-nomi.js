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

  const risultato = soci_trovati.map((riga) => {
    const chiave = (riga.nome_scritto || "").trim().toLowerCase();

    let socio_id = null;
    if (mappaSoprannomi[chiave] !== undefined) {
      socio_id = mappaSoprannomi[chiave];
    } else if (mappaNomiSoci[chiave] !== undefined) {
      socio_id = mappaNomiSoci[chiave];
    }

    return {
      nome_scritto: riga.nome_scritto,
      totale: riga.totale,
      socio_id: socio_id, // null se non riconosciuto
    };
  });

  return new Response(
    JSON.stringify({ ok: true, risultato, elenco_soci: elencoSoci.results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
