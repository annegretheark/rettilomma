console.log("NY timer.js er lastet");

const MAKS_TIMER_PER_DAG = 24;
const MAKS_TIMER_PER_MANED = 300;


function hentAktivBilIdFraSkjerm() {
  const bilValg = document.getElementById("bilValg");

  // Hvis aktiv bil ikke er satt ennå, men dropdownen har en valgt bil, bruk den.
  if ((!window.aktivBilId || window.aktivBilId === "") && bilValg && bilValg.value) {
    const valgtOption = bilValg.options[bilValg.selectedIndex];
    window.aktivBilId = bilValg.value;
    window.aktivBilNavn = valgtOption ? valgtOption.textContent : "";
    localStorage.setItem("aktivBilId", window.aktivBilId);
    localStorage.setItem("aktivBilNavn", window.aktivBilNavn || "");
  }

  return window.aktivBilId || bilValg?.value || "";
}

function oppdaterAktivBilVisning() {
  const bilValg = document.getElementById("bilValg");
  const info = document.getElementById("aktivBilInfo");

  if (bilValg && window.aktivBilId) {
    bilValg.value = String(window.aktivBilId);
  }

  if (bilValg && bilValg.value && !window.aktivBilNavn) {
    const valgtOption = bilValg.options[bilValg.selectedIndex];
    window.aktivBilNavn = valgtOption ? valgtOption.textContent : "";
  }

  const tekst = window.aktivBilNavn
    ? "Aktiv bil: " + window.aktivBilNavn
    : "Ingen aktiv bil valgt.";

  if (info) info.textContent = tekst;
}


async function fyllVarevalgFraAktivBil() {
  const vareValg = document.getElementById("vareValg");
  const prisFelt = document.getElementById("varePris");
  const aktivBilId = hentAktivBilIdFraSkjerm();

  if (!vareValg) return;
  vareValg.innerHTML = '<option value="">Velg vare fra bil</option>';

  if (!aktivBilId) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Velg aktiv bil først";
    vareValg.appendChild(opt);
    return;
  }

  const { data, error } = await supabaseClient
    .from("bil_varer")
    .select("id, antall, varer(id, varenr, navn, pris, utpris, mva_sats)")
    .eq("bil_id", aktivBilId)
    .gt("antall", 0)
    .order("id", { ascending: true });

  if (error) {
    console.error("Feil ved henting av varer fra bil:", error);
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Feil ved henting av bil-lager";
    vareValg.appendChild(opt);
    return;
  }

  if (!data || !data.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Ingen varer på valgt bil";
    vareValg.appendChild(opt);
    return;
  }

  data.forEach(rad => {
    const v = rad.varer || {};
    const pris = Number(v.pris ?? v.utpris ?? 0);
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.dataset.pris = String(pris);
    opt.dataset.antallBil = String(rad.antall || 0);
    opt.dataset.kilde = "bil";
    opt.dataset.bilVareId = String(rad.id || "");
    opt.textContent = `${v.varenr || ""} ${v.navn || ""} - i bil: ${rad.antall} - ${pris.toFixed(2)} kr`;
    vareValg.appendChild(opt);
  });

  vareValg.onchange = function () {
    const valgtOption = vareValg.options[vareValg.selectedIndex];
    const pris = valgtOption ? valgtOption.dataset.pris : "";
    if (prisFelt && pris !== undefined && pris !== "") prisFelt.value = pris;
  };
}

function heltallFraFelt(id, standardVerdi = 0) {
  const felt = document.getElementById(id);
  const tekst = String(felt?.value ?? standardVerdi).replace(",", ".").trim();
  const tall = Number(tekst);
  return Number.isInteger(tall) ? tall : NaN;
}

async function byttAktivBil() {
  const bilValg = document.getElementById("bilValg");
  if (!bilValg) return;

  if (!bilValg.value) {
    alert("Velg bil først.");
    return;
  }

  const valgtOption = bilValg.options[bilValg.selectedIndex];
  const bilNavn = valgtOption ? valgtOption.textContent : "";

  if (typeof window.settAktivBil === "function") {
    window.settAktivBil(bilValg.value, bilNavn);
  } else {
    window.aktivBilId = bilValg.value;
    window.aktivBilNavn = bilNavn;
    localStorage.setItem("aktivBilId", window.aktivBilId);
    localStorage.setItem("aktivBilNavn", window.aktivBilNavn || "");
    oppdaterAktivBilVisning();
  }

  await fyllVarevalgFraAktivBil();

  if (window.innloggetAnsattId && confirm("Skal denne bilen lagres som standard bil for brukeren?")) {
    const { error } = await supabaseClient
      .from("ansatte")
      .update({ standard_bil_id: bilValg.value })
      .eq("id", window.innloggetAnsattId);

    if (error) alert("Kunne ikke lagre standard bil: " + error.message);
  }
}

