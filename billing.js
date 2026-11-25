/**
 * MEDAXIS - Hospital Management System
 * Billing & Payment Module: Itemized Invoice Builder, Payment Processing & Printable Receipts
 */

const BillingModule = {
  billsList: [],
  selectedPatientForBill: null,

  init() {
    this.setupSearchAndFilters();
    this.setupCreateBillModal();
    this.setupPaymentCalculations();
    this.loadBills();
  },

  setupSearchAndFilters() {
    const searchInput = document.getElementById('billing-search-input');
    const statusFilter = document.getElementById('billing-filter-status');
    const methodFilter = document.getElementById('billing-filter-method');

    let debounce = null;
    const trigger = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => this.loadBills(), 300);
    };

    if (searchInput) searchInput.addEventListener('input', trigger);
    if (statusFilter) statusFilter.addEventListener('change', trigger);
    if (methodFilter) methodFilter.addEventListener('change', trigger);
  },

  async loadBills() {
    const tbody = document.getElementById('billing-table-tbody');
    const badge = document.getElementById('billing-total-count-badge');
    if (!tbody) return;

    const search = (document.getElementById('billing-search-input')?.value || '').trim();
    const status = document.getElementById('billing-filter-status')?.value || '';
    const method = document.getElementById('billing-filter-method')?.value || '';

    try {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading billing invoices...</td></tr>`;

      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status && status !== 'All') params.append('payment_status', status);
      if (method && method !== 'All') params.append('payment_method', method);

      const res = await fetch(`/api/billing/bills?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      this.billsList = json.data;
      if (badge) badge.textContent = `${this.billsList.length} Invoices`;

      if (this.billsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No billing records found matching the criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.billsList.map(b => {
        let badgeClass = 'badge-success';
        if (b.payment_status === 'Pending') badgeClass = 'badge-danger';
        if (b.payment_status === 'Partially Paid') badgeClass = 'badge-warning';

        return `
          <tr>
            <td>
              <strong style="font-family: 'JetBrains Mono', monospace; color: var(--blue-primary);">${b.bill_id}</strong>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${b.payment_date || App.formatDate(b.created_at)}</div>
            </td>
            <td>
              <div class="patient-cell">
                <div class="avatar-sm" style="background: var(--teal-light); color: var(--teal-primary);">${b.patient_name.charAt(0)}</div>
                <div>
                  <div class="cell-title" style="cursor: pointer;" onclick="PatientsModule.openPatientProfileModal('${b.patient_id}')">
                    <a href="javascript:void(0)" style="color: var(--navy-primary); font-weight: 600;">${b.patient_name}</a>
                  </div>
                  <div class="cell-sub">${b.patient_id} • 📞 ${b.patient_mobile}</div>
                </div>
              </div>
            </td>
            <td>
              <div class="cell-title">${b.doctor_name || 'Hospital Services'}</div>
            </td>
            <td>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                Consult: ₹${b.consultation_fee} | Lab: ₹${b.lab_charges}<br>
                Pharm: ₹${b.medicine_charges} | Other: ₹${b.other_charges}
              </div>
            </td>
            <td>
              <div style="font-size: 1.05rem; font-weight: 800; color: var(--navy-primary);">
                ${App.formatCurrency(b.total_amount)}
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">Paid: ${App.formatCurrency(b.paid_amount)}</div>
            </td>
            <td>
              <span class="badge badge-neutral"><i class="fa-solid fa-credit-card"></i> ${b.payment_method}</span>
            </td>
            <td>
              <span class="badge ${badgeClass}">${b.payment_status}</span>
            </td>
            <td>
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn btn-secondary btn-sm" title="Print Invoice" onclick="BillingModule.openPrintInvoiceModal('${b.bill_id}')">
                  <i class="fa-solid fa-print"></i> Invoice
                </button>
                ${b.payment_status !== 'Paid' ? `
                  <button class="btn btn-secondary btn-sm" title="Update Payment" onclick="BillingModule.quickMarkPaid('${b.id}', '${b.total_amount}')">
                    <i class="fa-solid fa-check" style="color: #10b981;"></i> Pay
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error("Error loading bills:", err);
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 1.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load billing records. <button class="btn btn-secondary btn-sm" onclick="BillingModule.loadBills()" style="margin-left: 8px;">Retry</button></td></tr>`;
    }
  },

  async quickMarkPaid(billId, totalAmount) {
    try {
      const res = await fetch(`/api/billing/bills/${billId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: 'Paid', paid_amount: totalAmount })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast('Bill marked as PAID in full.', 'success');
      this.loadBills();
      if (window.DashboardModule) DashboardModule.loadMetrics();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // CREATE NEW BILL MODAL
  // ==========================================
  setupCreateBillModal() {
    const newBillBtn = document.getElementById('btn-create-new-bill');
    const form = document.getElementById('form-create-bill');
    const patientSearchInput = document.getElementById('bill-patient-search');
    const resultsBox = document.getElementById('bill-patient-results');

    if (newBillBtn) {
      newBillBtn.addEventListener('click', () => {
        if (form) form.reset();
        this.clearSelectedPatientForBill();
        this.populateBillDoctorSelect();
        this.recalculateBillTotals();
        App.openModal('modal-create-bill');
      });
    }

    if (patientSearchInput && resultsBox) {
      let debounce = null;
      patientSearchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        const query = patientSearchInput.value.trim();
        if (query.length < 2) {
          resultsBox.style.display = 'none';
          return;
        }

        debounce = setTimeout(async () => {
          try {
            const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=5`);
            const json = await res.json();
            if (json.success) {
              this.renderBillPatientSearchResults(json.data);
            }
          } catch (err) {
            console.error("Error searching patient for bill:", err);
          }
        }, 250);
      });

      document.addEventListener('click', (e) => {
        if (!patientSearchInput.contains(e.target) && !resultsBox.contains(e.target)) {
          resultsBox.style.display = 'none';
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCreateBillSubmit(form);
      });
    }
  },

  renderBillPatientSearchResults(patients) {
    const box = document.getElementById('bill-patient-results');
    if (!box) return;

    if (!patients || patients.length === 0) {
      box.innerHTML = `<div style="padding: 0.75rem; color: var(--text-muted); font-size: 0.82rem;">No patient found.</div>`;
      box.style.display = 'block';
      return;
    }

    box.innerHTML = patients.map(p => `
      <div class="search-item" onclick="BillingModule.selectPatientForBill(${JSON.stringify(p).replace(/"/g, '&quot;')})">
        <div class="search-item-info">
          <span class="search-item-title">${p.full_name} <span class="badge badge-teal" style="font-size: 0.68rem; margin-left: 6px;">${p.patient_id}</span></span>
          <span class="search-item-meta">${p.gender}, ${p.age}y • 📞 ${p.mobile}</span>
        </div>
        <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;">Select</button>
      </div>
    `).join('');

    box.style.display = 'block';
  },

  selectPatientForBill(patient) {
    this.selectedPatientForBill = patient;
    const box = document.getElementById('bill-patient-results');
    if (box) box.style.display = 'none';

    const card = document.getElementById('bill-patient-selected-card');
    if (card) {
      card.style.display = 'flex';
      card.innerHTML = `
        <div class="patient-cell" style="flex: 1;">
          <div class="avatar-sm" style="background: var(--blue-light); color: var(--blue-primary);">${patient.full_name.charAt(0)}</div>
          <div>
            <div style="font-weight: 700; color: var(--navy-primary);">${patient.full_name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              ID: ${patient.patient_id} | 📞 ${patient.mobile} | Blood: ${patient.blood_group}
            </div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="BillingModule.clearSelectedPatientForBill()"><i class="fa-solid fa-xmark"></i></button>
      `;
    }

    const input = document.getElementById('bill-patient-search');
    if (input) input.value = `${patient.full_name} (${patient.patient_id})`;
  },

  clearSelectedPatientForBill() {
    this.selectedPatientForBill = null;
    const card = document.getElementById('bill-patient-selected-card');
    if (card) card.style.display = 'none';
    const input = document.getElementById('bill-patient-search');
    if (input) input.value = '';
  },

  populateBillDoctorSelect() {
    const docSelect = document.getElementById('bill-doctor-select');
    if (!docSelect) return;

    fetch('/api/doctors')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          docSelect.innerHTML = `<option value="">-- Optional: Select Attending Doctor --</option>` +
            json.data.map(d => `<option value="${d.id}" data-fee="${d.consultation_fee}">${d.name} (${d.department_name}) - Fee: ₹${d.consultation_fee}</option>`).join('');

          docSelect.onchange = () => {
            const opt = docSelect.selectedOptions[0];
            const fee = opt ? parseFloat(opt.getAttribute('data-fee') || 0) : 0;
            const consultInput = document.getElementById('bill-charge-consultation');
            if (consultInput && fee > 0) {
              consultInput.value = fee;
              BillingModule.recalculateBillTotals();
            }
          };
        }
      });
  },

  setupPaymentCalculations() {
    const inputs = ['bill-charge-consultation', 'bill-charge-lab', 'bill-charge-pharmacy', 'bill-charge-other', 'bill-charge-discount'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.recalculateBillTotals());
      }
    });

    const statusSelect = document.getElementById('bill-payment-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', () => {
        const total = parseFloat(document.getElementById('bill-calculated-total-display')?.getAttribute('data-total') || 0);
        const paidInput = document.getElementById('bill-paid-amount');
        if (paidInput) {
          if (statusSelect.value === 'Paid') {
            paidInput.value = total;
          } else if (statusSelect.value === 'Pending') {
            paidInput.value = 0;
          }
        }
      });
    }
  },

  recalculateBillTotals() {
    const consult = parseFloat(document.getElementById('bill-charge-consultation')?.value || 0);
    const lab = parseFloat(document.getElementById('bill-charge-lab')?.value || 0);
    const pharm = parseFloat(document.getElementById('bill-charge-pharmacy')?.value || 0);
    const other = parseFloat(document.getElementById('bill-charge-other')?.value || 0);
    const discount = parseFloat(document.getElementById('bill-charge-discount')?.value || 0);

    const subtotal = consult + lab + pharm + other;
    const finalTotal = Math.max(0, subtotal - discount);

    const totalDisplay = document.getElementById('bill-calculated-total-display');
    if (totalDisplay) {
      totalDisplay.textContent = App.formatCurrency(finalTotal);
      totalDisplay.setAttribute('data-total', finalTotal);
    }

    const statusSelect = document.getElementById('bill-payment-status');
    const paidInput = document.getElementById('bill-paid-amount');
    if (paidInput && statusSelect) {
      if (statusSelect.value === 'Paid') {
        paidInput.value = finalTotal;
      }
    }
  },

  async handleCreateBillSubmit(form) {
    if (!this.selectedPatientForBill) {
      App.showToast('Please search and select a registered patient.', 'error');
      return;
    }

    const consult = parseFloat(document.getElementById('bill-charge-consultation')?.value || 0);
    const lab = parseFloat(document.getElementById('bill-charge-lab')?.value || 0);
    const pharm = parseFloat(document.getElementById('bill-charge-pharmacy')?.value || 0);
    const other = parseFloat(document.getElementById('bill-charge-other')?.value || 0);
    const discount = parseFloat(document.getElementById('bill-charge-discount')?.value || 0);
    const docId = document.getElementById('bill-doctor-select')?.value;
    const method = document.getElementById('bill-payment-method')?.value || 'Cash';
    const status = document.getElementById('bill-payment-status')?.value || 'Paid';
    const paidAmount = parseFloat(document.getElementById('bill-paid-amount')?.value || 0);
    const notes = document.getElementById('bill-notes')?.value.trim();

    const payload = {
      patient_id: this.selectedPatientForBill.id,
      doctor_id: docId || null,
      consultation_fee: consult,
      lab_charges: lab,
      medicine_charges: pharm,
      other_charges: other,
      discount: discount,
      payment_method: method,
      payment_status: status,
      paid_amount: paidAmount,
      notes: notes
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Invoice...';

      const res = await fetch('/api/billing/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast(json.message, 'success');
      App.closeModal('modal-create-bill');
      form.reset();
      this.clearSelectedPatientForBill();
      this.loadBills();
      if (window.DashboardModule) DashboardModule.loadAllData();

      // Open print preview immediately for admin convenience
      this.openPrintInvoiceModal(json.data.bill_id);

    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  },

  // ==========================================
  // PRINTABLE INVOICE / RECEIPT MODAL
  // ==========================================
  async openPrintInvoiceModal(billId) {
    try {
      const res = await fetch(`/api/billing/bills/${billId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const b = json.data;

      const modalContainer = document.getElementById('printable-invoice-content');
      if (!modalContainer) return;

      let stampClass = 'paid';
      if (b.payment_status === 'Pending') stampClass = 'pending';
      if (b.payment_status === 'Partially Paid') stampClass = 'partially-paid';

      modalContainer.innerHTML = `
        <div class="printable-invoice">
          <!-- Header Branding -->
          <div class="invoice-header">
            <div class="invoice-hospital-brand">
              <div class="invoice-logo-icon">
                <i class="fa-solid fa-staff-snake"></i>
              </div>
              <div class="invoice-hospital-info">
                <h2>MEDAXIS HOSPITAL</h2>
                <div class="hosp-tagline">Smart Hospital Management & Super Speciality Care</div>
                <div class="hosp-address">
                  Plot 14-B, Medical Enclave, BKC Road, Bandra East, Mumbai, Maharashtra 400051<br>
                  Emergency: 1800-MEDAXIS | 📞 +91 (022) 6789-0100 | ✉️ billing@medaxis.in<br>
                  <strong>GSTIN:</strong> 27AAAAA0000A1Z5 | <strong>NABH & ISO 9001:2015 Accredited</strong>
                </div>
              </div>
            </div>
            <div class="invoice-doc-title">
              <h3>OFFICIAL RECEIPT</h3>
              <div class="bill-meta-line"><strong>Bill No:</strong> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #0284c7;">${b.bill_id}</span></div>
              <div class="bill-meta-line"><strong>Date:</strong> ${b.payment_date || App.formatDate(b.created_at)}</div>
              <div class="bill-meta-line"><strong>Counter:</strong> Admin Central Desk 01</div>
            </div>
          </div>

          <!-- Patient & Clinical Details Grid -->
          <div class="invoice-details-grid">
            <div class="invoice-info-box">
              <h4>PATIENT INFORMATION</h4>
              <p><strong>Name:</strong> ${b.patient_name}</p>
              <p><strong>Patient ID:</strong> <span style="font-family: 'JetBrains Mono', monospace;">${b.patient_id}</span></p>
              <p><strong>Demographics:</strong> ${b.patient_age} Years / ${b.patient_gender} | Blood: ${b.patient_blood_group}</p>
              <p><strong>Phone:</strong> +91 ${b.patient_mobile}</p>
              <p><strong>Address:</strong> ${b.patient_address}, ${b.patient_city}, ${b.patient_state} - ${b.patient_pincode}</p>
            </div>
            <div class="invoice-info-box">
              <h4>CLINICAL & BILLING PARTICULARS</h4>
              <p><strong>Consulting Specialist:</strong> ${b.doctor_name || 'Hospital Inpatient & Outpatient Faculty'}</p>
              <p><strong>Department:</strong> ${b.department_name || 'Multi-Disciplinary'}</p>
              <p><strong>Payment Mode:</strong> <span style="font-weight: 700;">${b.payment_method}</span></p>
              <p><strong>Payment Status:</strong> <span style="font-weight: 700; color: ${b.payment_status === 'Paid' ? '#047857' : '#b45309'};">${b.payment_status}</span></p>
              <p><strong>Billing Category:</strong> General Outpatient / Care Package</p>
            </div>
          </div>

          <!-- Itemized Table -->
          <table class="invoice-table">
            <thead>
              <tr>
                <th style="width: 45px;">#</th>
                <th>Service / Charge Description</th>
                <th>Category</th>
                <th style="width: 70px;" class="text-right">Qty</th>
                <th style="width: 100px;" class="text-right">Rate (₹)</th>
                <th style="width: 110px;" class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${(b.items && b.items.length > 0) ? b.items.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.description}</strong></td>
                  <td><span class="badge badge-neutral" style="font-size: 0.7rem;">${item.item_type}</span></td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">${App.formatCurrency(item.unit_price)}</td>
                  <td class="text-right" style="font-weight: 600;">${App.formatCurrency(item.amount)}</td>
                </tr>
              `).join('') : `
                ${b.consultation_fee > 0 ? `<tr><td>1</td><td>Physician Consultation Fee</td><td>Consultation</td><td class="text-right">1</td><td class="text-right">₹${b.consultation_fee}</td><td class="text-right">₹${b.consultation_fee}</td></tr>` : ''}
                ${b.lab_charges > 0 ? `<tr><td>2</td><td>Diagnostic Laboratory Investigation Charges</td><td>Laboratory</td><td class="text-right">1</td><td class="text-right">₹${b.lab_charges}</td><td class="text-right">₹${b.lab_charges}</td></tr>` : ''}
                ${b.medicine_charges > 0 ? `<tr><td>3</td><td>Pharmacy Prescription & Medical Supplies</td><td>Pharmacy</td><td class="text-right">1</td><td class="text-right">₹${b.medicine_charges}</td><td class="text-right">₹${b.medicine_charges}</td></tr>` : ''}
                ${b.other_charges > 0 ? `<tr><td>4</td><td>Hospital Nursing & Facility Usage Charges</td><td>Other</td><td class="text-right">1</td><td class="text-right">₹${b.other_charges}</td><td class="text-right">₹${b.other_charges}</td></tr>` : ''}
              `}
            </tbody>
          </table>

          <!-- Totals and Payment Stamp -->
          <div class="invoice-totals-wrapper">
            <div class="payment-stamp-box ${stampClass}">
              <div class="stamp-status">${b.payment_status}</div>
              <div class="stamp-mode">Via ${b.payment_method}</div>
              <div style="font-size: 9px; margin-top: 4px; color: inherit;">MEDAXIS TREASURY AUTH</div>
            </div>

            <div class="invoice-totals-table">
              <div class="totals-row">
                <span>Subtotal Gross:</span>
                <span>${App.formatCurrency((b.consultation_fee || 0) + (b.lab_charges || 0) + (b.medicine_charges || 0) + (b.other_charges || 0))}</span>
              </div>
              ${b.discount > 0 ? `
                <div class="totals-row" style="color: #047857;">
                  <span>Concession / Discount:</span>
                  <span>- ${App.formatCurrency(b.discount)}</span>
                </div>
              ` : ''}
              <div class="totals-row grand-total">
                <span>Net Total Payable:</span>
                <span>${App.formatCurrency(b.total_amount)}</span>
              </div>
              <div class="totals-row">
                <span>Amount Received:</span>
                <span style="font-weight: 700; color: #047857;">${App.formatCurrency(b.paid_amount)}</span>
              </div>
              ${(b.total_amount - b.paid_amount) > 0 ? `
                <div class="totals-row" style="color: #b45309; font-weight: 700;">
                  <span>Balance Due:</span>
                  <span>${App.formatCurrency(b.total_amount - b.paid_amount)}</span>
                </div>
              ` : ''}
              <div class="amount-in-words">
                Total in figures: <strong>${App.formatCurrency(b.total_amount)}</strong>
              </div>
            </div>
          </div>

          <!-- Footer & Authorized Signatures -->
          <div class="invoice-footer-section">
            <div class="invoice-disclaimer">
              1. This is a computer-generated tax invoice and requires no physical seal under IT Act.<br>
              2. Medicines once dispensed can only be refunded if in unopened cold-chain pack.<br>
              3. For health insurance claim queries, please email tpa@medaxis.in with Bill No.
            </div>
            <div class="invoice-signature-box">
              <div class="sig-line"></div>
              <div class="sig-title">Authorized Accounts Officer</div>
              <div class="sig-sub">MEDAXIS Super Speciality Hospital</div>
            </div>
          </div>
        </div>
      `;

      App.openModal('modal-print-invoice');

    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  printCurrentInvoice() {
    window.print();
  }
};

window.BillingModule = BillingModule;

