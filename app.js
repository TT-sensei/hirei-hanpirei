// 「比例・反比例パーク」画面と進行。
// 記録（解いた数・正解数・まちがえた問題）は localStorage にだけ保存する。
import {
  QUESTIONS, QUESTION_BY_ID, NAVI_IMG, KIND_NAVI, KIND_LABELS, REL_LABELS, fmt
} from './data.js';

let soundList = [];
try {
  ({ soundList } = await import('https://tt-sensei.github.io/sounds-recipe-/sounds.js'));
} catch {
  // 音は補助要素。読み込めなくても学習本体は続けられるようにする。
  soundList = [];
}

const root = document.querySelector('#app');
const LS_KEY = 'hireiHanpirei.v1';
const SESSION_TOTAL = 10;

// ---------- 記録 ----------
function defaultState() {
  return {
    stats: {
      total: { answered: 0, correct: 0 },
      prop: { answered: 0, correct: 0 },
      inv: { answered: 0, correct: 0 }
    },
    mistakes: [],
    sound: true
  };
}
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!raw) return defaultState();
    const d = defaultState();
    for (const k of ['total', 'prop', 'inv']) {
      if (raw.stats && raw.stats[k]) {
        d.stats[k].answered = raw.stats[k].answered | 0;
        d.stats[k].correct = raw.stats[k].correct | 0;
      }
    }
    d.mistakes = Array.isArray(raw.mistakes) ? raw.mistakes.filter((id) => QUESTION_BY_ID.has(id)) : [];
    d.sound = raw.sound !== false;
    return d;
  } catch {
    return defaultState();
  }
}
const state = loadState();
function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* 保存できなくても続ける */ }
}

// ---------- 音 ----------
class SoundController {
  constructor() { this.context = null; this.recipes = Array.isArray(soundList) ? soundList : []; }
  play(id) {
    if (!state.sound || !this.recipes.length) return;
    const recipe = this.recipes.find((item) => item.id === id);
    if (!recipe) return;
    try {
      if (!this.context) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.context = new AC();
      }
      if (this.context.state === 'suspended') this.context.resume();
      recipe.play(this.context, 0.72);
    } catch { /* 効果音の失敗で操作を止めない */ }
  }
}
const sounds = new SoundController();

