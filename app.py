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
    API_CONFIG,
    PROTOCOL_CONFIG,
    SERVER_CONFIG
)
from bs4 import BeautifulSoup
import tinycss2
from urllib.parse import urljoin, urlparse
import logging
from PIL import Image
import atexit

app = Flask(__name__, static_folder='static')
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables
roster_data = {}
data_queue = queue.Queue()
current_event_id = None
race_name = None
current_runner = None  # Track the current runner for API endpoint
DISPLAY_DURATION = 5000  # Default duration in milliseconds

# Add queuing system variables
runner_queue = []  # Queue to store multiple runners
MAX_QUEUE_SIZE = 200  # Maximum number of runners in queue (increased from 50)
queue_lock = Lock()  # Thread lock for queue operations

# TCP/IP Settings
HOST = '127.0.0.1'
PORT = 61611
BUFFER_SIZE = 1024

# Add after global variables
listener_lock = Lock()
listeners_started = False

# Add to global variables
AUTH_SECRETS = {}  # Store connection-specific secrets

# Background refresh variables
results_refresh_thread = None
results_refresh_active = False
results_refresh_lock = Lock()
current_credentials = {}  # Store credentials for background refresh

# Last modified tracking for optimized API calls
last_modified_timestamps = {
    'results': None,
    'roster': None
}
initial_sync_complete = {
    'results': False,
    'roster': False
}

# Track progress while loading roster data
login_progress = {
    'total_entries': 0,
    'loaded_entries': 0,
    'complete': False
}

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

# RunSignUp specific global variables
current_provider = None
provider_credentials = {}
last_roster_sync = None

# Background refresh variables for RunSignUp
refresh_active = False
refresh_thread = None
roster_refresh_lock = Lock()

# Background refresh configuration
REFRESH_CONFIG = {
    'enabled': True,
    'interval_seconds': 30,  # RunSignUp uses 30-second intervals
    'debug_logging': False
}

