async function lastFirma() {
  const { data, error } = await supabaseClient
    .from("firma")
    .select("*")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Feil ved henting av firma:", error);
    alert("Feil ved henting av firma: " + error.message);
    return;
  }

  const firma = data || {};

  document.getElementById("firmaNavn").value = firma.navn || "";
  document.getElementById("firmaAdresse").value = firma.adresse || "";
  document.getElementById("firmaOrgnr").value = firma.orgnr || firma.org_nr || "";
  const mvaFelt = document.getElementById("firmaMvanr");
  if (mvaFelt) mvaFelt.value = firma.mva_nr || firma.mvanr || "";
  document.getElementById("firmaTelefon").value = firma.telefon || "";
  document.getElementById("firmaEpost").value = firma.epost || firma.email || "";
  const kontonrFelt = document.getElementById("firmaKontonr");
  if (kontonrFelt) kontonrFelt.value = firma.kontonr || firma.konto_nr || "";
  document.getElementById("firmaKontaktperson").value = firma.kontaktperson || "";
  document.getElementById("firmaAndreOpplysninger").value = firma.andre_opplysninger || "";

  const preview = document.getElementById("firmaLogoPreview");
  if (preview) {
    if (firma.logo) {
      preview.src = firma.logo;
      preview.classList.remove("hidden");
    } else {
      preview.removeAttribute("src");
      preview.classList.add("hidden");
    }
  }

  visFirma(firma);
}

function leggTilHvisUtfylt(objekt, feltnavn, elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const verdi = element.value.trim();
  if (verdi !== "") objekt[feltnavn] = verdi;
}

async function lagreFirma() {
  const melding = document.getElementById("firmaMelding");
  if (melding) melding.textContent = "";

  const { data: eksisterende, error: hentError } = await supabaseClient
    .from("firma")
    .select("*")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (hentError) {
    console.error("Feil ved henting av firma før lagring:", hentError);
    if (melding) melding.textContent = "Feil ved henting av firma: " + hentError.message;
    else alert("Feil ved henting av firma: " + hentError.message);
    return;
  }

  const firma = {};

  // Viktig: tomme felt overskriver ikke eksisterende opplysninger.
  // Dette hindrer at firma-info blir borte hvis skjemaet ikke er ferdig utfylt.
  leggTilHvisUtfylt(firma, "navn", "firmaNavn");
  leggTilHvisUtfylt(firma, "adresse", "firmaAdresse");
  leggTilHvisUtfylt(firma, "orgnr", "firmaOrgnr");
  leggTilHvisUtfylt(firma, "mva_nr", "firmaMvanr");
  leggTilHvisUtfylt(firma, "telefon", "firmaTelefon");
  leggTilHvisUtfylt(firma, "epost", "firmaEpost");
  leggTilHvisUtfylt(firma, "kontonr", "firmaKontonr");
  leggTilHvisUtfylt(firma, "kontaktperson", "firmaKontaktperson");
  leggTilHvisUtfylt(firma, "andre_opplysninger", "firmaAndreOpplysninger");

  const logoPreview = document.getElementById("firmaLogoPreview");
  if (logoPreview && logoPreview.src && logoPreview.src.startsWith("data:image")) {
    firma.logo = logoPreview.src;
  }

  let result;

  if (eksisterende && eksisterende.id) {
    if (Object.keys(firma).length === 0) {
      if (melding) melding.textContent = "Ingen nye firmaopplysninger å lagre.";
      return;
    }

    result = await supabaseClient
      .from("firma")
      .update(firma)
      .eq("id", eksisterende.id)
      .select();
  } else {
    result = await supabaseClient
      .from("firma")
      .insert([firma])
      .select();
  }

  if (result.error) {
    console.error("Feil ved lagring av firma:", result.error);
    if (melding) melding.textContent = "Feil ved lagring av firma: " + result.error.message;
    else alert("Feil ved lagring av firma: " + result.error.message);
    return;
  }

  if (melding) melding.textContent = "Firma lagret i databasen";
  else alert("Firma lagret i databasen");
  await lastFirma();
}

function lastInnLogo(event) {
  const fil = event.target.files[0];
  if (!fil) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    const preview = document.getElementById("firmaLogoPreview");
    preview.src = e.target.result;
    preview.classList.remove("hidden");
  };

  reader.readAsDataURL(fil);
}

function visFirma(firma) {
  const visning = document.getElementById("firmaVisning");
  if (!visning) return;

  visning.innerHTML = `
    <strong>${firma.navn || ""}</strong><br>
    ${firma.adresse || ""}<br>
    Org.nr: ${firma.orgnr || firma.org_nr || ""}<br>
    MVA-nr: ${firma.mva_nr || firma.mvanr || ""}<br>
    Telefon: ${firma.telefon || ""}<br>
    E-post: ${firma.epost || firma.email || ""}<br>
    Konto: ${firma.kontonr || firma.konto_nr || ""}<br>
    Kontaktperson: ${firma.kontaktperson || ""}<br>
    ${firma.andre_opplysninger || ""}
  `;
}

async function fyllFirmaSkjema() {
  await lastFirma();
}

async function tegnFirmaInfo() {
  await lastFirma();
}

window.lastFirma = lastFirma;
window.lagreFirma = lagreFirma;
window.lastInnLogo = lastInnLogo;
window.fyllFirmaSkjema = fyllFirmaSkjema;
window.tegnFirmaInfo = tegnFirmaInfo;
