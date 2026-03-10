/**
 * app.js — UI & Application Logic
 * Basbousa Business Management System
 *
 * Depends on: db.js (must be loaded first)
 */

/* ═══════════════════════════════════════════════
   UI UTILITIES
═══════════════════════════════════════════════ */
const UI = (() => {

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  }

  function closeModalOnOverlay(e, id) {
    if (e.target === e.currentTarget) closeModal(id);
  }

  let toastTimer = null;
  function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function confirm(message, onOk) {
    document.getElementById('confirm-message').textContent = message;
    const btn = document.getElementById('confirm-ok-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      closeModal('modal-confirm');
      onOk();
    });
    openModal('modal-confirm');
  }

  function val(id)    { return document.getElementById(id)?.value.trim() || ''; }
  function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }

  function populateIngredientSelect(selectId, withBlank = true) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const ings = DB.Ingredients.getAll();
    sel.innerHTML = withBlank ? '<option value="">اختر المكوّن أو مادة التغليف</option>' : '';
    // Group by type
    const food       = ings.filter(i => (i.type || 'food') === 'food');
    const packaging  = ings.filter(i => (i.type || 'food') === 'packaging');
    const addGroup = (label, items) => {
      if (!items.length) return;
      const grp = document.createElement('optgroup');
      grp.label = label;
      items.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.id;
        opt.textContent = `${i.name} (${i.unit})`;
        grp.appendChild(opt);
      });
      sel.appendChild(grp);
    };
    addGroup('🍞 مكونات غذائية', food);
    addGroup('📦 تغليف وملصقات', packaging);
  }

  function populateRecipeSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const recs = DB.Recipes.getAll();
    sel.innerHTML = '<option value="">اختر الوصفة</option>';
    recs.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
  }

  return { openModal, closeModal, closeModalOnOverlay, toast, confirm, val, setVal,
           populateIngredientSelect, populateRecipeSelect };
})();

/* ═══════════════════════════════════════════════
   TAB NAVIGATION
═══════════════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById(`tab-${tab}`).classList.add('active');
    // Trigger tab-specific rendering
    if (tab === 'ingredients')  Ingredients.render();
    if (tab === 'purchases')    Purchases.render();
    if (tab === 'recipe')       Recipes.render();
    if (tab === 'production')   Productions.render();
    if (tab === 'sales')        Sales.render();
    if (tab === 'reports')      Reports.render();
    if (tab === 'dashboard')    Dashboard.render();
  });
});

/* ═══════════════════════════════════════════════
   INGREDIENTS MODULE
═══════════════════════════════════════════════ */
const Ingredients = (() => {

  // active filter: 'all' | 'food' | 'packaging'
  let activeFilter = 'all';

  function render() {
    const tbody = document.getElementById('tbody-ingredients');
    const all   = DB.Ingredients.getAll();
    const data  = activeFilter === 'all' ? all
                : all.filter(i => (i.type || 'food') === activeFilter);

    // Update filter button states
    document.querySelectorAll('.ing-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === activeFilter);
    });

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-row">${
        all.length === 0 ? 'لا توجد مكونات مضافة بعد.' : 'لا توجد عناصر في هذا التصنيف.'
      }</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map((ing, i) => {
      const isPackaging = (ing.type || 'food') === 'packaging';
      const typeBadge   = isPackaging
        ? '<span class="badge badge-orange">📦 تغليف</span>'
        : '<span class="badge badge-green">🍞 غذائي</span>';
      const stockVal = (ing.purchasePrice * ing.stockQuantity).toFixed(2);
      const minStk   = parseFloat(ing.minStock) || 0;
      const isLow    = minStk > 0 ? ing.stockQuantity <= minStk : ing.stockQuantity === 0;
      const minLabel = minStk > 0 ? `${DB.Fmt.qty(minStk)} ${esc(ing.unit)}` : '—';
      return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(ing.name)}</strong></td>
        <td>${typeBadge}</td>
        <td><span class="badge badge-blue">${esc(ing.unit)}</span></td>
        <td>${DB.Fmt.aed(ing.purchasePrice)}</td>
        <td>
          <span class="${isLow ? 'profit-negative' : ''}">
            ${DB.Fmt.qty(ing.stockQuantity)} ${esc(ing.unit)}
          </span>
          ${isLow ? '<span title="مخزون منخفض!">⚠️</span>' : ''}
        </td>
        <td style="color:var(--gray-500);font-size:.85rem">${minLabel}</td>
        <td>${DB.Fmt.aed(stockVal)}</td>
        <td>
          <button class="btn-icon" title="تعديل" onclick="Ingredients.openEdit('${ing.id}')">✏️</button>
          <button class="btn-icon" title="حذف"   onclick="Ingredients.confirmDelete('${ing.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  function setFilter(f) { activeFilter = f; render(); }

  function openAdd() {
    document.getElementById('modal-ingredient-title').textContent = 'إضافة مكوّن';
    document.getElementById('form-ingredient').reset();
    UI.setVal('ing-id', '');
    UI.openModal('modal-ingredient');
  }

  function openEdit(id) {
    const ing = DB.Ingredients.getById(id);
    if (!ing) return;
    document.getElementById('modal-ingredient-title').textContent = 'تعديل مكوّن';
    UI.setVal('ing-id',    ing.id);
    UI.setVal('ing-name',      ing.name);
    UI.setVal('ing-type',      ing.type || 'food');
    UI.setVal('ing-unit',      ing.unit);
    UI.setVal('ing-price',     ing.purchasePrice);
    UI.setVal('ing-stock',     ing.stockQuantity);
    UI.setVal('ing-min-stock', ing.minStock || 0);
    UI.openModal('modal-ingredient');
  }

  function save(e) {
    e.preventDefault();
    const id    = UI.val('ing-id');
    const data  = {
      name:          UI.val('ing-name'),
      type:          UI.val('ing-type') || 'food',
      unit:          UI.val('ing-unit'),
      purchasePrice: UI.val('ing-price'),
      stockQuantity: UI.val('ing-stock'),
      minStock:      UI.val('ing-min-stock') || 0,
    };
    if (id) {
      DB.Ingredients.update(id, data);
      UI.toast('تم تحديث المكوّن بنجاح ✔', 'success');
    } else {
      DB.Ingredients.add(data);
      UI.toast('تم إضافة المكوّن بنجاح ✔', 'success');
    }
    UI.closeModal('modal-ingredient');
    render();
    Dashboard.render();
  }

  function confirmDelete(id) {
    const ing = DB.Ingredients.getById(id);
    UI.confirm(`هل تريد حذف المكوّن "${ing?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`, () => {
      DB.Ingredients.delete(id);
      UI.toast('تم الحذف', 'info');
      render();
      Dashboard.render();
    });
  }

  return { render, setFilter, openAdd, openEdit, save, confirmDelete };
})();

