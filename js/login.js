/* ═══════════════════════════════════════════════
   CCTV Fleet Control — Login Screen Logic v7.0
   Corregido: sin setTimeout bug, sin recoveryMode trap,
   bootstrap admin/admin → formulario master correcto.
═══════════════════════════════════════════════ */

const LOGIN_STATE = {
  screen: 'login',
  recoveryResult: null,
};

document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    try {
      const session = await AUTH.checkSessionAsync();
      // Solo redirigir si hay sesión limpia y completa (sin firstLogin ni recoveryMode)
      if (session && !session.firstLogin && !session.bootstrapMaster && !session.recoveryMode) {
        AUTH.redirect(session);
        return;
      }
      // Sesión de recuperación válida
      if (session && session.recoveryMode) {
        showScreen('recovery-newpass');
        return;
      }
      // Sesión de primer login (ya pasó por bootstrap, falta llenar datos)
      if (session && (session.firstLogin || session.bootstrapMaster)) {
        showScreen('change-pass');
        return;
      }
    } catch(e) {
      console.warn('[LOGIN] checkSessionAsync error:', e.message);
      // Limpiar sesión corrupta y mostrar login normal
      try { await AUTH.logout(); } catch {}
    }
    showScreen('login');
  })();

  updateLoginClock();
  setInterval(updateLoginClock, 1000);

  const loginUserInput = document.getElementById('loginUser');
  if (loginUserInput) loginUserInput.addEventListener('input', handleUserFieldChange);

  const np1 = document.getElementById('newPass1');
  if (np1) np1.addEventListener('input', () => updateStrengthMeter(np1.value));

  const rp1 = document.getElementById('recoverNewPass1');
  if (rp1) rp1.addEventListener('input', () =>
    updateStrengthMeterEl('recoverStrengthWrap','recoverStrengthFill','recoverStrengthLabel', rp1.value));
});

