const KMZ_PATH = "data/afectaciones_ba_170426.kmz";
const TRONCAL_KMZ_PATH = "data/TRONCAL.kmz?v=20260429d";
const MUNICIPIOS_GEOJSON_PATH = "data/municipios_jalisco.geojson";
const VIADUCTO_VIDEO_URL_LOCAL = "file:///Users/jorgeluispriegocruz/Downloads/GUADALAJARA-VIDEO-01.mp4";
const VIADUCTO_VIDEO_URL_WEB = "data/GUADALAJARA-VIDEO-01-web.mp4";
const VIADUCTO_COORDS = [20.6525, -103.347306];

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
const pinAfectacionesSelect = document.getElementById("pin-afectaciones");
const pinTitleInput = document.getElementById("pin-title");
const pinDescriptionInput = document.getElementById("pin-description");
const gifUrlInput = document.getElementById("gif-url");
const btnPlaceGifPin = document.getElementById("btn-place-gif-pin");
const btnClearAllPins = document.getElementById("btn-clear-all-pins");
const editorFeedback = document.getElementById("editor-feedback");
const editorCard = document.querySelector(".editor-card");
const saveToast = document.getElementById("save-toast");
const videoModal = document.getElementById("video-modal");
const videoModalClose = document.getElementById("video-modal-close");
const viaductoVideo = document.getElementById("viaducto-video");
const gifModal = document.getElementById("gif-modal");
const gifModalClose = document.getElementById("gif-modal-close");
const afectacionGif = document.getElementById("afectacion-gif");
const gifModalTitle = document.getElementById("gif-modal-title");

// Toggle panel en móvil
if (btnPanelToggle && filterPanel) {
  btnPanelToggle.addEventListener("click", () => {
    const isOpen = filterPanel.classList.toggle("open");
    btnPanelToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}

const map = L.map("map", {
  zoomControl: true,
}).setView([20.67, -103.35], 8);

map.createPane("troncalPane");
map.getPane("troncalPane").style.zIndex = 350;
map.getPane("troncalPane").style.pointerEvents = "none";
map.createPane("afectacionesPane");
map.getPane("afectacionesPane").style.zIndex = 420;
map.createPane("boundaryPane");
map.getPane("boundaryPane").style.zIndex = 430;
map.createPane("poiPane");
map.getPane("poiPane").style.zIndex = 500;

const svgRenderer = L.svg({ padding: 0.5 });

const baseOSM = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
  maxZoom: 20,
});

const baseTopo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
  attribution: "Map data: &copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap",
  maxZoom: 17,
});

const baseImagery = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles &copy; Esri",
    // Esri no tiene cobertura completa en niveles muy altos para todas las zonas.
    // maxNativeZoom evita pedir tiles inexistentes y Leaflet hace over-zoom visual.
    maxNativeZoom: 17,
    maxZoom: 22,
  }
);

baseOSM.addTo(map);

const baseLayers = {
  Calles: baseOSM,
  Topografico: baseTopo,
  Satelite: baseImagery,
};

const layerControl = L.control.layers(baseLayers, {}, { collapsed: true }).addTo(map);

const NorthControl = L.Control.extend({
  options: { position: "topright" },
  onAdd() {
    const container = L.DomUtil.create("div", "leaflet-control north-control");
    container.setAttribute("aria-label", "Norte");
    container.innerHTML = '<span class="north-arrow" aria-hidden="true">▲</span><span class="north-label">N</span>';
    L.DomEvent.disableClickPropagation(container);
    return container;
  },
});

map.addControl(new NorthControl());

function openViaductoVideo() {
  const isWebContext = window.location.protocol === "http:" || window.location.protocol === "https:";
  const videoUrl = isWebContext ? VIADUCTO_VIDEO_URL_WEB : VIADUCTO_VIDEO_URL_LOCAL;

  if (!videoModal || !viaductoVideo) {
    window.open(videoUrl, "_blank", "noopener,noreferrer");
    return;
  }

  viaductoVideo.src = videoUrl;
  videoModal.classList.add("open");
  videoModal.setAttribute("aria-hidden", "false");
  viaductoVideo.play().catch(() => {});
}

function closeViaductoVideo() {
  if (!videoModal || !viaductoVideo) return;

  videoModal.classList.remove("open");
  videoModal.setAttribute("aria-hidden", "true");
  viaductoVideo.pause();
  viaductoVideo.removeAttribute("src");
  viaductoVideo.load();
}

