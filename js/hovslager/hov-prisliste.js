console.log("hov-prisliste.js lastet");

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

async function hentPrislisteTilApp() {
  const div = document.getElementById("prislisteApp");
  const melding = document.getElementById("prislisteAppMelding");

  function si(tekst, feil = false) {
    if (!melding) return;
    melding.textContent = tekst || "";
    melding.style.color = feil ? "#b42318" : "#116329";
  }

  if (!div) return;

  if (!window.supabaseClient) {
    si("Supabase er ikke klar. Last siden på nytt.", true);
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
    si(res.error.message, true);
    return;
  }

  const priser = res.data || [];

  if (!priser.length) {
    div.innerHTML = `<div class="listekort">Ingen priser er lagt inn ennå.</div>`;
    si("");
    return;
  }

  const rader = priser.map(p => {
    const eks = Number(p.pris || 0);
    const mva = eks * 0.25;
    const inkl = eks + mva;

    return `
      <tr>
        <td style="padding:8px; border-bottom:1px solid #475569;">${prislisteSafe(p.navn)}</td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;">${prislisteKr(eks)} kr</td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;">${prislisteKr(mva)} kr</td>
        <td style="padding:8px; border-bottom:1px solid #475569; text-align:right;"><b>${prislisteKr(inkl)} kr</b></td>
      </tr>
    `;
  }).join("");

  div.innerHTML = `
    <div class="listekort">
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:620px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px; border-bottom:1px solid #475569;">Jobbtype</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #475569;">Eks. mva</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #475569;">MVA</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #475569;">Inkl. mva</th>
            </tr>
          </thead>
          <tbody>${rader}</tbody>
        </table>
      </div>
    </div>
  `;

  si("");
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (window.supabaseClient) {
      hentPrislisteTilApp();
    }
  }, 600);
});

window.hentPrislisteTilApp = hentPrislisteTilApp;
