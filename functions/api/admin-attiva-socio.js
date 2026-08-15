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

  // 2. Leggo l'id del socio da attivare/disattivare
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
  const data_rinnovo = (dati.data_rinnovo || "").trim(); // usata solo quando si riattiva

  if (!id) {
    return new Response(JSON.stringify({ errore: "Id socio mancante" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Recupero lo stato attuale del socio
  const socio = await env.DB.prepare(
    "SELECT id, attivo FROM soci WHERE id = ?"
  )
    .bind(id)
    .first();

  if (!socio) {
    return new Response(JSON.stringify({ errore: "Socio non trovato" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Ribalto lo stato: se era 1 diventa 0, se era 0 diventa 1
  const nuovoStato = socio.attivo === 1 ? 0 : 1;
  const staRiattivando = nuovoStato === 1;

  if (staRiattivando && data_rinnovo) {
    // Riattivazione con rinnovo: aggiorno stato E data insieme
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_rinnovo)) {
      return new Response(
        JSON.stringify({ errore: "Data di rinnovo non valida" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    await env.DB.prepare(
      "UPDATE soci SET attivo = ?, rinnovo_corrente = ? WHERE id = ?"
    )
      .bind(nuovoStato, data_rinnovo, id)
      .run();
  } else {
    // Disattivazione (o riattivazione senza data specificata): tocco solo lo stato
    await env.DB.prepare(
      "UPDATE soci SET attivo = ? WHERE id = ?"
    )
      .bind(nuovoStato, id)
      .run();
  }

  return new Response(JSON.stringify({ ok: true, attivo: nuovoStato }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
