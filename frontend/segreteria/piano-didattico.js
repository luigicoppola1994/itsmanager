document.addEventListener('DOMContentLoaded', () => {
    // Collega logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Inizializza la dashboard del piano didattico
    initPianoDidattico();
});

let unitaFormativeList = [];
let moduliList = [];
let ufMap = {};

async function initPianoDidattico() {
    await loadPianoDidatticoData();

    // Search bar
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filteredUf = unitaFormativeList.filter(uf => {
                const matchUf = uf.Nome.toLowerCase().includes(query) || (uf.Descrizione || "").toLowerCase().includes(query);
                const matchModuli = (uf.moduli || []).some(m => m.Nome.toLowerCase().includes(query) || (m.Descrizione || "").toLowerCase().includes(query));
                return matchUf || matchModuli;
            });
            renderPianoDidattico(filteredUf);
        });
    }

    // Attach form listeners
    document.getElementById('ufForm').addEventListener('submit', handleUfSubmit);
    document.getElementById('moduloForm').addEventListener('submit', handleModuloSubmit);
}

// Carica Unità Formative e Moduli dal backend
async function loadPianoDidatticoData() {
    const container = document.getElementById('pianoDidatticoContainer');
    if (container) container.innerHTML = '<p class="text-center w-100 mt-5"><span class="spinner-border text-primary" role="status"></span><br>Caricamento Piano Didattico in corso...</p>';

    try {
        const [ufRes, moduliRes] = await Promise.all([
            fetchAutenticata(`${API_URL}/unita_formative`),
            fetchAutenticata(`${API_URL}/moduli`)
        ]);

        if (ufRes.ok && moduliRes.ok) {
            unitaFormativeList = await ufRes.json();
            moduliList = await moduliRes.json();

            // Mappa UF per ID
            ufMap = {};
            unitaFormativeList.forEach(uf => {
                ufMap[uf.id_unita_formativa] = uf;
                uf.moduli = [];
            });

            // Raggruppa i moduli per UF
            moduliList.forEach(m => {
                if (ufMap[m.id_unita_formativa]) {
                    ufMap[m.id_unita_formativa].moduli.push(m);
                }
            });

            populateUfSelect();
            renderPianoDidattico(unitaFormativeList);
        } else {
            console.error("Errore recupero piano didattico", await ufRes.text(), await moduliRes.text());
            if (container) container.innerHTML = '<p class="text-danger text-center w-100">Errore durante il caricamento dei dati dal server.</p>';
        }
    } catch (err) {
        console.error("Errore di rete", err);
        if (container) container.innerHTML = '<p class="text-danger text-center w-100">Errore di connessione al server.</p>';
    }
}

