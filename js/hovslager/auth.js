// Rett i Lomma Hovslager - vanlig login + Magic Link-knapp
// Bruker e-post/passord som hovedinnlogging, og Magic Link som ekstra knapp.
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
    // Magic Link sender tilbake til samme side brukeren startet fra.
    const url = new URL(window.location.href);
    url.hash = "";
    return url.toString();
  }

  function visApp() {
    const loginSide = $("loginSide");
    const appSide = $("appSide");
    if (loginSide) loginSide.classList.add("skjult");
    if (appSide) appSide.classList.remove("skjult");
    document.body.classList.add("hov-innlogget");
    const snakk = $("snakkBeskrivelseKnapp");
    if (snakk) snakk.classList.remove("skjult");
  }

  function visLogin() {
    const loginSide = $("loginSide");
    const appSide = $("appSide");
    if (appSide) appSide.classList.add("skjult");
    if (loginSide) loginSide.classList.remove("skjult");
    document.body.classList.remove("hov-innlogget");
    const snakk = $("snakkBeskrivelseKnapp");
    if (snakk) snakk.classList.add("skjult");
  }


  async function startGreknutsLokalt(email) {
    // Nødfiks for lokal installasjon: lar systemadmin åpne appen selv om Supabase
    // avviser passordet/økten. Nyttig når Auth-brukeren mangler eller passordet er ute av sync.
    try {
      window.__hovGreknutsLokalAdmin = true;
      window.__hovInnloggetEpost = email || "greknuts@online.no";
      localStorage.setItem("hov_lokal_admin_epost", window.__hovInnloggetEpost);
    } catch (e) {}

    try {
      if (window.hovSettInnloggetBruker) window.hovSettInnloggetBruker(window.__hovInnloggetEpost);
    } catch (e) {}

    try {
      const bruker = $("innloggetBruker");
      if (bruker) bruker.textContent = "Innlogget: " + window.__hovInnloggetEpost;
    } catch (e) {}

    visApp();
    settMelding("Innlogget lokalt som systemadmin.", true);

    try { if (window.hovOppdaterSystemadminSynlighet) await window.hovOppdaterSystemadminSynlighet(); } catch(e) {}
    try { if (window.startHovslager) await window.startHovslager(); } catch(e) { console.warn("startHovslager feilet", e); }
    for (const fn of ["hentKunder", "hentHester", "hentJobber", "hentPrislisteTilApp", "hovLastHovKundeliste"]) {
      try { if (typeof window[fn] === "function") await window[fn](); } catch(e) { console.warn(fn + " feilet", e); }
    }
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

    for (const fn of ["hentKunder", "hentHester", "hentJobber", "hentPrislisteTilApp"]) {
      try {
        if (typeof window[fn] === "function") await window[fn]();
      } catch (e) {
        console.warn(fn + " feilet", e);
      }
    }
  }

  async function vanligLogin() {
    try {
      if (!window.supabaseClient || !window.supabaseClient.auth) {
        settMelding("Supabase er ikke lastet. Sjekk config.js.");
        return;
      }

      const email = ($("loginEpost")?.value || "").trim().toLowerCase();
      const password = ($("loginPassord")?.value || "").trim();

      if (!email) {
        settMelding("Skriv e-post.");
        return;
      }
      if (!password) {
        settMelding("Skriv passord, eller bruk Magic Link-knappen.");
        return;
      }

      settMelding("Logger inn...");

      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        const msg = error.message || "Ukjent feil";
        if (email === "greknuts@online.no") {
          console.warn("Supabase avviste greknuts-login, starter lokal systemadmin-fallback:", msg);
          await startGreknutsLokalt(email);
          return;
        }
        if (/invalid login credentials/i.test(msg)) {
          settMelding("Feil e-post eller passord for " + email + ". Prøv riktig passord, eller bruk Send Magic Link.");
        } else {
          settMelding("Innlogging feilet: " + msg);
        }
        return;
      }

      settMelding("Innlogget.", true);
      await startAppEtterLogin(data.session);
    } catch (e) {
      settMelding("Teknisk feil ved innlogging: " + (e.message || e));
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

      settMelding("Sender Magic Link...");

      const { error } = await window.supabaseClient.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin + "/reset.html",
          shouldCreateUser: false
        }
      });

      if (error) {
        settMelding("Feil ved Magic Link: " + error.message);
        return;
      }

      settMelding("Magic Link er sendt. Åpne e-posten og trykk på lenken. Du kommer til siden for å sette nytt passord.", true);
    } catch (e) {
      settMelding("Teknisk feil ved Magic Link: " + (e.message || e));
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
      localStorage.removeItem("hov_lokal_admin_epost");
      window.__hovGreknutsLokalAdmin = false;
    } catch (e) {}

    visLogin();
    settMelding("");
  }

  function lagMagicLinkKnappHvisMangler() {
    if ($("magicLinkKnapp")) return;

    const loginKnapp = $("loginKnapp");
    const glemtKnapp = $("glemtPassordKnapp");
    const parent = (glemtKnapp && glemtKnapp.parentElement) || (loginKnapp && loginKnapp.parentElement);
    if (!parent) return;

    const knapp = document.createElement("button");
    knapp.type = "button";
    knapp.id = "magicLinkKnapp";
    knapp.textContent = "Send Magic Link";
    knapp.className = glemtKnapp?.className || loginKnapp?.className || "";
    knapp.style.marginLeft = "0.5rem";

    if (glemtKnapp) {
      glemtKnapp.insertAdjacentElement("afterend", knapp);
    } else if (loginKnapp) {
      loginKnapp.insertAdjacentElement("afterend", knapp);
    } else {
      parent.appendChild(knapp);
    }
  }

  function kobleLoginSkjema() {
    // Behold vanlig passordfelt synlig.
    const passordLabel = document.querySelector('label[for="loginPassord"]');
    const passordInput = $("loginPassord");
    if (passordLabel) passordLabel.style.display = "";
    if (passordInput) passordInput.style.display = "";

    const loginKnapp = $("loginKnapp");
    if (loginKnapp) {
      loginKnapp.textContent = "Logg inn";
      loginKnapp.onclick = function (ev) {
        ev.preventDefault();
        vanligLogin();
        return false;
      };
      if (!loginKnapp.dataset.hovLoginListener) {
        loginKnapp.dataset.hovLoginListener = "1";
        loginKnapp.addEventListener("click", function(ev){ ev.preventDefault(); vanligLogin(); return false; });
      }
    }

    // Hvis gammel "glemt passord"-knapp finnes, bruker vi den som Magic Link-knapp.
    const glemtKnapp = $("glemtPassordKnapp");
    if (glemtKnapp) {
      glemtKnapp.textContent = "Send Magic Link";
      glemtKnapp.style.display = "";
      glemtKnapp.onclick = function (ev) {
        ev.preventDefault();
        sendMagicLink();
        return false;
      };
    } else {
      lagMagicLinkKnappHvisMangler();
    }

    const magicKnapp = $("magicLinkKnapp");
    if (magicKnapp) {
      magicKnapp.onclick = function (ev) {
        ev.preventDefault();
        sendMagicLink();
        return false;
      };
    }

    const passord = $("loginPassord");
    if (passord) {
      passord.onkeydown = function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          vanligLogin();
          return false;
        }
      };
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
    kobleLoginSkjema();

    const loggUtKnapp = $("loggUtKnapp");
    if (loggUtKnapp) {
      loggUtKnapp.onclick = function (ev) {
        ev.preventDefault();
        loggUt();
        return false;
      };
    }

    if (window.supabaseClient?.auth && !window.__hovAuthListenerKoblet) {
      window.__hovAuthListenerKoblet = true;
      window.supabaseClient.auth.onAuthStateChange(async function (event, session) {
        if (event === "SIGNED_IN" && session) await startAppEtterLogin(session);
        if (event === "SIGNED_OUT") visLogin();
      });
    }

    sjekkSessionOgStart();
  }

  window.hovVanligLogin = vanligLogin;
  window.hovLogin = vanligLogin;
  window.hovSendMagicLink = sendMagicLink;
  window.hovMagicLinkLogin = sendMagicLink;
  window.hovLoggUt = loggUt;
  window.loggUt = loggUt;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kobleAlt);
  } else {
    kobleAlt();
  }

  // Ekstra lim mot inline-script i index.html.
  setTimeout(kobleAlt, 300);
  setTimeout(kobleAlt, 1000);
})();
