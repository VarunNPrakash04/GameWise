// src/ledColorDropdown.js

/**
 * LED Color Dropdown Menu Module
 * Handles the LED color selection UI (Red, Green, Blue only)
 */

export class LEDColorDropdown {
    constructor() {
        this.isVisible = false;
        this.selectedColor = { value: '0xcc0000', hex: '#cc0000', name: 'Red' };
        this.colors = [
            { value: '0xcc0000', hex: '#cc0000', name: 'Red' },
            { value: '0x00cc00', hex: '#00cc00', name: 'Green' },
            { value: '0x0000cc', hex: '#0000cc', name: 'Blue' }
        ];

        this.container = null;
        this.toggleButton = null;
        this.menu = null;
        this.changeCallback = null;

        this.init();
    }

    init() {
        this.createElements();
        this.attachEventListeners();
    }

    createElements() {
        // Create container for the LED color dropdown
        this.container = document.createElement('div');
        this.container.id = 'ledColorDropdownContainer';
        this.container.className = 'color-dropdown-container';
        this.container.style.display = 'none'; // Hidden by default
        this.container.style.marginLeft = '10px';

        // Create toggle button
        this.toggleButton = document.createElement('button');
        this.toggleButton.id = 'ledColorDropdownToggle';
        this.toggleButton.className = 'color-dropdown-toggle electric-border';
        this.toggleButton.textContent = 'LED Color';

        // Create dropdown menu
        this.menu = document.createElement('div');
        this.menu.id = 'ledColorDropdownMenu';
        this.menu.className = 'color-dropdown-menu';
        this.menu.setAttribute('aria-hidden', 'true');

        // Create color options
        this.colors.forEach((color, index) => {
            const option = document.createElement('button');
            option.className = 'color-option';
            option.dataset.value = color.value;
            option.dataset.hex = color.hex;
            option.dataset.name = color.name;
            option.dataset.idx = index;

            const indicator = document.createElement('span');
            indicator.className = 'color-indicator';
            indicator.style.backgroundColor = color.hex;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'color-name';
            nameSpan.textContent = color.name;

            option.appendChild(indicator);
            option.appendChild(nameSpan);
            this.menu.appendChild(option);
        });

        // Append elements
        this.container.appendChild(this.toggleButton);
        this.container.appendChild(this.menu);

        // Add to UI bar (next to color dropdown)
        const colorContainer = document.getElementById('colorDropdownContainer');
        if (colorContainer && colorContainer.parentNode) {
            colorContainer.parentNode.insertBefore(this.container, colorContainer.nextSibling);
        }
    }

    attachEventListeners() {
        // Toggle button click
        this.toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Color option clicks
        const options = this.menu.querySelectorAll('.color-option');
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = option.dataset.value;
                const hex = option.dataset.hex;
                const name = option.dataset.name;

                this.selectColor({ value, hex, name });
                this.close();
            });
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isVisible &&
                !this.container.contains(e.target)) {
                this.close();
            }
        });

        // Prevent clicks inside menu from closing it
        this.menu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    toggle() {
        if (this.isVisible) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (this.isVisible) return;

        this.isVisible = true;
        this.menu.classList.add('visible');
        this.menu.setAttribute('aria-hidden', 'false');

        // Animate options with stagger
        const options = Array.from(this.menu.querySelectorAll('.color-option'));
        options.forEach((option, i) => {
            option.style.opacity = '0';
            option.style.transform = 'translateY(10px) scale(0.98)';
            this.showElement(option, i * 60);
        });
    }

    close() {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.menu.classList.remove('visible');
        this.menu.setAttribute('aria-hidden', 'true');

        const options = this.menu.querySelectorAll('.color-option');
        options.forEach(option => {
            option.style.opacity = '0';
            option.style.transform = 'translateY(6px) scale(0.98)';
            option.style.transitionDelay = '';
        });
    }

    showElement(el, delayMs = 0) {
        el.style.transitionDelay = `${delayMs}ms`;
        el.style.transition = 'transform 380ms cubic-bezier(.22, .9, .3, 1), opacity 300ms cubic-bezier(.22, .9, .3, 1)';

        requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0px) scale(1)';
        });

        setTimeout(() => {
            el.style.transitionDelay = '';
        }, 420 + delayMs + 30);
    }

    selectColor(color) {
        this.selectedColor = color;

        // Store globally for simulator to use
        window.selectedLEDColor = parseInt(color.value);
        console.log('✅ LED color changed to:', color.name, color.value);

        // Call callback if set
        if (this.changeCallback) {
            this.changeCallback(color);
        }
    }

    getSelectedColor() {
        return this.selectedColor;
    }

    onColorChange(callback) {
        this.changeCallback = callback;
    }
    show() {
        this.container.style.opacity = '0';
        this.container.style.display = 'inline-block';
        setTimeout(() => {
            this.container.style.transition = 'opacity 0.3s ease';
            this.container.style.opacity = '1';
        }, 10);
    }

    hide() {
        this.container.style.transition = 'opacity 0.3s ease';
        this.container.style.opacity = '0';
        setTimeout(() => {
            this.container.style.display = 'none';
            if (this.isVisible) {
                this.close();
            }
        }, 300);
    }
}

// Export singleton instance
export const ledColorDropdown = new LEDColorDropdown();