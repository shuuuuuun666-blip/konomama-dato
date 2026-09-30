// 計測スタブ。
// 今は外部送信せず console + window.__events に記録するだけ。
// 将来、実サービス(Plausible / GA4 / Cloudflare Web Analytics 等)を
// 導入する際は、この track() の中身を差し替えるだけでよい。
// 個人情報は一切含めないこと(数値・カテゴリなど匿名の行動ログのみ)。

window.__events = window.__events || [];

export function track(eventName, payload) {
  const entry = { eventName, payload: payload || {}, ts: Date.now() };
  window.__events.push(entry);
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    console.log("[track]", eventName, payload || {});
  }
}
