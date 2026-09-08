// 전체 테스트 실행 —  node tests/run.js
//   teacher.html / student.html 의 인라인 <script>를 통째로 읽어 함수를 직접 부른다.
//   빌드 도구가 없는 한 파일짜리 사이트라, 이게 회귀를 잡는 가장 싼 방법이다.
const fs = require('path') && require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const files = fs.readdirSync(DIR).filter(f => /^test_.*\.js$/.test(f)).sort();

let failed = 0, ranTotal = 0;
console.log('구문 확인');
try {
  execFileSync(process.execPath, [path.join(DIR, 'syntax.js')], { stdio: 'inherit' });
} catch (e) { failed++; }

console.log('');
files.forEach(f => {
  let out = '';
  let bad = false;
  try {
    out = execFileSync(process.execPath, [path.join(DIR, f)], { encoding: 'utf8' });
  } catch (e) {
    out = String((e.stdout || '') + (e.stderr || ''));
    bad = true;
  }
  const fails = out.split('\n').filter(l => l.indexOf('FAIL') >= 0);
  const m = out.match(/(\d+)개 통과/);
  const n = m ? Number(m[1]) : (out.match(/  ok  /g) || []).length;
  ranTotal += n;
  if (fails.length || bad) {
    failed++;
    console.log('FAIL ' + f);
    fails.forEach(l => console.log('   ' + l.trim()));
    if (!fails.length) console.log('   ' + out.trim().split('\n').slice(-3).join('\n   '));
  } else {
    console.log('ok   ' + f + '  (' + n + ')');
  }
});

console.log('');
console.log(failed ? (failed + '개 묶음 실패') : ('전부 통과 — ' + files.length + '개 묶음, ' + ranTotal + '개'));
process.exitCode = failed ? 1 : 0;
