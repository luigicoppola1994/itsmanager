// ==============================================================================
// dettaglio-timbrature.js — Pagina Dettaglio Timbrature Studente (Stile Corsi)
// v1.0 — Gestione Zucchetti week grid & CRUD timbrature con validazione orari
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

// State
let currentStudentId = null;
let currentEdizioneId = null;
let currentStudentData = null;
let currentStudentPresenzeList = [];
let currentWeekMonday = null;
let currentSelectedCalDate = null;
let currentDayMaxLessonMinutes = 0;
let currentLezioneInfo = null;

// Date utilities
function getTodayDateStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

function timeToMinutes(tStr) {
    if (!tStr) return null;
    const clean = String(tStr).substring(0, 5);
    const parts = clean.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
}

function formatMinutesToHours(minuti) {
    if (!minuti || minuti <= 0) return '0h 00m';
    const h = Math.floor(minuti / 60);
    const m = minuti % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

function calculateHours(timeIn, timeOut) {
    if (!timeIn || !timeOut) return '—';
    const minIn = timeToMinutes(timeIn);
    const minOut = timeToMinutes(timeOut);
    if (minIn === null || minOut === null || minOut <= minIn) return '0h 00m';
    return formatMinutesToHours(minOut - minIn);
}

function formatDateItalian(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

// DOM Loaded
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentStudentId = parseInt(urlParams.get('id_utente')) || null;
    currentEdizioneId = parseInt(urlParams.get('id_edizione')) || null;
    const initialDate = urlParams.get('data') || getTodayDateStr();

    if (!currentStudentId) {
        // Non possiamo usare showToast prima del DOM — redirect diretto
        window.location.href = 'timbrature.html';
        return;
    }

    currentSelectedCalDate = initialDate;
    const parts = currentSelectedCalDate.split('-').map(Number);
    const refDate = new Date(parts[0], parts[1] - 1, parts[2]);
    currentWeekMonday = getMonday(refDate);

    setupEventListeners();
    await loadInitialData();
});

function setupEventListeners() {
    document.getElementById('btnPrevWeek')?.addEventListener('click', () => {
        if (!currentWeekMonday) return;
        currentWeekMonday.setDate(currentWeekMonday.getDate() - 7);
        renderZucchettiWeekGrid();
    });

    document.getElementById('btnNextWeek')?.addEventListener('click', () => {
        if (!currentWeekMonday) return;
        currentWeekMonday.setDate(currentWeekMonday.getDate() + 7);
        renderZucchettiWeekGrid();
    });

    document.getElementById('btnTodayWeek')?.addEventListener('click', () => {
        const todayStr = getTodayDateStr();
        selectStudentCalDate(todayStr);
    });

    document.getElementById('calDateInput')?.addEventListener('change', () => {
        const targetDate = document.getElementById('calDateInput')?.value;
        if (targetDate) selectStudentCalDate(targetDate);
    });

    document.getElementById('formStudentCalDay')?.addEventListener('submit', handleSaveStudentCalDay);

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (typeof logout === 'function') logout();
        else window.location.href = '../login.html';
    });
}

async function loadInitialData() {
    try {
        // Carica presenze dello studente
        const resP = await fetchWithAuth(`/presenze?id_utente=${currentStudentId}`);
        if (resP.ok) {
            currentStudentPresenzeList = await resP.json();
        }

        // Tenta di recuperare dettagli studente
        if (currentStudentPresenzeList.length > 0 && currentStudentPresenzeList[0].utente) {
            const u = currentStudentPresenzeList[0].utente;
            currentStudentData = {
                id_utente: currentStudentId,
                nome: u.Nome,
                cognome: u.Cognome,
                email: u.Email,
                codice_fiscale: u.Codice_Fiscale
            };
        } else {
            // Fetch da utenze se necessario
            const resU = await fetchWithAuth(`/utenti/${currentStudentId}`);
            if (resU.ok) {
                const u = await resU.json();
                currentStudentData = {
                    id_utente: currentStudentId,
                    nome: u.nome,
                    cognome: u.cognome,
                    email: u.email,
                    codice_fiscale: u.codice_fiscale
                };
            }
        }

        if (!currentStudentData) {
            currentStudentData = { id_utente: currentStudentId, nome: 'Studente', cognome: `#${currentStudentId}` };
        }

        // Carica edizioni info se id_edizione fornito
        if (currentEdizioneId) {
            const resE = await fetchWithAuth(`/corsi-attivi/${currentEdizioneId}`);
            if (resE.ok) {
                const edInfo = await resE.json();
                const edBadge = document.getElementById('previewEdizioneTag');
                if (edBadge) edBadge.textContent = edInfo.etichetta || `Edizione #${currentEdizioneId}`;
            }
        }

        updateHeaderAndSidebarInfo();
        renderZucchettiWeekGrid();
        await loadStudentDayData(currentSelectedCalDate);
    } catch (err) {
        console.error('Errore durante il caricamento dati iniziali:', err);
    }
}

