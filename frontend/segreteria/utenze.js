// ============================================================
// utenze.js — Gestione Utenze (CRUD completo)
// ============================================================

let allUtenti   = [];   // cache completa
let ruoliMap    = {};   // id_ruolo → { Nome, ... }
let activeFilter = 'all';
let editingId    = null; // null = creazione, number = modifica

// ── Mapping nome ruolo → chiave CSS e label leggibile ──
const RUOLO_STYLE = {
    'segreteria':  { cls: 'segreteria', icon: 'bi-shield-lock',    label: 'Segreteria' },
    'docente':     { cls: 'docente',    icon: 'bi-person-video3',  label: 'Docente'    },
    'professore':  { cls: 'docente',    icon: 'bi-person-video3',  label: 'Docente'    },
    'studente':    { cls: 'studente',   icon: 'bi-mortarboard',    label: 'Studente'   },
};

function getRuoloStyle(nomeRuolo) {
    const key = (nomeRuolo || '').toLowerCase().trim();
    return RUOLO_STYLE[key] || { cls: 'default', icon: 'bi-person', label: nomeRuolo || 'N/D' };
}

// ── Inizializzazione ──
document.addEventListener('DOMContentLoaded', async () => {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Ricerca live
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', () => renderGrid());

    // Submit form modal
    document.getElementById('utenteForm').addEventListener('submit', handleFormSubmit);

    // Carica ruoli e utenti
    await loadRuoli();
    await loadUtenti();
});

