from flask import Flask, render_template, request, jsonify, Response, send_from_directory
from flask_cors import CORS
import os
import socketserver
import threading
import queue
import json
import time
import random
import hashlib
import hmac
import secrets
import requests
from datetime import datetime
from threading import Lock
from config import (
    RANDOM_MESSAGES,
    API_CONFIG,
    PROTOCOL_CONFIG,
    SERVER_CONFIG,
    TIMING_CONFIG
)

# Add missing database config (disabled by default)
RAW_TAG_DATABASE_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'timing_db',
    'user': 'timing_user',
    'password': 'timing_pass'
}
import psycopg2
import psycopg2.extras
from bs4 import BeautifulSoup
import tinycss2
from urllib.parse import urljoin, urlparse
import logging


# Timing Database Class
class TimingDatabase:
    """Database handler for timing data"""
    
    def __init__(self):
        self.connection = None
        self.current_session_id = None
        self.location_cache = {}
        self.connect()
        
    def connect(self):
        """Establish database connection"""
        try:
            connection_string = (
                f"host={RAW_TAG_DATABASE_CONFIG['host']} "
                f"port={RAW_TAG_DATABASE_CONFIG['port']} "
                f"dbname={RAW_TAG_DATABASE_CONFIG['database']} "
                f"user={RAW_TAG_DATABASE_CONFIG['user']} "
                f"password={RAW_TAG_DATABASE_CONFIG['password']}"
            )
            
            self.connection = psycopg2.connect(connection_string)
            self.connection.autocommit = True
            print("✅ Connected to raw_tag_data database")
            
            if TIMING_CONFIG.get('auto_create_session', True):
                self.ensure_session()
                
            return True
        except Exception as e:
            print(f"❌ Timing database connection failed: {e}")
            return False
    
    def ensure_session(self, session_name=None):
        """Ensure we have an active timing session"""
        if not session_name:
            session_name = datetime.now().strftime(TIMING_CONFIG.get('session_name_format', 'Session_%Y%m%d_%H%M%S'))
        
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    "SELECT id FROM timing_sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
                )
                result = cursor.fetchone()
                
                if result:
                    self.current_session_id = result[0]
                    print(f"✅ Using existing timing session ID: {self.current_session_id}")
                else:
                    cursor.execute(
                        """INSERT INTO timing_sessions (session_name, event_name, status) 
                           VALUES (%s, %s, 'active') RETURNING id""",
                        (session_name, race_name or 'Live Event')
                    )
                    self.current_session_id = cursor.fetchone()[0]
                    print(f"✅ Created new timing session ID: {self.current_session_id}")
                
                return self.current_session_id
                
        except Exception as e:
            print(f"❌ Error ensuring session: {e}")
            return None
    
    def get_or_create_location(self, location_name, reader_id=None):
        """Get or create timing location"""
        cache_key = f"{self.current_session_id}_{location_name}"
        if cache_key in self.location_cache:
            return self.location_cache[cache_key]
        
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    "SELECT id FROM timing_locations WHERE session_id = %s AND location_name = %s",
                    (self.current_session_id, location_name)
                )
                result = cursor.fetchone()
                
                if result:
                    location_id = result[0]
                else:
                    cursor.execute(
                        """INSERT INTO timing_locations (session_id, location_name, reader_id) 
                           VALUES (%s, %s, %s) RETURNING id""",
                        (self.current_session_id, location_name, reader_id)
                    )
                    location_id = cursor.fetchone()[0]
                    print(f"✅ Created timing location '{location_name}' with ID: {location_id}")
                
                self.location_cache[cache_key] = location_id
                return location_id
                
        except Exception as e:
            print(f"❌ Error getting/creating location: {e}")
            return None
    
    def store_timing_read(self, parsed_data):
        """Store timing read in database"""
        if not self.current_session_id:
            print("❌ No active session for storing timing data")
            return False
            
        try:
            location_id = self.get_or_create_location(
                parsed_data.get('location', 'unknown'), 
                parsed_data.get('tagcode')
            )
            
            if not location_id:
                return False
            
            time_str = parsed_data.get('time', '00:00:00.00')
            
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO timing_reads (
                        session_id, location_id, sequence_number, location_name,
                        tag_code, read_time, lap_count, reader_id, gator_number, raw_data
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (session_id, sequence_number, location_name) DO UPDATE SET
                        processed_at = CURRENT_TIMESTAMP,
                        raw_data = EXCLUDED.raw_data
                """, (
                    self.current_session_id,
                    location_id,
                    int(parsed_data.get('sequence', 0)),
                    parsed_data.get('location', 'unknown'),
                    parsed_data.get('bib', 'unknown'),
                    time_str,
                    int(parsed_data.get('lap', 1)),
                    parsed_data.get('tagcode', ''),
                    int(parsed_data.get('gator', 0)),
                    json.dumps(parsed_data)
                ))
                
                if TIMING_CONFIG.get('debug_timing', False):
                    print(f"✅ Stored timing read: Bib {parsed_data.get('bib')} at {parsed_data.get('location')}")
                
                return True
                
        except Exception as e:
            print(f"❌ Error storing timing read: {e}")
            return False

# Global timing database instance
timing_db = None

def get_timing_db():
    """Get or create timing database instance"""
    global timing_db
    if timing_db is None and TIMING_CONFIG.get('store_to_database', False):
        timing_db = TimingDatabase()
    return timing_db


app = Flask(__name__, static_folder='static')

CORS(app)

# Global variables for system state
current_provider = None
provider_credentials = {}
current_event_id = None
race_name = ''
roster_data = {}
last_roster_sync = None

# Background refresh variables
refresh_active = False
refresh_thread = None
roster_refresh_lock = Lock()

# Background refresh configuration
REFRESH_CONFIG = {
    'enabled': True,
    'interval_seconds': 10,
    'debug_logging': False
}
# Fix JSON serialization for time objects
from datetime import time, datetime
import json

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, time):
        return obj.strftime('%H:%M:%S')
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif hasattr(obj, 'isoformat'):  # handles date objects
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

# Configure Flask to use our custom serializer
app.json.default = json_serial

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables  
data_queue = queue.Queue()

# TCP/IP Settings
HOST = '127.0.0.1'
PORT = 61611
BUFFER_SIZE = 1024

# Add after global variables
listener_lock = Lock()
listeners_started = False

# Add to global variables
AUTH_SECRETS = {}  # Store connection-specific secrets

# Track progress while loading roster data
login_progress = {
    'total_entries': 0,
    'loaded_entries': 0,
    'complete': False
}

# ===========================
# BACKGROUND REFRESH SYSTEM
# ===========================

def start_background_refresh():
    """Start the background roster refresh thread"""
    global refresh_thread, refresh_active
    
    if refresh_active or not current_provider or current_provider != 'runsignup':
        return False
    
    with roster_refresh_lock:
        if refresh_active:
            return False
            
        refresh_active = True
        refresh_thread = threading.Thread(target=background_refresh_worker, daemon=True)
        refresh_thread.start()
        
        if REFRESH_CONFIG['debug_logging']:
            print(f"🔄 Started background roster refresh (every {REFRESH_CONFIG['interval_seconds']}s)")
        
        return True

def stop_background_refresh():
    """Stop the background roster refresh"""
    global refresh_active
    
    with roster_refresh_lock:
        if refresh_active:
            refresh_active = False
            if REFRESH_CONFIG['debug_logging']:
                print("⏹️ Stopped background roster refresh")

def background_refresh_worker():
    """Background worker thread for roster updates"""
    global last_roster_sync, roster_data
    
    while refresh_active and current_provider == 'runsignup':
        try:
            time.sleep(REFRESH_CONFIG['interval_seconds'])
            
            if not refresh_active:
                break
                
            # Only refresh if we have valid credentials and event info
            if not all([current_event_id, provider_credentials.get('api_key'), provider_credentials.get('api_secret')]):
                continue
            
            # Get current event info from global state
            race_id = getattr(background_refresh_worker, 'race_id', None)
            event_id = current_event_id
            
            if not race_id:
                continue
            
            if REFRESH_CONFIG['debug_logging']:
                print(f"🔄 Background refresh: fetching updates since {last_roster_sync}")
            
            # Fetch incremental updates
            participants = fetch_runsignup_participants(
                race_id,
                event_id,
                provider_credentials.get('api_key'),
                provider_credentials.get('api_secret'),
                last_modified=last_roster_sync
            )
            
            if participants:
                # Update roster data with new/changed participants
                updates_count = 0
                
                with roster_refresh_lock:
                    for participant in participants:
                        try:
                            bib = participant.get('bib_num') or str(participant.get('registration_id', ''))
                            
                            if bib:
                                user_data = participant.get('user', {})
                                address = user_data.get('address', {})
                                
                                roster_data[bib] = {
                                    'name': f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip(),
                                    'first_name': user_data.get('first_name', ''),
                                    'last_name': user_data.get('last_name', ''),
                                    'age': str(participant.get('age', '')),
                                    'gender': user_data.get('gender', ''),
                                    'city': address.get('city', ''),
                                    'state': address.get('state', ''),
                                    'country': address.get('country_code', ''),
                                    'race_name': race_name,
                                    'bib': bib,
                                    'registration_id': participant.get('registration_id', ''),
                                    'provider': 'runsignup',
                                    'last_updated': datetime.now().isoformat()
                                }
                                updates_count += 1
                                
                        except Exception as e:
                            if REFRESH_CONFIG['debug_logging']:
                                print(f"❌ Error processing participant update: {e}")
                            continue
                
                # Update sync timestamp
                last_roster_sync = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
                if REFRESH_CONFIG['debug_logging'] and updates_count > 0:
                    print(f"✅ Background refresh: updated {updates_count} participants")
                    
            else:
                if REFRESH_CONFIG['debug_logging']:
                    print("🔄 Background refresh: no new updates")
                    
        except Exception as e:
            if REFRESH_CONFIG['debug_logging']:
                print(f"❌ Background refresh error: {e}")
            time.sleep(5)  # Brief pause before retrying
    
    if REFRESH_CONFIG['debug_logging']:
        print("🛑 Background refresh worker stopped")

# Directories for saved templates and uploaded images
TEMPLATE_DIR = os.path.join(app.root_path, 'saved_templates')
UPLOAD_DIR = os.path.join(app.static_folder, 'uploads')
os.makedirs(TEMPLATE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

def encode_password(password):
    """Encode password using SHA-1"""
    return hashlib.sha1(password.encode('utf-8')).hexdigest()

def fetch_roster_page(event_id, credentials, page=1):
    """Fetch a single page of roster data"""
    url = f"{API_CONFIG['BASE_URL']}/event/{event_id}/entry"
    
    # Use provided credentials or fall back to defaults
    user_id = credentials.get('user_id') or API_CONFIG.get('DEFAULT_USER_ID', '')
    password = credentials.get('user_pass') or API_CONFIG.get('DEFAULT_PASSWORD', '')
    
    # Encode the password with SHA-1 (only if not already encoded)
    if len(password) != 40:  # SHA-1 hash is 40 chars
        encoded_password = encode_password(password)
    else:
        encoded_password = password
    
    params = {
        'format': API_CONFIG['FORMAT'],
        'client_id': API_CONFIG['CLIENT_ID'],
        'user_id': user_id,
        'user_pass': encoded_password,
        'page': page,
        'size': 100,  # Increased page size to reduce number of requests
        'include_test_entries': 'true',
        'elide_json': 'false'
    }
    
    print(f"Requesting roster from: {url}")
    print(f"Request parameters: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"API Response status: {response.status_code}")
        print(f"API Response headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"API Error: {response.text}")
            return None, None
            
        response.raise_for_status()
        data = response.json()
        
        # Validate response structure
        if not isinstance(data, dict):
            print(f"Invalid response format: expected dict, got {type(data)}")
            return None, None
            
        if 'event_entry' not in data:
            print(f"Missing 'event_entry' in response: {data}")
            return None, None
            
        if not isinstance(data['event_entry'], list):
            print(f"Invalid 'event_entry' format: expected list, got {type(data['event_entry'])}")
            return None, None
            
        if len(data['event_entry']) > 0:
            print(f"Successfully fetched {len(data['event_entry'])} entries")
            # Log first entry for debugging
            print(f"First entry sample: {data['event_entry'][0]}")
        else:
            print(f"Response contained no entries. Response data: {data}")
            
        return data, response.headers
        
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return None, None
    except ValueError as e:
        print(f"JSON parsing error: {e}")
        print(f"Response content: {response.text[:500]}...")
        return None, None
    except Exception as e:
        print(f"Error fetching roster page {page}: {e}")
        return None, None

def fetch_complete_roster(event_id, credentials):
    """Fetch all pages of roster data"""
    global roster_data, race_name, login_progress
    roster_data = {}

    # Reset progress tracking
    login_progress = {
        'total_entries': 0,
        'loaded_entries': 0,
        'complete': False
    }

    # Fetch first page to get total pages
    data, headers = fetch_roster_page(event_id, credentials, page=1)
    if not data:
        return False
    
    # Get pagination info from headers
    total_pages = int(headers.get('X-Ctlive-Page-Count', 1))
    total_rows = int(headers.get('X-Ctlive-Row-Count', 0))
    login_progress['total_entries'] = total_rows
    print(f"Total entries to fetch: {total_rows} across {total_pages} pages")
    
    # Process first page
    for entry in data['event_entry']:
        # Store all relevant runner information
        bib = entry.get('entry_bib')
        if not bib:  # If no bib, use entry_id as fallback
            bib = entry.get('entry_id')
            
        if bib:
            roster_data[bib] = {
                'name': entry.get('entry_name', ''),  # Full name
                'first_name': entry.get('athlete_first_name', ''),
                'last_name': entry.get('athlete_last_name', ''),
                'age': entry.get('entry_race_age', ''),
                'gender': entry.get('athlete_sex', ''),
                'city': entry.get('location_city', ''),
                'state': entry.get('location_region', ''),
                'country': entry.get('location_country', ''),
                'division': entry.get('bracket_name', ''),  # Age group/division
                'race_name': entry.get('race_name', ''),
                'reg_choice': entry.get('reg_choice_name', ''),  # Race category
                'wave': entry.get('wave_name', ''),
                'team_name': entry.get('team_name', ''),
                'entry_status': entry.get('entry_status', ''),
                'entry_type': entry.get('entry_type', ''),
                'entry_id': entry.get('entry_id', ''),
                'athlete_id': entry.get('athlete_id', '')
            }
            # Store race name (we'll get it from the first entry)
            if race_name is None:
                race_name = entry.get('race_name', '')
            login_progress['loaded_entries'] += 1
    
    # Fetch remaining pages
    for page in range(2, total_pages + 1):
        print(f"Fetching page {page} of {total_pages}")
        data, _ = fetch_roster_page(event_id, credentials, page)
        if data:
            for entry in data['event_entry']:
                bib = entry.get('entry_bib')
                if not bib:  # If no bib, use entry_id as fallback
                    bib = entry.get('entry_id')
                    
                if bib:
                    roster_data[bib] = {
                        'name': entry.get('entry_name', ''),
                        'first_name': entry.get('athlete_first_name', ''),
                        'last_name': entry.get('athlete_last_name', ''),
                        'age': entry.get('entry_race_age', ''),
                        'gender': entry.get('athlete_sex', ''),
                        'city': entry.get('location_city', ''),
                        'state': entry.get('location_region', ''),
                        'country': entry.get('location_country', ''),
                        'division': entry.get('bracket_name', ''),
                        'race_name': entry.get('race_name', ''),
                        'reg_choice': entry.get('reg_choice_name', ''),
                        'wave': entry.get('wave_name', ''),
                        'team_name': entry.get('team_name', ''),
                        'entry_status': entry.get('entry_status', ''),
                        'entry_type': entry.get('entry_type', ''),
                        'entry_id': entry.get('entry_id', ''),
                        'athlete_id': entry.get('athlete_id', '')
                    }
                    login_progress['loaded_entries'] += 1
    
    print(f"Total runners loaded: {len(roster_data)}")
    if len(roster_data) != total_rows:
        print(f"Warning: Expected {total_rows} entries but loaded {len(roster_data)}")

    login_progress['complete'] = True

    return True

def generate_auth_seed():
    """Generate a random authentication seed"""
    return secrets.token_hex(16)

def calculate_hmac(seed, password, method='sha1'):
    """Calculate HMAC digest"""
    if method == 'sha1':
        return hmac.new(password.encode(), seed.encode(), hashlib.sha1).hexdigest()
    elif method == 'md5':
        return hmac.new(password.encode(), seed.encode(), hashlib.md5).hexdigest()
    return None

class TimingHandler(socketserver.StreamRequestHandler):
    def write_command(self, *fields):
        """Write a command to the socket with proper formatting"""
        command = PROTOCOL_CONFIG['FIELD_SEPARATOR'].join(map(str, fields))
        print(">>", command)
        self.wfile.write((command + PROTOCOL_CONFIG['LINE_TERMINATOR']).encode())

    def read_command(self):
        """Read a command from the socket"""
        command = self.rfile.readline().strip().decode()
        if command:
            print("<<", command)
        return command

    def handle(self):
        print("-- Client connected --")

        # Consume the greeting
        greeting = self.read_command()

        # Send our response with settings
        settings = (
            "location=multi",
            "guntimes=true", 
            "newlocations=true",
            "authentication=none",
            "stream-mode=push",
            "time-format=iso"
        )
        
        # Send initial greeting with settings count
        self.write_command("RaceDisplay", "Version 1.0 Level 2024.02", len(settings))
        
        # Send each setting
        for setting in settings:
            self.write_command(setting)

        # Request event info and locations
        self.write_command("geteventinfo")
        self.write_command("getlocations")
        
        # Start the data feed
        self.write_command("start")

        # Process incoming data
        while True:
            line = self.read_command()
            if not line:
                break

            if line == 'ping':
                self.write_command("ack", "ping")
                continue

            # Handle initialization acknowledgments
            if line.startswith('ack~'):
                parts = line.split('~')
                if len(parts) >= 2:
                    ack_type = parts[1]
                    if ack_type == 'init':
                        # Accept any ack~init response
                        continue
                    elif ack_type == 'geteventinfo':
                        # Accept event info response
                        continue
                    elif ack_type == 'getlocations':
                        # Accept locations response
                        continue
                    elif ack_type == 'start':
                        # Accept start acknowledgment
                        continue

            # Process timing data
            processed_data = process_timing_data(line)
            if processed_data:
                data_queue.put(processed_data)

        print("-- Client disconnected --")

def monitor_data_feed():
    """Start the TCP server"""
    print(f"Starting TCP server on {PROTOCOL_CONFIG['HOST']}:{PROTOCOL_CONFIG['PORT']}")
    try:
        server = socketserver.ThreadingTCPServer(
            (PROTOCOL_CONFIG['HOST'], PROTOCOL_CONFIG['PORT']), 
            TimingHandler
        )
        print(f"Server listening on port {PROTOCOL_CONFIG['PORT']}")
        server.serve_forever()
    except Exception as e:
        print(f"Error in TCP server: {e}")
        raise

def start_listeners():
    """Start TCP listener"""
    global listeners_started
    
    with listener_lock:
        if listeners_started:
            print("Listener already running")
            return True
            
        try:
            # Start TCP listener
            tcp_thread = threading.Thread(target=monitor_data_feed)
            tcp_thread.daemon = False  # Make it a non-daemon thread
            tcp_thread.start()
            print("TCP server thread started")
            
            listeners_started = True
            return True
            
        except Exception as e:
            print(f"Failed to start listener: {e}")
            return False

def process_timing_data(line):
    """Process timing data in CT01_33 format:
    format_id~sequence~location~bib~time~gator~tagcode~lap
    Example: CT01_33~1~start~9478~14:02:15.31~0~0F2A38~1
    """
    print(f"Processing line: {line}")
    try:
        parts = line.split(PROTOCOL_CONFIG['FIELD_SEPARATOR'])
        print(f"Split parts: {parts}")
        
        if len(parts) >= 8 and parts[0] == PROTOCOL_CONFIG['FORMAT_ID']:
            data = {
                'format': parts[0],
                'sequence': parts[1],
                'location': parts[2],
                'bib': parts[3],
                'time': parts[4],
                'gator': parts[5],
                'tagcode': parts[6],
                'lap': parts[7]
            }
            print(f"Parsed data: {data}")
            
            if data['bib'] == 'guntime':
                print("Skipping guntime event")
                return None
                
            # Look up timing data by bib number
            runner_data = None
            lookup_key = None
            
            # Direct bib lookup - try both string and int versions
            if data['bib'] in roster_data:
                runner_data = roster_data[data['bib']]
                lookup_key = data['bib']
                print(f"✅ Found bib {data['bib']} in roster (direct match)")
            elif str(data['bib']) in roster_data:
                runner_data = roster_data[str(data['bib'])]
                lookup_key = str(data['bib'])
                print(f"✅ Found bib {data['bib']} in roster (string conversion match)")
            
            if runner_data:
                processed_data = {
                    'name': runner_data['name'],  # Use full name from entry_name
                    'first_name': runner_data['first_name'],
                    'last_name': runner_data['last_name'],
                    'age': runner_data['age'],
                    'gender': runner_data['gender'],
                    'city': runner_data['city'],
                    'state': runner_data['state'],
                    'country': runner_data['country'],
                    'division': runner_data.get('division', ''),
                    'race_name': runner_data['race_name'],
                    'reg_choice': runner_data.get('reg_choice', ''),
                    'wave': runner_data.get('wave', ''),
                    'team_name': runner_data.get('team_name', ''),
                    'message': random.choice(RANDOM_MESSAGES),
                    'timestamp': data['time'],
                    'location': data['location'],
                    'lap': data['lap'],
                    'bib': data['bib'],
                    'lookup_key': lookup_key,
                    'registration_id': runner_data.get('registration_id', ''),
                    'bib_num': runner_data.get('bib_num', '')
                }
                print(f"✅ Runner found: {runner_data['name']} (bib: {data['bib']}, lookup_key: {lookup_key})")
                
                # Store in database
                db = get_timing_db()
                if db:
                    try:
                        db.store_timing_read(data)
                    except Exception as e:
                        print(f"Database storage error: {e}")
                
                return processed_data
            else:
                print(f"❌ Bib {data['bib']} not found in roster. Available bibs: {list(roster_data.keys())[:5]}...")
                print(f"   Sample participant data: {list(roster_data.values())[0] if roster_data else 'No participants loaded'}")
                
                # Store unknown bib data anyway
                db = get_timing_db()
                if db:
                    try:
                        db.store_timing_read(data)
                        print(f"Stored unknown bib {data['bib']} in database")
                    except Exception as e:
                        print(f"Database storage error: {e}")
                
    except Exception as e:
        print(f"Error processing timing data: {e}")
        print(f"Line causing error: {line}")
    return None

# ===========================
# RUNSIGNUP INTEGRATION CONFIGURATION
# ===========================

# Define registration providers
REGISTRATION_PROVIDERS = {
    'chronotrack': {
        'name': 'ChronoTrack Live',
        'base_url': 'https://api.chronotrack.com/api',
        'supports_prerace': True,
        'supports_results': True
    },
    'runsignup': {
        'name': 'RunSignUp',
        'base_url': 'https://runsignup.com/Rest',
        'supports_prerace': True,
        'supports_results': False
    }
}

# ===========================
# RUNSIGNUP INTEGRATION FUNCTIONS
# ===========================

def fetch_runsignup_races(api_key, api_secret):
    """Fetch available races from RunSignUp API - only events in next 10 days"""
    try:
        from datetime import datetime, timedelta
        
        # Calculate date range for next 10 days
        today = datetime.now()
        ten_days_from_now = today + timedelta(days=10)
        
        url = "https://runsignup.com/Rest/races"
        params = {
            'api_key': api_key,
            'api_secret': api_secret,
            'format': 'json',
            'results_per_page': 100,
            'start_date': 'today',
            'end_date': ten_days_from_now.strftime('%Y-%m-%d'),
            'only_partner_races': 'T',
            'events': 'T',
            'sort': 'date ASC'
        }
        
        print(f"Fetching RunSignUp races from: {url}")
        
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        races = []
        total_events = 0
        
        if 'races' in data:
            print(f"Found {len(data['races'])} races")
            for race_entry in data['races']:
                race_info = race_entry.get('race', {})
                
                # Get location string
                address = race_info.get('address', {})
                location_parts = []
                if address.get('city'):
                    location_parts.append(address['city'])
                if address.get('state'):
                    location_parts.append(address['state'])
                location = ', '.join(location_parts)
                
                # Get events for this race - filter by date
                events = []
                if 'events' in race_info and race_info['events']:
                    for event in race_info['events']:
                        event_date_str = event.get('start_time', '')
                        
                        # Parse event date and check if it's within next 10 days
                        try:
                            if event_date_str:
                                event_date = None
                                date_formats = [
                                    '%m/%d/%Y %H:%M',  # 6/28/2025 07:30
                                    '%Y-%m-%dT%H:%M:%S',  # 2025-06-27T08:00:00
                                    '%Y-%m-%d %H:%M:%S',  # 2025-06-27 08:00:00
                                    '%m/%d/%Y',  # 6/28/2025
                                    '%Y-%m-%d'   # 2025-06-27
                                ]
                                
                                for date_format in date_formats:
                                    try:
                                        event_date = datetime.strptime(event_date_str, date_format)
                                        break
                                    except ValueError:
                                        continue
                                
                                if event_date and today <= event_date <= ten_days_from_now:
                                    events.append({
                                        'event_id': event.get('event_id'),
                                        'event_name': event.get('name', 'Unnamed Event'),
                                        'event_date': event_date_str,
                                        'distance': event.get('distance', ''),
                                        'units': 'miles',
                                        'event_type': event.get('event_type', ''),
                                        'race_id': race_info.get('race_id'),  # ✅ Correct race_id
                                        'race_name': race_info.get('name', 'Unnamed Race'),
                                        'location': location
                                    })
                                    total_events += 1
                        except (ValueError, TypeError) as e:
                            continue
                
                # Only include races that have events in the next 10 days
                if events:
                    races.append({
                        'race_id': race_info.get('race_id'),
                        'race_name': race_info.get('name', 'Unnamed Race'),
                        'race_date': race_info.get('next_date', ''),
                        'location': location,
                        'registration_open': race_info.get('is_registration_open', 'F') == 'T',
                        'events': events
                    })
        
        print(f"📊 Returning {len(races)} races with {total_events} events in next 10 days")
        return races
        
    except Exception as e:
        print(f"Error fetching RunSignUp races: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def fetch_runsignup_participants(race_id, event_id, api_key, api_secret, last_modified=None):
    """Fetch participants from RunSignUp API with proper pagination and race_id fix"""
    try:
        # 🔧 CRITICAL FIX: Apply race_id mapping for known events
        macklind_mile_events = ['928029', '928030', '928031', '928032', '928033', '928034', '928035']
        if str(event_id) in macklind_mile_events:
            print(f"🔧 APPLYING RACE_ID FIX: Event {event_id} → race_id 84333")
            race_id = '84333'  # Use the verified working race_id
        
        url = f"https://runsignup.com/Rest/race/{race_id}/participants"
        
        # Optimized parameters based on your successful API test
        params = {
            'api_key': api_key,
            'api_secret': api_secret,
            'event_id': event_id,
            'format': 'json',
            'results_per_page': 50,  # Good balance for pagination
            'sort': 'registration_id ASC',
            # Exclude unnecessary data for performance
            'include_counties': 'F',
            'include_template_participant': 'F',
            'include_user_anonymous_flag': 'F',
            'include_questions': 'F',
            'include_corrals': 'F',
            'include_est_finish': 'F',
            'include_corp_teams': 'F',
            'include_registration_addons': 'F',
            'include_memberships': 'F',
            'include_coupon_details': 'F',
            'include_registration_notes': 'F',
            'include_checkin_data': 'F',
            'include_waiver_info': 'F',
            'include_multiple_waivers': 'F',
            'include_usat_waiver_info': 'F',
            'include_pending_lottery_selection': 'F',
            'exclude_registrations_via_super_event': 'F',
            'include_shipping_address': 'F',
            'include_profile_type': 'F',
            'include_profile_image_url': 'F',
            'supports_nb': 'F',
            'include_fundraisers': 'F',
            'include_multi_race_bundle_info': 'F'
        }
        
        if last_modified:
            # Convert to timestamp format that RunSignUp expects
            try:
                from datetime import datetime
                if isinstance(last_modified, str):
                    # Parse the datetime string and convert to Unix timestamp
                    dt = datetime.strptime(last_modified, '%Y-%m-%d %H:%M:%S')
                    timestamp = int(dt.timestamp())
                    params['modified_after_timestamp'] = timestamp
                    print(f"🔄 RunSignUp incremental sync from: {last_modified} (timestamp: {timestamp})")
                else:
                    params['modified_after_timestamp'] = last_modified
                    print(f"🔄 RunSignUp incremental sync from timestamp: {last_modified}")
            except Exception as e:
                print(f"⚠️ Error processing last_modified timestamp: {e}")
                # Continue without incremental sync if timestamp parsing fails
        
        participants = []
        page = 1
        
        # 🔧 IMPROVED PAGINATION HANDLING
        while True:
            params['page'] = page
            print(f"📄 Fetching RunSignUp participants page {page}")
            
            response = requests.get(url, params=params, timeout=30)
            
            print(f"📡 API Request: {response.url}")
            print(f"📡 Response Status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"❌ API Error {response.status_code}: {response.text}")
                break
            
            try:
                data = response.json()
            except ValueError as e:
                print(f"❌ Invalid JSON response: {e}")
                break
            
            # Check for API errors
            if 'error' in data:
                error_details = data['error']
                print(f"❌ RunSignUp API Error: {error_details}")
                break
            
            # Handle RunSignUp response structure: [{"event": {...}, "participants": [...]}]
            participant_data = []
            if isinstance(data, list) and len(data) > 0:
                event_data = data[0]
                participant_data = event_data.get('participants', [])
            elif 'participants' in data:
                participant_data = data['participants']
            else:
                print(f"⚠️ Unexpected response structure: {list(data.keys()) if isinstance(data, dict) else type(data)}")
                break
                
            if not participant_data:
                print(f"📄 No participants found on page {page}")
                break
                
            participants.extend(participant_data)
            print(f"✅ Fetched {len(participant_data)} participants from page {page}")
            
            # Check if there are more pages
            if len(participant_data) < params['results_per_page']:
                print(f"📄 Last page reached (got {len(participant_data)} < {params['results_per_page']})")
                break
                
            page += 1
            
            # Safety limit to prevent infinite loops
            if page > 50:
                print("⚠️ Page limit reached (50 pages)")
                break
        
        print(f"🎉 Total fetched: {len(participants)} participants from RunSignUp")
        return participants
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error fetching RunSignUp participants: {e}")
        return None
    except Exception as e:
        print(f"❌ Error fetching RunSignUp participants: {e}")
        import traceback
        traceback.print_exc()
        return None

# ===========================
# RUNSIGNUP API ROUTES - MOVED BEFORE CATCH-ALL
# ===========================

@app.route('/api/providers')
def get_providers():
    """Get available registration providers"""
    return jsonify({
        'success': True,
        'providers': {
            'chronotrack': {
                'name': REGISTRATION_PROVIDERS['chronotrack']['name'],
                'base_url': REGISTRATION_PROVIDERS['chronotrack']['base_url'],
                'available': True,
                'supports_prerace': REGISTRATION_PROVIDERS['chronotrack']['supports_prerace'],
                'supports_results': REGISTRATION_PROVIDERS['chronotrack']['supports_results']
            },
            'runsignup': {
                'name': REGISTRATION_PROVIDERS['runsignup']['name'], 
                'base_url': REGISTRATION_PROVIDERS['runsignup']['base_url'],
                'available': True,
                'supports_prerace': REGISTRATION_PROVIDERS['runsignup']['supports_prerace'],
                'supports_results': REGISTRATION_PROVIDERS['runsignup']['supports_results']
            },
            'haku': {
                'name': 'Haku',
                'available': False,
                'coming_soon': True
            },
            'raceroster': {
                'name': 'Race Roster',
                'available': False,
                'coming_soon': True
            },
            'letsdo': {
                'name': "Let's Do This",
                'available': False,
                'coming_soon': True
            }
        }
    })

@app.route('/api/fetch-events', methods=['POST'])
def fetch_events():
    """Fetch events from selected provider"""
    try:
        data = request.get_json()
        provider = data.get('provider')
        credentials = data.get('credentials', {})
        
        if provider == 'runsignup':
            races = fetch_runsignup_races(
                credentials.get('api_key', ''),
                credentials.get('api_secret', '')
            )
            
            if races is None:
                return jsonify({
                    'success': False,
                    'error': 'Failed to fetch races from RunSignUp'
                }), 500
            
            # Flatten races and events into a single list
            events = []
            for race in races:
                for event in race.get('events', []):
                    events.append({
                        'race_id': race['race_id'],
                        'event_id': event['event_id'],
                        'race_name': race['race_name'],
                        'event_name': event['event_name'],
                        'event_date': event.get('event_date', ''),
                        'location': race.get('location', ''),
                        'distance': event.get('distance', ''),
                        'units': event.get('units', ''),
                    })
            
            return jsonify({
                'success': True,
                'provider': provider,
                'events': events,
                'total_events': len(events)
            })
        
        else:
            return jsonify({
                'success': False,
                'error': f'Provider {provider} is not yet available'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/select-event', methods=['POST'])
def select_event():
    """Select one or multiple events and load participant data with race_id fix"""
    global current_event_id, race_name, roster_data, current_provider, provider_credentials, last_roster_sync
    
    try:
        data = request.get_json()
        event_info = data.get('event')
        provider_info = data.get('provider', {})
        credentials = data.get('credentials', {})
        selected_events = data.get('selectedEvents', [])  # New: handle multiple events
        
        if not event_info:
            return jsonify({
                'success': False,
                'error': 'Event information is required'
            }), 400
        
        # Store provider info
        current_provider = provider_info.get('id', 'runsignup')
        provider_credentials = credentials
        
        # Set global event information (use primary event)
        current_event_id = event_info.get('event_id')
        race_name = event_info.get('race_name', '')
        
        if current_provider == 'runsignup':
            race_id = event_info.get('race_id')
            
            # Determine which events to process
            if selected_events and len(selected_events) > 1:
                events_to_process = selected_events
                print(f"🎯 Processing multiple events: {len(selected_events)} events selected")
                for event in events_to_process:
                    print(f"   • {event.get('event_name')} (ID: {event.get('event_id')})")
            else:
                events_to_process = [event_info]
                print(f"🔍 Processing single event:")
                print(f"   • {event_info.get('event_name')} (ID: {event_info.get('event_id')})")
            
            print(f"   • Race ID: {race_id}")
            print(f"   • Race Name: {event_info.get('race_name')}")
            
            # Check credentials
            api_key = provider_credentials.get('api_key', '')
            api_secret = provider_credentials.get('api_secret', '')
            
            if not api_key or not api_secret:
                return jsonify({
                    'success': False,
                    'error': 'Missing RunSignUp API credentials'
                })
            
            # Clear existing roster data and populate with RunSignUp data
            roster_data = {}
            total_participants = 0
            total_processed = 0
            total_errors = 0
            
            # Process each selected event
            for event in events_to_process:
                event_id = event.get('event_id')
                event_name = event.get('event_name', 'Unknown Event')
                
                print(f"\n📄 Fetching participants for: {event_name} (Event ID: {event_id})")
                
                # Fetch participants for this specific event
                participants = fetch_runsignup_participants(
                    race_id,
                    event_id,
                    api_key,
                    api_secret
                )
                
                if participants is None:
                    print(f"❌ Failed to fetch participants for event {event_id}")
                    total_errors += 1
                    continue
                
                event_participants = len(participants)
                total_participants += event_participants
                print(f"✅ Fetched {event_participants} participants for {event_name}")
                
                # Process participants for this event
                processed_count = 0
                normalization_errors = 0
                
                for i, participant in enumerate(participants):
                    try:
                        registration_id = str(participant.get('registration_id', ''))
                        bib_num = participant.get('bib_num')
                        
                        # Use bib_num if available, otherwise use registration_id as fallback
                        if bib_num:
                            lookup_key = str(bib_num)
                            stored_bib = str(bib_num)
                        else:
                            lookup_key = registration_id
                            stored_bib = None  # No actual bib assigned yet
                        
                        if lookup_key:
                            # Check if participant already exists (in case of overlap between events)
                            if lookup_key in roster_data:
                                # Add event info to existing participant
                                existing_participant = roster_data[lookup_key]
                                if 'events' not in existing_participant:
                                    existing_participant['events'] = [existing_participant.get('event_name', 'Unknown')]
                                existing_participant['events'].append(event_name)
                                existing_participant['events'] = list(set(existing_participant['events']))  # Remove duplicates
                            else:
                                # Create new participant entry
                                user_data = participant.get('user', {})
                                address = user_data.get('address', {})
                                
                                participant_data = {
                                    'name': f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip(),
                                    'first_name': user_data.get('first_name', ''),
                                    'last_name': user_data.get('last_name', ''),
                                    'age': str(participant.get('age', '')),
                                    'gender': user_data.get('gender', ''),
                                    'city': address.get('city', ''),
                                    'state': address.get('state', ''),
                                    'country': address.get('country_code', ''),
                                    'race_name': event_info.get('race_name', ''),
                                    'event_name': event_name,
                                    'event_id': event_id,
                                    'bib': stored_bib,  # Only store actual bib number or None
                                    'registration_id': registration_id,
                                    'provider': 'runsignup',
                                    'events': [event_name] if len(events_to_process) > 1 else None  # Track multiple events
                                }
                                
                                roster_data[lookup_key] = participant_data
                            
                            processed_count += 1
                        
                    except Exception as e:
                        normalization_errors += 1
                        print(f"❌ Error processing participant {i} in event {event_id}: {e}")
                        continue
                
                total_processed += processed_count
                total_errors += normalization_errors
                print(f"✅ Event {event_name}: {processed_count} processed, {normalization_errors} errors")
            
            print(f"\n🎉 Total Summary:")
            print(f"   • Events processed: {len(events_to_process)}")
            print(f"   • Total participants fetched: {total_participants}")
            print(f"   • Unique participants in roster: {len(roster_data)}")
            print(f"   • Successfully processed: {total_processed}")
            print(f"   • Errors: {total_errors}")
            
            # Set initial sync timestamp and store race_id for background refresh
            last_roster_sync = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            background_refresh_worker.race_id = race_id  # Store race_id for background worker
            
            # Start background refresh for RunSignUp
            if REFRESH_CONFIG['enabled'] and current_provider == 'runsignup':
                start_background_refresh()
            
            # Start TCP listener for timing data
            tcp_listener_started = start_listeners()
            
            return jsonify({
                'success': True,
                'provider': current_provider,
                'event': event_info,
                'selected_events': selected_events if len(selected_events) > 1 else None,
                'events_processed': len(events_to_process),
                'total_participants_fetched': total_participants,
                'unique_participants_loaded': len(roster_data),
                'participants_loaded': len(roster_data),  # Keep for backward compatibility
                'race_name': race_name,
                'processed_count': total_processed,
                'errors': total_errors,
                'background_refresh': refresh_active,
                'tcp_listener': tcp_listener_started
            })
        
        else:
            return jsonify({
                'success': False,
                'error': f'Provider {current_provider} is not yet available'
            }), 400
            
    except Exception as e:
        print(f"❌ Error in select_event: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/old')
def old_index():
    default_credentials = {
        'user_id': API_CONFIG.get('DEFAULT_USER_ID', ''),
        'event_id': API_CONFIG.get('DEFAULT_EVENT_ID', ''),
        'password': API_CONFIG.get('DEFAULT_PASSWORD', '')
    }
    return render_template('old_index.html', credentials=default_credentials)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    # Don't serve React for API endpoints
    if path.startswith('api/'):
        from flask import abort
        abort(404)
    
    dist_dir = os.path.join(app.root_path, 'frontend', 'dist')
    file_path = os.path.join(dist_dir, path)
    if path != '' and os.path.exists(file_path):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, 'index.html')

@app.route('/api/test-connection', methods=['POST'])
def test_connection():
    """Test endpoint to verify API connectivity"""
    try:
        password = request.form['password']
        
        # If password field contains a SHA-1 hash (already encoded), use it directly
        if len(password) == 40 and all(c in '0123456789abcdef' for c in password.lower()):
            encoded_password = password
        else:
            # Otherwise encode it
            encoded_password = encode_password(password)
            
        credentials = {
            'user_id': request.form['user_id'],
            'user_pass': encoded_password,
            'event_id': request.form['event_id']
        }
        
        # Just test the connection to the API
        url = f"{API_CONFIG['BASE_URL']}/event/{credentials['event_id']}/entry"
        
        params = {
            'format': API_CONFIG['FORMAT'],
            'client_id': API_CONFIG['CLIENT_ID'],
            'user_id': credentials['user_id'],
            'user_pass': encoded_password,
            'page': 1,
            'size': 1  # Just request 1 entry to minimize data transfer
        }
        
        print(f"Testing connection to: {url}")
        print(f"With parameters: {params}")
        
        response = requests.get(url, params=params, timeout=10)
        
        result = {
            'status_code': response.status_code,
            'success': response.status_code == 200,
            'headers': dict(response.headers),
        }
        
        # If successful, include a sample of the data
        if response.status_code == 200:
            try:
                data = response.json()
                result['data_sample'] = {
                    'has_entries': 'event_entry' in data,
                    'entry_count': len(data.get('event_entry', [])),
                    'first_entry': data.get('event_entry', [{}])[0] if data.get('event_entry') else None
                }
            except ValueError:
                result['parse_error'] = 'Could not parse JSON response'
                result['response_text'] = response.text[:500]  # First 500 chars
        else:
            result['error_text'] = response.text
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        })

@app.route('/api/test-provider-connection', methods=['POST'])
def test_provider_connection():
    """Test provider connection with JSON data for both RunSignUp and ChronoTrack"""
    try:
        data = request.get_json()
        provider = data.get('provider')
        credentials = data.get('credentials', {})
        
        if provider == 'runsignup':
            # Test RunSignUp API connection
            api_key = credentials.get('api_key', '')
            api_secret = credentials.get('api_secret', '')
            
            if not api_key or not api_secret:
                return jsonify({
                    'success': False,
                    'error': 'API Key and API Secret are required for RunSignUp'
                })
            
            # Simple API test - try to fetch races
            url = "https://runsignup.com/Rest/races"
            params = {
                'api_key': api_key,
                'api_secret': api_secret,
                'format': 'json',
                'results_per_page': 1,  # Just test with 1 result
                'start_date': 'today',
                'only_partner_races': 'T'
            }
            
            print(f"Testing RunSignUp connection with URL: {url}")
            response = requests.get(url, params=params, timeout=10)
            
            result = {
                'status_code': response.status_code,
                'success': response.status_code == 200,
                'provider': 'runsignup'
            }
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'races' in data:
                        result['message'] = f"✅ RunSignUp API connection successful! Found {len(data.get('races', []))} races."
                    else:
                        result['message'] = "✅ RunSignUp API connection successful!"
                except ValueError:
                    result['success'] = False
                    result['error'] = 'Invalid JSON response from RunSignUp API'
            else:
                result['success'] = False
                result['error'] = f"RunSignUp API error: {response.status_code} - {response.text[:200]}"
            
            return jsonify(result)
            
        elif provider == 'chronotrack':
            # Test ChronoTrack connection
            user_id = credentials.get('user_id', '')
            password = credentials.get('password', '')
            event_id = credentials.get('event_id', '')
            
            if not user_id or not password or not event_id:
                return jsonify({
                    'success': False,
                    'error': 'User ID, Password, and Event ID are required for ChronoTrack'
                })
            
            # Encode password
            if len(password) == 40 and all(c in '0123456789abcdef' for c in password.lower()):
                encoded_password = password
            else:
                encoded_password = encode_password(password)
            
            # Test connection to ChronoTrack API
            url = f"{API_CONFIG['BASE_URL']}/event/{event_id}/entry"
            params = {
                'format': API_CONFIG['FORMAT'],
                'client_id': API_CONFIG['CLIENT_ID'],
                'user_id': user_id,
                'user_pass': encoded_password,
                'page': 1,
                'size': 1
            }
            
            print(f"Testing ChronoTrack connection with URL: {url}")
            response = requests.get(url, params=params, timeout=10)
            
            result = {
                'status_code': response.status_code,
                'success': response.status_code == 200,
                'provider': 'chronotrack'
            }
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'event_entry' in data:
                        result['message'] = f"✅ ChronoTrack API connection successful! Found {len(data.get('event_entry', []))} entries."
                    else:
                        result['message'] = "✅ ChronoTrack API connection successful!"
                except ValueError:
                    result['success'] = False
                    result['error'] = 'Invalid JSON response from ChronoTrack API'
            else:
                result['success'] = False
                result['error'] = f"ChronoTrack API error: {response.status_code} - {response.text[:200]}"
            
            return jsonify(result)
            
        else:
            return jsonify({
                'success': False,
                'error': f'Provider "{provider}" is not supported'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        })

@app.route('/api/login', methods=['POST'])
def login():
    try:
        # Get credentials from request
        password = request.form['password']
        
        # If password field contains a SHA-1 hash (already encoded), use it directly
        if len(password) == 40 and all(c in '0123456789abcdef' for c in password.lower()):
            encoded_password = password
        else:
            # Otherwise encode it
            encoded_password = encode_password(password)
            
        credentials = {
            'user_id': request.form['user_id'],
            'user_pass': encoded_password,
            'event_id': request.form['event_id']
        }
        
        global current_event_id
        current_event_id = credentials['event_id']
        
        response = {
            "success": False,
            "status": "Authenticating...",
            "stage": 1,
            "total_stages": 4
        }
        
        # Fetch roster data
        if fetch_complete_roster(current_event_id, credentials):
            response.update({
                "status": "Roster loaded successfully",
                "stage": 2,
                "race_name": race_name,
                "runners_loaded": len(roster_data),
                "credentials_valid": True
            })
            
            if start_listeners():
                response.update({
                    "success": True,
                    "status": "Ready to receive timing data",
                    "stage": 3,
                    "middleware_connected": True,
                    "display_active": True
                })
                
        else:
            response.update({
                "error": "Failed to fetch roster",
                "stage": 2
            })
            
    except Exception as e:
        response = {
            "success": False,
            "error": f"Login failed: {str(e)}",
            "stage": 1
        }
    
    return jsonify(response)

@app.route('/api/login-progress')
def get_login_progress():
    """Return current roster loading progress"""
    return jsonify(login_progress)

@app.route('/stream')
def stream():
    def generate():
        while True:
            try:
                # Try to get data from the queue, timeout after 1 second
                data = data_queue.get(timeout=1)
                yield f"data: {json.dumps(data)}\n\n"
            except queue.Empty:
                # Send keepalive message if no data
                yield f"data: {json.dumps({'keepalive': True})}\n\n"
    
    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

def is_valid_url(url):
    """Validate URL format and security"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception as e:
        logger.error("Failed to parse URL '%s': %s", url, e)
        return False

def extract_colors_from_css(css_text):
    """Extract color values from CSS"""
    colors = set()
    rules = tinycss2.parse_stylesheet(css_text)
    
    # Common CSS color names and their hex values
    css_colors = {
        'black': '#000000', 'white': '#ffffff', 'red': '#ff0000',
        'green': '#00ff00', 'blue': '#0000ff', 'yellow': '#ffff00',
        'purple': '#800080', 'gray': '#808080', 'orange': '#ffa500'
    }
    
    for rule in rules:
        if rule.type == 'qualified-rule':
            for token in rule.content:
                if token.type == 'hash':
                    # Handle hex colors
                    colors.add(f'#{token.value}')
                elif token.type == 'function' and token.name in ['rgb', 'rgba']:
                    # Handle rgb/rgba colors
                    colors.add(token.serialize())
                elif token.type == 'ident' and token.value.lower() in css_colors:
                    # Handle named colors
                    colors.add(css_colors[token.value.lower()])
    
    return list(colors)

def extract_fonts_from_css(css_text):
    """Extract font families from CSS"""
    fonts = set()
    rules = tinycss2.parse_stylesheet(css_text)
    
    for rule in rules:
        if rule.type == 'qualified-rule':
            for token in rule.content:
                if token.type == 'function' and token.name == 'font-family':
                    fonts.add(token.serialize())
    
    return list(fonts)

@app.route('/api/fetch-styles', methods=['POST'])
def fetch_styles():
    url = request.json.get('url')
    
    if not url or not is_valid_url(url):
        return jsonify({'error': 'Invalid URL'}), 400
    
    try:
        # Fetch the webpage
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; RaceDisplay/1.0)'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract styles
        styles = {
            'colors': set(),
            'fonts': set(),
            'backgrounds': set()
        }
        
        # Process external stylesheets
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href:
                css_url = urljoin(url, href)
                try:
                    css_response = requests.get(css_url, headers=headers, timeout=5)
                    if css_response.ok:
                        styles['colors'].update(extract_colors_from_css(css_response.text))
                        styles['fonts'].update(extract_fonts_from_css(css_response.text))
                except requests.RequestException as e:
                    logger.warning("Failed to fetch CSS %s: %s", css_url, e)
                    continue
        
        # Process inline styles
        for style in soup.find_all('style'):
            styles['colors'].update(extract_colors_from_css(style.string or ''))
            styles['fonts'].update(extract_fonts_from_css(style.string or ''))
        
        # Extract main background
        body = soup.find('body')
        if body:
            bg_color = body.get('style', '').split('background-color:')[-1].split(';')[0].strip()
            if bg_color:
                styles['backgrounds'].add(bg_color)
        
        # Convert sets to lists for JSON serialization
        styles = {k: list(v) for k, v in styles.items()}
        
        # Add some metadata
        styles['title'] = soup.title.string if soup.title else ''
        styles['url'] = url
        
        return jsonify(styles)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Template and asset management endpoints
