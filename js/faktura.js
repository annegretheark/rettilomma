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
    .from("varer")
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

    linjer.push({
      dato: t.dato || "",
      beskrivelse: String(
        (prosjektTekst ? prosjektTekst + " - " : "") +
        (t.beskrivelse || t.kommentar || "Timer")
      ).slice(0, 40),
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
    .from("faktura_varer")
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
    .from("faktura_utlegg")
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
    .from("faktura_varer")
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
  const direkteUtleggLinjer = (direkteUtlegg || []).map(u => ({
  dato: String(u.created_at || "").slice(0, 10),
  beskrivelse: "Utlegg: " + (u.beskrivelse || u.type || ""),
  antall: 1,
  sumEksMva: Number(u.belop || 0),
  mva: 0
}));

 const fakturaLinjer =
  timeLinjer.concat(direkteVareLinjer, direkteUtleggLinjer);

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
  doc.text("Beskrivelse", 45, y);
  doc.text("Antall", 120, y);
  doc.text("Eks mva", 145, y);
  doc.text("MVA", 170, y);

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
      doc.text("Beskrivelse", 45, y);
      doc.text("Antall", 120, y);
      doc.text("Eks mva", 145, y);
      doc.text("MVA", 170, y);

      y += 4;

      if (typeof tegnSkilleLinjePdf === "function") {
        tegnSkilleLinjePdf(doc, y);
      } else {
        doc.line(14, y, 195, y);
      }

      y += 7;
    }

    doc.text(String(linje.dato || ""), 14, y);
    doc.text(String(linje.beskrivelse || "").slice(0, 40), 45, y);
    doc.text(String(linje.antall || 0), 120, y);
    doc.text(formatBelop(linje.sumEksMva), 145, y);
    doc.text(formatBelop(linje.mva), 170, y);

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
    .from("fakturaer")
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
      await sperrFakturerteTimer(
        fakturaTimer,
        fakturanr
      );
    }

    if (direkteVarer.length) {
      await sperrDirekteFakturaVarer(
        direkteVarer,
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
  const direkteUtlegg = await hentDirekteFakturaUtlegg(valgtKunde);

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

    for (const key of alleNokler) {
      const gruppeTimer =
        (timerGrupper.find(g => g.key === key) || {}).timer || [];

      const gruppeVarer = vareGrupper[key] || [];

      const kunde =
        valgtKunde ||
        (gruppeTimer.length ? finnKundeForTime(gruppeTimer[0]) : null) ||
        (gruppeVarer.length ? finnKundeForDirekteVare(gruppeVarer[0]) : null) ||
        null;

      await lagEnFakturaPdf(
  kunde,
  gruppeTimer,
  maaned,
  firma,
  false,
  null,
  gruppeVarer,
  direkteUtlegg
);
  }
    if (melding) {
      melding.textContent =
        "Faktura PDF laget for valgt kunde. Timer, varelinjer og utlegg er sperret mot ny fakturering.";
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
  const select =
    document.getElementById("kreditnotaFakturaValg");

  if (!select || !select.value) {
    alert("Velg faktura først.");
    return;
  }

  const fakturanr = select.value;

  const kreditTimer =
    (window.timer || []).filter(t =>
      String(t.fakturanr || t.faktura_nr || "") === fakturanr
    );

  if (!kreditTimer.length) {
    alert("Fant ingen timer.");
    return;
  }

  const jspdfObj = window.jspdf;

  if (!jspdfObj || !jspdfObj.jsPDF) {
    alert("PDF-biblioteket er ikke lastet.");
    return;
  }

  const firma = await hentFirmaData();
  const doc = new jspdfObj.jsPDF();

  const vareMap = await hentVareMapForTimer(kreditTimer);
  const kreditLinjer = byggFakturaLinjer(kreditTimer, vareMap);
  const summer = summerFakturaLinjer(kreditLinjer);

  if (typeof tegnBrevhodePdf === "function") {
    await tegnBrevhodePdf(doc, firma);
  } else if (typeof leggTilLogo === "function") {
    await leggTilLogo(doc);
  }

  const kunde = finnKundeForTime(kreditTimer[0]) || null;
  const kreditnotaNr = "KREDIT-" + fakturanr;

  let y = 70;

  doc.setFontSize(20);
  doc.text("KREDITNOTA", 14, y);

  doc.setFontSize(10);
  doc.text("Kreditnota nr", 140, y);
  doc.text(kreditnotaNr, 175, y);

  y += 6;
  doc.text("Krediterer faktura", 140, y);
  doc.text(String(fakturanr || ""), 175, y);

  y += 6;
  doc.text("Dato", 140, y);
  doc.text(formatDatoISO(new Date()), 175, y);

  y = 95;

  doc.setFontSize(11);
  doc.text("Kunde", 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.text(hentKundeNavn(kunde, kreditTimer[0]), 14, y);
  y += 6;

  const kundeAdresse = kunde?.adresse || kreditTimer[0]?.kunde_adresse || "";
  const kundePostadresse = kunde?.postadresse || kreditTimer[0]?.kunde_postadresse || "";

  if (kundeAdresse) {
    doc.text(kundeAdresse, 14, y);
    y += 6;
  }

  if (kundePostadresse) {
    doc.text(kundePostadresse, 14, y);
    y += 6;
  }

  y += 10;

  doc.setFontSize(10);
  doc.text("Beskrivelse", 14, y);
  doc.text("Beløp eks. mva", 145, y);

  if (typeof tegnSkilleLinjePdf === "function") {
    tegnSkilleLinjePdf(doc, y + 2);
  } else {
    doc.line(14, y + 2, 195, y + 2);
  }

  y += 10;

  doc.text("Kreditering av faktura " + String(fakturanr || ""), 14, y);
  doc.text("-" + formatBelop(summer.sumEksMva) + " kr", 145, y);

  y += 20;

  doc.setFontSize(11);
  doc.text("Sum eks. mva", 120, y);
  doc.text("-" + formatBelop(summer.sumEksMva) + " kr", 165, y);

  y += 7;
  doc.text("MVA", 120, y);
  doc.text("-" + formatBelop(summer.mva) + " kr", 165, y);

  y += 7;
  doc.setFontSize(12);
  doc.text("Sum inkl. mva", 120, y);
  doc.text("-" + formatBelop(summer.sumInkMva) + " kr", 165, y);

  if (typeof tegnBrevfotAlleSiderPdf === "function") {
    tegnBrevfotAlleSiderPdf(doc, firma);
  }

  doc.save("kreditnota_" + tryggFilnavn(fakturanr) + ".pdf");

  const kreditOmrade = document.getElementById("kreditnotaOmrade");
  if (kreditOmrade) kreditOmrade.style.display = "none";

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
async function skrivUtPurringerPdf() {
  const { data, error } = await supabaseClient
    .from("fakturaer")
    .select("*")
    .eq("status", "Purret")
    .gte("siste_purring_dato", new Date().toISOString().slice(0, 10));

  if (error) {
    alert("Feil ved henting av purringer: " + error.message);
    return;
  }

  if (!data || !data.length) {
    alert("Ingen purringer å skrive ut i dag.");
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
    doc.text(String(f.fakturanr || ""), 175, hoyreY);

    hoyreY += 6;
    doc.text("Dato", 140, hoyreY);
    doc.text(formatDatoISO(new Date()), 175, hoyreY);

    hoyreY += 6;
    doc.text("Oppr. forfall", 140, hoyreY);
    doc.text(String(f.forfallsdato || "").slice(0, 10), 175, hoyreY);

    hoyreY += 6;
    doc.text("Ny frist", 140, hoyreY);
    doc.text(formatDatoISO(leggTilDager(new Date(), 14)), 175, hoyreY);

    y += 35;

    doc.setFontSize(11);
    doc.text("Vi kan ikke se å ha mottatt betaling for faktura:", 14, y);

    y += 10;
    doc.setFontSize(12);
    doc.text("Fakturanr: " + String(f.fakturanr || ""), 14, y);

    y += 8;
    doc.text("Beløp inkl. mva: " + formatBelop(f.inkl_mva) + " kr", 14, y);

    y += 8;
    doc.text("Purring nr: " + String(f.purret_antall || 1), 14, y);

    y += 14;
    doc.setFontSize(10);
    doc.text("Vennligst betal innen ny betalingsfrist.", 14, y);

    if (typeof tegnBrevfotAlleSiderPdf === "function") {
      tegnBrevfotAlleSiderPdf(doc, firma);
    }
  }

  doc.save("purringer_" + new Date().toISOString().slice(0, 10) + ".pdf");
}

async function kjorPurring() {
  const { error } = await supabaseClient.rpc("kjor_purring");

  if (error) {
    console.error("Purring FEIL:", error);
    alert("Purring feilet: " + error.message);
    return;
  }

  await skrivUtPurringerPdf();
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

kobleFakturaKnapp();
kobleFakturaKopiKnapp();
kobleKreditnotaVisning();
kobleKreditnotaKnapp();
koblePurringKnapp();