'use strict';

const PROJECT_SLUG = 'paleo-demo';
const API_BASE = `https://five.epicollect.net/api/export/entries/${PROJECT_SLUG}`;
const PER_PAGE = 100;

// ── Geological time scale ─────────────────────────────────────────
const PHAN_START = 538.8;

const GEO_PERIODS = [
    { name: 'Cámbrico',    start: 538.8, end: 485.4, color: '#7ec97e', era: 'Paleozoico' },
    { name: 'Ordovícico',  start: 485.4, end: 443.8, color: '#009fa0', era: 'Paleozoico' },
    { name: 'Silúrico',    start: 443.8, end: 419.2, color: '#b3e3c4', era: 'Paleozoico' },
    { name: 'Devónico',    start: 419.2, end: 358.9, color: '#cb8c37', era: 'Paleozoico' },
    { name: 'Carbonífero', start: 358.9, end: 298.9, color: '#67a7b3', era: 'Paleozoico' },
    { name: 'Pérmico',     start: 298.9, end: 251.9, color: '#e76048', era: 'Paleozoico' },
    { name: 'Triásico',    start: 251.9, end: 201.3, color: '#9c5ea0', era: 'Mesozoico' },
    { name: 'Jurásico',    start: 201.3, end: 145.0, color: '#34b2c9', era: 'Mesozoico' },
    { name: 'Cretácico',   start: 145.0, end:  66.0, color: '#7fc64e', era: 'Mesozoico' },
    { name: 'Paleógeno',   start:  66.0, end:  23.03, color: '#fd9a52', era: 'Cenozoico' },
    { name: 'Neógeno',     start:  23.03, end:  2.58, color: '#ffe619', era: 'Cenozoico' },
    { name: 'Cuaternario', start:   2.58, end:   0,   color: '#f9f97f', era: 'Cenozoico' },
];

const GEO_ERAS = [
    { name: 'Paleozoico', start: 538.8, end: 251.9, color: '#99c2a2' },
    { name: 'Mesozoico',  start: 251.9, end:  66.0, color: '#67cdd1' },
    { name: 'Cenozoico',  start:  66.0, end:   0,   color: '#f4e255' },
];

const GEO_ZOOM = {
    Paleozoico: [
        { name: 'Cámbrico',    start: 538.8, end: 485.4, color: '#7ec97e' },
        { name: 'Ordovícico',  start: 485.4, end: 443.8, color: '#009fa0' },
        { name: 'Silúrico',    start: 443.8, end: 419.2, color: '#b3e3c4' },
        { name: 'Devónico',    start: 419.2, end: 358.9, color: '#cb8c37' },
        { name: 'Carbonífero', start: 358.9, end: 298.9, color: '#67a7b3' },
        { name: 'Pérmico',     start: 298.9, end: 251.9, color: '#e76048' },
    ],
    Mesozoico: [
        { name: 'Triásico Inf.', start: 251.9, end: 247.2, color: '#b57ab5' },
        { name: 'Triásico Med.', start: 247.2, end: 237.0, color: '#a56ea5' },
        { name: 'Triásico Sup.', start: 237.0, end: 201.3, color: '#9c5ea0' },
        { name: 'Jurásico Inf.', start: 201.3, end: 174.1, color: '#5cc4d4' },
        { name: 'Jurásico Med.', start: 174.1, end: 163.5, color: '#48b8cc' },
        { name: 'Jurásico Sup.', start: 163.5, end: 145.0, color: '#34b2c9' },
        { name: 'Cretácico Inf.',start: 145.0, end:  99.6, color: '#96cb58' },
        { name: 'Cretácico Sup.',start:  99.6, end:  66.0, color: '#7fc64e' },
    ],
    Cenozoico: [
        { name: 'Paleoceno',   start:  66.0,  end:  56.0,   color: '#fdb462' },
        { name: 'Eoceno',      start:  56.0,  end:  33.9,   color: '#fca044' },
        { name: 'Oligoceno',   start:  33.9,  end:  23.03,  color: '#fb8e26' },
        { name: 'Mioceno',     start:  23.03, end:   5.333, color: '#ffe619' },
        { name: 'Plioceno',    start:   5.333, end:  2.58,  color: '#fff4a0' },
        { name: 'Pleistoceno', start:   2.58, end:   0.0117, color: '#ffffc0' },
        { name: 'Holoceno',    start:   0.0117, end: 0,     color: '#ffffff' },
    ],
};

