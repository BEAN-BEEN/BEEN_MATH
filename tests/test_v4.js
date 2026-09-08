// 시험 분석 v4 계약 — 출제의도 4단계 / 난이도 6단계 / 값 보존 / 여러 반 등록
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const ROOT = require('path').join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };
const okA = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

function inlineScript(file) {
  const html = fs.readFileSync(ROOT + '/' + file, 'utf8');
  const out = []; let i = 0;
  for (;;) {
    const s = html.indexOf('<script', i); if (s < 0) break;
    const gt = html.indexOf('>', s), head = html.slice(s, gt), e = html.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(html.slice(gt + 1, e));
    i = e + 9;
  }
  return out.join('\n;\n');
}

// 브라우저가 <select>에서 실제로 고르는 값: selected가 있으면 그것, 없으면 '첫 번째 option'.
// 예전 버그는 바로 이 규칙 때문이었다 — '문제해결'이 목록에 없으니 첫 항목 '단순계산'이 잡혔다.
function browserSelectValue(optionsHtml) {
  const opts = [];
  const re = /<option value="([^"]*)"([^>]*)>/g;
  let m;
  while ((m = re.exec(optionsHtml))) opts.push({ v: m[1], sel: /\bselected\b/.test(m[2]) });
  const sel = opts.find(o => o.sel);
  return sel ? sel.v : (opts[0] ? opts[0].v : '');
}

const els = {};
const mkEl = (id) => ({ id, value: '', innerHTML: '', textContent: '', dataset: {}, style: {}, checked: false, focus() {}, select() {}, scrollIntoView() {} });
const el = (id) => { if (!els[id]) els[id] = mkEl(id); return els[id]; };
let classChks = [];

const saved = [];
const src = inlineScript('teacher.html') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';
const sb = {
  console, setTimeout: (f) => { }, clearTimeout, setInterval, clearInterval,
  document: {
    getElementById: (id) => el(id), addEventListener: () => {},
    querySelectorAll: (sel) => (sel === '.an-class-chk' ? classChks : []),
    createElement: () => ({}), execCommand: () => true, body: {}
  },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: '', search: '', replace: () => {} },
  navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => {},
  addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
  firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({ collection: () => ({ get: async () => ({ docs: [] }) }) }), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
};
sb.window = sb; sb.globalThis = sb; sb.self = sb;
vm.createContext(sb);
try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) {}
const toasts = [];
sb.showToast = (m, t) => toasts.push((t || '') + ':' + m);
sb.saveExam = async (d) => { saved.push(d); return 'exam_' + saved.length; };
sb.rGrades = () => {};
const get = n => sb.__get(n), set = (n, v) => sb.__set(n, v);

console.log('계약 상수');
ok("출제 의도는 계산·이해·추론·문제해결 네 가지", () => {
  assert.strictEqual(get('AN_ABILITIES').join(','), '계산,이해,추론,문제해결');
});
ok("단계 매핑이 계약과 같다 (계산1 이해2 추론3 문제해결4)", () => {
  const m = get('AN_ABILITY_STAGE');
  assert.strictEqual(m['계산'], 1); assert.strictEqual(m['이해'], 2);
  assert.strictEqual(m['추론'], 3); assert.strictEqual(m['문제해결'], 4);
});
ok("난이도는 6단계", () => {
  assert.strictEqual(get('AN_DIFFS').join(','), '하,중하,중,중상,상,최상');
});
ok("난이도별 예상 정답률 구간이 계약과 같다", () => {
  const r = get('AN_DIFF_RATE');
  assert.strictEqual(r['최상'], '0~19'); assert.strictEqual(r['하'], '80~100'); assert.strictEqual(r['중'], '50~64');
});

