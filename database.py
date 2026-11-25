"""
MEDAXIS - Hospital Management System (Admin Portal)
Database Management & Initial Seed Data Module
"""

import sqlite3
import os
import json
from datetime import datetime, date, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'medaxis.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Departments
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT UNIQUE NOT NULL,
            icon TEXT NOT NULL,
            description TEXT
        )
    ''')

    # 2. Doctors
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            gender TEXT NOT NULL,
            department_id INTEGER NOT NULL,
            specialization TEXT NOT NULL,
            qualification TEXT NOT NULL,
            experience INTEGER NOT NULL,
            consultation_fee REAL NOT NULL,
            mobile TEXT NOT NULL,
            email TEXT NOT NULL,
            image_url TEXT,
            available_days TEXT NOT NULL,
            working_hours TEXT NOT NULL,
            break_time TEXT,
            is_available INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
        )
    ''')

    # 3. Patients
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            dob DATE NOT NULL,
            age INTEGER NOT NULL,
            gender TEXT NOT NULL,
            blood_group TEXT NOT NULL,
            email TEXT NOT NULL,
            mobile TEXT NOT NULL,
            address TEXT NOT NULL,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            pincode TEXT NOT NULL,
            emergency_contact TEXT,
            medical_history TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 4. Appointments
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            appointment_id TEXT UNIQUE NOT NULL,
            patient_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            appointment_date DATE NOT NULL,
            appointment_time TEXT NOT NULL,
            consultation_fee REAL NOT NULL,
            reason TEXT,
            status TEXT NOT NULL DEFAULT 'Scheduled',
            cancellation_reason TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
        )
    ''')

    # 5. Prescriptions
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prescriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            appointment_id INTEGER,
            diagnosis TEXT NOT NULL,
            medicines_json TEXT NOT NULL,
            instructions TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
        )
    ''')

    # 6. Laboratory Reports
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lab_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            doctor_id INTEGER,
            test_name TEXT NOT NULL,
            normal_range TEXT,
            test_result TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Normal',
            remarks TEXT,
            report_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
        )
    ''')

    # 7. Pharmacy Medicines
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            manufacturer TEXT NOT NULL,
            batch_number TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            min_threshold INTEGER NOT NULL DEFAULT 20,
            unit_price REAL NOT NULL,
            mfg_date DATE NOT NULL,
            exp_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 8. Bills
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id TEXT UNIQUE NOT NULL,
            patient_id INTEGER NOT NULL,
            doctor_id INTEGER,
            appointment_id INTEGER,
            consultation_fee REAL DEFAULT 0,
            lab_charges REAL DEFAULT 0,
            medicine_charges REAL DEFAULT 0,
            other_charges REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            total_amount REAL NOT NULL,
            paid_amount REAL DEFAULT 0,
            payment_method TEXT NOT NULL,
            payment_status TEXT NOT NULL DEFAULT 'Pending',
            payment_date DATE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
        )
    ''')

    # 9. Bill Items (detailed breakdown)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bill_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER NOT NULL,
            item_type TEXT NOT NULL,
            description TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            unit_price REAL NOT NULL,
            amount REAL NOT NULL,
            FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
        )
    ''')

    conn.commit()
    seed_initial_data(conn)
    conn.close()
    print("MEDAXIS Database Initialized Successfully.")

def seed_initial_data(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM departments")
    if cursor.fetchone()[0] > 0:
        return  # Data already seeded

    print("Seeding initial MEDAXIS clinical and operational data...")

    # Departments (11 departments from prompt)
    departments = [
        ('GEN-MED', 'General Medicine', 'fa-stethoscope', 'Primary care, diagnostic assessments, and adult chronic illness management.'),
        ('CARD', 'Cardiology', 'fa-heart-pulse', 'Advanced cardiovascular diagnostics, interventional cardiology, and heart wellness.'),
        ('NEUR', 'Neurology', 'fa-brain', 'Comprehensive care for neurological disorders, stroke rehabilitation, and spine nerve issues.'),
        ('ORTH', 'Orthopedics', 'fa-bone', 'Musculoskeletal system surgery, joint replacements, and sports injury management.'),
        ('DERM', 'Dermatology', 'fa-allergies', 'Clinical dermatology, pediatric skin care, cosmetic, and laser treatments.'),
        ('PED', 'Pediatrics', 'fa-baby', 'Specialized healthcare for infants, children, and adolescents, including immunizations.'),
        ('GYN', 'Gynecology', 'fa-venus', 'Women’s reproductive health, prenatal diagnostics, and maternal wellness.'),
        ('ENT', 'ENT', 'fa-head-side-cough', 'Ear, Nose, Throat medical care, audiology diagnostics, and endoscopic surgeries.'),
        ('OPHTH', 'Ophthalmology', 'fa-eye', 'Comprehensive ocular examinations, cataract surgeries, and vision correction.'),
        ('DENT', 'Dentistry', 'fa-tooth', 'Advanced dentistry, prosthodontics, root canals, and cosmetic dental procedures.'),
        ('SURG', 'General Surgery', 'fa-scalpel', 'Minimally invasive laparoscopic surgeries and trauma emergency operations.')
    ]
    cursor.executemany("INSERT INTO departments (code, name, icon, description) VALUES (?, ?, ?, ?)", departments)

    # Fetch department IDs
    dept_map = {}
    for row in cursor.execute("SELECT id, name FROM departments").fetchall():
        dept_map[row[1]] = row[0]

    # Doctors with realistic Indian details
    doctors = [
        ('DOC-101', 'Dr. Rameshwar V. Sen', 'Male', dept_map['General Medicine'], 'Internal Medicine & Diabetes', 'MBBS, MD (Medicine)', 16, 700.0, '9820145892', 'dr.rameshwar.sen@medaxis.in', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300', 'Mon, Tue, Wed, Thu, Fri, Sat', '09:00 AM - 05:00 PM', '01:00 PM - 02:00 PM', 1),
        ('DOC-102', 'Dr. Radhika K. Nambiar', 'Female', dept_map['Cardiology'], 'Interventional Cardiology', 'MBBS, MD, DM (Cardiology)', 14, 1200.0, '9821365478', 'dr.radhika.nambiar@medaxis.in', 'https://images.unsplash.com/photo-1594824813571-638f02636136?w=300', 'Mon, Tue, Wed, Thu, Fri', '10:00 AM - 04:00 PM', '01:30 PM - 02:30 PM', 1),
        ('DOC-103', 'Dr. Arvind Swaminathan', 'Male', dept_map['Neurology'], 'Stroke & Neurovascular Medicine', 'MBBS, MD, DM (Neurology)', 19, 1500.0, '9833441258', 'dr.arvind.swamy@medaxis.in', 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300', 'Mon, Wed, Fri, Sat', '11:00 AM - 05:00 PM', '02:00 PM - 03:00 PM', 1),
        ('DOC-104', 'Dr. Pradeep B. Deshmukh', 'Male', dept_map['Orthopedics'], 'Joint Replacement & Spine Surgery', 'MBBS, MS (Ortho), MCh (UK)', 22, 1000.0, '9845127890', 'dr.pradeep.deshmukh@medaxis.in', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300', 'Mon, Tue, Thu, Fri, Sat', '09:30 AM - 04:30 PM', '01:00 PM - 02:00 PM', 1),
        ('DOC-105', 'Dr. Shalini Kulkarni', 'Female', dept_map['Dermatology'], 'Clinical Dermatology & Cosmetology', 'MBBS, MD (Dermatology, Venereology)', 11, 800.0, '9819876543', 'dr.shalini.kulkarni@medaxis.in', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300', 'Tue, Wed, Thu, Fri, Sat', '10:00 AM - 06:00 PM', '01:30 PM - 02:30 PM', 1),
        ('DOC-106', 'Dr. Manasvi Agarwal', 'Female', dept_map['Pediatrics'], 'Neonatology & Pediatric Critical Care', 'MBBS, DCH, DNB (Pediatrics)', 13, 750.0, '9867542310', 'dr.manasvi.agarwal@medaxis.in', 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=300', 'Mon, Tue, Wed, Thu, Fri, Sat', '09:00 AM - 03:00 PM', '01:00 PM - 01:30 PM', 1),
        ('DOC-107', 'Dr. Ananya Mukherjee', 'Female', dept_map['Gynecology'], 'Obstetrics & High-Risk Pregnancy', 'MBBS, MS (Obstetrics & Gynecology)', 15, 950.0, '9890123456', 'dr.ananya.mukherjee@medaxis.in', 'https://images.unsplash.com/photo-1594824813718-490352ef29b3?w=300', 'Mon, Tue, Wed, Thu, Fri', '09:00 AM - 04:00 PM', '01:00 PM - 02:00 PM', 1),
        ('DOC-108', 'Dr. Harish T. Chawla', 'Male', dept_map['ENT'], 'Head & Neck Micro-Surgery', 'MBBS, MS (ENT), DNB', 17, 700.0, '9822334455', 'dr.harish.chawla@medaxis.in', 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=300', 'Mon, Wed, Thu, Sat', '10:00 AM - 05:00 PM', '01:30 PM - 02:30 PM', 1),
        ('DOC-109', 'Dr. Sunita Venkatraman', 'Female', dept_map['Ophthalmology'], 'Phacoemulsification & Retina Care', 'MBBS, MS (Ophthalmology)', 12, 650.0, '9844556677', 'dr.sunita.v@medaxis.in', 'https://images.unsplash.com/photo-1638202993928-7267aad84c31?w=300', 'Mon, Tue, Wed, Fri, Sat', '09:00 AM - 03:30 PM', '01:00 PM - 02:00 PM', 1),
        ('DOC-110', 'Dr. Aditya Verma', 'Male', dept_map['Dentistry'], 'Endodontics & Implantology', 'BDS, MDS (Conservative Dentistry)', 10, 600.0, '9876501234', 'dr.aditya.verma@medaxis.in', 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300', 'Mon, Tue, Wed, Thu, Fri, Sat', '10:00 AM - 07:00 PM', '02:00 PM - 03:00 PM', 1),
        ('DOC-111', 'Dr. Vivek K. Singhania', 'Male', dept_map['General Surgery'], 'Laparoscopic & Bariatric Surgery', 'MBBS, MS (General Surgery), FMAS', 21, 1100.0, '9811223344', 'dr.vivek.singhania@medaxis.in', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300', 'Mon, Tue, Thu, Fri', '08:30 AM - 03:30 PM', '01:00 PM - 02:00 PM', 1),
        ('DOC-112', 'Dr. Meera S. Joshi', 'Female', dept_map['General Medicine'], 'Geriatric Care & Lifestyle Disorders', 'MBBS, MD (General Medicine)', 9, 650.0, '9833887766', 'dr.meera.joshi@medaxis.in', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300', 'Mon, Tue, Wed, Thu, Fri', '01:00 PM - 08:00 PM', '04:30 PM - 05:00 PM', 1)
    ]
    cursor.executemany('''
        INSERT INTO doctors (doctor_id, name, gender, department_id, specialization, qualification, experience, consultation_fee, mobile, email, image_url, available_days, working_hours, break_time, is_available)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', doctors)

    # Patients with realistic Indian data (Indian names, states, PIN codes, 10-digit mobile)
    today = date.today()
    patients = [
        ('PAT-2026-0001', 'Rajesh K. Mehta', '1981-04-12', 45, 'Male', 'B+', 'rajesh.mehta81@gmail.com', '9820194820', 'Flat 402, Neelkanth Heights, LBS Road, Ghatkopar West', 'Mumbai', 'Maharashtra', '400086', 'Sunita Mehta (Wife) - 9820194821', 'Type 2 Diabetes, Mild Hypertension'),
        ('PAT-2026-0002', 'Priya S. Nambiar', '1993-08-25', 33, 'Female', 'O+', 'priya.nambiar93@outlook.com', '9845012398', '12, 4th Cross, Indiranagar Stage 2', 'Bengaluru', 'Karnataka', '560038', 'Karthik Nambiar (Brother) - 9845012399', 'Dust Allergy, Asthmatic Bronchitis'),
        ('PAT-2026-0003', 'Vikramaditya Rao', '1968-11-05', 58, 'Male', 'A+', 'v.rao.consult@yahoo.co.in', '9833112244', 'Bungalow 7, Jubilee Hills, Road No. 36', 'Hyderabad', 'Telangana', '500033', 'Padma Rao (Wife) - 9833112245', 'Coronary Artery Disease post-stent (2022)'),
        ('PAT-2026-0004', 'Ananya S. Iyer', '2001-02-18', 25, 'Female', 'AB+', 'ananya.iyer@gmail.com', '9819283746', 'A-304, Green Acres, Viman Nagar', 'Pune', 'Maharashtra', '411014', 'Suresh Iyer (Father) - 9819283740', 'No major medical history, seasonal sinusitis'),
        ('PAT-2026-0005', 'Mohammed Tariq Khan', '1976-06-30', 50, 'Male', 'O-', 'tariq.khan.trans@gmail.com', '9821765432', 'House 58, Sector 14, Near City Centre', 'Gurugram', 'Haryana', '122001', 'Zeenat Khan (Wife) - 9821765430', 'Chronic lower back pain, L4-L5 disc bulge'),
        ('PAT-2026-0006', 'Kavita Sundaram Nair', '1989-10-14', 37, 'Female', 'A-', 'kavita.nair.fin@gmail.com', '9840123456', 'Plot 18, 2nd Main Road, Anna Nagar West', 'Chennai', 'Tamil Nadu', '600040', 'S. Nair (Father) - 9840123450', 'Hypothyroidism on Levothyroxine 50mcg'),
        ('PAT-2026-0007', 'Amitabh P. Sengupta', '1955-03-22', 71, 'Male', 'B-', 'amitabh.sengupta@rediffmail.com', '9830098765', '45/B, Southern Avenue, Lake Market', 'Kolkata', 'West Bengal', '700029', 'Debabrata Sengupta (Son) - 9830098760', 'Benign Prostatic Hyperplasia, Osteoarthritis knees'),
        ('PAT-2026-0008', 'Deepak R. Chaurasia', '1995-12-09', 30, 'Male', 'O+', 'deepak.chaurasia@gmail.com', '9899112233', 'C-12, Malviya Nagar, Near Market', 'New Delhi', 'Delhi', '110017', 'Ramesh Chaurasia (Brother) - 9899112230', 'Penicillin allergy noted in 2018'),
        ('PAT-2026-0009', 'Sunita R. Patel', '1984-07-19', 42, 'Female', 'A+', 'sunita.patel.ahd@gmail.com', '9825012345', 'B-102, Shivalik Residency, Satellite Road', 'Ahmedabad', 'Gujarat', '380015', 'Rakesh Patel (Husband) - 9825012340', 'Migraine with aura'),
        ('PAT-2026-0010', 'Harpreet Singh Walia', '1972-01-15', 54, 'Male', 'B+', 'harpreet.walia@gmail.com', '9814012345', 'House 420, Sector 35-C', 'Chandigarh', 'Punjab', '160035', 'Jaspreet Walia (Wife) - 9814012340', 'Dyslipidemia, Fatty Liver Grade 1')
    ]
    cursor.executemany('''
        INSERT INTO patients (patient_id, full_name, dob, age, gender, blood_group, email, mobile, address, city, state, pincode, emergency_contact, medical_history)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', patients)

    # Fetch created IDs
    patient_rows = cursor.execute("SELECT id, patient_id FROM patients").fetchall()
    pat_id_map = {row['patient_id']: row['id'] for row in patient_rows}

    doc_rows = cursor.execute("SELECT id, doctor_id, consultation_fee FROM doctors").fetchall()
    doc_id_map = {row['doctor_id']: (row['id'], row['consultation_fee']) for row in doc_rows}

    # Appointments (spans Today, Past, Upcoming, Cancelled)
    today_str = today.strftime('%Y-%m-%d')
    yesterday_str = (today - timedelta(days=1)).strftime('%Y-%m-%d')
    tomorrow_str = (today + timedelta(days=1)).strftime('%Y-%m-%d')
    two_days_later_str = (today + timedelta(days=2)).strftime('%Y-%m-%d')
    three_days_ago_str = (today - timedelta(days=3)).strftime('%Y-%m-%d')

    appointments = [
        # Today's appointments
        ('APT-2026-0001', pat_id_map['PAT-2026-0001'], doc_id_map['DOC-101'][0], today_str, '09:30 AM', doc_id_map['DOC-101'][1], 'Routine Diabetic Quarterly Review & HbA1c check', 'Scheduled', None, 'Patient fasting requested'),
        ('APT-2026-0002', pat_id_map['PAT-2026-0002'], doc_id_map['DOC-102'][0], today_str, '10:30 AM', doc_id_map['DOC-102'][1], 'Palpitations and exertion fatigue evaluation', 'Scheduled', None, 'ECG & Echocardiogram advised'),
        ('APT-2026-0003', pat_id_map['PAT-2026-0003'], doc_id_map['DOC-103'][0], today_str, '11:30 AM', doc_id_map['DOC-103'][1], 'Post-ischemic attack follow-up and reflex check', 'Completed', None, 'Blood pressure controlled at 124/82'),
        ('APT-2026-0004', pat_id_map['PAT-2026-0004'], doc_id_map['DOC-105'][0], today_str, '02:00 PM', doc_id_map['DOC-105'][1], 'Severe allergic contact dermatitis flare-up', 'Scheduled', None, 'Brought topical cream samples'),
        ('APT-2026-0005', pat_id_map['PAT-2026-0005'], doc_id_map['DOC-104'][0], today_str, '03:30 PM', doc_id_map['DOC-104'][1], 'L4-L5 disc herniation persistent radiation pain', 'Scheduled', None, 'MRI Lumbar spine films available'),

        # Upcoming appointments
        ('APT-2026-0006', pat_id_map['PAT-2026-0006'], doc_id_map['DOC-107'][0], tomorrow_str, '10:00 AM', doc_id_map['DOC-107'][1], 'Antenatal ultrasound scan and routine checkup', 'Scheduled', None, 'Second trimester evaluation'),
        ('APT-2026-0007', pat_id_map['PAT-2026-0007'], doc_id_map['DOC-108'][0], tomorrow_str, '11:00 AM', doc_id_map['DOC-108'][1], 'Chronic hearing diminution and tinnitus left ear', 'Scheduled', None, 'Audiometry ordered'),
        ('APT-2026-0008', pat_id_map['PAT-2026-0008'], doc_id_map['DOC-110'][0], two_days_later_str, '04:00 PM', doc_id_map['DOC-110'][1], 'Molar cavity restoration & composite filling', 'Scheduled', None, 'Pre-medicate with analgesics'),

        # Past Completed appointments
        ('APT-2026-0009', pat_id_map['PAT-2026-0009'], doc_id_map['DOC-103'][0], yesterday_str, '12:00 PM', doc_id_map['DOC-103'][1], 'Chronic recurrent migraine with visual disturbances', 'Completed', None, 'Prescribed prophylactic beta-blocker'),
        ('APT-2026-0010', pat_id_map['PAT-2026-0010'], doc_id_map['DOC-101'][0], three_days_ago_str, '10:00 AM', doc_id_map['DOC-101'][1], 'Executive annual physical & lipid profile review', 'Completed', None, 'Dietary lifestyle adjustments advised'),

        # Cancelled & Rescheduled
        ('APT-2026-0011', pat_id_map['PAT-2026-0005'], doc_id_map['DOC-111'][0], yesterday_str, '09:00 AM', doc_id_map['DOC-111'][1], 'Consultation for elective inguinal hernia repair', 'Cancelled', 'Patient requested postponement due to official travel', 'Rescheduling requested for next week'),
        ('APT-2026-0012', pat_id_map['PAT-2026-0008'], doc_id_map['DOC-109'][0], today_str, '01:00 PM', doc_id_map['DOC-109'][1], 'Vision blurriness and refractive index check', 'Rescheduled', None, 'Moved from 09:00 AM slot on doctor request')
    ]

    cursor.executemany('''
        INSERT INTO appointments (appointment_id, patient_id, doctor_id, appointment_date, appointment_time, consultation_fee, reason, status, cancellation_reason, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', appointments)

    # Fetch appointment IDs
    apt_rows = cursor.execute("SELECT id, appointment_id FROM appointments").fetchall()
    apt_id_map = {row['appointment_id']: row['id'] for row in apt_rows}

    # Prescriptions
    prescriptions = [
        (
            pat_id_map['PAT-2026-0001'], doc_id_map['DOC-101'][0], apt_id_map['APT-2026-0001'],
            'Type 2 Diabetes Mellitus & Dyslipidemia',
            json.dumps([
                {"name": "Glycomet-GP 1 Forte (Glimepiride + Metformin)", "dosage": "1 tablet", "timing": "Twice daily after food (1-0-1)", "duration": "30 days"},
                {"name": "Atorva 20mg (Atorvastatin)", "dosage": "1 tablet", "timing": "Once daily at bedtime (0-0-1)", "duration": "30 days"},
                {"name": "Telma 40mg (Telmisartan)", "dosage": "1 tablet", "timing": "Once daily in the morning (1-0-0)", "duration": "30 days"}
            ]),
            'Monitor blood glucose morning fasting and post-prandial twice weekly. Maintain salt and carb restriction.'
        ),
        (
            pat_id_map['PAT-2026-0003'], doc_id_map['DOC-103'][0], apt_id_map['APT-2026-0003'],
            'Secondary Stroke Prevention & Hypertension',
            json.dumps([
                {"name": "Ecosprin-AV 75/20 (Aspirin + Atorvastatin)", "dosage": "1 capsule", "timing": "Once daily after dinner (0-0-1)", "duration": "60 days"},
                {"name": "Ciplar-LA 40mg (Propranolol)", "dosage": "1 tablet", "timing": "Once daily in morning (1-0-0)", "duration": "30 days"},
                {"name": "Neurobion Forte", "dosage": "1 tablet", "timing": "Once daily after breakfast", "duration": "30 days"}
            ]),
            'Strict BP monitoring. Prompt emergency consult if unilateral weakness or speech slurring occurs.'
        ),
        (
            pat_id_map['PAT-2026-0009'], doc_id_map['DOC-103'][0], apt_id_map['APT-2026-0009'],
            'Migraine Prophylaxis & Acute Attack Control',
            json.dumps([
                {"name": "Flunarin 10mg (Flunarizine)", "dosage": "1 tablet", "timing": "Once daily at bedtime", "duration": "30 days"},
                {"name": "Suminat 50mg (Sumatriptan)", "dosage": "1 tablet", "timing": "Only SOS at onset of aura", "duration": "5 tablets SOS"},
                {"name": "Pan-D (Pantoprazole + Domperidone)", "dosage": "1 capsule", "timing": "Morning before breakfast", "duration": "14 days"}
            ]),
            'Avoid chocolate, aged cheese, and erratic sleep cycles. Maintain a headache trigger log.'
        )
    ]
    cursor.executemany('''
        INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, diagnosis, medicines_json, instructions)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', prescriptions)

    # Laboratory Reports
    lab_reports = [
        (pat_id_map['PAT-2026-0001'], doc_id_map['DOC-101'][0], 'HbA1c Glycated Hemoglobin', '4.0 - 5.6 %', '7.2 %', 'Abnormal', 'Moderate glycemic control. Titrate Metformin dose.', today_str),
        (pat_id_map['PAT-2026-0001'], doc_id_map['DOC-101'][0], 'Fasting Blood Glucose', '70 - 100 mg/dL', '138 mg/dL', 'Abnormal', 'Elevated fasting blood sugar.', today_str),
        (pat_id_map['PAT-2026-0001'], doc_id_map['DOC-101'][0], 'Serum Creatinine', '0.7 - 1.3 mg/dL', '0.92 mg/dL', 'Normal', 'Kidney renal parameters within normal limits.', today_str),
        (pat_id_map['PAT-2026-0002'], doc_id_map['DOC-102'][0], '12-Lead Electrocardiogram (ECG)', 'Sinus Rhythm', 'Normal Sinus Rhythm, 76 bpm', 'Normal', 'No acute ST-T wave changes detected.', today_str),
        (pat_id_map['PAT-2026-0002'], doc_id_map['DOC-102'][0], 'Serum Troponin-I High Sensitivity', '< 14 ng/L', '4.2 ng/L', 'Normal', 'Rule out acute myocardial injury.', today_str),
        (pat_id_map['PAT-2026-0003'], doc_id_map['DOC-103'][0], 'Brain MRI with Angiography', 'Normal Vessels', 'Old lacunar infarct right internal capsule', 'Completed', 'No evidence of acute acute stroke or bleed.', yesterday_str),
        (pat_id_map['PAT-2026-0007'], doc_id_map['DOC-104'][0], 'X-Ray Both Knees AP & Lateral', 'Normal Joint Space', 'Bilateral medial joint space narrowing Grade 2', 'Abnormal', 'Osteoarthritic degenerative changes.', three_days_ago_str),
        (pat_id_map['PAT-2026-0010'], doc_id_map['DOC-101'][0], 'Comprehensive Lipid Panel', 'Cholesterol < 200 mg/dL', 'Total: 238 mg/dL, LDL: 152, HDL: 44', 'Abnormal', 'Hypercholesterolemia. Statin advised.', three_days_ago_str)
    ]
    cursor.executemany('''
        INSERT INTO lab_reports (patient_id, doctor_id, test_name, normal_range, test_result, status, remarks, report_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', lab_reports)

    # Pharmacy Medicines (25 realistic medications with low stock, expired, expiring soon, and in stock)
    # Expiry relative dates:
    past_exp = (today - timedelta(days=45)).strftime('%Y-%m-%d')
    soon_exp = (today + timedelta(days=25)).strftime('%Y-%m-%d')
    future_exp1 = (today + timedelta(days=365)).strftime('%Y-%m-%d')
    future_exp2 = (today + timedelta(days=730)).strftime('%Y-%m-%d')
    mfg_date_past = (today - timedelta(days=365)).strftime('%Y-%m-%d')

    medicines = [
        ('MED-101', 'Augmentin 625 Duo (Amoxicillin + Clavulanate)', 'Antibiotics', 'GlaxoSmithKline (GSK)', 'AUG-9821', 140, 20, 215.0, mfg_date_past, future_exp1),
        ('MED-102', 'Paracetamol 650mg (Dolo 650)', 'Analgesics & Antipyretics', 'Micro Labs Ltd', 'DOL-4421', 450, 50, 32.5, mfg_date_past, future_exp2),
        ('MED-103', 'Glycomet-GP 1 Forte (Glimepiride + Metformin)', 'Antidiabetics', 'USV Private Limited', 'GLY-7732', 85, 25, 142.0, mfg_date_past, future_exp1),
        ('MED-104', 'Telma 40 (Telmisartan 40mg)', 'Antihypertensives', 'Glenmark Pharmaceuticals', 'TEL-3319', 110, 20, 118.0, mfg_date_past, future_exp2),
        ('MED-105', 'Pan 40 (Pantoprazole 40mg)', 'Gastrointestinal & Antacids', 'Alkem Laboratories', 'PAN-1092', 220, 30, 95.0, mfg_date_past, future_exp2),
        ('MED-106', 'Atorva 20 (Atorvastatin 20mg)', 'Cardiovascular / Statins', 'Zydus Cadila', 'ATV-5620', 15, 25, 168.0, mfg_date_past, future_exp1), # Low stock alert
        ('MED-107', 'Montair-LC (Montelukast + Levocetirizine)', 'Respiratory & Antiallergic', 'Cipla Ltd', 'MON-8812', 8, 20, 195.0, mfg_date_past, future_exp1), # Low stock alert
        ('MED-108', 'Azithral 500mg (Azithromycin)', 'Antibiotics', 'Alembic Pharmaceuticals', 'AZI-4491', 0, 20, 132.0, mfg_date_past, future_exp1), # Out of stock alert
        ('MED-109', 'Cipcal 500 (Calcium + Vitamin D3)', 'Vitamins & Minerals', 'Cipla Ltd', 'CIP-2234', 180, 25, 92.0, mfg_date_past, future_exp2),
        ('MED-110', 'Ecosprin 75mg (Enteric Coated Aspirin)', 'Antithrombotic', 'USV Private Limited', 'ECO-6701', 320, 40, 15.0, mfg_date_past, future_exp2),
        ('MED-111', 'Combiflam (Ibuprofen + Paracetamol)', 'Analgesics / NSAIDs', 'Sanofi India', 'CMB-3312', 0, 30, 48.0, mfg_date_past, future_exp1), # Out of stock alert
        ('MED-112', 'Supradyn Daily Multivitamin', 'Vitamins & Supplements', 'Bayer Pharmaceuticals', 'SUP-9901', 190, 25, 65.0, mfg_date_past, future_exp2),
        ('MED-113', 'Becosules Z Capsules', 'Vitamins & Zinc', 'Pfizer India', 'BEC-1144', 240, 30, 54.0, mfg_date_past, future_exp2),
        ('MED-114', 'Cefix 200mg (Cefixime)', 'Antibiotics', 'Dr. Reddy’s Laboratories', 'CFX-8012', 12, 20, 110.0, mfg_date_past, soon_exp), # Low stock & Expiring soon alert
        ('MED-115', 'Omee Capsule 20mg (Omeprazole)', 'Gastrointestinal', 'Alkem Laboratories', 'OME-5521', 170, 20, 62.0, mfg_date_past, past_exp), # Expired alert
        ('MED-116', 'Allegra 120mg (Fexofenadine)', 'Antiallergic', 'Sanofi India', 'ALL-2287', 95, 20, 218.0, mfg_date_past, future_exp2),
        ('MED-117', 'Volini Pain Relief Gel 50g', 'Topical Analgesic', 'Sun Pharma', 'VOL-3341', 75, 15, 145.0, mfg_date_past, future_exp1),
        ('MED-118', 'Betadine 10% Ointment 20g', 'Antiseptic & Wound Care', 'Win-Medicare', 'BET-7721', 115, 20, 125.0, mfg_date_past, future_exp2),
        ('MED-119', 'Ascoril LS Syrup 100ml', 'Cough & Bronchodilator', 'Glenmark Pharmaceuticals', 'ASC-4410', 60, 15, 118.0, mfg_date_past, future_exp1),
        ('MED-120', 'Thyronorm 50mcg (Levothyroxine)', 'Hormones / Thyroid', 'Abbott Healthcare', 'THY-1290', 140, 25, 185.0, mfg_date_past, future_exp2),
        ('MED-121', 'Zerodol-SP (Aceclofenac + Paracetamol + Serratiopeptidase)', 'Analgesics & Anti-inflammatory', 'Ipca Laboratories', 'ZER-6612', 130, 25, 124.0, mfg_date_past, future_exp1),
        ('MED-122', 'Rantac 150mg (Ranitidine)', 'Antacids', 'J.B. Chemicals', 'RAN-0012', 40, 20, 38.0, mfg_date_past, past_exp), # Expired alert
        ('MED-123', 'Shelcal 500 (Elemental Calcium)', 'Nutritional Supplements', 'Torrent Pharmaceuticals', 'SHL-9923', 210, 30, 135.0, mfg_date_past, future_exp2),
        ('MED-124', 'Lulifin Cream 30g (Luliconazole)', 'Antifungal', 'Sun Pharma', 'LUL-4402', 45, 15, 280.0, mfg_date_past, soon_exp), # Expiring soon
        ('MED-125', 'Electral ORS Powder 21.8g', 'Electrolytes & Rehydration', 'FDC Limited', 'ELE-7711', 500, 50, 22.0, mfg_date_past, future_exp2)
    ]
    cursor.executemany('''
        INSERT INTO medicines (medicine_id, name, category, manufacturer, batch_number, quantity, min_threshold, unit_price, mfg_date, exp_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', medicines)

    # Bills & Payments
    bills = [
        ('BIL-2026-0001', pat_id_map['PAT-2026-0001'], doc_id_map['DOC-101'][0], apt_id_map['APT-2026-0001'], 700.0, 1250.0, 475.0, 150.0, 0.0, 2575.0, 2575.0, 'UPI', 'Paid', today_str, 'Full settlement received via Google Pay UPI'),
        ('BIL-2026-0002', pat_id_map['PAT-2026-0002'], doc_id_map['DOC-102'][0], apt_id_map['APT-2026-0002'], 1200.0, 1800.0, 320.0, 200.0, 0.0, 3520.0, 3520.0, 'Debit Card', 'Paid', today_str, 'Paid at Billing Counter 1 POS machine'),
        ('BIL-2026-0003', pat_id_map['PAT-2026-0003'], doc_id_map['DOC-103'][0], apt_id_map['APT-2026-0003'], 1500.0, 4500.0, 680.0, 250.0, 200.0, 6730.0, 4000.0, 'Credit Card', 'Partially Paid', today_str, 'Partial advance payment received. Remaining ₹2730 pending.'),
        ('BIL-2026-0004', pat_id_map['PAT-2026-0004'], doc_id_map['DOC-105'][0], apt_id_map['APT-2026-0004'], 800.0, 0.0, 413.0, 100.0, 0.0, 1313.0, 0.0, 'Cash', 'Pending', today_str, 'Pending payment awaiting pharmacy dispensing confirmation'),
        ('BIL-2026-0005', pat_id_map['PAT-2026-0009'], doc_id_map['DOC-103'][0], apt_id_map['APT-2026-0009'], 1500.0, 850.0, 350.0, 100.0, 0.0, 2800.0, 2800.0, 'Cash', 'Paid', yesterday_str, 'Settled in cash at executive counter'),
        ('BIL-2026-0006', pat_id_map['PAT-2026-0010'], doc_id_map['DOC-101'][0], apt_id_map['APT-2026-0010'], 700.0, 1600.0, 0.0, 150.0, 0.0, 2450.0, 2450.0, 'UPI', 'Paid', three_days_ago_str, 'UPI payment transaction ref #982310492810'),
        ('BIL-2026-0007', pat_id_map['PAT-2026-0005'], doc_id_map['DOC-104'][0], apt_id_map['APT-2026-0005'], 1000.0, 3200.0, 560.0, 200.0, 0.0, 4960.0, 0.0, 'UPI', 'Pending', today_str, 'Orthopedic diagnostics & physiotherapy evaluation bill generated')
    ]
    cursor.executemany('''
        INSERT INTO bills (bill_id, patient_id, doctor_id, appointment_id, consultation_fee, lab_charges, medicine_charges, other_charges, discount, total_amount, paid_amount, payment_method, payment_status, payment_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', bills)

    # Fetch bill IDs for bill items
    bill_rows = cursor.execute("SELECT id, bill_id FROM bills").fetchall()
    bill_id_map = {row['bill_id']: row['id'] for row in bill_rows}

    # Bill items breakdown for professional invoice printing
    bill_items = [
        (bill_id_map['BIL-2026-0001'], 'Consultation', 'General Medicine Consultation (Dr. Rameshwar V. Sen)', 1, 700.0, 700.0),
        (bill_id_map['BIL-2026-0001'], 'Laboratory', 'HbA1c & Fasting Blood Sugar Test Panel', 1, 850.0, 850.0),
        (bill_id_map['BIL-2026-0001'], 'Laboratory', 'Serum Creatinine & Electrolytes', 1, 400.0, 400.0),
        (bill_id_map['BIL-2026-0001'], 'Pharmacy', 'Glycomet-GP 1 Forte (30 tablets)', 1, 142.0, 142.0),
        (bill_id_map['BIL-2026-0001'], 'Pharmacy', 'Telma 40 & Atorva 20 Starter Kit', 1, 333.0, 333.0),
        (bill_id_map['BIL-2026-0001'], 'Other', 'Hospital Registration & Nursing Charges', 1, 150.0, 150.0),

        (bill_id_map['BIL-2026-0002'], 'Consultation', 'Cardiology Speciality Consultation (Dr. Radhika K. Nambiar)', 1, 1200.0, 1200.0),
        (bill_id_map['BIL-2026-0002'], 'Laboratory', '12-Lead Digital ECG', 1, 600.0, 600.0),
        (bill_id_map['BIL-2026-0002'], 'Laboratory', 'High Sensitivity Troponin-I Assay', 1, 1200.0, 1200.0),
        (bill_id_map['BIL-2026-0002'], 'Pharmacy', 'Cardiovascular Support Medications', 1, 320.0, 320.0),
        (bill_id_map['BIL-2026-0002'], 'Other', 'Bio-Medical Waste & Sanitization Fee', 1, 200.0, 200.0),

        (bill_id_map['BIL-2026-0003'], 'Consultation', 'Neurology Super-Specialist Review (Dr. Arvind Swaminathan)', 1, 1500.0, 1500.0),
        (bill_id_map['BIL-2026-0003'], 'Laboratory', 'Brain MRI with Diffusion & Angiogram Scan', 1, 4500.0, 4500.0),
        (bill_id_map['BIL-2026-0003'], 'Pharmacy', 'Neuro-protective Prescriptions (Ecosprin-AV, Ciplar)', 1, 680.0, 680.0),
        (bill_id_map['BIL-2026-0003'], 'Other', 'Hospital Administrative Service Fee', 1, 250.0, 250.0)
    ]
    cursor.executemany('''
        INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price, amount)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', bill_items)

    conn.commit()
    print("Seed data successfully committed.")

if __name__ == '__main__':
    init_db()
