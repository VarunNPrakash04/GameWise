/**
 * Arduino IDE Module
 * Creates a slidable code editor panel on the right side of the screen
 */

import { verifyArduinoCode } from './arduinoVerifier.js';
import { CircuitSimulator } from './simulator.js';

let idePanel = null;
let editorInstance = null;
let isIDEOpen = false;
let wireConnectionsRef = null;
let componentsRef = null;
let simulator = null;
let wiresRef = null;
let sceneRef = null;
let isCodeVerified = false; // Track if code passed verification

/**
 * Initialize the Arduino IDE panel
 */
export function initArduinoIDE(wireConnections, components, wires, scene) {
    console.log('🔍 Initializing IDE with:', {
        componentsCount: components.length,
        wiresCount: wireConnections.length
    });
    wireConnectionsRef = wireConnections;
    componentsRef = components;
    wiresRef = wires;
    sceneRef = scene;
    simulator = new CircuitSimulator(scene, components, wireConnections);
    window.simulator = simulator; // Expose globally
    // Create the IDE panel container
    idePanel = document.createElement('div');
    idePanel.id = 'arduino-ide-panel';
    idePanel.className = 'arduino-ide-panel';

    // Create horizontal resize handle for the panel
    const panelResizeHandle = document.createElement('div');
    panelResizeHandle.className = 'panel-resize-handle';
    idePanel.appendChild(panelResizeHandle);

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

    // Create terminal container
    const terminalContainer = document.createElement('div');
    terminalContainer.id = 'arduino-terminal';
    terminalContainer.className = 'arduino-terminal';
    terminalContainer.innerHTML = `
        <div class="terminal-resize-handle"></div>
        <div class="terminal-header">
            <span class="terminal-title">● Serial Monitor</span>
            <button id="terminal-clear-btn" class="terminal-clear-btn">Clear</button>
        </div>
        <div id="terminal-output" class="terminal-output">
            <div class="terminal-line terminal-info">GameWise Arduino Simulator v1.0</div>
            <div class="terminal-line terminal-info">Ready to verify code...</div>
        </div>
    `;

    // Create footer with buttons
    const footer = document.createElement('div');
    footer.className = 'ide-footer';
    footer.innerHTML = `
        <button id="ide-verify-btn" class="ide-btn">✓ Verify</button>
        <button id="ide-upload-btn" class="ide-btn">↑ Upload</button>
        <button id="ide-clear-btn" class="ide-btn">Clear Code</button>
    `;

    idePanel.appendChild(header);
    idePanel.appendChild(editorContainer);
    idePanel.appendChild(terminalContainer);
    idePanel.appendChild(footer);
    document.body.appendChild(idePanel);

    // Initialize Monaco Editor
    initMonacoEditor();

    // Setup event listeners
    setupEventListeners();

    // Setup terminal resize
    setupTerminalResize();

    // Setup panel resize
    setupPanelResize();

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
    // Terminal clear button
    document.getElementById('terminal-clear-btn').addEventListener('click', () => {
        clearTerminal();
    });

    // Verify button
    document.getElementById('ide-verify-btn').addEventListener('click', async () => {
        clearTerminal();
        addTerminalLine('Verifying code...', 'info');
        isCodeVerified = false; // Reset verification status

        if (!editorInstance) {
            addTerminalLine('ERROR: Editor not initialized', 'error');
            return;
        }

        // Get code from editor
        const code = editorInstance.getValue();

        // Show compiling message
        addTerminalLine('Compiling sketch...', 'info');

        try {
            // Call backend verification
            const result = await simulator.verify(code);

            if (!result.syntaxValid) {
                addTerminalLine('❌ Compilation failed!', 'error');
                addTerminalLine('', 'info');
                result.syntaxErrors.forEach(err => {
                    addTerminalLine(`  ${err}`, 'error');
                });
                return;
            }

            addTerminalLine('✅ Compilation successful!', 'success');
            isCodeVerified = true; // Mark as verified

            if (!result.circuitValid) {
                addTerminalLine('', 'info');
                addTerminalLine('⚠️ Circuit Issues:', 'warning');
                result.circuitIssues.forEach(issue => {
                    addTerminalLine(`  ${issue}`, 'warning');
                });
            } else {
                addTerminalLine('✅ Circuit connections valid!', 'success');
            }

            addTerminalLine('', 'info');
            addTerminalLine(result.message || 'Ready to upload!', 'info');

        } catch (error) {
            addTerminalLine('❌ Verification failed!', 'error');
            addTerminalLine(`Error: ${error.message}`, 'error');
            addTerminalLine('', 'info');
            addTerminalLine('Make sure the backend server is running:', 'warning');
            addTerminalLine('  npm run server', 'info');
        }
    });

    // Upload button
    document.getElementById('ide-upload-btn').addEventListener('click', async () => {
        // Check if code has been verified
        if (!isCodeVerified) {
            addTerminalLine('⚠️ Please verify code first before uploading!', 'warning');
            return;
        }

        clearTerminal();
        addTerminalLine('Uploading to board...', 'info');

        try {
            // Get code again
            const code = editorInstance.getValue();

            // Re-verify to get simulation data
            const result = await simulator.verify(code);

            if (!result.syntaxValid) {
                addTerminalLine('❌ Upload failed - code has errors!', 'error');
                isCodeVerified = false;
                return;
            }

            addTerminalLine('✅ Upload complete!', 'success');
            addTerminalLine('🎮 Simulation started!', 'success');

            // Start simulation
            simulator.startSimulation(result.componentStates);

        } catch (error) {
            addTerminalLine('❌ Upload failed!', 'error');
            addTerminalLine(`Error: ${error.message}`, 'error');
        }
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

    // Reset toggle button position
    const toggleBtn = document.getElementById('ide-toggle-btn');
    if (toggleBtn) {
        toggleBtn.style.right = ''; // Clear inline style
    }

    // Reset panel width to default
    idePanel.style.width = '450px';

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

/**
 * Add a line to the terminal output
 * @param {string} text - Text to display
 * @param {string} type - Type of message: 'info', 'success', 'error', 'warning'
 */
function addTerminalLine(text, type = 'info') {
    const terminalOutput = document.getElementById('terminal-output');
    if (!terminalOutput) return;

    const line = document.createElement('div');
    line.className = `terminal-line terminal-${type}`;
    line.textContent = text;
    terminalOutput.appendChild(line);

    // Auto-scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

/**
 * Clear terminal output
 */
function clearTerminal() {
    const terminalOutput = document.getElementById('terminal-output');
    if (!terminalOutput) return;

    terminalOutput.innerHTML = '';
    addTerminalLine('Terminal cleared', 'info');
}

/**
 * Setup terminal resize functionality
 */
function setupTerminalResize() {
    const resizeHandle = document.querySelector('.terminal-resize-handle');
    const terminal = document.getElementById('arduino-terminal');
    const editor = document.getElementById('arduino-editor');

    if (!resizeHandle || !terminal || !editor) return;

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = terminal.offsetHeight;

        // Add resizing class for visual feedback
        resizeHandle.classList.add('resizing');
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaY = startY - e.clientY; // Inverted because we're dragging up
        const newHeight = Math.max(100, Math.min(600, startHeight + deltaY));

        terminal.style.height = `${newHeight}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizeHandle.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

/**
 * Setup panel horizontal resize functionality
 */
function setupPanelResize() {
    const resizeHandle = document.querySelector('.panel-resize-handle');
    const panel = document.getElementById('arduino-ide-panel');
    const toggleBtn = document.getElementById('ide-toggle-btn');

    if (!resizeHandle || !panel) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;

        // Add resizing class for visual feedback
        resizeHandle.classList.add('resizing');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = startX - e.clientX; // Inverted because we're dragging left
        const newWidth = Math.max(350, Math.min(800, startWidth + deltaX));

        panel.style.width = `${newWidth}px`;

        // Update toggle button position if panel is open
        if (panel.classList.contains('open') && toggleBtn) {
            toggleBtn.style.right = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizeHandle.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}


/**
 * Get the editor instance for saving/loading
 */
export function getEditorInstance() {
    return editorInstance;
}