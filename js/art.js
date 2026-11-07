// فلفولة (من أبطال الغابة) وأرنوبة (من أبطال الإملاء): رسم أصلي يعمل بدون إنترنت،
// مع مزاجات إضافية للملصقات: سعيدة، فرحانة، متفاجئة، محبّة، نعسانة.
const Art = (() => {
  // ───── فلفولة ─────
  const SKIN = '#b5cde6', EDGE = '#55779b', DARK = '#26425e';
  const heartAt = (x, y, s = 1, fill = '#ff4d7d') =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4C-6-3-12 1-9 6-7 9-3 11 0 14 3 11 7 9 9 6 12 1 6-3 0 4z" fill="${fill}" stroke="#c22a56" stroke-width="1.4" stroke-linejoin="round"/>`;
  const F_EYES = {
    happy: `<circle cx="44" cy="70" r="6.5" fill="${DARK}"/><circle cx="76" cy="70" r="6.5" fill="${DARK}"/><circle cx="46.2" cy="67.6" r="2.3" fill="#fff"/><circle cx="78.2" cy="67.6" r="2.3" fill="#fff"/>`,
    cheer: `<path d="M37 72q7-10 14 0M69 72q7-10 14 0" fill="none" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>`,
    oops: `<circle cx="44" cy="71" r="5" fill="${DARK}"/><circle cx="76" cy="71" r="5" fill="${DARK}"/><circle cx="45.6" cy="69.4" r="1.7" fill="#fff"/><circle cx="77.6" cy="69.4" r="1.7" fill="#fff"/><path d="M36 61l11-3M84 61l-11-3" stroke="${EDGE}" stroke-width="3" stroke-linecap="round"/>`,
    love: heartAt(44, 63, 0.8) + heartAt(76, 63, 0.8),
    sleep: `<path d="M37 70q7 6 14 0M69 70q7 6 14 0" fill="none" stroke="${DARK}" stroke-width="3.6" stroke-linecap="round"/>`,
  };
  const F_TRUNK = {
    happy: 'M60 78C60 100 63 113 77 113C88 113 93 105 92 97',
    cheer: 'M60 78C60 96 70 102 82 96C94 90 99 76 96 62',
    oops: 'M60 78C60 96 58 108 50 116',
    love: 'M60 78C60 96 70 102 82 96C94 90 99 76 96 62',
    sleep: 'M60 78C60 98 58 110 48 114',
  };
  const F_MOUTH = {
    happy: `<path d="M38 88q5 7 12 6" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
    cheer: `<path d="M34 86q6 16 19 11q-1-11-19-11z" fill="#c75b6e" stroke="${DARK}" stroke-width="2" stroke-linejoin="round"/>`,
    oops: `<ellipse cx="42" cy="92" rx="4" ry="5" fill="#c75b6e" stroke="${DARK}" stroke-width="2"/>`,
    love: `<path d="M38 88q5 7 12 6" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
    sleep: `<path d="M40 91q4 2 8 0" fill="none" stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"/>`,
  };
  const F_EXTRA = {
    cheer: `<g fill="#ffcb3d" stroke="#b8791a" stroke-width="1.6"><path d="M101 50l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z"/></g>`,
    love: heartAt(98, 48, 1.3),
    sleep: `<text x="92" y="40" font-size="20" font-weight="800" fill="${EDGE}" font-family="sans-serif">z</text><text x="104" y="24" font-size="14" font-weight="800" fill="${EDGE}" font-family="sans-serif">z</text>`,
    oops: `<path d="M98 36q4 8 0 12q-4-4 0-12z" fill="#8fd3ff" stroke="#4a8fc0" stroke-width="1.6"/>`,
  };
  const falfoulaSvg = (mood = 'happy') => {
    const m = F_TRUNK[mood] ? mood : 'happy';
    return `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg">
    <g stroke="${EDGE}" stroke-width="3">
      <ellipse cx="22" cy="66" rx="21" ry="28" fill="${SKIN}" transform="rotate(-10 22 66)"/>
      <ellipse cx="98" cy="66" rx="21" ry="28" fill="${SKIN}" transform="rotate(10 98 66)"/>
    </g>
    <ellipse cx="23" cy="67" rx="12" ry="18" fill="#ffc9d6" transform="rotate(-10 23 67)"/>
    <ellipse cx="97" cy="67" rx="12" ry="18" fill="#ffc9d6" transform="rotate(10 97 67)"/>
    <ellipse cx="60" cy="126" rx="29" ry="21" fill="${SKIN}" stroke="${EDGE}" stroke-width="3"/>
    <g fill="${SKIN}" stroke="${EDGE}" stroke-width="3"><rect x="34" y="130" width="20" height="17" rx="8"/><rect x="66" y="130" width="20" height="17" rx="8"/></g>
    <g fill="#f4fbff"><circle cx="39" cy="143" r="2"/><circle cx="44" cy="144" r="2"/><circle cx="49" cy="143" r="2"/><circle cx="71" cy="143" r="2"/><circle cx="76" cy="144" r="2"/><circle cx="81" cy="143" r="2"/></g>
    <ellipse cx="60" cy="72" rx="37" ry="34" fill="${SKIN}" stroke="${EDGE}" stroke-width="3"/>
    <path d="M31 101q29 14 58 0l2 9q-31 15-62 0z" fill="#3fae5f" stroke="#237a3f" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M38 110l-5 17 12-5 3-10z" fill="#3fae5f" stroke="#237a3f" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M26 44q34-11 68 0l6 7q-40-10-80 0z" fill="#f5d58b" stroke="#a97f33" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M33 42c0-20 11-31 27-31s27 11 27 31q-27-8-54 0z" fill="#f5d58b" stroke="#a97f33" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M33 42q27-8 54 0l-1-8q-26-8-52 0z" fill="#3fae5f" stroke="#237a3f" stroke-width="1.8" stroke-linejoin="round"/>
    <g transform="translate(38 33)" stroke="#d9527f" stroke-width="1.4"><g fill="#ff9dbd"><circle cx="0" cy="-6.5" r="4.6"/><circle cx="6.2" cy="-2" r="4.6"/><circle cx="3.8" cy="5.3" r="4.6"/><circle cx="-3.8" cy="5.3" r="4.6"/><circle cx="-6.2" cy="-2" r="4.6"/></g><circle r="3.6" fill="#ffd84d" stroke="#d99a1c"/></g>
    <ellipse cx="30" cy="84" rx="7" ry="4.6" fill="#ffb3c4" opacity=".85"/><ellipse cx="90" cy="84" rx="7" ry="4.6" fill="#ffb3c4" opacity=".85"/>
    ${F_EYES[m]}
    ${F_MOUTH[m]}
    <path d="${F_TRUNK[m]}" fill="none" stroke="${EDGE}" stroke-width="19" stroke-linecap="round"/>
    <path d="${F_TRUNK[m]}" fill="none" stroke="${SKIN}" stroke-width="13.5" stroke-linecap="round"/>
    ${F_EXTRA[m] || ''}
  </svg>`;
  };

  // ───── أرنوبة ─────
  const INK = '#4a2b45', LINE = '#b97f63';
  const A_EYES = {
    happy: `<circle cx="46" cy="76" r="6.5" fill="${INK}"/><circle cx="74" cy="76" r="6.5" fill="${INK}"/><circle cx="48.2" cy="73.6" r="2.3" fill="#fff"/><circle cx="76.2" cy="73.6" r="2.3" fill="#fff"/>`,
    cheer: `<path d="M39 78q7-10 14 0M67 78q7-10 14 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    oops: `<circle cx="46" cy="76" r="5" fill="${INK}"/><circle cx="74" cy="76" r="5" fill="${INK}"/><circle cx="47.6" cy="74.4" r="1.7" fill="#fff"/><circle cx="75.6" cy="74.4" r="1.7" fill="#fff"/><path d="M38 66l11-3M82 66l-11-3" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`,
    love: heartAt(46, 69, 0.8) + heartAt(74, 69, 0.8),
    sleep: `<path d="M39 76q7 6 14 0M67 76q7 6 14 0" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`,
  };
  const A_MOUTH = {
    happy: `<path d="M53 90q3.5 4.5 7 0q3.5 4.5 7 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    cheer: '<path d="M51 89h18q-1 11-9 11t-9-11z" fill="#c2456d"/><rect x="55.5" y="89" width="9" height="4.6" rx="1.2" fill="#fff"/>',
    oops: '<circle cx="60" cy="93" r="3.4" fill="#c2456d"/>',
    love: `<path d="M53 90q3.5 4.5 7 0q3.5 4.5 7 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    sleep: `<path d="M56 92q4 2 8 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
  };
  const A_EXTRA = {
    // جزرة في يدها، وقلب، ونجمة، وقطرة
    happy: `<g transform="rotate(28 100 118)"><path d="M95 98q5-3 10 0l-5 34z" fill="#ff9a3c" stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round"/><path d="M100 98q-6-9-2-12M100 98q2-10 7-11M100 98q0-8 0-12" fill="none" stroke="#3fae5f" stroke-width="2.6" stroke-linecap="round"/></g>`,
    cheer: `<g fill="#ffcb3d" stroke="#b8791a" stroke-width="1.6"><path d="M104 46l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z"/></g>`,
    love: heartAt(103, 104, 1.3),
    sleep: `<text x="96" y="58" font-size="20" font-weight="800" fill="${LINE}" font-family="sans-serif">z</text><text x="106" y="44" font-size="14" font-weight="800" fill="${LINE}" font-family="sans-serif">z</text>`,
    oops: `<path d="M100 56q4 8 0 12q-4-4 0-12z" fill="#8fd3ff" stroke="#4a8fc0" stroke-width="1.6"/>`,
  };
  const arnoobaSvg = (mood = 'happy') => {
    const m = A_EYES[mood] ? mood : 'happy';
    return `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg">
    <g stroke="${LINE}" stroke-width="3">
      <ellipse cx="42" cy="32" rx="13" ry="30" fill="#ffe6c7" transform="rotate(-8 42 32)"/>
      <path d="M68 52C66 26 74 8 88 8c11 0 13 14 22 22 6 6 2 16-7 14-9-2-13-6-17-3-3 3-3 8-3 13z" fill="#ffe6c7"/>
    </g>
    <ellipse cx="42" cy="34" rx="6.5" ry="21" fill="#ffb9d0" transform="rotate(-8 42 34)"/>
    <path d="M75 46c0-17 5-30 13-30 6 0 8 10 15 17 3 3 1 5-2 4-9-2-16-5-20-2-3 2-4 6-6 11z" fill="#ffb9d0"/>
    <ellipse cx="60" cy="130" rx="27" ry="19" fill="#ffe6c7" stroke="${LINE}" stroke-width="3"/>
    <ellipse cx="60" cy="78" rx="39" ry="33" fill="#ffe6c7" stroke="${LINE}" stroke-width="3"/>
    <path d="M30 104q30 14 60 0l2 9q-32 15-64 0z" fill="#2fb5ad" stroke="#1c8580" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M38 113l-6 19 13-5 3-11z" fill="#2fb5ad" stroke="#1c8580" stroke-width="2.4" stroke-linejoin="round"/>
    <ellipse cx="33" cy="87" rx="7.5" ry="5" fill="#ffb9d0" opacity=".85"/><ellipse cx="87" cy="87" rx="7.5" ry="5" fill="#ffb9d0" opacity=".85"/>
    ${A_EYES[m]}
    <path d="M56.5 84.5h7l-3.5 4z" fill="#f0719a"/>
    ${A_MOUTH[m]}
    ${A_EXTRA[m] || ''}
  </svg>`;
  };

  const MOODS = ['happy', 'cheer', 'love', 'oops', 'sleep'];
  const MOOD_NAMES = { happy: 'مرحباً', cheer: 'رائع!', love: 'أحبكم', oops: 'أوه!', sleep: 'تصبحون على خير' };
  const char = (who, mood = 'happy', cls = '') =>
    `<span class="char ${who} ${cls}" aria-hidden="true">${who === 'arnooba' ? arnoobaSvg(mood) : falfoulaSvg(mood)}</span>`;

  // الملصقات: f:mood لفلفولة و a:mood لأرنوبة، وأي إيموجي يظهر كبيراً
  const STICKERS = [
    ...MOODS.map(m => 'f:' + m), ...MOODS.map(m => 'a:' + m),
    '❤️', '👍', '😂', '🥰', '🎉', '🌟', '🤗', '😴', '🍕', '🎂', '🏆', '🌈',
  ];
  function sticker(s) {
    const m = /^([fa]):(\w+)$/.exec(s || '');
    if (m) {
      const who = m[1] === 'a' ? 'arnooba' : 'falfoula';
      return `<span class="sticker-art">${char(who, m[2], 'big')}<b>${MOOD_NAMES[m[2]] || ''}</b></span>`;
    }
    return `<span class="sticker-emoji">${esc(s || '')}</span>`;
  }

  // صورة الفرد: فلفولة أو أرنوبة أو إيموجي
  function avatar(a, cls = '') {
    if (a === 'falfoula' || a === 'arnooba') return `<span class="av char-av ${cls}">${char(a, 'happy')}</span>`;
    return `<span class="av ${cls}">${esc(a || '🙂')}</span>`;
  }

  return { char, sticker, avatar, STICKERS, falfoulaSvg, arnoobaSvg };
})();

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
