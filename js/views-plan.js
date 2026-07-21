/* ============================================================
   Экраны: Планер недели и Список покупок
   ============================================================ */

const PlannerUI = { weekOffset: 0 };

function weekDates(offset = 0) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return dateToStr(d);
  });
}

App.views.planner = function () {
  const dates = weekDates(PlannerUI.weekOffset);
  const first = strToDate(dates[0]), last = strToDate(dates[6]);
  const rangeLabel = `${first.getDate()} ${MONTHS_GEN[first.getMonth()]} — ${last.getDate()} ${MONTHS_GEN[last.getMonth()]}`;

  const norms = Calc.norms();
  const dayCard = (dateStr) => {
    const d = strToDate(dateStr);
    const isToday = dateStr === todayStr();
    const plan = App.state.plan[dateStr] || {};
    let dayKcal = 0, dayProt = 0;
    const slots = MEALS.map(meal => {
      const ids = plan[meal.id] || [];
      const items = ids.map(rid => {
        const r = Calc.recipe(rid);
        if (!r) return '';
        const m = Calc.recipeMacros(r).perServing;
        dayKcal += m.kcal; dayProt += m.p;
        return `<div class="plan-item" onclick="Views.openRecipe('${r.id}')">
          <span>${r.emoji}</span><span class="plan-name">${esc(r.name)}</span>
          <button class="icon-btn" onclick="event.stopPropagation();Views.planRemove('${dateStr}','${meal.id}','${rid}')">✕</button>
        </div>`;
      }).join('');
      return `<div class="plan-slot">
        <div class="plan-slot-head">
          <span>${meal.name}</span>
          <button class="icon-btn add" onclick="Views.planPick('${dateStr}','${meal.id}')" title="Добавить рецепт">+</button>
        </div>
        ${items}
      </div>`;
    }).join('');

    const kcalLabel = dayKcal
      ? `<span class="plan-kcal">≈${fmt(dayKcal)}${norms ? ' / ' + fmt(norms.kcal) : ''} ккал · Б ${fmt(dayProt)}${norms ? ' / ' + fmt(norms.p) : ''} г</span>`
      : '';
    return `<article class="card plan-day ${isToday ? 'today' : ''}">
      <h4>${WEEKDAYS_FULL[d.getDay()]} <small>${d.getDate()} ${MONTHS_GEN[d.getMonth()]}</small>
        <button class="icon-btn add" onclick="Views.planAutoFill('${dateStr}')" title="Подобрать меню под норму">🪄</button>
        ${kcalLabel}</h4>
      ${slots}
    </article>`;
  };

  $('#view').innerHTML = `
    <header class="page-head">
      <div><h1>Планер</h1><p class="subtitle">Меню на неделю — меньше суеты, больше пользы</p></div>
      <div class="head-actions">
        <button class="btn btn-ghost" onclick="Views.planClearWeek()">Очистить неделю</button>
        <button class="btn btn-accent" onclick="Views.planToShopping()">🛒 Покупки из плана</button>
      </div>
    </header>

    <div class="date-nav card">
      <button class="icon-btn" onclick="PlannerUI.weekOffset--;App.refresh()">‹</button>
      <div class="date-nav-label"><b>${rangeLabel}</b>
        ${PlannerUI.weekOffset !== 0 ? `<a href="#" onclick="PlannerUI.weekOffset=0;App.refresh();return false" class="hint">к текущей неделе</a>` : '<span class="hint">текущая неделя</span>'}
      </div>
      <button class="icon-btn" onclick="PlannerUI.weekOffset++;App.refresh()">›</button>
    </div>

    <div class="plan-week">${dates.map(dayCard).join('')}</div>`;
};

/* Подбор меню на день под норму: случайные комбинации, берём ближайшую к цели.
   ponytail: 400 случайных проб вместо оптимизации — при ~20 рецептах этого с запасом. */
