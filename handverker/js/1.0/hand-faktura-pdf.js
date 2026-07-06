async function hentLogoBase64() {
  return await new Promise(resolve => {
    const img = new Image();

    img.crossOrigin = "anonymous";

    img.onload = function () {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        alert("Logo kunne ikke konverteres: " + (e.message || e));
        resolve(null);
      }
    };

    img.onerror = function () {
      alert("Logo kunne ikke lastes fra: " + LOGO_URL);
      resolve(null);
    };

    img.src = LOGO_URL + "?v=" + Date.now();
  });
}

async function leggTilLogo(doc) {
  if (typeof tegnLogoPdf === "function") {
    return await tegnLogoPdf(doc);
  }

  try {
    const logoBase64 = await hentLogoBase64();

    if (!logoBase64) {
      alert("Fant ikke logo.");
      return false;
    }

    const img = new Image();
    img.src = logoBase64;

    await new Promise(resolve => {
      img.onload = resolve;
    });

    const ratio = img.width / img.height;
    const bredde = 25;
    const hoyde = bredde / ratio;
    const x = 14;

    doc.addImage(logoBase64, "JPEG", x, 5, bredde, hoyde);

    return true;
  } catch (e) {
    alert("Kunne ikke legge logo på PDF: " + (e.message || e));
    console.error(e);
    return false;
  }
}

async function sperrFakturerteTimer(timerListe, fakturanr, fakturaId = null) {
  const ider =
    (timerListe || [])
      .map(t => t.id)
      .filter(Boolean);

  const dato = new Date().toISOString();

  // Oppdater minnet med en gang, slik at samme jobb ikke kan faktureres på nytt
  // uten at siden lastes på nytt.
  (timerListe || []).forEach(t => {
    t.fakturerbar = false;
    t.fakturert = true;
    t.faktura_id = fakturaId || t.faktura_id || null;
    t.fakturert_at = dato;
    t.fakturert_dato = dato; // brukes bare som bakoverkompatibilitet i minnet
    t.fakturanr = fakturanr;
  });

  if (!ider.length) {
    return true;
  }

  // Tabellen din har fakturert_at, ikke fakturert_dato.
  // Derfor prøver vi riktig kolonne først.
  const forsok = [
    {
      fakturerbar: false,
      fakturert: true,
      fakturert_at: dato,
      faktura_id: fakturaId,
      fakturanr: fakturanr
    },
    {
      fakturerbar: false,
      fakturert: true,
      fakturert_at: dato,
      faktura_id: fakturaId
    },
    {
      fakturerbar: false,
      fakturert: true,
      fakturanr: fakturanr
    },
    {
      fakturerbar: false,
      fakturert: true
    },
    {
      fakturerbar: false
    }
  ];

  let sisteError = null;

  for (const oppdatering of forsok) {
    try {
      const { error } = await supabaseClient
        .from("hand_time")
        .update(oppdatering)
        .in("id", ider);

      if (!error) {
        // Skriv også koblingen med alternative feltnavn hvis databasen bruker et annet navn.
        // Disse forsøkene er ufarlige: ukjente kolonner ignoreres.
        const ekstraKoblinger = [];
        if (fakturaId) {
          for (const felt of ["faktura_id", "fakturaid", "fakturaId", "faktura", "invoice_id", "invoiceId"]) {
            ekstraKoblinger.push({ [felt]: fakturaId });
            ekstraKoblinger.push({ [felt]: String(fakturaId) });
          }
        }
        for (const felt of ["fakturanr", "faktura_nr", "fakturanummer", "faktura_nummer", "invoice_no", "invoice_number"]) {
          ekstraKoblinger.push({ [felt]: fakturanr });
        }
        for (const ekstra of ekstraKoblinger) {
          try {
            await supabaseClient.from("hand_time").update(ekstra).in("id", ider);
          } catch (e) {
            // Ignorer ukjente felt. Ett av navnene over vil treffe riktig databasefelt.
          }
        }
        return true;
      }

      sisteError = error;
      const tekst = String(error.message || "");

      // Prøv neste fallback bare ved manglende kolonner/schema-cache.
      if (
        !tekst.includes("Could not find") &&
        !tekst.includes("schema cache") &&
        !tekst.includes("does not exist")
      ) {
        break;
      }
    } catch (e) {
      sisteError = e;
      break;
    }
  }

  console.warn("Kunne ikke sperre fakturerte timer:", sisteError);
  alert(
    "Faktura ble laget, men jobbene ble ikke sperret mot ny fakturering. " +
    "Ikke lag faktura på nytt før dette er rettet. Feil: " +
    (sisteError?.message || String(sisteError || "ukjent feil"))
  );
  return false;
}

