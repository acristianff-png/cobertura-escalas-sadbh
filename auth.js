// auth.js — Login por código de email (OTP) para SAD BH
// Não requer Google Cloud Console nem OAuth Client ID.
// Fluxo: usuário informa email → recebe código no email → digita código → acesso liberado
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

  function _setBtnLoading(btnId, loading) {
    var btn = document.getElementById(btnId);
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

        // ── Passo 1: email ──
        '<div id="auth-step-email">' +
          '<p style="color:#1b2438;font-size:14px;margin:0 0 12px;font-family:sans-serif">' +
            'Informe seu e-mail institucional</p>' +
          '<input id="auth-email-input" type="email" placeholder="email@pbh.gov.br" ' +
            'onkeydown="if(event.key===\'Enter\')authEnviarCodigo()" ' +
            'style="width:100%;padding:10px 14px;border:1.5px solid #d0d7e3;border-radius:8px;' +
            'font-size:14px;margin-bottom:12px;box-sizing:border-box;outline:none;">' +
          '<button id="btn-enviar" onclick="authEnviarCodigo()" ' +
            'style="width:100%;padding:11px;background:#2e7d4f;color:#fff;border:none;' +
            'border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">' +
            'Enviar c\u00f3digo por e-mail</button>' +
        '</div>' +

        // ── Passo 2: OTP ──
        '<div id="auth-step-otp" style="display:none;">' +
          '<p id="auth-otp-msg" style="color:#6b7a96;font-size:13px;margin:0 0 16px;font-family:sans-serif"></p>' +
          '<input id="auth-otp-input" type="text" inputmode="numeric" maxlength="6" ' +
            'placeholder="_ _ _ _ _ _" onkeydown="if(event.key===\'Enter\')authVerificarCodigo()" ' +
            'style="width:100%;padding:12px 14px;border:1.5px solid #d0d7e3;border-radius:8px;' +
            'font-size:26px;text-align:center;letter-spacing:8px;margin-bottom:12px;' +
            'box-sizing:border-box;outline:none;">' +
          '<button id="btn-confirmar" onclick="authVerificarCodigo()" ' +
            'style="width:100%;padding:11px;background:#2e7d4f;color:#fff;border:none;' +
            'border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">' +
            'Confirmar</button>' +
          '<br>' +
          '<button onclick="authVoltarEmail()" ' +
            'style="margin-top:10px;background:none;border:none;color:#6b7a96;' +
            'font-size:12px;cursor:pointer;font-family:sans-serif">' +
            '\u2190 Usar outro e-mail</button>' +
        '</div>' +

        '<p id="auth-status" style="margin:14px 0 0;font-size:13px;min-height:18px;' +
          'font-family:sans-serif"></p>' +
      '</div>';
    document.body.insertBefore(div, document.body.firstChild);
  }

  // ── Ações do formulário ───────────────────────────────────────────────────

  window.authEnviarCodigo = function () {
    var email = (document.getElementById('auth-email-input').value || '').trim();
    if (!email) { _setStatus('Informe seu e-mail.', true); return; }
    _setStatus('Enviando c\u00f3digo...', false);
    _setBtnLoading('btn-enviar', true);

    var url = new URL(window.API_URL);
    url.searchParams.set('acao', 'solicitar_otp');
    url.searchParams.set('email', email);

    fetch(url.toString())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        _setBtnLoading('btn-enviar', false);
        if (d.ok) {
          document.getElementById('auth-step-email').style.display = 'none';
          document.getElementById('auth-step-otp').style.display = 'block';
          document.getElementById('auth-otp-msg').textContent =
            'C\u00f3digo enviado para ' + email + '. Verifique sua caixa de entrada.';
          _setStatus('', false);
          setTimeout(function () {
            var inp = document.getElementById('auth-otp-input');
            if (inp) inp.focus();
          }, 100);
        } else {
          _setStatus(d.erro || 'Erro ao enviar c\u00f3digo.', true);
        }
      })
      .catch(function () {
        _setBtnLoading('btn-enviar', false);
        _setStatus('Erro de conex\u00e3o. Verifique sua internet.', true);
      });
  };

  window.authVerificarCodigo = function () {
    var email = (document.getElementById('auth-email-input').value || '').trim();
    var code = (document.getElementById('auth-otp-input').value || '').replace(/\s/g, '').trim();
    if (!code || code.length < 6) { _setStatus('Informe o c\u00f3digo de 6 d\u00edgitos.', true); return; }
    _setStatus('Verificando...', false);
    _setBtnLoading('btn-confirmar', true);

    var url = new URL(window.API_URL);
    url.searchParams.set('acao', 'verificar_otp');
    url.searchParams.set('email', email);
    url.searchParams.set('code', code);

    fetch(url.toString())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        _setBtnLoading('btn-confirmar', false);
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
          _setStatus(d.erro || 'C\u00f3digo inv\u00e1lido.', true);
        }
      })
      .catch(function () {
        _setBtnLoading('btn-confirmar', false);
        _setStatus('Erro de conex\u00e3o.', true);
      });
  };

  window.authVoltarEmail = function () {
    document.getElementById('auth-step-email').style.display = 'block';
    document.getElementById('auth-step-otp').style.display = 'none';
    document.getElementById('auth-otp-input').value = '';
    _setStatus('', false);
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

    // Sem sessão válida — exibir formulário de login
    _showOverlay();
  });
})();
