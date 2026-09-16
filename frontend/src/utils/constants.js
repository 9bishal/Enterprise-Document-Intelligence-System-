export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8001/api';

export const MODEL_TIERS = { ECONOMY: 'economy', STANDARD: 'standard', ADVANCED: 'advanced' };

export const TIER_LABELS = {
  [MODEL_TIERS.ECONOMY]: { label: 'Economy', color: '#648F64', bg: 'rgba(100, 143, 100, 0.12)' },
  [MODEL_TIERS.STANDARD]: { label: 'Standard', color: '#6478A0', bg: 'rgba(100, 120, 160, 0.12)' },
  [MODEL_TIERS.ADVANCED]: { label: 'Advanced', color: '#9A7832', bg: 'rgba(154, 120, 50, 0.12)' },
};

export const PROVIDER_MODELS = {
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", tier: MODEL_TIERS.STANDARD },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", tier: MODEL_TIERS.STANDARD },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", tier: MODEL_TIERS.ECONOMY }
  ],
  gemini: [
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", tier: MODEL_TIERS.ECONOMY },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", tier: MODEL_TIERS.ADVANCED }
  ],
  openai: [
    { id: "gpt-4o-mini", name: "GPT-4o Mini", tier: MODEL_TIERS.ECONOMY },
    { id: "gpt-4o", name: "GPT-4o", tier: MODEL_TIERS.ADVANCED }
  ],
  ollama: [
    { id: "llama3", name: "Llama 3", tier: MODEL_TIERS.ECONOMY },
    { id: "mistral", name: "Mistral", tier: MODEL_TIERS.ECONOMY },
    { id: "gemma2", name: "Gemma 2", tier: MODEL_TIERS.ECONOMY }
  ]
};

export function safeLocalStorage() {
  const store = {};
  return {
    getItem(key) {
      if (typeof store[key] !== 'undefined') return store[key];
      try { const v = localStorage.getItem(key); store[key] = v; return v; }
      catch { return null; }
    },
    setItem(key, value) {
      store[key] = value;
      try { localStorage.setItem(key, value); } catch {}
    },
    removeItem(key) {
      delete store[key];
      try { localStorage.removeItem(key); } catch {}
    }
  };
}
