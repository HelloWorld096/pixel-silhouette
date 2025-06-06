// GLOBAL VARIABLES
let cropper = null;
let croppedImageDataURL = null;
let canvasSize = 300;
let iconMaxSize = 150;
let tolerance = 0;
let activeCropperThemeIndex = -1; // global instead of localStorage

// DOM ELEMENTS
const fileInput        = document.getElementById('fileInput');
const imageToCrop      = document.getElementById('imageToCrop');
const applyCropBtn     = document.getElementById('applyCropBtn');
const toleranceSlider  = document.getElementById('toleranceSlider');
const tolValueSpan     = document.getElementById('tolValue');
const canvasSizeInput  = document.getElementById('canvasSizeInput');
const iconMaxSizeInput = document.getElementById('iconMaxSizeInput');
const previewCanvas    = document.getElementById('previewCanvas');
const downloadBtn      = document.getElementById('downloadBtn');
const startOverBtn     = document.getElementById('startOverBtn');
const previewCtx       = previewCanvas.getContext('2d');

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const step4 = document.getElementById('step4');
const cropContainer    = document.querySelector('.crop-container');

const addThemeBtn      = document.getElementById('addThemeBtn');
const themeSamples     = document.getElementById('themeSamples');
const presetContainer  = document.getElementById('presetThemes');
const themeModal       = document.getElementById('themeModal');
const themeModalClose  = document.getElementById('themeModalClose');
const themeModalCancel = document.getElementById('themeModalCancel');
const themeModalSave   = document.getElementById('themeModalSave');
const bgColorsInput    = document.getElementById('bgColorsInput');
const handleColorInput = document.getElementById('handleColorInput');

// PRESET THEMES
const PRESET_THEMES = [
  { light: '#ffffff', dark: '#ffffff', handle: '#000000' },
  { light: '#ffffff', dark: '#e5e5e5', handle: '#000000' },
  { light: '#e5e5e5', dark: '#cccccc', handle: '#000000' },
  { light: '#666666', dark: '#444444', handle: '#ffffff' },
  { light: '#000000', dark: '#000000', handle: '#ffffff' }
];

