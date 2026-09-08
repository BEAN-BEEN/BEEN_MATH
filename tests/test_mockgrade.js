// 모의고사 등급컷 → 점수만 적어도 등급이 자동으로
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

// 아주 작은 DOM 흉내 — 점수/등급/컷 입력칸
const nodes = {};
function mkInput(id, cls, sid, value) {
  return { id, className: cls || '', dataset: sid ? { sid } : {}, value: value == null ? '' : value };
}
const sb = {
  console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
  document: {
    getElementById: (id) => nodes[id] || null,
    querySelector: (sel) => {
      const m = sel.match(/^\.(\S+)\[data-sid="([^"]+)"\]$/);
      if (!m) return null;
      return Object.values(nodes).find(x => x.className === m[1] && x.dataset.sid === m[2]) || null;
    },
    querySelectorAll: (sel) => {
      const cls = sel.replace(/^\./, '');
      return Object.values(nodes).filter(x => x.className === cls);
    },
    addEventListener: () => {}, createElement: () => ({}), body: {}
  },
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
sb.showToast = (m) => toasts.push(m);
sb.rGrades = () => {};
const get = n => sb.__get(n), set = (n, v) => sb.__set(n, v);

const MID = 'm1';
// 2026 예시 컷: 1등급 92 / 2등급 84 / 3등급 76 / 4등급 66 / 5등급 54 / 6등급 42 / 7등급 32 / 8등급 22
const CUTS = [92, 84, 76, 66, 54, 42, 32, 22];
function setup(cuts, students) {
  Object.keys(nodes).forEach(k => delete nodes[k]);
  (cuts || CUTS).forEach((v, i) => { nodes['mcut-' + MID + '-' + (i + 1)] = mkInput('mcut-' + MID + '-' + (i + 1), '', null, v == null ? '' : String(v)); });
  (students || []).forEach(st => {
    nodes['sc-' + st.id] = mkInput('sc-' + st.id, 'mscore-' + MID, st.id, st.score == null ? '' : String(st.score));
    nodes['gr-' + st.id] = mkInput('gr-' + st.id, 'msgrade-' + MID, st.id, st.grade || '');
  });
}
const gradeOf = id => nodes['gr-' + id].value;

console.log('등급 계산');
ok("컷 위면 그 등급이 나온다", () => {
  assert.strictEqual(sb.mockGradeOf(95, CUTS), '1등급');
  assert.strictEqual(sb.mockGradeOf(92, CUTS), '1등급', '컷과 같은 점수는 그 등급');
  assert.strictEqual(sb.mockGradeOf(91, CUTS), '2등급');
  assert.strictEqual(sb.mockGradeOf(76, CUTS), '3등급');
  assert.strictEqual(sb.mockGradeOf(66, CUTS), '4등급');
});
ok("맨 아래 컷보다 낮으면 9등급", () => {
  assert.strictEqual(sb.mockGradeOf(21, CUTS), '9등급');
  assert.strictEqual(sb.mockGradeOf(0, CUTS), '9등급');
});
ok("컷이 하나도 없으면 등급을 붙이지 않는다", () => {
  assert.strictEqual(sb.mockGradeOf(80, []), '');
  assert.strictEqual(sb.mockGradeOf(80, [null, null, null, null, null, null, null, null]), '');
});
ok("점수가 비어 있으면 빈칸", () => {
  assert.strictEqual(sb.mockGradeOf('', CUTS), '');
  assert.strictEqual(sb.mockGradeOf(null, CUTS), '');
  assert.strictEqual(sb.mockGradeOf('abc', CUTS), '');
});
ok("컷을 일부만 넣어도 넣은 것만으로 판단한다", () => {
  const partial = [null, 84, null, null, 54, null, null, null];
  assert.strictEqual(sb.mockGradeOf(90, partial), '2등급', '1등급컷이 없으면 2등급부터 본다');
  assert.strictEqual(sb.mockGradeOf(60, partial), '5등급');
  assert.strictEqual(sb.mockGradeOf(50, partial), '9등급');
});
ok("저장된 컷을 읽어온다", () => {
  assert.strictEqual(sb.mockCuts({ cuts: [92, '84', '', null, 54] }).join(','), '92,84,,,54');
  assert.strictEqual(sb.mockCuts({}).length, 0);
  assert.strictEqual(sb.mockCuts({ cuts: 'x' }).length, 0);
});

console.log('\n점수를 적으면 등급이 채워지는가');
ok("점수 입력 → 등급 자동", () => {
  setup(CUTS, [{ id: 's1', score: 88 }]);
  sb.mockAutoGrade(MID, 's1');
  assert.strictEqual(gradeOf('s1'), '2등급');
});
ok("점수를 고치면 등급도 따라 바뀐다", () => {
  setup(CUTS, [{ id: 's1', score: 88 }]);
  sb.mockAutoGrade(MID, 's1');
  nodes['sc-s1'].value = '95';
  sb.mockAutoGrade(MID, 's1');
  assert.strictEqual(gradeOf('s1'), '1등급');
});
ok("★ 손으로 적은 등급은 덮어쓰지 않는다", () => {
  setup(CUTS, [{ id: 's1', score: 88, grade: '내가 적은 등급' }]);
  sb.mockAutoGrade(MID, 's1');
  assert.strictEqual(gradeOf('s1'), '내가 적은 등급', '직접 적은 값이 지워짐');
});
ok("자동으로 채운 등급은 점수가 바뀌면 갱신된다", () => {
  setup(CUTS, [{ id: 's1', score: 88 }]);
  sb.mockAutoGrade(MID, 's1');           // 자동 → 2등급 (data-auto=1)
  nodes['sc-s1'].value = '40';
  sb.mockAutoGrade(MID, 's1');
  assert.strictEqual(gradeOf('s1'), '7등급');
});
ok("컷이 없으면 등급을 건드리지 않는다", () => {
  setup([null, null, null, null, null, null, null, null], [{ id: 's1', score: 88 }]);
  sb.mockAutoGrade(MID, 's1');
  assert.strictEqual(gradeOf('s1'), '');
});
ok("점수를 지우면 등급도 비워진다", () => {
  setup(CUTS, [{ id: 's1', score: 88 }]);
  sb.mockAutoGrade(MID, 's1');
  nodes['sc-s1'].value = '';
  sb.mockAutoGrade(MID, 's1');
  assert.strictEqual(gradeOf('s1'), '');
});

console.log('\n전체 다시 계산');
ok("여러 학생을 한 번에 채운다", () => {
  setup(CUTS, [{ id: 's1', score: 95 }, { id: 's2', score: 70 }, { id: 's3', score: 30 }]);
  sb.mockAutoGradeAll(MID);
  assert.strictEqual(gradeOf('s1'), '1등급');
  assert.strictEqual(gradeOf('s2'), '4등급');
  assert.strictEqual(gradeOf('s3'), '8등급');   // 30점은 8등급컷(22) 위, 7등급컷(32) 아래
});
ok("★ 그냥 계산은 손으로 적은 등급을 남긴다", () => {
  setup(CUTS, [{ id: 's1', score: 95, grade: '손으로' }, { id: 's2', score: 70 }]);
  sb.mockAutoGradeAll(MID);
  assert.strictEqual(gradeOf('s1'), '손으로');
  assert.strictEqual(gradeOf('s2'), '4등급');
});
ok("'전체 다시 계산'은 손으로 적은 것까지 덮어쓴다", () => {
  setup(CUTS, [{ id: 's1', score: 95, grade: '손으로' }]);
  toasts.length = 0;
  sb.doRecalcMockGrades(MID);
  assert.strictEqual(gradeOf('s1'), '1등급');
  assert.ok(/다시 계산/.test(toasts.join(' ')), '안내가 없음');
});
ok("컷을 바꾸면 자동으로 채운 등급이 따라 바뀐다", () => {
  setup(CUTS, [{ id: 's1', score: 88 }]);
  sb.mockAutoGradeAll(MID);
  assert.strictEqual(gradeOf('s1'), '2등급');
  nodes['mcut-' + MID + '-1'].value = '85';   // 1등급컷을 낮춤
  sb.mockAutoGradeAll(MID);
  assert.strictEqual(gradeOf('s1'), '1등급');
});

console.log('\n화면·저장');
ok("점수칸이 등급 자동 계산과 연결돼 있다", () => {
  assert.ok(html.includes('oninput="mockAutoGrade(\'${mockId}\',\'${s.id}\')"'), '점수칸에 연결이 없음');
});
ok("등급칸을 직접 고치면 자동 표시가 풀린다", () => {
  assert.ok(html.includes('oninput="this.dataset.auto=\'\'"'), '수동 편집 표시가 없음');
});
ok("등급컷 8칸이 화면에 있다", () => {
  assert.ok(html.includes('id="mcut-${mockId}-${g}"'), '등급컷 입력칸이 없음');
  assert.ok(html.includes('[1,2,3,4,5,6,7,8]'), '8개 등급이 아님');
});
ok("저장할 때 등급컷도 같이 저장한다", () => {
  assert.ok(html.includes('await updateMockExam(mockId, {cuts})'), '컷 저장이 없음');
  assert.ok(html.includes('if(cuts.some(x=>x!=null))'), '컷이 비었는데도 저장함');
});

console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
