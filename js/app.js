// مجلس العائلة: الشاشات والمحادثات. البيانات كلها في cloud.js والرسومات في art.js
(() => {
  const $ = id => document.getElementById(id);
  const app = $('app');
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  // ───── الحالة ─────
  let view = 'auto';        // auto | join | setup
  let tab = ls.get('family-chat-tab', 'chats');
  let room = null;          // الغرفة المفتوحة
  let panel = null;         // emoji | sticker
  let pairing = null;       // رمز إضافة فرد: { code, exp, ready, name, role }
  let joinCode = '';
  let joinHint = '';
  let pendingImg = null;    // صورة تنتظر الإرسال: { room, data }
  let newsDraft = null;     // خبر يُكتب: { img }
  let deferred = false;     // إعادة رسم مؤجلة حتى لا يُمسح ما يكتبه المستخدم
  let look = ls.get('family-chat-look', 'falfoula');

  // ───── أدوات صغيرة ─────
  let toastTimer;
  function toast(msg, ms = 2600) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  const Sound = (() => {
    let ctx = null;
    const muted = () => ls.get('family-chat-muted', false);
    function tone(freqs, dur = 0.09, type = 'sine', vol = 0.12) {
      if (muted()) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        let t = ctx.currentTime;
        freqs.forEach(f => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = type; o.frequency.value = f;
          g.gain.setValueAtTime(vol, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.8);
          o.connect(g); g.connect(ctx.destination);
          o.start(t); o.stop(t + dur * 2);
          t += dur;
        });
      } catch (e) {}
    }
    return {
      send: () => tone([520, 780], 0.07, 'triangle'),
      pop: () => tone([660, 880, 1170], 0.08, 'sine', 0.14),
      tap: () => tone([440], 0.05, 'triangle', 0.08),
    };
  })();

  const HEROES = 'https://znammous.github.io/heroes-world/';
  const NUM = 'ar-SA-u-nu-latn-ca-gregory';
  const timeOf = at => new Date(at).toLocaleTimeString(NUM, { hour: 'numeric', minute: '2-digit' });
  function dayOf(at) {
    const d = new Date(at), t = new Date();
    const key = x => x.toDateString();
    if (key(d) === key(t)) return 'اليوم';
    t.setDate(t.getDate() - 1);
    if (key(d) === key(t)) return 'أمس';
    return d.toLocaleDateString(NUM, { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function ago(at) {
    const s = (Date.now() - at) / 1000;
    if (s < 150) return 'متصل الآن';
    if (s < 3600) return `آخر ظهور قبل ${Math.round(s / 60)} دقيقة`;
    if (s < 86400) return `آخر ظهور ${timeOf(at)}`;
    return `آخر ظهور ${dayOf(at)}`;
  }
  const online = u => u && u.seen && Date.now() - u.seen < 150000;

  // نص الرسالة: روابط قابلة للضغط وأسطر جديدة
  function rich(text) {
    return esc(text)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
  }
  const onlyEmoji = t => /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,12}$/u.test(t) && !/^[\d\s#*]+$/.test(t);

  // ───── الأفراد والغرف ─────
  const uid = () => Cloud.uid();
  const users = () => Cloud.users();
  const userOf = id => users()[id];
  const nameOf = id => (userOf(id) ? userOf(id).name : 'فرد سابق');
  const others = () => Object.values(users()).filter(u => u.id !== uid()).sort((a, b) => (a.at || 0) - (b.at || 0));
  const dmId = (a, b) => 'dm_' + [a, b].sort().join('_');
  const dmPeers = r => r.slice(3).split('_');
  const isParent = () => Cloud.role() === 'parent';
  const ROLE_BADGE = { parent: '👑 ولي الأمر', adult: '⭐ ولي أمر', kid: '' };
  // لون ثابت لاسم كل فرد في محادثة العائلة
  const COLORS = ['#e0701a', '#1b7a45', '#cc3a76', '#3a76cf', '#8a47ad', '#13807c', '#b8500c', '#a32a5b'];
  const colorOf = id => COLORS[[...String(id)].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];

  function roomTitle(r) {
    if (r === 'family') return '🏡 بيت العائلة';
    if (r === 'news') return '📰 أخبار العائلة';
    const peers = dmPeers(r);
    if (!peers.includes(uid())) return peers.map(nameOf).join(' و ');
    return nameOf(peers.find(p => p !== uid()) || uid());
  }
  const canWrite = r => r === 'family' || r === 'news' || dmPeers(r).includes(uid());

  // كل الغرف التي نتابعها: العائلة والأخبار ومحادثاتي الخاصة، وولي الأمر يرى محادثات الأبناء أيضاً
  function allRooms() {
    const list = ['family', 'news'];
    const ids = Object.keys(users());
    others().forEach(u => list.push(dmId(uid(), u.id)));
    if (isParent()) {
      ids.forEach((a, i) => ids.slice(i + 1).forEach(b => {
        if (a !== uid() && b !== uid()) list.push(dmId(a, b));
      }));
    }
    return list;
  }
  const watchAll = () => allRooms().forEach(r => Cloud.watch(r, r === room ? 300 : 40));

  // ───── المقروء ─────
  const read = ls.get('family-chat-read', {});
  if (!read._base) { read._base = Date.now(); ls.set('family-chat-read', read); }
  const lastRead = r => Math.max(read[r] || 0, read._base);
  const unreadOf = r => Cloud.msgsOf(r).filter(m => m.from !== uid() && m.at > lastRead(r)).length;
  function markRead(r) {
    const msgs = Cloud.msgsOf(r);
    const at = msgs.length ? msgs[msgs.length - 1].at : 0;
    if (at > (read[r] || 0)) { read[r] = at; ls.set('family-chat-read', read); }
  }
  function badge() {
    const n = allRooms().filter(r => canWrite(r)).reduce((s, r) => s + unreadOf(r), 0);
    document.title = n ? `(${n}) مجلس العائلة` : 'مجلس العائلة';
    if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
    return n;
  }

  // ───── الرسم ─────
  function paintLook() {
    document.documentElement.dataset.look = look;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = look === 'arnooba' ? '#ffdce9' : '#cfeeff';
  }

  function render() {
    paintLook();
    const st = Cloud.status(), role = Cloud.role();
    if (view === 'join' && !role) return showJoin();
    if (st === 'loading' || st === 'linking') return showLoading(st === 'linking' ? 'نبحث عن عائلتك…' : 'لحظة…');
    if (st === 'unavailable' && !role) return showWelcome(true);
    if (!role) return showWelcome(false);
    if (!Cloud.usersReady()) return showLoading('نجهّز بيت العائلة…');
    if (!Cloud.me() || view === 'setup') return showSetup();
    if (room) return showRoom();
    return showHome();
  }

  // لا نعيد رسم شاشة فيها خانة يكتب فيها المستخدم؛ نؤجلها حتى يخرج منها
  function refresh() {
    const a = document.activeElement;
    if (a && app.contains(a) && /INPUT|TEXTAREA/.test(a.tagName) && !room) { deferred = true; return; }
    if (room && $('msgs')) return refreshRoom();
    render();
  }
  document.addEventListener('focusout', () => setTimeout(() => {
    if (!deferred) return;
    const a = document.activeElement;
    if (a && app.contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) return;
    deferred = false;
    render();
  }, 50));

  function showLoading(msg) {
    app.innerHTML = `<div class="center-screen">
      <div class="duo">${Art.char('falfoula', 'happy', 'bob')}${Art.char('arnooba', 'happy', 'bob late')}</div>
      <p class="hint"><span class="spinner"></span> ${msg}</p></div>`;
  }

  function showWelcome(offline) {
    app.innerHTML = `<div class="center-screen welcome">
      <div class="duo">${Art.char('falfoula', 'cheer', 'bob')}${Art.char('arnooba', 'cheer', 'bob late')}</div>
      <h1 class="logo">مجلس العائلة</h1>
      <p class="talk"><b>فلفولة وأرنوبة:</b> أهلاً بك! هنا تتكلم العائلة كلها، وتتبادل الصور والملصقات والأخبار 💌</p>
      ${offline ? '<p class="warn">📡 المجلس يحتاج اتصالاً بالإنترنت. افتحه من رابط https.</p>' : `
      <button class="btn big green" data-act="signIn">👑 أنا ولي الأمر — دخول بحساب Google</button>
      <button class="btn big pink" data-act="goJoin">📱 انضم برمز QR من ولي الأمر</button>
      <p class="muted small">ولي الأمر يدخل بحسابه مرة واحدة، ثم يضيف الأبناء من «العائلة ← أضف فرداً».</p>`}
      <a class="link-btn" href="${HEROES}">🌟 العودة إلى عالم الأبطال</a>
    </div>`;
  }

  function showJoin() {
    app.innerHTML = `<div class="center-screen">
      ${Art.char('arnooba', 'happy', 'mid bob')}
      <h2 class="title">انضم إلى العائلة</h2>
      <div class="card">
        <p>اطلب من ولي الأمر أن يفتح «العائلة ← أضف فرداً» ثم امسح الرمز:</p>
        <button class="btn green wide" id="scanBtn" data-act="scan">📷 امسح رمز QR</button>
        <div id="scanBox" class="scan-box" hidden><video id="scanVideo" playsinline muted></video><p class="muted small">وجّه الكاميرا نحو الرمز</p></div>
        <p class="or">أو اكتب الرمز</p>
        <input id="codeIn" class="code-in" dir="ltr" maxlength="9" placeholder="XXXX-XXXX" value="${esc(joinCode)}" autocomplete="off" autocapitalize="characters">
        <button class="btn pink wide" data-act="joinTyped">انضم ✨</button>
      </div>
      <button class="link-btn" data-act="back">رجوع</button>
    </div>`;
  }

  // ───── إنشاء الملف ─────
  const AVATARS = ['falfoula', 'arnooba', '🦁', '🐯', '🐼', '🐨', '🦊', '🐰', '🐻', '🐸', '🐵', '🦄', '🐱', '🐶', '🐧', '🦉', '🐢', '🐬', '🦋', '🐝', '🦖', '🐙', '👨', '👩', '🧔', '👵', '👴'];
  let setupAvatar = null, setupLook = null;
  function showSetup() {
    const mine = Cloud.me();
    const [hRole, hName] = joinHint.includes('|') ? joinHint.split('|') : ['', joinHint];
    const name = mine ? mine.name : (hName || (isParent() ? '' : ''));
    setupAvatar = setupAvatar || (mine ? mine.avatar : 'falfoula');
    setupLook = setupLook || look;
    const parentChips = isParent() && !mine
      ? `<div class="chips">${['بابا', 'ماما'].map(n => `<button class="chip" data-act="quickName" data-arg="${n}">${n}</button>`).join('')}</div>` : '';
    app.innerHTML = `<div class="page setup">
      <div class="falfoula-talk">${Art.char(setupLook === 'arnooba' ? 'arnooba' : 'falfoula', 'happy', 'talk')}<p>${mine ? 'عدّل ملفك كما تحب 🎨' : 'مرحباً بك في بيت العائلة! ما اسمك؟ واختر صورتك 🌟'}</p></div>
      <div class="card">
        <label class="label">اسمك</label>
        <input id="nameIn" class="text-in" maxlength="30" value="${esc(name)}" placeholder="اكتب اسمك">
        ${parentChips}
        <label class="label">صورتك</label>
        <div class="avatar-grid">${AVATARS.map(a => `<button class="av-opt ${a === setupAvatar ? 'on' : ''}" data-act="pickAvatar" data-arg="${a}">${Art.avatar(a)}</button>`).join('')}</div>
        <label class="label">اختر عالمك</label>
        <div class="look-pick">
          <button class="look-opt ${setupLook === 'falfoula' ? 'on' : ''}" data-act="pickLook" data-arg="falfoula">${Art.char('falfoula', 'happy')}<b>عالم فلفولة</b><small>سماء زرقاء وتلال خضراء</small></button>
          <button class="look-opt ${setupLook === 'arnooba' ? 'on' : ''}" data-act="pickLook" data-arg="arnooba">${Art.char('arnooba', 'happy')}<b>عالم أرنوبة</b><small>ألوان وردية لطيفة</small></button>
        </div>
        <button class="btn green wide" data-act="saveProfile">${mine ? 'حفظ ✅' : 'هيا ندخل 🚀'}</button>
        ${mine ? '<button class="link-btn" data-act="cancelSetup">إلغاء</button>' : ''}
      </div>
    </div>`;
    if (hRole) showSetup.role = hRole === 'A' ? 'adult' : 'kid';
  }

  // ───── الرئيسية ─────
  function showHome() {
    const me = Cloud.me();
    const total = badge();
    const newsN = unreadOf('news');
    const chatsN = total - newsN;
    let body = '';
    if (tab === 'news') body = newsTab();
    else if (tab === 'family') body = familyTab();
    else body = chatsTab();
    app.innerHTML = `<div class="page home">
      <header class="top">
        <button class="me" data-act="tab" data-arg="family">${Art.avatar(me.avatar, 'sm')}<span><small>أهلاً</small><b>${esc(me.name)}</b></span></button>
        <h1 class="logo small">مجلس العائلة</h1>
        ${Cloud.status() === 'offline' ? '<span class="pill warn">📴 بلا اتصال</span>' : '<span class="pill ok">🟢</span>'}
      </header>
      <div class="tab-body">${body}</div>
      <nav class="tabbar">
        <button class="tab ${tab === 'chats' ? 'on' : ''}" data-act="tab" data-arg="chats">💬<span>الدردشات</span>${chatsN ? `<i class="dot-n">${chatsN}</i>` : ''}</button>
        <button class="tab ${tab === 'news' ? 'on' : ''}" data-act="tab" data-arg="news">📰<span>الأخبار</span>${newsN ? `<i class="dot-n">${newsN}</i>` : ''}</button>
        <button class="tab ${tab === 'family' ? 'on' : ''}" data-act="tab" data-arg="family">👨‍👩‍👧‍👦<span>العائلة</span></button>
      </nav>
    </div>`;
    if (tab === 'news') markRead('news');
  }

  function preview(m) {
    if (!m) return '<i>لا رسائل بعد، ابدأ أنت! 👋</i>';
    const who = m.from === uid() ? 'أنت: ' : '';
    if (m.sticker) return `${who}✨ ملصق`;
    if (m.audio) return `${who}🎤 رسالة صوتية`;
    if (m.img) return `${who}📷 صورة${m.text ? ' · ' + esc(m.text.slice(0, 40)) : ''}`;
    return who + esc((m.text || '').slice(0, 60));
  }

  function roomRow(r, icon, title, sub) {
    const msgs = Cloud.msgsOf(r);
    const last = msgs[msgs.length - 1];
    const n = unreadOf(r);
    return `<button class="room-row ${n ? 'unread' : ''}" data-act="open" data-arg="${r}">
      ${icon}
      <span class="rr-main"><b>${title}</b><small>${sub || preview(last)}</small></span>
      <span class="rr-side">${last ? `<small>${dayOf(last.at) === 'اليوم' ? timeOf(last.at) : dayOf(last.at)}</small>` : ''}${n ? `<i class="dot-n">${n}</i>` : ''}</span>
    </button>`;
  }

  function chatsTab() {
    const fam = others();
    const famIcon = `<span class="av family-av">🏡</span>`;
    let h = `<div class="falfoula-talk">${Art.char(look === 'arnooba' ? 'arnooba' : 'falfoula', 'happy', 'talk')}<p>${greeting()}</p></div>`;
    h += `<div class="card list">${roomRow('family', famIcon, '🏡 بيت العائلة')}</div>`;
    h += '<h3 class="section">💌 رسائل خاصة</h3>';
    if (!fam.length) {
      h += `<div class="card empty"><p>لا يوجد أفراد آخرون بعد.</p>${isParent() ? '<button class="btn pink" data-act="tab" data-arg="family">➕ أضف أفراد العائلة</button>' : '<p class="muted small">اطلب من ولي الأمر أن يضيف إخوتك.</p>'}</div>`;
    } else {
      const sorted = fam.slice().sort((a, b) => lastAt(dmId(uid(), b.id)) - lastAt(dmId(uid(), a.id)));
      h += `<div class="card list">${sorted.map(u => roomRow(dmId(uid(), u.id),
        `<span class="av-wrap">${Art.avatar(u.avatar)}${online(u) ? '<i class="online"></i>' : ''}</span>`,
        `${esc(u.name)} ${ROLE_BADGE[u.role] ? `<em class="role">${ROLE_BADGE[u.role]}</em>` : ''}`)).join('')}</div>`;
    }
    return h;
  }
  const lastAt = r => { const m = Cloud.msgsOf(r); return m.length ? m[m.length - 1].at : 0; };

  const GREETINGS = [
    'اكتب لأحد أفراد عائلتك رسالة جميلة اليوم 💌',
    'هل عندك خبر سعيد؟ شاركه في الأخبار 📰',
    'أرسل ملصقاً لتُضحك أخاك أو أختك 😄',
    'كلمة حلوة تصنع يوماً سعيداً 🌈',
    'لا تنسَ أن تقول: أحبكم ❤️',
  ];
  function greeting() {
    const h = new Date().getHours();
    if (h < 11) return 'صباح الخير! ☀️ ' + GREETINGS[new Date().getDate() % GREETINGS.length];
    if (h >= 20) return 'مساء الخير! 🌙 ' + GREETINGS[new Date().getDate() % GREETINGS.length];
    return GREETINGS[new Date().getDate() % GREETINGS.length];
  }

  // ───── الأخبار ─────
  const QUICK = ['❤️', '👏', '😂', '😮', '🎉'];
  function reactsRow(r, m, quick) {
    const counts = {};
    Object.values(m.reacts || {}).forEach(e => { counts[e] = (counts[e] || 0) + 1; });
    const mine = (m.reacts || {})[uid()];
    const list = quick ? QUICK.concat(Object.keys(counts).filter(e => !QUICK.includes(e))) : Object.keys(counts);
    if (!list.length) return '';
    return `<div class="reacts">${list.map(e =>
      `<button class="react ${mine === e ? 'on' : ''}" data-act="react" data-arg="${r}|${m.id}|${e}">${e}${counts[e] ? `<small>${counts[e]}</small>` : ''}</button>`).join('')}</div>`;
  }

  function newsTab() {
    const msgs = Cloud.msgsOf('news').slice().reverse();
    let h = `<button class="btn big gold wide" data-act="newsNew">📣 أضف خبراً للعائلة</button>`;
    if (!msgs.length) {
      h += `<div class="card empty">${Art.char('arnooba', 'happy', 'mid')}<p>لا أخبار بعد. هل نجحت في اختبار؟ هل رسمت لوحة؟ شارك العائلة! 🎨</p></div>`;
    }
    h += msgs.map(m => {
      const u = userOf(m.from);
      const del = m.from === uid() || isParent();
      return `<article class="card news">
        <header>${Art.avatar(u ? u.avatar : '🙂', 'sm')}<span><b>${esc(nameOf(m.from))}</b><small>${dayOf(m.at)} · ${timeOf(m.at)}${m.pending ? ' · 🕓' : ''}</small></span>
          ${del ? `<button class="link-btn danger small" data-act="delMsg" data-arg="news|${m.id}">حذف</button>` : ''}</header>
        ${m.title ? `<h3>${esc(m.title)}</h3>` : ''}
        ${m.img ? `<img class="news-img" src="${m.img}" alt="" data-act="view" data-arg="news|${m.id}">` : ''}
        ${m.text ? `<p>${rich(m.text)}</p>` : ''}
        ${reactsRow('news', m, true)}
      </article>`;
    }).join('');
    return h;
  }

  function showNewsModal() {
    const d = newsDraft;
    modal(`<div class="sheet">
      <h3>📣 خبر جديد</h3>
      <input id="newsTitle" class="text-in" maxlength="120" placeholder="عنوان الخبر (مثال: نجحت بامتياز! 🎉)" value="${esc(d.title || '')}">
      <textarea id="newsText" class="text-in" rows="4" maxlength="3000" placeholder="اكتب التفاصيل…">${esc(d.text || '')}</textarea>
      ${d.img ? `<img class="news-img" src="${d.img}" alt=""><button class="link-btn danger" data-act="newsNoImg">إزالة الصورة</button>`
        : `<div class="row"><button class="btn blue" data-act="camera" data-arg="news">📸 صوّر</button><label class="btn blue">🖼️ من الألبوم<input type="file" accept="image/*" hidden data-pick="news"></label></div>`}
      <div class="row"><button class="btn green" data-act="newsPost">انشر الخبر 🚀</button><button class="btn plain" data-act="closeModal">إلغاء</button></div>
    </div>`);
  }
  const keepNewsDraft = () => {
    if (!newsDraft || !$('newsTitle')) return;
    newsDraft.title = $('newsTitle').value;
    newsDraft.text = $('newsText').value;
  };

  // ───── العائلة ─────
  function familyTab() {
    const me = Cloud.me();
    const list = Object.values(users()).sort((a, b) => (a.at || 0) - (b.at || 0));
    let h = `<div class="card me-card">${Art.avatar(me.avatar, 'lg')}<div><b>${esc(me.name)}</b><small>${ROLE_BADGE[me.role] || '🌟 من أبطال العائلة'}</small></div>
      <button class="btn small blue" data-act="editProfile">✏️ تعديل</button></div>`;
    h += `<div class="card"><h3>🌍 عالمي</h3><div class="look-pick">
      <button class="look-opt ${look === 'falfoula' ? 'on' : ''}" data-act="setLook" data-arg="falfoula">${Art.char('falfoula', 'happy')}<b>عالم فلفولة</b></button>
      <button class="look-opt ${look === 'arnooba' ? 'on' : ''}" data-act="setLook" data-arg="arnooba">${Art.char('arnooba', 'happy')}<b>عالم أرنوبة</b></button></div></div>`;
    h += `<div class="card"><h3>👨‍👩‍👧‍👦 أفراد العائلة (${list.length})</h3><ul class="members">${list.map(u => `<li>
      <span class="av-wrap">${Art.avatar(u.avatar)}${online(u) ? '<i class="online"></i>' : ''}</span>
      <span class="m-main"><b>${esc(u.name)}${u.id === uid() ? ' (أنت)' : ''}</b><small>${ROLE_BADGE[u.role] ? ROLE_BADGE[u.role] + ' · ' : ''}${u.id === uid() ? 'متصل الآن' : ago(u.seen || 0)}</small></span>
      ${u.id !== uid() ? `<button class="btn small pink" data-act="open" data-arg="${dmId(uid(), u.id)}">💌</button>` : ''}
      ${isParent() && u.id !== uid() ? `<button class="link-btn danger small" data-act="removeMember" data-arg="${u.id}">فصل</button>` : ''}
    </li>`).join('')}</ul></div>`;
    if (isParent()) h += addMemberBox() + kidsChats();
    h += `<div class="card"><h3>⚙️ الإعدادات</h3>
      <div class="setting"><span>🔔 تنبيه عند وصول رسالة</span><button class="switch ${notifyOn() ? 'on' : ''}" data-act="toggleNotify"><i></i></button></div>
      <div class="setting"><span>🔊 الأصوات</span><button class="switch ${ls.get('family-chat-muted', false) ? '' : 'on'}" data-act="toggleMute"><i></i></button></div>
      ${isParent() ? `<p class="muted small" dir="ltr">${esc(Cloud.email())}</p>` : ''}
      <a class="btn plain wide" href="${HEROES}">🌟 عالم الأبطال: ألعاب العائلة</a>
      <button class="link-btn danger" data-act="signOut">${isParent() ? 'تسجيل الخروج من هذا الجهاز' : 'فصل هذا الجهاز عن مجلس العائلة'}</button></div>`;
    return h;
  }

  function addMemberBox() {
    if (pairing && pairing.exp > Date.now()) {
      const qr = qrcode(0, 'M');
      qr.addData(`${location.origin}${location.pathname}#join=${pairing.code}`);
      qr.make();
      return `<div class="card pair-box ${pairing.ready ? '' : 'pending'}">
        <h3>📱 أضف ${esc(pairing.name || 'فرداً')}</h3>
        <p>على جهاز ${esc(pairing.name || 'الفرد الجديد')}: افتح مجلس العائلة ← «انضم برمز QR» ثم امسح الرمز، أو امسحه بكاميرا الجهاز مباشرة.</p>
        <div class="qr">${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>
        <b class="pair-code" dir="ltr">${pairing.code.slice(0, 4)}-${pairing.code.slice(4)}</b>
        <small class="muted">${pairing.ready ? '✅ جاهز · صالح لعشر دقائق' : '<span class="spinner"></span> جارٍ تفعيل الرمز…'}</small>
        <button class="link-btn" data-act="cancelPair">إلغاء</button>
      </div>`;
    }
    return `<div class="card"><h3>➕ أضف فرداً للعائلة</h3>
      <p class="muted small">يظهر رمز QR يمسحه جهاز الابن أو البنت فينضم إلى حسابك مباشرة. الأجهزة المرتبطة من قبل بأبطال الغابة أو أبطال الإملاء تدخل المجلس تلقائياً.</p>
      <input id="pairName" class="text-in" maxlength="30" placeholder="اسمه (مثال: سارة)">
      <div class="chips" id="pairRole">
        <button class="chip on" data-act="pairRole" data-arg="K">🧒 ابن أو بنت</button>
        <button class="chip" data-act="pairRole" data-arg="A">⭐ ولي أمر آخر</button>
      </div>
      <button class="btn green wide" data-act="pair">📱 أنشئ رمز QR</button></div>`;
  }

  // ولي الأمر يطّلع على المحادثات الخاصة بين الأبناء
  function kidsChats() {
    const rows = allRooms().filter(r => r.startsWith('dm_') && !dmPeers(r).includes(uid()) && Cloud.msgsOf(r).length);
    if (!rows.length) return '';
    return `<div class="card"><h3>👀 محادثات الأبناء الخاصة</h3><div class="list">${rows.map(r => {
      const [a, b] = dmPeers(r).map(userOf);
      return roomRow(r, `<span class="av-pair">${Art.avatar(a ? a.avatar : '🙂', 'sm')}${Art.avatar(b ? b.avatar : '🙂', 'sm')}</span>`, esc(roomTitle(r)));
    }).join('')}</div></div>`;
  }

  // ───── غرفة المحادثة ─────
  function showRoom() {
    const r = room;
    let icon, sub;
    if (r === 'family') {
      icon = '<span class="av family-av">🏡</span>';
      sub = Object.values(users()).map(u => esc(u.name)).join('، ');
    } else if (r === 'news') {
      icon = '<span class="av family-av">📰</span>'; sub = '';
    } else {
      const peers = dmPeers(r);
      const other = userOf(peers.find(p => p !== uid())) || userOf(peers[0]);
      icon = `<span class="av-wrap">${Art.avatar(other ? other.avatar : '🙂')}${online(other) ? '<i class="online"></i>' : ''}</span>`;
      sub = canWrite(r) ? (other ? ago(other.seen || 0) : '') : '👀 أنت تطّلع على هذه المحادثة فقط';
    }
    app.innerHTML = `<div class="room">
      <header class="room-top">
        <button class="back" data-act="close" aria-label="رجوع">→</button>
        ${icon}
        <span class="rt-main"><b>${esc(roomTitle(r))}</b><small id="roomSub">${sub}</small></span>
      </header>
      <div class="msgs" id="msgs"></div>
      ${canWrite(r) ? `<div class="panel" id="panel" hidden></div>
      <footer class="composer">
        <button class="ic" data-act="panel" data-arg="sticker" aria-label="ملصقات">${Art.char(look === 'arnooba' ? 'arnooba' : 'falfoula', 'cheer', 'mini')}</button>
        <button class="ic" data-act="panel" data-arg="emoji" aria-label="إيموجي">😊</button>
        <button class="ic" data-act="photoMenu" data-arg="chat" aria-label="صورة">📷</button>
        <textarea id="txt" rows="1" maxlength="3000" placeholder="اكتب رسالة…"></textarea>
        <button class="ic mic" data-act="recStart" aria-label="تسجيل صوت">🎤</button>
        <button class="send" data-act="sendText" aria-label="إرسال">➤</button>
      </footer>
      <footer class="composer recbar" id="recBar" hidden>
        <button class="ic" data-act="recCancel" aria-label="إلغاء">🗑️</button>
        <span class="rec-dot"></span><b class="rec-time" id="recTime">0:00</b>
        <span class="rec-hint">جارٍ التسجيل… تكلّم الآن 🎙️</span>
        <button class="send" data-act="recSend" aria-label="إرسال التسجيل">➤</button>
      </footer>` : ''}
    </div>`;
    refreshRoom(true);
    const t = $('txt');
    if (t) {
      t.addEventListener('input', grow);
      t.addEventListener('keydown', e => {
        // Enter يرسل على لوحة المفاتيح العادية، و Shift+Enter سطر جديد
        if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); actions.sendText(); }
      });
    }
  }
  function grow() { const t = $('txt'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }

  function refreshRoom(first) {
    const box = $('msgs');
    if (!box) return;
    const near = first || box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const msgs = Cloud.msgsOf(room);
    const group = room === 'family' || !dmPeers(room).includes(uid());
    let h = '', lastDay = '', lastFrom = '';
    if (!msgs.length) {
      h = Cloud.roomReady(room)
        ? `<div class="empty-room">${Art.char(look === 'arnooba' ? 'arnooba' : 'falfoula', 'happy', 'mid bob')}<p>قل مرحباً! 👋<br><small>أرسل رسالة أو ملصقاً لتبدأ المحادثة</small></p></div>`
        : '<div class="empty-room"><span class="spinner"></span></div>';
    }
    msgs.forEach(m => {
      const day = dayOf(m.at);
      if (day !== lastDay) { h += `<div class="day"><span>${day}</span></div>`; lastDay = day; lastFrom = ''; }
      const mine = m.from === uid();
      const u = userOf(m.from);
      const head = !mine && group && m.from !== lastFrom;
      lastFrom = m.from;
      const kind = m.sticker ? 'is-sticker' : m.audio ? 'is-audio' : m.img ? 'is-img' : (m.text && onlyEmoji(m.text) ? 'is-jumbo' : '');
      h += `<div class="msg ${mine ? 'mine' : 'theirs'} ${kind} ${head ? 'head' : ''}" data-id="${m.id}">
        ${!mine && group ? `<span class="m-av">${head ? Art.avatar(u ? u.avatar : '🙂', 'sm') : ''}</span>` : ''}
        <div class="bubble" data-act="msgMenu" data-arg="${m.id}">
          ${head ? `<b class="who" style="color:${colorOf(m.from)}">${esc(nameOf(m.from))}</b>` : ''}
          ${m.sticker ? Art.sticker(m.sticker) : ''}
          ${m.audio ? voiceBubble(m) : ''}
          ${m.img ? `<img src="${m.img}" alt="صورة" data-act="view" data-arg="${room}|${m.id}">` : ''}
          ${m.text ? `<div class="text">${rich(m.text)}</div>` : ''}
          <span class="meta">${timeOf(m.at)}${mine ? (m.pending ? ' 🕓' : ' ✓') : ''}</span>
        </div>
        ${reactsRow(room, m, false)}
      </div>`;
    });
    box.innerHTML = h;
    paintVoice();
    if (near) box.scrollTop = box.scrollHeight;
    markRead(room);
    badge();
  }

  // لوحة الإيموجي والملصقات
  const EMOJI = {
    'وجوه': '😀 😃 😄 😁 😆 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 😎 🥳 🤩 😏 😴 😮 😲 🥺 😢 😭 😤 😡 🤯 😱 🤒 🤕 🥶 🥵 🤠 😺 🙈 🙉 🙊',
    'قلوب': '❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 💖 💗 💓 💞 💕 💘 💝 💌 💐 🌹 🌸 🌻 🌷',
    'أيدي': '👍 👎 👏 🙌 👐 🤲 🙏 ✌️ 🤞 🤟 👌 👋 💪 ✋ 🤝 ☝️ 👆 👇 👉 👈',
    'حيوانات': '🐘 🐰 🦁 🐯 🐼 🐨 🦊 🐻 🐸 🐵 🦄 🐱 🐶 🐧 🦉 🐢 🐬 🐳 🦋 🐝 🐞 🦖 🐙 🦒 🦓 🐪 🐎 🐑 🐓 🦜',
    'أكل': '🍎 🍌 🍉 🍓 🍇 🍒 🥝 🍍 🥕 🌽 🍕 🍔 🍟 🌭 🍿 🧁 🍰 🎂 🍩 🍪 🍫 🍬 🍭 🍦 🥛 🧃 ☕ 🫖 🥞 🍳',
    'نشاطات': '⚽ 🏀 🏈 🎾 🏐 🏓 🏸 🚴 🏊 🎨 🎮 🧩 🎲 🎯 🎹 🎸 🎤 🎧 📚 ✏️ 🏆 🥇 🎖️ 🎁 🎈 🎉 🎊 ✨ 🌟 ⭐ 🌈 ☀️ 🌙 ⛅ 🌧️ ❄️ 🔥 🚗 ✈️ 🚀 🏠 🕌 🌍',
  };
  function showPanel() {
    const p = $('panel');
    if (!p) return;
    p.hidden = !panel;
    if (panel === 'emoji') {
      p.innerHTML = Object.entries(EMOJI).map(([k, v]) =>
        `<p class="panel-h">${k}</p><div class="emoji-grid">${v.split(' ').map(e => `<button data-act="emoji" data-arg="${e}">${e}</button>`).join('')}</div>`).join('');
    } else if (panel === 'sticker') {
      p.innerHTML = `<p class="panel-h">ملصقات فلفولة وأرنوبة — اضغط لإرسال</p><div class="sticker-grid">${Art.STICKERS.map(s =>
        `<button data-act="sticker" data-arg="${s}">${Art.sticker(s)}</button>`).join('')}</div>`;
    }
    const box = $('msgs');
    if (box) box.scrollTop = box.scrollHeight;
  }

  // ───── النوافذ ─────
  function modal(html) {
    const m = $('modal');
    m.innerHTML = `<div class="modal-bg" data-act="closeModal"></div>${html}`;
    m.hidden = false;
  }
  function closeModal() { stopCam(); const m = $('modal'); m.hidden = true; m.innerHTML = ''; }

  function findMsg(r, id) { return Cloud.msgsOf(r).find(m => m.id === id); }

  function msgMenu(id) {
    const m = findMsg(room, id);
    if (!m || !canWrite(room)) return;
    const mine = (m.reacts || {})[uid()];
    const del = m.from === uid() || isParent();
    modal(`<div class="sheet small">
      <p class="muted small">${esc(nameOf(m.from))} · ${dayOf(m.at)} ${timeOf(m.at)}</p>
      <div class="react-pick">${['❤️', '😂', '👍', '😮', '😢', '🎉', '🙏', '🌟'].map(e =>
        `<button class="${mine === e ? 'on' : ''}" data-act="react" data-arg="${room}|${id}|${e}">${e}</button>`).join('')}</div>
      ${m.text ? `<button class="btn plain wide" data-act="copy" data-arg="${id}">📋 نسخ النص</button>` : ''}
      ${del ? `<button class="btn plain wide danger-t" data-act="delMsg" data-arg="${room}|${id}">🗑️ حذف الرسالة</button>` : ''}
      <button class="btn plain wide" data-act="closeModal">إغلاق</button>
    </div>`);
  }

  // ───── الرسائل الصوتية: تسجيل حتى دقيقة ويُحفظ داخل الرسالة ─────
  const REC_MAX = 60;
  let rec = null;      // { mr, stream, chunks, start, timer, cancel }
  let player = null;   // { id, audio }
  const fmt = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  // mp4 أولاً لأنه يعمل على آيفون وأندرويد معاً
  const recType = () => ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    .find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';

  function voiceBubble(m) {
    const on = player && player.id === m.id;
    return `<button class="voice ${on && !player.audio.paused ? 'playing' : ''}" data-act="playVoice" data-arg="${room}|${m.id}" data-aud="${m.id}">
      <span class="v-btn">${on && !player.audio.paused ? '⏸️' : '▶️'}</span>
      <span class="v-wave">${'<i></i>'.repeat(18)}</span>
      <span class="v-dur">${fmt(m.dur || 0)}</span>
    </button>`;
  }
  function paintVoice() {
    document.querySelectorAll('[data-aud]').forEach(el => {
      const on = player && player.id === el.dataset.aud;
      const playing = on && !player.audio.paused;
      el.classList.toggle('playing', playing);
      el.querySelector('.v-btn').textContent = playing ? '⏸️' : '▶️';
      const a = on ? player.audio : null;
      const p = a && a.duration && isFinite(a.duration) ? a.currentTime / a.duration : 0;
      el.style.setProperty('--p', on ? p : 0);
    });
  }
  function playVoice(arg) {
    const [r, id] = arg.split('|');
    if (player && player.id === id) {
      if (player.audio.paused) player.audio.play().catch(() => {}); else player.audio.pause();
      paintVoice();
      return;
    }
    if (player) player.audio.pause();
    const m = findMsg(r, id);
    if (!m || !m.audio) return;
    const audio = new Audio(m.audio);
    player = { id, audio };
    ['play', 'pause', 'timeupdate'].forEach(ev => audio.addEventListener(ev, paintVoice));
    audio.addEventListener('ended', () => { audio.currentTime = 0; paintVoice(); });
    audio.play().catch(() => toast('⚠️ تعذّر تشغيل التسجيل على هذا الجهاز'));
    paintVoice();
  }

  async function recStart() {
    if (rec) return;
    if (!window.MediaRecorder || !navigator.mediaDevices) { toast('🎤 هذا المتصفح لا يدعم التسجيل'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { toast(e.name === 'NotAllowedError' ? '🎤 اسمح للتطبيق باستخدام الميكروفون من إعدادات المتصفح' : '🎤 تعذّر فتح الميكروفون', 4000); return; }
    const type = recType();
    const mr = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
    rec = { mr, stream, chunks: [], start: Date.now(), cancel: false, room };
    mr.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
    mr.onstop = finishRec;
    mr.start(250);
    if (player) player.audio.pause();
    Sound.tap();
    if (navigator.vibrate) navigator.vibrate(40);
    $('recBar').hidden = false;
    document.querySelector('.composer:not(.recbar)').hidden = true;
    rec.timer = setInterval(() => {
      const sec = (Date.now() - rec.start) / 1000;
      const t = $('recTime');
      if (t) t.textContent = fmt(sec);
      if (sec >= REC_MAX) { toast('⏱️ أقصى مدة دقيقة واحدة'); recStop(false); }
    }, 200);
  }
  function recStop(cancel) {
    if (!rec) return;
    rec.cancel = cancel;
    clearInterval(rec.timer);
    if (rec.mr.state !== 'inactive') rec.mr.stop(); else finishRec();
    const bar = $('recBar'), main = document.querySelector('.composer:not(.recbar)');
    if (bar) bar.hidden = true;
    if (main) main.hidden = false;
  }
  function finishRec() {
    const r = rec;
    rec = null;
    if (!r) return;
    r.stream.getTracks().forEach(t => t.stop());
    const dur = Math.round((Date.now() - r.start) / 100) / 10;
    if (r.cancel) return;
    if (dur < 0.8) { toast('🎤 التسجيل قصير جداً'); return; }
    const blob = new Blob(r.chunks, { type: r.mr.mimeType || 'audio/webm' });
    const fr = new FileReader();
    fr.onload = () => {
      if (fr.result.length > 900000) { toast('⚠️ التسجيل طويل جداً'); return; }
      Cloud.send(r.room, { audio: fr.result, dur: Math.min(REC_MAX, Math.round(dur)) || 1 }).done
        .catch(() => toast('⚠️ تعذّر إرسال التسجيل'));
      Sound.send();
    };
    fr.readAsDataURL(blob);
  }

  // ───── الصور: تُصغَّر على الجهاز قبل الإرسال حتى تتسع في رسالة واحدة ─────
  function shrink(src, w, h) {
    let max = 1280, q = 0.78, out = '';
    for (let i = 0; i < 8; i++) {
      const s = Math.min(1, max / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * s);
      c.height = Math.round(h * s);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(src, 0, 0, c.width, c.height);
      out = c.toDataURL('image/jpeg', q);
      if (out.length < 650000) break;
      max *= 0.8; q = Math.max(0.5, q - 0.07);
    }
    return out;
  }
  function compress(file) {
    return new Promise((ok, fail) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(shrink(img, img.naturalWidth, img.naturalHeight)); };
      img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('img')); };
      img.src = url;
    });
  }

  // الصورة جاهزة: في المحادثة تظهر نافذة الإرسال، وفي الخبر تُضاف إليه
  function gotImage(kind, data, fromCam) {
    if (kind === 'chat') {
      pendingImg = { room, data };
      modal(`<div class="sheet"><h3>📷 إرسال صورة</h3><img class="news-img" src="${data}" alt="">
        <input id="imgCap" class="text-in" maxlength="500" placeholder="اكتب تعليقاً (اختياري)">
        <div class="row"><button class="btn green" data-act="sendImg">أرسل 🚀</button>
        ${fromCam ? '<button class="btn blue" data-act="camera" data-arg="chat">📸 أعد التصوير</button>' : ''}
        <button class="btn plain" data-act="closeModal">إلغاء</button></div></div>`);
    } else {
      newsDraft = newsDraft || {};
      newsDraft.img = data;
      showNewsModal();
    }
  }

  // كل مدخلات اختيار الصور، في الصفحة أو داخل النوافذ
  document.addEventListener('change', async e => {
    const inp = e.target.closest('input[type=file][data-pick]');
    if (!inp || !inp.files[0]) return;
    const kind = inp.dataset.pick;
    if (kind === 'news') keepNewsDraft();
    toast('⏳ نجهّز الصورة…', 1500);
    try { gotImage(kind, await compress(inp.files[0])); } catch (err) { toast('⚠️ تعذّر فتح الصورة'); }
    inp.value = '';
  });

  // اختيار مصدر الصورة: الكاميرا أو الألبوم
  function photoMenu(kind) {
    modal(`<div class="sheet small">
      <h3>📷 أرسل صورة</h3>
      <div class="pick-src">
        <button data-act="camera" data-arg="${kind}"><b>📸</b><span>صوّر الآن</span></button>
        <label><b>🖼️</b><span>من الألبوم</span><input type="file" accept="image/*" hidden data-pick="${kind}"></label>
      </div>
      <button class="btn plain wide" data-act="closeModal">إلغاء</button>
    </div>`);
  }

  // ───── الكاميرا داخل التطبيق ─────
  // إطارات لطيفة: فلفولة أو أرنوبة تظهر في زاوية الصورة
  const FRAMES = [
    { id: '', name: 'بدون' },
    { id: 'f', name: 'فلفولة', who: 'falfoula', mood: 'cheer' },
    { id: 'a', name: 'أرنوبة', who: 'arnooba', mood: 'love' },
  ];
  let cam = null;   // { stream, facing, kind, frame }
  const camSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  function stopCam() {
    if (cam && cam.stream) cam.stream.getTracks().forEach(t => t.stop());
    if (cam) cam.stream = null;
  }
  function frameImage(f) {
    return new Promise(res => {
      if (!f || !f.who) return res(null);
      const svg = (f.who === 'arnooba' ? Art.arnoobaSvg : Art.falfoulaSvg)(f.mood).replace('<svg ', '<svg width="480" height="600" ');
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  async function openCamera(kind) {
    if (kind === 'news') keepNewsDraft();
    // بلا كاميرا مدعومة: نفتح كاميرا الجهاز عبر مدخل الملفات
    if (!camSupported()) { fallbackCamera(kind); return; }
    const facing = cam ? cam.facing : 'environment';
    const frame = cam ? cam.frame : (look === 'arnooba' ? 'a' : '');
    stopCam();
    cam = { stream: null, facing, kind, frame };
    modal(`<div class="camera">
      <video id="camVideo" playsinline muted autoplay class="${facing === 'user' ? 'mirror' : ''}"></video>
      <div class="cam-frame" id="camFrame"></div>
      <div class="cam-top">
        <button class="cam-btn" data-act="camClose" aria-label="إغلاق">✖</button>
        <div class="cam-frames">${FRAMES.map(f => `<button class="chip ${f.id === frame ? 'on' : ''}" data-act="camFrame" data-arg="${f.id}">${f.name}</button>`).join('')}</div>
      </div>
      <p class="cam-wait" id="camWait"><span class="spinner"></span> نفتح الكاميرا…</p>
      <div class="cam-bar">
        <label class="cam-btn" aria-label="من الألبوم">🖼️<input type="file" accept="image/*" hidden data-pick="${kind}"></label>
        <button class="shutter" data-act="camShot" aria-label="التقط الصورة"></button>
        <button class="cam-btn" data-act="camFlip" aria-label="قلب الكاميرا">🔄</button>
      </div>
    </div>`);
    paintFrame();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
      });
      // أُغلقت النافذة أثناء انتظار الإذن
      if (!cam || !$('camVideo')) { stream.getTracks().forEach(t => t.stop()); return; }
      cam.stream = stream;
      const v = $('camVideo');
      v.srcObject = stream;
      v.play().catch(() => {});
      v.addEventListener('playing', () => { const w = $('camWait'); if (w) w.remove(); }, { once: true });
    } catch (e) {
      const k = cam.kind;
      closeModal();
      toast(e.name === 'NotAllowedError' ? '📷 اسمح للتطبيق باستخدام الكاميرا من إعدادات المتصفح' : '📷 تعذّر فتح الكاميرا', 4000);
      if (e.name !== 'NotAllowedError') fallbackCamera(k);
    }
  }
  function fallbackCamera(kind) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
    inp.dataset.pick = kind; inp.hidden = true;
    document.body.appendChild(inp);
    inp.addEventListener('change', () => setTimeout(() => inp.remove(), 0));
    inp.click();
  }
  function paintFrame() {
    const box = $('camFrame');
    if (!box || !cam) return;
    const f = FRAMES.find(x => x.id === cam.frame);
    box.innerHTML = f && f.who ? Art.char(f.who, f.mood) : '';
    document.querySelectorAll('.cam-frames .chip').forEach(b => b.classList.toggle('on', b.dataset.arg === cam.frame));
  }
  async function takeShot() {
    const v = $('camVideo');
    if (!cam || !v || !v.videoWidth) { toast('⏳ لحظة، الكاميرا تستعد…'); return; }
    const w = v.videoWidth, h = v.videoHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    // الكاميرا الأمامية تُحفظ كما تُرى في المعاينة (كالمرآة)
    if (cam.facing === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fimg = await frameImage(FRAMES.find(x => x.id === cam.frame));
    if (fimg) {
      const fh = Math.min(w, h) * 0.42, fw = fh * 0.8;
      ctx.drawImage(fimg, w * 0.03, h - fh - h * 0.02, fw, fh);
    }
    Sound.pop();
    const flash = document.createElement('div');
    flash.className = 'cam-flash';
    $('modal').appendChild(flash);
    const kind = cam.kind;
    const data = shrink(c, w, h);
    stopCam();
    setTimeout(() => gotImage(kind, data, true), 180);
  }

  // ───── الانضمام برمز ─────
  function deviceName() {
    const ua = navigator.userAgent;
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) return 'آيباد';
    if (/iPhone/.test(ua)) return 'آيفون';
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'جوال أندرويد' : 'تابلت أندرويد';
    return 'كمبيوتر';
  }

  function joinWith(code) {
    joinCode = code;
    stopScan();
    if (Cloud.status() === 'loading') { toast('⏳ لحظة، جارٍ الاتصال…'); return; }
    if (Cloud.status() === 'unavailable' || !navigator.onLine) { toast('📡 الانضمام يحتاج اتصالاً بالإنترنت'); return; }
    toast('⏳ جارٍ الانضمام…', 8000);
    Cloud.join(code, deviceName()).then(hint => {
      joinCode = '';
      joinHint = hint;
      view = 'auto';
      Sound.pop();
      toast('✅ انضممت إلى العائلة!');
      render();
    }).catch(e => {
      const msg = { expired: '⚠️ الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً من ولي الأمر.',
        'bad-code': '⚠️ الرمز 8 أحرف، تأكد منه.',
        'signed-in': 'هذا الجهاز مسجّل بحساب Google بالفعل.', network: '📡 تعذّر الاتصال، تأكد من الإنترنت' }[e.message];
      toast(msg || `⚠️ تعذّر الانضمام (${e.code || e.message || 'خطأ'})`, 5000);
    });
  }

  let scanStream = null;
  function stopScan() {
    if (scanStream) scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
  }
  const loadJsQR = () => window.jsQR ? Promise.resolve() : new Promise((ok, fail) => {
    const sc = document.createElement('script');
    sc.src = 'js/vendor/jsQR.js';
    sc.onload = ok; sc.onerror = fail;
    document.head.appendChild(sc);
  });
  async function startScan() {
    if (scanStream) return;
    try {
      const [stream] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }),
        loadJsQR(),
      ]);
      scanStream = stream;
    } catch (e) { toast('📷 تعذّر فتح الكاميرا. اكتب الرمز بدلاً من ذلك.', 4000); return; }
    const video = $('scanVideo');
    if (!video) { stopScan(); return; }
    $('scanBox').hidden = false;
    $('scanBtn').hidden = true;
    video.srcObject = scanStream;
    video.play().catch(() => {});
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = () => {
      if (!scanStream || !document.body.contains(video)) { stopScan(); return; }
      if (video.readyState >= 2 && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        const m = hit && hit.data.match(/join=([0-9A-Z]{8})/i);
        if (m) { Sound.pop(); joinWith(m[1].toUpperCase()); return; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ───── التنبيهات ─────
  const notifyOn = () => ls.get('family-chat-notify', false) && 'Notification' in window && Notification.permission === 'granted';
  function alertNew(r, fresh) {
    const incoming = fresh.filter(m => m.from !== uid() && !m.pending && Date.now() - m.at < 120000);
    if (!incoming.length || !canWrite(r)) return;
    const visibleHere = room === r && document.visibilityState === 'visible';
    if (visibleHere) { Sound.tap(); return; }
    Sound.pop();
    if (navigator.vibrate) navigator.vibrate(60);
    const m = incoming[incoming.length - 1];
    const text = `${nameOf(m.from)}: ${m.sticker ? '✨ ملصق' : m.audio ? '🎤 رسالة صوتية' : m.img ? '📷 صورة' : (m.title || m.text || '').slice(0, 80)}`;
    if (document.visibilityState === 'visible') toast(`💌 ${roomTitle(r) === nameOf(m.from) ? '' : roomTitle(r) + ' · '}${text}`);
    else if (notifyOn() && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(roomTitle(r), {
        body: text, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: r, lang: 'ar', dir: 'rtl', data: { room: r },
      })).catch(() => {});
    }
  }

  // ───── الأزرار ─────
  function openRoom(r) {
    room = r;
    panel = null;
    Cloud.watch(r, 300);
    history.pushState({ room: r }, '');
    render();
  }
  function closeRoom() {
    recStop(true);
    if (player) { player.audio.pause(); player = null; }
    room = null;
    panel = null;
    render();
  }

  const actions = {
    signIn() {
      Cloud.signIn().catch(e => { if (e.code !== 'auth/popup-closed-by-user') toast('⚠️ تعذّر تسجيل الدخول'); });
    },
    goJoin() { view = 'join'; render(); },
    back() { stopScan(); view = 'auto'; render(); },
    scan() { startScan(); },
    joinTyped() { joinWith($('codeIn').value); },

    quickName(n) { $('nameIn').value = n; },
    pickAvatar(a) {
      setupAvatar = a;
      document.querySelectorAll('.av-opt').forEach(b => b.classList.toggle('on', b.dataset.arg === a));
      Sound.tap();
    },
    pickLook(l) {
      setupLook = l;
      look = l;
      paintLook();
      document.querySelectorAll('.look-opt').forEach(b => b.classList.toggle('on', b.dataset.arg === l));
    },
    saveProfile() {
      const name = $('nameIn').value.trim();
      if (!name) { toast('✏️ اكتب اسمك أولاً'); $('nameIn').focus(); return; }
      const mine = Cloud.me();
      const role = isParent() ? 'parent' : mine ? mine.role : (showSetup.role || 'kid');
      look = setupLook || look;
      ls.set('family-chat-look', look);
      Cloud.saveProfile({ name, avatar: setupAvatar, role, look }).catch(() => toast('⚠️ تعذّر الحفظ، تأكد من الإنترنت'));
      setupAvatar = setupLook = null;
      view = 'auto';
      Sound.pop();
      // يظهر الملف فوراً من الذاكرة المحلية حتى قبل وصوله للخادم
      setTimeout(render, 50);
      if (!mine) toast(`🎉 أهلاً ${name}!`);
    },
    cancelSetup() { setupAvatar = setupLook = null; look = ls.get('family-chat-look', 'falfoula'); view = 'auto'; render(); },
    editProfile() { view = 'setup'; render(); },

    tab(t) { tab = t; ls.set('family-chat-tab', t); render(); window.scrollTo(0, 0); },
    open(r) { openRoom(r); },
    close() { history.back(); },

    setLook(l) { look = l; ls.set('family-chat-look', l); const me = Cloud.me(); Cloud.saveProfile({ ...me, look: l }).catch(() => {}); render(); },

    panel(p) {
      panel = panel === p ? null : p;
      showPanel();
      Sound.tap();
    },
    emoji(e) {
      const t = $('txt');
      const s = t.selectionStart ?? t.value.length, en = t.selectionEnd ?? t.value.length;
      t.value = t.value.slice(0, s) + e + t.value.slice(en);
      const pos = s + e.length;
      t.setSelectionRange(pos, pos);
      grow();
    },
    sticker(s) {
      Cloud.send(room, { sticker: s });
      Sound.send();
      panel = null;
      showPanel();
    },
    sendText() {
      const t = $('txt');
      const text = t.value.trim();
      if (!text) return;
      Cloud.send(room, { text });
      t.value = '';
      grow();
      Sound.send();
      if (panel === 'emoji') { panel = null; showPanel(); }
      const box = $('msgs');
      if (box) box.scrollTop = box.scrollHeight;
    },
    sendImg() {
      if (!pendingImg) return;
      const cap = ($('imgCap').value || '').trim();
      const { done } = Cloud.send(pendingImg.room, { img: pendingImg.data, text: cap });
      done.catch(() => toast('⚠️ تعذّر إرسال الصورة'));
      pendingImg = null;
      closeModal();
      Sound.send();
    },
    msgMenu(id) { msgMenu(id); },
    photoMenu(kind) { photoMenu(kind); },
    recStart() { recStart(); },
    recSend() { recStop(false); },
    recCancel() { recStop(true); Sound.tap(); },
    playVoice(arg) { playVoice(arg); },
    camera(kind) { openCamera(kind); },
    camShot() { takeShot(); },
    camFlip() { if (!cam) return; cam.facing = cam.facing === 'user' ? 'environment' : 'user'; openCamera(cam.kind); },
    camFrame(id) { if (!cam) return; cam.frame = id; paintFrame(); },
    camClose() {
      const kind = cam && cam.kind;
      closeModal();
      cam = null;
      if (kind === 'news' && newsDraft) showNewsModal();
    },
    react(arg) {
      const [r, id, e] = arg.split('|');
      const m = findMsg(r, id);
      if (!m) return;
      const mine = (m.reacts || {})[uid()];
      Cloud.react(r, id, mine === e ? null : e).catch(() => toast('⚠️ تعذّر التفاعل'));
      Sound.tap();
      closeModal();
    },
    copy(id) {
      const m = findMsg(room, id);
      if (m && navigator.clipboard) navigator.clipboard.writeText(m.text).then(() => toast('📋 نُسخ النص')).catch(() => {});
      closeModal();
    },
    delMsg(arg) {
      const [r, id] = arg.split('|');
      if (!confirm('حذف هذه الرسالة عند الجميع؟')) return;
      Cloud.remove(r, id).catch(() => toast('⚠️ تعذّر الحذف'));
      closeModal();
    },
    view(arg) {
      const [r, id] = arg.split('|');
      const m = findMsg(r, id);
      if (!m || !m.img) return;
      modal(`<div class="viewer" data-act="closeModal"><img src="${m.img}" alt=""><a class="btn plain small" href="${m.img}" download="family-photo.jpg">⬇️ حفظ الصورة</a></div>`);
    },
    closeModal() { closeModal(); },

    newsNew() { newsDraft = newsDraft || {}; showNewsModal(); },
    newsNoImg() { keepNewsDraft(); newsDraft.img = null; showNewsModal(); },
    newsPost() {
      keepNewsDraft();
      const d = newsDraft;
      if (!d.title.trim() && !d.text.trim() && !d.img) { toast('✏️ اكتب الخبر أولاً'); return; }
      Cloud.send('news', { title: d.title.trim(), text: d.text.trim(), img: d.img });
      newsDraft = null;
      closeModal();
      Sound.pop();
      toast('📣 نُشر الخبر!');
    },

    pairRole(r) {
      document.querySelectorAll('#pairRole .chip').forEach(b => b.classList.toggle('on', b.dataset.arg === r));
    },
    pair() {
      const name = $('pairName').value.trim();
      const on = document.querySelector('#pairRole .chip.on');
      const role = on ? on.dataset.arg : 'K';
      const { code, exp, ready } = Cloud.createCode(`${role}|${name}`);
      pairing = { code, exp, ready: false, name, since: Date.now() };
      $('pairName').blur();
      render();
      const mine = () => pairing && pairing.code === code;
      ready.then(() => { if (mine()) { pairing.ready = true; refresh(); } })
        .catch(() => { if (mine()) { pairing = null; refresh(); toast('⚠️ تعذّر إنشاء الرمز. تأكد من الإنترنت.'); } });
      setTimeout(() => { if (mine()) { pairing = null; refresh(); } }, exp - Date.now() + 500);
    },
    cancelPair() { pairing = null; render(); },
    removeMember(id) {
      if (!confirm(`فصل ${nameOf(id)} عن العائلة؟ سيُفصل جهازه عن المجلس وعن ألعاب العائلة أيضاً، وتبقى رسائله.`)) return;
      Cloud.removeMember(id).then(() => toast('تم الفصل')).catch(() => toast('⚠️ تعذّر الفصل'));
    },

    toggleNotify() {
      if (notifyOn()) { ls.set('family-chat-notify', false); render(); return; }
      if (!('Notification' in window)) { toast('هذا المتصفح لا يدعم التنبيهات'); return; }
      Notification.requestPermission().then(p => {
        ls.set('family-chat-notify', p === 'granted');
        if (p !== 'granted') toast('🔕 لم يُسمح بالتنبيهات من إعدادات المتصفح');
        render();
      });
    },
    toggleMute() { ls.set('family-chat-muted', !ls.get('family-chat-muted', false)); render(); },
    signOut() {
      const msg = isParent() ? 'تسجيل الخروج من هذا الجهاز؟' : 'فصل هذا الجهاز عن مجلس العائلة؟ ستحتاج رمزاً جديداً من ولي الأمر للعودة.';
      if (!confirm(msg)) return;
      room = null;
      Cloud.signOut();
    },
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    // الضغط على الصورة يفتحها ولا يفتح قائمة الرسالة
    if (el.dataset.act === 'closeModal' && el.classList.contains('viewer') && e.target.closest('a')) return;
    const fn = actions[el.dataset.act];
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(el.dataset.arg); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'codeIn') actions.joinTyped();
  });

  // زر الرجوع في الجوال يغلق المحادثة بدل الخروج من التطبيق
  window.addEventListener('popstate', () => {
    if (!$('modal').hidden) { closeModal(); if (room) history.pushState({ room }, ''); return; }
    if (room) closeRoom();
  });

  // رابط QR مسحته كاميرا الجهاز مباشرة: نفتح شاشة الانضمام والرمز مكتوب فيها
  function joinFromHash() {
    const m = location.hash.match(/join=([0-9A-Z]{8})/i);
    if (!m) return false;
    joinCode = m[1].toUpperCase();
    history.replaceState(null, '', location.pathname + location.search);
    if (!Cloud.role()) { view = 'join'; render(); if (Cloud.status() !== 'loading') joinWith(joinCode); }
    return true;
  }
  window.addEventListener('hashchange', joinFromHash);

  // ───── التحديثات من السحابة ─────
  let wasStatus = '';
  Cloud.on(what => {
    if (what === 'status') {
      const st = Cloud.status();
      // وصل الاتصال ورمز الانضمام من الرابط ما زال ينتظر
      if (joinCode && view === 'join' && st === 'out' && wasStatus !== 'out') joinWith(joinCode);
      wasStatus = st;
      if (!Cloud.role()) { room = null; pairing = null; }
      render();
      return;
    }
    if (what === 'users') {
      // انضم فرد جديد بعد إنشاء الرمز: نخفي الرمز ونرحّب به
      if (pairing) {
        const fresh = Object.values(users()).find(u => u.id !== uid() && (u.at || 0) > pairing.since);
        if (fresh) { pairing = null; Sound.pop(); toast(`🎉 انضم ${fresh.name} إلى العائلة!`, 4000); }
      }
      if (Cloud.me()) {
        if (Cloud.me().look && !ls.get('family-chat-look', null)) { look = Cloud.me().look; ls.set('family-chat-look', look); }
        watchAll();
        Cloud.beat();
      }
      if (room && $('msgs')) refreshRoom(); else refresh();
      return;
    }
    if (what && what.room) {
      alertNew(what.room, what.fresh);
      if (room === what.room && $('msgs')) refreshRoom();
      else if (!room) refresh();
      else badge();
    }
  });

  setInterval(() => { if (document.visibilityState === 'visible') Cloud.beat(); }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { Cloud.beat(); if (room) markRead(room); badge(); }
  });

  // الضغط على تنبيه يفتح المحادثة
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.room && Cloud.role()) openRoom(e.data.room);
    });
  }

  paintLook();
  joinFromHash();
  render();
  Cloud.start();
})();
