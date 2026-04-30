// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from "firebase/firestore";

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCXwtwZLkRK9lmNh0JMkPWJPmcYUaFiYLo",
  authDomain: "geoportal-afectaciones.firebaseapp.com",
  projectId: "geoportal-afectaciones",
  storageBucket: "geoportal-afectaciones.firebasestorage.app",
  messagingSenderId: "402384431919",
  appId: "1:402384431919:web:081b741776779ef4b08fda",
  measurementId: "G-DLN2G60MCS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const pinsCollection = collection(db, "pins");

// --- GALERÍA DE GIFS LOCALES (Se mantiene local) ---
const LOCAL_GIFS = [
  "gifs/G_2_3_4.gif", "gifs/G1.gif", "gifs/G5.gif", "gifs/G6.gif", "gifs/G9.gif",
  "gifs/G10.gif", "gifs/G11.gif", "gifs/G12.gif", "gifs/G13.gif", "gifs/G14.gif",
  "gifs/G15.gif", "gifs/G16.gif", "gifs/G18.gif", "gifs/G19.gif", "gifs/G20.gif",
  "gifs/G21.gif", "gifs/G22.gif", "gifs/G23.gif", "gifs/G24.gif", "gifs/G25.gif",
  "gifs/G26.gif", "gifs/G27.gif", "gifs/G28.gif", "gifs/G29.gif", "gifs/G30.gif",
  "gifs/G31.gif", "gifs/G32.gif", "gifs/G33.gif", "gifs/G34.gif", "gifs/G35.gif",
  "gifs/G36.gif", "gifs/G37.gif", "gifs/G38.gif", "gifs/G39.gif", "gifs/G40.gif",
  "gifs/G41.gif", "gifs/G42.gif", "gifs/G43.gif", "gifs/G44.gif", "gifs/G45.gif",
  "gifs/G46.gif", "gifs/G47.gif", "gifs/G48.gif", "gifs/G49.gif", "gifs/G50.gif",
  "gifs/G51.gif", "gifs/G52.gif", "gifs/G52_1.gif", "gifs/G53.gif", "gifs/G54.gif",
  "gifs/G55.gif", "gifs/G56.gif", "gifs/G57.gif", "gifs/G58.gif", "gifs/G59.gif",
  "gifs/G60.gif", "gifs/G61.gif", "gifs/G62.gif", "gifs/G63.gif", "gifs/G64.gif",
  "gifs/G65.gif", "gifs/G66.gif", "gifs/G67.gif",
];

const UPLOADED_GIFS_KEY = "uploaded-gifs-v1";

// --- ELEMENTOS DEL DOM ---
const statusText = document.getElementById("status-text");
const metricTotal = document.getElementById("metric-total");
const clasificaList = document.getElementById("clasifica-list");
const muniList = document.getElementById("muni-list");
const muniSearch = document.getElementById("muni-search");
const btnReload = document.getElementById("btn-reload");
const btnClearFilters = document.getElementById("btn-clear-filters");
const btnFit = document.getElementById("btn-fit");
const btnPanelToggle = document.getElementById("btn-panel-toggle");
const filterPanel = document.getElementById("filter-panel");
const pinSelectedCount = document.getElementById("pin-selected-count");
const pinTitleInput = document.getElementById("pin-title");
const pinDescriptionInput = document.getElementById("pin-description");
const gifUrlInput = document.getElementById("gif-url");
const btnPlaceGifPin = document.getElementById("btn-place-gif-pin");
const btnClearPinSelection = document.getElementById("btn-clear-pin-selection");
const btnClearAllPins = document.getElementById("btn-clear-all-pins");
const toggleGifPinsInput = document.getElementById("toggle-gif-pins");
const editorFeedback = document.getElementById("editor-feedback");
const gifEditorCard = document.querySelector(".editor-gif-card");
const editModeSwitch = document.getElementById("edit-mode-switch");
const editModeSwitchLabel = document.getElementById("edit-mode-switch-label");
const saveToast = document.getElementById("save-toast");
const videoModal = document.getElementById("video-modal");
const videoModalClose = document.getElementById("video-modal-close");
const viaductoVideo = document.getElementById("viaducto-video");
const gifModal = document.getElementById("gif-modal");
const gifModalClose = document.getElementById("gif-modal-close");
const afectacionGif = document.getElementById("afectacion-gif");
const gifModalTitle = document.getElementById("gif-modal-title");

// --- VARIABLES GLOBALES ---
const AFECT_META_STORAGE_KEY = "afect-meta-v1";
const afectacionCatalog = new Map();
const afectacionFeatureIndex = new Map();
let selectedAfectacionesForPin = new Set();
let pinSelectionMode = false;
let gifPins = []; // Se llenará desde Firestore
let pendingPinDraft = null;
let gifPinLayer = L.layerGroup();
let gifPinLinksLayer = L.layerGroup();
let showGifPins = true;

