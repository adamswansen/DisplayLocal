// EMERGENCY FIX - Add this at the beginning of your file for immediate execution
(function() {
    console.log('EMERGENCY FIX: Creating logo troubleshooter');
    
    // Create button immediately when script runs
    function createEmergencyButton() {
        console.log('Creating emergency button');
        
        // Create ultra-visible container
        const container = document.createElement('div');
        container.id = 'emergency-logo-fix-container';
        container.style.cssText = `
            position: fixed;
            top: 100px;
            left: 100px;
            width: 300px;
            height: auto;
            background-color: red;
            color: white;
            padding: 20px;
            border: 5px solid black;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.8);
            z-index: 999999999;
            font-size: 18px;
            text-align: center;
        `;
        
        // Add header
        const header = document.createElement('h2');
        header.textContent = 'LOGO FIX';
        header.style.cssText = 'margin: 0 0 15px 0; font-size: 24px; color: white;';
        container.appendChild(header);
        
        // Add button
        const button = document.createElement('button');
        button.textContent = 'FIX LOGO DISPLAY';
        button.style.cssText = `
            background-color: yellow;
            color: black;
            font-size: 20px;
            font-weight: bold;
            padding: 15px;
            border: 3px solid black;
            border-radius: 8px;
            cursor: pointer;
            width: 100%;
            margin-top: 10px;
        `;
        container.appendChild(button);
        
        // Add to body
        document.body.appendChild(container);
        console.log('Emergency button added to body');
        
        // Add button handler
        button.onclick = function() {
            console.log('Emergency button clicked');
            
            // Direct logo fix - force a logo to appear
            const logoFix = document.createElement('div');
            logoFix.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999999;
                width: 200px;
                height: 100px;
                background-color: white;
                padding: 10px;
                border-radius: 5px;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: none;
            `;
            
            // Add text to show where logo should be
            const logoText = document.createElement('div');
            logoText.textContent = 'LOGO APPEARS HERE';
            logoText.style.cssText = 'font-weight: bold; color: red; text-align: center;';
            logoFix.appendChild(logoText);
            
            // Add to body
            document.body.appendChild(logoFix);
            
            // Also override startLiveDisplay to ensure logo appears
            window.originalStartLiveDisplay = window.startLiveDisplay;
            window.startLiveDisplay = function() {
                if (window.originalStartLiveDisplay) {
                    window.originalStartLiveDisplay.apply(this, arguments);
                }
                
                setTimeout(function() {
                    const placeholder = document.createElement('div');
                    placeholder.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 9999999;
                        background-color: white;
                        padding: 10px;
                        border-radius: 5px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.5);
                        pointer-events: none;
                        font-weight: bold;
                        color: red;
                    `;
                    placeholder.textContent = 'LOGO POSITION';
                    document.body.appendChild(placeholder);
                }, 1000);
            };
            
            alert('Logo fix applied! You will now see a placeholder where the logo should appear.');
        };
    }
    
    // Try to create button immediately
    if (document.body) {
        createEmergencyButton();
    } else {
        // If document isn't ready, try again when it is
        window.addEventListener('DOMContentLoaded', createEmergencyButton);
        
        // Also try with a delay as a backup
        setTimeout(createEmergencyButton, 3000);
    }
})();

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
    
    console.log('Testing connection with:', {
        user_id: userId,
        event_id: eventId
    });
    
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
                <p>${error.message}</p>
                <p>There was a problem connecting to the server.</p>
            </div>
        `;
    });
}

function startDisplay() {
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
    
    console.log('Sending login request with:', {
        user_id: userId,
        event_id: eventId
    });
    
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
            customizationContainer.style.display = 'block';
            
            // Initialize preview with race name and default styles
            document.getElementById('preview-race-name').textContent = data.race_name || 'Race';
            document.getElementById('race-name').textContent = data.race_name || 'Race';
            
            // Define a default theme if themes is not defined
            const defaultTheme = {
                background: '#ffffff',
                text: '#000000',
                accent: '#0d6efd',
                nameFont: 'Arial',
                nameSize: '48px',
                nameAlign: 'center',
                messageFont: 'Arial',
                messageSize: '24px',
                messageAlign: 'center'
            };
            
            // Apply default theme if no saved theme exists
            try {
                const savedTheme = localStorage.getItem('displayTheme');
                if (savedTheme) {
                    applyTheme(JSON.parse(savedTheme));
                } else if (typeof themes !== 'undefined' && themes.default) {
                    applyTheme(themes.default);
                } else {
                    applyTheme(defaultTheme);
                }
                
                // Initialize all controls and preview
                if (typeof initializePreview === 'function') initializePreview();
                if (typeof initializeThemeControls === 'function') initializeThemeControls();
                if (typeof initializeLogoControls === 'function') initializeLogoControls();
                if (typeof initializeMessageControls === 'function') initializeMessageControls();
                
                // Show preview panel
                const previewPanel = document.querySelector('.preview-panel');
                if (previewPanel) previewPanel.style.display = 'block';
                
                // Initialize EventSource for live updates
                if (typeof initializeEventSource === 'function') initializeEventSource();
            } catch (error) {
                console.error('Error initializing display:', error);
                // Still show the customization container even if there's an error
            }
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

// Define themes globally if not already defined
if (typeof window.themes === 'undefined') {
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
        },
        modern: {
            background: '#f8f9fa',
            text: '#212529',
            accent: '#0dcaf0',
            nameFont: 'Helvetica',
            nameSize: '52px',
            nameAlign: 'center',
            messageFont: 'Helvetica',
            messageSize: '26px',
            messageAlign: 'center'
        },
        elegant: {
            background: '#f8f5f0',
            text: '#3e2723',
            accent: '#8d6e63',
            nameFont: 'Times New Roman',
            nameSize: '54px',
            nameAlign: 'center',
            messageFont: 'Times New Roman',
            messageSize: '28px',
            messageAlign: 'center'
        }
    };
}

// Define helper functions
function applyTheme(theme) {
    if (!theme) return;
    
    // Apply to display container
    const displayBg = document.getElementById('display-background');
    if (displayBg) {
        displayBg.style.backgroundColor = theme.background;
    }
    
    const runnerName = document.getElementById('runner-name');
    if (runnerName) {
        runnerName.style.color = theme.text;
        runnerName.style.fontFamily = theme.nameFont;
        runnerName.style.fontSize = theme.nameSize;
        runnerName.style.textAlign = theme.nameAlign;
    }
    
    const runnerCity = document.getElementById('runner-city');
    if (runnerCity) {
        runnerCity.style.color = theme.text;
    }
    
    const message = document.getElementById('message');
    if (message) {
        message.style.color = theme.text;
        message.style.fontFamily = theme.messageFont;
        message.style.fontSize = theme.messageSize;
        message.style.textAlign = theme.messageAlign;
    }
    
    // Also apply to preview
    const previewBg = document.getElementById('preview-background');
    if (previewBg) {
        previewBg.style.backgroundColor = theme.background;
    }
    
    const previewName = document.getElementById('preview-runner-name');
    if (previewName) {
        previewName.style.color = theme.text;
        previewName.style.fontFamily = theme.nameFont;
        previewName.style.fontSize = theme.nameSize;
        previewName.style.textAlign = theme.nameAlign;
    }
    
    const previewCity = document.getElementById('preview-runner-city');
    if (previewCity) {
        previewCity.style.color = theme.text;
    }
    
    const previewMessage = document.getElementById('preview-message');
    if (previewMessage) {
        previewMessage.style.color = theme.text;
        previewMessage.style.fontFamily = theme.messageFont;
        previewMessage.style.fontSize = theme.messageSize;
        previewMessage.style.textAlign = theme.messageAlign;
    }
}

// Simple EventSource initializer
function initializeEventSource() {
    if (window.eventSource) {
        window.eventSource.close();
    }
    
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

function updateDisplay(data) {
    if (!data) return;
    
    const runnerName = document.getElementById('runner-name');
    const runnerCity = document.getElementById('runner-city');
    const message = document.getElementById('message');
    
    if (runnerName) runnerName.textContent = data.name || '';
    if (runnerCity) runnerCity.textContent = data.city || '';
    if (message) message.textContent = data.message || '';
    
    // Add animation
    const container = document.getElementById('participant-info');
    if (container) {
        container.classList.add('animate');
        setTimeout(() => container.classList.remove('animate'), 2000);
    }
}

// Clean up EventSource when page is unloaded
window.addEventListener('unload', () => {
    if (window.eventSource) {
        window.eventSource.close();
    }
});

// Update the themes object with more presets
const themes = {
    default: {
        name: 'Default',
        background: '#ffffff',
        text: '#000000',
        accent: '#007bff',
        backgroundImage: '',
        nameFont: 'Arial',
        nameSize: '48px',
        nameColor: '#000000',
        messageFont: 'Arial',
        messageSize: '24px',
        messageColor: '#000000',
        nameAlign: 'center',
        messageAlign: 'center'
    },
    modern: {
        name: 'Modern',
        background: '#2c3e50',
        text: '#ecf0f1',
        accent: '#3498db',
        backgroundImage: '',
        nameFont: "'Trebuchet MS'",
        nameSize: '64px',
        nameColor: '#ffffff',
        messageFont: 'Arial',
        messageSize: '32px',
        messageColor: '#e74c3c',
        nameAlign: 'center',
        messageAlign: 'center'
    },
    elegant: {
        name: 'Elegant',
        background: '#f5f5f5',
        text: '#2c3e50',
        accent: '#e74c3c',
        backgroundImage: '',
        nameFont: "'Times New Roman'",
        nameSize: '56px',
        nameColor: '#2c3e50',
        messageFont: "'Times New Roman'",
        messageSize: '28px',
        messageColor: '#7f8c8d',
        nameAlign: 'center',
        messageAlign: 'center'
    },
    energetic: {
        name: 'Energetic',
        background: '#2ecc71',
        text: '#ffffff',
        accent: '#f1c40f',
        backgroundImage: '',
        nameFont: 'Impact',
        nameSize: '72px',
        nameColor: '#ffffff',
        messageFont: 'Verdana',
        messageSize: '36px',
        messageColor: '#f1c40f',
        nameAlign: 'center',
        messageAlign: 'center'
    },
    minimalist: {
        name: 'Minimalist',
        background: '#ffffff',
        text: '#34495e',
        accent: '#95a5a6',
        backgroundImage: '',
        nameFont: 'Arial',
        nameSize: '48px',
        nameColor: '#34495e',
        messageFont: 'Arial',
        messageSize: '24px',
        messageColor: '#95a5a6',
        nameAlign: 'left',
        messageAlign: 'left'
    }
};

function initializeThemeControls() {
    const themeSelect = document.getElementById('theme-select');
    const customColors = document.getElementById('custom-colors');
    
    // Show/hide custom colors when theme changes
    themeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customColors.style.display = 'block';
        } else {
            customColors.style.display = 'none';
            applyTheme(themes[e.target.value]);
        }
    });
    
    // Update the background image upload handler
    document.getElementById('bg-image').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5000000) { // 5MB limit
                alert('Warning: Large image files may cause display issues. Consider using a smaller image.');
            }
            
            console.log('Loading background image:', file.name, file.type, file.size + ' bytes');
            
            const reader = new FileReader();
            reader.onload = (e) => {
                // Create an image object to check dimensions
                const img = new Image();
                img.onload = function() {
                    console.log('Image loaded successfully. Dimensions:', img.width, 'x', img.height);
                    
                    // Store the image URL globally in TWO variables for redundancy
                    currentBackgroundImage = img.src;
                    window.currentBackgroundImage = img.src;
                    
                    // Apply to preview immediately
                    const previewDisplay = document.getElementById('preview-display');
                    previewDisplay.style.backgroundImage = `url("${img.src}")`;
                    previewDisplay.style.backgroundSize = 'cover';
                    previewDisplay.style.backgroundPosition = 'center';
                    
                    // Create a test div to verify image works as background
                    const testDiv = document.createElement('div');
                    testDiv.style.cssText = `
                        position: fixed; 
                        left: -9999px; 
                        width: 100px; 
                        height: 100px;
                        background-image: url("${img.src}");
                    `;
                    document.body.appendChild(testDiv);
                    
                    setTimeout(() => {
                        const computed = getComputedStyle(testDiv);
                        console.log('Background test:', computed.backgroundImage !== 'none' ? 'SUCCESS' : 'FAILED');
                        document.body.removeChild(testDiv);
                    }, 100);
                };
                
                img.onerror = function() {
                    console.error('Failed to load image');
                    alert('There was a problem with this image. Please try another image.');
                };
                
                img.src = e.target.result;
            };
            
            reader.readAsDataURL(file);
        }
    });
    
    // Add text customization handlers
    document.getElementById('name-size').addEventListener('input', (e) => {
        document.getElementById('name-size-value').textContent = e.target.value;
        document.getElementById('runner-name').style.fontSize = `${e.target.value}px`;
    });
    
    document.getElementById('message-size').addEventListener('input', (e) => {
        document.getElementById('message-size-value').textContent = e.target.value;
        document.getElementById('message').style.fontSize = `${e.target.value}px`;
    });
    
    ['name', 'message'].forEach(element => {
        document.getElementById(`${element}-font`).addEventListener('change', (e) => {
            document.getElementById(element === 'name' ? 'runner-name' : 'message').style.fontFamily = e.target.value;
        });
        
        document.getElementById(`${element}-color`).addEventListener('input', (e) => {
            document.getElementById(element === 'name' ? 'runner-name' : 'message').style.color = e.target.value;
        });
        
        // Add alignment handler
        document.getElementsByName(`${element}-align`).forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById(element === 'name' ? 'runner-name' : 'message').style.textAlign = e.target.value;
            });
        });
    });
}

function previewTheme() {
    const theme = getCurrentThemeSettings();
    applyTheme(theme, true);
}

function saveTheme() {
    const theme = getCurrentThemeSettings();
    applyTheme(theme);
    localStorage.setItem('displayTheme', JSON.stringify(theme));
    
    // Hide settings and make display fullscreen
    document.getElementById('display-settings').style.display = 'none';
    
    // Add fullscreen class to container
    const container = document.getElementById('display-container');
    container.classList.add('fullscreen-display');
}

// Add a toggle settings function
function toggleSettings() {
    const settings = document.getElementById('display-settings');
    console.log('Toggling settings visibility:', settings.style.display);
    settings.style.display = settings.style.display === 'none' ? 'block' : 'none';
}

function getCurrentThemeSettings() {
    let currentTheme = themes.default;
    const savedTheme = localStorage.getItem('displayTheme');
    if (savedTheme) {
        currentTheme = JSON.parse(savedTheme);
    }
    
    const container = document.getElementById('preview-display');
    const backgroundImage = container.style.backgroundImage;
    
    return {
        ...currentTheme,
        backgroundImage: backgroundImage || currentTheme.backgroundImage || '',
        nameFont: document.getElementById('name-font').value,
        nameSize: `${document.getElementById('name-size').value}px`,
        nameColor: document.getElementById('name-color').value,
        messageFont: document.getElementById('message-font').value,
        messageSize: `${document.getElementById('message-size').value}px`,
        messageColor: document.getElementById('message-color').value,
        nameAlign: document.querySelector('input[name="name-align"]:checked').value,
        messageAlign: document.querySelector('input[name="message-align"]:checked').value
    };
}

function applyTheme(theme, isPreview = false) {
    const container = document.getElementById('display-container');
    const runnerName = document.getElementById('runner-name');
    const message = document.getElementById('message');
    
    const style = `
        background-color: ${theme.background};
        color: ${theme.text};
        ${theme.backgroundImage ? `background-image: ${theme.backgroundImage};` : ''}
    `;
    
    if (isPreview) {
        container.setAttribute('data-preview-style', style);
        setTimeout(() => container.removeAttribute('data-preview-style'), 3000);
    } else {
        container.style = style;
        document.documentElement.style.setProperty('--accent-color', theme.accent);
        
        // Apply text styles
        runnerName.style.fontFamily = theme.nameFont;
        runnerName.style.fontSize = theme.nameSize;
        runnerName.style.color = theme.nameColor;
        
        message.style.fontFamily = theme.messageFont;
        message.style.fontSize = theme.messageSize;
        message.style.color = theme.messageColor;
        
        // Apply alignments
        runnerName.style.textAlign = theme.nameAlign;
        message.style.textAlign = theme.messageAlign;
        
        // Update radio buttons to match theme
        document.querySelector(`input[name="name-align"][value="${theme.nameAlign}"]`).checked = true;
        document.querySelector(`input[name="message-align"][value="${theme.messageAlign}"]`).checked = true;
    }
}

// Update global variables
let MAX_QUEUE_SIZE = 50; // Now let instead of const so we can change it

function initializePreview() {
    // Get preview elements
    const previewElements = {
        name: document.getElementById('preview-runner-name'),
        message: document.getElementById('preview-message'),
        container: document.getElementById('preview-display'),
        participantInfo: document.getElementById('preview-participant-info')
    };
    
    // Update preview in real-time as settings change
    ['name', 'message'].forEach(element => {
        // Font changes
        document.getElementById(`${element}-font`).addEventListener('change', (e) => {
            previewElements[element].style.fontFamily = e.target.value;
        });
        
        // Size changes
        document.getElementById(`${element}-size`).addEventListener('input', (e) => {
            previewElements[element].style.fontSize = `${e.target.value}px`;
            document.getElementById(`${element}-size-value`).textContent = e.target.value;
        });
        
        // Color changes
        document.getElementById(`${element}-color`).addEventListener('input', (e) => {
            previewElements[element].style.color = e.target.value;
        });
        
        // Alignment changes
        document.getElementsByName(`${element}-align`).forEach(radio => {
            radio.addEventListener('change', (e) => {
                previewElements[element].style.textAlign = e.target.value;
            });
        });
    });
    
    // Background color changes
    document.getElementById('bg-color')?.addEventListener('input', (e) => {
        previewElements.container.style.backgroundColor = e.target.value;
    });
    
    // Text color changes
    document.getElementById('text-color')?.addEventListener('input', (e) => {
        previewElements.container.style.color = e.target.value;
    });
    
    // Background image changes
    document.getElementById('bg-image')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageUrl = `url(${e.target.result})`;
                previewElements.container.style.backgroundImage = imageUrl;
                previewElements.container.style.backgroundSize = 'cover';
                previewElements.container.style.backgroundPosition = 'center';
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Set initial preview content
    previewElements.name.textContent = "John Smith";
    previewElements.message.textContent = "You're crushing it! 💪";
    
    // Apply initial theme
    const savedTheme = localStorage.getItem('displayTheme');
    if (savedTheme) {
        applyTheme(JSON.parse(savedTheme), true);
    } else {
        applyTheme(themes.default, true);
    }

    // Logo upload handling
    document.getElementById('logo-upload').addEventListener('change', handleLogoUpload);
    
    // Logo position handling
    document.getElementsByName('logo-position').forEach(radio => {
        radio.addEventListener('change', updateLogoPosition);
    });

    // Initialize logo controls
    initializeLogoControls();

    initializeMessageControls();

    // Initialize queue size control
    const queueSizeSlider = document.getElementById('queue-size');
    const queueSizeValue = document.getElementById('queue-size-value');
    
    // Load saved queue size
    const savedQueueSize = localStorage.getItem('queueSize');
    if (savedQueueSize) {
        MAX_QUEUE_SIZE = parseInt(savedQueueSize);
        queueSizeSlider.value = MAX_QUEUE_SIZE;
        queueSizeValue.textContent = MAX_QUEUE_SIZE;
    }
    
    queueSizeSlider.addEventListener('input', (e) => {
        MAX_QUEUE_SIZE = parseInt(e.target.value);
        queueSizeValue.textContent = MAX_QUEUE_SIZE;
        localStorage.setItem('queueSize', MAX_QUEUE_SIZE);
        
        // If current queue is larger than new size, trim it
        if (messageQueue.length > MAX_QUEUE_SIZE) {
            const removed = messageQueue.length - MAX_QUEUE_SIZE;
            messageQueue = messageQueue.slice(-MAX_QUEUE_SIZE);
            console.log(`Queue size reduced. Removed ${removed} oldest entries.`);
            updateQueueStatus();
        }
    });
}

function initializeLogoControls() {
    const dropZone = document.getElementById('logo-drop-zone');
    const logoSize = document.getElementById('logo-size');
    const logoOpacity = document.getElementById('logo-opacity');
    
    if (!dropZone) {
        console.error('Drop zone not found');
        return;
    }
    
    console.log('Initializing logo controls');
    
    // File input handling
    const fileInput = dropZone.querySelector('input[type="file"]');
    if (fileInput) {
        fileInput.addEventListener('change', handleLogoUpload);
    }
    
    // Drag and drop handling
    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleLogoUpload({ target: { files: [file] } });
        }
    });
}

function updateLogoSize(size) {
    document.documentElement.style.setProperty('--logo-size', `${size}px`);
    localStorage.setItem('logoSize', size);
}

function updateLogoOpacity(opacity) {
    document.documentElement.style.setProperty('--logo-opacity', opacity);
    localStorage.setItem('logoOpacity', opacity);
}

function handleLogoUpload(event) {
    console.log('Logo upload triggered', event);
    const file = event.target.files[0] || event.dataTransfer?.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }
    console.log('Processing file:', file);

    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('File read complete');
        const img = new Image();
        img.onload = function() {
            console.log('Image loaded, dimensions:', img.width, 'x', img.height);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Get current size setting
            const size = document.getElementById('logo-size').value;
            let width = size;
            let height = size;
            
            // Maintain aspect ratio
            if (img.width > img.height) {
                height = (img.height / img.width) * size;
            } else {
                width = (img.width / img.height) * size;
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            const scaledImage = canvas.toDataURL('image/png');
            console.log('Image scaled and converted');
            
            // Apply to preview and live display
            const previewLogo = document.getElementById('preview-event-logo');
            const displayLogo = document.getElementById('event-logo');
            
            console.log('Applying to elements:', { previewLogo, displayLogo });
            
            [previewLogo, displayLogo].forEach(logo => {
                if (logo) {
                    logo.style.backgroundImage = `url(${scaledImage})`;
                    logo.style.width = `${width}px`;
                    logo.style.height = `${height}px`;
                    // Add default position if none set
                    if (!logo.classList.contains('top-left') && 
                        !logo.classList.contains('top-right') && 
                        !logo.classList.contains('bottom-left') && 
                        !logo.classList.contains('bottom-right')) {
                        logo.classList.add('top-right');
                    }
                }
            });
            
            // Save settings
            localStorage.setItem('eventLogo', scaledImage);
            localStorage.setItem('logoWidth', width);
            localStorage.setItem('logoHeight', height);
            console.log('Settings saved');
        };
        img.src = e.target.result;
    };
    
    reader.onerror = function(error) {
        console.error('Error reading file:', error);
    };
    
    reader.readAsDataURL(file);
}

function updateLogoPosition(event) {
    const position = event.target.value;
    const previewLogo = document.getElementById('preview-display').querySelector('.event-logo');
    const displayLogo = document.getElementById('display-container').querySelector('.event-logo');
    
    // Remove all position classes
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
        previewLogo.classList.remove(pos);
        displayLogo.classList.remove(pos);
    });
    
    // Add new position class
    previewLogo.classList.add(position);
    displayLogo.classList.add(position);
    
    // Save position preference
    localStorage.setItem('logoPosition', position);
}

function backToLogin() {
    document.getElementById('customization-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'block';
    // Reset form if needed
}

// First, add this to make sure the display container is initially hidden
document.addEventListener('DOMContentLoaded', function() {
    // Make sure display-container is hidden initially
    const displayContainer = document.getElementById('display-container');
    if (displayContainer) {
        displayContainer.style.display = 'none';
    }
});

// FINAL SOLUTION: Create a completely independent overlay system
document.addEventListener('DOMContentLoaded', function() {
    // Backup original function 
    const originalStartLiveDisplay = window.startLiveDisplay;
    
    // Completely replace the function with our custom implementation
    window.startLiveDisplay = function() {
        console.log('*** FINAL SOLUTION: Creating independent display overlay ***');
        
        // Hide customization container
        document.getElementById('customization-container').style.display = 'none';
        
        // Try multiple sources for the logo
        let logoUrl = window.currentLogoImage || localStorage.getItem('currentLogoBase64');
        console.log('Logo available for display?', !!logoUrl);
        
        // Create overlay container from scratch
        const overlay = document.createElement('div');
        overlay.id = 'independent-overlay';
        
        // 2. Add completely independent styling
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 99999;
            background-color: black;
            background-size: cover;
            background-position: center;
            overflow: hidden;
        `;
        
        // 3. Apply background image directly
        if (window.currentBackgroundImage) {
            overlay.style.backgroundImage = `url("${window.currentBackgroundImage}")`;
        }
        
        // 4. Create an independent structure for our content
        overlay.innerHTML = `
            <div id="overlay-race-title" style="
                position: absolute;
                top: 20px;
                left: 0;
                width: 100%;
                text-align: center;
                font-size: 32px;
                color: white;
                text-shadow: 2px 2px 5px black;
                z-index: 5;
            ">${document.getElementById('preview-race-name').textContent || '5K Run/Walk'}</div>
            
            <div id="overlay-runner-info" style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 1200px;
                padding: 40px;
                background-color: rgba(0,0,0,0.6);
                border-radius: 15px;
                text-align: center;
                box-shadow: 0 0 30px rgba(0,0,0,0.5);
                z-index: 10;
            ">
                <h1 id="overlay-name" style="
                    font-size: 130px;
                    font-weight: bold;
                    color: white;
                    text-shadow: 3px 3px 10px black;
                    margin: 0 0 30px 0;
                    line-height: 1.2;
                ">Loading Runner...</h1>
                
                <h2 id="overlay-city" style="
                    font-size: 72px;
                    color: white;
                    text-shadow: 2px 2px 8px black;
                    margin: 0 0 40px 0;
                "></h2>
                
                <p id="overlay-message" style="
                    font-size: 60px;
                    color: white;
                    text-shadow: 2px 2px 8px black;
                    font-weight: bold;
                    margin: 0;
                "></p>
            </div>
            
            <button id="overlay-exit" style="
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(0,0,0,0.5);
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 5px;
                cursor: pointer;
                z-index: 20;
            ">Exit</button>
        `;
        
        // 5. Add logo if available
        if (logoUrl) {
            console.log('Implementing bulletproof logo display');
            
            // Add new layer for the logo
            document.querySelectorAll('#direct-logo').forEach(el => el.remove()); // Remove any existing logos
            
            // 1. Create direct image element
            const logoImg = document.createElement('img');
            logoImg.id = 'direct-logo';
            logoImg.src = logoUrl;
            
            // 2. Apply inline styles directly to the element
            logoImg.setAttribute('style', `
                position: fixed !important;
                top: 20px !important;
                right: 70px !important;
                max-width: 250px !important;
                max-height: 120px !important;
                z-index: 99999999 !important;
                display: block !important;
                border: none !important;
                background: none !important;
                pointer-events: none !important;
            `);
            
            // 3. Add to document independently
            setTimeout(function() {
                document.body.appendChild(logoImg);
                console.log('Bulletproof logo added to body');
                
                // 4. Double-check with another timeout
                setTimeout(function() {
                    if (!document.getElementById('direct-logo') || 
                        !document.getElementById('direct-logo').complete) {
                        console.log('Logo not detected, forcing second attempt');
                        document.body.appendChild(logoImg.cloneNode(true));
                    }
                }, 1000);
            }, 500);
        }
        
        // 6. Add to body
        document.body.appendChild(overlay);
        
        // 7. Set up exit button
        document.getElementById('overlay-exit').addEventListener('click', function() {
            if (document.fullscreenElement) {
                document.exitFullscreen().then(() => {
                    overlay.remove();
                    document.getElementById('customization-container').style.display = 'block';
                });
            } else {
                overlay.remove();
                document.getElementById('customization-container').style.display = 'block';
            }
        });
        
        // 8. Set up event source with direct update to our elements
        setupDirectEventSource();
        
        // 9. Go fullscreen
        if (overlay.requestFullscreen) {
            overlay.requestFullscreen();
        } else if (overlay.webkitRequestFullscreen) {
            overlay.webkitRequestFullscreen();
        }
    };
    
    // Create a completely separate event source handler
    function setupDirectEventSource() {
        if (window.eventSource) {
            window.eventSource.close();
        }
        
        window.eventSource = new EventSource('/stream');
        
        window.eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                
                if (!data.keepalive) {
                    // Directly update our overlay elements
                    const nameElement = document.getElementById('overlay-name');
                    const cityElement = document.getElementById('overlay-city');
                    const messageElement = document.getElementById('overlay-message');
                    
                    if (nameElement && cityElement && messageElement) {
                        // Fade out
                        const container = document.getElementById('overlay-runner-info');
                        container.style.opacity = '0';
                        container.style.transition = 'opacity 0.3s ease';
                        
                        // Update after fade
                        setTimeout(() => {
                            nameElement.textContent = data.name || '';
                            cityElement.textContent = data.city || '';
                            messageElement.textContent = data.message || getRandomMessage();
                            
                            // Fade in
                            container.style.opacity = '1';
                        }, 300);
                    }
                }
            } catch (e) {
                console.error('Error handling event:', e);
            }
        };
        
        window.eventSource.onerror = function() {
            console.error('EventSource error');
            if (window.eventSource.readyState === EventSource.CLOSED) {
                setTimeout(setupDirectEventSource, 3000);
            }
        };
    }
});

