const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "mobile-nav.js"), "utf8");

function fixture(isPhone, useLegacyMediaListener = false) {
  let focusCount = 0;
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
    document: { querySelector(selector) {
      assert.equal(selector, ".mobile-navigation");
      return menu;
    } },
    window: { matchMedia(query) {
      assert.equal(query, "(max-width: 700px)");
      return media;
    } }
  });
  return {
    menu, media, links,
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

test("markup defaults to visible desktop navigation and loads the menu controller", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(html.includes('<script src="mobile-nav.js"></script>'));
  assert.match(html, /<nav class="side-nav" aria-label="Main navigation">/);
  assert.match(html, /<script src="mobile-nav\\.js"><\\/script>/);
});
