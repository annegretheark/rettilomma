// Vercel Serverless Function: oppdater ansatt e-post i Supabase Auth + hand_ansatt.
// Krever Vercel Environment Variables:
//   SUPABASE_URL=https://...supabase.co
//   ENDREHANDEPOST=<Supabase Secret key sb_secret_...>
// eller SUPABASE_SERVICE_ROLE_KEY=<legacy service_role JWT>
// Secret/service key skal ALDRI ligge i frontend/config.js.

const SYS_TABLES = ['hand_sysadmin', 'handsysadmin', 'hand_sysadm'];
const ADMIN_ROLES = ['admin', 'administrator', 'eier', 'owner', 'firmaeier', 'bedrift_admin'];
const SYS_ROLES = ['sysadm', 'sysadmin', 'systemadmin'];

function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function raw(v) { return String(v == null ? '' : v).trim(); }
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function env(name) { return process.env[name] || ''; }
function firstEnv(names) { for (const name of names) { if (env(name)) return env(name); } return ''; }
function serverKey() {
  return firstEnv(['ENDREHANDEPOST', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_KEY', 'endrehandepost']);
}
function baseUrl() { return env('SUPABASE_URL').replace(/\/$/, ''); }
function url(path) { return baseUrl() + path; }

async function sbFetch(path, options = {}) {
  const key = serverKey();
  const headers = Object.assign({
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json'
  }, options.headers || {});
  const r = await fetch(url(path), Object.assign({}, options, { headers }));
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!r.ok) {
    const msg = (data && (data.message || data.error || data.msg || data.error_description)) || text || ('HTTP ' + r.status);
    const e = new Error(msg);
    e.status = r.status;
    e.data = data;
    throw e;
  }
  return data;
}

async function getRequester(accessToken) {
  if (!accessToken) return null;
  const r = await fetch(url('/auth/v1/user'), {
    headers: { apikey: serverKey(), Authorization: 'Bearer ' + accessToken }
  });
  if (!r.ok) return null;
  return await r.json();
}
async function select(table, query) {
  return await sbFetch('/rest/v1/' + encodeURIComponent(table) + '?' + query, { method: 'GET' });
}
function isColumnError(e) {
  return /column|schema cache|Could not find|does not exist|PGRST/i.test(String((e && e.message) || (e && e.data && JSON.stringify(e.data)) || e || ''));
}
async function selectFirstAvailable(table, selectColsList, filterQuery) {
  let lastErr = null;
  for (const cols of selectColsList) {
    try {
      const rows = await select(table, 'select=' + encodeURIComponent(cols) + '&' + filterQuery);
      return rows;
    } catch (e) {
      lastErr = e;
      if (!isColumnError(e)) throw e;
    }
  }
  throw lastErr || new Error('Kunne ikke lese ' + table);
}
async function patch(table, query, body) {
  return await sbFetch('/rest/v1/' + encodeURIComponent(table) + '?' + query, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body)
  });
}
async function patchFirstAvailable(table, query, bodies) {
  let lastErr = null;
  for (const body of bodies) {
    try { return await patch(table, query, body); }
    catch (e) { lastErr = e; if (!isColumnError(e)) throw e; }
  }
  throw lastErr || new Error('Kunne ikke oppdatere ' + table);
}
async function isSysadmin(email) {
  email = norm(email);
  if (!email) return false;
  for (const table of SYS_TABLES) {
    for (const col of ['epost', 'email']) {
      try {
        const rows = await select(table, 'select=*&' + col + '=ilike.' + encodeURIComponent(email) + '&limit=1');
        if (Array.isArray(rows) && rows.length) {
          const row = rows[0] || {};
          return !(row.aktiv === false || row.active === false || row.deaktivert === true);
        }
      } catch (_) {}
    }
  }
  return false;
}
async function isFirmaAdmin(userId, email) {
  const checks = [];
  if (userId) checks.push('user_id=eq.' + encodeURIComponent(userId));
  if (email) checks.push('epost=ilike.' + encodeURIComponent(email));
  for (const q of checks) {
    try {
      const rows = await select('hand_firma_bruker', 'select=rolle&' + q + '&limit=1');
      const role = norm(rows && rows[0] && rows[0].rolle);
      if (ADMIN_ROLES.includes(role) || SYS_ROLES.includes(role)) return true;
    } catch (_) {}
  }
  return false;
}

