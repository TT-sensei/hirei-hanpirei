// 「比例・反比例パーク」の学習データ。
// 問題はパラメータ（比例定数・積など）から生成し、params に生成パラメータを保持する。
// verify/verify.mjs が params から答えを独立に再計算して全問を検算する。

export const APP_VERSION = '1.0.0';

const NAVI_BASE = 'https://tt-sensei.github.io/navi-character-/assets/web';

export const NAVI = {
  riku: { id: 'riku', name: 'りく' },
  sora: { id: 'sora', name: 'そら' },
  kai: { id: 'kai', name: 'かい' },
  saku: { id: 'saku', name: 'さく' },
  tsuki: { id: 'tsuki', name: 'つき' },
  nami: { id: 'nami', name: 'なみ' }
};

export const NAVI_IMG = {
  home: `${NAVI_BASE}/groups/group-thinking.webp`,
  happy: `${NAVI_BASE}/characters/riku/expressions/02-happy.webp`,
  celebrate: `${NAVI_BASE}/characters/sora/expressions/08-celebrating.webp`,
  thinking: `${NAVI_BASE}/characters/kai/expressions/03-thinking.webp`,
  encourage: `${NAVI_BASE}/characters/saku/expressions/07-encouraging.webp`,
  idea: `${NAVI_BASE}/characters/tsuki/expressions/04-idea.webp`,
  cheer: `${NAVI_BASE}/characters/nami/expressions/07-encouraging.webp`,
  correctPose: `${NAVI_BASE}/characters/riku/fullbody/correct.webp`,
  retryPose: `${NAVI_BASE}/characters/saku/fullbody/retry.webp`
};

// 種類ごとの担当ナビキャラ（問題画面の案内役）
export const KIND_NAVI = {
  miwake: { img: NAVI_IMG.thinking, name: 'かい', comment: '表や場面をよく見て、関係を見分けよう。' },
  table: { img: NAVI_IMG.happy, name: 'りく', comment: '表の数の変わり方に注目しよう。' },
  formula: { img: NAVI_IMG.idea, name: 'つき', comment: '決まった数を見つけると、式が作れるよ。' },
  graph: { img: NAVI_IMG.cheer, name: 'なみ', comment: 'グラフの形と点の位置を確かめよう。' },
  word: { img: NAVI_IMG.encourage, name: 'さく', comment: '場面を表や式にすると考えやすいよ。' }
};

export const KIND_LABELS = {
  miwake: '見分け',
  table: '表',
  formula: '式',
  graph: 'グラフ',
  word: '文章題'
};

export const REL_LABELS = { prop: '比例', inv: '反比例' };

// ---- 数値ユーティリティ ----
export function fmt(n) {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}
export const near = (a, b) => Math.abs(a - b) < 1e-9;

// 関係の関数：prop は y=a*x、inv は y=a/x（x*y=a）
export function relValue(rel, a, x) {
  return rel === 'prop' ? a * x : a / x;
}

// 表（xs, ys）の関係を判定する。verify と生成で共用。
export function relOfTable(xs, ys) {
  if (xs.some((x) => x === 0)) return 'none';
  const ratios = xs.map((x, i) => ys[i] / x);
  if (ratios.every((r) => near(r, ratios[0]))) return 'prop';
  const prods = xs.map((x, i) => x * ys[i]);
  if (prods.every((p) => near(p, prods[0]))) return 'inv';
  return 'none';
}

// グラフ仕様が点 (x, y) を通るか。verify と描画で共用。
// spec: {t:'line', m, b} は y = m*x + b、{t:'curve', a} は x*y = a
export function graphPasses(spec, x, y) {
  if (spec.t === 'line') return near(spec.m * x + spec.b, y);
  if (spec.t === 'curve') return near(x * y, spec.a);
  return false;
}

// 関係からグラフ仕様を作る
export function graphSpecOf(rel, a) {
  return rel === 'prop' ? { t: 'line', m: a, b: 0 } : { t: 'curve', a };
}

// 式の選択肢仕様を評価する。fn: {op:'mul'|'divX'|'xDiv'|'add'|'sub', k}
// mul: y=k*x / divX: y=k/x / xDiv: y=x/k / add: y=x+k / sub: y=k-x
export function evalFormula(fn, x) {
  switch (fn.op) {
    case 'mul': return fn.k * x;
    case 'divX': return fn.k / x;
    case 'xDiv': return x / fn.k;
    case 'add': return x + fn.k;
    case 'sub': return fn.k - x;
    default: return NaN;
  }
}
export function formulaLabel(fn) {
  switch (fn.op) {
    case 'mul': return `y ＝ ${fmt(fn.k)} × x`;
    case 'divX': return `y ＝ ${fmt(fn.k)} ÷ x`;
    case 'xDiv': return `y ＝ x ÷ ${fmt(fn.k)}`;
    case 'add': return `y ＝ x ＋ ${fmt(fn.k)}`;
    case 'sub': return `y ＝ ${fmt(fn.k)} − x`;
    default: return '';
  }
}
export function formulaOf(rel, a) {
  return rel === 'prop' ? { op: 'mul', k: a } : { op: 'divX', k: a };
}

// ---- 問題ビルダー ----
// 数値の選択肢を作る。distr は [{v, note}]（誤答と、その答えへのひとこと）。
function numChoices(answerValue, distr) {
  const choices = [{ label: fmt(answerValue), value: answerValue, note: '' }];
  for (const d of distr) choices.push({ label: fmt(d.v), value: d.v, note: d.note });
  return { choices, answer: 0 };
}

const BANK = [];
function add(q) { BANK.push(q); return q; }