function hentTimerMelding() {
  return document.getElementById("timerMelding") || document.getElementById("skjemaMelding");
}

function tallFraFelt(id) {
  const felt = document.getElementById(id);
  if (!felt) return 0;
  const verdi = String(felt.value || "").replace(",", ".").trim();
  return verdi === "" ? 0 : Number(verdi);
}

function tekstFraFelt(id) {
  const felt = document.getElementById(id);
  return felt ? String(felt.value || "").trim() : "";
}

function settFeltHvisFinnes(id, verdi) {
  const felt = document.getElementById(id);
  if (felt) felt.value = verdi;
}

function settDagensDato() {
  const dato = document.getElementById("dato");
  if (dato && !dato.value) {
    dato.value = new Date().toISOString().split("T")[0];
  }
}

function hentManedStart(dato) {
  return dato.substring(0, 7) + "-01";
}

function hentNesteManedStart(dato) {
  const deler = dato.split("-");
  const aar = Number(deler[0]);
  const maned = Number(deler[1]);

  let nesteAar = aar;
  let nesteManed = maned + 1;

  if (nesteManed > 12) {
    nesteManed = 1;
    nesteAar++;
  }

  return `${nesteAar}-${String(nesteManed).padStart(2, "0")}-01`;
}

function tallFraVerdi(verdi) {
  if (verdi === null || verdi === undefined || verdi === "") return 0;
  const tall = Number(String(verdi).replace(",", "."));
  return Number.isFinite(tall) ? tall : 0;
}

function adminVilOverstyre(tekst) {
  if (!erAdmin) return false;

  return confirm(
    tekst +
    "\n\nDu er admin. Vil du overstyre og lagre likevel?"
  );
}

async function lastTimer() {
  let query = supabaseClient
    .from("timer")
    .select("*")
    .order("dato", { ascending: false });

  if (!erAdmin && window.innloggetAnsattId) {
    query = query.eq("ansatt_id", window.innloggetAnsattId);
  }

  const { data, error } = await query;

  if (error) {
    const melding = hentTimerMelding();
    if (melding) melding.textContent = "Feil ved henting av timer: " + error.message;
    console.error("Feil ved henting av timer:", error);
    return;
  }

  window.timer = data || [];
  tegnTimer();
}

async function sjekkTimerGrenser(ansattId, dato, nyeTimer) {
  const melding = hentTimerMelding();

  const { data: dagTimer, error: dagFeil } = await supabaseClient
    .from("timer")
    .select("timer")
    .eq("ansatt_id", ansattId)
    .eq("dato", dato);

  if (dagFeil) {
    if (melding) melding.textContent = "Feil ved sjekk av dagstimer: " + dagFeil.message;
    return false;
  }

  const sumDag =
    (dagTimer || []).reduce((sum, rad) => sum + tallFraVerdi(rad.timer), 0) +
    nyeTimer;

  if (sumDag > MAKS_TIMER_PER_DAG) {
    const tekst =
      `Det blir ${round(sumDag)} timer denne dagen. Maks er ${MAKS_TIMER_PER_DAG} timer.`;

    if (!adminVilOverstyre(tekst)) {
      if (melding) melding.textContent = tekst;
      return false;
    }
  }

  const manedStart = hentManedStart(dato);
  const nesteManedStart = hentNesteManedStart(dato);

  const { data: manedTimer, error: manedFeil } = await supabaseClient
    .from("timer")
    .select("timer")
    .eq("ansatt_id", ansattId)
    .gte("dato", manedStart)
    .lt("dato", nesteManedStart);

  if (manedFeil) {
    if (melding) melding.textContent = "Feil ved sjekk av månedstimer: " + manedFeil.message;
    return false;
  }

  const sumManed =
    (manedTimer || []).reduce((sum, rad) => sum + tallFraVerdi(rad.timer), 0) +
    nyeTimer;

  if (sumManed > MAKS_TIMER_PER_MANED) {
    const tekst =
      `Det blir ${round(sumManed)} timer denne måneden. Maks er ${MAKS_TIMER_PER_MANED} timer.`;

    if (!adminVilOverstyre(tekst)) {
      if (melding) melding.textContent = tekst;
      return false;
    }
  }

  return true;
}

