/**
 * db.js — LocalStorage Data Layer
 * Basbousa Business Management System
 *
 * Stores & retrieves all data from localStorage.
 * Each collection is serialised as a JSON array under its own key.
 */

const DB = (() => {

  /* ── Keys ── */
  const KEYS = {
    ingredients: 'bbs_ingredients',
    purchases:   'bbs_purchases',
    recipes:     'bbs_recipes',
    productions: 'bbs_productions',
    sales:       'bbs_sales',
  };

  /* ── Generic Helpers ── */
  const load  = key => JSON.parse(localStorage.getItem(key) || '[]');
  const save  = (key, data) => localStorage.setItem(key, JSON.stringify(data));
  const genId = () => '_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  const now   = () => new Date().toISOString();

  /* ══════════════════════════════════════════
     INGREDIENTS
  ══════════════════════════════════════════ */
  const Ingredients = {
    getAll() { return load(KEYS.ingredients); },

    getById(id) {
      return this.getAll().find(i => i.id === id) || null;
    },

    /** type: 'food' | 'packaging'  (default: 'food') */
    add({ name, unit, purchasePrice, stockQuantity, minStock, type }) {
      const all = this.getAll();
      const record = {
        id: genId(),
        name: name.trim(),
        unit,
        type: type || 'food',
        purchasePrice: parseFloat(purchasePrice) || 0,
        stockQuantity: parseFloat(stockQuantity) || 0,
        minStock: parseFloat(minStock) || 0,
        createdAt: now(),
        updatedAt: now(),
      };
      all.push(record);
      save(KEYS.ingredients, all);
      return record;
    },

    update(id, fields) {
      const all = this.getAll();
      const idx = all.findIndex(i => i.id === id);
      if (idx === -1) return null;
      all[idx] = { ...all[idx], ...fields, updatedAt: now() };
      save(KEYS.ingredients, all);
      return all[idx];
    },

    delete(id) {
      const all = this.getAll().filter(i => i.id !== id);
      save(KEYS.ingredients, all);
    },

    addStock(id, quantity) {
      const ing = this.getById(id);
      if (!ing) return;
      this.update(id, {
        stockQuantity: (ing.stockQuantity || 0) + parseFloat(quantity),
      });
    },

    deductStock(id, quantity) {
      const ing = this.getById(id);
      if (!ing) return;
      const newQty = Math.max(0, (ing.stockQuantity || 0) - parseFloat(quantity));
      this.update(id, { stockQuantity: newQty });
    },

    /** Return only food or only packaging ingredients */
    getByType(type) {
      return this.getAll().filter(i => (i.type || 'food') === type);
    },
  };

  /* ══════════════════════════════════════════
     PURCHASES
  ══════════════════════════════════════════ */
  const Purchases = {
    getAll() {
      return load(KEYS.purchases).sort((a, b) => b.date.localeCompare(a.date));
    },

    add({ date, ingredientId, quantity, pricePerUnit, supplier }) {
      const all = load(KEYS.purchases);
      const qty   = parseFloat(quantity);
      const price = parseFloat(pricePerUnit);
      const record = {
        id: genId(),
        date,
        ingredientId,
        quantity: qty,
        pricePerUnit: price,
        totalCost: parseFloat((qty * price).toFixed(4)),
        supplier: (supplier || '').trim(),
        createdAt: now(),
      };
      all.push(record);
      save(KEYS.purchases, all);
      // Update ingredient: new price & stock
      Ingredients.update(ingredientId, { purchasePrice: price });
      Ingredients.addStock(ingredientId, qty);
      return record;
    },

    delete(id) {
      const pur = load(KEYS.purchases).find(p => p.id === id);
      if (!pur) return;
      // Reverse stock change
      Ingredients.deductStock(pur.ingredientId, pur.quantity);
      const all = load(KEYS.purchases).filter(p => p.id !== id);
      save(KEYS.purchases, all);
    },
  };

  /* ══════════════════════════════════════════
     RECIPES
  ══════════════════════════════════════════ */
  const Recipes = {
    getAll() { return load(KEYS.recipes); },

    getById(id) {
      return this.getAll().find(r => r.id === id) || null;
    },

    /** ingredients: [{ ingredientId, quantity }] */
    add({ name, description, piecesPerTray, ingredients }) {
      const all = this.getAll();
      const record = {
        id: genId(),
        name: name.trim(),
        description: (description || '').trim(),
        piecesPerTray: parseInt(piecesPerTray),
        ingredients,
        createdAt: now(),
        updatedAt: now(),
      };
      all.push(record);
      save(KEYS.recipes, all);
      return record;
    },

    update(id, fields) {
      const all = this.getAll();
      const idx = all.findIndex(r => r.id === id);
      if (idx === -1) return null;
      all[idx] = { ...all[idx], ...fields, updatedAt: now() };
      save(KEYS.recipes, all);
      return all[idx];
    },

    delete(id) {
      save(KEYS.recipes, this.getAll().filter(r => r.id !== id));
    },

    /** Calculate cost of 1 tray based on current ingredient prices */
    calcTrayCost(recipeId) {
      const recipe = this.getById(recipeId);
      if (!recipe) return 0;
      let total = 0;
      for (const ri of recipe.ingredients) {
        const ing = Ingredients.getById(ri.ingredientId);
        if (ing) {
          total += (ing.purchasePrice || 0) * (ri.quantity || 0);
        }
      }
      return parseFloat(total.toFixed(4));
    },

    calcPieceCost(recipeId) {
      const recipe = this.getById(recipeId);
      if (!recipe || !recipe.piecesPerTray) return 0;
      return parseFloat((this.calcTrayCost(recipeId) / recipe.piecesPerTray).toFixed(4));
    },
  };

  /* ══════════════════════════════════════════
     PRODUCTIONS
  ══════════════════════════════════════════ */
  const Productions = {
    getAll() {
      return load(KEYS.productions).sort((a, b) => b.date.localeCompare(a.date));
    },

    getLatest() {
      return this.getAll()[0] || null;
    },

    /** Return the most recent production record for a specific recipe */
    getLatestByRecipe(recipeId) {
      return this.getAll().find(p => p.recipeId === recipeId) || null;
    },

    add({ date, recipeId, traysProduced, notes }) {
      const all = load(KEYS.productions);
      const recipe      = Recipes.getById(recipeId);
      const trays       = parseInt(traysProduced) || 1;
      const trayCost    = Recipes.calcTrayCost(recipeId);
      const totalCost   = parseFloat((trayCost * trays).toFixed(4));
      const piecesTotal = (recipe ? recipe.piecesPerTray : 0) * trays;
      const costPerPiece = piecesTotal > 0 ? parseFloat((totalCost / piecesTotal).toFixed(4)) : 0;

      // خصم المكونات من المخزون تلقائياً عند تسجيل الإنتاج
      if (recipe && recipe.ingredients) {
        recipe.ingredients.forEach(ri => {
          const used = parseFloat(ri.quantity) * trays;
          Ingredients.deductStock(ri.ingredientId, used);
        });
      }

      const record = {
        id: genId(),
        date,
        recipeId,
        recipeName: recipe ? recipe.name : '—',
        traysProduced: trays,
        piecesProduced: piecesTotal,
        trayCost,
        totalCost,
        costPerPiece,
        notes: (notes || '').trim(),
        createdAt: now(),
      };
      all.push(record);
      save(KEYS.productions, all);
      return record;
    },

    delete(id) {
      // إعادة كميات المكونات عند حذف الإنتاج
      const prod = this.getAll().find(p => p.id === id);
      if (prod) {
        const recipe = Recipes.getById(prod.recipeId);
        if (recipe && recipe.ingredients) {
          recipe.ingredients.forEach(ri => {
            const used = parseFloat(ri.quantity) * prod.traysProduced;
            Ingredients.addStock(ri.ingredientId, used);
          });
        }
      }
      save(KEYS.productions, load(KEYS.productions).filter(p => p.id !== id));
    },
  };

  /* ══════════════════════════════════════════
     SALES
  ══════════════════════════════════════════ */
  const Sales = {
    getAll() {
      return load(KEYS.sales).sort((a, b) => b.date.localeCompare(a.date));
    },

    /** type: 'piece' | 'tray' */
    add({ date, productType, quantity, sellingPricePerUnit, costPerUnit, recipeId, recipeName, invoiceNo, customerName }) {
      const all = load(KEYS.sales);
      const qty       = parseInt(quantity);
      const sellPrice = parseFloat(sellingPricePerUnit);
      const cost      = parseFloat(costPerUnit) || 0;
      const revenue   = parseFloat((qty * sellPrice).toFixed(4));
      const totalCost = parseFloat((qty * cost).toFixed(4));
      const profit    = parseFloat((revenue - totalCost).toFixed(4));
      const rName     = recipeName || '';

      const record = {
        id: genId(),
        date,
        productType,
        recipeId:   recipeId || '',
        recipeName: rName,
        productName: productType === 'tray'
          ? `صينية - ${rName || 'غير محدد'}`
          : `قطعة - ${rName || 'غير محدد'}`,
        quantity: qty,
        sellingPricePerUnit: sellPrice,
        costPerUnit: cost,
        totalRevenue: revenue,
        totalCost,
        profit,
        invoiceNo:    (invoiceNo    || '').trim(),
        customerName: (customerName || '').trim(),
        createdAt: now(),
      };
      all.push(record);
      save(KEYS.sales, all);
      return record;
    },

    delete(id) {
      save(KEYS.sales, load(KEYS.sales).filter(s => s.id !== id));
    },

    /** Aggregate sales for a date range [fromStr, toStr] (YYYY-MM-DD inclusive) */
    aggregate(fromStr, toStr) {
      const filtered = this.getAll().filter(s => s.date >= fromStr && s.date <= toStr);
      const revenue  = filtered.reduce((sum, s) => sum + s.totalRevenue, 0);
      const cost     = filtered.reduce((sum, s) => sum + s.totalCost,    0);
      const profit   = filtered.reduce((sum, s) => sum + s.profit,       0);
      const units    = filtered.reduce((sum, s) => sum + s.quantity,     0);
      return { filtered, revenue, cost, profit, units };
    },
  };

  /* ══════════════════════════════════════════
     UTILITY  — Date Helpers
  ══════════════════════════════════════════ */
  const DateUtil = {
    today()  { return new Date().toISOString().slice(0, 10); },

    startOfWeek() {
      const d = new Date();
      const day = d.getDay(); // 0=Sun
      d.setDate(d.getDate() - day);
      return d.toISOString().slice(0, 10);
    },

    startOfMonth() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    },

    endOfMonth() {
      const d = new Date();
      const last = new Date(d.getFullYear(), d.getMonth()+1, 0);
      return last.toISOString().slice(0, 10);
    },

    formatAr(dateStr) {
      if (!dateStr) return '';
      const [y, m, day] = dateStr.split('-');
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                      'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
    },

    monthNameAr(dateStr) {
      if (!dateStr) return '';
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                      'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      const m = parseInt(dateStr.split('-')[1]) - 1;
      const y = dateStr.split('-')[0];
      return `${months[m]} ${y}`;
    },
  };

  /* ══════════════════════════════════════════
     FORMAT HELPERS
  ══════════════════════════════════════════ */
  const Fmt = {
    /** Format number as currency (2 decimal places) with unit */
    aed(n) {
      if (n === null || n === undefined || isNaN(n)) return '—';
      return parseFloat(n).toLocaleString('ar-AE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' د.إ';
    },

    num(n, decimals = 2) {
      if (n === null || n === undefined || isNaN(n)) return '—';
      return parseFloat(n).toLocaleString('ar-AE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },

    qty(n) {
      return parseFloat(n).toLocaleString('ar-AE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      });
    },
  };

  /* ── Public API ── */
  return {
    Ingredients,
    Purchases,
    Recipes,
    Productions,
    Sales,
    DateUtil,
    Fmt,
    genId,
  };
})();
