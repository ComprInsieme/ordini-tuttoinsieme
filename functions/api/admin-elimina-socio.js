export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Controllo che chi chiama sia un admin loggato
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

  // 2. Leggo l'id del socio da eliminare
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
    return new Response(JSON.stringify({ errore: "Id socio mancante" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Controllo che il socio esista
  const socio = await env.DB.prepare(
    "SELECT id FROM soci WHERE id = ?"
  )
    .bind(id)
    .first();

  if (!socio) {
    return new Response(JSON.stringify({ errore: "Socio non trovato" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Elimino il socio
  await env.DB.prepare(
    "DELETE FROM soci WHERE id = ?"
  )
    .bind(id)
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
