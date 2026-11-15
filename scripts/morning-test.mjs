// Standalone Morning (Green Invoice) production connection test — no app, no database.
//
//   node --env-file=.env.local scripts/morning-test.mjs
//
// Keys are read from the environment (never passed on the command line):
//   MORNING_PROD_API_KEY_ID / MORNING_PROD_API_SECRET, falling back to MORNING_API_KEY_ID / MORNING_API_SECRET.
// If MORNING_ACCESS_TOKEN is set, the token step is skipped and that token is used as-is.

const BASE = 'https://api.greeninvoice.co.il/api/v1';
const TOKEN_URL = 'https://api.morning.co/idp/v1/oauth/token';
const env = process.env;

const mask = (v) => (v.length > 12 ? `${v.slice(0, 8)}…${v.slice(-4)}` : '****') + ` (len ${v.length})`;
// Whitespace, quotes or a stray \r in a pasted key are a classic cause of 401s — report them, don't fix them silently
const oddities = (v) => [
  v !== v.trim() && 'leading/trailing whitespace',
  /^["'].*["']$/.test(v) && 'wrapped in quotes',
  /[\r\n]/.test(v) && 'contains a line break',
].filter(Boolean).join(', ') || 'none';

async function post(path, payload, headers = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  console.log(`\n→ POST ${url}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    console.log(`← ${res.status} ${res.statusText}`);
    return { status: res.status, ok: res.ok, text, json };
  } catch (e) {
    console.log(`✗ request never reached Morning: ${e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ''}`);
    return null;
  }
}

let token = env.MORNING_ACCESS_TOKEN;

if (token) {
  console.log('Using MORNING_ACCESS_TOKEN from the environment — skipping the token request.');
} else {
  const idVar = env.MORNING_PROD_API_KEY_ID ? 'MORNING_PROD_API_KEY_ID' : 'MORNING_API_KEY_ID';
  const secretVar = idVar.replace('API_KEY_ID', 'API_SECRET');
  const id = env[idVar];
  const secret = env[secretVar];
  if (!id || !secret) {
    console.error(`Missing keys: set ${idVar} and ${secretVar} (in .env.local, or in the shell before running).`);
    process.exit(1);
  }
  console.log(`Key id  ${idVar}: ${mask(id)} · oddities: ${oddities(id)}`);
  console.log(`Secret  ${secretVar}: (len ${secret.length}) · oddities: ${oddities(secret)}`);

  // Morning's OAuth2 token server (the old /api/v1/account/token returns 404)
  console.log('\n=== Token request ===');
  const r = await post(TOKEN_URL, { grant_type: 'client_credentials', client_id: id, client_secret: secret });
  if (r) {
    token = r.json?.accessToken;
    // Show the shape of the answer without printing the token itself
    if (token) console.log('response fields:', Object.keys(r.json).join(', '), '· token len', token.length, '· expiresAt', r.json.expiresAt);
    else console.log('response body:', r.text || '(empty)');
  }
  if (!token) {
    console.error('\nNo token obtained — the failure is in the authentication step, not in the search.');
    process.exit(1);
  }
}

const auth = { Authorization: `Bearer ${token}` };
const show = (r) => { if (r) console.log(r.json ? JSON.stringify(r.json, null, 2) : r.text || '(empty body)'); };

// Item search:  node --env-file=.env.local scripts/morning-test.mjs items "מקדמה"
// (read-only; shows the catalogue items whose name matches, to learn the response shape)
if (process.argv[2] === 'items') {
  const name = process.argv[3] || 'מקדמה';
  console.log(`\n=== Item search: "${name}" ===`);
  const r = await post('/items/search', { name, page: 1, pageSize: 25 }, auth);
  show(r);
  process.exit(r?.ok ? 0 : 1);
}

console.log('\n=== Customer search ===');
const r = await post('/clients/search', { name: 'אלה', active: true, page: 1, pageSize: 25 }, auth);
show(r);
process.exit(r?.ok ? 0 : 1);
