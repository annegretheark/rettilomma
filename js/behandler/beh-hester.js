console.log("beh-hester.js lastet - robust kunde/dyr 2026-06-14");

let sisteHester = [];
let sisteKunder = [];
let behHestKundeIntervall = null;

function hestMelding(tekst, feil = false) {
  const el = document.getElementById("hestMelding");
  if (!el) return;
  el.textContent = tekst || "";
  el.style.color = feil ? "#fca5a5" : "#86efac";
}

function behHentEl(id) {
  return document.getElementById(id);
}

function hentValgtKundeId() {
  return String(behHentEl("behandlingKunde")?.value || "");
}

function datoVerdi(v) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

function behEscHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function finnValgtHestFraSkjema() {
  const id = behHentEl("hestVelg")?.value || "";
  if (!id) return null;
  return sisteHester.find(h => String(h.id) === String(id)) || null;
}

async function ventPåSupabaseClient(ms = 5000) {
  const start = Date.now();
  while (!window.supabaseClient && Date.now() - start < ms) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return !!window.supabaseClient;
}

function fyllSelectMedKunder(select, kunder, tekst = "Velg kunde") {
  if (!select) return;
  const valgt = String(select.value || "");
  select.innerHTML = `<option value="">${tekst}</option>`;

  for (const k of kunder || []) {
    const opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.navn || "Uten navn";
    select.appendChild(opt);
  }

  if (valgt && (kunder || []).some(k => String(k.id) === valgt)) {
    select.value = valgt;
  }
}

function fyllAlleKundeSelect(kunder) {
  // Behandling-siden brukte #behandlingKunde, mens Dyr-siden bruker #hestKunde.
  // Begge må fylles fra samme tabell: beh_kunder.
  fyllSelectMedKunder(behHentEl("hestKunde"), kunder || sisteKunder, "Velg kunde");
  fyllSelectMedKunder(behHentEl("behandlingKunde"), kunder || sisteKunder, "Velg kunde");
  fyllSelectMedKunder(behHentEl("fakturaKunde"), kunder || sisteKunder, "Velg kunde");
}

async function hentBehKunderFraBase() {
  const ok = await ventPåSupabaseClient();
  if (!ok) throw new Error("Mangler Supabase-klient. Sjekk config.js og at siden ligger i riktig mappe.");

  const { data, error } = await window.supabaseClient
    .from("beh_kunder")
    .select("id, navn")
    .order("navn", { ascending: true });

  if (error) throw error;
  sisteKunder = data || [];
  return sisteKunder;
}

async function hentOgFyllHestKunder() {
  try {
    const select = behHentEl("hestKunde");
    if (!select) return;

    select.innerHTML = `<option value="">Laster kunder ...</option>`;
    const kunder = await hentBehKunderFraBase();
    fyllAlleKundeSelect(kunder);

    if (kunder.length === 0) {
      hestMelding("Ingen kunder funnet i beh_kunder.", true);
    } else {
      hestMelding(`Fant ${kunder.length} kunder. Velg kunde/eier.`, false);
    }

    fyllHestVelgForValgtKunde();
    fyllHestSelect(sisteHester);
  } catch (error) {
    console.error("Kunne ikke hente kunder til dyr:", error);
    const select = behHentEl("hestKunde");
    if (select) select.innerHTML = `<option value="">Kunne ikke laste kunder</option>`;
    hestMelding("Kunne ikke hente kunder: " + (error.message || error), true);
  }
}

function fyllHestKundeSelect(kunder) {
  fyllAlleKundeSelect(kunder || sisteKunder);
}

function bindLastKunderTilDyrSide() {
  document.querySelectorAll('a[href="#hesterSide"]').forEach(a => {
    if (a.dataset.behDyrKunderBindet === "1") return;
    a.dataset.behDyrKunderBindet = "1";
    a.addEventListener("click", () => {
      setTimeout(hentOgFyllHestKunder, 50);
      setTimeout(hentHester, 250);
    });
  });

  if (!window.behDyrHashBindet) {
    window.behDyrHashBindet = "1";
    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#hesterSide") {
        setTimeout(hentOgFyllHestKunder, 50);
        setTimeout(hentHester, 250);
      }
    });
  }
}

