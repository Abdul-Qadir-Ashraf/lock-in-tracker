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
  if (!entry) return; entry.achieved = true; saveGoals(allGoals); $('goalStatus').textContent = '✓ Mission achieved this month.'; renderSummary();
}
function selectLoginPerson(person) {
  selectedLoginPerson = person;
  document.querySelectorAll('.login-button').forEach(button => button.classList.toggle('selected', button.dataset.person === person));
  $('loginError').textContent = '';
}
function logIn() {
  const password = $('loginPassword').value;
  if (!selectedLoginPerson) { $('loginError').textContent = 'Choose Vishwajeet or Abdul first.'; return; }
  if (accounts()[selectedLoginPerson] !== password) { $('loginError').textContent = 'Incorrect password.'; return; }
  activePerson = selectedLoginPerson; sessionStorage.setItem('lock-in-person-v2', activePerson); $('loginPassword').value = ''; showPage('entry');
}
function updatePassword() {
  const current = $('currentPassword').value, next = $('newPassword').value, allAccounts = accounts();
  if (allAccounts[activePerson] !== current) { $('passwordStatus').textContent = 'Current password is incorrect.'; return; }
  if (next.length < 3) { $('passwordStatus').textContent = 'Use at least 3 characters.'; return; }
  allAccounts[activePerson] = next; saveAccounts(allAccounts); $('currentPassword').value = ''; $('newPassword').value = ''; $('passwordStatus').textContent = 'Password updated.';
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
  allBooks[activePerson].current = title; saveBooks(allBooks);
  $('bookStatus').textContent = `✓ ${title} will carry over until you complete it.`; renderSummary();
}
function completeBook() {
  const title = $('bookTitle').value.trim();
  if (!title) { $('bookStatus').textContent = 'Type the completed book title first.'; return; }
  const allBooks = books(); allBooks[activePerson] ||= { current: '', completed: [] };
  const completed = allBooks[activePerson].completed;
  if (!completed.some(book => (typeof book === 'string' ? book : book.title).toLowerCase() === title.toLowerCase())) completed.push({ title, completedOn: dateInput.value });
  allBooks[activePerson].current = ''; saveBooks(allBooks);
  $('bookTitle').value = ''; $('bookStatus').textContent = `✓ ${title} added to your achievements.`; renderSummary();
}
function saveDay() {
  const all = data(), date = dateInput.value, person = activePerson;
  all[date] ||= {}; all[date][person] = {};
  habitGrid.querySelectorAll('input').forEach(input => all[date][person][input.dataset.id] = input.type === 'checkbox' ? input.checked : input.value.trim());
  document.querySelectorAll('[data-health]').forEach(input => { if (!input.disabled) all[date][person][input.dataset.health] = input.value.trim(); });
  save(all); $('saveStatus').textContent = 'Saved'; setTimeout(() => $('saveStatus').textContent = '', 1800); renderSummary();
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
function showPage(page) {
  const entering = page === 'entry';
  $('comparisonPage').hidden = entering; $('entryPage').hidden = !entering; $('appNav').hidden = !activePerson; $('appNav').style.display = activePerson ? 'flex' : 'none';
  if (entering) renderForm(); else renderSummary();
}
document.querySelectorAll('.login-button').forEach(button => button.addEventListener('click', () => selectLoginPerson(button.dataset.person)));
$('loginSubmit').addEventListener('click', logIn); $('loginPassword').addEventListener('keydown', event => { if (event.key === 'Enter') logIn(); });
$('showComparison').addEventListener('click', () => showPage('comparison'));
$('showEntry').addEventListener('click', () => showPage('entry'));
$('logOut').addEventListener('click', () => { sessionStorage.removeItem('lock-in-person-v2'); activePerson = null; showPage('comparison'); });
$('exportData').addEventListener('click', () => { const blob = new Blob([JSON.stringify(data(), null, 2)], {type:'application/json'}); const link = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'lock-in-data.json'}); link.click(); URL.revokeObjectURL(link.href); });
showPage('comparison'); renderSummary();
