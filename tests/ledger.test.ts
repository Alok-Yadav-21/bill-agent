import { test } from "node:test";
import assert from "node:assert/strict";
import { toMinorUnits, formatMoney } from "../src/lib/money.ts";
import {
  summariseLedger, ledgerByMember, ledgerByCategory, householdEffectMinor,
  canAffordFromBalance, type LedgerEntry,
} from "../src/lib/ledger.ts";

const e = (p: Partial<LedgerEntry> & { type: LedgerEntry["type"]; amountMinor: number }): LedgerEntry => ({
  isCredit: true, status: "CONFIRMED", userId: "u1", counterpartyUserId: null,
  categoryId: null, occurredAt: new Date("2026-08-14"), ...p,
});

test("available balance = money in - money out", () => {
  const entries = [
    e({ type: "CONTRIBUTION", amountMinor: toMinorUnits("500"), userId: "alok" }),
    e({ type: "CONTRIBUTION", amountMinor: toMinorUnits("300"), userId: "rahul" }),
    e({ type: "EXPENSE", amountMinor: toMinorUnits("80"), userId: "alok" }),
    e({ type: "EXPENSE", amountMinor: toMinorUnits("35"), userId: "rahul" }),
  ];
  const s = summariseLedger(entries);
  assert.equal(formatMoney(s.totalContributionsMinor), "£800.00");
  assert.equal(formatMoney(s.totalExpensesMinor), "£115.00");
  assert.equal(formatMoney(s.availableBalanceMinor), "£685.00");
});

test("REFUND adds back, ADJUSTMENT respects isCredit", () => {
  const entries = [
    e({ type: "CONTRIBUTION", amountMinor: toMinorUnits("100") }),
    e({ type: "EXPENSE", amountMinor: toMinorUnits("40") }),
    e({ type: "REFUND", amountMinor: toMinorUnits("10") }),
    e({ type: "ADJUSTMENT", amountMinor: toMinorUnits("5"), isCredit: false }), // -5
  ];
  assert.equal(summariseLedger(entries).availableBalanceMinor, toMinorUnits("65"));
});

test("PENDING and VOID never affect the balance", () => {
  const entries = [
    e({ type: "CONTRIBUTION", amountMinor: toMinorUnits("100") }),
    e({ type: "EXPENSE", amountMinor: toMinorUnits("999"), status: "PENDING" }),
    e({ type: "EXPENSE", amountMinor: toMinorUnits("999"), status: "VOID" }),
  ];
  assert.equal(summariseLedger(entries).availableBalanceMinor, toMinorUnits("100"));
});

test("TRANSFER is net-zero to household but moves member standing", () => {
  const entries = [
    e({ type: "CONTRIBUTION", amountMinor: toMinorUnits("200"), userId: "alok" }),
    e({ type: "TRANSFER", amountMinor: toMinorUnits("50"), userId: "alok", counterpartyUserId: "rahul" }),
  ];
  assert.equal(summariseLedger(entries).availableBalanceMinor, toMinorUnits("200")); // unchanged
  const members = ledgerByMember(entries);
  const alok = members.find((m) => m.userId === "alok")!;
  const rahul = members.find((m) => m.userId === "rahul")!;
  assert.equal(alok.spentMinor, toMinorUnits("50"));
  assert.equal(rahul.contributedMinor, toMinorUnits("50"));
});

test("member standing: contributed - spent = net", () => {
  const entries = [
    e({ type: "CONTRIBUTION", amountMinor: toMinorUnits("300"), userId: "alok" }),
    e({ type: "EXPENSE", amountMinor: toMinorUnits("120"), userId: "alok" }),
  ];
  const alok = ledgerByMember(entries)[0];
  assert.equal(alok.contributedMinor, toMinorUnits("300"));
  assert.equal(alok.spentMinor, toMinorUnits("120"));
  assert.equal(alok.netMinor, toMinorUnits("180"));
});

test("category breakdown counts only expenses", () => {
  const entries = [
    e({ type: "EXPENSE", amountMinor: toMinorUnits("60"), categoryId: "food" }),
    e({ type: "EXPENSE", amountMinor: toMinorUnits("40"), categoryId: "food" }),
    e({ type: "CONTRIBUTION", amountMinor: toMinorUnits("500"), categoryId: "food" }), // ignored
  ];
  const cats = ledgerByCategory(entries);
  assert.equal(cats[0].categoryId, "food");
  assert.equal(cats[0].spentMinor, toMinorUnits("100"));
  assert.equal(cats[0].transactionCount, 2);
});

test("affordability is based on available balance", () => {
  assert.equal(canAffordFromBalance(toMinorUnits("100"), toMinorUnits("120")).affordable, false);
  assert.equal(canAffordFromBalance(toMinorUnits("100"), toMinorUnits("120")).shortfallMinor, toMinorUnits("20"));
  assert.equal(canAffordFromBalance(toMinorUnits("100"), toMinorUnits("50")).affordable, true);
});

test("household effect signs are correct per type", () => {
  assert.equal(householdEffectMinor(e({ type: "CONTRIBUTION", amountMinor: 100 })), 100);
  assert.equal(householdEffectMinor(e({ type: "EXPENSE", amountMinor: 100 })), -100);
  assert.equal(householdEffectMinor(e({ type: "TRANSFER", amountMinor: 100 })), 0);
});
