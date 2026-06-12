console.log("hov-prisliste.js lastet - redigerbar prisliste");

let hovPriser = [];

function prislisteKr(n) {
  return Number(n || 0).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function prislisteSafe(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hovPrisMelding(tekst, feil = false) {
  const melding = document.getElementById("prislisteAppMelding");
  if (!melding) return;
  melding.textContent = tekst || "";
  melding.style.color = feil ? "#fca5a5" : "#86efac";
}

function hovPrisFelt(id) {
  return document.getElementById(id);
}

function hovPrisVal(id) {
  return String(hovPrisFelt(id)?.value || "").trim();
}

function hovSettPrisVal(id, verdi) {
  const el = hovPrisFelt(id);
  if (el) el.value = verdi ?? "";
}

function hovSikrePrisSkjema() {
  const side = document.getElementById("prislisteSide");
  const liste = document.getElementById("prislisteApp");
  if (!side || !liste || document.getElementById("hovPrisSkjema")) return;

  const skjema = document.createElement("div");
  skjema.id = "hovPrisSkjema";
  skjema.className = "listekort";
  skjema.innerHTML = `
    <h3 id="prisSkjemaTittel" style="margin-top:0;">Ny pris</h3>
    <input id="prisId" type="hidden">
    <div class="rad">
      <div>
        <label for="prisNavn">Navn</label>
        <input id="prisNavn" placeholder="F.eks. Fullbeslag">
      </div>
      <div>
        <label for="prisBelop">Pris eks. mva</label>
        <input id="prisBelop" type="number" step="0.01" min="0" placeholder="0">
      </div>
      <div>
        <label for="prisSortering">Sortering</label>
        <input id="prisSortering" type="number" step="1" value="0">
      </div>
    </div>
    <button id="lagrePrisKnapp" type="button">Lagre pris</button>
    <button id="nyPrisKnapp" type="button" class="secondary">Ny pris</button>
    <button id="slettPrisKnapp" type="button" class="danger">Slett pris</button>
    <p class="info">Klikk på en pris i listen under for å redigere den.</p>
  `;

  side.insertBefore(skjema, liste);
  document.getElementById("lagrePrisKnapp")?.addEventListener("click", lagreHovPris);
  document.getElementById("nyPrisKnapp")?.addEventListener("click", nyHovPris);
  document.getElementById("slettPrisKnapp")?.addEventListener("click", slettHovPris);
}

function nyHovPris() {
  hovSettPrisVal("prisId", "");
  hovSettPrisVal("prisNavn", "");
  hovSettPrisVal("prisBelop", "");
  hovSettPrisVal("prisSortering", 0);
  const t = document.getElementById("prisSkjemaTittel");
  if (t) t.textContent = "Ny pris";
  hovPrisMelding("");
  setTimeout(() => document.getElementById("prisNavn")?.focus(), 0);
}

function redigerHovPris(id) {
  hovSikrePrisSkjema();
  const p = hovPriser.find(x => String(x.id) === String(id));
  if (!p) {
    hovPrisMelding("Fant ikke prisen som skal redigeres.", true);
    return false;
  }

  hovSettPrisVal("prisId", p.id || "");
  hovSettPrisVal("prisNavn", p.navn || "");
  hovSettPrisVal("prisBelop", p.pris ?? 0);
  hovSettPrisVal("prisSortering", p.sortering ?? 0);

  const t = document.getElementById("prisSkjemaTittel");
  if (t) t.textContent = "Rediger pris";
  hovPrisMelding("Redigerer: " + (p.navn || "pris"));
  document.getElementById("hovPrisSkjema")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return false;
}

async function lagreHovPris() {
  hovSikrePrisSkjema();

  if (!window.supabaseClient) {
    hovPrisMelding("Supabase er ikke klar. Last siden på nytt.", true);
    return false;
  }

  const id = hovPrisVal("prisId");
  const navn = hovPrisVal("prisNavn");
  const pris = Number(hovPrisVal("prisBelop") || 0);
  const sortering = Number(hovPrisVal("prisSortering") || 0);

  if (!navn) {
    hovPrisMelding("Skriv navn på prisen.", true);
    document.getElementById("prisNavn")?.focus();
    return false;
  }

  const rad = {
    navn,
    pris,
    sortering,
    aktiv: true
  };

  hovPrisMelding("Lagrer pris ...");

  try {
    const res = id
      ? await supabaseClient.from("hov_priser").update(rad).eq("id", id)
      : await supabaseClient.from("hov_priser").insert(rad);

    if (res.error) throw res.error;

    hovPrisMelding(id ? "Prisen er oppdatert." : "Ny pris er lagret.");
    nyHovPris();
    await hentPrislisteTilApp();
    return false;
  } catch (e) {
    console.error(e);
    hovPrisMelding("Kunne ikke lagre pris: " + (e?.message || e), true);
    return false;
  }
}

async function slettHovPris() {
  const id = hovPrisVal("prisId");
  if (!id) {
    hovPrisMelding("Velg en pris fra listen først.", true);
    return false;
  }

  const p = hovPriser.find(x => String(x.id) === String(id));
  const navn = p?.navn || "denne prisen";
  if (!confirm("Slette/deaktivere " + navn + "?")) return false;

  try {
    const res = await supabaseClient
      .from("hov_priser")
      .update({ aktiv: false })
      .eq("id", id);

    if (res.error) throw res.error;
    hovPrisMelding("Prisen er slettet/deaktivert.");
    nyHovPris();
    await hentPrislisteTilApp();
    return false;
  } catch (e) {
    console.error(e);
    hovPrisMelding("Kunne ikke slette pris: " + (e?.message || e), true);
    return false;
  }
}

async function hentPrislisteTilApp() {
  hovSikrePrisSkjema();

  const div = document.getElementById("prislisteApp");
  if (!div) return;

  if (!window.supabaseClient) {
    hovPrisMelding("Supabase er ikke klar. Last siden på nytt.", true);
    return;
  }

  const res = await supabaseClient
    .from("hov_priser")
    .select("*")
    .eq("aktiv", true)
    .order("sortering", { ascending: true })
    .order("navn", { ascending: true });

  if (res.error) {
    console.error(res.error);
    hovPrisMelding(res.error.message, true);
    return;
  }

  hovPriser = res.data || [];

  if (!hovPriser.length) {
    div.innerHTML = `<div class="listekort">Ingen priser er lagt inn ennå.</div>`;
    hovPrisMelding("");
    return;
  }

  const rader = hovPriser.map(p => {
    const eks = Number(p.pris || 0);
    const mva = eks * 0.25;
    const inkl = eks + mva;

    return `
      <tr onclick="return redigerHovPris('${prislisteSafe(p.id)}')" style="cursor:pointer;">
        <td style="padding:8px; border-bottom:1px solid #475569;">${prislisteSafe(p.navn)}</td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;">${prislisteKr(eks)} kr</td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;">${prislisteKr(mva)} kr</td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;"><b>${prislisteKr(inkl)} kr</b></td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;">
          <button type="button" class="secondary" onclick="event.stopPropagation();return redigerHovPris('${prislisteSafe(p.id)}')">Rediger</button>
        </td>
      </tr>
    `;
  }).join("");

  div.innerHTML = `
    <div class="listekort">
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:720px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px; border-bottom:1px solid #475569;">Jobbtype</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #475569;">Eks. mva</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #475569;">MVA</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #475569;">Inkl. mva</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #475569;">Handling</th>
            </tr>
          </thead>
          <tbody>${rader}</tbody>
        </table>
      </div>
    </div>
  `;

  hovPrisMelding("");
}

function kobleHovPrisliste() {
  hovSikrePrisSkjema();
  document.getElementById("lagrePrisKnapp")?.addEventListener("click", lagreHovPris);
  document.getElementById("nyPrisKnapp")?.addEventListener("click", nyHovPris);
  document.getElementById("slettPrisKnapp")?.addEventListener("click", slettHovPris);
}

document.addEventListener("DOMContentLoaded", () => {
  kobleHovPrisliste();
  setTimeout(() => {
    if (window.supabaseClient) hentPrislisteTilApp();
  }, 600);
});

window.hentPrislisteTilApp = hentPrislisteTilApp;
window.redigerHovPris = redigerHovPris;
window.nyHovPris = nyHovPris;
window.lagreHovPris = lagreHovPris;
window.slettHovPris = slettHovPris;
