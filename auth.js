// auth.js — Login por e-mail cadastrado para SAD BH
// Sem necessidade de Google OAuth ou envio de e-mail.
// O controle de acesso é feito via cad_acessos no Apps Script.
(function () {
  var STORAGE_KEY = 'sad_sess';

  // ── Estado global ─────────────────────────────────────────────────────────
  window.gsiCredential = null; // token de sessão (UUID gerado pelo Apps Script)
  window.gsiEmail = null;

  var _pending = [];
  var _done = false;

  // ── API pública ───────────────────────────────────────────────────────────
  window.authReady = function (fn) {
    if (_done) { fn(); } else { _pending.push(fn); }
  };

  // ── Internos ──────────────────────────────────────────────────────────────
  function _fire() {
    _done = true;
    var cbs = _pending.slice(); _pending = [];
    cbs.forEach(function (fn) { fn(); });
  }

  function _showOverlay() {
    var el = document.getElementById('signin-overlay');
    if (el) el.style.display = 'flex';
  }

  function _hideOverlay() {
    var el = document.getElementById('signin-overlay');
    if (el) el.style.display = 'none';
  }

  function _setStatus(msg, isError) {
    var el = document.getElementById('auth-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#c0392b' : '#6b7a96';
  }

  function _setBtnLoading(id, loading) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.6' : '1';
  }

  function _injectOverlay() {
    if (document.getElementById('signin-overlay')) return;
    var div = document.createElement('div');
    div.id = 'signin-overlay';
    div.style.cssText =
      'display:none;position:fixed;inset:0;background:rgba(15,23,42,.82);' +
      'z-index:9999;align-items:center;justify-content:center;';
    div.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:44px 40px;text-align:center;' +
      'max-width:380px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,.35);">' +
        '<div style="font-size:40px;margin-bottom:10px">&#x1F3E5;</div>' +
        '<h2 style="margin:0 0 4px;font-size:20px;color:#1b2438;font-weight:600;font-family:sans-serif">' +
          'Cobertura de Escalas</h2>' +
        '<p style="color:#6b7a96;margin:0 0 24px;font-size:13px;font-family:sans-serif">SAD BH</p>' +
        '<p style="color:#1b2438;font-size:14px;margin:0 0 12px;font-family:sans-serif;text-align:left">' +
          'Informe seu e-mail institucional:</p>' +
        '<input id="auth-email-input" type="email" placeholder="email@pbh.gov.br" ' +
          'onkeydown="if(event.key===\'Enter\')authEntrar()" ' +
          'style="width:100%;padding:10px 14px;border:1.5px solid #d0d7e3;border-radius:8px;' +
          'font-size:14px;margin-bottom:12px;box-sizing:border-box;outline:none;font-family:sans-serif;">' +
        '<button id="btn-entrar" onclick="authEntrar()" ' +
          'style="width:100%;padding:11px;background:#2e7d4f;color:#fff;border:none;' +
          'border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:sans-serif;">' +
          'Entrar</button>' +
        '<p id="auth-status" style="margin:14px 0 0;font-size:13px;min-height:18px;' +
          'font-family:sans-serif;color:#6b7a96"></p>' +
      '</div>';
    document.body.insertBefore(div, document.body.firstChild);
  }

  // ── Ação do formulário ────────────────────────────────────────────────────
  window.authEntrar = function () {
    var email = (document.getElementById('auth-email-input').value || '').trim();
    if (!email) { _setStatus('Informe seu e-mail.', true); return; }
    _setStatus('Verificando...', false);
    _setBtnLoading('btn-entrar', true);

    var url = new URL(API_URL);
    url.searchParams.set('acao', 'autenticar_email');
    url.searchParams.set('email', email);

    fetch(url.toString())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        _setBtnLoading('btn-entrar', false);
        if (d.ok) {
          window.gsiCredential = d.token;
          window.gsiEmail = email;
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
            token: d.token,
            email: email,
            exp: Date.now() + 3600000 // 1 hora
          }));
          _hideOverlay();
          _fire();
        } else {
          _setStatus(d.erro || 'E-mail não autorizado.', true);
        }
      })
      .catch(function () {
        _setBtnLoading('btn-entrar', false);
        _setStatus('Erro de conexão. Tente novamente.', true);
      });
  };

  // ── Inicialização ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    _injectOverlay();

    // Checar sessão salva
    var stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        var s = JSON.parse(stored);
        if (s.token && s.email && s.exp > Date.now()) {
          window.gsiCredential = s.token;
          window.gsiEmail = s.email;
          _hideOverlay();
          _fire();
          return;
        }
      } catch (e) {}
      sessionStorage.removeItem(STORAGE_KEY);
    }

    // Sem sessão válida — exibir formulário
    _showOverlay();
    // Foco automático no campo de email
    setTimeout(function () {
      var inp = document.getElementById('auth-email-input');
      if (inp) inp.focus();
    }, 100);
  });
})();
