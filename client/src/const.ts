const runtimeConfig = (window as typeof window & {
  __APP_CONFIG__?: {
    GOOGLE_CLIENT_ID?: string;
    LOGIN_API_URL?: string;
    LOGIN_ENABLED?: boolean;
    LLM_PROVIDER?: string;
    OLLAMA_BASE_URL?: string;
    DEFAULT_MODEL?: string;
  };
}).__APP_CONFIG__ || {};

export default {
  GOOGLE_CLIENT_ID: runtimeConfig.GOOGLE_CLIENT_ID || "",
  LOGIN_API_URL: runtimeConfig.LOGIN_API_URL || "",
  LOGIN_ENABLED: Boolean(runtimeConfig.LOGIN_ENABLED),
  LLM_PROVIDER: runtimeConfig.LLM_PROVIDER || "ollama",
  OLLAMA_BASE_URL: runtimeConfig.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1",
  DEFAULT_MODEL: runtimeConfig.DEFAULT_MODEL || "ollama/llama3.1",
};
