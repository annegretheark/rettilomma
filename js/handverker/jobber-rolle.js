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
          .from("prosjekter")
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
          .from("ansatte")
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
    return window.RIL_TIMER_TABELL || "timer";
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
        .from("timer_bilder")
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
        .from("timer_bilder")
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

    oppdaterJobbBilder(id, rad);
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
