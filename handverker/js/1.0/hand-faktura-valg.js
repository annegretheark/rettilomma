console.log("fakturaValg.js lastet - henter fakturaer fra fakturaer-tabellen");

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

function fellesKundeNavn(kundeId, fallback) {
  const kunde = (window.kunder || []).find(k =>
    String(k.id || "") === String(kundeId || "")
  );

  return kunde?.navn || fallback || "Kunde";
}

function lagFellesFakturaValgTekst(faktura) {
  const kunde = fellesKundeNavn(
    faktura.kunden_id || faktura.kunde_id,
    faktura.kunde_navn || faktura.kundenavn || ""
  );

  const belop = faktura.inkl_mva || faktura.total || 0;

  return `${faktura.fakturanr} | ${kunde} | ${fellesFakturaDato(faktura.dato || faktura.created_at)} | ${fellesFormatBelop(belop)} kr`;
}

function sorterFakturaer(a, b) {
  const datoA = String(a.created_at || a.dato || "");
  const datoB = String(b.created_at || b.dato || "");
  return datoB.localeCompare(datoA) || String(b.fakturanr || "").localeCompare(String(a.fakturanr || ""));
}

function ryddDuplikatFakturaer(fakturaer) {
  const sett = new Set();
  const ryddet = [];

  (fakturaer || [])
    .slice()
    .sort(sorterFakturaer)
    .forEach(f => {
      const status = String(f.status || f.betalingsstatus || "").toLowerCase();
      if (status === "kreditert" || status === "kreditnota") return;

      const key = [
        String(f.kunden_id || f.kunde_id || ""),
        String(f.dato || f.created_at || "").slice(0, 10),
        Number(f.inkl_mva || f.total || 0).toFixed(2)
      ].join("|");

      if (sett.has(key)) return;
      sett.add(key);
      ryddet.push(f);
    });

  return ryddet;
}

async function hentFellesFakturaValgData() {
  if (!window.supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("hand_faktura")
    .select("*");

  if (error) {
    console.error("Feil ved henting av fakturaer:", error);
    return [];
  }

  return ryddDuplikatFakturaer(data || []);
}

async function fyllFellesFakturaValg(selectId, tomTekst, ingenTekst) {
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

  const fakturaer = await hentFellesFakturaValgData();

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
  return fyllFellesFakturaValg(
    "fakturaKopiValg",
    "Velg faktura for kopi",
    "Ingen fakturaer funnet"
  );
}

function fyllKreditnotaFakturaValg() {
  return fyllFellesFakturaValg(
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
