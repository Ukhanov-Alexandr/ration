/* ============================================================
   Экраны: Рецепты, рандомайзер, редактор рецептов с фото
   ============================================================ */

const RecipesUI = { search: '', cat: 'all', favOnly: false };

/* тинт обложки по категории рецепта */
const REC_CAT_CLASS = { 'Завтрак': 'cat-breakfast', 'Обед': 'cat-lunch', 'Ужин': 'cat-dinner', 'Перекус': 'cat-snack', 'Десерт': 'cat-dessert' };
const recCatClass = (cat) => REC_CAT_CLASS[cat] || 'cat-lunch';

/* Плоское сердечко «избранное» — один и тот же элемент на карточке и в фильтре.
   Залито оно или нет, решает CSS по классу .on / .active — состояние не в разметке. */
const favIcon = () => `<svg class="ic-heart" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>`;

App.views.recipes = function () {
  $('#view').innerHTML = `
    <header class="page-head">
      <div><h1>Рецепты</h1><p class="subtitle">Проверенные, любимые, полезные</p></div>
      <div class="head-actions">
        <button class="btn btn-accent" onclick="Views.randomRecipe()">🎲 Случайный</button>
        <button class="btn btn-primary" onclick="Views.editRecipe()">+ Новый</button>
      </div>
    </header>

    <div class="filters">
      <input type="search" id="rec-search" class="input search-input" placeholder="Найти рецепт…" value="${esc(RecipesUI.search)}">
    </div>

    <div class="chips" id="rec-chips">
      <button class="chip ${RecipesUI.cat === 'all' && !RecipesUI.favOnly ? 'active' : ''}" data-cat="all">Все</button>
      <button class="chip chip-fav ${RecipesUI.favOnly ? 'active' : ''}" data-cat="fav">${favIcon()} Любимые</button>
      ${RECIPE_CATS.map(c => `<button class="chip ${RecipesUI.cat === c && !RecipesUI.favOnly ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('')}
    </div>

    <div id="rec-list" class="recipe-grid"></div>`;

  $('#rec-search').addEventListener('input', (e) => { RecipesUI.search = e.target.value; Views.renderRecipeList(); });
  $('#rec-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    if (btn.dataset.cat === 'fav') { RecipesUI.favOnly = !RecipesUI.favOnly; }
    else { RecipesUI.cat = btn.dataset.cat; RecipesUI.favOnly = false; }
    $$('#rec-chips .chip').forEach(c => {
      const cat = c.dataset.cat;
      c.classList.toggle('active', cat === 'fav' ? RecipesUI.favOnly : (!RecipesUI.favOnly && cat === RecipesUI.cat));
    });
    Views.renderRecipeList();
  });
  Views.renderRecipeList();
};

Views.filteredRecipes = function () {
  let list = [...App.state.recipes];
  if (RecipesUI.favOnly) list = list.filter(r => r.fav);
  else if (RecipesUI.cat !== 'all') list = list.filter(r => r.cat === RecipesUI.cat);
  if (RecipesUI.search) {
    const q = RecipesUI.search.toLowerCase();
    list = list.filter(r => r.name.toLowerCase().includes(q) ||
      r.ing.some(i => Calc.product(i.p)?.name.toLowerCase().includes(q)));
  }
  return list;
};

Views.recipeCard = function (r) {
  const m = Calc.recipeMacros(r).perServing;
  const photo = Photos.get(r.id);
  return `
    <article class="recipe-card" onclick="Views.openRecipe('${r.id}')">
      <div class="recipe-cover ${photo ? '' : 'no-photo ' + recCatClass(r.cat)}" ${photo ? `style="background-image:url('${photo}')"` : ''}>
        ${photo ? '' : `<span class="cover-emoji">${r.emoji}</span>`}
        <button class="fav-btn ${r.fav ? 'on' : ''}" onclick="event.stopPropagation();Views.toggleFav('${r.id}')" title="Любимый">${favIcon()}</button>
      </div>
      <div class="recipe-body">
        <h4>${esc(r.name)}</h4>
        <p class="recipe-meta">${esc(r.cat)} · ⏱ ${r.time} мин · ${r.servings} ${plural(r.servings, 'порция', 'порции', 'порций')}</p>
        <div class="badges">${macroBadges(m)}</div>
      </div>
    </article>`;
};

Views.renderRecipeList = function () {
  const list = Views.filteredRecipes();
  $('#rec-list').innerHTML = list.length
    ? list.map(r => Views.recipeCard(r)).join('')
    : `<div class="empty">Рецептов не нашлось 🤔<br><small>Попробуйте другой фильтр или добавьте свой рецепт</small></div>`;
};

Views.toggleFav = function (id) {
  const r = Calc.recipe(id);
  r.fav = !r.fav;
  App.save();
  if (App.route.view === 'recipes') Views.renderRecipeList();
};

/* ---------- Карточка рецепта ---------- */

Views.openRecipe = function (id) {
  const r = Calc.recipe(id);
  if (!r) return;
  const { total, perServing } = Calc.recipeMacros(r);
  const photo = Photos.get(r.id);
  Modal.open(`
    <div class="recipe-detail">
      <div class="recipe-detail-cover ${photo ? '' : 'no-photo ' + recCatClass(r.cat)}" ${photo ? `style="background-image:url('${photo}')"` : ''}>
        ${photo ? '' : `<span class="cover-emoji-big">${r.emoji}</span>`}
        <button class="fav-btn on-cover ${r.fav ? 'on' : ''}" onclick="Views.toggleFav('${r.id}');this.classList.toggle('on',Calc.recipe('${r.id}').fav)">${favIcon()}</button>
      </div>
      <div class="recipe-detail-body">
        <h2>${esc(r.name)}</h2>
        <p class="recipe-meta">${esc(r.cat)} · ⏱ ${r.time} мин · ${r.servings} ${plural(r.servings, 'порция', 'порции', 'порций')}</p>
        ${r.desc ? `<p class="recipe-desc">${esc(r.desc)}</p>` : ''}

        <div class="macro-cards">
          <div class="mc mc-kcal"><b>${fmt(perServing.kcal)}</b><span>ккал / порция</span></div>
          <div class="mc mc-p"><b>${fmt1(perServing.p)}</b><span>белки</span></div>
          <div class="mc mc-f"><b>${fmt1(perServing.f)}</b><span>жиры</span></div>
          <div class="mc mc-c"><b>${fmt1(perServing.c)}</b><span>углеводы</span></div>
        </div>

        <h3>Ингредиенты</h3>
        <ul class="ing-list">
          ${r.ing.map(i => {
            const p = Calc.product(i.p);
            return p ? `<li><span>${p.emoji} ${esc(p.name)}</span><b>${fmt(i.g)} г</b></li>` : '';
          }).join('')}
        </ul>
        <p class="hint">Всего на рецепт: ${fmt(total.kcal)} ккал</p>

        <h3>Приготовление</h3>
        <ol class="steps-list">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>

        <div class="form-actions">
          <button class="btn btn-danger-ghost" onclick="Views.deleteRecipe('${r.id}')">Удалить</button>
          <button class="btn btn-ghost" onclick="Views.editRecipe('${r.id}')">✏️ Изменить</button>
          <button class="btn btn-ghost" onclick="Views.addRecipeToShopping('${r.id}')">🛒 В покупки</button>
          <button class="btn btn-primary" onclick="Views.addToDiaryDialog('recipe','${r.id}')">+ В дневник</button>
        </div>
      </div>
    </div>`, { wide: true });
};

Views.deleteRecipe = function (id) {
  const r = Calc.recipe(id);
  Modal.confirm(`Удалить рецепт «${r.name}»?`, async () => {
    App.state.recipes = App.state.recipes.filter(x => x.id !== id);
    // подчистим план
    for (const day of Object.values(App.state.plan)) {
      for (const meal of Object.keys(day)) day[meal] = day[meal].filter(rid => rid !== id);
    }
    await Photos.del(id);
    App.save();
    Toast.show('Рецепт удалён');
    App.refresh();
  });
};

/* ---------- Рандомайзер ---------- */

Views.randomRecipe = function (cat = null) {
  let pool = App.state.recipes;
  if (cat) pool = pool.filter(r => r.cat === cat);
  if (!pool.length) { Toast.show('Нет рецептов для выбора', true); return; }

  Modal.open(`
    <div class="random-box">
      <h2>Что приготовить? 🤔</h2>
      <div class="random-filter">
        <button class="chip ${!cat ? 'active' : ''}" onclick="Views.randomRecipe()">Что угодно</button>
        ${RECIPE_CATS.map(c => `<button class="chip ${cat === c ? 'active' : ''}" onclick="Views.randomRecipe('${c}')">${c}</button>`).join('')}
      </div>
      <div class="random-spinner" id="rnd-spin">🥗</div>
      <div id="rnd-result"></div>
    </div>`);

  // анимация: крутим эмодзи, потом показываем результат
  const emojis = pool.map(r => r.emoji);
  const spin = $('#rnd-spin');
  let ticks = 0;
  const iv = setInterval(() => {
    spin.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    ticks++;
    if (ticks > 12) {
      clearInterval(iv);
      const r = pool[Math.floor(Math.random() * pool.length)];
      spin.textContent = r.emoji;
      spin.classList.add('landed');
      const m = Calc.recipeMacros(r).perServing;
      $('#rnd-result').innerHTML = `
        <h3 class="rnd-name">${esc(r.name)}</h3>
        <p class="recipe-meta">${esc(r.cat)} · ⏱ ${r.time} мин</p>
        <div class="badges center">${macroBadges(m)}</div>
        <div class="form-actions center">
          <button class="btn btn-ghost" onclick="Views.randomRecipe(${cat ? `'${cat}'` : 'null'})">🎲 Другой!</button>
          <button class="btn btn-primary" onclick="Views.openRecipe('${r.id}')">Готовим! →</button>
        </div>`;
    }
  }, 90);
};

/* ---------- Редактор рецепта ---------- */

const RecipeForm = { ing: [], photoData: undefined };

Views.editRecipe = function (id) {
  const r = id ? Calc.recipe(id) : null;
  RecipeForm.ing = r ? r.ing.map(i => ({ ...i })) : [{ p: '', g: 100 }];
  RecipeForm.photoData = undefined; // undefined = не менять, null = удалить
  const photo = r ? Photos.get(r.id) : null;

  Modal.open(`
    <h2>${r ? 'Изменить рецепт' : 'Новый рецепт'}</h2>
    <form id="rec-form" class="form">
      <label>Название<input class="input" name="name" required value="${esc(r?.name || '')}" placeholder="Например: Бабушкин борщ на курином бульоне"></label>
      <div class="form-row">
        <label>Категория<select class="input" name="cat">
          ${RECIPE_CATS.map(c => `<option ${r?.cat === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select></label>
        <label>Эмодзи<input class="input" name="emoji" value="${esc(r?.emoji || '🍲')}" maxlength="4"></label>
      </div>
      <div class="form-row">
        <label>Время, мин<input class="input" name="time" type="number" min="1" value="${r?.time || 30}"></label>
        <label>Порций<input class="input" name="servings" type="number" min="1" value="${r?.servings || 2}"></label>
      </div>
      <label>Краткое описание<input class="input" name="desc" value="${esc(r?.desc || '')}" placeholder="Чем хорош этот рецепт?"></label>

      <label>Фото блюда
        <div class="photo-row">
          <div class="photo-preview ${photo ? '' : 'empty'}" id="photo-preview" ${photo ? `style="background-image:url('${photo}')"` : ''}>${photo ? '' : '📷'}</div>
          <div class="photo-btns">
            <input type="file" id="photo-input" accept="image/*" hidden>
            <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('photo-input').click()">Выбрать фото</button>
            <button type="button" class="btn btn-ghost btn-sm" id="photo-remove" ${photo ? '' : 'style="display:none"'}>Убрать</button>
          </div>
        </div>
      </label>

      <h3>Ингредиенты</h3>
      <div id="ing-rows"></div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="RecipeFormUI.addRow()">+ Ингредиент</button>
      <p class="hint" id="ing-totals"></p>

      <label>Шаги приготовления <small>(каждый шаг с новой строки)</small>
        <textarea class="input" name="steps" rows="5" placeholder="Нарежьте овощи…&#10;Обжарьте на масле…">${r ? esc(r.steps.join('\n')) : ''}</textarea>
      </label>

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="Modal.close()">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить рецепт</button>
      </div>
    </form>`, { wide: true });

  RecipeFormUI.renderRows();

  $('#photo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      RecipeForm.photoData = await Photos.compress(file);
      $('#photo-preview').style.backgroundImage = `url('${RecipeForm.photoData}')`;
      $('#photo-preview').classList.remove('empty');
      $('#photo-preview').textContent = '';
      $('#photo-remove').style.display = '';
    } catch { Toast.show('Не удалось загрузить фото', true); }
  });
  $('#photo-remove').addEventListener('click', () => {
    RecipeForm.photoData = null;
    $('#photo-preview').style.backgroundImage = '';
    $('#photo-preview').classList.add('empty');
    $('#photo-preview').textContent = '📷';
    $('#photo-remove').style.display = 'none';
  });

  $('#rec-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const ing = RecipeForm.ing.filter(i => i.p && i.g > 0);
    if (!ing.length) { Toast.show('Добавьте хотя бы один ингредиент', true); return; }
    const data = {
      name: f.get('name').trim(),
      cat: f.get('cat'),
      emoji: f.get('emoji').trim() || '🍲',
      time: parseInt(f.get('time')) || 30,
      servings: Math.max(1, parseInt(f.get('servings')) || 1),
      desc: f.get('desc').trim(),
      ing,
      steps: f.get('steps').split('\n').map(s => s.trim()).filter(Boolean),
    };
    let recId;
    if (r) {
      Object.assign(r, data);
      recId = r.id;
      Toast.show('Рецепт обновлён ✅');
    } else {
      recId = uid();
      App.state.recipes.push({ id: recId, fav: false, custom: true, ...data });
      Toast.show('Рецепт добавлен ✅');
    }
    if (RecipeForm.photoData) await Photos.put(recId, RecipeForm.photoData);
    else if (RecipeForm.photoData === null) await Photos.del(recId);
    App.save();
    Modal.close();
    App.refresh();
  });
};

