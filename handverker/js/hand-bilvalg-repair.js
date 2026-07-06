/* Rett i Lomma - trygg reparasjon av bilvalg 7059
   Rører ikke login/design. Sørger for at bilvalg på timer og bilregister ikke blir skjult/dødt.
*/
(function () {
  function el(id) { return document.getElementById(id); }

  function visBilfeltPaTimer() {
    const bilValg = el("bilValg");
    if (!bilValg) return;

    const rad = bilValg.closest(".rad") || bilValg.parentElement;
    if (rad) {
      rad.classList.remove("hidden", "skjult", "modul-skjult");
      rad.style.display = "";
    }

    ["bilValg", "aktivBilInfo", "byttBilKnapp"].forEach(function (id) {
      const node = el(id);
      if (!node) return;
      node.classList.remove("hidden", "skjult", "modul-skjult");
      node.style.display = "";
      node.disabled = false;
    });
  }

  async function kallHvisFinnes(navn) {
    try {
      if (typeof window[navn] === "function") {
        return await window[navn]();
      }
    } catch (e) {
      console.warn("Bilvalg: funksjon feilet", navn, e);
    }
  }

  async function fyllBilvalgTrygt() {
    visBilfeltPaTimer();

    // Prøv de funksjonsnavnene som har vært brukt i bilmodulen.
    await kallHvisFinnes("lastBiler");
    await kallHvisFinnes("hentBiler");
    await kallHvisFinnes("fyllBilValg");
    await kallHvisFinnes("fyllBiler");
    await kallHvisFinnes("lastBilValg");
    await kallHvisFinnes("lastBilerTilValg");
    await kallHvisFinnes("fyllAnsattStandardBil");
    await kallHvisFinnes("fyllAnsattStandardBilValg");
    await kallHvisFinnes("fyllBilLagerBilValg");

    const bilValg = el("bilValg");
    const aktivBilId = localStorage.getItem("aktivBilId") || "";
    if (bilValg && aktivBilId) {
      const finnes = Array.from(bilValg.options || []).some(function (o) { return o.value === aktivBilId; });
      if (finnes) bilValg.value = aktivBilId;
    }
  }

  function bindByttBil() {
    const knapp = el("byttBilKnapp");
    const bilValg = el("bilValg");
    if (!knapp || knapp.dataset.rilBilRepair === "1") return;
    knapp.dataset.rilBilRepair = "1";
    knapp.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      visBilfeltPaTimer();
      if (bilValg) {
        bilValg.disabled = false;
        bilValg.focus();
      }
      fyllBilvalgTrygt();
    });
  }

  function bindLagreAktivBil() {
    const bilValg = el("bilValg");
    if (!bilValg || bilValg.dataset.rilBilRepair === "1") return;
    bilValg.dataset.rilBilRepair = "1";
    bilValg.addEventListener("change", function () {
      const valgt = bilValg.options[bilValg.selectedIndex];
      if (bilValg.value) {
        localStorage.setItem("aktivBilId", bilValg.value);
        localStorage.setItem("aktivBilNavn", valgt ? valgt.textContent : "");
      }
      const info = el("aktivBilInfo");
      if (info && valgt && bilValg.value) info.textContent = "Aktiv bil: " + valgt.textContent;
    });
  }

  async function reparerBilvalg() {
    visBilfeltPaTimer();
    bindByttBil();
    bindLagreAktivBil();
    await fyllBilvalgTrygt();
  }

  window.reparerBilvalg = reparerBilvalg;
  window.fyllBilvalgTrygt = fyllBilvalgTrygt;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reparerBilvalg);
  } else {
    reparerBilvalg();
  }

  window.addEventListener("load", function () {
    reparerBilvalg();
    setTimeout(reparerBilvalg, 300);
    setTimeout(reparerBilvalg, 1000);
  });
})();
