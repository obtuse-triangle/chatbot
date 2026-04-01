export type PromptConfig = {
  system_prompt: string;
  temperature: number;
  top_p: number;
  top_k: number;
  prompt_v1: string;
  prompt_v2: string;
  canary_weight: number;
  prompt_version?: string;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type JenkinsBuild = {
  number: number;
  status: string;
  logs: string;
};

export type Metrics = {
  faithfulness: number;
  relevance: number;
  commit_id: string;
};

export type Branch = {
  name: string;
  sha: string;
  is_default: boolean;
};
