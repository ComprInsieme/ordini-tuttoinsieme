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

// Legge un CSV di report (formato "REPORT ORDINI") e restituisce un elenco
// di { nome_scritto, totale } per ogni socio che ha ordinato qualcosa.
// Ignora i blocchi vuoti ("— —" oppure totale mancante).
function interpretaReportCsv(testoCsv) {
  const righe = testoCsv.split("\n").map((r) => r.trim());
  const risultati = [];

  let nomeCorrente = null;

  for (const riga of righe) {
    if (!riga) continue;

    const colonne = dividiRigaCsv(riga);
    const primaColonna = (colonne[0] || "").trim();

    // Riconosco una riga intestazione socio: es. "— Anna e Mario —"
    const matchIntestazione = primaColonna.match(/^—\s*(.*?)\s*—$/);
    if (matchIntestazione) {
      nomeCorrente = matchIntestazione[1].trim();
      continue;
    }

    // Riconosco la riga totale: contiene "TOTALE →"
    if (riga.includes("TOTALE") && nomeCorrente) {
      // La colonna F (indice 5) contiene il totale, es. "€47,50" oppure vuota
      const totaleTesto = (colonne[5] || "").trim();

      if (totaleTesto) {
        // Trasformo "€47,50" in 47.50
        const numero = parseFloat(
          totaleTesto.replace("€", "").replace(".", "").replace(",", ".").trim()
        );

        if (!isNaN(numero) && numero > 0) {
          risultati.push({ nome_scritto: nomeCorrente, totale: numero });
        }
      }

      nomeCorrente = null; // chiudo il blocco, pronto per il prossimo
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