/* ─── RELOJ ──────────────────────────────────── */
function updateLoginClock() {
  const el = document.getElementById('loginClock');
  if (el) el.textContent = new Date().toLocaleTimeString('es-MX',
    { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─── TOGGLE CONTRASEÑA ──────────────────────── */
function togglePassVis(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  btn.style.color = isPass ? 'var(--accent)' : 'var(--text3)';
}

/* ─── ERRORES ─────────────────────────────────  */
function showLoginError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${msg}</span>`;
  el.classList.add('show');
}

function clearLoginError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

function shakeCard() {
  const card = document.getElementById('loginCard');
  if (!card) return;
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = 'errShake 0.4s ease';
}

/* ─── SUPER ADMIN LINK ────────────────────────── */
function handleUserFieldChange() {
  const val  = document.getElementById('loginUser').value;
  const link = document.getElementById('forgotPassLink');
  if (!link) return;
  link.style.display = AUTH.isSuperAdminUsername(val) ? 'flex' : 'none';
}

/* ─── CONFIGURAR CAMPOS PRIMER LOGIN ─────────── */
async function configureFirstLoginFields() {
  const session = await AUTH.checkSessionAsync();
  const isTech = session && String(session.role || '').toLowerCase() === 'tecnico';

  const adminFields = document.querySelectorAll('[data-first-field="admin"]');
  adminFields.forEach(el => {
    el.classList.toggle('is-hidden-first-field', isTech);
    el.querySelectorAll('input, select, textarea').forEach(input => {
      input.disabled = isTech;
      if (isTech) input.removeAttribute('required');
    });
  });

  const title    = document.querySelector('#formChangePass .login-card-header h2');
  const subtitle = document.querySelector('#formChangePass .login-card-header p');
  const alert    = document.querySelector('#formChangePass .change-pass-alert');
  if (isTech) {
    if (title)    title.textContent    = 'Completar Acceso Técnico';
    if (subtitle) subtitle.textContent = 'Agrega contraseña nueva, teléfono e ID de empleado para continuar';
    if (alert)    alert.lastChild.textContent = ' Primer acceso detectado. Solo se requieren datos técnicos obligatorios.';
  } else {
    if (title)    title.textContent    = 'Configurar Administrador Master';
    if (subtitle) subtitle.textContent = 'Por seguridad debes completar tu perfil y contraseña antes de continuar';
    if (alert)    alert.lastChild.textContent = ' Primer acceso detectado. Esta acción es obligatoria y no puede omitirse.';
  }
}

/* ─── PANTALLAS ───────────────────────────────── */
function showScreen(screen) {
  LOGIN_STATE.screen = screen;
  ['formLogin','formChangePass','formRecoverySend','formRecoveryCode','formRecoveryNewPass']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

  const map = {
    'login':            'formLogin',
    'change-pass':      'formChangePass',
    'recovery-send':    'formRecoverySend',
    'recovery-code':    'formRecoveryCode',
    'recovery-newpass': 'formRecoveryNewPass',
  };

  const target = document.getElementById(map[screen]);
  if (target) target.style.display = 'block';

  if (screen === 'change-pass')
    configureFirstLoginFields().catch(e => console.warn('[LOGIN] configureFirstLoginFields:', e));

  setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
}

/* ─── STRENGTH METER ──────────────────────────── */
function calcStrength(pass) {
  let score = 0;
  if (pass.length >= 6)           score++;
  if (pass.length >= 10)          score++;
  if (/[A-Z]/.test(pass))         score++;
  if (/[0-9]/.test(pass))         score++;
  if (/[^A-Za-z0-9]/.test(pass))  score++;
  const levels = [
    { pct: 20, color: '#ef4444', txt: 'Muy débil' },
    { pct: 40, color: '#f97316', txt: 'Débil' },
    { pct: 60, color: '#f59e0b', txt: 'Regular' },
    { pct: 80, color: '#84cc16', txt: 'Fuerte' },
    { pct: 100,color: '#22c55e', txt: 'Muy fuerte' },
  ];
  return levels[Math.min(score, levels.length) - 1] || levels[0];
}

function updateStrengthMeterEl(wrapId, fillId, labelId, pass) {
  const wrap  = document.getElementById(wrapId);
  const fill  = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if (!wrap) return;
  if (!pass || !pass.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  const level = calcStrength(pass);
  fill.style.width      = level.pct + '%';
  fill.style.background = level.color;
  label.style.color     = level.color;
  label.textContent     = level.txt;
}

function updateStrengthMeter(pass) {
  updateStrengthMeterEl('passStrengthWrap','passStrengthFill','passStrengthLabel', pass);
}

/* ════════════════════════════════════════════════
   FLUJO LOGIN — CORREGIDO sin setTimeout bug
════════════════════════════════════════════════ */
async function doLogin() {
  clearLoginError('loginError');

  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;

  if (!username) { showLoginError('loginError', 'Ingresa tu usuario'); return; }
  if (!password) { showLoginError('loginError', 'Ingresa tu contraseña'); return; }

  const btn  = document.getElementById('btnLogin');
  const text = btn.querySelector('.btn-login-text');
  btn.disabled  = true;
  btn.classList.add('loading');
  text.textContent = 'Verificando...';

  try {
    const result = await AUTH.login(username, password);

    if (!result.ok) {
      if (result.blocked) {
        showBlockedScreen(result.error);
      } else {
        showLoginError('loginError', result.error);
        shakeCard();
      }
      return;
    }

    if (result.firstLogin || result.session?.bootstrapMaster) {
      showScreen('change-pass');
    } else {
      AUTH.redirect(result.session);
    }
  } catch(e) {
    showLoginError('loginError', 'Error inesperado: ' + e.message);
    shakeCard();
  } finally {
    btn.disabled  = false;
    btn.classList.remove('loading');
    text.textContent = 'Acceder al Sistema';
  }
}

/* ─── PANTALLA BLOQUEADA ─────────────────────── */
function showBlockedScreen(msg) {
  const card = document.getElementById('loginCard');
  if (!card) return;
  card.innerHTML = `
    <div style="padding:36px 28px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;">
      <div style="width:60px;height:60px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);
                  border-radius:50%;display:flex;align-items:center;justify-content:center;color:#ef4444;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          <line x1="12" y1="15" x2="12" y2="17"/>
        </svg>
      </div>
      <div>
        <div style="font-size:16px;font-weight:700;color:#ef4444;margin-bottom:8px;">Acceso Restringido</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.6;max-width:320px;">${msg}</div>
      </div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--text3);background:var(--bg3);
                  border:1px solid var(--border);border-radius:8px;padding:10px 16px;width:100%;text-align:left;">
        Intento registrado · ${new Date().toLocaleString('es-MX')}
      </div>
      <button onclick="location.reload()" style="background:var(--bg3);border:1px solid var(--border);
              border-radius:8px;color:var(--text2);padding:9px 20px;cursor:pointer;font-size:13px;font-family:var(--font);">
        ← Volver
      </button>
    </div>`;
}

/* ════════════════════════════════════════════════
   FLUJO CAMBIO / PRIMER LOGIN
════════════════════════════════════════════════ */
async function doChangePass() {
  clearLoginError('changePassError');

  const session = await AUTH.checkSessionAsync();
  const isTech  = session && String(session.role || '').toLowerCase() === 'tecnico';

  const nombre          = document.getElementById('firstNombre')?.value.trim()         || '';
  const base            = document.getElementById('firstBase')?.value.trim()            || '';
  const email           = document.getElementById('firstEmail')?.value.trim()           || '';
  const telefono        = document.getElementById('firstTelefono')?.value.trim()        || '';
  const fechaNacimiento = document.getElementById('firstFechaNacimiento')?.value        || '';
  const empleadoId      = document.getElementById('firstEmpleadoId')?.value.trim()      || '';
  const p1              = document.getElementById('newPass1').value;
  const p2              = document.getElementById('newPass2').value;

  if (!isTech) {
    if (!nombre)        { showLoginError('changePassError', 'Ingresa el nombre completo'); return; }
    if (!base)          { showLoginError('changePassError', 'Ingresa la base donde pertenece'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      { showLoginError('changePassError', 'Ingresa un correo electrónico válido'); return; }
    if (!fechaNacimiento) { showLoginError('changePassError', 'Ingresa la fecha de nacimiento'); return; }
  }
  if (!telefono)    { showLoginError('changePassError', 'Ingresa el número telefónico'); return; }
  if (!empleadoId)  { showLoginError('changePassError', 'Ingresa el ID de empleado'); return; }
  if (!p1 || p1.length < 6) { showLoginError('changePassError', 'La contraseña debe tener al menos 6 caracteres'); return; }
  if (p1 !== p2)    { showLoginError('changePassError', 'Las contraseñas no coinciden'); return; }
  if (p1.toLowerCase() === 'admin') { showLoginError('changePassError', 'No puedes usar esa contraseña'); return; }

  const btn  = document.querySelector('#formChangePass .btn-login');
  const text = btn?.querySelector('.btn-login-text');
  if (btn) { btn.disabled = true; if (text) text.textContent = 'Guardando...'; }

  try {
    const profileData = isTech
      ? { telefono, empleadoId }
      : { nombre, base, email, telefono, fechaNacimiento, empleadoId };

    const result = await AUTH.setPassword(p1, profileData);
    if (!result.ok) { showLoginError('changePassError', result.error); return; }

    const updatedSession = await AUTH.checkSessionAsync();
    AUTH.redirect(updatedSession);
  } catch(e) {
    showLoginError('changePassError', 'Error inesperado: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; if (text) text.textContent = 'Establecer Contraseña y Acceder'; }
  }
}

/* ════════════════════════════════════════════════
   RECUPERACIÓN — paso 1
════════════════════════════════════════════════ */
function showForgotPassword() { showScreen('recovery-send'); }

async function doSendRecoveryCode() {
  clearLoginError('recoverySendError');
  const recoveryEmail = document.getElementById('recoveryEmailInput')?.value.trim() || '';

  const btn  = document.querySelector('#formRecoverySend .btn-login');
  const text = btn?.querySelector('.btn-login-text');
  if (btn) { btn.disabled = true; if (text) text.textContent = 'Enviando...'; }

  try {
    const result = await AUTH.requestRecoveryCode(recoveryEmail);
    if (!result.ok) { showLoginError('recoverySendError', result.error || 'Error al generar el código'); return; }

    LOGIN_STATE.recoveryResult = result;
    const emailEl  = document.getElementById('recoveryEmailDisplay');
    const expiryEl = document.getElementById('recoveryExpiryDisplay');
    if (emailEl)  emailEl.textContent  = result.email;
    if (expiryEl) expiryEl.textContent = `${result.expiresInMin} min`;

    console.info('[RECOVERY CODE]', result.code);
    const devNote = document.getElementById('devCodeNote');
    if (devNote) { devNote.style.display = 'flex'; devNote.querySelector('.dev-code-value').textContent = result.code; }

    startRecoveryCountdown(result.expiresInMin * 60);
    showScreen('recovery-code');
  } catch(e) {
    showLoginError('recoverySendError', e.message);
  } finally {
    if (btn) { btn.disabled = false; if (text) text.textContent = 'Enviar Código de Verificación'; }
  }
}

let _countdownInterval = null;

function startRecoveryCountdown(seconds) {
  clearInterval(_countdownInterval);
  let remaining = seconds;
  function tick() {
    const el = document.getElementById('recoveryCountdown');
    if (!el) { clearInterval(_countdownInterval); return; }
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
    if (remaining <= 0) {
      clearInterval(_countdownInterval);
      el.style.color = '#ef4444';
      el.textContent = 'Expirado';
      showLoginError('recoveryCodeError', 'El código ha expirado. Solicita uno nuevo.');
    }
    remaining--;
  }
  tick();
  _countdownInterval = setInterval(tick, 1000);
}

/* ════════════════════════════════════════════════
   RECUPERACIÓN — paso 2
════════════════════════════════════════════════ */
async function doValidateRecoveryCode() {
  clearLoginError('recoveryCodeError');
  const code = document.getElementById('recoveryCodeInput').value.trim();
  if (!code || code.length < 4) { showLoginError('recoveryCodeError', 'Ingresa el código de verificación'); return; }

  const result = await AUTH.validateRecoveryCode(code);
  if (!result.ok) { showLoginError('recoveryCodeError', result.error); shakeCard(); return; }

  clearInterval(_countdownInterval);
  showScreen('recovery-newpass');
}

/* ════════════════════════════════════════════════
   RECUPERACIÓN — paso 3
════════════════════════════════════════════════ */
async function doSetRecoveredPassword() {
  clearLoginError('recoveryNewPassError');
  const p1 = document.getElementById('recoverNewPass1').value;
  const p2 = document.getElementById('recoverNewPass2').value;

  if (!p1 || p1.length < 6) { showLoginError('recoveryNewPassError', 'La contraseña debe tener al menos 6 caracteres'); return; }
  if (p1 !== p2)             { showLoginError('recoveryNewPassError', 'Las contraseñas no coinciden'); return; }

  const btn  = document.querySelector('#formRecoveryNewPass .btn-login');
  const text = btn?.querySelector('.btn-login-text');
  if (btn) { btn.disabled = true; if (text) text.textContent = 'Guardando...'; }

  try {
    const result = await AUTH.setRecoveredPassword(p1);
    if (!result.ok) { showLoginError('recoveryNewPassError', result.error); return; }
    const updatedSession = await AUTH.checkSessionAsync();
    AUTH.redirect(updatedSession);
  } catch(e) {
    showLoginError('recoveryNewPassError', e.message);
  } finally {
    if (btn) { btn.disabled = false; if (text) text.textContent = 'Guardar Nueva Contraseña'; }
  }
}

/* ─── Volver al login ─────────────────────────── */
function backToLogin() {
  clearInterval(_countdownInterval);
  showScreen('login');
}
