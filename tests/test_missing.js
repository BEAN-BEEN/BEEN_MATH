// 숙제 미제출 — 대시보드에서 바로 보고 바로 독촉
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
  const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '', textContent: '' }; return els[id]; };
  const copied = [];
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node', clipboard: { writeText: (t) => { copied.push(t); return Promise.resolve(); } } },
    alert: () => {}, confirm: () => true, prompt: (a, t) => { copied.push(t); return ''; },
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  let err = null;
  try { vm.runInContext(src, sb, { filename: file }); } catch (e) { err = e; }
  sb.__els = els; sb.__err = err; sb.__copied = copied;
  return sb;
}

const T = load('teacher.html');
T.showToast = () => {};

// 날짜 헬퍼 — 오늘 기준으로 상대 날짜를 만든다 (테스트가 달력에 안 묶이게)
const ymd = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const monday = () => T.thisMonday();

function setup(assignments, subs, students) {
  T.__set('ASSIGNMENTS_CACHE', assignments);
  T.__set('SUBMISSIONS_CACHE', subs || []);
  T.__set('STUDENTS_CACHE', students || []);
  T.__set('CLASSES', [{ id: 'c1', name: '고1T A1' }, { id: 'c2', name: '고1T A2' }]);
}
const ST = (id, name, classId) => ({ id, name, classId, status: '재원' });
const A = (id, classId, title, startDate, dueDate) =>
  ({ id, classId, className: classId === 'c1' ? '고1T A1' : '고1T A2', title, startDate, dueDate });

console.log('\n미제출 목록');
ok('아무도 안 냈으면 전원이 미제출', () => {
  setup([A('a1', 'c1', '쎈 3단원', ymd(-1), ymd(2))],
    [], [ST('s1', '김민서', 'c1'), ST('s2', '이서준', 'c1')]);
  const list = T.hwMissingList();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].missing.map(s => s.name).join(','), '김민서,이서준');
});
ok('낸 학생은 빠진다', () => {
  setup([A('a1', 'c1', '쎈 3단원', ymd(-1), ymd(2))],
    [{ assignmentId: 'a1', studentId: 's1' }],
    [ST('s1', '김민서', 'c1'), ST('s2', '이서준', 'c1')]);
  const list = T.hwMissingList();
  assert.strictEqual(list[0].missing.map(s => s.name).join(','), '이서준');
});
ok('다 냈으면 목록에 안 나온다', () => {
  setup([A('a1', 'c1', '쎈 3단원', ymd(-1), ymd(2))],
    [{ assignmentId: 'a1', studentId: 's1' }, { assignmentId: 'a1', studentId: 's2' }],
    [ST('s1', '김민서', 'c1'), ST('s2', '이서준', 'c1')]);
  assert.strictEqual(T.hwMissingList().length, 0);
  assert.strictEqual(T.hwMissingCount(), 0);
});
ok('다른 반 학생은 안 센다', () => {
  setup([A('a1', 'c1', '쎈 3단원', ymd(-1), ymd(2))],
    [], [ST('s1', '김민서', 'c1'), ST('s9', '박다른', 'c2')]);
  assert.strictEqual(T.hwMissingList()[0].missing.map(s => s.name).join(','), '김민서');
});
ok('퇴원한 학생은 안 센다', () => {
  const out = ST('s2', '이서준', 'c1'); out.status = '퇴원';
  setup([A('a1', 'c1', '쎈 3단원', ymd(-1), ymd(2))], [], [ST('s1', '김민서', 'c1'), out]);
  assert.strictEqual(T.hwMissingList()[0].missing.map(s => s.name).join(','), '김민서');
});

