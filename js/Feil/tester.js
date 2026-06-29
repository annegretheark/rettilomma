console.log("tester.js er lastet");

function testLogg(tekst, ok = false) {
  const felt = document.getElementById("testMelding");
  if (!felt) return;

  const linje = document.createElement("div");
  linje.className = ok ? "ok" : "feil";
  linje.textContent =
    "[" + new Date().toLocaleTimeString("no-NO") + "] " + tekst;

  felt.appendChild(linje);
  felt.scrollTop = felt.scrollHeight;

  console.log(tekst);
}

function nullstillTestLogg() {
  const felt = document.getElementById("testMelding");
  if (felt) felt.innerHTML = "";
}

function testTall(v) {
  const n = Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function kjorHelsetest() {
  nullstillTestLogg();

  testLogg("Starter helsetest...", true);

  const tabeller = [
    "firma",
    "ansatte",
    "kunder",
    "timer",
    "trekk_typer",
    "ansatt_trekk",
    "fakturaer"
  ];

  for (const tabell of tabeller) {
    const { error } = await supabaseClient
      .from(tabell)
      .select("*")
      .limit(1);

    if (error) {
      testLogg("FEIL " + tabell + ": " + error.message);
      return;
    }

    testLogg("OK " + tabell, true);
  }

  testLogg("HELSETEST OK.", true);
}

async function kjorStresstest() {
  nullstillTestLogg();

  if (!confirm("Kjøre stresstest? Dette lager kun TEST-data.")) return;

  try {
    const runId = Date.now();

    testLogg("Starter stresstest...", true);

    const kundeRes = await supabaseClient
      .from("kunder")
      .insert([
        {
          kundenr: "T" + runId + "A",
          navn: "TEST Kunde A " + runId,
          adresse: "Testveien 1",
          epost: "kundea" + runId + "@test.no"
        },
        {
          kundenr: "T" + runId + "B",
          navn: "TEST Kunde B " + runId,
          adresse: "Testveien 2",
          epost: "kundeb" + runId + "@test.no"
        }
      ])
      .select();

    if (kundeRes.error) {
      testLogg("KUNDE INSERT FEIL: " + kundeRes.error.message);
      return;
    }

    testLogg("Testkunder lagt inn.", true);

    const ansattRes = await supabaseClient
      .from("ansatte")
      .upsert(
        [
          {
            ansatt_nr: "TEST" + runId + "1",
            navn: "TEST Ansatt En " + runId,
            epost: "kurs@jobbsmartkurs.no",
            mobil: "90000011",
            timelonn: 950,
            rolle: "bruker",
            aktiv: true
          },
          {
            ansatt_nr: "TEST" + runId + "2",
            navn: "TEST Ansatt To " + runId,
            epost: "lykke@jobbsmartkurs.no",
            mobil: "90000012",
            timelonn: 875,
            rolle: "bruker",
            aktiv: true
          }
        ],
        { onConflict: "epost" }
      )
      .select();

    if (ansattRes.error) {
      testLogg("ANSATT INSERT FEIL: " + ansattRes.error.message);
      return;
    }

    testLogg("Testansatte lagt inn.", true);

    const kunder = kundeRes.data || [];
    const ansatte = ansattRes.data || [];
    const timerader = [];

    let teller = 1;

    for (const ansatt of ansatte) {
      for (const kunde of kunder) {
        for (let dag = 1; dag <= 5; dag++) {
          const dato = new Date();
          dato.setDate(dato.getDate() - dag);

          const timer = dag === 5 ? 10 : 7.5;
          const pris = testTall(ansatt.timelonn || 1000);

          timerader.push({
            ansatt_id: ansatt.id,
            kunde_id: kunde.id,
            kunde_nr: kunde.kundenr || "",
            kunde_navn: kunde.navn || "",
            dato: dato.toISOString().slice(0, 10),
            start: "08:00",
            slutt: dag === 5 ? "18:00" : "15:30",
            timer: timer,
            timepris: pris,
            sum_timer: timer * pris,
            sum: timer * pris,
            fakturerbar: true,
            beskrivelse: "STRESSTEST " + runId + " #" + teller
          });

          teller++;
        }
      }
    }

    const timerRes = await supabaseClient
      .from("timer")
      .insert(timerader);

    if (timerRes.error) {
      testLogg("TIMER INSERT FEIL: " + timerRes.error.message);
      return;
    }

    if (typeof lastTimer === "function") await lastTimer();
    if (typeof lastKunder === "function") await lastKunder();
    if (typeof lastAnsatte === "function") await lastAnsatte();

    testLogg("STRESSTEST FERDIG. Laget " + timerader.length + " timer.", true);

  } catch (err) {
    testLogg("STRESSTEST FEIL: " + err.message);
  }
}

async function testDobbeltregistrering() {
  nullstillTestLogg();

  try {
    testLogg("Starter dobbeltregistreringstest...", true);

    const runId = Date.now();

    const kundeRes = await supabaseClient
      .from("kunder")
      .insert({
        kundenr: "D" + runId,
        navn: "TEST DOBBELT Kunde " + runId,
        adresse: "Testveien 1",
        epost: "dobbelkunde" + runId + "@test.no"
      })
      .select()
      .single();

    if (kundeRes.error) {
      testLogg("KUNDE FEIL: " + kundeRes.error.message);
      return;
    }

    const ansattRes = await supabaseClient
      .from("ansatte")
      .insert({
        ansatt_nr: "DOB" + runId,
        navn: "TEST DOBBELT Ansatt " + runId,
        epost: "dobbelansatt" + runId + "@test.no",
        mobil: "90000000",
        timelonn: 1000,
        rolle: "bruker",
        aktiv: true
      })
      .select()
      .single();

    if (ansattRes.error) {
      testLogg("ANSATT FEIL: " + ansattRes.error.message);
      return;
    }

    const rad = {
      dato: new Date().toISOString().slice(0, 10),
      kunde_id: kundeRes.data.id,
      kunde_nr: kundeRes.data.kundenr || "",
      kunde_navn: kundeRes.data.navn || "",
      ansatt_id: ansattRes.data.id,
      start: "08:00",
      slutt: "16:00",
      timer: 8,
      timepris: 1000,
      sum_timer: 8000,
      sum: 8000,
      fakturerbar: true,
      beskrivelse: "DOBBELTTEST " + runId
    };

    const first = await supabaseClient
      .from("timer")
      .insert(rad);

    if (first.error) {
      testLogg("FØRSTE TIMER FEIL: " + first.error.message);
      return;
    }

    testLogg("Første time ble lagret.", true);

    const second = await supabaseClient
      .from("timer")
      .insert(rad);

    if (second.error) {
      testLogg(
        "OK: Dobbeltregistrering ble stoppet i databasen: " +
        second.error.message,
        true
      );
    } else {
      testLogg(
        "OBS: Databasen stoppet ikke direkte insert. Appen stopper dobbeltregistrering i timer.js."
      );
    }

    if (typeof lastTimer === "function") await lastTimer();

    testLogg("Dobbeltregistreringstest ferdig.", true);

  } catch (err) {
    testLogg("DOBBELTTEST FEIL: " + err.message);
  }
}

async function testBlankLagring() {
  nullstillTestLogg();

  try {
    testLogg("Starter blank lagring-test...", true);

    const dato = document.getElementById("dato");
    const kundeValg = document.getElementById("kundeValg");
    const startTid = document.getElementById("startTid");
    const sluttTid = document.getElementById("sluttTid");

    const gammelDato = dato ? dato.value : "";
    const gammelKunde = kundeValg ? kundeValg.value : "";
    const gammelStart = startTid ? startTid.value : "";
    const gammelSlutt = sluttTid ? sluttTid.value : "";

    if (dato) dato.value = "";
    if (kundeValg) kundeValg.value = "";
    if (startTid) startTid.value = "";
    if (sluttTid) sluttTid.value = "";

    if (typeof lagreTimer === "function") {
      await lagreTimer();
    }

    const melding = document.getElementById("timerMelding")?.textContent || "";

    if (
      melding.includes("Fyll inn dato") ||
      melding.includes("Fyll inn")
    ) {
      testLogg("OK: Blank timer ble stoppet.", true);
    } else {
      testLogg("FEIL: Blank timer ga ikke forventet feilmelding.");
    }

    if (dato) dato.value = gammelDato;
    if (kundeValg) kundeValg.value = gammelKunde;
    if (startTid) startTid.value = gammelStart;
    if (sluttTid) sluttTid.value = gammelSlutt;

  } catch (err) {
    testLogg("BLANK LAGRING FEIL: " + err.message);
  }
}

async function testLonn() {
  nullstillTestLogg();

  try {
    testLogg("Starter lønnstest...", true);

    if (typeof kjorLonn !== "function") {
      testLogg("FEIL: kjorLonn finnes ikke.");
      return;
    }

    await kjorLonn();

    testLogg("OK: Lønnskjøring ble forsøkt.", true);

  } catch (err) {
    testLogg("LØNNSTEST FEIL: " + err.message);
  }
}

async function testFakturaGrunnlag() {
  nullstillTestLogg();

  try {
    testLogg("Starter fakturagrunnlag-test...", true);

    const { data, error } = await supabaseClient
      .from("timer")
      .select("timer,timepris,fakturerbar,beskrivelse,kunde_id")
      .eq("fakturerbar", true)
      .like("beskrivelse", "STRESSTEST%");

    if (error) {
      testLogg("FAKTURA SELECT FEIL: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      testLogg("Ingen fakturerbare STRESSTEST-timer funnet. Kjør stresstest først.");
      return;
    }

    const sum = data.reduce(
      (s, t) => s + testTall(t.timer) * testTall(t.timepris),
      0
    );

    testLogg("OK: Fant fakturerbare testtimer: " + data.length, true);
    testLogg("Fakturagrunnlag eks. mva: " + sum.toFixed(2) + " kr", true);

  } catch (err) {
    testLogg("FAKTURATEST FEIL: " + err.message);
  }
}

async function testMva() {
  nullstillTestLogg();

  try {
    testLogg("Starter MVA-test...", true);

    const { data, error } = await supabaseClient
      .from("timer")
      .select("timer,timepris,fakturerbar,beskrivelse")
      .eq("fakturerbar", true)
      .like("beskrivelse", "STRESSTEST%");

    if (error) {
      testLogg("MVA SELECT FEIL: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      testLogg("Ingen fakturerbare STRESSTEST-timer funnet. Kjør stresstest først.");
      return;
    }

    const eksMva = data.reduce(
      (s, t) => s + testTall(t.timer) * testTall(t.timepris),
      0
    );

    const mva = eksMva * 0.25;
    const inklMva = eksMva + mva;

    testLogg("Eks. mva: " + eksMva.toFixed(2) + " kr", true);
    testLogg("MVA 25%: " + mva.toFixed(2) + " kr", true);
    testLogg("Inkl. mva: " + inklMva.toFixed(2) + " kr", true);

  } catch (err) {
    testLogg("MVA-TEST FEIL: " + err.message);
  }
}

async function testFakturaSperre() {
  nullstillTestLogg();

  try {
    testLogg("Starter test av fakturasperre...", true);

    const { data, error } = await supabaseClient
      .from("timer")
      .select("*")
      .eq("fakturerbar", true)
      .like("beskrivelse", "STRESSTEST%")
      .limit(20);

    if (error) {
      testLogg("FAKTURA SELECT FEIL: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      testLogg("Ingen testtimer funnet. Kjør stresstest først.");
      return;
    }

    testLogg("OK: Fant " + data.length + " testtimer som kan inngå i fakturakontroll.", true);
    testLogg("Denne testen leser grunnlag. Selve sperre styres av faktura.js.", true);

  } catch (err) {
    testLogg("FAKTURASPERRE FEIL: " + err.message);
  }
}

async function testMvaSperre() {
  nullstillTestLogg();

  try {
    testLogg("Starter test av MVA-sperre...", true);

    const { data, error } = await supabaseClient
      .from("timer")
      .select("*")
      .like("beskrivelse", "STRESSTEST%")
      .limit(20);

    if (error) {
      testLogg("MVA SELECT FEIL: " + error.message);
      return;
    }

    testLogg("OK: MVA-sperretest kan lese testtimer: " + (data || []).length, true);
    testLogg("Selve MVA-sperre må ligge i faktura/Excel-logikken.", true);

  } catch (err) {
    testLogg("MVA-SPERRE FEIL: " + err.message);
  }
}

async function testRettigheter() {
  nullstillTestLogg();

  try {
    testLogg("Starter rettighetstest...", true);

    const svar = await supabaseClient.auth.getUser();

    if (svar.error) {
      testLogg("AUTH FEIL: " + svar.error.message);
      return;
    }

    const bruker =
      svar.data && svar.data.user
        ? svar.data.user
        : null;

    if (!bruker) {
      testLogg("FEIL: Ingen innlogget bruker.");
      return;
    }

    testLogg("Innlogget bruker: " + bruker.email, true);
    testLogg("erAdmin = " + Boolean(erAdmin), true);

    if (erAdmin) {
      testLogg("OK: Admin har tilgang til testpanel, ansatte og firma.", true);
    } else {
      testLogg("OK: Ikke-admin skal ikke se adminpanel.", true);
    }

  } catch (err) {
    testLogg("RETTIGHETSTEST FEIL: " + err.message);
  }
}

async function slettKunTestdata() {
  nullstillTestLogg();

  if (!confirm("Slette kun testdata? Dette sletter IKKE firma.")) {
    return;
  }

  try {
    testLogg("Sletter testdata...", true);

    const { data: testKunder, error: kundeFinnFeil } = await supabaseClient
      .from("kunder")
      .select("id")
      .or("navn.like.TEST%,kundenr.like.TEST%,kundenr.like.T%,kundenr.like.D%");

    if (kundeFinnFeil) throw kundeFinnFeil;

    const kundeIder = (testKunder || []).map(k => k.id);

    if (kundeIder.length > 0) {
      let res;

      res = await supabaseClient
        .from("faktura_utlegg")
        .delete()
        .in("kunde_id", kundeIder);

      if (res.error) {
        testLogg("OBS: Kunne ikke slette test-utlegg: " + res.error.message);
      } else {
        testLogg("Slettet test-utlegg.", true);
      }

      res = await supabaseClient
        .from("faktura_varer")
        .delete()
        .in("kunde_id", kundeIder);

      if (res.error) {
        testLogg("OBS: Kunne ikke slette test-fakturavarer: " + res.error.message);
      } else {
        testLogg("Slettet test-fakturavarer.", true);
      }

      res = await supabaseClient
        .from("fakturaer")
        .delete()
        .in("kunden_id", kundeIder);

      if (res.error) {
        testLogg("OBS: Kunne ikke slette testfakturaer på kunde: " + res.error.message);
      } else {
        testLogg("Slettet testfakturaer på testkunder.", true);
      }

      res = await supabaseClient
        .from("timer")
        .delete()
        .in("kunde_id", kundeIder);

      if (res.error) throw res.error;

      testLogg("Slettet timer knyttet til testkunder.", true);

      // Prosjekter må slettes før kunder på grunn av foreign key.
      res = await supabaseClient
        .from("prosjekter")
        .delete()
        .in("kunde_id", kundeIder);

      if (res.error) throw res.error;

      testLogg("Slettet prosjekter knyttet til testkunder.", true);
    }

    let res = await supabaseClient
      .from("timer")
      .delete()
      .or("beskrivelse.like.STRESSTEST%,beskrivelse.like.DOBBELTTEST%,beskrivelse.like.STRESSTEST FAKTURA%");

    if (res.error) throw res.error;

    testLogg("Slettet testtimer.", true);

    res = await supabaseClient
      .from("fakturaer")
      .delete()
      .like("fakturanr", "TEST-%");

    if (res.error) {
      testLogg("OBS: Kunne ikke slette testfakturaer: " + res.error.message);
    } else {
      testLogg("Slettet testfakturaer.", true);
    }

    if (kundeIder.length > 0) {
      res = await supabaseClient
        .from("kunder")
        .delete()
        .in("id", kundeIder);

      if (res.error) throw res.error;

      testLogg("Slettet testkunder.", true);
    } else {
      testLogg("Fant ingen testkunder å slette.", true);
    }

    // Testansatte beholdes.
    // Nye stresstester bruker eksisterende ansatte.

    if (typeof lastTimer === "function") await lastTimer();
    if (typeof lastKunder === "function") await lastKunder();
    if (typeof lastAnsatte === "function") await lastAnsatte();

    testLogg("Kun testdata slettet. Firma er beholdt.", true);

  } catch (err) {
    testLogg("SLETTING FEIL: " + err.message);
  }
}

async function lagStresstestFakturaData() {
  nullstillTestLogg();
  testLogg("Starter faktura-stresstest...", true);

  try {
    const runId = Date.now();
    const kunder = [];

    for (let i = 1; i <= 50; i++) {
      kunder.push({
        kundenr: "TEST-" + runId + "-" + String(i).padStart(3, "0"),
        navn: "TEST Fakturakunde " + i,
        adresse: "Testveien " + i + ", 3500 Hønefoss",
        epost: "testkunde" + runId + "_" + i + "@test.no",
        telefon: "99999999"
      });
    }

    const { data: nyeKunder, error: kundeFeil } = await supabaseClient
      .from("kunder")
      .insert(kunder)
      .select();

    if (kundeFeil) {
      testLogg("Feil ved kunder: " + kundeFeil.message);
      return;
    }

    testLogg("Laget " + nyeKunder.length + " testkunder.", true);

    const { data: ansatte, error: ansattFeil } = await supabaseClient
      .from("ansatte")
      .select("*");

    if (ansattFeil) {
      testLogg("Feil ved ansatte: " + ansattFeil.message);
      return;
    }

    if (!ansatte || ansatte.length === 0) {
      testLogg("Ingen ansatte funnet. Må ha minst én ansatt før testen kan lage timer.");
      return;
    }

    testLogg("Fant " + ansatte.length + " ansatte.", true);

    const timer = [];

    ansatte.forEach(ansatt => {
      for (let i = 0; i < 50; i++) {
        const kunde = nyeKunder[0];
        const ansattIndex = ansatte.indexOf(ansatt);
        const testDato = new Date(2026, 4, 1);
        testDato.setDate(testDato.getDate() + i + ansattIndex * 60);
        timer.push({
          ansatt_id: ansatt.id,
          kunde_id: kunde.id,
          kunde_nr: kunde.kundenr || "",
          kunde_navn: kunde.navn || "",
          dato: testDato.toISOString().slice(0, 10),
          start_tid: "08:00",
          slutt_tid: "16:00",
          pause_minutter: 0,
          timer: 7.5,
          timepris: 1100,
          sum_timer: 8250,
          sum: 8250,
          fakturerbar: true,
          beskrivelse: "STRESSTEST FAKTURA " + runId
        });
      }
    });

    const { error: timerFeil } = await supabaseClient
      .from("timer")
      .insert(timer);

    if (timerFeil) {
      testLogg("Feil ved timer: " + timerFeil.message);
      return;
    }

    testLogg("Laget " + timer.length + " fakturatimer.", true);

    if (typeof lastTimer === "function") await lastTimer();
    if (typeof lastKunder === "function") await lastKunder();

    testLogg(
      "FAKTURA-STRESSTEST FERDIG. Laget " +
      nyeKunder.length +
      " kunder og " +
      timer.length +
      " timer.",
      true
    );

  } catch (err) {
    testLogg("FAKTURA-STRESSTEST FEIL: " + err.message);
  }
}
async function testFakturaProsjektGruppering() {
  const melding = document.getElementById("testMelding");

  function skriv(tekst) {
    if (melding) {
      melding.innerHTML += tekst + "<br>";
    }
  }

  if (melding) {
    melding.innerHTML = "";
  }

  skriv("Starter test av fakturagruppering per kunde/prosjekt...");

  const timer = window.timer || [];
  const kunder = window.kunder || [];
  const prosjekter = window.prosjekter || [];

  if (!timer.length) {
    skriv("FEIL: Ingen timer lastet.");
    return;
  }

  const fakturerbareTimer =
    timer.filter(t => !t.fakturert && t.fakturerbar !== false);

  if (!fakturerbareTimer.length) {
    skriv("FEIL: Ingen fakturerbare timer funnet.");
    return;
  }

  const grupper = {};

  fakturerbareTimer.forEach(t => {
    const kundeId = t.kunde_id || "UTEN_KUNDE";
    const prosjektId = t.prosjekt_id || "UTEN_PROSJEKT";
    const key = kundeId + "_" + prosjektId;

    if (!grupper[key]) {
      grupper[key] = [];
    }

    grupper[key].push(t);
  });

  Object.keys(grupper).forEach(key => {
    const gruppe = grupper[key];
    const første = gruppe[0];

    const kunde =
      kunder.find(k => String(k.id) === String(første.kunde_id));

    const prosjekt =
      prosjekter.find(p => String(p.id) === String(første.prosjekt_id));

    skriv(
      "Gruppe: " +
      "Kunde: " + (kunde?.navn || første.kunde_id || "mangler") +
      " | Prosjekt: " + (prosjekt?.navn || første.prosjekt_id || "uten prosjekt") +
      " | Timer: " + gruppe.length
    );
  });

  skriv("Test ferdig. Antall fakturagrupper: " + Object.keys(grupper).length);
}

window.testFakturaProsjektGruppering = testFakturaProsjektGruppering;

window.lagStresstestFakturaData = lagStresstestFakturaData;

window.kjorHelsetest = kjorHelsetest;
window.kjorStresstest = kjorStresstest;
window.testDobbeltregistrering = testDobbeltregistrering;
window.testBlankLagring = testBlankLagring;
window.testLonn = testLonn;
window.testFakturaGrunnlag = testFakturaGrunnlag;
window.testMva = testMva;
window.testFakturaSperre = testFakturaSperre;
window.testMvaSperre = testMvaSperre;
window.testRettigheter = testRettigheter;
window.slettKunTestdata = slettKunTestdata;