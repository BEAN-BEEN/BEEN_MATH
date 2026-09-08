// 숙제 관리 — 이번 주 / 지난 주 / 지지난 주 탭 + 고른 보기 방식 기억하기
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

// localStorage를 진짜처럼 흉내낸다 (기억하기를 확인하려면 값이 남아야 한다)
function makeStore() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _raw: m };
}

function load(store) {
  const html = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
  const out = []; let i = 0;
  for (;;) {
    const s = html.indexOf('<script', i); if (s < 0) break;
    const gt = html.indexOf('>', s), head = html.slice(s, gt), e = html.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(html.slice(gt + 1, e));
    i = e + 9;
  }
  const src = out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';
  const els = {};
  const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '' }; return els[id]; };
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({}), body: {} },
    localStorage: store || makeStore(),
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  let err = null;
  try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) { err = e; }
  sb.__els = els; sb.__err = err;
  sb.showToast = () => {};
  return sb;
}

const T = load();

// 오늘 기준 상대 날짜
const ymd = (o) => {
  const d = new Date(); d.setDate(d.getDate() + o);
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const A = (id, startDate) => ({ id, classId: 'c1', className: '고1T A1', title: id, startDate, dueDate: '' });

console.log('\n주 경계');
ok('weekMonday(0)이 이번 주 월요일', () => {
  const m = T.weekMonday(0);
  const d = new Date(m + 'T00:00:00');
  assert.strictEqual(d.getDay(), 1, m + ' 이 월요일이 아님');
  assert.strictEqual(m, T.thisMonday());
});
ok('한 주씩 정확히 7일 차이', () => {
  const a = new Date(T.weekMonday(0) + 'T00:00:00');
  const b = new Date(T.weekMonday(-1) + 'T00:00:00');
  const c = new Date(T.weekMonday(-2) + 'T00:00:00');
  assert.strictEqual(Math.round((a - b) / 86400000), 7);
  assert.strictEqual(Math.round((b - c) / 86400000), 7);
});

console.log('\n몇 주 전 숙제인가');
ok('이번 주 월요일 것은 0', () => {
  assert.strictEqual(T.hwWeekAgo(A('a', T.weekMonday(0))), 0);
});
ok('지난 주 월요일 것은 1', () => {
  assert.strictEqual(T.hwWeekAgo(A('a', T.weekMonday(-1))), 1);
});
ok('지지난 주 것은 2', () => {
  assert.strictEqual(T.hwWeekAgo(A('a', T.weekMonday(-2))), 2);
});
ok('그보다 오래된 건 3', () => {
  assert.strictEqual(T.hwWeekAgo(A('a', T.weekMonday(-3))), 3);
  assert.strictEqual(T.hwWeekAgo(A('a', '2020-01-01')), 3);
});
ok('주 경계 하루 차이를 정확히 가른다', () => {
  const mon = T.weekMonday(0);
  const sun = new Date(mon + 'T00:00:00'); sun.setDate(sun.getDate() - 1);
  const p = x => String(x).padStart(2, '0');
  const sunStr = `${sun.getFullYear()}-${p(sun.getMonth() + 1)}-${p(sun.getDate())}`;
  assert.strictEqual(T.hwWeekAgo(A('a', mon)), 0, '월요일이 이번 주가 아님');
  assert.strictEqual(T.hwWeekAgo(A('a', sunStr)), 1, '전날 일요일이 지난 주가 아님');
});
ok('날짜가 아예 없으면 오래된 것으로 본다', () => {
  assert.strictEqual(T.hwWeekAgo({ id: 'x' }), 3);
});
ok('출제일이 없으면 등록일을 쓴다', () => {
  assert.strictEqual(T.hwWeekAgo({ id: 'x', createdAt: T.weekMonday(0) }), 0);
});
ok('마감일이 이번 주여도 지난 주에 낸 숙제는 지난 주', () => {
  // 마감일로 재면 한 숙제가 두 주에 걸쳐 양쪽 탭에 나온다
  assert.strictEqual(T.hwWeekAgo({ id: 'x', startDate: T.weekMonday(-1), dueDate: ymd(2) }), 1);
});

console.log('\n탭으로 거르기');
const week0 = A('이번주', T.weekMonday(0));
const week1 = A('지난주', T.weekMonday(-1));
const week2 = A('지지난주', T.weekMonday(-2));
const old = A('예전', T.weekMonday(-8));
const all = [week0, week1, week2, old];

ok('이번 주 탭은 이번 주 것만', () => {
  T.__set('hwPeriod', 'week');
  assert.strictEqual(T.hwPeriodFilter(all).map(a => a.id).join(','), '이번주');
});
ok('지난 주 탭은 지난 주 것만', () => {
  T.__set('hwPeriod', 'last');
  assert.strictEqual(T.hwPeriodFilter(all).map(a => a.id).join(','), '지난주');
});
ok('지지난 주 탭은 지지난 주 것만', () => {
  T.__set('hwPeriod', 'last2');
  assert.strictEqual(T.hwPeriodFilter(all).map(a => a.id).join(','), '지지난주');
});
ok('그 이전 탭은 3주 이상 지난 걸 다 모은다', () => {
  T.__set('hwPeriod', 'old');
  assert.strictEqual(T.hwPeriodFilter(all).map(a => a.id).join(','), '예전');
});
ok('전체 탭은 다 보여준다', () => {
  T.__set('hwPeriod', 'all');
  assert.strictEqual(T.hwPeriodFilter(all).length, 4);
});
ok('어느 탭에도 안 걸치는 숙제가 없다', () => {
  const seen = new Set();
  ['week', 'last', 'last2', 'old'].forEach(v => {
    T.__set('hwPeriod', v);
    T.hwPeriodFilter(all).forEach(a => seen.add(a.id));
  });
  assert.strictEqual(seen.size, all.length, '탭 사이로 빠진 숙제가 있음');
});
ok('두 탭에 겹쳐 나오는 숙제가 없다', () => {
  const count = {};
  ['week', 'last', 'last2', 'old'].forEach(v => {
    T.__set('hwPeriod', v);
    T.hwPeriodFilter(all).forEach(a => { count[a.id] = (count[a.id] || 0) + 1; });
  });
  Object.keys(count).forEach(k => assert.strictEqual(count[k], 1, k + '이 ' + count[k] + '개 탭에 나옴'));
});

console.log('\n탭 개수 표시');
ok('탭마다 몇 개인지 센다', () => {
  assert.strictEqual(T.hwPeriodCount(all, 0), 1);
  assert.strictEqual(T.hwPeriodCount(all, 1), 1);
  assert.strictEqual(T.hwPeriodCount(all, 2), 1);
  assert.strictEqual(T.hwPeriodCount(all, null), 4);
});
ok('탭 목록이 이번 주·지난 주·지지난 주를 담고 있다', () => {
  const periods = T.__get('HW_PERIODS');       // const는 window에 안 붙는다
  assert.strictEqual(periods.map(x => x[0]).join(','), 'week,last,last2,old,all');
  assert.ok(periods[1][1].indexOf('지난 주') >= 0, periods[1][1]);
  assert.ok(periods[2][1].indexOf('지지난 주') >= 0, periods[2][1]);
});

console.log('\n고른 방식을 기억한다');
ok('탭을 고르면 저장된다', () => {
  T.rHomework = () => {};
  T.hwSetPeriod('last');
  const saved = JSON.parse(T.window.localStorage.getItem('bm_hwPref'));
  assert.strictEqual(saved.period, 'last');
});
ok('묶음을 고르면 저장된다', () => {
  T.rHomework = () => {};
  T.hwSetGroup('class');
  const saved = JSON.parse(T.window.localStorage.getItem('bm_hwPref'));
  assert.strictEqual(saved.groupBy, 'class');
});
ok('다시 들어와도 그대로 (지난 주 · 반별)', () => {
  const store = makeStore();
  store.setItem('bm_hwPref', JSON.stringify({ period: 'last2', groupBy: 'class' }));
  const T2 = load(store);
  assert.strictEqual(T2.__get('hwPeriod'), 'last2', '탭이 안 살아남음');
  assert.strictEqual(T2.__get('hwGroupBy'), 'class', '묶음이 안 살아남음');
});
ok('처음 쓰는 사람은 이번 주 · 날짜순', () => {
  const T2 = load(makeStore());
  assert.strictEqual(T2.__get('hwPeriod'), 'week');
  assert.strictEqual(T2.__get('hwGroupBy'), 'date');
});
ok('저장된 값이 이상하면 무시한다', () => {
  const store = makeStore();
  store.setItem('bm_hwPref', JSON.stringify({ period: '이상한값', groupBy: 'xxx' }));
  const T2 = load(store);
  assert.strictEqual(T2.__get('hwPeriod'), 'week');
  assert.strictEqual(T2.__get('hwGroupBy'), 'date');
});
ok('예전 past 값이 남아 있어도 안 깨진다', () => {
  const store = makeStore();
  store.setItem('bm_hwPref', JSON.stringify({ period: 'past', groupBy: 'date' }));
  const T2 = load(store);
  assert.strictEqual(T2.__get('hwPeriod'), 'week', 'past가 그대로 들어감');
});
ok('저장된 게 깨진 글자여도 안 깨진다', () => {
  const store = makeStore();
  store.setItem('bm_hwPref', '{{{');
  const T2 = load(store);
  assert.strictEqual(T2.__get('hwPeriod'), 'week');
});
ok('localStorage를 못 써도 안 깨진다 (사파리 시크릿 등)', () => {
  const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} };
  const T2 = load(bad);
  assert.strictEqual(T2.__err, null, T2.__err && T2.__err.message);
  assert.strictEqual(T2.__get('hwPeriod'), 'week');
  T2.rHomework = () => {};
  T2.hwSetPeriod('last');           // 저장이 막혀도 화면은 바뀌어야 한다
  assert.strictEqual(T2.__get('hwPeriod'), 'last');
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});

console.log('\n' + pass + '개 통과');