Views.planAutoFill = function (dateStr) {
  const norms = Calc.norms();
  if (!norms) {
    Toast.show('Сначала заполните профиль — без нормы меню не подобрать', true);
    return;
  }
  const byCat = (...cats) => App.state.recipes.filter(r => cats.includes(r.cat));
  const pools = { breakfast: byCat('Завтрак'), lunch: byCat('Обед'), dinner: byCat('Ужин'), snack: byCat('Перекус', 'Десерт') };
  if (!pools.breakfast.length || !pools.lunch.length || !pools.dinner.length) {
    Toast.show('Не хватает рецептов по категориям (нужны завтрак, обед и ужин)', true);
    return;
  }
  const doFill = () => {
    const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
    let best = null;
    for (let i = 0; i < 400; i++) {
      const combo = { breakfast: rnd(pools.breakfast), lunch: rnd(pools.lunch), dinner: rnd(pools.dinner) };
      let kcal = 0, prot = 0;
      for (const k of ['breakfast', 'lunch', 'dinner']) { const m = Calc.recipeMacros(combo[k]).perServing; kcal += m.kcal; prot += m.p; }
      // перекусы (до двух) — пока заметно не добираем до нормы
      combo.snack = [];
      while (pools.snack.length && kcal < norms.kcal - 150 && combo.snack.length < 2) {
        const s = rnd(pools.snack);
        combo.snack.push(s);
        const m = Calc.recipeMacros(s).perServing;
        kcal += m.kcal; prot += m.p;
      }
      if (!combo.snack.length) delete combo.snack;
      // белок в «ккал-эквиваленте» (4 ккал/г), чтобы цели были соизмеримы
      const score = Math.abs(kcal - norms.kcal) + Math.abs(prot - norms.p) * 4;
      if (!best || score < best.score) best = { combo, score, kcal, prot };
    }
    const day = {};
    for (const k in best.combo) { const v = best.combo[k]; day[k] = (Array.isArray(v) ? v : [v]).map(r => r.id); }
    App.state.plan[dateStr] = day;
    App.save();
    App.refresh();
    Toast.show(`Подобрано: ≈${fmt(best.kcal)} ккал, белка ${fmt(best.prot)} г 🪄`);
  };
  const hasPlan = Object.values(App.state.plan[dateStr] || {}).some(a => a.length);
  if (hasPlan) Modal.confirm(`Заменить план на ${humanDate(dateStr).toLowerCase()}?`, doFill, 'Заменить');
  else doFill();
};

Views.planClearWeek = function () {
  const dates = weekDates(PlannerUI.weekOffset);
  const filled = dates.filter(d => Object.values(App.state.plan[d] || {}).some(a => a.length));
  if (!filled.length) { Toast.show('На этой неделе и так пусто'); return; }
  Modal.confirm(`Очистить план на эту неделю (${filled.length} ${plural(filled.length, 'день', 'дня', 'дней')})?`, () => {
    for (const d of dates) delete App.state.plan[d];
    App.save();
    App.refresh();
    Toast.show('Неделя очищена');
  }, 'Очистить');
};

Views.planRemove = function (dateStr, mealId, rid) {
  const day = App.state.plan[dateStr];
  if (!day) return;
  const idx = (day[mealId] || []).indexOf(rid);
  if (idx !== -1) day[mealId].splice(idx, 1);
  App.save();
  App.refresh();
};

Views.planPick = function (dateStr, mealId) {
  const mealName = MEALS.find(m => m.id === mealId)?.name || '';
  Modal.open(`
    <h2>${mealName} · ${humanDate(dateStr)}</h2>
    <input type="search" id="plan-search" class="input search-input" placeholder="Найти рецепт…">
    <div id="plan-results" class="add-results"></div>`);

  const render = () => {
    const q = ($('#plan-search').value || '').toLowerCase();
    let list = App.state.recipes.filter(r => !q || r.name.toLowerCase().includes(q));
    // сначала подходящие по категории и любимые
    list.sort((a, b) => (b.cat === mealName) - (a.cat === mealName) || b.fav - a.fav || a.name.localeCompare(b.name, 'ru'));
    $('#plan-results').innerHTML = list.map(r => {
      const m = Calc.recipeMacros(r).perServing;
      return `<button class="add-item" onclick="Views.planAdd('${dateStr}','${mealId}','${r.id}')">
        <span>${r.emoji}</span><span class="add-name">${r.fav ? '❤️ ' : ''}${esc(r.name)}</span><small>${fmt(m.kcal)} ккал</small>
      </button>`;
    }).join('') || '<div class="empty">Не нашлось 🤔</div>';
  };
  $('#plan-search').addEventListener('input', render);
  render();
};

Views.planAdd = function (dateStr, mealId, rid) {
  const day = (App.state.plan[dateStr] = App.state.plan[dateStr] || {});
  (day[mealId] = day[mealId] || []).push(rid);
  App.save();
  Modal.close();
  App.refresh();
};

/* Собираем ингредиенты всех рецептов недели в список покупок */
Views.planToShopping = function () {
  const dates = weekDates(PlannerUI.weekOffset);
  const grams = {}; // productId -> grams
  let recipesCount = 0;
  for (const dateStr of dates) {
    const day = App.state.plan[dateStr] || {};
    for (const meal of MEALS) {
      for (const rid of (day[meal.id] || [])) {
        const r = Calc.recipe(rid);
        if (!r) continue;
        recipesCount++;
        for (const i of r.ing) grams[i.p] = (grams[i.p] || 0) + i.g;
      }
    }
  }
  const ids = Object.keys(grams);
  if (!ids.length) { Toast.show('На этой неделе пока ничего не запланировано', true); return; }

  let added = 0, merged = 0;
  for (const pid of ids) {
    const p = Calc.product(pid);
    if (!p) continue;
    const qty = `${fmt(grams[pid])} г`;
    const existing = App.state.shopping.find(s => s.name === p.name && !s.checked);
    if (existing) { existing.qty = qty; merged++; }
    else { App.state.shopping.push({ id: uid(), name: p.name, emoji: p.emoji, qty, checked: false }); added++; }
  }
  App.save();
  Toast.show(`Список готов: ${added + merged} ${plural(added + merged, 'позиция', 'позиции', 'позиций')} из ${recipesCount} ${plural(recipesCount, 'рецепта', 'рецептов', 'рецептов')} 🛒`);
  App.go('shopping');
};

