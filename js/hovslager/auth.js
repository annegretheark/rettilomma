// Rett i Lomma Hovslager - Magic Link innlogging
// Erstatter passord / glemt passord med Supabase Magic Link.
// Krever at /js/hovslager/config.js lager window.supabaseClient.

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function settMelding(tekst, erOk) {
    const el = $("loginMelding");
    if (!el) return;
    el.textContent = tekst || "";
    el.style.color = erOk ? "#86efac" : "#fca5a5";
  }

  function finnRedirectUrl() {
    // Sender brukeren tilbake til samme hovslager-side etter klikk i e-posten.
    const url = new URL(window.location.href);
    url.hash = "";
    return url.toString();
  }

  function visApp() {
    const loginSide = $("loginSide");
    const appSide = $("appSide");
    if (loginSide) loginSide.classList.add("skjult");
    if (appSide) appSide.classList.remove("skjult");
  }

  function visLogin() {
    const loginSide = $("loginSide");
    const appSide = $("appSide");
    if (appSide) appSide.classList.add("skjult");
    if (loginSide) loginSide.classList.remove("skjult");
  }

  async function startAppEtterLogin(session) {
    const email = session?.user?.email || "";
    try {
      if (window.hovSettInnloggetBruker) window.hovSettInnloggetBruker(email);
    } catch (e) {
      console.warn("Kunne ikke sette innlogget bruker", e);
    }

    try {
      const bruker = $("innloggetBruker");
      if (bruker && email) bruker.textContent = email;
    } catch (e) {}

    visApp();

    try {
      if (window.hentAktivHovFirmaId) await window.hentAktivHovFirmaId();
    } catch (e) {
      const m = $("jobbMelding");
      if (m) m.textContent = "Firmafeil: " + (e.message || e);
      console.warn(e);
    }

    try {
      if (window.startHovslager) await window.startHovslager();
    } catch (e) {
      console.warn("startHovslager feilet", e);
    }

    // Prøv å friske opp hovedlister hvis funksjonene finnes.
    for (const fn of ["hentKunder", "hentHester", "hentJobber", "hentPrislisteTilApp"]) {
      try {
        if (typeof window[fn] === "function") await window[fn]();
      } catch (e) {
        console.warn(fn + " feilet", e);
      }
    }
  }

  async function sendMagicLink() {
    try {
      if (!window.supabaseClient || !window.supabaseClient.auth) {
        settMelding("Supabase er ikke lastet. Sjekk config.js.");
        return;
      }

      const email = ($("loginEpost")?.value || "").trim().toLowerCase();
      if (!email) {
        settMelding("Skriv e-post først.");
        return;
      }

      settMelding("Sender innloggingslenke...");

      const { error } = await window.supabaseClient.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: finnRedirectUrl(),
          shouldCreateUser: false
        }
      });

      if (error) {
        settMelding("Feil: " + error.message);
        return;
      }

      settMelding("Innloggingslenke er sendt. Åpne e-posten og trykk på lenken.", true);
    } catch (e) {
      settMelding("Teknisk feil: " + (e.message || e));
    }
  }

  async function loggUt() {
    try {
      if (window.supabaseClient?.auth) await window.supabaseClient.auth.signOut();
    } catch (e) {
      console.warn("Logout-feil", e);
    }

    try {
      localStorage.removeItem("aktivBilId");
      localStorage.removeItem("aktivBilNavn");
    } catch (e) {}

    visLogin();
    settMelding("");
  }

  function ryddLoginSkjema() {
    // Passordfeltet beholdes ikke i bruk. Vi skjuler det så gammel HTML kan stå urørt.
    const passordLabel = document.querySelector('label[for="loginPassord"]');
    const passordInput = $("loginPassord");
    const glemtKnapp = $("glemtPassordKnapp");
    const loginKnapp = $("loginKnapp");

    if (passordLabel) passordLabel.style.display = "none";
    if (passordInput) passordInput.style.display = "none";

    if (loginKnapp) {
      loginKnapp.textContent = "Send innloggingslenke";
      loginKnapp.onclick = function (ev) {
        ev.preventDefault();
        sendMagicLink();
        return false;
      };
    }

    if (glemtKnapp) {
      glemtKnapp.textContent = "Send innloggingslenke på nytt";
      glemtKnapp.onclick = function (ev) {
        ev.preventDefault();
        sendMagicLink();
        return false;
      };
    }

    const loginSide = $("loginSide");
    if (loginSide && !$("magicLinkInfo")) {
      const info = document.createElement("div");
      info.id = "magicLinkInfo";
      info.className = "info";
      info.textContent = "Skriv e-post og få innloggingslenke. Ingen passord trengs.";
      const melding = $("loginMelding");
      loginSide.insertBefore(info, melding || null);
    }
  }

  async function sjekkSessionOgStart() {
    if (!window.supabaseClient?.auth) return;

    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) {
      console.warn("Kunne ikke lese session", error);
      visLogin();
      return;
    }

    if (data?.session) {
      await startAppEtterLogin(data.session);
    } else {
      visLogin();
    }
  }

  function kobleAlt() {
    ryddLoginSkjema();

    const loggUtKnapp = $("loggUtKnapp");
    if (loggUtKnapp) {
      loggUtKnapp.onclick = function (ev) {
        ev.preventDefault();
        loggUt();
        return false;
      };
    }

    if (window.supabaseClient?.auth) {
      window.supabaseClient.auth.onAuthStateChange(async function (event, session) {
        if (event === "SIGNED_IN" && session) await startAppEtterLogin(session);
        if (event === "SIGNED_OUT") visLogin();
      });
    }

    sjekkSessionOgStart();
  }

  window.hovSendMagicLink = sendMagicLink;
  window.hovMagicLinkLogin = sendMagicLink;
  window.hovLoggUt = loggUt;
  window.loggUt = loggUt;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kobleAlt);
  } else {
    kobleAlt();
  }

  // Litt ekstra lim, fordi index ofte har inline-script som også prøver å koble knappene.
  setTimeout(kobleAlt, 300);
  setTimeout(kobleAlt, 1000);
})();
