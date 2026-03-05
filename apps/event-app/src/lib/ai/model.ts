import { AzureChatOpenAI } from "@langchain/openai";
import { getRequiredEnv } from "@/lib/environment";

let model: AzureChatOpenAI | null = null;
let modelMini: AzureChatOpenAI | null = null;

export function getModel(): AzureChatOpenAI {
  if (model) return model;
  model = new AzureChatOpenAI({
    azureOpenAIEndpoint: getRequiredEnv("AZURE_OPENAI_ENDPOINT"),
    azureOpenAIApiKey: getRequiredEnv("AZURE_OPENAI_API_KEY"),
    azureOpenAIApiVersion:
      process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
    azureOpenAIApiDeploymentName:
      process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1",
    temperature: 0.7,
  });
  return model;
}

export function getModelMini(): AzureChatOpenAI {
  if (modelMini) return modelMini;
  modelMini = new AzureChatOpenAI({
    azureOpenAIEndpoint: getRequiredEnv("AZURE_OPENAI_ENDPOINT"),
    azureOpenAIApiKey: getRequiredEnv("AZURE_OPENAI_API_KEY"),
    azureOpenAIApiVersion:
      process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
    azureOpenAIApiDeploymentName:
      process.env.AZURE_OPENAI_DEPLOYMENT_MINI || "gpt-4.1-mini",
    temperature: 0.7,
  });
  return modelMini;
}