if (videoModal && videoModalClose) {
  videoModalClose.addEventListener("click", closeViaductoVideo);

  videoModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeVideo === "true") {
      closeViaductoVideo();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && videoModal.classList.contains("open")) {
      closeViaductoVideo();
    }
  });
}

const GIF_PINS_STORAGE_KEY = "gif-pins-v1";
const afectacionCatalog = new Map();
const afectacionFeatureIndex = new Map();
let gifPins = [];
let pendingPinDraft = null;
let gifPinLayer = null;
let gifPinLinksLayer = null;

function buildAfectacionKey(props) {
  const stableKey = String(props._afect_key || "").trim();
  if (stableKey) return `key:${stableKey}`;

  const uid = String(props._afect_uid || "").trim();
  if (uid) return `uid:${uid}`;

  const cveGeo = String(props.cve_geo || "").trim();
  if (cveGeo) return `cve:${cveGeo.toLowerCase()}`;

  const nomMun = String(props.nom_mun || "").trim().toLowerCase();
  const clasifica = String(props.Clasifica || "").trim().toLowerCase();
  const tramo = String(props.tramo || "").trim().toLowerCase();
  return `combo:${nomMun}|${clasifica}|${tramo}`;
}

function buildStableFeatureKey(feature, fallbackIndex) {
  const props = feature.properties || {};
  const geometry = feature.geometry || {};
  const geometryType = String(geometry.type || "").toLowerCase();
  const geometryHead = JSON.stringify(geometry.coordinates || []).slice(0, 220);

  const seed = [
    props.cve_geo || "",
    props.tramo || "",
    props.nom_mun || "",
    props.Clasifica || "",
    geometryType,
    geometryHead,
    String(fallbackIndex),
  ]
    .map((part) => String(part).trim().toLowerCase())
    .join("|");

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return `af${hash.toString(16)}`;
}

function showEditorFeedback(message, tone = "ok") {
  if (!editorFeedback) return;
  editorFeedback.textContent = message;
  editorFeedback.classList.remove("ok", "warn");
  if (tone) editorFeedback.classList.add(tone);

  if (editorCard && tone === "ok") {
    editorCard.classList.remove("saved-pulse");
    void editorCard.offsetWidth;
    editorCard.classList.add("saved-pulse");
  }

  if (saveToast && tone === "ok") {
    saveToast.textContent = message;
    saveToast.classList.add("show");
    saveToast.setAttribute("aria-hidden", "false");
    window.setTimeout(() => {
      saveToast.classList.remove("show");
      saveToast.setAttribute("aria-hidden", "true");
    }, 1600);
  }
}

function loadGifPinsFromStorage() {
  try {
    const raw = localStorage.getItem(GIF_PINS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      gifPins = parsed;
    }
  } catch (_err) {
    gifPins = [];
  }
}

function persistGifPins() {
  localStorage.setItem(GIF_PINS_STORAGE_KEY, JSON.stringify(gifPins));
}

function refreshPinAfectacionesSelect() {
  if (!pinAfectacionesSelect) return;

  const entries = Array.from(afectacionCatalog.entries()).sort((a, b) =>
    a[1].label.localeCompare(b[1].label, "es")
  );

  pinAfectacionesSelect.innerHTML = entries
    .map(([key, item]) => `<option value="${escapeHtml(key)}">${escapeHtml(item.label)}</option>`)
    .join("");
}

function getFeatureCenter(feature) {
  const geometry = feature.geometry || {};

  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    return L.latLng(lat, lng);
  }

  const bounds = L.geoJSON(feature).getBounds();
  if (!bounds.isValid()) return null;
  return bounds.getCenter();
}

