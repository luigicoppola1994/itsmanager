const API_URL = 'http://localhost:8000';

// ==============================================================================
// fetchAutenticata
// Wrapper attorno a fetch che:
// 1. Aggiunge automaticamente il Bearer token a ogni richiesta
// 2. Se riceve 401, prova a rinnovare l'access token via /refresh
// 3. Se il refresh fallisce, esegue il logout completo
// ==============================================================================
async function fetchAutenticata(url, opzioni = {}) {
    let token = localStorage.getItem('jwt_token');
    if (!opzioni.headers) opzioni.headers = {};
    if (token) opzioni.headers['Authorization'] = `Bearer ${token}`;
    opzioni.credentials = 'include'; // Invia il cookie refresh_token

    let risposta = await fetch(url, opzioni);

    // Se 401 e avevamo un token, proviamo a rinnovarlo
    if (risposta.status === 401 && token) {
        console.warn('[Auth] Access token scaduto. Tentativo di refresh...');
        const rinnovato = await _tentaRefresh();
        if (rinnovato) {
            // Riprova la richiesta originale con il nuovo token
            const nuovoToken = localStorage.getItem('jwt_token');
            opzioni.headers['Authorization'] = `Bearer ${nuovoToken}`;
            risposta = await fetch(url, opzioni);
        } else {
            // Refresh fallito → logout completo
            await logout();
        }
    }
    return risposta;
}

// ------------------------------------------------------------------------------
// _tentaRefresh (privata)
// Chiama POST /refresh per ottenere un nuovo access token usando il cookie HttpOnly.
// Restituisce true se riuscito, false se il refresh token è scaduto/assente.
// ------------------------------------------------------------------------------
async function _tentaRefresh() {
    try {
        const rispRefresh = await fetch(`${API_URL}/refresh`, {
            method: 'POST',
            credentials: 'include'
        });

        if (rispRefresh.ok) {
            const dati = await rispRefresh.json();
            localStorage.setItem('jwt_token', dati.access_token);
            console.info('[Auth] Access token rinnovato con successo.');
            return true;
        } else {
            console.warn('[Auth] Refresh token scaduto o non valido.');
            return false;
        }
    } catch (errore) {
        console.error('[Auth] Errore di rete durante il refresh:', errore);
        return false;
    }
}

// ==============================================================================
// logout
// 1. Chiama POST /logout sul backend → il server elimina il cookie refresh_token
// 2. Pulisce localStorage
// 3. Reindirizza al login
// ==============================================================================
async function logout() {
    try {
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (e) {
        // Anche se la chiamata fallisce (es. offline), procediamo col logout lato client
        console.warn('[Auth] Chiamata /logout fallita, procedo con logout client-side.');
    } finally {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_role');
        window.location.href = '/login.html';
    }
}

// ==============================================================================
// showToast
// Mostra una notifica temporanea in basso a destra.
// ==============================================================================
function showToast(message, isError = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast show ${isError ? 'error' : ''}`;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// ==============================================================================
// Controllo sessione all'avvio
// Se siamo su una pagina protetta (non login.html) e non c'è token → login.
// Non blocchiamo se siamo già sulla pagina di login per evitare redirect loop.
// ==============================================================================
window.addEventListener('load', () => {
    const token = localStorage.getItem('jwt_token');
    const path = window.location.pathname;
    const isLoginPage = path.includes('login') || path === '/';

    if (!isLoginPage && !token) {
        console.warn('[Auth] Sessione assente. Reindirizzamento al login...');
        window.location.href = '/login.html';
    }
});

// ==============================================================================
// Sidebar (Sempre Fissa/Estesa - Toggle rimosso su richiesta)
// ==============================================================================
function toggleSidebar() {
    // No-op: il menu laterale rimane sempre esteso
}

// Assicura che la sidebar non rimanga bloccata in stato compresso da sessioni precedenti
document.addEventListener('DOMContentLoaded', () => {
    localStorage.removeItem('sidebar_collapsed');
    const sidebar = document.querySelector('.sidebar');
    const wrapper = document.querySelector('.app-wrapper');
    if (sidebar) sidebar.classList.remove('collapsed');
    if (wrapper) wrapper.classList.remove('sidebar-collapsed');
});

