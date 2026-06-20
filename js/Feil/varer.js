function visVarer() {
  const prosjektOverlay = document.getElementById("prosjektOverlay");
  if (prosjektOverlay) prosjektOverlay.style.display = "none";

  const prosjektVindu = document.getElementById("prosjektVindu");
  if (prosjektVindu) prosjektVindu.style.display = "none";

  if (typeof window.skjulAlleSider === "function") {
    window.skjulAlleSider();
  } else {
    ["timerSide", "varerSide", "lonnPanel", "kundeSide", "ansattSide", "firmaSide", "testSide"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add("skjult");
    });
  }

  const varerSide = document.getElementById("varerSide");

  if (!varerSide) {
    alert("Finner ikke varerSide i index.html");
    return;
  }

  varerSide.classList.remove("hidden");
  varerSide.classList.remove("skjult");
  varerSide.style.display = "";

  hentVarer();
  fyllVarevalg();
  fyllBilvalg();
  hentBilLager();
}

function tilbakeFraVarer() {
  if (typeof window.visTimerSide === "function") {
    window.visTimerSide();
    return;
  }

  const varerSide = document.getElementById("varerSide");
  if (varerSide) {
    varerSide.classList.add("skjult");
    varerSide.style.display = "none";
  }

  const timerSide = document.getElementById("timerSide");
  if (timerSide) {
    timerSide.classList.remove("hidden");
    timerSide.classList.remove("skjult");
    timerSide.style.display = "";
  }
}

function hentVarePris(v) {
  return Number(v.pris ?? v.utpris ?? 0);
}

function hentVareHovedlager(v) {
  return Number(v.lager_antall ?? v.antall ?? 0);
}

function hentVareMinimum(v) {
  return Number(v.minimum_antall ?? 0);
}

function formaterKr(tall) {
  return Number(tall || 0).toFixed(2);
}

function heltallFraVerdi(verdi) {
  const tall = Number(String(verdi ?? "0").replace(",", "."));
  if (!Number.isFinite(tall)) return 0;
  return Math.floor(tall);
}

function erGyldigHeltall(verdi) {
  const tekst = String(verdi ?? "").replace(",", ".").trim();
  if (tekst === "") return false;
  const tall = Number(tekst);
  return Number.isInteger(tall) && tall >= 0;
}