console.log('\n마감 지난 것이 사라지지 않는다');
ok('지난주에 낸 미제출은 계속 보인다', () => {
  // 예전에는 hwInWeek(이번 주)만 봐서, 제일 급한 게 월요일이면 조용히 사라졌다
  setup([A('old', 'c1', '지난주 숙제', T.weekMonday(-1), ymd(-2))],
    [], [ST('s1', '김민서', 'c1')]);
  const list = T.hwMissingList();
  assert.strictEqual(list.length, 1, '지난주 숙제가 사라짐');
  assert.strictEqual(list[0].overdue, true);
});
ok('지지난 주보다 오래된 건 안 보인다', () => {
  // 전 기간을 다 보여주면 90건이 넘어서 오늘 챙길 것을 못 찾는다
  setup([A('ancient', 'c1', '한 달 전 숙제', T.weekMonday(-5), T.weekMonday(-4))],
    [], [ST('s1', '김민서', 'c1')]);
  assert.strictEqual(T.hwMissingList().length, 0, '너무 오래된 게 그대로 남음');
});
ok('지난주 월요일이 경계 — 그날 낸 건 보인다', () => {
  setup([
    A('inRange', 'c1', '지난주 월요일', T.weekMonday(-1), ymd(-1)),
    A('outRange', 'c1', '지지난주 월요일', T.weekMonday(-2), ymd(-8))
  ], [], [ST('s1', '김민서', 'c1')]);
  assert.strictEqual(T.hwMissingList().map(x => x.a.id).join(','), 'inRange');
});
ok('마감 지난 것이 맨 위로 온다', () => {
  setup([
    A('soon', 'c1', '이번 주 숙제', ymd(0), ymd(3)),
    A('over', 'c1', '지난 숙제', ymd(-10), ymd(-2))
  ], [], [ST('s1', '김민서', 'c1')]);
  const list = T.hwMissingList();
  assert.strictEqual(list[0].a.id, 'over', '마감 지난 게 위로 안 옴');
  assert.strictEqual(list[1].a.id, 'soon');
});
ok('마감이 가까운 순으로 정렬된다', () => {
  setup([
    A('late', 'c1', '나중', ymd(0), ymd(5)),
    A('early', 'c1', '먼저', ymd(0), ymd(1))
  ], [], [ST('s1', '김민서', 'c1')]);
  const list = T.hwMissingList();
  assert.strictEqual(list[0].a.id, 'early');
});
ok('아직 안 시작한 다음 주 숙제는 안 나온다', () => {
  setup([A('next', 'c1', '다음 주', ymd(20), ymd(27))], [], [ST('s1', '김민서', 'c1')]);
  // 이번 주도 아니고 마감도 안 지났으므로 목록 밖
  assert.strictEqual(T.hwMissingList().length, 0);
});

console.log('\n인원 수');
ok('숙제가 여러 개면 사람 수를 다 더한다', () => {
  setup([
    A('a1', 'c1', '숙제1', ymd(-1), ymd(2)),
    A('a2', 'c2', '숙제2', ymd(-1), ymd(2))
  ], [], [ST('s1', '김민서', 'c1'), ST('s2', '이서준', 'c1'), ST('s3', '박지후', 'c2')]);
  assert.strictEqual(T.hwMissingCount(), 3);
});

