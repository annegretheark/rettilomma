#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SUPABASE_URL = 'https://pxlbrywowphkczkehmee.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_tluvA83iCcKfmgfXetvz5g_farKpCTS';

const SUPABASE_URL = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const EMAIL = process.env.HOV_EMAIL || process.env.SUPABASE_EMAIL || '';
const PASSWORD = process.env.HOV_PASSWORD || process.env.SUPABASE_PASSWORD || '';
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const BACKUP_FILE = getArg('--file') || findBackupFile();

const tableMap = {
  firma: 'hov_firma',
  kunder: 'kunder',
  hester: 'hester',
  hov_jobber: 'hov_jobber',
  hov_fakturaer: 'hov_fakturaer',
  hov_kreditnotaer: 'hov_kreditnotaer',
};
const order = ['firma', 'kunder', 'hester', 'hov_jobber', 'hov_fakturaer', 'hov_kreditnotaer'];

function getArg(name) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}
function findBackupFile() {
  const f = process.argv.slice(2).find(x => x.endsWith('.json'));
  return f || 'hovslager_backup_2026-06-01T22-48-31-591Z.json';
}
function apiHeaders(token, prefer = 'return=representation') {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}
async function loginIfNeeded() {
  if (!EMAIL || !PASSWORD) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Innlogging feilet: ${txt}`);
  return JSON.parse(txt).access_token;
}
async function getColumns(table, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=0`, {
    headers: apiHeaders(token, 'return=minimal'),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Klarte ikke lese skjema for ${table}: ${text}`);
  const cols = [];
  const cr = res.headers.get('content-profile');
  if (VERBOSE && cr) console.log(`  profile: ${cr}`);
  return null; // PostgREST gir ikke kolonneliste her. Vi bruker dynamisk feilhåndtering under.
}
function removeColumns(rows, removeCols) {
  return rows.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) if (!removeCols.has(k)) out[k] = v;
    return out;
  });
}
function missingColumn(text) {
  const patterns = [
    /column "([^"]+)" of relation "[^"]+" does not exist/i,
    /Could not find the '([^']+)' column/i,
    /Could not find the column '([^']+)'/i,
    /PGRST204.*'([^']+)'/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function invalidUuidColumn(text, payload) {
  // Eksempel fra Supabase/Postgres:
  // invalid input syntax for type uuid: "1"
  const m = text.match(/invalid input syntax for type uuid:\s*"([^"]+)"/i);
  if (!m) return null;
  const badValue = m[1];
  for (const row of payload) {
    for (const [key, value] of Object.entries(row)) {
      if (String(value) === badValue) return key;
    }
  }
  // Den vanligste feilen i denne backupen er hov_firma.id = 1 mens databasen har UUID-id.
  return 'id';
}
async function countRows(table, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*`, {
    headers: { ...apiHeaders(token, 'count=exact'), Range: '0-0' },
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, count: null, error: text };
  const cr = res.headers.get('content-range') || '';
  const m = cr.match(/\/(\d+)$/);
  return { ok: true, count: m ? Number(m[1]) : null, error: null };
}
async function upsertBatch(table, rows, token) {
  const removeCols = new Set();
  const skipped = [];

  for (let attempt = 1; attempt <= 30; attempt++) {
    const payload = removeColumns(rows, removeCols);
    if (DRY_RUN) return { written: 0, skipped, dry: rows.length };

    const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?on_conflict=id`;
    const res = await fetch(url, {
      method: 'POST',
      headers: apiHeaders(token, 'resolution=merge-duplicates,return=representation'),
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (res.ok) {
      let returned = [];
      try { returned = text ? JSON.parse(text) : []; } catch {}
      return { written: Array.isArray(returned) ? returned.length : rows.length, skipped, dry: 0 };
    }

    const miss = missingColumn(text);
    if (miss && !removeCols.has(miss)) {
      removeCols.add(miss);
      skipped.push(miss);
      console.log(`  Hopper over manglende kolonne i ${table}: ${miss}`);
      continue;
    }

    const badUuidCol = invalidUuidColumn(text, payload);
    if (badUuidCol && !removeCols.has(badUuidCol)) {
      removeCols.add(badUuidCol);
      skipped.push(`${badUuidCol} (feil type/UUID)`);
      console.log(`  Hopper over ${badUuidCol} i ${table}: backupverdien passer ikke UUID-kolonnen i databasen`);
      continue;
    }

    throw new Error(`${table}: ${text}`);
  }
  throw new Error(`${table}: for mange forsok`);
}
async function main() {
  console.log('Hovslager JSON-gjenoppretting v4');
  console.log(`Backupfil: ${BACKUP_FILE}`);
  console.log(DRY_RUN ? 'MODUS: TEST. Skriver ikke data.' : 'MODUS: GJENOPPRETTING. Skriver data.');

  const raw = await fs.readFile(path.resolve(BACKUP_FILE), 'utf8');
  const backup = JSON.parse(raw);
  const tables = backup.tables || backup;
  const token = await loginIfNeeded();
  console.log(token ? 'Innlogging OK: bruker bruker-token.' : 'Ingen innlogging: bruker anon-key. Dette kan bli blokkert av RLS.');

  for (const name of order) {
    const table = tableMap[name];
    const rows = tables[name] || [];
    const before = await countRows(table, token);
    console.log(`\n${name} -> ${table}`);
    console.log(`  I backup: ${rows.length}`);
    if (before.ok) console.log(`  I databasen foer: ${before.count}`);
    else console.log(`  Kunne ikke telle foer: ${before.error}`);
    if (!rows.length) continue;

    const result = await upsertBatch(table, rows, token);
    if (DRY_RUN) console.log(`  TEST OK: ville skrevet ${result.dry} rad(er).`);
    else console.log(`  Skrevet/oppdatert ifolge API: ${result.written} rad(er).`);
    if (result.skipped.length) console.log(`  Ignorerte kolonner: ${result.skipped.join(', ')}`);

    const after = await countRows(table, token);
    if (after.ok) console.log(`  I databasen etter: ${after.count}`);
    else console.log(`  Kunne ikke telle etter: ${after.error}`);
  }

  console.log('\nFerdig. Hvis antall etter ikke endrer seg, send hele teksten fra dette vinduet.');
}
main().catch(err => {
  console.error('\nFEIL:');
  console.error(err.message || err);
  console.error('\nVanlige arsaker:');
  console.error('1) Du kjorte med --dry-run eller kjor-test.bat, da skrives ingenting.');
  console.error('2) RLS blokkerer skriving. Kjor med HOV_EMAIL og HOV_PASSWORD, eller bruk service_role key som SUPABASE_KEY.');
  console.error('3) Databaseskjemaet mangler tabeller/kolonner som backupen trenger.');
  process.exit(1);
});
