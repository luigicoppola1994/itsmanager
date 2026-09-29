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

    // Setup mobile logout button
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', logout);
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
        let studentAula = null;
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
                            const aulaData = await aulaRes.json();
                            console.log('[STUDENTE] Dati aula:', aulaData);
                            const isStudenteInAula = aulaData.some(s => s.id_utente === parseInt(userId));
                            console.log('[STUDENTE] Studente in aula:', isStudenteInAula);
                            if (isStudenteInAula) {
                                studentEdizione = corso;
                                studentAula = aulaData;
                                console.log('[STUDENTE] Edizione trovata:', studentEdizione);
                                await loadEdizioneDetails();
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

        // Carica piano studio per calcolare ore totali
        let pianoStudio = [];
        if (studentEdizione) {
            try {
                const pianoRes = await fetchAutenticata(`${API_URL}/corsi-attivi/${studentEdizione.id_corso_attivo}/piano-studio`);
                if (pianoRes.ok) {
                    pianoStudio = await pianoRes.json();
                    console.log('[STUDENTE] Piano studio caricato:', pianoStudio.length);
                }
            } catch (e) {
                console.error('[STUDENTE] Errore caricamento piano studio:', e);
            }
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

        // Salva dati aggiuntivi
        window.studentAula = studentAula;
        window.pianoStudio = pianoStudio;

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
        // Carica il corso master usando id_corso
        const corsoRes = await fetchAutenticata(`${API_URL}/corsi/${studentEdizione.id_corso}`);
        console.log('[STUDENTE] Response corso master:', corsoRes.status, corsoRes.ok);
        if (corsoRes.ok) {
            studentCorso = await corsoRes.json();
            console.log('[STUDENTE] Corso master caricato:', studentCorso);
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
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');

    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        }
    });

    mobileNavItems.forEach(item => {
        item.classList.remove('active');
        const href = item.getAttribute('href');
        if (href === currentPage) {
            item.classList.add('active');
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
    if (!container) {
        console.error('[STUDENTE] Container .main-content non trovato');
        return;
    }

    console.log('[STUDENTE] Dati disponibili:');
    console.log('[STUDENTE] - studentData:', !!studentData, studentData);
    console.log('[STUDENTE] - studentEdizione:', !!studentEdizione, studentEdizione);
    console.log('[STUDENTE] - studentCorso:', !!studentCorso, studentCorso);
    console.log('[STUDENTE] - studentPresenze:', studentPresenze.length);
    console.log('[STUDENTE] - studentLezioni:', studentLezioni.length);
    console.log('[STUDENTE] - window.studentAula:', !!window.studentAula, window.studentAula);
    console.log('[STUDENTE] - window.pianoStudio:', !!window.pianoStudio, window.pianoStudio);

    // Se non ci sono dati, mostra messaggio appropriato
    if (!studentData && !studentEdizione && studentPresenze.length === 0 && studentLezioni.length === 0) {
        console.log('[STUDENTE] Nessun dato trovato, rendering empty state');
        renderEmptyState();
        return;
    }

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

    // Calcola ore totali del corso dal piano studio
    const totalCourseMinutes = (window.pianoStudio || []).reduce((acc, ps) => acc + (ps.ore_dedicate || 0) * 60, 0);
    const attendancePercentage = totalCourseMinutes > 0 ? Math.round((totalMinutes / totalCourseMinutes) * 100) : 0;
    
    // Calcola percentuale di corso svolto (basata sulle date)
    let courseProgressPercentage = 0;
    if (studentEdizione?.data_inizio && studentEdizione?.data_fine) {
        const startDate = new Date(studentEdizione.data_inizio);
        const endDate = new Date(studentEdizione.data_fine);
        const today = new Date();
        const totalDuration = endDate - startDate;
        const elapsed = today - startDate;
        if (totalDuration > 0) {
            courseProgressPercentage = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
        }
    }
    
    // Calcola ore di assenza e percentuale
    const absenceMinutes = Math.max(0, totalCourseMinutes - totalMinutes);
    const absencePercentage = totalCourseMinutes > 0 ? Math.round((absenceMinutes / totalCourseMinutes) * 100) : 0;

    const today = new Date().toISOString().split('T')[0];
    const todayLezioni = studentLezioni.filter(l => l.data === today);
    const upcomingLezioni = studentLezioni
        .filter(l => l.data >= today)
        .sort((a, b) => a.data.localeCompare(b.data))
        .slice(0, 5);

    // Ultima timbratura
    const lastPresenza = studentPresenze.length > 0 
        ? studentPresenze.sort((a, b) => b.data_presenza.localeCompare(a.data_presenza))[0]
        : null;

    const studentName = studentData ? `${studentData.Nome} ${studentData.Cognome}` : 'Studente';
    const studentEmail = studentData?.Email || '—';
    const studentPhone = studentData?.Telefono || '—';
    
    // Verifica struttura aula
    console.log('[STUDENTE] Struttura window.studentAula:', window.studentAula);
    let aulaNome = 'Aula non assegnata';
    if (window.studentAula?.length > 0) {
        const aulaData = window.studentAula[0];
        console.log('[STUDENTE] Primo elemento aula:', aulaData);
        if (aulaData.aula?.Nome) {
            aulaNome = aulaData.aula.Nome;
        } else if (aulaData.Nome) {
            aulaNome = aulaData.Nome;
        }
    }

    console.log('[STUDENTE] Generazione HTML con dati:');
    console.log('[STUDENTE] - studentName:', studentName);
    console.log('[STUDENTE] - studentEmail:', studentEmail);
    console.log('[STUDENTE] - studentPhone:', studentPhone);
    console.log('[STUDENTE] - aulaNome:', aulaNome);
    console.log('[STUDENTE] - totalMinutes:', totalMinutes);
    console.log('[STUDENTE] - totalCourseMinutes:', totalCourseMinutes);
    console.log('[STUDENTE] - attendancePercentage:', attendancePercentage);
    console.log('[STUDENTE] - totalPresenze:', totalPresenze);
    console.log('[STUDENTE] - todayLezioni:', todayLezioni.length);
    console.log('[STUDENTE] - lastPresenza:', lastPresenza);
    console.log('[STUDENTE] - upcomingLezioni:', upcomingLezioni.length);

    try {
        console.log('[STUDENTE] Inizio generazione HTML template');
        
        // Verifica timbratura odierna
        const today = new Date().toISOString().split('T')[0];
        const todayPresenza = studentPresenze.find(p => p.data_presenza === today);
        const hasTimbratoOggi = todayPresenza && todayPresenza.ora_ingresso;
        
        const htmlContent = `
        <style>
            @media (max-width: 768px) {
                .dashboard-container {
                    padding: 10px !important;
                    padding-bottom: 80px !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                }
                .dashboard-card {
                    padding: 15px !important;
                    border-radius: 8px !important;
                    margin-bottom: 15px !important;
                    margin-left: 0 !important;
                    margin-right: 0 !important;
                }
                .info-grid {
                    grid-template-columns: 1fr !important;
                    gap: 10px !important;
                }
                .section-title {
                    font-size: 1rem !important;
                }
                .badge {
                    font-size: 0.7rem !important;
                    padding: 5px 10px !important;
                }
                h1 {
                    font-size: 1.5rem !important;
                    margin-bottom: 15px !important;
                }
                p {
                    font-size: 0.9rem !important;
                }
                /* FullCalendar responsive */
                #studentCalendar {
                    min-height: 350px !important;
                }
                .fc-toolbar {
                    flex-direction: column !important;
                    gap: 8px !important;
                }
                .fc-toolbar-title {
                    font-size: 0.9rem !important;
                }
                .fc-button {
                    font-size: 0.75rem !important;
                    padding: 5px 10px !important;
                }
            }
        </style>
        <div class="dashboard-container" style="font-family: Arial, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; background: #f5f5f5;">
            <h1 style="color: #333; margin-bottom: 20px; font-size: 1.8rem;">Dashboard Studente</h1>
            <p style="color: #666; margin-bottom: 30px; font-size: 1rem;">Benvenuto, ${studentName}</p>
            
            <!-- SEZIONE 1: DATI DELLO STUDENTE -->
            <div class="dashboard-card" style="background: white; padding: 25px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #007bff; flex-wrap: wrap; gap: 10px;">
                    <h2 class="section-title" style="color: #333; margin: 0; font-size: 1.3rem; flex: 1;">
                        <i class="bi bi-person-fill"></i> Dati Anagrafici
                    </h2>
                    <span class="badge" style="background: ${hasTimbratoOggi ? '#28a745' : '#ffc107'}; color: white; padding: 8px 15px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">
                        ${hasTimbratoOggi ? '✓ Timbrato Oggi' : '⚠ Non Timbrato'}
                    </span>
                </div>
                <div class="info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Nome:</strong> ${studentData?.Nome || '—'}</p>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Cognome:</strong> ${studentData?.Cognome || '—'}</p>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Email:</strong> ${studentEmail}</p>
                    </div>
                    <div>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Telefono:</strong> ${studentPhone}</p>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Codice Fiscale:</strong> ${studentData?.CF || '—'}</p>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Data di nascita:</strong> ${studentData?.Data_Nascita ? formatDateItalian(studentData.Data_Nascita) : '—'}</p>
                    </div>
                </div>
            </div>

            <!-- SEZIONE 2: INFO CORSO -->
            ${studentEdizione ? `
            <div class="dashboard-card" style="background: white; padding: 25px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #007bff;">
                    <h2 class="section-title" style="color: #333; margin: 0; font-size: 1.3rem;">
                        <i class="bi bi-book-fill"></i> ${studentCorso?.Nome || 'Corso'}
                    </h2>
                </div>
                <div class="info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Edizione:</strong> ${studentEdizione.nome_edizione || studentEdizione.etichetta || 'Edizione'}</p>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Data Inizio:</strong> ${formatDateItalian(studentEdizione.data_inizio)}</p>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Data Fine:</strong> ${formatDateItalian(studentEdizione.data_fine)}</p>
                    </div>
                    <div>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Durata Totale:</strong> ${studentEdizione.durata_ore || formatMinutesToHours(totalCourseMinutes)} ore</p>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Ore Svolte:</strong> ${formatMinutesToHours(totalMinutes)} <span style="background: ${attendancePercentage >= 75 ? '#28a745' : attendancePercentage >= 50 ? '#ffc107' : '#dc3545'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin-left: 8px;">${attendancePercentage}%</span></p>
                        <p style="color: #666; margin: 8px 0; font-size: 0.95rem;"><strong>Ore Assenza:</strong> ${formatMinutesToHours(absenceMinutes)} <span style="background: #6c757d; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin-left: 8px;">${absencePercentage}%</span></p>
                    </div>
                </div>
            </div>
            ` : ''}

            ${todayLezioni.length > 0 ? `
            <section class="today-lesson-card" aria-labelledby="todayLessonTitle">
                <div class="today-lesson-icon"><i class="bi bi-qr-code-scan"></i></div>
                <div class="today-lesson-content">
                    <span class="today-lesson-eyebrow">Oggi in aula</span>
                    <h2 id="todayLessonTitle">Hai una lezione prevista oggi</h2>
                    <p>${todayLezioni[0].ora_inizio?.substring(0, 5) || '--:--'} - ${todayLezioni[0].ora_fine?.substring(0, 5) || '--:--'}</p>
                </div>
                <a class="today-lesson-action" href="timbrature.html?genera_qr=1">
                    <i class="bi bi-arrow-right-circle me-1"></i>Genera QR
                </a>
            </section>
            ` : ''}

            <!-- SEZIONE 3: CALENDARIO SETTIMANALE -->
            <div class="dashboard-card" style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #007bff;">
                    <h2 class="section-title" style="color: #333; margin: 0; font-size: 1.3rem;">
                        <i class="bi bi-calendar3"></i> Calendario Lezioni
                    </h2>
                </div>
                <div id="studentCalendar" style="min-height: 500px;"></div>
            </div>
        </div>
    `;
        console.log('[STUDENTE] HTML generato, lunghezza:', htmlContent.length);
        container.innerHTML = htmlContent;
        console.log('[STUDENTE] innerHTML impostato');
        
        // Inizializza FullCalendar
        initStudentCalendar();
        
        // Aggiungi handler per logout mobile
        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', () => {
                localStorage.removeItem('user_id');
                localStorage.removeItem('auth_token');
                window.location.href = '../index.html';
            });
        }
        
        // Previeni apertura sidebar su mobile per i link della bottom bar
        const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
        mobileNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Se è un link, naviga normalmente
                if (item.tagName === 'A') {
                    return;
                }
            });
        });
        
        // Disabilita toggle sidebar su mobile
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.style.display = 'none';
                sidebar.style.visibility = 'hidden';
            }
        }
    } catch (e) {
        console.error('[STUDENTE] Errore durante rendering HTML:', e);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Errore durante il rendering della dashboard: ${e.message}
            </div>
        `;
    }
}

function initStudentCalendar() {
    const calendarEl = document.getElementById('studentCalendar');
    if (!calendarEl || !studentEdizione) return;

    const today = new Date().toISOString().split('T')[0];
    
    // Converti le lezioni in eventi FullCalendar
    const events = studentLezioni.map(l => ({
        title: l.note || 'Lezione',
        start: `${l.data}T${(l.ora_inizio || '').substring(0, 5)}:00`,
        end: `${l.data}T${(l.ora_fine || '').substring(0, 5)}:00`,
        backgroundColor: l.data === today ? '#dc3545' : '#4682B4',
        borderColor: l.data === today ? '#dc3545' : '#4682B4'
    }));

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        initialDate: today,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: {
            today: 'Oggi',
            month: 'Mese',
            week: 'Settimana',
            day: 'Giorno'
        },
        locale: 'it',
        firstDay: 1,
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        allDaySlot: false,
        slotDuration: '00:30:00',
        editable: false,
        events: events
    });

    calendar.render();
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
    const container = document.querySelector('#timbratureContent');
    console.log('[STUDENTE] Container trovato:', !!container);
    if (!container) {
        console.error('[STUDENTE] Container #timbratureContent non trovato');
        return;
    }

    console.log('[STUDENTE] Dati timbrature - presenze:', studentPresenze.length);

    // Verifica lezione oggi
    checkLezioneOggi();

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

        <!-- SEZIONE TIMBRATURA GIORNO -->
        <div class="course-card-unit mb-4">
            <div class="course-card-header-line">
                <div class="course-card-title">
                    <i class="bi bi-qr-code-scan"></i>
                    <span>Timbratura del Giorno</span>
                </div>
            </div>
            <div class="course-dropdown-body">
                <div id="lezioneOggiContainer">
                    <div class="text-center py-4">
                        <div class="spinner-border text-primary mb-3" role="status"></div>
                        <p class="text-muted">Verifica lezioni di oggi...</p>
                    </div>
                </div>
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

// Funzione per verificare lezione oggi
async function checkLezioneOggi() {
    console.log('[STUDENTE] Verifica lezione oggi');
    try {
        const response = await fetchAutenticata(`${API_URL}/studente/lezione-oggi`);
        if (response.ok) {
            const data = await response.json();
            console.log('[STUDENTE] Risposta lezione oggi:', data);
            renderLezioneOggi(data);
        } else {
            console.error('[STUDENTE] Errore verifica lezione oggi:', response.status);
            renderLezioneOggi({ ha_lezione: false, messaggio: 'Errore nel caricamento delle lezioni' });
        }
    } catch (error) {
        console.error('[STUDENTE] Errore verifica lezione oggi:', error);
        renderLezioneOggi({ ha_lezione: false, messaggio: 'Errore di connessione' });
    }
}

// Funzione per renderizzare la sezione lezione oggi
function renderLezioneOggi(data) {
    const container = document.getElementById('lezioneOggiContainer');
    if (!container) return;

    if (!data.ha_lezione) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-calendar-x text-muted" style="font-size: 2rem;"></i>
                <p class="text-muted mt-2 mb-0">${data.messaggio}</p>
            </div>
        `;
        return;
    }

    const lezione = data.lezione;
    const today = new Date().toISOString().split('T')[0];
    const presenzaOggi = studentPresenze.find(p => p.data_presenza === today);

    let timbraturaStatus = '';
    if (presenzaOggi) {
        if (presenzaOggi.ora_ingresso && presenzaOggi.ora_uscita) {
            timbraturaStatus = `
                <div class="alert alert-success mb-3">
                    <i class="bi bi-check-circle-fill me-2"></i>
                    Hai completato la timbratura per oggi
                    <div class="mt-2">
                        <small>Ingresso: ${presenzaOggi.ora_ingresso?.substring(0, 5)}</small><br>
                        <small>Uscita: ${presenzaOggi.ora_uscita?.substring(0, 5)}</small>
                    </div>
                </div>
            `;
        } else if (presenzaOggi.ora_ingresso) {
            timbraturaStatus = `
                <div class="alert alert-warning mb-3">
                    <i class="bi bi-clock-fill me-2"></i>
                    Hai timbrato l'ingresso alle ${presenzaOggi.ora_ingresso?.substring(0, 5)}
                    <button id="btnTimbraUscita" class="btn btn-sm btn-primary mt-2">
                        <i class="bi bi-box-arrow-right me-1"></i>Timbra Uscita
                    </button>
                </div>
            `;
        }
    }

    container.innerHTML = `
            <div class="qr-lesson-summary mb-3">
            <i class="bi bi-calendar-check me-2"></i>
            <strong>Lezione oggi:</strong> ${formatDateItalian(lezione.data)}
            <br>
            <small>Orario: ${lezione.ora_inizio?.substring(0, 5)} - ${lezione.ora_fine?.substring(0, 5)}</small>
        </div>
        ${timbraturaStatus}
        ${!presenzaOggi || !presenzaOggi.ora_ingresso ? `
            <div class="text-center">
                <button id="btnGeneraQR" class="btn btn-primary btn-lg">
                    <i class="bi bi-qr-code-scan me-2"></i>Genera QR Code per Timbrare
                </button>
            </div>
            <div id="qrCodeContainer" class="qr-code-panel text-center mt-4" style="display: none;">
                <div class="card-body">
                        <span class="qr-code-kicker">Timbratura digitale</span>
                        <h5 class="card-title mb-3">QR Code pronto</h5>
                        <canvas id="qrCode" class="qr-code-canvas mb-3"></canvas>
                        <p class="text-muted small mb-3">Scansiona questo QR code per timbrare l'ingresso</p>
                        <p class="text-warning small mb-3">
                            <i class="bi bi-clock me-1"></i>Valido per 5 minuti
                        </p>
                        <button id="btnTimbra" class="btn btn-success">
                            <i class="bi bi-check-circle me-1"></i>Conferma Timbratura
                        </button>
                        <button id="btnAnnullaQR" class="btn btn-secondary ms-2">
                            <i class="bi bi-x-circle me-1"></i>Annulla
                        </button>
                </div>
            </div>
        ` : ''}
    `;

    // Aggiungi event listeners
    const btnGeneraQR = document.getElementById('btnGeneraQR');
    if (btnGeneraQR) {
        btnGeneraQR.addEventListener('click', generaQRCode);
    }

    const btnTimbraUscita = document.getElementById('btnTimbraUscita');
    if (btnTimbraUscita) {
        btnTimbraUscita.addEventListener('click', timbraUscita);
    }

    const btnTimbra = document.getElementById('btnTimbra');
    if (btnTimbra) {
        btnTimbra.addEventListener('click', confermaTimbratura);
    }

    const btnAnnullaQR = document.getElementById('btnAnnullaQR');
    if (btnAnnullaQR) {
        btnAnnullaQR.addEventListener('click', annullaQRCode);
    }

    if (new URLSearchParams(window.location.search).get('genera_qr') === '1' && btnGeneraQR) {
        generaQRCode();
    }
}

