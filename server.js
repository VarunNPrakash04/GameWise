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
  return `You are an Arduino circuit verification expert. Analyze the code and circuit, then return ONLY a JSON object.

**Circuit Configuration:**
Components: ${JSON.stringify(circuit.components, null, 2)}
Wires: ${JSON.stringify(circuit.wires, null, 2)}

**Arduino Code:**
\`\`\`cpp
${code}
\`\`\`

**CRITICAL: You MUST respond with ONLY valid JSON in this EXACT format. No explanations, no markdown, ONLY the JSON object:**

{
  "syntaxValid": true,
  "syntaxErrors": [],
  "circuitValid": true,
  "circuitIssues": [],
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

**Instructions:**
1. Set syntaxValid to false if code has syntax errors, list them in syntaxErrors array
2. Set circuitValid to false if circuit doesn't match code, list issues in circuitIssues array
3. In simulation.pins: list ALL pins used in pinMode() with their mode and initial state
4. In simulation.components.LED: for each LED in circuit, check if its connected pin has digitalWrite(pin, HIGH). If yes, set shouldGlow: true
5. In simulation.components.BUTTON: for each button, if code uses digitalRead() on its pin, add button config with onPress action
6. If button press should toggle an LED (like in if statements), set onPress.action to "TOGGLE" and onPress.targetPin to the LED pin

**Example for button + LED circuit:**
If code has: if(digitalRead(2) == LOW) digitalWrite(13, HIGH);
Then button config should be:
{
  "connectedToPin": "D2",
  "onPress": {
    "targetPin": "D13",
    "action": "TOGGLE"
  }
}

RESPOND WITH ONLY THE JSON OBJECT, NO OTHER TEXT.`;
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
