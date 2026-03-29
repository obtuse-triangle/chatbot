import { z } from "zod";

const envSchema = z.object({
  GITHUB_PAT: z.string().min(1),
  GITHUB_OWNER: z.string().min(1),
  GITHUB_REPO: z.string().min(1),
  JENKINS_URL: z.string().url(),
  JENKINS_TOKEN: z.string().min(1),
  JENKINS_JOB: z.string().min(1),
  LLM_ENDPOINT: z.string().url(),
  LANGFUSE_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
