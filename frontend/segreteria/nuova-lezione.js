// ═══════════════════════════════════════════════════
//  NUOVA-LEZIONE.JS — Standalone Lesson Form
// ═══════════════════════════════════════════════════

let selectedCorsoAttivo = null;
let currentLezioneId = null;
let moduliList = [];
let unitaFormativeList = [];
let pianostudioList = [];
let docentiList = [];
let lezioniCorso = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica autenticazione
    if (typeof checkAuth === 'function' && !checkAuth()) return;

    // 2. Parsa parametri URL
    const urlParams = new URLSearchParams(window.location.search);
    const idCorsoAttivo = urlParams.get('id_corso_attivo');
    currentLezioneId = urlParams.get('id_lezione');
    const presetData = urlParams.get('data');
    const presetOraInizio = urlParams.get('ora_inizio');
    const presetOraFine = urlParams.get('ora_fine');

    if (!idCorsoAttivo) {
        showToast('Nessuna edizione selezionata. Reindirizzamento...', true);
        setTimeout(() => window.location.href = 'calendario.html', 1500);
        return;
    }

    document.getElementById('hiddenCorsoAttivoId').value = idCorsoAttivo;
    const backUrl = `calendario.html?id_corso_attivo=${idCorsoAttivo}`;
    document.getElementById('btnBackToCalendario').href = backUrl;

    try {
        // 3. Carica dati in parallelo
        await Promise.all([
            loadCorsoAttivo(idCorsoAttivo),
            loadDocenti(),
            loadModuliEUnita(),
            loadPianoStudio(idCorsoAttivo),
            loadLezioniEsistenti(idCorsoAttivo)
        ]);

        // 4. Popola dropdown moduli (filtrati per piano studio)
        populateModuliSelect();

        // 5. Configura form in base a CREAZIONE o MODIFICA
        if (currentLezioneId) {
            await setupEditMode(currentLezioneId);
        } else {
            setupCreateMode({ data: presetData, ora_inizio: presetOraInizio, ora_fine: presetOraFine });
        }

        // 6. Setup event listener
        attachEventListeners();
        updatePreview();

    } catch (err) {
        console.error('Errore inizializzazione pagina lezione:', err);
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

    // Aggiorna context strip
    const nomeCorso = selectedCorsoAttivo.corso?.Nome || `Corso #${selectedCorsoAttivo.id_corso}`;
    const edNome = selectedCorsoAttivo.nome_edizione || `Edizione #${selectedCorsoAttivo.id_corso_attivo}`;
    const dInizio = selectedCorsoAttivo.data_inizio ? formatDate(selectedCorsoAttivo.data_inizio) : 'N/D';
    const dFine = selectedCorsoAttivo.data_fine ? formatDate(selectedCorsoAttivo.data_fine) : 'N/D';

    document.getElementById('contextEdizioneName').textContent = `${nomeCorso} - ${edNome}`;
    document.getElementById('contextDateRange').textContent = `Periodo: dal ${dInizio} al ${dFine}`;

    // Aggiorna badges anteprima
    document.getElementById('previewCorsoNome').textContent = nomeCorso;
    document.getElementById('previewEdizioneBadge').textContent = edNome;

    // Setting min/max su data input
    const inputData = document.getElementById('inputData');
    if (selectedCorsoAttivo.data_inizio) inputData.min = selectedCorsoAttivo.data_inizio;
    if (selectedCorsoAttivo.data_fine) inputData.max = selectedCorsoAttivo.data_fine;
}