let currentLayer = null;
let troncalLayer = null;
let municipioBoundaryLayer = null;
let sourceFeatureCollection = null;
let selectedMunicipio = null;
const selectedClasificaciones = new Set();
let pointAnimationFrameId = null;
const municipioBoundaryIndex = new Map();
let municipioSearchTerm = "";
let allMunicipioCounts = {};
const CLUSTER_THRESHOLD = 140;
let lastFilteredFeatures = [];
let layerControl;

// --- CONFIGURACIÓN BASE LEAFLET ---
const map = L.map("map", { zoomControl: true }).setView([20.67, -103.35], 8);

// Capas y Panes
map.createPane("troncalPane");
map.getPane("troncalPane").style.zIndex = 350;
map.getPane("troncalPane").style.pointerEvents = "none";
map.createPane("afectacionesPane");
map.getPane("afectacionesPane").style.zIndex = 420;
map.createPane("boundaryPane");
map.getPane("boundaryPane").style.zIndex = 430;
map.createPane("gifLinksPane");
map.getPane("gifLinksPane").style.zIndex = 395;
map.createPane("poiPane");
map.getPane("poiPane").style.zIndex = 405;

const svgRenderer = L.svg({ padding: 0.5 });
const baseOSM = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OSM" }).addTo(map);
const baseImagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Esri" });
const baseLayers = { "Calles": baseOSM, "Satélite": baseImagery };

layerControl = L.control.layers(baseLayers, {}, { collapsed: true }).addTo(map);
gifPinLayer.addTo(map);
gifPinLinksLayer.addTo(map);

// --- LÓGICA DE FIRESTORE (Sustituye LocalStorage) ---

function subscribeToCloudPins() {
  const q = query(pinsCollection);
  onSnapshot(q, (snapshot) => {
    gifPins = [];
    snapshot.forEach((doc) => {
      gifPins.push({ firestoreId: doc.id, ...doc.data() });
    });
    renderGifPinsAndLinks();
    updateSummary(lastFilteredFeatures);
  });
}

async function savePinToCloud(pinData) {
  try {
    await addDoc(pinsCollection, pinData);
    showEditorFeedback("Pin guardado en la nube.", "ok");
  } catch (err) {
    console.error(err);
    showEditorFeedback("Error al guardar en nube.", "warn");
  }
}

async function deletePinFromCloud(id) {
  try {
    await deleteDoc(doc(db, "pins", id));
    showEditorFeedback("Pin eliminado.", "warn");
  } catch (err) { console.error(err); }
}

// --- FUNCIONES DE GALERÍA DE GIFS (LocalStorage) ---

