// 📆 내신 관리 > 🔶 직보 일정 — 여기도 주차별 표 (플래너와 같은 모양)
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

const th = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
const ph = fs.readFileSync(path.join(ROOT, 'plan.html'), 'utf8');

console.log('직보 일정 탭에도 주차별 표');
ok('탭 맨 위에 붙는다', () => {
  assert.ok(th.includes('function jbWeekBoardHtml()'), '주차별 표가 없음');
  assert.ok(th.includes('return jbWeekBoardHtml() + `<div class="card">'), '탭에 안 붙음');
});
ok('1 · 2 · 3 · 4주 · 앞뒤로 넘기기', () => {
  assert.ok(th.includes('${[1,2,3,4].map(wkBtn).join(\'\')}'), '주 버튼이 없음');
  assert.ok(th.includes('function jbShift(k)'), '넘기기가 없음');
  assert.ok(th.includes('onclick="jbWeekStart=null;rNaesin()"'), '이번 주로 돌아가기가 없음');
});
ok('주마다 날짜 범위와 직보 일수', () => {
  assert.ok(th.includes('🔶 직보 ${wDays}일'), '주 요약이 없음');
  assert.ok(th.includes('<span class="badge b-green">이번 주</span>'), '이번 주 표시가 없음');
});

console.log('\n칸 — 직보 · 1부 · 2부 · 총원');
ok('직보 인원과 오는 학생 이름', () => {
  assert.ok(/직보 <span style="font-size:15px">\$\{N}<\/span>명/.test(th), '직보 인원이 없음');
  assert.ok(th.includes('${g.who.map(x=>anEsc(x.name)).join(\', \')}'), '학생 이름이 없음');
});
ok('부별 인원', () => {
  assert.ok(th.includes('function jbSlotsOn(ds)'), '부별 집계가 없음');
  assert.ok(th.includes('${anEsc(x.slot||x.name)} <span style="font-size:15px">${x.coming.length}</span>명'), '부별 인원이 없음');
  assert.ok(/String\(a\.slot\|\|''\)\.localeCompare\(String\(b\.slot\|\|''\)\)/.test(th), '부 순서대로 안 세움');
});
ok('총원은 1부·2부를 다 듣는 학생을 한 번만 센다', () => {
  assert.ok(th.includes('const uniq=new Set(); slots.forEach(x=>x.coming.forEach(nm=>uniq.add(nm)));'), '겹치는 학생을 두 번 셈');
  assert.ok(th.includes('총 ${total}명'), '총원이 없음');
});
ok('같은 시간에 오는 직보는 시간으로 묶는다', () => {
  assert.ok(th.includes('function jbOnDate(ds)'), '날짜별 직보가 없음');
  assert.ok(th.includes("const t=(m.time||'').trim()||'시간 미정';"), '시간으로 안 묶음');
});

console.log('\n누가 오고 누가 빠지나');
ok('부담임 반만 다니거나 반 없는 학생은 여기서도 뺀다', () => {
  assert.ok(th.includes('makeupIsSchoolWide(m) ? all.filter(x=>!isJikboSkip(x)) : all'), '명단 기준이 다름');
});
ok('주말·공휴일은 다음날 시험으로 안 센다', () => {
  // 토요일이 시험기간 안이라고 해서 금요일 수업을 빠지는 건 아니다
  assert.ok(th.includes('if(!jikboIsExamDay(e, next)) return false;'), '선생님 쪽이 주말을 시험으로 봄');
  assert.ok(ph.includes('if(jikboIsOff(next)) return false;'), '플래너 쪽이 주말을 시험으로 봄');
});
ok('날짜를 누르면 그 아래 명단이 열린다', () => {
  assert.ok(th.includes("jbPick('${ds}')"), '칸이 안 눌림');
  assert.ok(th.includes('function jbDayDetailHtml()'), '명단이 없음');
  assert.ok(th.includes('${jbDayDetailHtml()}'), '표에 안 붙음');
});
ok('다시 누르면 닫힌다', () => {
  assert.ok(th.includes("function jbPick(ds){ jbPickDate=(jbPickDate===ds?'':ds); rNaesin(); }"), '토글이 아님');
});
ok('올 학생 · 직보로 빠짐 · 다른 과목 시험 준비', () => {
  assert.ok(th.includes('🔶 직보로 빠짐'), '직보로 빠지는 학생이 없음');
  assert.ok(th.includes('📝 다음날 다른 과목 시험'), '다른 시험 준비로 빠지는 학생이 없음');
  assert.ok(th.includes("✅ ${x.coming.map(anEsc).join(', ')||'-'}"), '오는 학생이 없음');
});
ok('고른 날짜에 테두리', () => {
  assert.ok(th.includes('isSel=ds===jbPickDate'), '고른 날 표시가 없음');
});

