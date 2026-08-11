/* ==========================================================================
   ASN — club events
   Powers the "Upcoming events" strip on the homepage and the full Events
   page. Reads from the ASN sheet via SCRIPT_URL in links.js.
   ========================================================================== */

(function () {
  "use strict";

  const CACHE_KEY = 'asn_cached_club_events';

  // links.js is deferred, so read its values when needed rather than caching
  // them while this file is parsing.
  const scriptUrl = () =>
    (typeof SCRIPT_URL !== 'undefined' && SCRIPT_URL) ? SCRIPT_URL : '';
  const adminCode = () =>
    (typeof ADMIN_CODE !== 'undefined' && ADMIN_CODE) ? String(ADMIN_CODE) : '';

  /* ---------- helpers ---------- */

  function readCache() {
    try {
      const v = JSON.parse(localStorage.getItem(CACHE_KEY));
      return Array.isArray(v) ? v : [];
    } catch (_) {
      return [];
    }
  }

  // "2026-09-22" -> "Tue, Sep 22". Falls back to the raw text if unparseable.
  function prettyDate(value) {
    if (!value) return '';
    const d = new Date(String(value) + 'T00:00:00');
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function prettyTime(value) {
    if (!value) return '';
    const s = String(value).trim();
    const hhmm = s.match(/^(\d{1,2}):(\d{2})/);
    if (hhmm) {
      let h = parseInt(hhmm[1], 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      return (h % 12 || 12) + ':' + hhmm[2] + ' ' + ampm;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      let h = d.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      return (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ampm;
    }
    return s;
  }

  function timeRange(evt) {
    const a = prettyTime(evt.startTime);
    const b = prettyTime(evt.endTime);
    if (a && b) return a + ' to ' + b;
    return a || b || '';
  }

  // Today at midnight, so an event happening today still counts as upcoming.
  function isUpcoming(evt) {
    const d = new Date(String(evt.date) + 'T00:00:00');
    if (isNaN(d.getTime())) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
  }

  function byDate(a, b) {
    return String(a.date).localeCompare(String(b.date)) ||
           String(a.startTime).localeCompare(String(b.startTime));
  }

  /* ---------- data ---------- */

  async function fetchClubEvents() {
    const url = scriptUrl();
    if (!url) throw new Error('NO_URL');
    const res = await fetch(url + '?what=clubEvents&t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.text();
    if (raw.trim().startsWith('<')) throw new Error('NOT_PUBLIC');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error('NOT_JSON');

    // An Apps Script that hasn't been updated yet ignores ?what= and returns
    // calendar tasks instead. Those have `title`, not `name` — drop anything
    // that isn't a club event rather than rendering nonsense.
    const events = list.filter(e => e && typeof e.name === 'string' && e.name.trim() !== '');

    localStorage.setItem(CACHE_KEY, JSON.stringify(events));
    return events;
  }

  async function postClubEvent(action, payload) {
    const url = scriptUrl();
    const body = JSON.stringify({ action, ...payload });
    const headers = { 'Content-Type': 'text/plain;charset=utf-8' };
    try {
      const res = await fetch(url, { method: 'POST', headers, body });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      let reply = null;
      try { reply = JSON.parse(text); } catch (_) {}
      if (reply && reply.ok === false) {
        const rejection = new Error(reply.error || 'Rejected');
        rejection.rejected = true;
        throw rejection;
      }
      return true;
    } catch (err) {
      if (err.rejected) throw err;
      // Browser wouldn't let us read the reply; send it blind and verify after
      await fetch(url, { method: 'POST', mode: 'no-cors', headers, body });
      return false;
    }
  }

  /* ---------- homepage strip ---------- */

  function renderUpcoming(list) {
    const host = document.getElementById('upcomingEvents');
    if (!host) return;

    const upcoming = list.filter(isUpcoming).sort(byDate).slice(0, 3);
    host.replaceChildren();

    if (!upcoming.length) {
      const empty = document.createElement('p');
      empty.className = 'upcoming-empty';
      empty.textContent = 'No events scheduled yet. Check back soon.';
      host.appendChild(empty);
      return;
    }

    upcoming.forEach(evt => {
      const row = document.createElement('div');
      row.className = 'upcoming-row';

      const text = document.createElement('div');
      const name = document.createElement('span');
      name.className = 'upcoming-name';
      name.textContent = evt.name;
      const when = document.createElement('span');
      when.className = 'upcoming-when';
      when.textContent = [prettyDate(evt.date), timeRange(evt)].filter(Boolean).join(' · ');
      text.append(name, when);

      const link = document.createElement('a');
      link.className = 'upcoming-link';
      link.href = '/ASN/events' + encodeURIComponent(evt.id);
      link.textContent = 'Learn more';

      row.append(text, link);
      host.appendChild(row);
    });
  }

  /* ---------- events page ---------- */

  function renderEventsPage(list) {
    const host = document.getElementById('eventsList');
    if (!host) return;

    const sorted = list.slice().sort(byDate);
    host.replaceChildren();

    if (!sorted.length) {
      const empty = document.createElement('div');
      empty.className = 'events-empty';
      const h = document.createElement('h3');
      h.textContent = 'No events yet';
      const p = document.createElement('p');
      p.textContent = 'Nothing is scheduled right now. Check back soon.';
      empty.append(h, p);
      host.appendChild(empty);
      return;
    }

    sorted.forEach(evt => {
      const card = document.createElement('article');
      card.className = 'event-card' + (isUpcoming(evt) ? '' : ' is-past');
      card.id = String(evt.id);

      const head = document.createElement('div');
      head.className = 'event-card-head';

      const title = document.createElement('h3');
      title.textContent = evt.name;
      head.appendChild(title);

      if (!isUpcoming(evt)) {
        const tag = document.createElement('span');
        tag.className = 'event-past-tag';
        tag.textContent = 'Past';
        head.appendChild(tag);
      }

      const meta = document.createElement('p');
      meta.className = 'event-meta';
      meta.textContent = [prettyDate(evt.date), timeRange(evt), evt.location]
        .filter(Boolean).join(' · ');

      card.append(head, meta);

      if (evt.description && String(evt.description).trim()) {
        const desc = document.createElement('p');
        desc.className = 'event-desc';
        desc.textContent = evt.description;
        card.appendChild(desc);
      }

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'event-delete';
      del.textContent = 'Delete event';
      del.addEventListener('click', () => deleteEvent(evt));
      card.appendChild(del);

      host.appendChild(card);
    });

    // If we arrived from a "Learn more" link, highlight that event
    if (location.hash.length > 1) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) {
        target.classList.add('is-target');
        target.scrollIntoView({ block: 'center' });
      }
    }
  }

  function setNotice(message, state) {
    const el = document.getElementById('eventsNotice');
    if (!el) return;
    el.textContent = message || '';
    el.className = 'events-notice' + (state ? ' ' + state : '');
    el.hidden = !message;
  }

  async function deleteEvent(evt) {
    const expected = adminCode();
    if (!expected) {
      setNotice('The admin code could not be loaded, so nothing was deleted. Refresh the page (Ctrl+Shift+R) and try again.', 'err');
      return;
    }
    if (!confirm('Delete "' + evt.name + '"?\n\nThis removes it for everyone.')) return;

    const entered = prompt('Admin code:');
    if (entered === null || entered.trim() === '') return;
    if (entered.trim() !== expected) {
      setNotice('That code is not right, so nothing was deleted.', 'err');
      return;
    }

    setNotice('Deleting…', 'busy');
    try {
      const confirmed = await postClubEvent('deleteClubEvent', { id: evt.id });
      if (!confirmed) await new Promise(r => setTimeout(r, 1500));
      const list = await fetchClubEvents();
      if (list.some(e => String(e.id) === String(evt.id))) {
        throw new Error('still there');
      }
      setNotice('Deleted.', 'ok');
      renderEventsPage(list);
    } catch (err) {
      console.error('Could not delete the event:', err);
      setNotice('Could not delete it. Remove the row from the ClubEvents tab instead.', 'err');
    }
  }

  function wireCreateForm() {
    const openBtn  = document.getElementById('createEventBtn');
    const modal    = document.getElementById('createEventModal');
    const form     = document.getElementById('createEventForm');
    if (!openBtn || !modal || !form) return;

    const close = () => {
      modal.classList.remove('active');
      form.reset();
      setStatus('', '');
    };
    const setStatus = (msg, state) => {
      const el = document.getElementById('createEventStatus');
      el.textContent = msg || '';
      el.className = 'save-status' + (state ? ' ' + state : '');
    };

    openBtn.addEventListener('click', () => {
      const expected = adminCode();
      if (!expected) {
        setNotice('The admin code could not be loaded. Refresh the page (Ctrl+Shift+R) and try again.', 'err');
        return;
      }
      const entered = prompt('Admin code:');
      if (entered === null || entered.trim() === '') return;
      if (entered.trim() !== expected) {
        setNotice('That code is not right.', 'err');
        return;
      }
      setNotice('', '');
      modal.classList.add('active');
    });

    document.getElementById('closeCreateModalBtn').addEventListener('click', close);
    document.getElementById('cancelCreateModalBtn').addEventListener('click', close);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('createEventSubmitBtn');

      const evt = {
        id: 'evt_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 7),
        name: document.getElementById('evName').value.trim(),
        date: document.getElementById('evDate').value,
        startTime: document.getElementById('evStart').value,
        endTime: document.getElementById('evEnd').value,
        location: document.getElementById('evLocation').value.trim(),
        description: document.getElementById('evDescription').value.trim()
      };

      submitBtn.disabled = true;
      setStatus('Publishing…', 'busy');

      try {
        const confirmed = await postClubEvent('addClubEvent', evt);
        if (!confirmed) {
          setStatus('Checking it saved…', 'busy');
          await new Promise(r => setTimeout(r, 1500));
        }
        const list = await fetchClubEvents();
        if (!list.some(e2 => String(e2.id) === String(evt.id))) {
          throw new Error('did not appear');
        }
        setStatus('Event published.', 'ok');
        renderEventsPage(list);
        setTimeout(close, 900);
      } catch (err) {
        console.error('Could not publish the event:', err);
        setStatus('It did not save to the ASN sheet. Check the Apps Script is up to date (see SETUP.md).', 'err');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', async () => {
    const cached = readCache();
    renderUpcoming(cached);
    renderEventsPage(cached);
    wireCreateForm();

    try {
      const list = await fetchClubEvents();
      renderUpcoming(list);
      renderEventsPage(list);
    } catch (err) {
      console.error('Could not load club events:', err);
      if (!cached.length) {
        setNotice('Could not load events right now. Showing nothing until the connection works.', 'err');
      }
    }
  });
})();
