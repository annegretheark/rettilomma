/* Økonomi, MVA, faktura og kreditnota
   Utskilt fra vet-app.js 2026-06-11. Lastes i samme rekkefølge som originalfilen. */

function tegnAdminOkonomiOversikt() {
  const liste = document.getElementById("adminOkonomiListe");
  const summer = document.getElementById("adminOkonomiSummer");
  if (!liste || !summer) return;

  const journaler = hentAdminOkonomiJournaler();
  const alle = vetJournal || [];
  const fakturertAlle = alle.filter(journalErFakturert);
  const ikkeFakturertAlle = alle.filter(j => !journalErFakturert(j));

  const sum = rader => rader.reduce((s, j) => s + Number(j.belop_eks_mva || 0), 0);
  const sumValgt = sum(journaler);
  const sumFakturert = sum(fakturertAlle);
  const sumIkkeFakturert = sum(ikkeFakturertAlle);

  summer.innerHTML = `
    <div class="okonomi-boks">Valgt visning<strong>${formaterKr(sumValgt)} kr</strong><span class="lite">${journaler.length} journal(er)</span></div>
    <div class="okonomi-boks">Ikke fakturert<strong class="okonomi-advarsel">${formaterKr(sumIkkeFakturert)} kr</strong><span class="lite">${ikkeFakturertAlle.length} journal(er)</span></div>
    <div class="okonomi-boks">Fakturert<strong>${formaterKr(sumFakturert)} kr</strong><span class="lite">${fakturertAlle.length} journal(er)</span></div>
  `;

  if (!journaler.length) {
    liste.innerHTML = '<p class="lite">Ingen journaler funnet for valgt filter.</p>';
    return;
  }

  const raderHtml = journaler.map(j => {
    const fakturert = journalErFakturert(j);
    const faktura = finnVetFakturaFraFakturanr(j.fakturanr);
    const betalt = faktura && (
      faktura.betalt === true ||
      String(faktura.betalingsstatus || "").toLowerCase() === "betalt" ||
      String(faktura.status || "").toLowerCase() === "betalt"
    );

    let handling = `
      <button type="button"
              class="secondary"
              onclick="visVetFakturaFraOversikt('${htmlEscape(j.id || "")}')"
              style="padding:2px 6px;font-size:11px;line-height:1.2;margin-right:3px;">
        Vis faktura
      </button>
      <button type="button"
              onclick="fakturerVetJournalFraOversikt('${htmlEscape(j.id || "")}')"
              style="padding:2px 6px;font-size:11px;line-height:1.2;">
        Fakturer
      </button>
    `;
    if (fakturert && betalt) {
      handling = `
        <button type="button"
                class="secondary"
                onclick="visVetFakturaFraOversikt('${htmlEscape(j.id || "")}')"
                style="padding:2px 6px;font-size:11px;line-height:1.2;margin-right:3px;">
          Vis faktura
        </button>
        <button type="button"
                class="danger"
                onclick="lagVetKreditnotaFraOversiktFaktura('${htmlEscape(j.fakturanr || "")}')"
                style="padding:2px 6px;font-size:11px;line-height:1.2;">
          Kreditnota
        </button>
        <span class="lite" style="display:block;margin-top:2px;">Betalt</span>
      `;
    } else if (fakturert) {
      handling = `
        <button type="button"
                class="secondary"
                onclick="visVetFakturaFraOversikt('${htmlEscape(j.id || "")}')"
                style="padding:2px 6px;font-size:11px;line-height:1.2;margin-right:3px;">
          Vis faktura
        </button>
        <button type="button"
                class="danger"
                onclick="lagVetKreditnotaFraOversiktFaktura('${htmlEscape(j.fakturanr || "")}')"
                style="padding:2px 6px;font-size:11px;line-height:1.2;margin-right:3px;">
          Kreditnota
        </button>
        <button type="button"
                class="secondary"
                onclick="settVetFakturaBetaltFraOversiktFaktura('${htmlEscape(j.fakturanr || "")}')"
                style="padding:2px 6px;font-size:11px;line-height:1.2;margin-right:3px;">
          Sett betalt
        </button>
        <button type="button"
                class="danger"
                onclick="lagVetPurringFraOversiktFaktura('${htmlEscape(j.fakturanr || "")}')"
                style="padding:2px 6px;font-size:11px;line-height:1.2;">
          Purring
        </button>
      `;
    }

    return `
      <tr>
        <td>${htmlEscape(j.dato || "")}</td>
        <td>${htmlEscape(hentJournalEierNavn(j))}</td>
        <td>${htmlEscape(hentJournalDyrNavn(j))}</td>
        <td>${htmlEscape(j.type || "")}</td>
        <td>${fakturert ? "Fakturert" : '<span class="okonomi-advarsel">Ikke fakturert</span>'}</td>
        <td style="text-align:right;">${formaterKr(j.belop_eks_mva || 0)} kr</td>
        <td>${htmlEscape(j.fakturanr || "")}</td>
        <td style="white-space:nowrap;width:230px;">${handling}</td>
      </tr>
    `;
  }).join("");

  liste.innerHTML = `
    <table class="okonomi-tabell">
      <thead>
        <tr>
          <th>Dato</th>
          <th>Dyreeier</th>
          <th>Dyr</th>
          <th>Type</th>
          <th>Status</th>
          <th style="text-align:right;">Beløp eks. mva</th>
          <th>Fakturanr</th>
          <th style="width:230px;">Handling</th>
        </tr>
      </thead>
      <tbody>
        ${raderHtml}
      </tbody>
    </table>
  `;
}



function hentVetFakturaDataFraJournal(journal) {
  const fakturert = journalErFakturert(journal);
  const faktura = fakturert ? finnVetFakturaFraFakturanr(journal.fakturanr) : null;
  const eierId = finnDyreeierIdForJournal(journal);
  const eier = (vetDyreeiere || []).find(e => String(e.id) === String(eierId)) || finnFakturaKunde(faktura) || {};
  const journaler = fakturert
    ? (vetJournal || []).filter(j => String(j.fakturanr || "").trim() === String(journal.fakturanr || "").trim())
    : (vetJournal || []).filter(j => !journalErFakturert(j) && String(finnDyreeierIdForJournal(j)) === String(eierId));
  const linjer = lagFakturaLinjerFraJournaler(journaler);
  const sumEks = fakturert ? Number(faktura?.eks_mva || 0) : linjer.reduce((sum, l) => sum + Number(l.sum || 0), 0);
  const mva = fakturert ? Number(faktura?.mva || 0) : sumEks * 0.25;
  const sumInk = fakturert ? Number(faktura?.inkl_mva || 0) : sumEks + mva;
  return { fakturert, faktura, eier, journaler, linjer, sumEks, mva, sumInk };
}

function lukkVetFakturaVisning() {
  document.getElementById("vetFakturaVisningModal")?.remove();
}

