let kunder = [];
let prosjekter = [];


async function hentInnloggetFirmaIderForKunder() {
  if (!window.supabaseClient || !supabaseClient.auth) return [];

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  const user = userData && userData.user ? userData.user : null;
  const email = String(
    (user && user.email) ||
    window.innloggetEpost ||
    localStorage.getItem("handInnloggetEpost") ||
    localStorage.getItem("innloggetEpost") ||
    ""
  ).trim().toLowerCase();

  if (userError || !user || !email) {
    console.error("Fant ikke innlogget bruker/epost ved henting av kunder:", userError);
    settKundeMelding("Fant ikke innlogget e-post. Logg ut og inn igjen.");
    return [];
  }

  const rolleFraMinne = String(window.innloggetRolle || localStorage.getItem("handInnloggetRolle") || "").toLowerCase();
  if (rolleFraMinne === "sysadmin" || rolleFraMinne === "systemadmin") {
    return ["__SYSADMIN_ALL__"];
  }

  // VIKTIG: I denne databasen er hand_ansatt.user_id ofte tom.
  // Derfor må firma til ansatt finnes via epost, ikke user_id.
  const ansattRes = await supabaseClient
    .from("hand_ansatt")
    .select("id, navn, epost, firma_id")
    .ilike("epost", email)
    .limit(1);

  if (!ansattRes.error && ansattRes.data && ansattRes.data.length && ansattRes.data[0].firma_id) {
    const firmaId = String(ansattRes.data[0].firma_id);
    window.aktivFirmaId = firmaId;
    window.handFirmaId = firmaId;
    window.handAnsattFirmaId = firmaId;
    localStorage.setItem("aktivFirmaId", firmaId);
    localStorage.setItem("handFirmaId", firmaId);
    localStorage.setItem("firma_id", firmaId);
    return [firmaId];
  }

  // Reserve hvis epost ikke finnes i hand_ansatt, men hand_firma_bruker er riktig.
  const fbRes = await supabaseClient
    .from("hand_firma_bruker")
    .select("firma_id")
    .eq("user_id", user.id);

  if (!fbRes.error && fbRes.data && fbRes.data.length) {
    const firmaIder = [...new Set((fbRes.data || []).map(r => String(r.firma_id || "")).filter(Boolean))];
    if (firmaIder.length === 1) {
      window.aktivFirmaId = firmaIder[0];
      window.handFirmaId = firmaIder[0];
      localStorage.setItem("aktivFirmaId", firmaIder[0]);
      localStorage.setItem("handFirmaId", firmaIder[0]);
      localStorage.setItem("firma_id", firmaIder[0]);
    }
    return firmaIder;
  }

  console.error("Fant ikke firma for kundevisning", { email, ansattError: ansattRes.error, firmaBrukerError: fbRes.error });
  settKundeMelding("Fant ikke ansatt/firma for " + email + ". Sjekk hand_ansatt.epost og firma_id.");
  return [];
}

function settKundeMelding(tekst) {
  const el = document.getElementById("kundeMelding");
  if (el) el.textContent = tekst || "";
}

async function lastKunder() {
  const firmaIder = await hentInnloggetFirmaIderForKunder();

  if (!firmaIder.length) {
    kunder = [];
    prosjekter = [];
    window.kunder = kunder;
    window.prosjekter = prosjekter;
    settKundeMelding("Innlogget bruker er ikke koblet til firma.");
    visKunder();
    fyllKundeDropdown();
    fyllFakturaKundeDropdown();
    return;
  }

  let kundeQuery = supabaseClient
    .from("hand_kunde")
    .select("*")
    .order("navn", { ascending: true });

  const erSysadminAlle = firmaIder.includes("__SYSADMIN_ALL__");
  if (!erSysadminAlle) {
    kundeQuery = kundeQuery.in("firma_id", firmaIder);
  }

  const { data, error } = await kundeQuery;

  if (error) {
    console.error("Feil ved henting av kunder:", error);
    settKundeMelding("Feil ved henting av kunder: " + error.message);
    return;
  }

  kunder = erSysadminAlle
    ? (data || [])
    : (data || []).filter(k => firmaIder.map(String).includes(String(k.firma_id)));
  window.kunder = kunder;

  const kundeIder = kunder.map(k => k.id).filter(Boolean);

  if (kundeIder.length) {
    const prosjektResult = await supabaseClient
      .from("hand_prosjekt")
      .select("*")
      .in("kunde_id", kundeIder)
      .order("navn", { ascending: true });

    prosjekter = prosjektResult.error ? [] : prosjektResult.data || [];
  } else {
    prosjekter = [];
  }

  window.prosjekter = prosjekter;

  visKunder();
  fyllKundeDropdown();
  fyllFakturaKundeDropdown();
}

