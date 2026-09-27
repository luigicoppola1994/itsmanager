// ==============================================================================
// dettaglio-timbrature.js — Pagina Dettaglio Timbrature Studente
// Gestione carosello giorni corso (solo date inizio-fine) & CRUD inline su tabella
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

// State globale
let currentStudentId = null;
let currentEdizioneId = null;
let currentStudentData = null;
let currentEdizioneData = null;
let currentCorsoData = null;
let currentStudentPresenzeList = [];
let currentCourseDays = [];
let currentSelectedCalDate = null;
let currentDayMaxLessonMinutes = 0;
let currentLezioneInfo = null;

let isCreatingNewRow = false;
let editingPresenzaId = null;

// Utility date e ore
function getTodayDateStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateYMD(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateToYMD(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateItalian(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

function formatDateLongItalian(dateStr) {
    const d = parseDateYMD(dateStr);
    if (!d) return dateStr || '—';
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const str = d.toLocaleDateString('it-IT', options);
    return str.charAt(0).toUpperCase() + str.slice(1);
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

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Inizializzazione pagina
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentStudentId = parseInt(urlParams.get('id_utente')) || null;
    currentEdizioneId = parseInt(urlParams.get('id_edizione')) || null;
    const initialDate = urlParams.get('data') || null;

    if (!currentStudentId) {
        window.location.href = 'timbrature.html';
        return;
    }

    setupEventListeners();
    await loadInitialData(initialDate);
});

function setupEventListeners() {
    // Carosello pulsanti laterali
    const btnPrev = document.getElementById('btnPrevDayCard');
    const btnNext = document.getElementById('btnNextDayCard');
    const track = document.getElementById('daysCarouselTrack');

    if (btnPrev && track) {
        btnPrev.addEventListener('click', () => {
            track.scrollBy({ left: -330, behavior: 'smooth' });
        });
    }

    if (btnNext && track) {
        btnNext.addEventListener('click', () => {
            track.scrollBy({ left: 330, behavior: 'smooth' });
        });
    }

    if (track) {
        track.addEventListener('scroll', updateCarouselButtonsState);
    }

    // Navigazione rapida data
    document.getElementById('calDateInput')?.addEventListener('change', (e) => {
        const targetDate = e.target.value;
        if (targetDate) {
            selectStudentCalDate(targetDate);
        }
    });

    // Pulsante "Oggi"
    document.getElementById('btnTodayCourse')?.addEventListener('click', () => {
        const todayStr = getTodayDateStr();
        if (currentCourseDays.includes(todayStr)) {
            selectStudentCalDate(todayStr);
        } else {
            showToast('info', 'Data Fuori Corso', `La data odierna (${formatDateItalian(todayStr)}) non rientra nel periodo attivo di questo corso.`);
        }
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if (typeof logout === 'function') logout();
        else window.location.href = '../login.html';
    });
}

function updateCarouselButtonsState() {
    const track = document.getElementById('daysCarouselTrack');
    const btnPrev = document.getElementById('btnPrevDayCard');
    const btnNext = document.getElementById('btnNextDayCard');
    if (!track || !btnPrev || !btnNext) return;

    const scrollLeft = track.scrollLeft;
    const maxScroll = track.scrollWidth - track.clientWidth;

    btnPrev.disabled = scrollLeft <= 4;
    btnNext.disabled = scrollLeft >= maxScroll - 4;
}

// Caricamento Dati Iniziali
async function loadInitialData(initialDate = null) {
    try {
        // 1. Carica le presenze dello studente
        const resP = await fetchWithAuth(`/presenze?id_utente=${currentStudentId}`);
        if (resP.ok) {
            currentStudentPresenzeList = await resP.json();
        }

        // 2. Dati anagrafici studente
        const resU = await fetchWithAuth(`/utenti/${currentStudentId}`);
        if (resU.ok) {
            const u = await resU.json();
            currentStudentData = {
                id_utente: currentStudentId,
                nome: u.nome || u.Nome,
                cognome: u.cognome || u.Cognome,
                email: u.email || u.Email,
                codice_fiscale: u.codice_fiscale || u.Codice_Fiscale
            };
        } else if (currentStudentPresenzeList.length > 0 && currentStudentPresenzeList[0].utente) {
            const u = currentStudentPresenzeList[0].utente;
            currentStudentData = {
                id_utente: currentStudentId,
                nome: u.Nome,
                cognome: u.Cognome,
                email: u.Email,
                codice_fiscale: u.Codice_Fiscale
            };
        } else {
            currentStudentData = { id_utente: currentStudentId, nome: 'Studente', cognome: `#${currentStudentId}` };
        }

        // 3. Risoluzione Edizione e Corso
        if (!currentEdizioneId) {
            // Tenta di determinare l'edizione dell'aula a cui appartiene lo studente
            try {
                const resCA = await fetchWithAuth('/corsi-attivi');
                if (resCA.ok) {
                    const allCorsiAttivi = await resCA.json();
                    for (const ca of allCorsiAttivi) {
                        const caId = ca.id_corso_attivo;
                        const resAula = await fetchWithAuth(`/corsi-attivi/${caId}/aula`);
                        if (resAula.ok) {
                            const aula = await resAula.json();
                            if (aula.some(s => s.id_utente === currentStudentId)) {
                                currentEdizioneId = caId;
                                currentEdizioneData = ca;
                                break;
                            }
                        }
                    }
                    if (!currentEdizioneId && allCorsiAttivi.length > 0) {
                        currentEdizioneId = allCorsiAttivi[0].id_corso_attivo;
                        currentEdizioneData = allCorsiAttivi[0];
                    }
                }
            } catch (err) {
                console.warn('Impossibile rilevare edizione automatica:', err);
            }
        }

        if (currentEdizioneId && !currentEdizioneData) {
            const resE = await fetchWithAuth(`/corsi-attivi/${currentEdizioneId}`);
            if (resE.ok) {
                currentEdizioneData = await resE.json();
            }
        }

        // Carica info del corso base
        if (currentEdizioneData) {
            if (currentEdizioneData.corso && (currentEdizioneData.corso.Nome || currentEdizioneData.corso.nome)) {
                currentCorsoData = currentEdizioneData.corso;
            } else if (currentEdizioneData.id_corso) {
                try {
                    const resC = await fetchWithAuth(`/corsi/${currentEdizioneData.id_corso}`);
                    if (resC.ok) {
                        currentCorsoData = await resC.json();
                    }
                } catch (err) {
                    console.warn('Errore recupero corso:', err);
                }
            }
        }

        // Se non abbiamo ancora il nome corso, prova a recuperare l'elenco generale dei corsi
        if (!currentCorsoData) {
            try {
                const resCorsiAll = await fetchWithAuth('/corsi');
                if (resCorsiAll.ok) {
                    const corsiAll = await resCorsiAll.json();
                    if (currentEdizioneData) {
                        currentCorsoData = corsiAll.find(c => c.id_corso === currentEdizioneData.id_corso);
                    }
                    if (!currentCorsoData && corsiAll.length > 0) {
                        currentCorsoData = corsiAll[0];
                    }
                }
            } catch (err) {
                console.warn('Errore recupero corsi all:', err);
            }
        }

        // 4. Aggiorna link "Torna al registro"
        const backUrl = `timbrature.html${currentEdizioneId ? '?id_edizione=' + currentEdizioneId : ''}`;
        const btnBackBreadcrumb = document.getElementById('btnBackBreadcrumb');
        const btnBackTop = document.getElementById('btnBackTop');
        if (btnBackBreadcrumb) btnBackBreadcrumb.href = backUrl;
        if (btnBackTop) btnBackTop.href = backUrl;

        // 5. Calcola i giorni attivi del corso compresi tra data_inizio e data_fine
        computeCourseActiveDays();

        // 6. Aggiorna interfaccia utente e statistiche studente
        updateStudentAndCourseHeader();

        // 7. Renderizza le card del carosello
        renderDaysCarousel();

        // 8. Determina la data iniziale selezionata
        let targetSelectedDate = null;
        if (initialDate && currentCourseDays.includes(initialDate)) {
            targetSelectedDate = initialDate;
        } else {
            const todayStr = getTodayDateStr();
            if (currentCourseDays.includes(todayStr)) {
                targetSelectedDate = todayStr;
            } else {
                // Seleziona la prima data con presenze registrate nel corso, o la data d'inizio
                const presenzeInCourse = currentStudentPresenzeList.filter(p => currentCourseDays.includes(p.data_presenza));
                if (presenzeInCourse.length > 0) {
                    targetSelectedDate = presenzeInCourse[0].data_presenza;
                } else if (currentCourseDays.length > 0) {
                    targetSelectedDate = currentCourseDays[0];
                } else {
                    targetSelectedDate = todayStr;
                }
            }
        }

        selectStudentCalDate(targetSelectedDate);
    } catch (err) {
        console.error('Errore durante il caricamento:', err);
        showToast('danger', 'Errore Caricamento', 'Si è verificato un errore nel caricamento dei dati.');
    }
}

// Calcola i soli giorni in cui è attivo il corso (tra data_inizio e data_fine)
function computeCourseActiveDays() {
    currentCourseDays = [];

    let startStr = currentEdizioneData?.data_inizio;
    let endStr = currentEdizioneData?.data_fine;

    // Fallback nel caso in cui le date non siano presenti
    if (!startStr || !endStr) {
        if (currentStudentPresenzeList.length > 0) {
            const dates = currentStudentPresenzeList.map(p => p.data_presenza).sort();
            startStr = dates[0];
            endStr = dates[dates.length - 1];
        } else {
            const d = new Date();
            startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
            d.setMonth(d.getMonth() + 1);
            d.setDate(0);
            endStr = formatDateToYMD(d);
        }
    }

    const startDate = parseDateYMD(startStr);
    const endDate = parseDateYMD(endStr);

    if (startDate && endDate && startDate <= endDate) {
        let curr = new Date(startDate.getTime());
        while (curr <= endDate) {
            currentCourseDays.push(formatDateToYMD(curr));
            curr.setDate(curr.getDate() + 1);
        }
    } else {
        // Fallback singolo giorno
        currentCourseDays.push(startStr || getTodayDateStr());
    }

    // Configura i vincoli del datepicker
    const dateInput = document.getElementById('calDateInput');
    if (dateInput) {
        dateInput.min = currentCourseDays[0];
        dateInput.max = currentCourseDays[currentCourseDays.length - 1];
    }

    // Mostra il badge di durata
    const durationBadge = document.getElementById('courseDurationDaysBadge');
    if (durationBadge) {
        durationBadge.textContent = `${currentCourseDays.length} giorni di corso`;
    }
}

// Aggiorna l'header profilo studente e corso
function updateStudentAndCourseHeader() {
    const s = currentStudentData;
    if (!s) return;

    const initials = `${(s.nome || '')[0] || ''}${(s.cognome || '')[0] || ''}`.toUpperCase() || 'ST';
    const avatarEl = document.getElementById('studentHeaderAvatar');
    if (avatarEl) avatarEl.textContent = initials;

    const nameEl = document.getElementById('studentHeaderFullName');
    if (nameEl) nameEl.textContent = `${s.cognome} ${s.nome}`;

    const idBadge = document.getElementById('studentIdBadge');
    if (idBadge) idBadge.textContent = `ID #${s.id_utente}`;

    const subEl = document.getElementById('studentHeaderSubtitle');
    if (subEl) {
        const parts = [];
        if (s.email) parts.push(`<span><i class="bi bi-envelope me-1"></i>${escapeHtml(s.email)}</span>`);
        if (s.codice_fiscale) parts.push(`<span><i class="bi bi-person-vcard me-1"></i>CF: <strong>${escapeHtml(s.codice_fiscale)}</strong></span>`);
        subEl.innerHTML = parts.join('<span class="text-muted mx-1">•</span>');
    }

    // Info corso ed edizione (solo nome corso ed etichetta reale)
    const courseTitleEl = document.getElementById('courseNameTitle');
    const courseEdBadge = document.getElementById('courseEdizioneBadge');

    const corsoNome = currentCorsoData?.Nome ||
                      currentCorsoData?.nome ||
                      currentCorsoData?.Nome_corso ||
                      currentCorsoData?.nome_corso ||
                      currentEdizioneData?.corso?.Nome ||
                      currentEdizioneData?.corso?.nome ||
                      'Corso Principale';
    if (courseTitleEl) {
        courseTitleEl.textContent = corsoNome;
        courseTitleEl.title = corsoNome;
    }

    const edLabel = currentEdizioneData?.etichetta || 'Edizione Unica';
    if (courseEdBadge) {
        courseEdBadge.textContent = edLabel;
    }

    // Dati Corso / Monte Ore & Limiti Assenza
    let durataTotOre = 0;
    if (currentEdizioneData) {
        durataTotOre = Number(currentEdizioneData.durata_ore) ||
                       (Number(currentEdizioneData.ore_teoria_aula || 0) + Number(currentEdizioneData.ore_stage || 0)) || 0;
    }
    // Se non configurato nel DB dell'edizione, stima dal numero di giorni del corso (es. 4 ore/giorno di didattica)
    if (durataTotOre <= 0 && currentCourseDays && currentCourseDays.length > 0) {
        durataTotOre = currentCourseDays.length * 4;
    } else if (durataTotOre <= 0) {
        durataTotOre = 100; // Valore standard di riferimento
    }

    const percMaxAssenze = (currentEdizioneData && currentEdizioneData.percentuale_ore_assenza != null && Number(currentEdizioneData.percentuale_ore_assenza) > 0)
        ? Number(currentEdizioneData.percentuale_ore_assenza)
        : 20; // Default ITS standard 20%
    const maxAssenzeOre = (durataTotOre * (percMaxAssenze / 100));

    const monteOreEl = document.getElementById('courseMonteOre');
    if (monteOreEl) monteOreEl.textContent = `${durataTotOre}h`;

    const maxAssPercEl = document.getElementById('courseMaxAssenzePerc');
    if (maxAssPercEl) maxAssPercEl.textContent = `${Math.round(maxAssenzeOre)}h (${percMaxAssenze}%)`;

    // Calcolo KPI Totali Presenze Studente
    let totMinutiOverall = 0;
    const uniqueDays = new Set();

    currentStudentPresenzeList.forEach(p => {
        if (p.data_presenza) uniqueDays.add(p.data_presenza);
        if (p.ora_ingresso && p.ora_uscita) {
            const mIn = timeToMinutes(p.ora_ingresso);
            const mOut = timeToMinutes(p.ora_uscita);
            if (mOut > mIn) totMinutiOverall += (mOut - mIn);
        }
    });

    const orePresenzaTot = Math.round((totMinutiOverall / 60) * 10) / 10;

    const regHoursEl = document.getElementById('previewTotalHoursRegistered');
    if (regHoursEl) regHoursEl.textContent = formatMinutesToHours(totMinutiOverall);

    const subPresEl = document.getElementById('previewPresenzaSub');
    if (subPresEl) {
        subPresEl.textContent = `su ${durataTotOre}h totali`;
    }

    // Ore Assenza: calcolo rispetto al monte ore
    const oreAssenzaStimate = Math.max(0, Math.round((durataTotOre - orePresenzaTot) * 10) / 10);
    const oreAssenzaMinuti = oreAssenzaStimate * 60;

    const oreAssenzaEl = document.getElementById('previewOreAssenza');
    if (oreAssenzaEl) {
        oreAssenzaEl.textContent = formatMinutesToHours(oreAssenzaMinuti);
        if (oreAssenzaStimate > maxAssenzeOre) {
            oreAssenzaEl.className = 'kpi-mini-num text-danger fw-bold';
        } else if (oreAssenzaStimate > maxAssenzeOre * 0.8) {
            oreAssenzaEl.className = 'kpi-mini-num text-warning fw-bold';
        } else {
            oreAssenzaEl.className = 'kpi-mini-num text-secondary';
        }
    }

    const subAssEl = document.getElementById('previewAssenzaSub');
    if (subAssEl) {
        subAssEl.textContent = `max cons.: ${Math.round(maxAssenzeOre)}h`;
    }

    // Percentuale Frequenza
    let freqPerc = Math.min(100, Math.round((orePresenzaTot / durataTotOre) * 100));
    const freqEl = document.getElementById('previewFrequenzaPerc');
    const freqStatoEl = document.getElementById('previewFrequenzaStato');
    const freqIconEl = document.getElementById('previewFrequenzaIcon');

    if (freqEl) freqEl.textContent = `${freqPerc}%`;
    if (freqStatoEl) {
        const percAssenzaEffettiva = 100 - freqPerc;
        if (percAssenzaEffettiva > percMaxAssenze) {
            freqStatoEl.textContent = 'A Rischio (Escluso)';
            freqStatoEl.className = 'kpi-sub-text text-danger fw-bold';
            if (freqIconEl) freqIconEl.className = 'kpi-icon-wrap text-danger mb-1';
            if (freqEl) freqEl.className = 'kpi-mini-num text-danger';
        } else if (percAssenzaEffettiva > (percMaxAssenze * 0.8)) {
            freqStatoEl.textContent = 'Attenzione limite';
            freqStatoEl.className = 'kpi-sub-text text-warning fw-bold';
            if (freqIconEl) freqIconEl.className = 'kpi-icon-wrap text-warning mb-1';
            if (freqEl) freqEl.className = 'kpi-mini-num text-warning';
        } else {
            freqStatoEl.textContent = 'In regola';
            freqStatoEl.className = 'kpi-sub-text text-success fw-bold';
            if (freqIconEl) freqIconEl.className = 'kpi-icon-wrap text-success mb-1';
            if (freqEl) freqEl.className = 'kpi-mini-num text-success';
        }
    }

    // Giorni e timbrature
    const regDaysEl = document.getElementById('previewTotalDaysCount');
    if (regDaysEl) regDaysEl.textContent = uniqueDays.size;

    const subCountEl = document.getElementById('previewTotalTimbratureCountSub');
    if (subCountEl) subCountEl.textContent = `${currentStudentPresenzeList.length} timbrature`;
}

// Renderizza il carosello orizzontale con i soli giorni compresi tra inizio e fine corso
function renderDaysCarousel() {
    const track = document.getElementById('daysCarouselTrack');
    if (!track) return;

    if (currentCourseDays.length === 0) {
        track.innerHTML = '<div class="text-center text-muted py-4 w-100">Nessuna data attiva per il corso.</div>';
        return;
    }

    const dayNamesShort = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
    const monthNamesShort = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
    const todayStr = getTodayDateStr();

    let html = '';

    currentCourseDays.forEach(dateStr => {
        const d = parseDateYMD(dateStr);
        if (!d) return;

        const isToday = (dateStr === todayStr);
        const isSelected = (dateStr === currentSelectedCalDate);

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
                badgeHtml = `<span class="day-badge badge-open" title="Presenza in corso (uscita mancante)"><i class="bi bi-door-open-fill me-1"></i>In aula</span>`;
            } else {
                badgeHtml = `<span class="day-badge badge-ok" title="${formatMinutesToHours(totMin)} totali"><i class="bi bi-check-circle me-1"></i>${formatMinutesToHours(totMin)}</span>`;
            }
        } else {
            badgeHtml = `<span class="day-badge badge-none">—</span>`;
        }

        const todayMarker = isToday ? `<div class="day-card-today-badge">OGGI</div>` : '';

        html += `
            <div class="day-card ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}"
                 data-date="${dateStr}"
                 onclick="selectStudentCalDate('${dateStr}')"
                 title="${formatDateLongItalian(dateStr)}">
                ${todayMarker}
                <div class="day-name">${dayNamesShort[d.getDay()]}</div>
                <div class="day-num">${d.getDate()}</div>
                <div class="day-month">${monthNamesShort[d.getMonth()]} ${d.getFullYear()}</div>
                ${badgeHtml}
            </div>
        `;
    });

    track.innerHTML = html;

    // Centra la card selezionata
    setTimeout(() => {
        centerSelectedCardInCarousel();
        updateCarouselButtonsState();
    }, 50);
}

