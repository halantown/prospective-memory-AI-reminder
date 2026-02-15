window.TutorialSystem = class TutorialSystem {
    constructor() {
        this.active = false;
        this.overlay = null;
        this.tooltip = null;
        this.highlightBox = null;
        this.initDOM();
    }

    initDOM() {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'tutorial-layer';
        this.container.style.position = 'fixed';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none'; // Allow clicks through generally
        this.container.style.zIndex = '9999';
        this.container.style.display = 'none';
        
        // Highlight Box (The focus area)
        this.highlightBox = document.createElement('div');
        this.highlightBox.className = 'tutorial-highlight';
        this.highlightBox.style.position = 'absolute';
        this.highlightBox.style.border = '4px solid #f59e0b'; // Amber-500
        // Use a large box shadow to dim the rest of the screen
        this.highlightBox.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.6), 0 0 20px rgba(245, 158, 11, 0.5)'; 
        this.highlightBox.style.borderRadius = '12px';
        this.highlightBox.style.transition = 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
        this.highlightBox.style.pointerEvents = 'none'; // User must be able to click through this box to the button
        
        // Pulse animation for the border
        const style = document.createElement('style');
        style.textContent = `
            @keyframes tutorial-pulse {
                0% { border-color: #f59e0b; transform: scale(1); }
                50% { border-color: #fbbf24; transform: scale(1.02); }
                100% { border-color: #f59e0b; transform: scale(1); }
            }
            .tutorial-highlight { animation: tutorial-pulse 2s infinite; }
        `;
        document.head.appendChild(style);

        // Tooltip (Instructions)
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tutorial-tooltip';
        this.tooltip.style.position = 'absolute';
        this.tooltip.style.backgroundColor = 'white';
        this.tooltip.style.padding = '16px 24px';
        this.tooltip.style.borderRadius = '16px';
        this.tooltip.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
        this.tooltip.style.maxWidth = '320px';
        this.tooltip.style.fontSize = '1.2rem';
        this.tooltip.style.fontWeight = 'bold';
        this.tooltip.style.color = '#1e293b';
        this.tooltip.style.transition = 'all 0.4s ease';
        this.tooltip.style.border = '1px solid #e2e8f0';
        this.tooltip.style.pointerEvents = 'auto'; // Allow interaction with tooltip if needed

        // Add an "hand" emoji icon
        this.tooltipContent = document.createElement('div');
        this.tooltipContent.style.display = 'flex';
        this.tooltipContent.style.alignItems = 'center';
        this.tooltipContent.style.gap = '12px';
        this.tooltip.appendChild(this.tooltipContent);

        this.container.appendChild(this.highlightBox);
        this.container.appendChild(this.tooltip);
        document.body.appendChild(this.container);
    }

    start() {
        this.active = true;
        this.container.style.display = 'block';
        document.body.classList.add('tutorial-active');
    }

    stop() {
        this.active = false;
        this.container.style.display = 'none';
        document.body.classList.remove('tutorial-active');
    }

    /**
     * Focus visual guide on a specific element
     * @param {string} selector CSS selector for the element
     * @param {string} message Instruction text
     * @param {string} placement 'top', 'bottom', 'left', 'right'
     */
    focus(selector, message, placement = 'auto') {
        if (!this.active) return;
        
        // Wait for DOM to stabilize (e.g., Vue transitions)
        setTimeout(() => {
            const el = document.querySelector(selector);
            if (!el) {
                // If element not found, retry once or hide highlight
                // console.warn('Tutorial target not found:', selector);
                this.highlightBox.style.opacity = '0';
                this.tooltip.style.opacity = '0';
                return;
            }

            this.highlightBox.style.opacity = '1';
            this.tooltip.style.opacity = '1';

            const rect = el.getBoundingClientRect();
            const padding = 8;
            
            // Position Highlight Box
            this.highlightBox.style.top = (rect.top - padding) + 'px';
            this.highlightBox.style.left = (rect.left - padding) + 'px';
            this.highlightBox.style.width = (rect.width + padding * 2) + 'px';
            this.highlightBox.style.height = (rect.height + padding * 2) + 'px';

            // Set Content
            this.tooltipContent.innerHTML = `<span style="font-size: 1.5rem;">👆</span> <span>${message}</span>`;
            
            // Calculate Tooltip Position
            const tipRect = { width: 320, height: 80 }; // approximate
            let tipTop = 0;
            let tipLeft = 0;

            // Auto placement logic simple version
            if (placement === 'auto') {
                if (rect.bottom + 150 < window.innerHeight) placement = 'bottom';
                else if (rect.top - 150 > 0) placement = 'top';
                else placement = 'bottom'; // Fallback
            }

            if (placement === 'bottom') {
                tipTop = rect.bottom + 20;
                tipLeft = rect.left + (rect.width / 2) - (tipRect.width / 2);
            } else if (placement === 'top') {
                tipTop = rect.top - 90;
                tipLeft = rect.left + (rect.width / 2) - (tipRect.width / 2);
            } else if (placement === 'right') {
                tipLeft = rect.right + 20;
                tipTop = rect.top + (rect.height / 2) - (tipRect.height / 2);
            }

            // Screen Boundaries Check
            if (tipLeft < 20) tipLeft = 20;
            if (tipLeft + 320 > window.innerWidth) tipLeft = window.innerWidth - 340;
            if (tipTop < 20) tipTop = 20;

            this.tooltip.style.top = tipTop + 'px';
            this.tooltip.style.left = tipLeft + 'px';

        }, 400); // 400ms delay to allow for Vue enter transitions
    }
}