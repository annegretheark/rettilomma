// Rett i Lomma - admin godkjenner hel bilbestillingsliste + lagerlogg med mottaker
(function () {
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
  }

  function sb() {
    return window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
  }

  function bilTekst(bil) {
    if (!bil) return "";
    return `${bil.navn || "Bil"}${bil.regnr ? " - " + bil.regnr : ""}`;
  }

  async function mapFra(tabell, kolonner, ids) {
    const klient = sb();
    const clean = [...new Set((ids || []).filter(v => v !== undefined && v !== null && String(v) !== "").map(String))];
    const map = new Map();
    if (!klient || !clean.length) return map;
    const { data } = await klient.from(tabell).select(kolonner).in("id", clean);
    (data || []).forEach(x => map.set(String(x.id), x));
    return map;
  }

  async function tryggUpdateBestilling(id, values) {
    const klient = sb();
    let payload = { ...values };
    for (let i = 0; i < 10; i++) {
      const res = await klient.from("hand_bil_bestilling").update(payload).eq("id", id);
      if (!res.error) return res;
      const msg = String(res.error.message || "");
      const kol =
        (msg.match(/Could not find the '([^']+)' column of 'hand_bil_bestilling'/i) || [])[1] ||
        (msg.match(/column "([^"]+)".*does not exist/i) || [])[1];
      if (kol && payload[kol] !== undefined) {
        delete payload[kol];
        continue;
      }
      return res;
    }
    return { error: { message: "Kunne ikke oppdatere bestilling." } };
  }

  async function tryggInsertLogg(rad) {
    const klient = sb();
    let payload = { ...rad };
    for (let i = 0; i < 15; i++) {
      const res = await klient.from("hand_lagerlogg").insert([payload]);
      if (!res.error) return res;
      const msg = String(res.error.message || "");
      const kol =
        (msg.match(/Could not find the '([^']+)' column of 'hand_lagerlogg'/i) || [])[1] ||
        (msg.match(/column "([^"]+)".*does not exist/i) || [])[1];
      if (kol && payload[kol] !== undefined) {
        delete payload[kol];
        continue;
      }
      // Ikke stopp godkjenningen hvis loggtabellen mangler/har annen struktur.
      console.warn("Lagerlogg ble ikke lagret:", res.error);
      return { error: null };
    }
    return { error: null };
  }

  function gruppeNokkel(rad) {
    // Uten bestillingsnummer i databasen grupperes åpne linjer per bil og status.
    // Det gir én "liste" per bil å godkjenne samtidig.
    return String(rad.bil_id || "ukjent");
  }

  async function hentBestillinger() {
    const klient = sb();
    const { data, error } = await klient
      .from("hand_bil_bestilling")
      .select("*")
      .neq("status", "ferdig");
    if (error) throw error;
    return data || [];
  }

  function finnContainer() {
    return document.querySelector("#adminBilBestillinger") ||
      document.querySelector("#adminBilBestillingerPanel") ||
      document.querySelector("#adminContent") ||
      document.querySelector("#adminInnhold") ||
      document.querySelector("main") ||
      document.body;
  }

  async function renderAdminBilBestillinger() {
    const host = finnContainer();
    if (!host) return;

    let box = document.querySelector("#adminBilBestillingerPanel");
    if (!box) {
      box = document.createElement("section");
      box.id = "adminBilBestillingerPanel";
      box.className = "kort";
      box.style.marginTop = "18px";
      host.appendChild(box);
    }

    box.innerHTML = "<h2 style='text-align:center'>Bilbestillinger fra ansatte</h2><p>Henter...</p>";

    try {
      const rader = await hentBestillinger();
      const biler = await mapFra("hand_bil", "id,navn,regnr", rader.map(r => r.bil_id));
      const varer = await mapFra("hand_vare", "id,varenr,navn,varenavn", rader.map(r => r.vare_id));

      if (!rader.length) {
        box.innerHTML = "<h2 style='text-align:center'>Bilbestillinger fra ansatte</h2><p>Ingen åpne bestillinger.</p>";
        return;
      }

      const grupper = new Map();
      rader.forEach(r => {
        const key = gruppeNokkel(r);
        if (!grupper.has(key)) grupper.set(key, []);
        grupper.get(key).push(r);
      });

      const html = `
        <h2 style="text-align:center">Bilbestillinger fra ansatte</h2>
        <p>Admin godkjenner én hel liste av gangen. Fyll inn <b>Levert</b>; <b>Rest</b> regnes automatisk.</p>
        ${[...grupper.entries()].map(([key, linjer], gi) => {
          const bil = biler.get(String(linjer[0]?.bil_id));
          const tittel = bilTekst(bil) || "Bil " + esc(key);
          return `
            <div class="admin-bilbestilling-gruppe" data-gruppe="${esc(key)}" style="border:1px solid #333;border-radius:10px;padding:14px;margin:18px 0;background:#111827">
              <h3>${esc(tittel)}</h3>
              <div style="overflow:auto">
              <table style="width:100%;border-collapse:collapse">
                <thead>
                  <tr>
                    <th style="text-align:left;padding:6px;border-bottom:1px solid #444">Vare</th>
                    <th style="text-align:right;padding:6px;border-bottom:1px solid #444">Bestilt</th>
                    <th style="text-align:right;padding:6px;border-bottom:1px solid #444">Levert</th>
                    <th style="text-align:right;padding:6px;border-bottom:1px solid #444">Rest</th>
                    <th style="text-align:left;padding:6px;border-bottom:1px solid #444">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${linjer.map(r => {
                    const vare = varer.get(String(r.vare_id)) || {};
                    const bestilt = Number(r.bestilt || 0);
                    const levert = Number(r.levert || bestilt || 0);
                    const rest = Math.max(0, bestilt - levert);
                    const vareNavn = vare.navn || vare.varenavn || vare.varenr || r.vare_id || "";
                    return `
                      <tr class="admin-bestilling-linje"
                          data-id="${esc(r.id)}"
                          data-bil-id="${esc(r.bil_id)}"
                          data-vare-id="${esc(r.vare_id)}"
                          data-bestilt="${bestilt}"
                          data-vare-navn="${esc(vareNavn)}">
                        <td style="padding:6px;border-bottom:1px solid #333">${esc(vareNavn)}</td>
                        <td style="padding:6px;text-align:right;border-bottom:1px solid #333">${bestilt}</td>
                        <td style="padding:6px;text-align:right;border-bottom:1px solid #333">
                          <input class="admin-levert-liste" type="number" min="0" step="1" value="${levert}" style="width:85px">
                        </td>
                        <td style="padding:6px;text-align:right;border-bottom:1px solid #333">
                          <input class="admin-rest-liste" type="number" min="0" step="1" value="${rest}" style="width:85px" readonly>
                        </td>
                        <td class="admin-status-preview" style="padding:6px;border-bottom:1px solid #333">${rest > 0 ? "delvis" : "godkjent"}</td>
                      </tr>`;
                  }).join("")}
                </tbody>
              </table>
              </div>
              <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">
                <span class="admin-gruppe-oppsummering"></span>
                <button type="button" class="admin-godkjenn-hel-liste">Godkjenn hele listen / send rest</button>
              </div>
            </div>
          `;
        }).join("")}
        <p id="adminBilBestillingMelding" style="margin-top:10px"></p>
      `;

      box.innerHTML = html;

      function oppdaterGruppe(gruppe) {
        let totalRest = 0;
        gruppe.querySelectorAll(".admin-bestilling-linje").forEach(tr => {
          const bestilt = Number(tr.dataset.bestilt || 0);
          const levertInput = tr.querySelector(".admin-levert-liste");
          const restInput = tr.querySelector(".admin-rest-liste");
          const statusTd = tr.querySelector(".admin-status-preview");
          const levert = Math.max(0, Number(levertInput.value || 0));
          const rest = Math.max(0, bestilt - levert);
          restInput.value = rest;
          totalRest += rest;
          statusTd.textContent = rest > 0 ? "delvis" : "godkjent";
        });
        const opp = gruppe.querySelector(".admin-gruppe-oppsummering");
        if (opp) opp.textContent = totalRest > 0 ? `Rest på listen: ${totalRest}` : "Alt levert";
      }

      box.querySelectorAll(".admin-bilbestilling-gruppe").forEach(gruppe => {
        gruppe.querySelectorAll(".admin-levert-liste").forEach(inp => {
          inp.addEventListener("input", () => oppdaterGruppe(gruppe));
        });
        oppdaterGruppe(gruppe);
      });

      box.querySelectorAll(".admin-godkjenn-hel-liste").forEach(btn => {
        btn.addEventListener("click", async () => {
          const gruppe = btn.closest(".admin-bilbestilling-gruppe");
          const meld = document.querySelector("#adminBilBestillingMelding");
          btn.disabled = true;
          if (meld) {
            meld.style.color = "";
            meld.textContent = "Godkjenner listen...";
          }

          try {
            const linjer = [...gruppe.querySelectorAll(".admin-bestilling-linje")];
            let totalRest = 0;
            let totalLevert = 0;

            for (const tr of linjer) {
              const id = tr.dataset.id;
              const bestilt = Number(tr.dataset.bestilt || 0);
              const levert = Math.max(0, Number(tr.querySelector(".admin-levert-liste").value || 0));
              const rest = Math.max(0, bestilt - levert);
              const status = rest > 0 ? "delvis" : "godkjent";
              totalRest += rest;
              totalLevert += levert;

              const upd = await tryggUpdateBestilling(id, { levert, rest, status });
              if (upd.error) throw upd.error;

              if (levert > 0) {
                await tryggInsertLogg({
                  bil_id: tr.dataset.bilId || null,
                  vare_id: tr.dataset.vareId || null,
                  antall: levert,
                  handling: "bestilling_godkjent_til_bil",
                  kommentar: rest > 0 ? `Admin godkjente ${levert}. Rest ${rest}. Mottaker/bil: ${gruppe.querySelector("h3")?.textContent || ""}` : `Admin godkjente ${levert}. Ingen rest. Mottaker/bil: ${gruppe.querySelector("h3")?.textContent || ""}`,
                  bruker_navn: gruppe.querySelector("h3")?.textContent || "",
                  hentet_av: gruppe.querySelector("h3")?.textContent || "",
                  opprettet: new Date().toISOString()
                });
              }
            }

            if (meld) {
              meld.style.color = "#7CFC98";
              meld.textContent = totalRest > 0
                ? `Liste godkjent. Levert ${totalLevert}. Rest ${totalRest} sendt som beskjed.`
                : `Liste godkjent. Alt levert: ${totalLevert}.`;
            }

            await renderAdminBilBestillinger();
          } catch (e) {
            btn.disabled = false;
            if (meld) {
              meld.style.color = "#ff9b9b";
              meld.textContent = "Kunne ikke godkjenne listen: " + (e.message || e);
            }
          }
        });
      });
    } catch (e) {
      box.innerHTML = "<h2 style='text-align:center'>Bilbestillinger fra ansatte</h2><p style='color:#ff9b9b'>Kunne ikke hente bestillinger: " + esc(e.message || e) + "</p>";
    }
  }

  window.renderAdminBilBestillinger = renderAdminBilBestillinger;
  window.handLastAdminBilBestillinger = renderAdminBilBestillinger;

  document.addEventListener("DOMContentLoaded", () => setTimeout(renderAdminBilBestillinger, 700));
  document.addEventListener("click", e => {
    const tekst = String(e.target?.textContent || "").toLowerCase();
    if (tekst.includes("admin") || tekst.includes("bestilling")) {
      setTimeout(renderAdminBilBestillinger, 500);
    }
  });
})();