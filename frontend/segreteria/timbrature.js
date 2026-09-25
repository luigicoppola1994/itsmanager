// ==============================================================================
// timbrature.js — Gestione Timbrature & Presenze per Segreteria
// v4.0 — Layout e UX conformi ad Aule/Corsi (Selezione Corso/Edizione + Tasto Visualizza)
// ==============================================================================

// Helper per chiamate autenticate
async function fetchWithAuth(endpoint, options = {}) {
    const base = typeof API_URL !== 'undefined' ? API_URL : 'http://localhost:8000';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${base}${cleanEndpoint}`;
    
    if (typeof fetchAutenticata === 'function') {
        return await fetchAutenticata(fullUrl, options);
    } else {
        const token = localStorage.getItem('jwt_token');
        if (!options.headers) options.headers = {};
        if (token) options.headers['Authorization'] = `Bearer ${token}`;
        options.credentials = 'include';
        return await fetch(fullUrl, options);
    }
}

// ── STATO APPLICAZIONE ──
let allCorsiMaster = [];
let allCorsiAttivi = [];
let currentEditionStudents = [];
let currentEdizioneId = null;
let currentEdizioneInfo = null;
let currentLezioneInfo = null;
let lezionePrevisitaFlag = false;

let modalTimbraturaInstance = null;
let modalAppelloInstance = null;

// Formatter data odierna YYYY-MM-DD
function getTodayDateStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Inizializzazione al caricamento del DOM
document.addEventListener('DOMContentLoaded', async () => {
    // Modal Bootstrap
    const modalElTimbratura = document.getElementById('modalTimbratura');
    if (modalElTimbratura) modalTimbraturaInstance = new bootstrap.Modal(modalElTimbratura);

    const modalElAppello = document.getElementById('modalAppelloRapido');
    if (modalElAppello) modalAppelloInstance = new bootstrap.Modal(modalElAppello);

    // Imposta data odierna come default
    const filterDataInput = document.getElementById('filterData');
    if (filterDataInput && !filterDataInput.value) {
        filterDataInput.value = getTodayDateStr();
    }
    const appelloDataInput = document.getElementById('appelloData');
    if (appelloDataInput) appelloDataInput.value = getTodayDateStr();

    // Elements
    const selectCorso = document.getElementById('selectCorso');
    const selectEdizione = document.getElementById('selectEdizione');
    const btnVisualizza = document.getElementById('btnVisualizzaTimbrature');
    const noSelectionState = document.getElementById('noSelectionState');
    const timbratureContentLayout = document.getElementById('timbratureContentLayout');

    // Load Corsi ed Edizioni
    await loadCorsiAndEdizioni();

    // Event listeners principali
    setupEventListeners();

    // Check URL params (?id=X oppure ?id_edizione=X)
    const urlParams = new URLSearchParams(window.location.search);
    const urlEdizioneId = parseInt(urlParams.get('id_edizione') || urlParams.get('id'));

    if (urlEdizioneId && selectCorso && selectEdizione) {
        const edFound = allCorsiAttivi.find(e => (e.id_corso_attivo || e.id_edizione) === urlEdizioneId);
        if (edFound) {
            selectCorso.value = edFound.id_corso;
            populateEdizioniSelect(edFound.id_corso);
            selectEdizione.value = urlEdizioneId;
            if (btnVisualizza) btnVisualizza.disabled = false;
            await loadPresenzeData(urlEdizioneId);
        }
    }
});

function setupEventListeners() {
    const selectCorso = document.getElementById('selectCorso');
    const selectEdizione = document.getElementById('selectEdizione');
    const btnVisualizza = document.getElementById('btnVisualizzaTimbrature');
    const noSelectionState = document.getElementById('noSelectionState');
    const timbratureContentLayout = document.getElementById('timbratureContentLayout');
    const searchInput = document.getElementById('searchStudente');

    // Change handler Corso
    if (selectCorso) {
        selectCorso.addEventListener('change', (e) => {
            const idCorso = e.target.value;
            populateEdizioniSelect(idCorso);
            currentEdizioneId = null;
            if (btnVisualizza) btnVisualizza.disabled = true;
            if (noSelectionState) noSelectionState.style.display = 'block';
            if (timbratureContentLayout) timbratureContentLayout.style.display = 'none';
            history.replaceState(null, '', window.location.pathname);
        });
    }

    // Change handler Edizione
    if (selectEdizione) {
        selectEdizione.addEventListener('change', (e) => {
            const idEdiz = parseInt(e.target.value);
            if (!idEdiz) {
                currentEdizioneId = null;
                if (btnVisualizza) btnVisualizza.disabled = true;
                if (noSelectionState) noSelectionState.style.display = 'block';
                if (timbratureContentLayout) timbratureContentLayout.style.display = 'none';
                history.replaceState(null, '', window.location.pathname);
            } else {
                if (btnVisualizza) btnVisualizza.disabled = false;
            }
        });
    }

    // Click handler Visualizza
    if (btnVisualizza) {
        btnVisualizza.addEventListener('click', async () => {
            const idEdiz = parseInt(selectEdizione?.value);
            if (!idEdiz) return;
            history.replaceState(null, '', `${window.location.pathname}?id_edizione=${idEdiz}`);
            await loadPresenzeData(idEdiz);
        });
    }

    // Change Date Filter -> ricarica dati edizione corrente
    // (rimosso - non più presente nella pagina semplificata)

    // Search input debounce
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(renderTableEditionView, 180);
        });
    }

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (typeof logout === 'function') logout();
        else window.location.href = '../login.html';
    });
}

// ── CARICAMENTO CORSI E EDIZIONI ──

async function loadCorsiAndEdizioni() {
    try {
        const [resCorsi, resEdizioni] = await Promise.all([
            fetchWithAuth('/corsi'),
            fetchWithAuth('/corsi-attivi')
        ]);
        if (resCorsi.ok) {
            allCorsiMaster = await resCorsi.json();
            allCorsiMaster.sort((a, b) => (a.Nome || '').localeCompare(b.Nome || '', 'it', { sensitivity: 'base' }));
        }
        if (resEdizioni.ok) {
            allCorsiAttivi = await resEdizioni.json();
        }

        populateCorsiSelect();

        // Popola anche il select del modale Appello Rapido
        const appelloSelect = document.getElementById('appelloEdizioneSelect');
        if (appelloSelect) {
            appelloSelect.innerHTML = '<option value="">-- Seleziona Edizione --</option>';
            allCorsiAttivi.filter(ca => !ca.archiviato).forEach(ca => {
                const cNome = ca.corso ? ca.corso.Nome : `Corso #${ca.id_corso}`;
                const label = `${cNome} — ${ca.etichetta || 'Edizione #' + ca.id_corso_attivo}`;
                appelloSelect.innerHTML += `<option value="${ca.id_corso_attivo}">${escapeHtml(label)}</option>`;
            });
        }
    } catch (e) {
        console.error('Errore nel caricamento di corsi ed edizioni:', e);
        showToast('danger', 'Errore', 'Impossibile caricare corsi ed edizioni.');
    }
}

