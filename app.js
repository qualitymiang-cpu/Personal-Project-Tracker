/* Personal Project Tracker
 * Data lives in Supabase, private to each signed-in account (Row Level Security).
 * The last successful load is cached in localStorage so the app still *shows*
 * your projects when the network is down — read-only until it comes back.
 */

var STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Done'];

var LEGACY_KEY = 'ppt.projects.v1';   // the localStorage-only version of this app
var CACHE_PREFIX = 'ppt.cache.';      // + user id

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
 * State
 * ===================================================== */

var client = null;        // the Supabase client
var session = null;       // the signed-in session, or null
var projects = [];        // what is on screen
var online = true;        // did the last network call succeed?
var authMode = 'signin';  // 'signin' or 'signup'
var currentId = null;     // project open in the detail view
var editingId = null;     // project being edited in the form

/* =======================================================
 * Small helpers
 * ===================================================== */

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function statusClass(status) { return 's-' + status.toLowerCase().replace(/\s+/g, '-'); }

function clampProgress(v) {
  var n = parseInt(v, 10);
  if (isNaN(n)) { return 0; }
  return Math.max(0, Math.min(100, n));
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
  var parts = String(iso).slice(0, 10).split('-');
  if (parts.length !== 3) { return iso; }
  return parseInt(parts[2], 10) + ' ' + MONTHS[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
}

function isOverdue(p) {
  if (!p.dueDate || p.status === 'Done') { return false; }
  var t = new Date();
  var todayIso = t.getFullYear() + '-' +
    String(t.getMonth() + 1).padStart(2, '0') + '-' +
    String(t.getDate()).padStart(2, '0');
  return p.dueDate < todayIso;
}

/* =======================================================
 * Row <-> project mapping
 * Postgres uses snake_case; the rest of the app uses camelCase.
 * ===================================================== */

function fromRow(r) {
  return {
    id:            r.id,
    name:          r.name || 'Untitled project',
    status:        STATUSES.indexOf(r.status) !== -1 ? r.status : 'Not Started',
    progress:      clampProgress(r.progress),
    dueDate:       r.due_date ? String(r.due_date).slice(0, 10) : '',
    goal:          r.goal || '',
    currentStatus: r.current_status || '',
    completedWork: r.completed_work || '',
    nextActions:   r.next_actions || '',
    notes:         r.notes || ''
  };
}

function toRow(p) {
  return {
    name:           p.name,
    status:         p.status,
    progress:       clampProgress(p.progress),
    due_date:       p.dueDate ? p.dueDate : null,
    goal:           p.goal || '',
    current_status: p.currentStatus || '',
    completed_work: p.completedWork || '',
    next_actions:   p.nextActions || '',
    notes:          p.notes || ''
  };
}

/* =======================================================
 * Offline cache (read-only copy of the last good load)
 * ===================================================== */

function cacheKey() {
  return CACHE_PREFIX + (session && session.user ? session.user.id : 'anon');
}

function writeCache() {
  try { localStorage.setItem(cacheKey(), JSON.stringify(projects)); } catch (e) {}
}

function readCache() {
  try {
    var raw = localStorage.getItem(cacheKey());
    if (!raw) { return null; }
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) { return null; }
}

function clearCache() {
  try { localStorage.removeItem(cacheKey()); } catch (e) {}
}

/* =======================================================
 * Views and banners
 * ===================================================== */

var VIEWS = ['view-setup', 'view-auth', 'view-loading', 'view-dashboard', 'view-detail'];

function showView(id) {
  VIEWS.forEach(function (v) { $(v).hidden = (v !== id); });
  var signedIn = (id === 'view-dashboard' || id === 'view-detail');
  $('app-footer').hidden = !signedIn;
  $('header-account').hidden = !session;
  window.scrollTo(0, 0);
}

function showBanner(text, showRetry) {
  $('banner-text').textContent = text;
  $('btn-retry').hidden = !showRetry;
  $('banner').hidden = false;
}

function hideBanner() { $('banner').hidden = true; }

function setOnline(isOnline) {
  online = isOnline;
  var writeButtons = ['btn-new', 'btn-edit', 'btn-delete', 'btn-reset', 'btn-load-samples'];
  writeButtons.forEach(function (id) {
    var el = $(id);
    if (el) { el.disabled = !isOnline; }
  });

  if (isOnline) {
    hideBanner();
    $('footer-note').textContent = 'Saved to your Supabase account.';
  } else {
    showBanner('Offline — showing your last saved copy. You can read, but not change anything until the connection is back.', true);
    $('footer-note').textContent = 'Offline — read only.';
  }
}

/* A friendlier version of Supabase's own messages. */
function friendlyError(message) {
  var m = String(message || '');
  if (/invalid login credentials/i.test(m))     { return 'Wrong email or password.'; }
  if (/email not confirmed/i.test(m))           { return 'Please confirm your email address first — check your inbox.'; }
  if (/user already registered/i.test(m))       { return 'That email already has an account. Try signing in instead.'; }
  if (/password should be at least/i.test(m))   { return 'Password must be at least 6 characters.'; }
  if (/signups not allowed|signup is disabled/i.test(m)) { return 'New sign-ups are turned off for this app.'; }
  if (/unable to validate email|invalid email/i.test(m)) { return 'That does not look like a valid email address.'; }
  return m || 'Something went wrong.';
}

/* Network failures throw; API failures come back as { error }. Tell them apart. */
function isNetworkError(e) {
  return e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(e && e.message));
}

