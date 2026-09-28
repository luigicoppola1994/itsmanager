// ============================================================
// calendario.js v3.0 — Gestione Calendario Didattico
// ============================================================

let calendar = null;
let corsiMasterList = [];
let corsiAttiviList = [];
let moduliList = [];
let docentiList = [];
let pianostudioList = []; // UF + ore per corso attivo selezionato
let lezioniList = [];     // Lezioni caricate correntemente

// Selezione corrente
let selectedCorsoId = null;
let selectedCorsoAttivo = null;

const COLOR_PALETTE = [
    '#4682B4', '#059669', '#d97706', '#7c3aed',
    '#dc3545', '#0891b2', '#3a6f9f', '#ca8a04',
    '#0d9488', '#9333ea', '#c026d3', '#315d87'
];

// ── BOOTSTRAP INIT ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Carica dati iniziali
    await Promise.all([
        loadCorsiMaster(),
        loadEdizioniCorsi(),
        loadDocenti(),
        loadModuli()
    ]);

    // Listeners selezione edizione
    document.getElementById('btnGoToCalendar')?.addEventListener('click', enterCalendarView);
    document.getElementById('btnChangeEdizione')?.addEventListener('click', exitCalendarView);

    // Listeners navigazione a pagine standalone (Req 5)
    document.getElementById('btnNuovaLezione')?.addEventListener('click', () => {
        if (!selectedCorsoAttivo) return;
        window.location.href = `nuova-lezione.html?id_corso_attivo=${selectedCorsoAttivo.id_corso_attivo}`;
    });

    document.getElementById('btnProgrammaSettimana')?.addEventListener('click', () => {
        if (!selectedCorsoAttivo) return;
        window.location.href = `programma-settimana.html?id_corso_attivo=${selectedCorsoAttivo.id_corso_attivo}`;
    });

    // Filtro docente
    document.getElementById('selectDocenteFiltro')?.addEventListener('change', refreshCalendarEvents);

    // Auto-seleziona edizione se presente nei parametri URL
    const urlParams = new URLSearchParams(window.location.search);
    const paramEdizioneId = parseInt(urlParams.get('id_corso_attivo'));
    if (paramEdizioneId) {
        const ed = corsiAttiviList.find(ca => ca.id_corso_attivo === paramEdizioneId);
        if (ed) {
            selectCorso(ed.id_corso);
            selectEdizione(ed.id_corso_attivo);
            await enterCalendarView();
        }
    }
});

// ═══════════════════════════════════════════════════
//  FASE 1 — SELEZIONE CORSO / EDIZIONE
// ═══════════════════════════════════════════════════

async function loadCorsiMaster() {
    try {
        const res = await fetchAutenticata(`${API_URL}/corsi`);
        if (!res.ok) throw new Error();
        corsiMasterList = await res.json();
        renderCorsiGrid();
    } catch (e) {
        document.getElementById('corsiGrid').innerHTML = '<p class="text-danger small">Errore caricamento corsi.</p>';
    }
}

async function loadEdizioniCorsi() {
    try {
        const res = await fetchAutenticata(`${API_URL}/corsi-attivi`);
        if (!res.ok) throw new Error();
        corsiAttiviList = await res.json();
    } catch (e) {
        console.error('Errore caricamento edizioni:', e);
    }
}

function renderCorsiGrid() {
    const grid = document.getElementById('corsiGrid');
    if (!corsiMasterList.length) {
        grid.innerHTML = '<p class="text-muted small">Nessun corso disponibile.</p>';
        return;
    }

    grid.innerHTML = corsiMasterList.map(c => {
        const nEdizioni = corsiAttiviList.filter(ca => ca.id_corso === c.id_corso && !ca.archiviato).length;
        return `
            <div class="corso-card" data-corso-id="${c.id_corso}" onclick="selectCorso(${c.id_corso})">
                <div class="corso-card-icon"><i class="bi bi-journal-bookmark-fill"></i></div>
                <div>
                    <div class="corso-card-name">${c.Nome}</div>
                    <div class="corso-card-desc">${nEdizioni} edizion${nEdizioni === 1 ? 'e' : 'i'} attiv${nEdizioni === 1 ? 'a' : 'e'}</div>
                </div>
                <i class="bi bi-chevron-right ms-auto text-muted"></i>
            </div>
        `;
    }).join('');
}

