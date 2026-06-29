(function () {
  const BUCKET = "bilder";

  function el(id) {
    return document.getElementById(id);
  }

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function num(v) {
    if (v === "" || v === null || v === undefined) return 0;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function kr(v) {
    return num(v).toLocaleString("no-NO", { maximumFractionDigits: 2 });
  }

  function melding(id, tekst, feil) {
    const m = el(id);
    if (!m) return;
    m.textContent = tekst || "";
    m.style.color = feil ? "#fca5a5" : "#86efac";
  }

  async function client() {
    for (let i = 0; i < 100; i++) {
      if (window.supabaseClient) return window.supabaseClient;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("Supabase er ikke klar.");
  }

  function aktivBehandlerId() {
    return window.behInnloggetBehandlerId || window.behInnloggetBehandler?.id || "";
  }

  async function finnInnloggetBehandlerHvisMangler() {
    if (window.behErSystemeier || aktivBehandlerId()) return aktivBehandlerId();
    const c = await client();
    const sessionRes = await c.auth.getSession();
    const user = sessionRes?.data?.session?.user || null;
    const epost = user?.email || "";
    if (!epost) return "";

    let r = null;
    if (user.id) {
      r = await c.from("beh_behandlere")
        .select("id,navn,epost,rolle,aktiv,auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
    }

    if ((!r || r.error || !r.data) && epost) {
      r = await c.from("beh_behandlere")
        .select("id,navn,epost,rolle,aktiv,auth_user_id")
        .ilike("epost", epost)
        .maybeSingle();
    }

    if (r?.data) {
      window.behInnloggetBehandler = r.data;
      window.behInnloggetBehandlerId = r.data.id || "";
      const rolle = String(r.data.rolle || "").toLowerCase();
      if (rolle === "systemeier" || rolle === "admin") window.behErSystemeier = true;
    }

    return aktivBehandlerId();
  }

  function medBehandler(rad) {
    const id = aktivBehandlerId();
    return id ? { ...rad, behandler_id: id } : rad;
  }

  function skalFiltrereEgneData() {
    return !window.behErSystemeier && !!aktivBehandlerId();
  }

  function egneRader(rader) {
    if (!skalFiltrereEgneData()) return rader || [];
    const id = String(aktivBehandlerId());
    return (rader || []).filter(rad => !rad.behandler_id || String(rad.behandler_id) === id);
  }

  function leggBehandlerFilter(query) {
    if (!skalFiltrereEgneData()) return query;
    return query.eq("behandler_id", aktivBehandlerId());
  }

  function tryggFilnavn(navn) {
    return String(navn || "bilde.jpg")
      .replaceAll(" ", "_")
      .replace(/[æøåÆØÅ]/g, b => ({ æ: "ae", ø: "o", å: "a", Æ: "Ae", Ø: "O", Å: "A" }[b] || b))
      .replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  function hentBehandlingFiler() {
    const filer = [];
    const kamera = el("behandlingBildeKamera");
    const galleri = el("behandlingBildeGalleri");
    if (kamera?.files?.length) filer.push(...Array.from(kamera.files));
    if (galleri?.files?.length) filer.push(...Array.from(galleri.files));
    return filer;
  }

  function tomBildeFelter() {
    const kamera = el("behandlingBildeKamera");
    const galleri = el("behandlingBildeGalleri");
    if (kamera) kamera.value = "";
    if (galleri) galleri.value = "";
  }

  async function lastOppBehandlingBilder(behandlingId, filer, tekst) {
    if (!behandlingId || !filer.length) return 0;
    const c = await client();
    let antall = 0;

    for (const [index, fil] of filer.entries()) {
      const sti = `beh-behandlinger/${behandlingId}/${Date.now()}_${index}_${tryggFilnavn(fil.name)}`;
      const up = await c.storage.from(BUCKET).upload(sti, fil, {
        cacheControl: "3600",
        upsert: false,
        contentType: fil.type || "image/jpeg"
      });
      if (up.error) throw up.error;

      const pub = c.storage.from(BUCKET).getPublicUrl(sti);
      const row = {
        behandling_id: behandlingId,
        filnavn: fil.name || "bilde.jpg",
        filsti: sti,
        bilde_url: pub.data?.publicUrl || null,
        bildetekst: tekst || "Bilde fra behandling"
      };

      const ins = await c.from("beh_behandling_bilder").insert([medBehandler(row)]);
      if (ins.error) throw ins.error;
      antall += 1;
    }

    return antall;
  }

  async function hentPriser() {
    const c = await client();
    const r = await c.from("beh_priser")
      .select("id, navn, pris, sortering, aktiv")
      .order("sortering", { ascending: true })
      .order("navn", { ascending: true });
    if (r.error) throw r.error;
    return (r.data || []).filter(p => p.aktiv !== false);
  }

  async function fyllPriser(force) {
    const select = el("behandlingType");
    if (!select) return [];
    if (!force && select.dataset.featurePrisLastet === "1" && select.options.length > 1) return window.behFeaturePriser || [];

    const valgt = select.value || "";
    const priser = await hentPriser();
    window.behFeaturePriser = priser;
    select.dataset.featurePrisLastet = "1";

    select.innerHTML = '<option value="">Velg behandlingstype</option>';
    for (const p of priser) {
      const opt = document.createElement("option");
      opt.value = p.navn || "";
      opt.textContent = `${p.navn || "Uten navn"} - ${kr(p.pris)} kr`;
      opt.dataset.pris = String(num(p.pris));
      opt.dataset.prisId = p.id || "";
      select.appendChild(opt);
    }

    if (valgt && priser.some(p => String(p.navn) === String(valgt))) {
      select.value = valgt;
    }

    if (!priser.length) {
      melding("behandlingMelding", "Fant ingen priser i beh_priser. Legg inn priser i Prisliste.", true);
    }
    return priser;
  }

  async function settPrisFraValg() {
    const select = el("behandlingType");
    const arbeid = el("arbeidBelop");
    const auto = el("behandlingPrisAuto");
    if (!select || !arbeid || !select.value) return false;

    const priser = await fyllPriser(false);
    const rad = priser.find(p => String(p.navn || "").trim().toLowerCase() === String(select.value || "").trim().toLowerCase());
    const pris = rad ? num(rad.pris) : num(select.selectedOptions?.[0]?.dataset?.pris);

    arbeid.value = pris ? String(pris) : "";
    if (auto) auto.value = pris ? String(pris) : "";
    melding("behandlingMelding", rad ? `Pris hentet: ${kr(pris)} kr` : "Fant ikke pris for valgt behandling.", !rad);
    return false;
  }

  function blankKjoring() {
    const km = el("behandlingKm");
    const kmPris = el("behandlingKmPris");
    if (km && (km.value === "0" || km.value === "0.0")) km.value = "";
    if (kmPris && (kmPris.value === "0" || kmPris.value === "5.30")) kmPris.value = "";
  }

  async function lagreBehandlingDirekte(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const c = await client();
    const kundeId = el("behandlingKunde")?.value || "";
    const hestId = el("behandlingHest")?.value || "";
    const dato = el("behandlingDato")?.value || new Date().toISOString().slice(0, 10);
    const redigerId = window.behValgtBehandlingId || "";

    if (!kundeId) { melding("behandlingMelding", "Velg kunde først.", true); return false; }
    if (!hestId) { melding("behandlingMelding", "Velg dyr først.", true); return false; }

    const sjekk = await c.from("beh_hester").select("id,kunde_id,navn").eq("id", hestId).maybeSingle();
    if (sjekk.error) throw sjekk.error;
    if (!sjekk.data) { melding("behandlingMelding", "Fant ikke valgt dyr.", true); return false; }
    if (String(sjekk.data.kunde_id) !== String(kundeId)) {
      melding("behandlingMelding", "Feil dyr/eier: " + (sjekk.data.navn || "valgt dyr") + " tilhører ikke valgt kunde.", true);
      return false;
    }

    const arbeid = num(el("behandlingPrisAuto")?.value || el("arbeidBelop")?.value);
    const varer = num(el("varerBelop")?.value);
    const km = num(el("behandlingKm")?.value);
    const kmPris = num(el("behandlingKmPris")?.value);
    const eksMva = arbeid + varer + (km * kmPris);
    const mva = eksMva * 0.25;
    const total = eksMva + mva;

    const rad = medBehandler({
      kunde_id: kundeId,
      hest_id: hestId,
      dato,
      behandlingtype: el("behandlingType")?.value || "",
      beskrivelse: el("behandlingBeskrivelse")?.value.trim() || "",
      km,
      km_pris: kmPris,
      arbeid_belop: arbeid,
      varer_belop: varer,
      mva,
      total,
      fakturert: false
    });

    melding("behandlingMelding", redigerId ? "Oppdaterer behandling ..." : "Lagrer behandling ...", false);
    const res = redigerId
      ? await c.from("beh_behandlinger").update(rad).eq("id", redigerId).select("*").single()
      : await c.from("beh_behandlinger").insert([rad]).select("*").single();
    if (res.error) {
      melding("behandlingMelding", "Kunne ikke lagre behandling: " + (res.error.message || JSON.stringify(res.error)), true);
      return false;
    }

    const filer = hentBehandlingFiler();
    let bildeAntall = 0;
    if (filer.length) {
      try {
        bildeAntall = await lastOppBehandlingBilder(res.data.id, filer, redigerId ? "Nytt bilde fra behandling" : "Bilde fra behandling");
        tomBildeFelter();
      } catch (e) {
        melding("behandlingMelding", "Behandling lagret, men bilde feilet: " + (e.message || e), true);
        return false;
      }
    }

    await c.from("beh_hester").update({ sist_skodd: dato }).eq("id", hestId);
    if (typeof window.hentAlleHesterFraBase === "function") await window.hentAlleHesterFraBase();
    if (typeof window.hentHester === "function") await window.hentHester();
    if (typeof window.hentBehandlinger === "function") await window.hentBehandlinger();

    window.behValgtBehandlingId = "";
    const lagreKnapp = el("lagreBehandlingKnapp");
    if (lagreKnapp) lagreKnapp.textContent = "Lagre behandling";

    ["behandlingBeskrivelse", "behandlingKm", "behandlingKmPris", "arbeidBelop", "varerBelop", "behandlingPrisAuto"].forEach(id => {
      const felt = el(id);
      if (felt) felt.value = "";
    });

    melding("behandlingMelding", bildeAntall
      ? `${redigerId ? "Behandling oppdatert" : "Behandling lagret"} med ${bildeAntall} bilde(r).`
      : (redigerId ? "Behandling oppdatert." : "Behandling lagret."), false);
    return false;
  }

  function settSelectVerdi(selectId, verdi, tekst) {
    const select = el(selectId);
    if (!select) return;
    const v = String(verdi || "");
    if (v && !Array.from(select.options).some(o => String(o.value) === v)) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = tekst || v;
      select.appendChild(opt);
    }
    select.value = v;
  }

  async function visBehandlingDetalj(id) {
    if (!id) return false;
    const c = await client();
    const r = await c.from("beh_behandlinger")
      .select("id,dato,behandlingtype,beskrivelse,arbeid_belop,varer_belop,km,km_pris,kunde_id,hest_id,kunder:beh_kunder(id,navn),hester:beh_hester(id,navn,kunde_id)")
      .eq("id", id)
      .maybeSingle();

    if (r.error) {
      melding("behandlingMelding", "Kunne ikke hente behandling: " + (r.error.message || JSON.stringify(r.error)), true);
      return false;
    }
    if (!r.data) {
      melding("behandlingMelding", "Fant ikke behandlingen.", true);
      return false;
    }

    const b = r.data;
    window.behValgtBehandlingId = b.id;

    const kundeId = b.kunde_id || b.hester?.kunde_id || "";
    settSelectVerdi("behandlingKunde", kundeId, b.kunder?.navn || "Valgt kunde");
    const kundeSelect = el("behandlingKunde");
    if (kundeSelect) kundeSelect.dispatchEvent(new Event("change", { bubbles: true }));

    setTimeout(() => {
      settSelectVerdi("behandlingHest", b.hest_id, b.hester?.navn || "Valgt dyr");
    }, 80);
    settSelectVerdi("behandlingHest", b.hest_id, b.hester?.navn || "Valgt dyr");

    if (el("behandlingDato")) el("behandlingDato").value = b.dato ? String(b.dato).slice(0, 10) : "";
    settSelectVerdi("behandlingType", b.behandlingtype || "", b.behandlingtype || "Valgt behandling");
    if (el("behandlingBeskrivelse")) el("behandlingBeskrivelse").value = b.beskrivelse || "";
    if (el("arbeidBelop")) el("arbeidBelop").value = b.arbeid_belop ?? "";
    if (el("varerBelop")) el("varerBelop").value = b.varer_belop ?? "";
    if (el("behandlingKm")) el("behandlingKm").value = b.km ? b.km : "";
    if (el("behandlingKmPris")) el("behandlingKmPris").value = b.km_pris ? b.km_pris : "";
    if (el("behandlingPrisAuto")) el("behandlingPrisAuto").value = b.arbeid_belop ?? "";

    const manuell = el("manuellBehandling");
    if (manuell) manuell.classList.remove("skjult");
    const lagreKnapp = el("lagreBehandlingKnapp");
    if (lagreKnapp) lagreKnapp.textContent = "Lagre endringer";
    el("behandlingDato")?.scrollIntoView({ behavior: "smooth", block: "start" });
    melding("behandlingMelding", "Redigerer behandling. Trykk Lagre endringer når du er ferdig.", false);
    return false;
  }

  async function visAlleBilderForHest(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const hestId = el("hestVelg")?.value || el("behandlingHest")?.value || "";
    const panel = sikreHestBildePanel();
    if (!hestId) {
      panel.innerHTML = '<div class="info">Velg et dyr først.</div>';
      return false;
    }

    const c = await client();
    panel.innerHTML = '<div class="info">Henter bilder ...</div>';

    const hestRes = await leggBehandlerFilter(c.from("beh_hester").select("id,navn,bilde_url,behandler_id")).eq("id", hestId).maybeSingle();
    if (hestRes.error) throw hestRes.error;

    const behRes = await leggBehandlerFilter(c.from("beh_behandlinger").select("id,dato,behandlingtype,behandler_id")).eq("hest_id", hestId).order("dato", { ascending: false });
    if (behRes.error) throw behRes.error;
    const behandlinger = behRes.data || [];
    const ids = behandlinger.map(b => b.id).filter(Boolean);

    let bilder = [];
    if (ids.length) {
      const bRes = await leggBehandlerFilter(c.from("beh_behandling_bilder")
        .select("id,behandling_id,filsti,bilde_url,bildetekst,created_at")
        .in("behandling_id", ids))
        .order("created_at", { ascending: false });
      if (bRes.error) throw bRes.error;
      bilder = bRes.data || [];
    }

    const behMap = new Map(behandlinger.map(b => [String(b.id), b]));
    const hestBilde = hestRes.data?.bilde_url
      ? [{ url: hestRes.data.bilde_url, tekst: "Profilbilde", dato: "" }]
      : [];
    const behandlingsBilder = bilder.map(b => {
      const beh = behMap.get(String(b.behandling_id)) || {};
      return {
        url: b.bilde_url,
        tekst: b.bildetekst || beh.behandlingtype || "Behandling",
        dato: beh.dato || ""
      };
    }).filter(b => b.url);
    const alle = [...hestBilde, ...behandlingsBilder];

    panel.innerHTML = `
      <div class="listekort">
        <h3 style="margin-top:0;">Bilder for ${esc(hestRes.data?.navn || "valgt dyr")} (${alle.length})</h3>
        ${alle.length ? `
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${alle.map(b => `
              <a href="${esc(b.url)}" target="_blank" style="color:inherit;text-decoration:none;width:150px;">
                <img src="${esc(b.url)}" alt="Bilde" style="width:150px;height:115px;object-fit:cover;border-radius:10px;border:1px solid #374151;display:block;">
                <small>${esc(b.dato ? b.dato + " - " + b.tekst : b.tekst)}</small>
              </a>
            `).join("")}
          </div>
        ` : '<div class="info">Ingen bilder funnet på dette dyret.</div>'}
      </div>
    `;
    return false;
  }

  function sikreHestBildePanel() {
    let panel = el("hestAlleBilderPanel");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "hestAlleBilderPanel";
    const liste = el("hesteListe");
    if (liste?.parentNode) liste.parentNode.insertBefore(panel, liste);
    else el("hesterSide")?.appendChild(panel);
    return panel;
  }

  function leggTilHestBildeKnapp() {
    if (el("visAlleHestBilderKnapp")) return;
    const hestVelg = el("hestVelg");
    if (!hestVelg?.parentNode) return;
    const knapp = document.createElement("button");
    knapp.id = "visAlleHestBilderKnapp";
    knapp.type = "button";
    knapp.className = "secondary";
    knapp.style.marginTop = "8px";
    knapp.textContent = "Vis alle bilder på valgt dyr";
    knapp.addEventListener("click", visAlleBilderForHest);
    hestVelg.parentNode.insertBefore(knapp, hestVelg.nextSibling);
  }

  function leggTilFakturaMenyKnapp() {
    const meny = document.querySelector(".app-meny-linje");
    if (!meny || document.getElementById("featureFakturaMenyKnapp")) return;
    const knapp = document.createElement("a");
    knapp.id = "featureFakturaMenyKnapp";
    knapp.className = "knapp";
    knapp.href = "#fakturaSide";
    knapp.textContent = "Faktura";
    knapp.addEventListener("click", () => {
      setTimeout(() => {
        el("fakturaSide")?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (typeof window.fyllFakturaKunder === "function") window.fyllFakturaKunder();
      }, 80);
    });
    const admin = Array.from(meny.querySelectorAll("a")).find(a => String(a.getAttribute("href") || "") === "#adminSide");
    if (admin) meny.insertBefore(knapp, admin);
    else meny.appendChild(knapp);
  }

  function fyllSelectMedRader(select, rader, placeholder) {
    if (!select) return;
    const valgt = select.value || "";
    select.innerHTML = "";
    const tom = document.createElement("option");
    tom.value = "";
    tom.textContent = placeholder;
    select.appendChild(tom);
    for (const rad of rader || []) {
      const opt = document.createElement("option");
      opt.value = rad.id || "";
      opt.textContent = rad.navn || "Uten navn";
      if (rad.kunde_id) opt.dataset.kundeId = rad.kunde_id;
      select.appendChild(opt);
    }
    if (valgt && Array.from(select.options).some(o => String(o.value) === String(valgt))) {
      select.value = valgt;
    }
  }

  function tomEierSelect(select, tekst) {
    if (!select || window.behErSystemeier) return;
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = tekst || "Laster egne data ...";
    select.appendChild(opt);
  }

  function tomEierLister() {
    ["hestKunde", "behandlingKunde", "fakturaKunde"].forEach(id => tomEierSelect(el(id), "Laster egne kunder ..."));
    ["hestVelg", "behandlingHest"].forEach(id => tomEierSelect(el(id), id === "hestVelg" ? "Nytt dyr" : "Laster egne dyr ..."));
  }

  async function ryddValgForInnloggetBehandler() {
    if (window.behErSystemeier) return false;
    const c = await client();
    let behandlerId = aktivBehandlerId();
    if (!behandlerId) {
      tomEierLister();
      behandlerId = await finnInnloggetBehandlerHvisMangler();
    }
    if (!behandlerId) {
      tomEierLister();
      return false;
    }

    const kunderRes = await c.from("beh_kunder")
      .select("id,navn,behandler_id")
      .eq("behandler_id", behandlerId)
      .order("navn", { ascending: true });
    if (kunderRes.error) {
      console.warn("Kunne ikke filtrere kundeliste:", kunderRes.error);
      return false;
    }

    const hesterRes = await c.from("beh_hester")
      .select("id,navn,kunde_id,behandler_id")
      .eq("behandler_id", behandlerId)
      .order("navn", { ascending: true });
    if (hesterRes.error) {
      console.warn("Kunne ikke filtrere dyreliste:", hesterRes.error);
      return false;
    }

    const kunder = kunderRes.data || [];
    const dyr = hesterRes.data || [];
    window.kunderCache = kunder;
    window.hesterCache = dyr;

    fyllSelectMedRader(el("hestKunde"), kunder, "Velg kunde");
    fyllSelectMedRader(el("behandlingKunde"), kunder, "Velg kunde");
    fyllSelectMedRader(el("fakturaKunde"), kunder, "Velg kunde");

    const hestVelg = el("hestVelg");
    if (hestVelg) {
      fyllSelectMedRader(hestVelg, dyr, "Nytt dyr");
      hestVelg.options[0].textContent = "Nytt dyr";
    }

    const valgtKunde = el("behandlingKunde")?.value || "";
    const behandlingDyr = valgtKunde ? dyr.filter(d => String(d.kunde_id) === String(valgtKunde)) : dyr;
    fyllSelectMedRader(el("behandlingHest"), behandlingDyr, "Velg dyr");

    const hestKunde = el("hestKunde")?.value || "";
    if (hestKunde && !kunder.some(k => String(k.id) === String(hestKunde))) {
      el("hestKunde").value = "";
    }

    return true;
  }

  function startEierVakt() {
    if (window.behErSystemeier) return;
    tomEierLister();
    const forsok = [100, 300, 700, 1200, 2000, 3500, 6000];
    forsok.forEach(ms => setTimeout(() => {
      ryddValgForInnloggetBehandler().catch(e => console.warn("Eierfilter feilet:", e));
    }, ms));

    if (!window.behEierVaktInterval) {
      let runder = 0;
      window.behEierVaktInterval = setInterval(() => {
        runder += 1;
        if (window.behErSystemeier || runder > 40) {
          clearInterval(window.behEierVaktInterval);
          window.behEierVaktInterval = null;
          return;
        }
        ryddValgForInnloggetBehandler().catch(e => console.warn("Eierfilter feilet:", e));
      }, 500);
    }
  }

  async function hentFirma() {
    try {
      if (typeof window.hentFirmaData === "function") {
        const firma = await window.hentFirmaData();
        if (firma) return firma;
      }
    } catch (e) {
      console.warn("Kunne ikke hente firma via hentFirmaData:", e);
    }

    try {
      const c = await client();
      const r = await leggBehandlerFilter(c.from("beh_firma").select("*")).limit(1).maybeSingle();
      if (!r.error && r.data) return r.data;
    } catch (e) {
      console.warn("Kunne ikke hente firma:", e);
    }
    return {};
  }

  async function lagFakturaPdfDirekte(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const c = await client();
    const kundeId = el("fakturaKunde")?.value || "";
    if (!kundeId) {
      melding("fakturaMelding", "Velg kunde først.", true);
      return false;
    }

    melding("fakturaMelding", "Lager faktura ...", false);

    const kundeRes = await leggBehandlerFilter(c.from("beh_kunder").select("*")).eq("id", kundeId).maybeSingle();
    if (kundeRes.error) throw kundeRes.error;
    const kunde = kundeRes.data;
    if (!kunde) {
      melding("fakturaMelding", "Fant ikke kunden.", true);
      return false;
    }

    const behRes = await leggBehandlerFilter(c.from("beh_behandlinger")
      .select("id,dato,behandlingtype,beskrivelse,arbeid_belop,varer_belop,km,km_pris,mva,total,fakturert,fakturanr,hest_id,behandler_id,hester:beh_hester(navn,kunde_id)"))
      .or("fakturert.is.false,fakturert.is.null")
      .order("dato", { ascending: true });
    if (behRes.error) throw behRes.error;

    const behandlinger = (behRes.data || []).filter(b =>
      String(b.kunde_id || "") === String(kundeId) ||
      String(b.hester?.kunde_id || "") === String(kundeId)
    );

    if (!behandlinger.length) {
      melding("fakturaMelding", "Ingen ufakturerte behandlinger funnet på valgt kunde.", true);
      return false;
    }

    const fakturanr = "BEH-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + String(Date.now()).slice(-5);
    const fakturaDato = new Date().toISOString().slice(0, 10);
    const eksMva = behandlinger.reduce((sum, b) => sum + num(b.arbeid_belop) + num(b.varer_belop) + (num(b.km) * num(b.km_pris)), 0);
    const mva = eksMva * 0.25;
    const inklMva = eksMva + mva;

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      melding("fakturaMelding", "PDF-biblioteket er ikke lastet. Last siden på nytt.", true);
      return false;
    }

    const doc = new jsPDF();
    const firma = await hentFirma();
    if (typeof window.tegnBrevhodePdf === "function") {
      try { await window.tegnBrevhodePdf(doc, firma); } catch (e) { console.warn(e); }
    }

    let y = 56;
    doc.setFontSize(18);
    doc.text("FAKTURA", 20, y); y += 10;
    doc.setFontSize(10);
    doc.text("Fakturanr: " + fakturanr, 20, y); y += 6;
    doc.text("Dato: " + fakturaDato, 20, y); y += 12;

    doc.setFontSize(12);
    doc.text("Kunde:", 20, y); y += 7;
    doc.setFontSize(10);
    doc.text(String(kunde.navn || ""), 20, y); y += 6;
    if (kunde.adresse) { doc.text(String(kunde.adresse), 20, y); y += 6; }
    if (kunde.epost) { doc.text(String(kunde.epost), 20, y); y += 6; }
    y += 8;

    doc.setFontSize(10);
    doc.text("Dato", 20, y);
    doc.text("Beskrivelse", 45, y);
    doc.text("Belop", 160, y);
    y += 5;
    doc.line(20, y, 190, y);
    y += 8;

    for (const b of behandlinger) {
      if (y > 260) { doc.addPage(); y = 20; }
      const arbeid = num(b.arbeid_belop);
      const varer = num(b.varer_belop);
      const kj = num(b.km) * num(b.km_pris);
      const linjeSum = arbeid + varer + kj;
      const navn = b.hester?.navn || "Dyr";

      doc.text(String(b.dato || ""), 20, y);
      doc.text(String(`${navn} - ${b.behandlingtype || "Behandling"}`).slice(0, 58), 45, y);
      doc.text(kr(linjeSum) + " kr", 160, y);
      y += 6;

      if (kj > 0) {
        doc.setFontSize(8);
        doc.text(`Kjoring ${num(b.km)} km x ${kr(b.km_pris)} kr`, 45, y);
        y += 5;
        doc.setFontSize(10);
      }
    }

    y += 6;
    doc.line(120, y, 190, y); y += 8;
    doc.text("Sum eks. mva", 120, y);
    doc.text(kr(eksMva) + " kr", 160, y); y += 7;
    doc.text("MVA 25%", 120, y);
    doc.text(kr(mva) + " kr", 160, y); y += 8;
    doc.setFontSize(12);
    doc.text("Sum inkl. mva", 120, y);
    doc.text(kr(inklMva) + " kr", 160, y);

    if (typeof window.tegnBrevfotAlleSiderPdf === "function") {
      try { window.tegnBrevfotAlleSiderPdf(doc, firma); } catch (e) { console.warn(e); }
    }

    const fakturaRes = await c.from("beh_fakturaer").insert([medBehandler({
      fakturanr,
      kunde_id: kundeId,
      dato: fakturaDato,
      eks_mva: eksMva,
      mva,
      inkl_mva: inklMva,
      betalingsstatus: "ubetalt"
    })]);
    if (fakturaRes.error) throw fakturaRes.error;

    const ids = behandlinger.map(b => b.id).filter(Boolean);
    let oppdater = await c.from("beh_behandlinger").update({ fakturert: true, fakturanr }).in("id", ids);
    if (oppdater.error && String(oppdater.error.message || "").includes("fakturanr")) {
      console.warn("Kolonnen fakturanr mangler. Prøver å merke bare fakturert.", oppdater.error);
      oppdater = await c.from("beh_behandlinger").update({ fakturert: true }).in("id", ids);
      if (!oppdater.error) {
        melding("fakturaMelding", "PDF laget, men kjør SQL-filen for å lagre fakturanr på behandlingene.", true);
      }
    }
    if (oppdater.error) throw oppdater.error;

    const filnavn = fakturanr + ".pdf";
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const vindu = window.open(pdfUrl, "_blank");
    if (!vindu) {
      console.warn("Popup ble blokkert. Laster ned PDF direkte i stedet.");
    }
    doc.save(filnavn);
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);
    melding("fakturaMelding", "Faktura laget. PDF er åpnet/lastet ned: " + fakturanr, false);

    if (typeof window.hentBehandlinger === "function") await window.hentBehandlinger();
    if (typeof window.hentFakturaOversikt === "function") await window.hentFakturaOversikt();
    return false;
  }

  async function hentFakturaOversiktTrygt() {
    const c = await client();
    let r = await leggBehandlerFilter(c.from("beh_fakturaer")
      .select("*, kunder:beh_kunder(navn)")
    )
      .order("dato", { ascending: false })
      .order("fakturanr", { ascending: false });

    if (r.error && String(r.error.message || "").includes("dato")) {
      r = await leggBehandlerFilter(c.from("beh_fakturaer")
        .select("*, kunder:beh_kunder(navn)")
      )
        .order("created_at", { ascending: false })
        .order("fakturanr", { ascending: false });
    }

    if (r.error) {
      alert(r.error.message);
      return;
    }

    const data = (r.data || []).map(f => ({
      ...f,
      dato: f.dato || (f.created_at ? String(f.created_at).slice(0, 10) : "")
    }));

    const manglendeNullFakturaer = await hentManglendeNullFakturaer(data);
    data.push(...manglendeNullFakturaer);
    data.sort((a, b) => String(b.dato || b.created_at || "").localeCompare(String(a.dato || a.created_at || "")));

    tegnFakturaOversiktTrygt(data);
    fyllKreditFakturaValg(data);
  }

  async function hentManglendeNullFakturaer(fakturaer) {
    const c = await client();
    const eksisterendeNr = new Set((fakturaer || []).map(f => String(f.fakturanr || "")).filter(Boolean));
    const r = await leggBehandlerFilter(c.from("beh_behandlinger")
      .select("id,dato,behandlingtype,arbeid_belop,varer_belop,km,km_pris,mva,total,fakturert,fakturanr,kunde_id,behandler_id,kunder:beh_kunder(navn)"))
      .eq("fakturert", true)
      .order("dato", { ascending: false });

    if (r.error) {
      console.warn("Kunne ikke hente 0-fakturerte behandlinger:", r.error);
      return [];
    }

    const kreditertNullMap = await hentKrediterteNullBehandlingerMap(r.data || []);
    return (r.data || [])
      .filter(b => {
        const total = num(b.total) || (num(b.arbeid_belop) + num(b.varer_belop) + (num(b.km) * num(b.km_pris)));
        const fakturanr = String(b.fakturanr || "");
        const nr = fakturanr.toLowerCase();
        const erKreditert = nr.includes("kreditert") || nr.startsWith("kred") || kreditertNullMap.has(String(b.id));
        return total === 0 && !erKreditert && (!fakturanr || !eksisterendeNr.has(fakturanr));
      })
      .map(b => {
        const fakturanr = b.fakturanr || ("BEH-NULL-" + String(b.id || "").slice(0, 8));
        return {
          id: "behandling-" + b.id,
          fakturanr,
          kunde_id: b.kunde_id,
          eks_mva: 0,
          mva: 0,
          inkl_mva: 0,
          betalingsstatus: "ubetalt",
          kreditert: false,
          dato: b.dato || "",
          created_at: b.dato || "",
          kunder: b.kunder || { navn: "Uten kunde" },
          behandler_id: b.behandler_id,
          _fraBehandling: true,
          _behandlingId: b.id
        };
      });
  }

  async function hentBildeAntallMap(behandlinger) {
    const ids = (behandlinger || []).map(b => b.id).filter(Boolean);
    const map = new Map();
    if (!ids.length) return map;
    try {
      const c = await client();
      const r = await leggBehandlerFilter(c.from("beh_behandling_bilder").select("behandling_id,behandler_id")).in("behandling_id", ids);
      if (r.error) throw r.error;
      (r.data || []).forEach(b => {
        const key = String(b.behandling_id || "");
        map.set(key, (map.get(key) || 0) + 1);
      });
    } catch (e) {
      console.warn("Kunne ikke hente bildeantall:", e);
    }
    return map;
  }

  async function hentKrediterteNullBehandlingerMap(behandlinger) {
    const map = new Map();
    const prefixTilId = new Map();
    const fakturanrListe = (behandlinger || [])
      .map(b => {
        const id = String(b.id || "");
        if (!id) return "";
        const fakturanr = "BEH-NULL-" + id.slice(0, 8);
        prefixTilId.set(fakturanr, id);
        return fakturanr;
      })
      .filter(Boolean);

    if (!fakturanrListe.length) return map;

    try {
      const c = await client();
      const r = await leggBehandlerFilter(c.from("beh_kreditnotaer")
        .select("fakturanr,kreditnotanr,behandler_id"))
        .in("fakturanr", fakturanrListe);
      if (r.error) throw r.error;
      (r.data || []).forEach(k => {
        const id = prefixTilId.get(String(k.fakturanr || ""));
        if (id) map.set(id, k.kreditnotanr || true);
      });
    } catch (e) {
      console.warn("Kunne ikke hente kreditnotaer for 0-faktura:", e);
    }
    return map;
  }

  async function fakturerBehandlingLinje(kundeId, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    if (!kundeId) {
      melding("behandlingMelding", "Mangler kunde på behandlingen.", true);
      return false;
    }
    const fakturaKunde = el("fakturaKunde");
    if (fakturaKunde) fakturaKunde.value = kundeId;
    await lagFakturaPdfDirekte();
    await hentBehandlingerMedStatus();
    return false;
  }

  async function krediterNullBehandling(behandlingId, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    if (!behandlingId) return false;

    const c = await client();
    const r = await leggBehandlerFilter(c.from("beh_behandlinger")
      .select("id,dato,kunde_id,behandler_id,kunder:beh_kunder(navn)"))
      .eq("id", behandlingId)
      .maybeSingle();

    if (r.error) {
      alert("Kunne ikke hente behandlingen: " + r.error.message);
      return false;
    }
    if (!r.data) {
      alert("Fant ikke behandlingen.");
      return false;
    }

    const fakturanr = "BEH-NULL-" + String(r.data.id || "").slice(0, 8);
    window.behFeatureFakturaer = [
      {
        fakturanr,
        kunde_id: r.data.kunde_id,
        eks_mva: 0,
        mva: 0,
        inkl_mva: 0,
        dato: r.data.dato || "",
        kunder: r.data.kunder || { navn: "Uten kunde" },
        _fraBehandling: true,
        _behandlingId: r.data.id
      },
      ...(window.behFeatureFakturaer || []).filter(f => String(f.fakturanr || "") !== fakturanr)
    ];

    return krediterFaktura(fakturanr, "Kreditert 0-faktura");
  }

  function kortDato(v) {
    const s = String(v || "").slice(0, 10);
    if (s.length === 10 && s.includes("-")) {
      const deler = s.split("-");
      return `${deler[2]}.${deler[1]}.${deler[0].slice(2)}`;
    }
    if (s.length >= 10 && s.includes(".")) return `${s.slice(0, 6)}${s.slice(8, 10)}`;
    return s;
  }

  async function hentBehandlingerMedStatus() {
    const liste = el("behandlingListe");
    if (!liste) return;
    const c = await client();
    const r = await leggBehandlerFilter(c.from("beh_behandlinger")
      .select("id,dato,behandlingtype,arbeid_belop,varer_belop,km,km_pris,mva,total,fakturert,fakturanr,kunde_id,hest_id,behandler_id,kunder:beh_kunder(navn),hester:beh_hester(navn,kunde_id)"))
      .order("dato", { ascending: false });

    if (r.error) {
      melding("behandlingMelding", "Kunne ikke hente behandlinger: " + r.error.message, true);
      return;
    }

    const data = r.data || [];
    const bildeMap = await hentBildeAntallMap(data);
    const kreditertNullMap = await hentKrediterteNullBehandlingerMap(data);
    const erBehandlingKreditert = b => {
      const fakturanrTekst = String(b.fakturanr || "");
      const nr = fakturanrTekst.toLowerCase();
      return nr.includes("kreditert") || nr.startsWith("kred") || kreditertNullMap.has(String(b.id));
    };
    const ikkeFakturert = data.filter(b => !b.fakturert && !erBehandlingKreditert(b));
    const fakturert = data.filter(b => b.fakturert && !erBehandlingKreditert(b));
    const omsetning = data.reduce((sum, b) => sum + num(b.total), 0);

    if (el("antallUfatturerte")) el("antallUfatturerte").textContent = ikkeFakturert.length;
    if (el("antallFakturerte")) el("antallFakturerte").textContent = fakturert.length;
    if (el("behandlingOmsetning")) el("behandlingOmsetning").textContent = kr(omsetning) + " kr";

    if (!data.length) {
      liste.innerHTML = '<div class="info">Ingen behandlinger registrert.</div>';
      return;
    }

    liste.innerHTML = `
      <div style="display:grid;gap:3px;">
        ${data.map(b => {
          const fakturanrTekst = String(b.fakturanr || "");
          const erKreditert = erBehandlingKreditert(b);
          const status = erKreditert ? "Kreditert" : (b.fakturert ? "Fakturert" : "U");
          const statusFarge = erKreditert ? "#7f1d1d" : (b.fakturert ? "#14532d" : "#713f12");
          const kundeId = b.kunde_id || b.hesters?.kunde_id || "";
          const total = num(b.total) || (num(b.arbeid_belop) + num(b.varer_belop) + (num(b.km) * num(b.km_pris)));
          const belop = kr(total).replace(",00", "");
          const kanKreditereNull = b.fakturert && total === 0 && !erKreditert;
          return `
            <div
              data-behandling-id="${esc(b.id)}"
              onclick="window.visBehBehandlingDetalj && window.visBehBehandlingDetalj('${esc(b.id)}')"
              style="cursor:pointer;border-bottom:1px solid #374151;display:grid;grid-template-columns:58px minmax(56px,.75fr) minmax(76px,1fr) minmax(66px,.9fr) 64px 30px auto;gap:4px;align-items:center;padding:5px 0;font-size:12px;line-height:1.15;"
            >
              <span style="white-space:nowrap;font-size:11px;">${esc(kortDato(b.dato))}</span>
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.hesters?.navn || "")}</span>
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.kunder?.navn || "")}</span>
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.behandlingtype || "")}</span>
              <span style="text-align:right;white-space:nowrap;font-weight:700;">${belop}</span>
              <span style="white-space:nowrap;text-align:center;">📷${bildeMap.get(String(b.id)) || 0}</span>
              <span style="display:flex;gap:3px;justify-content:flex-end;align-items:center;white-space:nowrap;">
                <span title="${esc(b.fakturanr || status)}" style="background:${statusFarge};color:#fff;border-radius:999px;padding:3px 5px;font-size:10px;max-width:68px;overflow:hidden;text-overflow:ellipsis;">${esc(status)}</span>
                ${kanKreditereNull ? `<button type="button" class="danger" style="padding:4px 6px;font-size:10px;line-height:1;width:auto;min-height:0;" onclick="return window.behKrediterNullBehandling('${esc(b.id)}', event)">Kredit 0</button>` : ""}
                ${b.fakturert || erKreditert ? "" : `<button type="button" class="secondary" style="padding:4px 6px;font-size:10px;line-height:1;width:auto;min-height:0;" onclick="return window.behFakturerBehandlingLinje('${esc(kundeId)}', event)">Fakt</button>`}
              </span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function tegnFakturaOversiktTrygt(data) {
    const div = el("fakturaOversikt");
    if (!div) return;

    const rader = data || [];
    if (!rader.length) {
      div.innerHTML = '<div class="listekort">Ingen fakturaer å vise.</div>';
      return;
    }

    window.behFeatureFakturaer = rader;
    const sum = rader.reduce((s, f) => s + num(f.inkl_mva), 0);
    div.innerHTML = `
      <div class="listekort" style="padding:7px;">
        <h3 style="margin:0 0 6px 0;font-size:16px;">Alle fakturaer</h3>
        <div style="display:grid;gap:3px;">
          ${rader.map(f => {
            const status = statusTekstFaktura(f);
            const statusFarge = status === "Betalt" ? "#14532d" : status === "Kreditert" ? "#3f1d1d" : status === "Purret" ? "#713f12" : "#1e3a8a";
            return `
              <div style="border:1px solid #26313a;border-radius:5px;padding:4px 5px;background:#0d1113;display:grid;grid-template-columns:minmax(72px,.8fr) minmax(80px,1fr) minmax(54px,.6fr) minmax(42px,.45fr) auto;gap:4px;align-items:center;font-size:10px;line-height:1.05;">
                <span style="color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(f.fakturanr || "")}</span>
                <span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;">${esc(f.kunder?.navn || "Uten kunde")}</span>
                <span style="font-weight:700;white-space:nowrap;text-align:right;">${kr(f.inkl_mva)}</span>
                <span style="background:${statusFarge};color:#fff;border-radius:999px;padding:2px 4px;font-size:9px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(status)}</span>
                <span style="display:flex;gap:3px;justify-content:flex-end;white-space:nowrap;">
                  ${f.betalingsstatus === "betalt" || f.kreditert ? "" : `<button type="button" class="secondary" style="padding:3px 6px;font-size:10px;line-height:1;width:auto;min-height:0;" onclick="return window.behSettFakturaBetalt('${esc(f.fakturanr || "")}')">Betalt</button>`}
                  ${f.kreditert ? "" : `<button type="button" class="secondary" style="padding:3px 6px;font-size:10px;line-height:1;width:auto;min-height:0;" onclick="return window.behLagPurring('${esc(f.fakturanr || "")}')">Purr</button>`}
                  ${f.kreditert ? "" : `<button type="button" class="danger" style="padding:3px 6px;font-size:10px;line-height:1;width:auto;min-height:0;" onclick="return window.behKrediterFaktura('${esc(f.fakturanr || "")}')">Kredit</button>`}
                </span>
              </div>
            `;
          }).join("")}
        </div>
        <p style="font-size:12px;margin:7px 0 0 0;"><strong>Sum:</strong> ${kr(sum)} kr</p>
      </div>
    `;
  }

  function statusTekstFaktura(f) {
    if (f.kreditert) return "Kreditert";
    const status = String(f.betalingsstatus || "").toLowerCase();
    if (status === "betalt") return "Betalt";
    if (status === "purring" || status === "purret" || f.purring_sendt) return "Purret";
    return "Ubetalt";
  }

  function finnFaktura(fakturanr) {
    return (window.behFeatureFakturaer || []).find(f => String(f.fakturanr || "") === String(fakturanr || "")) || null;
  }

  function negativtBelop(v) {
    const n = Math.abs(num(v));
    return n ? -n : 0;
  }

  function fyllKreditFakturaValg(data) {
    const select = el("kreditFakturaValg");
    if (!select) return;
    const valgt = select.value || "";
    const rader = (data || window.behFeatureFakturaer || []).filter(f => f && !f.kreditert);
    select.innerHTML = '<option value="">Velg faktura</option>';
    for (const f of rader) {
      const opt = document.createElement("option");
      opt.value = f.fakturanr || "";
      opt.textContent = `${f.fakturanr || "Uten nr"} - ${f.kunder?.navn || "Uten kunde"} - ${kr(f.inkl_mva)} kr`;
      select.appendChild(opt);
    }
    if (valgt && Array.from(select.options).some(o => o.value === valgt)) select.value = valgt;
  }

  async function hentFakturaFraBase(fakturanr) {
    const c = await client();
    const r = await leggBehandlerFilter(c.from("beh_fakturaer")
      .select("*, kunder:beh_kunder(navn)"))
      .eq("fakturanr", fakturanr)
      .maybeSingle();
    if (r.error) throw r.error;
    return r.data || null;
  }

  async function settFakturaBetalt(fakturanr) {
    const c = await client();
    const f = finnFaktura(fakturanr);
    const belop = num(f?.inkl_mva);
    const r = await c.from("beh_fakturaer")
      .update({
        betalingsstatus: "betalt",
        betalt: true,
        betalt_belop: belop,
        betalt_dato: new Date().toISOString().slice(0, 10)
      })
      .eq("fakturanr", fakturanr);
    if (r.error) {
      alert("Kunne ikke sette betalt: " + r.error.message);
      return false;
    }
    melding("fakturaMelding", "Faktura er satt som betalt.", false);
    await hentFakturaOversiktTrygt();
    return false;
  }

  async function lagPurring(fakturanr) {
    const f = finnFaktura(fakturanr);
    if (!f) {
      alert("Fant ikke fakturaen.");
      return false;
    }

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert("PDF-biblioteket er ikke lastet.");
      return false;
    }

    const dato = new Date().toISOString().slice(0, 10);
    const doc = new jsPDF();
    const firma = await hentFirma();
    if (typeof window.tegnBrevhodePdf === "function") {
      try { await window.tegnBrevhodePdf(doc, firma); } catch (e) { console.warn(e); }
    }

    let y = 56;
    doc.setFontSize(18);
    doc.text("PURRING", 20, y); y += 12;
    doc.setFontSize(11);
    doc.text("Fakturanr: " + String(f.fakturanr || ""), 20, y); y += 7;
    doc.text("Purringsdato: " + dato, 20, y); y += 7;
    doc.text("Opprinnelig fakturadato: " + String(f.dato || ""), 20, y); y += 12;
    doc.text("Kunde: " + String(f.kunder?.navn || ""), 20, y); y += 12;
    doc.text("Dette er en purring pa ubetalt faktura.", 20, y); y += 8;
    doc.text("Utestaende belop: " + kr(f.inkl_mva) + " kr", 20, y);

    const filnavn = "Purring-" + String(fakturanr || "faktura") + ".pdf";
    try {
      const url = doc.output("bloburl");
      const vindu = window.open(url, "_blank");
      if (!vindu) doc.save(filnavn);
    } catch (e) {
      console.warn("Kunne ikke åpne purring i ny fane, prøver nedlasting:", e);
      doc.save(filnavn);
    }

    const c = await client();
    const r = await c.from("beh_fakturaer")
      .update({
        betalingsstatus: "purring",
        purring_sendt: true,
        purring_dato: dato
      })
      .eq("fakturanr", fakturanr);
    if (r.error) {
      alert("Purring-PDF ble laget, men status ble ikke lagret: " + r.error.message);
      return false;
    }

    melding("fakturaMelding", "Purring laget. PDF er åpnet/lastet ned.", false);
    await hentFakturaOversiktTrygt();
    return false;
  }

  async function krediterFaktura(fakturanr, fastGrunn) {
    const kreditNokkel = String(fakturanr || "");
    window.behKrediteringAktiv = window.behKrediteringAktiv || {};
    if (kreditNokkel && window.behKrediteringAktiv[kreditNokkel]) {
      alert("Denne fakturaen krediteres allerede.");
      return false;
    }
    if (kreditNokkel) window.behKrediteringAktiv[kreditNokkel] = true;

    let f = finnFaktura(fakturanr);
    if (!f && fakturanr) {
      try { f = await hentFakturaFraBase(fakturanr); } catch (e) { console.warn("Kunne ikke hente faktura fra base:", e); }
    }
    if (!f) {
      alert("Fant ikke fakturaen.");
      if (kreditNokkel) delete window.behKrediteringAktiv[kreditNokkel];
      return false;
    }

    const c = await client();
    const status = String(f.betalingsstatus || "").toLowerCase();
    const nr = String(f.fakturanr || fakturanr || "").toLowerCase();
    if (f.kreditert || status === "kreditert" || nr.includes("kreditert") || nr.startsWith("kred-")) {
      alert("Denne fakturaen er allerede kreditert.");
      if (kreditNokkel) delete window.behKrediteringAktiv[kreditNokkel];
      return false;
    }

    const finnes = await leggBehandlerFilter(c.from("beh_kreditnotaer")
      .select("id,kreditnotanr")
      .eq("fakturanr", f.fakturanr)
      .limit(1));
    if (!finnes.error && (finnes.data || []).length) {
      alert("Denne fakturaen er allerede kreditert.");
      if (kreditNokkel) delete window.behKrediteringAktiv[kreditNokkel];
      return false;
    }

    const grunn = fastGrunn !== undefined ? fastGrunn : prompt("Grunn for kreditnota:", "Kreditert faktura");
    if (grunn === null) {
      if (kreditNokkel) delete window.behKrediteringAktiv[kreditNokkel];
      return false;
    }

    const kreditnotanr = "KRED-" + Date.now();
    const eksMva = num(f.eks_mva);
    const mva = num(f.mva);
    const inklMva = num(f.inkl_mva);
    const kred = await c.from("beh_kreditnotaer").insert([medBehandler({
      kreditnotanr,
      fakturanr: f.fakturanr,
      kunde_id: f.kunde_id,
      eks_mva: negativtBelop(eksMva),
      mva: negativtBelop(mva),
      inkl_mva: negativtBelop(inklMva),
      grunn: grunn || "Kreditert faktura"
    })]);
    if (kred.error) {
      alert("Kunne ikke lage kreditnota: " + kred.error.message);
      if (kreditNokkel) delete window.behKrediteringAktiv[kreditNokkel];
      return false;
    }

    if (!f._fraBehandling) {
      const oppdater = await c.from("beh_fakturaer")
        .update({
          kreditert: true,
          kreditert_dato: new Date().toISOString().slice(0, 10),
          kreditnota_nr: kreditnotanr,
          betalingsstatus: "kreditert"
        })
        .eq("fakturanr", fakturanr);
      if (oppdater.error) {
        alert("Kreditnota ble laget, men faktura ble ikke oppdatert: " + oppdater.error.message);
        if (kreditNokkel) delete window.behKrediteringAktiv[kreditNokkel];
        return false;
      }
    }

    const beh = f._fraBehandling && f._behandlingId
      ? await c.from("beh_behandlinger")
          .update({ fakturert: true, fakturanr: "KREDITERT-" + kreditnotanr })
          .eq("id", f._behandlingId)
      : await c.from("beh_behandlinger")
          .update({ fakturert: false, fakturanr: null })
          .eq("fakturanr", fakturanr);
    if (beh.error) console.warn("Kunne ikke frigjore behandlinger:", beh.error);

    const { jsPDF } = window.jspdf || {};
    if (jsPDF) {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("KREDITNOTA", 20, 30);
      doc.setFontSize(11);
      doc.text("Kreditnotanr: " + kreditnotanr, 20, 45);
      doc.text("Krediterer faktura: " + String(f.fakturanr || ""), 20, 53);
      doc.text("Kunde: " + String(f.kunder?.navn || ""), 20, 61);
      doc.text("Grunn: " + String(grunn || ""), 20, 69);
      doc.text("Belop inkl. mva: -" + kr(inklMva) + " kr", 20, 85);
      doc.save(kreditnotanr + ".pdf");
    }

    melding("fakturaMelding", "Kreditnota laget: " + kreditnotanr, false);
    await hentFakturaOversiktTrygt();
    if (typeof window.hentBehandlinger === "function") await window.hentBehandlinger();
    if (kreditNokkel) delete window.behKrediteringAktiv[kreditNokkel];
    return false;
  }

  async function krediterFraSkjema(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    const fakturanr = el("kreditFakturaValg")?.value || "";
    const grunn = el("kreditGrunn")?.value || "Kreditert faktura";
    if (!fakturanr) {
      melding("fakturaMelding", "Velg faktura å kreditere først.", true);
      return false;
    }
    return krediterFaktura(fakturanr, grunn);
  }

  function start() {
    const kamera = el("behandlingBildeKamera");
    const galleri = el("behandlingBildeGalleri");
    if (kamera) kamera.multiple = true;
    if (galleri) galleri.multiple = true;
    blankKjoring();
    leggTilHestBildeKnapp();
    leggTilFakturaMenyKnapp();
    startEierVakt();

    const type = el("behandlingType");
    if (type && type.dataset.featurePrisBind !== "1") {
      type.dataset.featurePrisBind = "1";
      type.addEventListener("focus", () => fyllPriser(true), true);
      type.addEventListener("click", () => fyllPriser(false), true);
      type.addEventListener("change", settPrisFraValg, true);
    }

    const lagre = el("lagreBehandlingKnapp");
    if (lagre) lagre.onclick = lagreBehandlingDirekte;

    const behandlingKunde = el("behandlingKunde");
    if (behandlingKunde && behandlingKunde.dataset.eierFilterBind !== "1") {
      behandlingKunde.dataset.eierFilterBind = "1";
      behandlingKunde.addEventListener("change", () => setTimeout(() => ryddValgForInnloggetBehandler().catch(() => {}), 120), true);
      behandlingKunde.addEventListener("focus", () => ryddValgForInnloggetBehandler().catch(() => {}), true);
      behandlingKunde.addEventListener("pointerdown", () => ryddValgForInnloggetBehandler().catch(() => {}), true);
    }

    const hestKunde = el("hestKunde");
    if (hestKunde && hestKunde.dataset.eierFilterBind !== "1") {
      hestKunde.dataset.eierFilterBind = "1";
      hestKunde.addEventListener("focus", () => ryddValgForInnloggetBehandler().catch(() => {}), true);
      hestKunde.addEventListener("click", () => ryddValgForInnloggetBehandler().catch(() => {}), true);
      hestKunde.addEventListener("pointerdown", () => ryddValgForInnloggetBehandler().catch(() => {}), true);
    }

    const fakturaKunde = el("fakturaKunde");
    if (fakturaKunde && fakturaKunde.dataset.eierFilterBind !== "1") {
      fakturaKunde.dataset.eierFilterBind = "1";
      fakturaKunde.addEventListener("focus", () => ryddValgForInnloggetBehandler().catch(() => {}), true);
      fakturaKunde.addEventListener("click", () => ryddValgForInnloggetBehandler().catch(() => {}), true);
      fakturaKunde.addEventListener("pointerdown", () => ryddValgForInnloggetBehandler().catch(() => {}), true);
    }

    const fakturaKnapp = el("lagFakturaKnapp");
    if (fakturaKnapp) {
      fakturaKnapp.removeAttribute("onclick");
      fakturaKnapp.onclick = lagFakturaPdfDirekte;
    }

    const oversiktKnapp = el("hentFakturaOversiktKnapp");
    if (oversiktKnapp) {
      oversiktKnapp.textContent = "Vis alle fakturaer og status";
      oversiktKnapp.onclick = function (event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        hentFakturaOversiktTrygt();
        return false;
      };
    }

    const kreditKnapp = el("lagKreditnotaKnapp");
    if (kreditKnapp) {
      kreditKnapp.removeAttribute("onclick");
      kreditKnapp.onclick = krediterFraSkjema;
      if (kreditKnapp.dataset.featureKreditBind !== "1") {
        kreditKnapp.dataset.featureKreditBind = "1";
        kreditKnapp.addEventListener("click", krediterFraSkjema, true);
        kreditKnapp.addEventListener("touchend", krediterFraSkjema, true);
      }
    }

    window.behLagreBehandlingDirekte = lagreBehandlingDirekte;
    window.behFeatureFyllPriser = fyllPriser;
    window.behVisAlleBilderForHest = visAlleBilderForHest;
    window.behLagFakturaDirekte = lagFakturaPdfDirekte;
    window.behLagFakturaHardfix = lagFakturaPdfDirekte;
    window.lagBehFaktura = lagFakturaPdfDirekte;
    window.hentFakturaOversikt = hentFakturaOversiktTrygt;
    window.hentBehandlinger = hentBehandlingerMedStatus;
    window.visBehBehandlingDetalj = visBehandlingDetalj;
    window.behFakturerBehandlingLinje = fakturerBehandlingLinje;
    window.behKrediterNullBehandling = krediterNullBehandling;
    window.behSettFakturaBetalt = settFakturaBetalt;
    window.behLagPurring = lagPurring;
    window.behKrediterFaktura = krediterFaktura;
    window.behKrediterFraSkjema = krediterFraSkjema;

    setTimeout(() => fyllPriser(true).catch(e => melding("behandlingMelding", "Kunne ikke hente priser: " + (e.message || e), true)), 300);
    setTimeout(blankKjoring, 500);
    setTimeout(() => hentBehandlingerMedStatus().catch(e => console.warn("Kunne ikke oppdatere behandlingsliste:", e)), 700);
  }

  document.addEventListener("click", function (event) {
    const ny = event.target && event.target.closest ? event.target.closest("#nyBehandlingKnapp") : null;
    if (!ny) return;
    window.behValgtBehandlingId = "";
    ["behandlingKunde", "behandlingHest", "behandlingType"].forEach(id => {
      const felt = el(id);
      if (felt) felt.value = "";
    });
    ["behandlingBeskrivelse", "behandlingKm", "behandlingKmPris", "arbeidBelop", "varerBelop", "behandlingPrisAuto"].forEach(id => {
      const felt = el(id);
      if (felt) felt.value = "";
    });
    tomBildeFelter();
    const dato = el("behandlingDato");
    if (dato) dato.value = new Date().toISOString().slice(0, 10);
    const autoInfo = el("behandlingPrisAutoInfo");
    if (autoInfo) autoInfo.textContent = "";
    melding("behandlingMelding", "", false);
    const lagreKnapp = el("lagreBehandlingKnapp");
    if (lagreKnapp) lagreKnapp.textContent = "Lagre behandling";
  }, true);

  document.addEventListener("click", function (event) {
    const knapp = event.target && event.target.closest ? event.target.closest("#lagFakturaKnapp") : null;
    if (!knapp) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    lagFakturaPdfDirekte(event).catch(e => {
      console.error("Faktura-fiks feilet:", e);
      melding("fakturaMelding", "Kunne ikke lage faktura: " + (e.message || e), true);
      alert("Kunne ikke lage faktura: " + (e.message || e));
    });
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  window.addEventListener("load", () => setTimeout(start, 200));
})();
