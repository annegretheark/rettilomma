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
const ONLY = getArg('--only');
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
  const files = process.argv.slice(2).filter(x => x.endsWith('.json'));
  if (files[0]) return files[0];
  return 'hovslager_backup_2026-06-01T22-48-31-591Z.json';
}

function headers(token) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
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
  const json = JSON.parse(txt);
  return json.access_token;
}

function cleanRows(rows, removeCols = new Set()) {
  return rows.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (!removeCols.has(k)) out[k] = v;
    }
    return out;
  });
}

function extractMissingColumn(errorText) {
  const patterns = [
    /column "([^"]+)" of relation "[^"]+" does not exist/i,
    /Could not find the '([^']+)' column/i,
    /Could not find the column '([^']+)'/i,
    /column ([a-zA-Z0-9_]+) does not exist/i,
  ];
  for (const p of patterns) {
    const m = errorText.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function upsertRows(table, rows, token) {
  if (!rows.length) return { inserted: 0, skippedColumns: [] };
  const removeCols = new Set();
  const skippedColumns = [];
  let tries = 0;

  while (tries < 20) {
    tries++;
    const payload = cleanRows(rows, removeCols);

    if (DRY_RUN) {
      console.log(`  dry-run: ville skrevet ${payload.length} rad(er) til ${table}`);
      return { inserted: payload.length, skippedColumns };
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?on_conflict=id`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (res.ok) return { inserted: rows.length, skippedColumns };

    const missing = extractMissingColumn(text);
    if (missing && !removeCols.has(missing)) {
      removeCols.add(missing);
      skippedColumns.push(missing);
      console.log(`  hopper over kolonne som ikke finnes i ${table}: ${missing}`);
      continue;
    }

    throw new Error(`${table}: ${text}`);
  }

  throw new Error(`${table}: for mange forsok paa aa tilpasse kolonner`);
}

async function countTable(table, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=id`, {
    headers: { ...headers(token), Range: '0-0', Prefer: 'count=exact' },
  });
  const range = res.headers.get('content-range') || '';
  const m = range.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

async function main() {
  console.log('Gjenoppretter Hovslager-data fra JSON-backup...');
  console.log(`Backupfil: ${BACKUP_FILE}`);
  if (DRY_RUN) console.log('DRY RUN: Skriver ikke til databasen.');

  const raw = await fs.readFile(path.resolve(BACKUP_FILE), 'utf8');
  const backup = JSON.parse(raw);
  const tables = backup.tables || backup;
  const token = await loginIfNeeded();
  if (token) console.log('Innlogging OK. Bruker bruker-token.');
  else console.log('Ingen innlogging oppgitt. Bruker anon-key. Hvis RLS blokkerer, kjoer med HOV_EMAIL og HOV_PASSWORD.');

  const wanted = ONLY ? ONLY.split(',').map(x => x.trim()) : order;

  for (const backupName of order) {
    if (!wanted.includes(backupName) && !wanted.includes(tableMap[backupName])) continue;
    const dbTable = tableMap[backupName];
    const rows = tables[backupName] || [];
    console.log(`\n- ${backupName} -> ${dbTable}: ${rows.length} rad(er) i backup`);
    if (!rows.length) continue;
    const result = await upsertRows(dbTable, rows, token);
    console.log(`  OK: ${result.inserted} rad(er) behandlet`);
    if (result.skippedColumns.length) console.log(`  Kolonner hoppet over: ${result.skippedColumns.join(', ')}`);
    const count = await countTable(dbTable, token).catch(() => null);
    if (count !== null) console.log(`  Antall i databasen naa: ${count}`);
  }

  console.log('\nFerdig. Kjoer gjerne sjekk-scriptet etterpaa for aa kontrollere antall rader.');
}

main().catch(err => {
  console.error('\nFEIL:');
  console.error(err.message || err);
  console.error('\nTips: Hvis feilen handler om RLS/rettigheter, kjoer slik:');
  console.error('HOV_EMAIL="din@epost.no" HOV_PASSWORD="passord" node restore-fra-json.mjs');
  process.exit(1);
});
