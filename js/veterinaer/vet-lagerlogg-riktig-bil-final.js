/* ===== FINAL FIX 09.06: LAGERLOGG SKAL BRUKE SAMME BIL SOM FAKTISK FYLLES =====
   Legg denne filen ETTER:
   - vet-lager.js
   - vet-minbil-fyllbil-garanti.js
   - vet-duplicate-key-billager-final.js

   Fikser tilfelle der flere felt har samme id, og document.getElementById("fyllBilValg")
   henter feil/skjult bilvalg. Da blir billager riktig, men lagerloggen får Bil nr1.
*/
(function () {
  const LOGG_TABELL = "vet_lager_logg";

  function $(id) { return document.getElementById(id); }

  function alleMedId(id) {
    return Array.from(document.querySelectorAll(`[id="${CSS.escape(id)}"]`));
  }

  function erSynlig(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (el.closest(".skjult")) return false;
    if (el.closest('[style*="display: none"]')) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function synligVerdi(id) {
    const alle = alleMedId(id);
    const synlige = alle.filter(erSynlig);
    const medVerdi = synlige.find(el => String(el.value || "").trim());
    if (medVerdi) return String(medVerdi.value || "").trim();

    const hvilkenSomHelstMedVerdi = alle.find(el => String(el.value || "").trim());
    if (hvilkenSomHelstMedVerdi) return String(hvilkenSomHelstMedVerdi.value || "").trim();

    const en = $(id);
    return String(en?.value || "").trim();
  }

  function tekst(id) {
    if (id === "fyllBilValg" || id === "minBilValg") return synligVerdi(id);
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
      const v = Function("return (typeof " + navn + " !== 'undefined' ? " + navn + " : undefined)")();
      return v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function klinikkId() {
    if (typeof hentKlinikkIdForLager === "function") return hentKlinikkIdForLager();
    return val("vetAktivKlinikkId") || tekst("klinikkId") || null;
  }

  function heltall(v) {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function vareNavnTrygg(vareId) {
    if (typeof vareNavn === "function") return vareNavn(vareId);
    const v = arr("vetVarer").find(x => String(x.id) === String(vareId));
    return v?.navn || "Ukjent vare";
  }

  function bilNavnTrygg(bilId) {
    if (typeof bilNavn === "function") return bilNavn(bilId);
    const b = arr("vetBiler").find(x => String(x.id) === String(bilId));
    return [b?.navn, b?.regnr].filter(Boolean).join(" - ") || "Ukjent bil";
  }

  async function tryggSettLagerAntallFinal(tabell, filter, nyttAntall, ekstraInsert = {}) {
    if (typeof settLagerAntall === "function" && settLagerAntall !== tryggSettLagerAntallFinal) {
      return settLagerAntall(tabell, filter, nyttAntall, ekstraInsert);
    }

    const rad = { ...filter, ...ekstraInsert, antall: Number(nyttAntall || 0) };
    let q = supabaseClient.from(tabell).update({ antall: rad.antall });
    Object.entries(filter).forEach(([k, v]) => { q = q.eq(k, v); });
    const upd = await q.select("id").maybeSingle();

    if (!upd.error && upd.data?.id) return true;

    let konflikt = "id";
    if (tabell === "vet_bil_lager") konflikt = "klinikk_id,bil_id,vare_id";
    if (tabell === "vet_lager") konflikt = "klinikk_id,vare_id";

    const up = await supabaseClient
      .from(tabell)
      .upsert(rad, { onConflict: konflikt })
      .select("id")
      .maybeSingle();

    if (up.error) throw up.error;
    return true;
  }

  function hentValgteFyllBilLinjer() {
    const inputs = Array.from(document.querySelectorAll(".fyllbil-antall"));
    const valgte = new Set(
      Array.from(document.querySelectorAll(".fyllbil-velg:checked"))
        .map(cb => String(cb.dataset.vareId || ""))
    );

    const map = new Map();
    inputs.forEach(input => {
      if (!erSynlig(input)) return;
      const vareId = String(input.dataset.vareId || "");
      if (!vareId) return;
      const antall = heltall(input.value);
      if (valgte.has(vareId) || antall > 0) map.set(vareId, { vareId, antall });
    });

    // Fallback hvis listen ikke regnes som synlig på mobil.
    if (!map.size) {
      inputs.forEach(input => {
        const vareId = String(input.dataset.vareId || "");
        if (!vareId) return;
        const antall = heltall(input.value);
        if (valgte.has(vareId) || antall > 0) map.set(vareId, { vareId, antall });
      });
    }

    return Array.from(map.values());
  }

  async function loggFyllBilFinal(rad) {
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
      opprettet_av_navn: val("vetInnloggetBrukerNavn") || val("vetInnloggetEpost") || null,
      kommentar: `Fylte ${rad.antall} ${vareNavnTrygg(rad.vare_id)} på ${bilNavnTrygg(rad.bil_id)}`
    };

    const { error } = await supabaseClient.from(LOGG_TABELL).insert(payload);
    if (error) console.warn("Lagerlogg ble ikke lagret:", error.message);
  }

  async function flyttTilBilFinal(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    if (window.__vetFyllBilFinalPagar) return false;
    window.__vetFyllBilFinalPagar = true;

    const knapp = $("flyttTilBilKnapp");
    if (knapp) knapp.disabled = true;

    try {
      melding("billagerMelding", "");

      const kid = klinikkId();
      const bilId = tekst("fyllBilValg");

      if (!kid || !bilId) {
        melding("billagerMelding", "Velg bil først.");
        return false;
      }

      const linjer = hentValgteFyllBilLinjer();

      if (!linjer.length) {
        melding("billagerMelding", "Velg minst én vare og skriv antall.");
        return false;
      }

      for (const linje of linjer) {
        if (!(linje.antall > 0) || !Number.isInteger(linje.antall)) {
          melding("billagerMelding", "Antall må være heltall større enn 0.");
          return false;
        }

        const hoved = arr("vetHovedlager").find(r => String(r.vare_id) === String(linje.vareId));
        const hovedAntall = Number(hoved?.antall || 0);
        if (hovedAntall < linje.antall) {
          melding("billagerMelding", `${vareNavnTrygg(linje.vareId)}: ikke nok på hovedlager. Tilgjengelig: ${Math.round(hovedAntall)}.`);
          return false;
        }
      }

      for (const linje of linjer) {
        const hoved = arr("vetHovedlager").find(r => String(r.vare_id) === String(linje.vareId));
        const hovedAntall = Number(hoved?.antall || 0);
        const bilRad = arr("vetBilLager").find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(linje.vareId));
        const bilFor = Number(bilRad?.antall || 0);
        const bilEtter = bilFor + linje.antall;

        await tryggSettLagerAntallFinal("vet_lager", { klinikk_id: kid, vare_id: linje.vareId }, hovedAntall - linje.antall);
        await tryggSettLagerAntallFinal("vet_bil_lager", { klinikk_id: kid, bil_id: bilId, vare_id: linje.vareId }, bilEtter);

        // Denne loggen bruker samme bilId som ble brukt i vet_bil_lager rett over.
        await loggFyllBilFinal({
          klinikk_id: kid,
          bil_id: bilId,
          vare_id: linje.vareId,
          antall: linje.antall,
          beholdning_for: bilFor,
          beholdning_etter: bilEtter
        });
      }

      melding("billagerMelding", `La ${linjer.length} varelinje(r) på ${bilNavnTrygg(bilId)}.`);
      if (typeof lastVetLagerAlt === "function") await lastVetLagerAlt();
      if (typeof visFyllBilSide === "function") setTimeout(visFyllBilSide, 50);
      if (typeof window.lastVetLagerLogg === "function") setTimeout(window.lastVetLagerLogg, 150);
      return false;

    } catch (err) {
      melding("billagerMelding", "Feil ved fylling av bil: " + (err.message || err));
      return false;
    } finally {
      window.__vetFyllBilFinalPagar = false;
      if (knapp) knapp.disabled = false;
    }
  }

  function kobleFinal() {
    const gamle = alleMedId("flyttTilBilKnapp");
    gamle.forEach(gammel => {
      if (gammel.dataset.lagerloggRiktigBilFinal === "1") return;
      const ny = gammel.cloneNode(true);
      ny.dataset.lagerloggRiktigBilFinal = "1";
      ny.textContent = "Legg valgte varer på valgt bil";
      ny.onclick = flyttTilBilFinal;
      gammel.parentNode.replaceChild(ny, gammel);
    });
  }

  window.flyttTilBil = flyttTilBilFinal;
  window.flyttTilBilMedLogg = flyttTilBilFinal;
  window.vetFlyttTilBilRiktigLoggFinal = flyttTilBilFinal;

  document.addEventListener("DOMContentLoaded", () => setTimeout(kobleFinal, 300));
  window.addEventListener("load", () => setTimeout(kobleFinal, 500));
  setTimeout(kobleFinal, 1000);
  setTimeout(kobleFinal, 2000);
})();