function selectCorso(idCorso) {
    selectedCorsoId = idCorso;

    // Highlight card
    document.querySelectorAll('.corso-card').forEach(c => {
        c.classList.toggle('selected', parseInt(c.dataset.corsoId) === idCorso);
    });

    // Attiva step 2
    const step2 = document.getElementById('stepCardEdizione');
    step2.style.opacity = '1';
    step2.style.pointerEvents = 'auto';
    step2.classList.add('active');
    document.getElementById('stepBadge2').classList.replace('step-badge-secondary', 'step-badge-primary');

    renderEdizioniGrid(idCorso);
}

function renderEdizioniGrid(idCorso) {
    const grid = document.getElementById('edizioniGrid');
    const filtered = corsiAttiviList.filter(ca => ca.id_corso === idCorso && !ca.archiviato);

    if (!filtered.length) {
        grid.innerHTML = '<p class="text-muted small">Nessuna edizione attiva per questo corso.</p>';
        document.getElementById('goToCalendarBar').style.display = 'none';
        return;
    }

    grid.innerHTML = filtered.map(ca => {
        const label = ca.etichetta || `Edizione #${ca.id_corso_attivo}`;
        const inizio = ca.data_inizio ? formatDate(ca.data_inizio) : '—';
        const fine   = ca.data_fine   ? formatDate(ca.data_fine)   : '—';
        const durata = ca.durata_ore  ? `${ca.durata_ore}h` : '—';

        return `
            <div class="edizione-card" data-edizione-id="${ca.id_corso_attivo}" onclick="selectEdizione(${ca.id_corso_attivo})">
                <div class="edizione-icon"><i class="bi bi-calendar3-event"></i></div>
                <div class="edizione-info">
                    <div class="edizione-label">${label}</div>
                    <div class="edizione-dates">
                        <span class="date-chip"><i class="bi bi-play-fill me-1"></i>${inizio}</span>
                        <span class="date-chip"><i class="bi bi-stop-fill me-1"></i>${fine}</span>
                        <span class="date-chip"><i class="bi bi-clock me-1"></i>${durata}</span>
                    </div>
                </div>
                <i class="bi bi-chevron-right ms-auto text-muted"></i>
            </div>
        `;
    }).join('');

    document.getElementById('goToCalendarBar').style.display = 'none';
}

function selectEdizione(idCorsoAttivo) {
    selectedCorsoAttivo = corsiAttiviList.find(ca => ca.id_corso_attivo === idCorsoAttivo);
    if (!selectedCorsoAttivo) return;

    document.querySelectorAll('.edizione-card').forEach(c => {
        c.classList.toggle('selected', parseInt(c.dataset.edizioneId) === idCorsoAttivo);
    });

    document.getElementById('goToCalendarBar').style.display = 'block';
}

