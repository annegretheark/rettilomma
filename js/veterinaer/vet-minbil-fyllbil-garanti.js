
/* ===== MIN BIL + FYLL BIL FANER GARANTI 09.06 =====
   Ligger helt sist. Beholder Oppsett/Ny bil, men reparerer:
   - visLagerFane()
   - visFyllBilSide()
   - Min bil-fanen
   - smal fyll-bil-liste
   - logging av hvilken bil som får varen
*/
(function () {
  const LOGG_TABELL = "vet_lager_logg";

  function $(id) { return document.getElementById(id); }

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
    return String($(id)?.value || "").trim();
  }

  function melding(id, msg) {
    if (typeof vetMelding === "function") vetMelding(id, msg);
    else if ($(id)) $(id).textContent = msg || "";
  }

  function arr(navn) {
    try {
      return Function("return (typeof " + navn + " !== 'undefined' ? " + navn + " : [])")() || [];
    } catch (e) {
      return [];
    }
  }

  function val(navn, fallback = null) {
    try {
      return Function("return (typeof " + navn + " !== 'undefined' ? " + navn + " : null)")() ?? fallback;
    } catch (e) {
      return fallback;
    }
  }

  function klinikkId() {
    if (typeof hentKlinikkIdForLager === "function") return hentKlinikkIdForLager();
    return val("vetAktivKlinikkId") || tekst("klinikkId") || null;
  }

  function hentVare(vareId) {
    return arr("vetVarer").find(v => String(v.id) === String(vareId)) || {};
  }

  function hentBil(bilId) {
    return arr("vetBiler").find(b => String(b.id) === String(bilId)) || {};
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

  function visLagerFane(omradeId) {
    if (typeof visVetSide === "function") visVetSide("lagerSide");

    ["minBilOmrade", "adminLagerOmrade", "bestillingOmrade", "lagerLoggOmrade"].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.style.display = id === omradeId ? "" : "none";
      el.classList.toggle("skjult", id !== omradeId);
    });

    if (omradeId === "minBilOmrade") {
      if (typeof fyllMinBilSide === "function") fyllMinBilSide();
      else {
        if (typeof fyllMinBilValg === "function") fyllMinBilValg();
        if (typeof tegnMinBilFyllListe === "function") tegnMinBilFyllListe();
        if (typeof tegnMinBilInnhold === "function") tegnMinBilInnhold();
      }
      if (typeof lastVetLagerLogg === "function") lastVetLagerLogg();
    }

    if (omradeId === "adminLagerOmrade") {
      if (typeof tegnAltLager === "function") tegnAltLager();
      setTimeout(tegnFyllBilFyllListeSmaleLinjer, 0);
    }

    if (omradeId === "lagerLoggOmrade" && typeof lastVetLagerLogg === "function") {
      lastVetLagerLogg();
    }

    return false;
  }

  function visFyllBilSide() {
    visLagerFane("adminLagerOmrade");
    setTimeout(() => {
      const el = $("fyllBilValg");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return false;
  }

  function tegnFyllBilFyllListeSmaleLinjer() {
    const liste = $("fyllBilFyllListe");
    if (!liste) return;

    const rader = arr("vetHovedlager")
      .filter(r => Number(r.antall || 0) > 0)
      .map(r => ({ ...r, vare: r.vet_varer || hentVare(r.vare_id) || {} }))
      .filter(r => r.vare?.navn);

    if (!rader.length) {
      liste.innerHTML = '<p class="lite">Ingen varer på hovedlager.</p>';
      return;
    }

    liste.innerHTML = `
      <div style="display:grid;gap:1px;margin-top:10px;font-size:13px;">
        <div style="display:grid;grid-template-columns:26px minmax(180px,2fr) 70px 58px 70px;gap:6px;align-items:center;padding:3px 6px;background:#111827;border:1px solid #374151;font-weight:bold;color:#f8fafc;">
          <span></span><span>Vare / medisin</span><span>På lager</span><span>Enhet</span><span>Antall</span>
        </div>
        ${rader.map(r => {
          const v = r.vare || {};
          const id = esc(r.vare_id);
          const max = Math.floor(Number(r.antall || 0));
          return `
            <label for="fyllbil_velg_${id}" style="display:grid;grid-template-columns:26px minmax(180px,2fr) 70px 58px 70px;gap:6px;align-items:center;padding:2px 6px;border:1px solid #374151;background:#1f2427;cursor:pointer;min-height:24px;">
              <input id="fyllbil_velg_${id}" class="fyllbil-velg" data-vare-id="${id}" type="checkbox" style="width:auto;margin:0;">
              <span title="${esc(v.navn || '')}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f3f4f6;">${esc(v.navn || "Vare")}</span>
              <span class="lite" style="white-space:nowrap;">${antall0(r.antall)}</span>
              <span class="lite" style="white-space:nowrap;">${esc(v.enhet || "stk")}</span>
              <input id="fyllbil_antall_${id}" class="fyllbil-antall" data-vare-id="${id}" type="number" step="1" min="1" max="${max}" placeholder="0" value="" onclick="event.stopPropagation();" style="margin:0;padding:2px 5px;height:24px;font-size:13px;">
            </label>`;
        }).join("")}
      </div>`;
  }

  async function loggFyllBil(rad) {
    if (!window.supabaseClient) return;
    const payload = {
      klinikk_id: rad.klinikk_id,
      bil_id: rad.bil_id,
      vare_id: rad.vare_id,
      antall: Number(rad.antall || 0),
      type: "fyll_bil",
      retning: "hovedlager_til_bil",
      beholdning_for: Number(rad.beholdning_for || 0),
      beholdning_etter: Number(rad.beholdning_etter || 0),
      opprettet_av: val("vetInnloggetKlinikkBrukerId") || val("vetInnloggetAuthUserId") || null,
      opprettet_av_epost: val("vetInnloggetEpost") || null,
      opprettet_av_navn: val("vetInnloggetBrukerNavn") || null,
      kommentar: `Fylte ${rad.antall} ${varenavn(rad.vare_id)} på ${bilnavn(rad.bil_id)}`
    };
    const { error } = await supabaseClient.from(LOGG_TABELL).insert(payload);
    if (error) console.warn("Lagerlogg ble ikke lagret:", error.message);
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
        melding("billagerMelding", "Antall må være heltall større enn 0.");
        return;
      }
      const hoved = arr("vetHovedlager").find(r => String(r.vare_id) === String(linje.vareId));
      const hovedAntall = Number(hoved?.antall || 0);
      if (hovedAntall < linje.antall) {
        melding("billagerMelding", `${varenavn(linje.vareId)}: ikke nok på hovedlager. Tilgjengelig: ${kr(hovedAntall)}.`);
        return;
      }
    }

    const knapp = $("flyttTilBilKnapp");
    if (knapp) knapp.disabled = true;

    try {
      for (const linje of linjer) {
        const hoved = arr("vetHovedlager").find(r => String(r.vare_id) === String(linje.vareId));
        const hovedAntall = Number(hoved?.antall || 0);
        const bilRad = arr("vetBilLager").find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(linje.vareId));
        const bilFor = Number(bilRad?.antall || 0);
        const bilEtter = bilFor + linje.antall;

        await settLagerAntall("vet_lager", { klinikk_id: kid, vare_id: linje.vareId }, hovedAntall - linje.antall);
        await settLagerAntall("vet_bil_lager", { klinikk_id: kid, bil_id: bilId, vare_id: linje.vareId }, bilEtter);
        await loggFyllBil({ klinikk_id: kid, bil_id: bilId, vare_id: linje.vareId, antall: linje.antall, beholdning_for: bilFor, beholdning_etter: bilEtter });
      }

      melding("billagerMelding", `La ${linjer.length} varelinje(r) på ${bilnavn(bilId)}.`);
      if (typeof lastVetLagerAlt === "function") await lastVetLagerAlt();
      visFyllBilSide();
      if (typeof lastVetLagerLogg === "function") await lastVetLagerLogg();
    } catch (e) {
      melding("billagerMelding", "Feil ved fylling av bil: " + (e.message || e));
    } finally {
      if (knapp) knapp.disabled = false;
    }
  }

  async function lastVetLagerLogg() {
    const steder = ["lagerLoggListe", "lagerLoggListeFane", "lagerLoggListeStor", "minBilLoggListe"]
      .map(id => $(id))
      .filter(Boolean);
    if (!steder.length || !window.supabaseClient) return;

    let query = supabaseClient
      .from(LOGG_TABELL)
      .select("id, created_at, klinikk_id, bil_id, vare_id, antall, type, retning, opprettet_av_epost, opprettet_av_navn, vet_biler(navn,regnr), vet_varer(navn,enhet)")
      .order("created_at", { ascending: false })
      .limit(50);

    const aktivKlinikk = val("vetAktivKlinikkId");
    const erSys = val("vetErSystemAdmin", false);
    if (aktivKlinikk && erSys !== true) query = query.eq("klinikk_id", aktivKlinikk);

    const { data, error } = await query;
    if (error) {
      steder.forEach(el => { el.innerHTML = '<p class="lite">Kunne ikke lese lagerlogg akkurat nå.</p>'; });
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
            </div>`;
        }).join("")}
      </div>`;
    steder.forEach(el => { el.innerHTML = html; });
  }

  function koble() {
    const flytt = $("flyttTilBilKnapp");
    if (flytt) {
      flytt.textContent = "Legg valgte varer på valgt bil";
      flytt.onclick = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        flyttTilBilMedLogg();
        return false;
      };
    }

    const minBil = $("minBilValg");
    if (minBil && minBil.dataset.minBilGaranti !== "1") {
      minBil.dataset.minBilGaranti = "1";
      minBil.addEventListener("change", () => {
        if (typeof fyllMinBilSide === "function") fyllMinBilSide();
        if (typeof lastVetLagerLogg === "function") lastVetLagerLogg();
      });
    }

    const fyllMin = $("fyllMinBilFlereKnapp");
    if (fyllMin && typeof fyllMinBilMedFlereVarer === "function") {
      fyllMin.onclick = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        fyllMinBilMedFlereVarer();
        return false;
      };
    }

    if ($("lagerSide") && $("minBilOmrade") && !$("minBilOmrade").style.display) {
      // La eksisterende rollelogikk styre først. Dette er bare en sikker oppfrisking.
      if (typeof fyllMinBilSide === "function") fyllMinBilSide();
    }

    tegnFyllBilFyllListeSmaleLinjer();
    lastVetLagerLogg();
  }

  window.visLagerFane = visLagerFane;
  window.visFyllBilSide = visFyllBilSide;
  window.tegnFyllBilFyllListe = tegnFyllBilFyllListeSmaleLinjer;
  window.flyttTilBil = flyttTilBilMedLogg;
  window.lastVetLagerLogg = lastVetLagerLogg;

  const gammelVisVetSide = window.visVetSide;
  if (typeof gammelVisVetSide === "function" && gammelVisVetSide.__minBilGaranti !== true) {
    const ny = function (sideId) {
      const r = gammelVisVetSide.apply(this, arguments);
      if (sideId === "lagerSide" || sideId === "lagerLoggSide") setTimeout(koble, 0);
      return r;
    };
    ny.__minBilGaranti = true;
    window.visVetSide = ny;
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(koble, 300));
  window.addEventListener("load", () => setTimeout(koble, 300));
  setTimeout(koble, 1000);
  setTimeout(koble, 2000);
})();
