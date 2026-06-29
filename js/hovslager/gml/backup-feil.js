console.log("hovslager backup.js lastet (robust restore)");

const HOV_BACKUP_VERSJON = "3.1";

const HOV_BACKUP_TABELLER = [
  "hov_firma",
  "kunder",
  "hester",
  "hov_jobber",
  "hov_fakturaer",
  "hov_kreditnotaer"
];

const HOV_BACKUP_ALIASES = {
  firma: "hov_firma",
  hov_firma: "hov_firma",
  kunder: "kunder",
  hester: "hester",
  hov_jobber: "hov_jobber",
  hov_fakturaer: "hov_fakturaer",
  hov_kreditnotaer: "hov_kreditnotaer"
};

const HOV_RESTORE_REKKEFOLGE = [
  "hov_firma",
  "kunder",
  "hester",
  "hov_jobber",
  "hov_fakturaer",
  "hov_kreditnotaer"
];

function visBackupStatus(tekst, feil = false) {
  const el =
    document.getElementById("backupMelding") ||
    document.getElementById("firmaMelding") ||
    document.getElementById("fakturaMelding");

  if (el) {
    el.textContent = tekst || "";
    el.style.color = feil ? "#b42318" : "#116329";
  }
  console.log(tekst);
}

function hentSupabase() {
  const klient = window.supabaseClient || window.supabase;
  if (!window.supabaseClient) throw new Error("Supabase-klient er ikke klar. Last siden pa nytt og logg inn.");
  return window.supabaseClient;
}

async function hentAktivFirmaId() {
  if (window.hovAktivFirmaId) return window.hovAktivFirmaId;
  if (typeof window.hentAktivFirmaId === "function") {
    try { return await window.hentAktivFirmaId(); } catch (_) {}
  }
  const { data: sess } = await hentSupabase().auth.getSession();
  const epost = sess?.session?.user?.email;
  if (!epost) return null;
  const { data } = await hentSupabase()
    .from("hov_firma")
    .select("id")
    .ilike("epost", epost)
    .maybeSingle();
  return data?.id || null;
}

async function hentBackupData() {
  const supabaseClient = hentSupabase();
  const data = {
    dato: new Date().toISOString(),
    versjon: HOV_BACKUP_VERSJON,
    system: "RettiLomma Hovslager",
    prosjekt: "eget_supabase_prosjekt",
    tabeller: {}
  };

  for (const tabell of HOV_BACKUP_TABELLER) {
    try {
      const { data: rader, error } = await supabaseClient
        .from(tabell)
        .select("*");

      data.tabeller[tabell] = {
        feil: error ? error.message : null,
        antall: rader ? rader.length : 0,
        rader: rader || []
      };
    } catch (e) {
      data.tabeller[tabell] = {
        feil: e.message,
        antall: 0,
        rader: []
      };
    }
  }

  return data;
}

async function lagreBackupFil(data, prefix = "backup_hovslager") {
  const tekst = JSON.stringify(data, null, 2);
  const dato = new Date().toISOString().replace(/[:.]/g, "-");
  const filnavn = `${prefix}_${dato}.json`;

  const blob = new Blob([tekst], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function backup() {
  try {
    visBackupStatus("Starter backup...");
    const data = await hentBackupData();
    await lagreBackupFil(data, "backup_hovslager");
    visBackupStatus("Backup lagret.");
    alert("Backup er lagret.");
  } catch (feil) {
    console.error(feil);
    visBackupStatus("Backup feilet: " + feil.message, true);
    alert("Feil ved backup: " + feil.message);
  }
}

function normaliserBackupTabeller(backupData) {
  const ut = {};
  const inn = backupData.tabeller || {};
  for (const [navn, pakke] of Object.entries(inn)) {
    const tabell = HOV_BACKUP_ALIASES[navn] || navn;
    if (!ut[tabell]) ut[tabell] = pakke;
  }
  return ut;
}

function rensRadForRestore(tabell, rad, aktivFirmaId) {
  const r = { ...rad };

  // Gammel backup hadde firma.id = 1, mens ny hov_firma.id er uuid.
  if (tabell === "hov_firma") {
    if (r.id && !String(r.id).includes("-")) delete r.id;
    delete r.org_nr;
    delete r.system_type;
    delete r.logo_url;
    delete r.brevhode_tekst;
    delete r.brevfot_tekst;
    delete r.kontonr;
    delete r.mva_nr;
  }

  if (aktivFirmaId && tabell !== "hov_firma" && "firma_id" in r) {
    r.firma_id = aktivFirmaId;
  }

  return r;
}

async function importerBackup(event) {
  try {
    const fil = event?.target?.files?.[0] || document.getElementById("importFil")?.files?.[0];

    if (!fil) {
      alert("Ingen fil valgt.");
      return;
    }

    visBackupStatus("Leser backupfil: " + fil.name + "...");

    const tekst = await fil.text();
    const backupData = JSON.parse(tekst);

    if (!backupData.tabeller) {
      alert("Dette ser ikke ut som en gyldig backupfil.");
      return;
    }

    const bekreft = confirm(
      "Restore vil legge tilbake data fra backupfilen.\n\n" +
      "Rader med samme ID blir oppdatert, nye rader blir lagt til.\n\n" +
      "Vil du fortsette?"
    );

    if (!bekreft) return;

    const supabaseClient = hentSupabase();
    const aktivFirmaId = await hentAktivFirmaId();
    const tabeller = normaliserBackupTabeller(backupData);

    for (const tabell of HOV_RESTORE_REKKEFOLGE) {
      const pakke = tabeller[tabell];
      if (!pakke || !Array.isArray(pakke.rader) || pakke.rader.length === 0) continue;

      const rader = pakke.rader.map(rad => rensRadForRestore(tabell, rad, aktivFirmaId));
      visBackupStatus("Restorer " + tabell + " (" + rader.length + " rader)...");

      const { error } = await supabaseClient
        .from(tabell)
        .upsert(rader, { onConflict: "id" });

      if (error) throw new Error("Feil ved restore av " + tabell + ": " + error.message);
    }

    visBackupStatus("Restore ferdig.");
    alert("Restore er ferdig. Last siden pa nytt hvis dataene ikke vises med en gang.");
    const input = document.getElementById("importFil");
    if (input) input.value = "";
    location.reload();
  } catch (feil) {
    console.error(feil);
    visBackupStatus("Restore feilet: " + feil.message, true);
    alert("Feil ved restore: " + feil.message);
  }
}

function bindBackupRestore() {
  const backupKnapp = document.getElementById("backupKnapp");
  if (backupKnapp && !backupKnapp.dataset.hovBackupBundet) {
    backupKnapp.dataset.hovBackupBundet = "1";
    backupKnapp.addEventListener("click", backup);
  }

  const importFil = document.getElementById("importFil");
  if (importFil && !importFil.dataset.hovRestoreBundet) {
    importFil.dataset.hovRestoreBundet = "1";
    importFil.addEventListener("click", () => { importFil.value = ""; });
    importFil.addEventListener("change", importerBackup);
  }
}

window.backup = backup;
window.importerBackup = importerBackup;
window.hentBackupData = hentBackupData;
window.bindBackupRestore = bindBackupRestore;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindBackupRestore);
} else {
  bindBackupRestore();
}
setTimeout(bindBackupRestore, 500);
setTimeout(bindBackupRestore, 1500);
