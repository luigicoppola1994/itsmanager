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

        const isMasterArchiviato = numEdizioni > 0 && c.edizioni.every(e => e.archiviato || (new Date() > new Date(e.data_fine)));

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
                const oggi = new Date();
                oggi.setHours(0,0,0,0);
                const start = new Date(e.data_inizio);
                start.setHours(0,0,0,0);
                const end = new Date(e.data_fine);
                end.setHours(23,59,59,999);

                // Calcolo etichetta di stato: ARCHIVIATO, IN PREPARAZIONE, IN CORSO
                let badgeStatusHtml = '';
                if (e.archiviato || oggi > end) {
                    badgeStatusHtml = `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-3 py-1 rounded-pill fw-semibold me-2">ARCHIVIATO</span>`;
                } else if (oggi < start) {
                    badgeStatusHtml = `<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-3 py-1 rounded-pill fw-semibold me-2">IN PREPARAZIONE</span>`;
                } else {
                    badgeStatusHtml = `<span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill fw-semibold me-2">IN CORSO</span>`;
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
                        </div>
                        
                        <div class="edition-info-meta">
                            <div><i class="bi bi-calendar-event me-1 text-primary"></i>${dataInizioFmt} ➔ ${dataFineFmt}</div>
                            <div><strong class="text-dark">${e.durata_ore}h</strong> <span class="small">(${e.ore_stage}h stage)</span></div>
                            
                            ${badgeStatusHtml}

                            <div class="d-flex gap-1 ms-1">
                                <button class="btn-action-icon btn-edit-edizione me-1" title="Modifica Edizione"
                                    data-id="${e.id_corso_attivo}"
                                    data-etichetta="${encodeURIComponent(e.etichetta || '')}"
                                    data-inizio="${e.data_inizio || ''}"
                                    data-fine="${e.data_fine || ''}"
                                    data-teoria="${e.ore_teoria_aula || 0}"
                                    data-stage="${e.ore_stage || 0}"
                                    data-assenza="${e.percentuale_ore_assenza || 20}"
                                    data-tolling="${e.tolleranza_ingresso_minuti || 15}"
                                    data-tollusc="${e.tolleranza_uscita_minuti || 15}"
                                    data-idcorso="${e.id_corso}">
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
                    <h2 class="course-card-title d-flex align-items-center gap-2">
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

    // Delegated event listener: gestisce click su pulsanti modifica e elimina corso / edizione
    grid.addEventListener('click', function(e) {
        const editBtn = e.target.closest('.btn-edit-corso');
        const deleteBtn = e.target.closest('.btn-delete-corso');
        const editEdizBtn = e.target.closest('.btn-edit-edizione');

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
        } else if (editEdizBtn) {
            e.stopPropagation();
            window.openEditEdizione(
                editEdizBtn.dataset.id,
                decodeURIComponent(editEdizBtn.dataset.etichetta),
                editEdizBtn.dataset.inizio,
                editEdizBtn.dataset.fine,
                editEdizBtn.dataset.teoria,
                editEdizBtn.dataset.stage,
                editEdizBtn.dataset.assenza,
                editEdizBtn.dataset.tolling,
                editEdizBtn.dataset.tollusc,
                editEdizBtn.dataset.idcorso
            );
        }
    }, false);
}

