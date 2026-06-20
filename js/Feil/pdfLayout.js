console.log("pdfLayout.js er lastet");

/*
  Felles PDF-layout for hele systemet.
  Bruk disse funksjonene fra faktura, kreditnota, lønnslipp og rapporter.
*/

const PDF_LAYOUT = {
  venstre: 14,
  hoyre: 195,
  topp: 8,
  brevhodeLinjeY: 55,
  innholdStartY: 70,
  brevfotLinjeY: 276,
  brevfotY: 284,
  sideNrY: 291,
  logoBredde: 70,
  logoTopp: 3,
  linjeFarge: 180
};

let pdfLogoCache = null;
let pdfLogoCacheKey = "";

function pdfSidebredde(doc) {
  return doc.internal.pageSize.getWidth();
}

function pdfTryggTekst(verdi) {
  return String(verdi || "");
}

function pdfLogoKandidater(firma = {}) {
  const origin = window.location.origin;
  const path = window.location.pathname || "";
  const basePath = path.substring(0, path.lastIndexOf("/"));

  const kandidater = [];

  // Først: kundens egen logo fra firma-tabellen / Supabase Storage.
  if (firma.logo_url) kandidater.push(firma.logo_url);

  // Gammel løsning beholdes som fallback hvis noen allerede har base64-logo i databasen.
  if (firma.logo) kandidater.push(firma.logo);

  // Reserve-logo for test/demo.
  kandidater.push(
    basePath + "/bilder/logo.png",
    basePath + "/bilder/logo.jpg",
    "bilder/logo.png",
    "bilder/logo.jpg",
    origin + "/NyTimerdelt/bilder/logo.png",
    origin + "/NyTimerdelt/bilder/logo.jpg"
  );

  return kandidater.filter(Boolean);
}

function lastBildeSomBase64(url) {
  return new Promise(resolve => {
    if (!url) {
      resolve(null);
      return;
    }

    const img = new Image();

    if (!String(url).startsWith("data:image")) {
      img.crossOrigin = "anonymous";
    }

    img.onload = function () {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const mime =
          String(url).startsWith("data:image/png") || url.toLowerCase().includes(".png")
            ? "image/png"
            : "image/jpeg";
        resolve({
          data: canvas.toDataURL(mime, 0.92),
          type: mime === "image/png" ? "PNG" : "JPEG",
          width: img.naturalWidth,
          height: img.naturalHeight,
          url
        });
      } catch (e) {
        console.warn("Logo kunne ikke konverteres:", url, e);
        resolve(null);
      }
    };

    img.onerror = function () {
      resolve(null);
    };

    img.src = String(url).startsWith("data:image")
      ? url
      : url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
  });
}

async function hentPdfLogo(firma = {}) {
  const kandidater = pdfLogoKandidater(firma);
  const cacheKey = kandidater.join("|");

  if (pdfLogoCache && pdfLogoCacheKey === cacheKey) {
    return pdfLogoCache;
  }

  for (const url of kandidater) {
    const logo = await lastBildeSomBase64(url);

    if (logo && logo.data) {
      pdfLogoCache = logo;
      pdfLogoCacheKey = cacheKey;
      return logo;
    }
  }

  console.warn("Fant ingen logo for PDF.");
  return null;
}

async function tegnLogoPdf(doc, firma = {}) {
  const logo = await hentPdfLogo(firma);

  if (!logo) {
    return false;
  }

  const bredde = PDF_LAYOUT.logoBredde;
  const ratio = logo.width && logo.height ? logo.width / logo.height : 3;
  const hoyde = bredde / ratio;
  const x = (pdfSidebredde(doc) - bredde) / 2;

  doc.addImage(
    logo.data,
    logo.type,
    x,
    PDF_LAYOUT.logoTopp,
    bredde,
    hoyde
  );

  return true;
}

