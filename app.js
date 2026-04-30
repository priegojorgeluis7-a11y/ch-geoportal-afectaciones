// --- IMPORTACIONES DE FIREBASE (CDN para compatibilidad con GitHub Pages) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  query 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

// --- RUTAS DE DATOS ---
const KMZ_PATH = "data/afectaciones_ba_170426.kmz";
const TRONCAL_KMZ_PATH = "data/TRONCAL.kmz?v=20260429d";
const MUNICIPIOS_GEOJSON_PATH = "data/municipios_jalisco.geojson";
const VIADUCTO_COORDS = [20.6525, -103.347306];

// --- GALERÍA DE GIFS LOCALES ---
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

// --- ELEMENTOS DEL DOM ---
const statusText = document.getElementById("status-text");
const metricTotal = document.getElementById("metric-total");
const clasificaList = document.getElementById("clasifica-list");
const muniList = document.getElementById("muni-list");
const muniSearch = document.getElementById("muni-search");
const gifUrlInput = document.getElementById("gif-url");
const pinSelectedCount = document.getElementById("pin-selected-count");
const pinTitleInput = document.getElementById("pin-title");
const pinDescriptionInput = document.getElementById("pin-description");
const btnPlaceGifPin = document.getElementById("btn-place-gif-pin");
const editModeSwitch = document.getElementById("edit-mode-switch");
const gifEditorCard = document.querySelector(".editor-gif-card");
const gifModal = document.getElementById("gif-modal");
const afectacionGif = document.getElementById("afectacion-gif");
const gifModalTitle = document.getElementById("gif-modal-title");

// --- VARIABLES GLOBALES ---
const afectacionFeatureIndex = new Map();
let selectedAfectacionesForPin = new Set();
let pinSelectionMode = false;
let gifPins = []; 
let pendingPinDraft = null;
let gifPinLayer = L.layerGroup();
let gifPinLinksLayer = L.layerGroup();
let sourceFeatureCollection = null;
let currentLayer = null;
let selectedMunicipio = null;
const selectedClasificaciones = new Set();
let allMunicipioCounts = {};

// --- INICIALIZACIÓN DEL MAPA ---
const map = L.map("map").setView([20.67, -103.35], 8);

map.createPane("troncalPane").style.zIndex = 350;
map.createPane("afectacionesPane").style.zIndex = 420;
map.createPane("gifLinksPane").style.zIndex = 395;
map.createPane("poiPane").style.zIndex = 405;

const baseOSM = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
const baseImagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
L.control.layers({ "Calles": baseOSM, "Satélite": baseImagery }).addTo(map);

gifPinLayer.addTo(map);
gifPinLinksLayer.addTo(map);

// --- LÓGICA FIRESTORE (Nube) ---

function subscribeToCloudPins() {
  onSnapshot(query(pinsCollection), (snapshot) => {
    gifPins = [];
    snapshot.forEach((doc) => gifPins.push({ firestoreId: doc.id, ...doc.data() }));
    renderGifPinsAndLinks();
  });
}

async function savePinToCloud(pinData) {
  try {
    await addDoc(pinsCollection, pinData);
    setStatus("Pin guardado en la nube.");
  } catch (err) { console.error(err); }
}

async function deletePinFromCloud(id) {
  try { await deleteDoc(doc(db, "pins", id)); } catch (err) { console.error(err); }
}

// --- LÓGICA DE PINES Y MAPA ---

function renderGifPinsAndLinks() {
  gifPinLayer.clearLayers();
  gifPinLinksLayer.clearLayers();
  const linkColor = map.hasLayer(baseImagery) ? "#ffffff" : "#0c5f73";

  gifPins.forEach(pin => {
    const marker = L.marker([pin.lat, pin.lng], {
      pane: "poiPane",
      icon: L.divIcon({ className: "gif-pin-wrap", html: `<div class="gif-pin-icon">GIF</div>`, iconSize: [30, 30] })
    });

    marker.on("click", () => openGifModal(pin.gifUrl, pin.title));
    marker.on("contextmenu", (e) => {
      if (pinSelectionMode && confirm("¿Borrar pin de la nube?")) deletePinFromCloud(pin.firestoreId);
    });
    marker.addTo(gifPinLayer);

    (pin.afectKeys || []).forEach(key => {
      const feat = afectacionFeatureIndex.get(key);
      if (feat) {
        const center = getFeatureCenter(feat);
        if (center) L.polyline([[pin.lat, pin.lng], [center.lat, center.lng]], { pane: "gifLinksPane", color: linkColor, weight: 2, dashArray: "5, 5" }).addTo(gifPinLinksLayer);
      }
    });
  });
}

async function placePendingPinAtLatLng(latlng) {
  if (!pendingPinDraft) return;
  await savePinToCloud({ ...pendingPinDraft, lat: latlng.lat, lng: latlng.lng, createdAt: Date.now() });
  pendingPinDraft = null;
  selectedAfectacionesForPin.clear();
  updatePinSelectionUi();
  renderCurrentLayer(sourceFeatureCollection.features, { skipFit: true });
}

