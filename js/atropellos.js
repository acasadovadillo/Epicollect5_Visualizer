const SLUG_ATROPELLOS = 'atropellos-polvoranca';
const SLUG_CAMPO      = 'datos-campo-polvoranca';
const API             = slug => `https://five.epicollect.net/api/export/entries/${slug}`;
const PER_PAGE        = 100;
const TABLE_SIZE      = 15;

// Animal class → marker colour
const CLASS_COLORS = {
    // Singular forms (actual API values)
    'Anfibio':          '#0d6efd',
    'Reptil':           '#198754',
    'Mamífero':         '#fd7e14',
    'Mamifero':         '#fd7e14',
    'Ave':              '#6f42c1',
    'Invertebrado':     '#6c757d',
    'No Identificable': '#dc3545',
    // Plural fallbacks
    'Anfibios':         '#0d6efd',
    'Reptiles':         '#198754',
    'Mamíferos':        '#fd7e14',
    'Aves':             '#6f42c1',
    'No ID':            '#dc3545',
};
const DEFAULT_COLOR = '#adb5bd';

// GPS fields in priority order (the one matching the class will be non-empty)
const GPS_FIELDS = [
    '3_Ubicacin_Anfibios_',
    '7_Ubicacin_Reptiles_',
    '10_Ubicacin_Mamferos',
    '12_Ubicacin_Aves_Pre',
    '14_Ubicacin_No_ID_Pr',
];
const PHOTO_FIELDS = [
    '5_Foto_Anfibios', '9_Foto_Reptiles',
    '11_Foto_Mamferos', '13_Foto_Aves', '15_Foto_no_ID',
];

let allAtropellos   = [];
let allSessions     = [];
let filtered        = [];
let currentPage     = 1;
let map, chartClass, chartVehicles, chartMonthly;
let leafletMarkers  = [];
let photoModal;

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    try {
        [allAtropellos, allSessions] = await Promise.all([
            fetchAll(SLUG_ATROPELLOS),
            fetchAll(SLUG_CAMPO),
        ]);

        filtered = [...allAtropellos];

        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('main-content').style.display = '';
        document.getElementById('last-updated').textContent =
            `Actualizado: ${new Date().toLocaleString('es-ES')}`;

        photoModal = new bootstrap.Modal(document.getElementById('photoModal'));

        renderStats();
        initMap();
        renderMap();
        initCharts();
        renderCharts();
        renderTable();
        renderSessions();
        renderGallery();
        populateClassFilter();
        setupFilters();
        setupExport();
    } catch (err) {
        document.getElementById('loading-overlay').innerHTML = `
            <div class="text-center text-danger p-4">
                <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                <p class="mb-1 fw-semibold">Error al cargar los datos</p>
                <p class="small text-muted">${err.message}</p>
            </div>`;
    }
});

