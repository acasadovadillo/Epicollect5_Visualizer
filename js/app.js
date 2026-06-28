const PROJECT_SLUG = 'base-de-datos-semillas';
const API_BASE    = `https://five.epicollect.net/api/export/entries/${PROJECT_SLUG}`;
const MEDIA_BASE  = `https://five.epicollect.net/api/export/media/${PROJECT_SLUG}`;
const PER_PAGE    = 100;
const TABLE_SIZE  = 10;

let allEntries      = [];
let filteredEntries = [];
let currentPage     = 1;

let map, chartCultivated, chartNative, chartSpecies;
let leafletMarkers = [];
let photoModal;

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    try {
        allEntries = await fetchAllEntries();
        filteredEntries = [...allEntries];

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
        renderGallery();
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

// ── API fetch (all pages) ──────────────────────────────────────────────────
async function fetchAllEntries() {
    const entries = [];
    let page = 1;
    let totalPages = 1;

    do {
        const res = await fetch(`${API_BASE}?per_page=${PER_PAGE}&page=${page}`);
        if (!res.ok) throw new Error(`HTTP ${res.status} al cargar página ${page}`);
        const json = await res.json();
        entries.push(...json.data.entries);
        totalPages = json.meta.last_page;
        page++;
    } while (page <= totalPages);

    return entries;
}

// ── Stats ──────────────────────────────────────────────────────────────────
function renderStats() {
    const total       = allEntries.length;
    const species     = new Set(allEntries.map(e => e['2_Scientific_Name']).filter(Boolean)).size;
    const individuals = allEntries.reduce((s, e) => s + (parseInt(e['6_Individual_Count']) || 0), 0);
    const photos      = allEntries.filter(e => e['5_Sample_picture']).length;

    document.getElementById('stat-total').textContent       = total;
    document.getElementById('stat-species').textContent     = species;
    document.getElementById('stat-individuals').textContent = individuals;
    document.getElementById('stat-photos').textContent      = photos;
}

// ── Map ────────────────────────────────────────────────────────────────────
function initMap() {
    map = L.map('map').setView([40.3, -3.8], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(map);
}

function renderMap() {
    leafletMarkers.forEach(m => map.removeLayer(m));
    leafletMarkers = [];

    const bounds = [];

    filteredEntries.forEach(entry => {
        const gps = entry['8_10mAccuracy_GPSCoo'];
        if (!gps || gps.latitude == null || gps.longitude == null) return;

        const lat = parseFloat(gps.latitude);
        const lng = parseFloat(gps.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        const cultivated = entry['3_Is_Cultivated'] === 'Yes';

        const marker = L.circleMarker([lat, lng], {
            radius:      9,
            fillColor:   cultivated ? '#ffc107' : '#198754',
            color:       '#fff',
            weight:      2,
            opacity:     1,
            fillOpacity: 0.9,
        });

        marker.bindPopup(() => buildPopup(entry));
        marker.addTo(map);
        leafletMarkers.push(marker);
        bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40] });
    }
}

function buildPopup(entry) {
    const div = L.DomUtil.create('div', 'ec5-popup');

    if (entry['5_Sample_picture']) {
        const img = L.DomUtil.create('img', '', div);
        img.src = photoUrl(entry['5_Sample_picture'], 'entry_thumb');
        img.alt = entry['1_Common_Name'] || '';
        img.addEventListener('click', () => openPhoto(entry));
    }

    const title = L.DomUtil.create('div', 'ec5-popup-title', div);
    title.textContent = entry['1_Common_Name'] || '—';

    if (entry['2_Scientific_Name']) {
        const sci = L.DomUtil.create('div', 'ec5-popup-scientific', div);
        sci.textContent = entry['2_Scientific_Name'];
    }

    const rows = [
        ['Localidad',  entry['7_Locality']],
        ['Individuos', entry['6_Individual_Count']],
        ['Cultivada',  entry['3_Is_Cultivated'] === 'Yes' ? 'Sí' : 'No'],
        ['Nativa',     entry['4_Is_Native']     === 'Yes' ? 'Sí' : 'No'],
    ];

    rows.forEach(([label, value]) => {
        if (!value && value !== 0) return;
        const row = L.DomUtil.create('div', 'ec5-popup-row', div);
        row.innerHTML = `<b>${label}:</b> ${value}`;
    });

    if (entry['9_Observations']) {
        const obs = L.DomUtil.create('div', 'ec5-popup-obs', div);
        obs.textContent = entry['9_Observations'];
    }

    return div;
}

// ── Charts ─────────────────────────────────────────────────────────────────
function initCharts() {
    chartCultivated = new Chart(
        document.getElementById('chart-cultivated').getContext('2d'),
        {
            type: 'doughnut',
            data: {
                labels: ['Sí', 'No'],
                datasets: [{ data: [0, 0], backgroundColor: ['#ffc107', '#dee2e6'], borderWidth: 0 }],
            },
            options: {
                cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
            },
        }
    );

    chartNative = new Chart(
        document.getElementById('chart-native').getContext('2d'),
        {
            type: 'doughnut',
            data: {
                labels: ['Sí', 'No'],
                datasets: [{ data: [0, 0], backgroundColor: ['#198754', '#dc3545'], borderWidth: 0 }],
            },
            options: {
                cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
            },
        }
    );

    chartSpecies = new Chart(
        document.getElementById('chart-species').getContext('2d'),
        {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: 'rgba(25, 135, 84, 0.75)',
                    borderColor: '#198754',
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } },
                    y: { ticks: { font: { size: 11 } } },
                },
            },
        }
    );
}

