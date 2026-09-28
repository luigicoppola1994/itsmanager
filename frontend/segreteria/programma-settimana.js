// ═══════════════════════════════════════════════════
//  PROGRAMMA-SETTIMANA.JS — Standalone Weekly Scheduler
// ═══════════════════════════════════════════════════

let selectedCorsoAttivo = null;
let moduliList = [];
let unitaFormativeList = [];
let pianostudioList = [];
let docentiList = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth check
    if (typeof checkAuth === 'function' && !checkAuth()) return;

    // 2. Parsa parametri URL
    const urlParams = new URLSearchParams(window.location.search);
    const idCorsoAttivo = urlParams.get('id_corso_attivo');

    if (!idCorsoAttivo) {
        showToast('Nessuna edizione selezionata. Reindirizzamento...', true);
        setTimeout(() => window.location.href = 'calendario.html', 1500);
        return;
    }

    document.getElementById('hiddenCorsoAttivoId').value = idCorsoAttivo;
    const backUrl = `calendario.html?id_corso_attivo=${idCorsoAttivo}`;
    document.getElementById('btnBackToCalendario').href = backUrl;

    try {
        // 3. Carica dati
        await Promise.all([
            loadCorsoAttivo(idCorsoAttivo),
            loadDocenti(),
            loadModuliEUnita(),
            loadPianoStudio(idCorsoAttivo)
        ]);

        // 4. Popola moduli select
        populateModuliSelect();

        // 5. Default date
        const defaultStart = selectedCorsoAttivo?.data_inizio || new Date().toISOString().split('T')[0];
        const inputDataInizio = document.getElementById('settimanaDataInizio');
        inputDataInizio.value = defaultStart;
        if (selectedCorsoAttivo?.data_inizio) inputDataInizio.min = selectedCorsoAttivo.data_inizio;
        if (selectedCorsoAttivo?.data_fine) inputDataInizio.max = selectedCorsoAttivo.data_fine;

        // 6. Setup Event Listeners
        attachEventListeners();
        updateSettimanaPreview();

    } catch (err) {
        console.error('Errore caricamento settimana:', err);
        showErrorAlert('Errore durante il caricamento dei dati: ' + (err.message || 'Server error'));
    }
});

// ═══════════════════════════════════════════════════
//  CARICAMENTO DATI API
// ═══════════════════════════════════════════════════

async function loadCorsoAttivo(idCorsoAttivo) {
    const res = await fetchAutenticata(`${API_URL}/corsi-attivi/${idCorsoAttivo}`);
    if (!res.ok) throw new Error('Edizione non trovata');
    selectedCorsoAttivo = await res.json();

    const nomeCorso = selectedCorsoAttivo.corso?.Nome || `Corso #${selectedCorsoAttivo.id_corso}`;
    const edNome = selectedCorsoAttivo.nome_edizione || `Edizione #${selectedCorsoAttivo.id_corso_attivo}`;
    const dInizio = selectedCorsoAttivo.data_inizio ? formatDate(selectedCorsoAttivo.data_inizio) : 'N/D';
    const dFine = selectedCorsoAttivo.data_fine ? formatDate(selectedCorsoAttivo.data_fine) : 'N/D';

    document.getElementById('contextEdizioneName').textContent = `${nomeCorso} - ${edNome}`;
    document.getElementById('contextDateRange').textContent = `Periodo: dal ${dInizio} al ${dFine}`;

    document.getElementById('previewCorsoNome').textContent = nomeCorso;
    document.getElementById('previewEdizioneBadge').textContent = edNome;
}

async function loadDocenti() {
    const res = await fetchAutenticata(`${API_URL}/utenti`);
    if (!res.ok) return;
    const allUsers = await res.json();

    let ruoliMap = { 1: 'admin', 2: 'segreteria', 3: 'docente', 4: 'studente' };
    docentiList = allUsers.filter(u => {
        const rNome = (u.ruolo?.Nome || ruoliMap[u.id_ruolo] || '').toLowerCase().trim();
        return rNome.includes('docente') || rNome.includes('prof');
    });
    if (!docentiList.length) docentiList = allUsers;

    const select = document.getElementById('settimanaDocente');
    let opts = '<option value="">-- Seleziona docente --</option>';
    docentiList.forEach(d => {
        opts += `<option value="${d.id_utente}">${d.Nome} ${d.Cognome}</option>`;
    });
    select.innerHTML = opts;
}

