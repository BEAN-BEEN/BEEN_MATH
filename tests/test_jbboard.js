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

console.log('\n📸 캡처');
ok('캡처 버튼이 있다', () => {
  assert.ok(th.includes('id="jbShotBtn" onclick="jbCapture()"'), '캡처 버튼이 없음');
  assert.ok(th.includes('async function jbCapture()'), '캡처가 없음');
  assert.ok(th.includes('function jbLoadShot()'), '지연 로딩이 없음');
});
ok('버튼 줄은 그림에서 빼고 가로는 다 펼친다', () => {
  assert.ok(th.includes('data-jbhide'), '버튼 줄 표시가 없음');
  assert.ok(th.includes('data-jbscroll'), '가로 스크롤 표시가 없음');
});
ok('끝나면 화면을 되돌린다', () => {
  assert.ok(/finally\{[\s\S]{0,400}card\.style\.width=keepW;/.test(th), '너비를 안 되돌림');
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
