/* ============================================================
   Ядро приложения: состояние, навигация, расчёты, модалки.
   ============================================================ */

/* ---------- Хелперы ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function fmt(n, digits = 0) {
  if (n == null || isNaN(n)) return '—';
  // тысячи разделяем неразрывным пробелом: «1 840 ккал», как в макете
  return Number(n).toFixed(digits).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/, ' ');
}

function fmt1(n) { return fmt(n, Math.abs(n) < 10 && n !== 0 ? 1 : 0); }

function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateToStr(d);
}

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function strToDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WEEKDAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function humanDate(s) {
  if (s === todayStr()) return 'Сегодня';
  if (s === todayStr(-1)) return 'Вчера';
  if (s === todayStr(1)) return 'Завтра';
  const d = strToDate(s);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/* ---------- Тост-уведомления ---------- */

const Toast = {
  show(msg, isError = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' toast-error' : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
  },
};

/* ---------- Модальные окна ---------- */

const Modal = {
  open(html, opts = {}) {
    const wrap = $('#modal');
    $('#modal-card').innerHTML = html;
    $('#modal-card').className = 'modal-card' + (opts.wide ? ' wide' : '');
    wrap.classList.add('open');
    document.body.classList.add('no-scroll');
  },
  close() {
    $('#modal').classList.remove('open');
    document.body.classList.remove('no-scroll');
    $('#modal-card').innerHTML = '';
  },
  /* Свайп вниз закрывает шторку. Тянем только когда содержимое уже прокручено
     к верху, иначе жест конфликтует со скроллом внутри модалки. */
  swipe(card) {
    let startY = null, dy = 0, frame = 0;
    const wrap = card.parentElement;
    card.addEventListener('touchstart', (e) => {
      startY = card.scrollTop <= 0 ? e.touches[0].clientY : null;
      dy = 0;
      card.style.transition = 'none';
    }, { passive: true });
    /* Не passive: пока тянем шторку, браузеру нужно запретить прокрутку —
       иначе вместе со шторкой едет вся страница под ней.
       Сам transform пишем не на каждое событие (палец шлёт их чаще, чем экран
       перерисовывается), а один раз на кадр — иначе жест дёргается. */
    card.addEventListener('touchmove', (e) => {
      if (startY === null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      if (dy <= 0) return;
      e.preventDefault();
      wrap.classList.add('dragging');
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        card.style.transform = `translateY(${dy}px)`;
      });
    }, { passive: false });
    card.addEventListener('touchend', () => {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      card.style.transition = '';
      card.style.transform = '';
      wrap.classList.remove('dragging');
      if (dy > 90) Modal.close();
      startY = null;
    });
  },
  confirm(text, onYes, yesLabel = 'Удалить') {
    this.open(`
      <div class="confirm-box">
        <p>${esc(text)}</p>
        <div class="form-actions">
          <button class="btn btn-ghost" onclick="Modal.close()">Отмена</button>
          <button class="btn btn-danger" id="confirm-yes">${esc(yesLabel)}</button>
        </div>
      </div>`);
    $('#confirm-yes').onclick = () => { Modal.close(); onYes(); };
  },
};

/* ---------- Расчёты ---------- */

