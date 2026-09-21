// ============================================================
// nuovo-utente.js — Creazione e Modifica Completa Utente
// ============================================================

let ruoliList = [];
let isEditMode = false;
let currentUserId = null;
let existingUser = null;

const RUOLO_STYLE = {
    'segreteria':  'Segreteria',
    'docente':     'Docente',
    'professore':  'Docente',
    'studente':    'Studente',
};

document.addEventListener('DOMContentLoaded', async () => {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Carica ruoli
    await loadRuoli();

    // Password visibility toggle
    document.getElementById('btnTogglePassword')?.addEventListener('click', togglePasswordVisibility);

    // Gestione Query Params
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (userId) {
        await initEditMode(parseInt(userId));
    } else {
        initCreateMode();
    }

    // Setup live preview
    setupLivePreview();

    // Form submit
    const form = document.getElementById('utenteForm');
    if (form) form.addEventListener('submit', handleSubmit);
});

async function loadRuoli() {
    const select = document.getElementById('userRuolo');
    try {
        const res = await fetchAutenticata(`${API_URL}/ruoli`);
        if (!res.ok) throw new Error('Errore recupero ruoli');

        const allRuoli = await res.json();
        // Escludi il ruolo super_admin dalla selezione
        ruoliList = allRuoli.filter(r => (r.Nome || '').toLowerCase() !== 'super_admin');
        select.innerHTML = '<option value="">-- Seleziona ruolo --</option>';

        ruoliList.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id_ruolo;
            const key = (r.Nome || '').toLowerCase();
            opt.textContent = RUOLO_STYLE[key] || r.Nome;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error(e);
        select.innerHTML = '<option value="">Errore nel caricamento dei ruoli</option>';
        showToast('Impossibile caricare i ruoli.', true);
    }
}

function togglePasswordVisibility() {
    const input = document.getElementById('userPassword');
    const icon = document.getElementById('eyeIcon');
    if (!input || !icon) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
}

function initCreateMode() {
    isEditMode = false;
    currentUserId = null;
    existingUser = null;

    document.getElementById('pageTitleText').textContent = 'Crea Nuovo Utente';
    document.getElementById('pageSubtitleText').textContent = 'Inserisci i dati anagrafici, i recapiti e configura l\'accesso per il nuovo account.';
    document.getElementById('cardHeaderTitle').textContent = 'Scheda Nuovo Utente';
    document.getElementById('btnSubmitText').innerHTML = '<i class="bi bi-check2-circle"></i> Salva Utente';
    document.getElementById('pwdRequiredStar').style.display = 'inline';
    document.getElementById('pwdHint').style.display = 'none';
    document.getElementById('userPassword').required = true;

    updatePreview();
}