/* ═══════════════════════════════════════════════
   PURCHASES MODULE
═══════════════════════════════════════════════ */
const Purchases = (() => {

  function render() {
    const tbody = document.getElementById('tbody-purchases');
    const data  = DB.Purchases.getAll();
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">لا توجد مشتريات مسجلة.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(p => {
      const ing = DB.Ingredients.getById(p.ingredientId);
      return `
      <tr>
        <td>${DB.DateUtil.formatAr(p.date)}</td>
        <td>${esc(ing ? ing.name : '—')}</td>
        <td>${DB.Fmt.qty(p.quantity)} ${esc(ing ? ing.unit : '')}</td>
        <td>${DB.Fmt.aed(p.pricePerUnit)}</td>
        <td><strong>${DB.Fmt.aed(p.totalCost)}</strong></td>
        <td>${esc(p.supplier || '—')}</td>
        <td>
          <button class="btn-icon" title="حذف" onclick="Purchases.confirmDelete('${p.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  function openAdd() {
    document.getElementById('form-purchase').reset();
    UI.setVal('pur-id', '');
    UI.setVal('pur-date', DB.DateUtil.today());
    UI.populateIngredientSelect('pur-ingredient');
    UI.setVal('pur-total', '');
    UI.openModal('modal-purchase');
  }

  function onIngredientChange() {
    const ingId = document.getElementById('pur-ingredient').value;
    if (!ingId) return;
    const ing = DB.Ingredients.getById(ingId);
    if (ing) {
      UI.setVal('pur-price', ing.purchasePrice);
      calcTotal();
    }
  }

  function calcTotal() {
    const qty   = parseFloat(document.getElementById('pur-qty').value) || 0;
    const price = parseFloat(document.getElementById('pur-price').value) || 0;
    const total = (qty * price).toFixed(2);
    UI.setVal('pur-total', qty && price ? `${total} د.إ` : '');
  }

  function save(e) {
    e.preventDefault();
    const ingId = document.getElementById('pur-ingredient').value;
    if (!ingId) { UI.toast('يرجى اختيار المكوّن', 'error'); return; }
    DB.Purchases.add({
      date:         UI.val('pur-date'),
      ingredientId: ingId,
      quantity:     UI.val('pur-qty'),
      pricePerUnit: UI.val('pur-price'),
      supplier:     UI.val('pur-supplier'),
    });
    UI.closeModal('modal-purchase');
    UI.toast('تم تسجيل الشراء وتحديث المخزون ✔', 'success');
    render();
    Ingredients.render();
    Dashboard.render();
  }

  function confirmDelete(id) {
    UI.confirm('هل تريد حذف هذه العملية الشرائية؟ سيتم عكس التأثير على المخزون.', () => {
      DB.Purchases.delete(id);
      UI.toast('تم الحذف وعكس المخزون', 'info');
      render();
      Ingredients.render();
      Dashboard.render();
    });
  }

  return { render, openAdd, onIngredientChange, calcTotal, save, confirmDelete };
})();

/* ═══════════════════════════════════════════════
   RECIPES MODULE
═══════════════════════════════════════════════ */
const Recipes = (() => {

  let ingRowCount = 0;

  function render() {
    const container = document.getElementById('recipe-list');
    const data = DB.Recipes.getAll();
    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state">لا توجد وصفات بعد. أضف وصفة لحساب تكلفة الصينية.</div>';
      return;
    }
    container.innerHTML = data.map(r => buildRecipeCard(r)).join('');
  }

  function buildRecipeCard(recipe) {
    const trayCost  = DB.Recipes.calcTrayCost(recipe.id);
    const pieceCost = DB.Recipes.calcPieceCost(recipe.id);

    // Split into food vs packaging
    const foodItems = [], packItems = [];
    let foodCost = 0, packCost = 0;
    recipe.ingredients.forEach(ri => {
      const ing = DB.Ingredients.getById(ri.ingredientId);
      const lineCost = ing ? (ing.purchasePrice * ri.quantity) : 0;
      const row = `
        <tr>
          <td>${esc(ing ? ing.name : 'غير محدد')}</td>
          <td>${DB.Fmt.qty(ri.quantity)} ${esc(ing ? ing.unit : '')}</td>
          <td>${DB.Fmt.aed(ing ? ing.purchasePrice : 0)}</td>
          <td>${DB.Fmt.aed(lineCost)}</td>
        </tr>`;
      if (ing && (ing.type || 'food') === 'packaging') {
        packItems.push(row); packCost += lineCost;
      } else {
        foodItems.push(row); foodCost += lineCost;
      }
    });

    const makeSection = (label, emoji, rows, sub) => rows.length === 0 ? '' : `
      <tr class="recipe-section-header">
        <td colspan="4">${emoji} <strong>${label}</strong>
          <span style="float:left;font-size:.8rem;opacity:.7">${DB.Fmt.aed(sub)}</span>
        </td>
      </tr>
      ${rows.join('')}`;

    return `
    <div class="recipe-card">
      <div class="recipe-card-header">
        <div>
          <h4>${esc(recipe.name)}</h4>
          <div class="recipe-meta">${recipe.piecesPerTray} قطعة من الصينية الواحدة${recipe.description ? ' · ' + esc(recipe.description) : ''}</div>
        </div>
        <div class="recipe-card-actions">
          <button class="btn-icon" title="تعديل" onclick="Recipes.openEdit('${recipe.id}')">✏️</button>
          <button class="btn-icon" title="حذف"   onclick="Recipes.confirmDelete('${recipe.id}')">🗑️</button>
        </div>
      </div>
      <div class="recipe-card-body">
        <table class="recipe-ing-table">
          <thead><tr><th>البند</th><th>الكمية</th><th>سعر الوحدة</th><th>التكلفة</th></tr></thead>
          <tbody>
            ${makeSection('مكونات غذائية', '🍞', foodItems, foodCost)}
            ${makeSection('تغليف وملصقات', '📦', packItems, packCost)}
          </tbody>
        </table>
        <div class="recipe-cost-row">
          <span>🍞 تكلفة المكونات: <strong>${DB.Fmt.aed(foodCost)}</strong></span>
          <span>📦 تكلفة التغليف: <strong>${DB.Fmt.aed(packCost)}</strong></span>
          <span>💰 إجمالي الصينية: <strong>${DB.Fmt.aed(trayCost)}</strong></span>
          <span>🔪 تكلفة القطعة: <strong>${DB.Fmt.aed(pieceCost)}</strong></span>
        </div>
      </div>
    </div>`;
  }

  function openAdd() {
    document.getElementById('modal-recipe-title').textContent = 'إنشاء وصفة';
    document.getElementById('form-recipe').reset();
    UI.setVal('rec-id', '');
    ingRowCount = 0;
    const list = document.getElementById('recipe-ingredients-list');
    list.innerHTML = '';
    document.getElementById('recipe-cost-preview').style.display = 'none';
    addIngredientRow();
    addIngredientRow();
    UI.openModal('modal-recipe');
  }

  function openEdit(id) {
    const recipe = DB.Recipes.getById(id);
    if (!recipe) return;
    document.getElementById('modal-recipe-title').textContent = 'تعديل وصفة';
    UI.setVal('rec-id',     recipe.id);
    UI.setVal('rec-name',   recipe.name);
    UI.setVal('rec-desc',   recipe.description || '');
    UI.setVal('rec-pieces', recipe.piecesPerTray);
    ingRowCount = 0;
    const list = document.getElementById('recipe-ingredients-list');
    list.innerHTML = '';
    recipe.ingredients.forEach(ri => addIngredientRow(ri.ingredientId, ri.quantity));
    calcCostPreview();
    UI.openModal('modal-recipe');
  }

  function addIngredientRow(ingredientId = '', quantity = '') {
    ingRowCount++;
    const rowId = `ing-row-${ingRowCount}`;
    const ings  = DB.Ingredients.getAll();
    const opts  = ings.map(i =>
      `<option value="${i.id}" ${i.id === ingredientId ? 'selected' : ''}>${esc(i.name)} (${esc(i.unit)})</option>`
    ).join('');

    const row = document.createElement('div');
    row.className = 'recipe-ing-row';
    row.id = rowId;
    row.innerHTML = `
      <select name="rec-ing-id" onchange="Recipes.onIngRowChange(this)" required>
        <option value="">اختر المكوّن أو تغليف</option>
        ${opts}
      </select>
      <input type="number" name="rec-ing-qty" min="0.001" step="0.001"
             value="${quantity}" placeholder="الكمية" oninput="Recipes.calcCostPreview()" required />
      <span class="rec-ing-type-badge"></span>
      <button type="button" class="btn-icon" onclick="document.getElementById('${rowId}').remove(); Recipes.calcCostPreview()">✕</button>`;
    // Set badge if editing an existing row
    if (ingredientId) {
      const sel = row.querySelector('[name="rec-ing-id"]');
      Recipes.onIngRowChange(sel);
    }
    document.getElementById('recipe-ingredients-list').appendChild(row);
  }

  function collectIngredients() {
    const rows   = document.querySelectorAll('#recipe-ingredients-list .recipe-ing-row');
    const result = [];
    rows.forEach(row => {
      const id  = row.querySelector('[name="rec-ing-id"]')?.value;
      const qty = parseFloat(row.querySelector('[name="rec-ing-qty"]')?.value);
      if (id && qty > 0) result.push({ ingredientId: id, quantity: qty });
    });
    return result;
  }

  function onIngRowChange(selectEl) {
    const id    = selectEl.value;
    const badge = selectEl.parentElement.querySelector('.rec-ing-type-badge');
    if (!badge) return;
    if (!id) { badge.textContent = ''; return; }
    const ing = DB.Ingredients.getById(id);
    if (!ing) { badge.textContent = ''; return; }
    const isPackaging = (ing.type || 'food') === 'packaging';
    badge.textContent  = isPackaging ? '📦' : '🍞';
    badge.title        = isPackaging ? 'تغليف وملصقات' : 'مكوّن غذائي';
    Recipes.calcCostPreview();
  }

  function calcCostPreview() {
    const ings   = collectIngredients();
    const pieces = parseInt(document.getElementById('rec-pieces')?.value) || 0;
    let tray = 0;
    ings.forEach(ri => {
      const ing = DB.Ingredients.getById(ri.ingredientId);
      if (ing) tray += ing.purchasePrice * ri.quantity;
    });
    const piece = pieces > 0 ? tray / pieces : 0;
    const preview = document.getElementById('recipe-cost-preview');
    if (ings.length > 0) {
      preview.style.display = 'block';
      document.getElementById('recipe-tray-cost').textContent  = DB.Fmt.aed(tray);
      document.getElementById('recipe-piece-cost').textContent = pieces > 0 ? DB.Fmt.aed(piece) : '—';
    } else {
      preview.style.display = 'none';
    }
  }

  function save(e) {
    e.preventDefault();
    const ings = collectIngredients();
    if (ings.length === 0) { UI.toast('أضف مكوّناً واحداً على الأقل', 'error'); return; }
    const id = UI.val('rec-id');
    const data = {
      name:         UI.val('rec-name'),
      description:  UI.val('rec-desc'),
      piecesPerTray: UI.val('rec-pieces'),
      ingredients:  ings,
    };
    if (id) {
      DB.Recipes.update(id, data);
      UI.toast('تم تحديث الوصفة ✔', 'success');
    } else {
      DB.Recipes.add(data);
      UI.toast('تم حفظ الوصفة ✔', 'success');
    }
    UI.closeModal('modal-recipe');
    render();
    Dashboard.render();
  }

  function confirmDelete(id) {
    const r = DB.Recipes.getById(id);
    UI.confirm(`هل تريد حذف وصفة "${r?.name}"؟`, () => {
      DB.Recipes.delete(id);
      UI.toast('تم حذف الوصفة', 'info');
      render();
      Dashboard.render();
    });
  }

  return { render, openAdd, openEdit, addIngredientRow, onIngRowChange, calcCostPreview, save, confirmDelete };
})();

/* ═══════════════════════════════════════════════
   PRODUCTIONS MODULE
═══════════════════════════════════════════════ */
const Productions = (() => {

  function render() {
    const tbody = document.getElementById('tbody-production');
    const data  = DB.Productions.getAll();
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">لا يوجد إنتاج مسجل.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(p => `
      <tr>
        <td>${DB.DateUtil.formatAr(p.date)}</td>
        <td>${esc(p.recipeName)}</td>
        <td>${p.traysProduced}</td>
        <td><strong>${p.piecesProduced}</strong></td>
        <td>${DB.Fmt.aed(p.trayCost)}</td>
        <td><span class="badge badge-blue">${DB.Fmt.aed(p.costPerPiece)}</span></td>
        <td>${esc(p.notes || '—')}</td>
        <td>
          <button class="btn-icon" title="حذف" onclick="Productions.confirmDelete('${p.id}')">🗑️</button>
        </td>
      </tr>`).join('');
  }

  function openAdd() {
    document.getElementById('form-production').reset();
    UI.setVal('prod-date', DB.DateUtil.today());
    UI.populateRecipeSelect('prod-recipe');
    UI.setVal('prod-trays', '1');
    UI.setVal('prod-pieces', '');
    document.getElementById('prod-cost-preview').style.display = 'none';
    UI.openModal('modal-production');
  }

  function onRecipeChange() { calcPreview(); }

  function calcPreview() {
    const recipeId = document.getElementById('prod-recipe').value;
    const trays    = parseInt(document.getElementById('prod-trays').value) || 0;
    if (!recipeId || !trays) {
      document.getElementById('prod-cost-preview').style.display = 'none';
      UI.setVal('prod-pieces', '');
      return;
    }
    const recipe   = DB.Recipes.getById(recipeId);
    const trayCost = DB.Recipes.calcTrayCost(recipeId);
    const total    = trayCost * trays;
    const pieces   = (recipe ? recipe.piecesPerTray : 0) * trays;
    const cpPiece  = pieces > 0 ? total / pieces : 0;
    UI.setVal('prod-pieces', pieces);
    document.getElementById('prod-total-cost').textContent = DB.Fmt.aed(total);
    document.getElementById('prod-cost-piece').textContent = DB.Fmt.aed(cpPiece);
    document.getElementById('prod-cost-preview').style.display = 'block';
  }

  function save(e) {
    e.preventDefault();
    const recipeId = document.getElementById('prod-recipe').value;
    if (!recipeId) { UI.toast('يرجى اختيار الوصفة', 'error'); return; }
    DB.Productions.add({
      date:          UI.val('prod-date'),
      recipeId,
      traysProduced: UI.val('prod-trays'),
      notes:         UI.val('prod-notes'),
    });
    UI.closeModal('modal-production');
    UI.toast('تم تسجيل الإنتاج ✔ — تكلفة القطعة محدّثة', 'success');
    render();
    Dashboard.render();
  }

  function confirmDelete(id) {
    UI.confirm('حذف هذا السجل؟', () => {
      DB.Productions.delete(id);
      UI.toast('تم الحذف', 'info');
      render();
      Dashboard.render();
    });
  }

  return { render, openAdd, onRecipeChange, calcPreview, save, confirmDelete };
})();

/* ═══════════════════════════════════════════════
   SALES MODULE
═══════════════════════════════════════════════ */
const Sales = (() => {

  function render() {
    const tbody = document.getElementById('tbody-sales');
    const data  = DB.Sales.getAll();
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">لا توجد مبيعات مسجلة.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(s => {
      const profitClass = s.profit >= 0 ? 'profit-positive' : 'profit-negative';
      const typeLabel   = s.productType === 'tray' ? 'صينية' : 'قطعة';
      const typeBadge   = s.productType === 'tray' ? 'badge-orange' : 'badge-green';
      // Support old records that have no recipeName
      const recName = s.recipeName || (s.productName || '—');
      return `
      <tr>
        <td>${DB.DateUtil.formatAr(s.date)}</td>
        <td><strong>${esc(recName)}</strong></td>
        <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
        <td>${s.quantity}</td>
        <td>${DB.Fmt.aed(s.sellingPricePerUnit)}</td>
        <td>${DB.Fmt.aed(s.costPerUnit)}</td>
        <td>${DB.Fmt.aed(s.totalRevenue)}</td>
        <td class="${profitClass}">${DB.Fmt.aed(s.profit)}</td>
        <td>
          <button class="btn-icon" title="حذف" onclick="Sales.confirmDelete('${s.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  function openAdd() {
    document.getElementById('form-sale').reset();
    UI.setVal('sale-id', '');
    UI.setVal('sale-date', DB.DateUtil.today());
    UI.setVal('sale-qty', '1');
    document.getElementById('sale-preview').style.display = 'none';
    UI.populateRecipeSelect('sale-recipe');
    UI.setVal('sale-cost', '');
    UI.openModal('modal-sale');
  }

  function onTypeChange() {
    // When type changes, re-compute cost for the already-selected recipe
    onRecipeChange();
  }

  function onRecipeChange() {
    const type     = document.getElementById('sale-type').value;
    const recipeId = document.getElementById('sale-recipe').value;
    if (!recipeId) { UI.setVal('sale-cost', ''); calcPreview(); return; }
    const latest = DB.Productions.getLatestByRecipe(recipeId);
    if (!latest) {
      UI.setVal('sale-cost', '');
      UI.toast('لا يوجد إنتاج مسجل لهذه الوصفة بعد', 'info');
      calcPreview();
      return;
    }
    UI.setVal('sale-cost', type === 'piece' ? latest.costPerPiece : latest.trayCost);
    calcPreview();
  }

  function calcPreview() {
    const qty   = parseInt(document.getElementById('sale-qty').value) || 0;
    const price = parseFloat(document.getElementById('sale-price').value) || 0;
    const cost  = parseFloat(document.getElementById('sale-cost').value) || 0;
    if (!qty || !price) { document.getElementById('sale-preview').style.display = 'none'; return; }
    const revenue = qty * price;
    const profit  = revenue - qty * cost;
    document.getElementById('sale-revenue-preview').textContent = DB.Fmt.aed(revenue);
    document.getElementById('sale-profit-preview').textContent  = DB.Fmt.aed(profit);
    const profitEl = document.getElementById('sale-profit-preview');
    profitEl.className = profit >= 0 ? 'profit-positive' : 'profit-negative';
    document.getElementById('sale-preview').style.display = 'block';
  }

  function save(e) {
    e.preventDefault();
    const recipeId = document.getElementById('sale-recipe').value;
    if (!recipeId) { UI.toast('يرجى اختيار الوصفة', 'error'); return; }
    const recipe = DB.Recipes.getById(recipeId);
    DB.Sales.add({
      date:                UI.val('sale-date'),
      productType:         document.getElementById('sale-type').value,
      quantity:            UI.val('sale-qty'),
      sellingPricePerUnit: UI.val('sale-price'),
      costPerUnit:         document.getElementById('sale-cost').value,
      recipeId,
      recipeName:          recipe ? recipe.name : '',
    });
    UI.closeModal('modal-sale');
    UI.toast('تم تسجيل البيع ✔', 'success');
    render();
    Dashboard.render();
    Reports.render();
  }

  function confirmDelete(id) {
    UI.confirm('حذف هذا البيع؟', () => {
      DB.Sales.delete(id);
      UI.toast('تم الحذف', 'info');
      render();
      Dashboard.render();
      Reports.render();
    });
  }

  return { render, openAdd, onTypeChange, onRecipeChange, calcPreview, save, confirmDelete };
})();