async function lagreHest() {
  const kundeId = behHentEl("hestKunde")?.value || "";
  const navn = behHentEl("hestNavn")?.value.trim() || "";
  const valgtHestId = behHentEl("hestVelg")?.value || "";

  if (!kundeId) {
    hestMelding("Velg kunde/eier først", true);
    return false;
  }

  if (!navn) {
    hestMelding("Mangler navn på dyr", true);
    return false;
  }

  const ok = await ventPåSupabaseClient();
  if (!ok) {
    hestMelding("Mangler Supabase-klient. Sjekk config.js.", true);
    return false;
  }

  const hest = {
    kunde_id: kundeId,
    navn,
    rase: behHentEl("hestRase")?.value.trim() || "",
    notater: behHentEl("hestNotater")?.value.trim() || "",
    sist_skodd: behHentEl("sistSkodd")?.value || null,
    neste_besok: behHentEl("nesteBesok")?.value || null
  };

  let res;
  if (valgtHestId) {
    res = await window.supabaseClient.from("beh_hester").update(hest).eq("id", valgtHestId);
  } else {
    res = await window.supabaseClient.from("beh_hester").insert([hest]);
  }

  if (res.error) {
    console.error(res.error);
    hestMelding("Kunne ikke lagre dyr: " + res.error.message, true);
    return false;
  }

  hestMelding(valgtHestId ? "Dyr oppdatert ✅" : "Dyr lagret ✅", false);
  await hentHester();

  if (typeof window.hentAlleHesterFraBase === "function") {
    try { await window.hentAlleHesterFraBase(); } catch(e) { console.warn(e); }
  }
  if (typeof window.fyllBehandlingHesterForValgtKunde === "function") {
    try { await window.fyllBehandlingHesterForValgtKunde(); } catch(e) { console.warn(e); }
  }
  return false;
}

async function hentHester() {
  try {
    const ok = await ventPåSupabaseClient();
    if (!ok) throw new Error("Mangler Supabase-klient. Sjekk config.js.");

    const hestRes = await window.supabaseClient.from("beh_hester").select("*").order("navn", { ascending: true });
    if (hestRes.error) throw hestRes.error;

    let kunder = sisteKunder;
    if (!kunder || kunder.length === 0) kunder = await hentBehKunderFraBase();

    fyllAlleKundeSelect(kunder);
    const kundeNavn = new Map((kunder || []).map(k => [String(k.id), k.navn || ""]));
    const hester = hestRes.data || [];
    sisteHester = hester;

    const liste = behHentEl("hesteListe");
    if (liste) {
      liste.innerHTML = "";
      if (hester.length === 0) {
        liste.innerHTML = `<div class="info">Ingen dyr er registrert ennå.</div>`;
      }
      for (const h of hester) {
        const div = document.createElement("div");
        div.className = "listekort";
        div.innerHTML = `
          <b>${behEscHtml(h.navn)}</b><br>
          Eier: ${behEscHtml(kundeNavn.get(String(h.kunde_id)))}<br>
          ${behEscHtml(h.rase)}<br>
          Sist behandlet: ${datoVerdi(h.sist_skodd)}<br>
          Neste oppfølging: ${datoVerdi(h.neste_besok)}<br>
          ${behEscHtml(h.notater)}
        `;
        liste.appendChild(div);
      }
    }

    fyllHestSelect(hester);
    fyllHestVelgForValgtKunde(hester);
  } catch (error) {
    console.error("Kunne ikke hente dyr:", error);
    hestMelding("Kunne ikke hente dyr/kunder: " + (error.message || error), true);
  }
}

function fyllHestSelect(hester) {
  const select = behHentEl("behandlingHest");
  if (!select) return;

  const valgtKunde = hentValgtKundeId();
  select.innerHTML = `<option value="">Velg dyr</option>`;
  if (!valgtKunde) return;

  const filtrerte = (hester || sisteHester || []).filter(h => String(h.kunde_id) === String(valgtKunde));
  for (const h of filtrerte) {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.navn || "Uten navn";
    select.appendChild(opt);
  }
}

function fyllHestVelgForValgtKunde(hester = sisteHester) {
  const kundeSelect = behHentEl("hestKunde");
  const hestVelg = behHentEl("hestVelg");
  if (!kundeSelect || !hestVelg) return;

  const valgtKunde = String(kundeSelect.value || "");
  const valgtHest = String(hestVelg.value || "");
  hestVelg.innerHTML = `<option value="">Nytt dyr</option>`;
  if (!valgtKunde) return;

  const filtrerte = (hester || []).filter(h => String(h.kunde_id) === valgtKunde);
  for (const h of filtrerte) {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.navn || "Uten navn";
    hestVelg.appendChild(opt);
  }

  if (valgtHest && filtrerte.some(h => String(h.id) === valgtHest)) hestVelg.value = valgtHest;
}

