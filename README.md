# Geoportal KMZ - Afectaciones BA 170426

Este proyecto muestra un geoportal web que carga y visualiza el archivo:

- data/afectaciones_ba_170426.kmz

## Que incluye

- Visor de mapa con Leaflet.
- Carga directa de KMZ en el navegador (sin conversion manual previa).
- Popup por entidad con atributos clave.
- Resumen de metricas por clasificacion, municipio y pondera.
- Filtros tactiles:
   - Municipio: seleccion unica (toca para activar/desactivar).
   - Clasificaciones: seleccion multiple (toca una o varias).
- Capas base: calles, topografico y satelite.

## Como ejecutarlo

1. Entra al proyecto:

   cd /Users/jorgeluispriegocruz/Projects/ch

2. Levanta un servidor local (requerido para leer archivos locales con fetch):

   python3 -m http.server 8080

3. Abre en navegador:

   http://localhost:8080

## Nota

Si cambias el nombre del KMZ, actualiza la constante KMZ_PATH en app.js.
