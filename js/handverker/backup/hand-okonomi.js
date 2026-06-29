console.log("okonomi.js er lastet - klikkbar økonomioversikt med fakturastatus");

(function okonomiInstallerMobilCss() {
  if (document.getElementById("okonomiMobilCss")) return;
  const style = document.createElement("style");
  style.id = "okonomiMobilCss";
  style.textContent = `
    #okonomiOversikt { max-width: 100%; overflow-x: hidden; }
    #okonomiOversikt h4 { margin: 8px 0 3px 0; font-size: 13px; }
    #okonomiOversikt .okonomi-scroll {
      width: auto;
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 8px;
    }

    /* VIKTIG: Tabellen skal IKKE strekkes til 100%.
       Når den strekkes, lager nettleseren stor tom luft mellom Vare/Beskrivelse og Antall/Eks/Handlinger.
       width:max-content gjør at kolonnene bare blir så brede som innholdet trenger. */
    #okonomiOversikt table.okonomi-tabell {
      width: max-content;
      max-width: 100%;
      min-width: 0;
      border-collapse: collapse;
      table-layout: auto;
      font-size: 13px;
      line-height: 1.15;
    }
    #okonomiOversikt .okonomi-tabell th,
    #okonomiOversikt .okonomi-tabell td {
      padding: 2px 4px;
      vertical-align: middle;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-bottom: 1px solid rgba(128,128,128,.18);
    }
    #okonomiOversikt .okonomi-tabell tr.klikkbar-okonomi { cursor: pointer; }
    #okonomiOversikt .okonomi-tabell tr.klikkbar-okonomi:hover { background: rgba(128,128,128,.09); }

    /* Smale faste kolonner. Ingen kolonne får lov å sluke resten av skjermen. */
    #okonomiOversikt .okonomi-tabell th:nth-child(1),
    #okonomiOversikt .okonomi-tabell td:nth-child(1) { width: 56px; max-width: 56px; }
    #okonomiOversikt .okonomi-tabell th:nth-child(2),
    #okonomiOversikt .okonomi-tabell td:nth-child(2) { width: 86px; max-width: 86px; }
    #okonomiOversikt .okonomi-tabell th:nth-child(3),
    #okonomiOversikt .okonomi-tabell td:nth-child(3) { width: 58px; max-width: 58px; }
    #okonomiOversikt .okonomi-tabell th:nth-child(4),
    #okonomiOversikt .okonomi-tabell td:nth-child(4) { width: 118px; max-width: 118px; }
    #okonomiOversikt .okonomi-tabell th:nth-child(5),
    #okonomiOversikt .okonomi-tabell td:nth-child(5) { width: 48px; max-width: 48px; text-align: right; }
    #okonomiOversikt .okonomi-tabell th:nth-child(6),
    #okonomiOversikt .okonomi-tabell td:nth-child(6) { width: 70px; max-width: 70px; text-align: right; }
    #okonomiOversikt .okonomi-tabell th:nth-child(7),
    #okonomiOversikt .okonomi-tabell td:nth-child(7) {
      width: 182px;
      max-width: 182px;
      overflow: visible;
      text-overflow: clip;
      white-space: nowrap;
      text-align: left;
    }

    /* Utlegg-tabellen har 7 kolonner, men kolonne 5 er Beskr. og kolonne 6 er Beløp. */
    #okonomiOversikt .okonomi-tabell th:nth-child(5):not(:last-child),
    #okonomiOversikt .okonomi-tabell td:nth-child(5):not(:last-child) { max-width: 80px; }

    #okonomiOversikt .okonomi-mini-knapp {
      font-size: 10px !important;
      line-height: 1 !important;
      padding: 3px 5px !important;
      margin: 0 !important;
      min-height: 24px !important;
      border-radius: 5px !important;
      white-space: nowrap !important;
      min-width: 38px !important;
      border: 0 !important;
      color: #fff !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      box-shadow: none !important;
    }
    #okonomiOversikt .okonomi-mini-knapp.okonomi-vis { background:#6610f2 !important; }
    #okonomiOversikt .okonomi-mini-knapp.okonomi-fakt { background:#0d6efd !important; }
    #okonomiOversikt .okonomi-mini-knapp.okonomi-kopi { background:#6c757d !important; }
    #okonomiOversikt .okonomi-mini-knapp.okonomi-bet { background:#198754 !important; }
    #okonomiOversikt .okonomi-mini-knapp.okonomi-purr { background:#fd7e14 !important; color:#fff !important; }
    #okonomiOversikt .okonomi-mini-knapp.okonomi-kred { background:#dc3545 !important; }
    #okonomiOversikt .okonomi-mini-knapp:hover { filter: brightness(1.08); }
    #okonomiOversikt .okonomi-handlinger {
      display: inline-flex;
      gap: 3px;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: flex-start;
      width: 176px;
      max-width: 176px;
      overflow: visible;
    }
    #okonomiOversikt .okonomi-status-merke {
      display: inline-block;
      padding: 1px 3px;
      border-radius: 999px;
      color: white;
      font-size: 7.5px;
      line-height: 1.05;
      white-space: nowrap;
    }
    #okonomiOversikt .okonomi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
      gap: 5px;
      margin: 7px 0;
    }
    #okonomiOversikt .okonomi-boks {
      font-size: 11px;
      padding: 6px;
      border: 1px solid rgba(128,128,128,.25);
      border-radius: 8px;
    }
    #okonomiOversikt .okonomi-boks strong { display: block; font-size: 12px; margin-top: 2px; }
    #okonomiOversikt .okonomi-mini-knapp.okonomi-varsling {
      opacity: 1 !important;
      cursor: pointer !important;
      color:#fff !important;
      outline: 1px solid rgba(255,255,255,.25);
    }
    #okonomiOversikt .okonomi-detalj {
      border: 1px solid rgba(128,128,128,.25);
      border-radius: 8px;
      padding: 8px;
      margin: 8px 0;
      font-size: 12px;
      background: rgba(128,128,128,.06);
    }
    @media (max-width: 700px) {
      #okonomiOversikt { font-size: 12px; }
      #okonomiOversikt table.okonomi-tabell { width: max-content; max-width: 100%; font-size: 12px; }
      #okonomiOversikt .okonomi-tabell th,
      #okonomiOversikt .okonomi-tabell td { padding: 1px 3px; }
      #okonomiOversikt .okonomi-tabell th:nth-child(1),
      #okonomiOversikt .okonomi-tabell td:nth-child(1) { width: 50px; max-width: 50px; }
      #okonomiOversikt .okonomi-tabell th:nth-child(2),
      #okonomiOversikt .okonomi-tabell td:nth-child(2) { width: 76px; max-width: 76px; }
      #okonomiOversikt .okonomi-tabell th:nth-child(3),
      #okonomiOversikt .okonomi-tabell td:nth-child(3) { width: 52px; max-width: 52px; }
      #okonomiOversikt .okonomi-tabell th:nth-child(4),
      #okonomiOversikt .okonomi-tabell td:nth-child(4) { width: 100px; max-width: 100px; }
      #okonomiOversikt .okonomi-tabell th:nth-child(5),
      #okonomiOversikt .okonomi-tabell td:nth-child(5) { width: 38px; max-width: 38px; }
      #okonomiOversikt .okonomi-tabell th:nth-child(6),
      #okonomiOversikt .okonomi-tabell td:nth-child(6) { width: 62px; max-width: 62px; }
      #okonomiOversikt .okonomi-tabell th:nth-child(7),
      #okonomiOversikt .okonomi-tabell td:nth-child(7) { width: 176px; max-width: 176px; }
      #okonomiOversikt .okonomi-mini-knapp { font-size: 9.5px !important; padding: 3px 4px !important; min-height: 23px !important; min-width: 36px !important; }
      #okonomiOversikt .okonomi-handlinger { width: 172px; max-width: 172px; gap: 3px; }
      #okonomiOversikt .okonomi-status-merke { font-size: 7px; padding: 1px 3px; }
    }
  `;
  document.head.appendChild(style);
})();