function renderGifPinsAndLinks() {
  if (!gifPinLayer) {
    gifPinLayer = L.layerGroup().addTo(map);
  }
  if (!gifPinLinksLayer) {
    gifPinLinksLayer = L.layerGroup().addTo(map);
  }

  gifPinLayer.clearLayers();
  gifPinLinksLayer.clearLayers();

  for (const pin of gifPins) {
    const marker = L.marker([pin.lat, pin.lng], {
      pane: "poiPane",
      icon: L.divIcon({
        className: "gif-pin-wrap",
        html: '<div class="gif-pin-icon">GIF</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
      title: pin.title || "Pin GIF",
    });

    marker.on("click", () => {
      openGifModal(pin.gifUrl, { nom_mun: pin.title || "Pin GIF" });
    });

    marker.bindTooltip(pin.title || "Pin GIF", { direction: "top", offset: [0, -16] });
    marker.addTo(gifPinLayer);

    for (const afectKey of pin.afectKeys || []) {
      const feature = afectacionFeatureIndex.get(afectKey);
      if (!feature) continue;

      const center = getFeatureCenter(feature);
      if (!center) continue;

      L.polyline(
        [
          [pin.lat, pin.lng],
          [center.lat, center.lng],
        ],
        {
          pane: "boundaryPane",
          color: "#0c5f73",
          weight: 2,
          opacity: 0.55,
          dashArray: "6 4",
          interactive: false,
        }
      ).addTo(gifPinLinksLayer);
    }
  }
}

function buildLinkedPinsHtml(afectKey) {
  const linked = gifPins.filter((pin) => Array.isArray(pin.afectKeys) && pin.afectKeys.includes(afectKey));
  if (!linked.length) return "";

  const description = linked[0].description ? `<p style="margin:0.45rem 0 0.2rem;">${escapeHtml(linked[0].description)}</p>` : "";
  const buttons = linked
    .map(
      (pin) =>
        `<button type="button" class="btn-open-gif" data-gif-url="${escapeHtml(pin.gifUrl)}" data-municipio="${escapeHtml(
          pin.title || "Pin GIF"
        )}">Ver GIF: ${escapeHtml(pin.title || "Pin")}</button>`
    )
    .join(" ");

  return `<div style="margin-top:0.55rem;"><strong>Pines vinculados:</strong>${description}<div style="margin-top:0.35rem;display:flex;flex-wrap:wrap;gap:0.35rem;">${buttons}</div></div>`;
}

function openPopupForLayer(layer, props) {
  const afectKey = buildAfectacionKey(props);
  layer.bindPopup(toPopupRows(props, afectKey), { maxWidth: 420 });
  layer.openPopup();
}

function handleAfectacionLayerClick(layer, props) {
  openPopupForLayer(layer, props);
}

function attachAfectacionLayerEvents(layer, props) {
  layer.on("click", () => {
    handleAfectacionLayerClick(layer, props);
  });
}

function setupPinEditorEvents() {
  if (!pinAfectacionesSelect || !pinTitleInput || !pinDescriptionInput || !gifUrlInput || !btnPlaceGifPin) {
    return;
  }

  btnPlaceGifPin.addEventListener("click", () => {
    const gifUrl = String(gifUrlInput.value || "").trim();
    const title = String(pinTitleInput.value || "").trim();
    const description = String(pinDescriptionInput.value || "").trim();
    const afectKeys = Array.from(pinAfectacionesSelect.selectedOptions).map((opt) => opt.value);

    if (!gifUrl) {
      showEditorFeedback("Captura una URL GIF antes de colocar el pin.", "warn");
      return;
    }

    if (!afectKeys.length) {
      showEditorFeedback("Selecciona al menos una afectacion para vincular.", "warn");
      return;
    }

    pendingPinDraft = {
      gifUrl,
      title,
      description,
      afectKeys,
    };

    setStatus("Haz clic en el mapa para colocar el pin GIF.");
    showEditorFeedback("Listo: haz clic en el mapa para colocar el pin.", "ok");
  });

  if (btnClearAllPins) {
    btnClearAllPins.addEventListener("click", () => {
      gifPins = [];
      persistGifPins();
      renderGifPinsAndLinks();
      showEditorFeedback("Se borraron todos los pines GIF.", "warn");
      setStatus("Se borraron todos los pines GIF.");
    });
  }

  map.on("click", (event) => {
    if (!pendingPinDraft) return;

    const pin = {
      id: `pin-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      lat: event.latlng.lat,
      lng: event.latlng.lng,
      gifUrl: pendingPinDraft.gifUrl,
      title: pendingPinDraft.title,
      description: pendingPinDraft.description,
      afectKeys: pendingPinDraft.afectKeys,
    };

    gifPins.push(pin);
    persistGifPins();
    renderGifPinsAndLinks();

    pendingPinDraft = null;
    showEditorFeedback("Pin GIF guardado y vinculado correctamente.", "ok");
    setStatus("Pin GIF creado y vinculado.");
  });
}

function openGifModal(url, props) {
  if (!gifModal || !afectacionGif) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  afectacionGif.src = url;
  if (gifModalTitle) {
    gifModalTitle.textContent = `GIF - ${props.nom_mun || "Afectacion"}`;
  }
  gifModal.classList.add("open");
  gifModal.setAttribute("aria-hidden", "false");
}

function closeGifModal() {
  if (!gifModal || !afectacionGif) return;

  gifModal.classList.remove("open");
  gifModal.setAttribute("aria-hidden", "true");
  afectacionGif.removeAttribute("src");
}

if (gifModal && gifModalClose) {
  gifModalClose.addEventListener("click", closeGifModal);
  gifModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeGif === "true") {
      closeGifModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && gifModal.classList.contains("open")) {
      closeGifModal();
    }
  });
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const gifBtn = target.closest(".btn-open-gif");
  if (!gifBtn) return;

  const gifUrl = (gifBtn.dataset.gifUrl || "").trim();
  const municipio = (gifBtn.dataset.municipio || "Afectacion").trim();
  if (!gifUrl) return;

  openGifModal(gifUrl, { nom_mun: municipio });
});

function addViaductoMarker() {
  const viaductoIcon = L.divIcon({
    className: "viaducto-marker-wrap",
    html: `
      <div class="viaducto-marker" role="img" aria-label="Viaducto">
        <svg class="viaducto-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 15h18v2H3zm1-1h2v-3H4zm4 0h2v-5H8zm4 0h2V9h-2zm4 0h2v-4h-2zM3 8c2.8-2 6-3 9-3s6.2 1 9 3v2c-2.8-2-6-3-9-3s-6.2 1-9 3z" />
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

  const marker = L.marker(VIADUCTO_COORDS, {
    pane: "poiPane",
    icon: viaductoIcon,
    keyboard: true,
    title: "Viaducto",
  }).addTo(map);

  marker.bindPopup(
    '<strong>Viaducto</strong><br><small>Haz clic en el icono para abrir video.</small>'
  );

  marker.bindTooltip("Viaducto", {
    permanent: true,
    direction: "top",
    offset: [0, -18],
    className: "viaducto-label",
  });

  marker.on("click", () => {
    openViaductoVideo();
  });
}

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

loadGifPinsFromStorage();
setupPinEditorEvents();

function stopPointAnimation() {
  if (pointAnimationFrameId) {
    cancelAnimationFrame(pointAnimationFrameId);
    pointAnimationFrameId = null;
  }
}

function startPointAnimation(pointLayers) {
  stopPointAnimation();

  if (!pointLayers.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const baseRadii = pointLayers.map((layer) => {
    if (typeof layer.getRadius === "function") {
      return layer.getRadius();
    }
    return 6;
  });

  const tick = (time) => {
    const phase = (Math.sin(time / 1100) + 1) / 2;

    for (let i = 0; i < pointLayers.length; i += 1) {
      const layer = pointLayers[i];
      if (!map.hasLayer(layer)) continue;

      const base = baseRadii[i] || 6;
      const radius = base * (0.995 + phase * 0.045);
      layer.setRadius(radius);
      layer.setStyle({
        fillOpacity: 0.88 + phase * 0.05,
      });
    }

    pointAnimationFrameId = requestAnimationFrame(tick);
  };

  pointAnimationFrameId = requestAnimationFrame(tick);
}

function setStatus(message) {
  if (statusText) statusText.textContent = message;
}

function setMetricValue(el, value) {
  if (el) el.textContent = value;
}

function getClassStyle(clasifica) {
  const key = (clasifica || "").toLowerCase();

  if (key.includes("predio") || key.includes("vivienda")) {
    return { fill: "#ff1a1a", stroke: "#8b0000" };
  }
  if (key.includes("infraestructura")) {
    return { fill: "#ffd400", stroke: "#7d6900" };
  }
  if (key.includes("vialidad")) {
    return { fill: "#8f8f8f", stroke: "#4f4f4f" };
  }
  if (key.includes("iglesia")) {
    return { fill: "#ff8c00", stroke: "#9a4f00" };
  }
  if (key.includes("troncoconico")) {
    return { fill: "#ffffff", stroke: "#111111" };
  }

  return { fill: "#2a8f7b", stroke: "#14574b" };
}

function radiusByPondera(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 9;
  return Math.max(8, Math.min(16, 6 + num * 1.0));
}

function toPopupRows(props, afectKey = "") {
  const fields = [
    ["Tramo", props.tramo],
    ["Estado", props.nom_ent],
    ["Municipio", props.nom_mun],
    ["Clasificacion", props.Clasifica],
    ["Clave geo", props.cve_geo],
  ];

  const rows = fields
    .filter((item) => item[1] !== undefined && item[1] !== null && String(item[1]).trim() !== "")
    .map((item) => `<tr><th>${item[0]}</th><td>${item[1]}</td></tr>`)
    .join("");

  const linkedPins = buildLinkedPinsHtml(afectKey);

  return `<table style="border-collapse: collapse; width: 100%;">${rows}</table>${linkedPins}`;
}

function normalizeFeature(rawFeature) {
  const properties = rawFeature.properties || {};

  return {
    ...rawFeature,
    properties: {
      ...properties,
      nom_mun: properties.nom_mun || properties.Nom_mun || "Sin dato",
      Clasifica: properties.Clasifica || properties.clasifica || "Sin dato",
      Pondera: properties.Pondera || properties.pondera || "",
      nom_ent: properties.nom_ent || properties.Nom_ent || "",
      tramo: properties.tramo || properties.Tramo || "",
      cve_geo: properties.cve_geo || properties.Cve_geo || "",
    },
  };
}

function isValidAfectacion(feature) {
  const props = feature && feature.properties ? feature.properties : {};
  const clasifica = String(props.Clasifica || "").trim().toLowerCase();
  return clasifica && clasifica !== "sin dato";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hexToRgba(hexColor, alpha) {
  const hex = (hexColor || "").replace("#", "").trim();
  if (hex.length !== 6) return `rgba(255,255,255,${alpha})`;

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderChips(container, countsMap, activeSet, options = {}) {
  const kind = options.kind || "generic";
  const entries = Object.entries(countsMap).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    container.innerHTML = "<small>Sin datos disponibles.</small>";
    return;
  }

  container.innerHTML = entries
    .map(([label, value]) => {
      const active = activeSet.has(label) ? "active" : "";

      if (kind === "clasifica") {
        const classStyle = getClassStyle(label);
        const chipStyle = `--chip-fill:${classStyle.fill};--chip-stroke:${classStyle.stroke};--chip-bg:${hexToRgba(
          classStyle.fill,
          0.18
        )};`;

        return `
          <button type="button" class="chip chip-clasifica ${active}" data-value="${escapeHtml(label)}" style="${chipStyle}">
            <span class="swatch" aria-hidden="true"></span>
            <span>${escapeHtml(label)}</span>
            <span class="count">${value}</span>
          </button>
        `;
      }

      return `
        <button type="button" class="chip ${active}" data-value="${escapeHtml(label)}">
          <span>${escapeHtml(label)}</span>
          <span class="count">${value}</span>
        </button>
      `;
    })
    .join("");
}

function countByField(features, fieldName) {
  const counts = {};

  for (const feature of features) {
    const props = feature.properties || {};
    const value = (props[fieldName] || "Sin dato").trim() || "Sin dato";
    counts[value] = (counts[value] || 0) + 1;
  }

  return counts;
}

function updateSummary(filteredFeatures) {
  setMetricValue(metricTotal, String(filteredFeatures.length));
}

function fitMapToFeatures(features) {
  const candidateFeatures = Array.isArray(features) ? features : [];
  if (!candidateFeatures.length) return false;

  const bounds = L.geoJSON({ type: "FeatureCollection", features: candidateFeatures }).getBounds();
  if (!bounds.isValid()) return false;

  map.fitBounds(bounds.pad(0.1), { animate: true, duration: 0.55 });
  return true;
}

function removeMunicipioBoundary() {
  if (!municipioBoundaryLayer) return;
  map.removeLayer(municipioBoundaryLayer);
  municipioBoundaryLayer = null;
}

function normalizeForLookup(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function loadMunicipioBoundariesDataset() {
  try {
    const response = await fetch(MUNICIPIOS_GEOJSON_PATH);
    if (!response.ok) return;

    const geojson = await response.json();
    if (!geojson || !Array.isArray(geojson.features)) return;

    for (const feature of geojson.features) {
      const props = feature.properties || {};
      const muniName = props.nom_mun || props.NOM_MUN || props.municipio || props.name || "";
      const key = normalizeForLookup(muniName);
      if (!key) continue;
      municipioBoundaryIndex.set(key, feature);
    }
  } catch (_err) {
    // Sin dataset local se mantiene el resto del visor operativo.
  }
}

function drawMunicipioBoundary(boundaryGeoJSON) {
  removeMunicipioBoundary();

  municipioBoundaryLayer = L.geoJSON(boundaryGeoJSON, {
    pane: "boundaryPane",
    style: {
      color: "#0052cc",
      weight: 3,
      dashArray: "8 6",
      fillColor: "#3b82f6",
      fillOpacity: 0.08,
      interactive: false,
    },
  }).addTo(map);

  municipioBoundaryLayer.bringToFront();
}

function renderMunicipioBoundary(municipio) {
  removeMunicipioBoundary();
  if (!municipio) return;

  const key = normalizeForLookup(municipio);
  const boundaryFeature = municipioBoundaryIndex.get(key);
  if (!boundaryFeature) return;

  drawMunicipioBoundary(boundaryFeature);
}

function getClusterTone(childCount) {
  if (childCount >= 40) return "large";
  if (childCount >= 10) return "medium";
  return "small";
}

function renderCurrentLayer(filteredFeatures) {
  stopPointAnimation();

  if (currentLayer) {
    map.removeLayer(currentLayer);
    currentLayer = null;
  }

  const pointLayers = [];
  const useCluster = filteredFeatures.length >= CLUSTER_THRESHOLD;

  if (useCluster) {
    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 52,
      disableClusteringAtZoom: 15,
      iconCreateFunction(cluster) {
        const childCount = cluster.getChildCount();
        const tone = getClusterTone(childCount);

        return L.divIcon({
          html: `<div><span>${childCount}</span></div>`,
          className: `marker-cluster marker-cluster-custom marker-cluster-${tone}`,
          iconSize: L.point(40, 40),
        });
      },
    });

    const nonPointGroup = L.layerGroup();

    for (const feature of filteredFeatures) {
      const geometry = feature.geometry || {};
      const props = feature.properties || {};

      if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
        const [lng, lat] = geometry.coordinates;
        const classStyle = getClassStyle(props.Clasifica);
        const icon = L.divIcon({
          className: "",
          html: `<div class="map-point" style="--point-fill:${classStyle.fill};--point-stroke:${classStyle.stroke}"></div>`,
          iconSize: [13, 13],
          iconAnchor: [6.5, 6.5],
        });

        const marker = L.marker([lat, lng], {
          pane: "afectacionesPane",
          icon,
        });
        attachAfectacionLayerEvents(marker, props);
        clusterGroup.addLayer(marker);
        continue;
      }

      const shape = L.geoJSON(feature, {
        pane: "afectacionesPane",
        style: () => {
          const classStyle = getClassStyle(props.Clasifica);
          return {
            color: classStyle.stroke,
            fillColor: classStyle.fill,
            weight: 2,
            fillOpacity: 0.36,
          };
        },
        onEachFeature: (_item, layer) => {
          attachAfectacionLayerEvents(layer, props);
        },
      });
      nonPointGroup.addLayer(shape);
    }

    currentLayer = L.featureGroup([nonPointGroup, clusterGroup]).addTo(map);
  } else {
    currentLayer = L.geoJSON(
      { type: "FeatureCollection", features: filteredFeatures },
      {
        pane: "afectacionesPane",
        pointToLayer: (feature, latlng) => {
          const props = feature.properties || {};
          const classStyle = getClassStyle(props.Clasifica);
          const marker = L.circleMarker(latlng, {
            pane: "afectacionesPane",
            renderer: svgRenderer,
            radius: radiusByPondera(props.Pondera),
            className: "pulse-point",
            color: classStyle.stroke,
            weight: 2,
            fillColor: classStyle.fill,
            fillOpacity: 0.92,
          });
          pointLayers.push(marker);
          return marker;
        },
        style: (feature) => {
          const props = feature.properties || {};
          const classStyle = getClassStyle(props.Clasifica);
          return {
            color: classStyle.stroke,
            fillColor: classStyle.fill,
            weight: 2,
            fillOpacity: 0.36,
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          attachAfectacionLayerEvents(layer, props);
        },
      }
    ).addTo(map);
  }

  const bounds = L.geoJSON({ type: "FeatureCollection", features: filteredFeatures }).getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.1));
  }

  startPointAnimation(pointLayers);
}

function applyFilters(options = {}) {
  if (!sourceFeatureCollection) return;

  const allFeatures = sourceFeatureCollection.features;
  const filteredFeatures = allFeatures.filter((feature) => {
    const props = feature.properties || {};
    const clasifica = (props.Clasifica || "Sin dato").trim() || "Sin dato";
    const muni = (props.nom_mun || "Sin dato").trim() || "Sin dato";

    const municipioPass = selectedMunicipio ? muni === selectedMunicipio : true;
    const clasificaPass = selectedClasificaciones.size
      ? selectedClasificaciones.has(clasifica)
      : true;

    return municipioPass && clasificaPass;
  });

  lastFilteredFeatures = filteredFeatures;

  renderCurrentLayer(filteredFeatures);
  renderMunicipioBoundary(selectedMunicipio);
  updateSummary(filteredFeatures);

  if (troncalLayer) {
    troncalLayer.bringToBack();
  }
  if (currentLayer) {
    currentLayer.bringToFront();
  }
  if (municipioBoundaryLayer) {
    municipioBoundaryLayer.bringToFront();
  }

  const filtrosActivos = [];
  if (selectedMunicipio) filtrosActivos.push(`municipio: ${selectedMunicipio}`);
  if (selectedClasificaciones.size) {
    filtrosActivos.push(`clasificaciones: ${Array.from(selectedClasificaciones).join(", ")}`);
  }

  if (filteredFeatures.length === 0) {
    setStatus("Sin resultados para los filtros seleccionados.");
  } else if (filtrosActivos.length) {
    setStatus(
      `Mostrando ${filteredFeatures.length} registros filtrados (${filtrosActivos.join(" | ")}).`
    );
  } else {
    setStatus(`Capa cargada correctamente (${filteredFeatures.length} registros).`);
  }

  if (!options.skipChipRender) {
    const featuresForClasificaPanel = selectedMunicipio
      ? allFeatures.filter((feature) => {
          const props = feature.properties || {};
          const muni = (props.nom_mun || "Sin dato").trim() || "Sin dato";
          return muni === selectedMunicipio;
        })
      : allFeatures;

    const clasificaCounts = countByField(featuresForClasificaPanel, "Clasifica");
    const municipioCountsRaw = allMunicipioCounts;
    const normalizedSearchTerm = normalizeForLookup(municipioSearchTerm);
    const municipioEntries = Object.entries(municipioCountsRaw).filter(([muni]) => {
      if (!normalizedSearchTerm) return true;
      return normalizeForLookup(muni).includes(normalizedSearchTerm);
    });
    const municipioCounts = Object.fromEntries(municipioEntries);

    if (selectedMunicipio && !municipioCounts[selectedMunicipio]) {
      municipioCounts[selectedMunicipio] = municipioCountsRaw[selectedMunicipio] || 0;
    }

    const muniSet = selectedMunicipio ? new Set([selectedMunicipio]) : new Set();
    renderChips(clasificaList, clasificaCounts, selectedClasificaciones, { kind: "clasifica" });
    renderChips(muniList, municipioCounts, muniSet, { kind: "municipio" });
  }
}

function setupFilterEvents() {
  clasificaList.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    const value = chip.dataset.value;
    if (!value) return;

    if (selectedClasificaciones.has(value)) {
      selectedClasificaciones.delete(value);
    } else {
      selectedClasificaciones.add(value);
    }

    applyFilters();
  });

  muniList.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    const value = chip.dataset.value;
    if (!value) return;

    selectedMunicipio = selectedMunicipio === value ? null : value;
    applyFilters();
  });

  muniSearch.addEventListener("input", (event) => {
    municipioSearchTerm = event.target.value || "";
    applyFilters();
  });
}

