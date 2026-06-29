(function(){
  function byId(id){ return document.getElementById(id); }
  function typ(n){ return typeof window[n]; }
  function line(txt){ return "<div style='margin:3px 0'>" + txt + "</div>"; }
  function ok(v){ return v ? "✅" : "❌"; }
  function esc(s){ return String(s).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); }
  function report(){
    var ids=["visJobberKnapp","visHesterKnapp","visKunderKnapp","visFakturaKnapp","visFirmaKnapp","leggTilKundeKnapp","lagreHestKnapp","lagreJobbKnapp","lagFakturaKnapp"];
    var funcs=["visSide","lagreKunde","lagreHest","lagreJobb","lagreJobbMedHestSjekk","fyllFakturaKunder","lagHovKreditnota","hentFakturaOversikt","hentPrislisteTilApp"];
    var html="<b>Hovslager diagnose</b>";
    html+=line("index.html: "+ok(window.__HOV_DIAG_INDEX_LOADED));
    html+=line("hov-navigation.js: "+ok(window.__HOV_DIAG_NAV_LOADED));
    html+=line("hov-app.js: "+ok(window.__HOV_DIAG_HOV_APP_LOADED));
    html+=line("supabaseClient: "+ok(window.supabaseClient));
    html+="<hr style='border-color:#555'>";
    html+="<b>Knapper finnes:</b>";
    ids.forEach(function(id){ html+=line(esc(id)+": "+ok(byId(id))); });
    html+="<hr style='border-color:#555'>";
    html+="<b>Funksjoner finnes:</b>";
    funcs.forEach(function(fn){ html+=line(esc(fn)+": "+esc(typ(fn))); });
    html+="<hr style='border-color:#555'>";
    html+=line("URL: "+esc(location.href));
    html+=line("Tid: "+new Date().toLocaleString());
    var p=byId("hovDiagnosePanel");
    if(!p){
      p=document.createElement("div");
      p.id="hovDiagnosePanel";
      p.style.cssText="position:fixed;right:10px;bottom:10px;z-index:999999;max-width:420px;max-height:75vh;overflow:auto;background:#111;color:#fff;border:2px solid #f59e0b;border-radius:8px;padding:12px;font:14px Arial;box-shadow:0 0 20px rgba(0,0,0,.5)";
      document.body.appendChild(p);
    }
    p.innerHTML=html+"<button type='button' id='hovDiagClose' style='margin-top:8px;background:#555;color:#fff;border:0;border-radius:5px;padding:6px 10px'>Lukk</button>";
    byId("hovDiagClose").onclick=function(){p.remove();};
  }
  window.__hovDiagnoseReport = report;
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ setTimeout(report,500); });
  else setTimeout(report,500);
  setTimeout(report,2000);
})();
