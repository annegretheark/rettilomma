function vetBackupMelding(tekst, erFeil = false) {
  const el = document.getElementById("backupMelding");
  if (!el) return;
  el.textContent = tekst || "";
  el.style.color = erFeil ? "#b42318" : "#116329";
}

function vetLastNedFil(filnavn, innhold, mime = "application/json") {
  const blob = new Blob([innhold], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function vetHentTabell(tabell) {
  const { data, error } = await supabaseClient
    .from(tabell)
    .select("*");

  if (error) {
    console.warn("Kunne ikke hente tabell", tabell, error.message);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

async function vetLagBackup() {
  vetBackupMelding("");

  const tabeller = [
    "vet_klinikker",
    "vet_klinikk_brukere",
    "vet_dyreeiere",
    "vet_dyr",
    "vet_priser",
    "vet_journal",
    "vet_journal_varer",
    "vet_journal_bilder"
  ];

  const backup = {
    type: "rett-i-lomma-veterinaer-backup",
    versjon: 1,
    laget: new Date().toISOString(),
    tabeller: {}
  };

  for (const tabell of tabeller) {
    const res = await vetHentTabell(tabell);
    backup.tabeller[tabell] = res.data;
    if (res.error) {
      backup.tabeller[tabell + "_error"] = res.error;
    }
  }

  const dato = new Date().toISOString().slice(0, 10);
  vetLastNedFil(
    `veterinaer_backup_${dato}.json`,
    JSON.stringify(backup, null, 2),
    "application/json"
  );

  vetBackupMelding("Backup laget og lastet ned.");
}

function vetLesFilSomTekst(fil) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(String(e.target.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Kunne ikke lese fil."));
    reader.readAsText(fil, "utf-8");
  });
}

function vetRensRadForRestore(tabell, rad) {
  const kopi = { ...rad };

  // created_at kan beholdes, men tomme verdier fjernes.
  Object.keys(kopi).forEach(k => {
    if (kopi[k] === "") delete kopi[k];
  });

  return kopi;
}

async function vetRestoreBackup() {
  vetBackupMelding("");

  const input = document.getElementById("vetRestoreFil");
  const fil = input?.files?.[0];

  if (!fil) {
    vetBackupMelding("Velg en backupfil først.", true);
    return;
  }

  let backup;
  try {
    backup = JSON.parse(await vetLesFilSomTekst(fil));
  } catch (e) {
    vetBackupMelding("Kunne ikke lese backupfil: " + (e.message || e), true);
    return;
  }

  if (!backup || backup.type !== "rett-i-lomma-veterinaer-backup" || !backup.tabeller) {
    vetBackupMelding("Dette ser ikke ut som en gyldig veterinær-backup.", true);
    return;
  }

  const rekkefolge = [
    "vet_klinikker",
    "vet_klinikk_brukere",
    "vet_dyreeiere",
    "vet_dyr",
    "vet_priser",
    "vet_journal",
    "vet_journal_varer",
    "vet_journal_bilder"
  ];

  let antall = 0;

  for (const tabell of rekkefolge) {
    const rader = backup.tabeller[tabell] || [];
    if (!rader.length) continue;

    const renset = rader.map(rad => vetRensRadForRestore(tabell, rad));

    const { error } = await supabaseClient
      .from(tabell)
      .upsert(renset, { onConflict: "id" });

    if (error) {
      vetBackupMelding(`Restore stoppet på ${tabell}: ${error.message}`, true);
      return;
    }

    antall += renset.length;
  }

  vetBackupMelding(`Restore ferdig. ${antall} rader lest inn.`);
  await lastVetData();
}

function vetParseCsvLinje(linje) {
  const resultat = [];
  let felt = "";
  let inneISitat = false;

  for (let i = 0; i < linje.length; i++) {
    const tegn = linje[i];
    const neste = linje[i + 1];

    if (tegn === '"' && inneISitat && neste === '"') {
      felt += '"';
      i++;
    } else if (tegn === '"') {
      inneISitat = !inneISitat;
    } else if (tegn === "," && !inneISitat) {
      resultat.push(felt.trim());
      felt = "";
    } else if (tegn === ";" && !inneISitat) {
      resultat.push(felt.trim());
      felt = "";
    } else {
      felt += tegn;
    }
  }

  resultat.push(felt.trim());
  return resultat;
}

function vetParseCsv(tekst) {
  const linjer = tekst
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (!linjer.length) return [];

  const headers = vetParseCsvLinje(linjer[0]).map(h => h.toLowerCase().trim());

  return linjer.slice(1).map(linje => {
    const verdier = vetParseCsvLinje(linje);
    const rad = {};
    headers.forEach((h, i) => {
      rad[h] = verdier[i] ?? "";
    });
    return rad;
  });
}

function vetNormaliserPrisType(type) {
  const t = String(type || "fastpris").trim().toLowerCase();

  if (["time", "timer", "timepris"].includes(t)) return "timepris";
  if (["km", "kjøring", "kjoring", "kmpris"].includes(t)) return "kmpris";
  if (["vare", "varer", "medisin", "medisiner"].includes(t)) return "vare";
  if (["annet"].includes(t)) return "annet";

  return "fastpris";
}

async function vetImporterPriserCsv() {
  console.log("Importerer veterinærpriser fra CSV");
  vetBackupMelding("");

  const input = document.getElementById("vetImportPriserFil");
  const fil = input?.files?.[0];

  if (!fil) {
    vetBackupMelding("Velg CSV-fil først.", true);
    return;
  }

  let rader;
  try {
    rader = vetParseCsv(await vetLesFilSomTekst(fil));
  } catch (e) {
    vetBackupMelding("Kunne ikke lese CSV: " + (e.message || e), true);
    return;
  }

  const importRader = rader
    .map(r => ({
      navn: String(r.navn || r.behandling || r.vare || r.varenavn || "").trim(),
      type: vetNormaliserPrisType(r.type || r.pristype),
      pris: Number(String(r.pris || r.belop || r.beløp || 0).replace(",", ".")) || 0,
      beskrivelse: String(r.beskrivelse || r.tekst || "").trim() || null,
      aktiv: true
    }))
    .filter(r => r.navn);

  if (!importRader.length) {
    vetBackupMelding("Fant ingen gyldige rader. CSV må ha minst navn og pris.", true);
    return;
  }

  const { error } = await supabaseClient
    .from("vet_priser")
    .insert(importRader);

  if (error) {
    vetBackupMelding("Feil ved import: " + error.message, true);
    return;
  }

  vetBackupMelding(`Import ferdig. ${importRader.length} behandlinger/varer lest inn.`);
  await lastPriser();
}


function vetTallFraCsv(verdi, standard = 0) {
  if (verdi === undefined || verdi === null || String(verdi).trim() === "") return standard;
  const n = Number(String(verdi).replace(" ", "").replace(",", "."));
  return Number.isFinite(n) ? n : standard;
}

async function vetImporterVarerCsv() {
  console.log("Importerer veterinærvarer fra CSV");
  vetBackupMelding("");

  const klinikkId = hentKlinikkIdForLager();
  if (!klinikkId) {
    vetBackupMelding("Velg/lagre klinikk før du importerer varer.", true);
    return;
  }

  const input = document.getElementById("vetImportVarerFil");
  const fil = input?.files?.[0];

  if (!fil) {
    vetBackupMelding("Velg CSV-fil med medisiner/varer først.", true);
    return;
  }

  let rader;
  try {
    rader = vetParseCsv(await vetLesFilSomTekst(fil));
  } catch (e) {
    vetBackupMelding("Kunne ikke lese CSV: " + (e.message || e), true);
    return;
  }

  const importRader = rader
    .map(r => ({
      navn: String(r.navn || r.vare || r.varenavn || r.medisin || "").trim(),
      kategori: String(r.kategori || r.type || "medisin").trim() || "medisin",
      enhet: String(r.enhet || "stk").trim() || "stk",
      utsalgspris: vetTallFraCsv(r.utsalgspris ?? r.pris ?? r.salgspris ?? r.belop ?? r.beløp, 0),
      minimum_antall: vetTallFraCsv(r.minimum_antall ?? r.minimum ?? r.min ?? r.varsling, 0),
      hovedlager_antall: vetTallFraCsv(r.hovedlager_antall ?? r.antall ?? r.lager ?? r.beholdning, 0)
    }))
    .filter(r => r.navn);

  if (!importRader.length) {
    vetBackupMelding("Fant ingen gyldige rader. CSV må ha minst kolonnen navn.", true);
    return;
  }

  let opprettet = 0;
  let oppdatert = 0;
  let lagerOppdatert = 0;

  try {
    await lastVetVarer();

    for (const rad of importRader) {
      const eksisterende = vetVarer.find(v =>
        String(v.klinikk_id || "") === String(klinikkId) &&
        String(v.navn || "").trim().toLowerCase() === rad.navn.toLowerCase()
      );

      const vareRad = {
        klinikk_id: klinikkId,
        navn: rad.navn,
        kategori: rad.kategori,
        enhet: rad.enhet,
        utsalgspris: rad.utsalgspris,
        minimum_antall: rad.minimum_antall,
        aktiv: true
      };

      let vareId = eksisterende?.id;

      if (vareId) {
        const { error } = await supabaseClient
          .from("vet_varer")
          .update(vareRad)
          .eq("id", vareId);
        if (error) throw error;
        oppdatert++;
      } else {
        const { data, error } = await supabaseClient
          .from("vet_varer")
          .insert(vareRad)
          .select("id")
          .single();
        if (error) throw error;
        vareId = data.id;
        opprettet++;
      }

      if (rad.hovedlager_antall > 0 && vareId) {
        await settLagerAntall("vet_lager", { klinikk_id: klinikkId, vare_id: vareId }, rad.hovedlager_antall);
        lagerOppdatert++;
      }
    }

    if (input) input.value = "";
    await lastVetLagerAlt();
    vetBackupMelding(`Vareimport ferdig. Opprettet: ${opprettet}. Oppdatert: ${oppdatert}. Hovedlager satt på ${lagerOppdatert} varer.`);
  } catch (e) {
    vetBackupMelding("Feil ved vareimport: " + (e.message || e), true);
  }
}