// Funzione per generare QR code
async function generaQRCode() {
    console.log('[STUDENTE] Generazione QR code');
    try {
        // Prima ottieni lezione oggi
        const lezioneResponse = await fetchAutenticata(`${API_URL}/studente/lezione-oggi`);
        if (!lezioneResponse.ok) {
            showToast('error', 'Errore', 'Impossibile ottenere le lezioni di oggi');
            return;
        }

        const lezioneData = await lezioneResponse.json();
        if (!lezioneData.ha_lezione || !lezioneData.lezione) {
            showToast('error', 'Errore', 'Nessuna lezione trovata per oggi');
            return;
        }

        // Genera QR code
        const qrResponse = await fetchAutenticata(`${API_URL}/studente/genera-qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_lezione: lezioneData.lezione.id })
        });

        if (!qrResponse.ok) {
            const errorData = await qrResponse.json();
            showToast('error', 'Errore', errorData.detail || 'Impossibile generare QR code');
            return;
        }

        const qrData = await qrResponse.json();
        console.log('[STUDENTE] QR code generato:', qrData);

        // Mostra container QR code
        const qrContainer = document.getElementById('qrCodeContainer');
        const btnGeneraQR = document.getElementById('btnGeneraQR');
        if (qrContainer && btnGeneraQR) {
            qrContainer.style.display = 'block';
            btnGeneraQR.style.display = 'none';

            // Genera QR code visivo
            const qrElement = document.getElementById('qrCode');
            if (!qrElement || typeof QRCode === 'undefined') {
                showToast('error', 'Errore', 'Libreria QR non disponibile');
                return;
            }

            try {
                await QRCode.toCanvas(qrElement, qrData.qr_code_data, {
                    width: 200,
                    margin: 2,
                    color: {
                        dark: '#4682B4',
                        light: '#ffffff'
                    }
                });
            } catch (error) {
                console.error('[STUDENTE] Errore rendering QR code:', error);
                showToast('error', 'Errore', 'Impossibile visualizzare il QR code');
                return;
            }

            // Salva dati QR code per conferma
            window.currentQRData = qrData;
        }

        showToast('success', 'QR Code', 'QR code generato con successo');
    } catch (error) {
        console.error('[STUDENTE] Errore generazione QR code:', error);
        showToast('error', 'Errore', 'Impossibile generare QR code');
    }
}

// Funzione per confermare timbratura
async function confermaTimbratura() {
    console.log('[STUDENTE] Conferma timbratura');
    if (!window.currentQRData) {
        showToast('error', 'Errore', 'Nessun QR code disponibile');
        return;
    }

    try {
        const response = await fetchAutenticata(`${API_URL}/studente/timbra-qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_data: window.currentQRData.qr_code_data })
        });

        if (!response.ok) {
            const errorData = await response.json();
            showToast('error', 'Errore', errorData.detail || 'Impossibile timbrare');
            return;
        }

        const result = await response.json();
        console.log('[STUDENTE] Timbratura registrata:', result);

        // Nascondi QR code
        annullaQRCode();

        // Ricarica dati e aggiorna UI
        await loadStudentData();
        checkLezioneOggi();

        showToast('success', 'Timbratura', result.messaggio);
    } catch (error) {
        console.error('[STUDENTE] Errore conferma timbratura:', error);
        showToast('error', 'Errore', 'Impossibile confermare timbratura');
    }
}

