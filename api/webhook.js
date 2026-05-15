/**
 * Wet Ink content-pipeline webhook (Vercel serverless function).
 *
 * Replaces the Chrome MCP write path so the scheduled content-pipeline can
 * write to the tracker sheet without anyone's laptop being on.
 *
 * Endpoints (all POST to the same URL):
 *   { action: "ping" }
 *     → { ok: true, message: "pong" }
 *
 *   { action: "append", title: "<title>", date: "<Month DD, YYYY>" }
 *     → inserts a new row at the end of the Article Coverage table
 *       (just above the Instagram Posts table header), auto-computes
 *       the next # from the highest existing value, fills the 10
 *       default columns. Idempotent — duplicate title is skipped.
 *
 *   { action: "flip_in_asana", title: "<title>" }
 *     → finds the row by title (normalized: lowercased, curly quotes
 *       straightened, trailing punctuation stripped) and sets column J
 *       ("In Asana") to "Y".
 *
 *   { action: "delete_row", row: <int> }
 *     → deletes the given spreadsheet row (1-indexed, must be >= 2).
 *       Used for one-off cleanup. Be careful — this shifts all rows
 *       below up by one.
 *
 *   { action: "list_titles" }
 *     → returns every row in the Article Coverage table as
 *       { row, num, title, date, in_asana }. Lets the daily pipeline
 *       diff against the tracker without needing the Drive MCP.
 *
 * Auth: OAuth user refresh token (reuses the existing wet-ink-analytics
 * Internal OAuth client). No service account — blocked by org policy
 * iam.disableServiceAccountKeyCreation on hollyrandallagency.com. The
 * refresh token is captured one-time via scripts/get-oauth-refresh-token.py
 * and stored in Vercel env vars; Internal-type OAuth refresh tokens for
 * Workspace users don't expire.
 *
 * Required environment variables (set in Vercel project settings):
 *   GOOGLE_OAUTH_CLIENT_ID       client_id from the GCP OAuth client
 *   GOOGLE_OAUTH_CLIENT_SECRET   client_secret from the same client
 *   GOOGLE_OAUTH_REFRESH_TOKEN   refresh token captured for the
 *                                spreadsheets scope as andrew@hollyrandallagency.com
 *   SPREADSHEET_ID               the tracker sheet's ID
 *   WEBHOOK_SECRET               any random string; callers send this
 *                                as the X-Webhook-Secret header (POST)
 *                                or as the &secret= query param (GET)
 *
 * Two transports supported:
 *   POST  — JSON body, secret in `X-Webhook-Secret` header. Use this
 *           whenever you can; secret stays out of URLs.
 *   GET   — `?action=foo&secret=BAR&title=...&date=...`. Same actions
 *           as POST, secret in query. Exists because the claude.ai
 *           CCR sandbox can only call this URL via
 *           `mcp__Vercel__web_fetch_vercel_url` (GET-only, no custom
 *           headers). Secret-in-query has weaker hygiene than
 *           secret-in-header — rotate WEBHOOK_SECRET periodically.
 *           A bare GET with no query params returns a health-check
 *           message and requires no auth.
 */

const { google } = require('googleapis');

const SHEET_NAME = 'Article Coverage';
const IG_POSTS_HEADER_MARKER = 'date posted'; // column B value in the Instagram Posts table header row

function getSheetsClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

async function getSheetId(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const tab = res.data.sheets.find((s) => s.properties.title === SHEET_NAME);
  if (!tab) throw new Error(`tab "${SHEET_NAME}" not found in spreadsheet`);
  return tab.properties.sheetId;
}

/**
 * Find the spreadsheet row where a new article should be inserted.
 *
 * The Article Coverage table is the FIRST table in the sheet (rows 2..N).
 * The Instagram Posts table sits below it with header row containing
 * "Date Posted" in column B. We scan column B from row 2 down, tracking
 * the last non-empty row, and stop when we hit the IG Posts header. The
 * new article goes right after the last article row.
 *
 * Earlier versions of this function looked for a "POSTED:" summary row
 * marker that sat below the article rows. That row was removed when the
 * sheet was re-sorted by published date, so we no longer depend on it.
 *
 * Returns: 1-indexed spreadsheet row where the new article should land
 * (insert will shift everything at that row and below down by 1).
 */
