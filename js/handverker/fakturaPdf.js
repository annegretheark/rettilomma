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
    const bredde = 70;
    const hoyde = bredde / ratio;

    const sidebredde = doc.internal.pageSize.getWidth();
    const x = (sidebredde - bredde) / 2;

    doc.addImage(logoBase64, "JPEG", x, 3, bredde, hoyde);

    return true;
  } catch (e) {
    alert("Kunne ikke legge logo på PDF: " + (e.message || e));
    console.error(e);
    return false;
  }
}

async function sperrFakturerteTimer(timerListe, fakturanr) {
  const ider =
    timerListe
      .map(t => t.id)
      .filter(Boolean);

  timerListe.forEach(t => {
    t.fakturerbar = false;
    t.fakturert = true;
    t.fakturanr = fakturanr;
    t.fakturert_dato = new Date().toISOString();
  });

  if (!ider.length) {
    return true;
  }

  try {
    const { error } =
      await supabaseClient
        .from("timer")
        .update({
          fakturerbar: false,
          fakturert: true,
          fakturanr: fakturanr,
          fakturert_dato: new Date().toISOString()
        })
        .in("id", ider);

    if (error) {
      console.warn("Kunne ikke sperre fakturerte timer:", error);
      return false;
    }

    return true;
  } catch (e) {
    console.warn("Kunne ikke sperre fakturerte timer:", e);
    return false;
  }
}
