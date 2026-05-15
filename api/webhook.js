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
 *     → inserts a new row above the "POSTED:" summary row, auto-computes
 *       the next # value, fills all 10 default columns.
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
 *   WEBHOOK_SECRET               any random string; callers must send
 *                                this as the X-Webhook-Secret header
 */

const { google } = require('googleapis');

const SHEET_NAME = 'Article Coverage';
const POSTED_MARKER = 'POSTED:';

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

async function findPostedRow(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!B:B`,
  });
  const values = res.data.values || [];
  for (let i = 0; i < values.length; i++) {
    const cell = String((values[i] || [])[0] || '').trim().toUpperCase();
    if (cell.startsWith(POSTED_MARKER)) return i + 1; // 1-indexed
  }
  return -1;
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
  const postedRow = await findPostedRow(sheets, spreadsheetId);
  if (postedRow === -1) {
    return { ok: false, error: 'POSTED: marker not found in column B' };
  }

  // Idempotency: if the title is already in the Article Coverage table,
  // return a "skipped" success rather than insert a duplicate row. Guards
  // against Vercel function retries and pipeline reruns.
  if (body.title && postedRow > 2) {
    const titleCheckRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!B2:B${postedRow - 1}`,
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

  // Compute next # by scanning column A from row 2 to postedRow-1
  let maxNum = 0;
  if (postedRow > 2) {
    const aRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A2:A${postedRow - 1}`,
    });
    for (const row of aRes.data.values || []) {
      const n = Number(row[0]);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  const nextNum = maxNum + 1;

  // Insert a blank row above the POSTED: row.
  // inheritFromBefore: true makes the new row inherit cell formatting,
  // background colors, font, alignment, and data-validation dropdowns
  // from the article row above it (rather than from the bold POSTED:
  // summary row below). Conditional formatting auto-extends to the new
  // row if its range is defined relatively.
  const sheetId = await getSheetId(sheets, spreadsheetId);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        insertDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: postedRow - 1, // 0-indexed for the API
            endIndex: postedRow,
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
    range: `${SHEET_NAME}!A${postedRow}:J${postedRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
  });

  return {
    ok: true,
    action: 'append',
    inserted_at_row: postedRow,
    row_number: nextNum,
    title: body.title,
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
  const postedRow = await findPostedRow(sheets, spreadsheetId);
  const lastDataRow = postedRow === -1 ? 1000 : postedRow - 1;
  if (lastDataRow < 2) {
    return { ok: false, error: 'no data rows found' };
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

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'wet-ink tracker webhook is live' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  // Shared-secret check
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers['x-webhook-secret'] !== secret) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  // Vercel parses JSON bodies automatically when Content-Type is application/json
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
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
      default:
        return res.status(400).json({ ok: false, error: 'unknown or missing action' });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
};
