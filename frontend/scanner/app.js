let qrScanner = null;
let scannerRunning = false;
let lastQrValue = null;
let lastQrAt = 0;
const API_URL = 'https://managerits.vercel.app';

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startScannerBtn').addEventListener('click', startScanner);
    document.getElementById('stopScannerBtn').addEventListener('click', stopScanner);
    document.getElementById('manualScanBtn').addEventListener('click', () => {
        const value = document.getElementById('manualQrData').value.trim();
        if (value) registerQrAttendance(value);
    });
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);
});

async function startScanner() {
    if (scannerRunning) return;

    setCameraStatus('Avvio...', 'is-loading');
    qrScanner = new Html5Qrcode('reader');

    try {
        await qrScanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
            handleQrScan,
            () => {}
        );
        scannerRunning = true;
        document.getElementById('startScannerBtn').disabled = true;
        document.getElementById('stopScannerBtn').disabled = false;
        setCameraStatus('Attiva', 'is-active');
    } catch (error) {
        console.error('[SCANNER] Impossibile avviare fotocamera:', error);
        setCameraStatus('Errore camera', 'is-error');
        showToast('Consenti l’accesso alla fotocamera o usa l’inserimento manuale.', true);
        qrScanner = null;
    }
}

async function stopScanner() {
    if (!qrScanner || !scannerRunning) return;

    try {
        await qrScanner.stop();
        qrScanner.clear();
    } catch (error) {
        console.error('[SCANNER] Errore arresto fotocamera:', error);
    } finally {
        scannerRunning = false;
        document.getElementById('startScannerBtn').disabled = false;
        document.getElementById('stopScannerBtn').disabled = true;
        setCameraStatus('Pronto', 'is-idle');
    }
}

function handleQrScan(decodedText) {
    const now = Date.now();
    if (decodedText === lastQrValue && now - lastQrAt < 5000) return;
    lastQrValue = decodedText;
    lastQrAt = now;
    registerQrAttendance(decodedText);
}

async function registerQrAttendance(qrData) {
    let parsedQr;
    try {
        parsedQr = JSON.parse(qrData);
    } catch {
        showResult('error', 'QR non valido', 'Il contenuto letto non è un QR ITS Manager.');
        addLog('QR rifiutato', 'Formato non valido', 'error');
        return;
    }

    if (!parsedQr.user_id || !parsedQr.lezione_id || !parsedQr.corso_attivo_id) {
        showResult('error', 'QR incompleto', 'Mancano i dati necessari per la timbratura.');
        addLog('QR rifiutato', 'Dati incompleti', 'error');
        return;
    }

    setCameraStatus('Verifica...', 'is-loading');
    try {
        const response = await fetch(`${API_URL}/presenze/qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_data: qrData })
        });
        const result = await response.json();

        if (!response.ok) {
            const message = result.detail || 'Timbratura rifiutata';
            showResult('error', 'Timbratura non registrata', message);
            addLog('Operazione rifiutata', message, 'error');
            setCameraStatus(scannerRunning ? 'Attiva' : 'Pronto', scannerRunning ? 'is-active' : 'is-idle');
            return;
        }

        const presenza = result.presenza || {};
        const tipo = result.tipo === 'uscita' ? 'Uscita registrata' : 'Ingresso registrato';
        const orario = result.tipo === 'uscita' ? presenza.ora_uscita : presenza.ora_ingresso;
        showResult('success', tipo, `${result.messaggio}${orario ? ` (${orario})` : ''}`);
        addLog(tipo, result.messaggio, 'success');
        document.getElementById('manualQrData').value = '';
        setCameraStatus(scannerRunning ? 'Attiva' : 'Pronto', scannerRunning ? 'is-active' : 'is-idle');
    } catch (error) {
        console.error('[SCANNER] Errore registrazione:', error);
        showResult('error', 'Errore di connessione', 'Impossibile contattare il server.');
        addLog('Errore di rete', 'Server non raggiungibile', 'error');
    }
}

function setCameraStatus(label, state) {
    const element = document.getElementById('cameraStatus');
    element.className = `status-pill ${state}`;
    element.innerHTML = `<i class="bi bi-camera me-1"></i>${label}`;
}

function showResult(type, title, message) {
    const panel = document.getElementById('resultPanel');
    panel.className = `result-panel result-${type}`;
    panel.innerHTML = `
        <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} result-icon"></i>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(message)}</span>
    `;
}

function addLog(title, message, type) {
    const log = document.getElementById('scanLog');
    log.querySelector('.scan-log-empty')?.remove();
    const item = document.createElement('div');
    item.className = `scan-log-item ${type}`;
    item.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span><time>${new Date().toLocaleTimeString('it-IT')}</time>`;
    log.prepend(item);
}

function clearLog() {
    document.getElementById('scanLog').innerHTML = '<p class="scan-log-empty">Nessuna attività registrata.</p>';
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `scanner-toast show ${isError ? 'is-error' : ''}`;
    setTimeout(() => toast.classList.remove('show'), 4000);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
