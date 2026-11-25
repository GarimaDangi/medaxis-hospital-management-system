"""
MEDAXIS - Hospital Management System
Data Access Layer & Business Logic Functions
"""

import sqlite3
import json
import re
from datetime import datetime, date, timedelta
from database import get_db_connection

# ==========================================
# VALIDATION HELPERS
# ==========================================

def validate_indian_mobile(mobile_str):
    """Validates 10-digit Indian mobile number (optionally with +91 or 0 prefix)."""
    cleaned = re.sub(r'[\s\-\+]', '', str(mobile_str))
    if cleaned.startswith('91') and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith('0') and len(cleaned) == 11:
        cleaned = cleaned[1:]
    return bool(re.match(r'^[6-9]\d{9}$', cleaned)), cleaned

def validate_indian_pincode(pincode_str):
    """Validates 6-digit Indian PIN code."""
    cleaned = re.sub(r'[\s\-]', '', str(pincode_str))
    return bool(re.match(r'^[1-9][0-9]{5}$', cleaned)), cleaned

def validate_email(email_str):
    """Validates email format."""
    return bool(re.match(r'^[\w\.-]+@[\w\.-]+\.\w{2,}$', str(email_str).strip()))

def calculate_age_from_dob(dob_str):
    """Calculates age accurately based on Date of Birth string (YYYY-MM-DD)."""
    try:
        birth_date = datetime.strptime(str(dob_str).strip(), '%Y-%m-%d').date()
        today = date.today()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        return max(0, age)
    except Exception:
        return 0

# ==========================================
# DASHBOARD METRICS & CHARTS
# ==========================================

def get_dashboard_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    today_str = date.today().strftime('%Y-%m-%d')

    # Total Registered Patients
    total_patients = cursor.execute("SELECT COUNT(*) FROM patients").fetchone()[0]

    # Doctors (Total & Available)
    total_doctors = cursor.execute("SELECT COUNT(*) FROM doctors").fetchone()[0]
    available_doctors = cursor.execute("SELECT COUNT(*) FROM doctors WHERE is_available = 1").fetchone()[0]

    # Today's Appointments
    today_appointments = cursor.execute(
        "SELECT COUNT(*) FROM appointments WHERE appointment_date = ?", (today_str,)
    ).fetchone()[0]
    today_completed = cursor.execute(
        "SELECT COUNT(*) FROM appointments WHERE appointment_date = ? AND status = 'Completed'", (today_str,)
    ).fetchone()[0]

    # Pending Appointments (Scheduled/Rescheduled for today or future)
    pending_appointments = cursor.execute(
        "SELECT COUNT(*) FROM appointments WHERE status IN ('Scheduled', 'Rescheduled') AND appointment_date >= ?", (today_str,)
    ).fetchone()[0]

    # Total Revenue (sum of paid amounts)
    total_revenue = cursor.execute(
        "SELECT COALESCE(SUM(paid_amount), 0) FROM bills WHERE payment_status IN ('Paid', 'Partially Paid')"
    ).fetchone()[0]
    total_pending_revenue = cursor.execute(
        "SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM bills WHERE payment_status IN ('Pending', 'Partially Paid')"
    ).fetchone()[0]

    # Pharmacy Stats
    total_medicines = cursor.execute("SELECT COUNT(*) FROM medicines").fetchone()[0]
    low_stock = cursor.execute("SELECT COUNT(*) FROM medicines WHERE quantity > 0 AND quantity <= min_threshold").fetchone()[0]
    out_of_stock = cursor.execute("SELECT COUNT(*) FROM medicines WHERE quantity = 0").fetchone()[0]
    expired_medicines = cursor.execute("SELECT COUNT(*) FROM medicines WHERE exp_date < ?", (today_str,)).fetchone()[0]
    expiring_soon = cursor.execute(
        "SELECT COUNT(*) FROM medicines WHERE exp_date >= ? AND exp_date <= date(?, '+60 days')", (today_str, today_str)
    ).fetchone()[0]

    conn.close()

    return {
        'total_patients': total_patients,
        'total_doctors': total_doctors,
        'available_doctors': available_doctors,
        'today_appointments': today_appointments,
        'today_completed': today_completed,
        'pending_appointments': pending_appointments,
        'total_revenue': round(total_revenue, 2),
        'total_pending_revenue': round(total_pending_revenue, 2),
        'total_medicines': total_medicines,
        'low_stock': low_stock,
        'out_of_stock': out_of_stock,
        'expired_medicines': expired_medicines,
        'expiring_soon': expiring_soon
    }

def get_dashboard_charts_data():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Appointment status distribution
    status_counts = {'Scheduled': 0, 'Completed': 0, 'Rescheduled': 0, 'Cancelled': 0}
    rows = cursor.execute("SELECT status, COUNT(*) as count FROM appointments GROUP BY status").fetchall()
    for row in rows:
        if row['status'] in status_counts:
            status_counts[row['status']] = row['count']

    # 2. Revenue breakdown by category
    revenue_breakdown = {
        'Consultation': cursor.execute("SELECT COALESCE(SUM(consultation_fee), 0) FROM bills").fetchone()[0],
        'Laboratory': cursor.execute("SELECT COALESCE(SUM(lab_charges), 0) FROM bills").fetchone()[0],
        'Pharmacy': cursor.execute("SELECT COALESCE(SUM(medicine_charges), 0) FROM bills").fetchone()[0],
        'Hospital Care': cursor.execute("SELECT COALESCE(SUM(other_charges), 0) FROM bills").fetchone()[0]
    }

    # 3. Last 7 days appointment trend
    today = date.today()
    trend_labels = []
    trend_appointments = []
    trend_revenue = []

    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime('%Y-%m-%d')
        display_label = day.strftime('%b %d')
        trend_labels.append(display_label)

        # Appointments count for this day
        apt_cnt = cursor.execute("SELECT COUNT(*) FROM appointments WHERE appointment_date = ?", (day_str,)).fetchone()[0]
        trend_appointments.append(apt_cnt)

        # Revenue collected on this day
        rev_amt = cursor.execute("SELECT COALESCE(SUM(paid_amount), 0) FROM bills WHERE payment_date = ?", (day_str,)).fetchone()[0]
        trend_revenue.append(round(rev_amt, 2))

    conn.close()

    return {
        'appointment_status': status_counts,
        'revenue_breakdown': revenue_breakdown,
        'trend_labels': trend_labels,
        'trend_appointments': trend_appointments,
        'trend_revenue': trend_revenue
    }

