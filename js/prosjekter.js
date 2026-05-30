console.log("prosjekter.js lastet");

window.prosjekter = window.prosjekter || [];

async function lastProsjekter() {
  if (typeof supabaseClient === "undefined") {
    console.warn("Supabase er ikke lastet, kan ikke hente prosjekter.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("prosjekter")
    .select("*")
    .order("navn", { ascending: true });

  if (error) {
    console.error("Feil ved henting av prosjekter:", error);
    const melding = document.getElementById("timerMelding") || document.getElementById("skjemaMelding");
    if (melding) melding.textContent = "Feil ved henting av prosjekter: " + error.message;
    return;
  }

  window.prosjekter = data || [];
  fyllProsjektDropdown();
}

function hentValgtKundeIdForProsjekt() {
  const kundeValg = document.getElementById("kundeValg");
  return kundeValg ? String(kundeValg.value || "") : "";
}

function fyllProsjektDropdown() {
  const prosjektValg = document.getElementById("prosjektValg");
  if (!prosjektValg) return;

  const kundeId = hentValgtKundeIdForProsjekt();

  prosjektValg.innerHTML = "";

  const tom = document.createElement("option");
  tom.value = "";
  tom.textContent = kundeId ? "Velg prosjekt" : "Velg kunde først";
  prosjektValg.appendChild(tom);

  if (!kundeId) {
    prosjektValg.value = "";
    return;
  }

  const liste = (window.prosjekter || []).filter(p =>
    String(p.kunde_id || "") === String(kundeId) &&
    String(p.status || "Aktiv").toLowerCase() !== "inaktiv"
  );

  liste.forEach(prosjekt => {
    const option = document.createElement("option");
    option.value = prosjekt.id;
    option.textContent = `${prosjekt.prosjekt_nr || ""} ${prosjekt.navn || ""}`.trim();
    prosjektValg.appendChild(option);
  });

  if (!liste.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Ingen prosjekter på denne kunden";
    prosjektValg.appendChild(option);
  }

  prosjektValg.value = "";
}

function hentProsjektNavn(prosjektId) {
  const prosjekt = (window.prosjekter || []).find(p =>
    String(p.id || "") === String(prosjektId || "")
  );

  if (!prosjekt) return "";
  return `${prosjekt.prosjekt_nr || ""} ${prosjekt.navn || ""}`.trim();
}

function kobleProsjektTilKundevalg() {
  const kundeValg = document.getElementById("kundeValg");
  if (!kundeValg) return;

  kundeValg.addEventListener("change", fyllProsjektDropdown);
}

document.addEventListener("DOMContentLoaded", kobleProsjektTilKundevalg);

window.lastProsjekter = lastProsjekter;
window.fyllProsjektDropdown = fyllProsjektDropdown;
window.hentProsjektNavn = hentProsjektNavn;
