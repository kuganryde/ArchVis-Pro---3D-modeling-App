import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
// Respect the platform-provided port (Cloud Run, Heroku, etc.) and fall back
// to 3000 for local development.
const PORT = Number(process.env.PORT) || 3000;

// Increase JSON payload size limit for image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Trim + basic sanity check on a user-supplied key so we can reject obviously
// malformed input before spending a network round-trip on it.
const sanitizeKey = (key?: string): string | undefined => {
  const trimmed = (key || "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

// Initialize the Gemini SDK client from either the per-request BYOK key or the
// server-side env key.
const getGeminiClient = (clientKey?: string) => {
  const apiKey = sanitizeKey(clientKey) || sanitizeKey(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    console.warn("Warning: no Gemini API key provided (BYOK header or GEMINI_API_KEY).");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// Helper delay function for exponential backoff retries
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ClassifiedError {
  status: number; // HTTP-ish status to relay to the client
  message: string; // human-friendly, actionable message
  retryable: boolean; // safe to retry the same model
  tryNextModel: boolean; // model unavailable — fall back to another model
}

// Turn a raw Gemini/SDK error into a clean, actionable result. The SDK throws
// an ApiError whose `.message` is a JSON string; we unwrap it so users see
// "Your API key is invalid" instead of a nested blob, and so we never retry
// errors that can never succeed (bad key, permission, bad request).
const classifyGeminiError = (error: any): ClassifiedError => {
  const rawStatus: number | undefined =
    typeof error?.status === "number" ? error.status : undefined;

  // Unwrap the nested { error: { code, message, status, details } } payload.
  let inner: any = null;
  try {
    const parsed = typeof error?.message === "string" ? JSON.parse(error.message) : null;
    inner = parsed?.error ?? parsed;
  } catch {
    inner = null;
  }

  const code: number | undefined = inner?.code ?? rawStatus;
  const reason: string = inner?.status || inner?.details?.[0]?.reason || "";
  const detail: string = inner?.message || error?.message || "Unknown error contacting Gemini.";

  // Invalid / missing key.
  if (code === 400 && /API_KEY_INVALID|api key not valid/i.test(`${reason} ${detail}`)) {
    return {
      status: 401,
      message:
        "Your Gemini API key is invalid. Open “Set API Key” and paste a valid key from Google AI Studio (it should start with “AIza”).",
      retryable: false,
      tryNextModel: false,
    };
  }
  // Permission / API not enabled / key restrictions.
  if (code === 401 || code === 403) {
    return {
      status: 403,
      message:
        "This Gemini API key was rejected. Make sure the Generative Language API is enabled for the key and that no HTTP-referrer/IP restrictions block server use.",
      retryable: false,
      tryNextModel: false,
    };
  }
  // Model not found / not available for this key — worth trying the fallback model.
  if (code === 404) {
    return {
      status: 404,
      message: "The requested Gemini model is not available for this API key.",
      retryable: false,
      tryNextModel: true,
    };
  }
  // Rate limit / quota — transient, safe to retry.
  if (code === 429) {
    return {
      status: 429,
      message: "Gemini rate limit or quota reached. Please wait a moment and try again.",
      retryable: true,
      tryNextModel: false,
    };
  }
  // Other bad requests — do not retry (payload issue).
  if (code === 400) {
    return { status: 400, message: detail, retryable: false, tryNextModel: false };
  }
  // Server-side / transient (500, 502, 503, 504) or network error (no code).
  return {
    status: code && code >= 400 ? code : 503,
    message: "Gemini is temporarily unavailable. Please try again in a moment.",
    retryable: true,
    tryNextModel: true,
  };
};

// Error carrying the classified status so the route can relay it accurately.
class GeminiRequestError extends Error {
  status: number;
  constructor(classified: ClassifiedError) {
    super(classified.message);
    this.status = classified.status;
  }
}

// Candidate models in priority order. gemini-2.5-flash is the primary vision
// model; gemini-2.5-flash-lite is the lighter/cheaper fallback.
const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

// Shared response schema so the digitizer and the prompt rebuilder return the
// exact same well-formed shape the client mapper expects.
const LAYOUT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ["rooms", "assets"],
  properties: {
    rooms: {
      type: Type.ARRAY,
      description: "Extracted architectural rooms fitting the CAD blueprint",
      items: {
        type: Type.OBJECT,
        required: ["name", "x", "z", "width", "depth", "areaSqFt", "color", "textColor"],
        properties: {
          name: { type: Type.STRING },
          x: { type: Type.NUMBER },
          z: { type: Type.NUMBER },
          width: { type: Type.NUMBER },
          depth: { type: Type.NUMBER },
          areaSqFt: { type: Type.NUMBER },
          color: { type: Type.STRING },
          textColor: { type: Type.STRING },
        },
      },
    },
    assets: {
      type: Type.ARRAY,
      description: "Suggested initial networking and furniture asset nodes matching scanned spaces",
      items: {
        type: Type.OBJECT,
        required: ["type", "name", "x", "z"],
        properties: {
          type: { type: Type.STRING, description: "e.g. 'ap', 'dp', 'cctv', 'desk_single', 'conference_table', 'chair_office'" },
          name: { type: Type.STRING },
          x: { type: Type.NUMBER },
          z: { type: Type.NUMBER },
          specs: {
            type: Type.OBJECT,
            description: "Key-value pair specs e.g. Manufacturer, Model, Status",
          },
        },
      },
    },
  },
};

// Generation helper with model fallback and *smart* retries: only transient
// errors (rate limit, 5xx, network) are retried. Non-retryable errors — an
// invalid key, permission denial, or a bad request — fail fast instead of
// hammering the API for ~20s before surfacing the same message.
const MAX_ATTEMPTS_PER_MODEL = 3;

const generateLayoutWithRetry = async (ai: any, contents: any) => {
  let lastClassified: ClassifiedError | null = null;

  for (const model of MODELS_TO_TRY) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        console.log(`AI Layout: Querying model ${model} (attempt ${attempt}/${MAX_ATTEMPTS_PER_MODEL})...`);
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: LAYOUT_RESPONSE_SCHEMA,
          },
        });
        console.log(`AI Layout successfully parsed with model ${model}!`);
        return response;
      } catch (error: any) {
        const classified = classifyGeminiError(error);
        lastClassified = classified;
        console.warn(`AI Layout warning [${model}, attempt ${attempt}]: ${classified.message}`);

        // Auth / bad-request errors will never succeed on any model — abort now.
        if (!classified.retryable && !classified.tryNextModel) {
          throw new GeminiRequestError(classified);
        }
        // Model unavailable — stop retrying this model, fall back to the next.
        if (classified.tryNextModel && !classified.retryable) {
          break;
        }
        // Transient — back off and retry the same model (unless out of attempts).
        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          const waitMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.log(`Transient error — waiting ${Math.round(waitMs)}ms before retry...`);
          await delay(waitMs);
        }
      }
    }
  }

  throw new GeminiRequestError(
    lastClassified || {
      status: 503,
      message: "Failed to reach Gemini after retrying multiple models.",
      retryable: false,
      tryNextModel: false,
    }
  );
};

