console.log("beh-oppsett.js lastet - firma kan vises og redigeres");

let behFirmaTabell = null;
let behFirmaRad = null;

function behOppsettMelding(tekst, feil = false) {
  const el = document.getElementById("firmaMelding");
  if (el) {
    el.textContent = tekst || "";
    el.style.color = feil ? "#fca5a5" : "#86efac";
  }
}

function behOppsettVerdi(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function behSettOppsettVerdi(id, verdi) {
  const el = document.getElementById(id);
  if (el) el.value = verdi || "";
}

function behOppsettLogoPreview(url) {
  const img = document.getElementById("firmaLogoForhandsvisning");
  if (!img) return;
  if (url) {
    img.src = url;
    img.style.display = "block";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
  }
}

function behFirmaFraSkjema() {
  return {
    navn: behOppsettVerdi("firmaNavn"),
    firmanavn: behOppsettVerdi("firmaNavn"),
    adresse: behOppsettVerdi("firmaAdresse"),
    telefon: behOppsettVerdi("firmaTelefon"),
    epost: behOppsettVerdi("firmaEpost"),
    orgnr: behOppsettVerdi("firmaOrgnr"),
    org_nr: behOppsettVerdi("firmaOrgnr"),
    mva_nr: behOppsettVerdi("firmaMvaNr"),
    kontonr: behOppsettVerdi("firmaKontonr"),
    kontonummer: behOppsettVerdi("firmaKontonr"),
    vipps_nummer: behOppsettVerdi("firmaVippsNummer"),
    vipps_mottaker: behOppsettVerdi("firmaVippsMottaker"),
    logo_url: behOppsettVerdi("firmaLogoUrl"),
    brevhode_tekst: behOppsettVerdi("firmaBrevhodeTekst"),
    brevfot_tekst: behOppsettVerdi("firmaBrevfotTekst")
  };
}

function behFirmaTilSkjema(firma) {
  firma = firma || {};
  behFirmaRad = firma;
  behSettOppsettVerdi("firmaId", firma.id || "");
  behSettOppsettVerdi("firmaNavn", firma.navn || firma.firmanavn || firma.firma_navn || "");
  behSettOppsettVerdi("firmaAdresse", firma.adresse || "");
  behSettOppsettVerdi("firmaTelefon", firma.telefon || "");
  behSettOppsettVerdi("firmaEpost", firma.epost || firma.email || "");
  behSettOppsettVerdi("firmaOrgnr", firma.orgnr || firma.org_nr || firma.organisasjonsnummer || "");
  behSettOppsettVerdi("firmaMvaNr", firma.mva_nr || firma.mvanr || "");
  behSettOppsettVerdi("firmaKontonr", firma.kontonr || firma.kontonummer || "");
  behSettOppsettVerdi("firmaVippsNummer", firma.vipps_nummer || firma.vippsnummer || firma.vipps_nr || firma.vipps || "");
  behSettOppsettVerdi("firmaVippsMottaker", firma.vipps_mottaker || firma.vipps_navn || firma.vippsNavn || "");
  behSettOppsettVerdi("firmaLogoUrl", firma.logo_url || firma.logo || "");
  behSettOppsettVerdi("firmaBrevhodeTekst", firma.brevhode_tekst || firma.brevhode || "");
  behSettOppsettVerdi("firmaBrevfotTekst", firma.brevfot_tekst || firma.brevfot || "");
  behOppsettLogoPreview(firma.logo_url || firma.logo || "");
}

function behFiltrerPayloadMotRad(payload, rad) {
  if (!rad || !Object.keys(rad).length) return payload;
  const tillatte = new Set(Object.keys(rad));
  const ut = {};
  for (const [k, v] of Object.entries(payload)) {
    if (tillatte.has(k)) ut[k] = v;
  }
  return ut;
}

function behFjernManglendeKolonne(payload, error) {
  const msg = String(error?.message || "");
  const treff = msg.match(/'([^']+)' column/) || msg.match(/column "([^"]+)"/i);
  if (treff && treff[1] && Object.prototype.hasOwnProperty.call(payload, treff[1])) {
    delete payload[treff[1]];
    return true;
  }
  return false;
}

async function behVelgFirmaTabell() {
  if (!window.supabaseClient) throw new Error("Mangler Supabase-klient.");
  if (behFirmaTabell) return behFirmaTabell;

  for (const tabell of ["beh_firma", "beh_firma"]) {
    try {
      const { data, error } = await supabaseClient.from(tabell).select("*").limit(1).maybeSingle();
      if (!error) {
        behFirmaTabell = tabell;
        behFirmaRad = data || null;
        return tabell;
      }
    } catch (e) {
      console.warn("Firma-tabell ikke klar:", tabell, e);
    }
  }

  throw new Error("Fant ikke tabellen beh_firma eller firma.");
}

