import { test } from "node:test";
import assert from "node:assert/strict";
import { toMinorUnits, formatMoney, sumMinor } from "../src/lib/money.ts";
import {
  summariseBudget,
  evaluateBudgetAlert,
  canAfford,
  spendByMember,
  type ExpenseLike,
} from "../src/lib/budget.ts";

const conf = (amountMinor: number, userId = "u1"): ExpenseLike => ({
  amountMinor,
  status: "CONFIRMED",
  userId,
  categoryId: null,
  purchaseDate: new Date("2026-08-14"),
});

test("money: £42.50 is stored as 4250 minor units", () => {
  assert.equal(toMinorUnits("42.50"), 4250);
  assert.equal(toMinorUnits(42.5), 4250);
  assert.equal(formatMoney(4250), "£42.50");
});

test("money: rounding avoids float drift", () => {
  // 0.1 + 0.2 in floats is 0.30000000000000004; minor units are exact.
  assert.equal(sumMinor([toMinorUnits("0.10"), toMinorUnits("0.20")]), 30);
});

test("money: rejects garbage input", () => {
  assert.throws(() => toMinorUnits("abc"));
  assert.throws(() => toMinorUnits(Infinity));
});

test("ACCEPTANCE: £5000 budget, spends of £80/£35/£120 -> remaining £4765", () => {
  const budget = toMinorUnits("5000"); // 500000
  const expenses = [
    conf(toMinorUnits("80")),
    conf(toMinorUnits("35")),
    conf(toMinorUnits("120")),
  ];
  const s = summariseBudget(budget, expenses);
  assert.equal(s.totalSpentMinor, 23500);
  assert.equal(s.remainingMinor, 476500);
  assert.equal(formatMoney(s.remainingMinor), "£4,765.00");
  assert.equal(formatMoney(s.totalSpentMinor), "£235.00");
  assert.equal(s.transactionCount, 3);
});

test("incremental spends reduce remaining correctly", () => {
  const budget = toMinorUnits("5000");
  assert.equal(summariseBudget(budget, [conf(toMinorUnits("100"))]).remainingMinor, 490000);
  assert.equal(
    summariseBudget(budget, [conf(toMinorUnits("100")), conf(toMinorUnits("50"))]).remainingMinor,
    485000,
  );
});

test("PENDING and CANCELLED expenses do not reduce remaining", () => {
  const budget = toMinorUnits("1000");
  const expenses: ExpenseLike[] = [
    conf(toMinorUnits("100")),
    { ...conf(toMinorUnits("999")), status: "PENDING" },
    { ...conf(toMinorUnits("999")), status: "CANCELLED" },
  ];
  const s = summariseBudget(budget, expenses);
  assert.equal(s.totalSpentMinor, 10000);
  assert.equal(s.remainingMinor, 90000);
  assert.equal(s.transactionCount, 1);
});

test("budget thresholds fire at 70/80/90/100", () => {
  assert.equal(evaluateBudgetAlert(69), null);
  assert.equal(evaluateBudgetAlert(70)?.threshold, 70);
  assert.equal(evaluateBudgetAlert(85)?.threshold, 80);
  assert.equal(evaluateBudgetAlert(95)?.threshold, 90);
  assert.equal(evaluateBudgetAlert(120)?.threshold, 100);
});

test("overspend is reported, not clamped", () => {
  const s = summariseBudget(toMinorUnits("100"), [conf(toMinorUnits("150"))]);
  assert.equal(s.remainingMinor, -5000);
  assert.equal(s.isOverBudget, true);
});

test("canAfford answers the affordability question", () => {
  const s = summariseBudget(toMinorUnits("5000"), [conf(toMinorUnits("4900"))]);
  assert.equal(canAfford(s, toMinorUnits("200")).affordable, false);
  assert.equal(canAfford(s, toMinorUnits("50")).affordable, true);
});

test("spendByMember ranks highest spender first", () => {
  const expenses = [
    conf(toMinorUnits("230"), "alok"),
    conf(toMinorUnits("185"), "rahul"),
    conf(toMinorUnits("120"), "priya"),
  ];
  const ranked = spendByMember(expenses);
  assert.equal(ranked[0].userId, "alok");
  assert.equal(ranked[0].totalMinor, 23000);
});
