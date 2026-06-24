/* Endelig lagerfix: vis og bruk faktisk lager fra hand_vare.
   Ingen hardkoding av bruker. Lastes sist. */
(function () {
  'use strict';

  function tall(raw) {
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const n = Number(s.replace(/\s/g, '').replace('kr', '').replace('NOK', '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function hent(v, keys) {
    for (const k of keys) {
      const n = tall(v && v[k]);
      if (n !== null) return n;
    }
    return 0;
  }

  window.vareHovedlager = function (v) {
    return hent(v, [
      'lager_antall', 'hovedlager', 'hoved_lager', 'hovedlager_antall',
      'antall', 'beholdning', 'lager', 'pa_lager', 'på_lager',
      'Hovedlager', 'Hoved lager', 'På lager', 'Pa lager', 'Lager', 'Antall'
    ]);
  };

  window.vareMinimum = function (v) {
    return hent(v, ['minimum_antall', 'min_antall', 'minimum', 'min', 'Min', 'Minimum']);
  };

  function patchSynligeLagerceller() {
    const liste = Array.isArray(window.varerTilBilLager) ? window.varerTilBilLager : [];
    if (!liste.length) return;
    const table = document.querySelector('#bilLagerFyllListe table');
    if (table) {
      Array.from(table.querySelectorAll('tbody tr')).forEach((tr, idx) => {
        const v = liste[idx];
        if (!v) return;
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 6) {
          tds[4].textContent = String(window.vareHovedlager(v));
          tds[5].textContent = String(window.vareMinimum(v));
        }
      });
    }
    document.querySelectorAll('#bilLagerFyllListe .ril-fyllbil-mobilkort').forEach((card, idx) => {
      const v = liste[idx];
      const info = card.querySelector('.info');
      if (v && info && /hovedlager/i.test(info.textContent || '')) {
        info.textContent = 'På hovedlager: ' + window.vareHovedlager(v);
      }
    });
  }

  let obs;
  function start() {
    const el = document.getElementById('bilLagerFyllListe') || document.body;
    if (!obs) obs = new MutationObserver(() => setTimeout(patchSynligeLagerceller, 0));
    try { obs.observe(el, { childList: true, subtree: true }); } catch (e) {}
    patchSynligeLagerceller();
    setTimeout(patchSynligeLagerceller, 300);
    setTimeout(patchSynligeLagerceller, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  document.addEventListener('handPartialerLastet', start);
})();