async function lagreTimer() {
  const ansattId = window.innloggetAnsattId || "";
  const melding = hentTimerMelding();

  if (melding) melding.textContent = "";

  const kundeValg = document.getElementById("kundeValg");

  if (!kundeValg) {
    if (melding) melding.textContent = "Fant ikke kundevalg i skjemaet.";
    return;
  }

  const valgtKunde = typeof finnKundeFraValg === "function"
    ? finnKundeFraValg(kundeValg.value)
    : (window.kunder || []).find(k => String(k.id || "") === String(kundeValg.value));

  const valgtKundeNr = typeof hentKundeNr === "function"
    ? hentKundeNr(valgtKunde)
    : (valgtKunde?.kundenr || valgtKunde?.kunde_nr || "");

  const valgtKundeId = valgtKunde?.id || null;
  const valgtProsjektId = tekstFraFelt("prosjektValg") || null;

  const utgiftType = tekstFraFelt("utgiftType");
  const utgiftBelop = tallFraFelt("utgiftBelop");

  const diett = utgiftType === "diett" ? utgiftBelop : tallFraFelt("diett");
  const parkering = utgiftType === "parkering" ? utgiftBelop : tallFraFelt("parkering");
  const billetter = utgiftType === "billetter" ? utgiftBelop : tallFraFelt("billetter");
  const bompenger = utgiftType === "bompenger" ? utgiftBelop : tallFraFelt("bompenger");
  const ferge = utgiftType === "ferge" ? utgiftBelop : 0;
  const annetUtleggFraNedtrekk = utgiftType === "annet" ? utgiftBelop : 0;

  const andreUtlegg = tallFraFelt("andreUtlegg") + annetUtleggFraNedtrekk + ferge;
  const sumUtlegg = diett + parkering + billetter + bompenger + andreUtlegg;

  const registrering = {
    dato: tekstFraFelt("dato"),
    kundeId: valgtKundeId,
    kundeNr: valgtKundeNr,
    kundeNavn: valgtKunde ? valgtKunde.navn || "" : "",
    prosjektId: valgtProsjektId,
    start: tekstFraFelt("startTid"),
    slutt: tekstFraFelt("sluttTid"),
    timepris: tallFraFelt("timepris"),
    km: tallFraFelt("km"),
    kmPris: tallFraFelt("kmPris"),
    diett,
    parkering,
    billetter,
    bompenger,
    andreUtlegg,
    sumUtlegg,
    andreUtleggBeskrivelse:
      tekstFraFelt("andreUtleggBeskrivelse") ||
      (utgiftType ? `Utgiftstype: ${utgiftType}` : ""),
    fakturerbar: tekstFraFelt("fakturerbar") !== "nei",
    beskrivelse: tekstFraFelt("beskrivelse")
  };

  if (!registrering.dato || !registrering.kundeId || !registrering.start || !registrering.slutt) {
    if (melding) melding.textContent = "Fyll inn dato, kunde, start og slutt.";
    return;
  }

  if (!ansattId) {
    if (melding) melding.textContent = "Fant ikke innlogget ansatt.";
    return;
  }

  const beregning = beregnTimer(
    registrering.start,
    registrering.slutt,
    registrering.timepris
  );

  registrering.timer = beregning.timer;
  registrering.overtid50 = beregning.overtid50;
  registrering.overtid100 = beregning.overtid100;
  registrering.sumTimer = beregning.sumTimer;
  registrering.sumKm = registrering.km * registrering.kmPris;

  if (registrering.timer <= 0) {
    if (melding) melding.textContent = "Timer må være større enn 0.";
    return;
  }

  if (registrering.timer > MAKS_TIMER_PER_DAG) {
    const tekst =
      `Denne registreringen er på ${registrering.timer} timer. Maks er ${MAKS_TIMER_PER_DAG} timer per registrering/dag.`;

    if (!adminVilOverstyre(tekst)) {
      if (melding) melding.textContent = tekst;
      return;
    }
  }

  const grenserOk = await sjekkTimerGrenser(
    ansattId,
    registrering.dato,
    registrering.timer
  );

  if (!grenserOk) return;

  registrering.sum = registrering.fakturerbar
    ? registrering.sumTimer + registrering.sumKm + registrering.sumUtlegg
    : 0;

  const supabaseTimer = {
    ansatt_id: ansattId,
    dato: registrering.dato,
    kunde_id: registrering.kundeId,
    kunde_nr: registrering.kundeNr,
    kunde_navn: registrering.kundeNavn,
    prosjekt_id: registrering.prosjektId,
    /*re_id: null,
    vare_antall: null,*/
    start: registrering.start,
    slutt: registrering.slutt,
    timer: registrering.timer,
    overtid50: registrering.overtid50,
    overtid100: registrering.overtid100,
    timepris: registrering.timepris,
    km: registrering.km,
    km_pris: registrering.kmPris,
    sum_timer: registrering.sumTimer,
    sum_km: registrering.sumKm,
    diett: registrering.diett,
    parkering: registrering.parkering,
    billetter: registrering.billetter,
    bompenger: registrering.bompenger,
    andre_utlegg: registrering.andreUtlegg,
    andre_utlegg_beskrivelse: registrering.andreUtleggBeskrivelse,
    sum: registrering.sum,
    fakturerbar: registrering.fakturerbar,
    beskrivelse: registrering.beskrivelse
  };

  const { data: finnesFraFor, error: sjekkFeil } = await supabaseClient
    .from("timer")
    .select("id")
    .eq("ansatt_id", ansattId)
    .eq("kunde_id", registrering.kundeId)
    .eq("dato", registrering.dato)
    .eq("start", registrering.start)
    .limit(1);

  if (sjekkFeil) {
    console.error("Feil ved sjekk av dobbeltregistrering:", sjekkFeil);

    if (melding) {
      melding.textContent =
        "Feil ved sjekk av dobbeltregistrering: " + sjekkFeil.message;
    }

    return;
  }

  if (finnesFraFor && finnesFraFor.length > 0) {
    const tekst =
      "Denne timen er allerede registrert for samme ansatt, kunde, dato og starttid.";

    if (!adminVilOverstyre(tekst)) {
      if (melding) melding.textContent = tekst;
      return;
    }
  }
const { data, error } = await supabaseClient
  .from("timer")
  .insert([supabaseTimer])
  .select()
  .single();
  if (error) {
    console.error("Feil ved lagring av timer:", error);
    if (melding) melding.textContent = "Feil ved lagring av timer: " + error.message;
    return;
  }
if (data?.id) {
  await lastOppTimerBilde(data.id);
}
  await lastTimer();
  nullstillSkjema();

  if (melding) melding.textContent = "Timer er lagret.";
}