console.log('\n값 둔갑 방지 — 예전 버그의 정확한 지점');
ok("드롭다운이 '문제해결'을 그대로 고른다", () => {
  assert.strictEqual(browserSelectValue(sb.anOptions(get('AN_ABILITIES'), '문제해결')), '문제해결');
});
ok("목록에 없는 옛 값('응용')도 첫 항목으로 바뀌지 않고 살아남는다", () => {
  const v = browserSelectValue(sb.anOptions(get('AN_ABILITIES'), '응용'));
  assert.strictEqual(v, '응용');
  assert.notStrictEqual(v, '계산');
});
ok("옛 '단순계산'도 그대로 남는다 (임의 변환 금지)", () => {
  assert.strictEqual(browserSelectValue(sb.anOptions(get('AN_ABILITIES'), '단순계산')), '단순계산');
});
ok("값이 비면 빈 값이 잡힌다 (첫 항목 '계산'으로 새지 않는다)", () => {
  assert.strictEqual(browserSelectValue(sb.anOptions(get('AN_ABILITIES'), '')), '');
});
ok("난이도 '최상'도 '상'으로 깎이지 않는다", () => {
  assert.strictEqual(browserSelectValue(sb.anOptions(get('AN_DIFFS'), '최상')), '최상');
});
ok("난이도 '중하'·'중상'이 그대로 유지된다", () => {
  assert.strictEqual(browserSelectValue(sb.anOptions(get('AN_DIFFS'), '중하')), '중하');
  assert.strictEqual(browserSelectValue(sb.anOptions(get('AN_DIFFS'), '중상')), '중상');
});

console.log('\n검증 (계약의 오류 코드)');
const V = (p) => sb.anValidate([Object.assign({ no: '1' }, p)]);
ok("ability가 없으면 ABILITY_REQUIRED", () => {
  assert.strictEqual(V({})[0].code, 'ABILITY_REQUIRED');
});
ok("허용 밖 ability면 INVALID_ABILITY", () => {
  assert.strictEqual(V({ ability: '응용' })[0].code, 'INVALID_ABILITY');
  assert.strictEqual(V({ ability: '단순계산' })[0].code, 'INVALID_ABILITY');
});
ok("단계가 어긋나면 ABILITY_STAGE_MISMATCH", () => {
  assert.strictEqual(V({ ability: '문제해결', abilityStage: 1 })[0].code, 'ABILITY_STAGE_MISMATCH');
});
ok("허용 밖 난이도면 INVALID_DIFFICULTY", () => {
  assert.strictEqual(V({ ability: '계산', abilityStage: 1, difficulty: '어려움' })[0].code, 'INVALID_DIFFICULTY');
});
ok("올바른 문항은 오류가 없다", () => {
  assert.strictEqual(V({ ability: '추론', abilityStage: 3, difficulty: '중상' }).length, 0);
});

