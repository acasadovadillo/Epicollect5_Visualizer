// ── Contraseña de acceso ───────────────────────────────────────────────────
// Cambia este valor para actualizar la contraseña del dashboard
const _AUTH_PASS = 'Abies2025';
const _AUTH_KEY  = 'abies_auth_v1';

// ── API pública ────────────────────────────────────────────────────────────
function isLoggedIn() {
    return sessionStorage.getItem(_AUTH_KEY) === '1';
}

function logout() {
    sessionStorage.removeItem(_AUTH_KEY);
    location.reload();
}

// ── Inicialización ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const btnLogin  = document.getElementById('btn-navbar-login');
    const btnLogout = document.getElementById('btn-navbar-logout');
    const modal     = new bootstrap.Modal(document.getElementById('loginModal'));

    // Estado navbar
    if (isLoggedIn()) {
        btnLogin?.classList.add('d-none');
        btnLogout?.classList.remove('d-none');
    }

    // Overlay de carga → mensaje de acceso cuando no autenticado
    if (!isLoggedIn()) {
        document.getElementById('loading-overlay').innerHTML = `
            <div class="text-center">
                <i class="fas fa-lock fa-3x text-success mb-3"></i>
                <p class="text-muted mb-0">Inicia sesión para acceder al dashboard</p>
            </div>`;
        modal.show();
    }

    // Botón "Entrar" en navbar
    btnLogin?.addEventListener('click', () => modal.show());

    // Botón "Salir" en navbar
    btnLogout?.addEventListener('click', logout);

    // Toggle mostrar/ocultar contraseña
    document.getElementById('btn-toggle-pwd')?.addEventListener('click', () => {
        const input = document.getElementById('auth-password');
        const icon  = document.querySelector('#btn-toggle-pwd i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });

    // Enviar contraseña
    function attemptLogin() {
        const pwd = document.getElementById('auth-password').value;
        if (pwd === _AUTH_PASS) {
            sessionStorage.setItem(_AUTH_KEY, '1');
            location.reload();
        } else {
            document.getElementById('auth-error').classList.remove('d-none');
            document.getElementById('auth-password').value = '';
            document.getElementById('auth-password').focus();
        }
    }

    document.getElementById('btn-auth-submit')?.addEventListener('click', attemptLogin);

    document.getElementById('auth-password')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') attemptLogin();
    });
});
