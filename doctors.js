/**
 * MEDAXIS - Hospital Management System
 * Doctor Management Module: Departments, Profiles, Availability & Schedules
 */

const DoctorsModule = {
  doctorsList: [],
  departments: [],
  selectedDepartmentId: 'All',

  init() {
    this.setupSearch();
    this.setupAddDoctorForm();
    this.setupEditDoctorForm();
    this.loadDepartments();
    this.loadDoctors();
  },

  async loadDepartments() {
    try {
      const res = await fetch('/api/departments');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      this.departments = json.data;
      this.renderDepartmentPills();
      this.populateDepartmentSelects();
    } catch (err) {
      console.error("Error loading departments:", err);
    }
  },

  renderDepartmentPills() {
    const container = document.getElementById('doctor-dept-pills-container');
    if (!container) return;

    let html = `
      <div class="dept-pill ${this.selectedDepartmentId === 'All' ? 'active' : ''}" onclick="DoctorsModule.filterByDepartment('All')">
        <i class="fa-solid fa-hospital"></i> All Departments
      </div>
    `;

    this.departments.forEach(dept => {
      const isActive = String(this.selectedDepartmentId) === String(dept.id);
      html += `
        <div class="dept-pill ${isActive ? 'active' : ''}" onclick="DoctorsModule.filterByDepartment(${dept.id})">
          <i class="fa-solid ${dept.icon}"></i> ${dept.name} <span class="badge ${isActive ? 'badge-neutral' : 'badge-teal'}" style="margin-left: 4px; font-size: 0.68rem;">${dept.doctor_count || 0}</span>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  populateDepartmentSelects() {
    const addSelect = document.getElementById('add-doctor-dept');
    const editSelect = document.getElementById('edit-doctor-dept');
    const bookingSelect = document.getElementById('book-apt-department');

    const optionsHtml = this.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

    if (addSelect) addSelect.innerHTML = `<option value="">-- Select Department --</option>` + optionsHtml;
    if (editSelect) editSelect.innerHTML = optionsHtml;
    if (bookingSelect) bookingSelect.innerHTML = `<option value="">-- Select Medical Department --</option>` + optionsHtml;
  },

  filterByDepartment(deptId) {
    this.selectedDepartmentId = deptId;
    this.renderDepartmentPills();
    this.loadDoctors();
  },

  setupSearch() {
    const searchInput = document.getElementById('doctors-search-input');
    if (searchInput) {
      let debounce = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => this.loadDoctors(), 300);
      });
    }
  },

  async loadDoctors() {
    const container = document.getElementById('doctors-grid-container');
    const countBadge = document.getElementById('doctors-total-count-badge');
    if (!container) return;

    const search = (document.getElementById('doctors-search-input')?.value || '').trim();

    try {
      container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading medical faculty...</div>`;

      const params = new URLSearchParams();
      if (this.selectedDepartmentId && this.selectedDepartmentId !== 'All') {
        params.append('department_id', this.selectedDepartmentId);
      }
      if (search) params.append('search', search);

      const res = await fetch(`/api/doctors?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      this.doctorsList = json.data;
      if (countBadge) countBadge.textContent = `${this.doctorsList.length} Doctors`;

      if (this.doctorsList.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted); background: #ffffff; border-radius: var(--radius-lg); border: 1px dashed var(--border-light);">No doctors found for this filter.</div>`;
        return;
      }

      container.innerHTML = this.doctorsList.map(doc => {
        const isAvail = doc.is_available === 1;
        return `
          <div class="doctor-card">
            <div class="doctor-card-top">
              <img src="${doc.image_url || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300'}" alt="${doc.name}" class="doctor-avatar-img" onerror="this.src='https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300'">
              <div class="doctor-top-info">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <span class="badge ${isAvail ? 'badge-success' : 'badge-danger'}" style="margin-bottom: 4px;">
                    <i class="fa-solid ${isAvail ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${isAvail ? 'Available' : 'On Leave'}
                  </span>
                  <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">${doc.doctor_id}</span>
                </div>
                <h4 class="doctor-name-title">${doc.name}</h4>
                <div class="doctor-dept-badge"><i class="fa-solid ${doc.department_icon || 'fa-stethoscope'}"></i> ${doc.department_name}</div>
                <div class="doctor-spec">${doc.specialization}</div>
              </div>
            </div>

            <div class="doctor-details-list">
              <div class="doctor-detail-row">
                <span class="detail-label">Qualification:</span>
                <span class="detail-val">${doc.qualification}</span>
              </div>
              <div class="doctor-detail-row">
                <span class="detail-label">Experience:</span>
                <span class="detail-val">${doc.experience} Years</span>
              </div>
              <div class="doctor-detail-row">
                <span class="detail-label">Consultation Fee:</span>
                <span class="detail-val" style="color: var(--teal-primary); font-weight: 700;">₹${doc.consultation_fee}</span>
              </div>
              <div class="doctor-detail-row">
                <span class="detail-label">Working Days:</span>
                <span class="detail-val" style="font-size: 0.75rem;">${doc.available_days}</span>
              </div>
              <div class="doctor-detail-row">
                <span class="detail-label">Clinic Hours:</span>
                <span class="detail-val" style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;">${doc.working_hours}</span>
              </div>
              <div class="doctor-detail-row">
                <span class="detail-label">Break Time:</span>
                <span class="detail-val" style="font-size: 0.75rem; color: var(--text-muted);">${doc.break_time || 'None'}</span>
              </div>
              <div class="doctor-detail-row" style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--border-light);">
                <span class="detail-label">Contact:</span>
                <span class="detail-val" style="font-size: 0.75rem;">📞 ${doc.mobile}</span>
              </div>
            </div>

            <div class="doctor-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="DoctorsModule.toggleAvailability('${doc.id}', ${isAvail ? 0 : 1})">
                <i class="fa-solid fa-power-off" style="color: ${isAvail ? '#ef4444' : '#10b981'};"></i> ${isAvail ? 'Set On Leave' : 'Set Available'}
              </button>
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn btn-secondary btn-sm btn-icon-only" title="Edit Doctor" onclick="DoctorsModule.openEditDoctorModal('${doc.id}')">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn btn-primary btn-sm" onclick="DoctorsModule.bookWithDoctor('${doc.id}')">
                  <i class="fa-solid fa-calendar-plus"></i> Book
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error("Error loading doctors:", err);
      container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--danger); padding: 2rem;">Failed to load doctors.</div>`;
    }
  },

  bookWithDoctor(doctorId) {
    App.navigateTo('appointment-booking');
    if (window.AppointmentsModule) {
      AppointmentsModule.selectDoctorForBooking(doctorId);
    }
  },

  async toggleAvailability(doctorId, newStatus) {
    try {
      const res = await fetch(`/api/doctors/${doctorId}/toggle-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: newStatus })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast(json.message, 'success');
      this.loadDoctors();
      if (window.DashboardModule) {
        DashboardModule.loadMetrics();
        DashboardModule.loadDeptAvailability();
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  // ==========================================
  // ADD NEW DOCTOR MODAL
  // ==========================================
  setupAddDoctorForm() {
    const addBtn = document.getElementById('btn-add-new-doctor');
    const addForm = document.getElementById('form-add-doctor');

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (addForm) addForm.reset();
        App.openModal('modal-add-doctor');
      });
    }

    if (addForm) {
      addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddDoctorSubmit(addForm);
      });
    }
  },

  async handleAddDoctorSubmit(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    const data = {
      name: document.getElementById('add-doctor-name').value.trim(),
      gender: document.getElementById('add-doctor-gender').value,
      department_id: document.getElementById('add-doctor-dept').value,
      specialization: document.getElementById('add-doctor-spec').value.trim(),
      qualification: document.getElementById('add-doctor-qual').value.trim(),
      experience: document.getElementById('add-doctor-exp').value,
      consultation_fee: document.getElementById('add-doctor-fee').value,
      mobile: document.getElementById('add-doctor-mobile').value.trim(),
      email: document.getElementById('add-doctor-email').value.trim(),
      image_url: document.getElementById('add-doctor-image').value.trim(),
      available_days: document.getElementById('add-doctor-days').value.trim(),
      working_hours: document.getElementById('add-doctor-hours').value.trim(),
      break_time: document.getElementById('add-doctor-break').value.trim(),
      is_available: 1
    };

    if (!data.name || !data.department_id || !data.specialization || !data.qualification) {
      App.showToast('Please fill all required doctor details.', 'error');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Doctor...';

      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast(`Dr. ${json.data.name} added successfully!`, 'success');
      App.closeModal('modal-add-doctor');
      form.reset();
      this.loadDoctors();
      this.loadDepartments();
      if (window.DashboardModule) DashboardModule.loadMetrics();

    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  },

  // ==========================================
  // EDIT DOCTOR MODAL
  // ==========================================
  setupEditDoctorForm() {
    const editForm = document.getElementById('form-edit-doctor');
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleEditDoctorSubmit();
      });
    }
  },

  async openEditDoctorModal(doctorId) {
    try {
      const res = await fetch(`/api/doctors/${doctorId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const doc = json.data;

      document.getElementById('edit-doctor-pk').value = doc.id;
      document.getElementById('edit-doctor-id-display').textContent = doc.doctor_id;
      document.getElementById('edit-doctor-name').value = doc.name;
      document.getElementById('edit-doctor-gender').value = doc.gender;
      document.getElementById('edit-doctor-dept').value = doc.department_id;
      document.getElementById('edit-doctor-spec').value = doc.specialization;
      document.getElementById('edit-doctor-qual').value = doc.qualification;
      document.getElementById('edit-doctor-exp').value = doc.experience;
      document.getElementById('edit-doctor-fee').value = doc.consultation_fee;
      document.getElementById('edit-doctor-mobile').value = doc.mobile;
      document.getElementById('edit-doctor-email').value = doc.email;
      document.getElementById('edit-doctor-image').value = doc.image_url || '';
      document.getElementById('edit-doctor-days').value = doc.available_days;
      document.getElementById('edit-doctor-hours').value = doc.working_hours;
      document.getElementById('edit-doctor-break').value = doc.break_time || '';
      document.getElementById('edit-doctor-available-toggle').checked = doc.is_available === 1;

      App.openModal('modal-edit-doctor');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async handleEditDoctorSubmit() {
    const pk = document.getElementById('edit-doctor-pk').value;
    const data = {
      name: document.getElementById('edit-doctor-name').value.trim(),
      gender: document.getElementById('edit-doctor-gender').value,
      department_id: document.getElementById('edit-doctor-dept').value,
      specialization: document.getElementById('edit-doctor-spec').value.trim(),
      qualification: document.getElementById('edit-doctor-qual').value.trim(),
      experience: document.getElementById('edit-doctor-exp').value,
      consultation_fee: document.getElementById('edit-doctor-fee').value,
      mobile: document.getElementById('edit-doctor-mobile').value.trim(),
      email: document.getElementById('edit-doctor-email').value.trim(),
      image_url: document.getElementById('edit-doctor-image').value.trim(),
      available_days: document.getElementById('edit-doctor-days').value.trim(),
      working_hours: document.getElementById('edit-doctor-hours').value.trim(),
      break_time: document.getElementById('edit-doctor-break').value.trim(),
      is_available: document.getElementById('edit-doctor-available-toggle').checked ? 1 : 0
    };

    try {
      const res = await fetch(`/api/doctors/${pk}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast('Doctor profile updated successfully!', 'success');
      App.closeModal('modal-edit-doctor');
      this.loadDoctors();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }
};

window.DoctorsModule = DoctorsModule;