// ── Fetch all pages ────────────────────────────────────────────────────────
async function fetchAll(slug) {
    const entries = [];
    let page = 1, totalPages = 1;
    do {
        const res = await fetch(`${API(slug)}?per_page=${PER_PAGE}&page=${page}`);
        if (!res.ok) throw new Error(`HTTP ${res.status} (${slug}, p.${page})`);
        const json = await res.json();
        entries.push(...json.data.entries);
        totalPages = json.meta.last_page;
        page++;
    } while (page <= totalPages);
    return entries;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getGPS(entry) {
    for (const f of GPS_FIELDS) {
        const g = entry[f];
        if (g && g.latitude !== '' && g.latitude != null) {
            const lat = parseFloat(g.latitude);
            const lng = parseFloat(g.longitude);
            if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }
    }
    return null;
}

function getPhoto(entry) {
    for (const f of PHOTO_FIELDS) {
        if (entry[f]) return entry[f];
    }
    return '';
}

function getSpecies(entry) {
    return entry['2_Anfibios'] || entry['6_Reptiles'] || '';
}

function getCarcass(entry) {
    return entry['4_Carcasa'] || entry['8_Carcasa'] || '';
}

function classColor(clase) {
    return CLASS_COLORS[clase] || DEFAULT_COLOR;
}

function photoThumb(url) {
    if (!url) return '';
    return url.replace(/format=entry_[a-z_]+/, 'format=entry_thumb');
}

function photoOriginal(url) {
    if (!url) return '';
    return url.replace(/format=entry_[a-z_]+/, 'format=entry_original');
}

function esc(v) {
    if (!v && v !== 0) return '—';
    return String(v)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function csvCell(v) {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}

// ── Stats ──────────────────────────────────────────────────────────────────
function renderStats() {
    const photos    = allAtropellos.filter(e => getPhoto(e)).length;
    const vehicles  = allSessions.reduce((s,e) => s + (parseInt(e['4_Nmero_de_vehculos']) || 0), 0);

    document.getElementById('stat-total').textContent    = allAtropellos.length;
    document.getElementById('stat-sessions').textContent = allSessions.length;
    document.getElementById('stat-vehicles').textContent = vehicles;
    document.getElementById('stat-photos').textContent   = photos;
    document.getElementById('sessions-count').textContent = `(${allSessions.length})`;
}

// ── Map ────────────────────────────────────────────────────────────────────
function initMap() {
    map = L.map('map').setView([40.33, -3.80], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);

    // Legend
    const classes = [...new Set(allAtropellos.map(e => e['1_Clase']).filter(Boolean))].sort();
    document.getElementById('map-legend').innerHTML = classes.map(c =>
        `<span class="badge bg-light text-muted border me-1">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${classColor(c)};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2)"></span>
            ${c}
        </span>`
    ).join('');
}

function renderMap() {
    leafletMarkers.forEach(m => map.removeLayer(m));
    leafletMarkers = [];
    const bounds = [];

    filtered.forEach(entry => {
        const gps = getGPS(entry);
        if (!gps) return;
        const color  = classColor(entry['1_Clase']);
        const marker = L.circleMarker([gps.lat, gps.lng], {
            radius: 8, fillColor: color, color: '#fff',
            weight: 2, opacity: 1, fillOpacity: 0.9,
        });
        marker.bindPopup(() => buildPopup(entry));
        marker.addTo(map);
        leafletMarkers.push(marker);
        bounds.push([gps.lat, gps.lng]);
    });

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] });
}

function buildPopup(entry) {
    const div   = L.DomUtil.create('div', 'ec5-popup');
    const photo = getPhoto(entry);

    if (photo) {
        const img = L.DomUtil.create('img', '', div);
        img.src = photoThumb(photo);
        img.alt = entry['1_Clase'] || '';
        img.addEventListener('click', () => openPhoto(entry));
    }

    const title = L.DomUtil.create('div', 'ec5-popup-title', div);
    title.style.color = classColor(entry['1_Clase']);
    title.textContent = entry['1_Clase'] || '—';

    const species = getSpecies(entry);
    if (species) {
        const sci = L.DomUtil.create('div', 'ec5-popup-scientific', div);
        sci.textContent = species;
    }

    const carcass = getCarcass(entry);
    if (carcass) {
        const row = L.DomUtil.create('div', 'ec5-popup-row', div);
        row.innerHTML = `<b>Estado:</b> ${carcass}`;
    }

    const date = entry.created_at
        ? new Date(entry.created_at).toLocaleDateString('es-ES') : '';
    if (date) {
        const row = L.DomUtil.create('div', 'ec5-popup-row', div);
        row.innerHTML = `<b>Fecha:</b> ${date}`;
    }

    if (entry['16_Observaciones']) {
        const obs = L.DomUtil.create('div', 'ec5-popup-obs', div);
        obs.textContent = entry['16_Observaciones'];
    }

    return div;
}

// ── Charts ─────────────────────────────────────────────────────────────────
function initCharts() {
    chartClass = new Chart(
        document.getElementById('chart-class').getContext('2d'),
        {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }] },
            options: {
                cutout: '60%',
                plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
            },
        }
    );

    chartVehicles = new Chart(
        document.getElementById('chart-vehicles').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    data: [], backgroundColor: 'rgba(255,193,7,0.8)',
                    borderColor: '#ffc107', borderWidth: 1, borderRadius: 4,
                }],
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { font: { size: 10 } } },
                    y: { beginAtZero: true, ticks: { stepSize: 20, font: { size: 11 } } },
                },
            },
        }
    );

    chartMonthly = new Chart(
        document.getElementById('chart-monthly').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    data: [], backgroundColor: 'rgba(220,53,69,0.75)',
                    borderColor: '#dc3545', borderWidth: 1, borderRadius: 4,
                }],
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { font: { size: 11 } } },
                    y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } },
                },
            },
        }
    );
}

