/* ===== FYLL BIL: SMALE LINJER + LAGERLOGG FINAL 09.06 =====
   Laster sist. Overstyrer gammel kortvisning, men bruker eksisterende tabeller:
   vet_lager, vet_bil_lager, vet_biler og vet_varer.
   Lagerlogg bruker ny tabell vet_lager_logg. Kjør SQL-filen som følger med zippen.
*/
(function () {
  const LOGG_TABELL = "vet_lager_logg";

  function esc(verdi) {
    return String(verdi ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function kr(tall) {
    if (typeof formaterKr === "function") return formaterKr(tall);
    return Number(tall || 0).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function antall0(tall) {
    const n = Number(tall || 0);
    if (!Number.isFinite(n)) return "0";
    return Math.round(n).toLocaleString("nb-NO", { maximumFractionDigits: 0 });
  }

  function tekst(id) {
    if (typeof vetTekst === "function") return vetTekst(id);
    return String(document.getElementById(id)?.value || "").trim();
  }

  function melding(id, msg) {
    if (typeof vetMelding === "function") vetMelding(id, msg);
    else {
      const el = document.getElementById(id);
      if (el) el.textContent = msg || "";
    }
  }

  function klinikkId() {
    if (typeof hentKlinikkIdForLager === "function") return hentKlinikkIdForLager();
    return window.vetAktivKlinikkId || tekst("klinikkId") || null;
  }

  function hentVare(vareId) {
    return (window.vetVarer || []).find(v => String(v.id) === String(vareId)) || {};
  }

  function hentBil(bilId) {
    return (window.vetBiler || []).find(b => String(b.id) === String(bilId)) || {};
  }

  function bilnavn(bilId) {
    if (typeof bilNavn === "function") return bilNavn(bilId);
    const b = hentBil(bilId);
    return [b.navn, b.regnr].filter(Boolean).join(" - ") || "Ukjent bil";
  }

  function varenavn(vareId) {
    if (typeof vareNavn === "function") return vareNavn(vareId);
    return hentVare(vareId).navn || "Ukjent vare";
  }

  function sørgForFyllBilHeader() {
    const liste = document.getElementById("fyllBilFyllListe");
    if (!liste) return;

    const knapp = document.getElementById("flyttTilBilKnapp");
    if (knapp) {
      knapp.textContent = "Legg valgte varer på valgt bil";
      knapp.style.marginTop = "10px";
    }
  }

  function tegnFyllBilFyllListeSmaleLinjer() {
    const liste = document.getElementById("fyllBilFyllListe");
    if (!liste) return;

    const rader = (window.vetHovedlager || [])
      .filter(r => Number(r.antall || 0) > 0)
      .map(r => {
        const v = r.vet_varer || hentVare(r.vare_id) || {};
        return { ...r, vare: v };
      })
      .filter(r => r.vare?.navn);

    if (!rader.length) {
      liste.innerHTML = '<p class="lite">Ingen varer på hovedlager.</p>';
      return;
    }

    liste.innerHTML = `
      <div class="vet-smal-liste" style="display:grid;gap:1px;margin-top:10px;font-size:13px;">
        <div style="display:grid;grid-template-columns:26px minmax(180px,2fr) 70px 58px 70px;gap:6px;align-items:center;padding:3px 6px;background:#111827;border:1px solid #374151;font-weight:bold;color:#f8fafc;">
          <span></span><span>Vare / medisin</span><span>På lager</span><span>Enhet</span><span>Antall</span>
        </div>
        ${rader.map(r => {
          const v = r.vare || {};
          const id = esc(r.vare_id);
          const max = Math.floor(Number(r.antall || 0));
          const enhet = esc(v.enhet || "stk");
          return `
            <label for="fyllbil_velg_${id}" style="display:grid;grid-template-columns:26px minmax(180px,2fr) 70px 58px 70px;gap:6px;align-items:center;padding:2px 6px;border:1px solid #374151;background:#1f2427;cursor:pointer;min-height:24px;">
              <input id="fyllbil_velg_${id}" class="fyllbil-velg" data-vare-id="${id}" type="checkbox" style="width:auto;margin:0;">
              <span title="${esc(v.navn || '')}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f3f4f6;">${esc(v.navn || "Vare")}</span>
              <span class="lite" style="white-space:nowrap;">${antall0(r.antall)}</span>
              <span class="lite" style="white-space:nowrap;">${enhet}</span>
              <input id="fyllbil_antall_${id}" class="fyllbil-antall" data-vare-id="${id}" type="number" step="1" min="1" max="${max}" placeholder="0" value="" onclick="event.stopPropagation();" style="margin:0;padding:2px 5px;height:24px;font-size:13px;">
            </label>
          `;
        }).join("")}
      </div>
    `;
  }

  async function loggFyllBil({ klinikk_id, bil_id, vare_id, antall, beholdning_for, beholdning_etter }) {
    if (!window.supabaseClient) return;

    const rad = {
      klinikk_id,
      bil_id,
      vare_id,
      antall: Number(antall || 0),
      type: "fyll_bil",
      retning: "hovedlager_til_bil",
      beholdning_for: Number(beholdning_for || 0),
      beholdning_etter: Number(beholdning_etter || 0),
      opprettet_av: window.vetInnloggetKlinikkBrukerId || window.vetInnloggetAuthUserId || null,
      opprettet_av_epost: window.vetInnloggetEpost || null,
      opprettet_av_navn: window.vetInnloggetBrukerNavn || null,
      kommentar: `Fylte ${antall} ${varenavn(vare_id)} på ${bilnavn(bil_id)}`
    };

    const { error } = await supabaseClient.from(LOGG_TABELL).insert(rad);
    if (error) {
      console.warn("Lagerlogg ble ikke lagret:", error.message);
    }
  }

  async function flyttTilBilMedLogg() {
    melding("billagerMelding", "");

    const kid = klinikkId();
    const bilId = tekst("fyllBilValg");

    if (!kid || !bilId) {
      melding("billagerMelding", "Velg bil først.");
      return;
    }

    const inputs = Array.from(document.querySelectorAll(".fyllbil-antall"));
    const valgte = new Set(Array.from(document.querySelectorAll(".fyllbil-velg:checked")).map(cb => String(cb.dataset.vareId || "")));
    const linjer = inputs
      .map(input => ({ vareId: input.dataset.vareId, antall: Number(String(input.value || "").replace(",", ".")) }))
      .filter(l => l.vareId && (valgte.has(String(l.vareId)) || l.antall > 0));

    if (!linjer.length) {
      melding("billagerMelding", "Velg minst én vare og skriv antall.");
      return;
    }

    for (const linje of linjer) {
      if (!(linje.antall > 0) || !Number.isInteger(linje.antall)) {
        melding("billagerMelding", "Antall må være heltall større enn 0 på alle valgte varer.");
        return;
      }
      const hoved = (window.vetHovedlager || []).find(r => String(r.vare_id) === String(linje.vareId));
      const hovedAntall = Number(hoved?.antall || 0);
      if (hovedAntall < linje.antall) {
        melding("billagerMelding", `${varenavn(linje.vareId)}: ikke nok på hovedlager. Tilgjengelig: ${kr(hovedAntall)}.`);
        return;
      }
    }

    const knapp = document.getElementById("flyttTilBilKnapp");
    if (knapp) knapp.disabled = true;

    try {
      for (const linje of linjer) {
        const hoved = (window.vetHovedlager || []).find(r => String(r.vare_id) === String(linje.vareId));
        const hovedAntall = Number(hoved?.antall || 0);
        const hovedNytt = hovedAntall - linje.antall;
        const bilRad = (window.vetBilLager || []).find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(linje.vareId));
        const bilFør = Number(bilRad?.antall || 0);
        const bilNytt = bilFør + linje.antall;

        await settLagerAntall("vet_lager", { klinikk_id: kid, vare_id: linje.vareId }, hovedNytt);
        await settLagerAntall("vet_bil_lager", { klinikk_id: kid, bil_id: bilId, vare_id: linje.vareId }, bilNytt);
        await loggFyllBil({ klinikk_id: kid, bil_id: bilId, vare_id: linje.vareId, antall: linje.antall, beholdning_for: bilFør, beholdning_etter: bilNytt });
      }

      melding("billagerMelding", `La ${linjer.length} varelinje(r) på ${bilnavn(bilId)}.`);
      if (typeof lastVetLagerAlt === "function") await lastVetLagerAlt();
      tegnFyllBilFyllListeSmaleLinjer();
      await lastVetLagerLogg();
    } catch (e) {
      melding("billagerMelding", "Feil ved fylling av bil: " + (e.message || e));
    } finally {
      if (knapp) knapp.disabled = false;
    }
  }

  async function lastVetLagerLogg() {
    if (!window.supabaseClient) return;

    const steder = ["lagerLoggListe", "lagerLoggListeFane", "lagerLoggListeStor", "minBilLoggListe"]
      .map(id => document.getElementById(id))
      .filter(Boolean);
    if (!steder.length) return;

    let query = supabaseClient
      .from(LOGG_TABELL)
      .select("id, created_at, klinikk_id, bil_id, vare_id, antall, type, retning, opprettet_av_epost, opprettet_av_navn, kommentar, vet_biler(navn,regnr), vet_varer(navn,enhet)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (window.vetAktivKlinikkId && window.vetErSystemAdmin !== true) {
      query = query.eq("klinikk_id", window.vetAktivKlinikkId);
    }

    const { data, error } = await query;

    if (error) {
      const html = '<p class="lite">Kunne ikke lese lagerlogg akkurat nå.</p>';
      steder.forEach(el => { el.innerHTML = html; });
      return;
    }

    if (!data || !data.length) {
      steder.forEach(el => { el.innerHTML = '<p class="lite">Ingen lagerbevegelser logget ennå.</p>'; });
      return;
    }

    const html = `
      <div style="display:grid;gap:1px;margin-top:8px;font-size:13px;">
        <div style="display:grid;grid-template-columns:minmax(115px,.8fr) minmax(150px,1.1fr) minmax(180px,1.5fr) 70px minmax(130px,1fr);gap:8px;padding:5px 8px;background:#111827;border:1px solid #374151;font-weight:bold;color:#f8fafc;">
          <span>Tid</span><span>Bil</span><span>Vare</span><span>Antall</span><span>Bruker</span>
        </div>
        ${data.map(r => {
          const dato = r.created_at ? new Date(r.created_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" }) : "";
          const bil = [r.vet_biler?.navn, r.vet_biler?.regnr].filter(Boolean).join(" - ") || bilnavn(r.bil_id);
          const vare = r.vet_varer?.navn || varenavn(r.vare_id);
          const enhet = r.vet_varer?.enhet || "stk";
          const bruker = r.opprettet_av_navn || r.opprettet_av_epost || "Ukjent";
          return `
            <div style="display:grid;grid-template-columns:minmax(115px,.8fr) minmax(150px,1.1fr) minmax(180px,1.5fr) 70px minmax(130px,1fr);gap:8px;align-items:center;padding:4px 8px;border:1px solid #374151;background:#1f2427;min-height:32px;">
              <span class="lite">${esc(dato)}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(bil)}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(vare)}</span>
              <span class="lite">${kr(r.antall)} ${esc(enhet)}</span>
              <span class="lite" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(bruker)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;

    steder.forEach(el => { el.innerHTML = html; });
  }

  function kobleFyllBilFinal() {
    sørgForFyllBilHeader();

    const knapp = document.getElementById("flyttTilBilKnapp");
    if (knapp) {
      knapp.onclick = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        flyttTilBilMedLogg();
        return false;
      };
    }

    const bilvalg = document.getElementById("fyllBilValg");
    if (bilvalg && bilvalg.dataset.loggKoblet !== "1") {
      bilvalg.dataset.loggKoblet = "1";
      bilvalg.addEventListener("change", () => lastVetLagerLogg());
    }

    tegnFyllBilFyllListeSmaleLinjer();
    lastVetLagerLogg();
  }

  const gammelTegnFyllBilFyllListe = window.tegnFyllBilFyllListe;
  window.tegnFyllBilFyllListe = function () {
    try { tegnFyllBilFyllListeSmaleLinjer(); }
    catch (e) {
      console.warn("Kunne ikke tegne smal fyll-bil-liste:", e);
      if (typeof gammelTegnFyllBilFyllListe === "function") gammelTegnFyllBilFyllListe();
    }
  };

  const gammelFlyttTilBil = window.flyttTilBil;
  window.flyttTilBil = flyttTilBilMedLogg;
  window.lastVetLagerLogg = lastVetLagerLogg;

  const gammelLastVetLagerAlt = window.lastVetLagerAlt;
  if (typeof gammelLastVetLagerAlt === "function") {
    window.lastVetLagerAlt = async function () {
      const r = await gammelLastVetLagerAlt.apply(this, arguments);
      kobleFyllBilFinal();
      return r;
    };
  }

  const gammelVisVetSide = window.visVetSide;
  if (typeof gammelVisVetSide === "function") {
    window.visVetSide = function (sideId) {
      const r = gammelVisVetSide.apply(this, arguments);
      if (sideId === "lagerSide" || sideId === "lagerLoggSide") setTimeout(kobleFyllBilFinal, 0);
      return r;
    };
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(kobleFyllBilFinal, 300));
  window.addEventListener("load", () => setTimeout(kobleFyllBilFinal, 300));
  setTimeout(kobleFyllBilFinal, 1200);
})();
/* ===== SLUTT FYLL BIL FINAL ===== */
