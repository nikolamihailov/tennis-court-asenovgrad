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
      // Court photos uploaded through the admin panel. See src/lib/court-images.ts.
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/courts/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Court photos are posted to a Server Action, whose default limit is 1 MB. This is
      // the 4 MB photo cap plus room for the multipart overhead and the other fields.
      // Vercel's own ceiling for a request body is 4.5 MB, so it cannot go much higher.
      bodySizeLimit: "4.4mb",
    },
  },
};

export default nextConfig;
