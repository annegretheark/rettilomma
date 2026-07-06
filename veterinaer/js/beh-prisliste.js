console.log("beh-prisliste.js lastet - redigerbar prisliste");

let behPriser = [];

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

function behPrisMelding(tekst, feil = false) {
  const melding = document.getElementById("prislisteAppMelding");
  if (!melding) return;
  melding.textContent = tekst || "";
  melding.style.color = feil ? "#fca5a5" : "#86efac";
}

function behPrisFelt(id) {
  return document.getElementById(id);
}

function behPrisVal(id) {
  return String(behPrisFelt(id)?.value || "").trim();
}

function behSettPrisVal(id, verdi) {
  const el = behPrisFelt(id);
  if (el) el.value = verdi ?? "";
}

function behSikrePrisSkjema() {
  const side = document.getElementById("prislisteSide");
  const liste = document.getElementById("prislisteApp");
  if (!side || !liste || document.getElementById("behPrisSkjema")) return;

  const skjema = document.createElement("div");
  skjema.id = "behPrisSkjema";
  skjema.className = "listekort";
  skjema.innerHTML = `
    <h3 id="prisSkjemaTittel" style="margin-top:0;">Ny pris</h3>
    <input id="prisId" type="hidden">
    <div class="rad">
      <div>
        <label for="prisNavn">Navn</label>
        <input id="prisNavn" placeholder="F.eks. Behandling">
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
  document.getElementById("lagrePrisKnapp")?.addEventListener("click", lagreBehPris);
  document.getElementById("nyPrisKnapp")?.addEventListener("click", nyBehPris);
  document.getElementById("slettPrisKnapp")?.addEventListener("click", slettBehPris);
}

function nyBehPris() {
  behSettPrisVal("prisId", "");
  behSettPrisVal("prisNavn", "");
  behSettPrisVal("prisBelop", "");
  behSettPrisVal("prisSortering", 0);
  const t = document.getElementById("prisSkjemaTittel");
  if (t) t.textContent = "Ny pris";
  behPrisMelding("");
  setTimeout(() => document.getElementById("prisNavn")?.focus(), 0);
}

function redigerBehPris(id) {
  behSikrePrisSkjema();
  const p = behPriser.find(x => String(x.id) === String(id));
  if (!p) {
    behPrisMelding("Fant ikke prisen som skal redigeres.", true);
    return false;
  }

  behSettPrisVal("prisId", p.id || "");
  behSettPrisVal("prisNavn", p.navn || "");
  behSettPrisVal("prisBelop", p.pris ?? 0);
  behSettPrisVal("prisSortering", p.sortering ?? 0);

  const t = document.getElementById("prisSkjemaTittel");
  if (t) t.textContent = "Rediger pris";
  behPrisMelding("Redigerer: " + (p.navn || "pris"));
  document.getElementById("behPrisSkjema")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return false;
}

async function lagreBehPris() {
  behSikrePrisSkjema();

  if (!window.supabaseClient) {
    behPrisMelding("Supabase er ikke klar. Last siden på nytt.", true);
    return false;
  }

  const id = behPrisVal("prisId");
  const navn = behPrisVal("prisNavn");
  const pris = Number(behPrisVal("prisBelop") || 0);
  const sortering = Number(behPrisVal("prisSortering") || 0);

  if (!navn) {
    behPrisMelding("Skriv navn på prisen.", true);
    document.getElementById("prisNavn")?.focus();
    return false;
  }

  const rad = {
    navn,
    pris,
    sortering,
    aktiv: true
  };

  behPrisMelding("Lagrer pris ...");

  try {
    const res = id
      ? await supabaseClient.from("beh_priser").update(rad).eq("id", id)
      : await supabaseClient.from("beh_priser").insert(rad);

    if (res.error) throw res.error;

    behPrisMelding(id ? "Prisen er oppdatert." : "Ny pris er lagret.");
    nyBehPris();
    await hentPrislisteTilApp();
    return false;
  } catch (e) {
    console.error(e);
    behPrisMelding("Kunne ikke lagre pris: " + (e?.message || e), true);
    return false;
  }
}

async function slettBehPris() {
  const id = behPrisVal("prisId");
  if (!id) {
    behPrisMelding("Velg en pris fra listen først.", true);
    return false;
  }

  const p = behPriser.find(x => String(x.id) === String(id));
  const navn = p?.navn || "denne prisen";
  if (!confirm("Slette/deaktivere " + navn + "?")) return false;

  try {
    const res = await supabaseClient
      .from("beh_priser")
      .update({ aktiv: false })
      .eq("id", id);

    if (res.error) throw res.error;
    behPrisMelding("Prisen er slettet/deaktivert.");
    nyBehPris();
    await hentPrislisteTilApp();
    return false;
  } catch (e) {
    console.error(e);
    behPrisMelding("Kunne ikke slette pris: " + (e?.message || e), true);
    return false;
  }
}

async function hentPrislisteTilApp() {
  behSikrePrisSkjema();

  const div = document.getElementById("prislisteApp");
  if (!div) return;

  if (!window.supabaseClient) {
    behPrisMelding("Supabase er ikke klar. Last siden på nytt.", true);
    return;
  }

  const res = await supabaseClient
    .from("beh_priser")
    .select("*")
    .eq("aktiv", true)
    .order("sortering", { ascending: true })
    .order("navn", { ascending: true });

  if (res.error) {
    console.error(res.error);
    behPrisMelding(res.error.message, true);
    return;
  }

  behPriser = res.data || [];

  if (!behPriser.length) {
    div.innerHTML = `<div class="listekort">Ingen priser er lagt inn ennå.</div>`;
    behPrisMelding("");
    return;
  }

  const rader = behPriser.map(p => {
    const eks = Number(p.pris || 0);
    const mva = eks * 0.25;
    const inkl = eks + mva;

    return `
      <tr onclick="return redigerBehPris('${prislisteSafe(p.id)}')" style="cursor:pointer;">
        <td style="padding:8px; border-bottom:1px solid #475569;">${prislisteSafe(p.navn)}</td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;">${prislisteKr(eks)} kr</td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;">${prislisteKr(mva)} kr</td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;"><b>${prislisteKr(inkl)} kr</b></td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;">
          <button type="button" class="secondary" onclick="event.stopPropagation();return redigerBehPris('${prislisteSafe(p.id)}')">Rediger</button>
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
              <th style="text-align:left; padding:8px; border-bottom:1px solid #475569;">Behandlingtype</th>
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

  behPrisMelding("");
}

function kobleBehPrisliste() {
  behSikrePrisSkjema();
  document.getElementById("lagrePrisKnapp")?.addEventListener("click", lagreBehPris);
  document.getElementById("nyPrisKnapp")?.addEventListener("click", nyBehPris);
  document.getElementById("slettPrisKnapp")?.addEventListener("click", slettBehPris);
}

document.addEventListener("DOMContentLoaded", () => {
  kobleBehPrisliste();
  setTimeout(() => {
    if (window.supabaseClient) hentPrislisteTilApp();
  }, 600);
});

window.hentPrislisteTilApp = hentPrislisteTilApp;
window.redigerBehPris = redigerBehPris;
window.nyBehPris = nyBehPris;
window.lagreBehPris = lagreBehPris;
window.slettBehPris = slettBehPris;
