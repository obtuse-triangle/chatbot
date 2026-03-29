import { describe, expect, it } from "vitest";

import { parsePromptConfig, serializePromptConfig } from "./config";

const sampleYaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: trustops-prompt-config
  namespace: trustops
data:
  canary_weight: "10"
  prompt_v1.txt: |
    first prompt
  prompt_v2.txt: |
    second prompt
`;

describe("config service", () => {
  it("parses valid YAML into a prompt config", () => {
    expect(parsePromptConfig(sampleYaml)).toEqual({
      system_prompt: "first prompt",
      temperature: 0,
      top_p: 1,
      top_k: 0,
      prompt_v1: "first prompt",
      prompt_v2: "second prompt",
      canary_weight: 10,
    });
  });

  it("throws on invalid YAML", () => {
    expect(() => parsePromptConfig("data: [broken")).toThrow();
  });

  it("round-trips prompt config values through YAML", () => {
    const config = {
      system_prompt: "system",
      temperature: 0.2,
      top_p: 0.9,
      top_k: 50,
      prompt_v1: "prompt one",
      prompt_v2: "prompt two",
      canary_weight: 25,
    };

    const serialized = serializePromptConfig(config);
    const parsed = parsePromptConfig(serialized);

    expect(parsed).toEqual(config);
  });

  it("rejects YAML that fails zod validation", () => {
    const invalidYaml = `apiVersion: v1
kind: ConfigMap
data:
  canary_weight: "-1"
  prompt_v1.txt: |
    first prompt
  prompt_v2.txt: |
    second prompt
`;

    expect(() => parsePromptConfig(invalidYaml)).toThrow();
  });
});