console.log('\n📸 캡처 — 숙제처럼 띄우고 그 부분만 캡처');
ok('버튼을 누르면 깨끗한 화면이 뜬다', () => {
  assert.ok(th.includes('onclick="openJbShot()">📸 캡처'), '캡처 버튼이 없음');
  assert.ok(th.includes('function openJbShot()'), '띄우기가 없음');
  assert.ok(th.includes('function closeJbShot()'), '닫기가 없음');
  assert.ok(th.includes('id="jbShotSheet"'), '흰 화면이 없음');
});
ok('버튼은 캡처할 흰 부분 밖에 둔다 (숙제 캡처와 같게)', () => {
  assert.ok(th.includes('id="jbShotControls"'), '조절 버튼 자리가 없음');
  assert.ok(th.includes('아래 흰 부분만 캡처해서 보내세요'), '안내가 없음');
});
ok('폰에서 읽히게 날짜를 위에서 아래로 늘어놓는다', () => {
  // 가로 7칸은 폰에서 글씨가 뭉갠다
  assert.ok(th.includes('max-width:430px'), '폭이 폰에 안 맞음');
  assert.ok(th.includes('BEEN MATH 직보'), '머리말이 없음');
});
ok('하루마다 직보 인원 · 부별 인원 · 총원', () => {
  assert.ok(th.includes('직보 ${jbN}명'), '직보 인원이 없음');
  assert.ok(th.includes('총 ${jbN+uniq.size}명'), '총원이 없음');
  assert.ok(/const uniq=new Set\(\);/.test(th), '겹치는 학생을 두 번 셈');
});
ok('1 · 2 · 3 · 4주와 앞뒤로 넘기기', () => {
  assert.ok(th.includes("[1,2,3,4].map(wk).join('')"), '주 버튼이 없음');
  assert.ok(th.includes("nav(-7,'◀')+nav(7,'▶')"), '넘기기가 없음');
});
ok('직보도 수업도 없는 날은 안 적는다', () => {
  assert.ok(th.includes('.filter(r=>r.on.length || r.slots.length);'), '빈 날도 적음');
});
ok('그림 파일로 내려받던 건 걷어냈다', () => {
  assert.ok(!th.includes('html2canvas'), 'html2canvas가 남아 있음');
  assert.ok(!th.includes('jbCapture'), '옛 캡처가 남아 있음');
});
ok('주황색 시간·학교 글씨를 줄였다', () => {
  assert.ok(th.includes('font-size:12.5px;font-weight:800;color:var(--orange)'), '아직 큼');
  assert.ok(!th.includes('font-size:14px;font-weight:800;color:var(--orange)'), '옛 크기가 남아 있음');
});

console.log('\n안전');
ok('학생·학교 이름에 태그가 있어도 안 샌다', () => {
  assert.ok(th.includes('${anEsc(g.name)}'), '학교 이름을 그대로 넣음');
  assert.ok(th.includes('${anEsc(x.name)}'), '반 이름을 그대로 넣음');
});
ok('연휴가 길어도 칸이 안 깨진다 (공휴일·수학시험일 표시)', () => {
  assert.ok(th.includes('🇰🇷'.length ? '${hol}' : ''), '');
  assert.ok(th.includes('📐 ${math.join(\' \')}'), '수학 시험일 표시가 없음');
  assert.ok(th.includes('math.indexOf(nm)<0'), '같은 학교가 두 번 찍힘');
});

console.log('\n' + pass + '개 통과');
