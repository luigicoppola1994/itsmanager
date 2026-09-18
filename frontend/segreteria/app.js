// Inizializzazione Dashboard Segreteria
// Nota: il controllo sessione (token + redirect al login) è già gestito da auth.js
document.addEventListener('DOMContentLoaded', () => {
    // Collega il pulsante di logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Avvia la dashboard dei corsi
    initCorsiDashboard();

    const editCorsoForm = document.getElementById('editCorsoForm');
    if (editCorsoForm) {
        editCorsoForm.addEventListener('submit', handleEditCorsoSubmit);
    }
});

let masterCoursesList = [];

async function initCorsiDashboard() {
    await loadDashboardData();

    // Gestione SearchBar in tempo reale
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = masterCoursesList.filter(c => 
                c.Nome.toLowerCase().includes(query) || 
                (c.Descrizione || "").toLowerCase().includes(query) ||
                c.edizioni.some(e => `edizione ${e.id_corso_attivo}`.includes(query) || e.data_inizio.includes(query))
            );
            renderCorsi(filtered);
        });
    }
}

// Carica Corsi (Catalogo) e Corsi Attivi (Edizioni) dal backend reale
async function loadDashboardData() {
    const grid = document.getElementById('coursesGrid');
    if (grid) grid.innerHTML = '<p class="text-center w-100 mt-5"><span class="spinner-border text-primary" role="status"></span><br>Caricamento corsi in corso...</p>';

    try {
        // Chiamate parallele a Corsi e Corsi Attivi
        const [corsiRes, corsiAttiviRes] = await Promise.all([
            fetchAutenticata(`${API_URL}/corsi`),
            fetchAutenticata(`${API_URL}/corsi-attivi`)
        ]);

        if (corsiRes.ok && corsiAttiviRes.ok) {
            const corsi = await corsiRes.json();
            const corsiAttivi = await corsiAttiviRes.json();

            // Raggruppiamo le edizioni per id_corso
            const edizioniMap = {};
            corsiAttivi.forEach(ca => {
                if (!edizioniMap[ca.id_corso]) {
                    edizioniMap[ca.id_corso] = [];
                }
                edizioniMap[ca.id_corso].push(ca);
            });

            // Costruiamo la lista dei Corsi Master con le proprie edizioni
            masterCoursesList = corsi.map(c => {
                const edizioni = edizioniMap[c.id_corso] || [];
                // Ordiniamo le edizioni per data di inizio decrescente
                edizioni.sort((a, b) => new Date(b.data_inizio) - new Date(a.data_inizio));
                return {
                    ...c,
                    edizioni: edizioni
                };
            });

            renderCorsi(masterCoursesList);
        } else {
            console.error("Errore API", await corsiRes.text(), await corsiAttiviRes.text());
            if (grid) grid.innerHTML = '<p class="text-danger text-center w-100">Errore nel caricamento dei dati dal server.</p>';
        }
    } catch (error) {
        console.error("Errore rete", error);
        if (grid) grid.innerHTML = '<p class="text-danger text-center w-100">Errore di connessione al server.</p>';
    }
}

// Toggle Dropdown sicuro per ciascuna Card del Corso
window.toggleCourseCard = function(id) {
    const card = document.getElementById(`course-card-unit-${id}`);
    if (card) {
        card.classList.toggle('is-open');
    }
};