async function initEditMode(id) {
    isEditMode = true;
    currentUserId = id;
    document.getElementById('utenteId').value = id;

    document.getElementById('pageTitleText').textContent = 'Modifica Scheda Utente';
    document.getElementById('pageSubtitleText').textContent = `Aggiorna i dati anagrafici e i privilegi dell'account #${id}.`;
    document.getElementById('cardHeaderTitle').textContent = `Modifica Utente #${id}`;
    document.getElementById('topNavCurrent').textContent = `Modifica Utente #${id}`;
    document.getElementById('breadcrumbAction').textContent = `Modifica Utente #${id}`;
    document.getElementById('btnSubmitText').innerHTML = '<i class="bi bi-check2-circle"></i> Salva Modifiche';

    // In modifica la password non è obbligatoria
    document.getElementById('pwdRequiredStar').style.display = 'none';
    document.getElementById('pwdHint').style.display = 'block';
    document.getElementById('labelPassword').textContent = 'Nuova Password';
    document.getElementById('userPassword').required = false;

    try {
        const res = await fetchAutenticata(`${API_URL}/users`);
        if (!res.ok) throw new Error('Errore recupero utenti');

        const allUsers = await res.json();
        existingUser = allUsers.find(x => x.id_utente === id);

        if (!existingUser) {
            showToast('Utente non trovato nel sistema.', true);
            setTimeout(() => window.location.href = 'utenze.html', 1500);
            return;
        }

        // Popola campi
        document.getElementById('userEmail').value = existingUser.Email || '';
        document.getElementById('userRuolo').value = existingUser.id_ruolo || '';
        document.getElementById('userPrimoAccesso').checked = !!existingUser.Primo_Accesso;

        document.getElementById('userNome').value = existingUser.Nome || '';
        document.getElementById('userCognome').value = existingUser.Cognome || '';
        document.getElementById('userGenere').value = existingUser.Genere || '';
        document.getElementById('userCF').value = existingUser.Codice_Fiscale || '';
        document.getElementById('userDataNascita').value = existingUser.Data_Nascita || '';
        document.getElementById('userCittaNascita').value = existingUser.Citta_Nascita || '';

        document.getElementById('userIndirizzo').value = existingUser.Indirizzo_Residenza || '';
        document.getElementById('userTelefono').value = existingUser.Telefono || '';
        document.getElementById('userCittaResidenza').value = existingUser.Citta_Residenza || '';
        document.getElementById('userCap').value = existingUser.Cap_Residenza || '';
        document.getElementById('userProvincia').value = existingUser.Provincia_Residenza || '';

        updatePreview();
    } catch (e) {
        console.error(e);
        showToast('Errore durante il recupero dei dati utente.', true);
    }
}

function setupLivePreview() {
    const fields = ['userNome', 'userCognome', 'userEmail', 'userRuolo', 'userCF', 'userPassword'];
    fields.forEach(f => {
        document.getElementById(f)?.addEventListener('input', updatePreview);
        document.getElementById(f)?.addEventListener('change', updatePreview);
    });
}

function updatePreview() {
    const nome    = document.getElementById('userNome')?.value.trim() || '';
    const cognome = document.getElementById('userCognome')?.value.trim() || '';
    const email   = document.getElementById('userEmail')?.value.trim() || '';
    const ruoloId = document.getElementById('userRuolo')?.value || '';
    const cf      = document.getElementById('userCF')?.value.trim().toUpperCase() || '';
    const pwd     = document.getElementById('userPassword')?.value || '';

    // Nome e Iniziali
    const full = (nome || cognome) ? `${nome} ${cognome}`.trim() : 'Nome Cognome';
    const initials = `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase() || '--';

    const avatarEl = document.getElementById('previewAvatar');
    const nameEl   = document.getElementById('previewFullName');
    const emailEl  = document.getElementById('previewEmail');
    const cfEl     = document.getElementById('previewCF');
    const roleEl   = document.getElementById('previewRole');

    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl)   nameEl.textContent   = full;
    if (emailEl)  emailEl.textContent  = email || '--';
    if (cfEl)     cfEl.textContent     = cf || '--';

    if (roleEl) {
        if (ruoloId) {
            const found = ruoliList.find(x => x.id_ruolo == ruoloId);
            const roleName = found ? found.Nome : `Ruolo #${ruoloId}`;
            const key = (roleName || '').toLowerCase();
            roleEl.textContent = RUOLO_STYLE[key] || roleName;
        } else {
            roleEl.textContent = 'Ruolo non selezionato';
        }
    }

    // Checklist
    const emailValid = email && email.includes('@');
    document.getElementById('checkEmail')?.classList.toggle('filled', !!emailValid);
    document.getElementById('checkRuolo')?.classList.toggle('filled', !!ruoloId);
    document.getElementById('checkNomeCognome')?.classList.toggle('filled', !!(nome && cognome));

    const pwdConfigured = isEditMode ? true : !!pwd;
    document.getElementById('checkPassword')?.classList.toggle('filled', pwdConfigured);
}

