/**
 * Shared Gemini contract: model list, response schema, prompts and error
 * classification. Imported by both the Express server (server.ts) and the
 * browser-side client (src/utils/gemini.ts) so the two paths behave identically.
 */
// Gemini's Schema `type` values are plain strings (e.g. Type.OBJECT === "OBJECT").
// We use string literals rather than importing the `Type` enum so this module
// carries no static dependency on the (large) @google/genai SDK — the browser
// client can then lazy-load the SDK only when an AI action actually runs.
const Type = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
} as const;

// Candidate models in priority order. gemini-2.5-flash is the primary vision
// model; gemini-2.5-flash-lite is the lighter/cheaper fallback.
export const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

// Structured JSON schema so every layout response matches the client mapper.
export const LAYOUT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ['rooms', 'assets'],
  properties: {
    rooms: {
      type: Type.ARRAY,
      description: 'Extracted architectural rooms fitting the CAD blueprint',
      items: {
        type: Type.OBJECT,
        required: ['name', 'x', 'z', 'width', 'depth', 'areaSqFt', 'color', 'textColor'],
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
      description: 'Suggested initial networking and furniture asset nodes matching scanned spaces',
      items: {
        type: Type.OBJECT,
        required: ['type', 'name', 'x', 'z'],
        properties: {
          type: { type: Type.STRING, description: "e.g. 'ap', 'dp', 'cctv', 'desk_single', 'conference_table', 'chair_office'" },
          name: { type: Type.STRING },
          x: { type: Type.NUMBER },
          z: { type: Type.NUMBER },
          specs: {
            type: Type.OBJECT,
            description: 'Key-value pair specs e.g. Manufacturer, Model, Status',
          },
        },
      },
    },
  },
};

// Prompt used to digitize an uploaded blueprint image into rooms + assets.
export const DIGITIZE_PROMPT = `
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

  Return a JSON object with 'rooms' and 'assets' arrays matching the provided schema.
`;

// Instructions used to generate a layout from a free-text description.
export function buildRebuildInstructions(prompt: string): string {
  return `
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
}

export interface ClassifiedError {
  status: number; // HTTP-ish status to relay to the client
  message: string; // human-friendly, actionable message
  retryable: boolean; // safe to retry the same model
  tryNextModel: boolean; // model unavailable — fall back to another model
}

/**
 * Turn a raw Gemini/SDK error into a clean, actionable result. The SDK throws
 * an ApiError whose `.message` is often a JSON string; we unwrap it so users
 * see "Your API key is invalid" instead of a nested blob, and so we never
 * retry errors that can never succeed (bad key, permission, bad request).
 */
export function classifyGeminiError(error: any): ClassifiedError {
  const rawStatus: number | undefined =
    typeof error?.status === 'number' ? error.status : undefined;

  // Unwrap a nested { error: { code, message, status, details } } payload.
  let inner: any = null;
  try {
    const parsed = typeof error?.message === 'string' ? JSON.parse(error.message) : null;
    inner = parsed?.error ?? parsed;
  } catch {
    inner = null;
  }

  const code: number | undefined = inner?.code ?? rawStatus;
  const reason: string = inner?.status || inner?.details?.[0]?.reason || '';
  const detail: string = inner?.message || error?.message || 'Unknown error contacting Gemini.';

  // Invalid / missing key.
  if (code === 400 && /API_KEY_INVALID|api key not valid/i.test(`${reason} ${detail}`)) {
    return {
      status: 401,
      message:
        'Your Gemini API key is invalid. Open “Set API Key” and paste a valid key from Google AI Studio (it should start with “AIza”).',
      retryable: false,
      tryNextModel: false,
    };
  }
  // Permission / API not enabled / key restrictions.
  if (code === 401 || code === 403) {
    return {
      status: 403,
      message:
        'This Gemini API key was rejected. Make sure the Generative Language API is enabled for the key and that no HTTP-referrer/IP restrictions block it.',
      retryable: false,
      tryNextModel: false,
    };
  }
  // Model not found / not available for this key — worth trying the fallback.
  if (code === 404) {
    return {
      status: 404,
      message: 'The requested Gemini model is not available for this API key.',
      retryable: false,
      tryNextModel: true,
    };
  }
  // Rate limit / quota — transient, safe to retry.
  if (code === 429) {
    return {
      status: 429,
      message: 'Gemini rate limit or quota reached. Please wait a moment and try again.',
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
    message: 'Gemini is temporarily unavailable. Please try again in a moment.',
    retryable: true,
    tryNextModel: true,
  };
}
