/* Rett i Lomma - admin ansattvalg på timer 7053
   Viser ansattvalg for admin og setter valgt ansatt rett før lagring.
*/
(function () {
  function hent(id) { return document.getElementById(id); }
  let originalAnsattId = null;
  let originalAnsattNavn = null;
  let originalEpostForTimer = null;

  function finnAnsatte() {
    if (Array.isArray(window.ansatte)) return window.ansatte;
    if (Array.isArray(window.ansattListe)) return window.ansattListe;
    if (Array.isArray(window.alleAnsatte)) return window.alleAnsatte;
    return [];
  }

  function ansattNavn(ansatt) {
    return ansatt.navn || ansatt.name || ansatt.epost || ansatt.email || "Ansatt";
  }

  function ansattEpost(ansatt) {
    return ansatt.epost || ansatt.email || "";
  }

  async function hentAnsatteHvisTomt() {
    const lokale = finnAnsatte();
    if (lokale.length) return lokale;
    if (!window.supabaseClient) return [];

    try {
      const { data, error } = await window.supabaseClient
        .from("ansatte")
        .select("*")
        .order("navn", { ascending: true });
      if (!error && Array.isArray(data)) {
        window.ansatte = data;
        return data;
      }
    } catch (e) {
      console.warn("Kunne ikke hente ansatte til timer-valg:", e);
    }
    return finnAnsatte();
  }

  async function fyllAdminAnsattValg() {
    const select = hent("adminAnsattValg");
    if (!select) return;
    const behold = select.value || "";
    const ansatte = await hentAnsatteHvisTomt();

    select.innerHTML = '<option value="">Meg selv / innlogget bruker</option>';
    ansatte.forEach(function (ansatt) {
      if (!ansatt || !ansatt.id) return;
      const opt = document.createElement("option");
      opt.value = ansatt.id;
      opt.textContent = ansattNavn(ansatt) + (ansattEpost(ansatt) ? " - " + ansattEpost(ansatt) : "");
      opt.dataset.navn = ansattNavn(ansatt);
      opt.dataset.epost = ansattEpost(ansatt);
      select.appendChild(opt);
    });

    if (behold && Array.from(select.options).some(o => o.value === behold)) {
      select.value = behold;
    }
  }

  function visAdminAnsattRadHvisAdmin() {
    const rad = hent("adminAnsattRad");
    if (!rad) return;
    if (window.erAdmin === true) {
      rad.classList.remove("hidden", "skjult", "modul-skjult");
      rad.style.display = "";
      fyllAdminAnsattValg();
    } else {
      rad.classList.add("hidden", "skjult");
      rad.style.display = "none";
    }
  }

  function settValgtAnsattForLagring() {
    if (window.erAdmin !== true) return;
    const select = hent("adminAnsattValg");
    if (!select || !select.value) return;

    if (originalAnsattId === null) originalAnsattId = window.innloggetAnsattId || "";
    if (originalAnsattNavn === null) originalAnsattNavn = window.innloggetAnsattNavn || "";
    if (originalEpostForTimer === null) originalEpostForTimer = window.innloggetEpostForTimer || "";

    const opt = select.options[select.selectedIndex];
    window.adminValgtAnsattId = select.value;
    window.adminValgtAnsattNavn = opt?.dataset?.navn || opt?.textContent || "";
    window.adminValgtAnsattEpost = opt?.dataset?.epost || "";

    // timer.js i denne løsningen bruker globale innloggetAnsatt*-verdier.
    window.innloggetAnsattId = window.adminValgtAnsattId;
    window.innloggetAnsattNavn = window.adminValgtAnsattNavn;
    window.innloggetEpostForTimer = window.adminValgtAnsattEpost;
  }

  function bind() {
    const lagre = hent("lagreTimerKnapp");
    if (lagre && lagre.dataset.adminAnsattBindet !== "1") {
      lagre.dataset.adminAnsattBindet = "1";
      lagre.addEventListener("click", settValgtAnsattForLagring, true);
    }
    if (typeof window.oppdaterAdminVisning === "function") window.oppdaterAdminVisning();
    visAdminAnsattRadHvisAdmin();
  }

  window.fyllAdminAnsattValg = fyllAdminAnsattValg;
  window.visAdminAnsattRadHvisAdmin = visAdminAnsattRadHvisAdmin;
  window.settValgtAnsattForLagring = settValgtAnsattForLagring;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  window.addEventListener("load", function () {
    bind();
    setTimeout(bind, 300);
    setTimeout(bind, 1000);
  });
})();
