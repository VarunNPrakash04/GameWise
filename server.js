import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Build AI verification prompt
 */
function buildVerificationPrompt(code, circuit) {
  console.log(code, circuit.components, circuit.wires);
  return `You are an Arduino circuit verification expert. Analyze the code and circuit, then return ONLY a JSON object.

██ BREADBOARD CONNECTIVITY RULES ██
Horizontal rows:
Format example → VCC1 GND1  A1 B1 C1 D1 E1     F1 G1 H1 I1 J1
• A1–E1 are internally connected (LEFT block)
• F1–J1 are internally connected (RIGHT block)
• LEFT and RIGHT blocks are NOT connected

This applies for every numeric row:
A2–E2 connected, F2–J2 connected
A3–E3 connected, F3–J3 connected
...

Vertical power rails:
VCC1, GND1
VCC2, GND2
VCC3, GND3
VCC4, GND4
VCC5, GND5
• All VCC1 points are connected to each other
• All GND1 points are connected to each other
(same for 2/3/4/5 blocks)

██ ARDUINO PIN RULES ██
• Variables MUST be resolved (LED_PIN = 13 → D13)
• pinMode(pin, OUTPUT) → track pin mode
• digitalWrite(pin, HIGH/LOW) → track power state
• Pins are referred to in JSON as "D13", "D2", etc.

Example:
int LED_PIN = 13;
pinMode(LED_PIN, OUTPUT);
digitalWrite(LED_PIN, HIGH);
→ LED_PIN refers to digital pin D13 and is HIGH.

██ CIRCUIT USE-CASE EXAMPLE (LEARN THE EVALUATION METHOD) ██
Code drives pin HIGH:
int LED_PIN = 13;
pinMode(LED_PIN, OUTPUT);
digitalWrite(LED_PIN, HIGH);

Circuit:
LED anode → BB_D3
LED cathode → BB_D1
Pin_13 → BB_C3
GND_4 → BB_B1

Breadboard tracing:
• BB_C3 is in row 3 → A3–E3 connected → LED anode in BB_D3 receives HIGH
• BB_B1 is in row 1 → A1–E1 connected → LED cathode in BB_D1 receives LOW
→ LED must glow (shouldGlow: true)

**BUTTON BEHAVIOR:**

If code has digitalRead() on a button pin with if statement:
- Check what happens when button is pressed (digitalRead == LOW)
- Check what happens when button is released (digitalRead == HIGH)
- Return pressed/released states with what they control





**TOGGLE BEHAVIOR (Button Click Toggles LED):**

If code uses a variable to track button state and toggles LED:
\`\`\`cpp
bool ledState = false;
bool lastButtonState = HIGH;

void loop() {
  bool buttonState = digitalRead(2);
  if (buttonState == LOW && lastButtonState == HIGH) {
    ledState = !ledState;
    digitalWrite(13, ledState);
  }
  lastButtonState = buttonState;
}
\`\`\`

**MUST RETURN:**
\`\`\`json
{
  "BUTTON": {
    "type": "TOGGLE",
    "initialState": "LOW",
    "target": {"LED": {"type": "STATIC"}}
  }
}

**Example Button Code:**
\`\`\`cpp
if (digitalRead(2) == LOW) {
  digitalWrite(13, HIGH);
} else {
  digitalWrite(13, LOW);
}
\`\`\`


**MUST RETURN:**
\`\`\`json
{
  "BUTTON": {
    "pressed": {"LED": {"type": "STATIC", "state": "HIGH"}},
    "released": {"LED": {"type": "STATIC", "state": "LOW"}}
  }
}
\`\`\`

-------------------------------------------------------------

**Circuit Configuration:**
Components: ${JSON.stringify(circuit.components, null, 2)}
Wires: ${JSON.stringify(circuit.wires, null, 2)}

-------------------------------------------------------------

**Arduino Code:**
\`\`\`cpp
${code}
\`\`\`

-------------------------------------------------------------

You MUST output ONLY this JSON, with no explanations, no markdown:

{
  "syntaxValid": true,
  "syntaxErrors": [],
  "circuitValid": true,
  "circuitIssues": [],
  "message": "Ready to upload!",
  "componentStates": {
    "LED": {
      "type": "BLINK",
      "pattern": [
        {"state": "HIGH", "duration": 1000},
        {"state": "LOW", "duration": 1000}
      ],
      "repeat": true
    },
    "BUTTON": {
      "pressed": {"LED": {"type": "STATIC", "state": "HIGH"}},
      "released": {"LED": {"type": "STATIC", "state": "LOW"}},
    }
  }
}

**CRITICAL RULES FOR LED BEHAVIOR:**

STEP 1: Look for digitalWrite() calls in loop():
- If you see digitalWrite(pin, HIGH) followed by delay(X) followed by digitalWrite(pin, LOW) followed by delay(Y)
  → This is BLINKING behavior

STEP 2: Determine type:
- If BOTH digitalWrite(HIGH) AND digitalWrite(LOW) exist with delay() between them → type: "BLINK"
- If ONLY digitalWrite(HIGH) with no LOW → type: "STATIC", state: "HIGH"
- If ONLY digitalWrite(LOW) with no HIGH → type: "STATIC", state: "LOW"

STEP 3: For BLINK type:
- Extract delay() values in milliseconds
- Create pattern array with {state, duration} for each step
- If inside loop() → repeat: true
- If not in loop() → repeat: false

**MANDATORY EXAMPLE - ANALYZE THIS CODE:**
\`\`\`cpp
void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_PIN, LOW);
  delay(1000);
}

-------------------------------------------------------------

Rules to determine JSON:
(keep everything same as original spec — syntaxValid, circuitValid, issues, pins, LED glow conditions, button logic, onPress actions)
`;
}

/// Rate limiting variables
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

/**
 * Sleep function for delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verify circuit endpoint with rate limiting and retry logic
 */
app.post('/api/verify-circuit', async (req, res) => {
  try {
    const { code, circuit } = req.body;

    if (!code || !circuit) {
      return res.status(400).json({
        error: 'Missing code or circuit data'
      });
    }

    console.log('📝 Verifying circuit with', circuit.components?.length || 0, 'components');

    // Rate limiting - wait if needed
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms...`);
      await sleep(waitTime);
    }
    lastRequestTime = Date.now();

    // Build prompt
    const prompt = buildVerificationPrompt(code, circuit);

    // Retry logic
    let retries = 3;
    let lastError;

    while (retries > 0) {
      try {
        // Get AI response
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON response (remove markdown if present)
        let jsonText = responseText.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        }

        const verification = JSON.parse(jsonText);

        console.log('✅ Verification complete:', verification.message);
        console.log('📦 Full AI Response:', JSON.stringify(verification, null, 2));

        return res.json(verification);

      } catch (error) {
        lastError = error;

        // Check if it's a rate limit error
        if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
          retries--;
          if (retries > 0) {
            const backoffTime = (4 - retries) * 3000; // 3s, 6s, 9s
            console.log(`⚠️ Rate limit hit. Retrying in ${backoffTime}ms... (${retries} retries left)`);
            await sleep(backoffTime);
            continue;
          }
        } else {
          // Non-rate-limit error, don't retry
          throw error;
        }
      }
    }

    // All retries exhausted
    throw new Error(`Rate limit exceeded after retries: ${lastError.message}`);

  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      details: error.message,
      suggestion: 'Please wait a few seconds and try again. Gemini API has rate limits.'
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Verification server running' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Arduino Verification Server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to verify circuits!`);
});