/* =======================================================
 * Dashboard + detail rendering
 * ===================================================== */

function renderDashboard() {
  var grid = $('project-grid');

  $('project-count').textContent =
    projects.length + (projects.length === 1 ? ' project' : ' projects');

  $('empty-state').hidden = projects.length > 0;
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

function findProject(id) {
  for (var i = 0; i < projects.length; i++) {
    if (projects[i].id === id) { return projects[i]; }
  }
  return null;
}

function showDashboard() {
  currentId = null;
  renderDashboard();
  showView('view-dashboard');
}

function showDetail(id) {
  var p = findProject(id);
  if (!p) { showDashboard(); return; }
  currentId = id;
  renderDetail(p);
  showView('view-detail');
}

/* =======================================================
 * Loading from Supabase
 * ===================================================== */

function loadProjects() {
  showView('view-loading');

  return client
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })
    .then(function (res) {
      if (res.error) { throw res.error; }
      projects = res.data.map(fromRow);
      writeCache();
      setOnline(true);
      showDashboard();
      return offerMigration();
    })
    .catch(function (e) {
      var cached = readCache();
      if (isNetworkError(e)) {
        projects = cached || [];
        setOnline(false);
        showDashboard();
        return;
      }
      // A real API error — show it, but still let them read the cache if there is one.
      projects = cached || [];
      setOnline(false);
      showBanner('Could not load your projects: ' + friendlyError(e.message), true);
      showDashboard();
    });
}

/* One-time offer to lift projects out of the old localStorage-only version. */
function offerMigration() {
  if (projects.length > 0) { return Promise.resolve(); }

  var legacy = [];
  try {
    var raw = localStorage.getItem(LEGACY_KEY);
    if (raw) { legacy = JSON.parse(raw) || []; }
  } catch (e) { return Promise.resolve(); }

  if (!Array.isArray(legacy) || legacy.length === 0) { return Promise.resolve(); }

  return askConfirm(
    'Bring your old projects over?',
    'This browser still holds ' + legacy.length + ' project(s) from the offline version. ' +
    'Copy them into your Supabase account now? The local copy is left untouched.',
    'Copy them over'
  ).then(function (yes) {
    if (!yes) { return; }
    return insertMany(legacy).then(loadProjects);
  });
}

