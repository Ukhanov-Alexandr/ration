/* ============================================================
   Экраны: Главная и Продукты
   ============================================================ */

/* ---------- Главная ---------- */

App.views.home = function () {
  const st = App.state;
  const today = todayStr();
  const totals = Calc.dayTotals(today);
  const norms = Calc.norms();

  // совет дня — стабильный для конкретной даты
  const d = strToDate(today);
  const tip = SEED_TIPS[(d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate()) % SEED_TIPS.length];

  // заголовок: «Саша, цель — 1 800 ккал в день»
  const name = st.profile.name ? esc(st.profile.name) : '';
  const goalLine = norms
    ? `${name ? name + ', ц' : 'Ц'}ель — ${fmt(norms.kcal)} ккал в день`
    : `${name ? name + ', д' : 'Д'}обро пожаловать`;

  // кольцо калорий
  const pct = norms ? Math.min(1, totals.kcal / norms.kcal) : 0;
  const left = norms ? norms.kcal - totals.kcal : null;
  const R = 52, CIRC = 2 * Math.PI * R;
  const ringHtml = `
    <svg viewBox="0 0 120 120" class="ring">
      <circle cx="60" cy="60" r="${R}" class="ring-bg"/>
      <circle cx="60" cy="60" r="${R}" class="ring-fg ${pct >= 1 ? 'over' : ''}"
        stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC * (1 - pct)}"/>
      <text x="60" y="56" class="ring-num">${fmt(totals.kcal)}</text>
      <text x="60" y="74" class="ring-sub">${norms ? 'из ' + fmt(norms.kcal) : 'ккал'}</text>
    </svg>`;

  const macroRow = (label, val, goal, cls) => {
    const w = goal ? Math.min(100, val / goal * 100) : 0;
    return `
      <div class="macro-row">
        <div class="macro-head"><span>${label}</span><span>${fmt(val)}${goal ? ' / ' + fmt(goal) + ' г' : ' г'}</span></div>
        <div class="bar"><div class="bar-fill ${cls}" style="width:${w}%"></div></div>
      </div>`;
  };

  // лента дня: записи дневника по времени (старые записи без времени — в конце, в порядке добавления)
  const entries = st.diary[today] || [];
  const feed = [...entries].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const feedRows = feed.map(e => {
    const m = Calc.entryMacros(e);
    let itemName = '?', emoji = '🍽️', amount = '';
    if (e.type === 'product') {
      const p = Calc.product(e.refId);
      if (p) { itemName = p.name; emoji = p.emoji; }
      amount = fmt(e.g) + ' г';
    } else {
      const r = Calc.recipe(e.refId);
      if (r) { itemName = r.name; emoji = r.emoji; }
      amount = fmt(e.servings, e.servings % 1 ? 1 : 0) + ' ' + plural(Math.round(e.servings), 'порция', 'порции', 'порций');
    }
    const meal = MEALS.find(x => x.id === e.meal);
    return `<li class="eaten">
      <span class="d-emoji">${emoji}</span>
      <span class="d-name">${esc(itemName)}</span>
      <span class="d-meta">${e.time || ''}</span>
      <span class="d-meta">${amount}</span>
      <span class="d-meta d-meal">${meal ? meal.name : ''}</span>
      <span class="d-kcal">${fmt(m.kcal)} ккал</span>
      <button class="icon-btn" onclick="Views.homeRemoveEntry('${e.id}')" title="Убрать">✕</button>
    </li>`;
  }).join('');

  // осталось по плану: рецепты плана без соответствующей записи в дневнике (приём + рецепт)
  const plan = st.plan[today] || {};
  const used = {};
  for (const e of entries) if (e.type === 'recipe') used[e.meal + '|' + e.refId] = (used[e.meal + '|' + e.refId] || 0) + 1;
  const planLeft = MEALS.flatMap(meal => (plan[meal.id] || []).map(rid => ({ meal, rid })))
    .filter(x => {
      const k = x.meal.id + '|' + x.rid;
      if (used[k]) { used[k]--; return false; }
      return true;
    })
    .map(x => ({ ...x, rec: Calc.recipe(x.rid) }))
    .filter(x => x.rec);
  const planRows = planLeft.map(x => `
    <li>
      <button class="check-circle" onclick="Views.homeEat('${x.meal.id}','${x.rec.id}')" title="Отметить съеденным">✓</button>
      <span class="d-emoji">${x.rec.emoji}</span>
      <span class="d-name link" onclick="Views.openRecipe('${x.rec.id}')">${esc(x.rec.name)}</span>
      <span class="d-meta d-meal">${x.meal.name}</span>
      <span class="d-kcal">${fmt(Calc.recipeMacros(x.rec).perServing.kcal)} ккал</span>
    </li>`).join('');

  // неделя: последние 7 дней, сегодня — справа
  const days = Array.from({ length: 7 }, (_, i) => todayStr(i - 6));
  const kcals = days.map(dd => Calc.dayTotals(dd).kcal);
  const max = Math.max(...kcals, norms ? norms.kcal : 0, 1);
  const tracked = kcals.filter(k => k > 0);
  const avg = tracked.length ? Math.round(tracked.reduce((a, b) => a + b, 0) / tracked.length) : 0;
  const overs = norms ? days.filter((dd, i) => kcals[i] > norms.kcal) : [];
  const weekCaption = !tracked.length
    ? 'Пока нет записей за неделю'
    : !norms ? ''
      : !overs.length
        ? 'Все дни в пределах цели'
        : overs.length === 1
          ? `${WEEKDAYS_FULL[strToDate(overs[0]).getDay()]} — выше нормы на ${fmt(kcals[days.indexOf(overs[0])] - norms.kcal)} ккал, остальные дни в цели.`
          : `${overs.map(dd => WEEKDAYS[strToDate(dd).getDay()]).join(', ')} — выше нормы, остальные дни в цели.`;
  const weekBars = days.map((dd, i) => {
    const cls = (norms && kcals[i] > norms.kcal ? ' over' : '') + (dd === today ? ' today' : '');
    return `
    <div class="week-col${cls}" title="${humanDate(dd)}: ${fmt(kcals[i])} ккал">
      <div class="week-bar-wrap"><div class="week-bar${cls}" style="height:${Math.max(4, kcals[i] / max * 100)}%"></div></div>
      <span class="week-lbl">${WEEKDAYS[strToDate(dd).getDay()].toLowerCase()}</span>
    </div>`;
  }).join('');

  $('#view').innerHTML = `
    <header class="page-head">
      <div>
        <h1>${goalLine}</h1>
        <p class="subtitle">${WEEKDAYS_FULL[new Date().getDay()]}, ${new Date().getDate()} ${MONTHS_GEN[new Date().getMonth()]} · дневник за сегодня</p>
      </div>
    </header>

    <div class="tip-card card">
      <span class="tip-emoji">💡</span>
      <div><div class="tip-label">Совет дня</div><div class="tip-text">${esc(tip)}</div></div>
    </div>

    <div class="home-grid">
      <section class="card today-card" onclick="App.go('diary')">
        <div class="meal-head">
          <h3>Сегодня</h3>
          ${norms ? `<span class="hint">${left >= 0 ? 'Осталось ' + fmt(left) + ' ккал' : 'Перебор ' + fmt(-left) + ' ккал'}</span>` : ''}
        </div>
        <div class="today-flex">
          ${ringHtml}
          <div class="macros">
            ${norms
              ? macroRow('Белки', totals.p, norms.p, 'fill-p') + macroRow('Жиры', totals.f, norms.f, 'fill-f') + macroRow('Углеводы', totals.c, norms.c, 'fill-c')
              : macroRow('Белки', totals.p, 0, 'fill-p') + macroRow('Жиры', totals.f, 0, 'fill-f') + macroRow('Углеводы', totals.c, 0, 'fill-c') +
                `<p class="hint"><a href="#" onclick="App.go('profile');return false">Заполните профиль</a>, чтобы видеть свою норму</p>`}
          </div>
        </div>
      </section>

      <section class="card week-card">
        <div class="meal-head">
          <h3>Неделя</h3>
          <span class="hint">${avg ? `в среднем ${fmt(avg)} ккал` : ''}</span>
        </div>
        <div class="week-bars">${weekBars}</div>
        ${weekCaption ? `<p class="hint">${weekCaption}</p>` : ''}
      </section>

      <section class="card meals-card">
        <div class="meal-head">
          <h3>Приёмы пищи сегодня</h3>
          <button class="btn btn-primary btn-sm" onclick="Views.addToDiaryDialog()">+ Добавить</button>
        </div>
        ${entries.length
          ? `<ul class="diary-list">${feedRows}</ul>`
          : `<p class="hint" style="margin-top:8px">Пока ничего не записано — отметьте блюдо из плана или нажмите «Добавить».</p>`}
        ${planLeft.length
          ? `<p class="group-label">Осталось по плану</p><ul class="diary-list">${planRows}</ul>`
          : (entries.length ? '' : `<p class="hint">Плана на сегодня нет. <a href="#" onclick="App.go('planner');return false">Запланировать меню →</a></p>`)}
      </section>
    </div>`;
};