// UTILITY FUNCTIONS
function setColor(lightColor, darkColor) {
  const bgEl = document.querySelector('.cropper-bg');
  if (!bgEl) return;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
  <rect width="8" height="8" fill="${lightColor}"/>
  <rect x="8" width="8" height="8" fill="${darkColor}"/>
  <rect y="8" width="8" height="8" fill="${darkColor}"/>
  <rect x="8" y="8" width="8" height="8" fill="${lightColor}"/>
</svg>`.trim();
  const encoded = encodeURIComponent(svg);
  bgEl.style.backgroundImage = `url("data:image/svg+xml,${encoded}")`;
  bgEl.style.backgroundSize = '20px 20px';
  bgEl.style.backgroundPosition = '0 0, 10px 10px';
}

function cropperColor(color) {
  document.querySelectorAll('.cropper-point').forEach(pt => {
    pt.style.backgroundColor = color;
  });
  document.querySelectorAll('.cropper-view-box').forEach(vb => {
    vb.style.outline = `1px solid ${color}`;
    vb.style.borderColor = color;
  });
}

function getThemesFromStorage() {
  const raw = localStorage.getItem('cropperThemes');
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveThemesToStorage(arr) {
  localStorage.setItem('cropperThemes', JSON.stringify(arr));
}

function addThemeToStorage(themeObj) {
  const arr = getThemesFromStorage();
  arr.push(themeObj);
  if (arr.length > 10) arr.shift();
  saveThemesToStorage(arr);
}

function getActiveThemeIndex() {
  return activeCropperThemeIndex;
}

function setActiveThemeIndex(idx) {
  activeCropperThemeIndex = idx;
}

function parseBgInput(raw) {
  const parts = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
  if (parts.length === 0) return null;
  if (parts.length === 1) return [parts[0], parts[0]];
  return [parts[0], parts[1]];
}

function applyTheme(light, dark, handle) {
  document.documentElement.style.setProperty('--bg-light', light);
  document.documentElement.style.setProperty('--bg-dark', dark);
  document.documentElement.style.setProperty('--handle-color', handle);
  setColor(light, dark);
  cropperColor(handle);
}

// RENDER PRESET THEMES
function renderPresetThemes() {
  const rootStyle = getComputedStyle(document.documentElement);
  const liveLight  = rootStyle.getPropertyValue('--bg-light').trim();
  const liveDark   = rootStyle.getPropertyValue('--bg-dark').trim();
  const liveHandle = rootStyle.getPropertyValue('--handle-color').trim();

  presetContainer.innerHTML = '';
  PRESET_THEMES.forEach((theme, idx) => {
    const wrapper = document.createElement('div');
    wrapper.classList.add(
      'w-12', 'h-12',
      'relative', 'rounded', 'cursor-pointer',
      'border', 'border-gray-300',
      'flex', 'items-center', 'justify-center',
      'transition-colors'
    );
    wrapper.title = `Preset #${idx + 1}: BG (${theme.light}, ${theme.dark}) → Handle (${theme.handle})`;

    if (
      theme.light === liveLight &&
      theme.dark === liveDark &&
      theme.handle === liveHandle
    ) {
      wrapper.classList.add('ring-2', 'ring-offset-1', 'ring-blue-500');
    }

    if (theme.light === theme.dark) {
      wrapper.style.backgroundColor = theme.light;
    } else {
      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
  <rect width="8" height="8" fill="${theme.light}"/>
  <rect x="8" width="8" height="8" fill="${theme.dark}"/>
  <rect y="8" width="8" height="8" fill="${theme.dark}"/>
  <rect x="8" y="8" width="8" height="8" fill="${theme.light}"/>
</svg>`.trim();
      const encoded = encodeURIComponent(svg);
      wrapper.style.backgroundImage = `url("data:image/svg+xml,${encoded}")`;
      wrapper.style.backgroundSize = '16px 16px';
      wrapper.style.backgroundPosition = '0 0, 8px 8px';
    }

    const sampleText = document.createElement('span');
    sampleText.textContent = '| |';
    sampleText.style.color = theme.handle;
    wrapper.appendChild(sampleText);

    const borderOverlay = document.createElement('div');
    borderOverlay.classList.add('absolute', 'inset-0', 'rounded', 'pointer-events-none');
    borderOverlay.style.border = `2px solid ${theme.handle}`;
    wrapper.appendChild(borderOverlay);

    wrapper.addEventListener('click', () => {
      applyTheme(theme.light, theme.dark, theme.handle);
      activeCropperThemeIndex = -1; // clear custom index when preset chosen
      renderPresetThemes();
      renderThemeSamples();
    });

    presetContainer.appendChild(wrapper);
  });
}

// RENDER USER-DEFINED THEMES
function renderThemeSamples() {
  const arr = getThemesFromStorage();
  const rootStyle = getComputedStyle(document.documentElement);
  const liveLight  = rootStyle.getPropertyValue('--bg-light').trim();
  const liveDark   = rootStyle.getPropertyValue('--bg-dark').trim();
  const liveHandle = rootStyle.getPropertyValue('--handle-color').trim();

  themeSamples.innerHTML = '';
  const reversed = arr.map((t, i) => ({ theme: t, index: i })).reverse();
  reversed.forEach(({ theme, index }) => {
    const wrapper = document.createElement('div');
    wrapper.classList.add(
      'w-12', 'h-12',
      'relative', 'rounded', 'cursor-pointer',
      'border', 'border-gray-300',
      'flex', 'items-center', 'justify-center',
      'transition-colors'
    );
    wrapper.title = `BG (${theme.light}, ${theme.dark}) → Handle (${theme.handle})`;

    if (
      theme.light === liveLight &&
      theme.dark === liveDark &&
      theme.handle === liveHandle
    ) {
      wrapper.classList.add('ring-2', 'ring-offset-1', 'ring-blue-500');
    }

    if (theme.light === theme.dark) {
      wrapper.style.backgroundColor = theme.light;
    } else {
      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
  <rect width="8" height="8" fill="${theme.light}"/>
  <rect x="8" width="8" height="8" fill="${theme.dark}"/>
  <rect y="8" width="8" height="8" fill="${theme.dark}"/>
  <rect x="8" y="8" width="8" height="8" fill="${theme.light}"/>
</svg>`.trim();
      const encoded = encodeURIComponent(svg);
      wrapper.style.backgroundImage = `url("data:image/svg+xml,${encoded}")`;
      wrapper.style.backgroundSize = '16px 16px';
      wrapper.style.backgroundPosition = '0 0, 8px 8px';
    }

    const sampleText = document.createElement('span');
    sampleText.textContent = '| |';
    sampleText.style.color = theme.handle;
    wrapper.appendChild(sampleText);

    const borderOverlay = document.createElement('div');
    borderOverlay.classList.add('absolute', 'inset-0', 'rounded', 'pointer-events-none');
    borderOverlay.style.border = `2px solid ${theme.handle}`;
    wrapper.appendChild(borderOverlay);

    wrapper.addEventListener('click', () => {
      applyTheme(theme.light, theme.dark, theme.handle);
      setActiveThemeIndex(index);
      renderThemeSamples();
      renderPresetThemes();
    });

    themeSamples.appendChild(wrapper);
  });
}