// Toggle Stato Edizione (Requisito 7)
window.toggleStatoEdizione = async function(idEdizione, isAttivo) {
    try {
        const resGet = await fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}`);
        if (!resGet.ok) throw new Error("Impossibile recuperare i dati dell'edizione");
        const edizData = await resGet.json();

        edizData.archiviato = !isAttivo;

        const resPut = await fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edizData)
        });

        if (resPut.ok) {
            showToast(`Stato corso ${isAttivo ? 'attivato' : 'disattivato (archiviato)'} con successo.`);
            await loadDashboardData();
        } else {
            const err = await resPut.json();
            showToast(err.detail || "Errore aggiornamento stato", true);
            await loadDashboardData();
        }
    } catch (error) {
        console.error("Errore cambio stato:", error);
        showToast("Errore di connessione durante il cambio di stato", true);
        await loadDashboardData();
    }
};

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
// GESTIONE EDIZIONE (Modifica Edizione Corso)
// -----------------------------------------
let currentEditInitialPianoStudioUfIds = new Set();

window.openEditEdizione = function(id, etichetta, dataInizio, dataFine, oreTeoria, oreStage, percAssenza, tollIng, tollUsc, idCorso) {
    document.getElementById('editEdizioneId').value = id;
    document.getElementById('editEdizioneIdCorso').value = idCorso;
    document.getElementById('editEdizioneEtichetta').value = etichetta;
    document.getElementById('editEdizioneDataInizio').value = dataInizio;
    document.getElementById('editEdizioneDataFine').value = dataFine;
    document.getElementById('editEdizioneOreTeoria').value = oreTeoria;
    document.getElementById('editEdizioneOreStage').value = oreStage;
    document.getElementById('editEdizionePercAssenza').value = percAssenza;
    document.getElementById('editEdizioneTollIngresso').value = tollIng;
    document.getElementById('editEdizioneTollUscita').value = tollUsc;

    const t = parseInt(oreTeoria) || 0;
    const s = parseInt(oreStage) || 0;
    document.getElementById('editEdizioneDurataOre').value = t + s;

    openModal('editEdizioneModal');
    loadEditEdizionePianoStudio(id);
};

async function loadEditEdizionePianoStudio(idCorsoAttivo) {
    const container = document.getElementById('editEdizioneUfList');
    if (!container) return;

    container.innerHTML = '<div class="text-muted small py-2"><i class="bi bi-arrow-repeat spin me-2"></i>Caricamento Unità Formative...</div>';
    currentEditInitialPianoStudioUfIds = new Set();

    try {
        const [resUf, resM, resPs] = await Promise.all([
            fetchAutenticata(`${API_URL}/unita_formative`),
            fetchAutenticata(`${API_URL}/moduli`),
            fetchAutenticata(`${API_URL}/corsi-attivi/${idCorsoAttivo}/piano-studio`)
        ]);

        if (resUf.ok && resM.ok && resPs.ok) {
            const allUf = await resUf.json();
            const allM = await resM.json();
            const existingPs = await resPs.json();

            const existingPsMap = {};
            existingPs.forEach(item => {
                existingPsMap[item.id_unita_formativa] = item.ore_dedicate;
                currentEditInitialPianoStudioUfIds.add(item.id_unita_formativa);
            });

            if (!allUf.length) {
                container.innerHTML = '<div class="alert alert-light border small text-muted mb-0">Nessuna Unità Formativa a catalogo.</div>';
                return;
            }

            container.innerHTML = allUf.map(uf => {
                const ufModuli = allM.filter(m => m.id_unita_formativa === uf.id_unita_formativa);
                const modCount = ufModuli.length;
                const isChecked = existingPsMap.hasOwnProperty(uf.id_unita_formativa);
                const oreVal = isChecked ? existingPsMap[uf.id_unita_formativa] : 0;

                return `
                    <div class="card p-2 border uf-item-card" style="background:#ffffff; border-radius:8px;">
                        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div class="form-check mb-0">
                                <input class="form-check-input chk-edit-uf-piano" type="checkbox" value="${uf.id_unita_formativa}" id="chkEditUf_${uf.id_unita_formativa}" data-uf-id="${uf.id_unita_formativa}" ${isChecked ? 'checked' : ''}>
                                <label class="form-check-label fw-bold text-dark small" for="chkEditUf_${uf.id_unita_formativa}">
                                    ${uf.Nome}
                                    <span class="badge bg-light text-secondary border ms-2 font-monospace" style="font-size:0.7rem;">${modCount} modul${modCount === 1 ? 'o' : 'i'}</span>
                                </label>
                            </div>
                            <div class="d-flex align-items-center gap-2" style="max-width: 170px;">
                                <label for="oreEditUf_${uf.id_unita_formativa}" class="small text-muted mb-0 fw-semibold" style="font-size:0.75rem;">Ore:</label>
                                <input type="number" id="oreEditUf_${uf.id_unita_formativa}" class="form-control form-control-sm input-ore-edit-uf py-1" min="0" max="1000" value="${oreVal}" placeholder="Ore" ${isChecked ? '' : 'disabled'}>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.chk-edit-uf-piano').forEach(chk => {
                chk.addEventListener('change', (e) => {
                    const ufId = e.target.dataset.ufId;
                    const oreInput = document.getElementById(`oreEditUf_${ufId}`);
                    if (oreInput) {
                        oreInput.disabled = !e.target.checked;
                    }
                    updateEditEdizioneUfCounter();
                });
            });

            container.querySelectorAll('.input-ore-edit-uf').forEach(input => {
                ['input', 'keyup', 'change'].forEach(evt => {
                    input.addEventListener(evt, updateEditEdizioneUfCounter);
                });
            });

            updateEditEdizioneUfCounter();
        } else {
            container.innerHTML = '<div class="text-danger small py-2">Impossibile caricare le Unità Formative.</div>';
        }
    } catch (e) {
        console.error('Errore caricamento Piano Studio per modale:', e);
        container.innerHTML = '<div class="text-danger small py-2">Errore di connessione.</div>';
    }
}

