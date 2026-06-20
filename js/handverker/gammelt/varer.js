console.log("varer.js ren varemodul lastet 7062");

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

    let res = await supabaseClient.from("varer").select("*").limit(1000);

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
      res = await supabaseClient.from("varer").update(rad).eq("id", window.redigerVareId).select();
    } else {
      res = await supabaseClient.from("varer").insert([rad]).select();
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

  async function importerVarer(inputId = "importVarerFil") {
    const input = el(inputId) || el("importVarerFil");
    const fil = input?.files?.[0];

    if (!fil) {
      melding("Velg CSV- eller Excel-fil f\u00F8rst.", true);
      return;
    }

    if (typeof XLSX === "undefined") {
      melding("XLSX-biblioteket er ikke lastet.", true);
      return;
    }

    const buffer = await fil.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const r\u00E5Rader = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const hent = (rad, ...keys) => {
      for (const k of keys) {
        if (rad[k] !== undefined && rad[k] !== null && String(rad[k]).trim() !== "") return rad[k];
      }
      return "";
    };

    const rader = r\u00E5Rader.map(rad => {
      const varenr = String(hent(rad, "varenr", "Varenr", "vare_nr", "VareNr", "Artikkel", "artikkel")).trim();
      const navn = String(hent(rad, "navn", "Navn", "varenavn", "Varenavn", "vare", "Vare", "beskrivelse", "Beskrivelse")).trim();
      if (!varenr && !navn) return null;

      return {
        varenr: varenr || null,
        navn: navn || varenr,
        beskrivelse: String(hent(rad, "beskrivelse", "Beskrivelse", "tekst", "Tekst")).trim() || null,
        innpris: Number(String(hent(rad, "innpris", "Innpris", "kostpris", "Kostpris") || 0).replace(",", ".")) || 0,
        pris: Number(String(hent(rad, "pris", "Pris", "utpris", "Utpris", "utsalgspris", "Utsalgspris") || 0).replace(",", ".")) || 0,
        lager_antall: Number(String(hent(rad, "lager_antall", "Antall", "antall", "lager", "Lager") || 0).replace(",", ".")) || 0,
        minimum_antall: Number(String(hent(rad, "minimum_antall", "Minimum", "minimum", "min") || 0).replace(",", ".")) || 0,
        mva_prosent: Number(String(hent(rad, "mva_prosent", "MVA", "mva", "Mva") || 25).replace(",", ".")) || 25
      };
    }).filter(Boolean);

    if (!rader.length) {
      melding("Fant ingen varer i importfilen.", true);
      return;
    }

    const { error } = await supabaseClient.from("varer").upsert(rader, { onConflict: "varenr" });

    if (error) {
      melding("Import feilet: " + error.message, true);
      return;
    }

    melding(`Importerte ${rader.length} varer til hovedlager.`);
    await lastVarer();

    if (typeof window.fyllBilLagerVareValg === "function") {
      try { await window.fyllBilLagerVareValg(); } catch (e) { console.warn(e); }
    }
    if (typeof window.lastBilerOgBilLager === "function") {
      try { await window.lastBilerOgBilLager(); } catch (e) { console.warn(e); }
    }
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

  document.addEventListener("DOMContentLoaded", initVarer);
  window.addEventListener("load", function () {
    initVarer();
    setTimeout(initVarer, 300);
    setTimeout(initVarer, 1000);
  });
})();
