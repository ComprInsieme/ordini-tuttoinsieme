// Divide una riga CSV in colonne, rispettando le virgolette:
// senza questo, un valore come "€47,50" (che contiene una virgola)
// verrebbe spezzato a metà da un semplice split(",").
function dividiRigaCsv(riga) {
  const colonne = [];
  let corrente = "";
  let dentroVirgolette = false;

  for (let i = 0; i < riga.length; i++) {
    const ch = riga[i];
    if (ch === '"') {
      dentroVirgolette = !dentroVirgolette;
    } else if (ch === "," && !dentroVirgolette) {
      colonne.push(corrente);
      corrente = "";
    } else {
      corrente += ch;
    }
  }
  colonne.push(corrente);
  return colonne;
}

// Trasforma un testo tipo "€47,50" nel numero 47.50
function testoInNumero(testo) {
  if (!testo) return null;
  const numero = parseFloat(
    testo.replace("€", "").replace(".", "").replace(",", ".").trim()
  );
  return isNaN(numero) ? null : numero;
}

// Legge un CSV di report (formato "REPORT ORDINI") e restituisce un elenco
// di { nome_scritto, totale, prodotti } per ogni socio che ha ordinato
// qualcosa. "prodotti" contiene, per ogni articolo, il prezzo di listino
// (colonna D), il prezzo netto dopo lo sconto offerta del fornitore
// (colonna F) e il prezzo già scontato del 4% regalo referente (colonna G).
// Ignora i blocchi vuoti ("— —" oppure totale mancante).
function interpretaReportCsv(testoCsv) {
  const righe = testoCsv.split("\n").map((r) => r.trim());
  const risultati = [];

  let nomeCorrente = null;
  let prodottiCorrente = [];

  for (const riga of righe) {
    if (!riga) continue;

    const colonne = dividiRigaCsv(riga);
    const primaColonna = (colonne[0] || "").trim();
    const secondaColonna = (colonne[1] || "").trim();
    const quartaColonna = (colonne[3] || "").trim();

    // Riconosco una riga intestazione socio: es. "— Anna e Mario —"
    const matchIntestazione = primaColonna.match(/^—\s*(.*?)\s*—$/);
    if (matchIntestazione) {
      nomeCorrente = matchIntestazione[1].trim();
      prodottiCorrente = [];
      continue;
    }

    // Riga "Totale merce (per contributo 4%)": non ci interessa, la salto
    if (quartaColonna.startsWith("Totale merce")) {
      continue;
    }

    // Riconosco la riga totale definitivo: contiene "TOTALE" tutto maiuscolo
    if (riga.includes("TOTALE") && nomeCorrente) {
      const totaleTesto = (colonne[5] || "").trim();
      const numero = testoInNumero(totaleTesto);

      if (numero && numero > 0) {
        risultati.push({
          nome_scritto: nomeCorrente,
          totale: numero,
          prodotti: prodottiCorrente,
        });
      }

      nomeCorrente = null;
      prodottiCorrente = [];
      continue;
    }

    // Se sono dentro un blocco socio e la riga ha un prodotto vero
    // (colonna B non vuota, non è "nessun prodotto ordinato"), la registro.
    if (nomeCorrente && secondaColonna && secondaColonna !== "(nessun prodotto ordinato)") {
      const prezzoScontato = testoInNumero((colonne[6] || "").trim());
      const prezzoNetto = testoInNumero((colonne[5] || "").trim());
      const prezzoListino = testoInNumero(quartaColonna);
      prodottiCorrente.push({
        codice: primaColonna,
        prodotto: secondaColonna,
        formato: (colonne[2] || "").trim(),
        quantita: (colonne[4] || "").trim(),
        prezzo_listino: prezzoListino,
        prezzo_netto: prezzoNetto,
        prezzo_scontato: prezzoScontato !== null ? prezzoScontato : prezzoNetto,
      });
    }
  }

  return risultati;
}

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

  const link1 = (dati.link1 || "").trim();
  const link2 = (dati.link2 || "").trim();

  if (!link1) {
    return new Response(JSON.stringify({ errore: "Manca il link del primo report" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const risposta1 = await fetch(link1);
    const testo1 = await risposta1.text();
    let elenco = interpretaReportCsv(testo1);

    if (link2) {
      const risposta2 = await fetch(link2);
      const testo2 = await risposta2.text();
      elenco = elenco.concat(interpretaReportCsv(testo2));
    }

    return new Response(JSON.stringify({ ok: true, soci_trovati: elenco }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ errore: "Errore durante la lettura del report: " + err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
