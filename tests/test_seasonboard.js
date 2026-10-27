// 🗓 시즌 하나로 모든 화면이 움직인다 · 📊 시즌 현황(숙제×학생 완성도) · ✅ 체크리스트 한눈에 보기
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

const th = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
function load() {
  const out = []; let i = 0;
  for (;;) {
    const s = th.indexOf('<script', i); if (s < 0) break;
    const gt = th.indexOf('>', s), head = th.slice(s, gt), e = th.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(th.slice(gt + 1, e));
    i = e + 9;
  }
  const src = out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';
  const els = {};
  const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } }; return els[id]; };
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    scrollTo: () => {},
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) { sb.__err = e; }
  sb.__els = els;
  return sb;
}
const T = load();
const get = n => T.__get(n), set = (n, v) => T.__set(n, v);
const TODAY = T.bmToday();
const plus = n => { const d = new Date(TODAY + 'T00:00:00'); d.setDate(d.getDate() + n); const p = v => String(v).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const bal = (h, tag) => (h.split('<' + tag).length - 1) === (h.split('</' + tag + '>').length - 1);

set('CLASSES', [{ id: 'c1', name: '고1T A1', role: '담임' }, { id: 'c2', name: '고1S B1', role: '담임' }]);
set('STUDENTS_CACHE', [
  { id: 's1', name: '김하나', classIds: ['c1'], status: '재원' },
  { id: 's2', name: '이두리', classIds: ['c1'], status: '재원' },
  { id: 's3', name: '박세나', classIds: ['c1'], status: '재원' },
  { id: 's9', name: '최아홉', classIds: ['c2'], status: '재원' }
]);
set('SEASONS_CACHE', [
  { id: 'now', name: '2학기 중간', startDate: plus(-20), endDate: plus(20) },
  { id: 'old', name: '여름방학', startDate: plus(-90), endDate: plus(-21) }
]);
set('ASSIGNMENTS_CACHE', [
  { id: 'a1', classId: 'c1', title: '쎈 1~40', startDate: plus(-14), dueDate: plus(-7) },
  { id: 'a2', classId: 'c1', title: '쎈 41~80', startDate: plus(-7), dueDate: plus(-1) },
  { id: 'a3', classId: 'c1', title: '쎈 81~120', startDate: plus(-1), dueDate: plus(6) },
  { id: 'a4', classId: 'c1', title: '개별 보충', startDate: plus(-3), dueDate: plus(-2), studentIds: ['s3'] },
  { id: 'z1', classId: 'c1', title: '여름 숙제', startDate: plus(-60), dueDate: plus(-53) }
]);
set('SUBMISSIONS_CACHE', [
  { id: 'u1', assignmentId: 'a1', studentId: 's1', evalPct: '100' },
  { id: 'u2', assignmentId: 'a1', studentId: 's2', evalPct: '50' },
  { id: 'u3', assignmentId: 'a2', studentId: 's1', evalPct: '90' },
  { id: 'u4', assignmentId: 'a2', studentId: 's2', notDone: true, evalPct: '0' },
  { id: 'u5', assignmentId: 'a4', studentId: 's3', evalPct: '100' },
  { id: 'u6', assignmentId: 'z1', studentId: 's1', evalPct: '100' }
]);
set('gradeSeasonId', null); set('hwSeasonId', null);

console.log('시즌 하나로');
ok('위쪽에서 고르면 숙제·반별 관리가 같이 바뀐다', () => {
  const seen = [];
  T.renderSection = (s) => seen.push(s);
  set('curSec', 'homework');
  T.setSeason('old');
  assert.strictEqual(get('gradeSeasonId'), 'old');
  assert.strictEqual(get('hwSeasonId'), 'old');
  assert.strictEqual(T.selectedSeason().id, 'old');
  assert.strictEqual(T.hwSelSeason().id, 'old');
  assert.strictEqual(seen.join(','), 'homework');
});
ok('전체 기간을 고르면 어느 쪽도 거르지 않는다', () => {
  T.setSeason('__all');
  assert.strictEqual(T.selectedSeason(), null);
  assert.strictEqual(T.hwSelSeason(), null);
});
ok('안 고르면 지금 시즌', () => {
  set('gradeSeasonId', null); set('hwSeasonId', null);
  assert.strictEqual(T.selectedSeason().id, 'now');
  const h = T.seasonPickHtml();
  assert.ok(h.includes('<option value="now" selected>') && h.includes('value="__all"') && h.includes('openSeasonMgmt()'));
  assert.ok(bal(h, 'select') && bal(h, 'option') && bal(h, 'button'));
});
ok('시즌이 없으면 만들기 버튼', () => {
  const keep = get('SEASONS_CACHE');
  set('SEASONS_CACHE', []);
  assert.ok(T.seasonPickHtml().includes('시즌 만들기'));
  set('SEASONS_CACHE', keep);
});
ok('화면 안의 고르는 칸도 같은 길로 간다', () => {
  assert.ok(!th.includes('onchange="gradeSeasonId=this.value'));
  assert.ok(!th.includes('onchange="hwSeasonId=this.value'));
});
ok('안 낸 학생이 있어도 완성도 계산이 안 터진다', () => {
  assert.strictEqual(T.subCompletion(undefined), 0);
});

console.log('\n시즌 현황 표');
const D = () => T.seasonBoardData('c1', T.hwSelSeason());
ok('그 시즌에 낸 숙제만, 낸 순서로', () => {
  assert.strictEqual(D().asg.map(a => a.id).join(','), 'a1,a2,a4,a3');
});
ok('칸 — 완성도 · 마감 지나 안 냄은 0 · 마감 전은 기다림 · 남의 숙제는 빈칸', () => {
  const rows = D().rows, by = {}; rows.forEach(r => { by[r.st.id] = r.cells.map(v => v === null ? '_' : v).join(','); });
  assert.strictEqual(by.s1, '100,90,_,wait');
  assert.strictEqual(by.s2, '50,0,_,wait');
  assert.strictEqual(by.s3, '0,0,100,wait');
});
ok('평균은 기다리는 칸·빈칸을 빼고 낸다', () => {
  const d = D(), avg = {}; d.rows.forEach(r => { avg[r.st.id] = r.avg; });
  assert.strictEqual(avg.s1, 95);
  assert.strictEqual(avg.s2, 25);
  assert.strictEqual(avg.s3, 33);
  assert.strictEqual(d.colAvg.join(','), '50,30,100,');
  assert.strictEqual(d.avg, Math.round((100 + 90 + 50 + 0 + 0 + 0 + 100) / 7));
});
ok('지난 시즌을 고르면 그때 숙제가 나온다', () => {
  T.renderSection = () => {};
  T.setSeason('old');
  assert.strictEqual(D().asg.map(a => a.id).join(','), 'z1');
  T.setSeason('now');
});
ok('표가 그려지고 태그가 맞는다', () => {
  set('sbClassId', 'c1');
  const h = T.seasonBoardHtml();
  assert.ok(h.includes('2학기 중간') && h.includes('쎈 41~80') && h.includes('김하나') && h.includes('숙제별 평균'));
  assert.ok(h.includes("sbPickClass('c2')") && h.includes("openStuInfo('s1')"));
  ['div', 'table', 'tr', 'td', 'button', 'span', 'strong'].forEach(t => assert.ok(bal(h, t), t + ' 태그가 안 맞음'));
});
ok('숙제가 없는 반은 안내만', () => {
  set('sbClassId', 'c2');
  const h = T.seasonBoardHtml();
  assert.ok(h.includes('낸 숙제가 없어요') && bal(h, 'div'));
  set('sbClassId', 'c1');
});
ok('숙제 메뉴 하위 탭에 시즌 현황이 있다', () => {
  assert.ok(get('SUBNAV').homework.tabs.some(t => t[0] === 'season'));
  assert.ok(th.includes('id="seasonContent"') && th.includes('season:rSeasonBoard'));
});

console.log('\n체크리스트 한눈에 보기');
ok('다 끝낸 단원은 초록 ✓, 일부는 몇 명인지, 아무도 안 한 건 회색', () => {
  set('CLASSCHECK_CACHE', {
    c1: { id: 'c1', units: [{ id: 'u1', name: '다항식' }, { id: 'u2', name: '방정식' }, { id: 'u3', name: '부등식' }],
          marks: { u1: { s1: true, s2: true, s3: true }, u2: { s1: true } } }
  });
  set('ckGroup', ''); set('ckBoardClassId', 'c1'); set('ckShowOld', true);   // 이 묶음은 만든 날 없는 옛 id(u1…)라 지난 것까지 보기
  const h = T.ckOverviewHtml(get('CLASSES'));
  assert.ok(h.includes('✓ 다항식'), '다 끝낸 단원 표시가 없음');
  assert.ok(/방정식 <span[^>]*>1\/3<\/span>/.test(h), '일부만 한 단원에 인원이 없음');
  assert.ok(h.includes('>부등식</span>'));
  assert.ok(h.includes('>1/3</span>'), '반 전체 진행(끝낸 단원 수)이 없음');
  assert.ok(h.includes("setCkBoardClass('c2')") && h.includes('항목 없음'));
  assert.ok(bal(h, 'div') && bal(h, 'span') && bal(h, 'button'));
});
ok('체크리스트 카드 안에 들어 있다', () => {
  const h = T.classCheckBoardHtml();
  assert.ok(h.includes('한눈에 보기') && h.includes('학생별 체크'));
  ['div', 'table', 'tr', 'td', 'button'].forEach(t => assert.ok(bal(h, t), t));
});

console.log('\n' + pass + ' passed');

console.log('\n새 시즌이면 화면도 새로');
ok('체크리스트: 이번 시즌에 만든 항목만, 지난 것은 숨기고 개수를 알려준다', () => {
  const se = T.selectedSeason();
  const ms = ds => new Date(ds + 'T12:00:00').getTime().toString(36);
  const idNew = 'u' + ms(plus(-5)), idPrep = 'n' + ms(plus(-24)), idOld = 'u' + ms(plus(-60));
  set('CLASSCHECK_CACHE', { c1: { id: 'c1', units: [{ id: idNew, name: '원의 방정식' }, { id: idOld, name: '여름 단원' }, { id: 'u9', name: '아주 옛날' }],
    naesinItems: [{ id: idPrep, name: '1주차', book: '기출편' }], marks: {} } });
  set('ckShowOld', false);
  assert.strictEqual(T.ckItemDate(idNew), plus(-5));
  assert.strictEqual(T.ckColumns('c1').map(c => c.name).join(','), '원의 방정식,1주차', '시즌 시작 1주 전에 미리 만든 것은 이번 시즌');
  assert.strictEqual(T.ckOldCount(), 2);
  assert.ok(T.ckOverviewHtml(get('CLASSES')).includes('지난 시즌 항목 2개는 숨겼어요'));
  set('ckShowOld', true);
  assert.strictEqual(T.ckColumns('c1').length, 4);
  set('ckShowOld', false);
  assert.ok(se && se.id === 'now');
});
ok('시험·영상·복습·오답·미제출도 고른 시즌 것만', () => {
  set('EXAMS_CACHE', [{ id: 'e1', date: plus(-3), title: '이번', analysis: [{ no: '1' }] }, { id: 'e2', date: plus(-50), title: '지난', analysis: [{ no: '1' }] }, { id: 'e3', title: '날짜 없음', analysis: [{ no: '1' }] }]);
  assert.strictEqual(T.anExamsWithAnalysis().map(e => e.id).join(','), 'e1,e3');
  assert.strictEqual(T.inSeasonDate(plus(-50), T.selectedSeason()), false);
  T.setSeason('__all');
  assert.strictEqual(T.anExamsWithAnalysis().length, 3, '전체 기간이면 다 보인다');
  T.setSeason('now');
  const th = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
  assert.ok(th.includes('if(!asnInSeason(a, selectedSeason())) return false; // 지난 시즌 숙제는'));
  assert.ok(th.includes('const vids=getVideos().filter(v=>inSeasonDate(v.date, selectedSeason()));'));
  assert.ok(th.includes(".filter(a=>asnInSeason(a, selectedSeason()));\n") || th.includes(".filter(a=>asnInSeason(a, selectedSeason()));\r\n"));
});
console.log('\n' + pass + ' passed (새 시즌 포함)');
