import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Google serves profile pictures from lh3.googleusercontent.com. next/image refuses
    // any remote host that is not listed here, which is the point — an open image
    // optimiser would let anyone route arbitrary images through this domain.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
