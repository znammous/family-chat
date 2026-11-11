// فلفولة (من أبطال الغابة) وأرنوبة (من أبطال الإملاء): رسم أصلي يعمل بدون إنترنت،
// مع مزاجات إضافية للملصقات: سعيدة، فرحانة، متفاجئة، محبّة، نعسانة.
const Art = (() => {
  // ───── فلفولة ─────
  const SKIN = '#b5cde6', EDGE = '#55779b', DARK = '#26425e';
  const heartAt = (x, y, s = 1, fill = '#ff4d7d') =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4C-6-3-12 1-9 6-7 9-3 11 0 14 3 11 7 9 9 6 12 1 6-3 0 4z" fill="${fill}" stroke="#c22a56" stroke-width="1.4" stroke-linejoin="round"/>`;
  const dropAt = (x, y, s = 1) =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0q4 8 0 12q-4-4 0-12z" fill="#8fd3ff" stroke="#4a8fc0" stroke-width="1.6"/>`;
  const sparkAt = (x, y, s = 1, fill = '#ffcb3d') =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M0-8q1.5 6.5 8 8q-6.5 1.5-8 8q-1.5-6.5-8-8q6.5-1.5 8-8z" fill="${fill}" stroke="#b8791a" stroke-width="1.2" stroke-linejoin="round"/>`;
  const starAt = (x, y, s = 1) =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M0-10l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="#ffcb3d" stroke="#b8791a" stroke-width="1.6" stroke-linejoin="round"/>`;
  // غيمة صغيرة ماطرة (زعلانة)، وعلامة الغضب، وفقاعة التفكير، والقصاصات الملونة
  const rainCloud = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-12 6a6 6 0 0 1 2-11a8 8 0 0 1 15-2a6 6 0 0 1 7 13z" fill="#dfe8f2" stroke="#7d93ab" stroke-width="2" stroke-linejoin="round"/>${dropAt(-6, 9, .6)}${dropAt(3, 11, .6)}</g>`;
  const angerAt = (x, y) => `<g transform="translate(${x} ${y})" fill="none" stroke="#e0334f" stroke-width="3.2" stroke-linecap="round"><path d="M-9-3q6 0 6-6M3-9q0 6 6 6M9 3q-6 0-6 6M-3 9q0-6-6-6"/></g>`;
  const thinkAt = (x, y, ink, dir = 1) => `<g stroke="#9aa9bb" stroke-width="1.8" fill="#fff"><circle cx="${x - 12 * dir}" cy="${y + 22}" r="2.6"/><circle cx="${x - 7 * dir}" cy="${y + 14}" r="3.8"/><circle cx="${x}" cy="${y}" r="11"/></g><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="16" font-weight="900" fill="${ink}" font-family="sans-serif">?</text>`;
  const confetti = `<g stroke-width="0"><rect x="8" y="22" width="6" height="3" rx="1" fill="#ff5d8f" transform="rotate(-30 11 23)"/><rect x="104" y="96" width="6" height="3" rx="1" fill="#3fae5f" transform="rotate(40 107 97)"/><rect x="12" y="104" width="6" height="3" rx="1" fill="#4aa8ff" transform="rotate(20 15 105)"/><circle cx="20" cy="10" r="2.4" fill="#ffcb3d"/><circle cx="6" cy="60" r="2.2" fill="#9b6bff"/><circle cx="112" cy="82" r="2.2" fill="#ff9a3c"/><path d="M98 8q4 3 0 6t0 6" fill="none" stroke="#ff5d8f" stroke-width="2" stroke-linecap="round"/></g>`;
  const cupcake = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-9 2h18l-3 13h-12z" fill="#ffb347" stroke="#b8791a" stroke-width="1.8" stroke-linejoin="round"/><path d="M-4 3l1 11M2 3l-1 11" stroke="#b8791a" stroke-width="1.2"/><path d="M-11 3q-2-9 6-10q3-6 10-2q7 0 6 8q2 3-2 4z" fill="#ffd1e3" stroke="#d9527f" stroke-width="1.8" stroke-linejoin="round"/><circle cx="1" cy="-10" r="3.4" fill="#e0334f" stroke="#9e1f35" stroke-width="1.2"/></g>`;
  const flowerAt = (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 4q-2 14 2 24" stroke="#3fae5f" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M1 18q8-6 12-1q-6 5-12 1z" fill="#3fae5f"/><g stroke="#d9527f" stroke-width="1.4" fill="#ff9dbd"><circle cx="0" cy="-7" r="5"/><circle cx="6.7" cy="-2.2" r="5"/><circle cx="4.1" cy="5.7" r="5"/><circle cx="-4.1" cy="5.7" r="5"/><circle cx="-6.7" cy="-2.2" r="5"/></g><circle r="3.8" fill="#ffd84d" stroke="#d99a1c" stroke-width="1.4"/></g>`;
  // كتاب مفتوح أمام الجسم (أذاكر)
  const bookAt = (x, y) => `<g transform="translate(${x} ${y})" stroke-linejoin="round"><path d="M-29 -2q15-6 29 2q14-8 29-2v24q-15-5-29 3q-14-8-29-3z" fill="#4aa8ff" stroke="#2a6fb0" stroke-width="2.4"/><path d="M-26 -3q13-5 26 3v21q-13-7-26-2zM26 -3q-13-5-26 3v21q13-7 26-2z" fill="#fff" stroke="#2a6fb0" stroke-width="1.8"/><path d="M-21 4q9-3 17 1M-21 10q9-3 17 1M21 4q-9-3-17 1M21 10q-9-3-17 1" fill="none" stroke="#9cc6ef" stroke-width="1.6" stroke-linecap="round"/></g>`;
  // نظارة شمسية (بطل!)
  const shades = (l, r, y, ink) => `<g stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"><path d="M${l - 13} ${y - 6}h26q1 13-11 13q-14 0-15-13zM${r - 13} ${y - 6}h26q-1 13-15 13q-12 0-11-13z" fill="#2b2b3a"/><path d="M${l + 13} ${y - 4}q${(r - l - 26) / 2} -4 ${r - l - 26} 0" fill="none"/></g><path d="M${l - 7} ${y - 3}l5 0M${r - 7} ${y - 3}l5 0" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`;
  // ───── رسوم الأنشطة: رياضة، مساعدة ماما، صلاة، مسجد، إطعام الأخت الصغرى ─────
  const ball = (x, y) => `<g transform="translate(${x} ${y})"><circle r="11" fill="#fff" stroke="#333" stroke-width="2"/><path d="M0-4l4 3-1.5 4.5h-5L-4-1z" fill="#333"/><path d="M0-4v-7M4-1l7-2M2.5 3.5l4 6M-2.5 3.5l-4 6M-4-1l-7-2" stroke="#333" stroke-width="1.4"/></g><path d="M${x - 22} ${y - 4}h-8M${x - 20} ${y + 4}h-10" stroke="#9aa9bb" stroke-width="2.4" stroke-linecap="round"/>`;
  const plate = (x, y) => `<g transform="translate(${x} ${y})"><ellipse rx="15" ry="6" fill="#fff" stroke="#7d93ab" stroke-width="2"/><ellipse rx="9" ry="3" fill="none" stroke="#c9d6e3" stroke-width="1.4"/><rect x="-6" y="-16" width="14" height="8" rx="3" fill="#ffd84d" stroke="#d99a1c" stroke-width="1.6" transform="rotate(-15)"/></g><g fill="#e8f6ff" stroke="#8fc6ea" stroke-width="1.4"><circle cx="${x - 12}" cy="${y - 14}" r="4"/><circle cx="${x - 4}" cy="${y - 22}" r="3"/><circle cx="${x + 12}" cy="${y - 20}" r="4.6"/><circle cx="${x + 18}" cy="${y - 9}" r="2.4"/></g>`;
  const crescent = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M4-10a10 10 0 1 0 0 20a8 8 0 1 1 0-20z" fill="#ffcb3d" stroke="#b8791a" stroke-width="1.4"/><path d="M10-6l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z" fill="#ffcb3d"/></g>`;
  // سجادة صلاة تحت القدمين (تُرسم خلف الجسم)
  const rug = `<path d="M14 150l14-16h64l14 16z" fill="#2f9e6a" stroke="#1d6b47" stroke-width="2" stroke-linejoin="round"/><path d="M26 147l7-9h54l7 9z" fill="none" stroke="#ffd84d" stroke-width="1.6"/><path d="M52 141l8-4 8 4" fill="none" stroke="#ffd84d" stroke-width="1.6"/>`;
  const mosque = (x, y) => `<g transform="translate(${x} ${y})" stroke="#7a5a2e" stroke-width="1.6" stroke-linejoin="round"><rect x="-16" y="0" width="30" height="22" fill="#fff3d6"/><path d="M-13 0q0-15 12-17q12 2 12 17z" fill="#3fae5f"/><rect x="16" y="-14" width="7" height="36" fill="#fff3d6"/><path d="M16-14l3.5-9 3.5 9z" fill="#3fae5f"/><path d="M-5 22v-9q4-5 8 0v9z" fill="#7a5a2e"/></g>${crescent(x - 1, y - 24, .55)}`;
  const bottle = (x, y, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-6" y="-4" width="12" height="20" rx="4" fill="#e8f6ff" stroke="#4a8fc0" stroke-width="1.8"/><rect x="-6" y="6" width="12" height="9" rx="3" fill="#fff"/><rect x="-7" y="-8" width="14" height="5" rx="2" fill="#ff9dbd" stroke="#d9527f" stroke-width="1.4"/><path d="M-3-8q0-7 3-7t3 7z" fill="#ffd9a8" stroke="#c98a4a" stroke-width="1.2"/></g>`;
  const spoon = `<path d="M84 108l9 14" stroke="#9aa9bb" stroke-width="3" stroke-linecap="round"/><ellipse cx="95" cy="125" rx="4.4" ry="3.2" fill="#ffd84d" stroke="#9aa9bb" stroke-width="1.6" transform="rotate(55 95 125)"/>`;
  // الأخت الصغرى: نسخة صغيرة من الشخصية نفسها
  const baby = svg => svg.replace('<svg ', '<svg x="76" y="94" width="46" height="57" ');
  const F_EYES = {
    happy: `<circle cx="44" cy="70" r="6.5" fill="${DARK}"/><circle cx="76" cy="70" r="6.5" fill="${DARK}"/><circle cx="46.2" cy="67.6" r="2.3" fill="#fff"/><circle cx="78.2" cy="67.6" r="2.3" fill="#fff"/>`,
    cheer: `<path d="M37 72q7-10 14 0M69 72q7-10 14 0" fill="none" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>`,
    oops: `<circle cx="44" cy="71" r="5" fill="${DARK}"/><circle cx="76" cy="71" r="5" fill="${DARK}"/><circle cx="45.6" cy="69.4" r="1.7" fill="#fff"/><circle cx="77.6" cy="69.4" r="1.7" fill="#fff"/><path d="M36 61l11-3M84 61l-11-3" stroke="${EDGE}" stroke-width="3" stroke-linecap="round"/>`,
    love: heartAt(44, 63, 0.8) + heartAt(76, 63, 0.8),
    sleep: `<path d="M37 70q7 6 14 0M69 70q7 6 14 0" fill="none" stroke="${DARK}" stroke-width="3.6" stroke-linecap="round"/>`,
    laugh: `<path d="M37 64l12 6-12 6M83 64l-12 6 12 6" fill="none" stroke="${DARK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    sad: `<circle cx="44" cy="71" r="6" fill="${DARK}"/><circle cx="76" cy="71" r="6" fill="${DARK}"/><circle cx="46" cy="68.6" r="2.6" fill="#fff"/><circle cx="78" cy="68.6" r="2.6" fill="#fff"/><path d="M35 64l12-6M85 64l-12-6" stroke="${EDGE}" stroke-width="3" stroke-linecap="round"/>`,
    angry: `<circle cx="45" cy="72" r="5" fill="${DARK}"/><circle cx="75" cy="72" r="5" fill="${DARK}"/><path d="M35 59l14 7M85 59l-14 7" stroke="${DARK}" stroke-width="3.6" stroke-linecap="round"/>`,
    party: `<path d="M37 72q7-10 14 0M69 72q7-10 14 0" fill="none" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>`,
    think: `<circle cx="47" cy="66" r="6" fill="${DARK}"/><circle cx="79" cy="66" r="6" fill="${DARK}"/><circle cx="49" cy="63.6" r="2.2" fill="#fff"/><circle cx="81" cy="63.6" r="2.2" fill="#fff"/><path d="M70 56q7-5 14 0" fill="none" stroke="${EDGE}" stroke-width="3" stroke-linecap="round"/>`,
    yum: `<path d="M37 72q7-10 14 0M69 72q7-10 14 0" fill="none" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>`,
    thanks: `<path d="M37 70q7 6 14 0M69 70q7 6 14 0" fill="none" stroke="${DARK}" stroke-width="3.6" stroke-linecap="round"/>`,
    wink: `<circle cx="44" cy="70" r="6.5" fill="${DARK}"/><circle cx="46.2" cy="67.6" r="2.3" fill="#fff"/><path d="M69 71q7-8 14 0" fill="none" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>`,
    cool: shades(44, 76, 70, DARK),
    study: `<circle cx="43" cy="74" r="5.6" fill="${DARK}"/><circle cx="75" cy="74" r="5.6" fill="${DARK}"/><circle cx="44.6" cy="72.4" r="1.9" fill="#fff"/><circle cx="76.6" cy="72.4" r="1.9" fill="#fff"/>`,
    sport: `<circle cx="44" cy="71" r="6" fill="${DARK}"/><circle cx="76" cy="71" r="6" fill="${DARK}"/><circle cx="46" cy="68.6" r="2.2" fill="#fff"/><circle cx="78" cy="68.6" r="2.2" fill="#fff"/><path d="M36 61l12 3M84 61l-12 3" stroke="${EDGE}" stroke-width="3" stroke-linecap="round"/>`,
    help: `<path d="M37 72q7-10 14 0M69 72q7-10 14 0" fill="none" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>`,
    pray: `<path d="M37 70q7 5 14 0M69 70q7 5 14 0" fill="none" stroke="${DARK}" stroke-width="3.2" stroke-linecap="round"/>`,
    mosque: `<circle cx="44" cy="70" r="6.5" fill="${DARK}"/><circle cx="76" cy="70" r="6.5" fill="${DARK}"/><circle cx="46.2" cy="67.6" r="2.3" fill="#fff"/><circle cx="78.2" cy="67.6" r="2.3" fill="#fff"/>`,
    feed: `<circle cx="47" cy="73" r="6" fill="${DARK}"/><circle cx="79" cy="73" r="6" fill="${DARK}"/><circle cx="49" cy="70.6" r="2.2" fill="#fff"/><circle cx="81" cy="70.6" r="2.2" fill="#fff"/>`,
  };
  const F_TRUNK = {
    happy: 'M60 78C60 100 63 113 77 113C88 113 93 105 92 97',
    cheer: 'M60 78C60 96 70 102 82 96C94 90 99 76 96 62',
    oops: 'M60 78C60 96 58 108 50 116',
    love: 'M60 78C60 96 70 102 82 96C94 90 99 76 96 62',
    sleep: 'M60 78C60 98 58 110 48 114',
    laugh: 'M60 78C60 96 70 102 82 96C94 90 99 76 96 62',
    sad: 'M60 78C60 98 60 110 56 118',
    angry: 'M60 78C60 94 64 104 74 106',
    party: 'M60 78C60 96 70 102 82 96C94 90 99 76 96 62',
    think: 'M60 78C60 98 54 106 46 103',
    yum: 'M60 78C60 96 70 102 82 96C94 90 99 76 96 62',
    thanks: 'M60 78C60 96 70 102 82 96C94 90 99 76 96 62',
    wink: 'M60 78C60 100 63 113 77 113C88 113 93 105 92 97',
    cool: 'M60 78C60 100 63 113 77 113C88 113 93 105 92 97',
    study: 'M60 78C60 92 62 98 66 100',
    sport: 'M60 78C60 96 70 102 82 96C94 90 99 76 96 62',
    help: 'M60 78C60 96 70 102 82 96C94 90 99 76 96 62',
    pray: 'M60 78C60 98 60 108 58 112',
    mosque: 'M60 78C60 100 63 113 77 113C88 113 93 105 92 97',
    feed: 'M60 78C60 98 70 110 84 108',
  };
  const F_MOUTH = {
    happy: `<path d="M38 88q5 7 12 6" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
    cheer: `<path d="M34 86q6 16 19 11q-1-11-19-11z" fill="#c75b6e" stroke="${DARK}" stroke-width="2" stroke-linejoin="round"/>`,
    oops: `<ellipse cx="42" cy="92" rx="4" ry="5" fill="#c75b6e" stroke="${DARK}" stroke-width="2"/>`,
    love: `<path d="M38 88q5 7 12 6" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
    sleep: `<path d="M40 91q4 2 8 0" fill="none" stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"/>`,
    laugh: `<path d="M33 85q7 18 21 11q-1-11-21-11z" fill="#c75b6e" stroke="${DARK}" stroke-width="2" stroke-linejoin="round"/><path d="M40 95q5-4 10 0q-5 3-10 0z" fill="#ff8fa6"/>`,
    sad: `<path d="M37 95q6-7 13-1" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
    angry: `<path d="M36 94q7-6 15-1" fill="none" stroke="${DARK}" stroke-width="3" stroke-linecap="round"/>`,
    party: `<path d="M34 86q6 16 19 11q-1-11-19-11z" fill="#c75b6e" stroke="${DARK}" stroke-width="2" stroke-linejoin="round"/>`,
    think: `<path d="M38 92q5-3 11 0" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
    yum: `<path d="M36 87q7 9 15 3" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/><path d="M45 91q0 8 5 7q3-2 0-8z" fill="#ff7d96" stroke="${DARK}" stroke-width="1.6" stroke-linejoin="round"/>`,
    thanks: `<path d="M39 88q5 6 11 4" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
    wink: `<path d="M36 87q7 9 15 3" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/><path d="M44 91q1 6 5 5q2-2 0-6z" fill="#ff7d96"/>`,
    cool: `<path d="M38 90q7 4 13-3" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
    study: `<path d="M40 90q4 3 8 0" fill="none" stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"/>`,
    sport: `<path d="M35 86q6 14 18 10q-1-10-18-10z" fill="#c75b6e" stroke="${DARK}" stroke-width="2" stroke-linejoin="round"/>`,
    help: `<path d="M38 88q5 7 12 6" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
    pray: `<path d="M40 90q4 3 8 1" fill="none" stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"/>`,
    mosque: `<path d="M38 88q5 7 12 6" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
    feed: `<path d="M38 88q5 7 12 6" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`,
  };
  const F_EXTRA = {
    cheer: `<g fill="#ffcb3d" stroke="#b8791a" stroke-width="1.6"><path d="M101 50l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z"/></g>`,
    love: heartAt(98, 48, 1.3),
    sleep: `<text x="92" y="40" font-size="20" font-weight="800" fill="${EDGE}" font-family="sans-serif">z</text><text x="104" y="24" font-size="14" font-weight="800" fill="${EDGE}" font-family="sans-serif">z</text>`,
    oops: `<path d="M98 36q4 8 0 12q-4-4 0-12z" fill="#8fd3ff" stroke="#4a8fc0" stroke-width="1.6"/>`,
    laugh: dropAt(30, 72, .8) + dropAt(90, 72, .8) + `<path d="M104 40l8-4M106 50l9 1M14 40l-8-4" stroke="${EDGE}" stroke-width="2.6" stroke-linecap="round"/>`,
    sad: dropAt(42, 78, .9) + dropAt(78, 78, .7) + rainCloud(102, 26),
    angry: angerAt(102, 36) + `<ellipse cx="30" cy="84" rx="8" ry="5" fill="#ff6b6b" opacity=".55"/><ellipse cx="90" cy="84" rx="8" ry="5" fill="#ff6b6b" opacity=".55"/>`,
    // بوق الحفلة على طرف الخرطوم
    party: confetti + `<path d="M96 61L95 36L110 42Z" fill="#ffcb3d" stroke="#b8791a" stroke-width="2" stroke-linejoin="round"/><path d="M95 48l9 2M96 55l6 1" stroke="#ff5d8f" stroke-width="2.4"/><path d="M98 31l-2-7M106 33l4-6M112 40l7-2" stroke="#ff5d8f" stroke-width="2.4" stroke-linecap="round"/>`,
    think: thinkAt(104, 22, EDGE),
    yum: cupcake(100, 48) + sparkAt(16, 40, .8),
    thanks: flowerAt(100, 46) + `<ellipse cx="30" cy="84" rx="9" ry="5.6" fill="#ff8fab" opacity=".8"/><ellipse cx="90" cy="84" rx="9" ry="5.6" fill="#ff8fab" opacity=".8"/>` + heartAt(14, 36, .7),
    wink: sparkAt(98, 50, 1),
    cool: starAt(104, 40, 1) + sparkAt(16, 36, .8),
    study: bookAt(60, 108) + `<path d="M16 34l2 4M24 30l-1 4" stroke="#ffcb3d" stroke-width="2.4" stroke-linecap="round"/>`,
    // عصابة رياضية على الجبهة، والكرة على طرف الخرطوم
    sport: `<path d="M26 54q34-9 68 0l-1 7q-33-8-66 0z" fill="#ff5d5d" stroke="#b83232" stroke-width="2" stroke-linejoin="round"/>` + ball(98, 46) + dropAt(20, 44, .8),
    help: plate(98, 54),
    pray: crescent(16, 26, 1.1) + sparkAt(104, 34, .7, '#fff3b0') + sparkAt(12, 112, .6, '#fff3b0'),
    mosque: mosque(18, 112),
    feed: spoon + heartAt(104, 84, .7),
  };
  const F_BACK = { pray: rug };
  const F_FRONT = { feed: () => baby(falfoulaSvg('cheer')) };
  const falfoulaSvg = (mood = 'happy') => {
    const m = F_TRUNK[mood] ? mood : 'happy';
    return `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg">
    ${F_BACK[m] || ''}
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
    ${F_FRONT[m] ? F_FRONT[m]() : ''}
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
    laugh: `<path d="M40 70l12 6-12 6M80 70l-12 6 12 6" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    sad: `<circle cx="46" cy="77" r="6" fill="${INK}"/><circle cx="74" cy="77" r="6" fill="${INK}"/><circle cx="48" cy="74.6" r="2.6" fill="#fff"/><circle cx="76" cy="74.6" r="2.6" fill="#fff"/><path d="M37 70l12-6M83 70l-12-6" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`,
    angry: `<circle cx="47" cy="78" r="5" fill="${INK}"/><circle cx="73" cy="78" r="5" fill="${INK}"/><path d="M37 65l14 7M83 65l-14 7" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`,
    party: `<path d="M39 78q7-10 14 0M67 78q7-10 14 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    think: `<circle cx="49" cy="72" r="6" fill="${INK}"/><circle cx="77" cy="72" r="6" fill="${INK}"/><circle cx="51" cy="69.6" r="2.2" fill="#fff"/><circle cx="79" cy="69.6" r="2.2" fill="#fff"/><path d="M68 62q7-5 14 0" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`,
    yum: `<path d="M39 78q7-10 14 0M67 78q7-10 14 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    thanks: `<path d="M39 76q7 6 14 0M67 76q7 6 14 0" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`,
    wink: `<circle cx="46" cy="76" r="6.5" fill="${INK}"/><circle cx="48.2" cy="73.6" r="2.3" fill="#fff"/><path d="M67 77q7-8 14 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    cool: shades(46, 74, 76, INK),
    study: `<circle cx="46" cy="80" r="5.6" fill="${INK}"/><circle cx="74" cy="80" r="5.6" fill="${INK}"/><circle cx="47.6" cy="78.4" r="1.9" fill="#fff"/><circle cx="75.6" cy="78.4" r="1.9" fill="#fff"/>`,
    sport: `<circle cx="46" cy="77" r="6" fill="${INK}"/><circle cx="74" cy="77" r="6" fill="${INK}"/><circle cx="48" cy="74.6" r="2.2" fill="#fff"/><circle cx="76" cy="74.6" r="2.2" fill="#fff"/><path d="M38 68l12 3M82 68l-12 3" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`,
    help: `<path d="M39 78q7-10 14 0M67 78q7-10 14 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    pray: `<path d="M39 76q7 5 14 0M67 76q7 5 14 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`,
    mosque: `<circle cx="46" cy="76" r="6.5" fill="${INK}"/><circle cx="74" cy="76" r="6.5" fill="${INK}"/><circle cx="48.2" cy="73.6" r="2.3" fill="#fff"/><circle cx="76.2" cy="73.6" r="2.3" fill="#fff"/>`,
    feed: `<circle cx="49" cy="79" r="6" fill="${INK}"/><circle cx="77" cy="79" r="6" fill="${INK}"/><circle cx="51" cy="76.6" r="2.2" fill="#fff"/><circle cx="79" cy="76.6" r="2.2" fill="#fff"/>`,
  };
  const A_MOUTH = {
    happy: `<path d="M53 90q3.5 4.5 7 0q3.5 4.5 7 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    cheer: '<path d="M51 89h18q-1 11-9 11t-9-11z" fill="#c2456d"/><rect x="55.5" y="89" width="9" height="4.6" rx="1.2" fill="#fff"/>',
    oops: '<circle cx="60" cy="93" r="3.4" fill="#c2456d"/>',
    love: `<path d="M53 90q3.5 4.5 7 0q3.5 4.5 7 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    sleep: `<path d="M56 92q4 2 8 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
    laugh: '<path d="M49 89h22q-1 15-11 15t-11-15z" fill="#c2456d"/><rect x="54.5" y="89" width="11" height="4.6" rx="1.2" fill="#fff"/><path d="M54 100q6-5 12 0q-6 3-12 0z" fill="#ff8fa6"/>',
    sad: `<path d="M53 96q7-7 14 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    angry: `<path d="M52 96q8-6 16 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
    party: '<path d="M51 89h18q-1 11-9 11t-9-11z" fill="#c2456d"/><rect x="55.5" y="89" width="9" height="4.6" rx="1.2" fill="#fff"/>',
    think: `<path d="M55 93q5-3 10 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    yum: `<path d="M52 90q8 7 16 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M61 93q-1 8 4 8q4-1 2-8z" fill="#ff7d96" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
    thanks: `<path d="M53 90q3.5 4.5 7 0q3.5 4.5 7 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    wink: `<path d="M52 90q8 7 16 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M62 93q0 6 4 6q3-1 1-6z" fill="#ff7d96"/>`,
    cool: `<path d="M53 91q8 5 15-3" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    study: `<path d="M56 92q4 3 8 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
    sport: '<path d="M51 89h18q-1 11-9 11t-9-11z" fill="#c2456d"/><rect x="55.5" y="89" width="9" height="4.6" rx="1.2" fill="#fff"/>',
    help: `<path d="M53 90q3.5 4.5 7 0q3.5 4.5 7 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    pray: `<path d="M56 92q4 3 8 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
    mosque: `<path d="M53 90q3.5 4.5 7 0q3.5 4.5 7 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    feed: `<path d="M53 90q3.5 4.5 7 0q3.5 4.5 7 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
  };
  const A_EXTRA = {
    // جزرة في يدها، وقلب، ونجمة، وقطرة
    happy: `<g transform="rotate(28 100 118)"><path d="M95 98q5-3 10 0l-5 34z" fill="#ff9a3c" stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round"/><path d="M100 98q-6-9-2-12M100 98q2-10 7-11M100 98q0-8 0-12" fill="none" stroke="#3fae5f" stroke-width="2.6" stroke-linecap="round"/></g>`,
    cheer: `<g fill="#ffcb3d" stroke="#b8791a" stroke-width="1.6"><path d="M104 46l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z"/></g>`,
    love: heartAt(103, 104, 1.3),
    sleep: `<text x="96" y="58" font-size="20" font-weight="800" fill="${LINE}" font-family="sans-serif">z</text><text x="106" y="44" font-size="14" font-weight="800" fill="${LINE}" font-family="sans-serif">z</text>`,
    oops: `<path d="M100 56q4 8 0 12q-4-4 0-12z" fill="#8fd3ff" stroke="#4a8fc0" stroke-width="1.6"/>`,
    laugh: dropAt(33, 78, .8) + dropAt(87, 78, .8) + `<path d="M8 66l-6-3M8 76l-7 1M112 66l6-3M112 76l7 1" stroke="${LINE}" stroke-width="2.6" stroke-linecap="round"/>`,
    sad: dropAt(44, 84, .9) + dropAt(76, 84, .7) + rainCloud(14, 56),
    angry: angerAt(104, 56) + `<ellipse cx="33" cy="87" rx="8.5" ry="5.4" fill="#ff6b6b" opacity=".55"/><ellipse cx="87" cy="87" rx="8.5" ry="5.4" fill="#ff6b6b" opacity=".55"/>`,
    // طاقية الحفلة بين الأذنين
    party: confetti + `<g transform="rotate(-12 58 48)"><path d="M46 49L58 18L70 49Z" fill="#9b6bff" stroke="#5b3bb0" stroke-width="2.2" stroke-linejoin="round"/><path d="M51 37l12 4M48 45l18 3" stroke="#ffcb3d" stroke-width="2.6"/><circle cx="58" cy="17" r="4.4" fill="#ff5d8f" stroke="#c22a56" stroke-width="1.6"/></g>`,
    think: thinkAt(16, 50, LINE, -1),
    yum: `<g transform="rotate(28 100 118)"><path d="M93 96q7-4 14 0l-7 40z" fill="#ff9a3c" stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round"/><path d="M96 106l5 2M97 116l4 1" stroke="#c96a1c" stroke-width="1.8" stroke-linecap="round"/><path d="M100 96q-7-10-2-13M100 96q2-11 8-12M100 96q0-9 0-13" fill="none" stroke="#3fae5f" stroke-width="2.6" stroke-linecap="round"/></g>` + sparkAt(14, 60, .8),
    thanks: flowerAt(102, 100) + `<ellipse cx="33" cy="87" rx="9.5" ry="6" fill="#ff8fab" opacity=".8"/><ellipse cx="87" cy="87" rx="9.5" ry="6" fill="#ff8fab" opacity=".8"/>` + heartAt(14, 58, .7),
    wink: sparkAt(98, 62, 1),
    cool: starAt(104, 56, 1) + sparkAt(14, 60, .8),
    study: bookAt(60, 112) + `<path d="M12 60l2 4M20 56l-1 4" stroke="#ffcb3d" stroke-width="2.4" stroke-linecap="round"/>`,
    sport: `<path d="M24 60q36-12 72 0l-1 7q-35-10-70 0z" fill="#ff5d5d" stroke="#b83232" stroke-width="2" stroke-linejoin="round"/>` + ball(100, 128) + dropAt(18, 66, .8),
    help: plate(98, 116),
    pray: crescent(14, 50, 1.1) + sparkAt(108, 60, .7, '#fff3b0') + sparkAt(10, 104, .6, '#fff3b0'),
    mosque: mosque(18, 114),
    feed: bottle(108, 112, 35) + heartAt(14, 60, .7),
  };
  const A_BACK = { pray: rug };
  const A_FRONT = { feed: () => baby(arnoobaSvg('cheer')) };
  const arnoobaSvg = (mood = 'happy') => {
    const m = A_EYES[mood] ? mood : 'happy';
    return `<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg">
    ${A_BACK[m] || ''}
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
    ${A_FRONT[m] ? A_FRONT[m]() : ''}
    ${A_EXTRA[m] || ''}
  </svg>`;
  };

  const MOODS = ['happy', 'cheer', 'love', 'laugh', 'wink', 'thanks', 'party', 'yum', 'cool', 'think', 'study', 'sport', 'help', 'pray', 'mosque', 'feed', 'oops', 'sad', 'angry', 'sleep'];
  const MOOD_NAMES = {
    happy: 'مرحباً', cheer: 'رائع!', love: 'أحبكم', oops: 'أوه!', sleep: 'تصبحون على خير',
    laugh: 'ههههه', wink: 'تمام!', thanks: 'شكراً', party: 'مبروك!', yum: 'لذيذ!',
    cool: 'بطل!', think: 'أفكر...', study: 'أذاكر', sad: 'زعلانة', angry: 'غضبانة!',
    sport: 'رياضة!', help: 'أساعد ماما', pray: 'أصلّي', mosque: 'إلى المسجد', feed: 'أطعم أختي',
  };
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
      return `<span class="sticker-art">${char(who, m[2], 'big m-' + m[2])}<b>${MOOD_NAMES[m[2]] || ''}</b></span>`;
    }
    return `<span class="sticker-emoji">${esc(s || '')}</span>`;
  }

  // صورة الفرد: فلفولة أو أرنوبة أو أحد ملصقاتهما أو إيموجي
  function avatar(a, cls = '') {
    if (a === 'falfoula' || a === 'arnooba') return `<span class="av char-av ${cls}">${char(a, 'happy')}</span>`;
    const m = /^([fa]):(\w+)$/.exec(a || '');
    if (m && MOODS.includes(m[2])) return `<span class="av char-av ${cls}">${char(m[1] === 'a' ? 'arnooba' : 'falfoula', m[2])}</span>`;
    return `<span class="av ${cls}">${esc(a || '🙂')}</span>`;
  }

  // أقسام لوحة الملصقات: شخصية عالم المستخدم أولاً
  const STICKER_GROUPS = first => {
    const f = { title: 'فلفولة', list: MOODS.map(m => 'f:' + m) };
    const a = { title: 'أرنوبة', list: MOODS.map(m => 'a:' + m) };
    return [...(first === 'arnooba' ? [a, f] : [f, a]), { title: 'إيموجي كبير', list: STICKERS.filter(s => !/^[fa]:/.test(s)) }];
  };

  return { char, sticker, avatar, STICKERS, STICKER_GROUPS, MOODS, MOOD_NAMES, falfoulaSvg, arnoobaSvg };
})();

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
