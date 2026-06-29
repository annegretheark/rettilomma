console.log("hov-prisliste.js prisvalg-fix lastet");

// Ekstra sikkerhet: hvis denne filen lastes etter hov-jobber.js, bindes prisvalget på nytt.
function hovPrislisteBindPrisvalg() {
  const felt = document.getElementById("jobbType");
  if (!felt) return;

  if (typeof window.hovBindPrisvalgRobust === "function") {
    window.hovBindPrisvalgRobust();
    return;
  }

  if (typeof window.hovHentOgSettPrisFraJobbtype === "function" && felt.dataset.hovPrislistePrisBind !== "1") {
    felt.dataset.hovPrislistePrisBind = "1";
    felt.addEventListener("change", window.hovHentOgSettPrisFraJobbtype);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", hovPrislisteBindPrisvalg);
} else {
  hovPrislisteBindPrisvalg();
}
setTimeout(hovPrislisteBindPrisvalg, 500);
setTimeout(hovPrislisteBindPrisvalg, 1500);
