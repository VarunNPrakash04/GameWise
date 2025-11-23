/**
 * Arduino Code Verifier Module
 * Parses Arduino code, validates connections, and simulates circuit behavior
 */

/**
 * Main verification function
 * @param {string} code - Arduino code from editor
 * @param {Array} wireConnections - Array of wire connections {id, from, to, color}
 * @param {Array} components - Array of component objects
 * @returns {Object} - Verification result {success, errors, simulation}
 */
export function verifyArduinoCode(code, wireConnections, components) {
    console.log('=== ARDUINO CODE VERIFICATION ===');
    console.log('Code length:', code.length);
    console.log('Wire connections:', wireConnections);
    console.log('Components:', components);

    // Step 1: Check syntax
    const syntaxErrors = checkSyntax(code);
    if (syntaxErrors.length > 0) {
        console.error('❌ SYNTAX ERRORS FOUND:');
        syntaxErrors.forEach(err => console.error(`  Line ${err.line}: ${err.message}`));
        return {
            success: false,
            errors: syntaxErrors,
            simulation: null
        };
    }
    console.log('✅ Syntax check passed');

    // Step 2: Parse code to extract pin definitions and operations
    const pinDefinitions = extractPinDefinitions(code);
    const pinOperations = extractPinOperations(code);
    console.log('📌 Pin definitions:', pinDefinitions);
    console.log('⚡ Pin operations:', pinOperations);

    // Step 2.5: Check for undefined variables
    const undefinedVarErrors = checkUndefinedVariables(code, pinDefinitions, pinOperations);
    if (undefinedVarErrors.length > 0) {
        console.error('❌ UNDEFINED VARIABLE ERRORS:');
        undefinedVarErrors.forEach(err => console.error(`  ${err.message}`));
        return {
            success: false,
            errors: undefinedVarErrors,
            simulation: null
        };
    }
    console.log('✅ Variable check passed');

    // Step 3: Build component connection map from physical connections
    const connectionMap = buildComponentMap(wireConnections, components);
    console.log('🔌 Connection map:', connectionMap);

    // Step 4: Validate that code pins match physical connections
    const validationResult = validateConnections(pinDefinitions, connectionMap);
    console.log('🔍 Validation result:', validationResult);

    // Step 5: Simulate circuit behavior
    const simulation = simulateCircuit(pinOperations, pinDefinitions, connectionMap);
    console.log('🎮 Simulation results:');
    simulation.forEach(result => {
        if (result.success) {
            console.log(`✅ ${result.message}`);
        } else {
            console.log(`❌ ${result.message}`);
        }
    });

    return {
        success: true,
        errors: [],
        simulation: simulation
    };
}

/**
 * Check for basic syntax errors in Arduino code
 */
// function checkSyntax(code) {
//     const errors = [];
//     const lines = code.split('\n');

//     lines.forEach((line, index) => {
//         const lineNum = index + 1;
//         const trimmed = line.trim();

//         // Skip empty lines and comments
//         if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
//             return;
//         }

//         // Check for missing semicolons (basic check)
//         // Statements that should end with semicolon
//         if ((trimmed.match(/^\s*(pinMode|digitalWrite|digitalRead|Serial\.|delay|return)\s*\(/) ||
//             trimmed.match(/^\s*(int|const)\s+\w+\s*=/) ||
//             trimmed.match(/^\s*#define\s+\w+\s+\d+/)) &&
//             !trimmed.endsWith(';') &&
//             !trimmed.endsWith('{') &&
//             !trimmed.endsWith('}')) {
//             errors.push({
//                 line: lineNum,
//                 message: 'Missing semicolon'
//             });
//         }

//         // Check for unmatched parentheses
//         const openParens = (trimmed.match(/\(/g) || []).length;
//         const closeParens = (trimmed.match(/\)/g) || []).length;
//         if (openParens !== closeParens) {
//             errors.push({
//                 line: lineNum,
//                 message: 'Unmatched parentheses'
//             });
//         }
//     });

//     // Check for unmatched braces
//     const openBraces = (code.match(/\{/g) || []).length;
//     const closeBraces = (code.match(/\}/g) || []).length;
//     if (openBraces !== closeBraces) {
//         errors.push({
//             line: 0,
//             message: `Unmatched braces: ${openBraces} opening, ${closeBraces} closing`
//         });
//     }

//     return errors;
// }

/**
 * Check for basic syntax errors in Arduino code
 */
