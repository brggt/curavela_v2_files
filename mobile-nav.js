/* Keep the desktop navigation available while collapsing it on phones.
 * The HTML details element starts open so desktop navigation also works
 * when JavaScript is disabled or media queries are unavailable. */
(function initializeMobileNavigation() {
  const menu = document.querySelector(".mobile-navigation");
  if (!menu || typeof window.matchMedia !== "function") return;

  const phoneWidth = window.matchMedia("(max-width: 700px)");
  function syncNavigation() {
    // Always restore the desktop sidebar when crossing the breakpoint.
    // Mobile starts collapsed, without changing the selected app view.
    menu.open = !phoneWidth.matches;
  }
  syncNavigation();

  if (typeof phoneWidth.addEventListener === "function") {
    phoneWidth.addEventListener("change", syncNavigation);
  } else if (typeof phoneWidth.addListener === "function") {
    phoneWidth.addListener(syncNavigation);
  }

  const toggle = menu.querySelector("summary");
  function closeMobileMenu(restoreFocus) {
    if (!phoneWidth.matches || !menu.open) return;
    menu.open = false;
    if (restoreFocus && toggle) toggle.focus({ preventScroll: true });
  }

  menu.querySelectorAll(".side-nav-link").forEach(function (link) {
    link.addEventListener("click", function () {
      // Focus must not remain on a link hidden inside a collapsed details.
      closeMobileMenu(true);
    });
  });

  // When the menu overlays the schedule, tapping outside must dismiss it
  // without stealing focus from the tapped control or scrolling the page.
  document.addEventListener("pointerdown", function (event) {
    if (phoneWidth.matches && menu.open && !menu.contains(event.target)) {
      closeMobileMenu(false);
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMobileMenu(true);
  });
})();
