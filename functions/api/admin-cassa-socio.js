export async function onRequestGet(context) {
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

  const url = new URL(request.url);
  const socio_id = url.searchParams.get("socio_id");

  if (!socio_id) {
    return new Response(JSON.stringify({ errore: "Manca l'id del socio" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const socio = await env.DB.prepare("SELECT id, nome FROM soci WHERE id = ?")
    .bind(socio_id)
    .first();

  if (!socio) {
    return new Response(JSON.stringify({ errore: "Socio non trovato" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Prendo le righe in ordine cronologico (dalla più vecchia alla più recente)
  // per poter calcolare il saldo progressivo riga per riga.
  const righe = await env.DB.prepare(
    `SELECT r.*, p.didascalia, p.nome_progetto
     FROM righe_cassa r
     LEFT JOIN progetti p ON r.lettera = p.lettera
     WHERE r.socio_id = ?
     ORDER BY r.data ASC, r.id ASC`
  )
    .bind(socio_id)
    .all();

  let saldoProgressivo = 0;
  const righeConSaldo = righe.results.map((r) => {
    // Le spese scalano il saldo, i versamenti lo aumentano.
    const movimento = r.tipo === "versamento" ? r.importo_totale : -r.importo_totale;
    saldoProgressivo = Math.round((saldoProgressivo + movimento) * 100) / 100;

    // Il dettaglio prodotti è salvato come testo JSON; lo trasformo
    // in un elenco vero, pronto da mostrare, se presente.
    let prodotti = null;
    if (r.dettaglio_prodotti) {
      try {
        prodotti = JSON.parse(r.dettaglio_prodotti);
      } catch {
        prodotti = null;
      }
    }

    return { ...r, saldo_dopo: saldoProgressivo, prodotti };
  });

  // Calcolo anche i totali per letterina (utile per il riepilogo colonne nascoste)
  const totaliPerLettera = {};
  righe.results.forEach((r) => {
    if (!r.lettera) return;
    if (!totaliPerLettera[r.lettera]) totaliPerLettera[r.lettera] = 0;
    totaliPerLettera[r.lettera] =
      Math.round((totaliPerLettera[r.lettera] + r.importo_prodotto) * 100) / 100;
  });

  return new Response(
    JSON.stringify({
      ok: true,
      socio,
      righe: righeConSaldo,
      saldo_attuale: saldoProgressivo,
      totali_per_lettera: totaliPerLettera,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