// ---------- 小物 ----------
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}
function shuffle(items) {
  const r = [...items];
  for (let i = r.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// ---------- グラフ描画（SVG） ----------
const PLOT = { x0: 42, y0: 278, w: 262, h: 262 };
function clipLine(m, b, xmax, ymax) {
  const pts = [];
  const push = (x, y) => {
    if (x >= -1e-9 && x <= xmax + 1e-9 && y >= -1e-9 && y <= ymax + 1e-9) {
      pts.push([Math.min(Math.max(x, 0), xmax), Math.min(Math.max(y, 0), ymax)]);
    }
  };
  push(0, b); push(xmax, m * xmax + b);
  if (Math.abs(m) > 1e-12) { push(-b / m, 0); push((ymax - b) / m, ymax); }
  const uniq = [];
  for (const p of pts) if (!uniq.some((q) => Math.abs(q[0] - p[0]) < 1e-9 && Math.abs(q[1] - p[1]) < 1e-9)) uniq.push(p);
  uniq.sort((a, b2) => a[0] - b2[0]);
  return uniq.length >= 2 ? [uniq[0], uniq[uniq.length - 1]] : null;
}

function graphSVG(view, color) {
  const { spec, xmax, ymax, gx, gy, mark = null, points = null } = view;
  const X = (x) => PLOT.x0 + (x / xmax) * PLOT.w;
  const Y = (y) => PLOT.y0 - (y / ymax) * PLOT.h;
  let s = '';
  // グリッドと目盛り
  for (let gxStep = gx; gxStep < xmax - 1e-9; gxStep += gx) {
    s += `<line x1="${X(gxStep)}" y1="${PLOT.y0 - PLOT.h}" x2="${X(gxStep)}" y2="${PLOT.y0}" stroke="#e3efe7" stroke-width="1"/>`;
  }
  for (let gyStep = gy; gyStep < ymax - 1e-9; gyStep += gy) {
    s += `<line x1="${PLOT.x0}" y1="${Y(gyStep)}" x2="${PLOT.x0 + PLOT.w}" y2="${Y(gyStep)}" stroke="#e3efe7" stroke-width="1"/>`;
  }
  const xLabelEvery = Math.ceil(xmax / gx) > 8 ? 2 : 1;
  for (let gxStep = gx, i = 1; gxStep <= xmax + 1e-9; gxStep += gx, i += 1) {
    if (i % xLabelEvery === 0 || gxStep >= xmax - 1e-9) {
      s += `<text x="${X(gxStep)}" y="${PLOT.y0 + 20}" font-size="12" fill="#66756c" text-anchor="middle">${fmt(gxStep)}</text>`;
    }
  }
  for (let gyStep = gy; gyStep <= ymax + 1e-9; gyStep += gy) {
    s += `<text x="${PLOT.x0 - 6}" y="${Y(gyStep) + 4}" font-size="12" fill="#66756c" text-anchor="end">${fmt(gyStep)}</text>`;
  }
  // 軸
  s += `<line x1="${PLOT.x0}" y1="${PLOT.y0 - PLOT.h - 6}" x2="${PLOT.x0}" y2="${PLOT.y0}" stroke="#44554b" stroke-width="2"/>`;
  s += `<line x1="${PLOT.x0}" y1="${PLOT.y0}" x2="${PLOT.x0 + PLOT.w + 6}" y2="${PLOT.y0}" stroke="#44554b" stroke-width="2"/>`;
  s += `<text x="${PLOT.x0 - 8}" y="${PLOT.y0 - PLOT.h - 10}" font-size="14" font-weight="bold" fill="#44554b">y</text>`;
  s += `<text x="${PLOT.x0 + PLOT.w + 4}" y="${PLOT.y0 - 8}" font-size="14" font-weight="bold" fill="#44554b">x</text>`;
  s += `<text x="${PLOT.x0 - 14}" y="${PLOT.y0 + 16}" font-size="12" fill="#66756c">O</text>`;
  // 曲線・直線
  if (spec.t === 'line') {
    const seg = clipLine(spec.m, spec.b, xmax, ymax);
    if (seg) s += `<line x1="${X(seg[0][0])}" y1="${Y(seg[0][1])}" x2="${X(seg[1][0])}" y2="${Y(seg[1][1])}" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`;
  } else if (spec.t === 'curve') {
    const xStart = Math.max(spec.a / ymax, xmax / 200);
    const pts = [];
    for (let i = 0; i <= 60; i += 1) {
      const x = xStart + ((xmax - xStart) * i) / 60;
      const y = spec.a / x;
      if (y <= ymax + 1e-9) pts.push(`${X(x)},${Y(Math.min(y, ymax))}`);
    }
    if (pts.length > 1) s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`;
  }
  // 表の点
  if (points) {
    for (const [px, py] of points) {
      if (px <= xmax && py <= ymax) s += `<circle cx="${X(px)}" cy="${Y(py)}" r="4.5" fill="#31559f" stroke="#fff" stroke-width="1.5"/>`;
    }
  }
  // 目印の点
  if (mark) {
    s += `<line x1="${X(mark.x)}" y1="${PLOT.y0}" x2="${X(mark.x)}" y2="${Y(mark.y)}" stroke="#e05252" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    s += `<line x1="${PLOT.x0}" y1="${Y(mark.y)}" x2="${X(mark.x)}" y2="${Y(mark.y)}" stroke="#e05252" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    s += `<circle cx="${X(mark.x)}" cy="${Y(mark.y)}" r="6" fill="#e05252" stroke="#fff" stroke-width="2"/>`;
  }
  return `<svg viewBox="0 0 320 320" role="img" aria-label="グラフ">${s}</svg>`;
}

// ---------- 表の描画 ----------
function tableHTML(table, blank) {
  const cell = (v, isBlank) => isBlank
    ? '<td class="blank">？</td>'
    : `<td>${fmt(v)}</td>`;
  const xs = table.xs.map((x, i) => cell(x, blank && blank.row === 'x' && blank.index === i)).join('');
  const ys = table.ys.map((y, i) => cell(y, blank && blank.row === 'y' && blank.index === i)).join('');
  return `<table class="q-table"><tr><th>x</th>${xs}</tr><tr><th>y</th>${ys}</tr></table>`;
}
function miniTableHTML(t) {
  const xs = t.xs.map((x) => `<td>${fmt(x)}</td>`).join('');
  const ys = t.ys.map((y) => `<td>${fmt(y)}</td>`).join('');
  return `<table class="mini-table"><tr><th>x</th>${xs}</tr><tr><th>y</th>${ys}</tr></table>`;
}

// ---------- 画面共通 ----------
let screen = 'home';
let session = null;

function shell(content) {
  return `
  <div class="edu-app park-app">
    <header class="edu-shell-header app-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <button class="app-brand" data-action="home" aria-label="ホームへ">
        <span class="brand-mark">比</span>
        <span><strong>比例・反比例パーク</strong><small>TT-sensei · 6年生 算数</small></span>
      </button>
      <div class="header-actions">
        ${screen !== 'home' ? '<button class="edu-btn header-home" data-action="home">ホーム</button>' : ''}
        <button class="sound-toggle" data-action="sound" aria-pressed="${state.sound}">${state.sound ? '🔊 音 ON' : '🔇 音 OFF'}</button>
      </div>
    </header>
    <main class="edu-main park-main" id="main"><div class="park-container">${content}</div></main>
    <footer class="park-footer">TT-sensei <span>学ぶ · 挑戦する · できるようになる</span></footer>
  </div>`;
}

function render() {
  if (screen === 'home') root.innerHTML = shell(renderHome());
  else if (screen === 'practice') root.innerHTML = shell(renderPractice());
  else if (screen === 'records') root.innerHTML = shell(renderRecords());
  else if (screen === 'result') root.innerHTML = shell(renderResult());
  window.scrollTo(0, 0);
}

// ---------- ホーム ----------
function accuracyText(st) {
  if (!st.answered) return 'これから';
  return `${Math.round((st.correct / st.answered) * 100)}%`;
}
function renderHome() {
  const m = state.mistakes.length;
  return `
  <section class="home-hero edu-kinetic-pop">
    <img src="${NAVI_IMG.home}" alt="考えているナビキャラたち">
    <div>
      <h1>比例と反比例を、<br>表・式・グラフで確かめよう</h1>
      <p>数の変わり方を見つけて、関係を当てよう。まちがえた問題は記録されて、あとから何度でも挑戦できます。</p>
      <div class="hero-tags"><span>比例</span><span>反比例</span><span>全72問</span></div>
    </div>
  </section>

  <h2 class="section-title">れんしゅうを選ぼう</h2>
  <div class="mode-grid">
    <button class="mode-btn prop" data-action="start" data-mode="prop"><b>比例だけ</b><small>比例の問題を 10問</small></button>
    <button class="mode-btn inv" data-action="start" data-mode="inv"><b>反比例だけ</b><small>反比例の問題を 10問</small></button>
    <button class="mode-btn mix" data-action="start" data-mode="mix"><b>まぜまぜ</b><small>比例と反比例を まぜて 10問</small></button>
  </div>

  <h2 class="section-title">種類別れんしゅう（各10問）</h2>
  <div class="kind-grid">
    ${Object.keys(KIND_LABELS).map((k) => `<button class="kind-btn" data-action="start" data-mode="kind" data-kind="${k}">${KIND_LABELS[k]}<small>${QUESTIONS.filter((q) => q.kind === k).length}問から出題</small></button>`).join('')}
  </div>

  <h2 class="section-title">記録と再挑戦</h2>
  <div class="tool-grid">
    <button class="tool-btn" data-action="retry">
      <span><b>まちがえた問題</b><small>${m ? '記録した問題に 再挑戦しよう' : 'まちがえた問題は ここに たまります'}</small></span>
      <span class="badge ${m ? '' : 'zero'}">${m}</span>
    </button>
    <button class="tool-btn" data-action="records">
      <span><b>学習の記録</b><small>解いた数 ${state.stats.total.answered}問 · 正解 ${state.stats.total.correct}問 · 正答率 ${accuracyText(state.stats.total)}</small></span>
    </button>
  </div>
  <p class="foot-note">記録は、この端末の中にだけ保存されます。</p>`;
}

// ---------- 練習 ----------
function poolFor(mode, kind) {
  if (mode === 'prop') return QUESTIONS.filter((q) => q.rel === 'prop');
  if (mode === 'inv') return QUESTIONS.filter((q) => q.rel === 'inv');
  if (mode === 'kind') return QUESTIONS.filter((q) => q.kind === kind);
  return QUESTIONS;
}
function modeLabel(mode, kind) {
  if (mode === 'prop') return '比例だけ';
  if (mode === 'inv') return '反比例だけ';
  if (mode === 'kind') return `種類別・${KIND_LABELS[kind]}`;
  if (mode === 'retry') return 'まちがえた問題';
  return 'まぜまぜ';
}

function startSession(mode, kind) {
  let ids;
  if (mode === 'retry') {
    ids = shuffle(state.mistakes);
    if (!ids.length) return;
  } else {
    ids = shuffle(poolFor(mode, kind).map((q) => q.id)).slice(0, SESSION_TOTAL);
  }
  session = {
    mode, kind, label: modeLabel(mode, kind),
    ids, idx: 0, correct: 0, cleared: 0,
    view: null, answered: false, chosenOrig: -1
  };
  prepareQuestion();
  screen = 'practice';
  sounds.play('start');
  render();
}

function prepareQuestion() {
  const q = QUESTION_BY_ID.get(session.ids[session.idx]);
  let view;
  if (q.kind === 'miwake' && q.optionTables) {
    // 見分け（表）は順番を変えず、表そのものを選択肢にする
    view = q.optionTables.map((t, i) => ({ orig: i, mini: t, note: q.choices[i].note }));
  } else {
    view = shuffle(q.choices.map((c, i) => ({ ...c, orig: i })));
  }
  session.view = view;
  session.answered = false;
  session.chosenOrig = -1;
}

function correctText(q) {
  if (q.optionTables) return `${'アイウエ'[q.answer]}の表`;
  const c = q.choices[q.answer];
  if (c.graph) return '緑色で囲んだグラフ';
  return c.label;
}

function renderPractice() {
  const q = QUESTION_BY_ID.get(session.ids[session.idx]);
  const total = session.ids.length;
  const progress = Math.round((session.idx / total) * 100);
  const navi = KIND_NAVI[q.kind];
  const relColor = q.rel === 'prop' ? '#f5821f' : '#1f9d66';

  let visual = '';
  if (q.table) visual = `<div class="q-visual">${tableHTML(q.table, q.blank)}</div>`;
  if (q.graph) visual = `<div class="q-visual"><div class="graph-box">${graphSVG(q.graph, relColor)}</div></div>`;

  const buttons = session.view.map((c) => {
    let cls = 'choice-btn edu-choice';
    let inner = '';
    if (c.mini) inner = miniTableHTML(c.mini);
    else if (c.graph) inner = graphSVG({ spec: c.graph, ...q.graphView, points: q.params.points }, '#31559f');
    else inner = escapeHtml(c.label);
    let note = '';
    if (session.answered) {
      if (c.orig === q.answer) cls += ' is-correct';
      else if (c.orig === session.chosenOrig) {
        cls += ' is-wrong';
        if (c.note) note = `<span class="choice-note">${escapeHtml(c.note)}</span>`;
      } else cls += ' is-dim';
    }
    return `<button class="${cls}" data-action="answer" data-orig="${c.orig}" ${session.answered ? 'disabled' : ''}>${inner}${note}</button>`;
  }).join('');

  let feedback = '';
  if (session.answered) {
    const ok = session.chosenOrig === q.answer;
    feedback = `
    <div class="feedback ${ok ? 'ok' : 'ng'} edu-kinetic-pop">
      <img src="${ok ? NAVI_IMG.happy : NAVI_IMG.encourage}" alt="">
      <div>
        <p class="fb-title">${ok ? '正解！' : `おしい！ こたえは「${escapeHtml(correctText(q))}」`}</p>
        <p>${escapeHtml(q.explain)}</p>
      </div>
    </div>
    <div class="next-row"><button class="big-btn" data-action="next">${session.idx + 1 >= total ? '結果を見る' : 'つぎへ →'}</button></div>`;
  }

  return `
  <div class="session-head">
    <span class="mode-name">${escapeHtml(session.label)}</span>
    <div class="edu-progress session-progress">
      <div class="edu-progress-head"><span>${session.idx + 1} / ${total} 問目</span><span>${progress}%</span></div>
      <div class="edu-progress-track"><div class="edu-progress-value" style="width:${progress}%"></div></div>
    </div>
  </div>
  <article class="q-card">
    <div class="q-top">
      <img class="q-navi" src="${navi.img}" alt="${navi.name}">
      <div>
        <div class="q-meta">
          <span class="chip">${KIND_LABELS[q.kind]}</span>
          ${session.mode !== 'mix' ? `<span class="chip rel-${q.rel}">${REL_LABELS[q.rel]}</span>` : ''}
        </div>
        <p class="q-prompt">${escapeHtml(q.prompt)}</p>
        <p class="q-navi-comment">${navi.name}：${navi.comment}</p>
      </div>
    </div>
    ${visual}
    <div class="answer-grid edu-answer-grid">${buttons}</div>
    ${feedback}
  </article>`;
}

function answerQuestion(orig) {
  if (!session || session.answered) return;
  const q = QUESTION_BY_ID.get(session.ids[session.idx]);
  session.answered = true;
  session.chosenOrig = orig;
  const ok = orig === q.answer;
  state.stats.total.answered += 1;
  state.stats[q.rel].answered += 1;
  if (ok) {
    session.correct += 1;
    state.stats.total.correct += 1;
    state.stats[q.rel].correct += 1;
    const mi = state.mistakes.indexOf(q.id);
    if (mi >= 0) { state.mistakes.splice(mi, 1); session.cleared += 1; }
    sounds.play('correct');
  } else {
    if (!state.mistakes.includes(q.id)) state.mistakes.push(q.id);
    sounds.play('wrong');
  }
  persist();
  render();
}

function nextQuestion() {
  if (!session) return;
  session.idx += 1;
  if (session.idx >= session.ids.length) {
    screen = 'result';
    sounds.play('practice');
  } else {
    prepareQuestion();
  }
  render();
}

// ---------- 結果 ----------
function renderResult() {
  const total = session.ids.length;
  const good = session.correct >= Math.ceil(total * 0.7);
  const isRetry = session.mode === 'retry';
  return `
  <section class="result-card edu-kinetic-pop">
    <img class="pose" src="${good ? NAVI_IMG.correctPose : NAVI_IMG.retryPose}" alt="">
    <p class="result-score">${total}問中 ${session.correct}問 正解</p>
    <p class="result-sub">
      ${isRetry ? `まちがえた問題に再挑戦して、${session.cleared}問 克服しました。` : 'おつかれさま！ まちがえた問題は「まちがえた問題」に記録されています。'}
      ${state.mistakes.length ? `のこりの まちがえた問題は ${state.mistakes.length}問 です。` : 'まちがえた問題は ありません。'}
    </p>
    <div class="result-actions">
      <button class="big-btn" data-action="again">もう一度</button>
      <button class="big-btn sub" data-action="home">ホームへ</button>
    </div>
  </section>`;
}

// ---------- 記録 ----------
function recRow(label, st) {
  return `<tr><th>${label}</th><td>${st.answered}問</td><td>${st.correct}問</td><td>${accuracyText(st)}</td></tr>`;
}
function renderRecords() {
  return `
  <div class="screen-back"><button class="back-btn" data-action="home">← ホームへ</button></div>
  <section class="records-card">
    <h2>学習の記録</h2>
    <table class="rec-table">
      <tr><th></th><th>解いた数</th><th>正解</th><th>正答率</th></tr>
      ${recRow('全体', state.stats.total)}
      ${recRow('比例', state.stats.prop)}
      ${recRow('反比例', state.stats.inv)}
    </table>
    <p class="note">まちがえた問題は ${state.mistakes.length}問 記録されています。正解すると、克服として記録から外れます。<br>記録は、この端末の中にだけ保存されます。</p>
    <div class="result-actions">
      ${state.mistakes.length ? '<button class="big-btn" data-action="retry">まちがえた問題に挑戦</button>' : ''}
      <button class="big-btn sub" data-action="home">ホームへ</button>
    </div>
  </section>`;
}

// ---------- イベント ----------
root.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'home') { screen = 'home'; session = null; render(); }
  else if (action === 'sound') { state.sound = !state.sound; persist(); render(); }
  else if (action === 'start') startSession(el.dataset.mode, el.dataset.kind || null);
  else if (action === 'retry') startSession('retry', null);
  else if (action === 'records') { screen = 'records'; render(); }
  else if (action === 'answer') answerQuestion(Number(el.dataset.orig));
  else if (action === 'next') nextQuestion();
  else if (action === 'again') { const s = session; startSession(s.mode, s.kind); }
});

render();
