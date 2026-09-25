// ============================================================
// nuovo-utente.js â€” Creazione e Modifica Completa Utente
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

    // Password generator & strength meter
    document.getElementById('btnGeneratePassword')?.addEventListener('click', () => {
        const pwdInput = document.getElementById('userPassword');
        if (pwdInput) {
            const newPwd = generateRandomPassword();
            pwdInput.value = newPwd;
            pwdInput.type = 'text';
            const icon = document.getElementById('eyeIcon');
            if (icon) icon.className = 'bi bi-eye-slash';
            updatePasswordStrength();
            updatePreview();
        }
    });

    document.getElementById('userPassword')?.addEventListener('input', updatePasswordStrength);

    // Setup NazionalitÃ  Toggle
    setupNazionalitaToggle();

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

    // Setup autocomplete per provincia e comuni
    setupAutocomplete();

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

    // In modifica la password non Ã¨ obbligatoria
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
        document.getElementById('userProvinciaNascita').value = existingUser.Provincia_Nascita || '';

        document.getElementById('userIndirizzo').value = existingUser.Indirizzo_Residenza || '';
        document.getElementById('userTelefono').value = existingUser.Telefono || '';
        document.getElementById('userCittaResidenza').value = existingUser.Citta_Residenza || '';
        document.getElementById('userCap').value = existingUser.Cap_Residenza || '';
        document.getElementById('userProvincia').value = existingUser.Provincia_Residenza || '';

        const naz = (existingUser.Nazionalita || '').trim();
        const provNascita = (existingUser.Provincia_Nascita || '').trim();
        const cittaNascita = (existingUser.Citta_Nascita || '').trim();

        const isEstera = (naz !== '' && naz.toLowerCase() !== 'italiana' && naz.toLowerCase() !== 'italia') ||
                         (!provNascita && cittaNascita !== '' && naz.toLowerCase() !== 'italiana' && naz.toLowerCase() !== 'italia');

        const radItaliana = document.getElementById('nazItaliana');
        const radAltro = document.getElementById('nazAltro');

        if (isEstera) {
            if (radAltro) radAltro.checked = true;
            if (radItaliana) radItaliana.checked = false;
        } else {
            if (radItaliana) radItaliana.checked = true;
            if (radAltro) radAltro.checked = false;
        }

        applyNazionalitaUI();

        if (isEstera) {
            const nazInput = document.getElementById('userNazionalitaInput');
            if (nazInput) nazInput.value = (naz && naz.toLowerCase() !== 'italiana' && naz.toLowerCase() !== 'italia') ? naz : 'Estera';
        }

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

// ============================================================
// Password Generator & Strength Meter
// ============================================================
function generateRandomPassword() {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers   = '23456789';
    const symbols   = '!@#$%&*';
    const allChars  = uppercase + lowercase + numbers + symbols;

    let pwd = '';
    pwd += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    pwd += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
    pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));

    for (let i = 4; i < 12; i++) {
        pwd += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

function updatePasswordStrength() {
    const input   = document.getElementById('userPassword');
    const wrapper = document.getElementById('pwdStrengthWrapper');
    const bar     = document.getElementById('pwdStrengthBar');
    const text    = document.getElementById('pwdStrengthText');

    if (!input || !wrapper || !bar || !text) return;
    const pwd = input.value;
    if (!pwd) {
        wrapper.style.display = 'none';
        return;
    }

    wrapper.style.display = 'block';
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) {
        bar.style.width = '33%';
        bar.style.backgroundColor = '#dc3545';
        text.textContent = 'Robustezza: Debole';
        text.style.color = '#dc3545';
    } else if (score <= 4) {
        bar.style.width = '66%';
        bar.style.backgroundColor = '#ffc107';
        text.textContent = 'Robustezza: Media';
        text.style.color = '#b58100';
    } else {
        bar.style.width = '100%';
        bar.style.backgroundColor = '#198754';
        text.textContent = 'Robustezza: Forte';
        text.style.color = '#198754';
    }
}

