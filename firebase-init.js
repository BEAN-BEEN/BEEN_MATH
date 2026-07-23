// ================================================================
// 🌐 카카오톡 인앱 브라우저 가드 — 카톡 안에서는 로그인(익명인증)·사진 올리기가
//    막히는 경우가 많아, 외부 브라우저(크롬/사파리)로 열도록 유도한다.
//    (다른 파일보다 먼저, firebase 초기화 전에 실행)
// ================================================================
(function inAppBrowserGuard(){
  try{
    var ua = navigator.userAgent || '';
    if(!/KAKAOTALK/i.test(ua)) return;                 // 카카오톡 인앱 브라우저만 대상
    var isAndroid = /Android/i.test(ua);
    var url = location.href;
    if(isAndroid){ try{ location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url); }catch(e){} }
    var show = function(){
      if(document.getElementById('__inappGuard')) return;
      var d = document.createElement('div'); d.id='__inappGuard';
      d.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#fff;color:#1E293B;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px;font-family:-apple-system,BlinkMacSystemFont,sans-serif';
      d.innerHTML='<div style="font-size:46px;margin-bottom:10px">🌐</div>'+
        '<div style="font-size:18px;font-weight:800;margin-bottom:8px">브라우저에서 열어주세요</div>'+
        '<div style="font-size:14px;color:#555;line-height:1.7;margin-bottom:20px;max-width:340px">카카오톡 안에서는 <b>로그인·사진 올리기</b>가 안 될 수 있어요.<br>'+
          (isAndroid ? '아래 버튼을 눌러 <b>크롬</b>에서 열어주세요.' : '오른쪽 아래 <b>메뉴(⋯) → Safari로 열기</b>를 누르거나,<br>아래에서 주소를 복사해 <b>사파리</b> 주소창에 붙여넣어 주세요.')+'</div>'+
        (isAndroid
          ? '<button id="__gOpen" style="background:#5B6CF5;color:#fff;border:none;border-radius:10px;padding:13px 24px;font-size:15px;font-weight:700;cursor:pointer">🌐 크롬으로 열기</button>'
          : '<button id="__gCopy" style="background:#5B6CF5;color:#fff;border:none;border-radius:10px;padding:13px 24px;font-size:15px;font-weight:700;cursor:pointer">🔗 주소 복사하기</button>')+
        '<div id="__gMsg" style="font-size:12px;color:#10B981;margin-top:10px;height:16px"></div>'+
        '<button id="__gSkip" style="background:none;border:none;color:#94a3b8;font-size:12px;margin-top:18px;text-decoration:underline;cursor:pointer">그냥 여기서 볼게요</button>';
      document.body.appendChild(d);
      var o=document.getElementById('__gOpen'); if(o) o.onclick=function(){ location.href='kakaotalk://web/openExternal?url='+encodeURIComponent(url); };
      var c=document.getElementById('__gCopy'); if(c) c.onclick=function(){ var ok=function(){ document.getElementById('__gMsg').textContent='복사됐어요! 사파리 주소창에 붙여넣기'; };
        try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(ok,function(){ prompt('주소를 복사하세요', url); }); } else { prompt('주소를 복사하세요', url); } }catch(e){ prompt('주소를 복사하세요', url); } };
      document.getElementById('__gSkip').onclick=function(){ d.remove(); };
    };
    if(document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }catch(e){}
})();

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

// ================================================================
// 🔐 익명 인증 — 앱에 들어온 클라이언트에만 '출입증'(auth) 발급
//  · 규칙을 `if request.auth != null`로 잠가도 앱은 그대로 작동
//  · 학생/선생님은 기존 이름+비밀번호 로그인 그대로 (출입증은 뒤에서 자동)
//  · 콘솔 Authentication에서 '익명' 로그인이 사용 설정돼 있어야 함
//  각 페이지 init에서 `await window.bmAuthReady` 후 데이터를 불러옴
// ================================================================
window.bmAuthReady = new Promise(function(resolve){
  var done=false, finish=function(u){ if(!done){ done=true; resolve(u||null); } };
  try{
    if(!firebase.auth){ finish(null); return; }
    var A=firebase.auth();
    A.onAuthStateChanged(function(user){ if(user) finish(user); });
    var trySignIn=function(){ A.signInAnonymously().catch(function(e){ console.warn('익명 인증 실패:', e && (e.code||e.message)); finish(null); }); };
    // 인앱 브라우저(카카오톡 등)에서 IndexedDB/저장소가 막혀 실패하는 경우 대비:
    //  LOCAL 저장 시도 → 실패하면 인메모리(NONE)로 전환 후 로그인 (앱은 매번 익명 재발급이라 무방)
    var P=(firebase.auth.Auth && firebase.auth.Auth.Persistence) || {LOCAL:'local',NONE:'none'};
    A.setPersistence(P.LOCAL).then(trySignIn, function(){ A.setPersistence(P.NONE).then(trySignIn, trySignIn); });
    setTimeout(function(){ finish(null); }, 8000);   // 안전장치: 응답 없어도 8초 뒤 진행
  }catch(e){ finish(null); }
});

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

