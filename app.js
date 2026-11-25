/**
 * MEDAXIS - Hospital Management System (Admin Portal)
 * Core Application Router, State Management, Utilities & Modals
 */

const App = {
  currentView: 'dashboard',
  refreshInterval: null,

  init() {
    this.setupNavigation();
    this.setupLiveClock();
    this.setupGlobalSearch();
    this.setupNotifications();
    this.setupMobileMenu();
    this.setupModalDismissers();

    // Initialize all sub-modules
    if (window.DashboardModule && window.DashboardModule.init) window.DashboardModule.init();
    if (window.PatientsModule && window.PatientsModule.init) window.PatientsModule.init();
    if (window.DoctorsModule && window.DoctorsModule.init) window.DoctorsModule.init();
    if (window.AppointmentsModule && window.AppointmentsModule.init) window.AppointmentsModule.init();
    if (window.PharmacyModule && window.PharmacyModule.init) window.PharmacyModule.init();
    if (window.BillingModule && window.BillingModule.init) window.BillingModule.init();

    // Handle hash navigation
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`view-${hash}`)) {
      this.navigateTo(hash);
    } else {
      this.navigateTo('dashboard');
    }
  },

  // Navigation router
  setupNavigation() {
    document.querySelectorAll('[data-view-target]').forEach(elem => {
      elem.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = elem.getAttribute('data-view-target');
        this.navigateTo(targetView);
        
        // Close mobile drawer if open
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
      });
    });

    window.addEventListener('popstate', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.navigateTo(hash, false);
    });
  },

  navigateTo(viewName, updateHistory = true) {
    const targetElement = document.getElementById(`view-${viewName}`);
    if (!targetElement) return;

    // Update active nav links
    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
      if (item.getAttribute('data-view-target') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update active view panels
    document.querySelectorAll('.module-view').forEach(panel => {
      panel.classList.remove('active');
    });
    targetElement.classList.add('active');

    this.currentView = viewName;
    if (updateHistory) {
      window.history.pushState(null, '', `#${viewName}`);
    }

    // Scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trigger module reload if needed
    if (viewName === 'dashboard') {
      if (window.DashboardModule && window.DashboardModule.loadAllData) window.DashboardModule.loadAllData();
    } else if (viewName === 'patient-details') {
      if (window.PatientsModule && window.PatientsModule.loadPatients) window.PatientsModule.loadPatients();
    } else if (viewName === 'doctor-management') {
      if (window.DoctorsModule && window.DoctorsModule.loadDoctors) window.DoctorsModule.loadDoctors();
    } else if (viewName === 'appointment-booking') {
      if (window.AppointmentsModule && window.AppointmentsModule.loadAppointments) window.AppointmentsModule.loadAppointments();
    } else if (viewName === 'pharmacy-management') {
      if (window.PharmacyModule) {
        if (window.PharmacyModule.loadMedicines) window.PharmacyModule.loadMedicines();
        if (window.PharmacyModule.loadAlerts) window.PharmacyModule.loadAlerts();
      }
    } else if (viewName === 'billing-payment') {
      if (window.BillingModule && window.BillingModule.loadBills) window.BillingModule.loadBills();
    }
  },

  // Live Clock
  setupLiveClock() {
    const clockElem = document.getElementById('topbar-live-clock');
    if (!clockElem) return;

    const updateClock = () => {
      const now = new Date();
      const options = { 
        weekday: 'short', 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      };
      clockElem.textContent = now.toLocaleDateString('en-IN', options);
    };

    updateClock();
    setInterval(updateClock, 1000);
  },

  // Global Quick Search
  setupGlobalSearch() {
    const searchInput = document.getElementById('global-search-input');
    const searchDropdown = document.getElementById('search-results-dropdown');
    if (!searchInput || !searchDropdown) return;

    let debounceTimer = null;

    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();
      if (query.length < 2) {
        searchDropdown.style.display = 'none';
        searchDropdown.innerHTML = '';
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const json = await res.json();
          if (json.success) {
            App.renderSearchResults(json.data, query);
          }
        } catch (err) {
          console.error("Global search error:", err);
        }
      }, 250);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.style.display = 'none';
      }
    });

    // Keyboard shortcut '/' to focus search
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  },

  renderSearchResults(data, query) {
    const dropdown = document.getElementById('search-results-dropdown');
    let html = '';

    const hasResults = (data.patients && data.patients.length) || 
                       (data.doctors && data.doctors.length) || 
                       (data.medicines && data.medicines.length) || 
                       (data.bills && data.bills.length);

    if (!hasResults) {
      dropdown.innerHTML = `<div style="padding: 1.25rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No records found matching "${query}"</div>`;
      dropdown.style.display = 'block';
      return;
    }

    // Patients
    if (data.patients && data.patients.length) {
      html += `<div class="search-category-group">
        <div class="search-category-header"><i class="fa-solid fa-user-injured" style="margin-right: 6px;"></i> Patients</div>`;
      data.patients.forEach(p => {
        html += `
          <div class="search-item" onclick="App.onSearchSelectPatient('${p.patient_id}')">
            <div class="search-item-info">
              <span class="search-item-title">${p.full_name} <span class="badge badge-teal" style="font-size: 0.68rem; margin-left: 6px;">${p.patient_id}</span></span>
              <span class="search-item-meta">${p.gender}, ${p.age} yrs • Blood: ${p.blood_group} • 📞 ${p.mobile}</span>
            </div>
            <i class="fa-solid fa-chevron-right" style="color: var(--text-light); font-size: 0.75rem;"></i>
          </div>`;
      });
      html += `</div>`;
    }

    // Doctors
    if (data.doctors && data.doctors.length) {
      html += `<div class="search-category-group">
        <div class="search-category-header"><i class="fa-solid fa-user-doctor" style="margin-right: 6px;"></i> Doctors</div>`;
      data.doctors.forEach(d => {
        html += `
          <div class="search-item" onclick="App.navigateTo('doctor-management')">
            <div class="search-item-info">
              <span class="search-item-title">${d.name} <span class="badge badge-info" style="font-size: 0.68rem; margin-left: 6px;">${d.department_name}</span></span>
              <span class="search-item-meta">${d.specialization} • Fee: ₹${d.consultation_fee}</span>
            </div>
            <i class="fa-solid fa-chevron-right" style="color: var(--text-light); font-size: 0.75rem;"></i>
          </div>`;
      });
      html += `</div>`;
    }

    // Medicines
    if (data.medicines && data.medicines.length) {
      html += `<div class="search-category-group">
        <div class="search-category-header"><i class="fa-solid fa-pills" style="margin-right: 6px;"></i> Pharmacy Medicines</div>`;
      data.medicines.forEach(m => {
        html += `
          <div class="search-item" onclick="App.navigateTo('pharmacy-management')">
            <div class="search-item-info">
              <span class="search-item-title">${m.name} <span class="badge badge-neutral" style="font-size: 0.68rem; margin-left: 6px;">${m.category}</span></span>
              <span class="search-item-meta">Stock: ${m.quantity} units • Price: ₹${m.unit_price} • Batch: ${m.batch_number}</span>
            </div>
            <i class="fa-solid fa-chevron-right" style="color: var(--text-light); font-size: 0.75rem;"></i>
          </div>`;
      });
      html += `</div>`;
    }

    // Bills
    if (data.bills && data.bills.length) {
      html += `<div class="search-category-group">
        <div class="search-category-header"><i class="fa-solid fa-file-invoice-dollar" style="margin-right: 6px;"></i> Invoices & Bills</div>`;
      data.bills.forEach(b => {
        html += `
          <div class="search-item" onclick="BillingModule.openPrintInvoiceModal('${b.bill_id}')">
            <div class="search-item-info">
              <span class="search-item-title">${b.bill_id} - ${b.patient_name}</span>
              <span class="search-item-meta">Amount: ₹${b.total_amount} • Status: ${b.payment_status} • Method: ${b.payment_method}</span>
            </div>
            <i class="fa-solid fa-print" style="color: var(--blue-primary); font-size: 0.85rem;"></i>
          </div>`;
      });
      html += `</div>`;
    }

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
  },

  onSearchSelectPatient(patientId) {
    document.getElementById('search-results-dropdown').style.display = 'none';
    if (window.PatientsModule) {
      PatientsModule.openPatientProfileModal(patientId);
    }
  },

  // Notifications Popover
  setupNotifications() {
    const notifBtn = document.getElementById('notif-bell-btn');
    const popover = document.getElementById('notifications-popover');
    if (!notifBtn || !popover) return;

    notifBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isVisible = popover.style.display === 'block';
      if (isVisible) {
        popover.style.display = 'none';
      } else {
        await App.loadNotificationItems();
        popover.style.display = 'block';
      }
    });

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !notifBtn.contains(e.target)) {
        popover.style.display = 'none';
      }
    });
  },

  async loadNotificationItems() {
    const container = document.getElementById('notifications-list-container');
    const dot = document.getElementById('notif-badge-dot');
    if (!container) return;

    try {
      const [pharmAlertsRes, statsRes] = await Promise.all([
        fetch('/api/pharmacy/alerts'),
        fetch('/api/dashboard/stats')
      ]);

      const pharmAlerts = await pharmAlertsRes.json();
      const stats = await statsRes.json();

      let items = [];

      if (pharmAlerts.success && pharmAlerts.data) {
        const { low_stock, out_of_stock, expired, expiring_soon } = pharmAlerts.data;
        if (out_of_stock.length > 0) {
          items.push({
            type: 'alert',
            icon: 'fa-triangle-exclamation',
            title: `${out_of_stock.length} Medicine(s) Out of Stock`,
            sub: out_of_stock.map(m => m.name).slice(0, 2).join(', ') + ' require immediate reorder.',
            action: () => App.navigateTo('pharmacy-management')
          });
        }
        if (expired.length > 0) {
          items.push({
            type: 'alert',
            icon: 'fa-ban',
            title: `${expired.length} Expired Medication(s) Detected`,
            sub: 'Please quarantine and dispose of expired inventory batches.',
            action: () => App.navigateTo('pharmacy-management')
          });
        }
        if (low_stock.length > 0) {
          items.push({
            type: 'warn',
            icon: 'fa-box-open',
            title: `${low_stock.length} Medicine(s) Below Minimum Threshold`,
            sub: 'Refill procurement advised for optimal hospital pharmacy operations.',
            action: () => App.navigateTo('pharmacy-management')
          });
        }
      }

      if (stats.success && stats.data) {
        if (stats.data.today_appointments > 0) {
          items.push({
            type: 'info',
            icon: 'fa-calendar-day',
            title: `${stats.data.today_appointments} Appointments Scheduled Today`,
            sub: `${stats.data.today_completed} completed so far. View today's clinical queue.`,
            action: () => App.navigateTo('dashboard')
          });
        }
      }

      if (items.length === 0) {
        container.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">All systems operational. No pending alerts.</div>`;
        if (dot) dot.style.display = 'none';
        return;
      }

      if (dot) dot.style.display = 'block';

      container.innerHTML = items.map(item => `
        <div class="notif-item" style="cursor: pointer;" onclick="App.runNotifAction('${item.action}')">
          <div class="notif-icon ${item.type}"><i class="fa-solid ${item.icon}"></i></div>
          <div class="notif-content">
            <div class="notif-text">${item.title}</div>
            <div class="notif-sub">${item.sub}</div>
          </div>
        </div>
      `).join('');

    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  },

  runNotifAction(actionStr) {
    document.getElementById('notifications-popover').style.display = 'none';
    App.navigateTo('pharmacy-management');
  },

  // Mobile Menu Drawer
  setupMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const closeBtn = document.querySelector('.sidebar-close-btn');

    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    if (closeBtn && sidebar) {
      closeBtn.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
      });
    }
  },

  // Modal Dismissers (Escape key and clicking backdrop)
  setupModalDismissers() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          App.closeAllModals();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        App.closeAllModals();
      }
    });
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop.active').forEach(m => {
      m.classList.remove('active');
    });
    document.body.style.overflow = '';
  },

  // Toast Notification System
  showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';
    if (type === 'warning') icon = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon} toast-icon"></i>
      <span class="toast-msg">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  },

  // Helpers
  formatCurrency(num) {
    const n = Number(num) || 0;
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }
};

window.App = App;

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});

