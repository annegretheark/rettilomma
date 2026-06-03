let ansatte = [];
let trekk = [];
let trekkTyper = [];

function hentVerdi(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function settVerdi(id, verdi) {
  const el = document.getElementById(id);
  if (el) el.value = verdi || "";
}

function settAnsattMelding(tekst) {
  const el = document.getElementById("ansattMelding");
  if (el) el.textContent = tekst || "";
}

function leggTilHvisFinnes(obj, felt, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const verdi = el.value.trim();
  obj[felt] = verdi === "" ? null : verdi;
}

async function lastTrekkTyper() {
  const select = document.getElementById("trekkType");
  if (!select) return;

  select.innerHTML = `<option value="">Velg trekk</option>`;

  const { data, error } = await supabaseClient
    .from("trekk_typer")
    .select("*")
    .order("navn");

  if (error) {
    console.error("Feil ved henting av trekktyper:", error);
    settAnsattMelding("Feil ved henting av trekktyper: " + error.message);
    return;
  }

  trekkTyper = data || [];
  window.trekkTyper = trekkTyper;

  trekkTyper.forEach(trekkType => {
    const option = document.createElement("option");
    option.value = trekkType.id;
    option.textContent = trekkType.navn;
    select.appendChild(option);
  });

  oppdaterTrekkEnhet();
}

async function lastAnsatte() {
  const { data, error } = await supabaseClient
    .from("ansatte")
    .select("*")
    .order("navn");

  if (error) {
    console.error("Feil ved henting av ansatte:", error);
    settAnsattMelding("Feil ved henting av ansatte: " + error.message);
    return;
  }

  ansatte = data || [];
  window.ansatte = ansatte;

  if (typeof fyllLonnAnsattValg === "function") {
    fyllLonnAnsattValg(ansatte);
  }

  if (typeof fyllBilvalg === "function") await fyllBilvalg();
  visAnsatte();
}

function visAnsatte() {
  const liste = document.getElementById("ansattListe");
  if (!liste) return;

  liste.innerHTML = "";

  if (!ansatte.length) {
    liste.innerHTML = "<p>Ingen ansatte funnet.</p>";
    return;
  }

  ansatte.forEach(ansatt => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <strong>${ansatt.navn || ""}</strong><br>
      ${ansatt.epost || ""}<br>
      ${ansatt.mobil || ansatt.mobile || ""}<br>
      ${ansatt.rolle ? "Rolle: " + ansatt.rolle + "<br>" : ""}
      ${ansatt.standard_bil_id ? "Standard bil-id: " + ansatt.standard_bil_id + "<br>" : ""}
      <button type="button" class="secondary" onclick="endreAnsatt('${ansatt.id}')">Endre</button>
      <button type="button" class="secondary" onclick="settPassord('${ansatt.id}')">Sett passord</button>
      <button type="button" class="secondary" onclick="slettAnsatt('${ansatt.id}')">Slett</button>
    `;

    liste.appendChild(div);
  });
}

function endreAnsatt(id) {
  const ansatt = ansatte.find(a => String(a.id) === String(id));

  if (!ansatt) {
    alert("Fant ikke ansatt");
    return;
  }

  settVerdi("ansattId", ansatt.id);
  settVerdi("ansattNavn", ansatt.navn);
  settVerdi("ansattEpost", ansatt.epost);
  settVerdi("ansattMobil", ansatt.mobil || ansatt.mobile);
  settVerdi("ansattStandardBil", ansatt.standard_bil_id || "");
  settVerdi("ansattPersonnr", ansatt.personnr || ansatt.fodselsnr);
  settVerdi("ansattKontonr", ansatt.kontonr);
  settVerdi("ansattRolle", ansatt.rolle);
  settVerdi("ansattStartDato", ansatt.startdato || ansatt.start_dato);
  settVerdi("ansattSluttDato", ansatt.sluttdato || ansatt.slutt_dato);
  settVerdi("timelonn", ansatt.timelonn);
  settVerdi("skattetrekk", ansatt.skattetrekk);
  settVerdi("ekstraSkatt", ansatt.ekstra_skatt || ansatt.ekstraskatt);

  settAnsattMelding("Redigerer ansatt. Trykk Lagre bruker / ansatt når du er ferdig.");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let lagrerAnsatt = false;

async function lagreAnsatt() {
  if (lagrerAnsatt) return;

  lagrerAnsatt = true;

  const lagreKnapp = document.getElementById("lagreAnsattKnapp");
  if (lagreKnapp) lagreKnapp.disabled = true;

  try {
    const id = hentVerdi("ansattId");

    const ansatt = {
      navn: hentVerdi("ansattNavn"),
      epost: hentVerdi("ansattEpost").toLowerCase()
    };

    leggTilHvisFinnes(ansatt, "mobil", "ansattMobil");
    leggTilHvisFinnes(ansatt, "standard_bil_id", "ansattStandardBil");
    leggTilHvisFinnes(ansatt, "personnr", "ansattPersonnr");
    leggTilHvisFinnes(ansatt, "kontonr", "ansattKontonr");
    leggTilHvisFinnes(ansatt, "rolle", "ansattRolle");
    leggTilHvisFinnes(ansatt, "startdato", "ansattStartDato");
    leggTilHvisFinnes(ansatt, "sluttdato", "ansattSluttDato");
    leggTilHvisFinnes(ansatt, "timelonn", "timelonn");
    leggTilHvisFinnes(ansatt, "skattetrekk", "skattetrekk");
    leggTilHvisFinnes(ansatt, "ekstra_skatt", "ekstraSkatt");

    if (!ansatt.navn || !ansatt.epost) {
      settAnsattMelding("Navn og e-post må fylles ut.");
      return;
    }

    let result;

    if (id) {
      result = await supabaseClient
        .from("ansatte")
        .update(ansatt)
        .eq("id", id)
        .select();
    } else {
      const { data: finnesFraFor, error: sjekkError } = await supabaseClient
        .from("ansatte")
        .select("id")
        .eq("epost", ansatt.epost)
        .limit(1);

      if (sjekkError) {
        console.error("Feil ved sjekk av eksisterende ansatt:", sjekkError);
        settAnsattMelding("Feil ved sjekk av eksisterende ansatt: " + sjekkError.message);
        return;
      }

      if (finnesFraFor && finnesFraFor.length > 0) {
        settAnsattMelding("Ansatt med denne e-posten finnes allerede.");
        return;
      }

      result = await supabaseClient
        .from("ansatte")
        .insert([ansatt])
        .select();
    }

    if (result.error) {
      console.error("Feil ved lagring av ansatt:", result.error);
      settAnsattMelding("Feil ved lagring av ansatt: " + result.error.message);
      return;
    }

    nyttAnsattSkjema();
    settAnsattMelding("Ansatt lagret.");
    await lastAnsatte();
  } finally {
    lagrerAnsatt = false;
    if (lagreKnapp) lagreKnapp.disabled = false;
  }
}

async function settPassord(id) {
  const ansatt = ansatte.find(a => String(a.id) === String(id));

  if (!ansatt) {
    alert("Fant ikke ansatt");
    return;
  }

  const passord = prompt(`Sett midlertidig passord for ${ansatt.navn || ansatt.epost}`);
  if (!passord) return;

  if (passord.length < 6) {
    alert("Passord må være minst 6 tegn");
    return;
  }

  const { error } = await supabaseClient.auth.signUp({
    email: ansatt.epost,
    password: passord
  });

  if (error) {
    console.error("Feil ved oppretting av innlogging:", error);
    alert("Feil ved oppretting av innlogging: " + error.message);
    return;
  }

  const result = await supabaseClient
    .from("ansatte")
    .update({ ma_bytte_passord: true })
    .eq("id", id);

  if (result.error) {
    console.error("Bruker ble opprettet, men passordbytte-flagg ble ikke lagret:", result.error);
    alert("Bruker ble opprettet, men passordbytte-flagg ble ikke lagret: " + result.error.message);
    return;
  }

  alert("Bruker er opprettet med midlertidig passord.");
  await lastAnsatte();
}

function nyttAnsattSkjema() {
  settVerdi("ansattId", "");
  settVerdi("ansattNavn", "");
  settVerdi("ansattEpost", "");
  settVerdi("ansattMobil", "");
  settVerdi("ansattStandardBil", "");
  settVerdi("ansattPersonnr", "");
  settVerdi("ansattKontonr", "");
  settVerdi("ansattRolle", "ansatt");
  settVerdi("ansattStartDato", "");
  settVerdi("ansattSluttDato", "");
  settVerdi("timelonn", "");
  settVerdi("skattetrekk", "");
  settVerdi("ekstraSkatt", "");
  settVerdi("trekkType", "");
  settVerdi("trekkBelop", "");

  trekk = [];
  window.trekk = trekk;

  tegnTrekkListe();
  oppdaterTrekkEnhet();
  settAnsattMelding("");
}

async function slettAnsatt(id) {
  if (!confirm("Vil du slette denne ansatte?")) return;

  const { error } = await supabaseClient
    .from("ansatte")
    .delete()
    .eq("id", id);

  if (error) {
    console.warn("Kunne ikke slette ansatt, prøver å sette inaktiv:", error);

    const result = await supabaseClient
      .from("ansatte")
      .update({ aktiv: false })
      .eq("id", id);

    if (result.error) {
      console.error("Feil ved sletting/inaktivering:", result.error);
      alert("Kunne ikke slette ansatt: " + result.error.message);
      return;
    }

    alert("Ansatt hadde timer og ble satt inaktiv.");
  }

  await lastAnsatte();
}

function erProsentTrekk(navn) {
  const ren = String(navn || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%]/g, "");

  return (
    ren.includes("skatt") ||
    ren.includes("skatte") ||
    ren.includes("forskudd") ||
    ren.includes("tabell") ||
    ren.includes("prosent") ||
    ren.includes("%")
  );
}

function hentValgtTrekkNavn() {
  const select = document.getElementById("trekkType");

  if (!select || select.selectedIndex < 0) {
    return "";
  }

  const tekst = select.options[select.selectedIndex].textContent || "";
  return tekst.trim();
}

function oppdaterTrekkEnhet() {
  const label = document.querySelector('label[for="trekkBelop"]');
  const input = document.getElementById("trekkBelop");
  const valgtTekst = hentValgtTrekkNavn();
  const erSkatt = erProsentTrekk(valgtTekst);

  if (label) {
    label.textContent = erSkatt ? "Prosent" : "Beløp";
  }

  if (input) {
    input.placeholder = erSkatt ? "F.eks. 35" : "F.eks. 500";
  }
}

function leggTilTrekk() {
  const type = hentVerdi("trekkType");
  const belop = hentVerdi("trekkBelop");

  if (!type || !belop) {
    settAnsattMelding("Velg trekk-type og beløp.");
    return;
  }

  const valgtTekst = hentValgtTrekkNavn();
  const valgtTrekk = trekkTyper.find(t => String(t.id) === String(type));
  const navn = valgtTekst || (valgtTrekk ? valgtTrekk.navn : type);
  const enhet = erProsentTrekk(navn) ? "%" : " kr";

  trekk.push({
    type,
    navn,
    belop,
    enhet
  });

  window.trekk = trekk;

  settVerdi("trekkType", "");
  settVerdi("trekkBelop", "");

  tegnTrekkListe();
  oppdaterTrekkEnhet();
}

function tegnTrekkListe() {
  const liste = document.getElementById("trekkListe");
  if (!liste) return;

  if (!trekk.length) {
    liste.innerHTML = "";
    return;
  }

  liste.innerHTML = trekk
    .map(t => {
      const navn = t.navn || t.type || "";
      const enhet = t.enhet || (erProsentTrekk(navn) ? "%" : " kr");

      return `<div>${navn}: ${t.belop}${enhet}</div>`;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  const nyKnapp = document.getElementById("nyAnsattKnapp");
  if (nyKnapp) nyKnapp.onclick = nyttAnsattSkjema;

  const trekkSelect = document.getElementById("trekkType");
  if (trekkSelect) trekkSelect.onchange = oppdaterTrekkEnhet;

  await lastTrekkTyper();
});

window.ansatte = ansatte;
window.trekk = trekk;
window.trekkTyper = trekkTyper;

window.lastAnsatte = lastAnsatte;
window.visAnsatte = visAnsatte;
window.tegnAnsatte = visAnsatte;

window.endreAnsatt = endreAnsatt;
window.redigerAnsatt = endreAnsatt;

window.lagreAnsatt = lagreAnsatt;
window.nyttAnsattSkjema = nyttAnsattSkjema;

window.settPassord = settPassord;
window.slettAnsatt = slettAnsatt;

window.leggTilTrekk = leggTilTrekk;
window.tegnTrekkListe = tegnTrekkListe;

window.lastTrekkTyper = lastTrekkTyper;
window.erProsentTrekk = erProsentTrekk;
window.oppdaterTrekkEnhet = oppdaterTrekkEnhet;