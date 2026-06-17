console.log("hov-fakturaoversikt.js lastet - kompakt og klikkbar");

let sisteHovFakturaOversikt = [];
let hovFakturaFilter = "alle";
let hovFakturaSok = "";
let hovFakturaValgt = null;

function oversiktKr(n) {
  return Number(n || 0).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}


function hentVippsTekstFraFirma(firma) {
  firma = firma || {};
  const nummer = firma.vipps_nummer || firma.vippsnummer || firma.vipps_nr || firma.vipps || firma.vipps_bedrift || "";
  const mottaker = firma.vipps_mottaker || firma.vipps_navn || firma.vippsNavn || firma.navn || firma.firmanavn || "";
  return {
    nummer: String(nummer || "").trim(),
    mottaker: String(mottaker || "").trim()
  };
}

async function hentHovFirmaTilPdf() {
  let firma = {};

  try {
    if (typeof hentFirmaData === "function") {
      const hentet = await hentFirmaData();
      if (hentet && typeof hentet === "object") firma = hentet;
    }
  } catch (e) {
    console.warn("Kunne ikke hente firma via hentFirmaData:", e);
  }

  if ((!firma || !Object.keys(firma).length || (!hentVippsTekstFraFirma(firma).nummer && !hentVippsTekstFraFirma(firma).mottaker)) && window.supabaseClient) {
    const tabeller = ["firma", "hov_firma"];
    for (const tabell of tabeller) {
      try {
        const { data, error } = await supabaseClient
          .from(tabell)
          .select("*")
          .limit(1)
          .maybeSingle();
        if (!error && data) {
          firma = { ...firma, ...data };
          break;
        }
      } catch (e) {
        console.warn("Kunne ikke hente firma fra", tabell, e);
      }
    }
  }

  return firma || {};
}

function tegnVippsPdf(doc, firma, x, y) {
  const vipps = hentVippsTekstFraFirma(firma);
  if (!vipps.nummer && !vipps.mottaker) return y;

  if (y > 250) {
    doc.addPage();
    y = 25;
  }

  doc.setFontSize(11);
  doc.text("Betaling med Vipps", x, y);
  y += 7;
  doc.setFontSize(10);

  if (vipps.nummer) {
    doc.text("Vipps: " + vipps.nummer, x, y);
    y += 6;
  }

  if (vipps.mottaker) {
    doc.text("Mottaker: " + vipps.mottaker, x, y);
    y += 6;
  }

  return y;
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
  const status = String(f.betalingsstatus || "ubetalt").toLowerCase();
  if (status === "purring" || status === "purret") return "purret";
  if (status === "betalt") return "betalt";
  if (status === "kreditert") return "kreditert";
  return "ubetalt";
}

function beregnUtestaende(f) {
  const inkl = Number(f.inkl_mva || 0);
  const betalt = Number(f.betalt_belop || 0);
  const status = normaliserStatus(f);

  if (status === "betalt" || status === "kreditert") return 0;
  return Math.max(inkl - betalt, 0);
}

function hovDatoNo(v) {
  if (!v) return "";
  const s = String(v).slice(0, 10);
  const d = s.split("-");
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : String(v);
}

function hentFiltrerteFakturaer() {
  let rader = [...sisteHovFakturaOversikt];

  // Sikring mot dobbel visning hvis samme fakturanr skulle komme flere ganger fra databasen.
  const unike = new Map();
  for (const f of rader) {
    const key = String(f.fakturanr || f.id || "");
    if (key && !unike.has(key)) unike.set(key, f);
  }
  rader = [...unike.values()];

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

      return kunde.includes(sok) || fakturanr.includes(sok) || dato.includes(sok) || status.includes(sok);
    });
  }

  return rader;
}

function statusTekst(status) {
  if (status === "betalt") return "Betalt";
  if (status === "kreditert") return "Kreditert";
  if (status === "purret") return "Purret";
  return "Ubetalt";
}

