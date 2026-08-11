/* ==========================================================================
   ASN — shared navigation + motion
   Handles the mobile slide-in menu and the reveal-on-scroll animations.
   No dependencies; loaded with `defer` on every page.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- Mobile slide-in menu ---------- */

  const toggle = document.querySelector("[data-menu-toggle]");
  const sheet = document.querySelector("[data-menu-sheet]");
  const scrim = document.querySelector("[data-menu-scrim]");
  const closeBtn = document.querySelector("[data-menu-close]");

  if (toggle && sheet && scrim) {
    let lastFocused = null;

    const openMenu = () => {
      lastFocused = document.activeElement;
      sheet.classList.add("is-open");
      scrim.classList.add("is-open");
      sheet.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("menu-open");
      if (closeBtn) closeBtn.focus();
    };

    const closeMenu = () => {
      sheet.classList.remove("is-open");
      scrim.classList.remove("is-open");
      sheet.setAttribute("aria-hidden", "true");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
      if (lastFocused) lastFocused.focus();
    };

    toggle.addEventListener("click", () => {
      const isOpen = sheet.classList.contains("is-open");
      isOpen ? closeMenu() : openMenu();
    });

    scrim.addEventListener("click", closeMenu);
    if (closeBtn) closeBtn.addEventListener("click", closeMenu);

    // Close when a link inside the sheet is followed
    sheet.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sheet.classList.contains("is-open")) closeMenu();
    });

    // Keep state sane if the viewport grows back to desktop
    window.matchMedia("(min-width: 861px)").addEventListener("change", (e) => {
      if (e.matches && sheet.classList.contains("is-open")) closeMenu();
    });
  }

  /* ---------- Reveal on scroll ---------- */

  const revealItems = document.querySelectorAll("[data-reveal]");
  if (!revealItems.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced || !("IntersectionObserver" in window)) {
    revealItems.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  // Mark an element revealed, then settle it so hover transforms work again.
  const reveal = (el) => {
    if (el.classList.contains("is-visible")) return;
    el.classList.add("is-visible");
    const settle = () => el.classList.add("reveal-done");
    el.addEventListener("animationend", settle, { once: true });
    // Backstop in case animationend never arrives (background tab, etc.)
    setTimeout(settle, 1400);
  };

  let observerFired = false;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observerFired = true;
          reveal(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  revealItems.forEach((el) => observer.observe(el));

  // Anything already in view on load reveals right away. setTimeout rather
  // than requestAnimationFrame, which is paused in background tabs.
  setTimeout(() => {
    revealItems.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) reveal(el);
    });
  }, 60);

  // Failsafe: content is hidden by CSS, so if the observer never reports in,
  // show everything rather than leave the page blank.
  setTimeout(() => {
    if (!observerFired) revealItems.forEach(reveal);
  }, 2500);
})();
