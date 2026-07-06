const BACKUP_VERSJON = "2.0";

const TABELLER = [
  "hand_firma",
  "hand_ansatt",
  "hand_kunde",
  "hand_vare",
  "hand_bil",
  "hand_bil_vare",
  "hand_lager_bevegelse",
  "hand_prosjekt",
  "hand_time",
  "hand_trekk_type",
  "hand_ansatt_trekk",
  "hand_faktura",
  "hand_faktura_vare",
  "hand_faktura_utlegg"
];

async function hentBackupData() {

  const data = {
    dato: new Date().toISOString(),
    versjon: BACKUP_VERSJON,
    system: "Timeregistrering",
    tabeller: {}
  };

  for (const tabell of TABELLER) {

    try {

      const { data: rader, error } =
        await supabaseClient
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

async function lagreBackupFil(
  data,
  prefix = "backup_timeregistrering"
) {

  const tekst =
    JSON.stringify(data, null, 2);

  const dato =
    new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

  const filnavn =
    `${prefix}_${dato}.json`;

  const blob =
    new Blob(
      [tekst],
      { type: "application/json" }
    );

  if (window.showSaveFilePicker && prefix !== "NODBACKUP_for_restore") {

    const fil =
      await window.showSaveFilePicker({

        suggestedName: filnavn,

        types: [
          {
            description: "JSON backup",

            accept: {
              "application/json": [".json"]
            }
          }
        ]
      });

    const stream =
      await fil.createWritable();

    await stream.write(blob);
    await stream.close();

    return;
  }

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;
  a.download = filnavn;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

async function backup() {

  try {

    visBackupStatus(
      "Starter backup..."
    );

    const data =
      await hentBackupData();

    await lagreBackupFil(
      data,
      "backup_timeregistrering"
    );

    visBackupStatus(
      "Backup lagret."
    );

    alert(
      "Backup er lagret."
    );

  } catch (feil) {

    console.error(feil);

    visBackupStatus(
      "Backup feilet."
    );

    alert(
      "Feil ved backup: " +
      feil.message
    );
  }
}

async function importerBackup(event) {

  try {

    const fil =
      event.target.files[0];

    if (!fil) {

      alert(
        "Ingen fil valgt."
      );

      return;
    }

    visBackupStatus(
      "Leser backupfil..."
    );

    const tekst =
      await fil.text();

    const backupData =
      JSON.parse(tekst);

    if (!backupData.tabeller) {

      alert(
        "Dette ser ikke ut som en gyldig backupfil."
      );

      return;
    }

    const bekreft =
      confirm(

        "Restore vil:\n\n" +

        "- overskrive rader med samme ID\n" +
        "- legge til nye rader\n\n" +

        "Systemet lager nødbackup først.\n\n" +

        "Vil du fortsette?"

      );

    if (!bekreft) {

      event.target.value = "";

      return;
    }

    visBackupStatus(
      "Lager nødbackup..."
    );

    const nodbackup =
      await hentBackupData();

    await lagreBackupFil(
      nodbackup,
      "NODBACKUP_for_restore"
    );

    const rekkefolge = [
      "hand_firma",
      "hand_ansatt",
      "hand_kunde",
      "hand_vare",
      "hand_bil",
      "hand_bil_vare",
      "hand_lager_bevegelse",
      "hand_prosjekt",
      "hand_time",
      "hand_trekk_type",
      "hand_ansatt_trekk",
      "hand_faktura",
      "hand_faktura_vare",
      "hand_faktura_utlegg"
    ];

    for (const tabell of rekkefolge) {

      const pakke =
        backupData.tabeller[tabell];

      if (
        !pakke ||
        !Array.isArray(pakke.rader) ||
        pakke.rader.length === 0
      ) {
        continue;
      }

      visBackupStatus(
        "Restorer " +
        tabell +
        "..."
      );

      const { error } =
        await supabaseClient
          .from(tabell)
          .upsert(
            pakke.rader,
            {
              onConflict: "id"
            }
          );

      if (error) {

        throw new Error(
          "Feil ved restore av " +
          tabell +
          ": " +
          error.message
        );
      }
    }

    visBackupStatus(
      "Restore ferdig."
    );

    alert(
      "Restore er ferdig."
    );

    event.target.value = "";

    location.reload();

  } catch (feil) {

    console.error(feil);

    visBackupStatus(
      "Restore feilet."
    );

    alert(
      "Feil ved restore: " +
      feil.message
    );
  }
}

function visBackupStatus(tekst) {

  const melding =
    document.getElementById("backupMelding") ||
    document.getElementById("timerMelding");

  if (melding) {
    melding.textContent = tekst;
  }
}

window.backup = backup;
window.importerBackup = importerBackup;
