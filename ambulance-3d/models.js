import * as THREE from 'three';

const PI = Math.PI;
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 16);
const sphereGeometry = new THREE.SphereGeometry(1, 14, 8);

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.68, ...options });
}

const paint = material(0xffdc20, { roughness: 0.42 });
const roofPaint = material(0xffdf32, { roughness: 0.51 });
const blue = material(0x164dc6, { roughness: 0.42 });
const red = material(0xf1393b, { roughness: 0.48 });
const rubber = material(0x111923, { roughness: 0.96 });
const bumper = material(0x26323d, { roughness: 0.68 });
const alloy = material(0xb0bdcb, { metalness: 0.4, roughness: 0.36 });
const glass = material(0x25435a, { roughness: 0.24, metalness: 0.24, side: THREE.DoubleSide });
const glassHighlight = material(0x51728a, { roughness: 0.27, side: THREE.DoubleSide });
const headLamp = material(0xe1f4ff, { emissive: 0xb0d5f0, emissiveIntensity: 0.28 });
const tailLamp = material(0xeb343b, { emissive: 0xbb191f, emissiveIntensity: 0.24 });
const beaconPaint = material(0x408bff, { emissive: 0x0959ff, emissiveIntensity: 0.72, roughness: 0.22 });
const orange = material(0xf27b36, { roughness: 0.86 });
const darkerOrange = material(0xcd582a, { roughness: 0.86 });
const reflective = material(0xdfe7ce, { roughness: 0.58, emissive: 0x829479, emissiveIntensity: 0.13 });
const navy = material(0x26364b, { roughness: 0.88 });
const skin = material(0xc99063, { roughness: 0.81 });
const helmetRed = material(0xd83037, { roughness: 0.39 });
const helmetWhite = material(0xf3ede1, { roughness: 0.39 });
const glove = material(0x9bc5cf, { roughness: 0.78 });

function mesh(parent, geometry, surface, x, y, z, sx = 1, sy = 1, sz = 1) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, z);
  object.scale.set(sx, sy, sz);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, surface, x, y, z, width, height, depth) {
  return mesh(parent, boxGeometry, surface, x, y, z, width, height, depth);
}

function oval(parent, surface, x, y, z, sx, sy, sz) {
  return mesh(parent, sphereGeometry, surface, x, y, z, sx, sy, sz);
}

function polygonGeometry(points) {
  const positions = [];
  for (let i = 1; i < points.length - 1; i++) {
    positions.push(...points[0], ...points[i], ...points[i + 1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function shapePlane(group, mat, points) {
  const patch = mesh(group, polygonGeometry(points), mat, 0, 0, 0);
  patch.castShadow = false;
}

function makeCabinGeometry() {
  const profiles = [
    [0.46, 0.87, 0.81, 2.19],
    [1.04, 0.84, 0.78, 2.13],
    [1.85, 0.81, 0.73, 1.35],
    [2.44, 0.77, 0.68, 1.12],
    [2.58, 0.72, 0.69, 0.92],
  ];
  const rings = profiles.map(([z, lower, upper, y]) =>
    [[-lower, 0.55, z], [lower, 0.55, z], [upper, y, z], [-upper, y, z]]);
  const positions = [];
  function addQuad(a, b, c, d) {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < 4; j++) {
      addQuad(rings[i][j], rings[i][(j + 1) % 4], rings[i + 1][(j + 1) % 4], rings[i + 1][j]);
    }
  }
  addQuad(...rings[0].slice().reverse());
  addQuad(...rings.at(-1));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makeBodyGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.93, 0.62);
  shape.lineTo(0.93, 0.62);
  shape.lineTo(0.95, 2.43);
  shape.quadraticCurveTo(0.95, 2.53, 0.84, 2.55);
  shape.lineTo(-0.84, 2.55);
  shape.quadraticCurveTo(-0.95, 2.53, -0.95, 2.43);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 2.91, bevelEnabled: true, bevelThickness: 0.035,
    bevelSize: 0.035, bevelSegments: 2, curveSegments: 3,
  });
  geometry.translate(0, 0, -2.42);
  return geometry;
}

const cabinGeometry = makeCabinGeometry();
const bodyGeometry = makeBodyGeometry();

function decalSurface(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return material(0xffffff, { map: texture, roughness: 0.74 });
}

function placeDecal(parent, surface, width, height, x, y, z, angle = 0) {
  const decal = mesh(parent, new THREE.PlaneGeometry(width, height), surface, x, y, z);
  decal.rotation.y = angle;
  decal.castShadow = false;
}

function fillPath(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fill();
}

function text(ctx, label, x, y, size, color, weight = 800) {
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${weight} ${size}px "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif`;
  ctx.fillText(label, x, y);
}

