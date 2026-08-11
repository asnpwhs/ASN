/* =====================================================================
   ASN website - Google Apps Script
   ---------------------------------------------------------------------
   PASTE THIS WHOLE FILE into the Apps Script editor, replacing
   everything that is already there, then:

     Deploy  ->  Manage deployments  ->  pencil (Edit)
     Version ->  New version
     Deploy

   It creates three tabs automatically the first time it runs:
     Events      - help requests from teachers (the calendar)
     Signups     - students volunteering for those requests
     ClubEvents  - club events shown on the Events page

   The admin code lives in the website (links.js), not here.
   ===================================================================== */

const EVENTS_SHEET      = 'Events';
const SIGNUPS_SHEET     = 'Signups';
const CLUB_EVENTS_SHEET = 'ClubEvents';

const EVENT_HEADERS      = ['id','title','teacher','description','room','date',
                            'startTime','endTime','type','slots','submittedAt'];
const SIGNUP_HEADERS     = ['eventId','eventTitle','date','room','name','email','signedUpAt'];
const CLUB_EVENT_HEADERS = ['id','name','date','startTime','endTime','location',
                            'description','createdAt'];

function sheetFor(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function asText(v, fmt) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), fmt);
  return v === null || v === undefined ? '' : String(v);
}

function jsonOut(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

// Delete every row whose `idColumn` matches. Walks bottom-up so deleting a
// row doesn't shift the ones still to be checked.
function removeRowsMatching(sheetName, headers, idColumn, id) {
  const sh = sheetFor(sheetName, headers);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return;
  const col = values[0].indexOf(idColumn);
  if (col === -1) return;
  for (let r = values.length - 1; r >= 1; r--) {
    if (String(values[r][col]) === String(id)) sh.deleteRow(r + 1);
  }
}

// ---- Reading ----------------------------------------------------------

function readTasks() {
  const eventRows  = sheetFor(EVENTS_SHEET,  EVENT_HEADERS).getDataRange().getValues();
  const eventHead  = eventRows.shift();

  const signupRows = sheetFor(SIGNUPS_SHEET, SIGNUP_HEADERS).getDataRange().getValues();
  const signupHead = signupRows.shift();

  const signupsByEvent = {};
  signupRows.forEach(function (r) {
    const o = {};
    signupHead.forEach(function (h, i) { o[h] = r[i]; });
    if (!o.eventId) return;
    const key = String(o.eventId);
    if (!signupsByEvent[key]) signupsByEvent[key] = [];
    signupsByEvent[key].push({ name: o.name, email: o.email });
  });

  return eventRows.filter(function (r) { return r[0]; }).map(function (r) {
    const o = {};
    eventHead.forEach(function (h, i) { o[h] = r[i]; });
    o.id        = String(o.id);
    o.date      = asText(o.date, 'yyyy-MM-dd');
    o.startTime = asText(o.startTime, 'HH:mm');
    o.endTime   = asText(o.endTime, 'HH:mm');
    o.slots     = parseInt(o.slots, 10) || 0;
    o.signups   = signupsByEvent[o.id] || [];
    return o;
  });
}

function readClubEvents() {
  const rows = sheetFor(CLUB_EVENTS_SHEET, CLUB_EVENT_HEADERS).getDataRange().getValues();
  const head = rows.shift();

  return rows.filter(function (r) { return r[0]; }).map(function (r) {
    const o = {};
    head.forEach(function (h, i) { o[h] = r[i]; });
    o.id        = String(o.id);
    o.date      = asText(o.date, 'yyyy-MM-dd');
    o.startTime = asText(o.startTime, 'HH:mm');
    o.endTime   = asText(o.endTime, 'HH:mm');
    return o;
  });
}

// ?what=clubEvents returns club events. Anything else returns the calendar
// tasks, so the calendar page keeps working exactly as before.
function doGet(e) {
  const what = (e && e.parameter && e.parameter.what) || 'tasks';
  if (what === 'clubEvents') return jsonOut(readClubEvents());
  return jsonOut(readTasks());
}

// ---- Writing ----------------------------------------------------------

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);

    // Leading apostrophe keeps Sheets from turning "007" into 7.
    const asRoom = function (v) { return "'" + (v === undefined || v === null ? '' : v); };

    if (body.action === 'addEvent') {
      sheetFor(EVENTS_SHEET, EVENT_HEADERS).appendRow([
        body.id, body.title, body.teacher, body.description, asRoom(body.room),
        body.date, body.startTime, body.endTime, body.type, body.slots, new Date()
      ]);

    } else if (body.action === 'addSignup') {
      sheetFor(SIGNUPS_SHEET, SIGNUP_HEADERS).appendRow([
        body.eventId, body.eventTitle, body.date, asRoom(body.room),
        body.name, body.email, new Date()
      ]);

    } else if (body.action === 'deleteEvent') {
      // The admin code is checked by the website (ADMIN_CODE in links.js)
      removeRowsMatching(EVENTS_SHEET,  EVENT_HEADERS,  'id',      body.id);
      removeRowsMatching(SIGNUPS_SHEET, SIGNUP_HEADERS, 'eventId', body.id);

    } else if (body.action === 'addClubEvent') {
      sheetFor(CLUB_EVENTS_SHEET, CLUB_EVENT_HEADERS).appendRow([
        body.id, body.name, body.date, body.startTime, body.endTime,
        body.location, body.description, new Date()
      ]);

    } else if (body.action === 'deleteClubEvent') {
      removeRowsMatching(CLUB_EVENTS_SHEET, CLUB_EVENT_HEADERS, 'id', body.id);

    } else {
      throw new Error('Unknown action: ' + body.action);
    }

    return jsonOut({ ok: true });

  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
