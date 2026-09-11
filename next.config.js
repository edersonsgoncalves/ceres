/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["100.64.0.2"],
  serverActions: {
    bodySizeLimit: "50mb",
  },
};
module.exports = nextConfig;
