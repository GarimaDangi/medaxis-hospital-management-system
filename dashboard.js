/**
 * MEDAXIS - Hospital Management System
 * Dashboard Module: Real-time Stats, Chart.js Visualizations & Clinical Summaries
 */

const DashboardModule = {
  charts: {},

  init() {
    this.setupRefreshButton();
    this.loadAllData();
  },

  setupRefreshButton() {
    const refreshBtn = document.getElementById('btn-dashboard-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Refreshing...';
        this.loadAllData().finally(() => {
          setTimeout(() => {
            refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh Data';
            App.showToast('Dashboard metrics updated from database.', 'success', 2000);
          }, 300);
        });
      });
    }
  },

  async loadAllData() {
    await Promise.all([
      this.loadMetrics(),
      this.loadCharts(),
      this.loadTodayAppointments(),
      this.loadRecentPatients(),
      this.loadDeptAvailability(),
      this.loadRecentBills()
    ]);
  },

  async loadMetrics() {
    try {
      const res = await fetch('/api/dashboard/stats');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const data = json.data;

      // Update KPI Elements
      const totalPat = document.getElementById('kpi-total-patients');
      if (totalPat) totalPat.textContent = data.total_patients;

      const totalDoc = document.getElementById('kpi-total-doctors');
      if (totalDoc) totalDoc.textContent = data.total_doctors;
      const availDoc = document.getElementById('kpi-avail-doctors');
      if (availDoc) availDoc.textContent = `${data.available_doctors} on duty`;

      const todayApt = document.getElementById('kpi-today-appointments');
      if (todayApt) todayApt.textContent = data.today_appointments;
      const todayDone = document.getElementById('kpi-today-completed');
      if (todayDone) todayDone.textContent = `${data.today_completed} completed`;

      const pendingApt = document.getElementById('kpi-pending-appointments');
      if (pendingApt) pendingApt.textContent = data.pending_appointments;

      const totalRev = document.getElementById('kpi-total-revenue');
      if (totalRev) totalRev.textContent = App.formatCurrency(data.total_revenue);
      const pendRev = document.getElementById('kpi-pending-revenue');
      if (pendRev) pendRev.textContent = `Pending: ${App.formatCurrency(data.total_pending_revenue)}`;

      const stockItems = document.getElementById('kpi-stock-items');
      if (stockItems) stockItems.textContent = data.total_medicines;
      const lowStockAlert = document.getElementById('kpi-low-stock-alert');
      if (lowStockAlert) {
        if (data.low_stock > 0 || data.out_of_stock > 0) {
          lowStockAlert.textContent = `${data.low_stock} Low, ${data.out_of_stock} Out`;
          lowStockAlert.style.color = '#ef4444';
        } else {
          lowStockAlert.textContent = 'All stocks healthy';
          lowStockAlert.style.color = '#10b981';
        }
      }

      // Sidebar badges
      const aptBadge = document.getElementById('sidebar-badge-appointments');
      if (aptBadge) aptBadge.textContent = data.today_appointments;

      const pharmBadge = document.getElementById('sidebar-badge-pharmacy');
      if (pharmBadge) {
        const totalAlerts = data.low_stock + data.out_of_stock + data.expired_medicines;
        if (totalAlerts > 0) {
          pharmBadge.textContent = `${totalAlerts} Alert`;
          pharmBadge.className = 'nav-badge alert';
        } else {
          pharmBadge.textContent = 'OK';
          pharmBadge.className = 'nav-badge';
        }
      }

    } catch (err) {
      console.error("Error loading dashboard metrics:", err);
    }
  },

  async loadCharts() {
    try {
      const res = await fetch('/api/dashboard/charts');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const data = json.data;

      this.renderTrendChart(data.trend_labels, data.trend_appointments, data.trend_revenue);
      this.renderStatusChart(data.appointment_status);
      this.renderRevenueChart(data.revenue_breakdown);
    } catch (err) {
      console.error("Error loading charts:", err);
    }
  },

  renderTrendChart(labels, appointments, revenue) {
    const ctx = document.getElementById('chart-appointments-trend');
    if (!ctx) return;

    if (this.charts.trend) {
      this.charts.trend.destroy();
    }

    this.charts.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Appointments',
            data: appointments,
            borderColor: '#0284c7',
            backgroundColor: 'rgba(2, 132, 199, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointBackgroundColor: '#0284c7',
            pointRadius: 4,
            yAxisID: 'y'
          },
          {
            label: 'Revenue (₹)',
            data: revenue,
            borderColor: '#0d9488',
            backgroundColor: 'rgba(13, 148, 136, 0.05)',
            borderDash: [4, 4],
            fill: false,
            tension: 0.35,
            borderWidth: 2,
            pointBackgroundColor: '#0d9488',
            pointRadius: 4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Plus Jakarta Sans', weight: '600' } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.datasetIndex === 1) {
                  return 'Revenue: ' + App.formatCurrency(context.parsed.y);
                }
                return 'Appointments: ' + context.parsed.y;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            title: { display: true, text: 'Appointments' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Revenue (₹)' }
          }
        }
      }
    });
  },

  renderStatusChart(statusCounts) {
    const ctx = document.getElementById('chart-appointment-status');
    if (!ctx) return;

    if (this.charts.status) {
      this.charts.status.destroy();
    }

    const labels = Object.keys(statusCounts);
    const dataVals = Object.values(statusCounts);

    this.charts.status = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataVals,
          backgroundColor: ['#0284c7', '#10b981', '#6366f1', '#ef4444'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 }, padding: 12 }
          }
        },
        cutout: '70%'
      }
    });
  },

  renderRevenueChart(breakdown) {
    const ctx = document.getElementById('chart-revenue-breakdown');
    if (!ctx) return;

    if (this.charts.revenue) {
      this.charts.revenue.destroy();
    }

    const labels = Object.keys(breakdown);
    const amounts = Object.values(breakdown);

    this.charts.revenue = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue (₹)',
          data: amounts,
          backgroundColor: [
            'rgba(2, 132, 199, 0.85)',
            'rgba(13, 148, 136, 0.85)',
            'rgba(99, 102, 241, 0.85)',
            'rgba(245, 158, 11, 0.85)'
          ],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => 'Revenue: ' + App.formatCurrency(ctx.parsed.y)
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true }
        }
      }
    });
  },

  async loadTodayAppointments() {
    const tbody = document.getElementById('dashboard-today-appointments-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/dashboard/today-appointments?limit=6');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const appointments = json.data;

      if (appointments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No appointments scheduled for today.</td></tr>`;
        return;
      }

      tbody.innerHTML = appointments.map(a => {
        let statusBadge = 'badge-info';
        if (a.status === 'Completed') statusBadge = 'badge-success';
        if (a.status === 'Cancelled') statusBadge = 'badge-danger';
        if (a.status === 'Rescheduled') statusBadge = 'badge-warning';

        return `
          <tr>
            <td>
              <div class="patient-cell">
                <div class="avatar-sm">${a.patient_name.charAt(0)}</div>
                <div>
                  <div class="cell-title">${a.patient_name}</div>
                  <div class="cell-sub">${a.patient_id} • ${a.patient_gender}, ${a.patient_age}y</div>
                </div>
              </div>
            </td>
            <td>
              <div class="cell-title">${a.doctor_name}</div>
              <div class="cell-sub">${a.department_name}</div>
            </td>
            <td>
              <div class="cell-title" style="font-family: 'JetBrains Mono', monospace;"><i class="fa-regular fa-clock" style="color: var(--blue-primary); margin-right: 4px;"></i>${a.appointment_time}</div>
            </td>
            <td>
              <span class="badge ${statusBadge}">${a.status}</span>
            </td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="PatientsModule.openPatientProfileModal('${a.patient_id}')">
                <i class="fa-solid fa-address-card"></i> Profile
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error("Error loading today appointments:", err);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 1.5rem;">Failed to load today's appointments. <button class="btn btn-secondary btn-sm" onclick="DashboardModule.loadTodayAppointments()" style="margin-left: 8px;">Retry</button></td></tr>`;
    }
  },

  async loadRecentPatients() {
    const tbody = document.getElementById('dashboard-recent-patients-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/dashboard/recent-patients?limit=5');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const patients = json.data;

      if (patients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No patients registered yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = patients.map(p => `
        <tr>
          <td>
            <div class="patient-cell">
              <div class="avatar-sm" style="background: var(--teal-light); color: var(--teal-primary);">${p.full_name.charAt(0)}</div>
              <div>
                <div class="cell-title">${p.full_name}</div>
                <div class="cell-sub">${p.patient_id}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge badge-teal"><i class="fa-solid fa-droplet"></i> ${p.blood_group}</span>
          </td>
          <td>
            <div class="cell-title">${p.mobile}</div>
            <div class="cell-sub">${p.city}, ${p.state}</div>
          </td>
          <td>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${App.formatDate(p.created_at)}</span>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="PatientsModule.openPatientProfileModal('${p.patient_id}')">
              <i class="fa-solid fa-eye"></i> View
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error("Error loading recent patients:", err);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 1.5rem;">Failed to load recent patients. <button class="btn btn-secondary btn-sm" onclick="DashboardModule.loadRecentPatients()" style="margin-left: 8px;">Retry</button></td></tr>`;
    }
  },

  async loadDeptAvailability() {
    const container = document.getElementById('dashboard-dept-availability-list');
    if (!container) return;

    try {
      const res = await fetch('/api/dashboard/department-availability');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const depts = json.data;

      container.innerHTML = depts.map(d => {
        const avail = d.available_doctors || 0;
        const total = d.total_doctors || 0;
        const isAllAvail = avail === total && total > 0;

        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0; border-bottom: 1px solid var(--border-light);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--blue-light); color: var(--blue-primary); display: flex; align-items: center; justify-content: center; font-size: 0.85rem;">
                <i class="fa-solid ${d.icon}"></i>
              </div>
              <div>
                <div style="font-size: 0.88rem; font-weight: 600; color: var(--navy-primary);">${d.name}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${total} Total Specialists</div>
              </div>
            </div>
            <div>
              <span class="badge ${isAllAvail ? 'badge-success' : 'badge-warning'}">
                <i class="fa-solid fa-user-doctor"></i> ${avail}/${total} Active
              </span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error("Error loading department availability:", err);
      container.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 1.5rem;">Failed to load department availability. <button class="btn btn-secondary btn-sm" onclick="DashboardModule.loadDeptAvailability()" style="margin-left: 8px;">Retry</button></div>`;
    }
  },

  async loadRecentBills() {
    const tbody = document.getElementById('dashboard-recent-bills-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/dashboard/recent-bills?limit=5');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const bills = json.data;

      if (bills.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No recent billing transactions.</td></tr>`;
        return;
      }

      tbody.innerHTML = bills.map(b => {
        let badgeClass = 'badge-success';
        if (b.payment_status === 'Pending') badgeClass = 'badge-danger';
        if (b.payment_status === 'Partially Paid') badgeClass = 'badge-warning';

        return `
          <tr>
            <td>
              <div class="cell-title" style="font-family: 'JetBrains Mono', monospace; color: var(--blue-primary);">${b.bill_id}</div>
              <div class="cell-sub">${b.payment_date || App.formatDate(b.created_at)}</div>
            </td>
            <td>
              <div class="cell-title">${b.patient_name}</div>
              <div class="cell-sub">${b.patient_id}</div>
            </td>
            <td>
              <div class="cell-title">${App.formatCurrency(b.total_amount)}</div>
              <div class="cell-sub">${b.payment_method}</div>
            </td>
            <td>
              <span class="badge ${badgeClass}">${b.payment_status}</span>
            </td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="BillingModule.openPrintInvoiceModal('${b.bill_id}')">
                <i class="fa-solid fa-receipt"></i> Bill
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error("Error loading recent bills:", err);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 1.5rem;">Failed to load recent bills. <button class="btn btn-secondary btn-sm" onclick="DashboardModule.loadRecentBills()" style="margin-left: 8px;">Retry</button></td></tr>`;
    }
  }
};

window.DashboardModule = DashboardModule;
