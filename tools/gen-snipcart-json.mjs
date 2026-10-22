#!/usr/bin/env node
/*
   Orchard Lane Provisions — Snipcart catalogue generator.

   Reads products.js (the single source of truth) and writes products.json,
   the document Snipcart's crawler fetches at payment time to validate every
   cart line (id, price, custom fields, stock). Because the JSON is served
   from the server and generated from the same catalogue the storefront
   renders from, the advertised price and the charged price can never drift
   apart — and nothing a browser tampers with can change what gets charged.

   Run it after any change to products.js and commit the result together:

       node tools/gen-snipcart-json.mjs

   Variant products are flattened exactly the way cart.html hands them to
   Snipcart: one entry per variant, id "<product id>-v<index>", price = base
   price + variant delta, and the same "Choice" custom field.
*/
"use strict";

import { readFileSync, writeFileSync } from "node:fs";

/* products.js is a plain browser script with no exports, so evaluate it in a
   function scope and pull the PRODUCTS array out. */
const source = readFileSync(new URL("../products.js", import.meta.url), "utf8");
const module_ = { exports: {} };
new Function("module", "exports", source + "\nmodule.exports = { PRODUCTS };")(
  module_,
  module_.exports
);
const PRODUCTS = module_.exports.PRODUCTS;

if (!Array.isArray(PRODUCTS) || PRODUCTS.length === 0) {
  console.error("No PRODUCTS found in products.js — nothing written.");
  process.exit(1);
}

const entries = [];

for (const p of PRODUCTS) {
  if (Array.isArray(p.variants)) {
    p.variants.forEach((v, i) => {
      entries.push({
        id: p.id + "-v" + i,
        name: p.name,
        price: Number((p.price + v.d).toFixed(2)),
        url: "/product.html?id=" + p.id,
        stock: p.stock,
        customFields: [{ name: "Choice", type: "textbox" }],
      });
    });
  } else {
    entries.push({
      id: p.id,
      name: p.name,
      price: Number(p.price.toFixed(2)),
      url: "/product.html?id=" + p.id,
      stock: p.stock,
    });
  }
}

const out = new URL("../products.json", import.meta.url);
writeFileSync(out, JSON.stringify(entries, null, 2) + "\n");

const variantExtras = entries.length - PRODUCTS.length;
console.log(
  "products.json written: " + entries.length + " entries (" +
  PRODUCTS.length + " products, " + variantExtras + " extra variant entries)."
);
