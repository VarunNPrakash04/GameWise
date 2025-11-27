// src/componentMoveConfirmation.js
// Handles confirmation dialog when moving snapped LED/Button components

let confirmModal = null;
let confirmCallback = null;
let cancelCallback = null;

export function createMoveConfirmationModal() {
    if (confirmModal) return confirmModal;

    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'moveConfirmModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';

    // Create modal content
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.maxWidth = '400px';

    // Title
    const title = document.createElement('h2');
    title.id = 'moveConfirmTitle';
    title.textContent = 'Move Component?';
    title.style.marginBottom = '16px';

    // Message
    const message = document.createElement('p');
    message.id = 'moveConfirmMessage';
    message.style.marginBottom = '24px';
    message.style.color = '#e8eefc';
    message.style.fontSize = '14px';
    message.style.lineHeight = '1.6';

    // Buttons container
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'modal-buttons';
    buttonsDiv.style.display = 'flex';
    buttonsDiv.style.gap = '12px';
    buttonsDiv.style.justifyContent = 'flex-end';

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'moveConfirmYes';
    confirmBtn.className = 'modal-btn modal-btn-primary';
    confirmBtn.textContent = 'Yes, Move It';

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'moveConfirmNo';
    cancelBtn.className = 'modal-btn modal-btn-secondary';
    cancelBtn.textContent = 'Cancel';

    // Assemble
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(confirmBtn);
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(buttonsDiv);
    modal.appendChild(content);
    document.body.appendChild(modal);

    // Event listeners
    confirmBtn.addEventListener('click', () => {
        hideConfirmModal();
        if (confirmCallback) confirmCallback();
    });

    cancelBtn.addEventListener('click', () => {
        hideConfirmModal();
        if (cancelCallback) cancelCallback();
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideConfirmModal();
            if (cancelCallback) cancelCallback();
        }
    });

    confirmModal = modal;
    return modal;
}

export function showMoveConfirmation(componentType, onConfirm, onCancel) {
    const modal = createMoveConfirmationModal();
    const message = document.getElementById('moveConfirmMessage');

    // Set message based on component type
    message.innerHTML = `This <strong>${componentType}</strong> is already snapped to breadboard pins.<br>Are you sure you want to move it?<br><br><span style="color: #ff9800; font-size: 12px;">⚠️ Moving will disconnect all wires.</span>`;

    // Store callbacks
    confirmCallback = onConfirm;
    cancelCallback = onCancel;

    // Show modal
    modal.style.display = 'flex';
}

export function hideConfirmModal() {
    if (confirmModal) {
        confirmModal.style.display = 'none';
    }
    confirmCallback = null;
    cancelCallback = null;
}