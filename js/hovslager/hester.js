console.log("hester.js lastet");

function hestMelding(tekst, feil = false) {

  const el =
    document.getElementById("hestMelding");

  if (el) {

    el.textContent =
      tekst || "";

    el.style.color =
      feil ? "#b42318" : "#116329";
  }
}

async function lagreHest() {

  const kundeId =
    document.getElementById(
      "hestKunde"
    ).value;

  const navn =
    document.getElementById(
      "hestNavn"
    ).value.trim();

  if (!kundeId) {

    hestMelding(
      "Velg kunde/eier først",
      true
    );

    return;
  }

  if (!navn) {

    hestMelding(
      "Mangler hestenavn",
      true
    );

    return;
  }

  const hest = {

    kunde_id:
      kundeId,

    navn,

    rase:
      document.getElementById(
        "hestRase"
      ).value.trim(),

    notater:
      document.getElementById(
        "hestNotater"
      )?.value.trim() || "",

    sist_skodd:
      document.getElementById(
        "sistSkodd"
      )?.value || null,

    neste_besok:
      document.getElementById(
        "nesteBesok"
      )?.value || null
  };

  const res =
    await supabaseClient
      .from("hester")
      .insert([hest]);

  if (res.error) {

    console.error(res.error);

    hestMelding(
      res.error.message,
      true
    );

    return;
  }

  hestMelding(
    "Hest lagret"
  );

  document.getElementById(
    "hestNavn"
  ).value = "";

  document.getElementById(
    "hestRase"
  ).value = "";

  if (
    document.getElementById(
      "hestNotater"
    )
  ) {

    document.getElementById(
      "hestNotater"
    ).value = "";
  }

  if (
    document.getElementById(
      "sistSkodd"
    )
  ) {

    document.getElementById(
      "sistSkodd"
    ).value = "";
  }

  if (
    document.getElementById(
      "nesteBesok"
    )
  ) {

    document.getElementById(
      "nesteBesok"
    ).value = "";
  }

  await hentHester();
}

async function hentHester() {

  const res =
    await supabaseClient
      .from("hester")
      .select("*, kunder(navn)")
      .order("navn");

  if (res.error) {

    console.error(res.error);

    hestMelding(
      res.error.message,
      true
    );

    return;
  }

  const hester =
    res.data || [];

  const liste =
    document.getElementById(
      "hesteListe"
    );

  if (liste) {

    liste.innerHTML = "";

    for (const h of hester) {

      const div =
        document.createElement(
          "div"
        );

      div.className =
        "listekort";

      div.innerHTML = `
        <b>${h.navn || ""}</b><br>
        Eier: ${h.kunder?.navn || ""}<br>
        ${h.rase || ""}<br>
        Neste besøk:
        ${h.neste_besok || ""}
      `;

      liste.appendChild(div);
    }
  }

  fyllHestSelect(hester);
}

function fyllHestSelect(hester) {

  const select =
    document.getElementById(
      "jobbHest"
    );

  if (!select) return;

  const valgtKunde =
    String(
      document.getElementById(
        "jobbKunde"
      )?.value || ""
    );

  select.innerHTML =
    `<option value="">
      Velg hest
    </option>`;

  for (const h of hester || []) {

    if (
      valgtKunde &&
      String(h.kunde_id) !== valgtKunde
    ) {
      continue;
    }

    const opt =
      document.createElement(
        "option"
      );

    opt.value =
      h.id;

    opt.textContent =
      h.navn;

    select.appendChild(opt);
  }
}

window.lagreHest =
  lagreHest;

window.hentHester =
  hentHester;

window.fyllHestSelect =
  fyllHestSelect;