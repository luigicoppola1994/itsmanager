// ============================================================
// gestione-aula.js — Gestione pagina Aula & Studenti Edizione
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const urlParams = new URLSearchParams(window.location.search);
    const idEdizione = urlParams.get('id');

    if (!idEdizione) {
        alert("Nessun ID edizione specificato.");
        window.location.href = "dashboard.html";
        return;
    }

    document.getElementById('aulaEdizioneId').value = idEdizione;

    const listEl = document.getElementById('aulaStudentiList');
    const searchInput = document.getElementById('aulaSearchInput');
    const btnSelectAll = document.getElementById('btnAulaSelectAll');
    const btnDeselectAll = document.getElementById('btnAulaDeselectAll');
    const btnSaveAula = document.getElementById('btnSaveAula');

    const previewEdizioneTitle = document.getElementById('previewEdizioneTitle');
    const previewCorsoNome = document.getElementById('previewCorsoNome');
    const previewEdizioneBadge = document.getElementById('previewEdizioneBadge');
    const previewDatesVal = document.getElementById('previewDatesVal');
    const previewStudentiAssegnati = document.getElementById('previewStudentiAssegnati');
    const previewStudentiNonAssegnati = document.getElementById('previewStudentiNonAssegnati');
    const valTotStudentiSistema = document.getElementById('valTotStudentiSistema');
    const checkAlmenoUnoStudente = document.getElementById('checkAlmenoUnoStudente');

    let allStudenti = [];
    let aulaIds = new Set();

    function updateMetrics() {
        const assignedCount = aulaIds.size;
        const totalCount = allStudenti.length;
        const notAssignedCount = totalCount - assignedCount;

        const countBadge = document.getElementById('aulaStudentiCountBadge');
        if (countBadge) {
            countBadge.innerHTML = `<i class="bi bi-person-check-fill me-1"></i> ${assignedCount} Student${assignedCount === 1 ? 'e' : 'i'} Assegnat${assignedCount === 1 ? 'o' : 'i'}`;
        }

        previewStudentiAssegnati.textContent = assignedCount;
        previewStudentiNonAssegnati.textContent = Math.max(0, notAssignedCount);
        valTotStudentiSistema.textContent = totalCount;

        if (checkAlmenoUnoStudente) {
            if (assignedCount > 0) {
                checkAlmenoUnoStudente.classList.add('done');
                checkAlmenoUnoStudente.querySelector('i').className = 'bi bi-check-circle-fill';
            } else {
                checkAlmenoUnoStudente.classList.remove('done');
                checkAlmenoUnoStudente.querySelector('i').className = 'bi bi-circle';
            }
        }
    }

    function renderList(studenti) {
        if (!studenti.length) {
            listEl.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-person-x fs-2 d-block mb-2"></i>Nessuno studente trovato</div>';
            return;
        }

        listEl.innerHTML = studenti.map(s => {
            const isChecked = aulaIds.has(s.id_utente);
            return `
                <label class="aula-student-row ${isChecked ? 'is-selected' : ''}" for="chkAula_${s.id_utente}">
                    <div class="user-avatar-sm" style="width:34px;height:34px;border-radius:50%;background:#e0e7ff;color:#4338ca;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;flex-shrink:0;">
                        ${(s.Nome || '').charAt(0)}${(s.Cognome || '').charAt(0)}
                    </div>
                    <div class="aula-student-info">
                        <span class="aula-student-name">${s.Cognome} ${s.Nome}</span>
                        <span class="aula-student-email">${s.Email || ''}</span>
                    </div>
                    <input class="chk-aula-studente" type="checkbox" id="chkAula_${s.id_utente}" value="${s.id_utente}" ${isChecked ? 'checked' : ''}>
                </label>
            `;
        }).join('');

        listEl.querySelectorAll('.chk-aula-studente').forEach(chk => {
            chk.addEventListener('change', function() {
                const sId = parseInt(this.value);
                const row = this.closest('.aula-student-row');
                if (this.checked) {
                    aulaIds.add(sId);
                    if (row) row.classList.add('is-selected');
                } else {
                    aulaIds.delete(sId);
                    if (row) row.classList.remove('is-selected');
                }
                updateMetrics();
            });
        });
    }

    function filterStudents() {
        const q = searchInput.value.toLowerCase().trim();
        const filtered = q
            ? allStudenti.filter(s =>
                (s.Cognome && s.Cognome.toLowerCase().includes(q)) ||
                (s.Nome && s.Nome.toLowerCase().includes(q)) ||
                (s.Email && s.Email.toLowerCase().includes(q))
              )
            : allStudenti;
        renderList(filtered);
    }

    searchInput.addEventListener('input', filterStudents);

    btnSelectAll.addEventListener('click', () => {
        allStudenti.forEach(s => aulaIds.add(s.id_utente));
        filterStudents();
        updateMetrics();
    });

    btnDeselectAll.addEventListener('click', () => {
        aulaIds.clear();
        filterStudents();
        updateMetrics();
    });

    // Carica dati
    try {
        const [resEdiz, resCorsi, resStudenti, resAula] = await Promise.all([
            fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}`),
            fetchAutenticata(`${API_URL}/corsi`),
            fetchAutenticata(`${API_URL}/studenti`),
            fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}/aula`)
        ]);

        if (!resEdiz.ok) {
            alert("Edizione non trovata.");
            window.location.href = "dashboard.html";
            return;
        }

        const edizData = await resEdiz.json();
        const corsiData = resCorsi.ok ? await resCorsi.json() : [];
        allStudenti = resStudenti.ok ? await resStudenti.json() : [];
        const aulaData = resAula.ok ? await resAula.json() : [];

        // Ordina studenti alfabeticamente per Cognome
        allStudenti.sort((a, b) => (a.Cognome || '').localeCompare(b.Cognome || ''));

        aulaIds = new Set(aulaData.map(s => s.id_utente));

        const corso = corsiData.find(c => c.id_corso === edizData.id_corso);
        const edizLabel = edizData.etichetta || `Edizione #${idEdizione}`;

        previewEdizioneTitle.textContent = edizLabel;
        previewCorsoNome.textContent = corso ? corso.Nome : 'Corso';
        previewEdizioneBadge.textContent = `ID #${idEdizione}`;
        document.getElementById('headerBreadcrumbCurrent').textContent = `Aula: ${edizLabel}`;

        if (edizData.data_inizio && edizData.data_fine) {
            const dI = new Date(edizData.data_inizio).toLocaleDateString('it-IT');
            const dF = new Date(edizData.data_fine).toLocaleDateString('it-IT');
            previewDatesVal.textContent = `${dI} → ${dF}`;
        }

        renderList(allStudenti);
        updateMetrics();

    } catch (err) {
        console.error("Errore caricamento aula:", err);
        listEl.innerHTML = '<div class="text-danger text-center py-4">Errore durante il recupero dei dati.</div>';
        showToast("Errore durante il recupero dei dati aula.", true);
    }

    // Salvataggio
    btnSaveAula.addEventListener('click', async () => {
        const checkedIds = Array.from(aulaIds);

        const btnText = btnSaveAula.querySelector('.btn-nc-text');
        const btnLoading = btnSaveAula.querySelector('.btn-nc-loading');
        btnSaveAula.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';

        try {
            const res = await fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}/aula`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studenti_ids: checkedIds })
            });

            if (res.ok) {
                showToast(`Aula aggiornata con successo (${checkedIds.length} student${checkedIds.length === 1 ? 'e' : 'i'}).`);
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 800);
            } else {
                const err = await res.json().catch(() => ({}));
                showToast(err.detail || "Errore durante il salvataggio dell'aula.", true);
                btnSaveAula.disabled = false;
                btnText.style.display = 'flex';
                btnLoading.style.display = 'none';
            }
        } catch (err) {
            showToast("Errore di rete durante il salvataggio.", true);
            btnSaveAula.disabled = false;
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
