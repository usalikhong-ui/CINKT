import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createAmbulance, createCrew } from './models.js';
import { createEnvironment } from './environment.js';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const surface = $('render-surface');
const status = $('scene-status');
const assetButtons = [...document.querySelectorAll('[data-asset]')];
const viewButtons = [...document.querySelectorAll('[data-view]')];
const canvasBounds = 34;
const buildings = [
  { left: -17.8, right: -8.2, back: -16.9, front: -9.1 },
  { left: 8.7, right: 17.3, back: -18, front: -10 },
];
const assetNames = { ambulance: '救護車', crew: '救護員', officer: '救護隊目' };
const startingItems = [
  ['ambulance', -13, -5.4, 128],
  ['ambulance', 13, -6.4, 231],
  ['ambulance', -3, 13, 180],
  ['ambulance', 3.2, 13, 180],
  ['crew', -7.4, 0.4, 175],
  ['crew', -5.7, 0.4, 187],
  ['crew', -4, 0.4, 180],
  ['crew', -7.4, 2.3, 180],
  ['crew', -5.7, 2.3, 166],
  ['officer', -3, 2.1, 210],
  ['crew', -15.1, -4, 105],
  ['crew', -15.8, -5.6, 140],
  ['crew', 10.9, -4.5, 210],
  ['crew', 9.4, -5.6, 230],
];
const views = {
  overview: { position: [23, 25, 36], target: [0, 2.1, -3.5] },
  top: { position: [0, 49, 0.1], target: [0, 0, 0] },
  street: { position: [17, 4.5, 27], target: [0, 4.3, -8] },
};

let selected = null;
let placement = null;
let items = [];
let nextNumber = {};
let drag = null;
let dragEndedAt = -Infinity;
let cameraTransition = null;

const headingLabel = $('heading-value');
const speedLabel = $('speed-value');
const driveToggle = $('drive-toggle');
const driveLabel = $('drive-label') ?? driveToggle;
const liveCount = $('asset-count');
const objectList = $('object-list');
const pointerStart = new Map();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1629);
scene.fog = new THREE.FogExp2(0x101c34, 0.011);
const camera = new THREE.PerspectiveCamera(44, 1, 0.2, 160);
const models = new THREE.Group();
scene.add(models);
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let renderer;

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
} catch (error) {
  $('webgl-error').hidden = false;
  status.textContent = '瀏覽器未能啟動 3D 場景';
  console.error(error);
}

if (renderer) start();

