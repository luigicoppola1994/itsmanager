// Funzione per generare le iniziali
function getInitials(name) {
    return name.substring(0, 2).toUpperCase();
}

// Fetch degli utenti all'avvio
async function fetchUsers() {
    const grid = document.getElementById('usersGrid');
    try {
        const response = await fetchAutenticata(`${API_URL}/users`);
        
        if (!response.ok) {
            throw new Error("Errore API");
        }
        const users = await response.json();
        
        grid.innerHTML = '';
        
        if (users.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <h3>Nessun utente trovato</h3>
                    <p>Nessun utente a sistema.</p>
                </div>
            `;
            return;
        }

        users.forEach((user, index) => {
            const card = document.createElement('div');
            card.className = 'user-card';
            card.style.animationDelay = `${index * 0.1}s`; // Staggered animation
            
            card.innerHTML = `
                <div class="badge">ID: ${user.id_utente}</div>
                <div class="user-avatar">${getInitials(user.Nome)}</div>
                <div class="user-info">
                    <h3>${user.Nome} ${user.Cognome}</h3>
                    <p>
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555ZM0 4.697v7.104l5.803-3.558L0 4.697ZM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757Zm3.436-.586L16 11.801V4.697l-5.803 3.546Z"/>
                        </svg>
                        ${user.Email}
                    </p>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        grid.innerHTML = `
            <div class="empty-state" style="border-color: var(--danger);">
                <h3 style="color: var(--danger);">Errore di connessione</h3>
                <p>Impossibile comunicare con il backend FastAPI.</p>
            </div>
        `;
    }
}

document.getElementById('logoutBtn').addEventListener('click', logout);

window.addEventListener('load', () => {
    // Il controllo token viene fatto anche in auth.js, ma qui assicuriamo che il ruolo sia giusto
    const role = localStorage.getItem('user_role');
    if (!role || role.toLowerCase().trim() !== 'super_admin') {
        window.location.href = '/login.html';
        return;
    }
    
    fetchUsers();
});
