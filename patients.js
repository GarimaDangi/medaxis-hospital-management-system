/**
 * MEDAXIS - Hospital Management System
 * Patient Management Module: Registration, Patient List, Search/Filter, Full Profile & Edit
 */

const PatientsModule = {
  patientsList: [],
  currentPatientProfile: null,

  init() {
    this.setupRegistrationForm();
    this.setupSearchAndFilters();
    this.setupEditForm();
    this.loadNextPatientIdPreview();
  },

  // ==========================================
  // PATIENT REGISTRATION
  // ==========================================
  setupRegistrationForm() {
    const dobInput = document.getElementById('reg-dob');
    const ageInput = document.getElementById('reg-age');
    const regForm = document.getElementById('form-register-patient');
    const clearBtn = document.getElementById('btn-clear-patient-form');

    // Auto calculate age from DOB
    if (dobInput && ageInput) {
      dobInput.addEventListener('change', () => {
        const dobVal = dobInput.value;
        if (!dobVal) {
          ageInput.value = '';
          return;
        }
        const birthDate = new Date(dobVal);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        ageInput.value = Math.max(0, age);
      });
    }

    // Form Submission
    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handlePatientRegistration(regForm);
      });
    }

    // Clear form button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (regForm) regForm.reset();
        this.loadNextPatientIdPreview();
        App.showToast('Registration form reset.', 'info');
      });
    }
  },

  async loadNextPatientIdPreview() {
    const badge = document.getElementById('reg-preview-patient-id');
    if (!badge) return;
    try {
      const res = await fetch('/api/patients/next-id');
      const json = await res.json();
      if (json.success) {
        badge.textContent = json.next_id;
      }
    } catch (err) {
      console.error("Error fetching next patient id preview:", err);
    }
  },

  async handlePatientRegistration(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Save & Register Patient';

    const formData = {
      full_name: document.getElementById('reg-full-name').value.trim(),
      dob: document.getElementById('reg-dob').value,
      age: document.getElementById('reg-age').value,
      gender: document.getElementById('reg-gender').value,
      blood_group: document.getElementById('reg-blood-group').value,
      email: document.getElementById('reg-email').value.trim(),
      mobile: document.getElementById('reg-mobile').value.trim(),
      address: document.getElementById('reg-address').value.trim(),
      city: document.getElementById('reg-city').value.trim(),
      state: document.getElementById('reg-state').value.trim(),
      pincode: document.getElementById('reg-pincode').value.trim(),
      emergency_contact: document.getElementById('reg-emergency-contact').value.trim(),
      medical_history: document.getElementById('reg-medical-history').value.trim()
    };

    // Client-side validation checks
    if (!formData.full_name) {
      App.showToast('Please enter the patient full name.', 'error');
      return;
    }
    if (!formData.dob) {
      App.showToast('Please select the patient date of birth.', 'error');
      return;
    }
    if (!formData.gender) {
      App.showToast('Please select the gender.', 'error');
      return;
    }
    if (!formData.blood_group) {
      App.showToast('Please select the blood group.', 'error');
      return;
    }

    // Indian 10-digit mobile validation
    const cleanMobile = formData.mobile.replace(/[\s\-\+]/g, '').replace(/^91/, '').replace(/^0/, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      App.showToast('Please enter a valid 10-digit Indian mobile number (e.g., 9820194820).', 'error');
      document.getElementById('reg-mobile').focus();
      return;
    }

    // Indian 6-digit PIN code validation
    const cleanPin = formData.pincode.replace(/[\s\-]/g, '');
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      App.showToast('Please enter a valid 6-digit Indian PIN code (e.g., 400001).', 'error');
      document.getElementById('reg-pincode').focus();
      return;
    }

    // Email validation
    if (!/^[\w\.-]+@[\w\.-]+\.\w{2,}$/.test(formData.email)) {
      App.showToast('Please enter a valid email address.', 'error');
      document.getElementById('reg-email').focus();
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Patient...';
      }

      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Registration failed');
      }

      const patient = json.data;

      // Show success modal dialog with options
      this.showRegistrationSuccessModal(patient);
      form.reset();
      this.loadNextPatientIdPreview();

      // Refresh dashboard if needed
      if (window.DashboardModule) DashboardModule.loadMetrics();

    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  },

  showRegistrationSuccessModal(patient) {
    const modalContent = document.getElementById('reg-success-modal-body');
    if (modalContent) {
      modalContent.innerHTML = `
        <div style="text-align: center; padding: 1.5rem 0;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--success-bg); color: var(--success); display: inline-flex; align-items: center; justify-content: center; font-size: 2rem; margin-bottom: 1rem;">
            <i class="fa-solid fa-check"></i>
          </div>
          <h3 style="font-size: 1.4rem; color: var(--navy-primary); margin-bottom: 0.5rem;">Patient Registered Successfully!</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Permanent Medical Record Number generated:</p>
          <div style="display: inline-block; background: var(--blue-light); color: var(--blue-primary); padding: 0.6rem 1.4rem; border-radius: 8px; font-size: 1.5rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; margin: 1rem 0; letter-spacing: 1px;">
            ${patient.patient_id}
          </div>
          <div style="background: var(--bg-main); border: 1px solid var(--border-light); border-radius: 8px; padding: 1rem; max-width: 400px; margin: 0 auto; text-align: left; font-size: 0.88rem;">
            <div><strong>Patient Name:</strong> ${patient.full_name}</div>
            <div><strong>Age / Gender:</strong> ${patient.age} yrs / ${patient.gender}</div>
            <div><strong>Blood Group:</strong> <span class="badge badge-teal">${patient.blood_group}</span></div>
            <div><strong>Contact:</strong> ${patient.mobile}</div>
          </div>
        </div>
      `;
    }

    const viewProfileBtn = document.getElementById('reg-success-view-profile-btn');
    if (viewProfileBtn) {
      viewProfileBtn.onclick = () => {
        App.closeModal('modal-reg-success');
        PatientsModule.openPatientProfileModal(patient.patient_id);
      };
    }

    const bookAptBtn = document.getElementById('reg-success-book-apt-btn');
    if (bookAptBtn) {
      bookAptBtn.onclick = () => {
        App.closeModal('modal-reg-success');
        App.navigateTo('appointment-booking');
        if (window.AppointmentsModule) {
          AppointmentsModule.selectPatientForBooking(patient);
        }
      };
    }

    App.openModal('modal-reg-success');
  },

  // ==========================================
  // PATIENT DETAILS TABLE & SEARCH/FILTERS
  // ==========================================
  setupSearchAndFilters() {
    const searchInput = document.getElementById('patients-search-input');
    const genderFilter = document.getElementById('patients-filter-gender');
    const bloodFilter = document.getElementById('patients-filter-blood');

    let debounce = null;
    const triggerSearch = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => this.loadPatients(), 300);
    };

    if (searchInput) searchInput.addEventListener('input', triggerSearch);
    if (genderFilter) genderFilter.addEventListener('change', triggerSearch);
    if (bloodFilter) bloodFilter.addEventListener('change', triggerSearch);
  },

  async loadPatients() {
    const tbody = document.getElementById('patients-table-tbody');
    const countBadge = document.getElementById('patients-total-count-badge');
    if (!tbody) return;

    const search = (document.getElementById('patients-search-input')?.value || '').trim();
    const gender = document.getElementById('patients-filter-gender')?.value || '';
    const blood = document.getElementById('patients-filter-blood')?.value || '';

    try {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading registered patients...</td></tr>`;

      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (gender && gender !== 'All') params.append('gender', gender);
      if (blood && blood !== 'All') params.append('blood_group', blood);

      const res = await fetch(`/api/patients?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      this.patientsList = json.data;
      if (countBadge) countBadge.textContent = `${json.data.length} Patients`;

      if (this.patientsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No patient records matched the specified filters.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.patientsList.map(p => `
        <tr>
          <td>
            <span class="badge badge-teal" style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${p.patient_id}</span>
          </td>
          <td>
            <div class="patient-cell">
              <div class="avatar-sm" style="background: var(--blue-light); color: var(--blue-primary);">${p.full_name.charAt(0)}</div>
              <div>
                <div class="cell-title" style="cursor: pointer;" onclick="PatientsModule.openPatientProfileModal('${p.patient_id}')">
                  <a href="javascript:void(0)" style="color: var(--blue-primary); text-decoration: underline;">${p.full_name}</a>
                </div>
                <div class="cell-sub">${p.city}, ${p.state}</div>
              </div>
            </div>
          </td>
          <td>${p.age} yrs</td>
          <td>${p.gender}</td>
          <td>
            <span class="badge badge-neutral"><i class="fa-solid fa-droplet" style="color: #ef4444;"></i> ${p.blood_group}</span>
          </td>
          <td>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">📞 ${p.mobile}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${p.email}</div>
          </td>
          <td>${App.formatDate(p.created_at)}</td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-secondary btn-sm" title="View Full Profile" onclick="PatientsModule.openPatientProfileModal('${p.patient_id}')">
                <i class="fa-solid fa-address-card"></i> View Details
              </button>
              <button class="btn btn-secondary btn-sm" title="Edit Patient Info" onclick="PatientsModule.openEditPatientModal('${p.patient_id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error("Error loading patients:", err);
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 1.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load patients. <button class="btn btn-secondary btn-sm" onclick="PatientsModule.loadPatients()" style="margin-left: 8px;">Retry</button></td></tr>`;
    }
  },

  // ==========================================
  // INDIVIDUAL PATIENT PROFILE MODAL (7 TABS)
  // ==========================================
  async openPatientProfileModal(patientId) {
    try {
      const res = await fetch(`/api/patients/${patientId}/profile`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      this.currentPatientProfile = json.data;
      const { patient, appointments, lab_reports, prescriptions, bills } = this.currentPatientProfile;

      // Header info
      document.getElementById('modal-profile-patient-name').textContent = patient.full_name;
      document.getElementById('modal-profile-patient-id').textContent = patient.patient_id;
      document.getElementById('modal-profile-demographics').textContent = `${patient.gender} • ${patient.age} years old • Blood: ${patient.blood_group}`;
      document.getElementById('modal-profile-contact-badge').textContent = `📞 ${patient.mobile} | ✉️ ${patient.email}`;

      // Tab 1: Personal Information
      const tabPersonal = document.getElementById('profile-tab-personal');
      if (tabPersonal) {
        tabPersonal.innerHTML = `
          <div class="card" style="padding: 1.25rem; background: var(--bg-main);">
            <div class="form-grid-3">
              <div><span class="detail-label">Full Name:</span><div class="detail-val">${patient.full_name}</div></div>
              <div><span class="detail-label">Date of Birth:</span><div class="detail-val">${patient.dob}</div></div>
              <div><span class="detail-label">Age:</span><div class="detail-val">${patient.age} years</div></div>
              <div><span class="detail-label">Gender:</span><div class="detail-val">${patient.gender}</div></div>
              <div><span class="detail-label">Blood Group:</span><div class="detail-val"><span class="badge badge-teal">${patient.blood_group}</span></div></div>
              <div><span class="detail-label">Registration Date:</span><div class="detail-val">${App.formatDate(patient.created_at)}</div></div>
            </div>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-light);">
              <span class="detail-label">Emergency Contact / Guardian:</span>
              <div class="detail-val" style="font-size: 0.95rem; margin-top: 0.2rem; color: var(--navy-secondary);">${patient.emergency_contact || 'None registered'}</div>
            </div>
          </div>
        `;
      }

      // Tab 2: Contact Information
      const tabContact = document.getElementById('profile-tab-contact');
      if (tabContact) {
        tabContact.innerHTML = `
          <div class="card" style="padding: 1.25rem; background: var(--bg-main);">
            <div class="form-grid-2">
              <div><span class="detail-label">Mobile Number:</span><div class="detail-val">📞 +91 ${patient.mobile}</div></div>
              <div><span class="detail-label">Email ID:</span><div class="detail-val">✉️ ${patient.email}</div></div>
              <div style="grid-column: 1 / -1;"><span class="detail-label">Residential Address:</span><div class="detail-val">${patient.address}</div></div>
              <div><span class="detail-label">City:</span><div class="detail-val">${patient.city}</div></div>
              <div><span class="detail-label">State:</span><div class="detail-val">${patient.state}</div></div>
              <div><span class="detail-label">PIN Code:</span><div class="detail-val">${patient.pincode}</div></div>
            </div>
          </div>
        `;
      }

      // Tab 3: Appointment History (Chronological)
      const tabAppointments = document.getElementById('profile-tab-appointments');
      if (tabAppointments) {
        if (!appointments || appointments.length === 0) {
          tabAppointments.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No clinical appointments found for this patient.</div>`;
        } else {
          tabAppointments.innerHTML = `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Doctor</th>
                    <th>Department</th>
                    <th>Reason / Symptoms</th>
                    <th>Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${appointments.map(a => {
                    let stBadge = 'badge-info';
                    if (a.status === 'Completed') stBadge = 'badge-success';
                    if (a.status === 'Cancelled') stBadge = 'badge-danger';
                    if (a.status === 'Rescheduled') stBadge = 'badge-warning';

                    return `
                      <tr>
                        <td><strong>${a.appointment_date}</strong><div style="font-size: 0.75rem; color: var(--text-muted);">${a.appointment_time}</div></td>
                        <td>${a.doctor_name}</td>
                        <td><span class="badge badge-teal">${a.department_name}</span></td>
                        <td>${a.reason || '-'}</td>
                        <td>${App.formatCurrency(a.consultation_fee)}</td>
                        <td><span class="badge ${stBadge}">${a.status}</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }

      // Tab 4: Laboratory Reports
      const tabLabs = document.getElementById('profile-tab-labs');
      if (tabLabs) {
        if (!lab_reports || lab_reports.length === 0) {
          tabLabs.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No laboratory reports recorded.</div>`;
        } else {
          tabLabs.innerHTML = `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Test Name</th>
                    <th>Normal Reference</th>
                    <th>Result</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  ${lab_reports.map(l => {
                    let st = l.status === 'Normal' ? 'badge-success' : (l.status === 'Abnormal' ? 'badge-danger' : 'badge-info');
                    return `
                      <tr>
                        <td>${l.report_date}</td>
                        <td><strong>${l.test_name}</strong></td>
                        <td>${l.normal_range || '-'}</td>
                        <td><strong style="color: ${l.status === 'Abnormal' ? '#ef4444' : 'inherit'};">${l.test_result}</strong></td>
                        <td><span class="badge ${st}">${l.status}</span></td>
                        <td><span style="font-size: 0.78rem; color: var(--text-muted);">${l.remarks || '-'}</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }

      // Tab 5: Prescriptions
      const tabPrescriptions = document.getElementById('profile-tab-prescriptions');
      if (tabPrescriptions) {
        if (!prescriptions || prescriptions.length === 0) {
          tabPrescriptions.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No digital prescriptions issued yet.</div>`;
        } else {
          tabPrescriptions.innerHTML = prescriptions.map(pr => `
            <div class="card" style="margin-bottom: 1rem; border-left: 4px solid var(--blue-primary); padding: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <div>
                  <h4 style="font-size: 1.05rem; color: var(--navy-primary); margin: 0;">Diagnosis: ${pr.diagnosis}</h4>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">Prescribed by <strong>${pr.doctor_name}</strong> (${pr.department_name}) on ${App.formatDate(pr.created_at)}</div>
                </div>
                <span class="badge badge-info"><i class="fa-solid fa-file-prescription"></i> Rx Valid</span>
              </div>
              
              <div class="table-responsive">
                <table class="data-table" style="background: #ffffff;">
                  <thead>
                    <tr>
                      <th>Medicine Name</th>
                      <th>Dosage</th>
                      <th>Frequency / Timing</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(pr.medicines || []).map(m => `
                      <tr>
                        <td><strong>${m.name}</strong></td>
                        <td>${m.dosage}</td>
                        <td>${m.timing}</td>
                        <td>${m.duration}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              ${pr.instructions ? `<div style="margin-top: 0.65rem; font-size: 0.8rem; background: var(--bg-main); padding: 0.6rem; border-radius: 6px;"><strong>Physician Instructions:</strong> ${pr.instructions}</div>` : ''}
            </div>
          `).join('');
        }
      }

      // Tab 6: Billing History
      const tabBilling = document.getElementById('profile-tab-billing');
      if (tabBilling) {
        if (!bills || bills.length === 0) {
          tabBilling.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No billing history on record.</div>`;
        } else {
          tabBilling.innerHTML = `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Bill ID</th>
                    <th>Date</th>
                    <th>Doctor</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${bills.map(b => {
                    let bBadge = b.payment_status === 'Paid' ? 'badge-success' : (b.payment_status === 'Pending' ? 'badge-danger' : 'badge-warning');
                    return `
                      <tr>
                        <td><strong style="font-family: 'JetBrains Mono', monospace; color: var(--blue-primary);">${b.bill_id}</strong></td>
                        <td>${b.payment_date || App.formatDate(b.created_at)}</td>
                        <td>${b.doctor_name || 'General Outpatient'}</td>
                        <td>${App.formatCurrency(b.total_amount)}</td>
                        <td>${App.formatCurrency(b.paid_amount)}</td>
                        <td>${b.payment_method}</td>
                        <td><span class="badge ${bBadge}">${b.payment_status}</span></td>
                        <td>
                          <button class="btn btn-secondary btn-sm" onclick="BillingModule.openPrintInvoiceModal('${b.bill_id}')">
                            <i class="fa-solid fa-print"></i> Invoice
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }

      // Tab 7: Medical History
      const tabMedical = document.getElementById('profile-tab-medical');
      if (tabMedical) {
        tabMedical.innerHTML = `
          <div class="card" style="padding: 1.25rem; background: var(--bg-main);">
            <h4 style="font-size: 0.95rem; color: var(--navy-primary); margin-bottom: 0.65rem;">Known Chronic Conditions & Clinical Notes</h4>
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: 8px; padding: 1rem; font-size: 0.9rem; line-height: 1.6; color: var(--navy-secondary);">
              ${patient.medical_history ? patient.medical_history : 'No chronic allergies or medical alerts documented for this patient.'}
            </div>
          </div>
        `;
      }

      // Reset to Tab 1 active
      this.switchProfileTab('personal');

      // Set profile action buttons
      const bookAptBtn = document.getElementById('profile-modal-book-apt-btn');
      if (bookAptBtn) {
        bookAptBtn.onclick = () => {
          App.closeModal('modal-patient-profile');
          App.navigateTo('appointment-booking');
          if (window.AppointmentsModule) {
            AppointmentsModule.selectPatientForBooking(patient);
          }
        };
      }

      const createBillBtn = document.getElementById('profile-modal-create-bill-btn');
      if (createBillBtn) {
        createBillBtn.onclick = () => {
          App.closeModal('modal-patient-profile');
          App.navigateTo('billing-payment');
          if (window.BillingModule) {
            BillingModule.selectPatientForBill(patient);
          }
        };
      }

      App.openModal('modal-patient-profile');

    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  switchProfileTab(tabName) {
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-profile-tab') === tabName);
    });

    document.querySelectorAll('.profile-tab-content').forEach(pane => {
      pane.style.display = pane.id === `profile-tab-${tabName}` ? 'block' : 'none';
    });
  },

  // ==========================================
  // EDIT PATIENT MODAL
  // ==========================================
  setupEditForm() {
    const editForm = document.getElementById('form-edit-patient');
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handlePatientUpdate();
      });
    }
  },

  async openEditPatientModal(patientId) {
    try {
      const res = await fetch(`/api/patients/${patientId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const p = json.data;

      document.getElementById('edit-patient-pk').value = p.id;
      document.getElementById('edit-patient-id-display').textContent = p.patient_id;
      document.getElementById('edit-full-name').value = p.full_name;
      document.getElementById('edit-dob').value = p.dob;
      document.getElementById('edit-age').value = p.age;
      document.getElementById('edit-gender').value = p.gender;
      document.getElementById('edit-blood-group').value = p.blood_group;
      document.getElementById('edit-email').value = p.email;
      document.getElementById('edit-mobile').value = p.mobile;
      document.getElementById('edit-address').value = p.address;
      document.getElementById('edit-city').value = p.city;
      document.getElementById('edit-state').value = p.state;
      document.getElementById('edit-pincode').value = p.pincode;
      document.getElementById('edit-emergency-contact').value = p.emergency_contact || '';
      document.getElementById('edit-medical-history').value = p.medical_history || '';

      App.openModal('modal-edit-patient');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async handlePatientUpdate() {
    const pk = document.getElementById('edit-patient-pk').value;
    const formData = {
      full_name: document.getElementById('edit-full-name').value.trim(),
      dob: document.getElementById('edit-dob').value,
      gender: document.getElementById('edit-gender').value,
      blood_group: document.getElementById('edit-blood-group').value,
      email: document.getElementById('edit-email').value.trim(),
      mobile: document.getElementById('edit-mobile').value.trim(),
      address: document.getElementById('edit-address').value.trim(),
      city: document.getElementById('edit-city').value.trim(),
      state: document.getElementById('edit-state').value.trim(),
      pincode: document.getElementById('edit-pincode').value.trim(),
      emergency_contact: document.getElementById('edit-emergency-contact').value.trim(),
      medical_history: document.getElementById('edit-medical-history').value.trim()
    };

    try {
      const res = await fetch(`/api/patients/${pk}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      App.showToast('Patient details updated successfully!', 'success');
      App.closeModal('modal-edit-patient');
      this.loadPatients();
      if (window.DashboardModule) DashboardModule.loadRecentPatients();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }
};

window.PatientsModule = PatientsModule;

