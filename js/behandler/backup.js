console.log("hestebehandler backup.js lastet");

const HOV_BACKUP_VERSJON = "3.0";

const HOV_BACKUP_TABELLER = [
  "beh_firma",
  "beh_kunder",
  "beh_hester",
  "beh_behandlinger",
  "beh_fakturaer",
  "beh_kreditnotaer"
];

const HOV_RESTORE_REKKEFOLGE = [
  "beh_firma",
  "beh_kunder",
  "beh_hester",
  "beh_behandlinger",
  "beh_fakturaer",
  "beh_kreditnotaer"
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
}

async function hentBackupData() {
  const data = {
    dato: new Date().toISOString(),
    versjon: HOV_BACKUP_VERSJON,
    system: "RettiLomma Hestebehandler",
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

async function lagreBackupFil(data, prefix = "backup_hestebehandler") {
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

    await lagreBackupFil(data, "backup_hestebehandler");

    const feilTabeller = Object.entries(data.tabeller)
      .filter(([_, pakke]) => pakke.feil)
      .map(([navn, pakke]) => navn + ": " + pakke.feil);

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

async function importerBackup(event) {
  try {
    const fil = event.target.files[0];

    if (!fil) {
      alert("Ingen fil valgt.");
      return;
    }

    visBackupStatus("Leser backupfil...");

    const tekst = await fil.text();
    const backupData = JSON.parse(tekst);

    if (!backupData.tabeller) {
      alert("Dette ser ikke ut som en gyldig backupfil.");
      return;
    }

    const bekreft = confirm(
      "Restore vil legge tilbake data fra backupfilen.\n\n" +
      "Rader med samme ID blir oppdatert, nye rader blir lagt til.\n\n" +
      "Systemet lager nødbackup først.\n\n" +
      "Vil du fortsette?"
    );

    if (!bekreft) {
      event.target.value = "";
      return;
    }

    visBackupStatus("Lager nødbackup før restore...");
    const nodbackup = await hentBackupData();
    await lagreBackupFil(nodbackup, "NODBACKUP_hestebehandler_for_restore");

    for (const tabell of HOV_RESTORE_REKKEFOLGE) {
      const pakke = backupData.tabeller[tabell];

      if (!pakke || !Array.isArray(pakke.rader) || pakke.rader.length === 0) {
        continue;
      }

      visBackupStatus("Restorer " + tabell + "...");

      const { error } = await supabaseClient
        .from(tabell)
        .upsert(pakke.rader, { onConflict: "id" });

      if (error) {
        throw new Error("Feil ved restore av " + tabell + ": " + error.message);
      }
    }

    visBackupStatus("Restore ferdig.");
    alert("Restore er ferdig.");
    event.target.value = "";
    location.reload();
  } catch (feil) {
    console.error(feil);
    visBackupStatus("Restore feilet: " + feil.message, true);
    alert("Feil ved restore: " + feil.message);
  }
}

window.backup = backup;
window.importerBackup = importerBackup;
window.hentBackupData = hentBackupData;