// ============ 見分け（12問） ============
// 表の選択肢から、目標の関係になっているものを選ぶ。
function miwakeTable(id, targetRel, options, explain) {
  const answer = options.findIndex((o) => relOfTable(o.xs, o.ys) === targetRel);
  add({
    id, kind: 'miwake', rel: targetRel,
    prompt: `${REL_LABELS[targetRel]}の関係になっているのは、どれですか。`,
    optionTables: options,
    choices: options.map((o, i) => ({
      label: `${'アイウエ'[i]}`,
      note: relOfTable(o.xs, o.ys) === targetRel ? '' :
        relOfTable(o.xs, o.ys) === 'none'
          ? 'この表は、xが2倍になってもyが2倍にならず、x×yも決まった数になりません。'
          : `この表は${REL_LABELS[relOfTable(o.xs, o.ys)]}の関係です。`
    })),
    answer, explain,
    params: { type: 'miwake-table', targetRel, options }
  });
}

miwakeTable('mw-t1', 'prop', [
  { xs: [1, 2, 3], ys: [3, 6, 9] },
  { xs: [2, 3, 4], ys: [6, 4, 3] },
  { xs: [1, 2, 3], ys: [2, 5, 9] },
  { xs: [1, 2, 3], ys: [5, 6, 7] }
], 'アの表は、xが2倍、3倍になると、yも2倍、3倍になっています。y÷xの値はいつも3で、比例の関係です。');

miwakeTable('mw-t2', 'inv', [
  { xs: [1, 2, 3], ys: [5, 10, 15] },
  { xs: [2, 3, 6], ys: [9, 6, 3] },
  { xs: [1, 2, 4], ys: [3, 5, 9] },
  { xs: [2, 4, 6], ys: [3, 5, 7] }
], 'イの表は、x×yの値が 2×9、3×6、6×3 と、いつも18になっています。反比例の関係です。');

miwakeTable('mw-t3', 'prop', [
  { xs: [3, 4, 6], ys: [8, 6, 4] },
  { xs: [1, 2, 3], ys: [7, 8, 9] },
  { xs: [2, 3, 4], ys: [8, 12, 16] },
  { xs: [1, 3, 5], ys: [2, 4, 9] }
], 'ウの表は、y÷xの値が 8÷2、12÷3、16÷4 と、いつも4です。xが2倍になるとyも2倍になる比例の関係です。');

miwakeTable('mw-t4', 'inv', [
  { xs: [1, 2, 3], ys: [4, 7, 10] },
  { xs: [1, 2, 3], ys: [6, 12, 18] },
  { xs: [2, 4, 8], ys: [5, 9, 17] },
  { xs: [3, 5, 6], ys: [10, 6, 5] }
], 'エの表は、x×yの値が 3×10、5×6、6×5 と、いつも30です。xが2倍になるとyは半分になる反比例の関係です。アの表は y＝3×x＋1 で、比例ではありません。');

miwakeTable('mw-t5', 'prop', [
  { xs: [1, 2, 4], ys: [6, 10, 18] },
  { xs: [2, 4, 8], ys: [8, 4, 2] },
  { xs: [3, 6, 9], ys: [5, 8, 11] },
  { xs: [1, 2, 3], ys: [7, 14, 21] }
], 'エの表は、xが2倍、3倍になると、yも2倍、3倍になっています。y÷xはいつも7で、比例の関係です。');

miwakeTable('mw-t6', 'inv', [
  { xs: [4, 6, 9], ys: [9, 6, 4] },
  { xs: [1, 2, 3], ys: [8, 16, 24] },
  { xs: [1, 2, 3], ys: [10, 9, 7] },
  { xs: [5, 10, 15], ys: [2, 4, 6] }
], 'アの表は、x×yの値が 4×9、6×6、9×4 と、いつも36です。反比例の関係です。エの表は y÷x がいつも0.4の比例です。');

// 場面の選択肢から、目標の関係になっているものを選ぶ。
const SITUATIONS = {
  p1: { text: '1こ 50円のあめを xこ 買うときの 代金 y円', rel: 'prop' },
  p2: { text: '時速 4km で x時間 歩くときの 道のり y km', rel: 'prop' },
  p3: { text: '正方形の 1辺が x cm のときの 周りの長さ y cm', rel: 'prop' },
  p4: { text: '1分間に 3L ずつ水を入れるとき、x分後に入った 水の量 y L', rel: 'prop' },
  p5: { text: '1L のガソリンで 12km 走る車が、x L で走る 道のり y km', rel: 'prop' },
  p6: { text: '1m の重さが 0.5kg の針金 x m の 重さ y kg', rel: 'prop' },
  i1: { text: '面積が 24cm² で 一定の長方形の、横 x cm と 縦 y cm', rel: 'inv' },
  i2: { text: 'あめ 18こを x人で 同じ数ずつ分けるときの、1人分 yこ', rel: 'inv' },
  i3: { text: '120km の道のりを 時速 x km で進むときの 時間 y時間', rel: 'inv' },
  i4: { text: '96ページの本を 1日に xページずつ 読むときの 日数 y日', rel: 'inv' },
  i5: { text: '240L 入る水そうの水を 毎分 x L ずつ出すとき、出し終わるまでの 時間 y分', rel: 'inv' },
  n1: { text: 'x才の人の 身長 y cm', rel: 'none' },
  n2: { text: '1辺が x cm の正方形の 面積 y cm²', rel: 'none' },
  n3: { text: '500円を持って x円の買い物をしたときの 残り y円', rel: 'none' },
  n4: { text: '午前 x時の 気温 y℃', rel: 'none' }
};

