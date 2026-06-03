// Robust innlogging for håndverker.
// Ligger sist og erstatter gamle/døde click-handlere på login-knappen.
(function () {
  function $(id) { return document.getElementById(id); }

  function melding(tekst) {
    const el = $("loginMelding");
    if (el) el.textContent = tekst || "";
  }

  function normaliserRolle(rolle) {
    return String(rolle || "").trim().toLowerCase();
  }

  async function fallbackLoggInn() {
    melding("");

    const email = $("loginEpost")?.value?.trim()?.toLowerCase() || "";
    const password = $("loginPassord")?.value || "";
    const vilAdmin = $("loginSomAdmin")?.checked === true;

    if (!email || !password) {
      melding("Skriv inn e-post og passord.");
      return;
    }

    if (!window.supabaseClient || !window.supabaseClient.auth) {
      melding("Supabase er ikke lastet. Sjekk js/core/config.js og at internett virker.");
      return;
    }

    melding("Logger inn ...");

    const { error } = await window.supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      melding("Innlogging feilet: " + error.message);
      return;
    }

    window.innloggetEpost = email;
    window.innloggetAnsattId = "";
    window.erAdmin = false;

    let ansattData = null;

    try {
      const { data, error: ansattError } = await window.supabaseClient
        .from("ansatte")
        .select("*")
        .eq("epost", email)
        .limit(1);

      if (ansattError) {
        console.warn("Kunne ikke hente ansattdata:", ansattError);
      }

      if (Array.isArray(data) && data.length) {
        ansattData = data[0];
        window.innloggetAnsattId = ansattData.id || "";
      }
    } catch (e) {
      console.warn("Feil ved henting av ansattdata:", e);
    }

    if (vilAdmin) {
      const rolle = normaliserRolle(ansattData?.rolle);
      window.erAdmin = rolle === "admin" || email === "greknuts@online.no";
    }

    localStorage.setItem("rettilommaSistEpost", email);
    localStorage.setItem("rettilommaValgtModul", "handverker");

    if (typeof window.visApp === "function") {
      await window.visApp();
    } else {
      $("loginSide")?.classList.add("skjult");
      $("appSide")?.classList.remove("skjult");
    }

    if (window.erAdmin === true && typeof window.visAdminKonsollSide === "function") {
      window.visAdminKonsollSide();
    } else if (typeof window.visTimerSide === "function") {
      window.visTimerSide();
    }

    melding("");
  }

  async function robustLoggInn(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    try {
      if (typeof window.loggInn === "function") {
        await window.loggInn();
        return;
      }

      await fallbackLoggInn();
    } catch (e) {
      console.error("Innlogging krasjet, prøver fallback:", e);
      try {
        await fallbackLoggInn();
      } catch (fallbackError) {
        console.error("Fallback-login krasjet:", fallbackError);
        melding("Innlogging krasjet: " + (fallbackError?.message || fallbackError));
      }
    }
  }

  function kobleLoginKnapp() {
    const gammel = $("loginKnapp");
    if (!gammel || gammel.dataset.robustLogin === "true") return;

    const ny = gammel.cloneNode(true);
    ny.dataset.robustLogin = "true";
    ny.onclick = robustLoggInn;
    gammel.parentNode.replaceChild(ny, gammel);
  }

  kobleLoginKnapp();
  window.addEventListener("load", kobleLoginKnapp);
  setTimeout(kobleLoginKnapp, 250);
  setTimeout(kobleLoginKnapp, 1000);
})();
