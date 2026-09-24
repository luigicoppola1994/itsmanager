// ============================================================
// nuovo-corso.js — Creazione Corso ed Edizione Attiva
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Gestione Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // 2. Elementi del DOM
    const form = document.getElementById('nuovoCorsoForm');
    
    // Selettori Modalità
    const modeNew = document.getElementById('modeNew');
    const modeExisting = document.getElementById('modeExisting');
    const sectionNewCourse = document.getElementById('sectionNewCourse');
    const sectionExistingCourse = document.getElementById('sectionExistingCourse');
    
    // Campi Anagrafica
    const corsoEsistenteSelect = document.getElementById('corsoEsistenteSelect');
    const nomeInput = document.getElementById('nomeCorso');
    const descInput = document.getElementById('descrizioneCorso');
    const charCount = document.getElementById('charCount');
    
    // Campi Edizione Attiva
    const checkCreaEdizione = document.getElementById('checkCreaEdizione');
    const sectionEdizioneContainer = document.getElementById('sectionEdizioneContainer');
    const etichettaInput = document.getElementById('etichettaEdizione');
    const dataInizio = document.getElementById('dataInizio');
    const dataFine = document.getElementById('dataFine');
    const durataOre = document.getElementById('durataOre');
    const oreTeoria = document.getElementById('oreTeoria');
    const oreStage = document.getElementById('oreStage');
    const percAssenza = document.getElementById('percAssenza');
    const tollIngresso = document.getElementById('tollIngresso');
    const tollUscita = document.getElementById('tollUscita');
    
    const submitBtn = document.getElementById('submitBtn');
    
    // Anteprima & Checklist Elementi
    const previewTitle = document.getElementById('previewTitle');
    const previewDesc = document.getElementById('previewDesc');
    const previewStatusBadge = document.getElementById('previewStatusBadge');
    const previewEditionBadge = document.getElementById('previewEditionBadge');
    const previewDatesVal = document.getElementById('previewDatesVal');
    const previewDaysCount = document.getElementById('previewDaysCount');
    const previewOreTotali = document.getElementById('previewOreTotali');
    const previewOreAula = document.getElementById('previewOreAula');
    const previewOreStage = document.getElementById('previewOreStage');
    const previewAssenza = document.getElementById('previewAssenza');
    const previewTollIngresso = document.getElementById('previewTollIngresso');
    const previewTollUscita = document.getElementById('previewTollUscita');
    const previewProgressPercent = document.getElementById('previewProgressPercent');
    const previewProgressBar = document.getElementById('previewProgressBar');
    
    const checkCorso = document.getElementById('checkCorso');
    const checkDate = document.getElementById('checkDate');
    const checkOre = document.getElementById('checkOre');

    // Mappa per salvare i corsi caricati (per recuperare la descrizione)
    let corsiEsistentiMap = {};

    // 3. Inizializzazione: Carica corsi esistenti ed Unità Formative
    let allUnitaFormative = [];

    async function loadUnitaFormative() {
        const container = document.getElementById('ufPianoStudioList');
        if (!container) return;

        try {
            const [resUf, resM] = await Promise.all([
                fetchAutenticata(`${API_URL}/unita_formative`),
                fetchAutenticata(`${API_URL}/moduli`)
            ]);

            if (resUf.ok && resM.ok) {
                allUnitaFormative = await resUf.json();
                const moduliList = await resM.json();

                if (!allUnitaFormative.length) {
                    container.innerHTML = '<div class="alert alert-light border small text-muted mb-0">Nessuna Unità Formativa a catalogo. <a href="nuova-uf.html" class="fw-bold">Crea una UF</a></div>';
                    return;
                }

                container.innerHTML = allUnitaFormative.map(uf => {
                    const ufModuli = moduliList.filter(m => m.id_unita_formativa === uf.id_unita_formativa);
                    const modCount = ufModuli.length;
                    return `
                        <div class="card p-3 border mb-2 uf-item-card" style="background:#ffffff; border-radius:10px;">
                            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <div class="form-check mb-0">
                                    <input class="form-check-input chk-uf-piano" type="checkbox" value="${uf.id_unita_formativa}" id="chkUf_${uf.id_unita_formativa}" data-uf-id="${uf.id_unita_formativa}">
                                    <label class="form-check-label fw-bold text-dark" for="chkUf_${uf.id_unita_formativa}">
                                        ${uf.Nome}
                                        <span class="badge bg-light text-secondary border ms-2 font-monospace" style="font-size:0.75rem;">${modCount} modul${modCount === 1 ? 'o' : 'i'}</span>
                                    </label>
                                </div>
                                <div class="d-flex align-items-center gap-2" style="max-width: 200px;">
                                    <label for="oreUf_${uf.id_unita_formativa}" class="small text-muted mb-0 fw-semibold">Ore:</label>
                                    <input type="number" id="oreUf_${uf.id_unita_formativa}" class="form-control form-control-sm input-ore-uf" min="0" max="1000" value="0" placeholder="Ore" disabled>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                // Listener per attivare/disattivare l'input ore e ricalcolare il bilancio ore UF
                container.querySelectorAll('.chk-uf-piano').forEach(chk => {
                    chk.addEventListener('change', (e) => {
                        const ufId = e.target.dataset.ufId;
                        const oreInput = document.getElementById(`oreUf_${ufId}`);
                        if (oreInput) {
                            oreInput.disabled = !e.target.checked;
                        }
                        updateUfHoursCounter();
                        updatePreview();
                    });
                });

                container.querySelectorAll('.input-ore-uf').forEach(input => {
                    ['input', 'keyup', 'change'].forEach(evt => {
                        input.addEventListener(evt, () => {
                            updateUfHoursCounter();
                            updatePreview();
                        });
                    });
                });

                updateUfHoursCounter();

            } else {
                container.innerHTML = '<div class="text-danger small">Impossibile caricare le Unità Formative.</div>';
            }
        } catch (e) {
            console.error('Errore UF:', e);
            container.innerHTML = '<div class="text-danger small">Errore di connessione.</div>';
        }
    }
    loadUnitaFormative();

    function updateUfHoursCounter() {
        const targetOreAula = parseInt(oreTeoria ? oreTeoria.value : 0) || 0;
        let sumAssigned = 0;

        const checkedChks = document.querySelectorAll('.chk-uf-piano:checked');
        checkedChks.forEach(chk => {
            const ufId = chk.dataset.ufId;
            const oreInput = document.getElementById(`oreUf_${ufId}`);
            sumAssigned += parseInt(oreInput ? oreInput.value : 0) || 0;
        });

        const restanti = targetOreAula - sumAssigned;

        const valOreAulaTarget = document.getElementById('valOreAulaTarget');
        const valOreUfAssegnate = document.getElementById('valOreUfAssegnate');
        const valOreUfRestanti = document.getElementById('valOreUfRestanti');
        const ufBadgeStatus = document.getElementById('ufBadgeStatus');
        const ufCounterHintMessage = document.getElementById('ufCounterHintMessage');
        const boxOreUfRestanti = document.getElementById('boxOreUfRestanti');

        if (valOreAulaTarget) valOreAulaTarget.textContent = `${targetOreAula}h`;
        if (valOreUfAssegnate) valOreUfAssegnate.textContent = `${sumAssigned}h`;
        if (valOreUfRestanti) valOreUfRestanti.textContent = `${restanti}h`;

        if (ufBadgeStatus && valOreUfRestanti && boxOreUfRestanti) {
            if (targetOreAula === 0 && sumAssigned === 0) {
                ufBadgeStatus.className = 'badge bg-secondary text-white px-3 py-2 rounded-pill font-monospace fw-bold';
                ufBadgeStatus.textContent = 'Inserire ore aula';
                valOreUfRestanti.className = 'fw-bold fs-5 text-muted';
                if (ufCounterHintMessage) ufCounterHintMessage.textContent = 'Inserisci le ore di aula dell\'edizione per iniziare il bilanciamento UF.';
            } else if (restanti > 0) {
                ufBadgeStatus.className = 'badge bg-warning text-dark px-3 py-2 rounded-pill font-monospace fw-bold';
                ufBadgeStatus.textContent = `Mancano ${restanti}h da associare`;
                valOreUfRestanti.className = 'fw-bold fs-5 text-warning';
                if (ufCounterHintMessage) ufCounterHintMessage.textContent = `Assegna ancora ${restanti}h alle Unità Formative per completare il bilanciamento (deve arrivare a 0h).`;
            } else if (restanti === 0) {
                ufBadgeStatus.className = 'badge bg-success text-white px-3 py-2 rounded-pill font-monospace fw-bold';
                ufBadgeStatus.textContent = `✓ Bilancio Perfetto (0h restanti)`;
                valOreUfRestanti.className = 'fw-bold fs-5 text-success';
                if (ufCounterHintMessage) ufCounterHintMessage.textContent = `✓ Perfetto! Tutte le ${targetOreAula}h di aula sono state correttamente distribuite nelle Unità Formative.`;
            } else {
                const eccedenza = Math.abs(restanti);
                ufBadgeStatus.className = 'badge bg-danger text-white px-3 py-2 rounded-pill font-monospace fw-bold';
                ufBadgeStatus.textContent = `⚠ Eccedenza di ${eccedenza}h`;
                valOreUfRestanti.className = 'fw-bold fs-5 text-danger';
                if (ufCounterHintMessage) ufCounterHintMessage.textContent = `⚠ Attenzione: le ore inserite nelle UF (${sumAssigned}h) superano di ${eccedenza}h le ore di aula (${targetOreAula}h).`;
            }
        }

        return { targetOreAula, sumAssigned, restanti };
    }

    async function loadCorsiEsistenti() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const preselectedIdCorso = urlParams.get('id_corso');

            const response = await fetchAutenticata(`${API_URL}/corsi`);
            if (response.ok) {
                const corsi = await response.json();
                corsoEsistenteSelect.innerHTML = '<option value="">-- Seleziona un corso dal catalogo --</option>';
                corsi.forEach(c => {
                    corsiEsistentiMap[c.id_corso] = c;
                    const option = document.createElement('option');
                    option.value = c.id_corso;
                    option.textContent = c.Nome;
                    if (preselectedIdCorso && String(c.id_corso) === String(preselectedIdCorso)) {
                        option.selected = true;
                    }
                    corsoEsistenteSelect.appendChild(option);
                });

                if (preselectedIdCorso) {
                    modeExisting.checked = true;
                    toggleMode();
                }
            } else {
                corsoEsistenteSelect.innerHTML = '<option value="">Errore nel caricamento dei corsi</option>';
            }
        } catch (error) {
            console.error("Errore recupero corsi:", error);
            corsoEsistenteSelect.innerHTML = '<option value="">Errore di connessione</option>';
        }
    }
    loadCorsiEsistenti();

    async function salvaPianoStudioEdizione(idCorsoAttivo) {
        if (!idCorsoAttivo) return;
        const checkedUfs = Array.from(document.querySelectorAll('.chk-uf-piano:checked'));
        const items = checkedUfs.map(chk => {
            const ufId = parseInt(chk.value);
            const oreInput = document.getElementById(`oreUf_${ufId}`);
            return {
                id_unita_formativa: ufId,
                ore_dedicate: parseInt(oreInput ? oreInput.value : 0) || 0
            };
        });

        const res = await fetchAutenticata(`${API_URL}/corsi-attivi/${idCorsoAttivo}/piano-studio`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Errore durante il salvataggio del piano studio.');
        }
    }

    // 4. Gestione Toggle Modalità
    const sectionPianoStudioTitle = document.getElementById('sectionPianoStudioTitle');
    const sectionPianoStudioContainer = document.getElementById('sectionPianoStudioContainer');

    function toggleMode() {
        if (modeNew.checked) {
            sectionNewCourse.style.display = 'block';
            sectionExistingCourse.style.display = 'none';
            nomeInput.required = true;
            corsoEsistenteSelect.required = false;

            if (checkCreaEdizione) {
                checkCreaEdizione.disabled = false;
                const showEdiz = checkCreaEdizione.checked;
                sectionEdizioneContainer.style.display = showEdiz ? 'block' : 'none';
                if (sectionPianoStudioTitle) sectionPianoStudioTitle.style.display = showEdiz ? 'block' : 'none';
                if (sectionPianoStudioContainer) sectionPianoStudioContainer.style.display = showEdiz ? 'block' : 'none';
            }
        } else {
            sectionNewCourse.style.display = 'none';
            sectionExistingCourse.style.display = 'block';
            nomeInput.required = false;
            corsoEsistenteSelect.required = true;

            if (checkCreaEdizione) {
                checkCreaEdizione.checked = true;
                checkCreaEdizione.disabled = true;
                sectionEdizioneContainer.style.display = 'block';
                if (sectionPianoStudioTitle) sectionPianoStudioTitle.style.display = 'block';
                if (sectionPianoStudioContainer) sectionPianoStudioContainer.style.display = 'block';
            }
        }
        updatePreview();
    }
    modeNew.addEventListener('change', toggleMode);
    modeExisting.addEventListener('change', toggleMode);
    if (checkCreaEdizione) {
        checkCreaEdizione.addEventListener('change', toggleMode);
    }
    
    // Inizializza stato UI
    toggleMode();

    // Helper per il calcolo dei giorni lavorativi (lunedì-venerdì)
    function calcolaGiorniLavorativi(startStr, endStr) {
        if (!startStr || !endStr) return 0;
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (isNaN(start) || isNaN(end) || start > end) return 0;
        
        let workingDays = 0;
        let cur = new Date(start);
        while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) { // 0 = Domenica, 6 = Sabato
                workingDays++;
            }
            cur.setDate(cur.getDate() + 1);
        }
        return workingDays;
    }

    // Helper formattazione data italiana abbreviata
    function formatDateIt(dStr) {
        if (!dStr) return '';
        const parts = dStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        const d = new Date(dStr);
        return isNaN(d) ? dStr : d.toLocaleDateString('it-IT');
    }

    // Calcolo automatico Ore Totali (Aula + Stage) in tempo reale
    function calcolaOreTotali() {
        const tStr = oreTeoria ? oreTeoria.value.trim() : '';
        const sStr = oreStage ? oreStage.value.trim() : '';
        const tVal = parseInt(tStr) || 0;
        const sVal = parseInt(sStr) || 0;
        const tot = tVal + sVal;
        
        if (durataOre) {
            durataOre.value = tot;
        }

        // Suggerisci automaticamente la data fine coerente se inizio è presente e fine vuota
        if (dataInizio && dataInizio.value && dataFine && !dataFine.value && tot > 0) {
            const giorniLavNecessari = Math.ceil(tot / 8);
            let count = 0;
            let cur = new Date(dataInizio.value);
            while (count < giorniLavNecessari) {
                const day = cur.getDay();
                if (day !== 0 && day !== 6) {
                    count++;
                    if (count === giorniLavNecessari) break;
                }
                cur.setDate(cur.getDate() + 1);
            }
            if (!isNaN(cur.getTime())) {
                const year = cur.getFullYear();
                const month = String(cur.getMonth() + 1).padStart(2, '0');
                const day = String(cur.getDate()).padStart(2, '0');
                dataFine.value = `${year}-${month}-${day}`;
            }
        }
        return tot;
    }

    // 5. Funzione per aggiornare l'anteprima e la checklist in tempo reale
    function updatePreview() {
        const totOre = calcolaOreTotali();

        let isCorsoValido = false;
        let titleText = 'Nome del corso';
        let descText = 'La descrizione del percorso formativo apparirà qui...';

        // Check Anagrafica
        if (modeNew.checked) {
            const nome = nomeInput.value.trim();
            const desc = descInput.value.trim();
            
            if (nome.length > 0) {
                titleText = nome;
                isCorsoValido = true;
                nomeInput.classList.add('is-valid');
            } else {
                nomeInput.classList.remove('is-valid');
            }
            if (desc.length > 0) descText = desc;
            
            // Contatore caratteri
            const count = desc.length;
            charCount.textContent = `${count} / 1000`;
            if (count > 900) charCount.className = 'nc-char-count at-limit';
            else if (count > 750) charCount.className = 'nc-char-count near-limit';
            else charCount.className = 'nc-char-count';
            
        } else {
            const selectedId = corsoEsistenteSelect.value;
            if (selectedId && corsiEsistentiMap[selectedId]) {
                titleText = corsiEsistentiMap[selectedId].Nome;
                descText = corsiEsistentiMap[selectedId].Descrizione || 'Nessuna descrizione nel catalogo.';
                isCorsoValido = true;
                corsoEsistenteSelect.classList.add('is-valid');
            } else {
                corsoEsistenteSelect.classList.remove('is-valid');
            }
        }

        // Titolo & Descrizione card
        if (previewTitle) {
            previewTitle.textContent = titleText;
            if (isCorsoValido) {
                previewTitle.classList.remove('placeholder-text');
            } else {
                previewTitle.classList.add('placeholder-text');
            }
        }
        if (previewDesc) {
            previewDesc.textContent = descText;
            if (isCorsoValido && descText !== 'La descrizione del percorso formativo apparirà qui...') {
                previewDesc.classList.remove('placeholder-text');
            } else {
                previewDesc.classList.add('placeholder-text');
            }
        }

        // Status badge
        if (previewStatusBadge) {
            if (modeNew.checked) {
                previewStatusBadge.innerHTML = '<i class="bi bi-mortarboard-fill me-1"></i>Nuovo Corso';
            } else {
                previewStatusBadge.innerHTML = '<i class="bi bi-journal-check me-1"></i>Da Catalogo';
            }
        }

        // Edition badge
        const creaEdizioneAttiva = checkCreaEdizione ? checkCreaEdizione.checked : true;
        const etichettaVal = etichettaInput ? etichettaInput.value.trim() : '';
        if (previewEditionBadge) {
            if (!creaEdizioneAttiva && modeNew.checked) {
                previewEditionBadge.textContent = 'Solo Catalogo';
                previewEditionBadge.style.background = '#64748b';
            } else if (etichettaVal) {
                previewEditionBadge.textContent = `Edizione: ${etichettaVal}`;
                previewEditionBadge.style.background = '#10b981';
            } else {
                previewEditionBadge.textContent = 'Edizione Attiva';
                previewEditionBadge.style.background = '#10b981';
            }
        }

        // Date del corso & giorni lavorativi
        let isDateValide = false;
        let giorniLav = 0;
        if (dataInizio.value && dataFine.value && new Date(dataInizio.value) <= new Date(dataFine.value)) {
            isDateValide = true;
            giorniLav = calcolaGiorniLavorativi(dataInizio.value, dataFine.value);
            if (previewDatesVal) {
                previewDatesVal.textContent = `${formatDateIt(dataInizio.value)} → ${formatDateIt(dataFine.value)}`;
            }
            if (previewDaysCount) {
                previewDaysCount.textContent = `${giorniLav} gg lavorativi`;
            }
        } else if (dataInizio.value) {
            if (previewDatesVal) previewDatesVal.textContent = `Dal ${formatDateIt(dataInizio.value)} (fine non definita)`;
            if (previewDaysCount) previewDaysCount.textContent = '—';
        } else {
            if (previewDatesVal) previewDatesVal.textContent = 'Date da definire';
            if (previewDaysCount) previewDaysCount.textContent = '0 gg lav.';
        }

        // Ore Totali, Aula, Stage
        const tVal = parseInt(oreTeoria.value) || 0;
        const sVal = parseInt(oreStage.value) || 0;
        if (previewOreTotali) previewOreTotali.textContent = totOre > 0 ? `${totOre}h` : '—';
        if (previewOreAula) previewOreAula.textContent = oreTeoria.value.trim() !== '' ? `${tVal}h` : '—';
        if (previewOreStage) previewOreStage.textContent = oreStage.value.trim() !== '' ? `${sVal}h` : '—';

        // Assenza max
        const assenza = percAssenza ? percAssenza.value : 20;
        if (previewAssenza) previewAssenza.textContent = assenza ? `${assenza}%` : '20%';

        // Tolleranze
        const tollIng = tollIngresso ? tollIngresso.value || 15 : 15;
        const tollUsc = tollUscita ? tollUscita.value || 15 : 15;
        if (previewTollIngresso) previewTollIngresso.innerHTML = `<i class="bi bi-box-arrow-in-right text-primary me-1"></i>Toll. Entrata: <strong>${tollIng} min</strong>`;
        if (previewTollUscita) previewTollUscita.innerHTML = `<i class="bi bi-box-arrow-right text-primary me-1"></i>Toll. Uscita: <strong>${tollUsc} min</strong>`;

        // Checklist & Calcolo Percentuale di Completamento
        let completedSteps = 0;
        let totalSteps = creaEdizioneAttiva ? 3 : 1;

        if (isCorsoValido) {
            checkCorso.classList.add('filled');
            completedSteps++;
        } else {
            checkCorso.classList.remove('filled');
        }

        if (!creaEdizioneAttiva && modeNew.checked) {
            submitBtn.querySelector('.btn-nc-text').innerHTML = '<i class="bi bi-check-lg"></i> Salva Corso (Senza Edizione)';
            checkDate.style.opacity = '0.35';
            checkOre.style.opacity = '0.35';
            checkDate.classList.remove('filled');
            checkOre.classList.remove('filled');
        } else {
            submitBtn.querySelector('.btn-nc-text').innerHTML = '<i class="bi bi-check-lg"></i> Salva Edizione';
            checkDate.style.opacity = '1';
            checkOre.style.opacity = '1';

            if (isDateValide) {
                checkDate.classList.add('filled');
                completedSteps++;
            } else {
                checkDate.classList.remove('filled');
            }

            const { targetOreAula, sumAssigned, restanti } = updateUfHoursCounter();

            if (totOre > 0 && tVal > 0 && restanti === 0) {
                checkOre.classList.add('filled');
                completedSteps++;
            } else {
                checkOre.classList.remove('filled');
            }
        }

        const percent = Math.round((completedSteps / totalSteps) * 100);
        if (previewProgressPercent) previewProgressPercent.textContent = `${percent}%`;
        if (previewProgressBar) previewProgressBar.style.width = `${percent}%`;
    }

    // Aggiungi listener per l'input in tempo reale su tutti i campi
    const inputsToWatch = [nomeInput, descInput, corsoEsistenteSelect, etichettaInput, dataInizio, dataFine, oreTeoria, oreStage, percAssenza, tollIngresso, tollUscita];
    inputsToWatch.forEach(input => {
        if (input) {
            ['input', 'keyup', 'change'].forEach(evt => input.addEventListener(evt, updatePreview));
        }
    });

    // 6. Gestione Invio del Form (Chiamata API)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let isValid = true;
        const creaEdizioneAttiva = checkCreaEdizione ? checkCreaEdizione.checked : true;
        
        if (modeNew.checked) {
            const nomeStr = nomeInput.value.trim();
            if (!nomeStr) {
                nomeInput.classList.add('is-invalid');
                isValid = false;
            } else {
                const nomeLower = nomeStr.toLowerCase();
                const exist = Object.values(corsiEsistentiMap).some(c => c.Nome.toLowerCase() === nomeLower);
                if (exist) {
                    showToastCustom("Un corso con questo nome esiste già nel catalogo. Usa 'Usa Corso Esistente'.", 'error');
                    nomeInput.classList.add('is-invalid');
                    isValid = false;
                }
            }
        }
        if (modeExisting.checked && !corsoEsistenteSelect.value) {
            corsoEsistenteSelect.classList.add('is-invalid');
            isValid = false;
        }

        // Se è richiesta la creazione dell'edizione, effettua le relative validazioni
        if (creaEdizioneAttiva) {
            const tVal = parseInt(oreTeoria.value);
            if (isNaN(tVal) || tVal <= 0) {
                showToastCustom('Le ore in aula sono obbligatorie e devono essere maggiori di 0.', 'error');
                oreTeoria.classList.add('is-invalid');
                isValid = false;
            } else {
                oreTeoria.classList.remove('is-invalid');
            }

            const sVal = parseInt(oreStage.value);
            if (isNaN(sVal) || sVal < 0) {
                showToastCustom('Le ore di stage sono obbligatorie (inserisci 0 se non previste).', 'error');
                oreStage.classList.add('is-invalid');
                isValid = false;
            } else {
                oreStage.classList.remove('is-invalid');
            }

            const totOreCalculated = (tVal || 0) + (sVal || 0);

            // Validazione Date e Coerenza Monte Ore 40h/settimana
            if (!dataInizio.value || !dataFine.value) {
                showToastCustom('Inserisci Data Inizio e Data Fine valide.', 'error');
                isValid = false;
            } else if (new Date(dataInizio.value) > new Date(dataFine.value)) {
                showToastCustom('La Data di Inizio non può essere successiva alla Data di Fine.', 'error');
                isValid = false;
            } else if (totOreCalculated > 0) {
                const giorniLav = calcolaGiorniLavorativi(dataInizio.value, dataFine.value);
                const maxOreCopribili = giorniLav * 8;
                if (maxOreCopribili < totOreCalculated) {
                    showToastCustom(`Il periodo dal ${formatDateIt(dataInizio.value)} al ${formatDateIt(dataFine.value)} ha ${giorniLav} giorni lavorativi per un max di ${maxOreCopribili}h (max 8h/giorno, 40h/settimana). Impossibile coprire le ${totOreCalculated}h totali.`, 'error');
                    dataFine.classList.add('is-invalid');
                    isValid = false;
                } else {
                    dataFine.classList.remove('is-invalid');
                }
            }

            // Validazione % Assenza Max, Toll. Ingresso e Toll. Uscita
            const assenzaVal = parseFloat(percAssenza.value);
            if (isNaN(assenzaVal) || assenzaVal < 0 || assenzaVal > 30) {
                showToastCustom('La percentuale di assenza massima deve essere compresa tra 0% e 30%.', 'error');
                percAssenza.classList.add('is-invalid');
                isValid = false;
            } else {
                percAssenza.classList.remove('is-invalid');
            }

            const tollIngVal = parseInt(tollIngresso.value);
            if (isNaN(tollIngVal) || tollIngVal < 0 || tollIngVal > 30) {
                showToastCustom('La tolleranza in ingresso deve essere compresa tra 0 e 30 minuti.', 'error');
                tollIngresso.classList.add('is-invalid');
                isValid = false;
            } else {
                tollIngresso.classList.remove('is-invalid');
            }

            const tollUscVal = parseInt(tollUscita.value);
            if (isNaN(tollUscVal) || tollUscVal < 0 || tollUscVal > 45) {
                showToastCustom('La tolleranza in uscita deve essere compresa tra 0 e 45 minuti.', 'error');
                tollUscita.classList.add('is-invalid');
                isValid = false;
            } else {
                tollUscita.classList.remove('is-invalid');
            }

            // Informativo sul bilancio ore UF (non bloccante per il salvataggio)
            const checkedUfs = Array.from(document.querySelectorAll('.chk-uf-piano:checked'));
            let sumUfOre = 0;
            checkedUfs.forEach(chk => {
                const ufId = chk.dataset.ufId;
                const oreInput = document.getElementById(`oreUf_${ufId}`);
                sumUfOre += parseInt(oreInput ? oreInput.value : 0) || 0;
            });

            if (sumUfOre !== tVal) {
                const diff = tVal - sumUfOre;
                if (diff > 0) {
                    showToastCustom(`Nota: Mancano ancora ${diff}h da associare nelle UF, ma l'edizione verrà comunque salvata.`, 'warning');
                } else {
                    showToastCustom(`Nota: Il totale ore UF supera le ore di aula di ${Math.abs(diff)}h, ma l'edizione verrà comunque salvata.`, 'warning');
                }
            }
        }

        if (!isValid) return;

        setLoadingState(true);

        try {
            if (modeNew.checked && !creaEdizioneAttiva) {
                // Creazione solo Corso a catalogo
                const payload = {
                    Nome: nomeInput.value.trim(),
                    Descrizione: descInput.value.trim() || null
                };

                const response = await fetchAutenticata(`${API_URL}/corsi`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const err = await response.json();
                    const detail = err.detail || err.error || 'Errore nella creazione del corso.';
                    throw new Error(detail);
                }

                showToastCustom('Corso a catalogo creato con successo!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1200);

            } else if (modeNew.checked && creaEdizioneAttiva) {
                // Nuovo Corso + Edizione contestuale
                const payload = {
                    nome_corso: nomeInput.value.trim(),
                    descrizione_corso: descInput.value.trim() || null,
                    etichetta: etichettaInput ? etichettaInput.value.trim() || null : null,
                    data_inizio: dataInizio.value,
                    data_fine: dataFine.value,
                    durata_ore: parseInt(durataOre.value),
                    ore_stage: parseInt(oreStage.value) || 0,
                    ore_teoria_aula: parseInt(oreTeoria.value) || 0,
                    percentuale_ore_assenza: parseFloat(percAssenza.value) || 0,
                    tolleranza_ingresso_minuti: parseInt(tollIngresso.value) || 0,
                    tolleranza_uscita_minuti: parseInt(tollUscita.value) || 0
                };

                const response = await fetchAutenticata(`${API_URL}/corsi/nuovo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const err = await response.json();
                    const detail = err.detail || err.error || 'Errore nella creazione del corso.';
                    throw new Error(detail);
                }

                const resData = await response.json();
                const idCorsoAttivo = resData?.edizione?.id_corso_attivo;
                if (idCorsoAttivo) {
                    await salvaPianoStudioEdizione(idCorsoAttivo);
                }

                showToastCustom('Corso ed Edizione creati con successo!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1200);

            } else {
                // Corso esistente a catalogo + nuova Edizione
                const datiEdizione = {
                    id_corso: parseInt(corsoEsistenteSelect.value),
                    etichetta: etichettaInput ? etichettaInput.value.trim() || null : null,
                    data_inizio: dataInizio.value,
                    data_fine: dataFine.value,
                    durata_ore: parseInt(durataOre.value),
                    ore_stage: parseInt(oreStage.value) || 0,
                    ore_teoria_aula: parseInt(oreTeoria.value) || 0,
                    percentuale_ore_assenza: parseFloat(percAssenza.value) || 0,
                    tolleranza_ingresso_minuti: parseInt(tollIngresso.value) || 0,
                    tolleranza_uscita_minuti: parseInt(tollUscita.value) || 0,
                    archiviato: false
                };

                const responseEdizione = await fetchAutenticata(`${API_URL}/corsi-attivi`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datiEdizione)
                });

                if (!responseEdizione.ok) {
                    const err = await responseEdizione.json();
                    const detail = err.detail || err.error || 'Errore nella creazione dell\'edizione.';
                    throw new Error(detail);
                }

                const resEdizioneData = await responseEdizione.json();
                const idCorsoAttivo = resEdizioneData?.id_corso_attivo;
                if (idCorsoAttivo) {
                    await salvaPianoStudioEdizione(idCorsoAttivo);
                }

                showToastCustom('Edizione del corso creata con successo!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1200);
            }

        } catch (error) {
            console.error("Errore salvataggio:", error);
            showToastCustom(error.message || 'Errore di connessione al server.', 'error');
            setLoadingState(false);
        }
    });

    // Helpers UI
    function setLoadingState(isLoading) {
        const btnText = submitBtn.querySelector('.btn-nc-text');
        const btnLoading = submitBtn.querySelector('.btn-nc-loading');

        if (isLoading) {
            submitBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'flex';
        } else {
            submitBtn.disabled = false;
            if (btnText) btnText.style.display = 'flex';
            if (btnLoading) btnLoading.style.display = 'none';
        }
    }

    function showToastCustom(message, type) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => { toast.classList.remove('show'); }, 3500);
    }
});