const Views = {};

/* Отметить запланированный рецепт съеденным: запись в дневник, 1 порция */
Views.homeEat = function (mealId, rid) {
  const today = todayStr();
  (App.state.diary[today] = App.state.diary[today] || []).push({ id: uid(), meal: mealId, type: 'recipe', refId: rid, servings: 1, time: new Date().toTimeString().slice(0, 5) });
  App.save();
  App.refresh();
};

/* Убрать запись из ленты дня (рецепт из плана вернётся в «осталось по плану») */
Views.homeRemoveEntry = function (id) {
  const today = todayStr();
  App.state.diary[today] = (App.state.diary[today] || []).filter(e => e.id !== id);
  App.save();
  App.refresh();
};

/* ---------- Продукты ---------- */

const ProductsUI = {
  search: '', cat: 'all', sortKey: 'name', sortDir: 1, // клик по заголовку колонки меняет сортировку

  filtered() {
    let list = [...App.state.products];
    if (this.cat !== 'all') list = list.filter(p => p.cat === this.cat);
    if (this.search) {
      const q = this.search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    const k = this.sortKey, d = this.sortDir;
    return list.sort((a, b) => k === 'name'
      ? d * a.name.localeCompare(b.name, 'ru')
      : d * ((a[k] ?? -1) - (b[k] ?? -1)) || a.name.localeCompare(b.name, 'ru'));
  },
};

Views.prodSort = function (key) {
  if (ProductsUI.sortKey === key) ProductsUI.sortDir *= -1;
  else { ProductsUI.sortKey = key; ProductsUI.sortDir = key === 'name' ? 1 : -1; } // числа сначала по убыванию
  Views.renderProductList();
};

App.views.products = function () {
  $('#view').innerHTML = `
    <header class="page-head">
      <div><h1>Продукты</h1><p class="subtitle">БЖУ и калорийность на 100 г · только полезное</p></div>
      <div class="head-actions">
        ${App.state.products.some(p => p.custom) ? `<button class="btn btn-ghost" onclick="Views.productsClearCustom()">Очистить свои</button>` : ''}
        <button class="btn btn-primary" onclick="Views.editProduct()">+ Добавить</button>
      </div>
    </header>

    <div class="filters">
      <input type="search" id="prod-search" class="input search-input" placeholder="Найти продукт…" value="${esc(ProductsUI.search)}">
    </div>

    <div class="chips" id="prod-chips">
      <button class="chip ${ProductsUI.cat === 'all' ? 'active' : ''}" data-cat="all">Все</button>
      ${SEED_CATEGORIES.map(c => `<button class="chip ${ProductsUI.cat === c.id ? 'active' : ''}" data-cat="${c.id}">${c.emoji} ${c.name}</button>`).join('')}
    </div>

    <div id="prod-list"></div>`;

  $('#prod-search').addEventListener('input', (e) => { ProductsUI.search = e.target.value; Views.renderProductList(); });
  $('#prod-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    ProductsUI.cat = btn.dataset.cat;
    $$('#prod-chips .chip').forEach(c => c.classList.toggle('active', c === btn));
    Views.renderProductList();
  });
  Views.renderProductList();
};