async function lagreKunde() {
  const id = document.getElementById("kundeId")?.value || "";

  const firmaIder = await hentInnloggetFirmaIderForKunder();
  const firmaId = firmaIder.length === 1
    ? firmaIder[0]
    : (
        localStorage.getItem('handFirmaId') ||
        localStorage.getItem('aktivFirmaId') ||
        window.handFirmaId ||
        ''
      );

  const kunde = {
    navn: document.getElementById("kundeNavn").value.trim(),
    adresse: document.getElementById("kundeAdresse").value.trim(),
    epost: document.getElementById("kundeEpost").value.trim(),
    kontaktperson: document.getElementById("kundeKontaktperson").value.trim(),
    kontonr: document.getElementById("kundeKontonr").value.trim(),
    firma_id: firmaId || null
  };

  if (!firmaId) {
    settKundeMelding("Velg firma før kunde lagres.");
    return;
  } ;

  if (!kunde.navn) {
    settKundeMelding("Kundenavn må fylles ut.");
    return;
  }

  const result = id
    ? await supabaseClient.from("hand_kunde").update(kunde).eq("id", id).select()
    : await supabaseClient.from("hand_kunde").insert([kunde]).select();

  if (result.error) {
    settKundeMelding("Feil ved lagring av kunde: " + result.error.message);
    return;
  }

  // RIL FIX 7088:
  // Etter lagring skal kundeskjemaet bli blankt, klart for neste kunde.
  settKundeMelding("Kunde lagret.");

  await lastKunder();

  nullstillKundeSkjema();

  // Behold meldingen etter nullstilling.
  settKundeMelding("Kunde lagret. Skjemaet er klart for ny kunde.");
}

function visProsjektVindu() {
  const kundeId = document.getElementById("kundeId")?.value || "";

  if (!kundeId) {
    settKundeMelding("Lagre eller velg kunde først.");
    return;
  }

  const overlay = document.getElementById("prosjektOverlay");
  const vindu = document.getElementById("prosjektVindu");

  if (overlay) overlay.style.display = "block";
  if (vindu) vindu.style.display = "block";

  nullstillProsjektFelter();
}

function skjulProsjektVindu() {
  const overlay = document.getElementById("prosjektOverlay");
  const vindu = document.getElementById("prosjektVindu");

  if (overlay) overlay.style.display = "none";
  if (vindu) vindu.style.display = "none";

  nullstillProsjektFelter();
}

function nullstillProsjektFelter() {
  const prosjektNr = document.getElementById("prosjektNr");
  const prosjektNavn = document.getElementById("prosjektNavn");
  const prosjektBeskrivelse = document.getElementById("prosjektBeskrivelse");

  if (prosjektNr) prosjektNr.value = "";
  if (prosjektNavn) prosjektNavn.value = "";
  if (prosjektBeskrivelse) prosjektBeskrivelse.value = "";
}

async function lagreProsjektForValgtKunde() {
  const kundeId = document.getElementById("kundeId")?.value || "";

  if (!kundeId) {
    settKundeMelding("Lagre eller velg kunde først.");
    return;
  }

  const prosjektNr = document.getElementById("prosjektNr")?.value?.trim() || "";
  const prosjektNavn = document.getElementById("prosjektNavn")?.value?.trim() || "";
  const prosjektBeskrivelse = document.getElementById("prosjektBeskrivelse")?.value?.trim() || "";

  if (!prosjektNr && !prosjektNavn) {
    settKundeMelding("Fyll ut prosjektnr eller prosjektnavn.");
    return;
  }

  const { error } = await supabaseClient
    .from("hand_prosjekt")
    .insert([{
      kunde_id: kundeId,
      prosjektnr: prosjektNr,
      navn: prosjektNavn,
      beskrivelse: prosjektBeskrivelse,
      aktiv: true
    }]);

  if (error) {
    console.error("Feil ved lagring av prosjekt:", error);
    settKundeMelding("Feil ved lagring av prosjekt: " + error.message);
    return;
  }

  nullstillProsjektFelter();
  skjulProsjektVindu();

  await lastKunder();

  const valgtKunde = kunder.find(k => String(k.id || "") === String(kundeId || ""));
  if (valgtKunde) {
    document.getElementById("kundeId").value = valgtKunde.id || "";
    document.getElementById("kundeNavn").value = valgtKunde.navn || "";
    document.getElementById("kundeAdresse").value = valgtKunde.adresse || "";
    document.getElementById("kundeEpost").value = valgtKunde.epost || "";
    document.getElementById("kundeKontaktperson").value = valgtKunde.kontaktperson || "";
    document.getElementById("kundeKontonr").value = valgtKunde.kontonr || "";
  } else {
    document.getElementById("kundeId").value = kundeId;
  }

  settKundeMelding("Prosjekt lagret. Du trenger ikke lagre kunde på nytt.");
}