async function handleSubmit(e) {
    e.preventDefault();

    const nome     = document.getElementById('userNome')?.value.trim();
    const cognome  = document.getElementById('userCognome')?.value.trim();
    const email    = document.getElementById('userEmail')?.value.trim();
    const ruolo    = document.getElementById('userRuolo')?.value;
    const password = document.getElementById('userPassword')?.value;

    const errNome     = document.getElementById('errNome');
    const errCognome  = document.getElementById('errCognome');
    const errEmail    = document.getElementById('errEmail');
    const errRuolo    = document.getElementById('errRuolo');
    const errPassword = document.getElementById('errPassword');

    if (errNome) errNome.textContent = '';
    if (errCognome) errCognome.textContent = '';
    if (errEmail) errEmail.textContent = '';
    if (errRuolo) errRuolo.textContent = '';
    if (errPassword) errPassword.textContent = '';

    let hasErrors = false;

    if (!nome) {
        if (errNome) errNome.textContent = 'Il nome è obbligatorio.';
        hasErrors = true;
    }
    if (!cognome) {
        if (errCognome) errCognome.textContent = 'Il cognome è obbligatorio.';
        hasErrors = true;
    }
    if (!email || !email.includes('@')) {
        if (errEmail) errEmail.textContent = 'Inserisci un indirizzo email valido.';
        hasErrors = true;
    }
    if (!ruolo) {
        if (errRuolo) errRuolo.textContent = 'Seleziona un ruolo per l\'utente.';
        hasErrors = true;
    }
    if (!isEditMode && !password) {
        if (errPassword) errPassword.textContent = 'La password è obbligatoria per i nuovi utenti.';
        hasErrors = true;
    }

    if (hasErrors) return;

    const btnSubmit  = document.getElementById('btnSubmitUtente');
    const btnText    = document.getElementById('btnSubmitText');
    const btnLoading = document.getElementById('btnSubmitLoading');

    btnSubmit.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'flex';

    const payload = {
        Nome: nome,
        Cognome: cognome,
        Email: email,
        id_ruolo: parseInt(ruolo),
        Password: password || (existingUser?.Password ?? ''),
        Genere: document.getElementById('userGenere')?.value || null,
        Codice_Fiscale: document.getElementById('userCF')?.value.trim().toUpperCase() || null,
        Data_Nascita: document.getElementById('userDataNascita')?.value || null,
        Citta_Nascita: document.getElementById('userCittaNascita')?.value.trim() || null,
        Indirizzo_Residenza: document.getElementById('userIndirizzo')?.value.trim() || null,
        Citta_Residenza: document.getElementById('userCittaResidenza')?.value.trim() || null,
        Cap_Residenza: document.getElementById('userCap')?.value.trim() || null,
        Provincia_Residenza: document.getElementById('userProvincia')?.value.trim().toUpperCase() || null,
        Telefono: document.getElementById('userTelefono')?.value.trim() || null,
        Primo_Accesso: document.getElementById('userPrimoAccesso')?.checked ?? true
    };

    try {
        const url    = isEditMode ? `${API_URL}/users/${currentUserId}` : `${API_URL}/users`;
        const method = isEditMode ? 'PUT' : 'POST';

        const res = await fetchAutenticata(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || errData.error || 'Errore durante il salvataggio dell\'utente.');
        }

        showToast(isEditMode ? 'Utente aggiornato con successo!' : 'Utente creato con successo!');
        setTimeout(() => {
            window.location.href = 'utenze.html';
        }, 1000);

    } catch (err) {
        console.error(err);
        showToast(err.message || 'Errore di connessione al server.', true);
        btnSubmit.disabled = false;
        if (btnText) btnText.style.display = 'flex';
        if (btnLoading) btnLoading.style.display = 'none';
    }
}

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast show ' + (isError ? 'error' : 'success');
    setTimeout(() => {
        toast.className = 'toast';
    }, 3500);
}