async function findInsertRow(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!B:B`,
  });
  const values = res.data.values || [];

  let lastArticleRow = 1; // row 1 is the header
  for (let i = 1; i < values.length; i++) {
    const cell = String((values[i] || [])[0] || '').trim();
    // Stop scanning once we hit the Instagram Posts table header
    if (cell.toLowerCase() === IG_POSTS_HEADER_MARKER) break;
    // Track the last non-empty row in the Article Coverage table
    if (cell) lastArticleRow = i + 1; // convert to 1-indexed
  }

  return lastArticleRow + 1;
}

function normalizeTitle(s) {
  return String(s).toLowerCase().trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/[?!.,]+$/, '')
    .replace(/\s+/g, ' ');
}

async function appendArticle(sheets, spreadsheetId, body) {
  const insertRow = await findInsertRow(sheets, spreadsheetId);

  // Idempotency: if the title is already in the Article Coverage table,
  // return a "skipped" success rather than insert a duplicate row. Guards
  // against Vercel function retries and pipeline reruns.
  if (body.title && insertRow > 2) {
    const titleCheckRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!B2:B${insertRow - 1}`,
    });
    const target = normalizeTitle(body.title);
    const existing = titleCheckRes.data.values || [];
    for (let i = 0; i < existing.length; i++) {
      if (normalizeTitle((existing[i] || [])[0] || '') === target) {
        return {
          ok: true,
          action: 'append',
          skipped: true,
          message: 'article already in tracker',
          existing_row: i + 2,
          title: body.title,
        };
      }
    }
  }

  // Compute next # by scanning column A from row 2 to insertRow-1
  let maxNum = 0;
  if (insertRow > 2) {
    const aRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A2:A${insertRow - 1}`,
    });
    for (const row of aRes.data.values || []) {
      const n = Number(row[0]);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  const nextNum = maxNum + 1;

  // Insert a blank row at insertRow (right after the last article row,
  // before the Instagram Posts table). inheritFromBefore: true makes the
  // new row inherit cell formatting, background colors, font, alignment,
  // and data-validation dropdowns from the article row above it.
  // Conditional formatting auto-extends to the new row if its range is
  // defined relatively.
  const sheetId = await getSheetId(sheets, spreadsheetId);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        insertDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: insertRow - 1, // 0-indexed for the API
            endIndex: insertRow,
          },
          inheritFromBefore: true,
        },
      }],
    },
  });

  // Fill the new row (10 columns A-J)
  const rowValues = [
    nextNum,                // A: #
    body.title || '',       // B: Article Title
    body.date || '',        // C: Published Date
    'N',                    // D: Posted on IG?
    '',                     // E: Post Type
    '',                     // F: IG Post Date
    '',                     // G: IG Link
    'Y',                    // H: Create Post?
    'Reel',                 // I: New Post Type
    'N',                    // J: In Asana
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A${insertRow}:J${insertRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
  });

  return {
    ok: true,
    action: 'append',
    inserted_at_row: insertRow,
    row_number: nextNum,
    title: body.title,
  };
}

async function listTitles(sheets, spreadsheetId) {
  const insertRow = await findInsertRow(sheets, spreadsheetId);
  const lastDataRow = insertRow - 1;
  if (lastDataRow < 2) {
    return { ok: true, action: 'list_titles', count: 0, rows: [] };
  }

  // Pull A2:J<lastDataRow> in one call
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:J${lastDataRow}`,
  });
  const values = res.data.values || [];
  const rows = values.map((r, i) => ({
    row: i + 2, // 1-indexed spreadsheet row
    num: r[0] || '',
    title: r[1] || '',
    date: r[2] || '',
    in_asana: r[9] || '', // column J
  })).filter((r) => r.title); // drop rows with empty title (shouldn't normally happen)

  return {
    ok: true,
    action: 'list_titles',
    count: rows.length,
    rows,
  };
}

