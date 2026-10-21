/*
   Orchard Lane Provisions — store engine (demo site).
   Cart, catalogue rendering helpers, checkout pricing and the injected
   site chrome (announcement bar, header, footer, cart drawer, toasts).
   Pure vanilla JS with no dependencies; the cart lives in localStorage
   so it survives reloads. All prices are fictional demo prices in CAD,
   and no real payment is ever collected anywhere on this site.
*/
"use strict";

const Store = (() => {
  /* ---------- constants ---------- */
  const KEY_CART = "olp_cart";
  const KEY_PROMO = "olp_promo";
  const KEY_ORDERS = "olp_orders";
  const KEY_LAST = "olp_last_order";

  const PROMOS = {
    NIAGARA10: { type: "pct", value: 10, label: "10% off your order" },
    FREESHIP: { type: "ship", label: "Free delivery" },
  };
  const TAX_RATE = 0.13; // Ontario HST
  const SHIP_FEE = 7.95; // flat delivery across Niagara
  const FREE_SHIP_AT = 60; // free delivery threshold

  /* ---------- small helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmt = (n) => "$" + n.toFixed(2);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const find = (id) => PRODUCTS.find((p) => p.id === id);
  const catName = (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || id;

  /* ---------- product art: flat SVG, generated per product ---------- */
  const ART = {
    jar: (a, b) =>
      '<rect x="70" y="34" width="60" height="14" rx="5" fill="' + b + '"/>' +
      '<rect x="60" y="48" width="80" height="112" rx="18" fill="' + a + '"/>' +
      '<rect x="70" y="92" width="60" height="46" rx="6" fill="' + b + '"/>' +
      '<rect x="70" y="58" width="9" height="86" rx="4.5" fill="#fff" opacity="0.22"/>',
    bottle: (a, b) =>
      '<rect x="86" y="28" width="28" height="13" rx="4" fill="' + b + '"/>' +
      '<rect x="91" y="41" width="18" height="21" fill="' + a + '"/>' +
      '<rect x="68" y="60" width="64" height="100" rx="20" fill="' + a + '"/>' +
      '<rect x="68" y="98" width="64" height="36" rx="4" fill="' + b + '"/>' +
      '<rect x="74" y="68" width="8" height="76" rx="4" fill="#fff" opacity="0.2"/>',
    bag: (a, b) =>
      '<rect x="58" y="42" width="84" height="17" rx="5" fill="' + b + '"/>' +
      '<path d="M63 59h74l7 88a10 10 0 0 1-10 11H66a10 10 0 0 1-10-11z" fill="' + a + '"/>' +
      '<circle cx="100" cy="107" r="25" fill="' + b + '"/>' +
      '<circle cx="100" cy="107" r="14" fill="#fff" opacity="0.25"/>',
    box: (a, b) =>
      '<rect x="52" y="56" width="96" height="20" rx="6" fill="' + b + '"/>' +
      '<rect x="62" y="76" width="76" height="80" rx="6" fill="' + a + '"/>' +
      '<rect x="92" y="56" width="16" height="100" fill="#FAF6EF" opacity="0.85"/>' +
      '<rect x="94" y="58" width="12" height="12" rx="3" fill="' + b + '"/>',
    loaf: (a, b) =>
      '<rect x="46" y="90" width="108" height="56" rx="28" fill="' + a + '"/>' +
      '<path d="M74 94q11 24 0 48" stroke="' + b + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M100 92q11 26 0 52" stroke="' + b + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M126 94q11 24 0 48" stroke="' + b + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>',
    bouquet: (a, b) =>
      '<path d="M64 150h72l-36-42z" fill="' + b + '"/>' +
      '<path d="M70 156h60l-8 12H78z" fill="' + b + '" opacity="0.75"/>' +
      '<circle cx="72" cy="86" r="17" fill="' + a + '"/>' +
      '<circle cx="128" cy="86" r="17" fill="' + a + '"/>' +
      '<circle cx="100" cy="64" r="19" fill="' + a + '"/>' +
      '<circle cx="86" cy="58" r="11" fill="' + a + '" opacity="0.75"/>' +
      '<circle cx="114" cy="58" r="11" fill="' + a + '" opacity="0.75"/>' +
      '<circle cx="72" cy="86" r="5.5" fill="#FAF6EF" opacity="0.9"/>' +
      '<circle cx="128" cy="86" r="5.5" fill="#FAF6EF" opacity="0.9"/>' +
      '<circle cx="100" cy="64" r="6" fill="#FAF6EF" opacity="0.9"/>',
  };

  function art(p, cls = "") {
    const { shape, bg, a, b } = p.art;
    return (
      '<svg viewBox="0 0 200 200" class="' + cls + '" role="img" aria-label="' + esc(p.name) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="200" height="200" fill="' + bg + '"/>' + ART[shape](a, b) + "</svg>"
    );
  }

  /* ---------- rating stars ---------- */
  function stars(p) {
    const full = Math.round(p.rating);
    let s = "";
    for (let i = 1; i <= 5; i++) {
      s +=
        '<svg class="h-3.5 w-3.5 ' + (i <= full ? "text-honey" : "text-line") +
        '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.63 1.13 6.57L12 17.4l-5.88 3.1 1.13-6.57L2.5 9.3l6.6-1.04L12 2z"/></svg>';
    }
    return '<span class="inline-flex items-center gap-0.5" aria-label="Rated ' + p.rating + ' out of 5">' + s + "</span>";
  }

  /* ---------- cart (persisted in localStorage) ---------- */
  const readCart = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY_CART));
      return Array.isArray(v) ? v.filter((l) => find(l.id)) : [];
    } catch {
      return [];
    }
  };
  const writeCart = (c) => localStorage.setItem(KEY_CART, JSON.stringify(c));

  function add(id, v = 0, q = 1) {
    const cart = readCart();
    const line = cart.find((l) => l.id === id && l.v === v);
    if (line) line.q = Math.min(line.q + q, 99);
    else cart.push({ id, v, q });
    writeCart(cart);
    return cart;
  }
  function setQty(i, q) {
    const cart = readCart();
    if (!cart[i]) return;
    cart[i].q = Math.max(1, Math.min(99, q));
    writeCart(cart);
  }
  function removeLine(i) {
    const cart = readCart();
    cart.splice(i, 1);
    writeCart(cart);
  }
  function clearCart() {
    localStorage.removeItem(KEY_CART);
  }

  function lines() {
    return readCart().map((l, i) => {
      const p = find(l.id);
      const variant = p.variants ? p.variants[l.v] || p.variants[0] : null;
      const unit = p.price + (variant ? variant.d : 0);
      return { i, v: l.v, p, variant, q: l.q, unit, total: unit * l.q };
    });
  }
  const count = () => lines().reduce((n, l) => n + l.q, 0);
  const subtotal = () => lines().reduce((n, l) => n + l.total, 0);

  /* ---------- pricing: promos, HST, delivery ---------- */
  const getPromo = () => localStorage.getItem(KEY_PROMO) || "";
  const setPromo = (code) => localStorage.setItem(KEY_PROMO, code);

  function totals(mode = "delivery") {
    const sub = subtotal();
    const promo = PROMOS[getPromo().toUpperCase()] || null;
    const discount = promo && promo.type === "pct" ? (sub * promo.value) / 100 : 0;
    const goods = sub - discount;
    let shipping = 0;
    if (mode !== "pickup") {
      shipping = goods >= FREE_SHIP_AT || (promo && promo.type === "ship") ? 0 : SHIP_FEE;
    }
    const tax = goods * TAX_RATE;
    return { sub, promo, discount, goods, shipping, tax, total: goods + tax + shipping };
  }

  /* ---------- orders ---------- */
  function placeOrder(order) {
    order.no = "OL-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
    order.ts = Date.now();
    order.items = lines().map((l) => ({
      id: l.p.id,
      name: l.p.name,
      variant: l.variant ? l.variant.name : "",
      q: l.q,
      unit: l.unit,
    }));
    const t = totals(order.mode || "delivery");
    order.totals = { sub: t.sub, discount: t.discount, shipping: t.shipping, tax: t.tax, total: t.total };
    const all = JSON.parse(localStorage.getItem(KEY_ORDERS) || "[]");
    all.push(order);
    localStorage.setItem(KEY_ORDERS, JSON.stringify(all));
    localStorage.setItem(KEY_LAST, JSON.stringify(order));
    clearCart();
    localStorage.removeItem(KEY_PROMO);
    return order;
  }
  const lastOrder = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY_LAST)) || null;
    } catch {
      return null;
    }
  };
  function findOrder(no) {
    const clean = String(no || "").trim().toUpperCase();
    // A always-working demo number so the tracking page is explorable.
    if (clean === "OL-2026-0001") {
      return { demo: true, no: clean, name: "A demo order", ts: Date.now() - 1000 * 60 * 90, count: 3, total: 47.19 };
    }
    try {
      const all = JSON.parse(localStorage.getItem(KEY_ORDERS) || "[]");
      return all.find((o) => o.no === clean) || null;
    } catch {
      return null;
    }
  }

  /* ---------- injected site chrome ---------- */
  const NAV = [
    ["shop.html", "Shop"],
    ["about.html", "Our story"],
    ["track.html", "Track order"],
    ["contact.html", "Contact"],
  ];

  const MARK =
    '<svg class="h-9 w-9 shrink-0" viewBox="0 0 64 64" aria-hidden="true">' +
    '<rect width="64" height="64" rx="14" fill="#2C4A34"/>' +
    '<path d="M32 13c2.4 6.6 9 9.2 9 16.4a9 9 0 1 1-18 0C23 22.2 29.6 19.6 32 13z" fill="#C6813F"/>' +
    '<path d="M32 15c-2-3.5-6-4.5-9-4 1.5 3.5 5 4.8 9 4z" fill="#8FAE6B"/></svg>';

  const CART_ICON =
    '<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 8h16l-1.5 11a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8L4 8z"/><path d="M8.5 8 12 3l3.5 5"/>' +
    '<path d="M9.5 12.5v4M14.5 12.5v4"/></svg>';

  const X_ICON =
    '<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  const CHECK_ICON =
    '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

  function headerHTML(page) {
    const links = NAV.map(function (n) {
      const active = page === n[0];
      return '<a href="' + n[0] + '" class="text-sm font-medium ' +
        (active ? "text-forest" : "text-muted transition hover:text-forest") + '">' + n[1] + "</a>";
    }).join("");
    const mobile = NAV.map(function (n) {
      return '<a href="' + n[0] + '" class="rounded-sm px-2 py-3 text-base font-medium text-ink hover:text-forest">' + n[1] + "</a>";
    }).join("");
    return (
      '<div class="bg-forest px-4 py-2 text-center text-xs font-medium tracking-wide text-cream/90">' +
      "Free delivery on orders over $60 &nbsp;&middot;&nbsp; Next-day across Niagara &nbsp;&middot;&nbsp; Pickup at the farm stand" +
      "</div>" +
      '<header id="site-header" class="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">' +
      '<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">' +
      '<a href="index.html" class="flex items-center gap-2.5" aria-label="Orchard Lane Provisions — home">' +
      MARK +
      '<span class="leading-tight"><span class="block font-display text-lg font-semibold text-ink">Orchard Lane</span>' +
      '<span class="block text-[0.65rem] uppercase tracking-[0.18em] text-muted">Provisions</span></span>' +
      "</a>" +
      '<nav class="hidden items-center gap-7 md:flex" aria-label="Primary">' + links + "</nav>" +
      '<div class="flex items-center gap-1.5">' +
      '<button type="button" data-cart-open class="relative inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink transition hover:text-forest" aria-label="Open your basket">' +
      CART_ICON +
      '<span data-cart-badge class="absolute -right-0.5 -top-0.5 hidden min-w-[1.25rem] rounded-full bg-honey px-1 text-center text-[0.65rem] font-bold leading-5 text-white"></span>' +
      "</button>" +
      '<button id="menu-toggle" type="button" class="inline-flex h-10 w-10 items-center justify-center rounded-sm text-ink hover:text-forest md:hidden" aria-controls="mobile-menu" aria-expanded="false" aria-label="Toggle menu">' +
      '<svg id="icon-open" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
      '<svg id="icon-close" class="hidden h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div id="mobile-menu" class="hidden border-t border-line bg-cream md:hidden">' +
      '<nav class="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4" aria-label="Mobile">' + mobile + "</nav>" +
      "</div>" +
      "</header>"
    );
  }

  function drawerHTML() {
    return (
      '<div id="cart-overlay" data-cart-close class="fixed inset-0 z-50 hidden bg-ink/40" aria-hidden="true"></div>' +
      '<aside id="cart-drawer" class="fixed right-0 top-0 z-[55] flex h-full w-full max-w-sm translate-x-full flex-col bg-cream shadow-2xl transition-transform duration-300" role="dialog" aria-modal="true" aria-label="Your basket">' +
      '<div class="flex items-center justify-between border-b border-line px-5 py-4">' +
      '<h2 class="font-display text-lg font-semibold text-ink">Your basket <span id="drawer-count" class="text-sm font-normal text-muted"></span></h2>' +
      '<button type="button" data-cart-close class="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted transition hover:text-ink" aria-label="Close basket">' + X_ICON + "</button>" +
      "</div>" +
      '<div id="drawer-lines" class="flex-1 overflow-y-auto px-5 py-4"></div>' +
      '<div id="drawer-foot" class="border-t border-line bg-white px-5 py-4"></div>' +
      "</aside>"
    );
  }

  function toastHTML() {
    return '<div id="toast" class="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 translate-y-24 rounded-md bg-ink px-4 py-3 text-sm font-medium text-cream shadow-xl transition-transform duration-300" role="status" aria-live="polite"></div>';
  }

  /* ---------- basket drawer rendering ---------- */
  function qtyCtl(l) {
    return (
      '<div class="inline-flex items-center rounded-sm border border-line bg-white">' +
      '<button type="button" data-dec="' + l.i + '" class="h-8 w-8 text-lg leading-none text-muted transition hover:text-ink" aria-label="Decrease quantity">&minus;</button>' +
      '<span class="w-8 text-center text-sm font-medium text-ink">' + l.q + "</span>" +
      '<button type="button" data-inc="' + l.i + '" class="h-8 w-8 text-lg leading-none text-muted transition hover:text-ink" aria-label="Increase quantity">+</button>' +
      "</div>"
    );
  }

  function renderDrawer() {
    const box = $("#drawer-lines");
    if (!box) return;
    const foot = $("#drawer-foot");
    const ls = lines();
    const n = count();
    const cEl = $("#drawer-count");
    if (cEl) cEl.textContent = n ? "(" + n + " item" + (n === 1 ? "" : "s") + ")" : "";

    if (!ls.length) {
      box.innerHTML =
        '<div class="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">' +
        '<span class="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-muted">' + CART_ICON + "</span>" +
        '<p class="font-display text-lg font-semibold text-ink">Your basket is empty</p>' +
        '<p class="max-w-[16rem] text-sm leading-relaxed text-muted">The market is open — jams, bread, honey and everything else is one tap away.</p>' +
        '<a href="shop.html" data-cart-close class="mt-2 rounded-sm bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-dark">Browse the market</a>' +
        "</div>";
      foot.innerHTML = "";
      return;
    }

    box.innerHTML = ls
      .map(function (l) {
        return (
          '<div class="flex gap-3.5 border-b border-line py-3.5 last:border-0">' +
          '<a href="product.html?id=' + l.p.id + '" data-cart-close class="h-16 w-16 shrink-0 overflow-hidden rounded-sm">' + art(l.p) + "</a>" +
          '<div class="min-w-0 flex-1">' +
          '<p class="truncate font-display text-sm font-semibold text-ink">' + esc(l.p.name) + "</p>" +
          (l.variant ? '<p class="mt-0.5 text-xs text-muted">' + esc(l.variant.name) + "</p>" : "") +
          '<div class="mt-2 flex items-center justify-between gap-2">' +
          qtyCtl(l) +
          '<p class="font-display text-sm font-semibold text-ink">' + fmt(l.total) + "</p>" +
          "</div>" +
          '<button type="button" data-rm="' + l.i + '" class="mt-1.5 text-xs text-muted underline-offset-2 transition hover:text-berry hover:underline">Remove</button>' +
          "</div></div>"
        );
      })
      .join("");

    const t = totals();
    let html = "";
    if (t.sub > 0 && t.sub < FREE_SHIP_AT) {
      const pct = Math.min(100, Math.round((t.sub / FREE_SHIP_AT) * 100));
      html +=
        '<p class="text-xs text-muted">Add <strong class="text-ink">' + fmt(FREE_SHIP_AT - t.sub) + "</strong> more for free delivery</p>" +
        '<div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-honey" style="width:' + pct + '%"></div></div>';
    } else if (t.sub >= FREE_SHIP_AT) {
      html += '<p class="flex items-center gap-1.5 text-xs font-medium text-forest">' + CHECK_ICON + "Free delivery unlocked</p>";
    }
    if (t.promo) {
      html += '<p class="mt-1.5 text-xs text-forest">Code <strong>' + esc(getPromo().toUpperCase()) + "</strong> applied &mdash; " + t.promo.label + "</p>";
    }
    html +=
      '<div class="mt-3 flex items-baseline justify-between"><span class="text-sm text-muted">Subtotal</span>' +
      '<span class="font-display text-xl font-bold text-ink">' + fmt(t.sub) + "</span></div>" +
      '<p class="mt-1 text-xs text-muted">HST and delivery are calculated at checkout</p>' +
      '<div class="mt-3 grid grid-cols-2 gap-2">' +
      '<a href="cart.html" data-cart-close class="rounded-sm border border-forest px-4 py-2.5 text-center text-sm font-semibold text-forest transition hover:bg-forest hover:text-cream">View basket</a>' +
      '<a href="checkout.html" data-cart-close class="rounded-sm bg-forest px-4 py-2.5 text-center text-sm font-semibold text-cream transition hover:bg-forest-dark">Checkout</a>' +
      "</div>";
    foot.innerHTML = html;
  }

  /* ---------- shared product card (shop, index, related rows) ---------- */
  function card(p) {
    return (
      '<article class="group flex flex-col overflow-hidden rounded-md border border-line bg-white transition duration-300 hover:-translate-y-1 hover:shadow-lg">' +
      '<a href="product.html?id=' + p.id + '" class="relative block aspect-square overflow-hidden">' +
      (p.badge
        ? '<span class="absolute left-3 top-3 z-10 rounded-full bg-forest px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-cream">' + esc(p.badge) + "</span>"
        : "") +
      (p.stock <= 15
        ? '<span class="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[0.65rem] font-semibold text-berry">Only ' + p.stock + " left</span>"
        : "") +
      art(p, "h-full w-full") +
      "</a>" +
      '<div class="flex flex-1 flex-col p-4">' +
      '<p class="text-xs uppercase tracking-[0.14em] text-muted">' + catName(p.cat) + "</p>" +
      '<h3 class="mt-1.5 font-display text-base font-semibold leading-snug text-ink"><a href="product.html?id=' + p.id + '" class="transition hover:text-forest">' + esc(p.name) + "</a></h3>" +
      '<div class="mt-1.5 flex items-center gap-1.5 text-xs text-muted">' + stars(p) + "<span>(" + p.reviews + ")</span></div>" +
      '<div class="mt-3 flex items-center justify-between gap-2 pt-1">' +
      '<p class="font-display text-lg font-bold text-ink">' + fmt(p.price) + "</p>" +
      '<button type="button" data-add="' + p.id + '" class="rounded-sm bg-forest px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-forest-dark">Add to basket</button>' +
      "</div></div></article>"
    );
  }

  /* ---------- footer (with the demo-honesty note) ---------- */
  function footerHTML() {
    const cats = CATEGORIES.map(function (c) {
      return '<li><a href="shop.html?cat=' + c.id + '" class="text-sm text-muted transition hover:text-forest">' + c.name + "</a></li>";
    }).join("");
    return (
      '<footer class="mt-16 border-t border-line bg-white">' +
      '<div class="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">' +
      '<div class="md:col-span-2">' +
      '<a href="index.html" class="flex items-center gap-2.5" aria-label="Orchard Lane Provisions — home">' + MARK +
      '<span class="leading-tight"><span class="block font-display text-lg font-semibold text-ink">Orchard Lane</span>' +
      '<span class="block text-[0.65rem] uppercase tracking-[0.18em] text-muted">Provisions</span></span></a>' +
      '<p class="mt-4 max-w-sm text-sm leading-relaxed text-muted">Jams, honey, bread, cider and flowers from a made-up farm on the Niagara Escarpment — ordered by lunch, on your step the next morning.</p>' +
      "</div>" +
      '<div><h3 class="font-display text-xs font-semibold uppercase tracking-[0.16em] text-ink">Shop</h3><ul class="mt-4 space-y-2.5">' + cats + "</ul></div>" +
      '<div><h3 class="font-display text-xs font-semibold uppercase tracking-[0.16em] text-ink">Company</h3><ul class="mt-4 space-y-2.5">' +
      '<li><a href="about.html" class="text-sm text-muted transition hover:text-forest">Our story</a></li>' +
      '<li><a href="track.html" class="text-sm text-muted transition hover:text-forest">Track an order</a></li>' +
      '<li><a href="contact.html" class="text-sm text-muted transition hover:text-forest">Contact</a></li>' +
      '<li><a href="shop.html" class="text-sm text-muted transition hover:text-forest">The whole market</a></li>' +
      "</ul></div>" +
      "</div>" +
      '<div class="border-t border-line">' +
      '<div class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">' +
      "<p>&copy; 2026 Orchard Lane Provisions. A demo online store &mdash; every product, price, rating and review on it is fictional.</p>" +
      '<p>Portfolio sample by <a href="https://github.com/Artur25072001" target="_blank" rel="noopener" class="font-medium text-forest underline-offset-2 hover:underline">Artur Dymchevskyi</a> &middot; no real payments are collected</p>' +
      "</div></div></footer>"
    );
  }

  /* ---------- toasts ---------- */
  let toastTimer = null;
  function showToast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("translate-y-24");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.add("translate-y-24");
    }, 2600);
  }

  /* ---------- drawer open/close ---------- */
  function openDrawer() {
    const d = $("#cart-drawer");
    const o = $("#cart-overlay");
    if (!d) return;
    d.classList.remove("translate-x-full");
    if (o) o.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    const d = $("#cart-drawer");
    const o = $("#cart-overlay");
    if (!d) return;
    d.classList.add("translate-x-full");
    if (o) o.classList.add("hidden");
    document.body.style.overflow = "";
  }

  /* ---------- refresh every badge + the drawer ---------- */
  function refresh() {
    renderDrawer();
    $$("[data-cart-badge]").forEach(function (b) {
      const n = count();
      b.textContent = n;
      b.classList.toggle("hidden", n === 0);
    });
  }

  /* ---------- event wiring (delegated, one listener for the site) ---------- */
  function wireChrome() {
    const menuBtn = $("#menu-toggle");
    const menu = $("#mobile-menu");
    if (menuBtn && menu) {
      menuBtn.addEventListener("click", function () {
        const closed = menu.classList.toggle("hidden");
        menuBtn.setAttribute("aria-expanded", String(!closed));
        const icOpen = $("#icon-open");
        const icClose = $("#icon-close");
        if (icOpen) icOpen.classList.toggle("hidden", !closed);
        if (icClose) icClose.classList.toggle("hidden", closed);
      });
    }

    document.addEventListener("click", function (e) {
      const t = e.target.closest("[data-cart-open],[data-cart-close],[data-add],[data-inc],[data-dec],[data-rm]");
      if (!t) return;

      if (t.hasAttribute("data-cart-open")) {
        e.preventDefault();
        openDrawer();
      } else if (t.hasAttribute("data-cart-close")) {
        closeDrawer(); // links keep navigating; overlays just close
      } else if (t.hasAttribute("data-add")) {
        const id = t.getAttribute("data-add");
        const v = parseInt(t.getAttribute("data-variant") || "0", 10) || 0;
        const q = parseInt(t.getAttribute("data-qty") || "1", 10) || 1;
        add(id, v, q);
        refresh();
        const p = find(id);
        if (p) showToast("Added to your basket — " + p.name);
        openDrawer();
      } else if (t.hasAttribute("data-inc")) {
        const i = parseInt(t.getAttribute("data-inc"), 10);
        const cart = readCart();
        if (cart[i]) {
          setQty(i, cart[i].q + 1);
          refresh();
        }
      } else if (t.hasAttribute("data-dec")) {
        const i = parseInt(t.getAttribute("data-dec"), 10);
        const cart = readCart();
        if (cart[i]) {
          setQty(i, cart[i].q - 1);
          refresh();
        }
      } else if (t.hasAttribute("data-rm")) {
        removeLine(parseInt(t.getAttribute("data-rm"), 10));
        refresh();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });
  }

  /* ---------- boot: inject the chrome around whatever the page rendered ---------- */
  let booted = false;
  function init() {
    if (booted) return;
    booted = true;
    const page = document.body.dataset.page || "index.html";
    document.body.insertAdjacentHTML("afterbegin", headerHTML(page));
    document.body.insertAdjacentHTML("beforeend", drawerHTML() + footerHTML() + toastHTML());
    wireChrome();
    refresh();
  }
  document.addEventListener("DOMContentLoaded", init);

  /* ---------- public API ---------- */
  return {
    // catalogue helpers
    PRODUCTS, CATEGORIES, find, catName, art, stars, card, fmt, esc, $, $$,
    // cart
    lines, count, subtotal, add, setQty, removeLine, clearCart,
    // pricing
    totals, getPromo, setPromo, PROMOS, TAX_RATE, SHIP_FEE, FREE_SHIP_AT,
    // orders
    placeOrder, lastOrder, findOrder,
    // ui
    refresh, showToast, openDrawer, closeDrawer,
  };
})();