/* ═══════════════════════════════════════════════
   REPORTS MODULE
═══════════════════════════════════════════════ */
const Reports = (() => {

  function dateRange() {
    const period = document.getElementById('report-period').value;
    const today  = DB.DateUtil.today();
    let from, to;
    document.getElementById('report-custom-dates').style.display  = 'none';
    document.getElementById('report-custom-dates2').style.display = 'none';
    if (period === 'today') {
      from = to = today;
    } else if (period === 'week') {
      from = DB.DateUtil.startOfWeek();
      to   = today;
    } else if (period === 'month') {
      from = DB.DateUtil.startOfMonth();
      to   = DB.DateUtil.endOfMonth();
    } else {
      document.getElementById('report-custom-dates').style.display  = 'flex';
      document.getElementById('report-custom-dates2').style.display = 'flex';
      from = document.getElementById('report-from').value || DB.DateUtil.startOfMonth();
      to   = document.getElementById('report-to').value   || today;
    }
    return { from, to };
  }

  function render() {
    const { from, to } = dateRange();
    const { filtered, revenue, cost, profit, units } = DB.Sales.aggregate(from, to);

    document.getElementById('rep-revenue').textContent = DB.Fmt.aed(revenue);
    document.getElementById('rep-cost').textContent    = DB.Fmt.aed(cost);
    document.getElementById('rep-profit').textContent  = DB.Fmt.aed(profit);
    document.getElementById('rep-margin').textContent  = revenue > 0
      ? `${((profit / revenue) * 100).toFixed(1)}%` : '—';
    document.getElementById('rep-units').textContent   = units;

    const avgPrice = units > 0 ? revenue / units : 0;
    document.getElementById('rep-avg-price').textContent = units > 0 ? DB.Fmt.aed(avgPrice) : '—';

    // Daily breakdown
    const byDay = {};
    filtered.forEach(s => {
      byDay[s.date] = byDay[s.date] || { revenue: 0, profit: 0, units: 0 };
      byDay[s.date].revenue += s.totalRevenue;
      byDay[s.date].profit  += s.profit;
      byDay[s.date].units   += s.quantity;
    });
    const days = Object.keys(byDay).sort().reverse();
    const dailyEl = document.getElementById('rep-daily-breakdown');
    if (days.length === 0) {
      dailyEl.textContent = 'لا توجد مبيعات في هذه الفترة.';
    } else {
      dailyEl.innerHTML = days.map(d => {
        const row = byDay[d];
        const pc  = row.profit >= 0 ? 'profit-positive' : 'profit-negative';
        return `<div style="display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid #f3f4f6">
          <span>${DB.DateUtil.formatAr(d)}</span>
          <span>${row.units} وحدة</span>
          <span>${DB.Fmt.aed(row.revenue)}</span>
          <span class="${pc}">${DB.Fmt.aed(row.profit)}</span>
        </div>`;
      }).join('');
    }

    // Sales detail — full table
    const detailEl = document.getElementById('rep-sales-detail');
    const footEl   = document.getElementById('rep-sales-foot');
    const countEl  = document.getElementById('rep-sales-count');
    if (filtered.length === 0) {
      detailEl.innerHTML = '<tr><td colspan="10" class="empty-row">لا توجد مبيعات في هذه الفترة.</td></tr>';
      footEl.innerHTML = '';
      if (countEl) countEl.textContent = '';
    } else {
      if (countEl) countEl.textContent = `${filtered.length} سجل`;
      detailEl.innerHTML = filtered.map(s => {
        const pc      = s.profit >= 0 ? 'profit-positive' : 'profit-negative';
        const margin  = s.totalRevenue > 0
          ? ((s.profit / s.totalRevenue) * 100).toFixed(1) + '%' : '—';
        const typeLabel  = s.productType === 'tray' ? 'صينية' : 'قطعة';
        const typeBadge  = s.productType === 'tray' ? 'badge-orange' : 'badge-green';
        const recName    = s.recipeName || s.productName || '—';
        return `<tr>
          <td>${DB.DateUtil.formatAr(s.date)}</td>
          <td><strong>${esc(recName)}</strong></td>
          <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
          <td>${s.quantity}</td>
          <td>${DB.Fmt.aed(s.sellingPricePerUnit)}</td>
          <td>${DB.Fmt.aed(s.costPerUnit)}</td>
          <td>${DB.Fmt.aed(s.totalRevenue)}</td>
          <td>${DB.Fmt.aed(s.totalCost)}</td>
          <td class="${pc}">${DB.Fmt.aed(s.profit)}</td>
          <td class="${pc}">${margin}</td>
        </tr>`;
      }).join('');

      // Totals footer
      const totMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) + '%' : '—';
      footEl.innerHTML = `<tr style="background:#eef0fb;font-weight:700;color:#2D2E83;border-top:2px solid #BFC9F7">
        <td colspan="3">الإجمالي</td>
        <td>${units}</td>
        <td>—</td>
        <td>—</td>
        <td>${DB.Fmt.aed(revenue)}</td>
        <td>${DB.Fmt.aed(cost)}</td>
        <td>${DB.Fmt.aed(profit)}</td>
        <td>${totMargin}</td>
      </tr>`;
    }
  }

  return { render };
})();

