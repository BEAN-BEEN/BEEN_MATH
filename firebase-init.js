// ================================================================
// Firebase 초기화 — 모든 페이지(index/student/teacher)가 공유
// ================================================================
// HTML에서 firebase-app-compat.js → firestore-compat.js → 이 파일 순서로 로드돼요.
// (로그인은 Firebase Auth(이메일) 대신, Firestore 명단 + 이름/핸드폰 방식을 써요)
// ----------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyCjlKRYQnZ4rPKzj06gdRwFgCcyKROntfM",
  authDomain: "been-math.firebaseapp.com",
  projectId: "been-math",
  storageBucket: "been-math.firebasestorage.app",
  messagingSenderId: "84606687461",
  appId: "1:84606687461:web:ed098795a2964442dddc0c",
  measurementId: "G-DN4ZZZQYJJ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 푸시 알림(FCM) 공개 키 (VAPID) — 공개돼도 안전한 값이에요
const FCM_VAPID_KEY = "BNvh-x2hLucnbXNZILzvs6O2RzhsrUvlrUIbtcS5F3RxQqej25oHhz8zz4s2_HoZ-Ue1EmEJzpSKlzS5VVeJiRo";

// ================================================================
// 🌸 계절 테마 — 저장된 테마를 즉시 적용 (양 포털 공통)
//  기본 / spring(봄) / summer(여름) / autumn(가을) / winter(겨울)
// ================================================================
const BM_THEMES = [
  { id:'default', label:'기본', color:'#5B6CF5' },
  { id:'spring',  label:'봄',   color:'#E96A9E' },
  { id:'summer',  label:'여름', color:'#0EA5B7' },
  { id:'autumn',  label:'가을', color:'#DD7A2E' },
  { id:'winter',  label:'겨울', color:'#3F6FD1' }
];
// 저장된(캐시된) 테마를 즉시 적용 — 깜빡임 방지
(function applyTheme(){
  var t = localStorage.getItem('bm_theme');
  if (t && t !== 'default') document.documentElement.setAttribute('data-theme', t);
})();
// 화면에만 테마 반영(저장 X)
function applyThemeOnly(t){
  if (t && t !== 'default') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('bm_theme', t || 'default');
  try { if (typeof renderThemeDots === 'function') renderThemeDots(); } catch(e){}
  try { if (typeof navigate === 'function' && window.__curView) navigate(window.__curView); } catch(e){}
}
// 선생님이 테마 선택 → 화면 반영 + 학원 전체(Firebase)에 저장
function setTheme(t){
  applyThemeOnly(t);
  try { db.collection('config').doc('theme').set({ theme: t || 'default', ts: Date.now() }); } catch(e){}
}
// 로그인/시작 시 학원 공통 테마를 Firebase에서 불러와 적용 (모든 학생 동일 색)
async function loadThemeCloud(){
  try {
    var d = await db.collection('config').doc('theme').get();
    if (d.exists && d.data().theme) applyThemeOnly(d.data().theme);
  } catch(e){}
}
function currentTheme(){ return localStorage.getItem('bm_theme') || 'default'; }
// 사이드바의 #themeDots 영역을 채움
function renderThemeDots(){ var el=document.getElementById('themeDots'); if(el) el.innerHTML=themeDotsHtml(); }
// 테마 선택 점들 HTML (사이드바에서 사용)
function themeDotsHtml(){
  var cur = currentTheme();
  return '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">' +
    BM_THEMES.map(function(t){
      var on = t.id===cur;
      return '<button title="'+t.label+'" onclick="setTheme(\''+t.id+'\')" '+
        'style="width:22px;height:22px;border-radius:50%;cursor:pointer;background:'+t.color+';'+
        'border:2px solid '+(on?'#fff':'transparent')+';box-shadow:0 0 0 '+(on?'2px '+t.color:'1px rgba(0,0,0,.12)')+';transition:all .15s"></button>';
    }).join('') + '</div>';
}

// ================================================================
// 예전 데모(가짜) 데이터 한 번만 청소 — 제로베이스 보장
// ================================================================
(function cleanupOldData(){
  if (localStorage.getItem('bm_schema') === 'v2') return;
  var keep = ['bm_role','bm_studentId','bm_studentName','bm_classId','bm_className','bm_email','bm_uid','bm_demo','bm_schema'];
  Object.keys(localStorage).forEach(function(k){
    if ((k.indexOf('bm_') === 0 || k.indexOf('tbm_') === 0) && keep.indexOf(k) < 0) {
      localStorage.removeItem(k);
    }
  });
  localStorage.setItem('bm_schema', 'v2');
})();

// ================================================================
// 최근 3개월만 보관 — 그 이전의 날짜 기록은 자동 삭제
//  (출석/숙제제출/시험제출/질문/상담 등 날짜가 있는 기록에만 적용)
//  학생 명단·반 정보처럼 날짜 없는 정보는 그대로 유지돼요.
// ================================================================
(function pruneOldData(){
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3);
  const cut = cutoff.getTime();
  const specs = [
    ['tbm_attendance','date'], ['tbm_submissions','submittedAt'], ['tbm_esubs','submittedAt'],
    ['tbm_questions','createdAt'], ['tbm_consults','submittedAt'],
    ['bm_s_attendance','date'], ['bm_s_questions','createdAt'], ['bm_s_consultations','submittedAt']
  ];
  specs.forEach(function(sp){
    var key = sp[0], field = sp[1];
    try {
      var raw = localStorage.getItem(key); if (!raw) return;
      var arr = JSON.parse(raw); if (!Array.isArray(arr)) return;
      var kept = arr.filter(function(o){
        var t = Date.parse((o && o[field]) || '');
        return isNaN(t) ? true : (t >= cut);   // 날짜 못 읽으면 보존
      });
      if (kept.length !== arr.length) localStorage.setItem(key, JSON.stringify(kept));
    } catch(e){}
  });
})();

// ================================================================
// 로그인 가드 — 해당 역할이 아니면 로그인 페이지로 보냄
//  student.html → requireRole('student')
//  teacher.html → requireRole('teacher')
// ================================================================
function requireRole(role){
  if (localStorage.getItem('bm_role') !== role) {
    location.href = 'index.html';
  }
}