Views.renderProductList = function () {
  const list = ProductsUI.filtered();
  const showTop = ProductsUI.sortKey === 'p' && ProductsUI.sortDir === -1;
  const th = (key, label) => {
    const active = ProductsUI.sortKey === key;
    return `<span class="th-sort ${active ? 'active' : ''}" onclick="Views.prodSort('${key}')">${label}${active ? (ProductsUI.sortDir === 1 ? ' ▲' : ' ▼') : ''}</span>`;
  };
  $('#prod-list').innerHTML = list.length ? `
    <div class="table-head prod-row">
      <span></span>${th('name', 'Продукт')}${th('kcal', 'Ккал')}${th('p', 'Белки')}${th('f', 'Жиры')}${th('c', 'Углев.')}${th('price', '₽/кг')}
    </div>
    ${list.map((p, i) => `
      <div class="prod-row card-row" onclick="Views.openProduct('${p.id}')">
        <span class="prod-emoji">${p.emoji}</span>
        <span class="prod-name">${esc(p.name)} ${showTop && i < 3 ? '<span class="medal">' + ['🥇', '🥈', '🥉'][i] + '</span>' : ''}${p.custom ? '<span class="tag-custom">своё</span>' : ''}</span>
        <span class="num">${fmt(p.kcal)}</span>
        <span class="num num-p">${fmt1(p.p)}</span>
        <span class="num num-f">${fmt1(p.f)}</span>
        <span class="num num-c">${fmt1(p.c)}</span>
        <span class="num">${p.price ? fmt(p.price) : '—'}</span>
      </div>`).join('')}`
    : `<div class="empty">Ничего не нашлось 🤔<br><small>Попробуйте другой запрос или добавьте свой продукт</small></div>`;
};

