import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'

let migrated = false

export const runMigrationsOnce = async () => {
  // Process-local guard: this is safe for single-process test runners.
  // If tests run with isolated workers/processes, each worker will run migrations.
  if (migrated) return

  const ace = await app.container.make('ace')
  const command = await ace.exec('migration:run', ['--compact-output'])
  if (command.exitCode) {
    if (command.error) {
      throw command.error
    }
    throw new Error('migration:run failed')
  }

  migrated = true
}

export const beginTransaction = async () => {
  await db.beginGlobalTransaction()
}

export const rollbackTransaction = async () => {
  await db.rollbackGlobalTransaction()
}