function centerSelectedCardInCarousel() {
    const track = document.getElementById('daysCarouselTrack');
    if (!track || !currentSelectedCalDate) return;

    const selectedCard = track.querySelector(`.day-card[data-date="${currentSelectedCalDate}"]`);
    if (selectedCard) {
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

// Selezione del giorno nel calendario
window.selectStudentCalDate = async function(dateStr) {
    if (!dateStr) return;

    // Annulla eventuali form di modifica/creazione aperti
    isCreatingNewRow = false;
    editingPresenzaId = null;

    currentSelectedCalDate = dateStr;

    // Aggiorna datepicker
    const dateInput = document.getElementById('calDateInput');
    if (dateInput && dateInput.value !== dateStr) {
        dateInput.value = dateStr;
    }

    // Aggiorna classi attive nel carosello
    const track = document.getElementById('daysCarouselTrack');
    if (track) {
        track.querySelectorAll('.day-card').forEach(card => {
            if (card.getAttribute('data-date') === dateStr) {
                card.classList.add('is-selected');
            } else {
                card.classList.remove('is-selected');
            }
        });
        centerSelectedCardInCarousel();
        updateCarouselButtonsState();
    }

    // Carica dati del giorno e tabella
    await loadDayDataAndRenderTable(dateStr);
};

// Carica informazioni del giorno selezionato e le timbrature
async function loadDayDataAndRenderTable(targetDate) {
    const titleEl = document.getElementById('selectedDateTitle');
    const subtitleEl = document.getElementById('selectedDateSubtitle');
    const alertEl = document.getElementById('dayLessonAlert');

    if (titleEl) titleEl.textContent = formatDateLongItalian(targetDate);
    if (subtitleEl) subtitleEl.textContent = formatDateItalian(targetDate);

    currentDayMaxLessonMinutes = 0;
    currentLezioneInfo = null;

    // Verifica pianificazione didattica nel calendario
    if (currentEdizioneId) {
        try {
            const resCheck = await fetchWithAuth(`/calendario/check?id_corso_attivo=${currentEdizioneId}&data=${targetDate}`);
            if (resCheck.ok) {
                const checkData = await resCheck.json();
                if (checkData.lezione_prevista && checkData.lezioni && checkData.lezioni.length > 0) {
                    currentLezioneInfo = checkData.lezioni;
                    const lezioniParts = checkData.lezioni.map(x => `<strong>${x.ora_inizio}–${x.ora_fine}</strong>${x.modulo ? ` (${escapeHtml(x.modulo)})` : ''}`);

                    checkData.lezioni.forEach(lItem => {
                        const mIn = timeToMinutes(lItem.ora_inizio);
                        const mOut = timeToMinutes(lItem.ora_fine);
                        if (mIn !== null && mOut !== null && mOut > mIn) {
                            currentDayMaxLessonMinutes += (mOut - mIn);
                        }
                    });

                    if (alertEl) {
                        alertEl.style.display = 'block';
                        alertEl.innerHTML = `
                            <div class="alert alert-success d-flex align-items-center justify-content-between py-2 px-3 mb-3 border-success-subtle">
                                <div class="d-flex align-items-center gap-2 small">
                                    <i class="bi bi-calendar-check-fill text-success fs-6"></i>
                                    <span>Lezione in calendario: ${lezioniParts.join(' | ')}</span>
                                </div>
                                <span class="badge bg-success text-white fw-bold">Max: ${formatMinutesToHours(currentDayMaxLessonMinutes)}</span>
                            </div>
                        `;
                    }
                } else if (alertEl) {
                    alertEl.style.display = 'block';
                    alertEl.innerHTML = `
                        <div class="alert alert-light text-muted d-flex align-items-center gap-2 py-2 px-3 mb-3 border">
                            <i class="bi bi-calendar-x text-warning"></i>
                            <span class="small">Nessuna lezione didattica prevista a calendario per questa data.</span>
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.error('Errore verificando calendario:', e);
            if (alertEl) alertEl.style.display = 'none';
        }
    } else if (alertEl) {
        alertEl.style.display = 'none';
    }

    renderTimbratureTable();
}

// Renderizza la tabella delle timbrature per la giornata corrente
function renderTimbratureTable() {
    const tbody = document.getElementById('timbTableBody');
    const totalEl = document.getElementById('dayTotalHours');
    if (!tbody) return;

    const presenzeGiorno = currentStudentPresenzeList.filter(p => p.data_presenza === currentSelectedCalDate);
    presenzeGiorno.sort((a, b) => (a.ora_ingresso || a.ora_uscita || '').localeCompare(b.ora_ingresso || b.ora_uscita || ''));

    let totMinuti = 0;
    presenzeGiorno.forEach(p => {
        if (p.ora_ingresso && p.ora_uscita) {
            const mI = timeToMinutes(p.ora_ingresso);
            const mO = timeToMinutes(p.ora_uscita);
            if (mO > mI) totMinuti += (mO - mI);
        }
    });

    const maxLessonStr = currentDayMaxLessonMinutes > 0
        ? ` — Limite lezione: ${formatMinutesToHours(currentDayMaxLessonMinutes)}`
        : '';
    if (totalEl) totalEl.textContent = `${formatMinutesToHours(totMinuti)} totali${maxLessonStr}`;

    // Se non ci sono timbrature e non stiamo creando una riga
    if (presenzeGiorno.length === 0 && !isCreatingNewRow) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-muted">
                    <div class="py-2">
                        <i class="bi bi-clock-history fs-1 text-secondary opacity-50 mb-2 d-block"></i>
                        <div class="fw-semibold text-dark mb-1">Nessuna timbratura registrata per questa data</div>
                        <p class="small text-muted mb-0">Usa il pulsante <strong>Nuova timbratura</strong> in alto a destra per registrare l'ingresso.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';

    // Se stiamo creando una nuova timbratura, inserisci la riga editabile in cima
    if (isCreatingNewRow) {
        const defaultIn = currentLezioneInfo?.[0]?.ora_inizio || '09:00';
        const defaultOut = ''; // Inizialmente vuoto come richiesto

        html += `
            <tr id="row-new-timb" class="row-inline-create">
                <td class="text-center">
                    <span class="badge bg-primary text-white rounded-circle p-1" style="width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;">
                        <i class="bi bi-plus"></i>
                    </span>
                </td>
                <td>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-white text-success border-end-0"><i class="bi bi-box-arrow-in-right"></i></span>
                        <input type="time" class="form-control form-control-sm border-start-0 fw-bold" id="newOraIn" value="${defaultIn}" oninput="updateNewRowDuration()">
                    </div>
                </td>
                <td>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-white text-primary border-end-0"><i class="bi bi-box-arrow-right"></i></span>
                        <input type="time" class="form-control form-control-sm border-start-0 fw-bold" id="newOraOut" value="${defaultOut}" oninput="updateNewRowDuration()" placeholder="--:--">
                    </div>
                </td>
                <td>
                    <span class="badge bg-white text-primary border fw-bold px-2 py-1" id="newDurataPreview">${calculateHours(defaultIn, defaultOut)}</span>
                </td>
                <td>
                    <input type="text" class="form-control form-control-sm" id="newNote" placeholder="Note (opzionali)">
                </td>
                <td class="text-end pe-4">
                    <div class="d-inline-flex gap-1">
                        <button type="button" class="btn btn-sm btn-success fw-bold d-inline-flex align-items-center gap-1 shadow-sm" onclick="saveNewTimbraturaRow()" id="btnSaveNewRow">
                            <i class="bi bi-check-lg"></i> Salva
                        </button>
                        <button type="button" class="btn btn-sm btn-light border text-secondary" onclick="cancelNewTimbraturaRow()" title="Annulla">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Righe esistenti
    presenzeGiorno.forEach((p, idx) => {
        const oraIn  = p.ora_ingresso ? p.ora_ingresso.substring(0, 5) : '';
        const oraOut = p.ora_uscita   ? p.ora_uscita.substring(0, 5)   : '';

        if (editingPresenzaId === p.id_presenza) {
            // RIGA IN MODIFICA INLINE
            html += `
                <tr id="row-edit-${p.id_presenza}" class="row-inline-edit">
                    <td class="text-center fw-bold text-warning-emphasis">${idx + 1}</td>
                    <td>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-white text-success border-end-0"><i class="bi bi-box-arrow-in-right"></i></span>
                            <input type="time" class="form-control form-control-sm border-start-0 fw-bold" id="editOraIn-${p.id_presenza}" value="${oraIn}" oninput="updateEditRowDuration(${p.id_presenza})">
                        </div>
                    </td>
                    <td>
                        <div class="input-group input-group-sm">
                            <span class="input-group-text bg-white text-primary border-end-0"><i class="bi bi-box-arrow-right"></i></span>
                            <input type="time" class="form-control form-control-sm border-start-0 fw-bold" id="editOraOut-${p.id_presenza}" value="${oraOut}" oninput="updateEditRowDuration(${p.id_presenza})">
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-white text-dark border fw-bold px-2 py-1" id="editDurataPreview-${p.id_presenza}">${calculateHours(oraIn, oraOut)}</span>
                    </td>
                    <td>
                        <input type="text" class="form-control form-control-sm" id="editNote-${p.id_presenza}" value="${escapeHtml(p.note || '')}" placeholder="Note (opzionali)">
                    </td>
                    <td class="text-end pe-4">
                        <div class="d-inline-flex gap-1">
                            <button type="button" class="btn btn-sm btn-success fw-bold d-inline-flex align-items-center gap-1 shadow-sm" onclick="saveEditRowInline(${p.id_presenza})" id="btnSaveEdit-${p.id_presenza}">
                                <i class="bi bi-check-lg"></i> Salva
                            </button>
                            <button type="button" class="btn btn-sm btn-light border text-secondary" onclick="cancelEditRowInline()" title="Annulla">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // RIGA IN VISUALIZZAZIONE NORMALE
            const chipIn = oraIn
                ? `<span class="timb-time-chip chip-in"><i class="bi bi-box-arrow-in-right me-1"></i>${oraIn}</span>`
                : `<span class="timb-time-chip chip-missing">Ingresso assente</span>`;

            const chipOut = oraOut
                ? `<span class="timb-time-chip chip-out"><i class="bi bi-box-arrow-right me-1"></i>${oraOut}</span>`
                : `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1"><i class="bi bi-door-open-fill me-1"></i>In aula (mancante)</span>`;

            const btnInserisciUscita = (!oraOut && oraIn)
                ? `<button class="btn btn-sm btn-success fw-bold py-1 px-2 d-inline-flex align-items-center gap-1" onclick="editRowInline(${p.id_presenza}, true)" title="Inserisci ora di uscita">
                       <i class="bi bi-box-arrow-right"></i> Inserisci Uscita
                   </button>`
                : '';

            html += `
                <tr id="row-view-${p.id_presenza}">
                    <td class="text-center fw-bold text-secondary">${idx + 1}</td>
                    <td>${chipIn}</td>
                    <td>${chipOut}</td>
                    <td><span class="fw-bold text-dark">${calculateHours(oraIn, oraOut)}</span></td>
                    <td>
                        ${p.note ? `<span class="text-secondary small"><i class="bi bi-chat-left-text me-1 text-muted"></i>${escapeHtml(p.note)}</span>` : '<span class="text-muted small">—</span>'}
                    </td>
                    <td class="text-end pe-4">
                        <div class="d-inline-flex gap-1">
                            ${btnInserisciUscita}
                            <button class="btn btn-sm btn-outline-primary py-1 px-2" onclick="editRowInline(${p.id_presenza})" title="Modifica riga">
                                <i class="bi bi-pencil-fill"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="deleteIntervallo(${p.id_presenza})" title="Elimina timbratura">
                                <i class="bi bi-trash-fill"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
    });

    tbody.innerHTML = html;
}

// ── CREAZIONE TIMBRATURA INLINE ──
window.openNewTimbraturaRow = function() {
    isCreatingNewRow = true;
    editingPresenzaId = null;
    renderTimbratureTable();

    setTimeout(() => {
        const inputIn = document.getElementById('newOraIn');
        if (inputIn) inputIn.focus();
    }, 50);
};

window.cancelNewTimbraturaRow = function() {
    isCreatingNewRow = false;
    renderTimbratureTable();
};

window.updateNewRowDuration = function() {
    const inVal = document.getElementById('newOraIn')?.value;
    const outVal = document.getElementById('newOraOut')?.value;
    const previewEl = document.getElementById('newDurataPreview');
    if (previewEl) {
        previewEl.textContent = calculateHours(inVal, outVal);
    }
};

window.saveNewTimbraturaRow = async function() {
    if (!currentStudentId || !currentSelectedCalDate) return;

    const oraIn = document.getElementById('newOraIn')?.value || null;
    const oraOut = document.getElementById('newOraOut')?.value || null;
    const note = document.getElementById('newNote')?.value.trim() || null;

    if (!oraIn) {
        showToast('warning', 'Orario Mancante', 'Inserisci l\'orario di ingresso.');
        return;
    }

    const finalIn = `${oraIn}:00`;
    const finalOut = oraOut ? `${oraOut}:00` : null;

    // Validazioni
    const errorMsg = validateTimbraturaValues(currentSelectedCalDate, finalIn, finalOut, null);
    if (errorMsg) {
        showToast('danger', 'Validazione Non Riuscita', errorMsg);
        return;
    }

    const btnSave = document.getElementById('btnSaveNewRow');
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>...';
    }

    const payload = {
        id_utente: currentStudentId,
        data_presenza: currentSelectedCalDate,
        ora_ingresso: finalIn,
        ora_uscita: finalOut,
        note: note
    };

    try {
        const res = await fetchWithAuth('/presenze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Errore durante la creazione della timbratura');
        }

        showToast('success', 'Timbratura Registrata', `Timbratura salvata per il giorno ${formatDateItalian(currentSelectedCalDate)}.`);

        isCreatingNewRow = false;

        // Ricarica presenze studente
        await reloadStudentPresenze();
        renderDaysCarousel();
        renderTimbratureTable();
    } catch (err) {
        showToast('danger', 'Errore', err.message);
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="bi bi-check-lg"></i> Salva';
        }
    }
};

// ── MODIFICA TIMBRATURA INLINE ──
window.editRowInline = function(idPresenza, focusUscita = false) {
    isCreatingNewRow = false;
    editingPresenzaId = idPresenza;
    renderTimbratureTable();

    setTimeout(() => {
        if (focusUscita) {
            const inputOut = document.getElementById(`editOraOut-${idPresenza}`);
            if (inputOut) {
                if (!inputOut.value) {
                    inputOut.value = currentLezioneInfo?.[0]?.ora_fine || '13:00';
                    updateEditRowDuration(idPresenza);
                }
                inputOut.focus();
            }
        } else {
            const inputIn = document.getElementById(`editOraIn-${idPresenza}`);
            if (inputIn) inputIn.focus();
        }
    }, 50);
};

window.cancelEditRowInline = function() {
    editingPresenzaId = null;
    renderTimbratureTable();
};

window.updateEditRowDuration = function(idPresenza) {
    const inVal = document.getElementById(`editOraIn-${idPresenza}`)?.value;
    const outVal = document.getElementById(`editOraOut-${idPresenza}`)?.value;
    const previewEl = document.getElementById(`editDurataPreview-${idPresenza}`);
    if (previewEl) {
        previewEl.textContent = calculateHours(inVal, outVal);
    }
};

window.saveEditRowInline = async function(idPresenza) {
    if (!idPresenza || !currentSelectedCalDate) return;

    const oraIn = document.getElementById(`editOraIn-${idPresenza}`)?.value || null;
    const oraOut = document.getElementById(`editOraOut-${idPresenza}`)?.value || null;
    const note = document.getElementById(`editNote-${idPresenza}`)?.value.trim() || null;

    if (!oraIn) {
        showToast('warning', 'Orario Mancante', 'L\'orario di ingresso è obbligatorio.');
        return;
    }

    const finalIn = `${oraIn}:00`;
    const finalOut = oraOut ? `${oraOut}:00` : null;

    // Validazioni
    const errorMsg = validateTimbraturaValues(currentSelectedCalDate, finalIn, finalOut, idPresenza);
    if (errorMsg) {
        showToast('danger', 'Validazione Non Riuscita', errorMsg);
        return;
    }

    const btnSave = document.getElementById(`btnSaveEdit-${idPresenza}`);
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>...';
    }

    const payload = {
        data_presenza: currentSelectedCalDate,
        ora_ingresso: finalIn,
        ora_uscita: finalOut,
        note: note
    };

    try {
        const res = await fetchWithAuth(`/presenze/${idPresenza}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Errore durante la modifica della timbratura');
        }

        showToast('success', 'Timbratura Modificata', 'Le modifiche alla timbratura sono state salvate con successo.');

        editingPresenzaId = null;

        // Ricarica presenze studente
        await reloadStudentPresenze();
        renderDaysCarousel();
        renderTimbratureTable();
    } catch (err) {
        showToast('danger', 'Errore', err.message);
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="bi bi-check-lg"></i> Salva';
        }
    }
};

// ── ELIMINAZIONE TIMBRATURA ──
window.deleteIntervallo = async function(idPresenza) {
    if (!idPresenza) return;
    if (!confirm('Sei sicuro di voler eliminare questa timbratura? L\'azione è irreversibile.')) return;

    try {
        const res = await fetchWithAuth(`/presenze/${idPresenza}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Errore durante l\'eliminazione della timbratura');

        showToast('info', 'Timbratura Eliminata', 'La timbratura è stata rimossa con successo.');

        if (editingPresenzaId === idPresenza) editingPresenzaId = null;

        await reloadStudentPresenze();
        renderDaysCarousel();
        renderTimbratureTable();
    } catch (err) {
        showToast('danger', 'Errore Eliminazione', err.message);
    }
};

// Validazione orari e sovrapposizioni
function validateTimbraturaValues(dataPresenza, oraIn, oraOut, excludeId = null) {
    const proposedInMin = timeToMinutes(oraIn);
    const proposedOutMin = timeToMinutes(oraOut);

    // 1. Ordine orari singolo intervallo
    if (proposedInMin !== null && proposedOutMin !== null) {
        if (proposedOutMin <= proposedInMin) {
            return `L'orario di uscita (${oraOut.substring(0, 5)}) deve essere successivo all'orario di ingresso (${oraIn.substring(0, 5)}).`;
        }
    }

    // 2. Controllo sovrapposizione con altri intervalli dello stesso giorno
    const presenzeGiorno = currentStudentPresenzeList.filter(p => p.data_presenza === dataPresenza && p.id_presenza !== excludeId);

    for (const p of presenzeGiorno) {
        const pInMin = timeToMinutes(p.ora_ingresso);
        const pOutMin = timeToMinutes(p.ora_uscita);

        if (proposedInMin !== null && proposedOutMin !== null) {
            if (pInMin !== null && pOutMin !== null) {
                if (Math.max(proposedInMin, pInMin) < Math.min(proposedOutMin, pOutMin)) {
                    return `L'orario inserito (${oraIn.substring(0, 5)} - ${oraOut.substring(0, 5)}) si sovrappone a una timbratura già presente (${p.ora_ingresso.substring(0, 5)} - ${p.ora_uscita.substring(0, 5)}).`;
                }
            } else if (pInMin !== null && pOutMin === null) {
                if (proposedInMin >= pInMin || proposedOutMin > pInMin) {
                    return `Esiste già una timbratura di ingresso aperta dalle ore ${p.ora_ingresso.substring(0, 5)}. Completa prima quella timbratura.`;
                }
            }
        } else if (proposedInMin !== null && proposedOutMin === null) {
            if (pInMin !== null && pOutMin !== null) {
                if (proposedInMin >= pInMin && proposedInMin < pOutMin) {
                    return `L'orario di ingresso (${oraIn.substring(0, 5)}) ricade all'interno di una timbratura già conclusa (${p.ora_ingresso.substring(0, 5)} - ${p.ora_uscita.substring(0, 5)}).`;
                }
            } else if (pInMin !== null && pOutMin === null) {
                return `Esiste già un ingresso aperto senza uscita (${p.ora_ingresso.substring(0, 5)}). Inserisci l'orario di uscita prima di aprire un nuovo ingresso.`;
            }
        }
    }

    // 3. Controllo limite ore di lezione del giorno
    if (currentDayMaxLessonMinutes > 0 && proposedInMin !== null && proposedOutMin !== null) {
        let proposedDuration = proposedOutMin - proposedInMin;
        let existingTotal = 0;
        presenzeGiorno.forEach(p => {
            const pIn = timeToMinutes(p.ora_ingresso);
            const pOut = timeToMinutes(p.ora_uscita);
            if (pIn !== null && pOut !== null && pOut > pIn) {
                existingTotal += (pOut - pIn);
            }
        });

        if (existingTotal + proposedDuration > currentDayMaxLessonMinutes) {
            // Avviso ma non blocco tassativo: opzionale mostrare warning toast
            console.warn('Ore complessive superano la durata massima delle lezioni previste.');
        }
    }

    return null;
}

// Ricarica le presenze aggiornate dello studente
async function reloadStudentPresenze() {
    try {
        const resP = await fetchWithAuth(`/presenze?id_utente=${currentStudentId}`);
        if (resP.ok) {
            currentStudentPresenzeList = await resP.json();
            updateStudentAndCourseHeader();
        }
    } catch (err) {
        console.error('Errore ricaricando presenze:', err);
    }
}

// Toast Notifiche
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
