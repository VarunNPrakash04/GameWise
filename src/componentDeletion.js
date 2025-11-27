// src/componentDeletion.js
// Handles right-click deletion for components (wires, breadboard, button, LED)

let deleteButton = null;
let changeColorButton = null;
let currentTarget = null;
let currentType = null;
let hideOnClickListener = null;

// Create the delete button (reusable for all component types)
export function ensureDeleteButton() {
    if (deleteButton) return deleteButton;

    const btn = document.createElement('button');
    btn.id = 'deleteComponentBtn';
    btn.textContent = 'Delete';
    Object.assign(btn.style, {
        position: 'fixed',
        zIndex: '100000',
        display: 'none',
        padding: '8px 12px',
        background: '#c62828',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        fontWeight: '600'
    });
    document.body.appendChild(btn);

    btn.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
    });

    deleteButton = btn;
    return btn;
}

// Create the change color button (for LEDs only)
export function ensureChangeColorButton() {
    if (changeColorButton) return changeColorButton;

    const btn = document.createElement('button');
    btn.id = 'changeColorBtn';
    btn.textContent = 'Change Color';
    Object.assign(btn.style, {
        position: 'fixed',
        zIndex: '100000',
        display: 'none',
        padding: '8px 12px',
        background: '#1976d2',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        fontWeight: '600',
        marginTop: '40px' // Position below delete button
    });
    document.body.appendChild(btn);

    btn.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
    });

    changeColorButton = btn;
    return btn;
}

// Show delete button at mouse position
export function showDeleteMenu(event, target, type, deleteCallback) {
    const deleteBtn = ensureDeleteButton();

    // Update button text based on type
    deleteBtn.textContent = `Delete ${type}`;

    // Position at mouse cursor
    deleteBtn.style.left = (event.clientX + 4) + 'px';
    deleteBtn.style.top = (event.clientY + 4) + 'px';
    deleteBtn.style.display = 'block';

    // Store current target
    currentTarget = target;
    currentType = type;

    // Show change color button ONLY for LED
    if (type === 'LED') {
        const colorBtn = ensureChangeColorButton();
        colorBtn.style.left = (event.clientX + 4) + 'px';
        colorBtn.style.top = (event.clientY + 44) + 'px'; // 40px below delete button
        colorBtn.style.display = 'block';

        // Clone to remove old listeners
        const newColorBtn = colorBtn.cloneNode(true);
        colorBtn.parentNode.replaceChild(newColorBtn, colorBtn);
        changeColorButton = newColorBtn;

        newColorBtn.addEventListener('pointerdown', (ev) => {
            ev.stopPropagation();
        });

        newColorBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            showColorPicker(event.clientX + 4, event.clientY + 84, target);
        });
    }

    // Remove ALL old event listeners by cloning
    const newBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newBtn, deleteBtn);
    deleteButton = newBtn;

    // Re-add pointerdown prevention
    newBtn.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
    });

    // Add new click handler
    newBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        console.log('Delete button clicked for:', type, currentTarget);
        if (currentTarget && deleteCallback) {
            deleteCallback(currentTarget);
        }
        hideDeleteMenu();
    });

    // Prevent native context menu
    event.preventDefault();
    event.stopPropagation();

    // Remove old click listeners if they exist
    if (hideOnClickListener) {
        document.removeEventListener('click', hideOnClickListener);
        document.removeEventListener('contextmenu', hideOnClickListener);
    }

    // Create new listener function
    hideOnClickListener = (e) => {
        // Don't hide if clicking the buttons
        if (e.target === newBtn || newBtn.contains(e.target) ||
            (changeColorButton && (e.target === changeColorButton || changeColorButton.contains(e.target)))) {
            return;
        }

        hideDeleteMenu();
    };

    // Add listeners with a small delay to prevent immediate hiding
    setTimeout(() => {
        document.addEventListener('click', hideOnClickListener);
        document.addEventListener('contextmenu', hideOnClickListener);
    }, 100);
}

// Show color picker menu
function showColorPicker(x, y, ledComponent) {
    // Create color picker menu
    const colorMenu = document.createElement('div');
    colorMenu.id = 'ledColorPickerMenu';
    Object.assign(colorMenu.style, {
        position: 'fixed',
        left: x + 'px',
        top: y + 'px',
        zIndex: '100001',
        background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
        border: '2px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    });

    const colors = [
        { name: 'Red', value: 0xcc0000, hex: '#cc0000' },
        { name: 'Green', value: 0x00cc00, hex: '#00cc00' },
        { name: 'Blue', value: 0x0000cc, hex: '#0000cc' }
    ];

    colors.forEach(color => {
        const option = document.createElement('button');
        option.textContent = color.name;
        Object.assign(option.style, {
            padding: '8px 16px',
            background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01))',
            color: '#e8eefc',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        // Add color indicator
        const indicator = document.createElement('span');
        Object.assign(indicator.style, {
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: color.hex,
            boxShadow: `0 0 10px ${color.hex}`
        });
        option.insertBefore(indicator, option.firstChild);

        option.addEventListener('mouseenter', () => {
            option.style.background = 'linear-gradient(90deg, rgba(100, 120, 255, 0.12), rgba(50, 60, 220, 0.08))';
            option.style.transform = 'translateX(2px)';
        });

        option.addEventListener('mouseleave', () => {
            option.style.background = 'linear-gradient(90deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01))';
            option.style.transform = 'translateX(0)';
        });

        option.addEventListener('click', (e) => {
            e.stopPropagation();
            window.selectedLEDColor = color.value;
            console.log('✅ LED color changed to:', color.name);

            // Update LED immediately if it's glowing
            if (ledComponent && window.simulator && window.simulator.isRunning) {
                window.simulator.setLEDGlow(null, true, 255, ledComponent);
            }

            document.body.removeChild(colorMenu);
            hideDeleteMenu();
        });

        colorMenu.appendChild(option);
    });

    document.body.appendChild(colorMenu);

    // Close color picker when clicking outside
    setTimeout(() => {
        const closeColorPicker = (e) => {
            if (!colorMenu.contains(e.target)) {
                if (document.body.contains(colorMenu)) {
                    document.body.removeChild(colorMenu);
                }
                document.removeEventListener('click', closeColorPicker);
            }
        };
        document.addEventListener('click', closeColorPicker);
    }, 100);
}

// Hide the delete button
export function hideDeleteMenu() {
    if (deleteButton) {
        deleteButton.style.display = 'none';
    }
    if (changeColorButton) {
        changeColorButton.style.display = 'none';
    }
    currentTarget = null;
    currentType = null;

    // Remove event listeners
    if (hideOnClickListener) {
        document.removeEventListener('click', hideOnClickListener);
        document.removeEventListener('contextmenu', hideOnClickListener);
        hideOnClickListener = null;
    }
}