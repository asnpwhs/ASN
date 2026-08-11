// ============================================================
// ASN site settings — this is the only file you normally edit.
// ============================================================

// Google Form links for the Join / Request help buttons
const FORM_LINKS = {
  join: "https://forms.gle/4eedwosEosP7xKu39",
  request: "https://asnpwhs.github.io/ASN/calendar"
};

// The ASN Apps Script web app. Used by the calendar and the events page.
// If you ever redeploy and the URL changes, change it here only.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxZOITRAsTBec3h2j5We-jfaKqAMBDRCbB7gT23xVJkolqZzzPbMkujA44_R6Ttf35PSw/exec";

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

document.addEventListener("DOMContentLoaded", () => {
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