# Directories for saved templates and uploaded images
TEMPLATE_DIR = os.path.join(app.root_path, 'saved_templates')
UPLOAD_DIR = os.path.join(app.static_folder, 'uploads')
DATA_DIR = os.path.join(app.root_path, 'data')
os.makedirs(TEMPLATE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Add mode tracking
current_mode = None  # 'pre-race' or 'results'
results_data = {}  # Store results data for results mode

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

def format_time_string(time_str):
    """
    Format time string according to display rules:
    - Remove all leading 0's and :'s
    - Round up to the next whole number
    - Example: 0:19:51.1 becomes 19:52
    """
    if not time_str or not isinstance(time_str, str):
        return time_str
    
    # Handle empty or invalid time strings
    time_str = time_str.strip()
    if not time_str or time_str == '':
        return time_str
    
    try:
        # Split by colons to get hours, minutes, seconds
        parts = time_str.split(':')
        
        if len(parts) == 3:  # HH:MM:SS format
            hours, minutes, seconds = parts
        elif len(parts) == 2:  # MM:SS format
            hours, minutes = 0, parts[0]
            seconds = parts[1]
        else:
            # If it's not a standard time format, return as is
            return time_str
        
        # Convert to integers/floats
        hours = int(hours) if hours.isdigit() else 0
        minutes = int(minutes) if minutes.isdigit() else 0
        
        # Handle seconds which might have decimal places
        if '.' in seconds:
            sec_parts = seconds.split('.')
            sec_int = int(sec_parts[0]) if sec_parts[0].isdigit() else 0
            sec_decimal = float('0.' + sec_parts[1]) if len(sec_parts) > 1 else 0
        else:
            sec_int = int(seconds) if seconds.isdigit() else 0
            sec_decimal = 0
        
        # Round up to the next whole second
        if sec_decimal > 0:
            sec_int += 1
        
        # Handle minute overflow
        if sec_int >= 60:
            minutes += sec_int // 60
            sec_int = sec_int % 60
        
        # Handle hour overflow
        if minutes >= 60:
            hours += minutes // 60
            minutes = minutes % 60
        
        # Format the result, removing leading zeros and unnecessary parts
        if hours > 0:
            # Format: H:MM:SS
            return f"{hours}:{minutes:02d}:{sec_int:02d}"
        elif minutes > 0:
            # Format: M:SS
            return f"{minutes}:{sec_int:02d}"
        else:
            # Format: SS
            return str(sec_int)
            
    except (ValueError, IndexError) as e:
        # If parsing fails, return the original string
        print(f"Warning: Could not parse time string '{time_str}': {e}")
        return time_str

def fetch_results_page(event_id, credentials, page=1, last_modified=None):
    """Fetch a single page of results data with optional last_modified optimization"""
    url = f"{API_CONFIG['BASE_URL']}/event/{event_id}/results"
    
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
        'size': 100  # Increased page size to reduce number of requests
    }
    
    # Add last_modified parameter for incremental sync if provided
    if last_modified:
        params['last_modified'] = last_modified
        print(f"🔄 Using incremental sync with last_modified: {last_modified}")
    
    print(f"Requesting results page {page} from: {url}")
    print(f"Request parameters: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Results API Response status: {response.status_code}")
        print(f"Results API Response headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"Results API Error: {response.text}")
            return None, None
            
        response.raise_for_status()
        data = response.json()
        
        # Validate response structure
        if not isinstance(data, dict):
            print(f"Invalid results response format: expected dict, got {type(data)}")
            return None, None
            
        if 'event_results' not in data:
            print(f"Missing 'event_results' in response: {data}")
            return None, None
            
        if not isinstance(data['event_results'], list):
            print(f"Invalid 'event_results' format: expected list, got {type(data['event_results'])}")
            return None, None
            
        if len(data['event_results']) > 0:
            if last_modified:
                print(f"✅ Incremental sync: fetched {len(data['event_results'])} modified results from page {page}")
            else:
                print(f"📥 Full sync: fetched {len(data['event_results'])} results from page {page}")
            # Log first result for debugging
            print(f"First result sample: {data['event_results'][0]}")
        else:
            if last_modified:
                print(f"✅ Incremental sync: no new/modified results on page {page}")
            else:
                print(f"Page {page} contained no results. Response data: {data}")
            
        return data, response.headers
        
    except requests.exceptions.RequestException as e:
        print(f"Results request error: {e}")
        return None, None
    except ValueError as e:
        print(f"Results JSON parsing error: {e}")
        print(f"Response content: {response.text[:500]}...")
        return None, None
    except Exception as e:
        print(f"Error fetching results page {page}: {e}")
        return None, None

def fetch_complete_results(event_id, credentials, incremental=False):
    """Fetch all pages of results data with optional incremental sync"""
    global results_data, race_name, last_modified_timestamps, initial_sync_complete
    
    # Determine if this is an incremental or full sync
    last_modified = None
    if incremental and initial_sync_complete['results'] and last_modified_timestamps['results']:
        last_modified = last_modified_timestamps['results']
        print(f"🔄 Starting incremental results sync from: {last_modified}")
    else:
        results_data = {}  # Clear existing data for full sync
        print(f"📥 Starting full results sync for event {event_id}")
    
    # Fetch first page to check if we have any results
    data, headers = fetch_results_page(event_id, credentials, page=1, last_modified=last_modified)
    if not data:
        print("Failed to fetch first page of results")
        return False
    
    # Update last modified timestamp from headers
    if headers.get('Last-Modified'):
        last_modified_timestamps['results'] = headers.get('Last-Modified')
        print(f"📅 Updated last_modified timestamp to: {last_modified_timestamps['results']}")
    elif headers.get('Date'):  # Fallback to Date header
        last_modified_timestamps['results'] = headers.get('Date')
        print(f"📅 Using Date header as timestamp: {last_modified_timestamps['results']}")
    
    # Check if we have any results on the first page
    if not data['event_results']:
        if incremental:
            print("✅ Incremental sync: no new results found")
            return True  # Success, just no new data
        else:
            print("No results found on first page")
            return False
    
    # Get pagination info from headers if available
    total_pages = int(headers.get('X-Ctlive-Page-Count', 1))
    total_rows = int(headers.get('X-Ctlive-Row-Count', 0))
    
    if incremental:
        print(f"🔄 Incremental sync - Pages: {total_pages}, Modified rows: {total_rows}")
    else:
        print(f"📥 Full sync - Pages: {total_pages}, Total rows: {total_rows}")
    
    # Process first page
    processed_count = 0
    for result in data['event_results']:
        bib = result.get('results_bib')
        if bib:
            # Map results data to our standard format with time formatting
            results_data[bib] = {
                'name': f"{result.get('results_first_name', '')} {result.get('results_last_name', '')}".strip(),
                'first_name': result.get('results_first_name', ''),
                'last_name': result.get('results_last_name', ''),
                'age': result.get('results_age', ''),
                'gender': result.get('results_sex', ''),
                'city': result.get('results_hometown', '').split(',')[0] if result.get('results_hometown') else '',
                'state': result.get('results_state_code', ''),
                'country': result.get('results_country_code', ''),
                'division': result.get('results_primary_bracket_name', ''),
                'race_name': result.get('results_event_name', ''),
                'reg_choice': result.get('results_race_name', ''),
                'wave': '',  # Not available in results
                'team_name': '',  # Not available in results
                'entry_status': 'completed',
                'entry_type': 'results',
                'entry_id': result.get('results_entry_id', ''),
                'athlete_id': '',  # Not available in results
                
                # Results-specific fields with time formatting
                'finish_time': format_time_string(result.get('results_time', '')),
                'gun_time': format_time_string(result.get('results_gun_time', '')),
                'pace': format_time_string(result.get('results_pace', '')),
                'gun_pace': format_time_string(result.get('results_gun_pace', '')),
                'pace_unit': result.get('results_pace_unit', ''),
                'overall_rank': result.get('results_rank', ''),
                'division_rank': result.get('results_rank', ''),  # Same as overall for now
                'penalty_time': format_time_string(result.get('results_penalty_time', '')),
                'time_with_penalty': format_time_string(result.get('results_time_with_penalty', '')),
                'gun_time_with_penalty': format_time_string(result.get('results_gun_time_with_penalty', '')),
                'start_time': format_time_string(result.get('results_start_time', '')),
                'finish_timestamp': result.get('results_end_chip_time', ''),
                'message': random.choice(load_messages())
            }
            processed_count += 1
            
            # Store race name from first result
            if race_name is None:
                race_name = result.get('results_event_name', '')
    
    # If we have pagination info, use it to fetch remaining pages
    if total_pages > 1:
        print(f"Fetching remaining pages (2 to {total_pages})")
        for page in range(2, total_pages + 1):
            print(f"Fetching results page {page} of {total_pages}")
            data, _ = fetch_results_page(event_id, credentials, page, last_modified=last_modified)
            if data and data['event_results']:
                for result in data['event_results']:
                    bib = result.get('results_bib')
                    if bib:
                        results_data[bib] = {
                            'name': f"{result.get('results_first_name', '')} {result.get('results_last_name', '')}".strip(),
                            'first_name': result.get('results_first_name', ''),
                            'last_name': result.get('results_last_name', ''),
                            'age': result.get('results_age', ''),
                            'gender': result.get('results_sex', ''),
                            'city': result.get('results_hometown', '').split(',')[0] if result.get('results_hometown') else '',
                            'state': result.get('results_state_code', ''),
                            'country': result.get('results_country_code', ''),
                            'division': result.get('results_primary_bracket_name', ''),
                            'race_name': result.get('results_event_name', ''),
                            'reg_choice': result.get('results_race_name', ''),
                            'wave': '',
                            'team_name': '',
                            'entry_status': 'completed',
                            'entry_type': 'results',
                            'entry_id': result.get('results_entry_id', ''),
                            'athlete_id': '',
                            
                            # Results-specific fields with time formatting
                            'finish_time': format_time_string(result.get('results_time', '')),
                            'gun_time': format_time_string(result.get('results_gun_time', '')),
                            'pace': format_time_string(result.get('results_pace', '')),
                            'gun_pace': format_time_string(result.get('results_gun_pace', '')),
                            'pace_unit': result.get('results_pace_unit', ''),
                            'overall_rank': result.get('results_rank', ''),
                            'division_rank': result.get('results_rank', ''),
                            'penalty_time': format_time_string(result.get('results_penalty_time', '')),
                            'time_with_penalty': format_time_string(result.get('results_time_with_penalty', '')),
                            'gun_time_with_penalty': format_time_string(result.get('results_gun_time_with_penalty', '')),
                            'start_time': format_time_string(result.get('results_start_time', '')),
                            'finish_timestamp': result.get('results_end_chip_time', ''),
                            'message': random.choice(load_messages())
                        }
                        processed_count += 1
            else:
                print(f"No data returned for page {page}, stopping pagination")
                break
    else:
        # If no pagination info, try to fetch additional pages until we get empty responses
        print("No pagination info available, will try to fetch additional pages until empty")
        page = 2
        while True:
            print(f"Trying to fetch results page {page}")
            data, _ = fetch_results_page(event_id, credentials, page, last_modified=last_modified)
            if not data or not data['event_results']:
                print(f"No more results found on page {page}, stopping")
                break
                
            for result in data['event_results']:
                bib = result.get('results_bib')
                if bib:
                    results_data[bib] = {
                        'name': f"{result.get('results_first_name', '')} {result.get('results_last_name', '')}".strip(),
                        'first_name': result.get('results_first_name', ''),
                        'last_name': result.get('results_last_name', ''),
                        'age': result.get('results_age', ''),
                        'gender': result.get('results_sex', ''),
                        'city': result.get('results_hometown', '').split(',')[0] if result.get('results_hometown') else '',
                        'state': result.get('results_state_code', ''),
                        'country': result.get('results_country_code', ''),
                        'division': result.get('results_primary_bracket_name', ''),
                        'race_name': result.get('results_event_name', ''),
                        'reg_choice': result.get('results_race_name', ''),
                        'wave': '',
                        'team_name': '',
                        'entry_status': 'completed',
                        'entry_type': 'results',
                        'entry_id': result.get('results_entry_id', ''),
                        'athlete_id': '',
                        
                        # Results-specific fields with time formatting
                        'finish_time': format_time_string(result.get('results_time', '')),
                        'gun_time': format_time_string(result.get('results_gun_time', '')),
                        'pace': format_time_string(result.get('results_pace', '')),
                        'gun_pace': format_time_string(result.get('results_gun_pace', '')),
                        'pace_unit': result.get('results_pace_unit', ''),
                        'overall_rank': result.get('results_rank', ''),
                        'division_rank': result.get('results_rank', ''),
                        'penalty_time': format_time_string(result.get('results_penalty_time', '')),
                        'time_with_penalty': format_time_string(result.get('results_time_with_penalty', '')),
                        'gun_time_with_penalty': format_time_string(result.get('results_gun_time_with_penalty', '')),
                        'start_time': format_time_string(result.get('results_start_time', '')),
                        'finish_timestamp': result.get('results_end_chip_time', ''),
                        'message': random.choice(load_messages())
                    }
                    processed_count += 1
            
            page += 1
    
    # Mark initial sync as complete
    initial_sync_complete['results'] = True
    
    if incremental:
        print(f"✅ Incremental sync complete: {processed_count} updated/new results")
        print(f"📊 Total results in database: {len(results_data)}")
    else:
        print(f"📥 Full sync complete: {len(results_data)} total results loaded")
        if total_rows > 0 and len(results_data) != total_rows:
            print(f"⚠️  Warning: Expected {total_rows} results but loaded {len(results_data)}")
    
    return True

def fetch_results_data(event_id, credentials):
    """Fetch results data from ChronoTrack API (legacy function for backward compatibility)"""
    return fetch_complete_results(event_id, credentials)

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
        try:
            command = PROTOCOL_CONFIG['FIELD_SEPARATOR'].join(map(str, fields))
            print(">>", command)
            message = (command + PROTOCOL_CONFIG['LINE_TERMINATOR']).encode('utf-8')
            self.wfile.write(message)
            self.wfile.flush()  # Ensure data is sent immediately
        except Exception as e:
            print(f"Error writing command: {e}")
            raise

    def read_command(self):
        """Read a command from the socket"""
        try:
            line = self.rfile.readline()
            if not line:
                return None
            command = line.strip().decode('utf-8', errors='ignore')
            if command:
                print("<<", command)
            return command
        except Exception as e:
            print(f"Error reading command: {e}")
            return None

    def handle(self):
        print(f"-- Client connected from {self.client_address} --")
        logger.info(f"TCP Client connected from {self.client_address}")
        
        try:
            # Consume the greeting
            greeting = self.read_command()
            print(f"Received greeting: {greeting}")

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
            connection_active = True
            while connection_active:
                line = self.read_command()
                if line is None:
                    print("No data received, client may have disconnected")
                    break
                
                if not line:
                    continue  # Skip empty lines
                
                print(f"Processing command: {line}")
                logger.info(f"TCP Processing command: {line}")

                if line == 'ping':
                    self.write_command("ack", "ping")
                    continue
                
                if line == 'stop':
                    print("Received stop command")
                    break

                # Handle initialization acknowledgments
                if line.startswith('ack~'):
                    parts = line.split('~')
                    if len(parts) >= 2:
                        ack_type = parts[1]
                        print(f"Received acknowledgment: {ack_type}")
                        if ack_type in ['init', 'geteventinfo', 'getlocations', 'start']:
                            continue

                # Process timing data
                processed_data = process_timing_data(line)
                if processed_data:
                    global current_runner
                    current_runner = processed_data  # Update current runner for API endpoint
                    data_queue.put(processed_data)

        except Exception as e:
            print(f"Error handling client connection: {e}")
        finally:
            print(f"-- Client {self.client_address} disconnected --")

def monitor_data_feed():
    """Start the TCP server"""
    print(f"Starting TCP server on {PROTOCOL_CONFIG['HOST']}:{PROTOCOL_CONFIG['PORT']}")
    try:
        server = socketserver.ThreadingTCPServer(
            (PROTOCOL_CONFIG['HOST'], PROTOCOL_CONFIG['PORT']), 
            TimingHandler
        )
        # Allow reuse of the address to prevent "Address already in use" errors
        server.allow_reuse_address = True
        server.socket.setsockopt(socketserver.socket.SOL_SOCKET, socketserver.socket.SO_REUSEADDR, 1)
        
        print(f"Server listening on port {PROTOCOL_CONFIG['PORT']}")
        print("Waiting for ChronoTrack Live connections...")
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

def background_refresh_results():
    """Background thread to refresh results data every 60 seconds using incremental sync"""
    global results_refresh_active, current_event_id, current_credentials, results_data, race_name
    
    print("🔄 Background results refresh thread started (incremental mode)")
    
    while results_refresh_active:
        try:
            # Wait 60 seconds between refreshes
            for i in range(60):
                if not results_refresh_active:
                    break
                time.sleep(1)
            
            if not results_refresh_active:
                break
                
            print("🔄 Running incremental results refresh...")
            
            # Fetch updated results using incremental sync
            old_count = len(results_data)
            if fetch_complete_results(current_event_id, current_credentials, incremental=True):
                new_count = len(results_data)
                
                # Log changes
                if new_count > old_count:
                    print(f"📈 {new_count - old_count} new participants added")
                elif new_count < old_count:
                    print(f"📉 {old_count - new_count} participants removed")
                else:
                    print("✅ No new participants (data up to date)")
                    
                print(f"📊 Total participants: {new_count}")
            else:
                print("❌ Failed to refresh results data")
                
        except Exception as e:
            print(f"Error in background results refresh: {e}")
            
    print("🛑 Background results refresh thread stopped")

def start_results_refresh(event_id, credentials):
    """Start background refresh for results mode"""
    global results_refresh_thread, results_refresh_active, current_credentials, results_refresh_lock
    
    with results_refresh_lock:
        # Stop any existing refresh thread
        stop_results_refresh()
        
        # Store credentials for background refresh
        current_credentials = credentials.copy()
        
        # Start new refresh thread
        results_refresh_active = True
        results_refresh_thread = threading.Thread(target=background_refresh_results)
        results_refresh_thread.daemon = True
        results_refresh_thread.start()
        
        print("🚀 Started background results refresh (60 second intervals)")

def stop_results_refresh():
    """Stop background refresh thread"""
    global results_refresh_thread, results_refresh_active, results_refresh_lock
    
    with results_refresh_lock:
        if results_refresh_active:
            print("🛑 Stopping background results refresh...")
            results_refresh_active = False
            
            if results_refresh_thread and results_refresh_thread.is_alive():
                results_refresh_thread.join(timeout=5)  # Wait up to 5 seconds
                
            results_refresh_thread = None
            print("✅ Background results refresh stopped")

def process_timing_data(line):
    """Process timing data in CT01_33 format:
    format_id~sequence~location~bib~time~gator~tagcode~lap
    Example: CT01_33~1~start~9478~14:02:15.31~0~0F2A38~1
    """
    global current_mode, roster_data, results_data
    
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
            
            # Determine which data source to use based on current mode
            data_source = results_data if current_mode == 'results' else roster_data
            data_source_name = 'results' if current_mode == 'results' else 'roster'
                
            if data['bib'] in data_source:
                print(f"Found bib {data['bib']} in {data_source_name}")
                runner_data = data_source[data['bib']]
                
                # Create processed data with mode-specific fields
                processed_data = {
                    'name': runner_data.get('name', ''),
                    'first_name': runner_data.get('first_name', ''),
                    'last_name': runner_data.get('last_name', ''),
                    'age': runner_data.get('age', ''),
                    'gender': runner_data.get('gender', ''),
                    'city': runner_data.get('city', ''),
                    'state': runner_data.get('state', ''),
                    'country': runner_data.get('country', ''),
                    'division': runner_data.get('division', ''),
                    'race_name': runner_data.get('race_name', ''),
                    'reg_choice': runner_data.get('reg_choice', ''),
                    'wave': runner_data.get('wave', ''),
                    'team_name': runner_data.get('team_name', ''),
                    'message': random.choice(load_messages()),
                    'timestamp': data['time'],
                    'location': data['location'],
                    'lap': data['lap'],
                    'bib': data['bib']
                }
                
                # Add mode-specific fields for results mode
                if current_mode == 'results':
                    processed_data.update({
                        'finish_time': runner_data.get('finish_time', ''),
                        'gun_time': runner_data.get('gun_time', ''),
                        'pace': runner_data.get('pace', ''),
                        'gun_pace': runner_data.get('gun_pace', ''),
                        'overall_rank': runner_data.get('overall_rank', ''),
                        'division_rank': runner_data.get('division_rank', ''),
                        'penalty_time': runner_data.get('penalty_time', ''),
                        'time_with_penalty': runner_data.get('time_with_penalty', ''),
                        'gun_time_with_penalty': runner_data.get('gun_time_with_penalty', ''),
                        'start_time': runner_data.get('start_time', ''),
                        'finish_timestamp': runner_data.get('finish_timestamp', '')
                    })
                
                print(f"Runner found: {processed_data}")
                
                # Smart queue logic: immediate display if queue empty, otherwise add to queue
                global current_runner
                with queue_lock:
                    # Check if this runner is already in the queue
                    if not any(runner['bib'] == processed_data['bib'] for runner in runner_queue):
                        
                        # If queue is empty, set as current runner for immediate display
                        if len(runner_queue) == 0:
                            current_runner = processed_data
                            runner_queue.append(processed_data)
                            print(f"🚀 IMMEDIATE DISPLAY: {processed_data['name']} (bib: {processed_data['bib']}) - Queue was empty")
                            print(f"Queue size: {len(runner_queue)}")
                        else:
                            # Queue has runners, add to end for normal queueing
                            runner_queue.append(processed_data)
                            print(f"Added runner to queue: {processed_data['name']} (bib: {processed_data['bib']})")
                            print(f"Queue size: {len(runner_queue)}")
                        
                        # Limit queue size
                        if len(runner_queue) > MAX_QUEUE_SIZE:
                            removed = runner_queue.pop(0)  # Remove oldest runner
                            print(f"Queue full, removed runner: {removed['name']} (bib: {removed['bib']})")
                            # Update current_runner if we removed the first one
                            current_runner = runner_queue[0] if runner_queue else None
                    else:
                        print(f"Runner {processed_data['name']} (bib: {processed_data['bib']}) already in queue, skipping")
                
                return processed_data
            else:
                print(f"Bib {data['bib']} not found in {data_source_name}. Available bibs: {list(data_source.keys())[:5]}...")
                
                # Auto-create participant for unknown bibs in pre-race mode
                if current_mode == 'pre-race' and data['bib'] != 'guntime':
                    print(f"Auto-creating participant for bib {data['bib']}")
                    
                    # Generate realistic participant data
                    participant_info = generate_realistic_participant(data['bib'])
                    data_source[data['bib']] = participant_info
                    
                    # Create processed data for the new participant
                    processed_data = {
                        'name': participant_info['name'],
                        'first_name': participant_info['first_name'],
                        'last_name': participant_info['last_name'],
                        'age': participant_info['age'],
                        'gender': participant_info['gender'],
                        'city': participant_info['city'],
                        'state': participant_info['state'],
                        'country': participant_info['country'],
                        'division': participant_info['division'],
                        'race_name': participant_info['race_name'],
                        'reg_choice': participant_info['reg_choice'],
                        'wave': participant_info['wave'],
                        'team_name': participant_info['team_name'],
                        'message': random.choice(load_messages()),
                        'timestamp': data['time'],
                        'location': data['location'],
                        'lap': data['lap'],
                        'bib': data['bib']
                    }
                    
                    print(f"Auto-created participant: {processed_data['name']} (bib: {data['bib']}) - {processed_data['age']}yr {processed_data['gender']} from {processed_data['city']}")
                    
                    # Add to queue
                    with queue_lock:
                        if not any(runner['bib'] == processed_data['bib'] for runner in runner_queue):
                            if len(runner_queue) == 0:
                                current_runner = processed_data
                                runner_queue.append(processed_data)
                                print(f"🚀 IMMEDIATE DISPLAY: {processed_data['name']} (bib: {processed_data['bib']}) - Auto-created")
                            else:
                                runner_queue.append(processed_data)
                                print(f"Added auto-created runner to queue: {processed_data['name']} (bib: {processed_data['bib']})")
                    
                    return processed_data
                
    except Exception as e:
        print(f"Error processing timing data: {e}")
        print(f"Line causing error: {line}")
    return None

# Default messages if file is missing
DEFAULT_MESSAGES = [
    "Great job!",
    "Keep it up!",
    "You're doing amazing!",
    "Almost there!",
    "Looking strong!"
]

def load_messages():
    """Load messages from JSON file, return default list if file missing"""
    messages_file = os.path.join(DATA_DIR, 'messages.json')
    try:
        if os.path.exists(messages_file):
            with open(messages_file, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading messages: {e}")
    return DEFAULT_MESSAGES.copy()

def save_messages(messages):
    """Save messages list to JSON file"""
    messages_file = os.path.join(DATA_DIR, 'messages.json')
    try:
        with open(messages_file, 'w', encoding='utf-8') as f:
            json.dump(messages, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving messages: {e}")
        return False

# Add after the existing load_messages function

def generate_realistic_participant(bib):
    """Generate realistic participant data based on bib number"""
    # Sample first names
    first_names = [
        "John", "Mary", "David", "Sarah", "Michael", "Jennifer", "Robert", "Jessica",
        "William", "Ashley", "James", "Amanda", "Christopher", "Melissa", "Daniel",
        "Michelle", "Matthew", "Kimberly", "Anthony", "Amy", "Mark", "Angela",
        "Donald", "Helen", "Steven", "Deborah", "Paul", "Rachel", "Andrew", "Carolyn",
        "Kenneth", "Janet", "Lisa", "Catherine", "Kevin", "Frances", "Brian", "Christine",
        "George", "Samantha", "Edward", "Debra", "Ronald", "Nancy", "Timothy", "Maria",
        "Jason", "Sandra", "Jeffrey", "Donna", "Ryan", "Carol", "Jacob", "Ruth"
    ]
    
    # Sample last names
    last_names = [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
        "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
        "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
        "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
        "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
        "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
        "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker"
    ]
    
    # Sample cities
    cities = [
        "Austin", "Houston", "Dallas", "San Antonio", "Fort Worth", "El Paso", "Arlington",
        "Corpus Christi", "Plano", "Lubbock", "Laredo", "Irving", "Garland", "Frisco",
        "McKinney", "Grand Prairie", "Brownsville", "Killeen", "Pasadena", "Mesquite",
        "McAllen", "Carrollton", "Midland", "Waco", "Round Rock", "Richardson", "Lewisville",
        "College Station", "Pearland", "Denton", "Tyler", "Odessa", "Abilene", "Beaumont"
    ]
    
    # Use bib number as seed for consistent data generation
    import random
    random.seed(int(bib) if str(bib).isdigit() else hash(str(bib)))
    
    first_name = random.choice(first_names)
    last_name = random.choice(last_names)
    city = random.choice(cities)
    age = random.randint(18, 75)
    gender = random.choice(['M', 'F'])
    
    return {
        'name': f"{first_name} {last_name}",
        'first_name': first_name,
        'last_name': last_name,
        'age': str(age),
        'gender': gender,
        'city': city,
        'state': 'TX',
        'country': 'USA',
        'division': f"{'Men' if gender == 'M' else 'Women'} {age//10}0-{age//10}9",
        'race_name': race_name or 'ChronoTrack Live Event',
        'reg_choice': 'Marathon' if int(str(bib)[-1]) % 2 == 0 else 'Half Marathon',
        'wave': f"Wave {(int(str(bib)[-1]) % 3) + 1}",
        'team_name': random.choice(['', '', '', 'Running Club', 'Fitness Team', 'Marathon Group']),
        'entry_status': 'active',
        'entry_type': 'auto-created',
        'entry_id': str(bib),
        'athlete_id': str(bib)
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
                                        'race_id': race_info.get('race_id'),
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
        
        # Optimized parameters based on successful API test
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
# BACKGROUND REFRESH SYSTEM FOR RUNSIGNUP
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

# ---------------------------------------------------------------------------
# API Routes - These must come BEFORE the catch-all React routes
# ---------------------------------------------------------------------------

@app.route('/old')
def old_index():
    default_credentials = {
        'user_id': API_CONFIG.get('DEFAULT_USER_ID', ''),
        'event_id': API_CONFIG.get('DEFAULT_EVENT_ID', ''),
        'password': API_CONFIG.get('DEFAULT_PASSWORD', '')
    }
    return render_template('old_index.html', credentials=default_credentials)

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
            "total_stages": 3
        }
        
        # Test credentials by trying to fetch a small amount of roster data
        test_url = f"{API_CONFIG['BASE_URL']}/event/{current_event_id}/entry"
        test_params = {
            'format': API_CONFIG['FORMAT'],
            'client_id': API_CONFIG['CLIENT_ID'],
            'user_id': credentials['user_id'],
            'user_pass': encoded_password,
            'page': 1,
            'size': 1
        }
        
        try:
            test_response = requests.get(test_url, params=test_params, timeout=10)
            if test_response.status_code != 200:
                response.update({
                    "error": "Invalid credentials or event ID",
                    "stage": 1
                })
                return jsonify(response)
        except Exception as e:
            response.update({
                "error": f"Connection failed: {str(e)}",
                "stage": 1
            })
            return jsonify(response)
        
        response.update({
            "success": True,
            "status": "Authentication successful - Choose mode",
            "stage": 2,
            "credentials_valid": True,
            "event_id": current_event_id,
            "race_name": "Event"  # Will be updated when data is loaded
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

@app.route('/api/current-runner')
def get_current_runner():
    """Return current runner data for the display"""
    global current_runner, current_mode, results_data
    
    # Both modes use the same queue system for real-time data
    with queue_lock:
        if runner_queue:
            current_runner = runner_queue[0]
            return jsonify({
                'runner': current_runner,
                'queue_size': len(runner_queue),
                'max_queue_size': MAX_QUEUE_SIZE,
                'mode': current_mode
            })
        else:
            return jsonify({
                'runner': None,
                'queue_size': 0,
                'max_queue_size': MAX_QUEUE_SIZE,
                'mode': current_mode
            })

@app.route('/api/runner-displayed', methods=['POST'])
def mark_runner_displayed():
    """Mark the current runner as displayed and remove from queue"""
    global current_runner
    
    with queue_lock:
        if runner_queue:
            # Remove the first runner from the queue (FIFO)
            displayed_runner = runner_queue.pop(0)
            print(f"Runner displayed and removed from queue: {displayed_runner['name']} (bib: {displayed_runner['bib']})")
            print(f"Remaining queue size: {len(runner_queue)}")
            
            # Update current_runner to the next runner in queue (if any)
            current_runner = runner_queue[0] if runner_queue else None
            
            # Debug: Print the next few runners in queue
            if runner_queue:
                print(f"Next runners in queue:")
                for i, next_runner in enumerate(runner_queue[:3]):  # Show next 3 runners
                    print(f"  {i+1}. {next_runner['name']} (bib: {next_runner['bib']})")
            else:
                print("Queue is now empty")
            
            return jsonify({
                'success': True,
                'displayed_runner': displayed_runner,
                'next_runner': current_runner,
                'queue_size': len(runner_queue)
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No runners in queue'
            })

@app.route('/api/queue-status')
def get_queue_status():
    """Get current queue status"""
    with queue_lock:
        return jsonify({
            'queue_size': len(runner_queue),
            'max_queue_size': MAX_QUEUE_SIZE,
            'current_runner': current_runner,
            'queue_contents': [
                {
                    'name': runner['name'],
                    'bib': runner['bib'],
                    'timestamp': runner['timestamp']
                } for runner in runner_queue
            ]
        })

@app.route('/api/queue-clear', methods=['POST'])
def clear_queue():
    """Clear the runner queue"""
    global current_runner
    
    with queue_lock:
        cleared_count = len(runner_queue)
        runner_queue.clear()
        current_runner = None
        
        print(f"Queue cleared, removed {cleared_count} runners")
        
        return jsonify({
            'success': True,
            'cleared_count': cleared_count
        })

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

@app.route('/api/user-images', methods=['GET'])
def get_user_images():
    """Return list of user's uploaded images with metadata and thumbnails"""
    logger.info("Fetching user images")
    
    # Create thumbnails directory if it doesn't exist
    THUMBNAIL_DIR = os.path.join(UPLOAD_DIR, 'thumbnails')
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)
    
    images = []
    image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp')
    
    try:
        for filename in os.listdir(UPLOAD_DIR):
            if not (filename.lower().endswith(image_extensions) and not filename.startswith('.')):
                continue

            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.isdir(file_path):
                continue

            try:
                # Generate a clean display name
                display_name = os.path.splitext(filename)[0].replace('_', ' ').replace('-', ' ')
                display_name = ' '.join(word.capitalize() for word in display_name.split())

                # Create thumbnail path
                thumbnail_filename = f"thumb_{filename.rsplit('.', 1)[0]}.jpeg"
                thumbnail_path = os.path.join(THUMBNAIL_DIR, thumbnail_filename)

                # Generate thumbnail if it doesn't exist
                if not os.path.exists(thumbnail_path):
                    with Image.open(file_path) as img:
                        if img.mode in ('RGBA', 'LA', 'P'):
                            img = img.convert('RGB')
                        img.thumbnail((80, 80), Image.Resampling.LANCZOS)
                        img.save(thumbnail_path, 'JPEG', quality=85)
                        logger.info(f"Generated thumbnail for {filename}")

                # Get image dimensions
                with Image.open(file_path) as img:
                    width, height = img.size
                    dimensions = {'width': width, 'height': height}

                # Get file size
                file_size = os.path.getsize(file_path)

                image_data = {
                    'id': f"image-{filename}",
                    'filename': filename,
                    'displayName': display_name,
                    'url': f'/static/uploads/{filename}',
                    'thumbnail': f'/static/uploads/thumbnails/{thumbnail_filename}',
                    'dimensions': dimensions,
                    'fileSize': file_size,
                    'uploadDate': datetime.fromtimestamp(os.path.getctime(file_path)).isoformat()
                }
                images.append(image_data)

            except Exception as e:
                logger.error(f"Skipping problematic image {filename}: {e}")
                continue # Skip this image and move to the next one
        
        # Sort images by upload date (newest first)
        images.sort(key=lambda x: x['uploadDate'], reverse=True)
        
        logger.info(f"Found {len(images)} user images")
        return jsonify({'images': images})
        
    except Exception as e:
        logger.error(f"Error fetching user images: {e}")
        return jsonify({'error': f'Failed to fetch images: {str(e)}'}), 500

@app.route('/api/templates', methods=['GET', 'POST'])
def manage_templates():
    """Save a template or list available templates"""
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        name = data.get('name')
        
        # Handle new format with active/resting states
        if 'activeState' in data and 'restingState' in data:
            # New format with both states
            active_state = data.get('activeState', {})
            resting_state = data.get('restingState', {})
            canvas_width = data.get('canvasWidth', 1920)
            canvas_height = data.get('canvasHeight', 1080)
            
            if not name or not active_state.get('html'):
                return jsonify({'error': 'Missing name or active state html'}), 400
            
            # Create template object with both states
            template_data = {
                'name': name,
                'canvasWidth': canvas_width,
                'canvasHeight': canvas_height,
                'activeState': active_state,
                'restingState': resting_state,
                'version': '2.0'  # Mark as new format
            }
            
            safe = ''.join(c for c in name if c.isalnum() or c in ('_', '-')).rstrip()
            template_path = os.path.join(TEMPLATE_DIR, f'{safe}.json')
            old_html_path = os.path.join(TEMPLATE_DIR, f'{safe}.html')
            
            # Save the new JSON format
            with open(template_path, 'w', encoding='utf-8') as fp:
                json.dump(template_data, fp, indent=2)
            
            # Remove old HTML file if it exists to prevent duplicates
            if os.path.exists(old_html_path):
                try:
                    os.remove(old_html_path)
                    logger.info(f"Removed old HTML template {name} after saving new JSON format")
                except Exception as e:
                    logger.warning(f"Failed to remove old HTML template {name}: {str(e)}")
            
            return jsonify({'success': True})
        
        # Handle legacy format (single html)
        html = data.get('html')
        if not name or not html:
            return jsonify({'error': 'Missing name or html'}), 400
        
        safe = ''.join(c for c in name if c.isalnum() or c in ('_', '-')).rstrip()
        with open(os.path.join(TEMPLATE_DIR, f'{safe}.html'), 'w', encoding='utf-8') as fp:
            fp.write(html)
        return jsonify({'success': True})

    # GET method - list templates
    templates = []
    template_names = set()  # Track unique template names
    
    for f in os.listdir(TEMPLATE_DIR):
        if f.endswith('.html') or f.endswith('.json'):
            template_name = f[:-5] if f.endswith('.html') else f[:-5]
            
            # If we haven't seen this template name yet, add it
            if template_name not in template_names:
                template_names.add(template_name)
                templates.append(template_name)
    
    return jsonify(templates)


@app.route('/api/templates/<name>', methods=['GET', 'DELETE'])
def get_template(name):
    """Retrieve or delete a saved template"""
    safe = ''.join(c for c in name if c.isalnum() or c in ('_', '-')).rstrip()
    
    # Try new format first (.json)
    json_path = os.path.join(TEMPLATE_DIR, f'{safe}.json')
    html_path = os.path.join(TEMPLATE_DIR, f'{safe}.html')
    
    if request.method == 'DELETE':
        # Delete both formats if they exist
        deleted = False
        if os.path.exists(json_path):
            try:
                os.remove(json_path)
                deleted = True
            except Exception as e:
                logger.error(f"Failed to delete template {name}: {str(e)}")
                return jsonify({'error': 'Failed to delete template'}), 500
        
        if os.path.exists(html_path):
            try:
                os.remove(html_path)
                deleted = True
            except Exception as e:
                logger.error(f"Failed to delete template {name}: {str(e)}")
                return jsonify({'error': 'Failed to delete template'}), 500
        
        if not deleted:
            return jsonify({'error': 'Template not found'}), 404
        
        return jsonify({'success': True})
    
    # GET method
    if os.path.exists(json_path):
        # New format
        try:
            with open(json_path, 'r', encoding='utf-8') as fp:
                template_data = json.load(fp)
            return jsonify(template_data)
        except Exception as e:
            logger.error(f"Failed to load template {name}: {str(e)}")
            return jsonify({'error': 'Failed to load template'}), 500
    
    elif os.path.exists(html_path):
        # Legacy format
        try:
            with open(html_path, 'r', encoding='utf-8') as fp:
                html = fp.read()
            return jsonify({'html': html})
        except Exception as e:
            logger.error(f"Failed to load template {name}: {str(e)}")
            return jsonify({'error': 'Failed to load template'}), 500
    
    return jsonify({'error': 'Template not found'}), 404

@app.route('/api/templates/cleanup', methods=['POST'])
def cleanup_templates():
    """Clean up duplicate template files by removing old HTML files when JSON versions exist"""
    try:
        cleaned_count = 0
        
        # Get all files in the template directory
        files = os.listdir(TEMPLATE_DIR)
        
        # Group files by template name
        template_files = {}
        for filename in files:
            if filename.endswith('.html') or filename.endswith('.json'):
                template_name = filename[:-5]  # Remove extension
                if template_name not in template_files:
                    template_files[template_name] = []
                template_files[template_name].append(filename)
        
        # Check for duplicates and clean up
        for template_name, file_list in template_files.items():
            if len(file_list) > 1:
                logger.info(f"Found multiple files for template '{template_name}': {file_list}")
                
                # Check if we have both HTML and JSON versions
                html_file = f"{template_name}.html"
                json_file = f"{template_name}.json"
                
                if html_file in file_list and json_file in file_list:
                    # Remove the HTML file since JSON is the new format
                    html_path = os.path.join(TEMPLATE_DIR, html_file)
                    try:
                        os.remove(html_path)
                        logger.info(f"Removed old HTML file: {html_file}")
                        cleaned_count += 1
                    except Exception as e:
                        logger.error(f"Failed to remove {html_file}: {e}")
        
        return jsonify({
            'success': True,
            'cleaned_count': cleaned_count,
            'message': f'Cleaned up {cleaned_count} duplicate template files'
        })
        
    except Exception as e:
        logger.error(f"Error during template cleanup: {e}")
        return jsonify({'error': f'Cleanup failed: {str(e)}'}), 500

# ---------------------------------------------------------------------------
# React Frontend Routes - These must come AFTER all API routes
# ---------------------------------------------------------------------------

@app.route('/')
def serve_react_index():
    dist_dir = os.path.join(app.root_path, 'frontend', 'dist')
    return send_from_directory(dist_dir, 'index.html')

@app.route('/<path:path>')
def serve_react(path):
    dist_dir = os.path.join(app.root_path, 'frontend', 'dist')
    file_path = os.path.join(dist_dir, path)
    if path != '' and os.path.exists(file_path):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, 'index.html')

@app.route('/api/display-settings', methods=['GET', 'POST'])
def manage_display_settings():
    """Get or update display settings"""
    global DISPLAY_DURATION
    
    if request.method == 'POST':
        try:
            data = request.get_json()
            if 'duration' in data:
                
                duration = int(data['duration'])
                if 1 <= duration:
                    DISPLAY_DURATION = duration * 1000  # Convert to milliseconds
                    return jsonify({'success': True, 'duration': duration})
                else:
                    return jsonify({'error': 'Duration must be greater than 0'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 400
    
    # GET method
    return jsonify({
        'duration': DISPLAY_DURATION // 1000  # Convert to seconds
    })

@app.route('/api/queue-debug')
def get_queue_debug():
    """Debug endpoint to get detailed queue information"""
    with queue_lock:
        return jsonify({
            'queue_size': len(runner_queue),
            'max_queue_size': MAX_QUEUE_SIZE,
            'current_runner': current_runner,
            'queue_contents': [
                {
                    'name': runner['name'],
                    'bib': runner['bib'],
                    'timestamp': runner['timestamp']
                } for runner in runner_queue
            ],
            'all_bibs': [runner['bib'] for runner in runner_queue]
        })

# Add new endpoint for mode selection
@app.route('/api/select-mode', methods=['POST'])
def select_mode():
    """Handle mode selection (pre-race or results)"""
    global current_mode, current_event_id
    
    try:
        data = request.get_json()
        mode = data.get('mode')
        
        if mode not in ['pre-race', 'results']:
            return jsonify({
                'success': False,
                'error': 'Invalid mode. Must be "pre-race" or "results"'
            })
        
        current_mode = mode
        
        # CRITICAL FIX: Set current_event_id from request data
        if data.get('event_id'):
            current_event_id = data.get('event_id')
        
        # Get credentials from session or request
        credentials = {
            'user_id': data.get('user_id'),
            'user_pass': data.get('user_pass'),
            'event_id': current_event_id
        }
        
        if mode == 'pre-race':
            # Stop any existing background refresh (switching from results mode) - non-blocking
            def stop_refresh_async():
                stop_results_refresh()
            
            stop_thread = threading.Thread(target=stop_refresh_async, daemon=True)
            stop_thread.start()
            
            # Fetch roster data
            if fetch_complete_roster(current_event_id, credentials):
                # Successful roster download
                roster_loaded = len(roster_data)
                status_message = 'Ready to receive timing data'
            else:
                # Failed roster download - use auto-creation mode
                print("⚠️ Roster download failed, enabling auto-creation mode")
                roster_loaded = 0
                status_message = 'Ready to receive timing data (auto-creation enabled)'
            
            # Start listeners regardless of roster download success
            def start_listeners_async():
                start_listeners()
            
            listener_thread = threading.Thread(target=start_listeners_async, daemon=True)
            listener_thread.start()
            
            return jsonify({
                'success': True,
                'mode': 'pre-race',
                'status': status_message,
                'race_name': race_name or f'ChronoTrack Event {current_event_id}',
                'runners_loaded': roster_loaded,
                'middleware_connected': True,
                'display_active': True,
                'auto_creation_enabled': roster_loaded == 0
            })
        
        elif mode == 'results':
            # Stop any existing background refresh first (non-blocking)
            def stop_refresh_async():
                stop_results_refresh()
            
            stop_thread = threading.Thread(target=stop_refresh_async, daemon=True)
            stop_thread.start()
            
            # Fetch results data with full sync initially (incremental=False)
            if fetch_complete_results(current_event_id, credentials, incremental=False):
                # Start listeners asynchronously (don't wait for completion)
                def start_listeners_async():
                    start_listeners()
                
                listener_thread = threading.Thread(target=start_listeners_async, daemon=True)
                listener_thread.start()
                
                # Start background refresh for results mode (will use incremental)
                def start_refresh_async():
                    start_results_refresh(current_event_id, credentials)
                
                refresh_thread = threading.Thread(target=start_refresh_async, daemon=True)
                refresh_thread.start()
                
                return jsonify({
                    'success': True,
                    'mode': 'results',
                    'status': 'Results data loaded - Ready for timing data with optimized auto-refresh',
                    'race_name': race_name,
                    'results_loaded': len(results_data),
                    'middleware_connected': True,
                    'display_active': True,
                    'background_refresh': True,
                    'refresh_interval': 60,
                    'incremental_sync': True,
                    'last_modified': last_modified_timestamps.get('results', 'Not set')
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to fetch results data'
                })
                
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Mode selection failed: {str(e)}'
        })

# Add endpoint to get current mode and data
@app.route('/api/mode-status')
def get_mode_status():
    """Get current mode and data status"""
    global current_mode, roster_data, results_data, race_name, results_refresh_active
    
    if current_mode == 'pre-race':
        return jsonify({
            'mode': 'pre-race',
            'race_name': race_name,
            'data_count': len(roster_data),
            'data_type': 'roster',
            'background_refresh': False
        })
    elif current_mode == 'results':
        return jsonify({
            'mode': 'results',
            'race_name': race_name,
            'data_count': len(results_data),
            'data_type': 'results',
            'background_refresh': results_refresh_active,
            'refresh_interval': 60
        })
    else:
        return jsonify({
            'mode': None,
            'race_name': None,
            'data_count': 0,
            'data_type': None,
            'background_refresh': False
        })

@app.route('/api/sync-status')
def get_sync_status():
    """Get current sync status and timestamps"""
    global last_modified_timestamps, initial_sync_complete, results_refresh_active
    
    return jsonify({
        'last_modified_timestamps': last_modified_timestamps,
        'initial_sync_complete': initial_sync_complete,
        'background_refresh_active': results_refresh_active,
        'incremental_sync_enabled': True,
        'sync_interval_seconds': 60
    })

@app.route('/api/background-refresh', methods=['POST'])
def manage_background_refresh():
    """Start or stop background refresh for results mode"""
    global current_mode, current_event_id, results_refresh_active
    
    try:
        data = request.get_json()
        action = data.get('action')  # 'start' or 'stop'
        
        if action == 'stop':
            stop_results_refresh()
            return jsonify({
                'success': True,
                'action': 'stopped',
                'background_refresh': False
            })
        elif action == 'start':
            if current_mode != 'results':
                return jsonify({
                    'success': False,
                    'error': 'Background refresh only available in results mode'
                })
            
            if not current_credentials or not current_event_id:
                return jsonify({
                    'success': False,
                    'error': 'No credentials available for background refresh'
                })
            
            start_results_refresh(current_event_id, current_credentials)
            return jsonify({
                'success': True,
                'action': 'started',
                'background_refresh': True,
                'refresh_interval': 60,
                'incremental_sync': True
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Invalid action. Use "start" or "stop"'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to manage background refresh: {str(e)}'
        })

@app.route('/api/start-test-listener', methods=['POST'])
def start_test_listener():
    """Start TCP listener for testing without requiring ChronoTrack login"""
    global current_mode, race_name, roster_data
    
    try:
        # Set test mode
        current_mode = 'test'
        race_name = 'Test Event'
        
        # Add some test roster data so we can test timing data processing
        test_bibs = ['1234', '5678', '9999', '1111', '2222']
        for bib in test_bibs:
            roster_data[bib] = {
                'name': f'Test Runner {bib}',
                'first_name': f'Test{bib}',
                'last_name': f'Runner{bib}',
                'age': '25',
                'gender': 'M',
                'city': 'Test City',
                'state': 'TX',
                'country': 'USA',
                'division': 'Open',
                'race_name': 'Test Event',
                'reg_choice': 'Test Race',
                'wave': 'Wave 1',
                'team_name': 'Test Team',
                'entry_status': 'active',
                'entry_type': 'test',
                'entry_id': bib,
                'athlete_id': bib
            }
        
        # Start the TCP listener
        if start_listeners():
            return jsonify({
                'success': True,
                'mode': 'test',
                'status': 'Test TCP listener started',
                'race_name': race_name,
                'test_runners': len(roster_data),
                'tcp_port': PROTOCOL_CONFIG['PORT'],
                'message': 'Send CT01_33 format timing data to test'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to start TCP listener'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to start test listener: {str(e)}'
        })

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
        
        elif provider == 'chronotrack':
            # ChronoTrack doesn't have an events API - event_id is provided during login
            # Create a mock event based on the provided event_id
            event_id = credentials.get('event_id', '')
            
            if not event_id:
                return jsonify({
                    'success': False,
                    'error': 'Event ID is required for ChronoTrack'
                }), 400
            
            # Return the event directly since user already provided the event_id
            events = [{
                'event_id': event_id,
                'race_name': f'ChronoTrack Event {event_id}',
                'event_name': f'Event {event_id}',
                'event_date': 'Current Event',
                'location': 'ChronoTrack Live',
                'distance': 'Various',
                'units': 'miles',
            }]
            
            return jsonify({
                'success': True,
                'provider': provider,
                'events': events,
                'total_events': 1
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
        
        # Store provider info - handle both string and object formats
        if isinstance(provider_info, dict):
            current_provider = provider_info.get('id', 'runsignup')
        else:
            current_provider = str(provider_info) if provider_info else 'runsignup'
            
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
        
        elif current_provider == 'chronotrack':
            # Handle ChronoTrack event selection
            event_id = event_info.get('event_id')
            
            if not event_id:
                return jsonify({
                    'success': False,
                    'error': 'Event ID is required for ChronoTrack'
                })
            
            # For ChronoTrack, go directly to mode selection since we already have the event_id
            return jsonify({
                'success': True,
                'provider': current_provider,
                'event': event_info,
                'race_name': event_info.get('race_name', f'ChronoTrack Event {event_id}'),
                'status': 'ChronoTrack event selected - Choose mode (pre-race or results)',
                'ready_for_mode_selection': True,
                'event_id': event_id
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
        print("🧹 Cleaning up background threads...")
        stop_results_refresh()
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
    finally:
        # Cleanup background threads on shutdown
        print("🧹 Cleaning up background threads...")
        stop_results_refresh()
        stop_background_refresh()