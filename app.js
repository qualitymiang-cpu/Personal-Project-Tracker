/* Personal Project Tracker — MVP
 * All data lives in this browser's localStorage. No server, no account, no tracking.
 */

var STORAGE_KEY = 'ppt.projects.v1';

var STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Done'];

var SAMPLE_PROJECTS = [
  {
    name: 'Drowning Prevention Project',
    status: 'In Progress',
    progress: 45,
    dueDate: '2026-12-31',
    goal: 'Reduce child drowning deaths in the province through school-based survival swimming and trained community water-safety teams.',
    currentStatus: 'Three pilot schools have started. Waiting for the provincial health office to confirm the second-round budget.',
    completedWork: 'Baseline drowning data for 2024-2025 collected\nTrained 12 survival-swimming instructors\nPilot launched in 3 schools',
    nextActions: 'Follow up on the budget approval\nSchedule the instructor refresher in November\nDraft the 6-month progress report',
    notes: 'Key partners: provincial health office, district schools, local rescue foundation.'
  },
  {
    name: 'MIANG Learning & Transformation',
    status: 'In Progress',
    progress: 30,
    dueDate: '2027-03-31',
    goal: 'Build a practical learning and transformation programme for hospital teams that joins quality improvement with contemplative practice.',
    currentStatus: 'Curriculum outline drafted. Two modules written; looking for a first pilot ward.',
    completedWork: 'Defined the 5 core modules\nWrote Module 1 (Seeing the system)\nWrote Module 2 (Listening deeply)',
    nextActions: 'Write Module 3 (Improvement in practice)\nInvite one pilot ward\nDesign a simple before/after evaluation',
    notes: 'Keep each session under 90 minutes. Teams cannot leave the ward longer than that.'
  },
  {
    name: 'YouTube Legacy Knowledge',
    status: 'Not Started',
    progress: 10,
    dueDate: '2027-06-30',
    goal: 'Record the clinical and leadership knowledge worth passing on, as short, clear videos that outlive any one role.',
    currentStatus: 'Topic list started. No recording yet — equipment and a quiet room still to sort out.',
    completedWork: 'Listed 20 candidate topics\nChose the first 5 to record',
    nextActions: 'Buy a simple microphone\nBook a quiet room for Saturday mornings\nScript the first episode',
    notes: 'Aim for 8-12 minutes per video. Done and published beats perfect and unreleased.'
  },
  {
    name: 'Course Learning Tracker',
    status: 'On Hold',
    progress: 60,
    dueDate: '2026-11-30',
    goal: 'Keep one honest record of the courses taken, what was actually learned, and what was applied afterwards.',
    currentStatus: 'On hold until the drowning prevention report is submitted. The list is up to date through August.',
    completedWork: 'Logged all 2025 courses\nWrote reflections for 6 of them',
    nextActions: 'Write the remaining reflections\nMark which lessons were actually applied at work',
    notes: 'The value is in the reflection, not the certificate.'
  }
];

/* =======================================================
 * State + storage
 * ===================================================== */

var projects = [];
var currentId = null;       // id of the project open in the detail view
var editingId = null;       // id being edited in the form, or null when adding

function uid() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalize(p) {
  return {
    id:            p.id || uid(),
    name:          p.name || 'Untitled project',
    status:        STATUSES.indexOf(p.status) !== -1 ? p.status : 'Not Started',
    progress:      clampProgress(p.progress),
    dueDate:       p.dueDate || '',
    goal:          p.goal || '',
    currentStatus: p.currentStatus || '',
    completedWork: p.completedWork || '',
    nextActions:   p.nextActions || '',
    notes:         p.notes || ''
  };
}

function clampProgress(v) {
  var n = parseInt(v, 10);
  if (isNaN(n)) { return 0; }
  return Math.max(0, Math.min(100, n));
}

function load() {
  var raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn('localStorage is not available — changes will not be saved.', e);
    return SAMPLE_PROJECTS.map(normalize);
  }

  if (raw === null) {
    // First use on this browser: no key at all means the samples have never
    // been loaded. Once the key exists (even as an empty list) we never seed again.
    var seeded = SAMPLE_PROJECTS.map(normalize);
    projects = seeded;
    save();
    return seeded;
  }

  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalize) : [];
  } catch (e) {
    console.warn('Saved data could not be read; starting with an empty list.', e);
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.warn('Could not save to localStorage.', e);
    alert('This browser would not let the app save your data. Private browsing mode is the usual reason.');
  }
}

function findProject(id) {
  for (var i = 0; i < projects.length; i++) {
    if (projects[i].id === id) { return projects[i]; }
  }
  return null;
}

/* =======================================================
 * Small helpers
 * ===================================================== */

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function statusClass(status) {
  return 's-' + status.toLowerCase().replace(/\s+/g, '-');
}