function populateCorsiSelect() {
    const corsoSelect = document.getElementById('selectCorso');
    if (!corsoSelect) return;

    corsoSelect.innerHTML = '<option value="">-- Seleziona un Corso --</option>';
    allCorsiMaster.forEach(c => {
        const edizioniCount = allCorsiAttivi.filter(ca => ca.id_corso === c.id_corso && !ca.archiviato).length;
        corsoSelect.innerHTML += `<option value="${c.id_corso}">${escapeHtml(c.Nome)} (${edizioniCount} ediz.)</option>`;
    });
}

function populateEdizioniSelect(idCorso) {
    const edizioneSelect = document.getElementById('selectEdizione');
    const btnVisualizza = document.getElementById('btnVisualizzaTimbrature');
    if (!edizioneSelect) return;

    edizioneSelect.innerHTML = '';
    if (!idCorso) {
        edizioneSelect.innerHTML = '<option value="">-- Prima seleziona un corso --</option>';
        edizioneSelect.disabled = true;
        if (btnVisualizza) btnVisualizza.disabled = true;
        return;
    }

    const edizioniFiltrate = allCorsiAttivi.filter(ca => String(ca.id_corso) === String(idCorso) && !ca.archiviato);

    if (edizioniFiltrate.length === 0) {
        edizioneSelect.innerHTML = '<option value="">-- Nessuna edizione attiva per questo corso --</option>';
        edizioneSelect.disabled = true;
        if (btnVisualizza) btnVisualizza.disabled = true;
    } else {
        edizioneSelect.disabled = false;
        edizioneSelect.innerHTML = '<option value="">-- Seleziona un\'Edizione --</option>';
        edizioniFiltrate.forEach(ca => {
            const edId = ca.id_corso_attivo || ca.id_edizione;
            const label = ca.etichetta || `Edizione #${edId}`;
            const dateRange = (ca.data_inizio && ca.data_fine)
                ? ` (${formatDateItalian(ca.data_inizio)} - ${formatDateItalian(ca.data_fine)})`
                : '';
            edizioneSelect.innerHTML += `<option value="${edId}">${escapeHtml(label)}${dateRange}</option>`;
        });
        if (btnVisualizza) btnVisualizza.disabled = true;
    }
}

