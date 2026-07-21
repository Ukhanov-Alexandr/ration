/* ============================================================
   Хранилище: состояние в localStorage, фото в IndexedDB,
   экспорт/импорт всех данных одним файлом.
   ============================================================ */

const Store = {
  KEY: 'greenplate_v1',

  defaultState() {
    return {
      version: 1,
      products: SEED_PRODUCTS.map(p => ({ ...p })),
      recipes: SEED_RECIPES.map(r => ({ ...r, ing: r.ing.map(i => ({ ...i })), steps: [...r.steps], custom: false })),
      diary: {},     // { '2026-06-10': [{id, meal, type:'product'|'recipe', refId, g|servings, time:'HH:MM'|null}] }
      plan: {},      // { '2026-06-10': { breakfast:[recipeId], lunch:[], dinner:[], snack:[] } }
      water: {},     // { '2026-06-10': 5 }
      shopping: [],  // [{id, name, qty, checked}]
      profile: {
        name: '', sex: 'f', age: null, height: null, weight: null,
        activity: 1.375, goal: 'maintain',
        manualKcal: null, waterGoal: 8, // стаканов по 250 мл
      },
      seenWelcome: false,
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaultState();
      const st = JSON.parse(raw);
      // мягкая миграция: дозаполняем недостающие поля
      const def = this.defaultState();
      for (const k of Object.keys(def)) if (st[k] === undefined) st[k] = def[k];
      for (const k of Object.keys(def.profile)) if (st.profile[k] === undefined) st.profile[k] = def.profile[k];
      // новые seed-продукты и цены долетают до существующих пользователей
      // (продукты из стартовой базы удалить нельзя, поэтому добавление безопасно)
      for (const seed of SEED_PRODUCTS) {
        const mine = st.products.find(p => p.id === seed.id);
        if (!mine) st.products.push({ ...seed });
        else if (mine.price == null && seed.price != null) mine.price = seed.price;
      }
      // новые seed-рецепты добавляем один раз (mergedSeedRecipes),
      // чтобы удалённый пользователем рецепт не воскресал при каждой загрузке.
      // Первые 18 — изначальная база (до 2026-07); новые дописывать строго в конец SEED_RECIPES
      st.mergedSeedRecipes = st.mergedSeedRecipes || SEED_RECIPES.slice(0, 18).map(r => r.id);
      for (const seed of SEED_RECIPES) {
        if (st.mergedSeedRecipes.includes(seed.id)) continue;
        st.mergedSeedRecipes.push(seed.id);
        if (!st.recipes.some(r => r.id === seed.id))
          st.recipes.push({ ...seed, ing: seed.ing.map(i => ({ ...i })), steps: [...seed.steps], custom: false });
      }
      return st;
    } catch (e) {
      console.error('Не удалось прочитать данные', e);
      return this.defaultState();
    }
  },

  save(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Не удалось сохранить', e);
      Toast?.show?.('Не удалось сохранить данные 😟', true);
    }
  },
};

/* ---------- Фото рецептов (IndexedDB) ---------- */

const Photos = {
  DB: 'greenplate_photos', STORE: 'photos', db: null, cache: {},

  open() {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open(this.DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(this.STORE);
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => { console.warn('IndexedDB недоступна, фото работать не будут'); resolve(null); };
    });
  },

  async loadAll() {
    await this.open();
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx = this.db.transaction(this.STORE, 'readonly').objectStore(this.STORE);
      const keysReq = tx.getAllKeys();
      const valsReq = tx.getAll();
      let keys, vals;
      keysReq.onsuccess = () => { keys = keysReq.result; done(); };
      valsReq.onsuccess = () => { vals = valsReq.result; done(); };
      const done = () => {
        if (keys && vals) {
          keys.forEach((k, i) => { this.cache[k] = vals[i]; });
          resolve();
        }
      };
      keysReq.onerror = valsReq.onerror = () => resolve();
    });
  },

  async put(id, dataUrl) {
    this.cache[id] = dataUrl;
    if (!this.db) await this.open();
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx = this.db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put(dataUrl, id);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  },

  async del(id) {
    delete this.cache[id];
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx = this.db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  },

  get(id) { return this.cache[id] || null; },

  /* Сжимаем загруженное фото до 900px по большей стороне → JPEG */
  compress(file, maxSide = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width: w, height: h } = img;
          if (Math.max(w, h) > maxSide) {
            const k = maxSide / Math.max(w, h);
            w = Math.round(w * k); h = Math.round(h * k);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};

/* ---------- Экспорт / импорт ---------- */

const Backup = {
  export(state) {
    const payload = {
      app: 'greenplate', exportedAt: new Date().toISOString(),
      state, photos: Photos.cache,
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    a.download = `зелёная-тарелка-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  import(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const payload = JSON.parse(reader.result);
          if (payload.app !== 'greenplate' || !payload.state) throw new Error('Это не файл резервной копии «Зелёной тарелки»');
          if (payload.photos) {
            for (const [id, dataUrl] of Object.entries(payload.photos)) await Photos.put(id, dataUrl);
          }
          resolve(payload.state);
        } catch (e) { reject(e); }
      };
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
      reader.readAsText(file);
    });
  },
};
