import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // don't resolve 'fs' module on the client to prevent this error on build --> Error: Can't resolve 'fs'
      config.resolve.fallback = {
        fs: false
      }
    }

    return config
  },
  // Exclude extension and problematic files from build
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src/app', 'src/lib', 'src/components'],
  },
}

export default nextConfig
