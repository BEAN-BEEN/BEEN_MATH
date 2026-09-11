// 📓 강의 일지 — 오늘 나간 진도가 진도표(선생님·학생)에 그대로 뜬다
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };
// 비동기 테스트는 큐에 쌓아 맨 끝에서 하나씩 돈다 — 같이 돌면 setup()이 서로의 상태를 덮어쓴다
const Q = [];
const okA = (name, fn) => { Q.push(async () => { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } }); };

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
  const writes = [];
  const docRef = (col, id) => ({
    set: async (d) => { writes.push({ col, id, d }); },
    delete: async () => { writes.push({ col, id, del: true }); },
    get: async () => ({ exists: false })
  });
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
  sb.__els = els; sb.__err = err; sb.__writes = writes;
  sb.__db = { collection: (col) => ({ doc: (id) => docRef(col, id) }) };
  sb.showToast = () => {};
  return sb;
}

const T = load('teacher.html');
const S = load('student.html');
T.__set('db', T.__db);

const mon = T.mondayOf('');
const d = k => T.addDays(mon, k);       // 이번 주 월요일 + k일

function setup(logs, plans) {
  T.__set('PROGLOG_CACHE', logs || []);
  T.__set('CURRICULUM_CACHE', plans || []);
  T.__set('CLASSES', [
    { id: 'c1', name: '고1T A1', days: ['mon', 'wed'] },
    { id: 'c2', name: '고1T A2', days: ['tue'] }
  ]);
}

console.log('\n한 주 동안 나간 진도');
ok('그 주 기록만 날짜순으로 모은다', () => {
  setup([
    { id: 'c1_' + d(2), classId: 'c1', date: d(2), content: '집합의 연산' },
    { id: 'c1_' + d(0), classId: 'c1', date: d(0), content: '집합의 포함관계' },
    { id: 'c1_' + d(-7), classId: 'c1', date: d(-7), content: '지난주 것' },
    { id: 'c2_' + d(1), classId: 'c2', date: d(1), content: '다른 반' }
  ]);
  const logs = T.progLogsOfWeek('c1', mon);
  assert.strictEqual(logs.map(l => l.content).join(','), '집합의 포함관계,집합의 연산');
});
ok('비어 있는 기록은 뺀다', () => {
  setup([{ id: 'x', classId: 'c1', date: d(0), content: '', comment: '' }]);
  assert.strictEqual(T.progLogsOfWeek('c1', mon).length, 0);
});
ok('메모만 있어도 기록으로 친다', () => {
  setup([{ id: 'x', classId: 'c1', date: d(0), content: '', comment: '3명 결석' }]);
  assert.strictEqual(T.progLogsOfWeek('c1', mon).length, 1);
});

console.log('\n강의 일지 저장');
okA('나간 진도를 progressLog.content 에 저장한다', async () => {
  setup([]);
  T.dashDay = () => d(0);
  T.__writes.length = 0;
  await T.doSaveClassProg('c1', '  집합의 연산 p.40~52  ');
  const w = T.__writes.find(x => x.col === 'progressLog');
  assert.ok(w, '저장이 안 됨');
  assert.strictEqual(w.id, 'c1_' + d(0));
  assert.strictEqual(w.d.content, '집합의 연산 p.40~52', '앞뒤 공백이 안 지워짐');
  assert.strictEqual(w.d.classId, 'c1');
  assert.strictEqual(w.d.date, d(0));
});
okA('저장하면 캐시에도 바로 반영돼 진도표가 바로 보인다', async () => {
  setup([]);
  T.dashDay = () => d(0);
  await T.doSaveClassProg('c1', '명제');
  assert.strictEqual(T.progLogsOfWeek('c1', mon).map(l => l.content).join(','), '명제');
});
okA('메모는 건드리지 않는다 (merge)', async () => {
  setup([{ id: 'c1_' + d(0), classId: 'c1', date: d(0), content: '', comment: '3명 결석' }]);
  T.dashDay = () => d(0);
  T.__writes.length = 0;
  await T.doSaveClassProg('c1', '명제');
  const w = T.__writes.find(x => x.col === 'progressLog');
  assert.ok(!('comment' in w.d), '메모까지 덮어씀');
  const cached = T.__get('PROGLOG_CACHE').find(p => p.id === 'c1_' + d(0));
  assert.strictEqual(cached.comment, '3명 결석', '캐시의 메모가 사라짐');
});
okA('지난 날짜를 보고 있으면 그 날짜에 저장된다', async () => {
  setup([]);
  T.dashDay = () => d(-5);
  T.__writes.length = 0;
  await T.doSaveClassProg('c1', '지난 수업');
  assert.strictEqual(T.__writes[0].id, 'c1_' + d(-5));
});
okA('계획대로 버튼 — 이번 주 계획을 그대로 적는다', async () => {
  setup([], [{ id: 'c1_' + mon, classId: 'c1', weekStart: mon, content: '집합 전체' }]);
  T.dashDay = () => d(0);
  T.rDashboard = () => {};
  T.__writes.length = 0;
  await T.doProgFromPlan('c1');
  assert.strictEqual(T.__writes[0].d.content, '집합 전체');
});
okA('계획이 없으면 아무것도 저장하지 않는다', async () => {
  setup([], []);
  T.dashDay = () => d(0);
  T.__writes.length = 0;
  await T.doProgFromPlan('c1');
  assert.strictEqual(T.__writes.length, 0);
});

