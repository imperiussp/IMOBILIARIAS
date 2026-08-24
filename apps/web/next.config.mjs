const isPages = process.env.GITHUB_ACTIONS === "true";

const commitSha =
  process.env.COMMIT_REF ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_COMMIT_SHA ||
  "";

const buildSeed =
  process.env.DEPLOY_ID ||
  process.env.BUILD_ID ||
  commitSha ||
  "";

// Vercel rebuild marker after correcting the project Framework Preset to Next.js.
// Production cleanup rebuild: temporary homologation routes removed from main.
// Synchronize Vercel production with the latest hardened main branch.
/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: isPages,
  images: { unoptimized: isPages },
  env: {
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
    NEXT_PUBLIC_BUILD_LABEL: buildSeed ? `netlify-${buildSeed.slice(0, 12)}` : "",
  },
  ...(isPages
    ? {
        output: "export",
        basePath: "/IMOBILIARIAS",
        assetPrefix: "/IMOBILIARIAS/",
      }
    : {}),
};

export default nextConfig;
