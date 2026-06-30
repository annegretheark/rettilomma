console.log("NY hand-timer.js er lastet - ansatt jobber fix 20260627");

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



// RIL FIX: Tildelt/standard bil settes av hand-auth.js etter innlogging.
// hand-timer.js skal bare bruke window.aktivBilId/localStorage, ikke slå opp og overstyre bil.


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
  // Viktig: For timeregistrering/utlegg skal firma_id komme fra hand_ansatt.
  // Ikke stol på localStorage/aktivFirmaId først, fordi den kan være gammel etter brukerbytte.
  const ansattId = window.innloggetAnsattId || localStorage.getItem("innloggetAnsattId") || localStorage.getItem("ansattId") || "";
  const epost = String(window.innloggetEpost || localStorage.getItem("innloggetEpost") || "").toLowerCase();
  const userId = window.innloggetUserId || window.authUserId || localStorage.getItem("innloggetUserId") || localStorage.getItem("authUserId") || "";

  if (!window.supabaseClient) return "";

  try {
    let data = null;
    let error = null;

    if (ansattId) {
      const r = await supabaseClient
        .from("hand_ansatt")
        .select("id, firma_id, epost, user_id, aktiv")
        .eq("id", ansattId)
        .limit(1)
        .maybeSingle();
      data = r.data;
      error = r.error;
    }

    if ((!data || error) && userId) {
      const r = await supabaseClient
        .from("hand_ansatt")
        .select("id, firma_id, epost, user_id, aktiv")
        .eq("user_id", userId)
        .neq("aktiv", false)
        .limit(1)
        .maybeSingle();
      data = r.data;
      error = r.error;
    }

    if ((!data || error) && epost) {
      const r = await supabaseClient
        .from("hand_ansatt")
        .select("id, firma_id, epost, user_id, aktiv")
        .ilike("epost", epost)
        .neq("aktiv", false)
        .limit(1)
        .maybeSingle();
      data = r.data;
      error = r.error;
    }

    if (!error && data?.firma_id) {
      window.innloggetAnsattId = data.id || window.innloggetAnsattId;
      window.aktivFirmaId = data.firma_id;
      localStorage.setItem("innloggetAnsattId", data.id || "");
      localStorage.setItem("aktivFirmaId", data.firma_id);
      return data.firma_id;
    }
  } catch (e) {
    console.warn("Kunne ikke finne firma_id for timer-tilgang:", e);
  }

  // Fallback kun for admin/eldre sider.
  if (typeof window.hentAktivFirmaId === "function") {
    const id = window.hentAktivFirmaId();
    if (id) return id;
  }
  const direkte = window.aktivFirmaId || window.firmaData?.id || window.firma?.id || localStorage.getItem("aktivFirmaId") || localStorage.getItem("firmaId") || localStorage.getItem("firma_id") || "";
  return direkte || "";
}

async function hentRiktigInnloggetAnsattIdForLagring() {
  if (!window.supabaseClient) return window.innloggetAnsattId || "";

  let authUser = null;
  try {
    const r = await supabaseClient.auth.getUser();
    authUser = r?.data?.user || null;
  } catch (_) {}

  const userId = String(
    authUser?.id ||
    window.innloggetUserId ||
    window.authUserId ||
    localStorage.getItem("innloggetUserId") ||
    localStorage.getItem("authUserId") ||
    ""
  ).trim();

  const epost = String(
    authUser?.email ||
    window.innloggetEpost ||
    localStorage.getItem("innloggetEpost") ||
    localStorage.getItem("handInnloggetEpost") ||
    ""
  ).trim().toLowerCase();

  async function sett(rad) {
    if (!rad || !rad.id) return "";
    window.innloggetAnsattId = String(rad.id);
    if (rad.firma_id) window.aktivFirmaId = String(rad.firma_id);
    try {
      localStorage.setItem("innloggetAnsattId", String(rad.id));
      localStorage.setItem("ansattId", String(rad.id));
      if (rad.firma_id) localStorage.setItem("aktivFirmaId", String(rad.firma_id));
    } catch (_) {}
    return String(rad.id);
  }

  try {
    if (userId) {
      const r = await supabaseClient
        .from("hand_ansatt")
        .select("id, firma_id, epost, user_id, rolle, aktiv")
        .eq("user_id", userId)
        .neq("aktiv", false)
        .limit(1)
        .maybeSingle();
      if (!r.error && r.data) return await sett(r.data);
    }

    if (epost) {
      const r = await supabaseClient
        .from("hand_ansatt")
        .select("id, firma_id, epost, user_id, rolle, aktiv")
        .ilike("epost", epost)
        .neq("aktiv", false)
        .limit(1)
        .maybeSingle();
      if (!r.error && r.data) return await sett(r.data);
    }
  } catch (e) {
    console.warn("Kunne ikke finne riktig innlogget ansatt for lagring:", e);
  }

  return window.innloggetAnsattId || localStorage.getItem("innloggetAnsattId") || localStorage.getItem("ansattId") || "";
}

function adminVilOverstyre(tekst) {
  if (!erAdmin) return false;

  return confirm(
    tekst +
    "\n\nDu er admin. Vil du overstyre og lagre likevel?"
  );
}


async function hentInnloggetAnsattKontekstForJobber() {
  let authUser = null;
  try {
    const r = await supabaseClient.auth.getUser();
    authUser = r && r.data && r.data.user ? r.data.user : null;
  } catch (e) {}

  const userId = String(
    (authUser && authUser.id) ||
    window.innloggetUserId ||
    window.authUserId ||
    localStorage.getItem("innloggetUserId") ||
    localStorage.getItem("authUserId") ||
    ""
  ).trim();

  const epost = String(
    (authUser && authUser.email) ||
    window.innloggetEpost ||
    localStorage.getItem("innloggetEpost") ||
    localStorage.getItem("handInnloggetEpost") ||
    ""
  ).trim().toLowerCase();

  const lagretId = String(
    window.innloggetAnsattId ||
    localStorage.getItem("innloggetAnsattId") ||
    localStorage.getItem("ansattId") ||
    ""
  ).trim();

  const funnet = [];
  const sett = new Set();

  function leggTil(rad) {
    if (!rad || !rad.id) return;
    const id = String(rad.id);
    if (sett.has(id)) return;
    sett.add(id);
    funnet.push(rad);
  }

  async function hent(filterFn) {
    try {
      let q = supabaseClient
        .from("hand_ansatt")
        .select("id, firma_id, epost, user_id, auth_id, auth_user_id, aktiv");
      q = filterFn(q);
      const r = await q.limit(20);
      if (!r.error && Array.isArray(r.data)) r.data.forEach(leggTil);
    } catch (e) {
      console.warn("Ansattoppslag hoppet over:", e);
    }
  }

  if (lagretId) await hent(q => q.eq("id", lagretId));
  if (userId) {
    await hent(q => q.eq("user_id", userId));
    await hent(q => q.eq("auth_id", userId));
    await hent(q => q.eq("auth_user_id", userId));
  }
  if (epost) {
    await hent(q => q.ilike("epost", epost));
    await hent(q => q.ilike("email", epost));
  }

  const aktiv = funnet.filter(r => r.aktiv !== false);
  const ansatte = aktiv.length ? aktiv : funnet;
  const valgt = ansatte[0] || null;

  if (valgt) {
    window.innloggetAnsattId = String(valgt.id);
    if (valgt.firma_id) window.aktivFirmaId = String(valgt.firma_id);
    if (epost) window.innloggetEpost = epost;
    if (userId) window.innloggetUserId = userId;
    try {
      localStorage.setItem("innloggetAnsattId", String(valgt.id));
      localStorage.setItem("ansattId", String(valgt.id));
      if (valgt.firma_id) localStorage.setItem("aktivFirmaId", String(valgt.firma_id));
      if (epost) localStorage.setItem("innloggetEpost", epost);
      if (userId) localStorage.setItem("innloggetUserId", userId);
    } catch (e) {}
  }

  return {
    ansattIder: ansatte.map(r => String(r.id)).filter(Boolean),
    firmaIder: ansatte.map(r => String(r.firma_id || "")).filter(Boolean),
    userId,
    epost
  };
}

