const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "mobile-nav.js"), "utf8");

function fixture(isPhone, useLegacyMediaListener = false) {
  let focusCount = 0;
  const documentHandlers = {};
  const summary = { focus(options) {
    assert.equal(options.preventScroll, true);
    focusCount++;
  } };
  const links = Array.from({ length: 9 }, () => ({
    handlers: {},
    addEventListener(event, callback) { this.handlers[event] = callback; }
  }));
  const menu = {
    open: true,
    contains(target) { return target === this || target === summary || links.includes(target); },
    querySelectorAll(selector) {
      assert.equal(selector, ".side-nav-link");
      return links;
    },
    querySelector(selector) {
      assert.equal(selector, "summary");
      return summary;
    }
  };
  const media = { matches: isPhone };
  let changeHandler;
  if (useLegacyMediaListener) {
    media.addListener = handler => { changeHandler = handler; };
  } else {
    media.addEventListener = (event, handler) => {
      assert.equal(event, "change");
      changeHandler = handler;
    };
  }
  vm.runInNewContext(script, {
    document: {
      querySelector(selector) {
        assert.equal(selector, ".mobile-navigation");
        return menu;
      },
      addEventListener(event, handler) { documentHandlers[event] = handler; }
    },
    window: { matchMedia(query) {
      assert.equal(query, "(max-width: 700px)");
      return media;
    } }
  });
  return {
    menu, media, links,
    dispatch(event, payload) { documentHandlers[event](payload); },
    changeWidth(matches) {
      media.matches = matches;
      changeHandler();
    },
    get focusCount() { return focusCount; }
  };
}

test("desktop navigation stays open and links do not collapse it", () => {
  const f = fixture(false);
  assert.equal(f.menu.open, true);
  f.links[0].handlers.click();
  assert.equal(f.menu.open, true);
  assert.equal(f.focusCount, 0);
});

test("phone navigation starts closed, opens on demand and closes after selection", () => {
  const f = fixture(true);
  assert.equal(f.menu.open, false);
  f.menu.open = true;
  f.links[3].handlers.click();
  assert.equal(f.menu.open, false);
  assert.equal(f.focusCount, 1);
});

test("crossing the phone breakpoint restores desktop navigation and closes it on return", () => {
  const f = fixture(true);
  f.menu.open = true;
  f.changeWidth(false);
  assert.equal(f.menu.open, true);
  f.changeWidth(true);
  assert.equal(f.menu.open, false);
});

test("legacy media query listeners are supported", () => {
  const f = fixture(true, true);
  f.changeWidth(false);
  assert.equal(f.menu.open, true);
});

test("without matchMedia the default-open navigation remains usable", () => {
  const menu = { open: true };
  vm.runInNewContext(script, {
    document: { querySelector() { return menu; } },
    window: {}
  });
  assert.equal(menu.open, true);
});

test("markup keeps desktop navigation visible and caches the mobile controller", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(html.includes('<details class="mobile-navigation" open>'));
  assert.ok(html.includes('<nav class="side-nav" aria-label="Main navigation">'));
  assert.ok(html.includes('<script src="mobile-nav.js"></script>'));
  const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.ok(serviceWorker.includes("'mobile-nav.js'"), "mobile menu should work offline");
});

test("phone menu dismisses on outside tap without stealing focus", () => {
  const f = fixture(true);
  f.menu.open = true;
  f.dispatch("pointerdown", { target: {} });
  assert.equal(f.menu.open, false);
  assert.equal(f.focusCount, 0);
  f.menu.open = true;
  f.dispatch("pointerdown", { target: f.links[1] });
  assert.equal(f.menu.open, true, "tapping inside must not dismiss early");
});

test("escape closes the phone menu and restores focus without scrolling", () => {
  const f = fixture(true);
  f.menu.open = true;
  f.dispatch("keydown", { key: "Escape" });
  assert.equal(f.menu.open, false);
  assert.equal(f.focusCount, 1);
  f.menu.open = true;
  f.dispatch("keydown", { key: "Enter" });
  assert.equal(f.menu.open, true);
});

test("outside taps do not collapse desktop navigation", () => {
  const f = fixture(false);
  f.dispatch("pointerdown", { target: {} });
  f.dispatch("keydown", { key: "Escape" });
  assert.equal(f.menu.open, true);
  assert.equal(f.focusCount, 0);
});

test("mobile header remains a single row with an overlay menu", () => {
  const css = fs.readFileSync(path.join(root, "responsive.css"), "utf8");
  assert.match(css, /\.app-shell \.sidebar\s*\{\s*display: flex !important;\s*flex-direction: row !important;/);
  assert.match(css, /\.mobile-navigation\[open\] \.side-nav\s*\{\s*position: absolute;/);
});
