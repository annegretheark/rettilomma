/* ===== SMAL MIN BIL / FYLL BIL LISTE FINAL 09.06 =====
   Lastes helt sist. Gjør listene kompakte, fjerner .00 på antall
   og tegner kun én linje per vare_id selv om gamle funksjoner prøver å tegne flere.
*/
(function () {
  function $(id) { return document.getElementById(id); }

  function esc(verdi) {
    return String(verdi ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function arr(navn) {
    try { return Function("return (typeof " + navn + " !== 'undefined' ? " + navn + " : [])")() || []; }
    catch (e) { return []; }
  }

  function tekst(id) {
    if (typeof vetTekst === "function") return vetTekst(id);
    return String($(id)?.value || "").trim();
  }

  function antallFmt(verdi) {
    const n = Number(verdi || 0);
    if (!Number.isFinite(n)) return "0";
    return Math.round(n).toLocaleString("nb-NO", { maximumFractionDigits: 0 });
  }

  function hentVare(vareId) {
    return arr("vetVarer").find(v => String(v.id) === String(vareId)) || {};
  }

  function valgtMinBilIdFinal() {
    if (typeof valgtMinBilId === "function") return valgtMinBilId();
    return tekst("minBilValg");
  }

  function unikeHovedlagerRader() {
    const map = new Map();
    arr("vetHovedlager")
      .filter(r => Number(r.antall || 0) > 0)
      .forEach(r => {
        const key = String(r.vare_id || "");
        if (!key) return;
        const gammel = map.get(key);
        const vare = r.vet_varer || hentVare(r.vare_id) || {};
        if (!gammel) map.set(key, { ...r, vare });
        else map.set(key, { ...gammel, antall: Number(gammel.antall || 0) + Number(r.antall || 0), vare: gammel.vare || vare });
      });
    return Array.from(map.values()).filter(r => r.vare?.navn);
  }

  function listeHtml(rader, prefix, inputClass, checkboxClass) {
    if (!rader.length) return '<p class="lite">Ingen varer på hovedlager.</p>';

    return `
      <div class="vet-smal-vareliste">
        <div class="vet-smal-header">
          <span></span><span>Vare / medisin</span><span>Lager</span><span>Antall</span>
        </div>
        ${rader.map(r => {
          const v = r.vare || {};
          const id = esc(r.vare_id);
          const navn = esc(v.navn || "Vare");
          const enhet = esc(v.enhet || "stk");
          const maks = Math.floor(Number(r.antall || 0));
          return `
            <label for="${prefix}_velg_${id}" class="vet-smal-rad">
              <input id="${prefix}_velg_${id}" class="${checkboxClass}" data-vare-id="${id}" type="checkbox">
              <span class="vet-smal-navn" title="${navn}">${navn}</span>
              <span class="vet-smal-lager">${antallFmt(r.antall)} ${enhet}</span>
              <input id="${prefix}_antall_${id}" class="${inputClass}" data-vare-id="${id}" type="number" step="1" min="1" max="${maks}" placeholder="0" value="" onclick="event.stopPropagation();">
            </label>`;
        }).join("")}
      </div>`;
  }

  function tegnFyllBilFyllListeSmal() {
    const liste = $("fyllBilFyllListe");
    if (!liste) return;
    liste.innerHTML = listeHtml(unikeHovedlagerRader(), "fyllbil", "fyllbil-antall", "fyllbil-velg");
  }

  function tegnMinBilFyllListeSmal() {
    const liste = $("minBilFyllListe");
    const info = $("minBilInfo");
    if (!liste) return;

    const bilId = valgtMinBilIdFinal();
    if (!bilId) {
      liste.innerHTML = "";
      if (info) info.textContent = "Velg bil først.";
      return;
    }

    liste.innerHTML = listeHtml(unikeHovedlagerRader(), "minbil", "minbil-antall", "minbil-velg");
  }

  function tegnMinBilInnholdSmal() {
    const liste = $("minBilInnholdListe");
    if (!liste) return;

    const bilId = valgtMinBilIdFinal();
    if (!bilId) {
      liste.innerHTML = '<p class="lite">Ingen bil valgt.</p>';
      return;
    }

    const map = new Map();
    arr("vetBilLager")
      .filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0)
      .forEach(r => {
        const key = String(r.vare_id || "");
        if (!key) return;
        const gammel = map.get(key);
        const vare = r.vet_varer || hentVare(r.vare_id) || {};
        if (!gammel) map.set(key, { ...r, vare });
        else map.set(key, { ...gammel, antall: Number(gammel.antall || 0) + Number(r.antall || 0), vare: gammel.vare || vare });
      });

    const rader = Array.from(map.values());
    if (!rader.length) {
      liste.innerHTML = '<p class="lite">Bilen er tom.</p>';
      return;
    }

    liste.innerHTML = `
      <div class="vet-smal-vareliste">
        <div class="vet-smal-header" style="grid-template-columns:minmax(180px,2fr) 90px;">
          <span>Vare / medisin</span><span>På bil</span>
        </div>
        ${rader.map(r => {
          const v = r.vare || {};
          return `
            <div class="vet-smal-rad" style="grid-template-columns:minmax(180px,2fr) 90px;cursor:default;">
              <span class="vet-smal-navn">${esc(v.navn || "Vare")}</span>
              <span class="vet-smal-lager">${antallFmt(r.antall)} ${esc(v.enhet || "stk")}</span>
            </div>`;
        }).join("")}
      </div>`;
  }

  function leggInnCss() {
    if ($("vetSmalListeCss")) return;
    const style = document.createElement("style");
    style.id = "vetSmalListeCss";
    style.textContent = `
      .vet-smal-vareliste{display:grid;gap:1px;margin-top:8px;font-size:13px;}
      .vet-smal-header,.vet-smal-rad{display:grid;grid-template-columns:26px minmax(150px,2fr) 88px 72px;gap:6px;align-items:center;}
      .vet-smal-header{padding:3px 6px;background:#111827;border:1px solid #374151;font-weight:bold;color:#f8fafc;min-height:24px;}
      .vet-smal-rad{padding:2px 6px;border:1px solid #374151;background:#1f2427;cursor:pointer;min-height:28px;}
      .vet-smal-rad input[type="checkbox"]{width:16px;height:16px;margin:0;}
      .vet-smal-rad input[type="number"]{width:64px;height:24px;margin:0;padding:2px 5px;font-size:13px;border-radius:5px;}
      .vet-smal-navn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f3f4f6;}
      .vet-smal-lager{white-space:nowrap;color:#cbd5e1;font-size:12px;}
      @media(max-width:620px){
        .vet-smal-header,.vet-smal-rad{grid-template-columns:24px minmax(120px,1fr) 70px 62px;gap:4px;padding-left:4px;padding-right:4px;}
        .vet-smal-rad input[type="number"]{width:56px;}
      }
    `;
    document.head.appendChild(style);
  }

  function tegnAlleSmaleLister() {
    leggInnCss();
    tegnFyllBilFyllListeSmal();
    tegnMinBilFyllListeSmal();
    tegnMinBilInnholdSmal();
  }

  window.tegnFyllBilFyllListe = tegnFyllBilFyllListeSmal;
  window.tegnMinBilFyllListe = tegnMinBilFyllListeSmal;
  window.tegnMinBilInnhold = tegnMinBilInnholdSmal;

  const gammelFyllMinBilSide = window.fyllMinBilSide;
  if (typeof gammelFyllMinBilSide === "function") {
    window.fyllMinBilSide = function () {
      const r = gammelFyllMinBilSide.apply(this, arguments);
      setTimeout(tegnAlleSmaleLister, 0);
      return r;
    };
  }

  const gammelLastVetLagerAlt = window.lastVetLagerAlt;
  if (typeof gammelLastVetLagerAlt === "function") {
    window.lastVetLagerAlt = async function () {
      const r = await gammelLastVetLagerAlt.apply(this, arguments);
      setTimeout(tegnAlleSmaleLister, 0);
      return r;
    };
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(tegnAlleSmaleLister, 500));
  window.addEventListener("load", () => setTimeout(tegnAlleSmaleLister, 500));
  setTimeout(tegnAlleSmaleLister, 1200);
  setTimeout(tegnAlleSmaleLister, 2500);
})();
