console.log("beh-kunder.js lastet");

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

  try {
    if (!window.supabaseClient && typeof supabaseClient === "undefined") {
      alert("Programfeil: Supabase er ikke lastet. Sjekk config.js og script-rekkefølge i index.html.");
      return;
    }

    const kundeIdEl = document.getElementById("kundeId");
    const navnEl = document.getElementById("kundeNavn");
    const adresseEl = document.getElementById("kundeAdresse");
    const epostEl = document.getElementById("kundeEpost");
    const telefonEl = document.getElementById("kundeTelefon");
    const kontaktEl = document.getElementById("kundeKontaktperson");

    if (!kundeIdEl || !navnEl || !adresseEl || !epostEl || !telefonEl || !kontaktEl) {
      alert(
        "Programfeil: Mangler ett eller flere kundefelt i index.html:\n" +
        "kundeId: " + !!kundeIdEl + "\n" +
        "kundeNavn: " + !!navnEl + "\n" +
        "kundeAdresse: " + !!adresseEl + "\n" +
        "kundeEpost: " + !!epostEl + "\n" +
        "kundeTelefon: " + !!telefonEl + "\n" +
        "kundeKontaktperson: " + !!kontaktEl
      );
      return;
    }

    const kundeId = kundeIdEl.value;
    const navn = navnEl.value.trim();

    if (!navn) {
      kundeMelding("Mangler kundenavn", true);
      alert("Mangler kundenavn");
      return;
    }

    const kunde = {
      navn,
      adresse: adresseEl.value.trim(),
      epost: epostEl.value.trim(),
      telefon: telefonEl.value.trim(),
      kontaktperson: kontaktEl.value.trim()
    };

    kundeMelding("Lagrer kunde...");

    let res;

    if (kundeId) {
      res = await supabaseClient
        .from("beh_kunder")
        .update(kunde)
        .eq("id", kundeId)
        .select("*");
    } else {
      res = await supabaseClient
        .from("beh_kunder")
        .insert([kunde])
        .select("*");
    }

    if (res.error) {
      console.error(res.error);
      const msg = res.error.message || JSON.stringify(res.error);
      kundeMelding(msg, true);
      alert("Kunde ble ikke lagret:\n" + msg);
      return;
    }

    kundeMelding(kundeId ? "Kunde oppdatert" : "Kunde lagret");
    alert(kundeId ? "Kunde oppdatert" : "Kunde lagret");

    nullstillKundeFelter();
    await hentKunder();

  } catch (e) {
    console.error(e);
    const msg = e && e.message ? e.message : String(e);
    kundeMelding(msg, true);
    alert("Programfeil ved lagring av kunde:\n" + msg);
  }
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
    .from("beh_kunder")
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
        <button type="button" class="danger"
                onclick="slettKunde('${k.id}')">

          Slett

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
    "behandlingKunde",
    res.data
  );

  fyllKundeSelect(
    "fakturaKunde",
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

async function slettKunde(id) {
  if (!id) return;
  if (!confirm("Slette kunden? Hester og behandlinger kan også bli påvirket.")) return;

  const res = await supabaseClient
    .from("beh_kunder")
    .delete()
    .eq("id", id);

  if (res.error) {
    console.error(res.error);
    kundeMelding(res.error.message, true);
    return;
  }

  kundeMelding("Kunde slettet");
  nullstillKundeFelter();
  await hentKunder();
  if (typeof window.hentHester === "function") await window.hentHester();
  if (typeof window.hentBehandlinger === "function") await window.hentBehandlinger();
}

function nyKunde() {
  nullstillKundeFelter();
  kundeMelding("");
  if (typeof window.visSide === "function") window.visSide("kundeSide");
}

window.lagreKunde = lagreKunde;
window.hentKunder = hentKunder;
window.redigerKunde = redigerKunde;
window.slettKunde = slettKunde;
window.nyKunde = nyKunde;