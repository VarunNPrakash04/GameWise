/**
 * Menu Bar Module
 * Professional menu system with File, Edit, Selection, View
 */

export function initMenuBar(saveCallback, loadCallback, clearCallback) {
    const menuBar = document.createElement('div');
    menuBar.className = 'menu-bar';
    menuBar.innerHTML = `
        <div class="menu-items">
            <div class="menu-item" data-menu="file">
                <span>File</span>
                <div class="dropdown-menu" id="file-menu">
                    <div class="menu-option" data-action="new">
                        <span>New Project</span>
                        <span class="shortcut">Ctrl+N</span>
                    </div>
                    <div class="menu-divider"></div>
                    <div class="menu-option" data-action="save">
                        <span>Save Project</span>
                        <span class="shortcut">Ctrl+S</span>
                    </div>
                    <div class="menu-option" data-action="save-as">
                        <span>Save Project As...</span>
                        <span class="shortcut">Ctrl+Shift+S</span>
                    </div>
                    <div class="menu-divider"></div>
                    <div class="menu-option" data-action="open">
                        <span>Open Project...</span>
                        <span class="shortcut">Ctrl+O</span>
                    </div>
                    <div class="menu-divider"></div>
                    <div class="menu-option" data-action="export">
                        <span>Export as JSON</span>
                        <span class="shortcut">Ctrl+E</span>
                    </div>
                </div>
            </div>
            
            <div class="menu-item" data-menu="edit">
                <span>Edit</span>
                <div class="dropdown-menu" id="edit-menu">
                    <div class="menu-option" data-action="undo">
                        <span>Undo</span>
                        <span class="shortcut">Ctrl+Z</span>
                    </div>
                    <div class="menu-option" data-action="redo">
                        <span>Redo</span>
                        <span class="shortcut">Ctrl+Y</span>
                    </div>
                    <div class="menu-divider"></div>
                    <div class="menu-option" data-action="delete">
                        <span>Delete Selected</span>
                        <span class="shortcut">Delete</span>
                    </div>
                    <div class="menu-option" data-action="clear-all">
                        <span>Clear All</span>
                        <span class="shortcut">Ctrl+Shift+Del</span>
                    </div>
                </div>
            </div>
            
            <div class="menu-item" data-menu="selection">
                <span>Selection</span>
                <div class="dropdown-menu" id="selection-menu">
                    <div class="menu-option" data-action="select-all">
                        <span>Select All Components</span>
                        <span class="shortcut">Ctrl+A</span>
                    </div>
                    <div class="menu-option" data-action="deselect">
                        <span>Deselect All</span>
                        <span class="shortcut">Ctrl+D</span>
                    </div>
                    <div class="menu-divider"></div>
                    <div class="menu-option" data-action="select-wires">
                        <span>Select All Wires</span>
                    </div>
                    <div class="menu-option" data-action="select-components">
                        <span>Select All Components</span>
                    </div>
                </div>
            </div>
            
            <div class="menu-item" data-menu="view">
                <span>View</span>
                <div class="dropdown-menu" id="view-menu">
                    <div class="menu-option" data-action="reset-camera">
                        <span>Reset Camera</span>
                        <span class="shortcut">Home</span>
                    </div>
                    <div class="menu-option" data-action="focus-board">
                        <span>Focus on Board</span>
                        <span class="shortcut">F</span>
                    </div>
                    <div class="menu-divider"></div>
                    <div class="menu-option" data-action="toggle-grid">
                        <span>Toggle Grid</span>
                        <span class="shortcut">G</span>
                    </div>
                    <div class="menu-option" data-action="toggle-pins">
                        <span>Show Pin Labels</span>
                        <span class="shortcut">P</span>
                    </div>
                </div>
            </div>
            <div class="menu-item" id="shortcuts-btn">
                <span>Shortcuts</span>
            </div>
        </div>
        
        <div class="project-name" id="project-name">Untitled Project</div>
    `;

    document.body.insertBefore(menuBar, document.body.firstChild);

    // Setup menu interactions
    setupMenuInteractions(saveCallback, loadCallback, clearCallback);
    setupKeyboardShortcuts(saveCallback, loadCallback, clearCallback);
}

function setupMenuInteractions(saveCallback, loadCallback, clearCallback) {
    const menuItems = document.querySelectorAll('.menu-item');
    let activeMenu = null;

    // Toggle dropdown on click
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = item.querySelector('.dropdown-menu');

            // Close other menus
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                if (menu !== dropdown) {
                    menu.classList.remove('active');
                }
            });

            // Toggle current menu
            dropdown.classList.toggle('active');
            activeMenu = dropdown.classList.contains('active') ? dropdown : null;
        });
    });

    // Close menus when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('active');
        });
        activeMenu = null;
    });

    // Handle menu option clicks
    document.querySelectorAll('.menu-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = option.dataset.action;
            handleMenuAction(action, saveCallback, loadCallback, clearCallback);

            // Close all menus
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.remove('active');
            });
        });
    });
}

