# direkteFakturaVarer.js

```javascript
async function lagreDirekteFakturavare() {

  const kundeId = document.getElementById("direkteVareKunde")?.value || null;

  const prosjektId = document.getElementById("direkteVareProsjekt")?.value || null;

  const varenr = document.getElementById("direkteVareNr")?.value?.trim() || "";

  const navn = document.getElementById("direkteVareNavn")?.value?.trim() || "";

  const beskrivelse = document.getElementById("direkteVareBeskrivelse")?.value?.trim() || "";

  const antall = Number(
    document.getElementById("direkteVareAntall")?.value || 1
  );

  const enhet = document.getElementById("direkteVareEnhet")?.value || "stk";

  const pris = Number(
    document.getElementById("direkteVarePris")?.value || 0
  );

  const mva_prosent = Number(
    document.getElementById("direkteVareMva")?.value || 25
  );

  if (!kundeId) {
    alert("Velg kunde");
    return;
  }

  if (!navn) {
    alert("Skriv varenavn");
    return;
  }

  const { error } = await supabaseClient
    .from("faktura_varer")
    .insert([
      {
        kunde_id: kundeId,
        prosjekt_id: prosjektId || null,
        varenr,
        navn,
        beskrivelse,
        antall,
        enhet,
        pris,
        mva_prosent,
        fakturert: false
      }
    ]);

  if (error) {
    alert("Feil ved lagring: " + error.message);
    console.error(error);
    return;
  }

  alert("Direkte fakturavare lagret");

  document.getElementById("direkteVareNr").value = "";
  document.getElementById("direkteVareNavn").value = "";
  document.getElementById("direkteVareBeskrivelse").value = "";
  document.getElementById("direkteVareAntall").value = "1";
  document.getElementById("direkteVarePris").value = "0";
}

async function fyllDirekteVareKunder() {

  const kundeSelect = document.getElementById("direkteVareKunde");

  if (!kundeSelect) return;

  kundeSelect.innerHTML = `<option value="">Velg kunde</option>`;

  const { data, error } = await supabaseClient
    .from("kunder")
    .select("id, kundenr, navn")
    .order("navn", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  (data || []).forEach(kunde => {

    const option = document.createElement("option");

    option.value = kunde.id;

    option.textContent =
      `${kunde.kundenr || ""} ${kunde.navn || ""}`.trim();

    kundeSelect.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", () => {

  const knapp = document.getElementById("lagreDirekteVareKnapp");

  if (knapp) {
    knapp.addEventListener("click", lagreDirekteFakturavare);
  }

  fyllDirekteVareKunder();
});
```

# Legg dette i varerSide i index.html

```html
<hr>

<h3>Direkte varelinje til faktura</h3>

<label for="direkteVareKunde">Kunde</label>
<select id="direkteVareKunde"></select>

<label for="direkteVareNr">Varenr</label>
<input id="direkteVareNr">

<label for="direkteVareNavn">Varenavn</label>
<input id="direkteVareNavn">

<label for="direkteVareBeskrivelse">Beskrivelse</label>
<textarea id="direkteVareBeskrivelse"></textarea>

<div class="rad">
  <div>
    <label for="direkteVareAntall">Antall</label>
    <input id="direkteVareAntall" type="number" value="1" step="0.01">
  </div>

  <div>
    <label for="direkteVareEnhet">Enhet</label>
    <input id="direkteVareEnhet" value="stk">
  </div>
</div>

<div class="rad">
  <div>
    <label for="direkteVarePris">Pris</label>
    <input id="direkteVarePris" type="number" value="0" step="0.01">
  </div>

  <div>
    <label for="direkteVareMva">MVA %</label>
    <input id="direkteVareMva" type="number" value="25">
  </div>
</div>

<button id="lagreDirekteVareKnapp" type="button">
  Lagre direkte fakturavare
</button>
<script src="js/direkteFakturaVarer.js"></script>
