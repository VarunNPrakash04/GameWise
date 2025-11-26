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

        // Apply LED state - find which LED is connected to the active pin
        if (componentStates.LED) {
            const shouldGlow = componentStates.LED === 'HIGH';

            // Find which pin is being driven (look for digitalWrite in code)
            // For now, assume it's the LED connected to any HIGH pin
            this.components.forEach(comp => {
                if (comp.userData.type === 'LED') {
                    // Check if this LED is connected to a powered pin
                    const isConnected = this.isLEDConnectedToPoweredPin(comp);

                    if (isConnected) {
                        comp.traverse(child => {
                            if (child.isMesh && child.material) {
                                child.material.emissive = shouldGlow ? new THREE.Color(0xff0000) : new THREE.Color(0x000000);
                                child.material.emissiveIntensity = shouldGlow ? 2 : 0;
                                child.material.needsUpdate = true;
                            }
                        });
                        console.log(`💡 LED glowing: ${shouldGlow}`);
                    }
                }
            });
        }

        // Setup button states
        if (componentStates.BUTTON) {
            this.components.forEach(comp => {
                if (comp.userData.type === 'BUTTON') {
                    comp.userData.buttonStates = componentStates.BUTTON;
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
     * Stop simulation and reset all components
     */
    stopSimulation() {
        console.log('⏹️ Stopping simulation...');

        this.isRunning = false;

        // Turn off all LEDs
        this.components.forEach(component => {
            if (component.userData.type === 'LED') {
                this.setLEDGlow(null, false, 0, component);
            }
        });

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

        const action = button.userData.simulationAction;
        if (!action) return;

        console.log('🔘 Button pressed! Action:', action.action);

        if (action.action === 'TOGGLE') {
            // Toggle target pin state
            const currentState = this.pinStates[action.targetPin]?.state;
            const newState = currentState === 'HIGH' ? 'LOW' : 'HIGH';

            this.pinStates[action.targetPin] = {
                ...this.pinStates[action.targetPin],
                state: newState
            };

            // Update connected LEDs
            this.setLEDGlow(action.targetPin, newState === 'HIGH', 255);
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
