// 📐 소개 페이지 — 학생·학부모가 볼 수 있는 것만, 틀린 말 없이
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

const a = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8');
const st = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');
const text = a.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');

console.log('없는 기능을 있다고 하지 않는다');
ok('AI 힌트·AI 분석을 내세우지 않는다 (아직 안 열렸다)', () => {
  assert.ok(!/AI/.test(text), 'AI 문구가 남아 있음');
  // 학생 화면 코드에 아직 '오픈 예정'이라고 적혀 있는 동안은 소개에 넣지 않는다
  assert.ok(st.includes('API 연결 후 오픈 예정'), '학생 화면에서 AI가 열렸다면 이 테스트를 고쳐도 된다');
});
ok('옛 로그인 방식(핸드폰 뒤 4자리로 로그인)을 안 쓴다', () => {
  assert.ok(!/뒤\s*4자리로\s*간편\s*로그인/.test(text), '옛 로그인 설명이 남아 있음');
  assert.ok(text.includes('이름 + 나만의 비밀번호'), '지금 로그인 방식이 없음');
  assert.ok(text.includes('처음 한 번만 핸드폰 뒤 4자리로 본인 확인'), '첫 로그인 안내가 없음');
});
ok('지각 체크를 내세우지 않는다 (결석만 기록한다)', () => {
  assert.ok(!/지각·결석을 한 번에 체크/.test(text), '옛 출석 설명이 남아 있음');
});

console.log('\n학생 화면에 실제로 있는 것');
const menu = ['숙제', '오답', '복습', '수업 영상', '자료실', '성적', '학습 리포트', '시간표', '진도표', '급식 · 학사일정'];
ok('소개에 적은 메뉴 이름이 학생 화면 메뉴에 다 있다', () => {
  const tags = (a.match(/<span class="tag">([^<]+)<\/span>/g) || []).map(t => t.replace(/<[^>]+>/g, ''));
  assert.ok(tags.length >= 9, '메뉴 표시가 모자람');
  tags.forEach(t => t.split(' · ').forEach(w => {
    w = w.trim();
    if (w === '홈' || w === 'TEST 리포트' || w === '급식' || w === '학사일정') return;
    assert.ok(st.includes("label:'" + w + "'"), '학생 메뉴에 없는 이름: ' + w);
  }));
});
ok('숙제 현황 · 시험 채점 · 성적 변화 · 내신 D-day · 직보', () => {
  ['숙제 현황', '시험지 바로 채점', '성적 변화', '내신 D-day', '직보'].forEach(w => assert.ok(text.includes(w), w + '가 없음'));
});
ok('채점 · 찍음 · 출제 의도는 학생 화면에 실제로 있다', () => {
  assert.ok(st.includes('function examHintsHtml('), '출제 의도 힌트가 학생 화면에 없음');
  assert.ok(st.includes('OMR_GUESS'), '찍음 표시가 학생 화면에 없음');
  assert.ok(st.includes('function myJikbo('), '직보가 학생 화면에 없음');
});
ok('학생 메뉴와 같은 세 묶음 (공부 / 나의 기록 / 학원·학교)', () => {
  assert.ok(a.includes('<h3>📚 공부</h3>') && a.includes('<h3>📈 나의 기록</h3>') && a.includes('<h3>🏫 학원 · 학교</h3>'), '묶음이 다름');
});

console.log('\n링크 · 미리보기');
ok('블로그 두 개와 인스타', () => {
  assert.ok(a.includes('href="https://m.blog.naver.com/been_math"'), '소개 블로그가 없음');
  assert.ok(a.includes('href="https://m.blog.naver.com/been-math"'), '자료실 블로그가 없음');
  assert.ok(a.includes('href="https://www.instagram.com/hyebeen_math/"'), '인스타가 없음');
  assert.ok(!a.includes('igsh='), '인스타 추적값이 남아 있음');
});
ok('바깥 링크는 새 창으로', () => {
  const ext = a.match(/<a href="https:\/\/[^"]+"[^>]*>/g) || [];
  assert.ok(ext.length >= 4, '바깥 링크 수가 이상함');
  ext.forEach(t => assert.ok(t.includes('target="_blank"') && t.includes('rel="noopener"'), '새 창이 아님: ' + t));
});
ok('카톡 미리보기 (제목 · 설명 · 그림)', () => {
  assert.ok(/<meta property="og:title" content="[^"]+">/.test(a));
  assert.ok(/<meta property="og:description" content="[^"]+">/.test(a));
  assert.ok(a.includes('<meta property="og:image" content="https://been-math.com/logo.png">'));
});
ok('선생님 로그인 버튼은 소개에서 뺐다 (학생·학부모가 보는 곳)', () => {
  assert.ok(!text.includes('선생님 로그인'), '선생님 로그인 버튼이 남아 있음');
});

console.log('\n폰');
ok('좁은 화면에서는 한 줄씩', () => {
  assert.ok(/@media\(max-width:760px\)\{[\s\S]*\.grid\{grid-template-columns:1fr\}/.test(a));
  assert.ok(/@media\(max-width:760px\)\{[\s\S]*\.links\{grid-template-columns:1fr\}/.test(a));
});
ok('한국어가 낱말 중간에서 안 끊긴다', () => {
  assert.ok(/body\{[^}]*word-break:keep-all/.test(a));
});

console.log('\n' + pass + '개 통과');