function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.domElement.setAttribute('aria-label', '3D 救護行動場景');
  renderer.domElement.setAttribute('tabindex', '0');
  surface.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.115;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 7;
  controls.maxDistance = 87;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.88;

  const sky = new THREE.HemisphereLight(0xcfe3ff, 0x516389, 1.9);
  const key = new THREE.DirectionalLight(0xe3eeff, 2.55);
  key.position.set(-21, 38, 14);
  key.castShadow = true;
  const frustum = key.shadow.camera;
  Object.assign(frustum, { left: -33, right: 33, top: 34, bottom: -33, near: 1, far: 94 });
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.00025;
  key.shadow.radius = 2.2;
  const rim = new THREE.DirectionalLight(0x517dd9, 1.0);
  rim.position.set(17, 13, -31);
  scene.add(sky, key, rim);

  const environment = createEnvironment(scene);
  const marker = makeSelectionMarker();
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.61, 40),
    new THREE.MeshBasicMaterial({ color: 0x7cf4d0, depthWrite: false, side: THREE.DoubleSide }),
  );
  reticle.rotation.x = -Math.PI / 2;
  reticle.visible = false;
  scene.add(reticle, marker);
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.hidden = true;
  ghost.setAttribute('aria-hidden', 'true');
  document.body.append(ghost);

  function resize() {
    const { width, height } = surface.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  new ResizeObserver(resize).observe(surface);
  resize();

  function setView(key, instant = false) {
    const view = views[key];
    const target = new THREE.Vector3(...view.target);
    const position = new THREE.Vector3(...view.position);
    const aspect = camera.aspect;
    if (key !== 'street' && aspect < 1.1) {
      position.sub(target).multiplyScalar(Math.min(1.7, 1.1 / Math.max(0.65, aspect))).add(target);
    }
    for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === key));
    if (instant || reduceMotion.matches) {
      cameraTransition = null;
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
      return;
    }
    cameraTransition = {
      time: performance.now(),
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      position,
      target,
    };
  }

  setView('overview', true);
  controls.addEventListener('start', () => {
    cameraTransition = null;
  });
  for (const button of viewButtons) button.addEventListener('click', () => setView(button.dataset.view));

  const modelTemplates = {
    ambulance: createAmbulance({ id: 'A' }),
    crew: createCrew(),
    officer: createCrew({ officer: true }),
  };

  function addItem(kind, x, z, heading, select = true) {
    const serial = nextNumber[kind] = (nextNumber[kind] ?? 0) + 1;
    const item = {
      kind, heading, speed: 4, driving: false,
      model: modelTemplates[kind].clone(true),
    };
    item.name = `${assetNames[kind]} ${String(serial).padStart(2, '0')}`;
    item.wheels = [];
    item.model.traverse((part) => {
      if (part.userData.isWheel) item.wheels.push(part);
    });
    item.model.position.set(x, 0, z);
    orient(item, heading);
    item.model.userData.item = item;
    items.push(item);
    models.add(item.model);
    if (select) {
      choose(item);
      announce(`已加入${item.name}`);
    }
    return item;
  }

  function choose(item) {
    selected = item;
    $('selection-empty').hidden = Boolean(item);
    $('selection-details').hidden = !item;
    marker.visible = Boolean(item);
    if (item) {
      $('selection-name').textContent = item.name;
      $('vehicle-controls').hidden = item.kind !== 'ambulance';
      $('heading').value = item.heading;
      $('speed').value = item.speed;
      refreshInspector();
    }
    refreshObjectList();
  }

  function refreshObjectList() {
    if (liveCount) liveCount.textContent = String(items.length);
    if (!objectList) return;
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'object-row';
      row.textContent = item.name;
      row.setAttribute('aria-pressed', String(item === selected));
      row.addEventListener('click', () => {
        setPlacement(null);
        choose(item);
        objectList.querySelector('[aria-pressed=true]')?.focus({ preventScroll: true });
      });
      fragment.append(row);
    }
    objectList.replaceChildren(fragment);
  }

  function refreshInspector() {
    if (!selected) return;
    headingLabel.textContent = `${selected.heading}°`;
    speedLabel.textContent = `${selected.speed} m/s`;
    driveToggle.setAttribute('aria-pressed', String(selected.driving));
    driveLabel.textContent = selected.driving ? '停止行駛' : '開始行駛';
  }

  function setHeading(value) {
    if (!selected) return;
    orient(selected, value);
    $('heading').value = selected.heading;
    refreshInspector();
  }

  $('heading').addEventListener('input', (event) => setHeading(Number(event.target.value)));
  $('turn-left').addEventListener('click', () => { if (selected) setHeading(selected.heading - 15); });
  $('turn-right').addEventListener('click', () => { if (selected) setHeading(selected.heading + 15); });
  $('speed').addEventListener('input', (event) => {
    if (!selected) return;
    selected.speed = Number(event.target.value);
    refreshInspector();
  });
  driveToggle.addEventListener('click', () => {
    if (selected?.kind !== 'ambulance') return;
    selected.driving = !selected.driving;
    refreshInspector();
    announce(`${selected.name}${selected.driving ? '開始行駛' : '已停車'}`);
  });
  $('remove-object').addEventListener('click', () => {
    if (!selected) return;
    const name = selected.name;
    models.remove(selected.model);
    items = items.filter((item) => item !== selected);
    choose(null);
    announce(`已移除${name}`);
  });

  function reset() {
    models.clear();
    items = [];
    nextNumber = {};
    setPlacement(null);
    for (const [kind, x, z, heading] of startingItems) addItem(kind, x, z, heading, false);
    choose(null);
    setView('overview', true);
  }
  $('reset-scene').addEventListener('click', () => {
    reset();
    announce('已還原短片嘅起始場景');
  });

  function project(clientX, clientY) {
    const rect = surface.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false;
    pointer.set((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    return true;
  }

  function groundPoint(clientX, clientY) {
    if (!project(clientX, clientY)) return null;
    const hit = ray.intersectObject(environment.ground)[0];
    if (!hit) return null;
    return new THREE.Vector3(Math.round(hit.point.x * 2) / 2, 0, Math.round(hit.point.z * 2) / 2);
  }

  function setPlacement(kind) {
    placement = kind;
    if (kind) {
      viewport.dataset.placement = kind;
      announce(`揀選場景位置以放置${assetNames[kind]}，按 Esc 取消`);
    } else {
      delete viewport.dataset.placement;
      reticle.visible = false;
    }
    for (const button of assetButtons) button.setAttribute('aria-pressed', String(button.dataset.asset === kind));
  }

  function canPlace(kind, point) {
    const clearance = kind === 'ambulance' ? 2.65 : 0.45;
    return point && openPosition(point.x, point.z, clearance)
      && !items.some((item) => {
        const at = item.model.position;
        const occupied = item.kind === 'ambulance' ? 1.85 : 0.46;
        return Math.hypot(at.x - point.x, at.z - point.z) < occupied + clearance;
      });
  }

  function place(kind, clientX, clientY) {
    const point = groundPoint(clientX, clientY);
    if (!canPlace(kind, point)) {
      announce('呢個位置放唔到，請揀一個空地');
      return;
    }
    if (items.length >= 48) {
      announce('場景最多可以放 48 個物件');
      return;
    }
    setPlacement(null);
    addItem(kind, point.x, point.z, 180);
  }

  function showDropTarget(kind, clientX, clientY) {
    const point = groundPoint(clientX, clientY);
    reticle.visible = Boolean(point);
    if (point) {
      reticle.position.set(point.x, 0.067, point.z);
      reticle.scale.setScalar(kind === 'ambulance' ? 2.5 : 1);
      reticle.material.color.setHex(canPlace(kind, point) ? 0x7cf4d0 : 0xff736e);
    }
  }

  for (const button of assetButtons) {
    button.style.touchAction = 'none';
    button.addEventListener('click', (event) => {
      if (event.detail && performance.now() - dragEndedAt < 350) return;
      const kind = button.dataset.asset;
      setPlacement(placement === kind ? null : kind);
      if (!placement) {
        announce('已取消放置');
        return;
      }
      const bounds = surface.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
        viewport.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
      }
      renderer.domElement.focus({ preventScroll: true });
    });
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      drag = { id: event.pointerId, type: button.dataset.asset, x: event.clientX, y: event.clientY, moving: false };
      button.setPointerCapture(event.pointerId);
    });
  }

  window.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    if (!drag.moving && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 8) {
      drag.moving = true;
      setPlacement(drag.type);
      ghost.textContent = assetNames[drag.type];
      ghost.hidden = false;
    }
    if (!drag.moving) return;
    ghost.style.transform = `translate(${event.clientX + 15}px, ${event.clientY + 15}px)`;
    showDropTarget(drag.type, event.clientX, event.clientY);
  });
  window.addEventListener('pointerup', (event) => {
    if (drag?.id !== event.pointerId) return;
    const current = drag;
    drag = null;
    ghost.hidden = true;
    if (current.moving) {
      dragEndedAt = performance.now();
      place(current.type, event.clientX, event.clientY);
    }
  });
  window.addEventListener('pointercancel', (event) => {
    if (drag?.id === event.pointerId) {
      drag = null;
      ghost.hidden = true;
      setPlacement(null);
    }
    pointerStart.delete(event.pointerId);
  });

  surface.addEventListener('pointerdown', (event) => {
    if (event.button === 0 && event.isPrimary) pointerStart.set(event.pointerId, [event.clientX, event.clientY]);
  });
  window.addEventListener('pointerup', (event) => {
    const startPoint = pointerStart.get(event.pointerId);
    pointerStart.delete(event.pointerId);
    if (!startPoint || Math.hypot(event.clientX - startPoint[0], event.clientY - startPoint[1]) > 7) return;
    if (placement) {
      place(placement, event.clientX, event.clientY);
      return;
    }
    if (!project(event.clientX, event.clientY)) return;
    for (const hit of ray.intersectObjects(models.children, true)) {
      let part = hit.object;
      while (part && !part.userData.item) part = part.parent;
      if (part) {
        choose(part.userData.item);
        return;
      }
    }
    choose(null);
  });
  surface.addEventListener('pointermove', (event) => {
    if (placement && !drag?.moving) showDropTarget(placement, event.clientX, event.clientY);
  });
  surface.addEventListener('pointerleave', () => { if (!drag?.moving) reticle.visible = false; });
  renderer.domElement.addEventListener('keydown', (event) => {
    if (placement && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const box = surface.getBoundingClientRect();
      place(placement, box.left + box.width / 2, box.top + box.height / 2);
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && placement) {
      setPlacement(null);
      announce('已取消放置');
    }
  });

  reset();
  let lastTime = null;
  renderer.setAnimationLoop((now) => {
    const delta = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (cameraTransition) {
      const fraction = Math.min((now - cameraTransition.time) / 470, 1);
      const blend = 1 - (1 - Math.max(0, fraction)) ** 3;
      camera.position.lerpVectors(cameraTransition.fromPosition, cameraTransition.position, blend);
      controls.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.target, blend);
      if (fraction >= 1) cameraTransition = null;
    }
    controls.update(delta);
    for (const item of items) {
      if (!item.driving) continue;
      const at = item.model.position;
      const direction = THREE.MathUtils.degToRad(item.heading);
      const dx = Math.sin(direction);
      const dz = -Math.cos(direction);
      const step = item.speed * delta;
      const x = at.x + dx * step;
      const z = at.z + dz * step;
      if (![-1.4, 0, 1.7].every((offset) => openPosition(x + dx * offset, z + dz * offset, 1.15))) {
        item.driving = false;
        if (item === selected) refreshInspector();
        announce(`${item.name}遇到建築或場景邊界，已停車`);
        continue;
      }
      at.set(x, 0, z);
      for (const wheel of item.wheels) wheel.rotation.x -= step / 0.39;
    }
    if (selected) {
      marker.position.copy(selected.model.position);
      marker.rotation.y = selected.model.rotation.y;
      marker.scale.set(selected.kind === 'ambulance' ? 1.42 : 0.65, 1, selected.kind === 'ambulance' ? 3.05 : 0.65);
    }
    environment.update(reduceMotion.matches ? 0 : now / 1000);
    renderer.render(scene, camera);
  });
}

function announce(message) {
  status.textContent = message;
}

function orient(item, heading) {
  item.heading = (Math.round(heading) % 360 + 360) % 360;
  item.model.rotation.y = Math.PI - THREE.MathUtils.degToRad(item.heading);
}

function openPosition(x, z, clearance) {
  if (Math.abs(x) + clearance > canvasBounds || Math.abs(z) + clearance > canvasBounds) return false;
  return !buildings.some(({ left, right, back, front }) =>
    x > left - clearance && x < right + clearance && z > back - clearance && z < front + clearance);
}

function makeSelectionMarker() {
  const marker = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0x86ffe6, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 72), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.062;
  const arrow = new THREE.Shape();
  arrow.moveTo(-0.20, -1.025);
  arrow.lineTo(0, -1.22);
  arrow.lineTo(0.20, -1.025);
  arrow.closePath();
  const direction = new THREE.Mesh(new THREE.ShapeGeometry(arrow), material);
  direction.rotation.x = -Math.PI / 2;
  direction.position.y = 0.064;
  marker.add(ring, direction);
  marker.visible = false;
  return marker;
}
