// ============================================================
// aule.js — Gestione Aule & Selezione Corso/Edizione
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const selectCorso = document.getElementById('selectCorso');
    const selectEdizione = document.getElementById('selectEdizione');
    const btnVisualizzaAula = document.getElementById('btnVisualizzaAula');
    const noSelectionState = document.getElementById('noSelectionState');
    const aulaContentLayout = document.getElementById('aulaContentLayout');

    const listEl = document.getElementById('aulaStudentiList');
    const searchInput = document.getElementById('aulaSearchInput');
    const btnSelectAll = document.getElementById('btnAulaSelectAll');
    const btnDeselectAll = document.getElementById('btnAulaDeselectAll');
    const btnSaveAula = document.getElementById('btnSaveAula');

    const previewEdizioneTitle = document.getElementById('previewEdizioneTitle');
    const previewCorsoNome = document.getElementById('previewCorsoNome');
    const previewEdizioneBadge = document.getElementById('previewEdizioneBadge');
    const previewDatesVal = document.getElementById('previewDatesVal');
    const previewStudentiAssegnati = document.getElementById('previewStudentiAssegnati');
    const previewStudentiNonAssegnati = document.getElementById('previewStudentiNonAssegnati');
    const valTotStudentiSistema = document.getElementById('valTotStudentiSistema');
    const checkAlmenoUnoStudente = document.getElementById('checkAlmenoUnoStudente');

    let allCorsi = [];
    let allEdizioni = [];
    let allStudenti = [];
    let aulaIds = new Set();
    let currentEdizioneId = null;

    // 1. Carica Corsi ed Edizioni
    try {
        const [resCorsi, resEdizioni] = await Promise.all([
            fetchAutenticata(`${API_URL}/corsi`),
            fetchAutenticata(`${API_URL}/corsi-attivi`)
        ]);

        if (resCorsi.ok) {
            allCorsi = await resCorsi.json();
            // Ordina corsi alfabeticamente per nome
            allCorsi.sort((a, b) => (a.Nome || '').localeCompare(b.Nome || '', 'it', { sensitivity: 'base' }));
        }

        if (resEdizioni.ok) {
            allEdizioni = await resEdizioni.json();
        }

        populateCorsiSelect();

        // Controllo se un ID edizione è presente nell'URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlEdizioneId = parseInt(urlParams.get('id'));

        if (urlEdizioneId) {
            const edFound = allEdizioni.find(e => (e.id_corso_attivo || e.id_edizione) === urlEdizioneId);
            if (edFound) {
                const edId = edFound.id_corso_attivo || edFound.id_edizione;
                selectCorso.value = edFound.id_corso;
                populateEdizioniSelect(edFound.id_corso);
                selectEdizione.value = edId;
                if (btnVisualizzaAula) btnVisualizzaAula.disabled = false;
                await loadAulaData(edId);
            }
        }

    } catch (err) {
        console.error("Errore inizializzazione aule:", err);
        showToast("Errore di caricamento dei dati.", true);
    }

    // Popola select corsi
    function populateCorsiSelect() {
        selectCorso.innerHTML = '<option value="">-- Seleziona un Corso --</option>';
        allCorsi.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id_corso;
            opt.textContent = c.Nome;
            selectCorso.appendChild(opt);
        });
    }

    // Popola select edizioni per il corso selezionato
    function populateEdizioniSelect(idCorso) {
        selectEdizione.innerHTML = '';
        if (!idCorso) {
            selectEdizione.innerHTML = '<option value="">-- Prima seleziona un corso --</option>';
            selectEdizione.disabled = true;
            if (btnVisualizzaAula) btnVisualizzaAula.disabled = true;
            return;
        }

        const edizioniCorso = allEdizioni.filter(e => e.id_corso === parseInt(idCorso));
        if (edizioniCorso.length === 0) {
            selectEdizione.innerHTML = '<option value="">-- Nessuna edizione disponibile per questo corso --</option>';
            selectEdizione.disabled = true;
            if (btnVisualizzaAula) btnVisualizzaAula.disabled = true;
            return;
        }

        selectEdizione.disabled = false;
        selectEdizione.innerHTML = '<option value="">-- Seleziona un\'Edizione --</option>';
        edizioniCorso.forEach(e => {
            const opt = document.createElement('option');
            const edId = e.id_corso_attivo || e.id_edizione;
            opt.value = edId;
            const label = e.etichetta || `Edizione #${edId}`;
            const dateRange = (e.data_inizio && e.data_fine) 
                ? ` (${new Date(e.data_inizio).toLocaleDateString('it-IT')} - ${new Date(e.data_fine).toLocaleDateString('it-IT')})`
                : '';
            opt.textContent = `${label}${dateRange}`;
            selectEdizione.appendChild(opt);
        });
    }

    // Change Handler Corso
    selectCorso.addEventListener('change', (e) => {
        const idCorso = e.target.value;
        populateEdizioniSelect(idCorso);
        currentEdizioneId = null;
        if (btnVisualizzaAula) btnVisualizzaAula.disabled = true;
        noSelectionState.style.display = 'block';
        aulaContentLayout.style.display = 'none';
        history.replaceState(null, '', window.location.pathname);
    });

    // Change Handler Edizione
    selectEdizione.addEventListener('change', (e) => {
        const idEdiz = parseInt(e.target.value);
        if (!idEdiz) {
            currentEdizioneId = null;
            if (btnVisualizzaAula) btnVisualizzaAula.disabled = true;
            noSelectionState.style.display = 'block';
            aulaContentLayout.style.display = 'none';
            history.replaceState(null, '', window.location.pathname);
        } else {
            if (btnVisualizzaAula) btnVisualizzaAula.disabled = false;
        }
    });

    // Click Handler Tasto VISUALIZZA
    if (btnVisualizzaAula) {
        btnVisualizzaAula.addEventListener('click', async () => {
            const idEdiz = parseInt(selectEdizione.value);
            if (!idEdiz) return;
            history.replaceState(null, '', `${window.location.pathname}?id=${idEdiz}`);
            await loadAulaData(idEdiz);
        });
    }

    // Carica dati per una specifica Edizione
    async function loadAulaData(idEdizione) {
        currentEdizioneId = idEdizione;
        document.getElementById('aulaEdizioneId').value = idEdizione;
        noSelectionState.style.display = 'none';
        aulaContentLayout.style.display = 'grid';

        listEl.innerHTML = '<div class="text-center py-5 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Caricamento elenco studenti...</div>';

        try {
            const [resEdiz, resStudenti, resAula] = await Promise.all([
                fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}`),
                fetchAutenticata(`${API_URL}/studenti`),
                fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}/aula`)
            ]);

            if (!resEdiz.ok) {
                showToast("Edizione non trovata.", true);
                noSelectionState.style.display = 'block';
                aulaContentLayout.style.display = 'none';
                return;
            }

            const edizData = await resEdiz.json();
            allStudenti = resStudenti.ok ? await resStudenti.json() : [];
            const aulaData = resAula.ok ? await resAula.json() : [];

            // Ordina studenti alfabeticamente per Cognome poi Nome
            allStudenti.sort((a, b) => {
                const compCognome = (a.Cognome || '').localeCompare(b.Cognome || '', 'it', { sensitivity: 'base' });
                if (compCognome !== 0) return compCognome;
                return (a.Nome || '').localeCompare(b.Nome || '', 'it', { sensitivity: 'base' });
            });

            aulaIds = new Set(aulaData.map(s => s.id_utente));

            const corso = allCorsi.find(c => c.id_corso === edizData.id_corso);
            const edizLabel = edizData.etichetta || `Edizione #${idEdizione}`;

            previewEdizioneTitle.textContent = edizLabel;
            previewCorsoNome.textContent = corso ? corso.Nome : 'Corso';
            previewEdizioneBadge.textContent = `ID #${idEdizione}`;
            document.getElementById('headerBreadcrumbCurrent').textContent = `Aula: ${edizLabel}`;

            if (edizData.data_inizio && edizData.data_fine) {
                const dI = new Date(edizData.data_inizio).toLocaleDateString('it-IT');
                const dF = new Date(edizData.data_fine).toLocaleDateString('it-IT');
                previewDatesVal.textContent = `${dI} → ${dF}`;
            } else {
                previewDatesVal.textContent = 'Non specificate';
            }

            renderList(allStudenti);
            updateMetrics();

        } catch (err) {
            console.error("Errore caricamento aula:", err);
            listEl.innerHTML = '<div class="text-danger text-center py-4">Errore durante il recupero dei dati dell\'aula.</div>';
            showToast("Errore durante il recupero dei dati.", true);
        }
    }

    function updateMetrics() {
        const assignedCount = aulaIds.size;
        const totalCount = allStudenti.length;
        const notAssignedCount = totalCount - assignedCount;

        const countBadge = document.getElementById('aulaStudentiCountBadge');
        if (countBadge) {
            countBadge.innerHTML = `<i class="bi bi-person-check-fill me-1"></i> ${assignedCount} Student${assignedCount === 1 ? 'e' : 'i'} Assegnat${assignedCount === 1 ? 'o' : 'i'}`;
        }

        if (previewStudentiAssegnati) previewStudentiAssegnati.textContent = assignedCount;
        if (previewStudentiNonAssegnati) previewStudentiNonAssegnati.textContent = Math.max(0, notAssignedCount);
        if (valTotStudentiSistema) valTotStudentiSistema.textContent = totalCount;

        if (checkAlmenoUnoStudente) {
            if (assignedCount > 0) {
                checkAlmenoUnoStudente.classList.add('done');
                checkAlmenoUnoStudente.querySelector('i').className = 'bi bi-check-circle-fill';
            } else {
                checkAlmenoUnoStudente.classList.remove('done');
                checkAlmenoUnoStudente.querySelector('i').className = 'bi bi-circle';
            }
        }
    }

    function renderList(studenti) {
        if (!studenti.length) {
            listEl.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-person-x fs-2 d-block mb-2"></i>Nessuno studente trovato</div>';
            return;
        }

        listEl.innerHTML = studenti.map(s => {
            const isChecked = aulaIds.has(s.id_utente);
            const initials = `${(s.Cognome || '').charAt(0)}${(s.Nome || '').charAt(0)}`.toUpperCase();
            return `
                <label class="aula-student-row ${isChecked ? 'is-selected' : ''}" for="chkAula_${s.id_utente}">
                    <div class="user-avatar-sm" style="width:34px;height:34px;border-radius:50%;background:#e0e7ff;color:#4338ca;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;flex-shrink:0;">
                        ${initials}
                    </div>
                    <div class="aula-student-info">
                        <span class="aula-student-name">${s.Cognome} ${s.Nome}</span>
                        <span class="aula-student-email">${s.Email || ''}</span>
                    </div>
                    <input class="chk-aula-studente" type="checkbox" id="chkAula_${s.id_utente}" value="${s.id_utente}" ${isChecked ? 'checked' : ''}>
                </label>
            `;
        }).join('');

        listEl.querySelectorAll('.chk-aula-studente').forEach(chk => {
            chk.addEventListener('change', function() {
                const sId = parseInt(this.value);
                const row = this.closest('.aula-student-row');
                if (this.checked) {
                    aulaIds.add(sId);
                    if (row) row.classList.add('is-selected');
                } else {
                    aulaIds.delete(sId);
                    if (row) row.classList.remove('is-selected');
                }
                updateMetrics();
            });
        });
    }

    function filterStudents() {
        const q = (searchInput?.value || '').toLowerCase().trim();
        const filtered = q
            ? allStudenti.filter(s =>
                (s.Cognome && s.Cognome.toLowerCase().includes(q)) ||
                (s.Nome && s.Nome.toLowerCase().includes(q)) ||
                (s.Email && s.Email.toLowerCase().includes(q))
              )
            : allStudenti;
        renderList(filtered);
    }

    if (searchInput) searchInput.addEventListener('input', filterStudents);

    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => {
            allStudenti.forEach(s => aulaIds.add(s.id_utente));
            filterStudents();
            updateMetrics();
        });
    }

    if (btnDeselectAll) {
        btnDeselectAll.addEventListener('click', () => {
            aulaIds.clear();
            filterStudents();
            updateMetrics();
        });
    }

    // Salvataggio Composizione Aula
    if (btnSaveAula) {
        btnSaveAula.addEventListener('click', async () => {
            if (!currentEdizioneId) {
                showToast("Seleziona prima un'edizione validata.", true);
                return;
            }

            const checkedIds = Array.from(aulaIds);

            const btnText = btnSaveAula.querySelector('.btn-nc-text');
            const btnLoading = btnSaveAula.querySelector('.btn-nc-loading');
            btnSaveAula.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'flex';

            try {
                const res = await fetchAutenticata(`${API_URL}/corsi-attivi/${currentEdizioneId}/aula`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studenti_ids: checkedIds })
                });

                if (res.ok) {
                    showToast(`Aula aggiornata con successo (${checkedIds.length} student${checkedIds.length === 1 ? 'e' : 'i'}).`);
                } else {
                    const err = await res.json().catch(() => ({}));
                    showToast(err.detail || "Errore durante il salvataggio dell'aula.", true);
                }
            } catch (err) {
                showToast("Errore di rete durante il salvataggio.", true);
            } finally {
                btnSaveAula.disabled = false;
                if (btnText) btnText.style.display = 'flex';
                if (btnLoading) btnLoading.style.display = 'none';
            }
        });
    }
});

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.backgroundColor = isError ? 'var(--danger)' : 'var(--success)';
    toast.className = 'toast show';
    setTimeout(() => {
        toast.className = toast.className.replace('show', '');
    }, 3000);
}