function drawStar(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(i * PI / 3);
    ctx.fillStyle = '#f4f0c0';
    ctx.fillRect(-r * 0.32, -r, r * 0.64, r * 2);
    ctx.restore();
  }
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(i * PI / 3);
    ctx.fillStyle = '#1246a6';
    ctx.fillRect(-r * 0.27, -r * 0.94, r * 0.54, r * 1.88);
    ctx.restore();
  }
  ctx.strokeStyle = '#f7f6eb';
  ctx.lineWidth = r * 0.075;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.57);
  ctx.lineTo(0, r * 0.63);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.10, -r * 0.55);
  ctx.bezierCurveTo(-r * 0.5, -r * 0.32, r * 0.43, -r * 0.18, 0, r * 0.04);
  ctx.bezierCurveTo(-r * 0.38, r * 0.28, r * 0.27, r * 0.25, -r * 0.08, r * 0.49);
  ctx.stroke();
  ctx.restore();
}

function drawRounded(ctx, x, y, w, h, r, fill, border, stroke = 3) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = stroke;
    ctx.stroke();
  }
}

const liveries = new Map();

function liveryFor(id) {
  if (liveries.has(id)) return liveries.get(id);
  const sides = [true, false].map((frontLeft) => decalSurface(768, 475, (ctx) => {
    const sx = (x) => frontLeft ? 768 - x : x;
    ctx.fillStyle = '#ffdc20';
    ctx.fillRect(0, 0, 768, 475);
    ctx.fillStyle = '#e7bb17';
    ctx.fillRect(0, 1, 768, 9);
    ctx.fillRect(0, 464, 768, 8);

    const stripe = (line, color) => fillPath(ctx, line.map(([x, y]) => [sx(x), y]), color);
    stripe([[0, 179], [489, 179], [623, 253], [768, 253], [768, 286], [610, 286], [479, 213], [0, 213]], '#e73235');
    stripe([[0, 218], [483, 218], [613, 296], [768, 296], [768, 327], [601, 327], [475, 252], [0, 252]], '#1a4cae');
    drawStar(ctx, sx(120), 230, 92);

    const doorX = sx(668) - 46;
    ctx.strokeStyle = '#e5d6a5';
    ctx.lineWidth = 5;
    ctx.strokeRect(doorX, 140, 92, 230);
    ctx.strokeStyle = '#8c7f51';
    ctx.lineWidth = 2;
    ctx.strokeRect(doorX + 4, 144, 84, 222);
    drawRounded(ctx, sx(688) - 11, 269, 22, 9, 2, '#222f39', null);

    if (frontLeft) {
      drawRounded(ctx, sx(370) - 101, 64, 202, 87, 13, '#243950', '#272736', 8);
      fillPath(ctx, [[sx(298), 78], [sx(331), 78], [sx(272), 137], [sx(272), 105]], '#4d697b');
    } else {
      text(ctx, '消防處救護車', sx(368), 196, 26, '#fff7df');
      text(ctx, 'FIRE SERVICES AMBULANCE', sx(374), 237, 15, '#f2f2ec');
    }
    text(ctx, id, sx(664), 79, 34, '#113979');
    text(ctx, 'AMBULANCE', sx(370), 292, 31, '#9b171a');
    text(ctx, '救 護', sx(371), 329, 34, '#a02222');
    drawRounded(ctx, sx(415) - 61, 412, 122, 40, 2, '#c1bd93', '#857b59');
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = '#999979';
      ctx.fillRect(sx(415) - 51, 418 + i * 4, 100, 1);
    }
    for (const x of [70, 169, 562, 676, 731]) {
      drawRounded(ctx, sx(x) - 17, 20, 34, 12, 4, '#236dcc', '#11468c', 2);
      ctx.fillStyle = '#72b5fc';
      ctx.fillRect(sx(x) - 12, 23, 24, 2);
    }
  }));

  const back = decalSurface(480, 480, (ctx) => {
    ctx.fillStyle = '#ffdc20';
    ctx.fillRect(0, 0, 480, 480);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 480, 37);
    ctx.rect(0, 305, 480, 175);
    ctx.clip();
    for (let offset = -300; offset < 650; offset += 55) {
      fillPath(ctx, [[offset, 0], [offset + 25, 0], [offset + 264, 480], [offset + 239, 480]], '#e3373b');
    }
    ctx.restore();
    for (const x of [133, 348]) {
      drawRounded(ctx, x - 47, 55, 94, 162, 35, '#263c51', '#8b7542', 8);
      fillPath(ctx, [[x - 29, 81], [x - 5, 75], [x - 33, 143], [x - 35, 116]], '#4d687d');
      text(ctx, id, x, 238, 22, '#193d6a');
    }
    for (const x of [28, 451]) drawStar(ctx, x, 73, 19);
    ctx.fillStyle = '#bda24e';
    ctx.fillRect(238, 29, 4, 451);
    text(ctx, '救護 AMBULANCE', 240, 276, 37, '#97272c');
    drawRounded(ctx, 85, 366, 310, 53, 4, '#ffde22', null);
    text(ctx, 'KEEP CLEAR', 240, 394, 36, '#8e2428');
  });
  const front = decalSurface(480, 90, (ctx) => {
    ctx.fillStyle = '#1b4d9a';
    ctx.fillRect(0, 0, 480, 90);
    ctx.fillStyle = '#3466a7';
    ctx.fillRect(0, 0, 480, 7);
    text(ctx, 'AMBULANCE', 240, 47, 63, '#fff8df', 900);
  });
  const result = { sides, back, front };
  liveries.set(id, result);
  return result;
}

