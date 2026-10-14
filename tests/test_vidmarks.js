// 🔖 영상 북마크 — '3:12 쎈 17번' 줄을 읽어 학생이 그 시점으로 바로 간다
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
const J = a => a.map(m => m.t + '|' + m.label).join(' / ');

console.log('북마크 읽기');
ok('분:초 · 시:분:초 · 구분 기호가 섞여도 읽는다', () => {
  const txt = ['12:05 개념 — 원의 방정식', '0:00 시작', '3:12 쎈 17번', '1:02:30 - 마무리 정리', '4:05) 18번', '  ', '그냥 메모 줄', '9:7 잘못된 시간'].join('\r\n');
  assert.strictEqual(J(T.parseMarks(txt)), '0|시작 / 192|쎈 17번 / 245|18번 / 725|개념 — 원의 방정식 / 3750|마무리 정리');
});
ok('시간만 있고 내용이 없는 줄은 뺀다', () => {
  assert.strictEqual(T.parseMarks('3:12\n4:00 17번').length, 1);
});
ok('시간 표시', () => {
  assert.strictEqual(T.fmtMarkT(192), '3:12');
  assert.strictEqual(T.fmtMarkT(3750), '1:02:30');
  assert.strictEqual(T.fmtMarkT(5), '0:05');
});
ok('두 포털이 같은 코드를 쓴다', () => {
  const cut = f => { const x = fs.readFileSync(path.join(ROOT, f), 'utf8'); const a = x.indexOf('function parseMarks('); return x.slice(a, x.indexOf("(m+':'+p(s));", a) + 14).split('\r').join(''); };
  assert.strictEqual(cut('teacher.html'), cut('student.html'));
  assert.strictEqual(J(S.parseMarks('3:12 쎈 17번')), '192|쎈 17번');
});

console.log('\n화면');
ok('선생님 영상 카드에 북마크 칸과 지시서 복사가 있다', () => {
  T.__set('VIDEOS_CACHE', [{ id: 'v1', title: '10/14 수업', className: '고1T A1', classId: 'c1', date: '2026-10-14', url: 'https://youtu.be/x', marks: [{ t: 192, label: '쎈 17번' }] }]);
  T.__set('CLASSES', [{ id: 'c1', name: '고1T A1' }]);
  T.rVideos();
  const h = T.__els.videosContent.innerHTML;
  assert.ok(h.includes("toggleVidMarks('v1')") && h.includes('북마크 1'));
  assert.ok(h.includes('3:12 쎈 17번'), '저장된 북마크가 칸에 안 채워짐');
  assert.ok(h.includes("doSaveMarks('v1')") && h.includes('copyVidMarksPrompt()'));
  assert.ok(T.vidMarksPrompt().includes('[자막]'));
});
ok('학생 재생 창에 북마크 목록 — 누르면 그 시점으로', () => {
  const h = S.vpMarksHtml({ marks: [{ t: 192, label: '쎈 17번' }, { t: 725, label: '개념 <원>' }] });
  assert.ok(h.includes('onclick="vpSeek(192)"') && h.includes('3:12') && h.includes('12:05'));
  assert.ok(h.includes('개념 &lt;원&gt;'), '글자가 태그로 샘');
  assert.ok(bal(h, 'div') && bal(h, 'button') && bal(h, 'span'));
  assert.strictEqual(S.vpMarksHtml({}), '');
  let sought = null;
  S.__set('VP', { player: { seekTo: (t) => { sought = t; }, playVideo: () => {} } });
  S.vpSeek(725);
  assert.strictEqual(sought, 725);
});

console.log('\n' + pass + ' passed');