function visKunder() {
  const liste = document.getElementById("kundeListe");
  if (!liste) return;

  liste.innerHTML = "";

  if (!kunder.length) {
    liste.innerHTML = "<p>Ingen kunder funnet.</p>";
    return;
  }

  kunder.forEach(kunde => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.padding = "14px";
    div.style.marginBottom = "14px";
    div.style.borderBottom = "1px solid #444";

    const kundeProsjekter = prosjekter.filter(p =>
      String(p.kunde_id || "") === String(kunde.id || "")
    );

    const prosjektHtml = kundeProsjekter.length
      ? `
        <div style="margin-top:10px;">
          <strong>Prosjekter:</strong>
          <ul style="margin-top:6px;">
            ${kundeProsjekter.map(p => `
              <li>
                ${p.prosjektnr || ""} ${p.navn || ""}
                ${p.beskrivelse ? `<br><small>${p.beskrivelse}</small>` : ""}
              </li>
            `).join("")}
          </ul>
        </div>
      `
      : `
        <div style="margin-top:10px;">
          <em>Ingen prosjekter</em>
        </div>
      `;

    div.innerHTML = `
      <div style="line-height:1.35;">
        <strong>${kunde.navn || ""}</strong><br>
        Kundenr: ${kunde.kundenr || kunde.kunde_nr || ""}<br>
        ${kunde.adresse || ""}<br>
        ${kunde.epost || ""}<br>
        ${kunde.kontaktperson || ""}<br>
        ${kunde.kontonr || ""}
      </div>

      <div style="margin-top:10px; margin-bottom:4px;">
        <button
          type="button"
          class="secondary"
          onclick="redigerKunde('${kunde.id}')">
          Rediger
        </button>
      </div>

      ${prosjektHtml}
    `;

    liste.appendChild(div);
  });
}