function checkSyntax(code) {
    const errors = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            return;
        }

        // Check for incomplete variable declarations
        if (trimmed.match(/^\s*(int|const|float|double|char|byte|boolean|long|short)\s*;?\s*$/)) {
            errors.push({
                line: lineNum,
                message: 'Incomplete variable declaration'
            });
        }

        // Check for missing variable name after type
        if (trimmed.match(/^\s*(int|const|float|double|char|byte|boolean|long|short)\s+$/)) {
            errors.push({
                line: lineNum,
                message: 'Missing variable name after type declaration'
            });
        }

        // Check for missing semicolons (basic check)
        // Statements that should end with semicolon
        if ((trimmed.match(/^\s*(pinMode|digitalWrite|digitalRead|Serial\.|delay|return)\s*\(/) ||
            trimmed.match(/^\s*(int|const|float|double|char|byte|boolean|long|short)\s+\w+\s*=/) ||
            trimmed.match(/^\s*#define\s+\w+\s+\d+/)) &&
            !trimmed.endsWith(';') &&
            !trimmed.endsWith('{') &&
            !trimmed.endsWith('}')) {
            errors.push({
                line: lineNum,
                message: 'Missing semicolon'
            });
        }

        // Check for unmatched parentheses
        const openParens = (trimmed.match(/\(/g) || []).length;
        const closeParens = (trimmed.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
            errors.push({
                line: lineNum,
                message: 'Unmatched parentheses'
            });
        }

        // Check for invalid function calls (missing parentheses)
        if (trimmed.match(/^\s*(pinMode|digitalWrite|digitalRead|delay)\s*;/)) {
            errors.push({
                line: lineNum,
                message: 'Function call missing parentheses'
            });
        }

        // Check for assignment without value
        if (trimmed.match(/^\s*(int|const|float|double|char|byte|boolean|long|short)\s+\w+\s*=\s*;/)) {
            errors.push({
                line: lineNum,
                message: 'Assignment without value'
            });
        }
    });

    // Check for unmatched braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        errors.push({
            line: 0,
            message: `Unmatched braces: ${openBraces} opening, ${closeBraces} closing`
        });
    }

    // Check for missing setup() or loop() functions
    if (!code.includes('void setup()')) {
        errors.push({
            line: 0,
            message: 'Missing required function: void setup()'
        });
    }
    if (!code.includes('void loop()')) {
        errors.push({
            line: 0,
            message: 'Missing required function: void loop()'
        });
    }

    return errors;
}
/**
 * Check for undefined variables in pin operations
 */
function checkUndefinedVariables(code, pinDefinitions, pinOperations) {
    const errors = [];

    // Known Arduino constants that don't need to be defined
    const arduinoConstants = [
        'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP',
        'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'
    ];

    // Check all pin operations for undefined variables
    pinOperations.forEach(operation => {
        const pinVar = operation.pin;

        // Skip if it's a number
        if (!isNaN(pinVar)) return;

        // Skip if it's a known Arduino constant
        if (arduinoConstants.includes(pinVar)) return;

        // Check if it's defined in the code
        if (!pinDefinitions[pinVar]) {
            errors.push({
                line: 0, // We don't track line numbers for operations yet
                message: `Undefined variable: '${pinVar}'`
            });
        }
    });

    return errors;
}

/**
 * Extract pin definitions from code
 * Looks for #define, const int, and int declarations
 */
function extractPinDefinitions(code) {
    const definitions = {};

    // Match #define LED_PIN 13
    const defineRegex = /#define\s+(\w+)\s+(\d+)/g;
    let match;
    while ((match = defineRegex.exec(code)) !== null) {
        const varName = match[1];
        const pinNumber = parseInt(match[2]);
        definitions[varName] = pinNumber;
    }

    // Match const int LED_PIN = 13;
    const constRegex = /const\s+int\s+(\w+)\s*=\s*(\d+)/g;
    while ((match = constRegex.exec(code)) !== null) {
        const varName = match[1];
        const pinNumber = parseInt(match[2]);
        definitions[varName] = pinNumber;
    }

    // Match int LED_PIN = 13;
    const intRegex = /int\s+(\w+)\s*=\s*(\d+)/g;
    while ((match = intRegex.exec(code)) !== null) {
        const varName = match[1];
        const pinNumber = parseInt(match[2]);
        definitions[varName] = pinNumber;
    }

    return definitions;
}

/**
 * Extract pin operations from code (digitalWrite, digitalRead, etc.)
 */
function extractPinOperations(code) {
    const operations = [];

    // Match digitalWrite(pin, HIGH/LOW)
    const digitalWriteRegex = /digitalWrite\s*\(\s*(\w+)\s*,\s*(HIGH|LOW)\s*\)/g;
    let match;
    while ((match = digitalWriteRegex.exec(code)) !== null) {
        operations.push({
            type: 'digitalWrite',
            pin: match[1], // Could be variable name or number
            value: match[2]
        });
    }

    // Match digitalRead(pin)
    const digitalReadRegex = /digitalRead\s*\(\s*(\w+)\s*\)/g;
    while ((match = digitalReadRegex.exec(code)) !== null) {
        operations.push({
            type: 'digitalRead',
            pin: match[1]
        });
    }

    // Match pinMode(pin, OUTPUT/INPUT)
    const pinModeRegex = /pinMode\s*\(\s*(\w+)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*\)/g;
    while ((match = pinModeRegex.exec(code)) !== null) {
        operations.push({
            type: 'pinMode',
            pin: match[1],
            mode: match[2]
        });
    }

    return operations;
}

/**
 * Build a component connection map from wire connections
 * Maps Arduino pins to connected components
 */
