// src/componentDeletion.js
// Handles right-click deletion for components (wires, breadboard, button, LED)

let deleteButton = null;
let currentTarget = null;
let currentType = null;

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

    // Prevent global pointerdown from hiding the menu
    btn.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
    });

    deleteButton = btn;
    return btn;
}

// Show delete button at mouse position
// Show delete button at mouse position
export function showDeleteMenu(event, target, type, deleteCallback) {
    const btn = ensureDeleteButton();

    // Update button text based on type
    btn.textContent = `Delete ${type}`;

    // Position at mouse cursor
    btn.style.left = (event.clientX + 4) + 'px';
    btn.style.top = (event.clientY + 4) + 'px';
    btn.style.display = 'block';

    // Store current target and callback
    currentTarget = target;
    currentType = type;

    // Remove ALL old event listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
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
}

// Hide the delete button
export function hideDeleteMenu() {
    if (deleteButton) {
        deleteButton.style.display = 'none';
    }
    currentTarget = null;
    currentType = null;
}