function updateHeaderAndSidebarInfo() {
    const s = currentStudentData;
    if (!s) return;

    const initials = `${(s.nome || '')[0] || ''}${(s.cognome || '')[0] || ''}`.toUpperCase() || 'ST';

    const avatarEl = document.getElementById('studentHeaderAvatar');
    if (avatarEl) avatarEl.textContent = initials;

    const nameEl = document.getElementById('studentHeaderFullName');
    if (nameEl) nameEl.textContent = `${s.cognome} ${s.nome}`;

    const subEl = document.getElementById('studentHeaderSubtitle');
    if (subEl) {
        const parts = [];
        if (s.email) parts.push(s.email);
        if (s.codice_fiscale) parts.push(`CF: ${s.codice_fiscale}`);
        parts.push(`ID #${s.id_utente}`);
        subEl.textContent = parts.join(' — ');
    }

    // Metriche generali
    let totMinutiOverall = 0;
    currentStudentPresenzeList.forEach(p => {
        if (p.ora_ingresso && p.ora_uscita) {
            const mIn = timeToMinutes(p.ora_ingresso);
            const mOut = timeToMinutes(p.ora_uscita);
            if (mOut > mIn) totMinutiOverall += (mOut - mIn);
        }
    });

    const regHoursEl = document.getElementById('previewTotalHoursRegistered');
    if (regHoursEl) regHoursEl.textContent = formatMinutesToHours(totMinutiOverall);

    const regCountEl = document.getElementById('previewTotalTimbratureCount');
    if (regCountEl) regCountEl.textContent = currentStudentPresenzeList.length;
}

function renderZucchettiWeekGrid() {
    const gridEl = document.getElementById('weekGrid');
    const rangeLabel = document.getElementById('weekRangeLabel');
    if (!gridEl || !currentWeekMonday) return;

    const dayNamesShort = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
    const monthNamesShort = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];

    const sundayDate = new Date(currentWeekMonday);
    sundayDate.setDate(sundayDate.getDate() + 6);

    const formatShortDate = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    if (rangeLabel) {
        rangeLabel.textContent = `Settimana ${formatShortDate(currentWeekMonday)} — ${formatShortDate(sundayDate)}`;
    }

    const todayStr = getTodayDateStr();
    let html = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date(currentWeekMonday);
        d.setDate(d.getDate() + i);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const isToday = dateStr === todayStr;
        const isSelected = dateStr === currentSelectedCalDate;

        const presenzeGiorno = currentStudentPresenzeList.filter(p => p.data_presenza === dateStr);

        let badgeHtml = '';
        if (presenzeGiorno.length > 0) {
            let totMin = 0;
            let isOpen = false;
            presenzeGiorno.forEach(p => {
                if (p.ora_ingresso && p.ora_uscita) {
                    const mI = timeToMinutes(p.ora_ingresso);
                    const mO = timeToMinutes(p.ora_uscita);
                    if (mO > mI) totMin += (mO - mI);
                } else if (p.ora_ingresso && !p.ora_uscita) {
                    isOpen = true;
                }
            });
            if (isOpen) {
                badgeHtml = `<div class="day-badge badge-open"><i class="bi bi-door-open-fill me-1"></i>In aula</div>`;
            } else {
                badgeHtml = `<div class="day-badge badge-ok"><i class="bi bi-check-circle me-1"></i>${formatMinutesToHours(totMin)}</div>`;
            }
        } else {
            badgeHtml = `<div class="day-badge badge-none">—</div>`;
        }

        html += `
            <div class="day-card ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}"
                 onclick="selectStudentCalDate('${dateStr}')"
                 title="${dayNamesShort[i]} ${day}/${month}">
                <div class="day-name">${dayNamesShort[i]}</div>
                <div class="day-num">${day}</div>
                <div class="day-month">${monthNamesShort[d.getMonth()]}</div>
                ${badgeHtml}
            </div>
        `;
    }

    gridEl.innerHTML = html;
}

