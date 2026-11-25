'use strict';

/* Draws an EyeTree as an actual tree, with an actual eye at every node. */

(() => {
  const NS = 'http://www.w3.org/2000/svg';

  const EYE_R = 24;
  const IRIS_R = 13;
  const PUPIL_R = 8.5;
  const MAX_LOOK = EYE_R - IRIS_R - 1.5;
  const SPACING = 62;
  const LEVEL = 88;
  const TRUNK = 96;
  const GROUND_MARGIN = 46;

  const MAX_EYES = 127;
  const MIN_KEY = 1;
  const MAX_KEY = 999;
  const SEED = [42, 20, 70, 10, 30, 56, 85, 5, 15, 25, 36, 49, 63, 77, 93];

  const ROLL_MS = 900;
  const STEP_MS = 420;
  const SWEEPS = [Math.PI * 5 / 3, Math.PI * 4 / 3, Math.PI];
  const IRISES = ['#c9882b', '#5f9a4a', '#3f86b8', '#8a6a3b', '#7d68b5', '#3c9c94', '#b5553c'];
  const WALKS = {
    foresight: 'Foresight (pre-order)',
    insight: 'Insight (in-order)',
    hindsight: 'Hindsight (post-order)',
    eyeLevel: 'Eye level (level-order)',
  };

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);
  const scene = $('scene');
  const eyeLayer = $('eyes');
  const branchLayer = $('branches');
  const trunk = $('trunk');
  const caption = $('caption');
  const keyInput = $('key');

  const tree = new EyeTree();
  const views = new Map(); // key -> the drawn eye
  const branchPaths = [];
  let branches = []; // { from, to, width }
  let pointer = null; // { cx, cy, at, touch }
  let glance = null; // { key, until }: everyone looks at this eye for a moment
  let walkTimers = [];
  let burstTimers = [];
  let sceneWidth = 0;
  let sceneHeight = 0;

  const box = { x: -250, y: -400, w: 500, h: 446 };
  const boxTarget = { ...box };

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const [attr, value] of Object.entries(attrs || {})) node.setAttribute(attr, value);
    if (parent) parent.appendChild(node);
    return node;
  }

  const say = (text) => { caption.textContent = text; };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const easeOut = (p) => 1 - (1 - p) ** 3;

  function updateStats() {
    $('stat-eyes').textContent = tree.eyeCount;
    $('stat-depth').textContent = tree.depthPerception;
    $('stat-rolls').textContent = tree.eyeRolls;
  }

  /* ---------- layout ---------- */

  // The crown is a fan around the root. Each eye claims the angle it needs at
  // its depth (less the further out it sits), a missing pupil reserves half a
  // place, and parents sit between their pupils. A small tree is a narrow fan.
  // When the fan would open wider than `maxSweep`, the crown grows outward instead.
  function fan(maxSweep) {
    const spots = new Map();
    if (!tree.root) return { spots, reach: 0, top: 0 };

    const claims = new Map();
    const need = (depth) => SPACING / (depth * LEVEL);
    const measure = (eye, depth) => {
      let inner = 0;
      for (const pupil of eye.pupils) inner += measure(pupil, depth + 1);
      if (eye.pupils.length === 1) inner += need(depth + 1) / 2;
      const width = Math.max(depth ? need(depth) : 0, inner);
      claims.set(eye, { width, inner });
      return width;
    };
    const total = measure(tree.root, 0);
    const stretch = Math.max(1, total / maxSweep);

    let lowest = 0;
    const place = (eye, depth, start, parentKey) => {
      const { width, inner } = claims.get(eye);
      let cursor = start + (width - inner) / 2;
      if (!eye.left && eye.right) cursor += need(depth + 1) / 2;
      const angles = [];
      for (const pupil of eye.pupils) {
        angles.push(place(pupil, depth + 1, cursor, eye.key));
        cursor += claims.get(pupil).width;
      }
      let angle = angles.length === 2 ? (angles[0] + angles[1]) / 2 : start + width / 2;
      if (depth) {
        const margin = need(depth) / 2;
        angle = Math.min(start + width - margin, Math.max(start + margin, angle));
      }
      // Angles are measured from straight up. Stretching trades angle for radius.
      const radius = depth * LEVEL * stretch;
      const x = radius * Math.sin(angle / stretch);
      const y = -radius * Math.cos(angle / stretch);
      lowest = Math.max(lowest, y);
      spots.set(eye.key, { x, y, depth, parentKey, height: eye.height });
      return angle;
    };
    place(tree.root, 0, -total / 2, undefined);

    // Lift the crown until its lowest eye clears the ground.
    const rootY = -Math.max(TRUNK, lowest + 84);
    let reach = 0;
    let top = rootY;
    for (const spot of spots.values()) {
      spot.y += rootY;
      reach = Math.max(reach, Math.abs(spot.x));
      top = Math.min(top, spot.y);
    }
    return { spots, reach, top };
  }

  // Try a few crown shapes and keep whichever shows the eyes largest on this screen.
  function layout() {
    let best;
    for (const sweep of SWEEPS) {
      const option = fan(sweep);
      const halfWidth = Math.max(250, option.reach + 80);
      const y = Math.min(-400, option.top - 96);
      option.frame = { x: -halfWidth, y, w: halfWidth * 2, h: GROUND_MARGIN - y };
      option.zoom = Math.min((sceneWidth || 1) / option.frame.w, (sceneHeight || 1) / option.frame.h);
      if (!best || option.zoom > best.zoom * 1.001) best = option;
    }
    return best;
  }

  function sync() {
    const { spots, frame } = layout();
    const now = performance.now();

    for (const [key, spot] of spots) {
      let view = views.get(key);
      if (!view || view.dying) {
        if (view) view.g.remove();
        const parent = views.get(spot.parentKey);
        const sprout = parent && !parent.dying ? parent : { x: spot.x, y: spot.y + 40 };
        view = makeView(key, sprout.x, sprout.y, now);
        views.set(key, view);
      }
      view.tx = spot.x;
      view.ty = spot.y;
      view.depth = spot.depth;
    }

    for (const [key, view] of views) {
      if (!spots.has(key) && !view.dying) view.dying = now;
    }

    branches = [];
    for (const [key, spot] of spots) {
      if (spot.parentKey !== undefined) {
        branches.push({ from: spot.parentKey, to: key, width: 5 + 3.2 * spot.height });
      }
    }
    while (branchPaths.length < branches.length) branchPaths.push(el('path', {}, branchLayer));
    while (branchPaths.length > branches.length) branchPaths.pop().remove();
    branches.forEach((branch, i) => { branchPaths[i].style.strokeWidth = branch.width; });
    trunk.style.strokeWidth = 8.2 + 3.2 * tree.depthPerception;

    Object.assign(boxTarget, frame);

    updateStats();
  }

  /* ---------- eyes ---------- */

  function makeView(key, x, y, now) {
    const g = el('g', {
      class: 'eye',
      tabindex: '0',
      role: 'button',
      'aria-label': `Eye ${key}. Press to close it.`,
    });
    el('circle', { class: 'ring', r: EYE_R + 8 }, g);
    el('circle', { class: 'socket', r: EYE_R + 3.5 }, g);
    const ball = el('g', {}, g);
    el('circle', { class: 'sclera', r: EYE_R }, ball);
    const iris = el('g', {}, ball);
    el('circle', { r: IRIS_R, fill: IRISES[key % IRISES.length] }, iris);
    el('circle', { class: 'pupil', r: PUPIL_R }, iris);
    el('text', { class: key > 99 ? 'key wide' : 'key', 'text-anchor': 'middle', dy: '0.36em' }, iris).textContent = key;
    el('circle', { class: 'glint', cx: -5, cy: -6, r: 2.4 }, iris);

    g.addEventListener('click', () => closeEye(key));
    g.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        closeEye(key);
      }
    });
    eyeLayer.appendChild(g);

    const view = {
      key, g, ball, iris,
      x, y, tx: x, ty: y, depth: 0,
      lookX: 0, lookY: 0, scale: 0.4,
      born: now, dying: 0,
      blinkAt: -1e9, nextBlink: now + 1500 + Math.random() * 6000,
      rollFrom: 0, rollUntil: 0,
      litUntil: 0, lit: false,
      hover: false, focused: false, big: false,
    };
    g.addEventListener('pointerenter', (event) => { view.hover = event.pointerType !== 'touch'; });
    g.addEventListener('pointerleave', () => { view.hover = false; });
    g.addEventListener('focus', () => { view.focused = g.matches(':focus-visible'); });
    g.addEventListener('blur', () => { view.focused = false; });
    return view;
  }

  function rollEyes() {
    if (reducedMotion) return;
    const now = performance.now();
    for (const view of views.values()) {
      view.rollFrom = now + 220 + view.depth * 70;
      view.rollUntil = view.rollFrom + ROLL_MS;
    }
  }

  function lookAt(key, ms) {
    glance = { key, until: performance.now() + ms };
  }

  function light(key, ms) {
    const view = views.get(key);
    if (view) view.litUntil = performance.now() + ms;
  }

  function stopWalk() {
    walkTimers.forEach(clearTimeout);
    walkTimers = [];
  }

  /* ---------- actions ---------- */

  function openEye(key, quiet) {
    stopWalk();
    if (!Number.isInteger(key) || key < MIN_KEY || key > MAX_KEY) {
      say(`The tree only sees whole numbers from ${MIN_KEY} to ${MAX_KEY}.`);
      return false;
    }
    if (tree.see(key)) {
      say(`The tree has already seen ${key}. It is not impressed.`);
      light(key, 1200);
      lookAt(key, 1200);
      return false;
    }
    if (tree.eyeCount >= MAX_EYES) {
      say(`The tree has seen enough. (${MAX_EYES} eyes is its limit.)`);
      return false;
    }

    const rollsBefore = tree.eyeRolls;
    tree.open(key);
    sync();
    lookAt(key, 1100);

    const rolls = tree.eyeRolls - rollsBefore;
    if (rolls > 0) rollEyes();
    if (!quiet) {
      say(rolls > 0
        ? `Opened ${key}. The tree rolled its eyes (${plural(rolls, 'rotation')}) to stay balanced.`
        : `Opened ${key}. It is watching.`);
    }
    return true;
  }

  function closeEye(key) {
    stopWalk();
    const rollsBefore = tree.eyeRolls;
    if (!tree.close(key)) return;
    sync();

    const rolls = tree.eyeRolls - rollsBefore;
    if (rolls > 0) rollEyes();
    if (tree.eyeCount === 0) say('Every eye is shut. Nothing to see here.');
    else if (rolls > 0) say(`Closed ${key}. The tree rolled its eyes (${plural(rolls, 'rotation')}) about it.`);
    else say(`Closed ${key}. The other ${tree.eyeCount === 1 ? 'eye is' : `${tree.eyeCount} eyes are`} still watching.`);
  }

  function openRandomEye(quiet) {
    const unseen = [];
    for (let key = MIN_KEY; key <= MAX_KEY; key++) if (!tree.see(key)) unseen.push(key);
    return openEye(unseen[Math.floor(Math.random() * unseen.length)], quiet);
  }

  function stopBurst() {
    burstTimers.forEach(clearTimeout);
    burstTimers = [];
  }

  function openMany(count) {
    stopBurst();
    const room = Math.min(count, MAX_EYES - tree.eyeCount);
    if (room <= 0) {
      say(`The tree has seen enough. (${MAX_EYES} eyes is its limit.)`);
      return;
    }
    const rollsBefore = tree.eyeRolls;
    let opened = 0;
    for (let i = 0; i < room; i++) {
      burstTimers.push(setTimeout(() => {
        if (openRandomEye(true)) opened++;
        if (i < room - 1) return;
        const rolls = tree.eyeRolls - rollsBefore;
        say(`Opened ${plural(opened, 'eye')}. ${rolls > 0
          ? `The tree rolled its eyes ${plural(rolls, 'time')}.`
          : 'Not a single eye roll.'}`);
      }, reducedMotion ? 0 : i * 140));
    }
  }

  function shutAll() {
    stopWalk();
    stopBurst();
    tree.clear();
    sync();
    say('Every eye is shut. Nothing to see here.');
  }

  function walk(name) {
    stopWalk();
    const keys = [...tree[name]()];
    if (keys.length === 0) {
      say('Nothing to see here.');
      return;
    }
    say(`${WALKS[name]}: ${keys.join(' → ')}`);
    keys.forEach((key, i) => {
      walkTimers.push(setTimeout(() => {
        light(key, STEP_MS * 1.15);
        lookAt(key, STEP_MS * 1.15);
      }, reducedMotion ? 0 : i * STEP_MS));
    });
  }

  /* ---------- animation ---------- */

  function lookTarget(now) {
    if (glance && now < glance.until) {
      const view = views.get(glance.key);
      if (view) return { x: view.x, y: view.y, self: glance.key };
    }
    if (pointer && pointer.touch && now - pointer.at > 2500) pointer = null;
    if (pointer) {
      const matrix = scene.getScreenCTM();
      if (matrix) {
        const point = new DOMPoint(pointer.cx, pointer.cy).matrixTransform(matrix.inverse());
        return { x: point.x, y: point.y };
      }
    }
    if (reducedMotion) return null;
    // Nobody to watch: scan the horizon.
    return {
      x: Math.sin(now / 2300) * box.w * 0.6,
      y: box.y + box.h * (0.4 + 0.35 * Math.sin(now / 3100)),
    };
  }

  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    const settle = reducedMotion ? 1 : 1 - Math.exp(-dt * 8);
    const quick = reducedMotion ? 1 : 1 - Math.exp(-dt * 16);

    for (const side of ['x', 'y', 'w', 'h']) box[side] += (boxTarget[side] - box[side]) * settle;
    scene.setAttribute('viewBox', `${box.x.toFixed(2)} ${box.y.toFixed(2)} ${box.w.toFixed(2)} ${box.h.toFixed(2)}`);

    const target = lookTarget(now);

    // When the tree is large the eyes get small on screen, so an eye that is
    // hovered, focused or lit widens until its number is readable.
    const zoom = Math.min(sceneWidth / box.w, sceneHeight / box.h) || 1;
    const widen = Math.max(1.18, Math.min(4.5, 1.17 / zoom));

    for (const [key, view] of views) {
      view.x += (view.tx - view.x) * settle;
      view.y += (view.ty - view.y) * settle;

      let open = 1;
      let scale = 1;
      let opacity = 1;

      const age = now - view.born;
      if (age < 450 && !reducedMotion) {
        open = easeOut(age / 450);
        scale = 0.4 + 0.6 * open;
      }

      if (view.dying) {
        const p = reducedMotion ? 1 : (now - view.dying) / 420;
        if (p >= 1) {
          view.g.remove();
          views.delete(key);
          continue;
        }
        open = Math.max(0.05, 1 - p * 2.4);
        opacity = p < 0.45 ? 1 : 1 - (p - 0.45) / 0.55;
        scale = 1 - 0.25 * p;
      } else if (!reducedMotion) {
        if (now > view.nextBlink) {
          view.blinkAt = now;
          view.nextBlink = now + 2500 + Math.random() * 6000;
        }
        const blink = (now - view.blinkAt) / 170;
        if (blink >= 0 && blink < 1) open *= 1 - 0.94 * Math.sin(Math.PI * blink);
      }

      const lit = now < view.litUntil;
      if (lit !== view.lit) {
        view.lit = lit;
        view.g.classList.toggle('lit', lit);
      }
      const big = !view.dying && (lit || view.hover || view.focused);
      if (big !== view.big) {
        view.big = big;
        // Bring it in front of its neighbours (moving a focused node would blur it).
        if (big && eyeLayer.lastChild !== view.g && document.activeElement !== view.g) {
          eyeLayer.appendChild(view.g);
        }
      }
      view.scale += ((big ? scale * widen : scale) - view.scale) * quick;

      let lookX = 0;
      let lookY = 0;
      if (target && target.self !== key) {
        const dx = target.x - view.x;
        const dy = target.y - view.y;
        const distance = Math.hypot(dx, dy) || 1;
        const reach = MAX_LOOK * Math.min(1, distance / 150);
        lookX = (dx / distance) * reach;
        lookY = (dy / distance) * reach;
      }
      if (now >= view.rollFrom && now < view.rollUntil) {
        // An eye roll: left, up and over, right.
        const p = (now - view.rollFrom) / ROLL_MS;
        const angle = Math.PI + p * Math.PI;
        const blend = Math.min(1, p / 0.2, (1 - p) / 0.2);
        lookX += (Math.cos(angle) * MAX_LOOK - lookX) * blend;
        lookY += (Math.sin(angle) * MAX_LOOK - lookY) * blend;
      }
      view.lookX += (lookX - view.lookX) * quick;
      view.lookY += (lookY - view.lookY) * quick;

      view.g.setAttribute('transform', `translate(${view.x.toFixed(2)} ${view.y.toFixed(2)}) scale(${view.scale.toFixed(3)})`);
      view.g.style.opacity = opacity.toFixed(2);
      view.ball.setAttribute('transform', `scale(1 ${open.toFixed(3)})`);
      view.iris.setAttribute('transform', `translate(${view.lookX.toFixed(2)} ${view.lookY.toFixed(2)})`);
    }

    const root = tree.root && views.get(tree.root.key);
    if (root) {
      branches.forEach((branch, i) => {
        const a = views.get(branch.from);
        const b = views.get(branch.to);
        if (!a || !b) return;
        // Bend each branch along the ray from the root to the pupil.
        const ra = Math.hypot(a.x - root.x, a.y - root.y);
        const rb = Math.hypot(b.x - root.x, b.y - root.y) || 1;
        const along = (ra + rb) / (2 * rb);
        const cx = root.x + (b.x - root.x) * along;
        const cy = root.y + (b.y - root.y) * along;
        branchPaths[i].setAttribute('d',
          `M${a.x.toFixed(2)} ${a.y.toFixed(2)} Q${cx.toFixed(2)} ${cy.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`);
      });
    }
    trunk.setAttribute('d', root
      ? `M0 10 L${root.x.toFixed(2)} ${root.y.toFixed(2)}`
      : 'M0 10 L0 -30');

    requestAnimationFrame(frame);
  }

  /* ---------- wiring ---------- */

  const trackPointer = (event) => {
    pointer = { cx: event.clientX, cy: event.clientY, at: performance.now(), touch: event.pointerType === 'touch' };
  };
  window.addEventListener('pointermove', trackPointer);
  window.addEventListener('pointerdown', trackPointer);
  document.documentElement.addEventListener('mouseleave', () => { pointer = null; });

  $('open-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (keyInput.value.trim() === '') {
      say(`Give the tree a whole number from ${MIN_KEY} to ${MAX_KEY} to look at.`);
      return;
    }
    if (openEye(Number(keyInput.value))) keyInput.value = '';
  });
  $('random').addEventListener('click', () => openRandomEye());
  $('many').addEventListener('click', () => openMany(10));
  new ResizeObserver(() => {
    sceneWidth = scene.clientWidth;
    sceneHeight = scene.clientHeight;
    sync();
  }).observe(scene);
  $('shut').addEventListener('click', shutAll);
  for (const button of document.querySelectorAll('[data-walk]')) {
    button.addEventListener('click', () => walk(button.dataset.walk));
  }

  sync();
  requestAnimationFrame(frame);

  const greeting = `${plural(SEED.length, 'eye')} open. Click one to close it, or open more below.`;
  if (reducedMotion) {
    SEED.forEach((key) => openEye(key, true));
    say(greeting);
  } else {
    SEED.forEach((key, i) => setTimeout(() => {
      // Skip the seed if someone is already faster than the tree.
      if (tree.eyeCount === i) openEye(key, true);
      if (i === SEED.length - 1 && tree.eyeCount === SEED.length) say(greeting);
    }, 350 + i * 120));
  }
})();
