document.getElementById('logoutBtn').addEventListener('click', logout);

window.addEventListener('load', () => {
    const role = localStorage.getItem('user_role');
    if (!role || role.toLowerCase().trim() !== 'studente') {
        window.location.href = '/login.html';
        return;
    }
});
