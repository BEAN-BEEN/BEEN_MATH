// 🏠 첫 화면 — 카톡 프로필에서 들어온 학생·학부모에게 소개와 블로그·인스타 링크
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

console.log('카톡으로 주소를 보낼 때 미리보기');
ok('제목 · 설명 · 그림이 있다', () => {
  assert.ok(/<meta property="og:title" content="[^"]+">/.test(h), 'og:title이 없음');
  assert.ok(/<meta property="og:description" content="[^"]+">/.test(h), 'og:description이 없음');
  assert.ok(h.includes('<meta property="og:image" content="https://been-math.com/logo.png">'), 'og:image가 없거나 상대 주소');
  assert.ok(/<meta name="description" content="[^"]+">/.test(h), 'description이 없음');
});

console.log('\n소개');
ok('로그인 아래에 짧은 소개', () => {
  const card = h.indexOf('id="loginBtn"'), intro = h.indexOf('class="intro"');
  assert.ok(intro > 0, '소개가 없음');
  assert.ok(intro > card, '소개가 로그인보다 위에 있음 — 학생은 로그인이 먼저 보여야 한다');
});
ok('학생 화면에 실제로 있는 기능만 적는다', () => {
  ['숙제 확인', '시험지 바로 채점', 'D-day', '직보', '오늘 나간 진도'].forEach(w => assert.ok(h.includes(w), w + '가 없음'));
});
ok('사이트 기능 자세히 보기는 그대로 둔다', () => {
  assert.ok(h.includes('href="about.html"'), '소개 페이지 링크가 사라짐');
});

console.log('\n블로그 · 인스타 링크');
ok('소개 · 자료실 · 인스타그램 세 개', () => {
  ['blogIntro', 'blogLibrary', 'instagram'].forEach(k => assert.ok(h.includes('data-link="' + k + '"'), k + ' 링크가 없음'));
});
ok('새 창으로 연다 (사이트를 떠나지 않게)', () => {
  const links = h.match(/<a href="[^"]*" target="_blank" rel="noopener" data-link=/g) || [];
  assert.strictEqual(links.length, 3, '새 창으로 안 여는 링크가 있음');
});
ok('쌤이 알려준 주소가 들어가 있다', () => {
  assert.ok(h.includes('href="https://m.blog.naver.com/been_math" target="_blank" rel="noopener" data-link="blogIntro"'), '소개 블로그 주소가 다름');
  assert.ok(h.includes('href="https://m.blog.naver.com/been-math" target="_blank" rel="noopener" data-link="blogLibrary"'), '자료실 블로그 주소가 다름');
  assert.ok(h.includes('href="https://www.instagram.com/hyebeen_math/" target="_blank" rel="noopener" data-link="instagram"'), '인스타 주소가 다름');
});
ok('인스타 주소에 공유 추적값(igsh)을 안 남긴다', () => {
  assert.ok(!h.includes('igsh='), '추적값이 남아 있음');
});
ok('주소를 아직 안 넣은 링크는 안 보인다', () => {
  assert.ok(h.includes('.links a[href=""]{display:none}'), '빈 링크가 보임');
  assert.ok(h.includes('.links:not(:has(a[href^="http"])){display:none}'), '링크가 하나도 없을 때 빈 칸이 보임');
});

console.log('\n폰');
ok('내용이 길어져도 스크롤된다', () => {
  // body에 overflow:hidden이 있으면 화면 전체 스크롤이 막혀 아래 링크를 못 누른다
  const body = (h.match(/body\{font-family[^}]*\}/) || [''])[0];
  assert.ok(body, 'body 스타일을 못 찾음');
  assert.ok(!/overflow:hidden/.test(body), 'body가 스크롤을 막음');
  assert.ok(/overflow-x:hidden/.test(body), '가로로 흔들림');
});
ok('한국어가 낱말 중간에서 안 끊긴다', () => {
  assert.ok(/\.intro\{word-break:keep-all/.test(h), 'keep-all이 없음');
});
ok('아주 좁은 폰에서는 기능 칸을 한 줄씩', () => {
  assert.ok(h.includes('@media(max-width:360px){.intro ul{grid-template-columns:1fr}}'), '좁은 화면 처리가 없음');
});

console.log('\n' + pass + '개 통과');
