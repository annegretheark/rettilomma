console.log("fakturaValg.js lastet");

const FELLES_FAKTURA_MVA_SATS = 0.25;

function fellesFormatBelop(verdi) {
  return Number(verdi || 0).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fellesFakturaDato(dato) {
  if (!dato) return "";
  return String(dato).slice(0, 10);
}

function fellesKundeNavnForTime(time) {
  if (!time) return "Kunde";

  if (time.kunde_navn || time.kundeNavn || time.kunde) {
    return time.kunde_navn || time.kundeNavn || time.kunde;
  }

  const kunde = (window.kunder || []).find(k =>
    String(k.id || "") === String(time.kunde_id || time.kundeId || "")
  );

  return kunde?.navn || "Kunde";
}

function fellesFakturaLinjeSum(time) {
  if (typeof beregnMvaLinje === "function") {
    const mvaLinje = beregnMvaLinje(time);
    return Number(mvaLinje?.sumEksMva || 0);
  }

  if (time?.sum !== undefined && time?.sum !== null && Number(time.sum) > 0) {
    return Number(time.sum);
  }

  return Number(time?.timer || 0) * Number(time?.timepris || 0);
}

function hentFellesFakturaValgData() {
  const map = new Map();

  (window.timer || [])
    .filter(t => t.fakturanr || t.faktura_nr)
    .forEach(t => {
      const fakturanr = String(t.fakturanr || t.faktura_nr || "").trim();
      if (!fakturanr) return;

      if (!map.has(fakturanr)) {
        map.set(fakturanr, {
          fakturanr,
          dato: t.fakturert_dato || t.faktura_dato || t.dato || "",
          kunde: fellesKundeNavnForTime(t),
          belop: 0
        });
      }

      const post = map.get(fakturanr);
      post.belop += fellesFakturaLinjeSum(t) * (1 + FELLES_FAKTURA_MVA_SATS);
    });

  return Array.from(map.values()).sort((a, b) => {
    const datoA = String(a.dato || "");
    const datoB = String(b.dato || "");
    return datoB.localeCompare(datoA) || String(b.fakturanr).localeCompare(String(a.fakturanr));
  });
}

function lagFellesFakturaValgTekst(faktura) {
  return `${faktura.fakturanr} | ${faktura.kunde || "Kunde"} | ${fellesFakturaDato(faktura.dato)} | ${fellesFormatBelop(faktura.belop)} kr`;
}

function fyllFellesFakturaValg(selectId, tomTekst, ingenTekst) {
  const select = document.getElementById(selectId);

  if (!select) {
    console.warn("Fant ikke faktura-rullefelt:", selectId);
    return;
  }

  select.innerHTML = "";

  const tom = document.createElement("option");
  tom.value = "";
  tom.textContent = tomTekst || "Velg faktura";
  select.appendChild(tom);

  const fakturaer = hentFellesFakturaValgData();

  fakturaer.forEach(faktura => {
    const option = document.createElement("option");
    option.value = faktura.fakturanr;
    option.textContent = lagFellesFakturaValgTekst(faktura);
    select.appendChild(option);
  });

  if (!fakturaer.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = ingenTekst || "Ingen fakturaer funnet";
    select.appendChild(option);
  }
}

function fyllFakturaKopiValg() {
  fyllFellesFakturaValg(
    "fakturaKopiValg",
    "Velg faktura for kopi",
    "Ingen fakturaer funnet"
  );
}

function fyllKreditnotaFakturaValg() {
  fyllFellesFakturaValg(
    "kreditnotaFakturaValg",
    "Velg faktura å kreditere",
    "Ingen fakturaer funnet"
  );
}

window.fellesFormatBelop = fellesFormatBelop;
window.hentFellesFakturaValgData = hentFellesFakturaValgData;
window.lagFellesFakturaValgTekst = lagFellesFakturaValgTekst;
window.fyllFellesFakturaValg = fyllFellesFakturaValg;
window.fyllFakturaKopiValg = fyllFakturaKopiValg;
window.fyllKreditnotaFakturaValg = fyllKreditnotaFakturaValg;
