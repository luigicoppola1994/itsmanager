document.getElementById('logoutBtn').addEventListener('click', logout);

let studentData = null;
let studentEdizione = null;
let studentCorso = null;
let studentPresenze = [];
let studentLezioni = [];

window.addEventListener('load', async () => {
    const role = localStorage.getItem('user_role');
    if (!role || role.toLowerCase().trim() !== 'studente') {
        window.location.href = '/login.html';
        return;
    }

    await loadStudentData();
    setupPageNavigation();
});

async function loadStudentData() {
    console.log('[STUDENTE] Inizio caricamento dati studente');

    try {
        const userId = localStorage.getItem('user_id');
        console.log('[STUDENTE] User ID:', userId);

        if (!userId) {
            console.error('[STUDENTE] ID utente non trovato');
            showToast('error', 'Errore', 'ID utente non trovato');
            renderEmptyState();
            return;
        }

        // Carica dati studente
        console.log('[STUDENTE] Caricamento dati utente...');
        try {
            const userRes = await fetchAutenticata(`${API_URL}/users/${userId}`);
            console.log('[STUDENTE] Response user:', userRes.status, userRes.ok);
            if (userRes.ok) {
                studentData = await userRes.json();
                console.log('[STUDENTE] Dati utente caricati:', studentData);
                updateStudentProfile();
            } else {
                console.error('[STUDENTE] Errore user response:', userRes.status);
            }
        } catch (e) {
            console.error('[STUDENTE] Errore caricamento utente:', e);
        }

        // Carica tutti i corsi attivi per trovare quelli dello studente
        console.log('[STUDENTE] Caricamento corsi attivi...');
        try {
            const corsiRes = await fetchAutenticata(`${API_URL}/corsi-attivi?stato=attivi`);
            console.log('[STUDENTE] Response corsi:', corsiRes.status, corsiRes.ok);
            if (corsiRes.ok) {
                const allCorsi = await corsiRes.json();
                console.log('[STUDENTE] Corsi attivi trovati:', allCorsi.length);

                // Cerca corsi attivi dello studente interrogando le aule
                for (const corso of allCorsi) {
                    console.log('[STUDENTE] Controllo aula per corso:', corso.id_corso_attivo);
                    try {
                        const aulaRes = await fetchAutenticata(`${API_URL}/corsi-attivi/${corso.id_corso_attivo}/aula`);
                        console.log('[STUDENTE] Response aula:', aulaRes.status, aulaRes.ok);
                        if (aulaRes.ok) {
                            const studentiAula = await aulaRes.json();
                            console.log('[STUDENTE] Studenti in aula:', studentiAula.length);
                            const isStudenteInAula = studentiAula.some(s => s.id_utente === parseInt(userId));
                            console.log('[STUDENTE] Studente in aula:', isStudenteInAula);
                            if (isStudenteInAula) {
                                studentEdizione = corso;
                                console.log('[STUDENTE] Edizione trovata:', studentEdizione);
                                loadEdizioneDetails();
                                break;
                            }
                        }
                    } catch (e) {
                        console.error('[STUDENTE] Errore controllo aula:', e);
                    }
                }
                console.log('[STUDENTE] Edizione finale:', studentEdizione);
            } else {
                console.error('[STUDENTE] Errore corsi response:', corsiRes.status);
            }
        } catch (e) {
            console.error('[STUDENTE] Errore caricamento corsi:', e);
        }

        // Carica presenze
        console.log('[STUDENTE] Caricamento presenze...');
        try {
            const presenzeRes = await fetchAutenticata(`${API_URL}/presenze?id_utente=${userId}`);
            console.log('[STUDENTE] Response presenze:', presenzeRes.status, presenzeRes.ok);
            if (presenzeRes.ok) {
                studentPresenze = await presenzeRes.json();
                console.log('[STUDENTE] Presenze caricate:', studentPresenze.length);
            } else {
                console.error('[STUDENTE] Errore presenze response:', presenzeRes.status);
            }
        } catch (e) {
            console.error('[STUDENTE] Errore caricamento presenze:', e);
        }

        // Carica lezioni
        if (studentEdizione) {
            console.log('[STUDENTE] Caricamento lezioni per edizione:', studentEdizione.id_corso_attivo);
            try {
                const lezioniRes = await fetchAutenticata(`${API_URL}/calendario?id_corso_attivo=${studentEdizione.id_corso_attivo}`);
                console.log('[STUDENTE] Response lezioni:', lezioniRes.status, lezioniRes.ok);
                if (lezioniRes.ok) {
                    studentLezioni = await lezioniRes.json();
                    console.log('[STUDENTE] Lezioni caricate:', studentLezioni.length);
                } else {
                    console.error('[STUDENTE] Errore lezioni response:', lezioniRes.status);
                }
            } catch (e) {
                console.error('[STUDENTE] Errore caricamento lezioni:', e);
            }
        } else {
            console.log('[STUDENTE] Nessuna edizione trovata, skip lezioni');
        }

        console.log('[STUDENTE] Rendering pagina corrente');
        renderCurrentPage();
        console.log('[STUDENTE] Rendering completato');

    } catch (error) {
        console.error('[STUDENTE] Errore caricamento dati studente:', error);
        showToast('error', 'Errore', 'Impossibile caricare i dati');
        renderEmptyState();
    }
}