function fyllHestSkjemaFraValg() {
  const h = finnValgtHestFraSkjema();
  const fields = ["hestNavn", "hestRase", "hestNotater", "sistSkodd", "nesteBesok"];

  if (!h) {
    fields.forEach(id => { const e = behHentEl(id); if (e) e.value = ""; });
    return;
  }

  if (behHentEl("hestNavn")) behHentEl("hestNavn").value = h.navn || "";
  if (behHentEl("hestRase")) behHentEl("hestRase").value = h.rase || "";
  if (behHentEl("hestNotater")) behHentEl("hestNotater").value = h.notater || "";
  if (behHentEl("sistSkodd")) behHentEl("sistSkodd").value = datoVerdi(h.sist_skodd);
  if (behHentEl("nesteBesok")) behHentEl("nesteBesok").value = datoVerdi(h.neste_besok);
}

function bindDyrSkjema() {
  bindLastKunderTilDyrSide();

  const lagreKnapp = behHentEl("lagreHestKnapp");
  if (lagreKnapp && lagreKnapp.dataset.behLagreDyrBindet !== "1") {
    lagreKnapp.dataset.behLagreDyrBindet = "1";
    lagreKnapp.onclick = function(ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); }
      return lagreHest();
    };
  }

  const behandlingKunde = behHentEl("behandlingKunde");
  if (behandlingKunde && behandlingKunde.dataset.behHestFilterBindet !== "1") {
    behandlingKunde.dataset.behHestFilterBindet = "1";
    behandlingKunde.addEventListener("change", async () => { await hentHester(); });
  }

  const hestKunde = behHentEl("hestKunde");
  if (hestKunde && hestKunde.dataset.behDyrKundeBindet !== "1") {
    hestKunde.dataset.behDyrKundeBindet = "1";
    hestKunde.addEventListener("focus", hentOgFyllHestKunder);
    hestKunde.addEventListener("change", () => {
      const hestVelg = behHentEl("hestVelg");
      if (hestVelg) hestVelg.value = "";
      fyllHestVelgForValgtKunde();
    fyllHestSelect(sisteHester);
      fyllHestSkjemaFraValg();
    });
  }

  const hestVelg = behHentEl("hestVelg");
  if (hestVelg && hestVelg.dataset.behDyrValgBindet !== "1") {
    hestVelg.dataset.behDyrValgBindet = "1";
    hestVelg.addEventListener("change", fyllHestSkjemaFraValg);
  }
}

function startDyrLasting() {
  bindDyrSkjema();
  setTimeout(hentOgFyllHestKunder, 100);
  setTimeout(hentOgFyllHestKunder, 500);
  setTimeout(hentHester, 900);

  if (!behHestKundeIntervall) {
    let runder = 0;
    behHestKundeIntervall = setInterval(async () => {
      runder += 1;
      const select = behHentEl("hestKunde");
      const trenger = select && select.options.length <= 1;
      if (trenger) await hentOgFyllHestKunder();
      if (runder >= 10 || (select && select.options.length > 1)) {
        clearInterval(behHestKundeIntervall);
        behHestKundeIntervall = null;
      }
    }, 700);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startDyrLasting);
} else {
  startDyrLasting();
}

window.addEventListener("load", () => {
  bindDyrSkjema();
  setTimeout(hentOgFyllHestKunder, 100);
  setTimeout(hentHester, 800);
});

window.lagreHest = lagreHest;
window.hentHester = hentHester;
window.fyllHestSelect = fyllHestSelect;
window.fyllHestVelgForValgtKunde = fyllHestVelgForValgtKunde;
window.fyllHestSkjemaFraValg = fyllHestSkjemaFraValg;
window.hentOgFyllHestKunder = hentOgFyllHestKunder;
window.fyllHestKundeSelect = fyllHestKundeSelect;

window.fyllAlleKundeSelect = fyllAlleKundeSelect;


// Bilde-preview bare visuelt. Selve trygg lagring/valg ligger sist i index.html.
(function(){
  function bindPreview(){
    const inp = document.getElementById("hestBilde");
    const img = document.getElementById("hestBildePreview");
    if(!inp || !img || inp.dataset.behBildePreview === "1") return;
    inp.dataset.behBildePreview = "1";
    inp.addEventListener("change", function(){
      const f = inp.files && inp.files[0];
      if(f){
        img.src = URL.createObjectURL(f);
        img.style.display = "block";
      }
    });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindPreview);
  else bindPreview();
  window.addEventListener("load", bindPreview);
})();
