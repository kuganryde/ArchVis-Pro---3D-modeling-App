import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase JSON payload size limit for image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini SDK with recommended AI Studio headers
const getGeminiClient = (clientKey?: string) => {
  const apiKey = clientKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Warning: GEMINI_API_KEY is not set and no client key was provided. AI features might be restricted.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Helper delay function for exponential backoff retries
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Robust function with attempt retries and model fallback
const queryGeminiWithRetry = async (ai: any, imagePart: any, prompt: string) => {
  // We prioritize gemini-3.5-flash, and fall back to gemini-3.1-flash-lite if the first model is unavailable.
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    let attempts = 0;
    while (attempts < 3) {
      try {
        console.log(`AI Digitizer: Querying model ${model} (attempt ${attempts + 1}/3)...`);
        const response = await ai.models.generateContent({
          model,
          contents: [imagePart, { text: prompt }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
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
                      type: { type: Type.STRING, description: "Must be 'ap', 'dp', 'cctv', 'desk_single', 'conference_table', or 'chair_office'" },
                      name: { type: Type.STRING },
                      x: { type: Type.NUMBER },
                      z: { type: Type.NUMBER },
                      specs: {
                        type: Type.OBJECT,
                        description: "Key-value pair specs e.g. Manufacturer, Model, Status",
                      }
                    },
                  },
                }
              }
            }
          }
        });
        
        console.log(`AI Digitizer successfully parsed layout with model ${model}!`);
        return response;
      } catch (error: any) {
        lastError = error;
        console.warn(`AI Digitizer warning: Model ${model} returned error on attempt ${attempts + 1}:`, error.message || error);
        
        attempts++;
        if (attempts < 3) {
          const waitMs = Math.pow(2, attempts) * 1000 + Math.random() * 500;
          console.log(`Waiting ${Math.round(waitMs)}ms to clear transient rate-limit/saturation bounds limit before retry...`);
          await delay(waitMs);
        }
      }
    }
  }
  
  throw lastError || new Error("Failed to reach Gemini API after retrying multiple models.");
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
    const response = await queryGeminiWithRetry(ai, imagePart, prompt);

    const parsedData = JSON.parse(response.text || "{}");
    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error digitizing floorplan error endpoint:", error);
    return res.status(500).json({ error: error.message || "Failed parsing floor plan." });
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
      You are an expert AI Architect. Create a building layout from this prompt: "${prompt}".
      Follow the exact schema as the digitization tool: return a JSON object with 'rooms' and 'assets' arrays.
    `;
    
    // Using a direct call for text as it's less prone to high demand
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: instructions }],
      config: {
        responseMimeType: "application/json",
      }
    });

    return res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Error rebuilding from prompt:", error);
    return res.status(500).json({ error: error.message });
  }
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