function fakturertTekst(f) {
  return f.fakturanr ? "Fakturert" : "Ikke fakturert";
}


function statusKnappHtml(f) {
  const status = normaliserStatus(f);
  const tekst = statusTekst(status);
  const fakturanr = safeText(f.fakturanr || "");
  const belop = Number(f.inkl_mva || 0);

  if (status === "betalt") return `<span title="Betalt">✓ Betalt</span>`;
  if (status === "kreditert") return `<span title="Kreditert">Kreditert</span>`;

  return `<button type="button" class="secondary" title="Sett faktura som betalt" style="padding:4px 7px;font-size:11px;white-space:nowrap;" onclick="event.stopPropagation(); markerHovFakturaBetalt(\'${fakturanr}\', ${belop})">Sett betalt</button>`;
}

function purringKnappHtml(f, liten = false) {
  const status = normaliserStatus(f);
  if (status === "betalt" || status === "kreditert") return "";
  const tekst = status === "purret" ? "Ny purring" : "Purring";
  const cls = liten ? ' class="secondary" style="padding:4px 7px;font-size:11px;white-space:nowrap;"' : "";
  return `<button type="button"${cls} onclick="event.stopPropagation(); lagHovPurring('${safeText(f.fakturanr)}')">${tekst}</button>`;
}

function sikreFakturaDetalj() {
  let detalj = document.getElementById("hovFakturaDetalj");
  const oversikt = document.getElementById("fakturaOversikt");

  if (!detalj) {
    detalj = document.createElement("div");
    detalj.id = "hovFakturaDetalj";
    detalj.className = "listekort";
    detalj.style.display = "none";
    detalj.style.marginBottom = "12px";
    if (oversikt?.parentNode) {
      oversikt.parentNode.insertBefore(detalj, oversikt);
    } else {
      document.getElementById("fakturaSide")?.appendChild(detalj);
    }
  }

  return detalj;
}

