import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

const API_BASE = window.localStorage.getItem('tryon-api-base') || `${window.location.protocol}//${window.location.hostname}:8000`;
const form = document.getElementById('tryon-form');
const garmentSelect = document.getElementById('garment-select');
const sizeSelect = document.getElementById('size-select');
const colorSelect = document.getElementById('color-select');
const statusBox = document.getElementById('status');
const previewImage = document.getElementById('preview-image');
const metadataBox = document.getElementById('metadata');

let viewer;

async function init() {
  await loadGarments();
  viewer = new TryOnViewer(document.getElementById('viewer-canvas'));
  form.addEventListener('submit', onSubmit);
  setStatus(`Ready. Backend base URL: ${API_BASE}`);
}

async function loadGarments() {
  try {
    const response = await fetch(`${API_BASE}/garments`);
    const data = await response.json();
    garmentSelect.innerHTML = '';
    data.garments.forEach((garment) => {
      const option = document.createElement('option');
      option.value = garment.id;
      option.textContent = `${garment.name} (${garment.category})`;
      option.dataset.sizes = JSON.stringify(garment.sizes);
      option.dataset.colorways = JSON.stringify(garment.colorways);
      garmentSelect.appendChild(option);
    });
    garmentSelect.addEventListener('change', updateVariantSelectors);
    updateVariantSelectors();
  } catch (error) {
    setStatus(`Failed to load garments: ${error}`);
  }
}

function updateVariantSelectors() {
  const selected = garmentSelect.options[garmentSelect.selectedIndex];
  const sizes = JSON.parse(selected?.dataset.sizes || '[]');
  const colors = JSON.parse(selected?.dataset.colorways || '[]');
  sizeSelect.innerHTML = '';
  colorSelect.innerHTML = '';
  colors.forEach((color) => {
    const option = document.createElement('option');
    option.value = color.id;
    option.textContent = `${color.name}`;
    option.style.background = color.color;
    colorSelect.appendChild(option);
  });
  if (!colors.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Default';
    colorSelect.appendChild(option);
  }
  sizeSelect.appendChild(new Option('Auto', '', true, true));
  sizes.forEach((size) => {
    sizeSelect.appendChild(new Option(size, size));
  });
}

async function onSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const garmentId = garmentSelect.value;
  if (!garmentId) {
    setStatus('Please select a garment.');
    return;
  }
  setStatus('Uploading request…');
  try {
    const response = await fetch(`${API_BASE}/tryon`, {
      method: 'POST',
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || 'Request failed');
    }
    await pollResult(payload.task_id);
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message}`);
  }
}

async function pollResult(taskId) {
  setStatus('Processing…');
  while (true) {
    await wait(1200);
    const response = await fetch(`${API_BASE}/result/${taskId}`);
    const data = await response.json();
    if (data.status === 'failed') {
      throw new Error(data.error || 'Pipeline failed');
    }
    if (data.status === 'done') {
      setStatus('Completed!');
      updateOutputs(data);
      break;
    }
    setStatus(`Task ${taskId} — ${data.status}…`);
  }
}

function updateOutputs(data) {
  if (data.preview_url) {
    previewImage.src = absoluteUrl(data.preview_url);
  }
  if (data.metadata) {
    metadataBox.textContent = JSON.stringify(data.metadata, null, 2);
  }
  if (data.model_url && viewer) {
    viewer.loadModel(absoluteUrl(data.model_url));
  }
}

function absoluteUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function setStatus(message) {
  statusBox.textContent = message;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TryOnViewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f172a');
    this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 50);
    this.camera.position.set(0, 1.4, 4);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);
    const ambient = new THREE.AmbientLight('#e0f2fe', 0.6);
    const directional = new THREE.DirectionalLight('#ffffff', 0.9);
    directional.position.set(2, 3, 2);
    this.scene.add(ambient, directional);
    this.loader = new GLTFLoader();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.animate();
  }

  loadModel(url) {
    this.loader.load(url, (gltf) => {
      if (this.current) {
        this.scene.remove(this.current);
      }
      this.current = gltf.scene;
      this.scene.add(gltf.scene);
      this.fitCamera(gltf.scene);
    }, undefined, (error) => {
      console.error('Failed to load model', error);
      setStatus(`Could not load model: ${error.message}`);
    });
  }

  fitCamera(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 1.6 / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(center.x, center.y + maxDim * 0.2, distance + center.z);
    this.controls.target.copy(center);
    this.controls.update();
  }

  resize() {
    const width = this.canvas.clientWidth || this.canvas.parentElement.clientWidth;
    const height = this.canvas.clientHeight || this.canvas.parentElement.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

init();