async function tegnBrevhodePdf(doc, firma = {}, tittel = "") {
  await tegnLogoPdf(doc, firma);

  if (firma.navn) {
    doc.setFontSize(12);
    doc.text(pdfTryggTekst(firma.navn), pdfSidebredde(doc) / 2, 45, { align: "center" });
  }

  doc.setDrawColor(PDF_LAYOUT.linjeFarge);
  doc.line(
    PDF_LAYOUT.venstre,
    PDF_LAYOUT.brevhodeLinjeY,
    PDF_LAYOUT.hoyre,
    PDF_LAYOUT.brevhodeLinjeY
  );

  if (tittel) {
    doc.setFontSize(9);
    doc.text(pdfTryggTekst(tittel), PDF_LAYOUT.venstre, PDF_LAYOUT.brevhodeLinjeY - 4);
  }

  return PDF_LAYOUT.innholdStartY;
}

function tegnSkilleLinjePdf(doc, y, fraX = PDF_LAYOUT.venstre, tilX = PDF_LAYOUT.hoyre) {
  if (firma.navn) {
    doc.setFontSize(12);
    doc.text(pdfTryggTekst(firma.navn), pdfSidebredde(doc) / 2, 45, { align: "center" });
  }

  doc.setDrawColor(PDF_LAYOUT.linjeFarge);
  doc.line(fraX, y, tilX, y);
}

function tegnBrevfotPdf(doc, firma = {}, sideNr = null, antallSider = null) {
  if (firma.navn) {
    doc.setFontSize(12);
    doc.text(pdfTryggTekst(firma.navn), pdfSidebredde(doc) / 2, 45, { align: "center" });
  }

  doc.setDrawColor(PDF_LAYOUT.linjeFarge);
  doc.line(
    PDF_LAYOUT.venstre,
    PDF_LAYOUT.brevfotLinjeY,
    PDF_LAYOUT.hoyre,
    PDF_LAYOUT.brevfotLinjeY
  );

  doc.setFontSize(8);

  const venstreTekst = pdfTryggTekst(firma.navn || "");
  const midtTekst = [
    firma.adresse,
    firma.postadresse
  ].filter(Boolean).join(", ");
  const hoyreTekst = [
    (firma.org_nr || firma.orgnr) ? "Org.nr: " + (firma.org_nr || firma.orgnr) : "",
    firma.mva_nr ? "MVA: " + firma.mva_nr : "",
    firma.kontonr ? "Konto: " + firma.kontonr : ""
  ].filter(Boolean).join("  ");

  doc.text(venstreTekst, PDF_LAYOUT.venstre, PDF_LAYOUT.brevfotY);
  doc.text(midtTekst, 70, PDF_LAYOUT.brevfotY);
  doc.text(hoyreTekst, PDF_LAYOUT.venstre, PDF_LAYOUT.brevfotY + 5);

  if (sideNr !== null && antallSider !== null) {
    doc.text(
      "Side " + sideNr + " av " + antallSider,
      170,
      PDF_LAYOUT.sideNrY
    );
  }
}

function tegnBrevfotAlleSiderPdf(doc, firma = {}) {
  const antallSider = doc.getNumberOfPages();

  for (let i = 1; i <= antallSider; i++) {
    doc.setPage(i);
    tegnBrevfotPdf(doc, firma, i, antallSider);
  }
}

function nySideHvisBehovPdf(doc, y, firma = {}, grense = 260) {
  if (y <= grense) {
    return y;
  }

  doc.addPage();
  return PDF_LAYOUT.innholdStartY;
}

window.PDF_LAYOUT = PDF_LAYOUT;
window.hentPdfLogo = hentPdfLogo;
window.nullstillPdfLogoCache = function () {
  pdfLogoCache = null;
  pdfLogoCacheKey = "";
};
window.tegnLogoPdf = tegnLogoPdf;
window.tegnBrevhodePdf = tegnBrevhodePdf;
window.tegnBrevfotPdf = tegnBrevfotPdf;
window.tegnBrevfotAlleSiderPdf = tegnBrevfotAlleSiderPdf;
window.tegnSkilleLinjePdf = tegnSkilleLinjePdf;
window.nySideHvisBehovPdf = nySideHvisBehovPdf;
