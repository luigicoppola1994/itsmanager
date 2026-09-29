// ============================================================
// utenze.js - Gestione Utenze (CRUD completo)
// ============================================================

let allUtenti   = [];
let ruoliMap    = {};
let activeFilter = 'all';
let editingId    = null;

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

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', () => renderGrid());

    document.getElementById('utenteForm')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('userInfoForm')?.addEventListener('submit', handleUserInfoSubmit);

    await loadRuoli();
    await loadUtenti();
    
    // Setup autocomplete per provincia e comuni
    setupAutocomplete();
});

// Carica ruoli dal backend e popola la select
async function loadRuoli() {
    try {
        const res = await fetchAutenticata(`${API_URL}/ruoli`);
        if (!res.ok) return;
        const ruoli = await res.json();

        ruoliMap = {};
        const select = document.getElementById('editRuolo');
        if (select) select.innerHTML = '<option value="">-- Seleziona ruolo --</option>';

        const infoSelect = document.getElementById('infoRuolo');
        if (infoSelect) infoSelect.innerHTML = '<option value="">-- Seleziona ruolo --</option>';

        ruoli.forEach(r => {
            ruoliMap[r.id_ruolo] = r;
            // Escludi super_admin dalla selezione
            if ((r.Nome || '').toLowerCase() === 'super_admin') return;

            const opt = document.createElement('option');
            opt.value = r.id_ruolo;
            opt.textContent = getRuoloStyle(r.Nome).label;
            if (select) select.appendChild(opt);

            if (infoSelect) {
                const optInfo = document.createElement('option');
                optInfo.value = r.id_ruolo;
                optInfo.textContent = getRuoloStyle(r.Nome).label;
                infoSelect.appendChild(optInfo);
            }
        });
    } catch (e) {
        console.error('Errore caricamento ruoli:', e);
    }
}

// Carica tutti gli utenti
async function loadUtenti() {
    try {
        const res = await fetchAutenticata(`${API_URL}/users`);
        if (!res.ok) throw new Error('Errore caricamento utenti');
        allUtenti = await res.json();
        // Ordina utenti per cognome e poi nome in ordine alfabetico
        allUtenti.sort((a, b) => {
            const compCognome = (a.Cognome || '').localeCompare(b.Cognome || '', 'it', { sensitivity: 'base' });
            if (compCognome !== 0) return compCognome;
            return (a.Nome || '').localeCompare(b.Nome || '', 'it', { sensitivity: 'base' });
        });
        updateStats();
        renderGrid();
    } catch (e) {
        console.error(e);
        showToast('Errore nel caricamento degli utenti', true);
    }
}

// Aggiorna i contatori delle chip
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

// Filtra e render
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
        const fullNameCN = `${u.Cognome} ${u.Nome}`.toLowerCase();
        const fullNameNC = `${u.Nome} ${u.Cognome}`.toLowerCase();
        const email    = (u.Email || '').toLowerCase();
        const matchSearch = !search || fullNameCN.includes(search) || fullNameNC.includes(search) || email.includes(search);

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

function getInitials(cognome, nome) {
    return `${(cognome||'').charAt(0)}${(nome||'').charAt(0)}`.toUpperCase();
}

function renderUserRow(u, index) {
    const ruoloNome  = getRuoloNome(u);
    const style      = getRuoloStyle(ruoloNome);
    const initials   = getInitials(u.Cognome, u.Nome);

    let dataNascitaFormatted = '\u2014';
    if (u.Data_Nascita) {
        const d = new Date(u.Data_Nascita);
        dataNascitaFormatted = isNaN(d) ? u.Data_Nascita : d.toLocaleDateString('it-IT');
    }

    const safeName = (u.Nome || '').replace(/'/g, "\\'");
    const safeSurname = (u.Cognome || '').replace(/'/g, "\\'");

    return `
        <tr style="cursor: pointer;" onclick="if (!event.target.closest('button, a')) window.location.href='nuovo-utente.html?id=${u.id_utente}'">
            <td>
                <span class="edition-id-pill">${index + 1}</span>
            </td>
            <td>
                <div class="user-name-cell">
                    <div class="user-avatar-inline">${initials}</div>
                    <div>
                        <div class="name"><a href="nuovo-utente.html?id=${u.id_utente}" class="text-decoration-none text-dark fw-bold">${u.Cognome} ${u.Nome}</a></div>
                        <div class="email">${u.Email || '\u2014'}</div>
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
                    ${u.Codice_Fiscale || '\u2014'}
                </span>
            </td>
            <td>
                ${dataNascitaFormatted}
            </td>
            <td>
                <div class="d-flex gap-2 justify-content-center">
                    <a href="nuovo-utente.html?id=${u.id_utente}" class="btn-action-icon info" title="Scheda Completa Utente">
                        <i class="bi bi-info-circle-fill"></i>
                    </a>
                    <a href="nuovo-utente.html?id=${u.id_utente}" class="btn-action-icon" title="Modifica Utente"><i class="bi bi-pencil-fill"></i></a>
                    <button class="btn-action-icon danger" onclick="deleteUtente(${u.id_utente}, '${safeSurname} ${safeName}')" title="Elimina Utente">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>
            </td>
        </tr>`;
}

// Apri pagina CREA
function openCreateModal() {
    window.location.href = 'nuovo-utente.html';
}

// Apri pagina MODIFICA
function openEditModal(id) {
    window.location.href = `nuovo-utente.html?id=${id}`;
}

// Submit form (CREATE o UPDATE)
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
        showToast('La password \u00e8 obbligatoria per il nuovo utente.', true);
        return;
    }

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
        Nazionalita: uCorrente?.Nazionalita ?? "Italiana",
        Provincia_Nascita: uCorrente?.Provincia_Nascita ?? null,
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

        bootstrap.Modal.getInstance(document.getElementById('utenteModal'))?.hide();
        showToast(isCreating ? 'Utente creato con successo!' : 'Utente aggiornato con successo!');
        await loadUtenti();

    } catch (err) {
        showToast(err.message || 'Errore di connessione al server.', true);
    }
}