// IMAGE TO BLACK SILHOUETTE
function imageToBlackSilhouette(imgElement) {
  const w = imgElement.naturalWidth;
  const h = imgElement.naturalHeight;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const offCtx = off.getContext('2d');

  offCtx.drawImage(imgElement, 0, 0);
  const imgData = offCtx.getImageData(0, 0, w, h);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
    if (a === 0) continue;
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    d[i + 3] = brightness >= 255 - tolerance ? 0 : 255;
  }
  offCtx.putImageData(imgData, 0, 0);

  offCtx.globalCompositeOperation = 'source-in';
  offCtx.fillStyle = '#000';
  offCtx.fillRect(0, 0, w, h);
  offCtx.globalCompositeOperation = 'source-over';

  return off;
}

// RENDER PREVIEW CANVAS
function renderPreview() {
  if (!croppedImageDataURL) return;
  const tempImg = new Image();
  tempImg.onload = () => {
    const silCanvas = imageToBlackSilhouette(tempImg);
    const w0 = silCanvas.width;
    const h0 = silCanvas.height;

    const scaleToIcon = Math.min(iconMaxSize / w0, iconMaxSize / h0, 1);
    const scaleToCanvas = Math.min(canvasSize / w0, canvasSize / h0, 1);
    const ratio = Math.min(scaleToIcon, scaleToCanvas);

    const targetW = Math.round(w0 * ratio);
    const targetH = Math.round(h0 * ratio);

    previewCtx.clearRect(0, 0, canvasSize, canvasSize);
    previewCtx.fillStyle = '#fff';
    previewCtx.fillRect(0, 0, canvasSize, canvasSize);

    const offsetX = Math.round((canvasSize - targetW) / 2);
    const offsetY = Math.round((canvasSize - targetH) / 2);

    previewCtx.drawImage(
      silCanvas,
      0, 0, w0, h0,
      offsetX, offsetY,
      targetW, targetH
    );
  };
  tempImg.src = croppedImageDataURL;
}

// INITIAL SETUP
document.addEventListener('DOMContentLoaded', () => {
  const savedCanvasSize = sessionStorage.getItem('canvasSize');
  const savedIconMaxSize = sessionStorage.getItem('iconMaxSize');

  if (savedCanvasSize !== null) {
    const parsed = parseInt(savedCanvasSize, 10);
    if (!isNaN(parsed)) {
      canvasSize = parsed;
      canvasSizeInput.value = parsed;
    }
  }
  if (savedIconMaxSize !== null) {
    const parsed = parseInt(savedIconMaxSize, 10);
    if (!isNaN(parsed)) {
      iconMaxSize = parsed;
      iconMaxSizeInput.value = parsed;
    }
  }

  previewCanvas.width = canvasSize;
  previewCanvas.height = canvasSize;
  previewCtx.fillStyle = '#fff';
  previewCtx.fillRect(0, 0, canvasSize, canvasSize);

  renderPresetThemes();
  renderThemeSamples();
});

