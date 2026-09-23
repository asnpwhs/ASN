// ============================================================
// ASN site settings — this is the only file you normally edit.
// ============================================================

// Google Form links for the Join / Request help buttons.
// "request" is a relative link so it keeps working if the site moves to a
// different repo or URL. Don't put the full https://... address here.
const FORM_LINKS = {
  join: "https://forms.gle/4eedwosEosP7xKu39",
  request: "calendar.html"
};

// The ASN Apps Script web app. Used by the calendar and the events page.
// If you ever redeploy and the URL changes, change it here only.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyRIEs5uNdqiOtLtVbwsjNSmrkLmBBFazztcPo1wYGBKhKAD2MENZFrhJ5DqbbuOXtZXA/exec";

// ============================================================
// ADMIN CODE — typed before creating or deleting an event, and
// before deleting a task on the calendar. Change it here;
// nothing else needs updating.
//
// Heads up: this file is public, so anyone who views the page
// source or the GitHub repo can read this. It stops accidental
// and casual clicks, not someone determined to go looking.
// ============================================================
const ADMIN_CODE = "empower";

// ============================================================
// CLUB EMAIL — shown on the "Got a different question?" line.
// Leave blank and the site tells people to ask an officer at
// school instead, so there is never a dead link.
// ============================================================
const CLUB_EMAIL = "asnpwhs@gmail.com";

document.addEventListener("DOMContentLoaded", () => {
  // Contact line: real mailto when an address is set, honest fallback if not
  document.querySelectorAll("[data-club-email]").forEach(el => {
    if (typeof CLUB_EMAIL !== "undefined" && CLUB_EMAIL) {
      el.href = "mailto:" + CLUB_EMAIL;
      el.textContent = CLUB_EMAIL;
    } else {
      const span = document.createElement("span");
      span.textContent = "Grab any of us in the hall.";
      el.replaceWith(span);
    }
  });

  document.querySelectorAll("[data-form]").forEach(btn => {
    const url = FORM_LINKS[btn.dataset.form];
    if (url) {
      btn.href = url;
      btn.target = "_blank";
      btn.rel = "noopener";
    } else {
      btn.addEventListener("click", e => {
        e.preventDefault();
        const note = btn.closest("section")?.querySelector(".form-note")
                  || document.querySelector(".form-note");
        if (note) {
          note.classList.add("show");
          setTimeout(() => note.classList.remove("show"), 3500);
        }
      });
    }
  });
});
