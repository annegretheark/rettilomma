const MVA_SATS = 0.25;
const LOGO_URL = window.location.origin + "/NyTimerdelt/logo.jpg";

function finnProsjektForTime(time) {
  return (window.prosjekter || []).find(p =>
    String(p.id || "") === String(time.prosjekt_id || "")
  ) || null;
}

function hentProsjektTekst(time) {
  const prosjekt = finnProsjektForTime(time);
  if (!prosjekt) return "";
  return `${prosjekt.prosjektnr || ""} ${prosjekt.navn || ""}`.trim();
}


function hentUtforerNavnForFaktura(time) {
  const ansattId = String(time?.ansatt_id || "");
  const epost = String(time?.ansatt_epost || time?.epost || "").toLowerCase();
  const liste = window.ansatte || [];
  const ansatt = liste.find(a =>
    (ansattId && String(a.id || "") === ansattId) ||
    (epost && String(a.epost || "").toLowerCase() === epost)
  );
  return ansatt?.navn || ansatt?.epost || time?.ansatt_navn || "";
}

async function hentVareMapForTimer(timerListe) {
  const vareIder = [
    ...new Set(
      (timerListe || [])
        .map(t => t.vare_id)
        .filter(Boolean)
    )
  ];

  if (!vareIder.length) return {};

  const { data, error } = await supabaseClient
    .from("hand_vare")
    .select("*")
    .in("id", vareIder);

  if (error) {
    console.error("Feil ved henting av varer til faktura:", error);
    return {};
  }

  const map = {};
  (data || []).forEach(v => {
    map[String(v.id)] = v;
  });

  return map;
}

function byggFakturaLinjer(timerListe, vareMap) {
  const linjer = [];

  (timerListe || []).forEach(t => {
    const linje = beregnMvaLinje(t);
    const prosjektTekst = hentProsjektTekst(t);
    const utforer = hentUtforerNavnForFaktura(t);

    linjer.push({
      dato: t.dato || "",
      beskrivelse: String(
        (prosjektTekst ? prosjektTekst + " - " : "") +
        (t.beskrivelse || t.kommentar || "Timer")
      ).slice(0, 40),
      utforer,
      antall: t.timer || 0,
      sumEksMva: linje.sumEksMva,
      mva: linje.mva
    });

    if (t.vare_id) {
      const vare = vareMap[String(t.vare_id)];

      if (vare) {
        const antall = Number(t.vare_antall || 1);
        const pris = Number(vare.pris || 0);
        const sumEksMva = antall * pris;
        const mvaSats = Number(vare.mva_sats || 25) / 100;
        const mva = sumEksMva * mvaSats;

        linjer.push({
          dato: t.dato || "",
          beskrivelse: String(
            `${vare.varenr || ""} ${vare.navn || ""}`
          ).trim().slice(0, 40),
          utforer,
          antall: antall,
          sumEksMva: sumEksMva,
          mva: mva
        });
      }
    }
  });

  return linjer;
}

async function hentDirekteFakturaVarer(valgtKunde) {
  const { data, error } = await supabaseClient
    .from("hand_faktura_vare")
    .select("*")
    .eq("fakturert", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Feil ved henting av direkte fakturavarer:", error);
    return [];
  }

  if (!valgtKunde || !valgtKunde.id) {
    return data || [];
  }

  return (data || []).filter(v =>
    String(v.kunde_id) === String(valgtKunde.id)
  );
}
async function hentDirekteFakturaUtlegg(valgtKunde) {
  const { data, error } = await supabaseClient
    .from("hand_faktura_utlegg")
    .select("*")
    .eq("fakturert", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Feil ved henting av utlegg:", error);
    return [];
  }

  if (!valgtKunde || !valgtKunde.id) {
    return data || [];
  }

  return (data || []).filter(u =>
    String(u.kunde_id) === String(valgtKunde.id)
  );
}

function fakturaTekst(verdi) {
  // jsPDF kan få rare utslag hvis undefined/null eller veldig lange tekster dyttes rett inn.
  return String(verdi ?? "");
}

function fakturaUtleggTypeTekst(type) {
  const t = String(type || "").toLowerCase().trim();
  const map = {
    kjoring: "kjøring",
    kjoering: "kjøring",
    bompenger: "bompenger",
    parkering: "parkering",
    ferge: "ferge",
    diett: "diett",
    billetter: "billetter",
    annet: "annet"
  };
  return map[t] || String(type || "utlegg");
}

function fjernDuplikatUtlegg(utleggListe) {
  const sett = new Set();
  const rader = [];

  (utleggListe || []).forEach(u => {
    const key = [
      String(u.kunde_id || ""),
      String(u.type || u.utgift_type || "").toLowerCase().trim(),
      Number(u.belop || 0).toFixed(2),
      String(u.created_at || "").slice(0, 10),
      String(u.beskrivelse || "").toLowerCase().trim()
    ].join("|");

    if (sett.has(key)) return;
    sett.add(key);
    rader.push(u);
  });

  return rader;
}

