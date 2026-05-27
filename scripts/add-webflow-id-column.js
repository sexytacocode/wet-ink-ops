/**
 * One-shot: write the "Webflow ID" header into L1 of the
 * Wet_Ink_IG_Content_Tracker's "Article Coverage" tab.
 *
 * Run once after the column-L webhook changes are deployed. Uses the
 * same OAuth refresh-token flow as the webhook so the env is already
 * available locally after `vercel env pull .env.local`.
 *
 * Usage:
 *   cd /Users/andrewnagle/Documents/wet-ink-ops
 *   vercel env pull .env.local
 *   node -r dotenv/config scripts/add-webflow-id-column.js dotenv_config_path=.env.local
 *
 * Or simpler (sources the .env.local manually):
 *   export $(grep -v '^#' .env.local | xargs)
 *   node scripts/add-webflow-id-column.js
 */

const { google } = require('googleapis');

const SHEET_NAME = 'Article Coverage';
const HEADER_VALUE = 'Webflow ID';
const HEADER_CELL = 'L1';

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

async function main() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  for (const k of ['SPREADSHEET_ID', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN']) {
    if (!process.env[k]) {
      console.error(`Missing env var: ${k}`);
      console.error('Did you run `vercel env pull .env.local` and `export $(grep -v "^#" .env.local | xargs)`?');
      process.exit(1);
    }
  }

  const sheets = getSheetsClient();

  // Read current L1 so we don't clobber an existing header
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!${HEADER_CELL}`,
  });
  const existing = ((cur.data.values || [])[0] || [])[0] || '';
  if (existing.trim() === HEADER_VALUE) {
    console.log(`L1 already contains "${HEADER_VALUE}". Nothing to do.`);
    return;
  }
  if (existing && existing.trim() !== '') {
    console.error(`L1 is non-empty ("${existing}"). Refusing to overwrite. Set it manually if intentional.`);
    process.exit(2);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!${HEADER_CELL}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[HEADER_VALUE]] },
  });

  console.log(`Wrote "${HEADER_VALUE}" to ${SHEET_NAME}!${HEADER_CELL}.`);
}

main().catch((err) => {
  console.error('Error:', err && err.message ? err.message : err);
  process.exit(1);
});
