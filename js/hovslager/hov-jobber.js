console.log("hov-jobber.js lastet");

function jobbMelding(tekst, feil = false) {
  const el = document.getElementById("jobbMelding");
  if (el) {
    el.textContent = tekst || "";
    el.style.color = feil ? "#b42318" : "#116329";
  }
}

function tall(v) {
  const n = Number(String(v || 0).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function lagreJobb() {
  const kundeId = document.getElementById("jobbKunde").value;
  const hestId = document.getElementById("jobbHest").value;
  if (!kundeId) {
  jobbMelding("Velg kunde først", true);
  return;
}

if (!hestId) {
  jobbMelding("Velg hest først", true);
  return;
}

const sjekkHest = await supabaseClient
  .from("hester")
  .select("id, kunde_id, navn")
  .eq("id", hestId)
  .single();

if (sjekkHest.error) {
  jobbMelding("Fant ikke valgt hest", true);
  return;
}

if (String(sjekkHest.data.kunde_id) !== String(kundeId)) {
  jobbMelding(
    "Feil hest/eier: " + sjekkHest.data.navn + " tilhører ikke valgt kunde.",
    true
  );
  return;
}
  if (!kundeId) {
  jobbMelding("Velg kunde først", true);
  return;
}

if (!hestId) {
  jobbMelding("Velg hest først", true);
  return;
}

  if (!kundeId) {
    jobbMelding("Velg kunde", true);
    return;
  }

  const km = tall(document.getElementById("jobbKm").value);
  const kmPris = tall(document.getElementById("jobbKmPris").value);
  const arbeid = tall(document.getElementById("arbeidBelop").value);
  const varer = tall(document.getElementById("varerBelop").value);

  const eksMva = arbeid + varer + (km * kmPris);
  const mva = eksMva * 0.25;
  const total = eksMva + mva;

  const jobb = {
    kunde_id: kundeId,
    hest_id: hestId || null,
    dato: document.getElementById("jobbDato").value || new Date().toISOString().slice(0, 10),
    jobbtype: document.getElementById("jobbType").value,
    beskrivelse: document.getElementById("jobbBeskrivelse").value.trim(),
    km,
    km_pris: kmPris,
    arbeid_belop: arbeid,
    varer_belop: varer,
    mva,
    total,
    fakturert: false
  };

  const res = await supabaseClient
    .from("hov_jobber")
    .insert([jobb]);

  if (res.error) {
    console.error(res.error);
    jobbMelding(res.error.message, true);
    return;
  }

  jobbMelding("Jobb lagret");
  document.getElementById("jobbDato").value =
  new Date().toISOString().slice(0, 10);

document.getElementById("jobbKunde").value = "";

document.getElementById("jobbHest").innerHTML =
  `<option value="">Velg hest</option>`;

document.getElementById("jobbType").value = "";
document.getElementById("jobbBeskrivelse").value = "";

document.getElementById("jobbKm").value = "0";

document.getElementById("jobbKmPris").value = "5.30";

document.getElementById("arbeidBelop").value = "0";

document.getElementById("varerBelop").value = "0";

document.getElementById("jobbDato").value =
  new Date().toISOString().slice(0, 10);

await hentJobber();}

async function hentJobber() {
  const res = await supabaseClient
    .from("hov_jobber")
    .select("*, kunder(navn), hester(navn)")
    .order("dato", { ascending: false });

  if (res.error) {
    console.error(res.error);
    jobbMelding(res.error.message, true);
    return;
  }

  const liste = document.getElementById("jobbListe");
  if (!liste) return;
  const ikkeFakturert =
  (res.data || []).filter(j => !j.fakturert);

const fakturert =
  (res.data || []).filter(j => j.fakturert);

const omsetning =
  (res.data || []).reduce((sum, j) => {
    return sum + Number(j.total || 0);
  }, 0);

document.getElementById(
  "antallUfatturerte"
).textContent =
  ikkeFakturert.length;

document.getElementById(
  "antallFakturerte"
).textContent =
  fakturert.length;

document.getElementById(
  "jobbOmsetning"
).textContent =
  omsetning.toLocaleString(
    "no-NO",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ) + " kr";

  liste.innerHTML = "";

  for (const j of res.data || []) {
    const div = document.createElement("div");
    div.className = "listekort";

    div.innerHTML = `
      <b>${j.dato || ""} - ${j.hester?.navn || "Uten hest"}</b><br>
      Kunde: ${j.kunder?.navn || ""}<br>
      Jobb: ${j.jobbtype || ""}<br>
      Kjøring: ${j.km || 0} km x ${j.km_pris || 0}<br>
      Total inkl. mva: ${Number(j.total || 0).toLocaleString("no-NO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} kr
    `;

    liste.appendChild(div);
  }
}

window.lagreJobb = lagreJobb;
window.hentJobber = hentJobber;