window.selectStudentCalDate = function(dateStr) {
    currentSelectedCalDate = dateStr;
    const dateInput = document.getElementById('calDateInput');
    if (dateInput) dateInput.value = dateStr;

    if (currentWeekMonday) {
        const parts = dateStr.split('-').map(Number);
        const targetD = new Date(parts[0], parts[1] - 1, parts[2]);
        const mondayOfTarget = getMonday(targetD);
        if (mondayOfTarget.getTime() !== currentWeekMonday.getTime()) {
            currentWeekMonday = mondayOfTarget;
        }
    }

    renderZucchettiWeekGrid();
    loadStudentDayData(dateStr);
};

async function loadStudentDayData(targetDate) {
    const labelDate = document.getElementById('selectedDateLabel');
    if (labelDate) labelDate.textContent = `${formatDateItalian(targetDate)}`;

    const lessonBadgeEl = document.getElementById('dayLessonBadge');
    let defaultIn = '09:00';
    let defaultOut = '13:00';
    currentDayMaxLessonMinutes = 0;

    if (currentEdizioneId) {
        try {
            const resCheck = await fetchWithAuth(`/calendario/check?id_corso_attivo=${currentEdizioneId}&data=${targetDate}`);
            if (resCheck.ok) {
                const checkData = await resCheck.json();
                if (checkData.lezione_prevista && checkData.lezioni && checkData.lezioni.length > 0) {
                    currentLezioneInfo = checkData.lezioni;
                    const l = checkData.lezioni[0];
                    if (l.ora_inizio) defaultIn = l.ora_inizio;
                    if (l.ora_fine) defaultOut = l.ora_fine;
                    const lezioniStr = checkData.lezioni.map(x => `${x.ora_inizio}–${x.ora_fine}${x.modulo ? ` (${x.modulo})` : ''}`).join(' | ');
                    if (lessonBadgeEl) {
                        lessonBadgeEl.innerHTML = `<i class="bi bi-calendar-check text-success me-1"></i><span class="text-success fw-semibold">Lezione: ${escapeHtml(lezioniStr)}</span>`;
                    }
                    checkData.lezioni.forEach(lItem => {
                        const mIn = timeToMinutes(lItem.ora_inizio);
                        const mOut = timeToMinutes(lItem.ora_fine);
                        if (mIn !== null && mOut !== null && mOut > mIn) {
                            currentDayMaxLessonMinutes += (mOut - mIn);
                        }
                    });
                } else if (lessonBadgeEl) {
                    currentLezioneInfo = null;
                    lessonBadgeEl.innerHTML = `<i class="bi bi-calendar-x text-warning me-1"></i><span class="text-warning">Nessuna lezione programmata</span>`;
                }
            }
        } catch (e) {
            console.error('Errore verificando calendario:', e);
        }
    } else if (lessonBadgeEl) {
        lessonBadgeEl.innerHTML = '';
    }

    const presenzeGiorno = currentStudentPresenzeList.filter(p => p.data_presenza === targetDate);
    presenzeGiorno.sort((a, b) => (a.ora_ingresso || a.ora_uscita || '').localeCompare(b.ora_ingresso || b.ora_uscita || ''));

    renderDayIntervalliTable(presenzeGiorno);
    resetForm(defaultIn, defaultOut, presenzeGiorno);
}