async function enterCalendarView() {
    if (!selectedCorsoAttivo) return;

    // Aggiorna banner
    const corso = corsiMasterList.find(c => c.id_corso === selectedCorsoAttivo.id_corso);
    const label = selectedCorsoAttivo.etichetta || `Edizione #${selectedCorsoAttivo.id_corso_attivo}`;

    document.getElementById('bannerCorsoNome').textContent = corso ? corso.Nome : '—';
    document.getElementById('bannerEdizioneNome').textContent = label;
    document.getElementById('breadcrumbLabel').textContent = `Calendario — ${label}`;

    const inizio = selectedCorsoAttivo.data_inizio ? formatDate(selectedCorsoAttivo.data_inizio) : '—';
    const fine   = selectedCorsoAttivo.data_fine   ? formatDate(selectedCorsoAttivo.data_fine)   : '—';
    const durata = selectedCorsoAttivo.durata_ore  ? `${selectedCorsoAttivo.durata_ore} ore totali` : '—';

    document.getElementById('bannerDataInizio').innerHTML = `<i class="bi bi-play-fill"></i><span>${inizio}</span>`;
    document.getElementById('bannerDataFine').innerHTML   = `<i class="bi bi-stop-fill"></i><span>${fine}</span>`;
    document.getElementById('bannerDurataOre').innerHTML  = `<i class="bi bi-clock-history"></i><span>${durata}</span>`;

    // Switch views
    document.getElementById('editionPickerScreen').style.display = 'none';
    document.getElementById('calendarScreen').style.display = 'flex';
    document.getElementById('calendarScreen').style.flexDirection = 'column';

    // Mostra barra azioni calendario
    document.getElementById('calendarActionsBar').style.display = 'flex';

    // Carica piano studio per questa edizione
    await loadPianoStudio(selectedCorsoAttivo.id_corso_attivo);

    // Inizializza o aggiorna calendario
    if (!calendar) {
        initFullCalendar();
    } else {
        calendar.destroy();
        calendar = null;
        initFullCalendar();
    }
}

function exitCalendarView() {
    document.getElementById('calendarScreen').style.display = 'none';
    document.getElementById('editionPickerScreen').style.display = 'flex';
    document.getElementById('editionPickerScreen').style.flexDirection = 'column';
    document.getElementById('breadcrumbLabel').textContent = 'Calendario';
    document.getElementById('calendarActionsBar').style.display = 'none';
    selectedCorsoAttivo = null;

    // Rimuovi parametro URL senza ricaricare la pagina
    window.history.replaceState({}, document.title, window.location.pathname);
}

// ═══════════════════════════════════════════════════
//  CARICA DATI AUSILIARI
// ═══════════════════════════════════════════════════

async function loadDocenti() {
    const selectFiltro = document.getElementById('selectDocenteFiltro');

    try {
        let ruoliMap = {};
        try {
            const ruoliRes = await fetchAutenticata(`${API_URL}/ruoli`);
            if (ruoliRes.ok) {
                const ruoli = await ruoliRes.json();
                ruoli.forEach(r => { ruoliMap[r.id_ruolo] = (r.Nome || '').toLowerCase(); });
            }
        } catch (e) {}

        const res = await fetchAutenticata(`${API_URL}/users`);
        if (!res.ok) throw new Error();
        const allUsers = await res.json();

        docentiList = allUsers.filter(u => {
            const rNome = (u.ruolo?.Nome || ruoliMap[u.id_ruolo] || '').toLowerCase().trim();
            return rNome.includes('docente') || rNome.includes('prof');
        });
        if (!docentiList.length) docentiList = allUsers;

        let optFiltro = '<option value="">Tutti i docenti</option>';
        docentiList.forEach(d => {
            optFiltro += `<option value="${d.id_utente}">${d.Nome} ${d.Cognome}</option>`;
        });

        if (selectFiltro) selectFiltro.innerHTML = optFiltro;
    } catch (e) {
        console.error('Errore docenti:', e);
    }
}

let unitaFormativeList = [];

async function loadModuli() {
    try {
        const [resM, resUf] = await Promise.all([
            fetchAutenticata(`${API_URL}/moduli`),
            fetchAutenticata(`${API_URL}/unita_formative`)
        ]);
        if (resM.ok) moduliList = await resM.json();
        if (resUf.ok) unitaFormativeList = await resUf.json();
    } catch (e) {}
}

async function loadPianoStudio(idCorsoAttivo) {
    try {
        const res = await fetchAutenticata(`${API_URL}/corsi-attivi/${idCorsoAttivo}/piano-studio`);
        if (!res.ok) throw new Error();
        pianostudioList = await res.json();
    } catch (e) {
        pianostudioList = [];
        console.error('Errore piano studio:', e);
    }

    if (!moduliList.length || !unitaFormativeList.length) {
        await loadModuli();
    }

    pianostudioList = pianostudioList.map(ps => {
        const uf = unitaFormativeList.find(u => u.id_unita_formativa === ps.id_unita_formativa);
        return { ...ps, uf_nome: uf ? uf.Nome : `UF #${ps.id_unita_formativa}` };
    });

    renderOreSidebar({});
}

