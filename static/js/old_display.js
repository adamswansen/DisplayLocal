// Race Display - Core functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing race display');
    
    // Set up event listeners for buttons
    setupEventHandlers();
    
    // Define default themes
    window.themes = {
        default: {
            background: '#ffffff',
            text: '#000000',
            accent: '#0d6efd',
            nameFont: 'Arial',
            nameSize: '48px',
            nameAlign: 'center',
            messageFont: 'Arial',
            messageSize: '24px',
            messageAlign: 'center'
        }
    };
});

// Set up all event handlers
function setupEventHandlers() {
    console.log('Setting up event handlers');
    
    // Start Display button
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', function(event) {
            event.preventDefault();
            console.log('Start button clicked');
            startDisplay();
        });
    }
    
    // Test Connection button
    const testButton = document.getElementById('testConnectionButton');
    if (testButton) {
        testButton.addEventListener('click', function(event) {
            event.preventDefault();
            console.log('Test button clicked');
            testConnection();
        });
    }
}

// Test the API connection
function testConnection() {
    const form = document.getElementById('loginForm');
    const testButton = document.getElementById('testConnectionButton');
    const statusDiv = document.getElementById('status');
    
    // Disable the button
    testButton.disabled = true;
    testButton.textContent = 'Testing...';
    
    // Show testing message
    statusDiv.innerHTML = `
        <div class="alert alert-info">
            <h5>Testing API Connection</h5>
            <p class="mb-0">Verifying connection to the timing API...</p>
        </div>
    `;
    
    const formData = new FormData();
    const userId = document.getElementById('user-id').value;
    const password = document.getElementById('password').value; 
    const eventId = document.getElementById('event-id').value;
    
    // Validate input fields
    if (!userId || !password || !eventId) {
        statusDiv.innerHTML = `
            <div class="alert alert-danger">
                <h5>Missing Information</h5>
                <p>Please fill in all fields (User ID, Password, and Event ID).</p>
            </div>
        `;
        testButton.disabled = false;
        testButton.textContent = 'Test Connection';
        return;
    }
    
    formData.append('user_id', userId);
    formData.append('password', password);
    formData.append('event_id', eventId);
    
    console.log('Testing connection with credentials');
    
    fetch('/api/test-connection', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Test connection response:', data);
        
        // Enable the button
        testButton.disabled = false;
        testButton.textContent = 'Test Connection';
        
        if (data.success) {
            let entryInfo = '';
            if (data.data_sample && data.data_sample.has_entries) {
                if (data.data_sample.entry_count > 0) {
                    const entry = data.data_sample.first_entry;
                    const raceInfo = entry.race_name ? `<p>Race name: <strong>${entry.race_name}</strong></p>` : '';
                    const entryCount = `<p>Total entries: <strong>${data.headers['X-Ctlive-Page-Count'] * data.data_sample.entry_count}</strong></p>`;
                    entryInfo = `${raceInfo}${entryCount}`;
                } else {
                    entryInfo = '<p>No entries found for this event.</p>';
                }
            }
            
            statusDiv.innerHTML = `
                <div class="alert alert-success">
                    <h5>Connection Successful</h5>
                    <p>Successfully connected to the API for event ${eventId}</p>
                    ${entryInfo}
                    <small>Status code: ${data.status_code}</small>
                </div>
            `;
        } else {
            let errorDetails = '';
            if (data.status_code) {
                errorDetails = `<p>Status code: ${data.status_code}</p>`;
                if (data.error_text) {
                    errorDetails += `<p>Error: ${data.error_text}</p>`;
                }
            } else if (data.error) {
                errorDetails = `<p>Error: ${data.error}</p>`;
            }
            
            statusDiv.innerHTML = `
                <div class="alert alert-danger">
                    <h5>Connection Failed</h5>
                    ${errorDetails}
                    <p>Please check your credentials and event ID and try again.</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Test connection error:', error);
        
        // Enable the button
        testButton.disabled = false;
        testButton.textContent = 'Test Connection';
        
        statusDiv.innerHTML = `
            <div class="alert alert-danger">
                <h5>Connection Error</h5>
                <p>${error.message || 'Network error occurred'}</p>
                <p>There was a problem connecting to the server.</p>
            </div>
        `;
    });
}

// Start the display
function startDisplay() {
    console.log('Starting display...');
    const form = document.getElementById('loginForm');
    const startButton = document.getElementById('startButton');
    const statusDiv = document.getElementById('status');
    
    // Disable the form and button
    form.querySelectorAll('input').forEach(input => input.disabled = true);
    startButton.disabled = true;
    startButton.textContent = 'Connecting...';
    
    // Show progress with more detailed message
    statusDiv.innerHTML = `
        <div class="alert alert-info">
            <h5>Connecting to Timing System</h5>
            <p class="mb-0">Please wait. Wait time can vary depending on the size of the race.</p>
        </div>
    `;
    
    const formData = new FormData();
    const userId = document.getElementById('user-id').value;
    const password = document.getElementById('password').value; 
    const eventId = document.getElementById('event-id').value;
    
    formData.append('user_id', userId);
    formData.append('password', password);
    formData.append('event_id', eventId);
    
    console.log('Sending login request...');
    
    fetch('/api/login', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log('Login response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Login API response:', data);
        
        if (data.success) {
            // Hide login container
            document.getElementById('login-container').style.display = 'none';
            
            // Show customization container
            const customizationContainer = document.getElementById('customization-container');
            if (customizationContainer) {
                customizationContainer.style.display = 'block';
            }
            
            // Initialize display with race name
            const raceName = document.getElementById('race-name');
            if (raceName) {
                raceName.textContent = data.race_name || 'Race';
            }
            
            // Initialize EventSource for live updates
            initializeEventSource();
        } else {
            // Error - re-enable form
            form.querySelectorAll('input').forEach(input => input.disabled = false);
            startButton.disabled = false;
            startButton.textContent = 'Start Display';
            
            const errorMsg = data.error || 'Connection failed with no specific error message';
            console.error('Login failed:', errorMsg);
            
            statusDiv.innerHTML = `
                <div class="alert alert-danger">
                    <h4>Connection Failed</h4>
                    <p>Error: ${errorMsg}</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Login request error:', error);
        statusDiv.innerHTML = `
            <div class="alert alert-danger">
                <h4>Connection Error</h4>
                <p>${error.message || 'Please try again'}</p>
            </div>
        `;
        
        // Re-enable form on error
        form.querySelectorAll('input').forEach(input => input.disabled = false);
        startButton.disabled = false;
        startButton.textContent = 'Start Display';
    });
}

// Initialize the EventSource for live updates
function initializeEventSource() {
    if (window.eventSource) {
        window.eventSource.close();
    }
    
    console.log('Initializing event source...');
    window.eventSource = new EventSource('/stream');
    
    window.eventSource.onmessage = (event) => {
        console.log('Received event:', event.data);
        try {
            const data = JSON.parse(event.data);
            
            if (!data.keepalive) {
                updateDisplay(data);
            }
        } catch (e) {
            console.error('Error processing event data:', e);
        }
    };
    
    window.eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
    };
}

// Update the display with the runner data
function updateDisplay(data) {
    if (!data) return;
    
    console.log('Updating display with runner data:', data);
    
    const runnerName = document.getElementById('runner-name');
    const runnerCity = document.getElementById('runner-city');
    const message = document.getElementById('message');
    
    if (runnerName) runnerName.textContent = data.name || '';
    if (runnerCity) runnerCity.textContent = data.city || '';
    if (message) message.textContent = data.message || 'Great job!';
    
    // Add animation
    const container = document.getElementById('participant-info');
    if (container) {
        container.classList.add('animate');
        setTimeout(() => container.classList.remove('animate'), 2000);
    }
} 