function beregnTimer(start, slutt, pris) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = slutt.split(":").map(Number);

  let startMin = sh * 60 + sm;
  let sluttMin = eh * 60 + em;

  if (sluttMin <= startMin) {
    sluttMin += 24 * 60;
  }

  const timerTotalt = (sluttMin - startMin) / 60;
  const sumTimer = timerTotalt * pris;

  return {
    timer: round(timerTotalt),
    overtid50: 0,
    overtid100: 0,
    sumTimer: round(sumTimer)
  };
}

function kundeInfoForTimer(t) {
  const kunde = (window.kunder || []).find(k =>
    String(k.id || "") === String(t.kunde_id || "")
  );

  const kundeNr =
    t.kunde_nr ||
    t.kundeNr ||
    (kunde ? hentKundeNr(kunde) : "");

  const kundeNavn =
    t.kunde_navn ||
    t.kundeNavn ||
    (kunde ? kunde.navn || "" : "");

  return { kundeNr, kundeNavn };
}

function tegnTimer() {
  const timerTabell = document.getElementById("timerTabell");
  if (!timerTabell) return;

  const timerData = window.timer || [];

  timerTabell.innerHTML = "";

  if (!timerData.length) {
    timerTabell.innerHTML = `<tr><td colspan="10">Ingen timer registrert.</td></tr>`;
    return;
  }

  timerData.forEach(t => {
    const tr = document.createElement("tr");
    const kundeInfo = kundeInfoForTimer(t);

    tr.innerHTML = `
      <td>${t.dato || ""}</td>
      <td>${kundeInfo.kundeNr || ""}<br>${kundeInfo.kundeNavn || ""}</td>
      <td>${t.start || ""}</td>
      <td>${t.slutt || ""}</td>
      <td>${t.timer || 0}</td>
      <td>${Number(t.sum || 0).toFixed(2)}</td>
      <td>${t.fakturerbar ? "Ja" : "Nei"}</td>
    `;

    timerTabell.appendChild(tr);
  });
}

