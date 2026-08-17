export async function onRequestGet(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) {
    return new Response(JSON.stringify({ errore: 'Token mancante' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Risale al socio dalla sessione (stesso meccanismo di sessione.js)
  const sessione = await env.DB.prepare(
    'SELECT socio_id FROM sessioni WHERE token = ?'
  ).bind(token).first();

  if (!sessione) {
    return new Response(JSON.stringify({ errore: 'Sessione non valida' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const socioId = sessione.socio_id;

  const socio = await env.DB.prepare(
    'SELECT nome FROM soci WHERE id = ?'
  ).bind(socioId).first();

  if (!socio) {
    return new Response(JSON.stringify({ errore: 'Socio non trovato' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Tutte le righe cassa del socio, in ordine cronologico, con la letterina
  // agganciata (per nota lettera/didascalia/maggiorazione sotto le spese)
  const { results: righe } = await env.DB.prepare(`
    SELECT rc.*, p.nome_progetto, p.didascalia, p.percentuale, p.tocca_saldo
    FROM righe_cassa rc
    LEFT JOIN progetti p ON rc.lettera = p.lettera
    WHERE rc.socio_id = ?
    ORDER BY rc.data ASC, rc.id ASC
  `).bind(socioId).all();

  let saldo = 0;
  const righeConSaldo = righe.map(r => {
    if (r.tipo === 'versamento') {
      saldo += r.importo_totale;
    } else {
      saldo -= r.importo_totale;
    }

    let dettaglioProdotti = null;
    if (r.dettaglio_prodotti) {
      try {
        dettaglioProdotti = JSON.parse(r.dettaglio_prodotti);
      } catch (e) {
        dettaglioProdotti = null;
      }
    }

    return {
      id: r.id,
      data: r.data,
      descrizione: r.descrizione,
      tipo: r.tipo,
      importo_prodotto: r.importo_prodotto,
      lettera: r.lettera,
      nome_progetto: r.nome_progetto,
      didascalia: r.didascalia,
      percentuale: r.percentuale,
      tocca_saldo: r.tocca_saldo,
      maggiorazione: r.maggiorazione,
      importo_totale: r.importo_totale,
      metodo_pagamento: r.metodo_pagamento,
      dettaglio_prodotti: dettaglioProdotti,
      ritirato: r.ritirato,
      saldo_dopo: saldo
    };
  });

  return new Response(JSON.stringify({
    nome: socio.nome,
    saldo_attuale: saldo,
    righe: righeConSaldo
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
