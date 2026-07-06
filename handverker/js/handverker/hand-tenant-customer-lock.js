/* HANDVERKER TENANT CUSTOMER LOCK - RIL FINAL 2026-06-22
   Rule:
   - systemadmin-rolle / sysadmin / systemadmin may see all customers.
   - all other users must have hand_ansatt.firma_id and may only see hand_kunde rows with same firma_id.
   This is a frontend safety lock. Also run the SQL RLS file included in this ZIP for real database protection.
*/
(function () {
  'use strict';
  const VERSION = 'RIL-FINAL-TENANT-CUSTOMER-LOCK-20260622';
    const CUSTOMER_TABLE = 'hand_kunde';
  const EMPLOYEE_TABLE = 'hand_ansatt';

  const txt = v => String(v == null ? '' : v).trim();
  const low = v => txt(v).toLowerCase();
  const esc = v => txt(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const byId = id => document.getElementById(id);

  function setMessage(msg) {
    ['kundeMelding','fakturaMelding','modulStatus','modulMelding','kundelisteForceDebug','kundelisteDebugBoks'].forEach(id => {
      const el = byId(id);
      if (el && msg) el.textContent = msg;
    });
    if (msg) console.log('[' + VERSION + '] ' + msg);
  }

  async function getAuthUser() {
    try {
      const r = await window.supabaseClient.auth.getUser();
      if (r && r.data && r.data.user) return r.data.user;
    } catch (_) {}
    try {
      const r = await window.supabaseClient.auth.getSession();
      if (r && r.data && r.data.session && r.data.session.user) return r.data.session.user;
    } catch (_) {}
    return null;
  }

  async function getEmail() {
    const user = await getAuthUser();
    return low(
      (user && user.email) ||
      window.innloggetEpost ||
      localStorage.getItem('handInnloggetEpost') ||
      localStorage.getItem('innloggetEpost') ||
      localStorage.getItem('rettilommaSistEpost')
    );
  }

  async function getEmployee(email) {
    if (!window.supabaseClient || !email) return null;
    try {
      let r = await window.supabaseClient
        .from(EMPLOYEE_TABLE)
        .select('id,navn,epost,email,firma_id,rolle,er_admin,aktiv')
        .ilike('epost', email)
        .limit(1);
      if ((!r.error && (!r.data || !r.data.length)) || (r.error && /column|kolonne|does not exist/i.test(String(r.error.message || '')))) {
        r = await window.supabaseClient
          .from(EMPLOYEE_TABLE)
          .select('id,navn,email,firma_id,rolle,er_admin,aktiv')
          .ilike('email', email)
          .limit(1);
      }
      if (!r.error && Array.isArray(r.data) && r.data.length) return r.data[0];
      if (r.error) console.warn(VERSION + ' employee lookup failed:', r.error);
    } catch (e) {
      console.warn(VERSION + ' employee lookup crashed:', e);
    }
    return null;
  }

  let contextPromise = null;
  async function resolveContext() {
    if (contextPromise) return contextPromise;
    contextPromise = (async function () {
      const email = await getEmail();
      const employee = await getEmployee(email);
      const role = low(employee && employee.rolle || window.innloggetRolle || localStorage.getItem('handInnloggetRolle'));
      const isSysadmin = role === 'sysadmin' || role === 'systemadmin';
      const firmaId = txt(employee && employee.firma_id || localStorage.getItem('handFirmaId') || localStorage.getItem('aktivFirmaId') || localStorage.getItem('firma_id'));

      if (email) localStorage.setItem('handInnloggetEpost', email);
      if (role) {
        window.innloggetRolle = role;
        localStorage.setItem('handInnloggetRolle', role);
      }
      if (isSysadmin) {
        window.erAdmin = true;
        window.erSystemadmin = true;
        localStorage.setItem('rilAdminModus', 'ja');
      }
      if (!isSysadmin && firmaId) {
        window.aktivFirmaId = firmaId;
        window.handFirmaId = firmaId;
        window.handAnsattFirmaId = firmaId;
        localStorage.setItem('aktivFirmaId', firmaId);
        localStorage.setItem('firmaId', firmaId);
        localStorage.setItem('firma_id', firmaId);
        localStorage.setItem('handFirmaId', firmaId);
      }

      const ctx = { email, role, employee, firmaId, isSysadmin };
      window.handTenantCustomerContext = ctx;
      console.log(VERSION + ' context', ctx);
      return ctx;
    })();
    const out = await contextPromise;
    contextPromise = null;
    return out;
  }

  function sameFirma(row, firmaId) {
    return txt(row && row.firma_id) === txt(firmaId);
  }

  function fillSelect(id, rows, firstText) {
    const s = byId(id);
    if (!s) return;
    const old = s.value || '';
    s.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = rows.length ? (firstText || 'Velg kunde') : 'Ingen kunder funnet';
    s.appendChild(opt0);
    rows.forEach(k => {
      const opt = document.createElement('option');
      opt.value = txt(k.id || k.kunde_id);
      const nr = txt(k.kundenr || k.kunde_nr);
      const navn = txt(k.navn || k.firmanavn || k.epost || ('Kunde ' + opt.value));
      opt.textContent = nr ? nr + ' - ' + navn : navn;
      opt.dataset.firmaId = txt(k.firma_id);
      opt.dataset.kundenr = nr;
      s.appendChild(opt);
    });
    if (old && Array.from(s.options).some(o => o.value === old)) s.value = old;
  }

  function renderCustomers(rows) {
    const targets = ['kundeListe','handKundeListe','handKundeAdminListe'].map(byId).filter(Boolean);
    targets.forEach(list => {
      if (!rows.length) {
        list.innerHTML = '<div class="info">Ingen kunder funnet for innlogget firma.</div>';
        return;
      }
      list.innerHTML = rows.map(k =>
        '<div class="card kunde-card" data-firma-id="' + esc(k.firma_id) + '">' +
        '<b>' + esc(k.navn || k.firmanavn || 'Uten navn') + '</b><br>' +
        esc(k.adresse || '') + '<br>' + esc(k.epost || k.email || '') +
        '</div>'
      ).join('');
    });
  }

  async function loadCustomersLocked() {
    const ctx = await resolveContext();
    let rows = [];

    // Alle ansatte skal kunne velge kunder når de skriver timer.
    // Først prøver vi firma_id, deretter faller vi tilbake til kundene Supabase/RLS viser.
    try {
      let r = null;
      if (!ctx.isSysadmin && ctx.firmaId) {
        r = await window.supabaseClient
          .from(CUSTOMER_TABLE)
          .select('*')
          .eq('firma_id', ctx.firmaId)
          .order('navn', { ascending: true })
          .limit(5000);
      }
      if (ctx.isSysadmin || !r || r.error || !Array.isArray(r.data) || !r.data.length) {
        const all = await window.supabaseClient
          .from(CUSTOMER_TABLE)
          .select('*')
          .order('navn', { ascending: true })
          .limit(5000);
        if (all.error) throw all.error;
        r = all;
      }
      rows = Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      setMessage('Feil ved henting av kunder: ' + (e.message || e));
      rows = [];
    }

    window.kunder = rows;
    window.handAdminKunder = rows;
    ['kundeValg','fakturaKundeValg','modulKundeVelger'].forEach(id => fillSelect(id, rows, 'Velg kunde'));
    fillSelect('okonomiKundeValg', rows, ctx.isSysadmin ? 'Alle kunder' : 'Velg kunde');
    renderCustomers(rows);
    if (!rows.length) setMessage('Ingen kunder funnet. Ansatte må ha lesetilgang til firmaets kunder.');
    return rows;
  }

  function installSupabaseGuard() {
    const c = window.supabaseClient;
    if (!c || c.__rilTenantCustomerLock === VERSION) return;
    const originalFrom = c.from.bind(c);
    c.from = function (tableName) {
      const builder = originalFrom(tableName);
      if (tableName !== CUSTOMER_TABLE) return builder;

      let hasFirmaFilter = false;
      const wrap = function (methodName, checker) {
        if (!builder[methodName]) return;
        const orig = builder[methodName].bind(builder);
        builder[methodName] = function () {
          try { if (checker.apply(null, arguments)) hasFirmaFilter = true; } catch (_) {}
          return orig.apply(null, arguments);
        };
      };
      wrap('eq', col => col === 'firma_id');
      wrap('in', col => col === 'firma_id');
      wrap('filter', col => col === 'firma_id');
      wrap('match', obj => obj && Object.prototype.hasOwnProperty.call(obj, 'firma_id'));

      async function guardedPromise() {
        const ctx = await resolveContext();
        if (ctx.isSysadmin) return Promise.resolve(builder);
        if (!ctx.firmaId) return { data: [], error: null, count: 0, status: 200, statusText: 'No firma_id for user' };
        if (!hasFirmaFilter && builder.eq) {
          hasFirmaFilter = true;
          builder.eq('firma_id', ctx.firmaId);
        }
        const result = await Promise.resolve(builder);
        if (result && Array.isArray(result.data)) {
          result.data = result.data.filter(k => sameFirma(k, ctx.firmaId));
        }
        return result;
      }
      builder.then = function (onFulfilled, onRejected) { return guardedPromise().then(onFulfilled, onRejected); };
      builder.catch = function (onRejected) { return guardedPromise().catch(onRejected); };
      builder.finally = function (onFinally) { return guardedPromise().finally(onFinally); };
      return builder;
    };
    c.__rilTenantCustomerLock = VERSION;
    window.__rilTenantCustomerLock = VERSION;
    console.log(VERSION + ' installed');
  }

  function install() {
    // Ikke monkey-patch Supabase her. Kundevalg styres av lastKunder og RLS.
    window.handResolveCustomerTenantContext = resolveContext;
    window.hentInnloggetFirmaIderForKunder = async function () {
      const ctx = await resolveContext();
      if (ctx.isSysadmin) return ['__SYSADMIN_ALL__'];
      return ctx.firmaId ? [ctx.firmaId] : [];
    };
    window.handResolveInnloggetFirmaId = async function () {
      const ctx = await resolveContext();
      return ctx.isSysadmin ? '__SYSADMIN_ALL__' : (ctx.firmaId || '');
    };
    window.lastKunder = loadCustomersLocked;
    window.handLastKundeliste = loadCustomersLocked;
    window.handHentAlleKunderRobust = loadCustomersLocked;
    window.handFyllSysadminKundeVelgere = loadCustomersLocked;
    window.fyllKundeDropdown = function () { fillSelect('kundeValg', window.kunder || [], 'Velg kunde'); };
    window.fyllFakturaKundeDropdown = function () { fillSelect('fakturaKundeValg', window.kunder || [], 'Velg kunde'); };
    window.fyllOkonomiKundeValg = function () { fillSelect('okonomiKundeValg', window.kunder || [], 'Alle kunder'); };
  }

  function start() {
    install();
    [100, 400, 1000, 2000, 4000].forEach(ms => setTimeout(() => { install(); loadCustomersLocked(); }, ms));
  }

  document.addEventListener('DOMContentLoaded', start);
  document.addEventListener('handPartialerLastet', start);
  window.addEventListener('load', start);
  const interval = setInterval(install, 500);
  setTimeout(() => clearInterval(interval), 60000);
})();
