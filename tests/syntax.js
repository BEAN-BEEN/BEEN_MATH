// 인라인 <script>를 모아 문법만 확인한다 (브라우저가 먼저 잡아주길 기다리지 않도록)
//   한 파일짜리 포털이라 문법이 하나 깨지면 화면 전체가 멈춘다.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let bad = 0;
['teacher.html', 'student.html'].forEach(f => {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const out = []; let i = 0;
  for (;;) {
    const s = html.indexOf('<script', i); if (s < 0) break;
    const gt = html.indexOf('>', s), head = html.slice(s, gt), e = html.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(html.slice(gt + 1, e));
    i = e + 9;
  }
  const src = out.join('\n;\n');
  try { new vm.Script(src, { filename: f }); console.log('  ok   ' + f); }
  catch (err) { bad++; console.log('  FAIL ' + f + ' :: ' + err.message); }
});

// Worker는 모듈 문법이라 따로 본다
try {
  new vm.SourceTextModule
    ? null : null;
} catch (e) {}
try {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
  new vm.Script('(async()=>{' + src.replace(/^export default/m, 'const __d =') + '})', { filename: 'src/index.js' });
  console.log('  ok   src/index.js');
} catch (err) { bad++; console.log('  FAIL src/index.js :: ' + err.message); }

process.exitCode = bad ? 1 : 0;
