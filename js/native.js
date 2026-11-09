// ما يخص تطبيق أندرويد (Capacitor). في المتصفح Native.on = false ولا يعمل شيء من هذا.
// يحقن Capacitor كائنه قبل شيفرة الصفحة، فيُعرف به أننا داخل التطبيق.
const Native = (() => {
  const on = (() => { try { return !!(window.Capacitor && Capacitor.isNativePlatform()); } catch (e) { return false; } })();
  const plugin = n => { try { return (on && Capacitor.Plugins[n]) || null; } catch (e) { return null; } };
  const WEB_URL = 'https://znammous.github.io/family-chat/';

  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} };

  // ───── الاهتزاز ─────
  function vibrate(ms) {
    const H = plugin('Haptics');
    if (H) H.vibrate({ duration: ms }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(ms);
  }

  // ───── التنبيهات (FCM) ─────
  // يطلب إذن الجهاز ويعيد رمز FCM، أو null إن رفض صاحب الجهاز الإذن
  async function pushToken() {
    const P = plugin('PushNotifications');
    if (!P) return null;
    let perm = await P.checkPermissions();
    if (perm.receive !== 'granted') perm = await P.requestPermissions();
    if (perm.receive !== 'granted') return null;
    return new Promise((resolve, reject) => {
      const handles = [];
      const done = (fn, v) => { clearTimeout(timer); handles.forEach(h => Promise.resolve(h).then(x => x.remove())); fn(v); };
      const timer = setTimeout(() => done(reject, new Error('push timeout')), 30000);
      handles.push(P.addListener('registration', t => done(resolve, t.value)));
      handles.push(P.addListener('registrationError', e => done(reject, new Error(e.error))));
      P.register().catch(e => done(reject, e));
    });
  }
  async function pushOff() {
    const P = plugin('PushNotifications');
    if (P) await P.unregister().catch(() => {});
  }
  // الضغط على تنبيه يفتح المحادثة
  function onRoom(fn) {
    const P = plugin('PushNotifications');
    if (P) P.addListener('pushNotificationActionPerformed', a => {
      const room = a && a.notification && a.notification.data && a.notification.data.room;
      if (room) fn(room);
    });
  }

  // ───── حفظ صورة ─────
  // رابط التنزيل لا يعمل داخل التطبيق، فنفتح نافذة المشاركة ومنها الحفظ أو الإرسال
  async function saveImage(src) {
    const FS = plugin('Filesystem'), S = plugin('Share');
    const blob = await (await fetch(src)).blob();
    const data = await new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.onerror = no;
      r.readAsDataURL(blob);
    });
    const { uri } = await FS.writeFile({ path: 'family-photo.jpg', data, directory: 'CACHE' });
    await S.share({ files: [uri], dialogTitle: 'حفظ الصورة' }).catch(() => {});
  }

  // ───── التحديث الحي ─────
  // كل تعديل يُبنى على GitHub حزمةً في Releases (web-<بصمة>)، والتطبيق يقارن بصمة ما عنده بآخر حزمة.
  // يُنزَّل الجديد بصمت ويعمل في الفتحة التالية، وإن تعثرت حزمة فلم تبلغ ready() في عشر ثوانٍ عاد إلى ما قبلها.
  // ما يمس الجزء الأصلي (إضافة أو إذن) لا يصل بهذا: minBuild يمنع الحزمة عن تطبيق أقدم منها.
  const UPD_API = 'https://api.github.com/repos/znammous/family-chat/releases/latest';
  const NEXT = 'family-chat-upd-next';
  const AWAY = 30 * 60 * 1000;
  const live = () => plugin('LiveUpdate');
  // ما عُيّن تالياً يعمل عند الفتح. فإن بقي هو الأحدث بعد الفتح فقد تعثر ورُدّ عنه: لا يُنزَّل بصمت ثانية
  const prev = lsGet(NEXT);
  lsSet(NEXT, null);
  let busy = false;

  async function latest() {
    const A = plugin('App');
    const [local, rel, info] = await Promise.all([
      fetch('bundle.json', { cache: 'no-store' }).then(r => r.json()),
      fetch(UPD_API, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('api'); return r.json(); }),
      A ? A.getInfo().catch(() => ({})) : {},
    ]);
    let meta = {};
    try { meta = JSON.parse(rel.body || '{}'); } catch (e) {}
    const zip = (rel.assets || []).find(a => a.name === 'web.zip');
    if (!meta.id || !zip) throw new Error('meta');
    if (meta.id === local.id) return { st: 'none' };
    const build = parseInt(info.build, 10) || 0;
    if (build && meta.minBuild && build < meta.minBuild) return { st: 'apk' };
    return { st: 'new', id: meta.id, tag: rel.tag_name, url: zip.browser_download_url, sha: meta.sha256 };
  }
  async function fetchBundle(u) {
    const L = live();
    const have = await L.getBundles();
    if (!((have && have.bundleIds) || []).includes(u.tag)) {
      const o = { url: u.url, bundleId: u.tag, artifactType: 'zip' };
      if (u.sha) o.checksum = u.sha;
      await L.downloadBundle(o);
    }
    await L.setNextBundle({ bundleId: u.tag });
  }
  async function silentUpdate() {
    if (!live() || busy) return;
    busy = true;
    try {
      const u = await latest();
      if (u.st === 'new' && lsGet(NEXT) !== u.id && prev !== u.id) {
        await fetchBundle(u);
        lsSet(NEXT, u.id);
      }
    } catch (e) { /* يعاد في الفتحة القادمة */ }
    busy = false;
  }
  // زر «تحقق من التحديث»: يعيد 'none' أو 'apk'، أو يعيد فتح التطبيق على الحزمة الجديدة
  async function updateNow() {
    if (!live() || busy) return 'busy';
    busy = true;
    try {
      const u = await latest();
      if (u.st !== 'new') return u.st;
      await fetchBundle(u);
      lsSet(NEXT, null);
      await live().reload();
      return 'new';
    } finally { busy = false; }
  }

  function start() {
    const L = live();
    if (!L) return;
    L.ready().catch(() => {});
    setTimeout(silentUpdate, 3000);
    // من عاد بعد غيبة طويلة فهي كفتحة جديدة، فيُطبَّق ما نُزّل
    let away = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { away = Date.now(); return; }
      if (!away || Date.now() - away < AWAY || busy) return;
      if (lsGet(NEXT)) { lsSet(NEXT, null); L.reload().catch(() => {}); }
      else silentUpdate();
    });
  }

  return { on, plugin, WEB_URL, vibrate, pushToken, pushOff, onRoom, saveImage, updateNow, start };
})();
