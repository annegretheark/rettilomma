console.log("lonn.js er lastet");
console.log("NY LONNJS LASTET 18 MAI");

let sisteLonnData = [];

function lonnMelding(tekst, erFeil = false) {
  const el = document.getElementById("lonnMelding");
  if (el) {
    el.textContent = tekst || "";
    el.style.color = erFeil ? "#b42318" : "#116329";
  }
}

function lonnTall(verdi) {
  if (verdi === null || verdi === undefined || verdi === "") return 0;
  const n = Number(String(verdi).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function lonnRund(n) {
  return Math.round((lonnTall(n) + Number.EPSILON) * 100) / 100;
}

function kroner(n) {
  return lonnRund(n).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function hentVerdiFraElement(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function dagensPeriode() {
  const now = new Date();
  const aar = now.getFullYear();
  const mnd = String(now.getMonth() + 1).padStart(2, "0");
  const sisteDag = new Date(aar, now.getMonth() + 1, 0).getDate();

  return {
    fra: `${aar}-${mnd}-01`,
    til: `${aar}-${mnd}-${String(sisteDag).padStart(2, "0")}`
  };
}


function fyllLonnAnsattValg(ansattListe) {
  const select = document.getElementById("lonnAnsattValg");
  if (!select) return;

  const valgt = select.value;
  const liste = ansattListe || window.ansatte || [];

  select.innerHTML = '<option value="">Alle ansatte</option>';

  liste.forEach(ansatt => {
    const option = document.createElement("option");
    option.value = ansatt.id;
    option.textContent = ansatt.navn || ansatt.epost || ("Ansatt " + ansatt.id);
    select.appendChild(option);
  });

  if (valgt && Array.from(select.options).some(o => String(o.value) === String(valgt))) {
    select.value = valgt;
  }
}

window.fyllLonnAnsattValg = fyllLonnAnsattValg;

function hentLonnPeriode() {
  const standard = dagensPeriode();

  return {
    fra:
      hentVerdiFraElement("lonnFraDato") ||
      hentVerdiFraElement("lonnDatoFra") ||
      standard.fra,
    til:
      hentVerdiFraElement("lonnTilDato") ||
      hentVerdiFraElement("lonnDatoTil") ||
      standard.til
  };
}

function datoInnenforPeriode(rad, fra, til) {
  const dato = String(rad.dato || "").slice(0, 10);
  if (!dato) return false;
  return dato >= fra && dato <= til;
}

function erUtbetalt(rad) {
  return (
    rad.lonn_utbetalt === true ||
    rad.utbetalt === true ||
    rad.utbetalt_lonn === true ||
    rad.lonn_kjort === true
  );
}

function hentAnsattNavn(ansatt, ansattId) {
  return ansatt?.navn || ansatt?.epost || ansattId || "Ukjent ansatt";
}

function hentTimelonn(ansatt, timerad) {
  return lonnTall(
    ansatt?.timelonn ||
    ansatt?.lonn ||
    timerad?.timelonn ||
    timerad?.timepris ||
    0
  );
}

function hentTimerAntall(rad) {
  return lonnTall(rad.timer || rad.antall_timer || rad.timer_antall || 0);
}

function hentOvertid50(rad) {
  return lonnTall(
    rad.overtid50 ||
    rad.overtid_50 ||
    rad.timer_50 ||
    rad.overtid_50_timer ||
    0
  );
}

function hentOvertid100(rad) {
  return lonnTall(
    rad.overtid100 ||
    rad.overtid_100 ||
    rad.timer_100 ||
    rad.overtid_100_timer ||
    0
  );
}

function beregnSkatt(brutto, ansatt) {
  const skattVerdi = lonnTall(
    ansatt?.skattetrekk ||
    ansatt?.skatteprosent ||
    ansatt?.skatt
  );

  if (skattVerdi <= 0) return 0;

  if (skattVerdi <= 100) {
    return lonnRund(brutto * skattVerdi / 100);
  }

  return lonnRund(skattVerdi);
}

function finnAndreUtlegg(t) {
  return (
    lonnTall(t.bompenger) +
    lonnTall(t.parkering) +
    lonnTall(t.billetter) +
    lonnTall(t.diett) +
    lonnTall(t.andre_utlegg) +
    lonnTall(t.andre_tillegg)
  );
}

function finnKmGodtgjorelse(t) {
  const km = lonnTall(t.km || t.sum_km);

  // Lønn/refusjon til ansatt: maks 3,50 skattefritt
  const sats = 3.5;

  const skattefri = km * sats;

  return {
    km: lonnRund(km),
    sats: sats,
    utbetalt: lonnRund(skattefri),
    skattefri: lonnRund(skattefri),
    skattepliktig: 0
  };
}
async function hentOgBeregnLonn() {
  const periode = hentLonnPeriode();

  const [timerRes, ansatteRes] = await Promise.all([
    supabaseClient.from("timer").select("*"),
    supabaseClient.from("ansatte").select("*")
  ]);

  if (timerRes.error) throw new Error(timerRes.error.message);
  if (ansatteRes.error) throw new Error(ansatteRes.error.message);

  const valgtAnsattId = hentVerdiFraElement("lonnAnsattValg");

  const timerader = (timerRes.data || [])
    .filter(t => datoInnenforPeriode(t, periode.fra, periode.til))
    .filter(t => !erUtbetalt(t))
    .filter(t => !valgtAnsattId || String(t.ansatt_id) === String(valgtAnsattId));

  const ansatte = ansatteRes.data || [];
  fyllLonnAnsattValg(ansatte);
  const ansatteMap = new Map(ansatte.map(a => [String(a.id), a]));
  const grupper = new Map();

  timerader.forEach(t => {
    const ansattId = String(t.ansatt_id || "");
    if (!ansattId) return;

    const ansatt = ansatteMap.get(ansattId) || {};

    if (!grupper.has(ansattId)) {
      grupper.set(ansattId, {
        ansatt,
        ansattId,
        ansattNavn: hentAnsattNavn(ansatt, ansattId),
        kontonr: ansatt.kontonr || "",
        periodeFra: periode.fra,
        periodeTil: periode.til,
        timer: 0,
        ordinareTimer: 0,
        overtid50Timer: 0,
        overtid100Timer: 0,
        ordinarlonn: 0,
        overtid50Lonn: 0,
        overtid100Lonn: 0,
        brutto: 0,
        utlegg: 0,
        kmSkattefri: 0,
        kmSkattepliktig: 0,
        diett: 0,
        parkering: 0,
        billetter: 0,
        bompenger: 0,
        andreUtlegg: 0,
        skatt: 0,
        ekstraSkatt: lonnTall(ansatt.ekstra_skatt),
        andreTrekk: lonnTall(ansatt.andre_trekk),
        netto: 0,
        timerIds: []
      });
    }

    const g = grupper.get(ansattId);

    const totalTimer = hentTimerAntall(t);
    const overtid50 = hentOvertid50(t);
    const overtid100 = hentOvertid100(t);
    const ordinare = Math.max(0, totalTimer - overtid50 - overtid100);

    const timelonn = hentTimelonn(ansatt, t);
    const km = finnKmGodtgjorelse(t);
    const andreUtlegg = finnAndreUtlegg(t);

    g.timer += totalTimer;
    g.ordinareTimer += ordinare;
    g.overtid50Timer += overtid50;
    g.overtid100Timer += overtid100;

    g.ordinarlonn += ordinare * timelonn;
    g.overtid50Lonn += overtid50 * timelonn * 1.5;
    g.overtid100Lonn += overtid100 * timelonn * 2;

    g.brutto += ordinare * timelonn;
    g.brutto += overtid50 * timelonn * 1.5;
    g.brutto += overtid100 * timelonn * 2;
    g.brutto += km.skattepliktig;

    g.utlegg += andreUtlegg;
    g.utlegg += km.skattefri;
    g.bompenger += lonnTall(t.bompenger);
    g.parkering += lonnTall(t.parkering);
    g.billetter += lonnTall(t.billetter);
    g.diett += lonnTall(t.diett);

    g.andreUtlegg +=
  lonnTall(t.andre_utlegg) +
  lonnTall(t.andre_tillegg);

    g.kmSkattefri += km.skattefri;
    g.kmSkattepliktig += km.skattepliktig;

    if (t.id) g.timerIds.push(t.id);
  });

  const resultat = Array.from(grupper.values())
    .filter(g =>
      lonnTall(g.timer) > 0 ||
      lonnTall(g.brutto) > 0 ||
      lonnTall(g.utlegg) > 0
    )
    .map(g => {
      g.timer = lonnRund(g.timer);
      g.ordinareTimer = lonnRund(g.ordinareTimer);
      g.overtid50Timer = lonnRund(g.overtid50Timer);
      g.overtid100Timer = lonnRund(g.overtid100Timer);

      g.ordinarlonn = lonnRund(g.ordinarlonn);
      g.overtid50Lonn = lonnRund(g.overtid50Lonn);
      g.overtid100Lonn = lonnRund(g.overtid100Lonn);

      g.brutto = lonnRund(g.brutto);
      g.utlegg = lonnRund(g.utlegg);
      g.kmSkattefri = lonnRund(g.kmSkattefri);
      g.kmSkattepliktig = lonnRund(g.kmSkattepliktig);

      g.skatt = beregnSkatt(g.brutto, g.ansatt);

      g.netto = lonnRund(
        g.brutto -
        g.skatt -
        g.ekstraSkatt -
        g.andreTrekk +
        g.utlegg
      );

      return g;
    });

  sisteLonnData = resultat;
  return resultat;
}

async function kjorLonn() {
  try {
    sisteLonnData = [];
    lonnMelding("Beregner lønn...");

    const data = await hentOgBeregnLonn();

    if (!data.length) {
      lonnMelding("Ingen ikke-utbetalte timer eller utlegg funnet i perioden.", true);
      return;
    }

    lonnMelding("Lønn beregnet for " + data.length + " ansatt(e).");
  } catch (e) {
    console.error(e);
    lonnMelding(e.message, true);
  }
}

function pdfLinje(doc, tekst, belop, y, minus = false) {
  doc.text(tekst, 20, y);
  doc.text((minus ? "- " : "") + kroner(belop) + " kr", 130, y);
}

async function lagLonnsslipper(kopi = false) {
  try {
    const data = sisteLonnData.length
      ? sisteLonnData
      : await hentOgBeregnLonn();

    const dataMedLonn = data.filter(r =>
      lonnTall(r.timer) > 0 ||
      lonnTall(r.brutto) > 0 ||
      lonnTall(r.utlegg) > 0 ||
      lonnTall(r.netto) > 0
    );

    if (!dataMedLonn.length) {
      alert("Ingen lønnsslipper å lage.");
      lonnMelding("Ingen lønnsslipper å lage.", true);
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF bibliotek mangler");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const firma =
      typeof hentFirmaData === "function"
        ? await hentFirmaData()
        : {};

    for (let index = 0; index < dataMedLonn.length; index++) {
      const r = dataMedLonn[index];

      if (index > 0) doc.addPage();

      let y = 70;

      if (typeof tegnBrevhodePdf === "function") {
        await tegnBrevhodePdf(doc, firma);
      }

      doc.setFontSize(16);
      doc.text(kopi ? "LØNNSAVREGNING - KOPI" : "LØNNSAVREGNING", 20, y);

      y += 12;
      doc.setFontSize(10);

      doc.text("Periode: " + r.periodeFra + " - " + r.periodeTil, 20, y);
      y += 8;

      doc.text("Navn: " + r.ansattNavn, 20, y);
      y += 8;

      doc.text("Utbetales til konto: " + (r.kontonr || "Mangler kontonr"), 20, y);
      y += 12;

      if (r.ordinareTimer > 0) {
        doc.text("Ordinære timer: " + r.ordinareTimer, 20, y);
        doc.text(kroner(r.ordinarlonn) + " kr", 130, y);
        y += 9;
      }

      if (r.overtid50Timer > 0) {
        doc.text("Overtid 50%: " + r.overtid50Timer, 20, y);
        doc.text(kroner(r.overtid50Lonn) + " kr", 130, y);
        y += 9;
      }

      if (r.overtid100Timer > 0) {
        doc.text("Overtid 100%: " + r.overtid100Timer, 20, y);
        doc.text(kroner(r.overtid100Lonn) + " kr", 130, y);
        y += 9;
      }

      
      y += 3;
      pdfLinje(doc, "Brutto lønn", r.brutto, y);
y += 9;

const feriegrunnlag =
  lonnTall(r.ansatt?.feriepengegrunnlag) + lonnTall(r.brutto);
pdfLinje(
  doc,
  "Feriepengegrunnlag hittil i år",
  feriegrunnlag,
  y
);

y += 9;
      y += 9;

      pdfLinje(doc, "Forskuddstrekk", r.skatt, y, true);
      y += 9;

      if (r.ekstraSkatt > 0) {
        pdfLinje(doc, "Ekstra skatt", r.ekstraSkatt, y, true);
        y += 9;
      }

      if (r.andreTrekk > 0) {
        pdfLinje(doc, "Andre trekk", r.andreTrekk, y, true);
        y += 9;
      }

  
if (
  r.utlegg > 0 ||
  r.kmSkattefri > 0
) {

  y += 3;

  doc.setFont(undefined, "bold");
  doc.text("Skattefrie utlegg/refusjoner", 20, y);

  y += 9;

  doc.setFont(undefined, "normal");

  if (r.kmSkattefri > 0) {
    pdfLinje(doc, "Km-godtgjørelse", r.kmSkattefri, y);
    y += 9;
  }

  if (r.bompenger > 0) {
    pdfLinje(doc, "Bompenger", r.bompenger, y);
    y += 9;
  }

  if (r.parkering > 0) {
    pdfLinje(doc, "Parkering", r.parkering, y);
    y += 9;
  }

  if (r.billetter > 0) {
    pdfLinje(doc, "Billetter/Ferge", r.billetter, y);
    y += 9;
  }

  if (r.diett > 0) {
    pdfLinje(doc, "Diett", r.diett, y);
    y += 9;
  }

  if (r.andreUtlegg > 0) {
    pdfLinje(doc, "Andre utlegg", r.andreUtlegg, y);
    y += 9;
  }

  doc.setFont(undefined, "bold");
  pdfLinje(doc, "Sum skattefrie refusjoner", r.utlegg, y);

  y += 10;

  doc.setFont(undefined, "normal");
}
      y += 5;

      if (typeof tegnSkilleLinjePdf === "function") {
        tegnSkilleLinjePdf(doc, y, 20, 190);
      } else {
        doc.line(20, y, 190, y);
      }

      y += 10;
      doc.setFontSize(12);
      pdfLinje(doc, "Netto utbetalt", r.netto, y);
    }

    if (typeof tegnBrevfotAlleSiderPdf === "function") {
      tegnBrevfotAlleSiderPdf(doc, firma);
    }

    doc.save(kopi ? "lonnsslipper_kopi.pdf" : "lonnsslipper.pdf");

    lonnMelding("Lønnsslipper laget.");
  } catch (e) {
    console.error(e);
    lonnMelding(e.message, true);
  }
}

async function markerLonnSomUtbetalt() {
  try {
    const data = sisteLonnData.length
      ? sisteLonnData
      : await hentOgBeregnLonn();

    const ids = data.flatMap(r => r.timerIds || []);

    if (!ids.length) {
      alert("Ingen timer å markere som utbetalt.");
      return;
    }

    const oppdatering = {
      lonn_utbetalt: true,
      lonn_utbetalt_dato: new Date().toISOString()
    };

    const res = await supabaseClient
      .from("timer")
      .update(oppdatering)
      .in("id", ids);
      for (const r of data) {

  const eksisterende =
    lonnTall(r.ansatt?.feriepengegrunnlag);

  const nyttGrunnlag =
    eksisterende + r.brutto;

  await supabaseClient
    .from("ansatte")
    .update({
      feriepengegrunnlag: nyttGrunnlag
    })
    .eq("id", r.ansattId);
}

    if (res.error) {
      alert("Kunne ikke markere som utbetalt. Mangler kanskje kolonner i timer-tabellen.");
      console.error(res.error);
      return;
    }

    sisteLonnData = [];
    lonnMelding("Timer markert som utbetalt.");
  } catch (e) {
    console.error(e);
    lonnMelding(e.message, true);
  }
}

function lagRegneark(filnavn, arkNavn, rader) {
  if (!window.XLSX) return;

  const ws = XLSX.utils.json_to_sheet(rader);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, arkNavn);
  XLSX.writeFile(wb, filnavn);
}

async function eksporterTrekkExcel() {
  const data = sisteLonnData.length
    ? sisteLonnData
    : await hentOgBeregnLonn();

  const rader = data.map(r => ({
    ansatt: r.ansattNavn,
    periode_fra: r.periodeFra,
    periode_til: r.periodeTil,
    brutto: r.brutto,
    forskuddstrekk: r.skatt,
    ekstra_skatt: r.ekstraSkatt,
    andre_trekk: r.andreTrekk
  }));

  lagRegneark("trekk.xlsx", "Trekk", rader);
}

async function eksporterUtbetalingerExcel() {
  const data = sisteLonnData.length
    ? sisteLonnData
    : await hentOgBeregnLonn();

  const rader = data.map(r => ({
    ansatt: r.ansattNavn,
    kontonr: r.kontonr,
    periode_fra: r.periodeFra,
    periode_til: r.periodeTil,
    brutto: r.brutto,
    utlegg: r.utlegg,
    netto_utbetalt: r.netto
  }));

  lagRegneark("utbetalinger.xlsx", "Utbetalinger", rader);
}

function lagLonnsslipperKopi() {
  return lagLonnsslipper(true);
}

window.kjorLonn = kjorLonn;
window.lagLonnsslipper = lagLonnsslipper;
window.eksporterTrekkExcel = eksporterTrekkExcel;
window.eksporterUtbetalingerExcel = eksporterUtbetalingerExcel;
window.hentOgBeregnLonn = hentOgBeregnLonn;
window.lagLonnsslipperKopi = lagLonnsslipperKopi;
window.markerLonnSomUtbetalt = markerLonnSomUtbetalt;