function nullstillSkjema() {
  settFeltHvisFinnes("startTid", "");
  settFeltHvisFinnes("sluttTid", "");
  settFeltHvisFinnes("beskrivelse", "");

  settFeltHvisFinnes("kundeNrVisning", "");
  settFeltHvisFinnes("prosjektValg", "");
  settFeltHvisFinnes("vareValg", "");
  settFeltHvisFinnes("vareAntall", "1");
  settFeltHvisFinnes("varePris", "0");

  const varelinjeListe = document.getElementById("varelinjeListe");
  if (varelinjeListe) {
    varelinjeListe.innerHTML = "Varer som legges her kommer med på neste faktura.";
  }

  if (typeof fyllProsjektDropdown === "function") fyllProsjektDropdown();

  settFeltHvisFinnes("utgiftType", "");
  settFeltHvisFinnes("utgiftBelop", "0");

  const kundeValg = document.getElementById("kundeValg");
  if (kundeValg) {
    kundeValg.value = "";
    kundeValg.selectedIndex = 0;
  }

  const fakturerbar = document.getElementById("fakturerbar");
  if (fakturerbar) fakturerbar.value = "ja";

  const startTid = document.getElementById("startTid");
  if (startTid) startTid.focus();
}

function round(tall) {
  return Math.round(tall * 100) / 100;
}

