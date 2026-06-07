let vetKlinikkBrukere = [];

async function lastKlinikkBrukere() {
  if (!erKlinikkAdmin()) return;

  const klinikkId = vetTekst("klinikkId");
  if (!klinikkId) {
    tegnKlinikkBrukere([]);
    return;
  }

  const { data, error } = await supabaseClient
    .from("vet_klinikk_brukere")
    .select("*")
    .eq("klinikk_id", klinikkId)
    .order("epost", { ascending: true });

  if (error) {
    vetMelding("klinikkBrukerMelding", "Feil ved henting av brukere: " + error.message);
    return;
  }

  vetKlinikkBrukere = data || [];
  tegnKlinikkBrukere(vetKlinikkBrukere);
}

function tegnKlinikkBrukere(liste = []) {
  const el = document.getElementById("klinikkBrukerListe");
  if (!el) return;

  if (!erKlinikkAdmin()) {
    el.innerHTML = "";
    return;
  }

  if (!liste.length) {
    el.innerHTML = '<p class="lite">Ingen brukere koblet til valgt klinikk ennå.</p>';
    return;
  }

  el.innerHTML = liste.map(b => `
    <div class="listekort">
      <strong>${b.epost || ""}</strong><br>
      <span class="lite">Rolle: ${b.rolle || "veterinaer"}</span>
    </div>
  `).join("");
}

async function lagreKlinikkBruker() {
  vetMelding("klinikkBrukerMelding", "");

  if (!erKlinikkAdmin()) {
    vetMelding("klinikkBrukerMelding", "Kun admin kan koble brukere til klinikk.");
    return;
  }

  let klinikkId = vetTekst("klinikkId");
  if (!vetErSystemAdmin && vetAktivKlinikkId) klinikkId = vetAktivKlinikkId;
  const epost = vetTekst("klinikkBrukerEpost").toLowerCase();
  const rolle = vetTekst("klinikkBrukerRolle") || "veterinaer";

  if (!klinikkId) {
    vetMelding("klinikkBrukerMelding", "Velg/rediger klinikk først.");
    return;
  }

  if (!epost) {
    vetMelding("klinikkBrukerMelding", "Skriv e-post.");
    return;
  }

  const { error } = await supabaseClient
    .from("vet_klinikk_brukere")
    .upsert({
      epost,
      klinikk_id: klinikkId,
      rolle,
      aktiv: true
    }, { onConflict: "epost" });

  if (error) {
    vetMelding("klinikkBrukerMelding", "Feil ved lagring av bruker: " + error.message);
    return;
  }

  vetSett("klinikkBrukerEpost", "");
  vetSett("klinikkBrukerRolle", "veterinaer");
  vetMelding("klinikkBrukerMelding", "Bruker koblet til klinikk.");
  await lastKlinikkBrukere();
}

function oppdaterAdminBrukerSynlighet() {
  const el = document.getElementById("adminKlinikkBrukere");
  if (!el) return;
  el.style.display = erKlinikkAdmin() ? "" : "none";
  if (erKlinikkAdmin()) el.classList.remove("skjult");
  else el.classList.add("skjult");
}


async function hentKlinikkIdForNyBruker() {
  let klinikkId = vetTekst("klinikkId");

  if (!vetErSystemAdmin && vetAktivKlinikkId) {
    klinikkId = vetAktivKlinikkId;
  }

  if (!klinikkId && vetAktivKlinikkId) {
    klinikkId = vetAktivKlinikkId;
  }

  return klinikkId;
}

async function opprettKlinikkBruker() {
  vetMelding("klinikkBrukerMelding", "");

  if (!erKlinikkAdmin()) {
    vetMelding("klinikkBrukerMelding", "Kun klinikkadmin kan opprette brukere.");
    return;
  }

  const klinikkId = await hentKlinikkIdForNyBruker();
  const navn = vetTekst("nyBrukerNavn");
  const epost = vetTekst("nyBrukerEpost").toLowerCase();
  const passord = vetTekst("nyBrukerPassord");
  const rolle = vetTekst("nyBrukerRolle") || "veterinaer";

  if (!klinikkId) {
    vetMelding("klinikkBrukerMelding", "Velg/rediger klinikk først.");
    return;
  }

  if (!epost || !passord) {
    vetMelding("klinikkBrukerMelding", "Skriv e-post og passord.");
    return;
  }

  if (passord.length < 6) {
    vetMelding("klinikkBrukerMelding", "Passord må være minst 6 tegn.");
    return;
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    vetMelding("klinikkBrukerMelding", "Du er ikke innlogget.");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/opprett-vet-bruker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      navn,
      epost,
      passord,
      rolle,
      klinikk_id: klinikkId
    })
  });

  const svar = await res.json().catch(() => ({}));

  if (!res.ok) {
    vetMelding("klinikkBrukerMelding", svar.error || "Kunne ikke opprette bruker.");
    return;
  }

  vetSett("nyBrukerNavn", "");
  vetSett("nyBrukerEpost", "");
  vetSett("nyBrukerPassord", "");
  vetSett("nyBrukerRolle", "veterinaer");

  vetMelding("klinikkBrukerMelding", "Bruker opprettet og koblet til klinikken.");
  await lastKlinikkBrukere();
}



function vetInstallerToppLayoutFiks() {
  if (document.getElementById("vetToppLayoutFiksStyle")) return;
  const style = document.createElement("style");
  style.id = "vetToppLayoutFiksStyle";
  style.textContent = `
    #vetMeny,
    .vet-meny,
    header nav,
    .vet-topp nav {
      display:flex !important;
      flex-wrap:wrap !important;
      align-items:center !important;
      gap:10px !important;
    }

    #vetMeny > button,
    .vet-meny > button,
    header nav > button,
    .vet-topp nav > button,
    #vetPasientHurtigKnapper > button {
      margin:0 !important;
      white-space:nowrap !important;
      height:52px;
      display:inline-flex !important;
      align-items:center !important;
      justify-content:center !important;
    }

    #vetPasientHurtigKnapper {
      display:inline-flex !important;
      flex-wrap:nowrap !important;
      gap:10px !important;
      margin:0 !important;
      align-items:center !important;
      width:auto !important;
    }

    #vetBackupBunnMeny {
      margin:46px auto 24px auto;
      padding:16px 22px;
      max-width:1280px;
      border-radius:14px;
      background:rgba(255,255,255,.035);
      border:1px solid rgba(255,255,255,.08);
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      align-items:center;
    }

    #vetBackupBunnMeny .lite {
      margin-right:8px;
    }
  `;
  document.head.appendChild(style);
}

function flyttVetBackupKnappTilBunn() {
  const allerede = document.getElementById("vetBackupBunnMeny");
  let bunn = allerede;

  if (!bunn) {
    bunn = document.createElement("div");
    bunn.id = "vetBackupBunnMeny";
    bunn.innerHTML = '<span class="lite">Backup og restore:</span>';
    document.body.appendChild(bunn);
  }

  const erFunksjonsKnapp = el => [
    "vetBackupKnapp",
    "vetRestoreKnapp",
    "vetImportPriserKnapp",
    "vetImportVarerKnapp"
  ].includes(el.id);

  const knapp = Array.from(document.querySelectorAll("button, a"))
    .find(el =>
      !erFunksjonsKnapp(el) &&
      /backup|import/i.test(String(el.textContent || "")) &&
      !el.closest("#vetBackupBunnMeny")
    );

  if (!knapp) return;

  knapp.classList.add("secondary");
  knapp.style.display = "inline-flex";
  knapp.style.margin = "0";
  bunn.appendChild(knapp);
}