// API route to parse CAD blueprint / floor plans
app.post("/api/digitize-blueprint", async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: "Missing base64Data of the blueprint file." });
    }

    const clientKey = req.headers['x-gemini-api-key'] as string;
    const ai = getGeminiClient(clientKey);
    if (!ai) {
      return res.status(503).json({
        error: "Gemini API Key is required. Please provide it in the UI."
      });
    }

    // High quality architectural digitization prompt
    const prompt = `
      You are Architect-7, a senior AI CAD systems engineer. 
      Analyze the attached office/building floor plan blueprint image.
      Detect all rooms, open workspaces, corridors, and functional zones shown.
      Then, map them into standard 3D bounding blocks for our interactive CAD Digital Twin designer.
      
      Grid constraints:
      - The absolute digital twin coordinate workspace goes from X: -18 to +18, and Z: -18 to +18 (meters).
      - The coordinate (0, 0) is the center of the grid.
      - Make sure the detected rooms fit beautifully side-by-side or partitioned without overlapping.
      - Calculate appropriate dimensions (width, depth in meters) and center positions (x, z in meters) for each room.
      - Keep heights standard.
      - Supply a color theme for each room: return a soft light background hex color (color) and a deep high-contrast text color (textColor).
      
      Provide a recommended initial layout of equipment/low-current infrastructure fittings based on the detected layout:
      - Access Points (use type 'ap'): Place them centrally in largest open areas or corridors to ensure 100% Wi-Fi coverage.
      - Data/LAN Points (use type 'dp'): Place near desk spaces.
      - CCTV Cameras (use type 'cctv'): Place in corners or entrance paths.
      - Furniture: e.g. 'desk_single', 'conference_table', 'chair_office' to make it look alive.
      
      Format the output strictly as a JSON object adhering exactly to this schema:
      {
        "rooms": [
          {
            "name": "General Open Workspace",
            "x": -5.0,
            "z": 2.5,
            "width": 10.0,
            "depth": 8.0,
            "areaSqFt": 860,
            "color": "#ecfdf5",
            "textColor": "#065f46"
          }
        ],
        "assets": [
          {
            "type": "ap",
            "name": "High Density AP-01",
            "x": -5.0,
            "z": 2.5,
            "specs": {
              "model": "Aruba AP-535",
              "Frequency": "2.4 / 5 GHz",
              "Power": "PoE+"
            }
          }
        ]
      }
    `;

    // Package the file inline data for Gemini Vision capabilities
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType || "image/png",
      },
    };

    // Query Gemini using our robust multi-attempt retry query wrapper
    const response = await generateLayoutWithRetry(ai, [imagePart, { text: prompt }]);

    const parsedData = JSON.parse(response.text || "{}");
    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error digitizing blueprint:", error?.message || error);
    const status = error instanceof GeminiRequestError ? error.status : 500;
    return res.status(status).json({ error: error?.message || "Failed to parse the floor plan." });
  }
});

