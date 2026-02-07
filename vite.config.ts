import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

const isTest = process.env.NODE_ENV === 'test'
const testHmrPort = 24700 + (process.pid % 500)

export default defineConfig({
  server: isTest
    ? {
        hmr: {
          host: '127.0.0.1',
          port: testHmrPort,
          clientPort: testHmrPort,
        },
      }
    : undefined,
  plugins: [
    adonisjs({
      /**
       * Entrypoints of your application. Each entrypoint will
       * result in a separate bundle.
       */
      entrypoints: ['resources/css/app.css', 'resources/js/app.js'],

      /**
       * Paths to watch and reload the browser on file change
       */
      reload: ['resources/views/**/*.edge'],
    }),
  ],
})