function lagMvaExcel() {
  const fakturerte = (window.timer || []).filter(t =>
    t.fakturanr || t.faktura_nr
  );

  if (!fakturerte.length) {
    alert("Ingen fakturerte timer funnet.");
    return;
  }

  const rows = fakturerte.map(t => {
    const eksMva = Number(t.sum || 0);
    const mva = eksMva * 0.25;
    const inklMva = eksMva + mva;

    return {
      Fakturanr: t.fakturanr || t.faktura_nr || "",
      Dato: t.dato || "",
      Kundenr: t.kunde_nr || "",
      Kunde: t.kunde_navn || "",
      "Eks MVA": eksMva,
      MVA: mva,
      "Inkl MVA": inklMva
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  XLSX.utils.book_append_sheet(wb, ws, "MVA");
  XLSX.writeFile(wb, "mva_rapport.xlsx");
}

async function lagreVarelinjeTilFaktura() {
  const melding = hentTimerMelding();

  const bilValg = document.getElementById("bilValg");
  const vareValg = document.getElementById("vareValg");
  const antallFelt = document.getElementById("vareAntall");
  const prisFelt = document.getElementById("varePris");
  const kundeValg = document.getElementById("kundeValg");

  if (!kundeValg || !kundeValg.value) {
    alert("Velg kunde først.");
    return;
  }

  const valgtKunde = typeof finnKundeFraValg === "function"
    ? finnKundeFraValg(kundeValg.value)
    : (window.kunder || []).find(k => String(k.id || "") === String(kundeValg.value));

  if (!valgtKunde || !valgtKunde.id) {
    alert("Fant ikke valgt kunde.");
    return;
  }

  const aktivBilId = hentAktivBilIdFraSkjerm();

  if (!aktivBilId) {
    alert("Velg aktiv bil/lager først. Varer trekkes fra valgt bil.");
    return;
  }

  if (bilValg) bilValg.value = String(aktivBilId);

  if (!vareValg || !vareValg.value) {
    alert("Velg vare først. Du kan bare velge varer som ligger på aktiv bil.");
    return;
  }

  const valgtVareOption = vareValg.options[vareValg.selectedIndex];
  if (!valgtVareOption || valgtVareOption.dataset.kilde !== "bil") {
    alert("Denne varen kan ikke selges her. Varelisten må være fra aktiv bil, ikke hovedlager.");
    await fyllVarevalgFraAktivBil();
    return;
  }

  const antallPaValgtBil = Number(valgtVareOption.dataset.antallBil || 0);

  const antall = heltallFraFelt("vareAntall", 1);
  if (!Number.isInteger(antall) || antall <= 0) {
    alert("Antall må være et heltall større enn 0.");
    return;
  }

  if (antallPaValgtBil < antall) {
    alert(`Du kan ikke selge mer enn bilen har. Bilen har ${antallPaValgtBil}, du prøver å selge ${antall}.`);
    return;
  }

  const { data: vare, error: vareFeil } = await supabaseClient
    .from("varer")
    .select("*")
    .eq("id", vareValg.value)
    .single();

  if (vareFeil) {
    alert("Feil ved henting av vare: " + vareFeil.message);
    return;
  }

  const { data: bilVare, error: bilVareFeil } = await supabaseClient
    .from("bil_varer")
    .select("*")
    .eq("bil_id", aktivBilId)
    .eq("vare_id", vareValg.value)
    .maybeSingle();

  if (bilVareFeil) {
    alert("Feil ved sjekk av bil-lager: " + bilVareFeil.message);
    return;
  }

  const antallIBil = Number(bilVare?.antall || 0);
  if (!bilVare || antallIBil < antall) {
    alert(`Ikke nok vare i valgt bil. Bilen har ${antallIBil}, du prøver å selge ${antall}.`);
    return;
  }

  const pris = Number(prisFelt?.value || 0) || Number(vare.pris || vare.utpris || 0);

  const { error } = await supabaseClient
    .from("faktura_varer")
    .insert({
      kunde_id: valgtKunde.id,
      navn: ((vare.varenr || "") + " " + (vare.navn || "")).trim(),
      antall: antall,
      pris: pris,
      fakturert: false,
      fakturanr: null
    });

  if (error) {
    alert("Feil ved lagring av varelinje: " + error.message);
    return;
  }

  const nyttBilAntall = antallIBil - antall;
  const { error: trekkFeil } = await supabaseClient
    .from("bil_varer")
    .update({ antall: nyttBilAntall })
    .eq("id", bilVare.id);

  if (trekkFeil) {
    alert("Varelinje ble lagt på faktura, men lager ble ikke trukket: " + trekkFeil.message);
    return;
  }

  if (typeof window.registrerLagerBevegelse === "function") {
    await window.registrerLagerBevegelse({
      vare_id: vareValg.value,
      bil_id: aktivBilId,
      fra_type: "bil",
      fra_id: aktivBilId,
      til_type: "faktura",
      til_id: null,
      antall,
      type: "salg",
      kommentar: "Vare solgt/lagt på faktura"
    });
  }

  const liste = document.getElementById("varelinjeListe");
  if (liste) {
    const div = document.createElement("div");
    div.textContent =
      "Lagt til og trukket fra bil-lager: " +
      (vare.varenr || "") +
      " " +
      (vare.navn || "") +
      " - antall " +
      antall +
      " - pris " +
      pris;
    liste.appendChild(div);
  }

  vareValg.value = "";
  if (antallFelt) antallFelt.value = "1";
  if (prisFelt) prisFelt.value = "0";

  if (melding) {
    melding.textContent = "Vare lagt til på faktura og trukket fra valgt bil.";
  }

  if (typeof window.hentBilLager === "function") await window.hentBilLager();
  await fyllVarevalgFraAktivBil();
}

function kobleVarelinjeKnapp() {
  const knapp = document.getElementById("leggTilVarelinjeKnapp");
  if (!knapp) return;

  knapp.onclick = async function () {
    await lagreVarelinjeTilFaktura();
  };
}


document.addEventListener("DOMContentLoaded", () => {
  const bilValg = document.getElementById("bilValg");
  const byttBilKnapp = document.getElementById("byttBilKnapp");

  if (bilValg) {
    bilValg.addEventListener("change", () => {
      const valgtOption = bilValg.options[bilValg.selectedIndex];
      window.aktivBilId = bilValg.value || "";
      window.aktivBilNavn = valgtOption ? valgtOption.textContent : "";
      oppdaterAktivBilVisning();
      fyllVarevalgFraAktivBil();
    });
  }

  if (byttBilKnapp) byttBilKnapp.addEventListener("click", byttAktivBil);
  oppdaterAktivBilVisning();
  fyllVarevalgFraAktivBil();
});

window.oppdaterAktivBilVisning = oppdaterAktivBilVisning;
window.byttAktivBil = byttAktivBil;
window.hentAktivBilIdFraSkjerm = hentAktivBilIdFraSkjerm;
window.fyllVarevalgFraAktivBil = fyllVarevalgFraAktivBil;

const excelKnapp = document.getElementById("excelKnapp");
if (excelKnapp) {
  excelKnapp.onclick = lagMvaExcel;
}


async function lagreUtleggTilFaktura() {
  const melding = hentTimerMelding();
  const kundeValg = document.getElementById("kundeValg");

  if (!kundeValg || !kundeValg.value) {
    alert("Velg kunde først.");
    return;
  }

  const valgtKunde = typeof finnKundeFraValg === "function"
    ? finnKundeFraValg(kundeValg.value)
    : (window.kunder || []).find(k => String(k.id || "") === String(kundeValg.value));

  if (!valgtKunde || !valgtKunde.id) {
    alert("Fant ikke valgt kunde.");
    return;
  }

  const ansattId = window.innloggetAnsattId || "";
  if (!ansattId) {
    alert("Fant ikke innlogget ansatt.");
    return;
  }

  const type = tekstFraFelt("utgiftType");
  let belop = tallFraFelt("utgiftBelop");

  let km = 0;
  let kmPris = 0;

  if (type === "kjoring") {
    km = tallFraFelt("utgiftKm");
    kmPris = tallFraFelt("utgiftKmPris") || 3.5;
    belop = km * kmPris;
    settFeltHvisFinnes("utgiftBelop", belop.toFixed(2));
  }

  if (!type) {
    alert("Velg utgiftstype.");
    return;
  }

  if (!belop || belop <= 0) {
    alert("Skriv inn beløp eller km.");
    return;
  }

  const dato = tekstFraFelt("dato") || new Date().toISOString().split("T")[0];

  const valgtKundeNr = typeof hentKundeNr === "function"
    ? hentKundeNr(valgtKunde)
    : (valgtKunde?.kundenr || valgtKunde?.kunde_nr || "");

  const { error: fakturaFeil } = await supabaseClient
    .from("faktura_utlegg")
    .insert({
      kunde_id: valgtKunde.id,
      type: type,
      beskrivelse: type,
      belop: belop,
      fakturert: false,
      fakturanr: null
    });

  if (fakturaFeil) {
    alert("Feil ved lagring av utlegg til faktura: " + fakturaFeil.message);
    return;
  }

  const timerUtlegg = {
    ansatt_id: ansattId,
    dato: dato,
    kunde_id: valgtKunde.id,
    kunde_nr: valgtKundeNr,
    kunde_navn: valgtKunde.navn || "",
    prosjekt_id: tekstFraFelt("prosjektValg") || null,

    start: "00:00",
    slutt: "00:00",
    timer: 0,
    overtid50: 0,
    overtid100: 0,
    timepris: 0,
    sum_timer: 0,

    km: type === "kjoring" ? km : 0,
    km_pris: type === "kjoring" ? kmPris : 0,
    sum_km: type === "kjoring" ? belop : 0,

    diett: type === "diett" ? belop : 0,
    parkering: type === "parkering" ? belop : 0,
    billetter: type === "billetter" ? belop : 0,
    bompenger: type === "bompenger" ? belop : 0,
    andre_utlegg:
      !["kjoring", "diett", "parkering", "billetter", "bompenger"].includes(type)
        ? belop
        : 0,

    andre_utlegg_beskrivelse: "Utlegg/refusjon: " + type,
    sum: 0,
    fakturerbar: false,
    beskrivelse: "Utlegg/refusjon: " + type
  };

  const { error: timerFeil } = await supabaseClient
    .from("timer")
    .insert([timerUtlegg]);

  if (timerFeil) {
    alert("Utlegg ble lagret til faktura, men ikke til lønn: " + timerFeil.message);
    return;
  }

  settFeltHvisFinnes("utgiftType", "");
  settFeltHvisFinnes("utgiftBelop", "0");
  settFeltHvisFinnes("utgiftKm", "0");
  settFeltHvisFinnes("utgiftKmPris", "3.50");

  visSkjulKjoringFelter();

  if (melding) {
    melding.textContent = "Utlegg lagret til faktura og lønnsslipp.";
  }

  await lastTimer();
}

function visSkjulKjoringFelter() {
  const type = tekstFraFelt("utgiftType");

  const kmFelt = document.getElementById("utgiftKm");
  const kmPrisFelt = document.getElementById("utgiftKmPris");

  const kmRad = kmFelt ? kmFelt.parentElement : null;
  const kmPrisRad = kmPrisFelt ? kmPrisFelt.parentElement : null;

  const vis = type === "kjoring";

  if (kmRad) kmRad.style.display = vis ? "block" : "none";
  if (kmPrisRad) kmPrisRad.style.display = vis ? "block" : "none";
}

function oppdaterKjoringBelop() {
  visSkjulKjoringFelter();

  if (tekstFraFelt("utgiftType") !== "kjoring") return;

  const km = tallFraFelt("utgiftKm");
  const kmPris = tallFraFelt("utgiftKmPris") || 3.5;

  settFeltHvisFinnes("utgiftBelop", (km * kmPris).toFixed(2));
}

function kobleKjoringBeregning() {
  const typeFelt = document.getElementById("utgiftType");
  const kmFelt = document.getElementById("utgiftKm");
  const kmPrisFelt = document.getElementById("utgiftKmPris");

  if (typeFelt) typeFelt.onchange = oppdaterKjoringBelop;
  if (kmFelt) kmFelt.oninput = oppdaterKjoringBelop;
  if (kmPrisFelt) kmPrisFelt.oninput = oppdaterKjoringBelop;

  visSkjulKjoringFelter();
}

function kobleUtleggKnapp() {
  const knapp = document.getElementById("leggTilUtleggKnapp");
  if (!knapp) return;

  knapp.onclick = async function () {
    await lagreUtleggTilFaktura();
  };
}

function skjulAdminForVanligBruker() {
  if (window.erAdmin === true || (typeof erAdmin !== "undefined" && erAdmin === true)) return;

  const skjulKnapper = [
    "Kjør purring",
    "Fakturakopi"
  ];

  document.querySelectorAll("button").forEach(knapp => {
    const tekst = knapp.textContent.trim();
    if (skjulKnapper.includes(tekst)) {
      knapp.style.display = "none";
    }
  });

  document.querySelectorAll("h1, h2, h3").forEach(overskrift => {
    const tekst = overskrift.textContent.trim();

    if (
      tekst === "Vareregister" ||
      tekst === "Restore fra backupfil"
    ) {
      let el = overskrift;
      while (el && el.parentElement && el.parentElement.children.length < 20) {
        el = el.parentElement;
      }
      overskrift.style.display = "none";
    }
  });
}

window.addEventListener("load", function () {
  kobleVarelinjeKnapp();
  kobleUtleggKnapp();
  kobleKjoringBeregning();
  skjulAdminForVanligBruker();

  const excelKnapp = document.getElementById("excelKnapp");
  if (excelKnapp) {
    excelKnapp.onclick = lagMvaExcel;
  }
});

window.lastTimer = lastTimer;
window.lagreTimer = lagreTimer;
window.settDagensDato = settDagensDato;
window.tegnTimer = tegnTimer;
async function lastOppTimerBilde(timerId) {

 const filInputGalleri =
  document.getElementById(
    "timerBildeGalleri"
  );

const filInputKamera =
  document.getElementById(
    "timerBildeKamera"
  );

const filInput =
  (
    filInputKamera &&
    filInputKamera.files &&
    filInputKamera.files.length > 0
  )
    ? filInputKamera
    : filInputGalleri;

  const tekstInput =
    document.getElementById(
      "timerBildeTekst"
    );

  if (
    !filInput ||
    !filInput.files ||
    filInput.files.length === 0
  ) {
    return;
  }

  const fil =
    filInput.files[0];

  const filnavn =
    timerId +
    "/" +
    Date.now() +
    "_" +
    fil.name.replaceAll(" ", "_");

  const { error: uploadError } =
    await supabaseClient
      .storage
      .from("timer-bilder")
      .upload(
        filnavn,
        fil
      );

  if (uploadError) {
    throw uploadError;
  }

  const { error: dbError } =
    await supabaseClient
      .from("timer_bilder")
      .insert({
        timer_id: timerId,
        filnavn: fil.name,
        filsti: filnavn,
        bildetekst:
          tekstInput?.value || ""
      });

  if (dbError) {
    throw dbError;
  }
}