function updateEditEdizioneUfCounter() {
    const tInput = document.getElementById('editEdizioneOreTeoria');
    const targetOreAula = parseInt(tInput ? tInput.value : 0) || 0;
    let sumAssigned = 0;

    const checkedChks = document.querySelectorAll('.chk-edit-uf-piano:checked');
    checkedChks.forEach(chk => {
        const ufId = chk.dataset.ufId;
        const oreInput = document.getElementById(`oreEditUf_${ufId}`);
        sumAssigned += parseInt(oreInput ? oreInput.value : 0) || 0;
    });

    const restanti = targetOreAula - sumAssigned;

    const valOreAulaTarget = document.getElementById('editEdizioneValOreAulaTarget');
    const valOreUfAssegnate = document.getElementById('editEdizioneValOreUfAssegnate');
    const valOreUfRestanti = document.getElementById('editEdizioneValOreUfRestanti');
    const ufBadgeStatus = document.getElementById('editEdizioneUfBadgeStatus');

    if (valOreAulaTarget) valOreAulaTarget.textContent = `${targetOreAula}h`;
    if (valOreUfAssegnate) valOreUfAssegnate.textContent = `${sumAssigned}h`;
    if (valOreUfRestanti) valOreUfRestanti.textContent = `${restanti}h`;

    if (ufBadgeStatus && valOreUfRestanti) {
        if (targetOreAula === 0 && sumAssigned === 0) {
            ufBadgeStatus.className = 'badge bg-secondary text-white px-3 py-1 rounded-pill font-monospace fw-bold';
            ufBadgeStatus.textContent = 'Inserire ore aula';
            valOreUfRestanti.className = 'fw-bold fs-6 text-muted';
        } else if (restanti > 0) {
            ufBadgeStatus.className = 'badge bg-warning text-dark px-3 py-1 rounded-pill font-monospace fw-bold';
            ufBadgeStatus.textContent = `Mancano ${restanti}h da associare`;
            valOreUfRestanti.className = 'fw-bold fs-6 text-warning';
        } else if (restanti === 0) {
            ufBadgeStatus.className = 'badge bg-success text-white px-3 py-1 rounded-pill font-monospace fw-bold';
            ufBadgeStatus.textContent = `✓ Bilancio Perfetto (0h restanti)`;
            valOreUfRestanti.className = 'fw-bold fs-6 text-success';
        } else {
            const eccedenza = Math.abs(restanti);
            ufBadgeStatus.className = 'badge bg-danger text-white px-3 py-1 rounded-pill font-monospace fw-bold';
            ufBadgeStatus.textContent = `⚠ Eccedenza di ${eccedenza}h`;
            valOreUfRestanti.className = 'fw-bold fs-6 text-danger';
        }
    }

    return { targetOreAula, sumAssigned, restanti };
}

