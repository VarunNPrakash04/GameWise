// src/menuSystem.js

/**
 * Menu System Module
 * Handles the components menu UI with animations and toggle behavior
 */

export class MenuSystem {
    constructor(containerId, toggleButtonId, menuId) {
        this.containerId = containerId;
        this.toggleButtonId = toggleButtonId;
        this.menuId = menuId;
        this.isVisible = false;
        this.items = [];

        this.container = null;
        this.toggleButton = null;
        this.menu = null;

        this.init();
    }

    init() {
        this.container = document.getElementById(this.containerId);
        this.toggleButton = document.getElementById(this.toggleButtonId);
        this.menu = document.getElementById(this.menuId);

        if (!this.container || !this.toggleButton || !this.menu) {
            console.error('MenuSystem: Required elements not found');
            return;
        }

        this.attachEventListeners();
    }

    attachEventListeners() {
        // Toggle button click
        this.toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
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

        // Animate items with stagger
        const items = Array.from(this.menu.querySelectorAll('.spawn, .wire-control'));
        const menuRect = this.menu.getBoundingClientRect();

        items.forEach((item, i) => {
            // Reset to hidden state
            item.style.opacity = '0';
            item.style.transform = 'translateY(10px) scale(0.98)';

            const rect = item.getBoundingClientRect();
            const inView = !(rect.bottom < menuRect.top || rect.top > menuRect.bottom);

            if (inView) {
                // Animate visible items with stagger
                this.showElement(item, i * 60);
            }
        });

        // Handle scroll to animate items that come into view
        this.menu.addEventListener('scroll', this.handleScroll.bind(this));
    }

    close() {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.menu.classList.add('closing');

        // Quick fade out
        setTimeout(() => {
            this.menu.classList.remove('visible', 'closing');

            // Reset all items
            const items = this.menu.querySelectorAll('.spawn, .wire-control');
            items.forEach(item => {
                item.style.opacity = '0';
                item.style.transform = 'translateY(6px) scale(0.98)';
                item.style.transitionDelay = '';
            });
        }, 100);

        this.menu.removeEventListener('scroll', this.handleScroll.bind(this));
    }

    handleScroll() {
        if (!this.isVisible) return;

        const items = Array.from(this.menu.querySelectorAll('.spawn, .wire-control'));
        const menuRect = this.menu.getBoundingClientRect();

        items.forEach((item, i) => {
            const rect = item.getBoundingClientRect();
            const inView = !(rect.bottom < menuRect.top || rect.top > menuRect.bottom);
            const isVisible = parseFloat(item.style.opacity) > 0;

            if (inView && !isVisible) {
                this.showElement(item, 0);
            }
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

    addItem(element) {
        this.menu.appendChild(element);
        this.items.push(element);
    }

    removeItem(element) {
        const index = this.items.indexOf(element);
        if (index > -1) {
            this.items.splice(index, 1);
            element.remove();
        }
    }

    clearItems() {
        this.items.forEach(item => item.remove());
        this.items = [];
    }

    isOpen() {
        return this.isVisible;
    }
}

// Export singleton instance for components menu
export const componentsMenu = new MenuSystem(
    'components-container',
    'components-toggle',
    'components-menu'
);