async function hentFirmaData() {
  const tabell = await behVelgFirmaTabell();
  const { data, error } = await supabaseClient.from(tabell).select("*").limit(1).maybeSingle();
  if (error) throw error;
  behFirmaTabell = tabell;
  behFirmaRad = data || null;
  return data || {};
}

async function lastBehOppsett() {
  try {
    behOppsettMelding("Henter firmaoppsett...");
    const firma = await hentFirmaData();
    behFirmaTilSkjema(firma);
    behOppsettMelding(Object.keys(firma).length ? "Firmaoppsett hentet." : "Ingen firmaoppsett lagret ennå. Fyll ut og lagre.");
    return true;
  } catch (e) {
    console.error("Kunne ikke hente firmaoppsett:", e);
    behOppsettMelding("Kunne ikke hente firmaoppsett: " + (e.message || e), true);
    return false;
  }
}

async function lastOppBehLogoHvisValgt() {
  const fil = document.getElementById("firmaLogoFil")?.files?.[0];
  if (!fil || !window.supabaseClient) return "";

  const rentNavn = String(fil.name || "logo.png")
    .replaceAll(" ", "_")
    .replace(/[æøåÆØÅ]/g, b => ({ æ: "ae", ø: "o", å: "a", Æ: "Ae", Ø: "O", Å: "A" }[b] || b))
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const filsti = `beh-logo/${Date.now()}_${rentNavn}`;
  const buckets = ["bilder", "behandler-bilder", "hestebilder", "logoer"];

  let sisteFeil = "";
  for (const bucket of buckets) {
    try {
      const { error: uploadError } = await supabaseClient.storage
        .from(bucket)
        .upload(filsti, fil, {
          upsert: true,
          contentType: fil.type || "image/jpeg"
        });

      if (uploadError) {
        sisteFeil = `${bucket}: ${uploadError.message}`;
        continue;
      }

      const { data } = supabaseClient.storage.from(bucket).getPublicUrl(filsti);
      return data?.publicUrl || "";
    } catch (e) {
      sisteFeil = `${bucket}: ${e.message || e}`;
    }
  }

  throw new Error("Logo ble ikke lastet opp. Sjekk at storage bucket 'bilder' finnes og har policy for authenticated upload. Siste feil: " + sisteFeil);
}

async function lagreBehOppsett() {
  try {
    behOppsettMelding("Lagrer firmaoppsett...");
    const tabell = await behVelgFirmaTabell();

    const logoUrl = await lastOppBehLogoHvisValgt();
    if (logoUrl) behSettOppsettVerdi("firmaLogoUrl", logoUrl);

    let payload = behFirmaFraSkjema();
    payload = behFiltrerPayloadMotRad(payload, behFirmaRad);

    let res;
    const id = behOppsettVerdi("firmaId") || behFirmaRad?.id || "";

    for (let forsok = 0; forsok < 8; forsok++) {
      if (id) {
        res = await supabaseClient.from(tabell).update(payload).eq("id", id).select("*").maybeSingle();
      } else if (behFirmaRad?.id) {
        res = await supabaseClient.from(tabell).update(payload).eq("id", behFirmaRad.id).select("*").maybeSingle();
      } else {
        res = await supabaseClient.from(tabell).insert([payload]).select("*").maybeSingle();
      }

      if (!res.error) break;
      if (!behFjernManglendeKolonne(payload, res.error)) throw res.error;
    }

    if (res.error) throw res.error;

    behFirmaRad = res.data || { ...(behFirmaRad || {}), ...payload };
    behFirmaTilSkjema(behFirmaRad);
    behOppsettMelding("Firmaoppsett lagret.");
    return true;
  } catch (e) {
    console.error("Kunne ikke lagre firmaoppsett:", e);
    behOppsettMelding("Kunne ikke lagre firmaoppsett: " + (e.message || e), true);
    return false;
  }
}

function kobleBehOppsett() {
  const knapp = document.getElementById("lagreBehOppsettKnapp");
  if (knapp && knapp.dataset.koblet !== "1") {
    knapp.dataset.koblet = "1";
    knapp.addEventListener("click", lagreBehOppsett);
  }

  const logoFelt = document.getElementById("firmaLogoUrl");
  if (logoFelt && logoFelt.dataset.koblet !== "1") {
    logoFelt.dataset.koblet = "1";
    logoFelt.addEventListener("input", () => behOppsettLogoPreview(logoFelt.value));
  }

  setTimeout(lastBehOppsett, 200);
}

async function sjekkBehOppsett() {
  if (typeof kobleBehOppsett === "function") kobleBehOppsett();
  await lastBehOppsett();
  return true;
}

function pdfFirmaNavn(firma) {
  return firma?.navn || firma?.firmanavn || firma?.firma_navn || "";
}

