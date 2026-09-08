// 배점(난이도 가중치 → 100점 환산) · 주관식 O/X · JSON 파일 여러 개 · 이어서 등록
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
  const src = out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';
  const els = {};
  const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '' }; return els[id]; };
  const sb = {
    console, setTimeout: (f) => { if (typeof f === 'function') f(); }, clearTimeout, setInterval, clearInterval,
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
  sb.__els = els;
  sb.__err = err;
  return sb;
}

const T = load('teacher.html');
const S = load('student.html');
T.showToast = () => {};
S.showToast = () => {};
const get = n => T.__get(n), set = (n, v) => T.__set(n, v);

const P = (no, difficulty, answer, points) => ({ no: String(no), difficulty, answer, points: points === undefined ? '' : points });
const exam = (probs, extra) => Object.assign({
  id: 'e1', title: '2024 평촌고 1-2-1 기출', className: '고1T A1', classId: 'c1',
  analysis: probs || []
}, extra || {});
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.05 : tol);

console.log('\n난이도 가중치');
ok('객관식은 하·중하 3 / 중·중상 4 / 상·최상 5', () => {
  assert.strictEqual(T.probWeight(P(1, '하', '3'), 5), 3);
  assert.strictEqual(T.probWeight(P(2, '중하', '1'), 5), 3);
  assert.strictEqual(T.probWeight(P(3, '중', '2'), 5), 4);
  assert.strictEqual(T.probWeight(P(4, '중상', '5'), 5), 4);
  assert.strictEqual(T.probWeight(P(5, '상', '4'), 5), 5);
  assert.strictEqual(T.probWeight(P(6, '최상', '2'), 5), 5);
});
ok('주관식(서술형)은 난이도와 상관없이 8', () => {
  assert.strictEqual(T.probWeight(P(9, '하', '12'), 5), 8);
  assert.strictEqual(T.probWeight(P(10, '최상', 'x=3'), 5), 8);
});
ok('난이도가 비면 4', () => {
  assert.strictEqual(T.probWeight(P(7, '', '3'), 5), 4);
  assert.strictEqual(T.probWeight({ no: '8', answer: '3' }, 5), 4);
});
ok('적어 둔 배점이 있으면 그게 가중치', () => {
  assert.strictEqual(T.probWeight(P(1, '하', '3', 7), 5), 7);
  assert.strictEqual(T.probWeight(P(2, '최상', '2', 2), 5), 2);
});
ok('보기 수가 다르면 주관식 판정도 달라진다', () => {
  assert.strictEqual(T.probWeight(P(11, '상', '5'), 4), 8);   // 4지선다에서 5는 보기 밖
  assert.strictEqual(T.probWeight(P(11, '상', '5'), 5), 5);
});

console.log('\n만점은 100점 (문항 수가 달라도)');
ok('배점 합은 항상 만점과 같다 — 8문항', () => {
  const probs = [P(1, '하', '1'), P(2, '중', '2'), P(3, '상', '3'), P(4, '중', 'x=1'),
                 P(5, '하', '2'), P(6, '중상', '4'), P(7, '최상', '5'), P(8, '중', '3')];
  const e = exam(probs);
  assert.strictEqual(T.examTotalPoints(e), 100);
  const sum = probs.reduce((a, p) => a + T.scaledPoints(p, probs, 100, 5), 0);
  assert.ok(near(sum, 100, 0.001), '환산 합이 100이 아님: ' + sum);
});
ok('문항이 25개여도 100점', () => {
  const probs = Array.from({ length: 25 }, (_, i) => P(i + 1, ['하','중','상','중상','최상'][i % 5], String((i % 5) + 1)));
  const e = exam(probs);
  assert.strictEqual(T.examTotalPoints(e), 100);
  const sum = probs.reduce((a, p) => a + T.scaledPoints(p, probs, 100, 5), 0);
  assert.ok(near(sum, 100, 0.001), sum);
});
ok('만점을 바꾸면 거기에 맞춰 나뉜다', () => {
  const probs = [P(1, '하', '1'), P(2, '상', '2')];
  const e = exam(probs, { maxScore: 50 });
  assert.strictEqual(T.examTotalPoints(e), 50);
  assert.ok(near(T.probPoints(probs[0], e) + T.probPoints(probs[1], e), 50, 0.2));
});
ok('문항이 없으면 0', () => {
  assert.strictEqual(T.examTotalPoints(exam([])), 0);
});