console.log('\n가져오기 — exams 배열과 새 필드');
function paste(json) {
  Object.keys(els).forEach(k => delete els[k]);
  toasts.length = 0;
  set('anTitleDraft', ''); set('anRangeDraft', ''); set('lastAnalysis', null);
  el('an-paste').value = JSON.stringify(json);
  sb.doPasteAnalysis();
  return { rows: (get('lastAnalysis') || {}).problems || [], title: el('an-title').value, range: el('an-range').value, html: el('an-result').innerHTML };
}
const q17 = {
  no: '17', bigUnit: '도형의 방정식', smallUnit: '원과 접선 및 넓이의 최댓값',
  ability: '문제해결', abilityStage: 4, abilityDetail: '복합 모델링·최적화',
  abilityReason: '교점과 접점을 좌표화하고 넓이 최댓값을 하나의 모델로 설계해야 하므로 문제해결이다.',
  difficulty: '최상', predictedCorrectRate: 12, predictedCorrectRateRange: '0~19',
  actualCorrectRate: null, difficultyBasis: 'predicted_rubric', isKiller: true,
  solution: '교점에서 P의 좌표를 구하고 접선 조건으로 관계를 얻는다.', answer: '2'
};
ok("계약의 exams 배열 구조를 읽는다", () => {
  const r = paste({ revision: 'v4', exams: [{ title: '1회 평촌고 2024-1-2-1 공통수학2', examRange: '도형의 방정식 > 원과 접선까지', problems: [q17], summary: '요약' }] });
  assert.strictEqual(r.rows.length, 1);
  assert.strictEqual(r.title, '1회 평촌고 2024-1-2-1 공통수학2');
  assert.strictEqual(r.range, '도형의 방정식 > 원과 접선까지');
});
ok("새 필드가 하나도 안 빠지고 들어온다", () => {
  const p = paste({ exams: [{ title: 't', problems: [q17] }] }).rows[0];
  ['abilityStage', 'abilityDetail', 'abilityReason', 'predictedCorrectRate', 'predictedCorrectRateRange', 'difficultyBasis', 'isKiller']
    .forEach(k => assert.ok(p[k] !== undefined && p[k] !== '', k + '가 비었음'));
  assert.strictEqual(p.isKiller, true);
  assert.strictEqual(p.actualCorrectRate, null);
});
ok("예전 형식(problems만 / 배열만)도 그대로 읽는다", () => {
  assert.strictEqual(paste({ problems: [q17] }).rows.length, 1);
  assert.strictEqual(paste([q17]).rows.length, 1);
});
ok("난이도가 비어도 '중'을 지어내지 않는다", () => {
  const p = paste({ problems: [{ no: '1', bigUnit: '집합', ability: '이해', abilityStage: 2 }] }).rows[0];
  assert.strictEqual(p.difficulty, '', "빈 난이도에 '" + p.difficulty + "'를 채워 넣음");
});
ok("파일에 시험이 여러 개면 모두 보관하고 첫 회차를 띄운다", () => {
  const r = paste({ exams: [{ title: '1회', problems: [q17] }, { title: '9회', problems: [Object.assign({}, q17, { ability: '추론', abilityStage: 3 })] }] });
  assert.strictEqual(get('anFileExams').length, 2);
  assert.strictEqual(r.title, '1회');
  assert.ok(/시험 2개/.test(r.html), '회차 선택 UI가 안 나옴');
});
ok("다른 회차를 고르면 그 회차로 바뀐다", () => {
  paste({ exams: [{ title: '1회', problems: [q17] }, { title: '9회', problems: [Object.assign({}, q17, { no: '17', ability: '추론', abilityStage: 3 })] }] });
  sb.anPickFileExam(1);
  assert.strictEqual(el('an-title').value, '9회');
  assert.strictEqual(get('lastAnalysis').problems[0].ability, '추론');
});

console.log('\n회귀 — 평촌고 2024 17번은 절대 계산/단순계산이 되지 않는다');
ok("표에 그려진 드롭다운이 '문제해결'을 그대로 유지한다", () => {
  const r = paste({ exams: [{ title: '1회 평촌고 2024-1-2-1 공통수학2', problems: [q17] }] });
  const cell = r.html.split('data-k="ability"')[1].split('</select>')[0];
  const v = browserSelectValue(cell);
  assert.strictEqual(v, '문제해결');
  ['계산', '단순계산', '공식이용'].forEach(bad => assert.notStrictEqual(v, bad, bad + '으로 둔갑함'));
});
ok("난이도도 '최상' 그대로", () => {
  const r = paste({ exams: [{ title: 't', problems: [q17] }] });
  const cell = r.html.split('data-k="difficulty"')[1].split('</select>')[0];
  assert.strictEqual(browserSelectValue(cell), '최상');
});
ok("킬러 표시가 화면에 보인다", () => {
  assert.ok(/킬러/.test(paste({ exams: [{ title: 't', problems: [q17] }] }).html), '킬러 표시가 없음');
});
ok("판정 근거가 화면에 실려 있다", () => {
  assert.ok(paste({ exams: [{ title: 't', problems: [q17] }] }).html.includes('좌표화'), 'abilityReason이 안 보임');
});
ok("2025 17번(추론/3단계)도 그대로 유지된다", () => {
  const p2 = Object.assign({}, q17, { ability: '추론', abilityStage: 3, difficulty: '상', isKiller: false });
  const r = paste({ exams: [{ title: '9회 평촌고 2025-1-2-1 공통수학2', problems: [p2] }] });
  const cell = r.html.split('data-k="ability"')[1].split('</select>')[0];
  const v = browserSelectValue(cell);
  assert.strictEqual(v, '추론');
  ['계산', '단순계산'].forEach(bad => assert.notStrictEqual(v, bad));
});

