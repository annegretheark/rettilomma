console.log("kreditnota.js lastet");

const KREDITNOTA_MVA_SATS = 0.25;

function kreditnotaFormatBelop(verdi) {
  return Number(verdi || 0).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function kreditnotaTryggFilnavn(tekst) {
  return String(tekst || "kreditnota")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function kreditnotaDatoISO(dato) {
  return new Date(dato).toISOString().slice(0, 10);
}

function kreditnotaSummer(timerListe) {
  return (timerListe || []).reduce(
    (acc, t) => {
      let eks = 0;

      if (typeof beregnMvaLinje === "function") {
        eks = Number(beregnMvaLinje(t).sumEksMva || 0);
      } else if (t.sum !== undefined && t.sum !== null && Number(t.sum) > 0) {
        eks = Number(t.sum);
      } else {
        eks = Number(t.timer || 0) * Number(t.timepris || 0);
      }

      acc.eks += eks;
      acc.mva += eks * KREDITNOTA_MVA_SATS;
      acc.inkl += eks * (1 + KREDITNOTA_MVA_SATS);

      return acc;
    },
    { eks: 0, mva: 0, inkl: 0 }
  );
}

function kreditnotaKundeNavn(kunde, time) {
  if (typeof hentKundeNavn === "function") {
    return hentKundeNavn(kunde, time);
  }

  return kunde?.navn || time?.kunde_navn || time?.kundeNavn || time?.kunde || "Kunde";
}

function finnTimerForFaktura(fakturanr) {
  return (window.timer || []).filter(t =>
    String(t.fakturanr || t.faktura_nr || "") === String(fakturanr || "")
  );
}

function fyllKreditnotaFakturaValg() {
  if (typeof window.fyllFellesFakturaValg === "function") {
    window.fyllFellesFakturaValg(
      "kreditnotaFakturaValg",
      "Velg faktura å kreditere",
      "Ingen fakturaer funnet"
    );
    return;
  }
}

async function lagKreditnota(fakturanr) {
  const melding =
    document.getElementById("timerMelding") ||
    document.getElementById("skjemaMelding");

  const jspdfObj = window.jspdf;

  if (!jspdfObj || !jspdfObj.jsPDF) {
    alert("PDF-biblioteket er ikke lastet.");
    return;
  }

  const timerListe = finnTimerForFaktura(fakturanr);

  if (!timerListe.length) {
    alert("Fant ingen timer på valgt faktura.");
    return;
  }

  const firma =
    typeof hentFirmaData === "function"
      ? await hentFirmaData()
      : {};

  const doc = new jspdfObj.jsPDF();

  if (typeof tegnBrevhodePdf === "function") {
    await tegnBrevhodePdf(doc, firma);
  } else if (typeof leggTilLogo === "function") {
    await leggTilLogo(doc);
  }

  let y = 70;

  doc.setFontSize(20);
  doc.text("KREDITNOTA", 14, y);

  y += 20;

  doc.setFontSize(10);

  doc.text("Krediterer faktura:", 14, y);
  doc.text(String(fakturanr || ""), 70, y);

  y += 6;

  doc.text("Dato:", 14, y);
  doc.text(kreditnotaDatoISO(new Date()), 70, y);

  y += 6;

  doc.text("Kunde:", 14, y);
  doc.text(kreditnotaKundeNavn(null, timerListe[0]), 70, y);

  y += 15;

  const summer = kreditnotaSummer(timerListe);

  doc.setFontSize(11);

  doc.text("Sum eks mva:", 120, y);
  doc.text("-" + kreditnotaFormatBelop(summer.eks) + " kr", 170, y);

  y += 6;

  doc.text("MVA 25%:", 120, y);
  doc.text("-" + kreditnotaFormatBelop(summer.mva) + " kr", 170, y);

  y += 6;

  doc.setFontSize(12);

  doc.text("Sum inkl mva:", 120, y);
  doc.text("-" + kreditnotaFormatBelop(summer.inkl) + " kr", 170, y);

  if (typeof tegnBrevfotAlleSiderPdf === "function") {
    tegnBrevfotAlleSiderPdf(doc, firma);
  }

  doc.save(`kreditnota_${kreditnotaTryggFilnavn(fakturanr)}.pdf`);

  const omrade = document.getElementById("kreditnotaOmrade");

if (omrade) {
  omrade.style.display = "none";
}

if (melding) {
  melding.textContent = "Kreditnota er laget.";
}
}

function kobleKreditnotaKnapp() {
  const knapp = document.getElementById("kreditnotaKnapp");
  const omrade = document.getElementById("kreditnotaOmrade");
  const lagKnapp = document.getElementById("lagKreditnotaValgtKnapp");

  if (!knapp) {
    console.warn("Fant ikke kreditnotaKnapp");
    return;
  }

  knapp.onclick = function () {
    console.log("Kreditnota-knapp trykket");

    fyllKreditnotaFakturaValg();

    if (omrade) {
      omrade.style.display = "block";
    }
  };

  if (lagKnapp) {
    lagKnapp.onclick = async function () {
      const select = document.getElementById("kreditnotaFakturaValg");

      if (!select || !select.value) {
        alert("Velg faktura først.");
        return;
      }

      await lagKreditnota(select.value);
    };
  }

  console.log("Kreditnota-knapper koblet");
}

function startKreditnota() {
  kobleKreditnotaKnapp();
}

window.lagKreditnota = lagKreditnota;
window.kobleKreditnotaKnapp = kobleKreditnotaKnapp;
window.fyllKreditnotaFakturaValg = fyllKreditnotaFakturaValg;
window.startKreditnota = startKreditnota;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startKreditnota);
} else {
  startKreditnota();
}