console.log('\n어려운 문제가 더 높은 배점을 받는다');
ok('가중치 3 : 5 : 8 비율이 배점에도 그대로 (0.5 단위로 맞춰서)', () => {
  const probs = [P(1, '하', '1'), P(2, '상', '2'), P(3, '중', 'x=1')];   // 3 : 5 : 8, 합 16
  const e = exam(probs);
  const v = probs.map(p => T.probPoints(p, e));
  assert.ok(near(v[0], 18.75, 0.5), '하: ' + v[0]);
  assert.ok(near(v[1], 31.25, 0.5), '상: ' + v[1]);
  assert.ok(near(v[2], 50, 0.5), '서술형: ' + v[2]);
  assert.ok(v[0] < v[1] && v[1] < v[2], '순서가 뒤집힘: ' + v.join(','));
  assert.strictEqual(v[0] + v[1] + v[2], 100, '합이 100이 아님: ' + v.join('+'));
});
ok('같은 난이도면 배점도 똑같다', () => {
  const probs = [P(1, '중', '1'), P(2, '중', '2'), P(3, '상', '3')];
  const e = exam(probs);
  assert.strictEqual(T.probPoints(probs[0], e), T.probPoints(probs[1], e));
  assert.ok(T.probPoints(probs[2], e) > T.probPoints(probs[0], e), '상이 중보다 높아야 함');
});

console.log('\n점수 = 맞은 가중치의 몫 (100점 기준)');
ok('다 맞으면 정확히 만점', () => {
  const probs = [P(1, '하', '1'), P(2, '상', '2'), P(3, '중', 'x=1'), P(4, '최상', '5')];
  const e = exam(probs);
  const ox = {}; probs.forEach(p => ox[p.no] = true);
  const r = T.scoreFromOX(e, ox);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.total, 100);
});
ok('다 틀리면 0점', () => {
  const e = exam([P(1, '하', '1'), P(2, '상', '2')]);
  assert.strictEqual(T.scoreFromOX(e, {}).score, 0);
});
ok('어려운 문제를 맞히면 점수가 더 오른다', () => {
  const e = exam([P(1, '하', '1'), P(2, '상', '2')]);   // 3 : 5, 합 8
  assert.strictEqual(T.scoreFromOX(e, { '1': true }).score, Math.round(3 / 8 * 100));   // 38
  assert.strictEqual(T.scoreFromOX(e, { '2': true }).score, Math.round(5 / 8 * 100));   // 63
});
ok('서술형을 틀리면 크게 깎인다', () => {
  const e = exam([P(1, '하', '1'), P(2, '하', '2'), P(3, '상', 'x=2')]);   // 3 : 3 : 8, 합 14
  const r = T.scoreFromOX(e, { '1': true, '2': true, '3': false });
  assert.strictEqual(r.score, Math.round(6 / 14 * 100));   // 43
  assert.strictEqual(r.total, 100);
});
ok('분석이 없으면 0/0', () => {
  const r = T.scoreFromOX(exam([]), { '1': true });
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.score, 0);
});

console.log('\n답안지에 배점이 보인다');
ok('OMR 답안지에 문항별 배점을 찍는다', () => {
  const probs = [P(1, '하', '1'), P(2, '상', 'x=2')];
  const e = exam(probs);
  set('CLASSES', [{ id: 'c1', name: '고1T A1' }]);
  const h = T.omrSheetHtml(e);
  assert.ok(h.indexOf(T.probPoints(probs[0], e) + '점') >= 0, '1번 배점이 안 보임');
  assert.ok(h.indexOf(T.probPoints(probs[1], e) + '점') >= 0, '2번 배점이 안 보임');
});
ok('주관식은 O·X 두 칸으로 나온다', () => {
  const h = T.omrSheetHtml(exam([P(1, '중', 'x=2')]));
  assert.ok(h.indexOf('맞으면 O') >= 0, '주관식 안내가 없음');
  assert.ok(h.indexOf('①') < 0, '주관식인데 보기 번호가 나옴');
});
ok('객관식은 보기 번호 칸으로 나온다', () => {
  const h = T.omrSheetHtml(exam([P(1, '중', '3')]));
  assert.ok(h.indexOf('①') >= 0 && h.indexOf('⑤') >= 0);
  assert.ok(h.indexOf('맞으면 O') < 0);
});

