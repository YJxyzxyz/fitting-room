const VIEWER_MODULE_SOURCES = [
  {
    label: 'cdn',
    modules: {
      three: 'https://unpkg.com/three@0.160.0/build/three.module.js',
      controls: 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js',
      gltf: 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js',
    },
  },
  {
    label: 'local',
    modules: {
      three: new URL('./vendor/three/build/three.module.js', import.meta.url).href,
      controls: new URL('./vendor/three/examples/jsm/controls/OrbitControls.js', import.meta.url).href,
      gltf: new URL('./vendor/three/examples/jsm/loaders/GLTFLoader.js', import.meta.url).href,
    },
  },
];

let THREE;
let OrbitControls;
let GLTFLoader;
let viewerLibrariesReady = false;
let viewerDependencyErrors = [];

const viewerDependenciesPromise = loadViewerDependencies();

const API_BASE = window.localStorage.getItem('tryon-api-base') || `${window.location.protocol}//${window.location.hostname}:8000`;
const form = document.getElementById('tryon-form');
const garmentSelect = document.getElementById('garment-select');
const sizeSelect = document.getElementById('size-select');
const colorSelect = document.getElementById('color-select');
const statusBox = document.getElementById('status');
const previewImage = document.getElementById('preview-image');
const metadataBox = document.getElementById('metadata');
const submitButton = form.querySelector('button[type="submit"]');

const FALLBACK_GARMENTS = [
  {
    id: 'tshirt_basic',
    name: 'Essential Crew Tee',
    category: 'top',
    sizes: ['S', 'M', 'L'],
    colorways: [
      { id: 'classic-white', name: 'Classic White', color: '#f6f6f6ff' },
      { id: 'sunset-orange', name: 'Sunset Orange', color: '#f57b42ff' },
    ],
  },
  {
    id: 'hoodie_relaxed',
    name: 'Relaxed Hoodie',
    category: 'outerwear',
    sizes: ['S', 'M', 'L'],
    colorways: [
      { id: 'midnight-blue', name: 'Midnight Blue', color: '#1c2d52ff' },
      { id: 'forest-green', name: 'Forest Green', color: '#2b5d44ff' },
    ],
  },
];

let viewer;
let backendAvailable = true;
let variantsBound = false;

colorSelect.addEventListener('change', syncColorSelectStyle);

async function init() {
  const loadResult = await loadGarments();
  form.addEventListener('submit', onSubmit);
  if (loadResult.remote) {
    setStatus(`Ready. Backend base URL: ${API_BASE}`);
  } else {
    setStatus(`Offline catalogue loaded. Start the backend (${API_BASE}) to enable try-on generation.`);
  }

  viewerDependenciesPromise.then(() => {
    if (!viewerLibrariesReady) {
      showViewerUnavailableNotice(buildViewerUnavailableMessage());
      return;
    }

    try {
      viewer = new TryOnViewer(document.getElementById('viewer-canvas'));
    } catch (error) {
      console.error('Failed to initialise viewer', error);
      viewerDependencyErrors.push({ source: 'initialisation', error });
      showViewerUnavailableNotice('3D preview unavailable (initialisation failed).');
    }
  });
}

async function loadViewerDependencies() {
  for (const source of VIEWER_MODULE_SOURCES) {
    try {
      const [threeModule, controlsModule, gltfModule] = await Promise.all([
        import(source.modules.three),
        import(source.modules.controls),
        import(source.modules.gltf),
      ]);
      THREE = threeModule;
      OrbitControls = controlsModule.OrbitControls;
      GLTFLoader = gltfModule.GLTFLoader;
      viewerLibrariesReady = true;
      viewerDependencyErrors = [];
      console.info(`Loaded viewer dependencies from ${source.label}.`);
      return;
    } catch (error) {
      viewerDependencyErrors.push({ source: source.label, error });
      console.warn(`Failed to load viewer dependencies from ${source.label}`, error);
    }
  }
  viewerLibrariesReady = false;
}

function buildViewerUnavailableMessage() {
  if (!viewerDependencyErrors.length) {
    return '3D preview unavailable. The viewer libraries could not be loaded.';
  }
  const descriptors = viewerDependencyErrors.map(({ source }) => {
    if (source === 'cdn') {
      return 'remote CDN blocked';
    }
    if (source === 'local') {
      return 'local fallback files missing';
    }
    return source;
  });
  const unique = [...new Set(descriptors)];
  const reason = unique.join(', ');
  let suffix = ' Try-on requests remain available.';
  if (unique.includes('local fallback files missing')) {
    suffix += ' Add the Three.js modules to frontend/vendor/three to enable the offline viewer.';
  }
  return `3D preview unavailable (${reason}).${suffix}`;
}

function showViewerUnavailableNotice(message) {
  const container = document.querySelector('.viewer');
  if (!container) {
    console.warn('Viewer container missing, cannot display notice.');
    return;
  }
  const canvas = document.getElementById('viewer-canvas');
  if (canvas) {
    canvas.hidden = true;
  }
  container.classList.add('viewer--unavailable');
  let notice = container.querySelector('.viewer-unavailable');
  if (!notice) {
    notice = document.createElement('div');
    notice.className = 'viewer-unavailable';
    container.appendChild(notice);
  }
  notice.textContent = message;
}

