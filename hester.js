console.log("hester.js lastet - kunde_id + sist_skodd/redigering");

let sisteHester = [];

function hestMelding(tekst, feil = false) {
  const el = document.getElementById("hestMelding");
  if (!el) return;
  el.textContent = tekst || "";
  el.style.color = feil ? "#b42318" : "#116329";
}

function hentValgtKundeId() {
  return String(document.getElementById("jobbKunde")?.value || "");
}

function datoVerdi(v) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

function finnValgtHestFraSkjema() {
  const id = document.getElementById("hestVelg")?.value || "";
  if (!id) return null;
  return sisteHester.find(h => String(h.id) === String(id)) || null;
}

async function lagreHest() {
  const kundeId = document.getElementById("hestKunde")?.value || "";
  const navn = document.getElementById("hestNavn")?.value.trim() || "";
  const valgtHestId = document.getElementById("hestVelg")?.value || "";

  if (!kundeId) {
    hestMelding("Velg kunde/eier først", true);
    return;
  }

  if (!navn) {
    hestMelding("Mangler hestenavn", true);
    return;
  }

  const hest = {
    kunde_id: Number(kundeId),
    navn,
    rase: document.getElementById("hestRase")?.value.trim() || "",
    notater: document.getElementById("hestNotater")?.value.trim() || "",
    sist_skodd: document.getElementById("sistSkodd")?.value || null,
    neste_besok: document.getElementById("nesteBesok")?.value || null
  };

  let res;

  if (valgtHestId) {
    res = await supabaseClient
      .from("hester")
      .update(hest)
      .eq("id", valgtHestId);
  } else {
    res = await supabaseClient
      .from("hester")
      .insert([hest]);
  }

  if (res.error) {
    console.error(res.error);
    hestMelding(res.error.message, true);
    return;
  }

  hestMelding(valgtHestId ? "Hest oppdatert" : "Hest lagret");

  await hentHester();

  if (typeof window.hentAlleHesterFraBase === "function") {
    await window.hentAlleHesterFraBase();
  }

  if (typeof window.fyllJobbHesterForValgtKunde === "function") {
    await window.fyllJobbHesterForValgtKunde();
  }
}

async function hentHester() {
  const hestRes = await supabaseClient
    .from("hester")
    .select("*")
    .order("navn");

  if (hestRes.error) {
    console.error(hestRes.error);
    hestMelding(hestRes.error.message, true);
    return;
  }

  const kundeRes = await supabaseClient
    .from("kunder")
    .select("id, navn")
    .order("navn");

  if (kundeRes.error) {
    console.error(kundeRes.error);
    hestMelding(kundeRes.error.message, true);
    return;
  }

  const kunder = kundeRes.data || [];
  const kundeNavn = new Map(kunder.map(k => [String(k.id), k.navn || ""]));
  const hester = hestRes.data || [];
  sisteHester = hester;

  const liste = document.getElementById("hesteListe");
  if (liste) {
    liste.innerHTML = "";

    if (hester.length === 0) {
      liste.innerHTML = `<div class="info">Ingen hester er registrert ennå.</div>`;
    }

    for (const h of hester) {
      const div = document.createElement("div");
      div.className = "listekort";
      div.innerHTML = `
        <b>${h.navn || ""}</b><br>
        Eier: ${kundeNavn.get(String(h.kunde_id)) || ""}<br>
        ${h.rase || ""}<br>
        Sist skodd: ${datoVerdi(h.sist_skodd)}<br>
        Neste besøk: ${datoVerdi(h.neste_besok)}<br>
        ${h.notater || ""}
      `;
      liste.appendChild(div);
    }
  }

  fyllHestSelect(hester);
  fyllHestVelgForValgtKunde(hester);
}

function fyllHestSelect(hester) {
  const select = document.getElementById("jobbHest");
  if (!select) return;

  const valgtKunde = hentValgtKundeId();

  select.innerHTML = `<option value="">Velg hest</option>`;

  if (!valgtKunde) {
    return;
  }

  const filtrerte = (hester || []).filter(h =>
    String(h.kunde_id) === String(valgtKunde)
  );

  for (const h of filtrerte) {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.navn;
    select.appendChild(opt);
  }
}

function fyllHestVelgForValgtKunde(hester = sisteHester) {
  const kundeSelect = document.getElementById("hestKunde");
  const hestVelg = document.getElementById("hestVelg");

  if (!kundeSelect || !hestVelg) return;

  const valgtKunde = String(kundeSelect.value || "");
  const valgtHest = String(hestVelg.value || "");

  hestVelg.innerHTML = `<option value="">Ny hest</option>`;

  if (!valgtKunde) return;

  const filtrerte = (hester || []).filter(h =>
    String(h.kunde_id) === valgtKunde
  );

  for (const h of filtrerte) {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.navn;
    hestVelg.appendChild(opt);
  }

  if (valgtHest && filtrerte.some(h => String(h.id) === valgtHest)) {
    hestVelg.value = valgtHest;
  }
}

function fyllHestSkjemaFraValg() {
  const h = finnValgtHestFraSkjema();

  if (!h) {
    document.getElementById("hestNavn").value = "";
    document.getElementById("hestRase").value = "";
    document.getElementById("hestNotater").value = "";
    document.getElementById("sistSkodd").value = "";
    document.getElementById("nesteBesok").value = "";
    return;
  }

  document.getElementById("hestNavn").value = h.navn || "";
  document.getElementById("hestRase").value = h.rase || "";
  document.getElementById("hestNotater").value = h.notater || "";
  document.getElementById("sistSkodd").value = datoVerdi(h.sist_skodd);
  document.getElementById("nesteBesok").value = datoVerdi(h.neste_besok);
}

document.addEventListener("DOMContentLoaded", () => {
  const jobbKunde = document.getElementById("jobbKunde");
  if (jobbKunde) {
    jobbKunde.addEventListener("change", async () => {
      await hentHester();
    });
  }

  const hestKunde = document.getElementById("hestKunde");
  if (hestKunde) {
    hestKunde.addEventListener("change", () => {
      const hestVelg = document.getElementById("hestVelg");
      if (hestVelg) hestVelg.value = "";
      fyllHestVelgForValgtKunde();
      fyllHestSkjemaFraValg();
    });
  }

  const hestVelg = document.getElementById("hestVelg");
  if (hestVelg) {
    hestVelg.addEventListener("change", fyllHestSkjemaFraValg);
  }
});

window.lagreHest = lagreHest;
window.hentHester = hentHester;
window.fyllHestSelect = fyllHestSelect;
window.fyllHestVelgForValgtKunde = fyllHestVelgForValgtKunde;
window.fyllHestSkjemaFraValg = fyllHestSkjemaFraValg;