const Calc = {
  product(id) { return App.state.products.find(p => p.id === id); },
  recipe(id) { return App.state.recipes.find(r => r.id === id); },

  /* БЖУ продукта на массу */
  productMacros(prod, grams) {
    const k = grams / 100;
    return { kcal: prod.kcal * k, p: prod.p * k, f: prod.f * k, c: prod.c * k };
  },

  /* БЖУ рецепта: total и на 1 порцию.
     У «быстрых» блюд (съел что-то своё) ингредиентов нет — БЖУ задан руками
     на порцию и лежит в recipe.manual. */
  recipeMacros(recipe) {
    if (recipe.manual) {
      const s = Math.max(1, recipe.servings || 1);
      const m = recipe.manual;
      return {
        total: { kcal: m.kcal * s, p: m.p * s, f: m.f * s, c: m.c * s },
        perServing: { ...m },
      };
    }
    const total = { kcal: 0, p: 0, f: 0, c: 0 };
    for (const ing of recipe.ing) {
      const prod = this.product(ing.p);
      if (!prod) continue;
      const m = this.productMacros(prod, ing.g);
      total.kcal += m.kcal; total.p += m.p; total.f += m.f; total.c += m.c;
    }
    const s = Math.max(1, recipe.servings || 1);
    return {
      total,
      perServing: { kcal: total.kcal / s, p: total.p / s, f: total.f / s, c: total.c / s },
    };
  },

  /* БЖУ записи дневника */
  entryMacros(entry) {
    if (entry.type === 'product') {
      const prod = this.product(entry.refId);
      return prod ? this.productMacros(prod, entry.g) : { kcal: 0, p: 0, f: 0, c: 0 };
    }
    const rec = this.recipe(entry.refId);
    if (!rec) return { kcal: 0, p: 0, f: 0, c: 0 };
    const m = this.recipeMacros(rec).perServing;
    const s = entry.servings || 1;
    return { kcal: m.kcal * s, p: m.p * s, f: m.f * s, c: m.c * s };
  },

  dayTotals(dateStr) {
    const entries = App.state.diary[dateStr] || [];
    const t = { kcal: 0, p: 0, f: 0, c: 0 };
    for (const e of entries) {
      const m = this.entryMacros(e);
      t.kcal += m.kcal; t.p += m.p; t.f += m.f; t.c += m.c;
    }
    return t;
  },

  /* Норма: Миффлин — Сан-Жеор */
  norms() {
    const pr = App.state.profile;
    if (pr.manualKcal) {
      const kcal = pr.manualKcal;
      return { kcal, p: kcal * 0.3 / 4, f: kcal * 0.3 / 9, c: kcal * 0.4 / 4, source: 'manual' };
    }
    if (!pr.age || !pr.height || !pr.weight) return null;
    let bmr = 10 * pr.weight + 6.25 * pr.height - 5 * pr.age + (pr.sex === 'm' ? 5 : -161);
    let kcal = bmr * pr.activity;
    if (pr.goal === 'lose') kcal *= 0.85;
    if (pr.goal === 'gain') kcal *= 1.1;
    kcal = Math.round(kcal / 10) * 10;
    return { kcal, p: kcal * 0.3 / 4, f: kcal * 0.3 / 9, c: kcal * 0.4 / 4, source: 'calc' };
  },
};

/* ---------- Приложение ---------- */

