// 📥 성적 붙여넣기 — 학원 공용 엑셀 표를 통째로 붙여넣으면 우리 학생 점수·등급만 채운다 + 담임 반 기준 · 반 순서(A → S → T)
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

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
const inputs = [];
const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '', style: {}, dataset: {} }; return els[id]; };
const T = {
  console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
  document: {
    getElementById: (id) => el(id), addEventListener: () => {}, createElement: () => ({}), body: {},
    querySelectorAll: (q) => inputs.filter(x => q === '.' + x.cls),
    querySelector: (q) => { const m = q.match(/^\.([^\[]+)\[data-sid="([^"]+)"\]$/); return m ? inputs.find(x => x.cls === m[1] && x.dataset.sid === m[2]) || null : null; }
  },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: '', search: '', replace: () => {} },
  navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
  addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
  firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
};
T.window = T; T.globalThis = T; T.self = T;
vm.createContext(T);
try { vm.runInContext(src, T, { filename: 'teacher.html' }); } catch (e) { T.__err = e; }
const toasts = []; T.showToast = (m, t) => toasts.push(m);
const set = (n, v) => T.__set(n, v);
const bal = (h, tag) => (h.split('<' + tag).length - 1) === (h.split('</' + tag + '>').length - 1);
const TAB = '\t';

set('CLASSES', [
  { id: 't1', name: '고1T A1', role: '담임' }, { id: 'a5', name: '고1A A5', role: '담임' },
  { id: 's4', name: '고1S A4', role: '담임' }, { id: 't2', name: '고1T A2', role: '담임' }, { id: 'x', name: '고1S X1', role: '부담임' }
]);
const ST = [
  { id: 'h1', name: '홍민택', classIds: ['t1'], status: '재원', school: '충훈고' },
  { id: 'k1', name: '김재동', classIds: ['a5'], status: '재원', school: '관양고' },
  { id: 'k2', name: '김시원', classIds: ['a5'], status: '재원', school: '산본고' },   // 엑셀엔 '김시원C'
  { id: 's1', name: '소지민', classIds: ['s4'], status: '재원', school: '충훈고' },
  { id: 'j1', name: '정찬우', classIds: ['s4'], status: '재원', school: '양명고' },
  { id: 'o1', name: '오류경', classIds: ['t2'], status: '재원', school: '신성고' },
  { id: 'y1', name: '부담임만', classIds: ['x'], status: '재원', school: '양명고' }
];
set('STUDENTS_CACHE', ST);

console.log('반 순서 — A → S → T, 그다음 반 번호');
ok('담임 반 기준으로 A5 → A4(S) → A1(T) → A2(T)', () => {
  const order = T.sortByClassOrder(ST.filter(T.isHomeroomStudent)).map(s => s.name).join(',');
  assert.strictEqual(order, '김시원,김재동,소지민,정찬우,홍민택,오류경');
});

console.log('\n모의고사 표 붙여넣기 (원점수·등급)');
const MOCK = [
  ['10월 모의고사', '', '', '', '2일 21:00 ebsi 기준'].join(TAB),
  ['반', '이름', '원점수', '등급', '등급', '등급컷', '', '등급', '등급의 COUNTA'].join(TAB),
  '"A5',
  ['송혜빈T"', '김시원C', '55', '4등급', '', '', '', '', ''].join(TAB),
  ['', '김재동', '57', '3등급'].join(TAB),
  ['"고1 P1', ''].join(TAB),
  ['서용훈T"', '강지은A', '', '', '1등급', '80', '', '1등급', '2'].join(TAB),
  ['', '소지민', '72', '2등급'].join(TAB),
  ['', '홍민택', '58', '3등급'].join(TAB),
  ['', '오류경', '64', '3등급'].join(TAB),
  ['', '이서윤H', '', '미응시'].join(TAB)
].join('\n');
ok('우리 학생만 채우고, 점수 없는 줄·남의 학생은 건너뛴다', () => {
  inputs.length = 0;
  ST.filter(T.isHomeroomStudent).forEach(s => {
    inputs.push({ cls: 'mscore-m1', dataset: { sid: s.id, name: s.name }, value: '' });
    inputs.push({ cls: 'msgrade-m1', dataset: { sid: s.id }, value: '' });
  });
  el('mpaste-m1').value = MOCK;
  T.mockPasteFill('m1');
  const v = (cls, sid) => inputs.find(x => x.cls === cls && x.dataset.sid === sid).value;
  assert.strictEqual(v('mscore-m1', 'k2') + '/' + v('msgrade-m1', 'k2'), '55/4등급', '김시원C → 김시원');
  assert.strictEqual(v('mscore-m1', 'k1') + '/' + v('msgrade-m1', 'k1'), '57/3등급');
  assert.strictEqual(v('mscore-m1', 'h1') + '/' + v('msgrade-m1', 'h1'), '58/3등급');
  assert.strictEqual(v('mscore-m1', 'j1'), '', '없는 줄은 비워 둔다');
  assert.ok(!toasts[toasts.length - 1].includes('강지은'), '남의 학생 이름을 알리지 않는다');
  assert.ok(toasts[toasts.length - 1].includes('5명'));
});

console.log('\n내신 표 붙여넣기 (공수2·등급)');
const NAESIN = [
  ['반명', '담임명', '학교명', '성명', '공수2', '등급', '대수', '등급', '1컷 76 쯤'].join(TAB),
  ['수학 고1 A A5 공수1 금 7시40분', '송혜빈', '산본고', '김시원C', '80.1', '1', '', '', '1컷 78, 2컷 60'].join(TAB),
  ['수학 고1 A A5 공수1 금 7시40분', '송혜빈', '관양고', '김재동', '89.4', '1', '', '', '1컷 83점'].join(TAB),
  ['수학 고1 S A4 공수1 목 7시40분', '송혜빈', '충훈고', '소지민', '70.7', '2', '', '', '1컷 80 2컷 60'].join(TAB),
  ['수학 고1 S A4 공수1 목 7시40분', '송혜빈', '양명고', '정찬우', '37.8', '4', '', '', '양명고 1컷 78'].join(TAB),
  ['수학 고1 T A1 공수1 토 4시 30분', '송혜빈', '충훈고', '홍민택', '72.3', '2'].join(TAB),
  ['수학 고1 T A2 공수1 일 2시', '송혜빈', '신성고', '오류경', '62', '3'].join(TAB),
  ['수학 고1 T A7 공수1 월 7시40분', '박태환', '평촌고', '노유빈', '9/11 퇴원'].join(TAB),
  ['수학 고1 P A1 공수1 일 2시', '서용훈', '백영고', '구태성', '94', '1'].join(TAB)
].join('\n');
ok('고른 과목(공통수학2) 칸과 옆 등급을 읽는다', () => {
  set('naesinSubject', '공통수학2'); set('naesinTerm', '중간'); set('naesinClassId', ''); set('naesinGroup', 'class');
  T.getNaesin = () => null;
  el('ns-paste').value = NAESIN;
  ['k1', 'k2', 's1', 'j1', 'h1', 'o1'].forEach(id => { el('ns-sc-' + id).value = ''; el('ns-gr-' + id).value = ''; });
  T.naesinPasteFill();
  assert.strictEqual(el('ns-sc-k2').value + '/' + el('ns-gr-k2').value, '80.1/1');
  assert.strictEqual(el('ns-sc-j1').value + '/' + el('ns-gr-j1').value, '37.8/4');
  assert.strictEqual(el('ns-sc-o1').value + '/' + el('ns-gr-o1').value, '62/3');
  assert.ok(toasts[toasts.length - 1].includes('6명'));
});
ok('대수를 고르면 대수 칸을 읽는다(비어 있으면 안 채움)', () => {
  set('naesinSubject', '대수');
  el('ns-sc-k1').value = '';
  T.naesinPasteFill();
  assert.strictEqual(el('ns-sc-k1').value, '');
  set('naesinSubject', '공통수학2');
});
ok('퇴원 같은 메모·물음표만 있는 값은 점수로 안 넣는다', () => {
  assert.strictEqual(T.pasteScoreOk('9/11 퇴원'), false);
  assert.strictEqual(T.pasteScoreOk('?'), false);
  assert.strictEqual(T.pasteScoreOk('92+@'), true);
  assert.strictEqual(T.pasteScoreOk('40점대'), true);
  assert.strictEqual(T.pasteGradeOf('1?'), '1?');
  assert.strictEqual(T.pasteGradeOf('2등급'), '2');
  assert.strictEqual(T.pasteGradeOf('미응시'), '');
});
ok('내신 입력표: 담임 반만, 반별 또는 학교별로 묶는다', () => {
  set('naesinGroup', 'class');
  let h = T.naesinRosterHtml();
  assert.ok(!h.includes('부담임만'));
  assert.ok(h.indexOf('김시원') < h.indexOf('소지민') && h.indexOf('소지민') < h.indexOf('홍민택'));
  assert.ok(bal(h, 'tr') && bal(h, 'td'));
  set('naesinGroup', 'school');
  T.getSchoolExams = () => [];
  h = T.naesinRosterHtml();
  assert.ok(h.indexOf('관양고') < h.indexOf('산본고') && h.indexOf('산본고') < h.indexOf('신성고'));
  set('naesinGroup', 'class');
});
ok('모의고사 입력표에도 붙여넣기 칸과 반 머리줄', () => {
  set('MOCKEXAMS_CACHE', [{ id: 'm1', title: '10월 모의고사', maxScore: 100 }]);
  set('MOCKSUBS_CACHE', []);
  const h = T.mockScoreRosterHtml('m1');
  assert.ok(h.includes("mockPasteFill('m1')") && h.includes('id="mpaste-m1"'));
  assert.ok(h.indexOf('김시원') < h.indexOf('홍민택'));
  assert.ok(h.includes('고1A A5'));
});

console.log('\n' + pass + ' passed');
