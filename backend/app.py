from flask import Flask, jsonify, request, session
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, timedelta

# Import AI service
from ai_service import ModelManager

app = Flask(__name__)

# cors - reads allowed origin from env var, falls back to localhost for dev
CORS_ORIGIN = os.environ.get('CORS_ORIGIN', 'http://127.0.0.1:3000')
CORS(app,
     supports_credentials=True,
     origins=[CORS_ORIGIN],
     allow_headers=['Content-Type'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

# session config - secret key from env var (MUST be set in production)
app.secret_key = os.environ.get('SECRET_KEY', 'parking-booking-dev-key-change-in-production')
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True

bcrypt = Bcrypt(app)  #password hashing

# ============= PUBLIC ENDPOINTS!!! ============================================

@app.route('/')
def home():
    return "Parking Booking System API"


# ============= AI HEALTH CHECK ENDPOINT ======================================

@app.route('/api/ai/health', methods=['GET'])
def ai_health_check():
    """
    Health check endpoint for AI service.
    
    Returns:
        - provider: current provider type ("local" or "external")
        - model_name: name of loaded model (or null if not loaded)
        - is_loaded: whether model is currently loaded in memory
        - is_healthy: boolean health status of provider
        - config: current AI configuration
    """
    try:
        model_manager = ModelManager()
        health_data = model_manager.health_check()
        
        return jsonify({
            'provider': health_data.get('provider'),
            'model_name': health_data.get('model_name'),
            'is_loaded': health_data.get('is_loaded', False),
            'is_healthy': health_data.get('is_healthy'),
            'config': health_data.get('config', {}),
            'fallback_occurred': health_data.get('fallback_occurred', False)
        })
    except Exception as e:
        return jsonify({
            'error': f'AI health check failed: {str(e)}',
            'is_healthy': False
        }), 500

@app.route('/api/spaces') #get parking_slot spaces / numbers yada yada
def get_parking_spaces():

    
    db_conn = sqlite3.connect('database.db') #opens connection to the database
    db_conn.row_factory = sqlite3.Row #method to be able to access column by name
    db_cursor = db_conn.cursor() #cursor is like the command
    db_cursor.execute('SELECT * FROM parking_slots WHERE is_restricted = 0')
    fetched_slots = db_cursor.fetchall() #dumps results to fetched_slots
    db_conn.close() #closes connection

    # creates parking_bay_list, list of dictionaries of parking slot numbers
    parking_bay_list = []
    for slot_row in fetched_slots:
        parking_bay_list.append({
            'parking_slot_number': slot_row['parking_slot_number']
        })


    return jsonify(parking_bay_list)


# ============= USER ENDPOINTS!!! ============================================

@app.route('/api/bookings', methods=['POST']) #user makes a booking 
def create_booking():

    #data is passed in
    #data contains user_id, parking_slot_nnumber, booking_date
    #we make a booking and put that data in and return the booking id. 

    booking_request = request.get_json() 

    #checks if all the required fields are in the reuqest
    mandatory_fields = ['user_id', 'parking_slot_number', 'booking_date']

    for field in mandatory_fields:
        if field not in booking_request:
            return jsonify({'error': f'Missing field: {field}'}), 400

    #pull out the fields from booking_request
    staff_id = booking_request['user_id']
    chosen_bay = booking_request['parking_slot_number']
    requested_date = booking_request['booking_date']

    #make sure the date is in the right format
    try:
        parsed_booking_date = datetime.strptime(requested_date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    #cant book in the past or too far ahead

    todays_date = datetime.now().date()

    #no past dates
    if parsed_booking_date < todays_date:
        return jsonify({'error': 'Cannot book dates in the past'}), 400

    #grab the max booking days from settings table
    settings_conn = sqlite3.connect('database.db')
    settings_cursor = settings_conn.cursor()
    settings_cursor.execute('SELECT setting_value FROM settings WHERE setting_key = ?', ('max_booking_days',))
    max_days_setting = settings_cursor.fetchone()
    allowed_advance_days = int(max_days_setting[0]) if max_days_setting else 14
    settings_conn.close()

    #check if theyre trying to book too far out
    furthest_allowed_date = todays_date + timedelta(days=allowed_advance_days)
    if parsed_booking_date > furthest_allowed_date:
        return jsonify({'error': f'Cannot book more than {allowed_advance_days} days in advance'}), 400

    #timestamp for when this booking was made
    timestamp_now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')


    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #check if valid parking_slot_numebr
    db_cursor.execute('SELECT * FROM parking_slots WHERE parking_slot_number = ?', (chosen_bay,))
    matched_bay = db_cursor.fetchone()

    if matched_bay is None:
        return jsonify({'error': 'Invalid parking slot'}), 400

    #is the space out of service
    db_cursor.execute('SELECT status FROM parking_space_status WHERE parking_slot_number = ?', (chosen_bay,))
    bay_condition = db_cursor.fetchone()

    if bay_condition and bay_condition['status'] == 'out_of_service':
        db_conn.close()
        return jsonify({'error': 'This parking space is currently out of service'}), 400

    #does this user even exist
    db_cursor.execute('SELECT * FROM users WHERE id = ?', (staff_id,))
    found_user = db_cursor.fetchone()

    if found_user is None:
        db_conn.close()  #close db
        return jsonify({'error': 'Invalid user_id'}), 400

    #check if someones already booked this spot
    db_cursor.execute('''
        SELECT * FROM bookings
        WHERE parking_slot_number = ? AND booking_date = ?
    ''', (chosen_bay, requested_date))

    conflicting_booking = db_cursor.fetchone()

    if conflicting_booking is not None:
        return jsonify({'error': 'This slot is already booked for that date'}), 400

    #put the booking in the database
    db_cursor.execute('''
        INSERT INTO bookings (user_id, parking_slot_number, created_at, booking_date)
        VALUES (?, ?, ?, ?)
    ''', (staff_id, chosen_bay, timestamp_now, requested_date))

    #get the id of the booking we just made
    new_booking_id = db_cursor.lastrowid

    #save and close
    db_conn.commit()
    db_conn.close()

    #send back the booking info
    return jsonify({
        'success': True,
        'booking_id': new_booking_id,
        'message': 'Booking created successfully'
    })

@app.route('/api/my-bookings', methods=['GET']) #a user checks their bookings info
def get_my_bookings():

    #check if logged in
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    #get user_id from the request params
    requesting_user_id = request.args.get('user_id')

    #make sure they sent a user_id
    if requesting_user_id is None:
        return jsonify({'error': 'user_id is required'}), 400

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row  # ← ADDED
    db_cursor = db_conn.cursor()

    #grab all bookings for this user
    db_cursor.execute('''
        SELECT booking_id, parking_slot_number, created_at, booking_date
        FROM bookings
        WHERE user_id = ?
    ''', (requesting_user_id,))  # ← FIXED (tuple with comma)

    raw_booking_rows = db_cursor.fetchall()

    #turn it into a list of dicts
    my_booking_records = []
    for booking_row in raw_booking_rows:
        my_booking_records.append({
            'booking_id': booking_row['booking_id'],
            'parking_slot_number': booking_row['parking_slot_number'],
            'created_at': booking_row['created_at'],
            'booking_date': booking_row['booking_date']
        })

    db_conn.commit()
    db_conn.close()  # 
    return jsonify(my_booking_records)



@app.route('/api/spaces/available', methods=['GET'])
def get_available_spaces():
    #get the date they want to check
    selected_date = request.args.get('date')

    #make sure they sent a date
    if selected_date is None:
        return jsonify({"error": "empty date entered"}), 404

    #check date format is right
    try:
        datetime.strptime(selected_date, '%Y-%m-%d').date()  # validate format only
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_cursor = db_conn.cursor()

    #find spots that arent booked, arent out of service, and arent restricted
    db_cursor.execute('''
        SELECT parking_slot_number
        FROM parking_slots
        WHERE is_restricted = 0
        AND parking_slot_number NOT IN (
            SELECT parking_slot_number
            FROM bookings
            WHERE booking_date = ?
        )
        AND parking_slot_number NOT IN (
            SELECT parking_slot_number
            FROM parking_space_status
            WHERE status = 'out_of_service'
        )
    ''', (selected_date,))

    #get results and make a list
    open_bays = db_cursor.fetchall()
    available_spaces = []

    for bay_row in open_bays:
        available_spaces.append({
            'parking_slot_number': bay_row[0]
        })

    db_conn.commit()
    db_conn.close()
    return jsonify(available_spaces)
    
    # Close and return
   

#for users to delete their bookings
@app.route('/api/bookings/<booking_id>', methods=['DELETE'])
def delete_booking(booking_id):
    #get user_id from params
    requesting_staff_id = request.args.get('user_id')

    #user_id cant be empty
    if requesting_staff_id is None:
        return jsonify({"error": "empty user_id entered"}), 400

    #booking_id needs to be a numebr
    try:
        booking_id = int(booking_id)  # Convert string to int
    except ValueError:
        return jsonify({"error": "booking_id error"}), 400

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #find the booking
    db_cursor.execute('SELECT * FROM bookings WHERE booking_id = ?', (booking_id,))
    target_booking = db_cursor.fetchone()

    #does it exist
    if target_booking is None:
        db_conn.close()
        return jsonify({"error": "no booking found"}), 404

    #make sure the booking actualy belongs to this user
    if target_booking['user_id'] != int(requesting_staff_id):  # Convert requesting_staff_id to int too!
        db_conn.close()
        return jsonify({"error": "booking error (booking does not belong to user)"}), 403

    #delete it
    db_cursor.execute('DELETE FROM bookings WHERE booking_id = ?', (booking_id,))

    #save and close
    db_conn.commit()
    db_conn.close()

    #done
    return jsonify({
        'success': True,
        'message': 'Booking cancelled successfully'
    })



# ============= AUTH ENDPOINTS!!! ============================================

#login stuff
@app.route('/api/login', methods=['POST'])
def login():
    #get email and password from the request
    login_credentials = request.get_json()
    entered_email = login_credentials.get('email')
    entered_password = login_credentials.get('password')

    #both fields required
    if not entered_email or not entered_password:
        return jsonify({'success': False, 'error': 'Email and password required'}), 400

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #find user by email
    db_cursor.execute('SELECT * FROM users WHERE email = ?', (entered_email,))
    matched_user = db_cursor.fetchone()

    #close db
    db_conn.close()

    #does the user exist
    if matched_user is None:
        return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

    #check password
    if not bcrypt.check_password_hash(matched_user['password'], entered_password):
        return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

    #save user info to session so we know theyre logged in
    session['user_id'] = matched_user['id']
    session['email'] = matched_user['email']
    session['role'] = matched_user['role']

    #send back success with their role
    return jsonify({'success': True, 'role': matched_user['role']})


#logout
@app.route('/api/logout', methods=['POST'])
def logout():
    #wipe the session
    session.clear()

    #done
    return jsonify({'success': True, 'message': 'Logged out'})


#admin gets all bookings
@app.route('/api/admin/all-bookings', methods=['GET'])
def get_all_bookings():
    #check if logged in
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    #must be admin
    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #get all bookings with user info joined in

    db_cursor.execute('''
        SELECT
            bookings.booking_id,
            bookings.parking_slot_number,
            bookings.booking_date,
            bookings.created_at,
            users.name,
            users.email
        FROM bookings
        JOIN users ON bookings.user_id = users.id
        ORDER BY bookings.booking_date DESC
    ''')

    fetched_bookings = db_cursor.fetchall()

    #turn into list of dicts
    complete_booking_list = []

    for booking_row in fetched_bookings:
        complete_booking_list.append({
            'booking_id': booking_row['booking_id'],
            'parking_slot_number': booking_row['parking_slot_number'],
            'booking_date': booking_row['booking_date'],
            'created_at': booking_row['created_at'],
            'user_name': booking_row['name'],
            'user_email': booking_row['email']
        })


    #close and return
    db_conn.close()
    return jsonify(complete_booking_list)

    pass

#check if user is authenticated
@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    #see if theyre logged in
    if 'user_id' in session:
        #send back their info
        return jsonify({
            'authenticated': True,
            'user': {
                'id': session['user_id'],
                'email': session['email'],
                'role': session['role']
            }
        })
    
    #not logged in
    return jsonify({'authenticated': False}), 401

# ============= ADMIN USER MANAGEMENT ENDPOINTS!!! ============================================

#admin grid view - shows all bookings in a calendar type thing
@app.route('/api/admin/grid-view', methods=['GET'])
def get_booking_grid():
    #auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    #get date range, defaults to 7 days
    from datetime import datetime, timedelta

    todays_date = datetime.now().date()
    day_range = int(request.args.get('days', 7))  # Default 7 days

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #grab all parking slots from db
    db_cursor.execute('SELECT parking_slot_number FROM parking_slots')
    all_slots = [str(row['parking_slot_number']) for row in db_cursor.fetchall()]

    #grab bookings within the date range
    range_end_date = todays_date + timedelta(days=day_range)

    db_cursor.execute('''
        SELECT
            bookings.booking_date,
            bookings.parking_slot_number,
            bookings.booking_id,
            users.name,
            users.email
        FROM bookings
        JOIN users ON bookings.user_id = users.id
        WHERE bookings.booking_date >= ? AND bookings.booking_date < ?
        ORDER BY bookings.booking_date, bookings.parking_slot_number
    ''', (todays_date.isoformat(), range_end_date.isoformat()))

    bookings_in_range = db_cursor.fetchall()
    db_conn.close()

    #build the grid - each date has all slots from db
    booking_calendar = {}

    #fill in empty grid first
    for i in range(day_range):
        calendar_date = (todays_date + timedelta(days=i)).isoformat()
        booking_calendar[calendar_date] = {slot: None for slot in all_slots}

    #now put the actual bookings in
    for each_booking in bookings_in_range:
        booked_date = each_booking['booking_date']
        booked_space = str(each_booking['parking_slot_number'])

        if booked_date in booking_calendar:
            booking_calendar[booked_date][booked_space] = {
                'booking_id': each_booking['booking_id'],
                'user_name': each_booking['name'],
                'user_email': each_booking['email']
            }

    return jsonify(booking_calendar)


#get all users for admin
@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    #auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #grab all users
    db_cursor.execute('SELECT id, name, email, role FROM users ORDER BY name')
    fetched_users = db_cursor.fetchall()

    #turn into list of dicts
    staff_roster = []
    for person in fetched_users:
        staff_roster.append({
            'id': person['id'],
            'name': person['name'],
            'email': person['email'],
            'role': person['role']
        })

    db_conn.close()
    return jsonify(staff_roster)


#admin creates a new user
@app.route('/api/admin/users', methods=['POST'])
def create_user():
    #auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    #get the new user data
    new_user_data = request.get_json()

    #make sure all fields are there
    mandatory_fields = ['name', 'email', 'password', 'role']
    for field in mandatory_fields:
        if field not in new_user_data:
            return jsonify({'error': f'Missing field: {field}'}), 400

    new_name = new_user_data['name']
    new_email = new_user_data['email']
    new_password = new_user_data['password']
    assigned_role = new_user_data['role']

    #role has to be staff or admin
    if assigned_role not in ['staff', 'admin']:
        return jsonify({'error': 'Role must be either "staff" or "admin"'}), 400

    #basic email check
    if '@' not in new_email:
        return jsonify({'error': 'Invalid email format'}), 400

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #email cant already be taken
    db_cursor.execute('SELECT * FROM users WHERE email = ?', (new_email,))
    duplicate_check = db_cursor.fetchone()

    if duplicate_check:
        db_conn.close()
        return jsonify({'error': 'Email already exists'}), 400

    #hash the password
    encrypted_password = bcrypt.generate_password_hash(new_password).decode('utf-8')

    #add user to db
    db_cursor.execute('''
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
    ''', (new_name, new_email, encrypted_password, assigned_role))

    created_user_id = db_cursor.lastrowid

    db_conn.commit()
    db_conn.close()

    return jsonify({
        'success': True,
        'user_id': created_user_id,
        'message': 'User created successfully'
    })


#admin bulk-imports users from csv
@app.route('/api/admin/users/import', methods=['POST'])
def import_users():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    import_data = request.get_json()
    users_to_import = import_data.get('users', [])

    if not users_to_import:
        return jsonify({'error': 'No users provided'}), 400

    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    created = 0
    skipped = []

    for user in users_to_import:
        name     = str(user.get('name', '')).strip()
        email    = str(user.get('email', '')).strip()
        password = str(user.get('password', '')).strip()
        role     = str(user.get('role', '')).strip().lower()

        if not name:
            skipped.append({'email': email or '(empty)', 'reason': 'Missing name'})
            continue
        if not email or '@' not in email:
            skipped.append({'email': email or '(empty)', 'reason': 'Invalid or missing email'})
            continue
        if not password:
            skipped.append({'email': email, 'reason': 'Missing password'})
            continue
        if role not in ['staff', 'admin']:
            skipped.append({'email': email, 'reason': f'Invalid role "{role}" — must be staff or admin'})
            continue

        db_cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        if db_cursor.fetchone():
            skipped.append({'email': email, 'reason': 'Email already exists'})
            continue

        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        db_cursor.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            (name, email, hashed_pw, role)
        )
        created += 1

    db_conn.commit()
    db_conn.close()

    return jsonify({'success': True, 'created': created, 'skipped': skipped})


#admin deletes a user
@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    #auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    #cant delete yourself lol
    if session['user_id'] == user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #does the user exist
    db_cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    target_user = db_cursor.fetchone()

    if not target_user:
        db_conn.close()
        return jsonify({'error': 'User not found'}), 404

    #delete their bookings first otherwise foreign key breaks
    db_cursor.execute('DELETE FROM bookings WHERE user_id = ?', (user_id,))

    #then delete the user
    db_cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))

    db_conn.commit()
    db_conn.close()
    
    return jsonify({
        'success': True,
        'message': 'User deleted successfully'
    })


