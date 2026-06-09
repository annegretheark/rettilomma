/* ===== OPPSETT + NY BIL FINAL GARANTI 09.06 =====
   Lastes HELT sist. Holder Oppsett-knappen og Ny bil-knappen levende selv om eldre moduler overskriver handlers. */
(function () {
  function erAdminNaa() {
    try {
      if (window.vetErSystemAdmin === true) return true;
      const rolle = String(window.vetKlinikkRolle || "").toLowerCase();
      if (["admin", "systemadmin"].includes(rolle)) return true;
      if (typeof window.erKlinikkAdmin === "function" && window.erKlinikkAdmin()) return true;
    } catch (e) {}
    // I verste fall viser vi knappen. Databasen/RLS stopper uansett uautoriserte endringer.
    return true;
  }

  function vis(el, skalVises) {
    if (!el) return;
    el.classList.toggle("skjult", !skalVises);
    el.style.display = skalVises ? "inline-block" : "none";
    el.style.pointerEvents = "auto";
    el.disabled = false;
  }

  function toggleOppsett(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    const meny = document.getElementById("vetOppsettMeny");
    if (!meny) return false;
    const skjult = meny.classList.contains("skjult") || meny.style.display === "none" || getComputedStyle(meny).display === "none";
    meny.classList.toggle("skjult", !skjult);
    meny.style.display = skjult ? "block" : "none";
    return false;
  }

  function sørgForOppsett() {
    const knapp = document.getElementById("vetOppsettKnapp");
    if (!knapp) return;
    vis(knapp, erAdminNaa());
    knapp.type = "button";
    knapp.onclick = toggleOppsett;
    knapp.style.position = "relative";
    knapp.style.zIndex = "999";
  }

  function nullstillBilSkjema() {
    ["vetBilId", "vetBilNavn", "vetBilRegnr", "vetBilVeterinaer"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const msg = document.getElementById("vetBilMelding");
    if (msg) msg.textContent = "Skriv inn ny bil og trykk Lagre bil.";
  }

  function visAdminLager() {
    if (typeof window.visVetSide === "function") window.visVetSide("lagerSide");

    ["minBilOmrade", "bestillingOmrade", "lagerLoggOmrade"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add("skjult");
        el.style.display = "none";
      }
    });

    const admin = document.getElementById("adminLagerOmrade");
    if (admin) {
      admin.classList.remove("skjult");
      admin.style.display = "";
    }
  }

  function åpneNyBil(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    visAdminLager();
    nullstillBilSkjema();
    const navn = document.getElementById("vetBilNavn");
    if (navn) setTimeout(() => navn.focus(), 50);
    const h3 = document.getElementById("vetBilRegistreringOverskrift") || document.getElementById("vetBilNavn")?.closest("div");
    if (h3 && h3.scrollIntoView) setTimeout(() => h3.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    return false;
  }

  function sørgForNyBilKnapp() {
    const lagerSide = document.getElementById("lagerSide");
    if (!lagerSide) return;

    let knapp = document.getElementById("vetNyBilGarantiKnapp");
    if (!knapp) {
      knapp = document.createElement("button");
      knapp.id = "vetNyBilGarantiKnapp";
      knapp.type = "button";
      knapp.textContent = "Ny bil";
      knapp.style.marginBottom = "10px";

      const faner = lagerSide.querySelector(".lager-faner");
      if (faner && faner.parentNode) {
        faner.parentNode.insertBefore(knapp, faner.nextSibling);
      } else {
        lagerSide.insertBefore(knapp, lagerSide.firstChild);
      }
    }

    vis(knapp, erAdminNaa());
    knapp.onclick = åpneNyBil;

    ["nyVetBilToppKnapp", "nyVetBilKnapp", "registrerNyVetBilKnapp"].forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      vis(b, true);
      b.type = "button";
      b.onclick = åpneNyBil;
    });
  }

  async function lagreBilTrygt(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    const msg = document.getElementById("vetBilMelding");
    const tekst = id => String(document.getElementById(id)?.value || "").trim();
    const klinikkId = window.vetAktivKlinikkId || tekst("klinikkId") || (typeof window.hentKlinikkIdForLager === "function" ? window.hentKlinikkIdForLager() : "");

    if (!klinikkId) { if (msg) msg.textContent = "Velg/lagre klinikk før du lager bil."; return false; }
    if (!tekst("vetBilNavn")) { if (msg) msg.textContent = "Skriv bilnavn."; return false; }

    const rad = {
      klinikk_id: klinikkId,
      navn: tekst("vetBilNavn"),
      regnr: tekst("vetBilRegnr") || null,
      veterinaer_navn: tekst("vetBilVeterinaer") || null,
      aktiv: true
    };

    const id = tekst("vetBilId");
    const knapp = document.getElementById("lagreVetBilKnapp");
    if (knapp) knapp.disabled = true;

    try {
      const q = id
        ? supabaseClient.from("vet_biler").update(rad).eq("id", id).select("id").single()
        : supabaseClient.from("vet_biler").insert(rad).select("id").single();
      const { data, error } = await q;
      if (error) throw error;
      if (msg) msg.textContent = "Bil lagret.";
      const lagretId = data?.id || id;
      const idEl = document.getElementById("vetBilId");
      if (idEl) idEl.value = lagretId || "";
      if (typeof window.lastVetLagerAlt === "function") await window.lastVetLagerAlt();
      if (typeof window.tegnVetBiler === "function") window.tegnVetBiler();
      if (typeof window.fyllLagerValg === "function") window.fyllLagerValg();
    } catch (err) {
      if (msg) msg.textContent = "Feil ved lagring av bil: " + (err?.message || err);
    } finally {
      if (knapp) knapp.disabled = false;
    }
    return false;
  }

  function sørgForLagreBil() {
    const knapp = document.getElementById("lagreVetBilKnapp");
    if (!knapp) return;
    vis(knapp, true);
    knapp.type = "button";
    knapp.onclick = lagreBilTrygt;
  }

  function kobleAlt() {
    sørgForOppsett();
    sørgForNyBilKnapp();
    sørgForLagreBil();
  }

  window.toggleVetOppsettMeny = toggleOppsett;
  window.vetÅpneNyBil = åpneNyBil;
  window.vetApneNyBil = åpneNyBil;
  window.nullstillVetBil = function () { nullstillBilSkjema(); visAdminLager(); };
  window.lagreVetBil = lagreBilTrygt;

  document.addEventListener("click", function (e) {
    const t = e.target && e.target.closest ? e.target.closest("#vetOppsettKnapp,#vetNyBilGarantiKnapp,#nyVetBilToppKnapp,#nyVetBilKnapp,#registrerNyVetBilKnapp,#lagreVetBilKnapp") : null;
    if (!t) return;
    if (t.id === "vetOppsettKnapp") return toggleOppsett(e);
    if (t.id === "lagreVetBilKnapp") return lagreBilTrygt(e);
    return åpneNyBil(e);
  }, true);

  document.addEventListener("DOMContentLoaded", kobleAlt);
  window.addEventListener("load", kobleAlt);
  setTimeout(kobleAlt, 100);
  setTimeout(kobleAlt, 500);
  setTimeout(kobleAlt, 1500);
  setInterval(kobleAlt, 2000);
})();
/* ===== SLUTT OPPSETT + NY BIL FINAL GARANTI ===== */
