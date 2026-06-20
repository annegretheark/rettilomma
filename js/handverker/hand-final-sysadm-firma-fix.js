/*
  Handverker final fix 2026-06-20
  - Greknuts skal aldri nedgraderes fra sysadmin
  - Firma/kundeliste skal lastes for sysadmin
  - Ny kunde får firma-rad + adminrad; Auth må opprettes av Edge Function/opprett-hand-kunde
*/
(function () {
  const SYS_EMAIL = 'greknuts@online.no';

  function $(id) { return document.getElementById(id); }
  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function slugify(v) {
    return String(v || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function appBase() {
    const p = location.pathname.toLowerCase();
    if (p.includes('/rettilomma/')) return location.origin + '/rettilomma/handverker/';
    if (p.includes('/handverker/')) return location.origin + '/handverker/';
    return location.origin + '/handverker/';
  }
  function kundelink(slug) { return appBase() + '?firma=' + encodeURIComponent(slug || ''); }

  async function sessionEmail() {
    try {
      const r = await window.supabaseClient?.auth?.getSession();
      const e = norm(r?.data?.session?.user?.email);
      if (e) return e;
    } catch (e) {}
    return norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost'));
  }

  function forceGreknuts(email) {
    email = norm(email || window.innloggetEpost || localStorage.getItem('handInnloggetEpost'));
    if (email !== SYS_EMAIL) return false;
    window.innloggetEpost = SYS_EMAIL;
    window.innloggetRolle = 'sysadmin';
    window.erSystemadmin = true;
    window.erAdmin = true;
    localStorage.setItem('handInnloggetEpost', SYS_EMAIL);
    localStorage.setItem('rilAdminModus', 'ja');

    const epostEl = $('innloggetBrukerVisning');
    const rolleEl = $('innloggetRolleVisning');
    const badge = $('innloggetBruker');
    if (epostEl) epostEl.textContent = SYS_EMAIL;
    if (rolleEl) rolleEl.textContent = ' (rolle: sysadmin, sysadm, adminmodus)';
    if (badge) badge.textContent = 'Innlogget: ' + SYS_EMAIL;

    document.querySelectorAll('.greknuts-only').forEach(el => {
      const sysAktiv = localStorage.getItem('rilSysadminModus') === 'ja';
      el.classList.toggle('skjult', sysAktiv);
      el.classList.toggle('hidden', sysAktiv);
      el.style.display = sysAktiv ? 'none' : '';
    });
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.remove('skjult', 'hidden');
      if (!(el.tagName === 'SECTION' || /Side$|Panel$/.test(el.id || ''))) el.style.display = '';
    });
    document.querySelectorAll('.systemadmin-only').forEach(el => {
      const sysAktiv = localStorage.getItem('rilSysadminModus') === 'ja';
      el.classList.toggle('skjult', !sysAktiv);
      el.classList.toggle('hidden', !sysAktiv);
      el.style.display = sysAktiv ? '' : 'none';
    });
    return true;
  }

  async function ensureGreknutsAnsattRow() {
    const email = await sessionEmail();
    if (email !== SYS_EMAIL || !window.supabaseClient) return;
    forceGreknuts(email);
    const payload = {
      epost: SYS_EMAIL,
      email: SYS_EMAIL,
      navn: 'Greknuts',
      rolle: 'sysadmin',
      er_admin: true,
      aktiv: true
    };
    try {
      const r = await supabaseClient.from('hand_ansatt').select('id, rolle').eq('epost', SYS_EMAIL).limit(1);
      if (!r.error && Array.isArray(r.data) && r.data.length) {
        await supabaseClient.from('hand_ansatt').update(payload).eq('id', r.data[0].id);
      } else {
        await supabaseClient.from('hand_ansatt').insert([payload]);
      }
    } catch (e) {
      console.warn('Kunne ikke sikre greknuts sysadminrad. Sjekk RLS hvis firma ikke vises:', e);
    }
  }

  async function hentAlleFirmaRobust() {
    await ensureGreknutsAnsattRow();
    const forsok = [
      ['hand_firma', '*', 'navn'],
      ['hand_firma', '*', 'firmanavn'],
      ['hand_firma', '*', null],
      ['hand_kunde', '*', 'navn'],
      ['hand_kunde', '*', 'firmanavn'],
      ['hand_kunde', '*', 'kunde_navn'],
      ['hand_kunde', '*', null],
      ['hand_kunder', '*', 'navn'],
      ['hand_kunder', '*', 'firmanavn'],
      ['hand_kunder', '*', null]
    ];
    let sisteFeil = null;
    for (const [tabell, felt, order] of forsok) {
      try {
        let q = supabaseClient.from(tabell).select(felt);
        if (order) q = q.order(order, { ascending: true });
        const r = await q;
        if (!r.error && Array.isArray(r.data)) return { data: r.data, error: null, tabell };
        if (r.error) sisteFeil = r.error;
      } catch (e) { sisteFeil = e; }
    }
    return { data: [], error: sisteFeil, tabell: '' };
  }

  async function visKundeliste() {
    const liste = $('handKundeAdminListe');
    if (!liste || !window.supabaseClient) return;
    const email = await sessionEmail();
    if (!forceGreknuts(email)) {
      liste.innerHTML = '<div class="melding">Bare sysadmin kan se alle firma.</div>';
      return;
    }
    liste.innerHTML = '<div class="info">Henter firma/kunder...</div>';
    const r = await hentAlleFirmaRobust();
    window.handAdminKunder = r.data || [];
    if (!window.handAdminKunder.length) {
      liste.innerHTML = '<div class="melding">Ingen firma vises. Du er sysadmin i appen, men databasen returnerte ingen rader. Hvis det finnes firma i Supabase, sjekk RLS/select-policy for hand_firma mot greknuts@online.no eller rolle=sysadmin i hand_ansatt.</div>';
      return;
    }
    liste.innerHTML = '<div class="info">Fant ' + window.handAdminKunder.length + ' firma/kunder.</div>' +
      '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>' +
      '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Firma</th>' +
      '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">E-post</th>' +
      '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Kundelink</th>' +
      '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Handling</th>' +
      '</tr></thead><tbody>' + window.handAdminKunder.map(k => {
        const navn = k.navn || k.firmanavn || k.firma_navn || k.company || k.epost || k.email || k.id;
        const slug = k.linknavn || k.slug || slugify(navn);
        const lnk = k.kundelink || k.kunde_link || kundelink(slug);
        return '<tr><td style="padding:6px;border-bottom:1px solid #374151">' + esc(navn) + '</td>' +
          '<td style="padding:6px;border-bottom:1px solid #374151">' + esc(k.epost || k.email || '') + '</td>' +
          '<td style="padding:6px;border-bottom:1px solid #374151"><a href="' + esc(lnk) + '" target="_blank" style="color:#93c5fd">' + esc(slug) + '</a></td>' +
          '<td style="padding:6px;border-bottom:1px solid #374151;white-space:nowrap"><button type="button" class="secondary" onclick="handRedigerKunde(\'' + esc(k.id) + '\')">Rediger</button> <button type="button" class="secondary" onclick="handKopierTekst(\'' + esc(lnk) + '\')">Kopier</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function visSysadminPanel() {
    forceGreknuts(SYS_EMAIL);
    localStorage.setItem('rilSysadminModus', 'ja');
    if (typeof window.skjulAlleSider === 'function') window.skjulAlleSider();
    const app = $('appSide');
    const panel = $('sysadminPanelSide');
    if (app) { app.classList.remove('skjult','hidden'); app.style.display = ''; }
    if (panel) { panel.classList.remove('skjult','hidden'); panel.style.display = ''; }
    setTimeout(visKundeliste, 100);
  }

  function tilbakeTilAdmin() {
    localStorage.removeItem('rilSysadminModus');
    forceGreknuts(SYS_EMAIL);
    if (typeof window.visTimerSide === 'function') window.visTimerSide();
  }

  function bind() {
    forceGreknuts();
    const sysBtn = $('sysadminModeKnapp');
    if (sysBtn) {
      sysBtn.classList.remove('hidden');
      if (norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost')) === SYS_EMAIL) sysBtn.style.display = '';
      sysBtn.onclick = function (e) { e.preventDefault(); visSysadminPanel(); return false; };
    }
    const listeBtn = $('sysadminKundelisteKnapp');
    if (listeBtn) listeBtn.onclick = function (e) { e.preventDefault(); visKundeliste(); return false; };
    const tilbake = $('sysadminTilAdminKnapp');
    if (tilbake) tilbake.onclick = function (e) { e.preventDefault(); tilbakeTilAdmin(); return false; };
  }

  window.handForceGreknutsSysadmin = async function () {
    const email = await sessionEmail();
    forceGreknuts(email);
    await ensureGreknutsAnsattRow();
    bind();
    return email === SYS_EMAIL;
  };
  window.handLastKundeliste = visKundeliste;
  window.handVisSysadminPanel = visSysadminPanel;

  const gammelSett = window.settInnloggetBrukerVisning;
  window.settInnloggetBrukerVisning = function () {
    if (typeof gammelSett === 'function') gammelSett.apply(this, arguments);
    forceGreknuts();
  };

  document.addEventListener('DOMContentLoaded', function () { bind(); setTimeout(bind, 500); setTimeout(bind, 1500); setTimeout(ensureGreknutsAnsattRow, 1200); });
  document.addEventListener('handPartialerLastet', function () { bind(); setTimeout(bind, 300); });
  window.addEventListener('load', function () { bind(); setTimeout(bind, 500); setTimeout(bind, 1500); setTimeout(ensureGreknutsAnsattRow, 1000); });
  setInterval(function () { forceGreknuts(); }, 2000);
})();
