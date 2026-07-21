/* ============================================================
   Экран: Дневник питания
   ============================================================ */

const DiaryUI = { date: null };

App.views.diary = function () {
  if (!DiaryUI.date) DiaryUI.date = todayStr();
  const date = DiaryUI.date;
  const entries = App.state.diary[date] || [];
  const totals = Calc.dayTotals(date);
  const norms = Calc.norms();

  const pct = norms ? Math.min(1, totals.kcal / norms.kcal) : 0;
  const left = norms ? norms.kcal - totals.kcal : null;

  const macroRow = (label, val, goal, cls) => {
    const w = goal ? Math.min(100, val / goal * 100) : 0;
    return `
      <div class="macro-row">
        <div class="macro-head"><span>${label}</span><span>${fmt(val)}${goal ? ' / ' + fmt(goal) : ''} г</span></div>
        <div class="bar"><div class="bar-fill ${cls}" style="width:${w}%"></div></div>
      </div>`;
  };

  const mealBlock = (meal) => {
    const list = entries.filter(e => e.meal === meal.id);
    const mt = list.reduce((acc, e) => {
      const m = Calc.entryMacros(e);
      return { kcal: acc.kcal + m.kcal, p: acc.p + m.p, f: acc.f + m.f, c: acc.c + m.c };
    }, { kcal: 0, p: 0, f: 0, c: 0 });
    return `
      <section class="meal-block">
        <div class="meal-head">
          <h3>${meal.name}</h3>
          <div class="meal-head-right">
            ${list.length ? `<span class="hint">${fmt(mt.kcal)} ккал</span>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="Views.addToDiaryDialog(null,null,'${meal.id}')">+ Добавить</button>
          </div>
        </div>
        ${list.length ? `<ul class="diary-list">${list.map(e => {
          const m = Calc.entryMacros(e);
          let name = '?', emoji = '🍽️', amount = '';
          if (e.type === 'product') {
            const p = Calc.product(e.refId);
            if (p) { name = p.name; emoji = p.emoji; }
            amount = fmt(e.g) + ' г';
          } else {
            const r = Calc.recipe(e.refId);
            if (r) { name = r.name; emoji = r.emoji; }
            amount = fmt(e.servings, e.servings % 1 ? 1 : 0) + ' ' + plural(Math.round(e.servings), 'порция', 'порции', 'порций');
          }
          return `<li>
            <span class="d-emoji">${emoji}</span>
            <span class="d-name">${esc(name)}</span>
            <span class="d-meta">${amount}</span>
            <span class="d-kcal">${fmt(m.kcal)} ккал</span>
            <button class="icon-btn" onclick="Views.deleteDiaryEntry('${e.id}')" title="Удалить">✕</button>
          </li>`;
        }).join('')}</ul>` : ''}
      </section>`;
  };

  $('#view').innerHTML = `
    <header class="page-head">
      <div><h1>Дневник</h1><p class="subtitle">Записывайте — и баланс будет под контролем</p></div>
      <div class="head-actions">
        <div class="date-nav">
          <button class="icon-btn" onclick="Views.diaryShift(-1)">‹</button>
          <div class="date-nav-label">
            <b>${humanDate(date)}</b>
            <input type="date" id="diary-date" value="${date}" class="date-input">
          </div>
          <button class="icon-btn" onclick="Views.diaryShift(1)">›</button>
        </div>
        ${entries.length ? `<button class="btn btn-ghost" onclick="Views.diaryClear()">Очистить день</button>` : ''}
      </div>
    </header>

    <section class="card day-summary">
      <div class="today-flex">
        <div class="day-kcal">
          <div class="day-kcal-num">${fmt(totals.kcal)}</div>
          <div class="hint">ккал съедено</div>
          ${norms ? `<div class="day-left ${left < 0 ? 'over' : ''}">${left >= 0 ? 'осталось ' + fmt(left) : 'перебор ' + fmt(-left)}</div>` : ''}
          ${norms ? `<div class="bar bar-lg"><div class="bar-fill fill-kcal ${pct >= 1 ? 'over' : ''}" style="width:${pct * 100}%"></div></div>` : ''}
        </div>
        <div class="macros">
          ${norms
            ? macroRow('Белки', totals.p, norms.p, 'fill-p') + macroRow('Жиры', totals.f, norms.f, 'fill-f') + macroRow('Углеводы', totals.c, norms.c, 'fill-c')
            : macroRow('Белки', totals.p, 0, 'fill-p') + macroRow('Жиры', totals.f, 0, 'fill-f') + macroRow('Углеводы', totals.c, 0, 'fill-c')}
        </div>
      </div>
    </section>

    <section class="card meals-day">${MEALS.map(mealBlock).join('')}</section>`;

  $('#diary-date').addEventListener('change', (e) => {
    if (e.target.value) { DiaryUI.date = e.target.value; App.refresh(); }
  });
};

Views.diaryShift = function (days) {
  const d = strToDate(DiaryUI.date);
  d.setDate(d.getDate() + days);
  DiaryUI.date = dateToStr(d);
  App.refresh();
};

Views.diaryClear = function () {
  const date = DiaryUI.date || todayStr();
  Modal.confirm(`Удалить все записи за ${humanDate(date).toLowerCase()}?`, () => {
    delete App.state.diary[date];
    App.save();
    App.refresh();
    Toast.show('День очищен');
  }, 'Очистить');
};

Views.deleteDiaryEntry = function (entryId) {
  const date = DiaryUI.date || todayStr();
  App.state.diary[date] = (App.state.diary[date] || []).filter(e => e.id !== entryId);
  App.save();
  App.refresh();
};

/* ---------- Диалог «добавить в дневник» ----------
   Вызывается из дневника (выбор еды) или из карточки
   продукта/рецепта (тогда type+refId уже известны).   */

const AddDiary = { type: null, refId: null, meal: 'breakfast', search: '' };

Views.addToDiaryDialog = function (type = null, refId = null, meal = null) {
  AddDiary.type = type;
  AddDiary.refId = refId;
  AddDiary.search = '';
  if (meal) AddDiary.meal = meal;
  else {
    const h = new Date().getHours();
    AddDiary.meal = h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
  }
  Modal.close();
  if (type && refId) Views.renderAddDiaryStep2();
  else Views.renderAddDiaryStep1();
};

/* Шаг 1: поиск еды */
Views.renderAddDiaryStep1 = function () {
  Modal.open(`
    <h2>Что добавить?</h2>
    <div class="chips" id="add-meal-pick">
      ${MEALS.map(m => `<button type="button" class="chip ${AddDiary.meal === m.id ? 'active' : ''}" data-meal="${m.id}">${m.name}</button>`).join('')}
    </div>
    <input type="search" id="add-search" class="input search-input" placeholder="Найти продукт или рецепт…" autofocus>
    <div id="add-results" class="add-results"></div>`);
  $('#add-meal-pick').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    AddDiary.meal = btn.dataset.meal;
    $$('#add-meal-pick .chip').forEach(c => c.classList.toggle('active', c === btn));
    Views.renderAddResults();
  });
  $('#add-search').addEventListener('input', (e) => { AddDiary.search = e.target.value; Views.renderAddResults(); });
  Views.renderAddResults();
  setTimeout(() => $('#add-search')?.focus(), 50);
};

/* Категории рецептов, подходящие каждому приёму (для фильтра в диалоге) */
const MEAL_RECIPE_CATS = { breakfast: ['Завтрак'], lunch: ['Обед'], dinner: ['Ужин'], snack: ['Перекус', 'Десерт'] };

Views.renderAddResults = function () {
  const q = AddDiary.search.toLowerCase();
  let recipes = App.state.recipes.filter(r => !q || r.name.toLowerCase().includes(q));
  // без поискового запроса — рецепты выбранного приёма, любимые первыми
  if (!q) {
    const cats = MEAL_RECIPE_CATS[AddDiary.meal] || [];
    recipes = recipes.filter(r => cats.includes(r.cat));
  }
  recipes.sort((a, b) => b.fav - a.fav || a.name.localeCompare(b.name, 'ru'));
  if (q) recipes = recipes.slice(0, 20);
  const products = q ? App.state.products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 30) : [];
  const mealName = MEALS.find(m => m.id === AddDiary.meal)?.name || '';
  $('#add-results').innerHTML = `
    ${recipes.length ? `<p class="group-label">Рецепты${!q ? ' · ' + mealName : ''}</p>` + recipes.map(r => {
      const m = Calc.recipeMacros(r).perServing;
      return `<button class="add-item" onclick="AddDiary.type='recipe';AddDiary.refId='${r.id}';Views.renderAddDiaryStep2()">
        <span>${r.emoji}</span><span class="add-name">${esc(r.name)}</span><small>${fmt(m.kcal)} ккал/порц.</small>
      </button>`;
    }).join('') : ''}
    ${products.length ? `<p class="group-label">Продукты</p>` + products.map(p => `
      <button class="add-item" onclick="AddDiary.type='product';AddDiary.refId='${p.id}';Views.renderAddDiaryStep2()">
        <span>${p.emoji}</span><span class="add-name">${esc(p.name)}</span><small>${fmt(p.kcal)} ккал/100 г</small>
      </button>`).join('') : ''}
    ${!q ? '<p class="hint" style="margin-top:8px">Продукт (творог, яблоко…) ищите по названию ↑</p>' : ''}
    ${!recipes.length && !products.length && q ? '<div class="empty">Не нашлось 🤔</div>' : ''}`;
};

/* Шаг 2: количество и приём пищи */
Views.renderAddDiaryStep2 = function () {
  const isProduct = AddDiary.type === 'product';
  const item = isProduct ? Calc.product(AddDiary.refId) : Calc.recipe(AddDiary.refId);
  if (!item) return;
  const defaultAmount = isProduct ? 100 : 1;

  Modal.open(`
    <h2>${item.emoji} ${esc(item.name)}</h2>
    <form id="add-form" class="form">
      <label>${isProduct ? 'Сколько граммов?' : 'Сколько порций?'}
        <input class="input" type="number" id="add-amount" min="${isProduct ? 1 : 0.5}" step="${isProduct ? 1 : 0.5}" value="${defaultAmount}">
      </label>
      <div id="add-macros" class="badges"></div>
      <label>Приём пищи
        <div class="meal-pick">
          ${MEALS.map(m => `<button type="button" class="chip ${AddDiary.meal === m.id ? 'active' : ''}" data-meal="${m.id}">${m.name}</button>`).join('')}
        </div>
      </label>
      <div class="form-row">
        <label>Время<input class="input" type="time" id="add-time" value="${new Date().toTimeString().slice(0, 5)}"></label>
        <label>Дата<input class="input" type="date" id="add-date" value="${DiaryUI.date || todayStr()}"></label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="Views.renderAddDiaryStep1()">‹ Назад</button>
        <button type="submit" class="btn btn-primary">Записать</button>
      </div>
    </form>`);

  const updMacros = () => {
    const amount = parseFloat($('#add-amount').value) || 0;
    const m = isProduct
      ? Calc.productMacros(item, amount)
      : (() => { const ps = Calc.recipeMacros(item).perServing; return { kcal: ps.kcal * amount, p: ps.p * amount, f: ps.f * amount, c: ps.c * amount }; })();
    $('#add-macros').innerHTML = macroBadges(m);
  };
  $('#add-amount').addEventListener('input', updMacros);
  updMacros();

  $('.meal-pick').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    AddDiary.meal = btn.dataset.meal;
    $$('.meal-pick .chip').forEach(c => c.classList.toggle('active', c === btn));
  });

  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat($('#add-amount').value) || 0;
    if (amount <= 0) return;
    const date = $('#add-date').value || todayStr();
    const entry = { id: uid(), meal: AddDiary.meal, type: AddDiary.type, refId: AddDiary.refId, time: $('#add-time').value || null };
    if (isProduct) entry.g = amount; else entry.servings = amount;
    (App.state.diary[date] = App.state.diary[date] || []).push(entry);
    App.save();
    Modal.close();
    Toast.show('Записано в дневник ✅');
    if (App.route.view === 'diary') { DiaryUI.date = date; App.refresh(); }
    if (App.route.view === 'home') App.refresh();
  });
};
