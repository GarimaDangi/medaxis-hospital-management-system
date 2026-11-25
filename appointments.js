/**
 * MEDAXIS - Hospital Management System
 * Appointment Booking Module: Booking Wizard, Double-Booking Prevention, Reschedule & Cancel
 */

const AppointmentsModule = {
  currentTab: 'book', // 'book', 'manage', 'cancelled'
  selectedPatient: null,
  selectedDoctor: null,
  selectedSlotTime: null,

  init() {
    this.setupSubTabs();
    this.setupPatientSearch();
    this.setupDoctorCascade();
    this.setupDateSlotListeners();
    this.setupBookingSubmit();
    this.setupRescheduleModal();
    this.setupCancelModal();
    this.setupManageFilters();
  },

  setupSubTabs() {
    document.querySelectorAll('.apt-sub-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-apt-tab');
        this.switchTab(target);
      });
    });
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.apt-sub-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-apt-tab') === tabName);
    });

    const bookPane = document.getElementById('apt-tab-book-pane');
    const managePane = document.getElementById('apt-tab-manage-pane');
    const cancelledPane = document.getElementById('apt-tab-cancelled-pane');

    if (bookPane) bookPane.style.display = tabName === 'book' ? 'block' : 'none';
    if (managePane) managePane.style.display = tabName === 'manage' ? 'block' : 'none';
    if (cancelledPane) cancelledPane.style.display = tabName === 'cancelled' ? 'block' : 'none';

    if (tabName === 'manage') this.loadAppointments();
    if (tabName === 'cancelled') this.loadCancelledAppointments();
  },

  // ==========================================
  // BOOK APPOINTMENT WIZARD
  // ==========================================
  setupPatientSearch() {
    const input = document.getElementById('book-apt-patient-search');
    const resultsBox = document.getElementById('book-apt-patient-results');
    if (!input || !resultsBox) return;

    let debounce = null;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      const query = input.value.trim();
      if (query.length < 2) {
        resultsBox.style.display = 'none';
        return;
      }

      debounce = setTimeout(async () => {
        try {
          const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=6`);
          const json = await res.json();
          if (json.success) {
            this.renderPatientSearchResults(json.data);
          }
        } catch (err) {
          console.error("Patient search error:", err);
        }
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !resultsBox.contains(e.target)) {
        resultsBox.style.display = 'none';
      }
    });
  },

  renderPatientSearchResults(patients) {
    const box = document.getElementById('book-apt-patient-results');
    if (!box) return;

    if (!patients || patients.length === 0) {
      box.innerHTML = `<div style="padding: 0.75rem; color: var(--text-muted); font-size: 0.82rem;">No matching registered patient found.</div>`;
      box.style.display = 'block';
      return;
    }

    box.innerHTML = patients.map(p => `
      <div class="search-item" onclick="AppointmentsModule.selectPatientForBooking(${JSON.stringify(p).replace(/"/g, '&quot;')})">
        <div class="search-item-info">
          <span class="search-item-title">${p.full_name} <span class="badge badge-teal" style="font-size: 0.68rem; margin-left: 6px;">${p.patient_id}</span></span>
          <span class="search-item-meta">${p.gender}, ${p.age}y • Blood: ${p.blood_group} • 📞 ${p.mobile}</span>
        </div>
        <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem;">Select</button>
      </div>
    `).join('');

    box.style.display = 'block';
  },

  selectPatientForBooking(patient) {
    this.selectedPatient = patient;
    const box = document.getElementById('book-apt-patient-results');
    if (box) box.style.display = 'none';

    // Update patient display summary
    const summaryCard = document.getElementById('book-apt-patient-selected-card');
    if (summaryCard) {
      summaryCard.style.display = 'flex';
      summaryCard.innerHTML = `
        <div class="patient-cell" style="flex: 1;">
          <div class="avatar-sm" style="background: var(--blue-light); color: var(--blue-primary); width: 44px; height: 44px; font-size: 1rem;">${patient.full_name.charAt(0)}</div>
          <div>
            <div style="font-size: 1rem; font-weight: 700; color: var(--navy-primary);">${patient.full_name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              <strong>ID:</strong> ${patient.patient_id} | 
              <strong>Age/Gender:</strong> ${patient.age}y / ${patient.gender} | 
              <strong>Blood:</strong> <span class="badge badge-teal" style="font-size: 0.65rem;">${patient.blood_group}</span> | 
              <strong>Phone:</strong> ${patient.mobile}
            </div>
            ${patient.medical_history ? `<div style="font-size: 0.75rem; color: #b45309; margin-top: 2px;"><i class="fa-solid fa-triangle-exclamation"></i> Alerts: ${patient.medical_history}</div>` : ''}
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="AppointmentsModule.clearSelectedPatient()"><i class="fa-solid fa-xmark"></i> Change</button>
      `;
    }

    const input = document.getElementById('book-apt-patient-search');
    if (input) input.value = `${patient.full_name} (${patient.patient_id})`;
  },

  clearSelectedPatient() {
    this.selectedPatient = null;
    const summaryCard = document.getElementById('book-apt-patient-selected-card');
    if (summaryCard) summaryCard.style.display = 'none';
    const input = document.getElementById('book-apt-patient-search');
    if (input) {
      input.value = '';
      input.focus();
    }
  },

  setupDoctorCascade() {
    const deptSelect = document.getElementById('book-apt-department');
    const docSelect = document.getElementById('book-apt-doctor');

    if (deptSelect && docSelect) {
      deptSelect.addEventListener('change', async () => {
        const deptId = deptSelect.value;
        docSelect.innerHTML = '<option value="">-- Select Available Doctor --</option>';
        this.selectedDoctor = null;
        this.updateDoctorDetailsDisplay(null);
        this.clearSlotsGrid();

        if (!deptId) return;

        try {
          docSelect.disabled = true;
          docSelect.innerHTML = '<option value="">Loading doctors...</option>';

          const res = await fetch(`/api/doctors?department_id=${deptId}&availability=1`);
          const json = await res.json();
          if (!json.success) throw new Error(json.error);

          const doctors = json.data;
          if (doctors.length === 0) {
            docSelect.innerHTML = '<option value="">No active doctors in this department</option>';
            return;
          }

          docSelect.innerHTML = '<option value="">-- Select Available Doctor --</option>' +
            doctors.map(d => `<option value="${d.id}">${d.name} (${d.specialization}) - Fee: ₹${d.consultation_fee}</option>`).join('');

          docSelect.disabled = false;
        } catch (err) {
          console.error("Error loading doctors for dept:", err);
          docSelect.innerHTML = '<option value="">Failed to load doctors</option>';
          docSelect.disabled = false;
        }
      });

      docSelect.addEventListener('change', async () => {
        const docId = docSelect.value;
        if (!docId) {
          this.selectedDoctor = null;
          this.updateDoctorDetailsDisplay(null);
          this.clearSlotsGrid();
          return;
        }

        try {
          const res = await fetch(`/api/doctors/${docId}`);
          const json = await res.json();
          if (json.success) {
            this.selectedDoctor = json.data;
            this.updateDoctorDetailsDisplay(this.selectedDoctor);
            this.loadAvailableSlots();
          }
        } catch (err) {
          console.error("Error loading doctor:", err);
        }
      });
    }
  },

  selectDoctorForBooking(doctorId) {
    this.switchTab('book');
    const docSelect = document.getElementById('book-apt-doctor');
    const deptSelect = document.getElementById('book-apt-department');

    fetch(`/api/doctors/${doctorId}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          const doc = json.data;
          this.selectedDoctor = doc;
          if (deptSelect) deptSelect.value = doc.department_id;
          if (docSelect) {
            docSelect.innerHTML = `<option value="${doc.id}" selected>${doc.name} (${doc.specialization}) - Fee: ₹${doc.consultation_fee}</option>`;
            docSelect.disabled = false;
          }
          this.updateDoctorDetailsDisplay(doc);
          this.loadAvailableSlots();
        }
      });
  },

  updateDoctorDetailsDisplay(doc) {
    const card = document.getElementById('book-apt-doctor-info-card');
    const feeDisplay = document.getElementById('book-apt-fee-display');
    if (!card) return;

    if (!doc) {
      card.style.display = 'none';
      if (feeDisplay) feeDisplay.textContent = '₹0.00';
      return;
    }

    card.style.display = 'flex';
    card.innerHTML = `
      <div style="display: flex; gap: 0.85rem; align-items: center;">
        <img src="${doc.image_url}" alt="${doc.name}" style="width: 48px; height: 48px; border-radius: var(--radius-md); object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300'">
        <div>
          <div style="font-weight: 700; color: var(--navy-primary);">${doc.name}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${doc.qualification} • ${doc.experience} Years Exp.</div>
          <div style="font-size: 0.75rem; color: var(--blue-primary); margin-top: 2px;">
            <i class="fa-regular fa-clock"></i> ${doc.working_hours} | Days: ${doc.available_days}
          </div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Consultation Fee</div>
        <div style="font-size: 1.35rem; font-weight: 800; color: var(--teal-primary);">₹${doc.consultation_fee}</div>
      </div>
    `;

    if (feeDisplay) feeDisplay.textContent = App.formatCurrency(doc.consultation_fee);
  },

  setupDateSlotListeners() {
    const dateInput = document.getElementById('book-apt-date');
    if (dateInput) {
      // Set min date to today
      const todayStr = new Date().toISOString().split('T')[0];
      dateInput.min = todayStr;
      dateInput.value = todayStr;

      dateInput.addEventListener('change', () => {
        this.loadAvailableSlots();
      });
    }
  },

  async loadAvailableSlots() {
    if (!this.selectedDoctor) return;
    const dateInput = document.getElementById('book-apt-date');
    const dateVal = dateInput ? dateInput.value : '';
    if (!dateVal) return;

    const slotsContainer = document.getElementById('book-apt-slots-container');
    const slotsNotice = document.getElementById('book-apt-slots-notice');
    if (!slotsContainer) return;

    this.selectedSlotTime = null;
    this.updateSelectedSlotDisplay();

    try {
      slotsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Checking real-time slot availability...</div>`;
      if (slotsNotice) slotsNotice.style.display = 'none';

      const res = await fetch(`/api/appointments/slots?doctor_id=${this.selectedDoctor.id}&date=${dateVal}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const data = json.data;

      if (!data.is_available) {
        slotsContainer.innerHTML = ``;
        if (slotsNotice) {
          slotsNotice.className = 'pharmacy-alert-banner warning';
          slotsNotice.style.display = 'flex';
          slotsNotice.innerHTML = `<i class="fa-solid fa-calendar-xmark" style="font-size: 1.2rem; margin-right: 8px;"></i> <div>${data.reason || 'Doctor not available on this date.'}</div>`;
        }
        return;
      }

      if (!data.slots || data.slots.length === 0) {
        slotsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">No clinic slots available on this date.</div>`;
        return;
      }

      slotsContainer.innerHTML = data.slots.map(slot => {
        const isBooked = slot.is_booked;
        return `
          <button type="button" 
                  class="slot-btn ${isBooked ? 'booked' : ''}" 
                  ${isBooked ? 'disabled title="Slot already booked for another patient"' : `onclick="AppointmentsModule.onSelectSlot('${slot.time}', this)"`}>
            ${slot.time}
            ${isBooked ? '<div style="font-size: 0.65rem; color: #ef4444; margin-top: 2px;">Booked</div>' : '<div style="font-size: 0.65rem; color: #10b981; margin-top: 2px;">Available</div>'}
          </button>
        `;
      }).join('');

    } catch (err) {
      console.error("Error loading slots:", err);
      slotsContainer.innerHTML = `<div style="grid-column: 1 / -1; color: var(--danger); text-align: center;">Failed to load time slots.</div>`;
    }
  },

  onSelectSlot(timeStr, btnElement) {
    this.selectedSlotTime = timeStr;
    document.querySelectorAll('#book-apt-slots-container .slot-btn').forEach(btn => {
      btn.classList.remove('selected');
    });
    btnElement.classList.add('selected');
    this.updateSelectedSlotDisplay();
  },

  updateSelectedSlotDisplay() {
    const slotDisplay = document.getElementById('book-apt-selected-slot-display');
    if (slotDisplay) {
      slotDisplay.textContent = this.selectedSlotTime || 'No slot selected';
      slotDisplay.style.color = this.selectedSlotTime ? 'var(--blue-primary)' : 'var(--text-muted)';
    }
  },

  clearSlotsGrid() {
    const slotsContainer = document.getElementById('book-apt-slots-container');
    if (slotsContainer) slotsContainer.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 1rem;">Select doctor and date to view live available slots</div>';
    this.selectedSlotTime = null;
    this.updateSelectedSlotDisplay();
  },

  setupBookingSubmit() {
    const form = document.getElementById('form-book-appointment');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!this.selectedPatient) {
        App.showToast('Please search and select a registered patient.', 'error');
        return;
      }
      if (!this.selectedDoctor) {
        App.showToast('Please select a doctor.', 'error');
        return;
      }
      const aptDate = document.getElementById('book-apt-date')?.value;
      if (!aptDate) {
        App.showToast('Please select appointment date.', 'error');
        return;
      }
      if (!this.selectedSlotTime) {
        App.showToast('Please click and select an available time slot.', 'error');
        return;
      }

      const reason = document.getElementById('book-apt-reason')?.value.trim();
      const notes = document.getElementById('book-apt-notes')?.value.trim();

      const payload = {
        patient_id: this.selectedPatient.id,
        doctor_id: this.selectedDoctor.id,
        appointment_date: aptDate,
        appointment_time: this.selectedSlotTime,
        reason: reason,
        notes: notes
      };

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirming Booking...';

        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        const apt = json.data;

        // Show confirmation modal
        this.showBookingSuccessModal(apt);

        // Reset wizard
        form.reset();
        this.clearSelectedPatient();
        this.selectedDoctor = null;
        this.updateDoctorDetailsDisplay(null);
        this.clearSlotsGrid();

        if (window.DashboardModule) DashboardModule.loadAllData();

      } catch (err) {
        App.showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  },

  showBookingSuccessModal(apt) {
    const modalBody = document.getElementById('apt-success-modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 1.5rem 0;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--success-bg); color: var(--success); display: inline-flex; align-items: center; justify-content: center; font-size: 2rem; margin-bottom: 1rem;">
            <i class="fa-solid fa-calendar-check"></i>
          </div>
          <h3 style="font-size: 1.35rem; color: var(--navy-primary); margin-bottom: 0.5rem;">Appointment Booked Successfully!</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem;">Unique Clinical Appointment ID:</p>
          <div style="display: inline-block; background: var(--blue-light); color: var(--blue-primary); padding: 0.6rem 1.4rem; border-radius: 8px; font-size: 1.4rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; margin: 0.75rem 0;">
            ${apt.appointment_id}
          </div>
          <div style="background: var(--bg-main); border: 1px solid var(--border-light); border-radius: 8px; padding: 1rem; max-width: 420px; margin: 0 auto; text-align: left; font-size: 0.88rem; line-height: 1.6;">
            <div><strong>Patient:</strong> ${apt.patient_name}</div>
            <div><strong>Specialist:</strong> ${apt.doctor_name} (${apt.department_name})</div>
            <div><strong>Date & Time:</strong> ${apt.appointment_date} at <span style="font-weight: 700; color: var(--blue-primary);">${apt.appointment_time}</span></div>
            <div><strong>Consultation Fee:</strong> ${App.formatCurrency(apt.consultation_fee)}</div>
            <div><strong>Status:</strong> <span class="badge badge-info">${apt.status}</span></div>
          </div>
        </div>
      `;
    }

    const viewListBtn = document.getElementById('apt-success-view-list-btn');
    if (viewListBtn) {
      viewListBtn.onclick = () => {
        App.closeModal('modal-apt-success');
        AppointmentsModule.switchTab('manage');
      };
    }

    App.openModal('modal-apt-success');
  },

  // ==========================================
  // MANAGE & ACTIVE APPOINTMENTS TABLE
  // ==========================================
  setupManageFilters() {
    const searchInput = document.getElementById('apt-manage-search');
    const statusFilter = document.getElementById('apt-manage-filter-status');
    const dateFilter = document.getElementById('apt-manage-filter-date');

    let debounce = null;
    const trigger = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => this.loadAppointments(), 300);
    };

    if (searchInput) searchInput.addEventListener('input', trigger);
    if (statusFilter) statusFilter.addEventListener('change', trigger);
    if (dateFilter) dateFilter.addEventListener('change', trigger);
  },

  async loadAppointments() {
    const tbody = document.getElementById('apt-manage-table-tbody');
    const countBadge = document.getElementById('apt-manage-count-badge');
    if (!tbody) return;

    const search = (document.getElementById('apt-manage-search')?.value || '').trim();
    const status = document.getElementById('apt-manage-filter-status')?.value || '';
    const dateVal = document.getElementById('apt-manage-filter-date')?.value || '';

    try {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading appointment schedule...</td></tr>`;

      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status && status !== 'All') params.append('status', status);
      if (dateVal) params.append('date', dateVal);

      const res = await fetch(`/api/appointments?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const list = json.data;
      if (countBadge) countBadge.textContent = `${list.length} Appointments`;

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No appointments matched the specified search or filters.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(a => {
        let stClass = 'badge-info';
        if (a.status === 'Completed') stClass = 'badge-success';
        if (a.status === 'Cancelled') stClass = 'badge-danger';
        if (a.status === 'Rescheduled') stClass = 'badge-warning';

        return `
          <tr>
            <td>
              <span class="badge badge-teal" style="font-family: 'JetBrains Mono', monospace;">${a.appointment_id}</span>
            </td>
            <td>
              <div class="patient-cell">
                <div class="avatar-sm" style="background: var(--blue-light); color: var(--blue-primary);">${a.patient_name.charAt(0)}</div>
                <div>
                  <div class="cell-title" style="cursor: pointer;" onclick="PatientsModule.openPatientProfileModal('${a.patient_id}')">
                    <a href="javascript:void(0)" style="color: var(--blue-primary); font-weight: 600;">${a.patient_name}</a>
                  </div>
                  <div class="cell-sub">${a.patient_id} • 📞 ${a.patient_mobile}</div>
                </div>
              </div>
            </td>
            <td>
              <div class="cell-title">${a.doctor_name}</div>
              <div class="cell-sub">${a.department_name}</div>
            </td>
            <td>
              <div class="cell-title" style="font-family: 'JetBrains Mono', monospace;"><i class="fa-regular fa-calendar" style="color: var(--blue-primary); margin-right: 4px;"></i>${a.appointment_date}</div>
              <div class="cell-sub" style="font-family: 'JetBrains Mono', monospace;"><i class="fa-regular fa-clock" style="color: var(--teal-primary); margin-right: 4px;"></i>${a.appointment_time}</div>
            </td>
            <td>${App.formatCurrency(a.consultation_fee)}</td>
            <td><span class="badge ${stClass}">${a.status}</span></td>
            <td>
              <div style="display: flex; gap: 0.35rem;">
                ${a.status !== 'Completed' && a.status !== 'Cancelled' ? `
                  <button class="btn btn-secondary btn-sm" title="Mark Completed" onclick="AppointmentsModule.updateStatus('${a.id}', 'Completed')">
                    <i class="fa-solid fa-check" style="color: #10b981;"></i>
                  </button>
                  <button class="btn btn-secondary btn-sm" title="Reschedule Appointment" onclick="AppointmentsModule.openRescheduleModal(${JSON.stringify(a).replace(/"/g, '&quot;')})">
                    <i class="fa-solid fa-clock-rotate-left" style="color: var(--blue-primary);"></i> Reschedule
                  </button>
                  <button class="btn btn-secondary btn-sm" title="Cancel Appointment" onclick="AppointmentsModule.openCancelModal('${a.id}', '${a.appointment_id}')">
                    <i class="fa-solid fa-ban" style="color: #ef4444;"></i>
                  </button>
                ` : `
                  <button class="btn btn-secondary btn-sm" onclick="PatientsModule.openPatientProfileModal('${a.patient_id}')">
                    <i class="fa-solid fa-address-card"></i> Profile
                  </button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error("Error loading appointments:", err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 1.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load appointments. <button class="btn btn-secondary btn-sm" onclick="AppointmentsModule.loadAppointments()" style="margin-left: 8px;">Retry</button></td></tr>`;
    }
  },

  async updateStatus(aptId, status) {
    try {
      const res = await fetch(`/api/appointments/${aptId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast(`Appointment status updated to ${status}.`, 'success');
      this.loadAppointments();
      if (window.DashboardModule) DashboardModule.loadAllData();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // RESCHEDULE APPOINTMENT MODAL
  // ==========================================
  setupRescheduleModal() {
    const form = document.getElementById('form-reschedule-appointment');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleRescheduleSubmit();
      });
    }

    const dateInput = document.getElementById('reschedule-new-date');
    if (dateInput) {
      dateInput.addEventListener('change', () => {
        this.loadRescheduleSlots();
      });
    }
  },

  currentRescheduleApt: null,
  selectedRescheduleSlot: null,

  openRescheduleModal(apt) {
    this.currentRescheduleApt = apt;
    this.selectedRescheduleSlot = null;

    document.getElementById('reschedule-apt-id-display').textContent = apt.appointment_id;
    document.getElementById('reschedule-patient-name').textContent = apt.patient_name;
    document.getElementById('reschedule-doctor-name').textContent = `${apt.doctor_name} (${apt.department_name})`;
    document.getElementById('reschedule-current-time').textContent = `${apt.appointment_date} at ${apt.appointment_time}`;

    const dateInput = document.getElementById('reschedule-new-date');
    if (dateInput) {
      const todayStr = new Date().toISOString().split('T')[0];
      dateInput.min = todayStr;
      dateInput.value = todayStr;
    }

    this.loadRescheduleSlots();
    App.openModal('modal-reschedule-appointment');
  },

  async loadRescheduleSlots() {
    if (!this.currentRescheduleApt) return;
    const dateVal = document.getElementById('reschedule-new-date')?.value;
    const container = document.getElementById('reschedule-slots-container');
    if (!container || !dateVal) return;

    this.selectedRescheduleSlot = null;
    try {
      container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Checking slots...</div>`;
      const res = await fetch(`/api/appointments/slots?doctor_id=${this.currentRescheduleApt.doctor_id}&date=${dateVal}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const data = json.data;
      if (!data.is_available || !data.slots || data.slots.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--warning); font-size: 0.85rem; text-align: center;">${data.reason || 'No available slots on this date.'}</div>`;
        return;
      }

      container.innerHTML = data.slots.map(s => `
        <button type="button" 
                class="slot-btn ${s.is_booked ? 'booked' : ''}" 
                ${s.is_booked ? 'disabled' : `onclick="AppointmentsModule.onSelectRescheduleSlot('${s.time}', this)"`}>
          ${s.time}
        </button>
      `).join('');

    } catch (err) {
      container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--danger);">Failed to load slots.</div>`;
    }
  },

  onSelectRescheduleSlot(timeStr, btn) {
    this.selectedRescheduleSlot = timeStr;
    document.querySelectorAll('#reschedule-slots-container .slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  },

  async handleRescheduleSubmit() {
    if (!this.currentRescheduleApt) return;
    const newDate = document.getElementById('reschedule-new-date')?.value;
    const reason = document.getElementById('reschedule-reason')?.value.trim();

    if (!newDate) {
      App.showToast('Please select a new appointment date.', 'error');
      return;
    }
    if (!this.selectedRescheduleSlot) {
      App.showToast('Please click and select an available time slot.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/appointments/${this.currentRescheduleApt.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_date: newDate,
          new_time: this.selectedRescheduleSlot,
          reason: reason
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast(json.message, 'success');
      App.closeModal('modal-reschedule-appointment');
      this.loadAppointments();
      if (window.DashboardModule) DashboardModule.loadAllData();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // CANCEL APPOINTMENT MODAL
  // ==========================================
  setupCancelModal() {
    const form = document.getElementById('form-cancel-appointment');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCancelSubmit();
      });
    }
  },

  targetCancelAptId: null,

  openCancelModal(id, aptCode) {
    this.targetCancelAptId = id;
    document.getElementById('cancel-apt-code-display').textContent = aptCode;
    document.getElementById('cancel-apt-reason').value = '';
    App.openModal('modal-cancel-appointment');
  },

  async handleCancelSubmit() {
    if (!this.targetCancelAptId) return;
    const reason = document.getElementById('cancel-apt-reason')?.value.trim();

    try {
      const res = await fetch(`/api/appointments/${this.targetCancelAptId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast(json.message, 'success');
      App.closeModal('modal-cancel-appointment');
      this.loadAppointments();
      if (window.DashboardModule) DashboardModule.loadAllData();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // CANCELLED APPOINTMENTS TAB
  // ==========================================
  async loadCancelledAppointments() {
    const tbody = document.getElementById('apt-cancelled-table-tbody');
    const badge = document.getElementById('apt-cancelled-count-badge');
    if (!tbody) return;

    try {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading cancelled records...</td></tr>`;

      const res = await fetch('/api/appointments/cancelled');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const list = json.data;
      if (badge) badge.textContent = `${list.length} Cancelled`;

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No cancelled appointments on record.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(c => `
        <tr>
          <td><span class="badge badge-danger" style="font-family: 'JetBrains Mono', monospace;">${c.appointment_id}</span></td>
          <td>
            <div class="cell-title">${c.patient_name}</div>
            <div class="cell-sub">${c.patient_id} • 📞 ${c.patient_mobile}</div>
          </td>
          <td>
            <div class="cell-title">${c.doctor_name}</div>
            <div class="cell-sub">${c.department_name}</div>
          </td>
          <td>
            <div style="font-family: 'JetBrains Mono', monospace;">${c.appointment_date}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${c.appointment_time}</div>
          </td>
          <td>
            <span style="font-size: 0.82rem; color: #991b1b; background: var(--danger-bg); padding: 0.25rem 0.5rem; border-radius: 4px; display: inline-block;">
              ${c.cancellation_reason || 'Cancelled by staff'}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="AppointmentsModule.rebookCancelled('${c.patient_id}')">
              <i class="fa-solid fa-calendar-plus"></i> Re-Book
            </button>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error("Error loading cancelled appointments:", err);
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 1.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load cancelled appointments. <button class="btn btn-secondary btn-sm" onclick="AppointmentsModule.loadCancelledAppointments()" style="margin-left: 8px;">Retry</button></td></tr>`;
    }
  },

  rebookCancelled(patientId) {
    this.switchTab('book');
    fetch(`/api/patients/${patientId}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          this.selectPatientForBooking(json.data);
        }
      });
  }
};

window.AppointmentsModule = AppointmentsModule;