async function loadEdizioneDetails() {
    if (!studentEdizione) return;

    try {
        const corsoRes = await fetchAutenticata(`${API_URL}/corsi-attivi/${studentEdizione.id_corso_attivo}`);
        if (corsoRes.ok) {
            const corsoAttivo = await corsoRes.json();
            studentCorso = corsoAttivo.corso;
        }
    } catch (error) {
        console.error('Errore caricamento corso:', error);
    }
}

function updateStudentProfile() {
    if (!studentData) return;

    const userName = document.querySelector('.user-name');
    const userAvatar = document.querySelector('.rubick-user-avatar');

    if (userName) {
        userName.textContent = `${studentData.Nome} ${studentData.Cognome}`;
    }

    if (userAvatar) {
        const initials = `${studentData.Nome[0]}${studentData.Cognome[0]}`.toUpperCase();
        userAvatar.textContent = initials;
    }
}

function setupPageNavigation() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.nav-item-link');

    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        }
    });
}

function renderCurrentPage() {
    console.log('[STUDENTE] renderCurrentPage chiamato');
    const currentPage = window.location.pathname.split('/').pop();
    console.log('[STUDENTE] Pagina corrente:', currentPage);

    switch(currentPage) {
        case 'dashboard.html':
            console.log('[STUDENTE] Rendering dashboard');
            renderDashboard();
            break;
        case 'lezioni.html':
            console.log('[STUDENTE] Rendering lezioni');
            renderLezioni();
            break;
        case 'timbrature.html':
            console.log('[STUDENTE] Rendering timbrature');
            renderTimbrature();
            break;
        default:
            console.log('[STUDENTE] Rendering default dashboard');
            renderDashboard();
    }
}

function renderEmptyState() {
    const container = document.querySelector('.main-content');
    if (!container) return;

    container.innerHTML = `
        <!-- TOP BAR -->
        <div class="rubick-top-bar">
            <nav class="rubick-breadcrumb" aria-label="breadcrumb">
                <span class="breadcrumb-root"><i class="bi bi-mortarboard-fill me-1 text-primary"></i>ITS Manager</span>
                <i class="bi bi-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-section">Studente</span>
                <i class="bi bi-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-current">Dashboard</span>
            </nav>
            <div class="rubick-top-bar-actions">
                <div class="rubick-icon-badge" title="Notifiche">
                    <i class="bi bi-bell"></i>
                    <span class="rubick-badge-dot"></span>
                </div>
                <div class="rubick-user-avatar" title="Studente">ST</div>
            </div>
        </div>

        <!-- PAGE HEADER -->
        <div class="nc-page-header">
            <div class="nc-breadcrumb">
                <span class="nc-breadcrumb-current">Dashboard Studente</span>
            </div>
            <div class="nc-header-row">
                <div>
                    <h1 class="nc-title">
                        <span class="nc-title-icon"><i class="bi bi-speedometer2"></i></span>
                        <span>Dashboard</span>
                    </h1>
                    <p class="nc-subtitle">Benvenuto nell'area studenti</p>
                </div>
            </div>
        </div>

        <!-- EMPTY STATE -->
        <div class="text-center py-5">
            <i class="bi bi-exclamation-triangle text-warning" style="font-size: 3rem;"></i>
            <h4 class="fw-bold mt-3">Impossibile caricare i dati</h4>
            <p class="text-muted">Si è verificato un errore durante il caricamento delle informazioni. Riprova più tardi.</p>
            <button onclick="location.reload()" class="btn btn-primary mt-3">
                <i class="bi bi-arrow-clockwise me-1"></i>Ricarica
            </button>
        </div>
    `;
}

