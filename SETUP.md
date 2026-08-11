# ASN site setup

The calendar and the events page both store their data in the Google Sheet, through a
small Apps Script. Teachers post help requests, students volunteer, officers create club
events, and everyone sees the same thing.

---

## Do this now: redeploy the script

The script needs updating for the **Events page** to work. It adds a `ClubEvents` tab and
the create/delete actions behind it. Nothing already working is affected.

1. Open **`apps-script.gs`** in this folder. Select all, copy.
2. ASN sheet → **Extensions → Apps Script**. Select all in the editor, paste over it.
3. **Deploy → Manage deployments → pencil (Edit) → Version: New version → Deploy**

Until you do this, the Events page will simply show "No events yet" and creating an event
will report that it didn't save. The calendar keeps working as normal throughout.

---

## After you change links.js

Browsers hold on to old copies of `links.js`, so an edit can look like it did nothing.
Every page loads it as `links.js?v=3`. **Bump that number** (to `?v=4`, and so on) in all
five HTML files whenever you edit `links.js`, and everyone picks up the change right away.

---

## If the site can't reach the sheet

The usual cause is the deployment being set to require a Google login, so visitors get a
sign-in page instead of data.

1. Open the ASN sheet → **Extensions → Apps Script**
2. **Deploy → Manage deployments**
3. Click the **pencil (Edit)** icon on the deployment
4. Change **Who has access** to **Anyone**
5. Leave **Execute as: Me**
6. **Deploy**

### The part that trips everyone up

The dropdown has two options that look almost identical:

| Option | What it does |
|---|---|
| Anyone with a Google account | Demands a login. **Does not work** for a public website. |
| **Anyone** | Works. This is the one you want. |

Google will warn you the app is available to anyone with the link. That's expected for a
public school-club site — the script only reads and appends calendar rows.

### Check it worked

Open your `/exec` URL in a **private / incognito window** (so you're signed out). You
should see raw text starting with `[{`. If you see a sign-in page, the setting didn't
save — try again.

Then reload the calendar. The red *"Calendar is not connected yet"* banner disappears on
its own once it can read the sheet.

---

## How the flow works once it's on

**Teacher posts a request**
1. Clicks **+ Request Help** on the calendar
2. Fills in task, their name, description, date, room, time, volunteers needed
3. Presses **Submit request** → the row is written to the **Events** tab
4. It appears on the calendar for every visitor

**Student volunteers**
1. Clicks the task on the calendar
2. Enters name and email, presses **Sign up**
3. The row is written to the **Signups** tab
4. The chip colour updates for everyone

**Colours**, from signups vs volunteers needed:
- **Red** — nobody yet
- **Orange** — some, still short
- **Green** — fully staffed

Nothing is confirmed on trust: after saving, the page **reads the sheet back** and only
shows a success message if the row actually arrived.

---

## The Apps Script code

The same code is in **`apps-script.gs`** in this folder, on its own with no surrounding
text, which is easier to copy from. Open it, select all, copy.

Then in the Apps Script editor: select all, paste over it, and redeploy with
**Version: New version**.

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

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);

    // Leading apostrophe keeps Sheets from turning a room like "007" into 7.
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
      // The officer code is checked by the website (DELETE_CODE in links.js)
      removeRowsMatching(EVENTS_SHEET,  EVENT_HEADERS,  'id',      body.id);
      removeRowsMatching(SIGNUPS_SHEET, SIGNUP_HEADERS, 'eventId', body.id);

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

## Other things to check

**Pasted the code but nothing changed?** Apps Script serves the last *deployed version*,
not what's in the editor. Redeploy with **Version: New version**.

**Made a brand-new deployment?** That issues a *different* `/exec` URL. Copy it into
`calendar.html` on the `const SCRIPT_URL = ...` line and re-upload.

**Script not attached to the sheet?** The code uses `getActiveSpreadsheet()`, which only
works if you opened the editor from **Extensions → Apps Script inside the ASN sheet**. If
it's a standalone project, swap the first line of `sheetFor` for:

```javascript
const ss = SpreadsheetApp.openById('PASTE_SPREADSHEET_ID_HERE');
```

**Deleting a task from the website** needs the `deleteEvent` part of the script above.
Until you re-paste and redeploy, the Delete button will report that it couldn't delete —
remove the row from the **Events** tab in the sheet instead.

The code is **`empower`**, set in **`links.js`**:

```javascript
const DELETE_CODE = "empower";
```

Change it there and re-upload that one file. No script redeploy needed.

**What this does and doesn't do.** The check happens in the website, and website files are
public, so anyone who views the page source or opens your GitHub repo can read the code.
It reliably prevents accidental clicks and casual poking, which is the realistic risk for
a club calendar. It won't stop someone who deliberately goes looking.

If you later want it to be genuinely locked, the check has to move back into the Apps
Script, where the code isn't visible to visitors. That means a redeploy each time you
change it. Say the word and I'll switch it back.

**Room numbers with a leading zero** (like `007`) get stored as `7` unless the script has
the `asRoom` line above. If your rooms are ordinary numbers like `204`, or contain
letters, you don't need to change anything. If you do use leading zeros, re-paste the
script and redeploy with **Version: New version**.

---

## If Google keeps fighting you

The alternative is Supabase — a free hosted database that talks to websites directly,
with no deployment step or access dropdown to get wrong. It needs a signup and a table,
and then two values pasted into the site. Say the word and I'll switch it over.
