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
    const logoSrc = firma.logo_url || firma.logo || "";
    if (logoSrc) {
      preview.src = logoSrc;
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


function tryggLogoFilnavn(filnavn) {
  const navn = String(filnavn || "logo.png")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9._-]+/g, "_");

  return navn || "logo.png";
}

async function lastOppFirmaLogoHvisValgt() {
  const fil = window.firmaLogoFil;

  if (!fil) return null;

  const filnavn = tryggLogoFilnavn(fil.name);
  const sti = "firma/logo-" + Date.now() + "-" + filnavn;

  const { error: uploadError } = await supabaseClient
    .storage
    .from("logoer")
    .upload(sti, fil, {
      cacheControl: "3600",
      upsert: true
    });

  if (uploadError) {
    throw new Error("Kunne ikke laste opp logo: " + uploadError.message);
  }

  const { data } = supabaseClient
    .storage
    .from("logoer")
    .getPublicUrl(sti);

  return data?.publicUrl || null;
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

  try {
    const logoUrl = await lastOppFirmaLogoHvisValgt();
    if (logoUrl) {
      firma.logo_url = logoUrl;

      // Ikke lagre store base64-bilder i databasen når Storage brukes.
      firma.logo = null;
    }
  } catch (e) {
    console.error(e);
    if (melding) melding.textContent = e.message || String(e);
    else alert(e.message || String(e));
    return;
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

  window.firmaLogoFil = null;
  if (typeof window.nullstillPdfLogoCache === "function") {
    window.nullstillPdfLogoCache();
  }

  if (melding) melding.textContent = "Firma lagret i databasen";
  else alert("Firma lagret i databasen");
  await lastFirma();
}

function lastInnLogo(event) {
  const fil = event.target.files[0];
  if (!fil) return;

  window.firmaLogoFil = fil;

  const preview = document.getElementById("firmaLogoPreview");
  if (preview) {
    preview.src = URL.createObjectURL(fil);
    preview.classList.remove("hidden");
  }
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
    Logo: ${firma.logo_url ? "Lagret i Storage" : (firma.logo ? "Lagret i database" : "Ikke valgt")}<br>
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
