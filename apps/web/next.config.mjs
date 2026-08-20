const isPages = process.env.GITHUB_ACTIONS === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isPages ? "/IMOBILIARIAS" : "",
  assetPrefix: isPages ? "/IMOBILIARIAS/" : "",
};

export default nextConfig;
