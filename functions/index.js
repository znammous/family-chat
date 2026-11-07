// تنبيهات مجلس العائلة: بعد أن يرفع الجهاز رسالته يطلب chatPush، فنرسل تنبيه Web Push إلى أجهزة
// من تخصّهم الرسالة، فيصلهم التنبيه حتى لو كان التطبيق مغلقاً.
// (لا نستخدم مشغّل Firestore لأن قاعدة البيانات في me-central2 ولا تسمح Google بإنشاء المشغّلات هناك)
// عناوين التنبيهات يحفظها كل جهاز في families/{fid}/chatPush/{uid}.subs = { مفتاح: { endpoint, keys, at } }
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const webpush = require('web-push');

initializeApp();
const db = getFirestore();

// المفتاح العام نفسه موجود في js/cloud.js، والخاص سرّ في Secret Manager
const VAPID_PUBLIC = 'BBER1o4mIwGYEgSDgR7xph8zP09AW3kV6ZQdSfW5KV2o3ACLfncLKoYeUjulre-ATJiMMyphZFQCdt7pcPjm2r8';
const VAPID_PRIVATE = defineSecret('VAPID_PRIVATE');

// نفس منطق js/app.js: الفرد المُعاد ربطه يرث ملفه القديم (heir)، وهويته الثابتة root أو معرّفه
function people(users) {
  const heirOf = id => { let x = id; for (let i = 0; i < 10 && users[x] && users[x].heir; i++) x = users[x].heir; return x; };
  const userOf = id => users[heirOf(id)] || users[id];
  const keyOf = id => { const u = userOf(id); return u ? u.root || u.id : id; };
  const nameOf = id => (userOf(id) ? userOf(id).name : 'فرد سابق');
  const active = Object.values(users).filter(u => !u.left && !u.heir);
  return { heirOf, keyOf, nameOf, active };
}

// من يصله التنبيه: العائلة كلها في «بيت العائلة» والأخبار والمجموعات، وطرفا المحادثة الخاصة فقط
// (ولي الأمر يطّلع على محادثات الأبناء الخاصة دون تنبيه، كما في التطبيق)
function recipients(room, from, p) {
  const sender = p.keyOf(from);
  const others = p.active.filter(u => p.keyOf(u.id) !== sender);
  if (room.startsWith('dm_')) {
    const peers = room.slice(3).split('_');
    return others.filter(u => peers.includes(p.keyOf(u.id)));
  }
  return others;
}

function preview(m) {
  if (m.sticker) return '✨ ملصق';
  if (m.audio) return '🎤 رسالة صوتية';
  if (m.img) return '📷 صورة';
  return String(m.title || m.text || '').slice(0, 80);
}

const ID = /^[A-Za-z0-9_-]{1,128}$/;

exports.chatPush = onCall(
  { region: 'me-central1', secrets: [VAPID_PRIVATE], memory: '256MiB' },
  async req => {
    const uid = req.auth && req.auth.uid;
    const { fid, room, msg } = req.data || {};
    if (!uid) throw new HttpsError('unauthenticated', 'sign in');
    if (![fid, room, msg].every(x => typeof x === 'string' && ID.test(x))) throw new HttpsError('invalid-argument', 'bad ids');
    const fam = db.collection('families').doc(fid);
    const snap = await fam.collection('chatRooms').doc(room).collection('messages').doc(msg).get();
    const m = snap.exists ? snap.data() : null;
    // لا يطلب التنبيه إلا صاحب الرسالة، ولرسالة حديثة، ومرة واحدة فقط
    if (!m || m.from !== uid) throw new HttpsError('permission-denied', 'not your message');
    if (Date.now() - m.at > 15 * 60 * 1000) return { sent: 0 };
    try {
      await fam.collection('chatPushSent').doc(`${room}~${msg}`).create({ at: Date.now() });
    } catch (e) { return { sent: 0 }; }

    let title;
    if (room === 'family') title = '🏡 بيت العائلة';
    else if (room === 'news') title = '📰 أخبار العائلة';
    else if (room.startsWith('g_')) {
      const cfg = await fam.collection('chatConfig').doc('settings').get();
      const g = cfg.exists && (cfg.data().groups || {})[room];
      if (!g) return { sent: 0 };
      title = `${g.icon || '💬'} ${g.name || ''}`;
    } else if (!room.startsWith('dm_')) return { sent: 0 };

    const usersSnap = await fam.collection('chatUsers').get();
    const users = {};
    usersSnap.docs.forEach(d => { users[d.id] = { id: d.id, ...d.data() }; });
    const p = people(users);
    const to = recipients(room, m.from, p);
    if (!to.length) return { sent: 0 };

    const name = p.nameOf(m.from);
    const payload = JSON.stringify({
      title: title || name,
      body: `${name}: ${preview(m)}`,
      room,
    });

    webpush.setVapidDetails('https://znammous.github.io/family-chat/', VAPID_PUBLIC, VAPID_PRIVATE.value());
    const docs = await db.getAll(...to.map(u => fam.collection('chatPush').doc(u.id)));
    let sent = 0;
    await Promise.all(docs.filter(d => d.exists).map(async d => {
      const subs = d.data().subs || {};
      const dead = [];
      await Promise.all(Object.entries(subs).map(([k, s]) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 24 * 3600, urgency: 'high', topic: room.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, '') })
          .then(() => { sent++; })
          .catch(e => {
            // الجهاز ألغى التنبيهات أو انتهى عنوانه: نحذفه
            if (e.statusCode === 404 || e.statusCode === 410) dead.push(k);
            else console.warn('push failed', e.statusCode || '', e.body || e.message);
          })));
      if (dead.length) await d.ref.update(Object.fromEntries(dead.map(k => ['subs.' + k, FieldValue.delete()])));
    }));
    return { sent };
  });
