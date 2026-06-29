
function finnBilNavnForAnsatt(bilId) {
  if (!bilId) return "";
  const bilListe = Array.isArray(window.biler) ? window.biler : [];
  const bil = bilListe.find(b => String(b.id) === String(bilId));
  if (!bil) return "Bil-ID " + String(bilId);
  return `${bil.navn || bil.name || bil.bilnavn || "Bil"}${bil.regnr ? " - " + bil.regnr : ""}`;
}

let ansatte = [];
let trekk = [];
let trekkTyper = [];

async function lastBilerForAnsattVisning() {
  try {
    if (!window.supabaseClient) return;
    const firmaId = await hentFirmaIdForAnsattTilgang();
    let q = supabaseClient
      .from("hand_bil")
      .select("id, navn, name, bilnavn, regnr, registreringsnummer, firma_id")
      .order("navn", { ascending: true });

    if (firmaId) q = q.eq("firma_id", firmaId);

    const { data, error } = await q;
    if (error) {
      console.warn("Kunne ikke hente biler for ansattvisning:", error.message || error);
      return;
    }

    window.biler = Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("Kunne ikke hente biler for ansattvisning:", e);
  }
}

function hentVerdi(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function settVerdi(id, verdi) {
  const el = document.getElementById(id);
  if (el) el.value = verdi ?? "";
}

function hentVerdiFraMulige(...ider) {
  for (const id of ider) {
    const el = document.getElementById(id);
    if (el) return el.value ? el.value.trim() : "";
  }
  return "";
}

function settVerdiPaMulige(verdi, ...ider) {
  for (const id of ider) {
    const el = document.getElementById(id);
    if (el) el.value = verdi ?? "";
  }
}

function tallEllerNullFraMulige(...ider) {
  const verdi = hentVerdiFraMulige(...ider);
  if (verdi === "") return null;
  const tall = Number(String(verdi).replace(",", "."));
  return Number.isFinite(tall) ? tall : null;
}

function settAnsattMelding(tekst) {
  const el = document.getElementById("ansattMelding");
  if (el) el.textContent = tekst || "";
}

function leggTilHvisFinnes(obj, felt, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const verdi = el.value.trim();
  obj[felt] = verdi === "" ? null : verdi;
}

function tallEllerNullFraFelt(elementId) {
  const verdi = hentVerdi(elementId);
  if (verdi === "") return null;
  const tall = Number(String(verdi).replace(",", "."));
  return Number.isFinite(tall) ? tall : null;
}

function finnManglendeKolonneFraFeil(error) {
  const tekst = String(error?.message || error?.details || "");
  let m = tekst.match(/Could not find the '([^']+)' column/i);
  if (m) return m[1];
  m = tekst.match(/column "([^"]+)" .* does not exist/i);
  if (m) return m[1];
  return "";
}

async function lagreAnsattMedKolonneFallback(id, ansatt) {
  const kopi = { ...ansatt };
  const fjernet = [];

  for (let forsok = 0; forsok < 12; forsok++) {
    const result = id
      ? await supabaseClient.from("hand_ansatt").update(kopi).eq("id", id).select()
      : await supabaseClient.from("hand_ansatt").insert([kopi]).select();

    if (!result.error) {
      return { ...result, fjernetKolonner: fjernet };
    }

    const kolonne = finnManglendeKolonneFraFeil(result.error);
    if (!kolonne || !(kolonne in kopi)) {
      return result;
    }

    delete kopi[kolonne];
    fjernet.push(kolonne);
  }

  return { error: { message: "For mange kolonnefeil ved lagring av ansatt." } };
}

function finnLonnAnchor() {
  const timelonn = document.getElementById("timelonn");
  if (timelonn && timelonn.parentNode) return timelonn;

  const ansattTimepris = document.getElementById("ansattTimepris");
  if (ansattTimepris && ansattTimepris.parentNode) return ansattTimepris;

  return document.getElementById("skattetrekk") || document.getElementById("ansattRolle");
}

