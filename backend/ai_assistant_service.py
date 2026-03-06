import json
import os
import re
import sqlite3
from datetime import datetime, timedelta
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request


class AIAssistantService:
    def __init__(self, db_path='database.db', pending_action_key='assistant_pending_action'):
        self.db_path = db_path
        self.pending_action_key = pending_action_key
        self._load_env_files()

    def _load_env_files(self):
        env_candidates = [
            os.path.join(os.getcwd(), '.env'),
            os.path.join(os.path.dirname(__file__), '.env'),
            os.path.join(os.path.dirname(__file__), '..', '.env')
        ]

        seen_paths = set()
        for each_path in env_candidates:
            normalized_path = os.path.abspath(each_path)
            if normalized_path in seen_paths:
                continue
            seen_paths.add(normalized_path)

            if os.path.isfile(normalized_path):
                self._read_env_file(normalized_path)

    @staticmethod
    def _read_env_file(env_file_path):
        with open(env_file_path, 'r', encoding='utf-8') as env_file:
            for raw_line in env_file:
                line = raw_line.strip()

                if not line or line.startswith('#'):
                    continue

                if line.startswith('export '):
                    line = line[len('export '):].strip()

                if '=' not in line:
                    continue

                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()

                if not key:
                    continue

                if value and value[0] in ('"', "'") and value[-1] == value[0]:
                    value = value[1:-1]

                os.environ.setdefault(key, value)

    @staticmethod
    def _extract_json_object(raw_text):
        if not raw_text:
            return None

        cleaned_text = raw_text.strip()

        if cleaned_text.startswith('```'):
            cleaned_text = re.sub(r'^```(?:json)?', '', cleaned_text, flags=re.IGNORECASE).strip()
            cleaned_text = re.sub(r'```$', '', cleaned_text).strip()

        object_start = cleaned_text.find('{')
        object_end = cleaned_text.rfind('}')

        if object_start == -1 or object_end == -1 or object_end < object_start:
            return None

        possible_json = cleaned_text[object_start:object_end + 1]

        try:
            return json.loads(possible_json)
        except json.JSONDecodeError:
            return None

    @staticmethod
    def _coerce_int(raw_value):
        try:
            return int(raw_value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _coerce_iso_date(raw_date):
        if raw_date is None:
            return None

        normalized_text = str(raw_date).strip().lower()
        if not normalized_text:
            return None

        todays_date = datetime.now().date()

        if normalized_text in ['today', 'hom nay']:
            return todays_date.isoformat()

        if normalized_text in ['tomorrow', 'ngay mai']:
            return (todays_date + timedelta(days=1)).isoformat()

        if normalized_text in ['day after tomorrow', 'ngay kia']:
            return (todays_date + timedelta(days=2)).isoformat()

        try:
            parsed_date = datetime.strptime(normalized_text, '%Y-%m-%d').date()
            return parsed_date.isoformat()
        except ValueError:
            return None

    def _get_max_booking_days(self):
        db_conn = sqlite3.connect(self.db_path)
        db_cursor = db_conn.cursor()

        db_cursor.execute('SELECT setting_value FROM settings WHERE setting_key = ?', ('max_booking_days',))
        max_days_setting = db_cursor.fetchone()
        db_conn.close()

        return int(max_days_setting[0]) if max_days_setting else 14

    def get_user_bookings(self, user_id):
        db_conn = sqlite3.connect(self.db_path)
        db_conn.row_factory = sqlite3.Row
        db_cursor = db_conn.cursor()

        db_cursor.execute('''
            SELECT booking_id, parking_slot_number, created_at, booking_date
            FROM bookings
            WHERE user_id = ?
            ORDER BY booking_date ASC, parking_slot_number ASC
        ''', (user_id,))

        rows = db_cursor.fetchall()
        db_conn.close()

        my_booking_records = []
        for booking_row in rows:
            my_booking_records.append({
                'booking_id': booking_row['booking_id'],
                'parking_slot_number': booking_row['parking_slot_number'],
                'created_at': booking_row['created_at'],
                'booking_date': booking_row['booking_date']
            })

        return my_booking_records

    def get_available_spaces_for_date(self, selected_date):
        db_conn = sqlite3.connect(self.db_path)
        db_cursor = db_conn.cursor()

        db_cursor.execute('''
            SELECT parking_slot_number
            FROM parking_slots
            WHERE parking_slot_number NOT IN (
                SELECT parking_slot_number
                FROM bookings
                WHERE booking_date = ?
            )
            AND parking_slot_number NOT IN (
                SELECT parking_slot_number
                FROM parking_space_status
                WHERE status = 'out_of_service'
            )
            ORDER BY parking_slot_number ASC
        ''', (selected_date,))

        rows = db_cursor.fetchall()
        db_conn.close()

        available_spaces = []
        for row in rows:
            available_spaces.append({
                'parking_slot_number': row[0]
            })

        return available_spaces

    def get_booking_preview_for_user(self, user_id, booking_id):
        db_conn = sqlite3.connect(self.db_path)
        db_conn.row_factory = sqlite3.Row
        db_cursor = db_conn.cursor()

        db_cursor.execute('''
            SELECT booking_id, parking_slot_number, booking_date
            FROM bookings
            WHERE booking_id = ? AND user_id = ?
        ''', (booking_id, user_id))

        booking_row = db_cursor.fetchone()
        db_conn.close()

        if not booking_row:
            return None

        return {
            'booking_id': booking_row['booking_id'],
            'parking_slot_number': booking_row['parking_slot_number'],
            'booking_date': booking_row['booking_date']
        }

    def create_booking_for_user(self, user_id, parking_slot_number, booking_date):
        normalized_date = self._coerce_iso_date(booking_date)
        normalized_space = self._coerce_int(parking_slot_number)
        normalized_user_id = self._coerce_int(user_id)

        if normalized_user_id is None:
            return {'ok': False, 'status_code': 400, 'error': 'Invalid user_id'}

        if normalized_space is None:
            return {'ok': False, 'status_code': 400, 'error': 'Invalid parking slot number'}

        if normalized_date is None:
            return {'ok': False, 'status_code': 400, 'error': 'Invalid date format. Use YYYY-MM-DD'}

        parsed_booking_date = datetime.strptime(normalized_date, '%Y-%m-%d').date()
        todays_date = datetime.now().date()

        if parsed_booking_date < todays_date:
            return {'ok': False, 'status_code': 400, 'error': 'Cannot book dates in the past'}

        allowed_advance_days = self._get_max_booking_days()
        furthest_allowed_date = todays_date + timedelta(days=allowed_advance_days)

        if parsed_booking_date > furthest_allowed_date:
            return {
                'ok': False,
                'status_code': 400,
                'error': f'Cannot book more than {allowed_advance_days} days in advance'
            }

        timestamp_now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        db_conn = sqlite3.connect(self.db_path)
        db_conn.row_factory = sqlite3.Row
        db_cursor = db_conn.cursor()

        try:
            db_cursor.execute('SELECT * FROM parking_slots WHERE parking_slot_number = ?', (normalized_space,))
            matched_bay = db_cursor.fetchone()
            if matched_bay is None:
                return {'ok': False, 'status_code': 400, 'error': 'Invalid parking slot'}

            db_cursor.execute('SELECT status FROM parking_space_status WHERE parking_slot_number = ?', (normalized_space,))
            bay_condition = db_cursor.fetchone()
            if bay_condition and bay_condition['status'] == 'out_of_service':
                return {'ok': False, 'status_code': 400, 'error': 'This parking space is currently out of service'}

            db_cursor.execute('SELECT * FROM users WHERE id = ?', (normalized_user_id,))
            found_user = db_cursor.fetchone()
            if found_user is None:
                return {'ok': False, 'status_code': 400, 'error': 'Invalid user_id'}

            db_cursor.execute('''
                SELECT * FROM bookings
                WHERE parking_slot_number = ? AND booking_date = ?
            ''', (normalized_space, normalized_date))
            conflicting_booking = db_cursor.fetchone()
            if conflicting_booking is not None:
                return {'ok': False, 'status_code': 400, 'error': 'This slot is already booked for that date'}

            db_cursor.execute('''
                INSERT INTO bookings (user_id, parking_slot_number, created_at, booking_date)
                VALUES (?, ?, ?, ?)
            ''', (normalized_user_id, normalized_space, timestamp_now, normalized_date))

            created_booking_id = db_cursor.lastrowid
            db_conn.commit()

            return {
                'ok': True,
                'status_code': 200,
                'booking_id': created_booking_id,
                'parking_slot_number': normalized_space,
                'booking_date': normalized_date
            }
        finally:
            db_conn.close()

    def cancel_booking_for_user(self, user_id, booking_id):
        normalized_user_id = self._coerce_int(user_id)
        normalized_booking_id = self._coerce_int(booking_id)

        if normalized_user_id is None:
            return {'ok': False, 'status_code': 400, 'error': 'Invalid user_id'}

        if normalized_booking_id is None:
            return {'ok': False, 'status_code': 400, 'error': 'booking_id error'}

        db_conn = sqlite3.connect(self.db_path)
        db_conn.row_factory = sqlite3.Row
        db_cursor = db_conn.cursor()

        try:
            db_cursor.execute('SELECT * FROM bookings WHERE booking_id = ?', (normalized_booking_id,))
            target_booking = db_cursor.fetchone()

            if target_booking is None:
                return {'ok': False, 'status_code': 404, 'error': 'No booking found'}

            if target_booking['user_id'] != normalized_user_id:
                return {'ok': False, 'status_code': 403, 'error': 'This booking does not belong to the current user'}

            cancelled_date = target_booking['booking_date']
            cancelled_space = target_booking['parking_slot_number']

            db_cursor.execute('DELETE FROM bookings WHERE booking_id = ?', (normalized_booking_id,))
            db_conn.commit()

            return {
                'ok': True,
                'status_code': 200,
                'booking_id': normalized_booking_id,
                'booking_date': cancelled_date,
                'parking_slot_number': cancelled_space
            }
        finally:
            db_conn.close()

    def call_gemini_for_intent(self, user_message):
        api_key = os.getenv('GEMINI_API_KEY')
        print(f"Using Gemini API Key: {api_key}")
        if not api_key:
            return {'ok': False, 'error': 'missing_api_key'}

        model_name = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')
        todays_date = datetime.now().date().isoformat()

        system_prompt = f'''
You are an assistant for a parking slot booking app.
Today is {todays_date}.

You must return strict JSON only (no markdown, no extra text):
{{
  "intent": "list_available_slots | create_booking | list_my_bookings | cancel_booking | small_talk | unknown",
  "date": "YYYY-MM-DD or null",
  "slot_number": 60-65 or null,
  "booking_id": integer or null,
  "reply": "Short response for the user"
}}

Rules:
- Convert relative dates to YYYY-MM-DD.
- For booking actions: if missing date or slot or booking_id, keep null and ask clearly in reply.
- Do not invent values.
'''.strip()

        payload = {
            'system_instruction': {
                'parts': [{'text': system_prompt}]
            },
            'contents': [{
                'role': 'user',
                'parts': [{'text': user_message}]
            }],
            'generationConfig': {
                'temperature': 0.1,
                'responseMimeType': 'application/json'
            }
        }

        request_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{urllib_parse.quote(model_name, safe='')}:generateContent?key={urllib_parse.quote(api_key, safe='')}"
        )

        request_body = json.dumps(payload).encode('utf-8')
        gemini_request = urllib_request.Request(
            request_url,
            data=request_body,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        try:
            with urllib_request.urlopen(gemini_request, timeout=25) as gemini_response:
                response_text = gemini_response.read().decode('utf-8')
        except urllib_error.HTTPError as http_error:
            response_error = http_error.read().decode('utf-8', errors='ignore')
            return {
                'ok': False,
                'error': 'gemini_http_error',
                'details': f"{http_error.code}: {response_error}"
            }
        except Exception as request_error:
            return {
                'ok': False,
                'error': 'gemini_request_failed',
                'details': str(request_error)
            }

        try:
            decoded_response = json.loads(response_text)
        except json.JSONDecodeError:
            return {
                'ok': False,
                'error': 'invalid_gemini_response',
                'details': response_text
            }

        candidate_text = ''
        candidates = decoded_response.get('candidates', [])
        if candidates:
            parts = candidates[0].get('content', {}).get('parts', [])
            text_parts = [part.get('text', '') for part in parts if part.get('text')]
            candidate_text = ''.join(text_parts).strip()

        intent_payload = self._extract_json_object(candidate_text)
        if not intent_payload:
            return {
                'ok': False,
                'error': 'cannot_parse_intent',
                'details': candidate_text
            }

        valid_intents = {
            'list_available_slots',
            'create_booking',
            'list_my_bookings',
            'cancel_booking',
            'small_talk',
            'unknown'
        }

        parsed_intent = str(intent_payload.get('intent', 'unknown')).strip()
        if parsed_intent not in valid_intents:
            parsed_intent = 'unknown'

        parsed_date = self._coerce_iso_date(intent_payload.get('date'))
        parsed_slot = self._coerce_int(intent_payload.get('slot_number'))
        parsed_booking_id = self._coerce_int(intent_payload.get('booking_id'))
        parsed_reply = str(intent_payload.get('reply', '')).strip()

        return {
            'ok': True,
            'intent': parsed_intent,
            'date': parsed_date,
            'slot_number': parsed_slot,
            'booking_id': parsed_booking_id,
            'reply': parsed_reply
        }

    @staticmethod
    def _mark_session_modified(session_store):
        if hasattr(session_store, 'modified'):
            session_store.modified = True

    def handle_chat_request(self, current_user_id, user_message, session_store):
        parsed_intent = self.call_gemini_for_intent(user_message)
        if not parsed_intent.get('ok'):
            if parsed_intent.get('error') == 'missing_api_key':
                return {
                    'success': False,
                    'reply': 'GEMINI_API_KEY missing_api_key at .env'
                }, 503

            return {
                'success': False,
                'reply': 'AI assistant error let try again.',
                'details': parsed_intent.get('details', '')
            }, 502

        intent = parsed_intent.get('intent')
        inferred_date = parsed_intent.get('date')
        inferred_slot = parsed_intent.get('slot_number')
        inferred_booking_id = parsed_intent.get('booking_id')
        ai_reply = parsed_intent.get('reply') or ''

        if intent == 'list_available_slots':
            if not inferred_date:
                return {
                    'success': True,
                    'action': 'list_available_slots',
                    'requires_confirmation': False,
                    'reply': ai_reply or 'What date you want, let format with YYYY-MM-DD.'
                }, 200

            available_spaces = self.get_available_spaces_for_date(inferred_date)
            slots_only = [str(space['parking_slot_number']) for space in available_spaces]

            if slots_only:
                fallback_reply = f"On {inferred_date} there are available slots: {', '.join(slots_only)}."
            else:
                fallback_reply = f"On {inferred_date} there are no available slots."

            return {
                'success': True,
                'action': 'list_available_slots',
                'requires_confirmation': False,
                'date': inferred_date,
                'available_spaces': available_spaces,
                'reply': ai_reply or fallback_reply
            }, 200

        if intent == 'list_my_bookings':
            my_bookings = self.get_user_bookings(current_user_id)

            if my_bookings:
                booking_summaries = []
                for each_booking in my_bookings:
                    booking_summaries.append(
                        f"#{each_booking['booking_id']} - cho {each_booking['parking_slot_number']} - {each_booking['booking_date']}"
                    )
                fallback_reply = "Your tickets:\n" + '\n'.join(booking_summaries)
            else:
                fallback_reply = 'You have no tickets.'

            return {
                'success': True,
                'action': 'list_my_bookings',
                'requires_confirmation': False,
                'bookings': my_bookings,
                'reply': ai_reply or fallback_reply
            }, 200

        if intent == 'create_booking':
            if inferred_slot is None or inferred_date is None:
                return {
                    'success': True,
                    'action': 'create_booking',
                    'requires_confirmation': False,
                    'reply': ai_reply or 'To book a ticket, please provide the date (YYYY-MM-DD) and the slot number (60-65).'
                }, 200

            if inferred_slot not in range(60, 66):
                return {
                    'success': True,
                    'action': 'create_booking',
                    'requires_confirmation': False,
                    'reply': 'Valid slot numbers are from 60 to 65.'
                }, 200

            session_store[self.pending_action_key] = {
                'type': 'create_booking',
                'booking_date': inferred_date,
                'parking_slot_number': inferred_slot
            }
            self._mark_session_modified(session_store)

            confirmation_prompt = (
                f"Confirm booking slot {inferred_slot} on {inferred_date}? "
                "Press Confirm to continue."
            )

            return {
                'success': True,
                'action': 'create_booking',
                'requires_confirmation': True,
                'confirmation_prompt': confirmation_prompt,
                'reply': ai_reply or confirmation_prompt
            }, 200

        if intent == 'cancel_booking':
            if inferred_booking_id is None:
                return {
                    'success': True,
                    'action': 'cancel_booking',
                    'requires_confirmation': False,
                    'reply': ai_reply or 'Which booking ID do you want to cancel?'
                }, 200

            booking_preview = self.get_booking_preview_for_user(current_user_id, inferred_booking_id)
            if not booking_preview:
                return {
                    'success': True,
                    'action': 'cancel_booking',
                    'requires_confirmation': False,
                    'reply': f"Could not find booking #{inferred_booking_id}."
                }, 200

            session_store[self.pending_action_key] = {
                'type': 'cancel_booking',
                'booking_id': inferred_booking_id
            }
            self._mark_session_modified(session_store)

            confirmation_prompt = (
                f"Confirm cancellation of booking #{inferred_booking_id} "
                f"(slot {booking_preview['parking_slot_number']} on {booking_preview['booking_date']})?"
            )

            return {
                'success': True,
                'action': 'cancel_booking',
                'requires_confirmation': True,
                'confirmation_prompt': confirmation_prompt,
                'reply': ai_reply or confirmation_prompt
            }, 200

        return {
            'success': True,
            'action': intent,
            'requires_confirmation': False,
            'reply': ai_reply or 'You can request to check availability, book a slot, view your tickets, or cancel a booking.'
        }, 200

    def handle_confirmation_request(self, current_user_id, should_confirm, session_store):
        pending_action = session_store.get(self.pending_action_key)
        if not pending_action:
            return {'success': False, 'reply': 'No pending action for confirmation.'}, 400

        if not should_confirm:
            session_store.pop(self.pending_action_key, None)
            self._mark_session_modified(session_store)
            return {
                'success': True,
                'action': 'confirmation_cancelled',
                'reply': 'Cancelled the requested action.'
            }, 200

        session_store.pop(self.pending_action_key, None)
        self._mark_session_modified(session_store)

        action_type = pending_action.get('type')

        if action_type == 'create_booking':
            booking_result = self.create_booking_for_user(
                current_user_id,
                pending_action.get('parking_slot_number'),
                pending_action.get('booking_date')
            )

            if not booking_result.get('ok'):
                return {
                    'success': False,
                    'action': 'create_booking',
                    'reply': booking_result.get('error', 'Booking failed.')
                }, booking_result.get('status_code', 400)

            updated_bookings = self.get_user_bookings(current_user_id)
            updated_spaces = self.get_available_spaces_for_date(booking_result['booking_date'])

            return {
                'success': True,
                'action': 'create_booking',
                'reply': (
                    f"Successfully booked: slot {booking_result['parking_slot_number']} "
                    f"on {booking_result['booking_date']} (booking ID: #{booking_result['booking_id']})."
                ),
                'booking_id': booking_result['booking_id'],
                'bookings': updated_bookings,
                'date': booking_result['booking_date'],
                'available_spaces': updated_spaces
            }, 200

        if action_type == 'cancel_booking':
            cancel_result = self.cancel_booking_for_user(
                current_user_id,
                pending_action.get('booking_id')
            )

            if not cancel_result.get('ok'):
                return {
                    'success': False,
                    'action': 'cancel_booking',
                    'reply': cancel_result.get('error', 'Cancellation failed.')
                }, cancel_result.get('status_code', 400)

            updated_bookings = self.get_user_bookings(current_user_id)
            updated_spaces = self.get_available_spaces_for_date(cancel_result['booking_date'])

            return {
                'success': True,
                'action': 'cancel_booking',
                'reply': (
                    f"Successfully cancelled booking #{cancel_result['booking_id']} "
                    f"(slot {cancel_result['parking_slot_number']} on {cancel_result['booking_date']})."
                ),
                'bookings': updated_bookings,
                'date': cancel_result['booking_date'],
                'available_spaces': updated_spaces
            }, 200

        return {
            'success': False,
            'reply': 'Invalid action for confirmation.'
        }, 400