function visHovFakturaDetalj(fakturanr) {
  const f = sisteHovFakturaOversikt.find(x => String(x.fakturanr) === String(fakturanr));
  if (!f) return;

  hovFakturaValgt = f;
  const detalj = sikreFakturaDetalj();
  const status = normaliserStatus(f);
  const kunde = f.kunder?.navn || f.kunde_navn || "";
  const inkl = Number(f.inkl_mva || 0);
  const betalt = Number(f.betalt_belop || 0);
  const utestaende = beregnUtestaende(f);

  const betalKnapp = status === "betalt" || status === "kreditert"
    ? ""
    : `<button type="button" onclick="event.stopPropagation(); markerHovFakturaBetalt('${safeText(f.fakturanr)}', ${inkl})">Marker betalt</button>`;

  detalj.style.display = "block";
  detalj.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
      <h3 style="margin:0;">Faktura ${safeText(f.fakturanr || "")}</h3>
      <button type="button" class="secondary" onclick="lukkHovFakturaDetalj()">Lukk</button>
    </div>

    <div class="rad" style="margin-top:12px;">
      <div><strong>Kunde:</strong><br>${safeText(kunde)}</div>
      <div><strong>Dato:</strong><br>${safeText(hovDatoNo(f.dato || ""))}</div>
      <div><strong>Status:</strong><br>${safeText(statusTekst(status))}</div>
      <div><strong>Eks. mva:</strong><br>${oversiktKr(f.eks_mva)} kr</div>
      <div><strong>MVA:</strong><br>${oversiktKr(f.mva)} kr</div>
      <div><strong>Inkl. mva:</strong><br><b>${oversiktKr(inkl)} kr</b></div>
      <div><strong>Betalt:</strong><br>${oversiktKr(betalt)} kr</div>
      <div><strong>Utestående:</strong><br>${oversiktKr(utestaende)} kr</div>
      <div><strong>Betalt dato:</strong><br>${safeText(hovDatoNo(f.betalt_dato || ""))}</div>
    </div>

    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
      ${purringKnappHtml(f)}
      ${betalKnapp}
    </div>
  `;

  detalj.scrollIntoView({ behavior: "smooth", block: "start" });
}

function lukkHovFakturaDetalj() {
  const detalj = document.getElementById("hovFakturaDetalj");
  if (detalj) {
    detalj.style.display = "none";
    detalj.innerHTML = "";
  }
  hovFakturaValgt = null;
}


async function hentIkkeFakturerteJobberPrKunde() {
  if (!window.supabaseClient) return [];
  try {
    let q = window.supabaseClient
      .from("hov_jobber")
      .select("id, kunde_id, dato, jobbtype, total, fakturert, kunder(navn), hester(navn,kunde_id)")
      .or("fakturert.is.false,fakturert.is.null")
      .order("dato", { ascending: false });

    if (typeof window.hentAktivHovFirmaId === "function") {
      const firmaId = await window.hentAktivHovFirmaId();
      if (firmaId) q = q.eq("firma_id", firmaId);
    }

    const { data, error } = await q;
    if (error) throw error;

    const map = new Map();
    for (const j of data || []) {
      const kundeId = String(j.kunde_id || j.hester?.kunde_id || "");
      const kundeNavn = j.kunder?.navn || "Ukjent kunde";
      if (!kundeId) continue;
      if (!map.has(kundeId)) {
        map.set(kundeId, { kunde_id: kundeId, kunde_navn: kundeNavn, antall: 0, sum: 0, jobber: [] });
      }
      const rad = map.get(kundeId);
      rad.antall += 1;
      rad.sum += Number(j.total || 0);
      rad.jobber.push(j);
    }

    return [...map.values()].sort((a, b) => String(a.kunde_navn).localeCompare(String(b.kunde_navn), "no"));
  } catch (e) {
    console.warn("Kunne ikke hente ufakturerte jobber pr kunde:", e);
    return [];
  }
}

function tegnIkkeFakturerteJobberPrKunde(grupper) {
  if (!Array.isArray(grupper) || !grupper.length) {
    return `<div class="listekort" style="margin-top:12px;"><h3>Ikke fakturerte jobber pr kunde</h3><div class="info">Ingen ufakturerte jobber.</div></div>`;
  }

  const rader = grupper.map(g => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #374151;">${safeText(g.kunde_navn)}</td>
      <td style="padding:6px;border-bottom:1px solid #374151;text-align:right;">${g.antall}</td>
      <td style="padding:6px;border-bottom:1px solid #374151;text-align:right;white-space:nowrap;">${oversiktKr(g.sum)} kr</td>
      <td style="padding:6px;border-bottom:1px solid #374151;text-align:right;">
        <button type="button" onclick="velgHovKundeOgLagFaktura('${safeText(g.kunde_id)}')" style="padding:5px 8px;font-size:12px;white-space:nowrap;">Lag faktura</button>
      </td>
    </tr>
  `).join("");

  return `
    <div class="listekort" style="margin-top:12px;overflow-x:auto;">
      <h3>Ikke fakturerte jobber pr kunde</h3>
      <table style="width:100%;border-collapse:collapse;min-width:520px;font-size:12px;">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:1px solid #475569;padding:6px;">Kunde</th>
            <th style="text-align:right;border-bottom:1px solid #475569;padding:6px;">Jobber</th>
            <th style="text-align:right;border-bottom:1px solid #475569;padding:6px;">Sum</th>
            <th style="text-align:right;border-bottom:1px solid #475569;padding:6px;">Handling</th>
          </tr>
        </thead>
        <tbody>${rader}</tbody>
      </table>
      <div class="info">Denne viser kunder som fortsatt har jobber som ikke er fakturert.</div>
    </div>
  `;
}

