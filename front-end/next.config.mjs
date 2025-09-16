/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ['stellar-social-sdk'],
  webpack: (config, { dev, isServer }) => {
    // Handle Node.js modules that can't be used in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      os: false,
      path: false,
      assert: false,
      url: false,
      util: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
    };

    // Add alias for stellar-social-sdk
    config.resolve.alias = {
      ...config.resolve.alias,
      'stellar-social-sdk': './stellar-social-sdk',
    };

    // Ignore problematic Node.js modules
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        'sodium-native': 'sodium-native',
        'require-addon': 'require-addon',
      });
    }

    // Handle ESM modules
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    // Suppress critical dependency warnings
    const originalWarningsFilter = config.stats?.warningsFilter || [];
    config.stats = {
      ...config.stats,
      warningsFilter: [
        ...originalWarningsFilter,
        // Ignore critical dependency warnings from require-addon
        (warning) => {
          return warning.includes('Critical dependency') &&
                 warning.includes('require-addon');
        }
      ]
    };

    // Alternative approach: ignore warnings at module level
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /node_modules\/require-addon\/.*\.js$/,
      parser: {
        amd: false,
        commonjs: false,
      },
    });


    return config;
  },
}

export default nextConfig