console.log('\n등록 — 검증 통과해야 하고, 여러 반에 한꺼번에');
function setupRegister(rows, clsIds) {
  Object.keys(els).forEach(k => delete els[k]);
  toasts.length = 0; saved.length = 0;
  set('CLASSES', [{ id: 'c1', name: '고1T A1' }, { id: 'c2', name: '고1T B2' }, { id: 'c3', name: '고1S A4' }]);
  set('lastAnalysis', { problems: rows, summary: '요약' });
  set('anKind', '기출');
  el('an-title').value = '기출편 3회';
  el('an-range').value = '집합 > 집합의 포함관계까지';
  el('an-max').value = '100';
  classChks = [{ value: 'c1', checked: false }, { value: 'c2', checked: false }, { value: 'c3', checked: false }];
  (clsIds || []).forEach(id => { const c = classChks.find(x => x.value === id); if (c) c.checked = true; });
}
const goodRow = { no: '1', bigUnit: '집합', smallUnit: '집합의 포함관계', ability: '추론', abilityStage: 3, difficulty: '중', solution: 's', answer: '1' };

(async () => {
  await okA("반을 안 고르면 등록되지 않는다", async () => {
    setupRegister([goodRow], []);
    await sb.doRegisterAnalyzedExam();
    assert.strictEqual(saved.length, 0);
    assert.ok(/반을 하나 이상/.test(toasts.join(' ')), '안내가 안 나옴: ' + toasts.join(' '));
  });
  await okA("쓸 수 없는 출제 의도가 남아 있으면 등록을 막는다", async () => {
    setupRegister([Object.assign({}, goodRow, { ability: '응용' })], ['c1']);
    await sb.doRegisterAnalyzedExam();
    assert.strictEqual(saved.length, 0, '검증에 걸렸는데 저장됨');
    assert.ok(/INVALID_ABILITY/.test(toasts.join(' ')), '오류 코드가 안 보임: ' + toasts.join(' '));
  });
  ok("단계 불일치는 가져올 때 화면에 뜬다", () => {
    // abilityStage는 표에서 고칠 수 있는 칸이 없다. 그래서 등록을 하드 차단하면 빠져나갈 길이 없어진다.
    // 고칠 수 있는 ability를 기준으로 삼고, 불일치 자체는 가져오는 시점에 눈에 보이게 한다.
    const r = paste({ exams: [{ title: 't', problems: [Object.assign({}, q17, { abilityStage: 1 })] }] });
    assert.ok(/ABILITY_STAGE_MISMATCH/.test(r.html), '불일치가 화면에 안 뜸');
  });
  await okA("등록할 때는 ability를 기준으로 단계를 바로잡는다 (ability는 안 건드림)", async () => {
    setupRegister([Object.assign({}, goodRow, { abilityStage: 1 })], ['c1']);
    await sb.doRegisterAnalyzedExam();
    assert.strictEqual(saved.length, 1, '고칠 방법이 없는데 등록이 막힘');
    assert.strictEqual(saved[0].analysis[0].ability, '추론', 'ability가 바뀌었음');
    assert.strictEqual(saved[0].analysis[0].abilityStage, 3, '단계가 안 맞춰짐');
  });
  await okA("고른 반마다 한 건씩 등록된다", async () => {
    setupRegister([goodRow], ['c1', 'c2', 'c3']);
    await sb.doRegisterAnalyzedExam();
    assert.strictEqual(saved.length, 3, '저장 건수 ' + saved.length);
    assert.strictEqual(saved.map(x => x.classId).join(','), 'c1,c2,c3');
    assert.strictEqual(saved.map(x => x.className).join(','), '고1T A1,고1T B2,고1S A4');
  });
  await okA("같은 시험명·범위·분석이 모든 반에 똑같이 들어간다", async () => {
    setupRegister([goodRow], ['c1', 'c2']);
    await sb.doRegisterAnalyzedExam();
    assert.strictEqual(saved[0].title, saved[1].title);
    assert.strictEqual(saved[0].range, '집합 > 집합의 포함관계까지');
    assert.strictEqual(saved[1].range, '집합 > 집합의 포함관계까지');
    assert.strictEqual(saved[0].kind, '기출');
    assert.strictEqual(saved[0].analysis.length, 1);
  });
  await okA("여러 반이면 안내에 반 수를 알려준다", async () => {
    setupRegister([goodRow], ['c1', 'c2']);
    await sb.doRegisterAnalyzedExam();
    assert.ok(/2개 반에 등록/.test(toasts.join(' ')), toasts.join(' '));
  });
  await okA("한 반이면 예전 문구 그대로", async () => {
    setupRegister([goodRow], ['c1']);
    await sb.doRegisterAnalyzedExam();
    assert.ok(!/개 반에 등록/.test(toasts.join(' ')), toasts.join(' '));
  });
  await okA("출제 의도를 고치면 단계가 따라 맞춰진다", async () => {
    setupRegister([Object.assign({}, goodRow, { ability: '문제해결', abilityStage: 3 })], ['c1']);
    await sb.doRegisterAnalyzedExam();
    assert.strictEqual(saved.length, 1, '단계가 자동으로 안 맞아 등록이 막힘');
    assert.strictEqual(saved[0].analysis[0].abilityStage, 4);
  });

  console.log('\n규칙 문서를 붙여넣었을 때');
  ok("규칙 문서임을 알아보고 짚어준다", () => {
    const r = paste({ version:'4.0', abilityPrinciple:'…', problemFields:{no:'…'}, abilityRules:[{stage:1}], difficultyRules:[], updatePolicy:{} });
    assert.ok(/규칙 문서/.test(r.toast || toasts.join(' ')), '그냥 problems 없다고만 함: ' + toasts.join(' '));
    assert.ok(/결과 JSON/.test(toasts.join(' ')), '무엇을 붙여넣어야 하는지 안 알려줌');
  });
  ok("그냥 빈 JSON은 형식 안내를 보여준다", () => {
    paste({ hello: 'world' });
    const m = toasts.join(' ');
    assert.ok(m.includes('문항(problems)을 찾지 못했어요'), m);
    assert.ok(m.includes('exams'), '올바른 형식 예시가 없음');
    assert.ok(!m.includes('규칙 문서'), '규칙 문서가 아닌데 그렇게 안내함');
  });
  ok("제대로 된 결과는 그대로 들어간다", () => {
    const r = paste({ exams:[{ title:'t', problems:[q17] }] });
    assert.strictEqual(r.rows.length, 1);
  });
  console.log('\n지시서·진단');
  ok("지시서가 v4 규칙을 담고 있다", () => {
    const t = sb.analysisPromptText();
    ['계산, 이해, 추론, 문제해결', 'abilityStage', 'abilityDetail', 'abilityReason', 'isKiller', '최상', 'examRange', '집합의 포함관계까지', 'exams']
      .forEach(k => assert.ok(t.includes(k), '지시서에 ' + k + ' 없음'));
  });
  ok("지시서가 옛 분류를 쓰지 말라고 명시한다", () => {
    const t = sb.analysisPromptText();
    assert.ok(/응용, 단순계산, 공식이용/.test(t), '옛 분류 금지 문구가 없음');
  });
  ok("진단 문구가 새 4단계를 모두 덮는다", () => {
    const tips = get('AN_TIPS');
    ['계산', '이해', '추론', '문제해결'].forEach(k => assert.ok(tips[k], k + ' 진단 문구 없음'));
  });
  ok("옛 분류로 저장된 시험도 진단이 나온다", () => {
    const tips = get('AN_TIPS');
    ['단순계산', '공식이용', '그래프해석', '개념이해', '문제해석'].forEach(k => assert.ok(tips[k], k + ' 진단이 사라짐'));
  });
  ok("난이도 색이 6단계를 모두 구분한다", () => {
    const C = get('AN_C');
    assert.strictEqual(sb.anDiffColor('최상'), C.red);
    assert.strictEqual(sb.anDiffColor('상'), C.red);
    assert.strictEqual(sb.anDiffColor('중하'), C.green);
    assert.strictEqual(sb.anDiffColor('하'), C.green);
    assert.strictEqual(sb.anDiffColor('중상'), C.orange);
  });

  console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
})();
