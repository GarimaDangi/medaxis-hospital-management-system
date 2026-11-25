/**
 * MEDAXIS - Hospital Management System
 * Pharmacy Management Module: Inventory, Alerts, Stock Adjustment & Expiry Tracking
 */

const PharmacyModule = {
  medicinesList: [],
  alertsData: null,

  init() {
    this.setupSearchAndFilters();
    this.setupAddMedicineForm();
    this.setupEditMedicineForm();
    this.setupStockAdjustModal();
    this.loadMedicines();
    this.loadAlerts();
  },

  setupSearchAndFilters() {
    const searchInput = document.getElementById('pharmacy-search-input');
    const categoryFilter = document.getElementById('pharmacy-filter-category');
    const statusFilter = document.getElementById('pharmacy-filter-status');

    let debounce = null;
    const trigger = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => this.loadMedicines(), 300);
    };

    if (searchInput) searchInput.addEventListener('input', trigger);
    if (categoryFilter) categoryFilter.addEventListener('change', trigger);
    if (statusFilter) statusFilter.addEventListener('change', trigger);
  },

  async loadAlerts() {
    const alertsContainer = document.getElementById('pharmacy-alerts-summary-container');
    if (!alertsContainer) return;

    try {
      const res = await fetch('/api/pharmacy/alerts');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      this.alertsData = json.data;
      const { low_stock, out_of_stock, expiring_soon, expired, counts } = this.alertsData;

      let html = '';

      if (counts.out_of_stock > 0) {
        html += `
          <div class="pharmacy-alert-banner danger">
            <div class="pharmacy-alert-text">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <div>
                <strong>Critical: ${counts.out_of_stock} Medicine(s) Out of Stock!</strong>
                <div style="font-size: 0.78rem; margin-top: 2px;">${out_of_stock.map(m => m.name).slice(0, 3).join(', ')}${counts.out_of_stock > 3 ? '...' : ''} require immediate procurement.</div>
              </div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="PharmacyModule.filterByStatusQuick('Out of Stock')">View Out of Stock</button>
          </div>
        `;
      }

      if (counts.expired > 0) {
        html += `
          <div class="pharmacy-alert-banner danger" style="background-color: #450a0a; border-color: #7f1d1d; color: #fecaca;">
            <div class="pharmacy-alert-text">
              <i class="fa-solid fa-ban"></i>
              <div>
                <strong>Hazard Alert: ${counts.expired} Expired Medicine Batch(es) Detected!</strong>
                <div style="font-size: 0.78rem; margin-top: 2px;">${expired.map(m => m.name).slice(0, 3).join(', ')} must be removed from active dispensing.</div>
              </div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="PharmacyModule.filterByStatusQuick('Expired')">View Expired Batches</button>
          </div>
        `;
      }

      if (counts.low_stock > 0) {
        html += `
          <div class="pharmacy-alert-banner warning">
            <div class="pharmacy-alert-text">
              <i class="fa-solid fa-boxes-stacked"></i>
              <div>
                <strong>Low Stock Notice: ${counts.low_stock} Medicine(s) Below Safety Threshold.</strong>
                <div style="font-size: 0.78rem; margin-top: 2px;">${low_stock.map(m => m.name).slice(0, 3).join(', ')} inventory is running low.</div>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="PharmacyModule.filterByStatusQuick('Low Stock')">View Low Stock</button>
          </div>
        `;
      }

      if (counts.expiring_soon > 0) {
        html += `
          <div class="pharmacy-alert-banner warning" style="background-color: #fffbeb; border-color: #fde68a;">
            <div class="pharmacy-alert-text">
              <i class="fa-regular fa-clock"></i>
              <div>
                <strong>Expiry Alert: ${counts.expiring_soon} Medicine(s) Expiring Within 60 Days.</strong>
                <div style="font-size: 0.78rem; margin-top: 2px;">Verify lot consumption before expiration date.</div>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="PharmacyModule.filterByStatusQuick('Expiring Soon')">View Expiring Soon</button>
          </div>
        `;
      }

      alertsContainer.innerHTML = html;

    } catch (err) {
      console.error("Error loading pharmacy alerts:", err);
    }
  },

  filterByStatusQuick(statusName) {
    const statusFilter = document.getElementById('pharmacy-filter-status');
    if (statusFilter) {
      statusFilter.value = statusName;
      this.loadMedicines();
    }
  },

  async loadMedicines() {
    const tbody = document.getElementById('pharmacy-table-tbody');
    const badge = document.getElementById('pharmacy-total-count-badge');
    if (!tbody) return;

    const search = (document.getElementById('pharmacy-search-input')?.value || '').trim();
    const category = document.getElementById('pharmacy-filter-category')?.value || '';
    const stockStatus = document.getElementById('pharmacy-filter-status')?.value || '';

    try {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading pharmacy inventory...</td></tr>`;

      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category && category !== 'All') params.append('category', category);
      if (stockStatus && stockStatus !== 'All') params.append('stock_status', stockStatus);

      const res = await fetch(`/api/pharmacy/medicines?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      this.medicinesList = json.data;
      if (badge) badge.textContent = `${this.medicinesList.length} Items`;

      if (this.medicinesList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No medicines matched the specified filters.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.medicinesList.map(m => {
        let statusBadge = 'badge-success';
        if (m.stock_status === 'Low Stock') statusBadge = 'badge-warning';
        if (m.stock_status === 'Out of Stock') statusBadge = 'badge-danger';
        if (m.stock_status === 'Expiring Soon') statusBadge = 'badge-warning';
        if (m.stock_status === 'Expired') statusBadge = 'badge-danger';

        return `
          <tr>
            <td>
              <span class="badge badge-teal" style="font-family: 'JetBrains Mono', monospace;">${m.medicine_id}</span>
            </td>
            <td>
              <div class="cell-title">${m.name}</div>
              <div class="cell-sub">${m.manufacturer} • Batch: <strong style="font-family: 'JetBrains Mono', monospace;">${m.batch_number}</strong></div>
            </td>
            <td>
              <span class="badge badge-neutral">${m.category}</span>
            </td>
            <td>
              <div style="font-size: 1.05rem; font-weight: 700; color: ${m.quantity === 0 ? '#ef4444' : (m.quantity <= m.min_threshold ? '#d97706' : 'var(--navy-primary)')};">
                ${m.quantity} units
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">Min Level: ${m.min_threshold}</div>
            </td>
            <td>
              <strong style="color: var(--teal-primary);">₹${m.unit_price}</strong>
            </td>
            <td>
              <span style="font-size: 0.8rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">${m.mfg_date}</span>
            </td>
            <td>
              <span style="font-size: 0.82rem; font-weight: 600; font-family: 'JetBrains Mono', monospace; color: ${m.stock_status === 'Expired' ? '#ef4444' : (m.stock_status === 'Expiring Soon' ? '#d97706' : 'inherit')};">
                ${m.exp_date}
              </span>
            </td>
            <td>
              <span class="badge ${statusBadge}">${m.stock_status}</span>
            </td>
            <td>
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn btn-secondary btn-sm" title="Adjust Stock" onclick="PharmacyModule.openStockAdjustModal(${JSON.stringify(m).replace(/"/g, '&quot;')})">
                  <i class="fa-solid fa-boxes-packing" style="color: var(--blue-primary);"></i> Stock
                </button>
                <button class="btn btn-secondary btn-sm btn-icon-only" title="Edit Medicine" onclick="PharmacyModule.openEditMedicineModal(${JSON.stringify(m).replace(/"/g, '&quot;')})">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error("Error loading medicines:", err);
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--danger); padding: 1.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load medicine inventory. <button class="btn btn-secondary btn-sm" onclick="PharmacyModule.loadMedicines()" style="margin-left: 8px;">Retry</button></td></tr>`;
    }
  },

  // ==========================================
  // ADD MEDICINE MODAL
  // ==========================================
  setupAddMedicineForm() {
    const addBtn = document.getElementById('btn-add-new-medicine');
    const form = document.getElementById('form-add-medicine');

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (form) form.reset();
        App.openModal('modal-add-medicine');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddMedicineSubmit(form);
      });
    }
  },

  async handleAddMedicineSubmit(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    const data = {
      name: document.getElementById('add-med-name').value.trim(),
      category: document.getElementById('add-med-category').value.trim(),
      manufacturer: document.getElementById('add-med-manufacturer').value.trim(),
      batch_number: document.getElementById('add-med-batch').value.trim(),
      quantity: document.getElementById('add-med-qty').value,
      min_threshold: document.getElementById('add-med-min-threshold').value || 20,
      unit_price: document.getElementById('add-med-price').value,
      mfg_date: document.getElementById('add-med-mfg').value,
      exp_date: document.getElementById('add-med-exp').value
    };

    if (!data.name || !data.category || !data.batch_number || !data.exp_date) {
      App.showToast('Please fill all required medicine fields.', 'error');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

      const res = await fetch('/api/pharmacy/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast(json.message, 'success');
      App.closeModal('modal-add-medicine');
      form.reset();
      this.loadMedicines();
      this.loadAlerts();
      if (window.DashboardModule) DashboardModule.loadMetrics();

    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  },

  // ==========================================
  // EDIT MEDICINE MODAL
  // ==========================================
  setupEditMedicineForm() {
    const form = document.getElementById('form-edit-medicine');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleEditMedicineSubmit();
      });
    }
  },

  openEditMedicineModal(m) {
    document.getElementById('edit-med-pk').value = m.id;
    document.getElementById('edit-med-id-display').textContent = m.medicine_id;
    document.getElementById('edit-med-name').value = m.name;
    document.getElementById('edit-med-category').value = m.category;
    document.getElementById('edit-med-manufacturer').value = m.manufacturer;
    document.getElementById('edit-med-batch').value = m.batch_number;
    document.getElementById('edit-med-qty').value = m.quantity;
    document.getElementById('edit-med-min-threshold').value = m.min_threshold;
    document.getElementById('edit-med-price').value = m.unit_price;
    document.getElementById('edit-med-mfg').value = m.mfg_date;
    document.getElementById('edit-med-exp').value = m.exp_date;

    App.openModal('modal-edit-medicine');
  },

  async handleEditMedicineSubmit() {
    const pk = document.getElementById('edit-med-pk').value;
    const data = {
      name: document.getElementById('edit-med-name').value.trim(),
      category: document.getElementById('edit-med-category').value.trim(),
      manufacturer: document.getElementById('edit-med-manufacturer').value.trim(),
      batch_number: document.getElementById('edit-med-batch').value.trim(),
      quantity: document.getElementById('edit-med-qty').value,
      min_threshold: document.getElementById('edit-med-min-threshold').value,
      unit_price: document.getElementById('edit-med-price').value,
      mfg_date: document.getElementById('edit-med-mfg').value,
      exp_date: document.getElementById('edit-med-exp').value
    };

    try {
      const res = await fetch(`/api/pharmacy/medicines/${pk}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast(json.message, 'success');
      App.closeModal('modal-edit-medicine');
      this.loadMedicines();
      this.loadAlerts();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // STOCK ADJUSTMENT MODAL
  // ==========================================
  setupStockAdjustModal() {
    const form = document.getElementById('form-adjust-stock');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleStockAdjustSubmit();
      });
    }
  },

  currentAdjustMed: null,

  openStockAdjustModal(m) {
    this.currentAdjustMed = m;
    document.getElementById('adjust-stock-med-name').textContent = m.name;
    document.getElementById('adjust-stock-batch').textContent = `Batch: ${m.batch_number} | ID: ${m.medicine_id}`;
    document.getElementById('adjust-stock-current-qty').textContent = `${m.quantity} units`;
    document.getElementById('adjust-stock-amount').value = '';
    document.getElementById('adjust-stock-mode').value = 'add';

    App.openModal('modal-adjust-stock');
  },

  async handleStockAdjustSubmit() {
    if (!this.currentAdjustMed) return;

    const mode = document.getElementById('adjust-stock-mode').value;
    const amountVal = parseInt(document.getElementById('adjust-stock-amount').value, 10);

    if (isNaN(amountVal) || amountVal < 0) {
      App.showToast('Please enter a valid stock quantity.', 'error');
      return;
    }

    let finalQty = this.currentAdjustMed.quantity;
    if (mode === 'add') {
      finalQty += amountVal;
    } else if (mode === 'subtract') {
      finalQty = Math.max(0, finalQty - amountVal);
    } else if (mode === 'set') {
      finalQty = amountVal;
    }

    try {
      const res = await fetch(`/api/pharmacy/medicines/${this.currentAdjustMed.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: finalQty, is_absolute: true })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast(json.message, 'success');
      App.closeModal('modal-adjust-stock');
      this.loadMedicines();
      this.loadAlerts();
      if (window.DashboardModule) DashboardModule.loadMetrics();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }
};

window.PharmacyModule = PharmacyModule;

