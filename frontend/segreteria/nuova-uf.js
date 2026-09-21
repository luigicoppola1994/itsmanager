// ============================================================
// nuova-uf.js — Creazione e Modifica Unità Formativa
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Gestione Query String per Modalità Modifica
    const urlParams = new URLSearchParams(window.location.search);
    const ufId = urlParams.get('id');

    if (ufId) {
        await initEditMode(ufId);
    } else {
        initCreateMode();
    }

    // Live preview
    setupLivePreview();

    // Form submit
    const form = document.getElementById('ufForm');
    if (form) form.addEventListener('submit', handleSubmit);
});

let isEditMode = false;
let currentUfId = null;

function initCreateMode() {
    isEditMode = false;
    currentUfId = null;
    document.getElementById('pageTitleText').textContent = 'Crea Nuova Unità Formativa';
    document.getElementById('pageSubtitleText').textContent = 'Definisci una macro-area formativa per raggruppare i moduli di competenza didattica.';
    document.getElementById('cardHeaderTitle').textContent = 'Informazioni Nuova Unità Formativa';
    document.getElementById('btnSubmitText').innerHTML = '<i class="bi bi-check2-circle"></i> Salva Unità Formativa';
    document.getElementById('previewUfBadge').textContent = 'UF #NUOVA';
}

async function initEditMode(id) {
    isEditMode = true;
    currentUfId = id;
    document.getElementById('ufId').value = id;

    document.getElementById('pageTitleText').textContent = 'Modifica Unità Formativa';
    document.getElementById('pageSubtitleText').textContent = `Aggiorna i dettagli dell'Unità Formativa #${id}.`;
    document.getElementById('cardHeaderTitle').textContent = `Modifica Unità Formativa #${id}`;
    document.getElementById('topNavCurrent').textContent = `Modifica UF #${id}`;
    document.getElementById('breadcrumbAction').textContent = `Modifica UF #${id}`;
    document.getElementById('btnSubmitText').innerHTML = '<i class="bi bi-check2-circle"></i> Salva Modifiche';
    document.getElementById('previewUfBadge').textContent = `UF #${id}`;

    try {
        const res = await fetchAutenticata(`${API_URL}/unita_formative/${id}`);
        if (!res.ok) {
            showToast('Unità formativa non trovata.', true);
            setTimeout(() => window.location.href = 'piano-didattico.html', 1500);
            return;
        }

        const uf = await res.json();
        document.getElementById('ufNome').value = uf.Nome || '';
        document.getElementById('ufDescrizione').value = uf.Descrizione || '';

        updatePreview();
    } catch (e) {
        console.error(e);
        showToast('Errore nel caricamento dell\'unità formativa.', true);
    }
}

function setupLivePreview() {
    const nomeInput = document.getElementById('ufNome');
    const descInput = document.getElementById('ufDescrizione');

    nomeInput?.addEventListener('input', updatePreview);
    descInput?.addEventListener('input', updatePreview);
}

function updatePreview() {
    const nome = document.getElementById('ufNome')?.value.trim();
    const desc = document.getElementById('ufDescrizione')?.value.trim();

    const titleEl = document.getElementById('previewUfTitle');
    const descEl = document.getElementById('previewUfDesc');

    if (titleEl) {
        titleEl.textContent = nome || 'Titolo Unità Formativa';
    }
    if (descEl) {
        descEl.textContent = desc || 'Nessuna descrizione inserita.';
    }

    // Checklist
    const checkNome = document.getElementById('checkNome');
    const checkDesc = document.getElementById('checkDesc');

    if (checkNome) {
        checkNome.classList.toggle('filled', !!nome);
    }
    if (checkDesc) {
        checkDesc.classList.toggle('filled', !!desc);
    }
}

async function handleSubmit(e) {
    e.preventDefault();

    const nome = document.getElementById('ufNome')?.value.trim();
    const desc = document.getElementById('ufDescrizione')?.value.trim();
    const errNome = document.getElementById('errNome');

    if (errNome) errNome.textContent = '';

    if (!nome) {
        if (errNome) errNome.textContent = 'Il nome dell\'unità formativa è obbligatorio.';
        document.getElementById('ufNome')?.focus();
        return;
    }

    const btnSubmit = document.getElementById('btnSubmitUf');
    const btnText = document.getElementById('btnSubmitText');
    const btnLoading = document.getElementById('btnSubmitLoading');

    btnSubmit.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'flex';

    const payload = {
        Nome: nome,
        Descrizione: desc || null
    };

    try {
        const url = isEditMode ? `${API_URL}/unita_formative/${currentUfId}` : `${API_URL}/unita_formative`;
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

        showToast(isEditMode ? 'Unità Formativa aggiornata con successo!' : 'Unità Formativa creata con successo!');
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