function sikreLonnFelter() {
  if (document.getElementById("avlonningstype")) {
    oppdaterLonnFelter();
    return;
  }

  const anchor = finnLonnAnchor();
  if (!anchor || !anchor.parentNode) return;

  const container = document.createElement("div");
  container.id = "lonnFelterAuto";
  container.className = "card";
  container.style.marginTop = "12px";
  container.innerHTML = `
    <h3>Lønn</h3>
    <label for="avlonningstype">Avlønningstype</label>
    <select id="avlonningstype">
      <option value="time">Timelønn</option>
      <option value="fast">Fastlønn</option>
      <option value="provisjon">Provisjon</option>
      <option value="fast_provisjon">Fastlønn + provisjon</option>
      <option value="time_provisjon">Timelønn + provisjon</option>
    </select>

    <label for="fastlonn">Fastlønn pr måned</label>
    <input id="fastlonn" type="number" step="0.01" placeholder="F.eks. 45000" />

    <label for="provisjonProsent">Provisjon %</label>
    <input id="provisjonProsent" type="number" step="0.01" placeholder="F.eks. 10" />

    <label for="provisjonGrunnlag">Provisjonsgrunnlag</label>
    <select id="provisjonGrunnlag">
      <option value="egne_fakturerte_timer">Egne fakturerte timer</option>
      <option value="fakturert">Fakturert beløp</option>
      <option value="omsetning">Omsetning</option>
      <option value="dekningsbidrag">Dekningsbidrag</option>
      <option value="manuell">Manuell omsetning</option>
      <option value="annet">Annet</option>
    </select>

    <label for="provisjonOmsetningManuell">Manuell omsetning/provisjonsgrunnlag</label>
    <input id="provisjonOmsetningManuell" type="number" step="0.01" placeholder="F.eks. 85000" />

    <label for="bonus">Bonus</label>
    <input id="bonus" type="number" step="0.01" placeholder="F.eks. 5000" />

    <label for="bonusBeskrivelse">Bonusbeskrivelse</label>
    <input id="bonusBeskrivelse" type="text" placeholder="F.eks. månedens bonus" />

    <h3>Frav&#230;r / Flexi</h3>
    <label>
      <input id="flexiAktiv" type="checkbox" style="width:auto;" checked>
      Bruk flexi/timebank for denne ansatte
    </label>

    <label>
      <input id="overtidTilFlexi" type="checkbox" style="width:auto;">
      Overtid skal som standard g&#229; til flexi i stedet for utbetaling
    </label>

    <label for="normalArbeidsdagTimer">Normal arbeidsdag timer</label>
    <input id="normalArbeidsdagTimer" type="number" step="0.25" value="7.5" />

  `;

  anchor.parentNode.insertBefore(container, anchor.nextSibling);

  const avlonningstype = document.getElementById("avlonningstype");
  if (avlonningstype) avlonningstype.onchange = oppdaterLonnFelter;
  oppdaterLonnFelter();
}

function oppdaterLonnFelter() {
  const type = hentVerdi("avlonningstype") || "time";
  const fast = document.getElementById("fastlonn");
  const timelonn = document.getElementById("timelonn") || document.getElementById("ansattTimepris");
  const ansattTimepris = document.getElementById("ansattTimepris");
  const provisjon = document.getElementById("provisjonProsent");
  const provisjonGrunnlag = document.getElementById("provisjonGrunnlag");
  const provisjonOmsetningManuell = document.getElementById("provisjonOmsetningManuell");
  const bonus = document.getElementById("bonus");

  // Disse feltene skal ALDRI låses. Lønnstype styrer beregning, ikke om man får skrive.
  [fast, timelonn, ansattTimepris, provisjon, provisjonGrunnlag, provisjonOmsetningManuell, bonus].forEach(el => {
    if (!el) return;
    el.disabled = false;
    el.readOnly = false;
    el.removeAttribute("disabled");
    el.removeAttribute("readonly");
    el.style.pointerEvents = "auto";
    el.style.opacity = "1";
  });

  if (provisjonOmsetningManuell) {
    provisjonOmsetningManuell.placeholder =
      type.includes("provisjon")
        ? "Kan beregnes fra egne fakturerte timer, eller skrives inn manuelt"
        : "Valgfritt manuelt grunnlag";
  }
}
async function lastTrekkTyper() {
  const select = document.getElementById("trekkType");
  if (!select) return;

  select.innerHTML = `<option value="">Velg trekk</option>`;

  const { data, error } = await supabaseClient
    .from("hand_trekk_type")
    .select("*")
    .order("navn");

  if (error) {
    console.error("Feil ved henting av trekktyper:", error);
    settAnsattMelding("Feil ved henting av trekktyper: " + error.message);
    return;
  }

  trekkTyper = data || [];
  window.trekkTyper = trekkTyper;

  trekkTyper.forEach(trekkType => {
    const option = document.createElement("option");
    option.value = trekkType.id;
    option.textContent = trekkType.navn;
    select.appendChild(option);
  });

  oppdaterTrekkEnhet();
}


async function hentFirmaIdForAnsattTilgang() {
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
    console.warn("Kunne ikke finne firma_id for ansatt-tilgang:", e);
  }
  return "";
}