// Funzione di rendering dei Corsi Master come Card Singole con Dropdown (come da bozza utente)
function renderCorsi(list) {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    if (list.length === 0) {
        grid.innerHTML = `
            <div class="no-results">
                <i class="bi bi-search"></i>
                <h3>Nessun corso trovato</h3>
                <p>Non ci sono corsi a catalogo che corrispondono ai criteri.</p>
            </div>
        `;
        return;
    }

    const itemsHtml = list.map((c, index) => {
        const numEdizioni = c.edizioni.length;
        const isOpenByDefault = index === 0;

        const edizioniRowsHtml = numEdizioni === 0 
            ? `
                <div class="p-3 text-muted border-start border-3 border-primary ms-2 my-2 bg-light rounded-2">
                    <span class="small"><i class="bi bi-info-circle me-1 text-primary"></i>Nessuna edizione trovata per questo corso.</span>
                    <a href="nuovo-corso.html?id_corso=${c.id_corso}" class="ms-3 text-primary fw-bold text-decoration-none small">
                        + Aggiungi Prima Edizione
                    </a>
                </div>
            `
            : c.edizioni.map(e => {
                let badgeClass = "bg-success-subtle text-success border-success-subtle";
                let badgeLabel = "Attiva";

                const oggi = new Date();
                const start = new Date(e.data_inizio);
                const end = new Date(e.data_fine);

                if (e.archiviato) {
                    badgeClass = "bg-secondary-subtle text-secondary border-secondary-subtle";
                    badgeLabel = "Conclusa";
                } else if (oggi < start) {
                    badgeClass = "bg-warning-subtle text-warning border-warning-subtle";
                    badgeLabel = "Pianificata";
                } else if (oggi > end) {
                    badgeClass = "bg-danger-subtle text-danger border-danger-subtle";
                    badgeLabel = "Da Archiviare";
                }

                // Genera etichetta anno tipo "edizione 24/25" o usa quella personalizzata
                const startYear = new Date(e.data_inizio).getFullYear().toString().slice(-2);
                const endYear = new Date(e.data_fine).getFullYear().toString().slice(-2);
                const defaultLabel = `edizione ${startYear}/${endYear}`;
                const edizLabel = e.etichetta ? e.etichetta : defaultLabel;

                const dataInizioFmt = new Date(e.data_inizio).toLocaleDateString('it-IT');
                const dataFineFmt = new Date(e.data_fine).toLocaleDateString('it-IT');

                return `
                    <div class="edition-row" id="edition-row-${e.id_corso_attivo}">
                        <div class="d-flex align-items-center gap-3">
                            <span class="edition-label-title">${edizLabel}</span>
                            <span class="text-muted small fw-semibold">(Edizione #${e.id_corso_attivo})</span>
                        </div>
                        
                        <div class="edition-info-meta">
                            <div><i class="bi bi-calendar-event me-1 text-primary"></i>${dataInizioFmt} ➔ ${dataFineFmt}</div>
                            <div><strong class="text-dark">${e.durata_ore}h</strong> <span class="small">(${e.ore_stage}h stage)</span></div>
                            <span class="badge ${badgeClass} border px-2.5 py-1 rounded-pill fw-semibold">
                                ${badgeLabel}
                            </span>
                            <div class="d-flex gap-1 ms-2">
                                <button class="btn-action-icon" title="Modifica Edizione" onclick="event.stopPropagation(); alert('Modifica edizione ID: ${e.id_corso_attivo}')">
                                    <i class="bi bi-pencil-fill"></i>
                                </button>
                                <button class="btn-action-icon danger" title="Elimina Edizione" onclick="event.stopPropagation(); deleteCorsoAttivo(${e.id_corso_attivo})">
                                    <i class="bi bi-trash3-fill"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        return `
            <!-- Card Singola per ciascun Corso -->
            <div class="course-card-unit ${isOpenByDefault ? 'is-open' : ''}" id="course-card-unit-${c.id_corso}">
                
                <!-- Intestazione Titolo Corso + Riga Sotto + Bottone Nuova Edizione + Chevron 'v' -->
                <div class="course-card-header-line" onclick="toggleCourseCard(${c.id_corso})">
                    <h2 class="course-card-title">
                        ${c.Nome}
                    </h2>
                    <div class="course-card-actions">
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1 fw-bold fs-7 me-2">
                            ${numEdizioni} ${numEdizioni === 1 ? 'Edizione' : 'Edizioni'}
                        </span>
                        <button class="btn-action-icon btn-edit-corso me-1" title="Modifica Corso"
                            data-id="${c.id_corso}"
                            data-nome="${encodeURIComponent(c.Nome)}"
                            data-descrizione="${encodeURIComponent(c.Descrizione || '')}">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn-action-icon danger btn-delete-corso me-2" title="Elimina Corso"
                            data-id="${c.id_corso}">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                        <a href="nuovo-corso.html?id_corso=${c.id_corso}" class="btn btn-outline-primary btn-sm fw-semibold rounded-2 px-3 py-1 me-2" onclick="event.stopPropagation();">
                            + Nuova Edizione
                        </a>
                        <i class="bi bi-chevron-down chevron-icon"></i>
                    </div>
                </div>

                <!-- Contenuto Espandibile (Dropdown) con le Edizioni -->
                <div class="course-dropdown-body">
                    ${c.Descrizione ? `<div class="course-desc-subtitle"><i class="bi bi-info-circle me-1 text-primary"></i>${c.Descrizione}</div>` : ''}
                    <div class="editions-list-rows">
                        ${edizioniRowsHtml}
                    </div>
                </div>

            </div>
        `;
    }).join('');

    grid.innerHTML = `
        <div class="courses-list-container">
            ${itemsHtml}
        </div>
    `;

    // Delegated event listener: gestisce click su pulsanti modifica e elimina corso
    grid.addEventListener('click', function(e) {
        // Trova il pulsante cliccato (o il suo figlio icona)
        const editBtn = e.target.closest('.btn-edit-corso');
        const deleteBtn = e.target.closest('.btn-delete-corso');

        if (editBtn) {
            e.stopPropagation();
            const id = editBtn.dataset.id;
            const nome = decodeURIComponent(editBtn.dataset.nome);
            const descrizione = decodeURIComponent(editBtn.dataset.descrizione);
            window.editCorso(id, nome, descrizione);
        } else if (deleteBtn) {
            e.stopPropagation();
            const id = deleteBtn.dataset.id;
            window.deleteCorso(id);
        }
    }, false); // listener su grid: funziona sempre perché la grid viene ricreata ad ogni render (il vecchio DOM viene rimosso)
}

// Elimina Edizione Corso
window.deleteCorsoAttivo = async function(id) {
    if (confirm(`Sei sicuro di voler eliminare l'edizione #${id}? L'operazione è irreversibile.`)) {
        try {
            const response = await fetchAutenticata(`${API_URL}/corsi-attivi/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showToast("Edizione del corso eliminata con successo.");
                loadDashboardData(); // Ricarica la lista aggiornata
            } else {
                const err = await response.json();
                showToast(err.detail || "Errore durante l'eliminazione", true);
            }
        } catch (e) {
            showToast("Errore di rete durante l'eliminazione", true);
        }
    }
}

// -----------------------------------------
// GESTIONE CORSO (Anagrafica)
// -----------------------------------------

window.editCorso = function(id, nome, descrizione) {
    document.getElementById('editCorsoId').value = id;
    document.getElementById('editCorsoNome').value = nome;
    document.getElementById('editCorsoDescrizione').value = descrizione;
    
    // Pulisce eventuali errori precedenti
    const errEl = document.getElementById('editCorsoError');
    if (errEl) errEl.style.display = 'none';
    
    // Ripristina il pulsante
    const btn = document.getElementById('btnSaveCorso');
    if (btn) { btn.disabled = false; btn.textContent = 'Salva Modifiche'; }
    
    // Apri la modale (Bootstrap o fallback nativo)
    openModal('editCorsoModal');
};

window.deleteCorso = async function(id) {
    if (confirm(`Sei sicuro di voler eliminare il corso? Verrà rimosso dal catalogo.\nNOTA: Se il corso ha edizioni attive non potrà essere eliminato.`)) {
        try {
            const response = await fetchAutenticata(`${API_URL}/corsi/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showToast("Corso eliminato con successo dal catalogo.");
                loadDashboardData();
            } else {
                const err = await response.json();
                showToast(err.detail || "Errore durante l'eliminazione", true);
            }
        } catch (e) {
            showToast("Errore di rete durante l'eliminazione", true);
        }
    }
};

async function handleEditCorsoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editCorsoId').value;
    const nome = document.getElementById('editCorsoNome').value.trim();
    const descrizione = document.getElementById('editCorsoDescrizione').value.trim();
    
    if (!nome) {
        showEditCorsoError('Il nome del corso è obbligatorio.');
        return;
    }
    
    const btn = document.getElementById('btnSaveCorso');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvataggio...';
    
    try {
        const response = await fetchAutenticata(`${API_URL}/corsi/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Nome: nome, Descrizione: descrizione || null })
        });
        
        if (response.ok) {
            // Chiude la modale
            closeModal('editCorsoModal');
            
            showToast('Corso aggiornato con successo.');
            loadDashboardData();
        } else {
            const err = await response.json();
            showEditCorsoError(err.detail || "Errore durante l'aggiornamento del corso.");
        }
    } catch (error) {
        showEditCorsoError('Errore di rete. Controlla la connessione.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salva Modifiche';
    }
}

