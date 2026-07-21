/* ============================================================
   Экраны: Статьи, Профиль (калькулятор нормы), меню «Ещё»
   ============================================================ */

/* ---------- Статьи ---------- */

App.views.articles = function (openId = null) {
  if (openId) {
    const a = SEED_ARTICLES.find(x => x.id === openId);
    if (a) {
      $('#view').innerHTML = `
        <button class="btn btn-ghost back-btn" onclick="App.go('articles')">‹ Все статьи</button>
        <article class="card article-full">
          <div class="article-emoji">${a.emoji}</div>
          <h1>${esc(a.title)}</h1>
          <p class="article-lead">${esc(a.lead)}</p>
          ${a.body.map(p => `<p>${esc(p)}</p>`).join('')}
        </article>`;
      return;
    }
  }
  $('#view').innerHTML = `
    <header class="page-head">
      <div><h1>Статьи</h1><p class="subtitle">Коротко и по делу — о том, как питаться лучше</p></div>
    </header>
    <div class="article-grid">
      ${SEED_ARTICLES.map(a => `
        <article class="card article-card" onclick="App.go('articles','${a.id}')">
          <div class="article-emoji">${a.emoji}</div>
          <h4>${esc(a.title)}</h4>
          <p class="hint">${esc(a.lead)}</p>
        </article>`).join('')}
    </div>`;
};

/* ---------- Меню «Ещё» (мобильное) ---------- */

App.views.more = function () {
  const items = [
    ['planner', '📅', 'Планер недели', 'Меню по дням и приёмам пищи'],
    ['shopping', '🛒', 'Список покупок', 'Собирается из плана автоматически'],
    ['articles', '💡', 'Статьи о питании', 'Белки, жиры, вода и другие основы'],
    ['profile', '⚙️', 'Профиль и настройки', 'Норма калорий, вода, резервная копия'],
  ];
  $('#view').innerHTML = `
    <header class="page-head"><div><h1>Ещё</h1></div></header>
    <div class="more-list">
      ${items.map(([v, e, t, s]) => `
        <button class="card more-item" onclick="App.go('${v}')">
          <span class="more-emoji">${e}</span>
          <span class="more-text"><b>${t}</b><small>${s}</small></span>
          <span class="more-arrow">›</span>
        </button>`).join('')}
      <a class="card more-item" href="help.html" style="text-decoration:none;color:inherit">
        <span class="more-emoji">📘</span>
        <span class="more-text"><b>Как пользоваться</b><small>Краткая инструкция к приложению</small></span>
        <span class="more-arrow">›</span>
      </a>
    </div>`;
};

/* ---------- Профиль ---------- */

const ACTIVITIES = [
  [1.2,   'Минимальная — сидячая работа, мало движения'],
  [1.375, 'Лёгкая — прогулки, 1–2 тренировки в неделю'],
  [1.55,  'Средняя — 3–5 тренировок в неделю'],
  [1.725, 'Высокая — спорт почти каждый день'],
];

const GOALS = [
  ['lose', '🍃 Снижение веса', '−15% к норме'],
  ['maintain', '⚖️ Поддержание', 'норма без изменений'],
  ['gain', '🌱 Набор массы', '+10% к норме'],
];

