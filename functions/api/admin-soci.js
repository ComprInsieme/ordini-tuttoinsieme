export async function onRequestGet({ request, env }) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return jsonResponse({ ok: false, errore: "Non autorizzato." }, 401);
  }

  const sessione = await env.DB
    .prepare("SELECT token FROM admin_sessioni WHERE token = ?")
    .bind(token)
    .first();

  if (!sessione) {
    return jsonResponse({ ok: false, errore: "Sessione admin non valida." }, 401);
  }

  const { results } = await env.DB
    .prepare(
      "SELECT id, nome, pin, socio_dal, rinnovo_corrente, attivo FROM soci ORDER BY nome"
    )
    .all();

  return jsonResponse({ ok: true, soci: results });
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