function renderCharts() {
    const cultivatedYes = filteredEntries.filter(e => e['3_Is_Cultivated'] === 'Yes').length;
    chartCultivated.data.datasets[0].data = [cultivatedYes, filteredEntries.length - cultivatedYes];
    chartCultivated.update();

    const nativeYes = filteredEntries.filter(e => e['4_Is_Native'] === 'Yes').length;
    chartNative.data.datasets[0].data = [nativeYes, filteredEntries.length - nativeYes];
    chartNative.update();

    // species bar chart — aggregate individuals per scientific name
    const map = {};
    filteredEntries.forEach(e => {
        const name  = e['2_Scientific_Name'] || e['1_Common_Name'] || 'Desconocida';
        const count = parseInt(e['6_Individual_Count']) || 0;
        map[name] = (map[name] || 0) + count;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
    chartSpecies.data.labels              = sorted.map(([n]) => n);
    chartSpecies.data.datasets[0].data   = sorted.map(([, c]) => c);
    chartSpecies.update();
}

// ── Table ──────────────────────────────────────────────────────────────────
function renderTable() {
    const total      = filteredEntries.length;
    const totalPages = Math.max(1, Math.ceil(total / TABLE_SIZE));
    const start      = (currentPage - 1) * TABLE_SIZE;
    const pageData   = filteredEntries.slice(start, start + TABLE_SIZE);

    document.getElementById('table-count').textContent =
        `${total} registro${total !== 1 ? 's' : ''}`;
    document.getElementById('pagination-info').textContent =
        `Página ${currentPage} de ${totalPages}`;
    document.getElementById('btn-prev').disabled = currentPage <= 1;
    document.getElementById('btn-next').disabled = currentPage >= totalPages;

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = pageData.map(e => {
        const date     = e.created_at ? new Date(e.created_at).toLocaleDateString('es-ES') : '—';
        const cultBadge = e['3_Is_Cultivated'] === 'Yes'
            ? '<span class="badge bg-warning text-dark">Sí</span>'
            : '<span class="badge bg-secondary">No</span>';
        const natBadge  = e['4_Is_Native'] === 'Yes'
            ? '<span class="badge bg-success">Sí</span>'
            : '<span class="badge bg-danger">No</span>';
        const photoCell = e['5_Sample_picture']
            ? `<img class="table-photo"
                    src="${photoUrl(e['5_Sample_picture'], 'entry_thumb')}"
                    data-uuid="${e.ec5_uuid}"
                    alt=""
                    onerror="this.style.display='none'">`
            : '<span class="text-muted">—</span>';

        return `<tr>
            <td>${esc(e['1_Common_Name'])}</td>
            <td><em>${esc(e['2_Scientific_Name'])}</em></td>
            <td class="text-center">${cultBadge}</td>
            <td class="text-center">${natBadge}</td>
            <td class="text-center">${e['6_Individual_Count'] ?? '—'}</td>
            <td>${esc(e['7_Locality'])}</td>
            <td class="obs-cell text-muted" title="${esc(e['9_Observations'])}">${esc(e['9_Observations'])}</td>
            <td class="text-nowrap">${date}</td>
            <td class="text-center">${photoCell}</td>
        </tr>`;
    }).join('');
}

// ── Gallery ────────────────────────────────────────────────────────────────
function renderGallery() {
    const withPhotos = filteredEntries.filter(e => e['5_Sample_picture']);
    const grid  = document.getElementById('gallery-grid');
    const empty = document.getElementById('gallery-empty');
    const count = document.getElementById('gallery-count');

    count.textContent = withPhotos.length ? `(${withPhotos.length})` : '';

    if (withPhotos.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('d-none');
        return;
    }

    empty.classList.add('d-none');
    grid.innerHTML = withPhotos.map(e => `
        <div class="col-6 col-sm-4 col-md-3 col-xl-2">
            <img class="gallery-thumb"
                 src="${photoUrl(e['5_Sample_picture'], 'entry_thumb')}"
                 data-uuid="${e.ec5_uuid}"
                 alt="${esc(e['1_Common_Name'])}"
                 loading="lazy"
                 onerror="this.closest('.col-6').style.display='none'">
            <div class="gallery-label">${esc(e['1_Common_Name'])}</div>
        </div>
    `).join('');
}

// ── Photo modal ────────────────────────────────────────────────────────────
function openPhoto(entry) {
    document.getElementById('photo-modal-title').textContent     = entry['1_Common_Name'] || '';
    document.getElementById('photo-modal-scientific').textContent = entry['2_Scientific_Name'] || '';
    document.getElementById('photo-modal-locality').textContent  = entry['7_Locality'] || '';
    document.getElementById('photo-modal-img').src =
        photoUrl(entry['5_Sample_picture'], 'entry_original');
    photoModal.show();
}

// ── Event delegation (table + gallery photos) ──────────────────────────────
document.addEventListener('click', e => {
    const img = e.target.closest('.table-photo, .gallery-thumb');
    if (!img) return;
    const uuid  = img.dataset.uuid;
    const entry = allEntries.find(e => e.ec5_uuid === uuid);
    if (entry) openPhoto(entry);
});

// ── Filters ────────────────────────────────────────────────────────────────
function setupFilters() {
    const searchInput       = document.getElementById('search-input');
    const filterCultivated  = document.getElementById('filter-cultivated');
    const filterNative      = document.getElementById('filter-native');

    function applyFilters() {
        const q    = searchInput.value.toLowerCase().trim();
        const cult = filterCultivated.value;
        const nat  = filterNative.value;

        filteredEntries = allEntries.filter(e => {
            const matchSearch = !q ||
                (e['1_Common_Name']     || '').toLowerCase().includes(q) ||
                (e['2_Scientific_Name'] || '').toLowerCase().includes(q) ||
                (e['7_Locality']        || '').toLowerCase().includes(q) ||
                (e['9_Observations']    || '').toLowerCase().includes(q);
            const matchCult = !cult || e['3_Is_Cultivated'] === cult;
            const matchNat  = !nat  || e['4_Is_Native']     === nat;
            return matchSearch && matchCult && matchNat;
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
    filterCultivated.addEventListener('change', applyFilters);
    filterNative.addEventListener('change', applyFilters);

    document.getElementById('btn-prev').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
    });
    document.getElementById('btn-next').addEventListener('click', () => {
        const total = Math.ceil(filteredEntries.length / TABLE_SIZE);
        if (currentPage < total) { currentPage++; renderTable(); }
    });
}

// ── CSV export ─────────────────────────────────────────────────────────────
function setupExport() {
    document.getElementById('btn-export').addEventListener('click', () => {
        const headers = [
            'UUID', 'Nombre común', 'Nombre científico', 'Cultivada', 'Nativa',
            'Individuos', 'Localidad', 'Latitud', 'Longitud', 'Observaciones', 'Fecha',
        ];
        const rows = filteredEntries.map(e => [
            e.ec5_uuid,
            e['1_Common_Name']       || '',
            e['2_Scientific_Name']   || '',
            e['3_Is_Cultivated']     || '',
            e['4_Is_Native']         || '',
            e['6_Individual_Count']  ?? '',
            e['7_Locality']          || '',
            e['8_10mAccuracy_GPSCoo']?.latitude  ?? '',
            e['8_10mAccuracy_GPSCoo']?.longitude ?? '',
            e['9_Observations']      || '',
            e.created_at             || '',
        ]);
        const csv = [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
        downloadFile(csv, 'semillas.csv', 'text/csv');
    });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function photoUrl(rawValue, format) {
    if (!rawValue) return '';
    // API returns a full URL for the original — swap format for thumbs
    if (rawValue.startsWith('http')) {
        return rawValue.replace(/format=entry_[a-z_]+/, `format=${format}`);
    }
    return `https://five.epicollect.net/api/media/${PROJECT_SLUG}?type=photo&format=${format}&name=${encodeURIComponent(rawValue)}`;
}

function esc(str) {
    if (!str && str !== 0) return '—';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function csvCell(v) {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadFile(content, filename, mime) {
    const blob = new Blob(['﻿' + content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
}