function buildComponentMap(wireConnections, components) {
    const map = {};

    // DEBUG: Log all wire connections to see actual pin names
    console.log('🔍 DEBUG - All wire connections:');
    wireConnections.forEach((wire, index) => {
        console.log(`  Wire ${index}: ${wire.from} → ${wire.to}`);
    });

    // For each wire connection, trace from Arduino pin to component
    wireConnections.forEach(wire => {
        const { from, to } = wire;

        // Check if either end is an Arduino pin
        // Match patterns: Pin_13, Pin_RESET, D13, 13, etc.
        const fromPinMatch = from.match(/Pin_(\w+)|(?:D|Pin)?(\d+)$/i);
        const toPinMatch = to.match(/Pin_(\w+)|(?:D|Pin)?(\d+)$/i);

        // Check if it's likely an Arduino pin (not a breadboard pin which starts with BB_)
        const isFromArduino = fromPinMatch && !from.startsWith('BB_');
        const isToArduino = toPinMatch && !to.startsWith('BB_');

        if (isFromArduino) {
            // Extract pin number - could be Pin_13 or Pin_RESET (RESET is pin 0)
            let arduinoPin;
            if (fromPinMatch[1]) {
                // Pin_RESET, Pin_13, etc.
                arduinoPin = fromPinMatch[1] === 'RESET' ? 0 : (isNaN(fromPinMatch[1]) ? fromPinMatch[1] : parseInt(fromPinMatch[1]));
            } else {
                arduinoPin = parseInt(fromPinMatch[2]);
            }
            console.log(`  ✓ Found Arduino pin: ${from} → Pin ${arduinoPin}`);
            if (!map[arduinoPin]) {
                map[arduinoPin] = { connections: [], components: [] };
            }
            map[arduinoPin].connections.push(to);
        }

        if (isToArduino) {
            let arduinoPin;
            if (toPinMatch[1]) {
                arduinoPin = toPinMatch[1] === 'RESET' ? 0 : (isNaN(toPinMatch[1]) ? toPinMatch[1] : parseInt(toPinMatch[1]));
            } else {
                arduinoPin = parseInt(toPinMatch[2]);
            }
            console.log(`  ✓ Found Arduino pin: ${to} → Pin ${arduinoPin}`);
            if (!map[arduinoPin]) {
                map[arduinoPin] = { connections: [], components: [] };
            }
            map[arduinoPin].connections.push(from);
        }
    });

    // Now trace breadboard connections to components
    components.forEach(component => {
        if (component.userData && component.userData.type && component.userData.snappedPin) {
            const componentType = component.userData.type;
            const snappedPin = component.userData.snappedPin;

            // Find which Arduino pin connects to this breadboard pin
            Object.keys(map).forEach(arduinoPin => {
                if (map[arduinoPin].connections.includes(snappedPin)) {
                    map[arduinoPin].components.push({
                        type: componentType,
                        pin: snappedPin
                    });
                }
            });
        }
    });

    return map;
}

/**
 * Validate that code pins match physical connections
 */
function validateConnections(pinDefinitions, connectionMap) {
    const validation = {
        valid: [],
        invalid: []
    };

    Object.keys(pinDefinitions).forEach(varName => {
        const pinNumber = pinDefinitions[varName];
        if (connectionMap[pinNumber]) {
            validation.valid.push({
                variable: varName,
                pin: pinNumber,
                connections: connectionMap[pinNumber]
            });
        } else {
            validation.invalid.push({
                variable: varName,
                pin: pinNumber,
                reason: 'No physical connection found'
            });
        }
    });

    return validation;
}

/**
 * Simulate circuit behavior based on code operations and connections
 */
function simulateCircuit(pinOperations, pinDefinitions, connectionMap) {
    const results = [];

    pinOperations.forEach(operation => {
        if (operation.type === 'digitalWrite') {
            // Resolve pin number from variable name or direct number
            let pinNumber;
            if (pinDefinitions[operation.pin]) {
                pinNumber = pinDefinitions[operation.pin];
            } else if (!isNaN(operation.pin)) {
                pinNumber = parseInt(operation.pin);
            } else {
                results.push({
                    success: false,
                    message: `NO RESULT - Pin variable "${operation.pin}" not defined`
                });
                return;
            }

            // Check if this pin has physical connections
            // Check if this pin has physical connections
            const pinConnection = connectionMap[pinNumber];
            if (!pinConnection || pinConnection.connections.length === 0) {
                results.push({
                    success: false,
                    message: `NO RESULT - Pin ${pinNumber} not connected`
                });
                return;
            }

            // Check what components are connected
            const connectedComponents = pinConnection.components;
            if (connectedComponents.length === 0) {
                results.push({
                    success: false,
                    message: `NO RESULT - Pin ${pinNumber} has wires but no component connected`
                });
                return;
            }

            // Simulate the effect on each component
            connectedComponents.forEach(component => {
                const state = operation.value === 'HIGH' ? 'ON' : 'OFF';
                results.push({
                    success: true,
                    message: `${component.type} ${state}`,
                    pin: pinNumber,
                    component: component.type,
                    state: state
                });
            });
        }
    });

    return results;
}