async function hentVarer() {
  const liste = document.getElementById("vareListe");
  if (!liste) return;

  liste.innerHTML = "Laster varer...";

  const { data, error } = await supabaseClient
    .from("varer")
    .select("*")
    .order("varenr", { ascending: true });

  if (error) {
    liste.innerHTML = "Feil ved henting: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    liste.innerHTML = `
      <div style="
        padding:15px;
        border:1px solid #444;
        border-radius:10px;
        background:#1e1e1e;
        color:#fff;
      ">
        Ingen varer registrert.<br><br>
        Legg inn varer i hovedlager først.
      </div>
    `;
    return;
  }

  liste.innerHTML = data.map(v => {
    const hovedlager = hentVareHovedlager(v);
    const minimum = hentVareMinimum(v);
    const litePaLager = minimum > 0 && hovedlager <= minimum;

    return `
      <div style="
        border:1px solid #ccc;
        padding:10px;
        margin-bottom:10px;
        border-radius:8px;
        background:#fff;
      ">
        <b>${v.varenr || ""} ${v.navn || ""}</b><br>
        ${v.beskrivelse || ""}<br><br>
        Innpris: ${formaterKr(v.innpris)} kr eks mva<br>
        Utpris: ${formaterKr(hentVarePris(v))} kr eks mva<br>
        MVA: ${Number(v.mva_sats || 0)} %<br>
        Hovedlager: <b>${hovedlager}</b>
        ${litePaLager ? '<span style="color:#b00020; font-weight:bold;"> ⚠ lavt lager</span>' : ''}<br>
        Minimum: ${minimum}
      </div>
    `;
  }).join("");
}

async function fyllVarevalg() {
  // #vareValg i timeregistrering skal ALDRI fylles fra hovedlager.
  // Den skal bare fylles av timer.js fra bil_varer for aktiv bil.
  const lagerVareValg = document.getElementById("lagerVareValg");

  const { data, error } = await supabaseClient
    .from("varer")
    .select("*")
    .order("varenr", { ascending: true });

  if (error) {
    console.error("Feil ved henting av varer:", error);
    return;
  }

  const fyllSelect = (select, tomTekst) => {
    if (!select) return;
    select.innerHTML = `<option value="">${tomTekst}</option>`;

    (data || []).forEach(v => {
      const option = document.createElement("option");
      option.value = v.id;
      option.dataset.pris = hentVarePris(v);
      option.dataset.hovedlager = hentVareHovedlager(v);
      option.textContent =
        `${v.varenr || ""} ${v.navn || ""} - ${formaterKr(hentVarePris(v))} kr - hovedlager ${hentVareHovedlager(v)}`;

      select.appendChild(option);
    });
  };

  // Kun lager/fyll-bil-listene får hovedlager-varer.
  fyllSelect(lagerVareValg, "Velg vare");
  tegnFyllBilListe(data || []);

  // Etterpå fyller vi timeregistreringens vareliste fra aktiv bil igjen.
  if (typeof window.fyllVarevalgFraAktivBil === "function") {
    await window.fyllVarevalgFraAktivBil();
  }
}

async function fyllBilvalg() {
  const selects = [
    document.getElementById("bilValg"),
    document.getElementById("lagerBilValg"),
    document.getElementById("ansattStandardBil")
  ].filter(Boolean);

  if (!selects.length) return;

  const { data, error } = await supabaseClient
    .from("biler")
    .select("*")
    .order("navn", { ascending: true });

  if (error) {
    console.error("Feil ved henting av biler:", error);
    return;
  }

  selects.forEach(select => {
    const valgt = select.value;
    select.innerHTML = `<option value="">Velg bil</option>`;

    (data || []).forEach(b => {
      const option = document.createElement("option");
      option.value = b.id;
      option.textContent = `${b.navn || "Bil"}${b.regnr ? " - " + b.regnr : ""}`;
      select.appendChild(option);
    });

    if (select.id === "bilValg" && window.aktivBilId) {
      select.value = String(window.aktivBilId);
    } else if (valgt) {
      select.value = valgt;
    }
  });

  if (typeof window.oppdaterAktivBilVisning === "function") {
    window.oppdaterAktivBilVisning();
  }

  // Når bil-listene er fylt, må varelisten på timer oppdateres på nytt.
  // Ellers kan varefeltet bli stående på "Velg aktiv bil først" selv om bil er valgt.
  if (typeof window.fyllVarevalgFraAktivBil === "function") {
    await window.fyllVarevalgFraAktivBil();
  }
}

async function lagreVare() {
  const varenr = document.getElementById("varenr").value.trim();
  const navn = document.getElementById("varenavn").value.trim();
  const beskrivelse = document.getElementById("varebeskrivelse").value.trim();
  const innpris = Number(document.getElementById("vareinnpris")?.value || 0);
  const paslag_faktor = Number(document.getElementById("varepaslag")?.value || 3);
  const prisFelt = document.getElementById("varepris");
  const pris = Number(prisFelt?.value || 0) || round(innpris * paslag_faktor);
  const lager_antall = heltallFraVerdi(document.getElementById("varelagerAntall")?.value || 0);
  const minimum_antall = heltallFraVerdi(document.getElementById("vareMinimumAntall")?.value || 0);
  const mva_sats = Number(document.getElementById("varemva").value || 25);

  if (!navn) {
    alert("Du må skrive varenavn");
    return;
  }

  const { data, error } = await supabaseClient
    .from("varer")
    .insert([
      {
        varenr,
        navn,
        beskrivelse,
        innpris,
        paslag_faktor,
        pris,
        lager_antall,
        minimum_antall,
        mva_sats,
        aktiv: true
      }
    ])
    .select()
    .single();

  if (error) {
    alert("Feil ved lagring: " + error.message);
    return;
  }

  if (lager_antall !== 0 && data?.id) {
    await registrerLagerBevegelse({
      vare_id: data.id,
      fra_type: null,
      fra_id: null,
      til_type: "hovedlager",
      til_id: null,
      antall: lager_antall,
      type: "startlager",
      kommentar: "Startlager ved opprettelse av vare"
    });
  }

  document.getElementById("varenr").value = "";
  document.getElementById("varenavn").value = "";
  document.getElementById("varebeskrivelse").value = "";
  if (document.getElementById("vareinnpris")) document.getElementById("vareinnpris").value = "0";
  if (document.getElementById("varepaslag")) document.getElementById("varepaslag").value = "3";
  document.getElementById("varepris").value = "";
  if (document.getElementById("varelagerAntall")) document.getElementById("varelagerAntall").value = "0";
  if (document.getElementById("vareMinimumAntall")) document.getElementById("vareMinimumAntall").value = "0";
  document.getElementById("varemva").value = "25";

  await hentVarer();
  await fyllVarevalg();
}

async function lagreBil() {
  const navn = document.getElementById("bilNavn")?.value.trim();
  const regnr = document.getElementById("bilRegnr")?.value.trim();

  if (!navn) {
    alert("Skriv bilnavn");
    return;
  }

  const { error } = await supabaseClient
    .from("biler")
    .insert({ navn, regnr });

  if (error) {
    alert("Feil ved lagring av bil: " + error.message);
    return;
  }

  document.getElementById("bilNavn").value = "";
  document.getElementById("bilRegnr").value = "";

  await fyllBilvalg();
  await hentBilLager();
}

async function registrerLagerBevegelse(bevegelse) {
  try {
    await supabaseClient
      .from("lager_bevegelser")
      .insert({
        vare_id: bevegelse.vare_id,
        bil_id: bevegelse.bil_id || null,
        fra_type: bevegelse.fra_type || null,
        fra_id: bevegelse.fra_id || null,
        til_type: bevegelse.til_type || null,
        til_id: bevegelse.til_id || null,
        antall: Number(bevegelse.antall || 0),
        type: bevegelse.type || "justering",
        kommentar: bevegelse.kommentar || null,
        created_at: new Date().toISOString()
      });
  } catch (e) {
    console.warn("Kunne ikke logge lagerbevegelse:", e);
  }
}


function tegnFyllBilListe(varer) {
  const liste = document.getElementById("fyllBilListe");
  if (!liste) return;

  if (!varer || !varer.length) {
    liste.innerHTML = "Ingen varer å fylle bil med.";
    return;
  }

  liste.innerHTML = varer.map(v => {
    const hovedlager = hentVareHovedlager(v);
    const pris = hentVarePris(v);
    return `
      <div style="display:grid; grid-template-columns: 1fr 100px; gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid #eee;">
        <div>
          <b>${v.varenr || ""} ${v.navn || ""}</b><br>
          <span style="font-size:0.9em;">Hovedlager: ${hovedlager} | Utpris: ${formaterKr(pris)} kr</span>
        </div>
        <input class="fyll-bil-antall" data-vare-id="${v.id}" type="number" step="1" min="0" placeholder="0">
      </div>
    `;
  }).join("");
}

async function flyttVareTilBilData(bilId, vareId, antall, visAlert) {
  if (!bilId) throw new Error("Velg bil");
  if (!vareId) throw new Error("Velg vare");
  antall = heltallFraVerdi(antall);
  if (!Number.isInteger(antall) || antall <= 0) throw new Error("Antall må være et heltall større enn 0");

  const { data: vare, error: vareFeil } = await supabaseClient
    .from("varer")
    .select("*")
    .eq("id", vareId)
    .single();

  if (vareFeil || !vare) {
    throw new Error("Fant ikke vare: " + (vareFeil?.message || "ukjent feil"));
  }

  const hovedlager = hentVareHovedlager(vare);
  if (hovedlager < antall) {
    throw new Error(`Ikke nok på hovedlager for ${vare.navn || "vare"}. Hovedlager har ${hovedlager}, du prøver å flytte ${antall}.`);
  }

  const { data: eksisterende, error: eksisterendeFeil } = await supabaseClient
    .from("bil_varer")
    .select("*")
    .eq("bil_id", bilId)
    .eq("vare_id", vareId)
    .maybeSingle();

  if (eksisterendeFeil) {
    throw new Error("Feil ved sjekk av bil-lager: " + eksisterendeFeil.message);
  }

  const nyHovedlager = hovedlager - antall;
  const { error: hovedlagerFeil } = await supabaseClient
    .from("varer")
    .update({ lager_antall: nyHovedlager })
    .eq("id", vareId);

  if (hovedlagerFeil) {
    throw new Error("Feil ved trekk fra hovedlager: " + hovedlagerFeil.message);
  }

  if (eksisterende) {
    const nyttAntall = heltallFraVerdi(eksisterende.antall || 0) + antall;
    const { error } = await supabaseClient
      .from("bil_varer")
      .update({ antall: nyttAntall })
      .eq("id", eksisterende.id);

    if (error) throw new Error("Feil ved oppdatering av bil-lager: " + error.message);
  } else {
    const { error } = await supabaseClient
      .from("bil_varer")
      .insert({ bil_id: bilId, vare_id: vareId, antall });

    if (error) throw new Error("Feil ved innlegging på bil-lager: " + error.message);
  }

  await registrerLagerBevegelse({
    vare_id: vareId,
    bil_id: bilId,
    fra_type: "hovedlager",
    fra_id: null,
    til_type: "bil",
    til_id: bilId,
    antall,
    type: "flytting_til_bil",
    kommentar: "Flyttet vare fra hovedlager til bil"
  });

  if (visAlert) alert("Vare flyttet til bil.");
}

async function fyllBilMedFlereVarer() {
  const bilSelect = document.getElementById("lagerBilValg");
  const bilId = bilSelect?.value;
  const knapp = document.getElementById("fyllBilFlereKnapp");

  if (!bilId) {
    alert("Velg bil først.");
    return;
  }

  const felter = Array.from(document.querySelectorAll("#fyllBilListe input.fyll-bil-antall"));

  const alleValg = felter
    .map(f => {
      const verdi = String(f.value || "0").replace(",", ".").trim();
      const antall = Number(verdi || 0);
      return {
        vareId: f.getAttribute("data-vare-id"),
        antall,
        gyldigHeltall: verdi === "" || (Number.isInteger(antall) && antall >= 0),
        felt: f
      };
    });

  const ugyldige = alleValg.filter(r => !r.gyldigHeltall);
  if (ugyldige.length) {
    alert("Antall må være hele tall. Bruk f.eks. 1, 2 eller 10, ikke 1,5.");
    return;
  }

  const valgte = alleValg.filter(r => r.vareId && r.antall > 0);

  if (!valgte.length) {
    alert("Skriv antall på minst én vare.");
    return;
  }

  // Slå sammen samme vare hvis den finnes flere ganger i lista.
  const summer = new Map();
  valgte.forEach(r => {
    summer.set(r.vareId, (summer.get(r.vareId) || 0) + r.antall);
  });

  const vareIds = Array.from(summer.keys());

  try {
    if (knapp) {
      knapp.disabled = true;
      knapp.textContent = "Flytter varer...";
    }

    // Først kontrollerer vi alle varer. Da unngår vi halvveis flytting.
    const { data: varer, error: varerFeil } = await supabaseClient
      .from("varer")
      .select("*")
      .in("id", vareIds);

    if (varerFeil) throw new Error("Feil ved kontroll av hovedlager: " + varerFeil.message);

    const vareMap = new Map((varer || []).map(v => [String(v.id), v]));
    const feil = [];

    for (const [vareId, antall] of summer.entries()) {
      const vare = vareMap.get(String(vareId));
      if (!vare) {
        feil.push("Fant ikke vare med id " + vareId);
        continue;
      }

      const hovedlager = hentVareHovedlager(vare);
      if (hovedlager < antall) {
        feil.push(`${vare.navn || "Vare"}: hovedlager har ${hovedlager}, du prøver å flytte ${antall}`);
      }
    }

    if (feil.length) {
      alert("Kan ikke fylle bilen:\n\n" + feil.join("\n"));
      return;
    }

    let flyttet = 0;
    const feiletUnderFlytting = [];

    for (const [vareId, antall] of summer.entries()) {
      try {
        await flyttVareTilBilData(bilId, vareId, antall, false);
        flyttet++;
      } catch (e) {
        feiletUnderFlytting.push(e.message || String(e));
        break;
      }
    }

    // Tøm bare feltene som faktisk var valgt hvis minst én ble flyttet.
    if (flyttet > 0) {
      valgte.forEach(r => { r.felt.value = ""; });
    }

    await hentVarer();
    await fyllVarevalg();
    await hentBilLager();

    if (feiletUnderFlytting.length) {
      alert(`Flyttet ${flyttet} varelinje(r), men stoppet med feil:\n\n${feiletUnderFlytting.join("\n")}`);
      return;
    }

    alert(`Flyttet ${flyttet} varelinje(r) til bilen.`);
  } catch (e) {
    alert(e.message || e);
  } finally {
    if (knapp) {
      knapp.disabled = false;
      knapp.textContent = "Overfør alle valgte varer til bil";
    }
  }
}

async function flyttVareTilBil() {
  const bilId = document.getElementById("lagerBilValg")?.value;
  const vareId = document.getElementById("lagerVareValg")?.value;
  const antall = heltallFraVerdi(document.getElementById("lagerFlyttAntall")?.value || 0);

  try {
    await flyttVareTilBilData(bilId, vareId, antall, false);
    document.getElementById("lagerFlyttAntall").value = "1";
    await hentVarer();
    await fyllVarevalg();
    await hentBilLager();
    alert("Vare flyttet til bil.");
  } catch (e) {
    alert(e.message || e);
  }
}

async function hentBilLager() {
  const liste = document.getElementById("bilLagerListe");
  if (!liste) return;

  liste.innerHTML = "Laster bil-lager...";

  const { data, error } = await supabaseClient
    .from("bil_varer")
    .select("id, antall, biler(navn, regnr), varer(varenr, navn, pris)")
    .order("id", { ascending: true });

  if (error) {
    liste.innerHTML = "Feil ved henting av bil-lager: " + error.message;
    return;
  }

  if (!data || !data.length) {
    liste.innerHTML = "Ingen varer ligger på bil ennå.";
    return;
  }

  liste.innerHTML = data.map(rad => `
    <div style="border:1px solid #ddd; padding:8px; margin-bottom:6px; border-radius:6px; background:#fff;">
      <b>${rad.biler?.navn || "Bil"}${rad.biler?.regnr ? " - " + rad.biler.regnr : ""}</b><br>
      ${rad.varer?.varenr || ""} ${rad.varer?.navn || ""}<br>
      Antall i bil: <b>${Number(rad.antall || 0)}</b>
    </div>
  `).join("");
}

async function importerVarer() {
  const filInput = document.getElementById("importVarerFil");

  if (!filInput || !filInput.files.length) {
    alert("Velg Excel- eller CSV-fil");
    return;
  }

  const fil = filInput.files[0];
  const filnavn = (fil.name || "").toLowerCase();
  const reader = new FileReader();

  reader.onload = async function(e) {
    let json = [];

    try {
      if (filnavn.endsWith(".csv")) {
        const tekst = e.target.result;
        const workbook = XLSX.read(tekst, { type: "string" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        json = XLSX.utils.sheet_to_json(sheet);
      } else {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        json = XLSX.utils.sheet_to_json(sheet);
      }
    } catch (err) {
      alert("Kunne ikke lese importfilen: " + (err.message || err));
      return;
    }

    if (!json.length) {
      alert("Fant ingen varer i filen");
      return;
    }

    const varer = json
      .map(v => {
        const innpris = Number(v.innpris || v.innPris || 0);
        const paslag_faktor = Number(v.paslag_faktor || v.påslag_faktor || v.paslag || 3);
        const pris = Number(v.pris || v.utpris || 0) || round(innpris * paslag_faktor);
        return {
          varenr: String(v.varenr || "").trim(),
          navn: String(v.navn || "").trim(),
          beskrivelse: String(v.beskrivelse || "").trim(),
          innpris,
          paslag_faktor,
          pris,
          lager_antall: heltallFraVerdi(v.lager_antall || v.antall || 0),
          minimum_antall: heltallFraVerdi(v.minimum_antall || v.minimum || 0),
          mva_sats: Number(v.mva_sats || v.mva || 25),
          aktiv: true
        };
      })
      .filter(v => v.navn);

    if (!varer.length) {
      alert("Fant ingen varer med navn i filen");
      return;
    }

    const { error } = await supabaseClient
      .from("varer")
      .insert(varer);

    if (error) {
      alert("Importfeil: " + error.message);
      return;
    }

    alert("Importerte " + varer.length + " varer");

    await hentVarer();
    await fyllVarevalg();
    await hentBilLager();
  };

  if ((fil.name || "").toLowerCase().endsWith(".csv")) {
    reader.readAsText(fil, "utf-8");
  } else {
    reader.readAsArrayBuffer(fil);
  }
}

function koblePrisAuto() {
  const innpris = document.getElementById("vareinnpris");
  const paslag = document.getElementById("varepaslag");
  const pris = document.getElementById("varepris");

  const oppdater = () => {
    if (!innpris || !paslag || !pris) return;
    const inn = Number(innpris.value || 0);
    const faktor = Number(paslag.value || 3);
    if (inn > 0 && (!pris.value || Number(pris.value || 0) === 0)) {
      pris.value = round(inn * faktor);
    }
  };

  if (innpris) innpris.addEventListener("change", oppdater);
  if (paslag) paslag.addEventListener("change", () => {
    if (pris) pris.value = "";
    oppdater();
  });
}

function round(tall) {
  return Math.round(Number(tall || 0) * 100) / 100;
}

document.addEventListener("DOMContentLoaded", () => {
  const varerKnapp = document.getElementById("varerKnapp");
  const lagreVareKnapp = document.getElementById("lagreVareKnapp");
  const tilbakeFraVarerKnapp = document.getElementById("tilbakeFraVarerKnapp");
  const importVarerKnapp = document.getElementById("importVarerKnapp");
  const lagreBilKnapp = document.getElementById("lagreBilKnapp");
  const flyttVareTilBilKnapp = document.getElementById("flyttVareTilBilKnapp");
  const fyllBilFlereKnapp = document.getElementById("fyllBilFlereKnapp");

  if (varerKnapp) varerKnapp.addEventListener("click", visVarer);
  if (lagreVareKnapp) lagreVareKnapp.addEventListener("click", lagreVare);
  if (tilbakeFraVarerKnapp) tilbakeFraVarerKnapp.addEventListener("click", tilbakeFraVarer);
  if (importVarerKnapp) importVarerKnapp.addEventListener("click", importerVarer);
  if (lagreBilKnapp) lagreBilKnapp.addEventListener("click", lagreBil);
  if (flyttVareTilBilKnapp) flyttVareTilBilKnapp.addEventListener("click", flyttVareTilBil);
  // Fler-vare-knappen bruker onclick i HTML som ekstra robust fallback.

  koblePrisAuto();
  fyllVarevalg();
  fyllBilvalg();
});

window.visVarer = visVarer;
window.hentVarer = hentVarer;
window.fyllVarevalg = fyllVarevalg;
window.fyllBilvalg = fyllBilvalg;
window.hentBilLager = hentBilLager;
window.registrerLagerBevegelse = registrerLagerBevegelse;
window.fyllBilMedFlereVarer = fyllBilMedFlereVarer;