function insertMany(list) {
  var rows = list.map(function (p) {
    var row = toRow(p);
    row.user_id = session.user.id;
    return row;
  });
  return client.from('projects').insert(rows).then(function (res) {
    if (res.error) { throw res.error; }
  });
}

/* =======================================================
 * Authentication
 * ===================================================== */

function setAuthMode(mode) {
  authMode = mode;
  var signup = (mode === 'signup');
  $('auth-title').textContent = signup ? 'Create your account' : 'Sign in';
  $('auth-sub').textContent = signup
    ? 'Pick a password you will remember. Your projects stay private to this account.'
    : 'Your projects are private to your account.';
  $('btn-auth-submit').textContent = signup ? 'Create account' : 'Sign in';
  $('auth-switch-text').textContent = signup ? 'Already have an account?' : 'First time here?';
  $('btn-auth-switch').textContent = signup ? 'Sign in instead' : 'Create an account';
  $('a-password').setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
  $('auth-error').hidden = true;
  $('auth-success').hidden = true;
}

function showAuthError(msg) {
  $('auth-error').textContent = msg;
  $('auth-error').hidden = false;
  $('auth-success').hidden = true;
}

function submitAuth() {
  var email = $('a-email').value.trim();
  var password = $('a-password').value;

  if (!email) { showAuthError('Please enter your email address.'); return; }
  if (!password) { showAuthError('Please enter your password.'); return; }

  var btn = $('btn-auth-submit');
  var original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Please wait…';
  $('auth-error').hidden = true;

  var call = (authMode === 'signup')
    ? client.auth.signUp({ email: email, password: password })
    : client.auth.signInWithPassword({ email: email, password: password });

  call.then(function (res) {
    if (res.error) { throw res.error; }

    if (!res.data.session) {
      // Sign-up succeeded but Supabase is waiting for email confirmation.
      $('auth-success').textContent =
        'Account created. Please open the confirmation email, then sign in.';
      $('auth-success').hidden = false;
      setAuthMode('signin');
      $('auth-success').hidden = false;
      return;
    }

    session = res.data.session;
    $('account-email').textContent = session.user.email;
    $('a-password').value = '';
    return loadProjects();
  }).catch(function (e) {
    showAuthError(isNetworkError(e)
      ? 'No connection. Please check the network and try again.'
      : friendlyError(e.message));
  }).then(function () {
    btn.disabled = false;
    btn.textContent = original;
  });
}

