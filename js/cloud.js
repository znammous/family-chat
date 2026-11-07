// الاتصال بمشروع Firebase المشترك مع أبطال الغابة وأبطال الإملاء (tablehero-d582b).
// العائلة معرّفها حساب Google لولي الأمر، وأجهزة الأبناء تنضم برمز QR بحساب مجهول
// وتُسجَّل في families/{fid}/members/{uid} — نفس السجلّ الذي تستخدمه الألعاب.
// الشات: families/{fid}/chatUsers/{uid} ملف كل فرد، و families/{fid}/chatRooms/{غرفة}/messages رسائلها.
const Cloud = (() => {
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const FIREBASE = {
    apiKey: 'AIzaSyBny9DhGm7ySaAa9lBxw3tbHaZ7OdCAPNU',
    authDomain: 'tablehero-d582b.firebaseapp.com',
    projectId: 'tablehero-d582b',
    storageBucket: 'tablehero-d582b.firebasestorage.app',
    messagingSenderId: '1035331862918',
    appId: '1:1035331862918:web:d73e41610d2d2185a96c07',
  };
  const APP = 'familyChat';
  // الألعاب على نفس النطاق تحفظ عائلة الجهاز هنا، فإن كان الجهاز مرتبطاً بها ندخل مباشرة
  const OTHER_APPS = { jungleHero: 'jungle-hero-family', spellingHero: 'spelling-hero-family' };
  const FID_KEY = 'family-chat-family';
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} },
  };

  // 'loading' | 'unavailable' | 'out' | 'linking' | 'ok' | 'offline'
  let status = 'loading';
  let fb = null, user = null, fid = null, joining = false;
  let memberUnsub = null, usersUnsub = null, cfgUnsub = null, memberData = null;
  let config = {};   // إعدادات ولي الأمر: { dmOff, groups }
  // ولي أمر آخر: جهاز انضم برمز «ولي أمر» (A|الاسم) فسُجّل في families/{fid}/guardians/{معرّفه}،
  // وله ما لولي الأمر صاحب الحساب (قواعد Firestore المشتركة مع الألعاب)
  let guardian = false, guardianUnsub = null, guardiansUnsub = null, guardians = {};
  let users = {}, usersReady = false;
  const rooms = {};   // غرفة ← { unsub, limit, msgs, ready }
  const listeners = [];
  const notify = what => listeners.forEach(fn => fn(what));
  const set = s => { status = s; notify('status'); };

  async function start() {
    if (!location.protocol.startsWith('http')) { set('unavailable'); return; }
    try {
      const [app, auth, fs] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js'),
        import(SDK + 'firebase-firestore.js'),
      ]);
      const a = app.initializeApp(FIREBASE);
      fb = { auth, fs, authI: auth.getAuth(a), db: fs.initializeFirestore(a, { localCache: fs.persistentLocalCache() }) };
      // للتجربة فقط: localhost/?emulator يستخدم محاكيات Firebase بدل المشروع الحقيقي
      if (location.hostname === 'localhost' && /[?&]emulator\b/.test(location.search)) {
        auth.connectAuthEmulator(fb.authI, 'http://localhost:9099', { disableWarnings: true });
        fs.connectFirestoreEmulator(fb.db, 'localhost', 8085);
        window.__fb = fb;   // لاختبارات المحاكي فقط
      }
    } catch (e) {
      set('unavailable');
      window.addEventListener('online', start, { once: true });
      return;
    }
    fb.auth.onAuthStateChanged(fb.authI, onUser);
  }

  const famDoc = (...p) => fb.fs.doc(fb.db, 'families', fid, ...p);
  const famCol = (...p) => fb.fs.collection(fb.db, 'families', fid, ...p);

  function stopAll() {
    if (memberUnsub) { memberUnsub(); memberUnsub = null; }
    if (usersUnsub) { usersUnsub(); usersUnsub = null; }
    if (cfgUnsub) { cfgUnsub(); cfgUnsub = null; }
    if (guardianUnsub) { guardianUnsub(); guardianUnsub = null; }
    if (guardiansUnsub) { guardiansUnsub(); guardiansUnsub = null; }
    config = {}; guardian = false; guardians = {};
    Object.keys(rooms).forEach(r => { if (rooms[r].unsub) rooms[r].unsub(); delete rooms[r]; });
    users = {}; usersReady = false; memberData = null;
  }

  async function onUser(u) {
    if (joining && u && u.isAnonymous && !ls.get(FID_KEY)) { user = u; return; }
    stopAll();
    user = u;
    fid = !u ? null : u.isAnonymous ? ls.get(FID_KEY) : u.uid;
    // جهاز مرتبط بالألعاب من قبل: نجرّب عائلته دون رمز جديد
    if (u && u.isAnonymous && !fid && ls.get('family-chat-nolink') !== '1') {
      set('linking');
      fid = await linkFromGames(u);
    }
    if (!fid) { set('out'); return; }
    if (u.isAnonymous) {
      memberUnsub = fb.fs.onSnapshot(famDoc('members', u.uid), snap => {
        memberData = snap.exists() ? snap.data() : null;
        if (!snap.metadata.fromCache && !memberData) leave();
      }, () => {});
      guardianUnsub = fb.fs.onSnapshot(famDoc('guardians', u.uid), snap => {
        const g = snap.exists();
        if (snap.metadata.fromCache && !g) return;
        if (g === guardian) return;
        guardian = g;
        watchGuardians(g);
        notify('users');
      }, () => {});
    } else watchGuardians(true);
    usersUnsub = fb.fs.onSnapshot(famCol('chatUsers'), { includeMetadataChanges: true }, snap => {
      users = {};
      snap.docs.forEach(d => { users[d.id] = { id: d.id, ...d.data() }; });
      if (!snap.metadata.fromCache || users[u.uid]) usersReady = true;
      status = snap.metadata.fromCache ? 'offline' : 'ok';
      notify('users');
    }, () => set('offline'));
    cfgUnsub = fb.fs.onSnapshot(famDoc('chatConfig', 'settings'), snap => {
      config = snap.exists() ? snap.data() : {};
      notify('config');
    }, () => {});
    set('ok');
  }

  // قائمة أولياء الأمور الآخرين: يقرؤها ولي الأمر ومن له صلاحياته فقط
  function watchGuardians(on) {
    if (!on) { if (guardiansUnsub) { guardiansUnsub(); guardiansUnsub = null; } guardians = {}; return; }
    if (guardiansUnsub) return;
    guardiansUnsub = fb.fs.onSnapshot(famCol('guardians'), snap => {
      guardians = {};
      snap.docs.forEach(d => { guardians[d.id] = d.data().name || ''; });
      notify('users');
    }, () => {});
  }

  async function linkFromGames(u) {
    for (const key of Object.values(OTHER_APPS)) {
      const f = ls.get(key);
      if (!f) continue;
      const snap = await fb.fs.getDocFromServer(fb.fs.doc(fb.db, 'families', f, 'members', u.uid)).catch(() => null);
      if (snap && snap.exists()) { ls.set(FID_KEY, f); return f; }
    }
    return null;
  }

  function signIn() {
    const provider = new fb.auth.GoogleAuthProvider();
    return fb.auth.signInWithPopup(fb.authI, provider).catch(e => {
      if (e.code === 'auth/popup-blocked') return fb.auth.signInWithRedirect(fb.authI, provider);
      throw e;
    });
  }

  const otherApps = d => !!(d && d.apps && Object.keys(d.apps).some(a => a !== APP));

  // الجهاز يخرج من المجلس: يبقى مرتبطاً بالألعاب إن كان مرتبطاً بها
  async function signOut() {
    if (user && user.isAnonymous && fid) {
      // يبقى ملفه في المجلس معلَّماً بالفصل، ليعيد ولي الأمر ربطه لاحقاً بنفس الهوية
      if (users[user.uid]) await fb.fs.updateDoc(famDoc('chatUsers', user.uid), { left: Date.now() }).catch(() => {});
      // ولي الأمر الآخر يبقى ولي أمر في الألعاب إن بقي جهازه مرتبطاً بها
      if (guardian && !otherApps(memberData)) await fb.fs.deleteDoc(famDoc('guardians', user.uid)).catch(() => {});
      const ref = famDoc('members', user.uid);
      await (otherApps(memberData)
        ? fb.fs.updateDoc(ref, { ['apps.' + APP]: fb.fs.deleteField() })
        : fb.fs.deleteDoc(ref)).catch(() => {});
    }
    return leave();
  }

  function leave() {
    const keep = user && user.isAnonymous && otherApps(memberData);
    ls.set(FID_KEY, null);
    // نمنع الدخول التلقائي من الألعاب مرة أخرى بعد خروج مقصود
    if (user && user.isAnonymous) ls.set('family-chat-nolink', '1');
    if (keep) { stopAll(); fid = null; set('out'); return Promise.resolve(); }
    return fb.auth.signOut(fb.authI);
  }

  // رمز من 8 أحرف بلا الأحرف المتشابهة، صالح لعشر دقائق (نفس رموز الألعاب)
  const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const CODE_MS = 10 * 60 * 1000;
  function createCode(hint) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const code = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
    const exp = Date.now() + CODE_MS;
    const ready = Promise.race([
      fb.fs.setDoc(fb.fs.doc(fb.db, 'pairCodes', code), { fid, kid: String(hint || '').slice(0, 40), exp: fb.fs.Timestamp.fromMillis(exp) }),
      new Promise((_, fail) => setTimeout(() => fail(new Error('timeout')), 15000)),
    ]);
    return { code, exp, ready };
  }

  // ينضم هذا الجهاز إلى العائلة، ويعيد ما كتبه ولي الأمر عن صاحبه (الاسم والدور)
  async function join(raw, name) {
    const code = String(raw).toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (code.length !== 8) throw new Error('bad-code');
    if (!fb) throw new Error('unavailable');
    if (user && !user.isAnonymous) throw new Error('signed-in');
    joining = true;
    try {
      const cred = user || (await fb.auth.signInAnonymously(fb.authI)).user;
      const snap = await fb.fs.getDocFromServer(fb.fs.doc(fb.db, 'pairCodes', code)).catch(e => {
        throw new Error(e.code === 'permission-denied' ? 'expired' : 'network');
      });
      if (!snap.exists() || snap.data().exp.toMillis() < Date.now()) throw new Error('expired');
      const c = snap.data();
      const mref = fb.fs.doc(fb.db, 'families', c.fid, 'members', cred.uid);
      const member = await fb.fs.getDocFromServer(mref).catch(() => null);
      const old = member && member.exists() ? member.data() : null;
      const entry = { code, name: String(name || '').slice(0, 40), at: Date.now() };
      if (!old) await fb.fs.setDoc(mref, { ...entry, kid: '', apps: { [APP]: '' } });
      else {
        const apps = { ...(old.apps || {}) };
        // سجلّ قديم بلا apps: طفله يعود للعبة المرتبطة بنفس العائلة على هذا الجهاز
        if (!old.apps) {
          for (const [a, key] of Object.entries(OTHER_APPS)) if (ls.get(key) === c.fid) apps[a] = old.kid || '';
        }
        apps[APP] = '';
        await fb.fs.setDoc(mref, { ...entry, kid: old.kid || '', apps });
      }
      await relink(c, cred.uid);
      // رمز «ولي أمر»: يُسجَّل الجهاز وليَّ أمر له صلاحيات صاحب الحساب، ويُلغى الرمز فلا يُستعمل مرة ثانية
      if (/^A\|/.test(c.kid || '')) {
        await fb.fs.setDoc(fb.fs.doc(fb.db, 'families', c.fid, 'guardians', cred.uid),
          { code, name: (c.kid.slice(2) || String(name || '')).slice(0, 40), at: Date.now() });
        fb.fs.deleteDoc(fb.fs.doc(fb.db, 'pairCodes', code)).catch(() => {});
      }
      ls.set(FID_KEY, c.fid);
      ls.set('family-chat-nolink', null);
      joining = false;
      onUser(cred);
      return /^R\|/.test(c.kid || '') ? '' : c.kid || '';
    } finally { joining = false; }
  }

  // عودة فرد مفصول: رمز «R|معرّف ملفه» يجعل هذا الحساب وريثاً لملفه (ولملفاته الأقدم)،
  // فيرجع باسمه وصورته وتظهر رسائله القديمة باسمه وتعود محادثاته الخاصة
  async function relink(c, uid) {
    const docOf = id => fb.fs.doc(fb.db, 'families', c.fid, 'chatUsers', id);
    const mine = await fb.fs.getDocFromServer(docOf(uid)).catch(() => null);
    const old = (c.kid || '').startsWith('R|') ? c.kid.slice(2) : '';
    // نفس الحساب رجع (جهاز بقي مرتبطاً بالألعاب): يكفي أن نزيل علامة الفصل
    if (!old || old === uid) {
      if (mine && mine.exists() && 'left' in mine.data()) await fb.fs.updateDoc(docOf(uid), { left: fb.fs.deleteField() });
      return;
    }
    const snap = await fb.fs.getDocFromServer(docOf(old));
    if (!snap.exists()) return;
    const o = snap.data();
    const older = await fb.fs.getDocsFromServer(fb.fs.query(fb.fs.collection(fb.db, 'families', c.fid, 'chatUsers'), fb.fs.where('heir', '==', old)));
    await Promise.all([docOf(old), ...older.docs.map(d => d.ref)].map(ref => fb.fs.updateDoc(ref, { heir: uid })));
    await fb.fs.setDoc(docOf(uid), { name: o.name, avatar: o.avatar, role: o.role, look: o.look || 'falfoula',
      seen: Date.now(), at: o.at || Date.now(), root: o.root || old });
  }

  // ───── الملفات ─────
  function saveProfile(p) {
    const data = { name: p.name.slice(0, 30), avatar: p.avatar, role: p.role, look: p.look, seen: Date.now(), at: (me() && me().at) || Date.now() };
    if (me() && me().root) data.root = me().root;
    return fb.fs.setDoc(famDoc('chatUsers', user.uid), data);
  }
  let lastBeat = 0;
  function beat() {
    if (!fid || !users[user.uid] || Date.now() - lastBeat < 45000) return;
    lastBeat = Date.now();
    fb.fs.updateDoc(famDoc('chatUsers', user.uid), { seen: Date.now() }).catch(() => {});
  }

  // ولي الأمر يفصل جهازاً عن العائلة كلها (المجلس والألعاب)، ويبقى ملفه معلَّماً بالفصل لإعادة ربطه لاحقاً
  async function removeMember(id) {
    // فصل ولي أمر آخر يلغي صلاحياته في المجلس والألعاب
    await fb.fs.deleteDoc(famDoc('guardians', id)).catch(() => {});
    await fb.fs.deleteDoc(famDoc('members', id)).catch(() => {});
    await fb.fs.updateDoc(famDoc('chatUsers', id), { left: Date.now() });
  }
  // ولي الأمر يحذف ملف فرد مفصول وملفاته الأقدم نهائياً (تبقى رسائله باسم «فرد سابق»)
  async function forget(id) {
    const older = Object.values(users).filter(u => u.heir === id).map(u => u.id);
    await Promise.all([id, ...older].map(x => fb.fs.deleteDoc(famDoc('chatUsers', x))));
  }

  // ولي الأمر يمنح فرداً صلاحياته (مثل «ماما» التي انضمت قبل هذه الميزة) أو يسحبها منه
  const grant = (id, name) => fb.fs.setDoc(famDoc('guardians', id), { name: String(name || '').slice(0, 40), at: Date.now() });
  const revoke = id => fb.fs.deleteDoc(famDoc('guardians', id));

  // ولي الأمر يوقف الرسائل الخاصة أو يعيدها
  const setDmOff = off => fb.fs.setDoc(famDoc('chatConfig', 'settings'), { dmOff: !!off }, { merge: true });

  // ───── المجموعات ─────
  // مجموعات للعائلة كلها ينشئها ولي الأمر (مثل «أغراض البيت»)، تُحفظ في chatConfig/settings.groups
  // ومعرّف غرفتها g_{معرّف}، والقواعد لا تسمح بقراءتها إلا ما دامت موجودة هنا
  const groups = () => Object.entries(config.groups || {})
    .map(([id, g]) => ({ id, name: g.name || '', icon: g.icon || '💬', at: g.at || 0 }))
    .sort((a, b) => a.at - b.at);
  function addGroup(name, icon) {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    const id = 'g_' + Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
    const g = { name: String(name).slice(0, 40), icon: String(icon || '💬').slice(0, 16), at: Date.now() };
    return fb.fs.setDoc(famDoc('chatConfig', 'settings'), { groups: { [id]: g } }, { merge: true }).then(() => id);
  }
  const renameGroup = (id, name) => fb.fs.updateDoc(famDoc('chatConfig', 'settings'), { [`groups.${id}.name`]: String(name).slice(0, 40) });
  // حذف المجموعة: نزيلها من الإعدادات ثم نحذف رسائلها
  async function removeGroup(id) {
    await fb.fs.updateDoc(famDoc('chatConfig', 'settings'), { ['groups.' + id]: fb.fs.deleteField() });
    if (rooms[id]) { if (rooms[id].unsub) rooms[id].unsub(); delete rooms[id]; }
    const snap = await fb.fs.getDocs(famCol('chatRooms', id, 'messages'));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = fb.fs.writeBatch(fb.db);
      snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
      await b.commit();
    }
  }

  // ───── الغرف والرسائل ─────
  // كل غرفة تُتابَع بآخر limit رسالة؛ الغرفة المفتوحة تُتابَع بعدد أكبر
  function watch(room, limit = 40) {
    const r = rooms[room];
    if (r && r.limit >= limit) return;
    if (r && r.unsub) r.unsub();
    const box = rooms[room] = { limit, msgs: r ? r.msgs : [], ready: r ? r.ready : false, unsub: null };
    const q = fb.fs.query(famCol('chatRooms', room, 'messages'), fb.fs.orderBy('at', 'desc'), fb.fs.limit(limit));
    box.unsub = fb.fs.onSnapshot(q, { includeMetadataChanges: true }, snap => {
      const before = new Set(box.msgs.map(m => m.id));
      box.msgs = snap.docs.map(d => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites })).reverse();
      const fresh = box.ready ? box.msgs.filter(m => !before.has(m.id)) : [];
      if (!snap.metadata.fromCache) box.ready = true;
      notify({ room, fresh });
    }, () => { box.ready = true; notify({ room, fresh: [] }); });
  }

  const msgsOf = room => (rooms[room] ? rooms[room].msgs : []);

  function send(room, msg) {
    const data = { from: user.uid, at: Date.now() };
    ['text', 'img', 'sticker', 'title', 'audio', 'dur', 'reply'].forEach(k => { if (msg[k]) data[k] = msg[k]; });
    // نعيد المعرّف فوراً؛ Firestore يرفع الرسالة عند عودة الاتصال إن كان الجهاز بلا إنترنت
    const ref = fb.fs.doc(famCol('chatRooms', room, 'messages'));
    const done = fb.fs.setDoc(ref, data);
    return { id: ref.id, done };
  }

  function react(room, id, emoji) {
    const ref = famDoc('chatRooms', room, 'messages', id);
    return fb.fs.updateDoc(ref, { ['reacts.' + user.uid]: emoji || fb.fs.deleteField() });
  }

  // صاحب الرسالة يعدّل نصها
  const edit = (room, id, text) => fb.fs.updateDoc(famDoc('chatRooms', room, 'messages', id), { text, edited: Date.now() });

  const remove = (room, id) => fb.fs.deleteDoc(famDoc('chatRooms', room, 'messages', id));

  const me = () => (user ? users[user.uid] : null);

  return {
    start, signIn, signOut, join, createCode, saveProfile, beat, removeMember, forget, setDmOff, grant, revoke,
    groups, addGroup, renameGroup, removeGroup,
    watch, msgsOf, send, react, edit, remove,
    on: fn => listeners.push(fn),
    status: () => status,
    uid: () => (user ? user.uid : ''),
    fid: () => fid,
    email: () => (user && user.email) || '',
    // 'parent' حساب Google أو ولي أمر آخر | 'device' جهاز انضم برمز | '' غير مسجّل
    role: () => (!fid || !user ? '' : user.isAnonymous && !guardian ? 'device' : 'parent'),
    // صاحب حساب Google نفسه (لا ولي الأمر الآخر)
    owner: () => !!(fid && user && !user.isAnonymous),
    guardian: () => !!fid && guardian,
    isGuardian: id => id in guardians || (id === (user && user.uid) && guardian),
    me, users: () => users,
    dmOff: () => !!config.dmOff, usersReady: () => usersReady,
    roomReady: room => !!(rooms[room] && rooms[room].ready),
    linkedVia: () => (memberData && memberData.apps ? Object.keys(memberData.apps) : []),
    noAutoLink: () => ls.get('family-chat-nolink') === '1',
  };
})();