async function tegnBrevhodePdf(doc, firma) {
  firma = firma || await hentFirmaData();
  let y = 16;
  doc.setFontSize(14);
  const navn = pdfFirmaNavn(firma);
  if (navn) doc.text(String(navn), 20, y);
  y += 6;
  doc.setFontSize(9);
  const linjer = [firma.adresse, firma.telefon, firma.epost || firma.email, firma.orgnr || firma.org_nr, firma.brevhode_tekst].filter(Boolean);
  for (const l of linjer) {
    doc.text(String(l), 20, y);
    y += 5;
  }
}

function tegnBrevfotAlleSiderPdf(doc, firma) {
  firma = firma || {};
  const tekst = firma.brevfot_tekst || firma.brevfot || "";
  const sider = doc.getNumberOfPages ? doc.getNumberOfPages() : 1;
  for (let i = 1; i <= sider; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    if (tekst) doc.text(String(tekst).slice(0, 110), 20, 286);
    doc.text("Side " + i + " av " + sider, 170, 286);
  }
}

window.kobleBehOppsett = kobleBehOppsett;
window.sjekkBehOppsett = sjekkBehOppsett;
window.hentFirmaData = hentFirmaData;
window.lastBehOppsett = lastBehOppsett;
window.lagreBehOppsett = lagreBehOppsett;
window.tegnBrevhodePdf = window.tegnBrevhodePdf || tegnBrevhodePdf;
window.tegnBrevfotAlleSiderPdf = window.tegnBrevfotAlleSiderPdf || tegnBrevfotAlleSiderPdf;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", kobleBehOppsett);
} else {
  kobleBehOppsett();
}


/* ROBUST FIX 2026-06-14: lagre oppsett-knapp
   Knytter både ny og gammel knapp-ID til samme lagrefunksjon. */
(function(){
  function bindLagreOppsettHard(){
    var ids = ["lagreBehOppsettKnapp", "lagreHovOppsettKnapp"];
    ids.forEach(function(id){
      var knapp = document.getElementById(id);
      if (!knapp || knapp.dataset.behOppsettHard === "1") return;
      knapp.dataset.behOppsettHard = "1";
      knapp.addEventListener("click", function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        try { ev.stopImmediatePropagation(); } catch(e) {}
        if (typeof window.lagreBehOppsett === "function") return window.lagreBehOppsett();
        if (typeof lagreBehOppsett === "function") return lagreBehOppsett();
        alert("Programfeil: lagreBehOppsett er ikke lastet.");
        return false;
      }, true);
    });
  }
  window.kobleHovOppsett = window.kobleBehOppsett || kobleBehOppsett;
  window.sjekkHovOppsett = window.sjekkBehOppsett || sjekkBehOppsett;
  window.lagreHovOppsett = window.lagreBehOppsett || lagreBehOppsett;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindLagreOppsettHard);
  else bindLagreOppsettHard();
  window.addEventListener("load", function(){ setTimeout(bindLagreOppsettHard,100); setTimeout(bindLagreOppsettHard,800); });
  try { new MutationObserver(bindLagreOppsettHard).observe(document.documentElement,{childList:true,subtree:true}); } catch(e) {}
})();


/* EKSTRA HARD-FIX 2026-06-14: oppsett og logo
   Denne ligger helt sist for å sikre at knappen virker selv om annen kode feiler tidligere. */
(function(){
  function visOppsettStatus(tekst, feil) {
    const el = document.getElementById("firmaMelding");
    if (el) {
      el.textContent = tekst || "";
      el.style.color = feil ? "#fca5a5" : "#86efac";
    }
  }

  function bindOppsettOgLogoSist() {
    ["lagreBehOppsettKnapp", "lagreHovOppsettKnapp"].forEach(function(id){
      const knapp = document.getElementById(id);
      if (!knapp || knapp.dataset.behSisteFix === "1") return;
      knapp.dataset.behSisteFix = "1";
      knapp.onclick = async function(ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        visOppsettStatus("Lagrer oppsett ...", false);
        if (typeof window.lagreBehOppsett !== "function") {
          visOppsettStatus("Programfeil: beh-oppsett.js er ikke lastet riktig.", true);
          return false;
        }
        await window.lagreBehOppsett();
        return false;
      };
    });

    const fil = document.getElementById("firmaLogoFil");
    if (fil && fil.dataset.behLogoPreview !== "1") {
      fil.dataset.behLogoPreview = "1";
      fil.addEventListener("change", function(){
        const valgt = fil.files && fil.files[0];
        if (!valgt) return;
        visOppsettStatus("Logo valgt: " + valgt.name + ". Trykk Lagre oppsett for å laste opp.", false);
        const img = document.getElementById("firmaLogoForhandsvisning");
        if (img) {
          img.src = URL.createObjectURL(valgt);
          img.style.display = "block";
        }
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindOppsettOgLogoSist);
  else bindOppsettOgLogoSist();

  window.addEventListener("load", function(){
    setTimeout(bindOppsettOgLogoSist, 100);
    setTimeout(bindOppsettOgLogoSist, 800);
    setTimeout(bindOppsettOgLogoSist, 2000);
  });
})();
