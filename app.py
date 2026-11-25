"""
MEDAXIS - Hospital Management System (Admin Portal)
Flask Backend Application & REST API
"""

import os
from flask import Flask, render_template, request, jsonify, send_from_directory
from database import init_db
import models

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['JSON_SORT_KEYS'] = False
app.config['SECRET_KEY'] = 'medaxis-hospital-super-secret-key-2026'

# Ensure database is initialized on launch
init_db()

# ==========================================
# WEB PAGE ROUTES
# ==========================================

@app.route('/')
def index():
    """Renders the main MEDAXIS Admin Dashboard SPA."""
    return render_template('index.html')

@app.route('/invoice/print/<bill_id>')
def print_invoice(bill_id):
    """Renders a standalone printable invoice page for any bill."""
    bill = models.get_bill_by_id(bill_id)
    if not bill:
        return "Invoice not found", 404
    return render_template('invoice_print.html', bill=bill)

# ==========================================
# REST API: DASHBOARD
# ==========================================

@app.route('/api/dashboard/stats', methods=['GET'])
def api_dashboard_stats():
    try:
        stats = models.get_dashboard_stats()
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/dashboard/charts', methods=['GET'])
def api_dashboard_charts():
    try:
        charts = models.get_dashboard_charts_data()
        return jsonify({'success': True, 'data': charts})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/dashboard/today-appointments', methods=['GET'])
def api_dashboard_today_appointments():
    try:
        limit = request.args.get('limit', 10, type=int)
        apts = models.get_today_appointments_overview(limit)
        return jsonify({'success': True, 'data': apts})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/dashboard/recent-patients', methods=['GET'])
def api_dashboard_recent_patients():
    try:
        limit = request.args.get('limit', 6, type=int)
        patients = models.get_recent_patients(limit)
        return jsonify({'success': True, 'data': patients})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/dashboard/department-availability', methods=['GET'])
def api_dashboard_dept_availability():
    try:
        dept_info = models.get_department_doctor_availability()
        return jsonify({'success': True, 'data': dept_info})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/dashboard/recent-bills', methods=['GET'])
def api_dashboard_recent_bills():
    try:
        limit = request.args.get('limit', 6, type=int)
        bills = models.get_recent_billing_transactions(limit)
        return jsonify({'success': True, 'data': bills})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
# REST API: PATIENTS
# ==========================================