async function parseKmzToGeoJson(kmzPath) {
  const response = await fetch(kmzPath);
  if (!response.ok) {
    throw new Error(`No se pudo leer ${kmzPath}. Estado HTTP ${response.status}`);
  }

  const kmzBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(kmzBuffer);

  const kmlName = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith(".kml"));
  if (!kmlName) {
    throw new Error("El KMZ no contiene archivo KML interno.");
  }

  const kmlText = await zip.file(kmlName).async("string");
  const kmlDoc = new DOMParser().parseFromString(kmlText, "text/xml");
  const parseError = kmlDoc.querySelector("parsererror");
  if (parseError) {
    throw new Error("No fue posible interpretar el KML interno del KMZ.");
  }

  return toGeoJSON.kml(kmlDoc);
}

async function loadKmzLayer() {
  setStatus("Cargando capa KMZ...");

  try {
    const featureCollection = await parseKmzToGeoJson(KMZ_PATH);
    const normalizedFeatures = (featureCollection.features || []).map(normalizeFeature);
    const validFeatures = normalizedFeatures.filter(isValidAfectacion);
    const keyedFeatures = validFeatures.map((feature, index) => ({
      ...feature,
      properties: {
        ...(feature.properties || {}),
        _afect_uid: String(index + 1),
        _afect_key: buildStableFeatureKey(feature, index + 1),
      },
    }));

    sourceFeatureCollection = {
      type: "FeatureCollection",
      features: keyedFeatures,
    };

    afectacionCatalog.clear();
    for (const feature of sourceFeatureCollection.features) {
      const props = feature.properties || {};
      const key = buildAfectacionKey(props);
      if (afectacionCatalog.has(key)) continue;
      afectacionCatalog.set(key, {
        label: buildAfectacionLabel(props),
        props,
      });
    }
    refreshPinAfectacionesSelect();
    renderGifPinsAndLinks();

    allMunicipioCounts = countByField(sourceFeatureCollection.features, "nom_mun");

    if (!sourceFeatureCollection.features.length) {
      throw new Error("No se encontraron entidades geograficas en el KMZ.");
    }

    selectedMunicipio = null;
    selectedClasificaciones.clear();
    removeMunicipioBoundary();

    applyFilters();
  } catch (err) {
    setStatus(`Error al cargar KMZ: ${err.message || err}`);
    setMetricValue(metricTotal, "-");
    allMunicipioCounts = {};
    clasificaList.innerHTML = "<small>No fue posible obtener resumen.</small>";
    muniList.innerHTML = "<small>No fue posible obtener resumen.</small>";
    removeMunicipioBoundary();
  }
}

