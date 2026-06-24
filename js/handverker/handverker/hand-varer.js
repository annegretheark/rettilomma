console.log("varer.js prod varemodul lastet 7072");

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


  function tekst(v) { return String(v == null ? "" : v).trim(); }

  async function hentFirmaIdForVarer() {
    const norm = v => String(v == null ? "" : v).trim();

    function lagreFirmaId(id) {
      id = norm(id);
      if (!id) return "";
      window.aktivFirmaId = id;
      window.handFirmaId = id;
      window.handAnsattFirmaId = id;
      try {
        localStorage.setItem("aktivFirmaId", id);
        localStorage.setItem("handFirmaId", id);
        localStorage.setItem("firmaId", id);
        localStorage.setItem("firma_id", id);
        localStorage.setItem("rilSikkerFirmaId", id);
      } catch (e) {}
      return id;
    }

    // 7076: Firma-tilgang styres sentralt:
    // - firma_brukere = eier/hovedkonto
    // - ansatte = ansatte med tildelte rettigheter
    // Import kan bruke eier eller ansatt-admin. Ikke lag falsk firma-bruker i frontend.
    if (typeof window.handFinnFirmaTilgang === "function") {
      try {
        const tilgang = await window.handFinnFirmaTilgang();
        if (tilgang && tilgang.firma_id) return lagreFirmaId(tilgang.firma_id);
      } catch (e) {
        console.warn("Kunne ikke hente firma-tilgang fra rolle-kjerne", e);
      }
    }

    const lokale = [
      window.aktivFirmaId,
      window.handFirmaId,
      window.handAnsattFirmaId,
      localStorage.getItem("aktivFirmaId"),
      localStorage.getItem("handFirmaId"),
      localStorage.getItem("firmaId"),
      localStorage.getItem("firma_id"),
      localStorage.getItem("rilSikkerFirmaId")
    ].map(norm).find(Boolean);
    if (lokale) return lagreFirmaId(lokale);

    if (typeof window.hentAktivFirmaId === "function") {
      try {
        const id = norm(await window.hentAktivFirmaId());
        if (id) return lagreFirmaId(id);
      } catch (e) { console.warn("Kunne ikke hente aktivt firma fra global funksjon", e); }
    }

    return "";
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

    const firmaIdForVare = await hentFirmaIdForVarer();
    if (firmaIdForVare) rad.firma_id = firmaIdForVare;

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
    const firmaId = tekst(rad && rad.firma_id) || await hentFirmaIdForVarer();
    if (firmaId) rad.firma_id = firmaId;

    if (rad.varenr) {
      let q = supabaseClient
        .from("hand_vare")
        .select("id")
        .eq("varenr", rad.varenr)
        .limit(1);
      if (firmaId) q = q.eq("firma_id", firmaId);
      const eksisterende = await q;

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

  let importKjorer = false;

  async function importerRaderTilLager(raaRader, kildeTekst) {
    const firmaIdForImport = await hentFirmaIdForVarer();
    if (!firmaIdForImport) {
      melding("Import stoppet: fant ikke firma_id. Sjekk at brukeren ligger i firma_brukere som eier/admin eller i ansatte med admin for firmaet.", true);
      return false;
    }

    const rader = (raaRader || []).map(rad => {
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
        lager_antall: nummerFraImport(hentImportVerdi(rad, "lager_antall", "lager", "antall", "beholdning", "antall pa hovedlager", "antall på hovedlager"), 0),
        minimum_antall: nummerFraImport(hentImportVerdi(rad, "minimum_antall", "minimum", "min", "minimum hovedlager"), 0),
        mva_prosent: nummerFraImport(hentImportVerdi(rad, "mva_prosent", "mva", "mva %", "mva%"), 25),
        firma_id: firmaIdForImport
      };
    }).filter(Boolean);

    if (!rader.length) {
      melding("Fant ingen varer i importfilen. Sjekk kolonneoverskriftene.", true);
      return false;
    }

    const knapp = el("importVarerKnapp");
    const lastInnKnapp = el("lastInnLasLagerKnapp");
    if (knapp) { knapp.disabled = true; }
    if (lastInnKnapp) lastInnKnapp.disabled = true;
    melding("Importerer " + rader.length + " varer" + (kildeTekst ? " fra " + kildeTekst : "") + "...");

    let lagret = 0;
    try {
      for (const rad of rader) {
        const res = await lagreImportRad(rad);
        if (res.error) throw res.error;
        lagret += 1;
        if (lagret % 10 === 0) melding("Importerer... " + lagret + " av " + rader.length);
      }
    } catch (e) {
      melding("Import stoppet etter " + lagret + " varer: " + (e.message || String(e)), true);
      console.error("Vareimport feilet", e);
      if (knapp) { knapp.disabled = false; knapp.textContent = "Importer varer"; }
      if (lastInnKnapp) lastInnKnapp.disabled = false;
      return false;
    }

    melding("Importerte " + lagret + " varer til hovedlager.");
    if (knapp) { knapp.disabled = false; knapp.textContent = "Importer varer"; }
    if (lastInnKnapp) lastInnKnapp.disabled = false;

    await lastVarer();

    if (typeof window.fyllBilLagerVareValg === "function") {
      try { await window.fyllBilLagerVareValg(); } catch (e) { console.warn(e); }
    }
    if (typeof window.lastBilerOgBilLager === "function") {
      try { await window.lastBilerOgBilLager(); } catch (e) { console.warn(e); }
    }
    return true;
  }

  async function importerVarer(inputId = "importVarerFil") {
    if (importKjorer) return false;
    importKjorer = true;
    try {
      const input = el(inputId) || el("importVarerFil");
      const fil = input && input.files && input.files[0];

      if (!fil) {
        melding("Velg CSV- eller Excel-fil forst.", true);
        return false;
      }

      if (!window.supabaseClient) {
        melding("Supabase er ikke lastet. Import kan ikke kjores.", true);
        return false;
      }

      let raaRader = [];
      try {
        raaRader = await lesImportRader(fil);
      } catch (e) {
        melding("Kunne ikke lese importfilen: " + (e.message || String(e)), true);
        return false;
      }
      return await importerRaderTilLager(raaRader, fil.name || "fil");
    } finally {
      importKjorer = false;
      const knapp = el("importVarerKnapp");
      const lastInnKnapp = el("lastInnLasLagerKnapp");
      if (knapp) { knapp.disabled = false; knapp.textContent = "Importer varer"; }
      if (lastInnKnapp) lastInnKnapp.disabled = false;
    }
  }

  async function lastInnLasesmedLager() {
    if (importKjorer) return false;
    if (!window.supabaseClient) {
      melding("Supabase er ikke lastet. Import kan ikke kjores.", true);
      return false;
    }
    importKjorer = true;
    try {
      const csv = window.HAND_LASESMED_LAGER_CSV || "varenr,navn,beskrivelse,innpris,pris,lager_antall,minimum_antall,mva_prosent\nLS-001,Sylinder oval 6-stift,Standard oval lassesylinder 6-stift,185,555,20,5,25\nLS-002,Sylinder rund 6-stift,Standard rund lassesylinder 6-stift,195,585,15,4,25\nLS-003,Sylinder sett 2 stk,To like lassesylindre med samme nokkel,390,1170,10,3,25\nLS-004,Knappvrider oval,Innvendig knappvrider til oval sylinder,95,285,25,5,25\nLS-005,Sylinderforlenger 10 mm,Forlenger til lassesylinder 10 mm,45,135,30,10,25\nLS-006,Sylinderforlenger 20 mm,Forlenger til lassesylinder 20 mm,55,165,25,8,25\nLS-007,Laskasse 2014,Standard laskasse for innerdor ytterdor,320,960,12,3,25\nLS-008,Laskasse 565,Modullaskasse for ytterdor,395,1185,10,3,25\nLS-009,Laskasse 8765,Hakereilelaskasse for terrassedor balkongdor,470,1410,8,2,25\nLS-010,Sluttstykke standard,Standard sluttstykke for karm,85,255,30,10,25\nLS-011,Elektrisk sluttstykke 12V,Elektrisk sluttstykke fail secure,690,2070,4,1,25\nLS-012,Panikkbeslag,Panikklasbeslag til romningsdor,1250,3750,2,1,25\nLS-013,Dorvrider inne,Standard dorvrider innendors,120,360,25,6,25\nLS-014,Dorvrider ute,Robust dorvrider ytterdor,185,555,20,5,25\nLS-015,Skiltsett sylinder,Skilt og dekkring til sylinder,90,270,25,5,25\nLS-016,Sikkerhetsskilt,Forsterket sikkerhetsskilt,220,660,12,3,25\nLS-017,Hengelass 40 mm,Hengelass messing 40 mm,95,285,30,8,25\nLS-018,Hengelass 50 mm,Hengelass messing 50 mm,135,405,25,6,25\nLS-019,Hengelass klasse 3,Forsikringsgodkjent hengelass klasse 3,420,1260,10,3,25\nLS-020,Kjetting 8 mm,Lasbar kjetting 8 mm per meter,110,330,15,5,25\nLS-021,Nokkelemne standard,Standard nokkelemne,18,54,200,50,25\nLS-022,Nokkelemne system,Systemnokkelemne,45,135,100,20,25\nLS-023,Nokkelring 25 mm,Nokkelring stal 25 mm,3,9,300,100,25\nLS-024,Nokkelskilt plast,Merkskilt for nokler plast,4,12,200,50,25\nLS-025,Nokkelboks kode,Liten nokkelboks med kode,260,780,8,2,25\nLS-026,Dorpumpe standard,Dorpumpe for innerdor,590,1770,6,2,25\nLS-027,Dorpumpe kraftig,Dorpumpe for ytterdor tung dor,890,2670,4,1,25\nLS-028,Arm til dorpumpe,Standard arm til dorpumpe,160,480,8,2,25\nLS-029,Dorstopp gulv,Gulvmontert dorstopper,55,165,25,8,25\nLS-030,Dorholder,Dorholder mekanisk,210,630,10,3,25\nLS-031,Brytebeslag 210 cm,Brytebeslag for ytterdor 210 cm,520,1560,5,2,25\nLS-032,Bakkantsikring,Bakkantsikring til dor,180,540,12,4,25\nLS-033,Postkasselas,Postkasselas med 2 nokler,75,225,30,8,25\nLS-034,Skaplas,Skaplas standard,65,195,30,8,25\nLS-035,Vinduslas,Vinduslas komplett,140,420,20,5,25\nLS-036,Kodelas mekanisk,Mekanisk kodelas,980,2940,3,1,25\nLS-037,Kodelas elektronisk,Elektronisk kodelas batteridrevet,1550,4650,2,1,25\nLS-038,Kortleser adgang,Kortleser til adgangskontroll,1290,3870,2,1,25\nLS-039,Adgangsbrikke,RFID adgangsbrikke,35,105,100,20,25\nLS-040,Batteri CR2032,Knappcellebatteri CR2032,12,36,50,15,25\nLS-041,Batteri AA 4-pk,AA batterier 4-pakning,28,84,30,10,25\nLS-042,Lasspray,Lasspray smoring 50 ml,38,114,40,10,25\nLS-043,Graphite pulver,Grafittpulver til las,42,126,25,8,25\nLS-044,Monteringsskrue sett,Skruesett for las og beslag,25,75,50,15,25\nLS-045,Dorhengsel 110 mm,Dorhengsel 110 mm,75,225,20,5,25\nLS-046,Hengselretter,Verktoy for justering av hengsler,310,930,4,1,25\nLS-047,Nokkelmaskin fres,Reserveskjaer til nokkelmaskin,690,2070,2,1,25\nLS-048,Maaleverkttoy sylinder,Maleverkttoy for sylinderlengde,180,540,5,1,25\nLS-049,Sikkerhetsrosett,Sikkerhetsrosett rund,240,720,10,3,25\nLS-050,Blindskilt,Dekkskilt blindskilt,80,240,20,5,25\nLS-051,Laskasse smalprofil,Smalprofil laskasse,460,1380,6,2,25\nLS-052,Sluttstykke smalprofil,Sluttstykke smalprofil,145,435,12,3,25\nLS-053,Magnetkontakt,Magnetkontakt for alarm dor vindu,95,285,15,5,25\nLS-054,Dorautomatikk impulsbryter,Impulsbryter til dorautomatikk,390,1170,5,2,25\nLS-055,Servicepakke las,Standard servicepakke for lassesmed,350,1050,10,3,25";
      const raaRader = parseCsvTekst(csv);
      return await importerRaderTilLager(raaRader, "lasesmed standardlager");
    } finally {
      importKjorer = false;
      const knapp = el("importVarerKnapp");
      const lastInnKnapp = el("lastInnLasLagerKnapp");
      if (knapp) { knapp.disabled = false; knapp.textContent = "Importer varer"; }
      if (lastInnKnapp) lastInnKnapp.disabled = false;
    }
  }


  // Prod 7075: binding for importknappene.
  // Denne ligger på document i capture-fasen og stopper andre globale klikkvakter
  // før de rekker å overstyre Varer-siden. Dermed kan knappen ikke bare blinke.
  function installerImportCapture7071() {
    if (window.__handVarerImportCapture7071) return;
    window.__handVarerImportCapture7071 = true;

    document.addEventListener("click", function (e) {
      const knapp = e.target && e.target.closest ? e.target.closest("#importVarerKnapp,#lastInnLasLagerKnapp") : null;
      if (!knapp) return;

      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();

      if (knapp.id === "importVarerKnapp") {
        importerVarer("importVarerFil");
      } else {
        lastInnLasesmedLager();
      }
      return false;
    }, true);
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

    installerImportCapture7071();

    const importVarerKnapp = el("importVarerKnapp");
    if (importVarerKnapp) {
      importVarerKnapp.type = "button";
      importVarerKnapp.onclick = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
        importerVarer("importVarerFil");
        return false;
      };
    }

    const lastInnLasLagerKnapp = el("lastInnLasLagerKnapp");
    if (lastInnLasLagerKnapp) {
      lastInnLasLagerKnapp.type = "button";
      lastInnLasLagerKnapp.onclick = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
        lastInnLasesmedLager();
        return false;
      };
    }

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
    installerImportCapture7071();
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
  window.lastInnLasesmedLager = lastInnLasesmedLager;
  window.tegnVarer = tegnVarer;
  window.visKunSide = visKunSide;
  window.handKobleVarerKnapper = kobleKnapper;

  document.addEventListener("handPartialerLastet", function () { setTimeout(initVarer, 0); });
  document.addEventListener("DOMContentLoaded", initVarer);
  window.addEventListener("load", initVarer);
})();