// DELETE
async function deleteUtente(id, nomeCompleto) {
    if (!confirm(`Eliminare l'utente "${nomeCompleto}"? L'operazione \u00e8 irreversibile.`)) return;

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

// Toast helper
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast show${isError ? ' error' : ''}`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// Toggle visualizzazione password
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = btn.querySelector('i');
    if (icon) {
        icon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
    }
}

// Apri scheda utente in-page (non popup modal)
function openUserInfoModal(id) {
    window.location.href = `nuovo-utente.html?id=${id}`;
}

// Popola il modal Scheda Completa Utente con i dati di un utente specifico
function populateUserInfoModal(u) {
    if (!u) return;

    document.getElementById('infoUtenteId').value       = u.id_utente;
    document.getElementById('infoNome').value           = u.Nome || '';
    document.getElementById('infoCognome').value        = u.Cognome || '';
    document.getElementById('infoEmail').value          = u.Email || '';
    document.getElementById('infoRuolo').value          = u.id_ruolo || '';
    document.getElementById('infoGenere').value         = u.Genere || '';
    document.getElementById('infoCF').value             = u.Codice_Fiscale || '';
    document.getElementById('infoDataNascita').value    = u.Data_Nascita || '';
    document.getElementById('infoNazionalita').value = u.Nazionalita || 'Italiana';
    document.getElementById('infoCittaNascita').value   = u.Citta_Nascita || '';
    document.getElementById('infoProvinciaNascita').value = u.Provincia_Nascita || '';
    document.getElementById('infoIndirizzo').value      = u.Indirizzo_Residenza || '';
    document.getElementById('infoCittaResidenza').value = u.Citta_Residenza || '';
    document.getElementById('infoCap').value            = u.Cap_Residenza || '';
    document.getElementById('infoProvincia').value      = u.Provincia_Residenza || '';
    document.getElementById('infoTelefono').value       = u.Telefono || '';
    document.getElementById('infoPrimoAccesso').checked = !!u.Primo_Accesso;
    document.getElementById('infoPassword').value       = '';

    // Avatar e nome nella testata modale
    const initials = `${(u.Nome||'').charAt(0)}${(u.Cognome||'').charAt(0)}`.toUpperCase();
    const avatarEl = document.getElementById('infoUserAvatar');
    const fullNameEl = document.getElementById('infoUserFullname');
    const emailEl = document.getElementById('infoUserEmailText');
    const idEl = document.getElementById('infoUserIdText');
    const roleEl = document.getElementById('infoUserRoleBadge');
    const primoEl = document.getElementById('infoUserPrimoAccessoBadge');

    if (avatarEl) avatarEl.textContent = initials;
    if (fullNameEl) fullNameEl.textContent = `${u.Nome} ${u.Cognome}`;
    if (emailEl) emailEl.textContent = u.Email || '—';
    if (idEl) idEl.textContent = u.id_utente;

    if (roleEl) {
        const ruoloNome = getRuoloNome(u);
        const style = getRuoloStyle(ruoloNome);
        roleEl.className = `user-role-tag ${style.cls}`;
        roleEl.innerHTML = `<i class="bi ${style.icon}"></i> ${style.label}`;
    }

    if (primoEl) {
        primoEl.innerHTML = u.Primo_Accesso
            ? `<i class="bi bi-shield-exclamation me-1 text-warning"></i>Cambio password richiesto`
            : `<i class="bi bi-shield-check me-1 text-success"></i>Accesso Normale`;
    }
}

// Submit della Scheda Completa Utente
async function handleUserInfoSubmit(e) {
    e.preventDefault();

    const id = parseInt(document.getElementById('infoUtenteId').value);
    const uCorrente = allUtenti.find(x => x.id_utente === id);
    if (!id || !uCorrente) {
        showToast('Utente non trovato.', true);
        return;
    }

    const nome = document.getElementById('infoNome').value.trim();
    const cognome = document.getElementById('infoCognome').value.trim();
    const email = document.getElementById('infoEmail').value.trim();
    const ruolo = parseInt(document.getElementById('infoRuolo').value);
    const password = document.getElementById('infoPassword').value;

    if (!nome || !cognome || !email || !ruolo) {
        showToast('Nome, cognome, email e ruolo sono obbligatori.', true);
        return;
    }

    const saveBtn = document.getElementById('btnSaveUserInfo');
    const originalBtnContent = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvataggio...';

    const payload = {
        Nome: nome,
        Cognome: cognome,
        Email: email,
        id_ruolo: ruolo,
        Password: password ? password : (uCorrente.Password || ''),
        Genere: document.getElementById('infoGenere').value || null,
        Codice_Fiscale: document.getElementById('infoCF').value.trim().toUpperCase() || null,
        Data_Nascita: document.getElementById('infoDataNascita').value || null,
        Nazionalita: document.getElementById('infoNazionalita').value.trim() || 'Italiana',
        Citta_Nascita: document.getElementById('infoCittaNascita').value.trim() || null,
        Provincia_Nascita: document.getElementById('infoProvinciaNascita').value.trim().toUpperCase() || null,
        Indirizzo_Residenza: document.getElementById('infoIndirizzo').value.trim() || null,
        Citta_Residenza: document.getElementById('infoCittaResidenza').value.trim() || null,
        Cap_Residenza: document.getElementById('infoCap').value.trim() || null,
        Provincia_Residenza: document.getElementById('infoProvincia').value.trim().toUpperCase() || null,
        Telefono: document.getElementById('infoTelefono').value.trim() || null,
        Primo_Accesso: document.getElementById('infoPrimoAccesso').checked
    };

    try {
        const res = await fetchAutenticata(`${API_URL}/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || data.error || 'Errore durante il salvataggio dei dati.');
        }

        bootstrap.Modal.getInstance(document.getElementById('userInfoModal'))?.hide();
        showToast('Scheda utente aggiornata con successo!');
        await loadUtenti();
    } catch (err) {
        console.error('Errore salvataggio scheda utente:', err);
        showToast(err.message || 'Errore di comunicazione col server.', true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnContent;
    }
}

