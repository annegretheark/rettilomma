/* RIL 20260705: Stabil Min bil for vanlig bruker.
   - Skjuler gamle/doble Min bil-renderinger som ga blinking.
   - Viser vanlig bruker kun valgt/egen bil.
   - Henter varer på bil direkte fra hand_bil_lager + hand_vare.
   - Viser varepris fra alle kjente prisfelt, ikke bare pris.
*/
(function () {
  'use strict';
  if (window.__rilMinBilStabilizerLoaded) return;
  window.__rilMinBilStabilizerLoaded = true;

  const STYLE_ID = 'ril-minbil-stabilizer-css';
  const STABLE_BOX_ID = 'rilMinBilStabilBox';
  let renderTimer = null;
  let lastCarHtml = '';
  let lastItemsHtml = '';
  let renderSeq = 0;

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = Number(String(v).trim().replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  function firstPositive() {
    for (const v of arguments) {
      const n = num(v);
      if (n > 0) return n;
    }
    return 0;
  }
  function money(v) { return num(v).toFixed(2); }
  function carName(c) { return c?.navn || c?.name || c?.bilnavn || c?.bil_navn || 'Bil'; }
  function carReg(c) { return c?.regnr || c?.registreringsnummer || c?.reg || ''; }
  function carText(c) { return [carName(c), carReg(c)].filter(Boolean).join(' - '); }
  function vareNr(v) { return v?.varenr || v?.vare_nr || v?.artikkelnummer || v?.produktnummer || v?.sku || ''; }
  function vareName(v, row) {
    const nr = vareNr(v) || row?.varenr || row?.vare_nr || '';
    const navn = v?.navn || v?.varenavn || v?.beskrivelse || row?.varenavn || row?.vare_navn || row?.navn || 'Vare';
    return { nr, navn };
  }
  function varePris(v) {
    return firstPositive(
      v?.pris, v?.utpris, v?.utsalgspris, v?.salgspris, v?.varepris,
      v?.pris_ut, v?.ut_pris, v?.enhetspris, v?.unit_price, v?.prisEksMva,
      v?.pris_eks_mva, v?.pris_inn, v?.innpris
    );
  }
  function db() { return window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null); }
  function isAdminMode() {
    const role = String(window.innloggetRolle || window.handRolle || localStorage.getItem('innloggetRolle') || localStorage.getItem('handRolle') || '').toLowerCase();
    return (window.erAdmin === true || role === 'admin' || role === 'sysadmin') && localStorage.getItem('rilAdminModus') === 'ja';
  }
  function userEmail() {
    return String(window.innloggetEpost || window.handInnloggetEpost || localStorage.getItem('innloggetEpost') || localStorage.getItem('handInnloggetEpost') || '').toLowerCase();
  }
  function userAnsattId() { return String(window.innloggetAnsattId || localStorage.getItem('innloggetAnsattId') || ''); }
  async function firmaId() {
    try { if (typeof window.hentInnloggetFirmaIdForBiler === 'function') return await window.hentInnloggetFirmaIdForBiler(); } catch (_) {}
    try { if (typeof window.hentAktivFirmaId === 'function') return window.hentAktivFirmaId(); } catch (_) {}
    return window.aktivFirmaId || window.handFirmaId || localStorage.getItem('aktivFirmaId') || localStorage.getItem('handFirmaId') || localStorage.getItem('firma_id') || localStorage.getItem('firmaId') || '';
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #rilSynligBilRegisterListe{display:none!important;visibility:hidden!important;}
      body:not(.ril-admin-mode) .kun-admin-biltekst{display:none!important;visibility:hidden!important;}
      #${STABLE_BOX_ID}{display:block!important;visibility:visible!important;}
      #${STABLE_BOX_ID} table{width:100%;border-collapse:collapse;}
      #${STABLE_BOX_ID} th,#${STABLE_BOX_ID} td{padding:8px;border-top:1px solid rgba(255,255,255,.12);text-align:left;}
      #${STABLE_BOX_ID} .ril-valgt-bil{background:rgba(34,197,94,.14);outline:2px solid rgba(34,197,94,.6);}
    `;
    document.head.appendChild(s);
  }

  function ensureStableBox() {
    ensureStyle();
    let box = $(STABLE_BOX_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = STABLE_BOX_ID;
    }
    const old = $('rilSynligBilRegisterListe') || $('bilListe');
    const side = $('bilerSide') || document.body;
    const hr = side.querySelector('hr');
    if (old && old.parentNode && box.parentNode !== old.parentNode) old.parentNode.insertBefore(box, old.nextSibling);
    else if (hr && hr.parentNode && !box.parentNode) hr.parentNode.insertBefore(box, hr);
    else if (!box.parentNode) side.prepend(box);
    box.hidden = false;
    box.style.display = 'block';
    box.style.visibility = 'visible';
    return box;
  }

  async function fetchTable(table, filterFn) {
    const cli = db();
    if (!cli) return [];
    try {
      let q = cli.from(table).select('*');
      if (filterFn) q = filterFn(q) || q;
      const r = await q.limit(1000);
      if (r.error) { console.warn('Min bil: kunne ikke hente ' + table, r.error); return []; }
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) { console.warn('Min bil: feil ved henting av ' + table, e); return []; }
  }

  function carsFromSelect() {
    const s = $('bilLagerBilValg') || $('bilValg') || $('lagerBilValg');
    if (!s) return [];
    return Array.from(s.options || []).filter(o => o.value).map(o => {
      const txt = (o.textContent || '').trim();
      const parts = txt.split(' - ');
      return { id: String(o.value), navn: parts[0] || txt || 'Bil', regnr: parts.slice(1).join(' - ') };
    });
  }

  async function loadCarsAndEmployees() {
    const fid = await firmaId();
    let cars = Array.isArray(window.biler) ? window.biler.slice() : [];
    let employees = Array.isArray(window.ansatte) ? window.ansatte.slice() : [];
    const dbCars = await fetchTable('hand_bil', q => fid ? q.eq('firma_id', fid) : q);
    const dbEmp = await fetchTable('hand_ansatt', q => fid ? q.eq('firma_id', fid) : q);
    if (dbCars.length) cars = dbCars;
    if (dbEmp.length) employees = dbEmp;
    const map = new Map();
    cars.concat(carsFromSelect()).forEach(c => {
      const id = String(c?.id || c?.bil_id || '');
      if (!id || map.has(id)) return;
      map.set(id, Object.assign({}, c, { id, navn: carName(c), regnr: carReg(c) }));
    });
    return { cars: Array.from(map.values()), employees };
  }

  function findOwnEmployee(employees) {
    const id = userAnsattId();
    const email = userEmail();
    return (employees || []).find(a => {
      const aId = String(a?.id || '');
      const aEmail = String(a?.epost || a?.email || '').toLowerCase();
      return (id && aId === id) || (email && aEmail === email);
    }) || null;
  }

  function getSelectedCarId(employees) {
    const selectVal = $('bilLagerBilValg')?.value || $('bilValg')?.value || $('lagerBilValg')?.value || '';
    if (selectVal) return String(selectVal);
    const stored = localStorage.getItem('aktivBilId') || window.aktivBilId || '';
    if (stored) return String(stored);
    const own = findOwnEmployee(employees);
    return own?.standard_bil_id ? String(own.standard_bil_id) : '';
  }

  function setSelectToCar(carId, cars) {
    if (!carId) return;
    ['bilLagerBilValg', 'bilValg', 'lagerBilValg'].forEach(id => {
      const s = $(id);
      if (!s) return;
      const has = Array.from(s.options || []).some(o => String(o.value) === String(carId));
      if (has && String(s.value) !== String(carId)) s.value = String(carId);
    });
    const car = (cars || []).find(c => String(c.id) === String(carId));
    localStorage.setItem('aktivBilId', String(carId));
    if (car) localStorage.setItem('aktivBilNavn', carText(car));
    window.aktivBilId = String(carId);
  }

  async function renderCarBox() {
    const token = ++renderSeq;
    const box = ensureStableBox();
    const { cars, employees } = await loadCarsAndEmployees();
    if (token !== renderSeq) return { carId: '' };
    const admin = isAdminMode();
    document.body.classList.toggle('ril-admin-mode', admin);
    let carId = getSelectedCarId(employees);
    setSelectToCar(carId, cars);
    const visible = admin ? cars : cars.filter(c => String(c.id) === String(carId));

    let html = '';
    if (!visible.length) {
      html = '<div style="margin:16px 0 18px 0;padding:12px;border:1px solid rgba(255,255,255,.18);border-radius:8px"><h3 style="margin-top:0">Min bil</h3><p>Ingen valgt bil funnet. Velg bil under hvis du må fylle en bil.</p></div>';
    } else {
      html = '<div style="margin:16px 0 18px 0;padding:12px;border:1px solid rgba(255,255,255,.18);border-radius:8px;overflow-x:auto">' +
        '<h3 style="margin-top:0">' + (admin ? 'Eksisterende biler og tildelt ansatt' : 'Min bil') + '</h3>' +
        '<p class="info">' + (admin ? 'Klikk på en bil for å se varer på bilen.' : 'Dette er bilen som er valgt. Bytt bil i feltet under hvis du må fylle en annen bil.') + '</p>' +
        '<table><thead><tr><th>Bil</th><th>Regnr</th>' + (admin ? '<th>Tildelt ansatt</th>' : '') + '</tr></thead><tbody>' +
        visible.map(c => {
          const valgt = String(c.id) === String(carId);
          const ansatte = (employees || []).filter(a => String(a.standard_bil_id || '') === String(c.id)).map(a => a.navn || a.fullt_navn || a.name || a.epost || a.email).filter(Boolean).join(', ') || 'Ikke tildelt';
          return '<tr class="ril-stabil-bilrad' + (valgt ? ' ril-valgt-bil' : '') + '" data-bil-id="' + esc(c.id) + '" style="cursor:pointer"><td style="font-weight:bold">' + esc(carName(c)) + '</td><td>' + esc(carReg(c)) + '</td>' + (admin ? '<td>' + esc(ansatte) + '</td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (html !== lastCarHtml) {
      lastCarHtml = html;
      box.innerHTML = html;
    }
    return { carId, cars };
  }

  async function hydrateVares(ids) {
    const clean = [...new Set((ids || []).filter(Boolean).map(String))];
    const map = new Map();
    if (!clean.length || !db()) return map;
    let rows = await fetchTable('hand_vare', q => q.in('id', clean));
    rows.forEach(v => { if (v?.id) map.set(String(v.id), v); if (v?.varenr) map.set(String(v.varenr), v); });
    const missing = clean.filter(id => !map.has(id));
    if (missing.length) {
      rows = await fetchTable('hand_vare', q => q.in('varenr', missing));
      rows.forEach(v => { if (v?.id) map.set(String(v.id), v); if (v?.varenr) map.set(String(v.varenr), v); });
    }
    return map;
  }

  async function renderItemsForCar(carId) {
    const target = $('bilLagerListe');
    if (!target || !carId) return;
    const rows = await fetchTable('hand_bil_lager', q => q.eq('bil_id', carId));
    const positive = rows.filter(r => num(r.antall ?? r.antall_pa_bil ?? r.beholdning) > 0);
    const varer = await hydrateVares(positive.map(r => r.vare_id || r.vare || r.varenr));
    let html = '';
    if (!positive.length) {
      html = '<p>Ingen varer ligger på valgt bil ennå.</p>';
    } else {
      const selected = $('bilLagerBilValg')?.selectedOptions?.[0]?.textContent || localStorage.getItem('aktivBilNavn') || 'valgt bil';
      html = '<div class="info" style="margin:8px 0 6px 0;font-weight:bold">Varer på bil: ' + esc(selected) + '</div>' +
        '<table class="bil-tabell"><thead><tr><th>Varenr</th><th>Vare</th><th>Utpris</th><th>Antall på bil</th><th>Minimum på bil</th><th>Sist hentet av</th></tr></thead><tbody>' +
        positive.map(r => {
          const v = varer.get(String(r.vare_id || '')) || varer.get(String(r.varenr || '')) || r.varer || {};
          const vn = vareName(v, r);
          const antall = num(r.antall ?? r.antall_pa_bil ?? r.beholdning);
          const min = num(r.minimum_antall ?? r.min_antall ?? r.minimum);
          const hentet = r.hentet_av || r.sist_hentet_av || r.bruker_navn || '';
          return '<tr><td>' + esc(vn.nr) + '</td><td>' + esc(vn.navn) + '</td><td>' + money(varePris(v)) + '</td><td>' + antall + '</td><td>' + min + '</td><td>' + esc(hentet) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    if (html !== lastItemsHtml) {
      lastItemsHtml = html;
      target.innerHTML = html;
    }
  }

  async function renderAll() {
    try {
      const res = await renderCarBox();
      if (res && res.carId) await renderItemsForCar(res.carId);
    } catch (e) { console.warn('Stabil Min bil feilet:', e); }
  }
  function schedule(ms) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderAll, ms || 120);
  }

  document.addEventListener('click', function (e) {
    const row = e.target && e.target.closest && e.target.closest('.ril-stabil-bilrad');
    if (!row) return;
    const carId = row.dataset.bilId;
    if (!carId) return;
    localStorage.setItem('aktivBilId', String(carId));
    window.aktivBilId = String(carId);
    ['bilLagerBilValg', 'bilValg', 'lagerBilValg'].forEach(id => {
      const s = $(id);
      if (s && Array.from(s.options || []).some(o => String(o.value) === String(carId))) s.value = String(carId);
    });
    schedule(20);
  }, true);

  document.addEventListener('change', function (e) {
    if (e.target && ['bilLagerBilValg', 'bilValg', 'lagerBilValg'].includes(e.target.id)) {
      const val = e.target.value || '';
      if (val) { localStorage.setItem('aktivBilId', String(val)); window.aktivBilId = String(val); }
      schedule(40);
    }
  }, true);

  const oldLast = window.lastBilerOgBilLager;
  if (typeof oldLast === 'function' && !oldLast.__rilMinBilStabilWrapped) {
    window.lastBilerOgBilLager = async function () {
      const out = await oldLast.apply(this, arguments);
      schedule(80);
      return out;
    };
    window.lastBilerOgBilLager.__rilMinBilStabilWrapped = true;
  }
  const oldTegn = window.tegnBilLager;
  if (typeof oldTegn === 'function' && !oldTegn.__rilMinBilStabilWrapped) {
    window.tegnBilLager = function () {
      const out = oldTegn.apply(this, arguments);
      schedule(80);
      return out;
    };
    window.tegnBilLager.__rilMinBilStabilWrapped = true;
  }

  window.rilRenderVisibleCarList = function () { schedule(50); };
  window.rilRenderVisibleCarListNow = renderAll;
  window.rilMinBilStabilRender = renderAll;

  document.addEventListener('handPartialerLastet', function () { schedule(150); });
  document.addEventListener('DOMContentLoaded', function () { schedule(350); });
  window.addEventListener('load', function () { schedule(600); schedule(1500); });
})();