console.log('\n진도표에 뜬다');
ok('진도표 칸 아래에 실제 진도가 붙는다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
  assert.ok(html.indexOf('const logs=progLogsOfWeek(c.id,ws);') >= 0, '진도표가 일지를 안 읽음');
  assert.ok(html.indexOf('✓ ${mdLabel(l.date)}') >= 0, '진도표에 일지가 안 그려짐');
});
ok('대시보드 칸이 거짓말을 안 한다', () => {
  // 예전 문구: '오늘 수업 메모 (진도표에도 저장돼요)' — 저장만 되고 진도표엔 안 떴다
  const html = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
  assert.ok(html.indexOf('오늘 수업 메모 (진도표에도 저장돼요)') < 0, '거짓 안내가 남아 있음');
  assert.ok(html.indexOf("doSaveClassProg('${c.id}',this.value)") >= 0, '나간 진도 칸이 없음');
});

console.log('\n강의 일지 목록');
ok('보고 있는 반의 최근 기록이 최신순으로 나온다', () => {
  setup([
    { id: 'a', classId: 'c1', className: '고1T A1', date: d(0), content: '집합의 연산' },
    { id: 'b', classId: 'c1', className: '고1T A1', date: d(-7), content: '집합의 포함관계', comment: '진도 빠름' },
    { id: 'c', classId: 'c2', className: '고1T A2', date: d(1), content: '다른 반 진도' }
  ]);
  T.__set('journalWeeks', 4);
  const h = T.journalListHtml([{ id: 'c1', name: '고1T A1', days: [] }]);
  assert.ok(h.indexOf('집합의 연산') >= 0 && h.indexOf('집합의 포함관계') >= 0);
  assert.ok(h.indexOf('다른 반 진도') < 0, '안 고른 반까지 나옴');
  assert.ok(h.indexOf('진도 빠름') >= 0, '메모가 안 나옴');
  assert.ok(h.indexOf('집합의 연산') < h.indexOf('집합의 포함관계'), '최신순이 아님');
});
ok('기간 밖 기록은 안 나온다', () => {
  setup([{ id: 'a', classId: 'c1', className: '고1T A1', date: d(-70), content: '아주 옛날' }]);
  T.__set('journalWeeks', 4);
  const h = T.journalListHtml([{ id: 'c1', name: '고1T A1', days: [] }]);
  assert.ok(h.indexOf('아주 옛날') < 0);
});
ok('수업은 있었는데 일지가 빈 날을 짚어준다', () => {
  setup([]);
  T.__set('journalWeeks', 2);
  T.isClassActive = () => true;
  // 반 요일은 weekdays 배열로 저장된다 (clsDays 참고)
  const h = T.journalListHtml([{ id: 'c1', name: '고1T A1', weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }]);
  assert.ok(h.indexOf('일지가 빈 날') >= 0, '빠진 날 안내가 없음');
});
ok('반을 안 골랐으면 목록이 없다', () => {
  assert.strictEqual(T.journalListHtml([]), '');
});
ok('진도에 태그가 있어도 안 샌다', () => {
  setup([{ id: 'a', classId: 'c1', className: '고1T A1', date: d(0), content: '<img src=x>' }]);
  const h = T.journalListHtml([{ id: 'c1', name: '고1T A1', days: [] }]);
  assert.ok(h.indexOf('<img src=x>') < 0);
});

console.log('\n학생도 본다');
ok('학생 진도표가 실제 진도를 읽는다', () => {
  S.__set('S_PROGLOG', [
    { classId: 'c1', date: d(0), content: '집합의 포함관계' },
    { classId: 'c1', date: d(2), content: '집합의 연산' },
    { classId: 'c1', date: d(-7), content: '지난주' }
  ]);
  const logs = S.sProgOfWeek('c1', mon);
  assert.strictEqual(logs.map(l => l.content).join(','), '집합의 포함관계,집합의 연산');
});
ok('학생 쪽 불러오기는 내 반 것만 받는다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');
  assert.ok(html.indexOf("where('classId','in',chunk)") >= 0, '전체 컬렉션을 받고 있음');
});
ok('학생 홈 카드가 실제 진도를 먼저 보여준다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');
  assert.ok(html.indexOf("'📓 이번 주 나간 진도'") >= 0);
  assert.ok(html.indexOf("'📓 지난 주 나간 진도'") >= 0);
});
ok('선생님·학생이 같은 주 기준으로 모은다', () => {
  const logs = [
    { id: 'a', classId: 'c1', date: d(0), content: 'A' },
    { id: 'b', classId: 'c1', date: d(6), content: 'B' },     // 일요일 — 같은 주
    { id: 'c', classId: 'c1', date: d(7), content: 'C' }      // 다음 주 월요일
  ];
  setup(logs);
  S.__set('S_PROGLOG', logs);
  assert.strictEqual(T.progLogsOfWeek('c1', mon).map(l => l.content).join(','),
    S.sProgOfWeek('c1', mon).map(l => l.content).join(','));
  assert.strictEqual(T.progLogsOfWeek('c1', mon).map(l => l.content).join(','), 'A,B');
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});
ok('student.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(S.__err, null, S.__err && S.__err.message);
});

(async () => {
  console.log('\n강의 일지 저장 (비동기)');
  for (const t of Q) await t();
  console.log('\n' + pass + '개 통과');
})();
