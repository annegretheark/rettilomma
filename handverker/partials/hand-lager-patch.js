
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


  async function hentFirmaIdForImport() {
    if (typeof window.hentInnloggetFirmaIdForBiler === "function") {
      return await window.hentInnloggetFirmaIdForBiler();
    }
    if (!window.supabaseClient || !supabaseClient.auth) {
      throw new Error("Supabase er ikke lastet.");
    }
    const u = await supabaseClient.auth.getUser();
    const user = u && u.data && u.data.user ? u.data.user : null;
    if (!user) throw new Error("Du er ikke innlogget.");
    const userId = user.id || "";
    const epost = String(user.email || window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || "").trim().toLowerCase();

    if (userId) {
      const r = await supabaseClient.from("hand_firma_bruker").select("firma_id").eq("user_id", userId).limit(1).maybeSingle();
      if (!r.error && r.data && r.data.firma_id) return r.data.firma_id;
    }
    if (epost) {
      const r = await supabaseClient.from("hand_firma_bruker").select("firma_id").ilike("epost", epost).limit(1).maybeSingle();
      if (!r.error && r.data && r.data.firma_id) return r.data.firma_id;
    }
    const lagret = localStorage.getItem("aktivFirmaId") || localStorage.getItem("handFirmaId") || localStorage.getItem("firma_id") || localStorage.getItem("firmaId") || "";
    if (lagret) return lagret;
    throw new Error("Bruker er ikke koblet til firma. Sjekk hand_firma_bruker.");
  }


  function parseCsvText(text) {
    text = String(text || "").replace(/^\uFEFF/, "");
    const firstLine = (text.split(/\r?\n/).find(l => l.trim()) || "");
    const delimiter = firstLine.includes(";") ? ";" : ",";
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') { cell += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cell += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === delimiter) { row.push(cell); cell = ""; }
        else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
        else if (ch !== "\r") cell += ch;
      }
    }
    row.push(cell);
    rows.push(row);
    const cleanRows = rows.filter(r => r.some(c => String(c || "").trim() !== ""));
    if (!cleanRows.length) return [];
    const headers = cleanRows.shift().map(h => repairText(h));
    return cleanRows.map(cols => {
      const obj = {};
      headers.forEach((h, idx) => { if (h) obj[h] = repairText(cols[idx] || ""); });
      return obj;
    });
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
    const buffer = await file.arrayBuffer();
    const name = String(file.name || "").toLowerCase();

    if (name.endsWith(".csv")) {
      let text = new TextDecoder("utf-8").decode(buffer);
      if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
      return parseCsvText(text);
    }

    if (typeof XLSX === "undefined") {
      throw new Error("XLSX-biblioteket er ikke lastet. CSV kan importeres uten XLSX, men Excel-filer krever XLSX.");
    }

    const workbook = XLSX.read(buffer, { type: "array", raw: false });
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

      const firmaId = await hentFirmaIdForImport();
      const rowsWithFirma = rows.map(function (row) {
        return Object.assign({}, row, { firma_id: firmaId });
      });

      msg("Lagrer " + rowsWithFirma.length + " varer i hovedlager...", false);

      let saved = 0;
      const errors = [];

      for (const row of rowsWithFirma) {
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
          res = await supabaseClient.from("hand_vare").update(row).eq("id", existing.id).select("id").single();
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

    const res = await supabaseClient.from("hand_vare").select("*").limit(1000);

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
