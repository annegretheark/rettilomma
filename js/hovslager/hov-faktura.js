console.log("hov-faktura.js lastet");

function fakturaMelding(tekst, feil = false) {

  const el =
    document.getElementById("fakturaMelding");

  if (el) {

    el.textContent = tekst || "";

    el.style.color =
      feil ? "#b42318" : "#116329";
  }
}

function kr(n) {

  return Number(n || 0)
    .toLocaleString(
      "no-NO",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
}

async function fyllFakturaKunder() {

  const res =
    await supabaseClient
      .from("kunder")
      .select("*")
      .order("navn");

  if (res.error) {

    fakturaMelding(
      res.error.message,
      true
    );

    return;
  }

  const sel =
    document.getElementById(
      "fakturaKunde"
    );

  if (!sel) return;

  sel.innerHTML =
    `<option value="">
      Velg kunde
    </option>`;

  for (const k of res.data || []) {

    const opt =
      document.createElement("option");

    opt.value = k.id;
    opt.textContent = k.navn;

    sel.appendChild(opt);
  }
}

async function lagHovFaktura() {

  const kundeId =
    document.getElementById(
      "fakturaKunde"
    ).value;

  if (!kundeId) {

    fakturaMelding(
      "Velg kunde først",
      true
    );

    return;
  }

  const kundeRes =
    await supabaseClient
      .from("kunder")
      .select("*")
      .eq("id", kundeId)
      .single();

  if (kundeRes.error) {

    fakturaMelding(
      kundeRes.error.message,
      true
    );

    return;
  }

  const jobbRes =
    await supabaseClient
      .from("hov_jobber")
      .select("*, hester(navn)")
      .eq("kunde_id", kundeId)
      .eq("fakturert", false)
      .order("dato");

  if (jobbRes.error) {

    fakturaMelding(
      jobbRes.error.message,
      true
    );

    return;
  }

  const jobber =
    jobbRes.data || [];

  if (!jobber.length) {

    fakturaMelding(
      "Ingen ufakturerte jobber på kunden.",
      true
    );

    return;
  }

  const fakturanr =
    "HOV-" + Date.now();

  const eksMva =
    jobber.reduce((sum, j) => {

      return (
        sum +
        Number(j.arbeid_belop || 0) +
        Number(j.varer_belop || 0) +
        (
          Number(j.km || 0) *
          Number(j.km_pris || 0)
        )
      );
    }, 0);

  const mva =
    eksMva * 0.25;

  const inklMva =
    eksMva + mva;

  const { jsPDF } =
    window.jspdf;

  const doc =
    new jsPDF();

  let y = 20;

  doc.setFontSize(18);

  doc.text(
    "FAKTURA",
    20,
    y
  );

  y += 10;

  doc.setFontSize(10);

  doc.text(
    "Fakturanr: " + fakturanr,
    20,
    y
  );

  y += 7;

  doc.text(
    "Dato: " +
    new Date()
      .toISOString()
      .slice(0, 10),
    20,
    y
  );

  y += 12;

  doc.setFontSize(12);

  doc.text(
    "Kunde:",
    20,
    y
  );

  y += 7;

  doc.setFontSize(10);

  doc.text(
    kundeRes.data.navn || "",
    20,
    y
  );

  y += 6;

  doc.text(
    kundeRes.data.adresse || "",
    20,
    y
  );

  y += 6;

  doc.text(
    kundeRes.data.epost || "",
    20,
    y
  );

  y += 14;

  doc.setFontSize(11);

  doc.text(
    "Dato",
    20,
    y
  );

  doc.text(
    "Beskrivelse",
    45,
    y
  );

  doc.text(
    "Beløp",
    160,
    y
  );

  y += 6;

  doc.line(
    20,
    y,
    190,
    y
  );

  y += 8;

  for (const j of jobber) {

    const arbeid =
      Number(j.arbeid_belop || 0);

    const varer =
      Number(j.varer_belop || 0);

    const km =
      Number(j.km || 0);

    const kmPris =
      Number(j.km_pris || 0);

    const kj =
      km * kmPris;

    const hestNavn =
      j.hester?.navn ||
      "Uten hest";

    doc.setFontSize(10);

    doc.text(
      String(j.dato || ""),
      20,
      y
    );

    doc.text(
      `${hestNavn} - ${j.jobbtype || "Skoing"}`,
      45,
      y
    );

    doc.text(
      kr(arbeid) + " kr",
      160,
      y
    );

    y += 6;

    if (kj > 0) {

      doc.setFontSize(9);

      doc.text(
        `Kjøring ${km} km x ${kr(kmPris)} kr`,
        45,
        y
      );

      doc.text(
        kr(kj) + " kr",
        160,
        y
      );

      y += 6;
    }

    if (varer > 0) {

      doc.setFontSize(9);

      doc.text(
        `Sko / varer`,
        45,
        y
      );

      doc.text(
        kr(varer) + " kr",
        160,
        y
      );

      y += 6;
    }

    if (j.beskrivelse) {

      doc.setFontSize(8);

      doc.text(
        String(j.beskrivelse)
          .slice(0, 90),
        45,
        y
      );

      y += 5;
    }

    y += 4;
  }

  y += 8;

  doc.line(
    120,
    y,
    190,
    y
  );

  y += 8;

  doc.setFontSize(10);

  doc.text(
    "Sum eks. mva",
    120,
    y
  );

  doc.text(
    kr(eksMva) + " kr",
    160,
    y
  );

  y += 7;

  doc.text(
    "MVA 25%",
    120,
    y
  );

  doc.text(
    kr(mva) + " kr",
    160,
    y
  );

  y += 8;

  doc.setFontSize(12);

  doc.text(
    "Sum inkl. mva",
    120,
    y
  );

  doc.text(
    kr(inklMva) + " kr",
    160,
    y
  );

  const fakturaRes =
    await supabaseClient
      .from("hov_fakturaer")
      .insert([{
        fakturanr,
        kunde_id: kundeId,
        eks_mva: eksMva,
        mva,
        inkl_mva: inklMva
      }]);

  if (fakturaRes.error) {

    fakturaMelding(
      fakturaRes.error.message,
      true
    );

    return;
  }

  const ids =
    jobber.map(j => j.id);

  const oppdaterRes =
    await supabaseClient
      .from("hov_jobber")
      .update({
        fakturert: true,
        fakturanr
      })
      .in("id", ids);

  if (oppdaterRes.error) {

    fakturaMelding(
      oppdaterRes.error.message,
      true
    );

    return;
  }

  doc.save(
    fakturanr + ".pdf"
  );

  fakturaMelding(
    "Faktura laget: " +
    fakturanr
  );

  await hentJobber();
}

window.lagHovFaktura =
  lagHovFaktura;

window.fyllFakturaKunder =
  fyllFakturaKunder;