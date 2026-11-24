import * as THREE from 'three';

const TOWERS = [
  {
    x: -13, z: -13, width: 8.8, depth: 7, height: 15.5, floors: 7,
    label: '01', color: 0x526886,
    fires: new Set(['2:1', '2:2', '3:0', '3:1', '4:1', '4:2', '5:1', '5:2', '6:2'])
  },
  {
    x: 13, z: -14, width: 7.8, depth: 7.2, height: 18.2, floors: 8,
    label: '02', color: 0x455e82,
    fires: new Set(['2:2', '3:1', '3:2', '4:1', '4:2', '5:0', '5:1', '6:2'])
  }
];

const PAD_SPECS = [
  { x: -6, color: '#ee5c66', dark: '#952d3b', label: '紅區', detail: 'IMMEDIATE' },
  { x: 0, color: '#ffcc42', dark: '#9c6a20', label: '黃區', detail: 'DELAYED' },
  { x: 6, color: '#44d4ad', dark: '#197d70', label: '綠區', detail: 'MINOR' }
];

const box = new THREE.BoxGeometry(1, 1, 1);
const transform = new THREE.Object3D();
const rad = Math.PI / 2;

function standard(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.87, ...extra });
}

function addBox(parent, material, width, height, depth, x, y, z, shadow = false) {
  const mesh = new THREE.Mesh(box, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  parent.add(mesh);
  return mesh;
}

function addBatches(parent, batches) {
  for (const [material, entries] of batches) {
    if (entries.length === 0) continue;
    const mesh = new THREE.InstancedMesh(box, material, entries.length);
    entries.forEach(([x, y, z, width, height, depth, rotation], index) => {
      transform.position.set(x, y, z);
      transform.scale.set(width, height, depth);
      transform.rotation.set(0, rotation, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
}

function textureFromCanvas(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function radialTexture(stops) {
  return textureFromCanvas(128, 128, (ctx) => {
    const fill = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
    stops.forEach(([position, color]) => fill.addColorStop(position, color));
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 128, 128);
  });
}

function addGround(scene) {
  const material = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      nearColor: { value: new THREE.Color('#2f4a6f') },
      farColor: { value: new THREE.Color('#101a2c') },
      lineColor: { value: new THREE.Color('#141f35') },
      skyColor: { value: scene.background?.isColor ? scene.background : new THREE.Color('#111a29') }
    },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vPos = (modelMatrix * vec4(position, 1.0)).xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 nearColor;
      uniform vec3 farColor;
      uniform vec3 lineColor;
      uniform vec3 skyColor;
      varying vec2 vPos;

      float grid(vec2 pos, float cell, float width) {
        vec2 p = pos / cell;
        vec2 distanceToLine = abs(fract(p + 0.5) - 0.5);
        vec2 antialias = fwidth(p);
        vec2 lines = 1.0 - smoothstep(vec2(width), vec2(width) + antialias, distanceToLine);
        return max(lines.x, lines.y);
      }

      void main() {
        vec2 p = vPos;
        float spread = length((p - vec2(0.0, 5.0)) / vec2(1.21, 1.0));
        float falloff = exp(-0.00068 * spread * spread);
        vec3 color = mix(farColor, nearColor, falloff);
        vec2 cell = floor(p / 1.55);
        float grain = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        color += (grain - 0.5) * 0.011 * falloff;
        float fine = grid(p, 1.55, 0.010);
        float major = grid(p, 7.75, 0.004);
        color = mix(color, lineColor, max(fine * 0.56, major * 0.76) * (0.30 + falloff * 0.70));
        float edge = smoothstep(41.0, 104.0, length(p));
        color = mix(color, skyColor, edge);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), material);
  ground.name = '演練地面';
  ground.rotation.x = -rad;
  scene.add(ground);

  const receiver = new THREE.Mesh(new THREE.PlaneGeometry(146, 146), new THREE.ShadowMaterial({
    color: new THREE.Color(0x050a15), opacity: 0.39, depthWrite: false
  }));
  receiver.rotation.x = -rad;
  receiver.position.y = 0.013;
  receiver.receiveShadow = true;
  scene.add(receiver);
  return ground;
}

function addPad(scene, spec) {
  const matWidth = 4.9;
  const matDepth = 3.7;
  const pad = new THREE.Group();
  pad.name = spec.label;
  pad.position.set(spec.x, 0, 6);
  scene.add(pad);
  addBox(pad, standard(0x142538), matWidth + 0.10, 0.071, matDepth + 0.10, 0, 0.036, 0);
  const map = textureFromCanvas(640, 480, (ctx, w, h) => {
    const fill = ctx.createLinearGradient(32, 5, w - 50, h - 2);
    fill.addColorStop(0, spec.color);
    fill.addColorStop(1, spec.dark);
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.085)';
    ctx.lineWidth = 1;
    for (let y = 20; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.70)';
    ctx.lineWidth = 5;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, w - 56, h - 56);
    ctx.fillStyle = 'rgba(11,22,28,0.21)';
    ctx.fillRect(34, h - 132, w - 68, 96);
    ctx.fillStyle = '#fff9ea';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 94px "Noto Sans CJK TC", "Noto Sans TC", sans-serif';
    ctx.fillText(spec.label, w / 2, h * 0.45, w - 110);
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillText(spec.detail, w / 2, h - 79, w - 120);
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(matWidth, matDepth), new THREE.MeshBasicMaterial({
    map, toneMapped: false
  }));
  face.rotation.x = -rad;
  face.position.y = 0.075;
  pad.add(face);
}

function flameGeometry() {
  const profile = [
    [0.0, 0], [0.29, 0.08], [0.44, 0.31], [0.41, 0.58],
    [0.31, 0.86], [0.24, 1.10], [0.15, 1.37], [0.083, 1.63], [0, 1.91]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geometry = new THREE.LatheGeometry(profile, 8);
  const positions = geometry.attributes.position;
  const colors = [];
  const bottom = new THREE.Color('#fff484');
  const middle = new THREE.Color('#ff8a20');
  const top = new THREE.Color('#ed401e');
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    positions.setX(i, positions.getX(i) + 0.085 * y * y);
    positions.setZ(i, positions.getZ(i) * 0.85);
    if (y < 0.72) color.copy(bottom).lerp(middle, y / 0.72);
    else color.copy(middle).lerp(top, (y - 0.72) / 1.19);
    color.multiplyScalar(0.88 + 0.12 * Math.cos(positions.getZ(i) * 18));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function addFlame(parent, state, x, y, z, index, hasSmoke) {
  const base = new THREE.Group();
  base.position.set(x, y, z);
  base.rotation.y = index * 1.972;
  parent.add(base);
  for (let i = 0; i < 3; i++) {
    const tongue = new THREE.Object3D();
    const size = i === 0 ? 0.88 : 0.49 + (index % 3) * 0.045;
    tongue.position.set((i === 0 ? 0 : i === 1 ? -0.32 : 0.31), i === 0 ? 0 : -0.045, 0);
    tongue.rotation.y = i * 1.6;
    base.add(tongue);
    state.tongues.push({
      tongue, size, phase: index * 2.19 + i * 1.52, speed: 4.5 + i * 1.4
    });
  }

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: state.glowMap, color: 0xff9a35, blending: THREE.AdditiveBlending,
    opacity: 0.28, depthWrite: false, toneMapped: false
  }));
  glow.position.set(x, y + 0.68, z + 0.075);
  glow.scale.set(3.25, 3.25, 1);
  parent.add(glow);
  state.glows.push({ glow, phase: index * 1.86 });

  if (!hasSmoke) return;
  for (let i = 0; i < 3; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: state.smokeMap,
      opacity: 0.18,
      depthWrite: false,
      color: index % 2 ? 0x53616f : 0x5f6879
    }));
    sprite.renderOrder = 3;
    parent.add(sprite);
    state.smoke.push({ sprite, x, y, z, phase: (index * 0.27 + i / 3) % 1, seed: index + i });
  }
}

