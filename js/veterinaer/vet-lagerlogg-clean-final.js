/* ===== CLEAN FINAL 09.06: ÉN EIER AV FYLL BIL + LAGERLOGG =====
   Denne erstatter gamle overlappende final-filer:
   - vet-bil-linjeliste-logg-final.js
   - vet-minbil-fyllbil-garanti.js
   - vet-duplicate-key-billager-final.js
   - vet-lagerlogg-lave-linjer-final.js
   - vet-lagerlogg-stopp-dobbel-final.js

   Skal ligge etter vet-lager.js / splittede lagerfiler og etter smal-liste-filene.
*/
(function () {
  if (window.__vetLagerloggCleanFinal) return;
  window.__vetLagerloggCleanFinal = true;

  const LOGG_TABELL = "vet_lager_logg";

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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
      const v = Function("return (typeof " + navn + " !== 'undefined' ? " + navn + " : undefined)")();
      return v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function tekst(id) {
    if (typeof vetTekst === "function") return vetTekst(id);
    return String($(id)?.value || "").trim();
  }

  function melding(id, msg) {
    if (typeof vetMelding === "function") vetMelding(id, msg);
    else if ($(id)) $(id).textContent = msg || "";
  }

  function klinikkId() {
    if (typeof hentKlinikkIdForLager === "function") return hentKlinikkIdForLager();
    return val("vetAktivKlinikkId") || tekst("klinikkId") || null;
  }

  function heltall(v) {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function kr(v) {
    if (typeof formaterKr === "function") return formaterKr(v);
    return Number(v || 0).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function antall0(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return "0";
    return Math.round(n).toLocaleString("nb-NO");
  }

  function vare(vareId) {
    return arr("vetVarer").find(x => String(x.id) === String(vareId)) || {};
  }

  function bil(bilId) {
    return arr("vetBiler").find(x => String(x.id) === String(bilId)) || {};
  }

  function vareNavnTrygg(vareId) {
    if (typeof vareNavn === "function") return vareNavn(vareId);
    return vare(vareId).navn || "Ukjent vare";
  }

  function bilNavnTrygg(bilId) {
    if (typeof bilNavn === "function") return bilNavn(bilId);
    const b = bil(bilId);
    return [b.navn, b.regnr].filter(Boolean).join(" - ") || "Ukjent bil";
  }

  function innloggetNavn() {
    const epost = String(val("vetInnloggetEpost", "") || "").toLowerCase();
    const navn = String(val("vetInnloggetBrukerNavn", "") || "").trim();
    if (epost === "greknuts@online.no") return "Anne Grethe";
    if (navn && !["systemadmin", "ukjent"].includes(navn.toLowerCase())) return navn;
    return navn || epost || "Ukjent";
  }

  async function tryggSettLagerAntall(tabell, filter, nyttAntall, ekstraInsert = {}) {
    const rad = { ...filter, ...ekstraInsert, antall: Number(nyttAntall || 0) };

    // Først update. Hvis den ikke finnes, upsert.
    let q = supabaseClient.from(tabell).update({ antall: rad.antall });
    Object.entries(filter).forEach(([k, v]) => { q = q.eq(k, v); });
    const upd = await q.select("id").maybeSingle();
    if (!upd.error && upd.data?.id) return true;

    let conflict = "id";
    if (tabell === "vet_lager") conflict = "klinikk_id,vare_id";
    if (tabell === "vet_bil_lager") conflict = "klinikk_id,bil_id,vare_id";

    const up = await supabaseClient
      .from(tabell)
      .upsert(rad, { onConflict: conflict })
      .select("id")
      .maybeSingle();

    if (up.error) throw up.error;
    return true;
  }

  async function loggFylling({ klinikk_id, bil_id, vare_id, antall, beholdning_for, beholdning_etter }) {
    const payload = {
      klinikk_id,
      bil_id,
      vare_id,
      antall: Number(antall || 0),
      type: "fyll_bil",
      retning: "hovedlager_til_bil",
      beholdning_for: Number(beholdning_for || 0),
      beholdning_etter: Number(beholdning_etter || 0),
      opprettet_av: val("vetInnloggetKlinikkBrukerId") || val("vetInnloggetAuthUserId") || null,
      opprettet_av_epost: val("vetInnloggetEpost") || null,
      opprettet_av_navn: innloggetNavn(),
      kommentar: `Fylte ${antall} ${vareNavnTrygg(vare_id)} på ${bilNavnTrygg(bil_id)}`
    };

    const { error } = await supabaseClient.from(LOGG_TABELL).insert(payload);
    if (error) console.warn("Lagerlogg ble ikke lagret:", error.message);
  }

  function hovedlagerRader() {
    return arr("vetHovedlager")
      .filter(r => Number(r.antall || 0) > 0)
      .map(r => ({ ...r, vare: r.vet_varer || vare(r.vare_id) || {} }))
      .filter(r => r.vare?.navn);
  }

  function tegnFyllBilFyllListe() {
    const liste = $("fyllBilFyllListe");
    if (!liste) return;

    const rader = hovedlagerRader();
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

  function hentValgteAdminLinjer() {
    const valgte = new Set(Array.from(document.querySelectorAll(".fyllbil-velg:checked")).map(cb => String(cb.dataset.vareId || "")));
    const inputs = Array.from(document.querySelectorAll(".fyllbil-antall"));
    const map = new Map();

    inputs.forEach(input => {
      const vareId = String(input.dataset.vareId || "");
      const antall = heltall(input.value);
      if (vareId && (valgte.has(vareId) || antall > 0)) {
        map.set(vareId, { vareId, antall });
      }
    });

    return Array.from(map.values());
  }

  function hentMinBilLinjer() {
    const inputs = Array.from(document.querySelectorAll(".minbil-antall"));
    return inputs
      .map(input => ({ vareId: String(input.dataset.vareId || ""), antall: heltall(input.value) }))
      .filter(l => l.vareId && l.antall > 0);
  }

  async function fyllValgtBil(bilId, linjer, meldingId) {
    const kid = klinikkId();

    if (!kid || !bilId) {
      melding(meldingId, "Velg bil først.");
      return false;
    }

    if (!linjer.length) {
      melding(meldingId, "Velg minst én vare og skriv antall.");
      return false;
    }

    for (const linje of linjer) {
      if (!(linje.antall > 0) || !Number.isInteger(linje.antall)) {
        melding(meldingId, "Antall må være heltall større enn 0.");
        return false;
      }
      const hoved = arr("vetHovedlager").find(r => String(r.vare_id) === String(linje.vareId));
      const hovedAntall = Number(hoved?.antall || 0);
      if (hovedAntall < linje.antall) {
        melding(meldingId, `${vareNavnTrygg(linje.vareId)}: ikke nok på hovedlager. Tilgjengelig: ${antall0(hovedAntall)}.`);
        return false;
      }
    }

    for (const linje of linjer) {
      const hoved = arr("vetHovedlager").find(r => String(r.vare_id) === String(linje.vareId));
      const hovedAntall = Number(hoved?.antall || 0);
      const bilRad = arr("vetBilLager").find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(linje.vareId));
      const bilFor = Number(bilRad?.antall || 0);
      const bilEtter = bilFor + linje.antall;

      await tryggSettLagerAntall("vet_lager", { klinikk_id: kid, vare_id: linje.vareId }, hovedAntall - linje.antall);
      await tryggSettLagerAntall("vet_bil_lager", { klinikk_id: kid, bil_id: bilId, vare_id: linje.vareId }, bilEtter);
      await loggFylling({
        klinikk_id: kid,
        bil_id: bilId,
        vare_id: linje.vareId,
        antall: linje.antall,
        beholdning_for: bilFor,
        beholdning_etter: bilEtter
      });
    }

    melding(meldingId, `La ${linjer.length} varelinje(r) på ${bilNavnTrygg(bilId)}.`);
    if (typeof lastVetLagerAlt === "function") await lastVetLagerAlt();
    tegnFyllBilFyllListe();
    if (typeof fyllMinBilSide === "function") fyllMinBilSide();
    await lastVetLagerLogg();
    return true;
  }

  async function flyttTilBilClean(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    if (window.__vetCleanFyllingPagar) return false;
    window.__vetCleanFyllingPagar = true;

    const knapp = $("flyttTilBilKnapp");
    if (knapp) knapp.disabled = true;

    try {
      melding("billagerMelding", "");
      await fyllValgtBil(tekst("fyllBilValg"), hentValgteAdminLinjer(), "billagerMelding");
    } catch (err) {
      melding("billagerMelding", "Feil ved fylling av bil: " + (err.message || err));
    } finally {
      window.__vetCleanFyllingPagar = false;
      if (knapp) knapp.disabled = false;
    }

    return false;
  }

  async function fyllMinBilClean(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    if (window.__vetCleanMinBilPagar) return false;
    window.__vetCleanMinBilPagar = true;

    const knapp = $("fyllMinBilFlereKnapp");
    if (knapp) knapp.disabled = true;

    try {
      melding("minBilMelding", "");
      let bilId = tekst("minBilValg");
      if (!bilId && typeof valgtMinBilId === "function") bilId = valgtMinBilId();
      await fyllValgtBil(bilId, hentMinBilLinjer(), "minBilMelding");
    } catch (err) {
      melding("minBilMelding", "Feil ved fylling av bil: " + (err.message || err));
    } finally {
      window.__vetCleanMinBilPagar = false;
      if (knapp) knapp.disabled = false;
    }

    return false;
  }

  function visLagerFane(omradeId) {
    if (typeof visVetSide === "function") visVetSide("lagerSide");

    ["minBilOmrade", "adminLagerOmrade", "bestillingOmrade", "lagerLoggOmrade"].forEach(id => {
      const el = $(id);
      if (!el) return;
      const vis = id === omradeId;
      el.style.display = vis ? "" : "none";
      el.classList.toggle("skjult", !vis);
    });

    if (omradeId === "minBilOmrade" && typeof fyllMinBilSide === "function") fyllMinBilSide();
    if (omradeId === "adminLagerOmrade") {
      if (typeof tegnAltLager === "function") tegnAltLager();
      setTimeout(tegnFyllBilFyllListe, 0);
    }
    if (omradeId === "lagerLoggOmrade") lastVetLagerLogg();
    return false;
  }

  function visFyllBilSide() {
    visLagerFane("adminLagerOmrade");
    setTimeout(() => {
      const el = $("fyllBilValg");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    return false;
  }

  async function lastVetLagerLogg() {
    const steder = ["lagerLoggListe", "lagerLoggListeFane", "lagerLoggListeStor", "minBilLoggListe"]
      .map(id => $(id))
      .filter(Boolean);

    if (!steder.length || !window.supabaseClient) return;

    let query = supabaseClient
      .from(LOGG_TABELL)
      .select("id,created_at,klinikk_id,bil_id,vare_id,antall,type,retning,opprettet_av_epost,opprettet_av_navn,kommentar")
      .order("created_at", { ascending: false })
      .limit(100);

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

    const bilIds = [...new Set(data.map(r => r.bil_id).filter(Boolean))];
    const vareIds = [...new Set(data.map(r => r.vare_id).filter(Boolean))];

    const bilMap = new Map(arr("vetBiler").map(b => [String(b.id), b]));
    const vareMap = new Map(arr("vetVarer").map(v => [String(v.id), v]));

    if (bilIds.length) {
      const { data: biler } = await supabaseClient.from("vet_biler").select("id,navn,regnr").in("id", bilIds);
      (biler || []).forEach(b => bilMap.set(String(b.id), b));
    }
    if (vareIds.length) {
      const { data: varer } = await supabaseClient.from("vet_varer").select("id,navn,enhet").in("id", vareIds);
      (varer || []).forEach(v => vareMap.set(String(v.id), v));
    }

    const html = `
      <div style="display:grid;gap:1px;margin-top:6px;font-size:12px;line-height:1.05;">
        <div style="display:grid;grid-template-columns:86px minmax(120px,1fr) minmax(170px,1.5fr) 54px minmax(105px,1fr);gap:5px;align-items:center;padding:2px 6px;background:#111827;border:1px solid #374151;font-weight:bold;color:#f8fafc;min-height:22px;">
          <span>Tid</span><span>Bil</span><span>Vare</span><span>Ant.</span><span>Bruker</span>
        </div>
        ${data.map(r => {
          const dato = r.created_at ? new Date(r.created_at).toLocaleString("nb-NO", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "";
          const b = bilMap.get(String(r.bil_id || ""));
          const v = vareMap.get(String(r.vare_id || ""));
          const bilnavn = [b?.navn, b?.regnr].filter(Boolean).join(" - ") || "Ukjent bil";
          const varenavn = v?.navn || "Ukjent vare";
          const bruker = r.opprettet_av_navn || r.opprettet_av_epost || "Ukjent";
          return `
            <div title="${esc(r.kommentar || "")}" style="display:grid;grid-template-columns:86px minmax(120px,1fr) minmax(170px,1.5fr) 54px minmax(105px,1fr);gap:5px;align-items:center;padding:1px 6px;border:1px solid #374151;background:#1f2427;min-height:22px;">
              <span class="lite" style="white-space:nowrap;font-size:12px;">${esc(dato)}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${esc(bilnavn)}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${esc(varenavn)}</span>
              <span style="text-align:right;font-size:12px;white-space:nowrap;">${esc(antall0(r.antall))}</span>
              <span class="lite" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${esc(bruker)}</span>
            </div>`;
        }).join("")}
      </div>`;

    steder.forEach(el => { el.innerHTML = html; });
  }

  function kobleClean() {
    const flytt = $("flyttTilBilKnapp");
    if (flytt && flytt.dataset.cleanFinal !== "1") {
      const ny = flytt.cloneNode(true);
      ny.dataset.cleanFinal = "1";
      ny.textContent = "Legg valgte varer på valgt bil";
      ny.onclick = flyttTilBilClean;
      flytt.parentNode.replaceChild(ny, flytt);
    }

    const min = $("fyllMinBilFlereKnapp");
    if (min && min.dataset.cleanFinal !== "1") {
      const nyMin = min.cloneNode(true);
      nyMin.dataset.cleanFinal = "1";
      nyMin.onclick = fyllMinBilClean;
      min.parentNode.replaceChild(nyMin, min);
    }

    tegnFyllBilFyllListe();
    lastVetLagerLogg();
  }

  window.visLagerFane = visLagerFane;
  window.visFyllBilSide = visFyllBilSide;
  window.tegnFyllBilFyllListe = tegnFyllBilFyllListe;
  window.flyttTilBil = flyttTilBilClean;
  window.fyllMinBilMedFlereVarer = fyllMinBilClean;
  window.lastVetLagerLogg = lastVetLagerLogg;

  const gammelVisVetSide = window.visVetSide;
  if (typeof gammelVisVetSide === "function" && gammelVisVetSide.__cleanFinal !== true) {
    const nyVis = function (sideId) {
      const r = gammelVisVetSide.apply(this, arguments);
      if (sideId === "lagerSide" || sideId === "lagerLoggSide") setTimeout(kobleClean, 50);
      return r;
    };
    nyVis.__cleanFinal = true;
    window.visVetSide = nyVis;
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(kobleClean, 300));
  window.addEventListener("load", () => setTimeout(kobleClean, 500));
  setTimeout(kobleClean, 1000);
  setTimeout(kobleClean, 2000);
})();
