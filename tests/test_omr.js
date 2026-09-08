// OMR 답안지 — 객관식/주관식을 정답 모양으로 나눈다 + 수학일 바로 입력
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const ROOT = require('path').join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };
const okA = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
const src = (function () {
  const out = []; let i = 0;
  for (;;) {
    const s = html.indexOf('<script', i); if (s < 0) break;
    const gt = html.indexOf('>', s), head = html.slice(s, gt), e = html.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(html.slice(gt + 1, e));
    i = e + 9;
  }
  return out.join('\n;\n');
})() + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';

const els = {};
const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '' }; return els[id]; };
const updated = [];
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
try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) {}
const toasts = [];
sb.showToast = (m, t) => toasts.push({ m, t });
sb.rNaesin = () => {};
sb.rGrades = () => {};
sb.updateSchoolExam = async (id, d) => { updated.push({ id, d }); };
const get = n => sb.__get(n), set = (n, v) => sb.__set(n, v);

function exam(probs, extra) {
  return Object.assign({
    id: 'e1', title: '2024 평촌고 1-2-1 기출', source: '2024 평촌고 1-2-1',
    className: '고1T A1', classId: 'c1', maxScore: 100, analysis: probs || []
  }, extra || {});
}
function setExam(e) { set('EXAMS_CACHE', [e]); set('akExamId', e.id); set('CLASSES', [{ id: 'c1', name: '고1T A1' }]); }

console.log('객관식·주관식 판정');
ok("정답이 보기 번호면 객관식", () => {
  assert.strictEqual(sb.omrIsChoice('3', 5), true);
  assert.strictEqual(sb.omrIsChoice('5', 5), true);
  assert.strictEqual(sb.omrIsChoice('1', 5), true);
});
ok("보기 수를 넘는 숫자면 주관식", () => {
  assert.strictEqual(sb.omrIsChoice('7', 5), false, '보기가 5개인데 7이면 주관식');
  assert.strictEqual(sb.omrIsChoice('12', 5), false);
  assert.strictEqual(sb.omrIsChoice('7', 9), true, '보기가 9개면 7도 객관식');
});
ok("값이나 식이면 주관식", () => {
  assert.strictEqual(sb.omrIsChoice('24', 5), false);
  assert.strictEqual(sb.omrIsChoice('-3', 5), false);
  assert.strictEqual(sb.omrIsChoice('a+b', 5), false);
  assert.strictEqual(sb.omrIsChoice('1/2', 5), false);
});
ok("정답이 아직 없으면 객관식으로 둔다", () => {
  assert.strictEqual(sb.omrIsChoice('', 5), true);
  assert.strictEqual(sb.omrIsChoice(null, 5), true);
});
ok("문항별로 나눠 판정한다", () => {
  const e = exam([
    { no: '1', answer: '3' }, { no: '2', answer: '24' }, { no: '3', answer: '' }, { no: '4', answer: '5' }
  ]);
  setExam(e);
  const t = sb.omrTypeMap(e);
  assert.strictEqual(t['1'], '객관식');
  assert.strictEqual(t['2'], '주관식', '24는 주관식이어야 함');
  assert.strictEqual(t['3'], '객관식');
  assert.strictEqual(t['4'], '객관식');
});
ok("저장된 정답표가 분석서보다 우선한다", () => {
  const e = exam([{ no: '1', answer: '3' }], { answerKey: { '1': '48' } });
  setExam(e);
  assert.strictEqual(sb.omrTypeMap(e)['1'], '주관식', '선생님이 고친 정답을 안 봄');
});