function addTower(scene, tower, state) {
  const { x, z, height, width, depth, floors, color, fires } = tower;
  const group = new THREE.Group();
  group.name = '模擬樓宇 ' + tower.label;
  group.position.set(x, 0, z);
  scene.add(group);

  const shell = standard(color);
  const frame = standard(0x29394d);
  const foundation = standard(0x182b42);
  const bands = standard(tower.label === '01' ? 0x667c9a : 0x58759d);
  const sidePanels = standard(tower.label === '01' ? 0x405979 : 0x354d70);
  const darkGlass = standard(0x111f35, { roughness: 0.49, metalness: 0.15 });
  const coolGlass = standard(0x607ca2, { emissive: 0x7197b5, emissiveIntensity: 0.15 });
  const warmGlass = standard(0xa98448, { emissive: 0xffca72, emissiveIntensity: 0.63 });
  const hotGlass = standard(0x7c371f, { emissive: 0xf56d2f, emissiveIntensity: 0.49 });
  addBox(group, foundation, width + 0.8, 0.18, depth + 0.8, 0, 0.09, 0, true);
  addBox(group, shell, width, height, depth, 0, height / 2 + 0.18, 0, true);
  addBox(group, bands, width + 0.24, 0.23, depth + 0.25, 0, height + 0.19, 0, true);
  addBox(group, foundation, width - 0.36, 0.13, depth - 0.36, 0, height + 0.35, 0, true);
  addBox(group, shell, 1.8, 0.69, 2.1, width * 0.19, height + 0.73, -depth * 0.12, true);
  addBox(group, bands, 2.01, 0.11, 2.28, width * 0.19, height + 1.12, -depth * 0.12);
  addBox(group, sidePanels, 0.13, height - 0.56, depth - 0.12, width / 2 - 0.012, height / 2 + 0.2, 0);
  addBox(group, sidePanels, 0.13, height - 0.56, depth - 0.12, -width / 2 + 0.012, height / 2 + 0.2, 0);

  const batches = new Map();
  const queue = (material, ...data) => {
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(data);
  };

  const step = (height - 1.8) / floors;
  for (let row = 0; row < floors; row++) {
    const y = 2.04 + row * step;
    const front = depth / 2;
    queue(bands, 0, y - 0.98, front + 0.014, width, 0.045, 0.064, 0);
    queue(sidePanels, width / 2 + 0.06, y - 0.98, 0, depth - 0.15, 0.075, 0.067, rad);
    queue(sidePanels, -width / 2 - 0.06, y - 0.98, 0, depth - 0.15, 0.075, 0.067, rad);
    for (let column = 0; column < 4; column++) {
      const slot = (column - 1.5) * (width - 0.83) / 4;
      const burning = fires.has(row + ':' + column);
      const code = (row * 3 + column * 7 + (tower.label === '01' ? 0 : 2)) % 11;
      const glass = burning ? hotGlass : code < 3 ? warmGlass : code === 3 ? coolGlass : darkGlass;
      queue(frame, slot, y, front + 0.048, 1.17, 1.35, 0.104, 0);
      queue(glass, slot, y + 0.024, front + 0.110, 0.99, 1.13, 0.027, 0);
      queue(frame, slot, y + 0.025, front + 0.132, 0.039, 1.13, 0.024, 0);
      queue(bands, slot, y - 0.66, front + 0.085, 1.26, 0.102, 0.205, 0);
      queue(frame, slot, y, -front - 0.05, 1.10, 1.29, 0.13, 0);
      queue(code < 2 ? coolGlass : darkGlass, slot, y, -front - 0.125, 0.92, 1.10, 0.03, 0);
      if (burning) addFlame(group, state, slot, y - 0.58, front + 0.29, state.glows.length, row > floors - 4);
    }
    for (let column = 0; column < 2; column++) {
      const slot = (column - 0.5) * depth * 0.35;
      const glass = (row + column * 3) % 6 === 1 ? warmGlass : darkGlass;
      for (const sign of [-1, 1]) {
        queue(frame, sign * (width / 2 + 0.12), y, slot, 0.90, 1.22, 0.12, rad);
        queue(glass, sign * (width / 2 + 0.19), y, slot, 0.74, 1.02, 0.027, rad);
        queue(sidePanels, sign * (width / 2 + 0.15), y - 0.62, slot, 1.02, 0.104, 0.225, rad);
      }
    }
  }
  for (const sign of [-1, 1]) {
    queue(bands, sign * (width / 2 - 0.19), height / 2 + 0.19, depth / 2 + 0.03, 0.31, height - 0.18, 0.076, 0);
  }
  queue(frame, 0, 0.79, depth / 2 + 0.08, 2.02, 1.33, 0.18, 0);
  queue(darkGlass, 0, 0.79, depth / 2 + 0.184, 1.70, 1.13, 0.04, 0);
  queue(bands, 0, 0.84, depth / 2 + 0.23, 0.066, 1.18, 0.035, 0);
  addBatches(group, batches);

  const signMap = textureFromCanvas(256, 100, (ctx, w, h) => {
    ctx.fillStyle = '#142336';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#74b5d9';
    ctx.fillRect(8, 10, 4, h - 20);
    ctx.fillStyle = '#e4f0f2';
    ctx.font = 'bold 56px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BLOCK ' + tower.label, w / 2 + 4, h / 2, w - 42);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.66), new THREE.MeshBasicMaterial({
    map: signMap, toneMapped: false
  }));
  sign.position.set(-width * 0.31, 0.83, depth / 2 + 0.078);
  group.add(sign);

  const light = new THREE.PointLight(0xff752d, 40, 14, 2);
  light.position.set(0, height * 0.53, depth / 2 + 2.3);
  group.add(light);
  state.lights.push(light);
}

