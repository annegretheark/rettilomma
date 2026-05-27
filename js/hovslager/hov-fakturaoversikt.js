console.log("hov-fakturaoversikt.js lastet");

function oversiktKr(n) {
  return Number(n || 0).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function hentFakturaOversikt() {
  const res = await supabaseClient
   .from("hov_fakturaer")
.select("*, kunder(navn)")
.eq("kreditert", false)
.order("dato", { ascending: false });

  if (res.error) {
    alert(res.error.message);
    return;
  }

  const div = document.getElementById("fakturaOversikt");
  if (!div) return;

  div.innerHTML = "";

  for (const f of res.data || []) {
    const kort = document.createElement("div");
    kort.className = "listekort";

    kort.innerHTML = `
      <b>${f.fakturanr}</b><br>
      Kunde: ${f.kunder?.navn || ""}<br>
      Dato: ${f.dato || ""}<br>
      Fakturert inkl. mva: ${oversiktKr(f.inkl_mva)} kr<br>
      Status: <b>${f.betalingsstatus || "ubetalt"}</b><br>
      Betalt beløp: ${oversiktKr(f.betalt_belop)} kr<br>
      Betalt dato: ${f.betalt_dato || ""}<br><br>

      <button type="button" onclick="markerHovFakturaBetalt('${f.fakturanr}', ${Number(f.inkl_mva || 0)})">
        Marker som betalt
      </button>
    `;

    div.appendChild(kort);
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

  const res = await supabaseClient
    .from("hov_fakturaer")
    .select("*, kunder(navn)")
    .order("dato", { ascending: false });

  if (res.error) {
    alert(res.error.message);
    return;
  }

  const rader = (res.data || []).map(f => ({
    fakturanr: f.fakturanr,
    kunde: f.kunder?.navn || "",
    dato: f.dato,
    eks_mva: Number(f.eks_mva || 0),
    mva: Number(f.mva || 0),
    inkl_mva: Number(f.inkl_mva || 0),
    betalingsstatus: f.betalingsstatus || "ubetalt",
    betalt_belop: Number(f.betalt_belop || 0),
    betalt_dato: f.betalt_dato || "",
    utestaende:
      Number(f.inkl_mva || 0) - Number(f.betalt_belop || 0)
  }));

  const ws = XLSX.utils.json_to_sheet(rader);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Fakturaoversikt");
  XLSX.writeFile(wb, "hov_fakturaoversikt.xlsx");
}

window.hentFakturaOversikt = hentFakturaOversikt;
window.eksporterFakturaOversiktExcel = eksporterFakturaOversiktExcel;
window.markerHovFakturaBetalt = markerHovFakturaBetalt;