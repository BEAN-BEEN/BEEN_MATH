// 오늘 수업 화면 — 이름 누르면 학생 정보 · 그날 직보 · 보충 온 학생 · 위쪽 바로가기
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

const T = load('teacher.html');
const get = n => T.__get(n), set = (n, v) => T.__set(n, v);
const TODAY = T.bmToday();
const plus = n => { const d = new Date(TODAY + 'T00:00:00'); d.setDate(d.getDate() + n); const p = v => String(v).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const bal = (h, tag) => (h.split('<' + tag).length - 1) === (h.split('</' + tag + '>').length - 1);

set('CLASSES', [{ id: 'c1', name: '고1T A1', role: '담임' }]);
set('STUDENTS_CACHE', [
  { id: 's1', name: '김하나', school: '백운고', classIds: ['c1'], classNames: ['고1T A1'], status: '재원', memo: '계산 실수 잦음' },
  { id: 's2', name: '이두리', school: '양명고', classIds: ['c1'], classNames: ['고1T A1'], status: '재원' },
  { id: 's3', name: '박세나', school: '', classIds: ['c1'], classNames: ['고1T A1'], status: '재원' }
]);
set('SCHOOLEXAMS_CACHE', [
  { id: 'old', school: '백운고', title: '1학기 기말고사', startDate: plus(-90), endDate: plus(-86), mathDate: plus(-88), scope: '옛 범위' },
  { id: 'x1', school: '백운고', title: '2학기 중간고사', startDate: plus(9), endDate: plus(13), mathDates: [{ label: '공통수학2', date: plus(10) }],
    scope: '도형의 방정식 ~ 원의 방정식', subMaterial: '올림포스', teacherMaterial: '학교 프린트 1~4', textbook: '' },
  { id: 'x2', school: '양명고', title: '2학기 중간고사', startDate: plus(40), endDate: plus(44), mathDate: plus(41), scope: '' }
]);
set('SCHOOLBOOKS_CACHE', { '백운고': { publisher: '미래엔', subjects: ['공통수학1', '공통수학2'], subMaterial: '', note: '' } });
set('MAKEUPS_CACHE', [
  { id: 'm1', date: TODAY, time: '17:00', school: '백운고', className: '백운고 직보', attendees: ['s1'] },
  { id: 'm2', date: plus(3), time: '14:00', school: '백운고', className: '백운고 직보' }
]);
set('BOGANG_CACHE', []);
set('dashDateStr', null);
const S1 = get('STUDENTS_CACHE')[0], S2 = get('STUDENTS_CACHE')[1], S3 = get('STUDENTS_CACHE')[2];

console.log('\n이름을 누르면 — 학교·교과서·범위·보충 교재');
ok('다가오는 시험을 고른다 (지난 시험이 아니라)', () => {
  assert.strictEqual(T.stuExam(S1).id, 'x1');
  assert.strictEqual(T.stuMathDday(S1).days, 10);
});
ok('교과서는 이번 시험 과목의 출판사', () => {
  const x = T.stuInfo(S1);
  assert.strictEqual(x.textbook, '미래엔 공통수학2');
  assert.strictEqual(x.scope, '도형의 방정식 ~ 원의 방정식');
});
ok('보충 교재 = 부교재 + 학교 프린트', () => {
  const x = T.stuInfo(S1);
  assert.strictEqual(x.subMaterial, '올림포스');
  assert.strictEqual(x.schoolPrint, '학교 프린트 1~4');
  const h = T.stuInfoHtml(S1);
  assert.ok(h.indexOf('보충 교재') >= 0 && h.indexOf('부교재') >= 0 && h.indexOf('학교 프린트') >= 0);
  assert.ok(h.indexOf('올림포스') >= 0 && h.indexOf('D-10') >= 0 && h.indexOf('계산 실수 잦음') >= 0);
});
ok('직보는 그 학교 것만', () => {
  assert.strictEqual(T.stuInfo(S1).jikbo.length, 2);
  assert.strictEqual(T.stuInfo(S2).jikbo.length, 0);
});
ok('학교가 없거나 안 적은 값은 빈칸으로 안내', () => {
  const h = T.stuInfoHtml(S3);
  assert.ok(h.indexOf('학교 미입력') >= 0 && h.indexOf('아직 안 적었어요') >= 0);
  assert.ok(bal(h, 'div') && bal(h, 'span') && bal(h, 'button'));
  assert.ok(bal(T.stuInfoHtml(S1), 'div') && bal(T.stuInfoHtml(S1), 'span'));
});
ok('명단 이름 옆 — 시험이 4주 안일 때만 D-day', () => {
  assert.ok(T.stuTagHtml(S1).indexOf('D-10') >= 0 && T.stuTagHtml(S1).indexOf('백운') >= 0);
  assert.ok(T.stuTagHtml(S2).indexOf('D-') < 0 && T.stuTagHtml(S2).indexOf('양명') >= 0);
});

console.log('\n대시보드 — 그날 직보 · 보충 온 학생');
ok('오늘 직보가 학교별로 뜬다', () => {
  const h = T.dashJikboHtml();
  assert.ok(h.indexOf('17:00') >= 0 && h.indexOf('백운') >= 0 && h.indexOf('김하나') >= 0);
  assert.ok(h.indexOf('이두리') < 0, '다른 학교 학생이 섞임');
  assert.ok(h.indexOf("doDashJikboCame('m1','s1')") >= 0 && h.indexOf("openStuInfo('s1')") >= 0);
  assert.ok(bal(h, 'div') && bal(h, 'button') && bal(h, 'span'));
});
ok('직보가 없는 날은 칸이 없다', () => {
  set('dashDateStr', plus(1));
  assert.strictEqual(T.dashJikboHtml(), '');
  set('dashDateStr', null);
});
ok('보충 — 아무도 없으면 추가 칸만', () => {
  const h = T.dashBogangHtml();
  assert.ok(h.indexOf('보충 온 학생') >= 0 && h.indexOf("doDashBogangAdd('',this.value)") >= 0);
  assert.ok(h.indexOf('김하나') >= 0);
  assert.ok(bal(h, 'div') && bal(h, 'select'));
});
ok('보충 — 온 학생과 한 일이 줄로 뜨고, 이미 넣은 학생은 고르는 칸에서 빠진다', () => {
  set('BOGANG_CACHE', [{ id: 'b1', date: TODAY, label: '보충', attendees: ['s2'], notes: { s2: '오답 "정리"' } }]);
  const h = T.dashBogangHtml();
  assert.ok(h.indexOf("openStuInfo('s2')") >= 0 && h.indexOf('오답 &quot;정리&quot;') >= 0);
  assert.ok(h.indexOf('<option value="s2">') < 0 && h.indexOf('<option value="s1">') >= 0);
  assert.ok(h.indexOf("doDashBogangRemove('b1','s2')") >= 0);
  assert.ok(bal(h, 'div') && bal(h, 'button') && bal(h, 'select'));
});

console.log('\n이름을 누르면 — 성적 추이 · 숙제 완성도 그래프');
ok('학원 시험을 본 순서대로, 만점 대비 %로', () => {
  set('EXAMS_CACHE', [
    { id: 'e1', title: '1회', date: plus(-30), maxScore: 100, classId: 'c1', analysis: [{ no: '1', answer: '1' }, { no: '2', answer: '2' }] },
    { id: 'e2', title: '2회', date: plus(-10), maxScore: 100, classId: 'c1', analysis: [{ no: '1', answer: '1' }, { no: '2', answer: '2' }] }
  ]);
  set('EXAMSUBS_CACHE', [
    { id: 'x2', examId: 'e2', studentId: 's1', answers: { 1: '1', 2: '2' } },
    { id: 'x1', examId: 'e1', studentId: 's1', answers: { 1: '1', 2: '9' } },
    { id: 'x3', examId: 'e1', studentId: 's2', answers: { 1: '1', 2: '2' } }
  ]);
  set('MOCKEXAMS_CACHE', [{ id: 'm9', title: '10월 학평', date: plus(-5), maxScore: 100 }]);
  set('MOCKSUBS_CACHE', [{ id: 'k1', mockId: 'm9', studentId: 's1', score: 72, grade: '3' }]);
  const sc = T.stuScoreSeries(S1);
  assert.strictEqual(sc.exams.map(p => p.title + ':' + p.pct).join(','), '1회:50,2회:100');
  assert.strictEqual(sc.mocks.map(p => p.pct).join(','), '72');
});
ok('숙제는 마감 전·안 낸 것을 빼고, 안 낸 건 0', () => {
  set('ASSIGNMENTS_CACHE', [
    { id: 'a1', classId: 'c1', title: '쎈1', startDate: plus(-14), dueDate: plus(-7) },
    { id: 'a2', classId: 'c1', title: '쎈2', startDate: plus(-7), dueDate: plus(-1) },
    { id: 'a3', classId: 'c1', title: '쎈3', startDate: plus(-1), dueDate: plus(6) }
  ]);
  set('SUBMISSIONS_CACHE', [{ id: 'u1', assignmentId: 'a1', studentId: 's1', evalPct: '90' }]);
  assert.strictEqual(T.stuHwSeries(S1).map(p => p.pct).join(','), '90,0');
});
ok('창에 그래프 두 개가 그려진다', () => {
  const h = T.stuInfoHtml(S1);
  assert.ok(h.includes('성적 추이') && h.includes('숙제 완성도'));
  assert.ok(h.includes('<polyline') && h.includes('<rect'), '선·막대가 없음');
  assert.ok(h.includes('▲50'), '지난번보다 오른 표시가 없음');
  assert.ok(bal(h, 'div') && bal(h, 'svg') && bal(h, 'g') && bal(h, 'span'));
});
ok('기록이 없으면 그래프 대신 안내', () => {
  const h = T.stuInfoHtml(S3);
  assert.ok(h.includes('아직 넣은 내신 성적이 없어요') && h.includes('아직 본 모의고사가 없어요') && bal(h, 'div'));
});

console.log('\n디자인 고르기');
ok('깔끔 / 레트로를 바꿔 볼 수 있다', () => {
  T.document.documentElement = { style: {}, a: {}, setAttribute(k, v) { this.a[k] = v; }, removeAttribute(k) { delete this.a[k]; } };
  T.skinApply('retro');
  assert.strictEqual(T.document.documentElement.a['data-skin'], 'retro');
  assert.ok(T.__els.skinPick.innerHTML.includes("skinSet('clean')"));
  T.skinApply('clean');
  assert.strictEqual(T.document.documentElement.a['data-skin'], undefined);
  assert.strictEqual(T.skinNow(), 'clean');
});

console.log('\n위쪽 바로가기');
ok('메뉴마다 짧은 이름이 있다', () => {
  assert.ok(get('NAV').every(n => n.short && n.short.length <= 8));
});

console.log('\n' + pass + ' passed');
