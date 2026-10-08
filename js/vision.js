(() => {
  'use strict';

  const canvas = document.getElementById('vision-canvas');
  if (!canvas) return;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;

  const stage = canvas.closest('.visual-stage') || canvas.parentElement;
  const fallback = stage.querySelector('.art-fallback');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  const palette = [
    '#25103e', '#38205b', '#4e237d', '#743db0',
    '#9557db', '#b886fa', '#d7b6ff', '#f0ddff',
  ];
  // A readable pause on each number, then the same particles reform into the next.
  const HOLD_DURATION = 1700;
  const TRANSITION_DURATION = 1100;
  const STEP_DURATION = HOLD_DURATION + TRANSITION_DURATION;
  const FLOAT_DURATION = 4800;
  const FLOAT_AMPLITUDE = 14;
  const counterLabel = document.querySelector('.art-counter-active');
  let displayedDigit = 0;
  let digits = [];
  const buckets = Array.from({ length: 48 }, () => []);
  const pointer = { x: 0, y: 0, currentX: 0, currentY: 0 };
  let particles = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let elapsed = 0;
  let lastTime = 0;
  let lastPaint = 0;
  let paused = motionPreference.matches;
  let inView = true;
  let expanded = false;
  let detail = '';

  // A seeded distribution keeps the sculpture stable between resizes.
  function randomGenerator(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildGeometry() {
    const nextDetail = width < 520 ? 'compact' : 'full';
    if (detail === nextDetail) return;
    if (!window.code3visionDigits) return;
    detail = nextDetail;
    digits = window.code3visionDigits.createGeometry(detail === 'compact');
    const random = randomGenerator(41729);
    particles = digits[0].points.map(() => ({
      x: 0, y: 0, z: 0, material: 0,
      luminosity: random(),
      pigment: random(),
      size: 0.52 + random() * 0.63,
      glint: random() > 0.994,
      phase: random() * TAU,
      px: 0, py: 0, radius: 0, depth: 0,
    }));
  }

  function sequenceState() {
    const step = Math.floor(elapsed / STEP_DURATION) % digits.length;
    const progress = Math.max(0, (elapsed % STEP_DURATION - HOLD_DURATION) / TRANSITION_DURATION);
    // Smootherstep keeps both the departure and the arrival free of sudden jumps.
    const blend = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
    return {
      from: digits[step],
      to: digits[(step + 1) % digits.length],
      progress,
      blend,
      lift: Math.sin(progress * Math.PI),
    };
  }

  function camera() {
    const breathing = 1 + Math.sin(elapsed * 0.00042) * 0.007;
    // Float the entire sculpture together, including its contours and highlights.
    const floatY = Math.sin((elapsed / FLOAT_DURATION) * TAU)
      * Math.min(FLOAT_AMPLITUDE, height * 0.025);
    const pitch = -0.13 + Math.sin(elapsed * 0.000095) * 0.045 + pointer.currentY * 0.06;
    const yaw = -0.42 + Math.sin(elapsed * 0.000085) * 0.07 + pointer.currentX * 0.1;
    const roll = -0.055 + Math.sin(elapsed * 0.000055) * 0.018;
    return {
      sx: Math.sin(pitch), cx: Math.cos(pitch),
      sy: Math.sin(yaw), cy: Math.cos(yaw),
      sz: Math.sin(roll), cz: Math.cos(roll),
      scale: Math.min(width * 0.49, height * 0.36) * breathing * (expanded ? 1.02 : 1),
      centerX: width * 0.485 + pointer.currentX * 5,
      centerY: height * 0.48 + pointer.currentY * 5 + floatY,
    };
  }

  function project(point, view, target) {
    const x1 = point.x * view.cy + point.z * view.sy;
    const z1 = -point.x * view.sy + point.z * view.cy;
    const y1 = point.y * view.cx - z1 * view.sx;
    const z2 = point.y * view.sx + z1 * view.cx;
    const perspective = 3.9 / (3.9 - z2);
    target.px = view.centerX + (x1 * view.cz - y1 * view.sz) * view.scale * perspective;
    target.py = view.centerY + (x1 * view.sz + y1 * view.cz) * view.scale * perspective;
    target.depth = z2;
    return perspective;
  }

  function paint() {
    if (!width || !height || !digits.length) return;
    context.clearRect(0, 0, width, height);
    const view = camera();
    const sequence = sequenceState();
    const currentDigit = sequence.blend < 0.5 ? sequence.from.value : sequence.to.value;
    if (displayedDigit !== currentDigit) {
      displayedDigit = currentDigit;
      if (counterLabel) counterLabel.textContent = String(currentDigit).padStart(2, '0');
    }
    const particleScale = Math.max(0.72, Math.min(width / 620, 1.3));
    buckets.forEach((bucket) => { bucket.length = 0; });

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      const from = sequence.from.points[index];
      const to = sequence.to.points[index];
      const swirl = particle.phase + sequence.progress * TAU;
      particle.x = from.x + (to.x - from.x) * sequence.blend
        + Math.sin(swirl) * sequence.lift * 0.055;
      particle.y = from.y + (to.y - from.y) * sequence.blend
        - sequence.lift * (0.07 + Math.sin(particle.phase) * 0.025);
      particle.z = from.z + (to.z - from.z) * sequence.blend
        + Math.cos(swirl) * sequence.lift * 0.13;
      particle.material = from.material + (to.material - from.material) * sequence.blend;
      const perspective = project(particle, view, particle);
      const depth = Math.max(0, Math.min(5, Math.floor((particle.depth + 1) * 3)));
      const light = particle.material + particle.luminosity * 1.8 + particle.pigment * 0.55
        + depth * 0.17 + 0.12 * Math.sin(elapsed * 0.0007 + particle.phase);
      const color = Math.min(7, Math.max(0, Math.floor(light)));
      particle.radius = particle.size * particleScale * perspective;
      buckets[depth * 8 + color].push(index);
    }

    // Contours recede while the particles move, then reveal the next numeral.
    const projected = { px: 0, py: 0, depth: 0 };
    context.lineWidth = Math.max(0.35, particleScale * 0.45);
    context.strokeStyle = '#b886fa';
    function drawContours(geometry, opacity) {
      if (opacity < 0.01) return;
      for (const filament of geometry.filaments) {
        context.globalAlpha = filament.opacity * opacity;
        context.beginPath();
        filament.points.forEach((point, index) => {
          project(point, view, projected);
          if (index === 0) context.moveTo(projected.px, projected.py);
          else context.lineTo(projected.px, projected.py);
        });
        context.stroke();
      }
    }
    drawContours(sequence.from, (1 - sequence.blend) ** 3);
    drawContours(sequence.to, sequence.blend ** 3);

    for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex += 1) {
      const bucket = buckets[bucketIndex];
      const depth = Math.floor(bucketIndex / 8);
      context.fillStyle = palette[bucketIndex % 8];
      context.globalAlpha = 0.48 + depth * 0.092;
      context.beginPath();
      for (const index of bucket) {
        const particle = particles[index];
        context.rect(
          particle.px - particle.radius * 0.5,
          particle.py - particle.radius * 0.5,
          particle.radius,
          particle.radius,
        );
      }
      context.fill();
    }

    // Sparse, soft highlights make the nearest particles feel almost metallic.
    context.fillStyle = '#f0ddff';
    for (const particle of particles) {
      if (!particle.glint || particle.depth < 0.06 || particle.z < 0.15) continue;
      context.globalAlpha = 0.09;
      context.beginPath();
      context.arc(particle.px, particle.py, particle.radius * 3.5, 0, TAU);
      context.fill();
      context.globalAlpha = 0.8;
      context.fillRect(particle.px, particle.py, particle.radius, particle.radius);
    }
    context.globalAlpha = 1;
    if (fallback) fallback.hidden = true;
  }

  function canAnimate() {
    // The OS preference sets the initial state; an explicit press on Play
    // remains an intentional opt-in to the animation.
    return digits.length > 0 && !paused && inView && !document.hidden;
  }

  function animate(timestamp) {
    frame = 0;
    if (!canAnimate()) return;
    if (!lastTime) lastTime = timestamp;
    const delta = Math.min(timestamp - lastTime, 60);
    lastTime = timestamp;
    elapsed += delta;
    if (timestamp - lastPaint > 1000 / 40) {
      pointer.currentX += (pointer.x - pointer.currentX) * 0.075;
      pointer.currentY += (pointer.y - pointer.currentY) * 0.075;
      paint();
      lastPaint = timestamp;
    }
    frame = requestAnimationFrame(animate);
  }

  function syncAnimation() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (canAnimate()) frame = requestAnimationFrame(animate);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    buildGeometry();
    paint();
  }

  function setPaused(value) {
    paused = Boolean(value);
    syncAnimation();
  }

  function setExpanded(value) {
    expanded = Boolean(value);
    requestAnimationFrame(resize);
  }

  stage.addEventListener('pointermove', (event) => {
    if (paused || event.pointerType === 'touch') return;
    const bounds = stage.getBoundingClientRect();
    pointer.x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
    pointer.y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2));
  }, { passive: true });
  stage.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });
  document.addEventListener('visibilitychange', syncAnimation);
  document.addEventListener('vision:pause', (event) => setPaused(event.detail));
  motionPreference.addEventListener('change', () => {
    paused = motionPreference.matches;
    pointer.x = 0;
    pointer.y = 0;
    pointer.currentX = 0;
    pointer.currentY = 0;
    paint();
    syncAnimation();
  });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncAnimation();
    }, { threshold: 0 }).observe(canvas);
  }

  window.code3visionArt = { setPaused, setExpanded };
  resize();
  syncAnimation();
})();