async function hentEgneJobberForAnsatt() {
  const ctx = await hentInnloggetAnsattKontekstForJobber();
  const melding = hentTimerMelding();

  if (!ctx.ansattIder.length && !ctx.userId && !ctx.epost) {
    if (melding) melding.textContent = "Fant ikke innlogget ansatt. Sjekk at brukeren finnes i hand_ansatt med riktig user_id eller e-post.";
    return [];
  }

  // Prøv de mest sannsynlige koblingene først. Noen installasjoner lagrer hand_time.ansatt_id
  // som hand_ansatt.id, andre eldre rader kan være koblet via bruker_id/user_id eller e-post.
  const forsok = [];
  if (ctx.ansattIder.length) forsok.push(q => q.in("ansatt_id", ctx.ansattIder));
  if (ctx.userId) forsok.push(q => q.eq("bruker_id", ctx.userId));
  if (ctx.userId) forsok.push(q => q.eq("user_id", ctx.userId));
  if (ctx.epost) forsok.push(q => q.ilike("ansatt_epost", ctx.epost));
  if (ctx.epost) forsok.push(q => q.ilike("epost", ctx.epost));

  let sisteFeil = null;
  for (const filterFn of forsok) {
    try {
      let q = supabaseClient
        .from("hand_time")
        .select("*")
        .order("dato", { ascending: false });
      q = filterFn(q);
      const r = await q;
      if (!r.error && Array.isArray(r.data) && r.data.length) return r.data;
      if (!r.error && Array.isArray(r.data) && r.data.length === 0) continue;
      if (r.error) sisteFeil = r.error;
    } catch (e) {
      sisteFeil = e;
    }
  }

  // Siste fallback: hent firmaets timer og filtrer lokalt på alle kjente identifikatorer.
  // Dette redder visningen hvis kolonnenavnene varierer mellom installasjoner.
  try {
    const firmaId = ctx.firmaIder[0] || window.aktivFirmaId || localStorage.getItem("aktivFirmaId") || "";
    if (firmaId) {
      const r = await supabaseClient
        .from("hand_time")
        .select("*")
        .eq("firma_id", firmaId)
        .order("dato", { ascending: false });
      if (!r.error && Array.isArray(r.data)) {
        const ids = new Set(ctx.ansattIder.map(String));
        const egne = r.data.filter(t =>
          ids.has(String(t.ansatt_id || "")) ||
          (ctx.userId && [t.bruker_id, t.user_id, t.auth_id, t.auth_user_id].some(v => String(v || "") === ctx.userId)) ||
          (ctx.epost && [t.ansatt_epost, t.epost, t.bruker_epost, t.opprettet_av_epost].some(v => String(v || "").toLowerCase() === ctx.epost))
        );
        return egne;
      }
      if (r.error) sisteFeil = r.error;
    }
  } catch (e) {
    sisteFeil = e;
  }

  if (sisteFeil) console.warn("Kunne ikke hente egne jobber for ansatt:", sisteFeil);
  return [];
}