function putWheel(vehicle, x, z) {
  const wheel = new THREE.Group();
  wheel.position.set(x, 0.405, z);
  wheel.userData.isWheel = true;
  vehicle.add(wheel);
  mesh(wheel, cylinderGeometry, rubber, 0, 0, 0, 0.405, 0.28, 0.405).rotation.z = PI / 2;
  mesh(wheel, cylinderGeometry, alloy, Math.sign(x) * 0.153, 0, 0, 0.247, 0.035, 0.247).rotation.z = PI / 2;
  mesh(wheel, cylinderGeometry, bumper, Math.sign(x) * 0.176, 0, 0, 0.123, 0.025, 0.123).rotation.z = PI / 2;
  return wheel;
}

/**
 * Compact model of a Hong Kong Fire Services Department emergency ambulance.
 * The model faces local +Z. Wheel pivots rotate around local X.
 */
export function createAmbulance({ id = 'A501' } = {}) {
  const vehicle = new THREE.Group();
  const labels = liveryFor(String(id).slice(0, 12));
  box(vehicle, bumper, 0, 0.63, 0.06, 1.68, 0.34, 4.95);
  mesh(vehicle, cabinGeometry, paint, 0, 0, 0);
  mesh(vehicle, bodyGeometry, paint, 0, 0, 0);

  placeDecal(vehicle, labels.sides[0], 2.885, 1.81, 0.989, 1.558, -0.968, PI / 2);
  placeDecal(vehicle, labels.sides[1], 2.885, 1.81, -0.989, 1.558, -0.968, -PI / 2);
  placeDecal(vehicle, labels.back, 1.85, 1.82, 0, 1.558, -2.457, PI);

  // Upper front fairing, windscreen and two side windows.
  box(vehicle, roofPaint, 0, 2.30, 0.78, 1.75, 0.35, 0.63);
  box(vehicle, blue, 0, 2.30, 1.093, 1.57, 0.24, 0.06);
  placeDecal(vehicle, labels.front, 1.06, 0.22, 0, 2.31, 1.126);
  shapePlane(vehicle, glass, [[-0.772, 2.08, 1.104], [-0.723, 1.43, 1.781], [0.723, 1.43, 1.781], [0.772, 2.08, 1.104]]);
  shapePlane(vehicle, glassHighlight, [[-0.611, 2.039, 1.154], [-0.424, 2.039, 1.154], [-0.56, 1.489, 1.745], [-0.686, 1.489, 1.745]]);
  for (const sign of [1, -1]) {
    shapePlane(vehicle, glass, [[sign * 0.825, 2.055, 0.52], [sign * 0.807, 2.034, 1.01], [sign * 0.789, 1.47, 1.61], [sign * 0.853, 1.47, 0.52]]);
    box(vehicle, blue, sign * 0.835, 0.9, 1.502, 0.048, 0.16, 1.94);
    box(vehicle, red, sign * 0.836, 1.04, 1.477, 0.047, 0.12, 1.91);
    box(vehicle, bumper, sign * 0.856, 1.385, 0.883, 0.047, 0.055, 0.18);
    box(vehicle, bumper, sign * 0.873, 1.61, 1.45, 0.26, 0.048, 0.055);
    box(vehicle, bumper, sign * 1.025, 1.62, 1.475, 0.105, 0.22, 0.13);
    box(vehicle, headLamp, sign * 0.659, 0.953, 2.487, 0.235, 0.145, 0.08);
    box(vehicle, tailLamp, sign * 0.827, 0.735, -2.466, 0.235, 0.17, 0.073);
  }
  box(vehicle, bumper, 0, 0.67, 2.486, 1.55, 0.23, 0.221);
  box(vehicle, bumper, 0, 0.97, 2.51, 0.91, 0.16, 0.09);
  for (const y of [0.93, 0.981, 1.029]) box(vehicle, alloy, 0, y, 2.56, 0.76, 0.018, 0.02);
  box(vehicle, alloy, 0, 0.66, -2.459, 1.83, 0.11, 0.24);
  box(vehicle, bumper, 0, 0.607, -2.496, 1.64, 0.072, 0.23);
  box(vehicle, roofPaint, 0, 2.57, -1.19, 0.82, 0.09, 0.69);
  box(vehicle, alloy, 0, 2.624, -1.19, 0.62, 0.055, 0.49);
  box(vehicle, bumper, 0, 2.566, -0.12, 0.73, 0.075, 0.46);

  for (const x of [-0.851, 0.851]) {
    for (const z of [-1.64, 1.69]) putWheel(vehicle, x, z);
    for (const [y, z] of [[2.305, 1.131], [2.47, -2.463]]) {
      const light = box(vehicle, beaconPaint.clone(), Math.sign(x) * 0.703, y, z, 0.20, 0.119, 0.058);
      light.userData.isBeacon = true;
    }
  }
  return vehicle;
}