function miwakeSituation(id, targetRel, keys, explain) {
  const options = keys.map((k) => SITUATIONS[k]);
  const answer = options.findIndex((o) => o.rel === targetRel);
  add({
    id, kind: 'miwake', rel: targetRel,
    prompt: `${REL_LABELS[targetRel]}の関係になっているのは、どれですか。`,
    choices: options.map((o) => ({
      label: o.text,
      note: o.rel === targetRel ? '' :
        o.rel === 'none' ? 'この場面は、xが2倍になってもyが2倍や半分にはなりません。'
          : `この場面は${REL_LABELS[o.rel]}の関係です。`
    })),
    answer, explain,
    params: { type: 'miwake-situation', targetRel, options: options.map((o) => ({ text: o.text, rel: o.rel })) }
  });
}

miwakeSituation('mw-s1', 'prop', ['i1', 'p1', 'n2', 'i3'],
  'あめの代金は、買う数が2倍になると代金も2倍になります。1こ分の値段が決まった数で、代金は数に比例します。');
miwakeSituation('mw-s2', 'prop', ['n1', 'i2', 'p4', 'n3'],
  '水の量は、時間が2倍になると入る量も2倍になります。1分間に3Lという決まった数があるので、比例の関係です。');
miwakeSituation('mw-s3', 'inv', ['p5', 'i4', 'n2', 'p3'],
  '本のページ数は96ページで決まっています。1日に読むページ数が2倍になると、日数は半分になります。x×yが決まった数になる反比例です。');
miwakeSituation('mw-s4', 'inv', ['i5', 'p6', 'n3', 'p2'],
  '水そうの水は全部で240Lです。毎分出す量が2倍になると、かかる時間は半分になります。反比例の関係です。');
miwakeSituation('mw-s5', 'prop', ['n3', 'p3', 'i1', 'n1'],
  '正方形の周りの長さは、1辺の4倍です。1辺が2倍になると周りの長さも2倍になるので、比例の関係です。');
miwakeSituation('mw-s6', 'inv', ['p1', 'n4', 'p4', 'i3'],
  '道のりは120kmで決まっています。速さが2倍になると、かかる時間は半分になります。x×yが決まった数になる反比例です。');

// ============ 表（16問） ============
// 空らんをうめる問題。blankRow の blankIdx が空らん。
function tableBlank(id, rel, a, xs, blankRow, blankIdx, distr, explain) {
  const ys = xs.map((x) => relValue(rel, a, x));
  const answerValue = blankRow === 'y' ? ys[blankIdx] : xs[blankIdx];
  const { choices, answer } = numChoices(answerValue, distr);
  add({
    id, kind: 'table', rel,
    prompt: blankRow === 'y'
      ? '表の空らんに入る数を選びましょう。'
      : '表の空らんに入る数（xの値）を選びましょう。',
    table: { xs, ys }, blank: { row: blankRow, index: blankIdx },
    choices, answer, explain,
    params: { type: 'table', rel, a, xs, ys, blankRow, blankIdx }
  });
}

// 決まった数を問う問題。
function tableConstant(id, rel, a, xs, distr, explain) {
  const ys = xs.map((x) => relValue(rel, a, x));
  const { choices, answer } = numChoices(a, distr);
  add({
    id, kind: 'table', rel,
    prompt: rel === 'prop'
      ? '表で、y÷x の値（決まった数）はいくつですか。'
      : '表で、x×y の値（決まった数）はいくつですか。',
    table: { xs, ys }, blank: null,
    choices, answer, explain,
    params: { type: 'table-constant', rel, a, xs, ys }
  });
}

const NOTE_PREV = 'それは、となり（xが1つ小さいとき）の値だよ。';
const NOTE_NEXT = 'それは、となり（xが1つ大きいとき）の値だよ。';

tableBlank('tb-p1', 'prop', 3, [1, 2, 3, 4, 5], 'y', 3,
  [{ v: 9, note: NOTE_PREV }, { v: 15, note: NOTE_NEXT }, { v: 7, note: '7は、4に3をたした数だね。比例では、xに決まった数をかけるよ。' }],
  'x＝4のときは、決まった数3をかけて、y＝3×4＝12 です。表でも、xが1ふえるとyが3ずつふえています。');
tableBlank('tb-p2', 'prop', 4, [1, 2, 3, 4, 5], 'y', 1,
  [{ v: 4, note: NOTE_PREV }, { v: 12, note: NOTE_NEXT }, { v: 6, note: '6は、2に4をたした数だね。比例では、xに決まった数をかけるよ。' }],
  'x＝2のときは、y＝4×2＝8 です。y÷xはいつも4になっています。');
tableBlank('tb-p3', 'prop', 6, [1, 2, 3, 4, 5], 'y', 4,
  [{ v: 24, note: NOTE_PREV }, { v: 36, note: NOTE_NEXT }, { v: 11, note: '11は、5に6をたした数だね。比例ではかけ算で考えるよ。' }],
  'x＝5のときは、y＝6×5＝30 です。xが5倍になると、yも5倍になっています。');
tableBlank('tb-p4', 'prop', 1.5, [2, 4, 6, 8, 10], 'y', 2,
  [{ v: 6, note: NOTE_PREV }, { v: 12, note: NOTE_NEXT }, { v: 7.5, note: '7.5は、6に1.5をたした数だね。比例ではかけ算で考えるよ。' }],
  '決まった数は1.5です。x＝6のときは、y＝1.5×6＝9 です。');
tableBlank('tb-p5', 'prop', 5, [1, 2, 3, 4, 5], 'x', 3,
  [{ v: 3, note: '3は、yが15のときのxだよ。' }, { v: 5, note: '5は、yが25のときのxだよ。' }, { v: 25, note: '25はyの値だね。聞かれているのはxの値だよ。' }],
  'y＝20のとき、20÷5＝4 で、x＝4 です。表の組を見ても、（4, 20）になっています。');