async function deleteRow(sheets, spreadsheetId, body) {
  const row = Number(body.row);
  if (!row || row < 2) {
    return { ok: false, error: 'row must be a number >= 2 (row 1 is the header)' };
  }
  const sheetId = await getSheetId(sheets, spreadsheetId);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: row - 1, // 0-indexed for the API
            endIndex: row,
          },
        },
      }],
    },
  });
  return { ok: true, action: 'delete_row', deleted_row: row };
}

async function flipInAsana(sheets, spreadsheetId, body) {
  const insertRow = await findInsertRow(sheets, spreadsheetId);
  const lastDataRow = insertRow - 1;
  if (lastDataRow < 2) {
    return { ok: false, error: 'no article rows found in tracker' };
  }

  const bRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!B2:B${lastDataRow}`,
  });
  const target = normalizeTitle(body.title);
  const values = bRes.data.values || [];

  for (let i = 0; i < values.length; i++) {
    if (normalizeTitle((values[i] || [])[0] || '') === target) {
      const row = i + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!J${row}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Y']] },
      });
      return { ok: true, action: 'flip_in_asana', row, title: body.title };
    }
  }
  return { ok: false, error: 'title not found: ' + body.title };
}

module.exports = async function handler(req, res) {
  // CORS / preflight — harmless to allow
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Resolve action source for both POST (JSON body + header secret) and GET
  // (query params + query secret). GET-with-query is the CCR-sandbox path:
  // the cloud routine can only reach this URL via mcp__Vercel__web_fetch_vercel_url
  // which is GET-only and doesn't support custom headers. Secret-in-query is
  // a security regression vs header auth — keep the secret strong and rotate
  // periodically.
  const secret = process.env.WEBHOOK_SECRET;
  let body = {};
  let providedSecret = '';

  if (req.method === 'POST') {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    providedSecret = req.headers['x-webhook-secret'] || '';
  } else if (req.method === 'GET') {
    const url = new URL(req.url, 'https://placeholder.example');
    const action = url.searchParams.get('action');
    if (!action) {
      // Bare GET — health check, no auth required, no action taken
      return res.status(200).json({ ok: true, message: 'wet-ink tracker webhook is live' });
    }
    providedSecret = url.searchParams.get('secret') || '';
    body.action = action;
    for (const k of ['title', 'date', 'row']) {
      if (url.searchParams.has(k)) body[k] = url.searchParams.get(k);
    }
    if (body.row !== undefined) body.row = Number(body.row);
  } else {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  // Shared-secret check (applies to both POST header and GET query)
  if (secret && providedSecret !== secret) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    return res.status(500).json({ ok: false, error: 'SPREADSHEET_ID env var not set' });
  }
  for (const key of ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN']) {
    if (!process.env[key]) {
      return res.status(500).json({ ok: false, error: `${key} env var not set` });
    }
  }

  try {
    const sheets = getSheetsClient();

    switch (body.action) {
      case 'ping':
        return res.status(200).json({ ok: true, message: 'pong' });
      case 'append': {
        const result = await appendArticle(sheets, spreadsheetId, body);
        return res.status(result.ok ? 200 : 400).json(result);
      }
      case 'flip_in_asana': {
        const result = await flipInAsana(sheets, spreadsheetId, body);
        return res.status(result.ok ? 200 : 400).json(result);
      }
      case 'delete_row': {
        const result = await deleteRow(sheets, spreadsheetId, body);
        return res.status(result.ok ? 200 : 400).json(result);
      }
      case 'list_titles': {
        const result = await listTitles(sheets, spreadsheetId);
        return res.status(result.ok ? 200 : 400).json(result);
      }
      default:
        return res.status(400).json({ ok: false, error: 'unknown or missing action' });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
};
