export async function onRequestPost({ request, env }) {
  const { nome, pin } = await request.json();

  if (!nome || !pin) {
    return jsonResponse({ ok: false, errore: "Nome e PIN sono obbligatori." }, 400);
  }

  const socio = await env.DB
    .prepare("SELECT id, nome FROM soci WHERE nome = ? AND pin = ?")
    .bind(nome, pin)
    .first();

  if (!socio) {
    return jsonResponse({ ok: false, errore: "Nome o PIN non corretti." }, 401);
  }

  const token = crypto.randomUUID();
  await env.DB
    .prepare("INSERT INTO sessioni (token, socio_id, creato_il) VALUES (?, ?, ?)")
    .bind(token, socio.id, new Date().toISOString())
    .run();

  return jsonResponse({ ok: true, token, nome: socio.nome });
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
