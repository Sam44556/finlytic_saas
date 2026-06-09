import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://finlytic-saas.vercel.app'
  
  // Define all your routes
  const routes = [
    '',
    '/en',
    '/am',
    '/en/dashboard',
    '/am/dashboard',
    '/en/transactions',
    '/am/transactions',
    '/en/budgets',
    '/am/budgets',
    '/en/goals',
    '/am/goals',
    '/en/reports',
    '/am/reports',
    '/en/assistant',
    '/am/assistant',
    '/en/settings',
    '/am/settings',
    '/en/subscription',
    '/am/subscription',
  ]

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/en' || route === '/am' ? 'weekly' : 'daily',
    priority: route === '' || route === '/en' || route === '/am' ? 1 : 0.8,
  })) as MetadataRoute.Sitemap
}
