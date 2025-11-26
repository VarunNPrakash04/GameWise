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
    return `You are an Arduino circuit verification and simulation expert.

**Circuit Configuration:**
Components: ${JSON.stringify(circuit.components, null, 2)}
Wires: ${JSON.stringify(circuit.wires, null, 2)}

**Arduino Code:**
\`\`\`cpp
${code}
\`\`\`

**Task:**
1. Check if the code has syntax errors
2. Verify circuit connections match the code logic
3. Generate simulation instructions for visual feedback

**Response Format (MUST be valid JSON only, no markdown):**
{
  "syntaxValid": boolean,
  "syntaxErrors": ["error description"],
  "circuitValid": boolean,
  "circuitIssues": ["issue description"],
  "message": "brief status message",
  "simulation": {
    "pins": {
      "D13": { "mode": "OUTPUT", "state": "HIGH" },
      "D2": { "mode": "INPUT_PULLUP", "state": "HIGH" }
    },
    "components": {
      "LED": [
        {
          "connectedToPin": "D13",
          "shouldGlow": true,
          "brightness": 255
        }
      ],
      "BUTTON": [
        {
          "connectedToPin": "D2",
          "onPress": {
            "targetPin": "D13",
            "action": "TOGGLE"
          }
        }
      ]
    }
  }
}

**Rules:**
- If code uses digitalWrite(pin, HIGH) on a pin connected to an LED, set shouldGlow: true
- If code uses digitalRead() on a button pin, setup button interaction
- If button press should affect another pin (like in if statements), specify in onPress
- Check for common errors: missing pinMode(), wrong pin numbers, short circuits
- Return ONLY valid JSON, no markdown code blocks`;
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

        // Get AI response
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
