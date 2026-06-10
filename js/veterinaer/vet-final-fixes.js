/* Split from vet-app.js lines 3736-6082. Keep load order. */
/* ===== FINAL MENY/DYREEIER FIX ===== */
function vetSkjulGamleHurtigknapper() {
  const wrap = document.getElementById("vetPasientHurtigKnapper");
  if (wrap) {
    wrap.remove();
  }
}

function nyDyreeier() {
  ["dyreeierId","dyreeierNavn","dyreeierTelefon","dyreeierEpost","dyreeierAdresse"].forEach(id => vetSett(id, ""));
  vetSett("dyreeierVelgForDyr", "");
  fyllDyreeierDyrValg("");
  visVetSide("eierSide");
  const navn = document.getElementById("dyreeierNavn");
  if (navn) navn.focus();
}

function nyPasient() {
  ["dyrId","dyrNavn","dyrArt","dyrRase","dyrFodselsdato","dyrKjonn","dyrIdmerking"].forEach(id => vetSett(id, ""));
  fyllDyreeierValg();
  visVetSide("dyrSide");
  const navn = document.getElementById("dyrNavn");
  if (navn) navn.focus();
}

async function lagreDyreeier() {
  vetMelding("dyreeierMelding", "");

  const rad = leggTilKlinikkHvisVanligBruker({
    navn: vetTekst("dyreeierNavn"),
    telefon: vetTekst("dyreeierTelefon") || null,
    epost: vetTekst("dyreeierEpost") || null,
    adresse: vetTekst("dyreeierAdresse") || null
  });

  if (!rad.navn) {
    vetMelding("dyreeierMelding", "Skriv navn på dyreeier.");
    return;
  }

  const id = vetTekst("dyreeierId");
  const query = id
    ? supabaseClient.from("vet_dyreeiere").update(rad).eq("id", id).select("id").single()
    : supabaseClient.from("vet_dyreeiere").insert(rad).select("id").single();

  const { data, error } = await query;

  if (error) {
    vetMelding("dyreeierMelding", "Feil ved lagring av dyreeier: " + error.message);
    return;
  }

  const lagretId = data?.id || id;

  await lastDyreeiere();

  vetSett("dyreeierId", lagretId || "");
  fyllDyreeierVelgForDyr();
  vetSett("dyreeierVelgForDyr", lagretId || "");
  fyllDyreeierDyrValg(lagretId || "");

  const eier = (vetDyreeiere || []).find(e => String(e.id) === String(lagretId));
  if (eier) {
    vetSett("dyreeierNavn", eier.navn || "");
    vetSett("dyreeierTelefon", eier.telefon || "");
    vetSett("dyreeierEpost", eier.epost || "");
    vetSett("dyreeierAdresse", eier.adresse || "");
  }

  vetMelding("dyreeierMelding", "Dyreeier lagret.");
}

function toggleVetArbeidMeny() {
  vetSkjulGamleHurtigknapper();
  const meny = document.getElementById("vetArbeidMeny");
  const adminMeny = document.getElementById("vetAdminMeny");
  if (!meny) return;

  if (adminMeny) {
    adminMeny.classList.add("skjult");
    adminMeny.style.display = "none";
  }

  const skalVises = meny.classList.contains("skjult") || meny.style.display === "none";
  meny.classList.toggle("skjult", !skalVises);
  meny.style.display = skalVises ? "block" : "none";
}

function toggleVetAdminMeny() {
  vetSkjulGamleHurtigknapper();
  const meny = document.getElementById("vetAdminMeny");
  const arbeidMeny = document.getElementById("vetArbeidMeny");
  if (!meny) return;

  if (arbeidMeny) {
    arbeidMeny.classList.add("skjult");
    arbeidMeny.style.display = "none";
  }

  const skalVises = meny.classList.contains("skjult") || meny.style.display === "none";
  meny.classList.toggle("skjult", !skalVises);
  meny.style.display = skalVises ? "block" : "none";
}

function oppdaterVetMenySynlighet() {
  oppdaterVetToppInfo();
  vetSkjulGamleHurtigknapper();

  const admin = erKlinikkAdmin();
  const adminKnapp = document.getElementById("vetAdminKnapp");

  if (adminKnapp) adminKnapp.style.display = admin ? "inline-block" : "none";

  ["vetArbeidMeny","vetAdminMeny"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("skjult");
      el.style.display = "none";
    }
  });
}

function vetKobleFinaleKnapper() {
  vetSkjulGamleHurtigknapper();

  const koble = (id, fn) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.finalKoblet === "1") return;
    el.dataset.finalKoblet = "1";
    el.addEventListener("click", fn);
  };

  koble("vetArbeidKnapp", toggleVetArbeidMeny);
  koble("vetAdminKnapp", toggleVetAdminMeny);

  koble("vetMenyDyreeiereKnapp", () => visVetSide("eierSide"));
  koble("vetMenyNyDyreeierKnapp", nyDyreeier);
  koble("vetMenyNyPasientKnapp", nyPasient);
  koble("vetMenyJournalKnapp", () => visVetSide("journalSide"));
  koble("vetMenyMinBilKnapp", () => visVetSide("lagerSide"));
  koble("vetMenyFakturaKnapp", () => visVetSide("fakturaSide"));

  koble("vetAdminKlinikkKnapp", () => visVetSide("klinikkSide"));
  koble("vetAdminPrislisteKnapp", () => visVetSide("prisSide"));
  koble("vetAdminOversiktKnapp", () => visVetSide("okonomiSide"));
  koble("vetAdminLagerKnapp", () => visVetSide("lagerSide"));
  koble("vetAdminBackupKnapp", () => visVetSide("backupSide"));

  koble("nyDyreeierFastKnapp", nyDyreeier);
  koble("nyPasientFastKnapp", nyPasient);
}

const gammelKobleVet = kobleVet;
kobleVet = function() {
  gammelKobleVet();
  vetKobleFinaleKnapper();
};

window.nyDyreeier = nyDyreeier;
window.nyPasient = nyPasient;
window.lagreDyreeier = lagreDyreeier;
window.toggleVetArbeidMeny = toggleVetArbeidMeny;
window.toggleVetAdminMeny = toggleVetAdminMeny;
/* ===== SLUTT FINAL FIX ===== */


/* ===== FINAL DYR/PASIENT FIX ===== */
function finnValgtDyreeierIdTilDyr() {
  return vetTekst("dyreeierId") ||
         vetTekst("dyreeierVelgForDyr") ||
         vetTekst("dyrEierValg") ||
         vetTekst("journalDyreeierValg") ||
         "";
}

function nyPasient() {
  const eierId = finnValgtDyreeierIdTilDyr();

  ["dyrId","dyrNavn","dyrArt","dyrRase","dyrFodselsdato","dyrKjonn","dyrIdmerking"].forEach(id => vetSett(id, ""));

  fyllDyreeierValg(eierId || "");
  if (eierId) vetSett("dyrEierValg", eierId);

  visVetSide("dyrSide");

  const navn = document.getElementById("dyrNavn");
  if (navn) navn.focus();
}

function leggTilNyttDyrForValgtDyreeier() {
  const eierId = finnValgtDyreeierIdTilDyr();

  if (!eierId) {
    vetMelding("dyreeierMelding", "Velg eller lagre dyreeier først.");
    visVetSide("eierSide");
    return;
  }

  ["dyrId","dyrNavn","dyrArt","dyrRase","dyrFodselsdato","dyrKjonn","dyrIdmerking"].forEach(id => vetSett(id, ""));

  fyllDyreeierValg(eierId);
  vetSett("dyrEierValg", eierId);

  visVetSide("dyrSide");

  const navn = document.getElementById("dyrNavn");
  if (navn) navn.focus();
}

async function lagreDyr() {
  vetMelding("dyrMelding", "");

  const rad = leggTilKlinikkHvisVanligBruker({
    dyreeier_id: vetTekst("dyrEierValg"),
    navn: vetTekst("dyrNavn"),
    art: vetTekst("dyrArt") || null,
    rase: vetTekst("dyrRase") || null,
    fodselsdato: vetTekst("dyrFodselsdato") || null,
    kjonn: vetTekst("dyrKjonn") || null,
    idmerking: vetTekst("dyrIdmerking") || null
  });

  if (!rad.dyreeier_id) {
    vetMelding("dyrMelding", "Velg dyreeier først.");
    return;
  }

  if (!rad.navn) {
    vetMelding("dyrMelding", "Skriv navn på dyr/pasient.");
    return;
  }

  const id = vetTekst("dyrId");
  const query = id
    ? supabaseClient.from("vet_dyr").update(rad).eq("id", id).select("id").single()
    : supabaseClient.from("vet_dyr").insert(rad).select("id").single();

  const { data, error } = await query;

  if (error) {
    vetMelding("dyrMelding", "Feil ved lagring av dyr: " + error.message);
    return;
  }

  const lagretDyrId = data?.id || id;

  await lastDyr();

  vetMelding("dyrMelding", "Dyr/pasient lagret.");
  vetSett("dyrId", lagretDyrId || "");
  vetSett("dyrEierValg", rad.dyreeier_id);

  // Oppdater dyreeier-siden og journalvalg også
  vetSett("dyreeierId", rad.dyreeier_id);
  vetSett("dyreeierVelgForDyr", rad.dyreeier_id);
  fyllDyreeierDyrValg(rad.dyreeier_id);

  fyllDyrValg();
  fyllJournalDyreeierValg();
}

(function kobleDyrFix() {
  const koble = (id, fn) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.dyrFixKoblet === "1") return;
    el.dataset.dyrFixKoblet = "1";
    el.addEventListener("click", fn);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kobleDyrFix, { once: true });
    return;
  }

  koble("vetMenyNyPasientKnapp", nyPasient);
  koble("nyPasientFastKnapp", nyPasient);
  koble("nyttDyrForEierFastKnapp", leggTilNyttDyrForValgtDyreeier);
  koble("lagreDyrKnapp", lagreDyr);
})();

window.nyPasient = nyPasient;
window.leggTilNyttDyrForValgtDyreeier = leggTilNyttDyrForValgtDyreeier;
window.lagreDyr = lagreDyr;
/* ===== SLUTT FINAL DYR/PASIENT FIX ===== */


/* ===== LEGG TIL DYR FIX ===== */
function vetFinnValgtDyreeierForDyr() {
  const kandidater = [
    vetTekst("dyreeierId"),
    vetTekst("dyreeierVelgForDyr"),
    vetTekst("dyrEierValg"),
    vetTekst("journalDyreeierValg")
  ].filter(Boolean);

  if (kandidater.length) return kandidater[0];

  const valgt = document.getElementById("dyreeierVelgForDyr");
  if (valgt && valgt.value) return valgt.value;

  return "";
}

function vetAapneNyttDyrForEier() {
  const eierId = vetFinnValgtDyreeierForDyr();

  if (!eierId) {
    vetMelding("dyreeierMelding", "Velg eller lagre dyreeier først.");
    visVetSide("eierSide");
    return;
  }

  // Gå til pasientskjema og nullstill bare dyrefeltene.
  visVetSide("dyrSide");

  vetSett("dyrId", "");
  vetSett("dyrNavn", "");
  vetSett("dyrArt", "");
  vetSett("dyrRase", "");
  vetSett("dyrFodselsdato", "");
  vetSett("dyrKjonn", "");
  vetSett("dyrIdmerking", "");

  fyllDyreeierValg(eierId);
  vetSett("dyrEierValg", eierId);

  const navn = document.getElementById("dyrNavn");
  if (navn) navn.focus();
}

function nyPasient() {
  vetAapneNyttDyrForEier();
}

function vetKobleLeggTilDyrKnapp() {
  const ids = [
    "nyttDyrForEierFastKnapp",
    "nyttDyrForEierKnapp",
    "vetMenyNyPasientKnapp",
    "nyPasientFastKnapp"
  ];

  ids.forEach(id => {
    const knapp = document.getElementById(id);
    if (!knapp || knapp.dataset.leggTilDyrFix === "1") return;

    knapp.dataset.leggTilDyrFix = "1";
    knapp.onclick = function(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      vetAapneNyttDyrForEier();
      return false;
    };
  });
}

// Koble etter at appen har startet og hver gang menyen/siden kan ha blitt tegnet.
const gammelVisVetSideForDyrFix = typeof visVetSide === "function" ? visVetSide : null;
if (gammelVisVetSideForDyrFix) {
  visVetSide = function(sideId) {
    const r = gammelVisVetSideForDyrFix(sideId);
    setTimeout(vetKobleLeggTilDyrKnapp, 0);
    return r;
  };
}

const gammelKobleVetForDyrFix = typeof kobleVet === "function" ? kobleVet : null;
if (gammelKobleVetForDyrFix) {
  kobleVet = function() {
    const r = gammelKobleVetForDyrFix();
    vetKobleLeggTilDyrKnapp();
    setTimeout(vetKobleLeggTilDyrKnapp, 100);
    return r;
  };
}

window.nyPasient = nyPasient;
window.leggTilNyttDyrForValgtDyreeier = vetAapneNyttDyrForEier;
window.vetAapneNyttDyrForEier = vetAapneNyttDyrForEier;
/* ===== SLUTT LEGG TIL DYR FIX ===== */


/* ===== EN LINJE LISTE FIX ===== */
function vetEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tegnDyreeiere() {
  const el = document.getElementById("dyreeierListe");
  if (!el) return;

  if (!vetDyreeiere || vetDyreeiere.length === 0) {
    el.innerHTML = '<p class="lite">Ingen dyreeiere registrert.</p>';
    return;
  }

  el.innerHTML = '<div class="vet-linje-liste">' + vetDyreeiere.map(e => {
    const id = vetEsc(e.id);
    const navn = vetEsc(e.navn || "Uten navn");
    const telefon = vetEsc(e.telefon || "");
    const epost = vetEsc(e.epost || "");
    return `
      <div class="vet-linje-kort">
        <strong title="${navn}">${navn}</strong>
        <span class="vet-skjul-mobil">${telefon || "&nbsp;"}</span>
        <span class="vet-skjul-mobil">${epost || "&nbsp;"}</span>
        <button type="button" class="secondary" onclick="redigerDyreeier('${id}')">Åpne</button>
      </div>
    `;
  }).join("") + '</div>';
}

function tegnDyr() {
  const el = document.getElementById("dyrListe");
  if (!el) return;

  if (!vetDyr || vetDyr.length === 0) {
    el.innerHTML = '<p class="lite">Ingen dyr/pasienter registrert.</p>';
    return;
  }

  el.innerHTML = '<div class="vet-linje-liste">' + vetDyr.map(d => {
    const id = vetEsc(d.id);
    const navn = vetEsc(d.navn || "Uten navn");
    const art = vetEsc(d.art || "");
    const rase = vetEsc(d.rase || "");
    const eier = (vetDyreeiere || []).find(e => String(e.id) === String(d.dyreeier_id));
    const eierNavn = vetEsc(eier?.navn || "");
    return `
      <div class="vet-linje-kort">
        <strong title="${navn}">${navn}</strong>
        <span class="vet-skjul-mobil">${art || "&nbsp;"}${rase ? " / " + rase : ""}</span>
        <span class="vet-skjul-mobil">${eierNavn || "&nbsp;"}</span>
        <button type="button" class="secondary" onclick="redigerDyr('${id}')">Åpne</button>
      </div>
    `;
  }).join("") + '</div>';
}

window.tegnDyreeiere = tegnDyreeiere;
window.tegnDyr = tegnDyr;
/* ===== SLUTT EN LINJE LISTE FIX ===== */

/* ===== KOMPAKT LINJEVISNING 07.06 - KUN LISTER ===== */
function vetLinjeEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetLinjeWrap(inner) {
  return `<div style="display:grid;gap:1px;margin-top:8px;font-size:14px;font-weight:400;">${inner}</div>`;
}

function vetLinjeKnapp(onClick, cols, inner, title = "Klikk for detaljer/redigering") {
  return `
    <button
      type="button"
      onclick="${onClick}"
      title="${vetLinjeEsc(title)}"
      style="
        width:100%;
        display:grid;
        grid-template-columns:${cols};
        gap:10px;
        align-items:center;
        text-align:left;
        padding:4px 8px;
        border:1px solid rgba(255,255,255,.08);
        border-radius:0;
        background:rgba(255,255,255,.02);
        color:inherit;
        cursor:pointer;
        font-family:inherit;
        font-size:14px !important;
        font-weight:400 !important;
        line-height:1.15;
        margin:0;
      "
    >${inner}</button>`;
}

function vetLinjeSpan(verdi) {
  return `<span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${verdi || "&nbsp;"}</span>`;
}

