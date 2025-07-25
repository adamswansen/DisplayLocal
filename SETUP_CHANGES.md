# Race Display App - Setup Changes Documentation

This document lists all the changes made to get the race display app working properly.

## 🔧 Files Created/Fixed

### 1. `config.py` - Created from scratch

The main configuration file was missing and needed to be created with proper API and protocol settings.

```python
# config.py - Configuration for Race Display App

# API Configuration - ChronoTrack API Configuration (working endpoint)
API_CONFIG = {
    'BASE_URL': 'https://api.chronotrack.com/api',  # Changed from RunSignUp to ChronoTrack
    'FORMAT': 'json',
    'CLIENT_ID': '727dae7f',  # Working ChronoTrack client ID
    'DEFAULT_USER_ID': 'aswansen@me.com',  # Your ChronoTrack username/email  
    'DEFAULT_PASSWORD': '148507a61a9b121e1b37172f1b8f84cacc38dd69'  # Your SHA-1 encoded password
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
```

### 2. `data/messages.json` - Fixed Git merge conflicts

The messages file had Git merge conflict markers that prevented JSON parsing.

**Before:**
```json
[
<<<<<<< HEAD
  "Good luck on Brady Street!"
=======
  "Great job!",
  "Keep it up!",
  "You're doing amazing!",
  "Almost there!",
  "Looking strong!"
>>>>>>> aa853022eed62768bfea787ce8e84e482c88bfd3
]
```

**After:**
```json
[
  "Great job!",
  "Keep it up!",
  "You're doing amazing!",
  "Almost there!",
  "Looking strong!",
  "Good luck on Brady Street!"
]
```

## 🎛️ Frontend Changes

### 3. `frontend/src/components/ModeSelectionModal.jsx` - Increased timeout

The frontend timeout was too short for ChronoTrack API calls.

**Before:**
```javascript
const timeoutDuration = 15000; // 15s for results
// ...
errorMessage = `Request timed out after 15 seconds. Please try again.`;
```

**After:**
```javascript
const timeoutDuration = 45000; // 45s for results (backend needs up to 30s)
// ...
errorMessage = `Request timed out after 45 seconds. Please try again.`;
```

## ⚙️ Backend Logic Changes

### 4. `app.py` - Immediate display logic (Major Change)

Modified the timing data processing to provide immediate display when the queue is empty.

**Before:**
```python
# Add to queue instead of just updating current_runner
with queue_lock:
    if not any(runner['bib'] == processed_data['bib'] for runner in runner_queue):
        runner_queue.append(processed_data)
        print(f"Added runner to queue: {processed_data['name']} (bib: {processed_data['bib']})")
```

**After:**
```python
# Smart queue logic: immediate display if queue empty, otherwise add to queue
global current_runner
with queue_lock:
    if not any(runner['bib'] == processed_data['bib'] for runner in runner_queue):
        
        # If queue is empty, set as current runner for immediate display
        if len(runner_queue) == 0:
            current_runner = processed_data
            runner_queue.append(processed_data)
            print(f"🚀 IMMEDIATE DISPLAY: {processed_data['name']} (bib: {processed_data['bib']}) - Queue was empty")
        else:
            # Queue has runners, add to end for normal queueing
            runner_queue.append(processed_data)
            print(f"Added runner to queue: {processed_data['name']} (bib: {processed_data['bib']})")
```

## 🔧 Runtime Configuration Changes

### 5. Display Duration - Increased from 5 to 15 seconds

**API Call Made:**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"duration": 15}' http://localhost:8000/api/display-settings
```

**Result:**
- **Before:** 5 seconds per runner (too fast to see)
- **After:** 15 seconds per runner (adequate viewing time)

### 6. Server Port - Changed from 5000 to 8000

**Before:**
```python
SERVER_CONFIG = {
    'PORT': 5000,  # Conflicted with macOS Control Center
}
```

**After:**
```python
SERVER_CONFIG = {
    'PORT': 8000,  # No conflicts
}
```

## 🏗️ Infrastructure Setup

### 7. Python Virtual Environment Setup

Created a virtual environment to avoid system package conflicts on macOS.

```bash
# Commands run:
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 8. React Frontend Build

