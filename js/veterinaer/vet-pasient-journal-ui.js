/* Rett i Lomma Veterinær: stabil pasient/journal-flyt
   2026-06-12 layoutfix
   Lastes SIST fra index.html.
*/
(function(){
  let valgtEierId = "";
  let valgtDyrId = "";
  let journalOriginalParent = null;
  let journalOriginalNext = null;

  function qs(id){ return document.getElementById(id); }
  function arr(name){
    try { return Function("return (typeof " + name + " !== 'undefined' ? " + name + " : [])")() || []; }
    catch(e){ return []; }
  }
  function esc(v){
    return String(v ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#39;");
  }
  function setv(id, v){ const el = qs(id); if (el) el.value = v ?? ""; }
  function datoNo(d){
    const s = String(d || "");
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const p = s.slice(0,10).split("-");
      return `${p[2]}.${p[1]}.${p[0]}`;
    }
    return s || "";
  }
  function kr(v){
    try { return typeof formaterKr === "function" ? formaterKr(v) : Number(v || 0).toFixed(2).replace(".", ","); }
    catch(e){ return Number(v || 0).toFixed(2).replace(".", ","); }
  }
  function eierIdForDyr(d){
    return d?.dyreeier_id || d?.eier_id || d?.kunde_id || d?.owner_id || d?.vet_dyreeiere?.id || d?.dyreeier?.id || "";
  }
  function dyrBildeUrl(d){
    return d?.bilde_url || d?.bilde || d?.foto_url || d?.profilbilde_url || d?.profil_bilde_url || d?.image_url || d?.bildeUrl || "";
  }
  function eiere(){ return arr("vetDyreeiere").slice().sort((a,b)=>String(a.navn||"").localeCompare(String(b.navn||""),"nb")); }
  function dyr(){ return arr("vetDyr").slice().sort((a,b)=>String(a.navn||"").localeCompare(String(b.navn||""),"nb")); }
  function journal(){ return arr("vetJournal").slice(); }
  function finnEier(id){ return eiere().find(e => String(e.id||"") === String(id||"")) || null; }
  function finnDyr(id){ return dyr().find(d => String(d.id||"") === String(id||"")) || null; }
  function finnJournal(id){ return journal().find(j => String(j.id||"") === String(id||"")) || null; }
  function dyrForEier(eierId){ return dyr().filter(d => String(eierIdForDyr(d)) === String(eierId || "")); }
  function journalForDyr(dyrId){
    return journal()
      .filter(j => String(j.dyr_id || j.vet_dyr?.id || "") === String(dyrId || ""))
      .sort((a,b)=>String(b.dato||"").localeCompare(String(a.dato||"")) || String(b.created_at||"").localeCompare(String(a.created_at||"")));
  }

  function cssOnce(){
    if (qs("vetLayoutFixCss")) return;
    const s = document.createElement("style");
    s.id = "vetLayoutFixCss";
    s.textContent = `
      #eierSide{overflow:visible!important;}
      #eierSide .vet-ren-toolbar{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin:8px 0 14px!important;}
      #eierSide .vet-eier-kort{
        width:100%!important;box-sizing:border-box!important;margin:8px 0!important;padding:0!important;
        border:1px solid #374151!important;border-radius:8px!important;background:#202528!important;overflow:hidden!important;
      }
      #eierSide .vet-eier-head,#eierSide .vet-dyr-head,#eierSide .vet-beh-head{
        width:100%!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;
        justify-content:space-between!important;gap:12px!important;text-align:left!important;padding:10px 12px!important;
        border:0!important;background:transparent!important;color:#f8fafc!important;cursor:pointer!important;font-size:14px!important;
        margin:0!important;min-height:0!important;line-height:1.25!important;
      }
      #eierSide .vet-eier-head:hover,#eierSide .vet-dyr-head:hover,#eierSide .vet-beh-head:hover{background:#26313a!important;}
      #eierSide .vet-eier-main,#eierSide .vet-dyr-main,#eierSide .vet-beh-main{display:flex!important;gap:10px!important;align-items:center!important;min-width:0!important;flex:1!important;}
      #eierSide .vet-eier-main strong,#eierSide .vet-dyr-main strong{font-size:16px!important;white-space:nowrap!important;}
      #eierSide .vet-meta{color:#cbd5e1!important;font-size:13px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
      #eierSide .vet-eier-count,#eierSide .vet-beh-sum{color:#f8fafc!important;font-size:13px!important;white-space:nowrap!important;}
      #eierSide .vet-dyr-liste{padding:6px 10px 10px!important;border-top:1px solid #374151!important;background:#151b20!important;}
      #eierSide .vet-dyr-kort{margin:5px 0!important;border:1px solid #1f6feb!important;border-radius:7px!important;background:#0f172a!important;overflow:hidden!important;}
      #eierSide .vet-behandling-panel{padding:10px!important;border-top:1px solid #1f6feb!important;background:#0b1220!important;}
      #eierSide .vet-panel-topp{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;gap:10px!important;flex-wrap:wrap!important;margin-bottom:8px!important;}
      #eierSide .vet-panel-knapper{display:flex!important;gap:6px!important;flex-wrap:wrap!important;}
      #eierSide .vet-panel-knapper button{width:auto!important;margin:0!important;padding:8px 10px!important;}
      #eierSide .vet-beh-wrap{margin:4px 0!important;}

      #eierSide .vet-beh-row{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;align-items:stretch!important;}
      #eierSide .vet-rediger-beh-knapp{margin:0!important;padding:8px 10px!important;white-space:nowrap!important;border-radius:6px!important;}
      #eierSide .vet-beh-head{border:1px solid #374151!important;border-radius:6px!important;background:#202528!important;}
      #eierSide .vet-beh-main{flex-direction:column!important;align-items:flex-start!important;gap:2px!important;}
      #eierSide .vet-tom{padding:9px 10px!important;color:#cbd5e1!important;font-size:14px!important;}

      #eierSide .vet-journal-apnet{
        margin:10px 0!important;padding:12px!important;border:2px solid #2563eb!important;border-radius:10px!important;
        background:#0f172a!important;color:#f8fafc!important;font-size:14px!important;line-height:1.35!important;clear:both!important;
      }
      #eierSide .vet-journal-topp{display:flex!important;justify-content:space-between!important;gap:8px!important;align-items:center!important;margin-bottom:8px!important;}
      #eierSide .vet-journal-lukk{width:auto!important;padding:7px 10px!important;}
      #eierSide .vet-journal-grid{display:grid!important;grid-template-columns:120px minmax(0,1fr)!important;gap:5px 12px!important;margin:8px 0!important;max-width:850px!important;}
      #eierSide .vet-journal-grid div:nth-child(odd){font-weight:700!important;color:#cbd5e1!important;}
      #eierSide .vet-journal-blokk{margin-top:8px!important;padding:8px!important;border:1px solid #374151!important;border-radius:8px!important;background:#111827!important;}
      #eierSide .vet-journal-bilderad{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin:8px 0 12px!important;padding:8px!important;border:1px solid #374151!important;border-radius:8px!important;background:#111827!important;}
      #eierSide .vet-journal-bilderad a{display:block!important;width:170px!important;text-decoration:none!important;color:inherit!important;}
      #eierSide .vet-journal-bilderad img{width:170px!important;height:120px!important;object-fit:cover!important;border-radius:8px!important;border:1px solid #374151!important;background:#020617!important;}
      #eierSide .vet-journal-bildetom{width:170px!important;height:120px!important;border:1px dashed #64748b!important;border-radius:8px!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#94a3b8!important;background:#020617!important;}
      #eierSide .vet-journal-inline-form #journalSide,#eierSide .vet-journal-inline-form #journalSide.skjult{display:block!important;}

      #eierSide .vet-beh-wrap .vet-journal-apnet{margin:4px 0 6px 0!important;padding:8px!important;border-width:1px!important;border-radius:6px!important;background:#101827!important;}
      #eierSide .vet-beh-wrap .vet-journal-topp{margin-bottom:4px!important;}
      #eierSide .vet-beh-wrap .vet-journal-bilderad{margin:4px 0 6px 0!important;padding:5px!important;}
      #eierSide .vet-beh-wrap .vet-journal-bilderad a{width:92px!important;}
      #eierSide .vet-beh-wrap .vet-journal-bilderad img{width:92px!important;height:68px!important;}
      #eierSide .vet-beh-wrap .vet-journal-grid{grid-template-columns:72px minmax(0,1fr)!important;gap:3px 8px!important;margin:5px 0!important;}
      #eierSide .vet-beh-wrap .vet-journal-blokk{margin-top:5px!important;padding:6px!important;}
      @media(max-width:700px){
        #eierSide .vet-eier-head,#eierSide .vet-dyr-head,#eierSide .vet-beh-head{flex-direction:column!important;align-items:flex-start!important;}
        #eierSide .vet-journal-grid{grid-template-columns:1fr!important;}
        #eierSide .vet-journal-bilderad a,#eierSide .vet-journal-bilderad img,#eierSide .vet-journal-bildetom{width:100%!important;height:auto!important;min-height:120px!important;}
      }
    `;
    document.head.appendChild(s);
  }

  async function hentJournalBilder(journalId){
    const j = finnJournal(journalId);
    let bilder = [];
    if (j) {
      bilder = [].concat(j.vet_journal_bilder || []).concat(j.bilder || []);
      ["bilde_url","url","foto_url","journalbilde_url","journal_bilde_url","image_url","bilde","foto"].forEach(k => {
        if (j[k]) bilder.push({ bilde_url:j[k], bildetekst:"Journalbilde" });
      });
    }
    if (bilder.length) return bilder;
    if (!journalId || !window.supabaseClient) return [];
    try {
      const r = await supabaseClient.from("vet_journal_bilder").select("*").eq("journal_id", journalId).order("created_at", { ascending:true });
      if (!r.error && Array.isArray(r.data)) return r.data;
    } catch(e) { console.warn("Kunne ikke hente journalbilder:", e); }
    return [];
  }
  async function hentJournalVarer(journalId){
    const j = finnJournal(journalId);
    if (j?.vet_journal_varer?.length) return j.vet_journal_varer;
    if (!journalId || !window.supabaseClient) return [];
    try {
      const r = await supabaseClient.from("vet_journal_varer").select("*").eq("journal_id", journalId);
      if (!r.error && Array.isArray(r.data)) return r.data;
    } catch(e) {}
    return [];
  }
  function bilderHtml(bilder, d){
    if (bilder && bilder.length) {
      const html = bilder.map(b => {
        const url = b.bilde_url || b.url || b.foto_url || b.image_url || "";
        if (!url) return "";
        return `<a href="${esc(url)}" target="_blank" rel="noopener">
          <img src="${esc(url)}" alt="${esc(b.bildetekst || b.filnavn || "Journalbilde")}">
          <span class="lite">${esc(b.bildetekst || b.filnavn || "")}</span>
        </a>`;
      }).join("");
      if (html) return `<div class="vet-journal-bilderad">${html}</div>`;
    }
    const profil = dyrBildeUrl(d);
    if (profil) {
      return `<div class="vet-journal-bilderad"><a href="${esc(profil)}" target="_blank" rel="noopener">
        <img src="${esc(profil)}" alt="${esc(d?.navn || "Journalbilde")}">
        <span class="lite">Profilbilde / journalbilde</span>
      </a></div>`;
    }
    return `<div class="vet-journal-bilderad"><div class="vet-journal-bildetom">Ingen bilder lagret</div></div>`;
  }
  async function journalHtml(journalPost, tittel){
    if (!journalPost) {
      return `<div class="vet-journal-apnet">
        <div class="vet-journal-topp"><strong>${esc(tittel || "Journal")}</strong><button type="button" class="secondary vet-journal-lukk" onclick="this.closest('.vet-journal-apnet')?.remove()">Lukk</button></div>
        <div class="vet-journal-blokk">Ingen tidligere behandling finnes.</div>
      </div>`;
    }
    const d = finnDyr(journalPost.dyr_id || journalPost.vet_dyr?.id) || journalPost.vet_dyr || {};
    const e = finnEier(eierIdForDyr(d) || journalPost.dyreeier_id) || d.vet_dyreeiere || {};
    const bilder = await hentJournalBilder(journalPost.id);
    const varer = await hentJournalVarer(journalPost.id);
    const varerDel = varer.length ? `<div class="vet-journal-blokk"><strong>Varer / medisiner</strong><ul>${varer.map(v => {
      const ant = Number(v.antall || 0), pris = Number(v.pris || 0), sum = Number(v.sum_eks_mva || (ant * pris));
      return `<li>${esc(v.varenavn || v.navn || "Vare")} - ${esc(ant)} x ${esc(kr(pris))} kr = ${esc(kr(sum))} kr</li>`;
    }).join("")}</ul></div>` : "";
    return `<div class="vet-journal-apnet">
      <div class="vet-journal-topp"><strong>${esc(tittel || "Journal")}</strong><div class="vet-panel-knapper"><button type="button" onclick="return vetSamletRedigerBehandling('${esc(journalPost.id)}', event)">Rediger behandling</button><button type="button" class="secondary vet-journal-lukk" onclick="this.closest('.vet-journal-apnet')?.remove()">Lukk</button></div></div>
      <div class="vet-journal-blokk" style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;"><strong>Åpnet tidligere behandling</strong><button type="button" onclick="return vetSamletRedigerBehandling('${esc(journalPost.id)}', event)">Rediger denne behandlingen</button></div>
      <strong>Bilder</strong>${bilderHtml(bilder, d)}
      <div class="vet-journal-grid">
        <div>Dato</div><div>${esc(datoNo(journalPost.dato))}</div>
        <div>Dyr</div><div>${esc(d.navn || "")}</div>
        <div>Eier</div><div>${esc(e.navn || "")}</div>
        <div>Type</div><div>${esc(journalPost.type || "Behandling")}</div>
        <div>Behandler</div><div>${esc((typeof finnBehandlerNavnForJournal === "function" ? finnBehandlerNavnForJournal(journalPost) : "") || "")}</div>
      </div>
      <div class="vet-journal-blokk"><strong>Journalnotat</strong><div class="lite" style="white-space:normal;margin-top:4px;">${esc(journalPost.notat || "Ingen journalnotat skrevet.").replace(/\n/g,"<br>")}</div></div>
      ${journalPost.medisin_kladd ? `<div class="vet-journal-blokk"><strong>Medisin / reseptkladd</strong><div class="lite">${esc(journalPost.medisin_kladd).replace(/\n/g,"<br>")}</div></div>` : ""}
      <div class="vet-journal-blokk"><strong>Pris / kjøring</strong><br>
        <span class="lite">Fastpris: ${esc(kr(journalPost.fastpris || 0))} kr | Timer: ${esc(journalPost.timer || 0)} x ${esc(kr(journalPost.timepris || 0))} kr | Kjøring: ${esc(journalPost.km || 0)} km x ${esc(kr(journalPost.km_pris || 0))} kr | Sum: ${esc(kr(journalPost.belop_eks_mva || 0))} kr eks. mva</span>
      </div>${varerDel}
    </div>`;
  }

  async function apneTidligereBehandling(journalId, trigger){
    cssOnce();
    const j = finnJournal(journalId);
    if (!j) return false;

    // Finn alltid raden som ble klikket. Hvis listen ble tegnet på nytt, åpne riktig eier/dyr først.
    let host = trigger && trigger.closest ? trigger.closest(".vet-beh-wrap") : null;
    if (!host) host = qs("vetBehWrap_" + String(journalId));
    if (!host) {
      const dyrId = String(j?.dyr_id || j?.vet_dyr?.id || "");
      const d = finnDyr(dyrId);
      if (d) {
        valgtEierId = String(eierIdForDyr(d) || "");
        valgtDyrId = String(d.id || "");
        byggPasienter();
        host = qs("vetBehWrap_" + String(journalId));
      }
    }
    if (!host) { alert("Finner ikke riktig behandlingsrad. Trykk på dyret på nytt og prøv igjen."); return false; }

    // Fjern bare åpne journalbokser i samme dyrepanel. Ikke legg noe nederst i pasientlisten.
    const panel = host.closest(".vet-behandling-panel") || host.parentElement || host;
    panel.querySelectorAll(".vet-journal-apnet:not(.vet-journal-inline-form)").forEach(x => x.remove());

    const tmp = document.createElement("div");
    tmp.className = "vet-journal-apnet";
    tmp.innerHTML = '<div class="lite">Henter journal og bilder ...</div>';
    host.appendChild(tmp);
    tmp.outerHTML = await journalHtml(j, "Tidligere behandling");
    const opened = host.querySelector(".vet-journal-apnet");
    if (opened) opened.scrollIntoView({ behavior:"smooth", block:"nearest" });
    return false;
  }

  function flyttJournalTil(host){
    const side = qs("journalSide");
    if (!side) { alert("Finner ikke journalbildet/journalSide i index.html."); return null; }
    if (!journalOriginalParent) { journalOriginalParent = side.parentNode; journalOriginalNext = side.nextSibling; }
    host.querySelectorAll(".vet-journal-inline-form").forEach(x => x.remove());
    const wrap = document.createElement("div");
    wrap.className = "vet-journal-apnet vet-journal-inline-form";
    wrap.innerHTML = `<div class="vet-journal-topp">
      <strong>Ny behandling</strong>
      <button type="button" class="secondary vet-journal-lukk" onclick="window.vetLukkNyBehandlingInline()">Lukk</button>
    </div>
    <div id="vetForrigeBehandlingInline" class="vet-journal-blokk">Henter forrige behandling ...</div>`;
    host.appendChild(wrap);
    wrap.appendChild(side);
    side.classList.remove("skjult");
    side.style.display = "block";
    return wrap;
  }
  window.vetLukkNyBehandlingInline = function(){
    const side = qs("journalSide");
    if (side && journalOriginalParent) {
      side.classList.add("skjult"); side.style.display = "none";
      if (journalOriginalNext) journalOriginalParent.insertBefore(side, journalOriginalNext);
      else journalOriginalParent.appendChild(side);
    }
    document.querySelectorAll(".vet-journal-inline-form").forEach(x => x.remove());
  };
  async function apneNyBehandling(dyrId){
    cssOnce();
    const d = finnDyr(dyrId);
    if (!d) return false;
    const eid = eierIdForDyr(d);
    if (!eid) { alert("Dette dyret mangler sikker eierkobling. Rediger dyret og velg riktig dyreeier først."); return false; }
    valgtEierId = String(eid); valgtDyrId = String(d.id || "");

    // Ny behandling skal IKKE åpnes inne i pasientlisten. Det laget blinking og mobilrot.
    // Den åpner den vanlige Journal-siden og fyller inn eier + dyr.
    try { window.vetRedigerJournalId = ""; } catch(e) {}
    try { if (typeof window.vetLukkNyBehandlingInline === "function") window.vetLukkNyBehandlingInline(); } catch(e) {}
    try { if (typeof window.visVetSide === "function") window.visVetSide("journalSide"); else if (typeof visVetSide === "function") visVetSide("journalSide"); } catch(e) {}

    // Fyll etter at siden er vist. Denne er bevisst robust, fordi flere filer fyller
    // journal-rullefeltene på nytt. Først tvinger vi journalSide synlig, så setter vi
    // dyreeier, bygger dyrelisten, og setter dyr etterpå.
    setTimeout(function(){
      const side = qs("journalSide");
      if (side) {
        try {
          document.querySelectorAll("#klinikkSide,#eierSide,#dyrSide,#prisSide,#lagerSide,#journalSide,#fakturaSide,#okonomiSide,#backupSide,#lagerLoggSide,#journalLoggSide,#vetJournalApningsloggSide").forEach(el => {
            el.classList.add("skjult");
            el.style.display = "none";
          });
        } catch(e) {}
        side.classList.remove("skjult");
        side.style.display = "";
      }

      try { if (typeof fyllJournalDyreeierValg === "function") fyllJournalDyreeierValg(); } catch(e) {}
      setv("journalDyreeierValg", eid);
      try {
        const eierValg = qs("journalDyreeierValg");
        if (eierValg) eierValg.dispatchEvent(new Event("change", { bubbles:true }));
      } catch(e) {}

      setTimeout(function(){
        try { if (typeof fyllDyrValg === "function") fyllDyrValg(); } catch(e) {}
        setv("journalDyrValg", d.id);
        try {
          const dyrValg = qs("journalDyrValg");
          if (dyrValg) dyrValg.dispatchEvent(new Event("change", { bubbles:true }));
        } catch(e) {}

        setv("journalDato", new Date().toISOString().slice(0,10));
        ["journalNotat","journalMedisin","journalMedisinKladd","journalBildeTekst","journalVareNavn","journalVarePris"].forEach(id => setv(id, ""));
        ["journalFastpris","journalTimepris","journalTimer","journalKm"].forEach(id => setv(id, ""));
        try { if (typeof settStandardKmPrisFraKlinikk === "function") settStandardKmPrisFraKlinikk(); } catch(e) {}
        try { if (typeof fyllPrisValg === "function") fyllPrisValg(); } catch(e) {}
        try { if (typeof fyllJournalBilValg === "function") fyllJournalBilValg(); } catch(e) {}
        try { if (typeof fyllJournalBilVareValg === "function") fyllJournalBilVareValg(); } catch(e) {}
        try { if (typeof oppdaterJournalSum === "function") oppdaterJournalSum(); } catch(e) {}

        const btn = qs("lagreJournalKnapp");
        if (btn) btn.textContent = "Lagre journal";
        const h = qs("journalSide")?.querySelector("h2");
        if (h) h.textContent = "Ny behandling";
        const msg = qs("journalMelding");
        if (msg) msg.textContent = "Ny behandling for " + (d.navn || "valgt dyr") + ".";
        if (side) side.scrollIntoView({ behavior:"smooth", block:"start" });
        const notat = qs("journalNotat");
        if (notat) notat.focus();
      }, 50);
    }, 120);
    return false;
  }


  function sumFraJournalSkjema(){
    const fast = Number(qs("journalFastpris")?.value || 0);
    const timer = Number(qs("journalTimer")?.value || 0);
    const timepris = Number(qs("journalTimepris")?.value || 0);
    const km = Number(qs("journalKm")?.value || 0);
    const kmpris = Number(qs("journalKmPris")?.value || 0);
    return fast + (timer * timepris) + (km * kmpris);
  }

  function settRedigeringsmodus(journalId){
    window.vetRedigerJournalId = String(journalId || "");
    const btn = qs("lagreJournalKnapp");
    if (btn) btn.textContent = window.vetRedigerJournalId ? "Lagre endring" : "Lagre journal";
    const msg = qs("journalMelding");
    if (msg && window.vetRedigerJournalId) msg.textContent = "Redigerer eksisterende behandling. Nye bilder kan fortsatt legges til som ny opplasting senere.";
  }

  async function apneRedigerBehandling(journalId, trigger){
    cssOnce();
    const j = finnJournal(journalId);
    if (!j) { alert("Fant ikke behandlingen som skal redigeres."); return false; }

    const dyrId = String(j.dyr_id || j.vet_dyr?.id || "");
    const d = finnDyr(dyrId) || j.vet_dyr || {};
    const eid = String(eierIdForDyr(d) || j.dyreeier_id || "");
    valgtEierId = eid;
    valgtDyrId = dyrId;

    // Redigering åpner samme journalbilde som Ny behandling, men med eksisterende verdier.
    try { if (typeof window.vetLukkNyBehandlingInline === "function") window.vetLukkNyBehandlingInline(); } catch(e) {}
    try { if (typeof window.visVetSide === "function") window.visVetSide("journalSide"); else if (typeof visVetSide === "function") visVetSide("journalSide"); } catch(e) {}

    setTimeout(function(){
      const side = qs("journalSide");
      if (side) {
        try {
          document.querySelectorAll("#klinikkSide,#eierSide,#dyrSide,#prisSide,#lagerSide,#journalSide,#fakturaSide,#okonomiSide,#backupSide,#lagerLoggSide,#journalLoggSide,#vetJournalApningsloggSide").forEach(el => {
            el.classList.add("skjult");
            el.style.display = "none";
          });
        } catch(e) {}
        side.classList.remove("skjult");
        side.style.display = "";
      }

      try { if (typeof fyllJournalDyreeierValg === "function") fyllJournalDyreeierValg(); } catch(e) {}
      setv("journalDyreeierValg", eid);
      try {
        const eierValg = qs("journalDyreeierValg");
        if (eierValg) eierValg.dispatchEvent(new Event("change", { bubbles:true }));
      } catch(e) {}

      setTimeout(function(){
        try { if (typeof fyllDyrValg === "function") fyllDyrValg(); } catch(e) {}
        setv("journalDyrValg", dyrId);
        try {
          const dyrValg = qs("journalDyrValg");
          if (dyrValg) dyrValg.dispatchEvent(new Event("change", { bubbles:true }));
        } catch(e) {}

        setv("journalDato", String(j.dato || "").slice(0,10) || new Date().toISOString().slice(0,10));
        setv("journalNotat", j.notat || "");
        setv("journalMedisin", j.medisin_kladd || "");
        setv("journalMedisinKladd", j.medisin_kladd || "");
        setv("journalFastpris", j.fastpris || 0);
        setv("journalTimepris", j.timepris || 0);
        setv("journalTimer", j.timer || 0);
        setv("journalKm", j.km || 0);
        setv("journalKmPris", j.km_pris || 0);
        setv("journalBildeTekst", "");

        try { if (typeof fyllPrisValg === "function") fyllPrisValg(); } catch(e) {}
        try { if (typeof fyllJournalBilValg === "function") fyllJournalBilValg(); } catch(e) {}
        try { if (typeof fyllJournalBilVareValg === "function") fyllJournalBilVareValg(); } catch(e) {}
        try { if (typeof oppdaterJournalSum === "function") oppdaterJournalSum(); } catch(e) {}

        settRedigeringsmodus(j.id);
        const h = qs("journalSide")?.querySelector("h2");
        if (h) h.textContent = "Rediger behandling";
        const msg = qs("journalMelding");
        if (msg) msg.textContent = "Redigerer tidligere behandling. Trykk Lagre endring når du er ferdig.";
        const notat = qs("journalNotat");
        if (notat) notat.focus();
        if (side) side.scrollIntoView({ behavior:"smooth", block:"start" });
      }, 80);
    }, 120);
    return false;
  }

  async function lagreRedigertJournal(ev){
    const journalId = String(window.vetRedigerJournalId || "");
    if (!journalId) return true;
    if (ev) { try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch(e) {} }
    const j = finnJournal(journalId);
    if (!j) { alert("Fant ikke journalen som skulle redigeres."); return false; }
    const rad = {
      dato: qs("journalDato")?.value || j.dato || new Date().toISOString().slice(0,10),
      dyr_id: qs("journalDyrValg")?.value || j.dyr_id || j.vet_dyr?.id || null,
      notat: qs("journalNotat")?.value || "",
      medisin_kladd: qs("journalMedisin")?.value || "",
      fastpris: Number(qs("journalFastpris")?.value || 0),
      timepris: Number(qs("journalTimepris")?.value || 0),
      timer: Number(qs("journalTimer")?.value || 0),
      km: Number(qs("journalKm")?.value || 0),
      km_pris: Number(qs("journalKmPris")?.value || 0)
    };
    rad.belop_eks_mva = sumFraJournalSkjema() || Number(j.belop_eks_mva || 0);

    const msg = qs("journalMelding");
    if (msg) msg.textContent = "Lagrer endring ...";
    try {
      const { error } = await supabaseClient.from("vet_journal").update(rad).eq("id", journalId);
      if (error) throw error;
      Object.assign(j, rad);
      window.vetRedigerJournalId = "";
      const btn = qs("lagreJournalKnapp");
      if (btn) btn.textContent = "Lagre journal";
      const h = qs("journalSide")?.querySelector("h2");
      if (h) h.textContent = "Journal / behandling";
      if (msg) msg.textContent = "Endringen er lagret.";
      try { if (typeof lastVetData === "function") await lastVetData(); } catch(e) {}
      try { byggPasienter(); } catch(e) {}
      return false;
    } catch(e) {
      if (msg) msg.textContent = "Kunne ikke lagre endring: " + (e?.message || e);
      else alert("Kunne ikke lagre endring: " + (e?.message || e));
      return false;
    }
  }

  function kobleRedigerLagring(){
    const btn = qs("lagreJournalKnapp");
    if (!btn || btn.dataset.vetEditHook === "1") return;
    btn.dataset.vetEditHook = "1";
    btn.addEventListener("click", function(ev){
      if (window.vetRedigerJournalId) return lagreRedigertJournal(ev);
      return true;
    }, true);
  }

  function behandlingPanel(d){
    const linjer = journalForDyr(d.id);
    return `<div id="vetBehandlingPanel_${esc(d.id)}" class="vet-behandling-panel">
      <div class="vet-panel-topp">
        <div><strong>${esc(d.navn || "Dyr")} - tidligere behandlinger</strong>
          <div class="lite">Eier: ${esc(finnEier(eierIdForDyr(d))?.navn || "")} | ${esc(d.art || "")} | ${esc(d.rase || "")}</div>
        </div>
        <div class="vet-panel-knapper">
          <button type="button" onclick="return vetSamletNyBehandling('${esc(d.id)}')">Ny behandling</button>
          <button type="button" class="secondary" onclick="try{redigerDyr('${esc(d.id)}')}catch(e){}">Rediger dyr</button>
        </div>
      </div>
      ${linjer.length ? linjer.map(j => {
        const tekst = String(j.notat || j.medisin_kladd || j.type || "").replace(/\s+/g," ").trim();
        const sum = Number(j.belop_eks_mva || 0) * 1.25;
        return `<div id="vetBehWrap_${esc(j.id)}" class="vet-beh-wrap">
          <div class="vet-beh-row">
            <button type="button" class="vet-beh-head" onclick="event.preventDefault();event.stopPropagation();return vetSamletApneJournal('${esc(j.id)}', event)">
              <div class="vet-beh-main"><strong>${esc(datoNo(j.dato))} · ${esc(j.type || "Behandling")}</strong><span class="vet-meta">${esc(tekst ? (tekst.length > 130 ? tekst.slice(0,130) + "..." : tekst) : "Ingen notattekst")}</span></div>
              <span class="vet-beh-sum">${sum ? esc(kr(sum)) + " kr" : ""}</span>
            </button>
            <button type="button" class="secondary vet-rediger-beh-knapp" onclick="return vetSamletRedigerBehandling('${esc(j.id)}', event)">Rediger</button>
          </div>
        </div>`;
      }).join("") : '<div class="vet-tom">Ingen behandlinger på dette dyret ennå.</div>'}
    </div>`;
  }
  function byggPasienter(){
    const side = qs("eierSide");
    if (!side) return;
    cssOnce();
    const html = eiere().map(e => {
      const eId = String(e.id || "");
      const apen = valgtEierId === eId;
      const mineDyr = dyrForEier(eId);
      return `<div class="vet-eier-kort">
        <button type="button" class="vet-eier-head" onclick="return vetSamletVelgEier('${esc(eId)}')">
          <div class="vet-eier-main"><strong>${esc(e.navn || "Uten navn")}</strong><span class="vet-meta">${esc(e.telefon || "")} ${e.epost ? " | " + esc(e.epost) : ""}</span></div>
          <span class="vet-eier-count">${mineDyr.length} dyr</span>
        </button>
        ${apen ? `<div class="vet-dyr-liste">
          ${mineDyr.length ? mineDyr.map(d => {
            const dId = String(d.id || "");
            const valgt = valgtDyrId === dId;
            return `<div class="vet-dyr-kort">
              <button type="button" class="vet-dyr-head" onclick="return vetSamletVelgDyr('${esc(dId)}')">
                <div class="vet-dyr-main"><strong>${esc(d.navn || "Uten navn")}</strong><span class="vet-meta">${esc(d.art || "")} ${d.rase ? " | " + esc(d.rase) : ""}</span></div>
                <span class="vet-eier-count">${journalForDyr(dId).length} beh.</span>
              </button>
              ${valgt ? behandlingPanel(d) : ""}
            </div>`;
          }).join("") : '<div class="vet-tom">Ingen dyr registrert på denne eieren.</div>'}
        </div>` : ""}
      </div>`;
    }).join("");
    side.innerHTML = `<h2>Dyreeiere</h2>
      <div class="vet-ren-toolbar">
        <button type="button" class="secondary" onclick="return vetSamletOppdater()">Oppdater</button>
        <button type="button" class="secondary" onclick="try{nyDyreeier()}catch(e){visVetSide('dyrSide')}">Ny dyreeier</button>
        <button type="button" class="secondary" onclick="try{nyDyr()}catch(e){visVetSide('dyrSide')}">Nytt dyr</button>
      </div>
      <div>${html || '<div class="vet-tom">Ingen dyreeiere funnet.</div>'}</div>
      <input id="dyreeierId" type="hidden"><input id="dyreeierVelgForDyr" type="hidden"><div id="dyreeierMelding" class="melding"></div>`;
  }

  window.vetSamletVelgEier = function(eierId){ valgtEierId = valgtEierId === String(eierId) ? "" : String(eierId || ""); valgtDyrId = ""; byggPasienter(); return false; };
  window.vetSamletVelgDyr = function(dyrId){ const d = finnDyr(dyrId); if (!d) return false; valgtEierId = String(eierIdForDyr(d) || ""); valgtDyrId = valgtDyrId === String(dyrId) ? "" : String(dyrId || ""); byggPasienter(); return false; };
  window.vetSamletApneJournal = function(journalId, ev){ if (ev) { try{ev.preventDefault();ev.stopPropagation();}catch(e){} } apneTidligereBehandling(journalId, ev?.currentTarget || null); return false; };
  window.vetSamletRedigerBehandling = function(journalId, ev){ if (ev) { try{ev.preventDefault();ev.stopPropagation();}catch(e){} } apneRedigerBehandling(journalId, ev?.currentTarget || null); return false; };
  window.vetSamletNyBehandling = function(dyrId){ apneNyBehandling(dyrId); return false; };
  window.vetSamletOppdater = async function(){ try { if (typeof lastDyreeiere === "function") await lastDyreeiere(); } catch(e) {} try { if (typeof lastDyr === "function") await lastDyr(); } catch(e) {} try { if (typeof lastJournal === "function") await lastJournal(); } catch(e) {} byggPasienter(); return false; };

  window.vetRenNyBehandling = window.vetSamletNyBehandling;
  window.vetToggleInlineBehandling = window.vetSamletApneJournal;
  window.vetApneEksisterendeBehandling = window.vetSamletApneJournal;

  const gammelVisVetSide = window.visVetSide || (typeof visVetSide === "function" ? visVetSide : null);
  window.visVetSide = function(id){
    if (id === "eierSide") {
      if (gammelVisVetSide) gammelVisVetSide.call(this, id);
      setTimeout(byggPasienter, 0);
      return;
    }
    return gammelVisVetSide ? gammelVisVetSide.call(this, id) : undefined;
  };
  try { visVetSide = window.visVetSide; } catch(e) {}

  function init(){
    cssOnce();
    kobleRedigerLagring();
    const eierSide = qs("eierSide");
    if (eierSide && !eierSide.classList.contains("skjult") && eierSide.style.display !== "none") byggPasienter();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
  window.addEventListener("load", () => setTimeout(init, 300));
})();
