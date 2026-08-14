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

  const lettera = (dati.lettera || "").trim().toUpperCase();
  const nome_progetto = (dati.nome_progetto || "").trim();
  const percentuale = parseFloat(dati.percentuale);
  const didascalia = (dati.didascalia || "").trim();
  const tocca_saldo = dati.tocca_saldo ? 1 : 0;

  if (!lettera || lettera.length > 3) {
    return new Response(
      JSON.stringify({ errore: "La lettera deve essere breve (1-3 caratteri)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!nome_progetto) {
    return new Response(JSON.stringify({ errore: "Il nome progetto è obbligatorio" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (isNaN(percentuale)) {
    return new Response(JSON.stringify({ errore: "La percentuale non è valida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // INSERT OR REPLACE: se la lettera esiste già la aggiorna, altrimenti la crea
  await env.DB.prepare(
    `INSERT INTO progetti (lettera, nome_progetto, percentuale, didascalia, tocca_saldo)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(lettera) DO UPDATE SET
       nome_progetto = excluded.nome_progetto,
       percentuale = excluded.percentuale,
       didascalia = excluded.didascalia,
       tocca_saldo = excluded.tocca_saldo`
  )
    .bind(lettera, nome_progetto, percentuale, didascalia || null, tocca_saldo)
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
