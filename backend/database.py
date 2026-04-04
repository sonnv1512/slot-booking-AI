import sqlite3
from flask_bcrypt import Bcrypt

bcrypt = Bcrypt()

def init_db():
    # sets up all the tables and stuff

    # connect to db
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()

    # users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')

    # parking slots table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS parking_slots (
            parking_slot_number TEXT PRIMARY KEY,
            is_restricted INTEGER NOT NULL DEFAULT 0
        )
    ''')

    # bookings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            parking_slot_number TEXT NOT NULL,
            created_at TEXT NOT NULL,
            booking_date TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(parking_slot_number) REFERENCES parking_slots(parking_slot_number)
        )
    ''')

    # settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ''')

    # parking space status table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS parking_space_status (
            parking_slot_number TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'available',
            updated_at TEXT NOT NULL,
            FOREIGN KEY (parking_slot_number) REFERENCES parking_slots(parking_slot_number)
        )
    ''')

    # default parking slots
    parking_slots = ['60', '61', '62', '63', '64', '65']
    for slot in parking_slots:
        cursor.execute('''
            INSERT OR IGNORE INTO parking_slots (parking_slot_number) VALUES (?)
        ''', (slot,))

    # default space statuses
    for slot in parking_slots:
        cursor.execute('''
            INSERT OR IGNORE INTO parking_space_status (parking_slot_number, status, updated_at)
            VALUES (?, 'available', datetime('now'))
        ''', (slot,))

    # default settings
    cursor.execute('''
        INSERT OR IGNORE INTO settings (setting_key, setting_value, updated_at)
        VALUES ('max_booking_days', '14', datetime('now'))
    ''')

    # default users
    staff_password = bcrypt.generate_password_hash('password123').decode('utf-8')
    admin_password = bcrypt.generate_password_hash('adminpass').decode('utf-8')

    cursor.execute('''
        INSERT OR IGNORE INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
    ''', ('John Doe', 'john@school.com', staff_password, 'staff'))

    cursor.execute('''
        INSERT OR IGNORE INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
    ''', ('Mr Hampson', 'hampson@school.com', admin_password, 'admin'))

    # save it all
    conn.commit()
    conn.close()
    print("Database initialized!")

# run it if we execute this file directly
if __name__ == '__main__':
    init_db()
