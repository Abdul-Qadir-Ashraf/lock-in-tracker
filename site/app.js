const habits = [
  { id: 'expense', label: 'Today’s expense', type: 'number', hint: 'Amount spent' },
  { id: 'workout', label: 'Workout done', type: 'check' },
  { id: 'sugar', label: 'Sugar eaten (−1 point)', type: 'check' },
  { id: 'protein', label: 'Protein intake complete', type: 'check' },
  { id: 'prayer', label: 'Prayer done', type: 'check' },
  { id: 'donation', label: 'Donation amount', type: 'number', hint: 'Amount donated' },
  { id: 'sleep', label: 'Sleep time', type: 'number', hint: 'Hours slept' },
  { id: 'readThirty', label: 'Read for 30 minutes', type: 'check' },
  { id: 'water', label: 'Drank 4L water', type: 'check' },
  { id: 'noPorn', label: 'No porn', type: 'check' },
  { id: 'noFap', label: 'No fap', type: 'check' },
  { id: 'screenTime', label: 'Screen time', type: 'number', hint: 'Minutes today' },
  { id: 'steps', label: 'Daily steps', type: 'number', hint: 'Step count' },
  { id: 'meditation', label: 'Meditation (10 minutes)', type: 'check' },
  { id: 'ambition', label: 'Ambition work', type: 'ambition' }
];
const key = 'lock-in-v2';
const booksKey = 'lock-in-books-v2';
const goalsKey = 'lock-in-goals-v2';
const accountsKey = 'lock-in-accounts-v2';
// Supabase browser configuration. The publishable key is intended for frontend use;
// table access is restricted by RLS to the two allowlisted authenticated emails.
const SUPABASE_URL = 'https://jkuufignhusyxckobplg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LYIeUNOfrswcsI-S3L3fVQ_dM4OuLHc';
const PROFILE_EMAILS = {
  Vishwajeet: 'vishwajeet@roll.com',
  Abdul: 'qadirashrafabdul@gmail.com'
};
const supabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
let cloudReady = false;
let syncInProgress = false;
let pendingSync = Promise.resolve();
function setSyncStatus(message) {
  const status = $('saveStatus');
  if (status) status.textContent = message;
}
function profileDailySnapshot(person, all = data()) {
  const out = {};
  Object.entries(all).forEach(([date, day]) => {
    if (day && day[person]) out[date] = { [person]: day[person] };
  });
  return out;
}
function mergeDaily(target, incoming) {
  Object.entries(incoming || {}).forEach(([date, day]) => {
    target[date] ||= {};
    Object.entries(day || {}).forEach(([person, entry]) => {
      // Cloud data is the shared source of truth. Keep local-only fields, but let
      // a saved cloud value win when an older browser has the same date cached.
      target[date][person] = { ...(target[date][person] || {}), ...(entry || {}) };
    });
  });
  return target;
}
function mergeProfileObject(target, incoming, person, category) {
  if (category === 'books') {
    if (incoming && Object.keys(incoming).length) {
      const old = target[person] || { current: '', completed: [] };
      const inc = incoming[person] || incoming;
      const completed = [...(old.completed || [])];
      (inc.completed || []).forEach(book => {
        const title = (typeof book === 'string' ? book : book.title || '').toLowerCase();
        if (title && !completed.some(x => (typeof x === 'string' ? x : x.title || '').toLowerCase() === title)) completed.push(book);
      });
      target[person] = { current: old.current || inc.current || '', completed };
    }
  } else if (category === 'goals') {
    const inc = incoming[person] || incoming || {};
    target[person] ||= {};
    Object.entries(inc).forEach(([month, goal]) => {
      target[person][month] = { ...(goal || {}), ...(target[person][month] || {}) };
    });
  }
  return target;
}
function categorySnapshot(category, person) {
  if (category === 'daily') return profileDailySnapshot(person);
  if (category === 'books') return { [person]: books()[person] || { current: '', completed: [] } };
  return { [person]: goals()[person] || {} };
}
function storeCategory(category, person, payload) {
  if (category === 'daily') {
    const merged = mergeDaily(data(), payload || {});
    save(merged);
  } else if (category === 'books') {
    const merged = books(); mergeProfileObject(merged, payload || {}, person, 'books'); saveBooks(merged);
  } else {
    const merged = goals(); mergeProfileObject(merged, payload || {}, person, 'goals'); saveGoals(merged);
  }
}
async function saveCategoryToCloud(category, person = activePerson) {
  if (!supabaseClient || !person || !cloudReady) return;
  const { data: authData } = await supabaseClient.auth.getUser();
  const user = authData?.user;
  if (!user) return;
  const payload = categorySnapshot(category, person);
  const { error } = await supabaseClient.from('tracker_data').upsert({
    user_id: user.id,
    data_key: `${category}:${person}`,
    data: payload,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,data_key' });
  if (error) {
    console.error('Cloud save failed', error);
    setSyncStatus('Saved on this device; cloud sync failed. Check setup.');
    throw error;
  }
}
async function saveProfileToCloud(person = activePerson) {
  if (!cloudReady || !person) return;
  // Queue writes so rapid taps do not race each other.
  pendingSync = pendingSync.then(async () => {
    await saveCategoryToCloud('daily', person);
    await saveCategoryToCloud('books', person);
    await saveCategoryToCloud('goals', person);
  });
  return pendingSync;
}
function mergeCloudRows(rows) {
  (rows || []).forEach(row => {
    const match = /^(daily|books|goals):(Vishwajeet|Abdul)$/.exec(row.data_key || '');
    if (!match) return;
    const [, category, rowPerson] = match;
    storeCategory(category, rowPerson, row.data || {});
  });
}
async function loadPublicComparison() {
  if (!supabaseClient) return;
  const { data: rows, error } = await supabaseClient.from('tracker_data').select('data_key,data,updated_at');
  if (error) throw error;
  mergeCloudRows(rows);
}
async function syncFromCloud(person) {
  setSyncStatus('Syncing…');
  const { data: authData, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !authData?.user) throw authError || new Error('Please sign in again.');
  const email = (authData.user.email || '').toLowerCase();
  if (!Object.values(PROFILE_EMAILS).some(x => x.toLowerCase() === email) || PROFILE_EMAILS[person].toLowerCase() !== email) {
    await supabaseClient.auth.signOut();
    throw new Error('This account does not match the selected tracker profile.');
  }
  await loadPublicComparison();
  cloudReady = true;
  // Migrate this profile's local records; remote and local records are merged before upload.
  await saveProfileToCloud(person);
  setSyncStatus('Synced ✓');
}
async function signInProfile(person, password) {
  if (!supabaseClient) throw new Error('The sign-in service could not load. Refresh the page or try another network, then try again.');
  const email = PROFILE_EMAILS[person];
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await syncFromCloud(person);
}
const $ = (id) => document.getElementById(id);
const dateInput = $('date'), habitGrid = $('habitGrid');
let activePerson = sessionStorage.getItem('lock-in-person-v2');
let selectedLoginPerson = null;
dateInput.value = new Date().toLocaleDateString('en-CA');
$('periodMonth').value = dateInput.value.slice(0, 7); $('periodDay').value = dateInput.value;
function data() { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } }
function save(data) { localStorage.setItem(key, JSON.stringify(data)); }
function books() { try { return JSON.parse(localStorage.getItem(booksKey)) || {}; } catch { return {}; } }
function saveBooks(value) { localStorage.setItem(booksKey, JSON.stringify(value)); }
function goals() { try { return JSON.parse(localStorage.getItem(goalsKey)) || {}; } catch { return {}; } }
function saveGoals(value) { localStorage.setItem(goalsKey, JSON.stringify(value)); }
function accounts() { try { return JSON.parse(localStorage.getItem(accountsKey)) || { Vishwajeet: '123', Abdul: '123' }; } catch { return { Vishwajeet: '123', Abdul: '123' }; } }
function saveAccounts(value) { localStorage.setItem(accountsKey, JSON.stringify(value)); }
function goalMonth() { return dateInput.value.slice(0, 7); }
function score(entry = {}) {
  const good = ['workout','protein','prayer','water','noPorn','noFap','meditation','ambition'].reduce((sum, id) => sum + (entry[id] ? 1 : 0), 0);
  return good + (entry.readThirty ? 1 : 0) - (entry.sugar ? 1 : 0);
}
function fieldValue(h, entry) { return h.type === 'check' ? Boolean(entry[h.id]) : (entry[h.id] || ''); }
function renderForm() {
  const all = data(), entry = all[dateInput.value]?.[activePerson] || {};
  $('formTitle').textContent = `${activePerson}’s day`;
  $('activePerson').textContent = activePerson;
  habitGrid.innerHTML = '';
  habits.forEach(h => {
    if (h.type === 'ambition') {
      const node = $('ambitionHabit').content.cloneNode(true);
      node.querySelector('.habit-name').textContent = h.label;
      node.querySelector('[data-id="ambition"]').checked = Boolean(entry.ambition);
      node.querySelector('[data-id="ambitionTime"]').value = entry.ambitionTime || '';
      habitGrid.append(node);
      return;
    }
    const node = $(h.type === 'check' ? 'checkHabit' : 'numberHabit').content.cloneNode(true);
    const label = node.querySelector('label');
    label.className = h.type === 'check' ? 'habit check' : 'habit field';
    node.querySelector('.habit-name').textContent = h.label;
    const input = node.querySelector('input'); input.dataset.id = h.id;
    if (h.type === 'check') { input.checked = fieldValue(h, entry); }
    else { input.type = h.type === 'number' ? 'number' : 'text'; input.value = fieldValue(h, entry); input.placeholder = h.hint; node.querySelector('.hint').textContent = h.hint; }
    habitGrid.append(node);
  });
  document.querySelectorAll('[data-health]').forEach(input => input.value = entry[input.dataset.health] || '');
  configureBodyFatEntry();
  renderBmi();
  renderGoalTracker();
  renderBookTracker();
}
function configureBodyFatEntry() {
  const input = $('bodyFat'), hint = $('bodyFatHint'), all = data(), selectedDay = Number(dateInput.value.slice(-2)), month = dateInput.value.slice(0, 7);
  const anotherMonthlyEntry = Object.entries(all).find(([date, day]) => date.startsWith(month) && date !== dateInput.value && day[activePerson]?.bodyFat);
  const allowedDate = selectedDay >= 1 && selectedDay <= 10;
  const locked = !allowedDate || anotherMonthlyEntry;
  input.disabled = locked;
  if (anotherMonthlyEntry) hint.textContent = `Recorded on ${anotherMonthlyEntry[0]}. One entry per month.`;
  else if (!allowedDate) hint.textContent = 'Available from the 1st to the 10th of each month.';
  else hint.textContent = 'One entry allowed this month.';
  if (locked && entryValueForSelectedDate('bodyFat') === '') input.value = '';
}
function entryValueForSelectedDate(key) { return data()[dateInput.value]?.[activePerson]?.[key] || ''; }
function bmi(weight, height) {
  const kg = Number(weight), meters = Number(height) / 100;
  return kg > 0 && meters > 0 ? kg / (meters * meters) : null;
}
function renderBmi() { const value = bmi($('weight').value, $('height').value); $('dailyBmi').textContent = value ? value.toFixed(1) : '—'; }
function renderGoalTracker() {
  const month = goalMonth(), entry = goals()[activePerson]?.[month] || {};
  $('entryGoalMonth').textContent = new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  $('monthlyGoal').value = entry.text || '';
  $('goalStatus').textContent = entry.achieved ? '✓ Mission achieved this month.' : entry.text ? 'Mission in progress.' : 'Set one meaningful mission for the month.';
}
function saveGoal() {
  const text = $('monthlyGoal').value.trim(); if (!text) { $('goalStatus').textContent = 'Write a mission first.'; return; }
  const allGoals = goals(); allGoals[activePerson] ||= {}; allGoals[activePerson][goalMonth()] = { text, achieved: allGoals[activePerson][goalMonth()]?.achieved || false }; saveGoals(allGoals);
  $('goalStatus').textContent = 'Mission saved.'; renderSummary();
}
function completeGoal() {
  saveGoal(); const allGoals = goals(), entry = allGoals[activePerson]?.[goalMonth()];
  if (!entry) return; entry.achieved = true; saveGoals(allGoals); saveProfileToCloud().catch(() => {}); $('goalStatus').textContent = '✓ Mission achieved this month.'; renderSummary();
}
function selectLoginPerson(person) {
  selectedLoginPerson = person;
  document.querySelectorAll('.login-button').forEach(button => button.classList.toggle('selected', button.dataset.person === person));
  $('loginError').textContent = '';
}
async function logIn() {
  const password = $('loginPassword').value;
  if (!selectedLoginPerson) { $('loginError').textContent = 'Choose Vishwajeet or Abdul first.'; return; }
  $('loginSubmit').disabled = true;
  $('loginError').textContent = 'Signing in and syncing…';
  try {
    await signInProfile(selectedLoginPerson, password);
    activePerson = selectedLoginPerson;
    sessionStorage.setItem('lock-in-person-v2', activePerson);
    $('loginPassword').value = '';
    $('loginError').textContent = '';
    $('loginPanel').hidden = true;
    showPage('entry');
    renderSummary();
  } catch (error) {
    console.error(error);
    $('loginError').textContent = error.message || 'Login failed. Check your email account and password.';
  } finally { $('loginSubmit').disabled = false; }
}
async function updatePassword() {
  const current = $('currentPassword').value, next = $('newPassword').value;
  if (next.length < 8) { $('passwordStatus').textContent = 'Use at least 8 characters.'; return; }
  const { data: authData } = await supabaseClient.auth.getUser();
  const email = authData?.user?.email;
  if (!email || !current) { $('passwordStatus').textContent = 'Enter your current password.'; return; }
  const { error: verifyError } = await supabaseClient.auth.signInWithPassword({ email, password: current });
  if (verifyError) { $('passwordStatus').textContent = 'Current password is incorrect.'; return; }
  const { error } = await supabaseClient.auth.updateUser({ password: next });
  if (error) { $('passwordStatus').textContent = error.message; return; }
  $('currentPassword').value = ''; $('newPassword').value = '';
  $('passwordStatus').textContent = 'Password updated.';
}
function renderBookTracker() {
  const profile = books()[activePerson] || { current: '', completed: [] };
  $('bookTitle').value = profile.current;
  $('bookStatus').textContent = profile.current ? `Currently reading: ${profile.current}` : 'No active book. Add a title and mark it as reading.';
}
function setCurrentBook() {
  const title = $('bookTitle').value.trim();
  if (!title) { $('bookStatus').textContent = 'Type a book title first.'; return; }
  const allBooks = books(); allBooks[activePerson] ||= { current: '', completed: [] };
  allBooks[activePerson].current = title; saveBooks(allBooks); saveProfileToCloud().catch(() => {});
  $('bookStatus').textContent = `✓ ${title} will carry over until you complete it.`; renderSummary();
}
function completeBook() {
  const title = $('bookTitle').value.trim();
  if (!title) { $('bookStatus').textContent = 'Type the completed book title first.'; return; }
  const allBooks = books(); allBooks[activePerson] ||= { current: '', completed: [] };
  const completed = allBooks[activePerson].completed;
  if (!completed.some(book => (typeof book === 'string' ? book : book.title).toLowerCase() === title.toLowerCase())) completed.push({ title, completedOn: dateInput.value });
  allBooks[activePerson].current = ''; saveBooks(allBooks); saveProfileToCloud().catch(() => {});
  $('bookTitle').value = ''; $('bookStatus').textContent = `✓ ${title} added to your achievements.`; renderSummary();
}
function saveDay() {
  const all = data(), date = dateInput.value, person = activePerson;
  all[date] ||= {}; all[date][person] = {};
  habitGrid.querySelectorAll('input').forEach(input => all[date][person][input.dataset.id] = input.type === 'checkbox' ? input.checked : input.value.trim());
  document.querySelectorAll('[data-health]').forEach(input => { if (!input.disabled) all[date][person][input.dataset.health] = input.value.trim(); });
  save(all); $('saveStatus').textContent = 'Saved on this device…'; saveProfileToCloud().then(() => setSyncStatus('Synced ✓')).catch(() => {}); renderSummary();
}
function selectedData() {
  const all = data(), mode = $('periodMode').value, month = $('periodMonth').value, day = $('periodDay').value;
  return Object.fromEntries(Object.entries(all).filter(([date]) => mode === 'all' || (mode === 'month' && date.startsWith(month)) || (mode === 'day' && date === day)));
}
function average(entries, key) {
  if (!entries.length) return '—';
  const total = entries.reduce((sum, entry) => sum + (Number(entry?.[key]) || 0), 0);
  return Math.round(total / entries.length);
}
function latest(entries, key) {
  for (let index = entries.length - 1; index >= 0; index -= 1) if (entries[index]?.[key] !== undefined && entries[index]?.[key] !== '') return entries[index][key];
  return null;
}
function renderSummary() {
  const all = selectedData(), people = ['Vishwajeet','Abdul'];
  const totals = Object.fromEntries(people.map(person => [person, Object.values(all).reduce((sum, day) => sum + score(day[person]), 0)]));
  const days = Object.fromEntries(people.map(person => [person, Object.values(all).filter(day => day[person]).length]));
  $('vishScore').textContent = totals.Vishwajeet; $('abdulScore').textContent = totals.Abdul;
  $('vishDetail').textContent = `${days.Vishwajeet} logged day${days.Vishwajeet === 1 ? '' : 's'}`; $('abdulDetail').textContent = `${days.Abdul} logged day${days.Abdul === 1 ? '' : 's'}`;
  const leader = totals.Vishwajeet === totals.Abdul ? 'Tied' : totals.Vishwajeet > totals.Abdul ? 'Vishwajeet' : 'Abdul';
  $('leader').textContent = leader; $('leadDetail').textContent = leader === 'Tied' ? 'Keep the pressure on' : `${Math.abs(totals.Vishwajeet - totals.Abdul)} point lead`;
  const library = books(), mode = $('periodMode').value, month = $('periodMonth').value, day = $('periodDay').value;
  const bookCount = (person) => (library[person]?.completed || []).filter(book => {
    if (typeof book === 'string') return mode === 'all';
    return mode === 'all' || (mode === 'month' && book.completedOn.startsWith(month)) || (mode === 'day' && book.completedOn === day);
  }).length;
  const completed = Object.fromEntries(people.map(person => [person, bookCount(person)]));
  $('vishBooks').textContent = completed.Vishwajeet; $('abdulBooks').textContent = completed.Abdul;
  const entries = Object.fromEntries(people.map(person => [person, Object.keys(all).sort().map(date => all[date][person]).filter(Boolean)]));
  const done = (person, key) => entries[person].filter(entry => entry[key]).length;
  const rowsFor = [
    ['Workout done', p => `${done(p, 'workout')} days`], ['No sugar eaten', p => `${entries[p].length - done(p, 'sugar')} days`],
    ['Protein complete', p => `${done(p, 'protein')} days`], ['Prayer done', p => `${done(p, 'prayer')} days`],
    ['Read 30 minutes', p => `${done(p, 'readThirty')} days`], ['4L water', p => `${done(p, 'water')} days`], ['No porn', p => `${done(p, 'noPorn')} days`], ['No fap', p => `${done(p, 'noFap')} days`],
    ['Meditation', p => `${done(p, 'meditation')} days`], ['Ambition work', p => `${done(p, 'ambition')} days`],
    ['Sleep average', p => `${average(entries[p], 'sleep')} hrs/day`], ['Screen time average', p => `${average(entries[p], 'screenTime')} min/day`],
    ['Ambition work average', p => `${average(entries[p], 'ambitionTime')} min/day`], ['Daily steps average', p => `${average(entries[p], 'steps')} steps/day`], ['Books completed', p => `${completed[p]} books`],
    ['Latest weight', p => latest(entries[p], 'weight') ? `${latest(entries[p], 'weight')} kg` : '—'], ['Latest height', p => latest(entries[p], 'height') ? `${latest(entries[p], 'height')} cm` : '—'],
    ['Latest BMI', p => { const value = bmi(latest(entries[p], 'weight'), latest(entries[p], 'height')); return value ? value.toFixed(1) : '—'; }], ['Latest body fat', p => latest(entries[p], 'bodyFat') ? `${latest(entries[p], 'bodyFat')}%` : '—']
  ];
  $('categoryComparison').innerHTML = rowsFor.map(([label, value]) => `<tr><td>${label}</td><td>${value('Vishwajeet')}</td><td>${value('Abdul')}</td></tr>`).join('');
  const periodLabel = $('periodMode').value === 'all' ? 'all time' : $('periodMode').value === 'month' ? $('periodMonth').value : $('periodDay').value;
  $('motivationTitle').textContent = leader === 'Tied' ? 'The race is even.' : `${leader} is leading.`;
  $('motivationText').textContent = `${periodLabel}: points reward the good habits; the averages reveal where tomorrow can be stronger.`;
  const goalPeriod = $('periodMode').value === 'month' ? $('periodMonth').value : $('periodMode').value === 'day' ? $('periodDay').value.slice(0, 7) : dateInput.value.slice(0, 7);
  const allGoals = goals();
  $('goalMonthLabel').textContent = new Date(`${goalPeriod}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  people.forEach(person => { const goal = allGoals[person]?.[goalPeriod], cell = $(person === 'Vishwajeet' ? 'vishGoal' : 'abdulGoal'); cell.textContent = goal ? `${goal.achieved ? '✓ ' : ''}${goal.text}` : 'No mission set'; cell.classList.toggle('achieved', Boolean(goal?.achieved)); });
  const rows = Object.keys(all).sort().reverse().slice(0,7); $('history').innerHTML = rows.length ? rows.map(date => { const d=all[date]; const v=score(d.Vishwajeet), a=score(d.Abdul); return `<tr><td>${date}</td><td>${d.Vishwajeet ? v + ' pts' : '—'}</td><td>${d.Abdul ? a + ' pts' : '—'}</td><td>${v===a ? 'Tied' : v>a ? 'Vishwajeet' : 'Abdul'}</td></tr>`; }).join('') : '<tr><td colspan="4">No check-ins yet.</td></tr>';
}
$('saveDay').addEventListener('click', saveDay); $('loadDay').addEventListener('click', renderForm); dateInput.addEventListener('change', renderForm);
$('weight').addEventListener('input', renderBmi); $('height').addEventListener('input', renderBmi);
$('markReading').addEventListener('click', setCurrentBook); $('completeBook').addEventListener('click', completeBook);
$('saveGoal').addEventListener('click', saveGoal); $('completeGoal').addEventListener('click', completeGoal);
$('changePassword').addEventListener('click', updatePassword);
$('periodMode').addEventListener('change', () => { const mode = $('periodMode').value; $('monthControl').hidden = mode !== 'month'; $('dayControl').hidden = mode !== 'day'; renderSummary(); });
$('periodMonth').addEventListener('change', renderSummary); $('periodDay').addEventListener('change', renderSummary);
function dayKey(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
}
function renderReports() {
  const person = activePerson || 'Abdul';
  const opponent = person === 'Abdul' ? 'Vishwajeet' : 'Abdul';
  const all = data();
  const days = Array.from({ length: 7 }, (_, index) => dayKey(6 - index));
  const entries = days.map(date => all[date]?.[person] || null);
  const scoreTotal = entries.reduce((total, entry) => total + score(entry), 0);
  const goodHabits = ['workout', 'protein', 'prayer', 'readThirty', 'water', 'noPorn', 'noFap', 'meditation', 'ambition'];
  const checkedDays = entries.filter(Boolean);
  const completed = checkedDays.reduce((total, entry) => total + goodHabits.filter(key => entry[key]).length, 0);
  const potential = checkedDays.length * goodHabits.length;
  let streak = 0;
  for (let index = 0; index < 365; index += 1) { if (all[dayKey(index)]?.[person]) streak += 1; else break; }
  const ambitionMinutes = entries.reduce((total, entry) => total + (Number(entry?.ambitionTime) || 0), 0);
  $('reportTitle').textContent = `${person}'s progress report`;
  $('reportSubtitle').textContent = checkedDays.length ? `${checkedDays.length} check-in${checkedDays.length === 1 ? '' : 's'} in the last 7 days. Keep the chain alive.` : 'Your next check-in starts the story.';
  $('reportScore').textContent = scoreTotal;
  $('reportStreak').textContent = streak;
  $('reportCompletion').textContent = potential ? `${Math.round((completed / potential) * 100)}%` : '0%';
  $('reportAmbition').textContent = `${ambitionMinutes}m`;
  const highScore = Math.max(1, ...entries.map(entry => score(entry)));
  $('reportTrend').innerHTML = days.map((date, index) => { const value = score(entries[index]); const label = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2); return `<div class="trend-day"><span class="trend-value">${value || '—'}</span><div class="trend-track"><i style="height:${Math.max(value > 0 ? 12 : 0, (Math.max(0, value) / highScore) * 100)}%"></i></div><small>${label}</small></div>`; }).join('');
  const best = entries.reduce((winner, entry, index) => score(entry) > winner.value ? { value: score(entry), date: days[index] } : winner, { value: 0, date: null });
  $('reportBestDay').textContent = best.date ? `Best: ${best.value} pts · ${new Date(`${best.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'No entries yet';
  const weeklyScore = name => days.reduce((total, date) => total + score(all[date]?.[name]), 0);
  const own = weeklyScore(person), theirs = weeklyScore(opponent), maxRace = Math.max(1, own, theirs);
  $('reportRace').innerHTML = [person, opponent].map(name => { const value = weeklyScore(name); return `<div class="race-line"><span>${name}</span><div><i style="width:${(value / maxRace) * 100}%"></i></div><strong>${value}</strong></div>`; }).join('');
  const habitStats = goodHabits.map(key => ({ label: habits.find(habit => habit.id === key)?.label.replace(/ \(.+\)/, '') || key, count: checkedDays.filter(entry => entry[key]).length }));
  const strongest = habitStats.reduce((bestHabit, habit) => habit.count > bestHabit.count ? habit : bestHabit, habitStats[0]);
  $('reportHabitNote').textContent = checkedDays.length ? `Best: ${strongest.label}` : 'Start with one habit';
  $('reportHabits').innerHTML = habitStats.map(habit => { const percent = checkedDays.length ? Math.round((habit.count / checkedDays.length) * 100) : 0; return `<div class="habit-report"><span>${habit.label}</span><div><i style="width:${percent}%"></i></div><strong>${habit.count}/${checkedDays.length || 0}</strong></div>`; }).join('');
}
function showPage(page) {
  const entering = page === 'entry', reporting = page === 'reports';
  $('loginPanel').hidden = Boolean(activePerson);
  $('comparisonPage').hidden = entering || reporting; $('reportsPage').hidden = !reporting; $('entryPage').hidden = !entering; $('appNav').hidden = !activePerson; $('appNav').style.display = activePerson ? 'flex' : 'none';
  if (entering) renderForm(); else if (reporting) renderReports(); else renderSummary();
}
document.querySelectorAll('.login-button').forEach(button => button.addEventListener('click', () => selectLoginPerson(button.dataset.person)));
$('loginSubmit').addEventListener('click', logIn); $('loginPassword').addEventListener('keydown', event => { if (event.key === 'Enter') logIn(); });
$('showComparison').addEventListener('click', () => showPage('comparison'));
$('showReports').addEventListener('click', () => showPage('reports'));
$('showEntry').addEventListener('click', () => showPage('entry'));
$('logOut').addEventListener('click', async () => { if (supabaseClient) await supabaseClient.auth.signOut(); cloudReady = false; sessionStorage.removeItem('lock-in-person-v2'); activePerson = null; showPage('comparison'); });
$('exportData').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ daily: data(), books: books(), goals: goals() }, null, 2)], {type:'application/json'}); const link = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'lock-in-data.json'}); link.click(); URL.revokeObjectURL(link.href); });
async function restorePhoneSession() {
  if (!supabaseClient) { activePerson = null; showPage('comparison'); renderSummary(); return; }
  const { data: authData } = await supabaseClient.auth.getUser();
  const email = (authData?.user?.email || '').toLowerCase();
  const person = Object.entries(PROFILE_EMAILS).find(([, profileEmail]) => profileEmail.toLowerCase() === email)?.[0];
  if (!person) {
    activePerson = null;
    sessionStorage.removeItem('lock-in-person-v2');
    try { await loadPublicComparison(); } catch (error) { console.error('Public comparison load failed', error); }
    showPage('comparison');
    renderSummary();
    return;
  }
  activePerson = person;
  sessionStorage.setItem('lock-in-person-v2', person);
  try {
    await syncFromCloud(person);
    showPage('entry');
    renderSummary();
  } catch (error) {
    console.error('Cloud session restore failed', error);
    showPage('comparison');
    renderSummary();
  }
}
restorePhoneSession();
