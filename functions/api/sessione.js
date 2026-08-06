export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return jsonResponse({ ok: false }, 400);
  }

  const riga = await env.DB
    .prepare(
      `SELECT soci.nome AS nome
       FROM sessioni
       JOIN soci ON soci.id = sessioni.socio_id
       WHERE sessioni.token = ?`
    )
    .bind(token)
    .first();

  if (!riga) {
    return jsonResponse({ ok: false }, 401);
  }

  return jsonResponse({ ok: true, nome: riga.nome });
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
