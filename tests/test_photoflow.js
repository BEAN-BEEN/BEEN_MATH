// 📷 사진 귀찮음 줄이기 — ① 사진 받는 숙제만 ② 첫 화면에서 바로 찍어 내기 ③ 쌤은 한 화면에서 넘겨 보고 한 번에 받기
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
  const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '', style: {} }; return els[id]; };
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  try { vm.runInContext(src, sb, { filename: file }); } catch (e) { sb.__err = e; }
  sb.__els = els;
  return sb;
}
const T = load('teacher.html'), S = load('student.html');
const bal = (h, tag) => (h.split('<' + tag).length - 1) === (h.split('</' + tag + '>').length - 1);
const TODAY = T.bmToday();
const plus = n => { const d = new Date(TODAY + 'T00:00:00'); d.setDate(d.getDate() + n); const p = v => String(v).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const thL = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8'), stL = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');

console.log('① 사진 받는 숙제만');
ok('예전 숙제(칸 없음)는 그대로 사진 받기', () => {
  assert.strictEqual(T.hwNeedsPhoto({}), true);
  assert.strictEqual(T.hwNeedsPhoto({ photo: 'none' }), false);
  assert.strictEqual(T.hwClassOnly({ photo: 'none' }), true);
  assert.strictEqual(T.hwClassOnly({ photo: 'none', probStart: 1, probEnd: 20 }), false, '번호 숙제는 번호를 받는다');
});
ok('공책 검사 숙제는 미제출 독촉에서 빠진다', () => {
  T.__set('CLASSES', [{ id: 'c1', name: '고1T A1', role: '담임' }]);
  T.__set('STUDENTS_CACHE', [{ id: 's1', name: '김하나', classIds: ['c1'], status: '재원' }]);
  T.__set('ASSIGNMENTS_CACHE', [
    { id: 'n1', classId: 'c1', title: '공책 숙제', photo: 'none', startDate: plus(-3), dueDate: plus(-1) },
    { id: 'p1', classId: 'c1', title: '사진 숙제', photo: 'need', startDate: plus(-3), dueDate: plus(-1) },
    { id: 'o1', classId: 'c1', title: '번호 숙제', photo: 'none', probStart: 1, probEnd: 10, startDate: plus(-3), dueDate: plus(-1) }
  ]);
  T.__set('SUBMISSIONS_CACHE', []);
  assert.strictEqual(T.hwMissingList().map(x => x.a.id).sort().join(','), 'o1,p1');
});
ok('숙제 만들기 두 곳에 사진 받기 칸 — 새 숙제는 꺼진 채로', () => {
  assert.ok(thL.includes('id="hw-photo" ${(editA?hwNeedsPhoto(editA):false)?\'checked\':\'\'}'));
  assert.ok(thL.includes('<input type="checkbox" id="qhw-photo">'));
  assert.ok(thL.includes("photo:(_ph&&_ph.checked)?'need':'none'") && thL.includes("photo:(_qph&&_qph.checked)?'need':'none'"));
});
ok('학생: 공책 검사 숙제는 제출할 것이 아니다 — 쌤이 누르면 제출됨', () => {
  Object.assign(S.__get('STUDENT'), { id: 's1', name: '김하나' });
  S.__set('S_CLASSHISTORY', [{ classId: 'c1', from: '2026-01-01' }]);
  S.__set('S_ASSIGNMENTS', [
    { id: 'n1', classId: 'c1', title: '공책 숙제', photo: 'none', startDate: plus(-3), dueDate: plus(-1) },
    { id: 'n2', classId: 'c1', title: '공책 숙제2', photo: 'none', startDate: plus(-3), dueDate: plus(2) },
    { id: 'p1', classId: 'c1', title: '사진 숙제', startDate: plus(-3), dueDate: plus(2) },
    { id: 'o1', classId: 'c1', title: '번호 숙제', photo: 'none', probStart: 1, probEnd: 10, startDate: plus(-3), dueDate: plus(2) }
  ]);
  S.__set('S_SUBMISSIONS', [
    { id: 'x1', assignmentId: 'n2', studentId: 's1', evalPct: '90', byTeacher: true },
    { id: 'x2', assignmentId: 'o1', studentId: 's1', wrongNos: ['3'] }
  ]);
  const st = {}; S.getAssignments().forEach(a => { st[a.id] = a.status; });
  assert.strictEqual(st.n1, 'class', '마감 지나도 지각이 아니라 공책 검사');
  assert.strictEqual(st.n2, 'submitted', '쌤이 완성도를 누르면 제출');
  assert.strictEqual(st.p1, 'pending');
  assert.strictEqual(st.o1, 'submitted', '사진 안 받는 번호 숙제는 번호만 넣으면 끝');
});
ok('학생 숙제 탭에 공책 검사 칸', () => {
  assert.ok(stL.includes("const classOnly = asgn.filter(a => a.status==='class');"));
});

