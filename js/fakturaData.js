
function hentValgtMaaned() {
  const datoFelt = document.getElementById("dato");
  const dato = datoFelt && datoFelt.value
    ? datoFelt.value
    : new Date().toISOString().slice(0, 10);

  return dato.slice(0, 7);
}

function hentValgtKunde() {
  const fakturaKundeValg = document.getElementById("fakturaKundeValg");
  const kundeValg = document.getElementById("kundeValg");

  const valgtVerdi =
    fakturaKundeValg && fakturaKundeValg.value
      ? fakturaKundeValg.value
      : kundeValg && kundeValg.value
        ? kundeValg.value
        : "";

  if (!valgtVerdi) {
    return null;
  }

  const valgtId = String(valgtVerdi);

  return (window.kunder || []).find(k =>
    String(k.id || "") === valgtId ||
    String(k.kundenr || "") === valgtId ||
    String(k.kunde_nr || "") === valgtId
  ) || null;
}

async function hentFirmaData() {
  try {
    const { data, error } =
      await supabaseClient
        .from("firma")
        .select("*")
        .limit(1)
        .maybeSingle();

    if (error) {
      console.warn("Firma-feil:", error);
    }

    return data || {};
  } catch (e) {
    console.warn("Kunne ikke hente firma:", e);
    return {};
  }
}

function hentKundeNr(kunde, time) {
  return String(
    kunde?.kundenr ||
    kunde?.kunde_nr ||
    kunde?.id ||
    time?.kunde_nr ||
    time?.kundeNr ||
    time?.kunde_id ||
    ""
  );
}

function hentKundeNavn(kunde, time) {
  return String(
    kunde?.navn ||
    time?.kunde_navn ||
    time?.kundeNavn ||
    time?.kunde ||
    "Kunde"
  );
}

function finnKundeForTime(time) {
  const kunder = window.kunder || [];

  return kunder.find(k =>
    String(k.id || "") === String(time.kunde_id || "") ||
    String(k.kundenr || "") === String(time.kunde_nr || time.kundeNr || "") ||
    String(k.navn || "").toLowerCase() ===
      String(time.kunde_navn || time.kundeNavn || time.kunde || "").toLowerCase()
  ) || null;
}

function erSammeKunde(time, kunde) {
  if (!kunde) return true;

  return (
    String(time.kunde_id || "") === String(kunde.id || "") ||
    String(time.kunde_nr || time.kundeNr || "") === String(kunde.kundenr || kunde.id || "") ||
    String(time.kunde_navn || time.kundeNavn || time.kunde || "").toLowerCase() ===
      String(kunde.navn || "").toLowerCase()
  );
}

function erAlleredeFakturert(time) {
  return (
    time.fakturerbar === false ||
    time.fakturert === true ||
    time.faktura_id ||
    time.fakturanr ||
    time.fakturert_dato
  );
}

function beregnSumEksMvaForTime(time) {
  if (
    time.sum !== undefined &&
    time.sum !== null &&
    Number(time.sum) > 0
  ) {
    return Number(time.sum);
  }

  return Number(time.timer || 0) * Number(time.timepris || 0);
}

function beregnMvaLinje(time) {
  const sumEksMva = beregnSumEksMvaForTime(time);
  const mva = sumEksMva * MVA_SATS;
  const sumInkMva = sumEksMva + mva;

  return {
    sumEksMva,
    mva,
    sumInkMva
  };
}

function summerTimerMedMva(timerListe) {
  return timerListe.reduce(
    (acc, t) => {
      const linje = beregnMvaLinje(t);

      acc.sumEksMva += linje.sumEksMva;
      acc.mva += linje.mva;
      acc.sumInkMva += linje.sumInkMva;

      return acc;
    },
    {
      sumEksMva: 0,
      mva: 0,
      sumInkMva: 0
    }
  );
}

function grupperTimerPerKunde(timerListe) {
  const grupper = new Map();

  timerListe.forEach(t => {
    const kunde =
      finnKundeForTime(t) || {
        id: t.kunde_id || t.kunde_nr || t.kunde_navn || "kunde",
        kundenr: t.kunde_nr || t.kunde_id || "",
        navn: t.kunde_navn || t.kunde || "Kunde",
        adresse: "",
        postadresse: ""
      };

    const key = String(
      kunde.kundenr ||
      kunde.id ||
      kunde.navn ||
      "kunde"
    ).toLowerCase().trim();

    if (!grupper.has(key)) {
      grupper.set(key, {
        kunde,
        timer: []
      });
    }

    grupper.get(key).timer.push(t);
  });

  return Array.from(grupper.values());
}