// ================================================================
// 📲 '앱처럼 설치' (PWA) 안내 배너 — 모든 포털 공통 (오른쪽 하단)
//  · 안드로이드/PC 크롬 등: 설치 버튼 → 네이티브 설치
//  · 아이폰 사파리: 설치 이벤트가 없어 '홈 화면에 추가' 수동 안내
//  · 이미 앱으로 실행 중이거나, 한 번 닫으면 다시 표시 안 함
// ================================================================
(function(){
  function isStandalone(){ return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone===true; }
  function dismissed(){ return localStorage.getItem('bm_install_dismiss')==='1'; }
  function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent||''); }
  window.bmCanInstallUI = function(){ return !isStandalone(); };  // 버튼 노출 여부(이미 설치면 숨김)

  var deferredPrompt = null;

  function removeBanner(){ var b=document.getElementById('bmInstallBanner'); if(b) b.remove(); }
  function banner(innerHtml){
    if(!document.body) return;
    removeBanner();
    var b=document.createElement('div');
    b.id='bmInstallBanner';
    b.style.cssText='position:fixed;right:16px;bottom:84px;z-index:4000;max-width:300px;background:var(--card,#fff);color:var(--text,#1E293B);border:1px solid var(--border,#e5e7eb);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:14px';
    b.innerHTML=innerHtml;
    document.body.appendChild(b);
  }
  var closeBtn='<button onclick="bmInstallClose()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-muted,#94a3b8);line-height:1">&times;</button>';
  function installHtml(){
    return '<div style="display:flex;align-items:flex-start;gap:10px"><div style="font-size:22px">📲</div>'+
      '<div style="flex:1;font-size:13px"><div style="font-weight:800;margin-bottom:2px">앱처럼 설치</div>'+
      '<div style="color:var(--text-muted,#64748b);line-height:1.4">홈 화면이나 PC 앱 목록에 추가해 빠르게 접속할 수 있어요.</div></div>'+closeBtn+'</div>'+
      '<button onclick="bmInstallNow()" style="margin-top:10px;width:100%;background:var(--primary,#5B6CF5);color:#fff;border:none;border-radius:9px;padding:9px;font-size:13px;font-weight:700;cursor:pointer">⬇️ 설치하기</button>';
  }
  function iosHtml(){
    return '<div style="display:flex;align-items:flex-start;gap:10px"><div style="font-size:22px">📲</div>'+
      '<div style="flex:1;font-size:13px"><div style="font-weight:800;margin-bottom:2px">홈 화면에 추가</div>'+
      '<div style="color:var(--text-muted,#64748b);line-height:1.4">하단 <b>공유</b> 버튼 → <b>홈 화면에 추가</b>를 누르면 앱처럼 쓸 수 있어요.</div></div>'+closeBtn+'</div>';
  }

  window.bmInstallClose=function(){ removeBanner(); localStorage.setItem('bm_install_dismiss','1'); };
  window.bmInstallNow=async function(){
    if(!deferredPrompt){ banner(iosHtml()); return; }
    deferredPrompt.prompt();
    try{ await deferredPrompt.userChoice; }catch(e){}
    deferredPrompt=null; removeBanner();
  };
  // 버튼에서 직접 호출 — 기기에 맞게 설치창(안드로이드/PC) 또는 안내(아이폰)
  window.bmInstallClick=function(){
    if(isStandalone()){ if(window.showToast) showToast('이미 앱으로 설치돼 있어요 👍'); return; }
    if(deferredPrompt){ window.bmInstallNow(); return; }
    banner(iosHtml());
  };

  // 안드로이드/데스크톱: 설치 가능 시점 → 자동 배너
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); deferredPrompt=e;
    if(!isStandalone() && !dismissed()) banner(installHtml());
  });
  // 아이폰 사파리: 자동 안내
  window.addEventListener('load', function(){
    if(isIOS() && !isStandalone() && !dismissed()) banner(iosHtml());
  });
})();
