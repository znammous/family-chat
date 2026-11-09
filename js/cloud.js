// الاتصال بمشروع Firebase المشترك مع أبطال الغابة وأبطال الإملاء (tablehero-d582b).
// العائلة معرّفها حساب Google لولي الأمر، وأجهزة الأبناء تنضم برمز QR بحساب مجهول
// وتُسجَّل في families/{fid}/members/{uid} — نفس السجلّ الذي تستخدمه الألعاب.
// الشات: families/{fid}/chatUsers/{uid} ملف كل فرد، و families/{fid}/chatRooms/{غرفة}/messages رسائلها.
const Cloud = (() => {
  // نسخة 10.14.1 محفوظة مع التطبيق: تعمل داخل أندرويد دون إنترنت (لا يوجد هناك عامل خدمة)
  const SDK = new URL('js/vendor/firebase/', document.baseURI).href;
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
  let comments = [], commentsUnsub = null;
  let fb = null, user = null, fid = null, joining = false;
  let memberUnsub = null, usersUnsub = null, cfgUnsub = null, memberData = null;
  let config = {};   // إعدادات ولي الأمر: { dmOff, groups }
  // ولي أمر آخر: جهاز انضم برمز «ولي أمر» (A|الاسم) فسُجّل في families/{fid}/guardians/{معرّفه}،
  // وله ما لولي الأمر صاحب الحساب (قواعد Firestore المشتركة مع الألعاب)
  let guardian = false, guardianUnsub = null, guardiansUnsub = null, guardians = {};
  let users = {}, usersReady = false, usersSig = '';
  const rooms = {};   // غرفة ← { unsub, limit, msgs, ready }
  const outbox = {};  // غرفة ← رسائل صور وصوت ما زالت تُرفع، تظهر فوراً عند مرسلها
  let storageP = null;
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
      fb = { app: a, auth, fs, authI: auth.getAuth(a), db: fs.initializeFirestore(a, { localCache: fs.persistentLocalCache() }) };
      // للتجربة فقط: localhost/?emulator يستخدم محاكيات Firebase بدل المشروع الحقيقي
      if (location.hostname === 'localhost' && /[?&]emulator\b/.test(location.search)) {
        auth.connectAuthEmulator(fb.authI, 'http://localhost:9099', { disableWarnings: true });
        fs.connectFirestoreEmulator(fb.db, 'localhost', 8085);
        fb.emulator = true;
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
    if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
    comments = [];
    config = {}; guardian = false; guardians = {}; marked = {}; markQ = null;
    Object.keys(rooms).forEach(r => { if (rooms[r].unsub) rooms[r].unsub(); delete rooms[r]; });
    Object.keys(outbox).forEach(r => delete outbox[r]);
    users = {}; usersReady = false; memberData = null; usersSig = '';
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
      // تغيّر «آخر ظهور» وحده يصل من كل فرد كل دقيقة تقريباً، ولا يستحق إعادة رسم المحادثة
      // ترتيب الحقول يختلف بين النسخة المحلية ونسخة الخادم، فنرتّبها قبل المقارنة
      const canon = v => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().map(k => [k, canon(v[k])]) : v);
      const sig = status + usersReady + JSON.stringify(canon(Object.fromEntries(Object.entries(users).map(([k, v]) => [k, { ...v, seen: 0 }]))));
      const onlySeen = sig === usersSig;
      usersSig = sig;
      notify(onlySeen ? 'presence' : 'users');
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

  async function signIn() {
    // Google تمنع الدخول من داخل WebView: في التطبيق يتم الدخول بنافذة النظام ونمرّر نتيجته إلى Firebase
    if (Native.on) {
      const r = await Native.plugin('FirebaseAuthentication').signInWithGoogle({ skipNativeAuth: true });
      return fb.auth.signInWithCredential(fb.authI, fb.auth.GoogleAuthProvider.credential(r.credential.idToken));
    }
    const provider = new fb.auth.GoogleAuthProvider();
    return fb.auth.signInWithPopup(fb.authI, provider).catch(e => {
      if (e.code === 'auth/popup-blocked') return fb.auth.signInWithRedirect(fb.authI, provider);
      throw e;
    });
  }

  const otherApps = d => !!(d && d.apps && Object.keys(d.apps).some(a => a !== APP));

  // الجهاز يخرج من المجلس: يبقى مرتبطاً بالألعاب إن كان مرتبطاً بها
  async function signOut() {
    await disablePush().catch(() => {});
    if (Native.on) await Native.plugin('FirebaseAuthentication').signOut().catch(() => {});
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
    if (me() && me().marks) data.marks = me().marks;
    return fb.fs.setDoc(famDoc('chatUsers', user.uid), data);
  }
  // علامات الصحّين: marks.{غرفة} = { d: وقت آخر رسالة وصلت جهازه، r: وقت آخر رسالة قرأها }
  // نجمع الكتابات القريبة في كتابة واحدة، ولا نكرر نفس القيمة حتى لو رُفضت
  let marked = {}, markQ = null;
  function mark(room, kind, at) {
    const k = room + '|' + kind, mine = me();
    const had = (mine && mine.marks && mine.marks[room] && mine.marks[room][kind]) || 0;
    if (!at || !mine || at <= Math.max(marked[k] || 0, had)) return;
    marked[k] = at;
    if (!markQ) { markQ = {}; setTimeout(flushMarks, 400); }
    markQ[`marks.${room}.${kind}`] = at;
  }
  function flushMarks() {
    const q = markQ;
    markQ = null;
    if (q && fid && me()) fb.fs.updateDoc(famDoc('chatUsers', user.uid), q).catch(() => {});
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
    snap.docs.forEach(d => dropMedia(d.data()));
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
      const have = new Set(box.msgs.map(m => m.id));
      box.msgs.push(...(outbox[room] || []).filter(m => !have.has(m.id)));
      const fresh = box.ready ? box.msgs.filter(m => !before.has(m.id)) : [];
      if (!snap.metadata.fromCache) box.ready = true;
      notify({ room, fresh });
    }, () => { box.ready = true; notify({ room, fresh: [] }); });
  }

  // بعد الخروج من محادثة نعود إلى العدد الأصغر لنحرّر صورها من الذاكرة
  function shrink(room, limit) {
    const r = rooms[room];
    if (!r || r.limit <= limit) return;
    r.msgs = r.msgs.slice(-limit);
    r.limit = 0;
    watch(room, limit);
  }
  // «رسائل أقدم»: نوسّع المتابعة بمقدار step
  function more(room, step) { if (rooms[room]) watch(room, rooms[room].limit + step); }
  // عدد الرسائل بلغ الحد، فقد توجد أقدم منها
  const hasMore = room => !!rooms[room] && rooms[room].msgs.length >= rooms[room].limit;

  const msgsOf = room => (rooms[room] ? rooms[room].msgs : []);

  // ───── الصور والصوت في Storage ─────
  // الرسالة تحمل رابط الملف في حقلها المعتاد، والصورة تحمل أبعادها بعد # ليُحجز مكانها قبل تحميلها
  function storage() {
    if (!storageP) {
      storageP = import(SDK + 'firebase-storage.js').then(st => {
        const s = st.getStorage(fb.app);
        s.maxUploadRetryTime = 15000;   // بعدها نرسل الرسالة بمحتواها بدل الانتظار
        if (fb.emulator) st.connectStorageEmulator(s, 'localhost', 9199);
        return { st, s };
      }).catch(e => { storageP = null; throw e; });
    }
    return storageP;
  }
  async function upload(room, id, dataUrl, kind) {
    const blob = await (await fetch(dataUrl)).blob();
    let dims = '';
    if (kind === 'img') {
      try { const b = await createImageBitmap(blob); dims = `#${b.width}x${b.height}`; b.close(); } catch (e) {}
    }
    const { st, s } = await storage();
    const file = st.ref(s, `families/${fid}/chat/${room}/${id}.${kind === 'img' ? 'jpg' : 'audio'}`);
    await st.uploadBytes(file, blob, {
      contentType: blob.type.split(';')[0],
      cacheControl: 'public, max-age=31536000, immutable',
      customMetadata: { uid: user.uid },
    });
    return (await st.getDownloadURL(file)) + dims;
  }
  // حذف ملفات رسالة محذوفة؛ الرسائل القديمة ملفها داخلها فلا شيء يُحذف
  function dropMedia(m) {
    if (!m) return;
    ['img', 'audio'].forEach(k => {
      if (!/^https?:/.test(m[k] || '')) return;
      storage().then(({ st, s }) => st.deleteObject(st.ref(s, m[k].split('#')[0]))).catch(() => {});
    });
  }

  function send(room, msg) {
    const data = { from: user.uid, at: Date.now() };
    ['text', 'img', 'sticker', 'title', 'audio', 'dur', 'reply'].forEach(k => { if (msg[k]) data[k] = msg[k]; });
    // نعيد المعرّف فوراً؛ Firestore يرفع الرسالة عند عودة الاتصال إن كان الجهاز بلا إنترنت
    const ref = fb.fs.doc(famCol('chatRooms', room, 'messages'));
    const media = ['img', 'audio'].find(k => typeof data[k] === 'string' && data[k].startsWith('data:'));
    let done;
    if (media && navigator.onLine) {
      const local = { id: ref.id, ...data, pending: true };
      (outbox[room] = outbox[room] || []).push(local);
      if (rooms[room]) { rooms[room].msgs.push(local); notify({ room, fresh: [] }); }
      // إن تعذّر الرفع تُرسل الرسالة بمحتواها كما كانت، فلا تضيع
      done = upload(room, ref.id, data[media], media).then(url => ({ ...data, [media]: url }), () => data).then(d => {
        const p = fb.fs.setDoc(ref, d);
        outbox[room] = outbox[room].filter(m => m.id !== ref.id);
        return p;
      });
    } else done = fb.fs.setDoc(ref, data);
    // بعد أن تصل الرسالة إلى الخادم نطلب إرسال تنبيهها لأجهزة العائلة
    const f = fid;
    done.then(() => pushFor(f, room, ref.id)).catch(() => {});
    return { id: ref.id, done };
  }

  function react(room, id, emoji) {
    const ref = famDoc('chatRooms', room, 'messages', id);
    return fb.fs.updateDoc(ref, { ['reacts.' + user.uid]: emoji || fb.fs.deleteField() });
  }

  // صاحب الرسالة يعدّل نصها
  const edit = (room, id, text) => fb.fs.updateDoc(famDoc('chatRooms', room, 'messages', id), { text, edited: Date.now() });

  // صاحب الخبر يعدّل عنوانه ونصه وصورته؛ الصورة الجديدة تُرفع باسم جديد لأن ملفات Storage لا يُكتب فوقها
  async function editNews(id, { title, text, img }) {
    const m = msgsOf('news').find(x => x.id === id);
    if (!m) return;
    const data = { title, text, edited: Date.now() };
    const had = m.img || null, now = img || null;
    if (had !== now) {
      data.img = now || fb.fs.deleteField();
      if (now && now.startsWith('data:') && navigator.onLine) {
        const name = fb.fs.doc(famCol('chatRooms', 'news', 'messages')).id;
        data.img = await upload('news', name, now, 'img').catch(() => now);
      }
    }
    await fb.fs.updateDoc(famDoc('chatRooms', 'news', 'messages', id), data);
    if (had !== now) dropMedia({ img: had });
  }

  // ───── تعليقات الأخبار ─────
  // مجموعة واحدة لكل التعليقات (لا داخل الخبر) فلا يكبر مستند الخبر، ومتابعة واحدة لآخر 300 تعليق
  function watchComments() {
    if (commentsUnsub) return;
    const q = fb.fs.query(famCol('chatRooms', 'news', 'comments'), fb.fs.orderBy('at', 'desc'), fb.fs.limit(300));
    commentsUnsub = fb.fs.onSnapshot(q, snap => {
      comments = snap.docs.map(d => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites })).reverse();
      notify({ comments: true });
    }, () => {});
  }
  const commentsOf = news => comments.filter(c => c.news === news);
  const addComment = (news, text) => fb.fs.setDoc(fb.fs.doc(famCol('chatRooms', 'news', 'comments')), { from: user.uid, at: Date.now(), news, text });
  const delComment = id => fb.fs.deleteDoc(famDoc('chatRooms', 'news', 'comments', id));

  // تعليقات الخبر تُحذف قبله، فالقواعد تتحقق من صاحب الخبر ما دام موجوداً
  async function dropComments(news) {
    const col = famCol('chatRooms', 'news', 'comments');
    const snap = await fb.fs.getDocs(fb.fs.query(col, fb.fs.where('news', '==', news)));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = fb.fs.writeBatch(fb.db);
      snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
      await b.commit();
    }
  }

  async function remove(room, id) {
    const m = msgsOf(room).find(x => x.id === id);
    if (room === 'news') await dropComments(id).catch(() => {});
    await fb.fs.deleteDoc(famDoc('chatRooms', room, 'messages', id));
    dropMedia(m);
  }

  // ───── تنبيهات Web Push ─────
  // الجهاز يحفظ عنوان تنبيهاته في chatPush/{uid}.subs، ودالة chatPush في functions/ ترسل إليه
  // تنبيهاً عند كل رسالة جديدة تخصّه، فيصل حتى لو كان التطبيق مغلقاً
  const VAPID = 'BBER1o4mIwGYEgSDgR7xph8zP09AW3kV6ZQdSfW5KV2o3ACLfncLKoYeUjulre-ATJiMMyphZFQCdt7pcPjm2r8';
  const PUSH_KEY = 'family-chat-push';
  const pushSupported = () => Native.on || ('serviceWorker' in navigator && 'PushManager' in window);
  // يحفظ عنوان الجهاز، ويحذف عنوانه السابق إن تغيّر
  async function savePushEntry(id, entry) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
    const key = Array.from(new Uint8Array(hash).slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
    const old = ls.get(PUSH_KEY);
    const subs = { [key]: entry };
    if (old && old !== key) subs[old] = fb.fs.deleteField();
    await fb.fs.setDoc(famDoc('chatPush', user.uid), { subs }, { merge: true });
    ls.set(PUSH_KEY, key);
  }
  const b64 = s => Uint8Array.from(atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  async function enablePush() {
    if (!pushSupported() || !fid || !user) return false;
    if (Native.on) {
      const token = await Native.pushToken();
      if (!token) return false;
      await savePushEntry(token, { fcm: token, at: Date.now() });
      return true;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) });
    const j = sub.toJSON();
    await savePushEntry(j.endpoint, { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth }, at: Date.now() });
    return true;
  }
  // دالة chatPush (functions/index.js) ترسل تنبيه الرسالة لمن تخصّه
  let callPush = null;
  async function pushFor(f, room, msg) {
    if (!callPush) {
      const fn = await import(SDK + 'firebase-functions.js');
      const fns = fn.getFunctions(fb.app, 'me-central1');
      if (fb.emulator) fn.connectFunctionsEmulator(fns, 'localhost', 5001);
      callPush = fn.httpsCallable(fns, 'chatPush');
    }
    return callPush({ fid: f, room, msg });
  }
  // يوقف التنبيهات على هذا الجهاز فقط (أجهزة الفرد الأخرى تبقى)
  async function disablePush() {
    const key = ls.get(PUSH_KEY);
    ls.set(PUSH_KEY, null);
    if (key && fid && user) await fb.fs.updateDoc(famDoc('chatPush', user.uid), { ['subs.' + key]: fb.fs.deleteField() }).catch(() => {});
    if (Native.on) return Native.pushOff();
    if (pushSupported()) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe().catch(() => {});
    }
  }

  const me = () => (user ? users[user.uid] : null);

  return {
    start, signIn, signOut, join, createCode, saveProfile, beat, mark, removeMember, forget, setDmOff, grant, revoke,
    groups, addGroup, renameGroup, removeGroup,
    watch, shrink, more, hasMore, msgsOf, send, react, edit, editNews, remove,
    watchComments, commentsOf, addComment, delComment,
    pushSupported, enablePush, disablePush, pushOn: () => !!ls.get(PUSH_KEY),
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
