// ==============================================================================
// timbrature.js — Gestione Timbrature & Presenze per Segreteria
// v3.0 — Con validazione calendario: timbrature solo quando previsto dal calendario
// ==============================================================================

// Helper per eseguire chiamate autenticate
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
let currentPresenze = [];
let currentLezioneInfo = null;      // Info sulla lezione del giorno dal calendario
let lezionePrevisitaFlag = false;   // True se c'è una lezione programmata per la data selezionata
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
    // Inizializza i modali Bootstrap
    const modalElTimbratura = document.getElementById('modalTimbratura');
    if (modalElTimbratura) {
        modalTimbraturaInstance = new bootstrap.Modal(modalElTimbratura);
    }
    const modalElAppello = document.getElementById('modalAppelloRapido');
    if (modalElAppello) {
        modalAppelloInstance = new bootstrap.Modal(modalElAppello);
    }

    // Imposta data di default ad oggi su tutti i campi data
    const today = getTodayDateStr();
    ['filterData', 'appelloData', 'inputDataPresenza'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });

    // Carica Corsi e Edizioni
    await loadCorsiAndEdizioni();

    // Event listeners
    setupEventListeners();

    // Carica subito la vista iniziale
    await loadPresenzeData();
});

function setupEventListeners() {
    // Dropdown Corso: al cambio aggiorna il dropdown Edizioni e ricarica
    document.getElementById('filterCorso')?.addEventListener('change', onCorsoChange);

    // Dropdown Edizione: al cambio ricarica gli studenti dell'edizione
    document.getElementById('filterEdizione')?.addEventListener('change', loadPresenzeData);

    // Data Presenza
    document.getElementById('filterData')?.addEventListener('change', loadPresenzeData);
    document.getElementById('btnOggi')?.addEventListener('click', () => {
        document.getElementById('filterData').value = getTodayDateStr();
        loadPresenzeData();
    });

    // Aggiorna manuale
    document.getElementById('btnApplicaFiltri')?.addEventListener('click', loadPresenzeData);

    // Ricerca testuale con debounce
    let searchTimeout;
    document.getElementById('searchStudente')?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderTable, 180);
    });

    // Modale Nuova Timbratura
    document.getElementById('btnNuovaTimbratura')?.addEventListener('click', openModalNuovaTimbratura);
    document.getElementById('formTimbratura')?.addEventListener('submit', handleSaveTimbratura);

    // Modale Appello Rapido
    document.getElementById('btnOpenAppelloRapido')?.addEventListener('click', openModalAppelloRapido);
    document.getElementById('appelloEdizioneSelect')?.addEventListener('change', loadAppelloStudentiList);
    document.getElementById('appelloData')?.addEventListener('change', loadAppelloStudentiList);
    document.getElementById('btnSegnaTuttiPresenti')?.addEventListener('click', () => setAllPresenceState(true));
    document.getElementById('btnSegnaTuttiAssenti')?.addEventListener('click', () => setAllPresenceState(false));
    document.getElementById('btnSalvaAppello')?.addEventListener('click', handleSaveBatchAppello);

    // Esportazione CSV
    document.getElementById('btnExportCSV')?.addEventListener('click', exportCSV);

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
        if (resCorsi.ok) allCorsiMaster = await resCorsi.json();
        if (resEdizioni.ok) allCorsiAttivi = await resEdizioni.json();

        const corsoSelect = document.getElementById('filterCorso');
        if (corsoSelect) {
            corsoSelect.innerHTML = '<option value="">-- Seleziona un Corso --</option>';
            allCorsiMaster.forEach(c => {
                const edizioniCount = allCorsiAttivi.filter(ca => ca.id_corso === c.id_corso && !ca.archiviato).length;
                corsoSelect.innerHTML += `<option value="${c.id_corso}">${escapeHtml(c.Nome)} (${edizioniCount} ediz.)</option>`;
            });
            if (allCorsiMaster.length > 0) {
                corsoSelect.value = allCorsiMaster[0].id_corso;
                onCorsoChange();
            }
        }

        // Popola select appello rapido
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
    }
}

