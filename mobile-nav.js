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

  menu.querySelectorAll(".side-nav-link").forEach(function (link) {
    link.addEventListener("click", function () {
      if (!phoneWidth.matches) return;
      menu.open = false;
      // Focus must not remain on a link hidden inside a collapsed details.
      const toggle = menu.querySelector("summary");
      if (toggle) toggle.focus({ preventScroll: true });
    });
  });
})();