function renderCharts() {
    // Doughnut: by class
    const classCounts = {};
    filtered.forEach(e => {
        const c = e['1_Clase'] || 'Sin clase';
        classCounts[c] = (classCounts[c] || 0) + 1;
    });
    const classEntries = Object.entries(classCounts).sort((a,b) => b[1]-a[1]);
    chartClass.data.labels                    = classEntries.map(([c]) => c);
    chartClass.data.datasets[0].data          = classEntries.map(([,n]) => n);
    chartClass.data.datasets[0].backgroundColor = classEntries.map(([c]) => classColor(c));
    chartClass.update();

    // Bar: vehicles per session
    const sessionsDesc = [...allSessions].sort((a,b) =>
        new Date(a['1_Fecha'] || a.created_at) - new Date(b['1_Fecha'] || b.created_at)
    );
    chartVehicles.data.labels              = sessionsDesc.map(s => s['1_Fecha'] || s.created_at?.slice(0,10) || '?');
    chartVehicles.data.datasets[0].data    = sessionsDesc.map(s => parseInt(s['4_Nmero_de_vehculos']) || 0);
    chartVehicles.update();

    // Bar: monthly atropellos
    const monthly = {};
    filtered.forEach(e => {
        const d = new Date(e.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        monthly[key] = (monthly[key] || 0) + 1;
    });
    const monthEntries = Object.entries(monthly).sort(([a],[b]) => a.localeCompare(b));
    const monthLabels  = monthEntries.map(([k]) => {
        const [y, m] = k.split('-');
        return new Date(y, m-1).toLocaleDateString('es-ES', { month:'short', year:'2-digit' });
    });
    chartMonthly.data.labels           = monthLabels;
    chartMonthly.data.datasets[0].data = monthEntries.map(([,n]) => n);
    chartMonthly.update();
}

// ── Table ──────────────────────────────────────────────────────────────────
function renderTable() {
    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / TABLE_SIZE));
    const start      = (currentPage - 1) * TABLE_SIZE;
    const pageData   = filtered.slice(start, start + TABLE_SIZE);

    document.getElementById('table-count').textContent = `${total} registro${total!==1?'s':''}`;
    document.getElementById('pagination-info').textContent = `Página ${currentPage} de ${totalPages}`;
    document.getElementById('btn-prev').disabled = currentPage <= 1;
    document.getElementById('btn-next').disabled = currentPage >= totalPages;

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = pageData.map(e => {
        const gps     = getGPS(e);
        const photo   = getPhoto(e);
        const date    = e.created_at ? new Date(e.created_at).toLocaleDateString('es-ES') : '—';
        const color   = classColor(e['1_Clase']);
        const species = getSpecies(e);
        const carcass = getCarcass(e);

        const photoCell = photo
            ? `<img class="table-photo" src="${photoThumb(photo)}" data-uuid="${e.ec5_uuid}" alt=""
                    onerror="this.style.display='none'">`
            : '<span class="text-muted">—</span>';

        return `<tr>
            <td class="text-nowrap">${date}</td>
            <td><span class="badge" style="background:${color}">${esc(e['1_Clase'])}</span></td>
            <td><em>${esc(species)}</em></td>
            <td>${esc(carcass)}</td>
            <td class="text-muted small">${gps ? gps.lat.toFixed(5) : '—'}</td>
            <td class="text-muted small">${gps ? gps.lng.toFixed(5) : '—'}</td>
            <td class="obs-cell text-muted" title="${esc(e['16_Observaciones'])}">${esc(e['16_Observaciones'])}</td>
            <td class="text-center">${photoCell}</td>
        </tr>`;
    }).join('');
}

// ── Sessions table ─────────────────────────────────────────────────────────
function renderSessions() {
    const sorted = [...allSessions].sort((a,b) =>
        new Date(b['1_Fecha'] || b.created_at) - new Date(a['1_Fecha'] || a.created_at)
    );

    document.getElementById('sessions-body').innerHTML = sorted.map(s => {
        const viento    = Array.isArray(s['6_Viento'])    ? s['6_Viento'].join(', ')    : (s['6_Viento'] || '—');
        const nubosidad = Array.isArray(s['7_Nubosidad']) ? s['7_Nubosidad'].join(', ') : (s['7_Nubosidad'] || '—');
        const lluvia    = Array.isArray(s['8_Lluvia'])    ? s['8_Lluvia'].join(', ')    : (s['8_Lluvia'] || '—');

        return `<tr>
            <td class="text-nowrap fw-semibold">${esc(s['1_Fecha'])}</td>
            <td class="text-center">${esc(s['3_Hora_de_inicio'])}</td>
            <td class="text-center">${esc(s['9_Hora_de_fin'])}</td>
            <td class="text-center">${s['2_Nmero_de_observado'] ?? '—'}</td>
            <td class="text-center fw-semibold">${s['4_Nmero_de_vehculos'] ?? '—'}</td>
            <td class="text-center">${s['5_Temperatura'] != null ? s['5_Temperatura']+'°' : '—'}</td>
            <td class="small text-muted">${esc(viento)}</td>
            <td class="small text-muted">${esc(nubosidad)}</td>
            <td class="small text-muted">${esc(lluvia)}</td>
        </tr>`;
    }).join('');
}