const RecipeFormUI = {
  productOptions(selected) {
    const sorted = [...App.state.products].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return `<option value="">— продукт —</option>` +
      sorted.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${p.emoji} ${esc(p.name)}</option>`).join('');
  },

  renderRows() {
    $('#ing-rows').innerHTML = RecipeForm.ing.map((i, idx) => `
      <div class="ing-row">
        <select class="input" onchange="RecipeForm.ing[${idx}].p=this.value;RecipeFormUI.totals()">${this.productOptions(i.p)}</select>
        <input class="input" type="number" min="1" value="${i.g}" onchange="RecipeForm.ing[${idx}].g=parseFloat(this.value)||0;RecipeFormUI.totals()" placeholder="г">
        <button type="button" class="icon-btn" onclick="RecipeFormUI.delRow(${idx})" title="Убрать">✕</button>
      </div>`).join('');
    this.totals();
  },

  addRow() { RecipeForm.ing.push({ p: '', g: 100 }); this.renderRows(); },
  delRow(idx) { RecipeForm.ing.splice(idx, 1); this.renderRows(); },

  totals() {
    const fake = { ing: RecipeForm.ing.filter(i => i.p && i.g > 0), servings: 1 };
    const t = Calc.recipeMacros(fake).total;
    $('#ing-totals').innerHTML = t.kcal
      ? `Итого на весь рецепт: <b>${fmt(t.kcal)} ккал</b> · Б ${fmt1(t.p)} · Ж ${fmt1(t.f)} · У ${fmt1(t.c)}`
      : 'Выберите ингредиенты — БЖУ посчитается автоматически';
  },
};
