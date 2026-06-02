console.log("hov-fakturaoversikt.js lastet");

let sisteHovFakturaOversikt = [];
let hovFakturaFilter = "alle";
let hovFakturaSok = "";

function oversiktKr(n) {
  return Number(n || 0).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function safeText(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normaliserStatus(f) {
  if (f.kreditert) return "kreditert";
  return (f.betalingsstatus || "ubetalt").toLowerCase();
}

function beregnUtestaende(f) {
  const inkl = Number(f.inkl_mva || 0);
  const betalt = Number(f.betalt_belop || 0);
  const status = normaliserStatus(f);

  if (status === "betalt" || status === "kreditert") {
    return 0;
  }

  return Math.max(inkl - betalt, 0);
}

function hentFiltrerteFakturaer() {
  let rader = [...sisteHovFakturaOversikt];

  if (hovFakturaFilter !== "alle") {
    rader = rader.filter(f => normaliserStatus(f) === hovFakturaFilter);
  }

  const sok = hovFakturaSok.trim().toLowerCase();

  if (sok) {
    rader = rader.filter(f => {
      const kunde = (f.kunder?.navn || f.kunde_navn || "").toLowerCase();
      const fakturanr = String(f.fakturanr || "").toLowerCase();
      const dato = String(f.dato || "").toLowerCase();
      const status = normaliserStatus(f).toLowerCase();

      return (
        kunde.includes(sok) ||
        fakturanr.includes(sok) ||
        dato.includes(sok) ||
        status.includes(sok)
      );
    });
  }

  return rader;
}

function tegnFakturaOversikt() {
  const div = document.getElementById("fakturaOversikt");
  if (!div) return;

  const rader = hentFiltrerteFakturaer();

  const sumEks = rader.reduce((s, f) => s + Number(f.eks_mva || 0), 0);
  const sumMva = rader.reduce((s, f) => s + Number(f.mva || 0), 0);
  const sumInkl = rader.reduce((s, f) => s + Number(f.inkl_mva || 0), 0);
  const sumBetalt = rader.reduce((s, f) => s + Number(f.betalt_belop || 0), 0);
  const sumUtestaende = rader.reduce((s, f) => s + beregnUtestaende(f), 0);

  const filterKnapp = (verdi, tekst) => `
    <button
      type="button"
      onclick="settHovFakturaFilter('${verdi}')"
      class="${hovFakturaFilter === verdi ? "" : "secondary"}">
      ${tekst}
    </button>
  `;

  const tabellRader = rader.map(f => {
    const status = normaliserStatus(f);
    const kunde = f.kunder?.navn || f.kunde_navn || "";
    const inkl = Number(f.inkl_mva || 0);
    const betalt = Number(f.betalt_belop || 0);
    const utestaende = beregnUtestaende(f);
    const fakturanr = safeText(f.fakturanr || "");

    const betalKnapp = status === "betalt" || status === "kreditert"
      ? ""
      : `<button type="button" onclick="markerHovFakturaBetalt('${fakturanr}', ${inkl})">Betalt</button>`;

    return `
      <tr>
        <td>${fakturanr}</td>
        <td>${safeText(f.dato || "")}</td>
        <td>${safeText(kunde)}</td>
        <td style="text-align:right;">${oversiktKr(f.eks_mva)}</td>
        <td style="text-align:right;">${oversiktKr(f.mva)}</td>
        <td style="text-align:right;"><b>${oversiktKr(inkl)}</b></td>
        <td>${safeText(status)}</td>
        <td style="text-align:right;">${oversiktKr(betalt)}</td>
        <td style="text-align:right;">${oversiktKr(utestaende)}</td>
        <td>${safeText(f.betalt_dato || "")}</td>
        <td>${betalKnapp}</td>
      </tr>
    `;
  }).join("");

  div.innerHTML = `
    <div class="listekort">
      <div class="rad">
        <div>
          <label for="fakturaOversiktSok">Søk</label>
          <input
            id="fakturaOversiktSok"
            placeholder="Søk kunde, fakturanr, dato eller status"
            value="${safeText(hovFakturaSok)}"
            oninput="settHovFakturaSok(this.value)">
        </div>
      </div>

      <div style="margin-top:10px;">
        ${filterKnapp("alle", "Alle")}
        ${filterKnapp("ubetalt", "Ubetalt")}
        ${filterKnapp("betalt", "Betalt")}
        ${filterKnapp("kreditert", "Kreditert")}
      </div>

      <div style="overflow-x:auto; margin-top:12px;">
        <table style="width:100%; border-collapse:collapse; min-width:900px;">
          <thead>
            <tr>
              <th style="text-align:left; border-bottom:1px solid #475569; padding:8px;">Fakturanr</th>
              <th style="text-align:left; border-bottom:1px solid #475569; padding:8px;">Dato</th>
              <th style="text-align:left; border-bottom:1px solid #475569; padding:8px;">Kunde</th>
              <th style="text-align:right; border-bottom:1px solid #475569; padding:8px;">Eks. mva</th>
              <th style="text-align:right; border-bottom:1px solid #475569; padding:8px;">MVA</th>
              <th style="text-align:right; border-bottom:1px solid #475569; padding:8px;">Inkl. mva</th>
              <th style="text-align:left; border-bottom:1px solid #475569; padding:8px;">Status</th>
              <th style="text-align:right; border-bottom:1px solid #475569; padding:8px;">Betalt</th>
              <th style="text-align:right; border-bottom:1px solid #475569; padding:8px;">Utestående</th>
              <th style="text-align:left; border-bottom:1px solid #475569; padding:8px;">Betalt dato</th>
              <th style="text-align:left; border-bottom:1px solid #475569; padding:8px;">Handling</th>
            </tr>
          </thead>
          <tbody>
            ${tabellRader || `<tr><td colspan="11" style="padding:12px;">Ingen fakturaer å vise.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div style="margin-top:14px; line-height:1.7;">
        <b>Antall:</b> ${rader.length}<br>
        <b>Sum eks. mva:</b> ${oversiktKr(sumEks)} kr<br>
        <b>Sum mva:</b> ${oversiktKr(sumMva)} kr<br>
        <b>Sum inkl. mva:</b> ${oversiktKr(sumInkl)} kr<br>
        <b>Betalt:</b> ${oversiktKr(sumBetalt)} kr<br>
        <b>Utestående:</b> ${oversiktKr(sumUtestaende)} kr
      </div>
    </div>
  `;
}

async function hentFakturaOversikt() {
  const res = await supabaseClient
    .from("hov_fakturaer")
    .select("*, kunder(navn)")
    .order("dato", { ascending: false });

  if (res.error) {
    alert(res.error.message);
    return;
  }

  sisteHovFakturaOversikt = res.data || [];
  tegnFakturaOversikt();
}

function settHovFakturaFilter(filter) {
  hovFakturaFilter = filter || "alle";
  tegnFakturaOversikt();
}

function settHovFakturaSok(verdi) {
  hovFakturaSok = verdi || "";
  tegnFakturaOversikt();

  const input = document.getElementById("fakturaOversiktSok");
  if (input) {
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }
}

async function markerHovFakturaBetalt(fakturanr, belop) {
  const res = await supabaseClient
    .from("hov_fakturaer")
    .update({
      betalingsstatus: "betalt",
      betalt_belop: belop,
      betalt_dato: new Date().toISOString().slice(0, 10)
    })
    .eq("fakturanr", fakturanr);

  if (res.error) {
    alert(res.error.message);
    return;
  }

  await hentFakturaOversikt();
}

async function eksporterFakturaOversiktExcel() {
  if (!window.XLSX) {
    alert("Excel-biblioteket mangler");
    return;
  }

  if (!sisteHovFakturaOversikt.length) {
    await hentFakturaOversikt();
  }

  const rader = hentFiltrerteFakturaer().map(f => ({
    Fakturanr: f.fakturanr,
    Kunde: f.kunder?.navn || f.kunde_navn || "",
    Dato: f.dato,
    "Eks mva": Number(f.eks_mva || 0),
    MVA: Number(f.mva || 0),
    "Inkl mva": Number(f.inkl_mva || 0),
    Status: normaliserStatus(f),
    "Betalt beløp": Number(f.betalt_belop || 0),
    "Betalt dato": f.betalt_dato || "",
    "Utestående": beregnUtestaende(f)
  }));

  const ws = XLSX.utils.json_to_sheet(rader);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Fakturaoversikt");
  XLSX.writeFile(wb, "hov_fakturaoversikt.xlsx");
}

window.hentFakturaOversikt = hentFakturaOversikt;
window.eksporterFakturaOversiktExcel = eksporterFakturaOversiktExcel;
window.markerHovFakturaBetalt = markerHovFakturaBetalt;
window.settHovFakturaFilter = settHovFakturaFilter;
window.settHovFakturaSok = settHovFakturaSok;
