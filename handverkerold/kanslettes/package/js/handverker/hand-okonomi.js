console.log("okonomi.js er lastet - klikkbar økonomioversikt med fakturastatus");

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

function okonomiTryggJs(verdi) {
  return String(verdi ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ");
}

function okonomiVisStatus(rad) {
  const status = String(rad?.status || rad?.betalingsstatus || "").toLowerCase();
  const inkl = Number(rad?.inkl_mva || rad?.total || 0);
  const betalt = Number(rad?.betalt_belop || 0);

  if (status === "betalt" || (inkl > 0 && betalt >= inkl)) return "Betalt";
  if (status === "purret" || status === "purring") return "Purret";
  if (status === "kreditert" || status === "kreditnota") return "Kreditert";

  if (
    rad?.fakturert === true ||
    String(rad?.fakturert || "").toLowerCase() === "true" ||
    String(rad?.fakturert || "").toLowerCase() === "ja" ||
    rad?.fakturanr ||
    rad?.faktura_id ||
    rad?.fakturert_dato
  ) {
    return "Fakturert / ikke betalt";
  }

  return "Ikke fakturert";
}

function okonomiStatusMerke(rad) {
  const status = okonomiVisStatus(rad);
  let bg = "#374151";
  if (status === "Betalt") bg = "#166534";
  if (status === "Fakturert / ikke betalt") bg = "#92400e";
  if (status === "Ikke fakturert") bg = "#7f1d1d";
  if (status === "Purret") bg = "#b45309";
  if (status === "Kreditert") bg = "#4b5563";

  return `<span style="display:inline-block;padding:3px 7px;border-radius:999px;background:${bg};color:white;font-size:12px;white-space:nowrap;">${okonomiTryggTekst(status)}</span>`;
}

function okonomiBetaltKnapp(f) {
  const status = okonomiVisStatus(f);
  if (status === "Betalt" || status === "Kreditert") return "✓";

  const fakturanr = f?.fakturanr || "";
  if (!fakturanr) return "";

  return `<button type="button"
    class="secondary okonomi-mini-knapp"
    onclick="event.stopPropagation(); okonomiSettBetalt('${okonomiTryggJs(fakturanr)}', ${Number(f?.inkl_mva || f?.total || 0)})">
    Sett betalt
  </button>`;
}


function okonomiPurringKnapp(f) {
  const status = okonomiVisStatus(f);
  if (status === "Betalt" || status === "Kreditert") return "";
  const fakturanr = f?.fakturanr || "";
  if (!fakturanr) return "";
  return `<button type="button"
    class="secondary okonomi-mini-knapp"
    onclick="event.stopPropagation(); lagPurringFraOkonomi('${okonomiTryggJs(fakturanr)}')">
    Purring
  </button>`;
}

async function okonomiSettBetalt(fakturanr, belop) {
  if (!fakturanr) {
    alert("Mangler fakturanr.");
    return;
  }

  if (!confirm("Sette faktura " + fakturanr + " som betalt?")) return;

  const dato = new Date().toISOString().slice(0, 10);

  let res = await supabaseClient
    .from("hand_faktura")
    .update({
      betalingsstatus: "betalt",
      status: "betalt",
      betalt_belop: Number(belop || 0),
      betalt_dato: dato
    })
    .eq("fakturanr", fakturanr);

  if (res.error) {
    res = await supabaseClient
      .from("hand_faktura")
      .update({
        betalt_belop: Number(belop || 0),
        betalt_dato: dato
      })
      .eq("fakturanr", fakturanr);
  }

  if (res.error) {
    alert("Kunne ikke sette betalt: " + res.error.message);
    return;
  }

  await visOkonomiOversikt();
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
    const startTekst = select.id === "okonomiKundeValg" ? "Alle kunder" : "Velg kunde";

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

function okonomiDetaljHtml(type, rad) {
  const kunde = okonomiKundeNavn(rad.kunde_id || rad.kunden_id, rad.kunde_navn || "");
  const status = okonomiVisStatus(rad);
  const fakturanr = rad.fakturanr || rad.faktura_id || "";
  const dato = okonomiDato(rad.dato || rad.created_at || rad.fakturert_dato);
  const tekst = rad.beskrivelse || rad.kommentar || rad.type || rad.utgift_type || "";
  const belop = rad.inkl_mva || rad.total || rad.sum || rad.belop || (Number(rad.antall || 1) * Number(rad.pris || 0));

  return `
    <div class="okonomi-detalj">
      <strong>${okonomiTryggTekst(type)}</strong>
      <div>Dato: ${okonomiTryggTekst(dato)}</div>
      <div>Kunde: ${okonomiTryggTekst(kunde)}</div>
      <div>Status: ${okonomiStatusMerke(rad)}</div>
      ${fakturanr ? `<div>Fakturanr: ${okonomiTryggTekst(fakturanr)}</div>` : ""}
      <div>Beløp: ${okonomiBelop(belop)} kr</div>
      ${tekst ? `<p>${okonomiTryggTekst(tekst)}</p>` : ""}
      ${type === "Faktura" ? okonomiBetaltKnapp(rad) : ""}
      ${type === "Faktura" ? okonomiPurringKnapp(rad) : ""}
    </div>
  `;
}

function okonomiVisDetalj(type, indeks) {
  const data = window.__okonomiKlikkData || {};
  const rad = data[type]?.[indeks];
  if (!rad) return;

  let detalj = document.getElementById("okonomiDetalj");
  const container = document.getElementById("okonomiOversikt");

  if (!detalj && container) {
    detalj = document.createElement("div");
    detalj.id = "okonomiDetalj";
    container.prepend(detalj);
  }

  if (detalj) {
    detalj.innerHTML = okonomiDetaljHtml(type, rad);
    detalj.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function okonomiLagTabell(tittel, rader, kolonner, tomTekst, klikkType) {
  if (!rader.length) {
    return `<h4>${okonomiTryggTekst(tittel)}</h4><p>${okonomiTryggTekst(tomTekst || "Ingen rader.")}</p>`;
  }

  const thead = kolonner.map(k => `<th>${okonomiTryggTekst(k.tittel)}</th>`).join("");

  const tbody = rader
    .map((rad, indeks) => {
      const celler = kolonner
        .map(k => `<td>${k.html ? k.html(rad) : okonomiTryggTekst(k.verdi(rad))}</td>`)
        .join("");

      const klikk = klikkType
        ? ` class="klikkbar-okonomi" onclick="okonomiVisDetalj('${okonomiTryggJs(klikkType)}', ${indeks})" title="Klikk for detaljer"`
        : "";

      return `<tr${klikk}>${celler}</tr>`;
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
  const alleVarer = await okonomiHentTabell("hand_faktura_vare");
  const alleUtlegg = await okonomiHentTabell("hand_faktura_utlegg");
  const alleFakturaer = await okonomiHentTabell("hand_faktura");

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

  window.__okonomiKlikkData = {
    "Faktura": fakturaer,
    "Time": ikkeFakturerteTimer,
    "Vare": ikkeFakturerteVarer,
    "Utlegg": ikkeFakturerteUtlegg
  };

  const timerEks = ikkeFakturerteTimer.reduce((sum, t) => sum + okonomiTimerEksMva(t), 0);
  const varerEks = ikkeFakturerteVarer.reduce((sum, v) => sum + Number(v.antall || 1) * Number(v.pris || 0), 0);
  const utleggEks = ikkeFakturerteUtlegg.reduce((sum, u) => sum + Number(u.belop || 0), 0);

  const ikkeFakturertEks = timerEks + varerEks + utleggEks;
  const ikkeFakturertMva = (timerEks + varerEks) * 0.25;
  const ikkeFakturertInk = ikkeFakturertEks + ikkeFakturertMva;

  const fakturertInk = fakturaer.reduce((sum, f) => sum + Number(f.inkl_mva || f.total || 0), 0);

  const betalt = fakturaer
    .filter(f => okonomiVisStatus(f) === "Betalt")
    .reduce((sum, f) => sum + Number(f.inkl_mva || f.total || f.betalt_belop || 0), 0);

  const ubetalt = Math.max(0, fakturertInk - betalt);

  const iDag = new Date().toISOString().slice(0, 10);
  const forfalteFakturaer = fakturaer.filter(f => {
    const erBetalt = okonomiVisStatus(f) === "Betalt";
    const forfall = okonomiDato(f.forfallsdato);
    return !erBetalt && forfall && forfall < iDag;
  });

  const forfaltSum = forfalteFakturaer.reduce((sum, f) => sum + Number(f.inkl_mva || f.total || 0), 0);

  const sammendrag = `
    <div id="okonomiDetalj"></div>
    <div class="okonomi-grid">
      <div class="okonomi-boks">Ikke fakturert eks. mva<strong>${okonomiBelop(ikkeFakturertEks)} kr</strong></div>
      <div class="okonomi-boks">Ikke fakturert inkl. mva<strong>${okonomiBelop(ikkeFakturertInk)} kr</strong></div>
      <div class="okonomi-boks">Fakturert inkl. mva<strong>${okonomiBelop(fakturertInk)} kr</strong></div>
      <div class="okonomi-boks">Betalt<strong>${okonomiBelop(betalt)} kr</strong></div>
      <div class="okonomi-boks">Ubetalt faktura<strong>${okonomiBelop(ubetalt)} kr</strong></div>
      <div class="okonomi-boks">Forfalt<strong class="okonomi-advarsel">${okonomiBelop(forfaltSum)} kr</strong></div>
    </div>

    <div class="okonomi-grid">
      <div class="okonomi-boks">Ikke fakturerte timer<strong>${ikkeFakturerteTimer.length}</strong></div>
      <div class="okonomi-boks">Ikke fakturerte varer<strong>${ikkeFakturerteVarer.length}</strong></div>
      <div class="okonomi-boks">Ikke fakturerte utlegg<strong>${ikkeFakturerteUtlegg.length}</strong></div>
      <div class="okonomi-boks">Fakturaer i utvalg<strong>${fakturaer.length}</strong></div>
    </div>
  `;

  const fakturaTabell = okonomiLagTabell(
    "Fakturaer",
    fakturaer,
    [
      { tittel: "Dato", verdi: f => okonomiDato(f.dato || f.created_at) },
      { tittel: "Fakturanr", verdi: f => f.fakturanr || "" },
      { tittel: "Kunde", verdi: f => okonomiKundeNavn(f.kunden_id || f.kunde_id, "") },
      { tittel: "Fakturastatus", html: f => okonomiStatusMerke(f) },
      { tittel: "Forfall", verdi: f => okonomiDato(f.forfallsdato) },
      { tittel: "Inkl. mva", verdi: f => okonomiBelop(f.inkl_mva || f.total || 0) + " kr" },
      { tittel: "Betalt", html: f => okonomiBetaltKnapp(f) },
      { tittel: "Purring", html: f => okonomiPurringKnapp(f) }
    ],
    "Ingen fakturaer i dette utvalget.",
    "Faktura"
  );

  const timerTabell = okonomiLagTabell(
    "Ikke fakturerte timer",
    ikkeFakturerteTimer,
    [
      { tittel: "Dato", verdi: t => okonomiDato(t.dato) },
      { tittel: "Kunde", verdi: t => okonomiKundeNavn(t.kunde_id, t.kunde_navn) },
      { tittel: "Status", html: t => okonomiStatusMerke(t) },
      { tittel: "Beskrivelse", verdi: t => t.beskrivelse || t.kommentar || "" },
      { tittel: "Timer", verdi: t => okonomiBelop(t.timer || 0) },
      { tittel: "Eks. mva", verdi: t => okonomiBelop(okonomiTimerEksMva(t)) + " kr" }
    ],
    "Ingen ikke-fakturerte timer i dette utvalget.",
    "Time"
  );

  const vareTabell = okonomiLagTabell(
    "Ikke fakturerte varer",
    ikkeFakturerteVarer,
    [
      { tittel: "Dato", verdi: v => okonomiDato(v.created_at) },
      { tittel: "Kunde", verdi: v => okonomiKundeNavn(v.kunde_id, "") },
      { tittel: "Status", html: v => okonomiStatusMerke(v) },
      { tittel: "Vare", verdi: v => v.navn || v.vare_navn || v.beskrivelse || "" },
      { tittel: "Antall", verdi: v => v.antall || 1 },
      { tittel: "Eks. mva", verdi: v => okonomiBelop(Number(v.antall || 1) * Number(v.pris || 0)) + " kr" }
    ],
    "Ingen ikke-fakturerte varer i dette utvalget.",
    "Vare"
  );

  const utleggTabell = okonomiLagTabell(
    "Ikke fakturerte utlegg",
    ikkeFakturerteUtlegg,
    [
      { tittel: "Dato", verdi: u => okonomiDato(u.created_at) },
      { tittel: "Kunde", verdi: u => okonomiKundeNavn(u.kunde_id, "") },
      { tittel: "Status", html: u => okonomiStatusMerke(u) },
      { tittel: "Type", verdi: u => u.type || u.utgift_type || "" },
      { tittel: "Beskrivelse", verdi: u => u.beskrivelse || "" },
      { tittel: "Beløp", verdi: u => okonomiBelop(u.belop || 0) + " kr" }
    ],
    "Ingen ikke-fakturerte utlegg i dette utvalget.",
    "Utlegg"
  );

  container.innerHTML = sammendrag + fakturaTabell + timerTabell + vareTabell + utleggTabell;

  if (melding) {
    melding.textContent = "Økonomioversikt oppdatert. Klikk på en linje for detaljer.";
  }
}

window.fyllOkonomiKundeValg = fyllOkonomiKundeValg;
window.visOkonomiOversikt = visOkonomiOversikt;
window.okonomiSettBetalt = okonomiSettBetalt;
window.okonomiPurringKnapp = okonomiPurringKnapp;
window.okonomiVisDetalj = okonomiVisDetalj;

window.addEventListener("load", function () {
  fyllOkonomiKundeValg();

  const knapp = document.getElementById("okonomiOversiktKnapp");
  if (knapp) {
    knapp.onclick = visOkonomiOversikt;
  }
});
