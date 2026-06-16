// Supabase Edge Function: backup-hovslager-firma
// Lager individuell backup per hovslager-firma.
// Tar med faktiske hovslager-tabeller + bildereferanser i hov_jobb_bilder.
// Forsøker også å kopiere selve bildefilene fra Storage til backups-bucket.
//
// Krever secrets:
//   SUPABASE_URL eller APP_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY eller APP_SERVICE_ROLE_KEY
// Bucket:
//   backups
//
// Kall med:
//   { "all": true }                 -> backup av alle firma
//   { "firma_id": "uuid..." }       -> backup av ett firma

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Kun tabellene som faktisk finnes i hovslager-prosjektet ditt.
const HOV_TABLES = [
  "hov_firma",
  "hov_jobber",
  "hov_jobb_bilder",
  "hov_priser",
  "hov_fakturaer",
  "hov_kreditnotaer",
];

// Kandidater for hvor hovslagerbildene kan ligge i Storage.
// Funksjonen prøver disse, men stopper ikke hvis filen ikke finnes.
const IMAGE_BUCKET_CANDIDATES = [
  "bilder",
  "timer-bilder",
  "hov-bilder",
  "hovslager-bilder",
];

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isMissingTableError(error: any): boolean {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

function isMissingFirmaIdError(error: any): boolean {
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("firma_id") && (msg.includes("column") || msg.includes("could not find"));
}

function cleanStoragePath(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = String(input).trim();
  if (!value) return null;

  // Fjern querystring fra URL/path.
  value = value.split("?")[0];

  // Hvis full Supabase public URL, hent path etter /object/public/<bucket>/ eller /object/sign/<bucket>/
  const publicMatch = value.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (publicMatch) {
    return publicMatch[2];
  }

  // Hvis den allerede er relativ path.
  value = value.replace(/^\/+/, "");

  // Hvis path starter med bucket-navn, fjern bucket-delen senere ved forsøk.
  return value || null;
}

function filenameFromImageRow(row: any, fallbackIndex: number): string {
  const raw = row?.filnavn || row?.filsti || row?.bilde_url || `bilde-${fallbackIndex}`;
  const noQuery = String(raw).split("?")[0];
  const base = noQuery.split("/").filter(Boolean).pop() || `bilde-${fallbackIndex}`;
  return base.replace(/[^a-zA-Z0-9æøåÆØÅ._-]+/g, "-").slice(0, 120);
}

async function fetchRowsForFirma(supabase: any, tableName: string, firmaId: string) {
  const query = tableName === "hov_firma"
    ? supabase.from(tableName).select("*").eq("id", firmaId)
    : supabase.from(tableName).select("*").eq("firma_id", firmaId);

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error)) {
      return { skipped: true, reason: "tabell finnes ikke", rows: [] };
    }
    if (isMissingFirmaIdError(error)) {
      return { skipped: true, reason: "mangler firma_id", rows: [] };
    }
    throw new Error(`${tableName}: ${error.message}`);
  }

  return { skipped: false, rows: data || [] };
}

