(function () {
  'use strict';

  // Adres aplikacji wyciagamy z src skryptu, dzieki czemu widget dziala niezaleznie
  // od domeny WP — wystarczy zmienic src w snippecie.
  var scriptEl = document.currentScript;
  if (!scriptEl) {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('/embed/widget.js') !== -1) {
        scriptEl = scripts[i];
        break;
      }
    }
  }
  if (!scriptEl) return;

  var apiBase;
  try {
    apiBase = new URL(scriptEl.src).origin;
  } catch {
    return;
  }

  var STYLES = [
    '.bs-trip-form{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}',
    '.bs-trip-form h3{margin:0 0 4px;font-size:20px;font-weight:700}',
    '.bs-trip-form p.bs-sub{margin:0 0 20px;font-size:14px;color:#64748b}',
    '.bs-trip-form label{display:block;margin-bottom:12px;font-size:13px;font-weight:600}',
    '.bs-trip-form label span.bs-req{color:#dc2626;margin-left:2px}',
    '.bs-trip-form input{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:8px 10px;font-size:14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-family:inherit}',
    '.bs-trip-form textarea{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:8px 10px;font-size:14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font-family:inherit;resize:vertical;min-height:84px}',
    '.bs-trip-form input:focus,.bs-trip-form textarea:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.15)}',
    '.bs-trip-form .bs-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
    '.bs-trip-form .bs-row label{margin-bottom:0}',
    '.bs-trip-form button{margin-top:8px;width:100%;padding:11px 16px;font-size:15px;font-weight:700;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;font-family:inherit}',
    '.bs-trip-form button:hover{background:#1d4ed8}',
    '.bs-trip-form button:disabled{background:#94a3b8;cursor:not-allowed}',
    '.bs-trip-form .bs-msg{margin-top:12px;padding:10px 12px;border-radius:8px;font-size:14px}',
    '.bs-trip-form .bs-msg.bs-ok{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}',
    '.bs-trip-form .bs-msg.bs-err{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}',
    '.bs-trip-form .bs-rodo{margin-top:8px;font-size:11px;color:#64748b;line-height:1.4}',
  ].join('');

  function injectStyles() {
    if (document.getElementById('bs-trip-form-styles')) return;
    var s = document.createElement('style');
    s.id = 'bs-trip-form-styles';
    s.appendChild(document.createTextNode(STYLES));
    document.head.appendChild(s);
  }

  function errorLabel(err) {
    if (err === 'origin_not_allowed') return 'Formularz nie jest skonfigurowany dla tej domeny. Skontaktuj sie z administratorem.';
    if (err === 'registrations_closed') return 'Zapisy na ten wyjazd sa obecnie zamkniete.';
    if (err === 'trip_not_found') return 'Nie znaleziono wyjazdu. Skontaktuj sie z administratorem.';
    if (err === 'validation_failed') return 'Sprawdz poprawnosc danych w formularzu.';
    if (err === 'db_error') return 'Wystapil blad zapisu. Sprobuj ponownie za chwile.';
    return 'Cos poszlo nie tak. Sprobuj ponownie.';
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          if (key === 'className') node.className = attrs[key];
          else if (key === 'text') node.appendChild(document.createTextNode(attrs[key]));
          else node.setAttribute(key, attrs[key]);
        }
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        if (children[i]) node.appendChild(children[i]);
      }
    }
    return node;
  }

  function labelWithInput(labelText, inputAttrs) {
    var labelEl = el('label');
    labelEl.appendChild(document.createTextNode(labelText + ' '));
    labelEl.appendChild(el('span', { className: 'bs-req', text: '*' }));
    labelEl.appendChild(el('input', inputAttrs));
    return labelEl;
  }

  function labelWithTextarea(labelText, textareaAttrs) {
    var labelEl = el('label');
    labelEl.appendChild(document.createTextNode(labelText));
    labelEl.appendChild(el('textarea', textareaAttrs));
    return labelEl;
  }

  function renderMessage(container, text, kind) {
    var box = el('div', { className: 'bs-trip-form' });
    box.appendChild(el('h3', { text: 'Zapisz dziecko' }));
    box.appendChild(el('div', { className: 'bs-msg ' + (kind === 'ok' ? 'bs-ok' : 'bs-err'), text: text }));
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(box);
  }

  function renderForm(container, tripId) {
    var form = el('form', { className: 'bs-trip-form', novalidate: 'novalidate' });

    form.appendChild(el('h3', { text: 'Zapisz dziecko' }));
    form.appendChild(el('p', { className: 'bs-sub', text: 'Wypelnij formularz — admin BiegunSport potwierdzi zapis mailem.' }));

    var row1 = el('div', { className: 'bs-row' });
    row1.appendChild(labelWithInput('Imie dziecka', { name: 'child_first_name', type: 'text', required: 'required', minlength: '2', maxlength: '50', autocomplete: 'off' }));
    row1.appendChild(labelWithInput('Nazwisko dziecka', { name: 'child_last_name', type: 'text', required: 'required', minlength: '2', maxlength: '50', autocomplete: 'off' }));
    form.appendChild(row1);

    var row2 = el('div', { className: 'bs-row' });
    row2.appendChild(labelWithInput('Data urodzenia', { name: 'child_birth_date', type: 'date', required: 'required' }));
    row2.appendChild(labelWithInput('Wzrost (cm)', { name: 'child_height_cm', type: 'number', required: 'required', min: '50', max: '250', step: '1' }));
    form.appendChild(row2);

    form.appendChild(labelWithInput('E-mail rodzica', { name: 'parent_email', type: 'email', required: 'required', maxlength: '120', autocomplete: 'email' }));
    form.appendChild(labelWithInput('Telefon rodzica', { name: 'parent_phone', type: 'tel', required: 'required', minlength: '6', maxlength: '30', autocomplete: 'tel' }));
    form.appendChild(labelWithTextarea('Uwagi / alergie / informacje dla organizatora', { name: 'organizer_notes', maxlength: '1000', placeholder: 'Opcjonalnie' }));

    var btn = el('button', { type: 'submit', text: 'Wyslij zgloszenie' });
    form.appendChild(btn);

    var msgEl = el('div', { className: 'bs-msg' });
    msgEl.style.display = 'none';
    form.appendChild(msgEl);

    form.appendChild(el('p', { className: 'bs-rodo', text: 'Wysylajac formularz akceptujesz, ze BiegunSport bedzie kontaktowal sie z toba w sprawie tego zgloszenia.' }));

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(form);

    function showMsg(text, kind) {
      msgEl.className = 'bs-msg ' + (kind === 'ok' ? 'bs-ok' : 'bs-err');
      msgEl.textContent = text;
      msgEl.style.display = 'block';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msgEl.style.display = 'none';

      var fd = new FormData(form);
      var payload = {
        trip_id: tripId,
        child: {
          first_name: String(fd.get('child_first_name') || '').trim(),
          last_name: String(fd.get('child_last_name') || '').trim(),
          birth_date: String(fd.get('child_birth_date') || ''),
          height_cm: parseInt(String(fd.get('child_height_cm') || '0'), 10) || null,
        },
        parent: {
          email: String(fd.get('parent_email') || '').trim(),
          phone: String(fd.get('parent_phone') || '').trim(),
        },
        organizer_notes: String(fd.get('organizer_notes') || '').trim() || null,
      };

      btn.disabled = true;
      btn.textContent = 'Wysylam...';

      fetch(apiBase + '/api/public/trip-registrations-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (json) {
            return { status: res.status, json: json };
          });
        })
        .then(function (r) {
          if (r.status === 200 && r.json.deduped) {
            showMsg('To zgloszenie juz zostalo przyjete. Czekaj na potwierdzenie mailem.', 'ok');
            return;
          }
          if (r.status === 201) {
            showMsg('Zgloszenie przyjete. Po zatwierdzeniu przez admina otrzymasz mail z potwierdzeniem.', 'ok');
            form.reset();
            return;
          }
          showMsg(errorLabel(r.json && r.json.error), 'err');
        })
        .catch(function () {
          showMsg('Brak polaczenia z serwerem. Sprobuj ponownie.', 'err');
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = 'Wyslij zgloszenie';
        });
    });
  }

  function render(container, tripId) {
    renderMessage(container, 'Sprawdzam status zapisow...', 'ok');

    fetch(apiBase + '/api/public/trips/' + encodeURIComponent(tripId), {
      method: 'GET',
    })
      .then(function (res) {
        return res.json().then(function (json) {
          return { status: res.status, json: json };
        });
      })
      .then(function (r) {
        if (r.status === 200 && r.json && r.json.is_open) {
          renderForm(container, tripId);
          return;
        }
        if (r.status === 200) {
          renderMessage(container, 'Zapisy na ten wyjazd sa obecnie zamkniete.', 'err');
          return;
        }
        renderMessage(container, errorLabel(r.json && r.json.error), 'err');
      })
      .catch(function () {
        renderMessage(container, 'Nie udalo sie sprawdzic statusu zapisow. Sprobuj ponownie pozniej.', 'err');
      });
  }

  function init() {
    injectStyles();
    var nodes = document.querySelectorAll('[data-bs-trip]');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.getAttribute('data-bs-rendered') === '1') continue;
      var tripId = node.getAttribute('data-bs-trip');
      if (!tripId) continue;
      node.setAttribute('data-bs-rendered', '1');
      render(node, tripId);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