function lines(text) {
  return String(text || '').split('\n')
    .map(function (l) { return l.trim(); })
    .filter(function (l) { return l.length > 0; });
}

function firstLine(text) {
  var l = lines(text);
  return l.length ? l[0] : '';
}

var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(iso) {
  if (!iso) { return 'No due date'; }
  var parts = iso.split('-');
  if (parts.length !== 3) { return iso; }
  return parseInt(parts[2], 10) + ' ' + MONTHS[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
}

function isOverdue(p) {
  if (!p.dueDate || p.status === 'Done') { return false; }
  var today = new Date();
  var todayIso = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  return p.dueDate < todayIso;
}

/* =======================================================
 * Rendering
 * ===================================================== */

function renderDashboard() {
  var grid = $('project-grid');
  var empty = $('empty-state');

  $('project-count').textContent =
    projects.length + (projects.length === 1 ? ' project' : ' projects');

  empty.hidden = projects.length > 0;
  grid.hidden = projects.length === 0;
  grid.innerHTML = '';

  projects.forEach(function (p) {
    var next = firstLine(p.nextActions);
    var card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.setAttribute('aria-label', 'Open ' + p.name);
    card.innerHTML =
      '<div class="card-top">' +
        '<h2 class="card-name">' + esc(p.name) + '</h2>' +
        '<span class="chip ' + statusClass(p.status) + '">' + esc(p.status) + '</span>' +
      '</div>' +
      '<div>' +
        '<div class="progress-row">' +
          '<span class="label">Progress</span>' +
          '<span class="progress-value">' + p.progress + '%</span>' +
        '</div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + p.progress + '%"></div></div>' +
      '</div>' +
      '<div class="card-line">' +
        '<span class="label">Next action</span>' +
        (next
          ? '<span class="value">' + esc(next) + '</span>'
          : '<span class="value muted">Nothing set yet</span>') +
      '</div>' +
      '<div class="card-foot">' +
        '<span class="due' + (isOverdue(p) ? ' overdue' : '') + '">' + esc(formatDate(p.dueDate)) + '</span>' +
      '</div>';

    card.addEventListener('click', function () { showDetail(p.id); });
    grid.appendChild(card);
  });
}

function renderList(el, text, emptyMessage) {
  el.innerHTML = '';
  var items = lines(text);
  if (items.length === 0) {
    var li = document.createElement('li');
    li.className = 'list-empty';
    li.textContent = emptyMessage;
    el.appendChild(li);
    return;
  }
  items.forEach(function (item) {
    var li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
}

function setText(el, text, emptyMessage) {
  if (text && text.trim()) {
    el.textContent = text;
    el.classList.remove('muted');
  } else {
    el.textContent = emptyMessage;
    el.classList.add('muted');
  }
}

function renderDetail(p) {
  $('d-name').textContent = p.name;
  var chip = $('d-status');
  chip.textContent = p.status;
  chip.className = 'chip ' + statusClass(p.status);

  $('d-progress-text').textContent = p.progress + '%';
  $('d-progress-bar').style.width = p.progress + '%';

  var due = $('d-due');
  due.textContent = formatDate(p.dueDate);
  due.className = 'due-value' + (isOverdue(p) ? ' overdue' : '');

  setText($('d-goal'), p.goal, 'No goal written yet.');
  setText($('d-current'), p.currentStatus, 'No status written yet.');
  setText($('d-notes'), p.notes, 'No notes yet.');

  renderList($('d-completed'), p.completedWork, 'Nothing recorded yet.');
  renderList($('d-next'), p.nextActions, 'No next action set.');
}

/* =======================================================
 * View switching
 * ===================================================== */

function showDashboard() {
  currentId = null;
  $('view-detail').hidden = true;
  $('view-dashboard').hidden = false;
  renderDashboard();
  window.scrollTo(0, 0);
}

function showDetail(id) {
  var p = findProject(id);
  if (!p) { showDashboard(); return; }
  currentId = id;
  renderDetail(p);
  $('view-dashboard').hidden = true;
  $('view-detail').hidden = false;
  window.scrollTo(0, 0);
}

/* =======================================================
 * Add / edit form
 * ===================================================== */

function fillStatusOptions() {
  var sel = $('f-status');
  sel.innerHTML = '';
  STATUSES.forEach(function (s) {
    var opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
}

function openForm(id) {
  editingId = id || null;
  var p = id ? findProject(id) : null;

  $('form-title').textContent = p ? 'Edit Project' : 'New Project';
  $('f-name').value      = p ? p.name : '';
  $('f-status').value    = p ? p.status : 'Not Started';
  $('f-due').value       = p ? p.dueDate : '';
  $('f-progress').value  = p ? p.progress : 0;
  $('f-progress-out').textContent = (p ? p.progress : 0) + '%';
  $('f-goal').value      = p ? p.goal : '';
  $('f-current').value   = p ? p.currentStatus : '';
  $('f-completed').value = p ? p.completedWork : '';
  $('f-next').value      = p ? p.nextActions : '';
  $('f-notes').value     = p ? p.notes : '';
  $('f-name-error').hidden = true;

  $('form-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
  $('f-name').focus();
}

function closeForm() {
  $('form-overlay').hidden = true;
  document.body.style.overflow = '';
  editingId = null;
}

function saveForm() {
  var name = $('f-name').value.trim();
  if (!name) {
    $('f-name-error').hidden = false;
    $('f-name').focus();
    return;
  }

  var data = {
    name:          name,
    status:        $('f-status').value,
    progress:      clampProgress($('f-progress').value),
    dueDate:       $('f-due').value,
    goal:          $('f-goal').value.trim(),
    currentStatus: $('f-current').value.trim(),
    completedWork: $('f-completed').value,
    nextActions:   $('f-next').value,
    notes:         $('f-notes').value.trim()
  };

  if (editingId) {
    var existing = findProject(editingId);
    data.id = editingId;
    projects[projects.indexOf(existing)] = normalize(data);
  } else {
    data.id = uid();
    projects.push(normalize(data));
  }

  var savedId = data.id;
  save();
  closeForm();

  if (currentId) { showDetail(savedId); } else { showDashboard(); }
}

/* =======================================================
 * Confirm dialog
 * ===================================================== */

var confirmResolve = null;

function askConfirm(title, message, confirmLabel) {
  $('confirm-title').textContent = title;
  $('confirm-message').textContent = message;
  $('confirm-yes').textContent = confirmLabel || 'Confirm';
  $('confirm-overlay').hidden = false;
  document.body.style.overflow = 'hidden';

  return new Promise(function (resolve) { confirmResolve = resolve; });
}

function closeConfirm(answer) {
  $('confirm-overlay').hidden = true;
  document.body.style.overflow = '';
  if (confirmResolve) {
    var r = confirmResolve;
    confirmResolve = null;
    r(answer);
  }
}

/* =======================================================
 * Actions
 * ===================================================== */

function deleteCurrent() {
  var p = findProject(currentId);
  if (!p) { return; }

  askConfirm(
    'Delete this project?',
    '"' + p.name + '" will be removed from this browser. This cannot be undone.',
    'Delete'
  ).then(function (yes) {
    if (!yes) { return; }
    projects = projects.filter(function (x) { return x.id !== p.id; });
    save();
    showDashboard();
  });
}

function resetToSamples() {
  askConfirm(
    'Reset to sample data?',
    'Every project now in this browser will be replaced by the four sample projects. This cannot be undone.',
    'Reset'
  ).then(function (yes) {
    if (!yes) { return; }
    projects = SAMPLE_PROJECTS.map(normalize);
    save();
    showDashboard();
  });
}

function loadSamples() {
  projects = SAMPLE_PROJECTS.map(normalize);
  save();
  showDashboard();
}

/* =======================================================
 * Wiring
 * ===================================================== */

function init() {
  fillStatusOptions();
  projects = load();

  $('btn-new').addEventListener('click', function () { openForm(null); });
  $('btn-back').addEventListener('click', showDashboard);
  $('btn-edit').addEventListener('click', function () { openForm(currentId); });
  $('btn-delete').addEventListener('click', deleteCurrent);
  $('btn-reset').addEventListener('click', resetToSamples);
  $('btn-load-samples').addEventListener('click', loadSamples);

  $('btn-cancel').addEventListener('click', closeForm);
  $('btn-save').addEventListener('click', saveForm);
  $('project-form').addEventListener('submit', function (e) {
    e.preventDefault();
    saveForm();
  });

  $('f-progress').addEventListener('input', function () {
    $('f-progress-out').textContent = this.value + '%';
  });
  $('f-name').addEventListener('input', function () {
    if (this.value.trim()) { $('f-name-error').hidden = true; }
  });

  $('confirm-yes').addEventListener('click', function () { closeConfirm(true); });
  $('confirm-no').addEventListener('click', function () { closeConfirm(false); });

  // Tapping the dimmed area closes the dialog.
  $('form-overlay').addEventListener('click', function (e) {
    if (e.target === this) { closeForm(); }
  });
  $('confirm-overlay').addEventListener('click', function (e) {
    if (e.target === this) { closeConfirm(false); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') { return; }
    if (!$('confirm-overlay').hidden) { closeConfirm(false); }
    else if (!$('form-overlay').hidden) { closeForm(); }
  });

  showDashboard();
}

document.addEventListener('DOMContentLoaded', init);
