
/* ===== FIX 2026-06-11: Oversikt-knapper: Sett betalt + Purring ===== */
(function () {
  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function kr(v) {
    const n = Number(v || 0);
    try {
      return n.toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";
    } catch(e) {
      return n.toFixed(2).replace(".", ",") + " kr";
    }
  }

  function finnEierNavn(id) {
    const eier = (window.vetDyreeiere || []).find(e => String(e.id) === String(id));
    return eier?.navn || eier?.kunde_navn || "";
  }

  function finnDyrNavn(id) {
    const dyr = (window.vetDyr || []).find(d => String(d.id) === String(id));
    return dyr?.navn || "";
  }

  function journalSum(j) {
    const direkte = Number(j.sum ?? j.sum_eks_mva ?? j.belop ?? j.total ?? 0);
    if (direkte) return direkte;

    const fastpris = Number(j.fastpris || 0);
    const timepris = Number(j.timepris || 0);
    const timer = Number(j.timer || 0);
    const km = Number(j.km || 0);
    const kmPris = Number(j.km_pris || j.kmpris || 0);

    let sum = fastpris + (timepris * timer) + (km * kmPris);

    try {
      const varer = Array.isArray(j.varer) ? j.varer : JSON.parse(j.varer || "[]");
      varer.forEach(v => sum += Number(v.pris || v.enhetspris || 0) * Number(v.antall || 1));
    } catch(e) {}

    try {
      const behandlinger = Array.isArray(j.behandlinger) ? j.behandlinger : JSON.parse(j.behandlinger || "[]");
      behandlinger.forEach(b => sum += Number(b.pris || b.belop || 0) * Number(b.antall || 1));
    } catch(e) {}

    return sum;
  }

  function erJournalFakturert(j) {
    return Boolean(
      j.fakturert === true ||
      j.faktura_id ||
      j.fakturanr ||
      j.faktura_nr ||
      j.faktura_nummer
    );
  }

  function finnFakturaForJournal(j) {
    const fakturaer = window.vetFakturaer || [];
    return fakturaer.find(f =>
      String(f.id || "") === String(j.faktura_id || "") ||
      String(f.fakturanr || f.faktura_nr || f.faktura_nummer || "") === String(j.fakturanr || j.faktura_nr || j.faktura_nummer || "")
    );
  }

  window.settVetFakturaBetaltFraOversikt = async function (journalId) {
    try {
      if (!window.supabaseClient) throw new Error("Supabase er ikke lastet.");

      const journal = (window.vetJournal || []).find(j => String(j.id) === String(journalId));
      if (!journal) throw new Error("Fant ikke journalen.");

      const faktura = finnFakturaForJournal(journal);
      const idag = new Date().toISOString().slice(0, 10);

      if (faktura?.id) {
        let { error } = await supabaseClient
          .from("vet_fakturaer")
          .update({ betalt: true, betalt_dato: idag, status: "betalt" })
          .eq("id", faktura.id);

        if (error) {
          const r2 = await supabaseClient
            .from("fakturaer")
            .update({ betalt: true, betalt_dato: idag, status: "betalt" })
            .eq("id", faktura.id);
          if (r2.error) throw error;
        }
      } else if (journal.faktura_id) {
        let { error } = await supabaseClient
          .from("vet_fakturaer")
          .update({ betalt: true, betalt_dato: idag, status: "betalt" })
          .eq("id", journal.faktura_id);

        if (error) {
          const r2 = await supabaseClient
            .from("fakturaer")
            .update({ betalt: true, betalt_dato: idag, status: "betalt" })
            .eq("id", journal.faktura_id);
          if (r2.error) throw error;
        }
      }

      // Også merk journalen, men ikke stopp hvis kolonner mangler.
      try {
        await supabaseClient
          .from("vet_journal")
          .update({ betalt: true, betalt_dato: idag })
          .eq("id", journalId);
      } catch(e) {}

      if (typeof window.lastVetFakturaer === "function") await window.lastVetFakturaer();
      if (typeof window.lastJournal === "function") await window.lastJournal();
      if (typeof window.tegnAdminOkonomiOversikt === "function") window.tegnAdminOkonomiOversikt();

      const m = document.getElementById("adminOkonomiMelding");
      if (m) m.textContent = "Faktura er satt som betalt.";
    } catch (e) {
      const m = document.getElementById("adminOkonomiMelding");
      if (m) m.textContent = "Kunne ikke sette betalt: " + (e?.message || e);
      alert("Kunne ikke sette betalt: " + (e?.message || e));
    }
  };

  window.lagVetPurringFraOversikt = function (journalId) {
    const journal = (window.vetJournal || []).find(j => String(j.id) === String(journalId));
    if (!journal) {
      alert("Fant ikke journalen.");
      return;
    }

    // Bruk eksisterende purring-funksjon hvis appen har en.
    if (typeof window.skrivUtVetPurring === "function") return window.skrivUtVetPurring(journalId);
    if (typeof window.lagVetPurring === "function") return window.lagVetPurring(journalId);
    if (typeof window.skrivUtPurring === "function") return window.skrivUtPurring(journalId);

    const eierNavn = finnEierNavn(journal.dyreeier_id) || journal.dyreeier_navn || "Kunde";
    const dyrNavn = finnDyrNavn(journal.dyr_id) || journal.dyr_navn || "";
    const faktura = finnFakturaForJournal(journal);
    const fakturaNr = faktura?.fakturanr || faktura?.faktura_nr || faktura?.faktura_nummer || journal.fakturanr || journal.faktura_nr || journal.faktura_nummer || journal.id;
    const sumEks = journalSum(journal);
    const mva = sumEks * 0.25;
    const sumInk = sumEks + mva;

    const klinikk = window.vetAktivKlinikk || {};
    const vippsNr = klinikk.vipps_nr || klinikk.vipps || klinikk.vippsnummer || "";
    const vippsTil = klinikk.vipps_til || klinikk.vipps_til_navn || klinikk.navn || "";

    const w = window.open("", "_blank");
    if (!w) {
      alert("Popup ble blokkert. Tillat popup og prøv igjen.");
      return;
    }

    w.document.write(`<!doctype html>
<html lang="no">
<head>
<meta charset="utf-8">
<title>Purring ${esc(fakturaNr)}</title>
<style>
  body{font-family:Arial,sans-serif;margin:40px;color:#111827}
  h1{margin-bottom:4px}
  .lite{color:#4b5563}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}
  .sum{font-size:18px;font-weight:bold;text-align:right;margin-top:20px}
  .vipps{color:#d40000;font-weight:800;font-size:18px;margin-top:20px}
</style>
</head>
<body>
<h1>Purring</h1>
<p class="lite">Faktura: ${esc(fakturaNr)}</p>
<p><strong>${esc(klinikk.navn || "Klinikk")}</strong></p>
<p>Til: <strong>${esc(eierNavn)}</strong></p>
${dyrNavn ? `<p>Dyr: ${esc(dyrNavn)}</p>` : ""}
<p>Vi kan ikke se at fakturaen er betalt. Vennligst betal så snart som mulig.</p>
<table>
<tr><th>Tekst</th><th>Beløp</th></tr>
<tr><td>Utestående faktura</td><td>${esc(kr(sumEks))} eks. mva</td></tr>
<tr><td>MVA 25%</td><td>${esc(kr(mva))}</td></tr>
</table>
<p class="sum">Å betale: ${esc(kr(sumInk))}</p>
${vippsNr ? `<div class="vipps">Vipps: ${esc(vippsNr)}${vippsTil ? `<br><span class="lite">Vipps til: ${esc(vippsTil)}</span>` : ""}</div>` : ""}
<script>window.print();<\/script>
</body>
</html>`);
    w.document.close();
  };

  function knappHtml(j) {
    const fakturert = erJournalFakturert(j);
    if (!fakturert) return '<span class="lite">Ikke fakturert</span>';

    const faktura = finnFakturaForJournal(j);
    const betalt = Boolean(faktura?.betalt || j.betalt || faktura?.status === "betalt" || j.status === "betalt");

    return `
      <button type="button" class="secondary" onclick="settVetFakturaBetaltFraOversikt('${esc(j.id)}')" ${betalt ? "disabled" : ""}>
        ${betalt ? "Betalt" : "Sett betalt"}
      </button>
      <button type="button" class="danger" onclick="lagVetPurringFraOversikt('${esc(j.id)}')">
        Purring
      </button>
    `;
  }

  function tegnFallbackOversikt() {
    const liste = document.getElementById("adminOkonomiListe");
    const summer = document.getElementById("adminOkonomiSummer");
    if (!liste || !Array.isArray(window.vetJournal)) return false;

    const filter = document.getElementById("adminOkonomiFilter")?.value || "alle";
    const fra = document.getElementById("adminOkonomiFraDato")?.value || "";
    const til = document.getElementById("adminOkonomiTilDato")?.value || "";

    let rader = [...window.vetJournal];

    if (fra) rader = rader.filter(j => String(j.dato || j.journal_dato || "").slice(0,10) >= fra);
    if (til) rader = rader.filter(j => String(j.dato || j.journal_dato || "").slice(0,10) <= til);
    if (filter === "fakturert") rader = rader.filter(erJournalFakturert);
    if (filter === "ikke_fakturert") rader = rader.filter(j => !erJournalFakturert(j));

    const valgt = rader.reduce((s,j)=>s+journalSum(j),0);
    const fakturert = rader.filter(erJournalFakturert).reduce((s,j)=>s+journalSum(j),0);
    const ikke = rader.filter(j=>!erJournalFakturert(j)).reduce((s,j)=>s+journalSum(j),0);

    if (summer) {
      summer.innerHTML = `
        <div class="okonomi-boks">Valgt visning<strong>${esc(kr(valgt))}</strong></div>
        <div class="okonomi-boks">Ikke fakturert<strong class="okonomi-advarsel">${esc(kr(ikke))}</strong></div>
        <div class="okonomi-boks">Fakturert<strong>${esc(kr(fakturert))}</strong></div>
      `;
    }

    if (!rader.length) {
      liste.innerHTML = '<p class="lite">Ingen rader funnet.</p>';
      return true;
    }

    liste.innerHTML = `
      <table class="okonomi-tabell">
        <thead>
          <tr>
            <th>Dato</th>
            <th>Dyreeier</th>
            <th>Dyr</th>
            <th>Status</th>
            <th>Sum eks. mva</th>
            <th>Handling</th>
          </tr>
        </thead>
        <tbody>
          ${rader.map(j => {
            const fakturertRad = erJournalFakturert(j);
            const faktura = finnFakturaForJournal(j);
            const betalt = Boolean(faktura?.betalt || j.betalt || faktura?.status === "betalt" || j.status === "betalt");
            return `
              <tr>
                <td>${esc(String(j.dato || j.journal_dato || "").slice(0,10))}</td>
                <td>${esc(finnEierNavn(j.dyreeier_id) || j.dyreeier_navn || "")}</td>
                <td>${esc(finnDyrNavn(j.dyr_id) || j.dyr_navn || "")}</td>
                <td>${fakturertRad ? (betalt ? "Betalt" : "Fakturert") : "Ikke fakturert"}</td>
                <td>${esc(kr(journalSum(j)))}</td>
                <td>${knappHtml(j)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
    return true;
  }

  const gammelTegn = window.tegnAdminOkonomiOversikt;
  window.tegnAdminOkonomiOversikt = function () {
    try {
      if (typeof gammelTegn === "function") {
        gammelTegn.apply(this, arguments);

        // Etter gammel tegning: prøv å legge til knapper i eksisterende tabell hvis den mangler handling-kolonne.
        setTimeout(function () {
          const liste = document.getElementById("adminOkonomiListe");
          if (!liste) return;
          if (liste.querySelector("button[onclick*='settVetFakturaBetaltFraOversikt']")) return;

          // Hvis gammel oversikt ikke kan berikes trygt, tegn fallback med knapper.
          tegnFallbackOversikt();
        }, 50);
        return;
      }
    } catch(e) {
      console.warn("Gammel oversikt feilet, bruker fallback:", e);
    }
    return tegnFallbackOversikt();
  };

  document.addEventListener("DOMContentLoaded", function () {
    const knapp = document.getElementById("oppdaterAdminOkonomiKnapp");
    if (knapp) knapp.addEventListener("click", function () {
      setTimeout(function(){
        if (typeof window.tegnAdminOkonomiOversikt === "function") window.tegnAdminOkonomiOversikt();
      }, 20);
    });
  });
})();