function onCorsoChange() {
    const idCorso = document.getElementById('filterCorso')?.value;
    const edizioneSelect = document.getElementById('filterEdizione');

    if (!edizioneSelect) return;

    if (!idCorso) {
        edizioneSelect.innerHTML = '<option value="">-- Seleziona prima un corso --</option>';
        edizioneSelect.disabled = true;
        loadPresenzeData();
        return;
    }

    // Filtra le edizioni di quel corso
    const edizioniFiltrate = allCorsiAttivi.filter(ca => String(ca.id_corso) === String(idCorso) && !ca.archiviato);

    if (edizioniFiltrate.length === 0) {
        edizioneSelect.innerHTML = '<option value="">Nessuna edizione attiva per questo corso</option>';
        edizioneSelect.disabled = true;
    } else {
        edizioneSelect.disabled = false;
        edizioneSelect.innerHTML = '';
        edizioniFiltrate.forEach((ca, idx) => {
            const label = ca.etichetta || `Edizione #${ca.id_corso_attivo} (${ca.data_inizio || 'N.D.'})`;
            edizioneSelect.innerHTML += `<option value="${ca.id_corso_attivo}">${escapeHtml(label)}</option>`;
        });
        // Seleziona la prima edizione
        edizioneSelect.value = edizioniFiltrate[0].id_corso_attivo;
    }

    loadPresenzeData();
}

// ── CARICAMENTO PRESENZE ──
async function loadPresenzeData() {
    const idEdizione = document.getElementById('filterEdizione')?.value || '';
    const targetDate = document.getElementById('filterData')?.value || getTodayDateStr();

    const tbody = document.getElementById('tbodyTimbrature');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-muted">
                    <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    Caricamento in corso...
                </td>
            </tr>
        `;
    }

    const labelData = document.getElementById('labelDataSelezionata');
    if (labelData) labelData.textContent = `Data: ${formatDateItalian(targetDate)}`;

    // Reset banner lezione
    updateLessonBanner(null, null);

    try {
        if (idEdizione) {
            const res = await fetchWithAuth(`/presenze/appello/${idEdizione}?data_presenza=${targetDate}`);
            if (!res.ok) throw new Error('Errore nel recupero presenze edizione');
            const data = await res.json();
            currentEditionStudents = data.studenti || [];
            lezionePrevisitaFlag = data.lezione_prevista || false;
            currentLezioneInfo = data.lezioni || [];

            updateLessonBanner(currentLezioneInfo, lezionePrevisitaFlag);
            updateKPIsFromAppello(currentEditionStudents);
            renderTableEditionView();
        } else {
            lezionePrevisitaFlag = true; // Vista generale: non bloccare
            currentLezioneInfo = null;
            updateLessonBanner(null, null); // nasconde banner in vista generale
            const res = await fetchWithAuth(`/presenze?data_presenza=${targetDate}`);
            if (!res.ok) throw new Error('Errore nel recupero registro');
            currentPresenze = await res.json();
            await loadGeneralStats(targetDate);
            renderTableGeneralView();
        }
    } catch (err) {
        console.error('Errore nel caricamento presenze:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>Errore nel caricamento dei dati. Riprova.
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
                    <div class="lesson-banner-sub">Le timbrature possono essere registrate solo nelle giornate con lezioni pianificate. Vai al <a href="calendario.html" class="text-warning fw-bold">Calendario</a> per aggiungere lezioni.</div>
                </div>
                <div class="lesson-banner-badge"><span class="badge bg-warning text-dark fs-6">Timbrature disabilitate</span></div>
            </div>
        `;
    }

    const btnNuova = document.getElementById('btnNuovaTimbratura');
    const btnAppello = document.getElementById('btnOpenAppelloRapido');
    if (btnNuova) {
        btnNuova.disabled = !prevista;
        btnNuova.title = prevista ? 'Registra nuova timbratura' : 'Non ci sono lezioni programmate per questa data';
    }
    if (btnAppello) {
        btnAppello.disabled = !prevista;
        btnAppello.title = prevista ? 'Apri appello rapido' : 'Non ci sono lezioni programmate per questa data';
    }
}

