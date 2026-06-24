document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const btn = document.getElementById('loginBtn');
    btn.textContent = "Accesso in corso...";
    btn.disabled = true;

    try {
        const params = new URLSearchParams();
        params.append('username', email);
        params.append('password', password);

        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('jwt_token', data.access_token);
            localStorage.setItem('user_role', data.ruolo || '');
            
            // Redirect based on role
            const role = data.ruolo ? data.ruolo.toLowerCase().trim() : '';
            if (role === 'super_admin') {
                window.location.href = '/super_admin/dashboard.html';
            } else if (role === 'segreteria') {
                window.location.href = '/segreteria/dashboard.html';
            } else if (role === 'docente') {
                window.location.href = '/docente/dashboard.html';
            } else if (role === 'studente') {
                window.location.href = '/studente/dashboard.html';
            } else {
                showToast('Ruolo sconosciuto', true);
            }
        } else {
            showToast('Credenziali non valide', true);
        }
    } catch (error) {
        console.error(error);
        showToast('Errore di connessione', true);
    } finally {
        btn.textContent = "Accedi";
        btn.disabled = false;
    }
});

window.addEventListener('load', () => {
    const token = localStorage.getItem('jwt_token');
    const role = localStorage.getItem('user_role');
    if (token && role) {
        // If already logged in, redirect to correct dashboard
        const roleClean = role.toLowerCase().trim();
        if (roleClean === 'super_admin') {
            window.location.href = '/super_admin/dashboard.html';
        } else if (roleClean === 'segreteria') {
            window.location.href = '/segreteria/dashboard.html';
        } else if (roleClean === 'docente') {
            window.location.href = '/docente/dashboard.html';
        } else if (roleClean === 'studente') {
            window.location.href = '/studente/dashboard.html';
        }
    }
});
