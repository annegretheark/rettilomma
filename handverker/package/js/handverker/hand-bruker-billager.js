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
    try {
      const fraTimer = hent("bilValg") && hent("bilValg").value ? hent("bilValg").value : "";
      if (fraTimer) return fraTimer;

      const lagret = window.aktivBilId || localStorage.getItem("aktivBilId") || localStorage.getItem("rilAktivBilId") || "";
      if (lagret) return lagret;

      const ansatte = Array.isArray(window.ansatte) ? window.ansatte : [];
      const epost = String(window.innloggetEpost || "").toLowerCase();
      const ansattId = String(window.innloggetAnsattId || "");
      const ansatt = ansatte.find(function (a) {
        return (ansattId && String(a.id || "") === ansattId) ||
          (epost && String(a.epost || "").toLowerCase() === epost);
      });
      if (ansatt && ansatt.standard_bil_id) return String(ansatt.standard_bil_id);

      const biler = Array.isArray(window.biler) ? window.biler.filter(function (b) { return b.aktiv !== false; }) : [];
      if (biler.length === 1 && biler[0].id) return String(biler[0].id);
    } catch (e) {
      console.warn("Kunne ikke finne aktiv bil for bruker:", e);
    }
    return "";
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
    if (!select) return;

    let id = aktivBilId();
    const navn = aktivBilNavn();

    // Hvis bruker ikke har aktiv/standard bil ennå, men listen har bare én bil,
    // velg den automatisk. Hvis listen har flere biler, la brukeren velge i listen.
    if (!id) {
      const valg = Array.from(select.options || []).filter(function (o) { return String(o.value || "").trim() !== ""; });
      if (valg.length === 1) id = String(valg[0].value || "");
    }

    if (!id) {
      select.disabled = false;
      delete select.dataset.rilLåstTilAktivBil;
      return;
    }

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
    window.aktivBilId = id;
    localStorage.setItem("aktivBilId", id);
    if (option && option.textContent) {
      window.aktivBilNavn = option.textContent;
      localStorage.setItem("aktivBilNavn", option.textContent);
    }
  }

  function styrImportForRolle() {
    const admin = erAdminModus();

    // Import til hovedlager skal bare vises for admin.
    // Vanlig bruker skal kun fylle sin egen bil fra eksisterende vareliste.
    [
      "patchImportLagerWrap",
      "importBilLagerFil",
      "importBilLagerKnapp",
      "hentFyllelisteFraDbKnapp",
      "importBilLagerMelding"
    ].forEach(function (id) {
      const el = hent(id);
      if (!el) return;
      const blokk = id === "patchImportLagerWrap" ? el : (el.closest("#patchImportLagerWrap") || el.parentElement || el);
      if (admin) vis(blokk); else skjul(blokk);
    });

    // Hvis wrapperen ikke finnes, finn importseksjonen via knappen og skjul nærmeste blokk.
    const importKnapp = hent("importBilLagerKnapp");
    if (importKnapp && !admin) {
      const blokk = importKnapp.closest("#patchImportLagerWrap") || importKnapp.closest("div") || importKnapp.parentElement;
      skjul(blokk);
    }
  }

  function begrensBilLagerForVanligBruker() {
    const admin = erAdminModus();
    styrImportForRolle();

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

    // Hvem som henter settes automatisk til innlogget bruker, også for admin.
    const henterFelt = hent("bilLagerHentetAv");
    if (henterFelt) {
      henterFelt.value = window.innloggetEpost || "";
      const egenDiv = henterFelt.parentElement;
      skjul(egenDiv);
    }

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

    // Hvem som henter skal ikke velges manuelt. Det settes automatisk til innlogget bruker i hand-biler.js.
    const henter = hent("bilLagerHentetAv");
    if (henter) {
      henter.value = window.innloggetEpost || "";
      const blokk = henter.closest(".rad") || henter.parentElement;
      // skjul bare selve input-blokken hvis den ligger sammen med bilvalg i samme rad
      const egenDiv = henter.parentElement;
      skjul(egenDiv);
    }

    // Skjul hele registrering/redigering av bil for vanlig bruker.
    // Vanlig bruker skal bare fylle varer på valgt/standard bil.
    ["nyBilKnapp", "bilSkjemaOmrade", "bilListe"].forEach(function (id) {
      skjul(hent(id));
    });

    // Ekstra sikring hvis gammel HTML/fix viser enkeltfelter likevel.
    ["bilNavn", "bilRegnr", "lagreBilKnapp", "bilId"].forEach(function (id) {
      const el = hent(id);
      if (!el) return;
      const blokk = el.closest("#bilSkjemaOmrade") || el.closest(".rad") || el;
      skjul(blokk);
    });

    const tilbake = hent("tilbakeFraBilerKnapp");
    if (tilbake) tilbake.textContent = "Tilbake til timer";

    begrensBilValgTilAktivBil();

    const select = hent("bilLagerBilValg");
    if (!aktivBilId() && select && !select.value) {
      settTekst("bilMelding", "Velg bil i listen for å fylle bil-lager.");
    }
  }

  window.begrensBilLagerForVanligBruker = begrensBilLagerForVanligBruker;

  try {
    const obs = new MutationObserver(function () { styrImportForRolle(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "bilLagerBilValg" && !erAdminModus()) {
      const select = event.target;
      if (select.value) {
        window.aktivBilId = select.value;
        localStorage.setItem("aktivBilId", select.value);
        const valgt = select.options[select.selectedIndex];
        if (valgt) {
          window.aktivBilNavn = valgt.textContent || "";
          localStorage.setItem("aktivBilNavn", valgt.textContent || "");
        }
        setTimeout(begrensBilValgTilAktivBil, 0);
        if (typeof window.tegnFyllBilListe === "function") setTimeout(window.tegnFyllBilListe, 20);
      }
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
    setTimeout(begrensBilLagerForVanligBruker, 1500);
    setTimeout(begrensBilLagerForVanligBruker, 2500);
  });
})();