// ── State ─────────────────────────────────────────────────────────
let allEntries     = [];
let filteredEntries = [];
let speciesMap     = {};
let leafletMap     = null;
let markersLayer   = null;
let activeSpecies  = null;
let zoomEra        = 'Cenozoico';
let speciesRanges  = {};   // { speciesName: { start, end } } from PBDB
let currentPage    = 1;
const PAGE_SIZE    = 20;

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        allEntries = await fetchAllEntries();
        filteredEntries = [...allEntries];

        allEntries.forEach(e => {
            const sp = (e['1_Especie'] || 'Desconocida').trim();
            if (!speciesMap[sp]) speciesMap[sp] = [];
            speciesMap[sp].push(e);
        });

        buildStats();
        buildMap();
        buildSpeciesCards();
        buildTimeline();
        buildTable();
        buildGallery();
        wireFilters();

        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('main-content').style.display = '';

        const upd = document.getElementById('last-updated');
        upd.textContent = `Actualizado: ${new Date().toLocaleString('es-ES', {
            timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short'
        })}`;
        upd.classList.remove('d-none');
    } catch (err) {
        document.getElementById('loading-overlay').innerHTML =
            `<div class="text-center text-danger">
                <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                <p class="mt-2">Error al cargar datos: ${err.message}</p>
             </div>`;
    }
}

