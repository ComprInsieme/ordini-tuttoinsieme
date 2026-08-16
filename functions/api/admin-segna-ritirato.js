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

  const id = dati.id;

  if (!id) {
    return new Response(JSON.stringify({ errore: "Id riga mancante" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Trovo la riga scelta, per sapere socio e data
  const riga = await env.DB.prepare(
    "SELECT socio_id, data, id FROM righe_cassa WHERE id = ? AND tipo = 'spesa'"
  )
    .bind(id)
    .first();

  if (!riga) {
    return new Response(JSON.stringify({ errore: "Riga non trovata" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Segno come ritirate questa riga e tutte quelle precedenti dello stesso
  // socio (stessa data ma id più basso, oppure data precedente): capita
  // raramente che un socio ritiri un ordine più recente senza aver già
  // preso quelli di prima, quindi la conferma "a cascata" rispecchia
  // meglio la realtà pratica del ritiro in sede.
  await env.DB.prepare(
    `UPDATE righe_cassa
     SET ritirato = 1
     WHERE socio_id = ?
       AND tipo = 'spesa'
       AND (data < ? OR (data = ? AND id <= ?))`
  )
    .bind(riga.socio_id, riga.data, riga.data, id)
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
