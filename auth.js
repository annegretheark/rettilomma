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