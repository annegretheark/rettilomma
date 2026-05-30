window.tegnBrevhodePdf = async function(doc, firma) {

  if (firma.logo) {
    await leggTilLogoFraFirma(doc, firma.logo);
  }

  doc.setFontSize(18);
  doc.text(firma.navn || "", 105, 20, { align: "center" });

  doc.setFontSize(10);

  let linje = [];

  if (firma.adresse) linje.push(firma.adresse);
  if (firma.telefon) linje.push(firma.telefon);
  if (firma.epost) linje.push(firma.epost);

  doc.text(linje.join(" | "), 105, 28, { align: "center" });

  doc.line(14, 35, 195, 35);
};

window.tegnBrevfotAlleSiderPdf = function(doc, firma) {

  const sider = doc.getNumberOfPages();

  for (let i = 1; i <= sider; i++) {

    doc.setPage(i);

    doc.line(14, 280, 195, 280);

    doc.setFontSize(8);

    doc.text(
      `${firma.orgnr || ""}  ${firma.mva_nr || ""}  ${firma.kontonr || ""}`,
      105,
      286,
      { align: "center" }
    );

    doc.text(
      `Side ${i} av ${sider}`,
      190,
      292,
      { align: "right" }
    );
  }
};