function redigerKunde(id) {
  const kunde = kunder.find(k => String(k.id) === String(id));

  if (!kunde) {
    alert("Fant ikke kunde");
    return;
  }

  document.getElementById("kundeId").value = kunde.id;
  document.getElementById("kundeNavn").value = kunde.navn || "";
  document.getElementById("kundeAdresse").value = kunde.adresse || "";
  document.getElementById("kundeEpost").value = kunde.epost || "";
  document.getElementById("kundeKontaktperson").value = kunde.kontaktperson || "";
  document.getElementById("kundeKontonr").value = kunde.kontonr || "";

  nullstillProsjektFelter();
  skjulProsjektVindu();

  settKundeMelding("Redigerer kunde. Du kan legge til flere prosjekter.");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function nullstillKundeSkjema() {
  document.getElementById("kundeId").value = "";
  document.getElementById("kundeNavn").value = "";
  document.getElementById("kundeAdresse").value = "";
  document.getElementById("kundeEpost").value = "";
  document.getElementById("kundeKontaktperson").value = "";
  document.getElementById("kundeKontonr").value = "";

  nullstillProsjektFelter();
  skjulProsjektVindu();
  settKundeMelding("");
}

function hentKundeNr(kunde) {
  return kunde?.kundenr || kunde?.kunde_nr || "";
}

function finnKundeFraValg(verdi) {
  const liste = Array.isArray(window.kunder) && window.kunder.length ? window.kunder : kunder;

  const valg = document.getElementById("kundeValg");
  const opt = valg && valg.options ? valg.options[valg.selectedIndex] : null;

  const kandidater = [
    verdi,
    valg ? valg.value : "",
    opt && opt.value,
    opt && opt.dataset ? opt.dataset.kundeId : "",
    opt && opt.dataset ? opt.dataset.id : "",
    opt && opt.dataset ? opt.dataset.kundenr : "",
    opt && opt.dataset ? opt.dataset.kundeNr : ""
  ];

  if (opt && opt.textContent) {
    const tekst = String(opt.textContent).trim();
    kandidater.push(tekst);
    const m = tekst.match(/^\s*([^\s\-–—]+)\s*[-–—]\s*/);
    if (m) kandidater.push(m[1]);
  }

  const normaliser = x => String(x || "").trim().toLowerCase();
  const sett = new Set(kandidater.map(normaliser).filter(Boolean));

  return liste.find(k => {
    const kundeVerdier = [
      k.id,
      k.kunde_id,
      k.kundenr,
      k.kunde_nr,
      k.nr,
      k.kundnr,
      k.kundenummer
    ].map(normaliser).filter(Boolean);

    return kundeVerdier.some(x => sett.has(x));
  });
}

function fyllKundeDropdown() {
  const valg = document.getElementById("kundeValg");
  if (!valg) return;

  valg.innerHTML = "";

  const tomOption = document.createElement("option");
  tomOption.value = "";
  tomOption.textContent = "Velg kunde";
  tomOption.selected = true;

  valg.appendChild(tomOption);

  kunder.forEach(kunde => {
    const option = document.createElement("option");
    option.value = kunde.id;
    const nr = hentKundeNr(kunde) || kunde.id || "";
    option.dataset.kundenr = nr;
    option.textContent = nr ? nr + " - " + (kunde.navn || "") : (kunde.navn || "");
    valg.appendChild(option);
  });

  valg.selectedIndex = 0;
  valg.value = "";

  const kundeNrVisning = document.getElementById("kundeNrVisning");
  if (kundeNrVisning) kundeNrVisning.value = "";
}

function fyllFakturaKundeDropdown() {
  const valg = document.getElementById("fakturaKundeValg");
  if (!valg) return;

  const gammelVerdi = valg.value || "";

  valg.innerHTML = "";

  const tomOption = document.createElement("option");
  tomOption.value = "";
  tomOption.textContent = "Velg kunde";
  valg.appendChild(tomOption);

  kunder.forEach(kunde => {
    const option = document.createElement("option");
    option.value = kunde.id;
    const nr = kunde.kundenr || kunde.kunde_nr || kunde.id || "";
    option.textContent = nr ? nr + " - " + (kunde.navn || "") : (kunde.navn || "");
    valg.appendChild(option);
  });

  if (gammelVerdi) {
    valg.value = gammelVerdi;
  }
}

function visKundeNavn() {
  const valg = document.getElementById("kundeValg");
  if (!valg) return;

  const kunde = finnKundeFraValg(valg.value);
  const nrVisning = document.getElementById("kundeNrVisning");
  const opt = valg.options && valg.options[valg.selectedIndex];
  let nr = kunde ? hentKundeNr(kunde) : "";
  if (!nr && opt && opt.dataset) nr = opt.dataset.kundenr || "";
  if (!nr && opt && opt.textContent) {
    const m = String(opt.textContent).match(/^\s*([^\s\-–—]+)\s*[-–—]\s+/);
    if (m) nr = m[1];
  }

  if (nrVisning) {
    nrVisning.value = nr || "";
  }
}

// RIL: Kundenr må fylles også når kundelisten lastes etter at siden er tegnet.
(function(){
  function kobleKundenr(){
    const valg = document.getElementById("kundeValg");
    if (!valg) return;
    if (!valg.__rilKundenrKoblet) {
      valg.__rilKundenrKoblet = true;
      valg.addEventListener("change", visKundeNavn);
      valg.addEventListener("input", visKundeNavn);
      valg.addEventListener("click", function(){ setTimeout(visKundeNavn, 0); });
    }
    visKundeNavn();
  }
  document.addEventListener("DOMContentLoaded", kobleKundenr);
  document.addEventListener("handPartialerLastet", function(){ setTimeout(kobleKundenr, 0); setTimeout(kobleKundenr, 300); });
  window.addEventListener("load", function(){ setTimeout(kobleKundenr, 0); setTimeout(kobleKundenr, 500); });
})();

window.kunder = kunder;
window.prosjekter = prosjekter;

window.lastKunder = lastKunder;
window.fyllFakturaKundeDropdown = fyllFakturaKundeDropdown;
window.lagreKunde = lagreKunde;
window.redigerKunde = redigerKunde;
window.nullstillKundeSkjema = nullstillKundeSkjema;

window.visProsjektVindu = visProsjektVindu;
window.skjulProsjektVindu = skjulProsjektVindu;
window.lagreProsjektForValgtKunde = lagreProsjektForValgtKunde;

window.fyllKundeDropdown = fyllKundeDropdown;
window.visKundeNavn = visKundeNavn;
window.hentKundeNr = hentKundeNr;
window.finnKundeFraValg = finnKundeFraValg;

window.tegnKundeListe = visKunder;
window.tegnKunder = fyllKundeDropdown;