// Funzione per annullare QR code
function annullaQRCode() {
    const qrContainer = document.getElementById('qrCodeContainer');
    const btnGeneraQR = document.getElementById('btnGeneraQR');
    if (qrContainer && btnGeneraQR) {
        qrContainer.style.display = 'none';
        btnGeneraQR.style.display = 'inline-block';
    }
    window.currentQRData = null;
}

// Funzione per timbrare uscita
async function timbraUscita() {
    console.log('[STUDENTE] Timbratura uscita');
    try {
        const today = new Date().toISOString().split('T')[0];
        const presenzaOggi = studentPresenze.find(p => p.data_presenza === today);

        if (!presenzaOggi) {
            showToast('error', 'Errore', 'Nessuna timbratura di ingresso trovata');
            return;
        }

        // Aggiorna presenza con ora uscita
        const updateData = {
            ora_uscita: new Date().toTimeString().substring(0, 8)
        };

        const response = await fetchAutenticata(`${API_URL}/presenze/${presenzaOggi.id_presenza}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            showToast('error', 'Errore', errorData.detail || 'Impossibile timbrare uscita');
            return;
        }

        // Ricarica dati e aggiorna UI
        await loadStudentData();
        checkLezioneOggi();

        showToast('success', 'Timbratura', 'Uscita registrata con successo');
    } catch (error) {
        console.error('[STUDENTE] Errore timbratura uscita:', error);
        showToast('error', 'Errore', 'Impossibile timbrare uscita');
    }
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