function byggDirekteUtleggLinjer(direkteUtlegg) {
  return fjernDuplikatUtlegg(direkteUtlegg).map(u => {
    const typeTekst = fakturaUtleggTypeTekst(u.type || u.utgift_type || u.beskrivelse || "utlegg");
    return {
      dato: String(u.created_at || u.dato || "").slice(0, 10),
      beskrivelse: "Utlegg: " + typeTekst,
      utforer: "",
      antall: 1,
      sumEksMva: Number(u.belop || 0),
      mva: 0,
      _utleggId: u.id || null
    };
  });
}

function samleKjoringLinjer(utleggLinjer) {
  const linjer = utleggLinjer || [];
  const kjoring = linjer.filter(l =>
    String(l.beskrivelse || "").toLowerCase().includes("kjøring") ||
    String(l.beskrivelse || "").toLowerCase().includes("kjoring")
  );
  const andre = linjer.filter(l => !kjoring.includes(l));

  const sumKjoring = kjoring.reduce((sum, l) => sum + Number(l.sumEksMva || 0), 0);
  if (sumKjoring <= 0) return linjer;

  const dato = kjoring[0]?.dato || "";
  return [{
    dato,
    beskrivelse: "Utlegg: kjøring",
    utforer: "",
    antall: 1,
    sumEksMva: sumKjoring,
    mva: 0
  }].concat(andre);
}

async function sperrDirekteFakturaUtlegg(direkteUtlegg, fakturanr) {
  const ider = fjernDuplikatUtlegg(direkteUtlegg)
    .map(u => u.id)
    .filter(Boolean);

  if (!ider.length) return;

  const { error } = await supabaseClient
    .from("hand_faktura_utlegg")
    .update({
      fakturert: true,
      fakturanr
    })
    .in("id", ider);

  if (error) {
    console.error("Feil ved sperring av direkte utlegg:", error);
    alert("Faktura ble laget, men utlegg ble ikke sperret: " + error.message);
  }
}