/* ═══════════════════════════════════════════════
   DASHBOARD MODULE
═══════════════════════════════════════════════ */
const Dashboard = (() => {

  function render() {
    const today      = DB.DateUtil.today();
    const monthStart = DB.DateUtil.startOfMonth();
    const monthEnd   = DB.DateUtil.endOfMonth();

    // Latest production cost
    const latestProd = DB.Productions.getLatest();
    const costPiece  = latestProd ? latestProd.costPerPiece : null;

    // Average sell price (last 30 days) for pieces
    const d30ago  = new Date(); d30ago.setDate(d30ago.getDate() - 30);
    const from30  = d30ago.toISOString().slice(0, 10);
    const recentSales = DB.Sales.getAll().filter(s => s.date >= from30 && s.productType === 'piece');
    const avgSell = recentSales.length > 0
      ? recentSales.reduce((s, x) => s + x.sellingPricePerUnit, 0) / recentSales.length
      : null;

    // Month aggregates
    const { revenue: mRev, cost: mCost, profit: mProfit } = DB.Sales.aggregate(monthStart, monthEnd);

    // KPI cards
    document.getElementById('dash-cost-per-piece').textContent = costPiece !== null ? DB.Fmt.aed(costPiece) : '—';
    document.getElementById('dash-sell-price').textContent     = avgSell !== null   ? DB.Fmt.aed(avgSell)   : '—';
    const profitPiece = (avgSell !== null && costPiece !== null) ? avgSell - costPiece : null;
    const ppEl = document.getElementById('dash-profit-piece');
    ppEl.textContent  = profitPiece !== null ? DB.Fmt.aed(profitPiece) : '—';
    ppEl.className    = `kpi-value ${profitPiece !== null ? (profitPiece >= 0 ? 'profit-positive' : 'profit-negative') : ''}`;

    document.getElementById('dash-month-profit').textContent  = DB.Fmt.aed(mProfit);
    document.getElementById('dash-month-revenue').textContent = DB.Fmt.aed(mRev);
    document.getElementById('dash-month-cost').textContent    = DB.Fmt.aed(mCost);
    document.getElementById('dash-month-label').textContent   = DB.DateUtil.monthNameAr(today);

    // Today summary
    const { filtered: todaySales, revenue: tRev, profit: tProfit, units: tUnits } = DB.Sales.aggregate(today, today);
    const todayEl = document.getElementById('dash-today-summary');
    if (todaySales.length === 0) {
      todayEl.innerHTML = '<span style="color:var(--gray-500)">لا توجد مبيعات اليوم.</span>';
    } else {
      todayEl.innerHTML = `
        <div>📦 <strong>${tUnits}</strong> وحدة مباعة</div>
        <div>💵 إيراد: <strong>${DB.Fmt.aed(tRev)}</strong></div>
        <div>✅ ربح اليوم: <strong class="${tProfit >= 0 ? 'profit-positive' : 'profit-negative'}">${DB.Fmt.aed(tProfit)}</strong></div>`;
    }

    // تنبيه المخزون — يقرأ كل مكوّن مباشرة ويتحقق من الحد الأدنى
    const allIngs   = DB.Ingredients.getAll();
    const emptyIngs = allIngs.filter(i => i.stockQuantity <= 0);
    const lowIngs   = allIngs.filter(i => {
      const min = parseFloat(i.minStock) || 0;
      return min > 0 && i.stockQuantity > 0 && i.stockQuantity <= min;
    });

    const stockEl    = document.getElementById('dash-low-stock');
    const stockTitle = document.getElementById('dash-low-stock-title');

    if (emptyIngs.length === 0 && lowIngs.length === 0) {
      stockTitle.textContent = '📦 حالة المخزون';
      stockEl.innerHTML = '<span style="color:var(--green)">✔ المخزون كافٍ لجميع المكونات.</span>';
    } else {
      const total = emptyIngs.length + lowIngs.length;
      stockTitle.textContent = `⚠️ مخزون منخفض (${total})`;
      let html = '';

      emptyIngs.forEach(i => {
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-bottom:1px solid #f3f4f6">
          <span>🔴 <strong>${esc(i.name)}</strong></span>
          <span style="color:var(--red);font-weight:600;font-size:.85rem">نفد المخزون!</span>
        </div>`;
      });

      lowIngs.forEach(i => {
        const min = parseFloat(i.minStock);
        const pct = Math.round((i.stockQuantity / min) * 100);
        const barColor = pct <= 25 ? 'var(--red)' : 'var(--orange)';
        html += `<div style="padding:.3rem 0;border-bottom:1px solid #f3f4f6">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>🟡 <strong>${esc(i.name)}</strong></span>
            <span style="color:var(--orange);font-size:.85rem">${DB.Fmt.qty(i.stockQuantity)} / ${DB.Fmt.qty(min)} ${esc(i.unit)}</span>
          </div>
          <div style="background:#e5e7eb;border-radius:4px;height:5px;margin-top:.3rem">
            <div style="background:${barColor};width:${Math.min(pct,100)}%;height:5px;border-radius:4px;transition:.3s"></div>
          </div>
        </div>`;
      });

      stockEl.innerHTML = html;
    }

    // Recent sales (last 5)
    const allSales = DB.Sales.getAll().slice(0, 5);
    const recentEl = document.getElementById('dash-recent-sales');
    if (allSales.length === 0) {
      recentEl.innerHTML = '<span style="color:var(--gray-500)">لا توجد مبيعات بعد.</span>';
    } else {
      recentEl.innerHTML = allSales.map(s => `
        <div style="display:flex;justify-content:space-between;padding:.25rem 0;border-bottom:1px solid #f3f4f6;font-size:.83rem">
          <span>${DB.DateUtil.formatAr(s.date)}</span>
          <span>${esc(s.productName)} × ${s.quantity}</span>
          <span class="${s.profit >= 0 ? 'profit-positive' : 'profit-negative'}">${DB.Fmt.aed(s.profit)}</span>
        </div>`).join('');
    }

    // Recent production (last 3)
    const prods  = DB.Productions.getAll().slice(0, 3);
    const prodEl = document.getElementById('dash-recent-production');
    if (prods.length === 0) {
      prodEl.innerHTML = '<span style="color:var(--gray-500)">لا يوجد إنتاج مسجل.</span>';
    } else {
      prodEl.innerHTML = prods.map(p => `
        <div style="display:flex;justify-content:space-between;padding:.25rem 0;border-bottom:1px solid #f3f4f6;font-size:.83rem">
          <span>${DB.DateUtil.formatAr(p.date)}</span>
          <span>${esc(p.recipeName)} — ${p.piecesProduced} قطعة</span>
          <span class="badge badge-blue">${DB.Fmt.aed(p.costPerPiece)}/قطعة</span>
        </div>`).join('');
    }
  }

  return { render };
})();

/* ═══════════════════════════════════════════════
   DEMO DATA LOADER (first-time only)
═══════════════════════════════════════════════ */
function loadDemoData() {
  if (DB.Ingredients.getAll().length > 0) return; // already seeded

  // Ingredients
  const ids = {};
  const ingList = [
    { name: 'سميد خشن',      unit: 'كيلو', purchasePrice: 4.50,  stockQuantity: 5 },
    { name: 'سكر',            unit: 'كيلو', purchasePrice: 3.00,  stockQuantity: 3 },
    { name: 'لبن مكثف محلى', unit: 'علبة', purchasePrice: 5.50,  stockQuantity: 10 },
    { name: 'كريمة طبخ',    unit: 'علبة', purchasePrice: 4.00,  stockQuantity: 8 },
    { name: 'زبدة',          unit: 'كيلو', purchasePrice: 28.00, stockQuantity: 2 },
    { name: 'ماء ورد',       unit: 'مل',   purchasePrice: 0.05,  stockQuantity: 500 },
    { name: 'جوز هند مبشور', unit: 'جرام', purchasePrice: 0.04,  stockQuantity: 300 },
    { name: 'لوز مجروش',    unit: 'جرام', purchasePrice: 0.06,  stockQuantity: 200 },
  ];
  ingList.forEach(i => { const r = DB.Ingredients.add(i); ids[i.name] = r.id; });

  // Ingredients — packaging items
  const packList = [
    { name: 'علبة تغليف',    unit: 'حبة', purchasePrice: 0.75, stockQuantity: 50,  type: 'packaging' },
    { name: 'ستكر البسبوسة', unit: 'حبة', purchasePrice: 0.20, stockQuantity: 200, type: 'packaging' },
    { name: 'كيس ورقي',    unit: 'حبة', purchasePrice: 0.10, stockQuantity: 100, type: 'packaging' },
  ];
  packList.forEach(p => { const r = DB.Ingredients.add(p); ids[p.name] = r.id; });

  // Recipe
  const recipe = DB.Recipes.add({
    name: 'بسبوسة كلاسيكية',
    description: 'الوصفة الأساسية للصينية الكاملة',
    piecesPerTray: 24,
    ingredients: [
      { ingredientId: ids['سميد خشن'],      quantity: 1.5 },
      { ingredientId: ids['سكر'],            quantity: 0.75 },
      { ingredientId: ids['لبن مكثف محلى'], quantity: 2   },
      { ingredientId: ids['كريمة طبخ'],    quantity: 2   },
      { ingredientId: ids['زبدة'],          quantity: 0.25 },
      { ingredientId: ids['ماء ورد'],       quantity: 30  },
      { ingredientId: ids['جوز هند مبشور'], quantity: 50  },
      { ingredientId: ids['لوز مجروش'],    quantity: 30  },
      // Packaging per tray
      { ingredientId: ids['علبة تغليف'],    quantity: 24  },
      { ingredientId: ids['ستكر البسبوسة'], quantity: 24  },
    ],
  });

  // Production
  DB.Productions.add({
    date:          DB.DateUtil.today(),
    recipeId:      recipe.id,
    traysProduced: 2,
    notes:         'إنتاج تجريبي أولي',
  });

  // Sample sales
  const today = DB.DateUtil.today();
  const latestProd = DB.Productions.getLatestByRecipe(recipe.id);
  const cpp = latestProd ? latestProd.costPerPiece : 2;
  [[today, 'piece', 5, 4.00], [today, 'piece', 3, 4.50]].forEach(([d, t, q, p]) => {
    DB.Sales.add({ date: d, productType: t, quantity: q, sellingPricePerUnit: p,
                   costPerUnit: cpp, recipeId: recipe.id, recipeName: recipe.name });
  });
}

/* ═══════════════════════════════════════════════
   ESCAPE HTML
═══════════════════════════════════════════════ */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════
   MODULE BUTTON WIRING — handled via direct onclick calls in HTML
═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Header date
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('header-date').textContent =
    now.toLocaleDateString('ar-AE', opts);

  // Seed demo data on first visit
  loadDemoData();

  // Initial renders
  Dashboard.render();
});