// ============================================================
// Setup Toggle NazionalitÃ  (Italiana vs Altro)
// ============================================================
function applyNazionalitaUI() {
    const radItaliana = document.getElementById('nazItaliana');
    const isItaliana = radItaliana ? radItaliana.checked : true;
    const colNazionalita      = document.getElementById('colNazionalita');
    const nazionalitaInput    = document.getElementById('userNazionalitaInput');
    const cittaNascita        = document.getElementById('userCittaNascita');
    const provNascita         = document.getElementById('userProvinciaNascita');
    const cittaResidenza      = document.getElementById('userCittaResidenza');
    const provResidenza       = document.getElementById('userProvincia');
    const colCittaNascita     = document.getElementById('colCittaNascita');
    const colProvinciaNascita = document.getElementById('colProvinciaNascita');
    const errProvNascita      = document.getElementById('errProvinciaNascita');
    const errNazionalita      = document.getElementById('errNazionalita');

    if (isItaliana) {
        if (colNazionalita) colNazionalita.style.display = 'none';
        if (colProvinciaNascita) colProvinciaNascita.style.display = 'block';
        if (colCittaNascita) colCittaNascita.className = 'col-md-8';

        if (nazionalitaInput) {
            nazionalitaInput.required = false;
            nazionalitaInput.value = 'Italiana';
        }
        if (errNazionalita) errNazionalita.textContent = '';

        if (cittaNascita) {
            cittaNascita.placeholder = 'Es. Roma';
            cittaNascita.removeAttribute('list');
            cittaNascita.setAttribute('autocomplete', 'off');
        }
        if (provNascita) {
            provNascita.readOnly = true;
            provNascita.required = true;
            provNascita.placeholder = 'Es. RM';
        }
        if (cittaResidenza) {
            cittaResidenza.removeAttribute('list');
            cittaResidenza.setAttribute('autocomplete', 'off');
        }
        if (provResidenza) {
            provResidenza.readOnly = true;
            provResidenza.removeAttribute('list');
            provResidenza.placeholder = 'Es. MI';
        }
    } else {
        if (colNazionalita) {
            colNazionalita.style.display = 'block';
            colNazionalita.className = 'col-md-6';
        }
        if (colCittaNascita) colCittaNascita.className = 'col-md-6';
        if (colProvinciaNascita) colProvinciaNascita.style.display = 'none';

        if (nazionalitaInput) {
            nazionalitaInput.required = true;
            if (nazionalitaInput.value === 'Italiana' || nazionalitaInput.value === 'Italia') {
                nazionalitaInput.value = '';
            }
        }

        if (provNascita) {
            provNascita.value = '';
            provNascita.required = false;
        }
        if (errProvNascita) errProvNascita.textContent = '';

        if (cittaNascita) {
            cittaNascita.placeholder = 'Es. Parigi, Tirana, San Paolo...';
            cittaNascita.removeAttribute('list');
            cittaNascita.removeAttribute('autocomplete');
        }
        if (cittaResidenza) {
            cittaResidenza.removeAttribute('list');
            cittaResidenza.removeAttribute('autocomplete');
        }
        if (provResidenza) {
            provResidenza.readOnly = false;
            provResidenza.removeAttribute('list');
            provResidenza.placeholder = 'Stato/Prov. Estera';
        }
    }
}

function setupNazionalitaToggle() {
    const radItaliana = document.getElementById('nazItaliana');
    const radAltro     = document.getElementById('nazAltro');

    if (radItaliana) radItaliana.addEventListener('change', applyNazionalitaUI);
    if (radAltro)     radAltro.addEventListener('change', applyNazionalitaUI);
    applyNazionalitaUI();
}

