console.log("hov-kunder.js lastet");

function kundeMelding(tekst, feil = false) {

  const el =
    document.getElementById("kundeMelding");

  if (el) {
    el.textContent = tekst || "";
    el.style.color =
      feil ? "#b42318" : "#116329";
  }
}

function nullstillKundeFelter() {

  document.getElementById("kundeId").value = "";

  document.getElementById("kundeNavn").value = "";
  document.getElementById("kundeAdresse").value = "";
  document.getElementById("kundeEpost").value = "";
  document.getElementById("kundeTelefon").value = "";
  document.getElementById("kundeKontaktperson").value = "";
}

async function lagreKunde() {

  const kundeId =
    document.getElementById("kundeId").value;

  const navn =
    document.getElementById("kundeNavn")
      .value
      .trim();

  if (!navn) {
    kundeMelding("Mangler kundenavn", true);
    return;
  }

  const kunde = {
    navn,
    adresse:
      document.getElementById("kundeAdresse")
        .value
        .trim(),

    epost:
      document.getElementById("kundeEpost")
        .value
        .trim(),

    telefon:
      document.getElementById("kundeTelefon")
        .value
        .trim(),

    kontaktperson:
      document.getElementById("kundeKontaktperson")
        .value
        .trim()
  };

  let res;

  if (kundeId) {

    res = await supabaseClient
      .from("kunder")
      .update(kunde)
      .eq("id", kundeId);

  } else {

    res = await supabaseClient
      .from("kunder")
      .insert([kunde]);
  }

  if (res.error) {
    console.error(res.error);

    kundeMelding(
      res.error.message,
      true
    );

    return;
  }

  kundeMelding(
    kundeId
      ? "Kunde oppdatert"
      : "Kunde lagret"
  );

  nullstillKundeFelter();

  await hentKunder();
}

function redigerKunde(kunde) {

  document.getElementById("kundeId").value =
    kunde.id || "";

  document.getElementById("kundeNavn").value =
    kunde.navn || "";

  document.getElementById("kundeAdresse").value =
    kunde.adresse || "";

  document.getElementById("kundeEpost").value =
    kunde.epost || "";

  document.getElementById("kundeTelefon").value =
    kunde.telefon || "";

  document.getElementById("kundeKontaktperson").value =
    kunde.kontaktperson || "";

  visSide("kundeSide");
}

async function hentKunder() {

  const res = await supabaseClient
    .from("kunder")
    .select("*")
    .order("navn");

  if (res.error) {

    console.error(res.error);

    kundeMelding(
      res.error.message,
      true
    );

    return;
  }

  const liste =
    document.getElementById("kundeListe");

  if (liste) {

    liste.innerHTML = "";

    for (const k of res.data || []) {

      const div =
        document.createElement("div");

      div.className = "listekort";

      div.innerHTML = `
        <b>${k.navn || ""}</b><br>

        ${k.adresse || ""}<br>

        ${k.telefon || ""}
        ${k.epost || ""}

        <br><br>

        <button type="button"
                onclick='redigerKunde(${JSON.stringify(k)})'>

          Rediger

        </button>
      `;

      liste.appendChild(div);
    }
  }

  fyllKundeSelect(
    "hestKunde",
    res.data
  );

  fyllKundeSelect(
    "jobbKunde",
    res.data
  );
}

function fyllKundeSelect(id, kunder) {

  const select =
    document.getElementById(id);

  if (!select) return;

  const valgt =
    select.value;

  select.innerHTML =
    `<option value="">Velg kunde</option>`;

  for (const k of kunder || []) {

    const opt =
      document.createElement("option");

    opt.value = k.id;
    opt.textContent = k.navn;

    select.appendChild(opt);
  }

  if (valgt) {
    select.value = valgt;
  }
}

window.lagreKunde = lagreKunde;
window.hentKunder = hentKunder;
window.redigerKunde = redigerKunde;