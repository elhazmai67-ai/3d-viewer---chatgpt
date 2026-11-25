import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const MAX_FILES = 10;
const models = [];
let selectedId = null;
let unit = 'mm';
let renderer, scene, camera, controls, grid, resizeObserver;
let toastTimer;

function toast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function init3D() {
  const stage = $('stage');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080e1a);
  camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100000);
  camera.position.set(150, 130, 180);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xc8ddff, 0x26334b, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(100, 180, 120); key.castShadow = true; scene.add(key);
  const fill = new THREE.DirectionalLight(0x428bff, 1.0); fill.position.set(-120, 60, -80); scene.add(fill);
  grid = new THREE.GridHelper(500, 50, 0x284568, 0x1a2b43); scene.add(grid);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.target.set(0, 15, 0);
  resizeObserver = new ResizeObserver(resizeRenderer); resizeObserver.observe(stage);
  resizeRenderer();
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
}
function resizeRenderer() {
  if (!renderer) return;
  const w = $('stage').clientWidth, h = $('stage').clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
}
function detachSceneModels() {
  for (const item of models) if (item.object) scene.remove(item.object);
}
function disposeAllModels() {
  for (const item of models) if (item.object) {
    scene.remove(item.object);
    item.object.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
  }
}
function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      try {
        const data = reader.result;
        const ext = file.name.toLowerCase().split('.').pop();
        let object;
        if (ext === 'stl') {
          const geometry = new STLLoader().parse(data);
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random() * .18 + .53, .72, .57), metalness: .18, roughness: .48 });
          object = new THREE.Mesh(geometry, material);
        } else if (ext === '3mf') {
          object = new ThreeMFLoader().parse(data);
          object.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
        } else { reject(new Error('Unsupported format')); return; }
        object.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(object);
        if (box.isEmpty()) throw new Error('This file does not contain a visible mesh');
        // STL/3MF print coordinates are normally Z-up; rotate for Three.js Y-up viewing.
        const size = box.getSize(new THREE.Vector3());
        const metrics = measureObject(object);
        object.rotation.x = -Math.PI / 2;
        object.updateMatrixWorld(true);
        const displayBox = new THREE.Box3().setFromObject(object);
        const center = displayBox.getCenter(new THREE.Vector3());
        resolve({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, name: file.name, format: ext.toUpperCase(), bytes: file.size, object, size, center, volume: metrics.volume, triangles: metrics.triangles, vertices: metrics.vertices });
      } catch (e) { reject(e); }
    };
    reader.readAsArrayBuffer(file);
  });
}
function measureObject(root) {
  let triangles = 0, vertices = 0, signedVolume = 0;
  root.updateMatrixWorld(true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  root.traverse(obj => {
    if (!obj.isMesh || !obj.geometry) return;
    const g = obj.geometry, pos = g.getAttribute('position'); if (!pos) return;
    const index = g.index, count = index ? index.count : pos.count;
    triangles += Math.floor(count / 3); vertices += pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const ia = index ? index.getX(i) : i, ib = index ? index.getX(i + 1) : i + 1, ic = index ? index.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, ia).applyMatrix4(obj.matrixWorld);
      b.fromBufferAttribute(pos, ib).applyMatrix4(obj.matrixWorld);
      c.fromBufferAttribute(pos, ic).applyMatrix4(obj.matrixWorld);
      signedVolume += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
    }
  });
  return { triangles, vertices, volume: Math.abs(signedVolume) };
}
function layoutModels() {
  clearSceneModels();
  const n = models.length; if (!n) return;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cell = Math.max(55, ...models.map(m => Math.max(m.size.x, m.size.y, m.size.z) * 1.35));
  const totalW = cols * cell, totalD = rows * cell;
  grid.scale.setScalar(Math.max(1, Math.min(10, cell / 100)));
  models.forEach((m, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    m.object.position.set(col * cell - totalW / 2 + cell / 2 - m.center.x, -m.center.y, row * cell - totalD / 2 + cell / 2 - m.center.z);
    scene.add(m.object);
  });
  fitAll();
}
function fitAll() {
  if (!models.length) return;
  const box = new THREE.Box3();
  models.forEach(m => box.expandByObject(m.object));
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 10);
  const distance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.55;
  camera.position.set(center.x + distance * .8, center.y + distance * .65, center.z + distance);
  camera.near = Math.max(.01, maxDim / 10000); camera.far = maxDim * 100; camera.updateProjectionMatrix();
  controls.target.copy(center); controls.update();
}
function formatSize(bytes) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
function convert(v) { return unit === 'cm' ? v / 10 : unit === 'in' ? v / 25.4 : v; }
function fmt(v) { return convert(v).toFixed(2); }
function renderList() {
  $('fileCount').textContent = models.length; $('modelCount').textContent = models.length;
  $('totalSize').textContent = `${(models.reduce((s,m)=>s+m.bytes,0)/1024/1024).toFixed(2)} MB`;
  $('viewerHint').textContent = models.length ? `${models.length} model${models.length===1?'':'s'} arranged in one 3D scene.` : 'Open up to 10 models to see them arranged together.';
  $('emptyState').style.display = models.length ? 'none' : 'flex';
  $('modelList').innerHTML = models.length ? models.map(m => `
    <article class="model-card ${m.id===selectedId?'active':''}" data-id="${m.id}">
      <div class="model-card-top"><div class="file-icon">⬡</div><div class="file-name" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</div><span class="file-format">${m.format}</span></div>
      <div class="model-meta">${formatSize(m.bytes)} · ${m.triangles.toLocaleString()} triangles<br/>${fmt(m.size.x)} × ${fmt(m.size.y)} × ${fmt(m.size.z)} ${unit}</div>
    </article>`).join('') : '<div class="empty-list">No models loaded yet.</div>';
  document.querySelectorAll('.model-card').forEach(el => el.addEventListener('click', () => { selectedId = el.dataset.id; renderList(); renderDetails(); }));
  $('unitLabel').textContent = unit;
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function renderDetails() {
  const m = models.find(x => x.id === selectedId);
  if (!m) { $('selectedName').textContent = 'Select a model to see detailed information.'; $('detailsGrid').innerHTML = ['WIDTH (X)','DEPTH (Y)','HEIGHT (Z)','VOLUME','TRIANGLES','VERTICES'].map((x,i)=>`<div class="detail-card"><small>${x}</small><b>—</b><span>${['mm','mm','mm','cm³','faces','points'][i]}</span></div>`).join(''); $('weightValue').textContent='— g'; return; }
  $('selectedName').textContent = m.name;
  const vals = [[fmt(m.size.x),unit],[fmt(m.size.y),unit],[fmt(m.size.z),unit],[(m.volume/1000).toFixed(2),'cm³'],[m.triangles.toLocaleString(),'faces'],[m.vertices.toLocaleString(),'points']];
  $('detailsGrid').innerHTML = ['WIDTH (X)','DEPTH (Y)','HEIGHT (Z)','VOLUME','TRIANGLES','VERTICES'].map((x,i)=>`<div class="detail-card"><small>${x}</small><b>${vals[i][0]}</b><span>${vals[i][1]}</span></div>`).join('');
  updateWeight();
}
function updateWeight() {
  const m = models.find(x => x.id === selectedId); if (!m) { $('weightValue').textContent='— g'; return; }
  const density = $('materialSelect').value === 'custom' ? Number($('densityInput').value) : Number($('materialSelect').value);
  const infill = Math.max(1, Math.min(100, Number($('infillInput').value) || 100));
  // This is a rough solid-volume estimate; infill percentage is a simplified multiplier.
  $('weightValue').textContent = `${(m.volume / 1000 * density * infill / 100).toFixed(2)} g`;
}
async function addFiles(fileList) {
  const files = [...fileList].filter(f => /\.(stl|3mf)$/i.test(f.name));
  if (!files.length) { toast('Please choose STL or 3MF files.'); return; }
  const remaining = MAX_FILES - models.length;
  if (remaining <= 0) { toast('Maximum 10 models reached. Clear files to add more.'); return; }
  if (files.length > remaining) toast(`Only ${remaining} more file(s) can be added. Extra files skipped.`);
  for (const file of files.slice(0, remaining)) {
    try {
      toast(`Loading ${file.name}…`);
      const model = await parseFile(file);
      models.push(model); if (!selectedId) selectedId = model.id;
    } catch (e) { toast(`${file.name}: ${e.message || 'Could not load file'}`); }
  }
  layoutModels(); renderList(); renderDetails();
  if (models.length) toast(`${models.length} model(s) loaded successfully.`);
}
$('openBtn').addEventListener('click', () => $('fileInput').click());
$('emptyOpenBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
$('clearBtn').addEventListener('click', () => { disposeAllModels(); models.splice(0); selectedId = null; renderList(); renderDetails(); });
$('fitBtn').addEventListener('click', fitAll);
$('resetBtn').addEventListener('click', () => { controls.reset(); fitAll(); });
$('unitSelect').addEventListener('change', e => { unit = e.target.value; renderList(); renderDetails(); });
$('materialSelect').addEventListener('change', () => { $('customDensityWrap').hidden = $('materialSelect').value !== 'custom'; updateWeight(); });
$('infillInput').addEventListener('input', updateWeight);
$('densityInput').addEventListener('input', updateWeight);
$('stage').addEventListener('dragover', e => { e.preventDefault(); });
$('stage').addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); });
init3D(); renderList(); renderDetails();
