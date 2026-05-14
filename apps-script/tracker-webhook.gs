/**
 * Wet Ink content-pipeline webhook.
 *
 * Exposes a POST endpoint the scheduled content-pipeline calls instead of
 * driving Google Sheets through the Chrome MCP. Lets the daily run write
 * to the tracker without anyone's laptop being awake.
 *
 * Supported actions (send as JSON body):
 *   { action: "ping" }
 *     → sanity check
 *   { action: "append", title: "<title>", date: "<Month DD, YYYY>" }
 *     → inserts a new row above the POSTED: summary, fills the 10 default
 *       columns. # is auto-computed from the highest existing # value.
 *   { action: "flip_in_asana", title: "<title>" }
 *     → finds the row by title (with the same normalization the pipeline
 *       uses) and sets column J ("In Asana") to "Y".
 *
 * Deploy:
 *   1. Open the Wet_Ink_IG_Content_Tracker sheet.
 *   2. Extensions → Apps Script. Replace the default Code.gs with this file.
 *   3. Save (disk icon or Cmd+S).
 *   4. Deploy → New deployment → gear icon → "Web app".
 *   5. Description: "Wet Ink tracker webhook v1"
 *      Execute as: Me (andrew@archernagle.com)
 *      Who has access: Anyone with the link
 *   6. Click Deploy. First time, Google will ask you to authorize — click
 *      "Authorize access", pick your account, and on the "Google hasn't
 *      verified this app" screen click "Advanced" → "Go to <project> (unsafe)"
 *      → "Allow". This is fine — you wrote the app.
 *   7. Copy the "Web app URL" that appears. Paste it back into chat.
 *
 * Future redeploys:
 *   When you edit this script, you must Deploy → Manage deployments → pencil
 *   icon → Version: New version → Deploy. The URL stays the same.
 */

const SPREADSHEET_ID = '1sPQwj2ZSu9A7drg2YuUwQrcwVQ7JQNcbM7qRbQhMhaA';
const SHEET_NAME = 'Article Coverage';
const POSTED_MARKER = 'POSTED:';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'append':
        return appendArticle(body);
      case 'flip_in_asana':
        return flipInAsana(body);
      case 'ping':
        return jsonResponse({ ok: true, message: 'pong' });
      default:
        return jsonResponse({ ok: false, error: 'unknown action: ' + body.action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet() {
  return jsonResponse({ ok: true, message: 'wet-ink tracker webhook is live' });
}

function appendArticle(body) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const postedRow = findPostedRow(sheet);
  if (postedRow === -1) {
    return jsonResponse({ ok: false, error: 'POSTED: marker not found in column B' });
  }

  // Compute next # by scanning column A from row 2 to postedRow-1
  let maxNum = 0;
  if (postedRow > 2) {
    const colA = sheet.getRange(2, 1, postedRow - 2, 1).getValues();
    for (const [n] of colA) {
      const num = Number(n);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  const nextNum = maxNum + 1;

  // Insert a row above the POSTED: row, then fill it
  sheet.insertRowBefore(postedRow);
  const values = [[
    nextNum,                // A: #
    body.title || '',       // B: Article Title
    body.date || '',        // C: Published Date
    'N',                    // D: Posted on IG?
    '',                     // E: Post Type
    '',                     // F: IG Post Date
    '',                     // G: IG Link
    'Y',                    // H: Create Post?
    'Reel',                 // I: New Post Type
    'N'                     // J: In Asana
  ]];
  sheet.getRange(postedRow, 1, 1, 10).setValues(values);

  return jsonResponse({
    ok: true,
    action: 'append',
    inserted_at_row: postedRow,
    row_number: nextNum,
    title: body.title
  });
}

function flipInAsana(body) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const postedRow = findPostedRow(sheet);
  const lastDataRow = postedRow === -1 ? sheet.getLastRow() : postedRow - 1;
  if (lastDataRow < 2) {
    return jsonResponse({ ok: false, error: 'no data rows found' });
  }

  const titles = sheet.getRange(2, 2, lastDataRow - 1, 1).getValues();
  const target = normalizeTitle(body.title);

  for (let i = 0; i < titles.length; i++) {
    if (normalizeTitle(titles[i][0]) === target) {
      const row = i + 2;
      sheet.getRange(row, 10).setValue('Y');
      return jsonResponse({ ok: true, action: 'flip_in_asana', row, title: body.title });
    }
  }
  return jsonResponse({ ok: false, error: 'title not found: ' + body.title });
}

function findPostedRow(sheet) {
  const last = sheet.getLastRow();
  if (last < 1) return -1;
  const colB = sheet.getRange(1, 2, last, 1).getValues();
  for (let i = 0; i < colB.length; i++) {
    if (String(colB[i][0]).trim().toUpperCase().startsWith(POSTED_MARKER)) {
      return i + 1;
    }
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

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// === Manual test helpers (run from the Apps Script editor) ===

function test_ping() {
  const res = doPost({ postData: { contents: JSON.stringify({ action: 'ping' }) } });
  Logger.log(res.getContent());
}

function test_append_dummy() {
  // Inserts a dummy row. After running, delete the row manually in the sheet.
  const res = doPost({ postData: { contents: JSON.stringify({
    action: 'append',
    title: 'TEST ROW — delete me',
    date: 'May 13, 2026'
  }) } });
  Logger.log(res.getContent());
}
