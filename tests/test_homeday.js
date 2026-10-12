// 학생 첫 화면 — 요일 탭으로 그날 수업의 숙제·교재·진도 · 성적 추이(내신 순서 / 모의고사 달)
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

function load(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
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
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  let err = null;
  try { vm.runInContext(src, sb, { filename: file }); } catch (e) { err = e; }
  sb.__els = els; sb.__err = err;
  sb.showToast = () => {};
  return sb;
}

const S = load('student.html');
const get = n => S.__get(n), set = (n, v) => S.__set(n, v);
const TODAY = S.bmToday();
const plus = n => { const d = new Date(TODAY + 'T00:00:00'); d.setDate(d.getDate() + n); const p = v => String(v).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const WD = ds => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(ds + 'T00:00:00').getDay()];
const bal = (h, tag) => (h.split('<' + tag).length - 1) === (h.split('</' + tag + '>').length - 1);
const D0 = WD(TODAY), D2 = WD(plus(2)), D4 = WD(plus(4));

// 한 반이 세 요일(오늘 · 이틀 뒤 · 나흘 뒤)에 수업한다 — 화·목·토 같은 반
const ASG = [
  { id: 'a1', classId: 'c1', title: '오늘 검사 숙제', textbook: '쎈', dueDate: TODAY, startDate: plus(-2), status: 'pending' },
  { id: 'a2', classId: 'c1', title: '이틀 뒤 검사 숙제', textbook: '올림포스', dueDate: plus(2), startDate: TODAY, status: 'pending' },
  { id: 'a3', classId: 'c1', title: '지난번 낸 숙제', textbook: '쎈', dueDate: plus(-7), startDate: plus(-9), status: 'submitted' }
];
function setup(classes) {
  set('S_CLASSES', classes);
  set('S_CURRICULUM', []); set('S_PROGLOG', [
    { classId: 'c1', date: TODAY, content: '원의 방정식' },
    { classId: 'c1', date: plus(-7), content: '직선의 방정식' }
  ]);
  set('HOME_DAY', '');
  S.getAssignments = () => ASG;
  S.asnInSeasonS = () => true; S.studentSelSeason = () => null;
  S.renderHome = () => {};
}
const pend = () => ASG.filter(a => a.status === 'pending');

console.log('\n요일 탭');
ok('수업 요일이 탭으로 뜨고 오늘 요일이 먼저 열린다', () => {
  setup([{ id: 'c1', name: '고1T A1', weekdays: [D0, D2, D4] }]);
  assert.strictEqual(S.homeDays().length, 3);
  assert.strictEqual(S.homeDayNow(), D0);
  const h = S.homeDayTabsHtml();
  assert.ok(h.includes("homeDayPick('" + D2 + "')") && h.includes("homeDayPick('all')") && h.includes('오늘'));
  assert.ok(bal(h, 'div') && bal(h, 'button'));
});
ok('오늘 수업이 없으면 다가오는 수업 요일이 열린다', () => {
  setup([{ id: 'c1', name: '고1T A1', weekdays: [D2, D4] }]);
  assert.strictEqual(S.homeDayNow(), D2);
});
ok('요일이 하나뿐이면 탭이 없다', () => {
  setup([{ id: 'c1', name: '고1T A1', weekdays: [D0] }]);
  assert.strictEqual(S.homeDayTabsHtml(), '');
  assert.strictEqual(S.homeDayNow(), 'all');
});
ok('요일을 누르면 그날 검사하는 숙제만 보인다', () => {
  setup([{ id: 'c1', name: '고1T A1', weekdays: [D0, D2, D4] }]);
  let h = S.classHomeCardsHtml(pend());
  assert.ok(h.includes('오늘 검사 숙제') && !h.includes('이틀 뒤 검사 숙제'));
  S.homeDayPick(D2);
  h = S.classHomeCardsHtml(pend());
  assert.ok(!h.includes('오늘 검사 숙제') && h.includes('이틀 뒤 검사 숙제'));
  S.homeDayPick('all');
  h = S.classHomeCardsHtml(pend());
  assert.ok(h.includes('오늘 검사 숙제') && h.includes('이틀 뒤 검사 숙제'));
});
ok('그 수업의 교재와 이번 주·지난 주 진도가 같이 보인다', () => {
  setup([{ id: 'c1', name: '고1T A1', weekdays: [D0, D2, D4] }]);
  const h = S.classHomeCardsHtml(pend());
  assert.ok(h.includes('교재') && h.includes('쎈'), '교재가 없음');
  assert.ok(h.includes('원의 방정식'), '이번 주 진도가 없음');
  assert.ok(h.includes('직선의 방정식'), '지난 주 진도가 없음');
  assert.ok(h.includes('낸 숙제 1개'));
  assert.ok(bal(h, 'div') && bal(h, 'button') && bal(h, 'span'));
});
ok('반이 요일마다 따로면 그 요일 반만 보인다', () => {
  setup([{ id: 'c1', name: '고1T A1', weekdays: [D0] }, { id: 'c2', name: '고1S B1', weekdays: [D2] }]);
  let h = S.classHomeCardsHtml(pend());
  assert.ok(h.includes('고1T A1') && !h.includes('고1S B1'));
  assert.ok(h.includes('이틀 뒤 검사 숙제'), '요일이 하나인 반은 그 반 숙제를 다 보여야 함');
  S.homeDayPick(D2);
  h = S.classHomeCardsHtml(pend());
  assert.ok(!h.includes('고1T A1') && h.includes('고1S B1'));
});

console.log('\n성적 추이 — 내신은 본 순서, 모의고사는 달');
ok('내신: 1학기 중간 → 1학기 기말 → 2학기 중간', () => {
  const tl = S.naesinTimeline([
    { subject: '공통수학2', term: '중간', score: '88점', grade: '2' },
    { subject: '공통수학1', term: '기말', score: '75' },
    { subject: '공통수학1', term: '중간', score: '62.5' },
    { subject: '공통수학1', term: '1학기합산', score: '70' },
    { subject: '공통수학2', term: '기말', score: '' }
  ]);
  assert.strictEqual(tl.map(p => p.label + '=' + p.v).join(' / '), '1학기 중간=62.5 / 1학기 기말=75 / 2학기 중간=88');
});
ok('두 포털이 같은 순서를 쓴다', () => {
  const t = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8'), s = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');
  const cutFn = x => { const a = x.indexOf('const NAESIN_ORDER='); return x.slice(a, x.indexOf('}', x.indexOf('function naesinTimeline', a) + 600)); };
  assert.ok(cutFn(t).length > 200);
  assert.strictEqual(cutFn(t).split('\r').join(''), cutFn(s).split('\r').join(''));
});
ok('학생 성적 카드가 펼쳐져 있고 모의고사는 달로 적힌다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');
  assert.ok(html.includes('<details open style="background:var(--surface)'));
  assert.ok(html.includes("(+m.date.slice(5,7))+'월'"));
  assert.ok(html.includes('1학기 중간 → 1학기 기말 → 2학기 중간 순서'));
});

console.log('\n' + pass + ' passed');
