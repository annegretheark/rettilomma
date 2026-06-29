console.log("varer.js prod varemodul lastet 7069");

(function () {
  "use strict";

  let varerListe = [];
  window.redigerVareId = window.redigerVareId || null;

  function el(id) { return document.getElementById(id); }

  function val(id) {
    const e = el(id);
    return e ? String(e.value || "").trim() : "";
  }

  function setVal(id, verdi) {
    const e = el(id);
    if (e) e.value = verdi ?? "";
  }

  function tall(id, standard = 0) {
    const v = val(id);
    if (v === "") return standard;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : standard;
  }

  function melding(tekst, feil = false) {
    let m = el("vareMelding") || el("varerMelding");
    if (!m) {
      m = document.createElement("div");
      m.id = "vareMelding";
      m.className = "melding";
      const side = el("varerSide") || document.body;
      side.prepend(m);
    }
    m.textContent = tekst || "";
    m.style.color = feil ? "#fca5a5" : "#86efac";
    if (feil) console.error(tekst);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function varenavn(v) {
    return v?.navn || v?.varenavn || v?.beskrivelse || v?.varenr || "Vare";
  }

  function varepris(v) {
    return Number(v?.pris ?? v?.utpris ?? v?.utsalgspris ?? v?.salgspris ?? 0);
  }

  function visKunSide(sideId) {
    const appSide = el("appSide");
    if (appSide) {
      appSide.classList.remove("skjult", "hidden");
      appSide.style.display = "";
    }

    const sider = [
      "backupSide", "timerSide", "fakturaSide", "bilerSide", "varerSide",
      "lonnPanel", "kundeSide", "ansattSide", "firmaSide", "modulerSide", "testSide"
    ];

    sider.forEach(id => {
      const s = el(id);
      if (!s) return;
      if (id === sideId) {
        s.classList.remove("skjult", "hidden", "modul-skjult");
        s.style.display = "";
      } else {
        s.classList.add("skjult");
        s.style.display = "none";
      }
    });
  }

  async function visVarerSide() {
    const side = el("varerSide");
    if (!side) {
      alert("Fant ikke varerSide i index.html");
      return;
    }

    // Viktig: Vis siden F\u00D8R databasekall. Hvis database feiler, skal ikke knappen virke d\u00F8d.
    visKunSide("varerSide");
    melding("Laster varer...");

    try {
      await lastVarer();
      melding("");
    } catch (e) {
      console.error("Varer feilet:", e);
      melding("Varer ble \u00E5pnet, men lasting feilet: " + (e.message || String(e)), true);
    }
  }

  function tilbakeFraVarer() {
    if (typeof window.visTimerSide === "function") {
      window.visTimerSide();
      return;
    }
    visKunSide("timerSide");
  }

  function settVareSelect(selectId, liste, tomTekst) {
    const s = el(selectId);
    if (!s) return;

    const valgt = s.value;
    s.innerHTML = `<option value="">${tomTekst || "Velg vare"}</option>`;

    liste.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.dataset.pris = varepris(v);
      opt.textContent = `${v.varenr ? v.varenr + " - " : ""}${varenavn(v)}`;
      s.appendChild(opt);
    });

    if (valgt && Array.from(s.options).some(o => String(o.value) === String(valgt))) {
      s.value = valgt;
    }
  }

  async function lastVarer() {
    const liste = el("vareListe");
    if (liste) liste.innerHTML = `<p class="info">Laster varer...</p>`;

    if (!window.supabaseClient) {
      varerListe = [];
      tegnVarer();
      melding("Supabase er ikke lastet. Sjekk js/core/config.js.", true);
      return [];
    }

    let res = await supabaseClient.from("hand_vare").select("*").limit(1000);

    if (res.error) {
      varerListe = [];
      tegnVarer();
      melding("Feil ved henting av varer: " + res.error.message, true);
      return [];
    }

    varerListe = (res.data || []).sort((a, b) =>
      String(varenavn(a)).localeCompare(String(varenavn(b)), "no")
    );

    window.varer = varerListe;

    settVareSelect("lagerVareValg", varerListe, "Velg vare");
    settVareSelect("bilLagerVareValg", varerListe, "Velg vare");

    if (typeof window.fyllVarevalgFraAktivBil === "function") {
      try {
        await window.fyllVarevalgFraAktivBil();
      } catch (e) {
        console.warn("Kunne ikke fylle varevalg fra bil:", e);
        settVareSelect("vareValg", varerListe, "Velg vare");
      }
    } else {
      settVareSelect("vareValg", varerListe, "Velg vare");
    }

    tegnVarer();
    return varerListe;
  }

  function tegnVarer() {
    const c = el("vareListe");
    if (!c) return;

    if (!varerListe.length) {
      c.innerHTML = `<p class="info">Ingen varer registrert.</p>`;
      return;
    }

    c.innerHTML = `
      <table class="kompakt-tabell vare-enlinje-tabell">
        <thead>
          <tr>
            <th>Varenr</th>
            <th>Navn</th>
            <th>Inn</th>
            <th>Ut</th>
            <th>Hovedlager</th>
            <th>Minimum</th>
            <th>MVA</th>
            <th>Endre</th>
          </tr>
        </thead>
        <tbody>
          ${varerListe.map(v => `
            <tr class="klikkbar-vare-rad" onclick="window.redigerVare('${escapeHtml(v.id)}')" title="Klikk for å redigere varen">
              <td>${escapeHtml(v.varenr || "")}</td>
              <td>${escapeHtml(varenavn(v))}</td>
              <td>${escapeHtml(v.innpris ?? v.vareinnpris ?? 0)}</td>
              <td>${escapeHtml(varepris(v))}</td>
              <td>${escapeHtml(v.lager_antall ?? v.antall ?? v.beholdning ?? 0)}</td>
              <td>${escapeHtml(v.minimum_antall ?? v.min_antall ?? 0)}</td>
              <td>${escapeHtml(v.mva_prosent ?? v.mva ?? 25)}</td>
              <td><button type="button" class="secondary liten-knapp" onclick="event.stopPropagation(); window.redigerVare('${escapeHtml(v.id)}')">Endre</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function redigerVare(id) {
    const v = varerListe.find(x => String(x.id) === String(id));
    if (!v) return;

    setVal("varenr", v.varenr || "");
    setVal("varenavn", v.navn || v.varenavn || "");
    setVal("varebeskrivelse", v.beskrivelse || "");
    setVal("vareinnpris", v.innpris ?? v.vareinnpris ?? 0);
    setVal("varepris", v.pris ?? v.utpris ?? v.utsalgspris ?? v.salgspris ?? 0);
    setVal("varelagerAntall", v.lager_antall ?? v.antall ?? v.beholdning ?? 0);
    setVal("vareMinimumAntall", v.minimum_antall ?? v.min_antall ?? 0);
    setVal("varemva", v.mva_prosent ?? v.mva ?? 25);

    window.redigerVareId = id;
    melding("Redigerer vare. Trykk Lagre vare n\u00E5r du er ferdig.");

    const felt = el("varenr") || el("varenavn");
    if (felt) {
      felt.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => felt.focus(), 150);
    }
  }

  async function lagreVare() {
    if (!window.supabaseClient) {
      melding("Supabase er ikke lastet. Sjekk js/core/config.js.", true);
      return;
    }

    const navn = val("varenavn");
    const varenr = val("varenr");

    if (!navn && !varenr) {
      melding("Skriv varenavn eller varenr f\u00F8rst.", true);
      return;
    }

    const innpris = tall("vareinnpris", 0);
    const paslag = tall("varepaslag", 3);
    const prisFelt = val("varepris");
    const pris = prisFelt === "" ? innpris * paslag : tall("varepris", 0);

    const rad = {
      varenr: varenr || null,
      navn: navn || varenr,
      beskrivelse: val("varebeskrivelse") || null,
      innpris,
      pris,
      lager_antall: tall("varelagerAntall", 0),
      minimum_antall: tall("vareMinimumAntall", 0),
      mva_prosent: tall("varemva", 25)
    };

    let res;
    if (window.redigerVareId) {
      res = await supabaseClient.from("hand_vare").update(rad).eq("id", window.redigerVareId).select();
    } else {
      res = await supabaseClient.from("hand_vare").insert([rad]).select();
    }

    if (res.error) {
      melding("Kunne ikke lagre vare: " + res.error.message, true);
      return;
    }

    ["varenr", "varenavn", "varebeskrivelse", "vareinnpris", "varepris"].forEach(id => setVal(id, ""));
    setVal("varepaslag", "3");
    setVal("varelagerAntall", "0");
    setVal("vareMinimumAntall", "0");
    setVal("varemva", "25");
    window.redigerVareId = null;

    melding("Vare lagret.");
    await lastVarer();

    if (typeof window.fyllBilLagerVareValg === "function") {
      try { await window.fyllBilLagerVareValg(); } catch (e) { console.warn(e); }
    }
  }

  function normaliserImportTekst(v) {
    return String(v == null ? "" : v).trim().replace(/^\uFEFF/, "");
  }

  function parseCsvLinje(linje, separator) {
    const ut = [];
    let felt = "";
    let i = 0;
    let iAnforsel = false;
    while (i < linje.length) {
      const ch = linje[i];
      if (ch === '"') {
        if (iAnforsel && linje[i + 1] === '"') {
          felt += '"';
          i += 2;
          continue;
        }
        iAnforsel = !iAnforsel;
        i += 1;
        continue;
      }
      if (ch === separator && !iAnforsel) {
        ut.push(felt);
        felt = "";
        i += 1;
        continue;
      }
      felt += ch;
      i += 1;
    }
    ut.push(felt);
    return ut;
  }

  function parseCsvTekst(tekst) {
    tekst = String(tekst || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const linjer = tekst.split("\n").filter(l => l.trim() !== "");
    if (!linjer.length) return [];

    const headerLinje = linjer[0];
    const semi = (headerLinje.match(/;/g) || []).length;
    const komma = (headerLinje.match(/,/g) || []).length;
    const tab = (headerLinje.match(/\t/g) || []).length;
    const separator = tab > semi && tab > komma ? "\t" : (semi >= komma ? ";" : ",");

    const headere = parseCsvLinje(headerLinje, separator).map(h => normaliserImportTekst(h).toLowerCase());
    const rader = [];
    for (let i = 1; i < linjer.length; i++) {
      const verdier = parseCsvLinje(linjer[i], separator);
      const rad = {};
      headere.forEach((h, idx) => { rad[h] = normaliserImportTekst(verdier[idx]); });
      rader.push(rad);
    }
    return rader;
  }

  function nummerFraImport(v, standard = 0) {
    const tekst = normaliserImportTekst(v);
    if (!tekst) return standard;
    const n = Number(tekst.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : standard;
  }

  function hentImportVerdi(rad, ...keys) {
    const map = {};
    Object.keys(rad || {}).forEach(k => { map[String(k).trim().toLowerCase()] = rad[k]; });
    for (const key of keys) {
      const v = map[String(key).trim().toLowerCase()];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  }

  async function lesImportRader(fil) {
    const navn = String(fil && fil.name || "").toLowerCase();
    if ((navn.endsWith(".xlsx") || navn.endsWith(".xls")) && typeof XLSX !== "undefined") {
      const buffer = await fil.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json(sheet, { defval: "" });
    }
    const tekst = await fil.text();
    return parseCsvTekst(tekst);
  }

  async function lagreImportRad(rad) {
    if (rad.varenr) {
      const eksisterende = await supabaseClient
        .from("hand_vare")
        .select("id")
        .eq("varenr", rad.varenr)
        .limit(1);

      if (eksisterende.error) return { error: eksisterende.error };
      if (eksisterende.data && eksisterende.data[0]) {
        return await supabaseClient
          .from("hand_vare")
          .update(rad)
          .eq("id", eksisterende.data[0].id)
          .select();
      }
    }
    return await supabaseClient.from("hand_vare").insert([rad]).select();
  }

  async function importerVarer(inputId = "importVarerFil") {
    const input = el(inputId) || el("importVarerFil");
    const fil = input && input.files && input.files[0];

    if (!fil) {
      melding("Velg CSV- eller Excel-fil først.", true);
      return false;
    }

    if (!window.supabaseClient) {
      melding("Supabase er ikke lastet. Import kan ikke kjøres.", true);
      return false;
    }

    let råRader = [];
    try {
      råRader = await lesImportRader(fil);
    } catch (e) {
      melding("Kunne ikke lese importfilen: " + (e.message || String(e)), true);
      return false;
    }

    const rader = (råRader || []).map(rad => {
      const varenr = normaliserImportTekst(hentImportVerdi(rad, "varenr", "varenummer", "vare_nr", "varenr.", "artikkel", "artikkelnr", "sku"));
      const navn = normaliserImportTekst(hentImportVerdi(rad, "navn", "varenavn", "vare", "produkt", "beskrivelse"));
      if (!varenr && !navn) return null;

      const innpris = nummerFraImport(hentImportVerdi(rad, "innpris", "kostpris", "netto", "pris inn", "innpris eks. mva"), 0);
      const pris = nummerFraImport(hentImportVerdi(rad, "pris", "utpris", "salgspris", "utsalgspris", "utpris eks. mva"), 0);

      return {
        varenr: varenr || null,
        navn: navn || varenr,
        beskrivelse: normaliserImportTekst(hentImportVerdi(rad, "beskrivelse", "tekst", "notat")) || null,
        innpris,
        pris,
        lager_antall: nummerFraImport(hentImportVerdi(rad, "lager_antall", "lager", "antall", "beholdning", "antall på hovedlager"), 0),
        minimum_antall: nummerFraImport(hentImportVerdi(rad, "minimum_antall", "minimum", "min", "minimum hovedlager"), 0),
        mva_prosent: nummerFraImport(hentImportVerdi(rad, "mva_prosent", "mva", "mva %", "mva%"), 25)
      };
    }).filter(Boolean);

    if (!rader.length) {
      melding("Fant ingen varer i importfilen. Sjekk kolonneoverskriftene.", true);
      return false;
    }

    const knapp = el("importVarerKnapp");
    if (knapp) { knapp.disabled = true; knapp.textContent = "Importerer..."; }
    melding("Importerer " + rader.length + " varer...");

    let lagret = 0;
    try {
      for (const rad of rader) {
        const res = await lagreImportRad(rad);
        if (res.error) throw res.error;
        lagret += 1;
      }
    } catch (e) {
      melding("Import stoppet etter " + lagret + " varer: " + (e.message || String(e)), true);
      if (knapp) { knapp.disabled = false; knapp.textContent = "Importer varer"; }
      return false;
    }

    melding("Importerte " + lagret + " varer til hovedlager.");
    if (knapp) { knapp.disabled = false; knapp.textContent = "Importer varer"; }

    await lastVarer();

    if (typeof window.fyllBilLagerVareValg === "function") {
      try { await window.fyllBilLagerVareValg(); } catch (e) { console.warn(e); }
    }
    if (typeof window.lastBilerOgBilLager === "function") {
      try { await window.lastBilerOgBilLager(); } catch (e) { console.warn(e); }
    }
    return true;
  }


  function kobleKnapper() {
    const varerKnapp = el("varerKnapp");
    if (varerKnapp) {
      varerKnapp.onclick = function (e) {
        if (e) e.preventDefault();
        window.visVarerSide();
      };
    }

    const lagreVareKnapp = el("lagreVareKnapp");
    if (lagreVareKnapp) lagreVareKnapp.onclick = lagreVare;

    const tilbakeFraVarerKnapp = el("tilbakeFraVarerKnapp");
    if (tilbakeFraVarerKnapp) tilbakeFraVarerKnapp.onclick = tilbakeFraVarer;

    const importVarerKnapp = el("importVarerKnapp");
    if (importVarerKnapp) importVarerKnapp.onclick = function () { importerVarer("importVarerFil"); };

    const importBilLagerKnapp = el("importBilLagerKnapp");
    if (importBilLagerKnapp) {
      importBilLagerKnapp.onclick = async function () {
        await importerVarer("importBilLagerFil");
      };
    }

    const innpris = el("vareinnpris");
    const paslag = el("varepaslag");
    const pris = el("varepris");

    function regnUtPris() {
      if (!innpris || !paslag || !pris) return;
      pris.value = (tall("vareinnpris", 0) * tall("varepaslag", 3)).toFixed(2);
    }

    if (innpris && !innpris.dataset.varerKoblet7020) {
      innpris.dataset.varerKoblet7020 = "1";
      innpris.addEventListener("input", regnUtPris);
    }

    if (paslag && !paslag.dataset.varerKoblet7020) {
      paslag.dataset.varerKoblet7020 = "1";
      paslag.addEventListener("input", regnUtPris);
    }
  }

  function leggTilStil() {
    if (el("varerStil7020")) return;

    const style = document.createElement("style");
    style.id = "varerStil7020";
    style.textContent = `
      .kompakt-tabell { width:100%; border-collapse:collapse; font-size:13px; margin-top:10px; }
      .kompakt-tabell th, .kompakt-tabell td {
        border-bottom:1px solid #374151;
        padding:6px 8px;
        text-align:left;
        vertical-align:middle;
        white-space:nowrap;
      }
      .kompakt-tabell th { background:#111827; color:#f3f4f6; }
      .kompakt-tabell td { color:#f3f4f6; }
      .vare-enlinje-tabell td:nth-child(2) { white-space:normal; min-width:180px; }
      .liten-knapp { padding:5px 8px; font-size:12px; margin:0; }
      #vareListe { overflow-x:auto; }
      .klikkbar-vare-rad { cursor:pointer; }
      .klikkbar-vare-rad:hover td { background:#1f2937; }
      .vare-enlinje-tabell th:last-child,
      .vare-enlinje-tabell td:last-child {
        position:sticky;
        right:0;
        background:#111827;
        z-index:3;
      }
      .vare-enlinje-tabell td:last-child { min-width:72px; }
    `;
    document.head.appendChild(style);
  }

  function initVarer() {
    leggTilStil();
    kobleKnapper();
  }

  // Viktig: visVarer skal n\u00E5 vise siden, ikke bare laste varer.
  window.visVarerSide = visVarerSide;
  window.visVarer = visVarerSide;
  window.lastVarer = lastVarer;
  window.lagreVare = lagreVare;
  window.redigerVare = redigerVare;
  window.importerVarer = importerVarer;
  window.importerVarerTilHovedlager = importerVarer;
  window.tegnVarer = tegnVarer;
  window.visKunSide = visKunSide;
  window.handKobleVarerKnapper = kobleKnapper;

  document.addEventListener("click", function (e) {
    const knapp = e.target && e.target.closest && e.target.closest("#importVarerKnapp");
    if (!knapp) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    importerVarer("importVarerFil");
    return false;
  }, true);

  document.addEventListener("handPartialerLastet", function () { setTimeout(initVarer, 0); });
  document.addEventListener("DOMContentLoaded", initVarer);
  window.addEventListener("load", function () {
    initVarer();
    setTimeout(initVarer, 300);
    setTimeout(initVarer, 1000);
  });
})();
