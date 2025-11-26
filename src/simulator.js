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
     * Verify code and circuit with backend
     */
    async verify(code) {
        try {
            // Extract circuit data
            const circuitData = this.extractCircuitData();

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
    startSimulation(simulationData) {
        console.log('🎮 Starting simulation...');

        this.isRunning = true;
        this.pinStates = simulationData.pins || {};

        // Apply LED states
        if (simulationData.components?.LED) {
            simulationData.components.LED.forEach(ledConfig => {
                this.setLEDGlow(ledConfig.connectedToPin, ledConfig.shouldGlow, ledConfig.brightness);
            });
        }

        // Setup button interactions
        if (simulationData.components?.BUTTON) {
            simulationData.components.BUTTON.forEach(buttonConfig => {
                this.setupButtonInteraction(buttonConfig);
            });
        }

        console.log('✅ Simulation started');
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

        const wiresData = this.wires.map(wire => ({
            from: wire.userData.fromPin,
            to: wire.userData.toPin,
            color: wire.userData.color
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

            // Check if LED is connected to this pin via wires
            const isConnected = this.wires.some(wire => {
                const ledPins = component.userData.snappedPins;
                if (!ledPins) return false;

                // Check if wire connects Arduino pin to LED pin
                return (
                    (wire.userData.fromPin === pinName &&
                        (wire.userData.toPin === ledPins.long || wire.userData.toPin === ledPins.short)) ||
                    (wire.userData.toPin === pinName &&
                        (wire.userData.fromPin === ledPins.long || wire.userData.fromPin === ledPins.short))
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
                return (
                    (wire.userData.fromPin === pinName && buttonPins.includes(wire.userData.toPin)) ||
                    (wire.userData.toPin === pinName && buttonPins.includes(wire.userData.fromPin))
                );
            });

            if (isConnected) return component;
        }

        return null;
    }
}