// Event listener per la sottomissione del form di modifica edizione
document.addEventListener('DOMContentLoaded', () => {
    const editEdizForm = document.getElementById('editEdizioneForm');
    if (editEdizForm) {
        const tInput = document.getElementById('editEdizioneOreTeoria');
        const sInput = document.getElementById('editEdizioneOreStage');
        const totInput = document.getElementById('editEdizioneDurataOre');

        const updateModaleTot = () => {
            const t = parseInt(tInput.value) || 0;
            const s = parseInt(sInput.value) || 0;
            totInput.value = t + s;
        };

        if (tInput && sInput) {
            ['input', 'keyup', 'change'].forEach(evt => {
                tInput.addEventListener(evt, () => {
                    updateModaleTot();
                    updateEditEdizioneUfCounter();
                });
                sInput.addEventListener(evt, updateModaleTot);
            });
        }

        editEdizForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const id = document.getElementById('editEdizioneId').value;
            const idCorso = document.getElementById('editEdizioneIdCorso').value;
            const etichetta = document.getElementById('editEdizioneEtichetta').value.trim();
            const dInizio = document.getElementById('editEdizioneDataInizio').value;
            const dFine = document.getElementById('editEdizioneDataFine').value;
            const oreTeoriaVal = parseInt(document.getElementById('editEdizioneOreTeoria').value);
            const oreStageVal = parseInt(document.getElementById('editEdizioneOreStage').value);
            const percAssenzaVal = parseFloat(document.getElementById('editEdizionePercAssenza').value);
            const tollIngVal = parseInt(document.getElementById('editEdizioneTollIngresso').value);
            const tollUscVal = parseInt(document.getElementById('editEdizioneTollUscita').value);

            if (isNaN(oreTeoriaVal) || oreTeoriaVal <= 0) {
                showToast("Le ore in aula sono obbligatorie e devono essere maggiori di 0.", true);
                return;
            }
            if (isNaN(oreStageVal) || oreStageVal < 0) {
                showToast("Le ore di stage sono obbligatorie (inserisci 0 se non previste).", true);
                return;
            }
            if (!dInizio || !dFine || new Date(dInizio) > new Date(dFine)) {
                showToast("Inserisci un intervallo di date valido.", true);
                return;
            }

            // Calcolo bilancio ore UF (non bloccante per il salvataggio)
            const { targetOreAula, sumAssigned, restanti } = updateEditEdizioneUfCounter();

            const payload = {
                id_corso: parseInt(idCorso),
                etichetta: etichetta || null,
                data_inizio: dInizio,
                data_fine: dFine,
                durata_ore: oreTeoriaVal + oreStageVal,
                ore_teoria_aula: oreTeoriaVal,
                ore_stage: oreStageVal,
                percentuale_ore_assenza: percAssenzaVal,
                tolleranza_ingresso_minuti: tollIngVal,
                tolleranza_uscita_minuti: tollUscVal,
                archiviato: false
            };

            const btn = document.getElementById('btnSaveEdizione');
            btn.disabled = true;
            btn.textContent = 'Salvataggio...';

            try {
                const res = await fetchAutenticata(`${API_URL}/corsi-attivi/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    // Sincronizza Piano Studio (Unità Formative) per l'Edizione
                    const currentCheckedUfs = Array.from(document.querySelectorAll('.chk-edit-uf-piano:checked'));
                    const items = currentCheckedUfs.map(chk => {
                        const ufId = parseInt(chk.value);
                        const oreInput = document.getElementById(`oreEditUf_${ufId}`);
                        return {
                            id_unita_formativa: ufId,
                            ore_dedicate: parseInt(oreInput ? oreInput.value : 0) || 0
                        };
                    });

                    const syncRes = await fetchAutenticata(`${API_URL}/corsi-attivi/${id}/piano-studio`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: items })
                    });

                    if (!syncRes.ok) {
                        const errSync = await syncRes.json().catch(() => ({}));
                        showToast(errSync.detail || "Errore durante il salvataggio del piano studio.", true);
                        btn.disabled = false;
                        btn.textContent = 'Salva Modifiche';
                        return;
                    }

                    closeModal('editEdizioneModal');
                    showToast("Edizione aggiornata con successo.");
                    loadDashboardData();
                } else {
                    const err = await res.json();
                    showToast(err.detail || "Errore durante l'aggiornamento dell'edizione.", true);
                }
            } catch (err) {
                showToast("Errore di connessione.", true);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Salva Modifiche';
            }
        });
    }
});

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