// Update global variables
let customMessages = [];
const stockMessages = [
    "You're crushing it! 💪",
    "Looking strong! 🏃‍♂️",
    "Keep pushing! 🔥",
    "Almost there! ⭐",
    "You've got this! 🎯",
    "Incredible pace! 🚀",
    "Way to go! 🌟",
    "Outstanding effort! 💫"
];

function initializeMessageControls() {
    const uploadZone = document.getElementById('message-upload-zone');
    const fileInput = document.getElementById('message-upload');
    
    // Load saved messages
    const savedMessages = localStorage.getItem('customMessages');
    if (savedMessages) {
        customMessages = JSON.parse(savedMessages);
        updateMessageList();
    }
    
    fileInput.addEventListener('change', handleMessageFileUpload);
    
    // Drag and drop for message file
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.txt') || file.name.endsWith('.csv'))) {
            handleMessageFileUpload({ target: { files: [file] } });
        }
    });
}

function handleMessageFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (max 1MB)
    if (file.size > 1024 * 1024) {
        alert('File is too large. Please keep it under 1MB.');
        return;
    }
    
    // Check file type
    if (!file.name.match(/\.(txt|csv)$/i)) {
        alert('Please upload a .txt or .csv file');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            // Split by newline and filter out empty lines
            const messages = content.split(/\r?\n/)
                .map(msg => msg.trim())
                .filter(msg => msg.length > 0);
            
            // Validate messages
            if (messages.length === 0) {
                throw new Error('No valid messages found in file');
            }
            
            // Check each message
            const invalidMessages = messages.filter(msg => msg.length > 200);
            if (invalidMessages.length > 0) {
                throw new Error('Some messages are too long (max 200 characters)');
            }
            
            // Preview messages before saving
            const previewDialog = confirm(
                `Found ${messages.length} messages. Here are the first 3:\n\n` +
                messages.slice(0, 3).join('\n') +
                `\n\nWould you like to use these messages?`
            );
            
            if (previewDialog) {
                customMessages = messages;
                localStorage.setItem('customMessages', JSON.stringify(customMessages));
                updateMessageList();
                alert(`Successfully loaded ${messages.length} messages`);
            }
        } catch (error) {
            console.error('Error processing messages:', error);
            alert(`Error processing messages: ${error.message}`);
        }
    };
    
    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
}

