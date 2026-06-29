(function () {
  const loginUrl = "../behandler-login.html";

  function visApp() {
    document.documentElement.removeAttribute("data-auth-pending");
  }

  function erGreknuts(session) {
    const user = session && session.user ? session.user : null;
    const epost = String(user?.email || "").toLowerCase();
    const navn = String(
      user?.user_metadata?.name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.brukernavn ||
      ""
    ).toLowerCase();
    return epost.includes("greknuts") || navn.includes("greknuts");
  }

  function settRolle(session) {
    const systemeier = erGreknuts(session);
    window.behInnloggetBruker = session?.user || null;
    window.behErSystemeier = systemeier;
    window.behKanOppretteBehandlere = systemeier;
    document.documentElement.setAttribute("data-systemeier", systemeier ? "1" : "0");

    document.querySelectorAll("[data-greknuts-only]").forEach(el => {
      el.style.display = systemeier ? "" : "none";
    });

    oppdaterInnloggetVisning();
  }

  function oppdaterInnloggetVisning() {
    const felt = document.getElementById("innloggetBrukerVisning");
    if (!felt) return;

    const bruker = window.behInnloggetBruker || null;
    const behandler = window.behInnloggetBehandler || null;
    const navn = behandler?.navn || bruker?.user_metadata?.navn || bruker?.user_metadata?.name || bruker?.user_metadata?.full_name || "";
    const epost = behandler?.epost || bruker?.email || "";
    const rolle = window.behErSystemeier
      ? "systemeier"
      : (behandler?.rolle || "behandler");
    const hvem = navn && epost ? `${navn} (${epost})` : (navn || epost || "ukjent bruker");
    felt.textContent = "Innlogget: " + hvem + " - " + rolle;
  }

  async function hentInnloggetBehandler(session) {
    const user = session?.user || null;
    window.behInnloggetBehandler = null;
    window.behInnloggetBehandlerId = "";
    if (!user || !window.supabaseClient) return null;

    let r = null;
    if (user.id) {
      r = await window.supabaseClient
        .from("beh_behandlere")
        .select("id,navn,epost,rolle,aktiv,auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
    }

    if ((!r || r.error || !r.data) && user.email) {
      r = await window.supabaseClient
        .from("beh_behandlere")
        .select("id,navn,epost,rolle,aktiv,auth_user_id")
        .ilike("epost", user.email)
        .maybeSingle();
    }

    if (r && r.error) {
      console.warn("Kunne ikke hente innlogget behandler:", r.error);
      return null;
    }

    const behandler = r?.data || null;
    window.behInnloggetBehandler = behandler;
    window.behInnloggetBehandlerId = behandler?.id || "";

    if (behandler) {
      const rolle = String(behandler.rolle || "").toLowerCase();
      const systemeier = window.behErSystemeier || rolle === "systemeier" || rolle === "admin";
      window.behErSystemeier = systemeier;
      window.behKanOppretteBehandlere = systemeier;
      document.documentElement.setAttribute("data-systemeier", systemeier ? "1" : "0");
      document.querySelectorAll("[data-greknuts-only]").forEach(el => {
        el.style.display = systemeier ? "" : "none";
      });
    }

    oppdaterInnloggetVisning();

    return behandler;
  }

  function tilLogin() {
    localStorage.removeItem("rettilommaValgtModul");
    window.location.replace(loginUrl);
  }

  async function sjekkInnlogging() {
    if (!window.supabaseClient || !window.supabaseClient.auth) {
      tilLogin();
      return;
    }

    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error || !data || !data.session) {
      tilLogin();
      return;
    }

    settRolle(data.session);
    await hentInnloggetBehandler(data.session);
    visApp();

    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) tilLogin();
      else {
        settRolle(session);
        await hentInnloggetBehandler(session);
      }
    });
  }

  window.behLoggUt = async function behLoggUt(event) {
    if (event) event.preventDefault();
    localStorage.removeItem("rettilommaValgtModul");
    if (window.supabaseClient && window.supabaseClient.auth) {
      await window.supabaseClient.auth.signOut();
    }
    tilLogin();
    return false;
  };

  function lagMidlertidigPassord() {
    const tegn = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const spesial = "!#%";
    let passord = "RiL";
    if (window.crypto && window.crypto.getRandomValues) {
      const tall = new Uint32Array(12);
      window.crypto.getRandomValues(tall);
      tall.forEach(n => { passord += tegn[n % tegn.length]; });
      passord += spesial[tall[0] % spesial.length] + String(10 + (tall[1] % 80));
      return passord;
    }
    return "RiL" + Date.now() + "!";
  }

  function authKlientForNyBruker() {
    const url = window.SUPABASE_URL || window.supabaseClient?.supabaseUrl || "";
    const key = window.SUPABASE_ANON_KEY || window.supabaseClient?.supabaseKey || "";
    if (!window.supabase || !url || !key) {
      return window.supabaseClient;
    }
    return window.supabase.createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }

  function supabaseInfo() {
    return {
      url: window.SUPABASE_URL || window.supabaseClient?.supabaseUrl || "",
      key: window.SUPABASE_ANON_KEY || window.supabaseClient?.supabaseKey || ""
    };
  }

  function feilTekst(e) {
    if (!e) return "Ukjent feil";
    if (typeof e === "string") {
      if (!e.trim() || e.trim() === "{}") {
        return "Ukjent Supabase-feil. Sjekk RLS/policy og at tabellen beh_behandlere finnes.";
      }
      return e;
    }
    if (e.message && String(e.message).trim() !== "{}") return e.message;
    try {
      const json = JSON.stringify(e);
      if (json && json !== "{}") return json;
    } catch (_) {}
    return "Ukjent Supabase-feil. Sjekk RLS/policy og at tabellen beh_behandlere finnes.";
  }

  function authFeilTekst(e) {
    const navn = String(e?.name || "");
    const status = e?.status || e?.code || "";
    const tekst = feilTekst(e);
    if (navn === "AuthRetryableFetchError" || String(status) === "500") {
      return "Supabase Auth feilet ved oppretting av innlogging. Dette er vanligvis SMTP/e-postbekreftelse. Slå av Confirm email for test, eller sett opp Custom SMTP riktig i Supabase. Teknisk: " + tekst;
    }
    return tekst;
  }

  async function lagreBehandlerRad(payload, id) {
    if (!window.supabaseClient) throw new Error("Supabase er ikke klar.");
    if (id) {
      const r = await window.supabaseClient
        .from("beh_behandlere")
        .update(payload)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    }

    const r = await window.supabaseClient
      .from("beh_behandlere")
      .upsert([payload], { onConflict: "epost" })
      .select("id")
      .maybeSingle();
    if (r.error) throw r.error;
    return r.data;
  }

  function behandlerLoginRedirect() {
    return window.location.origin + window.location.pathname.replace(/\/behandler\/index\.html$/, "/behandler-login.html");
  }

  window.behNyBehandler = async function behNyBehandler() {
    const melding = document.getElementById("nyBehandlerMelding");
    const valgtId = String(document.getElementById("nyBehandlerId")?.value || "").trim();
    const navn = String(document.getElementById("nyBehandlerNavn")?.value || "").trim();
    const epost = String(document.getElementById("nyBehandlerEpost")?.value || "").trim();
    const passordFelt = document.getElementById("nyBehandlerPassord");
    const valgtPassord = String(passordFelt?.value || "").trim();
    const orgnr = String(document.getElementById("nyBehandlerOrgNr")?.value || "").trim();
    const adresse = String(document.getElementById("nyBehandlerAdresse")?.value || "").trim();
    const bankkonto = String(document.getElementById("nyBehandlerBankkonto")?.value || "").trim();
    const fakturanotat = String(document.getElementById("nyBehandlerFakturaNotat")?.value || "").trim();
    const aktiv = document.getElementById("nyBehandlerAktiv")?.checked !== false;

    if (!window.behKanOppretteBehandlere) {
      if (melding) melding.textContent = "Bare greknuts kan opprette nye behandlere.";
      return false;
    }

    if (!navn || !epost) {
      if (melding) melding.textContent = "Skriv navn og e-post først.";
      return false;
    }

    if (valgtPassord && valgtPassord.length < 6) {
      if (melding) melding.textContent = "Passordet må være minst 6 tegn.";
      return false;
    }

    const knapp = document.getElementById("nyBehandlerKnapp");
    if (knapp) knapp.disabled = true;
    if (melding) {
      melding.style.color = "#cbd5e1";
      melding.textContent = valgtId ? "Lagrer behandler ..." : "Oppretter behandler ...";
    }

    try {
      if (valgtId) {
        await lagreBehandlerRad({
          navn,
          epost,
          orgnr,
          fakturaadresse: adresse,
          bankkonto,
          fakturanotat,
          aktiv
        }, valgtId);
        nullstillBehandlerSkjema();
        if (melding) {
          melding.style.color = "#86efac";
          melding.textContent = "Behandleren er oppdatert.";
        }
        await window.behHentBehandlere();
        return false;
      }

      const passord = valgtPassord || lagMidlertidigPassord();
      if (passordFelt) passordFelt.value = passord;
      const authClient = authKlientForNyBruker();
      const authSvar = await authClient.auth.signUp({
        email: epost,
        password: passord,
        options: {
          emailRedirectTo: behandlerLoginRedirect(),
          data: {
            navn,
            rolle: "behandler",
            opprettet_av: "greknuts"
          }
        }
      });

      if (authSvar.error) {
        throw new Error("Kunne ikke opprette innlogging: " + authFeilTekst(authSvar.error));
      }

      const userId = authSvar.data?.user?.id || null;
      await lagreBehandlerRad({
        auth_user_id: userId,
        navn,
        epost,
        orgnr,
        fakturaadresse: adresse,
        bankkonto,
        fakturanotat,
        rolle: "behandler",
        aktiv
      });

      nullstillBehandlerSkjema();
      if (passordFelt) passordFelt.value = passord;

      if (melding) {
        melding.style.color = "#86efac";
        const maaBekreftes = !authSvar.data?.session;
        melding.textContent =
          "Behandleren er lagret i Supabase. Innlogging: " + epost +
          " / midlertidig passord: " + passord +
          (maaBekreftes
            ? ". Supabase krever trolig e-postbekreftelse før innlogging virker."
            : ". Be behandleren bytte passord etter første innlogging.");
      }
      await window.behHentBehandlere();
      return false;
    } catch (e) {
      if (melding) {
        melding.style.color = "#fca5a5";
        melding.textContent = "Kunne ikke lagre behandler: " + feilTekst(e);
      }
      return false;
    } finally {
      if (knapp) knapp.disabled = false;
    }
  };

  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function settVerdi(id, verdi) {
    const felt = document.getElementById(id);
    if (felt) felt.value = verdi || "";
  }

  function nullstillBehandlerSkjema() {
    ["nyBehandlerId", "nyBehandlerNavn", "nyBehandlerEpost", "nyBehandlerPassord", "nyBehandlerOrgNr", "nyBehandlerAdresse", "nyBehandlerBankkonto", "nyBehandlerFakturaNotat"].forEach(id => {
      const felt = document.getElementById(id);
      if (felt) felt.value = "";
    });
    const aktiv = document.getElementById("nyBehandlerAktiv");
    if (aktiv) aktiv.checked = true;
    const knapp = document.getElementById("nyBehandlerKnapp");
    if (knapp) knapp.textContent = "Opprett behandler med innlogging";
    const avbryt = document.getElementById("avbrytBehandlerRedigeringKnapp");
    if (avbryt) avbryt.style.display = "none";
  }

  window.behRedigerBehandler = function behRedigerBehandler(id) {
    const behandler = (window.behBehandlerListe || []).find(b => String(b.id) === String(id));
    const melding = document.getElementById("nyBehandlerMelding");
    if (!behandler) {
      if (melding) melding.textContent = "Fant ikke behandleren i listen.";
      return false;
    }

    settVerdi("nyBehandlerId", behandler.id);
    settVerdi("nyBehandlerNavn", behandler.navn);
    settVerdi("nyBehandlerEpost", behandler.epost);
    settVerdi("nyBehandlerPassord", "");
    settVerdi("nyBehandlerOrgNr", behandler.orgnr);
    settVerdi("nyBehandlerAdresse", behandler.fakturaadresse);
    settVerdi("nyBehandlerBankkonto", behandler.bankkonto);
    settVerdi("nyBehandlerFakturaNotat", behandler.fakturanotat);
    const aktiv = document.getElementById("nyBehandlerAktiv");
    if (aktiv) aktiv.checked = behandler.aktiv !== false;
    const knapp = document.getElementById("nyBehandlerKnapp");
    if (knapp) knapp.textContent = "Lagre endringer";
    const avbryt = document.getElementById("avbrytBehandlerRedigeringKnapp");
    if (avbryt) avbryt.style.display = "";
    if (melding) {
      melding.style.color = "#cbd5e1";
      melding.textContent = "Redigerer " + (behandler.navn || behandler.epost || "behandler") + ". Passord endres ikke her.";
    }
    document.getElementById("nyBehandlerNavn")?.focus();
    return false;
  };

  window.behHentBehandlere = async function behHentBehandlere() {
    const liste = document.getElementById("behandlerListe");
    if (!liste) return false;

    if (!window.behKanOppretteBehandlere) {
      liste.innerHTML = '<div class="info">Bare greknuts kan se behandlerlisten.</div>';
      return false;
    }

    liste.innerHTML = '<div class="info">Henter behandlere ...</div>';
    const r = await window.supabaseClient
      .from("beh_behandlere")
      .select("id,navn,epost,orgnr,fakturaadresse,bankkonto,fakturanotat,rolle,aktiv,created_at")
      .order("created_at", { ascending: false });

    if (r.error) {
      liste.innerHTML = '<div class="melding">Kunne ikke hente behandlere: ' + esc(r.error.message) + '</div>';
      return false;
    }

    const data = r.data || [];
    window.behBehandlerListe = data;
    if (!data.length) {
      liste.innerHTML = `
        <div class="info">
          Ingen behandlere funnet i tabellen <strong>beh_behandlere</strong>.
          Auth-brukerne kan fortsatt finnes i Supabase under Authentication -> Users.
        </div>
        <div class="info">
          Hvis du nettopp redigerte/slettet testdata: fyll inn behandleren i skjemaet over og trykk
          <strong>Opprett behandler med innlogging</strong> på nytt. Hvis e-posten allerede finnes i Auth,
          sletter du først brukeren i Authentication -> Users eller bruker en ny test-epost.
        </div>
      `;
      return false;
    }

    liste.innerHTML = `
      <div style="display:grid;gap:5px;margin-top:8px;">
        ${data.map(b => `
          <div style="border:1px solid #374151;border-radius:6px;padding:7px;background:#111617;font-size:12px;line-height:1.25;">
            <div style="display:grid;grid-template-columns:minmax(80px,1fr) minmax(100px,1.2fr) auto auto;gap:6px;align-items:center;">
              <strong style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.navn)}</strong>
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.epost)}</span>
              <span style="background:${b.aktiv ? "#14532d" : "#7f1d1d"};color:white;border-radius:999px;padding:2px 6px;font-size:10px;">${b.aktiv ? "Aktiv" : "Stengt"}</span>
              <button type="button" class="secondary" style="padding:3px 7px;font-size:10px;line-height:1;min-height:0;" onclick="return window.behRedigerBehandler('${esc(b.id)}')">Rediger</button>
            </div>
            <div style="display:grid;grid-template-columns:minmax(70px,.8fr) minmax(90px,1fr) minmax(110px,1.2fr);gap:6px;margin-top:5px;color:#cbd5e1;">
              <span>Org: ${esc(b.orgnr || "-")}</span>
              <span>Konto: ${esc(b.bankkonto || "-")}</span>
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.fakturaadresse || "")}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    return false;
  };

  function kobleSystemeierKnapper() {
    const knapp = document.getElementById("nyBehandlerKnapp");
    if (knapp && knapp.dataset.koblet !== "1") {
      knapp.dataset.koblet = "1";
      knapp.addEventListener("click", window.behNyBehandler);
    }
    const listeKnapp = document.getElementById("hentBehandlereKnapp");
    if (listeKnapp && listeKnapp.dataset.koblet !== "1") {
      listeKnapp.dataset.koblet = "1";
      listeKnapp.addEventListener("click", window.behHentBehandlere);
    }
    const avbrytKnapp = document.getElementById("avbrytBehandlerRedigeringKnapp");
    if (avbrytKnapp && avbrytKnapp.dataset.koblet !== "1") {
      avbrytKnapp.dataset.koblet = "1";
      avbrytKnapp.addEventListener("click", () => {
        nullstillBehandlerSkjema();
        const melding = document.getElementById("nyBehandlerMelding");
        if (melding) melding.textContent = "";
      });
    }
    const passordKnapp = document.getElementById("lagNyBehandlerPassordKnapp");
    if (passordKnapp && passordKnapp.dataset.koblet !== "1") {
      passordKnapp.dataset.koblet = "1";
      passordKnapp.addEventListener("click", () => {
        const felt = document.getElementById("nyBehandlerPassord");
        if (felt) felt.value = lagMidlertidigPassord();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      kobleSystemeierKnapper();
      sjekkInnlogging();
    });
  } else {
    kobleSystemeierKnapper();
    sjekkInnlogging();
  }
})();