function okonomiBelop(verdi) {
  const tall = Number(verdi || 0);
  return tall.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function okonomiDato(verdi) {
  if (!verdi) return "";
  return String(verdi).slice(0, 10);
}

function okonomiTryggTekst(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function okonomiKortTekst(verdi, maks = 14) {
  const tekst = String(verdi ?? "").trim();
  if (!tekst) return "";
  return tekst.length > maks ? tekst.slice(0, Math.max(1, maks - 1)) + "…" : tekst;
}

function okonomiTryggJs(verdi) {
  return String(verdi ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ");
}

function okonomiVisStatus(rad) {
  const status = String(rad?.status || rad?.betalingsstatus || "").toLowerCase();
  const inkl = Number(rad?.inkl_mva || rad?.total || 0);
  const betalt = Number(rad?.betalt_belop || 0);

  if (status === "betalt" || (inkl > 0 && betalt >= inkl)) return "Betalt";
  if (status === "purret" || status === "purring") return "Purret";
  if (status === "kreditert" || status === "kreditnota") return "Kreditert";

  if (
    rad?.fakturert === true ||
    String(rad?.fakturert || "").toLowerCase() === "true" ||
    String(rad?.fakturert || "").toLowerCase() === "ja" ||
    rad?.fakturanr ||
    rad?.faktura_id ||
    rad?.fakturert_dato
  ) {
    return "Fakturert / ikke betalt";
  }

  return "Ikke fakturert";
}

function okonomiStatusMerke(rad) {
  const status = okonomiVisStatus(rad);
  let bg = "#374151";
  if (status === "Betalt") bg = "#166534";
  if (status === "Fakturert / ikke betalt") bg = "#92400e";
  if (status === "Ikke fakturert") bg = "#7f1d1d";
  if (status === "Purret") bg = "#b45309";
  if (status === "Kreditert") bg = "#4b5563";

  return `<span class="okonomi-status-merke" style="background:${bg};">${okonomiTryggTekst(status)}</span>`;
}

function okonomiInaktivKnapp(tekst, melding) {
  const t = String(tekst || "").toLowerCase();
  let fargeKlasse = "okonomi-kopi";
  if (t.includes("fakt")) fargeKlasse = "okonomi-fakt";
  if (t.includes("purr")) fargeKlasse = "okonomi-purr";
  if (t.includes("bet")) fargeKlasse = "okonomi-bet";
  if (t.includes("kred")) fargeKlasse = "okonomi-kred";

  // Knappen skal fortsatt være klikkbar og farget, men vise forklaring når handlingen ikke er tilgjengelig.
  return `<button type="button" class="secondary okonomi-mini-knapp ${fargeKlasse} okonomi-varsling" onclick="event.stopPropagation(); alert('${okonomiTryggJs(melding)}')">${okonomiTryggTekst(tekst)}</button>`;
}

function okonomiBetaltKnapp(f) {
  const status = okonomiVisStatus(f);
  if (status === "Betalt" || status === "Kreditert") return "✓";

  const fakturanr = okonomiHarFakturanr(f);
  if (!fakturanr) return okonomiInaktivKnapp("Bet.", "Linjen må faktureres før den kan settes betalt.");

  return `<button type="button"
    class="secondary okonomi-mini-knapp okonomi-bet"
    onclick="event.stopPropagation(); okonomiSettBetalt('${okonomiTryggJs(fakturanr)}', ${Number(f?.inkl_mva || f?.total || 0)})">
    Bet.
  </button>`;
}


function okonomiPurringKnapp(f) {
  const status = okonomiVisStatus(f);
  if (status === "Betalt" || status === "Kreditert") return okonomiInaktivKnapp("Purr", "Betalte/krediterte linjer kan ikke purres.");
  const fakturanr = okonomiHarFakturanr(f);
  if (!fakturanr) return okonomiInaktivKnapp("Purr", "Linjen må faktureres før den kan purres.");
  return `<button type="button"
    class="secondary okonomi-mini-knapp okonomi-purr"
    onclick="event.stopPropagation(); lagPurringFraOkonomi('${okonomiTryggJs(fakturanr)}')">
    Purr
  </button>`;
}


function okonomiRadKundeId(rad) {
  return String(rad?.kunde_id || rad?.kunden_id || rad?.kundeId || "");
}

function okonomiHarFakturanr(rad) {
  return String(rad?.fakturanr || rad?.faktura_nr || rad?.fakturanummer || "").trim();
}

function okonomiKopiKnapp(f) {
  const fakturanr = okonomiHarFakturanr(f);
  if (!fakturanr) return okonomiInaktivKnapp("Kopi", "Kopi kan bare lages etter fakturering.");
  return `<button type="button" class="secondary okonomi-mini-knapp okonomi-kopi" onclick="event.stopPropagation(); okonomiLagKopi('${okonomiTryggJs(fakturanr)}')">Kopi</button>`;
}

function okonomiKreditnotaKnapp(f) {
  const status = okonomiVisStatus(f);
  const fakturanr = okonomiHarFakturanr(f);
  if (status === "Kreditert") return okonomiInaktivKnapp("Kred.", "Fakturaen er allerede kreditert.");
  if (!fakturanr) return okonomiInaktivKnapp("Kred.", "Linjen må faktureres før kreditnota kan lages.");
  return `<button type="button" class="secondary okonomi-mini-knapp okonomi-kred" onclick="event.stopPropagation(); okonomiLagKreditnota('${okonomiTryggJs(fakturanr)}')">Kred.</button>`;
}

function okonomiVisKnapp(type, indeks, rad) {
  return `<button type="button" class="secondary okonomi-mini-knapp okonomi-vis" data-okonomi-vis="1" data-okonomi-type="${okonomiTryggTekst(type)}" data-okonomi-indeks="${Number(indeks)}" onclick="event.stopPropagation(); okonomiVisFakturaFraRad('${okonomiTryggJs(type)}', ${Number(indeks)})">Vis</button>`;
}

function okonomiFakturerKnapp(type, indeks, rad) {
  const status = okonomiVisStatus(rad);
  if (status !== "Ikke fakturert") {
    const fakturanr = okonomiHarFakturanr(rad);
    return fakturanr ? okonomiKopiKnapp(rad) : "";
  }
  return `<button type="button" class="secondary okonomi-mini-knapp okonomi-fakt" onclick="event.stopPropagation(); okonomiFakturerRad('${okonomiTryggJs(type)}', ${Number(indeks)})">Fakt.</button>`;
}

function okonomiHandlingerHtml(type, rad, indeks) {
  const fakturanr = okonomiHarFakturanr(rad);
  const status = okonomiVisStatus(rad);
  const deler = [];
  deler.push(okonomiVisKnapp(type, indeks, rad));

  if (status === "Ikke fakturert") {
    // Alle knapper vises kompakt. Bare Fakt. er aktiv før fakturering.
    deler.push(okonomiFakturerKnapp(type, indeks, rad));
    deler.push(okonomiPurringKnapp(rad));
    deler.push(okonomiBetaltKnapp(rad));
    deler.push(okonomiKreditnotaKnapp(rad));
  } else {
    // Etter fakturering skal Fakturer ikke kunne kjøres igjen. Kopi erstatter Fakt.
    deler.push(okonomiKopiKnapp(rad));
    deler.push(okonomiPurringKnapp(rad));
    deler.push(okonomiBetaltKnapp(rad));
    deler.push(okonomiKreditnotaKnapp(rad));
  }

  return `<div class="okonomi-handlinger">${deler.filter(Boolean).join("")}</div>`;
}

async function okonomiFakturerRad(type, indeks) {
  const data = window.__okonomiKlikkData || {};
  const rad = data[type]?.[Number(indeks)];
  if (!rad) {
    alert("Fant ikke raden som skal faktureres.");
    return;
  }

  if (type === "Samlet" || rad._okonomiSamlet) {
    await okonomiFakturerSamletGruppe(rad);
    return;
  }

  alert("Bruk samlet-linjen for kunde/prosjekt. Timer, varer og utlegg skal faktureres samlet, ikke enkeltvis.");
}

async function okonomiLagKopi(fakturanr) {
  fakturanr = String(fakturanr || "").trim();
  if (!fakturanr) {
    alert("Mangler fakturanr for kopi.");
    return;
  }

  // Ny robust vei: brukes av økonomioversikten. Den virker selv om timer ikke har fakturanr,
  // fordi databasen din kobler timer via faktura_id og varer/utlegg via fakturanr.
  if (typeof window.lagFakturaKopiFraOkonomi === "function") {
    await window.lagFakturaKopiFraOkonomi(fakturanr);
    return;
  }

  const select = document.getElementById("fakturaKopiValg") || document.getElementById("fakturaKopiFakturaValg");
  if (typeof window.fyllFakturaKopiValg === "function") {
    await window.fyllFakturaKopiValg();
  }
  if (select) select.value = fakturanr;
  if (typeof window.lagFakturaKopiPdf === "function") {
    await window.lagFakturaKopiPdf();
  } else {
    alert("Fant ikke funksjonen for fakturakopi.");
  }
}

async function okonomiLagKreditnota(fakturanr) {
  if (!fakturanr) return;
  if (!confirm("Lage kreditnota for faktura " + fakturanr + "?")) return;
  if (typeof window.fyllKreditnotaFakturaValg === "function") window.fyllKreditnotaFakturaValg();
  const select = document.getElementById("kreditnotaFakturaValg");
  if (select) select.value = fakturanr;
  if (typeof window.lagKreditnotaPdf === "function") {
    await window.lagKreditnotaPdf();
    if (typeof visOkonomiOversikt === "function") await visOkonomiOversikt();
  } else {
    alert("Fant ikke kreditnotafunksjonen.");
  }
}

async function okonomiSettBetalt(fakturanr, belop) {
  if (!fakturanr) {
    alert("Mangler fakturanr.");
    return;
  }

  if (!confirm("Sette faktura " + fakturanr + " som betalt?")) return;

  const dato = new Date().toISOString().slice(0, 10);

  let res = await supabaseClient
    .from("hand_faktura")
    .update({
      betalingsstatus: "betalt",
      status: "betalt",
      betalt_belop: Number(belop || 0),
      betalt_dato: dato
    })
    .eq("fakturanr", fakturanr);

  if (res.error) {
    res = await supabaseClient
      .from("hand_faktura")
      .update({
        betalt_belop: Number(belop || 0),
        betalt_dato: dato
      })
      .eq("fakturanr", fakturanr);
  }

  if (res.error) {
    alert("Kunne ikke sette betalt: " + res.error.message);
    return;
  }

  await visOkonomiOversikt();
}

function okonomiKundeNavn(kundeId, fallback) {
  const kunde = (window.kunder || []).find(k =>
    String(k.id || "") === String(kundeId || "")
  );

  return kunde?.navn || fallback || "";
}

function okonomiErInnenDato(rad, fraDato, tilDato) {
  const dato = okonomiDato(rad.dato || rad.created_at || rad.fakturert_dato);
  if (!dato) return true;

  if (fraDato && dato < fraDato) return false;
  if (tilDato && dato > tilDato) return false;

  return true;
}

function okonomiErSammeKunde(rad, kundeId) {
  if (!kundeId) return true;

  return (
    String(rad.kunde_id || rad.kunden_id || "") === String(kundeId) ||
    String(rad.kundeId || "") === String(kundeId)
  );
}

function okonomiTimerEksMva(time) {
  if (time.sum !== undefined && time.sum !== null && Number(time.sum) > 0) {
    return Number(time.sum || 0);
  }

  return Number(time.timer || 0) * Number(time.timepris || 0);
}

function okonomiErIkkeFakturertTimer(time) {
  if (time.fakturerbar === false) return false;
  if (String(time.fakturerbar || "").toLowerCase() === "nei") return false;
  if (time.fakturert === true) return false;
  if (time.fakturanr || time.faktura_id || time.fakturert_dato) return false;

  return true;
}


function okonomiProsjektId(rad) {
  return String(rad?.prosjekt_id || rad?.prosjektId || "utenprosjekt");
}

function okonomiGruppeKey(kundeId, prosjektId) {
  return String(kundeId || "utenkunde") + "__" + String(prosjektId || "utenprosjekt");
}

function okonomiRadDato(rad) {
  return okonomiDato(rad?.dato || rad?.created_at || rad?.opprettet || rad?.fakturert_dato);
}

function okonomiVareEksMva(v) {
  return Number(v?.antall || 1) * Number(v?.pris || 0);
}

function okonomiUtleggEksMva(u) {
  return Number(u?.belop || u?.sum || u?.total || 0);
}

function okonomiFinnTimeForUtlegg(utlegg, timerListe) {
  const timerId = String(utlegg?.timer_id || utlegg?.time_id || utlegg?.hand_time_id || "").trim();
  if (!timerId) return null;
  return (timerListe || []).find(t => String(t?.id || "").trim() === timerId) || null;
}

function okonomiLeggTilUnikTime(gruppe, time) {
  if (!gruppe || !time) return;
  const id = String(time.id || "").trim();
  if (id && gruppe.timer.some(t => String(t.id || "").trim() === id)) return;
  gruppe.timer.push(time);
}

function okonomiLagSamledeFakturaGrupper(timerListe, varerListe, utleggListe) {
  const grupper = {};

  function hentGruppe(kundeId, prosjektId) {
    const key = okonomiGruppeKey(kundeId, prosjektId);
    if (!grupper[key]) {
      grupper[key] = {
        _okonomiSamlet: true,
        key,
        kunde_id: kundeId || "",
        prosjekt_id: prosjektId || "utenprosjekt",
        timer: [],
        varer: [],
        utlegg: [],
        eks_mva: 0,
        mva: 0,
        inkl_mva: 0,
        fakturert: false,
        status: "Ikke fakturert"
      };
    }
    return grupper[key];
  }

  (timerListe || []).forEach(t => {
    const kundeId = okonomiRadKundeId(t);
    const prosjektId = okonomiProsjektId(t);
    const g = hentGruppe(kundeId, prosjektId);
    g.timer.push(t);
    g.eks_mva += okonomiTimerEksMva(t);
    if (!g.dato || okonomiRadDato(t) < g.dato) g.dato = okonomiRadDato(t);
    if (!g.beskrivelse && (t.beskrivelse || t.kommentar)) g.beskrivelse = t.beskrivelse || t.kommentar;
  });

  (varerListe || []).forEach(v => {
    const kundeId = okonomiRadKundeId(v);
    const prosjektId = okonomiProsjektId(v);
    const g = hentGruppe(kundeId, prosjektId);
    g.varer.push(v);
    g.eks_mva += okonomiVareEksMva(v);
    if (!g.dato || okonomiRadDato(v) < g.dato) g.dato = okonomiRadDato(v);
    if (!g.beskrivelse && (v.navn || v.beskrivelse)) g.beskrivelse = v.navn || v.beskrivelse;
  });

  (utleggListe || []).forEach(u => {
    // Utlegg er ofte koblet til en time via hand_faktura_utlegg.timer_id.
    // Da må utlegget følge samme kunde/prosjekt som timen, ellers blir det egen faktura med bare utlegg.
    const kobletTime = okonomiFinnTimeForUtlegg(u, timerListe);
    const kundeId = okonomiRadKundeId(kobletTime || u);
    const prosjektId = okonomiProsjektId(kobletTime || u);
    const g = hentGruppe(kundeId, prosjektId);
    if (kobletTime) okonomiLeggTilUnikTime(g, kobletTime);
    g.utlegg.push(u);
    g.eks_mva += okonomiUtleggEksMva(u);
    if (!g.dato || okonomiRadDato(u) < g.dato) g.dato = okonomiRadDato(u);
    if (!g.beskrivelse && (u.beskrivelse || u.type || u.utgift_type)) g.beskrivelse = u.beskrivelse || u.type || u.utgift_type;
  });

  return Object.values(grupper)
    .filter(g => g.eks_mva > 0 || g.timer.length || g.varer.length || g.utlegg.length)
    .map(g => {
      g.mva = g.eks_mva * 0.25;
      g.inkl_mva = g.eks_mva + g.mva;
      g.antall_timer = g.timer.length;
      g.antall_varer = g.varer.length;
      g.antall_utlegg = g.utlegg.length;
      g.linjer = g.antall_timer + g.antall_varer + g.antall_utlegg;
      return g;
    })
    .sort((a, b) => String(a.dato || "").localeCompare(String(b.dato || "")) || String(a.kunde_id).localeCompare(String(b.kunde_id)));
}

function okonomiProsjektTekst(rad) {
  const prosjektId = okonomiProsjektId(rad);
  if (!prosjektId || prosjektId === "utenprosjekt") return "Uten prosjekt";
  const prosjekter = window.prosjekter || window.alleProsjekter || [];
  const p = (prosjekter || []).find(x => String(x.id || "") === String(prosjektId));
  return p?.navn || p?.tittel || prosjektId;
}

async function okonomiFakturerSamletGruppe(gruppe) {
  if (!gruppe || !gruppe._okonomiSamlet) {
    alert("Fant ikke samlet kunde/prosjekt-gruppe.");
    return;
  }

  const kundeId = String(gruppe.kunde_id || "");
  if (!kundeId || kundeId === "utenkunde") {
    alert("Fant ikke kunde på samlet linje.");
    return;
  }

  const prosjektTekst = okonomiProsjektTekst(gruppe);
  const kundeTekst = okonomiKundeNavn(kundeId, "kunde " + kundeId);

  if (!confirm("Fakturere samlet linje for " + kundeTekst + " / " + prosjektTekst + "? Timer, varer og utlegg på samme kunde og prosjekt legges på samme faktura.")) return;

  // Åpne vinduet med en gang mens vi fortsatt er inne i klikket.
  // Da blir ikke forhåndsvisningen blokkert av nettleserens popup-sperre etter await/lagring.
  const fakturaVindu = window.open("", "_blank");
  if (fakturaVindu) {
    fakturaVindu.document.write("<p style='font-family:Arial;padding:20px'>Lager faktura...</p>");
    fakturaVindu.document.close();
  }

  const fakturaDato = new Date();
  const fakturanr = "F-" + fakturaDato.toISOString().slice(0, 10).replaceAll("-", "") + "-" + Math.floor(Math.random() * 9000 + 1000);
  const eksMva = Number(gruppe.eks_mva || 0);
  const mva = eksMva * 0.25;
  const inklMva = eksMva + mva;
  const firmaId =
    (gruppe.timer.find(x => x.firma_id)?.firma_id) ||
    (gruppe.varer.find(x => x.firma_id)?.firma_id) ||
    (gruppe.utlegg.find(x => x.firma_id)?.firma_id) ||
    window.firma?.id ||
    null;

  const fakturaInsert = {
    kunden_id: String(kundeId),
    fakturanr,
    dato: fakturaDato.toISOString(),
    forfallsdato: new Date(fakturaDato.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: "Sendt",
    eks_mva: eksMva,
    mva,
    inkl_mva: inklMva
  };
  if (firmaId) fakturaInsert.firma_id = firmaId;

  const { data: fakturaData, error: fakturaError } = await supabaseClient
    .from("hand_faktura")
    .insert(fakturaInsert)
    .select("id,fakturanr")
    .single();

  if (fakturaError) {
    alert("Kunne ikke opprette faktura: " + fakturaError.message);
    return;
  }

  const fakturaId = fakturaData?.id || null;

  const timerIds = Array.from(new Set([
    ...gruppe.timer.map(t => t.id),
    ...gruppe.utlegg.map(u => u.timer_id || u.time_id || u.hand_time_id)
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== "")));
  const vareIds = gruppe.varer.map(v => v.id).filter(v => v !== undefined && v !== null);
  const utleggIds = gruppe.utlegg.map(u => u.id).filter(v => v !== undefined && v !== null);

  if (timerIds.length) {
    // hand_time har faktura_id (uuid), men ikke fakturanr/fakturert/fakturerbar/fakturert_at.
    // Oppdater derfor bare felt som faktisk finnes, ellers feiler hele UPDATE og timene kobles ikke til fakturaen.
    const { error } = await supabaseClient
      .from("hand_time")
      .update({ faktura_id: fakturaId })
      .in("id", timerIds);
    if (error) alert("Faktura ble laget, men timer ble ikke koblet til fakturaen: " + error.message);
  }

  if (vareIds.length) {
    const { error } = await supabaseClient
      .from("hand_faktura_vare")
      .update({ fakturert: true, fakturanr })
      .in("id", vareIds);
    if (error) alert("Faktura ble laget, men varer ble ikke oppdatert: " + error.message);
  }

  if (utleggIds.length) {
    const { error } = await supabaseClient
      .from("hand_faktura_utlegg")
      .update({ fakturert: true, fakturanr })
      .in("id", utleggIds);
    if (error) alert("Faktura ble laget, men utlegg ble ikke oppdatert: " + error.message);
  }

  // Oppdater radene i minnet med samme kobling som databasen.
  // Dette gjør at PDF-en som vises rett etter fakturering ALLTID får med timer,
  // også hvis Supabase ikke rekker/kan lese dem tilbake via faktura_id med en gang.
  (gruppe.timer || []).forEach(t => {
    t.faktura_id = fakturaId;
    t.fakturanr = fakturanr;
  });
  (window.timer || []).forEach(t => {
    if (timerIds.map(String).includes(String(t.id))) {
      t.faktura_id = fakturaId;
      t.fakturanr = fakturanr;
    }
  });

  // Lagre en lokal faktura-snapshot i nettleseren. Det er en nødløsning for visning,
  // fordi hand_time bare har faktura_id, mens varer/utlegg har fakturanr.
  // Da kan Vis fakturert fortsatt vise nøyaktig timer+varer+utlegg selv om DB-oppslaget
  // på timer ikke returnerer rader.
  try {
    const snap = {
      fakturanr,
      faktura_id: fakturaId,
      kunde_id: kundeId,
      dato: fakturaDato.toISOString(),
      timer: gruppe.timer || [],
      varer: gruppe.varer || [],
      utlegg: gruppe.utlegg || []
    };
    localStorage.setItem("hand_faktura_snapshot_" + fakturanr, JSON.stringify(snap));
  } catch (e) {
    console.warn("Kunne ikke lagre lokal faktura-snapshot:", e);
  }

  // Vis fakturaen fra de faktiske radene som akkurat ble fakturert.
  // Ikke hent den på nytt først, for der er feilen som gjorde at timer forsvant.
  try {
    const kunde = (window.kunder || []).find(k => String(k.id || "") === String(kundeId)) || { id: kundeId, navn: kundeTekst };
    const firma = typeof hentFirmaData === "function" ? await hentFirmaData() : (window.firma || {});
    const maaned = String(gruppe.dato || gruppe.timer?.[0]?.dato || gruppe.varer?.[0]?.created_at || gruppe.utlegg?.[0]?.created_at || fakturaDato.toISOString()).slice(0, 7);

    if (typeof lagEnFakturaPdf === "function") {
      const pdf = await lagEnFakturaPdf(
        kunde,
        gruppe.timer || [],
        maaned,
        firma,
        true,
        fakturanr,
        gruppe.varer || [],
        gruppe.utlegg || [],
        { returnDoc: true }
      );

      if (pdf && pdf.doc) {
        const dataUri = pdf.doc.output("datauristring");
        const html = '<iframe style="border:0;width:100%;height:100vh" src="' + dataUri + '"></iframe>';
        if (fakturaVindu && !fakturaVindu.closed) {
          fakturaVindu.document.open();
          fakturaVindu.document.write(html);
          fakturaVindu.document.close();
        } else {
          const nyttVindu = window.open("", "_blank");
          if (nyttVindu) {
            nyttVindu.document.write(html);
            nyttVindu.document.close();
          }
        }
      } else if (fakturaVindu && !fakturaVindu.closed) {
        fakturaVindu.document.body.innerHTML = "<p>Samlet faktura opprettet: " + fakturanr + ", men PDF kunne ikke bygges.</p>";
      }
    } else if (fakturaVindu && !fakturaVindu.closed) {
      fakturaVindu.document.body.innerHTML = "<p>Samlet faktura opprettet: " + fakturanr + ", men PDF-funksjonen mangler.</p>";
    }
  } catch (e) {
    console.error("Kunne ikke vise opprettet faktura:", e);
    if (fakturaVindu && !fakturaVindu.closed) {
      fakturaVindu.document.body.innerHTML = "<p>Samlet faktura opprettet: " + fakturanr + ", men visning feilet: " + (e.message || e) + "</p>";
    } else {
      alert("Samlet faktura opprettet: " + fakturanr + ", men visning feilet: " + (e.message || e));
    }
  }

  if (typeof visOkonomiOversikt === "function") await visOkonomiOversikt();
}

function fyllOkonomiKundeValg() {
  const valg = document.getElementById("okonomiKundeValg");
  const fakturaValg = document.getElementById("fakturaKundeValg");

  const kunder = window.kunder || [];

  [valg, fakturaValg].forEach(select => {
    if (!select) return;

    const valgt = select.value || "";
    const startTekst = select.id === "okonomiKundeValg" ? "Alle kunder" : "Velg kunde";

    select.innerHTML = `<option value="">${startTekst}</option>`;

    kunder.forEach(kunde => {
      const option = document.createElement("option");
      option.value = kunde.id;
      option.textContent = `${kunde.kundenr || kunde.id || ""} ${kunde.navn || ""}`.trim();
      select.appendChild(option);
    });

    if (valgt) select.value = valgt;
  });
}

async function okonomiHentTabell(tabellnavn) {
  try {
    const { data, error } = await supabaseClient
      .from(tabellnavn)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Kunne ikke hente " + tabellnavn + ":", error.message);
      return [];
    }

    return data || [];
  } catch (e) {
    console.warn("Kunne ikke hente " + tabellnavn + ":", e);
    return [];
  }
}

function okonomiDetaljHtml(type, rad, indeks) {
  const kunde = okonomiKundeNavn(rad.kunde_id || rad.kunden_id, rad.kunde_navn || "");
  const status = okonomiVisStatus(rad);
  const fakturanr = okonomiHarFakturanr(rad);
  const dato = okonomiDato(rad.dato || rad.created_at || rad.fakturert_dato);
  const prosjekt = type === "Samlet" ? okonomiProsjektTekst(rad) : (rad.prosjekt_id ? okonomiProsjektTekst(rad) : "");
  const tekst = rad.beskrivelse || rad.kommentar || rad.type || rad.utgift_type || rad.navn || "";
  const belop = rad.inkl_mva || rad.total || rad.eks_mva || rad.sum || rad.belop || (Number(rad.antall || 1) * Number(rad.pris || 0));

  const knapper = [];
  if (fakturanr) {
    knapper.push(`<button type="button" class="secondary okonomi-mini-knapp okonomi-kopi" onclick="event.stopPropagation(); okonomiLagKopi('${okonomiTryggJs(fakturanr)}')">Kopi av faktura</button>`);
  }
  if (status === "Ikke fakturert") {
    knapper.push(`<button type="button" class="secondary okonomi-mini-knapp okonomi-fakt" onclick="event.stopPropagation(); okonomiFakturerRad('${okonomiTryggJs(type)}', ${Number(indeks)})">Fakturer</button>`);
  }
  knapper.push(`<button type="button" class="secondary okonomi-mini-knapp okonomi-kred" onclick="event.stopPropagation(); okonomiLukkDetalj()">Lukk</button>`);

  const linjeinfo = type === "Samlet"
    ? `<div>Innhold: ${Number(rad.antall_timer || 0)} timer / ${Number(rad.antall_varer || 0)} varer / ${Number(rad.antall_utlegg || 0)} utlegg</div>`
    : "";

  return `
    <div class="okonomi-detalj">
      <strong>${okonomiTryggTekst(type === "Samlet" ? "Samlet faktura" : type)}</strong>
      <div>Dato: ${okonomiTryggTekst(dato)}</div>
      <div>Kunde: ${okonomiTryggTekst(kunde)}</div>
      ${prosjekt ? `<div>Prosjekt: ${okonomiTryggTekst(prosjekt)}</div>` : ""}
      <div>Status: ${okonomiStatusMerke(rad)}</div>
      ${fakturanr ? `<div>Fakturanr: ${okonomiTryggTekst(fakturanr)}</div>` : ""}
      ${linjeinfo}
      <div>Beløp: ${okonomiBelop(belop)} kr</div>
      ${tekst ? `<p>${okonomiTryggTekst(tekst)}</p>` : ""}
      <div class="okonomi-handlinger">${knapper.join("")}</div>
    </div>
  `;
}

async function okonomiVisFakturaFraRad(type, indeks) {
  const data = window.__okonomiKlikkData || {};
  const rad = data[type]?.[Number(indeks)];
  if (!rad) {
    alert("Fant ikke raden som skal vises.");
    return;
  }

  // Fakturerte rader skal vise kopi av faktura direkte.
  const fakturanr = okonomiHarFakturanr(rad);
  if (fakturanr) {
    await okonomiLagKopi(fakturanr);
    return;
  }

  // Ikke-fakturerte samlelinjer skal også vise selve fakturaen som forhåndsvisning,
  // uten å merke linjene som fakturert.
  if ((type === "Samlet" || rad._okonomiSamlet) && typeof window.visIkkeFakturertFakturaFraOkonomi === "function") {
    await window.visIkkeFakturertFakturaFraOkonomi(rad);
    return;
  }

  okonomiVisDetalj(type, Number(indeks));
}

function okonomiLukkDetalj() {
  const detalj = document.getElementById("okonomiDetalj");
  if (detalj) detalj.innerHTML = "";
}

function okonomiKobleRadklikk() {
  const container = document.getElementById("okonomiOversikt");
  if (!container || container.dataset.okonomiDelegertKlikk === "1") return;
  container.dataset.okonomiDelegertKlikk = "1";

  container.addEventListener("click", async function(event) {
    const visKnapp = event.target && event.target.closest ? event.target.closest("[data-okonomi-vis]") : null;
    if (visKnapp) {
      event.preventDefault();
      event.stopPropagation();
      await okonomiVisFakturaFraRad(visKnapp.dataset.okonomiType || "", visKnapp.dataset.okonomiIndeks || "0");
      return;
    }

    if (event.target && event.target.closest && event.target.closest("button, select, input, textarea, a")) {
      return;
    }

    const rad = event.target && event.target.closest ? event.target.closest("[data-okonomi-type][data-okonomi-indeks]") : null;
    if (!rad || !container.contains(rad)) return;
    await okonomiVisFakturaFraRad(rad.dataset.okonomiType || "", rad.dataset.okonomiIndeks || "0");
  });

  container.addEventListener("keydown", async function(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const rad = event.target && event.target.closest ? event.target.closest("[data-okonomi-type][data-okonomi-indeks]") : null;
    if (!rad || !container.contains(rad)) return;
    event.preventDefault();
    await okonomiVisFakturaFraRad(rad.dataset.okonomiType || "", rad.dataset.okonomiIndeks || "0");
  });

  container.querySelectorAll("[data-okonomi-type][data-okonomi-indeks]").forEach(rad => {
    rad.style.cursor = "pointer";
    rad.setAttribute("tabindex", "0");
  });
}

function okonomiVisDetalj(type, indeks) {
  const data = window.__okonomiKlikkData || {};
  const rad = data[type]?.[Number(indeks)];
  if (!rad) return;

  let detalj = document.getElementById("okonomiDetalj");
  const container = document.getElementById("okonomiOversikt");

  if (!detalj && container) {
    detalj = document.createElement("div");
    detalj.id = "okonomiDetalj";
    container.prepend(detalj);
  }

  if (detalj) {
    detalj.innerHTML = okonomiDetaljHtml(type, rad, Number(indeks));
    detalj.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function okonomiKolonneInnhold(k, rad, indeks) {
  return k.html ? k.html(rad, indeks) : okonomiTryggTekst(k.verdi(rad));
}

function okonomiFinnKolonne(kolonner, navn) {
  const sok = String(navn || "").toLowerCase();
  return kolonner.find(k => String(k.tittel || "").toLowerCase() === sok)
    || kolonner.find(k => String(k.tittel || "").toLowerCase().includes(sok));
}

function okonomiFinnForsteKolonne(kolonner, navnListe) {
  for (const navn of navnListe) {
    const k = okonomiFinnKolonne(kolonner, navn);
    if (k) return k;
  }
  return null;
}

function okonomiLagKompaktRad(tittel, rad, indeks, kolonner, klikkType) {
  const datoK = okonomiFinnForsteKolonne(kolonner, ["Dato"]);
  const kundeK = okonomiFinnForsteKolonne(kolonner, ["Kunde"]);
  const statusK = okonomiFinnForsteKolonne(kolonner, ["Status"]);
  const valgK = okonomiFinnForsteKolonne(kolonner, ["Valg", "Handlinger"]);
  const belopK = okonomiFinnForsteKolonne(kolonner, ["Inkl", "Eks", "Beløp"]);
  const tekstK = okonomiFinnForsteKolonne(kolonner, ["Vare", "Beskr.", "Beskrivelse", "Type", "Fakturanr"]);
  const ekstraK = okonomiFinnForsteKolonne(kolonner, ["Timer", "Antall", "Forfall"]);

  const dato = datoK ? okonomiKolonneInnhold(datoK, rad, indeks) : "";
  const kunde = kundeK ? okonomiKolonneInnhold(kundeK, rad, indeks) : "";
  const status = statusK ? okonomiKolonneInnhold(statusK, rad, indeks) : "";
  const belop = belopK ? okonomiKolonneInnhold(belopK, rad, indeks) : "";
  const tekst = tekstK ? okonomiKolonneInnhold(tekstK, rad, indeks) : "";
  const ekstra = ekstraK ? okonomiKolonneInnhold(ekstraK, rad, indeks) : "";
  const valg = valgK ? okonomiKolonneInnhold(valgK, rad, indeks) : "";

  const klikk = klikkType
    ? ` onclick="okonomiVisFakturaFraRad('${okonomiTryggJs(klikkType)}', ${indeks})" title="${klikkType === "Faktura" ? "Klikk for å vise faktura" : "Klikk for detaljer"}"`
    : "";

  return `
    <div class="okonomi-kort klikkbar-okonomi"${klikk}>
      <div class="okonomi-kort-topp">
        <span class="okonomi-kort-dato">${dato}</span>
        <span class="okonomi-kort-belop">${belop}</span>
      </div>
      <div class="okonomi-kort-linje">
        <span class="okonomi-kort-kunde">${kunde}</span>
        <span class="okonomi-kort-status">${status}</span>
      </div>
      <div class="okonomi-kort-linje okonomi-kort-linje2">
        <span class="okonomi-kort-tekst">${tekst}</span>
        <span class="okonomi-kort-ekstra">${ekstra}</span>
      </div>
      <div class="okonomi-kort-valg" onclick="event.stopPropagation();">${valg}</div>
    </div>
  `;
}

function okonomiLagTabell(tittel, rader, kolonner, tomTekst, klikkType) {
  if (!rader.length) {
    return `<h4>${okonomiTryggTekst(tittel)}</h4><p>${okonomiTryggTekst(tomTekst || "Ingen rader.")}</p>`;
  }

  const header = kolonner
    .map(k => `<th title="${okonomiTryggTekst(k.tittel)}">${okonomiTryggTekst(k.tittel)}</th>`)
    .join("");

  const body = rader.map((rad, indeks) => {
    const klikk = klikkType
      ? ` data-okonomi-type="${okonomiTryggTekst(klikkType)}" data-okonomi-indeks="${indeks}" title="${klikkType === "Faktura" ? "Klikk for å vise faktura" : "Klikk for detaljer"}"`
      : "";

    const celler = kolonner.map(k => {
      const innhold = okonomiKolonneInnhold(k, rad, indeks);
      const erValg = String(k.tittel || "").toLowerCase().includes("valg") || String(k.tittel || "").toLowerCase().includes("handling");
      return `<td${erValg ? ' onclick="event.stopPropagation();"' : ''} title="${okonomiTryggTekst(String(innhold).replace(/<[^>]*>/g, ''))}">${innhold}</td>`;
    }).join("");

    return `<tr class="klikkbar-okonomi" role="button"${klikk}>${celler}</tr>`;
  }).join("");

  return `
    <h4>${okonomiTryggTekst(tittel)}</h4>
    <div class="okonomi-scroll">
      <table class="okonomi-tabell">
        <thead><tr>${header}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

async function visOkonomiOversikt() {
  const container = document.getElementById("okonomiOversikt");
  const melding = document.getElementById("okonomiMelding");

  if (!container) {
    alert("Fant ikke området for økonomioversikt.");
    return;
  }

  const fraDato = document.getElementById("okonomiFraDato")?.value || "";
  const tilDato = document.getElementById("okonomiTilDato")?.value || "";
  const kundeId = document.getElementById("okonomiKundeValg")?.value || "";

  if (melding) melding.textContent = "Henter økonomioversikt...";
  container.innerHTML = "";

  if (typeof lastKunder === "function") {
    await lastKunder();
    fyllOkonomiKundeValg();
  }

  if (typeof lastTimer === "function") {
    await lastTimer();
  }

  const alleTimer = window.timer || [];
  const alleVarer = await okonomiHentTabell("hand_faktura_vare");
  const alleUtlegg = await okonomiHentTabell("hand_faktura_utlegg");
  const alleFakturaer = await okonomiHentTabell("hand_faktura");

  const ikkeFakturerteTimer = alleTimer
    .filter(okonomiErIkkeFakturertTimer)
    .filter(rad => okonomiErInnenDato(rad, fraDato, tilDato))
    .filter(rad => okonomiErSammeKunde(rad, kundeId));

  const ikkeFakturerteVarer = alleVarer
    .filter(v => v.fakturert !== true && !v.fakturanr)
    .filter(rad => okonomiErInnenDato(rad, fraDato, tilDato))
    .filter(rad => okonomiErSammeKunde(rad, kundeId));

  const ikkeFakturerteUtlegg = alleUtlegg
    .filter(u => u.fakturert !== true && !u.fakturanr)
    .filter(rad => okonomiErInnenDato(rad, fraDato, tilDato))
    .filter(rad => okonomiErSammeKunde(rad, kundeId));

  const fakturaer = alleFakturaer
    .filter(rad => okonomiErInnenDato(rad, fraDato, tilDato))
    .filter(rad => okonomiErSammeKunde(rad, kundeId));

  const samletGrupper = okonomiLagSamledeFakturaGrupper(
    ikkeFakturerteTimer,
    ikkeFakturerteVarer,
    ikkeFakturerteUtlegg
  );

  window.__okonomiKlikkData = {
    "Faktura": fakturaer,
    "Samlet": samletGrupper,
    "Time": ikkeFakturerteTimer,
    "Vare": ikkeFakturerteVarer,
    "Utlegg": ikkeFakturerteUtlegg
  };

  const ikkeFakturertEks = samletGrupper.reduce((sum, g) => sum + Number(g.eks_mva || 0), 0);
  const ikkeFakturertMva = ikkeFakturertEks * 0.25;
  const ikkeFakturertInk = ikkeFakturertEks + ikkeFakturertMva;

  const fakturertInk = fakturaer.reduce((sum, f) => sum + Number(f.inkl_mva || f.total || 0), 0);

  const betalt = fakturaer
    .filter(f => okonomiVisStatus(f) === "Betalt")
    .reduce((sum, f) => sum + Number(f.inkl_mva || f.total || f.betalt_belop || 0), 0);

  const ubetalt = Math.max(0, fakturertInk - betalt);

  const iDag = new Date().toISOString().slice(0, 10);
  const forfalteFakturaer = fakturaer.filter(f => {
    const erBetalt = okonomiVisStatus(f) === "Betalt";
    const forfall = okonomiDato(f.forfallsdato);
    return !erBetalt && forfall && forfall < iDag;
  });

  const forfaltSum = forfalteFakturaer.reduce((sum, f) => sum + Number(f.inkl_mva || f.total || 0), 0);

  const sammendrag = `
    <div id="okonomiDetalj"></div>
    <div class="okonomi-grid">
      <div class="okonomi-boks">Ikke fakturert eks. mva<strong>${okonomiBelop(ikkeFakturertEks)} kr</strong></div>
      <div class="okonomi-boks">Ikke fakturert inkl. mva<strong>${okonomiBelop(ikkeFakturertInk)} kr</strong></div>
      <div class="okonomi-boks">Fakturert inkl. mva<strong>${okonomiBelop(fakturertInk)} kr</strong></div>
      <div class="okonomi-boks">Betalt<strong>${okonomiBelop(betalt)} kr</strong></div>
      <div class="okonomi-boks">Ubetalt faktura<strong>${okonomiBelop(ubetalt)} kr</strong></div>
      <div class="okonomi-boks">Forfalt<strong class="okonomi-advarsel">${okonomiBelop(forfaltSum)} kr</strong></div>
    </div>

    <div class="okonomi-grid">
      <div class="okonomi-boks">Samlede fakturalinjer kunde/prosjekt<strong>${samletGrupper.length}</strong></div>
      <div class="okonomi-boks">Ikke fakturerte timer<strong>${ikkeFakturerteTimer.length}</strong></div>
      <div class="okonomi-boks">Ikke fakturerte varer<strong>${ikkeFakturerteVarer.length}</strong></div>
      <div class="okonomi-boks">Ikke fakturerte utlegg<strong>${ikkeFakturerteUtlegg.length}</strong></div>
      <div class="okonomi-boks">Fakturaer i utvalg<strong>${fakturaer.length}</strong></div>
    </div>
  `;

  const fakturaTabell = okonomiLagTabell(
    "Fakturaer",
    fakturaer,
    [
      { tittel: "Dato", verdi: f => okonomiDato(f.dato || f.created_at) },
      { tittel: "Fakturanr", verdi: f => f.fakturanr || "" },
      { tittel: "Kunde", verdi: f => okonomiKortTekst(okonomiKundeNavn(f.kunden_id || f.kunde_id, ""), 16) },
      { tittel: "Status", html: f => okonomiStatusMerke(f) },
      { tittel: "Forfall", verdi: f => okonomiDato(f.forfallsdato) },
      { tittel: "Inkl", verdi: f => okonomiBelop(f.inkl_mva || f.total || 0) + " kr" },
      { tittel: "Handlinger", html: (f, indeks) => okonomiHandlingerHtml("Faktura", f, indeks) }
    ],
    "Ingen fakturaer i dette utvalget.",
    "Faktura"
  );

  const samletTabell = okonomiLagTabell(
    "Ikke fakturert samlet per kunde/prosjekt",
    samletGrupper,
    [
      { tittel: "Dato", verdi: g => g.dato || "" },
      { tittel: "Kunde", verdi: g => okonomiKortTekst(okonomiKundeNavn(g.kunde_id, ""), 16) },
      { tittel: "Status", html: g => okonomiStatusMerke(g) },
      { tittel: "Prosjekt", verdi: g => okonomiKortTekst(okonomiProsjektTekst(g), 18) },
      { tittel: "Linjer", verdi: g => `${g.antall_timer}t/${g.antall_varer}v/${g.antall_utlegg}u` },
      { tittel: "Eks", verdi: g => okonomiBelop(g.eks_mva || 0) + " kr" },
      { tittel: "Handlinger", html: (g, indeks) => okonomiHandlingerHtml("Samlet", g, indeks) }
    ],
    "Ingen ikke-fakturerte timer, varer eller utlegg i dette utvalget.",
    "Samlet"
  );

  container.innerHTML = sammendrag + samletTabell + fakturaTabell;
  okonomiKobleRadklikk();

  if (melding) {
    melding.textContent = "Økonomioversikt oppdatert. Timer, varer og utlegg er samlet per kunde/prosjekt.";
  }
}

window.fyllOkonomiKundeValg = fyllOkonomiKundeValg;
window.visOkonomiOversikt = visOkonomiOversikt;
window.okonomiSettBetalt = okonomiSettBetalt;
window.okonomiPurringKnapp = okonomiPurringKnapp;
window.okonomiVisDetalj = okonomiVisDetalj;
window.okonomiVisFakturaFraRad = okonomiVisFakturaFraRad;
window.okonomiFakturerRad = okonomiFakturerRad;
window.okonomiLagKopi = okonomiLagKopi;
window.okonomiLagKreditnota = okonomiLagKreditnota;
window.okonomiHandlingerHtml = okonomiHandlingerHtml;
window.okonomiVisFakturaFraRad = okonomiVisFakturaFraRad;
window.okonomiKobleRadklikk = okonomiKobleRadklikk;
window.okonomiLukkDetalj = okonomiLukkDetalj;

window.addEventListener("load", function () {
  fyllOkonomiKundeValg();

  const knapp = document.getElementById("okonomiOversiktKnapp");
  if (knapp) {
    knapp.onclick = visOkonomiOversikt;
  }
});
