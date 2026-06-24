
/* Lager 0 endelig fix: firma-filter + riktige tabeller + ingen feil relasjon hand_bil_lager->biler */
(function(){
  "use strict";
  function firmaId(){ return (typeof window.hentAktivFirmaId==="function" ? window.hentAktivFirmaId() : null) || window.aktivFirmaId || window.handFirmaId || window.handAnsattFirmaId || window.firmaData?.id || window.firma?.id || localStorage.getItem("aktivFirmaId") || localStorage.getItem("handFirmaId") || localStorage.getItem("firma_id") || null; }
  function tall(v){ if(v===undefined||v===null||String(v).trim()==="") return 0; const n=Number(String(v).replace(/\s/g,"").replace(",",".")); return Number.isFinite(n)?n:0; }
  function hoved(v){ return tall(v?.lager_antall ?? v?.antall ?? v?.beholdning ?? v?.hovedlager ?? 0); }
  function minimum(v){ return tall(v?.minimum_antall ?? v?.min_antall ?? v?.minimum ?? 0); }
  function esc(s){ return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
  function navn(v){ return String((v?.varenr ? v.varenr + " - " : "") + (v?.navn || v?.varenavn || v?.beskrivelse || "Vare")); }
  function inn(v){ return tall(v?.innpris ?? 0).toFixed(2); }
  function ut(v){ return tall(v?.utpris ?? v?.pris ?? 0).toFixed(2); }
  function mva(v){ return tall(v?.mva ?? v?.mva_sats ?? v?.mva_prosent ?? 25); }
  async function hentVarer(){
    let q = window.supabaseClient.from("hand_vare").select("id, varenr, navn, varenavn, beskrivelse, innpris, pris, utpris, lager_antall, antall, beholdning, minimum_antall, min_antall, mva, mva_sats, mva_prosent, firma_id, aktiv");
    const f = firmaId();
    if(f) q = q.eq("firma_id", f);
    q = q.order("varenr", {ascending:true}).limit(1000);
    const res = await q;
    if(res.error) throw res.error;
    const seen = new Set();
    return (res.data || []).filter(v => { const key = String(v.varenr || v.id || ""); if(key && seen.has(key)) return false; if(key) seen.add(key); return true; });
  }
  async function tegnFyllListe(){
    const c = document.getElementById("bilLagerFyllListe");
    if(!c || !window.supabaseClient) return;
    c.innerHTML = '<p class="info">Henter varer fra hovedlager...</p>';
    try{
      const varer = await hentVarer();
      window.varerTilBilLager = varer;
      if(!varer.length){ c.innerHTML = '<p class="melding">Ingen varer i hovedlager for valgt firma.</p>'; return; }
      c.innerHTML = `<div style="overflow:auto; max-height:460px; border:1px solid #374151; border-radius:10px; margin-top:8px;"><table class="bil-tabell"><thead><tr><th>Varenr</th><th>Vare</th><th>Innpris</th><th>Utpris</th><th>Hovedlager</th><th>Min. hovedlager</th><th>MVA</th><th>Antall til bil</th><th>Min. på bil</th></tr></thead><tbody>${varer.map(v=>`<tr><td>${esc(v.varenr||"")}</td><td>${esc(navn(v))}</td><td>${esc(inn(v))}</td><td>${esc(ut(v))}</td><td>${esc(hoved(v))}</td><td>${esc(minimum(v))}</td><td>${esc(mva(v))}%</td><td><input class="bil-lager-antall-liste" data-vare-id="${esc(v.id)}" type="number" step="1" min="0" placeholder="0" style="width:86px"></td><td><input class="bil-lager-min-liste" data-vare-id="${esc(v.id)}" type="number" step="1" min="0" placeholder="0" style="width:86px"></td></tr>`).join("")}</tbody></table></div>`;
    }catch(e){ c.innerHTML = '<p class="melding">Kunne ikke hente varer: '+esc(e.message||e)+'</p>'; }
  }
  window.hentOgTegnBilFyllelisteFraDatabase = tegnFyllListe;
  window.handTegnFyllBilListeRiktig = tegnFyllListe;
  document.addEventListener("DOMContentLoaded", ()=>setTimeout(tegnFyllListe, 1200));
  window.addEventListener("load", ()=>setTimeout(tegnFyllListe, 1200));
})();
