export async function onRequestGet(context) {
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

  // Tutte le righe di spesa non ancora ritirate, con il nome del socio,
  // in ordine di data (le più vecchie per prime, così si vede subito
  // chi aspetta da più tempo).
  const righe = await env.DB.prepare(
    `SELECT r.id, r.socio_id, r.data, r.descrizione, r.importo_totale, s.nome AS nome_socio
     FROM righe_cassa r
     JOIN soci s ON r.socio_id = s.id
     WHERE r.tipo = 'spesa' AND r.ritirato = 0
     ORDER BY r.data ASC, r.id ASC`
  ).all();

  return new Response(JSON.stringify({ ok: true, righe: righe.results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
