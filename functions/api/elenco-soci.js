export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare("SELECT nome FROM soci ORDER BY nome")
    .all();

  return new Response(JSON.stringify(results.map((r) => r.nome)), {
    headers: { "Content-Type": "application/json" },
  });
}