// ── API ───────────────────────────────────────────────────────────
async function fetchAllEntries() {
    const entries = [];
    let page = 1, totalPages = 1;
    do {
        const res = await fetch(`${API_BASE}?per_page=${PER_PAGE}&page=${page}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        entries.push(...json.data.entries);
        totalPages = json.meta.last_page;
        page++;
    } while (page <= totalPages);
    return entries;
}

function photoUrl(raw, format = 'entry_thumb') {
    if (!raw) return '';
    if (raw.startsWith('http'))
        return raw.replace(/format=entry_[a-z_]+/, `format=${format}`);
    return `https://five.epicollect.net/api/media/${PROJECT_SLUG}?type=photo&format=${format}&name=${encodeURIComponent(raw)}`;
}

// ── Stats ─────────────────────────────────────────────────────────
function buildStats() {
    const nSpecies  = Object.keys(speciesMap).length;
    const withPhoto = allEntries.filter(e => e['3_Foto']).length;
    const dates     = allEntries.map(e => e.created_at).filter(Boolean).sort();
    const lastDate  = dates.length
        ? new Date(dates[dates.length - 1]).toLocaleDateString('es-ES')
        : '—';

    document.getElementById('stat-total').textContent   = allEntries.length;
    document.getElementById('stat-species').textContent = nSpecies;
    document.getElementById('stat-photos').textContent  = withPhoto;
    document.getElementById('stat-last').textContent    = lastDate;
}

// ── Map ───────────────────────────────────────────────────────────
function buildMap() {
    leafletMap = L.map('map').setView([40.3, -3.6], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 19,
    }).addTo(leafletMap);
    markersLayer = L.layerGroup().addTo(leafletMap);
    renderMapMarkers(allEntries);
}

function renderMapMarkers(entries) {
    markersLayer.clearLayers();
    const bounds = [];
    entries.forEach(e => {
        const gps = e['2_Coordenadas'];
        if (!gps || gps.latitude == null) return;
        const lat = parseFloat(gps.latitude);
        const lng = parseFloat(gps.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const sp    = (e['1_Especie'] || 'Desconocida').trim();
        const thumb = photoUrl(e['3_Foto'], 'entry_thumb');
        const date  = e.created_at
            ? new Date(e.created_at).toLocaleDateString('es-ES') : '—';

        const marker = L.circleMarker([lat, lng], {
            radius: 9, color: '#fff', weight: 2,
            fillColor: '#8B4513', fillOpacity: 0.85,
        });

        marker.bindPopup(
            `${thumb ? `<img src="${thumb}" style="width:100%;border-radius:6px;margin-bottom:6px;" alt="">` : ''}
             <div class="ec5-popup-title" style="color:#8B4513;">${sp}</div>
             <div class="ec5-popup-row"><i class="fas fa-calendar-alt me-1 text-muted"></i>${date}</div>`,
            { maxWidth: 220 }
        );
        markersLayer.addLayer(marker);
        bounds.push([lat, lng]);
    });
    if (bounds.length) leafletMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
}

// ── Species cards ─────────────────────────────────────────────────
function buildSpeciesCards() {
    const grid  = document.getElementById('species-grid');
    const names = Object.keys(speciesMap).sort();
    document.getElementById('species-count').textContent =
        `${names.length} especie${names.length !== 1 ? 's' : ''}`;

    grid.innerHTML = names.map(sp => {
        const recs     = speciesMap[sp];
        const withPic  = recs.find(e => e['3_Foto']);
        const thumb    = withPic ? photoUrl(withPic['3_Foto'], 'entry_thumb') : null;
        const imgHtml  = thumb
            ? `<img src="${thumb}" class="species-card-img" alt="${sp}">`
            : `<div class="species-card-placeholder"><i class="fas fa-bone"></i></div>`;
        return `
            <div class="col-12">
              <div class="species-card card border-0 shadow-sm d-flex flex-row align-items-center gap-3 p-2"
                   data-sp="${sp}" role="button" tabindex="0">
                ${imgHtml}
                <div class="overflow-hidden">
                  <div class="species-name fst-italic fw-semibold small text-truncate">${sp}</div>
                  <div class="text-muted" style="font-size:.7rem;">${recs.length} registro${recs.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>`;
    }).join('');

    grid.querySelectorAll('.species-card').forEach(card => {
        card.addEventListener('click',  () => openSpeciesModal(card.dataset.sp));
        card.addEventListener('keydown', e => { if (e.key === 'Enter') openSpeciesModal(card.dataset.sp); });
    });
}

// ── Timeline ──────────────────────────────────────────────────────
function buildTimeline() {
    renderPhanerozoic();
    renderZoom(zoomEra, null);

    document.getElementById('tl-phanerozoic').addEventListener('click', e => {
        const el = e.target.closest('.tl-period[data-era]');
        if (!el) return;
        zoomEra = el.dataset.era;
        renderZoom(zoomEra, activeSpecies);
        document.querySelectorAll('#tl-phanerozoic .tl-era-active').forEach(p => p.classList.remove('tl-era-active'));
        document.querySelectorAll(`#tl-phanerozoic .tl-period[data-era="${zoomEra}"]`).forEach(p => p.classList.add('tl-era-active'));
    });
}

function renderPhanerozoic(spStart = null, spEnd = null) {
    const container = document.getElementById('tl-phanerozoic');
    container.innerHTML = '';
    const total = PHAN_START;

    // Era label row
    const eraRow = document.createElement('div');
    eraRow.className = 'd-flex';
    GEO_ERAS.forEach(era => {
        const w = ((era.start - era.end) / total * 100).toFixed(3);
        const d = document.createElement('div');
        d.className = 'tl-era-label';
        d.style.cssText = `width:${w}%;background:${era.color};`;
        d.textContent = era.name;
        eraRow.appendChild(d);
    });
    container.appendChild(eraRow);

    // Periods row
    const perRow = document.createElement('div');
    perRow.className = 'd-flex position-relative';
    perRow.style.height = '44px';
    GEO_PERIODS.forEach(p => {
        const w = ((p.start - p.end) / total * 100).toFixed(3);
        const d = document.createElement('div');
        d.className = 'tl-period';
        d.dataset.era = p.era;
        d.style.cssText = `width:${w}%;background:${p.color};`;
        d.title = `${p.name} (${p.start}–${p.end} Ma) — clic para ampliar`;
        if (parseFloat(w) > 7) {
            const lbl = document.createElement('span');
            lbl.className = 'tl-label';
            lbl.textContent = p.name;
            d.appendChild(lbl);
        }
        perRow.appendChild(d);
    });
    // Species overlay
    if (spStart != null && spEnd != null) {
        const L = ((PHAN_START - spStart) / total * 100).toFixed(3);
        const W = Math.max(((spStart - spEnd) / total * 100), 0.5).toFixed(3);
        const ov = document.createElement('div');
        ov.className = 'tl-species-overlay';
        ov.style.cssText = `left:${L}%;width:${W}%;`;
        perRow.appendChild(ov);
    }
    container.appendChild(perRow);

    // Age ticks
    const ageRow = document.createElement('div');
    ageRow.className = 'd-flex justify-content-between tl-age-row';
    [538, 400, 300, 200, 100, 0].forEach(ma => {
        const d = document.createElement('div');
        d.textContent = `${ma} Ma`;
        ageRow.appendChild(d);
    });
    container.appendChild(ageRow);

    // Re-apply active era highlight
    document.querySelectorAll(`#tl-phanerozoic .tl-period[data-era="${zoomEra}"]`)
        .forEach(p => p.classList.add('tl-era-active'));
}

function renderZoom(era, species) {
    const epochs   = GEO_ZOOM[era] || GEO_ZOOM.Cenozoico;
    const eraStart = epochs[0].start;
    const eraEnd   = epochs[epochs.length - 1].end;
    const total    = eraStart - eraEnd;

    const container = document.getElementById('tl-zoom');
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'tl-zoom-header';
    header.innerHTML = `<i class="fas fa-search-plus me-1"></i>Ampliación: <strong>${era}</strong> <span class="text-muted">(${eraStart}–${eraEnd} Ma)</span> — <span class="text-muted small">haz clic en otra era arriba para cambiar la vista</span>`;
    container.appendChild(header);

    const row = document.createElement('div');
    row.className = 'd-flex position-relative';
    row.style.height = '50px';
    epochs.forEach(ep => {
        const w = ((ep.start - ep.end) / total * 100).toFixed(3);
        const d = document.createElement('div');
        d.className = 'tl-epoch';
        d.style.cssText = `width:${w}%;background:${ep.color};`;
        d.title = `${ep.name} (${ep.start}–${ep.end} Ma)`;
        const lbl = document.createElement('span');
        lbl.className = 'tl-label';
        if (parseFloat(w) > 5) lbl.textContent = ep.name;
        d.appendChild(lbl);
        row.appendChild(d);
    });

    // Species overlay on zoom
    if (species && speciesRanges[species]) {
        const range  = speciesRanges[species];
        const clpStart = Math.min(range.start, eraStart);
        const clpEnd   = Math.max(range.end, eraEnd);
        if (clpStart > eraEnd && clpEnd < eraStart) {
            const L = ((eraStart - clpStart) / total * 100).toFixed(3);
            const W = Math.max(((clpStart - clpEnd) / total * 100), 0.5).toFixed(3);
            const ov = document.createElement('div');
            ov.className = 'tl-species-overlay';
            ov.style.cssText = `left:${L}%;width:${W}%;`;
            ov.title = `${species}: ${range.start}–${range.end} Ma`;
            row.appendChild(ov);
        }
    }
    container.appendChild(row);

    // Age ticks for zoom
    const ageRow = document.createElement('div');
    ageRow.className = 'd-flex justify-content-between tl-age-row';
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
        const age = eraStart - (i / steps) * total;
        const d = document.createElement('div');
        d.textContent = age < 1
            ? `${(age * 1000).toFixed(0)} Ka`
            : `${age < 10 ? age.toFixed(2) : age.toFixed(0)} Ma`;
        ageRow.appendChild(d);
    }
    container.appendChild(ageRow);
}

// ── Species modal ─────────────────────────────────────────────────
async function openSpeciesModal(species) {
    activeSpecies = species;
    const records = speciesMap[species] || [];

    // Reset & pre-populate modal
    document.getElementById('species-modal-name').textContent = species;
    document.getElementById('species-modal-class').innerHTML  =
        '<span class="spinner-border spinner-border-sm me-1"></span>Buscando...';
    document.getElementById('species-modal-age').innerHTML =
        '<span class="text-muted small">Consultando base de datos paleontológica (PBDB)…</span>';
    document.getElementById('species-modal-wiki').innerHTML =
        '<span class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Cargando descripción…</span>';
    document.getElementById('species-modal-records').innerHTML = buildRecordsHtml(records);

    new bootstrap.Modal(document.getElementById('speciesModal')).show();

    // Fetch PBDB + Wikipedia in parallel
    const [pbdbRes, wikiRes] = await Promise.allSettled([
        fetchPBDB(species),
        fetchWikipedia(species),
    ]);

    // Handle PBDB
    if (pbdbRes.status === 'fulfilled' && pbdbRes.value) {
        const p = pbdbRes.value;
        renderPBDBInfo(p, species);

        if (p.ageStart != null) {
            speciesRanges[species] = { start: p.ageStart, end: p.ageEnd ?? 0 };
            const mid = (p.ageStart + (p.ageEnd ?? 0)) / 2;
            zoomEra = mid > 251.9 ? 'Paleozoico' : (mid > 66 ? 'Mesozoico' : 'Cenozoico');
            renderPhanerozoic(p.ageStart, p.ageEnd ?? 0);
            renderZoom(zoomEra, species);
            document.querySelectorAll('#tl-phanerozoic .tl-period').forEach(el => el.classList.remove('tl-era-active'));
            document.querySelectorAll(`#tl-phanerozoic .tl-period[data-era="${zoomEra}"]`).forEach(el => el.classList.add('tl-era-active'));
        }
    } else {
        document.getElementById('species-modal-class').innerHTML =
            '<span class="text-muted small">No encontrada en PBDB</span>';
        document.getElementById('species-modal-age').innerHTML =
            '<span class="text-muted small"><i class="fas fa-info-circle me-1"></i>Sin datos en la base de datos paleontológica. Puede que sea una especie viva o con otro nombre en PBDB.</span>';
    }

    // Handle Wikipedia
    if (wikiRes.status === 'fulfilled' && wikiRes.value) {
        const w = wikiRes.value;
        document.getElementById('species-modal-wiki').innerHTML = `
            ${w.thumbnail ? `<img src="${w.thumbnail}" alt="${species}" class="float-end ms-3 mb-2 rounded shadow-sm" style="max-width:110px;max-height:110px;object-fit:cover;">` : ''}
            <p class="mb-2 small">${w.extract || 'Sin descripción disponible.'}</p>
            <a href="${w.pageUrl}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary">
                <i class="fab fa-wikipedia-w me-1"></i>Ver artículo completo
            </a>`;
    } else {
        document.getElementById('species-modal-wiki').innerHTML =
            '<span class="text-muted small">No se encontró artículo en Wikipedia para este taxón.</span>';
    }
}

async function fetchPBDB(taxonName) {
    try {
        const url = `https://paleobiodb.org/data1.2/taxa/single.json?name=${encodeURIComponent(taxonName)}&show=app,classext,ecospace`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        const r = json.records?.[0];
        if (!r) return null;
        return {
            phylum:  r.ph  ?? r.phylum  ?? null,
            class_:  r.cl  ?? r['class'] ?? null,
            order:   r.od  ?? r.order   ?? null,
            family:  r.fm  ?? r.family  ?? null,
            ageStart: r.firstapp_ea ?? r.early_age ?? null,
            ageEnd:   r.lastapp_la  ?? r.late_age  ?? null,
            earlyInterval: r.early_interval ?? null,
            lateInterval:  r.late_interval  ?? null,
            environment: r.env ?? r.environment ?? null,
        };
    } catch { return null; }
}

async function fetchWikipedia(taxonName) {
    const slug = taxonName.replace(/ /g, '_');
    for (const lang of ['es', 'en']) {
        try {
            const res = await fetch(
                `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`
            );
            if (!res.ok) continue;
            const d = await res.json();
            if (d.type === 'standard') {
                return {
                    extract:  d.extract,
                    thumbnail: d.thumbnail?.source ?? null,
                    pageUrl:  d.content_urls?.desktop?.page
                              ?? `https://${lang}.wikipedia.org/wiki/${slug}`,
                };
            }
        } catch { continue; }
    }
    return null;
}

function renderPBDBInfo(p, species) {
    // Classification badges
    const badges = [];
    if (p.phylum) badges.push(`<span class="badge bg-secondary me-1">Filo: ${p.phylum}</span>`);
    if (p.class_) badges.push(`<span class="badge bg-secondary me-1">Clase: ${p.class_}</span>`);
    if (p.order)  badges.push(`<span class="badge bg-secondary me-1">Orden: ${p.order}</span>`);
    if (p.family) badges.push(`<span class="badge bg-secondary me-1">Familia: ${p.family}</span>`);
    document.getElementById('species-modal-class').innerHTML = badges.length
        ? badges.join('') : '<span class="text-muted small">Clasificación no disponible</span>';

    // Age info
    if (p.ageStart != null) {
        const ageEndLabel = (p.ageEnd == null || p.ageEnd === 0) ? 'Presente' : `${p.ageEnd} Ma`;
        const intLabel = p.earlyInterval
            ? `<div class="mt-1 text-muted small">${p.earlyInterval}${p.lateInterval && p.lateInterval !== p.earlyInterval ? ` → ${p.lateInterval}` : ''}</div>` : '';
        const envLabel = p.environment
            ? `<div class="mt-1 text-muted small"><i class="fas fa-globe me-1"></i>${p.environment}</div>` : '';
        document.getElementById('species-modal-age').innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <div class="text-center">
                    <div class="fw-bold fs-5 text-fossil">${p.ageStart} Ma</div>
                    <div class="text-muted small">Primera aparición</div>
                </div>
                <i class="fas fa-arrow-right text-muted"></i>
                <div class="text-center">
                    <div class="fw-bold fs-5 text-fossil">${ageEndLabel}</div>
                    <div class="text-muted small">Última aparición</div>
                </div>
            </div>
            ${intLabel}${envLabel}`;
    } else {
        document.getElementById('species-modal-age').innerHTML =
            '<span class="text-muted small">Rango cronológico no disponible en PBDB</span>';
    }
}

function buildRecordsHtml(records) {
    if (!records.length) return '<p class="text-muted small">Sin registros.</p>';
    return records.map(e => {
        const gps  = e['2_Coordenadas'];
        const lat  = gps?.latitude  != null ? parseFloat(gps.latitude).toFixed(5)  : null;
        const lng  = gps?.longitude != null ? parseFloat(gps.longitude).toFixed(5) : null;
        const date = e.created_at ? new Date(e.created_at).toLocaleDateString('es-ES') : '—';
        const thumb = photoUrl(e['3_Foto'], 'entry_thumb');
        const orig  = photoUrl(e['3_Foto'], 'entry_original');
        const sp    = (e['1_Especie'] || '').trim();
        return `
            <div class="d-flex gap-3 align-items-start py-2 border-bottom">
                ${thumb
                    ? `<img src="${thumb}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;flex-shrink:0;cursor:pointer;"
                         onclick="openPhotoModal('${orig}','${sp}')" alt="">`
                    : '<div style="width:64px;height:64px;border-radius:6px;background:#f8f0e0;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#8B4513;"><i class="fas fa-bone"></i></div>'}
                <div class="small">
                    <div><i class="fas fa-calendar-alt text-muted me-1"></i>${date}</div>
                    ${lat ? `<div class="mt-1"><i class="fas fa-map-marker-alt text-muted me-1"></i>${lat}, ${lng}</div>` : ''}
                </div>
            </div>`;
    }).join('');
}

// ── Table ─────────────────────────────────────────────────────────
function buildTable() { renderTable(); }

function renderTable() {
    const start    = (currentPage - 1) * PAGE_SIZE;
    const pageData = filteredEntries.slice(start, start + PAGE_SIZE);
    const total    = filteredEntries.length;
    const pages    = Math.max(1, Math.ceil(total / PAGE_SIZE));

    document.getElementById('table-count').textContent =
        `${total} registro${total !== 1 ? 's' : ''}`;
    document.getElementById('pagination-info').textContent =
        `Página ${currentPage} de ${pages}`;
    document.getElementById('btn-prev').disabled = currentPage <= 1;
    document.getElementById('btn-next').disabled = currentPage >= pages;

    document.getElementById('table-body').innerHTML = pageData.map(e => {
        const sp    = (e['1_Especie'] || '—').trim();
        const gps   = e['2_Coordenadas'];
        const lat   = gps?.latitude  != null ? parseFloat(gps.latitude).toFixed(5)  : '—';
        const lng   = gps?.longitude != null ? parseFloat(gps.longitude).toFixed(5) : '—';
        const date  = e.created_at ? new Date(e.created_at).toLocaleDateString('es-ES') : '—';
        const thumb = photoUrl(e['3_Foto'], 'entry_thumb');
        const orig  = photoUrl(e['3_Foto'], 'entry_original');
        return `<tr>
            <td>${date}</td>
            <td><span class="fst-italic species-link" role="button" style="cursor:pointer;color:#8B4513;text-decoration:underline;" onclick="openSpeciesModal('${sp.replace(/'/g,"\\'")}');">${sp}</span></td>
            <td>${lat}</td>
            <td>${lng}</td>
            <td class="text-center">
                ${thumb
                    ? `<img src="${thumb}" class="table-photo" alt="${sp}"
                           onclick="openPhotoModal('${orig}','${sp}')" title="Ver foto">`
                    : '—'}
            </td>
        </tr>`;
    }).join('');
}

function wireFilters() {
    const searchInput   = document.getElementById('search-input');
    const filterSpecies = document.getElementById('filter-species');

    // Populate species dropdown
    filterSpecies.innerHTML = '<option value="">Especie: todas</option>' +
        Object.keys(speciesMap).sort()
            .map(s => `<option value="${s}">${s}</option>`).join('');

    function applyFilters() {
        const q  = searchInput.value.toLowerCase().trim();
        const sp = filterSpecies.value;
        filteredEntries = allEntries.filter(e => {
            const eSp = (e['1_Especie'] || '').trim();
            if (sp && eSp !== sp) return false;
            if (q && !eSp.toLowerCase().includes(q)) return false;
            return true;
        });
        currentPage = 1;
        renderTable();
        renderMapMarkers(filteredEntries);
    }

    searchInput.addEventListener('input', applyFilters);
    filterSpecies.addEventListener('change', applyFilters);
    document.getElementById('btn-prev').addEventListener('click', () => { currentPage--; renderTable(); });
    document.getElementById('btn-next').addEventListener('click', () => { currentPage++; renderTable(); });
    document.getElementById('btn-export').addEventListener('click', exportCSV);
}

// ── Gallery ───────────────────────────────────────────────────────
function buildGallery() {
    const grid     = document.getElementById('gallery-grid');
    const empty    = document.getElementById('gallery-empty');
    const withPhoto = allEntries.filter(e => e['3_Foto']);
    document.getElementById('gallery-count').textContent = `(${withPhoto.length})`;

    if (!withPhoto.length) { empty.classList.remove('d-none'); return; }

    grid.innerHTML = withPhoto.map(e => {
        const sp    = (e['1_Especie'] || 'Desconocida').trim();
        const thumb = photoUrl(e['3_Foto'], 'entry_thumb');
        const orig  = photoUrl(e['3_Foto'], 'entry_original');
        return `
            <div class="col-4 col-md-2">
                <img src="${thumb}" class="gallery-thumb" alt="${sp}"
                     onclick="openPhotoModal('${orig}','${sp}')" title="${sp}">
                <div class="gallery-label fst-italic">${sp}</div>
            </div>`;
    }).join('');
}

// ── Photo modal ───────────────────────────────────────────────────
window.openPhotoModal = function(url, title) {
    document.getElementById('photo-modal-img').src   = url;
    document.getElementById('photo-modal-title').textContent = title;
    new bootstrap.Modal(document.getElementById('photoModal')).show();
};

window.openSpeciesModal = openSpeciesModal;

// ── CSV export ────────────────────────────────────────────────────
function exportCSV() {
    const rows = [['Fecha', 'Especie', 'Latitud', 'Longitud', 'Foto']];
    filteredEntries.forEach(e => {
        const gps = e['2_Coordenadas'];
        rows.push([
            e.created_at ? new Date(e.created_at).toLocaleDateString('es-ES') : '',
            e['1_Especie'] || '',
            gps?.latitude  ?? '',
            gps?.longitude ?? '',
            e['3_Foto'] ? photoUrl(e['3_Foto'], 'entry_original') : '',
        ]);
    });
    const csv = rows.map(r =>
        r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'paleo-polvoranca.csv';
    a.click();
}