async function lastAnsatte() {
  let query = supabaseClient
    .from("hand_ansatt")
    .select("*")
    .order("navn");

  const firmaId = await hentFirmaIdForAnsattTilgang();
  if (window.erAdmin === true && window.erSystemadmin !== true && firmaId) {
    query = query.eq("firma_id", firmaId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Feil ved henting av ansatte:", error);
    settAnsattMelding("Feil ved henting av ansatte: " + error.message);
    return;
  }

  ansatte = data || [];
  window.ansatte = ansatte;

  if (typeof fyllLonnAnsattValg === "function") {
    fyllLonnAnsattValg(ansatte);
  }

  await lastBilerForAnsattVisning();
  if (typeof fyllBilvalg === "function") await fyllBilvalg();
  visAnsatte();
}

function visAnsatte() {
  const liste = document.getElementById("ansattListe");
  if (!liste) return;

  liste.innerHTML = "";

  if (!ansatte.length) {
    liste.innerHTML = "<p>Ingen ansatte funnet.</p>";
    return;
  }

  ansatte.forEach(ansatt => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <strong>${ansatt.navn || ""}</strong><br>
      ${ansatt.epost || ""}<br>
      ${ansatt.mobil || ansatt.mobile || ""}<br>
      ${ansatt.rolle ? "Rolle: " + ansatt.rolle + "<br>" : ""}
      ${(ansatt.lonnstype || ansatt.avlonningstype) ? "Lønn: " + (ansatt.lonnstype || ansatt.avlonningstype) + "<br>" : ""}
      ${ansatt.fastlonn ? "Fastlønn: " + ansatt.fastlonn + " kr/mnd<br>" : ""}
      ${ansatt.provisjon_prosent ? "Provisjon: " + ansatt.provisjon_prosent + "%<br>" : ""}
      ${ansatt.bonus ? "Bonus: " + ansatt.bonus + " kr<br>" : ""}
      ${ansatt.standard_bil_id ? "Standard bil: " + finnBilNavnForAnsatt(ansatt.standard_bil_id) + "<br>" : ""}
      <button type="button" class="secondary" onclick="endreAnsatt('${ansatt.id}')">Endre</button>
      <button type="button" class="secondary" onclick="settPassord('${ansatt.id}')">Sett passord</button>
      <button type="button" class="secondary" onclick="slettAnsatt('${ansatt.id}')">Slett</button>
    `;

    liste.appendChild(div);
  });
}


async function lastTrekkForAnsatt(ansattId) {
  trekk = [];
  window.trekk = trekk;

  if (!ansattId) {
    tegnTrekkListe();
    return;
  }

  const { data, error } = await supabaseClient
    .from("hand_ansatt_trekk")
    .select("*")
    .eq("ansatt_id", ansattId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Feil ved henting av ansatt-trekk:", error);
    settAnsattMelding("Kunne ikke hente trekk for ansatt: " + error.message);
    tegnTrekkListe();
    return;
  }

  trekk = (data || []).filter(rad => rad.aktiv !== false).map(rad => {
    const typeId = rad.trekk_type_id || rad.type_id || rad.trekk_id || rad.type || "";
    const valgtTrekk = trekkTyper.find(t => String(t.id) === String(typeId));
    const navn = rad.navn || rad.trekk_navn || (valgtTrekk ? valgtTrekk.navn : typeId);
    const belop = rad.belop ?? rad.prosent ?? rad.sum ?? "";

    return {
      id: rad.id || "",
      type: typeId,
      navn,
      belop,
      enhet: rad.enhet || (erProsentTrekk(navn) ? "%" : " kr")
    };
  });

  window.trekk = trekk;
  tegnTrekkListe();
}

async function lagreTrekkForAnsatt(ansattId) {
  if (!ansattId) return;

  const slett = await supabaseClient
    .from("hand_ansatt_trekk")
    .delete()
    .eq("ansatt_id", ansattId);

  if (slett.error) {
    console.error("Feil ved sletting av gamle ansatt-trekk:", slett.error);
    settAnsattMelding("Ansatt ble lagret, men gamle trekk kunne ikke ryddes: " + slett.error.message);
    return;
  }

  if (!trekk.length) return;

  const rader = trekk.map(t => {
    const navn = t.navn || "";
    const verdi = Number(String(t.belop || "0").replace(",", ".")) || 0;
    const erProsent = t.enhet === "%" || erProsentTrekk(navn);

    return {
      ansatt_id: ansattId,
      trekk_type_id: t.type || null,
      belop: erProsent ? null : verdi,
      prosent: erProsent ? verdi : null,
      trekk_metode: erProsent ? "prosent" : "belop",
      aktiv: true,
      fra_dato: null,
      til_dato: null,
      kommentar: null
    };
  });

  const { error } = await supabaseClient
    .from("hand_ansatt_trekk")
    .insert(rader);

  if (error) {
    console.error("Feil ved lagring av ansatt-trekk:", error);
    settAnsattMelding("Ansatt ble lagret, men trekk ble ikke lagret: " + error.message);
  }
}

async function endreAnsatt(id) {
  const ansatt = ansatte.find(a => String(a.id) === String(id));

  if (!ansatt) {
    alert("Fant ikke ansatt");
    return;
  }

  settVerdi("ansattId", ansatt.id);
  settVerdi("ansattNavn", ansatt.navn);
  settVerdi("ansattEpost", ansatt.epost);
  settVerdi("ansattMobil", ansatt.mobil || ansatt.mobile);
  settVerdi("ansattStandardBil", ansatt.standard_bil_id || "");
  settVerdi("ansattPersonnr", ansatt.personnr || ansatt.fodselsnr);
  settVerdi("ansattKontonr", ansatt.kontonr);
  settVerdi("ansattRolle", ansatt.rolle);
  settVerdi("ansattStartDato", ansatt.startdato || ansatt.start_dato);
  settVerdi("ansattSluttDato", ansatt.sluttdato || ansatt.slutt_dato);
  sikreLonnFelter();
  settVerdiPaMulige(ansatt.timelonn ?? ansatt.ansatt_timepris ?? ansatt.timepris ?? "", "timelonn", "ansattTimepris");
  settVerdi("avlonningstype", ansatt.lonnstype || ansatt.avlonningstype || ansatt.lonn_type || "time");
  settVerdi("fastlonn", ansatt.fastlonn || ansatt.fast_lonn);
  settVerdi("provisjonProsent", ansatt.provisjon_prosent || ansatt.provisjon);
  settVerdi("provisjonGrunnlag", ansatt.provisjon_grunnlag || "egne_fakturerte_timer");
  settVerdi("provisjonOmsetningManuell", ansatt.provisjon_omsetning_manuell || ansatt.provisjon_grunnlag_manuell || "");
  settVerdi("bonus", ansatt.bonus);
  settVerdi("bonusBeskrivelse", ansatt.bonus_beskrivelse || "");
  const flexiAktiv = document.getElementById("flexiAktiv");
  if (flexiAktiv) flexiAktiv.checked = ansatt.flexi_aktiv !== false;
  const overtidTilFlexi = document.getElementById("overtidTilFlexi");
  if (overtidTilFlexi) overtidTilFlexi.checked = ansatt.overtid_til_flexi === true;
  settVerdi("normalArbeidsdagTimer", ansatt.normal_arbeidsdag_timer || ansatt.normal_timer_dag || 7.5);
  oppdaterLonnFelter();
  settVerdi("skattetrekk", ansatt.skattetrekk);
  settVerdi("ekstraSkatt", ansatt.ekstra_skatt || ansatt.ekstraskatt);

  await lastTrekkForAnsatt(ansatt.id);

  settAnsattMelding("Redigerer ansatt. Trykk Lagre bruker / ansatt når du er ferdig.");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let lagrerAnsatt = false;

async function lagreAnsatt() {
  if (lagrerAnsatt) return;

  lagrerAnsatt = true;

  const lagreKnapp = document.getElementById("lagreAnsattKnapp");
  if (lagreKnapp) lagreKnapp.disabled = true;

  try {
    const id = hentVerdi("ansattId");

    const ansatt = {
      navn: hentVerdi("ansattNavn"),
      epost: hentVerdi("ansattEpost").toLowerCase()
    };

    leggTilHvisFinnes(ansatt, "mobil", "ansattMobil");
    leggTilHvisFinnes(ansatt, "standard_bil_id", "ansattStandardBil");
    leggTilHvisFinnes(ansatt, "personnr", "ansattPersonnr");
    leggTilHvisFinnes(ansatt, "kontonr", "ansattKontonr");
    leggTilHvisFinnes(ansatt, "rolle", "ansattRolle");
    leggTilHvisFinnes(ansatt, "startdato", "ansattStartDato");
    leggTilHvisFinnes(ansatt, "sluttdato", "ansattSluttDato");
    ansatt.timelonn = tallEllerNullFraMulige("timelonn", "ansattTimepris");
    leggTilHvisFinnes(ansatt, "lonnstype", "avlonningstype");
    ansatt.fastlonn = tallEllerNullFraFelt("fastlonn");
    ansatt.provisjon_prosent = tallEllerNullFraFelt("provisjonProsent");
    leggTilHvisFinnes(ansatt, "provisjon_grunnlag", "provisjonGrunnlag");
    ansatt.provisjon_omsetning_manuell = tallEllerNullFraFelt("provisjonOmsetningManuell");
    ansatt.bonus = tallEllerNullFraFelt("bonus");
    leggTilHvisFinnes(ansatt, "bonus_beskrivelse", "bonusBeskrivelse");
    leggTilHvisFinnes(ansatt, "skattetrekk", "skattetrekk");
    leggTilHvisFinnes(ansatt, "ekstra_skatt", "ekstraSkatt");

    // Admin/eier skal kunne opprette brukere for sitt firma.
    // Sett firma_id automatisk ved ny bruker slik at RLS og filtrering fungerer.
    const aktivFirmaId = await hentFirmaIdForAnsattTilgang();
    if (aktivFirmaId && !id) ansatt.firma_id = aktivFirmaId;
    // Ikke skriv er_admin her. Noen databaser har ikke kolonnen, og rolle='admin' brukes allerede for admin-tilgang.
    if (ansatt.aktiv === undefined) ansatt.aktiv = true;

    if (!ansatt.navn || !ansatt.epost) {
      settAnsattMelding("Navn og e-post må fylles ut.");
      return;
    }

    let result;

    if (id) {
      result = await lagreAnsattMedKolonneFallback(id, ansatt);
    } else {
      const { data: finnesFraFor, error: sjekkError } = await supabaseClient
        .from("hand_ansatt")
        .select("id")
        .eq("epost", ansatt.epost)
        .limit(1);

      if (sjekkError) {
        console.error("Feil ved sjekk av eksisterende ansatt:", sjekkError);
        settAnsattMelding("Feil ved sjekk av eksisterende ansatt: " + sjekkError.message);
        return;
      }

      if (finnesFraFor && finnesFraFor.length > 0) {
        settAnsattMelding("Ansatt med denne e-posten finnes allerede.");
        return;
      }

      result = await lagreAnsattMedKolonneFallback("", ansatt);
    }

    if (result.error) {
      console.error("Feil ved lagring av ansatt:", result.error);
      const melding = "Feil ved lagring av ansatt: " + (result.error.message || JSON.stringify(result.error));
      settAnsattMelding(melding);
      alert(melding);
      return;
    }

    if (result.fjernetKolonner && result.fjernetKolonner.length) {
      const melding =
        "Ansatt ble lagret, men disse feltene ble ikke lagret fordi kolonnene mangler i Supabase: " +
        result.fjernetKolonner.join(", ") +
        ". Kjør SQL-en jeg ga deg for lønnsfeltene.";
      console.warn(melding);
      settAnsattMelding(melding);
      alert(melding);
    }

    const lagretAnsatt = Array.isArray(result.data) && result.data.length ? result.data[0] : null;
    const lagretAnsattId = id || lagretAnsatt?.id;

    // RIL FIX: Tildelt/standard bil skal faktisk lagres på ansatt.
    // Noen Supabase-oppsett/dropdowns gjør at hovedlagringen ikke får med standard_bil_id.
    // Derfor gjør vi en eksplisitt oppdatering etterpå når en ansatt-id finnes.
    const valgtStandardBilId = (document.getElementById("ansattStandardBil")?.value || "").trim();
    if (lagretAnsattId) {
      try {
        const bilRad = { standard_bil_id: valgtStandardBilId || null };
        let bilRes = await supabaseClient
          .from("hand_ansatt")
          .update(bilRad)
          .eq("id", lagretAnsattId)
          .select("id, standard_bil_id")
          .maybeSingle();

        // Fallback for eldre database som eventuelt bruker bil_id i stedet.
        if (bilRes.error && /standard_bil_id/i.test(String(bilRes.error.message || ""))) {
          bilRes = await supabaseClient
            .from("hand_ansatt")
            .update({ bil_id: valgtStandardBilId || null })
            .eq("id", lagretAnsattId)
            .select("id, bil_id")
            .maybeSingle();
        }

        if (bilRes.error) {
          console.warn("Kunne ikke lagre tildelt bil på ansatt:", bilRes.error);
          settAnsattMelding("Ansatt lagret, men tildelt bil ble ikke lagret: " + bilRes.error.message);
        }
      } catch (e) {
        console.warn("Tildelt bil-lagring feilet:", e);
      }
    }

    if (lagretAnsattId) {
      await lagreTrekkForAnsatt(lagretAnsattId);
    }

    await lastAnsatte();
    if (typeof window.lastBiler === "function") {
      try { await window.lastBiler(); } catch (e) { console.warn("Kunne ikke oppdatere biler etter ansattlagring:", e); }
    }
    if (typeof window.lastBilerOgBilLager === "function") {
      try { await window.lastBilerOgBilLager(); } catch (e) { console.warn("Kunne ikke oppdatere bil-lager etter ansattlagring:", e); }
    }

    // RIL FIX 7089:
    // Nullstill skjema etter lagring, men behold tydelig melding.
    // Dette hindrer at neste ansatt oppdaterer forrige ansatt ved et uhell.
    nyttAnsattSkjema();

    if (!(result.fjernetKolonner && result.fjernetKolonner.length)) {
      settAnsattMelding("Ansatt lagret. Skjemaet er klart for ny ansatt.");
    }
  } finally {
    lagrerAnsatt = false;
    if (lagreKnapp) lagreKnapp.disabled = false;
  }
}

async function settPassord(id) {
  const ansatt = ansatte.find(a => String(a.id) === String(id));

  if (!ansatt) {
    alert("Fant ikke ansatt");
    return;
  }

  const epost = String(ansatt.epost || "").trim().toLowerCase();
  if (!epost) {
    alert("Ansatt mangler e-post.");
    return;
  }

  const valg = confirm(
    "Vil du sende passordlenke til " + (ansatt.navn || epost) + "?\n\n" +
    "OK = send passordlenke til eksisterende bruker.\n" +
    "Avbryt = prøv å opprette ny innlogging med midlertidig passord."
  );

  if (valg) {
    await sendPassordLenke(ansatt);
    return;
  }

  const passord = prompt(`Sett midlertidig passord for ${ansatt.navn || epost}`);
  if (!passord) return;

  if (passord.length < 6) {
    alert("Passord må være minst 6 tegn");
    return;
  }

  const { error } = await supabaseClient.auth.signUp({
    email: epost,
    password: passord
  });

  if (error) {
    const melding = String(error.message || "").toLowerCase();

    if (melding.includes("already") || melding.includes("registered") || melding.includes("exists")) {
      console.warn("Brukeren finnes allerede i Auth. Sender passordlenke i stedet.", error);
      await sendPassordLenke(ansatt);
      return;
    }

    console.error("Feil ved oppretting av innlogging:", error);
    alert("Feil ved oppretting av innlogging: " + error.message);
    return;
  }

  const result = await supabaseClient
    .from("hand_ansatt")
    .update({ ma_bytte_passord: true })
    .eq("id", id);

  if (result.error) {
    console.error("Bruker ble opprettet, men passordbytte-flagg ble ikke lagret:", result.error);
    alert("Bruker ble opprettet, men passordbytte-flagg ble ikke lagret: " + result.error.message);
    return;
  }

  alert("Bruker er opprettet med midlertidig passord.");
  await lastAnsatte();
}

async function sendPassordLenke(ansatt) {
  const epost = String(ansatt.epost || "").trim().toLowerCase();

  if (!epost) {
    alert("Ansatt mangler e-post.");
    return;
  }

  const redirectUrl =
    window.location.origin + "/rettilomma/handverker/reset.html";

  const { error } = await supabaseClient.auth.resetPasswordForEmail(epost, {
    redirectTo: redirectUrl
  });

  if (error) {
    console.error("Kunne ikke sende passordlenke:", error);
    alert("Kunne ikke sende passordlenke: " + error.message);
    return;
  }

  const result = await supabaseClient
    .from("hand_ansatt")
    .update({ ma_bytte_passord: true })
    .eq("id", ansatt.id);

  if (result.error) {
    console.warn("Passordlenke ble sendt, men flagg ble ikke lagret:", result.error);
  }

  alert("Passordlenke er sendt til " + epost + ".");
}

function nyttAnsattSkjema() {
  settVerdi("ansattId", "");
  settVerdi("ansattNavn", "");
  settVerdi("ansattEpost", "");
  settVerdi("ansattMobil", "");
  settVerdi("ansattStandardBil", "");
  settVerdi("ansattPersonnr", "");
  settVerdi("ansattKontonr", "");
  settVerdi("ansattRolle", "bruker");
  settVerdi("ansattStartDato", "");
  settVerdi("ansattSluttDato", "");
  sikreLonnFelter();
  settVerdiPaMulige("", "timelonn", "ansattTimepris");
  settVerdi("avlonningstype", "time");
  settVerdi("fastlonn", "");
  settVerdi("provisjonProsent", "");
  settVerdi("provisjonGrunnlag", "egne_fakturerte_timer");
  settVerdi("provisjonOmsetningManuell", "");
  settVerdi("bonus", "");
  settVerdi("bonusBeskrivelse", "");
  const flexiAktiv = document.getElementById("flexiAktiv");
  if (flexiAktiv) flexiAktiv.checked = true;
  const overtidTilFlexi = document.getElementById("overtidTilFlexi");
  if (overtidTilFlexi) overtidTilFlexi.checked = false;
  settVerdi("normalArbeidsdagTimer", "7.5");
  oppdaterLonnFelter();
  settVerdi("skattetrekk", "");
  settVerdi("ekstraSkatt", "");
  settVerdi("trekkType", "");
  settVerdi("trekkBelop", "");

  trekk = [];
  window.trekk = trekk;

  tegnTrekkListe();
  oppdaterTrekkEnhet();
  settAnsattMelding("");
}

async function slettAnsatt(id) {
  if (!confirm("Vil du slette denne ansatte?")) return;

  try {
    await supabaseClient
      .from("hand_ansatt_trekk")
      .delete()
      .eq("ansatt_id", id);
  } catch (e) {
    console.warn("Kunne ikke slette ansatt-trekk før ansatt:", e);
  }

  const { error } = await supabaseClient
    .from("hand_ansatt")
    .delete()
    .eq("id", id);

  if (error) {
    console.warn("Kunne ikke slette ansatt, prøver å sette inaktiv:", error);

    const result = await supabaseClient
      .from("hand_ansatt")
      .update({ aktiv: false })
      .eq("id", id);

    if (result.error) {
      console.error("Feil ved sletting/inaktivering:", result.error);
      alert("Kunne ikke slette ansatt: " + result.error.message);
      return;
    }

    alert("Ansatt hadde timer og ble satt inaktiv.");
  }

  await lastAnsatte();
}

function erProsentTrekk(navn) {
  const ren = String(navn || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%]/g, "");

  return (
    ren.includes("skatt") ||
    ren.includes("skatte") ||
    ren.includes("forskudd") ||
    ren.includes("tabell") ||
    ren.includes("prosent") ||
    ren.includes("%")
  );
}

function hentValgtTrekkNavn() {
  const select = document.getElementById("trekkType");

  if (!select || select.selectedIndex < 0) {
    return "";
  }

  const tekst = select.options[select.selectedIndex].textContent || "";
  return tekst.trim();
}

function oppdaterTrekkEnhet() {
  const label = document.querySelector('label[for="trekkBelop"]');
  const input = document.getElementById("trekkBelop");
  const valgtTekst = hentValgtTrekkNavn();
  const erSkatt = erProsentTrekk(valgtTekst);

  if (label) {
    label.textContent = erSkatt ? "Prosent" : "Beløp";
  }

  if (input) {
    input.placeholder = erSkatt ? "F.eks. 35" : "F.eks. 500";
  }
}

function leggTilTrekk() {
  const type = hentVerdi("trekkType");
  const belop = hentVerdi("trekkBelop");

  if (!type || !belop) {
    settAnsattMelding("Velg trekk-type og beløp.");
    return;
  }

  const valgtTekst = hentValgtTrekkNavn();
  const valgtTrekk = trekkTyper.find(t => String(t.id) === String(type));
  const navn = valgtTekst || (valgtTrekk ? valgtTrekk.navn : type);
  const enhet = erProsentTrekk(navn) ? "%" : " kr";

  trekk.push({
    type,
    navn,
    belop,
    enhet
  });

  window.trekk = trekk;

  settVerdi("trekkType", "");
  settVerdi("trekkBelop", "");

  tegnTrekkListe();
  oppdaterTrekkEnhet();
}

function tegnTrekkListe() {
  const liste = document.getElementById("trekkListe");
  if (!liste) return;

  if (!trekk.length) {
    liste.innerHTML = "<p>Ingen trekk på denne ansatte.</p>";
    return;
  }

  liste.innerHTML = trekk
    .map((t, indeks) => {
      const navn = t.navn || t.type || "";
      const enhet = t.enhet || (erProsentTrekk(navn) ? "%" : " kr");
      const belop = t.belop ?? "";

      return `
        <div class="trekk-rad" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:6px 0;">
          <strong style="min-width:140px;">${navn}</strong>
          <input
            type="number"
            step="0.01"
            value="${belop}"
            style="max-width:140px;"
            onchange="oppdaterTrekkBelop(${indeks}, this.value)"
          >
          <span>${enhet}</span>
          <button type="button" class="secondary" onclick="fjernTrekk(${indeks})">Fjern trekk fra ansatt</button>
        </div>
      `;
    })
    .join("");
}

function oppdaterTrekkBelop(indeks, verdi) {
  if (indeks < 0 || indeks >= trekk.length) return;
  trekk[indeks].belop = verdi;
  window.trekk = trekk;
}

async function fjernTrekk(indeks) {
  if (indeks < 0 || indeks >= trekk.length) return;

  const fjernet = trekk[indeks];
  const ansattId = hentVerdi("ansattId");

  // Fjern fra skjermen med en gang.
  trekk.splice(indeks, 1);
  window.trekk = trekk;
  tegnTrekkListe();

  // Hvis trekket allerede ligger i databasen, slett akkurat den raden.
  if (fjernet && fjernet.id) {
    const slett = await supabaseClient
      .from("hand_ansatt_trekk")
      .delete()
      .eq("id", fjernet.id);

    if (slett.error) {
      console.warn("Direkte sletting feilet, prøver å sette trekket inaktivt:", slett.error);

      const opphev = await supabaseClient
        .from("hand_ansatt_trekk")
        .update({ aktiv: false, til_dato: new Date().toISOString().slice(0, 10) })
        .eq("id", fjernet.id);

      if (opphev.error) {
        console.error("Kunne ikke fjerne/oppheve trekk:", opphev.error);
        settAnsattMelding("Kunne ikke fjerne trekket: " + opphev.error.message);
        if (ansattId) await lastTrekkForAnsatt(ansattId);
        return;
      }
    }

    settAnsattMelding("Trekket er fjernet fra denne ansatte.");
    if (ansattId) await lastTrekkForAnsatt(ansattId);
    return;
  }

  // Nytt, ulagret trekk: bare fjern fra listen.
  settAnsattMelding("Trekket er fjernet fra skjemaet. Trykk Lagre ansatt for å lagre endringen.");
}

function beregnBelopFraTimerad(rad) {
  const direkte = rad.belop ?? rad.sum ?? rad.total ?? rad.fakturert_belop ?? rad.belop_eks_mva ?? rad.belop_eks;
  if (direkte !== null && direkte !== undefined && direkte !== "") {
    const tall = Number(String(direkte).replace(",", "."));
    if (Number.isFinite(tall)) return tall;
  }

  const timer = rad.timer ?? rad.antall_timer ?? rad.timer_antall ?? rad.antall ?? 0;
  const pris = rad.timepris ?? rad.sats ?? rad.pris ?? 0;
  const t = Number(String(timer).replace(",", ".")) || 0;
  const p = Number(String(pris).replace(",", ".")) || 0;
  return t * p;
}

async function beregnProvisjonsgrunnlagForAnsatt() {
  const ansattId = hentVerdi("ansattId");
  if (!ansattId) {
    settAnsattMelding("Velg/rediger en ansatt først.");
    return;
  }

  const muligeTabeller = ["hand_time", "timeregistreringer", "timer_registrering", "arbeidstimer"];
  let data = null;
  let sisteError = null;

  for (const tabell of muligeTabeller) {
    const res = await supabaseClient
      .from(tabell)
      .select("*")
      .eq("ansatt_id", ansattId);

    if (!res.error) {
      data = res.data || [];
      break;
    }
    sisteError = res.error;
  }

  if (!data) {
    console.error("Fant ingen timetabell for provisjonsgrunnlag:", sisteError);
    settAnsattMelding("Fant ikke timetabell for provisjonsgrunnlag. Da må grunnlaget skrives manuelt, eller hand-lonn.js/timer-tabellen kobles inn.");
    return;
  }

  const fakturerte = data.filter(rad => {
    const f = rad.fakturert ?? rad.er_fakturert ?? rad.faktura_id ?? rad.faktura_nr ?? rad.fakturanr;
    return f === true || f === "true" || f === "ja" || (f !== null && f !== undefined && f !== false && f !== "" && f !== "nei");
  });

  const grunnlagRader = fakturerte.length ? fakturerte : data;
  const grunnlag = grunnlagRader.reduce((sum, rad) => sum + beregnBelopFraTimerad(rad), 0);

  settVerdi("provisjonOmsetningManuell", grunnlag.toFixed(2));
  settAnsattMelding(
    "Provisjonsgrunnlag beregnet fra " + grunnlagRader.length +
    (fakturerte.length ? " fakturerte timer: " : " førte timer: ") +
    grunnlag.toFixed(2) + " kr. Trykk Lagre ansatt."
  );
}




document.addEventListener("DOMContentLoaded", async () => {
  const nyKnapp = document.getElementById("nyAnsattKnapp");
  if (nyKnapp) nyKnapp.onclick = nyttAnsattSkjema;

  const trekkSelect = document.getElementById("trekkType");
  if (trekkSelect) trekkSelect.onchange = oppdaterTrekkEnhet;

  const leggTilTrekkKnapp = document.getElementById("leggTilTrekkKnapp");
  if (leggTilTrekkKnapp) leggTilTrekkKnapp.onclick = leggTilTrekk;

  const lagreAnsattKnapp = document.getElementById("lagreAnsattKnapp");
  if (lagreAnsattKnapp) lagreAnsattKnapp.onclick = lagreAnsatt;

  sikreLonnFelter();
  oppdaterLonnFelter();
  setTimeout(oppdaterLonnFelter, 100);
  setTimeout(oppdaterLonnFelter, 500);

  const beregnKnapp = document.getElementById("beregnProvisjonsgrunnlagKnapp");
  if (beregnKnapp) beregnKnapp.onclick = beregnProvisjonsgrunnlagForAnsatt;

  await lastTrekkTyper();
});

window.ansatte = ansatte;
window.trekk = trekk;
window.trekkTyper = trekkTyper;

window.lastAnsatte = lastAnsatte;
window.visAnsatte = visAnsatte;
window.tegnAnsatte = visAnsatte;

window.endreAnsatt = endreAnsatt;
window.redigerAnsatt = endreAnsatt;

window.lagreAnsatt = lagreAnsatt;
window.nyttAnsattSkjema = nyttAnsattSkjema;

window.settPassord = settPassord;
window.sendPassordLenke = sendPassordLenke;
window.slettAnsatt = slettAnsatt;

window.leggTilTrekk = leggTilTrekk;
window.tegnTrekkListe = tegnTrekkListe;

window.lastTrekkTyper = lastTrekkTyper;
window.erProsentTrekk = erProsentTrekk;
window.oppdaterTrekkEnhet = oppdaterTrekkEnhet;
window.lastTrekkForAnsatt = lastTrekkForAnsatt;
window.lagreTrekkForAnsatt = lagreTrekkForAnsatt;
window.fjernTrekk = fjernTrekk;
window.oppdaterTrekkBelop = oppdaterTrekkBelop;
window.beregnProvisjonsgrunnlagForAnsatt = beregnProvisjonsgrunnlagForAnsatt;

window.sikreLonnFelter = sikreLonnFelter;
window.oppdaterLonnFelter = oppdaterLonnFelter;