async function loadDocenti() {
    const res = await fetchAutenticata(`${API_URL}/users`);
    if (!res.ok) return;
    const allUsers = await res.json();

    let ruoliMap = { 1: 'admin', 2: 'segreteria', 3: 'docente', 4: 'studente' };
    docentiList = allUsers.filter(u => {
        const rNome = (u.ruolo?.Nome || ruoliMap[u.id_ruolo] || '').toLowerCase().trim();
        return rNome.includes('docente') || rNome.includes('prof');
    });
    if (!docentiList.length) docentiList = allUsers;

    const select = document.getElementById('selectDocente');
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

async function loadLezioniEsistenti(idCorsoAttivo) {
    try {
        const res = await fetchAutenticata(`${API_URL}/calendario?id_corso_attivo=${idCorsoAttivo}`);
        if (res.ok) lezioniCorso = await res.json();
    } catch (e) {
        lezioniCorso = [];
    }
}

function populateModuliSelect() {
    const select = document.getElementById('selectModulo');
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
//  SETUP MODALITA CREAZIONE / MODIFICA
// ═══════════════════════════════════════════════════

function setupCreateMode(presets = {}) {
    document.getElementById('pageTitleText').textContent = 'Programma Nuova Lezione';
    document.getElementById('pageSubtitleText').textContent = 'Compila i dettagli per inserire una nuova lezione nel calendario didattico.';
    document.getElementById('formCardTitle').textContent = 'Nuova Lezione';
    document.getElementById('breadcrumbLabel').textContent = 'Programma Lezione';
    document.getElementById('pageHeaderBreadcrumb').textContent = 'Programma Lezione';

    document.getElementById('btnDelete').style.display = 'none';

    // Set default values
    const defaultData = presets.data || selectedCorsoAttivo?.data_inizio || new Date().toISOString().split('T')[0];
    document.getElementById('inputData').value = defaultData;
    document.getElementById('inputOraInizio').value = presets.ora_inizio || '09:00';
    document.getElementById('inputOraFine').value = presets.ora_fine || '13:00';
}

async function setupEditMode(idLezione) {
    document.getElementById('pageTitleText').textContent = `Modifica Lezione #${idLezione}`;
    document.getElementById('pageSubtitleText').textContent = 'Aggiorna gli orari, il docente o le note per questa lezione.';
    document.getElementById('formCardTitle').textContent = `Modifica Lezione #${idLezione}`;
    document.getElementById('breadcrumbLabel').textContent = `Modifica Lezione #${idLezione}`;
    document.getElementById('pageHeaderBreadcrumb').textContent = `Modifica Lezione #${idLezione}`;

    const btnDel = document.getElementById('btnDelete');
    btnDel.style.display = 'inline-flex';
    btnDel.addEventListener('click', handleDeleteLezione);

    const me = lezioniCorso.find(l => l.id == idLezione);
    if (me) {
        document.getElementById('lezioneId').value = me.id;
        document.getElementById('selectModulo').value = me.id_modulo || '';
        document.getElementById('selectDocente').value = me.id_utente || '';
        document.getElementById('inputData').value = me.data || '';
        document.getElementById('inputOraInizio').value = (me.ora_inizio || '').substring(0, 5);
        document.getElementById('inputOraFine').value = (me.ora_fine || '').substring(0, 5);
        document.getElementById('inputNote').value = me.note || '';
    } else {
        // Fetch singola da API se non trovata in lista
        try {
            const res = await fetchAutenticata(`${API_URL}/calendario/${idLezione}`);
            if (res.ok) {
                const data = await res.json();
                document.getElementById('lezioneId').value = data.id;
                document.getElementById('selectModulo').value = data.id_modulo || '';
                document.getElementById('selectDocente').value = data.id_utente || '';
                document.getElementById('inputData').value = data.data || '';
                document.getElementById('inputOraInizio').value = (data.ora_inizio || '').substring(0, 5);
                document.getElementById('inputOraFine').value = (data.ora_fine || '').substring(0, 5);
                document.getElementById('inputNote').value = data.note || '';
            }
        } catch (e) {}
    }
}

// ═══════════════════════════════════════════════════
//  CALCOLI & PREVIEW IN TEMPO REALE
// ═══════════════════════════════════════════════════

function attachEventListeners() {
    const inputs = ['selectModulo', 'selectDocente', 'inputData', 'inputOraInizio', 'inputOraFine', 'inputNote'];
    inputs.forEach(id => {
        document.getElementById(id)?.addEventListener('change', updatePreview);
        document.getElementById(id)?.addEventListener('input', updatePreview);
    });

    document.getElementById('lezioneForm').addEventListener('submit', handleSubmit);
}

function updatePreview() {
    hideErrorAlert();

    const idModulo = parseInt(document.getElementById('selectModulo').value);
    const idDocente = parseInt(document.getElementById('selectDocente').value);
    const dataLezione = document.getElementById('inputData').value;
    const oraInizio = document.getElementById('inputOraInizio').value;
    const oraFine = document.getElementById('inputOraFine').value;

    // 1. Modulo e Budget Info
    const moduloObj = moduliList.find(m => m.id_modulo === idModulo);
    const previewModulo = document.getElementById('previewModuloNome');
    const budgetInfoBox = document.getElementById('budgetInfoBox');

    if (moduloObj) {
        previewModulo.textContent = moduloObj.Nome;
        setCheckItem('checkModulo', true);

        // Budget UF calculation
        const ps = pianostudioList.find(p => p.id_unita_formativa === moduloObj.id_unita_formativa);
        if (ps && ps.ore_dedicate > 0) {
            const orePianificate = computeOrePianificatePerUf(ps.id_unita_formativa);
            const budgetMin = ps.ore_dedicate * 60;
            const perc = Math.min((orePianificate / budgetMin) * 100, 100);

            document.getElementById('budgetLabel').textContent = `Budget UF: ${ps.uf_nome || 'UF'}`;
            document.getElementById('budgetValue').textContent = `${minutiToOre(orePianificate)} / ${ps.ore_dedicate}h`;
            const bar = document.getElementById('budgetBar');
            bar.style.width = `${perc}%`;
            bar.className = `progress-bar ${perc >= 100 ? 'bg-danger' : perc >= 80 ? 'bg-warning' : 'bg-success'}`;
            budgetInfoBox.style.display = 'block';
        } else {
            budgetInfoBox.style.display = 'none';
        }
    } else {
        previewModulo.textContent = '—';
        setCheckItem('checkModulo', false);
        budgetInfoBox.style.display = 'none';
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

    // 3. Durata & Data Orario
    const dataOrarioVal = document.getElementById('previewDataOrario');
    const valDurata = document.getElementById('valDurata');
    const durataInfo = document.getElementById('durataInfo');
    const durataText = document.getElementById('durataText');

    if (oraInizio && oraFine) {
        const [hI, mI] = oraInizio.split(':').map(Number);
        const [hF, mF] = oraFine.split(':').map(Number);
        const diffMin = (hF * 60 + mF) - (hI * 60 + mI);

        if (diffMin > 0) {
            valDurata.textContent = minutiToOre(diffMin);
            durataText.textContent = `Durata lezione: ${minutiToOre(diffMin)}`;
            durataInfo.style.setProperty('display', 'flex', 'important');

            if (dataLezione) {
                dataOrarioVal.textContent = `${formatDate(dataLezione)} dalle ${oraInizio} alle ${oraFine}`;
                setCheckItem('checkData', true);
            } else {
                dataOrarioVal.textContent = `Dalle ${oraInizio} alle ${oraFine}`;
                setCheckItem('checkData', false);
            }
        } else {
            valDurata.textContent = 'Non valida';
            durataInfo.style.setProperty('display', 'none', 'important');
            setCheckItem('checkData', false);
        }
    } else {
        valDurata.textContent = '—';
        durataInfo.style.setProperty('display', 'none', 'important');
        setCheckItem('checkData', false);
    }
}

function computeOrePianificatePerUf(idUf) {
    let totaleMin = 0;
    lezioniCorso.forEach(l => {
        // Se stiamo modificando questa lezione, non la contiamo nel totale già pianificato
        if (currentLezioneId && l.id == currentLezioneId) return;

        const mod = moduliList.find(m => m.id_modulo === l.id_modulo);
        if (mod && mod.id_unita_formativa === idUf) {
            const [hI, mI] = (l.ora_inizio || '00:00').split(':').map(Number);
            const [hF, mF] = (l.ora_fine   || '00:00').split(':').map(Number);
            totaleMin += (hF * 60 + mF) - (hI * 60 + mI);
        }
    });
    return totaleMin;
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
//  SUBMIT FORM LEZIONE
// ═══════════════════════════════════════════════════

async function handleSubmit(e) {
    e.preventDefault();
    hideErrorAlert();

    const idModulo = parseInt(document.getElementById('selectModulo').value);
    const idDocente = parseInt(document.getElementById('selectDocente').value);
    const dataLezione = document.getElementById('inputData').value;
    const oraInizio = document.getElementById('inputOraInizio').value;
    const oraFine = document.getElementById('inputOraFine').value;
    const note = document.getElementById('inputNote').value.trim();

    // Validazioni client
    if (!idModulo || !idDocente || !dataLezione || !oraInizio || !oraFine) {
        showErrorAlert('Compila tutti i campi obbligatori (Modulo, Docente, Data, Ora Inizio, Ora Fine).');
        return;
    }
    if (oraInizio >= oraFine) {
        showErrorAlert(`L'ora di inizio (${oraInizio}) deve essere precedente all'ora di fine (${oraFine}).`);
        return;
    }

    if (selectedCorsoAttivo) {
        if (selectedCorsoAttivo.data_inizio && dataLezione < selectedCorsoAttivo.data_inizio) {
            showErrorAlert(`La data della lezione (${formatDate(dataLezione)}) precede l'inizio del corso (${formatDate(selectedCorsoAttivo.data_inizio)}).`);
            return;
        }
        if (selectedCorsoAttivo.data_fine && dataLezione > selectedCorsoAttivo.data_fine) {
            showErrorAlert(`La data della lezione (${formatDate(dataLezione)}) supera la fine del corso (${formatDate(selectedCorsoAttivo.data_fine)}).`);
            return;
        }
    }

    // Budget warning
    const moduloObj = moduliList.find(m => m.id_modulo === idModulo);
    if (moduloObj) {
        const ps = pianostudioList.find(p => p.id_unita_formativa === moduloObj.id_unita_formativa);
        if (ps && ps.ore_dedicate > 0) {
            const budgetMin = ps.ore_dedicate * 60;
            const usatiMin = computeOrePianificatePerUf(ps.id_unita_formativa);
            const [hI, mI] = oraInizio.split(':').map(Number);
            const [hF, mF] = oraFine.split(':').map(Number);
            const nuovaDurataMin = (hF * 60 + mF) - (hI * 60 + mI);

            if ((usatiMin + nuovaDurataMin) > budgetMin) {
                const superamentoMin = (usatiMin + nuovaDurataMin) - budgetMin;
                showErrorAlert(`Superamento budget ore! L'Unità Formativa ha un budget massimo di ${ps.ore_dedicate}h. Con questa lezione supereresti il limite di ${minutiToOre(superamentoMin)}.`);
                return;
            }
        }
    }

    const payload = {
        data: dataLezione,
        ora_inizio: `${oraInizio}:00`,
        ora_fine: `${oraFine}:00`,
        id_modulo: idModulo,
        id_utente: idDocente,
        id_corso_attivo: selectedCorsoAttivo.id_corso_attivo,
        note: note || null
    };

    const isEdit = !!currentLezioneId;
    const url = isEdit ? `${API_URL}/calendario/${currentLezioneId}` : `${API_URL}/calendario`;
    const method = isEdit ? 'PUT' : 'POST';

    setLoadingState(true);

    try {
        const res = await fetchAutenticata(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errReason = await parseApiError(res);
            showErrorAlert(errReason);
            return;
        }

        showToast(isEdit ? 'Lezione aggiornata con successo!' : 'Lezione programmata con successo!');
        setTimeout(() => {
            window.location.href = `calendario.html?id_corso_attivo=${selectedCorsoAttivo.id_corso_attivo}`;
        }, 800);

    } catch (err) {
        showErrorAlert(err.message || 'Errore di connessione al server.');
    } finally {
        setLoadingState(false);
    }
}

// ═══════════════════════════════════════════════════
//  ELIMINAZIONE LEZIONE
// ═══════════════════════════════════════════════════

async function handleDeleteLezione() {
    if (!currentLezioneId) return;
    if (!confirm('Sei sicuro di voler eliminare questa lezione dal calendario?')) return;

    try {
        const res = await fetchAutenticata(`${API_URL}/calendario/${currentLezioneId}`, { method: 'DELETE' });
        if (!res.ok) {
            const errReason = await parseApiError(res);
            showErrorAlert(errReason);
            return;
        }
        showToast('Lezione eliminata con successo.');
        setTimeout(() => {
            window.location.href = `calendario.html?id_corso_attivo=${selectedCorsoAttivo.id_corso_attivo}`;
        }, 800);
    } catch (err) {
        showErrorAlert(err.message || 'Errore durante l\'eliminazione della lezione.');
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
    const submitBtn = document.getElementById('submitBtn');
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
    return `${parts[2]}/${parts[1]}/${parts[4] ? parts[0] : parts[0]}`;
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