console.log('\n답안지 모양');
ok("문항마다 번호와 형식이 찍힌다", () => {
  const e = exam([{ no: '1', answer: '3' }, { no: '2', answer: '24' }]);
  setExam(e);
  const h = sb.omrSheetHtml(e);
  assert.ok(h.includes('객관식'), '객관식 표시가 없음');
  assert.ok(h.includes('주관식'), '주관식 표시가 없음');
  assert.ok(/전체 2문항 \(객관식 1 · 주관식 1\)/.test(h), '문항 수 요약이 틀림: ' + (h.match(/전체[^<]*/) || [])[0]);
});
ok("객관식은 보기 동그라미, 주관식은 O·X 두 개", () => {
  const e = exam([{ no: '1', answer: '3' }, { no: '2', answer: '24' }]);
  setExam(e);
  const h = sb.omrSheetHtml(e);
  assert.ok(h.includes('①') && h.includes('⑤'), '보기 동그라미가 없음');
  assert.ok(/border-radius:50%/.test(h), '동그라미 모양이 아님');
  assert.ok(h.includes('>O</span>') && h.includes('>X</span>'), '주관식 O·X가 없음');
  assert.ok(h.includes('맞으면 O'), '어떻게 표시하는지 안내가 없음');
});
ok("주관식 답을 옮겨 적는 빈 칸은 더 이상 없다", () => {
  const e = exam([{ no: '2', answer: '(1,1), (-1,0)' }]);
  setExam(e);
  const h = sb.omrSheetHtml(e);
  assert.ok(!/height:20px;border:1\.2px solid #64748B;border-radius:4px"><\/div>/.test(h), '빈 칸이 남아 있음');
  assert.ok(h.includes('>O</span>'), 'O가 없음');
});
ok("답안지 안내가 O·X 방식으로 바뀌었다", () => {
  const e = exam([{ no: '1', answer: '3' }]);
  setExam(e);
  assert.ok(sb.omrSheetHtml(e).includes('맞았으면 <strong>O</strong>'), '안내가 옛날 그대로');
});

console.log('\n주관식은 O/X로 채점');
ok("O면 맞음, X면 틀림", () => {
  const key = { '1': '3', '2': '(1,1), (-1,0)' };
  const g = sb.gradeOmr(key, { '1': '3', '2': 'O' });
  assert.strictEqual(g.correct, 2, 'O를 맞음으로 안 셈');
  assert.strictEqual(g.wrong.length, 0);
  const g2 = sb.gradeOmr(key, { '1': '3', '2': 'X' });
  assert.strictEqual(g2.correct, 1);
  assert.strictEqual(g2.wrong.join(','), '2');
});
ok("소문자 o·x도 알아본다", () => {
  const g = sb.gradeOmr({ '1': '24' }, { '1': 'o' });
  assert.strictEqual(g.correct, 1);
});
ok("객관식은 예전처럼 정답과 맞춰본다", () => {
  const key = { '1': '3', '2': '5' };
  const g = sb.gradeOmr(key, { '1': '3', '2': '2' });
  assert.strictEqual(g.correct, 1);
  assert.strictEqual(g.wrong.join(','), '2');
});
ok("주관식 정답을 그대로 적어도 맞는 것으로 센다", () => {
  const g = sb.gradeOmr({ '1': '24' }, { '1': '24' });
  assert.strictEqual(g.correct, 1, '값을 직접 적은 경우도 살려야 함');
});
ok("안 찍은 문항은 여전히 틀린 것으로", () => {
  const g = sb.gradeOmr({ '1': '3', '2': '24' }, { '1': '3' });
  assert.strictEqual(g.wrong.join(','), '2');
  assert.strictEqual(g.blank.join(','), '2');
});
ok("보기 수를 4로 바꾸면 동그라미도 4개", () => {
  const e = exam([{ no: '1', answer: '3' }], { choices: 4 });
  setExam(e);
  const h = sb.omrSheetHtml(e);
  assert.strictEqual((h.match(/border-radius:50%/g) || []).length, 4);
});
ok("시험명·출처·범위가 머리말에 나온다", () => {
  const e = exam([{ no: '1', answer: '3' }], { range: '도형의 방정식 > 평면좌표까지' });
  setExam(e);
  const h = sb.omrSheetHtml(e);
  assert.ok(h.includes('2024 평촌고 1-2-1 기출'));
  assert.ok(h.includes('2024 평촌고 1-2-1'), '출처가 없음');
  assert.ok(h.includes('도형의 방정식 &gt; 평면좌표까지') || h.includes('도형의 방정식 > 평면좌표까지'), '범위가 없음');
  assert.ok(h.includes('고1T A1반'), '반이 없음');
});
ok("이름·반·날짜 적는 칸이 있다", () => {
  const e = exam([{ no: '1', answer: '3' }]);
  setExam(e);
  const h = sb.omrSheetHtml(e);
  ['이름', '반', '날짜'].forEach(k => assert.ok(h.includes(k), k + ' 칸이 없음'));
});
ok("문항이 없으면 답안지를 만들지 않는다", () => {
  const e = exam([]);
  setExam(e);
  assert.strictEqual(sb.omrSheetHtml(e), '');
  assert.strictEqual(sb.omrSheetHtml(null), '');
});
ok("문항 번호가 시험지 그대로 쓰인다 (1부터 다시 매기지 않는다)", () => {
  const e = exam([{ no: '17', answer: '2' }, { no: '18', answer: '30' }]);
  setExam(e);
  const h = sb.omrSheetHtml(e);
  assert.ok(h.includes('>17<'), '17번이 없음');
  assert.ok(h.includes('>18<'), '18번이 없음');
});
ok("칸이 4열로 채워지고 빈 자리는 메운다", () => {
  const e = exam([1, 2, 3, 4, 5].map(i => ({ no: String(i), answer: '3' })));
  setExam(e);
  const h = sb.omrSheetHtml(e);
  assert.strictEqual((h.match(/<tr>/g) || []).length, 2, '5문항이면 2줄');
  assert.ok(/<td style="border:1px solid #CBD5E1"><\/td>/.test(h), '남는 칸을 안 메움');
});
ok("인쇄 버튼이 정답 패널에 있다", () => {
  assert.ok(html.includes('onclick="printOmrSheet()"'), '인쇄 버튼이 없음');
});
ok("시험을 안 고르면 인쇄하지 않는다", () => {
  set('akExamId', ''); toasts.length = 0;
  sb.printOmrSheet();
  assert.ok(/시험을 먼저 고르세요/.test(toasts.map(t => t.m).join(' ')));
});

console.log('\n분석서 정답 → 정답표 → 자동 채점 (따로 입력하지 않아도)');
const PROBS4 = [
  { no: '1', bigUnit: '도형의 방정식', smallUnit: '평면좌표', ability: '계산', abilityStage: 1, difficulty: '하', solution: 's1', answer: '3' },
  { no: '2', bigUnit: '도형의 방정식', smallUnit: '평면좌표', ability: '이해', abilityStage: 2, difficulty: '중', solution: 's2', answer: '5' },
  { no: '3', bigUnit: '도형의 방정식', smallUnit: '직선의 방정식', ability: '추론', abilityStage: 3, difficulty: '중상', solution: 's3', answer: '24' }
];
ok("분석 문항의 정답이 정답표 모양으로 나온다", () => {
  const k = sb.answerKeyFromAnalysis({ analysis: PROBS4 });
  assert.strictEqual(k['1'], '3');
  assert.strictEqual(k['3'], '24');
  assert.strictEqual(Object.keys(k).length, 3);
});
ok("정답이 비어 있는 문항은 넣지 않는다", () => {
  const k = sb.answerKeyFromAnalysis({ analysis: [{ no: '1', answer: '' }, { no: '2', answer: '4' }] });
  assert.strictEqual(Object.keys(k).join(','), '2');
});
ok("등록할 때 정답표를 같이 저장한다", () => {
  assert.ok(html.includes('answerKey:keyFromProbs'), '등록 시 정답표를 안 담음');
  assert.ok(html.includes('const keyFromProbs=answerKeyFromAnalysis({analysis:probs});'), '정답표를 안 만듦');
});
ok("정답 패널에서 시험을 고르면 분석서 정답으로 채워진다 (옛 시험도)", () => {
  const e = exam(PROBS4);              // answerKey 없음
  set('EXAMS_CACHE', [e]);
  sb.akPick(e);
  const d = get('akDraft');
  assert.strictEqual(d['1'], '3', '분석서 정답이 안 들어옴');
  assert.strictEqual(d['3'], '24');
});
ok("이미 저장된 정답표가 있으면 그게 우선", () => {
  const e = exam(PROBS4, { answerKey: { '1': '4' } });
  set('EXAMS_CACHE', [e]);
  sb.akPick(e);
  assert.strictEqual(get('akDraft')['1'], '4', '선생님이 고친 정답이 분석서에 덮임');
});
ok("★ 정답표 + 학생 답으로 정오표가 자동으로 채워진다", () => {
  const e = exam(PROBS4, { answerKey: { '1': '3', '2': '5', '3': '24' } });
  set('EXAMS_CACHE', [e]);
  set('STUDENTS_CACHE', [{ id: 's1', name: '김서현', classIds: ['c1'] }]);
  // 학생이 찍은 답: 1번 맞음, 2번 틀림, 3번 맞음
  set('EXAMSUBS_CACHE', [{ id: 'sub1', examId: 'e1', studentId: 's1', answers: { '1': '3', '2': '2', '3': '24' } }]);
  set('anRepExamId', 'e1'); set('anRepStId', 's1'); set('anOX', null);
  sb.anLoadOX();
  const ox = get('anOX');
  assert.strictEqual(ox['1'], true, '1번은 맞아야 함');
  assert.strictEqual(ox['2'], false, '2번은 틀려야 함');
  assert.strictEqual(ox['3'], true, '3번(주관식)도 맞아야 함');
});
ok("분석서에 정답·내 답·정오가 함께 찍힌다", () => {
  const e = exam(PROBS4, { answerKey: { '1': '3', '2': '5', '3': '24' } });
  set('EXAMS_CACHE', [e]);
  set('STUDENTS_CACHE', [{ id: 's1', name: '김서현', classIds: ['c1'] }]);
  set('EXAMSUBS_CACHE', [{ id: 'sub1', examId: 'e1', studentId: 's1', answers: { '1': '3', '2': '2', '3': '24' } }]);
  set('anRepExamId', 'e1'); set('anRepStId', 's1'); set('anOX', null);
  const h = sb.anReportHtml();
  assert.ok(h.includes('>정답</th>') && h.includes('>내 답</th>'), '정답·내 답 칸이 없음');
  assert.ok(/맞은 문항/.test(h), '채점 요약이 없음');
  // 2번만 틀렸으니 3문항 중 2개 정답
  assert.ok(/2개/.test(h), '맞은 개수가 안 맞음');
});
ok("학생이 답을 안 냈으면 정오표를 멋대로 만들지 않는다", () => {
  const e = exam(PROBS4, { answerKey: { '1': '3' } });
  set('EXAMS_CACHE', [e]);
  set('EXAMSUBS_CACHE', []);
  set('anRepExamId', 'e1'); set('anRepStId', 's1'); set('anOX', null);
  sb.anLoadOX();
  const ox = get('anOX');
  // 기록이 없으면 '전부 맞음'에서 시작해 틀린 것만 누르는 기존 방식
  assert.ok(ox && ox['1'] === true, '기본값이 맞음이어야 함');
});

console.log('\n주관식 정답 직접 입력');
ok("주관식 정답을 글자로 적을 수 있다", () => {
  set('akDraft', {});
  sb.akSetText('20', '(1,1), (-1,0), (3/2,0)');
  assert.strictEqual(get('akDraft')['20'], '(1,1), (-1,0), (3/2,0)');
});
ok("앞뒤 공백은 정리한다", () => {
  set('akDraft', {});
  sb.akSetText('1', '  24  ');
  assert.strictEqual(get('akDraft')['1'], '24');
});
ok("타이핑 중에는 화면을 다시 그리지 않는다 (커서가 튀지 않게)", () => {
  const line = html.split(/\r?\n/).find(l => l.indexOf('function akSetText(') >= 0);
  assert.ok(line, 'akSetText를 못 찾음');
  assert.ok(!/rGrades\(\)/.test(line), '입력할 때마다 다시 그리면 커서가 튄다');
});
ok("정답표에 주관식 입력칸이 있다", () => {
  assert.ok(html.includes('oninput="akSetText('), '주관식 칸이 없음');
  assert.ok(html.includes('placeholder="주관식"'), '무엇을 적는 칸인지 안 보임');
});
ok("보기 번호가 아닌 정답은 '주관식'으로 표시된다", () => {
  assert.ok(html.includes('>주관식</span>'), '주관식 표시가 없음');
  assert.ok(html.includes('!omrIsChoice(cur, ch)'), '판정을 안 씀');
});

console.log('\n예전에 등록한 시험 정답표 채우기');
ok("정답표가 비었고 분석서 정답이 있는 시험만 골라낸다", () => {
  set('EXAMS_CACHE', [
    exam(PROBS4, { id: 'a', answerKey: {} }),
    exam(PROBS4, { id: 'b', answerKey: { '1': '3' } }),
    exam([], { id: 'c' })
  ]);
  const need = sb.examsNeedingKey();
  assert.strictEqual(need.length, 1, '골라낸 시험 수가 다름');
  assert.strictEqual(need[0].id, 'a');
});
ok("한꺼번에 채우기 버튼이 있다", () => {
  assert.ok(html.includes('onclick="doFillAnswerKeys()"'), '버튼이 없음');
  assert.ok(html.includes('다시 입력하지 않아도 됩니다'), '안내가 없음');
});
ok("이미 정답표가 있는 시험은 건드리지 않는다고 못박았다", () => {
  const i = html.indexOf('async function doFillAnswerKeys(');
  const body = html.slice(i, i + 900);
  assert.ok(body.includes('이미 정답표가 있는 시험은 건드리지 않아요'), '확인창에 안내가 없음');
  assert.ok(body.includes('examsNeedingKey()'), '대상을 좁히지 않음');
});

console.log('\n수학 시험일 바로 입력');
(async () => {
  await okA("날짜를 넣으면 바로 저장된다", async () => {
    updated.length = 0; toasts.length = 0;
    await sb.doSetExamMathDate('ex1', '2026-10-06');
    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].d.mathDate, '2026-10-06');
    assert.strictEqual(updated[0].d.mathDates[0].date, '2026-10-06', 'mathDates도 같이 맞춰야 함');
    assert.ok(/직보 자동 생성에 잡혀요/.test(toasts.map(t => t.m).join(' ')), '무엇이 달라지는지 안 알려줌');
  });
  await okA("빈 값이나 잘못된 값이면 저장하지 않는다", async () => {
    updated.length = 0;
    await sb.doSetExamMathDate('ex1', '');
    await sb.doSetExamMathDate('ex1', '2026-13-99x');
    assert.strictEqual(updated.length, 0);
  });
  ok("목록의 '미정' 자리가 날짜 입력칸이다", () => {
    assert.ok(html.includes("onchange=\"doSetExamMathDate('${e.id}',this.value)\""), '입력칸이 없음');
    assert.ok(html.includes('수학일 미정 — 넣으면 바로 저장'), '안내가 없음');
  });
  ok("시험 기간을 벗어나지 않게 막아준다", () => {
    assert.ok(html.includes('${e.startDate?`min="${e.startDate}"`:\'\'}'), 'min 제한이 없음');
    assert.ok(html.includes('${e.endDate?`max="${e.endDate}"`:\'\'}'), 'max 제한이 없음');
  });

  console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
})();
