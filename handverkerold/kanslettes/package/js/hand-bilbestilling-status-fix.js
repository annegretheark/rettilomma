// Rett i Lomma - vis beskjed til ansatt om godkjent/rest
(function () {
  function sb() {
    return window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
  }
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
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

  async function visBilBestillingStatus() {
    const klient = sb();
    const bilSelect = document.querySelector("#bilLagerBilSelect") || document.querySelector("#bilVelger") || document.querySelector("select");
    const bilId = bilSelect?.value;
    const host =
      document.querySelector("#bilBestillingStatus") ||
      document.querySelector("#bilLagerMelding") ||
      document.querySelector("#bilLagerPanel") ||
      document.querySelector("main") ||
      document.body;
    if (!klient || !host || !bilId) return;

    let box = document.querySelector("#bilBestillingStatusPanel");
    if (!box) {
      box = document.createElement("div");
      box.id = "bilBestillingStatusPanel";
      box.className = "kort";
      box.style.marginTop = "14px";
      host.appendChild(box);
    }

    const { data, error } = await klient
      .from("hand_bil_bestilling")
      .select("*")
      .eq("bil_id", bilId)
      .in("status", ["godkjent", "delvis"]);

    if (error || !data || !data.length) {
      box.innerHTML = "";
      return;
    }

    const varer = await mapFra("hand_vare", "id,varenr,navn,varenavn", data.map(r => r.vare_id));
    const rest = data.filter(r => Number(r.rest || 0) > 0);
    const levert = data.filter(r => Number(r.levert || 0) > 0);

    box.innerHTML = `
      <h3>Bestilling behandlet av admin</h3>
      <p>Dette er beskjed om hva som er godkjent og hva som står i rest.</p>
      <h4>Levert / godkjent</h4>
      <ul>
        ${levert.map(r => {
          const v = varer.get(String(r.vare_id)) || {};
          return `<li>${esc(v.navn || v.varenavn || v.varenr || r.vare_id)}: ${Number(r.levert || 0)}</li>`;
        }).join("") || "<li>Ingen varer levert ennå.</li>"}
      </ul>
      <h4>Rest</h4>
      <ul>
        ${rest.map(r => {
          const v = varer.get(String(r.vare_id)) || {};
          return `<li>${esc(v.navn || v.varenavn || v.varenr || r.vare_id)}: ${Number(r.rest || 0)}</li>`;
        }).join("") || "<li>Ingen rest.</li>"}
      </ul>
    `;
  }

  window.handVisBilBestillingStatus = visBilBestillingStatus;
  document.addEventListener("DOMContentLoaded", () => setTimeout(visBilBestillingStatus, 1000));
  document.addEventListener("change", e => {
    if (e.target && e.target.tagName === "SELECT") setTimeout(visBilBestillingStatus, 300);
  });
  document.addEventListener("click", e => {
    const tekst = String(e.target?.textContent || "").toLowerCase();
    if (tekst.includes("bil") || tekst.includes("lager")) setTimeout(visBilBestillingStatus, 700);
  });
})();