// ═══════════════════════════════════════════════════
//  FULLCALENDAR
// ═══════════════════════════════════════════════════

function initFullCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    const validRange = {};
    if (selectedCorsoAttivo?.data_inizio) validRange.start = selectedCorsoAttivo.data_inizio;
    if (selectedCorsoAttivo?.data_fine) {
        const endDate = new Date(selectedCorsoAttivo.data_fine);
        endDate.setDate(endDate.getDate() + 1);
        validRange.end = endDate.toISOString().split('T')[0];
    }

    const today = new Date().toISOString().split('T')[0];
    const isInRange = (!selectedCorsoAttivo?.data_inizio || today >= selectedCorsoAttivo.data_inizio) &&
                      (!selectedCorsoAttivo?.data_fine   || today <= selectedCorsoAttivo.data_fine);
    const initialDate = isInRange ? today : (selectedCorsoAttivo?.data_inizio || today);

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        initialDate: initialDate,
        validRange: validRange.start ? validRange : undefined,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
        },
        buttonText: {
            today:    'Oggi',
            month:    'Mese',
            week:     'Settimana',
            day:      'Giorno',
            list:     'Elenco'
        },
        locale: 'it',
        firstDay: 1,
        slotMinTime: '07:30:00',
        slotMaxTime: '23:00:00',
        allDaySlot: false,
        slotDuration: '00:30:00',
        selectable: true,
        editable: true,
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false
        },

        // Custom event render
        eventContent: (arg) => {
            const props       = arg.event.extendedProps || {};
            const moduloNome  = props._moduloNome  || arg.event.title || 'Lezione';
            const docenteNome = props._docenteNome || '';
            const note        = props.note || '';
            const borderColor = arg.event.borderColor || '#4682B4';

            return { html: `
                <div class="fc-custom-card" style="border-left: 4px solid ${borderColor}; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);">
                    <div class="fc-custom-time" style="color:${borderColor};">
                        <i class="bi bi-clock"></i>
                        <span>${arg.timeText}</span>
                    </div>
                    <div class="fc-custom-title">${moduloNome}</div>
                    ${docenteNome ? `<div class="fc-custom-docente"><i class="bi bi-person-fill"></i><span>${docenteNome}</span></div>` : ''}
                    ${note ? `<div class="fc-custom-note"><i class="bi bi-geo-alt-fill"></i><span>${note}</span></div>` : ''}
                </div>
            `};
        },

        // Click slot vuoto → Naviga alla pagina standalone di creazione
        select: (info) => {
            if (!selectedCorsoAttivo) return;
            const data = info.startStr.split('T')[0];
            if (selectedCorsoAttivo.data_inizio && data < selectedCorsoAttivo.data_inizio) {
                showToast(`Data fuori dal periodo del corso (inizio: ${formatDate(selectedCorsoAttivo.data_inizio)})`, true);
                calendar.unselect();
                return;
            }
            if (selectedCorsoAttivo.data_fine && data > selectedCorsoAttivo.data_fine) {
                showToast(`Data fuori dal periodo del corso (fine: ${formatDate(selectedCorsoAttivo.data_fine)})`, true);
                calendar.unselect();
                return;
            }

            const startHour = info.startStr.includes('T') ? info.startStr.split('T')[1].substring(0, 5) : '09:00';
            const endHour   = info.endStr.includes('T')   ? info.endStr.split('T')[1].substring(0, 5)   : '13:00';
            window.location.href = `nuova-lezione.html?id_corso_attivo=${selectedCorsoAttivo.id_corso_attivo}&data=${data}&ora_inizio=${startHour}&ora_fine=${endHour}`;
        },

        // Click evento → Naviga alla pagina standalone di modifica
        eventClick: (info) => {
            if (!selectedCorsoAttivo) return;
            const props = info.event.extendedProps || {};
            const eventId = info.event.id || props.id || props.id_lezione;
            window.location.href = `nuova-lezione.html?id_corso_attivo=${selectedCorsoAttivo.id_corso_attivo}&id_lezione=${eventId}`;
        },

        // Drag & drop
        eventDrop: async (info) => { await handleEventMove(info); },
        eventResize: async (info) => { await handleEventMove(info); }
    });

    calendar.render();
    refreshCalendarEvents();
}

