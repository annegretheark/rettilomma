console.log("auth.js innlogget bruker patch aktiv");

function settInnloggetBrukerAuth(email) {
  const el = document.getElementById("innloggetBruker");
  if (el) el.textContent = email ? ("Innlogget: " + email) : "Ikke innlogget";
  if (window.hovSettInnloggetBruker) window.hovSettInnloggetBruker(email || "");
}

console.log("mini auth lastet");

async function loggInn() {

  const epost =
    document.getElementById("loginEpost").value;

  const passord =
    document.getElementById("loginPassord").value;

  const melding =
    document.getElementById("loginMelding");

  melding.textContent = "";

  const res = await supabaseClient.auth.signInWithPassword({
    email: epost,
    password: passord
  });

  if (res.error) {
    console.error(res.error);

    melding.textContent =
      res.error.message;

    return;
  }

  document
    .getElementById("loginSide")
    .classList.add("skjult");

  document
    .getElementById("appSide")
    .classList.remove("skjult");

  settInnloggetBrukerAuth(res.data?.user?.email || epost);

  if (typeof window.hentAktivHovFirmaId === "function") {
    try { await window.hentAktivHovFirmaId(); }
    catch (e) {
      console.error("Kunne ikke opprette/hente hov_firma:", e);
      melding.textContent = "Kunne ikke opprette/hente firma: " + (e.message || e);
      return;
    }
  }

  await hentKunder();
  await hentHester();
  await hentJobber();
}

async function loggUt() {

  await supabaseClient.auth.signOut();

  location.reload();
}

document.addEventListener("DOMContentLoaded", () => {

  const loginKnapp =
    document.getElementById("loginKnapp");

  if (loginKnapp) {
    loginKnapp.addEventListener(
      "click",
      loggInn
    );
  }

  const loggUtKnapp =
    document.getElementById("loggUtKnapp");

  if (loggUtKnapp) {
    loggUtKnapp.addEventListener(
      "click",
      loggUt
    );
  }
});

async function authAutoStartInnloggetBruker() {
  try {
    if (!window.supabaseClient) return;
    const { data } = await window.supabaseClient.auth.getSession();
    if (data && data.session) {
      document.getElementById("loginSide")?.classList.add("skjult");
      document.getElementById("appSide")?.classList.remove("skjult");
      settInnloggetBrukerAuth(data.session.user?.email || "");
      if (typeof window.hentAktivHovFirmaId === "function") {
        try { await window.hentAktivHovFirmaId(); } catch(e) { console.warn(e); }
      }
      if (typeof window.startHovslager === "function") {
        try { await window.startHovslager(); } catch(e) { console.warn(e); }
      }
    } else {
      settInnloggetBrukerAuth("");
    }
  } catch(e) {
    console.warn("Autostart innlogget bruker feilet:", e);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  setTimeout(authAutoStartInnloggetBruker, 300);
  setTimeout(authAutoStartInnloggetBruker, 1200);
});