tableBlank('tb-p6', 'prop', 0.5, [2, 4, 6, 8, 10], 'y', 3,
  [{ v: 3, note: NOTE_PREV }, { v: 5, note: NOTE_NEXT }, { v: 16, note: '16は、8を2倍にした数だね。決まった数は0.5で、かけると半分になるよ。' }],
  '決まった数は0.5です。x＝8のときは、y＝0.5×8＝4 です。');
tableConstant('tb-p7', 'prop', 7, [1, 2, 3, 4],
  [{ v: 14, note: '14は、x＝2のときのyの値だね。決まった数は、y÷xで求めるよ。' }, { v: 4, note: '4は、xのいちばん大きい値だね。' }, { v: 28, note: '28は、yのいちばん大きい値だね。' }],
  'y÷xを計算すると、7÷1、14÷2、21÷3、28÷4 と、どれも7になります。これが比例の決まった数です。');
tableConstant('tb-p8', 'prop', 9, [1, 2, 3],
  [{ v: 18, note: '18は、x＝2のときのyの値だね。決まった数は、y÷xで求めるよ。' }, { v: 27, note: '27は、yのいちばん大きい値だね。' }, { v: 3, note: '3は、xのいちばん大きい値だね。' }],
  'y÷xは、9÷1、18÷2、27÷3 と、どれも9です。式にすると y＝9×x になります。');

tableBlank('tb-i1', 'inv', 24, [2, 3, 4, 6, 8], 'y', 2,
  [{ v: 8, note: '8は、x＝3のときのyだよ。' }, { v: 4, note: '4は、x＝6のときのyだよ。' }, { v: 12, note: '12は、x＝2のときのyだよ。' }],
  'x×yはいつも24です。x＝4のときは、y＝24÷4＝6 です。');
tableBlank('tb-i2', 'inv', 36, [3, 4, 6, 9, 12], 'y', 3,
  [{ v: 6, note: '6は、x＝6のときのyだよ。' }, { v: 3, note: '3は、x＝12のときのyだよ。' }, { v: 9, note: '9は、x＝4のときのyだよ。' }],
  'x×yはいつも36です。x＝9のときは、y＝36÷9＝4 です。');
tableBlank('tb-i3', 'inv', 60, [4, 5, 6, 10, 12], 'y', 2,
  [{ v: 12, note: '12は、x＝5のときのyだよ。' }, { v: 6, note: '6は、x＝10のときのyだよ。' }, { v: 15, note: '15は、x＝4のときのyだよ。' }],
  'x×yはいつも60です。x＝6のときは、y＝60÷6＝10 です。');
tableBlank('tb-i4', 'inv', 48, [4, 6, 8, 12, 16], 'y', 2,
  [{ v: 8, note: '8は、x＝6のときのyだよ。' }, { v: 4, note: '4は、x＝12のときのyだよ。' }, { v: 12, note: '12は、x＝4のときのyだよ。' }],
  'x×yはいつも48です。x＝8のときは、y＝48÷8＝6 です。xが2倍になると、yは半分になっています。');
tableBlank('tb-i5', 'inv', 30, [2, 3, 5, 6, 10], 'x', 3,
  [{ v: 5, note: '5は、yが6のときのxだよ。' }, { v: 10, note: '10は、yが3のときのxだよ。' }, { v: 3, note: '3は、yが10のときのxだよ。' }],
  'y＝5のとき、x×y＝30だから、x＝30÷5＝6 です。');
tableBlank('tb-i6', 'inv', 18, [2, 3, 6, 9], 'y', 2,
  [{ v: 6, note: '6は、x＝3のときのyだよ。' }, { v: 2, note: '2は、x＝9のときのyだよ。' }, { v: 9, note: '9は、x＝2のときのyだよ。' }],
  'x×yはいつも18です。x＝6のときは、y＝18÷6＝3 です。');
tableConstant('tb-i7', 'inv', 40, [4, 5, 8, 10],
  [{ v: 14, note: '14は、xとyをたした数（4＋10）だね。反比例の決まった数は、x×yで求めるよ。' }, { v: 50, note: '50は、表にはない数だね。組ごとにx×yを計算してみよう。' }, { v: 32, note: '32は、表にはない数だね。組ごとにx×yを計算してみよう。' }],
  'x×yを計算すると、4×10、5×8、8×5、10×4 と、どれも40になります。これが反比例の決まった数です。');
tableConstant('tb-i8', 'inv', 72, [6, 8, 9, 12],
  [{ v: 18, note: '18は、xとyをたした数（6＋12）だね。反比例ではx×yが決まった数になるよ。' }, { v: 96, note: '96は、表にはない数だね。組ごとにx×yを計算してみよう。' }, { v: 64, note: '64は、表にはない数だね。組ごとにx×yを計算してみよう。' }],
  'x×yは、6×12、8×9、9×8、12×6 と、どれも72です。式にすると y＝72÷x になります。');

// ============ 式（12問） ============
function formulaChoose(id, rel, a, xs, wrongFns, explain) {
  const ys = xs.map((x) => relValue(rel, a, x));
  const correct = formulaOf(rel, a);
  const all = [correct, ...wrongFns];
  add({
    id, kind: 'formula', rel,
    prompt: '表の関係を式に表すと、どれですか。',
    table: { xs, ys }, blank: null,
    choices: all.map((fn) => ({
      label: formulaLabel(fn), fn,
      note: fn === correct ? '' : 'この式に表のxを入れても、表のyにはなりません。表の組で確かめてみよう。'
    })),
    answer: 0, explain,
    params: { type: 'formula-choose', rel, a, xs, ys, fns: all }
  });
}

