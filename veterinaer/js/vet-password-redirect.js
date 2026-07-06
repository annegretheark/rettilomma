// Veterinær passord-reset redirect.
// Denne filen skal hindre at Supabase Magic Link havner i veterinær-modulen.
(function () {
  function vetResetUrl() {
    const origin = window.location.origin;
    const path = window.location.pathname;

    // Finn base før /veterinaer/. Eksempel:
    // /rettilomma/veterinaer/veterinaer-login.html -> /rettilomma
    const marker = "/veterinaer/";
    let base = "";
    const i = path.indexOf(marker);
    if (i >= 0) {
      base = path.slice(0, i);
    } else {
      // Fallback for lokal filstruktur der siden ligger direkte i /veterinaer
      base = path.replace(/\/[^\/]*$/, "");
      if (base.endsWith("/veterinaer")) base = base.slice(0, -"/veterinaer".length);
    }

    return origin + base + "/veterinaer/veterinaer-nytt-passord.html";
  }

  window.VET_PASSWORD_REDIRECT_URL = vetResetUrl();

  window.vetResetPasswordForEmail = async function (supabaseClient, email) {
    return await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.VET_PASSWORD_REDIRECT_URL
    });
  };

  // Hvis en gammel Supabase-lenke likevel åpner veterinaer/veterinaer-nytt-passord.html,
  // send brukeren direkte videre til veterinær sin passordside og behold token/hash.
  if (window.location.pathname.includes("/veterinaer/veterinaer-nytt-passord.html")) {
    window.location.replace(window.VET_PASSWORD_REDIRECT_URL + window.location.hash);
  }
})();