const crewPatch = decalSurface(232, 84, (ctx) => {
  ctx.fillStyle = '#243746';
  ctx.fillRect(0, 0, 232, 84);
  text(ctx, '救 護', 116, 25, 34, '#fbf1da');
  text(ctx, 'AMBULANCE', 116, 61, 21, '#fbf1da', 900);
});

/**
 * Hong Kong ambulance service incident protection and reflective jacket.
 * The helmet color distinguishes the supervisory model in the training scene.
 */
export function createCrew({ officer = false } = {}) {
  const crew = new THREE.Group();
  const jacket = officer ? material(0xf29142, { roughness: 0.86 }) : orange;
  const helmet = officer ? helmetWhite : helmetRed;
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.105, 0.76, 0);
    leg.userData.isLeg = true;
    crew.add(leg);
    box(leg, navy, 0, -0.313, 0, 0.177, 0.553, 0.196);
    box(leg, bumper, 0, -0.583, 0.02, 0.186, 0.24, 0.217);
    box(leg, rubber, 0, -0.703, 0.061, 0.191, 0.114, 0.278);

    const arm = new THREE.Group();
    arm.position.set(side * 0.247, 1.286, 0.006);
    arm.rotation.z = side * 0.145;
    arm.rotation.x = -0.12;
    crew.add(arm);
    box(arm, jacket, 0, -0.166, 0, 0.143, 0.412, 0.163);
    box(arm, reflective, 0, -0.293, 0.002, 0.15, 0.045, 0.17);
    box(arm, darkerOrange, 0, -0.359, 0, 0.146, 0.034, 0.17);
    oval(arm, glove, 0, -0.411, 0.011, 0.068, 0.074, 0.064);
  }

  box(crew, jacket, 0, 1.04, 0, 0.408, 0.61, 0.261);
  oval(crew, jacket, 0, 1.299, 0, 0.239, 0.093, 0.149);
  box(crew, darkerOrange, 0, 0.769, 0, 0.417, 0.051, 0.267);
  box(crew, reflective, 0, 0.94, 0, 0.413, 0.053, 0.268);
  box(crew, reflective, 0, 1.12, 0, 0.414, 0.047, 0.269);
  box(crew, darkerOrange, 0, 1.073, 0.135, 0.019, 0.533, 0.012);
  box(crew, navy, 0.123, 1.243, 0.145, 0.086, 0.063, 0.027);
  box(crew, reflective, -0.118, 1.238, 0.138, 0.092, 0.034, 0.01);
  placeDecal(crew, crewPatch, 0.257, 0.094, 0, 1.246, -0.133, PI);

  box(crew, navy, 0, 1.377, 0, 0.196, 0.085, 0.185);
  oval(crew, skin, 0, 1.518, 0.006, 0.128, 0.164, 0.128);
  oval(crew, navy, -0.048, 1.559, 0.122, 0.011, 0.010, 0.007);
  oval(crew, navy, 0.048, 1.559, 0.122, 0.011, 0.010, 0.007);
  const brim = mesh(crew, cylinderGeometry, helmet, 0, 1.628, 0.023, 0.157, 0.041, 0.179);
  brim.rotation.x = 0.04;
  oval(crew, helmet, 0, 1.674, -0.004, 0.146, 0.119, 0.148);
  box(crew, reflective, 0, 1.688, 0.137, 0.046, 0.045, 0.014);
  return crew;
}
