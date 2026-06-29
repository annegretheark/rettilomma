console.log("hovslager backup.js lastet - restore knapp fix");

const HOV_BACKUP_VERSJON = "3.1-restore-knapp";

const HOV_BACKUP_TABELLER = [
  "hov_firma",
  "kunder",
  "hester",
  "hov_jobber",
  "hov_fakturaer",
  "hov_kreditnotaer"
];

const HOV_RESTORE_REKKEFOLGE = [
  "firma",
  "hov_firma",
  "kunder",
  "hester",
  "hov_jobber",
  "hov_fakturaer",
  "hov_kreditnotaer"
];

const HOV_BACKUP_TABELL_MAP = {
  firma: "hov_firma",
  hov_firma: "hov_firma",
  kunder: "kunder",
  hester: "hester",
  hov_jobber: "hov_jobber",
  hov_fakturaer: "hov_fakturaer",
  hov_kreditnotaer: "hov_kreditnotaer"
};

let valgtRestoreFil = null;

function visBackupStatus(tekst, feil = false) {
  const el = document.getElementById("backupMelding") || document.getElementById("firmaMelding") || document.getElementById("fakturaMelding");
  if (el) {
    el.textContent = tekst || "";
    el.style.color = feil ? "#fca5a5" : "#86efac";
  }
  console.log(tekst);
}

async function hentInnloggetEpost() {
  const { data } = await supabaseClient.auth.getUser();
  return data?.user?.email || null;
}

async function hentAktivFirmaId() {
  if (window.hovAktivFirmaId) return window.hovAktivFirmaId;

  const epost = await hentInnloggetEpost();
  if (epost) {
    const { data, error } = await supabaseClient
      .from("hov_firma")
      .select("id, navn, epost, auth_user_id")
      .ilike("epost", epost)
      .maybeSingle();
    if (!error && data?.id) {
      window.hovAktivFirmaId = data.id;
      window.hovAktivFirma = data;
      return data.id;
    }
  }

  const { data, error } = await supabaseClient
    .from("hov_firma")
    .select("id, navn, epost, auth_user_id")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error("Fant ikke firma i hov_firma.");
  window.hovAktivFirmaId = data.id;
  window.hovAktivFirma = data;
  return data.id;
}

