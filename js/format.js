// 表示用フォーマッタ

export function formatNumber(n) {
  const v = Number.isFinite(n) ? n : 0;
  return Math.round(v).toLocaleString("ja-JP");
}

export function formatYen(n) {
  return `${formatNumber(n)}円`;
}

export const UNIT_LABEL = { min: "分", hour: "時間", yen: "円", count: "回" };
export const FREQ_LABEL = { day: "毎日", month: "毎月" };

export function describeAmount(amount, unit, frequency) {
  const freq = FREQ_LABEL[frequency] || "毎日";
  if (unit === "yen") return `${freq}${formatYen(amount)}`;
  return `${freq}${formatNumber(amount)}${UNIT_LABEL[unit] || ""}`;
}

// 基準単位(base)に応じて「合計」を1行の文言にする
export function totalLine(base, total, days) {
  if (base === "hour") {
    return `${formatNumber(total)}時間（約${formatNumber(days)}日）`;
  }
  if (base === "yen") return formatYen(total);
  if (base === "count") return `${formatNumber(total)}回`;
  return `${formatNumber(total)}`;
}

export function diffLabel(direction) {
  return direction === "increase" ? "増やせる" : "取り戻せる";
}

export function resourceNoun(base) {
  if (base === "hour") return "時間";
  if (base === "yen") return "お金";
  return "数";
}