console.log('\n카톡에 붙여넣을 명단');
ok('반·과제·마감·이름이 한 덩어리로 나온다', () => {
  setup([A('a1', 'c1', '쎈 3단원', ymd(-1), ymd(2))],
    [], [ST('s1', '김민서', 'c1'), ST('s2', '이서준', 'c1')]);
  const t = T.hwMissingText(T.hwMissingList()[0]);
  assert.ok(t.indexOf('고1T A1') >= 0, '반이 없음');
  assert.ok(t.indexOf('쎈 3단원') >= 0, '과제명이 없음');
  assert.ok(t.indexOf('김민서, 이서준') >= 0, '이름이 없음: ' + t);
  assert.ok(t.indexOf('\n') >= 0, '줄바꿈이 없음');
});
ok('마감이 지났으면 그렇게 적힌다', () => {
  setup([A('a1', 'c1', '쎈 3단원', ymd(-10), ymd(-2))], [], [ST('s1', '김민서', 'c1')]);
  assert.ok(T.hwMissingText(T.hwMissingList()[0]).indexOf('지남') >= 0);
});
ok('전체 복사는 모든 숙제를 담는다', () => {
  setup([
    A('a1', 'c1', '숙제1', ymd(-1), ymd(2)),
    A('a2', 'c2', '숙제2', ymd(-1), ymd(2))
  ], [], [ST('s1', '김민서', 'c1'), ST('s3', '박지후', 'c2')]);
  T.__copied.length = 0;
  T.copyMissing(-1);
  assert.strictEqual(T.__copied.length, 1, '복사가 안 됨');
  assert.ok(T.__copied[0].indexOf('숙제1') >= 0 && T.__copied[0].indexOf('숙제2') >= 0, T.__copied[0]);
});
ok('하나만 복사하면 그 숙제만', () => {
  setup([
    A('a1', 'c1', '숙제1', ymd(-1), ymd(2)),
    A('a2', 'c2', '숙제2', ymd(-1), ymd(3))
  ], [], [ST('s1', '김민서', 'c1'), ST('s3', '박지후', 'c2')]);
  T.__copied.length = 0;
  T.copyMissing(0);
  assert.ok(T.__copied[0].indexOf('숙제1') >= 0);
  assert.ok(T.__copied[0].indexOf('숙제2') < 0, '다른 숙제까지 들어감');
});
ok('미제출이 없으면 복사할 게 없다고 알린다', () => {
  setup([], [], []);
  T.__copied.length = 0;
  T.copyMissing(-1);
  assert.strictEqual(T.__copied.length, 0);
});

console.log('\n대시보드 카드');
ok('미제출이 있으면 이름과 버튼이 보인다', () => {
  setup([A('a1', 'c1', '쎈 3단원', ymd(-10), ymd(-2))],
    [], [ST('s1', '김민서', 'c1'), ST('s2', '이서준', 'c1')]);
  const h = T.dashMissingHtml();
  assert.ok(h.indexOf('김민서') >= 0 && h.indexOf('이서준') >= 0, '이름이 없음');
  assert.ok(h.indexOf('마감 지남') >= 0, '마감 지남 표시가 없음');
  assert.ok(h.indexOf('copyMissing') >= 0, '복사 버튼이 없음');
  assert.ok(h.indexOf('doRemind') >= 0, '독촉 버튼이 없음');
  assert.ok(h.indexOf('2명') >= 0, '인원 수가 없음');
});
ok('미제출이 없으면 초록 카드', () => {
  setup([], [], []);
  const h = T.dashMissingHtml();
  assert.ok(h.indexOf('미제출 없음') >= 0, h.slice(0, 120));
});
ok('학생 이름이 HTML로 새지 않는다', () => {
  setup([A('a1', 'c1', '쎈', ymd(-1), ymd(2))], [], [ST('s1', '<img src=x onerror=1>', 'c1')]);
  const h = T.dashMissingHtml();
  assert.ok(h.indexOf('<img src=x') < 0, '이름이 그대로 들어감');
  assert.ok(h.indexOf('&lt;img') >= 0, '이스케이프가 안 됨');
});

console.log('\n숙제 관리 보드도 같은 목록');
ok('보드가 기본으로 펼쳐져 있다', () => {
  assert.strictEqual(T.__get('hwBoardOpen'), true);
});
ok('보드도 마감 지난 것을 보여준다', () => {
  setup([A('old', 'c1', '지난주 숙제', T.weekMonday(-1), ymd(-2))], [], [ST('s1', '김민서', 'c1')]);
  const h = T.hwMissingBoardHtml();
  assert.ok(h.indexOf('지난주 숙제') >= 0, '지난 숙제가 안 보임');
  assert.ok(h.indexOf('김민서') >= 0);
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});

console.log('\n' + pass + '개 통과');