// ============================================================
// Autocomplete Dati Comuni e Province
// ============================================================
async function setupAutocomplete() {
    try {
        const res = await fetch(`${API_URL}/proxy/province`);
        if (res.ok) {
            const json = await res.json();
            const dlProv = document.getElementById('provinceList');
            if (dlProv && json.data) {
                json.data.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.sigla;
                    opt.textContent = p.nome;
                    dlProv.appendChild(opt);
                });
            }
        }
    } catch (e) {
        console.error('Errore caricamento province:', e);
    }

    let searchTimeout;
    let lastFetchedComuni = []; // Variabile per memorizzare l'ultimo risultato

    async function fetchComuni(query) {
        if (!query || query.length < 2) return;
        try {
            const res = await fetch(`${API_URL}/proxy/comuni?q=${encodeURIComponent(query)}`);
            if (res.ok) {
                const json = await res.json();
                const dlComuni = document.getElementById('comuniList');
                if (dlComuni && json.data) {
                    dlComuni.innerHTML = '';
                    lastFetchedComuni = json.data; // Memorizza i dati
                    json.data.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c.nome;
                        if (c.sigla_provincia) {
                            opt.textContent = `${c.nome} (${c.sigla_provincia})`;
                        }
                        dlComuni.appendChild(opt);
                    });
                }
            }
        } catch (e) {
            console.error('Errore ricerca comuni:', e);
        }
    }

    const cittaInputs = ['infoCittaNascita', 'infoCittaResidenza'];
    cittaInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // Evento input per cercare i comuni mentre si digita
            input.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                searchTimeout = setTimeout(() => {
                    fetchComuni(query);
                }, 300);
            });

            // Evento change per autocompletare la provincia
            input.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                const match = lastFetchedComuni.find(c => c.nome.toLowerCase() === selectedValue.toLowerCase());
                if (match && match.sigla_provincia) {
                    let provId = null;
                    if (id === 'infoCittaResidenza') provId = 'infoProvincia';
                    if (id === 'infoCittaNascita')   provId = 'infoProvinciaNascita';
                    if (provId) {
                        const provInput = document.getElementById(provId);
                        if (provInput) {
                            provInput.value = match.sigla_provincia;
                        }
                    }
                }
            });
        }
    });
}