// ═══════════════════════════════════════════════════
//  AGGIORNA EVENTI CALENDARIO
// ═══════════════════════════════════════════════════

async function refreshCalendarEvents() {
    if (!calendar || !selectedCorsoAttivo) return;

    const idDocente = document.getElementById('selectDocenteFiltro')?.value;
    let url = `${API_URL}/calendario?id_corso_attivo=${selectedCorsoAttivo.id_corso_attivo}`;
    if (idDocente) url += `&id_utente=${idDocente}`;

    try {
        const res = await fetchAutenticata(url);
        if (!res.ok) throw new Error();
        lezioniList = await res.json();

        const events = lezioniList.map(l => {
            const moduloObj  = moduliList.find(m => m.id_modulo === l.id_modulo);
            const docenteObj = docentiList.find(d => d.id_utente === l.id_utente);
            const moduloNome  = moduloObj  ? moduloObj.Nome : `Modulo #${l.id_modulo || 'N/D'}`;
            const docenteNome = docenteObj ? `${docenteObj.Nome} ${docenteObj.Cognome}` : '';
            const uf = moduloObj ? pianostudioList.find(ps => ps.id_unita_formativa === moduloObj.id_unita_formativa) : null;
            const colorIndex = uf ? (pianostudioList.indexOf(uf) % COLOR_PALETTE.length) : ((l.id_modulo || 0) % COLOR_PALETTE.length);

            return {
                id: l.id,
                title: moduloNome,
                start: `${l.data}T${(l.ora_inizio || '').substring(0, 5)}:00`,
                end:   `${l.data}T${(l.ora_fine   || '').substring(0, 5)}:00`,
                backgroundColor: COLOR_PALETTE[colorIndex],
                borderColor:     COLOR_PALETTE[colorIndex],
                extendedProps: { ...l, _moduloNome: moduloNome, _docenteNome: docenteNome }
            };
        });

        calendar.removeAllEvents();
        calendar.addEventSource(events);

        // Aggiorna sidebar con ore effettive
        updateOreSidebar();

    } catch (e) {
        showToast('Errore durante l\'aggiornamento delle lezioni.', true);
    }
}

// ═══════════════════════════════════════════════════
//  SIDEBAR ORE BUDGET
// ═══════════════════════════════════════════════════

function computeOrePianificate() {
    const orePerUf = {};
    lezioniList.forEach(l => {
        const modulo = moduliList.find(m => m.id_modulo === l.id_modulo);
        if (!modulo) return;
        const ufId = modulo.id_unita_formativa;
        if (!orePerUf[ufId]) orePerUf[ufId] = 0;
        const [hI, mI] = (l.ora_inizio || '00:00').split(':').map(Number);
        const [hF, mF] = (l.ora_fine   || '00:00').split(':').map(Number);
        orePerUf[ufId] += (hF * 60 + mF) - (hI * 60 + mI);
    });
    return orePerUf;
}