console.log('\n주관식 O/X 채점 — 선생님 화면');
ok('O면 맞은 것으로 센다', () => {
  const r = T.gradeOmr({ '1': 'x=2', '2': '3' }, { '1': 'O', '2': '3' });
  assert.strictEqual(r.correct, 2);
  assert.strictEqual(r.wrong.length, 0);
});
ok('X면 틀린 것으로 센다', () => {
  const r = T.gradeOmr({ '1': 'x=2' }, { '1': 'X' });
  assert.strictEqual(r.correct, 0);
  assert.strictEqual(r.wrong.join(','), '1');
});
ok('소문자 o/x도 받는다', () => {
  const r = T.gradeOmr({ '1': 'x=2', '2': '7' }, { '1': 'o', '2': 'x' });
  assert.strictEqual(r.correct, 1);
  assert.strictEqual(r.wrong.join(','), '2');
});
ok('안 찍은 문항은 틀린 것 + 빈칸으로', () => {
  const r = T.gradeOmr({ '1': 'x=2', '2': '3' }, { '2': '3' });
  assert.strictEqual(r.correct, 1);
  assert.strictEqual(r.wrong.join(','), '1');
  assert.strictEqual(r.blank.join(','), '1');
});
ok('객관식은 지금까지처럼 번호로 맞춘다', () => {
  const r = T.gradeOmr({ '1': '3', '2': '4' }, { '1': '3', '2': '2' });
  assert.strictEqual(r.correct, 1);
  assert.strictEqual(r.wrong.join(','), '2');
});

console.log('\n주관식 O/X 채점 — 학생 화면');
ok('학생 쪽도 O/X를 같게 센다', () => {
  const r = S.gradeOmr({ '1': 'x=2', '2': '3', '3': '15' }, { '1': 'O', '2': '3', '3': 'X' });
  assert.strictEqual(r.correct, 2);
  assert.strictEqual(r.wrong.join(','), '3');
  assert.strictEqual(r.total, 3);
});
ok('학생 답안 패드가 주관식엔 O/X 버튼을 준다', () => {
  const e = { id: 'e1', title: 'T', qCount: 2, answerKey: { '1': '3', '2': 'x=2' } };
  S.__set('S_EXAMSUBS', []);
  S.__set('OMR_DRAFT', {});
  const h = S.omrPadHtml(e);
  assert.ok(h.indexOf('>O<') >= 0 && h.indexOf('>X<') >= 0, 'O/X 버튼이 없음');
  assert.ok(h.indexOf('①') >= 0, '객관식 보기 번호가 없음');
});
ok('정답이 비어 있으면 객관식으로 본다 (아직 정답을 안 넣은 시험)', () => {
  assert.strictEqual(S.omrIsChoiceAns('', 5), true);
  assert.strictEqual(T.omrIsChoice('', 5), true);
});