function handleAfectacionLayerClick(layer, props, event) {
  const key = props._afect_key;
  if (pendingPinDraft) { placePendingPinAtLatLng(event.latlng); return; }
  if (pinSelectionMode) {
    selectedAfectacionesForPin.has(key) ? selectedAfectacionesForPin.delete(key) : selectedAfectacionesForPin.add(key);
    updatePinSelectionUi();
    renderCurrentLayer(sourceFeatureCollection.features, { skipFit: true });
    return;
  }
  
  const linked = gifPins.filter(p => p.afectKeys?.includes(key));
  const buttons = linked.map(p => `<button class="btn-open-gif" onclick="window.openGifManual('${p.gifUrl}', '${p.title}')">Ver GIF: ${p.title}</button>`).join("");
  layer.bindPopup(`<strong>${props.nom_mun}</strong><br>${props.Clasifica}<br>${buttons}`).openPopup();
}

// --- UTILIDADES ---

function getFeatureCenter(f) {
  if (f.geometry.type === "Point") return L.latLng(f.geometry.coordinates[1], f.geometry.coordinates[0]);
  const bounds = L.geoJSON(f).getBounds();
  return bounds.isValid() ? bounds.getCenter() : null;
}

function setStatus(msg) { statusText.textContent = msg; }

function updatePinSelectionUi() { pinSelectedCount.textContent = `Afectaciones seleccionadas: ${selectedAfectacionesForPin.size}`; }

window.openGifManual = (url, title) => openGifModal(url, title);

function openGifModal(url, title) {
  afectacionGif.src = url;
  gifModalTitle.textContent = title || "Detalle";
  gifModal.classList.add("open");
}

document.getElementById("gif-modal-close").onclick = () => gifModal.classList.remove("open");

// --- CARGA DE KMZ ---

async function parseKmz(path) {
  const resp = await fetch(path);
  const buf = await resp.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const kmlFile = Object.keys(zip.files).find(n => n.endsWith(".kml"));
  const kmlText = await zip.file(kmlFile).async("string");
  return toGeoJSON.kml(new DOMParser().parseFromString(kmlText, "text/xml"));
}

async function loadKmzLayer() {
  setStatus("Cargando KMZ...");
  try {
    const geo = await parseKmz(KMZ_PATH);
    sourceFeatureCollection = { type: "FeatureCollection", features: geo.features.map((f, i) => {
      f.properties._afect_key = `key-${i}`;
      f.properties.nom_mun = f.properties.nom_mun || "Sin dato";
      f.properties.Clasifica = f.properties.Clasifica || "Sin clasificar";
      afectacionFeatureIndex.set(f.properties._afect_key, f);
      return f;
    })};
    allMunicipioCounts = countByField(sourceFeatureCollection.features, "nom_mun");
    applyFilters();
  } catch (err) { setStatus("Error al cargar KMZ."); }
}

function countByField(arr, field) {
  return arr.reduce((acc, f) => { acc[f.properties[field]] = (acc[f.properties[field]] || 0) + 1; return acc; }, {});
}

function applyFilters() {
  const filtered = sourceFeatureCollection.features.filter(f => {
    const mMatch = !selectedMunicipio || f.properties.nom_mun === selectedMunicipio;
    const cMatch = selectedClasificaciones.size === 0 || selectedClasificaciones.has(f.properties.Clasifica);
    return mMatch && cMatch;
  });
  renderCurrentLayer(filtered);
  metricTotal.textContent = filtered.length;
}

function renderCurrentLayer(features, opts = {}) {
  if (currentLayer) map.removeLayer(currentLayer);
  currentLayer = L.geoJSON(features, {
    pane: "afectacionesPane",
    pointToLayer: (f, latlng) => {
      const isSel = selectedAfectacionesForPin.has(f.properties._afect_key);
      return L.circleMarker(latlng, { radius: 8, fillColor: "#2a8f7b", color: "#14574b", weight: isSel ? 5 : 1, fillOpacity: 0.8 });
    },
    onEachFeature: (f, l) => l.on("click", (e) => handleAfectacionLayerClick(l, f.properties, e))
  }).addTo(map);
  if (!opts.skipFit && features.length > 0) map.fitBounds(currentLayer.getBounds());
}

// --- EVENTOS ---

editModeSwitch.onchange = () => {
  pinSelectionMode = editModeSwitch.checked;
  gifEditorCard.style.display = pinSelectionMode ? "block" : "none";
  if (!pinSelectionMode) selectedAfectacionesForPin.clear();
};

btnPlaceGifPin.onclick = () => {
  if (!gifUrlInput.value || selectedAfectacionesForPin.size === 0) return setStatus("Falta GIF o selección.");
  pendingPinDraft = { gifUrl: gifUrlInput.value, title: pinTitleInput.value, description: pinDescriptionInput.value, afectKeys: Array.from(selectedAfectacionesForPin) };
  setStatus("Haz clic en el mapa para colocar el pin.");
};

map.on("click", (e) => { if (pinSelectionMode && pendingPinDraft) placePendingPinAtLatLng(e.latlng); });

// --- GALERÍA ---
function renderLocalGifGallery() {
  const gallery = document.getElementById("local-gif-gallery");
  LOCAL_GIFS.forEach(path => {
    const img = document.createElement("img");
    img.src = path;
    img.className = "gif-thumb-img";
    img.style.cssText = "width:64px;height:64px;margin:2px;cursor:pointer;border:2px solid #ddd;";
    img.onclick = () => { 
      gifUrlInput.value = path; 
      gallery.querySelectorAll("img").forEach(i => i.style.borderColor = "#ddd");
      img.style.borderColor = "#0c5f73";
    };
    gallery.appendChild(img);
  });
}

// --- INICIO ---
renderLocalGifGallery();
subscribeToCloudPins();
loadKmzLayer();