function renderOreSidebar(orePerUf) {
    const container = document.getElementById('ufBudgetList');
    if (!pianostudioList.length) {
        container.innerHTML = '<p class="text-muted small">Nessun piano studio configurato per questa edizione.</p>';
        document.getElementById('oreTotaliPianificate').textContent = '0h';
        return;
    }

    let totalMinutiPianificati = 0;
    Object.values(orePerUf).forEach(m => totalMinutiPianificati += m);
    document.getElementById('oreTotaliPianificate').textContent = minutiToOre(totalMinutiPianificati);

    container.innerHTML = pianostudioList.map((ps, i) => {
        const budgetMinuti  = (ps.ore_dedicate || 0) * 60;
        const pianifMinuti  = orePerUf[ps.id_unita_formativa] || 0;
        const perc = budgetMinuti > 0 ? Math.min((pianifMinuti / budgetMinuti) * 100, 100) : 0;
        const fillClass = perc >= 100 ? 'full' : perc >= 80 ? 'warn' : 'ok';
        const color = COLOR_PALETTE[i % COLOR_PALETTE.length];

        return `
            <div class="uf-ore-item">
                <div class="uf-ore-label">
                    <span style="display:flex;align-items:center;gap:6px;min-width:0;">
                        <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ps.uf_nome || `UF #${ps.id_unita_formativa}`}</span>
                    </span>
                    <span class="uf-ore-count">${minutiToOre(pianifMinuti)} / ${ps.ore_dedicate || 0}h</span>
                </div>
                <div class="uf-ore-bar">
                    <div class="uf-ore-bar-fill ${fillClass}" style="width:${perc}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

function updateOreSidebar() {
    const orePerUf = computeOrePianificate();
    renderOreSidebar(orePerUf);
}

// ═══════════════════════════════════════════════════
//  DRAG & DROP / RESIZE
// ═══════════════════════════════════════════════════

async function handleEventMove(info) {
    const lData    = info.event.extendedProps;
    const newStart = info.event.startStr;
    const newEnd   = info.event.endStr;
    const dataStr  = newStart.split('T')[0];
    const startH   = newStart.split('T')[1].substring(0, 5);
    const endH     = newEnd ? newEnd.split('T')[1].substring(0, 5) : '13:00';

    if (selectedCorsoAttivo) {
        if (selectedCorsoAttivo.data_inizio && dataStr < selectedCorsoAttivo.data_inizio) {
            info.revert();
            showToast(`Spostamento bloccato: La data (${formatDate(dataStr)}) precede l'inizio dell'edizione (${formatDate(selectedCorsoAttivo.data_inizio)}).`, true);
            return;
        }
        if (selectedCorsoAttivo.data_fine && dataStr > selectedCorsoAttivo.data_fine) {
            info.revert();
            showToast(`Spostamento bloccato: La data (${formatDate(dataStr)}) supera la fine dell'edizione (${formatDate(selectedCorsoAttivo.data_fine)}).`, true);
            return;
        }
    }

    const payload = {
        data: dataStr,
        ora_inizio: `${startH}:00`,
        ora_fine:   `${endH}:00`,
        id_modulo:       lData.id_modulo,
        id_utente:       lData.id_utente,
        id_corso_attivo: lData.id_corso_attivo,
        note: lData.note || null
    };

    try {
        const res = await fetchAutenticata(`${API_URL}/calendario/${lData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            info.revert();
            const errorReason = await parseApiError(res);
            showToast(`Impossibile spostare: ${errorReason}`, true);
            return;
        }
        showToast('Orario lezione aggiornato con successo.');
        await refreshCalendarEvents();
    } catch (err) {
        info.revert();
        showToast(err.message || 'Errore durante lo spostamento della lezione.', true);
    }
}

// ═══════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════

function minutiToOre(min) {
    if (!min || min <= 0) return '0h';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateStr));
    } catch { return dateStr; }
}

async function parseApiError(res) {
    try {
        const data = await res.json();
        if (typeof data.detail === 'string' && data.detail.trim()) return data.detail;
        if (Array.isArray(data.detail) && data.detail.length > 0) return data.detail.map(d => d.msg || JSON.stringify(d)).join('; ');
        if (data.message) return data.message;
    } catch (e) {}
    return `Errore server (${res.status})`;
}

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast show${isError ? ' error' : ''}`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}
