# Logging calendar tasks to the ASN Google Sheet

The calendar page now **sends** every help request and every volunteer signup to your
Google Sheet. For that to work, the Apps Script behind the sheet needs to accept
incoming data (`doPost`). Right now it only serves data out (`doGet`), so the sending
half will fail until you do the steps below.

**Someone with access to the Google account has to do this — it can't be done from the website side.**

---

## Step 1 — Name the spreadsheet `ASN`

Open the spreadsheet the calendar already reads from and rename it to **ASN**.

The script will create two tabs inside it automatically the first time it runs:

- **Events** — one row per help request
- **Signups** — one row per volunteer signup

---

## Step 2 — Replace the Apps Script code

In the spreadsheet: **Extensions → Apps Script**. Delete everything in the editor and
paste this in:

```javascript
const EVENTS_SHEET  = 'Events';
const SIGNUPS_SHEET = 'Signups';

const EVENT_HEADERS  = ['id','title','teacher','description','room','date',
                        'startTime','endTime','type','slots','submittedAt'];
const SIGNUP_HEADERS = ['eventId','eventTitle','date','room','name','email','signedUpAt'];

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

// ---- Send events out to the website ----
function doGet() {
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

  const events = eventRows.filter(function (r) { return r[0]; }).map(function (r) {
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

  return ContentService.createTextOutput(JSON.stringify(events))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- Receive new requests and signups from the website ----
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.action === 'addEvent') {
      sheetFor(EVENTS_SHEET, EVENT_HEADERS).appendRow([
        body.id, body.title, body.teacher, body.description, body.room,
        body.date, body.startTime, body.endTime, body.type, body.slots, new Date()
      ]);

    } else if (body.action === 'addSignup') {
      sheetFor(SIGNUPS_SHEET, SIGNUP_HEADERS).appendRow([
        body.eventId, body.eventTitle, body.date, body.room,
        body.name, body.email, new Date()
      ]);

    } else {
      throw new Error('Unknown action: ' + body.action);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```

---

## Step 3 — Redeploy

1. **Deploy → Manage deployments**
2. Click the pencil (Edit) on the existing deployment
3. Version: **New version**
4. **Execute as:** Me
5. **Who has access:** **Anyone** ← must be "Anyone", not "Anyone with Google account"
6. **Deploy**

Keep the **same deployment** so the URL doesn't change. If the URL *does* change, paste
the new one into `calendar.html` at the line beginning `const SCRIPT_URL =`.

---

## Heads-up about your existing rows

The old sheet stored a teacher's email in a column called `department` and had no
`room`, `teacher`, or `description` columns. The new layout above expects the headers
listed in `EVENT_HEADERS`.

The cleanest path: make a fresh **Events** tab with those exact headers and re-enter any
requests still worth keeping. There were only about 20 real rows, plus 7 test rows
("hello", "WWWWW", "hahaha", "im bored", and similar with years like 1909 and 389) that
are worth deleting anyway.

---

## Current status

- ✅ New Apps Script code deployed
- ✅ New deployment URL now saved in `calendar.html`
- ❌ **The deployment is still private — this is the one thing left to fix**

### What's wrong right now

Opening the deployment URL doesn't return calendar data. It redirects to a **Google
sign-in page**, which means the web app is set to require a Google login. Students and
teachers visiting the site are anonymous, so they get the login screen instead of the
calendar, and nothing can be saved.

### The fix (about 20 seconds)

1. Open the ASN sheet → **Extensions → Apps Script**
2. **Deploy → Manage deployments**
3. Click the **pencil (Edit)** icon
4. Set **Who has access** to **Anyone**
   - It is almost certainly on *"Anyone with a Google account"* right now. That is **not**
     the same thing and will not work — it must be plain **Anyone**.
5. Leave **Execute as: Me**
6. **Deploy**

Google will warn that the app will be available to anyone with the link. That's expected
for a public website. The app only ever reads and appends calendar rows.

### Confirming it worked

Open the deployment URL in a browser tab where you are **signed out** (or a private /
incognito window). You should see raw JSON beginning with `[{` — not a sign-in page.

Then reload the calendar page. The red *"Calendar is not connected to the ASN sheet"*
banner should disappear on its own.

---

## Other things to check if it still misbehaves

### The code was pasted but not redeployed

Apps Script keeps serving the last **deployed version**, not what's currently in the
editor. Saving the file changes nothing on the web.

**Fix:** **Deploy → Manage deployments** → pencil → **Version: New version** → **Deploy**.

### A brand-new deployment was created, so the URL changed again

Every **Deploy → New deployment** issues a *different* `/exec` URL. If you make another
one, copy it into `calendar.html` on the `const SCRIPT_URL = ...` line and re-upload.

### The script isn't attached to the ASN spreadsheet

The code uses `SpreadsheetApp.getActiveSpreadsheet()`, which only works for a script
opened from **inside** the sheet via **Extensions → Apps Script**. If you created it at
`script.google.com` as a standalone project, it has no active spreadsheet and every call
fails.

**Fix:** either redo it from Extensions → Apps Script inside the ASN sheet, or replace
the first line of `sheetFor` with an explicit open:

```javascript
const ss = SpreadsheetApp.openById('PASTE_THE_SPREADSHEET_ID_HERE');
```

The ID is the long string in the sheet's own URL between `/d/` and `/edit`.

### Also confirm

- **Who has access: Anyone** — not "Anyone with a Google account". This is a common trip-up.
- **Execute as: Me.**
- The tabs are named exactly **Events** and **Signups** (the script creates them if missing).

---

## Once it's deployed

1. Reload the calendar page, click **Request Help**, submit a test request.
2. Expect *"Checking the sheet…"* then **"Request saved to the ASN sheet. Thanks!"**
3. The row appears on the **Events** tab.
4. Open that task and sign up as a test volunteer — that row lands on **Signups**.
5. Delete the test rows when you're happy.

The page now confirms saves by **reading the sheet back**, so that success message only
appears if the row genuinely arrived. If it says *"Showing on this device only"*, the row
did not save and you should work back through the causes above.
