// 시즌 · 개별 숙제 — 새 시즌에 들어가면 지난 밀린 숙제가 학생 첫 화면에 쌓이면 안 된다.
//   그리고 개별 숙제는 고른 학생에게만 가야 한다(선생님 명단과 학생 화면이 같은 기준).
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const ROOT = require('path').join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

function load(file) {
  const html = fs.readFileSync(ROOT + '/' + file, 'utf8');
  const out = []; let i = 0;
  for (;;) {
    const s = html.indexOf('<script', i); if (s < 0) break;
    const gt = html.indexOf('>', s), head = html.slice(s, gt), e = html.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(html.slice(gt + 1, e));
    i = e + 9;
  }
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) },
    requireRole: () => {}, bmAuthReady: Promise.resolve(), showToast: () => {},
    db: { collection: () => ({ get: async () => ({ docs: [] }), doc: () => ({}), add: async () => ({}) }) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  try { vm.runInContext(out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");', sb, { filename: file }); } catch (e) {}
  return sb;
}
const T = load('teacher.html');
const S = load('student.html');
const th = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
const sh = fs.readFileSync(ROOT + '/student.html', 'utf8');

console.log('학생 첫 화면 — 지금 시즌 것만');
ok('첫 화면이 시즌으로 거른다 (예전엔 전 기간 미제출이 다 쌓였다)', () => {
  assert.ok(/function renderHome\(\)[\s\S]{0,400}?getAssignments\(\)\.filter\(a => asnInSeasonS\(a, studentSelSeason\(\)\)\)/.test(sh),
    '첫 화면이 아직 전체 기간을 본다');
});
ok('숙제 탭·오답·제출률은 그대로 시즌을 본다', () => {
  assert.ok((sh.match(/asnInSeasonS\(/g) || []).length >= 5, '시즌 필터가 줄었다');
});
ok('시즌이 하나도 없으면 전부 보인다 (기존 그대로)', () => {
  assert.strictEqual(S.asnInSeasonS({ startDate: '2020-01-01' }, null), true);
});
ok('시즌 구간 밖 숙제는 걸러진다', () => {
  const se = { startDate: '2026-09-01', endDate: '2026-12-31' };
  assert.strictEqual(S.asnInSeasonS({ startDate: '2026-07-10' }, se), false, '지난 시즌 숙제가 통과함');
  assert.strictEqual(S.asnInSeasonS({ startDate: '2026-10-05' }, se), true);
});

console.log('\n📘 시즌 날짜 → 진도표');
ok('시즌 구간에서 주 수를 뽑는다 (월요일 기준으로 몇 주에 걸치나)', () => {
  assert.strictEqual(T.seasonWeeks({ startDate: '2026-09-07', endDate: '2026-10-04' }), 4);   // 월(9/7)~일(10/4) = 4주
  assert.strictEqual(T.seasonWeeks({ startDate: '2026-09-07', endDate: '2026-12-06' }), 13);  // 13주
});
ok('종료일이 없으면 13주로 둔다', () => {
  assert.strictEqual(T.seasonWeeks({ startDate: '2026-09-01' }), 13);
  assert.strictEqual(T.seasonWeeks(null), 13);
});
ok('주 수는 1~40 사이로 자른다', () => {
  assert.strictEqual(T.seasonWeeks({ startDate: '2026-01-01', endDate: '2030-01-01' }), 40);
  assert.strictEqual(T.seasonWeeks({ startDate: '2026-09-01', endDate: '2026-09-01' }), 1);
});
ok('시즌을 만들 때 진도표도 맞출 수 있다', () => {
  assert.ok(th.includes("id=\"season-fit\""), '맞추기 체크칸이 없음');
  assert.ok(th.includes("if(fit && fit.checked) await seasonFitTerm("), '시즌 추가에서 진도표를 안 맞춤');
  assert.ok(th.includes('onclick="doSeasonFitTerm('), '지난 시즌에 맞추는 버튼이 없음');
});
ok('진도표에 적어 둔 내용은 안 건드린다', () => {
  const i = th.indexOf('async function seasonFitTerm');
  const body = th.slice(i, i + 400);
  assert.ok(/curriculumTerm/.test(body), '학기 설정을 저장하지 않음');
  assert.ok(!/curriculum'\)/.test(body), '진도표 내용을 건드림');
});

console.log('\n🗑 시즌 사진 정리 — 기록은 남기고 사진만');
ok('시즌마다 사진 정리 버튼이 있다', () => {
  assert.ok(th.includes('onclick="doPruneSeason('), '버튼이 없음');
});
ok('사진만 비우고 제출 기록은 남긴다', () => {
  const i = th.indexOf('async function doPruneSeason');
  const body = th.slice(i, i + 1800);
  assert.ok(/photos:\[\], retryPhotos:\[\], corrections:\{\}, photosPruned:true/.test(body), '사진 비우기가 없음');
  assert.ok(!/\.delete\(\)/.test(body.replace(/refFromURL\(u\)\.delete\(\)/g, '')), '문서를 지우고 있다');
  assert.ok(/refFromURL\(u\)\.delete\(\)/.test(body), '저장소 파일을 안 지움');
});
ok('이미 정리한 건 다시 세지 않는다', () => {
  const body = th.slice(th.indexOf('async function doPruneSeason'), th.indexOf('async function doPruneSeason') + 900);
  assert.ok(/!x\.photosPruned/.test(body), '정리된 건을 또 센다');
});
ok('지울 사진이 없으면 그냥 알려준다', () => {
  const body = th.slice(th.indexOf('async function doPruneSeason'), th.indexOf('async function doPruneSeason') + 900);
  assert.ok(/지울 사진이 없어요/.test(body));
});

console.log('\n🙋 개별 숙제');
ok('선생님 명단 — 고른 학생만 나온다', () => {
  T.__set('STUDENTS_CACHE', [
    { id: 's1', name: '가', classIds: ['c1'], status: '재원' },
    { id: 's2', name: '나', classIds: ['c1'], status: '재원' },
    { id: 's3', name: '다', classIds: ['c1'], status: '재원' }
  ]);
  const all = T.hwStudents({ classId: 'c1', startDate: '2026-10-05' });
  assert.strictEqual(all.length, 3, '반 전체 숙제인데 ' + all.length + '명');
  const only = T.hwStudents({ classId: 'c1', startDate: '2026-10-05', studentIds: ['s2'] });
  assert.strictEqual(only.map(s => s.name).join(','), '나', '개별 숙제인데 명단이 ' + only.map(s => s.name).join(','));
});
ok('개별 숙제여도 휴·퇴원생은 빠진다', () => {
  T.__set('STUDENTS_CACHE', [
    { id: 's1', name: '가', classIds: ['c1'], status: '재원' },
    { id: 's2', name: '나', classIds: ['c1'], status: '퇴원' }
  ]);
  const only = T.hwStudents({ classId: 'c1', startDate: '2026-10-05', studentIds: ['s1', 's2'] });
  assert.strictEqual(only.map(s => s.name).join(','), '가');
});
ok('빈 studentIds는 반 전체로 본다', () => {
  T.__set('STUDENTS_CACHE', [
    { id: 's1', name: '가', classIds: ['c1'], status: '재원' },
    { id: 's2', name: '나', classIds: ['c1'], status: '재원' }
  ]);
  assert.strictEqual(T.hwStudents({ classId: 'c1', startDate: '2026-10-05', studentIds: [] }).length, 2);
});
ok('학생 화면 — 나한테 온 개별 숙제만 보인다', () => {
  assert.ok(/const only = Array\.isArray\(a\.studentIds\) && a\.studentIds\.length;/.test(sh), '개별 숙제 거르기가 없음');
  assert.ok(/if\(only\) \{ if\(!a\.studentIds\.includes\(STUDENT\.id\)\) return false; \}/.test(sh), '남의 개별 숙제가 보인다');
});
ok('개별 숙제는 반이동 조건을 안 탄다 (다른 반 학생에게도 줄 수 있게)', () => {
  assert.ok(/else if\(!memberAtDate\(a\.classId, d\)\) return false;/.test(sh), '개별 숙제도 반 조건에 걸린다');
});
ok('숙제 만들기 폼에 개별 숙제 칸이 있다', () => {
  assert.ok(th.includes('id="hw-indiv"'), '체크칸이 없음');
  assert.ok(th.includes('id="hw-indiv-box"'), '학생 고르는 칸이 없음');
  assert.ok(th.includes('studentIds:hwIndivIds()'), '저장할 때 안 담김');
});
ok('반을 바꾸면 학생 명단도 다시 그린다', () => {
  assert.ok(/classSelect\('hw-cls'\)\.replace\('<select ','<select onchange="hwRenderIndiv\(\)" '\)/.test(th), '반 셀렉트에 연결이 없음');
});
ok('수정하러 열면 고른 학생이 되살아난다', () => {
  assert.ok(/hwIndivSel = Array\.isArray\(a\.studentIds\) \? a\.studentIds\.slice\(\) : \[\]/.test(th), '수정 때 복원이 없음');
  assert.ok(/hwRenderIndiv\(\);\s+\/\/ 🙋/.test(th), '그린 뒤 호출이 없음');
});

console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
