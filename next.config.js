const withNextIntl = require('next-intl/plugin')(
  // Specify the path to the request config
  './i18n/request.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
}

module.exports = withNextIntl(nextConfig);