async function loadTroncalLayer() {
  try {
    if (troncalLayer) return;

    const troncalCollection = await parseKmzToGeoJson(TRONCAL_KMZ_PATH);
    troncalLayer = L.geoJSON(troncalCollection, {
      pane: "troncalPane",
      interactive: false,
      bubblingMouseEvents: false,
      pointToLayer: (_feature, latlng) => {
        return L.circleMarker(latlng, {
          pane: "troncalPane",
          interactive: false,
          bubblingMouseEvents: false,
          radius: 4,
          color: "#0c3db8",
          weight: 1.5,
          fillColor: "#2f75ff",
          fillOpacity: 0.85,
        });
      },
      style: {
        color: "#1f66ff",
        weight: 4,
        opacity: 0.95,
        fillColor: "#6ea2ff",
        fillOpacity: 0.12,
      },
    }).addTo(map);

    troncalLayer.bringToBack();

    layerControl.addOverlay(troncalLayer, "Trazo troncal");
  } catch (err) {
    console.error("No se pudo cargar TRONCAL.kmz", err);
  }
}

btnReload.addEventListener("click", loadKmzLayer);
btnClearFilters.addEventListener("click", () => {
  selectedMunicipio = null;
  selectedClasificaciones.clear();
  municipioSearchTerm = "";
  muniSearch.value = "";
  applyFilters();
});
btnFit.addEventListener("click", () => {
  const didFit =
    fitMapToFeatures(lastFilteredFeatures) ||
    fitMapToFeatures(sourceFeatureCollection && sourceFeatureCollection.features);

  if (!didFit) {
    map.setView([20.67, -103.35], 8, { animate: true });
    setStatus("No hay elementos para centrar. Se regreso a la vista general.");
  }
});

setupFilterEvents();
addViaductoMarker();
loadMunicipioBoundariesDataset();
loadTroncalLayer();
loadKmzLayer();
