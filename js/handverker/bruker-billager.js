/* Rett i Lomma - vanlig bruker kan fylle egen bil 7055
   Admin: full lager/bilregister.
   Vanlig bruker: Lager-meny vises, men Vareregister skjules. Bil-lager låses til aktiv/egen bil.
*/
(function () {
  function hent(id) { return document.getElementById(id); }
  function erAdminModus() {
    return window.erAdmin === true && localStorage.getItem("rilAdminModus") === "ja";
  }
  function aktivBilId() {
    return window.aktivBilId || localStorage.getItem("aktivBilId") || localStorage.getItem("rilAktivBilId") || "";
  }
  function aktivBilNavn() {
    return window.aktivBilNavn || localStorage.getItem("aktivBilNavn") || localStorage.getItem("rilAktivBilNavn") || "";
  }
  function skjul(el) {
    if (!el) return;
    el.classList.add("skjult", "hidden");
    el.style.display = "none";
  }
  function vis(el) {
    if (!el) return;
    el.classList.remove("skjult", "hidden", "modul-skjult");
    el.style.display = "";
  }
  function settTekst(id, tekst) {
    const el = hent(id);
    if (el) el.textContent = tekst;
  }
  function begrensBilValgTilAktivBil() {
    const select = hent("bilLagerBilValg");
    const id = aktivBilId();
    const navn = aktivBilNavn();
    if (!select || !id) return;

    let option = Array.from(select.options || []).find(function (o) {
      return String(o.value) === String(id);
    });

    if (!option) {
      option = document.createElement("option");
      option.value = id;
      option.textContent = navn || "Min bil";
      select.appendChild(option);
    }

    select.value = id;
    select.disabled = true;
    select.dataset.rilLåstTilAktivBil = "1";

    // Noen lagerfunksjoner reagerer på change.
    try { select.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
  }
  function begrensBilLagerForVanligBruker() {
    const admin = erAdminModus();

    // Lagerknappen skal vises for alle.
    const lagerGruppe = hent("lagerMenyKnapp")?.closest(".meny-gruppe");
    vis(lagerGruppe);

    // Vareregister er kun admin. Vanlig bruker skal ikke inn på hovedlager/priser.
    const varerKnapp = hent("varerKnapp");
    if (admin) vis(varerKnapp); else skjul(varerKnapp);

    const visBilerKnapp = hent("visBilerKnapp");
    if (visBilerKnapp) visBilerKnapp.textContent = admin ? "Biler / bil-lager" : "Min bil / fyll lager";

    const bilerSide = hent("bilerSide");
    if (!bilerSide) return;

    if (admin) {
      const select = hent("bilLagerBilValg");
      if (select && select.dataset.rilLåstTilAktivBil === "1") {
        select.disabled = false;
        delete select.dataset.rilLåstTilAktivBil;
      }
      return;
    }

    // Vanlig bruker: skjul oppretting/redigering av biler. De skal bare fylle egen bil.
    settTekst("bilMelding", "Vanlig bruker kan fylle varer på sin egen aktive bil.");
    const h2 = bilerSide.querySelector("h2");
    if (h2) h2.textContent = "Min bil / lager";

    ["bilNavn", "bilRegnr", "lagreBilKnapp", "bilListe"].forEach(function (id) {
      const el = hent(id);
      if (!el) return;
      const blokk = el.closest(".rad") || el;
      skjul(blokk);
    });

    const tilbake = hent("tilbakeFraBilerKnapp");
    if (tilbake) tilbake.textContent = "Tilbake til timer";

    begrensBilValgTilAktivBil();

    if (!aktivBilId()) {
      settTekst("bilMelding", "Du må først velge aktiv bil på timersiden før du kan fylle bil-lager.");
    }
  }

  window.begrensBilLagerForVanligBruker = begrensBilLagerForVanligBruker;

  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "bilLagerBilValg" && !erAdminModus()) {
      setTimeout(begrensBilValgTilAktivBil, 0);
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begrensBilLagerForVanligBruker);
  } else {
    begrensBilLagerForVanligBruker();
  }
  window.addEventListener("load", function () {
    setTimeout(begrensBilLagerForVanligBruker, 100);
    setTimeout(begrensBilLagerForVanligBruker, 700);
  });
})();
