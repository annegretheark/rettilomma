async function lastKlinikker() {
  let query = supabaseClient
    .from("vet_klinikker")
    .select("*")
    .order("navn", { ascending: true });

  query = filtrerKlinikkQuery(query, "id");

  const { data, error } = await query;
  if (error) {
    vetMelding("klinikkMelding", "Feil ved henting av klinikker: " + error.message);
    return;
  }
  vetKlinikker = data || [];
  tegnKlinikker();
}



function oppdaterAdminKlinikkSynlighet() {
  const logoEl = document.getElementById("adminKlinikkLogo");
  const brukerEl = document.getElementById("adminKlinikkBrukere");
  const synlig = erKlinikkAdmin() && !erVetVisningVanlig();

  [logoEl, brukerEl].forEach(el => {
    if (!el) return;
    if (synlig) {
      el.classList.remove("skjult");
      el.style.display = "";
    } else {
      el.classList.add("skjult");
      el.style.display = "none";
    }
  });
  oppdaterVetMenySynlighet();
}

function visKlinikkLogoPreview(url) {
  const preview = document.getElementById("klinikkLogoPreview");
  if (!preview) return;

  if (url) {
    preview.src = url;
    preview.classList.remove("skjult");
    preview.style.display = "";
  } else {
    preview.removeAttribute("src");
    preview.classList.add("skjult");
    preview.style.display = "none";
  }
}

function forhåndsvisKlinikkLogo() {
  const fil = document.getElementById("klinikkLogoFil")?.files?.[0];
  if (!fil) return;

  const reader = new FileReader();
  reader.onload = e => visKlinikkLogoPreview(e.target.result);
  reader.readAsDataURL(fil);
}

async function lastOppKlinikkLogo(klinikkId) {
  const fil = document.getElementById("klinikkLogoFil")?.files?.[0];

  if (!fil || !klinikkId) {
    return null;
  }

  const filtype = (fil.name || "").split(".").pop() || "png";
  const tryggExt = String(filtype).toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const sti = `${klinikkId}/logo.${tryggExt}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(VET_LOGO_BUCKET)
    .upload(sti, fil, {
      cacheControl: "3600",
      upsert: true,
      contentType: fil.type || "image/png"
    });

  if (uploadError) {
    vetMelding("klinikkMelding", "Klinikk lagret, men logo kunne ikke lastes opp: " + uploadError.message);
    return null;
  }

  const { data } = supabaseClient.storage
    .from(VET_LOGO_BUCKET)
    .getPublicUrl(sti);

  return data?.publicUrl || null;
}

function hentValgtKlinikk() {
  const id = vetTekst("klinikkId");
  if (!id && vetKlinikker.length === 1) return vetKlinikker[0];
  return vetKlinikker.find(k => String(k.id) === String(id)) || null;
}

function settStandardKmPrisFraKlinikk() {
  const k = hentValgtKlinikk();
  const kmPris = Number(k?.km_pris || 5.30);
  if (!vetTekst("journalKmPris")) {
    vetSett("journalKmPris", kmPris.toFixed(2));
  }
}



function settKlinikkSkjemaLesemodusForVanligVet() {
  const erAdmin = erKlinikkAdmin() && !erVetVisningVanlig();
  const ids = ["klinikkNavn","konsernNavn","klinikkTelefon","klinikkEpost","klinikkAdresse","klinikkKmPris","klinikkLogoFil"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !erAdmin;
  });

  const lagre = document.getElementById("lagreKlinikkKnapp");
  if (lagre) lagre.style.display = erAdmin ? "" : "none";
}

function fyllKlinikkSkjemaMedAktivKlinikk() {
  if (vetErSystemAdmin === true || !vetAktivKlinikk) return;

  vetSett("klinikkId", vetAktivKlinikk.id);
  vetSett("klinikkNavn", vetAktivKlinikk.navn);
  vetSett("konsernNavn", vetAktivKlinikk.konsern_navn);
  vetSett("klinikkTelefon", vetAktivKlinikk.telefon);
  vetSett("klinikkEpost", vetAktivKlinikk.epost);
  vetSett("klinikkAdresse", vetAktivKlinikk.adresse);
  vetSett("klinikkKmPris", vetAktivKlinikk.km_pris || "5.30");
  visKlinikkLogoPreview(vetAktivKlinikk.logo_url || "");
}