async function loadModuliEUnita() {
    const [resM, resUf] = await Promise.all([
        fetchAutenticata(`${API_URL}/moduli`),
        fetchAutenticata(`${API_URL}/unita_formative`)
    ]);
    if (resM.ok) moduliList = await resM.json();
    if (resUf.ok) unitaFormativeList = await resUf.json();
}

async function loadPianoStudio(idCorsoAttivo) {
    try {
        const res = await fetchAutenticata(`${API_URL}/corsi-attivi/${idCorsoAttivo}/piano-studio`);
        if (res.ok) pianostudioList = await res.json();
    } catch (e) {
        pianostudioList = [];
    }

    pianostudioList = pianostudioList.map(ps => {
        const uf = unitaFormativeList.find(u => u.id_unita_formativa === ps.id_unita_formativa);
        return { ...ps, uf_nome: uf ? uf.Nome : `UF #${ps.id_unita_formativa}` };
    });
}

function populateModuliSelect() {
    const select = document.getElementById('settimanaModulo');
    let opts = '<option value="">-- Seleziona modulo --</option>';

    if (pianostudioList && pianostudioList.length > 0) {
        const ufMap = {};
        pianostudioList.forEach(ps => { ufMap[ps.id_unita_formativa] = ps; });
        const filteredModuli = moduliList.filter(m => ufMap[m.id_unita_formativa]);

        if (filteredModuli.length > 0) {
            const grouped = {};
            filteredModuli.forEach(m => {
                const ps = ufMap[m.id_unita_formativa];
                const ufObj = unitaFormativeList.find(u => u.id_unita_formativa === m.id_unita_formativa);
                const ufNome = ps.uf_nome || (ufObj ? ufObj.Nome : `UF #${m.id_unita_formativa}`);
                const groupKey = `${ufNome}${ps.ore_dedicate ? ` (${ps.ore_dedicate}h)` : ''}`;
                if (!grouped[groupKey]) grouped[groupKey] = [];
                grouped[groupKey].push(m);
            });

            Object.entries(grouped).forEach(([groupLabel, moduli]) => {
                opts += `<optgroup label="${groupLabel}">`;
                moduli.forEach(m => {
                    opts += `<option value="${m.id_modulo}">${m.Nome}</option>`;
                });
                opts += `</optgroup>`;
            });
        } else {
            opts += `<option value="" disabled>Nessun modulo a catalogo associato alle UF di questa edizione</option>`;
        }
    } else {
        opts += `<option value="" disabled>Nessuna Unità Formativa associata a questa edizione</option>`;
    }
    select.innerHTML = opts;
}

// ═══════════════════════════════════════════════════
//  EVENT LISTENERS & PREVIEW
// ═══════════════════════════════════════════════════

function attachEventListeners() {
    const inputs = ['settimanaModulo', 'settimanaDocente', 'settimanaDataInizio', 'settimanaNumeroSettimane', 'settimanaOraInizio', 'settimanaOraFine', 'diffMarInizio', 'diffMarFine', 'diffGioInizio', 'diffGioFine'];
    inputs.forEach(id => {
        document.getElementById(id)?.addEventListener('change', updateSettimanaPreview);
        document.getElementById(id)?.addEventListener('input', updateSettimanaPreview);
    });

    document.querySelectorAll('.chk-giorno').forEach(chk => {
        chk.addEventListener('change', updateSettimanaPreview);
    });

    document.getElementById('btnToggleOrariDifferenziati').addEventListener('click', toggleOrariDifferenziati);
    document.getElementById('settimanaForm').addEventListener('submit', handleSettimanaFormSubmit);
}

function toggleOrariDifferenziati() {
    const box = document.getElementById('boxOrariDifferenziati');
    if (!box) return;
    const isHidden = box.style.display === 'none';
    box.style.display = isHidden ? 'block' : 'none';
    document.getElementById('labelToggleDiff').textContent = isHidden ? 'Usa orario unico standard' : 'Personalizza orari (es. Mar e Gio 9-15)';
    updateSettimanaPreview();
}

