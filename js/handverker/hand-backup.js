/* Rett i Lomma - databasebackup for admin og sysadm */
(function(){
  'use strict';
  const TABLES = [
    'hand_firma','hand_firma_bruker','hand_ansatt','hand_kunde','hand_bil','hand_bil_lager','hand_vare','hand_time','hand_jobb','hand_prosjekt','hand_tilbud','hand_tilbud_linje','hand_faktura','hand_lagerlogg','hand_backup_arkiv'
  ];
  function $(id){ return document.getElementById(id); }
  function msg(id, tekst, feil){ const e=$(id)||$('backupMelding')||$('sysadmBackupMelding'); if(e){ e.textContent=tekst||''; e.style.color=feil?'#fca5a5':'#86efac'; } if(feil) console.error(tekst); else if(tekst) console.log(tekst); }
  function email(){ return String(window.innloggetEpost||localStorage.getItem('handInnloggetEpost')||localStorage.getItem('innloggetEpost')||'').toLowerCase(); }
  function erSysadm(){ return window.erSystemadmin===true || ['sysadm','sysadmin','systemadmin'].includes(String(window.innloggetRolle||localStorage.getItem('handInnloggetRolle')||'').toLowerCase()) || localStorage.getItem('rilSysadminModus')==='ja'; }
  function aktivFirma(){ return window.aktivFirmaId || localStorage.getItem('aktivFirmaId') || localStorage.getItem('firmaId') || localStorage.getItem('firma_id') || ''; }
  async function erSysadmDb(){ if(!window.supabaseClient) return false; try{ const r=await supabaseClient.from('hand_sysadm').select('id').ilike('epost', email()).eq('aktiv', true).limit(1); if(!r.error && r.data && r.data.length){ if(window.handSysadmForce) window.handSysadmForce(); return true; } }catch(e){} return erSysadm(); }
  async function hentFirmaListe(){
    if(!window.supabaseClient) return [];
    try{ const r=await supabaseClient.from('hand_firma').select('*').order('navn',{ascending:true}); if(!r.error) return r.data||[]; }catch(e){}
    return [];
  }
  function firmaNavn(f){ return f?.firma_navn || f?.navn || f?.firmanavn || f?.name || f?.epost || f?.id || 'Firma'; }
  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]; }); }
  function backupDato(x){ return x.opprettet || x.created_at || ''; }
  function backupType(x){ return x.backup_type || x.type || ''; }
  function backupAv(x){ return x.opprettet_av || x.created_by || ''; }
  function backupFirmaNavn(x, firmaMap){
    if(!x) return 'ALLE FIRMA';
    if(x.firma_navn) return x.firma_navn;
    if(x.navn) return x.navn;
    if(x.firma_id && firmaMap && firmaMap[String(x.firma_id)]) return firmaMap[String(x.firma_id)];
    if(!x.firma_id) return 'ALLE FIRMA';
    return String(x.firma_id);
  }
  async function fyllSysadmFirmaValg(){
    const s=$('sysadmBackupFirmaValg'); if(!s) return;
    const gammel=s.value; s.innerHTML='<option value="__alle__">ALLE FIRMA</option>';
    (await hentFirmaListe()).forEach(f=>{ const o=document.createElement('option'); o.value=f.id; o.textContent=firmaNavn(f); s.appendChild(o); });
    if(gammel && Array.from(s.options).some(o=>o.value===gammel)) s.value=gammel;
  }
  async function selectTableRows(tabell, firmaId){
    try{
      if(tabell==='hand_firma'){
        if(firmaId) return (await supabaseClient.from(tabell).select('*').eq('id', firmaId)).data||[];
        return (await supabaseClient.from(tabell).select('*')).data||[];
      }
      if(tabell==='hand_backup_arkiv') return [];
      let q=supabaseClient.from(tabell).select('*');
      if(firmaId) q=q.eq('firma_id', firmaId);
      const r=await q.limit(5000);
      if(!r.error) return r.data||[];
    }catch(e){ console.warn('Backup hoppet over tabell', tabell, e.message||e); }
    return [];
  }
  async function lagBackup(firmaId, type, meldingId){
    if(!window.supabaseClient) throw new Error('Supabase er ikke lastet.');
    const sys=await erSysadmDb();
    if(!sys && !firmaId) throw new Error('Bare sysadm kan ta backup av alle firma.');
    if(!sys && String(firmaId)!==String(aktivFirma())) throw new Error('Admin kan bare ta backup av eget firma.');
    const payload={ versjon:'sysadm-2.0', tidspunkt:new Date().toISOString(), firma_id:firmaId||null, tables:{} };
    for(const t of TABLES){ payload.tables[t]=await selectTableRows(t, firmaId||''); }
    const firmaRad=(payload.tables.hand_firma||[])[0]||null;
    const {data,error}=await supabaseClient.from('hand_backup_arkiv').insert([{ firma_id:firmaId||null, firma_navn:firmaId?(firmaNavn(firmaRad)||firmaId):'ALLE FIRMA', backup_type:type||'manuell', opprettet_av:email(), data:payload }]).select('id').single();
    if(error) throw error;
    msg(meldingId, 'Backup lagret i databasen.');
    await lastBackupListe();
    return data?.id;
  }
  async function kjorAdminBackup(){ try{ msg('backupMelding','Tar backup...'); await lagBackup(aktivFirma(),'manuell-admin','backupMelding'); }catch(e){ msg('backupMelding','Backup feilet: '+(e.message||e),true); } }
  async function kjorSysadmBackup(){ try{ const s=$('sysadmBackupFirmaValg'); const val=s?.value||'__alle__'; msg('sysadmBackupMelding','Tar backup...'); await lagBackup(val==='__alle__'?null:val,'manuell-sysadm','sysadmBackupMelding'); }catch(e){ msg('sysadmBackupMelding','Backup feilet: '+(e.message||e),true); } }
  async function restoreBackup(id){
    if(!id) return;
    if(!confirm('Restore overskriver/legger tilbake data fra backup. Fortsette?')) return;
    const {data:b,error}=await supabaseClient.from('hand_backup_arkiv').select('*').eq('id',id).single();
    if(error) { alert('Kunne ikke hente backup: '+error.message); return; }
    const sys=await erSysadmDb();
    if(!sys && String(b.firma_id)!==String(aktivFirma())) { alert('Admin kan bare restore eget firma.'); return; }
    const payload=b.data||{}; const tables=payload.tables||{};
    const order=['hand_firma','hand_firma_bruker','hand_ansatt','hand_kunde','hand_bil','hand_vare','hand_bil_lager','hand_prosjekt','hand_jobb','hand_time','hand_tilbud','hand_tilbud_linje','hand_faktura','hand_lagerlogg'];
    for(const t of order){
      const rows=Array.isArray(tables[t])?tables[t]:[]; if(!rows.length) continue;
      try{ const r=await supabaseClient.from(t).upsert(rows,{onConflict:'id'}); if(r.error) console.warn('Restore hoppet over',t,r.error.message); }
      catch(e){ console.warn('Restore hoppet over',t,e.message||e); }
    }
    alert('Restore ferdig. Oppdater siden med Ctrl+F5.');
  }
  async function lastBackupListe(){
    if(!window.supabaseClient) return;
    const sys=await erSysadmDb();
    let q=supabaseClient.from('hand_backup_arkiv').select('id,firma_id,navn,firma_navn,type,backup_type,created_by,opprettet_av,created_at,opprettet').order('opprettet',{ascending:false}).limit(100);
    if(!sys) q=q.eq('firma_id', aktivFirma());
    const r=await q;
    if(r.error){ msg(sys?'sysadmBackupMelding':'backupMelding','Kunne ikke hente backup-liste: '+r.error.message,true); return; }

    const rows = r.data || [];
    const firmaMap = {};
    const ids = Array.from(new Set(rows.map(x=>x && x.firma_id).filter(Boolean)));
    if(ids.length){
      try{
        const fr = await supabaseClient.from('hand_firma').select('id,navn,firma_navn,firmanavn,name').in('id', ids);
        if(!fr.error){ (fr.data||[]).forEach(f=>{ firmaMap[String(f.id)] = firmaNavn(f); }); }
      }catch(e){ console.warn('Kunne ikke hente firmanavn til backup-liste', e.message||e); }
    }

    const html='<table class="bil-tabell" style="width:100%;border-collapse:collapse"><thead><tr><th>Dato</th><th>Firma</th><th>Type</th><th>Av</th><th></th></tr></thead><tbody>'+(rows.map(x=>{
      const d = backupDato(x);
      const dato = d ? new Date(d).toLocaleString('no-NO') : '';
      return '<tr><td>'+esc(dato)+'</td><td>'+esc(backupFirmaNavn(x, firmaMap))+'</td><td>'+esc(backupType(x))+'</td><td>'+esc(backupAv(x))+'</td><td><button type="button" class="secondary" data-restore-backup-id="'+esc(x.id)+'">Restore</button></td></tr>';
    }).join('')||'<tr><td colspan="5">Ingen backup funnet.</td></tr>')+'</tbody></table>';
    const target=sys?$('sysadmBackupListe'):$('backupListe'); if(target) target.innerHTML=html;
  }
  function bind(){
    const b=$('backupKnapp'); if(b) b.onclick=kjorAdminBackup;
    const sb=$('sysadmKjorBackupKnapp'); if(sb) sb.onclick=kjorSysadmBackup;
    const sl=$('sysadmOppdaterBackupListeKnapp'); if(sl) sl.onclick=lastBackupListe;
    document.querySelectorAll('[data-restore-backup-id]').forEach(btn=>{ if(btn.dataset.boundRestore==='1') return; btn.dataset.boundRestore='1'; btn.onclick=()=>restoreBackup(btn.dataset.restoreBackupId); });
    fyllSysadmFirmaValg(); lastBackupListe();
  }
  document.addEventListener('click', function(e){ const btn=e.target&&e.target.closest&&e.target.closest('[data-restore-backup-id]'); if(btn){ e.preventDefault(); restoreBackup(btn.dataset.restoreBackupId); } }, true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,200)); window.addEventListener('load',()=>{setTimeout(bind,500); setTimeout(bind,2000);}); document.addEventListener('handPartialerLastet',()=>setTimeout(bind,200));
  window.handSysadmLastBackupListe=lastBackupListe; window.handKjorSysadmBackup=kjorSysadmBackup; window.backup=kjorAdminBackup; window.handRestoreBackup=restoreBackup;
})();
