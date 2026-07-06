
/* Rett i Lomma - trygg lagerpatch v7300
   Legger til import til hovedlager og fylleliste uten å endre original hand-varer.js/hand-biler.js.
*/
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function msg(text, error) {
    const el = $("importBilLagerMelding") || $("bilMelding") || $("vareMelding");
    if (el) {
      el.textContent = text || "";
      el.style.color = error ? "#fca5a5" : "#86efac";
    }
    if (error) console.error(text);
    else if (text) console.log(text);
  }

  function repairText(value) {
    let s = String(value ?? "").replace(/^\uFEFF/, "");
    const map = {
      "Ã¦": "æ", "Ã†": "Æ",
      "Ã¸": "ø", "Ã˜": "Ø",
      "Ã¥": "å", "Ã…": "Å",
      "Ã©": "é", "Ã¨": "è", "Ã¼": "ü", "Ã¶": "ö", "Ã¤": "ä",
      "Â": ""
    };
    Object.keys(map).forEach(k => { s = s.split(k).join(map[k]); });
    return s.trim();
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replaceAll(" ", "")
      .replaceAll("_", "")
      .replaceAll("-", "")
      .replaceAll(".", "")
      .replaceAll("æ", "ae")
      .replaceAll("ø", "o")
      .replaceAll("å", "a");
  }

  function getVal(row, keys) {
    const lookup = {};
    Object.keys(row || {}).forEach(k => lookup[normalize(k)] = row[k]);
    for (const k of keys) {
      const v = lookup[normalize(k)];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  }

  function toNumber(value) {
    if (value === undefined || value === null || String(value).trim() === "") return 0;
    let s = String(value)
      .replaceAll(" ", "")
      .replaceAll("\u00a0", "")
      .replace("kr", "")
      .replace("NOK", "")
      .replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }



  async function hentLagerFirmaId() {
    if (window.handVareFirmaTilgang && window.handVareFirmaTilgang.firma_id) return window.handVareFirmaTilgang.firma_id;
    if (typeof window.hentVareFirmaId === "function") return await window.hentVareFirmaId();
    if (!window.supabaseClient || !supabaseClient.auth) throw new Error("Supabase er ikke lastet.");
    const ures = await supabaseClient.auth.getUser();
    const user = ures && ures.data && ures.data.user ? ures.data.user : null;
    if (!user) throw new Error("Du er ikke innlogget.");
    const uid = String(user.id || "").trim();
    const epost = String(user.email || window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || "").trim().toLowerCase();
    let rad = null;
    if (uid) {
      const q = await supabaseClient.from("hand_firma_bruker").select("firma_id,rolle").eq("user_id", uid).limit(1).maybeSingle();
      if (!q.error && q.data && q.data.firma_id) rad = q.data;
    }
    if (!rad && epost) {
      const q = await supabaseClient.from("hand_firma_bruker").select("firma_id,rolle").ilike("epost", epost).limit(1).maybeSingle();
      if (!q.error && q.data && q.data.firma_id) rad = q.data;
    }
    if (!rad || !rad.firma_id) throw new Error("Brukeren mangler kobling i hand_firma_bruker.");
    const rolle = String(rad.rolle || "").toLowerCase();
    if (!["eier","admin","administrator","firmaeier","owner","sysadm","sysadmin","systemadmin"].includes(rolle)) throw new Error("Rolle må være eier eller admin i hand_firma_bruker.");
    return rad.firma_id;
  }

  function ensureBilUi() {
    const bilerSide = $("bilerSide");
    if (!bilerSide) return;

    // Tittel + hidden id for original hand-biler.js
    const bilNavn = $("bilNavn");
    if (bilNavn && !$("nyBilTittel")) {
      const h = document.createElement("h3");
      h.id = "nyBilTittel";
      h.textContent = "Registrer ny bil";
      bilNavn.closest(".rad")?.before(h);
    }
    if (!$("bilId") && bilNavn) {
      const hidden = document.createElement("input");
      hidden.id = "bilId";
      hidden.type = "hidden";
      bilNavn.closest(".rad")?.before(hidden);
    }

    const lagre = $("lagreBilKnapp");
    if (lagre) lagre.textContent = "Lagre ny bil";

    // Ny bil knapp
    if (!$("patchNyBilKnapp") && lagre) {
      const b = document.createElement("button");
      b.id = "patchNyBilKnapp";
      b.type = "button";
      b.className = "secondary";
      b.textContent = "Ny bil";
      b.onclick = function () {
        const id = $("bilId");
        const navn = $("bilNavn");
        const reg = $("bilRegnr");
        if (id) id.value = "";
        if (navn) navn.value = "";
        if (reg) reg.value = "";
        const t = $("nyBilTittel");
        if (t) t.textContent = "Registrer ny bil";
        if (lagre) lagre.textContent = "Lagre ny bil";
        msg("Klar til å registrere ny bil.", false);
        setTimeout(() => navn && navn.focus(), 50);
      };
      lagre.after(b);
    }

    // Import UI before fill list
    const list = $("bilLagerFyllListe");
    if (list && !$("importBilLagerFil")) {
      const wrap = document.createElement("div");
      wrap.id = "patchImportLagerWrap";
      wrap.innerHTML = `
        <hr>
        <h4>Importer varer til hovedlager</h4>
        <p class="info">Velg CSV/Excel-fil og trykk importer. Varene legges i hovedlager og vises i listen under.</p>
        <input id="importBilLagerFil" type="file" accept=".csv,.xlsx,.xls">
        <button id="importBilLagerKnapp" type="button">Importer varer til lager</button>
        <button id="hentFyllelisteFraDbKnapp" type="button" class="secondary">Hent fylleliste fra lager</button>
        <div id="importBilLagerMelding" class="melding"></div>
        <hr>
      `;
      list.before(wrap);
    }

    const importBtn = $("importBilLagerKnapp");
    if (importBtn && importBtn.dataset.patchBound !== "1") {
      importBtn.dataset.patchBound = "1";
      importBtn.onclick = importVarerTilLager;
    }

    const hentBtn = $("hentFyllelisteFraDbKnapp");
    if (hentBtn && hentBtn.dataset.patchBound !== "1") {
      hentBtn.dataset.patchBound = "1";
      hentBtn.onclick = hentOgTegnFylleliste;
    }
  }

  async function readRows(file) {
    if (typeof XLSX === "undefined") throw new Error("XLSX-biblioteket er ikke lastet.");
    const buffer = await file.arrayBuffer();
    const name = String(file.name || "").toLowerCase();

    let workbook;
    if (name.endsWith(".csv")) {
      let text = new TextDecoder("utf-8").decode(buffer);
      if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
      workbook = XLSX.read(text, { type: "string", raw: false });
    } else {
      workbook = XLSX.read(buffer, { type: "array", raw: false });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  }

  function mapRow(row) {
    const varenr = repairText(getVal(row, ["varenr", "vare nr", "vare_nr", "Varenr", "VareNr", "artikkel", "artikkelnr", "artikkelnummer", "produktnr", "produktnummer", "sku"]));
    const navn = repairText(getVal(row, ["navn", "varenavn", "vare navn", "Varenavn", "vare", "produkt", "beskrivelse", "tekst", "description"]));

    if (!varenr && !navn) return null;

    const innpris = toNumber(getVal(row, ["innpris", "inn pris", "kostpris", "nettopris", "pris inn"]));
    const utpris = toNumber(getVal(row, ["utpris", "ut pris", "pris", "utsalgspris", "salgspris", "pris ut"]));
    const lager = Math.round(toNumber(getVal(row, ["lager_antall", "lager antall", "antall", "lager", "beholdning", "qty", "quantity"])));
    const min = Math.round(toNumber(getVal(row, ["minimum_antall", "minimum", "min", "min antall"])));
    const mva = toNumber(getVal(row, ["mva_sats", "mva", "MVA", "vat"])) || 25;

    return {
      varenr: varenr || null,
      navn: navn || varenr,
      beskrivelse: repairText(getVal(row, ["beskrivelse", "tekst", "description"])) || null,
      innpris: innpris,
      pris: utpris,
      utpris: utpris,
      lager_antall: lager,
      antall: lager,
      minimum_antall: min,
      mva: mva,
      mva_sats: mva,
      aktiv: true,
      paslag_faktor: toNumber(getVal(row, ["paslag_faktor", "påslag", "paslag", "faktor"])) || 3
    };
  }

  async function importVarerTilLager() {
    try {
      const input = $("importBilLagerFil");
      const file = input && input.files && input.files[0];

      if (!file) {
        msg("Velg CSV- eller Excel-fil først.", true);
        return;
      }

      if (!window.supabaseClient) {
        msg("Supabase er ikke lastet. Sjekk config.js.", true);
        return;
      }

      msg("Leser importfil...", false);
      const rawRows = await readRows(file);
      const rows = rawRows.map(mapRow).filter(Boolean);

      if (!rows.length) {
        msg("Fant ingen varer i filen.", true);
        return;
      }

      msg("Lagrer " + rows.length + " varer i hovedlager...", false);

      let saved = 0;
      const errors = [];
      const firmaId = await hentLagerFirmaId();

      for (const row of rows) {
        row.firma_id = firmaId;
        let existing = null;

        if (row.varenr) {
          const check = await supabaseClient.from("hand_vare").select("id").eq("firma_id", firmaId).eq("varenr", row.varenr).limit(1);
          if (check.error) {
            errors.push((row.varenr || row.navn) + ": " + check.error.message);
            continue;
          }
          existing = check.data && check.data[0] ? check.data[0] : null;
        }

        let res;
        if (existing && existing.id) {
          res = await supabaseClient.from("hand_vare").update(row).eq("firma_id", firmaId).eq("id", existing.id).select("id").single();
        } else {
          res = await supabaseClient.from("hand_vare").insert([{ id: uuid(), ...row }]).select("id").single();
        }

        if (res.error) errors.push((row.varenr || row.navn) + ": " + res.error.message);
        else saved += 1;
      }

      if (!saved) {
        msg("0 varer ble lagret. " + (errors[0] || "Sjekk RLS/insert-policy på varer."), true);
        console.error(errors);
        return;
      }

      msg("Importerte " + saved + " varer. Henter fylleliste...", false);
      await hentOgTegnFylleliste();

    } catch (e) {
      msg("Import feilet: " + (e.message || String(e)), true);
      console.error(e);
    }
  }

  async function hentOgTegnFylleliste() {
    const c = $("bilLagerFyllListe");
    if (!c) return;

    if (!window.supabaseClient) {
      c.innerHTML = '<p class="melding">Supabase er ikke lastet.</p>';
      return;
    }

    c.innerHTML = '<p class="info">Henter varer fra hovedlager...</p>';

    const firmaId = await hentLagerFirmaId();
    const res = await supabaseClient.from("hand_vare").select("*").eq("firma_id", firmaId).limit(1000);

    if (res.error) {
      c.innerHTML = '<p class="melding">Kunne ikke hente varer: ' + esc(res.error.message) + '</p>';
      return;
    }

    const varer = (res.data || []).sort((a, b) =>
      String(a.navn || a.varenr || "").localeCompare(String(b.navn || b.varenr || ""), "no")
    );

    window.varerTilBilLager = varer;

    if (!varer.length) {
      c.innerHTML = '<p class="melding">Ingen varer i hovedlager.</p>';
      return;
    }

    const name = v => repairText((v.varenr ? v.varenr + " - " : "") + (v.navn || v.varenavn || v.beskrivelse || "Vare"));
    const inn = v => Number(v.innpris ?? 0);
    const ut = v => Number(v.utpris ?? v.pris ?? 0);
    const _tall = verdi => {
      if (verdi === null || verdi === undefined || verdi === "") return 0;
      const n = Number(String(verdi).trim().replace(/\s/g, "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    };
    const _forstePositive = (...verdier) => {
      const tall = verdier.map(_tall);
      const positiv = tall.find(n => n > 0);
      return positiv !== undefined ? positiv : (tall.find(n => Number.isFinite(n)) ?? 0);
    };
    const lager = v => _forstePositive(v.lager_antall, v.antall, v.lager, v.beholdning, v.hovedlager, v.stock, v.quantity, v.qty);
    const min = v => _forstePositive(v.minimum_antall, v.min_antall, v.minimum, v.min, v.min_hovedlager);
    const mva = v => Number(v.mva ?? v.mva_sats ?? 25);

    c.innerHTML = `
      <div class="info" style="margin:8px 0 6px 0; font-weight:bold;">${varer.length} varer klare for fylling av bil</div>
      <div style="overflow:auto; max-height:460px; border:1px solid #374151; border-radius:10px; margin-top:8px;">
        <table class="bil-tabell">
          <thead>
            <tr>
              <th>Varenr</th><th>Vare</th><th>Innpris</th><th>Utpris</th><th>Hovedlager</th><th>Min.</th><th>MVA</th><th>Antall til bil</th><th>Min. på bil</th>
            </tr>
          </thead>
          <tbody>
            ${varer.map(v => `
              <tr class="klikkbar-bilrad">
                <td>${esc(v.varenr || "")}</td>
                <td>${esc(name(v))}</td>
                <td>${esc(inn(v).toFixed(2))}</td>
                <td>${esc(ut(v).toFixed(2))}</td>
                <td>${esc(lager(v))}</td>
                <td>${esc(min(v))}</td>
                <td>${esc(mva(v))}%</td>
                <td><input class="bil-lager-antall-liste" data-vare-id="${esc(v.id)}" type="number" step="1" min="0" value="" placeholder="0"></td>
                <td><input class="bil-lager-min-liste" data-vare-id="${esc(v.id)}" type="number" step="1" min="0" value="" placeholder="0"></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    c.querySelectorAll("tr.klikkbar-bilrad").forEach(tr => {
      tr.addEventListener("click", ev => {
        if (ev.target && String(ev.target.tagName).toLowerCase() === "input") return;
        const input = tr.querySelector(".bil-lager-antall-liste");
        if (input) {
          if (!input.value) input.value = "1";
          input.focus();
          input.select && input.select();
        }
      });
    });
  }

  window.importerVarerFraBilLager = importVarerTilLager;
  window.hentOgTegnBilFyllelisteFraDatabase = hentOgTegnFylleliste;

  function init() {
    ensureBilUi();
    setTimeout(ensureBilUi, 300);
    setTimeout(ensureBilUi, 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
})();


/* RIL FIX 20260627: Vis lagerlogg for innlogget elektriker/ansatt.
   Leser hand_lager_bevegelse. hand_lagerlogg er fjernet,
   slik at ikke alle i basen vises. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function dato(v) {
    if (!v) return "";
    try { return new Date(v).toLocaleString("no-NO"); } catch (_) { return String(v); }
  }
  function valgtBilId() {
    return $("bilLagerBilValg")?.value || localStorage.getItem("aktivBilId") || window.aktivBilId || "";
  }
  function valgtBilTekst() {
    const s = $("bilLagerBilValg");
    if (s && s.value && s.selectedOptions && s.selectedOptions[0]) return s.selectedOptions[0].textContent || "valgt bil";
    return localStorage.getItem("aktivBilNavn") || "valgt bil";
  }
  async function innloggetEpost() {
    let epost = String(window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || localStorage.getItem("innloggetEpost") || "").trim().toLowerCase();
    try {
      if (window.supabaseClient && supabaseClient.auth && supabaseClient.auth.getUser) {
        const r = await supabaseClient.auth.getUser();
        const u = r && r.data && r.data.user ? r.data.user : null;
        if (u && u.email) epost = String(u.email).trim().toLowerCase();
      }
    } catch (_) {}
    return epost;
  }
  async function innloggetKontekst() {
    const epost = await innloggetEpost();
    let userId = String(window.innloggetUserId || window.authUserId || localStorage.getItem("innloggetUserId") || localStorage.getItem("authUserId") || "").trim();
    let ansattId = String(window.innloggetAnsattId || localStorage.getItem("innloggetAnsattId") || localStorage.getItem("ansattId") || "").trim();
    let navn = String(window.innloggetNavn || localStorage.getItem("innloggetNavn") || "").trim();
    try {
      if (window.supabaseClient && supabaseClient.auth && supabaseClient.auth.getUser) {
        const r = await supabaseClient.auth.getUser();
        const u = r && r.data && r.data.user ? r.data.user : null;
        if (u) {
          userId = userId || String(u.id || "").trim();
          navn = navn || String((u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || "").trim();
        }
      }
    } catch (_) {}
    try {
      if (!ansattId && window.supabaseClient && epost) {
        const ar = await supabaseClient.from("hand_ansatt").select("id,navn,epost").ilike("epost", epost).limit(1).maybeSingle();
        if (!ar.error && ar.data) {
          ansattId = String(ar.data.id || "").trim();
          navn = navn || String(ar.data.navn || "").trim();
          window.innloggetAnsattId = ansattId;
          localStorage.setItem("innloggetAnsattId", ansattId);
        }
      }
    } catch (_) {}
    return { epost, userId, ansattId, navn };
  }

  function erAdminBruker() {
    const rolle = String(window.innloggetRolle || localStorage.getItem("handInnloggetRolle") || localStorage.getItem("innloggetRolle") || "").toLowerCase();
    const epost = String(window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || localStorage.getItem("innloggetEpost") || "").toLowerCase();
    return epost === "greknuts@online.no" || ["admin", "administrator", "eier", "firmaeier", "owner", "sysadmin", "systemadmin", "sysadm"].includes(rolle);
  }

  function erEgenLoggrad(rad, ctx, ansattMap) {
    if (!rad || !ctx) return false;

    // Vanlig bruker skal bare se egne mottak/uttak.
    // Admin-godkjenninger/fylling av bil er ikke en personlig henting for brukeren,
    // selv om raden kan peke til samme bil eller samme e-post.
    const type = String(rad.type || rad.handling || "").toLowerCase();
    if (type.includes("admin_") || type.includes("admin")) return false;

    const epost = String(ctx.epost || "").trim().toLowerCase();
    const ansattId = String(ctx.ansattId || "").trim();
    const userId = String(ctx.userId || "").trim();

    const radAnsattId = String(rad.ansatt_id || rad.hentet_av_ansatt_id || rad.ansatt || "").trim();
    const radUserId = String(rad.bruker_id || rad.user_id || rad.auth_user_id || "").trim();

    if (ansattId && radAnsattId && ansattId === radAnsattId) return true;
    if (userId && radUserId && userId === radUserId) return true;

    const epostFelter = [
      rad.bruker_epost,
      rad.opprettet_av_epost,
      rad.hentet_av_epost,
      rad.epost,
      rad.email
    ].map(v => String(v || "").trim().toLowerCase());

    if (epost && epostFelter.some(v => v === epost)) return true;

    const ansatt = radAnsattId && ansattMap ? ansattMap.get(radAnsattId) : null;
    const ansattEpost = String((ansatt && ansatt.epost) || "").trim().toLowerCase();
    if (epost && ansattEpost && ansattEpost === epost) return true;

    // Ikke match på navn/rolle. Det kan gi feil person på samme bil.
    return false;
  }

  function sikreLagerloggBoks() {
    let liste = $("bilLagerLoggListe") || $("lagerLoggListe") || $("lagerloggListe");
    if (liste) return liste;

    const fyll = $("bilLagerFyllListe");
    const side = $("bilerSide") || document.body;
    const wrap = document.createElement("div");
    wrap.id = "bilLagerLoggWrap";
    wrap.className = "card";
    wrap.style.marginTop = "16px";
    wrap.innerHTML = `
      <h4>Lagerlogg</h4>
      <p class="info">Viser kun lagerlogg for innlogget elektriker/ansatt.</p>
      <div id="bilLagerLoggListe"><p class="info">Laster lagerlogg...</p></div>
    `;
    if (fyll && fyll.parentNode) fyll.parentNode.insertBefore(wrap, fyll.nextSibling);
    else side.appendChild(wrap);
    return $("bilLagerLoggListe");
  }

  async function hentLagerloggForInnlogget() {
    const ctx = await innloggetKontekst();
    if (!ctx.epost) return { data: [], error: new Error("Fant ikke innlogget e-post."), ctx };

    let q = supabaseClient
      .from("hand_lager_bevegelse")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    const bilId = valgtBilId();
    if (bilId) q = q.eq("bil_id", bilId);

    // Admin ser alt for valgt bil. Vanlig bruker filtreres etterpå mot ansatt_id/epost/user_id.
    // Dette tåler gamle databaser der ikke alle loggkolonner finnes.
    const res = await q;
    res.ctx = ctx;
    res.erAdmin = erAdminBruker();
    return res;
  }

  async function tegnLagerloggForBil() {
    const boks = sikreLagerloggBoks();
    if (!boks) return;
    if (!window.supabaseClient) {
      boks.innerHTML = '<p class="melding">Supabase er ikke lastet.</p>';
      return;
    }

    boks.innerHTML = '<p class="info">Laster lagerlogg...</p>';

    let res;
    try { res = await hentLagerloggForInnlogget(); }
    catch (e) { res = { data: [], error: e }; }

    if (res.error) {
      boks.innerHTML = '<p class="melding">Kunne ikke hente lagerlogg: ' + esc(res.error.message || res.error) + '</p>';
      return;
    }

    const alleRader = Array.isArray(res.data) ? res.data : [];
    if (!alleRader.length) {
      boks.innerHTML = '<p class="info">Ingen lagerlogg for ' + esc(valgtBilTekst()) + '.</p>';
      return;
    }

    const vareIds = [...new Set(alleRader.map(r => r && r.vare_id).filter(Boolean).map(String))];
    const ansattIds = [...new Set(alleRader.map(r => r && r.ansatt_id).filter(Boolean).map(String))];
    const vareMap = new Map();
    const ansattMap = new Map();

    try {
      if (vareIds.length) {
        const vr = await supabaseClient
          .from("hand_vare")
          .select("id,varenr,navn,varenavn,beskrivelse")
          .in("id", vareIds);
        if (!vr.error && Array.isArray(vr.data)) vr.data.forEach(v => vareMap.set(String(v.id), v));
      }
    } catch (e) { console.warn("Kunne ikke hente varenavn til lagerlogg:", e); }

    try {
      if (ansattIds.length) {
        const ar = await supabaseClient
          .from("hand_ansatt")
          .select("id,navn,epost")
          .in("id", ansattIds);
        if (!ar.error && Array.isArray(ar.data)) ar.data.forEach(a => ansattMap.set(String(a.id), a));
      }
    } catch (e) { console.warn("Kunne ikke hente ansattnavn til lagerlogg:", e); }

    const vanligBruker = !res.erAdmin;
    const rader = vanligBruker ? alleRader.filter(r => erEgenLoggrad(r, res.ctx, ansattMap)) : alleRader;
    if (!rader.length) {
      boks.innerHTML = '<p class="info">Ingen egen lagerlogg for ' + esc(valgtBilTekst()) + '.</p>';
      return;
    }

    function loggVarenavn(r) {
      const v = r && r.vare_id ? vareMap.get(String(r.vare_id)) : null;
      const kommentar = String((r && r.kommentar) || "");
      const fraKommentar = kommentar.match(/Vare:\s*([^|]+)/i);
      const varenr = (v && (v.varenr || v.vare_nr)) || r.varenr || "";
      const navn = r.varenavn || r.vare_navn || (v && (v.navn || v.varenavn || v.beskrivelse)) || "";
      if (navn) return (varenr ? varenr + " - " : "") + navn;
      if (fraKommentar && fraKommentar[1]) return fraKommentar[1].trim();
      return r.vare_id || "";
    }

    function loggHentetAv(r) {
      const a = r && r.ansatt_id ? ansattMap.get(String(r.ansatt_id)) : null;
      const fraKommentar = String((r && r.kommentar) || "").match(/Hentet av:\s*([^|]+)/i);
      return (r && (r.hentet_av || r.bruker_navn || r.bruker_epost || r.opprettet_av_navn || r.opprettet_av)) ||
        (a ? (a.navn || a.epost || "") : "") ||
        (fraKommentar ? fraKommentar[1].trim() : "");
    }

    boks.innerHTML = `
      <div class="info" style="margin:8px 0 6px 0; font-weight:bold;">${vanligBruker ? "Min lagerlogg" : "Lagerlogg"} for ${esc(valgtBilTekst())}</div>
      <div style="overflow:auto; max-height:360px; border:1px solid #374151; border-radius:10px; margin-top:8px;">
        <table class="bil-tabell kompakt-tabell">
          <thead>
            <tr><th>Dato</th><th>Type</th><th>Bil</th><th>Vare</th><th>Antall</th>${vanligBruker ? "" : "<th>Hentet av</th>"}</tr>
          </thead>
          <tbody>
            ${rader.map(r => `
              <tr>
                <td>${esc(dato(r.dato || r.created_at || r.opprettet))}</td>
                <td>${esc(r.type || r.handling || "")}</td>
                <td>${esc(r.bil_id || "")}</td>
                <td>${esc(loggVarenavn(r))}</td>
                <td>${esc(r.antall ?? "")}</td>
                ${vanligBruker ? "" : `<td>${esc(loggHentetAv(r))}</td>`}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  window.tegnLagerloggForBil = tegnLagerloggForBil;
  window.handLastLagerloggForBil = tegnLagerloggForBil;

  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "bilLagerBilValg") setTimeout(tegnLagerloggForBil, 80);
  }, true);
  document.addEventListener("handPartialerLastet", function () { setTimeout(tegnLagerloggForBil, 800); });
  document.addEventListener("DOMContentLoaded", function () { setTimeout(tegnLagerloggForBil, 1200); });
  window.addEventListener("load", function () {
    setTimeout(tegnLagerloggForBil, 1200);
    setTimeout(tegnLagerloggForBil, 2500);
  });
})();
