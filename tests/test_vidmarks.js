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

console.log('\n영상 여러 개 한 번에 — 링크만 붙여넣으면 반·날짜·제목');
const TITLES = {
  mrEaPFBZZHM: '261017 고1S A4 함수의 뜻과 그래프. 여러 가지 함수',
  wGvvD_1Rk60: '261017 고1T A1 명제 개념 설명',
  '1dbWobD8k_s': '261016 고1A A5 명제 개념 설명',
  '0RRtKj8JYak': '261018 고1T A2 명제 개념 설명',
  L1YUlerf7Bc: '261018 고1대수Y3 삼각함수의 활용 개념 설명',
  ASf5sogCK5o: '261024 고1T A1 절대부등식 개념 설명 / 명제 오답 풀이',
  lH5f5R5qB5o: '261024 고1S B4 함수 오답 풀이(마스터 9번까지) / 역함수와 합성함수 개념 설명',
  xI5eYHYV2W0: '261023 고1A A5 절대부등식 개념 설명 / 명제 오답 풀이 (마스터 9번 까지)'
};
const CL = [{ id: 'a4', name: '고1S A4' }, { id: 'a1', name: '고1T A1' }, { id: 'a5', name: '고1A A5' }, { id: 'a2', name: '고1T A2' }, { id: 'y3', name: '고1대수 Y3' }, { id: 'b4', name: '고1S B4' }, { id: 'a', name: '고1T' }];
ok('제목에서 날짜·반·내용을 읽는다 (반 이름 띄어쓰기는 상관없다, 긴 이름 먼저)', () => {
  T.__set('CLASSES', CL);
  const r = id => { const p = T.vbParseTitle(TITLES[id]); return p.date + '|' + p.classId + '|' + p.title; };
  assert.strictEqual(r('wGvvD_1Rk60'), '2026-10-17|a1|명제 개념 설명');
  assert.strictEqual(r('L1YUlerf7Bc'), '2026-10-18|y3|삼각함수의 활용 개념 설명');
  assert.strictEqual(r('lH5f5R5qB5o'), '2026-10-24|b4|함수 오답 풀이(마스터 9번까지) / 역함수와 합성함수 개념 설명');
  assert.strictEqual(r('mrEaPFBZZHM'), '2026-10-17|a4|함수의 뜻과 그래프. 여러 가지 함수');
});
ok('모르는 반이면 비워 두고 제목은 그대로', () => {
  const p = T.vbParseTitle('261030 중2 B1 일차함수');
  assert.strictEqual(p.classId, '');
  assert.strictEqual(p.date, '2026-10-30');
  assert.strictEqual(p.title, '중2 B1 일차함수');
});
ok('링크 모양이 달라도 영상 번호를 찾는다', () => {
  assert.strictEqual(T.vbIdOf('https://youtu.be/0lPBen-lOLw'), '0lPBen-lOLw');
  assert.strictEqual(T.vbIdOf('https://www.youtube.com/watch?v=0lPBen-lOLw&t=30'), '0lPBen-lOLw');
  assert.strictEqual(T.vbIdOf('https://youtube.com/shorts/0lPBen-lOLw'), '0lPBen-lOLw');
  assert.strictEqual(T.vbIdOf('그냥 글자'), '');
});
ok('붙여넣으면 8개를 다 읽고, 이미 등록된 영상은 빼 둔다', async () => {
  T.__set('CLASSES', CL);
  T.__set('VIDEOS_CACHE', [{ id: 'old', url: 'https://youtu.be/wGvvD_1Rk60', classId: 'a1', date: '2026-10-17' }]);
  T.fetch = async (u) => { const id = decodeURIComponent(u).match(/youtu\.be\/([A-Za-z0-9_-]{11})/)[1]; return { ok: true, json: async () => ({ title: TITLES[id] }) }; };
  T.rVideos = () => {}; T.showToast = () => {};
  T.__els['vi-bulk'] = { value: Object.keys(TITLES).map(id => 'https://youtu.be/' + id).join('\n') + '\nhttps://youtu.be/mrEaPFBZZHM' };
  await T.doVidBulkRead();
  const rows = T.__get('VB_ROWS');
  assert.strictEqual(rows.length, 8, '같은 링크 두 번은 하나로');
  assert.strictEqual(rows.filter(r => r.dup).map(r => r.id).join(','), 'wGvvD_1Rk60');
  assert.strictEqual(rows.filter(r => r.on).length, 7);
  const saved = [];
  T.saveVideo = async (d) => saved.push(d);
  await T.doVidBulkSave();
  assert.strictEqual(saved.length, 7);
  const y3 = saved.find(d => d.url.endsWith('L1YUlerf7Bc'));
  assert.ok(y3 && y3.classId === 'y3' && y3.className === '고1대수 Y3' && y3.date === '2026-10-18' && y3.title === '삼각함수의 활용 개념 설명');
});
console.log('\n' + pass + ' passed (여러 개 한 번에 포함)');