function renderDashboard() {
    console.log('[STUDENTE] renderDashboard chiamato');
    const container = document.querySelector('.main-content');
    console.log('[STUDENTE] Container trovato:', !!container);
    if (!container) return;

    // Se non ci sono dati, mostra messaggio appropriato
    if (!studentData && !studentEdizione && studentPresenze.length === 0 && studentLezioni.length === 0) {
        console.log('[STUDENTE] Nessun dato trovato, rendering empty state');
        renderEmptyState();
        return;
    }

    console.log('[STUDENTE] Dati presenti - studentData:', !!studentData, 'studentEdizione:', !!studentEdizione, 'presenze:', studentPresenze.length, 'lezioni:', studentLezioni.length);

    // Calcola statistiche
    const totalPresenze = studentPresenze.filter(p => p.ora_ingresso && p.ora_uscita).length;
    const totalMinutes = studentPresenze.reduce((acc, p) => {
        if (p.ora_ingresso && p.ora_uscita) {
            const inMin = timeToMinutes(p.ora_ingresso);
            const outMin = timeToMinutes(p.ora_uscita);
            if (inMin && outMin && outMin > inMin) {
                return acc + (outMin - inMin);
            }
        }
        return acc;
    }, 0);

    const today = new Date().toISOString().split('T')[0];
    const todayLezioni = studentLezioni.filter(l => l.data === today);
    const upcomingLezioni = studentLezioni
        .filter(l => l.data >= today)
        .sort((a, b) => a.data.localeCompare(b.data))
        .slice(0, 5);

    const studentName = studentData ? `${studentData.Nome} ${studentData.Cognome}` : 'Studente';

    container.innerHTML = `
        <!-- TOP BAR -->
        <div class="rubick-top-bar">
            <nav class="rubick-breadcrumb" aria-label="breadcrumb">
                <span class="breadcrumb-root"><i class="bi bi-mortarboard-fill me-1 text-primary"></i>ITS Manager</span>
                <i class="bi bi-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-section">Studente</span>
                <i class="bi bi-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-current">Dashboard</span>
            </nav>
            <div class="rubick-top-bar-actions">
                <div class="rubick-icon-badge" title="Notifiche">
                    <i class="bi bi-bell"></i>
                    <span class="rubick-badge-dot"></span>
                </div>
                <div class="rubick-user-avatar" title="${studentName}">${studentName.charAt(0)}${studentName.split(' ')[1]?.charAt(0) || ''}</div>
            </div>
        </div>

        <!-- TOP ACTION BAR -->
        <div class="top-action-bar">
            <div class="page-header-info">
                <h1>
                    <i class="bi bi-speedometer2 text-primary"></i>
                    Dashboard Studente
                </h1>
                <p>Benvenuto, ${studentName}</p>
            </div>
        </div>

        <!-- INFO CORSO -->
        ${studentEdizione ? `
        <div class="course-card-unit">
            <div class="course-card-header-line">
                <div class="course-card-title">
                    <i class="bi bi-book-fill"></i>
                    <span>${studentCorso?.Nome || 'Corso'}</span>
                </div>
                <div class="course-card-actions">
                    <span class="badge bg-primary">In Corso</span>
                </div>
            </div>
            <div class="course-dropdown-body">
                <p class="text-muted mb-2"><strong>Edizione:</strong> ${studentEdizione.nome_edizione || 'Edizione'}</p>
                <p class="text-muted mb-0"><strong>Periodo:</strong> ${formatDateItalian(studentEdizione.data_inizio)} - ${formatDateItalian(studentEdizione.data_fine)}</p>
            </div>
        </div>
        ` : ''}

        <!-- STATISTICHE -->
        <div class="courses-list-container">
            <div class="row g-4">
                <div class="col-md-4">
                    <div class="course-card-unit">
                        <div class="course-card-header-line">
                            <div class="course-card-title">
                                <i class="bi bi-clock-history"></i>
                                <span>Ore di Presenza</span>
                            </div>
                        </div>
                        <div class="course-dropdown-body">
                            <h3 class="display-6 fw-bold text-primary text-center">${formatMinutesToHours(totalMinutes)}</h3>
                            <p class="text-muted text-center mb-0">Ore Totali</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="course-card-unit">
                        <div class="course-card-header-line">
                            <div class="course-card-title">
                                <i class="bi bi-calendar-check"></i>
                                <span>Timbrature</span>
                            </div>
                        </div>
                        <div class="course-dropdown-body">
                            <h3 class="display-6 fw-bold text-success text-center">${totalPresenze}</h3>
                            <p class="text-muted text-center mb-0">Registrate</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="course-card-unit">
                        <div class="course-card-header-line">
                            <div class="course-card-title">
                                <i class="bi bi-book"></i>
                                <span>Lezioni</span>
                            </div>
                        </div>
                        <div class="course-dropdown-body">
                            <h3 class="display-6 fw-bold text-info text-center">${studentLezioni.length}</h3>
                            <p class="text-muted text-center mb-0">Programmate</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- PROSSIME LEZIONI -->
        <div class="course-card-unit mt-4">
            <div class="course-card-header-line">
                <div class="course-card-title">
                    <i class="bi bi-calendar3"></i>
                    <span>Prossime Lezioni</span>
                </div>
            </div>
            <div class="course-dropdown-body">
                ${upcomingLezioni.length > 0 ? `
                    <div class="list-group">
                        ${upcomingLezioni.map(lezione => `
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-1 fw-bold">${formatDateItalian(lezione.data)}</h6>
                                    <small class="text-muted">${lezione.ora_inizio} - ${lezione.ora_fine}</small>
                                </div>
                                <span class="badge bg-primary">${lezione.note || 'Lezione'}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="text-center py-4 text-muted">
                        <i class="bi bi-calendar-x" style="font-size: 2rem;"></i>
                        <p class="mb-0 mt-2">Nessuna lezione programmata</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderLezioni() {
    const container = document.querySelector('.main-content');
    if (!container) return;

    const today = new Date().toISOString().split('T')[0];
    const pastLezioni = studentLezioni.filter(l => l.data < today).sort((a, b) => b.data.localeCompare(a.data));
    const futureLezioni = studentLezioni.filter(l => l.data >= today).sort((a, b) => a.data.localeCompare(b.data));

    container.innerHTML = `
        <!-- TOP BAR -->
        <div class="rubick-top-bar">
            <nav class="rubick-breadcrumb" aria-label="breadcrumb">
                <span class="breadcrumb-root"><i class="bi bi-mortarboard-fill me-1 text-primary"></i>ITS Manager</span>
                <i class="bi bi-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-section">Studente</span>
                <i class="bi bi-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-current">Lezioni</span>
            </nav>
            <div class="rubick-top-bar-actions">
                <div class="rubick-icon-badge" title="Notifiche">
                    <i class="bi bi-bell"></i>
                    <span class="rubick-badge-dot"></span>
                </div>
                <div class="rubick-user-avatar" title="Studente">ST</div>
            </div>
        </div>

        <!-- TOP ACTION BAR -->
        <div class="top-action-bar">
            <div class="page-header-info">
                <h1>
                    <i class="bi bi-calendar3 text-primary"></i>
                    Lezioni
                </h1>
                <p>Calendario delle tue lezioni</p>
            </div>
        </div>

        <!-- LEZIONI FUTURE -->
        <div class="course-card-unit">
            <div class="course-card-header-line">
                <div class="course-card-title">
                    <i class="bi bi-calendar-check"></i>
                    <span>Prossime Lezioni</span>
                </div>
            </div>
            <div class="course-dropdown-body">
                ${futureLezioni.length > 0 ? `
                    <div class="list-group">
                        ${futureLezioni.map(lezione => `
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-1 fw-bold">${formatDateItalian(lezione.data)}</h6>
                                    <small class="text-muted">${lezione.ora_inizio} - ${lezione.ora_fine}</small>
                                </div>
                                <span class="badge bg-success">In Arrivo</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="text-center py-4 text-muted">
                        <i class="bi bi-calendar-x" style="font-size: 2rem;"></i>
                        <p class="mb-0 mt-2">Nessuna lezione futura programmata</p>
                    </div>
                `}
            </div>
        </div>

        <!-- LEZIONI PASSATE -->
        <div class="course-card-unit mt-4">
            <div class="course-card-header-line">
                <div class="course-card-title">
                    <i class="bi bi-calendar3"></i>
                    <span>Lezioni Passate</span>
                </div>
            </div>
            <div class="course-dropdown-body">
                ${pastLezioni.length > 0 ? `
                    <div class="list-group">
                        ${pastLezioni.map(lezione => `
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-1 fw-bold">${formatDateItalian(lezione.data)}</h6>
                                    <small class="text-muted">${lezione.ora_inizio} - ${lezione.ora_fine}</small>
                                </div>
                                <span class="badge bg-secondary">Completata</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="text-center py-4 text-muted">
                        <i class="bi bi-calendar" style="font-size: 2rem;"></i>
                        <p class="mb-0 mt-2">Nessuna lezione passata</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderTimbrature() {
    console.log('[STUDENTE] renderTimbrature chiamato');
    const container = document.querySelector('.main-content');
    console.log('[STUDENTE] Container trovato:', !!container);
    if (!container) {
        console.error('[STUDENTE] Container .main-content non trovato');
        return;
    }

    console.log('[STUDENTE] Dati timbrature - presenze:', studentPresenze.length);

    // Raggruppa presenze per data
    const presenzeByDate = {};
    studentPresenze.forEach(p => {
        if (!presenzeByDate[p.data_presenza]) {
            presenzeByDate[p.data_presenza] = [];
        }
        presenzeByDate[p.data_presenza].push(p);
    });

    const sortedDates = Object.keys(presenzeByDate).sort((a, b) => b.localeCompare(a));
    console.log('[STUDENTE] Date con presenze:', sortedDates);

    const html = `
        <!-- TOP BAR -->
        <div class="rubick-top-bar">
            <nav class="rubick-breadcrumb" aria-label="breadcrumb">
                <span class="breadcrumb-root"><i class="bi bi-mortarboard-fill me-1 text-primary"></i>ITS Manager</span>
                <i class="bi bi-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-section">Studente</span>
                <i class="bi bi-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-current">Timbrature</span>
            </nav>
            <div class="rubick-top-bar-actions">
                <div class="rubick-icon-badge" title="Notifiche">
                    <i class="bi bi-bell"></i>
                    <span class="rubick-badge-dot"></span>
                </div>
                <div class="rubick-user-avatar" title="Studente">ST</div>
            </div>
        </div>

        <!-- TOP ACTION BAR -->
        <div class="top-action-bar">
            <div class="page-header-info">
                <h1>
                    <i class="bi bi-clock-history text-primary"></i>
                    Timbrature
                </h1>
                <p>Registro delle tue presenze</p>
            </div>
        </div>

        <!-- TIMBRATURE -->
        <div class="course-card-unit">
            <div class="course-card-header-line">
                <div class="course-card-title">
                    <i class="bi bi-clock-history"></i>
                    <span>Registro Timbrature</span>
                </div>
            </div>
            <div class="course-dropdown-body">
                ${sortedDates.length > 0 ? `
                    <div class="list-group">
                        ${sortedDates.map(date => {
                            const presenze = presenzeByDate[date];
                            const totalMinutes = presenze.reduce((acc, p) => {
                                if (p.ora_ingresso && p.ora_uscita) {
                                    const inMin = timeToMinutes(p.ora_ingresso);
                                    const outMin = timeToMinutes(p.ora_uscita);
                                    if (inMin && outMin && outMin > inMin) {
                                        return acc + (outMin - inMin);
                                    }
                                }
                                return acc;
                            }, 0);

                            return `
                                <div class="list-group-item">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <h6 class="mb-0 fw-bold">${formatDateItalian(date)}</h6>
                                        <span class="badge bg-primary">${formatMinutesToHours(totalMinutes)}</span>
                                    </div>
                                    <div class="ms-3">
                                        ${presenze.map(p => `
                                            <div class="d-flex justify-content-between align-items-center py-1">
                                                <small class="text-muted">
                                                    <i class="bi bi-box-arrow-in-right text-success me-1"></i>
                                                    ${p.ora_ingresso?.substring(0, 5) || '--:--'}
                                                </small>
                                                <small class="text-muted">
                                                    <i class="bi bi-box-arrow-right text-primary me-1"></i>
                                                    ${p.ora_uscita?.substring(0, 5) || '--:--'}
                                                </small>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <div class="text-center py-4 text-muted">
                        <i class="bi bi-clock" style="font-size: 2rem;"></i>
                        <p class="mb-0 mt-2">Nessuna timbratura registrata</p>
                    </div>
                `}
            </div>
        </div>
    `;

    console.log('[STUDENTE] HTML generato, lunghezza:', html.length);
    container.innerHTML = html;
    console.log('[STUDENTE] innerHTML impostato');
}

// Utility functions
function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
}

function formatMinutesToHours(minutes) {
    if (!minutes || minutes <= 0) return '0h 00m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatDateItalian(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

function showToast(type, title, message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type === 'error' ? 'error' : 'success'}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
