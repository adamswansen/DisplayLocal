# config.py - Configuration for Race Display App

# API Configuration
# ChronoTrack API Configuration (working endpoint)
API_CONFIG = {
    'BASE_URL': 'https://api.chronotrack.com/api',
    'FORMAT': 'json',
    'CLIENT_ID': '727dae7f',  # Working ChronoTrack client ID
    'DEFAULT_USER_ID': 'your_email@domain.com',  # Your ChronoTrack username/email  
    'DEFAULT_PASSWORD': 'your_sha1_encoded_password_here'  # Your SHA-1 encoded password
}

# Protocol Configuration
PROTOCOL_CONFIG = {
    'HOST': '127.0.0.1',  # TCP host for timing data
    'PORT': 61611,       # TCP port for timing data  
    'TCP_HOST': '127.0.0.1',
    'TCP_PORT': 61611,
    'BUFFER_SIZE': 1024,
    'TIMEOUT': 30,
    'FIELD_SEPARATOR': '~',     # ChronoTrack field separator
    'LINE_TERMINATOR': '\r\n',  # ChronoTrack line terminator
    'FORMAT_ID': 'CT01_33'      # ChronoTrack timing format ID
}

# Server Configuration
SERVER_CONFIG = {
    'HOST': '127.0.0.1',
    'PORT': 8000,  # Changed from 5000 to avoid macOS Control Center conflict
    'DEBUG': True
}

# Timing Configuration
TIMING_CONFIG = {
    'store_to_database': False,
    'default_duration': 5000
}

# Random messages for display (can be customized)
RANDOM_MESSAGES = [
    "Great job, keep it up!",
    "You're doing amazing!",
    "Push through, you've got this!",
    "Almost there, stay strong!",
    "Excellent pace!"
] 