async function velgHovKundeOgLagFaktura(kundeId) {
  const sel = document.getElementById("fakturaKunde");
  if (typeof window.fyllFakturaKunder === "function") await window.fyllFakturaKunder();
  if (sel) sel.value = kundeId;
  if (typeof window.lagHovFaktura === "function") await window.lagHovFaktura();
  if (typeof window.hentFakturaOversikt === "function") await window.hentFakturaOversikt();
}
window.velgHovKundeOgLagFaktura = velgHovKundeOgLagFaktura;

async function visHovFakturaDetaljMedJobber(fakturanr) {
  const f = sisteHovFakturaOversikt.find(x => String(x.fakturanr) === String(fakturanr));
  if (!f) return;

  visHovFakturaDetalj(fakturanr);

  const detalj = document.getElementById("hovFakturaDetalj");
  if (!detalj) return;

  try {
    let q = window.supabaseClient
      .from("hov_jobber")
      .select("id, dato, jobbtype, total, km, km_pris, arbeid_belop, varer_belop, hester(navn), kunder(navn)")
      .eq("fakturanr", fakturanr)
      .order("dato", { ascending: true });

    const { data, error } = await q;
    if (error) throw error;

    const jobbrader = (data || []).map(j => `
      <tr>
        <td style="padding:5px;border-bottom:1px solid #374151;white-space:nowrap;">${safeText(hovDatoNo(j.dato || ""))}</td>
        <td style="padding:5px;border-bottom:1px solid #374151;">${safeText(j.hester?.navn || "Uten hest")}</td>
        <td style="padding:5px;border-bottom:1px solid #374151;">${safeText(j.jobbtype || "")}</td>
        <td style="padding:5px;border-bottom:1px solid #374151;text-align:right;white-space:nowrap;">${oversiktKr(j.total || (Number(j.arbeid_belop || 0) + Number(j.varer_belop || 0) + (Number(j.km || 0) * Number(j.km_pris || 0))) * 1.25)} kr</td>
      </tr>
    `).join("");

    detalj.innerHTML += `
      <h4 style="margin-top:14px;">Jobber på fakturaen</h4>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:520px;font-size:12px;">
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #475569;padding:5px;">Dato</th>
              <th style="text-align:left;border-bottom:1px solid #475569;padding:5px;">Hest</th>
              <th style="text-align:left;border-bottom:1px solid #475569;padding:5px;">Jobb</th>
              <th style="text-align:right;border-bottom:1px solid #475569;padding:5px;">Beløp</th>
            </tr>
          </thead>
          <tbody>${jobbrader || `<tr><td colspan="4" style="padding:8px;">Ingen jobblinjer funnet.</td></tr>`}</tbody>
        </table>
      </div>
    `;
  } catch (e) {
    detalj.innerHTML += `<div class="melding">Kunne ikke hente jobblinjer: ${safeText(e.message || e)}</div>`;
  }
}
window.visHovFakturaDetaljMedJobber = visHovFakturaDetaljMedJobber;


