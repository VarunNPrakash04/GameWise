import * as THREE from 'three';

/**
 * Circuit Simulator
 * Handles code verification, circuit validation, and visual simulation
 */
export class CircuitSimulator {
    constructor(scene, components, wires) {
        this.scene = scene;
        this.components = components;
        this.wires = wires;
        this.pinStates = {};
        this.isRunning = false;
        this.buttonListeners = new Map();
        this.animationTimer = null; // For LED blinking
    }

    /**
 * Update circuit data (call this after loading a file)
 */
    updateCircuitData(components, wires) {
        this.components = components;
        this.wires = wires;
        console.log('🔄 Simulator updated:', {
            components: this.components.length,
            wires: this.wires.length
        });
    }

    /**
     * Verify code and circuit with backend
     */
    async verify(code) {
        try {
            // Extract circuit data
            const circuitData = this.extractCircuitData();

            console.log('🔍 Extracted circuit data:', circuitData);
            console.log('🔍 Wires array length:', this.wires.length);
            console.log('🔍 Components array length:', this.components.length);

            console.log('📤 Sending verification request...');

            // Send to backend
            const response = await fetch('http://localhost:3001/api/verify-circuit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    circuit: circuitData
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('📥 Verification result:', result.message);

            return result;

        } catch (error) {
            console.error('❌ Verification failed:', error);
            throw error;
        }
    }

    /**
     * Start simulation with AI-provided instructions
     */
    startSimulation(componentStates) {
        console.log('🎮 Starting with states:', componentStates);

        this.isRunning = true;

        // Apply LED behavior
        if (componentStates.LED) {
            const ledConfig = componentStates.LED;

            if (ledConfig.type === 'STATIC') {
                // Static state - just set once
                const shouldGlow = ledConfig.state === 'HIGH';
                this.setLEDState(shouldGlow);
                console.log(`💡 LED static: ${ledConfig.state}`);

            } else if (ledConfig.type === 'BLINK') {
                // Blinking animation
                this.startLEDAnimation(ledConfig.pattern, ledConfig.repeat);
                console.log(`💡 LED blinking with ${ledConfig.pattern.length} steps`);
            }
        }

        // Setup button states
        if (componentStates.BUTTON) {
            this.components.forEach(comp => {
                if (comp.userData.type === 'BUTTON') {
                    comp.userData.buttonStates = componentStates.BUTTON;
                    // Reset toggle state so first press initializes correctly
                    delete comp.userData.toggleState;
                }
            });
        }

        console.log('✅ Simulation started');
    }
    /**
 * Check if LED is connected to a powered Arduino pin
 */
    isLEDConnectedToPoweredPin(ledComponent) {
        const ledPins = ledComponent.userData.snappedPins;
        if (!ledPins) return false;

        // Check if LED anode is connected to any Arduino digital pin via breadboard
        const hasArduinoConnection = this.wires.some(wire => {
            // Check if wire connects an Arduino pin to the LED's breadboard row
            const isFromArduino = wire.from && wire.from.startsWith('Pin_');
            const isToLEDRow = wire.to && this.isInSameRow(wire.to, ledPins.long);

            return isFromArduino && isToLEDRow;
        });

        return hasArduinoConnection;
    }

    /**
     * Check if two breadboard pins are in the same row
     */
    isInSameRow(pin1, pin2) {
        if (!pin1 || !pin2) return false;

        // Extract row number (e.g., BB_D3 -> 3)
        const row1 = pin1.match(/\d+$/)?.[0];
        const row2 = pin2.match(/\d+$/)?.[0];

        return row1 === row2;
    }

    /**
 * Set LED state (on/off) for all connected LEDs
 */
    setLEDState(shouldGlow) {
        this.components.forEach(comp => {
            if (comp.userData.type === 'LED') {
                const isConnected = this.isLEDConnectedToPoweredPin(comp);

                if (isConnected) {
                    comp.traverse(child => {
                        if (child.isMesh && child.material) {
                            child.material.emissive = shouldGlow ? new THREE.Color(0xff0000) : new THREE.Color(0x000000);
                            child.material.emissiveIntensity = shouldGlow ? 2 : 0;
                            child.material.needsUpdate = true;
                        }
                    });
                    console.log(`💡 LED visual state updated: ${shouldGlow ? 'ON' : 'OFF'}`);
                } else {
                    console.warn('⚠️ LED found but not connected to powered pin:', comp.userData.snappedPins);
                }
            }
        });
    }

    /**
     * Start LED blinking animation
     */
    startLEDAnimation(pattern, repeat) {
        // Stop any existing animation
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
        }

        let currentStep = 0;

        const runStep = () => {
            if (!this.isRunning) return; // Stop if simulation stopped

            const step = pattern[currentStep];
            const shouldGlow = step.state === 'HIGH';

            // Apply state
            this.setLEDState(shouldGlow);
            console.log(`💡 Animation step ${currentStep + 1}: ${step.state} for ${step.duration}ms`);

            // Schedule next step
            currentStep++;
            if (currentStep >= pattern.length) {
                if (repeat) {
                    currentStep = 0; // Loop back to start
                } else {
                    return; // Animation complete
                }
            }

            this.animationTimer = setTimeout(runStep, step.duration);
        };

        // Start animation
        runStep();
    }

    /**
     * Stop simulation and reset all components
     */
    stopSimulation() {
        console.log('⏹️ Stopping simulation...');

        this.isRunning = false;

        // Stop animation timer
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }

        // Turn off all LEDs
        this.setLEDState(false);

        // Remove button listeners
        this.buttonListeners.clear();