// ── Gallery ────────────────────────────────────────────────────────────────
function renderGallery() {
    const withPhotos = filtered.filter(e => getPhoto(e));
    const grid  = document.getElementById('gallery-grid');
    const empty = document.getElementById('gallery-empty');
    document.getElementById('gallery-count').textContent = withPhotos.length ? `(${withPhotos.length})` : '';

    if (withPhotos.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('d-none');
        return;
    }
    empty.classList.add('d-none');
    grid.innerHTML = withPhotos.map(e => `
        <div class="col-6 col-sm-4 col-md-3 col-xl-2">
            <img class="gallery-thumb"
                 src="${photoThumb(getPhoto(e))}"
                 data-uuid="${e.ec5_uuid}"
                 alt="${esc(e['1_Clase'])}"
                 loading="lazy"
                 onerror="this.closest('.col-6').style.display='none'">
            <div class="gallery-label">${esc(e['1_Clase'])}${getSpecies(e) ? ' · '+getSpecies(e) : ''}</div>
        </div>
    `).join('');
}

// ── Photo modal ────────────────────────────────────────────────────────────
function openPhoto(entry) {
    document.getElementById('photo-modal-title').textContent = entry['1_Clase'] || '';
    const sub = [getSpecies(entry), getCarcass(entry)].filter(Boolean).join(' · ');
    document.getElementById('photo-modal-sub').textContent = sub;
    document.getElementById('photo-modal-img').src = photoOriginal(getPhoto(entry));
    photoModal.show();
}

document.addEventListener('click', e => {
    const img = e.target.closest('.table-photo, .gallery-thumb');
    if (!img) return;
    const entry = allAtropellos.find(e => e.ec5_uuid === img.dataset.uuid);
    if (entry) openPhoto(entry);
});

// ── Filters ────────────────────────────────────────────────────────────────
function populateClassFilter() {
    const classes = [...new Set(allAtropellos.map(e => e['1_Clase']).filter(Boolean))].sort();
    const sel = document.getElementById('filter-class');
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        sel.appendChild(opt);
    });
}

function setupFilters() {
    const searchInput  = document.getElementById('search-input');
    const filterClass  = document.getElementById('filter-class');

    function applyFilters() {
        const q   = searchInput.value.toLowerCase().trim();
        const cls = filterClass.value;

        filtered = allAtropellos.filter(e => {
            const species = getSpecies(e);
            const matchQ  = !q ||
                (e['1_Clase']         || '').toLowerCase().includes(q) ||
                species.toLowerCase().includes(q) ||
                (e['16_Observaciones']|| '').toLowerCase().includes(q);
            const matchCls = !cls || e['1_Clase'] === cls;
            return matchQ && matchCls;
        });

        currentPage = 1;
        renderMap();
        renderCharts();
        renderTable();
        renderGallery();
    }

    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyFilters, 250);
    });
    filterClass.addEventListener('change', applyFilters);

    document.getElementById('btn-prev').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
    });
    document.getElementById('btn-next').addEventListener('click', () => {
        const totalPages = Math.ceil(filtered.length / TABLE_SIZE);
        if (currentPage < totalPages) { currentPage++; renderTable(); }
    });
}

// ── CSV export ─────────────────────────────────────────────────────────────
function setupExport() {
    document.getElementById('btn-export').addEventListener('click', () => {
        const headers = ['UUID','Fecha','Clase','Especie','Estado carcasa','Latitud','Longitud','Observaciones'];
        const rows = filtered.map(e => {
            const gps = getGPS(e);
            return [
                e.ec5_uuid,
                e.created_at ? new Date(e.created_at).toLocaleDateString('es-ES') : '',
                e['1_Clase'] || '',
                getSpecies(e),
                getCarcass(e),
                gps ? gps.lat : '',
                gps ? gps.lng : '',
                e['16_Observaciones'] || '',
            ];
        });
        const csv = [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
        const blob = new Blob(['﻿'+csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: 'atropellos.csv' });
        a.click();
        URL.revokeObjectURL(url);
    });
}