function updateMessageList() {
    const container = document.getElementById('message-list-container');
    const list = document.getElementById('message-list');
    
    if (customMessages.length > 0) {
        container.style.display = 'block';
        const messageCount = `<div class="small text-muted mb-2">
            ${customMessages.length} custom message${customMessages.length === 1 ? '' : 's'}
        </div>`;
        
        // Add preview functionality
        list.innerHTML = messageCount + customMessages.map((msg, index) => `
            <div class="message-item">
                <span class="message-text">${msg}</span>
                <div class="message-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="previewMessage(${index})" title="Preview">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="editMessage(${index})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteMessage(${index})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } else {
        container.style.display = 'block';
        list.innerHTML = `
            <div class="text-muted text-center p-3">
                <p>No custom messages. Using ${stockMessages.length} stock messages.</p>
                <small>Upload a file or add messages manually to customize.</small>
                <div class="mt-2">
                    <button class="btn btn-sm btn-outline-primary" onclick="previewStockMessages()">
                        Preview Stock Messages
                    </button>
                </div>
            </div>
        `;
    }
}

function addCustomMessage() {
    const message = prompt('Enter new message (max 200 characters):');
    if (message?.trim()) {
        if (message.length > 200) {
            alert('Message is too long. Please keep it under 200 characters.');
            return;
        }
        customMessages.push(message.trim());
        localStorage.setItem('customMessages', JSON.stringify(customMessages));
        updateMessageList();
    }
}

function editMessage(index) {
    const message = prompt('Edit message (max 200 characters):', customMessages[index]);
    if (message?.trim()) {
        if (message.length > 200) {
            alert('Message is too long. Please keep it under 200 characters.');
            return;
        }
        customMessages[index] = message.trim();
        localStorage.setItem('customMessages', JSON.stringify(customMessages));
        updateMessageList();
    }
}

function deleteMessage(index) {
    if (confirm('Delete this message?')) {
        customMessages.splice(index, 1);
        localStorage.setItem('customMessages', JSON.stringify(customMessages));
        updateMessageList();
    }
}

function downloadMessages() {
    const content = customMessages.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom_messages.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Update the event source message handling to use custom or stock messages
function getRandomMessage() {
    const messages = customMessages.length > 0 ? customMessages : stockMessages;
    return messages[Math.floor(Math.random() * messages.length)];
}

// Add preview functions
function previewMessage(index) {
    const message = customMessages[index];
    document.getElementById('preview-message').textContent = message;
}

function previewStockMessages() {
    // Show stock messages in a modal or alert
    alert('Stock Messages:\n\n' + stockMessages.join('\n'));
}

// Update global variables
const DISPLAY_DURATION = 5000;

// Update animation configurations with more options
const animations = {
    transitions: [
        {
            in: 'animate__animated animate__fadeInUp',
            out: 'animate__animated animate__fadeOutDown'
        },
        {
            in: 'animate__animated animate__bounceInRight',
            out: 'animate__animated animate__bounceOutLeft'
        },
        {
            in: 'animate__animated animate__flipInX',
            out: 'animate__animated animate__flipOutX'
        },
        {
            in: 'animate__animated animate__zoomIn',
            out: 'animate__animated animate__zoomOut'
        }
    ],
    waiting: [
        {
            classes: 'animate__animated animate__pulse animate__infinite',
            text: "Waiting for next runner... 🏃‍♂️"
        },
        {
            classes: 'animate__animated animate__bounce animate__infinite',
            text: "Ready for next finisher! 🎉"
        },
        {
            classes: 'animate__animated animate__swing animate__infinite',
            text: "Who's next? 🤔"
        }
    ]
};

// Update displayRunnerInfo function
function displayRunnerInfo(data) {
    console.log('Displaying runner info:', data);
    isDisplaying = true;
    
    const container = document.getElementById('participant-info');
    const runnerName = document.getElementById('runner-name');
    const runnerCity = document.getElementById('runner-city');
    const message = document.getElementById('message');
    
    // Add exit animation
    container.className = 'animate__animated animate__fadeOutDown';
    
    setTimeout(() => {
        // Update content
        runnerName.textContent = data.name;
        runnerCity.textContent = data.city;
        message.textContent = data.message;
        
        // Add entrance animation
        container.className = 'animate__animated animate__fadeInUp';
        
        // Set timer for next display
        setTimeout(() => {
            isDisplaying = false;
            if (messageQueue.length > 0) {
                const nextData = messageQueue.shift();
                updateQueueStatus();
                displayRunnerInfo(nextData);
            } else {
                showWaitingAnimation();
            }
        }, 5000); // Display duration
    }, 750); // Animation duration
}

// Update showWaitingAnimation to use random waiting states
function showWaitingAnimation() {
    const container = document.getElementById('participant-info');
    const runnerName = document.getElementById('runner-name');
    const runnerCity = document.getElementById('runner-city');
    const message = document.getElementById('message');

    // Pick random waiting animation
    const waiting = animations.waiting[
        Math.floor(Math.random() * animations.waiting.length)
    ];

    // Add exit animation
    container.className = animations.transitions[0].out;
    
    setTimeout(() => {
        // Clear content
        runnerName.textContent = '';
        runnerCity.textContent = '';
        message.textContent = waiting.text;
        
        // Add waiting animation
        container.className = waiting.classes;
    }, 500);
}

// Update the queue status display to show max size
function updateQueueStatus() {
    const container = document.getElementById('display-container');
    let queueStatus = container.querySelector('.queue-status');
    
    if (messageQueue.length > 0) {
        if (!queueStatus) {
            queueStatus = document.createElement('div');
            queueStatus.className = 'queue-status';
            container.appendChild(queueStatus);
        }
        queueStatus.textContent = `${messageQueue.length}/${MAX_QUEUE_SIZE} runners in queue`;
    } else if (queueStatus) {
        queueStatus.remove();
    }
}

// Add to global variables at top
let extractedStyles = null;

function fetchWebsiteStyles() {
    const urlInput = document.getElementById('website-url');
    const url = urlInput.value.trim();
    
    if (!url) {
        alert('Please enter a valid URL');
        return;
    }
    
    // Show loading state
    urlInput.disabled = true;
    const preview = document.getElementById('style-preview');
    preview.innerHTML = '<div class="text-center">Analyzing website styles...</div>';
    preview.style.display = 'block';
    
    fetch('/api/fetch-styles', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
    })
    .then(response => response.json())
    .then(styles => {
        if (styles.error) {
            throw new Error(styles.error);
        }
        
        extractedStyles = styles;
        showStylePreview(styles);
    })
    .catch(error => {
        preview.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    })
    .finally(() => {
        urlInput.disabled = false;
    });
}

function showStylePreview(styles) {
    const preview = document.getElementById('style-preview');
    
    // Create color swatches with live preview on hover
    const colorHtml = styles.colors.slice(0, 5).map(color => `
        <div class="color-swatch" 
             style="background-color: ${color}" 
             title="${color}"
             onmouseover="previewColor('${color}')"
             onmouseout="resetPreview()">
        </div>
    `).join('');
    
    // Create font previews with live preview on hover
    const fontHtml = styles.fonts.slice(0, 3).map(font => `
        <div class="font-sample" 
             style="font-family: ${font}"
             onmouseover="previewFont('${font}')"
             onmouseout="resetPreview()">
            ${font.split(',')[0].replace(/['"]/g, '')}
        </div>
    `).join('');
    
    preview.innerHTML = `
        <h6>Extracted from ${styles.title || 'website'}</h6>
        <div class="row g-2">
            <div class="col-6">
                <label class="form-label small">Colors</label>
                <div class="color-swatches">
                    ${colorHtml}
                </div>
            </div>
            <div class="col-6">
                <label class="form-label small">Fonts</label>
                ${fontHtml}
            </div>
        </div>
        <div class="mt-3">
            <button class="btn btn-sm btn-primary" onclick="applyExtractedStyles()">
                Apply These Styles
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="resetPreview()">
                Reset Preview
            </button>
        </div>
    `;
}

function applyExtractedStyles() {
    if (!extractedStyles) return;
    
    // Get current theme to preserve background image and other custom settings
    const currentTheme = getCurrentThemeSettings();
    
    // Create a new theme based on extracted styles
    const theme = {
        name: 'Extracted',
        // Preserve custom background image if it exists
        background: currentTheme.backgroundImage ? 'transparent' : (extractedStyles.colors[0] || '#ffffff'),
        backgroundImage: currentTheme.backgroundImage || '',
        text: extractedStyles.colors[1] || '#000000',
        accent: extractedStyles.colors[2] || '#007bff',
        nameFont: extractedStyles.fonts[0] || 'Arial',
        nameSize: currentTheme.nameSize,
        nameColor: extractedStyles.colors[1] || '#000000',
        messageFont: extractedStyles.fonts[1] || 'Arial',
        messageSize: currentTheme.messageSize,
        messageColor: extractedStyles.colors[2] || '#007bff',
        nameAlign: currentTheme.nameAlign,
        messageAlign: currentTheme.messageAlign
    };
    
    // Apply to preview
    applyTheme(theme);
    
    // Save as current theme
    localStorage.setItem('displayTheme', JSON.stringify(theme));
    
    // Update form controls to match
    document.getElementById('name-font').value = theme.nameFont;
    document.getElementById('name-color').value = theme.nameColor;
    document.getElementById('message-font').value = theme.messageFont;
    document.getElementById('message-color').value = theme.messageColor;
    
    // Update custom colors section
    const customColors = document.getElementById('custom-colors');
    if (customColors) {
        document.getElementById('bg-color').value = theme.background;
        document.getElementById('text-color').value = theme.text;
        document.getElementById('accent-color').value = theme.accent;
        customColors.style.display = 'block';
    }
    
    // Show confirmation
    const preview = document.getElementById('style-preview');
    preview.innerHTML += `
        <div class="alert alert-success mt-3">
            Styles applied and saved! These will be used in the live display.
            ${theme.backgroundImage ? '<br><small>Custom background image preserved.</small>' : ''}
        </div>
    `;
}

// Add preview functions
function previewColor(color) {
    const previewDisplay = document.getElementById('preview-display');
    const previewName = document.getElementById('preview-runner-name');
    const previewCity = document.getElementById('preview-runner-city');
    const previewMessage = document.getElementById('preview-message');
    
    // Store current styles if not already stored
    if (!window.originalStyles) {
        window.originalStyles = {
            background: previewDisplay.style.background,
            nameColor: previewName.style.color,
            cityColor: previewCity.style.color,
            messageColor: previewMessage.style.color
        };
    }
    
    // Apply color preview
    previewDisplay.style.background = color;
    previewName.style.color = getContrastColor(color);
    previewCity.style.color = getContrastColor(color);
    previewMessage.style.color = getContrastColor(color);
}

function previewFont(font) {
    const previewName = document.getElementById('preview-runner-name');
    const previewMessage = document.getElementById('preview-message');
    
    // Store original fonts if not already stored
    if (!window.originalStyles) {
        window.originalStyles = {
            nameFont: previewName.style.fontFamily,
            messageFont: previewMessage.style.fontFamily
        };
    }
    
    // Apply font preview
    previewName.style.fontFamily = font;
    previewMessage.style.fontFamily = font;
}

function resetPreview() {
    if (window.originalStyles) {
        const previewDisplay = document.getElementById('preview-display');
        const previewName = document.getElementById('preview-runner-name');
        const previewCity = document.getElementById('preview-runner-city');
        const previewMessage = document.getElementById('preview-message');
        
        // Reset to original styles
        previewDisplay.style.background = window.originalStyles.background;
        previewName.style.color = window.originalStyles.nameColor;
        previewCity.style.color = window.originalStyles.cityColor;
        previewMessage.style.color = window.originalStyles.messageColor;
        previewName.style.fontFamily = window.originalStyles.nameFont;
        previewMessage.style.fontFamily = window.originalStyles.messageFont;
    }
}

// Helper function to determine contrasting text color
function getContrastColor(bgColor) {
    // Convert hex to RGB
    let color = bgColor.charAt(0) === '#' ? bgColor.substring(1, 7) : bgColor;
    let r = parseInt(color.substring(0, 2), 16);
    let g = parseInt(color.substring(2, 4), 16);
    let b = parseInt(color.substring(4, 6), 16);
    
    // Calculate luminance
    let luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black or white based on luminance
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Add this function
function clearSavedStyles() {
    localStorage.removeItem('displayTheme');
    localStorage.removeItem('extractedStyles');
}

function debugStyles() {
    const displayContainer = document.getElementById('display-container');
    const computedStyle = window.getComputedStyle(displayContainer);
    
    console.log('Display Container Styles:', {
        display: computedStyle.display,
        position: computedStyle.position,
        backgroundImage: computedStyle.backgroundImage,
        backgroundSize: computedStyle.backgroundSize,
        backgroundPosition: computedStyle.backgroundPosition,
        zIndex: computedStyle.zIndex,
        width: computedStyle.width,
        height: computedStyle.height
    });
    
    // Update debug display
    const bgDebug = document.getElementById('bg-debug');
    if (bgDebug) {
        bgDebug.textContent = computedStyle.backgroundImage;
    }
}

// Add this at the top level of your file
let currentBackgroundImage = null;

// Add at the top of main.js - debug helper
function debugImage(imageUrl) {
    console.log('Debug Image URL:', imageUrl ? imageUrl.substring(0, 50) + '...' : 'none');
    
    // Create test element to verify image can load
    const testImg = document.createElement('img');
    testImg.onload = () => console.log('Test image loaded successfully, dimensions:', testImg.width, 'x', testImg.height);
    testImg.onerror = (e) => console.error('Test image failed to load:', e);
    testImg.src = imageUrl;
}

// Add a test function for applying a simple color background
function startLiveDisplayWithColor() {
    try {
        console.log('Starting display with test background color...');
        
        // Hide customization
        document.getElementById('customization-container').style.display = 'none';
        
        // Get display container and clear all styles
        const displayContainer = document.getElementById('display-container');
        displayContainer.removeAttribute('style');
        
        // Apply simple styles with a vibrant background color
        displayContainer.style.cssText = `
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: #ff5500; /* Bright orange for testing */
            color: white;
            z-index: 1000;
        `;
        
        // Position participant info in center
        const participantInfo = document.getElementById('participant-info');
        participantInfo.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            width: 80%;
            max-width: 800px;
            z-index: 10;
        `;
        
        // Style text elements for visibility
        const runnerName = document.getElementById('runner-name');
        const runnerCity = document.getElementById('runner-city');
        const message = document.getElementById('message');
        
        runnerName.style.cssText = `
            font-size: 64px;
            font-weight: bold;
            color: white;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
        `;
        
        runnerCity.style.cssText = `
            font-size: 36px;
            color: white;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
        `;
        
        message.style.cssText = `
            font-size: 32px;
            color: white;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
        `;
        
        // Go fullscreen
        if (displayContainer.requestFullscreen) {
            displayContainer.requestFullscreen();
        } else if (displayContainer.webkitRequestFullscreen) {
            displayContainer.webkitRequestFullscreen();
        }
        
        // Add a test button to try the image display
        setTimeout(() => {
            const testButton = document.createElement('button');
            testButton.textContent = 'Try Background Image';
            testButton.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                padding: 10px;
                z-index: 1001;
            `;
            testButton.onclick = function() {
                if (window.currentBackgroundImage) {
                    displayContainer.style.backgroundImage = `url("${window.currentBackgroundImage}")`;
                    displayContainer.style.backgroundSize = 'cover';
                    displayContainer.style.backgroundPosition = 'center';
                    console.log('Applied background image via test button');
                } else {
                    alert('No background image available');
                }
            };
            displayContainer.appendChild(testButton);
        }, 1000);
        
    } catch (error) {
        console.error('Test display error:', error);
    }
}

// Move the button creation to the customization screen
document.addEventListener('DOMContentLoaded', function() {
    // We'll add the test button when customization screen appears
    const originalStartDisplay = window.startDisplay;
    
    window.startDisplay = function() {
        originalStartDisplay.apply(this, arguments);
        
        // The original function will show customization container on success
        // We'll listen for that change
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.target.style.display === 'block' && 
                    mutation.target.id === 'customization-container') {
                    addTestButton();
                    observer.disconnect();
                }
            });
        });
        
        observer.observe(document.getElementById('customization-container'), 
            { attributes: true, attributeFilter: ['style'] });
    };
});

function addTestButton() {
    // Find the "Start Live Display" button in the customization container
    const startButton = document.querySelector('#customization-container button.btn-primary');
    if (startButton) {
        // Create a new test button
        const testButton = document.createElement('button');
        testButton.textContent = 'Test Color Background';
        testButton.className = 'btn btn-warning ms-2'; // ms-2 adds margin for spacing
        testButton.onclick = startLiveDisplayWithColor;
        
        // Insert the test button after the start button
        startButton.parentNode.insertBefore(testButton, startButton.nextSibling);
        console.log('Test button added to customization screen');
    }
}

// 1. First, create a proper display structure function that prepares everything in advance
function setupDisplayContainer() {
    // Get or create all necessary elements
    const displayContainer = document.getElementById('display-container');
    
    // Clear existing content
    displayContainer.innerHTML = '';
    
    // Create layered structure
    displayContainer.innerHTML = `
        <div id="background-layer" class="full-layer"></div>
        <div id="logo-layer" class="full-layer"></div>
        <div id="content-layer" class="full-layer">
            <div id="race-name"></div>
            <div id="participant-info">
                <h1 id="runner-name"></h1>
                <h2 id="runner-city"></h2>
                <p id="message"></p>
            </div>
        </div>
        <div id="overlay-controls" class="controls-layer">
            <button id="exit-fullscreen">Exit</button>
        </div>
    `;
    
    // Add proper styling
    document.head.insertAdjacentHTML('beforeend', `
        <style>
            #display-container {
                display: none; /* Hidden by default */
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                overflow: hidden;
                color: white;
                z-index: 1000;
            }
            
            .full-layer {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
            }
            
            #background-layer {
                z-index: 1;
                background-color: black; /* Default background */
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }
            
            #logo-layer {
                z-index: 2;
                pointer-events: none;
                text-align: right;
                padding: 20px;
            }
            
            #logo-layer img {
                max-width: 300px;
                max-height: 200px;
            }
            
            #content-layer {
                z-index: 3;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
            }
            
            #race-name {
                position: absolute;
                top: 20px;
                left: 0;
                width: 100%;
                text-align: center;
                font-size: 32px;
                font-weight: bold;
            }
            
            #participant-info {
                padding: 20px;
                border-radius: 10px;
                background-color: rgba(0,0,0,0.4);
                max-width: 80%;
            }
            
            #runner-name {
                font-size: 64px;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
            }
            
            #runner-city {
                font-size: 36px;
                margin-bottom: 20px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
            }
            
            #message {
                font-size: 32px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
            }
            
            .controls-layer {
                position: absolute;
                top: 10px;
                right: 10px;
                z-index: 10;
            }
            
            #exit-fullscreen {
                background: rgba(0,0,0,0.5);
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 5px;
                cursor: pointer;
            }
        </style>
    `);
    
    // Set up the exit button
    document.getElementById('exit-fullscreen').addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().then(() => {
                displayContainer.style.display = 'none';
                document.getElementById('customization-container').style.display = 'block';
            });
        } else {
            displayContainer.style.display = 'none';
            document.getElementById('customization-container').style.display = 'block';
        }
    });
}

// 2. Call this setup function when the page loads
document.addEventListener('DOMContentLoaded', setupDisplayContainer);

// 3. Update the background image handler
document.getElementById('bg-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        console.log('Loading background image:', file.name, file.type, file.size);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            console.log('Background image loaded!');
            
            // Store the image URL globally
            window.currentBackgroundImage = imageUrl;
            
            // Apply to preview and prepare background layer
            const previewDisplay = document.getElementById('preview-display');
            if (previewDisplay) {
                previewDisplay.style.backgroundImage = `url("${imageUrl}")`;
                previewDisplay.style.backgroundSize = 'cover';
                previewDisplay.style.backgroundPosition = 'center';
            }
            
            // Also apply to the actual background layer so it's ready
            const backgroundLayer = document.getElementById('background-layer');
            if (backgroundLayer) {
                backgroundLayer.style.backgroundImage = `url("${imageUrl}")`;
            }
        };
        reader.readAsDataURL(file);
    }
});

// 4. Update the logo uploader similarly
document.getElementById('logo-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            
            // Store globally
            window.currentLogoImage = imageUrl;
            
            // Apply to preview
            const previewLogo = document.getElementById('preview-logo');
            if (previewLogo) {
                previewLogo.src = imageUrl;
                previewLogo.style.display = 'block';
            }
            
            // Also directly add to the logo layer for live display
            const logoLayer = document.getElementById('logo-layer');
            if (logoLayer) {
                // Clear existing content first
                logoLayer.innerHTML = '';
                
                // Create and add new logo image
                const logoImg = new Image();
                logoImg.src = imageUrl;
                logoImg.alt = 'Event Logo';
                logoImg.style.maxWidth = '300px';
                logoImg.style.maxHeight = '200px';
                logoLayer.appendChild(logoImg);
                
                console.log('Logo applied to live display layer');
            }
        };
        reader.readAsDataURL(file);
    }
});

// Enhance the runner information area for better visibility
document.addEventListener('DOMContentLoaded', function() {
    // Update participant-info styling for better visibility
    const style = document.createElement('style');
    style.textContent = `
        /* Enhanced participant info styling */
        #participant-info {
            padding: 30px;
            border-radius: 10px;
            background-color: rgba(0,0,0,0.6); /* More opacity for better contrast */
            max-width: 80%;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
        }
        
        #runner-name {
            font-size: 72px /* Larger font */
            font-weight: bold;
            margin-bottom: 15px;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.9); /* Enhanced shadow */
            color: white;
        }
        
        #runner-city {
            font-size: 42px /* Larger font */
            margin-bottom: 25px;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
            color: white;
        }
        
        #message {
            font-size: 36px;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
            color: white;
            font-weight: bold;
        }
        
        /* Add a smooth fade-in animation for runners */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .fade-in {
            animation: fadeIn 0.8s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
});