App.views.profile = function () {
  const pr = App.state.profile;
  const norms = Calc.norms();

  $('#view').innerHTML = `
    <header class="page-head">
      <div><h1>Профиль</h1><p class="subtitle">Личная норма, вода и резервная копия</p></div>
    </header>

    <section class="card">
      <h3>О себе</h3>
      <form id="profile-form" class="form">
        <div class="form-row">
          <label>Имя<input class="input" name="name" value="${esc(pr.name)}" placeholder="Как к вам обращаться?"></label>
          <label>Пол<select class="input" name="sex">
            <option value="f" ${pr.sex === 'f' ? 'selected' : ''}>Женский</option>
            <option value="m" ${pr.sex === 'm' ? 'selected' : ''}>Мужской</option>
          </select></label>
        </div>
        <div class="form-row form-row-3">
          <label>Возраст<input class="input" name="age" type="number" min="10" max="100" value="${pr.age ?? ''}"></label>
          <label>Рост, см<input class="input" name="height" type="number" min="100" max="230" value="${pr.height ?? ''}"></label>
          <label>Вес, кг<input class="input" name="weight" type="number" min="30" max="250" step="0.1" value="${pr.weight ?? ''}"></label>
        </div>
        <label>Активность<select class="input" name="activity">
          ${ACTIVITIES.map(([v, l]) => `<option value="${v}" ${Math.abs(pr.activity - v) < 0.01 ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
        <label>Цель
          <div class="meal-pick" id="goal-pick">
            ${GOALS.map(([v, l, s]) => `<button type="button" class="chip ${pr.goal === v ? 'active' : ''}" data-goal="${v}" title="${s}">${l}</button>`).join('')}
          </div>
        </label>
        <label>Своя норма, ккал <small>(необязательно — вместо расчёта)</small>
          <input class="input" name="manualKcal" type="number" min="800" max="6000" value="${pr.manualKcal ?? ''}" placeholder="авторасчёт"></label>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </div>
      </form>
    </section>

    <section class="card norm-card">
      <h3>Ваша норма на день</h3>
      ${norms ? `
        <div class="macro-cards">
          <div class="mc mc-kcal"><b>${fmt(norms.kcal)}</b><span>ккал</span></div>
          <div class="mc mc-p"><b>${fmt(norms.p)} г</b><span>белки</span></div>
          <div class="mc mc-f"><b>${fmt(norms.f)} г</b><span>жиры</span></div>
          <div class="mc mc-c"><b>${fmt(norms.c)} г</b><span>углеводы</span></div>
        </div>
        <p class="hint">${norms.source === 'manual'
          ? 'Используется ваша ручная норма. БЖУ: 30% белки / 30% жиры / 40% углеводы.'
          : 'Расчёт по формуле Миффлина — Сан-Жеора с учётом активности и цели. БЖУ: 30/30/40.'}</p>`
        : `<p class="hint">Заполните возраст, рост и вес — и приложение посчитает вашу личную норму калорий и БЖУ.</p>`}
    </section>

    <section class="card">
      <h3>Резервная копия 💾</h3>
      <p class="hint">Все данные хранятся в этом браузере. Время от времени сохраняйте копию в файл —
      её можно будет восстановить на любом устройстве (вместе с фото рецептов).</p>
      <div class="form-actions left">
        <button class="btn btn-primary" onclick="Backup.export(App.state);Toast.show('Файл с копией сохранён 💾')">⬇️ Скачать копию</button>
        <button class="btn btn-ghost" onclick="document.getElementById('import-file').click()">⬆️ Восстановить из файла</button>
        <input type="file" id="import-file" accept=".json,application/json" hidden>
      </div>
    </section>

    <section class="card danger-zone">
      <h3>Сброс</h3>
      <p class="hint">Вернуть приложение к начальному состоянию. Все ваши рецепты, записи и фото будут удалены.</p>
      <button class="btn btn-danger-ghost" onclick="Views.resetAll()">Сбросить всё</button>
    </section>

    <p class="hint"><a href="help.html">📘 Как пользоваться приложением</a></p>`;

  $('#goal-pick').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    $$('#goal-pick .chip').forEach(c => c.classList.toggle('active', c === btn));
  });

  $('#profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const pr = App.state.profile;
    pr.name = f.get('name').trim();
    pr.sex = f.get('sex');
    pr.age = parseInt(f.get('age')) || null;
    pr.height = parseFloat(f.get('height')) || null;
    pr.weight = parseFloat(f.get('weight')) || null;
    pr.activity = parseFloat(f.get('activity'));
    pr.goal = $('#goal-pick .chip.active')?.dataset.goal || 'maintain';
    pr.manualKcal = parseInt(f.get('manualKcal')) || null;
    App.save();
    Toast.show('Профиль сохранён ✅');
    App.refresh();
  });

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Modal.confirm('Восстановить данные из файла? Текущие данные будут заменены.', async () => {
      try {
        const state = await Backup.import(file);
        App.state = state;
        App.save();
        Toast.show('Данные восстановлены ✅');
        App.refresh();
      } catch (err) {
        Toast.show(err.message || 'Не удалось импортировать', true);
      }
    }, 'Восстановить');
  });
};

Views.resetAll = function () {
  Modal.confirm('Точно сбросить всё? Это удалит все ваши рецепты, записи дневника и фото. Действие необратимо.', async () => {
    localStorage.removeItem(Store.KEY);
    for (const id of Object.keys(Photos.cache)) await Photos.del(id);
    App.state = Store.defaultState();
    App.save();
    Toast.show('Приложение сброшено');
    App.go('home');
  }, 'Сбросить');
};
