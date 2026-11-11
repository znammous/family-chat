// محرر الصور قبل المشاركة: رسم حر وسهم ودائرة ونص، ويعيد لوحة فيها الصورة مدموجة بما رُسم
const Draw = (() => {
  const COLORS = ['#ff2d3f', '#ffd21f', '#22c55e', '#2f80ff', '#ffffff', '#111111'];
  const SIZES = [0.006, 0.01, 0.017]; // سماكة الخط نسبةً إلى ضلع الصورة الأطول، حتى يبدو واحداً في كل الصور
  const TEXT_SCALE = 6;               // حجم النص بالنسبة إلى السماكة
  const FONT = '"Baloo Bhaijaan 2", system-ui, -apple-system, Tahoma, sans-serif';
  const TOOLS = [['pen', '✏️', 'رسم'], ['arrow', '↗️', 'سهم'], ['circle', '⭕', 'دائرة'], ['text', '🔤', 'نص']];

  let s = null; // الجلسة المفتوحة

  // ───── الرسم ─────
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const px = op => s.long * SIZES[op.size];

  function strokeStyle(ctx, op) {
    ctx.strokeStyle = ctx.fillStyle = op.color;
    ctx.lineWidth = px(op);
    ctx.lineCap = ctx.lineJoin = 'round';
  }
  function pen(ctx, op) {
    const p = op.pts;
    if (p.length < 2) { ctx.beginPath(); ctx.arc(p[0].x, p[0].y, px(op) / 2, 0, 7); ctx.fill(); return; }
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
    ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
    ctx.stroke();
  }
  function arrow(ctx, { a, b }, w) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const head = Math.min(w * 5, dist(a, b) * 0.7);
    // الخط يقف داخل الرأس حتى لا يبرز طرفه المستدير من سن السهم
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x - Math.cos(ang) * head * 0.7, b.y - Math.sin(ang) * head * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    for (const d of [0.45, -0.45]) ctx.lineTo(b.x - Math.cos(ang + d) * head, b.y - Math.sin(ang + d) * head);
    ctx.closePath();
    ctx.fill();
  }
  function circle(ctx, { a, b }) {
    ctx.beginPath();
    ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(a.x - b.x) / 2, Math.abs(a.y - b.y) / 2, 0, 0, 7);
    ctx.stroke();
  }

  // النص يُلف على عرض الصورة، ويتحدد اتجاهه من محتواه
  function textSetup(ctx, op) {
    const size = px(op) * TEXT_SCALE;
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = /[֐-ࣿ]/.test(op.text) ? 'rtl' : 'ltr';
    return size;
  }
  function textBox(ctx, op) {
    const size = textSetup(ctx, op), max = s.w * 0.92, lines = [];
    let line = '';
    for (const word of op.text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > max) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
    const lh = size * 1.35;
    return { size, lines, lh, w: Math.max(...lines.map(l => ctx.measureText(l).width)), h: lh * lines.length };
  }
  function text(ctx, op) {
    const { size, lines, lh, h } = textBox(ctx, op);
    ctx.lineWidth = size * 0.16;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = op.color === '#111111' ? '#fff' : '#000';
    ctx.fillStyle = op.color;
    lines.forEach((l, i) => {
      const y = op.y - h / 2 + lh * (i + 0.5);
      ctx.strokeText(l, op.x, y);
      ctx.fillText(l, op.x, y);
    });
  }
  function drawOp(ctx, op) {
    if (op.t === 'text') return text(ctx, op);
    strokeStyle(ctx, op);
    if (op.t === 'pen') pen(ctx, op);
    else if (op.t === 'arrow') arrow(ctx, op, px(op));
    else circle(ctx, op);
  }

  function paint() {
    const { ctx, w, h, img, ops, cur, entry } = s;
    ctx.drawImage(img, 0, 0, w, h);
    ops.forEach((op, i) => { if (!entry || entry.i !== i) drawOp(ctx, op); });
    if (cur) drawOp(ctx, cur);
    const draft = entryOp();
    if (draft) drawOp(ctx, draft);
  }
  function redraw() {
    if (!s || s.raf) return;
    s.raf = requestAnimationFrame(() => { if (!s) return; s.raf = 0; paint(); });
  }

  // ───── النص ─────
  function entryOp() {
    const e = s.entry;
    const value = e && s.el.input.value.trim();
    return value ? { t: 'text', text: value, x: e.x, y: e.y, color: s.color, size: s.size } : null;
  }
  function openEntry(i) {
    const old = s.ops[i];
    s.entry = old ? { i, x: old.x, y: old.y } : { i: -1, x: s.w / 2, y: s.h / 2 };
    if (old) { s.color = old.color; s.size = old.size; }
    s.el.input.value = old ? old.text : '';
    s.el.entry.hidden = false;
    s.el.input.focus();
    sync();
    redraw();
  }
  function closeEntry() {
    const e = s.entry;
    if (!e) return;
    const op = entryOp();
    const old = s.ops[e.i];
    s.entry = null;
    s.el.entry.hidden = true;
    s.el.input.blur();
    const same = old && op && old.text === op.text && old.color === op.color && old.size === op.size;
    if (!same && (old || op)) {
      s.hist.push(s.ops.slice());
      if (old && op) s.ops[e.i] = op;
      else if (old) s.ops.splice(e.i, 1);
      else s.ops.push(op);
    }
    sync();
    redraw();
  }
  function textAt(p) {
    for (let i = s.ops.length - 1; i >= 0; i--) {
      const op = s.ops[i];
      if (op.t !== 'text') continue;
      const { w, h } = textBox(s.ctx, op), pad = s.long * 0.02;
      if (Math.abs(p.x - op.x) <= w / 2 + pad && Math.abs(p.y - op.y) <= h / 2 + pad) return i;
    }
    return -1;
  }

  // ───── اللمس ─────
  function point(e) {
    const r = s.el.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(s.w, (e.clientX - r.left) * s.w / r.width)),
      y: Math.max(0, Math.min(s.h, (e.clientY - r.top) * s.h / r.height)),
    };
  }
  function down(e) {
    if (!s || s.pointer != null) return;
    if (s.entry) { closeEntry(); return; }
    const p = point(e);
    if (s.tool === 'text') {
      const i = textAt(p);
      if (i < 0) return;
      s.drag = { i, start: p, from: s.ops[i], before: s.ops.slice(), moved: false };
    } else {
      s.cur = s.tool === 'pen'
        ? { t: 'pen', pts: [p], color: s.color, size: s.size }
        : { t: s.tool, a: p, b: p, color: s.color, size: s.size };
    }
    s.pointer = e.pointerId;
    s.el.canvas.setPointerCapture(e.pointerId);
    redraw();
  }
  function move(e) {
    if (!s || e.pointerId !== s.pointer) return;
    const p = point(e);
    if (s.drag) {
      const d = s.drag;
      if (!d.moved && dist(p, d.start) < s.long * 0.008) return;
      d.moved = true;
      s.ops[d.i] = {
        ...d.from,
        x: Math.max(0, Math.min(s.w, d.from.x + p.x - d.start.x)),
        y: Math.max(0, Math.min(s.h, d.from.y + p.y - d.start.y)),
      };
    } else if (s.cur.t === 'pen') {
      if (dist(p, s.cur.pts[s.cur.pts.length - 1]) >= 2) s.cur.pts.push(p);
    } else s.cur.b = p;
    redraw();
  }
  function up(e) {
    if (!s || e.pointerId !== s.pointer) return;
    s.pointer = null;
    const { drag, cur } = s;
    s.drag = s.cur = null;
    if (drag) {
      if (drag.moved) s.hist.push(drag.before);
      else return openEntry(drag.i); // لمسة بلا سحب: تعديل النص
    } else if (cur.t === 'pen' || dist(cur.a, cur.b) >= s.long * 0.015) {
      s.hist.push(s.ops.slice());
      s.ops.push(cur);
    }
    sync();
    redraw();
  }
  function lost(e) {
    if (!s || e.pointerId !== s.pointer) return;
    if (s.drag) s.ops = s.drag.before;
    s.pointer = null;
    s.drag = s.cur = null;
    redraw();
  }

  // ───── الواجهة ─────
  function sync() {
    const { root } = s.el;
    root.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === s.tool));
    root.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', b.dataset.color === s.color));
    root.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('on', +b.dataset.size === s.size));
    s.el.undo.disabled = !s.hist.length;
    s.el.hint.hidden = !(s.tool === 'text' && !s.entry && s.ops.some(op => op.t === 'text'));
  }
  function fit() {
    if (!s) return;
    const { clientWidth: sw, clientHeight: sh } = s.el.stage;
    const k = Math.min(sw / s.w, sh / s.h);
    s.el.canvas.style.width = `${Math.round(s.w * k)}px`;
    s.el.canvas.style.height = `${Math.round(s.h * k)}px`;
  }
  function shut() {
    const { root } = s.el;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.observer.disconnect();
    root.remove();
    s = null;
  }
  async function cancel() {
    if (!s) return;
    if (s.hist.length && !await Ask.yes('تجاهل ما رسمته على الصورة؟', { ok: 'تجاهل', danger: true, icon: '🎨' })) return;
    if (s) shut();
  }
  function finish() {
    closeEntry();
    const changed = s.hist.length > 0, { onDone, el, raf } = s;
    if (raf) { cancelAnimationFrame(raf); s.raf = 0; }
    paint();
    shut();
    if (changed) onDone(el.canvas);
  }
  function click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const { tool, color, size, cmd } = b.dataset;
    if (tool) {
      closeEntry();
      s.tool = tool;
      if (tool === 'text') openEntry(-1);
    } else if (color) s.color = color;
    else if (size) s.size = +size;
    else if (cmd === 'cancel') return cancel();
    else if (cmd === 'done') return finish();
    else if (cmd === 'entryOk') closeEntry();
    else if (cmd === 'undo' && s.hist.length) { closeEntry(); s.ops = s.hist.pop(); }
    if (s) { sync(); redraw(); }
  }

  function build(img, onDone) {
    const w = img.naturalWidth, h = img.naturalHeight;
    const root = document.createElement('div');
    root.className = 'draw';
    root.innerHTML = `
      <div class="draw-top">
        <button class="draw-cmd" data-cmd="cancel">إلغاء</button>
        <button class="draw-cmd" data-cmd="undo" aria-label="تراجع">↩️ تراجع</button>
        <button class="draw-cmd done" data-cmd="done">تم ✅</button>
      </div>
      <div class="draw-stage"><canvas></canvas>
        <div class="draw-entry" hidden>
          <input class="text-in" maxlength="120" dir="auto" enterkeyhint="done" placeholder="اكتب هنا…">
          <button class="draw-cmd done" data-cmd="entryOk">تم</button>
        </div>
        <p class="draw-hint" hidden>اسحب النص لتحريكه، والمسه لتعديله</p>
      </div>
      <div class="draw-bar">
        <div class="draw-row">${COLORS.map(c => `<button class="draw-color" data-color="${c}" style="background:${c}" aria-label="لون"></button>`).join('')}
          <span class="draw-sep"></span>
          ${SIZES.map((_, i) => `<button class="draw-size" data-size="${i}" aria-label="الحجم ${i + 1}"><i style="width:${6 + i * 6}px;height:${6 + i * 6}px"></i></button>`).join('')}
        </div>
        <div class="draw-row">${TOOLS.map(([t, icon, label]) => `<button class="draw-tool" data-tool="${t}"><b>${icon}</b><small>${label}</small></button>`).join('')}</div>
      </div>`;
    const canvas = root.querySelector('canvas');
    canvas.width = w;
    canvas.height = h;
    const q = c => root.querySelector(c);
    s = {
      img, w, h, long: Math.max(w, h), ctx: canvas.getContext('2d'), onDone,
      ops: [], hist: [], cur: null, drag: null, entry: null, pointer: null, raf: 0,
      tool: 'arrow', color: COLORS[0], size: 1,
      el: { root, canvas, stage: q('.draw-stage'), entry: q('.draw-entry'), input: q('.draw-entry input'), undo: q('[data-cmd="undo"]'), hint: q('.draw-hint') },
    };
    root.addEventListener('click', click);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', lost);
    s.el.input.addEventListener('input', redraw);
    s.el.input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); closeEntry(); } });
    document.body.appendChild(root);
    s.observer = new ResizeObserver(fit);
    s.observer.observe(s.el.stage);
    fit();
    sync();
    paint();
    // الخط قد لا يكون حُمّل بعد، والرسم على اللوحة لا ينتظره من تلقاء نفسه
    if (document.fonts) document.fonts.load(`700 40px "Baloo Bhaijaan 2"`, 'ا').then(redraw, () => {});
  }

  // src: الصورة، onDone(canvas) عند «تم» إن تغيّر شيء، onFail إن تعذّر فتحها
  function open(src, onDone, onFail) {
    if (s) return;
    const img = new Image();
    // الصور المرفوعة من نطاق آخر: بدون هذا تُمنع قراءة اللوحة عند الحفظ
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => { if (!s) build(img, onDone); };
    img.onerror = () => onFail && onFail();
    img.src = src;
  }

  return { open, cancel, active: () => !!s };
})();
