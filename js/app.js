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
  },
  money: {
    label: "お金",
    direction: "reduce",
    units: ["yen"],
    placeholder: "コンビニ",
  },
  build: {
    label: "積み上げ",
    direction: "increase",
    units: ["min", "hour", "count", "yen"],
    placeholder: "勉強",
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

function freqWord() {
  return state.frequency === "month" ? "毎月" : "1日";
}

// カテゴリ・単位ごとに「何を入力すればいいか」が一読で分かる質問文を作る。
function inputQuestion() {
  const habit = habitLabel();
  const freq = freqWord();
  if (state.category === "money") {
    return `${habit}に${freq}いくら使っていますか？`;
  }
  if (state.category === "time") {
    return state.unit === "min" ? `${habit}を${freq}何分使っていますか？` : `${habit}を${freq}何時間使っていますか？`;
  }
  // 積み上げ
  if (state.unit === "min") return `${habit}を${freq}何分していますか？`;
  if (state.unit === "hour") return `${habit}を${freq}何時間していますか？`;
  if (state.unit === "count") return `${habit}を${freq}何回していますか？`;
  return `${habit}を${freq}いくらしていますか？`;
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
  const changeVerb = meta().direction === "increase" ? "増やす" : "減らす";
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
      <p class="lead">今の習慣を続けた未来を、数字で見る。</p>

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

      <p class="intro-line">まず、今の習慣を教えてください。</p>

      <label class="field">
        <span class="field-label">習慣の名前（省略可）</span>
        <input type="text" id="input-label" placeholder="${m.placeholder}" maxlength="20" value="${state.label}" />
      </label>

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

      <p class="input-question" id="input-question">${inputQuestion()}</p>

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
  bind("#input-label", "input", (e) => {
    state.label = e.target.value;
    const q = document.getElementById("input-question");
    if (q) q.textContent = inputQuestion();
  });
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
      timer = setTimeout(reveal, 180);
    } else {
      timer = setTimeout(() => goto("resultA"), 300);
    }
  };
  // 演出全体でおよそ1秒前後になるよう調整(待たせすぎない)
  let timer = setTimeout(reveal, 100);

  bind("#skip-btn", "click", () => {
    clearTimeout(timer);
    goto("resultA");
  });
}

// 大きい数字を「24時間ずっと使い続けたら」という身近な尺度に変換する。
// days は totalForYears() が算出した「24時間換算の日数」をそのまま使うため、
// 数学的な意味は変えず、表現だけを日/月/年の自然な単位に丸める。
function timeConversionLine(days, habit) {
  if (days < 1) return null;
  if (days < 30) {
    return `丸${formatNumber(days)}日間、24時間ずっと${habit}を使い続けるのと同じ時間です。`;
  }
  const months = Math.round(days / 30);
  if (months < 24) {
    return `丸${formatNumber(months)}か月間、24時間ずっと${habit}を使い続けるのと同じ時間です。`;
  }
  const yearsEq = Math.max(1, Math.round(months / 12));
  return `約${formatNumber(yearsEq)}年間、24時間ずっと${habit}を使い続けるのと同じ時間です。`;
}

function resultNote(r) {
  if (r.base === "yen") {
    const monthlyAvg = r.total / (state.years * 12);
    const yearlyAvg = r.total / state.years;
    return `毎月平均${formatYen(monthlyAvg)}、年間平均${formatYen(yearlyAvg)}を使い続けている計算です。`;
  }
  if (r.base !== "hour") {
    return `このペースを${state.years}年間続けた場合の合計です。`;
  }
  if (state.category === "time") {
    return timeConversionLine(r.days, habitLabel()) || `${habitLabel()}を見て過ごすことになります。`;
  }
  // 積み上げ(時間系)：1年あたりに増える量も添える
  const annualDays = Math.floor(r.total / state.years / 24);
  if (annualDays >= 1) {
    return `1年間では約${formatNumber(annualDays)}日分、${state.years}年間では約${formatNumber(
      r.days
    )}日分増える計算です。`;
  }
  return `${state.years}年間のうち、約${formatNumber(r.days)}日分を${habitLabel()}に使う計算です。`;
}

