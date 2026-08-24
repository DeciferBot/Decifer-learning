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
    // The word-tile dictionary is read with readFileSync from a path the
    // word-list package exports, which Vercel's file tracing cannot follow —
    // without this, the deployed functions 500 with ENOENT on words.txt.
    // Listed for every route that validates or generates words.
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