#admin changes a users password
@app.route('/api/admin/users/<int:user_id>/password', methods=['PUT'])
def change_user_password(user_id):
    #auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    #get the new pasword
    password_data = request.get_json()

    if 'password' not in password_data:
        return jsonify({'error': 'Missing password field'}), 400

    updated_password = password_data['password']

    #password needs to be 6+ chars
    if len(updated_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #does the user exist
    db_cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    target_user = db_cursor.fetchone()

    if not target_user:
        db_conn.close()
        return jsonify({'error': 'User not found'}), 404

    #hash the new password
    encrypted_password = bcrypt.generate_password_hash(updated_password).decode('utf-8')

    #update it in db
    db_cursor.execute('UPDATE users SET password = ? WHERE id = ?',
                   (encrypted_password, user_id))

    db_conn.commit()
    db_conn.close()
    
    return jsonify({
        'success': True,
        'message': 'Password updated successfully'
    })


#admin changes a users role
@app.route('/api/admin/users/<int:user_id>/role', methods=['PUT'])
def change_user_role(user_id):
    #auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    #cant change your own role
    if session['user_id'] == user_id:
        return jsonify({'error': 'Cannot change your own role'}), 400

    #get the new role
    role_data = request.get_json()

    if 'role' not in role_data:
        return jsonify({'error': 'Missing role field'}), 400

    updated_role = role_data['role']

    #has to be staff or admin
    if updated_role not in ['staff', 'admin']:
        return jsonify({'error': 'Role must be either "staff" or "admin"'}), 400

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #does user exist
    db_cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    target_user = db_cursor.fetchone()

    if not target_user:
        db_conn.close()
        return jsonify({'error': 'User not found'}), 404

    #update the role
    db_cursor.execute('UPDATE users SET role = ? WHERE id = ?',
                   (updated_role, user_id))

    db_conn.commit()
    db_conn.close()
    
    return jsonify({
        'success': True,
        'message': f'User role updated to {updated_role}'
    })


#admin gets all slots including restricted ones (with is_restricted flag)
@app.route('/api/admin/slots', methods=['GET'])
def get_all_slots_admin():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()
    db_cursor.execute('SELECT parking_slot_number, is_restricted FROM parking_slots')
    rows = db_cursor.fetchall()
    db_conn.close()

    return jsonify([{
        'parking_slot_number': row['parking_slot_number'],
        'is_restricted': bool(row['is_restricted'])
    } for row in rows])


#admin toggles restricted status on a slot
@app.route('/api/admin/parking-slots/<string:parking_slot_number>/restricted', methods=['PUT'])
def toggle_slot_restricted(parking_slot_number):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    if 'is_restricted' not in data:
        return jsonify({'error': 'Missing is_restricted field'}), 400

    is_restricted = 1 if data['is_restricted'] else 0

    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    db_cursor.execute('SELECT 1 FROM parking_slots WHERE parking_slot_number = ?', (parking_slot_number,))
    if not db_cursor.fetchone():
        db_conn.close()
        return jsonify({'error': 'Slot not found'}), 404

    db_cursor.execute('UPDATE parking_slots SET is_restricted = ? WHERE parking_slot_number = ?',
                      (is_restricted, parking_slot_number))
    db_conn.commit()
    db_conn.close()

    label = 'restricted' if is_restricted else 'unrestricted'
    return jsonify({'success': True, 'message': f'Slot {parking_slot_number} is now {label}'})


#admin creates a new parking slot
@app.route('/api/admin/parking-slots', methods=['POST'])
def create_parking_slot():
    #auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    #get the new slot data
    slot_data = request.get_json()

    #make sure slot_number field is there
    if 'parking_slot_number' not in slot_data:
        return jsonify({'error': 'Missing field: parking_slot_number'}), 400

    parking_slot_number = slot_data['parking_slot_number']

    #validate it's not empty and is alphanumeric
    parking_slot_str = str(parking_slot_number).strip()

    if not parking_slot_str:
        return jsonify({'error': 'parking_slot_number cannot be empty'}), 400

    #allow alphanumeric (letters and numbers), no special chars
    if not parking_slot_str.replace(' ', '').isalnum():
        return jsonify({'error': 'parking_slot_number can only contain letters and numbers'}), 400

    #max length of 20 chars
    if len(parking_slot_str) > 20:
        return jsonify({'error': 'parking_slot_number cannot exceed 20 characters'}), 400

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #check if slot already exists
    db_cursor.execute('SELECT * FROM parking_slots WHERE parking_slot_number = ?', (parking_slot_number,))
    duplicate_check = db_cursor.fetchone()

    if duplicate_check:
        db_conn.close()
        return jsonify({'error': 'Parking slot already exists'}), 409

    is_restricted = 1 if slot_data.get('is_restricted') else 0

    #insert into parking_slots table
    db_cursor.execute('''
        INSERT INTO parking_slots (parking_slot_number, is_restricted)
        VALUES (?, ?)
    ''', (parking_slot_number, is_restricted))

    #insert into parking_space_status table with default 'available' status
    db_cursor.execute('''
        INSERT INTO parking_space_status (parking_slot_number, status, updated_at)
        VALUES (?, 'available', datetime('now'))
    ''', (parking_slot_number,))

    db_conn.commit()
    db_conn.close()

    return jsonify({
        'success': True,
        'parking_slot_number': parking_slot_number,
        'message': f'Parking slot {parking_slot_number} created successfully'
    })


#admin deletes a parking slot
@app.route('/api/admin/parking-slots/<string:parking_slot_number>', methods=['DELETE'])
def delete_parking_slot(parking_slot_number):
    #auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #does the slot exist
    db_cursor.execute('SELECT * FROM parking_slots WHERE parking_slot_number = ?', (parking_slot_number,))
    target_slot = db_cursor.fetchone()

    if not target_slot:
        db_conn.close()
        return jsonify({'error': 'Parking slot not found'}), 404

    #cascade delete: delete bookings for this slot first
    db_cursor.execute('DELETE FROM bookings WHERE parking_slot_number = ?', (parking_slot_number,))

    #delete the space status record
    db_cursor.execute('DELETE FROM parking_space_status WHERE parking_slot_number = ?', (parking_slot_number,))

    #delete the parking slot
    db_cursor.execute('DELETE FROM parking_slots WHERE parking_slot_number = ?', (parking_slot_number,))

    db_conn.commit()
    db_conn.close()

    return jsonify({
        'success': True,
        'message': f'Parking slot {parking_slot_number} deleted successfully'
    })


#admin can manually book a spot, can also override exisitng bookings
@app.route('/api/admin/bookings/manual', methods=['POST'])
def admin_manual_booking():
    #auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    #get booking data
    manual_booking_data = request.get_json()

    #all fields needed
    mandatory_fields = ['user_id', 'parking_slot_number', 'booking_date']
    for field in mandatory_fields:
        if field not in manual_booking_data:
            return jsonify({'error': f'Missing field: {field}'}), 400

    target_staff_id = manual_booking_data['user_id']
    chosen_bay = manual_booking_data['parking_slot_number']
    requested_date = manual_booking_data['booking_date']
    should_override = manual_booking_data.get('override', False)  #admin can override exisitng bookings

    #check date foramt
    try:
        datetime.strptime(requested_date, '%Y-%m-%d').date()  # validate format only
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    #timestamp
    timestamp_now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #does user exist
    db_cursor.execute('SELECT * FROM users WHERE id = ?', (target_staff_id,))
    found_user = db_cursor.fetchone()

    if found_user is None:
        db_conn.close()
        return jsonify({'error': 'Invalid user_id'}), 400

    #is the parking slot real
    db_cursor.execute('SELECT * FROM parking_slots WHERE parking_slot_number = ?', (chosen_bay,))
    matched_bay = db_cursor.fetchone()

    if matched_bay is None:
        db_conn.close()
        return jsonify({'error': 'Invalid parking slot'}), 400

    #check if someones already booked it
    db_cursor.execute('''
        SELECT * FROM bookings
        WHERE parking_slot_number = ? AND booking_date = ?
    ''', (chosen_bay, requested_date))

    conflicting_booking = db_cursor.fetchone()

    if conflicting_booking is not None and not should_override:
        #already booked and they didnt choose to override
        db_conn.close()
        return jsonify({
            'error': 'Slot already booked',
            'existing_booking': {
                'booking_id': conflicting_booking['booking_id'],
                'user_id': conflicting_booking['user_id']
            },
            'can_override': True
        }), 409  # 409 Conflict status

    #override mode - delete the old booking first
    if conflicting_booking is not None and should_override:
        db_cursor.execute('DELETE FROM bookings WHERE booking_id = ?',
                      (conflicting_booking['booking_id'],))

    #put in the new booking
    db_cursor.execute('''
        INSERT INTO bookings (user_id, parking_slot_number, created_at, booking_date)
        VALUES (?, ?, ?, ?)
    ''', (target_staff_id, chosen_bay, timestamp_now, requested_date))

    new_booking_id = db_cursor.lastrowid

    db_conn.commit()
    db_conn.close()

    return jsonify({
        'success': True,
        'booking_id': new_booking_id,
        'message': 'Booking created successfully' + (' (overridden existing booking)' if should_override else '')
    })

#admin deletes any booking by id
@app.route('/api/admin/bookings/<int:booking_id>', methods=['DELETE'])
def admin_delete_booking(booking_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    db_conn = sqlite3.connect('database.db')
    db_cursor = db_conn.cursor()

    db_cursor.execute('SELECT * FROM bookings WHERE booking_id = ?', (booking_id,))
    if not db_cursor.fetchone():
        db_conn.close()
        return jsonify({'error': 'Booking not found'}), 404

    db_cursor.execute('DELETE FROM bookings WHERE booking_id = ?', (booking_id,))
    db_conn.commit()
    db_conn.close()

    return jsonify({'success': True, 'message': 'Booking deleted successfully'})


#booking info for the hover popup on admin grid
@app.route('/api/admin/booking-info', methods=['GET'])
def get_booking_info():
    #auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    #get the space and date from params
    queried_space = request.args.get('space')
    queried_date = request.args.get('date')

    if not queried_space or not queried_date:
        return jsonify({'error': 'Missing space or date parameter'}), 400

    #connect to db
    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #find the booking
    db_cursor.execute('''
        SELECT
            bookings.booking_id,
            bookings.created_at,
            users.name,
            users.email,
            users.role
        FROM bookings
        JOIN users ON bookings.user_id = users.id
        WHERE bookings.parking_slot_number = ? AND bookings.booking_date = ?
    ''', (queried_space, queried_date))

    found_booking = db_cursor.fetchone()
    db_conn.close()

    if found_booking:
        return jsonify({
            'booking_id': found_booking['booking_id'],
            'user_name': found_booking['name'],
            'user_email': found_booking['email'],
            'user_role': found_booking['role'],
            'created_at': found_booking['created_at']
        })
    else:
        return jsonify({'error': 'No booking found'}), 404

# ===================================== SETTINGS ENDPOINTS!!! =======================================

#get all the settings and stats for admin dashboard
@app.route('/api/admin/settings', methods=['GET'])
def get_settings():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    db_conn = sqlite3.connect('database.db')
    db_conn.row_factory = sqlite3.Row
    db_cursor = db_conn.cursor()

    #max booking days
    db_cursor.execute('SELECT * FROM settings WHERE setting_key = ?', ('max_booking_days',))
    max_days_setting = db_cursor.fetchone()
    current_max_days = int(max_days_setting['setting_value']) if max_days_setting else 14

    #parking space statuses
    db_cursor.execute('SELECT * FROM parking_space_status ORDER BY parking_slot_number')
    all_bays = db_cursor.fetchall()

    bay_status_list = []
    for bay in all_bays:
        bay_status_list.append({
            'parking_slot_number': bay['parking_slot_number'],
            'status': bay['status'],
            'updated_at': bay['updated_at']
        })

    #some stats for the dashboard
    db_cursor.execute('SELECT COUNT(*) as count FROM users')
    registered_user_count = db_cursor.fetchone()['count']

    db_cursor.execute('SELECT COUNT(*) as count FROM bookings')
    total_booking_count = db_cursor.fetchone()['count']

    todays_date = datetime.now().date().isoformat()
    db_cursor.execute('SELECT COUNT(*) as count FROM bookings WHERE booking_date >= ?', (todays_date,))
    upcoming_booking_count = db_cursor.fetchone()['count']

    db_cursor.execute('''
        SELECT parking_slot_number, COUNT(*) as count
        FROM bookings
        GROUP BY parking_slot_number
        ORDER BY count DESC
        LIMIT 1
    ''')
    top_bay_result = db_cursor.fetchone()
    most_popular_bay = top_bay_result['parking_slot_number'] if top_bay_result else None

    db_conn.close()

    return jsonify({
        'max_booking_days': current_max_days,
        'space_statuses': bay_status_list,
        'statistics': {
            'total_users': registered_user_count,
            'total_bookings': total_booking_count,
            'active_bookings': upcoming_booking_count,
            'most_booked_space': most_popular_bay
        }
    })


#change max booking days
@app.route('/api/admin/settings/max-days', methods=['PUT'])
def update_max_booking_days():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    settings_input = request.get_json()

    if 'max_days' not in settings_input:
        return jsonify({'error': 'Missing max_days field'}), 400

    new_max_days = settings_input['max_days']

    #make sure its a valid number
    try:
        new_max_days = int(new_max_days)
        if new_max_days < 1 or new_max_days > 365:
            return jsonify({'error': 'Max days must be between 1 and 365'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid max_days value'}), 400

    db_conn = sqlite3.connect('database.db')
    db_cursor = db_conn.cursor()

    db_cursor.execute('''
        INSERT OR REPLACE INTO settings (setting_key, setting_value, updated_at)
        VALUES ('max_booking_days', ?, datetime('now'))
    ''', (str(new_max_days),))

    db_conn.commit()
    db_conn.close()

    return jsonify({
        'success': True,
        'max_booking_days': new_max_days,
        'message': 'Max booking days updated successfully'
    })


#change parking space status (available or out of service)
@app.route('/api/admin/settings/space-status', methods=['PUT'])
def update_space_status():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    if session['role'] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    status_update_data = request.get_json()

    if 'parking_slot_number' not in status_update_data or 'status' not in status_update_data:
        return jsonify({'error': 'Missing required fields'}), 400

    target_bay_number = status_update_data['parking_slot_number']
    new_bay_status = status_update_data['status']

    #status has to be available or out_of_service
    if new_bay_status not in ['available', 'out_of_service']:
        return jsonify({'error': 'Invalid status. Must be "available" or "out_of_service"'}), 400

    db_conn = sqlite3.connect('database.db')
    db_cursor = db_conn.cursor()

    #check slot exists in db
    db_cursor.execute('SELECT 1 FROM parking_slots WHERE parking_slot_number = ?', (str(target_bay_number),))
    if not db_cursor.fetchone():
        db_conn.close()
        return jsonify({'error': 'Invalid parking slot number'}), 400

    db_cursor.execute('''
        INSERT OR REPLACE INTO parking_space_status (parking_slot_number, status, updated_at)
        VALUES (?, ?, datetime('now'))
    ''', (target_bay_number, new_bay_status))

    db_conn.commit()
    db_conn.close()

    return jsonify({
        'success': True,
        'message': f'Space {target_bay_number} status updated to {new_bay_status}'
    })


if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=debug_mode, port=port)