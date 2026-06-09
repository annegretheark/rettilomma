/* ===== BILREGISTRERING FIX 09.06 =====
   Gir tydelig Registrer ny bil-knapp, trygg lagring og fjerner doble gamle klikkkoblinger. */
(function () {
  let vetBilLagrer = false;

  function safeText(id) {
    return String(document.getElementById(id)?.value || "").trim();
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? "";
  }

  function msg(text, feil) {
    const el = document.getElementById("vetBilMelding");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = feil ? "#fca5a5" : "#86efac";
  }

  function visKunLagerFane(id) {
    ["minBilOmrade", "adminLagerOmrade", "bestillingOmrade", "lagerLoggOmrade"].forEach(faneId => {
      const el = document.getElementById(faneId);
      if (!el) return;
      el.style.display = faneId === id ? "" : "none";
      el.classList.toggle("skjult", faneId !== id);
    });
  }

  function erAdmin() {
    try {
      if (window.vetErSystemAdmin === true) return true;
      if (typeof window.erKlinikkAdmin === "function" && window.erKlinikkAdmin()) return true;
      const rolle = String(window.vetKlinikkRolle || "").toLowerCase();
      return rolle === "admin" || rolle === "systemadmin";
    } catch (e) {
      return false;
    }
  }

  function vetVisBilRegistrering() {
    if (typeof window.visVetSide === "function") window.visVetSide("lagerSide");

    const adminOmrade = document.getElementById("adminLagerOmrade");
    if (adminOmrade) {
      adminOmrade.classList.remove("skjult");
      visKunLagerFane("adminLagerOmrade");
    }

    const overskrift = document.getElementById("vetBilRegistreringOverskrift");
    if (overskrift) overskrift.scrollIntoView({ behavior: "smooth", block: "start" });

    vetNullstillBilSkjema();
    msg("Skriv inn bilnavn og lagre ny bil.", false);

    const navn = document.getElementById("vetBilNavn");
    if (navn) setTimeout(() => navn.focus(), 50);
  }

  function vetNullstillBilSkjema() {
    ["vetBilId", "vetBilNavn", "vetBilRegnr", "vetBilVeterinaer"].forEach(id => setVal(id, ""));
    msg("", false);
  }

  async function vetLagreBilTrygt(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    if (vetBilLagrer) return false;
    vetBilLagrer = true;

    const knapp = document.getElementById("lagreVetBilKnapp");
    if (knapp) knapp.disabled = true;

    try {
      msg("", false);

      if (!erAdmin()) {
        msg("Kun klinikkadmin/systemadmin kan registrere biler.", true);
        return false;
      }

      const klinikkId = typeof window.hentKlinikkIdForLager === "function"
        ? window.hentKlinikkIdForLager()
        : (window.vetAktivKlinikkId || safeText("klinikkId"));

      if (!klinikkId) {
        msg("Velg eller lagre klinikk før du registrerer bil.", true);
        return false;
      }

      const rad = {
        klinikk_id: klinikkId,
        navn: safeText("vetBilNavn"),
        regnr: safeText("vetBilRegnr") || null,
        veterinaer_navn: safeText("vetBilVeterinaer") || null,
        aktiv: true
      };

      if (!rad.navn) {
        msg("Skriv bilnavn først.", true);
        const navn = document.getElementById("vetBilNavn");
        if (navn) navn.focus();
        return false;
      }

      const id = safeText("vetBilId");
      const query = id
        ? supabaseClient.from("vet_biler").update(rad).eq("id", id).select("id").single()
        : supabaseClient.from("vet_biler").insert(rad).select("id").single();

      const { data, error } = await query;

      if (error) {
        msg("Feil ved lagring av bil: " + error.message, true);
        return false;
      }

      const lagretId = data?.id || id;

      if (typeof window.lastVetLagerAlt === "function") await window.lastVetLagerAlt();
      else if (typeof window.lastVetBiler === "function") await window.lastVetBiler();

      setVal("vetBilId", lagretId || "");
      msg("Bil lagret.", false);

      if (typeof window.tegnVetBiler === "function") window.tegnVetBiler();
      if (typeof window.fyllLagerValg === "function") window.fyllLagerValg();
      if (typeof window.fyllJournalBilValg === "function") window.fyllJournalBilValg();

      return false;
    } catch (err) {
      msg("Feil ved lagring av bil: " + (err?.message || err), true);
      return false;
    } finally {
      vetBilLagrer = false;
      if (knapp) knapp.disabled = false;
    }
  }


  function vetSorgForNyBilKnapp() {
    if (document.getElementById("nyVetBilToppKnapp")) return;
    const overskrift = document.getElementById("vetBilRegistreringOverskrift");
    if (!overskrift || !overskrift.parentNode) return;
    const knapp = document.createElement("button");
    knapp.id = "nyVetBilToppKnapp";
    knapp.type = "button";
    knapp.textContent = "Ny bil";
    knapp.onclick = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      vetVisBilRegistrering();
      return false;
    };
    overskrift.parentNode.insertBefore(knapp, overskrift.nextSibling);
  }

  function vetKobleBilKnapper() {
    vetSorgForNyBilKnapp();
    const nyKnapper = ["nyVetBilToppKnapp", "registrerNyVetBilKnapp", "nyVetBilKnapp"];
    nyKnapper.forEach(id => {
      const knapp = document.getElementById(id);
      if (!knapp) return;
      knapp.type = "button";
      knapp.style.display = "inline-block";
      knapp.disabled = false;
      knapp.onclick = function (e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        }
        vetVisBilRegistrering();
        return false;
      };
    });

    const lagre = document.getElementById("lagreVetBilKnapp");
    if (lagre && lagre.dataset.bilFixKoblet !== "1") {
      const clone = lagre.cloneNode(true);
      clone.dataset.bilFixKoblet = "1";
      clone.onclick = vetLagreBilTrygt;
      lagre.parentNode.replaceChild(clone, lagre);
    } else if (lagre) {
      lagre.onclick = vetLagreBilTrygt;
    }
  }

  const gammelRedigerVetBil = window.redigerVetBil;
  window.redigerVetBil = function (id) {
    if (typeof gammelRedigerVetBil === "function") gammelRedigerVetBil(id);
    if (typeof window.visVetSide === "function") window.visVetSide("lagerSide");
    visKunLagerFane("adminLagerOmrade");
    const overskrift = document.getElementById("vetBilRegistreringOverskrift");
    if (overskrift) overskrift.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  window.vetVisBilRegistrering = vetVisBilRegistrering;
  window.nullstillVetBil = vetNullstillBilSkjema;
  window.lagreVetBil = vetLagreBilTrygt;

  function start() {
    vetKobleBilKnapper();
    setTimeout(vetKobleBilKnapper, 200);
    setTimeout(vetKobleBilKnapper, 800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.addEventListener("load", start);
})();
/* ===== SLUTT BILREGISTRERING FIX 09.06 ===== */