formulaChoose('fm-p1', 'prop', 3, [1, 2, 3],
  [{ op: 'xDiv', k: 3 }, { op: 'divX', k: 3 }, { op: 'add', k: 3 }],
  'y÷xはいつも3なので、決まった数は3です。比例の式は y＝3×x です。x＝2を入れると6になり、表と合います。');
formulaChoose('fm-p2', 'prop', 5, [1, 2, 3],
  [{ op: 'divX', k: 5 }, { op: 'xDiv', k: 5 }, { op: 'add', k: 5 }],
  'y÷xはいつも5です。比例の式は y＝5×x です。');
formulaChoose('fm-p3', 'prop', 0.5, [2, 4, 6],
  [{ op: 'mul', k: 2 }, { op: 'divX', k: 50 }, { op: 'add', k: 0.5 }],
  'y÷xは、1÷2、2÷4、3÷6 と、いつも0.5です。比例の式は y＝0.5×x です。');
formulaChoose('fm-p4', 'prop', 8, [1, 2, 3],
  [{ op: 'divX', k: 8 }, { op: 'xDiv', k: 8 }, { op: 'add', k: 8 }],
  'y÷xはいつも8です。比例の式は y＝8×x です。');
formulaChoose('fm-i1', 'inv', 24, [2, 3, 4],
  [{ op: 'mul', k: 24 }, { op: 'xDiv', k: 24 }, { op: 'sub', k: 24 }],
  'x×yはいつも24です。反比例の式は、決まった数をxでわって y＝24÷x です。x＝3を入れると8になり、表と合います。');
formulaChoose('fm-i2', 'inv', 36, [3, 4, 6],
  [{ op: 'mul', k: 36 }, { op: 'xDiv', k: 36 }, { op: 'sub', k: 36 }],
  'x×yはいつも36です。反比例の式は y＝36÷x です。');
formulaChoose('fm-i3', 'inv', 12, [2, 3, 4],
  [{ op: 'mul', k: 12 }, { op: 'add', k: 12 }, { op: 'xDiv', k: 12 }],
  'x×yはいつも12です。反比例の式は y＝12÷x です。');
formulaChoose('fm-i4', 'inv', 100, [4, 5, 10],
  [{ op: 'mul', k: 100 }, { op: 'sub', k: 100 }, { op: 'xDiv', k: 100 }],
  'x×yは、4×25、5×20、10×10 と、いつも100です。反比例の式は y＝100÷x です。');

function formulaValue(id, rel, a, x0, distr, explain) {
  const ans = relValue(rel, a, x0);
  const { choices, answer } = numChoices(ans, distr);
  add({
    id, kind: 'formula', rel,
    prompt: `式は ${formulaLabel(formulaOf(rel, a))} です。x＝${fmt(x0)} のとき、yはいくつですか。`,
    choices, answer, explain,
    params: { type: 'value', rel, a, x0 }
  });
}

formulaValue('fm-p5', 'prop', 4, 7,
  [{ v: 11, note: '11は、4と7をたした数だね。式ではかけるよ。' }, { v: 24, note: '24は、x＝6のときのyだよ。' }, { v: 32, note: '32は、x＝8のときのyだよ。' }],
  'y＝4×x に x＝7 を入れると、y＝4×7＝28 です。');
formulaValue('fm-p6', 'prop', 6, 9,
  [{ v: 15, note: '15は、6と9をたした数だね。式ではかけるよ。' }, { v: 48, note: '48は、x＝8のときのyだよ。' }, { v: 60, note: '60は、x＝10のときのyだよ。' }],
  'y＝6×9＝54 です。');
formulaValue('fm-i5', 'inv', 48, 8,
  [{ v: 40, note: '40は、48から8をひいた数だね。式ではわるよ。' }, { v: 8, note: '8はxの値だね。yを求めよう。' }, { v: 12, note: '12は、48÷4の答えだね。x＝8でわろう。' }],
  'y＝48÷x に x＝8 を入れると、y＝48÷8＝6 です。');
formulaValue('fm-i6', 'inv', 90, 10,
  [{ v: 80, note: '80は、90から10をひいた数だね。式ではわるよ。' }, { v: 10, note: '10はxの値だね。yを求めよう。' }, { v: 18, note: '18は、90÷5の答えだね。x＝10でわろう。' }],
  'y＝90÷10＝9 です。');

// ============ グラフ（16問） ============
// グラフの読み取り。ask: {axis:'x', v} は「x=v のとき yは？」、{axis:'y', v} は「y=v のとき xは？」
function graphReadQ(id, rel, a, view, ask, distr, explain) {
  let ans;
  if (ask.axis === 'x') ans = relValue(rel, a, ask.v);
  else ans = rel === 'prop' ? ask.v / a : a / ask.v;
  const { choices, answer } = numChoices(ans, distr);
  const mark = ask.axis === 'x' ? { x: ask.v, y: ans } : { x: ans, y: ask.v };
  add({
    id, kind: 'graph', rel,
    prompt: ask.axis === 'x'
      ? `グラフで、x＝${fmt(ask.v)} のときの yはいくつですか。`
      : `グラフで、y＝${fmt(ask.v)} のときの xはいくつですか。`,
    graph: { spec: graphSpecOf(rel, a), ...view, mark },
    choices, answer, explain,
    params: { type: 'graph-read', rel, a, ask }
  });
}

graphReadQ('gr-p1', 'prop', 2, { xmax: 6, ymax: 12, gx: 1, gy: 2 }, { axis: 'x', v: 4 },
  [{ v: 6, note: '6は、x＝3のときのyだよ。' }, { v: 10, note: '10は、x＝5のときのyだよ。' }, { v: 4, note: '4はxの値だね。yを読み取ろう。' }],
  'グラフは原点を通る直線です。x＝4の目盛りから点までたどると、y＝8 です。式にすると y＝2×x で、2×4＝8 と合います。');
