console.log("hov-kreditnota.js lastet");

function kreditMelding(tekst, feil = false) {

  const el =
    document.getElementById("fakturaMelding");

  if (el) {

    el.textContent = tekst || "";

    el.style.color =
      feil ? "#b42318" : "#116329";
  }
}

function kreditKr(n) {

  return Number(n || 0)
    .toLocaleString(
      "no-NO",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
}

async function fyllKreditFakturaer() {

  const res =
    await supabaseClient
      .from("hov_fakturaer")
      .select("*, kunder(navn)")
      .order(
        "created_at",
        { ascending: false }
      );

  if (res.error) {

    kreditMelding(
      res.error.message,
      true
    );

    return;
  }

  const sel =
    document.getElementById(
      "kreditFakturaValg"
    );

  if (!sel) return;

  sel.innerHTML =
    `<option value="">
      Velg faktura
    </option>`;

  for (const f of res.data || []) {

    const opt =
      document.createElement("option");

    opt.value =
      f.fakturanr;

    opt.textContent =
      `${f.fakturanr} - ` +
      `${f.kunder?.navn || ""} - ` +
      `${kreditKr(f.inkl_mva)} kr`;

    sel.appendChild(opt);
  }
}

async function lagHovKreditnota() {

  const fakturanr =
    document.getElementById(
      "kreditFakturaValg"
    ).value;

  const grunn =
    document.getElementById(
      "kreditGrunn"
    ).value || "Kreditnota";

  if (!fakturanr) {

    kreditMelding(
      "Velg faktura å kreditere",
      true
    );

    return;
  }

  const fakturaRes =
    await supabaseClient
      .from("hov_fakturaer")
      .select("*")
      .eq("fakturanr", fakturanr)
      .single();

  if (fakturaRes.error) {

    kreditMelding(
      fakturaRes.error.message,
      true
    );

    return;
  }

  const f =
    fakturaRes.data;

  const kreditnotanr =
    "KRED-" + Date.now();

  const kreditRes =
    await supabaseClient
      .from("hov_kreditnotaer")
      .insert([{

        kreditnotanr,

        fakturanr:
          f.fakturanr,

        kunde_id:
          f.kunde_id,

        eks_mva:
          -Math.abs(
            Number(f.eks_mva || 0)
          ),

        mva:
          -Math.abs(
            Number(f.mva || 0)
          ),

        inkl_mva:
          -Math.abs(
            Number(f.inkl_mva || 0)
          ),

        grunn

      }]);

  if (kreditRes.error) {

    kreditMelding(
      kreditRes.error.message,
      true
    );

    return;
  }

  const oppdaterFakturaRes = await supabaseClient
    .from("hov_fakturaer")
    .update({
      kreditert: true,
      kreditert_dato: new Date().toISOString().slice(0, 10),
      kreditnota_nr: kreditnotanr,
      betalingsstatus: "kreditert"
    })
    .eq("fakturanr", fakturanr);

  if (oppdaterFakturaRes.error) {
    kreditMelding(oppdaterFakturaRes.error.message, true);
    return;
  }

  const oppdaterJobberRes = await supabaseClient
    .from("hov_jobber")
    .update({
      fakturert: false,
      fakturanr: null
    })
    .eq("fakturanr", fakturanr);

  if (oppdaterJobberRes.error) {
    kreditMelding(oppdaterJobberRes.error.message, true);
    return;
  }

  const { jsPDF } =
    window.jspdf;

  const doc =
    new jsPDF();

  const firma =
    typeof hentFirmaData === "function"
      ? await hentFirmaData()
      : {};

  if (typeof tegnBrevhodePdf === "function") {
    await tegnBrevhodePdf(doc, firma);
  }

  let y = 56;

  doc.setFontSize(18);

  doc.text(
    "KREDITNOTA",
    20,
    y
  );

  y += 10;

  doc.setFontSize(10);

  doc.text(
    "Kreditnotanr: " +
    kreditnotanr,
    20,
    y
  );

  y += 7;

  doc.text(
    "Krediterer faktura: " +
    fakturanr,
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

  doc.text(
    "Grunn: " + grunn,
    20,
    y
  );

  y += 16;

  doc.text(
    "Sum eks. mva",
    120,
    y
  );

  doc.text(
    "-" +
    kreditKr(f.eks_mva) +
    " kr",
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
    "-" +
    kreditKr(f.mva) +
    " kr",
    160,
    y
  );

  y += 7;

  doc.setFontSize(12);

  doc.text(
    "Sum inkl. mva",
    120,
    y
  );

  doc.text(
    "-" +
    kreditKr(f.inkl_mva) +
    " kr",
    160,
    y
  );

  if (typeof tegnBrevfotAlleSiderPdf === "function") {
    tegnBrevfotAlleSiderPdf(doc, firma);
  }

  doc.save(
    kreditnotanr + ".pdf"
  );

  kreditMelding(
    "Kreditnota laget: " +
    kreditnotanr
  );

  await fyllKreditFakturaer();

  await hentJobber();
}

window.fyllKreditFakturaer =
  fyllKreditFakturaer;

window.lagHovKreditnota =
  lagHovKreditnota;