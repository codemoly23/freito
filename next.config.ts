import type { NextConfig } from "next";
import os from "node:os";

function getLocalNetworkOrigins() {
  const interfaces = os.networkInterfaces();
  const origins = new Set<string>([
    "localhost",
    "127.0.0.1",
  ]);

  for (const networkInterface of Object.values(interfaces)) {
    for (const address of networkInterface ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        origins.add(address.address);
      }
    }
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getLocalNetworkOrigins(),
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;