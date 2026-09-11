import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // setupDatabase() reads the schema at request time, so it has to be traced
  // into the serverless bundle.
  outputFileTracingIncludes: { "/api/admin/setup": ["./db/schema.sql"] },
};

export default nextConfig;