function renderResultA() {
  const r = totalForYears({ amount: state.amountA, unit: state.unit, frequency: state.frequency }, state.years);
  appEl.innerHTML = `
    ${topBar({ step: 3 })}
    <main class="screen screen--result">
      ${yearChips(state.years)}
      <h2 class="result-headline">${state.years}年間、このままだと。</h2>
      <p class="sub">${describeAmount(state.amountA, state.unit, state.frequency)}${habitLabel()}を続けた場合</p>
      <div class="big-number">${formatNumber(r.total)}<span class="unit">${
    r.base === "yen" ? "円" : r.base === "hour" ? "時間" : "回"
  }</span></div>
      ${r.base === "hour" ? `<div class="big-number big-number--sub">約${formatNumber(r.days)}<span class="unit">日</span></div>` : ""}
      <p class="note">${resultNote(r)}</p>
      <p class="impact-line">何もしなければ、この数字はそのまま積み上がります。</p>
      <button class="cta" id="go-compare">もし、今日から変えたら？</button>
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

function questionPhrase() {
  const habit = habitLabel();
  const increase = meta().direction === "increase";
  if (state.unit === "min" || state.unit === "hour") {
    return `${habit}の時間を${increase ? "増やしたら" : "減らしたら"}？`;
  }
  if (state.unit === "yen") {
    return increase ? `${habit}にまわすお金を増やしたら？` : `${habit}で使うお金を減らしたら？`;
  }
  return `${habit}の回数を${increase ? "増やしたら" : "減らしたら"}？`;
}

function renderCompareInput() {
  if (state.amountB === null || state.amountB === undefined) state.amountB = suggestB();
  const step = STEP_DEFAULT[state.unit] || 1;

  appEl.innerHTML = `
    ${topBar({ step: 4 })}
    <main class="screen screen--input4">
      <p class="question">もし今日から、<br />${questionPhrase()}</p>

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

function worldBTitle() {
  const delta = Math.abs(Number(state.amountA) - Number(state.amountB));
  const verb = meta().direction === "increase" ? "増やす" : "減らす";
  return `今日から${formatNumber(delta)}${UNIT_LABEL[state.unit]}${verb}`;
}

// A/Bの差を「日常語」の1文にする。日数換算できる場合はそれを主役にする。
function compareMessage(cmp) {
  const freq = freqWord();
  const delta = Math.abs(Number(state.amountA) - Number(state.amountB));
  const verb = meta().direction === "increase" ? "増やす" : "減らす";
  const resultVerb = meta().direction === "increase" ? "増えます" : "戻ります";
  const deltaText = `${freq}${formatNumber(delta)}${UNIT_LABEL[state.unit]}${verb}`;

  if (cmp.base === "hour") {
    return `${deltaText}だけで、${state.years}年間では約${formatNumber(cmp.diffDays)}日分の時間が${resultVerb}。`;
  }
  if (cmp.base === "yen") {
    const monthlyDiffAvg = cmp.diffTotal / (state.years * 12);
    return `${deltaText}だけで、${state.years}年間で約${formatYen(cmp.diffTotal)}（毎月平均${formatYen(
      monthlyDiffAvg
    )}）${resultVerb}。`;
  }
  return `${deltaText}だけで、${state.years}年間で約${formatNumber(cmp.diffTotal)}${resourceNoun(cmp.base)}${resultVerb}。`;
}

function renderCompareResult() {
  const cmp = compare(state, state.years);

  appEl.innerHTML = `
    ${topBar({ step: 4 })}
    <main class="screen screen--compare">
      ${yearChips(state.years)}

      <div class="worlds">
        <div class="world-card">
          <p class="world-title">このまま</p>
          <p class="world-amount">${describeAmount(state.amountA, state.unit, state.frequency)}</p>
          <p class="world-total">${totalLine(cmp.base, cmp.a.total, cmp.a.days)}</p>
        </div>
        <div class="world-card world-card--b">
          <p class="world-title">${worldBTitle()}</p>
          <p class="world-amount">${describeAmount(state.amountB, state.unit, state.frequency)}</p>
          <p class="world-total">${totalLine(cmp.base, cmp.b.total, cmp.b.days)}</p>
        </div>
      </div>

      <p class="context">その差</p>
      <div class="big-number big-number--accent">
        ${formatNumber(cmp.diffTotal)}<span class="unit">${
    cmp.base === "yen" ? "円" : cmp.base === "hour" ? "時間" : "回"
  }</span>
      </div>
      ${cmp.base === "hour" ? `<div class="big-number big-number--sub">約${formatNumber(cmp.diffDays)}<span class="unit">日</span></div>` : ""}

      <p class="message">${compareMessage(cmp)}</p>

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

// カテゴリごとに自然な日本語になるよう文章テンプレートを分ける。
// (時間:スマホ等「モノ」が主語になりがちなので「の時間を」、
//  積み上げ:勉強等「行為」が主語になりがちなので「時間を」)
function finalChangePhrase() {
  const habit = habitLabel();
  const delta = Math.abs(Number(state.amountA) - Number(state.amountB));
  const freqPhrase = state.frequency === "month" ? "毎月" : "1日";
  const amount = `${formatNumber(delta)}${UNIT_LABEL[state.unit]}`;

  if (state.category === "time") {
    return `${habit}の時間を${freqPhrase}${amount}減らす`;
  }
  if (state.category === "money") {
    return `${habit}代を${freqPhrase}${amount}減らす`;
  }
  // 積み上げ
  if (state.unit === "min" || state.unit === "hour") {
    return `${habit}時間を${freqPhrase}${amount}増やす`;
  }
  if (state.unit === "yen") {
    return `${habit}にまわすお金を${freqPhrase}${amount}増やす`;
  }
  return `${habit}の回数を${freqPhrase}${amount}増やす`;
}

function renderFinal() {
  const cmp = compare(state, state.years);

  appEl.innerHTML = `
    ${topBar({ step: 5 })}
    <main class="screen screen--final">
      <h2 class="final-title">今日が分岐点になりました。</h2>
      <p class="sub">今日から<br />「${finalChangePhrase()}」</p>

      <p class="context">${state.years}年後の${diffLabel(meta().direction)}${resourceNoun(cmp.base)}</p>
      <div class="big-number big-number--accent">
        ${formatNumber(cmp.diffTotal)}<span class="unit">${cmp.base === "yen" ? "円" : cmp.base === "hour" ? "時間" : "回"}</span>
      </div>
      ${cmp.base === "hour" ? `<div class="big-number big-number--sub">約${formatNumber(cmp.diffDays)}<span class="unit">日</span></div>` : ""}

      <div class="final-actions">
        <button class="cta" id="share-btn">結果をシェア</button>
        <button class="cta cta--ghost" id="restart-btn">別の習慣も見てみる</button>
        <button class="link-btn" id="future-btn">あの日から。を始める</button>
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