graphReadQ('gr-p2', 'prop', 3, { xmax: 5, ymax: 15, gx: 1, gy: 3 }, { axis: 'y', v: 12 },
  [{ v: 3, note: '3のとき、yは9だよ。' }, { v: 5, note: '5のとき、yは15だよ。' }, { v: 12, note: '12はyの値だね。xを求めよう。' }],
  'y＝12の目盛りから直線の点までたどると、x＝4 です。式 y＝3×x でも、3×4＝12 と合います。');
graphReadQ('gr-p3', 'prop', 0.5, { xmax: 10, ymax: 5, gx: 1, gy: 1 }, { axis: 'x', v: 6 },
  [{ v: 2, note: '2は、x＝4のときのyだよ。' }, { v: 4, note: '4は、x＝8のときのyだよ。' }, { v: 12, note: '12は、6を2倍にした数だね。この比例の決まった数は0.5だよ。' }],
  '決まった数は0.5です。x＝6のとき、y＝0.5×6＝3 です。グラフの点（6, 3）を確かめよう。');
graphReadQ('gr-p4', 'prop', 4, { xmax: 4, ymax: 16, gx: 1, gy: 4 }, { axis: 'x', v: 3 },
  [{ v: 8, note: '8は、x＝2のときのyだよ。' }, { v: 16, note: '16は、x＝4のときのyだよ。' }, { v: 7, note: '7は、4と3をたした数だね。比例ではかけるよ。' }],
  '決まった数は4です。x＝3のとき、y＝4×3＝12 です。');
graphReadQ('gr-i1', 'inv', 12, { xmax: 12, ymax: 12, gx: 1, gy: 1 }, { axis: 'x', v: 3 },
  [{ v: 3, note: '3は、x＝4のときのyだよ。' }, { v: 6, note: '6は、x＝2のときのyだよ。' }, { v: 9, note: '9は、12から3をひいた数だね。反比例では、決まった数をxでわるよ。' }],
  'グラフは曲線です。x×yはいつも12で、x＝3のとき、y＝12÷3＝4 です。点（3, 4）を確かめよう。');
graphReadQ('gr-i2', 'inv', 24, { xmax: 12, ymax: 12, gx: 2, gy: 2 }, { axis: 'y', v: 4 },
  [{ v: 8, note: '8は、y＝3のときのxだよ。' }, { v: 3, note: '3は、y＝8のときのxだよ。' }, { v: 20, note: '20は、24から4をひいた数だね。反比例ではわり算で考えるよ。' }],
  'x×yはいつも24です。y＝4のとき、x＝24÷4＝6 です。');
graphReadQ('gr-i3', 'inv', 20, { xmax: 10, ymax: 10, gx: 1, gy: 1 }, { axis: 'x', v: 5 },
  [{ v: 5, note: '5は、x＝4のときのyだよ。' }, { v: 2, note: '2は、x＝10のときのyだよ。' }, { v: 25, note: '25は、20に5をたした数だね。反比例では、決まった数をxでわるよ。' }],
  'x×yはいつも20で、x＝5のとき、y＝20÷5＝4 です。');
graphReadQ('gr-i4', 'inv', 36, { xmax: 12, ymax: 12, gx: 2, gy: 2 }, { axis: 'y', v: 6 },
  [{ v: 4, note: '4は、y＝9のときのxだよ。' }, { v: 9, note: '9は、y＝4のときのxだよ。' }, { v: 30, note: '30は、36から6をひいた数だね。反比例ではわり算で考えるよ。' }],
  'x×yはいつも36です。y＝6のとき、x＝36÷6＝6 です。点（6, 6）を確かめよう。');

// 表に合うグラフを選ぶ問題。正解のグラフだけが表の全点を通る。
function graphChoose(id, rel, a, points, wrongSpecs, view, explain) {
  const correct = graphSpecOf(rel, a);
  const specs = [correct, ...wrongSpecs];
  add({
    id, kind: 'graph', rel,
    prompt: '表の関係を表すグラフは、どれですか。',
    table: { xs: points.map((p) => p[0]), ys: points.map((p) => p[1]) }, blank: null,
    graphOptions: specs,
    graphView: view,
    choices: specs.map((s) => ({
      label: '', graph: s,
      note: s === correct ? '' : 'このグラフは、表の点のどれかを通っていません。表の組を1つずつ当てはめてみよう。'
    })),
    answer: 0, explain,
    params: { type: 'graph-choose', rel, a, points, specs }
  });
}

graphChoose('gc-p1', 'prop', 2, [[1, 2], [2, 4], [3, 6], [4, 8]],
  [{ t: 'line', m: 3, b: 0 }, { t: 'line', m: 2, b: 2 }, { t: 'curve', a: 8 }],
  { xmax: 5, ymax: 10, gx: 1, gy: 2 },
  '比例のグラフは原点を通る直線です。点（1, 2）、（2, 4）を通るのは、決まった数2の直線だけです。');
graphChoose('gc-p2', 'prop', 3, [[1, 3], [2, 6], [3, 9]],
  [{ t: 'line', m: 2, b: 0 }, { t: 'curve', a: 9 }, { t: 'line', m: 3, b: 3 }],
  { xmax: 4, ymax: 12, gx: 1, gy: 3 },
  '原点を通り、点（1, 3）を通る直線が正解です。（0, 3）から始まる直線は比例ではありません。');
