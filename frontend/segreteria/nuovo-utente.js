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

    // Setup Nazionalità Toggle
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
        document.getElementById('userProvinciaNascita').value = existingUser.Provincia_Nascita || '';

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

// ============================================================
// Validazione Codice Fiscale (Regex + CIN Checksum)
// ============================================================
function validateCodiceFiscale(cf) {
    if (!cf || typeof cf !== 'string') return false;
    const cleanCF = cf.trim().toUpperCase();
    const pattern = /^[A-Z]{6}[0-9]{2}[A-EHLMPRST][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
    if (!pattern.test(cleanCF)) return false;

    const setOdd = {
        '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
        'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
        'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
        'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
    };
    const setEven = {
        '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
        'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
        'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
    };

    let s = 0;
    for (let i = 0; i < 15; i++) {
        const char = cleanCF.charAt(i);
        s += (i % 2 === 0) ? (setOdd[char] ?? 0) : (setEven[char] ?? 0);
    }
    const expectedChar = String.fromCharCode(65 + (s % 26));
    return cleanCF.charAt(15) === expectedChar;
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
// Setup Toggle Nazionalità (Italiana vs Altro)
// ============================================================
function setupNazionalitaToggle() {
    const radItaliana = document.getElementById('nazItaliana');
    const radAltro     = document.getElementById('nazAltro');

    function applyNazionalita() {
        const isItaliana = radItaliana ? radItaliana.checked : true;
        const cittaNascita        = document.getElementById('userCittaNascita');
        const provNascita         = document.getElementById('userProvinciaNascita');
        const cittaResidenza      = document.getElementById('userCittaResidenza');
        const provResidenza       = document.getElementById('userProvincia');
        const colCittaNascita     = document.getElementById('colCittaNascita');
        const colProvinciaNascita = document.getElementById('colProvinciaNascita');
        const errProvNascita      = document.getElementById('errProvinciaNascita');

        if (isItaliana) {
            if (colProvinciaNascita) colProvinciaNascita.style.display = 'block';
            if (colCittaNascita) colCittaNascita.className = 'col-md-8';

            if (cittaNascita) {
                cittaNascita.setAttribute('list', 'comuniList');
                cittaNascita.setAttribute('autocomplete', 'off');
            }
            if (provNascita) {
                provNascita.readOnly = true;
                provNascita.required = true;
                provNascita.placeholder = 'Es. RM';
            }
            if (cittaResidenza) {
                cittaResidenza.setAttribute('list', 'comuniList');
                cittaResidenza.setAttribute('autocomplete', 'off');
            }
            if (provResidenza) {
                provResidenza.readOnly = true;
                provResidenza.setAttribute('list', 'provinceList');
                provResidenza.placeholder = 'Es. MI';
            }
        } else {
            // Se di altra nazionalità, non far inserire la PROVINCIA DI NASCITA
            if (colProvinciaNascita) colProvinciaNascita.style.display = 'none';
            if (colCittaNascita) colCittaNascita.className = 'col-md-12';

            if (provNascita) {
                provNascita.value = '';
                provNascita.required = false;
            }
            if (errProvNascita) errProvNascita.textContent = '';

            if (cittaNascita) {
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

    if (radItaliana) radItaliana.addEventListener('change', applyNazionalita);
    if (radAltro)     radAltro.addEventListener('change', applyNazionalita);
    applyNazionalita();
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
    const errCittaNascita     = document.getElementById('errCittaNascita');
    const errProvinciaNascita = document.getElementById('errProvinciaNascita');
    const errIndirizzo        = document.getElementById('errIndirizzo');
    const errTelefono         = document.getElementById('errTelefono');
    const errCittaResidenza   = document.getElementById('errCittaResidenza');
    const errCap              = document.getElementById('errCap');
    const errProvincia        = document.getElementById('errProvincia');

    const errElements = [
        errNome, errCognome, errEmail, errRuolo, errPassword, errGenere, errCF,
        errDataNascita, errCittaNascita, errProvinciaNascita, errIndirizzo, errTelefono,
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
    } else if (!validateCodiceFiscale(cf)) {
        if (errCF) errCF.textContent = 'Codice Fiscale non valido (formato o carattere di controllo errati).';
        hasErrors = true;
    }
    if (!dataNascita) {
        if (errDataNascita) errDataNascita.textContent = 'La data di nascita è obbligatoria.';
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
        if (errIndirizzo) errIndirizzo.textContent = 'L\'indirizzo di residenza è obbligatorio.';
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
        Provincia_Nascita: document.getElementById('userProvinciaNascita')?.value.trim().toUpperCase() || null,
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
// Autocomplete Dati Comuni e Province
// ============================================================
async function setupAutocomplete() {
    // 1. Carica tutte le province (sono circa 110) al caricamento della pagina
    try {
        const res = await fetch(`${API_URL}/proxy/province`);
        if (res.ok) {
            const json = await res.json();
            const dlProv = document.getElementById('provinceList');
            if (dlProv && json.data) {
                json.data.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.sigla; // Il valore effettivo nell'input
                    opt.textContent = p.nome; // Mostra "Roma", "Milano" nel menu a tendina
                    dlProv.appendChild(opt);
                });
            }
        }
    } catch (e) {
        console.error('Errore caricamento province:', e);
    }

    // 2. Autocomplete dinamico per i comuni
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

    const cittaInputs = ['userCittaNascita', 'userCittaResidenza'];
    cittaInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // Evento input per cercare i comuni mentre si digita
            input.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                searchTimeout = setTimeout(() => {
                    fetchComuni(query);
                }, 300); // Debounce per evitare troppe chiamate API
            });

            // Evento change per autocompletare la provincia (quando l'utente clicca un'opzione)
            input.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                const match = lastFetchedComuni.find(c => c.nome.toLowerCase() === selectedValue.toLowerCase());
                if (match && match.sigla_provincia) {
                    // Mappa ogni input città al campo provincia corrispondente
                    let provId = null;
                    if (id === 'userCittaResidenza') provId = 'userProvincia';
                    if (id === 'userCittaNascita')   provId = 'userProvinciaNascita';
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