export function createEnvironment(scene) {
  const ground = addGround(scene);
  const state = {
    glowMap: radialTexture([
      [0, 'rgba(255,210,130,0.94)'], [0.22, 'rgba(255,161,59,0.54)'],
      [0.53, 'rgba(255,101,36,0.21)'], [1, 'rgba(255,100,20,0)']
    ]),
    smokeMap: radialTexture([
      [0, 'rgba(255,255,255,0.72)'], [0.30, 'rgba(255,255,255,0.37)'],
      [0.68, 'rgba(255,255,255,0.11)'], [1, 'rgba(255,255,255,0)']
    ]),
    tongues: [], glows: [], smoke: [], lights: []
  };
  for (const tower of TOWERS) addTower(scene, tower, state);
  for (const pad of PAD_SPECS) addPad(scene, pad);
  const flames = new THREE.InstancedMesh(
    flameGeometry(),
    new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    state.tongues.length
  );
  flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  flames.frustumCulled = false;
  scene.add(flames);

  function update(time) {
    state.tongues.forEach(({ tongue, size, phase, speed }, index) => {
      const pulse = Math.sin(time * speed + phase);
      const flicker = Math.sin(time * (speed + 3.2) + phase * 0.4);
      tongue.scale.set(size * (1 - pulse * 0.08), size * (1 + pulse * 0.16 + flicker * 0.06), size);
      tongue.rotation.z = pulse * 0.18 + flicker * 0.055;
      tongue.updateWorldMatrix(true, false);
      flames.setMatrixAt(index, tongue.matrixWorld);
    });
    flames.instanceMatrix.needsUpdate = true;
    for (const { glow, phase } of state.glows) {
      glow.material.opacity = 0.27 + Math.sin(time * 5.0 + phase) * 0.052;
    }
    for (const { sprite, x, y, z, phase, seed } of state.smoke) {
      const progress = (time * (0.14 + (seed % 3) * 0.014) + phase) % 1;
      sprite.position.set(x + progress * (1.6 + Math.sin(seed) * 0.75), y + 1.08 + progress * 5.0, z + 0.3 + progress * 0.9);
      sprite.scale.setScalar(0.92 + progress * 2.23);
      sprite.material.opacity = Math.sin(progress * Math.PI) * 0.38;
      sprite.material.rotation = seed * 1.05 + progress;
    }
    state.lights.forEach((light, index) => {
      light.intensity = 47 + Math.sin(time * 3.8 + index * 1.4) * 5 + Math.sin(time * 9.1) * 3.5;
    });
  }
  update(0);
  return { ground, update };
}