Built the React frontend for production deployment.

```bash
# Commands run:
cd frontend
npm install
npm run build
# Generated dist/ folder with production React files
```

## 🔄 API Integration Fixes

### 9. ChronoTrack API Configuration

**Changed API Endpoint:**
- **From:** RunSignUp API (`https://runsignup.com/Rest`)
- **To:** ChronoTrack API (`https://api.chronotrack.com/api`)

**Working Configuration:**
- **Client ID:** `727dae7f`
- **Username:** `aswansen@me.com`
- **Password:** SHA-1 encoded
- **Event ID:** `86866` (2025 Macklind Mile)

### 10. Protocol Configuration for TCP Listener

Added missing TCP protocol fields that were required for the timing listener:

```python
# Added these fields:
'FIELD_SEPARATOR': '~',     # ChronoTrack field separator
'LINE_TERMINATOR': '\r\n',  # ChronoTrack line terminator
'FORMAT_ID': 'CT01_33'      # ChronoTrack timing format ID
```

## 🎯 Key Functional Improvements

### 11. Performance & Timing

| Setting | Before | After | Impact |
|---------|--------|-------|--------|
| Frontend timeout | 15s | 45s | Prevents premature API cancellation |
| Display duration | 5s | 15s | More time to see runners |
| Queue behavior | Always queue | Immediate when empty | Live runners display instantly |
| Auto-refresh | Not working | 30s intervals | Live data updates |

### 12. Error Resolution

✅ **Fixed JSON parsing errors** - Removed Git merge conflicts  
✅ **Fixed missing config imports** - Created complete config.py  
✅ **Fixed port conflicts** - Moved from 5000 to 8000  
✅ **Fixed API endpoint** - Changed from RunSignUp to ChronoTrack  
✅ **Fixed timeout issues** - Increased from 15s to 45s  
✅ **Fixed TCP listener** - Added missing protocol configuration  

## 📊 Final Working Configuration

| Component | Configuration | Status |
|-----------|---------------|--------|
| **Web Interface** | http://localhost:8000 | ✅ Working |
| **TCP Listener** | Port 61611 | ✅ Working |
| **API Integration** | ChronoTrack Live (event 86866) | ✅ Working |
| **Display Mode** | Results mode, 15-second duration | ✅ Working |
| **Queue System** | Immediate display when empty | ✅ Working |
| **Auto-refresh** | 30-second intervals | ✅ Working |
| **Frontend Timeout** | 45 seconds for API calls | ✅ Working |

## 🚀 How to Start the App

1. **Start the Flask backend:**
   ```bash
   cd /Users/adamswansen/Downloads/race_display-3
   source venv/bin/activate
   python app.py
   ```

2. **Open web browser:**
   ```
   http://localhost:8000
   ```

3. **Login flow:**
   - Enter ChronoTrack credentials
   - Select "Results Mode"
   - TCP listener starts automatically on port 61611

4. **Test with valid bibs:**
   - **1343** (Brady Huggins)
   - **619** (Will Dehmler)
   - **1032** (James Elam)
   - **1192** (Tom Cormier)

## 🎯 Expected Behavior

**Live Timing Data:**
- If queue is empty → Runner displays **immediately**
- If queue has runners → New runner waits in queue
- Each runner displays for **15 seconds**
- TCP listener receives data on port **61611**
- ChronoTrack API refreshes every **30 seconds**

## 📝 Notes

- App uses ChronoTrack API for the "2025 Macklind Mile" event
- All configuration is stored in `config.py`
- Virtual environment required due to macOS package management restrictions
- React frontend built and served from `frontend/dist/`
- Port 8000 used to avoid conflicts with macOS Control Center on port 5000

---

*Generated: June 28, 2025*  
*Race Display App Setup Documentation* 