// Fix logo display issue
function fixLogoDisplay() {
    // Make sure logo is displayed on both preview and live display
    document.addEventListener('DOMContentLoaded', function() {
        // Update logo handling
        const logoUploader = document.getElementById('logo-image');
        if (logoUploader) {
            logoUploader.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageUrl = e.target.result;
                    console.log('Logo loaded successfully');
                    
                    // Store globally
                    window.currentLogoImage = imageUrl;
                    
                    // Apply to preview
                    const previewLogo = document.getElementById('preview-logo');
                    if (previewLogo) {
                        previewLogo.src = imageUrl;
                        previewLogo.style.display = 'block';
                    }
                    
                    // Also directly add to the logo layer for live display
                    const logoLayer = document.getElementById('logo-layer');
                    if (logoLayer) {
                        // Clear existing content first
                        logoLayer.innerHTML = '';
                        
                        // Create and add new logo image
                        const logoImg = new Image();
                        logoImg.src = imageUrl;
                        logoImg.alt = 'Event Logo';
                        logoImg.style.maxWidth = '300px';
                        logoImg.style.maxHeight = '200px';
                        logoLayer.appendChild(logoImg);
                        
                        console.log('Logo applied to live display layer');
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    });
}

// Improve runner info display
function improveRunnerDisplay() {
    const style = document.createElement('style');
    style.textContent = `
        /* Centered and larger runner info */
        #content-layer {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            width: 100%;
            height: 100%;
        }
        
        #participant-info {
            padding: 40px;
            border-radius: 15px;
            background-color: rgba(0,0,0,0.65);
            width: 90%;
            max-width: 1200px;
            box-shadow: 0 0 30px rgba(0,0,0,0.7);
            transition: all 0.4s ease;
        }
        
        #runner-name {
            font-size: 96px;
            font-weight: bold;
            margin-bottom: 20px;
            text-shadow: 3px 3px 10px rgba(0,0,0,0.9);
            color: white;
            line-height: 1.2;
        }
        
        #runner-city {
            font-size: 54px;
            margin-bottom: 30px;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
            color: white;
        }
        
        #message {
            font-size: 48px;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
            color: white;
            font-weight: bold;
        }
        
        /* Ensure logo is properly positioned */
        #logo-layer {
            position: absolute;
            top: 20px;
            right: 20px;
            width: auto;
            height: auto;
            text-align: right;
            z-index: 5;
        }
        
        #logo-layer img {
            max-width: 300px;
            max-height: 200px;
            display: block;
            margin-left: auto;
        }
    `;
    document.head.appendChild(style);
}

// Apply custom colors from customization to live display
function applyCustomColors() {
    // Update startLiveDisplay to apply customized text colors
    const originalStartLiveDisplay = window.startLiveDisplay;
    
    window.startLiveDisplay = function() {
        // Call the original function first
        originalStartLiveDisplay.apply(this, arguments);
        
        // Now apply the custom text colors from preview
        const previewName = document.getElementById('preview-runner-name');
        const previewCity = document.getElementById('preview-city');  
        const previewMessage = document.getElementById('preview-message');
        
        const liveName = document.getElementById('runner-name');
        const liveCity = document.getElementById('runner-city');
        const liveMessage = document.getElementById('message');
        
        if (previewName && liveName) {
            // Get computed styles from preview
            const nameStyle = window.getComputedStyle(previewName);
            const cityStyle = window.getComputedStyle(previewCity || previewName);
            const messageStyle = window.getComputedStyle(previewMessage);
            
            // Apply font family and colors while keeping size from our enhanced styles
            liveName.style.fontFamily = nameStyle.fontFamily;
            liveName.style.color = nameStyle.color;
            liveName.style.textAlign = nameStyle.textAlign;
            
            if (liveCity && cityStyle) {
                liveCity.style.fontFamily = cityStyle.fontFamily;
                liveCity.style.color = cityStyle.color;
                liveCity.style.textAlign = cityStyle.textAlign;
            }
            
            if (liveMessage && messageStyle) {
                liveMessage.style.fontFamily = messageStyle.fontFamily;
                liveMessage.style.color = messageStyle.color;
                liveMessage.style.textAlign = messageStyle.textAlign;
            }
            
            console.log('Custom text styling applied to live display');
        }
    };
}

// Add and run our fixes when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    fixLogoDisplay();
    improveRunnerDisplay();
    applyCustomColors();
});