console.log('\nJSON 여러 개 합치기');
const oneExam = JSON.stringify({
  examTitle: '2024 평촌고 1-2-1 기출', examRange: '집합 > 집합의 연산까지', source: '2024 평촌고 1-2-1',
  problems: [{ no: 1, bigUnit: '집합', smallUnit: '집합의 포함관계', difficulty: '하', answer: '3' }]
});
const twoExams = JSON.stringify({
  exams: [
    { title: 'A', examRange: '가', problems: [{ no: 1, difficulty: '중', answer: '2' }] },
    { title: 'B', examRange: '나', problems: [{ no: 1, difficulty: '상', answer: 'x=1' }] }
  ]
});
ok('한 파일 안의 시험 여러 건을 다 읽는다', () => {
  const r = T.parseAnalysisExams(twoExams);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r.map(x => x.title).join(','), 'A,B');
});
ok('예전 한 건짜리 형태도 그대로 읽는다', () => {
  const r = T.parseAnalysisExams(oneExam);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].source, '2024 평촌고 1-2-1');
});
ok('배열만 와도 읽는다', () => {
  const r = T.parseAnalysisExams(JSON.stringify([{ no: 1, difficulty: '중', answer: '2' }]));
  assert.strictEqual(r.length, 1);
});
ok('```json 울타리가 붙어 있어도 읽는다', () => {
  assert.strictEqual(T.parseAnalysisExams('```json\n' + oneExam + '\n```').length, 1);
});
ok('JSON이 아니면 빈 배열 (파일 하나가 깨져도 나머지는 살린다)', () => {
  assert.strictEqual(T.parseAnalysisExams('그냥 글').length, 0);
  assert.strictEqual(T.parseAnalysisExams('').length, 0);
});
ok('JSON의 배점은 그대로 남고 가중치로 쓰인다', () => {
  const r = T.parseAnalysisExams(JSON.stringify({ problems: [{ no: 1, difficulty: '하', answer: '3', points: 6 }] }));
  assert.strictEqual(r[0].problems[0].points, 6);
  assert.strictEqual(T.probWeight(r[0].problems[0], 5), 6);
});
ok('배점이 없으면 빈 칸으로 두고 난이도 가중치를 쓴다', () => {
  const r = T.parseAnalysisExams(oneExam);
  assert.strictEqual(r[0].problems[0].points, '');
  assert.strictEqual(T.probWeight(r[0].problems[0], 5), 3);
});
ok('파일 입력이 여러 개를 받게 열려 있다', () => {
  const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
  const i = html.indexOf('id="an-json"');
  assert.ok(i > 0, 'an-json 입력이 없음');
  const tag = html.slice(html.lastIndexOf('<input', i), html.indexOf('>', i) + 1);
  assert.ok(tag.indexOf('multiple') >= 0, 'multiple이 없음: ' + tag);
});

console.log('\n난이도로 다시 매기기');
ok('손으로 넣은 배점을 비워 난이도 가중치로 되돌린다', () => {
  const rows = [P(1, '하', '1', 99), P(2, '상', '2', 1), P(3, '중', 'x=2', 50)];
  T.collectAnalysis = () => rows.map(r => Object.assign({}, r));
  let rendered = null;
  T.renderAnalysis = (a) => { rendered = a; };
  T.__set('lastAnalysis', { problems: [] });
  T.doResetPoints();
  assert.ok(rendered, 'renderAnalysis가 안 불림');
  assert.strictEqual(rendered.problems.map(p => p.points).join(','), ',,');
  assert.strictEqual(rendered.problems.map(p => T.probWeight(p, 5)).join(','), '3,5,8');
});

console.log('\n여러 회차를 이어서 등록');
ok('등록해도 회차 목록이 남고 다음 회차로 넘어간다', () => {
  const mk = (t, d) => ({ title: t, range: '', source: '', summary: '', problems: [P(1, d, '2')] });
  T.__set('anFileExams', [mk('A', '중'), mk('B', '상'), mk('C', '하')]);
  T.__set('anFileDone', []);
  T.__set('anFileIdx', 0);
  T.__set('lastAnalysis', { problems: [P(1, '중', '2')] });
  T.collectAnalysis = () => [P(1, '중', '2')];
  T.renderAnalysis = () => {};
  T.rGrades = () => {};
  // 등록 성공 직후에 하는 일만 흉내낸다
  T.anPickFileExam(1);
  assert.strictEqual(T.__get('anFileIdx'), 1, '다음 회차로 안 넘어감');
  assert.strictEqual(T.__get('anFileExams').length, 3, '회차 목록이 사라짐');
});
ok('회차를 바꾸면 보던 회차의 수정 내용이 담긴다', () => {
  const mk = (t, d) => ({ title: t, range: '', source: '', summary: '', problems: [P(1, d, '2')] });
  T.__set('anFileExams', [mk('A', '중'), mk('B', '상')]);
  T.__set('anFileIdx', 0);
  T.__set('lastAnalysis', { problems: [P(1, '중', '2')] });
  T.__els['an-title'].value = '고친 이름';
  T.collectAnalysis = () => [P(1, '최상', '5')];      // 표에서 난이도를 고쳤다고 치자
  T.renderAnalysis = () => {};
  T.anPickFileExam(1);
  const a = T.__get('anFileExams')[0];
  assert.strictEqual(a.problems[0].difficulty, '최상', '고친 난이도가 안 담김');
  assert.strictEqual(a.title, '고친 이름', '고친 시험명이 안 담김');
});
ok('불러오자마자 첫 회차를 덮어쓰지 않는다 (anFileIdx=-1)', () => {
  const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
  assert.ok(html.indexOf('anFileExams=merged; anFileDone=[]; anFileIdx=-1;') >= 0,
    '여러 파일 로드에서 anFileIdx=-1 로 두지 않음');
});
ok('등록 완료한 회차는 ✓로 표시된다', () => {
  T.__set('anFileExams', [{ title: 'A', problems: [P(1, '중', '2')] }, { title: 'B', problems: [P(1, '상', '2')] }]);
  T.__set('anFileDone', [true, false]);
  T.__set('anFileIdx', 1);
  const h = T.anFileExamsHtml();
  assert.ok(h.indexOf('✓ A') >= 0, '등록 표시가 없음');
  assert.ok(h.indexOf('등록 완료 1개') >= 0, '개수 안내가 없음');
});
ok('고른 반이 표를 다시 그려도 남는다', () => {
  T.__set('anClsDraft', ['c1', 'c2']);
  T.__set('CLASSES', [{ id: 'c1', name: '고1T A1' }, { id: 'c2', name: '고1T A2' }, { id: 'c3', name: '고2 B1' }]);
  T.__set('lastAnalysis', { problems: [P(1, '중', '2')] });
  const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
  assert.ok(html.indexOf("anClsDraft.indexOf(c.id)>=0?'checked':''") >= 0, '반 체크 유지 코드가 없음');
});

