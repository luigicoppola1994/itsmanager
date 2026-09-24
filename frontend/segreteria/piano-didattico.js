// ============================================================
// piano-didattico.js — Gestione Piano Didattico e Moduli
// ============================================================

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
}

// Carica Unità Formative e Moduli dal backend
async function loadPianoDidatticoData() {
    const container = document.getElementById('pianoDidatticoContainer');
    if (container) {
        container.innerHTML = `
            <div class="text-center w-100 py-5">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <p class="text-muted fw-semibold">Caricamento Piano Didattico in corso...</p>
            </div>`;
    }

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

            renderPianoDidattico(unitaFormativeList);
        } else {
            console.error("Errore recupero piano didattico", await ufRes.text(), await moduliRes.text());
            if (container) container.innerHTML = '<p class="text-danger text-center w-100 py-5">Errore durante il caricamento dei dati dal server.</p>';
        }
    } catch (err) {
        console.error("Errore di rete", err);
        if (container) container.innerHTML = '<p class="text-danger text-center w-100 py-5">Errore di connessione al server.</p>';
    }
}

// Rendering delle Unità Formative e dei Moduli
function renderPianoDidattico(list) {
    const container = document.getElementById('pianoDidatticoContainer');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `
            <div class="no-results text-center py-5 bg-white rounded-3 border">
                <i class="bi bi-book-half display-4 text-muted mb-3 d-block"></i>
                <h4 class="fw-bold text-dark">Nessuna Unità Formativa trovata</h4>
                <p class="text-muted mb-4">Inizia a configurare il piano didattico creando la prima Unità Formativa.</p>
                <a href="nuova-uf.html" class="btn btn-primary fw-bold px-4 py-2">
                    <i class="bi bi-plus-lg me-1"></i> Crea Nuova Unità Formativa
                </a>
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
                    <a href="nuovo-modulo.html?uf_id=${uf.id_unita_formativa}" class="btn btn-sm btn-link text-primary fw-bold text-decoration-none ms-2">
                        + Aggiungi Modulo
                    </a>
                </div>
            `
            : moduli.map(m => `
                <div class="modulo-list-item" id="modulo-item-${m.id_modulo}">
                    <div>
                        <div class="modulo-title-text">
                            <i class="bi bi-file-earmark-code-fill text-primary"></i>
                            <span>${m.Nome}</span>
                            <span class="text-muted small fw-normal ms-2">(ID: #${m.id_modulo})</span>
                        </div>
                        ${m.Descrizione ? `<div class="text-muted small ms-4 mt-1">${m.Descrizione}</div>` : ''}
                    </div>

                    <div class="d-flex align-items-center gap-2">
                        <a href="nuovo-modulo.html?id=${m.id_modulo}" class="btn-action-icon" title="Modifica Modulo">
                            <i class="bi bi-pencil-fill"></i>
                        </a>
                        <button class="btn-action-icon danger" title="Elimina Modulo" onclick="deleteModulo(${m.id_modulo}, '${m.Nome.replace(/'/g, "\\'")}')">
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

                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="uf-tag-pill" style="font-size:0.75rem;">
                            <i class="bi bi-collection-fill" style="margin-right:4px;"></i>${numModuli} ${numModuli === 1 ? 'Modulo' : 'Moduli'}
                        </span>
                        <a href="nuovo-modulo.html?uf_id=${uf.id_unita_formativa}" class="btn-outline-course" style="text-decoration:none;">
                            <i class="bi bi-plus-lg"></i>
                            <span>Aggiungi Modulo</span>
                        </a>
                        <a href="nuova-uf.html?id=${uf.id_unita_formativa}" class="btn-action-icon" title="Modifica Unità Formativa">
                            <i class="bi bi-pencil-fill"></i>
                        </a>
                        <button class="btn-action-icon danger" title="Elimina Unità Formativa" onclick="deleteUf(${uf.id_unita_formativa}, '${uf.Nome.replace(/'/g, "\\'")}')">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>
                </div>

                ${uf.Descrizione ? `<p class="text-muted mb-3 fs-6"><i class="bi bi-info-circle me-1 text-muted"></i>${uf.Descrizione}</p>` : ''}

                <div style="margin-top:16px;">
                    <div style="text-transform:uppercase; font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:8px; letter-spacing:0.06em;">Moduli Didattici</div>
                    ${moduliHtml}
                </div>
            </div>
        `;
    }).join('');
}

// Elimina Unità Formativa
window.deleteUf = async function(id, nome = '') {
    const uf = ufMap[id];
    const numModuli = uf?.moduli?.length || 0;
    
    let msg = `Sei sicuro di voler eliminare l'Unità Formativa "${nome || '#' + id}"?`;
    if (numModuli > 0) {
        msg += `\nAttenzione: sono presenti ${numModuli} moduli collegati.`;
    }

    if (!confirm(msg)) return;

    try {
        const res = await fetchAutenticata(`${API_URL}/unita_formative/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            showToast('Unità Formativa eliminata con successo.');
            await loadPianoDidatticoData();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.detail || 'Impossibile eliminare l\'Unità Formativa.', true);
        }
    } catch (e) {
        console.error(e);
        showToast('Errore di connessione con il server.', true);
    }
};

// Elimina Modulo
window.deleteModulo = async function(id, nome = '') {
    if (!confirm(`Sei sicuro di voler eliminare il Modulo "${nome || '#' + id}"?`)) return;

    try {
        const res = await fetchAutenticata(`${API_URL}/moduli/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            showToast('Modulo eliminato con successo.');
            await loadPianoDidatticoData();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.detail || 'Impossibile eliminare il modulo.', true);
        }
    } catch (e) {
        console.error(e);
        showToast('Errore di connessione con il server.', true);
    }
};

function showToast(msg, isError = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'toast show ' + (isError ? 'error' : 'success');
    setTimeout(() => {
        toast.className = 'toast';
    }, 3500);
}