// ── CARICAMENTO REGISTRO PRESENZE PER EDIZIONE ──

async function loadPresenzeData(idEdizione) {
    if (!idEdizione) return;

    currentEdizioneId = idEdizione;
    const targetDate = document.getElementById('filterData')?.value || getTodayDateStr();

    const noSelectionState = document.getElementById('noSelectionState');
    const timbratureContentLayout = document.getElementById('timbratureContentLayout');

    if (noSelectionState) noSelectionState.style.display = 'none';
    if (timbratureContentLayout) timbratureContentLayout.style.display = 'block';

    const tbody = document.getElementById('tbodyTimbrature');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" class="text-center py-5 text-muted">
                    <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    Caricamento registro studenti in corso...
                </td>
            </tr>
        `;
    }

    // Carica info edizione per l'intestazione
    try {
        const resEd = await fetchWithAuth(`/corsi-attivi/${idEdizione}`);
        if (resEd.ok) {
            currentEdizioneInfo = await resEd.json();
            const titleEl = document.getElementById('registroEdizioneTitle');
            if (titleEl) {
                const corsoNome = currentEdizioneInfo.corso ? currentEdizioneInfo.corso.Nome : 'Edizione';
                const edLabel = currentEdizioneInfo.etichetta || `Edizione #${idEdizione}`;
                titleEl.textContent = `${corsoNome} — ${edLabel}`;
            }
        }
    } catch (e) {
        console.error('Errore recupero info edizione:', e);
    }

    try {
        const res = await fetchWithAuth(`/presenze/appello/${idEdizione}?data_presenza=${targetDate}`);
        if (!res.ok) throw new Error('Errore nel recupero presenze dell\'edizione');
        
        const data = await res.json();
        currentEditionStudents = data.studenti || [];

        renderTableEditionView();
    } catch (err) {
        console.error('Errore nel caricamento presenze:', err);
        showToast('danger', 'Errore Caricamento', err.message);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="2" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>Errore durante il caricamento dei dati. Riprova.
                    </td>
                </tr>
            `;
        }
    }
}

// ── BANNER STATO LEZIONE ──

function updateLessonBanner(lezioni, prevista) {
    const banner = document.getElementById('lessonStatusBanner');
    if (!banner) return;

    if (prevista === null || prevista === undefined) {
        banner.style.display = 'none';
        return;
    }

    banner.style.display = 'block';

    if (prevista) {
        const lezioneStr = (lezioni && lezioni.length > 0)
            ? lezioni.map(l => `${l.ora_inizio}–${l.ora_fine}${l.modulo ? ` · ${l.modulo}` : ''}`).join('  |  ')
            : 'Orario non specificato';
        banner.innerHTML = `
            <div class="lesson-banner lesson-banner-ok">
                <div class="lesson-banner-icon"><i class="bi bi-calendar-check-fill"></i></div>
                <div class="lesson-banner-body">
                    <div class="lesson-banner-title">Lezione prevista per questa data</div>
                    <div class="lesson-banner-sub">${escapeHtml(lezioneStr)}</div>
                </div>
                <div class="lesson-banner-badge"><span class="badge bg-success fs-6">Timbrature attive</span></div>
            </div>
        `;
    } else {
        banner.innerHTML = `
            <div class="lesson-banner lesson-banner-warn">
                <div class="lesson-banner-icon"><i class="bi bi-calendar-x-fill"></i></div>
                <div class="lesson-banner-body">
                    <div class="lesson-banner-title">Nessuna lezione in calendario per questa data</div>
                    <div class="lesson-banner-sub">Non ci sono lezioni pianificate nel calendario per il giorno selezionato. Vai al <a href="calendario.html" class="text-warning fw-bold">Calendario</a> per pianificare lezioni.</div>
                </div>
                <div class="lesson-banner-badge"><span class="badge bg-warning text-dark fs-6">Nessuna Lezione</span></div>
            </div>
        `;
    }

    const btnAppello = document.getElementById('btnOpenAppelloRapido');
    if (btnAppello) {
        btnAppello.disabled = !prevista;
        btnAppello.title = prevista ? 'Apri appello rapido' : 'Non ci sono lezioni programmate per questa data';
    }
}

// ── RENDERING TABELLA REGISTRO STUDENTI ──

function renderTableEditionView() {
    const tbody = document.getElementById('tbodyTimbrature');
    const badgeCount = document.getElementById('badgeCount');
    const searchQuery = (document.getElementById('searchStudente')?.value || '').toLowerCase().trim();

    if (!tbody) return;

    let filtered = currentEditionStudents;
    if (searchQuery) {
        filtered = currentEditionStudents.filter(s => {
            const fullName = `${s.nome} ${s.cognome} ${s.email || ''} ${s.codice_fiscale || ''}`.toLowerCase();
            return fullName.includes(searchQuery);
        });
    }

    if (badgeCount) {
        badgeCount.textContent = `${filtered.length} student${filtered.length === 1 ? 'e' : 'i'}`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" class="text-center py-5 text-muted">
                    <div class="mb-2"><i class="bi bi-people fs-1 text-secondary"></i></div>
                    <div class="fw-bold text-dark fs-6 mb-1">Nessuno studente trovato</div>
                    <div class="small text-muted mb-3">Nessuno studente corrisponde ai criteri di ricerca o è iscritto all'aula.</div>
                    ${currentEdizioneId ? `
                        <a href="aule.html?id=${currentEdizioneId}" class="btn btn-primary btn-sm fw-bold">
                            <i class="bi bi-person-plus-fill me-1"></i>Assegna Studenti all'Edizione
                        </a>
                    ` : ''}
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtered.forEach(s => {
        const initials = `${(s.nome || '')[0] || ''}${(s.cognome || '')[0] || ''}`.toUpperCase() || 'ST';
        const dettaglioUrl = `dettaglio-timbrature.html?id_utente=${s.id_utente}&id_edizione=${currentEdizioneId || ''}`;

        html += `
            <tr>
                <td class="ps-4">
                    <a href="${dettaglioUrl}" class="d-flex align-items-center gap-3 text-decoration-none text-dark py-1">
                        <div class="student-avatar">${initials}</div>
                        <div>
                            <div class="fw-bold text-dark">${escapeHtml(s.cognome)} ${escapeHtml(s.nome)}</div>
                            <div class="small text-muted">${escapeHtml(s.email || s.codice_fiscale || 'Studente')}</div>
                        </div>
                    </a>
                </td>
                <td class="text-end pe-4">
                    <a href="${dettaglioUrl}" class="btn btn-sm btn-primary fw-bold d-inline-flex align-items-center gap-1">
                        <i class="bi bi-clock-history"></i> Visualizza Timbrature
                    </a>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ── APPELLO RAPIDO BATCH ──

function openModalAppelloRapido() {
    if (!lezionePrevisitaFlag) {
        showToast('warning', 'Nessuna lezione prevista', 'Non è possibile fare l\'appello senza una lezione pianificata nel calendario per questa data.');
        return;
    }
    const appelloSelect = document.getElementById('appelloEdizioneSelect');
    if (appelloSelect && currentEdizioneId) appelloSelect.value = currentEdizioneId;
    
    const filterDataVal = document.getElementById('filterData')?.value || getTodayDateStr();
    if (document.getElementById('appelloData')) {
        document.getElementById('appelloData').value = filterDataVal;
    }

    const defaultIn = currentLezioneInfo?.[0]?.ora_inizio || '09:00';
    const defaultOut = currentLezioneInfo?.[0]?.ora_fine || '13:00';
    if (document.getElementById('appelloOraInDefault')) document.getElementById('appelloOraInDefault').value = defaultIn;
    if (document.getElementById('appelloOraOutDefault')) document.getElementById('appelloOraOutDefault').value = defaultOut;

    modalAppelloInstance?.show();
    loadAppelloStudentiList();
}

async function loadAppelloStudentiList() {
    const idEdizione = document.getElementById('appelloEdizioneSelect')?.value;
    const dataAppello = document.getElementById('appelloData')?.value || getTodayDateStr();
    const tbody = document.getElementById('tbodyAppello');

    if (!tbody) return;

    if (!idEdizione) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Seleziona un'edizione per visualizzare gli studenti iscritti.</td></tr>`;
        return;
    }

    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Caricamento studenti...</td></tr>`;

    try {
        const res = await fetchWithAuth(`/presenze/appello/${idEdizione}?data_presenza=${dataAppello}`);
        if (!res.ok) throw new Error('Errore caricamento studenti');
        const data = await res.json();

        if (!data.studenti || data.studenti.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-warning"><i class="bi bi-info-circle me-1"></i>Nessuno studente iscritto a questa edizione.</td></tr>`;
            return;
        }

        const defaultIn = document.getElementById('appelloOraInDefault')?.value || '09:00';
        const defaultOut = document.getElementById('appelloOraOutDefault')?.value || '13:00';

        let html = '';
        data.studenti.forEach(s => {
            const isPresent = s.presente !== false;
            const oraIn = s.ora_ingresso || (isPresent ? defaultIn : '');
            const oraOut = s.ora_uscita || (isPresent ? defaultOut : '');

            html += `
                <tr class="batch-student-row ${isPresent ? '' : 'is-absent'}" id="appelloRow_${s.id_utente}">
                    <td class="text-center">
                        <input class="form-check-input student-presence-checkbox" type="checkbox" 
                               data-id="${s.id_utente}" ${isPresent ? 'checked' : ''} 
                               onchange="toggleStudentPresenceRow(${s.id_utente})">
                    </td>
                    <td>
                        <div class="fw-bold">${escapeHtml(s.cognome)} ${escapeHtml(s.nome)}</div>
                        <div class="small text-muted">${escapeHtml(s.email || s.codice_fiscale || '')}</div>
                    </td>
                    <td>
                        <input type="time" class="form-control form-control-sm" 
                               id="appelloIn_${s.id_utente}" value="${oraIn}" ${!isPresent ? 'disabled' : ''}>
                    </td>
                    <td>
                        <input type="time" class="form-control form-control-sm" 
                               id="appelloOut_${s.id_utente}" value="${oraOut}" ${!isPresent ? 'disabled' : ''}>
                    </td>
                    <td>
                        <input type="text" class="form-control form-control-sm" 
                               id="appelloNote_${s.id_utente}" placeholder="Note..." value="${escapeHtml(s.note || '')}">
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Errore durante il recupero studenti.</td></tr>`;
    }
}