async function tegnFakturaOversikt() {
  const div = document.getElementById("fakturaOversikt");
  if (!div) return;

  sikreFakturaDetalj();

  const fakturaRader = hentFiltrerteFakturaer();
  const ufakturerteGrupper = await hentIkkeFakturerteJobberPrKunde();

  const kombinerteRader = [];

  for (const f of fakturaRader) {
    const status = normaliserStatus(f);
    kombinerteRader.push({
      type: "faktura",
      sortDato: String(f.dato || ""),
      kunde: f.kunder?.navn || f.kunde_navn || "",
      fakturanr: f.fakturanr || "",
      dato: hovDatoNo(f.dato || ""),
      jobber: "",
      belop: Number(f.inkl_mva || 0),
      status,
      statusTekst: statusTekst(status),
      htmlHandling: `
        ${status === "betalt" || status === "kreditert" ? "" : `<button type="button" class="secondary" style="padding:4px 7px;font-size:11px;white-space:nowrap;" onclick="event.stopPropagation(); markerHovFakturaBetalt('${safeText(f.fakturanr)}', ${Number(f.inkl_mva || 0)})">Sett betalt</button>`}
        ${purringKnappHtml(f, true)}
      `,
      onclick: `visHovFakturaDetaljMedJobber('${safeText(f.fakturanr)}')`
    });
  }

  for (const g of ufakturerteGrupper) {
    kombinerteRader.push({
      type: "ufakturert",
      sortDato: "9999-99-99",
      kunde: g.kunde_navn || "",
      fakturanr: "",
      dato: "",
      jobber: String(g.antall || 0),
      belop: Number(g.sum || 0),
      status: "ikke_fakturert",
      statusTekst: "Ikke fakturert",
      htmlHandling: `<button type="button" style="padding:5px 8px;font-size:12px;white-space:nowrap;" onclick="event.stopPropagation(); velgHovKundeOgLagFaktura('${safeText(g.kunde_id)}')">Lag faktura</button>`,
      onclick: ""
    });
  }

  kombinerteRader.sort((a, b) => {
    if (a.status === "ikke_fakturert" && b.status !== "ikke_fakturert") return -1;
    if (a.status !== "ikke_fakturert" && b.status === "ikke_fakturert") return 1;
    return String(b.sortDato).localeCompare(String(a.sortDato));
  });

  const sumInkl = fakturaRader.reduce((s, f) => s + Number(f.inkl_mva || 0), 0);
  const sumBetalt = fakturaRader.reduce((s, f) => s + Number(f.betalt_belop || 0), 0);
  const sumUtestaende = fakturaRader.reduce((s, f) => s + beregnUtestaende(f), 0);
  const sumIkkeFakturert = ufakturerteGrupper.reduce((s, g) => s + Number(g.sum || 0), 0);

  const filterKnapp = (verdi, tekst) => `
    <button type="button" onclick="settHovFakturaFilter('${verdi}')" class="${hovFakturaFilter === verdi ? "" : "secondary"}">
      ${tekst}
    </button>
  `;

  const tabellRader = kombinerteRader.map(r => `
    <tr ${r.onclick ? `onclick="${r.onclick}" style="cursor:pointer;"` : ""}>
      <td style="padding:6px;border-bottom:1px solid #374151;white-space:nowrap;max-width:115px;overflow:hidden;text-overflow:ellipsis;">${safeText(r.fakturanr || "-")}</td>
      <td style="padding:6px;border-bottom:1px solid #374151;white-space:nowrap;">${safeText(r.dato || "-")}</td>
      <td style="padding:6px;border-bottom:1px solid #374151;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeText(r.kunde)}</td>
      <td style="padding:6px;border-bottom:1px solid #374151;text-align:right;white-space:nowrap;">${safeText(r.jobber || "")}</td>
      <td style="padding:6px;border-bottom:1px solid #374151;text-align:right;white-space:nowrap;"><b>${oversiktKr(r.belop)}</b></td>
      <td style="padding:6px;border-bottom:1px solid #374151;white-space:nowrap;">${safeText(r.statusTekst)}</td>
      <td style="padding:5px;border-bottom:1px solid #374151;white-space:nowrap;text-align:right;">${r.htmlHandling || ""}</td>
    </tr>
  `).join("");

  div.innerHTML = `
    <div class="listekort" style="max-width:100%;overflow:hidden;">
      <div class="rad">
        <div>
          <label for="fakturaOversiktSok">Søk</label>
          <input id="fakturaOversiktSok" placeholder="Søk kunde, fakturanr, dato eller status" value="${safeText(hovFakturaSok)}" oninput="settHovFakturaSok(this.value)">
        </div>
      </div>

      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        ${filterKnapp("alle", "Alle")}
        ${filterKnapp("ubetalt", "Ubetalt")}
        ${filterKnapp("purret", "Purret")}
        ${filterKnapp("betalt", "Betalt")}
        ${filterKnapp("kreditert", "Kreditert")}
      </div>

      <div class="listekort" style="margin-top:12px;line-height:1.7;background:#111827;">
        <b>Fakturaer:</b> ${fakturaRader.length}<br>
        <b>Fakturert inkl. mva:</b> ${oversiktKr(sumInkl)} kr<br>
        <b>Betalt:</b> ${oversiktKr(sumBetalt)} kr<br>
        <b>Utestående:</b> ${oversiktKr(sumUtestaende)} kr<br>
        <b>Ikke fakturert:</b> ${oversiktKr(sumIkkeFakturert)} kr<br>
        <small>Klikk på en faktura for detaljer og jobblinjer. Bruk Sett betalt eller Purring direkte i tabellen.</small>
      </div>

      <div style="overflow-x:auto; margin-top:12px; max-width:100%;">
        <table style="width:100%; border-collapse:collapse; min-width:760px; font-size:11px; line-height:1.2; table-layout:fixed;">
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #475569;padding:5px;width:100px;">Fakturanr</th>
              <th style="text-align:left;border-bottom:1px solid #475569;padding:5px;width:78px;">Dato</th>
              <th style="text-align:left;border-bottom:1px solid #475569;padding:5px;">Kunde</th>
              <th style="text-align:right;border-bottom:1px solid #475569;padding:5px;width:60px;">Jobber</th>
              <th style="text-align:right;border-bottom:1px solid #475569;padding:5px;width:96px;">Beløp</th>
              <th style="text-align:left;border-bottom:1px solid #475569;padding:5px;width:95px;">Status</th>
              <th style="text-align:right;border-bottom:1px solid #475569;padding:5px;width:145px;">Handling</th>
            </tr>
          </thead>
          <tbody>
            ${tabellRader || `<tr><td colspan="7" style="padding:12px;">Ingen rader å vise.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function hentFakturaOversikt() {
  const res = await supabaseClient
    .from("hov_fakturaer")
    .select("*, kunder(navn)")
    .order("dato", { ascending: false })
    .order("fakturanr", { ascending: false });

  if (res.error) {
    alert(res.error.message);
    return;
  }

  sisteHovFakturaOversikt = res.data || [];
  await tegnFakturaOversikt();
}

async function settHovFakturaFilter(filter) {
  hovFakturaFilter = filter || "alle";
  await tegnFakturaOversikt();
}

async function settHovFakturaSok(verdi) {
  hovFakturaSok = verdi || "";
  await tegnFakturaOversikt();

  const input = document.getElementById("fakturaOversiktSok");
  if (input) {
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }
}

async function markerHovFakturaBetalt(fakturanr, belop) {
  if (!fakturanr) {
    alert("Mangler fakturanummer.");
    return;
  }

  const res = await supabaseClient
    .from("hov_fakturaer")
    .update({
      betalingsstatus: "betalt",
      betalt_belop: Number(belop || 0),
      betalt_dato: new Date().toISOString().slice(0, 10)
    })
    .eq("fakturanr", fakturanr);

  if (res.error) {
    alert(res.error.message);
    return;
  }

  await hentFakturaOversikt();

  const oppdatert = sisteHovFakturaOversikt.find(x => String(x.fakturanr) === String(fakturanr));
  if (oppdatert) {
    await visHovFakturaDetaljMedJobber(fakturanr);
  }

  const melding = document.getElementById("fakturaMelding");
  if (melding) {
    melding.textContent = "Faktura er satt betalt: " + fakturanr;
    melding.style.color = "#86efac";
  }
}

async function lagHovPurring(fakturanr) {
  const f = sisteHovFakturaOversikt.find(x => String(x.fakturanr) === String(fakturanr));
  if (!f) {
    alert("Fant ikke fakturaen.");
    return;
  }

  const status = normaliserStatus(f);
  if (status === "betalt" || status === "kreditert") {
    alert("Denne fakturaen er allerede avsluttet.");
    return;
  }

  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert("PDF-biblioteket mangler.");
      return;
    }

    const firma = await hentHovFirmaTilPdf();
    const kunde = f.kunder?.navn || f.kunde_navn || "";
    const inkl = Number(f.inkl_mva || 0);
    const betalt = Number(f.betalt_belop || 0);
    const utestaende = beregnUtestaende(f);
    const iDag = new Date().toISOString().slice(0, 10);

    const doc = new jsPDF();
    if (typeof tegnBrevhodePdf === "function") {
      await tegnBrevhodePdf(doc, firma);
    }

    let y = 56;
    doc.setFontSize(18);
    doc.text("PURRING", 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.text("Fakturanr: " + String(f.fakturanr || ""), 20, y);
    y += 7;
    doc.text("Purringsdato: " + iDag, 20, y);
    y += 7;
    doc.text("Opprinnelig fakturadato: " + String(f.dato || ""), 20, y);
    y += 14;

    doc.setFontSize(12);
    doc.text("Kunde:", 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(String(kunde || ""), 20, y);
    y += 16;

    doc.setFontSize(11);
    doc.text("Dette er en purring på ubetalt faktura.", 20, y);
    y += 12;
    doc.text("Fakturasum:", 20, y);
    doc.text(oversiktKr(inkl) + " kr", 130, y);
    y += 7;
    doc.text("Registrert betalt:", 20, y);
    doc.text(oversiktKr(betalt) + " kr", 130, y);
    y += 9;
    doc.setFontSize(13);
    doc.text("Utestående:", 20, y);
    doc.text(oversiktKr(utestaende) + " kr", 130, y);

    y += 16;
    y = tegnVippsPdf(doc, firma, 20, y);

    if (typeof tegnBrevfotAlleSiderPdf === "function") {
      tegnBrevfotAlleSiderPdf(doc, firma);
    }

    const oppdaterRes = await supabaseClient
      .from("hov_fakturaer")
      .update({ betalingsstatus: "purret" })
      .eq("fakturanr", fakturanr);

    if (oppdaterRes.error) {
      alert("Purring-PDF ble laget, men status ble ikke lagret: " + oppdaterRes.error.message);
    }

    doc.save("Purring-" + String(fakturanr || "faktura") + ".pdf");
    await hentFakturaOversikt();
    await visHovFakturaDetaljMedJobber(fakturanr);

    const melding = document.getElementById("fakturaMelding");
    if (melding) {
      melding.textContent = "Purring laget og faktura er merket som purret: " + fakturanr;
      melding.style.color = "#86efac";
    }
  } catch (e) {
    console.error("Feil ved purring:", e);
    alert("Kunne ikke lage purring: " + (e.message || e));
  }
}

async function eksporterFakturaOversiktExcel() {
  if (!window.XLSX) {
    alert("Excel-biblioteket mangler");
    return;
  }

  if (!sisteHovFakturaOversikt.length) await hentFakturaOversikt();

  const rader = hentFiltrerteFakturaer().map(f => ({
    Fakturanr: f.fakturanr,
    Kunde: f.kunder?.navn || f.kunde_navn || "",
    Dato: f.dato,
    "Eks mva": Number(f.eks_mva || 0),
    MVA: Number(f.mva || 0),
    "Inkl mva": Number(f.inkl_mva || 0),
    Fakturert: fakturertTekst(f),
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
window.lagHovPurring = lagHovPurring;
window.settHovFakturaFilter = settHovFakturaFilter;
window.settHovFakturaSok = settHovFakturaSok;
window.visHovFakturaDetalj = visHovFakturaDetalj;
window.lukkHovFakturaDetalj = lukkHovFakturaDetalj;
