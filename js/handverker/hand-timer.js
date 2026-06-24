console.log("NY hand-timer.js er lastet");

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


async function settStandardBilForInnloggetAnsatt() {
  try {
    if (!window.supabaseClient) return;

    let ansatt = null;

    if (window.innloggetAnsattId) {
      const { data, error } = await supabaseClient
        .from("hand_ansatt")
        .select("id, navn, epost, standard_bil_id")
        .eq("id", window.innloggetAnsattId)
        .limit(1);

      if (!error && data && data.length) ansatt = data[0];
    }

    if (!ansatt && window.innloggetEpost) {
      const { data, error } = await supabaseClient
        .from("hand_ansatt")
        .select("id, navn, epost, standard_bil_id")
        .eq("epost", String(window.innloggetEpost).toLowerCase())
        .limit(1);

      if (!error && data && data.length) {
        ansatt = data[0];
        window.innloggetAnsattId = ansatt.id || window.innloggetAnsattId;
      }
    }

    const standardBilId = ansatt?.standard_bil_id || "";
    if (!standardBilId) {
      oppdaterAktivBilVisning();
      return;
    }

    window.aktivBilId = String(standardBilId);
    localStorage.setItem("aktivBilId", String(standardBilId));

    const bilValg = document.getElementById("bilValg");

    if (bilValg) {
      if (!bilValg.options.length || bilValg.options.length <= 1) {
        if (typeof window.fyllAlleBilvalg === "function") {
          await window.fyllAlleBilvalg();
        } else if (typeof window.fyllBilvalg === "function") {
          await window.fyllBilvalg();
        }
      }

      const finnes = Array.from(bilValg.options).some(o => String(o.value) === String(standardBilId));
      if (finnes) {
        bilValg.value = String(standardBilId);
        const valgtOption = bilValg.options[bilValg.selectedIndex];
        window.aktivBilNavn = valgtOption ? valgtOption.textContent : "";
        localStorage.setItem("aktivBilNavn", window.aktivBilNavn || "");
      }
    }

    oppdaterAktivBilVisning();

    if (typeof window.fyllVarevalgFraAktivBil === "function") {
      await window.fyllVarevalgFraAktivBil();
    }
  } catch (e) {
    console.warn("Kunne ikke sette standard bil for innlogget ansatt:", e);
  }
}