const App = {
  state: null,
  route: { view: 'home', param: null },

  NAV: [
    { id: 'home',     name: 'Главная',  ic: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>' },
    { id: 'products', name: 'Продукты', ic: '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06z"/><path d="M10 2c1 .5 2 2 2 5"/>' },
    { id: 'recipes',  name: 'Рецепты',  ic: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>' },
    { id: 'diary',    name: 'Дневник',  ic: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>' },
    { id: 'planner',  name: 'Планер',   ic: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>' },
    { id: 'shopping', name: 'Покупки',  ic: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>', moreOnly: true },
    { id: 'articles', name: 'Статьи',   ic: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5a6 6 0 0 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>', moreOnly: true },
    { id: 'profile',  name: 'Профиль',  ic: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', moreOnly: true },
  ],

  icon(paths, size = 16) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  },

  /* мобильная нижняя навигация: 4 раздела + «Ещё» */
  MOBILE_NAV: ['home', 'products', 'recipes', 'diary'],

  views: {},

  async boot() {
    this.state = Store.load();
    this.renderNav();
    this.go('home');
    if (!this.state.seenWelcome) this.showWelcome();

    // фото подгружаем в фоне, чтобы не задерживать старт
    Photos.loadAll().then(() => {
      const hasPhotos = Object.keys(Photos.cache).length > 0;
      const modalOpen = $('#modal').classList.contains('open');
      if (hasPhotos && !modalOpen) this.refresh();
    });

    $('#modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') Modal.close();
    });
    Modal.swipe($('#modal-card'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Modal.close();
    });
  },

  save() { Store.save(this.state); },

  go(view, param = null) {
    this.route = { view, param };
    const fn = this.views[view];
    if (!fn) return;
    $('#view').innerHTML = '';
    fn(param);
    this.highlightNav(view);
    window.scrollTo({ top: 0 });
  },

  /* перерисовка на месте: экран не должен прыгать вверх после отметки или удаления */
  refresh() {
    const y = window.scrollY;
    this.go(this.route.view, this.route.param);
    window.scrollTo({ top: y });
  },

  renderNav() {
    // десктопный сайдбар — все разделы
    $('#sidebar-nav').innerHTML = this.NAV.map(n => `
      <button class="nav-item" data-view="${n.id}" onclick="App.go('${n.id}')">
        <span class="nav-ic">${this.icon(n.ic)}</span><span>${n.name}</span>
      </button>`).join('');

    // мобильная нижняя панель
    const items = this.NAV.filter(n => this.MOBILE_NAV.includes(n.id));
    $('#bottom-nav').innerHTML = items.map(n => `
      <button class="bnav-item" data-view="${n.id}" onclick="App.go('${n.id}')">
        <span class="bnav-ic">${this.icon(n.ic, 20)}</span><span class="bnav-label">${n.name}</span>
      </button>`).join('') + `
      <button class="bnav-item" data-view="more" onclick="App.go('more')">
        <span class="bnav-ic">${this.icon('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>', 20)}</span><span class="bnav-label">Ещё</span>
      </button>`;

    // совет дня в сайдбаре — стабильный для текущей даты
    const tipEl = $('#side-tip-text');
    if (tipEl && typeof SEED_TIPS !== 'undefined') {
      const d = new Date();
      tipEl.textContent = SEED_TIPS[(d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate()) % SEED_TIPS.length];
    }
  },

  highlightNav(view) {
    const moreViews = ['more', 'planner', 'shopping', 'articles', 'profile'];
    $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    $$('.bnav-item').forEach(el => {
      const v = el.dataset.view;
      el.classList.toggle('active', v === view || (v === 'more' && moreViews.includes(view)));
    });
  },

  showWelcome() {
    Modal.open(`
      <div class="welcome">
        <div class="welcome-emoji">🥗</div>
        <h2>Добро пожаловать в «Мой рацион»!</h2>
        <p>Это ваш личный помощник по здоровому питанию: справочник продуктов с БЖУ,
        любимые рецепты, дневник калорий, план на неделю и многое другое.</p>
        <p>Всё уже готово к работе — внутри ${SEED_PRODUCTS.length} полезных продуктов и ${SEED_RECIPES.length} проверенных рецептов.
        А чтобы приложение считало вашу личную норму калорий, загляните в профиль.</p>
        <div class="form-actions">
          <button class="btn btn-ghost" onclick="App.state.seenWelcome=true;App.save();Modal.close()">Просто посмотреть</button>
          <button class="btn btn-primary" onclick="App.state.seenWelcome=true;App.save();Modal.close();App.go('profile')">Заполнить профиль</button>
        </div>
      </div>`);
  },
};

/* Подсказка: бейджи макроэлементов */
function macroBadges(m, digits = 0) {
  return `
    <span class="badge badge-kcal">${fmt(m.kcal, digits)} ккал</span>
    <span class="badge badge-p">Б ${fmt1(m.p)}</span>
    <span class="badge badge-f">Ж ${fmt1(m.f)}</span>
    <span class="badge badge-c">У ${fmt1(m.c)}</span>`;
}

window.addEventListener('DOMContentLoaded', () => App.boot());
