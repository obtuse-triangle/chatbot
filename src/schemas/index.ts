import { z } from "zod";

import type {
  Branch,
  ChatMessage,
  JenkinsBuild,
  Metrics,
  PromptConfig,
} from "../types";

export const promptConfigSchema = z.object({
  system_prompt: z.string().min(1),
  temperature: z.coerce.number(),
  top_p: z.coerce.number(),
  top_k: z.coerce.number(),
  prompt_v1: z.string().min(1),
  prompt_v2: z.string().min(1),
  canary_weight: z.coerce.number().int().min(0),
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

export const jenkinsBuildSchema = z.object({
  number: z.number().int().nonnegative(),
  status: z.string().min(1),
  logs: z.string(),
});

export const metricsSchema = z.object({
  faithfulness: z.number(),
  relevance: z.number(),
  commit_id: z.string().min(1),
});

export const branchSchema = z.object({
  name: z.string().min(1),
  sha: z.string().min(1),
  is_default: z.boolean(),
});

export type PromptConfigInput = z.input<typeof promptConfigSchema>;
export type PromptConfigOutput = z.output<typeof promptConfigSchema>;
export type ChatMessageInput = z.input<typeof chatMessageSchema>;
export type ChatMessageOutput = z.output<typeof chatMessageSchema>;
export type JenkinsBuildInput = z.input<typeof jenkinsBuildSchema>;
export type JenkinsBuildOutput = z.output<typeof jenkinsBuildSchema>;
export type MetricsInput = z.input<typeof metricsSchema>;
export type MetricsOutput = z.output<typeof metricsSchema>;
export type BranchInput = z.input<typeof branchSchema>;
export type BranchOutput = z.output<typeof branchSchema>;

export type { Branch, ChatMessage, JenkinsBuild, Metrics, PromptConfig } from "../types";

export const schemas = {
  promptConfigSchema,
  chatMessageSchema,
  jenkinsBuildSchema,
  metricsSchema,
  branchSchema,
} as const;