async function fyllVarevalgFraAktivBil() {
  const vareValg = document.getElementById("vareValg");
  const prisFelt = document.getElementById("varePris");
  const aktivBilId = hentAktivBilIdFraSkjerm();

  if (!vareValg) return;
  vareValg.innerHTML = '<option value="">Velg vare</option>';

  if (!aktivBilId) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Velg aktiv bil først";
    vareValg.appendChild(opt);
    return;
  }

  const { data: alleVarer, error: varerFeil } = await supabaseClient
    .from("hand_vare")
    .select("id, varenr, navn, pris, utpris, mva_sats, antall, lager_antall, lager, beholdning")
    .order("navn", { ascending: true });

  if (varerFeil) {
    console.error("Feil ved henting av varer:", varerFeil);
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Feil ved henting av varer";
    vareValg.appendChild(opt);
    return;
  }

  const { data: bilVarer, error: bilFeil } = await supabaseClient
    .from("hand_bil_lager")
    .select("id, vare_id, antall")
    .eq("bil_id", aktivBilId);

  if (bilFeil) {
    console.error("Feil ved henting av bil-lager:", bilFeil);
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Feil ved henting av bil-lager";
    vareValg.appendChild(opt);
    return;
  }

  if (!alleVarer || !alleVarer.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Ingen varer registrert";
    vareValg.appendChild(opt);
    return;
  }

  const bilMap = new Map();
  (bilVarer || []).forEach(rad => {
    bilMap.set(String(rad.vare_id), rad);
  });

  alleVarer.forEach(v => {
    const bilRad = bilMap.get(String(v.id));
    const antallBil = Number(bilRad?.antall || 0);
    const pris = Number(v.pris ?? v.utpris ?? 0);
    const hovedlagerAntall = Number(
      v.antall ??
      v.lager_antall ??
      v.lager ??
      v.beholdning ??
      0
    );

    const opt = document.createElement("option");
    opt.value = v.id;
    opt.dataset.pris = String(pris);
    opt.dataset.antallBil = String(antallBil);
    opt.dataset.antallHovedlager = String(hovedlagerAntall);
    opt.dataset.kilde = antallBil > 0 ? "bil" : "mangler";
    opt.dataset.bilVareId = String(bilRad?.id || "");
    opt.textContent = `${v.varenr || ""} ${v.navn || ""} - i bil: ${antallBil} - hovedlager: ${hovedlagerAntall} - ${pris.toFixed(2)} kr`;
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
      .from("hand_ansatt")
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

function settStandardTidHvisTom() {
  const startTid = document.getElementById("startTid");
  const sluttTid = document.getElementById("sluttTid");

  // Standard ved ny registrering, men brukeren kan fortsatt endre feltene.
  if (startTid && !startTid.value) startTid.value = "08:00";
  if (sluttTid && !sluttTid.value) sluttTid.value = "16:00";
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


async function hentFirmaIdForTimerTilgang() {
  if (typeof window.hentAktivFirmaId === "function") {
    const id = window.hentAktivFirmaId();
    if (id) return id;
  }
  const direkte = window.aktivFirmaId || window.firmaData?.id || window.firma?.id || localStorage.getItem("aktivFirmaId") || localStorage.getItem("firmaId") || localStorage.getItem("firma_id") || "";
  if (direkte) return direkte;

  const ansattId = window.innloggetAnsattId || localStorage.getItem("innloggetAnsattId") || localStorage.getItem("ansattId") || "";
  const epost = String(window.innloggetEpost || localStorage.getItem("innloggetEpost") || "").toLowerCase();
  if (!window.supabaseClient) return "";
  try {
    let q = supabaseClient.from("hand_ansatt").select("firma_id").limit(1);
    if (ansattId) q = q.eq("id", ansattId);
    else if (epost) q = q.ilike("epost", epost);
    else return "";
    const { data, error } = await q.maybeSingle();
    if (!error && data?.firma_id) {
      window.aktivFirmaId = data.firma_id;
      localStorage.setItem("aktivFirmaId", data.firma_id);
      return data.firma_id;
    }
  } catch (e) {
    console.warn("Kunne ikke finne firma_id for timer-tilgang:", e);
  }
  return "";
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
    .from("hand_time")
    .select("*")
    .order("dato", { ascending: false });

  const firmaId = await hentFirmaIdForTimerTilgang();

  if (erAdmin && window.erSystemadmin !== true && firmaId) {
    query = query.eq("firma_id", firmaId);
  } else if (!erAdmin && window.innloggetAnsattId) {
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
  await hentBildeAntallForTimer();
  tegnTimer();
}

async function sjekkTimerGrenser(ansattId, dato, nyeTimer) {
  const melding = hentTimerMelding();

  const { data: dagTimer, error: dagFeil } = await supabaseClient
    .from("hand_time")
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
    .from("hand_time")
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

  const firmaIdForLagring = typeof hentFirmaIdForTimerTilgang === "function"
    ? await hentFirmaIdForTimerTilgang()
    : null;

  const supabaseTimer = {
    ansatt_id: ansattId,
    firma_id: firmaIdForLagring || null,
    dato: registrering.dato,
    kunde_id: registrering.kundeId,
    kunde_nr: registrering.kundeNr,
    kunde_navn: registrering.kundeNavn,
    prosjekt_id: registrering.prosjektId,
    /*re_id: null,
    vare_antall: null,*/
    start: registrering.start,
    slutt: registrering.slutt,
    start_tid: registrering.start,
    slutt_tid: registrering.slutt,
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
    .from("hand_time")
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
  .from("hand_time")
  .insert([supabaseTimer])
  .select()
  .single();
  if (error) {
    console.error("Feil ved lagring av timer:", error);
    if (melding) melding.textContent = "Feil ved lagring av timer: " + error.message;
    return;
  }

  if (data?.id && typeof window.registrerOvertidTilFlexiEtterTimer === "function") {
    try {
      await window.registrerOvertidTilFlexiEtterTimer(data);
    } catch (e) {
      console.warn("Kunne ikke oppdatere flexi/timebank:", e);
    }
  }

if (data?.id) {
  try {
    await lastOppTimerBilde(data.id);
  } catch (e) {
    console.error("Bildefeil:", e);
    if (melding) {
      melding.textContent =
        "Timer lagret, men bilde feilet: " +
        (e.message || JSON.stringify(e));
    }
  }
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

async function hentBildeAntallForTimer() {
  if (!Array.isArray(window.timer) || !window.timer.length || !window.supabaseClient) return;

  const ids = window.timer.map(t => t.id).filter(Boolean);
  if (!ids.length) return;

  try {
    const { data, error } = await supabaseClient
      .from("hand_time_bilde")
      .select("timer_id")
      .in("timer_id", ids);

    if (error) {
      console.warn("Kunne ikke hente bildeantall:", error);
      window.timer.forEach(t => t._bilde_antall = t.bilde_path || t.bilde_url ? 1 : 0);
      return;
    }

    const antallMap = new Map();
    (data || []).forEach(b => {
      const key = String(b.timer_id || "");
      antallMap.set(key, (antallMap.get(key) || 0) + 1);
    });

    window.timer.forEach(t => {
      const fraTabell = antallMap.get(String(t.id)) || 0;
      const fraTimerRad = (t.bilde_path || t.bilde_url) ? 1 : 0;
      t._bilde_antall = Math.max(fraTabell, fraTimerRad);
    });
  } catch (e) {
    console.warn("Hoppet over bildeantall:", e);
    window.timer.forEach(t => t._bilde_antall = t.bilde_path || t.bilde_url ? 1 : 0);
  }
}

function finnTimerFraId(timerId) {
  return (window.timer || []).find(t => String(t.id) === String(timerId));
}

async function lagSignertTimerBildeUrl(filsti) {
  if (!filsti || !window.supabaseClient) return "";

  try {
    const { data, error } = await supabaseClient
      .storage
      .from("timer-bilder")
      .createSignedUrl(filsti, 60 * 60 * 24 * 7);

    if (!error && data?.signedUrl) return data.signedUrl;
  } catch (e) {
    console.warn("Kunne ikke lage signert URL:", e);
  }

  try {
    const { data } = supabaseClient
      .storage
      .from("timer-bilder")
      .getPublicUrl(filsti);

    return data?.publicUrl || "";
  } catch (e) {
    return "";
  }
}

async function hentBilderForTimer(timerId) {
  const bilder = [];
  const t = finnTimerFraId(timerId);

  if (t?.bilde_path || t?.filsti || t?.bilde_url) {
    const sti = t.bilde_path || t.filsti || "";
    const url = sti ? await lagSignertTimerBildeUrl(sti) : (t.bilde_url || "");
    if (url) bilder.push({ url, tekst: "" });
  }

  try {
    const { data, error } = await supabaseClient
      .from("hand_time_bilde")
      .select("filsti, bildetekst")
      .eq("timer_id", timerId)
      .order("id", { ascending: false });

    if (error) {
      console.warn("Kunne ikke hente bilder for jobb:", error);
      return bilder;
    }

    for (const b of (data || [])) {
      const sti = b.filsti || "";
      const url = sti ? await lagSignertTimerBildeUrl(sti) : "";
      if (url && !bilder.some(x => x.url === url)) {
        bilder.push({ url, tekst: b.bildetekst || "" });
      }
    }
  } catch (e) {
    console.warn("Hoppet over bilder for jobb:", e);
  }

  return bilder;
}

function lagJobbModalHvisMangler() {
  let modal = document.getElementById("rilJobbModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "rilJobbModal";
  modal.style.cssText = "display:none;position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,.45);padding:16px;overflow:auto;";
  document.body.appendChild(modal);
  return modal;
}

async function apneJobbDetalj(timerId) {
  const t = finnTimerFraId(timerId);
  if (!t) {
    alert("Fant ikke jobben.");
    return;
  }

  const kundeInfo = kundeInfoForTimer(t);
  const modal = lagJobbModalHvisMangler();
  modal.style.display = "block";
  modal.innerHTML = `
    <div style="background:#fff;color:#111;max-width:850px;margin:22px auto;padding:18px;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <h2 style="margin:0;">Jobb ${t.dato || ""}</h2>
        <button type="button" id="rilLukkJobbModal">Lukk</button>
      </div>

      <p>
        <b>Kunde:</b> ${kundeInfo.kundeNr || ""} ${kundeInfo.kundeNavn || ""}<br>
        <b>Tid:</b> ${t.start || ""} - ${t.slutt || ""}<br>
        <b>Timer:</b> ${t.timer || 0}<br>
        <b>Beløp:</b> ${Number(t.sum || 0).toFixed(2)}
      </p>

      <p><b>Beskrivelse:</b><br>${t.beskrivelse || ""}</p>

      <h3>Bilder</h3>
      <div id="rilJobbBilder">Laster bilder...</div>

      <hr>
      <h3>Legg til bilde på denne jobben</h3>
      <div style="display:grid;gap:8px;max-width:440px;">
        <input type="file" id="rilJobbBildeFil" accept="image/*" multiple>
        <input type="text" id="rilJobbBildeTekst" placeholder="Bildetekst, valgfritt">
        <button type="button" id="rilLagreJobbBildeKnapp" style="padding:10px 12px;font-weight:700;">Legg til bilde(r) på denne jobben</button>
        <div id="rilJobbBildeMelding" style="font-weight:600;"></div>
      </div>
    </div>
  `;

  document.getElementById("rilLukkJobbModal").onclick = function () {
    modal.style.display = "none";
  };

  document.getElementById("rilLagreJobbBildeKnapp").onclick = async function () {
    await lagreBildeFraJobbModal(timerId);
  };

  await oppdaterJobbModalBilder(timerId);
}

async function oppdaterJobbModalBilder(timerId) {
  const boks = document.getElementById("rilJobbBilder");
  if (!boks) return;

  const bilder = await hentBilderForTimer(timerId);
  if (!bilder.length) {
    boks.innerHTML = "Ingen bilder på denne jobben ennå.";
    return;
  }

  boks.innerHTML = bilder.map(b => `
    <a href="${b.url}" target="_blank" style="display:inline-block;margin:0 10px 10px 0;color:inherit;text-decoration:none;">
      <img src="${b.url}" alt="Bilde" style="width:150px;height:115px;object-fit:cover;border:1px solid #ddd;border-radius:10px;display:block;">
      <small>${b.tekst || "Åpne bilde"}</small>
    </a>
  `).join("");
}

async function lastOppTimerBildeFraFil(timerId, fil, bildetekst) {
  if (!timerId || !fil) throw new Error("Mangler jobb eller bilde.");
  if (!window.supabaseClient) throw new Error("Supabase er ikke lastet.");

  const rentFilnavn = String(fil.name || "bilde.jpg")
    .replaceAll(" ", "_")
    .replace(/[æøåÆØÅ]/g, function (bokstav) {
      return { æ: "ae", ø: "o", å: "a", Æ: "Ae", Ø: "O", Å: "A" }[bokstav] || bokstav;
    })
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const filsti = String(timerId) + "/" + Date.now() + "_" + rentFilnavn;

  const { error: uploadError } = await supabaseClient
    .storage
    .from("timer-bilder")
    .upload(filsti, fil, {
      cacheControl: "3600",
      upsert: true,
      contentType: fil.type || "image/jpeg"
    });

  if (uploadError) {
    throw new Error("Opplasting til Storage feilet: " + uploadError.message);
  }

  // Viktig: bruk bare kolonner som timer_bilder faktisk har brukt hos deg tidligere.
  const bildeRad = {
    timer_id: timerId,
    filnavn: fil.name || rentFilnavn,
    filsti: filsti,
    bildetekst: bildetekst || ""
  };

  const { error: dbError } = await supabaseClient
    .from("hand_time_bilde")
    .insert([bildeRad]);

  if (dbError) {
    // Prøv å rydde opp lagret fil hvis databaseinnslag feilet.
    try {
      await supabaseClient.storage.from("timer-bilder").remove([filsti]);
    } catch (e) {
      console.warn("Kunne ikke rydde opp bilde etter db-feil:", e);
    }

    throw new Error("Bildet ble lastet opp, men ikke lagret i timer_bilder: " + dbError.message);
  }

  return filsti;
}

async function lagreBildeFraJobbModal(timerId) {
  const filInput = document.getElementById("rilJobbBildeFil");
  const tekstInput = document.getElementById("rilJobbBildeTekst");
  const melding = document.getElementById("rilJobbBildeMelding");
  const knapp = document.getElementById("rilLagreJobbBildeKnapp");

  if (melding) melding.textContent = "";

  const filer = Array.from(filInput?.files || []);
  if (!filer.length) {
    if (melding) melding.textContent = "Velg ett eller flere bilder først.";
    return;
  }

  try {
    if (knapp) knapp.disabled = true;
    if (melding) melding.textContent = "Lagrer " + filer.length + " bilde(r)...";

    for (const fil of filer) {
      await lastOppTimerBildeFraFil(timerId, fil, tekstInput?.value || "");
    }

    if (filInput) filInput.value = "";
    if (tekstInput) tekstInput.value = "";

    await lastTimer();
    await oppdaterJobbModalBilder(timerId);

    if (melding) melding.textContent = filer.length + " bilde(r) er lagret på jobben.";
  } catch (e) {
    console.error("Feil ved lagring av bilde på jobb:", e);
    if (melding) melding.textContent = "Bildet ble ikke lagret: " + (e.message || JSON.stringify(e));
  } finally {
    if (knapp) knapp.disabled = false;
  }
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
    const bildeAntall = Number(t._bilde_antall || 0);

    tr.innerHTML = `
      <td>${t.dato || ""}</td>
      <td>${kundeInfo.kundeNr || ""}<br>${kundeInfo.kundeNavn || ""}</td>
      <td>${t.start || ""}</td>
      <td>${t.slutt || ""}</td>
      <td>${t.timer || 0}</td>
      <td>${Number(t.sum || 0).toFixed(2)}</td>
      <td>${t.fakturerbar ? "Ja" : "Nei"}</td>
      <td>📷 ${bildeAntall}</td>
      <td><button type="button" class="ril-apne-jobb-knapp" data-timer-id="${t.id}">Åpne</button></td>
    `;

    timerTabell.appendChild(tr);

    const apneKnapp = tr.querySelector(".ril-apne-jobb-knapp");
    if (apneKnapp) {
      apneKnapp.addEventListener("click", async function (e) {
        e.preventDefault();
        e.stopPropagation();
        await apneJobbDetalj(t.id);
      });
    }
  });
}

function nullstillSkjema() {
  settFeltHvisFinnes("startTid", "08:00");
  settFeltHvisFinnes("sluttTid", "16:00");
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

  handLeggTilKompaktLinje({
    containerId: "handUtleggLinjer",
    etterElementId: "leggTilUtleggKnapp",
    tittel: "Utlegg lagt til",
    tekst: type + " - " + handFormatKr(belop) + (type === "kjoring" ? " (" + km + " km)" : ""),
    sum: belop,
    sumId: "handUtleggSum",
    sumLabel: "Utleggsum",
    slett: async function () {
      if (utleggData?.id) {
        const { error: slettUtleggFeil } = await supabaseClient.from("hand_faktura_utlegg").delete().eq("id", utleggData.id);
        if (slettUtleggFeil) throw slettUtleggFeil;
      }
      if (timerUtleggData?.id) {
        const { error: slettTimerFeil } = await supabaseClient.from("hand_time").delete().eq("id", timerUtleggData.id);
        if (slettTimerFeil) throw slettTimerFeil;
      }
    }
  });

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


async function handterManglendeVareTilBil({ vareId, aktivBilId, antall, antallIBil, vareNavn }) {
  const manglerAntall = Math.max(0, Number(antall || 0) - Number(antallIBil || 0));

  if (manglerAntall <= 0) return false;

  const valg = prompt(
    "Du har ikke nok av denne varen på bilen.\n\n" +
    "Vare: " + (vareNavn || "Valgt vare") + "\n" +
    "Bilen har: " + Number(antallIBil || 0) + "\n" +
    "Du prøver å bruke: " + Number(antall || 0) + "\n" +
    "Mangler: " + manglerAntall + "\n\n" +
    "Skriv:\n" +
    "1 = Velg annen vare\n" +
    "2 = Bestill varen til bilen\n" +
    "3 = Avbryt",
    "1"
  );

  if (valg === null || valg === "3") {
    return false;
  }

  if (valg === "1") {
    const vareValg = document.getElementById("vareValg");
    if (vareValg) vareValg.focus();
    return false;
  }

  if (valg !== "2") {
    alert("Ugyldig valg. Ingen bestilling ble opprettet.");
    return false;
  }

  const { data: hovedvare, error: hovedvareFeil } = await supabaseClient
    .from("hand_vare")
    .select("*")
    .eq("id", vareId)
    .single();

  if (hovedvareFeil) {
    alert("Kunne ikke sjekke hovedlager: " + hovedvareFeil.message);
    return false;
  }

  const hovedlagerAntall = Number(
    hovedvare.antall ??
    hovedvare.lager_antall ??
    hovedvare.lager ??
    hovedvare.beholdning ??
    0
  );

  const { error: bestillingFeil } = await supabaseClient
    .from("hand_lager_bestilling")
    .insert({
      vare_id: vareId,
      bil_id: Number(aktivBilId),
      ansatt_id: window.innloggetAnsattId || null,
      antall: manglerAntall,
      status: "ny",
      kommentar: "Bestilling fra timerbildet. Bilen manglet varen."
    });

  if (bestillingFeil) {
    alert("Kunne ikke opprette lagerbestilling: " + bestillingFeil.message);
    return false;
  }

  if (hovedlagerAntall < manglerAntall) {
    const manglerInnkjop = manglerAntall - hovedlagerAntall;
    const lagInnkjop = confirm(
      "Bestilling til bil er opprettet.\n\n" +
      "Men hovedlager har ikke nok.\n" +
      "Hovedlager har: " + hovedlagerAntall + "\n" +
      "Mangler for innkjøp: " + manglerInnkjop + "\n\n" +
      "Vil du opprette innkjøpsbehov?"
    );

    if (lagInnkjop) {
      const { error: innkjopFeil } = await supabaseClient
        .from("hand_innkjopsvarsel")
        .insert({
          vare_id: vareId,
          antall: manglerInnkjop,
          status: "ma_bestilles",
          kommentar: "Innkjøpsbehov fra timerbildet. Hovedlager hadde ikke nok til bilbestilling."
        });

      if (innkjopFeil) {
        alert("Lagerbestilling ble opprettet, men innkjøpsvarsel feilet: " + innkjopFeil.message);
        return true;
      }

      alert("Lagerbestilling og innkjøpsbehov er opprettet.");
      return true;
    }

    alert("Lagerbestilling er opprettet. Innkjøpsbehov ble ikke opprettet.");
    return true;
  }

  alert("Lagerbestilling til bil er opprettet.");
  return true;
}


function handFormatKr(belop) {
  const n = Number(belop || 0);
  return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";
}

function handFinnEllerLagLinjeListe(id, etterElementId, tittel) {
  let wrap = document.getElementById(id);
  if (wrap) return wrap;
  const etter = document.getElementById(etterElementId);
  if (!etter || !etter.parentElement) return null;
  wrap = document.createElement("div");
  wrap.id = id;
  wrap.style.margin = "8px 0 12px 0";
  wrap.style.padding = "0";
  wrap.style.background = "transparent";
  wrap.style.color = "#e5e7eb";
  wrap.innerHTML = '<div style="font-weight:700;margin:4px 0 6px 0;color:#e5e7eb;">' + tittel + '</div>';
  etter.insertAdjacentElement("afterend", wrap);
  return wrap;
}

function handOppdaterSum(container, sumId, label) {
  if (!container) return;
  let sum = 0;
  container.querySelectorAll("[data-linje-sum]").forEach(el => {
    sum += Number(el.getAttribute("data-linje-sum") || 0);
  });
  let sumEl = document.getElementById(sumId);
  if (!sumEl) {
    sumEl = document.createElement("div");
    sumEl.id = sumId;
    sumEl.style.marginTop = "6px";
    sumEl.style.fontWeight = "700";
    sumEl.style.color = "#f9fafb";
    container.appendChild(sumEl);
  }
  sumEl.textContent = label + ": " + handFormatKr(sum);
}

function handLeggTilKompaktLinje({ containerId, etterElementId, tittel, tekst, sum, sumId, sumLabel, slett }) {
  const container = handFinnEllerLagLinjeListe(containerId, etterElementId, tittel);
  if (!container) return;
  const row = document.createElement("div");
  row.setAttribute("data-linje-sum", String(Number(sum || 0)));
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";
  row.style.gap = "10px";
  row.style.borderBottom = "1px solid #374151";
  row.style.padding = "6px 0";
  row.style.color = "#e5e7eb";
  row.style.background = "transparent";
  const span = document.createElement("span");
  span.textContent = tekst;
  span.style.flex = "1";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Slett";
  btn.style.padding = "4px 10px";
  btn.style.borderRadius = "6px";
  btn.style.border = "0";
  btn.style.cursor = "pointer";
  btn.style.background = "#dc2626";
  btn.style.color = "white";
  btn.onclick = async function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm("Slette denne linjen?")) return;
    try {
      if (typeof slett === "function") await slett();
      row.remove();
      handOppdaterSum(container, sumId, sumLabel);
    } catch (e) {
      alert("Kunne ikke slette linjen: " + (e.message || e));
    }
  };
  row.appendChild(span);
  row.appendChild(btn);
  const gammelSum = document.getElementById(sumId);
  if (gammelSum && gammelSum.parentElement === container) container.insertBefore(row, gammelSum);
  else container.appendChild(row);
  handOppdaterSum(container, sumId, sumLabel);
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

  // Ikke stol på dataset fra <option>. På mobil/Vercel kan denne mangle selv om varen vises.
  // Sjekk heller bil_lager direkte mot valgt bil og valgt vare.
  let antallPaValgtBil = 0;
  let bilVareFraSjekk = null;

  const { data: bilVareSjekk, error: bilVareSjekkFeil } = await supabaseClient
    .from("hand_bil_lager")
    .select("*")
    .eq("bil_id", aktivBilId)
    .eq("vare_id", vareValg.value)
    .maybeSingle();

  if (bilVareSjekkFeil) {
    alert("Feil ved sjekk av bil-lager: " + bilVareSjekkFeil.message);
    return;
  }

  bilVareFraSjekk = bilVareSjekk || null;
  antallPaValgtBil = Number(bilVareFraSjekk?.antall || 0);

  const antall = heltallFraFelt("vareAntall", 1);
  if (!Number.isInteger(antall) || antall <= 0) {
    alert("Antall må være et heltall større enn 0.");
    return;
  }

  if (antallPaValgtBil < antall) {
    await handterManglendeVareTilBil({
      vareId: vareValg.value,
      aktivBilId,
      antall,
      antallIBil: antallPaValgtBil,
      vareNavn: valgtVareOption.textContent || "Valgt vare"
    });
    await fyllVarevalgFraAktivBil();
    return;
  }

  const { data: vare, error: vareFeil } = await supabaseClient
    .from("hand_vare")
    .select("*")
    .eq("id", vareValg.value)
    .single();

  if (vareFeil) {
    alert("Feil ved henting av vare: " + vareFeil.message);
    return;
  }

  const bilVare = bilVareFraSjekk;
  const antallIBil = Number(bilVare?.antall || 0);
  if (!bilVare || antallIBil < antall) {
    await handterManglendeVareTilBil({
      vareId: vareValg.value,
      aktivBilId,
      antall,
      antallIBil,
      vareNavn: valgtVareOption.textContent || "Valgt vare"
    });
    await fyllVarevalgFraAktivBil();
    return;
  }

  const pris = Number(prisFelt?.value || 0) || Number(vare.pris || vare.utpris || 0);

  const { data: varelinjeData, error } = await supabaseClient
    .from("hand_faktura_vare")
    .insert({
      kunde_id: valgtKunde.id,
      navn: ((vare.varenr || "") + " " + (vare.navn || "")).trim(),
      antall: antall,
      pris: pris,
      fakturert: false,
      fakturanr: null
    })
    .select()
    .single();

  if (error) {
    alert("Feil ved lagring av varelinje: " + error.message);
    return;
  }

  const nyttBilAntall = antallIBil - antall;
  const { error: trekkFeil } = await supabaseClient
    .from("hand_bil_lager")
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

  handLeggTilKompaktLinje({
    containerId: "handVarerLinjer",
    etterElementId: "leggTilVarelinjeKnapp",
    tittel: "Varer lagt til",
    tekst: ((vare.varenr || "") + " " + (vare.navn || "")).trim() + " - " + antall + " x " + handFormatKr(pris) + " = " + handFormatKr(antall * pris),
    sum: antall * pris,
    sumId: "handVarerSum",
    sumLabel: "Varesum",
    slett: async function () {
      if (varelinjeData?.id) {
        const { error: slettVareFeil } = await supabaseClient.from("hand_faktura_vare").delete().eq("id", varelinjeData.id);
        if (slettVareFeil) throw slettVareFeil;
      }
      if (bilVare?.id) {
        await supabaseClient.from("hand_bil_lager").update({ antall: antallIBil }).eq("id", bilVare.id);
      }
    }
  });

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

  knapp.onclick = async function (event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    await lagreVarelinjeTilFaktura();
    return false;
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
  settDagensDato();
  settStandardTidHvisTom();
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

  const { data: utleggData, error: fakturaFeil } = await supabaseClient
    .from("hand_faktura_utlegg")
    .insert({
      kunde_id: valgtKunde.id,
      type: type,
      beskrivelse: type,
      belop: belop,
      fakturert: false,
      fakturanr: null
    })
    .select()
    .single();

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
    start_tid: "00:00",
    slutt_tid: "00:00",
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

  // Utlegg skal bare lagres på faktura her.
  // Tid/lønn lagres i hand_time når timer registreres.
  // Ikke skriv utlegg til hand_time, fordi RLS for hand_time kan stoppe innsettingen.
  const timerUtleggData = null;

  handLeggTilKompaktLinje({
    containerId: "handUtleggLinjer",
    etterElementId: "leggTilUtleggKnapp",
    tittel: "Utlegg lagt til",
    tekst: type + " - " + handFormatKr(belop) + (type === "kjoring" ? " (" + km + " km)" : ""),
    sum: belop,
    sumId: "handUtleggSum",
    sumLabel: "Utleggsum",
    slett: async function () {
      if (utleggData?.id) {
        const { error: slettUtleggFeil } = await supabaseClient.from("hand_faktura_utlegg").delete().eq("id", utleggData.id);
        if (slettUtleggFeil) throw slettUtleggFeil;
      }
      if (timerUtleggData?.id) {
        const { error: slettTimerFeil } = await supabaseClient.from("hand_time").delete().eq("id", timerUtleggData.id);
        if (slettTimerFeil) throw slettTimerFeil;
      }
    }
  });

  settFeltHvisFinnes("utgiftType", "");
  settFeltHvisFinnes("utgiftBelop", "0");
  settFeltHvisFinnes("utgiftKm", "0");
  settFeltHvisFinnes("utgiftKmPris", "3.50");

  visSkjulKjoringFelter();

  if (melding) {
    melding.textContent = "Utlegg lagret til faktura.";
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
  settDagensDato();
  settStandardTidHvisTom();

  const excelKnapp = document.getElementById("excelKnapp");
  if (excelKnapp) {
    excelKnapp.onclick = lagMvaExcel;
  }
});

window.lastTimer = lastTimer;
window.lagreTimer = lagreTimer;
window.settDagensDato = settDagensDato;
window.settStandardTidHvisTom = settStandardTidHvisTom;
window.tegnTimer = tegnTimer;
window.apneJobbDetalj = apneJobbDetalj;
window.lagreBildeFraJobbModal = lagreBildeFraJobbModal;
async function lastOppTimerBilde(timerId) {
  const filInputGalleri = document.getElementById("timerBildeGalleri");
  const filInputKamera = document.getElementById("timerBildeKamera");
  const tekstInput = document.getElementById("timerBildeTekst");

  const filer = [
    ...Array.from(filInputKamera?.files || []),
    ...Array.from(filInputGalleri?.files || [])
  ];

  if (!filer.length) return;

  for (const fil of filer) {
    await lastOppTimerBildeFraFil(timerId, fil, tekstInput?.value || "");
  }

  if (filInputKamera) filInputKamera.value = "";
  if (filInputGalleri) filInputGalleri.value = "";
  if (tekstInput) tekstInput.value = "";
}

window.addEventListener("load", function () {
  setTimeout(function () {
    if (!window.standardBilInitKoblet7035) {
      window.standardBilInitKoblet7035 = true;
      settStandardBilForInnloggetAnsatt();
    }
  }, 700);

  setTimeout(function () {
    settStandardBilForInnloggetAnsatt();
  }, 1800);
});

window.settStandardBilForInnloggetAnsatt = settStandardBilForInnloggetAnsatt;

/* RIL HARD FIX 2026-06-05:
   Fast bildepanel som dukker opp når en jobb åpnes.
   Dette er med vilje uavhengig av selve jobbdetaljvisningen,
   fordi detaljvisningen kan bli tegnet av annen kode. */
(function () {
  function rilTimerListe() {
    return Array.isArray(window.timer) ? window.timer : [];
  }

  function rilJobbTekst(t, i) {
    const kunde = (typeof kundeInfoForTimer === "function") ? kundeInfoForTimer(t) : { kundeNavn: t.kunde_navn || "" };
    return `${i + 1}: ${t.dato || ""} ${kunde.kundeNavn || t.kunde_navn || ""} ${t.start || ""}-${t.slutt || ""}`.trim();
  }

  function rilFinnTimerIdFraElement(el) {
    if (!el) return "";
    const direkte = el.dataset?.timerId || el.getAttribute?.("data-timer-id") || "";
    if (direkte) return direkte;

    const rad = el.closest?.("tr");
    const tabell = rad?.closest?.("table");
    if (rad && tabell) {
      const rader = Array.from(tabell.querySelectorAll("tbody tr"));
      let index = rader.indexOf(rad);
      if (index < 0) {
        index = Array.from(tabell.rows || []).indexOf(rad) - 1;
      }
      const t = rilTimerListe()[index];
      if (t?.id) return String(t.id);
    }

    return window.rilApenTimerId || "";
  }

  function rilLagPanelHvisMangler() {
    let panel = document.getElementById("rilFastBildePanel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "rilFastBildePanel";
    panel.style.cssText = [
      "display:none",
      "position:fixed",
      "left:12px",
      "right:12px",
      "bottom:12px",
      "z-index:2147483647",
      "background:#ffffff",
      "color:#111111",
      "border:3px solid #111111",
      "border-radius:14px",
      "box-shadow:0 8px 30px rgba(0,0,0,.35)",
      "padding:14px",
      "max-width:760px",
      "margin:0 auto",
      "font-family:Arial,sans-serif"
    ].join(";");

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;">
        <strong style="font-size:18px;">Bilder på denne jobben</strong>
        <button type="button" id="rilFastBildeLukk" style="padding:6px 10px;">Lukk</button>
      </div>
      <div style="display:grid;gap:8px;">
        <select id="rilFastBildeJobbValg" style="padding:8px;"></select>
        <div id="rilFastBildeGalleri" style="display:flex;flex-wrap:wrap;gap:8px;max-height:220px;overflow:auto;border:1px solid #ddd;border-radius:8px;padding:8px;">Laster bilder...</div>
        <input type="file" id="rilFastBildeFil" accept="image/*" multiple style="padding:8px;border:1px solid #aaa;border-radius:8px;">
        <input type="text" id="rilFastBildeTekst" placeholder="Bildetekst, valgfritt" style="padding:8px;border:1px solid #aaa;border-radius:8px;">
        <button type="button" id="rilFastBildeLagre" style="padding:12px;font-weight:700;font-size:16px;background:#111;color:#fff;border-radius:8px;">Lagre bilde(r) på jobben</button>
        <div id="rilFastBildeMelding" style="font-weight:700;"></div>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById("rilFastBildeLukk").onclick = function () {
      panel.style.display = "none";
    };

    document.getElementById("rilFastBildeLagre").onclick = async function () {
      await rilFastLagreBilde();
    };

    return panel;
  }

  function rilFyllJobbValg(valgtTimerId) {
    const select = document.getElementById("rilFastBildeJobbValg");
    if (!select) return;

    const liste = rilTimerListe();
    select.innerHTML = "";

    if (!liste.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Ingen jobber er lastet";
      select.appendChild(opt);
      return;
    }

    liste.forEach((t, i) => {
      const opt = document.createElement("option");
      opt.value = t.id || "";
      opt.textContent = rilJobbTekst(t, i);
      select.appendChild(opt);
    });

    if (valgtTimerId && Array.from(select.options).some(o => String(o.value) === String(valgtTimerId))) {
      select.value = String(valgtTimerId);
    }

    select.onchange = async function () {
      window.rilApenTimerId = select.value || "";
      if (typeof rilOppdaterFastBildeGalleri === "function") {
        await rilOppdaterFastBildeGalleri(window.rilApenTimerId);
      }
    };
  }

  async function rilVisFastBildePanel(timerId) {
    const panel = rilLagPanelHvisMangler();
    window.rilApenTimerId = timerId || window.rilApenTimerId || "";
    rilFyllJobbValg(window.rilApenTimerId);
    panel.style.display = "block";
    await rilOppdaterFastBildeGalleri(window.rilApenTimerId);
  }

  async function rilOppdaterFastBildeGalleri(timerId) {
    const galleri = document.getElementById("rilFastBildeGalleri");
    if (!galleri) return;

    if (!timerId) {
      galleri.innerHTML = "Velg en jobb først.";
      return;
    }

    if (typeof hentBilderForTimer !== "function") {
      galleri.innerHTML = "Bildevisning er ikke klar.";
      return;
    }

    const bilder = await hentBilderForTimer(timerId);
    if (!bilder.length) {
      galleri.innerHTML = "Ingen bilder på denne jobben ennå.";
      return;
    }

    galleri.innerHTML = bilder.map(function (b) {
      return `
        <a href="${b.url}" target="_blank" style="display:inline-block;color:#111;text-decoration:none;">
          <img src="${b.url}" alt="Bilde" style="width:110px;height:85px;object-fit:cover;border:1px solid #ddd;border-radius:8px;display:block;">
          <small>${b.tekst || "Åpne"}</small>
        </a>
      `;
    }).join("");
  }

  async function rilFastLagreBilde() {
    const select = document.getElementById("rilFastBildeJobbValg");
    const filInput = document.getElementById("rilFastBildeFil");
    const tekstInput = document.getElementById("rilFastBildeTekst");
    const melding = document.getElementById("rilFastBildeMelding");
    const knapp = document.getElementById("rilFastBildeLagre");

    const timerId = select?.value || window.rilApenTimerId || "";
    const filer = Array.from(filInput?.files || []);

    if (melding) melding.textContent = "";

    if (!timerId) {
      if (melding) melding.textContent = "Fant ikke hvilken jobb bildene skal legges på.";
      return;
    }

    if (!filer.length) {
      if (melding) melding.textContent = "Velg ett eller flere bilder først.";
      return;
    }

    try {
      if (knapp) knapp.disabled = true;
      if (melding) melding.textContent = "Lagrer " + filer.length + " bilde(r)...";

      for (const fil of filer) {
        if (typeof lastOppTimerBildeFraFil === "function") {
          await lastOppTimerBildeFraFil(timerId, fil, tekstInput?.value || "");
        } else {
          const rentFilnavn = String(fil.name || "bilde.jpg").replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "_");
          const filsti = timerId + "/" + Date.now() + "_" + rentFilnavn;
          const { error: uploadError } = await supabaseClient.storage.from("timer-bilder").upload(filsti, fil, { cacheControl: "3600", upsert: false });
          if (uploadError) throw new Error("Opplasting feilet: " + uploadError.message);
          const { error: dbError } = await supabaseClient.from("hand_time_bilde").insert({ timer_id: timerId, filnavn: fil.name, filsti: filsti, bildetekst: tekstInput?.value || "" });
          if (dbError) throw new Error("Bildet ble lastet opp, men ikke lagret på jobben: " + dbError.message);
        }
      }

      if (filInput) filInput.value = "";
      if (tekstInput) tekstInput.value = "";

      if (typeof window.lastTimer === "function") await window.lastTimer();
      if (typeof rilOppdaterFastBildeGalleri === "function") await rilOppdaterFastBildeGalleri(timerId);
      if (typeof oppdaterJobbModalBilder === "function") await oppdaterJobbModalBilder(timerId);
      if (melding) melding.textContent = filer.length + " bilde(r) er lagret på jobben.";
    } catch (e) {
      console.error("Feil ved fast bildepanel:", e);
      if (melding) melding.textContent = "Bildet ble ikke lagret: " + (e.message || JSON.stringify(e));
    } finally {
      if (knapp) knapp.disabled = false;
    }
  }

  document.addEventListener("click", function (e) {
    const knapp = e.target?.closest?.("button, a, [role='button']");
    if (!knapp) return;

    const tekst = (knapp.textContent || knapp.value || "").trim().toLowerCase();
    const erApne = tekst === "åpne" || tekst === "apne" || tekst.includes("åpne jobb") || tekst.includes("apne jobb");
    if (!erApne) return;

    const timerId = rilFinnTimerIdFraElement(knapp);
    window.rilApenTimerId = timerId || window.rilApenTimerId || "";

    setTimeout(function () {
      rilVisFastBildePanel(window.rilApenTimerId);
    }, 150);
  }, true);

  window.rilVisFastBildePanel = rilVisFastBildePanel;
  window.rilFastLagreBilde = rilFastLagreBilde;
  window.rilOppdaterFastBildeGalleri = rilOppdaterFastBildeGalleri;
})();


window.lastOppTimerBildeFraFil = lastOppTimerBildeFraFil;
