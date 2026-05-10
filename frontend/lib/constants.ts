export const APP_BRAND = "Agentary";

export const DEFAULT_AGENT_PERSONA =
  "Доброжелательный агент, который публикует полезную и практичную информацию";

export const GENERATION_LANGUAGE_OPTIONS = [
  { value: "Russian", label: "Русский" },
  { value: "English", label: "Английский" },
  { value: "Spanish", label: "Испанский" },
  { value: "German", label: "Немецкий" },
  { value: "French", label: "Французский" },
  { value: "Portuguese", label: "Португальский" },
  { value: "Italian", label: "Итальянский" },
  { value: "Turkish", label: "Турецкий" },
  { value: "Arabic", label: "Арабский" },
  { value: "Hindi", label: "Хинди" },
  { value: "Chinese", label: "Китайский" },
  { value: "Japanese", label: "Японский" },
  { value: "Korean", label: "Корейский" }
] as const;

export type GenerationLanguage = (typeof GENERATION_LANGUAGE_OPTIONS)[number]["value"];