console.log('\n② 첫 화면에서 바로 찍어 내기');
ok('사진 숙제는 카메라·앨범 버튼, 번호 숙제는 숙제 탭으로', () => {
  S.__set('S_CLASSES', [{ id: 'c1', name: '고1T A1', weekdays: ['mon'] }]);
  S.__set('S_CURRICULUM', []); S.__set('S_PROGLOG', []); S.__set('HOME_DAY', '');
  S.asnInSeasonS = () => true; S.studentSelSeason = () => null;
  const all = S.getAssignments();
  const h = S.classHomeCardsHtml(all.filter(a => ['pending', 'late', 'rejected'].includes(a.status)));
  assert.ok(h.includes('capture="environment"') && h.includes("homeQuickShot('p1',this)"), '바로 찍기 버튼이 없음');
  assert.ok(!h.includes("homeQuickShot('n1'"), '공책 숙제에 올리기 버튼이 있음');
  assert.ok(h.includes('공책 검사') && h.includes('공책 숙제'), '공책 검사 숙제가 반 카드에 안 보임');
  assert.ok(bal(h, 'div') && bal(h, 'label') && bal(h, 'button') && bal(h, 'span'));
});
ok('고르면 제출 버튼 없이 바로 올라간다', async () => {
  const seen = [];
  S.addPendingFiles = (f, id) => seen.push('add:' + id);
  S.doSubmit = async (id) => seen.push('submit:' + id);
  S.renderHome = () => seen.push('home');
  S.__set('currentSection', 'home');
  const input = { files: [{}], value: 'x' };
  await S.homeQuickShot('p1', input);
  assert.strictEqual(seen.join(','), 'add:p1,submit:p1,home');
  assert.strictEqual(input.value, '');
});

console.log('\n③ 쌤: 사진 한눈에 · 한 번에 받기');
ok('반 전체 사진이 한 화면에, 완성도도 거기서', () => {
  T.__set('SUBMISSIONS_CACHE', [{ id: 'u1', assignmentId: 'p1', studentId: 's1', photos: ['https://firebasestorage.googleapis.com/a.jpg', 'https://firebasestorage.googleapis.com/b.jpg'], evalPct: '50' }]);
  const h = T.hwGalleryHtml('p1');
  assert.ok(h.includes('김하나') && h.includes('사진 2장') && h.includes('사진 낸 학생 1/1'));
  assert.ok(h.includes("hgOpenPhotos('u1')") && h.includes("hgDownloadAll('p1')"));
  assert.ok(h.includes("hgGrade('p1','s1','100')") && !h.includes('doQuickCheck('), '완성도 버튼이 화면을 다시 그리지 않음');
  assert.ok(bal(h, 'div') && bal(h, 'button') && bal(h, 'span'));
});
ok('파일 이름은 학생 이름_번호, 이상한 글자는 뺀다', () => {
  assert.strictEqual(T.hgSafe('고1T A1 쎈 p.50~60 / 홀수?'), '고1T A1 쎈 p.50~60  홀수');
  assert.strictEqual(T.hgSafe(''), '사진');
});
ok('숙제 목록과 대시보드에서 연다', () => {
  assert.ok(thL.includes(`onclick="openHwGallery('\${a.id}')" title="이 숙제의 반 전체 사진을 한 화면에`));
  assert.ok(thL.includes("사진 한눈에 · ${subs.filter("));
});

console.log('\n' + pass + ' passed');
