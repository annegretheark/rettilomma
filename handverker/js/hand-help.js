(function () {
  "use strict";

  function openHelp() {
    var existing = document.getElementById("handHelpModal");
    if (existing) {
      existing.classList.remove("skjult");
      return;
    }

    var modal = document.createElement("div");
    modal.id = "handHelpModal";
    modal.className = "hand-help-modal";
    modal.innerHTML =
      '<div class="hand-help-box" role="dialog" aria-modal="true" aria-labelledby="handHelpTitle">' +
      '<button type="button" class="hand-help-close" id="handHelpClose" aria-label="Lukk hjelp">&times;</button>' +
      '<h2 id="handHelpTitle">Hjelp</h2>' +
      '<p>Her finner du brukerdokumentasjon og raske tips for innlogging og bruk av appen.</p>' +
      '<div class="hand-help-actions">' +
      '<a class="hand-help-primary" href="brukerdokumentasjon.html" target="_blank" rel="noopener">Åpne brukerdokumentasjon</a>' +
      '<a class="hand-help-secondary" href="mailto:support@rettilomma.com?subject=Hjelp%20med%20H%C3%A5ndverkerappen">Kontakt support</a>' +
      '</div>' +
      '<h3>Vanlige steg</h3>' +
      '<ul>' +
      '<li>Sjekk at e-post og passord er skrevet riktig.</li>' +
      '<li>Bruk “Glemt passord” hvis du ikke kommer inn.</li>' +
      '<li>Kontakt administrator hvis du mangler tilgang til en modul.</li>' +
      '</ul>' +
      '</div>';

    document.body.appendChild(modal);
    document.getElementById("handHelpClose").addEventListener("click", function () {
      modal.classList.add("skjult");
    });
    modal.addEventListener("click", function (event) {
      if (event.target === modal) modal.classList.add("skjult");
    });
  }

  function addFloatingHelp() {
    if (document.getElementById("handHelpButton")) return;
    var btn = document.createElement("button");
    btn.id = "handHelpButton";
    btn.type = "button";
    btn.className = "hand-help-button";
    btn.textContent = "?";
    btn.title = "Hjelp";
    btn.setAttribute("aria-label", "Åpne hjelp");
    btn.addEventListener("click", openHelp);
    document.body.appendChild(btn);
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-open-help]");
    if (!trigger) return;
    event.preventDefault();
    openHelp();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addFloatingHelp);
  } else {
    addFloatingHelp();
  }

  window.handOpenHelp = openHelp;
})();
