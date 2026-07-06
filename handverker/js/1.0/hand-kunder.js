/* Handverker kunder 7078 - stabil kundeside
   Prod-fil: bruker faktiske tabeller firma_brukere og ansatte.
   Fjerner svart skjerm ved å alltid vise kundeSide først, og håndterer feil som melding.
*/
(function () {
  'use strict';

  var kunder = [];
  var prosjekter = [];
  window.kunder = window.kunder || kunder;
  window.prosjekter = window.prosjekter || prosjekter;

  function s(v) { return String(v == null ? '' : v).trim(); }
  function low(v) { return s(v).toLowerCase(); }
  function $(id) { return document.getElementById(id); }
  function client() { return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function esc(v) { return s(v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function msg(t) { var el = $('kundeMelding'); if (el) el.textContent = t || ''; }
  function kundenr(k) { return s(k && (k.kundenr || k.kunde_nr || k.kundenummer || k.nr)); }
  function numOnly(v) { var m = s(v).match(/\d+/g); return m ? m.join('') : ''; }
  function moneyNum(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : null; }
  function timeprisVerdi(o) { var n = moneyNum(o && (o.timepris || o.time_pris || o.kunde_timepris || o.prosjekt_timepris || o.faktura_timepris)); return n == null ? '' : String(n); }
  function fastprisVerdi(o) { var n = moneyNum(o && (o.fastpris || o.fast_pris || o.prosjekt_fastpris)); return n == null ? '' : String(n); }
  function fakturatypeVerdi(o) { var v = low(o && (o.fakturatype || o.faktura_type || o.pristype)); return v === 'fastpris' ? 'fastpris' : 'time'; }
  function isAdminRolle(r) { r = low(r); return r === 'eier' || r === 'owner' || r === 'admin' || r === 'administrator' || r === 'bedrift_admin' || r === 'sysadmin' || r === 'systemadmin'; }
  function isSysRolle(r) { r = low(r); return r === 'sysadmin' || r === 'systemadmin' || r === 'sysadm'; }

  async function getAuthUser() {
    var c = client();
    try {
      if (c && c.auth && c.auth.getUser) {
        var r = await c.auth.getUser();
        if (r && r.data && r.data.user) return r.data.user;
      }
    } catch (e) {}
    try {
      if (c && c.auth && c.auth.getSession) {
        var r2 = await c.auth.getSession();
        if (r2 && r2.data && r2.data.session && r2.data.session.user) return r2.data.session.user;
      }
    } catch (e) {}
    return null;
  }

  async function getEmail() {
    var u = await getAuthUser();
    return low((u && u.email) || window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost'));
  }

  async function selectRows(table, cols, filterFn) {
    var c = client(); if (!c) return { data: [], error: { message: 'Supabase mangler' } };
    try {
      var q = c.from(table).select(cols || '*');
      if (filterFn) q = filterFn(q);
      var r = await q;
      if (!r.error) return { data: Array.isArray(r.data) ? r.data : [], error: null };
      return { data: [], error: r.error };
    } catch (e) {
      return { data: [], error: e };
    }
  }

  async function finnFirmaKontekst() {
    var c = client();
    var user = await getAuthUser();
    var email = await getEmail();
    if (!c) return { firmaIder: [], firmaId: '', rolle: '', isAdmin: false, isSysadmin: false, email: email, melding: 'Supabase er ikke lastet.' };
    if (!email && !(user && user.id)) return { firmaIder: [], firmaId: '', rolle: '', isAdmin: false, isSysadmin: false, email: email, melding: 'Fant ikke innlogget e-post. Logg ut og inn igjen.' };

    var kandidater = [];

    async function hentFraFirmaBrukere(tabell) {
      var rows = [];
      if (user && user.id) {
        var r1 = await selectRows(tabell, '*', function (q) { return q.eq('bruker_id', user.id); });
        if (r1.data.length) rows = rows.concat(r1.data);
        var r2 = await selectRows(tabell, '*', function (q) { return q.eq('user_id', user.id); });
        if (r2.data.length) rows = rows.concat(r2.data);
        var rAuth = await selectRows(tabell, '*', function (q) { return q.eq('auth_id', user.id); });
        if (rAuth.data.length) rows = rows.concat(rAuth.data);
        var rAuthUser = await selectRows(tabell, '*', function (q) { return q.eq('auth_user_id', user.id); });
        if (rAuthUser.data.length) rows = rows.concat(rAuthUser.data);
      }
      if (email) {
        var r3 = await selectRows(tabell, '*', function (q) { return q.ilike('epost', email); });
        if (r3.data.length) rows = rows.concat(r3.data);
        var r4 = await selectRows(tabell, '*', function (q) { return q.ilike('email', email); });
        if (r4.data.length) rows = rows.concat(r4.data);
      }
      rows.forEach(function (r) {
        if (r && r.firma_id) kandidater.push({ firma_id: r.firma_id, rolle: r.rolle || 'admin', kilde: tabell, eier: true });
      });
    }

    async function hentFraAnsatte(tabell) {
      var rows = [];
      if (user && user.id) {
        var r1 = await selectRows(tabell, '*', function (q) { return q.eq('user_id', user.id); });
        if (r1.data.length) rows = rows.concat(r1.data);
        var r2 = await selectRows(tabell, '*', function (q) { return q.eq('bruker_id', user.id); });
        if (r2.data.length) rows = rows.concat(r2.data);
        var rAuth = await selectRows(tabell, '*', function (q) { return q.eq('auth_id', user.id); });
        if (rAuth.data.length) rows = rows.concat(rAuth.data);
        var rAuthUser = await selectRows(tabell, '*', function (q) { return q.eq('auth_user_id', user.id); });
        if (rAuthUser.data.length) rows = rows.concat(rAuthUser.data);
      }
      if (email) {
        var r3 = await selectRows(tabell, '*', function (q) { return q.ilike('epost', email); });
        if (r3.data.length) rows = rows.concat(r3.data);
        var r4 = await selectRows(tabell, '*', function (q) { return q.ilike('email', email); });
        if (r4.data.length) rows = rows.concat(r4.data);
      }
      rows.forEach(function (r) {
        if (r && r.firma_id) kandidater.push({ firma_id: r.firma_id, rolle: r.rolle || (r.er_admin ? 'admin' : 'bruker'), kilde: tabell, eier: false, er_admin: r.er_admin === true });
      });
    }

    // 2026-06-26: Bruk de faktiske Handverker-tabellene først.
    // Tidligere ble legacy-tabellene firma_brukere/ansatte sjekket først.
    // Hvis de inneholdt gammel/feil firma_id, ble kundevalg tomt for vanlig ansatt.
    // 20260706: roller og firma kommer kun fra public.hand_firma_bruker.
    await hentFraFirmaBrukere('hand_firma_bruker');
    await hentFraAnsatte('hand_ansatt');

    var seen = {};
    kandidater = kandidater.filter(function (r) {
      var key = s(r.firma_id) + '|' + low(r.rolle) + '|' + r.kilde;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    var valgt = kandidater.find(function (r) { return r.eier && isAdminRolle(r.rolle); }) ||
                kandidater.find(function (r) { return isAdminRolle(r.rolle) || r.er_admin; }) ||
                kandidater[0];

    var firmaIder = kandidater.map(function (r) { return s(r.firma_id); }).filter(Boolean);
    firmaIder = firmaIder.filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    var rolle = low(valgt && valgt.rolle);
    var sys = isSysRolle(rolle);
    var admin = !!(valgt && (valgt.eier || isAdminRolle(rolle) || valgt.er_admin));
    var firmaId = s(valgt && valgt.firma_id) || firmaIder[0] || '';

    if (firmaId) {
      window.aktivFirmaId = firmaId;
      window.handFirmaId = firmaId;
      window.handAnsattFirmaId = firmaId;
      try {
        localStorage.setItem('aktivFirmaId', firmaId);
        localStorage.setItem('handFirmaId', firmaId);
        localStorage.setItem('firma_id', firmaId);
        localStorage.setItem('firmaId', firmaId);
      } catch (e) {}
    }
    if (email) {
      window.innloggetEpost = email;
      try { localStorage.setItem('handInnloggetEpost', email); } catch (e) {}
    }
    if (rolle) {
      window.innloggetRolle = rolle;
      try { localStorage.setItem('handInnloggetRolle', rolle); localStorage.setItem('innloggetRolle', rolle); } catch (e) {}
    }
    if (admin) window.erAdmin = true;
    if (sys) window.erSystemadmin = true;

    return {
      firmaIder: sys ? ['__SYSADMIN_ALL__'] : firmaIder,
      firmaId: firmaId,
      rolle: rolle,
      isAdmin: admin,
      isSysadmin: sys,
      email: email,
      melding: firmaIder.length ? '' : ('Fant ikke firma for ' + email + '. Sjekk firma_brukere eller ansatte.')
    };
  }

  function visKunder() {
    var liste = $('kundeListe');
    if (!liste) return;
    var rows = window.kunder || kunder || [];
    if (!rows.length) {
      liste.innerHTML = '<p>Ingen kunder funnet.</p>';
      return;
    }
    liste.innerHTML = rows.map(function (k) {
      var kp = (window.prosjekter || []).filter(function (p) { return s(p.kunde_id) === s(k.id); });
      var prosjektHtml = kp.length ? '<div style="margin-top:8px"><strong>Prosjekter:</strong><ul>' + kp.map(function (p) {
        return '<li>' + esc(p.prosjektnr || p.prosjekt_nr || '') + ' ' + esc(p.navn || '') + ' - ' + esc(fakturatypeVerdi(p) === 'fastpris' ? 'Fastpris' : 'Time') + (timeprisVerdi(p) ? ' - timepris: ' + esc(timeprisVerdi(p)) : '') + (fastprisVerdi(p) ? ' - fastpris: ' + esc(fastprisVerdi(p)) : '') + '</li>';
      }).join('') + '</ul></div>' : '';
      return '<div class="card kunde-card" style="padding:14px;margin-bottom:14px;border-bottom:1px solid #444;">' +
        '<strong>' + esc(k.navn || '') + '</strong><br>' +
        'Kundenr: ' + esc(kundenr(k)) + '<br>' +
        (k.adresse ? 'Adresse: ' + esc(k.adresse) + '<br>' : '') +
        (k.epost || k.email ? 'E-post: ' + esc(k.epost || k.email) + '<br>' : '') +
        (k.telefon || k.telefonnr || k.mobil ? 'Telefon: ' + esc(k.telefon || k.telefonnr || k.mobil) + '<br>' : '') +
        (timeprisVerdi(k) ? 'Timepris: ' + esc(timeprisVerdi(k)) + '<br>' : '') +
        (k.kontaktperson ? 'Kontaktperson: ' + esc(k.kontaktperson) + '<br>' : '') +
        (k.kontonr ? 'Kontonr: ' + esc(k.kontonr) + '<br>' : '') + prosjektHtml +
        '<div style="margin-top:10px"><button type="button" class="secondary" data-rediger-kunde="' + esc(k.id) + '">Rediger</button></div>' +
        '</div>';
    }).join('');
    liste.querySelectorAll('[data-rediger-kunde]').forEach(function (b) {
      b.onclick = function () { redigerKunde(b.getAttribute('data-rediger-kunde')); };
    });
  }

  async function lastKunder() {
    try {
      var c = client();
      var cx = await finnFirmaKontekst();
      if (!c) { msg(cx.melding || 'Supabase er ikke lastet.'); kunder = []; prosjekter = []; window.kunder = kunder; window.prosjekter = prosjekter; visKunder(); return []; }
      if (!cx.firmaIder.length) { msg(cx.melding); kunder = []; prosjekter = []; window.kunder = kunder; window.prosjekter = prosjekter; visKunder(); return []; }

      var erSysadminAlle = cx.firmaIder.includes('__SYSADMIN_ALL__');

      // Viktig 7078:
      // Ikke stol blindt på lokalt firma_id-filter. I produksjon kan eksisterende
      // kunder ligge på firma_id som ikke matcher den nye rollemodellen, mens
      // Supabase/RLS likevel tillater radene. Derfor: prøv firmafilter først,
      // men fall tilbake til ufiltrert select hvis filteret gir 0 rader.
      // Ufiltrert betyr ikke "alle kunder" for vanlige brukere; RLS i Supabase
      // begrenser fortsatt hva brukeren får lov å lese.
      async function hentKunderMedFallback() {
        var q = c.from('hand_kunde').select('*').order('navn', { ascending: true });
        if (!erSysadminAlle) q = q.in('firma_id', cx.firmaIder);
        var r = await q;
        if (r.error) {
          var all1 = await c.from('hand_kunde').select('*').order('navn', { ascending: true });
          if (!all1.error) return all1;
          return r;
        }
        if (!erSysadminAlle && Array.isArray(r.data) && r.data.length === 0) {
          var all2 = await c.from('hand_kunde').select('*').order('navn', { ascending: true });
          if (!all2.error && Array.isArray(all2.data) && all2.data.length) return all2;
        }
        return r;
      }

      var kr = await hentKunderMedFallback();
      if (kr.error) { msg('Feil ved henting av kunder: ' + kr.error.message); kunder = []; prosjekter = []; window.kunder = kunder; window.prosjekter = prosjekter; visKunder(); return []; }
      kunder = Array.isArray(kr.data) ? kr.data : [];

      var kundeIds = kunder.map(function (k) { return s(k.id); }).filter(Boolean);
      if (kundeIds.length) {
        var prq = c.from('hand_prosjekt').select('*').in('kunde_id', kundeIds).order('navn', { ascending: true });
        var pr = await prq;
        prosjekter = (!pr.error && Array.isArray(pr.data)) ? pr.data : [];
      } else {
        prosjekter = [];
      }

      window.kunder = kunder;
      window.prosjekter = prosjekter;
      visKunder();
      fyllKundeDropdown();
      fyllFakturaKundeDropdown();
      msg(kunder.length ? '' : 'Ingen kunder funnet for dette firmaet.');
      return kunder;
    } catch (e) {
      console.error('lastKunder feilet:', e);
      msg('Kundelisten feilet: ' + (e && e.message ? e.message : e));
      kunder = []; prosjekter = [];
      window.kunder = kunder; window.prosjekter = prosjekter;
      visKunder();
      return [];
    }
  }

  function maxKundenrFraListe(liste) {
    var max = 1000;
    (liste || []).forEach(function (k) {
      var n = parseInt(numOnly(kundenr(k)), 10);
      if (Number.isFinite(n) && n > max) max = n;
    });
    return max;
  }

  async function nesteKundenr(firmaId) {
    var max = maxKundenrFraListe(window.kunder || kunder || []);
    var c = client();
    if (c) {
      try {
        var q = c.from('hand_kunde').select('*');
        if (firmaId) q = q.eq('firma_id', firmaId);
        var r = await q;
        if (!r.error && Array.isArray(r.data)) {
          var dbMax = maxKundenrFraListe(r.data);
          if (dbMax > max) max = dbMax;
        }
      } catch (e) {}
    }
    return String(max + 1);
  }

  async function lagreKunde() {
    var c = client(); if (!c) { msg('Supabase er ikke lastet.'); return; }
    var cx = await finnFirmaKontekst();
    if (!cx.isAdmin && !cx.isSysadmin) { msg('Du mangler adminrettighet for å lagre kunde.'); return; }
    if (!cx.firmaId && !cx.isSysadmin) { msg('Fant ikke firma_id for kunde.'); return; }

    var id = s($('kundeId') && $('kundeId').value);
    var nr = s($('kundeNr') && $('kundeNr').value) || s($('kundeNrVis') && $('kundeNrVis').value);
    if (!id || !nr || /automatisk/i.test(nr)) nr = await nesteKundenr(cx.firmaId);
    var data = {
      navn: s($('kundeNavn') && $('kundeNavn').value),
      adresse: s($('kundeAdresse') && $('kundeAdresse').value),
      epost: s($('kundeEpost') && $('kundeEpost').value),
      telefon: s($('kundeTelefon') && $('kundeTelefon').value),
      kontaktperson: s($('kundeKontaktperson') && $('kundeKontaktperson').value),
      kontonr: s($('kundeKontonr') && $('kundeKontonr').value),
      timepris: moneyNum($('kundeTimepris') && $('kundeTimepris').value),
      kundenr: nr,
      firma_id: cx.firmaId || null
    };
    if (!data.navn) { msg('Kundenavn må fylles ut.'); return; }

    var r = id ? await c.from('hand_kunde').update(data).eq('id', id).select() : await c.from('hand_kunde').insert([data]).select();
    if (r.error && /column|kolonne|does not exist|schema cache/i.test(String(r.error.message || ''))) {
      delete data.kundenr; data.kunde_nr = nr;
      r = id ? await c.from('hand_kunde').update(data).eq('id', id).select() : await c.from('hand_kunde').insert([data]).select();
    }
    if (r.error) { msg('Feil ved lagring av kunde: ' + r.error.message); return; }
    ['kundeId','kundeNavn','kundeAdresse','kundeEpost','kundeTelefon','kundeKontaktperson','kundeKontonr','kundeTimepris','kundeNr','kundeNrVis'].forEach(function (id2) { var el = $(id2); if (el) el.value = ''; });
    var btn = $('leggTilKundeKnapp'); if (btn) btn.textContent = 'Lagre kunde';
    await lastKunder();
    msg(id ? 'Kunde endret.' : 'Kunde lagret med kundenr ' + nr + '.');
  }

  function redigerKunde(id) {
    var k = (window.kunder || []).find(function (x) { return s(x.id) === s(id); });
    if (!k) { msg('Fant ikke kunde.'); return; }
    [['kundeId', k.id], ['kundeNavn', k.navn], ['kundeAdresse', k.adresse], ['kundeEpost', k.epost || k.email], ['kundeTelefon', k.telefon || k.telefonnr || k.mobil], ['kundeKontaktperson', k.kontaktperson], ['kundeKontonr', k.kontonr], ['kundeTimepris', timeprisVerdi(k)], ['kundeNr', kundenr(k)], ['kundeNrVis', kundenr(k)]].forEach(function (p) { var el = $(p[0]); if (el) el.value = s(p[1]); });
    var btn = $('leggTilKundeKnapp'); if (btn) btn.textContent = 'Lagre endringer';
    msg('Redigerer kunde: ' + s(k.navn));
  }

  function fyllSelect(id, tekst) {
    var sel = $(id); if (!sel) return;
    var old = sel.value || '';
    sel.innerHTML = '';
    var first = document.createElement('option'); first.value = ''; first.textContent = tekst || 'Velg kunde'; sel.appendChild(first);
    (window.kunder || []).forEach(function (k) {
      var opt = document.createElement('option');
      opt.value = s(k.id);
      opt.dataset.kundenr = kundenr(k);
      opt.dataset.timepris = timeprisVerdi(k);
      opt.textContent = kundenr(k) ? (kundenr(k) + ' - ' + s(k.navn || 'Kunde')) : s(k.navn || 'Kunde');
      sel.appendChild(opt);
    });
    if (old && Array.from(sel.options).some(function (o) { return o.value === old; })) sel.value = old;
  }

  function fyllKundeDropdown() {
    fyllSelect('kundeValg', 'Velg kunde');
    fyllSelect('modulKundeVelger', 'Velg kunde');
    visKundeNavn();
  }
  function fyllFakturaKundeDropdown() {
    fyllSelect('fakturaKundeValg', 'Velg kunde');
    fyllSelect('okonomiKundeValg', 'Velg kunde');
  }
  function finnKundeFraValg(verdi) {
    var v = s(verdi);
    return (window.kunder || []).find(function (k) { return s(k.id) === v || s(kundeNr(k)) === v || low(k.navn) === low(v); }) || null;
  }
  function kundeNr(k) { return kundenr(k); }
  function visKundeNavn() {
    var sel = $('kundeValg');
    var felt = $('kundeNrVisning');
    if (!sel || !felt) return;
    var val = s(sel.value);
    var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
    var nr = s(opt && opt.dataset && (opt.dataset.kundenr || opt.dataset.kundeNr || opt.dataset.kunde_nr));
    if (!nr && val) {
      var k = finnKundeFraValg(val);
      nr = kundenr(k);
    }
    if (!nr && opt) {
      var txt = s(opt.textContent);
      var m = txt.match(/^\s*([^\s\-–—]+)\s*[-–—]\s+/);
      if (m) nr = s(m[1]);
    }
    if (val) {
      felt.value = nr || felt.value || '';
    } else {
      felt.value = '';
    }
  }

  function escapeRegExp(v) {
    return s(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }



  function handFinnValgtKundeObjekt() {
    var sel = $('kundeValg');
    if (!sel) return null;
    return finnKundeFraValg(sel.value);
  }

  function handFinnProsjektObjekt(prosjektId) {
    var id = s(prosjektId);
    return (window.prosjekter || []).find(function (p) { return s(p.id) === id; }) || null;
  }

  function handOppdaterTimeprisFraKundeProsjekt() {
    var felt = $('timepris');
    if (!felt) return;
    var prosjektId = s($('prosjektValg') && $('prosjektValg').value);
    var pris = '';
    if (prosjektId) pris = timeprisVerdi(handFinnProsjektObjekt(prosjektId));
    if (!pris) pris = timeprisVerdi(handFinnValgtKundeObjekt());
    if (pris) felt.value = pris;
  }

  function nesteProsjektNrForKunde(kundeId) {
    var k = (window.kunder || []).find(function (x) { return s(x.id) === s(kundeId); });
    var base = kundenr(k) || 'P';
    var max = 0;
    var re = new RegExp('^' + escapeRegExp(base) + '[-_ ]?(\\d+)$');
    (window.prosjekter || []).filter(function (p) { return s(p.kunde_id) === s(kundeId); }).forEach(function (p) {
      var pn = s(p.prosjekt_nr || p.prosjektnr || p.prosjektNr || p.nr);
      var m = pn.match(re);
      var n = m ? parseInt(m[1], 10) : 0;
      if (!n) {
        var bits = pn.match(/(\d+)$/);
        n = bits ? parseInt(bits[1], 10) : 0;
      }
      if (Number.isFinite(n) && n > max) max = n;
    });
    return base + '-' + (max + 1);
  }



  function oppdaterProsjektPrisfelt() {
    var ft = $('prosjektFakturatype');
    var timeFelt = $('prosjektTimeprisFelt') || ($('prosjektTimepris') && $('prosjektTimepris').closest('.felt'));
    var fastFelt = $('prosjektFastprisFelt') || ($('prosjektFastpris') && $('prosjektFastpris').closest('.felt'));
    var erFastpris = low(ft && ft.value) === 'fastpris';
    if (timeFelt) timeFelt.style.display = erFastpris ? 'none' : '';
    if (fastFelt) fastFelt.style.display = erFastpris ? '' : 'none';
  }

  function kobleProsjektFakturatypeVisning() {
    var ft = $('prosjektFakturatype');
    if (!ft || ft.__prisfeltKoblet) return;
    ft.__prisfeltKoblet = true;
    ft.addEventListener('change', oppdaterProsjektPrisfelt);
    oppdaterProsjektPrisfelt();
  }

  function visProsjektVindu() {
    var kundeId = s($('kundeId') && $('kundeId').value);
    if (!kundeId) { msg('Velg kunde med Rediger først.'); return; }
    var o = $('prosjektOverlay'), v = $('prosjektVindu');
    if (o) o.style.display = 'block';
    if (v) v.style.display = 'block';
    var pn = $('prosjektNr');
    if (pn) pn.value = nesteProsjektNrForKunde(kundeId);
    var pt = $('prosjektTimepris');
    var pf = $('prosjektFastpris');
    var ft = $('prosjektFakturatype');
    var k = (window.kunder || []).find(function (x) { return s(x.id) === s(kundeId); });
    if (pt) pt.value = timeprisVerdi(k);
    if (pf) pf.value = '';
    if (ft) ft.value = 'time';
    kobleProsjektFakturatypeVisning();
    oppdaterProsjektPrisfelt();
  }
  function skjulProsjektVindu() { var o = $('prosjektOverlay'), v = $('prosjektVindu'); if (o) o.style.display = 'none'; if (v) v.style.display = 'none'; }

  async function lagreProsjektForValgtKunde() {
    var c = client(); if (!c) { msg('Supabase er ikke lastet.'); return; }
    var cx = await finnFirmaKontekst();
    var kundeId = s($('kundeId') && $('kundeId').value);
    if (!kundeId) { msg('Velg kunde med Rediger først.'); return; }
    var k = (window.kunder || []).find(function (x) { return s(x.id) === kundeId; });
    var navn = s($('prosjektNavn') && $('prosjektNavn').value);
    var bes = s($('prosjektBeskrivelse') && $('prosjektBeskrivelse').value);
    var tpris = moneyNum($('prosjektTimepris') && $('prosjektTimepris').value);
    var fpris = moneyNum($('prosjektFastpris') && $('prosjektFastpris').value);
    var ftype = s($('prosjektFakturatype') && $('prosjektFakturatype').value) || 'time';
    ftype = low(ftype) === 'fastpris' ? 'fastpris' : 'time';
    if (!navn) { msg('Prosjektnavn må fylles ut.'); return; }
    var pn = s($('prosjektNr') && $('prosjektNr').value) || nesteProsjektNrForKunde(kundeId);
    var data = { kunde_id: kundeId, prosjekt_nr: pn, navn: navn, beskrivelse: bes, timepris: tpris, fastpris: fpris, fakturatype: ftype, aktiv: true, firma_id: (k && k.firma_id) || cx.firmaId || null };
    var r = await c.from('hand_prosjekt').insert([data]).select();
    if (r.error && /column|kolonne|does not exist|schema cache/i.test(String(r.error.message || ''))) {
      var data2 = { kunde_id: kundeId, prosjektnr: pn, navn: navn, beskrivelse: bes, timepris: tpris, fastpris: fpris, fakturatype: ftype, aktiv: true, firma_id: (k && k.firma_id) || cx.firmaId || null };
      r = await c.from('hand_prosjekt').insert([data2]).select();
    }
    if (r.error) { msg('Feil ved lagring av prosjekt: ' + r.error.message); return; }
    ['prosjektNr','prosjektNavn','prosjektTimepris','prosjektFastpris','prosjektFakturatype','prosjektBeskrivelse'].forEach(function (id) { var el = $(id); if (el) el.value = id === 'prosjektFakturatype' ? 'time' : ''; });
    skjulProsjektVindu();
    await lastKunder();
    msg('Prosjekt lagret.');
  }

  function visKundeSideStabil() {
    try {
      var app = $('appSide'); if (app) { app.classList.remove('skjult','hidden','ril-starter'); app.hidden = false; app.style.display = ''; }
      ['timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','ansattSide','firmaSide','testSide','testpanelSide','lonnPanel','lonnSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','sysadminPanelSide','adminSide'].forEach(function (id) {
        var el = $(id); if (el) { el.classList.add('skjult','hidden'); el.hidden = true; el.style.display = 'none'; }
      });
      var side = $('kundeSide') || $('kunderSide');
      if (side) { side.classList.remove('skjult','hidden','modul-skjult'); side.hidden = false; side.style.display = ''; }
      if (typeof window.settHandSideOverskrift === 'function') window.settHandSideOverskrift('Kunder');
      setTimeout(lastKunder, 0);
    } catch (e) {
      console.error('visKundeSideStabil feilet:', e);
      msg('Kundesiden feilet: ' + (e && e.message ? e.message : e));
    }
  }

  function nullstillKundeSkjema() {
    ['kundeId','kundeNavn','kundeAdresse','kundeEpost','kundeTelefon','kundeKontaktperson','kundeKontonr','kundeTimepris','kundeNr','kundeNrVis'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var btn = $('leggTilKundeKnapp');
    if (btn) btn.textContent = 'Lagre kunde';
    var nr = $('kundeNr') || $('kundeNrVis');
    (async function () {
      var cx = await finnFirmaKontekst();
      var nytt = await nesteKundenr(cx && cx.firmaId);
      if (nr) nr.value = nytt;
    })();
    msg('Ny kunde. Fyll inn navn og trykk Lagre kunde. Kundenr genereres automatisk.');
  }

  function bind() {
    var ny = $('nyKundeKnapp'); if (ny && !ny.__kunde7077) { ny.__kunde7077 = true; ny.addEventListener('click', function (e) { e.preventDefault(); nullstillKundeSkjema(); }); }
    var b = $('leggTilKundeKnapp'); if (b && !b.__kunde7077) { b.__kunde7077 = true; b.addEventListener('click', function (e) { e.preventDefault(); lagreKunde(); }); }
    var a = $('avbrytKundeRedigeringKnapp'); if (a && !a.__kunde7077) { a.__kunde7077 = true; a.addEventListener('click', function () { nullstillKundeSkjema(); msg(''); }); }
    var t = $('tilbakeTilTimerKnapp'); if (t && !t.__kunde7077) { t.__kunde7077 = true; t.addEventListener('click', function () { if (typeof window.visTimerSide === 'function') window.visTimerSide(); }); }
    var vk = $('visKundeKnapp'); if (vk && !vk.__kunde7077) { vk.__kunde7077 = true; vk.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); visKundeSideStabil(); }, true); }
  }

  window.handFinnFirmaKontekstForKunder = finnFirmaKontekst;
  window.lastKunder = lastKunder;
  window.handLastKunderForFirma = lastKunder;
  window.visKunder = visKunder;
  window.tegnKundeListe = visKunder;
  window.tegnKunder = fyllKundeDropdown;
  window.lagreKunde = lagreKunde;
  window.nullstillKundeSkjema = nullstillKundeSkjema;
  window.redigerKunde = redigerKunde;
  window.fyllKundeDropdown = fyllKundeDropdown;
  window.fyllFakturaKundeDropdown = fyllFakturaKundeDropdown;
  window.finnKundeFraValg = finnKundeFraValg;
  window.hentKundeNr = kundenr;
  window.nesteKundenr = nesteKundenr;
  window.visKundeNavn = visKundeNavn;
  window.visProsjektVindu = visProsjektVindu;
  window.skjulProsjektVindu = skjulProsjektVindu;
  window.lagreProsjektForValgtKunde = lagreProsjektForValgtKunde;
  window.nesteProsjektNrForKunde = nesteProsjektNrForKunde;
  window.handOppdaterTimeprisFraKundeProsjekt = handOppdaterTimeprisFraKundeProsjekt;
  window.oppdaterProsjektPrisfelt = oppdaterProsjektPrisfelt;
  window.handHentKundeTimepris = function (kunde) { return timeprisVerdi(kunde); };
  window.handHentProsjektTimepris = function (prosjektId) { return timeprisVerdi(handFinnProsjektObjekt(prosjektId)); };
  window.handHentProsjektFastpris = function (prosjektId) { return fastprisVerdi(handFinnProsjektObjekt(prosjektId)); };
  window.handHentProsjektFakturatype = function (prosjektId) { return fakturatypeVerdi(handFinnProsjektObjekt(prosjektId)); };
  window.visKundeSide = visKundeSideStabil;

  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'kundeValg') { visKundeNavn(); setTimeout(handOppdaterTimeprisFraKundeProsjekt, 0); } if (e.target && e.target.id === 'prosjektValg') handOppdaterTimeprisFraKundeProsjekt(); }, true);
  function startKundevalg() {
    bind();
    // Fyll kundevalg også på Timer-siden for vanlige ansatte.
    setTimeout(lastKunder, 100);
    setTimeout(lastKunder, 800);
  }
  document.addEventListener('handPartialerLastet', startKundevalg, false);
  document.addEventListener('DOMContentLoaded', function () { kobleProsjektFakturatypeVisning(); startKundevalg(); }, false);
  window.addEventListener('load', startKundevalg, false);
  setTimeout(bind, 500);
})();