// ── Carica ruoli dal backend e popola la select ──
async function loadRuoli() {
    try {
        const res = await fetchAutenticata(`${API_URL}/ruoli`);
        if (!res.ok) return;
        const ruoli = await res.json();

        ruoliMap = {};
        const select = document.getElementById('editRuolo');
        select.innerHTML = '<option value="">— Seleziona ruolo —</option>';

        ruoli.forEach(r => {
            ruoliMap[r.id_ruolo] = r;
            const opt = document.createElement('option');
            opt.value = r.id_ruolo;
            opt.textContent = getRuoloStyle(r.Nome).label;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Errore caricamento ruoli:', e);
    }
}

// ── Carica tutti gli utenti ──
async function loadUtenti() {
    try {
        const res = await fetchAutenticata(`${API_URL}/users`);
        if (!res.ok) throw new Error('Errore caricamento utenti');
        allUtenti = await res.json();
        updateStats();
        renderGrid();
    } catch (e) {
        console.error(e);
        showToast('Errore nel caricamento degli utenti', true);
    }
}

// ── Aggiorna i contatori delle chip ──
function updateStats() {
    const counts = { segreteria: 0, docente: 0, studente: 0 };
    allUtenti.forEach(u => {
        const nome = getRuoloNome(u).toLowerCase();
        if (nome.includes('segreteria')) counts.segreteria++;
        else if (nome.includes('doc') || nome.includes('prof')) counts.docente++;
        else if (nome.includes('stud')) counts.studente++;
    });
    document.getElementById('cntAll').textContent = allUtenti.length;
    document.getElementById('cntSeg').textContent = counts.segreteria;
    document.getElementById('cntDoc').textContent = counts.docente;
    document.getElementById('cntStu').textContent = counts.studente;
}

function getRuoloNome(u) {
    if (u.ruolo && u.ruolo.Nome) return u.ruolo.Nome;
    if (ruoliMap[u.id_ruolo]) return ruoliMap[u.id_ruolo].Nome;
    return '';
}

// ── Filtra e render ──
function setFilter(el) {
    document.querySelectorAll('.stat-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    activeFilter = el.dataset.filter;
    renderGrid();
}

function renderGrid() {
    const search  = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const tbody   = document.getElementById('utenzeBody');
    const table   = document.getElementById('utenzeTable');
    const empty   = document.getElementById('emptyState');
    const count   = document.getElementById('tableCount');

    let filtered = allUtenti.filter(u => {
        const fullName = `${u.Nome} ${u.Cognome}`.toLowerCase();
        const email    = (u.Email || '').toLowerCase();
        const matchSearch = !search || fullName.includes(search) || email.includes(search);

        let matchFilter = true;
        if (activeFilter !== 'all') {
            const ruoloNome = getRuoloNome(u).toLowerCase();
            if (activeFilter === 'segreteria') matchFilter = ruoloNome.includes('segreteria');
            else if (activeFilter === 'docente') matchFilter = ruoloNome.includes('doc') || ruoloNome.includes('prof');
            else if (activeFilter === 'studente') matchFilter = ruoloNome.includes('stud');
        }

        return matchSearch && matchFilter;
    });
    
    if (count) count.textContent = `${filtered.length} utent${filtered.length === 1 ? 'e' : 'i'} trovat${filtered.length === 1 ? 'o' : 'i'}`;

    if (filtered.length === 0) {
        if (table) table.style.display = 'none';
        if (empty) empty.style.display = 'block';
        if (tbody) tbody.innerHTML = '';
        return;
    }

    if (table) table.style.display = 'table';
    if (empty) empty.style.display = 'none';
    if (tbody) tbody.innerHTML = filtered.map((u, index) => renderUserRow(u, index)).join('');
}

function getInitials(nome, cognome) {
    return `${(nome||'').charAt(0)}${(cognome||'').charAt(0)}`.toUpperCase();
}

function renderUserRow(u, index) {
    const ruoloNome  = getRuoloNome(u);
    const style      = getRuoloStyle(ruoloNome);
    const initials   = getInitials(u.Nome, u.Cognome);
    
    let dataNascitaFormatted = '—';
    if (u.Data_Nascita) {
        const d = new Date(u.Data_Nascita);
        dataNascitaFormatted = isNaN(d) ? u.Data_Nascita : d.toLocaleDateString('it-IT');
    }
    
    const safeName = u.Nome.replace(/'/g, "\\'");
    const safeSurname = u.Cognome.replace(/'/g, "\\'");

    return `
        <tr>
            <td>
                <span class="edition-id-pill">${index + 1}</span>
            </td>
            <td>
                <div class="user-name-cell">
                    <div class="user-avatar-inline">${initials}</div>
                    <div>
                        <div class="name">${u.Nome} ${u.Cognome}</div>
                        <div class="email">${u.Email || '—'}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="user-role-tag ${style.cls}">
                    <i class="bi ${style.icon}"></i> ${style.label}
                </span>
            </td>
            <td>
                <span class="fw-semibold text-secondary" style="font-size: 0.85rem; letter-spacing: 0.5px;">
                    ${u.Codice_Fiscale || '—'}
                </span>
            </td>
            <td>
                ${dataNascitaFormatted}
            </td>
            <td>
                <div class="d-flex gap-2 justify-content-center">
                    <button class="btn-action-icon" onclick="openEditModal(${u.id_utente})" title="Modifica Utente">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="btn-action-icon danger" onclick="deleteUtente(${u.id_utente}, '${safeName} ${safeSurname}')" title="Elimina Utente">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>
            </td>
        </tr>`;
}

// ── Apri modal CREA ──
function openCreateModal() {
    editingId = null;
    document.getElementById('modalTitleText').textContent = 'Aggiungi Utente';
    document.getElementById('utenteForm').reset();
    document.getElementById('editUtenteId').value = '';
    document.getElementById('pwdRequired').style.display = '';
    document.getElementById('pwdHint').style.display = 'none';
    document.getElementById('editPassword').required = true;

    const modal = new bootstrap.Modal(document.getElementById('utenteModal'));
    modal.show();
}

// ── Apri modal MODIFICA ──
function openEditModal(id) {
    const u = allUtenti.find(x => x.id_utente === id);
    if (!u) return;

    editingId = id;
    document.getElementById('modalTitleText').textContent = 'Modifica Utente';
    document.getElementById('editUtenteId').value = id;
    document.getElementById('editNome').value      = u.Nome   || '';
    document.getElementById('editCognome').value   = u.Cognome || '';
    document.getElementById('editEmail').value     = u.Email  || '';
    document.getElementById('editRuolo').value     = u.id_ruolo || '';
    document.getElementById('editPassword').value  = '';
    document.getElementById('editCF').value        = u.Codice_Fiscale || '';
    document.getElementById('editDataNascita').value = u.Data_Nascita || '';

    document.getElementById('pwdRequired').style.display = 'none';
    document.getElementById('pwdHint').style.display = '';
    document.getElementById('editPassword').required = false;

    const modal = new bootstrap.Modal(document.getElementById('utenteModal'));
    modal.show();
}

// ── Submit form (CREATE o UPDATE) ──
async function handleFormSubmit(e) {
    e.preventDefault();

    const nome     = document.getElementById('editNome').value.trim();
    const cognome  = document.getElementById('editCognome').value.trim();
    const email    = document.getElementById('editEmail').value.trim();
    const ruolo    = parseInt(document.getElementById('editRuolo').value);
    const password = document.getElementById('editPassword').value;
    const cf       = document.getElementById('editCF').value.trim() || null;
    const dataN    = document.getElementById('editDataNascita').value || null;

    if (!nome || !cognome || !email || !ruolo) {
        showToast('Compila tutti i campi obbligatori.', true);
        return;
    }

    const isCreating = !editingId;

    if (isCreating && !password) {
        showToast('La password è obbligatoria per il nuovo utente.', true);
        return;
    }

    // Recupera il ruolo corrente dell'utente per update (serve per schema UtenteCreate)
    const uCorrente = editingId ? allUtenti.find(x => x.id_utente === editingId) : null;

    const payload = {
        Nome: nome,
        Cognome: cognome,
        Email: email,
        Password: password || (uCorrente?.Password ?? ''),
        id_ruolo: ruolo,
        Codice_Fiscale: cf,
        Data_Nascita: dataN,
        Genere: uCorrente?.Genere ?? null,
        Citta_Nascita: uCorrente?.Citta_Nascita ?? null,
        Indirizzo_Residenza: uCorrente?.Indirizzo_Residenza ?? null,
        Citta_Residenza: uCorrente?.Citta_Residenza ?? null,
        Cap_Residenza: uCorrente?.Cap_Residenza ?? null,
        Provincia_Residenza: uCorrente?.Provincia_Residenza ?? null,
        Telefono: uCorrente?.Telefono ?? null,
        Primo_Accesso: uCorrente?.Primo_Accesso ?? true
    };

    try {
        const url    = isCreating ? `${API_URL}/users` : `${API_URL}/users/${editingId}`;
        const method = isCreating ? 'POST' : 'PUT';

        const res = await fetchAutenticata(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || data.error || 'Errore durante il salvataggio.');
        }

        // Chiudi modal
        bootstrap.Modal.getInstance(document.getElementById('utenteModal'))?.hide();

        showToast(isCreating ? 'Utente creato con successo!' : 'Utente aggiornato con successo!');
        await loadUtenti();

    } catch (err) {
        showToast(err.message || 'Errore di connessione al server.', true);
    }
}

// ── DELETE ──
async function deleteUtente(id, nomeCompleto) {
    if (!confirm(`Eliminare l'utente "${nomeCompleto}"? L'operazione è irreversibile.`)) return;

    try {
        const res = await fetchAutenticata(`${API_URL}/users/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || 'Errore durante l\'eliminazione.');
        }
        showToast('Utente eliminato con successo.');
        await loadUtenti();
    } catch (err) {
        showToast(err.message || 'Errore di connessione al server.', true);
    }
}

// ── Toast helper ──
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast show${isError ? ' error' : ''}`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}
