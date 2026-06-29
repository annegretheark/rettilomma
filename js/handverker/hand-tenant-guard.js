/* RIL TENANT GUARD 2026-06-22
   Laster sist. Hindrer at vanlig ansatt/admin ser alle kunder.
   Kundene vises bare når kunden har en eier-/firma-nøkkel som matcher innlogget brukers firma.
*/
(function () {
  'use strict';
  const VERSION = 'RIL-TENANT-GUARD-20260622-REAL';
  const norm = v => String(v == null ? '' : v).trim();
  const low = v => norm(v).toLowerCase();
  const uniq = arr => Array.from(new Set((arr || []).map(norm).filter(Boolean)));
  
  function setMsg(txt) {
    const el = document.getElementById('kundeMelding');
    if (el) el.textContent = txt || '';
  }

  async function getUser() {
    try {
      const r = await window.supabaseClient.auth.getUser();
      return r && r.data ? r.data.user : null;
    } catch (_) { return null; }
  }

  async function tryRows(table, col, val) {
    if (!window.supabaseClient || !val) return [];
    const out = [];
    try {
      const r = await window.supabaseClient.from(table).select('*').eq(col, val).limit(50);
      if (!r.error && Array.isArray(r.data)) out.push.apply(out, r.data);
    } catch (_) {}
    try {
      if (typeof val === 'string' && val.indexOf('@') > -1) {
        const r = await window.supabaseClient.from(table).select('*').ilike(col, val).limit(50);
        if (!r.error && Array.isArray(r.data)) out.push.apply(out, r.data);
      }
    } catch (_) {}
    return out;
  }

  async function resolveTenant() {
    const user = await getUser();
    const email = low((user && user.email) || window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || '');
    const ids = [];
    const emails = email ? [email] : [];
    const names = [];
    const debug = [];

    const userIds = uniq([user && user.id, localStorage.getItem('sb-user-id'), window.innloggetBrukerId]);

    async function addFromRow(row, source) {
      if (!row) return;
      debug.push(source + ' keys=' + Object.keys(row).join(','));
      [row.firma_id, row.firmaId, row.firma, row.firma_uid, row.firma_uuid, row.bedrift_id, row.company_id, row.tenant_id, row.kunde_id].forEach(x => { if (x) ids.push(x); });
      [row.epost, row.email].forEach(x => { if (x) emails.push(low(x)); });
    }

    for (const [table, cols] of [
      ['hand_ansatt', ['epost','email','user_id','bruker_id','auth_user_id','auth_id','uid']],
      ['hand_firma_bruker', ['epost','email','user_id','bruker_id','auth_user_id','auth_id','uid']]
    ]) {
      for (const col of cols) {
        const values = (col === 'epost' || col === 'email') ? emails : userIds;
        for (const val of values) {
          const rows = await tryRows(table, col, val);
          for (const row of rows) await addFromRow(row, table + '.' + col);
        }
      }
    }

    // Firmaeier/admin: finn firma på e-post. Ikke bruk hand_kunde som firma.
    for (const table of ['hand_firma','hand_kunder']) {
      for (const col of ['epost','email']) {
        for (const val of emails) {
          const rows = await tryRows(table, col, val);
          for (const row of rows) {
            debug.push(table + '.' + col + ' keys=' + Object.keys(row).join(','));
            [row.id, row.firma_id, row.firmaId, row.kunde_id].forEach(x => { if (x) ids.push(x); });
            [row.navn, row.firmanavn, row.firma_navn].forEach(x => { if (x) names.push(low(x)); });
          }
        }
      }
    }

    const finalIds = uniq(ids);
    if (finalIds.length === 1) {
      window.aktivFirmaId = finalIds[0];
      window.handFirmaId = finalIds[0];
      localStorage.setItem('aktivFirmaId', finalIds[0]);
      localStorage.setItem('firmaId', finalIds[0]);
      localStorage.setItem('firma_id', finalIds[0]);
      localStorage.setItem('handFirmaId', finalIds[0]);
    }
    const tenant = { ids: finalIds, emails: uniq(emails), names: uniq(names), debug };
    window.handTenantGuard = tenant;
    console.log(VERSION, tenant);
    return tenant;
  }

  function tenantValuesFromCustomer(k) {
    return uniq([
      k && k.firma_id, k && k.firmaId, k && k.firma, k && k.firmaid,
      k && k.firma_uid, k && k.firma_uuid,
      k && k.bedrift_id, k && k.bedriftId,
      k && k.company_id, k && k.companyId,
      k && k.eier_id, k && k.eierId,
      k && k.eier_firma_id, k && k.eierFirmaId,
      k && k.owner_id, k && k.ownerId,
      k && k.tenant_id, k && k.tenantId,
      k && k.kunde_firma_id, k && k.kundeFirmaId,
      k && k.kunde_id, k && k.kundeId,
      k && k.org_id, k && k.orgId
    ]);
  }

  function customerEmails(k) {
    return uniq([k && k.firma_epost, k && k.eier_epost, k && k.owner_email, k && k.opprettet_av, k && k.created_by]).map(low);
  }

  function customerNames(k) {
    return uniq([k && k.firma_navn, k && k.firmanavn, k && k.bedrift_navn, k && k.company_name]).map(low);
  }

  function filterCustomers(rows, tenant) {
    const ids = new Set((tenant.ids || []).map(norm));
    const emails = new Set((tenant.emails || []).map(low));
    const names = new Set((tenant.names || []).map(low));
    const kept = [];
    for (const k of rows || []) {
      const vals = tenantValuesFromCustomer(k);
      const ems = customerEmails(k);
      const nms = customerNames(k);
      if (vals.some(v => ids.has(norm(v))) || ems.some(v => emails.has(low(v))) || nms.some(v => names.has(low(v)))) kept.push(k);
    }
    return kept;
  }

  function replaceGlobalArray(name, data) {
    if (!Array.isArray(window[name])) window[name] = [];
    window[name].length = 0;
    (data || []).forEach(x => window[name].push(x));
  }

  function renderCustomers() {
    const list = document.getElementById('kundeListe');
    if (list) {
      list.innerHTML = '';
      const rows = Array.isArray(window.kunder) ? window.kunder : [];
      if (!rows.length) {
        list.innerHTML = '<p>Ingen kunder funnet for innlogget firma.</p>';
      } else {
        rows.forEach(k => {
          const div = document.createElement('div');
          div.className = 'card';
          div.style.padding = '14px';
          div.style.marginBottom = '14px';
          div.style.borderBottom = '1px solid #444';
          div.innerHTML = '<div style="line-height:1.35;"><strong>' + (k.navn || k.firmanavn || '') + '</strong><br>' +
            'Kundenr: ' + (k.kundenr || k.kunde_nr || '') + '<br>' +
            (k.adresse || '') + '<br>' + (k.epost || k.email || '') + '<br>' +
            (k.kontaktperson || '') + '<br>' + (k.kontonr || '') + '</div>' +
            '<div style="margin-top:10px;margin-bottom:4px;"><button type="button" class="secondary" onclick="redigerKunde(\'' + (k.id || '') + '\')">Rediger</button></div>';
          list.appendChild(div);
        });
      }
    }
    fillSelect('kundeValg', 'Velg kunde', false);
    fillSelect('fakturaKundeValg', 'Velg kunde', true);
  }

  function fillSelect(id, emptyText, withNumber) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const old = sel.value || '';
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = emptyText || 'Velg kunde';
    sel.appendChild(opt0);
    (window.kunder || []).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.id || k.kunde_id || '';
      const nr = k.kundenr || k.kunde_nr || '';
      opt.textContent = withNumber && nr ? nr + ' - ' + (k.navn || k.firmanavn || '') : (k.navn || k.firmanavn || '');
      sel.appendChild(opt);
    });
    if (old) sel.value = old;
  }

  async function guardedLastKunder() {
    const tenant = await resolveTenant();
    const debug = [];
    let rows = [];

    // Alle ansatte skal kunne velge kunder for sitt firma for å skrive timer.
    // Vi prøver først firma_id fra hand_ansatt/hand_firma_bruker.
    // Hvis det ikke gir treff, bruker vi kundene Supabase/RLS allerede viser brukeren.
    try {
      let r = null;
      if (tenant.ids && tenant.ids.length) {
        r = await window.supabaseClient
          .from('hand_kunde')
          .select('*')
          .in('firma_id', tenant.ids)
          .order('navn', { ascending: true })
          .limit(5000);
        debug.push('hand_kunde firma_id in=' + tenant.ids.join(',') + ' rows=' + ((r.data || []).length));
      }
      if (!r || r.error || !Array.isArray(r.data) || !r.data.length) {
        const all = await window.supabaseClient
          .from('hand_kunde')
          .select('*')
          .order('navn', { ascending: true })
          .limit(5000);
        if (all.error) throw all.error;
        r = all;
        debug.push('hand_kunde synlige via RLS rows=' + ((r.data || []).length));
      }
      rows = Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      debug.push('hand_kunde feil=' + (e.message || e));
      rows = [];
    }

    window.handTenantGuardDebug = debug;
    console.log(VERSION + ' kunder', debug);
    replaceGlobalArray('kunder', rows);

    const ids = rows.map(k => k.id || k.kunde_id).filter(Boolean).map(norm);
    let projects = [];
    if (ids.length) {
      try {
        const pr = await window.supabaseClient.from('hand_prosjekt').select('*').in('kunde_id', ids).order('navn', { ascending: true });
        if (!pr.error && Array.isArray(pr.data)) projects = pr.data;
      } catch (_) {}
    }
    replaceGlobalArray('prosjekter', projects);

    if (!rows.length) setMsg('Ingen kunder funnet. Sjekk at ansatt er koblet til firma og at RLS gir lesetilgang til hand_kunde.');
    else setMsg('');
    renderCustomers();
    return rows;
  }

  function install() {
    window.handResolveInnloggetFirmaId = async function () {
      const t = await resolveTenant();
      return (t.ids && t.ids[0]) || '';
    };
    window.lastKunder = guardedLastKunder;
    window.tegnKundeListe = renderCustomers;
    window.tegnKunder = renderCustomers;
    window.fyllKundeDropdown = function () { fillSelect('kundeValg', 'Velg kunde', false); };
    window.fyllFakturaKundeDropdown = function () { fillSelect('fakturaKundeValg', 'Velg kunde', true); };
    window.handTenantGuardVersion = VERSION;
    console.log(VERSION + ' installert');
  }

  install();
  window.addEventListener('load', function () { setTimeout(install, 0); setTimeout(guardedLastKunder, 700); });
})();
