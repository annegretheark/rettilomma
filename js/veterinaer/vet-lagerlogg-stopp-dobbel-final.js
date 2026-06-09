/* ===== FINAL FIX: STOPP DOBBEL LAGERLOGG + RIKTIG BRUKERNAVN =====
   Legg denne HELT SIST i index.html, etter alle andre veterinær-JS-filer.

   Den gjør to ting:
   1) Hindrer at flere gamle logg-filer lager dobbeltlinjer for samme vare/bil/antall.
   2) Setter brukernavn pent, så greknuts@online.no vises som Anne Grethe i stedet for Systemadmin/Ukjent.
*/
(function () {
  if (window.__vetLagerloggStoppDobbelFinalInstallert) return;
  window.__vetLagerloggStoppDobbelFinalInstallert = true;

  const LOGG_TABELL = "vet_lager_logg";
  const settInnCache = new Map();

  function finnBrukerNavn(payload) {
    const epost = String(
      payload?.opprettet_av_epost ||
      window.vetInnloggetEpost ||
      ""
    ).toLowerCase();

    const navn = String(
      payload?.opprettet_av_navn ||
      window.vetInnloggetBrukerNavn ||
      ""
    ).trim();

    if (epost === "greknuts@online.no") return "Anne Grethe";

    if (navn && navn.toLowerCase() !== "systemadmin" && navn.toLowerCase() !== "ukjent") {
      return navn;
    }

    if (window.vetInnloggetBrukerNavn &&
        String(window.vetInnloggetBrukerNavn).toLowerCase() !== "systemadmin") {
      return window.vetInnloggetBrukerNavn;
    }

    return epost || "Ukjent";
  }

  function normaliserPayload(rad) {
    if (!rad || typeof rad !== "object") return rad;

    const ny = { ...rad };

    ny.opprettet_av_epost =
      ny.opprettet_av_epost ||
      window.vetInnloggetEpost ||
      null;

    ny.opprettet_av_navn = finnBrukerNavn(ny);

    ny.opprettet_av =
      ny.opprettet_av ||
      window.vetInnloggetKlinikkBrukerId ||
      window.vetInnloggetAuthUserId ||
      null;

    return ny;
  }

  function nøkkel(rad) {
    const tid = Math.floor(Date.now() / 6000); // samme vare/bil innen 6 sek = dublett
    return [
      tid,
      rad?.klinikk_id || "",
      rad?.bil_id || "",
      rad?.vare_id || "",
      Number(rad?.antall || 0),
      rad?.type || "",
      rad?.retning || ""
    ].join("|");
  }

  function erDublettOgRegistrer(rad) {
    const key = nøkkel(rad);
    const nå = Date.now();

    for (const [k, t] of settInnCache.entries()) {
      if (nå - t > 12000) settInnCache.delete(k);
    }

    if (settInnCache.has(key)) {
      console.warn("Stoppet dobbel lagerlogg:", key);
      return true;
    }

    settInnCache.set(key, nå);
    return false;
  }

  function installerSupabaseFilter() {
    if (!window.supabaseClient || window.supabaseClient.__vetLagerloggStoppDobbelFinal) return false;

    const originalFrom = window.supabaseClient.from.bind(window.supabaseClient);

    window.supabaseClient.from = function (tabell) {
      const query = originalFrom(tabell);

      if (String(tabell) !== LOGG_TABELL || !query || query.__vetLagerloggInsertPatched) {
        return query;
      }

      const originalInsert = query.insert.bind(query);

      query.insert = function (values, options) {
        let nyeVerdier = values;

        if (Array.isArray(values)) {
          const filtrert = [];
          values.forEach(rad => {
            const ny = normaliserPayload(rad);
            if (!erDublettOgRegistrer(ny)) filtrert.push(ny);
          });

          if (!filtrert.length) {
            return Promise.resolve({ data: null, error: null, status: 204, statusText: "Duplicate lagerlogg ignored" });
          }

          nyeVerdier = filtrert;
        } else {
          const ny = normaliserPayload(values);

          if (erDublettOgRegistrer(ny)) {
            return Promise.resolve({ data: null, error: null, status: 204, statusText: "Duplicate lagerlogg ignored" });
          }

          nyeVerdier = ny;
        }

        return originalInsert(nyeVerdier, options);
      };

      query.__vetLagerloggInsertPatched = true;
      return query;
    };

    window.supabaseClient.__vetLagerloggStoppDobbelFinal = true;
    console.log("Lagerlogg dobbeltfilter aktivt.");
    return true;
  }

  function patchVisningsNavn() {
    // Sørger for at videre kode i samme sesjon ikke bruker Systemadmin som visningsnavn.
    const epost = String(window.vetInnloggetEpost || "").toLowerCase();
    if (epost === "greknuts@online.no" &&
        String(window.vetInnloggetBrukerNavn || "").toLowerCase() === "systemadmin") {
      try { window.vetInnloggetBrukerNavn = "Anne Grethe"; } catch (e) {}
      try { vetInnloggetBrukerNavn = "Anne Grethe"; } catch (e) {}
    }
  }

  function installer() {
    patchVisningsNavn();
    if (!installerSupabaseFilter()) {
      setTimeout(installer, 300);
    }
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(installer, 100));
  window.addEventListener("load", () => setTimeout(installer, 100));
  setTimeout(installer, 300);
  setTimeout(installer, 1000);
})();
