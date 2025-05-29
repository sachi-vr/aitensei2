/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  assetPrefix: "./",
  basePath: "",
  trailingSlash: true,
  publicRuntimeConfig: {
    root: "./",
  },
};

module.exports = nextConfig;
