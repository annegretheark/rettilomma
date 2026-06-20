// hand-firma.js - håndverker
// Fikset: bruker aktivt firma-id, retter Org.nr/MVA-feltnavn og eksponerer firma-id til timer/faktura.

async function hentAktivFirmaRad() {
  if (!window.supabaseClient) return window.firmaData || {};

  /*
    Viktig:
    Denne versjonen bruker fortsatt første firma hvis du bare har ett firma i databasen.
    Når du senere har flere firma/kunder i samme Supabase, bør firma_id hentes fra innlogget ansatt/tenant.
  */
  const { data, error } = await supabaseClient
    .from("hand_firma")
    .select("*")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Feil ved henting av firma:", error);
    return window.firmaData || {};
  }

  const firma = data || {};
  window.firmaData = firma;
  window.firma = firma;
  window.aktivFirmaId = firma.id || null;

  return firma;
}

async function hentFirmaData() {
  return await hentAktivFirmaRad();
}

function settFirmaFeltHvisFinnes(id, verdi) {
  const el = document.getElementById(id);
  if (el) el.value = verdi || "";
}

function hentFirmaFeltVerdi(...ider) {
  for (const id of ider) {
    const element = document.getElementById(id);
    if (!element) continue;

    const verdi = String(element.value || "").trim();
    if (verdi !== "") return verdi;
  }

  return "";
}

function leggTilHvisUtfylt(objekt, feltnavn, ...elementIder) {
  const verdi = hentFirmaFeltVerdi(...elementIder);
  if (verdi !== "") objekt[feltnavn] = verdi;
}

