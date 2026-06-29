#!/usr/bin/env node
/*
  Sjekker om Hovslager-appen har data i Supabase.

  Kjoring:
    node sjekk-hovslager-data.mjs

  Hvis tabellene er beskyttet av innlogging/RLS, kjor med bruker:
    HOV_EMAIL="din@epost.no" HOV_PASSWORD="passord" node sjekk-hovslager-data.mjs
*/

const SUPABASE_URL = "https://pxlbrywowphkczkehmee.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tluvA83iCcKfmgfXetvz5g_farKpCTS";

const TABLES = [
  "hov_firma",
  "kunder",
  "hester",
  "hov_jobber",
  "hov_priser",
  "hov_fakturaer",
  "hov_kreditnotaer",
  "hov_hest_bilder",
  "hov_jobb_bilder"
];

const email = process.env.HOV_EMAIL;
const password = process.env.HOV_PASSWORD;
let accessToken = null;

async function supabaseFetch(path, options = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    ...options.headers
  };

  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers
  });
}

async function loginIfProvided() {
  if (!email || !password) return;

  const res = await supabaseFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Innlogging feilet: ${body.error_description || body.msg || body.message || res.status}`);
  }

  accessToken = body.access_token;
  console.log(`Innlogget som ${email}\n`);
}

async function countRows(table) {
  const res = await supabaseFetch(`/rest/v1/${encodeURIComponent(table)}?select=id`, {
    method: "HEAD",
    headers: {
      Prefer: "count=exact",
      Range: "0-0"
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { table, ok: false, status: res.status, error: text || res.statusText };
  }

  const range = res.headers.get("content-range") || "";
  const match = range.match(/\/(\d+)$/);
  return { table, ok: true, count: match ? Number(match[1]) : null };
}

async function sampleRows(table) {
  const res = await supabaseFetch(`/rest/v1/${encodeURIComponent(table)}?select=*&limit=3`, {
    headers: { Accept: "application/json" }
  });

  if (!res.ok) return [];
  return await res.json().catch(() => []);
}

function printSample(rows) {
  for (const row of rows) {
    const preview = Object.fromEntries(
      Object.entries(row)
        .filter(([key]) => !/token|password|passord|secret|key/i.test(key))
        .slice(0, 6)
    );
    console.log("    eksempel:", JSON.stringify(preview));
  }
}

async function main() {
  await loginIfProvided();

  let totalKnownRows = 0;
  let inaccessible = 0;

  console.log("Sjekker data i Hovslager Supabase...\n");

  for (const table of TABLES) {
    const result = await countRows(table);

    if (!result.ok) {
      inaccessible += 1;
      console.log(`- ${table}: kunne ikke leses (${result.status})`);
      continue;
    }

    const countText = result.count === null ? "ukjent antall" : `${result.count} rad(er)`;
    console.log(`- ${table}: ${countText}`);

    if (typeof result.count === "number") totalKnownRows += result.count;
    if (result.count && result.count > 0) {
      const rows = await sampleRows(table);
      printSample(rows);
    }
  }

  console.log("\nOppsummering:");
  if (totalKnownRows > 0) {
    console.log(`JA: Appen har data i de lesbare tabellene (${totalKnownRows} rader totalt).`);
  } else if (inaccessible > 0) {
    console.log("USIKKERT: Ingen lesbare rader funnet, men noen tabeller kunne ikke leses. Prov med HOV_EMAIL og HOV_PASSWORD.");
  } else {
    console.log("NEI: Fant ingen rader i de sjekkede tabellene.");
  }
}

main().catch((err) => {
  console.error("Feil:", err.message || err);
  process.exit(1);
});
