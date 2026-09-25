// ============================================================
// modifica-edizione.js — Gestione pagina Modifica Edizione Corso
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

    // Elementi DOM Form
    const form = document.getElementById('modificaEdizioneForm');
    const idInput = document.getElementById('editEdizioneId');
    const idCorsoInput = document.getElementById('editEdizioneIdCorso');
    const etichettaInput = document.getElementById('editEdizioneEtichetta');
    const dataInizio = document.getElementById('editEdizioneDataInizio');
    const dataFine = document.getElementById('editEdizioneDataFine');
    const oreTeoria = document.getElementById('editEdizioneOreTeoria');
    const oreStage = document.getElementById('editEdizioneOreStage');
    const durataOre = document.getElementById('editEdizioneDurataOre');
    const percAssenza = document.getElementById('editEdizionePercAssenza');
    const tollIngresso = document.getElementById('editEdizioneTollIngresso');
    const tollUscita = document.getElementById('editEdizioneTollUscita');
    const submitBtn = document.getElementById('submitBtn');

    // Elementi Anteprima
    const previewCorsoNome = document.getElementById('previewCorsoNome');
    const previewEdizioneBadge = document.getElementById('previewEdizioneBadge');
    const previewTitle = document.getElementById('previewTitle');
    const previewDatesVal = document.getElementById('previewDatesVal');
    const previewDaysCount = document.getElementById('previewDaysCount');
    const previewOreTotali = document.getElementById('previewOreTotali');
    const previewOreAula = document.getElementById('previewOreAula');
    const previewOreStage = document.getElementById('previewOreStage');
    const previewAssenza = document.getElementById('previewAssenza');
    const previewTollIngresso = document.getElementById('previewTollIngresso');
    const previewTollUscita = document.getElementById('previewTollUscita');

    const checkDate = document.getElementById('checkDate');
    const checkOre = document.getElementById('checkOre');
    const checkBilancioUf = document.getElementById('checkBilancioUf');

    idInput.value = idEdizione;

    let allUnitaFormative = [];
    let currentEdizioneData = null;

    // Ricalcolo monte ore totale
    function recalculateTotalOre() {
        const t = parseInt(oreTeoria.value) || 0;
        const s = parseInt(oreStage.value) || 0;
        durataOre.value = t + s;
    }

    function countWorkingDays(d1, d2) {
        let count = 0;
        let cur = new Date(d1);
        const end = new Date(d2);
        while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    }

    function updatePreview() {
        recalculateTotalOre();

        const label = etichettaInput.value.trim() || `Edizione #${idEdizione}`;
        previewTitle.textContent = label;
        previewEdizioneBadge.textContent = `ID #${idEdizione}`;

        // Date
        if (dataInizio.value && dataFine.value) {
            const dI = new Date(dataInizio.value);
            const dF = new Date(dataFine.value);
            if (!isNaN(dI) && !isNaN(dF) && dF >= dI) {
                previewDatesVal.textContent = `${dI.toLocaleDateString('it-IT')} → ${dF.toLocaleDateString('it-IT')}`;
                const workDays = countWorkingDays(dI, dF);
                previewDaysCount.textContent = `${workDays} gg lav.`;
                setCheck(checkDate, true);
            } else {
                previewDatesVal.textContent = "Data fine antecedente ad inizio!";
                previewDaysCount.textContent = "—";
                setCheck(checkDate, false);
            }
        } else {
            previewDatesVal.textContent = "Date da definire";
            previewDaysCount.textContent = "—";
            setCheck(checkDate, false);
        }

        // Ore
        const t = parseInt(oreTeoria.value) || 0;
        const s = parseInt(oreStage.value) || 0;
        const tot = t + s;

        previewOreAula.textContent = t ? `${t}h` : '—';
        previewOreStage.textContent = s !== null && s !== undefined ? `${s}h` : '—';
        previewOreTotali.textContent = tot ? `${tot}h` : '—';
        setCheck(checkOre, t > 0);

        // Tolleranze e Assenze
        previewAssenza.textContent = `${percAssenza.value || 20}%`;
        previewTollIngresso.innerHTML = `<i class="bi bi-box-arrow-in-right text-primary me-1"></i>Toll. Entrata: <strong>${tollIngresso.value || 15} min</strong>`;
        previewTollUscita.innerHTML = `<i class="bi bi-box-arrow-right text-primary me-1"></i>Toll. Uscita: <strong>${tollUscita.value || 15} min</strong>`;

        updateUfHoursCounter();
    }

    function setCheck(el, isOk) {
        if (!el) return;
        if (isOk) {
            el.classList.add('done');
            el.querySelector('i').className = 'bi bi-check-circle-fill';
        } else {
            el.classList.remove('done');
            el.querySelector('i').className = 'bi bi-circle';
        }
    }

    function updateUfHoursCounter() {
        const targetOreAula = parseInt(oreTeoria.value) || 0;
        let sumAssigned = 0;

        const checkedChks = document.querySelectorAll('.chk-edit-uf-piano:checked');
        checkedChks.forEach(chk => {
            const ufId = chk.dataset.ufId;
            const oreInput = document.getElementById(`oreEditUf_${ufId}`);
            sumAssigned += parseInt(oreInput ? oreInput.value : 0) || 0;
        });

        const restanti = targetOreAula - sumAssigned;

        const valTarget = document.getElementById('editEdizioneValOreAulaTarget');
        const valAssigned = document.getElementById('editEdizioneValOreUfAssegnate');
        const valRestanti = document.getElementById('editEdizioneValOreUfRestanti');
        const badgeStatus = document.getElementById('editEdizioneUfBadgeStatus');
        const counterHint = document.getElementById('editEdizioneUfCounterHint');

        if (valTarget) valTarget.textContent = `${targetOreAula}h`;
        if (valAssigned) valAssigned.textContent = `${sumAssigned}h`;
        if (valRestanti) valRestanti.textContent = `${restanti}h`;

        if (badgeStatus) {
            if (targetOreAula === 0 && sumAssigned === 0) {
                badgeStatus.className = 'badge bg-secondary text-white px-3 py-2 rounded-pill font-monospace fw-bold';
                badgeStatus.textContent = 'Inserisci ore aula';
                setCheck(checkBilancioUf, false);
            } else if (restanti > 0) {
                badgeStatus.className = 'badge bg-warning text-dark px-3 py-2 rounded-pill font-monospace fw-bold';
                badgeStatus.textContent = `Mancano ${restanti}h da associare`;
                if (counterHint) counterHint.textContent = `Assegna ancora ${restanti}h alle Unità Formative per completare il bilanciamento.`;
                setCheck(checkBilancioUf, false);
            } else if (restanti === 0) {
                badgeStatus.className = 'badge bg-success text-white px-3 py-2 rounded-pill font-monospace fw-bold';
                badgeStatus.textContent = `✓ Bilancio Perfetto (0h restanti)`;
                if (counterHint) counterHint.textContent = `Tutte le ore di aula sono state perfettamente assegnate alle Unità Formative.`;
                setCheck(checkBilancioUf, true);
            } else {
                const eccedenza = Math.abs(restanti);
                badgeStatus.className = 'badge bg-danger text-white px-3 py-2 rounded-pill font-monospace fw-bold';
                badgeStatus.textContent = `⚠ Eccedenza di ${eccedenza}h`;
                if (counterHint) counterHint.textContent = `Le ore assegnate superano di ${eccedenza}h le ore aula target.`;
                setCheck(checkBilancioUf, false);
            }
        }

        return { targetOreAula, sumAssigned, restanti };
    }

    // Event listeners su input
    [etichettaInput, dataInizio, dataFine, oreTeoria, oreStage, percAssenza, tollIngresso, tollUscita].forEach(input => {
        ['input', 'change'].forEach(evt => input.addEventListener(evt, updatePreview));
    });

    // Carica dati Edizione, Corso e Piano Studio
    try {
        const [resEdiz, resCorsi, resUf, resModuli, resPs] = await Promise.all([
            fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}`),
            fetchAutenticata(`${API_URL}/corsi`),
            fetchAutenticata(`${API_URL}/unita_formative`),
            fetchAutenticata(`${API_URL}/moduli`),
            fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}/piano-studio`)
        ]);

        if (!resEdiz.ok) {
            alert("Edizione non trovata.");
            window.location.href = "dashboard.html";
            return;
        }

        currentEdizioneData = await resEdiz.json();
        const allCorsi = resCorsi.ok ? await resCorsi.json() : [];
        allUnitaFormative = resUf.ok ? await resUf.json() : [];
        const allModuli = resModuli.ok ? await resModuli.json() : [];
        const existingPs = resPs.ok ? await resPs.json() : [];

        // Trova corso
        const corsoPadre = allCorsi.find(c => c.id_corso === currentEdizioneData.id_corso);
        if (corsoPadre) {
            previewCorsoNome.textContent = corsoPadre.Nome;
            document.getElementById('headerBreadcrumbCurrent').textContent = `Modifica: ${currentEdizioneData.etichetta || corsoPadre.Nome}`;
        }

        // Popola campi
        idCorsoInput.value = currentEdizioneData.id_corso;
        etichettaInput.value = currentEdizioneData.etichetta || '';
        dataInizio.value = currentEdizioneData.data_inizio ? currentEdizioneData.data_inizio.split('T')[0] : '';
        dataFine.value = currentEdizioneData.data_fine ? currentEdizioneData.data_fine.split('T')[0] : '';
        oreTeoria.value = currentEdizioneData.ore_teoria_aula || 0;
        oreStage.value = currentEdizioneData.ore_stage || 0;
        percAssenza.value = currentEdizioneData.percentuale_ore_assenza || 20;
        tollIngresso.value = currentEdizioneData.tolleranza_ingresso_minuti || 15;
        tollUscita.value = currentEdizioneData.tolleranza_uscita_minuti || 15;

        // Render Unità Formative
        const ufContainer = document.getElementById('editEdizioneUfList');
        const existingPsMap = {};
        existingPs.forEach(p => existingPsMap[p.id_unita_formativa] = p.ore_dedicate);

        if (!allUnitaFormative.length) {
            ufContainer.innerHTML = '<div class="alert alert-light border small text-muted">Nessuna Unità Formativa a catalogo.</div>';
        } else {
            ufContainer.innerHTML = allUnitaFormative.map(uf => {
                const nModuli = allModuli.filter(m => m.id_unita_formativa === uf.id_unita_formativa).length;
                const isChecked = existingPsMap.hasOwnProperty(uf.id_unita_formativa);
                const oreVal = isChecked ? existingPsMap[uf.id_unita_formativa] : 0;

                return `
                    <div class="card p-3 border uf-item-card" style="background:#ffffff; border-radius:10px;">
                        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div class="form-check mb-0">
                                <input class="form-check-input chk-edit-uf-piano" type="checkbox" 
                                    value="${uf.id_unita_formativa}" 
                                    id="chkEditUf_${uf.id_unita_formativa}" 
                                    data-uf-id="${uf.id_unita_formativa}" 
                                    ${isChecked ? 'checked' : ''}>
                                <label class="form-check-label fw-bold text-dark" for="chkEditUf_${uf.id_unita_formativa}">
                                    ${uf.Nome}
                                    <span class="badge bg-light text-secondary border ms-2 font-monospace" style="font-size:0.75rem;">${nModuli} modul${nModuli === 1 ? 'o' : 'i'}</span>
                                </label>
                            </div>
                            <div class="d-flex align-items-center gap-2" style="max-width: 200px;">
                                <label for="oreEditUf_${uf.id_unita_formativa}" class="small text-muted mb-0 fw-semibold">Ore:</label>
                                <input type="number" id="oreEditUf_${uf.id_unita_formativa}" class="form-control form-control-sm input-edit-ore-uf" min="0" max="1000" value="${oreVal}" ${!isChecked ? 'disabled' : ''}>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            ufContainer.querySelectorAll('.chk-edit-uf-piano').forEach(chk => {
                chk.addEventListener('change', (e) => {
                    const ufId = e.target.dataset.ufId;
                    const oreInp = document.getElementById(`oreEditUf_${ufId}`);
                    if (oreInp) {
                        oreInp.disabled = !e.target.checked;
                        if (!e.target.checked) oreInp.value = 0;
                    }
                    updateUfHoursCounter();
                });
            });

            ufContainer.querySelectorAll('.input-edit-ore-uf').forEach(inp => {
                ['input', 'change', 'keyup'].forEach(evt => inp.addEventListener(evt, updateUfHoursCounter));
            });
        }

        updatePreview();

    } catch (err) {
        console.error("Errore caricamento dati edizione:", err);
        showToast("Errore durante il recupero dei dati dell'edizione.", true);
    }

    // Submit Salvataggio
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const oreTeoriaVal = parseInt(oreTeoria.value) || 0;
        const oreStageVal = parseInt(oreStage.value) || 0;
        const percAssenzaVal = parseInt(percAssenza.value) || 0;
        const tollIngVal = parseInt(tollIngresso.value) || 0;
        const tollUscVal = parseInt(tollUscita.value) || 0;

        if (!dataInizio.value || !dataFine.value) {
            showToast("Inserisci sia la data di inizio che la data di fine.", true);
            return;
        }

        if (new Date(dataFine.value) < new Date(dataInizio.value)) {
            showToast("La data di fine non può essere antecedente alla data di inizio.", true);
            return;
        }

        if (oreTeoriaVal <= 0) {
            showToast("Le ore di aula devono essere maggiori di zero.", true);
            return;
        }

        const balance = updateUfHoursCounter();
        if (balance.restanti < 0) {
            showToast(`Bilancio UF eccedente: le ore assegnate superano di ${Math.abs(balance.restanti)}h le ore di aula.`, true);
            return;
        } else if (balance.restanti > 0) {
            showToast(`Nota: Mancano ancora ${balance.restanti}h da associare nelle UF, ma l'edizione verrà comunque salvata.`);
        }

        const btnText = submitBtn.querySelector('.btn-nc-text');
        const btnLoading = submitBtn.querySelector('.btn-nc-loading');
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';

        const payload = {
            id_corso: parseInt(idCorsoInput.value),
            etichetta: etichettaInput.value.trim() || null,
            data_inizio: dataInizio.value,
            data_fine: dataFine.value,
            durata_ore: oreTeoriaVal + oreStageVal,
            ore_teoria_aula: oreTeoriaVal,
            ore_stage: oreStageVal,
            percentuale_ore_assenza: percAssenzaVal,
            tolleranza_ingresso_minuti: tollIngVal,
            tolleranza_uscita_minuti: tollUscVal,
            archiviato: false
        };

        try {
            const res = await fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || "Errore durante l'aggiornamento dell'edizione.");
            }

            // Sincronizza Piano Studio (UF collegate)
            const currentCheckedUfs = Array.from(document.querySelectorAll('.chk-edit-uf-piano:checked'));
            const items = currentCheckedUfs.map(chk => {
                const ufId = parseInt(chk.value);
                const oreInput = document.getElementById(`oreEditUf_${ufId}`);
                return {
                    id_unita_formativa: ufId,
                    ore_dedicate: parseInt(oreInput ? oreInput.value : 0) || 0
                };
            });

            const syncRes = await fetchAutenticata(`${API_URL}/corsi-attivi/${idEdizione}/piano-studio`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: items })
            });

            if (!syncRes.ok) {
                const errSync = await syncRes.json().catch(() => ({}));
                throw new Error(errSync.detail || "Errore durante il salvataggio del piano studio.");
            }

            showToast("Edizione e Piano di Studio aggiornati con successo!");
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 800);

        } catch (err) {
            showToast(err.message || "Errore di connessione.", true);
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