console.log('\n지시서');
ok('answer 설명이 지시서에 있다', () => {
  const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
  assert.ok(html.indexOf("'- answer: 객관식은 1~5의 번호 문자열, 주관식은 값 문자열',") >= 0,
    'answer 필드 설명이 빠졌다 — GPT가 정답을 안 준다');
});
ok('배점은 시험지에 있을 때만 쓰라고 한다', () => {
  const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
  assert.ok(html.indexOf("'- points: 배점. 시험지에 적혀 있을 때만") >= 0);
  assert.ok(html.indexOf('만점 100점에 맞춰 나눈다') >= 0);
});

console.log('\n보여주는 배점의 합도 정확히 만점');
ok('25문항에서 표시 배점 합이 만점과 같다', () => {
  const D = ['하','중하','중','중','중상','상','중','하','중','중상',
             '중','상','중하','중','중상','상','중','최상','중','상',
             '중','상','중','중상','상'];
  const probs = D.map((d, k) => P(k + 1, d, k === 17 ? 'k=12' : String((k % 5) + 1)));
  const e = exam(probs);
  const sum = probs.reduce((acc, p) => acc + T.probPoints(p, e), 0);
  assert.strictEqual(Math.round(sum * 10) / 10, 100, '표시 합이 100이 아님: ' + sum);
});
ok('배점은 0.5점 단위로 떨어진다', () => {
  const probs = Array.from({ length: 20 }, (_, k) => P(k + 1, ['하','중','중상','상','최상'][k % 5], String((k % 5) + 1)));
  const e = exam(probs);
  probs.forEach(p => {
    const v = T.probPoints(p, e);
    assert.strictEqual(Math.round(v * 2), v * 2, p.no + '번이 0.5 단위가 아님: ' + v);
  });
});
ok('어려운 문항이 여전히 더 높다', () => {
  const probs = Array.from({ length: 20 }, (_, k) => P(k + 1, ['하','중','상'][k % 3], '2'));
  const e = exam(probs);
  const easy = T.probPoints(probs[0], e);    // 하
  const hard = T.probPoints(probs[2], e);    // 상
  assert.ok(hard > easy, '상(' + hard + ')이 하(' + easy + ')보다 커야 함');
});
ok('범위 밖을 빼도 표시 합이 만점', () => {
  const probs = Array.from({ length: 12 }, (_, k) => P(k + 1, ['하','중','상','중상'][k % 4], '2',
    undefined));
  probs.slice(9).forEach(p => { p.outOfRange = true; });
  const e = exam(probs);
  const sum = probs.reduce((acc, p) => acc + T.probPoints(p, e), 0);
  assert.strictEqual(Math.round(sum * 10) / 10, 100, '합이 100이 아님: ' + sum);
});
console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});
ok('student.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(S.__err, null, S.__err && S.__err.message);
});

console.log('\n' + pass + '개 통과');
