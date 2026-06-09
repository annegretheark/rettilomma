/* ===== HARD FINAL: SMAL MIN BIL / FYLL BIL 09.06 - CHECKBOX BEHOLDES ===== */
(function(){
  function $(id){return document.getElementById(id);} 
  function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
  function arr(n){try{return Function("return (typeof "+n+" !== 'undefined' ? "+n+" : [])")()||[]}catch(e){return []}}
  function tekst(id){return typeof vetTekst==='function'?vetTekst(id):String($(id)?.value||'').trim()}
  function antall(v){const n=Number(v||0);return Number.isFinite(n)?Math.round(n).toLocaleString('nb-NO',{maximumFractionDigits:0}):'0'}
  function vare(vareId){return arr('vetVarer').find(v=>String(v.id)===String(vareId))||{};}

  const valgState = {
    minbil: new Map(),
    fyllbil: new Map()
  };

  function lesState(prefix){
    const state = valgState[prefix] || new Map();
    document.querySelectorAll(`.${prefix}-velg, .${prefix}-antall`).forEach(el=>{
      const vareId = String(el.dataset.vareId || '');
      if(!vareId) return;
      const rad = state.get(vareId) || { checked:false, antall:'' };
      if(el.classList.contains(`${prefix}-velg`)) rad.checked = !!el.checked;
      if(el.classList.contains(`${prefix}-antall`)) rad.antall = el.value || '';
      state.set(vareId, rad);
    });
    valgState[prefix] = state;
  }

  function lagreStateFraEvent(e){
    const el = e.target;
    if(!el || !el.dataset || !el.dataset.vareId) return;
    const vareId = String(el.dataset.vareId || '');
    const prefix = el.classList.contains('minbil-velg') || el.classList.contains('minbil-antall') ? 'minbil' :
                   el.classList.contains('fyllbil-velg') || el.classList.contains('fyllbil-antall') ? 'fyllbil' : '';
    if(!prefix || !vareId) return;
    const state = valgState[prefix] || new Map();
    const rad = state.get(vareId) || { checked:false, antall:'' };
    if(el.classList.contains(`${prefix}-velg`)) rad.checked = !!el.checked;
    if(el.classList.contains(`${prefix}-antall`)) {
      rad.antall = el.value || '';
      const cb = document.getElementById(`${prefix}_velg_${vareId}`);
      if(cb && el.value && Number(String(el.value).replace(',', '.')) > 0) {
        cb.checked = true;
        rad.checked = true;
      }
    }
    state.set(vareId, rad);
    valgState[prefix] = state;
  }

  document.addEventListener('change', lagreStateFraEvent, true);
  document.addEventListener('input', lagreStateFraEvent, true);

  function hoved(){
    const m=new Map();
    arr('vetHovedlager').filter(r=>Number(r.antall||0)>0).forEach(r=>{
      const k=String(r.vare_id||'');
      if(!k)return;
      const v=r.vet_varer||vare(r.vare_id)||{};
      const g=m.get(k);
      if(g){
        g.antall=Number(g.antall||0)+Number(r.antall||0);
        if(!g.vare?.navn)g.vare=v;
      } else m.set(k,{...r,vare:v});
    });
    return [...m.values()].filter(r=>r.vare?.navn);
  }

  function css(){
    if($('vetHardSmalCss'))return;
    const st=document.createElement('style');
    st.id='vetHardSmalCss';
    st.textContent=`
      .vet-hard-smal{display:grid;gap:1px;margin-top:6px;font-size:12px!important;}
      .vet-hard-head,.vet-hard-row{display:grid;grid-template-columns:24px minmax(180px,2fr) 54px 46px 58px;gap:5px;align-items:center;}
      .vet-hard-head{padding:2px 6px;background:#111827;border:1px solid #374151;font-weight:bold;color:#f8fafc;min-height:22px;}
      .vet-hard-row{padding:1px 6px;border:1px solid #374151;background:#1f2427;min-height:24px;cursor:default;}
      .vet-hard-row:hover{background:#252b2f;}
      .vet-hard-row span{font-size:12px!important;line-height:1.1!important;}
      .vet-hard-row input[type="checkbox"]{width:14px;height:14px;margin:0;cursor:pointer;}
      .vet-hard-row input[type="number"]{width:52px;height:22px;margin:0;padding:1px 4px;font-size:12px!important;border-radius:5px;}
      .vet-hard-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f3f4f6;font-weight:600;}
      .vet-hard-small{white-space:nowrap;color:#cbd5e1;}
    `;
    document.head.appendChild(st);
  }

  function html(prefix, inputCls, checkCls){
    const rows=hoved();
    if(!rows.length)return '<p class="lite">Ingen varer på hovedlager.</p>';
    const state = valgState[prefix] || new Map();
    return `<div class="vet-hard-smal"><div class="vet-hard-head"><span></span><span>Vare</span><span>Lager</span><span>Enh.</span><span>Antall</span></div>${rows.map(r=>{
      const v=r.vare||{};
      const rawId = String(r.vare_id || '');
      const id=esc(rawId);
      const s = state.get(rawId) || { checked:false, antall:'' };
      const checked = s.checked ? ' checked' : '';
      const verdi = esc(s.antall || '');
      return `<div class="vet-hard-row" data-vare-id="${id}"><input id="${prefix}_velg_${id}" class="${checkCls}" data-vare-id="${id}" type="checkbox"${checked}><label class="vet-hard-name" for="${prefix}_velg_${id}" title="${esc(v.navn||'')}">${esc(v.navn||'Vare')}</label><span class="vet-hard-small">${antall(r.antall)}</span><span class="vet-hard-small">${esc(v.enhet||'stk')}</span><input id="${prefix}_antall_${id}" class="${inputCls}" data-vare-id="${id}" type="number" step="1" min="1" max="${Math.floor(Number(r.antall||0))}" placeholder="0" value="${verdi}"></div>`
    }).join('')}</div>`
  }

  function draw(){
    css();
    lesState('minbil');
    lesState('fyllbil');
    const aktiv = document.activeElement;
    const aktivId = aktiv && aktiv.id ? aktiv.id : '';
    const aktivErInput = aktiv && (aktiv.classList?.contains('minbil-antall') || aktiv.classList?.contains('fyllbil-antall'));

    const a=$('minBilFyllListe');
    if(a) a.innerHTML=html('minbil','minbil-antall','minbil-velg');
    const b=$('fyllBilFyllListe');
    if(b) b.innerHTML=html('fyllbil','fyllbil-antall','fyllbil-velg');

    if(aktivErInput && aktivId && $(aktivId)) {
      const ny = $(aktivId);
      ny.focus();
      try { ny.setSelectionRange(ny.value.length, ny.value.length); } catch(e) {}
    }
  }

  window.tegnMinBilFyllListe=draw;
  window.tegnFyllBilFyllListe=draw;

  const oldShow=window.visLagerFane;
  if(typeof oldShow==='function') window.visLagerFane=function(){const r=oldShow.apply(this,arguments); setTimeout(draw,20); return r;};
  const oldFill=window.fyllMinBilSide;
  if(typeof oldFill==='function') window.fyllMinBilSide=function(){const r=oldFill.apply(this,arguments); setTimeout(draw,20); return r;};

  document.addEventListener('DOMContentLoaded',()=>setTimeout(draw,600));
  window.addEventListener('load',()=>setTimeout(draw,800));

  // Ikke tegn listen på nytt hele tiden, for da kan avhuking oppleves som at den forsvinner.
  // Tegn bare forsiktig etter lageroppdatering/sidebytte.
  window.vetHardSmalListeDraw = draw;
})();
