// 計算ロジック(純粋関数のみ・AI不使用・DOM非依存)
// このファイルは Node でも import してテストできる。

export const DAYS_PER_YEAR = 365;
export const MONTHS_PER_YEAR = 12;
export const YEAR_OPTIONS = [1, 3, 5, 10];

export function occurrencesPerYear(frequency) {
  return frequency === "month" ? MONTHS_PER_YEAR : DAYS_PER_YEAR;
}

// 入力単位を「時間(hour) / 円(yen) / 回(count)」の基準単位に正規化する
export function normalizeAmount(amount, unit) {
  const n = Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  if (unit === "min") return { base: "hour", value: value / 60 };
  if (unit === "hour") return { base: "hour", value };
  if (unit === "yen") return { base: "yen", value };
  if (unit === "count") return { base: "count", value };
  throw new Error(`unknown unit: ${unit}`);
}

// 指定年数を継続した場合の累計値(基準単位)を返す。
// base が hour の場合のみ「日数換算」を付与する。
// 日数は切り捨て(Math.floor)で統一する
// = 「まるまる経過した日数」として一貫させるため。
export function totalForYears({ amount, unit, frequency }, years) {
  const { base, value } = normalizeAmount(amount, unit);
  const occurrences = occurrencesPerYear(frequency);
  const total = value * occurrences * years;
  const result = { base, total };
  if (base === "hour") {
    result.days = Math.floor(total / 24);
  }
  return result;
}

// 世界線A(現状維持)と世界線B(変えた場合)を比較する
export function compare(state, years) {
  const a = totalForYears(
    { amount: state.amountA, unit: state.unit, frequency: state.frequency },
    years
  );
  const b = totalForYears(
    { amount: state.amountB, unit: state.unit, frequency: state.frequency },
    years
  );
  const diffTotal = Math.abs(a.total - b.total);
  const result = { years, a, b, diffTotal, base: a.base };
  if (a.base === "hour") {
    result.diffDays = Math.floor(diffTotal / 24);
  }
  return result;
}
