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

  // 2. Leggo i dati inviati dal modulo
  let dati;
  try {
    dati = await request.json();
  } catch {
    return new Response(JSON.stringify({ errore: "Dati non validi" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const nome = (dati.nome || "").trim();
  const pin = (dati.pin || "").trim();
  const socioDal = (dati.socio_dal || "").trim();

  // 3. Controlli di base
  if (!nome) {
    return new Response(JSON.stringify({ errore: "Il nome è obbligatorio" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!/^\d{4}$/.test(pin)) {
    return new Response(JSON.stringify({ errore: "Il PIN deve essere di 4 cifre" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(socioDal)) {
    return new Response(JSON.stringify({ errore: "Data 'socio dal' non valida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Controllo che non esista già un socio con lo stesso nome
  const esistente = await env.DB.prepare(
    "SELECT id FROM soci WHERE nome = ?"
  )
    .bind(nome)
    .first();

  if (esistente) {
    return new Response(JSON.stringify({ errore: "Esiste già un socio con questo nome" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. Scrivo il nuovo socio nel database
  await env.DB.prepare(
    `INSERT INTO soci (nome, pin, socio_dal, rinnovo_corrente, attivo)
     VALUES (?, ?, ?, ?, 1)`
  )
    .bind(nome, pin, socioDal, socioDal)
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