graphChoose('gc-p3', 'prop', 1.5, [[2, 3], [4, 6], [6, 9]],
  [{ t: 'line', m: 3, b: 0 }, { t: 'line', m: 1.5, b: 1.5 }, { t: 'curve', a: 18 }],
  { xmax: 8, ymax: 12, gx: 2, gy: 3 },
  '決まった数は 3÷2＝1.5 です。原点を通って点（2, 3）、（4, 6）を通る直線が正解です。');
graphChoose('gc-p4', 'prop', 5, [[1, 5], [2, 10], [3, 15]],
  [{ t: 'line', m: 5, b: 5 }, { t: 'curve', a: 15 }, { t: 'line', m: 3, b: 0 }],
  { xmax: 4, ymax: 20, gx: 1, gy: 5 },
  '比例のグラフは必ず原点を通ります。点（1, 5）を通る、決まった数5の直線が正解です。');
graphChoose('gc-i1', 'inv', 12, [[2, 6], [3, 4], [4, 3]],
  [{ t: 'curve', a: 24 }, { t: 'line', m: -2, b: 10 }, { t: 'line', m: 3, b: 0 }],
  { xmax: 8, ymax: 8, gx: 1, gy: 1 },
  '反比例のグラフは曲線です。点（2, 6）、（3, 4）、（4, 3）のどれも x×y＝12 になっています。');
graphChoose('gc-i2', 'inv', 18, [[2, 9], [3, 6], [6, 3]],
  [{ t: 'curve', a: 12 }, { t: 'line', m: -1, b: 11 }, { t: 'line', m: 4.5, b: 0 }],
  { xmax: 9, ymax: 9, gx: 1, gy: 1 },
  'x×yがいつも18になる曲線が正解です。直線は、点のどれかを通りません。');
graphChoose('gc-i3', 'inv', 24, [[3, 8], [4, 6], [6, 4]],
  [{ t: 'line', m: -1, b: 11 }, { t: 'curve', a: 48 }, { t: 'line', m: 2, b: 0 }],
  { xmax: 12, ymax: 12, gx: 2, gy: 2 },
  '点（3, 8）、（4, 6）、（6, 4）は、どれも x×y＝24 です。この点を通る曲線が正解です。');
graphChoose('gc-i4', 'inv', 30, [[3, 10], [5, 6], [6, 5]],
  [{ t: 'curve', a: 60 }, { t: 'line', m: -2, b: 16 }, { t: 'line', m: 3, b: 0 }],
  { xmax: 10, ymax: 10, gx: 1, gy: 1 },
  'x×yがいつも30になる曲線が正解です。点（5, 6）も（6, 5）も通るのは、この曲線だけです。');

// ============ 文章題（16問） ============
function wordQ(id, rel, a, x0, prompt, unit, distr, explain) {
  const ans = relValue(rel, a, x0);
  const { choices, answer } = numChoices(ans, distr);
  add({
    id, kind: 'word', rel,
    prompt: `${prompt}（答えの単位は ${unit}）`,
    choices, answer, explain,
    params: { type: 'value', rel, a, x0 }
  });
}

wordQ('wd-p1', 'prop', 70, 8,
  'あめは 1こ 70円です。8こ買うと、代金は何円ですか。', '円',
  [{ v: 78, note: '78は、70と8をたした数だね。代金はかけ算で求めるよ。' }, { v: 490, note: '490は、7こ分の代金だね。8こ分を計算しよう。' }, { v: 630, note: '630は、9こ分の代金だね。' }],
  '代金は買う数に比例します。式は y＝70×x で、70×8＝560円 です。');
wordQ('wd-p2', 'prop', 6, 4,
  '時速 6km で歩き続けます。4時間では、何km進みますか。', 'km',
  [{ v: 10, note: '10は、6と4をたした数だね。道のりはかけ算だよ。' }, { v: 18, note: '18は、3時間分の道のりだね。' }, { v: 30, note: '30は、5時間分の道のりだね。' }],
  '道のりは時間に比例します。6×4＝24km です。');
wordQ('wd-p3', 'prop', 0.4, 15,
  '針金は 1m で 0.4kg です。15m では、何kgですか。', 'kg',
  [{ v: 60, note: '60は、4×15の答えだね。0.4は4より小さい数だから、答えも小さくなるよ。' }, { v: 3, note: '3は、0.2×15の答えだね。1mで0.4kgだよ。' }, { v: 15.4, note: '15.4は、15と0.4をたした数だね。重さはかけ算だよ。' }],
  '重さは長さに比例します。0.4×15＝6kg です。');
wordQ('wd-p4', 'prop', 4, 13,
  '水道から、1分間に 4L の水が出ます。13分では、何L出ますか。', 'L',
  [{ v: 17, note: '17は、4と13をたした数だね。水の量はかけ算だよ。' }, { v: 48, note: '48は、12分分の量だね。' }, { v: 56, note: '56は、14分分の量だね。' }],
  '水の量は時間に比例します。4×13＝52L です。');
wordQ('wd-p5', 'prop', 15, 9,
  '車は、ガソリン 1L で 15km 走ります。9L では、何km走りますか。', 'km',
  [{ v: 24, note: '24は、15と9をたした数だね。道のりはかけ算だよ。' }, { v: 120, note: '120は、8L分の道のりだね。' }, { v: 150, note: '150は、10L分の道のりだね。' }],
  '道のりはガソリンの量に比例します。15×9＝135km です。');
wordQ('wd-p6', 'prop', 25, 8,
  '印刷機は、1分間に 25まい印刷します。8分では、何まい印刷しますか。', 'まい',
  [{ v: 33, note: '33は、25と8をたした数だね。まいの数はかけ算だよ。' }, { v: 175, note: '175は、7分分の数だね。' }, { v: 225, note: '225は、9分分の数だね。' }],
  'まいの数は時間に比例します。25×8＝200まい です。');
