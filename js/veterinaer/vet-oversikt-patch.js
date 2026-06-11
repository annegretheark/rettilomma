
/* FIX 2026-06-12: Stabil oversiktstabell etter at appen er lastet */
(function () {
  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function kr(v) {
    const n = Number(v || 0);
    if (typeof window.formaterKr === "function") return window.formaterKr(n) + " kr";
    return n.toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";
  }

  function fakturert(j) {
    if (typeof window.journalErFakturert === "function") return window.journalErFakturert(j);
    return !!(j && (j.fakturert === true || j.fakturanr || j.faktura_id));
  }

  function eierNavn(j) {
    if (typeof window.hentJournalEierNavn === "function") return window.hentJournalEierNavn(j);
    const dyr = (window.vetDyr || []).find(d => String(d.id) === String(j?.dyr_id));
    const eier = (window.vetDyreeiere || []).find(e => String(e.id) === String(dyr?.dyreeier_id || j?.dyreeier_id));
    return eier?.navn || j?.dyreeier_navn || "";
  }

  function dyrNavn(j) {
    if (typeof window.hentJournalDyrNavn === "function") return window.hentJournalDyrNavn(j);
    const dyr = (window.vetDyr || []).find(d => String(d.id) === String(j?.dyr_id));
    return dyr?.navn || j?.dyr_navn || "";
  }

  function finnFakturaFraNr(fakturanr) {
    const nr = String(fakturanr || "").trim();
    if (!nr) return null;
    return (window.vetFakturaer || []).find(f => {
      const fnr = String(f.fakturanr || f.faktura_nr || f.faktura_nummer || "").trim();
      return fnr === nr;
    }) || null;
  }

  window.settVetFakturaBetaltFraOversiktFaktura = async function (fakturanr) {
    const f = finnFakturaFraNr(fakturanr);
    if (!f) {
      alert("Fant ikke fakturaen.");
      return;
    }

    const idag = new Date().toISOString().slice(0, 10);
    const { error } = await supabaseClient
      .from("fakturaer")
      .update({ status: "betalt", betalingsstatus: "betalt", betalt_dato: idag })
      .eq("id", f.id);

    if (error) {
      alert("Kunne ikke sette betalt: " + error.message);
      return;
    }

    if (typeof window.lastVetFakturaer === "function") await window.lastVetFakturaer();
    renderOversiktPatch();
    if (typeof window.tegnAdminMvaOversikt === "function") window.tegnAdminMvaOversikt();
  };

  window.lagVetPurringFraOversiktFaktura = function (fakturanr) {
    const f = finnFakturaFraNr(fakturanr);
    if (!f) {
      alert("Fant ikke fakturaen.");
      return;
    }
    if (typeof window.erKreditnotaFaktura === "function" && window.erKreditnotaFaktura(f)) {
      alert("Du kan ikke lage purring på en kreditnota.");
      return;
    }
    if (typeof window.skrivUtVetPurring === "function") {
      window.skrivUtVetPurring(f);
    } else {
      alert("Purring-funksjonen er ikke lastet.");
    }
  };

  function filtrerteJournaler() {
    let rader = Array.isArray(window.vetJournal) ? [...window.vetJournal] : [];
    const filter = document.getElementById("adminOkonomiFilter")?.value || "alle";
    const fra = document.getElementById("adminOkonomiFraDato")?.value || "";
    const til = document.getElementById("adminOkonomiTilDato")?.value || "";

    if (fra) rader = rader.filter(j => String(j.dato || "").slice(0, 10) >= fra);
    if (til) rader = rader.filter(j => String(j.dato || "").slice(0, 10) <= til);
    if (filter === "fakturert") rader = rader.filter(fakturert);
    if (filter === "ikke_fakturert") rader = rader.filter(j => !fakturert(j));

    return rader;
  }

  function renderOversiktPatch() {
    const summer = document.getElementById("adminOkonomiSummer");
    if (!summer) return;

    document.getElementById("vetOversiktPatchTabell")?.remove();

    const journaler = filtrerteJournaler();
    if (!journaler.length) {
      summer.insertAdjacentHTML("afterend", '<div id="vetOversiktPatchTabell"><p class="lite">Ingen journaler funnet.</p></div>');
      return;
    }

    const rows = journaler.map(j => {
      const erFakturert = fakturert(j);
      const f = finnFakturaFraNr(j.fakturanr);
      const betalt = f && (
        f.betalt === true ||
        String(f.betalingsstatus || "").toLowerCase() === "betalt" ||
        String(f.status || "").toLowerCase() === "betalt"
      );

      let handling = '<span class="lite">Ikke fakturert</span>';
      if (erFakturert && betalt) {
        handling = '<span class="lite">Betalt</span>';
      } else if (erFakturert) {
        handling = `
          <button type="button" class="secondary"
            onclick="settVetFakturaBetaltFraOversiktFaktura('${esc(j.fakturanr || "")}')"
            style="padding:2px 6px;font-size:11px;line-height:1.2;margin-right:3px;">Sett betalt</button>
          <button type="button" class="danger"
            onclick="lagVetPurringFraOversiktFaktura('${esc(j.fakturanr || "")}')"
            style="padding:2px 6px;font-size:11px;line-height:1.2;">Purring</button>
        `;
      }

      return `
        <tr>
          <td>${esc(j.dato || "")}</td>
          <td>${esc(eierNavn(j))}</td>
          <td>${esc(dyrNavn(j))}</td>
          <td>${esc(j.type || "")}</td>
          <td>${erFakturert ? "Fakturert" : '<span class="okonomi-advarsel">Ikke fakturert</span>'}</td>
          <td style="text-align:right;">${kr(j.belop_eks_mva || 0)}</td>
          <td>${esc(j.fakturanr || "")}</td>
          <td style="white-space:nowrap;width:120px;">${handling}</td>
        </tr>
      `;
    }).join("");

    const html = `
      <div id="vetOversiktPatchTabell" style="margin-top:14px;margin-bottom:18px;overflow-x:auto;">
        <table class="okonomi-tabell" style="width:100%;">
          <thead>
            <tr>
              <th>Dato</th>
              <th>Dyreeier</th>
              <th>Dyr</th>
              <th>Type</th>
              <th>Status</th>
              <th style="text-align:right;">Beløp eks. mva</th>
              <th>Fakturanr</th>
              <th style="width:120px;">Handling</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    summer.insertAdjacentHTML("afterend", html);
  }

  window.renderOversiktPatch = renderOversiktPatch;

  const gammelTegn = window.tegnAdminOkonomiOversikt;
  window.tegnAdminOkonomiOversikt = function () {
    if (typeof gammelTegn === "function") gammelTegn.apply(this, arguments);
    setTimeout(renderOversiktPatch, 50);
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("oppdaterAdminOkonomiKnapp")?.addEventListener("click", function () {
      setTimeout(renderOversiktPatch, 100);
    });

    document.getElementById("adminOkonomiFilter")?.addEventListener("change", function () {
      setTimeout(renderOversiktPatch, 100);
    });

    document.getElementById("adminOkonomiFraDato")?.addEventListener("change", function () {
      setTimeout(renderOversiktPatch, 100);
    });

    document.getElementById("adminOkonomiTilDato")?.addEventListener("change", function () {
      setTimeout(renderOversiktPatch, 100);
    });

    setTimeout(renderOversiktPatch, 800);
    setTimeout(renderOversiktPatch, 1800);
  });
})();
