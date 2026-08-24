const cpanelExport = process.env.CPANEL_EXPORT === "1";
const isPages = process.env.GITHUB_ACTIONS === "true" && !cpanelExport;
const isStaticExport = isPages || cpanelExport;

const commitSha =
  process.env.COMMIT_REF ||
  process.env.GITHUB_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_COMMIT_SHA ||
  "";

const buildSeed =
  process.env.DEPLOY_ID ||
  process.env.BUILD_ID ||
  commitSha ||
  "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: isStaticExport,
  images: { unoptimized: isStaticExport },
  env: {
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
    NEXT_PUBLIC_BUILD_LABEL: buildSeed ? `${cpanelExport ? "cpanel" : "netlify"}-${buildSeed.slice(0, 12)}` : "",
    NEXT_PUBLIC_ALLOW_INDEXING: "true",
    NEXT_PUBLIC_SITE_URL: "https://imoveis.lenoy.com.br",
  },
  ...(isStaticExport ? { output: "export" } : {}),
  ...(isPages
    ? {
        basePath: "/IMOBILIARIAS",
        assetPrefix: "/IMOBILIARIAS/",
      }
    : {}),
};

export default nextConfig;