wordQ('wd-p7', 'prop', 120, 7,
  'ジュースは 1本 120円で、x本買うと y円です。式は y＝120×x です。7本では、何円ですか。', '円',
  [{ v: 127, note: '127は、120と7をたした数だね。式ではかけるよ。' }, { v: 720, note: '720は、6本分の代金だね。' }, { v: 960, note: '960は、8本分の代金だね。' }],
  '式に x＝7 を入れると、120×7＝840円 です。');
wordQ('wd-p8', 'prop', 150, 7,
  'リボンは 3m で 450円です。同じリボン 7m では、何円ですか。', '円',
  [{ v: 750, note: '750は、5m分の値段だね。まず1m分の値段を求めよう。' }, { v: 900, note: '900は、6m分の値段だね。' }, { v: 1350, note: '1350は、450×3の答えだね。3m分の値段を3倍しても、7m分にはならないよ。' }],
  '1m分は 450÷3＝150円です。値段は長さに比例するので、150×7＝1050円 です。');

wordQ('wd-i1', 'inv', 42, 7,
  '面積が 42cm² の長方形があります。横が 7cm のとき、縦は何cmですか。', 'cm',
  [{ v: 35, note: '35は、42から7をひいた数だね。面積は、横×縦で求めるよ。' }, { v: 8, note: '8だと、7×8＝56で、面積が42にならないよ。' }, { v: 294, note: '294は、42×7の答えだね。面積が決まっているときは、わり算で考えるよ。' }],
  '横×縦＝42 の反比例です。縦は 42÷7＝6cm です。');
wordQ('wd-i2', 'inv', 180, 12,
  '180ページの本を、1日に 12ページずつ読みます。読み終わるまで、何日かかりますか。', '日',
  [{ v: 12, note: '12は、1日に読むページ数だね。日数を求めよう。' }, { v: 168, note: '168は、180から12をひいた数だね。日数はわり算だよ。' }, { v: 20, note: '20日だと、12×20＝240ページ分になってしまうよ。' }],
  'ページ数×日数ではなく、（1日のページ数）×（日数）＝180 です。180÷12＝15日 です。');
wordQ('wd-i3', 'inv', 150, 50,
  '150km の道のりを、時速 50km で進みます。何時間かかりますか。', '時間',
  [{ v: 100, note: '100は、150から50をひいた数だね。時間は、道のり÷速さだよ。' }, { v: 2, note: '2時間だと、50×2＝100kmしか進めないよ。' }, { v: 4, note: '4時間だと、50×4＝200km進んでしまうよ。' }],
  '速さ×時間＝150 の反比例です。150÷50＝3時間 です。');
wordQ('wd-i4', 'inv', 54, 9,
  'あめ 54こを、9人で同じ数ずつ分けます。1人分は何こですか。', 'こ',
  [{ v: 45, note: '45は、54から9をひいた数だね。分けるときはわり算だよ。' }, { v: 63, note: '63は、54と9をたした数だね。' }, { v: 8, note: '8こずつだと、9×8＝72こ必要になってしまうよ。' }],
  '人数×1人分＝54 の反比例です。54÷9＝6こ です。');
wordQ('wd-i5', 'inv', 300, 15,
  '300L の水が入った水そうから、毎分 15L ずつ水を出します。空になるまで、何分かかりますか。', '分',
  [{ v: 285, note: '285は、300から15をひいた数だね。時間はわり算だよ。' }, { v: 15, note: '15は、1分に出す量だね。時間を求めよう。' }, { v: 25, note: '25分だと、15×25＝375L分になってしまうよ。' }],
  '（毎分の量）×（時間）＝300 の反比例です。300÷15＝20分 です。');
wordQ('wd-i6', 'inv', 48, 12,
  'ある仕事は、8人ですると 6日かかります。同じ仕事を 12人ですると、何日かかりますか。', '日',
  [{ v: 6, note: '6日は、8人のときの日数だね。人がふえると日数はへるよ。' }, { v: 9, note: '9は、比例と考えて 6×12÷8 をした答えだね。人がふえると日数はへるので、反比例で考えよう。' }, { v: 2, note: '2日だと、12×2＝24で、仕事の量48に足りないよ。' }],
  '仕事の量は 8×6＝48（人日）です。人数×日数＝48 の反比例なので、48÷12＝4日 です。');
wordQ('wd-i7', 'inv', 96, 12,
  '面積が 96cm² の長方形があります。横が 12cm のとき、縦は何cmですか。', 'cm',
  [{ v: 84, note: '84は、96から12をひいた数だね。面積は、横×縦だよ。' }, { v: 108, note: '108は、96と12をたした数だね。' }, { v: 6, note: '6だと、12×6＝72で、面積が96にならないよ。' }],
  '横×縦＝96 の反比例です。縦は 96÷12＝8cm です。');
wordQ('wd-i8', 'inv', 1600, 100,
  '家から公園まで、分速 80m で歩くと 20分かかります。分速 100m で歩くと、何分かかりますか。', '分',
  [{ v: 20, note: '20分は、分速80mのときの時間だね。速くなると、時間は短くなるよ。' }, { v: 25, note: '25は、比例と考えて 20×100÷80 をした答えだね。速さと時間は反比例だよ。' }, { v: 12, note: '12分だと、100×12＝1200mで、道のり1600mに足りないよ。' }],
  '道のりは 80×20＝1600m です。速さ×時間＝1600 の反比例なので、1600÷100＝16分 です。');

export const QUESTIONS = BANK;
export const QUESTION_BY_ID = new Map(BANK.map((q) => [q.id, q]));
