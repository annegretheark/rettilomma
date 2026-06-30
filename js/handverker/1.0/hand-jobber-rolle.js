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


  function jobbNumeriskId(rad, fallbackId) {
    const kandidater = [
      rad && rad.timer_id,
      rad && rad.time_id,
      rad && rad.hand_time_id,
      rad && rad.id,
      fallbackId
    ];
    for (const v of kandidater) {
      const s = String(v ?? "").trim();
      if (/^\d+$/.test(s)) return Number(s);
    }
    return null;
  }

  function jobbMarkor(jobbId) {
    return "Jobb #" + String(jobbId);
  }

  function blankHvisNullTall(v) {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    if (Number.isFinite(n) && n === 0) return "";
    return v;
  }

  function jobbKr(v) {
    const n = Number(String(v ?? 0).replace(",", "."));
    if (!Number.isFinite(n)) return "0 kr";
    return n.toLocaleString("nb-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " kr";
  }

  function jobbTypeIkon(type) {
    const t = String(type || "").toLowerCase();
    if (t.includes("kj") || t.includes("kjo")) return "🚗";
    if (t.includes("billett")) return "🎫";
    if (t.includes("park")) return "🅿️";
    if (t.includes("bom")) return "🛣️";
    if (t.includes("diett")) return "🍽️";
    if (t.includes("ferge")) return "⛴️";
    return "📌";
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
    const a = ansattFraMap(rad) || rad.hand_ansatt || {};
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


  async function hentInnloggetHandAnsatt() {
    if (!window.supabaseClient) return null;
    const lagretId = String(window.innloggetAnsattId || localStorage.getItem("innloggetAnsattId") || localStorage.getItem("ansattId") || "").trim();
    const userId = String(window.innloggetUserId || localStorage.getItem("innloggetUserId") || localStorage.getItem("user_id") || "").trim();
    const epost = String(window.innloggetEpost || localStorage.getItem("innloggetEpost") || localStorage.getItem("epost") || "").trim().toLowerCase();

    const forsok = [];
    if (lagretId) forsok.push(["id", lagretId]);
    if (lagretId) forsok.push(["user_id", lagretId]);
    if (userId) forsok.push(["user_id", userId]);
    if (epost) forsok.push(["epost", epost]);

    for (const [felt, verdi] of forsok) {
      try {
        let q = supabaseClient.from("hand_ansatt").select("*").limit(1);
        q = felt === "epost" ? q.ilike("epost", verdi) : q.eq(felt, verdi);
        const { data, error } = await q.maybeSingle();
        if (!error && data && data.id) {
          window.innloggetAnsattId = data.id;
          window.aktivFirmaId = data.firma_id || window.aktivFirmaId;
          localStorage.setItem("innloggetAnsattId", data.id);
          if (data.firma_id) localStorage.setItem("aktivFirmaId", data.firma_id);
          if (data.epost) localStorage.setItem("innloggetEpost", data.epost);
          return data;
        }
      } catch (e) {
        console.warn("Kunne ikke slå opp hand_ansatt på " + felt + ":", e);
      }
    }
    return null;
  }

  async function hentFirmaIdForTilgang() {
    const ansatt = await hentInnloggetHandAnsatt();
    if (ansatt && ansatt.firma_id) return ansatt.firma_id;

    if (typeof window.hentAktivFirmaId === "function") {
      const id = window.hentAktivFirmaId();
      if (id) return id;
    }
    return window.aktivFirmaId || window.firmaData?.id || window.firma?.id || localStorage.getItem("aktivFirmaId") || localStorage.getItem("firmaId") || localStorage.getItem("firma_id") || "";
  }

  function erFirmaAdminModus() {
    return erAdminModus() && window.erSystemadmin !== true;
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

  function hentProsjektNavn(rad) {
    const p = prosjektFraMap(rad) || rad.prosjekter || {};
    return p.navn || p.prosjektnavn || rad.prosjekt_navn || rad.prosjektnavn || rad.navn || rad.jobb_navn || rad.beskrivelse || "";
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
    function leggTilBilde(url, tekst) {
      if (!url) return;
      if (!bilder.some(x => x.url === url)) bilder.push({ url: url, tekst: tekst || "" });
    }
    const direkteUrl = rad && (rad.bilde_url || rad.bilde || rad.image_url || "");
    const direkteSti = rad && (rad.bilde_path || rad.filsti || "");
    if (direkteSti) leggTilBilde(await lagSignertBildeUrl(direkteSti), "");
    else if (direkteUrl) leggTilBilde(direkteUrl, "");
    if (!window.supabaseClient || !jobbId) return bilder;
    async function leggTilFraRader(rader) {
      for (const b of (rader || [])) {
        const sti = b.filsti || b.bilde_path || "";
        let url = sti ? await lagSignertBildeUrl(sti) : "";
        if (!url && b.bilde_url) url = b.bilde_url;
        leggTilBilde(url, b.bildetekst || "");
      }
    }
    const timerIder = await hentRelaterteTimerIder(rad, jobbId);
    if (timerIder.length) {
      try {
        const { data, error } = await supabaseClient.from("hand_time_bilde").select("filsti,bilde_path,bilde_url,bildetekst,timer_id").in("timer_id", timerIder);
        if (!error) await leggTilFraRader(data || []);
      } catch (e) { console.warn("Hoppet over bilder på relaterte timer_id:", e); }
    }
    const mappeKandidater = [String(jobbId), String(jobbProsjektId(rad) || "")].filter(Boolean);
    for (const mappe of mappeKandidater) {
      try {
        const { data, error } = await supabaseClient.from("hand_time_bilde").select("filsti,bilde_path,bilde_url,bildetekst").ilike("filsti", mappe + "/%");
        if (!error) await leggTilFraRader(data || []);
      } catch (e) {}
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

    boks.innerHTML = '<div class="jobb-bilde-grid">' + bilder.map(function (b) {
      return '<a href="' + esc(b.url) + '" target="_blank" class="jobb-bilde-mini" title="' + esc(b.tekst || "Åpne bilde") + '">' +
        '<img loading="lazy" src="' + esc(b.url) + '" alt="Bilde">' +
      '</a>';
    }).join("") + '</div>';
  }

  async function lastOppBildePaJobb(jobbId, rad) {
    const filInput = hent("jobbBildeFil");
    const kameraInput = hent("jobbBildeKamera");
    const galleriInput = hent("jobbBildeGalleri");
    const tekstInput = hent("jobbBildeTekst");
    const melding = hent("jobbBildeMelding");
    const knapp = hent("lagreJobbBildeKnapp");

    if (melding) melding.textContent = "";

    const filer = [
      ...(kameraInput && kameraInput.files ? Array.from(kameraInput.files) : []),
      ...(galleriInput && galleriInput.files ? Array.from(galleriInput.files) : []),
      ...(filInput && filInput.files ? Array.from(filInput.files) : [])
    ];
    if (!filer.length) {
      if (melding) melding.textContent = "Velg ett eller flere bilder først.";
      return;
    }

    if (!window.supabaseClient) {
      if (melding) melding.textContent = "Supabase er ikke lastet.";
      return;
    }

    try {
      if (knapp) knapp.disabled = true;
      if (melding) melding.textContent = "Lagrer " + filer.length + " bilde" + (filer.length === 1 ? "" : "r") + "...";

      let lagretAntall = 0;

      for (const fil of filer) {
        const rentFilnavn = String(fil.name || "bilde.jpg")
          .replaceAll(" ", "_")
          .replace(/[æøåÆØÅ]/g, function (bokstav) {
            return { æ: "ae", ø: "o", å: "a", Æ: "Ae", Ø: "O", Å: "A" }[bokstav] || bokstav;
          })
          .replace(/[^a-zA-Z0-9._-]/g, "_");

        const filsti = String(jobbId) + "/" + Date.now() + "_" + lagretAntall + "_" + rentFilnavn;

        const { error: uploadError } = await supabaseClient
          .storage
          .from("timer-bilder")
          .upload(filsti, fil, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const bildeUrl = await lagSignertBildeUrl(filsti);

        const bildeRad = {
          filnavn: fil.name,
          filsti: filsti,
          bilde_path: filsti,
          bilde_url: bildeUrl || null,
          bildetekst: tekstInput ? tekstInput.value || "" : ""
        };

        const numericTimerId = Number(rad && (rad.timer_id || rad.time_id || rad.hand_time_id || rad.id));
        if (Number.isFinite(numericTimerId)) bildeRad.timer_id = numericTimerId;

        const { error: dbError } = await supabaseClient
          .from("hand_time_bilde")
          .insert(bildeRad);

        if (dbError) throw dbError;
        lagretAntall += 1;
      }

      if (filInput) filInput.value = "";
      if (kameraInput) kameraInput.value = "";
      if (galleriInput) galleriInput.value = "";
      if (tekstInput) tekstInput.value = "";
      if (melding) melding.textContent = lagretAntall + " bilde" + (lagretAntall === 1 ? "" : "r") + " er lagret på jobben.";

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


  function jobbTimerId(rad, fallbackId) {
    return jobbNumeriskId(rad, fallbackId);
  }

  async function hentRelaterteTimerIder(rad, fallbackId) {
    const ids = new Set();
    const direkte = jobbTimerId(rad, fallbackId);
    if (direkte !== null) ids.add(Number(direkte));

    if (!window.supabaseClient) return Array.from(ids);

    const prosjektId = jobbProsjektId(rad);
    const kundeId = jobbKundeId(rad);
    const dato = jobbDato(rad);

    function leggTilFra(rader) {
      (rader || []).forEach(function (r) {
        const n = Number(r.id || r.timer_id || r.time_id || r.hand_time_id || 0);
        if (Number.isFinite(n) && n > 0) ids.add(n);
      });
    }

    try {
      let q = supabaseClient.from(finnTimerTabell()).select("id, prosjekt_id, kunde_id, dato, timer, beskrivelse").limit(200);
      if (prosjektId) q = q.eq("prosjekt_id", prosjektId);
      else if (kundeId) q = q.eq("kunde_id", kundeId);
      if (kundeId) q = q.eq("kunde_id", kundeId);
      const r = await q;
      if (!r.error) leggTilFra(r.data);
    } catch (e) {
      console.warn("Kunne ikke hente relaterte timer på prosjekt/kunde:", e);
    }

    if (kundeId && dato) {
      try {
        const r = await supabaseClient.from(finnTimerTabell()).select("id, prosjekt_id, kunde_id, dato, timer, beskrivelse").eq("kunde_id", kundeId).eq("dato", dato).limit(200);
        if (!r.error) leggTilFra(r.data);
      } catch (e) {
        console.warn("Kunne ikke hente relaterte timer på kunde/dato:", e);
      }
    }

    return Array.from(ids);
  }


  function jobbMelding(tekst, feil) {
    const el = hent("jobbEkstraMelding");
    if (!el) return;
    el.textContent = tekst || "";
    el.style.color = feil ? "#fca5a5" : "#86efac";
  }


  function hentJobbRedigerVerdier() {
    return {
      prosjekt_navn: (hent("jobbEditNavn")?.value || "").trim(),
      beskrivelse: (hent("jobbEditBeskrivelse")?.value || "").trim(),
      dato: (hent("jobbEditDato")?.value || "").trim(),
      start: (hent("jobbEditStart")?.value || "").trim(),
      slutt: (hent("jobbEditSlutt")?.value || "").trim(),
      timer: (hent("jobbEditTimer")?.value || "").trim(),
      timepris: (hent("jobbEditTimepris")?.value || "").trim(),
      status: (hent("jobbEditStatus")?.value || "").trim()
    };
  }

  function leggTilHvisKolonneFinnes(rad, payload, kolonner, verdi) {
    if (verdi === undefined || verdi === null || verdi === "") return;
    for (const k of kolonner) {
      if (Object.prototype.hasOwnProperty.call(rad, k)) {
        payload[k] = verdi;
        return;
      }
    }
  }

  async function lagreJobbEndringer(jobbId, rad) {
    const knapp = hent("lagreJobbEndringerKnapp");
    const msg = hent("jobbEditMelding");
    function si(t, feil) {
      if (msg) {
        msg.textContent = t || "";
        msg.style.color = feil ? "#fca5a5" : "#86efac";
      }
    }

    if (!window.supabaseClient || !rad) { si("Kan ikke lagre: Supabase eller jobb mangler.", true); return; }
    if (knapp) knapp.disabled = true;
    si("Lagrer...", false);

    try {
      const v = hentJobbRedigerVerdier();
      let tabell = finnTimerTabell();
      let idKolonne = "id";
      let idVerdi = jobbId;
      let payload = {};

      if (rad.__prosjektRad) {
        tabell = "hand_prosjekt";
        idVerdi = rad.prosjekt_id || rad.id || jobbId;
        if (v.prosjekt_navn) payload.navn = v.prosjekt_navn;
        payload.beskrivelse = v.beskrivelse;
        if (v.status) payload.status = v.status;
      } else {
        idVerdi = rad.id || jobbId;
        leggTilHvisKolonneFinnes(rad, payload, ["dato"], v.dato);
        leggTilHvisKolonneFinnes(rad, payload, ["start", "start_tid", "startTid"], v.start);
        leggTilHvisKolonneFinnes(rad, payload, ["slutt", "slutt_tid", "sluttTid"], v.slutt);
        const timerTall = v.timer === "" ? "" : Number(String(v.timer).replace(",", "."));
        if (timerTall !== "" && Number.isFinite(timerTall)) leggTilHvisKolonneFinnes(rad, payload, ["timer", "antall_timer", "timer_antall"], timerTall);
        const timeprisTall = v.timepris === "" ? "" : Number(String(v.timepris).replace(",", "."));
        if (timeprisTall !== "" && Number.isFinite(timeprisTall)) leggTilHvisKolonneFinnes(rad, payload, ["timepris"], timeprisTall);
        leggTilHvisKolonneFinnes(rad, payload, ["beskrivelse", "notat", "arbeid"], v.beskrivelse);
        leggTilHvisKolonneFinnes(rad, payload, ["status"], v.status);
      }

      if (!idVerdi) { si("Kan ikke lagre: mangler jobb-id.", true); return; }
      if (!Object.keys(payload).length) { si("Ingen endringer å lagre.", true); return; }

      const { data, error } = await supabaseClient
        .from(tabell)
        .update(payload)
        .eq(idKolonne, idVerdi)
        .select()
        .maybeSingle();

      if (error) throw error;

      Object.assign(rad, data || payload);
      if (rad.__prosjektRad && payload.navn) {
        rad.prosjekt_navn = payload.navn;
        rad.beskrivelse = payload.beskrivelse;
      }
      si("Jobb lagret.", false);
      await lastJobber();
      const oppdatert = (sisteJobber || []).find(r => String(r.id || r.prosjekt_id || "") === String(idVerdi)) || rad;
      setTimeout(function(){ visJobbDetalj(oppdatert); }, 50);
    } catch (e) {
      console.error("Feil ved lagring av jobb:", e);
      si("Kunne ikke lagre jobb: " + (e.message || JSON.stringify(e)), true);
    } finally {
      if (knapp) knapp.disabled = false;
    }
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
    const timerIder = await hentRelaterteTimerIder(rad, jobbId);
    const funnet = [];
    const sett = new Set();
    function leggTil(rader) { (rader || []).forEach(function (r) { const key = String(r.id || JSON.stringify(r)); if (!sett.has(key)) { sett.add(key); funnet.push(r); } }); }

    if (timerIder.length) {
      try {
        const res = await supabaseClient.from("hand_faktura_vare").select("*").in("timer_id", timerIder).order("id", { ascending: false });
        if (!res.error) leggTil(res.data);
      } catch (e) {}
    }

    if (!funnet.length && kundeId) {
      try {
        const res = await supabaseClient.from("hand_faktura_vare").select("*").eq("kunde_id", kundeId).eq("fakturert", false).order("id", { ascending: false });
        if (!res.error) leggTil(res.data);
      } catch (e) {}
    }

    if (kundeId) {
      const markorer = ["%" + jobbMarkor(jobbId) + "%"];
      const prosjektId = jobbProsjektId(rad);
      if (prosjektId) markorer.push("%" + prosjektId + "%");
      for (const markor of markorer) {
        for (const kol of ["navn", "beskrivelse", "varenavn", "notat"]) {
          try {
            const res = await supabaseClient.from("hand_faktura_vare").select("*").eq("kunde_id", kundeId).ilike(kol, markor).order("id", { ascending: false });
            if (!res.error) leggTil(res.data);
          } catch (e) {}
        }
      }
    }
    return funnet;
  }

  function jobbLinjeSafeId(prefix, id) {
    return prefix + String(id || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function jobbStripPrefix(tekst, jobbId) {
    return String(tekst || "")
      .replace("Jobb #" + jobbId + " - ", "")
      .replace(/^Jobb #\S+\s*-\s*/i, "");
  }

  function jobbKrVare(v) {
    const n = Number(String(v ?? 0).replace(",", "."));
    if (!Number.isFinite(n)) return "0,00 kr";
    return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";
  }

  function jobbVareVisning(tekst, jobbId) {
    const ren = jobbStripPrefix(tekst, jobbId).trim();
    const m = ren.match(/^(EL[- ]?\d+|PN\s+[^-]+|[A-Z]{1,4}[- ]?\d+[A-Z0-9-]*)\s*-\s*(.+)$/i);
    if (m) return { kode: m[1].trim(), navn: m[2].trim() };
    return { kode: "", navn: ren || "Vare" };
  }

  async function slettJobbVare(jobbId, rad, vareId) {
    if (!vareId) return;
    if (!confirm("Slette denne varelinjen?")) return;
    jobbMelding("Sletter varelinje...");
    const { error } = await supabaseClient.from("hand_faktura_vare").delete().eq("id", vareId);
    if (error) { jobbMelding("Kunne ikke slette varelinje: " + error.message, true); return; }
    jobbMelding("Varelinje slettet.");
    await oppdaterJobbVarer(jobbId, rad);
  }

  async function lagreJobbVareEndring(jobbId, rad, vareId) {
    if (!vareId) return;
    const safe = jobbLinjeSafeId("vare_", vareId);
    const navn = (hent(safe + "_navn")?.value || "").trim();
    const antall = tallFraJobbFelt(safe + "_antall", 0);
    const pris = tallFraJobbFelt(safe + "_pris", 0);
    if (!navn) { jobbMelding("Varenavn kan ikke være tomt.", true); return; }
    if (!antall || antall <= 0) { jobbMelding("Antall må være større enn 0.", true); return; }
    const payload = {
      navn: "Jobb #" + jobbId + " - " + navn,
      antall: antall,
      pris: pris
    };
    jobbMelding("Lagrer varelinje...");
    const { error } = await supabaseClient.from("hand_faktura_vare").update(payload).eq("id", vareId);
    if (error) { jobbMelding("Kunne ikke lagre varelinje: " + error.message, true); return; }
    jobbMelding("Varelinje lagret.");
    await oppdaterJobbVarer(jobbId, rad);
  }

  async function oppdaterJobbVarer(jobbId, rad) {
    const el = hent("jobbVarerListe");
    if (!el) return;
    el.innerHTML = "Laster varer...";
    const varer = await hentJobbVarer(jobbId, rad);
    if (!varer.length) {
      el.innerHTML = '<div style="opacity:0.8; font-size:13px; padding:4px 0;">Ingen varer lagt på denne jobben ennå.</div>';
      return;
    }

    el.innerHTML = '<div class="jobb-card-liste">' +
      varer.map(function(v) {
        const safe = jobbLinjeSafeId("vare_", v.id);
        const navn = jobbStripPrefix(v.navn || v.beskrivelse || "", jobbId);
        const vis = jobbVareVisning(v.navn || v.beskrivelse || "", jobbId);
        const antall = Number(v.antall || 0);
        const pris = Number(v.pris || 0);
        const sum = antall * pris;
        return '<article class="jobb-mini-card jobb-vare-card">' +
          '<div class="jobb-mini-card-head">' +
            '<div class="jobb-mini-card-title">' +
              '<strong><span class="jobb-vare-ikon">📦</span> ' + esc(vis.navn || "Vare") + '</strong>' +
              (vis.kode ? '<span class="jobb-vare-kode">' + esc(vis.kode) + '</span>' : '') +
              '<span class="jobb-vare-meta">' + esc(blankHvisNullTall(v.antall) || "0") + ' stk × ' + esc(jobbKrVare(pris)) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="jobb-mini-card-sum">' + esc(jobbKrVare(sum)) + '</div>' +
          '<div class="jobb-mini-card-actions">' +
            '<button type="button" class="secondary jobb-vare-rediger" data-id="' + esc(v.id) + '">✏️ Rediger</button>' +
            '<button type="button" class="secondary jobb-vare-slett" data-id="' + esc(v.id) + '">🗑 Slett</button>' +
          '</div>' +
          '<div class="jobb-mini-card-edit" id="' + esc(safe) + '_edit" hidden>' +
            '<label>Vare<input id="' + esc(safe) + '_navn" type="text" value="' + esc(navn) + '" placeholder="Vare"></label>' +
            '<label>Antall<input id="' + esc(safe) + '_antall" type="number" step="0.01" value="' + esc(blankHvisNullTall(v.antall)) + '" placeholder="Ant."></label>' +
            '<label>Pris<input id="' + esc(safe) + '_pris" type="number" step="0.01" value="' + esc(blankHvisNullTall(v.pris)) + '" placeholder="Pris"></label>' +
            '<button type="button" class="jobb-vare-lagre" data-id="' + esc(v.id) + '">Lagre</button>' +
          '</div>' +
        '</article>';
      }).join("") +
      '</div>';

    el.querySelectorAll(".jobb-vare-rediger").forEach(function(knapp) {
      knapp.onclick = function() {
        const safe = jobbLinjeSafeId("vare_", knapp.getAttribute("data-id"));
        const edit = hent(safe + "_edit");
        if (edit) edit.hidden = !edit.hidden;
      };
    });
    el.querySelectorAll(".jobb-vare-lagre").forEach(function(knapp) {
      knapp.onclick = function() { lagreJobbVareEndring(jobbId, rad, knapp.getAttribute("data-id")); };
    });
    el.querySelectorAll(".jobb-vare-slett").forEach(function(knapp) {
      knapp.onclick = function() { slettJobbVare(jobbId, rad, knapp.getAttribute("data-id")); };
    });
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
      prosjekt_id: rad?.prosjekt_id || null,
      navn: "Jobb #" + jobbId + " - " + navn,
      antall: antall,
      pris: pris,
      fakturert: false,
      fakturanr: null
    };

    const timerId = jobbNumeriskId(rad, jobbId);
    const vareInsert = timerId !== null ? { ...insertRad, timer_id: timerId } : insertRad;
    let res = await supabaseClient.from("hand_faktura_vare").insert([vareInsert]);
    if (res.error && /timer_id|prosjekt_id/i.test(String(res.error.message || ""))) {
      const { timer_id, prosjekt_id, ...utenEkstra } = vareInsert;
      res = await supabaseClient.from("hand_faktura_vare").insert([utenEkstra]);
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

  function utleggFraTimerRad(rad) {
    const ut = [];
    function n(v) { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
    function legg(type, beskrivelse, belop) {
      if (n(belop) > 0) ut.push({ id: "timer_" + type, type: type, beskrivelse: beskrivelse, belop: n(belop), __fraTimerRad: true });
    }
    legg("kjoring", (n(rad.km) ? ("Kjøring " + n(rad.km) + " km") : "Kjøring"), rad.sum_km);
    legg("diett", "Diett", rad.diett);
    legg("parkering", "Parkering", rad.parkering);
    legg("billetter", "Billetter", rad.billetter);
    legg("bompenger", "Bompenger", rad.bompenger);
    legg("andre", rad.andre_utlegg_beskrivelse || "Andre utlegg", rad.andre_utlegg);
    return ut;
  }

  async function hentJobbUtlegg(jobbId, rad) {
    if (!window.supabaseClient || !jobbId) return [];
    const kundeId = jobbKundeId(rad);
    const timerIder = await hentRelaterteTimerIder(rad, jobbId);
    const funnet = [];
    const sett = new Set();
    function leggTil(rader) { (rader || []).forEach(function (r) { const key = String(r.id || JSON.stringify(r)); if (!sett.has(key)) { sett.add(key); funnet.push(r); } }); }

    if (timerIder.length) {
      try {
        const res = await supabaseClient.from("hand_faktura_utlegg").select("*").in("timer_id", timerIder).order("id", { ascending: false });
        if (!res.error) leggTil(res.data);
      } catch (e) {}
    }

    if (timerIder.length) {
      try {
        const res = await supabaseClient.from(finnTimerTabell()).select("id,beskrivelse,diett,parkering,billetter,bompenger,andre_utlegg,sum_km,km,km_pris,dato").in("id", timerIder);
        if (!res.error) {
          (res.data || []).forEach(function (t) {
            const baseId = "time_" + String(t.id);
            const legg = function (type, belop, tekst) { const n = Number(belop || 0); if (n > 0) leggTil([{ id: baseId + "_" + type, type: type, beskrivelse: tekst || type, belop: n, __fra_hand_time: true }]); };
            legg("kjøring", t.sum_km, t.km ? ("Kjøring " + t.km + " km x " + (t.km_pris || "")) : "Kjøring");
            legg("diett", t.diett, "Diett");
            legg("parkering", t.parkering, "Parkering");
            legg("billetter", t.billetter, "Billetter");
            legg("bompenger", t.bompenger, "Bompenger");
            legg("annet", t.andre_utlegg, t.beskrivelse || "Annet utlegg");
          });
        }
      } catch (e) {}
    }

    if (!funnet.length && kundeId) {
      try {
        const res = await supabaseClient.from("hand_faktura_utlegg").select("*").eq("kunde_id", kundeId).eq("fakturert", false).order("id", { ascending: false });
        if (!res.error) leggTil(res.data);
      } catch (e) {}
    }
    return funnet;
  }


  function erKjoringType(type) {
    const t = String(type || "").trim().toLowerCase();
    return t === "kjoring" || t === "kjøring" || t === "kjoering" || t === "kjoregodtgjorelse" || t === "kjøregodtgjørelse";
  }

  async function hentBilagForUtlegg(jobbId, utleggId) {
    const bilag = [];
    if (!window.supabaseClient || !jobbId || !utleggId) return bilag;

    function leggTil(url, tekst, filsti) {
      if (!url) return;
      if (!bilag.some(x => x.url === url)) bilag.push({ url: url, tekst: tekst || "Bilag", filsti: filsti || "" });
    }

    try {
      const { data, error } = await supabaseClient
        .from("hand_time_bilde")
        .select("filsti,bilde_path,bilde_url,bildetekst")
        .ilike("filsti", String(jobbId) + "/utlegg_" + String(utleggId) + "/%");
      if (error) return bilag;

      for (const b of (data || [])) {
        const sti = b.filsti || b.bilde_path || "";
        let url = "";
        if (sti) url = await lagSignertBildeUrl(sti);
        if (!url && b.bilde_url) url = b.bilde_url;
        leggTil(url, b.bildetekst || "Bilag", sti);
      }
    } catch (e) {
      console.warn("Kunne ikke hente bilag for utlegg:", e);
    }

    return bilag;
  }

  async function lastOppBilagForUtlegg(jobbId, utleggId, filer) {
    if (!window.supabaseClient || !jobbId || !utleggId || !filer || !filer.length) return 0;

    let lagretAntall = 0;
    for (const fil of Array.from(filer)) {
      const rentFilnavn = String(fil.name || "bilag.jpg")
        .replaceAll(" ", "_")
        .replace(/[æøåÆØÅ]/g, function (bokstav) {
          return { æ: "ae", ø: "o", å: "a", Æ: "Ae", Ø: "O", Å: "A" }[bokstav] || bokstav;
        })
        .replace(/[^a-zA-Z0-9._-]/g, "_");

      const filsti = String(jobbId) + "/utlegg_" + String(utleggId) + "/" + Date.now() + "_" + lagretAntall + "_" + rentFilnavn;

      const { error: uploadError } = await supabaseClient
        .storage
        .from("timer-bilder")
        .upload(filsti, fil, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const bildeUrl = await lagSignertBildeUrl(filsti);
      const bildeRad = {
        filnavn: fil.name,
        filsti: filsti,
        bilde_path: filsti,
        bilde_url: bildeUrl || null,
        bildetekst: "Bilag utlegg #" + String(utleggId)
      };

      const { error: dbError } = await supabaseClient
        .from("hand_time_bilde")
        .insert(bildeRad);

      if (dbError) throw dbError;
      lagretAntall += 1;
    }

    return lagretAntall;
  }

  async function slettJobbUtlegg(jobbId, rad, utleggId) {
    if (!utleggId) return;
    if (String(utleggId).startsWith("timer_")) { jobbMelding("Dette utlegget ligger på selve timeraden og kan endres via Endre jobb.", true); return; }
    if (!confirm("Slette denne utgiftslinjen?")) return;
    jobbMelding("Sletter utgiftslinje...");
    const { error } = await supabaseClient.from("hand_faktura_utlegg").delete().eq("id", utleggId);
    if (error) { jobbMelding("Kunne ikke slette utgiftslinje: " + error.message, true); return; }
    jobbMelding("Utgiftslinje slettet.");
    await oppdaterJobbUtlegg(jobbId, rad);
  }

  async function lagreJobbUtleggEndring(jobbId, rad, utleggId) {
    if (!utleggId) return;
    if (String(utleggId).startsWith("timer_")) { jobbMelding("Dette utlegget ligger på selve timeraden og kan endres via Endre jobb.", true); return; }
    const safe = jobbLinjeSafeId("utlegg_", utleggId);
    const type = (hent(safe + "_type")?.value || "").trim();
    const beskrivelse = (hent(safe + "_beskrivelse")?.value || "").trim();
    const belop = tallFraJobbFelt(safe + "_belop", 0);
    if (!type) { jobbMelding("Type kan ikke være tom.", true); return; }
    if (!belop || belop <= 0) { jobbMelding("Beløp må være større enn 0.", true); return; }
    const payload = {
      type: type,
      beskrivelse: "Jobb #" + jobbId + " - " + (beskrivelse || type),
      belop: belop
    };
    jobbMelding("Lagrer utgiftslinje...");
    const { error } = await supabaseClient.from("hand_faktura_utlegg").update(payload).eq("id", utleggId);
    if (error) { jobbMelding("Kunne ikke lagre utgiftslinje: " + error.message, true); return; }
    jobbMelding("Utgiftslinje lagret.");
    await oppdaterJobbUtlegg(jobbId, rad);
  }

  async function lastOppBilagTilEksisterendeUtlegg(jobbId, rad, utleggId) {
    if (!utleggId) return;
    if (String(utleggId).startsWith("timer_")) { jobbMelding("Bilag kan legges på nye utgifter eller som jobb-bilde.", true); return; }
    const safe = jobbLinjeSafeId("utlegg_", utleggId);
    const input = hent(safe + "_bilag");
    const filer = input && input.files ? Array.from(input.files) : [];
    if (!filer.length) { jobbMelding("Velg bilag først.", true); return; }
    try {
      jobbMelding("Laster opp bilag...");
      await lastOppBilagForUtlegg(jobbId, utleggId, filer);
      if (input) input.value = "";
      jobbMelding("Bilag lagt til.");
      await oppdaterJobbUtlegg(jobbId, rad);
    } catch (e) {
      jobbMelding("Kunne ikke lagre bilag: " + (e.message || JSON.stringify(e)), true);
    }
  }

  async function oppdaterJobbUtlegg(jobbId, rad) {
    const el = hent("jobbUtleggListe");
    if (!el) return;
    el.innerHTML = "Laster utgifter...";
    const utlegg = await hentJobbUtlegg(jobbId, rad);
    if (!utlegg.length) {
      el.innerHTML = '<div style="opacity:0.8; font-size:13px; padding:4px 0;">Ingen utgifter lagt på denne jobben ennå.</div>';
      return;
    }

    const rader = [];
    for (const u of utlegg) {
      const safe = jobbLinjeSafeId("utlegg_", u.id);
      const erKjoring = erKjoringType(u.type);
      const kanEndres = !String(u.id || "").startsWith("timer_") && !u.__fra_hand_time && !u.__fraTimerRad;
      const bilag = erKjoring ? [] : await hentBilagForUtlegg(jobbId, u.id);
      const typeTekst = pentBeskrivelse(u.type || "Utgift");
      const beskrivelse = jobbStripPrefix(u.beskrivelse || "", jobbId) || "-";
      const bilagHtml = erKjoring
        ? '<span class="jobb-row-bilag jobb-row-bilag-muted" title="Kjøring har normalt ikke bilag">-</span>'
        : (bilag.length
          ? '<span class="jobb-row-bilag jobb-row-bilag-har" title="Bilag finnes">📎 ' + bilag.length + '</span>'
          : '<span class="jobb-row-bilag jobb-row-bilag-muted" title="Ingen bilag">-</span>');

      rader.push('<article class="jobb-utlegg-row">' +
        '<div class="jobb-utlegg-type"><span class="jobb-utlegg-ikon">' + esc(jobbTypeIkon(u.type)) + '</span><strong>' + esc(typeTekst) + '</strong></div>' +
        '<div class="jobb-utlegg-beskrivelse" title="' + esc(beskrivelse) + '">' + esc(beskrivelse) + '</div>' +
        '<div class="jobb-utlegg-bilag-cell">' + bilagHtml + '</div>' +
        '<div class="jobb-utlegg-belop">' + esc(jobbKr(u.belop)) + '</div>' +
        '<div class="jobb-utlegg-actions">' +
          '<button type="button" class="secondary jobb-icon-btn jobb-utlegg-rediger" data-id="' + esc(u.id) + '" title="Rediger">✏️</button>' +
          (kanEndres ? '<button type="button" class="secondary jobb-icon-btn jobb-utlegg-slett" data-id="' + esc(u.id) + '" title="Slett">🗑️</button>' : '') +
        '</div>' +
        '<div class="jobb-mini-card-edit jobb-utlegg-row-edit" id="' + esc(safe) + '_edit" hidden>' +
          '<label>Type<input id="' + esc(safe) + '_type" type="text" value="' + esc(u.type || "") + '" placeholder="Type"></label>' +
          '<label>Beskrivelse<input id="' + esc(safe) + '_beskrivelse" type="text" value="' + esc(jobbStripPrefix(u.beskrivelse || "", jobbId)) + '" placeholder="Beskrivelse"></label>' +
          '<label>Beløp<input id="' + esc(safe) + '_belop" type="number" step="0.01" value="' + esc(blankHvisNullTall(u.belop)) + '" placeholder="Kr"></label>' +
          '<button type="button" class="jobb-utlegg-lagre" data-id="' + esc(u.id) + '">Lagre</button>' +
          (erKjoring || !kanEndres ? '' : '<div class="jobb-bilag-opplasting"><input id="' + esc(safe) + '_bilag" type="file" accept="image/*,application/pdf" multiple><button type="button" class="jobb-mini-bilag jobb-utlegg-bilag" data-id="' + esc(u.id) + '">+ bilag</button></div>') +
        '</div>' +
      '</article>');
    }

    el.innerHTML = '<div class="jobb-utlegg-table">' +
      '<div class="jobb-utlegg-header"><span>Type</span><span>Beskrivelse</span><span>Bilag</span><span>Beløp</span><span></span></div>' +
      rader.join("") +
      '</div>';

    el.querySelectorAll(".jobb-utlegg-rediger").forEach(function(knapp) {
      knapp.onclick = function() {
        const safe = jobbLinjeSafeId("utlegg_", knapp.getAttribute("data-id"));
        const edit = hent(safe + "_edit");
        if (edit) edit.hidden = !edit.hidden;
      };
    });
    el.querySelectorAll(".jobb-utlegg-lagre").forEach(function(knapp) {
      knapp.onclick = function() { lagreJobbUtleggEndring(jobbId, rad, knapp.getAttribute("data-id")); };
    });
    el.querySelectorAll(".jobb-utlegg-slett").forEach(function(knapp) {
      knapp.onclick = function() { slettJobbUtlegg(jobbId, rad, knapp.getAttribute("data-id")); };
    });
    el.querySelectorAll(".jobb-utlegg-bilag").forEach(function(knapp) {
      knapp.onclick = function() { lastOppBilagTilEksisterendeUtlegg(jobbId, rad, knapp.getAttribute("data-id")); };
    });
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
    if (erKjoringType(type)) belop = km * kmPris;
    if (!belop || belop <= 0) { jobbMelding("Skriv beløp eller km.", true); return; }

    const beskrivelse = "Jobb #" + jobbId + " - " + (erKjoringType(type) ? ("Kjøring " + km + " km x " + kmPris) : type);
    let insertRad = {
      kunde_id: kundeId,
      prosjekt_id: rad?.prosjekt_id || null,
      type: type,
      beskrivelse: beskrivelse,
      belop: belop,
      fakturert: false,
      fakturanr: null
    };

    const timerId = jobbNumeriskId(rad, jobbId);
    const utleggInsert = timerId !== null ? { ...insertRad, timer_id: timerId } : insertRad;
    let res = await supabaseClient.from("hand_faktura_utlegg").insert([utleggInsert]).select("*").single();
    if (res.error && /timer_id|prosjekt_id/i.test(String(res.error.message || ""))) {
      const { timer_id, prosjekt_id, ...utenEkstra } = utleggInsert;
      res = await supabaseClient.from("hand_faktura_utlegg").insert([utenEkstra]).select("*").single();
    }

    if (res.error) {
      jobbMelding("Kunne ikke lagre utgift på jobben: " + res.error.message, true);
      return;
    }

    const lagretUtlegg = res.data || null;
    const bilagInput = hent("jobbUtgiftBilag");
    const bilagFiler = (!erKjoringType(type) && bilagInput && bilagInput.files) ? Array.from(bilagInput.files) : [];
    if (bilagFiler.length) {
      if (!lagretUtlegg || !lagretUtlegg.id) {
        jobbMelding("Utgift ble lagret, men bilag kunne ikke kobles fordi utgift-ID mangler.", true);
      } else {
        try {
          await lastOppBilagForUtlegg(jobbId, lagretUtlegg.id, bilagFiler);
        } catch (e) {
          console.error("Kunne ikke lagre bilag på utlegg:", e);
          jobbMelding("Utgift ble lagret, men bilag ble ikke lagret: " + (e.message || JSON.stringify(e)), true);
          await oppdaterJobbUtlegg(jobbId, rad);
          return;
        }
      }
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
        km: erKjoringType(type) ? km : 0,
        km_pris: erKjoringType(type) ? kmPris : 0,
        sum_km: erKjoringType(type) ? belop : 0,
        diett: type === "diett" ? belop : 0,
        parkering: type === "parkering" ? belop : 0,
        billetter: type === "billetter" ? belop : 0,
        bompenger: type === "bompenger" ? belop : 0,
        andre_utlegg: ["kjoring", "kjøring", "kjoering", "diett", "parkering", "billetter", "bompenger"].includes(String(type || "").toLowerCase()) ? 0 : belop,
        andre_utlegg_beskrivelse: "Utlegg på jobb #" + jobbId + ": " + type,
        sum: 0,
        fakturerbar: false,
        beskrivelse: "Utlegg/refusjon på jobb #" + jobbId + ": " + type
      };
      try { await supabaseClient.from("hand_time").insert([timerUtlegg]); } catch (e) { console.warn("Utlegg ble ikke lagt i time/lønnstabell:", e); }
    }

    if (hent("jobbUtgiftType")) hent("jobbUtgiftType").value = "";
    if (hent("jobbUtgiftBelop")) hent("jobbUtgiftBelop").value = "";
    if (hent("jobbUtgiftKm")) hent("jobbUtgiftKm").value = "";
    if (hent("jobbUtgiftBilag")) hent("jobbUtgiftBilag").value = "";
    jobbMelding("Utgift lagt på jobben" + (bilagFiler && bilagFiler.length ? " med bilag." : "."));
    await oppdaterJobbUtlegg(jobbId, rad);
  }

  function visJobbDetalj(rad) {
    const detalj = sikreDetaljBoks();
    if (!detalj || !rad) return;

    const id = rad.id || rad.timer_id || "";
    const html = [];

    html.push('<style>' +
      '.jobb-felt-rad{display:grid;grid-template-columns:repeat(auto-fit,minmax(95px,1fr));gap:6px;margin-top:8px}.jobb-felt-rad>div{background:#0f172a;border:1px solid #374151;border-radius:8px;padding:6px;font-size:13px}.jobb-felt-rad strong{font-size:12px}.jobb-kompakt-liste{display:grid;gap:5px;margin:4px 0 8px 0;}' +
      '.jobb-bilde-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:6px;max-width:100%;margin:4px 0 8px 0;}' +
      '.jobb-bilde-mini{display:block;min-width:0;text-decoration:none;color:inherit;}' +
      '.jobb-bilde-mini img{width:100%;height:52px;object-fit:cover;border-radius:7px;border:1px solid #374151;display:block;background:#111827;}' +
      '.jobb-card-liste{display:grid;gap:4px;margin:4px 0 8px 0;}' +
      '.jobb-mini-card{background:#0f172a;border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:4px 8px;display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"head sum actions" "edit edit edit";column-gap:6px;row-gap:4px;align-items:center;box-shadow:none;transition:border-color .18s ease,background .18s ease;min-height:32px;}' +
      '.jobb-mini-card:hover{border-color:rgba(59,130,246,.65);background:#111c33;}' +
      '.jobb-mini-card-head{grid-area:head;display:flex;min-width:0;align-items:center;}' +
      '.jobb-mini-card-title{display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap;overflow:hidden;}' +
      '.jobb-mini-card-title strong{font-size:13px;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.jobb-vare-ikon{opacity:.9}.jobb-vare-kode{display:inline-flex;flex:0 0 auto;padding:1px 6px;border-radius:999px;background:#1e3a5f;color:#bfdbfe;font-size:10px;font-weight:800;letter-spacing:.01em;line-height:16px;}' +
      '.jobb-vare-meta{flex:0 0 auto;font-size:12px;color:#cbd5e1;line-height:1.1;}' +
      '.jobb-mini-card-sum{grid-area:sum;font-weight:900;font-size:13px;white-space:nowrap;text-align:right;background:#172554;border:1px solid rgba(96,165,250,.35);border-radius:999px;padding:2px 8px;color:#fff;line-height:20px;}' +
      '.jobb-mini-card-actions{grid-area:actions;display:flex;gap:4px;justify-content:flex-end;align-items:center;}' +
      '.jobb-mini-card-actions button,.jobb-mini-card-edit button{min-height:24px;padding:2px 7px;font-size:12px;border-radius:7px;line-height:18px;}' +
      '.jobb-mini-card-edit{display:grid;grid-template-columns:1.2fr 2fr 90px auto;gap:6px;align-items:end;background:#111827;border:1px solid #374151;border-radius:8px;padding:7px;}' +
      '.jobb-mini-card-edit[hidden]{display:none!important;}' +
      '.jobb-mini-card-edit label{font-size:12px;font-weight:700;margin:0;}' +
      '.jobb-mini-card-edit input{width:100%;box-sizing:border-box;margin-top:3px;height:34px;min-height:34px;padding:5px 7px;font-size:13px;}' +
      '.jobb-mini-card-bilag{font-size:12px;opacity:.85;}' +
      '.jobb-bilag-opplasting{grid-column:1/-1;display:flex;gap:6px;align-items:center;flex-wrap:wrap;}' +
      '.jobb-bilag-opplasting input[type=file]{max-width:240px;font-size:12px;}' +
      '.jobb-bilag-mini{display:flex;gap:4px;max-width:160px;overflow-x:auto;}' +
      '.jobb-bilag-mini img{width:30px;height:30px;object-fit:cover;border-radius:6px;border:1px solid #374151;display:block;}' +
      '.jobb-ingen-bilag{font-size:12px;opacity:.7;white-space:nowrap;}' +
      '.jobb-utlegg-table{display:grid;gap:4px;margin:6px 0 12px 0;}' +
      '.jobb-utlegg-header,.jobb-utlegg-row{display:grid;grid-template-columns:150px minmax(160px,1fr) 58px 110px 74px;gap:8px;align-items:center;}' +
      '.jobb-utlegg-header{font-size:11px;text-transform:uppercase;letter-spacing:.04em;opacity:.62;padding:0 10px 2px 10px;}' +
      '.jobb-utlegg-row{background:#0f172a;border:1px solid #263244;border-radius:9px;padding:7px 8px;min-height:38px;}' +
      '.jobb-utlegg-type{display:flex;align-items:center;gap:6px;min-width:0;}' +
      '.jobb-utlegg-type strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;}' +
      '.jobb-utlegg-ikon{width:18px;text-align:center;flex:0 0 auto;}' +
      '.jobb-utlegg-beskrivelse{font-size:13px;opacity:.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}' +
      '.jobb-utlegg-bilag-cell{font-size:12px;text-align:center;}' +
      '.jobb-row-bilag-har{color:#bfdbfe;font-weight:800;}' +
      '.jobb-row-bilag-muted{opacity:.5;}' +
      '.jobb-utlegg-belop{font-weight:900;text-align:right;white-space:nowrap;font-size:13px;}' +
      '.jobb-utlegg-actions{display:flex;gap:5px;justify-content:flex-end;}' +
      '.jobb-icon-btn{min-height:28px!important;width:32px!important;padding:3px!important;border-radius:7px!important;font-size:13px!important;line-height:1!important;}' +
      '.jobb-utlegg-row-edit{grid-column:1/-1;margin-top:6px;}' +
      '.jobb-kompakt-skjema{padding:8px!important;border-radius:8px!important;margin-top:6px!important;}' +
      '.jobb-kompakt-skjema summary{font-size:14px;margin-bottom:6px!important;}' +
      '.jobb-kompakt-skjema .rad{gap:6px!important;margin-top:10px;}' +
      '.jobb-kompakt-skjema label{font-size:12px;margin-bottom:2px;}' +
      '.jobb-kompakt-skjema input,.jobb-kompakt-skjema select{height:34px;min-height:34px;padding:4px 6px;font-size:13px;}' +
      '.jobb-kompakt-skjema button{min-height:32px;padding:5px 10px;font-size:13px;}' +
      '@media(max-width:700px){.jobb-bilde-grid{grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:4px}.jobb-bilde-mini img{height:44px;border-radius:6px}.jobb-mini-card{padding:9px;border-radius:11px}.jobb-mini-card-head{align-items:flex-start}.jobb-mini-card-title strong{font-size:13px;white-space:normal}.jobb-mini-card-sum{font-size:14px}.jobb-mini-card-edit{grid-template-columns:1fr;gap:7px}.jobb-mini-card-actions button,.jobb-mini-card-edit button{min-height:32px}.jobb-bilag-mini{max-width:100%}.jobb-bilag-mini img{width:26px;height:26px}.jobb-utlegg-header{display:none}.jobb-utlegg-row{grid-template-columns:1fr auto;gap:4px 8px;padding:8px}.jobb-utlegg-type{grid-column:1/2}.jobb-utlegg-beskrivelse{grid-column:1/2;font-size:12px}.jobb-utlegg-bilag-cell{grid-column:1/2;text-align:left}.jobb-utlegg-belop{grid-column:2/3;grid-row:1/3;font-size:14px}.jobb-utlegg-actions{grid-column:2/3;justify-content:flex-end}.jobb-utlegg-row-edit{grid-column:1/-1}}' +
    '</style>');

    html.push('<div class="kort" style="max-width:none; margin:0 0 14px 0; border:1px solid #374151;">');
    html.push('<div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap;">');
    html.push('<h3 style="margin:0;">Jobb ' + esc(id ? "#" + id : "") + '</h3>');
    html.push('<button type="button" class="secondary" id="lukkJobbDetaljKnapp">Lukk</button>');
    html.push('</div>');

    html.push('<div class="jobb-felt-rad">');
    html.push(felt("Dato", datoNo(rad.dato || rad.created_at)));
    html.push(felt("Kunde", hentKunde(rad)));
    html.push(felt("Jobb/prosjekt", hentProsjektNavn(rad)));
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
    html.push('<div style="margin-top:14px; padding:12px; border:1px solid #374151; border-radius:10px; background:#111827;">');
    html.push('<h4 style="margin-top:0;">Endre jobb</h4>');
    html.push('<div class="rad">');
    html.push('<div><label for="jobbEditNavn">Jobb/prosjektnavn</label><input id="jobbEditNavn" type="text" value="' + esc(hentProsjektNavn(rad) || hentProsjekt(rad) || '') + '"></div>');
    html.push('<div><label for="jobbEditDato">Dato</label><input id="jobbEditDato" type="date" value="' + esc(String(rad.dato || rad.created_at || "").slice(0,10)) + '"></div>');
    html.push('<div><label for="jobbEditStart">Start</label><input id="jobbEditStart" type="text" value="' + esc(rad.start || rad.start_tid || rad.startTid || "") + '"></div>');
    html.push('<div><label for="jobbEditSlutt">Slutt</label><input id="jobbEditSlutt" type="text" value="' + esc(rad.slutt || rad.slutt_tid || rad.sluttTid || "") + '"></div>');
    html.push('<div><label for="jobbEditTimer">Timer</label><input id="jobbEditTimer" type="number" step="0.01" value="' + esc(rad.timer || rad.antall_timer || rad.timer_antall || "") + '"></div>');
    html.push('<div><label for="jobbEditTimepris">Timepris</label><input id="jobbEditTimepris" type="number" step="0.01" value="' + esc(rad.timepris || "") + '"></div>');
    html.push('<div><label for="jobbEditStatus">Status</label><input id="jobbEditStatus" type="text" value="' + esc(rad.status || "") + '"></div>');
    html.push('</div>');
    html.push('<label for="jobbEditBeskrivelse">Beskrivelse</label><textarea id="jobbEditBeskrivelse" rows="4" style="width:100%; box-sizing:border-box;">' + esc(beskrivelse) + '</textarea>');
    html.push('<button type="button" id="lagreJobbEndringerKnapp" style="margin-top:8px; font-weight:700;">Lagre jobb</button>');
    html.push('<div id="jobbEditMelding" style="font-weight:700; margin-top:8px;"></div>');
    html.push('</div>');


    if (beskrivelse) {
      html.push('<h4>Beskrivelse</h4>');
      html.push('<div style="white-space:pre-wrap; background:#111827; padding:10px; border-radius:8px;">' + esc(pentBeskrivelse(beskrivelse)) + '</div>');
    }

    html.push('<h4>Bilder</h4>');
    html.push('<div id="jobbDetaljBilder" style="margin-bottom:12px;">Laster bilder...</div>');

    html.push('<h4>Varer på jobben</h4>');
    html.push('<div id="jobbVarerListe" style="margin-bottom:12px;">Laster varer...</div>');
    html.push('<details class="jobb-kompakt-skjema" style="margin-top:10px; padding:12px; border:1px solid #374151; border-radius:10px; background:#111827;">');
    html.push('<summary style="cursor:pointer;font-weight:900;">+ Legg til vare</summary>');
    html.push('<div class="rad">');
    html.push('<div><label for="jobbVareValg">Vare fra aktiv bil</label><select id="jobbVareValg"><option value="">Laster...</option></select></div>');
    html.push('<div><label for="jobbVareAntall">Antall</label><input id="jobbVareAntall" type="number" step="1" min="1" value="1"></div>');
    html.push('<div><label for="jobbVarePris">Pris</label><input id="jobbVarePris" type="number" step="0.01" value="0"></div>');
    html.push('</div>');
    html.push('<button type="button" id="leggJobbVareKnapp">Legg til vare</button>');
    html.push('</details>');

    html.push('<h4>Utgifter på jobben</h4>');
    html.push('<div id="jobbUtleggListe" style="margin-bottom:12px;">Laster utgifter...</div>');
    html.push('<details class="jobb-kompakt-skjema" style="margin-top:10px; padding:12px; border:1px solid #374151; border-radius:10px; background:#111827;">');
    html.push('<summary style="cursor:pointer;font-weight:900;">+ Legg til utgift</summary>');
    html.push('<div class="rad">');
    html.push('<div><label for="jobbUtgiftType">Utgiftstype</label><select id="jobbUtgiftType"><option value="">Velg</option><option value="kjoring">Kjøring</option><option value="bompenger">Bompenger</option><option value="parkering">Parkering</option><option value="ferge">Ferge</option><option value="diett">Diett</option><option value="billetter">Billetter</option><option value="annet">Annet</option></select></div>');
    html.push('<div><label for="jobbUtgiftBelop">Beløp</label><input id="jobbUtgiftBelop" type="number" step="0.01" value=""></div>');
    html.push('<div id="jobbKmWrap" style="display:none"><label for="jobbUtgiftKm">Km</label><input id="jobbUtgiftKm" type="number" step="0.1" value=""></div>');
    html.push('<div id="jobbKmPrisWrap" style="display:none"><label for="jobbUtgiftKmPris">Pris pr km</label><input id="jobbUtgiftKmPris" type="text" inputmode="decimal" value="5,30"></div>');
    html.push('<div id="jobbUtgiftBilagWrap"><label for="jobbUtgiftBilag">Bilag/kvittering</label><input id="jobbUtgiftBilag" type="file" accept="image/*,application/pdf" multiple style="padding:8px; border:1px solid #374151; border-radius:8px; width:100%; box-sizing:border-box;"><small style="opacity:0.8; display:block; margin-top:4px;">Du kan velge flere bilder eller PDF-er.</small></div>');
    html.push('</div>');
    html.push('<button type="button" id="leggJobbUtleggKnapp">Legg til utgift</button>');
    html.push('<div id="jobbEkstraMelding" style="font-weight:700; margin-top:8px;"></div>');
    html.push('</details>');

    html.push('<div style="margin-top:14px; padding:12px; border:1px solid #374151; border-radius:10px; background:#111827;">');
    html.push('<h4 style="margin-top:0;">Legg til flere bilder på denne jobben</h4>');
    html.push('<div style="display:grid; gap:8px; max-width:520px;">');
    html.push('<label for="jobbBildeKamera" style="font-weight:700;">Ta nytt bilde</label>');
    html.push('<input type="file" id="jobbBildeKamera" accept="image/*" capture="environment" title="Ta bilde med kamera" style="padding:8px; border:1px solid #374151; border-radius:8px;">');
    html.push('<label for="jobbBildeGalleri" style="font-weight:700;">Velg ett eller flere bilder fra galleri</label>');
    html.push('<input type="file" id="jobbBildeGalleri" accept="image/*" multiple title="Du kan velge flere bilder samtidig" style="padding:8px; border:1px solid #374151; border-radius:8px;">');
    html.push('<input type="text" id="jobbBildeTekst" placeholder="Bildetekst, valgfritt" style="padding:8px; border:1px solid #374151; border-radius:8px;">');
    html.push('<small style="opacity:0.8;">Du kan velge flere bilder samtidig, eller lagre ett og ett etterpå. Nye bilder legges til uten å fjerne gamle.</small>');
    html.push('<button type="button" id="lagreJobbBildeKnapp" style="font-weight:700;background:#2563eb;color:#fff;border:0;border-radius:8px;padding:10px 12px;">Lagre valgte bilde(r) på jobben</button>');
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

    const lagreJobbKnapp = hent("lagreJobbEndringerKnapp");
    if (lagreJobbKnapp) {
      lagreJobbKnapp.onclick = function () {
        lagreJobbEndringer(id, rad);
      };
    }

    const bildeKnapp = hent("lagreJobbBildeKnapp");
    if (bildeKnapp) {
      bildeKnapp.onclick = function () {
        lastOppBildePaJobb(id, rad);
      };
    }
    [hent("jobbBildeKamera"), hent("jobbBildeGalleri"), hent("jobbBildeFil")].forEach(function(input) {
      if (!input) return;
      input.onchange = function () {
        const kamera = hent("jobbBildeKamera");
        const galleri = hent("jobbBildeGalleri");
        const gammel = hent("jobbBildeFil");
        const antall =
          (kamera && kamera.files ? kamera.files.length : 0) +
          (galleri && galleri.files ? galleri.files.length : 0) +
          (gammel && gammel.files ? gammel.files.length : 0);
        const melding = hent("jobbBildeMelding");
        if (melding && antall) melding.textContent = antall + " bilde" + (antall === 1 ? "" : "r") + " valgt.";
      };
    });

    const vareKnapp = hent("leggJobbVareKnapp");
    if (vareKnapp) {
      vareKnapp.onclick = function () {
        leggVarePaJobb(id, rad);
      };
    }

    
    const typeVelger = hent("jobbUtgiftType");
    if (typeVelger) {
      const oppdater = function() {
        const k = typeVelger.value === "kjoring";
        const a = hent("jobbKmWrap");
        const b = hent("jobbKmPrisWrap");
        if (a) a.style.display = k ? "" : "none";
        if (b) b.style.display = k ? "" : "none";
        const bel = hent("jobbUtgiftBelop");
        if (bel) bel.parentElement.style.display = k ? "none" : "";
        const bilagWrap = hent("jobbUtgiftBilagWrap");
        if (bilagWrap) bilagWrap.style.display = k ? "none" : "";
        const bilagInput = hent("jobbUtgiftBilag");
        if (k && bilagInput) bilagInput.value = "";
        const utleggKnapp = hent("leggJobbUtleggKnapp");
        if (utleggKnapp) utleggKnapp.textContent = k ? "Legg til kjøring" : "Legg til utgift med bilag";
        if (k) {
          const km = hent("jobbUtgiftKm");
          if (km && km.value==="0") km.value="";
        }
      };
      typeVelger.onchange=oppdater;
      setTimeout(oppdater,0);
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
        ? (window.erSystemadmin === true ? "Sysadmin ser alle jobber. Klikk på en jobb for detaljer." : "Admin ser bare jobber for eget firma. Klikk på en jobb for detaljer.")
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

  function prosjektTilJobbRad(p, ekstra) {
    ekstra = ekstra || {};
    return {
      id: p.id,
      prosjekt_id: p.id,
      prosjekt_nr: p.prosjekt_nr || p.prosjektnr || "",
      prosjektnr: p.prosjektnr || p.prosjekt_nr || "",
      prosjekt_navn: p.navn || "",
      beskrivelse: p.beskrivelse || p.navn || "",
      kunde_id: p.kunde_id || null,
      firma_id: p.firma_id || null,
      dato: p.opprettet || p.created_at || "",
      created_at: p.opprettet || p.created_at || "",
      status: p.status || (p.aktiv === false ? "Inaktiv" : "Aktiv"),
      fakturert: false,
      ansatt_id: ekstra.ansatt_id || p.ansatt_id || null,
      ansatt_navn: ekstra.ansatt_navn || p.ansatt_navn || "",
      ansatt_epost: ekstra.ansatt_epost || p.ansatt_epost || "",
      __prosjektRad: true
    };
  }

  function erEkteTimerJobb(rad) {
    if (!rad) return false;
    const timer = Number(rad.timer ?? rad.antall_timer ?? rad.timer_antall ?? 0);
    const start = String(rad.start || rad.start_tid || rad.startTid || "").trim();
    const slutt = String(rad.slutt || rad.slutt_tid || rad.sluttTid || "").trim();
    const tekst = String(rad.beskrivelse || rad.notat || rad.arbeid || "").toLowerCase();
    if (tekst.includes("utlegg/refusjon")) return false;
    if (timer > 0) return true;
    if (start && slutt && start !== "00:00" && slutt !== "00:00") return true;
    return false;
  }

  async function hentProsjektJobber(firmaId, prosjektIds, ansattInfoByProsjekt) {
    if (!firmaId) return [];
    let q = supabaseClient
      .from("hand_prosjekt")
      .select("*")
      .eq("firma_id", firmaId)
      .eq("aktiv", true)
      .order("opprettet", { ascending: false });

    if (Array.isArray(prosjektIds)) {
      if (!prosjektIds.length) return [];
      q = q.in("id", prosjektIds);
    }

    const { data, error } = await q;
    if (error) throw error;

    return (data || []).map(function (p) {
      const ekstra = ansattInfoByProsjekt && ansattInfoByProsjekt.get(String(p.id)) || {};
      return prosjektTilJobbRad(p, ekstra);
    });
  }

  async function hentTimeJobber(firmaId, ansattId) {
    const tabell = finnTimerTabell();
    let query = supabaseClient.from(tabell).select("*").order("dato", { ascending: false }).limit(1000);

    if (firmaId) query = query.eq("firma_id", firmaId);
    if (!erAdminModus() && ansattId) query = query.eq("ansatt_id", ansattId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  function byggAnsattInfoFraTimer(timer) {
    const map = new Map();
    (timer || []).forEach(function (r) {
      const pid = r.prosjekt_id || r.prosjektId || "";
      if (!pid || map.has(String(pid))) return;
      map.set(String(pid), {
        ansatt_id: r.ansatt_id || r.ansattId || r.bruker_id || r.user_id || null,
        ansatt_navn: r.ansatt_navn || r.ansattnavn || "",
        ansatt_epost: r.ansatt_epost || r.bruker_epost || r.epost || ""
      });
    });
    return map;
  }

  function flettProsjektOgTimer(prosjekter, timer) {
    const ut = [];
    const sett = new Set();

    (prosjekter || []).forEach(function (p) {
      const key = "p:" + (p.prosjekt_id || p.id);
      if (!sett.has(key)) {
        sett.add(key);
        ut.push(p);
      }
    });

    (timer || []).forEach(function (r) {
      const key = r.prosjekt_id ? "p:" + r.prosjekt_id : "t:" + r.id;
      if (!sett.has(key)) {
        sett.add(key);
        ut.push(r);
      }
    });

    return ut;
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
      const ansatt = await hentInnloggetHandAnsatt();
      const ansattId = ansatt?.id || hentInnloggetAnsattId();
      const firmaId = ansatt?.firma_id || await hentFirmaIdForTilgang();

      if (!firmaId) {
        if (melding) melding.textContent = "Mangler firma_id for innlogget bruker.";
        if (liste) liste.innerHTML = "<p>Ingen jobber funnet.</p>";
        return;
      }

      let timer = [];
      try {
        timer = await hentTimeJobber(firmaId, ansattId);
      } catch (timeFeil) {
        console.warn("Kunne ikke hente timer til jobbliste:", timeFeil);
      }

      // Jobber-siden skal vise faktiske jobber fra hand_time.
      // Prosjekt-tabellen brukes bare for prosjektnavn/prosjektnr, ikke som egen jobb-rad.
      let rader = (timer || []).filter(erEkteTimerJobb);
      rader.sort(function (a, b) {
        const da = String(a.dato || a.created_at || "");
        const db = String(b.dato || b.created_at || "");
        if (da !== db) return db.localeCompare(da);
        return Number(b.id || 0) - Number(a.id || 0);
      });
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
