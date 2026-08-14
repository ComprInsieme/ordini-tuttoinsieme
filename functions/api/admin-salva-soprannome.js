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

  const soprannome = (dati.soprannome || "").trim();
  const socio_id = dati.socio_id;

  if (!soprannome || !socio_id) {
    return new Response(
      JSON.stringify({ errore: "Servono sia il soprannome che il socio" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Controllo che il socio esista davvero
  const socio = await env.DB.prepare("SELECT id FROM soci WHERE id = ?")
    .bind(socio_id)
    .first();

  if (!socio) {
    return new Response(JSON.stringify({ errore: "Socio non trovato" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Se il soprannome esiste già, lo aggiorno con il nuovo socio scelto
  // (utile se in passato era stato abbinato per errore)
  await env.DB.prepare(
    `INSERT INTO soprannomi (soprannome, socio_id)
     VALUES (?, ?)
     ON CONFLICT(soprannome) DO UPDATE SET socio_id = excluded.socio_id`
  )
    .bind(soprannome, socio_id)
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