function visVetFakturaFraOversikt(journalId) {
  vetMelding("adminOkonomiMelding", "");
  const journal = (vetJournal || []).find(j => String(j.id) === String(journalId));
  if (!journal) {
    vetMelding("adminOkonomiMelding", "Fant ikke journalen.");
    return;
  }

  const data = hentVetFakturaDataFraJournal(journal);
  if (!data.linjer.length && !data.fakturert) {
    vetMelding("adminOkonomiMelding", "Fant ingen fakturalinjer å vise.");
    return;
  }

  const klinikk = hentFakturaKlinikk();
  const fakturanr = data.faktura?.fakturanr || journal.fakturanr || "Ny faktura";
  const fakturaDato = data.faktura?.dato || new Date().toISOString().slice(0, 10);
  const forfallsdato = data.faktura?.forfallsdato || data.faktura?.forfall || fakturaDato;
  const linjerHtml = data.linjer.length ? data.linjer.map(l => `
    <tr>
      <td>${htmlEscape(l.tekst)}</td>
      <td>${htmlEscape(l.behandler || "")}</td>
      <td style="text-align:right;">${formaterKr(l.antall)}</td>
      <td style="text-align:right;">${formaterKr(l.pris)} kr</td>
      <td style="text-align:right;">${formaterKr(l.sum)} kr</td>
    </tr>
  `).join("") : `
    <tr><td>Faktura ${htmlEscape(fakturanr)}</td><td></td><td style="text-align:right;">1</td><td style="text-align:right;">${formaterKr(data.sumEks)} kr</td><td style="text-align:right;">${formaterKr(data.sumEks)} kr</td></tr>
  `;

  lukkVetFakturaVisning();
  const modal = document.createElement("div");
  modal.id = "vetFakturaVisningModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:30px;overflow:auto;";
  modal.innerHTML = `
    <div style="background:#fff;color:#222;width:min(980px,96vw);border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.45);padding:24px;font-family:Arial,sans-serif;">
      <div style="display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #222;padding-bottom:16px;">
        <div>
          <strong>${htmlEscape(klinikk.navn || "Klinikk")}</strong><br>
          ${htmlEscape(klinikk.adresse || "")}<br>
          ${htmlEscape(klinikk.telefon || "")} ${htmlEscape(klinikk.epost || "")}
        </div>
        <div style="text-align:right;">
          <h2 style="margin:0 0 8px 0;">FAKTURA</h2>
          <strong>Fakturanr:</strong> ${htmlEscape(fakturanr)}<br>
          <strong>Dato:</strong> ${htmlEscape(fakturaDato)}<br>
          <strong>Forfall:</strong> ${htmlEscape(forfallsdato)}<br>
          <strong>Status:</strong> ${data.fakturert ? "Fakturert" : "Ikke fakturert"}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px;">
        <div style="border:1px solid #ddd;padding:12px;"><strong>Kunde</strong><br>${htmlEscape(data.eier?.navn || "")}<br>${htmlEscape(data.eier?.adresse || "")}<br>${htmlEscape(data.eier?.epost || "")} ${htmlEscape(data.eier?.telefon || "")}</div>
        <div style="border:1px solid #ddd;padding:12px;"><strong>Gjelder</strong><br>${data.journaler.length} journal(er). Veterinærbehandling, kjøring og varer/medisiner fra journal.</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:14px;">
        <thead><tr style="background:#f4f6f8;"><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Beskrivelse</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Behandler</th><th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Antall</th><th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Pris eks. mva</th><th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Sum eks. mva</th></tr></thead>
        <tbody>${linjerHtml}</tbody>
      </table>
      <table style="margin-left:auto;margin-top:18px;width:320px;border-collapse:collapse;">
        <tr><td>Sum eks. mva</td><td style="text-align:right;">${formaterKr(data.sumEks)} kr</td></tr>
        <tr><td>Mva 25%</td><td style="text-align:right;">${formaterKr(data.mva)} kr</td></tr>
        <tr><td style="font-weight:bold;border-top:2px solid #222;padding-top:8px;">Å betale</td><td style="text-align:right;font-weight:bold;border-top:2px solid #222;padding-top:8px;">${formaterKr(data.sumInk)} kr</td></tr>
      </table>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px;">
        ${data.fakturert ? `<button type="button" class="secondary" onclick="skrivUtVetFakturaFraOversikt('${htmlEscape(journal.fakturanr || "")}')">Lag kopi av faktura</button>` : `<button type="button" onclick="fakturerVetJournalFraOversikt('${htmlEscape(journal.id || "")}')">Fakturer</button>`}
        <button type="button" class="secondary" onclick="lukkVetFakturaVisning()">Lukk</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function finnDyreeierIdForJournal(journal) {
  if (!journal) return "";
  const dyr = (vetDyr || []).find(d => String(d.id) === String(journal.dyr_id)) || journal.vet_dyr || null;
  return String(
    journal.dyreeier_id ||
    dyr?.dyreeier_id ||
    dyr?.eier_id ||
    dyr?.vet_dyreeiere?.id ||
    ""
  );
}

async function fakturerVetJournalFraOversikt(journalId) {
  vetMelding("adminOkonomiMelding", "");
  const journal = (vetJournal || []).find(j => String(j.id) === String(journalId));
  if (!journal) {
    vetMelding("adminOkonomiMelding", "Fant ikke journalen som skal faktureres.");
    return;
  }
  if (journalErFakturert(journal)) {
    vetMelding("adminOkonomiMelding", "Denne journalen er allerede fakturert. Bruk Lag kopi av faktura.");
    return;
  }

  const eierId = finnDyreeierIdForJournal(journal);
  if (!eierId) {
    vetMelding("adminOkonomiMelding", "Fant ikke dyreeier for journalen.");
    return;
  }

  const eier = (vetDyreeiere || []).find(e => String(e.id) === String(eierId));
  const navn = eier?.navn || "denne dyreeieren";
  const ok = confirm(`Lage faktura for alle ikke-fakturerte journaler hos ${navn}?`);
  if (!ok) return;

  const vindu = window.open("", "_blank");
  if (!vindu) {
    vetMelding("adminOkonomiMelding", "Kunne ikke åpne faktura. Tillat popup-vindu for siden.");
    return;
  }
  vindu.document.open();
  vindu.document.write("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Lager faktura</title></head><body><p>Lager og lagrer faktura...</p></body></html>");
  vindu.document.close();

  try {
    if (!vetAlleKlinikkBrukere.length && typeof lastVetKlinikkBrukereAlle === "function") {
      await lastVetKlinikkBrukereAlle();
    }

    const journaler = (vetJournal || []).filter(j => !journalErFakturert(j) && String(finnDyreeierIdForJournal(j)) === String(eierId));
    const linjer = lagFakturaLinjerFraJournaler(journaler);
    if (!linjer.length) {
      vindu.close();
      vetMelding("adminOkonomiMelding", "Fant ingen fakturalinjer for valgt dyreeier.");
      return;
    }

    const klinikk = hentFakturaKlinikk();
    const fakturaDato = new Date().toISOString().slice(0, 10);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    const forfallsdato = d.toISOString().slice(0, 10);
    const fakturanr = `VET-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12)}`;
    const sumEks = linjer.reduce((sum, l) => sum + Number(l.sum || 0), 0);
    const behandlere = [...new Set(linjer.map(l => l.behandler).filter(Boolean))].join(", ");
    const mva = sumEks * 0.25;
    const sumInk = sumEks + mva;
    const journalIds = journaler.map(j => j.id).filter(Boolean);

    // Det finnes ikke alltid en egen tabell som heter "fakturaer" i veterinær-oppsettet.
    // Derfor lagres faktureringen på journalene (fakturert + fakturanr), som allerede brukes i oversikten.
    const fakturaRad = {
      fakturanr,
      kunden_id: String(eierId),
      dato: fakturaDato,
      forfallsdato,
      eks_mva: sumEks,
      mva,
      inkl_mva: sumInk,
      er_kreditnota: false,
      status: "fakturert",
      betalingsstatus: "ubetalt"
    };

    const { error: journalUpdateError } = await supabaseClient
      .from("vet_journal")
      .update({ fakturert: true, fakturanr })
      .in("id", journalIds);
    if (journalUpdateError) throw new Error("Fakturaen ble laget, men journalene ble ikke merket som fakturert: " + journalUpdateError.message);

    journaler.forEach(j => { j.fakturert = true; j.fakturanr = fakturanr; });
    vetFakturaer = vetFakturaer || [];
    vetFakturaer.push(fakturaRad);

    const logoHtml = klinikk.logo_url
      ? `<img src="${htmlEscape(klinikk.logo_url)}" alt="Logo" style="max-height:90px; max-width:260px; object-fit:contain;">`
      : "";
    const linjerHtml = linjer.map(l => `
      <tr>
        <td>${htmlEscape(l.tekst)}</td>
        <td>${htmlEscape(l.behandler || "")}</td>
        <td class="right">${formaterKr(l.antall)}</td>
        <td class="right">${formaterKr(l.pris)}</td>
        <td class="right">${formaterKr(l.sum)}</td>
      </tr>
    `).join("");

    const printHtml = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<title>Faktura ${htmlEscape(fakturanr)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
  .topp { display:flex; justify-content:space-between; gap:30px; align-items:flex-start; border-bottom:2px solid #222; padding-bottom:18px; }
  .logo { margin-bottom:10px; }
  h1 { margin:0; font-size:30px; letter-spacing:1px; }
  .boks { margin-top:22px; display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  .kort-print { border:1px solid #ddd; padding:14px; }
  table { width:100%; border-collapse:collapse; margin-top:24px; font-size:14px; }
  th, td { padding:8px; border-bottom:1px solid #ddd; vertical-align:top; }
  th { text-align:left; background:#f4f6f8; }
  .right { text-align:right; }
  .summer { margin-left:auto; margin-top:20px; width:320px; }
  .summer td { border-bottom:0; padding:5px 0; }
  .total { font-size:18px; font-weight:bold; border-top:2px solid #222; padding-top:8px; }
  @media print { button { display:none; } body { margin:0; } }
</style>
</head>
<body>
  <div class="topp"><div><div class="logo">${logoHtml}</div><strong>${htmlEscape(klinikk.navn || "Klinikk")}</strong><br>${htmlEscape(klinikk.adresse || "")}<br>${htmlEscape(klinikk.telefon || "")} ${htmlEscape(klinikk.epost || "")}</div><div class="right"><h1>FAKTURA</h1><p><strong>Fakturanr:</strong> ${htmlEscape(fakturanr)}<br><strong>Dato:</strong> ${htmlEscape(fakturaDato)}<br><strong>Forfall:</strong> ${htmlEscape(forfallsdato)}</p></div></div>
  <div class="boks"><div class="kort-print"><strong>Kunde</strong><br>${htmlEscape(eier?.navn || "")}<br>${htmlEscape(eier?.adresse || "")}<br>${htmlEscape(eier?.epost || "")} ${htmlEscape(eier?.telefon || "")}</div><div class="kort-print"><strong>Gjelder</strong><br>Veterinærbehandling, kjøring og varer/medisiner fra journal.<br><strong>Behandler:</strong> ${htmlEscape(behandlere || "Ukjent")}</div></div>
  <table><thead><tr><th>Beskrivelse</th><th>Behandler</th><th class="right">Antall</th><th class="right">Pris eks. mva</th><th class="right">Sum eks. mva</th></tr></thead><tbody>${linjerHtml}</tbody></table>
  <table class="summer"><tr><td>Sum eks. mva</td><td class="right">${formaterKr(sumEks)} kr</td></tr><tr><td>Mva 25%</td><td class="right">${formaterKr(mva)} kr</td></tr><tr><td class="total">Å betale</td><td class="right total">${formaterKr(sumInk)} kr</td></tr></table>
  ${hentFakturaVippsHtml(klinikk)}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

    vindu.document.open();
    vindu.document.write(printHtml);
    vindu.document.close();
    vetMelding("adminOkonomiMelding", "Faktura opprettet: " + fakturanr);
    lukkVetFakturaVisning();
    if (typeof tegnAdminOkonomiOversikt === "function") tegnAdminOkonomiOversikt();
    if (typeof tegnAdminMvaOversikt === "function") tegnAdminMvaOversikt();
  } catch (err) {
    try {
      vindu.document.open();
      vindu.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Feil</title></head><body><p>${htmlEscape(err.message || String(err))}</p></body></html>`);
      vindu.document.close();
    } catch(e) {}
    vetMelding("adminOkonomiMelding", err.message || String(err));
  }
}

