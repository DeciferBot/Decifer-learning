/* eslint-disable @typescript-eslint/no-var-requires */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  swSrc: 'worker.js',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // word-list exports path.join(__dirname, 'words.txt'). Bundled, webpack
    // bakes the BUILD machine's absolute path into that join, so the deployed
    // function looked for /vercel/path0/... and 500'd with ENOENT. External,
    // the package is required from node_modules at runtime with a real
    // __dirname, and file tracing picks up words.txt on its own.
    serverComponentsExternalPackages: ['word-list'],
    // Belt and braces for the same file: ship it with every route that
    // validates or generates words, in case the trace ever misses it.
    outputFileTracingIncludes: {
      '/api/downtime/games/[id]/move': ['./node_modules/word-list/words.txt'],
      '/api/downtime/word-tiles/computer': ['./node_modules/word-list/words.txt'],
    },
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'deciferlearning.com' }],
        destination: 'https://www.deciferlearning.com/:path*',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
