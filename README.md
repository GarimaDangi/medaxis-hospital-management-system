# MEDAXIS – Smart Hospital Management System (Admin Portal)

MEDAXIS is a full-featured, professional web-based Hospital Management System exclusively designed as an **Admin Portal** for hospital administrators, clinical heads, nursing supervisors, pharmacists, and billing officers.

---

## 🏥 Key Features & Modules

### 1. Centralized Executive Dashboard
- **Dynamic KPI Summary Cards:**
  - Total Registered Patients
  - Total Doctors & Active Faculty On Duty
  - Today's Appointments & Completed Consultations
  - Pending Appointments
  - Total Hospital Revenue & Unsettled Invoices
  - Pharmacy Stock Level & Alert Counters
- **Chart.js Visual Representations:**
  - 7-Day Clinical Volume & Revenue Collection Trend (Line Chart)
  - Appointment Status Distribution (Doughnut Chart)
  - Cumulative Department-wise Revenue Breakdown (Bar Chart)
- **Live Operational Widgets:**
  - Today's Appointment Queue with real-time status and quick actions
  - Recently Registered Patients
  - Department-wise Doctor Availability
  - Recent Billing Transactions with quick print actions
- **Automatic & Manual Refresh:** All metrics reflect live changes from SQLite.

### 2. Register New Patient Module
- Clean, structured form collecting comprehensive patient details:
  - **Personal Details:** Full Name, Date of Birth, Age (auto-calculated from DOB), Gender, Blood Group.
  - **Contact Details:** Email ID, 10-digit Indian Mobile Number (+91 format), Street Address, City, State, 6-digit Indian PIN Code.
  - **Clinical Intake:** Emergency Contact / Relative details, Allergies & Chronic Conditions.
- **Unique Permanent Patient ID Generation:** Automatically assigns sequentially unique IDs (e.g. `PAT-2026-0001`).
- **Input Validation:** Strict Indian mobile and PIN format regex, age bounds, email validation.
- **Success Modal:** Prompts immediate next actions: "View Patient Profile", "Book Appointment Now", or "Register Another".

### 3. Patient Details & Electronic Health Records (EHR)
- **Searchable & Filterable Directory:** Search by Name, Patient ID, or Phone; filter by Gender and Blood Group.
- **Multi-Tab Detailed Patient Profile (7 Sections):**
  1. Personal Information (Full name, DOB, age, gender, blood group, registration date)
  2. Contact Information (Phone, email, address, city, state, PIN code)
  3. Appointment History (Chronological timeline with specialist, department, fee, and status)
  4. Laboratory Reports (Test name, reference range, test result, normal/abnormal badge, remarks)
  5. Digital Prescriptions (Prescribing specialist, diagnosis, medication name, dosage, timing, duration)
  6. Billing History (Bill ID, invoice dates, breakdown, payment mode, status, print invoice)
  7. Medical History (Chronic conditions, known drug allergies, surgical notes)
- **Edit Patient Modal:** Allows full editing and SQLite persistence.

### 4. Doctor Management Module
- **11 Clinical Departments:**
  - General Medicine, Cardiology, Neurology, Orthopedics, Dermatology, Pediatrics, Gynecology, ENT, Ophthalmology, Dentistry, General Surgery.
- **Specialist Profiles:** Qualification (MBBS, MD, DM, MCh), years of experience, consultation fee, mobile, email, and clinic working hours.
- **Availability & Schedule Management:**
  - Working days and hours
  - Break time scheduling
  - "Available / On Leave" one-click status toggle with instant database sync.
- **Doctor Directory Management:** Add new doctors, edit existing doctors, search by name or specialization, and filter department-wise.

### 5. Appointment Booking & Queue Management
- **Three Sub-Sections:**
  - **Book Appointment Wizard:**
    1. Search & select existing patient (auto-populates demographic and clinical alerts)
    2. Select Department -> Dynamically loads active doctors in that department
    3. Select Doctor -> Displays qualifications, experience, and consultation fees
    4. Select Date (with today/future restriction)
    5. Real-time 30-minute slot availability engine (identifies booked slots, excludes them, and strictly prevents double-booking!)
    6. Confirm appointment -> Assigns unique Appointment ID (e.g. `APT-2026-0001`)
  - **Manage Active Appointments:** Filter by status (Scheduled, Rescheduled, Completed), search by patient, mark completed, or reschedule.
  - **Reschedule Appointment:** Select new date and available slot avoiding conflicts.
  - **Cancelled Appointments Archive:** Tracks cancellation reason and allows 1-click rebooking.

### 6. Pharmacy Management & Inventory
- **Real-Time Stock Status Engine:**
  - **In Stock:** Sufficient inventory (> minimum threshold)
  - **Low Stock Alert:** Quantity between 1 and threshold
  - **Out of Stock Alert:** Quantity reaches 0
  - **Expiring Soon Alert:** Expiration date within 60 days
  - **Expired Batch Alert:** Expiration date is in the past
- **Operations:** Add new medicines, edit details, and adjust stock quantities (+ receive, - deduct, = set).
- **Search & Filters:** Search by name, batch number, or ID; filter by pharmaceutical category and status.

### 7. Billing & Payment Module
- **Itemized Hospital Invoicing:**
  - 1. Physician Consultation Fees
  - 2. Laboratory Investigation Charges
  - 3. Pharmacy & Medication Charges
  - 4. Hospital Care & Facility Charges
  - Concession / Discount application
- **Payment Processing:** Supports Cash, UPI (GPay, PhonePe, Paytm), Debit Card, Credit Card, and Net Banking.
- **Payment Statuses:** Paid in Full, Pending Payment, Partially Paid.
- **Printable Hospital Tax Receipt:**
  - MEDAXIS hospital branding, ISO accreditation, GSTIN, and registration details.
  - Patient demographic particulars and attending specialist info.
  - Itemized table with rates and amounts.
  - Authentic "PAID" verification stamp and signature lines.
  - Dedicated `@media print` print-ready design and standalone print route (`/invoice/print/<bill_id>`).

---

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3, Modern JavaScript (Vanilla ES6+ SPA architecture, no React/Angular needed)
- **Backend:** Python with Flask REST API
- **Database:** SQLite (`medaxis.db`) with Foreign Key constraints and complete seed data
- **Icons:** Font Awesome 6
- **Data Visualization:** Chart.js 4

---

## 🚀 How to Run

### Method 1: Using the One-Click Batch Script (Windows)
Double-click `run.bat` in the project root directory. It will automatically start the Flask server and open your browser to `http://127.0.0.1:5000`.

### Method 2: Manual Command Line
1. Open terminal in the project folder:
   ```powershell
   & "C:\Users\thega\anaconda3\python.exe" app.py
   ```
2. Open your web browser and navigate to:
   ```
   http://127.0.0.1:5000
   ```