function updateSettimanaPreview() {
    hideErrorAlert();

    const idModulo = parseInt(document.getElementById('settimanaModulo').value);
    const idDocente = parseInt(document.getElementById('settimanaDocente').value);
    const dInizioStr = document.getElementById('settimanaDataInizio').value;
    const nWeeks = parseInt(document.getElementById('settimanaNumeroSettimane').value || 1);
    const oraInizioDef = document.getElementById('settimanaOraInizio').value;
    const oraFineDef = document.getElementById('settimanaOraFine').value;

    // 1. Modulo & UF
    const moduloObj = moduliList.find(m => m.id_modulo === idModulo);
    const previewModulo = document.getElementById('previewModuloNome');
    if (moduloObj) {
        previewModulo.textContent = moduloObj.Nome;
        setCheckItem('checkModulo', true);
    } else {
        previewModulo.textContent = '—';
        setCheckItem('checkModulo', false);
    }

    // 2. Docente
    const docenteObj = docentiList.find(d => d.id_utente === idDocente);
    const valDocente = document.getElementById('valDocente');
    if (docenteObj) {
        valDocente.textContent = `${docenteObj.Nome} ${docenteObj.Cognome}`;
        setCheckItem('checkDocente', true);
    } else {
        valDocente.textContent = '—';
        setCheckItem('checkDocente', false);
    }

    // 3. Giorni & Conteggio lezioni
    const checkedDays = Array.from(document.querySelectorAll('.chk-giorno:checked')).map(c => parseInt(c.value));
    setCheckItem('checkGiorni', checkedDays.length > 0);

    const isDiffActive = document.getElementById('boxOrariDifferenziati').style.display !== 'none';
    const previewTxt = document.getElementById('settimanaPreviewText');
    const valPeriodo = document.getElementById('valPeriodo');

    if (!dInizioStr || !oraInizioDef || !oraFineDef || checkedDays.length === 0) {
        previewTxt.textContent = 'Compila data, orario e giorni per l\'anteprima.';
        valPeriodo.textContent = '—';
        return;
    }

    let nLezioni = 0;
    let nMinutiTotali = 0;

    const startDate = new Date(dInizioStr);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (nWeeks * 7) - 1);

    valPeriodo.textContent = `${nWeeks} settiman${nWeeks === 1 ? 'a' : 'e'} (dal ${formatDate(dInizioStr)})`;

    let curr = new Date(startDate);
    while (curr <= endDate) {
        const wd = (curr.getDay() + 6) % 7; // 0 = Lun, 6 = Dom
        if (checkedDays.includes(wd)) {
            nLezioni++;
            let iStr = oraInizioDef;
            let fStr = oraFineDef;

            if (isDiffActive) {
                if (wd === 1) {
                    iStr = document.getElementById('diffMarInizio').value || oraInizioDef;
                    fStr = document.getElementById('diffMarFine').value || oraFineDef;
                } else if (wd === 3) {
                    iStr = document.getElementById('diffGioInizio').value || oraInizioDef;
                    fStr = document.getElementById('diffGioFine').value || oraFineDef;
                }
            }

            const [hI, mI] = iStr.split(':').map(Number);
            const [hF, mF] = fStr.split(':').map(Number);
            nMinutiTotali += Math.max(0, (hF * 60 + mF) - (hI * 60 + mI));
        }
        curr.setDate(curr.getDate() + 1);
    }

    previewTxt.textContent = `${nLezioni} lezioni per ${minutiToOre(nMinutiTotali)} complessive.`;
}

function setCheckItem(id, valid) {
    const el = document.getElementById(id);
    if (!el) return;
    const icon = el.querySelector('i');
    if (valid) {
        el.classList.add('checked');
        icon.className = 'bi bi-check-circle-fill text-success';
    } else {
        el.classList.remove('checked');
        icon.className = 'bi bi-circle text-muted';
    }
}

// ═══════════════════════════════════════════════════
//  SUBMIT FORM SETTIMANA
// ═══════════════════════════════════════════════════