async function handleSubmit(e) {
    e.preventDefault();

    const nome             = document.getElementById('userNome')?.value.trim();
    const cognome          = document.getElementById('userCognome')?.value.trim();
    const email            = document.getElementById('userEmail')?.value.trim();
    const ruolo            = document.getElementById('userRuolo')?.value;
    const password         = document.getElementById('userPassword')?.value;
    const genere           = document.getElementById('userGenere')?.value;
    const cf               = document.getElementById('userCF')?.value.trim().toUpperCase();
    const dataNascita      = document.getElementById('userDataNascita')?.value;
    const nazionalitaVal   = document.getElementById('userNazionalitaInput')?.value.trim();
    const cittaNascita     = document.getElementById('userCittaNascita')?.value.trim();
    const provinciaNascita = document.getElementById('userProvinciaNascita')?.value.trim().toUpperCase();
    const indirizzo        = document.getElementById('userIndirizzo')?.value.trim();
    const telefono         = document.getElementById('userTelefono')?.value.trim();
    const cittaResidenza   = document.getElementById('userCittaResidenza')?.value.trim();
    const cap              = document.getElementById('userCap')?.value.trim();
    const provincia        = document.getElementById('userProvincia')?.value.trim().toUpperCase();

    const radItaliana = document.getElementById('nazItaliana');
    const isItaliana  = radItaliana ? radItaliana.checked : true;

    const errNome             = document.getElementById('errNome');
    const errCognome          = document.getElementById('errCognome');
    const errEmail            = document.getElementById('errEmail');
    const errRuolo            = document.getElementById('errRuolo');
    const errPassword         = document.getElementById('errPassword');
    const errGenere           = document.getElementById('errGenere');
    const errCF               = document.getElementById('errCF');
    const errDataNascita      = document.getElementById('errDataNascita');
    const errNazionalita      = document.getElementById('errNazionalita');
    const errCittaNascita     = document.getElementById('errCittaNascita');
    const errProvinciaNascita = document.getElementById('errProvinciaNascita');
    const errIndirizzo        = document.getElementById('errIndirizzo');
    const errTelefono         = document.getElementById('errTelefono');
    const errCittaResidenza   = document.getElementById('errCittaResidenza');
    const errCap              = document.getElementById('errCap');
    const errProvincia        = document.getElementById('errProvincia');

    const errElements = [
        errNome, errCognome, errEmail, errRuolo, errPassword, errGenere, errCF,
        errDataNascita, errNazionalita, errCittaNascita, errProvinciaNascita, errIndirizzo, errTelefono,
        errCittaResidenza, errCap, errProvincia
    ];
    errElements.forEach(el => { if (el) el.textContent = ''; });

    let hasErrors = false;

    // STEP 1 Validation
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

    // STEP 2 Dati Anagrafici Validation
    if (!genere) {
        if (errGenere) errGenere.textContent = 'Il genere è obbligatorio.';
        hasErrors = true;
    }
    if (!cf) {
        if (errCF) errCF.textContent = 'Il codice fiscale è obbligatorio.';
        hasErrors = true;
    }
    if (!dataNascita) {
        if (errDataNascita) errDataNascita.textContent = 'La data di nascita è obbligatoria.';
        hasErrors = true;
    }
    if (!isItaliana && !nazionalitaVal) {
        if (errNazionalita) errNazionalita.textContent = 'La nazionalità è obbligatoria per utenti esteri.';
        hasErrors = true;
    }
    if (!cittaNascita) {
        if (errCittaNascita) errCittaNascita.textContent = 'La città di nascita è obbligatoria.';
        hasErrors = true;
    }
    if (isItaliana && !provinciaNascita) {
        if (errProvinciaNascita) errProvinciaNascita.textContent = 'La provincia di nascita è obbligatoria.';
        hasErrors = true;
    }

    // STEP 3 Residenza Validation
    if (!indirizzo) {
        if (errIndirizzo) errIndirizzo.textContent = "L'indirizzo di residenza è obbligatorio.";
        hasErrors = true;
    }
    if (!telefono) {
        if (errTelefono) errTelefono.textContent = 'Il numero di telefono è obbligatorio.';
        hasErrors = true;
    }
    if (!cittaResidenza) {
        if (errCittaResidenza) errCittaResidenza.textContent = 'La città di residenza è obbligatoria.';
        hasErrors = true;
    }
    if (!cap) {
        if (errCap) errCap.textContent = 'Il CAP è obbligatorio.';
        hasErrors = true;
    }
    if (!provincia) {
        if (errProvincia) errProvincia.textContent = 'La provincia di residenza è obbligatoria.';
        hasErrors = true;
    }

    if (hasErrors) {
        showToast('Compila tutti i campi obbligatori correttamente.', true);
        return;
    }

    const btnSubmit  = document.getElementById('btnSubmitUtente');
    const btnText    = document.getElementById('btnSubmitText');
    const btnLoading = document.getElementById('btnSubmitLoading');

    btnSubmit.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'flex';

    let nazionalitaFinale = 'Italiana';
    if (!isItaliana) {
        nazionalitaFinale = (nazionalitaVal && nazionalitaVal.toLowerCase() !== 'italiana' && nazionalitaVal.toLowerCase() !== 'italia')
            ? nazionalitaVal
            : (nazionalitaVal || 'Estera');
    }

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
        Nazionalita: nazionalitaFinale,
        Provincia_Nascita: isItaliana ? (document.getElementById('userProvinciaNascita')?.value.trim().toUpperCase() || null) : null,
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

// ============================================================
// Autocomplete Comuni e Province — usa endpoint interno /comuni
// ============================================================

function createComuneAutocomplete(inputId, provinciaId, capId) {
    var input = document.getElementById(inputId);
    if (!input) return;

    // Rimuovi list attribute (non usiamo datalist)
    input.removeAttribute('list');

    // Wrapper per posizionamento relativo del dropdown
    var fieldGroup = input.closest('.nc-field-group') || input.parentElement;
    fieldGroup.style.position = 'relative';

    // Crea il dropdown container
    var dropdown = document.createElement('div');
    dropdown.className = 'comune-autocomplete-dropdown';
    dropdown.style.cssText = 'display:none;position:absolute;top:100%;left:0;right:0;z-index:9999;background:#fff;border:1px solid #c8d0e0;border-top:none;border-radius:0 0 10px 10px;box-shadow:0 8px 24px rgba(0,0,0,0.13);max-height:230px;overflow-y:auto;font-size:0.875rem;';
    fieldGroup.appendChild(dropdown);

    var debounceTimer = null;
    var comuniResults = [];
    var activeIndex = -1;

    function hideDropdown() {
        dropdown.style.display = 'none';
        activeIndex = -1;
    }

    function showDropdown() {
        if (dropdown.children.length > 0) dropdown.style.display = 'block';
    }

    function highlightItem(index) {
        var items = dropdown.querySelectorAll('.cac-item');
        items.forEach(function(el, i) {
            el.style.backgroundColor = (i === index) ? '#eef2ff' : '';
            el.style.color = (i === index) ? '#3b4cb8' : '';
        });
        activeIndex = index;
    }

    function selectComune(comune) {
        input.value = comune.nome;
        var provInput = document.getElementById(provinciaId);
        if (provInput) provInput.value = comune.sigla || '';
        if (capId) {
            var capInput = document.getElementById(capId);
            if (capInput && comune.cap) capInput.value = comune.cap;
        }
        hideDropdown();
    }

    function renderItems(items) {
        dropdown.innerHTML = '';
        comuniResults = items;
        activeIndex = -1;
        if (!items || !items.length) { hideDropdown(); return; }
        items.forEach(function(comune, i) {
            var item = document.createElement('div');
            item.className = 'cac-item';
            item.style.cssText = 'padding:9px 14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f3f4f7;transition:background 0.12s;';
            var leftSpan = document.createElement('span');
            leftSpan.style.cssText = 'font-weight:500;color:#212529;';
            leftSpan.textContent = comune.nome;
            var rightSpan = document.createElement('span');
            rightSpan.style.cssText = 'font-size:0.78rem;color:#6c757d;margin-left:8px;white-space:nowrap;display:flex;align-items:center;gap:5px;';
            var siglaBadge = document.createElement('span');
            siglaBadge.style.cssText = 'background:#e9ecef;padding:1px 7px;border-radius:4px;font-weight:700;color:#495057;';
            siglaBadge.textContent = comune.sigla;
            rightSpan.appendChild(siglaBadge);
            if (comune.cap) {
                var capSpan = document.createElement('span');
                capSpan.style.color = '#adb5bd';
                capSpan.textContent = comune.cap;
                rightSpan.appendChild(capSpan);
            }
            item.appendChild(leftSpan);
            item.appendChild(rightSpan);
            item.addEventListener('mousedown', function(e) { e.preventDefault(); selectComune(comune); });
            item.addEventListener('mouseenter', function() { highlightItem(i); });
            dropdown.appendChild(item);
        });
        showDropdown();
    }

    async function fetchAndRender(query) {
        if (!query || query.length < 2) { hideDropdown(); return; }
        try {
            var res = await fetch(API_URL + '/comuni?q=' + encodeURIComponent(query) + '&limit=10');
            if (res.ok) { var data = await res.json(); renderItems(data); }
        } catch (e) { console.error('Errore autocomplete comuni:', e); }
    }

    input.addEventListener('input', function(e) {
        clearTimeout(debounceTimer);
        var q = e.target.value.trim();
        debounceTimer = setTimeout(function() { fetchAndRender(q); }, 280);
    });

    input.addEventListener('keydown', function(e) {
        var items = dropdown.querySelectorAll('.cac-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); highlightItem(Math.min(activeIndex + 1, items.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); highlightItem(Math.max(activeIndex - 1, 0)); }
        else if (e.key === 'Enter') { if (activeIndex >= 0 && comuniResults[activeIndex]) { e.preventDefault(); selectComune(comuniResults[activeIndex]); } }
        else if (e.key === 'Escape') { hideDropdown(); }
    });

    input.addEventListener('focus', function() {
        if (input.value.trim().length >= 2) fetchAndRender(input.value.trim());
    });

    document.addEventListener('click', function(e) {
        if (!fieldGroup.contains(e.target) && !dropdown.contains(e.target)) hideDropdown();
    });
}

function setupAutocomplete() {
    // Citta di nascita -> auto-compila Provincia Nascita
    createComuneAutocomplete('userCittaNascita', 'userProvinciaNascita', null);
    // Citta di residenza -> auto-compila Provincia e CAP Residenza
    createComuneAutocomplete('userCittaResidenza', 'userProvincia', 'userCap');
}