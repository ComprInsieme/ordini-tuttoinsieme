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

  const socio_id = dati.socio_id;
  const data = (dati.data || "").trim();
  const descrizione = (dati.descrizione || "Versamento").trim();
  const importo = parseFloat(dati.importo);
  const metodo_pagamento = (dati.metodo_pagamento || "").trim();

  if (!socio_id) {
    return new Response(JSON.stringify({ errore: "Manca il socio" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return new Response(JSON.stringify({ errore: "Data non valida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (isNaN(importo) || importo <= 0) {
    return new Response(JSON.stringify({ errore: "Importo non valido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const socio = await env.DB.prepare("SELECT id FROM soci WHERE id = ?")
    .bind(socio_id)
    .first();

  if (!socio) {
    return new Response(JSON.stringify({ errore: "Socio non trovato" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  await env.DB.prepare(
    `INSERT INTO righe_cassa
      (socio_id, data, descrizione, tipo, importo_prodotto, importo_totale, metodo_pagamento)
     VALUES (?, ?, ?, 'versamento', ?, ?, ?)`
  )
    .bind(socio_id, data, descrizione, importo, importo, metodo_pagamento || null)
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
