import { compare, totalForYears, YEAR_OPTIONS } from "./calc.js";
import {
  formatNumber,
  formatYen,
  describeAmount,
  totalLine,
  diffLabel,
  resourceNoun,
  UNIT_LABEL,
  FREQ_LABEL,
} from "./format.js";
import { track } from "./analytics.js";

const CATEGORY_META = {
  time: {
    label: "時間",
    direction: "reduce",
    units: ["min", "hour"],
    placeholder: "スマホ",
    exampleLine: "例：毎日2時間スマホを見ている",
  },
  money: {
    label: "お金",
    direction: "reduce",
    units: ["yen"],
    placeholder: "コンビニ",
    exampleLine: "例：毎日500円コンビニで使う",
  },
  build: {
    label: "積み上げ",
    direction: "increase",
    units: ["min", "hour", "count", "yen"],
    placeholder: "勉強",
    exampleLine: "例：毎日30分勉強する",
  },
};

const STEP_DEFAULT = { min: 5, hour: 0.5, yen: 100, count: 1 };

const SCREEN_ORDER = ["home", "timeline", "resultA", "compareInput", "compareResult", "final"];

const appEl = document.getElementById("app");
const toastEl = document.getElementById("toast");

function defaultState() {
  return {
    screen: "home",
    category: "time",
    label: "",
    unit: "hour",
    frequency: "day",
    amountA: 2,
    amountB: null,
    years: 3,
    history: [],
  };
}

let state = defaultState();

function meta() {
  return CATEGORY_META[state.category];
}

function habitLabel() {
  return (state.label || "").trim() || meta().placeholder;
}

function goto(screen) {
  state.history.push(state.screen);
  state.screen = screen;
  if (screen === "resultA") track("result_reached", { category: state.category });
  if (screen === "compareResult") track("world_b_reached", { category: state.category });
  render();
  window.scrollTo(0, 0);
}

function goBack() {
  const prev = state.history.pop();
  if (prev) {
    state.screen = prev;
    render();
    window.scrollTo(0, 0);
  }
}

