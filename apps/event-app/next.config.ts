import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["common"],
  serverExternalPackages: [
    "pg",
    "@langchain/core",
    "@langchain/langgraph",
    "@langchain/openai",
  ],
};

export default nextConfig;
