// ============================================================
// modifica-corso.js — Gestione pagina Modifica Corso
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const urlParams = new URLSearchParams(window.location.search);
    const idCorso = urlParams.get('id');

    if (!idCorso) {
        alert("Nessun ID corso fornito.");
        window.location.href = "dashboard.html";
        return;
    }

    document.getElementById('editCorsoId').value = idCorso;
    document.getElementById('previewIdBadge').textContent = `ID: #${idCorso}`;

    const nomeInput = document.getElementById('editCorsoNome');
    const descInput = document.getElementById('editCorsoDescrizione');
    const charCount = document.getElementById('charCount');
    const previewTitle = document.getElementById('previewTitle');
    const previewDesc = document.getElementById('previewDesc');
    const checkNome = document.getElementById('checkNome');
    const erroreNome = document.getElementById('erroreNome');
    const submitBtn = document.getElementById('submitBtn');
    const form = document.getElementById('modificaCorsoForm');

    function updatePreview() {
        const nome = nomeInput.value.trim();
        const desc = descInput.value.trim();

        previewTitle.textContent = nome || 'Nome del corso';
        previewDesc.textContent = desc || 'La descrizione del percorso formativo apparirà qui...';
        charCount.textContent = `${descInput.value.length} / 1000`;

        if (nome) {
            checkNome.classList.add('done');
            checkNome.querySelector('i').className = 'bi bi-check-circle-fill';
            erroreNome.textContent = '';
            nomeInput.classList.remove('is-invalid');
        } else {
            checkNome.classList.remove('done');
            checkNome.querySelector('i').className = 'bi bi-circle';
        }
    }

    nomeInput.addEventListener('input', updatePreview);
    descInput.addEventListener('input', updatePreview);

    // Carica dati del corso e conta edizioni
    try {
        const [resCorsi, resEdizioni] = await Promise.all([
            fetchAutenticata(`${API_URL}/corsi/${idCorso}`),
            fetchAutenticata(`${API_URL}/corsi-attivi`)
        ]);

        if (resCorsi.ok) {
            const corso = await resCorsi.json();
            nomeInput.value = corso.Nome || '';
            descInput.value = corso.Descrizione || '';

            if (resEdizioni.ok) {
                const edizioni = await resEdizioni.json();
                const collegate = edizioni.filter(e => e.id_corso == idCorso && !e.archiviato).length;
                document.getElementById('previewEdizioniCount').textContent = `${collegate} edizion${collegate === 1 ? 'e' : 'i'} attiv${collegate === 1 ? 'a' : 'e'}`;
            }

            updatePreview();
        } else {
            alert("Corso non trovato.");
            window.location.href = "dashboard.html";
            return;
        }
    } catch (err) {
        console.error("Errore caricamento corso:", err);
        showToast("Errore durante il caricamento del corso.", true);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = nomeInput.value.trim();
        const desc = descInput.value.trim();

        if (!nome) {
            nomeInput.classList.add('is-invalid');
            erroreNome.textContent = 'Il nome del corso è obbligatorio.';
            nomeInput.focus();
            return;
        }

        const btnText = submitBtn.querySelector('.btn-nc-text');
        const btnLoading = submitBtn.querySelector('.btn-nc-loading');
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';

        try {
            const res = await fetchAutenticata(`${API_URL}/corsi/${idCorso}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Nome: nome, Descrizione: desc || null })
            });

            if (res.ok) {
                showToast("Corso aggiornato con successo!");
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 800);
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.detail || "Errore durante l'aggiornamento.", true);
                submitBtn.disabled = false;
                btnText.style.display = 'flex';
                btnLoading.style.display = 'none';
            }
        } catch (err) {
            showToast("Errore di connessione con il server.", true);
            submitBtn.disabled = false;
            btnText.style.display = 'flex';
            btnLoading.style.display = 'none';
        }
    });
});

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.backgroundColor = isError ? 'var(--danger)' : 'var(--success)';
    toast.className = 'toast show';
    setTimeout(() => {
        toast.className = toast.className.replace('show', '');
    }, 3000);
}