async function tryDownloadImage(supabase: any, row: any): Promise<{ ok: boolean; bucket?: string; path?: string; blob?: Blob; error?: string }> {
  const possiblePaths = [cleanStoragePath(row?.filsti), cleanStoragePath(row?.bilde_url), cleanStoragePath(row?.filnavn)]
    .filter(Boolean) as string[];

  const attempts: Array<{ bucket: string; path: string }> = [];

  for (const rawPath of possiblePaths) {
    for (const bucket of IMAGE_BUCKET_CANDIDATES) {
      // Prøv raw path.
      attempts.push({ bucket, path: rawPath });
      // Hvis raw path starter med bucket/, prøv uten bucket-prefix.
      if (rawPath.startsWith(`${bucket}/`)) {
        attempts.push({ bucket, path: rawPath.slice(bucket.length + 1) });
      }
    }
  }

  const seen = new Set<string>();
  for (const attempt of attempts) {
    const key = `${attempt.bucket}:${attempt.path}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const { data, error } = await supabase.storage.from(attempt.bucket).download(attempt.path);
    if (!error && data) {
      return { ok: true, bucket: attempt.bucket, path: attempt.path, blob: data };
    }
  }

  return { ok: false, error: "fant ikke bildefil i kjente buckets" };
}

async function backupImagesForFirma(supabase: any, firmaId: string, imageRows: any[], backupBasePath: string) {
  const copied: any[] = [];
  const missing: any[] = [];

  for (let i = 0; i < imageRows.length; i++) {
    const row = imageRows[i];
    const found = await tryDownloadImage(supabase, row);

    if (!found.ok || !found.blob) {
      missing.push({
        id: row?.id || null,
        filnavn: row?.filnavn || null,
        filsti: row?.filsti || null,
        bilde_url: row?.bilde_url || null,
        reason: found.error || "ukjent feil",
      });
      continue;
    }

    const fileName = filenameFromImageRow(row, i + 1);
    const backupImagePath = `${backupBasePath}/bilder/${row?.id || i + 1}-${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(backupImagePath, found.blob, {
        contentType: found.blob.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      missing.push({
        id: row?.id || null,
        filnavn: row?.filnavn || null,
        reason: `kunne ikke lagre bilde i backups: ${uploadError.message}`,
      });
      continue;
    }

    copied.push({
      id: row?.id || null,
      source_bucket: found.bucket,
      source_path: found.path,
      backup_path: backupImagePath,
    });
  }

  return { copied, missing };
}

async function backupOneFirma(supabase: any, firma: any) {
  const firmaId = firma.id;
  const dato = todayStamp();
  const backup: Record<string, unknown> = {
    app: "hovslager",
    backup_type: "firma",
    firma_id: firmaId,
    firma_navn: firma.navn || null,
    created_at: nowIso(),
    tables: {},
    storage_images: {},
  };

  const summary: Record<string, unknown> = {};

  for (const tableName of HOV_TABLES) {
    const result = await fetchRowsForFirma(supabase, tableName, firmaId);
    (backup.tables as Record<string, unknown>)[tableName] = result.rows;
    summary[tableName] = result.skipped
      ? { skipped: true, reason: result.reason }
      : { rows: Array.isArray(result.rows) ? result.rows.length : 0 };
  }

  const safeName = String(firma.navn || "firma")
    .toLowerCase()
    .replace(/[^a-z0-9æøå_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const backupBasePath = `hovslager/${firmaId}`;
  const jsonPath = `${backupBasePath}/hovslager-${safeName}-${dato}.json`;

  const imageRows = ((backup.tables as any).hov_jobb_bilder || []) as any[];
  const imageBackup = await backupImagesForFirma(supabase, firmaId, imageRows, backupBasePath);
  backup.storage_images = imageBackup;
  summary["storage_bilder"] = {
    rows_i_hov_jobb_bilder: imageRows.length,
    kopiert: imageBackup.copied.length,
    mangler: imageBackup.missing.length,
  };

  const json = JSON.stringify(backup, null, 2);

  const { error: uploadError } = await supabase.storage
    .from("backups")
    .upload(jsonPath, new Blob([json], { type: "application/json" }), {
      contentType: "application/json; charset=utf-8",
      upsert: true,
    });

  if (uploadError) throw new Error(`Storage upload feilet for ${firmaId}: ${uploadError.message}`);

  return {
    firma_id: firmaId,
    firma_navn: firma.navn || null,
    path: jsonPath,
    summary,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Bruk POST" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("APP_SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("APP_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return jsonResponse({
        error: "Mangler secrets",
        trenger: ["SUPABASE_URL eller APP_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY eller APP_SERVICE_ROLE_KEY"],
      }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const firmaId = body.firma_id || body.firmaId || null;
    const all = body.all === true || !firmaId;

    let firmaer: any[] = [];

    if (all) {
      const { data, error } = await supabase.from("hov_firma").select("id, navn, epost, linknavn").order("navn");
      if (error) throw new Error(`Kunne ikke hente hov_firma: ${error.message}`);
      firmaer = data || [];
    } else {
      const { data, error } = await supabase.from("hov_firma").select("id, navn, epost, linknavn").eq("id", firmaId).single();
      if (error) throw new Error(`Fant ikke firma ${firmaId}: ${error.message}`);
      firmaer = [data];
    }

    const results = [];
    for (const firma of firmaer) {
      results.push(await backupOneFirma(supabase, firma));
    }

    return jsonResponse({
      ok: true,
      app: "hovslager",
      backup_type: "firma",
      antall_firma: results.length,
      created_at: nowIso(),
      results,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
