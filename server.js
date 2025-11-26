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
  "suggestedConnections": [],
  "message": "Ready to upload!",
  "simulation": {
    "pins": {
      "D13": { "mode": "OUTPUT", "state": "HIGH" }
    },
    "components": {
      "LED": [
        {
          "connectedToPin": "D13",
          "shouldGlow": true,
          "brightness": 255
        }
      ],
      "BUTTON": []
    }
  }
}

-------------------------------------------------------------

Rules to determine JSON:
(keep everything same as original spec — syntaxValid, circuitValid, issues, pins, LED glow conditions, button logic, onPress actions)
`;
}

/**
 * Verify circuit endpoint
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

    // Build prompt
    const prompt = buildVerificationPrompt(code, circuit);

    // Get AI response - FIXED: Use gemini-1.5-pro
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response (remove markdown if present)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const verification = JSON.parse(jsonText);

    console.log('✅ Verification complete:', verification.message);

    res.json(verification);

  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      details: error.message
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
