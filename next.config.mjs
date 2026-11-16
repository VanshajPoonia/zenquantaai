/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // pdf-parse loads pdf.js workers and a native canvas at runtime, so Next
  // must ship them as packages instead of bundling them.
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
}

export default nextConfig