function renderDayIntervalliTable(presenzeGiorno) {
    const container = document.getElementById('timb-list-container');
    const totalEl = document.getElementById('dayTotalHours');
    if (!container) return;

    const maxLessonStr = currentDayMaxLessonMinutes > 0
        ? ` — Max lezione: ${formatMinutesToHours(currentDayMaxLessonMinutes)}`
        : '';

    if (presenzeGiorno.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-clock fs-2 d-block mb-2 text-secondary"></i>
                <div class="fw-semibold mb-1">Nessuna timbratura per questo giorno</div>
                <div class="small">Usa il modulo in basso per inserire la prima timbratura di ingresso.</div>
            </div>
        `;
        if (totalEl) totalEl.textContent = `0h 00m totali${maxLessonStr}`;
        return;
    }

    let totMinuti = 0;
    let html = '';

    presenzeGiorno.forEach((p, idx) => {
        const oraIn  = p.ora_ingresso ? p.ora_ingresso.substring(0, 5) : null;
        const oraOut = p.ora_uscita   ? p.ora_uscita.substring(0, 5)   : null;

        if (oraIn && oraOut) {
            const mI = timeToMinutes(oraIn);
            const mO = timeToMinutes(oraOut);
            if (mO > mI) totMinuti += (mO - mI);
        }

        const chipIn = oraIn
            ? `<span class="timb-time-chip chip-in"><i class="bi bi-box-arrow-in-right"></i>${oraIn}</span>`
            : `<span class="timb-time-chip chip-missing">Ingresso mancante</span>`;

        const chipOut = oraOut
            ? `<span class="timb-time-chip chip-out"><i class="bi bi-box-arrow-right"></i>${oraOut}</span>`
            : `<span class="timb-time-chip chip-missing">Uscita mancante</span>`;

        const btnInserisciUscita = (!oraOut && oraIn)
            ? `<button class="btn btn-sm btn-success fw-bold" onclick="editIntervallo(${p.id_presenza})" title="Inserisci uscita">
                   <i class="bi bi-box-arrow-right me-1"></i>Inserisci Uscita
               </button>`
            : '';

        html += `
            <div class="timb-card">
                <div class="timb-num">${idx + 1}</div>
                <div class="timb-times">
                    ${chipIn}
                    <i class="bi bi-arrow-right text-muted"></i>
                    ${chipOut}
                </div>
                ${p.note ? `<div class="timb-note"><i class="bi bi-chat-left-text me-1 text-muted"></i>${escapeHtml(p.note)}</div>` : ''}
                <div class="timb-actions">
                    ${btnInserisciUscita}
                    <button class="btn btn-sm btn-outline-primary" onclick="editIntervallo(${p.id_presenza})" title="Modifica">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteIntervallo(${p.id_presenza})" title="Elimina">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    if (totalEl) totalEl.textContent = `${formatMinutesToHours(totMinuti)} totali${maxLessonStr}`;
}

window.onTipoChange = function() {
    const tipo = document.getElementById('studentCalTipo')?.value || 'ingresso';
    const wrapIn = document.getElementById('wrapOraIn');
    const wrapOut = document.getElementById('wrapOraOut');
    const inputIn = document.getElementById('studentCalOraIn');
    const inputOut = document.getElementById('studentCalOraOut');

    if (tipo === 'ingresso') {
        if (wrapIn) wrapIn.style.display = 'block';
        if (wrapOut) wrapOut.style.display = 'none';
        if (inputIn) inputIn.required = true;
        if (inputOut) { inputOut.required = false; inputOut.value = ''; }
    } else if (tipo === 'uscita') {
        if (wrapIn) wrapIn.style.display = 'none';
        if (wrapOut) wrapOut.style.display = 'block';
        if (inputIn) { inputIn.required = false; inputIn.value = ''; }
        if (inputOut) inputOut.required = true;
    } else { // completa
        if (wrapIn) wrapIn.style.display = 'block';
        if (wrapOut) wrapOut.style.display = 'block';
        if (inputIn) inputIn.required = true;
        if (inputOut) inputOut.required = true;
    }
};

window.resetForm = function(defaultIn = '09:00', defaultOut = '13:00', presenzeGiorno = null) {
    const editIdInput = document.getElementById('studentCalPresenzaId');
    if (editIdInput) editIdInput.value = '';

    // Rimuovi evidenziazione modifica
    const formContainer = document.getElementById('formTimbContainer');
    if (formContainer) formContainer.classList.remove('editing');

    const tipoSelect = document.getElementById('studentCalTipo');
    const subTitle = document.getElementById('formSubtitle');

    if (!presenzeGiorno && currentStudentPresenzeList && currentSelectedCalDate) {
        presenzeGiorno = currentStudentPresenzeList.filter(p => p.data_presenza === currentSelectedCalDate);
    }

    const openRecord = (presenzeGiorno || []).find(p => p.ora_ingresso && !p.ora_uscita);

    if (!presenzeGiorno || presenzeGiorno.length === 0) {
        // Scenario 1: prima timbratura del giorno
        if (tipoSelect) {
            tipoSelect.disabled = true;
            tipoSelect.innerHTML = `<option value="ingresso" selected>↘ Solo Ingresso</option>`;
        }
        document.getElementById('studentCalOraIn').value  = defaultIn;
        document.getElementById('studentCalOraOut').value = '';
        document.getElementById('studentCalNote').value   = '';
        if (subTitle) subTitle.textContent = 'Prima timbratura — inserisci Ora di Ingresso';
    } else if (openRecord) {
        // Scenario 2: ingresso già presente, manca uscita
        if (editIdInput) editIdInput.value = openRecord.id_presenza;
        if (tipoSelect) {
            tipoSelect.disabled = false;
            tipoSelect.innerHTML = `
                <option value="completa" selected>⇄ Ingresso + Uscita</option>
                <option value="uscita">↗ Solo Uscita</option>
                <option value="ingresso">↘ Solo Ingresso</option>
            `;
        }
        document.getElementById('studentCalOraIn').value  = openRecord.ora_ingresso ? openRecord.ora_ingresso.substring(0, 5) : defaultIn;
        document.getElementById('studentCalOraOut').value = defaultOut;
        document.getElementById('studentCalNote').value   = openRecord.note || '';
        if (subTitle) subTitle.textContent = `Ingresso alle ${openRecord.ora_ingresso.substring(0, 5)} — inserisci Ora di Uscita`;
        if (formContainer) formContainer.classList.add('editing');
    } else {
        // Scenario 3: tutte le timbrature precedenti complete, nuovo record
        if (tipoSelect) {
            tipoSelect.disabled = false;
            tipoSelect.innerHTML = `
                <option value="ingresso" selected>↘ Solo Ingresso</option>
                <option value="completa">⇄ Ingresso + Uscita</option>
            `;
        }
        const lastComplete = [...presenzeGiorno].filter(p => p.ora_uscita).pop();
        const nextIn = (lastComplete && lastComplete.ora_uscita) ? lastComplete.ora_uscita.substring(0, 5) : defaultIn;
        document.getElementById('studentCalOraIn').value  = nextIn;
        document.getElementById('studentCalOraOut').value = defaultOut;
        document.getElementById('studentCalNote').value   = '';
        if (subTitle) subTitle.textContent = 'Nuova timbratura (record successivo)';
    }

    onTipoChange();
};

window.editIntervallo = function(idPresenza) {
    const p = currentStudentPresenzeList.find(x => x.id_presenza === idPresenza);
    if (!p) return;

    const editIdInput = document.getElementById('studentCalPresenzaId');
    if (editIdInput) editIdInput.value = p.id_presenza;

    const oraIn  = p.ora_ingresso ? p.ora_ingresso.substring(0, 5) : '';
    const oraOut = p.ora_uscita   ? p.ora_uscita.substring(0, 5)   : '';

    document.getElementById('studentCalOraIn').value  = oraIn;
    document.getElementById('studentCalOraOut').value = oraOut || (currentLezioneInfo?.[0]?.ora_fine || '13:00');
    document.getElementById('studentCalNote').value   = p.note || '';

    const tipoSelect = document.getElementById('studentCalTipo');
    if (tipoSelect) {
        tipoSelect.disabled = false;
        tipoSelect.innerHTML = `
            <option value="completa">⇄ Ingresso + Uscita</option>
            <option value="ingresso">↘ Solo Ingresso</option>
            <option value="uscita">↗ Solo Uscita</option>
        `;
        if (oraIn && oraOut) tipoSelect.value = 'completa';
        else if (oraIn)      tipoSelect.value = 'completa'; // pre-seleziona completa per agevolare inserimento uscita
        else if (oraOut)     tipoSelect.value = 'uscita';
        else                 tipoSelect.value = 'ingresso';
    }

    onTipoChange();

    const subTitle = document.getElementById('formSubtitle');
    if (subTitle) subTitle.textContent = `Modifica Timbratura #${p.id_presenza}${!oraOut ? ' — Inserisci Ora Uscita' : ''}`;

    // Evidenzia il form
    const formContainer = document.getElementById('formTimbContainer');
    if (formContainer) {
        formContainer.classList.add('editing');
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

window.deleteIntervallo = async function(idPresenza) {
    if (!idPresenza) return;
    if (!confirm('Sei sicuro di voler eliminare questa timbratura?')) return;

    try {
        const res = await fetchWithAuth(`/presenze/${idPresenza}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Errore durante l\'eliminazione');

        showToast('info', 'Timbratura eliminata', 'La timbratura è stata rimossa.');

        const resP = await fetchWithAuth(`/presenze?id_utente=${currentStudentId}`);
        if (resP.ok) currentStudentPresenzeList = await resP.json();

        updateHeaderAndSidebarInfo();
        renderZucchettiWeekGrid();
        await loadStudentDayData(currentSelectedCalDate);
    } catch (err) {
        showToast('danger', 'Errore', err.message);
    }
};

async function handleSaveStudentCalDay(e) {
    e.preventDefault();
    if (!currentStudentId) return;

    const editIdStr = document.getElementById('studentCalPresenzaId').value;
    const editId = editIdStr ? parseInt(editIdStr) : null;
    const dataPresenza = currentSelectedCalDate || getTodayDateStr();
    const tipo = document.getElementById('studentCalTipo')?.value || 'ingresso';
    const oraIn = document.getElementById('studentCalOraIn').value || null;
    const oraOut = document.getElementById('studentCalOraOut').value || null;
    const note = document.getElementById('studentCalNote').value.trim();

    let finalIn = null;
    let finalOut = null;

    if (tipo === 'ingresso') {
        if (!oraIn) { showToast('warning', 'Campo Mancante', 'Compila l\'ora di ingresso'); return; }
        finalIn = `${oraIn}:00`;
    } else if (tipo === 'uscita') {
        if (!oraOut) { showToast('warning', 'Campo Mancante', 'Compila l\'ora di uscita'); return; }
        finalOut = `${oraOut}:00`;
    } else { // completa
        if (!oraIn || !oraOut) { showToast('warning', 'Campi Mancanti', 'Compila sia l\'ora di ingresso che di uscita'); return; }
        finalIn = `${oraIn}:00`;
        finalOut = `${oraOut}:00`;
    }

    const proposedInMin = timeToMinutes(finalIn);
    const proposedOutMin = timeToMinutes(finalOut);

    // 1. Validazione coerenza orari del singolo intervallo
    if (proposedInMin !== null && proposedOutMin !== null) {
        if (proposedOutMin <= proposedInMin) {
            showToast('danger', 'Orario Non Valido', `L'orario di uscita (${oraOut}) deve essere successivo all'orario di ingresso (${oraIn}).`);
            return;
        }
    }

    // 2. Controllo Sovrapposizione (No Overlapping) con altre timbrature del giorno
    const presenzeGiorno = currentStudentPresenzeList.filter(p => p.data_presenza === dataPresenza && p.id_presenza !== editId);

    for (const p of presenzeGiorno) {
        const pInMin = timeToMinutes(p.ora_ingresso);
        const pOutMin = timeToMinutes(p.ora_uscita);

        if (proposedInMin !== null && proposedOutMin !== null) {
            if (pInMin !== null && pOutMin !== null) {
                if (Math.max(proposedInMin, pInMin) < Math.min(proposedOutMin, pOutMin)) {
                    showToast('danger', 'Orari Sovrapposti', `L'intervallo inserito (${oraIn} - ${oraOut}) si sovrappone alla timbratura già presente (${p.ora_ingresso.substring(0, 5)} - ${p.ora_uscita.substring(0, 5)}).`);
                    return;
                }
            } else if (pInMin !== null && pOutMin === null) {
                if (proposedInMin >= pInMin || proposedOutMin > pInMin) {
                    showToast('warning', 'Timbratura Non Conclusa', `Esiste già una timbratura di ingresso non conclusa dalle ore ${p.ora_ingresso.substring(0, 5)}. Completa prima quella timbratura.`);
                    return;
                }
            }
        } else if (proposedInMin !== null && proposedOutMin === null) {
            if (pInMin !== null && pOutMin !== null) {
                if (proposedInMin >= pInMin && proposedInMin < pOutMin) {
                    showToast('danger', 'Orario Sovrapposto', `L'orario di ingresso (${oraIn}) cade all'interno della timbratura esistente (${p.ora_ingresso.substring(0, 5)} - ${p.ora_uscita.substring(0, 5)}).`);
                    return;
                }
            } else if (pInMin !== null && pOutMin === null) {
                showToast('warning', 'Timbratura Non Conclusa', `Esiste già una timbratura di ingresso non conclusa dalle ore ${p.ora_ingresso.substring(0, 5)}. Inserisci l'orario di uscita prima di aprire un nuovo ingresso.`);
                return;
            }
        }
    }

    // 3. Controllo Massimo Ore di Lezione del Giorno
    if (currentDayMaxLessonMinutes > 0) {
        let proposedDurationMin = 0;
        if (proposedInMin !== null && proposedOutMin !== null) {
            proposedDurationMin = proposedOutMin - proposedInMin;
        }

        let existingTotalMin = 0;
        presenzeGiorno.forEach(p => {
            const pIn = timeToMinutes(p.ora_ingresso);
            const pOut = timeToMinutes(p.ora_uscita);
            if (pIn !== null && pOut !== null && pOut > pIn) {
                existingTotalMin += (pOut - pIn);
            }
        });

        const newTotalPresenzaMin = existingTotalMin + proposedDurationMin;
        if (newTotalPresenzaMin > currentDayMaxLessonMinutes) {
            showToast('warning', 'Limite Ore Superato', `La somma delle timbrature (${formatMinutesToHours(newTotalPresenzaMin)}) supera le ore di lezione previste per oggi (${formatMinutesToHours(currentDayMaxLessonMinutes)}).`);
            return;
        }
    }

    const payload = {
        id_utente: currentStudentId,
        data_presenza: dataPresenza,
        ora_ingresso: finalIn,
        ora_uscita: finalOut,
        note: note
    };

    const btnSave = document.getElementById('btnStudentCalSave');
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>...';
    }

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
            throw new Error(err.detail || 'Errore durante il salvataggio della timbratura');
        }

        showToast('success', 'Timbratura salvata', `Timbratura del ${formatDateItalian(dataPresenza)} salvata per ${currentStudentData.cognome} ${currentStudentData.nome}.`);

        const resP = await fetchWithAuth(`/presenze?id_utente=${currentStudentId}`);
        if (resP.ok) currentStudentPresenzeList = await resP.json();

        updateHeaderAndSidebarInfo();
        renderZucchettiWeekGrid();
        await loadStudentDayData(dataPresenza);
    } catch (err) {
        showToast('danger', 'Errore Salvataggio', err.message);
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = 'Salva';
        }
    }
}

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