function signOut() {
  askConfirm('Sign out?', 'You will need your email and password to get back in.', 'Sign out')
    .then(function (yes) {
      if (!yes) { return; }
      return client.auth.signOut().catch(function () {});
    })
    .then(function () {
      if (!session) { return; }
      session = null;
      projects = [];
      currentId = null;
      hideBanner();
      $('a-email').value = '';
      $('a-password').value = '';
      setAuthMode('signin');
      showView('view-auth');
    });
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
  if (!online) { return; }
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
  $('form-error').hidden = true;

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

  var btn = $('btn-save');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  $('form-error').hidden = true;

  var savedId = editingId;
  var wasOnDetail = (currentId !== null);   // loadProjects() resets currentId, so remember first
  var row = toRow(data);
  var call;

  if (editingId) {
    call = client.from('projects').update(row).eq('id', editingId).select().single();
  } else {
    row.user_id = session.user.id;
    call = client.from('projects').insert(row).select().single();
  }

  call.then(function (res) {
    if (res.error) { throw res.error; }
    savedId = res.data.id;
    closeForm();
    return loadProjects().then(function () {
      if (wasOnDetail && findProject(savedId)) { showDetail(savedId); }
    });
  }).catch(function (e) {
    $('form-error').textContent = isNetworkError(e)
      ? 'No connection — your change was not saved. Please try again.'
      : 'Could not save: ' + friendlyError(e.message);
    $('form-error').hidden = false;
  }).then(function () {
    btn.disabled = false;
    btn.textContent = 'Save project';
  });
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
 * Delete / samples / reset
 * ===================================================== */

function deleteCurrent() {
  if (!online) { return; }
  var p = findProject(currentId);
  if (!p) { return; }

  askConfirm(
    'Delete this project?',
    '"' + p.name + '" will be removed from your account, on every device. This cannot be undone.',
    'Delete'
  ).then(function (yes) {
    if (!yes) { return; }
    return client.from('projects').delete().eq('id', p.id).then(function (res) {
      if (res.error) { throw res.error; }
      currentId = null;
      return loadProjects();
    });
  }).catch(function (e) {
    showBanner('Could not delete: ' + friendlyError(e.message), true);
  });
}

function loadSamples() {
  if (!online) { return; }
  insertMany(SAMPLE_PROJECTS)
    .then(loadProjects)
    .catch(function (e) {
      showBanner('Could not add the sample projects: ' + friendlyError(e.message), true);
    });
}

function resetToSamples() {
  if (!online) { return; }
  askConfirm(
    'Delete everything and start over?',
    'All ' + projects.length + ' project(s) in your account will be deleted on every device, ' +
    'then replaced by the four sample projects. This cannot be undone.',
    'Delete and reset'
  ).then(function (yes) {
    if (!yes) { return; }
    return client.from('projects').delete().eq('user_id', session.user.id)
      .then(function (res) {
        if (res.error) { throw res.error; }
        return insertMany(SAMPLE_PROJECTS);
      })
      .then(loadProjects);
  }).catch(function (e) {
    showBanner('Could not reset: ' + friendlyError(e.message), true);
  });
}

/* =======================================================
 * Boot
 * ===================================================== */

function isConfigured() {
  var url = window.SUPABASE_URL;
  var key = window.SUPABASE_ANON_KEY;
  return typeof url === 'string' && url.indexOf('http') === 0 &&
         typeof key === 'string' && key.length > 20 &&
         key.indexOf('PASTE_') !== 0;
}

function wireEvents() {
  $('btn-new').addEventListener('click', function () { openForm(null); });
  $('btn-back').addEventListener('click', showDashboard);
  $('btn-edit').addEventListener('click', function () { openForm(currentId); });
  $('btn-delete').addEventListener('click', deleteCurrent);
  $('btn-reset').addEventListener('click', resetToSamples);
  $('btn-load-samples').addEventListener('click', loadSamples);
  $('btn-signout').addEventListener('click', signOut);
  $('btn-retry').addEventListener('click', function () { loadProjects(); });

  $('btn-cancel').addEventListener('click', closeForm);
  $('btn-save').addEventListener('click', saveForm);
  $('project-form').addEventListener('submit', function (e) { e.preventDefault(); saveForm(); });

  $('auth-form').addEventListener('submit', function (e) { e.preventDefault(); submitAuth(); });
  $('btn-auth-switch').addEventListener('click', function () {
    setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
  });

  $('f-progress').addEventListener('input', function () {
    $('f-progress-out').textContent = this.value + '%';
  });
  $('f-name').addEventListener('input', function () {
    if (this.value.trim()) { $('f-name-error').hidden = true; }
  });

  $('confirm-yes').addEventListener('click', function () { closeConfirm(true); });
  $('confirm-no').addEventListener('click', function () { closeConfirm(false); });

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

  // The browser noticing the network come back is a good moment to retry.
  window.addEventListener('online', function () { if (session) { loadProjects(); } });
  window.addEventListener('offline', function () { if (session) { setOnline(false); } });
}

function init() {
  fillStatusOptions();
  wireEvents();
  setAuthMode('signin');

  if (!isConfigured()) {
    showView('view-setup');
    return;
  }

  client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  client.auth.getSession().then(function (res) {
    session = (res && res.data) ? res.data.session : null;
    if (!session) { showView('view-auth'); return; }
    $('account-email').textContent = session.user.email;
    return loadProjects();
  }).catch(function () {
    showView('view-auth');
  });
}

document.addEventListener('DOMContentLoaded', init);