async function loadGarments() {
  let garments = [];
  let remote = false;
  try {
    const response = await fetch(`${API_BASE}/garments`);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    garments = Array.isArray(data.garments) ? data.garments : [];
    if (!garments.length) {
      throw new Error('Empty garment catalogue');
    }
    remote = true;
  } catch (error) {
    console.warn('Falling back to bundled garment catalogue:', error);
    garments = FALLBACK_GARMENTS;
  }
  populateGarments(garments);
  setBackendAvailability(remote);
  return { remote };
}

function populateGarments(garments) {
  garmentSelect.innerHTML = '';
  if (!garments.length) {
    garmentSelect.appendChild(new Option('No garments available', '', true, true));
    garmentSelect.disabled = true;
    sizeSelect.innerHTML = '';
    sizeSelect.disabled = true;
    colorSelect.innerHTML = '';
    colorSelect.disabled = true;
    syncColorSelectStyle();
    return;
  }

  garments.forEach((garment) => {
    const option = document.createElement('option');
    option.value = garment.id;
    option.textContent = `${garment.name} (${garment.category})`;
    option.dataset.sizes = JSON.stringify(garment.sizes || []);
    option.dataset.colorways = JSON.stringify(garment.colorways || []);
    garmentSelect.appendChild(option);
  });
  garmentSelect.disabled = false;
  if (!variantsBound) {
    garmentSelect.addEventListener('change', updateVariantSelectors);
    variantsBound = true;
  }
  garmentSelect.selectedIndex = 0;
  updateVariantSelectors();
}

function updateVariantSelectors() {
  const selected = garmentSelect.options[garmentSelect.selectedIndex];
  const sizes = parseDatasetArray(selected?.dataset.sizes);
  const colors = parseDatasetArray(selected?.dataset.colorways);

  sizeSelect.innerHTML = '';
  const autoOption = new Option('Auto', '', true, true);
  sizeSelect.appendChild(autoOption);
  sizes.forEach((size) => {
    sizeSelect.appendChild(new Option(size, size));
  });
  sizeSelect.disabled = sizes.length === 0;
  sizeSelect.title = sizes.length ? 'Choose a size or keep auto-fit' : 'Sizes auto-calculated by pose';

  colorSelect.innerHTML = '';
  colors.forEach((color) => {
    const option = document.createElement('option');
    option.value = color.id;
    option.textContent = `${color.name}`;
    const cssColor = formatCssColor(color.color);
    const textColor = chooseTextColor(color.color);
    option.dataset.cssColor = cssColor;
    option.dataset.textColor = textColor;
    option.style.background = cssColor;
    option.style.color = textColor;
    option.title = `${color.name} (${color.id})`;
    colorSelect.appendChild(option);
  });
  if (!colors.length) {
    const option = new Option('Default', '', true, true);
    option.dataset.cssColor = '#f8fafc';
    option.dataset.textColor = '#1f2937';
    colorSelect.appendChild(option);
  }
  colorSelect.disabled = !colors.length;
  colorSelect.title = colors.length ? 'Select a colourway' : 'No alternate colourways available';
  colorSelect.selectedIndex = colorSelect.options.length ? 0 : -1;
  syncColorSelectStyle();
}

async function onSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const garmentId = garmentSelect.value;
  if (!garmentId) {
    setStatus('Please select a garment.');
    return;
  }
  if (!backendAvailable) {
    setStatus('Backend offline. Start the API service to submit try-on requests.');
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

function setBackendAvailability(available) {
  backendAvailable = available;
  if (submitButton) {
    submitButton.disabled = !available;
    submitButton.title = available
      ? 'Generate a new try-on preview'
      : `Start the backend API at ${API_BASE} to enable try-on generation.`;
  }
}

function parseDatasetArray(serialized) {
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse option dataset:', error);
    return [];
  }
}

function formatCssColor(input) {
  if (!input || typeof input !== 'string') {
    return '#f8fafc';
  }
  const value = input.trim();
  if (!value.startsWith('#')) {
    return value;
  }
  if (value.length === 7) {
    return value;
  }
  if (value.length === 9) {
    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);
    const a = parseInt(value.slice(7, 9), 16) / 255;
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }
  return value;
}

function parseColorComponents(input) {
  if (!input || typeof input !== 'string') {
    return { r: 248, g: 250, b: 252, a: 1 };
  }
  const value = input.trim();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }
  const rgbaMatch = value.match(/rgba?\(([^)]+)\)/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => parseFloat(part.trim()));
    if (parts.length >= 3) {
      const [r, g, b, a = 1] = parts;
      return { r, g, b, a };
    }
  }
  return { r: 248, g: 250, b: 252, a: 1 };
}

function chooseTextColor(input) {
  const { r, g, b } = parseColorComponents(input);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? '#1f2937' : '#f8fafc';
}

function syncColorSelectStyle() {
  const option = colorSelect.options[colorSelect.selectedIndex];
  if (!option) {
    colorSelect.style.background = '';
    colorSelect.style.color = '';
    return;
  }
  const cssColor = option.dataset.cssColor || option.style.backgroundColor || '#f8fafc';
  const textColor = option.dataset.textColor || '#1f2937';
  colorSelect.style.background = cssColor;
  colorSelect.style.color = textColor;
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
init().catch((error) => {
  console.error('Failed to initialise interface', error);
  setStatus(`Initialisation failed: ${error.message}`);
});
