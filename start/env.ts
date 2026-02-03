/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),
  ADMIN_EMAIL: Env.schema.string(),
  ADMIN_PASSWORD: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring Discord OAuth
  |----------------------------------------------------------
  */
  DISCORD_CLIENT_ID: Env.schema.string(),
  DISCORD_CLIENT_SECRET: Env.schema.string(),
  DISCORD_CALLBACK_URL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for Henrik Valorant API
  |----------------------------------------------------------
  */
  HENRIK_API_KEY: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for Discord Webhook Notifications
  |----------------------------------------------------------
  */
  DISCORD_WEBHOOK_URL: Env.schema.string.optional(),
})
