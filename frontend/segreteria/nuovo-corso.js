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
        } else {
            sectionNewCourse.style.display = 'none';
            sectionExistingCourse.style.display = 'block';
            // Resetta validazione
            nomeInput.required = false;
            corsoEsistenteSelect.required = true;
        }
        updatePreview();
    }
    modeNew.addEventListener('change', toggleMode);
    modeExisting.addEventListener('change', toggleMode);
    
    // Inizializza stato UI
    toggleMode();

    // 5. Funzione per aggiornare l'anteprima e la checklist in tempo reale
    function updatePreview() {
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
        metaOreStage.textContent = stage > 0 ? `${stage}h` : (stage === 0 ? '0h' : '—');
        
        if (tot > 0) {
            checkOre.classList.add('filled');
        } else {
            checkOre.classList.remove('filled');
        }
    }

    // Aggiungi listener per l'input in tempo reale
    const inputsToWatch = [nomeInput, descInput, corsoEsistenteSelect, etichettaInput, dataInizio, dataFine, durataOre, oreStage];
    inputsToWatch.forEach(input => input.addEventListener('input', updatePreview));
    inputsToWatch.forEach(input => input.addEventListener('change', updatePreview));

    // 6. Gestione Invio del Form (Chiamata API)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validazione Client-Side
        let isValid = true;
        
        if (modeNew.checked) {
            const nomeStr = nomeInput.value.trim();
            if (!nomeStr) {
                nomeInput.classList.add('is-invalid');
                isValid = false;
            } else {
                // Controllo duplicato case-insensitive lato client
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
        if (!dataInizio.value || !dataFine.value) {
            showToastCustom('Inserisci Data Inizio e Data Fine valide.', 'error');
            isValid = false;
        }
        if (dataInizio.value && dataFine.value && new Date(dataInizio.value) > new Date(dataFine.value)) {
            showToastCustom('La Data di Inizio non può essere successiva alla Data di Fine.', 'error');
            isValid = false;
        }
        if (!durataOre.value || parseInt(durataOre.value) <= 0) {
            showToastCustom('Inserisci un monte ore totale valido (deve essere maggiore di zero).', 'error');
            isValid = false;
        }

        if (!isValid) return;

        setLoadingState(true);

        try {
            let idEdizione = null;

            if (modeNew.checked) {
                // ─────────────────────────────────────────────────────────────
                // ENDPOINT ATOMICO: crea corso + edizione in un'unica
                // transazione. Se l'edizione fallisce → rollback automatico
                // del corso. Nessun corso orfano nel DB!
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
                    // Estrae il messaggio specifico dal campo "detail" del backend
                    const detail = err.detail || err.error || 'Errore nella creazione del corso.';
                    throw new Error(detail);
                }

                const risultato = await response.json();
                idEdizione = risultato.edizione.id_corso_attivo;

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

                const nuovaEdizione = await responseEdizione.json();
                idEdizione = nuovaEdizione.id_corso_attivo;
            }

            // SUCCESSO!
            showToastCustom('Edizione del corso creata con successo!', 'success');
            
            // Reindirizza alla dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);

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
