import { test } from "node:test";
import assert from "node:assert/strict";
import { AnthropicReceiptProcessor } from "../src/server/services/receipt/anthropic-processor.ts";

// Stub global fetch to return a Claude-style response wrapping receipt JSON.
function stubFetch(modelText: string) {
  return async () =>
    new Response(JSON.stringify({ content: [{ type: "text", text: modelText }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}

const input = {
  householdId: "h",
  uploadedBy: "u",
  imageRef: "data:image/jpeg;base64,QQ==",
  mimeType: "image/jpeg",
};

test("parses clean JSON and maps to minor units", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = stubFetch(
    JSON.stringify({
      merchant: "Tesco",
      date: "2026-08-14",
      currency: "GBP",
      total_minor: 1400,
      category: "Groceries",
      items: [{ name: "Milk", amount_minor: 200 }],
      confidence: { total: 0.98 },
      warnings: [],
    }),
  ) as typeof fetch;

  const p = new AnthropicReceiptProcessor("key", "model");
  const out = await p.process(input);
  globalThis.fetch = orig;

  assert.equal(out.merchant, "Tesco");
  assert.equal(out.totalMinor, 1400);
  assert.equal(out.items[0].amountMinor, 200);
  assert.equal(out.warnings.length, 0);
});

test("handles markdown-fenced JSON and low-confidence total", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = stubFetch(
    "```json\n" + JSON.stringify({ merchant: "Co-op", total_minor: 500, confidence: { total: 0.4 } }) + "\n```",
  ) as typeof fetch;

  const p = new AnthropicReceiptProcessor("key", "model");
  const out = await p.process(input);
  globalThis.fetch = orig;

  assert.equal(out.merchant, "Co-op");
  assert.equal(out.totalMinor, 500);
  assert.ok(out.warnings.some((w) => /confidently/.test(w)));
});

test("missing total produces a warning, never invents a number", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = stubFetch(JSON.stringify({ merchant: "Shop" })) as typeof fetch;

  const p = new AnthropicReceiptProcessor("key", "model");
  const out = await p.process(input);
  globalThis.fetch = orig;

  assert.equal(out.totalMinor, null);
  assert.ok(out.warnings.some((w) => /manually/.test(w)));
});
