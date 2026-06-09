console.log("fravaer.js er lastet");

(function () {
  const NORMAL_DAG_TIMER = 7.5;
  const MAKS_NEGATIV_FLEXI = -37.5;

  function erAvspaseringType(type) {
    return String(type || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes("avspasering");
  }

  async function hentFlexiSaldoForAnsatt(ansattId) {
    if (!ansattId || !window.supabaseClient) return 0;

    const { data, error } = await supabaseClient
      .from("timebank")
      .select("timer")
      .eq("ansatt_id", ansattId);

    if (error) {
      console.warn("Kunne ikke hente flexisaldo:", error);
      return 0;
    }

    return (data || []).reduce((sum, rad) => sum + tall(rad.timer), 0);
  }

  function formaterTimer(timer) {
    return tall(timer).toLocaleString("no-NO", { maximumFractionDigits: 2 });
  }

  async function sjekkAvspaseringSaldo(ansattId, type, fra, til, timerPrDag) {
    if (!erAvspaseringType(type)) return true;

    const dager = antallDager(fra, til);
    const timerSomBrukes = Math.abs(dager * (tall(timerPrDag) || NORMAL_DAG_TIMER));
    const saldoFor = await hentFlexiSaldoForAnsatt(ansattId);
    const saldoEtter = saldoFor - timerSomBrukes;

    if (saldoEtter < MAKS_NEGATIV_FLEXI) {
      melding(
        "Kan ikke søke/godkjenne avspasering. Flexisaldo er " +
        formaterTimer(saldoFor) + " timer. Denne avspaseringen ville gitt " +
        formaterTimer(saldoEtter) + " timer. Maks negativ saldo er " +
        formaterTimer(MAKS_NEGATIV_FLEXI) + " timer. Overskytende må trekkes i lønn eller jobbes inn først.",
        true
      );
      return false;
    }

    return true;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function tall(verdi) {
    if (verdi === null || verdi === undefined || verdi === "") return 0;
    const n = Number(String(verdi).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function datoTekst(dato) {
    return String(dato || "").slice(0, 10);
  }

  function erAdminModus() {
    return window.erAdmin === true && localStorage.getItem("rilAdminModus") === "ja";
  }

  function melding(tekst, erFeil) {
    const el = $("fravaerMelding");
    if (!el) return;
    el.textContent = tekst || "";
    el.style.color = erFeil ? "#fca5a5" : "#86efac";
  }

  function navnForAnsatt(ansattId) {
    const a = (window.ansatte || []).find(x => String(x.id) === String(ansattId));
    return a ? (a.navn || a.epost || ansattId) : (ansattId || "Ukjent ansatt");
  }

  function aktivAnsattId() {
    const valgt = $("fravaerAnsattValg")?.value || "";
    if (erAdminModus() && valgt) return valgt;
    return window.innloggetAnsattId || valgt || "";
  }

  function antallDager(fra, til) {
    if (!fra || !til) return 0;
    const start = new Date(fra + "T00:00:00");
    const slutt = new Date(til + "T00:00:00");
    if (Number.isNaN(start.getTime()) || Number.isNaN(slutt.getTime())) return 0;
    const ms = slutt.getTime() - start.getTime();
    return Math.max(1, Math.floor(ms / 86400000) + 1);
  }

  async function fyllAnsattValg() {
    const select = $("fravaerAnsattValg");
    if (!select) return;

    if ((!window.ansatte || !window.ansatte.length) && typeof window.lastAnsatte === "function") {
      await window.lastAnsatte();
    }

    const valgt = select.value;
    select.innerHTML = '<option value="">Meg selv / valgt ansatt</option>';

    (window.ansatte || []).forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.navn || a.epost || a.id;
      select.appendChild(opt);
    });

    if (valgt && Array.from(select.options).some(o => String(o.value) === String(valgt))) {
      select.value = valgt;
    }
  }

  async function lagreFravaer() {
    const ansattId = aktivAnsattId();
    const type = $("fravaerType")?.value || "";
    const fra = $("fravaerFraDato")?.value || "";
    const til = $("fravaerTilDato")?.value || fra;
    const timerPrDag = tall($("fravaerTimerPrDag")?.value || NORMAL_DAG_TIMER) || NORMAL_DAG_TIMER;
    const kommentar = $("fravaerKommentar")?.value || "";

    melding("");

    if (!ansattId) {
      melding("Fant ikke ansatt. Logg inn på nytt eller velg ansatt som admin.", true);
      return;
    }

    if (!type || !fra || !til) {
      melding("Velg type, fra dato og til dato.", true);
      return;
    }

    if (til < fra) {
      melding("Til dato kan ikke være før fra dato.", true);
      return;
    }

    const saldoOk = await sjekkAvspaseringSaldo(ansattId, type, fra, til, timerPrDag);
    if (!saldoOk) return;

    const rad = {
      ansatt_id: ansattId,
      type,
      fra_dato: fra,
      til_dato: til,
      timer_pr_dag: timerPrDag,
      kommentar,
      status: erAdminModus() ? "godkjent" : "avventer",
      opprettet_av: window.innloggetAnsattId || ansattId
    };

    const { data, error } = await supabaseClient
      .from("fravaer")
      .insert([rad])
      .select()
      .single();

    if (error) {
      melding("Kunne ikke lagre fravær: " + error.message, true);
      return;
    }

    if (rad.status === "godkjent") {
      await opprettTimebankForGodkjentFravaer(data || rad);
    }

    if ($("fravaerKommentar")) $("fravaerKommentar").value = "";
    melding(erAdminModus() ? "Fravær lagret og godkjent." : "Fravær sendt til godkjenning.");
    await lastFravaerFlexi();
  }

  async function opprettTimebankForGodkjentFravaer(fravaer) {
    if (!fravaer || !fravaer.ansatt_id) return;

    const type = String(fravaer.type || "").toLowerCase();
    if (!type.includes("avspasering")) return;

    const dager = antallDager(datoTekst(fravaer.fra_dato), datoTekst(fravaer.til_dato));
    const timerPrDag = tall(fravaer.timer_pr_dag || NORMAL_DAG_TIMER) || NORMAL_DAG_TIMER;
    const timer = -Math.abs(dager * timerPrDag);

    const finnes = await supabaseClient
      .from("timebank")
      .select("id")
      .eq("kilde_type", "fravaer")
      .eq("kilde_id", fravaer.id)
      .limit(1);

    if (!finnes.error && finnes.data && finnes.data.length) return;

    await supabaseClient.from("timebank").insert([{
      ansatt_id: fravaer.ansatt_id,
      dato: datoTekst(fravaer.fra_dato),
      timer,
      type: "avspasering_ut",
      kommentar: "Godkjent avspasering",
      kilde_type: "fravaer",
      kilde_id: fravaer.id
    }]);
  }

  async function godkjennFravaer(id) {
    const hent = await supabaseClient
      .from("fravaer")
      .select("*")
      .eq("id", id)
      .single();

    if (hent.error) {
      melding("Kunne ikke hente fravær før godkjenning: " + hent.error.message, true);
      return;
    }

    const fravaer = hent.data;
    const saldoOk = await sjekkAvspaseringSaldo(
      fravaer.ansatt_id,
      fravaer.type,
      datoTekst(fravaer.fra_dato),
      datoTekst(fravaer.til_dato),
      fravaer.timer_pr_dag || NORMAL_DAG_TIMER
    );

    if (!saldoOk) return;

    const { data, error } = await supabaseClient
      .from("fravaer")
      .update({
        status: "godkjent",
        godkjent_av: window.innloggetAnsattId || null,
        godkjent_dato: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      melding("Kunne ikke godkjenne: " + error.message, true);
      return;
    }

    await opprettTimebankForGodkjentFravaer(data);
    melding("Fravær godkjent.");
    await lastFravaerFlexi();
  }

  async function avvisFravaer(id) {
    const { error } = await supabaseClient
      .from("fravaer")
      .update({
        status: "avvist",
        godkjent_av: window.innloggetAnsattId || null,
        godkjent_dato: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      melding("Kunne ikke avvise: " + error.message, true);
      return;
    }

    melding("Fravær avvist.");
    await lastFravaerFlexi();
  }

  async function hentFravaer() {
    const ansattId = aktivAnsattId();

    let query = supabaseClient
      .from("fravaer")
      .select("*")
      .order("fra_dato", { ascending: false });

    if (!erAdminModus()) {
      query = query.eq("ansatt_id", ansattId);
    } else if (ansattId) {
      query = query.eq("ansatt_id", ansattId);
    }

    const { data, error } = await query;

    if (error) {
      melding("Kunne ikke hente fravær: " + error.message, true);
      return [];
    }

    return data || [];
  }

  async function hentTimebank() {
    const ansattId = aktivAnsattId();
    let query = supabaseClient
      .from("timebank")
      .select("*")
      .order("dato", { ascending: false });

    if (!erAdminModus()) {
      query = query.eq("ansatt_id", ansattId);
    } else if (ansattId) {
      query = query.eq("ansatt_id", ansattId);
    }

    const { data, error } = await query;

    if (error) {
      melding("Kunne ikke hente timebank: " + error.message, true);
      return [];
    }

    return data || [];
  }

  function tegnSaldo(timebank) {
    const el = $("flexiSaldo");
    if (!el) return;

    if (!timebank.length) {
      el.innerHTML = "<p>Ingen flexi/timebank registrert ennå.</p>";
      return;
    }

    const grupper = new Map();
    timebank.forEach(r => {
      const id = String(r.ansatt_id || "");
      grupper.set(id, (grupper.get(id) || 0) + tall(r.timer));
    });

    el.innerHTML = Array.from(grupper.entries()).map(([ansattId, saldo]) => `
      <div class="okonomi-boks" style="margin-bottom:8px;">
        <div><strong>${navnForAnsatt(ansattId)}</strong></div>
        <div>Saldo: <strong>${saldo.toLocaleString("no-NO", { maximumFractionDigits: 2 })} timer</strong></div>
      </div>
    `).join("");
  }

  function tegnFravaerListe(data) {
    const el = $("fravaerListe");
    if (!el) return;

    const mine = erAdminModus() ? data : data.filter(r => String(r.ansatt_id) === String(window.innloggetAnsattId || ""));

    if (!mine.length) {
      el.innerHTML = "<p>Ingen fravær registrert.</p>";
      return;
    }

    el.innerHTML = `
      <table class="okonomi-tabell">
        <thead>
          <tr>
            <th>Ansatt</th>
            <th>Type</th>
            <th>Periode</th>
            <th>Status</th>
            <th>Kommentar</th>
          </tr>
        </thead>
        <tbody>
          ${mine.map(r => `
            <tr>
              <td>${navnForAnsatt(r.ansatt_id)}</td>
              <td>${r.type || ""}</td>
              <td>${datoTekst(r.fra_dato)} - ${datoTekst(r.til_dato)}</td>
              <td>${r.status || "avventer"}</td>
              <td>${r.kommentar || ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function tegnGodkjenning(data) {
    const el = $("fravaerGodkjenning");
    if (!el) return;

    const ventende = data.filter(r => String(r.status || "avventer").toLowerCase() === "avventer");

    if (!ventende.length) {
      el.innerHTML = "<p>Ingen fravær venter på godkjenning.</p>";
      return;
    }

    el.innerHTML = `
      <table class="okonomi-tabell">
        <thead>
          <tr>
            <th>Ansatt</th>
            <th>Type</th>
            <th>Periode</th>
            <th>Timer/dag</th>
            <th>Valg</th>
          </tr>
        </thead>
        <tbody>
          ${ventende.map(r => `
            <tr>
              <td>${navnForAnsatt(r.ansatt_id)}</td>
              <td>${r.type || ""}</td>
              <td>${datoTekst(r.fra_dato)} - ${datoTekst(r.til_dato)}</td>
              <td>${r.timer_pr_dag || NORMAL_DAG_TIMER}</td>
              <td>
                <button type="button" class="okonomi-mini-knapp" onclick="window.godkjennFravaer('${r.id}')">Godkjenn</button>
                <button type="button" class="okonomi-mini-knapp danger" onclick="window.avvisFravaer('${r.id}')">Avvis</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  async function lastFravaerFlexi() {
    await fyllAnsattValg();

    const [fravaer, timebank] = await Promise.all([
      hentFravaer(),
      hentTimebank()
    ]);

    tegnSaldo(timebank);
    tegnFravaerListe(fravaer);
    if (erAdminModus()) tegnGodkjenning(fravaer);
  }

  async function registrerOvertidTilFlexiEtterTimer(timerad) {
    if (!timerad || !timerad.ansatt_id) return;

    const { data: ansattData, error } = await supabaseClient
      .from("ansatte")
      .select("id, flexi_aktiv, overtid_til_flexi, normal_arbeidsdag_timer")
      .eq("id", timerad.ansatt_id)
      .limit(1);

    if (error || !ansattData || !ansattData.length) return;

    const ansatt = ansattData[0];
    if (ansatt.flexi_aktiv === false || ansatt.overtid_til_flexi !== true) return;

    const normaleTimer = tall(ansatt.normal_arbeidsdag_timer || NORMAL_DAG_TIMER) || NORMAL_DAG_TIMER;
    const totalTimer = tall(timerad.timer || 0);
    const flexiTimer = Math.max(0, totalTimer - normaleTimer);

    if (flexiTimer <= 0) return;

    const finnes = await supabaseClient
      .from("timebank")
      .select("id")
      .eq("kilde_type", "timer")
      .eq("kilde_id", timerad.id)
      .limit(1);

    if (!finnes.error && finnes.data && finnes.data.length) return;

    await supabaseClient.from("timebank").insert([{
      ansatt_id: timerad.ansatt_id,
      dato: datoTekst(timerad.dato),
      timer: flexiTimer,
      type: "overtid_inn",
      kommentar: "Overtid fra timeregistrering til flexi",
      kilde_type: "timer",
      kilde_id: timerad.id
    }]);
  }

  function koble() {
    const lagre = $("lagreFravaerKnapp");
    if (lagre && lagre.dataset.bindet !== "1") {
      lagre.dataset.bindet = "1";
      lagre.addEventListener("click", function (e) {
        e.preventDefault();
        lagreFravaer();
      });
    }

    const oppdater = $("oppdaterFravaerKnapp");
    if (oppdater && oppdater.dataset.bindet !== "1") {
      oppdater.dataset.bindet = "1";
      oppdater.addEventListener("click", function (e) {
        e.preventDefault();
        lastFravaerFlexi();
      });
    }

    const select = $("fravaerAnsattValg");
    if (select && select.dataset.bindet !== "1") {
      select.dataset.bindet = "1";
      select.addEventListener("change", lastFravaerFlexi);
    }

    const fra = $("fravaerFraDato");
    const til = $("fravaerTilDato");
    const iDag = new Date().toISOString().slice(0, 10);
    if (fra && !fra.value) fra.value = iDag;
    if (til && !til.value) til.value = iDag;
  }

  document.addEventListener("DOMContentLoaded", function () {
    koble();
    setTimeout(koble, 300);
  });

  window.lastFravaerFlexi = lastFravaerFlexi;
  window.lagreFravaer = lagreFravaer;
  window.godkjennFravaer = godkjennFravaer;
  window.avvisFravaer = avvisFravaer;
  window.registrerOvertidTilFlexiEtterTimer = registrerOvertidTilFlexiEtterTimer;
})();