function handleMenuAction(action, saveCallback, loadCallback, clearCallback) {
    switch (action) {
        case 'new':
            if (confirm('Create a new project? Unsaved changes will be lost.')) {
                clearCallback();
                updateProjectName('Untitled Project');
            }
            break;

        case 'save':
            saveProjectToFile(saveCallback);
            break;

        case 'save-as':
            saveProjectToFile(saveCallback, true);
            break;

        case 'open':
            openProjectFromFile(loadCallback);
            break;

        case 'export':
            exportAsJSON(saveCallback);
            break;

        case 'undo':
            console.log('Undo - Not implemented yet');
            break;

        case 'redo':
            console.log('Redo - Not implemented yet');
            break;

        case 'delete':
            // Trigger delete key event
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
            break;

        case 'clear-all':
            if (confirm('Clear entire workspace? This cannot be undone.')) {
                clearCallback();
            }
            break;

        case 'select-all':
            console.log('Select All - Not implemented yet');
            break;

        case 'deselect':
            console.log('Deselect - Not implemented yet');
            break;

        case 'reset-camera':
            // Dispatch custom event for camera reset
            window.dispatchEvent(new CustomEvent('resetCamera'));
            break;

        case 'focus-board':
            window.dispatchEvent(new CustomEvent('focusBoard'));
            break;

        case 'toggle-grid':
            window.dispatchEvent(new CustomEvent('toggleGrid'));
            break;

        default:
            console.log(`Action ${action} not implemented yet`);
    }
}

function saveProjectToFile(saveCallback, saveAs = false) {
    // Get current state
    const state = saveCallback();

    // Get project name
    let filename = document.getElementById('project-name').textContent;
    if (filename === 'Untitled Project' || saveAs) {
        filename = prompt('Enter project name:', filename.replace('.gamewise', ''));
        if (!filename) return;
    } else {
        filename = filename.replace('.gamewise', '');
    }

    // Create blob
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });

    // Download file
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.gamewise`;
    a.click();

    // Update project name
    updateProjectName(`${filename}.gamewise`);

    console.log(`✅ Project saved as ${filename}.gamewise`);
}

function openProjectFromFile(loadCallback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gamewise,.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show loading overlay
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.textContent = 'Loading Project...';
            loadingOverlay.classList.remove('hidden');
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const state = JSON.parse(event.target.result);

                // Call the load callback with the state
                loadCallback(state);

                // Update project name
                updateProjectName(file.name);

                // Wait for everything to load before hiding overlay
                setTimeout(() => {
                    if (loadingOverlay) {
                        loadingOverlay.classList.add('hidden');
                        loadingOverlay.textContent = 'Adding Breadboard...'; // Reset text
                    }
                    console.log(`✅ Project loaded: ${file.name}`);
                }, 2000); // Give time for breadboard and wires to load
                // After loading file data
                // After loading file data - use setTimeout to ensure components are loaded
                setTimeout(() => {
                    console.log('🔍 Checking arrays before update:', {
                        windowComponents: window.components?.length,
                        windowWireConnections: window.wireConnections?.length,
                        simulatorComponents: window.simulator?.components?.length,
                        simulatorWires: window.simulator?.wires?.length
                    });

                    if (window.simulator && window.components && window.wireConnections) {
                        window.simulator.updateCircuitData(window.components, window.wireConnections);
                        console.log('🔄 Simulator updated after file load');
                    }
                }, 2500);

            } catch (error) {
                if (loadingOverlay) {
                    loadingOverlay.classList.add('hidden');
                }
                alert('Error loading project file: ' + error.message);
                console.error('Error loading project:', error);
            }
        };
        reader.readAsText(file);
    };

    input.click();
}
function exportAsJSON(saveCallback) {
    const state = saveCallback();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gamewise-export-${Date.now()}.json`;
    a.click();

    console.log('✅ Exported as JSON');
}

function updateProjectName(name) {
    const projectNameEl = document.getElementById('project-name');
    if (projectNameEl) {
        projectNameEl.textContent = name;
    }
}

function setupKeyboardShortcuts(saveCallback, loadCallback, clearCallback) {
    document.addEventListener('keydown', (e) => {
        // Ctrl+S - Save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveProjectToFile(saveCallback);
        }

        // Ctrl+Shift+S - Save As
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            saveProjectToFile(saveCallback, true);
        }

        // Ctrl+O - Open
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            openProjectFromFile(loadCallback);
        }

        // Ctrl+N - New
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            if (confirm('Create a new project? Unsaved changes will be lost.')) {
                clearCallback();
                updateProjectName('Untitled Project');
            }
        }

        // Ctrl+E - Export
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            exportAsJSON(saveCallback);
        }
    });
}

export function setProjectName(name) {
    updateProjectName(name);
}