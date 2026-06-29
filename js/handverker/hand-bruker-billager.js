/* Rett i Lomma - vanlig bruker kan fylle egen bil 7055
   Admin: full lager/bilregister.
   Vanlig bruker: Lager-meny vises, men Vareregister skjules. Bil-lager låses til aktiv/egen bil.
*/
(function () {
  function hent(id) { return document.getElementById(id); }
  function erAdminModus() {
    return window.erAdmin === true && localStorage.getItem("rilAdminModus") === "ja";
  }
  function aktivBilId() {
    try {
      const fraTimer = hent("bilValg") && hent("bilValg").value ? hent("bilValg").value : "";
      if (fraTimer) return fraTimer;

      const lagret = window.aktivBilId || localStorage.getItem("aktivBilId") || localStorage.getItem("rilAktivBilId") || "";
      if (lagret) return lagret;

      const ansatte = Array.isArray(window.ansatte) ? window.ansatte : [];
      const epost = String(window.innloggetEpost || "").toLowerCase();
      const ansattId = String(window.innloggetAnsattId || "");
      const ansatt = ansatte.find(function (a) {
        return (ansattId && String(a.id || "") === ansattId) ||
          (epost && String(a.epost || "").toLowerCase() === epost);
      });
      if (ansatt && ansatt.standard_bil_id) return String(ansatt.standard_bil_id);

      const biler = Array.isArray(window.biler) ? window.biler.filter(function (b) { return b.aktiv !== false; }) : [];
      if (biler.length === 1 && biler[0].id) return String(biler[0].id);
    } catch (e) {
      console.warn("Kunne ikke finne aktiv bil for bruker:", e);
    }
    return "";
  }
  function aktivBilNavn() {
    return window.aktivBilNavn || localStorage.getItem("aktivBilNavn") || localStorage.getItem("rilAktivBilNavn") || "";
  }
  function skjul(el) {
    if (!el) return;
    el.classList.add("skjult", "hidden");
    el.style.display = "none";
  }
  function vis(el) {
    if (!el) return;
    el.classList.remove("skjult", "hidden", "modul-skjult");
    el.style.display = "";
  }
  function settTekst(id, tekst) {
    const el = hent(id);
    if (el) el.textContent = tekst;
  }
  function begrensBilValgTilAktivBil() {
    const select = hent("bilLagerBilValg");
    if (!select) return;

    let id = aktivBilId();
    const navn = aktivBilNavn();

    // Hvis bruker ikke har aktiv/standard bil ennå, men listen har bare én bil,
    // velg den automatisk. Hvis listen har flere biler, la brukeren velge i listen.
    if (!id) {
      const valg = Array.from(select.options || []).filter(function (o) { return String(o.value || "").trim() !== ""; });
      if (valg.length === 1) id = String(valg[0].value || "");
    }

    if (!id) {
      select.disabled = false;
      delete select.dataset.rilLåstTilAktivBil;
      return;
    }

    let option = Array.from(select.options || []).find(function (o) {
      return String(o.value) === String(id);
    });

    if (!option) {
      option = document.createElement("option");
      option.value = id;
      option.textContent = navn || "Min bil";
      select.appendChild(option);
    }

    select.value = id;
    select.disabled = true;
    select.dataset.rilLåstTilAktivBil = "1";
    window.aktivBilId = id;
    localStorage.setItem("aktivBilId", id);
    if (option && option.textContent) {
      window.aktivBilNavn = option.textContent;
      localStorage.setItem("aktivBilNavn", option.textContent);
    }
  }

  function styrImportForRolle() {
    const admin = erAdminModus();

    // Import til hovedlager skal bare vises for admin.
    // Vanlig bruker skal kun fylle sin egen bil fra eksisterende vareliste.
    [
      "patchImportLagerWrap",
      "importBilLagerFil",
      "importBilLagerKnapp",
      "hentFyllelisteFraDbKnapp",
      "importBilLagerMelding"
    ].forEach(function (id) {
      const el = hent(id);
      if (!el) return;
      const blokk = id === "patchImportLagerWrap" ? el : (el.closest("#patchImportLagerWrap") || el.parentElement || el);
      if (admin) vis(blokk); else skjul(blokk);
    });

    // Hvis wrapperen ikke finnes, finn importseksjonen via knappen og skjul nærmeste blokk.
    const importKnapp = hent("importBilLagerKnapp");
    if (importKnapp && !admin) {
      const blokk = importKnapp.closest("#patchImportLagerWrap") || importKnapp.closest("div") || importKnapp.parentElement;
      skjul(blokk);
    }
  }

  function begrensBilLagerForVanligBruker() {
    const admin = erAdminModus();
    styrImportForRolle();

    // Lagerknappen skal vises for alle.
    const lagerGruppe = hent("lagerMenyKnapp")?.closest(".meny-gruppe");
    vis(lagerGruppe);

    // Vareregister er kun admin. Vanlig bruker skal ikke inn på hovedlager/priser.
    const varerKnapp = hent("varerKnapp");
    if (admin) vis(varerKnapp); else skjul(varerKnapp);

    const visBilerKnapp = hent("visBilerKnapp");
    if (visBilerKnapp) visBilerKnapp.textContent = admin ? "Biler / bil-lager" : "Min bil / fyll lager";

    const bilerSide = hent("bilerSide");
    if (!bilerSide) return;

    // Hvem som henter settes automatisk til innlogget bruker, også for admin.
    const henterFelt = hent("bilLagerHentetAv");
    if (henterFelt) {
      henterFelt.value = window.innloggetEpost || "";
      const egenDiv = henterFelt.parentElement;
      skjul(egenDiv);
    }

    if (admin) {
      const select = hent("bilLagerBilValg");
      if (select && select.dataset.rilLåstTilAktivBil === "1") {
        select.disabled = false;
        delete select.dataset.rilLåstTilAktivBil;
      }
      return;
    }

    // Vanlig bruker: skjul oppretting/redigering av biler. De skal bare fylle egen bil.
    settTekst("bilMelding", "Vanlig bruker kan fylle varer på sin egen aktive bil.");
    const h2 = bilerSide.querySelector("h2");
    if (h2) h2.textContent = "Min bil / lager";

    // Hvem som henter skal ikke velges manuelt. Det settes automatisk til innlogget bruker i hand-biler.js.
    const henter = hent("bilLagerHentetAv");
    if (henter) {
      henter.value = window.innloggetEpost || "";
      const blokk = henter.closest(".rad") || henter.parentElement;
      // skjul bare selve input-blokken hvis den ligger sammen med bilvalg i samme rad
      const egenDiv = henter.parentElement;
      skjul(egenDiv);
    }

    // Skjul hele registrering/redigering av bil for vanlig bruker.
    // Vanlig bruker skal bare fylle varer på valgt/standard bil.
    ["nyBilKnapp", "bilSkjemaOmrade", "bilListe"].forEach(function (id) {
      skjul(hent(id));
    });

    // Ekstra sikring hvis gammel HTML/fix viser enkeltfelter likevel.
    ["bilNavn", "bilRegnr", "lagreBilKnapp", "bilId"].forEach(function (id) {
      const el = hent(id);
      if (!el) return;
      const blokk = el.closest("#bilSkjemaOmrade") || el.closest(".rad") || el;
      skjul(blokk);
    });

    const tilbake = hent("tilbakeFraBilerKnapp");
    if (tilbake) tilbake.textContent = "Tilbake til timer";

    begrensBilValgTilAktivBil();

    const select = hent("bilLagerBilValg");
    if (!aktivBilId() && select && !select.value) {
      settTekst("bilMelding", "Velg bil i listen for å fylle bil-lager.");
    }
  }

  window.begrensBilLagerForVanligBruker = begrensBilLagerForVanligBruker;

  try {
    const obs = new MutationObserver(function () { styrImportForRolle(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "bilLagerBilValg" && !erAdminModus()) {
      const select = event.target;
      if (select.value) {
        window.aktivBilId = select.value;
        localStorage.setItem("aktivBilId", select.value);
        const valgt = select.options[select.selectedIndex];
        if (valgt) {
          window.aktivBilNavn = valgt.textContent || "";
          localStorage.setItem("aktivBilNavn", valgt.textContent || "");
        }
        setTimeout(begrensBilValgTilAktivBil, 0);
        if (typeof window.tegnFyllBilListe === "function") setTimeout(window.tegnFyllBilListe, 20);
      }
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begrensBilLagerForVanligBruker);
  } else {
    begrensBilLagerForVanligBruker();
  }
  window.addEventListener("load", function () {
    setTimeout(begrensBilLagerForVanligBruker, 100);
    setTimeout(begrensBilLagerForVanligBruker, 700);
    setTimeout(begrensBilLagerForVanligBruker, 1500);
    setTimeout(begrensBilLagerForVanligBruker, 2500);
  });
})();

/* AGK FIX 2026-06-26: Bruker får beskjed når admin har godkjent bestilling.
   Knappen "Fyll på bil" legger godkjente varer på bil, trekker hovedlager når felt finnes,
   skriver lagerlogg og markerer bestillingen som mottatt/ferdig. */
(function () {
  "use strict";
  if (window.__agkFyllPaaBilEtterAdminFix) return;
  window.__agkFyllPaaBilEtterAdminFix = true;

  function $(id) { return document.getElementById(id); }
  function db() { return window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null); }
  function num(v) { const n = Number(String(v ?? "0").replace(",", ".")); return Number.isFinite(n) ? n : 0; }
  function esc(v) { return String(v ?? "").replace(/[&<>\"']/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[s])); }
  function msg(txt, feil) {
    const el = $("bilMelding") || $("bilLagerMelding");
    if (el) { el.textContent = txt; el.style.color = feil ? "#fca5a5" : "#86efac"; }
  }
  function valgtBilId() {
    try { if (typeof window.hentValgtBilIdForBilLager === "function") return window.hentValgtBilIdForBilLager() || ""; } catch (_) {}
    return $("bilLagerBilValg")?.value || window.aktivBilId || localStorage.getItem("aktivBilId") || "";
  }
  function valgtBilNavn() {
    const s = $("bilLagerBilValg");
    return s?.selectedOptions?.[0]?.textContent || window.aktivBilNavn || localStorage.getItem("aktivBilNavn") || "valgt bil";
  }
  function brukerTekst() {
    return window.innloggetEpost || localStorage.getItem("innloggetEpost") || window.innloggetAnsattNavn || "";
  }
  function firmaId() {
    try { if (typeof window.hentAktivFirmaId === "function") return window.hentAktivFirmaId() || null; } catch (_) {}
    return window.aktivFirmaId || localStorage.getItem("aktivFirmaId") || localStorage.getItem("firmaId") || null;
  }


  function ferdigKey() {
    return "agk_fylt_admin_bestilling_" + (valgtBilId() || "ingen_bil");
  }

  function hentFerdigeBestillingIds() {
    try {
      const raw = localStorage.getItem(ferdigKey()) || "[]";
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch (_) {
      return new Set();
    }
  }

  function lagreFerdigeBestillingIds(ids) {
    try {
      const ferdige = hentFerdigeBestillingIds();
      (ids || []).forEach(id => { if (id) ferdige.add(String(id)); });
      localStorage.setItem(ferdigKey(), JSON.stringify(Array.from(ferdige).slice(-500)));
    } catch (_) {}
  }

  function skjulGodkjentPanel(tekst) {
    const panel = $("agkAdminGodkjentPanel");
    if (panel) {
      panel.innerHTML = '<div class="kort" style="border:1px solid #166534;background:#052e16;padding:12px;border-radius:10px;color:#dcfce7;font-weight:bold">' + esc(tekst || "Varene er lagt på bil. Listen er lukket.") + '</div>';
      setTimeout(function () {
        const p = $("agkAdminGodkjentPanel");
        if (p) p.innerHTML = "";
      }, 2500);
    }
  }

  async function safeInsert(table, payload) {
    const cli = db();
    let rows = Array.isArray(payload) ? payload.map(x => ({...x})) : [{...payload}];
    for (let i = 0; i < 18; i++) {
      const res = await cli.from(table).insert(rows);
      if (!res.error) return res;
      const m = String(res.error.message || "");
      const col = (m.match(/Could not find the '([^']+)' column/i) || [])[1] || (m.match(/column "([^"]+)".*does not exist/i) || [])[1];
      if (col) { rows.forEach(r => delete r[col]); continue; }
      return res;
    }
    return { error: { message: "Kunne ikke lagre i " + table } };
  }

  async function safeUpdate(table, id, payload) {
    const cli = db();
    let data = {...payload};
    for (let i = 0; i < 18; i++) {
      const res = await cli.from(table).update(data).eq("id", id);
      if (!res.error) return res;
      const m = String(res.error.message || "");
      const col = (m.match(/Could not find the '([^']+)' column/i) || [])[1] || (m.match(/column "([^"]+)".*does not exist/i) || [])[1];
      if (col && Object.prototype.hasOwnProperty.call(data, col)) { delete data[col]; continue; }
      return res;
    }
    return { error: null };
  }

  function aktivStatus(r) {
    const st = String(r.status || "").toLowerCase();
    // Ferdigbehandlede bestillinger skal aldri vises igjen eller kunne legges på bil en gang til.
    if (r.arkivert === true || r.lukket === true || r.lagt_pa_bil === true || r.ansatt_godkjent === true) return false;
    if (["ferdig", "mottatt", "avsluttet", "arkivert", "lukket", "lagt_pa_bil", "lagt på bil", "levert"].includes(st)) return false;
    if (["godkjent", "delvis", "delvis_godkjent", "delvis_levert", "klar", "utlevert"].includes(st)) return true;
    return num(r.levert) > num(r.mottatt || 0);
  }

  function mottakAntall(r) {
    return Math.max(0, num(r.levert) - num(r.mottatt || 0));
  }

  async function hentGodkjente() {
    const cli = db();
    const bilId = valgtBilId();
    if (!cli || !bilId) return [];
    let q = cli.from("hand_bil_bestilling").select("*").eq("bil_id", bilId).order("opprettet", { ascending: false });
    const res = await q;
    if (res.error) throw res.error;
    const ferdige = hentFerdigeBestillingIds();
    return (res.data || []).filter(r => {
      if (r && r.id && ferdige.has(String(r.id))) return false;
      return aktivStatus(r) && mottakAntall(r) > 0;
    });
  }

  async function hentVarer(ids) {
    const cli = db();
    const map = new Map();
    const clean = [...new Set((ids || []).filter(Boolean).map(String))];
    if (!cli || !clean.length) return map;

    // Først: normal kobling hand_bil_bestilling.vare_id -> hand_vare.id
    let res = await cli.from("hand_vare").select("*").in("id", clean);
    if (!res.error) (res.data || []).forEach(v => map.set(String(v.id), v));

    // Fallback: hvis gamle rader har varenr i stedet for id.
    const mangler = clean.filter(id => !map.has(String(id)));
    if (mangler.length) {
      try {
        res = await cli.from("hand_vare").select("*").in("varenr", mangler);
        if (!res.error) {
          (res.data || []).forEach(v => {
            if (v.id) map.set(String(v.id), v);
            if (v.varenr) map.set(String(v.varenr), v);
          });
        }
      } catch (_) {}
    }
    return map;
  }

  function vareNavn(v, fallbackRad) {
    const r = (fallbackRad && typeof fallbackRad === "object") ? fallbackRad : {};
    const fallback = (fallbackRad && typeof fallbackRad !== "object") ? fallbackRad : "";
    const varenr = (v && (v.varenr || v.vare_nr)) || r.varenr || r.vare_nr || "";
    const navn = (v && (v.navn || v.varenavn || v.beskrivelse)) || r.varenavn || r.vare_navn || r.navn || fallback || "";
    const tekst = [varenr, navn].filter(Boolean).join(" - ").trim();
    return tekst || (r.vare_id ? String(r.vare_id) : "Vare");
  }

  function hostPanel() {
    let p = $("agkAdminGodkjentPanel");
    if (p) return p;
    p = document.createElement("div");
    p.id = "agkAdminGodkjentPanel";
    p.style.margin = "12px 0";
    const fyllListe = $("bilLagerFyllListe");
    const side = $("bilerSide") || document.body;
    if (fyllListe && fyllListe.parentNode) fyllListe.parentNode.insertBefore(p, fyllListe);
    else side.appendChild(p);
    return p;
  }

  async function tegnGodkjentPanel() {
    const panel = hostPanel();
    const bilId = valgtBilId();
    if (!bilId) {
      panel.innerHTML = '<div class="info">Velg bil for å se godkjente bestillinger fra admin.</div>';
      return;
    }
    try {
      const rows = await hentGodkjente();
      if (!rows.length) {
        panel.innerHTML = '<div class="info">Ingen godkjente varer fra admin til ' + esc(valgtBilNavn()) + '.</div>';
        return;
      }
      const varer = await hentVarer(rows.map(r => r.vare_id));
      const total = rows.reduce((s, r) => s + mottakAntall(r), 0);
      panel.innerHTML = '' +
        '<div class="kort" style="border:1px solid #334155;background:#111827;padding:12px;border-radius:10px">' +
          '<h4 style="margin-top:0">Godkjent bestilling fra admin</h4>' +
          '<p class="info">Admin har godkjent varer til bilen. Trykk <strong>Fyll på bil</strong> når varene er mottatt.</p>' +
          '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse">' +
            '<thead><tr>' +
              '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Vare</th>' +
              '<th style="text-align:right;padding:6px;border-bottom:1px solid #374151">Godkjent</th>' +
              '<th style="text-align:right;padding:6px;border-bottom:1px solid #374151">Rest</th>' +
            '</tr></thead><tbody>' +
            rows.map(r => {
              const v = varer.get(String(r.vare_id));
              return '<tr>' +
                '<td style="padding:6px;border-bottom:1px solid #273244">' + esc(vareNavn(v, r)) + '</td>' +
                '<td style="padding:6px;text-align:right;border-bottom:1px solid #273244;color:#86efac;font-weight:bold">' + mottakAntall(r) + '</td>' +
                '<td style="padding:6px;text-align:right;border-bottom:1px solid #273244;color:' + (num(r.rest) > 0 ? '#fca5a5' : '#86efac') + ';font-weight:bold">' + num(r.rest) + '</td>' +
              '</tr>';
            }).join("") +
            '</tbody></table></div>' +
          '<button id="agkFyllPaaBilKnapp" type="button" style="margin-top:10px;padding:10px 14px;border-radius:8px;background:#16a34a;color:white;border:0;font-weight:bold">Fyll på bil (' + total + ')</button>' +
        '</div>';
      const btn = $("agkFyllPaaBilKnapp");
      if (btn) btn.onclick = fyllPaaBilFraAdmin;
    } catch (e) {
      panel.innerHTML = '<div class="feil">Kunne ikke hente godkjent bestilling: ' + esc(e.message || e) + '</div>';
    }
  }

  async function oppdaterBilLager(bilId, vareId, antall, minimum) {
    const cli = db();
    const eks = await cli.from("hand_bil_lager").select("id,antall,minimum_antall").eq("bil_id", bilId).eq("vare_id", vareId).limit(1);
    if (eks.error) throw eks.error;
    if (eks.data && eks.data.length) {
      const ny = num(eks.data[0].antall) + antall;
      const res = await safeUpdate("hand_bil_lager", eks.data[0].id, { antall: ny, minimum_antall: minimum || num(eks.data[0].minimum_antall) });
      if (res.error) throw res.error;
    } else {
      const res = await safeInsert("hand_bil_lager", [{ bil_id: bilId, vare_id: vareId, antall: antall, minimum_antall: minimum || 0 }]);
      if (res.error) throw res.error;
    }
  }

  async function trekkHovedlagerHvisMulig(vareId, antall) {
    const cli = db();
    const res = await cli.from("hand_vare").select("*").eq("id", vareId).limit(1);
    if (res.error || !res.data || !res.data.length) return;
    const v = res.data[0];
    const felt = ["lager_antall", "antall", "lager", "beholdning"].find(k => v[k] !== undefined && v[k] !== null);
    if (!felt) return;
    const ny = Math.max(0, num(v[felt]) - antall);
    const upd = await safeUpdate("hand_vare", vareId, { [felt]: ny });
    if (upd.error) console.warn("Kunne ikke trekke hovedlager:", upd.error.message || upd.error);
  }

  async function skrivLogg(rad) {
    const payload = Object.assign({
      type: "flytting",
      handling: "admin_godkjent_fyll_paa_bil",
      kommentar: "Bruker fylte på bil fra admin-godkjent bestilling",
      opprettet: new Date().toISOString(),
      hentet_av: brukerTekst() || null,
      bruker_epost: window.innloggetEpost || localStorage.getItem("innloggetEpost") || null,
      firma_id: firmaId()
    }, rad);
    const bevegelse = {
      bil_id: payload.bil_id || null,
      vare_id: payload.vare_id || null,
      antall: payload.antall || null,
      ansatt_id: window.innloggetAnsattId || localStorage.getItem("innloggetAnsattId") || localStorage.getItem("ansattId") || null,
      type: payload.handling || payload.type || "lagerbevegelse",
      varenr: payload.varenr || null,
      varenavn: payload.varenavn || null,
      hentet_av: payload.hentet_av || null,
      bruker_epost: payload.bruker_epost || window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || localStorage.getItem("innloggetEpost") || null,
      bruker_navn: payload.bruker_navn || window.innloggetNavn || null,
      kommentar: payload.hentet_av ? ("Hentet av: " + payload.hentet_av) : null,
      created_at: new Date().toISOString()
    };
    const res = await safeInsert("hand_lager_bevegelse", [bevegelse]);
    if (res.error) console.warn("Lagerbevegelse ble ikke skrevet:", res.error.message || res.error);
  }

  async function fyllPaaBilFraAdmin(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    }
    const btn = $("agkFyllPaaBilKnapp");
    if (btn && btn.dataset.busy === "1") return false;
    if (btn) { btn.dataset.busy = "1"; btn.disabled = true; btn.textContent = "Fyller på bil..."; }

    const behandledeIds = [];

    try {
      const cli = db();
      const bilId = valgtBilId();
      if (!cli || !bilId) throw new Error("Velg bil først.");

      const rows = await hentGodkjente();
      if (!rows.length) {
        skjulGodkjentPanel("Ingen nye godkjente varer å legge på bil.");
        return false;
      }

      // Lås radene lokalt med én gang, slik at samme godkjenning ikke kan fylles to ganger
      // hvis brukeren dobbeltklikker eller siden tegnes på nytt før databasen er ferdig oppdatert.
      lagreFerdigeBestillingIds(rows.map(r => r.id).filter(Boolean));

      const varer = await hentVarer(rows.map(r => r.vare_id));
      let lagtTil = 0;

      for (const r of rows) {
        const vareId = String(r.vare_id || "");
        const antall = mottakAntall(r);
        if (!vareId || antall <= 0) continue;

        await oppdaterBilLager(bilId, vareId, antall, num(r.minimum_antall));
        await trekkHovedlagerHvisMulig(vareId, antall);

        const v = varer.get(String(vareId));
        await skrivLogg({
          bil_id: bilId,
          bil_navn: valgtBilNavn(),
          vare_id: vareId,
          varenr: v?.varenr || r.varenr || null,
          varenavn: v?.navn || v?.varenavn || r.varenavn || null,
          antall: antall,
          bestilling_id: r.id || null
        });

        const nyMottatt = num(r.mottatt || 0) + antall;
        // Når bruker bekrefter/fyller på bil skal bestillingen lukkes helt.
        // Den skal ikke kunne dukke opp igjen i bruker- eller adminlisten.
        const nyStatus = "ferdig";
        const upd = await safeUpdate("hand_bil_bestilling", r.id, {
          mottatt: nyMottatt,
          levert: nyMottatt,
          godkjent: nyMottatt,
          rest: 0,
          status: nyStatus,
          ansatt_godkjent: true,
          lagt_pa_bil: true,
          mottatt_dato: new Date().toISOString(),
          mottatt_av: brukerTekst() || null,
          ferdig_dato: new Date().toISOString(),
          ansatt_godkjent_at: new Date().toISOString(),
          lagt_pa_bil_at: new Date().toISOString(),
          arkivert: true,
          lukket: true
        });
        if (upd.error) throw upd.error;

        behandledeIds.push(r.id);
        lagtTil += antall;
      }

      lagreFerdigeBestillingIds(rows.map(r => r.id).filter(Boolean));
      msg("Godkjente varer er lagt på bil én gang. Alle bestillinger er lukket og fjernet fra listen.");
      skjulGodkjentPanel("Godkjente varer er lagt på bil. Alle bestillinger er lukket.");
      try {
        const paneler = ["agkAdminGodkjentPanel", "mineLagerbestillingerListe", "adminLagerbestillingerListe", "rilAdminOrdersContent"];
        paneler.forEach(function(id){ const el = $(id); if (el) el.innerHTML = ""; });
      } catch (_) {}

      if (typeof window.lastBilerOgBilLager === "function") await window.lastBilerOgBilLager();
      if (typeof window.fyllVarevalgFraAktivBil === "function") await window.fyllVarevalgFraAktivBil();
      if (typeof window.tegnLagerloggForBil === "function") { try { await window.tegnLagerloggForBil(); } catch (_) {} }
      setTimeout(function () {
        const panel = $("agkAdminGodkjentPanel");
        if (panel) panel.innerHTML = "";
      }, 300);
    } catch (err) {
      // Ved feil fjerner vi lokal lås for radene som ikke ble ferdige, slik at bruker kan prøve igjen.
      try {
        const ferdige = hentFerdigeBestillingIds();
        (behandledeIds || []).forEach(id => ferdige.delete(String(id)));
        localStorage.setItem(ferdigKey(), JSON.stringify(Array.from(ferdige).slice(-500)));
      } catch (_) {}
      msg("Kunne ikke fylle på bil: " + (err.message || err), true);
      if (btn) { btn.dataset.busy = "0"; btn.disabled = false; btn.textContent = "Fyll på bil"; }
    }
    return false;
  }

  function wire() {
    const gammel = $("lagreBilLagerListeKnapp");
    if (gammel) {
      gammel.textContent = "Fyll på bil";
      gammel.onclick = fyllPaaBilFraAdmin;
    }
    tegnGodkjentPanel();
  }

  window.agkTegnGodkjentBestillingPanel = tegnGodkjentPanel;
  window.agkFyllPaaBilFraAdmin = fyllPaaBilFraAdmin;

  document.addEventListener("change", function (ev) {
    if (ev.target && ev.target.id === "bilLagerBilValg") setTimeout(wire, 150);
  }, true);
  document.addEventListener("click", function (ev) {
    const t = ev.target;
    if (!t) return;
    if (t.id === "agkFyllPaaBilKnapp" || t.id === "lagreBilLagerListeKnapp") {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      fyllPaaBilFraAdmin(ev);
    }
  }, true);
  document.addEventListener("DOMContentLoaded", function () { setTimeout(wire, 500); setTimeout(wire, 1500); });
  window.addEventListener("load", function () { setTimeout(wire, 700); setTimeout(wire, 2000); });
})();


/* AGK FIX 2026-06-27: Etter "Godkjenn/Fyll på bil" skal grønne godkjente bestillinger forsvinne helt.
   Ekstra sikkerhet hvis eldre patcher bygger listen: lukk aktive hand_bil_bestilling-rader, rydd DOM og last lister på nytt. */
(function(){
  "use strict";
  if (window.__agkRyddGronneEtterFyllFinal) return;
  window.__agkRyddGronneEtterFyllFinal = true;

  function $(id){ return document.getElementById(id); }
  function cli(){ return window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null); }
  function bilId(){
    try { if (typeof window.hentValgtBilIdForBilLager === "function") return window.hentValgtBilIdForBilLager() || ""; } catch(_) {}
    return $("bilLagerBilValg")?.value || window.aktivBilId || localStorage.getItem("aktivBilId") || "";
  }
  function erFyllKnapp(el){
    if (!el) return false;
    var b = el.closest ? el.closest("button") : null;
    if (!b) return false;
    var t = String(b.textContent || "").toLowerCase();
    return (t.includes("godkjenn") && t.includes("legg") && (t.includes("bil") || t.includes("benk"))) ||
           (t.includes("fyll") && t.includes("på bil"));
  }
  function skjulGronneBestillinger(){
    var ord = ["bekreftet bestilling fra admin", "godkjent bestilling fra admin", "admin har godkjent varer"];
    document.querySelectorAll("section, .kort, .card, div").forEach(function(el){
      var txt = String(el.textContent || "").toLowerCase();
      if (ord.some(function(o){ return txt.includes(o); })) {
        // Ikke fjern hele siden; fjern bare tydelige paneler med knappene/listene.
        if (el.id === "bilerSide" || el === document.body || el.closest("#bilerSide") === null) return;
        if (txt.includes("godkjenn") || txt.includes("fyll på bil") || el.id === "agkAdminGodkjentPanel") {
          el.innerHTML = "";
          el.style.display = "none";
        }
      }
    });
    var p = $("agkAdminGodkjentPanel");
    if (p) { p.innerHTML = ""; p.style.display = "none"; }
  }
  async function lukkAktiveBilBestillinger(){
    var db = cli();
    var id = bilId();
    if (!db || !id) return;
    try {
      var res = await db.from("hand_bil_bestilling").select("id,status,rest,levert,mottatt,lagt_pa_bil,arkivert,lukket").eq("bil_id", id).limit(500);
      if (res.error || !Array.isArray(res.data)) return;
      var aktive = res.data.filter(function(r){
        var st = String(r.status || "").toLowerCase();
        if (r.lagt_pa_bil === true || r.arkivert === true || r.lukket === true) return false;
        if (["ferdig","mottatt","avsluttet","arkivert","lukket","lagt_pa_bil","levert"].includes(st)) return false;
        return ["godkjent","delvis","delvis_godkjent","delvis_levert","klar","utlevert","venter"].includes(st) || Number(r.rest || 0) === 0 || Number(r.levert || 0) > Number(r.mottatt || 0);
      });
      for (var i=0;i<aktive.length;i++) {
        var r = aktive[i];
        var mottatt = Math.max(Number(r.mottatt || 0), Number(r.levert || 0));
        var payload = {
          status: "ferdig",
          rest: 0,
          mottatt: mottatt,
          levert: mottatt,
          godkjent: mottatt,
          ansatt_godkjent: true,
          lagt_pa_bil: true,
          arkivert: true,
          lukket: true,
          mottatt_dato: new Date().toISOString(),
          ferdig_dato: new Date().toISOString(),
          ansatt_godkjent_at: new Date().toISOString(),
          lagt_pa_bil_at: new Date().toISOString()
        };
        // Robust mot manglende kolonner: prøv full payload, deretter minimum.
        var u = await db.from("hand_bil_bestilling").update(payload).eq("id", r.id);
        if (u.error) await db.from("hand_bil_bestilling").update({ status: "ferdig", rest: 0, mottatt: mottatt, levert: mottatt }).eq("id", r.id);
      }
    } catch(e) { console.warn("Kunne ikke lukke ferdige bilbestillinger:", e); }
  }
  async function etterFyll(){
    setTimeout(skjulGronneBestillinger, 100);
    setTimeout(skjulGronneBestillinger, 700);
    setTimeout(skjulGronneBestillinger, 1600);
    setTimeout(async function(){
      await lukkAktiveBilBestillinger();
      skjulGronneBestillinger();
      try { if (typeof window.lastBilerOgBilLager === "function") await window.lastBilerOgBilLager(); } catch(_) {}
      try { if (typeof window.tegnLagerloggForBil === "function") await window.tegnLagerloggForBil(); } catch(_) {}
      try { if (typeof window.agkTegnGodkjentBestillingPanel === "function") await window.agkTegnGodkjentBestillingPanel(); } catch(_) {}
      skjulGronneBestillinger();
    }, 2200);
  }
  document.addEventListener("click", function(e){ if (erFyllKnapp(e.target)) etterFyll(); }, true);
  window.agkRyddGronneBestillingerEtterFyll = etterFyll;
})();