# ---------------------------------------------------------------------------

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """Handle image uploads from the editor"""
    logger.info("Received upload request")
    logger.info("Request files: %s", request.files)
    logger.info("Request form: %s", request.form)
    
    # Try different possible field names for files
    files = (request.files.getlist('files[]') or 
             request.files.getlist('files') or 
             request.files.getlist('file'))
             
    if not files:
        logger.error("No files found in request")
        return jsonify({'error': 'No files uploaded'}), 400
        
    urls = []
    for f in files:
        logger.info("Processing file: %s", f.filename)
        fname = ''.join(c for c in f.filename if c.isalnum() or c in ('_', '-', '.'))
        path = os.path.join(UPLOAD_DIR, fname)
        try:
            f.save(path)
            urls.append(f'/static/uploads/{fname}')
            logger.info("Successfully saved file to: %s", path)
        except Exception as e:
            logger.error("Failed to save file: %s", str(e))
            return jsonify({'error': f'Failed to save file: {str(e)}'}), 500
            
    return jsonify({'data': urls})

@app.route('/api/user-images')
def get_user_images():
    """Get all uploaded images with metadata"""
    try:
        images = []
        upload_path = os.path.join(app.static_folder, 'uploads')
        
        if os.path.exists(upload_path):
            for filename in os.listdir(upload_path):
                if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp')):
                    file_path = os.path.join(upload_path, filename)
                    file_stat = os.stat(file_path)
                    
                    images.append({
                        'filename': filename,
                        'url': f'/static/uploads/{filename}',
                        'size': file_stat.st_size,
                        'modified': file_stat.st_mtime,
                        'displayName': filename.replace('_', ' ').replace('-', ' ').title()
                    })
        
        return jsonify({'images': images})
    except Exception as e:
        logger.error(f"Error getting user images: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/current-runner')
def get_current_runner():
    """Get current runner for display"""
    try:
        # Return the most recent timing data if available
        if not data_queue.empty():
            data = data_queue.get()
            return jsonify({
                'success': True,
                'runner': data
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No current runner data'
            }), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/display-settings', methods=['GET', 'POST'])
def manage_display_settings():
    """Get or update display settings"""
    settings_file = os.path.join(app.root_path, 'display_settings.json')
    
    if request.method == 'GET':
        try:
            if os.path.exists(settings_file):
                with open(settings_file, 'r') as f:
                    settings = json.load(f)
            else:
                settings = {'duration': 5}  # Default settings
            return jsonify(settings)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # POST method
    try:
        data = request.get_json()
        if os.path.exists(settings_file):
            with open(settings_file, 'r') as f:
                settings = json.load(f)
        else:
            settings = {}
        
        settings.update(data)
        
        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)
        
        return jsonify({'success': True, 'settings': settings})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def load_messages():
    """Load messages from JSON file"""
    messages_file = os.path.join(app.root_path, 'data', 'messages.json')
    try:
        if os.path.exists(messages_file):
            with open(messages_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('messages', RANDOM_MESSAGES)
        return RANDOM_MESSAGES
    except Exception as e:
        logger.error(f"Error loading messages: {e}")
        return RANDOM_MESSAGES

def save_messages(messages):
    """Save messages to JSON file"""
    messages_file = os.path.join(app.root_path, 'data', 'messages.json')
    try:
        os.makedirs(os.path.dirname(messages_file), exist_ok=True)
        with open(messages_file, 'w', encoding='utf-8') as f:
            json.dump({'messages': messages}, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logger.error(f"Error saving messages: {e}")
        return False

@app.route('/api/messages', methods=['GET', 'POST'])
def manage_messages():
    """Get all messages or add a new message"""
    if request.method == 'GET':
        return jsonify(load_messages())
        
    # POST method
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text field'}), 400
            
        messages = load_messages()
        if data['text'] not in messages:  # Only append if unique
            messages.append(data['text'])
            if save_messages(messages):
                return jsonify(messages)
            else:
                return jsonify({'error': 'Failed to save messages'}), 500
        return jsonify(messages)
        
    except Exception as e:
        logger.error(f"Error in manage_messages: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/messages/<int:index>', methods=['DELETE'])
def delete_message(index):
    """Delete a message by index"""
    try:
        messages = load_messages()
        if 0 <= index < len(messages):
            messages.pop(index)
            if save_messages(messages):
                return jsonify(messages)
            else:
                return jsonify({'error': 'Failed to save messages'}), 500
        return jsonify({'error': 'Invalid index'}), 400
    except Exception as e:
        logger.error(f"Error in delete_message: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/templates', methods=['GET', 'POST'])
def manage_templates():
    """Save a template or list available templates"""
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        name = data.get('name')
        
        # Handle both old and new template formats
        if 'html' in data:
            # Old format - single HTML string
            html = data.get('html')
        elif 'activeState' in data:
            # New format - complete template with states
            html = json.dumps(data, indent=2)
        else:
            return jsonify({'error': 'Missing template data'}), 400
            
        if not name or not html:
            return jsonify({'error': 'Missing name or template data'}), 400
            
        safe = ''.join(c for c in name if c.isalnum() or c in ('_', '-')).rstrip()
        
        # Use .json extension for new format templates
        if 'activeState' in data:
            file_path = os.path.join(TEMPLATE_DIR, f'{safe}.json')
        else:
            file_path = os.path.join(TEMPLATE_DIR, f'{safe}.html')
            
        try:
            with open(file_path, 'w', encoding='utf-8') as fp:
                fp.write(html)
            return jsonify({'success': True})
        except Exception as e:
            logger.error(f"Error saving template: {e}")
            return jsonify({'error': 'Failed to save template'}), 500

    # GET method - list templates
    templates = []
    for f in os.listdir(TEMPLATE_DIR):
        if f.endswith('.html') or f.endswith('.json'):
            name = f[:-5] if f.endswith('.html') else f[:-5]
            templates.append(name)
    return jsonify(templates)


@app.route('/api/templates/<name>', methods=['GET', 'DELETE'])
def get_template(name):
    """Retrieve or delete a saved template"""
    safe = ''.join(c for c in name if c.isalnum() or c in ('_', '-')).rstrip()
    
    # Try both .json and .html extensions
    json_path = os.path.join(TEMPLATE_DIR, f'{safe}.json')
    html_path = os.path.join(TEMPLATE_DIR, f'{safe}.html')
    
    path = json_path if os.path.exists(json_path) else html_path
    
    if request.method == 'DELETE':
        if not os.path.exists(path):
            return jsonify({'error': 'Template not found'}), 404
        try:
            os.remove(path)
            return jsonify({'success': True})
        except Exception as e:
            logger.error(f"Failed to delete template {name}: {str(e)}")
            return jsonify({'error': 'Failed to delete template'}), 500
    
    # GET method
    if not os.path.exists(path):
        return jsonify({'error': 'Template not found'}), 404
        
    try:
        with open(path, 'r', encoding='utf-8') as fp:
            content = fp.read()
            
        # Try to parse as JSON first (new format)
        try:
            template_data = json.loads(content)
            return jsonify(template_data)
        except json.JSONDecodeError:
            # Fall back to old format (HTML only)
            return jsonify({'html': content})
            
    except Exception as e:
        logger.error(f"Error reading template {name}: {e}")
        return jsonify({'error': 'Failed to read template'}), 500

# Timing API Endpoints
@app.route('/api/timing/database-status')
def timing_database_status():
    """Check timing database connection status"""
    db = get_timing_db()
    
    status = {
        'database_enabled': TIMING_CONFIG.get('store_to_database', False),
        'connected': False,
        'current_session': None,
        'error': None
    }
    
    if db and db.connection:
        try:
            with db.connection.cursor() as cursor:
                cursor.execute("SELECT version()")
                version = cursor.fetchone()[0]
                status.update({
                    'connected': True,
                    'current_session': db.current_session_id,
                    'database_version': version[:50]
                })
        except Exception as e:
            status['error'] = str(e)
    
    return jsonify(status)

@app.route('/api/timing/sessions')
def get_timing_sessions_simple():
    """Get timing sessions - simple version"""
    db = get_timing_db()
    if not db or not db.connection:
        return jsonify({'error': 'Database not connected'}), 500
    
    try:
        with db.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    s.id,
                    s.session_name,
                    s.event_name,
                    s.status,
                    s.created_at,
                    COUNT(tr.id) as total_reads
                FROM timing_sessions s
                LEFT JOIN timing_reads tr ON s.id = tr.session_id
                GROUP BY s.id, s.session_name, s.event_name, s.status, s.created_at
                ORDER BY s.created_at DESC
                LIMIT 10
            """)
            sessions = cursor.fetchall()
            
        return jsonify({
            'success': True,
            'sessions': [dict(session) for session in sessions]
        })
        
    except Exception as e:
        print(f"Error fetching sessions: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/timing/stats')
def get_timing_stats():
    """Get timing statistics for dashboard"""
    db = get_timing_db()
    if not db or not db.connection:
        return jsonify({'error': 'Database not connected'}), 500
    
    try:
        with db.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_reads,
                    COUNT(DISTINCT tag_code) as unique_tags,
                    COUNT(DISTINCT location_name) as total_locations,
                    MIN(read_timestamp) as first_read,
                    MAX(read_timestamp) as last_read
                FROM timing_reads tr
                JOIN timing_sessions ts ON tr.session_id = ts.id
                WHERE ts.status = 'active'
            """)
            overall_stats = cursor.fetchone()
            
            cursor.execute("""
                SELECT 
                    tr.location_name,
                    COUNT(*) as read_count,
                    COUNT(DISTINCT tr.tag_code) as unique_tags,
                    MAX(tr.read_timestamp) as last_read
                FROM timing_reads tr
                JOIN timing_sessions ts ON tr.session_id = ts.id
                WHERE ts.status = 'active'
                GROUP BY tr.location_name
                ORDER BY read_count DESC
            """)
            location_stats = cursor.fetchall()
            
        return jsonify({
            'success': True,
            'overall': dict(overall_stats) if overall_stats else {},
            'by_location': [dict(stat) for stat in location_stats],
            'generated_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Error fetching timing stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/timing/recent-reads')
def get_recent_timing_reads():
    """Get recent timing reads"""
    db = get_timing_db()
    if not db or not db.connection:
        return jsonify({'error': 'Database not connected'}), 500
    
    try:
        limit = int(request.args.get('limit', 50))
        
        with db.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    tr.*,
                    tl.description as location_description,
                    ts.session_name,
                    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - tr.read_timestamp)) as seconds_ago
                FROM timing_reads tr
                JOIN timing_locations tl ON tr.location_id = tl.id
                JOIN timing_sessions ts ON tr.session_id = ts.id
                WHERE ts.status = 'active'
                ORDER BY tr.read_timestamp DESC
                LIMIT %s
            """, (limit,))
            reads = cursor.fetchall()
            
        return jsonify({
            'success': True,
            'reads': [dict(read) for read in reads],
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Error fetching recent reads: {e}")
        return jsonify({'error': str(e)}), 500

# ===========================
# BACKGROUND REFRESH API ENDPOINTS
# ===========================

@app.route('/api/refresh/status')
def get_refresh_status():
    """Get current background refresh status"""
    global current_provider, refresh_active, last_roster_sync, roster_data, race_name
    return jsonify({
        'enabled': REFRESH_CONFIG['enabled'],
        'active': refresh_active,
        'provider': current_provider,
        'interval_seconds': REFRESH_CONFIG['interval_seconds'],
        'last_sync': last_roster_sync,
        'participants_count': len(roster_data),
        'race_name': race_name
    })

@app.route('/api/refresh/start', methods=['POST'])
def start_refresh_endpoint():
    """Manually start background refresh"""
    global current_provider, refresh_active
    if current_provider != 'runsignup':
        return jsonify({
            'success': False,
            'error': 'Background refresh only available for RunSignUp'
        }), 400
    
    success = start_background_refresh()
    return jsonify({
        'success': success,
        'active': refresh_active,
        'message': 'Background refresh started' if success else 'Background refresh already running'
    })

@app.route('/api/refresh/stop', methods=['POST'])
def stop_refresh_endpoint():
    """Manually stop background refresh"""
    global refresh_active
    stop_background_refresh()
    return jsonify({
        'success': True,
        'active': refresh_active,
        'message': 'Background refresh stopped'
    })

@app.route('/api/refresh/trigger', methods=['POST'])
def trigger_manual_refresh():
    """Trigger a manual roster refresh"""
    global current_provider, current_event_id, provider_credentials, last_roster_sync, roster_data, race_name
    try:
        if current_provider != 'runsignup':
            return jsonify({
                'success': False,
                'error': 'Manual refresh only available for RunSignUp'
            }), 400
        
        if not all([current_event_id, provider_credentials.get('api_key'), provider_credentials.get('api_secret')]):
            return jsonify({
                'success': False,
                'error': 'Missing credentials or event information'
            }), 400
        
        race_id = getattr(background_refresh_worker, 'race_id', None)
        if not race_id:
            return jsonify({
                'success': False,
                'error': 'No race ID available for refresh'
            }), 400
        
        # Perform manual refresh
        participants = fetch_runsignup_participants(
            race_id,
            current_event_id,
            provider_credentials.get('api_key'),
            provider_credentials.get('api_secret'),
            last_modified=last_roster_sync
        )
        
        updates_count = 0
        if participants:
            with roster_refresh_lock:
                for participant in participants:
                    try:
                        bib = participant.get('bib_num') or str(participant.get('registration_id', ''))
                        
                        if bib:
                            user_data = participant.get('user', {})
                            address = user_data.get('address', {})
                            
                            roster_data[bib] = {
                                'name': f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip(),
                                'first_name': user_data.get('first_name', ''),
                                'last_name': user_data.get('last_name', ''),
                                'age': str(participant.get('age', '')),
                                'gender': user_data.get('gender', ''),
                                'city': address.get('city', ''),
                                'state': address.get('state', ''),
                                'country': address.get('country_code', ''),
                                'race_name': race_name,
                                'bib': bib,
                                'registration_id': participant.get('registration_id', ''),
                                'provider': 'runsignup',
                                'last_updated': datetime.now().isoformat()
                            }
                            updates_count += 1
                            
                    except Exception as e:
                        continue
        
        # Update sync timestamp
        last_roster_sync = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        return jsonify({
            'success': True,
            'updates_count': updates_count,
            'total_participants': len(roster_data),
            'last_sync': last_roster_sync
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/refresh/config', methods=['GET', 'POST'])
def manage_refresh_config():
    """Get or update refresh configuration"""
    if request.method == 'GET':
        return jsonify(REFRESH_CONFIG)
    
    # POST - update configuration
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No configuration data provided'}), 400
        
        # Update allowed configuration fields
        allowed_fields = ['enabled', 'interval_seconds', 'debug_logging']
        updated_fields = []
        
        for field in allowed_fields:
            if field in data:
                old_value = REFRESH_CONFIG[field]
                REFRESH_CONFIG[field] = data[field]
                updated_fields.append(f"{field}: {old_value} → {data[field]}")
        
        if 'interval_seconds' in data and refresh_active:
            # If interval changed and refresh is active, restart it
            stop_background_refresh()
            time.sleep(1)
            start_background_refresh()
            updated_fields.append("refresh restarted with new interval")
        
        return jsonify({
            'success': True,
            'updated_fields': updated_fields,
            'config': REFRESH_CONFIG
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    import atexit
    
    # Register cleanup function
    def cleanup():
        """Clean up background threads on shutdown"""
        stop_background_refresh()
        
    atexit.register(cleanup)
    
    try:
        app.run(
            debug=SERVER_CONFIG['DEBUG'],
            host=SERVER_CONFIG['HOST'],
            port=SERVER_CONFIG['PORT'],
            use_reloader=False,
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n🛑 Shutting down gracefully...")
        cleanup()