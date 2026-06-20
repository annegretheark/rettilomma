/* Rett i Lomma - jobbliste for admin/bruker 7068
   Vanlig bruker ser egne jobber. Admin ser alle.
   Klikk på en jobb i listen for å få den opp som detaljvisning.
*/
(function () {
  let sisteJobber = [];
  let prosjektMap = new Map();
  let ansattMap = new Map();


  function hent(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v ?? "").replace(/[&<>'"]/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c];
    });
  }

  function datoNo(v) {
    if (!v) return "";
    const s = String(v).slice(0, 10);
    const d = s.split("-");
    return d.length === 3 ? d[2] + "." + d[1] + "." + d[0] : String(v);
  }

  function erAdminModus() {
    return window.erAdmin === true && localStorage.getItem("rilAdminModus") === "ja";
  }

  function hentInnloggetAnsattId() {
    return window.innloggetAnsattId ||
      localStorage.getItem("innloggetAnsattId") ||
      localStorage.getItem("ansattId") ||
      "";
  }

  function erUuid(verdi) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(verdi || "").trim());
  }

  function utenUuid(verdi) {
    const s = String(verdi ?? "").trim();
    return erUuid(s) ? "" : s;
  }

  function prosjektFraMap(rad) {
    const id = String(rad.prosjekt_id || rad.prosjektId || "").trim();
    if (!id) return null;
    return prosjektMap.get(id) || null;
  }

  function ansattFraMap(rad) {
    const id = String(rad.ansatt_id || rad.ansattId || rad.bruker_id || rad.user_id || "").trim();
    if (!id) return null;
    return ansattMap.get(id) || null;
  }

  function visningProsjekt(rad) {
    const p = prosjektFraMap(rad) || rad.prosjekter || {};
    const nr =
      p.prosjektnr || p.prosjekt_nr || p.prosjektNr || p.nr || p.nummer ||
      rad.prosjektnr || rad.prosjekt_nr || rad.prosjektNr || rad.prosjekt_nummer || "";
    if (nr) return String(nr);

    const navn = p.navn || p.prosjektnavn || rad.prosjekt_navn || rad.prosjektnavn || rad.prosjekt || "";
    return utenUuid(navn);
  }

  function visningAnsatt(rad) {
    const a = ansattFraMap(rad) || rad.ansatte || {};
    const navn = a.navn || a.fullt_navn || a.full_name || rad.ansatt_navn || rad.ansattnavn || rad.ansatt || "";
    if (navn) return String(navn);

    const epost = a.epost || a.email || rad.epost || rad.ansatt_epost || rad.bruker_epost || "";
    if (epost) return String(epost);

    return utenUuid(rad.ansatt_id || rad.ansattId || rad.bruker_id || rad.user_id || "");
  }

  function pentBeskrivelse(verdi) {
    return String(verdi || "")
      .replaceAll("kjoring", "kjøring")
      .replaceAll("Kjoring", "Kjøring")
      .replaceAll("belop", "beløp")
      .replaceAll("Belop", "Beløp");
  }

  function erNullUtleggRad(rad) {
    const sum = Number(rad.sum ?? rad.belop ?? rad.total ?? 0);
    const tekst = String(rad.beskrivelse || rad.notat || rad.arbeid || "").toLowerCase();
    return sum === 0 && (tekst.includes("utlegg/refusjon") || tekst.includes("utlegg"));
  }

  async function berikJobberMedNavn(rader) {
    prosjektMap = new Map();
    ansattMap = new Map();

    if (!window.supabaseClient || !Array.isArray(rader) || !rader.length) return rader || [];

    const prosjektIds = [...new Set(rader.map(r => r.prosjekt_id || r.prosjektId).filter(Boolean).map(String))];
    const ansattIds = [...new Set(rader.map(r => r.ansatt_id || r.ansattId || r.bruker_id || r.user_id).filter(Boolean).map(String))];

    if (prosjektIds.length) {
      try {
        const { data, error } = await supabaseClient
          .from("hand_prosjekt")
          .select("*")
          .in("id", prosjektIds);
        if (!error) prosjektMap = new Map((data || []).map(p => [String(p.id), p]));
      } catch (e) {
        console.warn("Kunne ikke hente prosjektnummer:", e);
      }
    }

    if (ansattIds.length) {
      try {
        const { data, error } = await supabaseClient
          .from("hand_ansatt")
          .select("*")
          .in("id", ansattIds);
        if (!error) ansattMap = new Map((data || []).map(a => [String(a.id), a]));
      } catch (e) {
        console.warn("Kunne ikke hente ansattnavn:", e);
      }
    }

    return rader;
  }

  function finnTimerTabell() {
    return window.RIL_TIMER_TABELL || "hand_time";
  }

  function filtrerEgneJobber(rader) {
    if (erAdminModus()) return rader;

    const ansattId = hentInnloggetAnsattId();
    const epost = String(window.innloggetEpost || localStorage.getItem("innloggetEpost") || "").toLowerCase();

    return (rader || []).filter(function (r) {
      if (ansattId && String(r.ansatt_id || r.ansattId || r.bruker_id || r.user_id || "") === String(ansattId)) return true;
      if (epost && String(r.epost || r.ansatt_epost || r.bruker_epost || "").toLowerCase() === epost) return true;
      return false;
    });
  }

  function jobbBelop(rad) {
    const mulige = ["belop", "sum", "total", "inkl_mva", "pris", "linjesum"];
    for (const f of mulige) {
      if (rad[f] !== undefined && rad[f] !== null && rad[f] !== "") {
        const n = Number(rad[f]);
        return Number.isFinite(n) ? n.toLocaleString("no-NO") + " kr" : String(rad[f]);
      }
    }
    return "";
  }

  function hentKunde(rad) {
    return rad.kunde_navn || rad.kundenavn || rad.kunde || rad.kunder?.navn || rad.kunde_id || "";
  }

  function hentProsjekt(rad) {
    return visningProsjekt(rad);
  }

  function hentAnsatt(rad) {
    return visningAnsatt(rad);
  }

  function jobbStatus(rad) {
    return rad.fakturert || rad.faktura_id || rad.fakturanr ? "Fakturert" : "Ikke fakturert";
  }

  function sikreDetaljBoks() {
    let detalj = hent("jobbDetalj");
    const liste = hent("jobberListe");
    if (!detalj && liste && liste.parentNode) {
      detalj = document.createElement("div");
      detalj.id = "jobbDetalj";
      detalj.style.marginTop = "12px";
      liste.parentNode.insertBefore(detalj, liste);
    }
    return detalj;
  }

  function felt(label, verdi) {
    if (verdi === undefined || verdi === null || verdi === "") return "";
    return "<div><strong>" + esc(label) + ":</strong><br>" + esc(verdi) + "</div>";
  }



  async function lagSignertBildeUrl(filsti) {
    if (!filsti || !window.supabaseClient) return "";

    try {
      const { data, error } = await supabaseClient
        .storage
        .from("timer-bilder")
        .createSignedUrl(filsti, 60 * 60 * 24 * 7);

      if (!error && data && data.signedUrl) return data.signedUrl;
    } catch (e) {
      console.warn("Kunne ikke lage signert bilde-url:", e);
    }

    try {
      const { data } = supabaseClient
        .storage
        .from("timer-bilder")
        .getPublicUrl(filsti);

      return data && data.publicUrl ? data.publicUrl : "";
    } catch (e) {
      return "";
    }
  }

  async function hentBilderForJobb(jobbId, rad) {
    const bilder = [];

    const direkteUrl = rad && (rad.bilde_url || rad.bilde || rad.image_url || "");
    const direkteSti = rad && (rad.bilde_path || rad.filsti || "");

    if (direkteSti) {
      const url = await lagSignertBildeUrl(direkteSti);
      if (url) bilder.push({ url: url, tekst: "" });
    } else if (direkteUrl) {
      bilder.push({ url: direkteUrl, tekst: "" });
    }

    if (!window.supabaseClient || !jobbId) return bilder;

    try {
      const { data, error } = await supabaseClient
        .from("hand_time_bilde")
        .select("filsti,bilde_path,bilde_url,bildetekst")
        .eq("timer_id", jobbId);

      if (error) {
        console.warn("Kunne ikke hente timer_bilder:", error);
        return bilder;
      }

      for (const b of (data || [])) {
        const sti = b.filsti || b.bilde_path || "";
        let url = "";

        if (sti) url = await lagSignertBildeUrl(sti);
        if (!url && b.bilde_url) url = b.bilde_url;

        if (url && !bilder.some(x => x.url === url)) {
          bilder.push({ url: url, tekst: b.bildetekst || "" });
        }
      }
    } catch (e) {
      console.warn("Hoppet over henting av bilder:", e);
    }

    return bilder;
  }

  async function oppdaterJobbBilder(jobbId, rad) {
    const boks = hent("jobbDetaljBilder");
    if (!boks) return;

    boks.innerHTML = "Laster bilder...";
    const bilder = await hentBilderForJobb(jobbId, rad);

    if (!bilder.length) {
      boks.innerHTML = '<div style="opacity:0.8;">Ingen bilder på denne jobben ennå.</div>';
      return;
    }

    boks.innerHTML = bilder.map(function (b) {
      return '<a href="' + esc(b.url) + '" target="_blank" style="display:inline-block; margin:0 10px 10px 0; color:inherit; text-decoration:none;">' +
        '<img src="' + esc(b.url) + '" style="width:150px; height:115px; object-fit:cover; border-radius:10px; border:1px solid #374151; display:block;">' +
        '<small>' + esc(b.tekst || "Åpne bilde") + '</small>' +
      '</a>';
    }).join("");
  }

  async function lastOppBildePaJobb(jobbId, rad) {
    const filInput = hent("jobbBildeFil");
    const tekstInput = hent("jobbBildeTekst");
    const melding = hent("jobbBildeMelding");
    const knapp = hent("lagreJobbBildeKnapp");

    if (melding) melding.textContent = "";

    const fil = filInput && filInput.files ? filInput.files[0] : null;
    if (!fil) {
      if (melding) melding.textContent = "Velg et bilde først.";
      return;
    }

    if (!window.supabaseClient) {
      if (melding) melding.textContent = "Supabase er ikke lastet.";
      return;
    }

    const rentFilnavn = String(fil.name || "bilde.jpg")
      .replaceAll(" ", "_")
      .replace(/[æøåÆØÅ]/g, function (bokstav) {
        return { æ: "ae", ø: "o", å: "a", Æ: "Ae", Ø: "O", Å: "A" }[bokstav] || bokstav;
      })
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const filsti = String(jobbId) + "/" + Date.now() + "_" + rentFilnavn;

    try {
      if (knapp) knapp.disabled = true;
      if (melding) melding.textContent = "Lagrer bilde...";

      const { error: uploadError } = await supabaseClient
        .storage
        .from("timer-bilder")
        .upload(filsti, fil, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const bildeUrl = await lagSignertBildeUrl(filsti);

      const { error: dbError } = await supabaseClient
        .from("hand_time_bilde")
        .insert({
          timer_id: jobbId,
          filnavn: fil.name,
          filsti: filsti,
          bilde_path: filsti,
          bilde_url: bildeUrl || null,
          bildetekst: tekstInput ? tekstInput.value || "" : ""
        });

      if (dbError) throw dbError;

      if (filInput) filInput.value = "";
      if (tekstInput) tekstInput.value = "";
      if (melding) melding.textContent = "Bilde er lagret på jobben.";

      await oppdaterJobbBilder(jobbId, rad);
    } catch (e) {
      console.error("Feil ved lagring av bilde på jobb:", e);
      if (melding) melding.textContent = "Bildet ble ikke lagret: " + (e.message || JSON.stringify(e));
    } finally {
      if (knapp) knapp.disabled = false;
    }
  }



  function jobbKundeId(rad) {
    return rad.kunde_id || rad.kundeId || rad.kunder?.id || null;
  }

  function jobbProsjektId(rad) {
    return rad.prosjekt_id || rad.prosjektId || null;
  }

  function jobbDato(rad) {
    return String(rad.dato || rad.created_at || new Date().toISOString()).slice(0, 10);
  }

  function jobbMelding(tekst, feil) {
    const el = hent("jobbEkstraMelding");
    if (!el) return;
    el.textContent = tekst || "";
    el.style.color = feil ? "#fca5a5" : "#86efac";
  }

  function tallFraJobbFelt(id, standard = 0) {
    const el = hent(id);
    if (!el) return standard;
    const tekst = String(el.value ?? "").replace(",", ".").trim();
    if (tekst === "") return standard;
    const n = Number(tekst);
    return Number.isFinite(n) ? n : standard;
  }

  async function fyllJobbVarevalg(rad) {
    const select = hent("jobbVareValg");
    const prisFelt = hent("jobbVarePris");
    if (!select || !window.supabaseClient) return;

    select.innerHTML = '<option value="">Laster varer fra aktiv bil...</option>';

    const aktivBilId = typeof window.hentAktivBilIdFraSkjerm === "function"
      ? window.hentAktivBilIdFraSkjerm()
      : (window.aktivBilId || localStorage.getItem("aktivBilId") || "");

    if (!aktivBilId) {
      select.innerHTML = '<option value="">Velg aktiv bil først</option>';
      return;
    }

    const { data: bilvarer, error: bilFeil } = await supabaseClient
      .from("hand_bil_lager")
      .select("id, vare_id, antall")
      .eq("bil_id", aktivBilId)
      .gt("antall", 0);

    if (bilFeil) {
      select.innerHTML = '<option value="">Feil ved henting av bil-lager</option>';
      jobbMelding("Kunne ikke hente bil-lager: " + bilFeil.message, true);
      return;
    }

    const vareIds = (bilvarer || []).map(x => x.vare_id).filter(Boolean);
    if (!vareIds.length) {
      select.innerHTML = '<option value="">Ingen varer på aktiv bil</option>';
      return;
    }

    const { data: varer, error: varerFeil } = await supabaseClient
      .from("hand_vare")
      .select("*")
      .in("id", vareIds);

    if (varerFeil) {
      select.innerHTML = '<option value="">Feil ved henting av varer</option>';
      jobbMelding("Kunne ikke hente varer: " + varerFeil.message, true);
      return;
    }

    const vareMap = new Map((varer || []).map(v => [String(v.id), v]));
    select.innerHTML = '<option value="">Velg vare fra aktiv bil</option>';

    (bilvarer || []).forEach(bv => {
      const v = vareMap.get(String(bv.vare_id));
      if (!v) return;
      const pris = Number(v.pris ?? v.utpris ?? v.utsalgspris ?? v.salgspris ?? 0);
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.dataset.bilLagerId = bv.id;
      opt.dataset.antallBil = String(Number(bv.antall || 0));
      opt.dataset.pris = String(pris);
      opt.dataset.navn = ((v.varenr ? v.varenr + " - " : "") + (v.navn || v.varenavn || v.beskrivelse || "Vare")).trim();
      opt.textContent = opt.dataset.navn + " | på bil: " + Number(bv.antall || 0) + " | " + pris.toFixed(2) + " kr";
      select.appendChild(opt);
    });

    select.onchange = function () {
      const opt = select.options[select.selectedIndex];
      if (prisFelt && opt && opt.dataset.pris) prisFelt.value = opt.dataset.pris;
    };
  }

  async function hentJobbVarer(jobbId, rad) {
    if (!window.supabaseClient || !jobbId) return [];
    const kundeId = jobbKundeId(rad);
    let res = null;

    try {
      res = await supabaseClient
        .from("hand_faktura_vare")
        .select("*")
        .eq("timer_id", jobbId)
        .order("id", { ascending: false });
      if (!res.error) return res.data || [];
    } catch (e) {}

    try {
      if (!kundeId) return [];
      res = await supabaseClient
        .from("hand_faktura_vare")
        .select("*")
        .eq("kunde_id", kundeId)
        .ilike("navn", "%jobb #" + jobbId + "%")
        .order("id", { ascending: false });
      if (!res.error) return res.data || [];
    } catch (e) {}

    return [];
  }

  async function oppdaterJobbVarer(jobbId, rad) {
    const el = hent("jobbVarerListe");
    if (!el) return;
    el.innerHTML = "Laster varer...";
    const varer = await hentJobbVarer(jobbId, rad);
    if (!varer.length) {
      el.innerHTML = '<div style="opacity:0.8;">Ingen varer lagt på denne jobben ennå.</div>';
      return;
    }
    el.innerHTML = '<table class="bil-tabell"><thead><tr><th>Vare</th><th>Antall</th><th>Pris</th></tr></thead><tbody>' +
      varer.map(v => '<tr><td>' + esc(String(v.navn || v.beskrivelse || "").replace("Jobb #" + jobbId + " - ", "")) + '</td><td>' + esc(v.antall || 0) + '</td><td>' + esc(v.pris || 0) + '</td></tr>').join("") +
      '</tbody></table>';
  }

  async function leggVarePaJobb(jobbId, rad) {
    const select = hent("jobbVareValg");
    const antall = Math.round(tallFraJobbFelt("jobbVareAntall", 1));
    const pris = tallFraJobbFelt("jobbVarePris", 0);
    const kundeId = jobbKundeId(rad);

    jobbMelding("");

    if (!kundeId) { jobbMelding("Fant ikke kunde på jobben.", true); return; }
    if (!select || !select.value) { jobbMelding("Velg vare først.", true); return; }
    if (!Number.isInteger(antall) || antall <= 0) { jobbMelding("Antall må være heltall større enn 0.", true); return; }

    const opt = select.options[select.selectedIndex];
    const bilLagerId = opt?.dataset?.bilLagerId || "";
    const antallBil = Number(opt?.dataset?.antallBil || 0);
    const navn = opt?.dataset?.navn || opt?.textContent || "Vare";

    if (antallBil < antall) {
      jobbMelding("Det er bare " + antallBil + " på bilen.", true);
      return;
    }

    let insertRad = {
      kunde_id: kundeId,
      navn: "Jobb #" + jobbId + " - " + navn,
      antall: antall,
      pris: pris,
      fakturert: false,
      fakturanr: null
    };

    let res = await supabaseClient.from("hand_faktura_vare").insert([{ ...insertRad, timer_id: jobbId }]);
    if (res.error && String(res.error.message || "").toLowerCase().includes("timer_id")) {
      res = await supabaseClient.from("hand_faktura_vare").insert([insertRad]);
    }

    if (res.error) {
      jobbMelding("Kunne ikke lagre vare på jobben: " + res.error.message, true);
      return;
    }

    if (bilLagerId) {
      const nyttAntall = Math.max(0, antallBil - antall);
      const trekk = await supabaseClient.from("hand_bil_lager").update({ antall: nyttAntall }).eq("id", bilLagerId);
      if (trekk.error) {
        jobbMelding("Vare ble lagt på jobb, men lager ble ikke trukket: " + trekk.error.message, true);
        return;
      }
    }

    if (hent("jobbVareAntall")) hent("jobbVareAntall").value = "1";
    if (hent("jobbVarePris")) hent("jobbVarePris").value = "0";
    jobbMelding("Vare lagt på jobben.");
    await fyllJobbVarevalg(rad);
    await oppdaterJobbVarer(jobbId, rad);
  }

  async function hentJobbUtlegg(jobbId, rad) {
    if (!window.supabaseClient || !jobbId) return [];
    const kundeId = jobbKundeId(rad);
    let res = null;

    try {
      res = await supabaseClient
        .from("hand_faktura_utlegg")
        .select("*")
        .eq("timer_id", jobbId)
        .order("id", { ascending: false });
      if (!res.error) return res.data || [];
    } catch (e) {}

    try {
      if (!kundeId) return [];
      res = await supabaseClient
        .from("hand_faktura_utlegg")
        .select("*")
        .eq("kunde_id", kundeId)
        .ilike("beskrivelse", "%jobb #" + jobbId + "%")
        .order("id", { ascending: false });
      if (!res.error) return res.data || [];
    } catch (e) {}

    return [];
  }

  async function oppdaterJobbUtlegg(jobbId, rad) {
    const el = hent("jobbUtleggListe");
    if (!el) return;
    el.innerHTML = "Laster utgifter...";
    const utlegg = await hentJobbUtlegg(jobbId, rad);
    if (!utlegg.length) {
      el.innerHTML = '<div style="opacity:0.8;">Ingen utgifter lagt på denne jobben ennå.</div>';
      return;
    }
    el.innerHTML = '<table class="bil-tabell"><thead><tr><th>Type</th><th>Beskrivelse</th><th>Beløp</th></tr></thead><tbody>' +
      utlegg.map(u => '<tr><td>' + esc(u.type || "") + '</td><td>' + esc(String(u.beskrivelse || "").replace("Jobb #" + jobbId + " - ", "")) + '</td><td>' + esc(u.belop || 0) + '</td></tr>').join("") +
      '</tbody></table>';
  }

  async function leggUtleggPaJobb(jobbId, rad) {
    const type = hent("jobbUtgiftType")?.value || "";
    let belop = tallFraJobbFelt("jobbUtgiftBelop", 0);
    const km = tallFraJobbFelt("jobbUtgiftKm", 0);
    const kmPris = tallFraJobbFelt("jobbUtgiftKmPris", 5.3);
    const kundeId = jobbKundeId(rad);

    jobbMelding("");

    if (!kundeId) { jobbMelding("Fant ikke kunde på jobben.", true); return; }
    if (!type) { jobbMelding("Velg utgiftstype.", true); return; }
    if (type === "kjoring") belop = km * kmPris;
    if (!belop || belop <= 0) { jobbMelding("Skriv beløp eller km.", true); return; }

    const beskrivelse = "Jobb #" + jobbId + " - " + (type === "kjoring" ? ("Kjøring " + km + " km x " + kmPris) : type);
    let insertRad = {
      kunde_id: kundeId,
      type: type,
      beskrivelse: beskrivelse,
      belop: belop,
      fakturert: false,
      fakturanr: null
    };

    let res = await supabaseClient.from("hand_faktura_utlegg").insert([{ ...insertRad, timer_id: jobbId }]);
    if (res.error && String(res.error.message || "").toLowerCase().includes("timer_id")) {
      res = await supabaseClient.from("hand_faktura_utlegg").insert([insertRad]);
    }

    if (res.error) {
      jobbMelding("Kunne ikke lagre utgift på jobben: " + res.error.message, true);
      return;
    }

    const ansattId = rad.ansatt_id || window.innloggetAnsattId || null;
    if (ansattId) {
      const timerUtlegg = {
        ansatt_id: ansattId,
        dato: jobbDato(rad),
        kunde_id: kundeId,
        kunde_nr: rad.kunde_nr || rad.kundeNr || null,
        kunde_navn: hentKunde(rad) || "",
        prosjekt_id: jobbProsjektId(rad),
        start: "00:00",
        slutt: "00:00",
        timer: 0,
        overtid50: 0,
        overtid100: 0,
        timepris: 0,
        sum_timer: 0,
        km: type === "kjoring" ? km : 0,
        km_pris: type === "kjoring" ? kmPris : 0,
        sum_km: type === "kjoring" ? belop : 0,
        diett: type === "diett" ? belop : 0,
        parkering: type === "parkering" ? belop : 0,
        billetter: type === "billetter" ? belop : 0,
        bompenger: type === "bompenger" ? belop : 0,
        andre_utlegg: ["kjoring", "diett", "parkering", "billetter", "bompenger"].includes(type) ? 0 : belop,
        andre_utlegg_beskrivelse: "Utlegg på jobb #" + jobbId + ": " + type,
        sum: 0,
        fakturerbar: false,
        beskrivelse: "Utlegg/refusjon på jobb #" + jobbId + ": " + type
      };
      try { await supabaseClient.from("hand_time").insert([timerUtlegg]); } catch (e) { console.warn("Utlegg ble ikke lagt i time/lønnstabell:", e); }
    }

    if (hent("jobbUtgiftType")) hent("jobbUtgiftType").value = "";
    if (hent("jobbUtgiftBelop")) hent("jobbUtgiftBelop").value = "0";
    if (hent("jobbUtgiftKm")) hent("jobbUtgiftKm").value = "0";
    jobbMelding("Utgift lagt på jobben.");
    await oppdaterJobbUtlegg(jobbId, rad);
  }

  function visJobbDetalj(rad) {
    const detalj = sikreDetaljBoks();
    if (!detalj || !rad) return;

    const id = rad.id || rad.timer_id || "";
    const html = [];

    html.push('<div class="kort" style="max-width:none; margin:0 0 14px 0; border:1px solid #374151;">');
    html.push('<div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap;">');
    html.push('<h3 style="margin:0;">Jobb ' + esc(id ? "#" + id : "") + '</h3>');
    html.push('<button type="button" class="secondary" id="lukkJobbDetaljKnapp">Lukk</button>');
    html.push('</div>');

    html.push('<div class="rad" style="margin-top:12px;">');
    html.push(felt("Dato", datoNo(rad.dato || rad.created_at)));
    html.push(felt("Kunde", hentKunde(rad)));
    html.push(felt("Prosjektnr", hentProsjekt(rad)));
    html.push(felt("Utført av", hentAnsatt(rad)));
    html.push(felt("Start", rad.start || rad.start_tid || rad.startTid));
    html.push(felt("Slutt", rad.slutt || rad.slutt_tid || rad.sluttTid));
    html.push(felt("Timer", rad.timer || rad.antall_timer || rad.timer_antall));
    html.push(felt("Timepris", rad.timepris));
    html.push(felt("Beløp", jobbBelop(rad)));
    html.push(felt("Status", jobbStatus(rad)));
    html.push('</div>');

    const beskrivelse = rad.beskrivelse || rad.notat || rad.arbeid || "";
    if (beskrivelse) {
      html.push('<h4>Beskrivelse</h4>');
      html.push('<div style="white-space:pre-wrap; background:#111827; padding:10px; border-radius:8px;">' + esc(pentBeskrivelse(beskrivelse)) + '</div>');
    }

    html.push('<h4>Bilder</h4>');
    html.push('<div id="jobbDetaljBilder" style="margin-bottom:12px;">Laster bilder...</div>');

    html.push('<h4>Varer på jobben</h4>');
    html.push('<div id="jobbVarerListe" style="margin-bottom:12px;">Laster varer...</div>');
    html.push('<div style="margin-top:10px; padding:12px; border:1px solid #374151; border-radius:10px; background:#111827;">');
    html.push('<h4 style="margin-top:0;">Legg til vare på denne jobben</h4>');
    html.push('<div class="rad">');
    html.push('<div><label for="jobbVareValg">Vare fra aktiv bil</label><select id="jobbVareValg"><option value="">Laster...</option></select></div>');
    html.push('<div><label for="jobbVareAntall">Antall</label><input id="jobbVareAntall" type="number" step="1" min="1" value="1"></div>');
    html.push('<div><label for="jobbVarePris">Pris</label><input id="jobbVarePris" type="number" step="0.01" value="0"></div>');
    html.push('</div>');
    html.push('<button type="button" id="leggJobbVareKnapp">Legg til vare</button>');
    html.push('</div>');

    html.push('<h4>Utgifter på jobben</h4>');
    html.push('<div id="jobbUtleggListe" style="margin-bottom:12px;">Laster utgifter...</div>');
    html.push('<div style="margin-top:10px; padding:12px; border:1px solid #374151; border-radius:10px; background:#111827;">');
    html.push('<h4 style="margin-top:0;">Legg til utgift på denne jobben</h4>');
    html.push('<div class="rad">');
    html.push('<div><label for="jobbUtgiftType">Utgiftstype</label><select id="jobbUtgiftType"><option value="">Velg</option><option value="kjoring">Kjøring</option><option value="bompenger">Bompenger</option><option value="parkering">Parkering</option><option value="ferge">Ferge</option><option value="diett">Diett</option><option value="billetter">Billetter</option><option value="annet">Annet</option></select></div>');
    html.push('<div><label for="jobbUtgiftBelop">Beløp</label><input id="jobbUtgiftBelop" type="number" step="0.01" value="0"></div>');
    html.push('<div><label for="jobbUtgiftKm">Km</label><input id="jobbUtgiftKm" type="number" step="0.1" value="0"></div>');
    html.push('<div><label for="jobbUtgiftKmPris">Pris pr km</label><input id="jobbUtgiftKmPris" type="number" step="0.01" value="5.30"></div>');
    html.push('</div>');
    html.push('<button type="button" id="leggJobbUtleggKnapp">Legg til utgift</button>');
    html.push('<div id="jobbEkstraMelding" style="font-weight:700; margin-top:8px;"></div>');
    html.push('</div>');

    html.push('<div style="margin-top:14px; padding:12px; border:1px solid #374151; border-radius:10px; background:#111827;">');
    html.push('<h4 style="margin-top:0;">Legg til bilde på denne jobben</h4>');
    html.push('<div style="display:grid; gap:8px; max-width:430px;">');
    html.push('<input type="file" id="jobbBildeFil" accept="image/*" style="padding:8px; border:1px solid #374151; border-radius:8px;">');
    html.push('<input type="text" id="jobbBildeTekst" placeholder="Bildetekst, valgfritt" style="padding:8px; border:1px solid #374151; border-radius:8px;">');
    html.push('<button type="button" id="lagreJobbBildeKnapp" class="secondary" style="font-weight:700;">Legg til bilde</button>');
    html.push('<div id="jobbBildeMelding" style="font-weight:700;"></div>');
    html.push('</div>');
    html.push('</div>');

    html.push('<div style="margin-top:12px; font-size:13px; opacity:0.85;">Klikk en annen jobb i listen for å åpne den.</div>');
    html.push('</div>');

    detalj.innerHTML = html.join("");

    const lukk = hent("lukkJobbDetaljKnapp");
    if (lukk) {
      lukk.onclick = function () {
        detalj.innerHTML = "";
      };
    }

    const bildeKnapp = hent("lagreJobbBildeKnapp");
    if (bildeKnapp) {
      bildeKnapp.onclick = function () {
        lastOppBildePaJobb(id, rad);
      };
    }

    const vareKnapp = hent("leggJobbVareKnapp");
    if (vareKnapp) {
      vareKnapp.onclick = function () {
        leggVarePaJobb(id, rad);
      };
    }

    const utleggKnapp = hent("leggJobbUtleggKnapp");
    if (utleggKnapp) {
      utleggKnapp.onclick = function () {
        leggUtleggPaJobb(id, rad);
      };
    }

    oppdaterJobbBilder(id, rad);
    oppdaterJobbVarer(id, rad);
    oppdaterJobbUtlegg(id, rad);
    fyllJobbVarevalg(rad);
    detalj.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindRadKlikk() {
    document.querySelectorAll("#jobberListe tr[data-jobb-index]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        const idx = Number(tr.getAttribute("data-jobb-index"));
        visJobbDetalj(sisteJobber[idx]);
      });
    });
  }

  function tegnJobber(rader) {
    const liste = hent("jobberListe");
    const melding = hent("jobberMelding");
    const forklaring = hent("jobberForklaring");

    sisteJobber = rader || [];

    if (forklaring) {
      forklaring.textContent = erAdminModus()
        ? "Admin ser alle jobber. Klikk på en jobb for detaljer."
        : "Du ser bare egne jobber. Klikk på en jobb for detaljer.";
    }

    sikreDetaljBoks();

    if (!liste) return;

    if (!rader || !rader.length) {
      liste.innerHTML = "<p>Ingen jobber funnet.</p>";
      if (melding) melding.textContent = "";
      return;
    }

    const html = ['<table class="bil-tabell"><thead><tr><th>Dato</th><th>Kunde</th><th>Prosjektnr</th><th>Utført av</th><th>Beskrivelse</th><th>Beløp</th><th>Status</th></tr></thead><tbody>'];

    rader.forEach(function (r, idx) {
      html.push('<tr data-jobb-index="' + idx + '" style="cursor:pointer;">' +
        "<td>" + esc(datoNo(r.dato || r.created_at)) + "</td>" +
        "<td>" + esc(hentKunde(r)) + "</td>" +
        "<td>" + esc(hentProsjekt(r)) + "</td>" +
        "<td>" + esc(hentAnsatt(r)) + "</td>" +
        "<td>" + esc(pentBeskrivelse(r.beskrivelse || r.notat || r.arbeid || "")) + "</td>" +
        "<td>" + esc(jobbBelop(r)) + "</td>" +
        "<td>" + esc(jobbStatus(r)) + "</td>" +
      "</tr>");
    });

    html.push("</tbody></table>");
    liste.innerHTML = html.join("");
    bindRadKlikk();

    if (melding) melding.textContent = "";
  }

  async function lastJobber() {
    const melding = hent("jobberMelding");
    const liste = hent("jobberListe");

    if (melding) melding.textContent = "Laster jobber...";

    if (!window.supabaseClient) {
      if (melding) melding.textContent = "Supabase er ikke lastet.";
      return;
    }

    try {
      const tabell = finnTimerTabell();
      let query = supabaseClient.from(tabell).select("*").order("dato", { ascending: false }).limit(500);
      const ansattId = hentInnloggetAnsattId();

      if (!erAdminModus() && ansattId) {
        query = query.eq("ansatt_id", ansattId);
      }

      const { data, error } = await query;
      if (error) throw error;

      let rader = (!erAdminModus() && !ansattId) ? filtrerEgneJobber(data || []) : (data || []);
      rader = rader.filter(function (r) { return !erNullUtleggRad(r); });
      await berikJobberMedNavn(rader);
      tegnJobber(rader);
    } catch (e) {
      console.error("Feil ved lasting av jobber:", e);
      if (melding) melding.textContent = "Kunne ikke laste jobber: " + (e.message || e);
      if (liste) liste.innerHTML = "";
    }
  }

  function bindJobber() {
    const knapp = hent("oppdaterJobberKnapp");
    if (knapp && knapp.dataset.rilJobberBindet !== "1") {
      knapp.dataset.rilJobberBindet = "1";
      knapp.addEventListener("click", function () { lastJobber(); });
    }
  }

  window.lastJobber = lastJobber;
  window.tegnJobber = tegnJobber;
  window.visJobbDetalj = visJobbDetalj;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindJobber);
  else bindJobber();
})();