function tegnVetBiler() {
  const liste = document.getElementById("vetBilListe");
  if (!liste) return;

  if (!vetBiler || !vetBiler.length) {
    liste.innerHTML = '<p class="lite">Ingen biler registrert.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetBiler.map(b => {
    const id = vetLinjeEsc(b.id);
    const navn = vetLinjeEsc(b.navn || "Uten navn");
    const regnr = vetLinjeEsc(b.regnr || "");
    const vet = vetLinjeEsc(b.veterinaer_navn || "");
    return vetLinjeKnapp(
      `redigerVetBil('${id}')`,
      "minmax(180px,1.5fr) minmax(110px,.8fr) minmax(180px,1.3fr)",
      `${vetLinjeSpan(navn)}${vetLinjeSpan(regnr)}${vetLinjeSpan(vet)}`
    );
  }).join(""));
}

function tegnDyreeiere() {
  const liste = document.getElementById("dyreeierListe");
  if (!liste) return;

  if (!vetDyreeiere || !vetDyreeiere.length) {
    liste.innerHTML = '<p class="lite">Ingen dyreeiere registrert ennå.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetDyreeiere.map(e => {
    const id = vetLinjeEsc(e.id);
    const navn = vetLinjeEsc(e.navn || "Uten navn");
    const telefon = vetLinjeEsc(e.telefon || "");
    const epost = vetLinjeEsc(e.epost || "");
    return vetLinjeKnapp(
      `redigerDyreeier('${id}')`,
      "minmax(180px,1.4fr) minmax(120px,.8fr) minmax(200px,1.4fr)",
      `${vetLinjeSpan(navn)}${vetLinjeSpan(telefon)}${vetLinjeSpan(epost)}`
    );
  }).join(""));
}

function tegnDyr() {
  const liste = document.getElementById("dyrListe");
  if (!liste) return;

  if (!vetDyr || !vetDyr.length) {
    liste.innerHTML = '<p class="lite">Ingen dyr registrert ennå.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetDyr.map(d => {
    const id = vetLinjeEsc(d.id);
    const navn = vetLinjeEsc(d.navn || "Uten navn");
    const artRase = vetLinjeEsc([d.art, d.rase].filter(Boolean).join(" / "));
    const eierNavn = vetLinjeEsc(d.vet_dyreeiere?.navn || (vetDyreeiere || []).find(e => String(e.id) === String(d.dyreeier_id))?.navn || "");
    const idmerking = vetLinjeEsc(d.idmerking || "");
    return vetLinjeKnapp(
      `redigerDyr('${id}')`,
      "minmax(160px,1.3fr) minmax(160px,1.2fr) minmax(180px,1.3fr) minmax(120px,.8fr)",
      `${vetLinjeSpan(navn)}${vetLinjeSpan(artRase)}${vetLinjeSpan(eierNavn)}${vetLinjeSpan(idmerking)}`
    );
  }).join(""));
}

function tegnHovedlager() {
  const liste = document.getElementById("hovedlagerListe");
  if (!liste) return;

  if (!vetHovedlager || !vetHovedlager.length) {
    liste.innerHTML = '<p class="lite">Hovedlager er tomt.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetHovedlager.map(r => {
    const v = r.vet_varer || {};
    const navn = vetLinjeEsc(v.navn || vareNavn(r.vare_id));
    const antall = `${formaterKr(r.antall)} ${vetLinjeEsc(v.enhet || "stk")}`;
    const lavt = Number(v.minimum_antall || 0) > 0 && Number(r.antall || 0) <= Number(v.minimum_antall || 0);
    const varsel = lavt ? "⚠ lav beholdning" : "";
    return vetLinjeKnapp(
      `redigerVetVare('${vetLinjeEsc(r.vare_id || v.id || "")}')`,
      "minmax(220px,2fr) minmax(120px,.9fr) minmax(150px,1fr)",
      `${vetLinjeSpan(navn)}${vetLinjeSpan(antall)}${vetLinjeSpan(varsel)}`
    );
  }).join(""));
}

function tegnBilLager() {
  const liste = document.getElementById("billagerListe");
  if (!liste) return;

  if (!vetBilLager || !vetBilLager.length) {
    liste.innerHTML = '<p class="lite">Ingen varer i biler.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetBilLager.map(r => {
    const v = r.vet_varer || {};
    const bil = vetLinjeEsc(r.vet_biler ? [r.vet_biler.navn, r.vet_biler.regnr].filter(Boolean).join(" - ") : bilNavn(r.bil_id));
    const vare = vetLinjeEsc(v.navn || vareNavn(r.vare_id));
    const antall = `${formaterKr(r.antall)} ${vetLinjeEsc(v.enhet || "stk")}`;
    return vetLinjeKnapp(
      `redigerVetBil('${vetLinjeEsc(r.bil_id || "")}')`,
      "minmax(180px,1.4fr) minmax(220px,1.6fr) minmax(120px,.8fr)",
      `${vetLinjeSpan(bil)}${vetLinjeSpan(vare)}${vetLinjeSpan(antall)}`,
      "Klikk for bil-detaljer"
    );
  }).join(""));
}

function tegnMinBilInnhold() {
  const liste = document.getElementById("minBilInnholdListe");
  if (!liste) return;

  const bilId = valgtMinBilId();
  if (!bilId) {
    liste.innerHTML = '<p class="lite">Ingen bil valgt.</p>';
    return;
  }

  const rader = vetBilLager.filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0);
  if (!rader.length) {
    liste.innerHTML = '<p class="lite">Bilen er tom.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(rader.map(r => {
    const v = r.vet_varer || vetVarer.find(x => String(x.id) === String(r.vare_id)) || {};
    const navn = vetLinjeEsc(v.navn || vareNavn(r.vare_id));
    const antall = `${formaterKr(r.antall)} ${vetLinjeEsc(v.enhet || "stk")}`;
    return vetLinjeKnapp(
      `fyllJournalBilVareValg()`,
      "minmax(220px,2fr) minmax(120px,.8fr)",
      `${vetLinjeSpan(navn)}${vetLinjeSpan(antall)}`,
      "Vare i bilen"
    );
  }).join(""));
}

window.tegnVetBiler = tegnVetBiler;
window.tegnDyreeiere = tegnDyreeiere;
window.tegnDyr = tegnDyr;
window.tegnHovedlager = tegnHovedlager;
window.tegnBilLager = tegnBilLager;
window.tegnMinBilInnhold = tegnMinBilInnhold;
/* ===== SLUTT KOMPAKT LINJEVISNING 07.06 ===== */

/* ===== DYREBILDE / PROFILBILDE 07.06 ===== */
function vetDyrBildeEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetSettDyrBildePreview(url) {
  const img = document.getElementById("dyrBildePreview");
  if (!img) return;

  if (url) {
    img.src = url;
    img.style.display = "block";
    img.classList.remove("skjult");
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
    img.classList.add("skjult");
  }
}

function vetNullstillDyrBildeInput() {
  const fil = document.getElementById("dyrBildeFil");
  if (fil) fil.value = "";
  vetSettDyrBildePreview("");
}

function vetInitDyrBildeUI() {
  const dyrSide = document.getElementById("dyrSide");
  if (!dyrSide || document.getElementById("dyrBildeOmrade")) return;

  const lagreKnapp = document.getElementById("lagreDyrKnapp");
  const omrade = document.createElement("div");
  omrade.id = "dyrBildeOmrade";
  omrade.innerHTML = `
    <h3 style="margin-top:14px;margin-bottom:6px;">Bilde av dyret</h3>
    <div class="rad" style="align-items:end;">
      <div>
        <label for="dyrBildeFil">Velg bilde / ta bilde</label>
        <input id="dyrBildeFil" type="file" accept="image/*" capture="environment">
        <button id="taBildeDyrKnapp" type="button" class="secondary" style="margin-top:8px;">Ta bilde</button>
      </div>
      <div>
        <img id="dyrBildePreview" alt="Bilde av dyr" class="skjult" style="display:none;width:90px;height:70px;object-fit:cover;border:1px solid #ddd;border-radius:8px;background:#fafafa;">
      </div>
    </div>
    <p class="lite" style="margin-top:4px;">Bildet lagres på dyret/pasienten og vises i pasientlisten.</p>
  `;

  if (lagreKnapp && lagreKnapp.parentNode) {
    lagreKnapp.parentNode.insertBefore(omrade, lagreKnapp);
  } else {
    dyrSide.appendChild(omrade);
  }

  const fil = document.getElementById("dyrBildeFil");
  if (fil && !fil.dataset.previewKoblet) {
    fil.dataset.previewKoblet = "1";
    fil.addEventListener("change", () => {
      const valgt = fil.files && fil.files[0];
      if (!valgt) {
        const dyr = (vetDyr || []).find(d => String(d.id) === String(vetTekst("dyrId")));
        vetSettDyrBildePreview(dyr?.bilde_url || "");
        return;
      }
      const reader = new FileReader();
      reader.onload = e => vetSettDyrBildePreview(e.target.result);
      reader.readAsDataURL(valgt);
    });
  }

  const taBilde = document.getElementById("taBildeDyrKnapp");
  if (taBilde && fil && !taBilde.dataset.koblet) {
    taBilde.dataset.koblet = "1";
    taBilde.addEventListener("click", (e) => {
      e.preventDefault();
      fil.click();
    });
  }
}

