/* Hand - tilbudsmodul
   Bruker nye, tydelige tabellnavn:
   - hand_tilbud
   - hand_tilbud_linje
*/
(function () {
  let handTilbud = [];
  let handTilbudLinjer = [];

  function $(id) { return document.getElementById(id); }

  function melding(tekst, ok) {
    const el = $("tilbudMelding");
    if (!el) return;
    el.textContent = tekst || "";
    el.style.color = ok ? "#86efac" : "#fca5a5";
  }

  function krevSupabase() {
    if (!window.supabaseClient) {
      melding("Supabase er ikke lastet. Sjekk js/core/config.js.");
      return false;
    }
    return true;
  }

  function dagensDato() {
    return new Date().toISOString().slice(0, 10);
  }

  function leggTilDager(dato, dager) {
    const d = new Date(dato || dagensDato());
    d.setDate(d.getDate() + dager);
    return d.toISOString().slice(0, 10);
  }

  function nr(n) {
    const x = Number(n || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function penger(n) {
    return nr(n).toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fyllTilbudKundeDropdown() {
    const select = $("tilbudKundeValg");
    if (!select) return;
    const valgt = select.value;
    const kunder = Array.isArray(window.kunder) ? window.kunder : [];
    select.innerHTML = '<option value="">Velg kunde</option>';
    kunder.forEach(function (kunde) {
      const opt = document.createElement("option");
      opt.value = kunde.id;
      opt.textContent = kunde.navn || kunde.epost || "Kunde";
      select.appendChild(opt);
    });
    if (valgt && Array.from(select.options).some(o => String(o.value) === String(valgt))) {
      select.value = valgt;
    }
    fyllTilbudProsjektDropdown();
  }

  function fyllTilbudProsjektDropdown() {
    const select = $("tilbudProsjektValg");
    if (!select) return;
    const kundeId = $("tilbudKundeValg")?.value || "";
    const valgt = select.value;
    const prosjekter = Array.isArray(window.prosjekter) ? window.prosjekter : [];
    select.innerHTML = '<option value="">Ingen / velg prosjekt</option>';
    prosjekter
      .filter(p => !kundeId || String(p.kunde_id || p.kundeId || "") === String(kundeId))
      .forEach(function (prosjekt) {
        const opt = document.createElement("option");
        opt.value = prosjekt.id;
        opt.textContent = prosjekt.navn || prosjekt.prosjektnavn || prosjekt.nr || "Prosjekt";
        select.appendChild(opt);
      });
    if (valgt && Array.from(select.options).some(o => String(o.value) === String(valgt))) {
      select.value = valgt;
    }
  }

  function nullstillTilbudSkjema() {
    if ($("tilbudId")) $("tilbudId").value = "";
    if ($("tilbudNr")) $("tilbudNr").value = "";
    if ($("tilbudKundeValg")) $("tilbudKundeValg").value = "";
    if ($("tilbudProsjektValg")) $("tilbudProsjektValg").value = "";
    if ($("tilbudDato")) $("tilbudDato").value = dagensDato();
    if ($("tilbudGyldigTil")) $("tilbudGyldigTil").value = leggTilDager(dagensDato(), 30);
    if ($("tilbudStatus")) $("tilbudStatus").value = "utkast";
    if ($("tilbudNotat")) $("tilbudNotat").value = "";
    handTilbudLinjer = [];
    tegnTilbudLinjer();
    melding("");
  }

  function hentLinjeFraSkjema() {
    return {
      tekst: ($("tilbudLinjeTekst")?.value || "").trim(),
      antall: nr($("tilbudLinjeAntall")?.value || 1),
      enhet: ($("tilbudLinjeEnhet")?.value || "stk").trim(),
      pris: nr($("tilbudLinjePris")?.value || 0),
      mva_prosent: nr($("tilbudLinjeMva")?.value || 25)
    };
  }

  function leggTilTilbudLinje() {
    const linje = hentLinjeFraSkjema();
    if (!linje.tekst) { melding("Skriv tekst på tilbudslinjen."); return; }
    linje.sum_eks_mva = linje.antall * linje.pris;
    linje.mva = linje.sum_eks_mva * (linje.mva_prosent / 100);
    linje.sum_inkl_mva = linje.sum_eks_mva + linje.mva;
    handTilbudLinjer.push(linje);
    if ($("tilbudLinjeTekst")) $("tilbudLinjeTekst").value = "";
    if ($("tilbudLinjeAntall")) $("tilbudLinjeAntall").value = "1";
    if ($("tilbudLinjePris")) $("tilbudLinjePris").value = "0";
    tegnTilbudLinjer();
    melding("Linje lagt til.", true);
  }

  function slettTilbudLinje(index) {
    handTilbudLinjer.splice(index, 1);
    tegnTilbudLinjer();
  }

  function summerLinjer() {
    return handTilbudLinjer.reduce(function (acc, l) {
      const eks = nr(l.sum_eks_mva || (nr(l.antall) * nr(l.pris)));
      const mva = nr(l.mva || (eks * (nr(l.mva_prosent || 25) / 100)));
      acc.sum_eks_mva += eks;
      acc.mva += mva;
      acc.sum_inkl_mva += eks + mva;
      return acc;
    }, { sum_eks_mva: 0, mva: 0, sum_inkl_mva: 0 });
  }

  function tegnTilbudLinjer() {
    const el = $("tilbudLinjeListe");
    if (!el) return;
    if (!handTilbudLinjer.length) {
      el.innerHTML = '<p class="info">Ingen linjer lagt til ennå.</p>';
      oppdaterTilbudSummer();
      return;
    }
    let html = '<table class="okonomi-tabell"><thead><tr><th>Tekst</th><th>Antall</th><th>Enhet</th><th>Pris</th><th>Sum eks. mva</th><th></th></tr></thead><tbody>';
    handTilbudLinjer.forEach(function (linje, i) {
      html += '<tr>' +
        '<td>' + escapeHtml(linje.tekst) + '</td>' +
        '<td>' + penger(linje.antall) + '</td>' +
        '<td>' + escapeHtml(linje.enhet || '') + '</td>' +
        '<td>' + penger(linje.pris) + '</td>' +
        '<td>' + penger(linje.sum_eks_mva || nr(linje.antall) * nr(linje.pris)) + '</td>' +
        '<td><button type="button" class="danger okonomi-mini-knapp" onclick="window.slettTilbudLinje(' + i + ')">Slett</button></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    oppdaterTilbudSummer();
  }

  function oppdaterTilbudSummer() {
    const s = summerLinjer();
    const el = $("tilbudSummer");
    if (!el) return;
    el.innerHTML = '<div class="okonomi-grid">' +
      '<div class="okonomi-boks">Eks. mva<strong>' + penger(s.sum_eks_mva) + '</strong></div>' +
      '<div class="okonomi-boks">MVA<strong>' + penger(s.mva) + '</strong></div>' +
      '<div class="okonomi-boks">Inkl. mva<strong>' + penger(s.sum_inkl_mva) + '</strong></div>' +
      '</div>';
  }

  async function lastTilbud() {
    if (!krevSupabase()) return;
    melding("Henter tilbud...");
    const { data, error } = await supabaseClient
      .from("hand_tilbud")
      .select("*")
      .order("dato", { ascending: false });
    if (error) {
      melding("Kunne ikke hente tilbud. Har du kjørt SQL for hand_tilbud? " + error.message);
      return;
    }
    handTilbud = data || [];
    window.handTilbud = handTilbud;
    tegnTilbudListe();
    melding("Tilbud hentet.", true);
  }

  async function lagreTilbud() {
    if (!krevSupabase()) return;
    const kundeId = $("tilbudKundeValg")?.value || "";
    if (!kundeId) { melding("Velg kunde først."); return; }
    if (!handTilbudLinjer.length) { melding("Legg til minst én tilbudslinje."); return; }

    const id = $("tilbudId")?.value || "";
    const s = summerLinjer();
    const rad = {
      tilbud_nr: ($("tilbudNr")?.value || "").trim() || null,
      kunde_id: kundeId,
      prosjekt_id: $("tilbudProsjektValg")?.value || null,
      dato: $("tilbudDato")?.value || dagensDato(),
      gyldig_til: $("tilbudGyldigTil")?.value || null,
      status: $("tilbudStatus")?.value || "utkast",
      sum_eks_mva: s.sum_eks_mva,
      mva: s.mva,
      sum_inkl_mva: s.sum_inkl_mva,
      notat: ($("tilbudNotat")?.value || "").trim() || null
    };

    melding("Lagrer tilbud...");
    const res = id
      ? await supabaseClient.from("hand_tilbud").update(rad).eq("id", id).select().single()
      : await supabaseClient.from("hand_tilbud").insert([rad]).select().single();

    if (res.error) { melding("Kunne ikke lagre tilbud: " + res.error.message); return; }
    const tilbudId = res.data.id;

    if (id) {
      const del = await supabaseClient.from("hand_tilbud_linje").delete().eq("tilbud_id", tilbudId);
      if (del.error) { melding("Tilbud lagret, men gamle linjer kunne ikke slettes: " + del.error.message); return; }
    }

    const linjer = handTilbudLinjer.map(function (l, index) {
      const eks = nr(l.sum_eks_mva || (nr(l.antall) * nr(l.pris)));
      const mva = nr(l.mva || (eks * (nr(l.mva_prosent || 25) / 100)));
      return {
        tilbud_id: tilbudId,
        sortering: index + 1,
        tekst: l.tekst,
        antall: nr(l.antall),
        enhet: l.enhet || "stk",
        pris: nr(l.pris),
        mva_prosent: nr(l.mva_prosent || 25),
        sum_eks_mva: eks,
        mva: mva,
        sum_inkl_mva: eks + mva
      };
    });

    const linjeRes = await supabaseClient.from("hand_tilbud_linje").insert(linjer);
    if (linjeRes.error) { melding("Tilbud lagret, men linjer feilet: " + linjeRes.error.message); return; }

    melding("Tilbud lagret.", true);
    await lastTilbud();
    nullstillTilbudSkjema();
  }

  async function redigerTilbud(id) {
    if (!krevSupabase()) return;
    const tilbud = handTilbud.find(t => String(t.id) === String(id));
    if (!tilbud) { melding("Fant ikke tilbudet."); return; }

    if ($("tilbudId")) $("tilbudId").value = tilbud.id;
    if ($("tilbudNr")) $("tilbudNr").value = tilbud.tilbud_nr || "";
    if ($("tilbudKundeValg")) $("tilbudKundeValg").value = tilbud.kunde_id || "";
    fyllTilbudProsjektDropdown();
    if ($("tilbudProsjektValg")) $("tilbudProsjektValg").value = tilbud.prosjekt_id || "";
    if ($("tilbudDato")) $("tilbudDato").value = tilbud.dato || dagensDato();
    if ($("tilbudGyldigTil")) $("tilbudGyldigTil").value = tilbud.gyldig_til || "";
    if ($("tilbudStatus")) $("tilbudStatus").value = tilbud.status || "utkast";
    if ($("tilbudNotat")) $("tilbudNotat").value = tilbud.notat || "";

    const { data, error } = await supabaseClient
      .from("hand_tilbud_linje")
      .select("*")
      .eq("tilbud_id", id)
      .order("sortering", { ascending: true });

    if (error) { melding("Kunne ikke hente tilbudslinjer: " + error.message); return; }
    handTilbudLinjer = data || [];
    tegnTilbudLinjer();
    melding("Tilbud åpnet for redigering.", true);
    $("tilbudSide")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function slettTilbud(id) {
    if (!krevSupabase()) return;
    if (!confirm("Slette tilbudet?")) return;
    const linjeRes = await supabaseClient.from("hand_tilbud_linje").delete().eq("tilbud_id", id);
    if (linjeRes.error) { melding("Kunne ikke slette linjer: " + linjeRes.error.message); return; }
    const res = await supabaseClient.from("hand_tilbud").delete().eq("id", id);
    if (res.error) { melding("Kunne ikke slette tilbud: " + res.error.message); return; }
    melding("Tilbud slettet.", true);
    await lastTilbud();
  }

  function kundeNavn(id) {
    const kunde = (window.kunder || []).find(k => String(k.id) === String(id));
    return kunde ? (kunde.navn || kunde.epost || id) : id;
  }

  function tegnTilbudListe() {
    const el = $("tilbudListe");
    if (!el) return;
    if (!handTilbud.length) {
      el.innerHTML = '<p class="info">Ingen tilbud registrert ennå.</p>';
      return;
    }
    let html = '<table class="okonomi-tabell"><thead><tr><th>Dato</th><th>Nr</th><th>Kunde</th><th>Status</th><th>Sum inkl. mva</th><th></th></tr></thead><tbody>';
    handTilbud.forEach(function (t) {
      html += '<tr>' +
        '<td>' + escapeHtml(t.dato || '') + '</td>' +
        '<td>' + escapeHtml(t.tilbud_nr || '') + '</td>' +
        '<td>' + escapeHtml(kundeNavn(t.kunde_id)) + '</td>' +
        '<td>' + escapeHtml(t.status || '') + '</td>' +
        '<td>' + penger(t.sum_inkl_mva) + '</td>' +
        '<td><button type="button" class="okonomi-mini-knapp" onclick="window.redigerTilbud(\'' + t.id + '\')">Åpne</button> ' +
        '<button type="button" class="danger okonomi-mini-knapp" onclick="window.slettTilbud(\'' + t.id + '\')">Slett</button></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function initTilbud() {
    fyllTilbudKundeDropdown();
    nullstillTilbudSkjema();
    const kunde = $("tilbudKundeValg");
    if (kunde && kunde.dataset.handTilbudBindet !== "1") {
      kunde.dataset.handTilbudBindet = "1";
      kunde.addEventListener("change", fyllTilbudProsjektDropdown);
    }
  }

  window.fyllTilbudKundeDropdown = fyllTilbudKundeDropdown;
  window.fyllTilbudProsjektDropdown = fyllTilbudProsjektDropdown;
  window.nullstillTilbudSkjema = nullstillTilbudSkjema;
  window.leggTilTilbudLinje = leggTilTilbudLinje;
  window.slettTilbudLinje = slettTilbudLinje;
  window.lastTilbud = lastTilbud;
  window.lagreTilbud = lagreTilbud;
  window.redigerTilbud = redigerTilbud;
  window.slettTilbud = slettTilbud;
  window.initTilbud = initTilbud;

  window.addEventListener("load", function () {
    initTilbud();
  });
})();