function loadUploadedGifs() {
  try {
    const raw = localStorage.getItem(UPLOADED_GIFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveUploadedGifs(list) {
  localStorage.setItem(UPLOADED_GIFS_KEY, JSON.stringify(list));
}

function addGifThumbToGallery(gallery, gifData, isUploaded = false) {
  const wrap = document.createElement("div");
  wrap.className = "gif-thumb-wrap";
  const img = document.createElement("img");
  img.src = gifData.url;
  img.className = "gif-thumb-img";
  img.style.cssText = "width:64px;height:64px;object-fit:cover;cursor:pointer;border:2px solid #e0e0e0;border-radius:8px;";
  
  img.addEventListener("click", () => {
    if (gifUrlInput) gifUrlInput.value = gifData.url;
    gallery.querySelectorAll("img").forEach(el => el.style.border = "2px solid #e0e0e0");
    img.style.border = "2px solid #0c5f73";
  });

  wrap.appendChild(img);
  if (isUploaded) {
    const del = document.createElement("button");
    del.textContent = "✕";
    del.className = "btn-del-gif";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      const list = loadUploadedGifs().filter(g => g.name !== gifData.name);
      saveUploadedGifs(list);
      wrap.remove();
    });
    wrap.appendChild(del);
  }
  gallery.appendChild(wrap);
}

function renderLocalGifGallery() {
  const gallery = document.getElementById("local-gif-gallery");
  if (!gallery) return;
  gallery.innerHTML = "";
  LOCAL_GIFS.forEach(path => addGifThumbToGallery(gallery, { url: path, name: path.split("/").pop() }));
  loadUploadedGifs().forEach(data => addGifThumbToGallery(gallery, data, true));
}

// --- LÓGICA DE MAPA Y FILTROS ---

function buildAfectacionKey(props) {
  return props._afect_key || props._afect_uid || `cve:${props.cve_geo}`;
}

function renderGifPinsAndLinks() {
  gifPinLayer.clearLayers();
  gifPinLinksLayer.clearLayers();
  if (!showGifPins) return;

  const isSatellite = map.hasLayer(baseImagery);
  const linkColor = isSatellite ? "#ffffff" : "#0c5f73";

  gifPins.forEach(pin => {
    const marker = L.marker([pin.lat, pin.lng], {
      pane: "poiPane",
      icon: L.divIcon({
        className: "gif-pin-wrap",
        html: `<div class="gif-pin-icon">GIF</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    });

    marker.on("click", () => openGifModal(pin.gifUrl, { nom_mun: pin.title }));
    marker.on("contextmenu", (e) => {
      L.DomEvent.stopPropagation(e);
      if (pinSelectionMode && confirm("¿Borrar este pin de la nube?")) {
        deletePinFromCloud(pin.firestoreId);
      }
    });

    marker.addTo(gifPinLayer);

    (pin.afectKeys || []).forEach(key => {
      const feat = afectacionFeatureIndex.get(key);
      if (feat) {
        const center = getFeatureCenter(feat);
        if (center) {
          L.polyline([[pin.lat, pin.lng], [center.lat, center.lng]], {
            pane: "gifLinksPane",
            color: linkColor,
            weight: 2,
            opacity: 0.5,
            dashArray: "5, 5"
          }).addTo(gifPinLinksLayer);
        }
      }
    });
  });
}

function getFeatureCenter(feature) {
  if (feature.geometry.type === "Point") {
    const [lng, lat] = feature.geometry.coordinates;
    return L.latLng(lat, lng);
  }
  const bounds = L.geoJSON(feature).getBounds();
  return bounds.isValid() ? bounds.getCenter() : null;
}

async function placePendingPinAtLatLng(latlng) {
  if (!pendingPinDraft || !latlng) return;

  const newPin = {
    lat: latlng.lat,
    lng: latlng.lng,
    gifUrl: pendingPinDraft.gifUrl,
    title: pendingPinDraft.title,
    description: pendingPinDraft.description,
    afectKeys: pendingPinDraft.afectKeys,
    createdAt: Date.now()
  };

  await savePinToCloud(newPin);
  pendingPinDraft = null;
  selectedAfectacionesForPin.clear();
  updatePinSelectionUi();
  renderCurrentLayer(lastFilteredFeatures, { skipFit: true });
}

function handleAfectacionLayerClick(layer, props, event) {
  const key = buildAfectacionKey(props);
  if (pendingPinDraft) {
    placePendingPinAtLatLng(event.latlng || layer.getLatLng());
    return;
  }
  if (pinSelectionMode) {
    if (selectedAfectacionesForPin.has(key)) selectedAfectacionesForPin.delete(key);
    else selectedAfectacionesForPin.add(key);
    updatePinSelectionUi();
    renderCurrentLayer(lastFilteredFeatures, { skipFit: true });
    return;
  }
  // Popup normal
  const rows = Object.entries(props)
    .filter(([k, v]) => !k.startsWith("_") && v)
    .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("");
  
  const linked = gifPins.filter(p => p.afectKeys?.includes(key));
  const buttons = linked.map(p => `<button class="btn-open-gif" data-url="${p.gifUrl}">${p.title || 'Ver GIF'}</button>`).join("");

  layer.bindPopup(`<table class="pop-table">${rows}</table>${buttons}`).openPopup();
}

// --- EVENTOS UI ---

function setupPinEditorEvents() {
  editModeSwitch?.addEventListener("change", () => {
    pinSelectionMode = editModeSwitch.checked;
    gifEditorCard.style.display = pinSelectionMode ? "block" : "none";
    if (!pinSelectionMode) selectedAfectacionesForPin.clear();
    renderGifPinsAndLinks();
  });

  btnPlaceGifPin?.addEventListener("click", () => {
    const url = gifUrlInput.value;
    if (!url || selectedAfectacionesForPin.size === 0) {
      showEditorFeedback("Selecciona GIF y al menos una afectación", "warn");
      return;
    }
    pendingPinDraft = {
      gifUrl: url,
      title: pinTitleInput.value,
      description: pinDescriptionInput.value,
      afectKeys: Array.from(selectedAfectacionesForPin)
    };
    showEditorFeedback("Haz clic en el mapa para colocar el pin", "ok");
  });

  map.on("click", (e) => {
    if (pinSelectionMode && pendingPinDraft) placePendingPinAtLatLng(e.latlng);
  });
}

function updatePinSelectionUi() {
  if (pinSelectedCount) pinSelectedCount.textContent = `Afectaciones seleccionadas: ${selectedAfectacionesForPin.size}`;
}

function showEditorFeedback(msg, tone) {
  if (!editorFeedback) return;
  editorFeedback.textContent = msg;
  editorFeedback.className = `editor-feedback ${tone}`;
  if (saveToast && tone === "ok") {
    saveToast.textContent = msg;
    saveToast.classList.add("show");
    setTimeout(() => saveToast.classList.remove("show"), 2000);
  }
}

// --- UTILIDADES ---

function getClassStyle(clasifica) {
  const c = (clasifica || "").toLowerCase();
  if (c.includes("vivienda")) return { fill: "#ff1a1a", stroke: "#8b0000" };
  if (c.includes("infraestructura")) return { fill: "#ffd400", stroke: "#7d6900" };
  return { fill: "#2a8f7b", stroke: "#14574b" };
}

function normalizeFeature(f) {
  const p = f.properties;
  return { ...f, properties: { ...p, 
    nom_mun: p.nom_mun || "Sin dato", 
    Clasifica: p.Clasifica || "Sin clasificar",
    cve_geo: p.cve_geo || "" 
  }};
}

// --- CARGA DE DATOS (KMZ) ---

async function parseKmz(path) {
  const resp = await fetch(path);
  const buf = await resp.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const kmlFile = Object.keys(zip.files).find(n => n.endsWith(".kml"));
  const kmlText = await zip.file(kmlFile).async("string");
  return toGeoJSON.kml(new DOMParser().parseFromString(kmlText, "text/xml"));
}

async function loadKmzLayer() {
  statusText.textContent = "Cargando KMZ...";
  try {
    const geo = await parseKmz(KMZ_PATH);
    const valid = geo.features.map(normalizeFeature).map((f, i) => {
      f.properties._afect_uid = `id-${i}`;
      f.properties._afect_key = `key-${i}`;
      return f;
    });
    sourceFeatureCollection = { type: "FeatureCollection", features: valid };
    
    afectacionFeatureIndex.clear();
    valid.forEach(f => afectacionFeatureIndex.set(buildAfectacionKey(f.properties), f));
    
    allMunicipioCounts = countByField(valid, "nom_mun");
    applyFilters();
  } catch (err) { statusText.textContent = "Error al cargar datos."; }
}

function countByField(arr, field) {
  return arr.reduce((acc, f) => {
    const val = f.properties[field];
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

function applyFilters() {
  const filtered = sourceFeatureCollection.features.filter(f => {
    const p = f.properties;
    const mMatch = !selectedMunicipio || p.nom_mun === selectedMunicipio;
    const cMatch = selectedClasificaciones.size === 0 || selectedClasificaciones.has(p.Clasifica);
    return mMatch && cMatch;
  });
  lastFilteredFeatures = filtered;
  renderCurrentLayer(filtered);
  updateSummary(filtered);
  renderChips(clasificaList, countByField(sourceFeatureCollection.features, "Clasifica"), selectedClasificaciones, "clasifica");
  renderChips(muniList, allMunicipioCounts, new Set([selectedMunicipio]), "muni");
}

function renderCurrentLayer(features, opts = {}) {
  if (currentLayer) map.removeLayer(currentLayer);
  currentLayer = L.geoJSON(features, {
    pane: "afectacionesPane",
    pointToLayer: (f, latlng) => {
      const style = getClassStyle(f.properties.Clasifica);
      const isSel = selectedAfectacionesForPin.has(buildAfectacionKey(f.properties));
      return L.circleMarker(latlng, {
        radius: 8,
        fillColor: style.fill,
        color: style.stroke,
        weight: isSel ? 4 : 1,
        fillOpacity: 0.8
      });
    },
    onEachFeature: (f, l) => l.on("click", (e) => handleAfectacionLayerClick(l, f.properties, e))
  }).addTo(map);
  if (!opts.skipFit) map.fitBounds(currentLayer.getBounds().pad(0.1));
}

function renderChips(container, counts, activeSet, type) {
  if (!container) return;
  container.innerHTML = Object.entries(counts).map(([label, count]) => {
    const active = activeSet.has(label) ? "active" : "";
    return `<button class="chip ${active}" data-val="${label}">${label} (${count})</button>`;
  }).join("");
  
  container.querySelectorAll(".chip").forEach(btn => {
    btn.onclick = () => {
      const val = btn.dataset.val;
      if (type === "muni") selectedMunicipio = selectedMunicipio === val ? null : val;
      else activeSet.has(val) ? activeSet.delete(val) : activeSet.add(val);
      applyFilters();
    };
  });
}

function updateSummary(feat) {
  metricTotal.textContent = feat.length;
  statusText.textContent = "Datos actualizados.";
}

// --- MODALES ---

function openGifModal(url, props) {
  if (!gifModal || !afectacionGif) return;
  afectacionGif.src = url;
  gifModalTitle.textContent = props.nom_mun || "Detalle";
  gifModal.classList.add("open");
}

gifModalClose?.addEventListener("click", () => gifModal.classList.remove("open"));

// --- INICIALIZACIÓN ---
renderLocalGifGallery();
setupPinEditorEvents();
subscribeToCloudPins();
loadKmzLayer();