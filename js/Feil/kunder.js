let kunder = [];
let prosjekter = [];

function settKundeMelding(tekst) {
  const el = document.getElementById("kundeMelding");
  if (el) el.textContent = tekst || "";
}

async function lastKunder() {
  const { data, error } = await supabaseClient
    .from("kunder")
    .select("*")
    .order("navn", { ascending: true });

  if (error) {
    console.error("Feil ved henting av kunder:", error);
    settKundeMelding("Feil ved henting av kunder: " + error.message);
    return;
  }

  kunder = data || [];
  window.kunder = kunder;

  const prosjektResult = await supabaseClient
    .from("prosjekter")
    .select("*")
    .order("navn", { ascending: true });

  prosjekter = prosjektResult.error ? [] : prosjektResult.data || [];
  window.prosjekter = prosjekter;

  visKunder();
  fyllKundeDropdown();
  fyllFakturaKundeDropdown();
}

async function lagreKunde() {
  const id = document.getElementById("kundeId")?.value || "";

  const kunde = {
    navn: document.getElementById("kundeNavn").value.trim(),
    adresse: document.getElementById("kundeAdresse").value.trim(),
    epost: document.getElementById("kundeEpost").value.trim(),
    kontaktperson: document.getElementById("kundeKontaktperson").value.trim(),
    kontonr: document.getElementById("kundeKontonr").value.trim()
  };

  if (!kunde.navn) {
    settKundeMelding("Kundenavn må fylles ut.");
    return;
  }

  const result = id
    ? await supabaseClient.from("kunder").update(kunde).eq("id", id).select()
    : await supabaseClient.from("kunder").insert([kunde]).select();

  if (result.error) {
    settKundeMelding("Feil ved lagring av kunde: " + result.error.message);
    return;
  }

  const lagretKundeId = result.data?.[0]?.id || id;
  document.getElementById("kundeId").value = lagretKundeId;

  settKundeMelding("Kunde lagret. Du kan legge til prosjekter.");

  await lastKunder();

  document.getElementById("kundeId").value = lagretKundeId;
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
    .from("prosjekter")
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

  settKundeMelding("Prosjekt lagret. Du kan legge til et nytt prosjekt.");

  await lastKunder();

  document.getElementById("kundeId").value = kundeId;

  const overlay = document.getElementById("prosjektOverlay");
  const vindu = document.getElementById("prosjektVindu");

  if (overlay) overlay.style.display = "block";
  if (vindu) vindu.style.display = "block";
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
  return kunder.find(k =>
    String(k.id || "") === String(verdi) ||
    String(k.kundenr || "") === String(verdi) ||
    String(k.kunde_nr || "") === String(verdi)
  );
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
    option.textContent = kunde.navn || "";
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

  if (nrVisning) {
    nrVisning.value = kunde ? hentKundeNr(kunde) : "";
  }
}

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