        console.log('✅ Simulation stopped');
    }

    /**
     * Set LED glow state
     */
    setLEDGlow(pinName, shouldGlow, brightness = 255, ledComponent = null) {
        // Find LED by pin or use provided component
        let led = ledComponent;

        if (!led && pinName) {
            led = this.findLEDConnectedToPin(pinName);
        }

        if (!led) {
            console.warn('⚠️ LED not found for pin:', pinName);
            return;
        }

        // Update LED material
        led.traverse(child => {
            if (child.isMesh && child.material) {
                if (shouldGlow) {
                    // Make LED glow red
                    child.material.emissive = new THREE.Color(0xff0000);
                    child.material.emissiveIntensity = (brightness / 255) * 2;
                    console.log('💡 LED glowing on pin:', pinName);
                } else {
                    // Turn off LED
                    child.material.emissive = new THREE.Color(0x000000);
                    child.material.emissiveIntensity = 0;
                }
                child.material.needsUpdate = true;
            }
        });
    }

    /**
     * Setup button click interaction
     */
    setupButtonInteraction(buttonConfig) {
        const button = this.findButtonConnectedToPin(buttonConfig.connectedToPin);

        if (!button) {
            console.warn('⚠️ Button not found for pin:', buttonConfig.connectedToPin);
            return;
        }

        // Store button action
        button.userData.simulationAction = buttonConfig.onPress;

        console.log('🔘 Button interaction setup on pin:', buttonConfig.connectedToPin);
    }

    /**
     * Handle button press (called from main.js click handler)
     */
    handleButtonPress(button) {
        if (!this.isRunning) return;

        const buttonStates = button.userData.buttonStates;
        if (!buttonStates) return;

        console.log('🔘 Button pressed!');

        // Handle TOGGLE behavior
        if (buttonStates.type === 'TOGGLE') {
            // Initialize to LOW if not set (LED starts OFF)
            if (button.userData.toggleState === undefined) {
                button.userData.toggleState = 'LOW';
            }

            // Always flip the state on every press
            button.userData.toggleState = button.userData.toggleState === 'HIGH' ? 'LOW' : 'HIGH';
            console.log(`🔘 Toggle flipped to: ${button.userData.toggleState}`);

            // Apply to LED
            const shouldGlow = button.userData.toggleState === 'HIGH';
            this.setLEDState(shouldGlow);
            console.log(`💡 LED toggled → ${button.userData.toggleState} (shouldGlow: ${shouldGlow})`);
            return;
        }

        // Handle PRESS/RELEASE behavior
        if (buttonStates.pressed && buttonStates.pressed.LED) {
            const ledConfig = buttonStates.pressed.LED;

            if (ledConfig.type === 'STATIC') {
                const shouldGlow = ledConfig.state === 'HIGH';
                this.setLEDState(shouldGlow);
                console.log(`💡 LED → ${ledConfig.state}`);
            }
        }
    }

    /**
 * Handle button release (called from main.js mouseup handler)
 */
    handleButtonRelease(button) {
        if (!this.isRunning) return;

        const buttonStates = button.userData.buttonStates;
        if (!buttonStates) return;

        // Skip release handling for TOGGLE buttons - they maintain their state
        if (buttonStates.type === 'TOGGLE') {
            console.log('🔘 Button released (TOGGLE - state maintained)');
            return;
        }

        // Only handle release for PRESS/RELEASE type buttons
        if (!buttonStates.released) return;

        console.log('🔘 Button released!');

        // Apply released state
        if (buttonStates.released.LED) {
            const ledConfig = buttonStates.released.LED;

            if (ledConfig.type === 'STATIC') {
                const shouldGlow = ledConfig.state === 'HIGH';
                this.setLEDState(shouldGlow);
                console.log(`💡 LED → ${ledConfig.state}`);
            }
        }
    }

    /**
     * Extract circuit data for verification
     */
    extractCircuitData() {
        const componentsData = this.components.map(component => {
            const data = {
                id: component.uuid,
                type: component.userData.type
            };

            // Add pin information
            if (component.userData.snappedPins) {
                data.pins = component.userData.snappedPins;
            }

            return data;
        });

        // Use wireConnections directly since it already has the metadata we need
        const wiresData = this.wires.map(wc => ({
            from: wc.from,
            to: wc.to,
            color: wc.color
        }));

        return {
            components: componentsData,
            wires: wiresData
        };
    }

    /**
     * Find LED connected to a specific Arduino pin
     */
    findLEDConnectedToPin(pinName) {
        for (const component of this.components) {
            if (component.userData.type !== 'LED') continue;

            const isConnected = this.wires.some(wire => {
                const ledPins = component.userData.snappedPins;
                if (!ledPins) return false;

                // Check if wire connects Arduino pin to LED pin
                // wireConnections uses 'from' and 'to', not 'userData.fromPin'
                return (
                    (wire.from === pinName &&
                        (wire.to === ledPins.long || wire.to === ledPins.short)) ||
                    (wire.to === pinName &&
                        (wire.from === ledPins.long || wire.from === ledPins.short))
                );
            });

            if (isConnected) return component;
        }

        return null;
    }

    /**
     * Find button connected to a specific Arduino pin
     */
    findButtonConnectedToPin(pinName) {
        for (const component of this.components) {
            if (component.userData.type !== 'BUTTON') continue;

            // Check if button is connected to this pin via wires
            const isConnected = this.wires.some(wire => {
                const buttonPins = component.userData.snappedPins;
                if (!buttonPins || !Array.isArray(buttonPins)) return false;

                // Check if wire connects Arduino pin to any button pin
                // wireConnections uses 'from' and 'to', not 'userData.fromPin'
                return (
                    (wire.from === pinName && buttonPins.includes(wire.to)) ||
                    (wire.to === pinName && buttonPins.includes(wire.from))
                );
            });

            if (isConnected) return component;
        }

        return null;
    }
}
