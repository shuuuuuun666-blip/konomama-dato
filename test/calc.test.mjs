// 実行方法: node test/calc.test.mjs
// npm 依存なし。assert のみで検証する。
import assert from "node:assert/strict";
import { compare, totalForYears, normalizeAmount, occurrencesPerYear } from "../js/calc.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`OK  ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// --- 仕様書の検証例: 毎日2時間 -> 1時間, 3年 ---
test("spec example: 2h/day -> 1h/day for 3 years", () => {
  const state = { unit: "hour", frequency: "day", amountA: 2, amountB: 1 };
  const cmp = compare(state, 3);
  assert.equal(cmp.a.total, 2190, "世界線A合計時間");
  assert.equal(cmp.a.days, 91, "世界線A日数換算");
  assert.equal(cmp.b.total, 1095, "世界線B合計時間");
  assert.equal(cmp.b.days, 45, "世界線B日数換算");
  assert.equal(cmp.diffTotal, 1095, "差の合計時間");
  assert.equal(cmp.diffDays, 45, "差の日数換算");
});

test("normalizeAmount: 分は時間に変換される", () => {
  assert.deepEqual(normalizeAmount(90, "min"), { base: "hour", value: 1.5 });
});

test("occurrencesPerYear: 毎日=365, 毎月=12", () => {
  assert.equal(occurrencesPerYear("day"), 365);
  assert.equal(occurrencesPerYear("month"), 12);
});

test("お金カテゴリ: 毎日500円 x 3年", () => {
  const r = totalForYears({ amount: 500, unit: "yen", frequency: "day" }, 3);
  assert.equal(r.base, "yen");
  assert.equal(r.total, 547500);
  assert.equal(r.days, undefined, "円には日数換算を付けない");
});

test("お金カテゴリ: 毎月3000円サブスク x 1年", () => {
  const r = totalForYears({ amount: 3000, unit: "yen", frequency: "month" }, 1);
  assert.equal(r.total, 36000);
});

test("積み上げカテゴリ: 毎日30分勉強 x 3年 -> 増やす60分", () => {
  const state = { unit: "min", frequency: "day", amountA: 30, amountB: 60 };
  const cmp = compare(state, 3);
  assert.equal(cmp.a.total, 547.5);
  assert.equal(cmp.a.days, 22);
  assert.equal(cmp.b.total, 1095);
  assert.equal(cmp.b.days, 45);
  assert.equal(cmp.diffTotal, 547.5);
  assert.equal(cmp.diffDays, 22);
});

test("異常値: 0 は破綻しない", () => {
  const r = totalForYears({ amount: 0, unit: "hour", frequency: "day" }, 10);
  assert.equal(r.total, 0);
  assert.equal(r.days, 0);
});

test("異常値: 小数入力", () => {
  const r = totalForYears({ amount: 1.5, unit: "hour", frequency: "day" }, 1);
  assert.equal(r.total, 547.5);
  assert.equal(r.days, 22);
});

test("異常値: 巨大な数値でも壊れない", () => {
  const r = totalForYears({ amount: 999999, unit: "yen", frequency: "month" }, 10);
  assert.equal(r.total, 999999 * 12 * 10);
  assert.ok(Number.isFinite(r.total));
});

test("異常値: 空文字/未定義は0として扱う", () => {
  assert.equal(normalizeAmount("", "hour").value, 0);
  assert.equal(normalizeAmount(undefined, "yen").value, 0);
  assert.equal(normalizeAmount(NaN, "min").value, 0);
});

test("10年 x 回数(count) 単位", () => {
  const r = totalForYears({ amount: 2, unit: "count", frequency: "day" }, 10);
  assert.equal(r.base, "count");
  assert.equal(r.total, 2 * 365 * 10);
});

console.log(`\n${passed} passed`);
