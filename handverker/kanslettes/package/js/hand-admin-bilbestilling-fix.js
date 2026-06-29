// Rett i Lomma - adminskjerm for bilbestillinger, godkjent og rest
(function () {
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
  }

  function klient() {
    return window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
  }

  async function hentVarerMap(ids) {
    const sb = klient();
    const map = new Map();
    const clean = [...new Set((ids || []).filter(Boolean).map(String))];
    if (!sb || !clean.length) return map;
    const { data } = await sb.from("hand_vare").select("id, varenr, navn, varenavn").in("id", clean);
    (data || []).forEach(v => map.set(String(v.id), v));
    return map;
  }

  async function hentBilerMap(ids) {
    const sb = klient();
    const map = new Map();
    const clean = [...new Set((ids || []).filter(v => v !== undefined && v !== null && String(v) !== "").map(String))];
    if (!sb || !clean.length) return map;
    const { data } = await sb.from("hand_bil").select("id, navn, regnr").in("id", clean);
    (data || []).forEach(v => map.set(String(v.id), v));
    return map;
  }

  async function hentBestillinger() {
    const sb = klient();
    if (!sb) throw new Error("Supabase er ikke lastet.");
    const res = await sb.from("hand_bil_bestilling").select("*").neq("status", "ferdig");
    if (res.error) throw res.error;
    return res.data || [];
  }

  function finnAdminContainer() {
    return document.querySelector("#adminBilBestillinger") ||
      document.querySelector("#hand-admin-bilbestillinger") ||
      document.querySelector("#adminContent") ||
      document.querySelector("#adminInnhold") ||
      document.querySelector("main") ||
      document.body;
  }

  async function renderAdminBilBestillinger() {
    const host = finnAdminContainer();
    if (!host) return;

    let box = document.querySelector("#adminBilBestillingerPanel");
    if (!box) {
      box = document.createElement("section");
      box.id = "adminBilBestillingerPanel";
      box.className = "kort";
      box.style.marginTop = "18px";
      host.appendChild(box);
    }

    box.innerHTML = "<h2 style='text-align:center'>Bilbestillinger fra ansatte</h2><p>Henter bestillinger...</p>";

    try {
      const rader = await hentBestillinger();
      const biler = await hentBilerMap(rader.map(r => r.bil_id));
      const varer = await hentVarerMap(rader.map(r => r.vare_id));

      if (!rader.length) {
        box.innerHTML = "<h2 style='text-align:center'>Bilbestillinger fra ansatte</h2><p>Ingen åpne bilbestillinger.</p>";
        return;
      }

      const html = `
        <h2 style="text-align:center">Bilbestillinger fra ansatte</h2>
        <p>Fyll inn levert antall. Rest regnes automatisk. Trykk <b>Godkjenn / send rest</b> når admin har plukket varer.</p>
        <div style="overflow:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="text-align:left;padding:6px;border-bottom:1px solid #444">Bil</th>
                <th style="text-align:left;padding:6px;border-bottom:1px solid #444">Vare</th>
                <th style="text-align:right;padding:6px;border-bottom:1px solid #444">Bestilt</th>
                <th style="text-align:right;padding:6px;border-bottom:1px solid #444">Levert</th>
                <th style="text-align:right;padding:6px;border-bottom:1px solid #444">Rest</th>
                <th style="padding:6px;border-bottom:1px solid #444">Status</th>
                <th style="padding:6px;border-bottom:1px solid #444"></th>
              </tr>
            </thead>
            <tbody>
              ${rader.map(r => {
                const bil = biler.get(String(r.bil_id)) || {};
                const vare = varer.get(String(r.vare_id)) || {};
                const bestilt = Number(r.bestilt || 0);
                const levert = Number(r.levert || 0);
                const rest = Math.max(0, bestilt - levert);
                const bilTxt = bil.navn ? `${bil.navn}${bil.regnr ? " - " + bil.regnr : ""}` : esc(r.bil_id || "");
                const vareTxt = vare.navn || vare.varenavn || vare.varenr || r.vare_id || "";
                return `
                  <tr data-bestilling-id="${esc(r.id)}" data-bestilt="${bestilt}">
                    <td style="padding:6px;border-bottom:1px solid #333">${esc(bilTxt)}</td>
                    <td style="padding:6px;border-bottom:1px solid #333">${esc(vareTxt)}</td>
                    <td style="padding:6px;text-align:right;border-bottom:1px solid #333">${bestilt}</td>
                    <td style="padding:6px;text-align:right;border-bottom:1px solid #333">
                      <input class="admin-bil-levert" type="number" min="0" step="1" value="${levert || bestilt}" style="width:80px">
                    </td>
                    <td style="padding:6px;text-align:right;border-bottom:1px solid #333">
                      <input class="admin-bil-rest" type="number" min="0" step="1" value="${rest}" style="width:80px">
                    </td>
                    <td style="padding:6px;text-align:center;border-bottom:1px solid #333">${esc(r.status || "venter")}</td>
                    <td style="padding:6px;text-align:right;border-bottom:1px solid #333">
                      <button class="admin-godkjenn-bilbestilling" type="button">Godkjenn / send rest</button>
                    </td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        <p id="adminBilBestillingMelding" style="margin-top:10px"></p>
      `;

      box.innerHTML = html;

      box.querySelectorAll("tr[data-bestilling-id]").forEach(tr => {
        const bestilt = Number(tr.dataset.bestilt || 0);
        const levertInput = tr.querySelector(".admin-bil-levert");
        const restInput = tr.querySelector(".admin-bil-rest");
        const calc = () => {
          const levert = Math.max(0, Number(levertInput.value || 0));
          restInput.value = Math.max(0, bestilt - levert);
        };
        levertInput.addEventListener("input", calc);
      });

      box.querySelectorAll(".admin-godkjenn-bilbestilling").forEach(btn => {
        btn.addEventListener("click", async () => {
          const tr = btn.closest("tr[data-bestilling-id]");
          const id = tr.dataset.bestillingId;
          const bestilt = Number(tr.dataset.bestilt || 0);
          const levert = Math.max(0, Number(tr.querySelector(".admin-bil-levert").value || 0));
          const rest = Math.max(0, Number(tr.querySelector(".admin-bil-rest").value || Math.max(0, bestilt - levert)));
          const status = rest > 0 ? "delvis" : "godkjent";
          const meld = document.querySelector("#adminBilBestillingMelding");
          btn.disabled = true;
          if (meld) meld.textContent = "Sender beskjed...";

          const sb = klient();
          const { error } = await sb.from("hand_bil_bestilling").update({
            levert,
            rest,
            status
          }).eq("id", id);

          if (error) {
            btn.disabled = false;
            if (meld) {
              meld.style.color = "#ff9b9b";
              meld.textContent = "Kunne ikke godkjenne: " + error.message;
            }
            return;
          }

          if (meld) {
            meld.style.color = "#7CFC98";
            meld.textContent = rest > 0
              ? "Godkjent. Beskjed sendt med rest: " + rest
              : "Godkjent. Beskjed sendt uten rest.";
          }
          await renderAdminBilBestillinger();
        });
      });
    } catch (e) {
      box.innerHTML = "<h2 style='text-align:center'>Bilbestillinger fra ansatte</h2><p style='color:#ff9b9b'>Kunne ikke hente bilbestillinger: " + esc(e.message || e) + "</p>";
    }
  }

  window.renderAdminBilBestillinger = renderAdminBilBestillinger;
  window.handLastAdminBilBestillinger = renderAdminBilBestillinger;

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      const txt = document.body.innerText || "";
      if (/admin/i.test(txt) || document.querySelector("#adminContent,#adminInnhold,#adminBilBestillinger")) {
        renderAdminBilBestillinger();
      }
    }, 800);
  });

  document.addEventListener("click", e => {
    const t = String(e.target?.textContent || "").toLowerCase();
    if (t.includes("admin") || t.includes("bestilling")) {
      setTimeout(renderAdminBilBestillinger, 600);
    }
  });
})();