// 1. Create a simplified, reliable fix for all display issues
function fixDisplayIssues() {
    // Override the startLiveDisplay function to ensure everything works correctly
    const originalStartLiveDisplay = window.startLiveDisplay;
    
    window.startLiveDisplay = function() {
        console.log('Starting enhanced live display...');
        
        // First, run the original function
        if (originalStartLiveDisplay) {
            originalStartLiveDisplay.apply(this, arguments);
        }
        
        // Now directly apply our fixes after a short delay to ensure elements exist
        setTimeout(() => {
            console.log('Applying display fixes...');
            
            // 1. Fix logo display - force it to appear
            if (window.currentLogoImage) {
                console.log('Applying logo:', window.currentLogoImage.substring(0, 30) + '...');
                
                const logoLayer = document.getElementById('logo-layer');
                if (logoLayer) {
                    // Force clear and recreate
                    logoLayer.innerHTML = '';
                    const logoImg = new Image();
                    logoImg.src = window.currentLogoImage;
                    logoImg.style.cssText = 'max-width: 300px; max-height: 200px; position: absolute; top: 20px; right: 20px; z-index: 100;';
                    logoLayer.appendChild(logoImg);
                }
            }
            
            // 2. Maximize text size and ensure proper positioning
            const participantInfo = document.getElementById('participant-info');
            if (participantInfo) {
                participantInfo.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90%;
                    max-width: 1400px;
                    background-color: rgba(0,0,0,0.7);
                    padding: 50px;
                    border-radius: 15px;
                    text-align: center;
                    z-index: 50;
                `;
            }
            
            // 3. Set text styles explicitly with maximum visibility
            const runnerName = document.getElementById('runner-name');
            if (runnerName) {
                runnerName.style.cssText = `
                    font-size: 120px !important;
                    font-weight: bold;
                    color: white !important;
                    text-shadow: 3px 3px 10px black;
                    margin-bottom: 30px;
                    line-height: 1.2;
                `;
            }
            
            const runnerCity = document.getElementById('runner-city');
            if (runnerCity) {
                runnerCity.style.cssText = `
                    font-size: 64px !important;
                    color: white !important;
                    text-shadow: 2px 2px 8px black;
                    margin-bottom: 30px;
                `;
            }
            
            const message = document.getElementById('message');
            if (message) {
                message.style.cssText = `
                    font-size: 54px !important;
                    font-weight: bold;
                    color: white !important;
                    text-shadow: 2px 2px 8px black;
                `;
            }
            
            console.log('Display fixes applied successfully');
        }, 300);
    };
}

// Call this when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    fixDisplayIssues();
});

// Direct fix function - extremely aggressive override
document.addEventListener('DOMContentLoaded', function() {
    // Store the original function to call later
    const originalStartLiveDisplay = window.startLiveDisplay;
    
    // Replace with our function that runs the original first then fixes everything
    window.startLiveDisplay = function() {
        console.log('Enhanced startLiveDisplay with direct fixes...');
        
        // First, store any logo that's already been uploaded
        const storedLogo = window.currentLogoImage;
        console.log('Pre-stored logo available:', !!storedLogo);
        
        // Run the original function
        if (originalStartLiveDisplay) {
            originalStartLiveDisplay.apply(this, arguments);
        }
        
        // Direct logo injection
        if (storedLogo) {
            // Directly inject logo into the page - bypass all normal methods
            console.log('Directly injecting logo...');
            
            // Create a floating logo element
            const floatingLogo = document.createElement('img');
            floatingLogo.src = storedLogo;
            floatingLogo.id = 'floating-logo';
            floatingLogo.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 300px;
                max-height: 200px;
                z-index: 9999;
                border: none;
            `;
            
            // Add directly to body
            document.body.appendChild(floatingLogo);
        }
        
        // Wait until display is active, then force text sizes and colors
        const applyFixedStyles = function() {
            // Force all text to be visible regardless of original settings
            const elements = {
                container: document.getElementById('participant-info'),
                name: document.getElementById('runner-name'),
                city: document.getElementById('runner-city'),
                message: document.getElementById('message')
            };
            
            if (elements.container) {
                console.log('Applying aggressive styles to participant info');
                
                // Apply direct styles to container
                Object.assign(elements.container.style, {
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '90%',
                    maxWidth: '1400px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    padding: '50px',
                    borderRadius: '15px',
                    textAlign: 'center',
                    zIndex: '999',
                    display: 'block'
                });
                
                // Force text styles for maximum visibility
                if (elements.name) {
                    Object.assign(elements.name.style, {
                        fontSize: '130px',
                        fontWeight: 'bold',
                        color: 'white',
                        textShadow: '3px 3px 10px black',
                        marginBottom: '30px',
                        lineHeight: '1.2',
                        display: 'block'
                    });
                }
                
                if (elements.city) {
                    Object.assign(elements.city.style, {
                        fontSize: '70px',
                        color: 'white',
                        textShadow: '2px 2px 8px black',
                        marginBottom: '30px',
                        display: 'block'
                    });
                }
                
                if (elements.message) {
                    Object.assign(elements.message.style, {
                        fontSize: '60px',
                        fontWeight: 'bold',
                        color: 'white',
                        textShadow: '2px 2px 8px black',
                        display: 'block'
                    });
                }
            }
        };
        
        // Run style fixes immediately and again after a short delay
        applyFixedStyles();
        setTimeout(applyFixedStyles, 500);
        setTimeout(applyFixedStyles, 1000);
    };
});

// Store logo in localStorage when it's uploaded
document.addEventListener('DOMContentLoaded', function() {
    const logoInput = document.getElementById('logo-image');
    if (logoInput) {
        logoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    // Store in localStorage for backup retrieval
                    try {
                        localStorage.setItem('currentLogoBase64', e.target.result);
                        console.log('Logo stored in localStorage');
                    } catch (error) {
                        console.warn('Could not store logo in localStorage:', error);
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// Replace the logo handling section in startLiveDisplay
window.startLiveDisplay = function() {
    console.log('*** FINAL SOLUTION: Creating independent display overlay ***');
    
    // Hide customization container
    document.getElementById('customization-container').style.display = 'none';
    
    // Try multiple sources for the logo
    let logoUrl = window.currentLogoImage || localStorage.getItem('currentLogoBase64');
    console.log('Logo available for display?', !!logoUrl);
    
    // Create overlay container from scratch
    const overlay = document.createElement('div');
    overlay.id = 'independent-overlay';
    
    // Rest of overlay creation code...
    
    // Add to body
    document.body.appendChild(overlay);
    
    // GUARANTEED logo display using multiple fallbacks
    if (logoUrl) {
        console.log('Implementing bulletproof logo display');
        
        // Add new layer for the logo
        document.querySelectorAll('#direct-logo').forEach(el => el.remove()); // Remove any existing logos
        
        // 1. Create direct image element
        const logoImg = document.createElement('img');
        logoImg.id = 'direct-logo';
        logoImg.src = logoUrl;
        
        // 2. Apply inline styles directly to the element
        logoImg.setAttribute('style', `
            position: fixed !important;
            top: 20px !important;
            right: 70px !important;
            max-width: 250px !important;
            max-height: 120px !important;
            z-index: 99999999 !important;
            display: block !important;
            border: none !important;
            background: none !important;
            pointer-events: none !important;
        `);
        
        // 3. Add to document independently
        setTimeout(function() {
            document.body.appendChild(logoImg);
            console.log('Bulletproof logo added to body');
            
            // 4. Double-check with another timeout
            setTimeout(function() {
                if (!document.getElementById('direct-logo') || 
                    !document.getElementById('direct-logo').complete) {
                    console.log('Logo not detected, forcing second attempt');
                    document.body.appendChild(logoImg.cloneNode(true));
                }
            }, 1000);
        }, 500);
    }
    
    // Rest of the function (event source setup, etc.)
};

// Final attempt at fixing the logo display
document.addEventListener('DOMContentLoaded', function() {
    // Add a debug button to test logo functionality
    const debugButton = document.createElement('button');
    debugButton.id = 'logo-debug-button';
    debugButton.textContent = 'Test Logo Display';
    debugButton.style.cssText = 'position: fixed; top: 10px; left: 10px; z-index: 9999; display: none;';
    document.body.appendChild(debugButton);
    
    // Debug function to test logo directly
    debugButton.onclick = function() {
        const logoData = localStorage.getItem('currentLogoBase64');
        if (logoData) {
            alert('Logo found in localStorage! Testing display...');
            
            // Create test image
            const testImg = new Image();
            testImg.onload = function() {
                alert('Logo loaded successfully! Size: ' + testImg.width + 'x' + testImg.height);
                testImg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-width: 300px; max-height: 200px; z-index: 99999;';
                document.body.appendChild(testImg);
            };
            testImg.onerror = function() {
                alert('ERROR: Logo failed to load as image.');
            };
            testImg.src = logoData;
        } else {
            alert('No logo found in localStorage');
        }
    };
    
    // Update logo input handler to show debug button
    const logoInput = document.getElementById('logo-image');
    if (logoInput) {
        logoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        // Store as global variable
                        window.debugLogoData = e.target.result;
                        
                        // Store in localStorage
                        localStorage.setItem('currentLogoBase64', e.target.result);
                        
                        // Show debug button
                        debugButton.style.display = 'block';
                        
                        console.log('Logo stored successfully, debug button enabled');
                    } catch (error) {
                        console.error('Logo storage error:', error);
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Completely replace startLiveDisplay with a version that embeds the logo in HTML
    window.startLiveDisplay = function() {
        console.log('*** STARTING FINAL VERSION WITH EMBEDDED LOGO ***');
        
        // Hide customization
        document.getElementById('customization-container').style.display = 'none';
        
        // Get logo directly from both sources
        const logoData = window.debugLogoData || localStorage.getItem('currentLogoBase64');
        console.log('Logo status for display:', !!logoData);
        
        // Prepare logo HTML - embed directly if available
        const logoHTML = logoData ? 
            `<div style="position: absolute; top: 20px; right: 20px; z-index: 9999;">
                <img src="${logoData}" style="max-width: 250px; max-height: 120px; display: block;">
             </div>` : '';
        
        // Create a completely fresh overlay with logo embedded directly in HTML
        const overlayHTML = `
            <div id="master-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: black;
                background-image: url('${window.currentBackgroundImage || ''}');
                background-size: cover;
                background-position: center;
                z-index: 99999;
            ">
                <!-- Race title -->
                <div style="
                    position: absolute;
                    top: 20px;
                    left: 0;
                    width: 100%;
                    text-align: center;
                    color: white;
                    font-size: 32px;
                    text-shadow: 2px 2px 4px black;
                ">
                    ${document.getElementById('preview-race-name').textContent || '5K Run/Walk'}
                </div>
                
                <!-- Logo directly embedded in HTML -->
                ${logoHTML}
                
                <!-- Runner information -->
                <div id="runner-container" style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90%;
                    max-width: 1200px;
                    padding: 40px;
                    background-color: rgba(0,0,0,0.7);
                    border-radius: 15px;
                    text-align: center;
                ">
                    <h1 id="runner-display-name" style="
                        font-size: 130px;
                        font-weight: bold;
                        color: white;
                        margin: 0 0 30px 0;
                        text-shadow: 3px 3px 10px black;
                    ">Loading Runner...</h1>
                    
                    <h2 id="runner-display-city" style="
                        font-size: 72px;
                        color: white;
                        margin: 0 0 30px 0;
                        text-shadow: 2px 2px 8px black;
                    "></h2>
                    
                    <p id="runner-display-message" style="
                        font-size: 60px;
                        color: white;
                        text-shadow: 2px 2px 8px black;
                        font-weight: bold;
                        margin: 0;
                    "></p>
                </div>
                
                <!-- Exit button -->
                <button id="exit-display-button" style="
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    padding: 8px 15px;
                    background: rgba(0,0,0,0.5);
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    z-index: 999999;
                ">Exit</button>
            </div>
        `;
        
        // Insert the complete HTML
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        
        // Setup exit button
        document.getElementById('exit-display-button').addEventListener('click', function() {
            if (document.fullscreenElement) {
                document.exitFullscreen().then(() => {
                    document.getElementById('master-overlay').remove();
                    document.getElementById('customization-container').style.display = 'block';
                });
            } else {
                document.getElementById('master-overlay').remove();
                document.getElementById('customization-container').style.display = 'block';
            }
        });
        
        // Setup event source for runner updates
        setupFinalEventSource();
        
        // Go fullscreen
        const overlay = document.getElementById('master-overlay');
        if (overlay.requestFullscreen) {
            overlay.requestFullscreen();
        } else if (overlay.webkitRequestFullscreen) {
            overlay.webkitRequestFullscreen();
        }
    };
    
    // Final event source implementation
    function setupFinalEventSource() {
        if (window.eventSource) {
            window.eventSource.close();
        }
        
        window.eventSource = new EventSource('/stream');
        
        window.eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (!data.keepalive) {
                    const nameElement = document.getElementById('runner-display-name');
                    const cityElement = document.getElementById('runner-display-city');
                    const messageElement = document.getElementById('runner-display-message');
                    
                    if (nameElement && cityElement && messageElement) {
                        // Animate transition
                        const container = document.getElementById('runner-container');
                        container.style.opacity = '0';
                        container.style.transition = 'opacity 0.3s ease';
                        
                        setTimeout(() => {
                            nameElement.textContent = data.name || '';
                            cityElement.textContent = data.city || '';
                            messageElement.textContent = data.message || getRandomMessage();
                            
                            container.style.opacity = '1';
                        }, 300);
                    }
                }
            } catch (e) {
                console.error('Error handling event:', e);
            }
        };
    }
});

// FINAL FIX: Create a super visible troubleshooter button on the customization page
document.addEventListener('DOMContentLoaded', function() {
    // Add a visible debug button to the customization page
    const debugButtonContainer = document.createElement('div');
    debugButtonContainer.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 99999;
        padding: 10px;
        background-color: rgba(255,0,0,0.2);
        border: 2px solid red;
        border-radius: 5px;
    `;
    
    const debugButton = document.createElement('button');
    debugButton.id = 'logo-troubleshooter';
    debugButton.textContent = 'LOGO TROUBLESHOOTER';
    debugButton.className = 'btn btn-danger';
    debugButton.style.cssText = 'font-weight: bold;';
    
    debugButtonContainer.appendChild(debugButton);
    
    // Add to document after a delay to ensure other elements are loaded
    setTimeout(() => {
        const customizationContainer = document.getElementById('customization-container');
        if (customizationContainer) {
            customizationContainer.appendChild(debugButtonContainer);
        }
    }, 1000);
    
    // Enhanced debug function with detailed diagnostics
    debugButton.onclick = function() {
        const diagDiv = document.createElement('div');
        diagDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80%;
            height: 80%;
            background: white;
            border: 3px solid black;
            padding: 20px;
            overflow: auto;
            z-index: 999999;
            font-family: monospace;
        `;
        
        // Start with basic info
        diagDiv.innerHTML = '<h2>LOGO DIAGNOSTICS</h2>';
        
        // Check for logo in different storage mechanisms
        const localStorageLogo = localStorage.getItem('currentLogoBase64');
        const windowLogo = window.currentLogoImage || window.debugLogoData;
        
        diagDiv.innerHTML += `<p>Logo in localStorage: <strong>${!!localStorageLogo}</strong></p>`;
        diagDiv.innerHTML += `<p>Logo in window variables: <strong>${!!windowLogo}</strong></p>`;
        
        // Add logo preview if found in either location
        const logoData = localStorageLogo || windowLogo;
        if (logoData) {
            diagDiv.innerHTML += '<h3>LOGO PREVIEW</h3>';
            diagDiv.innerHTML += `<img src="${logoData}" style="max-width: 300px; border: 1px solid black; background: #eee;" alt="Logo Preview"><br>`;
            diagDiv.innerHTML += '<small>If you see the logo above, it CAN be displayed in the browser</small>';
            
            // Add fix button
            diagDiv.innerHTML += `
                <div style="margin-top: 20px; padding: 10px; background: #ffe; border: 1px solid #aa0;">
                    <h3>MANUAL FIX</h3>
                    <p>If the logo doesn't show in the display but appears here, try this manual fix:</p>
                    <button id="force-logo-fix" class="btn btn-warning">APPLY MANUAL FIX</button>
                </div>
            `;
        } else {
            diagDiv.innerHTML += '<h3>NO LOGO FOUND</h3><p>Please upload a logo first using the logo uploader.</p>';
        }
        
        // Add close button
        diagDiv.innerHTML += `<button id="close-diag" style="position: absolute; top: 10px; right: 10px;" class="btn btn-secondary">Close</button>`;
        
        // Add to document
        document.body.appendChild(diagDiv);
        
        // Setup close button
        document.getElementById('close-diag').addEventListener('click', function() {
            diagDiv.remove();
        });
        
        // Setup fix button
        if (logoData) {
            document.getElementById('force-logo-fix').addEventListener('click', function() {
                // Store logo in multiple places
                try {
                    localStorage.setItem('logoFixApplied', 'true');
                    localStorage.setItem('manualLogoData', logoData);
                    
                    // Create global function to force show logo
                    window.forceShowLogo = function() {
                        const logoContainer = document.createElement('div');
                        logoContainer.style.cssText = `
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            z-index: 9999999;
                            pointer-events: none;
                        `;
                        
                        const logoImg = document.createElement('img');
                        logoImg.src = localStorage.getItem('manualLogoData');
                        logoImg.style.cssText = `
                            max-width: 250px;
                            max-height: 120px;
                            display: block;
                        `;
                        
                        logoContainer.appendChild(logoImg);
                        document.body.appendChild(logoContainer);
                        
                        alert('Manual logo fix applied! The logo will appear when you start the display.');
                    };
                    
                    // Force show logo function
                    const oldStartLiveDisplay = window.startLiveDisplay;
                    window.startLiveDisplay = function() {
                        oldStartLiveDisplay.apply(this, arguments);
                        
                        // Apply logo fix after a delay
                        setTimeout(() => {
                            if (localStorage.getItem('logoFixApplied') === 'true') {
                                window.forceShowLogo();
                            }
                        }, 1000);
                    };
                    
                    alert('Manual fix prepared! Logo should now appear when you start the display.');
                    diagDiv.remove();
                } catch (error) {
                    alert('Error applying fix: ' + error.message);
                }
            });
        }
    };
});

// HARDCODED LOGO FIX - This uses a built-in sample logo that doesn't rely on uploads
document.addEventListener('DOMContentLoaded', function() {
    // Add a super visible button that uses a hardcoded logo
    const hardcodeButton = document.createElement('button');
    hardcodeButton.textContent = 'USE SAMPLE LOGO';
    hardcodeButton.style.cssText = `
        position: fixed;
        top: 200px;
        left: 100px;
        background-color: blue;
        color: white;
        padding: 15px;
        font-size: 24px;
        font-weight: bold;
        border: 5px solid white;
        border-radius: 10px;
        z-index: 9999999;
        cursor: pointer;
    `;
    
    document.body.appendChild(hardcodeButton);
    
    // When clicked, use a simple sample logo
    hardcodeButton.onclick = function() {
        // Sample logo - a simple red square with text (tiny base64 image)
        const sampleLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAADBZJREFUeJzt3X+sX/Vdx/HnuZ/vvffbe8v9QX9BvVuFsrZwJyvdbYCRlS5Zjhg3cGM4ttCCYzPnpMmS/Yc/4ubiU+ecrSYbjrIlDk2ZbjNxGDIHdRCNtJsihbhQ6Sg0TaHQdu+99/v9nrM/2lH9wff7vd/vOR/O95z3I2nS2H6/n/fJ+77v8/18Pp/POQYhhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCFEKVncBQhwKXA1sBKYAaYBA7qAF74+B3QO+ffngGeBY8AJ4GngVFRFi1KaA7wbpbSHgf9GqezgiK89wNeAW4CrgYnI/1pxEmqPwx8DfwW8CKQRJcdQrz7wLPAA8F5gKuL/UjTmAn8C/BeQk0wyrPY6DXwFuBmYjfZ/F8iVwD8Aq6JOhjGsBfak1O8W4Oa4SxLDuAS4D/gRUEskFcZ5nQB+E1gSd4liEEPcAjxFuckwzu8U8Engunh/BDGMM3wA2E96g+5hX08AH0bvpxIzEaXGk6STDENcjwG/HutPJc7mWpQaZ6JOhgleN8b6k4lXm4/SYlXUyTDB6wTwMTSDFb05wAfRUolxXg8SNzZJmwQeRCkxzuthYuIfgfPQw+ND6FHvOK/vAb8K9KMulIDXAf+KUmKc17dQSkQezZ+j1Bjn9Q/obcNILQZ+iFJjnNdDwHzqP1sIEVOABzg7NY4Cr1d6FNMc1IZXS6gZxrVeD1N/xkAM4TYqGcYNXg8As1Q/jBvS/nqqH8YNad8H3ED9K5cjEcNbdqrfYYqd4nkD8PM1uHc/0h9VDJO8FwOXVb14Zx/4LPoOt5FZYJ9E/UJjnNcx4E3UOyhV0gBwIiXGOK8ean4stZno/UJjnFcP7bYdynq0x9oYv/ooeYZ2GZUa47yeBmapPu2YUbGx4dVB+82HchVKjXFej1F9Lb3Cwms1lfx9AEXHJpQa47y+hdYvZ5TsHYfXCTSgjOJGlBrjvO5BXcGvYmzJQ/o+Wo0ZxZUoNcZ5fZ3q5x1akp+V+GFcexNKjXFeX0NdbJKf9JC+ixZeRrESpca4KO8W9YYZiHHG4PUoGqBG8SaUGuO87qbe1tMGyU94SH+LBqlRLEepMcrvU3/+ZFBOekj/hAarkZjFXYPRQF3JwXqoq1RFGWV9lPKkh/QltDO0Dt4OvDeie1XheeDZBL57H1gN/HsC966FL1P/uKUq9dBn+UZJjQGwCBU4V+F+9P6hEpeg1CiRtxsRKNfjk2m0uaiMt+MHLVVrAF2FmIk7g0IcTvlL+EPAPyXw3Qeo3GFcPPqJXDk/6CH9JCp0roJqyAqxkxKXxsvoEH1G3WspPIOW+UvzLZQaZfJuRc2PZXzGQ/pHKDXK5H0gklAUqFg7lG1ePzH3fxLtsSqRNxPZryiwm5Lrykdxvc9h0UO6Ea33lJl78pAeRHWIlXgXJc+KD3qIdwC3VflQCXg/1e+eLfP6WkS/S4ECb6hPYR7SQK+VDKbGQAKpMejjlFwCN8/hC5j7k0GpMTCX2uexwM0UGFQHpx5c7k8Cpcbg3JtF9P8WOOi7PaRrqHYbgjKpMbDBYpk/tcBB/7GH9G1U0V6FMqkx8E5R8u6T1HiQF5ejJfmyeTejztcq3ELJgTe11LgLbfatgodUZhbDFwk/iZ8YjpJj6i4P6TpU/FnlXn9vK5u3mvLLOnzSQ7oYFYau9ZDKpi1OdxBaanwY1b3XwTOUOFM+MDS+AJV37fKQtlI+bU3kM8aSNqKmx7oYXIKz1EM6hmY4qvJGyqXGeeDT0YeiGKV1hn49KgAts8uzTGrMge8D18cQi0LU1p16BXrX1VEP6RLKpcYc+Dz1H7NbWm0dqrdhVp7J8JDmKZcaM+AJqp9GTo1Zi4d0HOXGKrgWpUbZvDXRBqJ4tfeoTqCTe6r4c0mlxgz4S7RlLUlW8Oc+B/x+vKEoTi09qh249oNnHtLbKJcaMzQNu4LwuWJWdY/qEHBTzIEYVu0H+w94SGcplxr7wH9Q7QHZKbLKO1RPAb8Vdxga42KP6m4PaQnlUmMXPecVKZ+0GourelQ7gHfFHYSmedij+j4wd/9PfCHFz1hJZTvGw/W+ugcYnKcWnRb2qDrAB5UXX6qvcY9qDXhrrpwXJaxRj+oQ8M7cubY5Kg0qKW3cozoOvCdXzotALN7EJ+GsInGP6kmKHVcUnRYN6j/PldMiQi1IjX8CvC13LorINaRH1QNeB9ycK+dFDFqQGp8A3pcr50VMGpAaH0epcSuunBcxijw15sBVuXJexCzi1Hgi0lj0r5Erp0UKIkyN84GPOOeiiEmkqXE9z1JjH3gYeH3unBapiCw1LgF+xzkXRUwiSo2dvDDjkwFPAb+QK6dFaiJKjZ/JC9u8cuBrwMW5c1qkJJLUOB/45NlxUcQkktS48dw4rT0BqYsgNQ6AX+PcOaEdASmLIDXeeq44/S/m9bkCUhZBatx7vjgobVIX8+A+Dzh43jgobVJXYGCfp9p3jQ8Ab8idi2VYBSxPRG7K63zPdFZTfco7APzSIJQWabq0QJ5TcRfQAbYPOmiRpkUF8poVd/3AT8s81wZtCkhPkQ5VL/D57+bLu/7gfwx1GxosCrK62H5nCbwAOD5snOZFjGNJbHB/+6j/1kQRxbBiE9z3jRoCDQzFOIJPcN81apg04BWjGEXQwe378bhpSoN1MargA9t3SsRKA14xiuAD23+Xjdde9IMKUYbZ8HHVO1vkmzXgFaOIotP0M+NeRQO+GEXQgW3PSO+gDRbiXKIfI1uQGltO4LgK0YQxsjbMiLsWpS0xhqgHyRYlYS3vEGesLxon6/YYQ9Tj5PniobIWJcmWJck6/jzGEE1IkmUVj5W1aUm69fxNjCGqkCg7Jb5jXrQ0SdbtBojzpCJZdsrdTa51y7Ot49/iDE+FhNkz7u7kXrREWbef4hxmiXLCrGnP4ZojWaLs6YBdZULtG6XrF23Tkm3Lk3UT4VxLmqzr1msfG9C6ZNvy5Of48xhDU2PirOnPBbRwmbplyfr+LzGGpMbB/bG50qHVXawWJuvbCeGcQh/cb52IK6+tqb+2JOvWsKss2fXpv8Yjx2wgS9Z1d8QYghqTNcij9zQpHg/UyjqRJuvOS/H6OMQwSd2PK7OtWX9Jss4Kc68PQ21J2o8r23pAYdKtCe8iP5WVNOE9qhevj22dHU08NaaQrBevj637SJrwPrJTr50Vrzv1wT31gf1Ur5/9ekEa9r76qV/viQbeyC31AT6F67/BsCa+KEmhKD+N6z3QwBu6Uh/oU7j+BTOa+qI9hav3Ig2ttUh9wG/69ctGNPV1h7NNvfr9Nw+9QCMG/qZef4N5TX3dYuC55mt0LvS5oxgYmn6N6i2+6hUDRdOvUR2gxHF7MXA0/Rql/FedxcDR9GskxwHKDwADR9OvUfwRGlDLPHRsHE2+enCQ19KAXPahZBNp8vWIc+OvuhgomnyN4DtWxSAx6NLkq4RjwJWu/GgGqaGrydd5DABv9eX3GIyYMQ1eF/A1q2IQGnpp8PWKPvAh13+LwYkZ1eDVQ6fsVMEYrIZh8PoKMCME02TZ4PVneMdKDGZDN3j9F7DCG89iUBuGwWs3cJEb36XDYNXE1LgfuN6NV9NhEGtSahwA7/GNUxYYtJqUGjOK9yc2yiDWwNR4K/7ZqsVg1qDU+BfAJN94pMFg1oDU+M9oGjcaaa6/DvP6a2Baqp+xmgHrcwG/p3DjOg58EJjgQYpb0yoxjutp4C5gpgcppdYQ5jLTDHgIeDcw24OUSqP1wJmIk2GU16PA+4FFHqSUGz7JMg/5WgfuBa72IKXe+Ag9lCCjtjrAV1Bnau08SG1hlqP3KqldjwM7gNd6kNrGXIl2qqZ0nQA+Cyz3IBWRSWSfBDaiqd9YrgHwGPAF4FfQNHTRTHpvmswFbkQt/r8AXAX8DDAHmIW6auvQA7rAQ8AzwGHgCPAk8EP0aUeYCPz/53V7yZZDRocAAAAASUVORK5CYII=';
        
        // 1. Store in local storage for backup retrieval
        localStorage.setItem('hardcodedLogo', sampleLogoBase64);
        
        // 2. Override the startLiveDisplay function to ensure logo appears
        window.originalStartLiveDisplay = window.startLiveDisplay; 
        window.startLiveDisplay = function() {
            // Call original function
            if(window.originalStartLiveDisplay) {
                window.originalStartLiveDisplay.apply(this, arguments);
            }
            
            // After a short delay, force our logo to appear
            setTimeout(function() {
                console.log('Adding hardcoded logo to display');
                
                // Create a logo element with extreme z-index
                const logoElement = document.createElement('img');
                logoElement.src = sampleLogoBase64;
                logoElement.style.cssText = 'position: fixed; top: 20px; right: 20px; max-width: 200px; max-height: 100px; z-index: 9999999; pointer-events: none;';
                
                // Add directly to body
                document.body.appendChild(logoElement);
                
                alert('Sample logo has been added to the display!');
            }, 1000);
        };
        
        alert('Sample logo activated! You will now see a red logo box when you start the display.');
    });
});

// Fix unclosed function at the end of the file
(function() {
    // Your emergency fix code here
    console.log('Fixing any unclosed statements at the end of the file');
    
    // Make sure all event listeners are properly closed
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM fully loaded - initializing event handlers');
        
        // Set up the display button directly
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', function(event) {
                event.preventDefault();
                console.log('Start button clicked - calling startDisplay()');
                startDisplay();
            });
        }
        
        // Set up test connection button
        const testButton = document.getElementById('testConnectionButton');
        if (testButton) {
            testButton.addEventListener('click', function(event) {
                event.preventDefault();
                console.log('Test button clicked - calling testConnection()');
                testConnection();
            });
        }
    });
})();