// ── RENDERING TABELLA: VISTA STUDENTI EDIZIONE CORSO ──

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
        badgeCount.textContent = `${filtered.length} studenti iscritti`;
    }

    if (filtered.length === 0) {
        const idEdizione = document.getElementById('filterEdizione')?.value;
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-muted">
                    <div class="mb-2"><i class="bi bi-people fs-1 text-secondary"></i></div>
                    <div class="fw-bold text-dark fs-6 mb-1">Nessuno studente iscritto a questa edizione</div>
                    <div class="small text-muted mb-3">Assegna gli studenti a quest'aula per registrare e visualizzare le loro timbrature.</div>
                    ${idEdizione ? `
                        <a href="aule.html?id=${idEdizione}" class="btn btn-primary btn-sm fw-bold">
                            <i class="bi bi-person-plus-fill me-1"></i>Assegna Studenti all'Edizione (Gestione Aula)
                        </a>
                    ` : ''}
                </td>
            </tr>
        `;
        return;
    }

    const targetDate = document.getElementById('filterData')?.value || getTodayDateStr();
    let html = '';

    filtered.forEach(s => {
        const initials = `${(s.nome || '')[0] || ''}${(s.cognome || '')[0] || ''}`.toUpperCase() || 'ST';
        const isPresent = s.presente === true;
        const oraIn = s.ora_ingresso ? s.ora_ingresso.substring(0, 5) : null;
        const oraOut = s.ora_uscita ? s.ora_uscita.substring(0, 5) : null;
        const oreEffettive = calculateHours(oraIn, oraOut);

        const isRitardo = s.note && s.note.toLowerCase().includes('ritardo');
        const badgeIngressoClass = isRitardo ? 'time-badge-late' : (oraIn ? 'time-badge-in' : 'time-badge-none');
        const badgeUscitaClass = oraOut ? 'time-badge-out' : 'time-badge-none';

        let statoBadge = '';
        if (isPresent) {
            if (isRitardo) {
                statoBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>Ritardo</span>';
            } else if (s.note && s.note.toLowerCase().includes('uscita')) {
                statoBadge = '<span class="badge bg-info text-dark"><i class="bi bi-box-arrow-right me-1"></i>Uscita Anticipata</span>';
            } else {
                statoBadge = '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Presente</span>';
            }
        } else {
            statoBadge = '<span class="badge bg-secondary"><i class="bi bi-dash-circle me-1"></i>Non timbrato</span>';
        }

        // Azioni condizionate dalla disponibilità della lezione
        let azioniHtml = '';
        if (lezionePrevisitaFlag) {
            if (isPresent) {
                azioniHtml = `
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="openModalModificaDaAppello(${s.id_utente})" title="Modifica Timbratura">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="eliminaTimbraturaDaAppello(${s.id_presenza})" title="Elimina / Segna Assente">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                `;
            } else {
                azioniHtml = `
                    <button class="btn btn-sm btn-success fw-bold px-3" onclick="registraTimbraturaRapida(${s.id_utente})" title="Registra Presenza Ora">
                        <i class="bi bi-plus-lg me-1"></i>Timbra
                    </button>
                `;
            }
        } else {
            azioniHtml = `<span class="text-muted small"><i class="bi bi-lock-fill me-1"></i>Nessuna lezione</span>`;
        }

        html += `
            <tr class="${isPresent ? 'row-present' : 'row-absent'}">
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        <div class="student-avatar" style="${!isPresent ? 'background:#94a3b8;' : ''}">${initials}</div>
                        <div>
                            <div class="fw-bold text-dark">${escapeHtml(s.cognome)} ${escapeHtml(s.nome)}</div>
                            <div class="small text-muted">${escapeHtml(s.email || s.codice_fiscale || 'Studente')}</div>
                        </div>
                    </div>
                </td>
                <td>
                    ${oraIn ? `<span class="time-badge time-badge-in"><i class="bi bi-box-arrow-in-right"></i> ${oraIn}</span>` : '<span class="time-badge time-badge-none">—</span>'}
                </td>
                <td>
                    ${oraOut ? `<span class="time-badge time-badge-out"><i class="bi bi-box-arrow-right"></i> ${oraOut}</span>` : '<span class="time-badge time-badge-none">—</span>'}
                </td>
                <td>
                    <span class="fw-bold ${isPresent ? 'text-primary' : 'text-muted'}">${oreEffettive}</span>
                </td>
                <td>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        ${statoBadge}
                        ${s.note ? `<span class="small text-muted" title="${escapeHtml(s.note)}"><i class="bi bi-chat-left-text"></i> ${escapeHtml(s.note)}</span>` : ''}
                    </div>
                </td>
                <td class="text-end pe-4">
                    ${azioniHtml}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ── RENDERING TABELLA: VISTA GENERALE ──

function renderTableGeneralView() {
    const tbody = document.getElementById('tbodyTimbrature');
    const badgeCount = document.getElementById('badgeCount');
    const searchQuery = (document.getElementById('searchStudente')?.value || '').toLowerCase().trim();

    if (!tbody) return;

    let filtered = currentPresenze;
    if (searchQuery) {
        filtered = currentPresenze.filter(p => {
            const u = p.utente;
            if (!u) return false;
            const fullName = `${u.Nome} ${u.Cognome} ${u.Email} ${u.Codice_Fiscale || ''}`.toLowerCase();
            return fullName.includes(searchQuery);
        });
    }

    if (badgeCount) badgeCount.textContent = `${filtered.length} record`;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <div class="mb-2"><i class="bi bi-inbox fs-2 text-secondary"></i></div>
                    Nessuna timbratura registrata per la data selezionata.
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtered.forEach(p => {
        const u = p.utente || { Nome: 'Utente', Cognome: `#${p.id_utente}` };
        const initials = `${(u.Nome || '')[0] || ''}${(u.Cognome || '')[0] || ''}`.toUpperCase() || 'ST';
        const oraIn = p.ora_ingresso ? p.ora_ingresso.substring(0, 5) : null;
        const oraOut = p.ora_uscita ? p.ora_uscita.substring(0, 5) : null;
        const oreEffettive = calculateHours(oraIn, oraOut);

        const isRitardo = p.note && p.note.toLowerCase().includes('ritardo');
        const badgeIngressoClass = isRitardo ? 'time-badge-late' : (oraIn ? 'time-badge-in' : 'time-badge-none');
        const badgeUscitaClass = oraOut ? 'time-badge-out' : 'time-badge-none';

        html += `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        <div class="student-avatar">${initials}</div>
                        <div>
                            <div class="fw-bold text-dark">${escapeHtml(u.Cognome)} ${escapeHtml(u.Nome)}</div>
                            <div class="small text-muted">${escapeHtml(u.Email || u.Codice_Fiscale || 'Studente')}</div>
                        </div>
                    </div>
                </td>
                <td class="fw-semibold text-secondary">${formatDateItalian(p.data_presenza)}</td>
                <td>${oraIn ? `<span class="time-badge ${badgeIngressoClass}"><i class="bi bi-box-arrow-in-right"></i> ${oraIn}</span>` : '—'}</td>
                <td>${oraOut ? `<span class="time-badge ${badgeUscitaClass}"><i class="bi bi-box-arrow-right"></i> ${oraOut}</span>` : '—'}</td>
                <td><span class="fw-bold text-primary">${oreEffettive}</span></td>
                <td>
                    <span class="badge ${isRitardo ? 'bg-warning text-dark' : 'bg-success'}">${isRitardo ? 'Ritardo' : 'Presente'}</span>
                    ${p.note ? `<span class="small text-muted ms-1">${escapeHtml(p.note)}</span>` : ''}
                </td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminaTimbraturaDaAppello(${p.id_presenza})">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderTable() {
    const idEdizione = document.getElementById('filterEdizione')?.value;
    if (idEdizione) renderTableEditionView();
    else renderTableGeneralView();
}

// ── AGGIORNAMENTO STATISTICHE / KPI ──

function updateKPIsFromAppello(studenti) {
    const total = studenti.length;
    const presenti = studenti.filter(s => s.presente === true).length;
    const ritardi = studenti.filter(s => s.presente && s.note && s.note.toLowerCase().includes('ritardo')).length;
    const assenti = total - presenti;
    const percPresenza = total > 0 ? Math.round((presenti / total) * 100) : 0;

    document.getElementById('kpiPresenti').textContent = presenti;
    document.getElementById('kpiRitardi').textContent = ritardi;
    document.getElementById('kpiAssenti').textContent = assenti;
    document.getElementById('kpiTotaleStudenti').textContent = total;

    const progressBar = document.getElementById('presenzaProgressBar');
    if (progressBar) {
        progressBar.style.width = `${percPresenza}%`;
        progressBar.setAttribute('aria-valuenow', percPresenza);
        progressBar.textContent = total > 0 ? `${percPresenza}%` : '';
        progressBar.className = `progress-bar ${percPresenza >= 80 ? 'bg-success' : percPresenza >= 50 ? 'bg-warning' : 'bg-danger'}`;
    }
    const percLabel = document.getElementById('percPresenzaLabel');
    if (percLabel) percLabel.textContent = total > 0 ? `${percPresenza}% di presenze` : '—';
}

async function loadGeneralStats(targetDate) {
    try {
        const res = await fetchWithAuth(`/presenze/stats?data_presenza=${targetDate}`);
        if (res.ok) {
            const stats = await res.json();
            document.getElementById('kpiPresenti').textContent = stats.totale_presenti || 0;
            document.getElementById('kpiRitardi').textContent = stats.ritardi || 0;
            document.getElementById('kpiAssenti').textContent = stats.assenti || 0;
            document.getElementById('kpiTotaleStudenti').textContent = stats.totale_studenti || 0;
        }
    } catch (e) {
        console.error(e);
    }
}

// ── GESTIONE TIMBRATURA SINGOLA ──

function openModalNuovaTimbratura() {
    if (!lezionePrevisitaFlag) {
        showToast('warning', 'Nessuna lezione prevista', 'Non è possibile registrare timbrature senza una lezione pianificata nel calendario per questa data.');
        return;
    }
    document.getElementById('modalTimbraturaTitle').innerHTML = '<i class="bi bi-clock-fill me-2"></i>Registra Nuova Timbratura';
    document.getElementById('editIdPresenza').value = '';
    
    const modalSelect = document.getElementById('inputStudente');
    modalSelect.innerHTML = '<option value="">-- Seleziona uno studente --</option>';
    currentEditionStudents.forEach(s => {
        modalSelect.innerHTML += `<option value="${s.id_utente}">${escapeHtml(s.cognome)} ${escapeHtml(s.nome)}</option>`;
    });
    modalSelect.disabled = false;

    // Pre-popola orari dalla lezione del giorno se disponibili
    const defaultIn = currentLezioneInfo?.[0]?.ora_inizio || '09:00';
    const defaultOut = currentLezioneInfo?.[0]?.ora_fine || '13:00';
    document.getElementById('inputDataPresenza').value = document.getElementById('filterData')?.value || getTodayDateStr();
    document.getElementById('inputOraIngresso').value = defaultIn;
    document.getElementById('inputOraUscita').value = defaultOut;
    document.getElementById('inputNote').value = '';
    modalTimbraturaInstance?.show();
}

window.registraTimbraturaRapida = function(idUtente) {
    if (!lezionePrevisitaFlag) {
        showToast('warning', 'Nessuna lezione prevista', 'Non è possibile registrare timbrature senza una lezione pianificata nel calendario per questa data.');
        return;
    }
    const s = currentEditionStudents.find(item => item.id_utente === idUtente);
    if (!s) return;

    document.getElementById('modalTimbraturaTitle').innerHTML = `<i class="bi bi-clock-fill me-2"></i>Timbratura per ${escapeHtml(s.nome)} ${escapeHtml(s.cognome)}`;
    document.getElementById('editIdPresenza').value = '';
    
    const modalSelect = document.getElementById('inputStudente');
    modalSelect.innerHTML = `<option value="${s.id_utente}" selected>${escapeHtml(s.cognome)} ${escapeHtml(s.nome)}</option>`;
    modalSelect.disabled = true;

    const defaultIn = currentLezioneInfo?.[0]?.ora_inizio || '09:00';
    const defaultOut = currentLezioneInfo?.[0]?.ora_fine || '13:00';
    document.getElementById('inputDataPresenza').value = document.getElementById('filterData')?.value || getTodayDateStr();
    document.getElementById('inputOraIngresso').value = defaultIn;
    document.getElementById('inputOraUscita').value = defaultOut;
    document.getElementById('inputNote').value = '';
    modalTimbraturaInstance?.show();
};

window.openModalModificaDaAppello = function(idUtente) {
    const s = currentEditionStudents.find(item => item.id_utente === idUtente);
    if (!s) return;

    document.getElementById('modalTimbraturaTitle').innerHTML = `<i class="bi bi-pencil-square me-2"></i>Modifica Timbratura di ${escapeHtml(s.nome)} ${escapeHtml(s.cognome)}`;
    document.getElementById('editIdPresenza').value = s.id_presenza || '';
    
    const modalSelect = document.getElementById('inputStudente');
    modalSelect.innerHTML = `<option value="${s.id_utente}" selected>${escapeHtml(s.cognome)} ${escapeHtml(s.nome)}</option>`;
    modalSelect.disabled = true;

    document.getElementById('inputDataPresenza').value = document.getElementById('filterData')?.value || getTodayDateStr();
    document.getElementById('inputOraIngresso').value = s.ora_ingresso ? s.ora_ingresso.substring(0, 5) : '';
    document.getElementById('inputOraUscita').value = s.ora_uscita ? s.ora_uscita.substring(0, 5) : '';
    document.getElementById('inputNote').value = s.note || '';

    modalTimbraturaInstance?.show();
};

async function handleSaveTimbratura(e) {
    e.preventDefault();
    const editId = document.getElementById('editIdPresenza').value;
    const idUtente = parseInt(document.getElementById('inputStudente').value);
    const dataPresenza = document.getElementById('inputDataPresenza').value;
    const oraIn = document.getElementById('inputOraIngresso').value || null;
    const oraOut = document.getElementById('inputOraUscita').value || null;
    const note = document.getElementById('inputNote').value.trim();

    if (!idUtente || !dataPresenza) {
        alert('Seleziona studente e data');
        return;
    }

    const payload = {
        id_utente: idUtente,
        data_presenza: dataPresenza,
        ora_ingresso: oraIn ? `${oraIn}:00` : null,
        ora_uscita: oraOut ? `${oraOut}:00` : null,
        note: note
    };

    try {
        let res;
        if (editId) {
            res = await fetchWithAuth(`/presenze/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetchWithAuth('/presenze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Errore salvataggio');
        }

        modalTimbraturaInstance?.hide();
        await loadPresenzeData();
    } catch (err) {
        alert(`Errore: ${err.message}`);
    }
}

window.eliminaTimbraturaDaAppello = async function(idPresenza) {
    if (!idPresenza) return;
    if (!confirm('Sei sicuro di voler eliminare questa timbratura e segnare lo studente come assente?')) return;

    try {
        const res = await fetchWithAuth(`/presenze/${idPresenza}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Errore durante l\'eliminazione');
        await loadPresenzeData();
    } catch (err) {
        alert(`Impossibile eliminare: ${err.message}`);
    }
};

// ── APPELLO RAPIDO BATCH ──

function openModalAppelloRapido() {
    if (!lezionePrevisitaFlag) {
        showToast('warning', 'Nessuna lezione prevista', 'Non è possibile fare l\'appello senza una lezione pianificata nel calendario per questa data.');
        return;
    }
    const currentEdizione = document.getElementById('filterEdizione')?.value;
    const appelloSelect = document.getElementById('appelloEdizioneSelect');
    if (appelloSelect && currentEdizione) appelloSelect.value = currentEdizione;
    document.getElementById('appelloData').value = document.getElementById('filterData')?.value || getTodayDateStr();

    // Pre-popola orari dalla lezione del giorno
    const defaultIn = currentLezioneInfo?.[0]?.ora_inizio || '09:00';
    const defaultOut = currentLezioneInfo?.[0]?.ora_fine || '13:00';
    if (document.getElementById('appelloOraInDefault')) document.getElementById('appelloOraInDefault').value = defaultIn;
    if (document.getElementById('appelloOraOutDefault')) document.getElementById('appelloOraOutDefault').value = defaultOut;

    // Mostra info lezione nel modal
    const lessonInfoModal = document.getElementById('appelloLessonInfo');
    if (lessonInfoModal && currentLezioneInfo && currentLezioneInfo.length > 0) {
        const lStr = currentLezioneInfo.map(l => `${l.ora_inizio}–${l.ora_fine}${l.modulo ? ` · ${l.modulo}` : ''}`).join(' | ');
        lessonInfoModal.innerHTML = `<i class="bi bi-calendar-check text-success me-1"></i><strong>Lezione:</strong> ${escapeHtml(lStr)}`;
        lessonInfoModal.style.display = '';
    } else if (lessonInfoModal) {
        lessonInfoModal.style.display = 'none';
    }

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
    if (!idEdizione || !dataAppello) { alert('Seleziona edizione e data dell\'appello'); return; }

    const rows = document.querySelectorAll('.batch-student-row');
    if (rows.length === 0) { alert('Nessuno studente presente nella lista'); return; }

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
        await loadPresenzeData();
        showToast('success', 'Appello salvato!', `${result.salvate} presenze registrate/aggiornate con successo.`);
    } catch (err) {
        alert(`Errore: ${err.message}`);
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
    const [hIn, mIn] = timeIn.split(':').map(Number);
    const [hOut, mOut] = timeOut.split(':').map(Number);
    const minTotal = (hOut * 60 + mOut) - (hIn * 60 + mIn);
    if (minTotal <= 0) return '0h 00m';
    const h = Math.floor(minTotal / 60);
    const m = minTotal % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
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
    const list = currentEditionStudents.length > 0 ? currentEditionStudents : currentPresenze;
    if (!list || list.length === 0) {
        alert('Nessun dato da esportare');
        return;
    }

    const dataSel = document.getElementById('filterData')?.value || getTodayDateStr();
    let csv = 'ID_UTENTE;COGNOME;NOME;EMAIL;CODICE_FISCALE;DATA;PRESENTE;ORA_INGRESSO;ORA_USCITA;ORE_EFFETTIVE;NOTE\n';
    
    list.forEach(item => {
        const cognome = item.cognome || item.utente?.Cognome || '';
        const nome = item.nome || item.utente?.Nome || '';
        const email = item.email || item.utente?.Email || '';
        const cf = item.codice_fiscale || item.utente?.Codice_Fiscale || '';
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
