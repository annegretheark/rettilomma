/* Direkte kundeliste-fix 2026-06-20
   Supabase-skjermbildet viser at kunder/firma ligger i public.hand_firma med feltene id og navn.
   Denne filen fyller Moduler, Faktura og Økonomi direkte fra hand_firma.
*/
(function(){
  const IDS = ['modulKundeVelger','fakturaKundeValg','okonomiKundeValg'];
  function $(id){ return document.getElementById(id); }
  function client(){
    try { if (window.supabaseClient) return window.supabaseClient; } catch(e) {}
    try { if (typeof supabaseClient !== 'undefined') return supabaseClient; } catch(e) {}
    return null;
  }
  function safeText(v){ return String(v == null ? '' : v); }
  function optionText(row){
    const navn = row.navn || row.firmanavn || row.firma_navn || row.kunde_navn || row.epost || row.email || row.id;
    const org = row.orgnr || row.organisasjonsnummer || '';
    return org ? `${navn} (${org})` : safeText(navn);
  }
  function showMessage(text, isError){
    const ids = ['modulStatus','modulMelding','fakturaMelding','handKundelisteStatus'];
    let el = ids.map($).find(Boolean);
    if (!el) {
      const near = $('modulKundeVelger') || $('fakturaKundeValg') || $('okonomiKundeValg');
      if (near && near.parentNode) {
        el = document.createElement('div');
        el.id = 'handKundelisteStatus';
        el.style.margin = '8px 0';
        near.parentNode.insertBefore(el, near.nextSibling);
      }
    }
    if (el) {
      el.textContent = text || '';
      el.style.color = isError ? '#ffb4b4' : '#b7f7c9';
      el.style.whiteSpace = 'pre-wrap';
    }
    if (isError) console.warn('[hand_firma kundeliste]', text);
  }
  async function hentFirmaDirekte(){
    const sb = client();
    if (!sb) throw new Error('Supabase-klient er ikke klar ennå.');
    const res = await sb.from('hand_firma').select('id,navn,orgnr,telefon,adresse').order('navn', { ascending: true });
    if (res.error) throw res.error;
    return Array.isArray(res.data) ? res.data : [];
  }
  function fyllSelect(select, firmaer){
    if (!select) return;
    const gammel = select.value || '';
    const isOkonomi = select.id === 'okonomiKundeValg';
    const tekst = isOkonomi ? 'Alle kunder' : (firmaer.length ? 'Velg kunde/firma' : 'Ingen kunder funnet');
    select.innerHTML = '';
    const start = document.createElement('option');
    start.value = '';
    start.textContent = tekst;
    select.appendChild(start);
    firmaer.forEach(row => {
      if (!row || !row.id) return;
      const opt = document.createElement('option');
      opt.value = row.id;
      opt.textContent = optionText(row);
      select.appendChild(opt);
    });
    if (gammel && Array.from(select.options).some(o => String(o.value) === String(gammel))) select.value = gammel;
  }
  async function fyllAlleFirmaVelgere(){
    try {
      const firmaer = await hentFirmaDirekte();
      window.handAdminKunder = firmaer;
      window.kunder = firmaer;
      IDS.forEach(id => fyllSelect($(id), firmaer));
      if (!firmaer.length) {
        showMessage('hand_firma ble lest, men returnerte 0 rader. Sjekk RLS-policy for SELECT i Supabase.', true);
      } else {
        showMessage(`Kundeliste hentet fra hand_firma: ${firmaer.length} firma.`, false);
      }
      return firmaer;
    } catch (e) {
      showMessage('Kundeliste kunne ikke hentes fra hand_firma: ' + (e.message || String(e)) + '\nDette er ofte RLS-policy. Se filen SUPABASE_RLS_HAND_FIRMA.sql i ZIP-en.', true);
      IDS.forEach(id => {
        const sel = $(id);
        if (sel && sel.options.length === 0) fyllSelect(sel, []);
      });
      return [];
    }
  }
  window.handHentKunderTrygt = fyllAlleFirmaVelgere;
  window.handFyllAlleKundevalg = fyllAlleFirmaVelgere;
  window.handFyllFirmaVelgereDirekte = fyllAlleFirmaVelgere;

  function schedule(){
    [50,200,700,1500,3000].forEach(ms => setTimeout(fyllAlleFirmaVelgere, ms));
  }
  document.addEventListener('DOMContentLoaded', schedule);
  document.addEventListener('handPartialerLastet', schedule);
  window.addEventListener('load', schedule);

  const gammelMod = window.visModulerSide;
  window.visModulerSide = async function(){
    const r = typeof gammelMod === 'function' ? await gammelMod.apply(this, arguments) : undefined;
    schedule();
    return r;
  };
  const gammelFak = window.visFakturaSide;
  window.visFakturaSide = function(){
    const r = typeof gammelFak === 'function' ? gammelFak.apply(this, arguments) : undefined;
    schedule();
    return r;
  };
})();
