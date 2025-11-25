// src/colorDropdown.js

/**
 * Color Dropdown Menu Module
 * Handles the wire color selection UI with animations matching the components menu
 */

export class ColorDropdown {
    constructor() {
        this.isVisible = false;
        this.selectedColor = { value: '0xff0000', hex: '#ff0000', name: 'Red' };
        this.colors = [
            { value: '0xff0000', hex: '#ff0000', name: 'Red' },
            { value: '0x00ff00', hex: '#00ff00', name: 'Green' },
            { value: '0x0000ff', hex: '#0000ff', name: 'Blue' },
            { value: '0xffff00', hex: '#ffff00', name: 'Yellow' },
            { value: '0xff00ff', hex: '#ff00ff', name: 'Magenta' },
            { value: '0x00ffff', hex: '#00ffff', name: 'Cyan' },
            { value: '0xffffff', hex: '#ffffff', name: 'White' },
            { value: '0x000000', hex: '#000000', name: 'Black' }
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
        // Create container for the color dropdown (positioned to the right of components menu)
        this.container = document.createElement('div');
        this.container.id = 'colorDropdownContainer';
        this.container.className = 'color-dropdown-container';
        this.container.style.display = 'none'; // Hidden by default

        // Create toggle button (always shows "Color")
        this.toggleButton = document.createElement('button');
        this.toggleButton.id = 'colorDropdownToggle';
        this.toggleButton.className = 'color-dropdown-toggle';
        this.toggleButton.textContent = 'Color';

        // Create dropdown menu
        this.menu = document.createElement('div');
        this.menu.id = 'colorDropdownMenu';
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

        // Add to UI bar (next to components menu)
        const uiBar = document.getElementById('uiBar');
        if (uiBar) {
            uiBar.appendChild(this.container);
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

        // Animate options with stagger (matching components menu animation)
        const options = Array.from(this.menu.querySelectorAll('.color-option'));
        const menuRect = this.menu.getBoundingClientRect();

        options.forEach((option, i) => {
            // Reset to hidden state
            option.style.opacity = '0';
            option.style.transform = 'translateY(10px) scale(0.98)';

            const rect = option.getBoundingClientRect();
            const inView = !(rect.bottom < menuRect.top || rect.top > menuRect.bottom);

            if (inView) {
                // Animate visible items with stagger
                this.showElement(option, i * 60);
            }
        });
    }

    close() {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.menu.classList.remove('visible');
        this.menu.setAttribute('aria-hidden', 'true');

        // Hide all options quickly
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

        // Clear delay after animation
        setTimeout(() => {
            el.style.transitionDelay = '';
        }, 420 + delayMs + 30);
    }

    selectColor(color) {
        this.selectedColor = color;

        // Update hidden select if it exists (for backward compatibility)
        const wireColorPicker = document.getElementById('wireColorPicker');
        if (wireColorPicker) {
            wireColorPicker.value = color.value;
            wireColorPicker.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Call callback if set
        if (this.changeCallback) {
            this.changeCallback(color);
        }
    }

    show() {
        this.container.style.display = 'inline-block';
    }

    hide() {
        this.container.style.display = 'none';
        if (this.isVisible) {
            this.close();
        }
    }

    getSelectedColor() {
        return this.selectedColor;
    }

    onColorChange(callback) {
        this.changeCallback = callback;
    }
}

// Export singleton instance
export const colorDropdown = new ColorDropdown();