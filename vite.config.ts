import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const buildId = `${process.env.npm_package_version ?? '0.0.0'}-${process.env.GITHUB_SHA?.slice(0, 8) ?? Date.now()}`
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const resolvedBase = process.env.BASE_PATH ?? (repositoryName ? `/${repositoryName}/` : '/')

export default defineConfig(({ mode }) => {
  const isNativeBuild = mode === 'native'

  return {
    base: isNativeBuild ? './' : resolvedBase,
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __NATIVE_BUILD__: JSON.stringify(isNativeBuild),
    },
    plugins: [
      react(),
      VitePWA({
        disable: isNativeBuild,
        registerType: 'autoUpdate',
        strategies: 'generateSW',
        filename: 'sw.js',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Lletrimon - Apren a Llegir',
          short_name: 'Lletrimon',
          description: 'Aplicació de lectura per a nens en català',
          lang: 'ca',
          theme_color: '#6366f1',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        },
      }),
    ],
  }
})
