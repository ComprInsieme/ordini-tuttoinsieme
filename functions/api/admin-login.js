export async function onRequestPost({ request, env }) {
  const { password } = await request.json();

  if (!password) {
    return jsonResponse({ ok: false, errore: "Password mancante." }, 400);
  }

  if (password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ ok: false, errore: "Password errata." }, 401);
  }

  const token = crypto.randomUUID();
  await env.DB
    .prepare("INSERT INTO admin_sessioni (token, creato_il) VALUES (?, ?)")
    .bind(token, new Date().toISOString())
    .run();

  return jsonResponse({ ok: true, token });
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
