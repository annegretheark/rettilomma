/* Senere journal-, bilvare- og varelistefikser
   Utskilt fra vet-app.js 2026-06-11. Lastes i samme rekkefølge som originalfilen. */

/* =========================================================
   TVUNGEN FIKS: Journal - medisiner/varer fra bil
   Problem: nedtrekket viser bilnavn, men listen blir stående på "Velg bil først".
   Denne overstyrer bare bilvare-listen i journal.
   ========================================================= */
function vetJournalEscape(verdi) {
  return String(verdi || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetJournalBilLabel(b) {
  const eier = b?.veterinaer_navn ? " | " + b.veterinaer_navn : "";
  return [b?.navn, b?.regnr].filter(Boolean).join(" - ") + eier;
}

function vetJournalFinnBilIdHardt() {
  const el = document.getElementById("journalBilValg");
  if (!el) return "";

  let id = String(el.value || "").trim();
  if (id) return id;

  const opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
  id = String(opt?.value || "").trim();
  if (id) { el.value = id; return id; }

  const valgtTekst = String(opt?.textContent || opt?.innerText || "").trim().toLowerCase();
  if (valgtTekst && !valgtTekst.includes("velg bil")) {
    const match = (vetBiler || []).find(b => {
      const label = vetJournalBilLabel(b).toLowerCase();
      return label === valgtTekst || label.includes(valgtTekst) || valgtTekst.includes(String(b.navn || "").toLowerCase()) || valgtTekst.includes(String(b.regnr || "").toLowerCase());
    });
    if (match?.id) { el.value = match.id; return String(match.id); }
  }

  const reelleOptions = Array.from(el.options || []).filter(o => String(o.value || "").trim());
  if (reelleOptions.length) {
    el.value = reelleOptions[0].value;
    return String(reelleOptions[0].value || "").trim();
  }

  if ((vetBiler || []).length) {
    const b = (vetBiler || [])[0];
    if (b?.id) {
      if (!Array.from(el.options || []).some(o => String(o.value) === String(b.id))) {
        const option = document.createElement("option");
        option.value = b.id;
        option.textContent = vetJournalBilLabel(b) || "Bil";
        el.appendChild(option);
      }
      el.value = b.id;
      return String(b.id);
    }
  }

  return "";
}

async function vetJournalHentBilvarerHardt(bilId) {
  let rader = [];

  if (bilId) {
    rader = (vetBilLager || []).filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0);
    if (rader.length) return rader;
  }

  if (!window.supabaseClient) return [];

  // Først: prøv valgt bil uten klinikkfilter. RLS i Supabase skal uansett beskytte data.
  if (bilId) {
    try {
      const { data, error } = await supabaseClient
        .from("vet_bil_lager")
        .select("*, vet_varer(*)")
        .eq("bil_id", bilId)
        .gt("antall", 0);
      if (!error && data?.length) return data;
    } catch (e) {}

    // Hvis relasjonen vet_varer(*) feiler, hent rå rader.
    try {
      const { data, error } = await supabaseClient
        .from("vet_bil_lager")
        .select("*")
        .eq("bil_id", bilId)
        .gt("antall", 0);
      if (!error && data?.length) return data;
    } catch (e) {}
  }

  // Siste nødgrep: hent første bil-lager-rader som faktisk har beholdning.
  try {
    const { data, error } = await supabaseClient
      .from("vet_bil_lager")
      .select("*, vet_varer(*)")
      .gt("antall", 0);
    if (!error && data?.length) {
      const førsteBilId = data[0].bil_id;
      const el = document.getElementById("journalBilValg");
      if (el && førsteBilId) {
        if (!Array.from(el.options || []).some(o => String(o.value) === String(førsteBilId))) {
          const bil = (vetBiler || []).find(b => String(b.id) === String(førsteBilId));
          const option = document.createElement("option");
          option.value = førsteBilId;
          option.textContent = bil ? vetJournalBilLabel(bil) : "Bil med varer";
          el.appendChild(option);
        }
        el.value = førsteBilId;
      }
      return data.filter(r => String(r.bil_id) === String(førsteBilId));
    }
  } catch (e) {}

  try {
    const { data, error } = await supabaseClient
      .from("vet_bil_lager")
      .select("*")
      .gt("antall", 0);
    if (!error && data?.length) return data.filter(r => String(r.bil_id) === String(data[0].bil_id));
  } catch (e) {}

  return [];
}

function vetJournalPrisHardt(vare, rad) {
  return Number(vare?.utsalgspris ?? vare?.utpris ?? vare?.pris ?? vare?.salgspris ?? rad?.utsalgspris ?? rad?.utpris ?? rad?.pris ?? 0) || 0;
}

function vetJournalVarenavnHardt(rad) {
  const vare = rad?.vet_varer || (vetVarer || []).find(v => String(v.id) === String(rad?.vare_id)) || {};
  return vare?.navn || rad?.varenavn || rad?.navn || "Vare/medisin";
}

window.fyllJournalBilVareValg = async function fyllJournalBilVareValgHardt() {
  const liste = document.getElementById("journalBilVareListe");
  const select = document.getElementById("journalBilVareValg");
  if (liste) liste.innerHTML = '<p class="lite">Henter varer/medisiner fra bil ...</p>';

  const bilId = vetJournalFinnBilIdHardt();
  const rader = await vetJournalHentBilvarerHardt(bilId);

  if (!rader.length) {
    if (select) select.innerHTML = '<option value="">Ingen varer i valgt bil</option>';
    if (liste) {
      const antBiler = (vetBiler || []).length;
      const antBilLager = (vetBilLager || []).length;
      liste.innerHTML = `<p class="melding">Ingen varer/medisiner funnet på bil. Biler lastet: ${antBiler}. Bil-lager-rader lastet: ${antBilLager}. Sjekk at bilen faktisk har varer med antall over 0.</p>`;
    }
    return;
  }

  // Oppdater cache slik trekk fra bil-lager bruker samme rader.
  const bil = rader[0]?.bil_id;
  if (bil) {
    const andre = (vetBilLager || []).filter(r => String(r.bil_id) !== String(bil));
    vetBilLager = [...andre, ...rader];
  }

  if (select) {
    select.innerHTML = '<option value="">Velg medisin/vare</option>' + rader.map(r => {
      const vare = r.vet_varer || (vetVarer || []).find(v => String(v.id) === String(r.vare_id)) || {};
      return `<option value="${vetJournalEscape(r.vare_id)}">${vetJournalEscape(vetJournalVarenavnHardt(r))} - på bil: ${Math.floor(Number(r.antall || 0))} ${vetJournalEscape(vare.enhet || "stk")} - ${formaterKr(vetJournalPrisHardt(vare, r))} kr</option>`;
    }).join("");
  }

  if (liste) {
    liste.innerHTML = `
      <div class="vet-linje-liste" style="display:grid;gap:6px;">
        ${rader.map(r => {
          const vare = r.vet_varer || (vetVarer || []).find(v => String(v.id) === String(r.vare_id)) || {};
          const vareId = String(r.vare_id || "");
          const maks = Math.floor(Number(r.antall || 0));
          return `
            <label class="vet-linje-kort" style="display:grid;grid-template-columns:34px minmax(160px,1.6fr) minmax(95px,.8fr) minmax(95px,.7fr) 110px;gap:8px;align-items:center;cursor:pointer;border:1px solid #374151;border-radius:8px;padding:8px;background:#22272a;">
              <input class="journal-bilvare-velg" data-vare-id="${vetJournalEscape(vareId)}" type="checkbox" style="width:auto;margin:0;">
              <span class="lite">${vetJournalEscape(vetJournalVarenavnHardt(r))}</span>
              <span class="lite">På bil: ${maks} ${vetJournalEscape(vare.enhet || "stk")}</span>
              <span class="lite">${formaterKr(vetJournalPrisHardt(vare, r))} kr</span>
              <input class="journal-bilvare-antall" data-vare-id="${vetJournalEscape(vareId)}" type="number" step="1" min="1" max="${maks}" placeholder="Antall" onclick="event.stopPropagation();" style="margin:0;">
            </label>
          `;
        }).join("")}
      </div>`;
  }
};

window.leggTilJournalVarerFraBilListe = async function leggTilJournalVarerFraBilListeHardt() {
  vetMelding("journalMelding", "");
  const bilId = vetJournalFinnBilIdHardt();
  const rader = await vetJournalHentBilvarerHardt(bilId);
  if (!rader.length) { vetMelding("journalMelding", "Ingen varer/medisiner funnet på valgt bil."); return; }

  const valgte = new Set(Array.from(document.querySelectorAll(".journal-bilvare-velg:checked")).map(cb => String(cb.dataset.vareId || "")));
  const linjer = Array.from(document.querySelectorAll(".journal-bilvare-antall"))
    .map(input => ({ vareId: String(input.dataset.vareId || ""), antall: Number(String(input.value || "").replace(",", ".")) }))
    .filter(l => l.vareId && (valgte.has(l.vareId) || l.antall > 0));

  if (!linjer.length) { vetMelding("journalMelding", "Huk av vare og skriv antall."); return; }

  for (const linje of linjer) {
    const rad = rader.find(r => String(r.vare_id) === String(linje.vareId));
    const vare = rad?.vet_varer || (vetVarer || []).find(v => String(v.id) === String(linje.vareId)) || {};
    const beholdning = Math.floor(Number(rad?.antall || 0));
    if (!Number.isInteger(linje.antall) || linje.antall <= 0) { vetMelding("journalMelding", "Antall må være heltall større enn 0."); return; }
    if (linje.antall > beholdning) { vetMelding("journalMelding", `${vetJournalVarenavnHardt(rad)}: ikke nok på bilen. Tilgjengelig: ${beholdning}.`); return; }
    vetJournalVarerTemp.push({
      vare_id: linje.vareId,
      bil_id: rad?.bil_id || bilId,
      varenavn: vetJournalVarenavnHardt(rad),
      antall: linje.antall,
      pris: vetJournalPrisHardt(vare, rad),
      trekk_fra_billager: true
    });
  }
  tegnJournalVareListe();
  oppdaterJournalSum();
  vetMelding("journalMelding", `${linjer.length} varelinje(r) lagt til fra bil.`);
  document.querySelectorAll(".journal-bilvare-velg").forEach(cb => cb.checked = false);
  document.querySelectorAll(".journal-bilvare-antall").forEach(input => input.value = "");
};

function vetJournalBindBilvareHardt() {
  const el = document.getElementById("journalBilValg");
  if (el && !el.dataset.tvungenBilvareFiks) {
    el.dataset.tvungenBilvareFiks = "1";
    el.addEventListener("change", () => window.fyllJournalBilVareValg());
    el.addEventListener("click", () => setTimeout(() => window.fyllJournalBilVareValg(), 50));
    el.addEventListener("input", () => window.fyllJournalBilVareValg());
  }
  const knapp = document.getElementById("leggTilJournalVarerFraBilListeKnapp");
  if (knapp && !knapp.dataset.tvungenBilvareFiks) {
    knapp.dataset.tvungenBilvareFiks = "1";
    knapp.onclick = () => window.leggTilJournalVarerFraBilListe();
  }
}

setInterval(() => {
  vetJournalBindBilvareHardt();
  const liste = document.getElementById("journalBilVareListe");
  const el = document.getElementById("journalBilValg");
  if (liste && el && String(liste.textContent || "").toLowerCase().includes("velg bil først")) {
    window.fyllJournalBilVareValg();
  }
}, 700);

setTimeout(() => { vetJournalBindBilvareHardt(); window.fyllJournalBilVareValg?.(); }, 1000);


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





/* ===== RYDDET VETERINÆRPAKKE 2026-06-10 =====
   Hindrer doble hurtigknapper og doble pasient-toolbarer etter opprydding.
*/
(function(){
  function fjernHurtigKnapper(){
    const wrap=document.getElementById('vetPasientHurtigKnapper');
    if(wrap) wrap.remove();
  }
  function ryddPasientToolbarer(){
    const side=document.getElementById('eierSide');
    if(!side) return;
    const toolbars=Array.from(side.querySelectorAll('.vet-tre-toolbar'));
    if(toolbars.length>1){
      toolbars.slice(1).forEach(x=>x.remove());
    }
    // Hvis en gammel patch har lagt identiske knapper ved siden av hverandre, behold første gruppe.
    const root=document.getElementById('vetPasientTreRoot');
    if(root){
      const knappetekst=['oppdater','ny dyreeier','nytt dyr','ny pasient'];
      const sett=new Set();
      Array.from(root.parentElement?.querySelectorAll('button') || []).forEach(btn=>{
        const t=String(btn.textContent||'').trim().toLowerCase();
        if(!knappetekst.includes(t)) return;
        const key=t+'|'+(btn.getAttribute('onclick')||'');
        if(sett.has(key)) btn.remove();
        else sett.add(key);
      });
    }
  }
  window.vetRyddDobbelKnapper=function(){ fjernHurtigKnapper(); ryddPasientToolbarer(); };
  window.addEventListener('load',()=>{
    window.vetRyddDobbelKnapper();
    setTimeout(window.vetRyddDobbelKnapper,500);
    setTimeout(window.vetRyddDobbelKnapper,1500);
  });
  document.addEventListener('click',()=>setTimeout(window.vetRyddDobbelKnapper,100),true);
  const obs=new MutationObserver(()=>window.vetRyddDobbelKnapper());
  window.addEventListener('load',()=>{ if(document.body) obs.observe(document.body,{childList:true,subtree:true}); });
})();


/* ===== VARELISTE SKJULT TIL BRUKER BER OM DEN 2026-06-10 =====
   Varelisten fra bil skal oppføre seg som behandlingslisten:
   - skjult først
   - vises bare når bruker trykker "Velg vare/medisin"
   - skjules igjen når bil endres
   - rører ikke pasientliste, behandlinger, journal eller lager ellers
*/
(function(){
  let vetVarelisteSynlig = false;
  let vetVarelisteLaster = false;

  function qs(id){ return document.getElementById(id); }

  function finnListe(){ return qs('journalBilVareListe'); }

  function skjulListe(tekst){
    const liste = finnListe();
    if (!liste) return;
    liste.style.display = 'none';
    liste.innerHTML = tekst || '';
  }

  function visListe(){
    const liste = finnListe();
    if (!liste) return;
    liste.style.display = '';
  }

  function oppdaterKnapp(){
    const knapp = qs('journalVisVarelisteKnapp');
    if (!knapp) return;
    knapp.textContent = vetVarelisteSynlig ? 'Skjul vareliste' : 'Velg vare/medisin';
  }

  function sørgVarelisteKnapp(){
    const liste = finnListe();
    if (!liste) return null;

    let knapp = qs('journalVisVarelisteKnapp');
    if (!knapp) {
      knapp = document.createElement('button');
      knapp.id = 'journalVisVarelisteKnapp';
      knapp.type = 'button';
      knapp.className = 'secondary';
      knapp.style.margin = '8px 0';
      liste.parentNode.insertBefore(knapp, liste);
    }

    if (knapp.dataset.varelisteKoblet !== '1') {
      knapp.dataset.varelisteKoblet = '1';
      knapp.addEventListener('click', async function(e){
        e.preventDefault();
        e.stopPropagation();

        vetVarelisteSynlig = !vetVarelisteSynlig;
        oppdaterKnapp();

        if (!vetVarelisteSynlig) {
          skjulListe('');
          return false;
        }

        visListe();
        if (typeof vetOriginalFyllJournalBilVareValg === 'function') {
          await vetOriginalFyllJournalBilVareValg();
        }
        visListe();
        return false;
      });
    }

    oppdaterKnapp();
    return knapp;
  }

  const vetOriginalFyllJournalBilVareValg = window.fyllJournalBilVareValg || (typeof fyllJournalBilVareValg === 'function' ? fyllJournalBilVareValg : null);

  window.fyllJournalBilVareValg = async function fyllJournalBilVareValgSkjultTilValg(){
    sørgVarelisteKnapp();

    // Ikke la auto-kall, intervaller eller bilvalg vise hele varelisten.
    if (!vetVarelisteSynlig) {
      skjulListe('');
      return;
    }

    if (vetVarelisteLaster) return;
    vetVarelisteLaster = true;
    try {
      if (typeof vetOriginalFyllJournalBilVareValg === 'function') {
        await vetOriginalFyllJournalBilVareValg();
      }
      visListe();
    } finally {
      vetVarelisteLaster = false;
    }
  };

  function resetVedBilbytte(){
    const bil = qs('journalBilValg');
    if (!bil || bil.dataset.varelisteSkjulKoblet === '1') return;
    bil.dataset.varelisteSkjulKoblet = '1';
    bil.addEventListener('change', function(){
      vetVarelisteSynlig = false;
      oppdaterKnapp();
      skjulListe('');
    }, true);
  }

  function init(){
    sørgVarelisteKnapp();
    resetVedBilbytte();
    if (!vetVarelisteSynlig) skjulListe('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

  window.addEventListener('load', function(){
    init();
    setTimeout(init, 500);
    setTimeout(init, 1500);
  });

  const gammelVisVetSideVareliste = window.visVetSide || (typeof visVetSide === 'function' ? visVetSide : null);
  if (gammelVisVetSideVareliste) {
    window.visVetSide = function(id){
      const r = gammelVisVetSideVareliste.apply(this, arguments);
      if (id === 'journalSide') {
        vetVarelisteSynlig = false;
        setTimeout(init, 0);
      }
      return r;
    };
    try { visVetSide = window.visVetSide; } catch(e) {}
  }
})();
/* ===== SLUTT VARELISTE SKJULT ===== */