async function vetLastOppDyrBilde(dyrId) {
  const fil = document.getElementById("dyrBildeFil")?.files?.[0];
  if (!dyrId || !fil) return null;

  const ext = String((fil.name || "dyr.jpg").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const filnavn = vetTryggFilnavn(fil.name || `dyr.${ext}`);
  const sti = `dyr/${dyrId}/${Date.now()}_${filnavn}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(VET_BILDE_BUCKET)
    .upload(sti, fil, {
      cacheControl: "3600",
      upsert: false,
      contentType: fil.type || "image/jpeg"
    });

  if (uploadError) {
    vetMelding("dyrMelding", "Dyr lagret, men bilde kunne ikke lastes opp: " + uploadError.message);
    return null;
  }

  const { data } = supabaseClient.storage
    .from(VET_BILDE_BUCKET)
    .getPublicUrl(sti);

  const url = data?.publicUrl || null;
  if (!url) return null;

  const { error: updateError } = await supabaseClient
    .from("vet_dyr")
    .update({ bilde_url: url })
    .eq("id", dyrId);

  if (updateError) {
    vetMelding("dyrMelding", "Dyr lagret, men bilde-url kunne ikke lagres: " + updateError.message);
    return null;
  }

  return url;
}

const vetGammelVisVetSideDyrBilde = typeof visVetSide === "function" ? visVetSide : null;
if (vetGammelVisVetSideDyrBilde) {
  visVetSide = function(id) {
    const r = vetGammelVisVetSideDyrBilde(id);
    if (id === "dyrSide") setTimeout(vetInitDyrBildeUI, 0);
    return r;
  };
}

const vetGammelRedigerDyrDyrBilde = typeof redigerDyr === "function" ? redigerDyr : null;
function redigerDyr(id) {
  if (vetGammelRedigerDyrDyrBilde) vetGammelRedigerDyrDyrBilde(id);
  vetInitDyrBildeUI();
  const d = (vetDyr || []).find(x => String(x.id) === String(id));
  vetSettDyrBildePreview(d?.bilde_url || "");
  const fil = document.getElementById("dyrBildeFil");
  if (fil) fil.value = "";
}

const vetGammelNyPasientDyrBilde = typeof nyPasient === "function" ? nyPasient : null;
function nyPasient() {
  if (vetGammelNyPasientDyrBilde) vetGammelNyPasientDyrBilde();
  vetInitDyrBildeUI();
  vetNullstillDyrBildeInput();
}

async function lagreDyr() {
  vetMelding("dyrMelding", "");
  vetInitDyrBildeUI();

  const rad = leggTilKlinikkHvisVanligBruker({
    dyreeier_id: vetTekst("dyrEierValg") || null,
    navn: vetTekst("dyrNavn"),
    art: vetTekst("dyrArt") || null,
    rase: vetTekst("dyrRase") || null,
    fodselsdato: vetTekst("dyrFodselsdato") || null,
    kjonn: vetTekst("dyrKjonn") || null,
    idmerking: vetTekst("dyrIdmerking") || null
  });

  if (!rad.dyreeier_id) {
    vetMelding("dyrMelding", "Velg dyreeier først.");
    return;
  }

  if (!rad.navn) {
    vetMelding("dyrMelding", "Skriv navn på dyr/pasient.");
    return;
  }

  const id = vetTekst("dyrId");
  const query = id
    ? supabaseClient.from("vet_dyr").update(rad).eq("id", id).select("id").single()
    : supabaseClient.from("vet_dyr").insert(rad).select("id").single();

  const { data, error } = await query;

  if (error) {
    vetMelding("dyrMelding", "Feil ved lagring av dyr: " + error.message);
    return;
  }

  const lagretDyrId = data?.id || id;
  const bildeUrl = await vetLastOppDyrBilde(lagretDyrId);

  await lastDyr();

  vetMelding("dyrMelding", bildeUrl ? "Dyr/pasient og bilde lagret." : "Dyr/pasient lagret.");
  vetSett("dyrId", lagretDyrId || "");
  vetSett("dyrEierValg", rad.dyreeier_id);
  if (bildeUrl) vetSettDyrBildePreview(bildeUrl);
  else {
    const dyr = (vetDyr || []).find(d => String(d.id) === String(lagretDyrId));
    vetSettDyrBildePreview(dyr?.bilde_url || "");
  }
  const fil = document.getElementById("dyrBildeFil");
  if (fil) fil.value = "";

  vetSett("dyreeierId", rad.dyreeier_id);
  vetSett("dyreeierVelgForDyr", rad.dyreeier_id);
  fyllDyreeierDyrValg(rad.dyreeier_id, lagretDyrId || "");
  fyllDyrValg();
  fyllJournalDyreeierValg();

  // Etter lagring skal brukeren tilbake til eierkortet med oppdatert dyreliste.
  if (typeof window.vetStackSafeOpenEier === "function") {
    window.vetStackSafeOpenEier(rad.dyreeier_id);
  } else {
    visVetSide("eierSide");
    vetSett("dyreeierId", rad.dyreeier_id);
    vetSett("dyreeierVelgForDyr", rad.dyreeier_id);
    fyllDyreeierDyrValg(rad.dyreeier_id, lagretDyrId || "");
  }
  vetMelding("dyreeierMelding", bildeUrl ? "Dyr/pasient og bilde lagret." : "Dyr/pasient lagret.");
}

function tegnDyr() {
  const liste = document.getElementById("dyrListe");
  if (!liste) return;

  if (!vetDyr || !vetDyr.length) {
    liste.innerHTML = '<p class="lite">Ingen dyr registrert ennå.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetDyr.map(d => {
    const id = vetLinjeEsc(d.id);
    const navn = vetLinjeEsc(d.navn || "Uten navn");
    const artRase = vetLinjeEsc([d.art, d.rase].filter(Boolean).join(" / "));
    const eierNavn = vetLinjeEsc(d.vet_dyreeiere?.navn || (vetDyreeiere || []).find(e => String(e.id) === String(d.dyreeier_id))?.navn || "");
    const idmerking = vetLinjeEsc(d.idmerking || "");
    const bilde = d.bilde_url
      ? `<img src="${vetLinjeEsc(d.bilde_url)}" alt="${navn}" style="width:34px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #ddd;">`
      : `<span class="lite" style="font-size:12px !important;font-weight:400 !important;line-height:1;">📷</span>`;
    return vetLinjeKnapp(
      `redigerDyr('${id}')`,
      "42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(160px,1.3fr) minmax(110px,.8fr)",
      `${bilde}${vetLinjeSpan(navn)}${vetLinjeSpan(artRase)}${vetLinjeSpan(eierNavn)}${vetLinjeSpan(idmerking)}`
    );
  }).join(""));
}

(function vetKobleDyrBilde() {
  const start = () => {
    vetInitDyrBildeUI();
    const lagre = document.getElementById("lagreDyrKnapp");
    if (lagre) lagre.onclick = lagreDyr;
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();

window.redigerDyr = redigerDyr;
window.nyPasient = nyPasient;
window.lagreDyr = lagreDyr;
window.tegnDyr = tegnDyr;
/* ===== SLUTT DYREBILDE / PROFILBILDE 07.06 ===== */


/* ===== KLIKKBAR DYREEIERLISTE + DYRELISTE UNDER EIER 07.06 FINAL ===== */
function vetKlikkEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetSørgForDyreListeUnderEier() {
  const gammelSelect = document.getElementById("dyreeierDyrValg");
  if (gammelSelect && gammelSelect.tagName === "SELECT") {
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.id = "dyreeierDyrValg";
    gammelSelect.parentNode.replaceChild(hidden, gammelSelect);
  }

  let liste = document.getElementById("dyreeierDyrListe");
  if (!liste) {
    liste = document.createElement("div");
    liste.id = "dyreeierDyrListe";
    const info = document.getElementById("dyreeierDyrInfo");
    const hidden = document.getElementById("dyreeierDyrValg");
    if (hidden && hidden.parentNode) hidden.parentNode.insertBefore(liste, hidden.nextSibling);
    else if (info && info.parentNode) info.parentNode.insertBefore(liste, info);
  }
  return liste;
}

function vetMiniDyrBilde(dyr) {
  if (dyr && dyr.bilde_url) {
    return `<img src="${vetKlikkEsc(dyr.bilde_url)}" alt="${vetKlikkEsc(dyr.navn || "Dyr")}" class="vet-dyr-mini-bilde">`;
  }
  return `<span style="font-size:13px !important;font-weight:400 !important;line-height:1.1;">📷</span>`;
}

function tegnDyreeiere() {
  const liste = document.getElementById("dyreeierListe");
  if (!liste) return;

  if (!vetDyreeiere || !vetDyreeiere.length) {
    liste.innerHTML = '<p class="lite">Ingen dyreeiere registrert ennå.</p>';
    return;
  }

  liste.innerHTML = `
    <div class="vet-klikk-liste">
      ${vetDyreeiere.map(e => {
        const id = vetKlikkEsc(e.id);
        const navn = vetKlikkEsc(e.navn || "Uten navn");
        const telefon = vetKlikkEsc(e.telefon || "");
        const epost = vetKlikkEsc(e.epost || "");
        return `
          <button type="button"
            class="vet-klikk-rad"
            onclick="redigerDyreeier('${id}')"
            title="Klikk for detaljer og dyreliste"
            style="grid-template-columns:minmax(170px,1.4fr) minmax(100px,.8fr) minmax(190px,1.4fr) 70px;">
            <span>${navn}</span>
            <span>${telefon}</span>
            <span>${epost}</span>
            <span>Åpne</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function redigerDyreeier(id) {
  const e = (vetDyreeiere || []).find(x => String(x.id) === String(id));
  if (!e) return;

  vetSett("dyreeierId", e.id);
  vetSett("dyreeierVelgForDyr", e.id);
  vetSett("dyreeierNavn", e.navn || "");
  vetSett("dyreeierTelefon", e.telefon || "");
  vetSett("dyreeierEpost", e.epost || "");
  vetSett("dyreeierAdresse", e.adresse || "");

  visVetSide("eierSide");
  setTimeout(() => fyllDyreeierDyrValg(e.id), 0);
}

function fyllDyreeierDyrValg(dyreeierId = "", valgtDyrId = "") {
  const liste = vetSørgForDyreListeUnderEier();
  const info = document.getElementById("dyreeierDyrInfo");
  const hidden = document.getElementById("dyreeierDyrValg");
  if (hidden) hidden.value = valgtDyrId || "";
  if (!liste) return;

  if (!dyreeierId) {
    liste.innerHTML = '<p class="lite">Velg eller klikk en dyreeier først.</p>';
    if (info) info.textContent = "";
    return;
  }

  const dyrHosEier = (vetDyr || [])
    .filter(d => String(d.dyreeier_id || d.eier_id || "") === String(dyreeierId))
    .sort((a, b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));

  if (!dyrHosEier.length) {
    liste.innerHTML = '<p class="lite">Ingen dyr registrert på denne dyreeieren ennå.</p>';
    if (info) info.textContent = "Ingen dyr funnet på valgt dyreeier.";
    return;
  }

  liste.innerHTML = `
    <div class="vet-klikk-liste">
      ${dyrHosEier.map(d => {
        const id = vetKlikkEsc(d.id);
        const valgt = valgtDyrId && String(valgtDyrId) === String(d.id);
        const navn = vetKlikkEsc(d.navn || "Uten navn");
        const artRase = vetKlikkEsc([d.art, d.rase].filter(Boolean).join(" / "));
        const idmerking = vetKlikkEsc(d.idmerking || "");
        return `
          <button type="button"
            class="vet-klikk-rad"
            onclick="vetVelgDyrFraEierListe('${id}')"
            title="Klikk for detaljer på dyret"
            style="grid-template-columns:42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(110px,.8fr) 70px;${valgt ? 'outline:1px solid #1f6feb;' : ''}">
            ${vetMiniDyrBilde(d)}
            <span>${navn}</span>
            <span>${artRase}</span>
            <span>${idmerking}</span>
            <span>Åpne</span>
          </button>
        `;
      }).join("")}
    </div>
  `;

  if (info) info.textContent = `${dyrHosEier.length} dyr registrert på valgt dyreeier.`;
}

function vetVelgDyrFraEierListe(dyrId) {
  const hidden = document.getElementById("dyreeierDyrValg");
  if (hidden) hidden.value = dyrId || "";
  if (dyrId) redigerDyr(dyrId);
}

function brukValgtDyreeierForDyr() {
  const dyreeierId = vetTekst("dyreeierVelgForDyr");
  if (!dyreeierId) {
    ["dyreeierId", "dyreeierNavn", "dyreeierTelefon", "dyreeierEpost", "dyreeierAdresse"].forEach(id => vetSett(id, ""));
    fyllDyreeierDyrValg("");
    return;
  }
  redigerDyreeier(dyreeierId);
}

function brukValgtDyrFraDyreeier() {
  const dyrId = vetTekst("dyreeierDyrValg");
  if (dyrId) redigerDyr(dyrId);
}

(function vetStartKlikkbarDyreeierDyreliste() {
  const start = () => {
    vetSørgForDyreListeUnderEier();
    const velg = document.getElementById("dyreeierVelgForDyr");
    if (velg) velg.onchange = brukValgtDyreeierForDyr;
    tegnDyreeiere();
    fyllDyreeierDyrValg(vetTekst("dyreeierId"));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();

window.tegnDyreeiere = tegnDyreeiere;
window.redigerDyreeier = redigerDyreeier;
window.fyllDyreeierDyrValg = fyllDyreeierDyrValg;
window.vetVelgDyrFraEierListe = vetVelgDyrFraEierListe;
window.brukValgtDyreeierForDyr = brukValgtDyreeierForDyr;
window.brukValgtDyrFraDyreeier = brukValgtDyrFraDyreeier;
/* ===== SLUTT KLIKKBAR DYREEIERLISTE + DYRELISTE UNDER EIER ===== */

/* ===== ENDELIG FIX: DYREEIER/DYR-KLIKK + BILDE 07.06 ===== */
(function(){
  function esc(v){
    return String(v ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function safeCall(fn, arg){
    try {
      if (typeof window[fn] === "function") return window[fn](arg);
      if (typeof globalThis[fn] === "function") return globalThis[fn](arg);
    } catch(e) {
      console.error(fn + " feilet:", e);
      alert("Knappen feilet: " + (e && e.message ? e.message : e));
    }
  }

  function sørgForDyrBildeUI(){
    if (typeof vetInitDyrBildeUI === "function") vetInitDyrBildeUI();
    const dyrSide = document.getElementById("dyrSide");
    const lagre = document.getElementById("lagreDyrKnapp");
    if (dyrSide && lagre && !document.getElementById("dyrBildeOmrade")) {
      const div = document.createElement("div");
      div.id = "dyrBildeOmrade";
      div.innerHTML = `
        <h3 style="margin-top:14px;margin-bottom:6px;">Bilde av dyret</h3>
        <div class="rad">
          <div>
            <label for="dyrBildeFil">Velg bilde</label>
            <input id="dyrBildeFil" type="file" accept="image/*" capture="environment">
          </div>
          <div>
            <img id="dyrBildePreview" alt="Bilde av dyr" class="skjult" style="display:none;width:90px;height:70px;object-fit:cover;border:1px solid #ddd;border-radius:8px;background:#fafafa;">
          </div>
        </div>
        <p class="lite" style="margin-top:4px;">Velg bilde og trykk Lagre dyr / bilde.</p>
      `;
      lagre.parentNode.insertBefore(div, lagre);
    }
  }

  window.vetFIXAapneEier = function(id){
    if (!id) return false;
    safeCall("redigerDyreeier", id);
    return false;
  };

  window.vetFIXAapneDyr = function(id){
    if (!id) return false;
    safeCall("redigerDyr", id);
    setTimeout(() => {
      sørgForDyrBildeUI();
      const side = document.getElementById("dyrSide");
      if (side) side.scrollIntoView({behavior:"smooth", block:"start"});
    }, 20);
    return false;
  };

  window.vetFIXBildeDyr = function(id){
    if (!id) return false;
    window.vetFIXAapneDyr(id);
    setTimeout(() => {
      sørgForDyrBildeUI();
      const fil = document.getElementById("dyrBildeFil");
      const omr = document.getElementById("dyrBildeOmrade");
      if (omr) omr.scrollIntoView({behavior:"smooth", block:"center"});
      if (fil) {
        try { fil.focus(); fil.click(); } catch(e) { console.warn(e); }
      }
    }, 80);
    return false;
  };

  function miniBilde(d){
    if (d && d.bilde_url) return `<img src="${esc(d.bilde_url)}" alt="${esc(d.navn || 'Dyr')}" class="vet-dyr-mini-bilde">`;
    return `<span style="font-size:13px;font-weight:400;line-height:1.1;">📷</span>`;
  }

  window.tegnDyreeiere = function(){
    const liste = document.getElementById("dyreeierListe");
    if (!liste) return;
    if (!vetDyreeiere || !vetDyreeiere.length) {
      liste.innerHTML = '<p class="lite">Ingen dyreeiere registrert ennå.</p>';
      return;
    }
    liste.innerHTML = `<div class="vet-klikk-liste">${vetDyreeiere.map(e => {
      const id = esc(e.id);
      return `
        <div class="vet-klikk-rad" onclick="return window.vetFIXAapneEier('${id}')" style="grid-template-columns:minmax(170px,1.4fr) minmax(100px,.8fr) minmax(190px,1.4fr) 90px;">
          <span>${esc(e.navn || "Uten navn")}</span>
          <span>${esc(e.telefon || "")}</span>
          <span>${esc(e.epost || "")}</span>
          <a href="#" onclick="event.preventDefault(); event.stopPropagation(); return window.vetFIXAapneEier('${id}')" class="secondary" style="display:inline-block;text-align:center;text-decoration:none;color:white;background:#555;border-radius:8px;padding:5px 10px;font-size:13px;">Åpne</a>
        </div>`;
    }).join("")}</div>`;
  };

  window.fyllDyreeierDyrValg = function(dyreeierId = "", valgtDyrId = ""){
    const gammelSelect = document.getElementById("dyreeierDyrValg");
    if (gammelSelect && gammelSelect.tagName === "SELECT") {
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.id = "dyreeierDyrValg";
      gammelSelect.parentNode.replaceChild(hidden, gammelSelect);
    }
    let liste = document.getElementById("dyreeierDyrListe");
    if (!liste) {
      liste = document.createElement("div");
      liste.id = "dyreeierDyrListe";
      const info = document.getElementById("dyreeierDyrInfo");
      if (info && info.parentNode) info.parentNode.insertBefore(liste, info);
    }
    const info = document.getElementById("dyreeierDyrInfo");
    const hidden = document.getElementById("dyreeierDyrValg");
    if (hidden) hidden.value = valgtDyrId || "";
    if (!liste) return;
    if (!dyreeierId) {
      liste.innerHTML = '<p class="lite">Velg eller klikk en dyreeier først.</p>';
      if (info) info.textContent = "";
      return;
    }
    const dyrHosEier = (vetDyr || [])
      .filter(d => String(d.dyreeier_id || d.eier_id || "") === String(dyreeierId))
      .sort((a,b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));
    if (!dyrHosEier.length) {
      liste.innerHTML = '<p class="lite">Ingen dyr registrert på denne dyreeieren ennå.</p>';
      if (info) info.textContent = "Ingen dyr funnet på valgt dyreeier.";
      return;
    }
    liste.innerHTML = `<div class="vet-klikk-liste">${dyrHosEier.map(d => {
      const id = esc(d.id);
      const valgt = valgtDyrId && String(valgtDyrId) === String(d.id);
      return `
        <div class="vet-klikk-rad" onclick="return window.vetFIXAapneDyr('${id}')" style="grid-template-columns:42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(110px,.8fr) 90px 90px;${valgt ? 'outline:1px solid #1f6feb;' : ''}">
          ${miniBilde(d)}
          <span>${esc(d.navn || "Uten navn")}</span>
          <span>${esc([d.art, d.rase].filter(Boolean).join(" / "))}</span>
          <span>${esc(d.idmerking || "")}</span>
          <a href="#" onclick="event.preventDefault(); event.stopPropagation(); return window.vetFIXAapneDyr('${id}')" class="secondary" style="display:inline-block;text-align:center;text-decoration:none;color:white;background:#555;border-radius:8px;padding:5px 10px;font-size:13px;">Åpne</a>
          <a href="#" onclick="event.preventDefault(); event.stopPropagation(); return window.vetFIXBildeDyr('${id}')" class="secondary" style="display:inline-block;text-align:center;text-decoration:none;color:white;background:#555;border-radius:8px;padding:5px 10px;font-size:13px;">Bilde</a>
        </div>`;
    }).join("")}</div>`;
    if (info) info.textContent = `${dyrHosEier.length} dyr registrert på valgt dyreeier.`;
  };

  document.addEventListener("click", function(e){
    const openDyr = e.target.closest("[data-open-dyr-fix]");
    if (openDyr) { e.preventDefault(); e.stopPropagation(); return window.vetFIXAapneDyr(openDyr.dataset.openDyrFix); }
  }, true);

  const start = () => {
    sørgForDyrBildeUI();
    try { window.tegnDyreeiere(); } catch(e) { console.warn(e); }
    try { window.fyllDyreeierDyrValg(vetTekst("dyreeierId")); } catch(e) { console.warn(e); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 100), {once:true});
  else setTimeout(start, 100);
})();
/* ===== SLUTT ENDELIG FIX ===== */


/* ===== STACKSAFE FIX: ÅPNE/BILDE UTEN REKURSJON 07.06 ===== */
(function(){
  function esc(v){
    return String(v ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  function sett(id, verdi){
    const el = document.getElementById(id);
    if (el) el.value = verdi ?? '';
  }

  function visSideTrygt(sideId){
    if (typeof visVetSide === 'function') {
      try { visVetSide(sideId); return; } catch(e) { console.warn('visVetSide feilet, bruker fallback', e); }
    }
    document.querySelectorAll('#klinikkSide,#eierSide,#dyrSide,#prisSide,#lagerSide,#journalSide,#fakturaSide,#okonomiSide,#backupSide').forEach(el => {
      el.classList.add('skjult');
      el.style.display = 'none';
    });
    const side = document.getElementById(sideId);
    if (side) {
      side.classList.remove('skjult');
      side.style.display = '';
    }
  }

  function sørgForDyrBildeUI(){
    if (typeof vetInitDyrBildeUI === 'function') {
      try { vetInitDyrBildeUI(); } catch(e) { console.warn(e); }
    }
    const dyrSide = document.getElementById('dyrSide');
    const lagre = document.getElementById('lagreDyrKnapp');
    if (!dyrSide || !lagre || document.getElementById('dyrBildeOmrade')) return;
    const div = document.createElement('div');
    div.id = 'dyrBildeOmrade';
    div.innerHTML = `
      <h3 style="margin-top:14px;margin-bottom:6px;">Bilde av dyret</h3>
      <div class="rad" style="align-items:end;">
        <div>
          <label for="dyrBildeFil">Velg bilde / ta bilde</label>
          <input id="dyrBildeFil" type="file" accept="image/*" capture="environment">
          <button id="taBildeDyrKnapp" type="button" class="secondary" style="margin-top:8px;">Ta bilde</button>
        </div>
        <div>
          <img id="dyrBildePreview" alt="Bilde av dyr" class="skjult" style="display:none;width:90px;height:70px;object-fit:cover;border:1px solid #ddd;border-radius:8px;background:#fafafa;">
        </div>
      </div>
      <p class="lite" style="margin-top:4px;">Velg bilde og trykk Lagre dyr / bilde.</p>
    `;
    lagre.parentNode.insertBefore(div, lagre);
    const fil = document.getElementById('dyrBildeFil');
    if (fil && !fil.dataset.previewKoblet) {
      fil.dataset.previewKoblet = '1';
      fil.addEventListener('change', () => {
        const valgt = fil.files && fil.files[0];
        if (!valgt) return;
        const reader = new FileReader();
        reader.onload = e => {
          const img = document.getElementById('dyrBildePreview');
          if (img) {
            img.src = e.target.result;
            img.classList.remove('skjult');
            img.style.display = '';
          }
        };
        reader.readAsDataURL(valgt);
      });
    }
    const taBilde = document.getElementById('taBildeDyrKnapp');
    if (taBilde && fil && !taBilde.dataset.koblet) {
      taBilde.dataset.koblet = '1';
      taBilde.addEventListener('click', (e) => {
        e.preventDefault();
        fil.click();
      });
    }
  }

  window.vetStackSafeOpenEier = function(id){
    const e = (window.vetDyreeiere || vetDyreeiere || []).find(x => String(x.id) === String(id));
    if (!e) return false;
    sett('dyreeierId', e.id);
    sett('dyreeierVelgForDyr', e.id);
    sett('dyreeierNavn', e.navn || '');
    sett('dyreeierTelefon', e.telefon || '');
    sett('dyreeierEpost', e.epost || '');
    sett('dyreeierAdresse', e.adresse || '');
    visSideTrygt('eierSide');
    sett('dyreeierId', e.id);
    sett('dyreeierVelgForDyr', e.id);
    setTimeout(() => window.vetStackSafeTegnDyrHosEier(e.id), 0);
    return false;
  };

  window.vetStackSafeOpenDyr = function(id){
    const d = (window.vetDyr || vetDyr || []).find(x => String(x.id) === String(id));
    if (!d) return false;
    visSideTrygt('dyrSide');
    if (typeof fyllDyreeierValg === 'function') {
      try { fyllDyreeierValg(d.dyreeier_id || ''); } catch(e) { console.warn(e); }
    }
    sett('dyrId', d.id);
    sett('dyrEierValg', d.dyreeier_id || '');
    sett('dyrNavn', d.navn || '');
    sett('dyrArt', d.art || '');
    sett('dyrRase', d.rase || '');
    sett('dyrFodselsdato', d.fodselsdato || '');
    sett('dyrKjonn', d.kjonn || '');
    sett('dyrIdmerking', d.idmerking || '');
    sørgForDyrBildeUI();
    const fil = document.getElementById('dyrBildeFil');
    if (fil) fil.value = '';
    const img = document.getElementById('dyrBildePreview');
    if (img) {
      if (d.bilde_url) {
        img.src = d.bilde_url;
        img.classList.remove('skjult');
        img.style.display = '';
      } else {
        img.removeAttribute('src');
        img.classList.add('skjult');
        img.style.display = 'none';
      }
    }
    const side = document.getElementById('dyrSide');
    if (side) side.scrollIntoView({ behavior:'smooth', block:'start' });
    return false;
  };

  window.vetStackSafeBildeDyr = function(id){
    window.vetStackSafeOpenDyr(id);
    const omr = document.getElementById('dyrBildeOmrade');
    const fil = document.getElementById('dyrBildeFil');
    if (omr) omr.scrollIntoView({ behavior:'smooth', block:'center' });
    if (fil) {
      try { fil.focus(); fil.click(); } catch(e) { console.warn(e); }
    }
    setTimeout(() => {
      const fil2 = document.getElementById('dyrBildeFil');
      if (fil2 && !fil2.files.length) {
        try { fil2.focus(); } catch(e) { console.warn(e); }
      }
    }, 80);
    return false;
  };

  function miniBilde(d){
    if (d && d.bilde_url) return `<img src="${esc(d.bilde_url)}" alt="${esc(d.navn || 'Dyr')}" class="vet-dyr-mini-bilde">`;
    return `<span style="font-size:13px;font-weight:400;line-height:1.1;">📷</span>`;
  }

  window.vetStackSafeTegnDyrHosEier = function(dyreeierId){
    const gammel = document.getElementById('dyreeierDyrValg');
    if (gammel && gammel.tagName === 'SELECT') {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.id = 'dyreeierDyrValg';
      gammel.parentNode.replaceChild(hidden, gammel);
    }
    let liste = document.getElementById('dyreeierDyrListe');
    if (!liste) {
      liste = document.createElement('div');
      liste.id = 'dyreeierDyrListe';
      const info = document.getElementById('dyreeierDyrInfo');
      if (info && info.parentNode) info.parentNode.insertBefore(liste, info);
    }
    const info = document.getElementById('dyreeierDyrInfo');
    if (!dyreeierId) {
      if (liste) liste.innerHTML = '<p class="lite">Velg eller klikk en dyreeier først.</p>';
      if (info) info.textContent = '';
      return;
    }
    const dyrHosEier = (window.vetDyr || vetDyr || [])
      .filter(d => String(d.dyreeier_id || d.eier_id || '') === String(dyreeierId))
      .sort((a,b) => String(a.navn || '').localeCompare(String(b.navn || ''), 'nb'));
    if (!dyrHosEier.length) {
      liste.innerHTML = '<p class="lite">Ingen dyr registrert på denne dyreeieren ennå.</p>';
      if (info) info.textContent = 'Ingen dyr funnet på valgt dyreeier.';
      return;
    }
    liste.innerHTML = `<div class="vet-klikk-liste">${dyrHosEier.map(d => {
      const id = esc(d.id);
      return `
        <div class="vet-klikk-rad" style="grid-template-columns:42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(110px,.8fr) 90px 90px;">
          ${miniBilde(d)}
          <span>${esc(d.navn || 'Uten navn')}</span>
          <span>${esc([d.art, d.rase].filter(Boolean).join(' / '))}</span>
          <span>${esc(d.idmerking || '')}</span>
          <button type="button" class="secondary" data-vet-stacksafe-open-dyr="${id}" style="margin:0;padding:5px 10px;font-size:13px;">Åpne</button>
          <button type="button" class="secondary" data-vet-stacksafe-bilde-dyr="${id}" style="margin:0;padding:5px 10px;font-size:13px;">Bilde</button>
        </div>`;
    }).join('')}</div>`;
    if (info) info.textContent = `${dyrHosEier.length} dyr registrert på valgt dyreeier.`;
  };

  window.fyllDyreeierDyrValg = function(dyreeierId = '', valgtDyrId = ''){
    const hidden = document.getElementById('dyreeierDyrValg');
    if (hidden) hidden.value = valgtDyrId || '';
    window.vetStackSafeTegnDyrHosEier(dyreeierId);
  };

  window.tegnDyreeiere = function(){
    const liste = document.getElementById('dyreeierListe');
    if (!liste) return;
    if (!(window.vetDyreeiere || vetDyreeiere || []).length) {
      liste.innerHTML = '<p class="lite">Ingen dyreeiere registrert ennå.</p>';
      return;
    }
    liste.innerHTML = `<div class="vet-klikk-liste">${(window.vetDyreeiere || vetDyreeiere || []).map(e => {
      const id = esc(e.id);
      return `
        <button type="button" class="vet-klikk-rad" data-vet-stacksafe-open-eier="${id}" style="grid-template-columns:minmax(170px,1.4fr) minmax(100px,.8fr) minmax(190px,1.4fr) 90px;">
          <span>${esc(e.navn || 'Uten navn')}</span>
          <span>${esc(e.telefon || '')}</span>
          <span>${esc(e.epost || '')}</span>
          <span>Åpne</span>
        </button>`;
    }).join('')}</div>`;
  };

  document.addEventListener('click', function(e){
    const bilde = e.target.closest('[data-vet-stacksafe-bilde-dyr]');
    if (bilde) {
      e.preventDefault();
      e.stopPropagation();
      return window.vetStackSafeBildeDyr(bilde.dataset.vetStacksafeBildeDyr);
    }
    const dyr = e.target.closest('[data-vet-stacksafe-open-dyr]');
    if (dyr) {
      e.preventDefault();
      e.stopPropagation();
      return window.vetStackSafeOpenDyr(dyr.dataset.vetStacksafeOpenDyr);
    }
    const eier = e.target.closest('[data-vet-stacksafe-open-eier]');
    if (eier) {
      e.preventDefault();
      e.stopPropagation();
      return window.vetStackSafeOpenEier(eier.dataset.vetStacksafeOpenEier);
    }
  }, true);

  const start = () => {
    try { window.tegnDyreeiere(); } catch(e) { console.warn(e); }
    try { window.vetStackSafeTegnDyrHosEier(vetTekst('dyreeierId')); } catch(e) { console.warn(e); }
    sørgForDyrBildeUI();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 350), { once:true });
  else setTimeout(start, 350);
})();
/* ===== SLUTT STACKSAFE FIX ===== */


/* === FIX: klikk klinikk -> vis brukere og endre rolle === */
function vetEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tegnKlinikker() {
  const liste = document.getElementById("klinikkListe");
  if (!liste) return;

  if (!vetKlinikker.length) {
    liste.innerHTML = '<p class="lite">Ingen klinikker registrert ennå.</p>';
    return;
  }

  liste.innerHTML = vetKlinikker.map(k => `
    <button
      type="button"
      class="listekort vet-klinikk-kort"
      onclick="redigerKlinikk('${vetEsc(k.id)}')"
      style="
        width:100%;
        display:block;
        text-align:left;
        cursor:pointer;
        margin-bottom:10px;
      "
      title="Klikk for å åpne klinikk og vise brukere"
    >
      <strong>${vetEsc(k.navn || "")}</strong><br>
      <span class="lite">
        ${k.konsern_navn ? "Konsern: " + vetEsc(k.konsern_navn) + "<br>" : ""}
        ${vetEsc(k.telefon || "")} ${vetEsc(k.epost || "")}
        ${k.km_pris ? "<br>Km-pris: " + formaterKr(k.km_pris) + " kr" : ""}
      </span><br>
      ${erVetAdminSync() && k.logo_url ? `<img src="${vetEsc(k.logo_url)}" alt="Logo" style="max-height:50px; margin-top:6px;"><br>` : ""}
      <span class="lite">Klikk for brukere og roller</span>
    </button>
  `).join("");
}

function redigerKlinikk(id) {
  const k = vetKlinikker.find(x => String(x.id) === String(id));
  if (!k) return;

  vetSett("klinikkId", k.id);
  vetSett("klinikkNavn", k.navn);
  vetSett("konsernNavn", k.konsern_navn);
  vetSett("klinikkTelefon", k.telefon);
  vetSett("klinikkEpost", k.epost);
  vetSett("klinikkAdresse", k.adresse);
  vetSett("klinikkKmPris", k.km_pris || "5.30");
  visKlinikkLogoPreview(k.logo_url || "");

  visVetSide("klinikkSide");

  const brukerEl = document.getElementById("adminKlinikkBrukere");
  if (brukerEl) {
    brukerEl.classList.remove("skjult");
    brukerEl.style.display = "";
  }

  const msg = document.getElementById("klinikkBrukerMelding");
  if (msg) msg.textContent = "Valgt klinikk: " + (k.navn || "");

  lastKlinikkBrukere();
}

function tegnKlinikkBrukere(liste = []) {
  const el = document.getElementById("klinikkBrukerListe");
  if (!el) return;

  if (!erKlinikkAdmin()) {
    el.innerHTML = "";
    return;
  }

  if (!liste.length) {
    el.innerHTML = '<p class="lite">Ingen brukere koblet til valgt klinikk ennå.</p>';
    return;
  }

  el.innerHTML = `
    <div class="vet-linje-liste" style="display:grid;gap:6px;margin-top:8px;">
      ${liste.map(b => {
        const id = vetEsc(b.id);
        const rolle = String(b.rolle || "veterinaer").toLowerCase();
        const navn = vetEsc(b.navn || "");
        const epost = vetEsc(b.epost || "");
        const aktiv = b.aktiv !== false;

        return `
          <div class="listekort" style="display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(220px,1.6fr) minmax(140px,.9fr) 120px;gap:10px;align-items:center;">
            <div>
              <strong>${navn || "Uten navn"}</strong><br>
              <span class="lite">${epost}</span>
            </div>

            <select id="rolle_${id}" style="margin:0;">
              <option value="veterinaer" ${rolle === "veterinaer" ? "selected" : ""}>Veterinær</option>
              <option value="admin" ${rolle === "admin" ? "selected" : ""}>Klinikkadmin</option>
              <option value="systemadmin" ${rolle === "systemadmin" ? "selected" : ""}>Systemadmin</option>
            </select>

            <span class="lite">${aktiv ? "Aktiv" : "Inaktiv"}</span>

            <button type="button" class="secondary" onclick="endreKlinikkBrukerRolle('${id}')">
              Lagre rolle
            </button>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

async function endreKlinikkBrukerRolle(brukerId) {
  vetMelding("klinikkBrukerMelding", "");

  if (!erKlinikkAdmin()) {
    vetMelding("klinikkBrukerMelding", "Kun admin kan endre roller.");
    return;
  }

  const rolle = String(document.getElementById("rolle_" + brukerId)?.value || "veterinaer").trim();

  const { error } = await supabaseClient
    .from("vet_klinikk_brukere")
    .update({ rolle })
    .eq("id", brukerId);

  if (error) {
    vetMelding("klinikkBrukerMelding", "Feil ved endring av rolle: " + error.message);
    return;
  }

  vetMelding("klinikkBrukerMelding", "Rolle oppdatert.");
  await lastKlinikkBrukere();
}



/* ===== ROBUST SYSADMIN + OPPSETT + MVA FILTER FIX 2026-06-09 =====
   Denne ligger helt nederst og overstyrer eldre menyfixer som skjulte knapper igjen. */
(function () {
  function vetErAdminNaa() {
    try { return (typeof erKlinikkAdmin === "function" && erKlinikkAdmin()) || vetErSystemAdmin === true; }
    catch (e) { return vetErSystemAdmin === true; }
  }

  function visEl(el, synlig, display = "inline-block") {
    if (!el) return;
    el.style.display = synlig ? display : "none";
    if (synlig) el.classList.remove("skjult");
    else el.classList.add("skjult");
  }

  window.toggleVetOppsettMeny = function () {
    const meny = document.getElementById("vetOppsettMeny");
    if (!meny) return false;
    const erSkjult = meny.classList.contains("skjult") || meny.style.display === "none" || !meny.style.display;
    if (erSkjult) {
      meny.classList.remove("skjult");
      meny.style.display = "block";
    } else {
      meny.classList.add("skjult");
      meny.style.display = "none";
    }
    return false;
  };

  window.oppdaterVetMenySynlighet = function () {
    if (typeof oppdaterVetToppInfo === "function") oppdaterVetToppInfo();

    const admin = vetErAdminNaa();
    const systemadmin = vetErSystemAdmin === true || String(vetKlinikkRolle || "").toLowerCase() === "systemadmin";

    document.querySelectorAll(".vet-bruker-nav,.vet-lagerlogg-nav").forEach(el => visEl(el, true));
    document.querySelectorAll(".vet-admin-nav,.vet-faktura-nav,.vet-oppsett-nav").forEach(el => visEl(el, admin));
    document.querySelectorAll(".vet-systemadmin-nav").forEach(el => visEl(el, systemadmin));

    const oppsettKnapp = document.getElementById("vetOppsettKnapp");
    if (oppsettKnapp) {
      visEl(oppsettKnapp, admin);
      oppsettKnapp.onclick = window.toggleVetOppsettMeny;
    }

    const modulKnapp = document.getElementById("velgModulKnapp");
    if (modulKnapp && vetInnloggetEpost === "greknuts@online.no") {
      modulKnapp.style.display = "inline-block";
    }

    const visInfo = document.getElementById("vetVisningInfo");
    if (visInfo) visInfo.style.display = "none";

    const undermeny = document.getElementById("vetOppsettMeny");
    if (undermeny && !admin) {
      undermeny.classList.add("skjult");
      undermeny.style.display = "none";
    }
  };

  function kobleRobustMeny() {
    const oppsettKnapp = document.getElementById("vetOppsettKnapp");
    if (oppsettKnapp) {
      oppsettKnapp.onclick = window.toggleVetOppsettMeny;
      if (vetErAdminNaa()) oppsettKnapp.style.display = "inline-block";
    }
    if (typeof window.oppdaterVetMenySynlighet === "function") window.oppdaterVetMenySynlighet();
  }

  document.addEventListener("DOMContentLoaded", kobleRobustMeny);
  window.addEventListener("load", kobleRobustMeny);
  setTimeout(kobleRobustMeny, 500);
  setTimeout(kobleRobustMeny, 1500);
})();

/* ===== REDIGER KLINIKKBRUKERE FIX 2026-06-09 =====
   Admin kan redigere navn, e-post, rolle og aktiv/inaktiv på klinikkbrukere.
   Dette endrer vet_klinikk_brukere. Auth-bruker/passord håndteres fortsatt av Supabase/edge function. */
(function () {
  function esc(verdi) {
    if (typeof vetEsc === "function") return vetEsc(verdi);
    return String(verdi ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.tegnKlinikkBrukere = function (liste = []) {
    const el = document.getElementById("klinikkBrukerListe");
    if (!el) return;

    if (typeof erKlinikkAdmin === "function" && !erKlinikkAdmin()) {
      el.innerHTML = "";
      return;
    }

    if (!liste.length) {
      el.innerHTML = '<p class="lite">Ingen brukere koblet til valgt klinikk ennå.</p>';
      return;
    }

    el.innerHTML = `
      <div style="display:grid; gap:8px; margin-top:10px;">
        ${liste.map(b => {
          const id = esc(b.id);
          const navn = esc(b.navn || "");
          const epost = esc(b.epost || "");
          const rolle = String(b.rolle || "veterinaer").toLowerCase();
          const aktiv = b.aktiv !== false;

          return `
            <div class="listekort" style="display:grid; grid-template-columns:minmax(150px,1fr) minmax(210px,1.3fr) minmax(140px,.8fr) minmax(110px,.6fr) 120px; gap:10px; align-items:end;">
              <div>
                <label for="bruker_navn_${id}" style="margin-top:0;">Navn</label>
                <input id="bruker_navn_${id}" value="${navn}" style="margin:0;">
              </div>

              <div>
                <label for="bruker_epost_${id}" style="margin-top:0;">E-post</label>
                <input id="bruker_epost_${id}" type="email" value="${epost}" style="margin:0;">
              </div>

              <div>
                <label for="bruker_rolle_${id}" style="margin-top:0;">Rolle</label>
                <select id="bruker_rolle_${id}" style="margin:0;">
                  <option value="veterinaer" ${rolle === "veterinaer" ? "selected" : ""}>Veterinær</option>
                  <option value="admin" ${rolle === "admin" ? "selected" : ""}>Klinikkadmin</option>
                  <option value="systemadmin" ${rolle === "systemadmin" ? "selected" : ""}>Systemadmin</option>
                </select>
              </div>

              <div>
                <label for="bruker_aktiv_${id}" style="margin-top:0;">Status</label>
                <select id="bruker_aktiv_${id}" style="margin:0;">
                  <option value="true" ${aktiv ? "selected" : ""}>Aktiv</option>
                  <option value="false" ${!aktiv ? "selected" : ""}>Inaktiv</option>
                </select>
              </div>

              <button type="button" class="secondary" onclick="lagreEndretKlinikkBruker('${id}')">Lagre</button>
            </div>
          `;
        }).join("")}
      </div>
      <p class="lite">Merk: Endring av e-post her endrer koblingen i klinikktabellen. Innlogging/passord styres av Supabase Auth.</p>
    `;
  };

  window.lagreEndretKlinikkBruker = async function (brukerId) {
    vetMelding("klinikkBrukerMelding", "");

    if (typeof erKlinikkAdmin === "function" && !erKlinikkAdmin()) {
      vetMelding("klinikkBrukerMelding", "Kun admin kan redigere brukere.");
      return;
    }

    const navn = String(document.getElementById("bruker_navn_" + brukerId)?.value || "").trim();
    const epost = String(document.getElementById("bruker_epost_" + brukerId)?.value || "").trim().toLowerCase();
    const rolle = String(document.getElementById("bruker_rolle_" + brukerId)?.value || "veterinaer").trim();
    const aktiv = String(document.getElementById("bruker_aktiv_" + brukerId)?.value || "true") === "true";

    if (!epost) {
      vetMelding("klinikkBrukerMelding", "E-post kan ikke være tom.");
      return;
    }

    const { error } = await supabaseClient
      .from("vet_klinikk_brukere")
      .update({ navn: navn || null, epost, rolle, aktiv })
      .eq("id", brukerId);

    if (error) {
      vetMelding("klinikkBrukerMelding", "Feil ved lagring av bruker: " + error.message);
      return;
    }

    vetMelding("klinikkBrukerMelding", "Bruker oppdatert.");
    if (typeof lastKlinikkBrukere === "function") await lastKlinikkBrukere();
    if (typeof lastVetKlinikkBrukereAlle === "function") await lastVetKlinikkBrukereAlle();
  };
})();

/* ===== FIX: HINDRE DOBBELTLAGRING AV DYR/PASIENT 2026-06-09 =====
   Flere tidligere patcher hadde koblet Lagre dyr med både addEventListener og onclick.
   Denne ligger nederst, stopper gamle click-listeners i capture-fasen, og kjører én trygg lagring. */
(function () {
  let vetLagrerDyrNaa = false;
  let vetSisteDyrKlikkTid = 0;

  function v(id) { return String(document.getElementById(id)?.value || '').trim(); }
  function sett(id, verdi) { const el = document.getElementById(id); if (el) el.value = verdi ?? ''; }

  function sameText(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  async function lastOppBildeTrygt(dyrId) {
    if (!dyrId) return null;
    try {
      if (typeof vetLastOppDyrBilde === 'function') return await vetLastOppDyrBilde(dyrId);
    } catch (e) {
      console.warn('Bildeopplasting feilet:', e);
      if (typeof vetMelding === 'function') vetMelding('dyrMelding', 'Dyr lagret, men bilde kunne ikke lagres: ' + (e.message || e));
    }
    return null;
  }

  async function lagreDyrBareEnGang(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }

    const naa = Date.now();
    if (vetLagrerDyrNaa || (naa - vetSisteDyrKlikkTid < 1200)) return false;
    vetLagrerDyrNaa = true;
    vetSisteDyrKlikkTid = naa;

    const knapp = document.getElementById('lagreDyrKnapp');
    const gammelTekst = knapp ? knapp.textContent : '';
    if (knapp) { knapp.disabled = true; knapp.textContent = 'Lagrer ...'; }

    try {
      if (typeof vetMelding === 'function') vetMelding('dyrMelding', '');
      if (typeof vetInitDyrBildeUI === 'function') vetInitDyrBildeUI();

      const eierId = v('dyrEierValg');
      const navn = v('dyrNavn');
      if (!eierId) { if (typeof vetMelding === 'function') vetMelding('dyrMelding', 'Velg dyreeier først.'); return false; }
      if (!navn) { if (typeof vetMelding === 'function') vetMelding('dyrMelding', 'Skriv navn på dyr/pasient.'); return false; }

      let rad = {
        dyreeier_id: eierId,
        navn,
        art: v('dyrArt') || null,
        rase: v('dyrRase') || null,
        fodselsdato: v('dyrFodselsdato') || null,
        kjonn: v('dyrKjonn') || null,
        idmerking: v('dyrIdmerking') || null
      };
      if (typeof leggTilKlinikkHvisVanligBruker === 'function') rad = leggTilKlinikkHvisVanligBruker(rad);

      let id = v('dyrId');

      // Hvis skjemaet ikke har id, men samme dyr allerede finnes på samme dyreeier,
      // oppdater eksisterende i stedet for å lage tvilling-dyr.
      if (!id && Array.isArray(vetDyr)) {
        const eksisterende = vetDyr.find(d =>
          String(d.dyreeier_id || d.eier_id || '') === String(eierId) &&
          sameText(d.navn, navn) &&
          sameText(d.art, rad.art) &&
          sameText(d.rase, rad.rase)
        );
        if (eksisterende?.id) id = eksisterende.id;
      }

      const query = id
        ? supabaseClient.from('vet_dyr').update(rad).eq('id', id).select('id').single()
        : supabaseClient.from('vet_dyr').insert(rad).select('id').single();

      const { data, error } = await query;
      if (error) {
        if (typeof vetMelding === 'function') vetMelding('dyrMelding', 'Feil ved lagring av dyr: ' + error.message);
        return false;
      }

      const lagretDyrId = data?.id || id;
      const bildeUrl = await lastOppBildeTrygt(lagretDyrId);

      if (typeof lastDyr === 'function') await lastDyr();

      sett('dyrId', lagretDyrId || '');
      sett('dyrEierValg', eierId);
      sett('dyreeierId', eierId);
      sett('dyreeierVelgForDyr', eierId);

      if (bildeUrl && typeof vetSettDyrBildePreview === 'function') vetSettDyrBildePreview(bildeUrl);
      const fil = document.getElementById('dyrBildeFil');
      if (fil) fil.value = '';

      if (typeof fyllDyreeierDyrValg === 'function') fyllDyreeierDyrValg(eierId, lagretDyrId || '');
      if (typeof fyllDyrValg === 'function') fyllDyrValg();
      if (typeof fyllJournalDyreeierValg === 'function') fyllJournalDyreeierValg();

      const tekst = bildeUrl ? 'Dyr/pasient og bilde lagret.' : 'Dyr/pasient lagret.';
      if (typeof vetMelding === 'function') vetMelding('dyrMelding', tekst);

      // Vis eierkortet igjen, uten å lagre på nytt.
      if (typeof window.vetStackSafeOpenEier === 'function') window.vetStackSafeOpenEier(eierId);
      else if (typeof visVetSide === 'function') visVetSide('eierSide');
      if (typeof vetMelding === 'function') vetMelding('dyreeierMelding', tekst);
      if (typeof fyllDyreeierDyrValg === 'function') fyllDyreeierDyrValg(eierId, lagretDyrId || '');

      return false;
    } finally {
      setTimeout(() => { vetLagrerDyrNaa = false; }, 900);
      if (knapp) { knapp.disabled = false; knapp.textContent = gammelTekst || 'Lagre dyr'; }
    }
  }

  window.lagreDyr = lagreDyrBareEnGang;

  function kobleLagreDyrEksklusivt() {
    const knapp = document.getElementById('lagreDyrKnapp');
    if (!knapp || knapp.dataset.vetEksklusivLagreDyr === '1') return;
    knapp.dataset.vetEksklusivLagreDyr = '1';
    knapp.onclick = lagreDyrBareEnGang;
    // Capture + stopImmediatePropagation stopper gamle addEventListener-koblinger.
    knapp.addEventListener('click', lagreDyrBareEnGang, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kobleLagreDyrEksklusivt, { once: true });
  else kobleLagreDyrEksklusivt();
  window.addEventListener('load', kobleLagreDyrEksklusivt);
  setTimeout(kobleLagreDyrEksklusivt, 500);
  setTimeout(kobleLagreDyrEksklusivt, 1500);
})();
/* ===== SLUTT FIX: HINDRE DOBBELTLAGRING AV DYR/PASIENT ===== */

/* ===== ABSOLUTT SISTE FIX 09.06: DYR SKAL IKKE DOBBELTLAGRES ELLER DOBBELTVISES =====
   Ligger helt nederst og overstyrer alle tidligere patcher. */
(function () {
  let lagrerDyr = false;
  let sistStartet = 0;

  function txt(id) { return String(document.getElementById(id)?.value || '').trim(); }
  function setv(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function dyrKey(d) {
    return [d.dyreeier_id || d.eier_id || '', norm(d.navn), norm(d.art), norm(d.rase), norm(d.idmerking)].join('|');
  }
  function unikeDyr(liste) {
    const sett = new Set();
    const ut = [];
    (liste || []).forEach(d => {
      const key = dyrKey(d);
      if (sett.has(key)) return;
      sett.add(key);
      ut.push(d);
    });
    return ut;
  }

  const originalLastDyr = typeof lastDyr === 'function' ? lastDyr : null;
  if (originalLastDyr) {
    window.lastDyr = lastDyr = async function () {
      await originalLastDyr();
      vetDyr = unikeDyr(vetDyr);
      if (typeof tegnDyr === 'function') tegnDyr();
      const aktivDyreeierId = txt('dyreeierId');
      if (aktivDyreeierId && typeof fyllDyreeierDyrValg === 'function') fyllDyreeierDyrValg(aktivDyreeierId);
    };
  }

  window.fyllDyreeierDyrValg = fyllDyreeierDyrValg = function (dyreeierId = '', valgtDyrId = '') {
    const liste = typeof vetSørgForDyreListeUnderEier === 'function'
      ? vetSørgForDyreListeUnderEier()
      : document.getElementById('dyreeierDyrListe');
    const info = document.getElementById('dyreeierDyrInfo');
    const hidden = document.getElementById('dyreeierDyrValg');
    if (hidden) hidden.value = valgtDyrId || '';
    if (!liste) return;

    if (!dyreeierId) {
      liste.innerHTML = '<p class="lite">Velg eller klikk en dyreeier først.</p>';
      if (info) info.textContent = '';
      return;
    }

    const dyrHosEier = unikeDyr((vetDyr || [])
      .filter(d => String(d.dyreeier_id || d.eier_id || '') === String(dyreeierId)))
      .sort((a, b) => String(a.navn || '').localeCompare(String(b.navn || ''), 'nb'));

    if (!dyrHosEier.length) {
      liste.innerHTML = '<p class="lite">Ingen dyr registrert på denne dyreeieren ennå.</p>';
      if (info) info.textContent = 'Ingen dyr funnet på valgt dyreeier.';
      return;
    }

    const esc = typeof vetKlikkEsc === 'function' ? vetKlikkEsc : (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
    const mini = typeof vetMiniDyrBilde === 'function' ? vetMiniDyrBilde : () => '<span>📷</span>';

    liste.innerHTML = `
      <div class="vet-klikk-liste">
        ${dyrHosEier.map(d => {
          const id = esc(d.id);
          const valgt = valgtDyrId && String(valgtDyrId) === String(d.id);
          const navn = esc(d.navn || 'Uten navn');
          const artRase = esc([d.art, d.rase].filter(Boolean).join(' / '));
          const idmerking = esc(d.idmerking || '');
          return `
            <button type="button"
              class="vet-klikk-rad"
              onclick="vetVelgDyrFraEierListe('${id}')"
              title="Klikk for detaljer på dyret"
              style="grid-template-columns:42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(110px,.8fr) 70px;${valgt ? 'outline:1px solid #1f6feb;' : ''}">
              ${mini(d)}
              <span>${navn}</span>
              <span>${artRase}</span>
              <span>${idmerking}</span>
              <span>Åpne</span>
            </button>`;
        }).join('')}
      </div>`;

    if (info) info.textContent = `${dyrHosEier.length} dyr registrert på valgt dyreeier.`;
  };

  window.tegnDyr = tegnDyr = function () {
    const liste = document.getElementById('dyrListe');
    if (!liste) return;
    const unike = unikeDyr(vetDyr || []);
    vetDyr = unike;

    if (!unike.length) {
      liste.innerHTML = '<p class="lite">Ingen dyr registrert ennå.</p>';
      return;
    }

    const esc = typeof vetLinjeEsc === 'function' ? vetLinjeEsc : (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
    const wrap = typeof vetLinjeWrap === 'function' ? vetLinjeWrap : (inner) => `<div>${inner}</div>`;
    const span = typeof vetLinjeSpan === 'function' ? vetLinjeSpan : (v) => `<span>${v || '&nbsp;'}</span>`;
    const knapp = typeof vetLinjeKnapp === 'function' ? vetLinjeKnapp : (onClick, cols, inner) => `<button type="button" onclick="${onClick}">${inner}</button>`;

    liste.innerHTML = wrap(unike.map(d => {
      const id = esc(d.id);
      const navn = esc(d.navn || 'Uten navn');
      const artRase = esc([d.art, d.rase].filter(Boolean).join(' / '));
      const eierNavn = esc(d.vet_dyreeiere?.navn || (vetDyreeiere || []).find(e => String(e.id) === String(d.dyreeier_id))?.navn || '');
      const idmerking = esc(d.idmerking || '');
      const bilde = d.bilde_url
        ? `<img src="${esc(d.bilde_url)}" alt="${navn}" style="width:34px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #ddd;">`
        : `<span class="lite" style="font-size:12px !important;font-weight:400 !important;line-height:1;">📷</span>`;
      return knapp(
        `redigerDyr('${id}')`,
        '42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(160px,1.3fr) minmax(110px,.8fr)',
        `${bilde}${span(navn)}${span(artRase)}${span(eierNavn)}${span(idmerking)}`
      );
    }).join(''));
  };

  async function lagreDyrTrygt(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }
    const naa = Date.now();
    if (lagrerDyr || (naa - sistStartet < 1500)) return false;
    lagrerDyr = true;
    sistStartet = naa;

    const knapp = document.getElementById('lagreDyrKnapp');
    const gammelTekst = knapp?.textContent || 'Lagre dyr';
    if (knapp) { knapp.disabled = true; knapp.textContent = 'Lagrer ...'; }

    try {
      if (typeof vetMelding === 'function') vetMelding('dyrMelding', '');
      if (typeof vetInitDyrBildeUI === 'function') vetInitDyrBildeUI();

      const eierId = txt('dyrEierValg');
      const navn = txt('dyrNavn');
      if (!eierId) { vetMelding('dyrMelding', 'Velg dyreeier først.'); return false; }
      if (!navn) { vetMelding('dyrMelding', 'Skriv navn på dyr/pasient.'); return false; }

      let rad = {
        dyreeier_id: eierId,
        navn,
        art: txt('dyrArt') || null,
        rase: txt('dyrRase') || null,
        fodselsdato: txt('dyrFodselsdato') || null,
        kjonn: txt('dyrKjonn') || null,
        idmerking: txt('dyrIdmerking') || null
      };
      if (typeof leggTilKlinikkHvisVanligBruker === 'function') rad = leggTilKlinikkHvisVanligBruker(rad);

      let id = txt('dyrId');
      if (!id && Array.isArray(vetDyr)) {
        const eksisterende = vetDyr.find(d => dyrKey(d) === dyrKey(rad));
        if (eksisterende?.id) id = eksisterende.id;
      }

      const query = id
        ? supabaseClient.from('vet_dyr').update(rad).eq('id', id).select('id').single()
        : supabaseClient.from('vet_dyr').insert(rad).select('id').single();
      const { data, error } = await query;
      if (error) { vetMelding('dyrMelding', 'Feil ved lagring av dyr: ' + error.message); return false; }

      const lagretDyrId = data?.id || id;
      let bildeUrl = null;
      try {
        if (typeof vetLastOppDyrBilde === 'function') bildeUrl = await vetLastOppDyrBilde(lagretDyrId);
      } catch (bildeFeil) {
        console.warn('Bilde kunne ikke lagres:', bildeFeil);
      }

      if (typeof lastDyr === 'function') await lastDyr();
      vetDyr = unikeDyr(vetDyr);

      setv('dyrId', lagretDyrId || '');
      setv('dyrEierValg', eierId);
      setv('dyreeierId', eierId);
      setv('dyreeierVelgForDyr', eierId);
      const fil = document.getElementById('dyrBildeFil');
      if (fil) fil.value = '';
      if (bildeUrl && typeof vetSettDyrBildePreview === 'function') vetSettDyrBildePreview(bildeUrl);

      if (typeof fyllDyreeierDyrValg === 'function') fyllDyreeierDyrValg(eierId, lagretDyrId || '');
      if (typeof fyllDyrValg === 'function') fyllDyrValg();
      if (typeof fyllJournalDyreeierValg === 'function') fyllJournalDyreeierValg();

      const msg = bildeUrl ? 'Dyr/pasient og bilde lagret.' : 'Dyr/pasient lagret.';
      vetMelding('dyrMelding', msg);
      if (typeof window.vetStackSafeOpenEier === 'function') window.vetStackSafeOpenEier(eierId);
      else if (typeof visVetSide === 'function') visVetSide('eierSide');
      vetMelding('dyreeierMelding', msg);
      if (typeof fyllDyreeierDyrValg === 'function') fyllDyreeierDyrValg(eierId, lagretDyrId || '');
      return false;
    } finally {
      setTimeout(() => { lagrerDyr = false; }, 1000);
      if (knapp) { knapp.disabled = false; knapp.textContent = gammelTekst; }
    }
  }

  window.lagreDyr = lagreDyr = lagreDyrTrygt;

  function kobleEksklusivt() {
    const gammel = document.getElementById('lagreDyrKnapp');
    if (!gammel) return;

    // Klon knappen hver gang. Det fjerner ALLE gamle addEventListener-koblinger.
    const ny = gammel.cloneNode(true);
    ny.dataset.vetAbsoluttSisteLagreDyr = '1';
    ny.disabled = false;
    ny.onclick = lagreDyrTrygt;
    ny.addEventListener('click', lagreDyrTrygt, true);
    gammel.replaceWith(ny);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kobleEksklusivt, { once: true });
  else kobleEksklusivt();
  window.addEventListener('load', kobleEksklusivt);
  [100, 500, 1500, 3000].forEach(ms => setTimeout(kobleEksklusivt, ms));
})();
/* ===== SLUTT ABSOLUTT SISTE FIX ===== */

/* ===== DYR DETALJVISNING VED ÅPNE 09.06 FINAL ===== */
function vetDetaljEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetFinnDyreeierForDyr(dyr) {
  if (!dyr) return null;
  return (vetDyreeiere || []).find(e => String(e.id) === String(dyr.dyreeier_id)) || dyr.vet_dyreeiere || null;
}

function vetFormatDato(dato) {
  if (!dato) return "";
  const tekst = String(dato).slice(0, 10);
  const deler = tekst.split("-");
  if (deler.length === 3) return `${deler[2]}.${deler[1]}.${deler[0]}`;
  return tekst;
}

function vetSørgForDyrDetaljOmrade() {
  const dyrSide = document.getElementById("dyrSide");
  if (!dyrSide) return null;

  let detalj = document.getElementById("dyrDetaljOmrade");
  if (detalj) return detalj;

  detalj = document.createElement("div");
  detalj.id = "dyrDetaljOmrade";
  detalj.className = "listekort";
  detalj.style.margin = "12px 0";
  detalj.style.display = "none";

  const liste = document.getElementById("dyrListe");
  if (liste && liste.parentNode) {
    liste.parentNode.insertBefore(detalj, liste);
  } else {
    dyrSide.insertBefore(detalj, dyrSide.firstChild);
  }

  return detalj;
}

function vetVisDyrDetaljer(dyrId) {
  const detalj = vetSørgForDyrDetaljOmrade();
  if (!detalj) return;

  const d = (vetDyr || []).find(x => String(x.id) === String(dyrId));
  if (!d) {
    detalj.style.display = "none";
    return;
  }

  const eier = vetFinnDyreeierForDyr(d);
  const journaler = (vetJournal || [])
    .filter(j => String(j.dyr_id || "") === String(d.id))
    .sort((a, b) => String(b.dato || "").localeCompare(String(a.dato || "")));

  const bildeHtml = d.bilde_url
    ? `<img src="${vetDetaljEsc(d.bilde_url)}" alt="${vetDetaljEsc(d.navn || "Dyr")}" style="width:130px;height:105px;object-fit:cover;border:1px solid #ddd;border-radius:8px;background:#fafafa;">`
    : `<div style="width:130px;height:105px;border:1px solid #ddd;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fafafa;color:#777;">Ikke bilde</div>`;

  const linje = (label, verdi) => `
    <div style="display:grid;grid-template-columns:130px 1fr;gap:8px;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.06);">
      <span class="lite"><strong>${vetDetaljEsc(label)}</strong></span>
      <span>${vetDetaljEsc(verdi || "Ikke registrert")}</span>
    </div>`;

  const journalHtml = journaler.length
    ? `<div style="margin-top:12px;">
        <strong>Journal</strong>
        <div style="display:grid;gap:4px;margin-top:6px;">
          ${journaler.slice(0, 6).map(j => `
            <button type="button" class="secondary" onclick="visVetSide('journalSide'); vetSett('journalDyreeierValg','${vetDetaljEsc(d.dyreeier_id || "")}'); fyllDyrValg(); vetSett('journalDyrValg','${vetDetaljEsc(d.id || "")}');" style="text-align:left;">
              ${vetDetaljEsc(vetFormatDato(j.dato))} - ${vetDetaljEsc(j.type || "Journalnotat")} ${Number(j.belop_eks_mva || 0) > 0 ? " - " + formaterKr(j.belop_eks_mva) + " kr eks. mva" : ""}
            </button>
          `).join("")}
        </div>
        <p class="lite">${journaler.length} journalnotat(er) totalt.</p>
      </div>`
    : `<p class="lite" style="margin-top:12px;">Ingen journalnotater registrert på dyret ennå.</p>`;

  detalj.innerHTML = `
    <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">
      <div>${bildeHtml}</div>
      <div style="flex:1;min-width:240px;">
        <h3 style="margin:0 0 8px 0;">${vetDetaljEsc(d.navn || "Dyr/pasient")}</h3>
        ${linje("Eier", eier?.navn || "")}
        ${linje("Telefon", eier?.telefon || "")}
        ${linje("E-post", eier?.epost || "")}
        ${linje("Art", d.art || "")}
        ${linje("Rase", d.rase || "")}
        ${linje("Kjønn", d.kjonn || "")}
        ${linje("Fødselsdato", vetFormatDato(d.fodselsdato))}
        ${linje("ID-merking", d.idmerking || d.chip || "")}
        ${d.notater ? linje("Notater", d.notater) : ""}
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="secondary" onclick="vetFyllDyrSkjemaForRedigering('${vetDetaljEsc(d.id)}')">Rediger detaljer</button>
          <button type="button" class="secondary" onclick="visVetSide('journalSide'); vetSett('journalDyreeierValg','${vetDetaljEsc(d.dyreeier_id || "")}'); fyllDyrValg(); vetSett('journalDyrValg','${vetDetaljEsc(d.id || "")}');">Ny journal</button>
        </div>
      </div>
    </div>
    ${journalHtml}
  `;
  detalj.style.display = "block";
}

function vetFyllDyrSkjemaForRedigering(id) {
  const d = (vetDyr || []).find(x => String(x.id) === String(id));
  if (!d) return;

  fyllDyreeierValg(d.dyreeier_id || "");
  vetSett("dyrId", d.id || "");
  vetSett("dyrEierValg", d.dyreeier_id || "");
  vetSett("dyrNavn", d.navn || "");
  vetSett("dyrArt", d.art || "");
  vetSett("dyrRase", d.rase || "");
  vetSett("dyrFodselsdato", d.fodselsdato || "");
  vetSett("dyrKjonn", d.kjonn || "");
  vetSett("dyrIdmerking", d.idmerking || d.chip || "");
  vetSett("dyrNotater", d.notater || "");

  if (typeof vetInitDyrBildeUI === "function") vetInitDyrBildeUI();
  if (typeof vetSettDyrBildePreview === "function") vetSettDyrBildePreview(d.bilde_url || "");

  const navn = document.getElementById("dyrNavn");
  if (navn) navn.focus();
}

function redigerDyr(id) {
  visVetSide("dyrSide");
  vetFyllDyrSkjemaForRedigering(id);
  vetVisDyrDetaljer(id);
}

window.redigerDyr = redigerDyr;
window.vetVisDyrDetaljer = vetVisDyrDetaljer;
window.vetFyllDyrSkjemaForRedigering = vetFyllDyrSkjemaForRedigering;
/* ===== SLUTT DYR DETALJVISNING VED ÅPNE 09.06 FINAL ===== */


/* =========================================================
   PASIENTLISTE EIER -> DYR -> BEHANDLINGER - REN STABIL VERSJON
   2026-06-10
   Erstatter eksperimentelle pasientliste-fikser.
   Flyt:
   1) Vis kun dyreeiere som klikkbar liste.
   2) Klikk eier viser kun dyrene til denne eieren.
   3) Klikk dyr viser behandlingene til dyret.
   4) Ny behandling åpner journal ferdig valgt på riktig eier/dyr.
   ========================================================= */
(function () {
  let valgtEierId = "";
  let valgtDyrId = "";
  let sistTegnet = "";

  function qs(id) { return document.getElementById(id); }
  function v(id) { return String(qs(id)?.value || "").trim(); }
  function setv(id, value) { const x = qs(id); if (x) x.value = value || ""; }
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function datoNo(d) {
    const s = String(d || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y,m,day] = s.split("-");
      return `${day}.${m}.${y}`;
    }
    return s;
  }
  function sideErPasienter() {
    const side = qs("eierSide");
    if (!side) return false;
    return !side.classList.contains("skjult") && side.style.display !== "none";
  }
  function arrDyreeiere() {
    try { return (vetDyreeiere || []).slice(); } catch(e) { return []; }
  }
  function arrDyr() {
    try { return (vetDyr || []).slice(); } catch(e) { return []; }
  }
  function arrJournal() {
    try { return (vetJournal || []).slice(); } catch(e) { return []; }
  }
  function eierForDyr(dyr) {
    return arrDyreeiere().find(e => String(e.id) === String(dyr?.dyreeier_id));
  }
  function dyrForEier(eierId) {
    return arrDyr()
      .filter(d => String(d.dyreeier_id) === String(eierId))
      .sort((a,b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));
  }
  function journalForDyr(dyrId) {
    return arrJournal()
      .filter(j => String(j.dyr_id) === String(dyrId))
      .sort((a,b) => String(b.dato || "").localeCompare(String(a.dato || "")) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }
  function antallJournal(dyrId) {
    return journalForDyr(dyrId).length;
  }

  function styleOnce() {
    if (qs("vetPasientTreStil")) return;
    const s = document.createElement("style");
    s.id = "vetPasientTreStil";
    s.textContent = `
      #vetPasientTreRoot { margin-top:10px; }
      .vet-tre-toolbar { display:flex; gap:8px; flex-wrap:wrap; margin:8px 0 12px 0; }
      .vet-tre-toolbar button { width:auto !important; min-height:34px !important; display:inline-block !important; border-radius:8px !important; padding:8px 12px !important; }
      .vet-eier-rad { border:1px solid #374151; border-radius:10px; background:#202528; margin:8px 0; overflow:hidden; }
      .vet-eier-knapp { width:100% !important; display:grid !important; grid-template-columns:minmax(160px,1fr) auto !important; gap:10px !important; text-align:left !important; align-items:center !important; background:#202528 !important; border:0 !important; border-radius:0 !important; padding:10px 12px !important; color:#f8fafc !important; }
      .vet-eier-knapp:hover, .vet-dyr-knapp:hover { outline:1px solid #60a5fa !important; background:#26313a !important; }
      .vet-eier-navn { font-size:18px !important; font-weight:700 !important; line-height:1.1 !important; color:#f8fafc !important; }
      .vet-eier-info { font-size:13px !important; color:#cbd5e1 !important; font-weight:400 !important; margin-top:3px !important; }
      .vet-eier-teller { font-size:13px !important; color:#cbd5e1 !important; white-space:nowrap !important; font-weight:400 !important; }
      .vet-dyr-liste { border-top:1px solid #374151; background:#171a1b; }
      .vet-dyr-rad { border-bottom:1px solid #374151; }
      .vet-dyr-rad:last-child { border-bottom:0; }
      .vet-dyr-knapp { width:100% !important; display:grid !important; grid-template-columns:minmax(130px,1fr) minmax(80px,.7fr) minmax(90px,.8fr) auto !important; gap:8px !important; align-items:center !important; text-align:left !important; background:#1f2528 !important; color:#f3f4f6 !important; border:0 !important; border-radius:0 !important; padding:7px 12px !important; min-height:34px !important; }
      .vet-dyr-knapp.valgt { background:#102033 !important; outline:1px solid #60a5fa !important; }
      .vet-dyr-knapp span { white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; font-size:13px !important; font-weight:400 !important; color:#f3f4f6 !important; }
      .vet-dyr-knapp .dyrnavn { font-weight:700 !important; }
      .vet-behandling-panel { padding:10px 12px 12px 12px; background:#0f172a; border-top:1px solid #1f6feb; }
      .vet-behandling-topp { display:flex; gap:8px; justify-content:space-between; align-items:center; flex-wrap:wrap; margin-bottom:8px; }
      .vet-behandling-topp strong { font-size:16px; }
      .vet-behandling-topp button { width:auto !important; display:inline-block !important; min-height:32px !important; padding:7px 10px !important; border-radius:8px !important; }
      .vet-behandling-linje { display:grid; grid-template-columns:110px minmax(100px,.7fr) minmax(160px,1.4fr) auto; gap:8px; align-items:start; padding:6px 8px; border:1px solid #374151; background:#202528; margin-top:4px; border-radius:6px; font-size:13px; }
      .vet-behandling-linje span { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; }
      .vet-tom { padding:10px 12px; color:#cbd5e1; }
      @media (max-width:700px) {
        .vet-dyr-knapp { grid-template-columns:1fr; gap:2px; }
        .vet-behandling-linje { grid-template-columns:1fr; }
        .vet-eier-knapp { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(s);
  }

  function byggPasientTreHtml() {
    const eiere = arrDyreeiere().sort((a,b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));
    if (!eiere.length) {
      return `
        <div class="vet-tom">
          Fant ingen dyreeiere på denne klinikken. Legg inn ny dyreeier, eller sjekk at dyreeiere har riktig klinikk_id.
        </div>`;
    }

    return eiere.map(e => {
      const eierId = String(e.id || "");
      const dyr = dyrForEier(eierId);
      const apen = String(valgtEierId) === eierId;
      const dyrHtml = apen ? `
        <div class="vet-dyr-liste">
          ${dyr.length ? dyr.map(d => byggDyrRad(e, d)).join("") : '<div class="vet-tom">Ingen dyr på denne eieren.</div>'}
        </div>` : "";
      return `
        <div class="vet-eier-rad" data-eier-id="${esc(eierId)}">
          <button type="button" class="vet-eier-knapp" onclick="vetTreVelgEier('${esc(eierId)}')">
            <span>
              <span class="vet-eier-navn">${esc(e.navn || "Uten navn")}</span>
              <span class="vet-eier-info">${esc([e.telefon, e.epost].filter(Boolean).join(" | "))}</span>
            </span>
            <span class="vet-eier-teller">${dyr.length} dyr</span>
          </button>
          ${dyrHtml}
        </div>`;
    }).join("");
  }

  function byggDyrRad(eier, d) {
    const dyrId = String(d.id || "");
    const valgt = String(valgtDyrId) === dyrId;
    const beh = antallJournal(dyrId);
    return `
      <div class="vet-dyr-rad" data-dyr-id="${esc(dyrId)}">
        <button type="button" class="vet-dyr-knapp ${valgt ? "valgt" : ""}" onclick="vetTreVelgDyr('${esc(dyrId)}')">
          <span class="dyrnavn">${esc(d.navn || "Uten navn")}</span>
          <span>${esc(d.art || "")}</span>
          <span>${esc(d.rase || "")}</span>
          <span>${beh} beh.</span>
        </button>
        ${valgt ? byggBehandlingPanel(eier, d) : ""}
      </div>`;
  }

  function byggBehandlingPanel(eier, d) {
    const journaler = journalForDyr(d.id);
    const linjer = journaler.length ? journaler.map(j => {
      const tekst = String(j.notat || j.medisin_kladd || "").replace(/\s+/g, " ").trim();
      const kortTekst = tekst.length > 120 ? tekst.slice(0, 120) + "..." : tekst;
      const sum = Number(j.belop_eks_mva || 0);
      const sumTekst = sum > 0 && typeof formaterKr === "function" ? `${formaterKr(sum)} kr` : "";
      return `
        <div class="vet-behandling-linje">
          <span><strong>${esc(datoNo(j.dato))}</strong></span>
          <span>${esc(j.type || "Behandling")}</span>
          <span>${esc(kortTekst || "Ingen notattekst")}</span>
          <span>${esc(sumTekst)}</span>
        </div>`;
    }).join("") : '<div class="vet-tom">Ingen tidligere behandlinger på dette dyret.</div>';

    return `
      <div class="vet-behandling-panel">
        <div class="vet-behandling-topp">
          <strong>${esc(d.navn || "Dyr")} - tidligere behandlinger</strong>
          <span>
            <button type="button" onclick="vetTreNyBehandling('${esc(d.id)}')">Ny behandling</button>
            <button type="button" class="secondary" onclick="redigerDyr('${esc(d.id)}')">Rediger dyr</button>
          </span>
        </div>
        <div class="lite">Eier: ${esc(eier?.navn || "")} ${d.art ? " | " + esc(d.art) : ""} ${d.rase ? " | " + esc(d.rase) : ""}</div>
        ${linjer}
      </div>`;
  }

  function byggPasientSide() {
    styleOnce();
    const side = qs("eierSide");
    if (!side) return;

    side.innerHTML = `
      <h2>Dyreeiere</h2>
      <h3>Pasientliste</h3>
      <p class="lite">Klikk på en eier for å vise dyrene. Klikk på et dyr for å vise tidligere behandlinger.</p>
      <div class="vet-tre-toolbar">
        <button type="button" class="secondary" onclick="vetTreOppdater()">Oppdater</button>
        <button type="button" class="secondary" onclick="nyDyreeier()">Ny dyreeier</button>
        <button type="button" class="secondary" onclick="nyPasient()">Nytt dyr</button>
      </div>
      <div id="vetPasientTreRoot">${byggPasientTreHtml()}</div>
      <div id="dyreeierMelding" class="melding"></div>
      <input id="dyreeierId" type="hidden">
      <input id="dyreeierVelgForDyr" type="hidden">
      <div id="dyreeierListe" style="display:none"></div>
    `;
    sistTegnet = JSON.stringify({
      e: arrDyreeiere().map(x => [x.id, x.navn, x.telefon, x.epost]),
      d: arrDyr().map(x => [x.id, x.dyreeier_id, x.navn, x.art, x.rase]),
      j: arrJournal().map(x => [x.id, x.dyr_id, x.dato, x.type, x.notat, x.belop_eks_mva]),
      valgtEierId,
      valgtDyrId
    });
  }

  function oppdaterBareHvisEndret() {
    if (!sideErPasienter()) return;
    const now = JSON.stringify({
      e: arrDyreeiere().map(x => [x.id, x.navn, x.telefon, x.epost]),
      d: arrDyr().map(x => [x.id, x.dyreeier_id, x.navn, x.art, x.rase]),
      j: arrJournal().map(x => [x.id, x.dyr_id, x.dato, x.type, x.notat, x.belop_eks_mva]),
      valgtEierId,
      valgtDyrId
    });
    if (now !== sistTegnet) byggPasientSide();
  }

  window.vetTreVelgEier = function (eierId) {
    eierId = String(eierId || "");
    valgtEierId = valgtEierId === eierId ? "" : eierId;
    valgtDyrId = "";
    setv("dyreeierId", valgtEierId);
    setv("dyreeierVelgForDyr", valgtEierId);
    byggPasientSide();
  };

  window.vetTreVelgDyr = function (dyrId) {
    dyrId = String(dyrId || "");
    const d = arrDyr().find(x => String(x.id) === dyrId);
    if (!d) return;
    valgtEierId = String(d.dyreeier_id || "");
    valgtDyrId = valgtDyrId === dyrId ? "" : dyrId;
    setv("dyreeierId", valgtEierId);
    setv("dyreeierVelgForDyr", valgtEierId);
    byggPasientSide();
  };

  window.vetTreNyBehandling = function (dyrId) {
    const d = arrDyr().find(x => String(x.id) === String(dyrId));
    if (!d) return;
    valgtEierId = String(d.dyreeier_id || "");
    valgtDyrId = String(d.id || "");

    if (typeof visVetSide === "function") visVetSide("journalSide");

    setTimeout(() => {
      try { if (typeof fyllJournalDyreeierValg === "function") fyllJournalDyreeierValg(); } catch(e) {}
      setv("journalDyreeierValg", valgtEierId);
      try { if (typeof fyllDyrValg === "function") fyllDyrValg(); } catch(e) {}
      setv("journalDyrValg", valgtDyrId);
      setv("journalDato", new Date().toISOString().split("T")[0]);
      setv("journalNotat", "");
      setv("journalMedisin", "");
      const jl = qs("journalListe");
      if (jl) jl.innerHTML = "";
      const notat = qs("journalNotat");
      if (notat) notat.focus();
    }, 80);
  };

  window.vetTreOppdater = async function () {
    try {
      if (typeof lastDyreeiere === "function") await lastDyreeiere();
      if (typeof lastDyr === "function") await lastDyr();
      if (typeof lastJournal === "function") await lastJournal();
    } catch(e) {
      console.warn("Kunne ikke oppdatere pasienttre", e);
    }
    byggPasientSide();
  };

  const gammelVisVetSide = window.visVetSide || (typeof visVetSide === "function" ? visVetSide : null);
  if (gammelVisVetSide && !window.__vetTreOriginalVisVetSide) {
    window.__vetTreOriginalVisVetSide = gammelVisVetSide;
  }
  window.visVetSide = function (sideId) {
    const original = window.__vetTreOriginalVisVetSide || gammelVisVetSide;
    if (original) original(sideId);
    if (sideId === "eierSide") {
      valgtDyrId = "";
      setTimeout(() => {
        if (!arrDyreeiere().length && typeof lastDyreeiere === "function") lastDyreeiere().then(() => {
          if (typeof lastDyr === "function") return lastDyr();
        }).then(() => {
          if (typeof lastJournal === "function") return lastJournal();
        }).finally(byggPasientSide);
        else byggPasientSide();
      }, 30);
    }
  };

  const gammelTegnDyreeiere = window.tegnDyreeiere || (typeof tegnDyreeiere === "function" ? tegnDyreeiere : null);
  window.tegnDyreeiere = function () {
    if (sideErPasienter()) byggPasientSide();
    else if (gammelTegnDyreeiere) gammelTegnDyreeiere();
  };

  const gammelTegnDyr = window.tegnDyr || (typeof tegnDyr === "function" ? tegnDyr : null);
  window.tegnDyr = function () {
    if (sideErPasienter()) byggPasientSide();
    else if (gammelTegnDyr) gammelTegnDyr();
  };

  const gammelTegnJournal = window.tegnJournal || (typeof tegnJournal === "function" ? tegnJournal : null);
  window.tegnJournal = function () {
    if (sideErPasienter()) {
      oppdaterBareHvisEndret();
      return;
    }
    if (gammelTegnJournal) gammelTegnJournal();
  };

  // Start på Pasienter når alt er lastet.
  window.addEventListener("load", function () {
    setTimeout(() => {
      try { window.visVetSide("eierSide"); } catch(e) { byggPasientSide(); }
    }, 800);
  });
})();


/* ===== PASIENTLISTE FINAL: EIER -> DYR -> BEHANDLING -> JOURNAL 10.06.2026 ===== */
(function () {
  const ROOT_ID = "vetPasientTreRoot";

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function kr(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return "0,00";
    try {
      return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (_) {
      return String(n.toFixed(2)).replace(".", ",");
    }
  }

  function datoKort(v) {
    const s = String(v || "");
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  }

  function eierListe() { return Array.isArray(window.vetDyreeiere) ? window.vetDyreeiere : (typeof vetDyreeiere !== "undefined" ? vetDyreeiere : []); }
  function dyrListe() { return Array.isArray(window.vetDyr) ? window.vetDyr : (typeof vetDyr !== "undefined" ? vetDyr : []); }
  function journalListe() { return Array.isArray(window.vetJournal) ? window.vetJournal : (typeof vetJournal !== "undefined" ? vetJournal : []); }

  function setVal(id, verdi) {
    const el = document.getElementById(id);
    if (el) el.value = verdi ?? "";
  }

  function root() {
    const side = document.getElementById("eierSide");
    if (!side) return null;

    let r = document.getElementById(ROOT_ID);
    if (!r) {
      r = document.createElement("div");
      r.id = ROOT_ID;
      const h2 = side.querySelector("h2");
      if (h2 && h2.parentNode) h2.parentNode.insertBefore(r, h2.nextSibling);
      else side.prepend(r);
    }
    return r;
  }

  function skjulGammelEierUi() {
    // Behold skjulte felt som koden trenger, men skjul gammel select/skjema-visning fra arbeidslista.
    const ids = [
      "dyreeierVelgForDyr", "dyreeierNavn", "dyreeierTelefon", "dyreeierEpost", "dyreeierAdresse",
      "dyreeierDyrValg", "dyreeierDyrInfo", "dyreeierListe", "dyreeierMelding"
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) label.style.display = "none";
      el.style.display = "none";
    });

    const lagre = document.getElementById("lagreDyreeierKnapp");
    if (lagre) lagre.style.display = "none";

    const h3 = Array.from(document.querySelectorAll("#eierSide h3"));
    h3.forEach(x => {
      if (/dyr hos valgt dyreeier/i.test(x.textContent || "")) x.style.display = "none";
    });
    const tekster = Array.from(document.querySelectorAll("#eierSide p.lite"));
    tekster.forEach(x => {
      if (/redigerer en dyreeier|tilhører denne eieren/i.test(x.textContent || "")) x.style.display = "none";
    });
  }

  function css() {
    if (document.getElementById("vetPasientTreCss")) return;
    const s = document.createElement("style");
    s.id = "vetPasientTreCss";
    s.textContent = `
      #${ROOT_ID} { margin-top:10px; }
      .vet-tree-toolbar { display:flex; gap:8px; flex-wrap:wrap; margin:8px 0 12px 0; }
      .vet-tree-box { border:1px solid #374151; border-radius:10px; background:#171a1b; overflow:hidden; }
      .vet-tree-row { width:100%; display:grid; gap:8px; align-items:center; text-align:left; border:0; border-bottom:1px solid #374151; border-radius:0; margin:0; padding:6px 9px; background:#22272a; color:#f3f4f6; cursor:pointer; font-size:14px; line-height:1.15; }
      .vet-tree-row:hover { background:#26313a; outline:1px solid #60a5fa; }
      .vet-tree-owner { grid-template-columns:minmax(180px,1.4fr) minmax(90px,.7fr) minmax(170px,1.2fr) 80px; font-weight:600; }
      .vet-tree-animal { grid-template-columns:24px minmax(160px,1.2fr) minmax(120px,.9fr) minmax(120px,.9fr) 92px; padding-left:20px; background:#1d2225; }
      .vet-tree-journal { grid-template-columns:24px minmax(95px,.7fr) minmax(150px,1.2fr) minmax(180px,1.5fr) 80px; padding-left:38px; background:#191f22; }
      .vet-tree-selected { outline:1px solid #60a5fa; background:#1f2937 !important; }
      .vet-tree-detail { padding:12px 14px; background:#111827; border-bottom:1px solid #374151; }
      .vet-tree-detail h3 { margin:0 0 8px 0; }
      .vet-tree-detail p { margin:7px 0; }
      .vet-tree-detail ul { margin-top:6px; }
      .vet-tree-empty { padding:10px; color:#cbd5e1; }
      .vet-tree-small { font-size:13px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .vet-tree-mini { font-size:13px; color:#93c5fd; }
      .vet-tree-photo { display:inline-block; margin:6px 8px 6px 0; vertical-align:top; max-width:150px; }
      .vet-tree-photo img { width:140px; height:100px; object-fit:cover; border-radius:6px; border:1px solid #374151; }
      @media (max-width:720px){
        .vet-tree-owner { grid-template-columns:minmax(150px,1fr) 70px; }
        .vet-tree-owner .hide-mobile { display:none; }
        .vet-tree-animal { grid-template-columns:20px minmax(130px,1fr) 70px; }
        .vet-tree-animal .hide-mobile { display:none; }
        .vet-tree-journal { grid-template-columns:20px 85px minmax(120px,1fr); }
        .vet-tree-journal .hide-mobile { display:none; }
      }
    `;
    document.head.appendChild(s);
  }

  function dyrForEier(eierId) {
    return dyrListe()
      .filter(d => String(d.dyreeier_id || d.eier_id || "") === String(eierId))
      .sort((a,b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));
  }

  function journalForDyr(dyrId) {
    return journalListe()
      .filter(j => String(j.dyr_id || "") === String(dyrId))
      .sort((a,b) => String(b.dato || "").localeCompare(String(a.dato || "")) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }

  function journalDetaljHtml(j) {
    const sum = Number(j.belop_eks_mva || 0);
    const prislinje = sum > 0
      ? `<p><strong>Pris:</strong> ${kr(sum)} kr eks. mva<br><span class="vet-tree-small">Fastpris: ${kr(j.fastpris)} | Time: ${kr(j.timepris)} x ${esc(j.timer || 0)} | Km: ${esc(j.km || 0)} x ${kr(j.km_pris)}</span></p>`
      : "";

    const varer = (j.vet_journal_varer || []).map(v => {
      const vareSum = Number(v.sum_eks_mva || (Number(v.antall || 0) * Number(v.pris || 0)));
      return `<li>${esc(v.varenavn || "Vare/medisin")} - ${kr(v.antall)} x ${kr(v.pris)} kr = ${kr(vareSum)} kr</li>`;
    }).join("");
    const vareblokk = varer ? `<p><strong>Varer/medisiner:</strong></p><ul>${varer}</ul>` : "";

    const bilder = (j.vet_journal_bilder || []).map(b => `
      <div class="vet-tree-photo">
        <a href="${esc(b.bilde_url || "#")}" target="_blank">
          <img src="${esc(b.bilde_url || "")}" alt="${esc(b.bildetekst || b.filnavn || "Journalbilde")}">
        </a>
        <div class="vet-tree-small">${esc(b.bildetekst || b.filnavn || "")}</div>
      </div>
    `).join("");
    const bildeblokk = bilder ? `<p><strong>Bilder:</strong></p><div>${bilder}</div>` : "";

    return `
      <div class="vet-tree-detail">
        <h3>${esc(datoKort(j.dato))} ${j.type ? "- " + esc(j.type) : "- Journal"}</h3>
        <p><strong>Dyr:</strong> ${esc(j.vet_dyr?.navn || (dyrListe().find(d => String(d.id) === String(j.dyr_id))?.navn) || "")}</p>
        ${j.notat ? `<p><strong>Journalnotat:</strong><br>${esc(j.notat).replaceAll("\n", "<br>")}</p>` : ""}
        ${j.medisin_kladd ? `<p><strong>Medisin/reseptkladd:</strong><br>${esc(j.medisin_kladd).replaceAll("\n", "<br>")}</p>` : ""}
        ${prislinje}
        ${vareblokk}
        ${bildeblokk}
      </div>
    `;
  }

  function render() {
    css();
    skjulGammelEierUi();
    const r = root();
    if (!r) return;

    const eiere = eierListe().slice().sort((a,b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));
    const valgtEier = String(window.vetPasientTreValgtEierId || "");
    const valgtDyr = String(window.vetPasientTreValgtDyrId || "");
    const valgtJournal = String(window.vetPasientTreValgtJournalId || "");

    if (!eiere.length) {
      r.innerHTML = `
        <div class="vet-tree-toolbar">
          <button type="button" onclick="window.vetPasientTreOppdater()" class="secondary">Oppdater</button>
          <button type="button" onclick="window.nyDyreeier && window.nyDyreeier()">Ny dyreeier</button>
        </div>
        <div class="vet-tree-box"><div class="vet-tree-empty">Fant ingen dyreeiere. Klikk Oppdater, eller legg inn ny dyreeier.</div></div>`;
      return;
    }

    let html = `
      <div class="vet-tree-toolbar">
        <button type="button" onclick="window.vetPasientTreOppdater()" class="secondary">Oppdater</button>
        <button type="button" onclick="window.nyDyreeier && window.nyDyreeier()">Ny dyreeier</button>
        <button type="button" onclick="window.nyPasient && window.nyPasient()" class="secondary">Nytt dyr</button>
      </div>
      <div class="vet-tree-box">`;

    eiere.forEach(e => {
      const eierId = String(e.id || "");
      const dyr = dyrForEier(eierId);
      const erValgtEier = valgtEier === eierId;
      html += `
        <button type="button" class="vet-tree-row vet-tree-owner ${erValgtEier ? "vet-tree-selected" : ""}" data-vet-tree-owner="${esc(eierId)}">
          <span>${esc(e.navn || "Uten navn")}</span>
          <span class="hide-mobile vet-tree-small">${esc(e.telefon || "")}</span>
          <span class="hide-mobile vet-tree-small">${esc(e.epost || "")}</span>
          <span class="vet-tree-mini">${dyr.length} dyr</span>
        </button>`;

      if (erValgtEier) {
        if (!dyr.length) {
          html += `<div class="vet-tree-empty">Ingen dyr registrert på denne eieren.</div>`;
        }
        dyr.forEach(d => {
          const dyrId = String(d.id || "");
          const journaler = journalForDyr(dyrId);
          const erValgtDyr = valgtDyr === dyrId;
          html += `
            <button type="button" class="vet-tree-row vet-tree-animal ${erValgtDyr ? "vet-tree-selected" : ""}" data-vet-tree-animal="${esc(dyrId)}" data-vet-tree-owner-for-animal="${esc(eierId)}">
              <span>↳</span>
              <span>${esc(d.navn || "Uten navn")}</span>
              <span class="hide-mobile vet-tree-small">${esc([d.art, d.rase].filter(Boolean).join(" / "))}</span>
              <span class="hide-mobile vet-tree-small">${esc(d.idmerking || "")}</span>
              <span class="vet-tree-mini">${journaler.length} beh.</span>
            </button>`;

          if (erValgtDyr) {
            html += `<div class="vet-tree-toolbar" style="padding-left:38px;margin:6px 0;">
              <button type="button" data-vet-tree-new-journal="${esc(dyrId)}" data-vet-tree-new-journal-owner="${esc(eierId)}">Ny behandling</button>
            </div>`;
            if (!journaler.length) {
              html += `<div class="vet-tree-empty" style="padding-left:38px;">Ingen behandlinger på dette dyret ennå.</div>`;
            }
            journaler.forEach(j => {
              const jid = String(j.id || "");
              const erValgtJournal = valgtJournal === jid;
              const kortNotat = String(j.notat || "").replace(/\s+/g, " ").slice(0, 80);
              html += `
                <button type="button" class="vet-tree-row vet-tree-journal ${erValgtJournal ? "vet-tree-selected" : ""}" data-vet-tree-journal="${esc(jid)}" data-vet-tree-journal-dyr="${esc(dyrId)}" data-vet-tree-journal-owner="${esc(eierId)}">
                  <span>•</span>
                  <span>${esc(datoKort(j.dato))}</span>
                  <span>${esc(j.type || "Journal")}</span>
                  <span class="hide-mobile vet-tree-small">${esc(kortNotat)}</span>
                  <span class="vet-tree-mini">Åpne</span>
                </button>`;
              if (erValgtJournal) html += journalDetaljHtml(j);
            });
          }
        });
      }
    });

    html += `</div>`;
    r.innerHTML = html;
  }

  async function sikreJournalLastet() {
    if (journalListe().length) return;
    if (typeof window.lastJournal === "function") {
      try { await window.lastJournal(); } catch (e) { console.warn("Kunne ikke laste journal", e); }
    } else if (typeof lastJournal === "function") {
      try { await lastJournal(); } catch (e) { console.warn("Kunne ikke laste journal", e); }
    }
  }

  window.vetPasientTreOppdater = async function () {
    try { if (typeof window.lastDyreeiere === "function") await window.lastDyreeiere(); else if (typeof lastDyreeiere === "function") await lastDyreeiere(); } catch(e) { console.warn(e); }
    try { if (typeof window.lastDyr === "function") await window.lastDyr(); else if (typeof lastDyr === "function") await lastDyr(); } catch(e) { console.warn(e); }
    await sikreJournalLastet();
    render();
  };

  window.vetPasientTreAapneEier = async function (eierId) {
    window.vetPasientTreValgtEierId = String(eierId || "");
    window.vetPasientTreValgtDyrId = "";
    window.vetPasientTreValgtJournalId = "";
    setVal("dyreeierId", eierId || "");
    setVal("dyreeierVelgForDyr", eierId || "");
    const e = eierListe().find(x => String(x.id) === String(eierId));
    if (e) {
      setVal("dyreeierNavn", e.navn || "");
      setVal("dyreeierTelefon", e.telefon || "");
      setVal("dyreeierEpost", e.epost || "");
      setVal("dyreeierAdresse", e.adresse || "");
    }
    render();
  };

  window.vetPasientTreAapneDyr = async function (dyrId, eierId) {
    window.vetPasientTreValgtEierId = String(eierId || window.vetPasientTreValgtEierId || "");
    window.vetPasientTreValgtDyrId = String(dyrId || "");
    window.vetPasientTreValgtJournalId = "";
    setVal("dyreeierId", window.vetPasientTreValgtEierId);
    setVal("dyreeierVelgForDyr", window.vetPasientTreValgtEierId);
    setVal("dyreeierDyrValg", dyrId || "");
    await sikreJournalLastet();
    render();
  };

  window.vetPasientTreAapneJournal = async function (journalId, dyrId, eierId) {
    window.vetPasientTreValgtEierId = String(eierId || window.vetPasientTreValgtEierId || "");
    window.vetPasientTreValgtDyrId = String(dyrId || window.vetPasientTreValgtDyrId || "");
    window.vetPasientTreValgtJournalId = String(journalId || "");
    await sikreJournalLastet();
    render();
  };

  window.vetPasientTreNyBehandling = function (dyrId, eierId) {
    const d = dyrListe().find(x => String(x.id) === String(dyrId));
    const ownerId = eierId || d?.dyreeier_id || "";
    if (typeof window.visVetSide === "function") window.visVetSide("journalSide");
    else if (typeof visVetSide === "function") visVetSide("journalSide");

    setTimeout(() => {
      if (typeof window.fyllJournalDyreeierValg === "function") window.fyllJournalDyreeierValg();
      else if (typeof fyllJournalDyreeierValg === "function") fyllJournalDyreeierValg();
      setVal("journalDyreeierValg", ownerId);
      if (typeof window.fyllDyrValg === "function") window.fyllDyrValg();
      else if (typeof fyllDyrValg === "function") fyllDyrValg();
      setVal("journalDyrValg", dyrId);
      const dato = document.getElementById("journalDato");
      if (dato && !dato.value) dato.value = new Date().toISOString().slice(0,10);
      const notat = document.getElementById("journalNotat");
      if (notat) notat.focus();
    }, 80);
  };

  // Disse navnene brukes av gammel kode. Nå peker de til trevisningen, ikke dyrkortet.
  window.redigerDyreeier = function (id) { window.vetPasientTreAapneEier(id); return false; };
  window.fyllDyreeierDyrValg = function (dyreeierId = "", valgtDyrId = "") {
    window.vetPasientTreValgtEierId = String(dyreeierId || window.vetPasientTreValgtEierId || "");
    if (valgtDyrId) window.vetPasientTreValgtDyrId = String(valgtDyrId);
    render();
  };
  window.tegnDyreeiere = render;

  // Stopper gamle stack-safe funksjoner fra å sende bruker til Dyr-siden når dyret klikkes i pasientlista.
  window.vetStackSafeOpenEier = function(id){ window.vetPasientTreAapneEier(id); return false; };
  window.vetStackSafeOpenDyr = function(id){
    const d = dyrListe().find(x => String(x.id) === String(id));
    window.vetPasientTreAapneDyr(id, d?.dyreeier_id || window.vetPasientTreValgtEierId || "");
    return false;
  };

  document.addEventListener("click", function (e) {
    const owner = e.target.closest("[data-vet-tree-owner]");
    if (owner) {
      e.preventDefault(); e.stopPropagation();
      window.vetPasientTreAapneEier(owner.dataset.vetTreeOwner);
      return;
    }
    const animal = e.target.closest("[data-vet-tree-animal]");
    if (animal) {
      e.preventDefault(); e.stopPropagation();
      window.vetPasientTreAapneDyr(animal.dataset.vetTreeAnimal, animal.dataset.vetTreeOwnerForAnimal);
      return;
    }
    const journal = e.target.closest("[data-vet-tree-journal]");
    if (journal) {
      e.preventDefault(); e.stopPropagation();
      window.vetPasientTreAapneJournal(journal.dataset.vetTreeJournal, journal.dataset.vetTreeJournalDyr, journal.dataset.vetTreeJournalOwner);
      return;
    }
    const ny = e.target.closest("[data-vet-tree-new-journal]");
    if (ny) {
      e.preventDefault(); e.stopPropagation();
      window.vetPasientTreNyBehandling(ny.dataset.vetTreeNewJournal, ny.dataset.vetTreeNewJournalOwner);
      return;
    }
  }, true);

  const gammelVisVetSide = typeof window.visVetSide === "function" ? window.visVetSide : (typeof visVetSide === "function" ? visVetSide : null);
  if (gammelVisVetSide && !gammelVisVetSide.__vetPasientTreWrapped) {
    const wrapped = function (sideId) {
      const res = gammelVisVetSide.apply(this, arguments);
      if (sideId === "eierSide") setTimeout(() => { css(); skjulGammelEierUi(); render(); }, 50);
      return res;
    };
    wrapped.__vetPasientTreWrapped = true;
    window.visVetSide = wrapped;
    try { visVetSide = wrapped; } catch (_) {}
  }

  function start() {
    css();
    skjulGammelEierUi();
    sikreJournalLastet().then(render);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 350), { once:true });
  } else {
    setTimeout(start, 350);
  }
})();
/* ===== SLUTT PASIENTLISTE FINAL ===== */

/* ===== HARD FIX 10.06: PASIENTER ER STARTSIDE, JOURNAL ÅPNES KUN FRA NY BEHANDLING ===== */
(function(){
  function erSynlig(el){ return el && !el.classList.contains('skjult') && el.style.display !== 'none'; }
  function finnSide(id){ return document.getElementById(id); }
  function visPasienter(){
    if (Date.now() < (window.__vetTillatJournalSideTil || 0)) return;
    try {
      if (typeof window.visVetSide === 'function') window.visVetSide('eierSide');
      else if (typeof visVetSide === 'function') visVetSide('eierSide');
    } catch(e) { console.warn('Kunne ikke vise pasientside', e); }
    setTimeout(function(){
      try { if (typeof window.vetPasientTreOppdater === 'function') window.vetPasientTreOppdater(); }
      catch(e) { console.warn(e); }
    }, 80);
  }

  // Ny behandling skal få lov til å åpne journal-skjemaet.
  const gammelNyBeh = window.vetPasientTreNyBehandling;
  window.vetPasientTreNyBehandling = function(dyrId, eierId){
    window.__vetTillatJournalSideTil = Date.now() + 20000;
    if (typeof gammelNyBeh === 'function') return gammelNyBeh(dyrId, eierId);
    if (typeof window.visVetSide === 'function') window.visVetSide('journalSide');
  };

  // Journal-knappen i toppmenyen skal ikke kaste bruker til gammel journaloversikt.
  function kobleJournalKnappTilPasienter(){
    document.querySelectorAll('button').forEach(function(btn){
      const tekst = String(btn.textContent || '').trim().toLowerCase();
      const on = String(btn.getAttribute('onclick') || '');
      if (tekst === 'journal' || on.includes("journalSide")) {
        if (btn.dataset.vetPasientStartJournalKoblet === '1') return;
        btn.dataset.vetPasientStartJournalKoblet = '1';
        btn.textContent = 'Pasientjournal';
        btn.onclick = function(e){
          if (e) { e.preventDefault(); e.stopPropagation(); }
          visPasienter();
          return false;
        };
      }
    });
  }

  // Pasienter-knappen skal alltid åpne trelisten.
  function koblePasientKnapp(){
    document.querySelectorAll('button').forEach(function(btn){
      const tekst = String(btn.textContent || '').trim().toLowerCase();
      const on = String(btn.getAttribute('onclick') || '');
      if (tekst === 'pasienter' || on.includes("eierSide")) {
        if (btn.dataset.vetPasientStartKoblet === '1') return;
        btn.dataset.vetPasientStartKoblet = '1';
        btn.onclick = function(e){
          if (e) { e.preventDefault(); e.stopPropagation(); }
          visPasienter();
          return false;
        };
      }
    });
  }

  function ryddGammelJournalHvisDenStaarOppe(){
    const journalSide = finnSide('journalSide');
    if (erSynlig(journalSide) && Date.now() >= (window.__vetTillatJournalSideTil || 0)) {
      visPasienter();
    }
  }

  function start(){
    kobleJournalKnappTilPasienter();
    koblePasientKnapp();
    // Start alltid på pasientlisten etter innlasting.
    setTimeout(visPasienter, 250);
    setTimeout(visPasienter, 900);
    setTimeout(visPasienter, 1800);
    setInterval(function(){
      kobleJournalKnappTilPasienter();
      koblePasientKnapp();
      ryddGammelJournalHvisDenStaarOppe();
    }, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
/* ===== SLUTT HARD FIX PASIENTSTART ===== */

/* ===== MENYREPARASJON 10.06: TOPPKNAPPER TILBAKE ===== */
(function(){
  function qs(id){ return document.getElementById(id); }

  function safeVis(sideId){
    // Ikke la den forrige hardfixen dra brukeren tilbake mens man trykker meny.
    window.__vetTillatJournalSideTil = Date.now() + 60 * 60 * 1000;
    try {
      if (typeof window.visVetSide === 'function') window.visVetSide(sideId);
      else if (typeof visVetSide === 'function') visVetSide(sideId);
    } catch(e) {
      console.error('Kunne ikke vise side ' + sideId, e);
      alert('Kunne ikke åpne siden: ' + (e && e.message ? e.message : e));
    }

    setTimeout(function(){
      try {
        if (sideId === 'eierSide' && typeof window.vetPasientTreOppdater === 'function') window.vetPasientTreOppdater();
        if (sideId === 'lagerSide' && typeof window.lastVetLagerAlt === 'function') window.lastVetLagerAlt();
        if (sideId === 'okonomiSide' && typeof window.tegnAdminOkonomiOversikt === 'function') window.tegnAdminOkonomiOversikt();
        if (sideId === 'fakturaSide' && typeof window.fyllFakturaDyreeierValg === 'function') window.fyllFakturaDyreeierValg();
      } catch(e) { console.warn(e); }
    }, 80);
  }

  function toggleOppsett(){
    const meny = qs('vetOppsettMeny');
    if (!meny) return false;
    const skjult = meny.classList.contains('skjult') || meny.style.display === 'none';
    meny.classList.toggle('skjult', !skjult);
    meny.style.display = skjult ? '' : 'none';
    return false;
  }

  function bindButton(btn, fn){
    if (!btn) return;
    btn.onclick = function(e){
      if (e) { e.preventDefault(); e.stopPropagation(); }
      fn();
      return false;
    };
    btn.dataset.vetMenyReparert = '1';
  }

  function bindByText(text, fn){
    const wanted = String(text || '').trim().toLowerCase();
    Array.from(document.querySelectorAll('button')).forEach(function(btn){
      const t = String(btn.textContent || '').trim().toLowerCase();
      if (t === wanted) bindButton(btn, fn);
    });
  }

  function reparerMeny(){
    // Kjente toppknapper i index.html
    bindButton(qs('vetOppsettKnapp'), toggleOppsett);

    bindByText('Pasienter', function(){ safeVis('eierSide'); });
    bindByText('Pasientjournal', function(){ safeVis('eierSide'); });
    bindByText('Journal', function(){ safeVis('journalSide'); });
    bindByText('Bil og lager', function(){ safeVis('lagerSide'); });
    bindByText('Fyll bil', function(){
      window.__vetTillatJournalSideTil = Date.now() + 60 * 60 * 1000;
      if (typeof window.visFyllBilSide === 'function') window.visFyllBilSide();
      else safeVis('lagerSide');
    });
    bindByText('Lagerlogg', function(){ safeVis('lagerLoggSide'); });
    bindByText('Oversikt', function(){ safeVis('okonomiSide'); });
    bindByText('Faktura', function(){ safeVis('fakturaSide'); });
    bindByText('Backup / Import', function(){ safeVis('backupSide'); });

    // Undermenyknapper i Oppsett
    bindByText('Klinikk og brukere', function(){ safeVis('klinikkSide'); });
    bindByText('Hovedlager og biler', function(){ safeVis('lagerSide'); });
    bindByText('Prisliste', function(){ safeVis('prisSide'); });

    // Ikke rør Logg ut-knappen.
  }

  // Eksponer for test i konsoll hvis nødvendig.
  window.vetReparerToppmeny = reparerMeny;

  function start(){
    reparerMeny();
    setTimeout(reparerMeny, 300);
    setTimeout(reparerMeny, 1000);
    setTimeout(reparerMeny, 2500);
    // Kjør etter den gamle hardfixens intervall, så denne vinner.
    if (!window.__vetMenyReparasjonsInterval) {
      window.__vetMenyReparasjonsInterval = setInterval(reparerMeny, 1500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
/* ===== SLUTT MENYREPARASJON ===== */
