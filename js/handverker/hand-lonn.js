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

function lonnPad2(verdi) {
  return String(verdi).padStart(2, "0");
}

function lonnDatoRen(dato) {
  return String(dato || "").slice(0, 10);
}

function lonnAntallDagerIFellesPeriode(fraDato, tilDato, periodeFra, periodeTil) {
  const fra = lonnDatoRen(fraDato);
  const til = lonnDatoRen(tilDato || fraDato);
  if (!fra || !til || !periodeFra || !periodeTil) return 0;

  const startTekst = fra > periodeFra ? fra : periodeFra;
  const sluttTekst = til < periodeTil ? til : periodeTil;
  if (sluttTekst < startTekst) return 0;

  const start = new Date(startTekst + "T00:00:00");
  const slutt = new Date(sluttTekst + "T00:00:00");
  if (Number.isNaN(start.getTime()) || Number.isNaN(slutt.getTime())) return 0;

  return Math.max(1, Math.floor((slutt.getTime() - start.getTime()) / 86400000) + 1);
}

function lonnFravaerStandard() {
  return {
    typer: {},
    linjer: [],
    permisjonUtenLonnDager: 0,
    permisjonUtenLonnTimer: 0,
    flexiSaldo: 0
  };
}

function lonnFravaerNavn(type) {
  const t = String(type || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  if (t.includes("ferie")) return "Ferie";
  if (t.includes("egenmelding")) return "Egenmelding";
  if (t.includes("sykemelding")) return "Sykemelding";
  if (t.includes("permisjon") && t.includes("uten") && t.includes("lonn")) return "Permisjon uten lønn";
  if (t.includes("permisjon") && t.includes("med") && t.includes("lonn")) return "Permisjon med lønn";
  if (t.includes("avspasering")) return "Avspasering";
  return type || "Annet";
}

function lonnErAvvistFravaer(status) {
  return String(status || "").toLowerCase().includes("avvist");
}


async function hentLonnskjoringMap(lonnData) {
  const map = new Map();
  const rader = Array.isArray(lonnData) ? lonnData : [];
  const ansattIds = [...new Set(rader.map(r => r.ansattId).filter(Boolean).map(String))];
  if (!ansattIds.length || !window.supabaseClient) return map;

  const perioder = [...new Set(rader.map(r => `${r.periodeFra}|${r.periodeTil}`))];
  const fraDatoer = [...new Set(rader.map(r => r.periodeFra).filter(Boolean))];
  const tilDatoer = [...new Set(rader.map(r => r.periodeTil).filter(Boolean))];

  try {
    let query = supabaseClient
      .from("hand_lonnskjoring")
      .select("*")
      .in("ansatt_id", ansattIds);

    if (fraDatoer.length === 1) query = query.eq("periode_fra", fraDatoer[0]);
    if (tilDatoer.length === 1) query = query.eq("periode_til", tilDatoer[0]);

    const { data, error } = await query;
    if (error) {
      console.warn("Kunne ikke sjekke lønnskjøring. Kjør SQL for lonnskjoring hvis original/kopi skal låses:", error);
      return map;
    }

    (data || []).forEach(rad => {
      const key = `${rad.ansatt_id}|${String(rad.periode_fra).slice(0, 10)}|${String(rad.periode_til).slice(0, 10)}`;
      map.set(key, rad);
    });
  } catch (e) {
    console.warn("Lønnskjøring-sjekk feilet:", e);
  }

  return map;
}

async function registrerLonnskjoringHvisNy(r, filnavn = null) {
  if (!r || !r.ansattId || !window.supabaseClient) return;

  try {
    const rad = {
      ansatt_id: r.ansattId,
      periode_fra: r.periodeFra,
      periode_til: r.periodeTil,
      brutto: lonnRund(r.brutto),
      netto: lonnRund(r.netto),
      ansatt_navn: r.ansattNavn || null,
      filnavn_sist: filnavn || null,
      opprettet: new Date().toISOString()
    };

    let { error } = await supabaseClient.from("hand_lonnskjoring").insert([rad]);

    if (error) {
      const tekst = String(error.message || "").toLowerCase();
      if (tekst.includes("duplicate") || tekst.includes("unique") || tekst.includes("violates")) return;

      if (tekst.includes("opprettet")) {
        const rad2 = { ...rad };
        delete rad2.opprettet;
        const res2 = await supabaseClient.from("hand_lonnskjoring").insert([rad2]);
        error = res2.error;
      }

      if (error) console.warn("Kunne ikke registrere lønnskjøring:", error);
    }
  } catch (e) {
    console.warn("Registrering av lønnskjøring feilet:", e);
  }
}

function lonnskjoringKey(r) {
  return `${r.ansattId}|${String(r.periodeFra || "").slice(0, 10)}|${String(r.periodeTil || "").slice(0, 10)}`;
}

function lonnskjoringLokalKey(r) {
  return "lonnskjoring_" + lonnskjoringKey(r);
}

function lonnskjoringFinnesLokalt(r) {
  try {
    return window.localStorage && localStorage.getItem(lonnskjoringLokalKey(r)) === "1";
  } catch (e) {
    return false;
  }
}

function lonnskjoringLagreLokalt(r) {
  try {
    if (window.localStorage) localStorage.setItem(lonnskjoringLokalKey(r), "1");
  } catch (e) {
    // Ignorer hvis nettleseren blokkerer localStorage.
  }
}

async function lonnskjoringFinnesIDatabase(r) {
  if (!r || !r.ansattId || !r.periodeFra || !r.periodeTil || !window.supabaseClient) return false;

  try {
    const { data, error } = await supabaseClient
      .from("hand_lonnskjoring")
      .select("id")
      .eq("ansatt_id", r.ansattId)
      .eq("periode_fra", String(r.periodeFra).slice(0, 10))
      .eq("periode_til", String(r.periodeTil).slice(0, 10))
      .limit(1);

    if (error) {
      console.warn("Kunne ikke sjekke om lønnsslippen finnes fra før:", error);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  } catch (e) {
    console.warn("Direkte KOPI-sjekk feilet:", e);
    return false;
  }
}

async function finnesLonnskjoringFraFor(r) {
  if (!r || !r.ansattId || !r.periodeFra || !r.periodeTil || !window.supabaseClient) return false;

  try {
    const { data, error } = await supabaseClient
      .from("hand_lonnskjoring")
      .select("id")
      .eq("ansatt_id", r.ansattId)
      .eq("periode_fra", String(r.periodeFra).slice(0, 10))
      .eq("periode_til", String(r.periodeTil).slice(0, 10))
      .limit(1);

    if (error) {
      console.warn("Kunne ikke sjekke om lønnsslipp er kopi:", error);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  } catch (e) {
    console.warn("Kopi-sjekk for lønnsslipp feilet:", e);
    return false;
  }
}

async function hentFravaerOgFlexiMap(periode, ansattIds) {
  const map = new Map();
  const ids = (ansattIds || []).filter(Boolean).map(String);
  ids.forEach(id => map.set(id, lonnFravaerStandard()));
  if (!ids.length || !window.supabaseClient) return map;

  try {
    const { data, error } = await supabaseClient
      .from("hand_fravaer")
      .select("ansatt_id,type,fra_dato,til_dato,timer_pr_dag,status")
      .in("ansatt_id", ids)
      .lte("fra_dato", periode.til)
      .gte("til_dato", periode.fra);

    if (error) {
      console.warn("Kunne ikke hente fravær til lønnsslipp:", error);
    } else {
      (data || [])
        .filter(r => !lonnErAvvistFravaer(r.status))
        .forEach(r => {
          const ansattId = String(r.ansatt_id || "");
          if (!map.has(ansattId)) map.set(ansattId, lonnFravaerStandard());
          const info = map.get(ansattId);
          const navn = lonnFravaerNavn(r.type);
          const dager = lonnAntallDagerIFellesPeriode(r.fra_dato, r.til_dato, periode.fra, periode.til);
          const timerPrDag = lonnTall(r.timer_pr_dag || 7.5) || 7.5;
          if (dager <= 0) return;

          info.typer[navn] = lonnRund((info.typer[navn] || 0) + dager);
          if (navn === "Permisjon uten lønn") {
            info.permisjonUtenLonnDager = lonnRund(info.permisjonUtenLonnDager + dager);
            info.permisjonUtenLonnTimer = lonnRund(info.permisjonUtenLonnTimer + dager * timerPrDag);
          }
        });
    }
  } catch (e) {
    console.warn("Fravær ble ikke hentet til lønnsslipp:", e);
  }

  try {
    const { data, error } = await supabaseClient
      .from("hand_timebank")
      .select("ansatt_id,timer,dato")
      .in("ansatt_id", ids)
      .lte("dato", periode.til);

    if (error) {
      console.warn("Kunne ikke hente timebank til lønnsslipp:", error);
    } else {
      (data || []).forEach(r => {
        const ansattId = String(r.ansatt_id || "");
        if (!map.has(ansattId)) map.set(ansattId, lonnFravaerStandard());
        const info = map.get(ansattId);
        info.flexiSaldo = lonnRund(info.flexiSaldo + lonnTall(r.timer));
      });
    }
  } catch (e) {
    console.warn("Timebank ble ikke hentet til lønnsslipp:", e);
  }

  map.forEach(info => {
    info.linjer = Object.entries(info.typer)
      .filter(([, dager]) => lonnTall(dager) > 0)
      .map(([type, dager]) => ({ type, dager: lonnRund(dager) }));
  });

  return map;
}

function lonnFirmaUtenVipps(firma) {
  const f = { ...(firma || {}) };
  [
    "vipps", "vippsnr", "vipps_nr", "vipps_nummer", "vipps_mottaker",
    "firmaVippsNummer", "firmaVippsMottaker", "vippsnummer", "vippsMottaker"
  ].forEach(k => { if (k in f) f[k] = ""; });
  return f;
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
  const fraDirekte = hentVerdiFraElement("lonnFraDato") || hentVerdiFraElement("lonnDatoFra");
  const tilDirekte = hentVerdiFraElement("lonnTilDato") || hentVerdiFraElement("lonnDatoTil");

  if (fraDirekte || tilDirekte) {
    return {
      fra: fraDirekte || standard.fra,
      til: tilDirekte || standard.til
    };
  }

  const maned = Number(hentVerdiFraElement("lonnManed") || 0);
  const aar = Number(hentVerdiFraElement("lonnAar") || 0);

  if (aar > 1900 && maned >= 1 && maned <= 12) {
    const sisteDag = new Date(aar, maned, 0).getDate();
    return {
      fra: `${aar}-${lonnPad2(maned)}-01`,
      til: `${aar}-${lonnPad2(maned)}-${lonnPad2(sisteDag)}`
    };
  }

  return standard;
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

function hentLonnstype(ansatt) {
  return String(ansatt?.avlonningstype || ansatt?.lonnstype || ansatt?.lonn_type || "time").toLowerCase();
}

function harFastlonn(ansatt) {
  const type = hentLonnstype(ansatt);
  return type === "fast" || type === "fast_provisjon" || type === "fastlønn" || type === "fastlonn";
}

function harTimelonn(ansatt) {
  const type = hentLonnstype(ansatt);
  return type === "time" || type === "time_provisjon" || type === "timelønn" || type === "timelonn" || !harFastlonn(ansatt);
}

function harProvisjon(ansatt) {
  const type = hentLonnstype(ansatt);
  return type === "provisjon" || type === "fast_provisjon" || type === "time_provisjon" || lonnTall(ansatt?.provisjon_prosent) > 0;
}

function hentFastlonn(ansatt) {
  return lonnTall(ansatt?.fastlonn || ansatt?.fast_lonn || ansatt?.maanedslonn || ansatt?.manedslonn);
}

function hentBonus(ansatt) {
  return lonnTall(
    ansatt?.bonus ??
    ansatt?.bonus_belop ??
    ansatt?.bonusbelop ??
    ansatt?.bonus_maned ??
    ansatt?.bonus_mnd ??
    ansatt?.manedsbonus ??
    ansatt?.maanedsbonus ??
    0
  );
}

function hentProvisjonProsent(ansatt) {
  return lonnTall(
    ansatt?.provisjon_prosent ??
    ansatt?.provisjonsprosent ??
    ansatt?.provisjon_pct ??
    ansatt?.provisjon_percent ??
    ansatt?.provisjon ??
    0
  );
}

function hentManueltProvisjonsgrunnlag(ansatt) {
  return lonnTall(
    ansatt?.provisjon_omsetning_manuell ??
    ansatt?.provisjon_grunnlag_manuell ??
    ansatt?.provisjonsgrunnlag_manuell ??
    ansatt?.manuelt_provisjonsgrunnlag ??
    ansatt?.manuell_omsetning ??
    ansatt?.omsetning_manuell ??
    0
  );
}

function hentProvisjonGrunnlagType(ansatt) {
  return String(
    ansatt?.provisjon_grunnlag ??
    ansatt?.provisjonsgrunnlag ??
    ansatt?.provisjon_grunnlag_type ??
    "egne_fakturerte_timer"
  ).toLowerCase();
}

function erFakturertTimerad(t) {
  return (
    t.fakturert === true ||
    t.er_fakturert === true ||
    t.faktura_id ||
    t.faktura_nr ||
    t.fakturanr ||
    t.fakturert_dato
  );
}

function finnTimerBelop(t, ansatt) {
  const direkte = lonnTall(
    t.belop ||
    t.belop_eks_mva ||
    t.sum_eks_mva ||
    t.sum ||
    t.total ||
    t.faktura_belop
  );

  if (direkte > 0) return direkte;

  const totalTimer = hentTimerAntall(t);
  const overtid50 = hentOvertid50(t);
  const overtid100 = hentOvertid100(t);
  const ordinare = Math.max(0, totalTimer - overtid50 - overtid100);
  const pris = lonnTall(t.timepris || t.timesats || ansatt?.timepris || ansatt?.timelonn || 0);

  return lonnRund(
    ordinare * pris +
    overtid50 * pris * 1.5 +
    overtid100 * pris * 2
  );
}

function erSkattTrekk(navn) {
  const ren = String(navn || "").toLowerCase();
  return ren.includes("skatt") || ren.includes("forskuddstrekk") || ren.includes("skattetrekk");
}

function erEkstraSkattTrekk(navn) {
  return String(navn || "").toLowerCase().includes("ekstra");
}

async function hentAnsattTrekkMap(ansattIds) {
  const map = new Map();
  const ids = (ansattIds || []).filter(Boolean);
  if (!ids.length) return map;

  const { data, error } = await supabaseClient
    .from("hand_ansatt_trekk")
    .select("*, trekk_typer(navn)")
    .in("ansatt_id", ids);

  if (error) {
    console.warn("Kunne ikke hente ansatt_trekk:", error);
    return map;
  }

  (data || [])
    .filter(t => t.aktiv !== false)
    .forEach(t => {
      const ansattId = String(t.ansatt_id || "");
      if (!map.has(ansattId)) map.set(ansattId, []);
      const navn = t.trekk_typer?.navn || t.navn || t.trekk_navn || "Trekk";
      map.get(ansattId).push({
        id: t.id,
        navn,
        belop: lonnTall(t.belop),
        prosent: lonnTall(t.prosent),
        metode: t.trekk_metode || (t.prosent ? "prosent" : "belop")
      });
    });

  return map;
}

function beregnTrekkLinjer(brutto, trekkListe, ansatt) {
  const linjer = [];

  (trekkListe || []).forEach(t => {
    const erProsent = String(t.metode || "").toLowerCase() === "prosent" || lonnTall(t.prosent) > 0;
    const verdi = erProsent ? lonnTall(t.prosent) : lonnTall(t.belop);
    if (verdi <= 0) return;

    const belop = erProsent ? lonnRund(brutto * verdi / 100) : lonnRund(verdi);
    linjer.push({
      navn: t.navn || "Trekk",
      belop,
      prosent: erProsent ? verdi : null,
      erSkatt: erSkattTrekk(t.navn),
      erEkstraSkatt: erEkstraSkattTrekk(t.navn)
    });
  });

  // Bakoverkompatibilitet hvis gamle skattefelt fortsatt brukes på ansatt.
  if (!linjer.some(l => l.erSkatt && !l.erEkstraSkatt)) {
    const gammelSkatt = beregnSkatt(brutto, ansatt);
    if (gammelSkatt > 0) linjer.push({ navn: "Forskuddstrekk", belop: gammelSkatt, erSkatt: true });
  }

  const gammelEkstraSkatt = lonnTall(ansatt?.ekstra_skatt || ansatt?.ekstraskatt);
  if (gammelEkstraSkatt > 0 && !linjer.some(l => l.erEkstraSkatt)) {
    linjer.push({ navn: "Ekstra skatt", belop: gammelEkstraSkatt, erSkatt: true, erEkstraSkatt: true });
  }

  return linjer;
}

function opprettLonnGruppe(ansatt, ansattId, periode) {
  return {
    ansatt,
    ansattId,
    ansattNavn: hentAnsattNavn(ansatt, ansattId),
    kontonr: ansatt.kontonr || "",
    periodeFra: periode.fra,
    periodeTil: periode.til,
    lonnstype: hentLonnstype(ansatt),
    timer: 0,
    ordinareTimer: 0,
    overtid50Timer: 0,
    overtid100Timer: 0,
    ordinarlonn: 0,
    overtid50Lonn: 0,
    overtid100Lonn: 0,
    fastlonn: 0,
    provisjonGrunnlag: 0,
    provisjonProsent: hentProvisjonProsent(ansatt),
    provisjon: 0,
    bonus: hentBonus(ansatt),
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
    ekstraSkatt: 0,
    andreTrekk: 0,
    trekkLinjer: [],
    netto: 0,
    fravaer: lonnFravaerStandard(),
    permisjonUtenLonnTrekk: 0,
    timerIds: []
  };
}

async function hentOgBeregnLonn() {
  const periode = hentLonnPeriode();

  const [timerRes, ansatteRes] = await Promise.all([
    supabaseClient.from("hand_time").select("*"),
    supabaseClient.from("hand_ansatt").select("*")
  ]);

  if (timerRes.error) throw new Error(timerRes.error.message);
  if (ansatteRes.error) throw new Error(ansatteRes.error.message);

  const valgtAnsattId = hentVerdiFraElement("lonnAnsattValg");
  const ansatte = ansatteRes.data || [];
  fyllLonnAnsattValg(ansatte);

  const ansatteFiltrert = ansatte.filter(a => !valgtAnsattId || String(a.id) === String(valgtAnsattId));
  const ansatteMap = new Map(ansatte.map(a => [String(a.id), a]));

  const timerader = (timerRes.data || [])
    .filter(t => datoInnenforPeriode(t, periode.fra, periode.til))
    .filter(t => !erUtbetalt(t))
    .filter(t => !valgtAnsattId || String(t.ansatt_id) === String(valgtAnsattId));

  const ansattIdsForLonn = ansatteFiltrert.map(a => a.id).filter(Boolean);
  const trekkMap = await hentAnsattTrekkMap(ansattIdsForLonn);
  const fravaerFlexiMap = await hentFravaerOgFlexiMap(periode, ansattIdsForLonn);
  const grupper = new Map();

  function hentGruppe(ansattId) {
    const id = String(ansattId || "");
    if (!id) return null;
    const ansatt = ansatteMap.get(id) || {};
    if (!grupper.has(id)) grupper.set(id, opprettLonnGruppe(ansatt, id, periode));
    return grupper.get(id);
  }

  // Opprett grupper også for fastlønn/provisjon/bonus selv om det ikke finnes timer.
  ansatteFiltrert.forEach(ansatt => {
    const fast = hentFastlonn(ansatt);
    const bonus = hentBonus(ansatt);
    const prov = hentProvisjonProsent(ansatt);
    const manuell = hentManueltProvisjonsgrunnlag(ansatt);
    if (fast > 0 || bonus > 0 || prov > 0 || manuell > 0) {
      hentGruppe(ansatt.id);
    }
  });

  timerader.forEach(t => {
    const ansattId = String(t.ansatt_id || "");
    const g = hentGruppe(ansattId);
    if (!g) return;

    const ansatt = g.ansatt || {};
    const totalTimer = hentTimerAntall(t);
    const overtid50 = hentOvertid50(t);
    const overtid100 = hentOvertid100(t);
    const ordinare = Math.max(0, totalTimer - overtid50 - overtid100);

    const timelonn = hentTimelonn(ansatt, t);
    const km = finnKmGodtgjorelse(t);
    const andreUtlegg = finnAndreUtlegg(t);
    const timerBelop = finnTimerBelop(t, ansatt);

    g.timer += totalTimer;
    g.ordinareTimer += ordinare;
    g.overtid50Timer += overtid50;
    g.overtid100Timer += overtid100;

    if (harTimelonn(ansatt)) {
      g.ordinarlonn += ordinare * timelonn;
      g.overtid50Lonn += overtid50 * timelonn * 1.5;
      g.overtid100Lonn += overtid100 * timelonn * 2;
    }

    const grunnlagType = hentProvisjonGrunnlagType(ansatt);
    if (harProvisjon(ansatt)) {
      if (grunnlagType.includes("egen") || grunnlagType.includes("hand_time")) {
        // Bruk fakturerte timer hvis de er merket fakturert. Hvis ingen er merket ennå,
        // brukes førte timer som grunnlag slik at provisjon kan beregnes før faktura kjøres.
        if (erFakturertTimerad(t) || !timerader.some(x => String(x.ansatt_id) === ansattId && erFakturertTimerad(x))) {
          g.provisjonGrunnlag += timerBelop;
        }
      } else if (grunnlagType.includes("fakturert") || grunnlagType.includes("omsetning")) {
        g.provisjonGrunnlag += timerBelop;
      }
    }

    g.utlegg += andreUtlegg + km.skattefri;
    g.bompenger += lonnTall(t.bompenger);
    g.parkering += lonnTall(t.parkering);
    g.billetter += lonnTall(t.billetter);
    g.diett += lonnTall(t.diett);
    g.andreUtlegg += lonnTall(t.andre_utlegg) + lonnTall(t.andre_tillegg);
    g.kmSkattefri += km.skattefri;
    g.kmSkattepliktig += km.skattepliktig;

    if (t.id) g.timerIds.push(t.id);
  });

  const resultat = Array.from(grupper.values())
    .map(g => {
      const ansatt = g.ansatt || {};
      const manueltGrunnlag = hentManueltProvisjonsgrunnlag(ansatt);

      g.timer = lonnRund(g.timer);
      g.ordinareTimer = lonnRund(g.ordinareTimer);
      g.overtid50Timer = lonnRund(g.overtid50Timer);
      g.overtid100Timer = lonnRund(g.overtid100Timer);

      g.ordinarlonn = lonnRund(g.ordinarlonn);
      g.overtid50Lonn = lonnRund(g.overtid50Lonn);
      g.overtid100Lonn = lonnRund(g.overtid100Lonn);
      g.fastlonn = harFastlonn(ansatt) ? lonnRund(hentFastlonn(ansatt)) : 0;
      g.bonus = lonnRund(hentBonus(ansatt));
      g.provisjonGrunnlag = lonnRund(manueltGrunnlag > 0 ? manueltGrunnlag : g.provisjonGrunnlag);
      g.provisjonProsent = hentProvisjonProsent(ansatt);

      // Hvis provisjon er satt, men grunnlaget ble 0 fordi timer ikke er markert som fakturert
      // eller timer-tabellen mangler beløpsfelt, bruk beregnet egen timelønn som fall-back.
      // Det gjør at provisjon faktisk kommer med når timer er ført.
      if (g.provisjonProsent > 0 && g.provisjonGrunnlag <= 0) {
        const beregnetEgenTimeOmsetning =
          lonnTall(g.ordinarlonn) +
          lonnTall(g.overtid50Lonn) +
          lonnTall(g.overtid100Lonn);

        if (beregnetEgenTimeOmsetning > 0) {
          g.provisjonGrunnlag = lonnRund(beregnetEgenTimeOmsetning);
        }
      }

      g.provisjon = g.provisjonProsent > 0
        ? lonnRund(g.provisjonGrunnlag * g.provisjonProsent / 100)
        : 0;

      g.utlegg = lonnRund(g.utlegg);
      g.kmSkattefri = lonnRund(g.kmSkattefri);
      g.kmSkattepliktig = lonnRund(g.kmSkattepliktig);

      g.fravaer = fravaerFlexiMap.get(String(g.ansattId)) || lonnFravaerStandard();
      g.permisjonUtenLonnTrekk =
        g.fastlonn > 0 && lonnTall(g.fravaer.permisjonUtenLonnDager) > 0
          ? lonnRund((g.fastlonn / 21.67) * lonnTall(g.fravaer.permisjonUtenLonnDager))
          : 0;

      g.brutto = lonnRund(
        g.ordinarlonn +
        g.overtid50Lonn +
        g.overtid100Lonn +
        g.fastlonn +
        g.provisjon +
        g.bonus +
        g.kmSkattepliktig -
        g.permisjonUtenLonnTrekk
      );

      g.trekkLinjer = beregnTrekkLinjer(g.brutto, trekkMap.get(String(g.ansattId)) || [], ansatt);
      g.skatt = lonnRund(g.trekkLinjer.filter(t => t.erSkatt && !t.erEkstraSkatt).reduce((sum, t) => sum + lonnTall(t.belop), 0));
      g.ekstraSkatt = lonnRund(g.trekkLinjer.filter(t => t.erEkstraSkatt).reduce((sum, t) => sum + lonnTall(t.belop), 0));
      g.andreTrekk = lonnRund(g.trekkLinjer.filter(t => !t.erSkatt).reduce((sum, t) => sum + lonnTall(t.belop), 0));

      g.netto = lonnRund(g.brutto - g.skatt - g.ekstraSkatt - g.andreTrekk + g.utlegg);
      return g;
    })
    .filter(g =>
      lonnTall(g.timer) > 0 ||
      lonnTall(g.brutto) > 0 ||
      lonnTall(g.utlegg) > 0 ||
      lonnTall(g.netto) > 0 ||
      (g.fravaer && ((g.fravaer.linjer || []).length > 0 || lonnTall(g.fravaer.flexiSaldo) !== 0))
    );

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

    const detaljer = data.map(r =>
      `${r.ansattNavn}: brutto ${kroner(r.brutto)} kr, provisjon ${kroner(r.provisjon || 0)} kr, bonus ${kroner(r.bonus || 0)} kr`
    ).join(" | ");
    lonnMelding("Lønn beregnet for " + data.length + " ansatt(e). " + detaljer);
  } catch (e) {
    console.error(e);
    lonnMelding(e.message, true);
  }
}

function pdfLinje(doc, tekst, belop, y, minus = false) {
  doc.text(tekst, 20, y);
  doc.text((minus ? "- " : "") + kroner(belop) + " kr", 130, y);
}

function lonnTrygtFilnavn(tekst) {
  return String(tekst || "ansatt")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/Æ/g, "AE")
    .replace(/Ø/g, "O")
    .replace(/Å/g, "A")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 80) || "ansatt";
}

async function lagLonnsslipper(kopi = false) {
  // Én PDF-fil per ansatt. Kopi styres direkte fra HTML-knappen.
  kopi = (kopi === true || kopi === "true" || kopi === 1 || kopi === "1");
  lonnMelding(kopi ? "Lager lønnsslipp som KOPI..." : "Lager original lønnsslipp...");

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

    const firmaData =
      typeof window.hentFirmaData === "function"
        ? await window.hentFirmaData()
        : (window.firmaData || window.firma || {});

    const firma = lonnFirmaUtenVipps(firmaData || {});
    const lonnskjoringMap = await hentLonnskjoringMap(dataMedLonn);

    async function lagEnLonnsslipp(r) {
      // KOPI skal settes hvis samme ansatt/periode er laget før.
      // Vi sjekker både hurtigkart, localStorage og databasen direkte.
      const finnesFraFor =
        lonnskjoringMap.has(lonnskjoringKey(r)) ||
        lonnskjoringFinnesLokalt(r) ||
        await lonnskjoringFinnesIDatabase(r) ||
        await finnesLonnskjoringFraFor(r);

      const erKopi = kopi || finnesFraFor;

      const doc = new jsPDF();
      const tittel = erKopi ? "LØNNSAVREGNING - KOPI" : "LØNNSAVREGNING";

      async function tegnLonnBrevhode() {
        if (typeof window.tegnBrevhodePdf === "function") {
          await window.tegnBrevhodePdf(doc, firma);
        }

        let y = 70;

        doc.setFont(undefined, "bold");
        doc.setFontSize(16);
        doc.text(tittel, 20, y);
        if (erKopi) {
          doc.setFontSize(18);
          doc.text("KOPI", 165, y);

          // Ekstra tydelig stempel midt på siden, så det ikke kan overses.
          doc.setTextColor(160, 160, 160);
          doc.setFontSize(42);
          doc.text("KOPI", 105, 45, { align: "center" });
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(16);
        }

        y += 12;
        doc.setFont(undefined, "normal");
        doc.setFontSize(10);

        doc.text("Periode: " + r.periodeFra + " - " + r.periodeTil, 20, y);
        y += 8;

        doc.text("Navn: " + r.ansattNavn, 20, y);
        y += 8;

        doc.text("Utbetales til konto: " + (r.kontonr || "Mangler kontonr"), 20, y);
        y += 12;

        return y;
      }

      async function nySideHvisNodvendig(y) {
        if (y <= 252) return y;
        doc.addPage();
        return await tegnLonnBrevhode();
      }

      async function skrivLinje(label, belop, y, minus = false) {
        y = await nySideHvisNodvendig(y);
        doc.setFont(undefined, "normal");
        doc.setFontSize(10);
        doc.text(String(label || ""), 20, y);
        doc.text((minus ? "- " : "") + kroner(belop) + " kr", 130, y);
        return y + 9;
      }

      async function skrivOverskrift(tekst, y) {
        y = await nySideHvisNodvendig(y + 3);
        doc.setFont(undefined, "bold");
        doc.setFontSize(10);
        doc.text(String(tekst || ""), 20, y);
        doc.setFont(undefined, "normal");
        return y + 9;
      }

      async function skrivSkillelinje(y) {
        y = await nySideHvisNodvendig(y + 5);
        if (typeof tegnSkilleLinjePdf === "function") {
          tegnSkilleLinjePdf(doc, y, 20, 190);
        } else {
          doc.line(20, y, 190, y);
        }
        return y + 10;
      }

      let y = await tegnLonnBrevhode();

      if (r.ordinareTimer > 0) {
        y = await nySideHvisNodvendig(y);
        doc.text("Ordinære timer: " + r.ordinareTimer, 20, y);
        doc.text(kroner(r.ordinarlonn) + " kr", 130, y);
        y += 9;
      }

      if (r.overtid50Timer > 0) {
        y = await nySideHvisNodvendig(y);
        doc.text("Overtid 50%: " + r.overtid50Timer, 20, y);
        doc.text(kroner(r.overtid50Lonn) + " kr", 130, y);
        y += 9;
      }

      if (r.overtid100Timer > 0) {
        y = await nySideHvisNodvendig(y);
        doc.text("Overtid 100%: " + r.overtid100Timer, 20, y);
        doc.text(kroner(r.overtid100Lonn) + " kr", 130, y);
        y += 9;
      }

      if (r.fastlonn > 0) y = await skrivLinje("Fastlønn", r.fastlonn, y);

      if (r.provisjon > 0) {
        y = await nySideHvisNodvendig(y);
        doc.text("Provisjon " + (r.provisjonProsent || 0) + "% av " + kroner(r.provisjonGrunnlag) + " kr", 20, y);
        doc.text(kroner(r.provisjon) + " kr", 130, y);
        y += 9;
      }

      if (r.bonus > 0) y = await skrivLinje("Bonus", r.bonus, y);

      if (r.permisjonUtenLonnTrekk > 0) {
        y = await skrivLinje("Trekk permisjon uten lønn", r.permisjonUtenLonnTrekk, y, true);
      }

      y += 3;
      y = await skrivLinje("Brutto lønn", r.brutto, y);

      const feriegrunnlag = lonnTall(r.ansatt?.feriepengegrunnlag) + lonnTall(r.brutto);
      y = await skrivLinje("Feriepengegrunnlag hittil i år", feriegrunnlag, y);

      // AGK FIX 7094: Vis tydelig fravær i valgt lønnsperiode.
      // Flexisaldo er total saldo, og kan derfor finnes selv om fraværet ligger i en annen måned.
      if (r.fravaer) {
        y = await skrivOverskrift("Fravær i valgt lønnsperiode", y + 4);

        const fravaerLinjer = r.fravaer.linjer || [];
        if (fravaerLinjer.length) {
          for (const f of fravaerLinjer) {
            y = await nySideHvisNodvendig(y);
            doc.setFont(undefined, "normal");
            doc.setFontSize(10);
            doc.text(f.type + ":", 20, y);
            doc.text(String(f.dager).replace(".", ",") + " dag(er)", 130, y);
            y += 8;
          }
        } else {
          y = await nySideHvisNodvendig(y);
          doc.setFont(undefined, "normal");
          doc.setFontSize(10);
          doc.text("Ingen fravær registrert i denne lønnsperioden", 20, y);
          y += 8;
        }

        y = await nySideHvisNodvendig(y);
        doc.text("Flexisaldo totalt:", 20, y);
        const flexiTekst = lonnRund(r.fravaer.flexiSaldo).toLocaleString("no-NO", { maximumFractionDigits: 2 }) + " timer";
        doc.text(flexiTekst, 130, y);
        y += 9;
      }

      y += 9;

      if (Array.isArray(r.trekkLinjer) && r.trekkLinjer.length) {
        for (const t of r.trekkLinjer) {
          const label = t.prosent ? `${t.navn} (${t.prosent}%)` : t.navn;
          y = await skrivLinje(label, t.belop, y, true);
        }
      } else if (r.skatt > 0) {
        y = await skrivLinje("Forskuddstrekk", r.skatt, y, true);
      }

      if (r.utlegg > 0 || r.kmSkattefri > 0) {
        y = await skrivOverskrift("Skattefrie utlegg/refusjoner", y);

        if (r.kmSkattefri > 0) y = await skrivLinje("Km-godtgjørelse", r.kmSkattefri, y);
        if (r.bompenger > 0) y = await skrivLinje("Bompenger", r.bompenger, y);
        if (r.parkering > 0) y = await skrivLinje("Parkering", r.parkering, y);
        if (r.billetter > 0) y = await skrivLinje("Billetter/Ferge", r.billetter, y);
        if (r.diett > 0) y = await skrivLinje("Diett", r.diett, y);
        if (r.andreUtlegg > 0) y = await skrivLinje("Andre utlegg", r.andreUtlegg, y);

        y = await nySideHvisNodvendig(y);
        doc.setFont(undefined, "bold");
        doc.text("Sum skattefrie refusjoner", 20, y);
        doc.text(kroner(r.utlegg) + " kr", 130, y);
        doc.setFont(undefined, "normal");
        y += 10;
      }

      y = await skrivSkillelinje(y);

      y = await nySideHvisNodvendig(y);
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text("Netto utbetalt", 20, y);
      doc.text(kroner(r.netto) + " kr", 130, y);
      doc.setFont(undefined, "normal");

      if (typeof window.tegnBrevfotAlleSiderPdf === "function") {
        window.tegnBrevfotAlleSiderPdf(doc, firma);
      }
const periode = String(r.periodeFra || "").slice(0, 7) || "periode";
      const navn = lonnTrygtFilnavn(r.ansattNavn || r.ansattId || "ansatt");
      const filnavn = (erKopi ? "lonnsslipp_kopi_" : "lonnsslipp_") + navn + "_" + periode + ".pdf";
      doc.save(filnavn);

      // Etter at en slipp er laget, huskes den både lokalt og i databasen.
      // Dermed blir neste slipp for samme ansatt/periode KOPI selv før lønn er markert utbetalt.
      lonnskjoringLagreLokalt(r);

      if (!erKopi) {
        await registrerLonnskjoringHvisNy(r, filnavn);
        lonnskjoringMap.set(lonnskjoringKey(r), { ansatt_id: r.ansattId, periode_fra: r.periodeFra, periode_til: r.periodeTil });
      }
    }

    for (const r of dataMedLonn) {
      await lagEnLonnsslipp(r);
    }

    lonnMelding("Lønnsslipper laget for " + dataMedLonn.length + " ansatt(e). Neste gang samme ansatt/periode lages, blir slippen merket KOPI.");
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
      .from("hand_time")
      .update(oppdatering)
      .in("id", ids);
      for (const r of data) {

  const eksisterende =
    lonnTall(r.ansatt?.feriepengegrunnlag);

  const nyttGrunnlag =
    eksisterende + r.brutto;

  await supabaseClient
    .from("hand_ansatt")
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

    for (const r of data) {
      await registrerLonnskjoringHvisNy(r);
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
    timer: r.timer,
    timelonn: r.ordinarlonn,
    fastlonn: r.fastlonn,
    provisjon_grunnlag: r.provisjonGrunnlag,
    provisjon_prosent: r.provisjonProsent,
    provisjon: r.provisjon,
    bonus: r.bonus,
    brutto: r.brutto,
    forskuddstrekk: r.skatt,
    ekstra_skatt: r.ekstraSkatt,
    andre_trekk: r.andreTrekk,
    trekk_permisjon_uten_lonn: r.permisjonUtenLonnTrekk || 0,
    flexisaldo_timer: r.fravaer?.flexiSaldo || 0,
    fravaer: (r.fravaer?.linjer || []).map(f => f.type + ": " + f.dager + " dager").join(", ")
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
    timelonn: r.ordinarlonn,
    fastlonn: r.fastlonn,
    provisjon: r.provisjon,
    bonus: r.bonus,
    brutto: r.brutto,
    utlegg: r.utlegg,
    trekk: lonnTall(r.skatt) + lonnTall(r.ekstraSkatt) + lonnTall(r.andreTrekk),
    netto_utbetalt: r.netto,
    trekk_permisjon_uten_lonn: r.permisjonUtenLonnTrekk || 0,
    flexisaldo_timer: r.fravaer?.flexiSaldo || 0,
    fravaer: (r.fravaer?.linjer || []).map(f => f.type + ": " + f.dager + " dager").join(", ")
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


window.addEventListener("load", function () {
  const el = document.getElementById("lonnMelding");
  if (el && !el.textContent) {
    el.textContent = "Lønn kopi-ren versjon lastet.";
    el.style.color = "#116329";
  }
});
