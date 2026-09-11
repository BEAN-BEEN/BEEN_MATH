// 🧾 같은 시험지 묶기 — 여러 반에 등록한 시험을 한 표로 (학년 전체 비교)
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };
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
  sb.showToast = () => {};
  return sb;
}

const T = load('teacher.html');
const P = (no, answer, extra) => Object.assign({ no: String(no), difficulty: '중', answer, points: '', qType: '' }, extra || {});
const probs = [P(1, '1'), P(2, '2'), P(3, '3'), P(4, '4')];
// 같은 시험지를 세 반에 등록 — 반마다 문서가 따로 생긴 상태
const EA = { id: 'ea', title: '11_2025_관양고_1-2-1', classId: 'cA', className: '고1A B5', maxScore: 100, analysis: probs, createdAt: '2026-09-05' };
const EB = { id: 'eb', title: '11_2025_관양고_1-2-1', classId: 'cB', className: '고1S B4', maxScore: 100, analysis: probs, createdAt: '2026-09-05' };
const EC = { id: 'ec', title: '11_2025_관양고_1-2-1', classId: 'cC', className: '고1T B1', maxScore: 71, analysis: probs, createdAt: '2026-09-05' };
// 다른 시험지
const EX = { id: 'ex', title: '15_2025_수리고_1-2-1', classId: 'cA', className: '고1A B5', maxScore: 100, analysis: [P(1, '1'), P(2, '2')], createdAt: '2026-09-09' };

function seed(subs) {
  T.__set('CLASSES', [
    { id: 'cA', name: '고1A B5', role: '담임' }, { id: 'cB', name: '고1S B4', role: '담임' },
    { id: 'cC', name: '고1T B1', role: '담임' }, { id: 'cZ', name: '고1T Z9', role: '부담임' }
  ]);
  T.__set('STUDENTS_CACHE', [
    { id: 'a1', name: '김가은', classIds: ['cA'], status: '재원' },
    { id: 'a2', name: '김수하', classIds: ['cA'], status: '재원' },
    { id: 'b1', name: '박지후', classIds: ['cB'], status: '재원' },
    { id: 'b2', name: '이서준', classIds: ['cB'], status: '재원' },
    { id: 'c1', name: '장재희', classIds: ['cC'], status: '재원' },
    { id: 'both', name: '두반학생', classIds: ['cA', 'cB'], status: '재원' }
  ]);
  T.__set('EXAMS_CACHE', [EA, EB, EC, EX]);
  T.__set('EXAMSUBS_CACHE', subs || []);
  T.__set('anRepExamId', 'ea');
  T.__set('anRepStId', '');
  T.__set('anPaperOpenMissing', false);
}
const S = (examId, studentId, answers, extra) => Object.assign({ examId, studentId, answers, submittedAt: '2026. 9. 10. 오후 2:30:00' }, extra || {});
const ALL = { '1': '1', '2': '2', '3': '3', '4': '4' };

console.log('\n같은 시험지 묶기');
ok('시험명과 문항 수가 같으면 같은 시험지', () => {
  seed();
  assert.strictEqual(T.anPaperKey(EA), T.anPaperKey(EB));
  assert.strictEqual(T.anPaperKey(EA), T.anPaperKey(EC));
  assert.notStrictEqual(T.anPaperKey(EA), T.anPaperKey(EX));
});
ok('이름이 같아도 문항 수가 다르면 다른 시험지', () => {
  const other = Object.assign({}, EA, { analysis: [P(1, '1')] });
  assert.notStrictEqual(T.anPaperKey(EA), T.anPaperKey(other));
});
ok('앞뒤 공백·겹친 띄어쓰기는 무시한다', () => {
  const sp = Object.assign({}, EA, { title: '  11_2025_관양고_1-2-1  ' });
  assert.strictEqual(T.anPaperKey(sp), T.anPaperKey(EA));
});
ok('한 시험지를 본 반들을 모은다', () => {
  seed();
  assert.strictEqual(T.anPaperOf(EB).map(e => e.id).sort().join(','), 'ea,eb,ec');
});
ok('칩은 시험지 한 장에 하나 (반마다 따로 안 나온다)', () => {
  seed();
  const g = T.anPaperGroups();
  assert.strictEqual(g.length, 2, '반마다 따로 나옴: ' + g.map(x => x.title).join(' / '));
  const gw = g.find(x => x.title.indexOf('관양고') >= 0);
  assert.strictEqual(gw.exams.length, 3);
});
ok('응시자가 있는 시험지가 앞으로', () => {
  seed([S('eb', 'b1', ALL)]);
  const g = T.anPaperGroups();
  assert.ok(g[0].title.indexOf('관양고') >= 0, '응시자 있는 시험지가 뒤에 있음');
  assert.strictEqual(g[0].took, 1);
});