function resetAll() {
  track("restart");
  state = defaultState();
  render();
  window.scrollTo(0, 0);
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

// --- URL 経由の共有結果を復元する -----------------------------------
function tryLoadFromUrl() {
  const p = new URLSearchParams(window.location.search);
  if (!p.has("c") || !p.has("u") || !p.has("f") || !p.has("a") || !p.has("b")) return false;
  const category = p.get("c");
  if (!CATEGORY_META[category]) return false;
  state.category = category;
  state.unit = p.get("u");
  state.frequency = p.get("f") === "month" ? "month" : "day";
  state.amountA = Number(p.get("a")) || 0;
  state.amountB = Number(p.get("b")) || 0;
  state.years = YEAR_OPTIONS.includes(Number(p.get("y"))) ? Number(p.get("y")) : 3;
  state.label = decodeURIComponent(p.get("l") || "");
  state.screen = "compareResult";
  track("shared_link_opened", { category });
  return true;
}

function shareUrl() {
  const p = new URLSearchParams({
    c: state.category,
    u: state.unit,
    f: state.frequency,
    a: String(state.amountA),
    b: String(state.amountB),
    y: String(state.years),
  });
  if (state.label) p.set("l", state.label);
  return `${location.origin}${location.pathname}?${p.toString()}`;
}

function buildShareText(cmp) {
  const habit = habitLabel();
  const changeVerb = meta().direction === "increase" ? "ふやす" : "へらす";
  const line1 =
    meta().direction === "increase"
      ? `${describeAmount(state.amountA, state.unit, state.frequency)}${habit}を、${describeAmount(
          state.amountB,
          state.unit,
          state.frequency
        )}に${changeVerb}と`
      : `${describeAmount(state.amountA, state.unit, state.frequency)}${habit}を続けると、`;

  const aLine =
    meta().direction === "reduce"
      ? `${state.years}年間で${cmp.base === "hour" ? "約" + formatNumber(cmp.a.days) + "日" : totalLine(cmp.base, cmp.a.total)}。`
      : "";

  const diffText =
    cmp.base === "hour"
      ? `約${formatNumber(cmp.diffDays)}日`
      : totalLine(cmp.base, cmp.diffTotal);

  const tail =
    meta().direction === "increase"
      ? `${state.years}年間で${diffText}多く積み上がるらしい。`
      : `${describeAmount(state.amountB, state.unit, state.frequency)}に${changeVerb}だけで、${diffText}${diffLabel(
          meta().direction
        )}らしい。`;

  return `${line1}${aLine}\n\n${tail}\n\n#このままだと\n${shareUrl()}`;
}

// --- レンダリング ------------------------------------------------------

function render() {
  renderScreen();
  bind("[data-action='back']", "click", goBack);
}

function renderScreen() {
  switch (state.screen) {
    case "home":
      renderHome();
      break;
    case "timeline":
      renderTimeline();
      break;
    case "resultA":
      renderResultA();
      break;
    case "compareInput":
      renderCompareInput();
      break;
    case "compareResult":
      renderCompareResult();
      break;
    case "final":
      renderFinal();
      break;
  }
}

function topBar({ back = true, step = 1 } = {}) {
  const dots = SCREEN_ORDER.slice(0, 5)
    .map((_, i) => `<span class="dot ${i < step ? "dot--on" : ""}"></span>`)
    .join("");
  return `
    <div class="topbar">
      <button class="backbtn" data-action="back" ${back ? "" : "disabled style='visibility:hidden'"}>←</button>
      <div class="dots">${dots}</div>
      <span class="topbar-spacer"></span>
    </div>`;
}

function yearChips(current) {
  return `
    <div class="year-chips" role="group" aria-label="年数を選ぶ">
      ${YEAR_OPTIONS.map(
        (y) => `<button class="chip ${y === current ? "chip--active" : ""}" data-action="set-years" data-years="${y}">${y}年</button>`
      ).join("")}
    </div>`;
}

function renderHome() {
  const m = meta();
  const showUnitPicker = m.units.length > 1;
  appEl.innerHTML = `
    ${topBar({ back: false, step: 1 })}
    <main class="screen screen--home">
      <h1 class="brand">このままだと。</h1>
      <p class="lead">今日と同じ生活を続けた、<br />3年後の自分を見てみる。</p>

      <div class="category-tabs" role="group" aria-label="カテゴリを選ぶ">
        ${Object.entries(CATEGORY_META)
          .map(
            ([key, cm]) => `
          <button class="tab ${key === state.category ? "tab--active" : ""}" data-action="set-category" data-category="${key}">
            ${cm.label}
          </button>`
          )
          .join("")}
      </div>

      <p class="hint">${m.exampleLine}</p>

      <label class="field">
        <span class="field-label">何の習慣？（省略可）</span>
        <input type="text" id="input-label" placeholder="${m.placeholder}" maxlength="20" value="${state.label}" />
      </label>

      <div class="field-row">
        <label class="field field--amount">
          <span class="field-label">数値</span>
          <input type="number" id="input-amount" inputmode="decimal" min="0" step="any" value="${state.amountA ?? ""}" />
        </label>

        ${
          showUnitPicker
            ? `<div class="segmented" id="unit-picker">
                ${m.units
                  .map(
                    (u) =>
                      `<button class="seg ${u === state.unit ? "seg--active" : ""}" data-action="set-unit" data-unit="${u}">${UNIT_LABEL[u]}</button>`
                  )
                  .join("")}
              </div>`
            : `<div class="unit-fixed">円</div>`
        }
      </div>

      <div class="field">
        <span class="field-label">頻度</span>
        <div class="segmented">
          ${["day", "month"]
            .map(
              (f) =>
                `<button class="seg ${f === state.frequency ? "seg--active" : ""}" data-action="set-frequency" data-freq="${f}">${FREQ_LABEL[f]}</button>`
            )
            .join("")}
        </div>
      </div>

      <button class="cta" id="go-timeline">3年後へ進む</button>
    </main>
  `;

  bind("[data-action='set-category']", "click", (e) => {
    state.category = e.currentTarget.dataset.category;
    state.unit = CATEGORY_META[state.category].units[0];
    render();
  });
  bind("[data-action='set-unit']", "click", (e) => {
    state.unit = e.currentTarget.dataset.unit;
    render();
  });
  bind("[data-action='set-frequency']", "click", (e) => {
    state.frequency = e.currentTarget.dataset.freq;
    render();
  });
  bind("#input-label", "input", (e) => (state.label = e.target.value));
  bind("#input-amount", "input", (e) => (state.amountA = e.target.value));
  bind("#go-timeline", "click", () => {
    const amt = Number(state.amountA);
    if (state.amountA === "" || state.amountA === null || Number.isNaN(amt) || amt < 0) {
      showToast("数値を入力してください");
      return;
    }
    state.amountA = amt;
    state.years = 3;
    track("calc_started", { category: state.category, unit: state.unit, frequency: state.frequency });
    goto("timeline");
  });
}

function renderTimeline() {
  const startYear = new Date().getFullYear();
  const years = state.years;
  const step = years > 5 ? Math.ceil(years / 5) : 1;
  const marks = [];
  for (let y = 0; y <= years; y += step) marks.push(startYear + y);
  if (marks[marks.length - 1] !== startYear + years) marks.push(startYear + years);

  appEl.innerHTML = `
    ${topBar({ step: 2 })}
    <main class="screen screen--timeline">
      <div class="timeline" id="timeline-list">
        ${marks.map((y) => `<div class="timeline-item" data-year="${y}">${y}</div>`).join('<div class="timeline-arrow">↓</div>')}
      </div>
      <button class="link-btn" id="skip-btn">スキップ</button>
    </main>
  `;

  const items = appEl.querySelectorAll(".timeline-item");
  let i = 0;
  const reveal = () => {
    if (i < items.length) {
      items[i].classList.add("show");
      i++;
      timer = setTimeout(reveal, 420);
    } else {
      timer = setTimeout(() => goto("resultA"), 500);
    }
  };
  let timer = setTimeout(reveal, 200);

  bind("#skip-btn", "click", () => {
    clearTimeout(timer);
    goto("resultA");
  });
}

function renderResultA() {
  const r = totalForYears({ amount: state.amountA, unit: state.unit, frequency: state.frequency }, state.years);
  appEl.innerHTML = `
    ${topBar({ step: 3 })}
    <main class="screen screen--result">
      <p class="sub">${describeAmount(state.amountA, state.unit, state.frequency)}${habitLabel()}を続けると</p>
      ${yearChips(state.years)}
      <p class="context">${state.years}年間の${habitLabel()}</p>
      <div class="big-number">${formatNumber(r.total)}<span class="unit">${UNIT_LABEL[state.unit] === "円" ? "" : ""}${
    r.base === "yen" ? "円" : r.base === "hour" ? "時間" : "回"
  }</span></div>
      ${
        r.base === "hour"
          ? `<div class="big-number big-number--sub">約${formatNumber(r.days)}<span class="unit">日</span></div>
             <p class="note">${state.years}年間のうち、約${formatNumber(r.days)}日分をこの習慣に使う計算です。</p>`
          : `<p class="note">このペースを${state.years}年間続けた場合の合計です。</p>`
      }
      <button class="cta" id="go-compare">次へ</button>
    </main>
  `;

  bind("[data-action='set-years']", "click", (e) => {
    state.years = Number(e.currentTarget.dataset.years);
    track("recalculated", { screen: "resultA", years: state.years });
    render();
  });
  bind("#go-compare", "click", () => goto("compareInput"));
}

function suggestB() {
  const a = Number(state.amountA) || 0;
  if (meta().direction === "increase") {
    const inc = a > 0 ? a : STEP_DEFAULT[state.unit];
    return Math.round((a + inc) * 100) / 100;
  }
  const half = Math.round((a / 2) * 100) / 100;
  return half;
}

function renderCompareInput() {
  if (state.amountB === null || state.amountB === undefined) state.amountB = suggestB();
  const verb = meta().direction === "increase" ? "ふやしたら" : "へらしたら";
  const step = STEP_DEFAULT[state.unit] || 1;

  appEl.innerHTML = `
    ${topBar({ step: 4 })}
    <main class="screen screen--input4">
      <p class="question">もし今日から、<br />${habitLabel()}を${verb}？</p>

      <div class="stepper">
        <button class="stepper-btn" id="dec">−</button>
        <input type="number" id="input-b" inputmode="decimal" min="0" step="any" value="${state.amountB}" />
        <button class="stepper-btn" id="inc">＋</button>
      </div>
      <p class="hint">${FREQ_LABEL[state.frequency]}${UNIT_LABEL[state.unit] === "円" ? "" : ""}${state.unit === "yen" ? "円" : UNIT_LABEL[state.unit]}</p>

      <button class="cta" id="go-result">計算する</button>
    </main>
  `;

  bind("#input-b", "input", (e) => (state.amountB = e.target.value));
  bind("#dec", "click", () => {
    const v = Math.max(0, (Number(state.amountB) || 0) - step);
    state.amountB = v;
    render();
  });
  bind("#inc", "click", () => {
    const v = (Number(state.amountB) || 0) + step;
    state.amountB = v;
    render();
  });
  bind("#go-result", "click", () => {
    const b = Number(state.amountB);
    if (state.amountB === "" || Number.isNaN(b) || b < 0) {
      showToast("数値を入力してください");
      return;
    }
    state.amountB = b;
    goto("compareResult");
  });
}

function renderCompareResult() {
  const cmp = compare(state, state.years);
  const delta = Math.abs(Number(state.amountA) - Number(state.amountB));
  const dLabel = diffLabel(meta().direction);
  const noun = resourceNoun(cmp.base);

  appEl.innerHTML = `
    ${topBar({ step: 4 })}
    <main class="screen screen--compare">
      ${yearChips(state.years)}

      <div class="worlds">
        <div class="world-card">
          <p class="world-title">世界線A（今のまま）</p>
          <p class="world-amount">${describeAmount(state.amountA, state.unit, state.frequency)}</p>
          <p class="world-total">${totalLine(cmp.base, cmp.a.total, cmp.a.days)}</p>
        </div>
        <div class="world-card world-card--b">
          <p class="world-title">世界線B（変えたら）</p>
          <p class="world-amount">${describeAmount(state.amountB, state.unit, state.frequency)}</p>
          <p class="world-total">${totalLine(cmp.base, cmp.b.total, cmp.b.days)}</p>
        </div>
      </div>

      <p class="context">${dLabel}${noun}</p>
      <div class="big-number big-number--accent">
        ${cmp.base === "hour" ? formatNumber(cmp.diffTotal) : formatNumber(cmp.diffTotal)}<span class="unit">${
    cmp.base === "yen" ? "円" : cmp.base === "hour" ? "時間" : "回"
  }</span>
      </div>
      ${cmp.base === "hour" ? `<div class="big-number big-number--sub">約${formatNumber(cmp.diffDays)}<span class="unit">日</span></div>` : ""}

      <p class="message">${state.years}年後の差は、今日の${formatNumber(delta)}${UNIT_LABEL[state.unit]}から。</p>

      <div class="btn-row">
        <button class="link-btn" id="retry-b">別の数字で試す</button>
        <button class="cta" id="go-final">次へ</button>
      </div>
    </main>
  `;

  bind("[data-action='set-years']", "click", (e) => {
    state.years = Number(e.currentTarget.dataset.years);
    track("recalculated", { screen: "compareResult", years: state.years });
    render();
  });
  bind("#retry-b", "click", () => {
    track("recalculate_attempt", { method: "change_b" });
    goto("compareInput");
  });
  bind("#go-final", "click", () => goto("final"));
}

function renderFinal() {
  const cmp = compare(state, state.years);
  const verb = meta().direction === "increase" ? "ふやす" : "へらす";
  const delta = Math.abs(Number(state.amountA) - Number(state.amountB));

  appEl.innerHTML = `
    ${topBar({ step: 5 })}
    <main class="screen screen--final">
      <h2 class="final-title">今日が分岐点になりました。</h2>
      <p class="sub">今日から<br />「${habitLabel()}を${formatNumber(delta)}${UNIT_LABEL[state.unit]}${verb}」</p>

      <p class="context">${state.years}年後の${diffLabel(meta().direction)}${resourceNoun(cmp.base)}</p>
      <div class="big-number big-number--accent">
        ${formatNumber(cmp.diffTotal)}<span class="unit">${cmp.base === "yen" ? "円" : cmp.base === "hour" ? "時間" : "回"}</span>
      </div>
      ${cmp.base === "hour" ? `<div class="big-number big-number--sub">約${formatNumber(cmp.diffDays)}<span class="unit">日</span></div>` : ""}

      <div class="final-actions">
        <button class="cta cta--ghost" id="future-btn">あの日から。を始める</button>
        <button class="cta" id="share-btn">結果をシェア</button>
        <button class="link-btn" id="restart-btn">別の習慣で試す</button>
      </div>
    </main>
  `;

  bind("#future-btn", "click", () => {
    track("future_feature_click", { feature: "ano_hi_kara" });
    showToast("近日公開予定です");
  });
  bind("#restart-btn", "click", resetAll);
  bind("#share-btn", "click", () => openShare(cmp));
}

async function openShare(cmp) {
  track("share_clicked", { method: "open" });
  const text = buildShareText(cmp);
  const url = shareUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title: "このままだと。", text, url });
      track("share_clicked", { method: "webshare_success" });
      return;
    } catch (err) {
      // ユーザーがキャンセルした場合などはコピーにフォールバック
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("コピーしました。貼り付けて共有してください");
    track("share_clicked", { method: "copy" });
  } catch (err) {
    showToast("コピーできませんでした");
  }
}

function bind(selector, event, handler) {
  appEl.querySelectorAll(selector).forEach((elm) => elm.addEventListener(event, handler));
}

// --- 起動 ---------------------------------------------------------------
function boot() {
  track("page_view");
  const loaded = tryLoadFromUrl();
  render();
  if (loaded) {
    // 共有リンクから開いた場合は履歴を積まない(戻ると home に戻る動作にする)
    state.history = ["home"];
  }
}

boot();
