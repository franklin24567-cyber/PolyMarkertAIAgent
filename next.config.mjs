/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  ...(isGithubPages && {
    output: "export",
    basePath: "/PolyMarkertAIAgent",
    images: { unoptimized: true },
  }),
};

export default nextConfig;
