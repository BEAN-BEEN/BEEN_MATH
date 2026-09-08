// 분석서에 출처(2024 평촌고 1-2-1) 싣기 + 등록일은 안 보이게
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
let classChks = [];
const saved = [];
const sb = {
  console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
  document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: (s) => (s === '.an-class-chk' ? classChks : []), createElement: () => ({}), body: {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: '', search: '', replace: () => {} },
  navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
  addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
  firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
};
sb.window = sb; sb.globalThis = sb; sb.self = sb;
vm.createContext(sb);
try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) {}
sb.showToast = () => {};
sb.rGrades = () => {};
sb.saveExam = async (d) => { saved.push(d); return 'ex' + saved.length; };
const get = n => sb.__get(n), set = (n, v) => sb.__set(n, v);

const PROBS = [{ no: '1', bigUnit: '도형의 방정식', smallUnit: '삼각형의 무게중심', ability: '추론', abilityStage: 3, difficulty: '중', solution: 's', answer: '3' }];

console.log('출처 입력칸');
ok("폼에 출처 칸이 있고 상태와 연결돼 있다", () => {
  const line = html.split(/\r?\n/).find(l => l.includes('id="an-source"'));
  assert.ok(line, '출처 입력칸이 없음');
  assert.ok(line.includes('value="${'), '값 바인딩이 없어 다시 그리면 날아감');
  assert.ok(line.includes('oninput="anSourceDraft=this.value"'), '입력이 상태로 안 감');
  assert.ok(line.includes('2024 평촌고 1-2-1'), '어떻게 적는지 예시가 없음');
});

console.log('\n등록할 때 같이 저장되는가');
(async () => {
  function setup(source) {
    Object.keys(els).forEach(k => delete els[k]);
    saved.length = 0;
    set('CLASSES', [{ id: 'c1', name: '고1T A1' }]);
    set('lastAnalysis', { problems: PROBS, summary: '요약' });
    set('anKind', '기출');
    el('an-title').value = '과년도 기출 - 도형의 방정식';
    el('an-range').value = '도형의 방정식 > 삼각형의 무게중심까지';
    el('an-max').value = '100';
    el('an-source').value = source == null ? '' : source;
    classChks = [{ value: 'c1', checked: true }];
  }
  await okA("적은 출처가 시험에 저장된다", async () => {
    setup('2024 평촌고 1-2-1');
    await sb.doRegisterAnalyzedExam();
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].source, '2024 평촌고 1-2-1');
  });
  await okA("여러 반에 등록해도 모두 같은 출처가 들어간다", async () => {
    setup('2024 평촌고 1-2-1');
    set('CLASSES', [{ id: 'c1', name: 'A반' }, { id: 'c2', name: 'B반' }]);
    classChks = [{ value: 'c1', checked: true }, { value: 'c2', checked: true }];
    await sb.doRegisterAnalyzedExam();
    assert.strictEqual(saved.length, 2);
    saved.forEach(x => assert.strictEqual(x.source, '2024 평촌고 1-2-1'));
  });
  await okA("안 적으면 빈 문자열로 들어간다", async () => {
    setup('');
    await sb.doRegisterAnalyzedExam();
    assert.strictEqual(saved[0].source, '');
  });
  await okA("등록에 성공하면 출처 칸도 비워진다", async () => {
    setup('2024 평촌고 1-2-1');
    await sb.doRegisterAnalyzedExam();
    assert.strictEqual(get('anSourceDraft'), '', '다음 회차에 옛 출처가 남음');
  });

  console.log('\n분석서에 어떻게 나오는가');
  function report(exam) {
    set('EXAMS_CACHE', [Object.assign({ id: 'e1', classId: 'c1', className: '고1T A1', kind: '기출', maxScore: 100, analysis: PROBS }, exam)]);
    set('STUDENTS_CACHE', [{ id: 's1', name: '홍길동', classIds: ['c1'] }]);
    set('EXAMSUBS_CACHE', []);
    set('anRepExamId', 'e1'); set('anRepStId', 's1');
    set('anOX', { '1': true });
    return sb.anReportHtml();
  }
  ok("출처가 제목 아래에 나온다", () => {
    const h = report({ title: '과년도 기출 - 도형의 방정식', source: '2024 평촌고 1-2-1', date: '2026-09-02' });
    assert.ok(h.includes('2024 평촌고 1-2-1'), '출처가 안 보임');
    assert.ok(h.indexOf('과년도 기출 - 도형의 방정식') < h.indexOf('2024 평촌고 1-2-1'), '제목보다 위에 나옴');
  });
  ok("등록일은 분석서에 안 나온다", () => {
    const h = report({ title: 'ㅇㅇ', source: '2024 평촌고 1-2-1', date: '2026-09-02' });
    assert.ok(!h.includes('2026-09-02'), '등록일이 아직 찍힘 (과년도 기출인데 오늘 날짜로 보임)');
  });
  ok("출처를 안 적었으면 그 줄이 아예 없다", () => {
    const h = report({ title: 'ㅇㅇ', source: '', date: '2026-09-02' });
    assert.ok(!h.includes('2026-09-02'));
    assert.ok(h.includes('홍길동 학생'), '학생 줄은 그대로 나와야 함');
  });
  ok("학생·반·범위는 그대로 나온다", () => {
    const h = report({ title: 'ㅇㅇ', source: '2024 평촌고 1-2-1', range: '도형의 방정식 > 무게중심까지' });
    assert.ok(h.includes('홍길동 학생'));
    assert.ok(h.includes('고1T A1반'));
    assert.ok(h.includes('범위 도형의 방정식 > 무게중심까지'));
  });
  ok("옛 시험(출처 없음)도 그대로 열린다", () => {
    const h = report({ title: '예전 시험' });
    assert.ok(h.includes('예전 시험'), '옛 시험이 안 열림');
  });

  console.log('\nGPT가 출처를 줬을 때');
  function paste(json) {
    Object.keys(els).forEach(k => delete els[k]);
    set('anTitleDraft', ''); set('anRangeDraft', ''); set('anSourceDraft', ''); set('lastAnalysis', null);
    el('an-paste').value = JSON.stringify(json);
    sb.doPasteAnalysis();
    return { title: el('an-title').value, range: el('an-range').value, source: el('an-source').value };
  }
  ok("exams 배열의 source를 받아 채운다", () => {
    const r = paste({ exams: [{ title: 't', source: '2024 평촌고 1-2-1', problems: PROBS }] });
    assert.strictEqual(r.source, '2024 평촌고 1-2-1');
    assert.strictEqual(get('anSourceDraft'), '2024 평촌고 1-2-1', '다시 그리면 날아감');
  });
  ok("출처를 안 주면 비워둔다 (지어내지 않는다)", () => {
    assert.strictEqual(paste({ exams: [{ title: 't', problems: PROBS }] }).source, '');
  });
  ok("이미 적어둔 출처는 덮어쓰지 않는다", () => {
    Object.keys(els).forEach(k => delete els[k]);
    set('anSourceDraft', ''); set('lastAnalysis', null);
    el('an-source').value = '내가 쓴 출처';
    el('an-paste').value = JSON.stringify({ exams: [{ title: 't', source: 'GPT가 준 출처', problems: PROBS }] });
    sb.doPasteAnalysis();
    assert.strictEqual(el('an-source').value, '내가 쓴 출처');
  });
  ok("지시서가 source를 요청한다", () => {
    const t = sb.analysisPromptText();
    assert.ok(t.includes('- source:'), '지시서에 source 항목이 없음');
    assert.ok(t.includes('2024 평촌고 1-2-1'), '예시가 없음');
  });

  console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
})();
