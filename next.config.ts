import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The Strands SDK ships optional plugins (e.g. an S3-backed context
   * offloader) that import @aws-sdk/client-s3 lazily. We don't use them, but
   * the bundler still tries to resolve the import and fails the build.
   * Keeping the SDK external makes it load through Node at runtime, which is
   * what a server-only agent wants anyway.
   */
  serverExternalPackages: ["@strands-agents/sdk"],
};

export default nextConfig;
