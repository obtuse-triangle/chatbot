import { load, dump } from "js-yaml";
import { z } from "zod";

import { promptConfigSchema } from "../schemas";
import type { PromptConfig } from "../types";

const yamlDocumentSchema = z
  .object({
    data: z.record(z.unknown()).optional(),
  })
  .passthrough();

const promptConfigYamlSchema = z.object({
  system_prompt: z.string().optional(),
  temperature: z.coerce.number().optional(),
  top_p: z.coerce.number().optional(),
  top_k: z.coerce.number().optional(),
  prompt_v1: z.string().min(1),
  prompt_v2: z.string().min(1),
  canary_weight: z.coerce.number().int().min(0),
});

function readValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

function normalizePrompt(value: string): string {
  return value.endsWith("\n") ? value.slice(0, -1) : value;
}

function toPromptConfig(document: z.infer<typeof yamlDocumentSchema>): PromptConfig {
  const source = document.data ?? document;

  const candidate = promptConfigYamlSchema.parse({
    system_prompt: readValue(source, ["system_prompt"]),
    temperature: readValue(source, ["temperature"]),
    top_p: readValue(source, ["top_p"]),
    top_k: readValue(source, ["top_k"]),
    prompt_v1: readValue(source, ["prompt_v1.txt", "prompt_v1"]),
    prompt_v2: readValue(source, ["prompt_v2.txt", "prompt_v2"]),
    canary_weight: readValue(source, ["canary_weight"]),
  });

  const parsed = promptConfigSchema.parse({
    system_prompt: normalizePrompt(candidate.system_prompt ?? candidate.prompt_v1),
    temperature: candidate.temperature ?? 0,
    top_p: candidate.top_p ?? 1,
    top_k: candidate.top_k ?? 0,
    prompt_v1: normalizePrompt(candidate.prompt_v1),
    prompt_v2: normalizePrompt(candidate.prompt_v2),
    canary_weight: candidate.canary_weight,
  });

  return parsed;
}

export function parsePromptConfig(yaml: string): PromptConfig {
  const loaded = load(yaml);

  if (loaded === null || typeof loaded !== "object" || Array.isArray(loaded)) {
    throw new Error("Prompt config YAML must be an object");
  }

  return toPromptConfig(yamlDocumentSchema.parse(loaded));
}

export function serializePromptConfig(config: PromptConfig): string {
  const document = {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      name: "trustops-prompt-config",
      namespace: "trustops",
    },
    data: {
      system_prompt: config.system_prompt,
      temperature: config.temperature,
      top_p: config.top_p,
      top_k: config.top_k,
      "prompt_v1.txt": config.prompt_v1,
      "prompt_v2.txt": config.prompt_v2,
      canary_weight: String(config.canary_weight),
    },
  };

  return dump(document, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}
