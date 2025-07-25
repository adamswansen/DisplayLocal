# config.py - Unified configuration for Race Display App
import os

# Determine if we are running locally or on server
IS_SERVER = os.environ.get('RACE_DISPLAY_MODE', 'local') == 'server'

# Import everything from the original config
from config import *

# Override settings based on mode
if IS_SERVER:
    SERVER_CONFIG["HOST"] = "0.0.0.0"
    TIMING_CONFIG["store_to_database"] = True
else:
    SERVER_CONFIG["HOST"] = "127.0.0.1"
    TIMING_CONFIG["store_to_database"] = False