window.toggleStudentPresenceRow = function(idUtente) {
    const row = document.getElementById(`appelloRow_${idUtente}`);
    const chk = row?.querySelector('.student-presence-checkbox');
    const inInput = document.getElementById(`appelloIn_${idUtente}`);
    const outInput = document.getElementById(`appelloOut_${idUtente}`);
    const defaultIn = document.getElementById('appelloOraInDefault')?.value || '09:00';
    const defaultOut = document.getElementById('appelloOraOutDefault')?.value || '13:00';

    if (chk && chk.checked) {
        row.classList.remove('is-absent');
        if (inInput) {
            inInput.disabled = false;
            if (!inInput.value) inInput.value = defaultIn;
        }
        if (outInput) {
            outInput.disabled = false;
            if (!outInput.value) outInput.value = defaultOut;
        }
    } else if (row) {
        row.classList.add('is-absent');
        if (inInput) inInput.disabled = true;
        if (outInput) outInput.disabled = true;
    }
};

function setAllPresenceState(present) {
    const checkboxes = document.querySelectorAll('.student-presence-checkbox');
    checkboxes.forEach(chk => {
        chk.checked = present;
        const id = chk.dataset.id;
        toggleStudentPresenceRow(id);
    });
}

async function handleSaveBatchAppello() {
    const idEdizione = document.getElementById('appelloEdizioneSelect')?.value;
    const dataAppello = document.getElementById('appelloData')?.value;

    if (!idEdizione || !dataAppello) {
        showToast('warning', 'Campi Mancanti', 'Seleziona edizione e data dell\'appello.');
        return;
    }

    const rows = document.querySelectorAll('.batch-student-row');
    if (rows.length === 0) {
        showToast('warning', 'Lista Vuota', 'Nessuno studente presente nella lista.');
        return;
    }

    const presenzeList = [];
    rows.forEach(row => {
        const chk = row.querySelector('.student-presence-checkbox');
        const idUtente = parseInt(chk.dataset.id);
        const isPresent = chk.checked;
        const oraIn = document.getElementById(`appelloIn_${idUtente}`)?.value || null;
        const oraOut = document.getElementById(`appelloOut_${idUtente}`)?.value || null;
        const note = document.getElementById(`appelloNote_${idUtente}`)?.value || '';
        presenzeList.push({
            id_utente: idUtente,
            presente: isPresent,
            ora_ingresso: (isPresent && oraIn) ? `${oraIn}:00` : null,
            ora_uscita: (isPresent && oraOut) ? `${oraOut}:00` : null,
            note: note
        });
    });

    const payload = { data_presenza: dataAppello, id_corso_attivo: parseInt(idEdizione), presenze: presenzeList };
    const btnSalva = document.getElementById('btnSalvaAppello');
    if (btnSalva) { btnSalva.disabled = true; btnSalva.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvataggio...'; }

    try {
        const res = await fetchWithAuth('/presenze/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Errore salvataggio registro'); }
        const result = await res.json();
        modalAppelloInstance?.hide();
        if (currentEdizioneId) await loadPresenzeData(currentEdizioneId);
        showToast('success', 'Appello salvato!', `${result.salvate} presenze registrate/aggiornate con successo.`);
    } catch (err) {
        showToast('danger', 'Errore Salvataggio', err.message);
    } finally {
        if (btnSalva) { btnSalva.disabled = false; btnSalva.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-1"></i>Salva Registro Presenze'; }
    }
}

// ── TOAST NOTIFICATIONS ──

function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const colorMap = { success: 'bg-success', warning: 'bg-warning text-dark', danger: 'bg-danger', info: 'bg-info text-dark' };
    const iconMap = { success: 'bi-check-circle-fill', warning: 'bi-exclamation-triangle-fill', danger: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
    const id = `toast_${Date.now()}`;

    const html = `
        <div id="${id}" class="toast align-items-center text-white border-0 ${colorMap[type] || 'bg-secondary'}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body d-flex align-items-start gap-2">
                    <i class="bi ${iconMap[type] || 'bi-bell'} fs-5 mt-1 flex-shrink-0"></i>
                    <div>
                        <div class="fw-bold">${escapeHtml(title)}</div>
                        <div class="small">${escapeHtml(message)}</div>
                    </div>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    const toastEl = document.getElementById(id);
    const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
    bsToast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// ── UTILITIES ──

function calculateHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return '—';
    const minIn = timeToMinutes(timeIn);
    const minOut = timeToMinutes(timeOut);
    if (minIn === null || minOut === null || minOut <= minIn) return '0h 00m';
    return formatMinutesToHours(minOut - minIn);
}

function formatMinutesToHours(minuti) {
    if (!minuti || minuti <= 0) return '0h 00m';
    const h = Math.floor(minuti / 60);
    const m = minuti % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

function timeToMinutes(tStr) {
    if (!tStr) return null;
    const clean = String(tStr).substring(0, 5);
    const parts = clean.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
}

function formatDateItalian(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function exportCSV() {
    if (!currentEditionStudents || currentEditionStudents.length === 0) {
        showToast('warning', 'Nessun dato', 'Nessun dato da esportare.');
        return;
    }

    const dataSel = document.getElementById('filterData')?.value || getTodayDateStr();
    let csv = 'ID_UTENTE;COGNOME;NOME;EMAIL;CODICE_FISCALE;DATA;PRESENTE;ORA_INGRESSO;ORA_USCITA;ORE_EFFETTIVE;NOTE\n';
    
    currentEditionStudents.forEach(item => {
        const cognome = item.cognome || '';
        const nome = item.nome || '';
        const email = item.email || '';
        const cf = item.codice_fiscale || '';
        const dataP = item.data_presenza || dataSel;
        const pres = item.presente !== false ? 'SI' : 'NO';
        const oraIn = item.ora_ingresso ? item.ora_ingresso.substring(0, 5) : '';
        const oraOut = item.ora_uscita ? item.ora_uscita.substring(0, 5) : '';
        const ore = calculateHours(oraIn, oraOut);
        const note = (item.note || '').replace(/"/g, '""');

        csv += `${item.id_utente};"${cognome}";"${nome}";"${email}";"${cf}";"${dataP}";"${pres}";"${oraIn}";"${oraOut}";"${ore}";"${note}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `registro_presenze_${dataSel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