Views.openProduct = function (id) {
  const p = Calc.product(id);
  if (!p) return;
  const cat = SEED_CATEGORIES.find(c => c.id === p.cat);
  const usedIn = App.state.recipes.filter(r => r.ing.some(i => i.p === id));
  Modal.open(`
    <div class="prod-detail">
      <div class="prod-detail-head">
        <span class="prod-detail-emoji">${p.emoji}</span>
        <div>
          <h2>${esc(p.name)}</h2>
          <p class="hint">${cat ? cat.emoji + ' ' + cat.name : ''} · на 100 г${p.price ? ` · ≈${fmt(p.price)} ₽/кг` : ''}</p>
        </div>
      </div>
      <div class="macro-cards">
        <div class="mc mc-kcal"><b>${fmt(p.kcal)}</b><span>ккал</span></div>
        <div class="mc mc-p"><b>${fmt1(p.p)}</b><span>белки</span></div>
        <div class="mc mc-f"><b>${fmt1(p.f)}</b><span>жиры</span></div>
        <div class="mc mc-c"><b>${fmt1(p.c)}</b><span>углеводы</span></div>
      </div>
      <div class="portion-calc">
        <label>Посчитать порцию: <input type="number" id="portion-g" class="input input-small" value="100" min="1"> г</label>
        <div id="portion-out" class="portion-out"></div>
      </div>
      ${usedIn.length ? `<p class="hint">Используется в рецептах: ${usedIn.map(r => `<a href="#" onclick="Modal.close();Views.openRecipe('${r.id}');return false">${esc(r.name)}</a>`).join(', ')}</p>` : ''}
      <div class="form-actions">
        ${p.custom ? `<button class="btn btn-danger-ghost" onclick="Views.deleteProduct('${p.id}')">Удалить</button>` : ''}
        <button class="btn btn-ghost" onclick="Views.editProduct('${p.id}')">✏️ Изменить</button>
        <button class="btn btn-primary" onclick="Views.addToDiaryDialog('product','${p.id}')">+ В дневник</button>
      </div>
    </div>`);
  const upd = () => {
    const g = parseFloat($('#portion-g').value) || 0;
    const m = Calc.productMacros(p, g);
    $('#portion-out').innerHTML = macroBadges(m);
  };
  $('#portion-g').addEventListener('input', upd);
  upd();
};