async function hentBackupData() {
  const data = {
    dato: new Date().toISOString(),
    versjon: HOV_BACKUP_VERSJON,
    system: "RettiLomma Hovslager",
    prosjekt: "eget_supabase_prosjekt",
    tabeller: {}
  };

  for (const tabell of HOV_BACKUP_TABELLER) {
    try {
      const { data: rader, error } = await supabaseClient.from(tabell).select("*");
      data.tabeller[tabell] = { feil: error ? error.message : null, antall: rader ? rader.length : 0, rader: rader || [] };
    } catch (e) {
      data.tabeller[tabell] = { feil: e.message, antall: 0, rader: [] };
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
    const feilTabeller = Object.entries(data.tabeller).filter(([_, pakke]) => pakke.feil).map(([navn, pakke]) => navn + ": " + pakke.feil);
    if (feilTabeller.length) {
      visBackupStatus("Backup lagret, men noen tabeller feilet: " + feilTabeller.join(" | "), true);
      alert("Backup lagret, men noen tabeller feilet:\n\n" + feilTabeller.join("\n"));
      return;
    }
    visBackupStatus("Backup lagret.");
    alert("Backup er lagret.");
  } catch (feil) {
    console.error(feil);
    visBackupStatus("Backup feilet: " + feil.message, true);
    alert("Feil ved backup: " + feil.message);
  }
}

function importerBackup(event) {
  valgtRestoreFil = event?.target?.files?.[0] || null;
  if (valgtRestoreFil) {
    visBackupStatus("Valgt backupfil: " + valgtRestoreFil.name + ". Trykk Start restore.");
  }
}

function rensRadForRestore(tabell, rad, aktivFirmaId) {
  const ny = { ...rad };

  if (tabell === "hov_firma") {
    // Backup kan ha gammel numeric id. Dagens hov_firma bruker uuid.
    if (ny.id && !String(ny.id).includes("-")) delete ny.id;
    delete ny.org_nr;
    delete ny.system_type;
  }

  if (["kunder", "hester", "hov_jobber", "hov_fakturaer", "hov_kreditnotaer"].includes(tabell)) {
    ny.firma_id = aktivFirmaId;
  }

  return ny;
}

async function startRestoreFraValgtFil() {
  try {
    const input = document.getElementById("importFil");
    const fil = valgtRestoreFil || input?.files?.[0];

    if (!fil) {
      alert("Velg backupfil først.");
      return;
    }

    visBackupStatus("Leser backupfil...");
    const tekst = await fil.text();
    const backupData = JSON.parse(tekst);

    if (!backupData.tabeller) {
      alert("Dette ser ikke ut som en gyldig backupfil.");
      return;
    }

    const aktivFirmaId = await hentAktivFirmaId();

    const bekreft = confirm(
      "Restore vil legge tilbake data fra backupfilen.\n\n" +
      "Data kobles til aktivt firma:\n" + aktivFirmaId + "\n\n" +
      "Rader med samme ID blir oppdatert, nye rader blir lagt til.\n\n" +
      "Systemet lager nødbackup først.\n\n" +
      "Vil du fortsette?"
    );

    if (!bekreft) return;

    visBackupStatus("Lager nødbackup før restore...");
    const nodbackup = await hentBackupData();
    await lagreBackupFil(nodbackup, "NODBACKUP_hovslager_for_restore");

    for (const backupNavn of HOV_RESTORE_REKKEFOLGE) {
      const pakke = backupData.tabeller[backupNavn];
      const tabell = HOV_BACKUP_TABELL_MAP[backupNavn] || backupNavn;

      if (!pakke || !Array.isArray(pakke.rader) || pakke.rader.length === 0) continue;

      visBackupStatus("Restorer " + tabell + " (" + pakke.rader.length + " rader)...");

      const rader = pakke.rader.map(rad => rensRadForRestore(tabell, rad, aktivFirmaId));
      const batchSize = 100;
      for (let i = 0; i < rader.length; i += batchSize) {
        const batch = rader.slice(i, i + batchSize);
        const { error } = await supabaseClient.from(tabell).upsert(batch, { onConflict: "id" });
        if (error) throw new Error("Feil ved restore av " + tabell + ": " + error.message);
      }
    }

    visBackupStatus("Restore ferdig. Laster siden på nytt...");
    alert("Restore er ferdig.");
    if (input) input.value = "";
    valgtRestoreFil = null;
    location.reload();
  } catch (feil) {
    console.error(feil);
    visBackupStatus("Restore feilet: " + feil.message, true);
    alert("Feil ved restore: " + feil.message);
  }
}

function bindBackupRestoreKnapper() {
  const backupKnapp = document.getElementById("backupKnapp");
  if (backupKnapp && !backupKnapp.dataset.hovBackupBundet) {
    backupKnapp.dataset.hovBackupBundet = "1";
    backupKnapp.addEventListener("click", backup);
  }

  const importFil = document.getElementById("importFil");
  if (importFil && !importFil.dataset.hovRestoreFilBundet) {
    importFil.dataset.hovRestoreFilBundet = "1";
    importFil.addEventListener("change", importerBackup);
  }

  let startKnapp = document.getElementById("startRestoreKnapp");
  if (!startKnapp) {
    const seksjon = importFil?.closest("section") || document.getElementById("backupMelding")?.parentElement;
    if (seksjon) {
      startKnapp = document.createElement("button");
      startKnapp.id = "startRestoreKnapp";
      startKnapp.type = "button";
      startKnapp.textContent = "Start restore";
      if (importFil) importFil.insertAdjacentElement("afterend", startKnapp);
      else seksjon.appendChild(startKnapp);
    }
  }

  if (startKnapp && !startKnapp.dataset.hovRestoreBundet) {
    startKnapp.dataset.hovRestoreBundet = "1";
    startKnapp.addEventListener("click", startRestoreFraValgtFil);
  }
}

window.backup = backup;
window.importerBackup = importerBackup;
window.startRestoreFraValgtFil = startRestoreFraValgtFil;
window.hentBackupData = hentBackupData;
window.bindBackupRestoreKnapper = bindBackupRestoreKnapper;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindBackupRestoreKnapper);
} else {
  bindBackupRestoreKnapper();
}
setTimeout(bindBackupRestoreKnapper, 500);
setTimeout(bindBackupRestoreKnapper, 1500);
