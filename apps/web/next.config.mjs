const isPages = process.env.GITHUB_ACTIONS === "true";

// Vercel rebuild marker after correcting the project Framework Preset to Next.js.
/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: isPages,
  images: { unoptimized: isPages },
  ...(isPages
    ? {
        output: "export",
        basePath: "/IMOBILIARIAS",
        assetPrefix: "/IMOBILIARIAS/",
      }
    : {}),
};

export default nextConfig;