Views.editProduct = function (id) {
  const p = id ? Calc.product(id) : null;
  Modal.open(`
    <h2>${p ? 'Изменить продукт' : 'Новый продукт'}</h2>
    <form id="prod-form" class="form">
      <label>Название<input class="input" name="name" required value="${esc(p?.name || '')}" placeholder="Например: Сыр адыгейский"></label>
      <div class="form-row">
        <label>Категория<select class="input" name="cat">
          ${SEED_CATEGORIES.map(c => `<option value="${c.id}" ${p?.cat === c.id ? 'selected' : ''}>${c.emoji} ${c.name}</option>`).join('')}
        </select></label>
        <label>Эмодзи<input class="input" name="emoji" value="${esc(p?.emoji || '🍽️')}" maxlength="4"></label>
      </div>
      <p class="hint">Пищевая ценность на 100 г:</p>
      <div class="form-row form-row-4">
        <label>Ккал<input class="input" name="kcal" type="number" step="0.1" min="0" required value="${p?.kcal ?? ''}"></label>
        <label>Белки<input class="input" name="p" type="number" step="0.1" min="0" required value="${p?.p ?? ''}"></label>
        <label>Жиры<input class="input" name="f" type="number" step="0.1" min="0" required value="${p?.f ?? ''}"></label>
        <label>Углеводы<input class="input" name="c" type="number" step="0.1" min="0" required value="${p?.c ?? ''}"></label>
      </div>
      <label>Цена, ₽ за кг <small>(необязательно — для прикидки стоимости покупок)</small>
        <input class="input" name="price" type="number" step="1" min="0" value="${p?.price ?? ''}" placeholder="напр. 350"></label>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="Modal.close()">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>`);
  $('#prod-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = {
      name: f.get('name').trim(), cat: f.get('cat'), emoji: f.get('emoji').trim() || '🍽️',
      kcal: parseFloat(f.get('kcal')) || 0, p: parseFloat(f.get('p')) || 0,
      f: parseFloat(f.get('f')) || 0, c: parseFloat(f.get('c')) || 0,
      price: parseFloat(f.get('price')) || null,
    };
    if (p) {
      Object.assign(p, data);
      Toast.show('Продукт обновлён ✅');
    } else {
      App.state.products.push({ id: uid(), custom: true, ...data });
      Toast.show('Продукт добавлен ✅');
    }
    App.save();
    Modal.close();
    if (App.route.view === 'products') Views.renderProductList();
  });
};

/* Удалить все свои продукты разом (кроме используемых в рецептах) */
Views.productsClearCustom = function () {
  const custom = App.state.products.filter(p => p.custom);
  const usedIds = new Set(App.state.recipes.flatMap(r => r.ing.map(i => i.p)));
  const removable = custom.filter(p => !usedIds.has(p.id));
  if (!removable.length) {
    Toast.show('Все свои продукты используются в рецептах — удалять нечего', true);
    return;
  }
  const skipped = custom.length - removable.length;
  Modal.confirm(`Удалить свои продукты (${removable.length})?${skipped ? ` Ещё ${skipped} останутся — используются в рецептах.` : ''}`, () => {
    const ids = new Set(removable.map(p => p.id));
    App.state.products = App.state.products.filter(p => !ids.has(p.id));
    App.save();
    App.refresh();
    Toast.show('Свои продукты удалены');
  }, 'Удалить');
};

Views.deleteProduct = function (id) {
  const p = Calc.product(id);
  const usedIn = App.state.recipes.filter(r => r.ing.some(i => i.p === id));
  if (usedIn.length) {
    Toast.show(`Нельзя удалить: используется в ${usedIn.length} ${plural(usedIn.length, 'рецепте', 'рецептах', 'рецептах')}`, true);
    return;
  }
  Modal.confirm(`Удалить «${p.name}»?`, () => {
    App.state.products = App.state.products.filter(x => x.id !== id);
    App.save();
    Toast.show('Продукт удалён');
    if (App.route.view === 'products') Views.renderProductList();
  });
};