function forkortPdfTekst(doc, tekst, maksBredde) {
  tekst = fakturaTekst(tekst);
  if (!tekst) return "";
  if (doc.getTextWidth(tekst) <= maksBredde) return tekst;
  let t = tekst;
  while (t.length > 1 && doc.getTextWidth(t + "…") > maksBredde) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function byggDirekteVareLinjer(direkteVarer) {
  return (direkteVarer || []).map(v => {
    const antall = Number(v.antall || 1);
    const pris = Number(v.pris || 0);
    const sumEksMva = antall * pris;
    const mva = sumEksMva * (Number(v.mva_prosent || 25) / 100);

    const tekst = String(
      `${v.varenr || ""} ${v.navn || ""}` +
      (v.beskrivelse ? ` - ${v.beskrivelse}` : "")
    ).trim();

    return {
      dato: String(v.created_at || "").slice(0, 10),
      beskrivelse: tekst.slice(0, 40),
      utforer: "",
      antall,
      sumEksMva,
      mva
    };
  });
}

function finnKundeForDirekteVare(vare) {
  return (window.kunder || []).find(k =>
    String(k.id || "") === String(vare.kunde_id || "")
  ) || null;
}

async function sperrDirekteFakturaVarer(direkteVarer, fakturanr) {
  const ider = (direkteVarer || [])
    .map(v => v.id)
    .filter(Boolean);

  if (!ider.length) return;

  const { error } = await supabaseClient
    .from("hand_faktura_vare")
    .update({
      fakturert: true,
      fakturanr
    })
    .in("id", ider);

  if (error) {
    console.error("Feil ved sperring av direkte fakturavarer:", error);
    alert("Faktura ble laget, men direkte varelinjer ble ikke sperret: " + error.message);
  }
}

function grupperDirekteVarerPerKundeOgProsjekt(varerListe) {
  const grupper = {};

  (varerListe || []).forEach(v => {
    const key =
      String(v.kunde_id || "utenkunde") +
      "_utenprosjekt";

    if (!grupper[key]) grupper[key] = [];
    grupper[key].push(v);
  });

  return grupper;
}
function summerFakturaLinjer(linjer) {
  const sumEksMva = (linjer || []).reduce(
    (sum, l) => sum + Number(l.sumEksMva || 0),
    0
  );

  const mva = (linjer || []).reduce(
    (sum, l) => sum + Number(l.mva || 0),
    0
  );

  return {
    sumEksMva,
    mva,
    sumInkMva: sumEksMva + mva
  };
}

async function lagEnFakturaPdf(
  kunde,
  fakturaTimer,
  maaned,
  firma,
  erKopi = false,
  eksisterendeFakturanr = null,
  direkteVarer = [],
  direkteUtlegg = []
) {
  const jspdfObj = window.jspdf;

  if (!jspdfObj || !jspdfObj.jsPDF) {
    alert("PDF-biblioteket er ikke lastet.");
    return;
  }

  const doc = new jspdfObj.jsPDF();

  fakturaTimer = fakturaTimer || [];

  const fakturaRef =
    fakturaTimer[0] ||
    direkteVarer[0] ||
    {};

  const vareMap = await hentVareMapForTimer(fakturaTimer);
  const timeLinjer = byggFakturaLinjer(fakturaTimer, vareMap);
  const direkteVareLinjer = byggDirekteVareLinjer(direkteVarer);
  const direkteUtleggLinjer = samleKjoringLinjer(byggDirekteUtleggLinjer(direkteUtlegg));

  const fakturaLinjer = timeLinjer.concat(direkteVareLinjer, direkteUtleggLinjer);

  const summer = summerFakturaLinjer(fakturaLinjer);

  const fakturaDato = new Date();
  const forfallsDato = leggTilDager(fakturaDato, 14);
  const prosjektTekst = hentProsjektTekst(fakturaRef);
  const status = "Ubetalt";

  const fakturanr =
    eksisterendeFakturanr ||
    fakturaRef?.fakturanr ||
    fakturaRef?.faktura_nr ||
    (
      "F-" +
      formatDatoISO(fakturaDato).replaceAll("-", "") +
      "-" +
      Math.floor(Math.random() * 9000 + 1000)
    );

  if (typeof tegnBrevhodePdf === "function") {
    await tegnBrevhodePdf(doc, firma);
  } else {
    await leggTilLogo(doc);
  }

  let y = 90;

  doc.setFontSize(20);
  doc.text("FAKTURA", 14, y);

  if (erKopi) {
    doc.setFontSize(16);
    doc.text("KOPI", 165, y);
  }

  let hoyreY = 95;

  doc.setFontSize(10);
  doc.text("Forfallsdato", 140, hoyreY);
  doc.text(formatDatoISO(forfallsDato), 175, hoyreY);

  hoyreY += 6;
  doc.text("Kontonr", 140, hoyreY);
  doc.text(firma.kontonr || "", 175, hoyreY);

  hoyreY += 6;
  doc.text("Fakturanr", 140, hoyreY);
  doc.text(fakturanr, 175, hoyreY);

  hoyreY += 6;
  doc.text("Dato", 140, hoyreY);
  doc.text(formatDatoISO(fakturaDato), 175, hoyreY);

  hoyreY += 6;
  doc.text("Kundenr", 140, hoyreY);
  doc.text(hentKundeNr(kunde, fakturaRef), 175, hoyreY);

  y += 25;

  doc.setFontSize(12);
  doc.text(hentKundeNavn(kunde, fakturaRef), 14, y);

  y += 6;

  doc.setFontSize(10);

  if (kunde && kunde.adresse) {
    doc.text(kunde.adresse, 14, y);
    y += 5;
  }

  if (kunde && kunde.postadresse) {
    doc.text(kunde.postadresse, 14, y);
    y += 5;
  }

  if (prosjektTekst) {
    y += 4;
    doc.setFontSize(11);
    doc.text("Prosjekt: " + prosjektTekst, 14, y);
    y += 6;
  }

  y += 10;

  doc.setFontSize(10);
  doc.text("Dato", 14, y);
  doc.text("Beskrivelse", 38, y);
  doc.text("Utfører", 100, y);
  doc.text("Antall", 142, y);
  doc.text("Eks mva", 158, y);
  doc.text("MVA", 181, y);

  y += 4;

  if (typeof tegnSkilleLinjePdf === "function") {
    tegnSkilleLinjePdf(doc, y);
  } else {
    doc.line(14, y, 195, y);
  }

  y += 7;

  for (const linje of fakturaLinjer) {

    if (y > 250) {
      doc.addPage();

      if (typeof tegnBrevhodePdf === "function") {
        await tegnBrevhodePdf(doc, firma);
      } else {
        await leggTilLogo(doc);
      }

      y = 90;

      doc.setFontSize(10);
      doc.text("Dato", 14, y);
      doc.text("Beskrivelse", 38, y);
      doc.text("Utfører", 100, y);
      doc.text("Antall", 142, y);
      doc.text("Eks mva", 158, y);
      doc.text("MVA", 181, y);

      y += 4;

      if (typeof tegnSkilleLinjePdf === "function") {
        tegnSkilleLinjePdf(doc, y);
      } else {
        doc.line(14, y, 195, y);
      }

      y += 7;
    }

    doc.setFontSize(9);
    doc.text(forkortPdfTekst(doc, linje.dato || "", 22), 14, y);
    doc.text(forkortPdfTekst(doc, linje.beskrivelse || "", 58), 38, y);
    doc.text(forkortPdfTekst(doc, linje.utforer || "", 38), 100, y);
    doc.text(fakturaTekst(linje.antall || 0), 142, y);
    doc.text(formatBelop(linje.sumEksMva), 158, y);
    doc.text(formatBelop(linje.mva), 181, y);

    y += 6;
  }

  y += 4;

  if (typeof tegnSkilleLinjePdf === "function") {
    tegnSkilleLinjePdf(doc, y, 120, 195);
  } else {
    doc.line(120, y, 195, y);
  }

  y += 8;

  doc.setFontSize(11);
  doc.text("Sum eks mva:", 130, y);
  doc.text(formatBelop(summer.sumEksMva) + " kr", 170, y);

  y += 6;
  doc.text("MVA:", 130, y);
  doc.text(formatBelop(summer.mva) + " kr", 170, y);

  y += 6;

  doc.setFontSize(12);
  doc.text("Sum inkl mva:", 130, y);
  doc.text(formatBelop(summer.sumInkMva) + " kr", 170, y);

  if (typeof tegnBrevfotAlleSiderPdf === "function") {
    tegnBrevfotAlleSiderPdf(doc, firma);
  }

  const prosjektFilnavn =
    prosjektTekst
      ? "_" + tryggFilnavn(prosjektTekst)
      : "";

  const filnavn =
    `${tryggFilnavn(hentKundeNavn(kunde, fakturaRef))}${prosjektFilnavn}_${maaned}${erKopi ? "_KOPI" : ""}.pdf`;

  doc.save(filnavn);

  await supabaseClient
    .from("hand_faktura")
    .insert({
      kunden_id: kunde?.id || null,
      fakturanr: fakturanr,
      dato: fakturaDato.toISOString(),
      forfallsdato: forfallsDato.toISOString(),
      status: status,
      eks_mva: summer.sumEksMva,
      mva: summer.mva,
      inkl_mva: summer.sumInkMva
    });

  if (!erKopi) {

    if (fakturaTimer.length) {
      const timerSperret = await sperrFakturerteTimer(
        fakturaTimer,
        fakturanr
      );

      if (!timerSperret) {
        // PDF og fakturapost er laget, men vi stopper her slik at bruker ikke tror
        // samme jobb trygt kan faktureres på nytt.
        return;
      }
    }

    if (direkteVarer.length) {
      await sperrDirekteFakturaVarer(
        direkteVarer,
        fakturanr
      );
    }

    if (direkteUtlegg.length) {
      await sperrDirekteFakturaUtlegg(
        direkteUtlegg,
        fakturanr
      );
    }
  }
}
function grupperTimerPerKundeOgProsjekt(timerListe) {
  const grupper = {};

  timerListe.forEach(t => {
    const key =
      String(t.kunde_id || t.kunde_nr || t.kunde_navn || "utenkunde") +
      "_" +
      String(t.prosjekt_id || "utenprosjekt");

    if (!grupper[key]) {
      grupper[key] = [];
    }

    grupper[key].push(t);
  });

  return Object.keys(grupper).map(key => ({
    key,
    timer: grupper[key]
  }));
}

async function lagFakturaPdf() {
  const melding =
    document.getElementById("fakturaMelding") ||
    document.getElementById("timerMelding");

  try {
    const maaned = hentValgtMaaned();
    const firma = await hentFirmaData();
    const valgtKunde = hentValgtKunde();

    if (!valgtKunde) {
      if (melding) {
        melding.textContent = "Velg kunde før du lager faktura.";
      }
      alert("Velg kunde før du lager faktura.");
      return;
    }

    const timerForMaaned =
      (window.timer || [])
        .filter(t => !erAlleredeFakturert(t))
        .filter(t => String(t.dato || "").slice(0, 7) === maaned)
        .filter(t => erSammeKunde(t, valgtKunde));

  const direkteVarer = await hentDirekteFakturaVarer(valgtKunde);
  const direkteUtlegg = fjernDuplikatUtlegg(await hentDirekteFakturaUtlegg(valgtKunde));

    if (!timerForMaaned.length && !direkteVarer.length && !direkteUtlegg.length) {
      if (melding) {
        melding.textContent =
          "Fant ingen fakturerbare timer, direkte varelinjer eller utlegg på valgt kunde. De kan allerede være fakturert.";
      }

      return;
    }

    const timerGrupper = grupperTimerPerKundeOgProsjekt(timerForMaaned);
    const vareGrupper = grupperDirekteVarerPerKundeOgProsjekt(direkteVarer);

    const alleNokler = new Set();

    timerGrupper.forEach(g => alleNokler.add(g.key));
    Object.keys(vareGrupper).forEach(key => alleNokler.add(key));
    if (direkteUtlegg.length && alleNokler.size === 0) {
      alleNokler.add(String(valgtKunde.id || valgtKunde.kundenr || "kunde") + "_utenprosjekt");
    }

    let utleggBrukt = false;

    for (const key of alleNokler) {
      const gruppeTimer =
        (timerGrupper.find(g => g.key === key) || {}).timer || [];

      const gruppeVarer = vareGrupper[key] || [];

      const kunde =
        valgtKunde ||
        (gruppeTimer.length ? finnKundeForTime(gruppeTimer[0]) : null) ||
        (gruppeVarer.length ? finnKundeForDirekteVare(gruppeVarer[0]) : null) ||
        null;

      const gruppeUtlegg = utleggBrukt ? [] : direkteUtlegg;
      utleggBrukt = true;

      await lagEnFakturaPdf(
        kunde,
        gruppeTimer,
        maaned,
        firma,
        false,
        null,
        gruppeVarer,
        gruppeUtlegg
      );
  }
    if (typeof window.lastTimer === "function") {
      try { await window.lastTimer(); } catch (e) { console.warn("Kunne ikke laste timer på nytt etter faktura:", e); }
    }

    if (melding) {
      melding.textContent =
        "Faktura PDF laget for valgt kunde. Jobber, varelinjer og utlegg er sperret mot ny fakturering.";
    }

    if (typeof fyllKreditnotaFakturaValg === "function") {
      fyllKreditnotaFakturaValg();
    }
  } catch (e) {
    const feiltekst =
      "Faktura feilet: " +
      (e && e.message ? e.message : String(e));

    console.error("Faktura feilet:", e);

    if (melding) {
      melding.textContent = feiltekst;
    }

    alert(feiltekst);
  }
}

function fyllFakturaKopiValg() {
  if (typeof window.fyllFellesFakturaValg === "function") {
    window.fyllFellesFakturaValg(
      "fakturaKopiValg",
      "Velg faktura for kopi",
      "Ingen fakturaer funnet"
    );
  }
}

function hentFakturaKopiSelect() {
  return (
    document.getElementById("fakturaKopiValg") ||
    document.getElementById("fakturaKopiFakturaValg")
  );
}

function hentValgtFakturanrForKopi() {
  const select = hentFakturaKopiSelect();

  if (!select) {
    return "";
  }

  let verdi = String(select.value || "").trim();

  if (!verdi && select.selectedIndex >= 0) {
    verdi = String(select.options[select.selectedIndex].text || "").trim();
  }

  return verdi;
}

async function lagFakturaKopiPdf() {
  const omrade = document.getElementById("fakturaKopiOmrade");
  const select = hentFakturaKopiSelect();
  const melding = document.getElementById("timerMelding");

  if (!select) {
    alert("Fant ikke nedtrekksliste for faktura.");
    return;
  }

  const fakturanr = hentValgtFakturanrForKopi();

  if (!fakturanr) {
    alert("Velg faktura først.");
    return;
  }

  try {
    if (melding) {
      melding.textContent = "Starter utskrift av fakturakopi...";
    }

    const kopiTimer = (window.timer || []).filter(t => {
      const nr = String(t.fakturanr || t.faktura_nr || "").trim();
      return nr === fakturanr;
    });

    if (!kopiTimer.length) {
      alert("Fant ingen timer på valgt faktura: " + fakturanr);
      return;
    }

    const firma = await hentFirmaData();
    const kunde = finnKundeForTime(kopiTimer[0]) || null;
    const maaned = String(kopiTimer[0].dato || new Date().toISOString()).slice(0, 7);

    await lagEnFakturaPdf(
      kunde,
      kopiTimer,
      maaned,
      firma,
      true,
      fakturanr
    );

    if (omrade) {
      omrade.style.display = "none";
    }

    if (melding) {
      melding.textContent = "Fakturakopi laget.";
    }
  } catch (e) {
    console.error("Fakturakopi feilet:", e);
    alert("Fakturakopi feilet: " + (e.message || e));
  }
}

function kobleFakturaKnapp() {
  const pdfKnapp = document.getElementById("pdfKnapp");

  if (!pdfKnapp) {
    console.warn("Fant ikke pdfKnapp");
    return;
  }

  pdfKnapp.onclick = async function () {
    await lagFakturaPdf();
  };
}

function kobleFakturaKopiKnapp() {
  const kopiKnapp = document.getElementById("fakturaKopiKnapp");
  const skrivUtKopiKnapp = document.getElementById("skrivUtFakturaKopiKnapp");

  if (kopiKnapp) {
    kopiKnapp.onclick = function () {
      const kopiOmrade = document.getElementById("fakturaKopiOmrade");
      const kreditOmrade = document.getElementById("kreditnotaOmrade");

      if (kreditOmrade) kreditOmrade.style.display = "none";
      if (kopiOmrade) kopiOmrade.style.display = "block";

      fyllFakturaKopiValg();
    };
  }

  if (skrivUtKopiKnapp) {
    skrivUtKopiKnapp.onclick = async function () {
      await lagFakturaKopiPdf();
    };
  }
}

function kobleKreditnotaVisning() {
  const kreditKnapp = document.getElementById("kreditnotaKnapp");

  if (kreditKnapp) {
    kreditKnapp.onclick = function () {
      const kopiOmrade = document.getElementById("fakturaKopiOmrade");
      const kreditOmrade = document.getElementById("kreditnotaOmrade");

      if (kopiOmrade) kopiOmrade.style.display = "none";
      if (kreditOmrade) kreditOmrade.style.display = "block";

      if (typeof fyllKreditnotaFakturaValg === "function") {
        fyllKreditnotaFakturaValg();
      }
    };
  }
}

function fyllKreditnotaFakturaValg() {
  if (typeof window.fyllFellesFakturaValg === "function") {
    window.fyllFellesFakturaValg(
      "kreditnotaFakturaValg",
      "Velg faktura å kreditere",
      "Ingen fakturaer funnet"
    );
  }
}

async function lagKreditnotaPdf() {
  const select = document.getElementById("kreditnotaFakturaValg");

  if (!select || !select.value) {
    alert("Velg faktura først.");
    return;
  }

  const fakturanr = String(select.value || "").trim();

  const jspdfObj = window.jspdf;
  if (!jspdfObj || !jspdfObj.jsPDF) {
    alert("PDF-biblioteket er ikke lastet.");
    return;
  }

  if (!window.supabaseClient) {
    alert("Supabase er ikke lastet.");
    return;
  }

  const { data: fakturaData, error: fakturaError } = await supabaseClient
    .from("hand_faktura")
    .select("*")
    .eq("fakturanr", fakturanr)
    .limit(1);

  if (fakturaError) {
    alert("Kunne ikke hente faktura: " + fakturaError.message);
    return;
  }

  const faktura = Array.isArray(fakturaData) ? fakturaData[0] : null;

  if (!faktura) {
    alert("Fant ikke valgt faktura i fakturaer-tabellen.");
    return;
  }

  const firma = await hentFirmaData();
  const doc = new jspdfObj.jsPDF();

  if (typeof tegnBrevhodePdf === "function") {
    await tegnBrevhodePdf(doc, firma);
  } else if (typeof leggTilLogo === "function") {
    await leggTilLogo(doc);
  }

  let kunde = null;
  const kundeId = faktura.kunden_id || faktura.kunde_id || "";

  if (kundeId) {
    kunde = (window.kunder || []).find(k => String(k.id || "") === String(kundeId)) || null;

    if (!kunde) {
      try {
        const { data: kundeData } = await supabaseClient
          .from("hand_kunde")
          .select("*")
          .eq("id", kundeId)
          .limit(1);

        kunde = Array.isArray(kundeData) ? kundeData[0] : null;
      } catch (e) {
        console.warn("Kunne ikke hente kunde til kreditnota:", e);
      }
    }
  }

  const kreditnotaNr = "KREDIT-" + fakturanr;
  const eksMva = Number(faktura.eks_mva || faktura.sum_eks_mva || 0);
  const mva = Number(faktura.mva || 0);
  const inklMva = Number(faktura.inkl_mva || faktura.total || (eksMva + mva));

  let y = 70;

  doc.setFontSize(20);
  doc.text("KREDITNOTA", 14, y);

  doc.setFontSize(10);
  doc.text("Kreditnota nr", 118, y);
  doc.text(forkortPdfTekst(doc, kreditnotaNr, 48), 195, y, { align: "right" });

  y += 6;
  doc.text("Krediterer faktura", 118, y);
  doc.text(forkortPdfTekst(doc, fakturanr, 48), 195, y, { align: "right" });

  y += 6;
  doc.text("Dato", 118, y);
  doc.text(formatDatoISO(new Date()), 195, y, { align: "right" });

  y = 95;

  doc.setFontSize(11);
  doc.text("Kunde", 14, y);
  y += 6;

  doc.setFontSize(10);
  const kundeNavn =
    kunde?.navn ||
    faktura.kunde_navn ||
    faktura.kundenavn ||
    "Kunde";

  doc.text(String(kundeNavn), 14, y);
  y += 6;

  const kundeAdresse = kunde?.adresse || faktura.kunde_adresse || "";
  const kundePostadresse = kunde?.postadresse || faktura.kunde_postadresse || "";

  if (kundeAdresse) {
    doc.text(String(kundeAdresse), 14, y);
    y += 6;
  }

  if (kundePostadresse) {
    doc.text(String(kundePostadresse), 14, y);
    y += 6;
  }

  y += 10;

  doc.setFontSize(10);
  doc.text("Beskrivelse", 14, y);
  doc.text("Beløp eks. mva", 195, y, { align: "right" });

  if (typeof tegnSkilleLinjePdf === "function") {
    tegnSkilleLinjePdf(doc, y + 2);
  } else {
    doc.line(14, y + 2, 195, y + 2);
  }

  y += 10;

  doc.text(forkortPdfTekst(doc, "Kreditering av faktura " + fakturanr, 115), 14, y);
  doc.text("-" + formatBelop(eksMva) + " kr", 195, y, { align: "right" });

  y += 20;

  doc.setFontSize(11);
  doc.text("Sum eks. mva", 120, y);
  doc.text("-" + formatBelop(eksMva) + " kr", 195, y, { align: "right" });

  y += 7;
  doc.text("MVA", 120, y);
  doc.text("-" + formatBelop(mva) + " kr", 195, y, { align: "right" });

  y += 7;
  doc.setFontSize(12);
  doc.text("Sum inkl. mva", 120, y);
  doc.text("-" + formatBelop(inklMva) + " kr", 195, y, { align: "right" });

  if (typeof tegnBrevfotAlleSiderPdf === "function") {
    tegnBrevfotAlleSiderPdf(doc, firma);
  }

  doc.save("kreditnota_" + tryggFilnavn(fakturanr) + ".pdf");

  try {
    await supabaseClient
      .from("hand_faktura")
      .update({ status: "kreditert" })
      .eq("fakturanr", fakturanr);
  } catch (e) {
    console.warn("Kreditnota ble laget, men faktura kunne ikke merkes kreditert:", e);
  }

  const kreditOmrade = document.getElementById("kreditnotaOmrade");
  if (kreditOmrade) kreditOmrade.style.display = "none";

  if (typeof fyllKreditnotaFakturaValg === "function") {
    fyllKreditnotaFakturaValg();
  }

  alert("Kreditnota laget.");
}
function kobleKreditnotaKnapp() {
  const knapp =
    document.getElementById("skrivUtKreditnotaKnapp");

  if (!knapp) {
    return;
  }

  knapp.onclick = async function () {
    await lagKreditnotaPdf();
  };
}
function purringErUbetalt(f) {
  const status = String(f?.status || f?.betalingsstatus || "").toLowerCase();
  const inkl = Number(f?.inkl_mva || f?.total || 0);
  const betalt = Number(f?.betalt_belop || 0);

  if (status === "betalt" || status === "kreditert" || status === "kreditnota") return false;
  if (inkl > 0 && betalt >= inkl) return false;

  return true;
}

function purringErForfalt(f) {
  const forfall = String(f?.forfallsdato || "").slice(0, 10);
  const iDag = new Date().toISOString().slice(0, 10);
  return !forfall || forfall < iDag;
}

async function hentPurrbareFakturaer() {
  const { data, error } = await supabaseClient
    .from("hand_faktura")
    .select("*")
    .order("forfallsdato", { ascending: true });

  if (error) {
    alert("Feil ved henting av fakturaer til purring: " + error.message);
    return [];
  }

  return (data || [])
    .filter(purringErUbetalt)
    .filter(purringErForfalt);
}

async function merkFakturaerPurret(fakturaer) {
  const fakturanr = (fakturaer || [])
    .map(f => f.fakturanr)
    .filter(Boolean);

  if (!fakturanr.length) return;

  const iDag = new Date().toISOString().slice(0, 10);

  // Først prøver vi alle purringkolonner. Hvis databasen mangler noen av dem,
  // faller vi pent tilbake uten å stoppe utskriften.
  let res = await supabaseClient
    .from("hand_faktura")
    .update({
      status: "Purret",
      betalingsstatus: "purret",
      siste_purring_dato: iDag
    })
    .in("fakturanr", fakturanr);

  if (res.error) {
    res = await supabaseClient
      .from("hand_faktura")
      .update({ status: "Purret" })
      .in("fakturanr", fakturanr);
  }

  if (res.error) {
    console.warn("Purring ble skrevet ut, men fakturaene ble ikke merket purret:", res.error);
  }
}

async function skrivUtPurringerPdf(fakturaer = null) {
  const data = fakturaer || await hentPurrbareFakturaer();

  if (!data || !data.length) {
    alert("Ingen ubetalte/forfalte fakturaer å purre.");
    return;
  }

  const jspdfObj = window.jspdf;

  if (!jspdfObj || !jspdfObj.jsPDF) {
    alert("PDF-biblioteket er ikke lastet.");
    return;
  }

  const doc = new jspdfObj.jsPDF();
  const firma = await hentFirmaData();

  for (const f of data) {
    if (data.indexOf(f) > 0) {
      doc.addPage();
    }

    if (typeof tegnBrevhodePdf === "function") {
      await tegnBrevhodePdf(doc, firma);
    } else if (typeof leggTilLogo === "function") {
      await leggTilLogo(doc);
    }

    let y = 90;

    doc.setFontSize(20);
    doc.text("PURRING", 14, y);

    let hoyreY = 95;

    doc.setFontSize(10);
    doc.text("Fakturanr", 140, hoyreY);
    doc.text(String(f.fakturanr || ""), 195, hoyreY, { align: "right" });

    hoyreY += 6;
    doc.text("Dato", 140, hoyreY);
    doc.text(formatDatoISO(new Date()), 195, hoyreY, { align: "right" });

    hoyreY += 6;
    doc.text("Oppr. forfall", 140, hoyreY);
    doc.text(String(f.forfallsdato || "").slice(0, 10), 195, hoyreY, { align: "right" });

    hoyreY += 6;
    doc.text("Ny frist", 140, hoyreY);
    doc.text(formatDatoISO(leggTilDager(new Date(), 14)), 195, hoyreY, { align: "right" });

    y += 35;

    doc.setFontSize(11);
    doc.text("Vi kan ikke se å ha mottatt betaling for faktura:", 14, y);

    y += 10;
    doc.setFontSize(12);
    doc.text("Fakturanr: " + String(f.fakturanr || ""), 14, y);

    y += 8;
    doc.text("Beløp inkl. mva: " + formatBelop(f.inkl_mva || f.total || 0) + " kr", 14, y);

    y += 8;
    doc.text("Purring nr: " + String(Number(f.purret_antall || 0) + 1), 14, y);

    y += 14;
    doc.setFontSize(10);
    doc.text("Vennligst betal innen ny betalingsfrist.", 14, y);

    if (typeof tegnBrevfotAlleSiderPdf === "function") {
      tegnBrevfotAlleSiderPdf(doc, firma);
    }
  }

  doc.save("purringer_" + new Date().toISOString().slice(0, 10) + ".pdf");
  await merkFakturaerPurret(data);
}

async function kjorPurring() {
  const fakturaer = await hentPurrbareFakturaer();
  if (!fakturaer.length) {
    alert("Ingen ubetalte/forfalte fakturaer å purre.");
    return;
  }
  await skrivUtPurringerPdf(fakturaer);
}


async function lagPurringFraOkonomi(fakturanr) {
  fakturanr = String(fakturanr || "").trim();

  if (!fakturanr) {
    alert("Mangler fakturanr.");
    return;
  }

  if (!window.supabaseClient) {
    alert("Supabase er ikke lastet.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("hand_faktura")
    .select("*")
    .eq("fakturanr", fakturanr)
    .limit(1);

  if (error) {
    alert("Kunne ikke hente faktura for purring: " + error.message);
    return;
  }

  const faktura = (data || [])[0];

  if (!faktura) {
    alert("Fant ikke faktura " + fakturanr + ".");
    return;
  }

  if (!purringErUbetalt(faktura)) {
    alert("Denne fakturaen er betalt eller kreditert og kan ikke purres.");
    return;
  }

  await skrivUtPurringerPdf([faktura]);
}


function koblePurrAlleKnapp() {
  const knapp =
    document.getElementById("purrAlleKnapp") ||
    document.getElementById("purringKnapp");

  if (!knapp) {
    console.warn("Fant ikke purrAlleKnapp/purringKnapp");
    return;
  }

  knapp.onclick = async function () {
    const fakturaer = await hentPurrbareFakturaer();

    if (!fakturaer.length) {
      alert("Ingen ubetalte/forfalte fakturaer å purre.");
      return;
    }

    const tekst =
      "Fant " + fakturaer.length + " forfalte fakturaer.\n\n" +
      "Vil du lage purring for alle nå?";

    if (!confirm(tekst)) {
      return;
    }

    await skrivUtPurringerPdf(fakturaer);
  };
}

function koblePurringKnapp() {
  const knapp = document.getElementById("purringKnapp");

  if (!knapp) {
    console.warn("Fant ikke purringKnapp");
    return;
  }

  knapp.onclick = async function () {
    await kjorPurring();
  };
}

window.lagKreditnotaPdf = lagKreditnotaPdf;
window.lagPurringFraOkonomi = lagPurringFraOkonomi;
kobleFakturaKnapp();
kobleFakturaKopiKnapp();
kobleKreditnotaVisning();
kobleKreditnotaKnapp();
koblePurringKnapp();
koblePurrAlleKnapp();
/* RIL FIX 7074: PDF-finjustering uten å bytte hand-pdf-layout.js, så skjermdesign ikke påvirkes. */
(function () {
  function trygg(verdi) {
    return String(verdi || "");
  }

  async function rilLitenLogoPdf(doc, firma) {
    try {
      if (typeof window.hentPdfLogo !== "function") return false;
      const logo = await window.hentPdfLogo(firma || {});
      if (!logo || !logo.data) return false;

      const bredde = 25;
      const ratio = logo.width && logo.height ? logo.width / logo.height : 3;
      const hoyde = bredde / ratio;
      doc.addImage(logo.data, logo.type || "JPEG", 14, 5, bredde, hoyde);
      return true;
    } catch (e) {
      console.warn("Kunne ikke tegne liten logo:", e);
      return false;
    }
  }

  window.tegnLogoPdf = rilLitenLogoPdf;

  window.tegnBrevfotPdf = function (doc, firma, sideNr, antallSider) {
    firma = firma || {};
    doc.setDrawColor(180);
    doc.line(14, 276, 195, 276);
    doc.setFontSize(8);

    const firmanavn = trygg(firma.navn || firma.firmanavn);
    const adresse = [firma.adresse, firma.postadresse].filter(Boolean).join(", ");
    const orgnr = trygg(firma.org_nr || firma.orgnr || firma.organisasjonsnummer);
    const mva = trygg(firma.mva_nr || firma.mvanr);
    const konto = trygg(firma.kontonr || firma.konto);

    const linje1 = [firmanavn, adresse].filter(Boolean).join(" | ");
    const linje2 = [
      orgnr ? "Org.nr: " + orgnr : "",
      mva ? "MVA: " + mva : "",
      konto ? "Konto: " + konto : ""
    ].filter(Boolean).join(" | ");

    doc.text(linje1, 14, 284);
    doc.text(linje2, 14, 289);

    if (sideNr != null && antallSider != null) {
      doc.text("Side " + sideNr + " av " + antallSider, 170, 289);
    }
  };

  window.tegnBrevfotAlleSiderPdf = function (doc, firma) {
    const antall = doc.getNumberOfPages();
    for (let i = 1; i <= antall; i++) {
      doc.setPage(i);
      window.tegnBrevfotPdf(doc, firma || {}, i, antall);
    }
  };
})();