async function lastTimer() {
  const melding = hentTimerMelding();

  if (!window.supabaseClient) {
    if (melding) melding.textContent = "Supabase er ikke lastet.";
    return;
  }

  const adminAktiv = window.erAdmin === true || (typeof erAdmin !== "undefined" && erAdmin === true);
  const systemadminAktiv = window.erSystemadmin === true;
  const firmaId = await hentFirmaIdForTimerTilgang();

  let data = [];
  let error = null;

  if (adminAktiv || systemadminAktiv) {
    let query = supabaseClient
      .from("hand_time")
      .select("*")
      .order("dato", { ascending: false });

    if (adminAktiv && !systemadminAktiv && firmaId) {
      query = query.eq("firma_id", firmaId);
    }

    const res = await query;
    data = res.data || [];
    error = res.error || null;
  } else {
    data = await hentEgneJobberForAnsatt();
  }

  if (error) {
    if (melding) melding.textContent = "Feil ved henting av timer/jobber: " + error.message;
    console.error("Feil ved henting av timer/jobber:", error);
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


// RIL FIX 20260624: Bruk samme valgte kunde for varer/utlegg som for timeregistrering.
// Noen kundenedtrekk har kundenr/tekst som value, mens fakturalinje trenger faktisk kunde-id.
function hentValgtKundeRobust() {
  const valg = document.getElementById("kundeValg");
  const opt = valg && valg.options ? valg.options[valg.selectedIndex] : null;

  const lister = [];
  if (Array.isArray(window.kunder)) lister.push(window.kunder);
  if (Array.isArray(window.handKunder)) lister.push(window.handKunder);
  if (Array.isArray(window.lastKunderListe)) lister.push(window.lastKunderListe);
  if (Array.isArray(window.handAdminKunder)) lister.push(window.handAdminKunder);

  const liste = [];
  lister.forEach(arr => arr.forEach(k => { if (k && !liste.includes(k)) liste.push(k); }));

  const kandidater = [
    valg ? valg.value : "",
    opt ? opt.value : "",
    opt && opt.dataset ? opt.dataset.id : "",
    opt && opt.dataset ? opt.dataset.kundeId : "",
    opt && opt.dataset ? opt.dataset.kundenr : "",
    opt && opt.dataset ? opt.dataset.kundeNr : ""
  ];

  if (opt && opt.textContent) {
    const tekst = String(opt.textContent).trim();
    kandidater.push(tekst);
    const m = tekst.match(/^\s*([^\s\-–—]+)\s*[-–—]\s*/);
    if (m) kandidater.push(m[1]);
  }

  const norm = x => String(x || "").trim().toLowerCase();
  const sett = new Set(kandidater.map(norm).filter(Boolean));

  let funnet = null;
  if (typeof window.finnKundeFraValg === "function") {
    try { funnet = window.finnKundeFraValg(valg ? valg.value : ""); } catch (e) { funnet = null; }
  }
  if (!funnet) {
    funnet = liste.find(k => {
      const verdier = [
        k.id, k.kunde_id, k.kundenr, k.kunde_nr, k.nr, k.kundnr, k.kundenummer,
        k.navn, k.firmanavn, k.firma_navn
      ].map(norm).filter(Boolean);
      return verdier.some(v => sett.has(v));
    }) || null;
  }

  // Siste fallback: når nedtrekket faktisk har id som value, men window.kunder ikke er ferdig oppdatert.
  if (!funnet && opt && opt.value) {
    const tekst = String(opt.textContent || "").trim();
    const m = tekst.match(/^\s*([^\s\-–—]+)\s*[-–—]\s*(.*)$/);
    funnet = {
      id: opt.dataset?.id || opt.dataset?.kundeId || opt.value,
      kundenr: opt.dataset?.kundenr || opt.dataset?.kundeNr || (m ? m[1] : ""),
      navn: m ? m[2] : tekst
    };
  }

  return funnet;
}


function hentTimeprisFraKundeProsjekt(kundeObjekt, prosjektId) {
  function num(v) {
    const n = Number(String(v == null ? '' : v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  if (prosjektId && typeof window.handHentProsjektTimepris === 'function') {
    const p = num(window.handHentProsjektTimepris(prosjektId));
    if (p > 0) return p;
  }
  if (kundeObjekt && typeof window.handHentKundeTimepris === 'function') {
    const k = num(window.handHentKundeTimepris(kundeObjekt));
    if (k > 0) return k;
  }
  if (kundeObjekt) {
    const k2 = num(kundeObjekt.timepris ?? kundeObjekt.time_pris ?? kundeObjekt.kunde_timepris ?? kundeObjekt.faktura_timepris);
    if (k2 > 0) return k2;
  }
  return num(document.getElementById('timepris')?.value);
}

async function lagreTimer() {
  const ansattId = await hentRiktigInnloggetAnsattIdForLagring();
  const melding = hentTimerMelding();

  if (melding) melding.textContent = "";

  const kundeValg = document.getElementById("kundeValg");

  if (!kundeValg) {
    if (melding) melding.textContent = "Fant ikke kundevalg i skjemaet.";
    return;
  }

  const valgtKunde = hentValgtKundeRobust();

  const valgtKundeNr = typeof hentKundeNr === "function"
    ? hentKundeNr(valgtKunde)
    : (valgtKunde?.kundenr || valgtKunde?.kunde_nr || "");

  const valgtKundeId = valgtKunde?.id || null;
  const valgtProsjektId = tekstFraFelt("prosjektValg") || null;
  const valgtTimepris = hentTimeprisFraKundeProsjekt(valgtKunde, valgtProsjektId);
  settFeltHvisFinnes("timepris", String(valgtTimepris || 0));

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
    timepris: valgtTimepris,
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

  const firmaId = await hentFirmaIdForTimerTilgang();
  if (!firmaId) {
    if (melding) melding.textContent = "Fant ikke firma for innlogget ansatt. Sjekk at hand_ansatt.user_id og firma_id er satt.";
    return;
  }

  const supabaseTimer = {
    firma_id: firmaId,
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
    // Bilag/kvitteringer for utlegg skal ikke vises som vanlige jobb-bilder.
    if (!String(sti).includes("/utlegg_") && !String(sti).includes("utlegg_")) {
      const url = sti ? await lagSignertTimerBildeUrl(sti) : (t.bilde_url || "");
      if (url) bilder.push({ url, tekst: "" });
    }
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
      const stiTekst = String(sti || "");
      const tekstTekst = String(b.bildetekst || "");
      // Hold bilag-bilder separat fra jobb-bilder.
      if ((stiTekst.includes("/utlegg_") || stiTekst.includes("utlegg_") || tekstTekst.startsWith("Bilag utlegg #"))) continue;
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
      <img src="${b.url}" alt="Bilde" style="width:80px;height:115px;object-fit:cover;border:1px solid #ddd;border-radius:10px;display:block;">
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

  settFeltHvisFinnes("utgiftType", "");
  settFeltHvisFinnes("utgiftBelop", "");

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

  const valgtKunde = hentValgtKundeRobust();

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

  const { error } = await supabaseClient
    .from("hand_faktura_vare")
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




async function hentOgVisUtleggForValgtKunde(timerId = null) {
  const liste = document.getElementById("utleggListe");
  if (!liste) return;

  // RIL FIX: Utlegg skal vises per jobb, ikke samlet på kunden.
  // Når ingen jobb er valgt/opprettet enda, viser vi ikke gamle åpne utlegg for kunden.
  const aktivTimerId = String(
    timerId ||
    window.rilApenTimerId ||
    window.aktivTimerId ||
    window.aktivJobbId ||
    ""
  ).trim();

  if (!aktivTimerId) {
    liste.innerHTML = "Utlegg legges på aktuell jobb. Gamle åpne utlegg på kunden vises ikke her.";
    return;
  }

  liste.innerHTML = "Laster utlegg for aktuell jobb...";

  const { data, error } = await supabaseClient
    .from("hand_faktura_utlegg")
    .select("id, timer_id, type, beskrivelse, belop, fakturert, fakturanr, created_at")
    .eq("timer_id", aktivTimerId)
    .eq("fakturert", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Feil ved henting av utlegg for jobb:", error);
    liste.innerHTML = "Kunne ikke hente utlegg for aktuell jobb: " + error.message;
    return;
  }

  const utlegg = data || [];
  if (!utlegg.length) {
    liste.innerHTML = "Ingen åpne utlegg på aktuell jobb.";
    return;
  }

  const total = utlegg.reduce((sum, u) => sum + Number(u.belop || 0), 0);
  const formatterBelop = new Intl.NumberFormat("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // Bilag/kvitteringsbilder for utlegg: maks ett bilde per utlegg.
  // Jobb-bilder ligger fortsatt separat og kan ha flere bilder.
  const bilderPerUtlegg = {};
  for (const u of utlegg) {
    try {
      const key = String(u.id);
      const bilagTekst = "Bilag utlegg #" + key;
      let bildeRader = [];

      let res = await supabaseClient
        .from("hand_time_bilde")
        .select("filsti,bilde_path,bilde_url,bildetekst")
        .eq("bildetekst", bilagTekst)
        .limit(1);

      if (!res.error && res.data && res.data.length) {
        bildeRader = res.data;
      } else {
        res = await supabaseClient
          .from("hand_time_bilde")
          .select("filsti,bilde_path,bilde_url,bildetekst")
          .ilike("filsti", "%/utlegg_" + key + "/%")
          .limit(1);
        if (!res.error && res.data) bildeRader = res.data;
      }

      for (const b of (bildeRader || []).slice(0, 1)) {
        const sti = b.filsti || b.bilde_path || "";
        let url = sti ? await lagSignertTimerBildeUrl(sti) : "";
        if (!url && b.bilde_url) url = b.bilde_url;
        if (!url) continue;
        bilderPerUtlegg[key] = [{ url, tekst: "Bilag" }];
      }
    } catch (e) {
      console.warn("Hoppet over bilagsbilde for utlegg:", e);
    }
  }

  liste.innerHTML = `
    <div style="margin:4px 0 6px 0;font-size:0.95em;font-weight:600;color:inherit;">Åpne utlegg på aktuell jobb: ${utlegg.length} stk - ${formatterBelop.format(total)} kr</div>
    <div style="display:grid;gap:2px;font-size:0.95em;color:inherit;">
      ${utlegg.map(u => {
        const typeTekst = (u.type || "Utlegg").replace(/^./, c => c.toUpperCase());
        const datoTekst = u.created_at ? new Date(u.created_at).toLocaleDateString("no-NO") : "";
        const belopTekst = formatterBelop.format(Number(u.belop || 0)) + " kr";
        const bilag = bilderPerUtlegg[String(u.id)] || [];
        const bilagHtml = bilag.length ? `
          <div style="grid-column:1 / -1;display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 6px 22px;">
            ${bilag.map(b => `
              <a href="${b.url}" target="_blank" rel="noopener" title="${b.tekst || "Åpne bilag"}" style="display:inline-flex;align-items:center;gap:4px;text-decoration:none;color:inherit;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:3px 6px;background:rgba(128,128,128,.08);">
                <img src="${b.url}" alt="Bilag" style="width:42px;height:42px;object-fit:cover;border-radius:4px;border:1px solid rgba(128,128,128,.25);" />
                <span>Bilag</span>
              </a>
            `).join("")}
          </div>` : "";
        return `
          <div style="padding:2px 0;color:inherit;display:grid;grid-template-columns:minmax(90px,1fr) auto auto;gap:10px;align-items:center;border-bottom:1px solid rgba(128,128,128,.25);">
            <div style="font-weight:400;color:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🧾 ${typeTekst}</div>
            <div style="font-weight:400;color:inherit;white-space:nowrap;text-align:right;">${belopTekst}</div>
            <button type="button" class="slett-utlegg-knapp" data-utlegg-id="${u.id}" title="Slett ${typeTekst} ${datoTekst}" style="padding:0 4px;background:transparent;color:inherit;border:0;cursor:pointer;font-size:1em;line-height:1;">🗑️</button>
            ${bilagHtml}
          </div>
        `;
      }).join("")}
    </div>
  `;

  liste.querySelectorAll(".slett-utlegg-knapp").forEach(knapp => {
    knapp.onclick = async function () {
      const id = knapp.dataset.utleggId;
      if (!id) return;
      if (!confirm("Slette dette utlegget fra aktuell jobb? Merk: lønnsrad må eventuelt slettes fra timelisten/lønn hvis den allerede er opprettet.")) return;

      const { error: slettFeil } = await supabaseClient
        .from("hand_faktura_utlegg")
        .delete()
        .eq("id", id);

      if (slettFeil) {
        alert("Kunne ikke slette utlegg: " + slettFeil.message);
        return;
      }

      await hentOgVisUtleggForValgtKunde(aktivTimerId);
    };
  });
}

function kobleUtleggKundeOppdatering() {
  const kundeValg = document.getElementById("kundeValg");
  if (!kundeValg || kundeValg.dataset.utleggOppdateringKoblet === "1") return;

  kundeValg.dataset.utleggOppdateringKoblet = "1";
  kundeValg.addEventListener("change", function () {
    setTimeout(function () {
      hentOgVisUtleggForValgtKunde();
    }, 100);
  });
}

async function finnEllerOpprettAktivUtleggTimer({ firmaId, ansattId, dato, valgtKunde, valgtKundeNr }) {
  const aktivTimerId = String(
    window.rilApenTimerId ||
    window.aktivTimerId ||
    window.aktivJobbId ||
    localStorage.getItem("rilAktivUtleggTimerId") ||
    ""
  ).trim();

  async function sjekkTimerId(timerId) {
    if (!timerId) return null;
    try {
      const r = await supabaseClient
        .from("hand_time")
        .select("*")
        .eq("id", timerId)
        .limit(1)
        .maybeSingle();
      if (!r.error && r.data) return r.data;
    } catch (e) {}
    return null;
  }

  const eksisterendeAktiv = await sjekkTimerId(aktivTimerId);
  if (eksisterendeAktiv && String(eksisterendeAktiv.kunde_id || "") === String(valgtKunde.id || "")) {
    window.rilApenTimerId = String(eksisterendeAktiv.id);
    window.aktivTimerId = String(eksisterendeAktiv.id);
    window.aktivJobbId = String(eksisterendeAktiv.id);
    localStorage.setItem("rilAktivUtleggTimerId", String(eksisterendeAktiv.id));
    return eksisterendeAktiv;
  }

  // Finn en åpen utleggsjobb for samme ansatt/kunde/dato i stedet for å lage ny hver gang.
  try {
    const r = await supabaseClient
      .from("hand_time")
      .select("*")
      .eq("ansatt_id", ansattId)
      .eq("kunde_id", valgtKunde.id)
      .eq("dato", dato)
      .eq("start", "00:00")
      .eq("slutt", "00:00")
      .eq("timer", 0)
      .ilike("beskrivelse", "Utlegg/refusjon:%")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!r.error && r.data && r.data.id) {
      window.rilApenTimerId = String(r.data.id);
      window.aktivTimerId = String(r.data.id);
      window.aktivJobbId = String(r.data.id);
      localStorage.setItem("rilAktivUtleggTimerId", String(r.data.id));
      return r.data;
    }
  } catch (e) {
    console.warn("Kunne ikke finne eksisterende utleggsjobb:", e);
  }

  const timerUtlegg = {
    firma_id: firmaId,
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
    km: 0,
    km_pris: 0,
    sum_km: 0,
    diett: 0,
    parkering: 0,
    billetter: 0,
    bompenger: 0,
    andre_utlegg: 0,
    andre_utlegg_beskrivelse: "Samlejobb for utlegg/refusjon",
    sum: 0,
    fakturerbar: false,
    beskrivelse: "Utlegg/refusjon: samlejobb"
  };

  let timerRes = await supabaseClient
    .from("hand_time")
    .insert([timerUtlegg])
    .select()
    .maybeSingle();

  if (timerRes.error && /firma_id|prosjekt_id/i.test(String(timerRes.error.message || ""))) {
    const { firma_id, prosjekt_id, ...timerUtleggUtenEkstraKolonner } = timerUtlegg;
    timerRes = await supabaseClient
      .from("hand_time")
      .insert([timerUtleggUtenEkstraKolonner])
      .select()
      .maybeSingle();
  }

  if (timerRes.error) throw new Error(timerRes.error.message || "Kunne ikke opprette utleggsjobb.");

  if (timerRes.data?.id) {
    window.rilApenTimerId = String(timerRes.data.id);
    window.aktivTimerId = String(timerRes.data.id);
    window.aktivJobbId = String(timerRes.data.id);
    localStorage.setItem("rilAktivUtleggTimerId", String(timerRes.data.id));
  }

  return timerRes.data;
}

async function lagreUtleggTilFaktura() {
  const melding = hentTimerMelding();
  const kundeValg = document.getElementById("kundeValg");

  if (!kundeValg || !kundeValg.value) {
    alert("Velg kunde først.");
    return;
  }

  const valgtKunde = hentValgtKundeRobust();

  if (!valgtKunde || !valgtKunde.id) {
    alert("Fant ikke valgt kunde.");
    return;
  }

  const ansattId = await hentRiktigInnloggetAnsattIdForLagring();
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
    kmPris = tallFraFelt("utgiftKmPris") || 5.30;
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

  const firmaId = await hentFirmaIdForTimerTilgang();
  if (!firmaId) {
    alert("Fant ikke firma for innlogget ansatt. Sjekk at hand_ansatt.user_id og firma_id er satt.");
    return;
  }

  let timerData;
  try {
    timerData = await finnEllerOpprettAktivUtleggTimer({ firmaId, ansattId, dato, valgtKunde, valgtKundeNr });
  } catch (e) {
    alert("Utlegget ble ikke lagret, fordi jobb for utlegg ikke kunne opprettes/finnes: " + (e.message || e));
    return;
  }

  const fakturaUtleggRad = {
    firma_id: firmaId,
    kunde_id: valgtKunde.id,
    timer_id: timerData?.id || null,
    type: type,
    beskrivelse: type,
    belop: belop,
    fakturert: false,
    fakturanr: null
  };

  let fakturaRes = await supabaseClient
    .from("hand_faktura_utlegg")
    .insert(fakturaUtleggRad)
    .select()
    .maybeSingle();

  // Fallback hvis databasen mangler firma_id/timer_id-kolonne.
  if (fakturaRes.error && /firma_id|timer_id/i.test(String(fakturaRes.error.message || ""))) {
    const { firma_id, timer_id, ...utenEkstra } = fakturaUtleggRad;
    fakturaRes = await supabaseClient
      .from("hand_faktura_utlegg")
      .insert(utenEkstra)
      .select()
      .maybeSingle();
  }

  if (fakturaRes.error) {
    alert("Feil ved lagring av utlegg til faktura: " + fakturaRes.error.message);
    return;
  }

  // Hvis timer_id ikke ble med i insert fordi eldre tabell/REST-cache, prøv update etterpå.
  if (timerData?.id && fakturaRes.data?.id) {
    try {
      await supabaseClient
        .from("hand_faktura_utlegg")
        .update({ timer_id: timerData.id })
        .eq("id", fakturaRes.data.id);
    } catch (e) {
      console.warn("Kunne ikke koble utlegg til time:", e);
    }
  }

  // Oppdater samlejobben med sumfelt for dette utlegget, uten å opprette ny jobb.
  try {
    const oppdatering = {
      km: type === "kjoring" ? km : 0,
      km_pris: type === "kjoring" ? kmPris : 0,
      sum_km: type === "kjoring" ? belop : 0,
      diett: type === "diett" ? belop : 0,
      parkering: type === "parkering" ? belop : 0,
      billetter: type === "billetter" ? belop : 0,
      bompenger: type === "bompenger" ? belop : 0,
      andre_utlegg: !["kjoring", "diett", "parkering", "billetter", "bompenger"].includes(type) ? belop : 0,
      andre_utlegg_beskrivelse: "Utlegg/refusjon: " + type,
      beskrivelse: "Utlegg/refusjon: samlejobb"
    };
    await supabaseClient.from("hand_time").update(oppdatering).eq("id", timerData.id);
  } catch (e) {
    console.warn("Kunne ikke oppdatere samlejobb for utlegg:", e);
  }

  if (timerData?.id && fakturaRes.data?.id) {
    try {
      await lastOppBilagBildeForUtlegg(timerData.id, fakturaRes.data.id);
    } catch (e) {
      console.error("Bildefeil på utlegg:", e);
      alert("Utlegget ble lagret, men bilaget/bildet feilet: " + (e.message || JSON.stringify(e)));
    }
  }

  settFeltHvisFinnes("utgiftType", "");
  settFeltHvisFinnes("utgiftBelop", "");
  settFeltHvisFinnes("utgiftKm", "");
  settFeltHvisFinnes("utgiftKmPris", "5.30");

  visSkjulKjoringFelter();

  if (melding) {
    melding.textContent = "Utlegg lagret til faktura og lønnsslipp.";
  }

  await lastTimer();
  await hentOgVisUtleggForValgtKunde(timerData?.id || null);
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
  const kmPris = tallFraFelt("utgiftKmPris") || 5.30;

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

function nullstillUtleggFelterBlank() {
  settFeltHvisFinnes("utgiftType", "");
  settFeltHvisFinnes("utgiftBelop", "");
  settFeltHvisFinnes("utgiftKm", "");
  settFeltHvisFinnes("utgiftKmPris", "5.30");
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
  nullstillUtleggFelterBlank();
  kobleUtleggKundeOppdatering();
  setTimeout(hentOgVisUtleggForValgtKunde, 500);
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
window.lagreUtleggTilFaktura = lagreUtleggTilFaktura;
window.hentOgVisUtleggForValgtKunde = hentOgVisUtleggForValgtKunde;
window.kobleUtleggKundeOppdatering = kobleUtleggKundeOppdatering;
window.kobleUtleggKnapp = kobleUtleggKnapp;
window.kobleKjoringBeregning = kobleKjoringBeregning;
window.nullstillUtleggFelterBlank = nullstillUtleggFelterBlank;
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

async function lastOppBilagBildeForUtlegg(timerId, utleggId) {
  const filInputGalleri = document.getElementById("utleggBilagBilde");
  const filInputKamera = document.getElementById("utleggBilagKamera");

  // Ett bilag-bilde per utlegg. Bruk egne bilag-felt, ikke jobb-bilde-feltene.
  const fil = (filInputKamera?.files && filInputKamera.files[0])
    || (filInputGalleri?.files && filInputGalleri.files[0])
    || null;

  if (!fil) return 0;
  if (!timerId || !utleggId) throw new Error("Mangler jobb eller utlegg for bilag.");

  const rentFilnavn = String(fil.name || "bilag.jpg")
    .replaceAll(" ", "_")
    .replace(/[æøåÆØÅ]/g, function (bokstav) {
      return { æ: "ae", ø: "o", å: "a", Æ: "Ae", Ø: "O", Å: "A" }[bokstav] || bokstav;
    })
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const filsti = String(timerId) + "/utlegg_" + String(utleggId) + "/" + Date.now() + "_" + rentFilnavn;

  const { error: uploadError } = await supabaseClient
    .storage
    .from("timer-bilder")
    .upload(filsti, fil, {
      cacheControl: "3600",
      upsert: false,
      contentType: fil.type || "image/jpeg"
    });

  if (uploadError) throw new Error("Opplasting av bilag feilet: " + uploadError.message);

  const bildeUrl = await lagSignertTimerBildeUrl(filsti);
  const bildeRad = {
    timer_id: timerId,
    filnavn: fil.name || rentFilnavn,
    filsti: filsti,
    bilde_path: filsti,
    bilde_url: bildeUrl || null,
    bildetekst: "Bilag utlegg #" + String(utleggId)
  };

  let { error: dbError } = await supabaseClient
    .from("hand_time_bilde")
    .insert([bildeRad]);

  if (dbError && /bilde_path|bilde_url/i.test(String(dbError.message || ""))) {
    const enklereRad = {
      timer_id: timerId,
      filnavn: fil.name || rentFilnavn,
      filsti: filsti,
      bildetekst: "Bilag utlegg #" + String(utleggId)
    };
    const res = await supabaseClient.from("hand_time_bilde").insert([enklereRad]);
    dbError = res.error;
  }

  if (dbError) {
    try { await supabaseClient.storage.from("timer-bilder").remove([filsti]); } catch (e) {}
    throw new Error("Bilaget ble lastet opp, men ikke lagret: " + dbError.message);
  }

  if (filInputKamera) filInputKamera.value = "";
  if (filInputGalleri) filInputGalleri.value = "";

  return 1;
}
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
      "left:6px",
      "right:6px",
      "bottom:6px",
      "z-index:2147483647",
      "background:#ffffff",
      "color:#111111",
      "border:3px solid #111111",
      "border-radius:10px",
      "box-shadow:0 8px 30px rgba(0,0,0,.35)",
      "padding:8px",
      "max-width:760px",
      "max-height:calc(100vh - 12px)",
      "overflow:auto",
      "margin:0 auto",
      "font-family:Arial,sans-serif"
    ].join(";");

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;">
        <strong style="font-size:16px;line-height:1.1;">Bilder på denne jobben</strong>
        <button type="button" id="rilFastBildeLukk" style="padding:4px 8px;line-height:1.1;">Lukk</button>
      </div>
      <div style="display:grid;gap:5px;">
        <select id="rilFastBildeJobbValg" style="padding:6px;min-width:0;width:100%;"></select>
        <div id="rilFastBildeGalleri" style="display:flex;flex-wrap:wrap;gap:5px;max-height:120px;overflow:auto;border:1px solid #ddd;border-radius:6px;padding:5px;">Laster bilder...</div>
        <input type="file" id="rilFastBildeFil" accept="image/*" multiple style="padding:6px;border:1px solid #aaa;border-radius:6px;min-width:0;width:100%;box-sizing:border-box;">
        <input type="text" id="rilFastBildeTekst" placeholder="Bildetekst, valgfritt" style="padding:6px;border:1px solid #aaa;border-radius:6px;min-width:0;width:100%;box-sizing:border-box;">
        <button type="button" id="rilFastBildeLagre" style="padding:8px;font-weight:700;font-size:15px;background:#111;color:#fff;border-radius:6px;line-height:1.15;">Lagre bilde(r) på jobben</button>
        <div id="rilFastBildeMelding" style="font-weight:700;min-height:1.1em;line-height:1.15;"></div>
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
          <img src="${b.url}" alt="Bilde" style="width:82px;height:60px;object-fit:cover;border:1px solid #ddd;border-radius:6px;display:block;">
          <small style="display:block;max-width:82px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.tekst || "Åpne"}</small>
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
    }, 80);
  }, true);

  window.rilVisFastBildePanel = rilVisFastBildePanel;
  window.rilFastLagreBilde = rilFastLagreBilde;
  window.rilOppdaterFastBildeGalleri = rilOppdaterFastBildeGalleri;
})();


window.lastOppTimerBildeFraFil = lastOppTimerBildeFraFil;


/* RIL FIX 20260626B: Stabil Min bil / fyll lager uten blinking.
   - Fjerner den gamle blinkende vakten som skjulte/viste siden flere ganger.
   - Bruker eksisterende hand-biler.js-funksjoner når de finnes.
   - Sørger for at bil-lager og fyll-bil-listen faktisk vises og at knappene kobles. */
(function () {
  function $(id) { return document.getElementById(id); }

  function vis(el) {
    if (!el) return;
    el.hidden = false;
    el.style.display = "";
    el.style.visibility = "visible";
    el.classList && el.classList.remove("skjult", "hidden", "modul-skjult", "ril-starter");
    el.removeAttribute && el.removeAttribute("aria-hidden");
  }

  function skjul(el) {
    if (!el) return;
    el.hidden = true;
    el.style.display = "none";
    el.classList && el.classList.add("skjult", "hidden");
    el.setAttribute && el.setAttribute("aria-hidden", "true");
  }

  function sikreBilerSide() {
    let side = $("bilerSide");
    if (side && $("bilLagerBilValg") && $("bilLagerFyllListe")) return side;

    const app = $("appSide") || document.body;
    if (!side) {
      side = document.createElement("section");
      side.id = "bilerSide";
      side.className = "kort skjult";
      side.setAttribute("data-modul", "biler");
      app.appendChild(side);
    }

    if (!$("bilLagerBilValg") || !$("bilLagerFyllListe")) {
      side.innerHTML = `
        <h2>Min bil / lager</h2>
        <p>Velg bil og fyll varer til bilen.</p>
        <div id="bilMelding" class="melding"></div>
        <div id="bilListe"></div>
        <hr>
        <h3>Bil-lager</h3>
        <p>Velg bil én gang. Skriv antall på flere varer i listen og lagre alt samtidig.</p>
        <div class="rad">
          <div>
            <label for="bilLagerBilValg">Bil som skal fylles</label>
            <select id="bilLagerBilValg"><option value="">Velg bil</option></select>
          </div>
          <div>
            <label for="bilLagerHentetAv">Hvem henter varene</label>
            <input id="bilLagerHentetAv" type="text" placeholder="Navn på den som henter" autocomplete="off">
          </div>
        </div>
        <details id="fyllBilPanel" open>
          <summary><strong>Fyll bil</strong></summary>
          <p class="info">Listen viser varenr, varenavn, innpris, utpris, hovedlager, minimum og MVA.</p>
          <div style="display:flex;gap:8px;align-items:center;margin:8px 0 10px 0;flex-wrap:wrap;">
            <button id="sendBilLagerBestillingKnapp" type="button" class="secondary">Send bestilling til admin</button>
          </div>
          <div id="bilLagerFyllListe"></div>
          <button id="lagreBilLagerListeKnapp" type="button" style="display:none; visibility:hidden;">Godkjenn og legg på bil</button>
        </details>
        <h4>Varer som ligger på bil</h4>
        <div id="bilLagerListe"></div>
      `;
    }
    return side;
  }

  function kall(fn, delay) {
    if (typeof window[fn] !== "function") return;
    setTimeout(function () {
      try { window[fn](); } catch (e) { console.warn("Min bil init feilet:", fn, e); }
    }, delay || 0);
  }

  function velgAktivBilHvisMulig() {
    const select = $("bilLagerBilValg");
    const aktiv = window.aktivBilId || localStorage.getItem("aktivBilId") || $("bilValg")?.value || "";
    if (select && aktiv && Array.from(select.options || []).some(o => String(o.value) === String(aktiv))) {
      select.value = String(aktiv);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function sikreSendTilAdminKnappSynlig() {
    const panel = $("fyllBilPanel");
    const liste = $("bilLagerFyllListe");
    if (!panel || !liste) return;

    let knapp = $("sendBilLagerBestillingKnapp");
    if (!knapp) {
      knapp = document.createElement("button");
      knapp.id = "sendBilLagerBestillingKnapp";
      knapp.type = "button";
      knapp.className = "secondary";
      knapp.textContent = "Send bestilling til admin";
    }

    // Legg knappen OVER varelisten, ikke under. Ellers forsvinner den når listen er lang.
    let knappRad = $("sendBilLagerBestillingRad");
    if (!knappRad) {
      knappRad = document.createElement("div");
      knappRad.id = "sendBilLagerBestillingRad";
      knappRad.style.cssText = "display:flex;gap:8px;align-items:center;margin:8px 0 10px 0;flex-wrap:wrap;";
    }

    if (knapp.parentElement !== knappRad) knappRad.appendChild(knapp);
    if (liste.parentElement && knappRad.nextSibling !== liste) {
      liste.parentElement.insertBefore(knappRad, liste);
    }

    knapp.hidden = false;
    knapp.disabled = false;
    knapp.style.display = "";
    knapp.style.visibility = "visible";
    knapp.textContent = "Send bestilling til admin";

    // Koble mot eksisterende bestillingslogikk hvis den finnes.
    if (knapp.dataset.rilSendAdminKoblet !== "1") {
      knapp.dataset.rilSendAdminKoblet = "1";
      knapp.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        const mulige = [
          "sendBilLagerBestillingTilAdmin",
          "sendBilLagerBestilling",
          "lagreBilLagerBestilling",
          "opprettBilLagerBestilling",
          "handSendBilLagerBestillingTilAdmin",
          "handSendBilBestillingTilAdmin"
        ];
        for (const navn of mulige) {
          if (typeof window[navn] === "function") {
            try { window[navn](); return false; }
            catch (err) { console.error("Send til admin feilet:", navn, err); alert("Kunne ikke sende til admin: " + (err.message || err)); return false; }
          }
        }
        // Siste fallback: noen eldre filer bruker lagre-knappen til samme bestilling.
        const lagre = $("lagreBilLagerListeKnapp");
        if (lagre && typeof lagre.click === "function") { lagre.click(); return false; }
        alert("Fant ikke bestillingslogikken. Sjekk at hand-biler.js er lastet.");
        return false;
      });
    }
  }

  function initBilLagerStabilt() {
    const fyllPanel = $("fyllBilPanel");
    if (fyllPanel) fyllPanel.open = true;

    const fyllListe = $("bilLagerFyllListe");
    if (fyllListe) {
      fyllListe.hidden = false;
      fyllListe.style.display = "";
      fyllListe.style.visibility = "visible";
    }

    sikreSendTilAdminKnappSynlig();

    [
      "lastBiler",
      "lastBilerOgBilLager",
      "handLastBiler",
      "fyllAlleBilvalg",
      "fyllBilvalg",
      "fyllBilvalgTrygt",
      "fyllBilLagerVareValg",
      "lastBilLager",
      "hentBilLager",
      "tegnFyllBilListe",
      "kobleBilLagerBestillingKnappRobust",
      "kobleBilLagerListeKnappRobust",
      "hardKobleBilLagerKnapp"
    ].forEach((fn, i) => kall(fn, i * 40));

    setTimeout(velgAktivBilHvisMulig, 250);
    setTimeout(function () {
      kall("lastBilLager", 0);
      kall("tegnFyllBilListe", 60);
      kall("kobleBilLagerBestillingKnappRobust", 80);
      kall("kobleBilLagerListeKnappRobust", 100);
      setTimeout(sikreSendTilAdminKnappSynlig, 160);
      setTimeout(sikreSendTilAdminKnappSynlig, 500);
    }, 450);
  }

  function visMinBil(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }

    const app = $("appSide") || document.body;
    vis(app);

    [
      "timerSide", "jobberSide", "fravaerSide", "tilbudSide", "backupSide", "fakturaSide",
      "varerSide", "kundeSide", "kunderSide", "ansattSide", "firmaSide",
      "testSide", "testpanelSide", "lonnPanel", "lonnSide", "bilBestillingerSide",
      "adminBilBestillinger", "adminBilBestillingerPanel", "modulerSide", "sysadminPanelSide",
      "adminSide", "adminKonsollSide"
    ].forEach(id => skjul($(id)));

    const side = sikreBilerSide();
    vis(side);

    const h = $("handSideOverskrift") || document.querySelector("#appSide h1");
    if (h) h.textContent = "Min bil / fyll lager";
    const h2 = side.querySelector("h2");
    if (h2) h2.textContent = "Min bil / lager";

    initBilLagerStabilt();
    return false;
  }

  function sikreKnapp() {
    let knapp = $("visBilerKnapp");
    if (!knapp) {
      const topplinje = document.querySelector(".topplinje") || document.querySelector("nav") || document.body;
      knapp = document.createElement("button");
      knapp.id = "visBilerKnapp";
      knapp.type = "button";
      const adminMeny = $("adminMenyGruppe") || $("adminMenyKnapp");
      if (adminMeny && adminMeny.parentElement) adminMeny.parentElement.insertBefore(knapp, adminMeny);
      else topplinje.appendChild(knapp);
    }
    knapp.type = "button";
    knapp.textContent = "Min bil / fyll lager";
    knapp.setAttribute("data-modul", "biler");
    knapp.setAttribute("data-role", "ansatt-bil");
    const admin = window.erAdmin === true && localStorage.getItem("rilAdminModus") === "ja";
    if (admin) {
      knapp.classList && knapp.classList.add("skjult", "hidden");
      knapp.hidden = true;
      knapp.style.display = "none";
    } else {
      knapp.classList && knapp.classList.remove("skjult", "hidden", "modul-skjult");
      knapp.hidden = false;
      knapp.style.display = "";
      knapp.style.visibility = "visible";
    }
    knapp.onclick = visMinBil;
  }

  // Kjør én gang. Ingen blinkende intervall/vakt.
  function start() { sikreKnapp(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.addEventListener("load", start, { once: true });

  // Fang klikk i capture-fasen slik gammel/annen navigasjon ikke rekker å blinke/skjule lageret.
  document.addEventListener("click", function (e) {
    const b = e.target && e.target.closest ? e.target.closest("#visBilerKnapp,[data-role='ansatt-bil']") : null;
    if (!b) return;
    return visMinBil(e);
  }, true);

  window.handGjenopprettMinBilKnapp = sikreKnapp;
  window.handSikreSendTilAdminKnapp = sikreSendTilAdminKnappSynlig;
  window.handOpenMinBil = visMinBil;
  window.handVisMinBilAnsatt = visMinBil;
})();


/* RIL FIX 20260626C: Tving synlig "Send bestilling til admin"-knapp i Fyll bil.
   Grunnen til at knappen kan forsvinne er at andre scripts tegner om bilLagerFyllListe etterpå.
   Denne observerer området og legger en tydelig knapp tilbake over listen hver gang. */
(function () {
  function $(id) { return document.getElementById(id); }

  function kallSendBestilling(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const mulige = [
      // Bruk den nye hand_bil_bestilling-flyten først.
      // Den gamle hand_lager_bestilling-flyten kan feile på eldre/ulike kolonnenavn.
      'opprettBilLagerBestillingListe',
      'sendBilLagerBestillingTilAdmin',
      'sendBilLagerBestilling',
      'lagreBilLagerBestilling',
      'opprettBilLagerBestilling',
      'handSendBilLagerBestillingTilAdmin',
      'handSendBilBestillingTilAdmin'
    ];

    for (const navn of mulige) {
      if (typeof window[navn] === 'function') {
        try {
          const res = window[navn](event);
          if (res && typeof res.catch === 'function') {
            res.catch(function (err) {
              console.error('Send bestilling til admin feilet:', navn, err);
              alert('Kunne ikke sende bestilling til admin: ' + (err.message || err));
            });
          }
          return false;
        } catch (err) {
          console.error('Send bestilling til admin feilet:', navn, err);
          alert('Kunne ikke sende bestilling til admin: ' + (err.message || err));
          return false;
        }
      }
    }

    const gammel = $('sendBilLagerBestillingKnapp');
    if (gammel && gammel !== event?.currentTarget && typeof gammel.click === 'function') {
      gammel.click();
      return false;
    }

    alert('Fant ikke bestillingslogikken. Sjekk at hand-biler.js og hand-lager-bestilling.js er lastet.');
    return false;
  }

  function finnFyllBilAnker() {
    return $('bilLagerFyllListe') || $('bilLagerListe') || $('bilerSide') || document.body;
  }

  function sikreSynligSendAdminKnapp() {
    const anker = finnFyllBilAnker();
    if (!anker) return;

    let rad = $('rilSendBestillingTilAdminRad');
    if (!rad) {
      rad = document.createElement('div');
      rad.id = 'rilSendBestillingTilAdminRad';
      rad.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0 10px 0;position:sticky;top:0;z-index:20;background:inherit;padding:4px 0;';
    }

    let knapp = $('rilSendBestillingTilAdminSynligKnapp');
    if (!knapp) {
      knapp = document.createElement('button');
      knapp.id = 'rilSendBestillingTilAdminSynligKnapp';
      knapp.type = 'button';
      knapp.className = 'secondary';
      knapp.textContent = 'Send bestilling til admin';
      knapp.style.cssText = 'display:inline-block !important;visibility:visible !important;opacity:1 !important;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:600;';
      knapp.onclick = kallSendBestilling;
    }

    // Ikke bruk samme id som eldre knapp, men sørg for at eldre knapp også kobles dersom den finnes.
    const gammel = $('sendBilLagerBestillingKnapp');
    if (gammel) {
      gammel.hidden = false;
      gammel.style.display = 'inline-block';
      gammel.style.visibility = 'visible';
      gammel.style.opacity = '1';
      gammel.textContent = 'Send bestilling til admin';
      if (!gammel.dataset.rilSynligSendKoblet) {
        gammel.dataset.rilSynligSendKoblet = '1';
        gammel.onclick = kallSendBestilling;
      }
    }

    if (knapp.parentElement !== rad) rad.appendChild(knapp);

    const fyllListe = $('bilLagerFyllListe');
    if (fyllListe && fyllListe.parentNode) {
      if (rad.parentElement !== fyllListe.parentNode || rad.nextSibling !== fyllListe) {
        fyllListe.parentNode.insertBefore(rad, fyllListe);
      }
    } else if (anker.parentNode) {
      if (rad.parentElement !== anker.parentNode || rad.nextSibling !== anker) {
        anker.parentNode.insertBefore(rad, anker);
      }
    }

    rad.hidden = false;
    rad.style.display = 'flex';
    rad.style.visibility = 'visible';
    knapp.hidden = false;
    knapp.disabled = false;
  }

  window.rilSikreSynligSendAdminKnapp = sikreSynligSendAdminKnapp;

  window.addEventListener('load', function () {
    [100, 400, 900, 1600, 3000].forEach(function (ms) {
      setTimeout(sikreSynligSendAdminKnapp, ms);
    });
  });

  document.addEventListener('click', function () {
    setTimeout(sikreSynligSendAdminKnapp, 80);
    setTimeout(sikreSynligSendAdminKnapp, 400);
  }, true);

  const obs = new MutationObserver(function () {
    clearTimeout(window.__rilSendAdminObsTimer);
    window.__rilSendAdminObsTimer = setTimeout(sikreSynligSendAdminKnapp, 80);
  });

  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      obs.observe(document.body, { childList: true, subtree: true });
      sikreSynligSendAdminKnapp();
    });
  }
})();

// Mobile compact gallery patch
document.addEventListener('DOMContentLoaded',()=>{
 const p=document.getElementById('rilFastBildePanel');
 if(p) p.style.display='none';
});
