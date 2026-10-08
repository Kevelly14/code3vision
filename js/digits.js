(() => {
  'use strict';

  const HALF_DEPTH = 0.24;

  function seededRandom(initialSeed) {
    let seed = initialSeed;
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Cubic segments are sampled directly, so the numeral silhouettes do not
  // depend on installed fonts, text rasterization, or external assets.
  function contour(commands) {
    const points = [];
    for (const command of commands) {
      if (command.length === 2) {
        points.push({ x: command[0], y: command[1] });
        continue;
      }
      const start = points[points.length - 1];
      const [ax, ay, bx, by, endX, endY] = command;
      for (let step = 1; step <= 20; step += 1) {
        const t = step / 20;
        const inverse = 1 - t;
        points.push({
          x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * ax
            + 3 * inverse * t ** 2 * bx + t ** 3 * endX,
          y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * ay
            + 3 * inverse * t ** 2 * by + t ** 3 * endY,
        });
      }
    }

    const left = Math.min(...points.map((point) => point.x));
    const right = Math.max(...points.map((point) => point.x));
    const center = (left + right) / 2;
    return points.map(({ x, y }) => ({ x: x - center, y }));
  }

  const outlines = [
    contour([
      [0.06, -1.05], [0.4, -1.05], [0.4, 0.72], [0.73, 0.72],
      [0.73, 1.05], [-0.55, 1.05], [-0.55, 0.72], [-0.04, 0.72],
      [-0.04, -0.58], [-0.44, -0.36], [-0.61, -0.68],
    ]),
    contour([
      [-0.72, -0.53],
      [-0.7, -0.93, -0.32, -1.05, 0.04, -1.05],
      [0.49, -1.05, 0.76, -0.81, 0.76, -0.43],
      [0.76, -0.15, 0.6, 0.04, 0.33, 0.28],
      [-0.2, 0.73], [0.77, 0.73], [0.77, 1.05],
      [-0.75, 1.05], [-0.75, 0.75], [0.03, 0.04],
      [0.27, -0.18, 0.35, -0.32, 0.35, -0.48],
      [0.35, -0.67, 0.24, -0.75, 0.04, -0.75],
      [-0.15, -0.75, -0.29, -0.63, -0.32, -0.45],
    ]),
    contour([
      [-0.69, -0.72],
      [-0.54, -0.96, -0.22, -1.05, 0.1, -1.05],
      [0.5, -1.05, 0.76, -0.85, 0.76, -0.54],
      [0.76, -0.31, 0.63, -0.11, 0.41, -0.02],
      [0.67, 0.06, 0.8, 0.24, 0.8, 0.5],
      [0.8, 0.85, 0.49, 1.05, 0.05, 1.05],
      [-0.28, 1.05, -0.57, 0.93, -0.73, 0.7],
      [-0.47, 0.44],
      [-0.35, 0.61, -0.17, 0.72, 0.03, 0.72],
      [0.26, 0.72, 0.39, 0.63, 0.39, 0.45],
      [0.39, 0.27, 0.24, 0.17, -0.02, 0.17],
      [-0.23, 0.17], [-0.23, -0.16], [-0.03, -0.16],
      [0.21, -0.16, 0.35, -0.29, 0.35, -0.47],
      [0.35, -0.63, 0.23, -0.73, 0.02, -0.73],
      [-0.17, -0.73, -0.33, -0.62, -0.44, -0.48],
    ]),
  ];

  function contains(x, y, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
      const current = polygon[index];
      const before = polygon[previous];
      if ((current.y > y) !== (before.y > y)
        && x < ((before.x - current.x) * (y - current.y)) / (before.y - current.y) + current.x) {
        inside = !inside;
      }
    }
    return inside;
  }

  function createDigit(polygon, value, compact) {
    const random = seededRandom(41729 + value * 1051);
    const bounds = {
      left: Math.min(...polygon.map((point) => point.x)),
      right: Math.max(...polygon.map((point) => point.x)),
    };
    const regions = [];
    const counts = compact
      ? { front: 3300, back: 850, side: 1350 }
      : { front: 6300, back: 1600, side: 2600 };

    for (const face of [
      { count: counts.front, z: HALF_DEPTH, material: 3.5 },
      { count: counts.back, z: -HALF_DEPTH, material: 0.2 },
    ]) {
      const region = [];
      const attemptLimit = face.count * 30;
      for (let attempt = 0; region.length < face.count && attempt < attemptLimit; attempt += 1) {
        const x = bounds.left + random() * (bounds.right - bounds.left);
        const y = -1.05 + random() * 2.1;
        if (contains(x, y, polygon)) region.push({ x, y, z: face.z, material: face.material });
      }
      if (region.length !== face.count) throw new Error(`Could not sample digit ${value}.`);
      regions.push(region);
    }

    let perimeter = 0;
    const segments = polygon.map((start, index) => {
      const end = polygon[(index + 1) % polygon.length];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const segment = { start, end, length, from: perimeter };
      perimeter += length;
      return segment;
    });

    const sides = [];
    for (let index = 0; index < counts.side; index += 1) {
      // Stratification in arc length keeps short curves as dense as long edges.
      const distance = ((index + random()) / counts.side) * perimeter;
      const segment = segments.find((edge) => distance < edge.from + edge.length)
        || segments[segments.length - 1];
      const t = (distance - segment.from) / segment.length;
      const normalX = (segment.end.y - segment.start.y) / segment.length;
      const normalY = (segment.start.x - segment.end.x) / segment.length;
      sides.push({
        x: segment.start.x + (segment.end.x - segment.start.x) * t,
        y: segment.start.y + (segment.end.y - segment.start.y) * t,
        z: -HALF_DEPTH + random() * HALF_DEPTH * 2,
        material: 1.9 + Math.max(0, -normalX * 0.45 - normalY * 0.65),
      });
    }
    regions.push(sides);

    // Every digit has matching front/back/side index ranges. Sorting each range
    // vertically gives the morph a coherent progression through the silhouette.
    for (const region of regions) region.sort((a, b) => a.y - b.y || a.x - b.x);

    const closedContour = [...polygon, polygon[0]];
    const filaments = [-HALF_DEPTH, 0, HALF_DEPTH].map((z) => ({
      opacity: z === HALF_DEPTH ? 0.24 : z === 0 ? 0.045 : 0.075,
      points: closedContour.map(({ x, y }) => ({ x, y, z })),
    }));
    for (let index = 0; index < 10; index += 1) {
      const distance = (index / 10) * perimeter;
      const segment = segments.find((edge) => distance < edge.from + edge.length)
        || segments[segments.length - 1];
      const t = (distance - segment.from) / segment.length;
      const x = segment.start.x + (segment.end.x - segment.start.x) * t;
      const y = segment.start.y + (segment.end.y - segment.start.y) * t;
      filaments.push({ opacity: 0.075, points: [{ x, y, z: -HALF_DEPTH }, { x, y, z: HALF_DEPTH }] });
    }

    return { value, points: regions.flat(), filaments };
  }

  window.code3visionDigits = {
    createGeometry(compact) {
      return outlines.map((polygon, index) => createDigit(polygon, index + 1, Boolean(compact)));
    },
  };
})();