function skrivUtVetFakturaFraOversikt(fakturanr) {
  vetMelding("adminOkonomiMelding", "");
  const journaler = (vetJournal || []).filter(j => String(j.fakturanr || "").trim() === String(fakturanr || "").trim());
  const linjer = lagFakturaLinjerFraJournaler(journaler);
  let faktura = finnVetFakturaFraFakturanr(fakturanr);

  if (faktura && erKreditnotaFaktura(faktura)) {
    vetMelding("adminOkonomiMelding", "Valgt rad er en kreditnota.");
    return;
  }

  if (!faktura && !journaler.length) {
    vetMelding("adminOkonomiMelding", "Fant ikke fakturaen.");
    return;
  }

  const fallbackEierId = journaler.length ? finnDyreeierIdForJournal(journaler[0]) : "";
  const fallbackKunde = (vetDyreeiere || []).find(e => String(e.id) === String(fallbackEierId)) || {};
  const fallbackSumEks = linjer.reduce((sum, l) => sum + Number(l.sum || 0), 0);
  if (!faktura) {
    faktura = {
      fakturanr,
      kunden_id: fallbackEierId,
      eks_mva: fallbackSumEks,
      mva: fallbackSumEks * 0.25,
      inkl_mva: fallbackSumEks * 1.25
    };
  }

  const kunde = finnFakturaKunde(faktura) || fallbackKunde || {};
  const klinikk = hentFakturaKlinikk();
  const fakturaDato = faktura.dato || "";
  const forfallsdato = faktura.forfallsdato || faktura.forfall || "";
  const sumEks = Number(faktura.eks_mva || fallbackSumEks || 0);
  const mva = Number(faktura.mva || (sumEks * 0.25));
  const sumInk = Number(faktura.inkl_mva || (sumEks + mva));

  const logoHtml = klinikk.logo_url
    ? `<img src="${htmlEscape(klinikk.logo_url)}" alt="Logo" style="max-height:90px; max-width:260px; object-fit:contain;">`
    : "";

  const linjerHtml = linjer.length ? linjer.map(l => `
    <tr>
      <td>${htmlEscape(l.tekst)}</td>
      <td>${htmlEscape(l.behandler || "")}</td>
      <td class="right">${formaterKr(l.antall)}</td>
      <td class="right">${formaterKr(l.pris)}</td>
      <td class="right">${formaterKr(l.sum)}</td>
    </tr>
  `).join("") : `
    <tr>
      <td>Faktura ${htmlEscape(fakturanr)}</td>
      <td></td>
      <td class="right">1</td>
      <td class="right">${formaterKr(sumEks)}</td>
      <td class="right">${formaterKr(sumEks)}</td>
    </tr>
  `;

  const printHtml = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<title>Faktura ${htmlEscape(fakturanr)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
  .topp { display:flex; justify-content:space-between; gap:30px; align-items:flex-start; border-bottom:2px solid #222; padding-bottom:18px; }
  .logo { margin-bottom:10px; }
  h1 { margin:0; font-size:30px; letter-spacing:1px; }
  .boks { margin-top:22px; display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  .kort-print { border:1px solid #ddd; padding:14px; }
  table { width:100%; border-collapse:collapse; margin-top:24px; font-size:14px; }
  th, td { padding:8px; border-bottom:1px solid #ddd; vertical-align:top; }
  th { text-align:left; background:#f4f6f8; }
  .right { text-align:right; }
  .summer { margin-left:auto; margin-top:20px; width:320px; }
  .summer td { border-bottom:0; padding:5px 0; }
  .total { font-size:18px; font-weight:bold; border-top:2px solid #222; padding-top:8px; }
  @media print { button { display:none; } body { margin:0; } }
</style>
</head>
<body>
  <div class="topp">
    <div>
      <div class="logo">${logoHtml}</div>
      <strong>${htmlEscape(klinikk.navn || "Klinikk")}</strong><br>
      ${htmlEscape(klinikk.adresse || "")}<br>
      ${htmlEscape(klinikk.telefon || "")} ${htmlEscape(klinikk.epost || "")}
    </div>
    <div class="right">
      <h1>FAKTURA</h1>
      <p><strong>Fakturanr:</strong> ${htmlEscape(fakturanr)}<br>
      <strong>Dato:</strong> ${htmlEscape(fakturaDato)}<br>
      <strong>Forfall:</strong> ${htmlEscape(forfallsdato)}</p>
    </div>
  </div>

  <div class="boks">
    <div class="kort-print">
      <strong>Kunde</strong><br>
      ${htmlEscape(kunde.navn || "")}<br>
      ${htmlEscape(kunde.adresse || "")}<br>
      ${htmlEscape(kunde.epost || "")} ${htmlEscape(kunde.telefon || "")}
    </div>
    <div class="kort-print">
      <strong>Gjelder</strong><br>
      Veterinærbehandling, kjøring og varer/medisiner fra journal.
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Beskrivelse</th>
        <th>Behandler</th>
        <th class="right">Antall</th>
        <th class="right">Pris eks. mva</th>
        <th class="right">Sum eks. mva</th>
      </tr>
    </thead>
    <tbody>${linjerHtml}</tbody>
  </table>

  <table class="summer">
    <tr><td>Sum eks. mva</td><td class="right">${formaterKr(sumEks)} kr</td></tr>
    <tr><td>Mva 25%</td><td class="right">${formaterKr(mva)} kr</td></tr>
    <tr><td class="total">Å betale</td><td class="right total">${formaterKr(sumInk)} kr</td></tr>
  </table>

  ${hentFakturaVippsHtml(klinikk)}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const vindu = window.open("", "_blank");
  if (!vindu) {
    vetMelding("adminOkonomiMelding", "Kunne ikke åpne faktura. Tillat popup-vindu for siden.");
    return;
  }
  vindu.document.open();
  vindu.document.write(printHtml);
  vindu.document.close();
}

async function lagVetKreditnotaFraOversiktFaktura(fakturanr) {
  vetMelding("adminOkonomiMelding", "");
  const faktura = finnVetFakturaFraFakturanr(fakturanr);
  if (!faktura) {
    vetMelding("adminOkonomiMelding", "Fant ikke fakturaen.");
    return;
  }
  if (erKreditnotaFaktura(faktura)) {
    vetMelding("adminOkonomiMelding", "Denne er allerede en kreditnota.");
    return;
  }
  const allerede = (vetFakturaer || []).find(f => String(f.kreditnota_for || "") === String(faktura.id));
  if (allerede) {
    vetMelding("adminOkonomiMelding", "Denne fakturaen har allerede kreditnota: " + (allerede.fakturanr || ""));
    return;
  }
  if (!confirm(`Lage kreditnota for faktura ${fakturanr}?`)) return;

  if (typeof fyllKreditnotaFakturaValg === "function") fyllKreditnotaFakturaValg();
  vetSett("kreditnotaFakturaValg", faktura.id);
  await lagVetKreditnota();
  if (typeof tegnAdminOkonomiOversikt === "function") tegnAdminOkonomiOversikt();
  if (typeof tegnAdminMvaOversikt === "function") tegnAdminMvaOversikt();
}

window.visVetFakturaFraOversikt = visVetFakturaFraOversikt;
window.lukkVetFakturaVisning = lukkVetFakturaVisning;
window.fakturerVetJournalFraOversikt = fakturerVetJournalFraOversikt;
window.skrivUtVetFakturaFraOversikt = skrivUtVetFakturaFraOversikt;
window.lagVetKreditnotaFraOversiktFaktura = lagVetKreditnotaFraOversiktFaktura;

/* ===== Oversikt: sett betalt og purring via fakturanr ===== */
function finnVetFakturaFraFakturanr(fakturanr) {
  const nr = String(fakturanr || "").trim();
  if (!nr) return null;

  return (vetFakturaer || []).find(f => {
    const fnr = String(f.fakturanr || f.faktura_nr || f.faktura_nummer || "").trim();
    return fnr === nr;
  }) || null;
}

async function settVetFakturaBetaltFraOversiktFaktura(fakturanr) {
  vetMelding("adminOkonomiMelding", "");

  const faktura = finnVetFakturaFraFakturanr(fakturanr);
  if (!faktura) {
    vetMelding("adminOkonomiMelding", "Fant ikke fakturaen.");
    return;
  }

  const iDag = new Date().toISOString().slice(0, 10);

  const { error } = await supabaseClient
    .from("fakturaer")
    .update({
      status: "betalt",
      betalingsstatus: "betalt",
      betalt_dato: iDag
    })
    .eq("id", faktura.id);

  if (error) {
    vetMelding("adminOkonomiMelding", "Kunne ikke sette betalt: " + error.message);
    return;
  }

  vetMelding("adminOkonomiMelding", "Faktura er satt som betalt.");
  await lastVetFakturaer();
  tegnAdminOkonomiOversikt();
  if (typeof tegnAdminMvaOversikt === "function") tegnAdminMvaOversikt();
}

function lagVetPurringFraOversiktFaktura(fakturanr) {
  vetMelding("adminOkonomiMelding", "");

  const faktura = finnVetFakturaFraFakturanr(fakturanr);
  if (!faktura) {
    vetMelding("adminOkonomiMelding", "Fant ikke fakturaen.");
    return;
  }

  if (erKreditnotaFaktura(faktura)) {
    vetMelding("adminOkonomiMelding", "Du kan ikke lage purring på en kreditnota.");
    return;
  }

  skrivUtVetPurring(faktura);
}


function fakturaDatoKort(f) {
  const verdi = f?.dato;
  if (!verdi) return "";
  const tekst = String(verdi);
  if (/^\d{4}-\d{2}-\d{2}/.test(tekst)) return tekst.slice(0, 10);
  const d = new Date(verdi);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function erKreditnotaFaktura(f) {
  const verdi = f?.er_kreditnota;
  return verdi === true || String(verdi).toLowerCase() === "true" || String(verdi) === "1";
}

function mvaBelopMedFortegn(f, felt) {
  const tall = Number(f?.[felt] || 0);
  if (!Number.isFinite(tall)) return 0;

  // Faktura = positivt salg / utgående MVA.
  // Kreditnota skal trekkes fra salget.
  // Hvis kreditnota allerede er lagret med negative tall, beholdes negativt fortegn.
  if (erKreditnotaFaktura(f)) return tall > 0 ? -tall : tall;
  return tall;
}

function hentMvaFakturaer() {
  const fra = vetTekst("adminOkonomiFraDato");
  const til = vetTekst("adminOkonomiTilDato");

  return (vetFakturaer || []).filter(f => {
    const dato = fakturaDatoKort(f);
    if (fra && dato && dato < fra) return false;
    if (til && dato && dato > til) return false;
    return true;
  });
}

function tegnAdminMvaOversikt() {
  const summer = document.getElementById("adminMvaSummer");
  const liste = document.getElementById("adminMvaListe");
  if (!summer || !liste) return;

  const fakturaer = hentMvaFakturaer();
  const fakturaAntall = fakturaer.filter(f => !erKreditnotaFaktura(f)).length;
  const kreditnotaAntall = fakturaer.filter(erKreditnotaFaktura).length;

  const sumEks = fakturaer.reduce((s, f) => s + mvaBelopMedFortegn(f, "eks_mva"), 0);
  const sumMva = fakturaer.reduce((s, f) => s + mvaBelopMedFortegn(f, "mva"), 0);
  const sumInkl = fakturaer.reduce((s, f) => s + mvaBelopMedFortegn(f, "inkl_mva"), 0);

  const inngaaendeMva = 0;
  const mvaAaBetale = sumMva - inngaaendeMva;

  summer.innerHTML = `
    <div class="okonomi-boks">Salg eks. mva<strong>${formaterKr(sumEks)} kr</strong><span class="lite">${fakturaAntall} faktura(er), ${kreditnotaAntall} kreditnota(er) trukket fra</span></div>
    <div class="okonomi-boks">Utgående MVA<strong>${formaterKr(sumMva)} kr</strong><span class="lite">Fra fakturaer og kreditnotaer</span></div>
    <div class="okonomi-boks">Inngående MVA<strong>${formaterKr(inngaaendeMva)} kr</strong><span class="lite">Kommer fra innkjøp senere</span></div>
    <div class="okonomi-boks">MVA å betale<strong>${formaterKr(mvaAaBetale)} kr</strong><span class="lite">Utgående minus inngående</span></div>
    <div class="okonomi-boks">Salg inkl. mva<strong>${formaterKr(sumInkl)} kr</strong><span class="lite">Kreditnota trekkes fra automatisk</span></div>
  `;

  if (!fakturaer.length) {
    liste.innerHTML = '<p class="lite">Ingen fakturaer funnet for valgt periode.</p>';
    return;
  }

  const grupper = {};
  fakturaer.forEach(f => {
    const dato = fakturaDatoKort(f);
    const key = dato ? dato.slice(0, 7) : "Uten dato";
    if (!grupper[key]) grupper[key] = { antall: 0, kreditnota: 0, eks: 0, mva: 0, inkl: 0 };
    if (erKreditnotaFaktura(f)) grupper[key].kreditnota += 1;
    else grupper[key].antall += 1;
    grupper[key].eks += mvaBelopMedFortegn(f, "eks_mva");
    grupper[key].mva += mvaBelopMedFortegn(f, "mva");
    grupper[key].inkl += mvaBelopMedFortegn(f, "inkl_mva");
  });

  const rader = Object.entries(grupper)
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])));

  liste.innerHTML = `
    <table class="okonomi-tabell">
      <thead>
        <tr>
          <th>Periode</th>
          <th style="text-align:right;">Faktura</th>
          <th style="text-align:right;">Kreditnota</th>
          <th style="text-align:right;">Eks. mva</th>
          <th style="text-align:right;">Utgående MVA</th>
          <th style="text-align:right;">Inngående MVA</th>
          <th style="text-align:right;">MVA å betale</th>
          <th style="text-align:right;">Inkl. mva</th>
        </tr>
      </thead>
      <tbody>
        ${rader.map(([periode, r]) => `
          <tr>
            <td>${htmlEscape(periode)}</td>
            <td style="text-align:right;">${r.antall}</td>
            <td style="text-align:right;">${r.kreditnota}</td>
            <td style="text-align:right;">${formaterKr(r.eks)} kr</td>
            <td style="text-align:right;">${formaterKr(r.mva)} kr</td>
            <td style="text-align:right;">${formaterKr(0)} kr</td>
            <td style="text-align:right;">${formaterKr(r.mva)} kr</td>
            <td style="text-align:right;">${formaterKr(r.inkl)} kr</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function htmlEscape(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fyllFakturaDyreeierValg() {
  const valg = document.getElementById("fakturaDyreeierValg");
  if (!valg) return;

  const valgt = valg.value;
  valg.innerHTML = '<option value="">Velg dyreeier</option>' + vetDyreeiere
    .map(e => `<option value="${e.id}">${htmlEscape(e.navn || "")}</option>`)
    .join("");

  if (valgt) valg.value = valgt;
}

function settStandardFakturaDatoer() {
  const datoEl = document.getElementById("fakturaDato");
  const forfallEl = document.getElementById("fakturaForfallsdato");
  const iDag = new Date();
  const forfall = new Date();
  forfall.setDate(forfall.getDate() + 14);

  if (datoEl && !datoEl.value) datoEl.value = iDag.toISOString().slice(0, 10);
  if (forfallEl && !forfallEl.value) forfallEl.value = forfall.toISOString().slice(0, 10);
}

function hentFakturaEier() {
  const eierId = vetTekst("fakturaDyreeierValg");
  return vetDyreeiere.find(e => String(e.id) === String(eierId)) || null;
}

function hentFakturaJournaler(inkluderFakturerte = false) {
  const eier = hentFakturaEier();
  if (!eier) return [];

  const dyreIds = vetDyr
    .filter(d => String(d.dyreeier_id) === String(eier.id))
    .map(d => String(d.id));

  return vetJournal
    .filter(j => dyreIds.includes(String(j.dyr_id)))
    .filter(j => inkluderFakturerte || !journalErFakturert(j))
    .sort((a, b) => String(a.dato || "").localeCompare(String(b.dato || "")));
}

function lagFakturaLinjerFraJournaler(journaler) {
  const linjer = [];

  journaler.forEach(j => {
    const dyr = vetDyr.find(d => String(d.id) === String(j.dyr_id));
    const dyrNavn = dyr?.navn || j.vet_dyr?.navn || "Dyr";
    const dato = j.dato || "";
    const type = j.type || "Behandling";
    const behandler = finnBehandlerNavnForJournal(j);

    const fastpris = Number(j.fastpris || 0);
    if (fastpris > 0) {
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: ${type}`,
        behandler,
        antall: 1,
        pris: fastpris,
        sum: fastpris
      });
    }

    const timepris = Number(j.timepris || 0);
    const timer = Number(j.timer || 0);
    if (timepris > 0 && timer > 0) {
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: Timearbeid`,
        behandler,
        antall: timer,
        pris: timepris,
        sum: timer * timepris
      });
    }

    const km = Number(j.km || 0);
    const kmPris = Number(j.km_pris || 0);
    if (km > 0 && kmPris > 0) {
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: Kjøring`,
        behandler,
        antall: km,
        pris: kmPris,
        sum: km * kmPris
      });
    }

    (j.vet_journal_varer || []).forEach(v => {
      const antall = Number(v.antall || 0);
      const pris = Number(v.pris || 0);
      const sum = Number(v.sum_eks_mva || (antall * pris));
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: ${v.varenavn || "Vare/medisin"}`,
        behandler,
        antall,
        pris,
        sum
      });
    });

    if (Number(j.belop_eks_mva || 0) > 0 && fastpris <= 0 && !(timepris > 0 && timer > 0) && !(km > 0 && kmPris > 0)) {
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: ${type}`,
        behandler,
        antall: 1,
        pris: Number(j.belop_eks_mva || 0),
        sum: Number(j.belop_eks_mva || 0)
      });
    }
  });

  return linjer;
}

function tegnFakturaGrunnlag() {
  const liste = document.getElementById("fakturaGrunnlagListe");
  if (!liste) return;

  const eier = hentFakturaEier();
  if (!eier) {
    liste.innerHTML = '<p class="lite">Velg dyreeier for å se fakturagrunnlag.</p>';
    return;
  }

  const journaler = hentFakturaJournaler();
  const linjer = lagFakturaLinjerFraJournaler(journaler);

  if (!journaler.length || !linjer.length) {
    liste.innerHTML = '<p class="lite">Fant ingen journaler med beløp for valgt dyreeier.</p>';
    return;
  }

  const sumEks = linjer.reduce((sum, l) => sum + Number(l.sum || 0), 0);
  const behandlere = [...new Set(linjer.map(l => l.behandler).filter(Boolean))].join(", ");
  const mva = sumEks * 0.25;
  const sumInk = sumEks + mva;

  liste.innerHTML = `
    <div class="listekort">
      <strong>Fakturagrunnlag for ${htmlEscape(eier.navn || "")}</strong><br>
      <span class="lite">${journaler.length} journal(er), ${linjer.length} fakturalinje(r)</span>
      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px;">Tekst</th>
            <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px;">Behandler</th>
            <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Antall</th>
            <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Pris</th>
            <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Sum</th>
          </tr>
        </thead>
        <tbody>
          ${linjer.map(l => `
            <tr>
              <td style="padding:6px; border-bottom:1px solid #eee;">${htmlEscape(l.tekst)}</td>
              <td style="padding:6px; border-bottom:1px solid #eee;">${htmlEscape(l.behandler || "")}</td>
              <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${formaterKr(l.antall)}</td>
              <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${formaterKr(l.pris)}</td>
              <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${formaterKr(l.sum)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p style="text-align:right;"><strong>Eks. mva:</strong> ${formaterKr(sumEks)} kr<br>
      <strong>Mva 25%:</strong> ${formaterKr(mva)} kr<br>
      <strong>Å betale:</strong> ${formaterKr(sumInk)} kr</p>
    </div>
  `;
}

function hentFakturaKlinikk() {
  if (vetAktivKlinikk) return vetAktivKlinikk;
  const valgt = hentValgtKlinikk();
  if (valgt) return valgt;
  const journaler = hentFakturaJournaler();
  const klinikkId = journaler.find(j => j.klinikk_id)?.klinikk_id || vetAktivKlinikkId;
  return vetKlinikker.find(k => String(k.id) === String(klinikkId)) || vetKlinikker[0] || {};
}

function hentFakturaVippsHtml(klinikk) {
  const k = klinikk || {};
  const klinikkId = k.id || vetAktivKlinikkId || vetTekst("klinikkId");
  const vippsNr = k.vipps_nr || (klinikkId ? localStorage.getItem("vetVipps_" + klinikkId + "_nr") : "") || vetTekst("klinikkVippsNr") || "";
  const vippsTil = k.vipps_til || (klinikkId ? localStorage.getItem("vetVipps_" + klinikkId + "_til") : "") || vetTekst("klinikkVippsTil") || k.navn || "";

  if (!vippsNr && !vippsTil) return "";

  return `
  <div class="vipps-boks">
    <div class="vipps-tittel">Betal med Vipps</div>
    ${vippsNr ? `<div><strong>Vipps nr:</strong> ${htmlEscape(vippsNr)}</div>` : ""}
    ${vippsTil ? `<div><strong>Vipps til:</strong> ${htmlEscape(vippsTil)}</div>` : ""}
  </div>`;
}


function fyllKreditnotaFakturaValg() {
  const valg = document.getElementById("kreditnotaFakturaValg");
  if (!valg) return;

  const valgt = valg.value;
  const fakturaer = (vetFakturaer || [])
    .filter(f => !erKreditnotaFaktura(f))
    .sort((a, b) => String(fakturaDatoKort(b)).localeCompare(String(fakturaDatoKort(a))));

  if (!fakturaer.length) {
    valg.innerHTML = '<option value="">Ingen fakturaer funnet</option>';
    return;
  }

  valg.innerHTML = '<option value="">Velg faktura</option>' + fakturaer.map(f => {
    const nr = f.fakturanr || f.id;
    const dato = fakturaDatoKort(f);
    const sum = formaterKr(f.inkl_mva || 0);
    return `<option value="${f.id}">${htmlEscape(nr)}${dato ? " - " + htmlEscape(dato) : ""} - ${sum} kr</option>`;
  }).join("");

  if (valgt && fakturaer.some(f => String(f.id) === String(valgt))) valg.value = valgt;

  // Legg til purring-knapp automatisk ved fakturavalget hvis HTML ikke allerede har egen knapp.
  const forelder = valg.parentElement;
  if (forelder && !document.getElementById("vetPurringKnapp")) {
    const knapp = document.createElement("button");
    knapp.id = "vetPurringKnapp";
    knapp.type = "button";
    knapp.textContent = "Lag purring";
    knapp.style.marginLeft = "8px";
    knapp.onclick = lagVetPurring;
    forelder.appendChild(knapp);
  }
}

function hentValgtKreditnotaFaktura() {
  const id = vetTekst("kreditnotaFakturaValg");
  if (!id) return null;
  return (vetFakturaer || []).find(f => String(f.id) === String(id)) || null;
}

async function lagVetKreditnota() {
  vetMelding("fakturaMelding", "");
  const original = hentValgtKreditnotaFaktura();
  if (!original) {
    vetMelding("fakturaMelding", "Velg faktura som skal krediteres.");
    return;
  }

  const allerede = (vetFakturaer || []).find(f => String(f.kreditnota_for || "") === String(original.id));
  if (allerede) {
    vetMelding("fakturaMelding", "Denne fakturaen har allerede kreditnota: " + (allerede.fakturanr || ""));
    skrivUtVetKreditnota(original, allerede.fakturanr || "KREDITNOTA");
    return;
  }

  const kreditnr = `K-${original.fakturanr || new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12)}`;
  const rad = {
    fakturanr: kreditnr,
    kunden_id: original.kunden_id || null,
    dato: new Date().toISOString(),
    eks_mva: Number(original.eks_mva || 0),
    mva: Number(original.mva || 0),
    inkl_mva: Number(original.inkl_mva || 0),
    er_kreditnota: true,
    kreditnota_for: original.id,
    status: "kreditnota",
    betalingsstatus: "kreditert"
  };

  const { error } = await supabaseClient.from("fakturaer").insert(rad);
  if (error) {
    vetMelding("fakturaMelding", "Kunne ikke lagre kreditnota: " + error.message);
    return;
  }

  vetMelding("fakturaMelding", "Kreditnota laget: " + kreditnr);
  await lastVetFakturaer();
  fyllKreditnotaFakturaValg();
  tegnAdminMvaOversikt();
  skrivUtVetKreditnota(original, kreditnr);
}

function skrivUtVetKreditnota(original, kreditnr) {
  const klinikk = hentFakturaKlinikk();
  const dato = new Date().toISOString().slice(0, 10);
  const eks = Number(original.eks_mva || 0);
  const mva = Number(original.mva || 0);
  const inkl = Number(original.inkl_mva || 0);
  const logoHtml = klinikk.logo_url
    ? `<img src="${htmlEscape(klinikk.logo_url)}" alt="Logo" style="max-height:90px; max-width:260px; object-fit:contain;">`
    : "";

  const printHtml = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<title>Kreditnota ${htmlEscape(kreditnr)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
  .topp { display:flex; justify-content:space-between; gap:30px; align-items:flex-start; border-bottom:2px solid #222; padding-bottom:18px; }
  h1 { margin:0; font-size:30px; letter-spacing:1px; }
  table { width:100%; border-collapse:collapse; margin-top:24px; font-size:14px; }
  th, td { padding:8px; border-bottom:1px solid #ddd; vertical-align:top; }
  th { text-align:left; background:#f4f6f8; }
  .right { text-align:right; }
  .summer { margin-left:auto; margin-top:20px; width:340px; }
  .summer td { border-bottom:0; padding:5px 0; }
  .total { font-size:18px; font-weight:bold; border-top:2px solid #222; padding-top:8px; }
  .vipps-boks { margin-top:28px; padding:14px 16px; border:2px solid #d00; border-radius:8px; max-width:360px; }
  .vipps-tittel { color:#d00; font-size:22px; font-weight:bold; margin-bottom:8px; }

  @page {
    margin: 18mm;
    @bottom-right {
      content: "Side " counter(page) " av " counter(pages);
      font-family: Arial, sans-serif;
      font-size: 9px;
      color: #555;
    }
  }
  @media print {
    .utskrift-sideinfo { display:none; }
  }
  @media print { button { display:none; } body { margin:0; } }
</style>
</head>
<body>
  <div class="topp">
    <div>
      ${logoHtml}<br>
      <strong>${htmlEscape(klinikk.navn || "Klinikk")}</strong><br>
      ${htmlEscape(klinikk.adresse || "")}<br>
      ${htmlEscape(klinikk.telefon || "")} ${htmlEscape(klinikk.epost || "")}
    </div>
    <div class="right">
      <h1>KREDITNOTA</h1>
      <p><strong>Kreditnotanr:</strong> ${htmlEscape(kreditnr)}<br>
      <strong>Dato:</strong> ${htmlEscape(dato)}<br>
      <strong>Krediterer faktura:</strong> ${htmlEscape(original.fakturanr || original.id)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Beskrivelse</th><th class="right">Eks. mva</th><th class="right">MVA</th><th class="right">Inkl. mva</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Kreditering av faktura ${htmlEscape(original.fakturanr || original.id)}</td>
        <td class="right">-${formaterKr(eks)} kr</td>
        <td class="right">-${formaterKr(mva)} kr</td>
        <td class="right">-${formaterKr(inkl)} kr</td>
      </tr>
    </tbody>
  </table>

  <table class="summer">
    <tr><td>Sum eks. mva</td><td class="right">-${formaterKr(eks)} kr</td></tr>
    <tr><td>MVA</td><td class="right">-${formaterKr(mva)} kr</td></tr>
    <tr><td class="total">Sum kreditert</td><td class="right total">-${formaterKr(inkl)} kr</td></tr>
  </table>

  ${hentFakturaVippsHtml(klinikk)}

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const vindu = window.open("", "_blank");
  if (!vindu) {
    vetMelding("fakturaMelding", "Kunne ikke åpne kreditnota. Tillat popup-vindu for siden.");
    return;
  }
  vindu.document.open();
  vindu.document.write(printHtml);
  vindu.document.close();
}

async function skrivUtVetFaktura() {
  vetMelding("fakturaMelding", "");
  settStandardFakturaDatoer();

  // Sørg for at behandlerlisten er lastet før fakturalinjer bygges.
  // Uten dette kan Behandler-kolonnen bli tom selv om opprettet_av finnes.
  if (!vetAlleKlinikkBrukere.length) {
    await lastVetKlinikkBrukereAlle();
  }

  const eier = hentFakturaEier();
  if (!eier) {
    vetMelding("fakturaMelding", "Velg dyreeier først.");
    return;
  }

  const journaler = hentFakturaJournaler();
  const linjer = lagFakturaLinjerFraJournaler(journaler);
  if (!linjer.length) {
    vetMelding("fakturaMelding", "Fant ingen fakturalinjer for valgt dyreeier.");
    return;
  }

  const vindu = window.open("", "_blank");
  if (!vindu) {
    vetMelding("fakturaMelding", "Kunne ikke åpne utskrift. Tillat popup-vindu for siden.");
    return;
  }
  vindu.document.open();
  vindu.document.write("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Lager faktura</title></head><body><p>Lager og lagrer faktura...</p></body></html>");
  vindu.document.close();

  const klinikk = hentFakturaKlinikk();
  const fakturaDato = vetTekst("fakturaDato") || new Date().toISOString().slice(0, 10);
  const forfallsdato = vetTekst("fakturaForfallsdato") || fakturaDato;
  const fakturanr = `VET-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12)}`;
  const sumEks = linjer.reduce((sum, l) => sum + Number(l.sum || 0), 0);
  const behandlere = [...new Set(linjer.map(l => l.behandler).filter(Boolean))].join(", ");
  const mva = sumEks * 0.25;
  const sumInk = sumEks + mva;

  const journalIds = journaler.map(j => j.id).filter(Boolean);
  if (!journalIds.length) {
    vetMelding("fakturaMelding", "Fant ingen journaler som kan merkes som fakturert.");
    return;
  }

  const fakturaRad = {
    fakturanr,
    kunden_id: String(eier.id),
    dato: fakturaDato,
    forfallsdato,
    eks_mva: sumEks,
    mva,
    inkl_mva: sumInk,
    er_kreditnota: false,
    status: "fakturert",
    betalingsstatus: "ubetalt"
  };

  const { error: fakturaError } = await supabaseClient
    .from("fakturaer")
    .insert(fakturaRad);

  if (fakturaError) {
    vetMelding("fakturaMelding", "Faktura ble ikke lagret: " + fakturaError.message);
    return;
  }

  const { error: journalUpdateError } = await supabaseClient
    .from("vet_journal")
    .update({ fakturert: true, fakturanr })
    .in("id", journalIds);

  if (journalUpdateError) {
    vetMelding("fakturaMelding", "Faktura ble lagret, men journalene ble ikke merket som fakturert: " + journalUpdateError.message);
    return;
  }

  const logoHtml = klinikk.logo_url
    ? `<img src="${htmlEscape(klinikk.logo_url)}" alt="Logo" style="max-height:90px; max-width:260px; object-fit:contain;">`
    : "";

  const printHtml = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<title>Faktura ${htmlEscape(fakturanr)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
  .topp { display:flex; justify-content:space-between; gap:30px; align-items:flex-start; border-bottom:2px solid #222; padding-bottom:18px; }
  .logo { margin-bottom:10px; }
  h1 { margin:0; font-size:30px; letter-spacing:1px; }
  .boks { margin-top:22px; display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  .kort-print { border:1px solid #ddd; border-radius:0; padding:14px; }
  table { width:100%; border-collapse:collapse; margin-top:24px; font-size:14px; }
  th, td { padding:8px; border-bottom:1px solid #ddd; vertical-align:top; }
  th { text-align:left; background:#f4f6f8; }
  .right { text-align:right; }
  .summer { margin-left:auto; margin-top:20px; width:320px; }
  .summer td { border-bottom:0; padding:5px 0; }
  .total { font-size:18px; font-weight:bold; border-top:2px solid #222; padding-top:8px; }
  .vipps-boks { margin-top:28px; padding:14px 16px; border:2px solid #d00; border-radius:8px; max-width:360px; }
  .vipps-tittel { color:#d00; font-size:22px; font-weight:bold; margin-bottom:8px; }

  @page {
    margin: 18mm;
    @bottom-right {
      content: "Side " counter(page) " av " counter(pages);
      font-family: Arial, sans-serif;
      font-size: 9px;
      color: #555;
    }
  }
  @media print {
    .utskrift-sideinfo { display:none; }
  }
  @media print { button { display:none; } body { margin:0; } }
</style>
</head>
<body>
  <div class="topp">
    <div>
      <div class="logo">${logoHtml}</div>
      <strong>${htmlEscape(klinikk.navn || "Klinikk")}</strong><br>
      ${htmlEscape(klinikk.adresse || "")}<br>
      ${htmlEscape(klinikk.telefon || "")} ${htmlEscape(klinikk.epost || "")}
    </div>
    <div class="right">
      <h1>FAKTURA</h1>
      <p><strong>Fakturanr:</strong> ${htmlEscape(fakturanr)}<br>
      <strong>Dato:</strong> ${htmlEscape(fakturaDato)}<br>
      <strong>Forfall:</strong> ${htmlEscape(forfallsdato)}</p>
    </div>
  </div>

  <div class="boks">
    <div class="kort-print">
      <strong>Kunde</strong><br>
      ${htmlEscape(eier.navn || "")}<br>
      ${htmlEscape(eier.adresse || "")}<br>
      ${htmlEscape(eier.epost || "")} ${htmlEscape(eier.telefon || "")}
    </div>
    <div class="kort-print">
      <strong>Gjelder</strong><br>
      Veterinærbehandling, kjøring og varer/medisiner fra journal.<br>
      <strong>Behandler:</strong> ${htmlEscape(behandlere || "Ukjent")}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Beskrivelse</th>
        <th>Behandler</th>
        <th class="right">Antall</th>
        <th class="right">Pris eks. mva</th>
        <th class="right">Sum eks. mva</th>
      </tr>
    </thead>
    <tbody>
      ${linjer.map(l => `
        <tr>
          <td>${htmlEscape(l.tekst)}</td>
          <td>${htmlEscape(l.behandler || "")}</td>
          <td class="right">${formaterKr(l.antall)}</td>
          <td class="right">${formaterKr(l.pris)}</td>
          <td class="right">${formaterKr(l.sum)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <table class="summer">
    <tr><td>Sum eks. mva</td><td class="right">${formaterKr(sumEks)} kr</td></tr>
    <tr><td>Mva 25%</td><td class="right">${formaterKr(mva)} kr</td></tr>
    <tr><td class="total">Å betale</td><td class="right total">${formaterKr(sumInk)} kr</td></tr>
  </table>

  ${hentFakturaVippsHtml(klinikk)}

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  vindu.document.open();
  vindu.document.write(printHtml);
  vindu.document.close();

  vetMelding("fakturaMelding", "Faktura lagret og journalene er merket som fakturert: " + fakturanr);
  await lastJournal();
  await lastVetFakturaer();
  fyllKreditnotaFakturaValg();
  tegnFakturaGrunnlag();
  if (typeof tegnAdminOversikt === "function") tegnAdminOversikt();
  if (typeof tegnAdminMvaOversikt === "function") tegnAdminMvaOversikt();
}

function finnFakturaKunde(faktura) {
  if (!faktura) return null;
  const kundeId = faktura.kunden_id || faktura.kunde_id || faktura.dyreeier_id;
  return (vetDyreeiere || []).find(e => String(e.id) === String(kundeId)) || null;
}

function hentPurringFaktura() {
  const valgt = hentValgtKreditnotaFaktura ? hentValgtKreditnotaFaktura() : null;
  if (valgt) return valgt;

  const id = vetTekst("purringFakturaValg") || vetTekst("fakturaPurringValg");
  if (id) return (vetFakturaer || []).find(f => String(f.id) === String(id)) || null;

  return null;
}

function lagVetPurring() {
  vetMelding("fakturaMelding", "");
  const faktura = hentPurringFaktura();
  if (!faktura) {
    vetMelding("fakturaMelding", "Velg faktura som skal purres.");
    return;
  }

  if (erKreditnotaFaktura(faktura)) {
    vetMelding("fakturaMelding", "Du kan ikke lage purring på en kreditnota.");
    return;
  }

  skrivUtVetPurring(faktura);
}

function skrivUtVetPurring(faktura) {
  const klinikk = hentFakturaKlinikk();
  const kunde = finnFakturaKunde(faktura) || {};
  const fakturanr = faktura.fakturanr || faktura.id || "";
  const fakturaDato = fakturaDatoKort(faktura) || "";
  const opprinneligForfall = String(faktura.forfallsdato || faktura.forfall || "").slice(0, 10);
  const purringDato = new Date().toISOString().slice(0, 10);
  const nyForfall = new Date();
  nyForfall.setDate(nyForfall.getDate() + 7);
  const nyForfallsdato = nyForfall.toISOString().slice(0, 10);
  const eks = Number(faktura.eks_mva || 0);
  const mva = Number(faktura.mva || 0);
  const inkl = Number(faktura.inkl_mva || 0);
  const gebyr = Number(faktura.purregebyr || 0);
  const total = inkl + gebyr;
  const logoHtml = klinikk.logo_url
    ? `<img src="${htmlEscape(klinikk.logo_url)}" alt="Logo" style="max-height:90px; max-width:260px; object-fit:contain;">`
    : "";

  const printHtml = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<title>Purring ${htmlEscape(fakturanr)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
  .topp { display:flex; justify-content:space-between; gap:30px; align-items:flex-start; border-bottom:2px solid #222; padding-bottom:18px; }
  h1 { margin:0; font-size:30px; letter-spacing:1px; }
  .boks { margin-top:22px; display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  .kort-print { border:1px solid #ddd; padding:14px; }
  .tekstboks { margin-top:24px; font-size:15px; line-height:1.45; }
  table { width:100%; border-collapse:collapse; margin-top:24px; font-size:14px; }
  th, td { padding:8px; border-bottom:1px solid #ddd; vertical-align:top; }
  th { text-align:left; background:#f4f6f8; }
  .right { text-align:right; }
  .summer { margin-left:auto; margin-top:20px; width:340px; }
  .summer td { border-bottom:0; padding:5px 0; }
  .total { font-size:18px; font-weight:bold; border-top:2px solid #222; padding-top:8px; }
  .advarsel { margin-top:18px; padding:12px 14px; border:2px solid #b00020; color:#b00020; font-weight:bold; }
  .vipps-boks { margin-top:28px; padding:14px 16px; border:2px solid #d00; border-radius:8px; max-width:360px; }
  .vipps-tittel { color:#d00; font-size:22px; font-weight:bold; margin-bottom:8px; }

  @page {
    margin: 18mm;
    @bottom-right {
      content: "Side " counter(page) " av " counter(pages);
      font-family: Arial, sans-serif;
      font-size: 9px;
      color: #555;
    }
  }
  @media print { button { display:none; } body { margin:0; } }
</style>
</head>
<body>
  <div class="topp">
    <div>
      ${logoHtml}<br>
      <strong>${htmlEscape(klinikk.navn || "Klinikk")}</strong><br>
      ${htmlEscape(klinikk.adresse || "")}<br>
      ${htmlEscape(klinikk.telefon || "")} ${htmlEscape(klinikk.epost || "")}
    </div>
    <div class="right">
      <h1>PURRING</h1>
      <p><strong>Purringsdato:</strong> ${htmlEscape(purringDato)}<br>
      <strong>Fakturanr:</strong> ${htmlEscape(fakturanr)}<br>
      <strong>Fakturadato:</strong> ${htmlEscape(fakturaDato)}<br>
      <strong>Opprinnelig forfall:</strong> ${htmlEscape(opprinneligForfall)}<br>
      <strong>Ny betalingsfrist:</strong> ${htmlEscape(nyForfallsdato)}</p>
    </div>
  </div>

  <div class="boks">
    <div class="kort-print">
      <strong>Kunde</strong><br>
      ${htmlEscape(kunde.navn || "")}<br>
      ${htmlEscape(kunde.adresse || "")}<br>
      ${htmlEscape(kunde.epost || "")} ${htmlEscape(kunde.telefon || "")}
    </div>
    <div class="kort-print">
      <strong>Gjelder</strong><br>
      Purring på ubetalt faktura ${htmlEscape(fakturanr)}.<br>
      Betal innen ny frist for å unngå videre oppfølging.
    </div>
  </div>

  <div class="tekstboks">
    Vi kan ikke se at faktura ${htmlEscape(fakturanr)} er registrert betalt. Dersom betalingen allerede er sendt, kan du se bort fra denne purringen.
  </div>

  <table>
    <thead>
      <tr><th>Beskrivelse</th><th class="right">Eks. mva</th><th class="right">MVA</th><th class="right">Inkl. mva</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Ubetalt faktura ${htmlEscape(fakturanr)}</td>
        <td class="right">${formaterKr(eks)} kr</td>
        <td class="right">${formaterKr(mva)} kr</td>
        <td class="right">${formaterKr(inkl)} kr</td>
      </tr>
      ${gebyr > 0 ? `
      <tr>
        <td>Purregebyr</td>
        <td class="right">${formaterKr(gebyr)} kr</td>
        <td class="right">0,00 kr</td>
        <td class="right">${formaterKr(gebyr)} kr</td>
      </tr>` : ""}
    </tbody>
  </table>

  <table class="summer">
    <tr><td>Opprinnelig beløp</td><td class="right">${formaterKr(inkl)} kr</td></tr>
    ${gebyr > 0 ? `<tr><td>Purregebyr</td><td class="right">${formaterKr(gebyr)} kr</td></tr>` : ""}
    <tr><td class="total">Å betale</td><td class="right total">${formaterKr(total)} kr</td></tr>
  </table>

  <div class="advarsel">Ny betalingsfrist: ${htmlEscape(nyForfallsdato)}</div>

  ${hentFakturaVippsHtml(klinikk)}

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const vindu = window.open("", "_blank");
  if (!vindu) {
    vetMelding("fakturaMelding", "Kunne ikke åpne purring. Tillat popup-vindu for siden.");
    return;
  }
  vindu.document.open();
  vindu.document.write(printHtml);
  vindu.document.close();
  vetMelding("fakturaMelding", "Purring laget for faktura: " + fakturanr);
}

