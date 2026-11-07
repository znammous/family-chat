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
  let peek = null;          // ولي الأمر يشاهد محادثات هذا الفرد
  let panel = null;         // emoji | sticker
  let stick = true;         // هل نُبقي المحادثة ملتصقة بآخر رسالة
  let panelTab = 'emoji';   // آخر تبويب فُتح في لوحة الإيموجي والملصقات
  let pairing = null;       // رمز إضافة فرد: { code, exp, ready, name, role }
  let joinCode = '';
  let joinHint = '';
  let pendingImg = null;    // صورة تنتظر الإرسال: { room, data }
  let newsDraft = null;     // خبر يُكتب: { img }
  let replyTo = null;       // رسالة نرد عليها: { room, id }
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
  // الفرد الذي أُعيد ربطه بجهاز جديد: ملفه القديم فيه heir (حسابه الجديد)، وملفه الجديد فيه root (هويته الأولى)
  const heirOf = id => { let x = id; for (let i = 0; i < 10 && users()[x] && users()[x].heir; i++) x = users()[x].heir; return x; };
  const userOf = id => users()[heirOf(id)] || users()[id];
  const nameOf = id => (userOf(id) ? userOf(id).name : 'فرد سابق');
  const isMe = id => !!id && heirOf(id) === uid();
  // هوية الفرد الثابتة التي تُسمّى بها محادثاته الخاصة
  const keyOf = id => { const u = userOf(id); return u ? u.root || u.id : id; };
  const myKey = () => keyOf(uid());
  const active = () => Object.values(users()).filter(u => !u.left && !u.heir).sort((a, b) => (a.at || 0) - (b.at || 0));
  // المفصولون الذين لم يُعَد ربطهم بعد
  const former = () => Object.values(users()).filter(u => u.left && (!u.heir || !users()[heirOf(u.id)]));
  const others = () => active().filter(u => u.id !== uid());
  const dmId = (a, b) => 'dm_' + [a, b].sort().join('_');
  const dmWith = id => dmId(myKey(), keyOf(id));
  const dmPeers = r => r.slice(3).split('_');
  const isParent = () => Cloud.role() === 'parent';
  const ROLE_BADGE = { parent: '👑 ولي الأمر', adult: '⭐ ولي أمر', kid: '' };
  // ولي الأمر الآخر يظهر بـ 👑 لمن يعرف ذلك (أولياء الأمور)
  const roleBadge = u => (u && u.role !== 'parent' && Cloud.isGuardian(u.id) ? '👑 ولي أمر' : ROLE_BADGE[u && u.role] || '');
  // لون ثابت لاسم كل فرد في محادثة العائلة
  const COLORS = ['#e0701a', '#1b7a45', '#cc3a76', '#3a76cf', '#8a47ad', '#13807c', '#b8500c', '#a32a5b'];
  const colorOf = id => COLORS[[...String(keyOf(id))].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];

  // المجموعات: غرف للعائلة كلها ينشئها ولي الأمر، معرّفها يبدأ بـ g_
  const isGroup = r => r.startsWith('g_');
  const groupOf = r => Cloud.groups().find(g => g.id === r);

  function roomTitle(r) {
    if (r === 'family') return '🏡 بيت العائلة';
    if (r === 'news') return '📰 أخبار العائلة';
    if (isGroup(r)) { const g = groupOf(r); return g ? `${g.icon} ${g.name}` : 'مجموعة محذوفة'; }
    const peers = dmPeers(r);
    if (!peers.includes(myKey())) return peers.map(nameOf).join(' و ');
    return nameOf(peers.find(p => p !== myKey()) || uid());
  }
  const canWrite = r => r === 'family' || r === 'news' || (isGroup(r) ? !!groupOf(r) : dmPeers(r).includes(myKey()));
  // الرسائل الخاصة يوقفها ولي الأمر، وتبقى المحادثة معه هو متاحة
  const dmOpen = r => !r.startsWith('dm_') || isParent() || !Cloud.dmOff() || dmPeers(r).includes(Cloud.fid());
  const canSend = r => canWrite(r) && dmOpen(r);

  // كل الغرف التي نتابعها: العائلة والأخبار ومحادثاتي الخاصة، وولي الأمر يرى محادثات الأبناء أيضاً
  function allRooms() {
    const list = ['family', 'news'].concat(Cloud.groups().map(g => g.id));
    const ids = active().map(u => keyOf(u.id));
    others().forEach(u => list.push(dmWith(u.id)));
    if (isParent()) {
      ids.forEach((a, i) => ids.slice(i + 1).forEach(b => {
        if (a !== myKey() && b !== myKey()) list.push(dmId(a, b));
      }));
    }
    return list;
  }
  const watchAll = () => allRooms().forEach(r => Cloud.watch(r, r === room ? 300 : 40));

  // ───── المقروء ─────
  const read = ls.get('family-chat-read', {});
  if (!read._base) { read._base = Date.now(); ls.set('family-chat-read', read); }
  const lastRead = r => Math.max(read[r] || 0, read._base);
  const unreadOf = r => Cloud.msgsOf(r).filter(m => !isMe(m.from) && m.at > lastRead(r)).length;
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
    if (peek && isParent() && userOf(peek)) return showPeek();
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
      ${installBtn('link-btn')}
      <a class="link-btn" href="${HEROES}">🌟 العودة إلى عالم الأبطال</a>
    </div>`;
  }

  // تثبيت المجلس كتطبيق على الشاشة الرئيسية: الزر يظهر في المتصفح فقط
  const standalone = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
  window.addEventListener('appinstalled', () => { installPrompt = null; toast('✅ ثُبّت التطبيق، تجده في الشاشة الرئيسية'); });
  const installBtn = cls => (standalone() ? '' : `<button class="${cls}" data-act="installApp">📲 تثبيت التطبيق</button>`);

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
        <button class="tab ${tab === 'news' ? 'on' : ''}" data-act="tab" data-arg="news">🎉<span>الأخبار</span>${newsN ? `<i class="dot-n">${newsN}</i>` : ''}</button>
        <button class="tab ${tab === 'family' ? 'on' : ''}" data-act="tab" data-arg="family">🏡<span>العائلة</span></button>
      </nav>
    </div>`;
    if (tab === 'news') markRead('news');
  }

  function preview(m) {
    if (!m) return '<i>لا رسائل بعد، ابدأ أنت! 👋</i>';
    const who = isMe(m.from) ? 'أنت: ' : '';
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
    const fam = others().filter(u => dmOpen(dmWith(u.id)));
    const dmNote = !isParent() && Cloud.dmOff()
      ? '<div class="card empty"><p>🔒 أوقف ولي الأمر الرسائل الخاصة حالياً، ويمكنك مراسلته هو.</p><p class="muted small">تكلّم مع الجميع في «بيت العائلة» 🏡</p></div>' : '';
    const famIcon = `<span class="av family-av">🏡</span>`;
    let h = `<div class="falfoula-talk">${Art.char(look === 'arnooba' ? 'arnooba' : 'falfoula', 'happy', 'talk')}<p>${greeting()}</p></div>`;
    h += `<div class="card list">${roomRow('family', famIcon, '🏡 بيت العائلة')}${groupRows()}</div>`;
    h += '<h3 class="section">💌 رسائل خاصة</h3>' + dmNote;
    if (!fam.length && dmNote) {
      // لا شيء آخر نعرضه
    } else if (!fam.length) {
      h += `<div class="card empty"><p>لا يوجد أفراد آخرون بعد.</p>${isParent() ? '<button class="btn pink" data-act="tab" data-arg="family">➕ أضف أفراد العائلة</button>' : '<p class="muted small">اطلب من ولي الأمر أن يضيف إخوتك.</p>'}</div>`;
    } else {
      const sorted = fam.slice().sort((a, b) => lastAt(dmWith(b.id)) - lastAt(dmWith(a.id)));
      h += `<div class="card list">${sorted.map(u => roomRow(dmWith(u.id),
        `<span class="av-wrap">${Art.avatar(u.avatar)}${online(u) ? '<i class="online"></i>' : ''}</span>`,
        `${esc(u.name)} ${roleBadge(u) ? `<em class="role">${roleBadge(u)}</em>` : ''}`)).join('')}</div>`;
    }
    return h;
  }
  const groupIcon = g => `<span class="av family-av">${esc(g.icon)}</span>`;
  const groupRows = () => Cloud.groups().slice().sort((a, b) => lastAt(b.id) - lastAt(a.id))
    .map(g => roomRow(g.id, groupIcon(g), esc(roomTitle(g.id)))).join('');
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
    const list = active();
    let h = `<div class="card me-card">${Art.avatar(me.avatar, 'lg')}<div><b>${esc(me.name)}</b><small>${roleBadge(me) || '🌟 من أبطال العائلة'}</small></div>
      <button class="btn small blue" data-act="editProfile">✏️ تعديل</button></div>`;
    h += `<div class="card"><h3>🌍 عالمي</h3><div class="look-pick">
      <button class="look-opt ${look === 'falfoula' ? 'on' : ''}" data-act="setLook" data-arg="falfoula">${Art.char('falfoula', 'happy')}<b>عالم فلفولة</b></button>
      <button class="look-opt ${look === 'arnooba' ? 'on' : ''}" data-act="setLook" data-arg="arnooba">${Art.char('arnooba', 'happy')}<b>عالم أرنوبة</b></button></div></div>`;
    h += `<div class="card"><h3>👨‍👩‍👧‍👦 أفراد العائلة (${list.length})</h3><ul class="members">${list.map(u => `<li>
      <span class="av-wrap">${Art.avatar(u.avatar)}${online(u) ? '<i class="online"></i>' : ''}</span>
      <span class="m-main"><b>${esc(u.name)}${u.id === uid() ? ' (أنت)' : ''}</b><small>${roleBadge(u) ? roleBadge(u) + ' · ' : ''}${u.id === uid() ? 'متصل الآن' : ago(u.seen || 0)}</small></span>
      ${u.id !== uid() && dmOpen(dmWith(u.id)) ? `<button class="btn small pink" data-act="open" data-arg="${dmWith(u.id)}">💌</button>` : ''}
      ${isParent() && u.id !== uid() ? `<button class="btn small blue" data-act="peek" data-arg="${u.id}" aria-label="محادثات ${esc(u.name)}">👀</button>` : ''}
      ${isParent() && u.id !== uid() && u.id !== Cloud.fid() ? `<div class="m-tools">${u.role === 'adult' ? (Cloud.isGuardian(u.id)
        ? `<button class="link-btn small" data-act="revokeGuardian" data-arg="${u.id}">سحب صلاحيات ولي الأمر</button>`
        : `<button class="link-btn small" data-act="grantGuardian" data-arg="${u.id}">👑 منح صلاحيات ولي الأمر</button>`) : ''}
        <button class="link-btn danger small" data-act="removeMember" data-arg="${u.id}">فصل</button></div>` : ''}
    </li>`).join('')}</ul></div>`;
    if (isParent()) h += formerBox() + addMemberBox() + groupsBox() + kidsChats();
    h += `<div class="card"><h3>⚙️ الإعدادات</h3>
      <div class="setting"><span>🔔 تنبيه عند وصول رسالة</span><button class="switch ${notifyOn() ? 'on' : ''}" data-act="toggleNotify"><i></i></button></div>
      <div class="setting"><span>🔊 الأصوات</span><button class="switch ${ls.get('family-chat-muted', false) ? '' : 'on'}" data-act="toggleMute"><i></i></button></div>
      ${isParent() ? `<div class="setting"><span>💌 الرسائل الخاصة بين الأفراد<small class="muted">${Cloud.dmOff() ? 'متوقفة: يراسلونك أنت فقط' : 'مسموحة للجميع'}</small></span><button class="switch ${Cloud.dmOff() ? '' : 'on'}" data-act="toggleDm"><i></i></button></div>
      <p class="muted small" dir="ltr">${esc(Cloud.email())}</p>` : ''}
      ${installBtn('btn plain wide')}
      <a class="btn plain wide" href="${HEROES}">🌟 عالم الأبطال: ألعاب العائلة</a>
      <button class="link-btn danger" data-act="signOut">${Cloud.owner() ? 'تسجيل الخروج من هذا الجهاز' : 'فصل هذا الجهاز عن مجلس العائلة'}</button></div>`;
    return h;
  }

  // ولي الأمر ينشئ مجموعات للعائلة كلها ويعيد تسميتها ويحذفها
  const GROUP_ICONS = ['🛒', '🏠', '🍽️', '📚', '🧹', '🎂', '✈️', '⚽', '🎮', '💊', '🚗', '💬'];
  let groupIconPick = GROUP_ICONS[0];
  function groupsBox() {
    const list = Cloud.groups();
    return `<div class="card"><h3>🗂️ مجموعات العائلة</h3>
      <p class="muted small">مجموعة يدخلها كل أفراد العائلة، مثل «أغراض البيت» أو «رحلة الصيف»، وتظهر في الدردشات تحت «بيت العائلة».</p>
      ${list.length ? `<ul class="members">${list.map(g => `<li>
        ${groupIcon(g)}
        <span class="m-main"><b>${esc(g.name)}</b><small>${preview(Cloud.msgsOf(g.id).slice(-1)[0])}</small></span>
        <button class="btn small pink" data-act="open" data-arg="${g.id}" aria-label="افتح ${esc(g.name)}">💬</button>
        <button class="btn small blue" data-act="renameGroup" data-arg="${g.id}" aria-label="إعادة تسمية ${esc(g.name)}">✏️</button>
        <button class="link-btn danger small" data-act="removeGroup" data-arg="${g.id}">حذف</button>
      </li>`).join('')}</ul>` : ''}
      <input id="groupName" class="text-in" maxlength="40" placeholder="اسم المجموعة (مثال: أغراض البيت)">
      <div class="chips" id="groupIcon">${GROUP_ICONS.map(e =>
        `<button class="chip icon-chip ${e === groupIconPick ? 'on' : ''}" data-act="groupIcon" data-arg="${e}">${e}</button>`).join('')}</div>
      <button class="btn green wide" data-act="addGroup">➕ أنشئ المجموعة</button></div>`;
  }

  // الأفراد المفصولون: ولي الأمر يعيد ربط أحدهم بجهاز جديد فيرجع بنفس اسمه ورسائله ومحادثاته
  function formerBox() {
    const list = former();
    if (!list.length) return '';
    return `<div class="card"><h3>🔌 أفراد مفصولون (${list.length})</h3>
      <p class="muted small">أعد ربط أحدهم برمز QR فيرجع على جهازه بنفس اسمه وصورته ورسائله ومحادثاته.</p>
      <ul class="members">${list.map(u => `<li>
      <span class="av-wrap">${Art.avatar(u.avatar)}</span>
      <span class="m-main"><b>${esc(u.name)}</b><small>${roleBadge(u) ? roleBadge(u) + ' · ' : ''}فُصل ${dayOf(u.left)}</small></span>
      <button class="btn small green" data-act="relink" data-arg="${u.id}">🔁 إعادة ربط</button>
      <button class="link-btn danger small" data-act="forget" data-arg="${u.id}">حذف</button>
    </li>`).join('')}</ul></div>`;
  }

  function addMemberBox() {
    if (pairing && pairing.exp > Date.now()) {
      const qr = qrcode(0, 'M');
      qr.addData(`${location.origin}${location.pathname}#join=${pairing.code}`);
      qr.make();
      return `<div class="card pair-box ${pairing.ready ? '' : 'pending'}">
        <h3>${pairing.relink ? `🔁 إعادة ربط ${esc(pairing.name)}` : `📱 أضف ${esc(pairing.name || 'فرداً')}`}</h3>
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
        <button class="chip" data-act="pairRole" data-arg="A">👑 ولي أمر آخر</button>
      </div>
      <p class="muted small">ولي الأمر الآخر يأخذ صلاحياتك كلها: يرى المحادثات الخاصة ويضيف الأفراد ويفصلهم، هنا وفي الألعاب. رمزه لمرة واحدة.</p>
      <button class="btn green wide" data-act="pair">📱 أنشئ رمز QR</button></div>`;
  }

  // ولي الأمر يطّلع على المحادثات الخاصة بين الأبناء
  function kidsChats() {
    const rows = allRooms().filter(r => r.startsWith('dm_') && !dmPeers(r).includes(myKey()) && Cloud.msgsOf(r).length);
    if (!rows.length) return '';
    return `<div class="card"><h3>👀 محادثات الأبناء الخاصة</h3><div class="list">${rows.map(r => {
      const [a, b] = dmPeers(r).map(userOf);
      return roomRow(r, `<span class="av-pair">${Art.avatar(a ? a.avatar : '🙂', 'sm')}${Art.avatar(b ? b.avatar : '🙂', 'sm')}</span>`, esc(roomTitle(r)));
    }).join('')}</div></div>`;
  }

  // ولي الأمر يدخل إلى دردشات فرد ويرى كل محادثاته الخاصة كما يراها هو
  function showPeek() {
    const u = userOf(peek);
    const rooms = others().concat(isParent() ? [Cloud.me()] : []).filter(o => o && o.id !== peek)
      .map(o => ({ o, r: dmId(keyOf(peek), keyOf(o.id)) }))
      .filter(x => Cloud.msgsOf(x.r).length)
      .sort((a, b) => lastAt(b.r) - lastAt(a.r));
    const rows = rooms.map(({ o, r }) => roomRow(r,
      `<span class="av-wrap">${Art.avatar(o.avatar)}${online(o) ? '<i class="online"></i>' : ''}</span>`,
      `${esc(o.id === uid() ? 'أنت' : o.name)} ${roleBadge(o) ? `<em class="role">${roleBadge(o)}</em>` : ''}`)).join('');
    app.innerHTML = `<div class="page home">
      <header class="room-top">
        <button class="back" data-act="close" aria-label="رجوع"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M13 5l7 7-7 7"/></svg></button>
        <span class="av-wrap">${Art.avatar(u.avatar)}${online(u) ? '<i class="online"></i>' : ''}</span>
        <span class="rt-main"><b>دردشات ${esc(u.name)}</b><small>👀 تشاهد محادثاته الخاصة للاطلاع فقط</small></span>
      </header>
      <div class="tab-body">
        <div class="card list">${roomRow('family', '<span class="av family-av">🏡</span>', '🏡 بيت العائلة')}</div>
        <h3 class="section">💌 محادثات ${esc(u.name)} الخاصة</h3>
        ${rows ? `<div class="card list">${rows}</div>` : `<div class="card empty"><p>لم يراسل ${esc(u.name)} أحداً على الخاص بعد.</p></div>`}
      </div>
    </div>`;
  }

  // ───── غرفة المحادثة ─────
  function showRoom() {
    const r = room;
    let icon, sub;
    if (r === 'family') {
      icon = '<span class="av family-av">🏡</span>';
      sub = active().map(u => esc(u.name)).join('، ');
    } else if (r === 'news') {
      icon = '<span class="av family-av">📰</span>'; sub = '';
    } else if (isGroup(r)) {
      const g = groupOf(r);
      icon = `<span class="av family-av">${esc(g ? g.icon : '💬')}</span>`;
      sub = active().map(u => esc(u.name)).join('، ');
    } else {
      const peers = dmPeers(r);
      const other = userOf(peers.find(p => p !== myKey())) || userOf(peers[0]);
      icon = `<span class="av-wrap">${Art.avatar(other ? other.avatar : '🙂')}${online(other) ? '<i class="online"></i>' : ''}</span>`;
      sub = !canWrite(r) ? '👀 أنت تطّلع على هذه المحادثة فقط'
        : !canSend(r) ? '🔒 أوقف ولي الأمر الرسائل الخاصة' : (other ? ago(other.seen || 0) : '');
    }
    app.innerHTML = `<div class="room">
      <header class="room-top">
        <button class="back" data-act="close" aria-label="رجوع"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M13 5l7 7-7 7"/></svg></button>
        ${icon}
        <span class="rt-main"><b>${esc(roomTitle(r))}</b><small id="roomSub">${sub}</small></span>
      </header>
      <div class="msgs" id="msgs"></div>
      ${canSend(r) ? `<div class="panel" id="panel" hidden></div>
      <div class="reply-bar" id="replyBar" hidden></div>
      <footer class="composer">
        <div class="field">
          <button class="ic" data-act="panel" aria-label="إيموجي وملصقات"><i class="e-smile">😊</i></button>
          <textarea id="txt" rows="1" maxlength="3000" placeholder="اكتب رسالة…"></textarea>
          <button class="ic cam" data-act="photoMenu" data-arg="chat" aria-label="صورة"><i class="e-cam">📷</i></button>
        </div>
        <button class="send mic" data-act="recStart" aria-label="تسجيل صوت"><i class="e-mic">🎤</i></button>
        <button class="send txt-send" data-act="sendText" aria-label="إرسال"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 4.5 3.6 11.2c-.8.3-.8 1.4 0 1.7L21 19.5c.6.2 1.1-.4.9-1L19.3 12l2.6-6.5c.2-.6-.3-1.2-.9-1z"/></svg></button>
      </footer>
      <footer class="composer recbar" id="recBar" hidden>
        <button class="ic" data-act="recCancel" aria-label="إلغاء">🗑️</button>
        <span class="rec-dot"></span><b class="rec-time" id="recTime">0:00</b>
        <span class="rec-hint">جارٍ التسجيل… تكلّم الآن 🎙️</span>
        <button class="send" data-act="recSend" aria-label="إرسال التسجيل"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 4.5 3.6 11.2c-.8.3-.8 1.4 0 1.7L21 19.5c.6.2 1.1-.4.9-1L19.3 12l2.6-6.5c.2-.6-.3-1.2-.9-1z"/></svg></button>
      </footer>` : ''}
    </div>`;
    keepBottom($('msgs'));
    refreshRoom(true);
    paintReply();
    if (canSend(r)) swipeToReply($('msgs'));
    const t = $('txt');
    if (t) {
      t.addEventListener('input', grow);
      t.addEventListener('keydown', e => {
        // Enter يرسل على لوحة المفاتيح العادية، و Shift+Enter سطر جديد
        if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); actions.sendText(); }
        if (e.key === 'Escape' && replyTo) actions.replyCancel();
      });
    }
  }
  function grow() { const t = $('txt'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; t.closest('.composer').classList.toggle('typing', !!t.value.trim()); }

  // يُبقي المحادثة عند آخر رسالة حتى بعد أن تكتمل الصور ويتغيّر حجم الشاشة،
  // ما لم يصعد المستخدم بنفسه ليقرأ رسائل قديمة
  const toBottom = () => { const b = $('msgs'); if (b) b.scrollTop = b.scrollHeight; };
  function keepBottom(box) {
    if (!box) return;
    stick = true;
    let touchAt = 0;
    const mark = () => { touchAt = Date.now(); };
    ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'].forEach(ev => box.addEventListener(ev, mark, { passive: true }));
    box.addEventListener('scroll', () => {
      if (Date.now() - touchAt < 1500) stick = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    }, { passive: true });
    box.addEventListener('load', () => { if (stick) toBottom(); }, true);
    if (window.ResizeObserver) new ResizeObserver(() => { if (stick) toBottom(); }).observe(box);
  }

  function refreshRoom(first) {
    const box = $('msgs');
    if (!box) return;
    const near = first || stick || box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    if (near) stick = true;
    const msgs = Cloud.msgsOf(room);
    const group = room === 'family' || isGroup(room) || !dmPeers(room).includes(myKey());
    let h = '', lastDay = '', lastFrom = '';
    if (!msgs.length) {
      h = Cloud.roomReady(room)
        ? `<div class="empty-room">${Art.char(look === 'arnooba' ? 'arnooba' : 'falfoula', 'happy', 'mid bob')}<p>قل مرحباً! 👋<br><small>أرسل رسالة أو ملصقاً لتبدأ المحادثة</small></p></div>`
        : '<div class="empty-room"><span class="spinner"></span></div>';
    }
    msgs.forEach(m => {
      const day = dayOf(m.at);
      if (day !== lastDay) { h += `<div class="day"><span>${day}</span></div>`; lastDay = day; lastFrom = ''; }
      const mine = isMe(m.from);
      const u = userOf(m.from);
      const head = !mine && group && keyOf(m.from) !== lastFrom;
      lastFrom = keyOf(m.from);
      const kind = m.sticker ? 'is-sticker' : m.audio ? 'is-audio' : m.img ? 'is-img' : (m.text && onlyEmoji(m.text) ? 'is-jumbo' : '');
      h += `<div class="msg ${mine ? 'mine' : 'theirs'} ${kind} ${head ? 'head' : ''}" data-id="${m.id}">
        ${!mine && group ? `<span class="m-av">${head ? Art.avatar(u ? u.avatar : '🙂', 'sm') : ''}</span>` : ''}
        <div class="bubble" data-act="msgMenu" data-arg="${m.id}">
          ${head ? `<b class="who" style="color:${colorOf(m.from)}">${esc(nameOf(m.from))}</b>` : ''}
          ${m.reply ? quote(m.reply) : ''}
          ${m.sticker ? Art.sticker(m.sticker) : ''}
          ${m.audio ? voiceBubble(m) : ''}
          ${m.img ? `<img src="${m.img}" alt="صورة" data-act="view" data-arg="${room}|${m.id}">` : ''}
          ${m.text ? `<div class="text">${rich(m.text)}</div>` : ''}
          <span class="meta">${m.edited ? 'معدّلة · ' : ''}${timeOf(m.at)}${mine ? (m.pending ? ' 🕓' : ' ✓') : ''}</span>
        </div>
        ${reactsRow(room, m, false)}
      </div>`;
    });
    box.innerHTML = h;
    paintVoice();
    if (near) { toBottom(); requestAnimationFrame(() => { if (stick) toBottom(); }); setTimeout(() => { if (stick) toBottom(); }, 300); }
    markRead(room);
    badge();
  }

  // ───── الرد على رسالة ─────
  // مقتطف قصير من الرسالة يُحفظ مع الرد عليها
  const snippet = m => m.sticker ? '✨ ملصق' : m.audio ? '🎤 رسالة صوتية'
    : m.img ? '📷 صورة' + (m.text ? ' · ' + m.text : '') : (m.text || '');
  const cut = (t, n) => [...t.replace(/\s+/g, ' ')].slice(0, n).join('');
  const replyWho = id => (isMe(id) ? 'أنت' : nameOf(id));
  // الاقتباس داخل الفقاعة: يظهر النص الحالي للرسالة الأصلية إن كانت معروضة، وإلا المقتطف المحفوظ
  function quote(q) {
    const orig = findMsg(room, q.id);
    return `<div class="quote" data-act="jumpTo" data-arg="${esc(q.id)}" style="--qc:${colorOf(q.from)}">
      <b>${esc(replyWho(q.from))}</b><small>${esc(orig ? cut(snippet(orig), 120) : q.text || '')}</small></div>`;
  }
  function paintReply() {
    const bar = $('replyBar');
    if (!bar) return;
    const m = replyTo && replyTo.room === room ? findMsg(room, replyTo.id) : null;
    bar.hidden = !m;
    bar.innerHTML = m ? `<span class="rq-main" style="--qc:${colorOf(m.from)}"><b>↩️ الرد على ${esc(isMe(m.from) ? 'رسالتك' : nameOf(m.from))}</b><small>${esc(cut(snippet(m), 120))}</small></span>
      <button class="ic" data-act="replyCancel" aria-label="إلغاء الرد">✖</button>` : '';
  }
  // يأخذ الرد المعلّق لهذه الغرفة ليُرسل مع الرسالة، ثم يخفي شريط الرد
  function takeReply(r) {
    if (!replyTo || replyTo.room !== r) return null;
    const m = findMsg(r, replyTo.id);
    replyTo = null;
    paintReply();
    return m ? { id: m.id, from: m.from, text: cut(snippet(m), 120) } : null;
  }
  // سحب الفقاعة يميناً أو يساراً على الجوال يرد عليها
  function swipeToReply(box) {
    let s = null;
    const reset = () => {
      if (!s) return;
      const { b } = s;
      s = null;
      b.style.transition = 'transform .15s';
      b.style.transform = '';
      setTimeout(() => { b.style.transition = ''; }, 160);
    };
    box.addEventListener('touchstart', e => {
      const b = e.target.closest('.bubble');
      if (!b || e.touches.length > 1) { s = null; return; }
      const t = e.touches[0];
      s = { b, x: t.clientX, y: t.clientY, dx: 0, lock: '' };
    }, { passive: true });
    box.addEventListener('touchmove', e => {
      if (!s) return;
      const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (!s.lock && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.lock = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'x' : 'y';
      if (s.lock !== 'x') return;
      s.dx = dx;
      s.b.style.transform = `translateX(${Math.max(-70, Math.min(70, dx))}px)`;
    }, { passive: true });
    box.addEventListener('touchend', () => {
      if (!s) return;
      const go = s.lock === 'x' && Math.abs(s.dx) > 55;
      const msg = s.b.closest('.msg');
      reset();
      if (go && msg) { actions.reply(msg.dataset.id); if (navigator.vibrate) navigator.vibrate(20); }
    });
    box.addEventListener('touchcancel', reset);
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
    if (!panel) return;
    const tab = (t, label) => `<button class="${panel === t ? 'on' : ''}" data-act="panelTab" data-arg="${t}">${label}</button>`;
    const tabs = `<div class="panel-tabs">${tab('emoji', '😊 إيموجي')}${tab('sticker', `${Art.char(look === 'arnooba' ? 'arnooba' : 'falfoula', 'cheer', 'mini')} ملصقات`)}</div>`;
    if (panel === 'emoji') {
      p.innerHTML = tabs + Object.entries(EMOJI).map(([k, v]) =>
        `<p class="panel-h">${k}</p><div class="emoji-grid">${v.split(' ').map(e => `<button data-act="emoji" data-arg="${e}">${e}</button>`).join('')}</div>`).join('');
    } else if (panel === 'sticker') {
      p.innerHTML = tabs + Art.STICKER_GROUPS(look).map(g => `<p class="panel-h">ملصقات ${g.title}</p><div class="sticker-grid">${g.list.map(s =>
        `<button data-act="sticker" data-arg="${s}">${Art.sticker(s)}</button>`).join('')}</div>`).join('');
    }
    stick = true;
    toBottom();
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
    const edit = m.from === uid() && m.text && !m.img && !m.audio && !m.sticker && !m.pending && room !== 'news';
    modal(`<div class="sheet small">
      <p class="muted small">${esc(nameOf(m.from))} · ${dayOf(m.at)} ${timeOf(m.at)}</p>
      <div class="react-pick">${PICK.map(e =>
        `<button class="${mine === e ? 'on' : ''}" data-act="react" data-arg="${room}|${id}|${e}">${e}</button>`).join('')}${mine && !PICK.includes(mine)
        ? `<button class="on" data-act="react" data-arg="${room}|${id}|${mine}">${mine}</button>` : ''}<button class="more" data-act="reactMore" data-arg="${id}" aria-label="إيموجي آخر">＋</button></div>
      ${canSend(room) && room !== 'news' ? `<button class="btn plain wide" data-act="reply" data-arg="${id}">↩️ رد</button>` : ''}
      ${edit ? `<button class="btn plain wide" data-act="editMsg" data-arg="${id}">✏️ تعديل الرسالة</button>` : ''}
      ${m.text ? `<button class="btn plain wide" data-act="copy" data-arg="${id}">📋 نسخ النص</button>` : ''}
      ${del ? `<button class="btn plain wide danger-t" data-act="delMsg" data-arg="${room}|${id}">🗑️ حذف الرسالة</button>` : ''}
      <button class="btn plain wide" data-act="closeModal">إغلاق</button>
    </div>`);
  }

  const PICK = ['❤️', '😂', '👍', '😮', '😢', '🎉', '🙏', '🌟'];

  // كل الإيموجي للتفاعل مع رسالة
  function reactMore(id) {
    const m = findMsg(room, id);
    if (!m) return;
    const mine = (m.reacts || {})[uid()];
    modal(`<div class="sheet">
      <h3>اختر تفاعلاً</h3>
      ${Object.entries(EMOJI).map(([k, v]) =>
        `<p class="panel-h">${k}</p><div class="emoji-grid">${v.split(' ').map(e =>
          `<button class="${mine === e ? 'on' : ''}" data-act="react" data-arg="${room}|${id}|${e}">${e}</button>`).join('')}</div>`).join('')}
      <button class="btn plain wide" data-act="msgMenu" data-arg="${id}">رجوع</button>
    </div>`);
  }

  function editMsg(id) {
    const m = findMsg(room, id);
    if (!m || !m.text) return;
    modal(`<div class="sheet small">
      <h3>✏️ تعديل الرسالة</h3>
      <textarea id="editTxt" class="text-in" rows="4" maxlength="3000">${esc(m.text)}</textarea>
      <div class="row"><button class="btn green" data-act="saveEdit" data-arg="${room}|${id}">حفظ ✅</button><button class="btn plain" data-act="closeModal">إلغاء</button></div>
    </div>`);
    const t = $('editTxt');
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
  }

  // ───── الرسائل الصوتية: تسجيل حتى دقيقة ويُحفظ داخل الرسالة ─────
  const REC_MAX = 60;
  let rec = null;      // { mr, stream, chunks, start, timer, cancel }
  let player = null;   // { id, audio }
  const PLAY_IC = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M8.5 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8c.6-.4.6-1.2 0-1.6l-10-6.8c-.7-.5-1.6 0-1.6.8z"/></svg>';
  const PAUSE_IC = '<svg viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4.5" height="14" rx="1.5"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/></svg>';
  const fmt = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  // mp4 أولاً لأنه يعمل على آيفون وأندرويد معاً
  const recType = () => ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    .find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';

  function voiceBubble(m) {
    const on = player && player.id === m.id;
    return `<button class="voice ${on && !player.audio.paused ? 'playing' : ''}" data-act="playVoice" data-arg="${room}|${m.id}" data-aud="${m.id}">
      <span class="v-btn">${on && !player.audio.paused ? PAUSE_IC : PLAY_IC}</span>
      <span class="v-wave">${'<i></i>'.repeat(18)}</span>
      <span class="v-dur">${fmt(m.dur || 0)}</span>
    </button>`;
  }
  function paintVoice() {
    document.querySelectorAll('[data-aud]').forEach(el => {
      const on = player && player.id === el.dataset.aud;
      const playing = on && !player.audio.paused;
      el.classList.toggle('playing', playing);
      el.querySelector('.v-btn').innerHTML = playing ? PAUSE_IC : PLAY_IC;
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
      Cloud.send(r.room, { audio: fr.result, dur: Math.min(REC_MAX, Math.round(dur)) || 1, reply: takeReply(r.room) }).done
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
    const incoming = fresh.filter(m => !isMe(m.from) && !m.pending && Date.now() - m.at < 120000);
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
    replyTo = null;
    Cloud.watch(r, 300);
    history.pushState({ room: r }, '');
    render();
  }
  function closeRoom() {
    recStop(true);
    if (player) { player.audio.pause(); player = null; }
    room = null;
    panel = null;
    replyTo = null;
    render();
  }

  // يُظهر رمز QR لإضافة فرد أو لإعادة ربط فرد مفصول
  function startPair(hint, name, relink) {
    const { code, exp, ready } = Cloud.createCode(hint);
    pairing = { code, exp, ready: false, name, relink, known: new Set(Object.keys(users())) };
    render();
    const mine = () => pairing && pairing.code === code;
    ready.then(() => { if (mine()) { pairing.ready = true; refresh(); } })
      .catch(() => { if (mine()) { pairing = null; refresh(); toast('⚠️ تعذّر إنشاء الرمز. تأكد من الإنترنت.'); } });
    setTimeout(() => { if (mine()) { pairing = null; refresh(); } }, exp - Date.now() + 500);
  }

  const actions = {
    installApp() {
      if (!installPrompt) {
        // متصفح لا يدعم نافذة التثبيت (مثل Safari): نشرح الطريقة يدوياً
        const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
        toast(ios ? 'من زر المشاركة ⬆️ اختر «إضافة إلى الشاشة الرئيسية»' : 'من قائمة المتصفح ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»', 5000);
        return;
      }
      const e = installPrompt;
      installPrompt = null;
      e.prompt();
    },
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
      const role = Cloud.owner() ? 'parent' : mine ? mine.role : (showSetup.role || 'kid');
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
    peek(id) { peek = id; history.pushState({ peek: id }, ''); render(); window.scrollTo(0, 0); },
    toggleDm() {
      const off = !Cloud.dmOff();
      if (off && !confirm('إيقاف الرسائل الخاصة بين أفراد العائلة؟ يبقى «بيت العائلة» والأخبار، ويستطيعون مراسلتك أنت على الخاص.')) return;
      Cloud.setDmOff(off).then(() => toast(off ? '🔒 أُوقفت الرسائل الخاصة' : '💌 عادت الرسائل الخاصة')).catch(() => toast('⚠️ تعذّر الحفظ، تأكد من الإنترنت'));
    },

    setLook(l) { look = l; ls.set('family-chat-look', l); const me = Cloud.me(); Cloud.saveProfile({ ...me, look: l }).catch(() => {}); render(); },

    panel() {
      panel = panel ? null : panelTab;
      showPanel();
      Sound.tap();
    },
    panelTab(t) {
      panel = panelTab = t;
      showPanel();
      $('panel').scrollTop = 0;
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
      Cloud.send(room, { sticker: s, reply: takeReply(room) });
      Sound.send();
      panel = null;
      showPanel();
    },
    sendText() {
      const t = $('txt');
      const text = t.value.trim();
      if (!text) return;
      Cloud.send(room, { text, reply: takeReply(room) });
      t.value = '';
      grow();
      Sound.send();
      if (panel) { panel = null; showPanel(); }
      stick = true;
      toBottom();
    },
    sendImg() {
      if (!pendingImg) return;
      const cap = ($('imgCap').value || '').trim();
      const { done } = Cloud.send(pendingImg.room, { img: pendingImg.data, text: cap, reply: takeReply(pendingImg.room) });
      done.catch(() => toast('⚠️ تعذّر إرسال الصورة'));
      pendingImg = null;
      closeModal();
      Sound.send();
    },
    msgMenu(id) { msgMenu(id); },
    reply(id) {
      if (!findMsg(room, id) || !canSend(room)) return;
      replyTo = { room, id };
      closeModal();
      paintReply();
      const t = $('txt');
      if (t && !('ontouchstart' in window)) t.focus();
    },
    replyCancel() { replyTo = null; paintReply(); },
    // الضغط على الاقتباس ينقل إلى الرسالة الأصلية
    jumpTo(id) {
      const el = document.querySelector(`#msgs .msg[data-id="${CSS.escape(id)}"]`);
      if (!el) { toast('الرسالة الأصلية قديمة أو حُذفت'); return; }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1400);
    },
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
    reactMore(id) { reactMore(id); Sound.tap(); },
    editMsg(id) { editMsg(id); },
    saveEdit(arg) {
      const [r, id] = arg.split('|');
      const m = findMsg(r, id);
      const text = ($('editTxt').value || '').trim();
      if (!m || !text) return;
      if (text !== m.text) Cloud.edit(r, id, text).catch(() => toast('⚠️ تعذّر التعديل'));
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
      $('pairName').blur();
      startPair(`${role}|${name}`, name);
    },
    // رمز يعيد فرداً مفصولاً بنفس هويته
    relink(id) {
      const u = users()[id];
      if (!u) return;
      startPair(`R|${id}`, u.name, true);
      const box = document.querySelector('.pair-box');
      if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    forget(id) {
      const u = users()[id];
      if (!u || !confirm(`حذف ${u.name} نهائياً؟ لن تستطيع إعادة ربطه بنفس الهوية، وتظهر رسائله باسم «فرد سابق».`)) return;
      Cloud.forget(id).catch(() => toast('⚠️ تعذّر الحذف'));
    },
    cancelPair() { pairing = null; render(); },

    groupIcon(e) {
      groupIconPick = e;
      document.querySelectorAll('#groupIcon .chip').forEach(b => b.classList.toggle('on', b.dataset.arg === e));
    },
    addGroup() {
      const name = $('groupName').value.trim();
      if (!name) { toast('✏️ اكتب اسم المجموعة أولاً'); $('groupName').focus(); return; }
      $('groupName').value = '';
      $('groupName').blur();
      Cloud.addGroup(name, groupIconPick).catch(() => toast('⚠️ تعذّر إنشاء المجموعة، تأكد من الإنترنت'));
      Sound.pop();
      toast(`🎉 أُنشئت مجموعة ${groupIconPick} ${name}`);
    },
    renameGroup(id) {
      const g = groupOf(id);
      if (!g) return;
      const name = (prompt('الاسم الجديد للمجموعة:', g.name) || '').trim();
      if (!name || name === g.name) return;
      Cloud.renameGroup(id, name).catch(() => toast('⚠️ تعذّرت إعادة التسمية'));
    },
    removeGroup(id) {
      const g = groupOf(id);
      if (!g || !confirm(`حذف مجموعة «${g.name}»؟ ستُحذف رسائلها كلها ولا يمكن استرجاعها.`)) return;
      Cloud.removeGroup(id).then(() => toast('🗑️ حُذفت المجموعة')).catch(() => toast('⚠️ تعذّر حذف المجموعة'));
    },
    grantGuardian(id) {
      const u = userOf(id);
      if (!u || !confirm(`منح ${u.name} صلاحيات ولي الأمر؟ سيرى المحادثات الخاصة ويدير العائلة مثلك، في المجلس والألعاب.`)) return;
      Cloud.grant(id, u.name).then(() => toast(`👑 صار ${u.name} ولي أمر`)).catch(() => toast('⚠️ تعذّر منح الصلاحيات'));
    },
    revokeGuardian(id) {
      if (!confirm(`سحب صلاحيات ولي الأمر من ${nameOf(id)}؟ يبقى فرداً في العائلة.`)) return;
      Cloud.revoke(id).then(() => toast('تم سحب الصلاحيات')).catch(() => toast('⚠️ تعذّر سحب الصلاحيات'));
    },
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
      const msg = Cloud.owner() ? 'تسجيل الخروج من هذا الجهاز؟' : 'فصل هذا الجهاز عن مجلس العائلة؟ ستحتاج رمزاً جديداً من ولي الأمر للعودة.';
      if (!confirm(msg)) return;
      room = null;
      peek = null;
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
    else if (peek) { peek = null; render(); }
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
      if (!Cloud.role()) { room = null; pairing = null; peek = null; }
      render();
      return;
    }
    if (what === 'users') {
      // انضم فرد جديد بعد إنشاء الرمز: نخفي الرمز ونرحّب به
      if (pairing) {
        const fresh = active().find(u => u.id !== uid() && !pairing.known.has(u.id));
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
    if (what === 'config') {
      // نتابع غرف المجموعات الجديدة بعد انتهاء هذا التحديث: فتح متابعة جديدة داخله يُضيع على Firestore الكتابة المعلّقة
      if (Cloud.me()) setTimeout(watchAll, 0);
      // حذف ولي الأمر المجموعة المفتوحة: نغلقها
      if (room && isGroup(room) && !groupOf(room)) { toast('🗑️ حُذفت هذه المجموعة'); history.back(); return; }
      // تغيّر إذن الرسائل الخاصة: نعيد رسم الغرفة فقط إن تغيّر ظهور خانة الكتابة
      if (room && $('msgs')) { if (!!$('txt') !== canSend(room)) render(); else { const t = document.querySelector('.room-top .rt-main b'); if (t) t.textContent = roomTitle(room); } }
      else refresh();
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
