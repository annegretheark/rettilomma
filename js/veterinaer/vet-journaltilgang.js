/* Veterinær produksjon: Journaltilgang
   Leser hvem som åpnet hvilken journal fra vet_journal_apning_logg. */

(function(){
  function esc(v){
    return String(v ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }
  function formatTid(v){
    if (!v) return '';
    try { return new Date(v).toLocaleString('no-NO'); } catch(e) { return String(v); }
  }

  window.skjulJournaltilgang = function(){
    if (typeof window.visVetSide === 'function') window.visVetSide('eierSide');
    else if (typeof visVetSide === 'function') visVetSide('eierSide');
  };

  window.lastJournalLogg = async function(){
    const liste = document.getElementById('journalLoggListe');
    if (!liste) return;
    liste.innerHTML = '<p class="lite">Laster journaltilgang ...</p>';

    try{
      if (!window.supabaseClient) throw new Error('Supabase er ikke lastet.');

      const { data:userData } = await supabaseClient.auth.getUser();
      const epost = String(userData?.user?.email || '').toLowerCase();

      let q = supabaseClient
        .from('vet_journal_apning_logg')
        .select('id,klinikk_id,journal_id,dyr_id,dyreeier_id,auth_user_id,klinikk_bruker_id,bruker_epost,bruker_navn,journal_dato,journal_type,dyr_navn,dyreeier_navn,kilde,apnet_at,created_at')
        .order('apnet_at', { ascending:false })
        .limit(100);

      let erAdmin = false;
      try { erAdmin = typeof erKlinikkAdmin === 'function' ? erKlinikkAdmin() : false; } catch(e) {}
      try { if (typeof vetErSystemAdmin !== 'undefined' && vetErSystemAdmin) erAdmin = true; } catch(e) {}
      if (!erAdmin && epost) q = q.eq('bruker_epost', epost);

      const { data, error } = await q;
      if (error) throw error;

      const rader = data || [];
      if (!rader.length) {
        liste.innerHTML = '<p class="lite">Ingen journaltilgang er logget ennå.</p>';
        return;
      }

      liste.innerHTML = rader.map(r => {
        const dyr = r.dyr_navn || 'Ukjent dyr';
        const eier = r.dyreeier_navn || 'Ukjent dyreeier';
        const bruker = r.bruker_navn || r.bruker_epost || 'Ukjent bruker';
        const brukerEpost = r.bruker_epost ? ' (' + r.bruker_epost + ')' : '';
        const journalDato = r.journal_dato ? 'Journaldato: ' + r.journal_dato : 'Journaldato mangler';
        const journalType = r.journal_type || 'Journal';
        const apnet = formatTid(r.apnet_at || r.created_at);

        return '<div class="listekort">' +
          '<strong>' + esc(bruker) + esc(brukerEpost) + '</strong>' +
          '<br><span class="lite">Åpnet journal: ' + esc(journalType) + '</span>' +
          '<br><span class="lite">Dyr: ' + esc(dyr) + ' · Dyreeier: ' + esc(eier) + '</span>' +
          '<br><span class="lite">' + esc(journalDato) + ' · Åpnet: ' + esc(apnet) + '</span>' +
          '</div>';
      }).join('');
    } catch(e) {
      liste.innerHTML = '<div class="melding">Kunne ikke hente journaltilgang: ' + esc(e?.message || e) + '</div>';
    }
  };

  document.addEventListener('click', function(e){
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute('onclick') === "visVetSide('journalLoggSide')") {
      setTimeout(window.lastJournalLogg, 100);
    }
  });
})();
