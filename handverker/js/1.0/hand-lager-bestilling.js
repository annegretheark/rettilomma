console.log("hand-lager-bestilling.js PROD 20260621 lastet");

(function () {
  "use strict";

  function el(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function tall(v) {
    const n = Number(String(v ?? "0").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const x = c === "x" ? r : (r & 0x3 | 0x8);
      return x.toString(16);
    });
  }

  function melding(tekst, feil) {
    const e = el("bilMelding") || el("lagerbestillingMelding");
    if (e) {
      e.textContent = tekst || "";
      e.style.color = feil ? "#fca5a5" : "#86efac";
    }
    if (feil) console.error(tekst);
    else if (tekst) console.log(tekst);
  }

  async function hentInnlogget() {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data || !data.user) throw new Error("Du er ikke innlogget.");
    return data.user;
  }

  async function hentFirmaBruker() {
    const user = await hentInnlogget();

    const { data, error } = await supabaseClient
      .from("hand_firma_bruker")
      .select("firma_id, rolle, epost")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (error || !data || !data.firma_id) {
      throw new Error("Brukeren er ikke koblet til firma i hand_firma_bruker.");
    }

    return {
      user,
      firma_id: data.firma_id,
      rolle: String(data.rolle || "").toLowerCase(),
      epost: data.epost || user.email || ""
    };
  }

  function erAdminRolle(rolle) {
    return ["admin", "eier"].includes(String(rolle || "").toLowerCase());
  }

  function valgtBilId() {
    return el("bilLagerBilValg")?.value || localStorage.getItem("aktivBilId") || window.aktivBilId || "";
  }

  function valgtBilNavn() {
    const s = el("bilLagerBilValg");
    if (s && s.value) return s.selectedOptions?.[0]?.textContent || "";
    return localStorage.getItem("aktivBilNavn") || "";
  }

  function finnVare(vareId) {
    const liste = Array.isArray(window.varerTilBilLager) ? window.varerTilBilLager : [];
    return liste.find(v => String(v.id) === String(vareId)) || null;
  }

  function vareNavn(v) {
    if (typeof window.vareNavn === "function") {
      try { return window.vareNavn(v); } catch (_) {}
    }
    return `${v?.varenr ? v.varenr + " - " : ""}${v?.navn || v?.varenavn || v?.beskrivelse || "Vare"}`;
  }

  function vareNr(v) {
    if (typeof window.vareNr === "function") {
      try { return window.vareNr(v); } catch (_) {}
    }
    return v?.varenr || "";
  }

  function beholdning(v) {
    if (typeof window.vareHovedlager === "function") {
      try { return Number(window.vareHovedlager(v)); } catch (_) {}
    }
    return Number(v?.lager_antall ?? v?.antall ?? v?.beholdning ?? 0);
  }

  function hentBestillingsRaderFraSkjerm() {
    const rader = [];

    document.querySelectorAll(".bil-lager-antall-liste").forEach(input => {
      const vareId = input.dataset.vareId || "";
      const antall = tall(input.value);

      if (!vareId || antall <= 0 || !Number.isInteger(antall)) return;

      const minInput = document.querySelector('.bil-lager-min-liste[data-vare-id="' + CSS.escape(vareId) + '"]');
      const vare = finnVare(vareId);

      rader.push({
        vare_id: vareId,
        varenr: vareNr(vare) || null,
        varenavn: vareNavn(vare),
        antall_bestilt: antall,
        minimum_bil: tall(minInput?.value),
        hovedlager_ved_bestilling: beholdning(vare)
      });
    });

    return rader;
  }

  async function opprettLagerbestillingFraFyllListe() {
    // 2026-06-27: Send til admin skal bruke ny hand_bil_bestilling-flyt.
    // Denne filen kan fortsatt være lastet i appen, så vi videresender trygt
    // i stedet for å skrive til gammel/alternativ lagerbestillingstabell.
    if (typeof window.opprettBilLagerBestillingListe === "function") {
      return window.opprettBilLagerBestillingListe();
    }
    try {
      if (!window.supabaseClient) {
        melding("Supabase er ikke lastet.", true);
        return;
      }

      const bilId = valgtBilId();
      if (!bilId) {
        melding("Velg bil først.", true);
        return;
      }

      const rader = hentBestillingsRaderFraSkjerm();
      if (!rader.length) {
        melding("Skriv antall på minst én vare.", true);
        return;
      }

      const fb = await hentFirmaBruker();
      const bilnavn = valgtBilNavn();

      const insertRader = rader.map(r => ({
        id: uuid(),
        firma_id: fb.firma_id,
        bil_id: bilId,
        bil_navn: bilnavn || null,
        vare_id: r.vare_id,
        varenr: r.varenr,
        varenavn: r.varenavn,
        antall_bestilt: r.antall_bestilt,
        antall_levert: 0,
        minimum_bil: r.minimum_bil || 0,
        hovedlager_ved_bestilling: r.hovedlager_ved_bestilling || 0,
        bestilt_av_user_id: fb.user.id,
        bestilt_av_epost: fb.epost || null,
        bestilt_av_navn: fb.user.user_metadata?.full_name || fb.user.user_metadata?.name || fb.epost || null,
        status: "ny"
      }));

      const { error } = await supabaseClient
        .from("hand_lager_bestilling")
        .insert(insertRader);

      if (error) {
        melding("Kunne ikke sende lagerbestilling: " + error.message, true);
        return;
      }

      document.querySelectorAll(".bil-lager-antall-liste, .bil-lager-min-liste").forEach(i => i.value = "");

      melding("Lagerbestilling sendt. Admin kan nå levere fra admin-listen.");
      await lastLagerbestillinger();
    } catch (e) {
      melding("Lagerbestilling feilet: " + (e.message || String(e)), true);
    }
  }

  async function hentBestillinger() {
    const fb = await hentFirmaBruker();
    const admin = erAdminRolle(fb.rolle);

    let q = supabaseClient
      .from("hand_lager_bestilling")
      .select("*")
      .eq("firma_id", fb.firma_id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!admin) q = q.eq("bestilt_av_user_id", fb.user.id);

    const { data, error } = await q;
    if (error) throw error;

    return { data: data || [], admin, fb };
  }

  function statusTekst(status) {
    const s = String(status || "ny");
    if (s === "ny") return "Venter";
    if (s === "delvis_levert") return "Delvis levert";
    if (s === "levert") return "Levert";
    if (s === "mangler") return "Mangler";
    return s;
  }

  function dato(v) {
    if (!v) return "";
    try { return new Date(v).toLocaleString("no-NO"); } catch (_) { return String(v); }
  }

  function tegnMineBestillinger(rader) {
    const c = el("mineLagerbestillingerListe");
    if (!c) return;

    if (!rader.length) {
      c.innerHTML = '<p class="info">Ingen egne lagerbestillinger ennå.</p>';
      return;
    }

    c.innerHTML = `
      <table class="bil-tabell">
        <thead>
          <tr>
            <th>Dato</th>
            <th>Bil</th>
            <th>Vare</th>
            <th>Bestilt</th>
            <th>Levert</th>
            <th>Mangler</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rader.map(r => {
            const bestilt = Number(r.antall_bestilt || 0);
            const levert = Number(r.antall_levert || 0);
            const mangler = Math.max(0, bestilt - levert);
            return `
              <tr>
                <td>${esc(dato(r.created_at))}</td>
                <td>${esc(r.bil_navn || "")}</td>
                <td>${esc((r.varenr ? r.varenr + " - " : "") + (r.varenavn || ""))}</td>
                <td>${esc(bestilt)}</td>
                <td>${esc(levert)}</td>
                <td>${esc(mangler)}</td>
                <td>${esc(statusTekst(r.status))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  function tegnAdminBestillinger(rader) {
    const panel = el("adminLagerbestillingerPanel");
    const c = el("adminLagerbestillingerListe");
    if (!panel || !c) return;

    panel.style.display = "";

    const aktive = rader.filter(r => !["levert", "ferdig", "mottatt", "avsluttet", "arkivert", "lukket", "lagt_pa_bil"].includes(String(r.status || "ny").toLowerCase()) && r.arkivert !== true && r.lukket !== true && r.lagt_pa_bil !== true);

    if (!aktive.length) {
      c.innerHTML = '<p class="info">Ingen åpne lagerbestillinger.</p>';
      tegnMangellistePdf([]);
      return;
    }

    c.innerHTML = `
      <table class="bil-tabell">
        <thead>
          <tr>
            <th>Lever</th>
            <th>Bestilt av</th>
            <th>Bil</th>
            <th>Vare</th>
            <th>Bestilt</th>
            <th>Levert før</th>
            <th>Leveres nå</th>
            <th>Mangler etterpå</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${aktive.map(r => {
            const bestilt = Number(r.antall_bestilt || 0);
            const levert = Number(r.antall_levert || 0);
            const rest = Math.max(0, bestilt - levert);
            const forslag = rest;
            return `
              <tr data-bestilling-id="${esc(r.id)}" data-rest="${esc(rest)}">
                <td><input class="lagerbestilling-lever-check" type="checkbox" data-id="${esc(r.id)}"></td>
                <td>${esc(r.bestilt_av_navn || r.bestilt_av_epost || "")}</td>
                <td>${esc(r.bil_navn || "")}</td>
                <td>${esc((r.varenr ? r.varenr + " - " : "") + (r.varenavn || ""))}</td>
                <td>${esc(bestilt)}</td>
                <td>${esc(levert)}</td>
                <td>
                  <input class="lagerbestilling-lever-antall" data-id="${esc(r.id)}" type="number" min="0" step="1" value="${esc(forslag)}" style="width:80px;">
                </td>
                <td class="lagerbestilling-mangler-etter">${esc(Math.max(0, rest - forslag))}</td>
                <td>${esc(statusTekst(r.status))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;

    c.querySelectorAll(".lagerbestilling-lever-antall").forEach(input => {
      input.addEventListener("input", function () {
        const tr = this.closest("tr");
        const rest = Number(tr?.dataset?.rest || 0);
        const levert = Math.max(0, Math.min(rest, tall(this.value)));
        const cell = tr?.querySelector(".lagerbestilling-mangler-etter");
        if (cell) cell.textContent = String(Math.max(0, rest - levert));
      });
    });

    tegnMangellistePdf(aktive);
  }

  function tegnMangellistePdf(rader) {
    const c = el("lagerbestillingManglerPdfOmrade");
    if (!c) return;

    const mangler = (rader || []).filter(r => {
      const bestilt = Number(r.antall_bestilt || 0);
      const levert = Number(r.antall_levert || 0);
      return bestilt - levert > 0;
    });

    if (!mangler.length) {
      c.innerHTML = "";
      return;
    }

    c.innerHTML = `
      <button id="lagMangellistePdfKnapp" type="button" class="secondary">Lag PDF over mangler</button>
    `;

    const knapp = el("lagMangellistePdfKnapp");
    if (knapp) knapp.onclick = function () { lagMangellistePdf(mangler); };
  }

  function lagMangellistePdf(rader) {
    const mangler = (rader || []).map(r => ({
      bruker: r.bestilt_av_navn || r.bestilt_av_epost || "",
      bil: r.bil_navn || "",
      vare: (r.varenr ? r.varenr + " - " : "") + (r.varenavn || ""),
      bestilt: Number(r.antall_bestilt || 0),
      levert: Number(r.antall_levert || 0),
      mangler: Math.max(0, Number(r.antall_bestilt || 0) - Number(r.antall_levert || 0))
    })).filter(r => r.mangler > 0);

    if (!mangler.length) {
      alert("Ingen mangler å lage PDF av.");
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`
        <html><head><title>Mangelliste lager</title></head><body>
          <h2>Mangelliste lager</h2>
          <table border="1" cellspacing="0" cellpadding="5">
            <thead><tr><th>Bruker</th><th>Bil</th><th>Vare</th><th>Bestilt</th><th>Levert</th><th>Mangler</th></tr></thead>
            <tbody>${mangler.map(r => `<tr><td>${esc(r.bruker)}</td><td>${esc(r.bil)}</td><td>${esc(r.vare)}</td><td>${r.bestilt}</td><td>${r.levert}</td><td>${r.mangler}</td></tr>`).join("")}</tbody>
          </table>
        </body></html>
      `);
      w.document.close();
      w.print();
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = 14;

    function nySide(h) {
      if (y + h > 285) {
        doc.addPage();
        y = 14;
      }
    }

    doc.setFontSize(16);
    doc.text("Mangelliste lager", 12, y);
    y += 8;

    doc.setFontSize(9);
    doc.text("Dato: " + new Date().toLocaleString("no-NO"), 12, y);
    y += 8;

    doc.setFont(undefined, "bold");
    doc.text("Bruker", 12, y);
    doc.text("Bil", 48, y);
    doc.text("Vare", 82, y);
    doc.text("Mangler", 180, y, { align: "right" });
    y += 4;
    doc.line(12, y, 198, y);
    y += 4;
    doc.setFont(undefined, "normal");

    mangler.forEach(r => {
      nySide(10);
      const vareLinjer = doc.splitTextToSize(String(r.vare || ""), 88);
      doc.text(String(r.bruker || "").slice(0, 22), 12, y);
      doc.text(String(r.bil || "").slice(0, 20), 48, y);
      doc.text(vareLinjer, 82, y);
      doc.text(String(r.mangler), 190, y, { align: "right" });
      y += Math.max(6, vareLinjer.length * 4);
    });

    doc.save("mangelliste-lager.pdf");
  }

  async function utførAdminLevering() {
    try {
      const { data: bestillinger, admin } = await hentBestillinger();
      if (!admin) {
        melding("Bare admin kan levere lagerbestillinger.", true);
        return;
      }

      const valgte = Array.from(document.querySelectorAll(".lagerbestilling-lever-check:checked"))
        .map(chk => {
          const id = chk.dataset.id;
          const input = document.querySelector('.lagerbestilling-lever-antall[data-id="' + CSS.escape(id) + '"]');
          return { id, antall: tall(input?.value) };
        })
        .filter(x => x.id && x.antall > 0 && Number.isInteger(x.antall));

      if (!valgte.length) {
        melding("Kryss av minst én linje og skriv antall som skal leveres.", true);
        return;
      }

      const map = new Map(bestillinger.map(b => [String(b.id), b]));
      let levertLinjer = 0;
      let manglerTotalt = 0;

      for (const v of valgte) {
        const b = map.get(String(v.id));
        if (!b) continue;

        const bestilt = Number(b.antall_bestilt || 0);
        const levertFraFor = Number(b.antall_levert || 0);
        const rest = Math.max(0, bestilt - levertFraFor);
        const leveresNa = Math.min(rest, v.antall);

        if (leveresNa <= 0) continue;

        const { data: vare, error: vareError } = await supabaseClient
          .from("hand_vare")
          .select("*")
          .eq("id", b.vare_id)
          .single();

        if (vareError || !vare) {
          throw new Error("Fant ikke varen " + (b.varenavn || b.vare_id));
        }

        const lagerFor = Number(vare.lager_antall ?? vare.antall ?? vare.beholdning ?? 0);
        const faktiskLevering = Math.min(leveresNa, lagerFor);
        const mangler = Math.max(0, rest - faktiskLevering);
        manglerTotalt += mangler;

        if (faktiskLevering <= 0) {
          await supabaseClient
            .from("hand_lager_bestilling")
            .update({ status: "mangler", updated_at: new Date().toISOString() })
            .eq("id", b.id);
          continue;
        }

        const { data: eksisterende, error: sjekkError } = await supabaseClient
          .from("hand_bil_lager")
          .select("id, antall, minimum_antall")
          .eq("bil_id", b.bil_id)
          .eq("vare_id", b.vare_id)
          .limit(1);

        if (sjekkError) throw sjekkError;

        if (eksisterende && eksisterende.length) {
          const nyAntall = Number(eksisterende[0].antall || 0) + faktiskLevering;
          const nyMinimum = Number(b.minimum_bil || eksisterende[0].minimum_antall || 0);
          const { error } = await supabaseClient
            .from("hand_bil_lager")
            .update({ antall: nyAntall, minimum_antall: nyMinimum })
            .eq("id", eksisterende[0].id);
          if (error) throw error;
        } else {
          const { error } = await supabaseClient
            .from("hand_bil_lager")
            .insert([{
              bil_id: b.bil_id,
              vare_id: b.vare_id,
              antall: faktiskLevering,
              minimum_antall: Number(b.minimum_bil || 0)
            }]);
          if (error) throw error;
        }

        const lagerEtter = Math.max(0, lagerFor - faktiskLevering);
        const { error: vareUpdateError } = await supabaseClient
          .from("hand_vare")
          .update({ lager_antall: lagerEtter })
          .eq("id", b.vare_id);
        if (vareUpdateError) throw vareUpdateError;

        const nyLevert = levertFraFor + faktiskLevering;
        const nyStatus = nyLevert >= bestilt ? "levert" : "delvis_levert";

        const { error: bestillingError } = await supabaseClient
          .from("hand_lager_bestilling")
          .update({
            antall_levert: nyLevert,
            status: nyStatus,
            levert_av_user_id: (await hentInnlogget()).id,
            levert_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", b.id);
        if (bestillingError) throw bestillingError;

        try {
          const u = await hentInnlogget();
          let ansattId = null;
          let hentetAv = u.email || '';
          try {
            const ar = await supabaseClient.from('hand_ansatt').select('id,navn,epost').ilike('epost', u.email || '').limit(1).maybeSingle();
            if (!ar.error && ar.data) { ansattId = ar.data.id || null; hentetAv = ar.data.navn || ar.data.epost || hentetAv; }
          } catch (_) {}
          await supabaseClient.from("hand_lager_bevegelse").insert([{
            type: nyStatus === "levert" ? "lagerbestilling_levert" : "lagerbestilling_delvis_levert",
            bil_id: b.bil_id,
            vare_id: b.vare_id,
            antall: faktiskLevering,
            ansatt_id: ansattId,
            kommentar: 'Hentet av: ' + hentetAv,
            created_at: new Date().toISOString()
          }]);
        } catch (loggFeil) {
          console.warn("Lagerbevegelse ble ikke skrevet:", loggFeil);
        }

        levertLinjer++;
      }

      melding("Levering utført. Linjer levert: " + levertLinjer + (manglerTotalt ? ". Mangler fortsatt: " + manglerTotalt : "."));
      await lastLagerbestillinger();

      if (typeof window.lastBilerOgBilLager === "function") {
        try { await window.lastBilerOgBilLager(); } catch (e) { console.warn(e); }
      }
    } catch (e) {
      melding("Levering feilet: " + (e.message || String(e)), true);
    }
  }

  async function lastLagerbestillinger() {
    try {
      if (!window.supabaseClient) return;

      const { data, admin } = await hentBestillinger();

      tegnMineBestillinger(data);

      const adminPanel = el("adminLagerbestillingerPanel");
      if (adminPanel) adminPanel.style.display = admin ? "" : "none";

      if (admin) tegnAdminBestillinger(data);
    } catch (e) {
      console.warn("Kunne ikke laste lagerbestillinger:", e);
      const c = el("mineLagerbestillingerListe");
      if (c) c.innerHTML = '<p class="melding">Kunne ikke laste lagerbestillinger: ' + esc(e.message || e) + '</p>';
    }
  }

  function kobleKnapper() {
    let send = el("sendBilLagerBestillingKnapp");
    const lagre = el("lagreBilLagerListeKnapp");
    if (!send && lagre && lagre.parentNode) {
      send = document.createElement("button");
      send.id = "sendBilLagerBestillingKnapp";
      send.type = "button";
      send.className = "secondary";
      lagre.parentNode.insertBefore(send, lagre);
    }
    if (send && send.dataset.lagerbestillingProd !== "1") {
      send.dataset.lagerbestillingProd = "1";
      send.textContent = "Send bestilling til admin";
      send.onclick = function (event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (typeof window.opprettBilLagerBestillingListe === "function") {
          return window.opprettBilLagerBestillingListe();
        }
        return opprettLagerbestillingFraFyllListe();
      };
    }
    if (lagre) lagre.textContent = "Bekreft mottatt og legg på bil";

    const oppdater = el("oppdaterLagerbestillingerKnapp");
    if (oppdater) oppdater.onclick = lastLagerbestillinger;

    const lever = el("leverLagerbestillingerKnapp");
    if (lever) lever.onclick = utførAdminLevering;
  }

  function init() {
    kobleKnapper();
    setTimeout(kobleKnapper, 300);
    setTimeout(kobleKnapper, 1000);
    setTimeout(lastLagerbestillinger, 500);
    setTimeout(lastLagerbestillinger, 1500);
  }

  window.handOpprettLagerbestillingFraFyllListe = opprettLagerbestillingFraFyllListe;
  window.handLastLagerbestillinger = lastLagerbestillinger;
  window.handUtførAdminLagerlevering = utførAdminLevering;
  window.handLagMangellistePdf = lagMangellistePdf;

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("handPartialerLastet", init);
  window.addEventListener("load", init);
})();