// Popola il menu a tendina delle UF nei Modali
function populateUfSelect() {
    const select = document.getElementById('moduloUfSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Seleziona Unità Formativa --</option>';
    unitaFormativeList.forEach(uf => {
        const opt = document.createElement('option');
        opt.value = uf.id_unita_formativa;
        opt.textContent = uf.Nome;
        select.appendChild(opt);
    });
}

// Rendering delle Unità Formative e dei Moduli
function renderPianoDidattico(list) {
    const container = document.getElementById('pianoDidatticoContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <i class="bi bi-book-half"></i>
                <h3>Nessuna Unità Formativa trovata</h3>
                <p>Crea la tua prima Unità Formativa cliccando su "+ Nuova Unità Formativa".</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(uf => {
        const moduli = uf.moduli || [];
        const numModuli = moduli.length;

        const moduliHtml = numModuli === 0
            ? `
                <div class="p-3 text-center bg-light border rounded-3 text-muted">
                    <span class="small"><i class="bi bi-info-circle me-1 text-primary"></i>Nessun modulo didattico associato a questa Unità Formativa.</span>
                    <button class="btn btn-sm btn-link text-primary fw-bold text-decoration-none p-0 ms-2" onclick="openModuloModal(null, ${uf.id_unita_formativa})">
                        + Aggiungi Modulo
                    </button>
                </div>
            `
            : moduli.map(m => `
                <div class="modulo-list-item" id="modulo-item-${m.id_modulo}">
                    <div>
                        <div class="modulo-title-text">
                            <i class="bi bi-file-earmark-code-fill text-primary"></i>
                            <span>${m.Nome}</span>
                            <span class="text-muted small fw-normal ms-2">(ID Modulo: #${m.id_modulo})</span>
                        </div>
                        ${m.Descrizione ? `<div class="text-muted small ms-4 mt-1">${m.Descrizione}</div>` : ''}
                    </div>

                    <div class="d-flex align-items-center gap-2">
                        <button class="btn-action-icon" title="Modifica Modulo" onclick="openModuloModal(${m.id_modulo})">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn-action-icon danger" title="Elimina Modulo" onclick="deleteModulo(${m.id_modulo})">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>
                </div>
            `).join('');

        return `
            <div class="uf-card-unit" id="uf-card-${uf.id_unita_formativa}">
                <div class="uf-card-header">
                    <div class="uf-badge-title">
                        <span class="uf-tag-pill">UF #${uf.id_unita_formativa}</span>
                        <span>${uf.Nome}</span>
                    </div>

                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1.5 fw-bold me-2">
                            <i class="bi bi-collection-fill me-1"></i>${numModuli} ${numModuli === 1 ? 'Modulo' : 'Moduli'}
                        </span>
                        <button class="btn btn-sm btn-outline-primary fw-semibold rounded-2" onclick="openModuloModal(null, ${uf.id_unita_formativa})">
                            <i class="bi bi-plus-lg me-1"></i>Aggiungi Modulo
                        </button>
                        <button class="btn-action-icon" title="Modifica UF" onclick="openUfModal(${uf.id_unita_formativa})">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn-action-icon danger" title="Elimina UF" onclick="deleteUf(${uf.id_unita_formativa})">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>
                </div>

                ${uf.Descrizione ? `<p class="text-muted mb-3 fs-6"><i class="bi bi-info-circle me-1 text-muted"></i>${uf.Descrizione}</p>` : ''}

                <div class="mt-3">
                    <div class="text-uppercase small fw-bold text-muted mb-2 tracking-wider">Moduli Didattici</div>
                    ${moduliHtml}
                </div>
            </div>
        `;
    }).join('');
}

// Open UF Modal (Nuova o Modifica)
window.openUfModal = function(id = null) {
    const title = document.getElementById('ufModalLabel');
    const idInput = document.getElementById('ufId');
    const nomeInput = document.getElementById('ufNome');
    const descInput = document.getElementById('ufDescrizione');

    if (id && ufMap[id]) {
        title.innerHTML = `<i class="bi bi-pencil-square text-primary me-2"></i>Modifica Unità Formativa`;
        idInput.value = id;
        nomeInput.value = ufMap[id].Nome;
        descInput.value = ufMap[id].Descrizione || '';
    } else {
        title.innerHTML = `<i class="bi bi-journal-plus text-primary me-2"></i>Nuova Unità Formativa`;
        idInput.value = '';
        nomeInput.value = '';
        descInput.value = '';
    }
};

// Open Modulo Modal (Nuovo o Modifica)
window.openModuloModal = function(id = null, ufId = null) {
    const title = document.getElementById('moduloModalLabel');
    const idInput = document.getElementById('moduloId');
    const ufSelect = document.getElementById('moduloUfSelect');
    const nomeInput = document.getElementById('moduloNome');
    const descInput = document.getElementById('moduloDescrizione');

    const modalEl = document.getElementById('moduloModal');
    const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

    if (id) {
        const modulo = moduliList.find(m => m.id_modulo === id);
        if (modulo) {
            title.innerHTML = `<i class="bi bi-pencil-square text-primary me-2"></i>Modifica Modulo Didattico`;
            idInput.value = id;
            ufSelect.value = modulo.id_unita_formativa;
            nomeInput.value = modulo.Nome;
            descInput.value = modulo.Descrizione || '';
        }
    } else {
        title.innerHTML = `<i class="bi bi-file-earmark-plus text-primary me-2"></i>Nuovo Modulo Didattico`;
        idInput.value = '';
        ufSelect.value = ufId ? ufId : '';
        nomeInput.value = '';
        descInput.value = '';
    }

    bsModal.show();
};

// Salvataggio Unità Formativa (POST o PUT)
async function handleUfSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('ufId').value;
    const nome = document.getElementById('ufNome').value.trim();
    const descrizione = document.getElementById('ufDescrizione').value.trim();

    if (!nome) return;

    const payload = { Nome: nome, Descrizione: descrizione ? descrizione : null };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/unita_formative/${id}` : `${API_URL}/unita_formative`;

    try {
        const response = await fetchAutenticata(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const modalEl = document.getElementById('ufModal');
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();

            showToast(id ? "Unità Formativa aggiornata con successo." : "Nuova Unità Formativa creata con successo.");
            await loadPianoDidatticoData();
        } else {
            const err = await response.json();
            showToast(err.detail || "Errore durante il salvataggio", true);
        }
    } catch (err) {
        showToast("Errore di rete durante il salvataggio", true);
    }
}

// Salvataggio Modulo (POST o PUT)
async function handleModuloSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('moduloId').value;
    const idUf = document.getElementById('moduloUfSelect').value;
    const nome = document.getElementById('moduloNome').value.trim();
    const descrizione = document.getElementById('moduloDescrizione').value.trim();

    if (!nome || !idUf) return;

    const payload = {
        Nome: nome,
        Descrizione: descrizione ? descrizione : null,
        id_unita_formativa: parseInt(idUf)
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/moduli/${id}` : `${API_URL}/moduli`;

    try {
        const response = await fetchAutenticata(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const modalEl = document.getElementById('moduloModal');
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();

            showToast(id ? "Modulo aggiornato con successo." : "Nuovo Modulo creato con successo.");
            await loadPianoDidatticoData();
        } else {
            const err = await response.json();
            showToast(err.detail || "Errore durante il salvataggio", true);
        }
    } catch (err) {
        showToast("Errore di rete durante il salvataggio", true);
    }
}

// Elimina Unità Formativa
window.deleteUf = async function(id) {
    if (confirm(`Sei sicuro di voler eliminare l'Unità Formativa #${id}? I moduli associati potrebbero essere influenzati.`)) {
        try {
            const response = await fetchAutenticata(`${API_URL}/unita_formative/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast("Unità Formativa eliminata con successo.");
                await loadPianoDidatticoData();
            } else {
                const err = await response.json();
                showToast(err.detail || "Errore durante l'eliminazione dell'UF", true);
            }
        } catch (err) {
            showToast("Errore di rete durante l'eliminazione", true);
        }
    }
};

// Elimina Modulo
window.deleteModulo = async function(id) {
    if (confirm(`Sei sicuro di voler eliminare il Modulo #${id}?`)) {
        try {
            const response = await fetchAutenticata(`${API_URL}/moduli/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast("Modulo eliminato con successo.");
                await loadPianoDidatticoData();
            } else {
                const err = await response.json();
                showToast(err.detail || "Errore durante l'eliminazione del Modulo", true);
            }
        } catch (err) {
            showToast("Errore di rete durante l'eliminazione", true);
        }
    }
};
