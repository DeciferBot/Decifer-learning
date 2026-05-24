/* eslint-disable @typescript-eslint/no-var-requires */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
}

module.exports = withPWA(nextConfig)
