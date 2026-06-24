/* Rett i Lomma - vis fylleliste på skjerm i stedet for PDF
   Legg denne etter hand-lager-patch.js i index.html.
*/
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function finnKnappMedTekst(tekst) {
    const knapper = Array.from(document.querySelectorAll("button"));
    return knapper.find(b => String(b.textContent || "").trim().toLowerCase() === tekst.toLowerCase());
  }

  function hentValgtBilNavn() {
    const sel = $("bilLagerBilValg") || $("bilSomSkalFylles") || $("bilValg") || document.querySelector("select");
    if (!sel) return "";
    const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
    return opt ? opt.textContent.trim() : "";
  }

  function hentValgteVarerFraFylleliste() {
    const liste = $("bilLagerFyllListe");
    if (!liste) return [];

    const rows = Array.from(liste.querySelectorAll("tbody tr"));
    return rows.map(tr => {
      const cells = Array.from(tr.querySelectorAll("td")).map(td => td.textContent.trim());
      const antallInput = tr.querySelector(".bil-lager-antall-liste");
      const minInput = tr.querySelector(".bil-lager-min-liste");

      const antall = Number(String(antallInput?.value || "0").replace(",", "."));
      const min = Number(String(minInput?.value || "0").replace(",", "."));

      return {
        varenr: cells[0] || "",
        navn: cells[1] || "",
        innpris: cells[2] || "",
        utpris: cells[3] || "",
        hovedlager: cells[4] || "",
        minimum: cells[5] || "",
        mva: cells[6] || "",
        antall: Number.isFinite(antall) ? antall : 0,
        minBil: Number.isFinite(min) ? min : 0
      };
    }).filter(v => v.antall > 0 || v.minBil > 0);
  }

  function visFyllelisteSkjerm() {
    let panel = $("lagerSkjermbildePanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "lagerSkjermbildePanel";
      panel.className = "kort";
      panel.style.marginTop = "16px";

      const plassering =
        $("bilLagerFyllListe") ||
        $("bilerSide") ||
        document.body;

      plassering.after(panel);
    }

    const varer = hentValgteVarerFraFylleliste();
    const bilnavn = hentValgtBilNavn();
    const dato = new Date().toLocaleString("no-NO");

    if (!varer.length) {
      panel.innerHTML = `
        <h3>Fylleliste til lager</h3>
        <p class="melding">Skriv antall på minst én vare først. Da lager jeg skjermbildet her.</p>
      `;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:10px;">
        <div>
          <h3 style="margin:0;">Fylleliste til lager</h3>
          <div class="info">Bil: ${esc(bilnavn || "Ikke valgt")} · ${esc(dato)}</div>
        </div>
        <button type="button" class="secondary" onclick="document.getElementById('lagerSkjermbildePanel').innerHTML=''">Lukk</button>
      </div>

      <div style="overflow:auto; border:1px solid #374151; border-radius:10px;">
        <table class="bil-tabell kompakt-tabell" style="width:100%;">
          <thead>
            <tr>
              <th>Varenr</th>
              <th>Vare</th>
              <th>Antall til bil</th>
              <th>Min. på bil</th>
              <th>Hovedlager</th>
              <th>Utpris</th>
              <th>MVA</th>
            </tr>
          </thead>
          <tbody>
            ${varer.map(v => `
              <tr>
                <td>${esc(v.varenr)}</td>
                <td>${esc(v.navn)}</td>
                <td style="font-weight:bold;">${esc(v.antall)}</td>
                <td>${esc(v.minBil)}</td>
                <td>${esc(v.hovedlager)}</td>
                <td>${esc(v.utpris)}</td>
                <td>${esc(v.mva)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <p class="info" style="margin-top:10px;">
        Dette er skjermbildet som erstatter PDF-visningen. Lager kan lese/plukke direkte fra denne listen.
      </p>
    `;

    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function koblePdfKnappTilSkjerm() {
    const knapp =
      $("sendPdfTilLagerKnapp") ||
      $("sendPdfLagerKnapp") ||
      $("bilLagerPdfKnapp") ||
      finnKnappMedTekst("Send bestilling til admin");

    if (!knapp || knapp.dataset.skjermPatch === "1") return;

    knapp.dataset.skjermPatch = "1";
    knapp.textContent = "Vis fylleliste på skjerm";
    knapp.onclick = function (e) {
      if (e) e.preventDefault();
      visFyllelisteSkjerm();
      return false;
    };
  }

  function init() {
    koblePdfKnappTilSkjerm();
    setTimeout(koblePdfKnappTilSkjerm, 300);
    setTimeout(koblePdfKnappTilSkjerm, 1000);
    setTimeout(koblePdfKnappTilSkjerm, 2000);
  }

  window.handVisFyllelisteSkjerm = visFyllelisteSkjerm;

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("handPartialerLastet", init);
  window.addEventListener("load", init);
})();
