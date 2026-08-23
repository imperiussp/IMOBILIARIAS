const isPages = process.env.GITHUB_ACTIONS === "true";

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