@app.route('/api/patients', methods=['GET'])
def api_get_patients():
    try:
        search = request.args.get('search', '')
        gender = request.args.get('gender', '')
        blood_group = request.args.get('blood_group', '')
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 50, type=int)

        patients = models.get_patients(search, gender, blood_group, page, limit)
        return jsonify({'success': True, 'data': patients, 'count': len(patients)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/patients/next-id', methods=['GET'])
def api_next_patient_id():
    try:
        next_id = models.generate_patient_id()
        return jsonify({'success': True, 'next_id': next_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/patients', methods=['POST'])
def api_register_patient():
    try:
        data = request.get_json() or {}
        new_patient = models.register_patient(data)
        return jsonify({'success': True, 'message': 'Patient registered successfully!', 'data': new_patient}), 201
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/patients/<identifier>', methods=['GET'])
def api_get_patient(identifier):
    try:
        patient = models.get_patient_by_id(identifier)
        if not patient:
            return jsonify({'success': False, 'error': 'Patient not found'}), 404
        return jsonify({'success': True, 'data': patient})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/patients/<identifier>', methods=['PUT'])
def api_update_patient(identifier):
    try:
        data = request.get_json() or {}
        updated = models.update_patient(identifier, data)
        return jsonify({'success': True, 'message': 'Patient details updated successfully', 'data': updated})
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/patients/<identifier>/profile', methods=['GET'])
def api_get_patient_profile(identifier):
    try:
        profile = models.get_patient_full_profile(identifier)
        if not profile:
            return jsonify({'success': False, 'error': 'Patient not found'}), 404
        return jsonify({'success': True, 'data': profile})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
# REST API: DOCTORS & DEPARTMENTS
# ==========================================

@app.route('/api/departments', methods=['GET'])
def api_get_departments():
    try:
        depts = models.get_departments()
        return jsonify({'success': True, 'data': depts})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/doctors', methods=['GET'])
def api_get_doctors():
    try:
        dept_id = request.args.get('department_id')
        search = request.args.get('search', '')
        availability = request.args.get('availability')
        doctors = models.get_doctors(dept_id, search, availability)
        return jsonify({'success': True, 'data': doctors, 'count': len(doctors)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/doctors/<identifier>', methods=['GET'])
def api_get_doctor(identifier):
    try:
        doctor = models.get_doctor_by_id(identifier)
        if not doctor:
            return jsonify({'success': False, 'error': 'Doctor not found'}), 404
        return jsonify({'success': True, 'data': doctor})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/doctors', methods=['POST'])
def api_add_doctor():
    try:
        data = request.get_json() or {}
        doctor = models.add_doctor(data)
        return jsonify({'success': True, 'message': 'Doctor added successfully!', 'data': doctor}), 201
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/doctors/<identifier>', methods=['PUT'])
def api_update_doctor(identifier):
    try:
        data = request.get_json() or {}
        doctor = models.update_doctor(identifier, data)
        return jsonify({'success': True, 'message': 'Doctor information updated!', 'data': doctor})
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/doctors/<identifier>/toggle-availability', methods=['POST'])
def api_toggle_doctor_availability(identifier):
    try:
        data = request.get_json() or {}
        is_available = data.get('is_available')
        doctor = models.toggle_doctor_availability(identifier, is_available)
        status_text = "Available" if doctor['is_available'] == 1 else "On Leave / Unavailable"
        return jsonify({'success': True, 'message': f"Doctor status updated to {status_text}", 'data': doctor})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
# REST API: APPOINTMENTS
# ==========================================

@app.route('/api/appointments', methods=['GET'])
def api_get_appointments():
    try:
        status = request.args.get('status', '')
        date_filter = request.args.get('date', '')
        search = request.args.get('search', '')
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 50, type=int)
        apts = models.get_appointments(status, date_filter, search, page, limit)
        return jsonify({'success': True, 'data': apts, 'count': len(apts)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/appointments/slots', methods=['GET'])
def api_get_appointment_slots():
    try:
        doctor_id = request.args.get('doctor_id')
        apt_date = request.args.get('date')
        if not doctor_id or not apt_date:
            return jsonify({'success': False, 'error': 'doctor_id and date parameters are required'}), 400
        slots_data = models.get_doctor_time_slots(doctor_id, apt_date)
        return jsonify({'success': True, 'data': slots_data})
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/appointments', methods=['POST'])
def api_book_appointment():
    try:
        data = request.get_json() or {}
        apt = models.book_appointment(data)
        return jsonify({'success': True, 'message': f"Appointment {apt['appointment_id']} booked successfully!", 'data': apt}), 201
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/appointments/<identifier>/reschedule', methods=['POST'])
def api_reschedule_appointment(identifier):
    try:
        data = request.get_json() or {}
        new_date = data.get('new_date')
        new_time = data.get('new_time')
        reason = data.get('reason', '')
        if not new_date or not new_time:
            return jsonify({'success': False, 'error': 'New date and new time are required.'}), 400
        res = models.reschedule_appointment(identifier, new_date, new_time, reason)
        return jsonify({'success': True, 'message': res['message']})
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/appointments/<identifier>/cancel', methods=['POST'])
def api_cancel_appointment(identifier):
    try:
        data = request.get_json() or {}
        cancellation_reason = data.get('reason', 'Cancelled by administrator')
        res = models.cancel_appointment(identifier, cancellation_reason)
        return jsonify({'success': True, 'message': res['message']})
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/appointments/<identifier>/status', methods=['PUT'])
def api_update_appointment_status(identifier):
    try:
        data = request.get_json() or {}
        status = data.get('status')
        if not status:
            return jsonify({'success': False, 'error': 'Status is required'}), 400
        res = models.update_appointment_status(identifier, status)
        return jsonify({'success': True, 'message': f'Status updated to {status}', 'data': res})
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/appointments/cancelled', methods=['GET'])
def api_get_cancelled_appointments():
    try:
        cancelled = models.get_cancelled_appointments()
        return jsonify({'success': True, 'data': cancelled, 'count': len(cancelled)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
# REST API: PHARMACY
# ==========================================

@app.route('/api/pharmacy/medicines', methods=['GET'])
def api_get_medicines():
    try:
        search = request.args.get('search', '')
        category = request.args.get('category', '')
        stock_status = request.args.get('stock_status', '')
        medicines = models.get_medicines(search, category, stock_status)
        return jsonify({'success': True, 'data': medicines, 'count': len(medicines)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/pharmacy/alerts', methods=['GET'])
def api_get_pharmacy_alerts():
    try:
        alerts = models.get_pharmacy_alerts()
        return jsonify({'success': True, 'data': alerts})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/pharmacy/medicines', methods=['POST'])
def api_add_medicine():
    try:
        data = request.get_json() or {}
        res = models.add_medicine(data)
        return jsonify({'success': True, 'message': f"Medicine {res['name']} added with ID {res['medicine_id']}", 'data': res}), 201
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/pharmacy/medicines/<identifier>', methods=['PUT'])
def api_update_medicine(identifier):
    try:
        data = request.get_json() or {}
        res = models.update_medicine(identifier, data)
        return jsonify({'success': True, 'message': f"Medicine {res['name']} updated successfully", 'data': res})
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/pharmacy/medicines/<identifier>/stock', methods=['POST'])
def api_update_medicine_stock(identifier):
    try:
        data = request.get_json() or {}
        quantity = data.get('quantity')
        is_absolute = data.get('is_absolute', True)
        if quantity is None:
            return jsonify({'success': False, 'error': 'Quantity is required'}), 400
        res = models.update_medicine_stock(identifier, quantity, is_absolute)
        return jsonify({'success': True, 'message': f"Stock updated to {res['quantity']} ({res['stock_status']})", 'data': res})
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
# REST API: BILLING & PAYMENTS
# ==========================================

@app.route('/api/billing/bills', methods=['GET'])
def api_get_bills():
    try:
        search = request.args.get('search', '')
        payment_status = request.args.get('payment_status', '')
        payment_method = request.args.get('payment_method', '')
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 50, type=int)
        bills = models.get_bills(search, payment_status, payment_method, page, limit)
        return jsonify({'success': True, 'data': bills, 'count': len(bills)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/billing/bills', methods=['POST'])
def api_create_bill():
    try:
        data = request.get_json() or {}
        bill = models.create_bill(data)
        return jsonify({'success': True, 'message': f"Bill {bill['bill_id']} generated successfully!", 'data': bill}), 201
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/billing/bills/<identifier>', methods=['GET'])
def api_get_bill(identifier):
    try:
        bill = models.get_bill_by_id(identifier)
        if not bill:
            return jsonify({'success': False, 'error': 'Bill not found'}), 404
        return jsonify({'success': True, 'data': bill})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/billing/bills/<identifier>/status', methods=['PUT'])
def api_update_bill_status(identifier):
    try:
        data = request.get_json() or {}
        status = data.get('payment_status')
        paid_amount = data.get('paid_amount')
        payment_method = data.get('payment_method')
        if not status:
            return jsonify({'success': False, 'error': 'Payment status is required'}), 400
        bill = models.update_bill_payment_status(identifier, status, paid_amount, payment_method)
        return jsonify({'success': True, 'message': f"Bill status updated to {status}", 'data': bill})
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
# GLOBAL SEARCH
# ==========================================

@app.route('/api/search', methods=['GET'])
def api_global_search():
    """Performs global search across patients, doctors, medicines, and appointments."""
    query = request.args.get('q', '').strip()
    if not query or len(query) < 2:
        return jsonify({'success': True, 'data': {'patients': [], 'doctors': [], 'medicines': [], 'bills': []}})

    try:
        patients = models.get_patients(search=query, limit=5)
        doctors = models.get_doctors(search=query)
        medicines = models.get_medicines(search=query)[:5]
        bills = models.get_bills(search=query, limit=5)

        return jsonify({
            'success': True,
            'data': {
                'patients': patients,
                'doctors': doctors[:5],
                'medicines': medicines,
                'bills': bills
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"============================================================")
    print(f"  MEDAXIS - Hospital Management System (Admin Portal)       ")
    print(f"  Running on: http://127.0.0.1:{port}                      ")
    print(f"============================================================")
    app.run(host='0.0.0.0', port=port, debug=True)
