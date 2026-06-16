console.log("auth.js rolig login aktiv");

let hovAuthStartet = false;
let hovLoginKjorer = false;

function settInnloggetBrukerAuth(email) {
  const el = document.getElementById("innloggetBruker");
  if (el) el.textContent = email ? ("Innlogget: " + email) : "Ikke innlogget";
}

function visLoginMelding(tekst, feil = false) {
  const melding = document.getElementById("loginMelding");
  if (!melding) return;
  melding.textContent = tekst || "";
  melding.style.color = feil ? "#fca5a5" : "#86efac";
}

async function startInnloggetApp(email) {
  if (hovAuthStartet) return;
  hovAuthStartet = true;

  document.getElementById("loginSide")?.classList.add("skjult");
  document.getElementById("appSide")?.classList.remove("skjult");
  settInnloggetBrukerAuth(email || "");

  try { if (typeof window.hentAktivHovFirmaId === "function") await window.hentAktivHovFirmaId(); } catch(e) { console.warn("Firmafeil:", e); }
  try { if (typeof window.startHovslager === "function") await window.startHovslager(); } catch(e) { console.warn("Startfeil:", e); }
  try { if (typeof window.hovOppdaterSystemadminSynlighet === "function") await window.hovOppdaterSystemadminSynlighet(); } catch(e) { console.warn("Adminvisning feilet:", e); }
}

async function loggInn(ev) {
  if (ev) ev.preventDefault();
  if (hovLoginKjorer) return;
  hovLoginKjorer = true;

  const epost = (document.getElementById("loginEpost")?.value || "").trim();
  const passord = document.getElementById("loginPassord")?.value || "";

  try {
    visLoginMelding("Logger inn...");

    if (!epost || !passord) {
      visLoginMelding("Skriv e-post og passord.", true);
      return;
    }

    if (!window.supabaseClient) {
      visLoginMelding("Supabase er ikke lastet. Sjekk config.js.", true);
      return;
    }

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: epost,
      password: passord
    });

    if (error) {
      visLoginMelding("Login-feil: " + error.message, true);
      return;
    }

    visLoginMelding("");
    await startInnloggetApp(data?.user?.email || epost);
  } catch (e) {
    console.error(e);
    visLoginMelding("Teknisk feil: " + (e.message || e), true);
  } finally {
    hovLoginKjorer = false;
  }
}

async function loggUt() {
  try { await window.supabaseClient?.auth?.signOut(); } catch(e) { console.warn(e); }
  hovAuthStartet = false;
  location.reload();
}

async function authAutoStartInnloggetBruker() {
  try {
    if (!window.supabaseClient) return;
    const { data } = await window.supabaseClient.auth.getSession();
    if (data?.session) {
      await startInnloggetApp(data.session.user?.email || "");
    } else {
      settInnloggetBrukerAuth("");
      document.getElementById("loginSide")?.classList.remove("skjult");
      document.getElementById("appSide")?.classList.add("skjult");
    }
  } catch(e) {
    console.warn("Autostart feilet:", e);
  }
}

function kobleAuthKnapper() {
  const loginKnapp = document.getElementById("loginKnapp");
  if (loginKnapp) {
    loginKnapp.onclick = loggInn;
  }

  const loggUtKnapp = document.getElementById("loggUtKnapp");
  if (loggUtKnapp) {
    loggUtKnapp.onclick = loggUt;
  }

  setTimeout(authAutoStartInnloggetBruker, 100);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", kobleAuthKnapper, { once: true });
} else {
  kobleAuthKnapper();
}

window.loggInn = loggInn;
window.loggUt = loggUt;
window.authAutoStartInnloggetBruker = authAutoStartInnloggetBruker;
window.hovSettInnloggetBruker = settInnloggetBrukerAuth;
