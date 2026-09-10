// POSTECK Billing — shared frontend logic (talks to the Apps Script backend as a JSON API).
var API_URL = 'https://script.google.com/macros/s/AKfycbySzcefvDJjOHLkwoGo39J67bo3-cFT--zjlAV0ZC0AeVmWwRo3RkelRu3-fisA5Q6lcA/exec';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}

var TOKEN_KEY = 'pt-billing-token';
var THEME_KEY = 'pt-billing-theme';

// Apply saved/system theme immediately (called inline in <head>, before paint).
function applyStoredTheme() {
  var saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  var theme = saved || ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}

function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
}

function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
}

/** Call once at the top of every protected page. Redirects to login.html if not signed in. */
function requireAuth() {
  var token = getToken();
  if (!token) {
    location.href = 'login.html';
    return null;
  }
  return token;
}

/** POST {action, ...payload} to the Apps Script backend and return its `data` on success.
 * Apps Script's exec URL occasionally mis-routes a POST to doGet() instead of doPost() (a
 * transient Google-side redirect quirk, not tied to any specific action) — that response is
 * always the exact same static text from doGet(), which proves doPost() (and so every action
 * handler, including writes like submitMaterial) never ran. Retrying is therefore safe in that
 * one specific case; any other unparseable response is surfaced as a real error instead. */
function apiCallOnce_(action, payload) {
  var body = Object.assign({ action: action, token: getToken() }, payload || {});
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids a CORS preflight
    body: JSON.stringify(body)
  }).then(function (res) { return res.text(); });
}

var DOGET_MISROUTE_SIGNATURE_ = 'POSTECK Billing API';

function apiCall(action, payload, _retriesLeft) {
  if (_retriesLeft === undefined) _retriesLeft = 2;
  return apiCallOnce_(action, payload).then(function (text) {
    var json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      if (_retriesLeft > 0 && text.indexOf(DOGET_MISROUTE_SIGNATURE_) !== -1) {
        return apiCall(action, payload, _retriesLeft - 1);
      }
      throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (ลองใหม่อีกครั้ง): ' + e.message);
    }
    if (!json.ok) {
      var err = new Error(json.error || 'เกิดข้อผิดพลาด');
      if (json.authError) { clearToken(); location.href = 'login.html'; }
      throw err;
    }
    return json.data;
  });
}

function wireTopbar(activePage) {
  document.querySelectorAll('.topnav a[data-page]').forEach(function (el) {
    if (el.dataset.page === activePage) el.classList.add('active');
  });

  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    var updateIcon = function () {
      themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    };
    updateIcon();
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      updateIcon();
    });
  }

  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (!confirm('ออกจากระบบ?')) return;
      var token = getToken();
      clearToken();
      if (token) apiCall('logout').catch(function () {});
      location.href = 'login.html';
    });
  }
}

function todayISO() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function showResult(boxId, docNo, originalUrl, copyUrl) {
  var box = document.getElementById(boxId);
  box.className = 'result-box';
  box.innerHTML = 'ออกเอกสารเลขที่ <strong>' + docNo + '</strong> เรียบร้อย — ' +
    '<a href="' + originalUrl + '" target="_blank" rel="noopener">เปิดต้นฉบับ</a>' +
    ' &nbsp;|&nbsp; ' +
    '<a href="' + copyUrl + '" target="_blank" rel="noopener">เปิดสำเนา</a>';
  box.style.display = 'block';
}

function showError(boxId, message) {
  var box = document.getElementById(boxId);
  box.className = 'error-box';
  box.textContent = 'เกิดข้อผิดพลาด: ' + message;
  box.style.display = 'block';
}

// Cascading Project -> Building -> Floor dropdowns, backed by getProjectsData.
function wireProjectCascade(projectId, buildingId, floorId) {
  var projectSel = document.getElementById(projectId);
  var buildingSel = document.getElementById(buildingId);
  var floorSel = document.getElementById(floorId);
  var dataMap = {};

  function fillSelect(sel, options, placeholder) {
    sel.innerHTML = '';
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder;
    sel.appendChild(ph);
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      sel.appendChild(opt);
    });
  }

  projectSel.addEventListener('change', function () {
    var buildings = Object.keys(dataMap[projectSel.value] || {});
    fillSelect(buildingSel, buildings, '-- เลือกอาคาร --');
    fillSelect(floorSel, [], '-- เลือกชั้น --');
  });

  buildingSel.addEventListener('change', function () {
    var floors = (dataMap[projectSel.value] || {})[buildingSel.value] || [];
    fillSelect(floorSel, floors, '-- เลือกชั้น --');
  });

  apiCall('getProjectsData').then(function (map) {
    dataMap = map || {};
    fillSelect(projectSel, Object.keys(dataMap), '-- เลือกโครงการ --');
    if (Object.keys(dataMap).length === 0) {
      projectSel.insertAdjacentHTML('afterend',
        '<div class="hint">ยังไม่มีข้อมูลโครงการ — เพิ่มแถว Project/Building/Floor ในแท็บ Projects ของ Google Sheet ก่อน</div>');
    }
  }).catch(function (err) {
    projectSel.insertAdjacentHTML('afterend', '<div class="hint">โหลดรายชื่อโครงการไม่สำเร็จ: ' + err.message + '</div>');
  });
}

/** Auto-fills a PO/WO input from the selected project's registered PO (still freely editable after).
 * Re-fetches on every change instead of caching one early load, so a single failed/slow request
 * on page load can't permanently disable the autofill for the rest of the page's lifetime. */
function wireProjectPOAutofill(projectId, poId, poField) {
  var projectSel = document.getElementById(projectId);
  var poInput = document.getElementById(poId);

  projectSel.addEventListener('change', function () {
    var projectName = projectSel.value;
    if (!projectName) return;
    apiCall('listRegisteredProjects').then(function (rows) {
      var row = (rows || []).filter(function (r) { return r.ProjectName === projectName; })[0];
      if (row) poInput.value = row[poField] || '';
    }).catch(function () {});
  });
}

/** Repeatable {desc, area} item rows (ค่าวัสดุ/ค่าแรง) — add/remove, matching the stud item-row pattern.
 * `defaultItems` (optional array of {desc, area}) seeds the initial rows; falls back to one blank row. */
function wireItemRows(containerId, addBtnId, defaultItems) {
  var container = document.getElementById(containerId);

  function addRow(desc, area) {
    var row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML =
      '<div class="field" style="flex:2"><label>รายการ</label><input type="text" class="item-desc" value="' + (desc || '') + '" required></div>' +
      '<div class="field" style="flex:1"><label>พื้นที่ (m²)</label><input type="number" step="0.01" class="item-area" value="' + (area || '') + '"></div>' +
      '<button type="button" class="btn btn-secondary remove-item">ลบ</button>';
    row.querySelector('.remove-item').addEventListener('click', function () {
      if (container.querySelectorAll('.item-row').length <= 1) return; // keep at least one row
      row.remove();
    });
    container.appendChild(row);
  }

  document.getElementById(addBtnId).addEventListener('click', function () { addRow(); });
  (defaultItems && defaultItems.length ? defaultItems : [{}]).forEach(function (it) { addRow(it.desc, it.area); });

  return function getItems() {
    return [].slice.call(container.querySelectorAll('.item-row')).map(function (row) {
      return {
        desc: row.querySelector('.item-desc').value.trim(),
        area: row.querySelector('.item-area').value
      };
    }).filter(function (it) { return it.desc && it.area; });
  };
}