function showEditCorsoError(msg) {
    let errEl = document.getElementById('editCorsoError');
    if (!errEl) {
        errEl = document.createElement('div');
        errEl.id = 'editCorsoError';
        errEl.className = 'alert alert-danger py-2 mt-2 mb-0';
        document.getElementById('editCorsoForm').querySelector('.modal-body').appendChild(errEl);
    }
    errEl.textContent = msg;
    errEl.style.display = 'block';
}

// Visualizza i toast
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    if (isError) {
        toast.style.backgroundColor = '#dc3545';
    } else {
        toast.style.backgroundColor = 'var(--primary-color)';
    }
    toast.className = 'toast show';
    setTimeout(() => { toast.classList.remove('show'); }, 3500);
}

// -----------------------------------------
// HELPERS MODALI (compatibili con o senza Bootstrap JS)
// -----------------------------------------
function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (typeof bootstrap !== 'undefined') {
        // Bootstrap JS disponibile
        let inst = bootstrap.Modal.getInstance(el);
        if (!inst) inst = new bootstrap.Modal(el);
        inst.show();
    } else {
        // Fallback nativo senza Bootstrap JS
        el.style.cssText = 'display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100%; height:100%; z-index:1055;';
        el.classList.add('show');
        el.removeAttribute('aria-hidden');
        document.body.classList.add('modal-open');
        let backdrop = document.getElementById('modal-backdrop-custom');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'modal-backdrop-custom';
            backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1040;';
            backdrop.onclick = () => closeModal(id);
            document.body.appendChild(backdrop);
        }
        backdrop.style.display = 'block';
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (typeof bootstrap !== 'undefined') {
        const inst = bootstrap.Modal.getInstance(el);
        if (inst) inst.hide();
    } else {
        el.style.display = 'none';
        el.classList.remove('show');
        el.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        const backdrop = document.getElementById('modal-backdrop-custom');
        if (backdrop) backdrop.style.display = 'none';
    }
}