// API route to rebuild CAD floor plan from prompt
app.post("/api/rebuild-from-prompt", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided." });
    
    const clientKey = req.headers['x-gemini-api-key'] as string;
    const ai = getGeminiClient(clientKey);
    if (!ai) return res.status(503).json({ error: "Gemini API Key is required. Please provide it in the UI." });

    const instructions = `
      You are Architect-7, an expert AI CAD systems engineer. Create an office
      building layout from this prompt: "${prompt}".

      Grid constraints:
      - The digital twin workspace spans X: -18 to +18 and Z: -18 to +18 (metres),
        with (0, 0) at the centre. Fit rooms side-by-side without overlapping.
      - For each room supply center (x, z), dimensions (width, depth) in metres,
        areaSqFt, a soft light background hex 'color' and a high-contrast 'textColor'.
      - Populate 'assets' with a sensible mix of low-current infrastructure
        (types 'ap', 'dp', 'tp', 'cctv') and furniture (types 'desk_single',
        'conference_table', 'chair_office') positioned inside the rooms.

      Return a JSON object with 'rooms' and 'assets' arrays matching the schema.
    `;

    // Reuse the same retry + schema pipeline as the digitizer so the response is
    // guaranteed to be well-formed for the client mapper.
    const response = await generateLayoutWithRetry(ai, [{ text: instructions }]);

    return res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error rebuilding from prompt:", error?.message || error);
    const status = error instanceof GeminiRequestError ? error.status : 500;
    return res.status(status).json({ error: error?.message || "Failed to rebuild from prompt." });
  }
});

// Lightweight health check for uptime monitors / container orchestrators.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Configure Vite or Static server
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CAD Server successfully running on http://localhost:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error("Failed to boot CAD fullstack, nested error:", err);
});
