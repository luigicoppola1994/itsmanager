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
    
    // Anteprima & Checklist
    const previewTitle = document.getElementById('previewTitle');
    const previewDesc = document.getElementById('previewDesc');
    const metaOreTotali = document.querySelectorAll('.meta-text-val')[0];
    const metaOreStage = document.querySelectorAll('.meta-text-val')[1];
    const previewBadge = document.querySelector('.course-badge');
    
    const checkCorso = document.getElementById('checkCorso');
    const checkDate = document.getElementById('checkDate');
    const checkOre = document.getElementById('checkOre');

    // Mappa per salvare i corsi caricati (per recuperare la descrizione)
    let corsiEsistentiMap = {};

    // 3. Inizializzazione: Carica corsi esistenti
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

    // 4. Gestione Toggle Modalità
    function toggleMode() {
        if (modeNew.checked) {
            sectionNewCourse.style.display = 'block';
            sectionExistingCourse.style.display = 'none';
            // Resetta validazione
            nomeInput.required = true;
            corsoEsistenteSelect.required = false;

            if (checkCreaEdizione) {
                checkCreaEdizione.disabled = false;
                sectionEdizioneContainer.style.display = checkCreaEdizione.checked ? 'block' : 'none';
            }
        } else {
            sectionNewCourse.style.display = 'none';
            sectionExistingCourse.style.display = 'block';
            // Resetta validazione
            nomeInput.required = false;
            corsoEsistenteSelect.required = true;

            if (checkCreaEdizione) {
                checkCreaEdizione.checked = true;
                checkCreaEdizione.disabled = true;
                sectionEdizioneContainer.style.display = 'block';
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

        // Se la data inizio è impostata e la data fine è vuota (o modificabile), suggerisci automaticamente la data fine coerente (max 40h/settimana)
        if (dataInizio && dataInizio.value && dataFine && !dataFine.value && tot > 0) {
            const giorniLavNecessari = Math.ceil(tot / 8);
            let count = 0;
            let cur = new Date(dataInizio.value);
            while (count < giorniLavNecessari) {
                const day = cur.getDay();
                if (day !== 0 && day !== 6) { // 0 = Domenica, 6 = Sabato
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
        calcolaOreTotali();

        let isCorsoValido = false;
        let titleText = 'Nome del corso';
        let descText = 'La descrizione del corso apparirà qui...';

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

        // Aggiorna UI Anagrafica e Badge
        previewTitle.textContent = titleText;
        previewDesc.textContent = descText;
        if (etichettaInput && etichettaInput.value.trim()) {
            previewBadge.textContent = `Nuovo • ${etichettaInput.value.trim()}`;
        } else {
            previewBadge.textContent = 'Nuovo';
        }

        if (isCorsoValido) {
            previewTitle.classList.remove('placeholder-text');
            previewDesc.classList.remove('placeholder-text');
            checkCorso.classList.add('filled');
        } else {
            previewTitle.classList.add('placeholder-text');
            previewDesc.classList.add('placeholder-text');
            checkCorso.classList.remove('filled');
        }

        const creaEdizioneAttiva = checkCreaEdizione ? checkCreaEdizione.checked : true;

        if (!creaEdizioneAttiva && modeNew.checked) {
            submitBtn.querySelector('.btn-nc-text').innerHTML = '<i class="bi bi-check-lg"></i> Salva Corso (Senza Edizione)';
            checkDate.style.opacity = '0.4';
            checkOre.style.opacity = '0.4';
            checkDate.classList.remove('filled');
            checkOre.classList.remove('filled');
        } else {
            submitBtn.querySelector('.btn-nc-text').innerHTML = '<i class="bi bi-check-lg"></i> Salva Edizione';
            checkDate.style.opacity = '1';
            checkOre.style.opacity = '1';

            // Check Date
            if (dataInizio.value && dataFine.value && new Date(dataInizio.value) <= new Date(dataFine.value)) {
                checkDate.classList.add('filled');
            } else {
                checkDate.classList.remove('filled');
            }

            // Check Ore
            const tot = parseInt(durataOre.value) || 0;
            const stage = parseInt(oreStage.value) || 0;
            metaOreTotali.textContent = tot > 0 ? `${tot}h` : '—';
            metaOreStage.textContent = oreStage.value.trim() !== '' ? `${stage}h` : '—';
            
            if (tot > 0) {
                checkOre.classList.add('filled');
            } else {
                checkOre.classList.remove('filled');
            }
        }
    }

    // Aggiungi listener per l'input in tempo reale su tutti i campi
    const inputsToWatch = [nomeInput, descInput, corsoEsistenteSelect, etichettaInput, dataInizio, dataFine, oreTeoria, oreStage];
    inputsToWatch.forEach(input => {
        if (input) {
            ['input', 'keyup', 'change'].forEach(evt => input.addEventListener(evt, updatePreview));
        }
    });

    // 6. Gestione Invio del Form (Chiamata API)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validazione Client-Side
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
            // Validazione Ore Aula e Stage
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
                const maxOreCopribili = giorniLav * 8; // Max 8h/giorno = 40h/settimana
                if (maxOreCopribili < totOreCalculated) {
                    showToastCustom(`Il periodo dal ${new Date(dataInizio.value).toLocaleDateString('it-IT')} al ${new Date(dataFine.value).toLocaleDateString('it-IT')} ha ${giorniLav} giorni lavorativi per un max di ${maxOreCopribili}h (max 8h/giorno, 40h/settimana). Impossibile coprire le ${totOreCalculated}h totali.`, 'error');
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
        }

        if (!isValid) return;

        setLoadingState(true);

        try {
            if (modeNew.checked && !creaEdizioneAttiva) {
                // ─────────────────────────────────────────────────────────────
                // CREAZIONE SOLO CORSO A CATALOGO (Senza Edizione)
                // ─────────────────────────────────────────────────────────────
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
                }, 1500);

            } else if (modeNew.checked && creaEdizioneAttiva) {
                // ─────────────────────────────────────────────────────────────
                // ENDPOINT ATOMICO: crea corso + edizione in un'unica transazione
                // ─────────────────────────────────────────────────────────────
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

                showToastCustom('Corso ed Edizione creati con successo!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);

            } else {
                // ─────────────────────────────────────────────────────────────
                // CORSO ESISTENTE: crea solo l'edizione
                // ─────────────────────────────────────────────────────────────
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

                showToastCustom('Edizione del corso creata con successo!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
            }

        } catch (error) {
            console.error("Errore salvataggio:", error);
            showToastCustom(error.message || 'Errore di connessione al server.', 'error');
            setLoadingState(false);
        }
    });


    // Helpers
    function setLoadingState(isLoading) {
        const btnText = submitBtn.querySelector('.btn-nc-text');
        const btnLoading = submitBtn.querySelector('.btn-nc-loading');

        if (isLoading) {
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
        } else {
            submitBtn.disabled = false;
            btnText.style.display = 'flex';
            btnLoading.style.display = 'none';
        }
    }

    function showToastCustom(message, type) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => { toast.classList.remove('show'); }, 3500);
    }
});
