import { AzureOpenAI } from "openai";
import { getRequiredEnv } from "@/lib/environment";

let client: AzureOpenAI | null = null;

export function getAzureOpenAIClient(): AzureOpenAI {
  if (client) return client;
  client = new AzureOpenAI({
    endpoint: getRequiredEnv("AZURE_OPENAI_ENDPOINT"),
    apiKey: getRequiredEnv("AZURE_OPENAI_API_KEY"),
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
  });
  return client;
}

/** Full-capability model — agentic workflows, complex reasoning */
export function getDeploymentName(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1";
}

/** Lighter/faster model — chatbot, insights, simple tool calls */
export function getDeploymentNameMini(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT_MINI || "gpt-4.1-mini";
}
