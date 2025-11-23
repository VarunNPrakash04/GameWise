/**
 * Arduino IDE Module
 * Creates a slidable code editor panel on the right side of the screen
 */

let idePanel = null;
let editorInstance = null;
let isIDEOpen = false;

/**
 * Initialize the Arduino IDE panel
 */
export function initArduinoIDE() {
    // Create the IDE panel container
    idePanel = document.createElement('div');
    idePanel.id = 'arduino-ide-panel';
    idePanel.className = 'arduino-ide-panel';

    // Create header
    const header = document.createElement('div');
    header.className = 'ide-header';
    header.innerHTML = `
        <h3>Arduino IDE</h3>

    `;

    // Create editor container
    const editorContainer = document.createElement('div');
    editorContainer.id = 'arduino-editor';
    editorContainer.className = 'arduino-editor';

    // Create footer with buttons
    const footer = document.createElement('div');
    footer.className = 'ide-footer';
    footer.innerHTML = `
        <button id="ide-verify-btn" class="ide-btn">Verify</button>
        <button id="ide-upload-btn" class="ide-btn">Upload</button>
        <button id="ide-clear-btn" class="ide-btn">Clear</button>
    `;

    idePanel.appendChild(header);
    idePanel.appendChild(editorContainer);
    idePanel.appendChild(footer);
    document.body.appendChild(idePanel);

    // Initialize Monaco Editor
    initMonacoEditor();

    // Setup event listeners
    setupEventListeners();

    console.log('Arduino IDE initialized');
}

/**
 * Initialize Monaco Editor with C/C++ syntax highlighting
 */
function initMonacoEditor() {
    // Load Monaco Editor from CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js';
    script.onload = () => {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            editorInstance = monaco.editor.create(document.getElementById('arduino-editor'), {
                value: getDefaultArduinoCode(),
                language: 'cpp',
                theme: 'vs-dark',
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible'
                }
            });
            console.log('Monaco Editor loaded');
        });
    };
    document.head.appendChild(script);
}

/**
 * Get default Arduino code template
 */
function getDefaultArduinoCode() {
    return `// Arduino Uno Program
// Write your code here

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  
  // Setup code here (runs once)
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  // Main code here (runs repeatedly)
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`;
}

/**
 * Setup event listeners for IDE controls
 */
function setupEventListeners() {


    // Verify button
    document.getElementById('ide-verify-btn').addEventListener('click', () => {
        console.log('Verifying code...');
        alert('Code verification is not implemented yet. This would compile the Arduino code.');
    });

    // Upload button
    document.getElementById('ide-upload-btn').addEventListener('click', () => {
        console.log('Uploading code...');
        alert('Code upload is not implemented yet. This would upload to Arduino Uno.');
    });

    // Clear button
    document.getElementById('ide-clear-btn').addEventListener('click', () => {
        if (editorInstance && confirm('Clear all code?')) {
            editorInstance.setValue(getDefaultArduinoCode());
        }
    });
}

/**
 * Open the IDE panel with smooth animation
 */
export function openIDE() {
    if (!idePanel) {
        console.error('IDE not initialized');
        return;
    }

    idePanel.classList.add('open');
    isIDEOpen = true;
    console.log('IDE opened');
}

/**
 * Close the IDE panel with smooth animation
 */
export function closeIDE() {
    if (!idePanel) return;

    idePanel.classList.remove('open');
    isIDEOpen = false;
    console.log('IDE closed');
}

/**
 * Toggle IDE panel
 */
export function toggleIDE() {
    if (isIDEOpen) {
        closeIDE();
    } else {
        openIDE();
    }
}

/**
 * Get current code from editor
 */
export function getCode() {
    return editorInstance ? editorInstance.getValue() : '';
}

/**
 * Set code in editor
 */
export function setCode(code) {
    if (editorInstance) {
        editorInstance.setValue(code);
    }
}

/**
 * Check if IDE is open
 */
export function isOpen() {
    return isIDEOpen;
}
