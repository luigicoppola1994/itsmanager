const API_URL = 'http://localhost:8000';

async function fetchAutenticata(url, opzioni = {}) {
    let token = localStorage.getItem('jwt_token');
    if (!opzioni.headers) opzioni.headers = {};
    if (token) opzioni.headers['Authorization'] = `Bearer ${token}`;
    opzioni.credentials = 'include'; // Permette cookie HttpOnly

    let risposta = await fetch(url, opzioni);

    if (risposta.status === 401 && token) {
        console.warn("Access token scaduto. Tento il refresh...");
        try {
            const rispRefresh = await fetch(`${API_URL}/refresh`, {
                method: 'POST',
                credentials: 'include' 
            });

            if (rispRefresh.ok) {
                const dati = await rispRefresh.json();
                localStorage.setItem('jwt_token', dati.access_token);
                opzioni.headers['Authorization'] = `Bearer ${dati.access_token}`;
                risposta = await fetch(url, opzioni);
            } else {
                console.error("Refresh token scaduto o non valido.");
                logout();
            }
        } catch (errore) {
            console.error("Errore refresh:", errore);
        }
    }
    return risposta;
}

function logout() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_role');
    window.location.href = '/login.html';
}

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

// Controllo sessione all'avvio: se siamo in una dashboard e non c'è token, vai al login
window.addEventListener('load', () => {
    const token = localStorage.getItem('jwt_token');
    const path = window.location.pathname;
    
    // Se non siamo in login.html e non abbiamo il token, reindirizziamo
    if (!path.includes('login.html') && path !== '/' && !token) {
        window.location.href = '/login.html';
    }
});