async function lastFirma() {
  const firma = await hentAktivFirmaRad();

  settFirmaFeltHvisFinnes("firmaNavn", firma.navn);
  settFirmaFeltHvisFinnes("firmaAdresse", firma.adresse);

  // Støtter begge varianter av id-navn i HTML.
  settFirmaFeltHvisFinnes("firmaOrgnr", firma.orgnr || firma.org_nr);
  settFirmaFeltHvisFinnes("firmaOrgNr", firma.orgnr || firma.org_nr);

  settFirmaFeltHvisFinnes("firmaMvanr", firma.mva_nr || firma.mvanr);
  settFirmaFeltHvisFinnes("firmaMvaNr", firma.mva_nr || firma.mvanr);

  settFirmaFeltHvisFinnes("firmaTelefon", firma.telefon);
  settFirmaFeltHvisFinnes("firmaEpost", firma.epost || firma.email);

  settFirmaFeltHvisFinnes("firmaKontonr", firma.kontonr || firma.konto_nr);
  settFirmaFeltHvisFinnes("firmaKontoNr", firma.kontonr || firma.konto_nr);

  settFirmaFeltHvisFinnes("firmaVippsNummer", firma.vipps_nummer);
  settFirmaFeltHvisFinnes("firmaVippsMottaker", firma.vipps_mottaker);
  settFirmaFeltHvisFinnes("firmaBrevhode", firma.brevhode_tekst);
  settFirmaFeltHvisFinnes("firmaBrevfot", firma.brevfot_tekst);
  settFirmaFeltHvisFinnes("firmaKontaktperson", firma.kontaktperson);
  settFirmaFeltHvisFinnes("firmaAndreOpplysninger", firma.andre_opplysninger);

  const preview = document.getElementById("firmaLogoPreview");
  if (preview) {
    const logoSrc = firma.logo_url || firma.logo || "";
    if (logoSrc) {
      preview.src = logoSrc;
      preview.classList.remove("hidden", "skjult");
    } else {
      preview.removeAttribute("src");
      preview.classList.add("hidden");
    }
  }

  visFirma(firma);
  return firma;
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
    .from("hand_firma")
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

  // Tomme felt overskriver ikke eksisterende opplysninger.
  leggTilHvisUtfylt(firma, "navn", "firmaNavn");
  leggTilHvisUtfylt(firma, "adresse", "firmaAdresse");
  leggTilHvisUtfylt(firma, "orgnr", "firmaOrgnr", "firmaOrgNr");
  leggTilHvisUtfylt(firma, "mva_nr", "firmaMvanr", "firmaMvaNr");
  leggTilHvisUtfylt(firma, "telefon", "firmaTelefon");
  leggTilHvisUtfylt(firma, "epost", "firmaEpost");
  leggTilHvisUtfylt(firma, "kontonr", "firmaKontonr", "firmaKontoNr");
  leggTilHvisUtfylt(firma, "vipps_nummer", "firmaVippsNummer");
  leggTilHvisUtfylt(firma, "vipps_mottaker", "firmaVippsMottaker");
  leggTilHvisUtfylt(firma, "brevhode_tekst", "firmaBrevhode");
  leggTilHvisUtfylt(firma, "brevfot_tekst", "firmaBrevfot");
  leggTilHvisUtfylt(firma, "kontaktperson", "firmaKontaktperson");
  leggTilHvisUtfylt(firma, "andre_opplysninger", "firmaAndreOpplysninger");

  try {
    const logoUrl = await lastOppFirmaLogoHvisValgt();
    if (logoUrl) {
      firma.logo_url = logoUrl;
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
      .from("hand_firma")
      .update(firma)
      .eq("id", eksisterende.id)
      .select()
      .single();
  } else {
    result = await supabaseClient
      .from("hand_firma")
      .insert([firma])
      .select()
      .single();
  }

  if (result.error) {
    console.error("Feil ved lagring av firma:", result.error);
    if (melding) melding.textContent = "Feil ved lagring av firma: " + result.error.message;
    else alert("Feil ved lagring av firma: " + result.error.message);
    return;
  }

  window.firmaLogoFil = null;
  window.firmaData = result.data || {};
  window.firma = window.firmaData;
  window.aktivFirmaId = window.firmaData.id || null;

  if (typeof window.nullstillPdfLogoCache === "function") {
    window.nullstillPdfLogoCache();
  }

  if (melding) melding.textContent = "Firma lagret i databasen";
  else alert("Firma lagret i databasen");

  await lastFirma();
}

function lastInnLogo(event) {
  const fil = event?.target?.files?.[0];
  if (!fil) return;

  window.firmaLogoFil = fil;

  const preview = document.getElementById("firmaLogoPreview");
  if (preview) {
    preview.src = URL.createObjectURL(fil);
    preview.classList.remove("hidden", "skjult");
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
    Vippsnummer: ${firma.vipps_nummer || ""}<br>
    Vipps mottaker: ${firma.vipps_mottaker || ""}<br>
    Kontaktperson: ${firma.kontaktperson || ""}<br>
    Firma-id: ${firma.id || ""}<br>
    Logo: ${firma.logo_url ? "Lagret i Storage" : (firma.logo ? "Lagret i database" : "Ikke valgt")}<br>
    ${firma.andre_opplysninger || ""}
  `;
}

function hentAktivFirmaId() {
  return window.aktivFirmaId || window.firmaData?.id || window.firma?.id || null;
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
window.hentFirmaData = hentFirmaData;
window.hentAktivFirmaId = hentAktivFirmaId;

window.firmaData = window.firmaData || {};
window.firma = window.firma || window.firmaData;
window.aktivFirmaId = window.aktivFirmaId || window.firmaData?.id || null;

window.addEventListener("load", function () {
  const lagreKnapp = document.getElementById("lagreFirmaKnapp");
  if (lagreKnapp) {
    lagreKnapp.onclick = function () {
      window.lagreFirma();
    };
  }

  const logoInput = document.getElementById("firmaLogo");
  if (logoInput) {
    logoInput.onchange = window.lastInnLogo;
  }
});


// AGK HAND FIRMA TENANT FIX: firmaadmin redigerer eget firma, ikke første firma i databasen.
(function(){
  async function handInnloggetEmail(){
    try{ const r = await window.supabaseClient?.auth?.getSession(); return String(r?.data?.session?.user?.email || window.innloggetEpost || '').toLowerCase(); }catch(e){ return String(window.innloggetEpost || '').toLowerCase(); }
  }
  async function handErSystemadmin(){
    const email = await handInnloggetEmail();
    if(email === 'greknuts@online.no') return true;
    try{ const {data,error}=await window.supabaseClient.rpc('er_systemadmin'); return !error && data === true; }catch(e){ return false; }
  }

  function handSlugFraUrl(){
    try{
      const params = new URLSearchParams(window.location.search || '');
      let slug = (params.get('firma') || params.get('kunde') || '').trim();
      if(!slug){
        const deler = String(window.location.pathname || '').split('/').filter(Boolean);
        const siste = deler[deler.length - 1] || '';
        if(siste && !['handverker','rettilomma','index.html'].includes(siste.toLowerCase())) slug = siste;
      }
      return slug ? decodeURIComponent(slug).toLowerCase() : '';
    }catch(e){ return ''; }
  }
  async function handFinnFirmaIdFraKundelink(){
    const slug = handSlugFraUrl();
    if(!slug || !window.supabaseClient) return null;
    try{
      let r = await window.supabaseClient.from('hand_firma').select('id').eq('linknavn', slug).limit(1).maybeSingle();
      if(!r.error && r.data?.id) return r.data.id;
    }catch(e){ console.warn('Fant ikke firma via linknavn:', e); }
    try{
      let r = await window.supabaseClient.from('hand_firma').select('id').ilike('kundelink', '%' + slug).limit(1).maybeSingle();
      if(!r.error && r.data?.id) return r.data.id;
    }catch(e){ console.warn('Fant ikke firma via kundelink:', e); }
    return null;
  }

  async function handFinnMittFirmaId(){
    if(!window.supabaseClient) return window.aktivFirmaId || window.firmaData?.id || null;
    const firmaFraLink = await handFinnFirmaIdFraKundelink();
    if(firmaFraLink) return firmaFraLink;
    if(window.aktivFirmaId && !(await handErSystemadmin())) return window.aktivFirmaId;
    const email = await handInnloggetEmail();
    try{
      const u = await window.supabaseClient.auth.getUser();
      const uid = u?.data?.user?.id || null;
      let q = window.supabaseClient.from('hand_ansatt').select('firma_id').limit(1);
      if(uid) q = q.eq('user_id', uid); else q = q.ilike('epost', email);
      let {data,error}=await q.maybeSingle();
      if(!error && data?.firma_id) return data.firma_id;
    }catch(e){ console.warn('Fant ikke firma via ansatte/user_id:', e); }
    try{
      const {data,error}=await window.supabaseClient.from('hand_ansatt').select('firma_id').ilike('epost', email).limit(1).maybeSingle();
      if(!error && data?.firma_id) return data.firma_id;
    }catch(e){ console.warn('Fant ikke firma via ansatte/epost:', e); }
    return window.aktivFirmaId || window.firmaData?.id || null;
  }
  async function hentAktivFirmaRadFix(){
    if(!window.supabaseClient) return window.firmaData || {};
    const isSys = await handErSystemadmin();
    let id = await handFinnMittFirmaId();
    if(isSys) {
      const feltId = (document.getElementById('redigerHandKundeId')?.value || '').trim();
      if(feltId) id = feltId;
    }
    let q = window.supabaseClient.from('hand_firma').select('*');
    if(id) q = q.eq('id', id);
    else q = q.order('id', {ascending:true}).limit(1);
    const {data,error} = await q.limit(1).maybeSingle();
    if(error){ console.error('Feil ved henting av firma:', error); return window.firmaData || {}; }
    const firma = data || {};
    window.firmaData = firma; window.firma = firma; window.aktivFirmaId = firma.id || null;
    return firma;
  }
  async function hentFirmaDataFix(){ return await hentAktivFirmaRadFix(); }
  async function lastFirmaFix(){
    const firma = await hentAktivFirmaRadFix();
    if(typeof settFirmaFeltHvisFinnes === 'function'){
      settFirmaFeltHvisFinnes('firmaNavn', firma.navn || firma.firmanavn);
      settFirmaFeltHvisFinnes('firmaAdresse', firma.adresse);
      settFirmaFeltHvisFinnes('firmaOrgnr', firma.orgnr || firma.org_nr); settFirmaFeltHvisFinnes('firmaOrgNr', firma.orgnr || firma.org_nr);
      settFirmaFeltHvisFinnes('firmaMvanr', firma.mva_nr || firma.mvanr); settFirmaFeltHvisFinnes('firmaMvaNr', firma.mva_nr || firma.mvanr);
      settFirmaFeltHvisFinnes('firmaTelefon', firma.telefon); settFirmaFeltHvisFinnes('firmaEpost', firma.epost || firma.email);
      settFirmaFeltHvisFinnes('firmaKontonr', firma.kontonr || firma.konto_nr); settFirmaFeltHvisFinnes('firmaKontoNr', firma.kontonr || firma.konto_nr);
      settFirmaFeltHvisFinnes('firmaVippsNummer', firma.vipps_nummer); settFirmaFeltHvisFinnes('firmaVippsMottaker', firma.vipps_mottaker);
      settFirmaFeltHvisFinnes('firmaBrevhode', firma.brevhode_tekst); settFirmaFeltHvisFinnes('firmaBrevfot', firma.brevfot_tekst);
    }
    if(typeof visFirma === 'function') visFirma(firma);
    return firma;
  }
  async function lagreFirmaFix(){
    const melding = document.getElementById('firmaMelding'); if(melding) melding.textContent='';
    const eksisterende = await hentAktivFirmaRadFix();
    const firma = {};
    if(typeof leggTilHvisUtfylt === 'function'){
      leggTilHvisUtfylt(firma, 'navn', 'firmaNavn'); leggTilHvisUtfylt(firma, 'adresse', 'firmaAdresse');
      leggTilHvisUtfylt(firma, 'orgnr', 'firmaOrgnr', 'firmaOrgNr'); leggTilHvisUtfylt(firma, 'mva_nr', 'firmaMvanr', 'firmaMvaNr');
      leggTilHvisUtfylt(firma, 'telefon', 'firmaTelefon'); leggTilHvisUtfylt(firma, 'epost', 'firmaEpost');
      leggTilHvisUtfylt(firma, 'kontonr', 'firmaKontonr', 'firmaKontoNr'); leggTilHvisUtfylt(firma, 'vipps_nummer', 'firmaVippsNummer');
      leggTilHvisUtfylt(firma, 'vipps_mottaker', 'firmaVippsMottaker'); leggTilHvisUtfylt(firma, 'brevhode_tekst', 'firmaBrevhode'); leggTilHvisUtfylt(firma, 'brevfot_tekst', 'firmaBrevfot');
    }
    try{ if(typeof lastOppFirmaLogoHvisValgt === 'function'){ const logoUrl = await lastOppFirmaLogoHvisValgt(); if(logoUrl){ firma.logo_url = logoUrl; firma.logo = null; } } }catch(e){ if(melding) melding.textContent=e.message||String(e); return; }
    if(Object.keys(firma).length===0){
      firma.navn = (document.getElementById('firmaNavn')?.value || '').trim() || 'Mitt firma';
    }

    let res;
    if(eksisterende?.id){
      res = await window.supabaseClient
        .from('hand_firma')
        .update(firma)
        .eq('id', eksisterende.id)
        .select()
        .maybeSingle();
    } else {
      // Første gangs oppsett: ingen firma-rad finnes for denne brukeren.
      // Opprett en ny hand_firma-rad i stedet for å stoppe med feilmelding.
      res = await window.supabaseClient
        .from('hand_firma')
        .insert([firma])
        .select()
        .maybeSingle();
    }

    if(res.error){ console.error(res.error); if(melding) melding.textContent='Feil ved lagring av firma: '+res.error.message; return; }
    window.firmaData=res.data||{}; window.firma=window.firmaData; window.aktivFirmaId=window.firmaData.id||null;

    // Prøv å koble innlogget ansatt til firmaet hvis ansatte-tabellen har firma_id.
    try {
      const email = await handInnloggetEmail();
      const uidRes = await window.supabaseClient.auth.getUser();
      const uid = uidRes?.data?.user?.id || null;
      const nyFirmaId = window.aktivFirmaId;
      if(nyFirmaId) {
        let q = window.supabaseClient.from('hand_ansatt').update({ firma_id: nyFirmaId });
        if(uid) q = q.eq('user_id', uid); else if(email) q = q.ilike('epost', email);
        await q;
      }
    } catch(e) {
      console.warn('Kunne ikke koble ansatt til firma automatisk:', e);
    }

    if(melding) melding.textContent=eksisterende?.id ? 'Firma lagret i databasen' : 'Første firma opprettet og lagret';
    await lastFirmaFix();
  }
  window.hentAktivFirmaRad = hentAktivFirmaRadFix;
  window.hentFirmaData = hentFirmaDataFix;
  window.lastFirma = lastFirmaFix;
  window.lagreFirma = lagreFirmaFix;
  window.hentAktivFirmaId = function(){ return window.aktivFirmaId || window.firmaData?.id || window.firma?.id || null; };
})();