console.log('\n반을 넘어 한 표로');
ok('모든 반 응시자가 한 표에 나온다', () => {
  seed([S('ea', 'a1', ALL), S('eb', 'b1', { '1': '1', '2': '2', '3': '9', '4': '9' }), S('ec', 'c1', { '1': '1', '2': '9', '3': '9', '4': '9' })]);
  const h = T.anPaperRosterHtml(EA);
  ['김가은', '박지후', '장재희'].forEach(nm => assert.ok(h.indexOf(nm) >= 0, nm + '이 안 나옴'));
  assert.ok(h.indexOf('>3명<') >= 0, '응시 인원이 틀림');
});
ok('어느 반 시험 문서를 골라도 같은 표가 나온다', () => {
  seed([S('ea', 'a1', ALL), S('eb', 'b1', ALL)]);
  // 복사 버튼은 지금 보고 있는 문서 id를 넘기지만, 어느 문서든 같은 시험지로 풀린다
  const strip = h => h.replace(/background:var\(--primary-light\)/g, '').replace(/btn-primary/g, 'btn-outline')
    .replace(/anCopyMissingPaper\('[^']*'\)/g, 'anCopyMissingPaper(X)');
  assert.strictEqual(strip(T.anPaperRosterHtml(EA)), strip(T.anPaperRosterHtml(EB)));
});
ok('반 칸이 있다 (여러 반일 때)', () => {
  seed([S('ea', 'a1', ALL), S('eb', 'b1', ALL)]);
  const h = T.anPaperRosterHtml(EA);
  assert.ok(h.indexOf('>반</th>') >= 0, '반 칸이 없음');
  assert.ok(h.indexOf('고1A B5') >= 0 && h.indexOf('고1S B4') >= 0);
});
ok('점수 순으로 등수를 매긴다 (같은 점수는 같은 등수)', () => {
  seed([
    S('ea', 'a1', ALL),
    S('eb', 'b1', ALL),
    S('ec', 'c1', { '1': '1', '2': '9', '3': '9', '4': '9' })
  ]);
  const h = T.anPaperRosterHtml(EA);
  // 1등 둘, 3등 하나
  const ranks = [...h.matchAll(/font-weight:800;color:[^"]*">(\d+)<\/td>\s*<td style="font-weight:700">([^<]+)</g)].map(m => m[2] + ':' + m[1]);
  assert.ok(ranks.indexOf('장재희:3') >= 0, '등수가 틀림: ' + ranks.join(', '));
  assert.ok(ranks.filter(x => x.endsWith(':1')).length === 2, '동점 1등이 둘이 아님: ' + ranks.join(', '));
});
ok('전체 평균과 반별 평균을 같이 보여준다', () => {
  seed([S('ea', 'a1', ALL), S('ea', 'a2', { '1': '1', '2': '2', '3': '9', '4': '9' }), S('eb', 'b1', ALL)]);
  const h = T.anPaperRosterHtml(EA);
  assert.ok(h.indexOf('전체 평균') >= 0, '전체 평균이 없음');
  assert.ok(/고1A B5<\/strong>[\s\S]*?평균 <strong[^>]*>75</.test(h), '고1A B5 반 평균(75)이 없음');
  assert.ok(/고1S B4<\/strong>[\s\S]*?평균 <strong[^>]*>100</.test(h), '고1S B4 반 평균(100)이 없음');
});
ok('반별로 몇 명 중 몇 명 봤는지', () => {
  seed([S('ea', 'a1', ALL)]);
  const h = T.anPaperRosterHtml(EA);
  assert.ok(/고1A B5<\/strong>\s*<span[^>]*>1\/3명/.test(h), '고1A B5 1/3명이 안 보임');
});
ok('반마다 만점이 달라도 각자 100점 기준으로 비교된다', () => {
  // EC만 옛날 방식(71점)으로 남아 있어도 같은 답이면 같은 비율
  seed([S('ea', 'a1', ALL), S('ec', 'c1', ALL)]);
  const ra = T.examResultOf(EA, S('ea', 'a1', ALL));
  const rc = T.examResultOf(EC, S('ec', 'c1', ALL));
  assert.strictEqual(ra.score, 100);
  assert.strictEqual(rc.score, 71, '만점이 71인 반은 71점으로 나와야 함 (100점으로 맞추라는 버튼이 있다)');
});
ok('학생을 누르면 그 학생 반의 시험 문서로 분석서를 연다', () => {
  seed([S('eb', 'b1', ALL)]);
  T.rGrades = () => {};
  T.anPickStudentIn('eb', 'b1');
  assert.strictEqual(T.__get('anRepExamId'), 'eb');
  assert.strictEqual(T.__get('anRepStId'), 'b1');
});

console.log('\n아직 안 낸 학생 (모든 반)');
ok('반별로 나눠 보여준다', () => {
  seed([S('ea', 'a1', ALL)]);
  T.__set('anPaperOpenMissing', true);
  const h = T.anPaperRosterHtml(EA);
  assert.ok(h.indexOf('김수하') >= 0 && h.indexOf('박지후') >= 0 && h.indexOf('장재희') >= 0);
  assert.ok(h.indexOf("anPickStudentIn('eb','b1')") >= 0, '다른 반 미응시자를 누를 수 없음');
});
ok('두 반에 다니는 학생은 한 번만 센다', () => {
  seed([]);
  T.__set('anPaperOpenMissing', true);
  const h = T.anPaperRosterHtml(EA);
  assert.strictEqual((h.match(/두반학생/g) || []).length, 1, '두 번 나옴');
});
ok('한 반에서 냈으면 다른 반 미응시에 안 나온다', () => {
  seed([S('ea', 'both', ALL)]);
  T.__set('anPaperOpenMissing', true);
  const h = T.anPaperRosterHtml(EA);
  const missPart = h.slice(h.indexOf('아직 안 낸 학생'));
  assert.ok(missPart.indexOf('두반학생') < 0, '이미 낸 학생이 미응시에 나옴');
});
ok('명단 복사 — 반마다 한 줄', () => {
  seed([S('ea', 'a1', ALL)]);
  T.__copied.length = 0;
  T.anCopyMissingPaper('ea');
  const t = T.__copied[0];
  assert.ok(t.indexOf('[고1A B5]') >= 0 && t.indexOf('[고1S B4]') >= 0 && t.indexOf('[고1T B1]') >= 0, t);
  assert.ok(t.indexOf('김가은') < 0, '낸 학생이 들어감');
});

console.log('\n만점·형식은 시험지 전체에');
okA('100점으로 맞추면 이 시험지를 본 반 모두', async () => {
  seed();
  const done = [];
  T.updateExam = async (id, d) => { done.push(id + ':' + d.maxScore); };
  T.rGrades = () => {};
  await T.anSetMax100Paper('ea');
  assert.strictEqual(done.join(','), 'ec:100', '만점이 71인 EC만 고쳐야 함: ' + done.join(','));
});
okA('주관식 개수를 바꾸면 반 모두 같은 형식', async () => {
  seed();
  const done = [];
  T.updateExam = async (id, d) => { done.push(id + ':' + d.analysis.map(p => p.qType[0]).join('')); };
  T.rGrades = () => {};
  await T.anSetTailSubjectivePaper('eb', 1);
  assert.strictEqual(done.sort().join(','), 'ea:객객객주,eb:객객객주,ec:객객객주');
});
okA('반마다 범위 밖 표시가 달라도 그대로 둔다', async () => {
  seed();
  const EB2 = Object.assign({}, EB, { analysis: probs.map((p, i) => Object.assign({}, p, { outOfRange: i === 3 })) });
  T.__set('EXAMS_CACHE', [EA, EB2, EC, EX]);
  let got = null;
  T.updateExam = async (id, d) => { if (id === 'eb') got = d.analysis; };
  T.rGrades = () => {};
  await T.anSetTailSubjectivePaper('ea', 2);
  assert.strictEqual(got[3].outOfRange, true, '고1S B4의 범위 밖 표시가 지워짐');
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});

(async () => {
  for (const t of Q) await t();
  console.log('\n' + pass + '개 통과');
})();
