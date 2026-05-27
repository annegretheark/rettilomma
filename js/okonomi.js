console.log("okonomi.js er lastet");

function okonomiBelop(verdi) {
  const tall = Number(verdi || 0);
  return tall.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function okonomiDato(verdi) {
  if (!verdi) return "";
  return String(verdi).slice(0, 10);
}

function okonomiTryggTekst(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function okonomiKundeNavn(kundeId, fallback) {
  const kunde = (window.kunder || []).find(k =>
    String(k.id || "") === String(kundeId || "")
  );

  return kunde?.navn || fallback || "";
}

function okonomiErInnenDato(rad, fraDato, tilDato) {
  const dato = okonomiDato(rad.dato || rad.created_at || rad.fakturert_dato);
  if (!dato) return true;

  if (fraDato && dato < fraDato) return false;
  if (tilDato && dato > tilDato) return false;

  return true;
}

function okonomiErSammeKunde(rad, kundeId) {
  if (!kundeId) return true;

  return (
    String(rad.kunde_id || rad.kunden_id || "") === String(kundeId) ||
    String(rad.kundeId || "") === String(kundeId)
  );
}

function okonomiTimerEksMva(time) {
  if (time.sum !== undefined && time.sum !== null && Number(time.sum) > 0) {
    return Number(time.sum || 0);
  }

  return Number(time.timer || 0) * Number(time.timepris || 0);
}

function okonomiErIkkeFakturertTimer(time) {
  if (time.fakturerbar === false) return false;
  if (String(time.fakturerbar || "").toLowerCase() === "nei") return false;
  if (time.fakturert === true) return false;
  if (time.fakturanr || time.faktura_id || time.fakturert_dato) return false;

  return true;
}

function fyllOkonomiKundeValg() {
  const valg = document.getElementById("okonomiKundeValg");
  const fakturaValg = document.getElementById("fakturaKundeValg");

  const kunder = window.kunder || [];

  [valg, fakturaValg].forEach(select => {
    if (!select) return;

    const valgt = select.value || "";
    const startTekst = select.id === "okonomiKundeValg"
      ? "Alle kunder"
      : "Velg kunde";

    select.innerHTML = `<option value="">${startTekst}</option>`;

    kunder.forEach(kunde => {
      const option = document.createElement("option");
      option.value = kunde.id;
      option.textContent = `${kunde.kundenr || kunde.id || ""} ${kunde.navn || ""}`.trim();
      select.appendChild(option);
    });

    if (valgt) select.value = valgt;
  });
}

async function okonomiHentTabell(tabellnavn) {
  try {
    const { data, error } = await supabaseClient
      .from(tabellnavn)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Kunne ikke hente " + tabellnavn + ":", error.message);
      return [];
    }

    return data || [];
  } catch (e) {
    console.warn("Kunne ikke hente " + tabellnavn + ":", e);
    return [];
  }
}

function okonomiLagTabell(tittel, rader, kolonner, tomTekst) {
  if (!rader.length) {
    return `<h4>${okonomiTryggTekst(tittel)}</h4><p>${okonomiTryggTekst(tomTekst || "Ingen rader.")}</p>`;
  }

  const thead = kolonner
    .map(k => `<th>${okonomiTryggTekst(k.tittel)}</th>`)
    .join("");

  const tbody = rader
    .map(rad => {
      const celler = kolonner
        .map(k => `<td>${k.html ? k.html(rad) : okonomiTryggTekst(k.verdi(rad))}</td>`)
        .join("");

      return `<tr>${celler}</tr>`;
    })
    .join("");

  return `
    <h4>${okonomiTryggTekst(tittel)}</h4>
    <table class="okonomi-tabell">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>
  `;
}

async function visOkonomiOversikt() {
  const container = document.getElementById("okonomiOversikt");
  const melding = document.getElementById("okonomiMelding");

  if (!container) {
    alert("Fant ikke området for økonomioversikt.");
    return;
  }

  const fraDato = document.getElementById("okonomiFraDato")?.value || "";
  const tilDato = document.getElementById("okonomiTilDato")?.value || "";
  const kundeId = document.getElementById("okonomiKundeValg")?.value || "";

  if (melding) melding.textContent = "Henter økonomioversikt...";
  container.innerHTML = "";

  if (typeof lastKunder === "function") {
    await lastKunder();
    fyllOkonomiKundeValg();
  }

  if (typeof lastTimer === "function") {
    await lastTimer();
  }

  const alleTimer = window.timer || [];
  const alleVarer = await okonomiHentTabell("faktura_varer");
  const alleUtlegg = await okonomiHentTabell("faktura_utlegg");
  const alleFakturaer = await okonomiHentTabell("fakturaer");

  const ikkeFakturerteTimer = alleTimer
    .filter(okonomiErIkkeFakturertTimer)
    .filter(rad => okonomiErInnenDato(rad, fraDato, tilDato))
    .filter(rad => okonomiErSammeKunde(rad, kundeId));

  const ikkeFakturerteVarer = alleVarer
    .filter(v => v.fakturert !== true && !v.fakturanr)
    .filter(rad => okonomiErInnenDato(rad, fraDato, tilDato))
    .filter(rad => okonomiErSammeKunde(rad, kundeId));

  const ikkeFakturerteUtlegg = alleUtlegg
    .filter(u => u.fakturert !== true && !u.fakturanr)
    .filter(rad => okonomiErInnenDato(rad, fraDato, tilDato))
    .filter(rad => okonomiErSammeKunde(rad, kundeId));

  const fakturaer = alleFakturaer
    .filter(rad => okonomiErInnenDato(rad, fraDato, tilDato))
    .filter(rad => okonomiErSammeKunde(rad, kundeId));

  const timerEks = ikkeFakturerteTimer.reduce((sum, t) => sum + okonomiTimerEksMva(t), 0);
  const varerEks = ikkeFakturerteVarer.reduce((sum, v) => sum + Number(v.antall || 1) * Number(v.pris || 0), 0);
  const utleggEks = ikkeFakturerteUtlegg.reduce((sum, u) => sum + Number(u.belop || 0), 0);

  const ikkeFakturertEks = timerEks + varerEks + utleggEks;
  const ikkeFakturertMva = (timerEks + varerEks) * 0.25;
  const ikkeFakturertInk = ikkeFakturertEks + ikkeFakturertMva;

  const fakturertEks = fakturaer.reduce((sum, f) => sum + Number(f.eks_mva || 0), 0);
  const fakturertMva = fakturaer.reduce((sum, f) => sum + Number(f.mva || 0), 0);
  const fakturertInk = fakturaer.reduce((sum, f) => sum + Number(f.inkl_mva || 0), 0);

  const betalt = fakturaer
    .filter(f =>
      String(f.status || "").toLowerCase() === "betalt" ||
      String(f.betalingsstatus || "").toLowerCase() === "betalt" ||
      Number(f.betalt_belop || 0) >= Number(f.inkl_mva || 0)
    )
    .reduce((sum, f) => sum + Number(f.inkl_mva || f.betalt_belop || 0), 0);

  const ubetalt = Math.max(0, fakturertInk - betalt);

  const iDag = new Date().toISOString().slice(0, 10);
  const forfalteFakturaer = fakturaer.filter(f => {
    const status = String(f.status || f.betalingsstatus || "").toLowerCase();
    const erBetalt = status === "betalt" || Number(f.betalt_belop || 0) >= Number(f.inkl_mva || 0);
    const forfall = okonomiDato(f.forfallsdato);
    return !erBetalt && forfall && forfall < iDag;
  });

  const forfaltSum = forfalteFakturaer.reduce((sum, f) => sum + Number(f.inkl_mva || 0), 0);

  const sammendrag = `
    <div class="okonomi-grid">
      <div class="okonomi-boks">Ikke fakturert eks. mva<strong>${okonomiBelop(ikkeFakturertEks)} kr</strong></div>
      <div class="okonomi-boks">Ikke fakturert inkl. mva<strong>${okonomiBelop(ikkeFakturertInk)} kr</strong></div>
      <div class="okonomi-boks">Fakturert inkl. mva<strong>${okonomiBelop(fakturertInk)} kr</strong></div>
      <div class="okonomi-boks">Betalt<strong>${okonomiBelop(betalt)} kr</strong></div>
      <div class="okonomi-boks">Ubetalt<strong>${okonomiBelop(ubetalt)} kr</strong></div>
      <div class="okonomi-boks">Forfalt<strong class="okonomi-advarsel">${okonomiBelop(forfaltSum)} kr</strong></div>
    </div>

    <div class="okonomi-grid">
      <div class="okonomi-boks">Ikke fakturerte timer<strong>${ikkeFakturerteTimer.length}</strong></div>
      <div class="okonomi-boks">Ikke fakturerte varer<strong>${ikkeFakturerteVarer.length}</strong></div>
      <div class="okonomi-boks">Ikke fakturerte utlegg<strong>${ikkeFakturerteUtlegg.length}</strong></div>
      <div class="okonomi-boks">Fakturaer i utvalg<strong>${fakturaer.length}</strong></div>
    </div>
  `;

  const timerTabell = okonomiLagTabell(
    "Ikke fakturerte timer",
    ikkeFakturerteTimer,
    [
      { tittel: "Dato", verdi: t => okonomiDato(t.dato) },
      { tittel: "Kunde", verdi: t => okonomiKundeNavn(t.kunde_id, t.kunde_navn) },
      { tittel: "Beskrivelse", verdi: t => t.beskrivelse || t.kommentar || "" },
      { tittel: "Timer", verdi: t => okonomiBelop(t.timer || 0) },
      { tittel: "Eks. mva", verdi: t => okonomiBelop(okonomiTimerEksMva(t)) + " kr" }
    ],
    "Ingen ikke-fakturerte timer i dette utvalget."
  );

  const vareTabell = okonomiLagTabell(
    "Ikke fakturerte varer",
    ikkeFakturerteVarer,
    [
      { tittel: "Dato", verdi: v => okonomiDato(v.created_at) },
      { tittel: "Kunde", verdi: v => okonomiKundeNavn(v.kunde_id, "") },
      { tittel: "Vare", verdi: v => `${v.varenr || ""} ${v.navn || ""}`.trim() },
      { tittel: "Antall", verdi: v => okonomiBelop(v.antall || 1) },
      { tittel: "Eks. mva", verdi: v => okonomiBelop(Number(v.antall || 1) * Number(v.pris || 0)) + " kr" }
    ],
    "Ingen ikke-fakturerte varer i dette utvalget."
  );

  const utleggTabell = okonomiLagTabell(
    "Ikke fakturerte utlegg",
    ikkeFakturerteUtlegg,
    [
      { tittel: "Dato", verdi: u => okonomiDato(u.created_at) },
      { tittel: "Kunde", verdi: u => okonomiKundeNavn(u.kunde_id, "") },
      { tittel: "Type", verdi: u => u.type || u.utgift_type || "" },
      { tittel: "Beskrivelse", verdi: u => u.beskrivelse || "" },
      { tittel: "Beløp", verdi: u => okonomiBelop(u.belop || 0) + " kr" }
    ],
    "Ingen ikke-fakturerte utlegg i dette utvalget."
  );

  const fakturaTabell = okonomiLagTabell(
    "Fakturaer",
    fakturaer,
    [
      { tittel: "Dato", verdi: f => okonomiDato(f.dato || f.created_at) },
      { tittel: "Fakturanr", verdi: f => f.fakturanr || "" },
      { tittel: "Kunde", verdi: f => okonomiKundeNavn(f.kunden_id, "") },
      { tittel: "Status", verdi: f => f.status || f.betalingsstatus || "Ukjent" },
      { tittel: "Forfall", verdi: f => okonomiDato(f.forfallsdato) },
      { tittel: "Inkl. mva", verdi: f => okonomiBelop(f.inkl_mva || 0) + " kr" }
    ],
    "Ingen fakturaer i dette utvalget."
  );

  container.innerHTML =
    sammendrag +
    fakturaTabell +
    timerTabell +
    vareTabell +
    utleggTabell;

  if (melding) {
    melding.textContent = "Økonomioversikt oppdatert.";
  }
}

window.fyllOkonomiKundeValg = fyllOkonomiKundeValg;
window.visOkonomiOversikt = visOkonomiOversikt;

window.addEventListener("load", function () {
  fyllOkonomiKundeValg();

  const knapp = document.getElementById("okonomiOversiktKnapp");
  if (knapp) {
    knapp.onclick = visOkonomiOversikt;
  }
});
