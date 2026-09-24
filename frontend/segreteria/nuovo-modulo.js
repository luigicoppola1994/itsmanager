// ============================================================
// nuovo-modulo.js — Creazione e Modifica Modulo Didattico
// ============================================================

let unitaFormativeList = [];
let isEditMode = false;
let currentModuloId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Carica Unità Formative
    await loadUnitaFormative();

    // Gestione Query Params
    const urlParams = new URLSearchParams(window.location.search);
    const moduloId = urlParams.get('id');
    const ufIdParam = urlParams.get('uf_id');

    if (moduloId) {
        await initEditMode(moduloId);
    } else {
        initCreateMode(ufIdParam);
    }

    // Live preview
    setupLivePreview();

    // Form submit
    const form = document.getElementById('moduloForm');
    if (form) form.addEventListener('submit', handleSubmit);
});

async function loadUnitaFormative() {
    const select = document.getElementById('moduloUfSelect');
    try {
        const res = await fetchAutenticata(`${API_URL}/unita_formative`);
        if (!res.ok) throw new Error('Errore recupero UF');

        unitaFormativeList = await res.json();
        select.innerHTML = '<option value="">-- Seleziona Unità Formativa --</option>';

        unitaFormativeList.forEach(uf => {
            const opt = document.createElement('option');
            opt.value = uf.id_unita_formativa;
            opt.textContent = `UF #${uf.id_unita_formativa} - ${uf.Nome}`;
            select.appendChild(opt);
        });

    } catch (e) {
        console.error(e);
        select.innerHTML = '<option value="">Errore nel caricamento delle UF</option>';
        showToast('Impossibile caricare le Unità Formative.', true);
    }
}

function initCreateMode(preselectedUfId) {
    isEditMode = false;
    currentModuloId = null;

    document.getElementById('pageTitleText').textContent = 'Crea Nuovo Modulo Didattico';
    document.getElementById('pageSubtitleText').textContent = 'Aggiungi una materia o modulo didattico assegnandolo alla relativa Unità Formativa.';
    document.getElementById('cardHeaderTitle').textContent = 'Informazioni Nuovo Modulo';
    document.getElementById('btnSubmitText').innerHTML = '<i class="bi bi-check2-circle"></i> Salva Modulo';
    document.getElementById('previewModuloBadge').textContent = 'ID #NUOVO';

    if (preselectedUfId) {
        const select = document.getElementById('moduloUfSelect');
        if (select) select.value = preselectedUfId;
    }
    updatePreview();
}

async function initEditMode(id) {
    isEditMode = true;
    currentModuloId = id;
    document.getElementById('moduloId').value = id;

    document.getElementById('pageTitleText').textContent = 'Modifica Modulo Didattico';
    document.getElementById('pageSubtitleText').textContent = `Aggiorna i dettagli del modulo #${id}.`;
    document.getElementById('cardHeaderTitle').textContent = `Modifica Modulo #${id}`;
    document.getElementById('topNavCurrent').textContent = `Modifica Modulo #${id}`;
    document.getElementById('breadcrumbAction').textContent = `Modifica Modulo #${id}`;
    document.getElementById('btnSubmitText').innerHTML = '<i class="bi bi-check2-circle"></i> Salva Modifiche';
    document.getElementById('previewModuloBadge').textContent = `ID #${id}`;

    try {
        const res = await fetchAutenticata(`${API_URL}/moduli/${id}`);
        if (!res.ok) {
            showToast('Modulo non trovato.', true);
            setTimeout(() => window.location.href = 'piano-didattico.html', 1500);
            return;
        }

        const modulo = await res.json();
        document.getElementById('moduloNome').value = modulo.Nome || '';
        document.getElementById('moduloDescrizione').value = modulo.Descrizione || '';
        document.getElementById('moduloUfSelect').value = modulo.id_unita_formativa || '';

        updatePreview();
    } catch (e) {
        console.error(e);
        showToast('Errore nel caricamento del modulo.', true);
    }
}

function setupLivePreview() {
    const nomeInput = document.getElementById('moduloNome');
    const descInput = document.getElementById('moduloDescrizione');
    const ufSelect  = document.getElementById('moduloUfSelect');

    nomeInput?.addEventListener('input', updatePreview);
    descInput?.addEventListener('input', updatePreview);
    ufSelect?.addEventListener('change', updatePreview);
}

function updatePreview() {
    const nome = document.getElementById('moduloNome')?.value.trim();
    const desc = document.getElementById('moduloDescrizione')?.value.trim();
    const ufId = document.getElementById('moduloUfSelect')?.value;

    const titleEl = document.getElementById('previewModuloTitle');
    const descEl  = document.getElementById('previewModuloDesc');
    const ufBadge = document.getElementById('previewUfBadge');

    if (titleEl) titleEl.textContent = nome || 'Nome Modulo Didattico';
    if (descEl)  descEl.textContent  = desc || 'Nessuna descrizione del programma specificata.';

    if (ufBadge) {
        if (ufId) {
            const foundUf = unitaFormativeList.find(x => x.id_unita_formativa == ufId);
            ufBadge.textContent = foundUf ? foundUf.Nome : `UF #${ufId}`;
        } else {
            ufBadge.textContent = 'UF non assegnata';
        }
    }

    // Checklist
    document.getElementById('checkUf')?.classList.toggle('filled', !!ufId);
    document.getElementById('checkNome')?.classList.toggle('filled', !!nome);
    document.getElementById('checkDesc')?.classList.toggle('filled', !!desc);
}

async function handleSubmit(e) {
    e.preventDefault();

    const ufId = document.getElementById('moduloUfSelect')?.value;
    const nome = document.getElementById('moduloNome')?.value.trim();
    const desc = document.getElementById('moduloDescrizione')?.value.trim();

    const errUf = document.getElementById('errUf');
    const errNome = document.getElementById('errNome');

    if (errUf) errUf.textContent = '';
    if (errNome) errNome.textContent = '';

    let hasErrors = false;

    if (!ufId) {
        if (errUf) errUf.textContent = 'Seleziona un\'Unità Formativa.';
        hasErrors = true;
    }

    if (!nome) {
        if (errNome) errNome.textContent = 'Il nome del modulo è obbligatorio.';
        hasErrors = true;
    }

    if (hasErrors) return;

    const btnSubmit = document.getElementById('btnSubmitModulo');
    const btnText = document.getElementById('btnSubmitText');
    const btnLoading = document.getElementById('btnSubmitLoading');

    btnSubmit.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'flex';

    const payload = {
        Nome: nome,
        Descrizione: desc || null,
        id_unita_formativa: parseInt(ufId)
    };

    try {
        const url = isEditMode ? `${API_URL}/moduli/${currentModuloId}` : `${API_URL}/moduli`;
        const method = isEditMode ? 'PUT' : 'POST';

        const res = await fetchAutenticata(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Errore durante il salvataggio.');
        }

        showToast(isEditMode ? 'Modulo aggiornato con successo!' : 'Modulo creato con successo!');
        setTimeout(() => {
            window.location.href = 'piano-didattico.html';
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