// FILE UPLOAD & CROPPER INITIALIZATION
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  applyCropBtn.disabled = true;

  const reader = new FileReader();
  reader.onload = () => {
    imageToCrop.src = reader.result;
    imageToCrop.onload = () => {
      step1.classList.add('hidden');
      step2.classList.remove('hidden');

      cropper = new Cropper(imageToCrop, {
        viewMode: 1,
        autoCropArea: 1,
        movable: true,
        zoomable: true,
        aspectRatio: NaN,
        background: true
      });

      applyCropBtn.disabled = false;
    };
  };
  reader.readAsDataURL(file);
});

// APPLY CROP
applyCropBtn.addEventListener('click', () => {
  if (!cropper) return;
  const croppedCanvas = cropper.getCroppedCanvas();
  croppedImageDataURL = croppedCanvas.toDataURL('image/png');

  cropper.destroy();
  cropper = null;

  step2.classList.add('hidden');
  step3.classList.remove('hidden');
  step4.classList.remove('hidden');
  downloadBtn.classList.remove('hidden');
  startOverBtn.classList.remove('hidden');

  previewCanvas.width = canvasSize;
  previewCanvas.height = canvasSize;
  renderPreview();
});

// TOLERANCE SLIDER
toleranceSlider.addEventListener('input', (e) => {
  tolerance = +e.target.value;
  tolValueSpan.textContent = tolerance;
  renderPreview();
});

// CANVAS & ICON SIZE INPUTS
canvasSizeInput.addEventListener('input', (e) => {
  canvasSize = Math.max(50, Math.min(1024, +e.target.value || 300));
  sessionStorage.setItem('canvasSize', canvasSize.toString());
  previewCanvas.width = canvasSize;
  previewCanvas.height = canvasSize;
  renderPreview();
});

iconMaxSizeInput.addEventListener('input', (e) => {
  iconMaxSize = Math.max(10, Math.min(512, +e.target.value || 150));
  sessionStorage.setItem('iconMaxSize', iconMaxSize.toString());
  renderPreview();
});

// DOWNLOAD BUTTON
downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'icon.png';
  link.href = previewCanvas.toDataURL('image/png');
  link.click();
});

// START OVER BUTTON
startOverBtn.addEventListener('click', () => {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  croppedImageDataURL = null;
  fileInput.value = '';

  step1.classList.remove('hidden');
  step2.classList.add('hidden');
  step3.classList.add('hidden');
  step4.classList.add('hidden');
  downloadBtn.classList.add('hidden');
  startOverBtn.classList.add('hidden');

  previewCtx.clearRect(0, 0, canvasSize, canvasSize);
  previewCtx.fillStyle = '#fff';
  previewCtx.fillRect(0, 0, canvasSize, canvasSize);
});

// THEME MODAL HANDLERS
addThemeBtn.addEventListener('click', () => {
  bgColorsInput.value = '';
  handleColorInput.value = '';
  themeModal.classList.remove('hidden');
});

themeModalClose.addEventListener('click', () => {
  themeModal.classList.add('hidden');
});

themeModalCancel.addEventListener('click', (e) => {
  e.preventDefault();
  themeModal.classList.add('hidden');
});

themeModal.addEventListener('click', (e) => {
  if (e.target === themeModal) {
    themeModal.classList.add('hidden');
  }
});

themeModalSave.addEventListener('click', (e) => {
  e.preventDefault();
  const rawBg = bgColorsInput.value.trim();
  const rawHandle = handleColorInput.value.trim();
  if (!rawBg) {
    alert('Please enter at least one background color.');
    return;
  }
  if (!rawHandle) {
    alert('Please enter a color for the cropper handles.');
    return;
  }
  const bgArr = parseBgInput(rawBg);
  if (!bgArr) {
    alert('Invalid background input. Use “#fff” or “#fff,#eee”.');
    return;
  }
  const [lightColor, darkColor] = bgArr;
  const handleColor = rawHandle;

  applyTheme(lightColor, darkColor, handleColor);
  addThemeToStorage({ light: lightColor, dark: darkColor, handle: handleColor });
  const newIdx = getThemesFromStorage().length - 1;
  setActiveThemeIndex(newIdx);
  renderThemeSamples();
  themeModal.classList.add('hidden');
});