def get_today_appointments_overview(limit=10):
    conn = get_db_connection()
    today_str = date.today().strftime('%Y-%m-%d')
    query = '''
        SELECT 
            a.id, a.appointment_id, a.appointment_date, a.appointment_time, 
            a.consultation_fee, a.status, a.reason,
            p.id as patient_pk, p.patient_id, p.full_name as patient_name, p.mobile as patient_mobile, p.gender as patient_gender, p.age as patient_age,
            d.id as doctor_pk, d.doctor_id, d.name as doctor_name, d.specialization as doctor_specialization,
            dept.name as department_name, dept.icon as department_icon
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN departments dept ON d.department_id = dept.id
        WHERE a.appointment_date = ?
        ORDER BY a.appointment_time ASC
        LIMIT ?
    '''
    rows = conn.execute(query, (today_str, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_recent_patients(limit=6):
    conn = get_db_connection()
    query = '''
        SELECT id, patient_id, full_name, age, gender, blood_group, mobile, city, state, created_at
        FROM patients
        ORDER BY id DESC
        LIMIT ?
    '''
    rows = conn.execute(query, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_department_doctor_availability():
    conn = get_db_connection()
    query = '''
        SELECT 
            dept.id, dept.name, dept.code, dept.icon,
            COUNT(d.id) as total_doctors,
            SUM(CASE WHEN d.is_available = 1 THEN 1 ELSE 0 END) as available_doctors
        FROM departments dept
        LEFT JOIN doctors d ON dept.id = d.department_id
        GROUP BY dept.id
        ORDER BY dept.name ASC
    '''
    rows = conn.execute(query).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_recent_billing_transactions(limit=6):
    conn = get_db_connection()
    query = '''
        SELECT 
            b.id, b.bill_id, b.total_amount, b.paid_amount, b.payment_method, b.payment_status, b.payment_date, b.created_at,
            p.patient_id, p.full_name as patient_name
        FROM bills b
        JOIN patients p ON b.patient_id = p.id
        ORDER BY b.id DESC
        LIMIT ?
    '''
    rows = conn.execute(query, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ==========================================
# PATIENT MANAGEMENT MODULE
# ==========================================

def generate_patient_id():
    """Generates next sequential unique Patient ID: PAT-YYYY-XXXX."""
    conn = get_db_connection()
    cursor = conn.cursor()
    year = date.today().year
    prefix = f"PAT-{year}-"
    cursor.execute("SELECT patient_id FROM patients WHERE patient_id LIKE ? ORDER BY id DESC LIMIT 1", (f"{prefix}%",))
    row = cursor.fetchone()
    conn.close()
    if row and row['patient_id']:
        last_id = row['patient_id']
        try:
            seq = int(last_id.split('-')[-1]) + 1
        except Exception:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"

def register_patient(data):
    """Registers a new patient with validation and unique Patient ID generation."""
    full_name = data.get('full_name', '').strip()
    dob = data.get('dob', '').strip()
    gender = data.get('gender', '').strip()
    blood_group = data.get('blood_group', '').strip()
    email = data.get('email', '').strip()
    mobile = data.get('mobile', '').strip()
    address = data.get('address', '').strip()
    city = data.get('city', '').strip()
    state = data.get('state', '').strip()
    pincode = data.get('pincode', '').strip()
    emergency_contact = data.get('emergency_contact', '').strip()
    medical_history = data.get('medical_history', '').strip()

    # Validations
    if not full_name:
        raise ValueError("Patient Full Name is required.")
    if not dob:
        raise ValueError("Date of Birth is required.")
    if not gender:
        raise ValueError("Gender is required.")
    if not blood_group:
        raise ValueError("Blood Group is required.")

    valid_email = validate_email(email)
    if not valid_email:
        raise ValueError("Please provide a valid email address.")

    valid_mob, cleaned_mobile = validate_indian_mobile(mobile)
    if not valid_mob:
        raise ValueError("Mobile number must be a valid 10-digit Indian number.")

    valid_pin, cleaned_pin = validate_indian_pincode(pincode)
    if not valid_pin:
        raise ValueError("PIN Code must be a valid 6-digit Indian postal code.")

    age = calculate_age_from_dob(dob)
    if 'age' in data and data['age']:
        try:
            age = int(data['age'])
        except Exception:
            pass

    patient_id = generate_patient_id()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO patients (patient_id, full_name, dob, age, gender, blood_group, email, mobile, address, city, state, pincode, emergency_contact, medical_history)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (patient_id, full_name, dob, age, gender, blood_group, email, cleaned_mobile, address, city, state, cleaned_pin, emergency_contact, medical_history))
    conn.commit()
    new_pk = cursor.lastrowid
    conn.close()

    return {
        'id': new_pk,
        'patient_id': patient_id,
        'full_name': full_name,
        'age': age,
        'gender': gender,
        'blood_group': blood_group,
        'mobile': cleaned_mobile
    }

def get_patients(search='', gender='', blood_group='', page=1, limit=50):
    conn = get_db_connection()
    query = "SELECT * FROM patients WHERE 1=1"
    params = []

    if search:
        search_pattern = f"%{search.strip()}%"
        query += " AND (full_name LIKE ? OR patient_id LIKE ? OR mobile LIKE ? OR email LIKE ? OR city LIKE ?)"
        params.extend([search_pattern, search_pattern, search_pattern, search_pattern, search_pattern])

    if gender and gender != 'All':
        query += " AND gender = ?"
        params.append(gender)

    if blood_group and blood_group != 'All':
        query += " AND blood_group = ?"
        params.append(blood_group)

    query += " ORDER BY id DESC LIMIT ? OFFSET ?"
    offset = (max(1, page) - 1) * limit
    params.extend([limit, offset])

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_patient_by_id(identifier):
    """Fetch patient by primary key or patient_id string."""
    conn = get_db_connection()
    if str(identifier).isdigit():
        row = conn.execute("SELECT * FROM patients WHERE id = ?", (int(identifier),)).fetchone()
    else:
        row = conn.execute("SELECT * FROM patients WHERE patient_id = ?", (str(identifier),)).fetchone()
    conn.close()
    return dict(row) if row else None

def update_patient(patient_id_or_pk, data):
    """Updates an existing patient's details."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Find the patient
    if str(patient_id_or_pk).isdigit():
        row = cursor.execute("SELECT * FROM patients WHERE id = ?", (int(patient_id_or_pk),)).fetchone()
    else:
        row = cursor.execute("SELECT * FROM patients WHERE patient_id = ?", (str(patient_id_or_pk),)).fetchone()

    if not row:
        conn.close()
        raise ValueError(f"Patient with ID {patient_id_or_pk} not found.")

    pk = row['id']
    full_name = data.get('full_name', row['full_name']).strip()
    dob = data.get('dob', row['dob']).strip()
    gender = data.get('gender', row['gender']).strip()
    blood_group = data.get('blood_group', row['blood_group']).strip()
    email = data.get('email', row['email']).strip()
    mobile = data.get('mobile', row['mobile']).strip()
    address = data.get('address', row['address']).strip()
    city = data.get('city', row['city']).strip()
    state = data.get('state', row['state']).strip()
    pincode = data.get('pincode', row['pincode']).strip()
    emergency_contact = data.get('emergency_contact', row['emergency_contact']).strip()
    medical_history = data.get('medical_history', row['medical_history']).strip()

    valid_mob, cleaned_mobile = validate_indian_mobile(mobile)
    if not valid_mob:
        conn.close()
        raise ValueError("Invalid 10-digit Indian mobile number.")

    valid_pin, cleaned_pin = validate_indian_pincode(pincode)
    if not valid_pin:
        conn.close()
        raise ValueError("Invalid 6-digit Indian PIN code.")

    age = calculate_age_from_dob(dob)

    cursor.execute('''
        UPDATE patients
        SET full_name = ?, dob = ?, age = ?, gender = ?, blood_group = ?, email = ?, mobile = ?,
            address = ?, city = ?, state = ?, pincode = ?, emergency_contact = ?, medical_history = ?
        WHERE id = ?
    ''', (full_name, dob, age, gender, blood_group, email, cleaned_mobile, address, city, state, cleaned_pin, emergency_contact, medical_history, pk))
    conn.commit()
    conn.close()
    return get_patient_by_id(pk)

def get_patient_full_profile(identifier):
    """Retrieves all associated tabs for a patient: personal info, appointments, labs, prescriptions, bills."""
    patient = get_patient_by_id(identifier)
    if not patient:
        return None

    pk = patient['id']
    conn = get_db_connection()

    # 1. Appointments (chronological)
    apt_query = '''
        SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization, dept.name as department_name
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN departments dept ON d.department_id = dept.id
        WHERE a.patient_id = ?
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
    '''
    appointments = [dict(r) for r in conn.execute(apt_query, (pk,)).fetchall()]

    # 2. Lab Reports
    lab_query = '''
        SELECT l.*, d.name as doctor_name
        FROM lab_reports l
        LEFT JOIN doctors d ON l.doctor_id = d.id
        WHERE l.patient_id = ?
        ORDER BY l.report_date DESC, l.id DESC
    '''
    lab_reports = [dict(r) for r in conn.execute(lab_query, (pk,)).fetchall()]

    # 3. Prescriptions
    presc_query = '''
        SELECT p.*, d.name as doctor_name, d.specialization as doctor_specialization, dept.name as department_name
        FROM prescriptions p
        JOIN doctors d ON p.doctor_id = d.id
        JOIN departments dept ON d.department_id = dept.id
        WHERE p.patient_id = ?
        ORDER BY p.created_at DESC
    '''
    raw_prescriptions = conn.execute(presc_query, (pk,)).fetchall()
    prescriptions = []
    for r in raw_prescriptions:
        d_item = dict(r)
        try:
            d_item['medicines'] = json.loads(d_item['medicines_json'])
        except Exception:
            d_item['medicines'] = []
        prescriptions.append(d_item)

    # 4. Billing History
    bill_query = '''
        SELECT b.*, d.name as doctor_name
        FROM bills b
        LEFT JOIN doctors d ON b.doctor_id = d.id
        WHERE b.patient_id = ?
        ORDER BY b.created_at DESC
    '''
    bills = [dict(r) for r in conn.execute(bill_query, (pk,)).fetchall()]

    conn.close()

    return {
        'patient': patient,
        'appointments': appointments,
        'lab_reports': lab_reports,
        'prescriptions': prescriptions,
        'bills': bills
    }

# ==========================================
# DOCTOR MANAGEMENT MODULE
# ==========================================

def get_departments():
    conn = get_db_connection()
    query = '''
        SELECT d.*, COUNT(doc.id) as doctor_count
        FROM departments d
        LEFT JOIN doctors doc ON d.id = doc.department_id
        GROUP BY d.id
        ORDER BY d.name ASC
    '''
    rows = conn.execute(query).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_doctors(department_id=None, search='', availability=None):
    conn = get_db_connection()
    query = '''
        SELECT d.*, dept.name as department_name, dept.icon as department_icon
        FROM doctors d
        JOIN departments dept ON d.department_id = dept.id
        WHERE 1=1
    '''
    params = []

    if department_id and str(department_id) != '0' and str(department_id) != 'All':
        query += " AND d.department_id = ?"
        params.append(int(department_id))

    if search:
        search_pattern = f"%{search.strip()}%"
        query += " AND (d.name LIKE ? OR d.specialization LIKE ? OR d.qualification LIKE ? OR d.doctor_id LIKE ?)"
        params.extend([search_pattern, search_pattern, search_pattern, search_pattern])

    if availability is not None and str(availability) != '':
        query += " AND d.is_available = ?"
        params.append(1 if str(availability) in ['1', 'true', 'True', 'Available'] else 0)

    query += " ORDER BY d.id ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_doctor_by_id(doctor_id_or_pk):
    conn = get_db_connection()
    query = '''
        SELECT d.*, dept.name as department_name, dept.icon as department_icon
        FROM doctors d
        JOIN departments dept ON d.department_id = dept.id
        WHERE 
    '''
    if str(doctor_id_or_pk).isdigit():
        query += "d.id = ?"
        param = int(doctor_id_or_pk)
    else:
        query += "d.doctor_id = ?"
        param = str(doctor_id_or_pk)

    row = conn.execute(query, (param,)).fetchone()
    conn.close()
    return dict(row) if row else None

def generate_doctor_id():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT doctor_id FROM doctors ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    if row and row['doctor_id']:
        try:
            seq = int(row['doctor_id'].split('-')[-1]) + 1
        except Exception:
            seq = 101
    else:
        seq = 101
    return f"DOC-{seq:03d}"

def add_doctor(data):
    name = data.get('name', '').strip()
    gender = data.get('gender', '').strip()
    department_id = int(data.get('department_id', 1))
    specialization = data.get('specialization', '').strip()
    qualification = data.get('qualification', '').strip()
    experience = int(data.get('experience', 1))
    consultation_fee = float(data.get('consultation_fee', 500.0))
    mobile = data.get('mobile', '').strip()
    email = data.get('email', '').strip()
    image_url = data.get('image_url', '').strip() or 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300'
    available_days = data.get('available_days', 'Mon, Tue, Wed, Thu, Fri, Sat').strip()
    working_hours = data.get('working_hours', '09:00 AM - 05:00 PM').strip()
    break_time = data.get('break_time', '01:00 PM - 02:00 PM').strip()
    is_available = 1 if data.get('is_available', 1) in [1, '1', True, 'true'] else 0

    if not name:
        raise ValueError("Doctor Name is required.")

    valid_mob, cleaned_mobile = validate_indian_mobile(mobile)
    if not valid_mob:
        raise ValueError("Valid 10-digit Indian mobile number required.")

    doctor_id = generate_doctor_id()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO doctors (doctor_id, name, gender, department_id, specialization, qualification, experience, consultation_fee, mobile, email, image_url, available_days, working_hours, break_time, is_available)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (doctor_id, name, gender, department_id, specialization, qualification, experience, consultation_fee, cleaned_mobile, email, image_url, available_days, working_hours, break_time, is_available))
    conn.commit()
    new_pk = cursor.lastrowid
    conn.close()

    return get_doctor_by_id(new_pk)

def update_doctor(doctor_id_or_pk, data):
    doc = get_doctor_by_id(doctor_id_or_pk)
    if not doc:
        raise ValueError("Doctor not found.")

    pk = doc['id']
    name = data.get('name', doc['name']).strip()
    gender = data.get('gender', doc['gender']).strip()
    department_id = int(data.get('department_id', doc['department_id']))
    specialization = data.get('specialization', doc['specialization']).strip()
    qualification = data.get('qualification', doc['qualification']).strip()
    experience = int(data.get('experience', doc['experience']))
    consultation_fee = float(data.get('consultation_fee', doc['consultation_fee']))
    mobile = data.get('mobile', doc['mobile']).strip()
    email = data.get('email', doc['email']).strip()
    image_url = data.get('image_url', doc['image_url']).strip()
    available_days = data.get('available_days', doc['available_days']).strip()
    working_hours = data.get('working_hours', doc['working_hours']).strip()
    break_time = data.get('break_time', doc['break_time']).strip()
    is_available = 1 if data.get('is_available', doc['is_available']) in [1, '1', True, 'true'] else 0

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE doctors
        SET name = ?, gender = ?, department_id = ?, specialization = ?, qualification = ?,
            experience = ?, consultation_fee = ?, mobile = ?, email = ?, image_url = ?,
            available_days = ?, working_hours = ?, break_time = ?, is_available = ?
        WHERE id = ?
    ''', (name, gender, department_id, specialization, qualification, experience, consultation_fee, mobile, email, image_url, available_days, working_hours, break_time, is_available, pk))
    conn.commit()
    conn.close()

    return get_doctor_by_id(pk)

def toggle_doctor_availability(doctor_id_or_pk, is_available=None):
    doc = get_doctor_by_id(doctor_id_or_pk)
    if not doc:
        raise ValueError("Doctor not found.")

    new_status = 1 if doc['is_available'] == 0 else 0
    if is_available is not None:
        new_status = 1 if is_available in [1, '1', True, 'true'] else 0

    conn = get_db_connection()
    conn.execute("UPDATE doctors SET is_available = ? WHERE id = ?", (new_status, doc['id']))
    conn.commit()
    conn.close()

    doc['is_available'] = new_status
    return doc

# ==========================================
# APPOINTMENT BOOKING MODULE
# ==========================================

def generate_appointment_id():
    conn = get_db_connection()
    cursor = conn.cursor()
    year = date.today().year
    prefix = f"APT-{year}-"
    cursor.execute("SELECT appointment_id FROM appointments WHERE appointment_id LIKE ? ORDER BY id DESC LIMIT 1", (f"{prefix}%",))
    row = cursor.fetchone()
    conn.close()
    if row and row['appointment_id']:
        try:
            seq = int(row['appointment_id'].split('-')[-1]) + 1
        except Exception:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"

def get_doctor_time_slots(doctor_id, target_date_str):
    """
    Returns calculated 30-min time slots for the doctor on the specified date,
    flagging slots that are already booked or during break time to prevent double booking.
    """
    doc = get_doctor_by_id(doctor_id)
    if not doc:
        raise ValueError("Doctor not found.")

    target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
    day_name = target_date.strftime('%a') # Mon, Tue, etc.

    # Check if doctor works on this day
    working_days = [d.strip() for d in doc['available_days'].split(',')]
    is_working_day = any(day_name.lower() in wd.lower() for wd in working_days)

    if not doc['is_available']:
        return {
            'is_available': False,
            'reason': f"{doc['name']} is currently on leave / unavailable.",
            'slots': []
        }

    if not is_working_day:
        return {
            'is_available': False,
            'reason': f"{doc['name']} is not scheduled to work on {target_date.strftime('%A')} ({doc['available_days']}).",
            'slots': []
        }

    # Standard clinic slots from 09:00 AM to 05:00 PM
    all_standard_slots = [
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
        "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
        "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
        "04:00 PM", "04:30 PM", "05:00 PM"
    ]

    # Fetch currently booked slots for this doctor on target_date (excluding cancelled ones)
    conn = get_db_connection()
    booked_rows = conn.execute('''
        SELECT appointment_time, appointment_id, status 
        FROM appointments 
        WHERE doctor_id = ? AND appointment_date = ? AND status != 'Cancelled'
    ''', (doc['id'], target_date_str)).fetchall()
    conn.close()

    booked_times = {row['appointment_time'] for row in booked_rows}

    slots = []
    for slot in all_standard_slots:
        is_booked = slot in booked_times
        slots.append({
            'time': slot,
            'is_available': not is_booked,
            'is_booked': is_booked
        })

    return {
        'is_available': True,
        'doctor_name': doc['name'],
        'consultation_fee': doc['consultation_fee'],
        'date': target_date_str,
        'slots': slots
    }

def book_appointment(data):
    """
    Books an appointment. Validates patient, doctor, and prevents double-booking.
    """
    patient_identifier = data.get('patient_id')
    doctor_identifier = data.get('doctor_id')
    appointment_date = data.get('appointment_date', '').strip()
    appointment_time = data.get('appointment_time', '').strip()
    reason = data.get('reason', '').strip()
    notes = data.get('notes', '').strip()

    if not patient_identifier:
        raise ValueError("Patient selection is required.")
    if not doctor_identifier:
        raise ValueError("Doctor selection is required.")
    if not appointment_date:
        raise ValueError("Appointment Date is required.")
    if not appointment_time:
        raise ValueError("Appointment Time slot is required.")

    patient = get_patient_by_id(patient_identifier)
    if not patient:
        raise ValueError("Selected patient does not exist.")

    doctor = get_doctor_by_id(doctor_identifier)
    if not doctor:
        raise ValueError("Selected doctor does not exist.")

    # Check for double booking
    conn = get_db_connection()
    cursor = conn.cursor()
    conflict = cursor.execute('''
        SELECT id, appointment_id FROM appointments
        WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'Cancelled'
    ''', (doctor['id'], appointment_date, appointment_time)).fetchone()

    if conflict:
        conn.close()
        raise ValueError(f"Time slot {appointment_time} on {appointment_date} is already booked for Dr. {doctor['name']}. Please select an available time slot.")

    appointment_id = generate_appointment_id()
    consultation_fee = doctor['consultation_fee']

    cursor.execute('''
        INSERT INTO appointments (appointment_id, patient_id, doctor_id, appointment_date, appointment_time, consultation_fee, reason, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?)
    ''', (appointment_id, patient['id'], doctor['id'], appointment_date, appointment_time, consultation_fee, reason, notes))
    conn.commit()
    new_pk = cursor.lastrowid
    conn.close()

    return {
        'id': new_pk,
        'appointment_id': appointment_id,
        'patient_name': patient['full_name'],
        'doctor_name': doctor['name'],
        'department_name': doctor['department_name'],
        'appointment_date': appointment_date,
        'appointment_time': appointment_time,
        'consultation_fee': consultation_fee,
        'status': 'Scheduled'
    }

def reschedule_appointment(appointment_id_or_pk, new_date, new_time, reason=''):
    """Reschedules an appointment after verifying the new slot is not occupied."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if str(appointment_id_or_pk).isdigit():
        apt = cursor.execute("SELECT * FROM appointments WHERE id = ?", (int(appointment_id_or_pk),)).fetchone()
    else:
        apt = cursor.execute("SELECT * FROM appointments WHERE appointment_id = ?", (str(appointment_id_or_pk),)).fetchone()

    if not apt:
        conn.close()
        raise ValueError("Appointment not found.")

    # Check if new slot is taken by another appointment
    conflict = cursor.execute('''
        SELECT id FROM appointments 
        WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? 
          AND id != ? AND status != 'Cancelled'
    ''', (apt['doctor_id'], new_date, new_time, apt['id'])).fetchone()

    if conflict:
        conn.close()
        raise ValueError(f"The selected slot {new_time} on {new_date} is already booked.")

    notes = (apt['notes'] or '') + f" [Rescheduled from {apt['appointment_date']} {apt['appointment_time']}. Reason: {reason}]"
    cursor.execute('''
        UPDATE appointments
        SET appointment_date = ?, appointment_time = ?, status = 'Rescheduled', notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (new_date, new_time, notes, apt['id']))
    conn.commit()
    conn.close()

    return {'success': True, 'message': f"Appointment {apt['appointment_id']} successfully rescheduled to {new_date} at {new_time}."}

def cancel_appointment(appointment_id_or_pk, cancellation_reason=''):
    """Cancels an appointment and stores the reason."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if str(appointment_id_or_pk).isdigit():
        apt = cursor.execute("SELECT * FROM appointments WHERE id = ?", (int(appointment_id_or_pk),)).fetchone()
    else:
        apt = cursor.execute("SELECT * FROM appointments WHERE appointment_id = ?", (str(appointment_id_or_pk),)).fetchone()

    if not apt:
        conn.close()
        raise ValueError("Appointment not found.")

    cursor.execute('''
        UPDATE appointments
        SET status = 'Cancelled', cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (cancellation_reason or 'Cancelled by Administrator', apt['id']))
    conn.commit()
    conn.close()

    return {'success': True, 'message': f"Appointment {apt['appointment_id']} has been cancelled."}

def update_appointment_status(appointment_id_or_pk, status):
    """Updates appointment status: Scheduled, Completed, Cancelled, Rescheduled."""
    valid_statuses = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled']
    if status not in valid_statuses:
        raise ValueError(f"Invalid status. Must be one of {valid_statuses}")

    conn = get_db_connection()
    cursor = conn.cursor()
    if str(appointment_id_or_pk).isdigit():
        cursor.execute("UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (status, int(appointment_id_or_pk)))
    else:
        cursor.execute("UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE appointment_id = ?", (status, str(appointment_id_or_pk)))
    conn.commit()
    conn.close()
    return {'success': True, 'status': status}

def get_appointments(status='', date_filter='', search='', page=1, limit=50):
    conn = get_db_connection()
    query = '''
        SELECT 
            a.*,
            p.patient_id, p.full_name as patient_name, p.mobile as patient_mobile, p.gender as patient_gender, p.age as patient_age,
            d.doctor_id, d.name as doctor_name, d.specialization as doctor_specialization,
            dept.name as department_name, dept.icon as department_icon
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN departments dept ON d.department_id = dept.id
        WHERE 1=1
    '''
    params = []

    if status and status != 'All':
        query += " AND a.status = ?"
        params.append(status)

    if date_filter:
        query += " AND a.appointment_date = ?"
        params.append(date_filter)

    if search:
        search_pattern = f"%{search.strip()}%"
        query += " AND (a.appointment_id LIKE ? OR p.full_name LIKE ? OR p.patient_id LIKE ? OR d.name LIKE ? OR dept.name LIKE ?)"
        params.extend([search_pattern, search_pattern, search_pattern, search_pattern, search_pattern])

    query += " ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?"
    offset = (max(1, page) - 1) * limit
    params.extend([limit, offset])

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_cancelled_appointments():
    conn = get_db_connection()
    query = '''
        SELECT 
            a.*,
            p.patient_id, p.full_name as patient_name, p.mobile as patient_mobile,
            d.doctor_id, d.name as doctor_name,
            dept.name as department_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN departments dept ON d.department_id = dept.id
        WHERE a.status = 'Cancelled'
        ORDER BY a.updated_at DESC
    '''
    rows = conn.execute(query).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ==========================================
# PHARMACY MANAGEMENT MODULE
# ==========================================

def calculate_stock_status(quantity, min_threshold, exp_date_str):
    """
    Computes stock status:
    - Expired
    - Out of Stock
    - Low Stock
    - Expiring Soon
    - In Stock
    """
    today = date.today()
    try:
        exp_date = datetime.strptime(str(exp_date_str), '%Y-%m-%d').date()
    except Exception:
        exp_date = today + timedelta(days=365)

    if exp_date < today:
        return 'Expired'
    if quantity == 0:
        return 'Out of Stock'
    if 0 < quantity <= min_threshold:
        return 'Low Stock'
    if today <= exp_date <= today + timedelta(days=60):
        return 'Expiring Soon'
    return 'In Stock'

def generate_medicine_id():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT medicine_id FROM medicines ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    if row and row['medicine_id']:
        try:
            seq = int(row['medicine_id'].split('-')[-1]) + 1
        except Exception:
            seq = 101
    else:
        seq = 101
    return f"MED-{seq:03d}"

def get_medicines(search='', category='', stock_status=''):
    conn = get_db_connection()
    query = "SELECT * FROM medicines WHERE 1=1"
    params = []

    if search:
        search_pattern = f"%{search.strip()}%"
        query += " AND (name LIKE ? OR medicine_id LIKE ? OR manufacturer LIKE ? OR batch_number LIKE ?)"
        params.extend([search_pattern, search_pattern, search_pattern, search_pattern])

    if category and category != 'All':
        query += " AND category = ?"
        params.append(category)

    query += " ORDER BY name ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()

    result = []
    for r in rows:
        item = dict(r)
        status = calculate_stock_status(item['quantity'], item['min_threshold'], item['exp_date'])
        item['stock_status'] = status
        if not stock_status or stock_status == 'All' or stock_status == status:
            result.append(item)

    return result

def get_pharmacy_alerts():
    """Returns grouped alerts for pharmacy inventory."""
    medicines = get_medicines()
    low_stock = [m for m in medicines if m['stock_status'] == 'Low Stock']
    out_of_stock = [m for m in medicines if m['stock_status'] == 'Out of Stock']
    expiring_soon = [m for m in medicines if m['stock_status'] == 'Expiring Soon']
    expired = [m for m in medicines if m['stock_status'] == 'Expired']

    return {
        'low_stock': low_stock,
        'out_of_stock': out_of_stock,
        'expiring_soon': expiring_soon,
        'expired': expired,
        'counts': {
            'low_stock': len(low_stock),
            'out_of_stock': len(out_of_stock),
            'expiring_soon': len(expiring_soon),
            'expired': len(expired)
        }
    }

def add_medicine(data):
    name = data.get('name', '').strip()
    category = data.get('category', '').strip()
    manufacturer = data.get('manufacturer', '').strip()
    batch_number = data.get('batch_number', '').strip()
    quantity = int(data.get('quantity', 0))
    min_threshold = int(data.get('min_threshold', 20))
    unit_price = float(data.get('unit_price', 0.0))
    mfg_date = data.get('mfg_date', '').strip()
    exp_date = data.get('exp_date', '').strip()

    if not name:
        raise ValueError("Medicine Name is required.")
    if not category:
        raise ValueError("Category is required.")
    if not batch_number:
        raise ValueError("Batch Number is required.")
    if not exp_date:
        raise ValueError("Expiry Date is required.")

    medicine_id = generate_medicine_id()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO medicines (medicine_id, name, category, manufacturer, batch_number, quantity, min_threshold, unit_price, mfg_date, exp_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (medicine_id, name, category, manufacturer, batch_number, quantity, min_threshold, unit_price, mfg_date, exp_date))
    conn.commit()
    new_pk = cursor.lastrowid
    conn.close()

    return {'id': new_pk, 'medicine_id': medicine_id, 'name': name, 'quantity': quantity}

def update_medicine(medicine_id_or_pk, data):
    conn = get_db_connection()
    cursor = conn.cursor()

    if str(medicine_id_or_pk).isdigit():
        med = cursor.execute("SELECT * FROM medicines WHERE id = ?", (int(medicine_id_or_pk),)).fetchone()
    else:
        med = cursor.execute("SELECT * FROM medicines WHERE medicine_id = ?", (str(medicine_id_or_pk),)).fetchone()

    if not med:
        conn.close()
        raise ValueError("Medicine not found.")

    pk = med['id']
    name = data.get('name', med['name']).strip()
    category = data.get('category', med['category']).strip()
    manufacturer = data.get('manufacturer', med['manufacturer']).strip()
    batch_number = data.get('batch_number', med['batch_number']).strip()
    quantity = int(data.get('quantity', med['quantity']))
    min_threshold = int(data.get('min_threshold', med['min_threshold']))
    unit_price = float(data.get('unit_price', med['unit_price']))
    mfg_date = data.get('mfg_date', med['mfg_date']).strip()
    exp_date = data.get('exp_date', med['exp_date']).strip()

    cursor.execute('''
        UPDATE medicines
        SET name = ?, category = ?, manufacturer = ?, batch_number = ?, quantity = ?,
            min_threshold = ?, unit_price = ?, mfg_date = ?, exp_date = ?
        WHERE id = ?
    ''', (name, category, manufacturer, batch_number, quantity, min_threshold, unit_price, mfg_date, exp_date, pk))
    conn.commit()
    conn.close()

    return {'id': pk, 'medicine_id': med['medicine_id'], 'name': name, 'quantity': quantity}

def update_medicine_stock(medicine_id_or_pk, quantity, is_absolute=True):
    """Updates medicine stock level."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if str(medicine_id_or_pk).isdigit():
        med = cursor.execute("SELECT * FROM medicines WHERE id = ?", (int(medicine_id_or_pk),)).fetchone()
    else:
        med = cursor.execute("SELECT * FROM medicines WHERE medicine_id = ?", (str(medicine_id_or_pk),)).fetchone()

    if not med:
        conn.close()
        raise ValueError("Medicine not found.")

    new_qty = int(quantity) if is_absolute else max(0, med['quantity'] + int(quantity))
    cursor.execute("UPDATE medicines SET quantity = ? WHERE id = ?", (new_qty, med['id']))
    conn.commit()
    conn.close()

    status = calculate_stock_status(new_qty, med['min_threshold'], med['exp_date'])
    return {'id': med['id'], 'medicine_id': med['medicine_id'], 'name': med['name'], 'quantity': new_qty, 'stock_status': status}

# ==========================================
# BILLING & PAYMENT MODULE
# ==========================================

def generate_bill_id():
    conn = get_db_connection()
    cursor = conn.cursor()
    year = date.today().year
    prefix = f"BIL-{year}-"
    cursor.execute("SELECT bill_id FROM bills WHERE bill_id LIKE ? ORDER BY id DESC LIMIT 1", (f"{prefix}%",))
    row = cursor.fetchone()
    conn.close()
    if row and row['bill_id']:
        try:
            seq = int(row['bill_id'].split('-')[-1]) + 1
        except Exception:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"

def create_bill(data):
    """
    Creates a new bill associated with a registered patient,
    computes totals, persists line items, and records payment status.
    """
    patient_identifier = data.get('patient_id')
    doctor_identifier = data.get('doctor_id')
    appointment_id = data.get('appointment_id')

    consultation_fee = float(data.get('consultation_fee', 0.0))
    lab_charges = float(data.get('lab_charges', 0.0))
    medicine_charges = float(data.get('medicine_charges', 0.0))
    other_charges = float(data.get('other_charges', 0.0))
    discount = float(data.get('discount', 0.0))

    total_amount = max(0.0, round((consultation_fee + lab_charges + medicine_charges + other_charges) - discount, 2))

    payment_method = data.get('payment_method', 'Cash').strip()
    payment_status = data.get('payment_status', 'Paid').strip()
    paid_amount = float(data.get('paid_amount', total_amount if payment_status == 'Paid' else 0.0))
    payment_date = data.get('payment_date', date.today().strftime('%Y-%m-%d')).strip()
    notes = data.get('notes', '').strip()

    if not patient_identifier:
        raise ValueError("Patient must be selected for billing.")

    patient = get_patient_by_id(patient_identifier)
    if not patient:
        raise ValueError("Selected patient does not exist.")

    doctor_id = None
    if doctor_identifier:
        doc = get_doctor_by_id(doctor_identifier)
        if doc:
            doctor_id = doc['id']

    bill_id = generate_bill_id()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO bills (bill_id, patient_id, doctor_id, appointment_id, consultation_fee, lab_charges, medicine_charges, other_charges, discount, total_amount, paid_amount, payment_method, payment_status, payment_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (bill_id, patient['id'], doctor_id, appointment_id, consultation_fee, lab_charges, medicine_charges, other_charges, discount, total_amount, paid_amount, payment_method, payment_status, payment_date, notes))

    new_bill_pk = cursor.lastrowid

    # Create itemized items
    items = data.get('items', [])
    if not items:
        # Generate standard line items from the four buckets
        if consultation_fee > 0:
            items.append({'item_type': 'Consultation', 'description': 'Physician Consultation Fees', 'quantity': 1, 'unit_price': consultation_fee, 'amount': consultation_fee})
        if lab_charges > 0:
            items.append({'item_type': 'Laboratory', 'description': 'Diagnostic & Laboratory Test Charges', 'quantity': 1, 'unit_price': lab_charges, 'amount': lab_charges})
        if medicine_charges > 0:
            items.append({'item_type': 'Pharmacy', 'description': 'Pharmacy Medications & Consumables', 'quantity': 1, 'unit_price': medicine_charges, 'amount': medicine_charges})
        if other_charges > 0:
            items.append({'item_type': 'Other', 'description': 'Hospital Facility & Administrative Charges', 'quantity': 1, 'unit_price': other_charges, 'amount': other_charges})

    for item in items:
        cursor.execute('''
            INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (new_bill_pk, item.get('item_type', 'General'), item.get('description', 'Service Charge'), item.get('quantity', 1), item.get('unit_price', item.get('amount', 0)), item.get('amount', 0)))

    conn.commit()
    conn.close()

    return get_bill_by_id(new_bill_pk)

def get_bills(search='', payment_status='', payment_method='', page=1, limit=50):
    conn = get_db_connection()
    query = '''
        SELECT 
            b.*,
            p.patient_id, p.full_name as patient_name, p.mobile as patient_mobile, p.city as patient_city,
            d.name as doctor_name
        FROM bills b
        JOIN patients p ON b.patient_id = p.id
        LEFT JOIN doctors d ON b.doctor_id = d.id
        WHERE 1=1
    '''
    params = []

    if payment_status and payment_status != 'All':
        query += " AND b.payment_status = ?"
        params.append(payment_status)

    if payment_method and payment_method != 'All':
        query += " AND b.payment_method = ?"
        params.append(payment_method)

    if search:
        search_pattern = f"%{search.strip()}%"
        query += " AND (b.bill_id LIKE ? OR p.full_name LIKE ? OR p.patient_id LIKE ? OR p.mobile LIKE ?)"
        params.extend([search_pattern, search_pattern, search_pattern, search_pattern])

    query += " ORDER BY b.id DESC LIMIT ? OFFSET ?"
    offset = (max(1, page) - 1) * limit
    params.extend([limit, offset])

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_bill_by_id(bill_id_or_pk):
    """Fetches complete bill with patient info, doctor info, and itemized bill_items."""
    conn = get_db_connection()
    query = '''
        SELECT 
            b.*,
            p.patient_id, p.full_name as patient_name, p.age as patient_age, p.gender as patient_gender,
            p.blood_group as patient_blood_group, p.mobile as patient_mobile, p.email as patient_email,
            p.address as patient_address, p.city as patient_city, p.state as patient_state, p.pincode as patient_pincode,
            d.name as doctor_name, d.specialization as doctor_specialization,
            dept.name as department_name
        FROM bills b
        JOIN patients p ON b.patient_id = p.id
        LEFT JOIN doctors d ON b.doctor_id = d.id
        LEFT JOIN departments dept ON d.department_id = dept.id
        WHERE 
    '''
    if str(bill_id_or_pk).isdigit():
        query += "b.id = ?"
        param = int(bill_id_or_pk)
    else:
        query += "b.bill_id = ?"
        param = str(bill_id_or_pk)

    bill_row = conn.execute(query, (param,)).fetchone()
    if not bill_row:
        conn.close()
        return None

    bill = dict(bill_row)
    items_rows = conn.execute("SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id ASC", (bill['id'],)).fetchall()
    bill['items'] = [dict(r) for r in items_rows]
    conn.close()

    return bill

def update_bill_payment_status(bill_id_or_pk, payment_status, paid_amount=None, payment_method=None):
    valid_statuses = ['Paid', 'Pending', 'Partially Paid']
    if payment_status not in valid_statuses:
        raise ValueError(f"Invalid payment status. Must be one of {valid_statuses}")

    bill = get_bill_by_id(bill_id_or_pk)
    if not bill:
        raise ValueError("Bill not found.")

    new_paid = float(paid_amount) if paid_amount is not None else (bill['total_amount'] if payment_status == 'Paid' else bill['paid_amount'])
    new_method = payment_method or bill['payment_method']
    today_str = date.today().strftime('%Y-%m-%d')

    conn = get_db_connection()
    conn.execute('''
        UPDATE bills
        SET payment_status = ?, paid_amount = ?, payment_method = ?, payment_date = ?
        WHERE id = ?
    ''', (payment_status, new_paid, new_method, today_str, bill['id']))
    conn.commit()
    conn.close()

    return get_bill_by_id(bill['id'])