async function listAuthUsersFindByEmail(email) {
  email = norm(email);
  if (!email) return '';
  for (let page = 1; page <= 50; page++) {
    const data = await sbFetch('/auth/v1/admin/users?page=' + page + '&per_page=100', { method: 'GET' });
    const users = Array.isArray(data && data.users) ? data.users : (Array.isArray(data) ? data : []);
    const hit = users.find(u => norm(u.email) === email);
    if (hit && hit.id) return hit.id;
    if (!users.length || users.length < 100) break;
  }
  return '';
}
async function findAuthUserId({ user_id, old_email }) {
  if (raw(user_id)) return raw(user_id);
  old_email = norm(old_email);
  if (!old_email) return '';
  try {
    const rows = await select('hand_firma_bruker', 'select=user_id&epost=ilike.' + encodeURIComponent(old_email) + '&limit=1');
    if (Array.isArray(rows) && rows[0] && rows[0].user_id) return raw(rows[0].user_id);
  } catch (_) {}
  return await listAuthUsersFindByEmail(old_email);
}
async function updateAuthEmail(authUserId, newEmail) {
  // Admin-endepunktet endrer e-post direkte uten vanlig bekreftelsesflyt.
  const payload = { email: newEmail, email_confirm: true, user_metadata: { email: newEmail } };
  await sbFetch('/auth/v1/admin/users/' + encodeURIComponent(authUserId), {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  // Verifiser at Auth faktisk ble endret før vi skriver app-tabellene.
  const verifyId = await listAuthUsersFindByEmail(newEmail);
  if (verifyId !== authUserId) {
    throw new Error('Auth svarte OK, men ny e-post ble ikke funnet ved kontroll. Sjekk at ENDREHANDEPOST er en Supabase Secret key med serverrettigheter.');
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  if (!env('SUPABASE_URL') || !serverKey()) {
    return json(res, 500, { ok: false, error: 'Mangler SUPABASE_URL og/eller ENDREHANDEPOST/SUPABASE_SERVICE_ROLE_KEY i Vercel Environment Variables.' });
  }

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    const ansattId = raw(body.ansatt_id);
    const oldEmail = norm(body.old_email);
    const newEmail = norm(body.new_email);
    let authUserId = raw(body.user_id);

    if (!ansattId || !newEmail) return json(res, 400, { ok: false, error: 'Mangler ansatt_id eller new_email.' });
    if (oldEmail && oldEmail === newEmail) return json(res, 200, { ok: true, skipped: true });

    const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const requester = await getRequester(accessToken);
    const requesterEmail = norm(requester && requester.email);
    const requesterId = raw(requester && requester.id);
    const allowed = await isSysadmin(requesterEmail) || await isFirmaAdmin(requesterId, requesterEmail);
    if (!allowed) return json(res, 403, { ok: false, error: 'Ikke autorisert til å endre ansatt-e-post.' });

    const ansatte = await selectFirstAvailable('hand_ansatt', ['id,user_id,epost,email', 'id,user_id,epost', 'id,epost,email', 'id,epost', 'id'], 'id=eq.' + encodeURIComponent(ansattId) + '&limit=1');
    const ansatt = Array.isArray(ansatte) && ansatte[0] ? ansatte[0] : null;
    if (!ansatt) return json(res, 404, { ok: false, error: 'Fant ikke ansatt i hand_ansatt.' });

    if (!authUserId) authUserId = raw(ansatt.user_id);
    authUserId = await findAuthUserId({ user_id: authUserId, old_email: oldEmail || ansatt.epost || ansatt.email });
    if (!authUserId) {
      return json(res, 409, {
        ok: false,
        error: 'Fant ikke Supabase Auth-bruker for gammel e-post. hand_ansatt er ikke oppdatert. Legg user_id på hand_ansatt eller sjekk at gammel e-post finnes i Authentication > Users.'
      });
    }

    await updateAuthEmail(authUserId, newEmail);

    await patchFirstAvailable('hand_ansatt', 'id=eq.' + encodeURIComponent(ansattId), [
      { epost: newEmail, user_id: authUserId },
      { epost: newEmail },
      { email: newEmail, user_id: authUserId },
      { email: newEmail }
    ]);
    try { await patch('hand_firma_bruker', 'user_id=eq.' + encodeURIComponent(authUserId), { epost: newEmail }); } catch (_) {}
    if (oldEmail) {
      try { await patch('hand_firma_bruker', 'epost=ilike.' + encodeURIComponent(oldEmail), { epost: newEmail, user_id: authUserId }); } catch (_) {}
    }

    return json(res, 200, { ok: true, authUpdated: true, user_id: authUserId });
  } catch (e) {
    return json(res, e.status || 500, { ok: false, error: e.message || String(e), details: e.data || null });
  }
};