async function handleSettimanaFormSubmit(e) {
    e.preventDefault();
    hideErrorAlert();

    if (!selectedCorsoAttivo) {
        showErrorAlert('Nessuna edizione di corso selezionata.');
        return;
    }

    const idModulo = parseInt(document.getElementById('settimanaModulo').value);
    const idDocente = parseInt(document.getElementById('settimanaDocente').value);
    const dInizio = document.getElementById('settimanaDataInizio').value;
    const nWeeks = parseInt(document.getElementById('settimanaNumeroSettimane').value || 1);
    const oraInizio = document.getElementById('settimanaOraInizio').value;
    const oraFine = document.getElementById('settimanaOraFine').value;
    const note = document.getElementById('settimanaNote').value.trim();

    if (!idModulo || !idDocente || !dInizio || !oraInizio || !oraFine) {
        showErrorAlert('Compila tutti i campi obbligatori (Modulo, Docente, Data Inizio, Ora Inizio, Ora Fine).');
        return;
    }
    if (oraInizio >= oraFine) {
        showErrorAlert('L\'ora di inizio deve essere precedente all\'ora di fine.');
        return;
    }

    const checkedDays = Array.from(document.querySelectorAll('.chk-giorno:checked')).map(c => parseInt(c.value));
    if (!checkedDays.length) {
        showErrorAlert('Seleziona almeno un giorno della settimana.');
        return;
    }

    const isDiffActive = document.getElementById('boxOrariDifferenziati').style.display !== 'none';
    let orariDiff = null;

    if (isDiffActive) {
        orariDiff = {};
        const marI = document.getElementById('diffMarInizio').value;
        const marF = document.getElementById('diffMarFine').value;
        const gioI = document.getElementById('diffGioInizio').value;
        const gioF = document.getElementById('diffGioFine').value;

        if (marI && marF) {
            orariDiff['1'] = { attivo: checkedDays.includes(1), ora_inizio: `${marI}:00`, ora_fine: `${marF}:00` };
        }
        if (gioI && gioF) {
            orariDiff['3'] = { attivo: checkedDays.includes(3), ora_inizio: `${gioI}:00`, ora_fine: `${gioF}:00` };
        }
    }

    const payload = {
        id_corso_attivo: selectedCorsoAttivo.id_corso_attivo,
        id_modulo: idModulo,
        id_utente: idDocente,
        data_inizio: dInizio,
        numero_settimane: nWeeks,
        ora_inizio_default: `${oraInizio}:00`,
        ora_fine_default: `${oraFine}:00`,
        giorni_attivi: checkedDays,
        orari_differenziati: orariDiff,
        note: note || null
    };

    setLoadingState(true);

    try {
        const res = await fetchAutenticata(`${API_URL}/calendario/settimanale`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errReason = await parseApiError(res);
            showErrorAlert(errReason);
            return;
        }

        const data = await res.json();
        showToast(data.messaggio || `Programmate ${data.lezioni_create} lezioni con successo!`);
        setTimeout(() => {
            window.location.href = `calendario.html?id_corso_attivo=${selectedCorsoAttivo.id_corso_attivo}`;
        }, 800);

    } catch (err) {
        showErrorAlert(err.message || 'Errore durante la connessione al server.');
    } finally {
        setLoadingState(false);
    }
}

// ═══════════════════════════════════════════════════
//  HELPERS UTILI
// ═══════════════════════════════════════════════════

function showErrorAlert(msg) {
    const box = document.getElementById('alertError');
    const txt = document.getElementById('alertErrorText');
    if (!box || !txt) return;
    txt.textContent = msg;
    box.style.setProperty('display', 'flex', 'important');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideErrorAlert() {
    const box = document.getElementById('alertError');
    if (box) box.style.setProperty('display', 'none', 'important');
}

function setLoadingState(loading) {
    const submitBtn = document.getElementById('btnSaveSettimana');
    if (!submitBtn) return;
    const txt = submitBtn.querySelector('.btn-nc-text');
    const spin = submitBtn.querySelector('.btn-nc-loading');

    submitBtn.disabled = loading;
    if (loading) {
        txt.style.display = 'none';
        spin.style.display = 'inline-flex';
    } else {
        txt.style.display = 'inline-flex';
        spin.style.display = 'none';
    }
}

function minutiToOre(min) {
    if (isNaN(min) || min <= 0) return '0h';
    const ore = Math.floor(min / 60);
    const rest = min % 60;
    if (rest === 0) return `${ore}h`;
    return `${ore}h ${rest}m`;
}

function formatDate(isoStr) {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length !== 3) return isoStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

async function parseApiError(res) {
    try {
        const data = await res.json();
        if (typeof data.detail === 'string' && data.detail.trim()) return data.detail;
        if (Array.isArray(data.detail) && data.detail.length > 0) return data.detail.map(d => d.msg || JSON.stringify(d)).join('; ');
        if (data.message) return data.message;
    } catch (e) {}
    return `Errore server (${res.status})`;
}

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = isError ? '#dc2626' : '#16a34a';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}