/* Ингредиенты одного рецепта — в покупки (кнопка в карточке рецепта) */
Views.addRecipeToShopping = function (rid) {
  const r = Calc.recipe(rid);
  if (!r) return;
  for (const i of r.ing) {
    const p = Calc.product(i.p);
    if (!p) continue;
    const existing = App.state.shopping.find(s => s.name === p.name && !s.checked);
    if (existing) existing.qty = `${fmt(i.g)} г`;
    else App.state.shopping.push({ id: uid(), name: p.name, emoji: p.emoji, qty: `${fmt(i.g)} г`, checked: false });
  }
  App.save();
  Toast.show(`Ингредиенты «${r.name}» добавлены в покупки 🛒`);
};

/* ---------- Список покупок ---------- */

/* Примерная цена позиции: граммовка из qty × цена продукта (₽/кг), если оба известны */
function shopItemCost(i) {
  const m = /^([\d\s.,]+)\s*г$/.exec(i.qty || '');
  if (!m) return null;
  const grams = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
  const p = App.state.products.find(x => x.name === i.name);
  if (!grams || !p || !p.price) return null;
  return grams / 1000 * p.price;
}

App.views.shopping = function () {
  const list = App.state.shopping;
  const open = list.filter(i => !i.checked);
  const done = list.filter(i => i.checked);
  const costs = open.map(shopItemCost);
  const total = costs.reduce((s, c) => s + (c || 0), 0);
  const unknown = costs.filter(c => c == null).length;

  const item = (i) => {
    const cost = shopItemCost(i);
    return `
    <li class="shop-item ${i.checked ? 'done' : ''}">
      <label class="shop-check">
        <input type="checkbox" ${i.checked ? 'checked' : ''} onchange="Views.shopToggle('${i.id}')">
        <span class="checkmark"></span>
      </label>
      <span class="shop-name">${i.emoji ? i.emoji + ' ' : ''}${esc(i.name)}</span>
      ${i.qty ? `<span class="shop-qty">${esc(i.qty)}${cost ? ` · ≈${fmt(cost)} ₽` : ''}</span>` : ''}
      <button class="icon-btn" onclick="Views.shopDelete('${i.id}')">✕</button>
    </li>`;
  };

  const sub = open.length
    ? `Осталось купить: ${open.length}${total ? ` · примерно ${fmt(total)} ₽${unknown ? ` (без ${unknown} ${plural(unknown, 'позиции', 'позиций', 'позиций')} — нет цены)` : ''}` : ''}`
    : 'Всё куплено — отличная работа!';

  $('#view').innerHTML = `
    <header class="page-head">
      <div><h1>Покупки</h1><p class="subtitle">${sub}</p></div>
      ${done.length ? `<button class="btn btn-ghost" onclick="Views.shopClearDone()">Убрать купленное</button>` : ''}
    </header>

    <form id="shop-add" class="shop-add card">
      <input class="input" id="shop-name" placeholder="Добавить: например, оливковое масло…" required>
      <input class="input input-small" id="shop-qty" placeholder="Кол-во">
      <button class="btn btn-primary" type="submit">+</button>
    </form>

    ${list.length ? `
      <ul class="shop-list card">${open.map(item).join('')}</ul>
      ${done.length ? `<p class="group-label">Куплено</p><ul class="shop-list card">${done.map(item).join('')}</ul>` : ''}`
      : `<div class="empty">Список пуст 🧺<br><small>Добавьте позиции вручную или соберите список из плана на неделю</small><br><br>
         <button class="btn btn-primary" onclick="App.go('planner')">Открыть планер →</button></div>`}`;

  $('#shop-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#shop-name').value.trim();
    if (!name) return;
    App.state.shopping.unshift({ id: uid(), name, qty: $('#shop-qty').value.trim(), checked: false });
    App.save();
    App.refresh();
  });
};

Views.shopToggle = function (id) {
  const i = App.state.shopping.find(s => s.id === id);
  if (i) i.checked = !i.checked;
  App.save();
  App.refresh();
};

Views.shopDelete = function (id) {
  App.state.shopping = App.state.shopping.filter(s => s.id !== id);
  App.save();
  App.refresh();
};

Views.shopClearDone = function () {
  App.state.shopping = App.state.shopping.filter(s => !s.checked);
  App.save();
  App.refresh();
};
