import type { NextConfig } from "next";
import path from "path";

const standalone = process.env.STANDALONE === "true";

const nextConfig: NextConfig = {
  output: standalone ? "standalone" : undefined,
  outputFileTracingRoot: standalone
    ? path.join(__dirname, "../../")
    : undefined,
  transpilePackages: ["common"],
  serverExternalPackages: [
    "pg",
    "@langchain/core",
    "@langchain/langgraph",
    "@langchain/openai",
  ],
};

export default nextConfig;
