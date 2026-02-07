import { test } from '@japa/runner'
import { createAdminUser, createUser } from '../helpers/factories.js'
import { SessionClient, extractCsrfTokenFromForm } from '../helpers/api_client.js'
import {
  beginTransaction,
  rollbackTransaction,
  runMigrationsOnce,
} from '../helpers/test_setup.js'

const loginAs = async (client: SessionClient, email: string, password: string) => {
  const loginPage = await client.get('/login')
  const csrfToken = extractCsrfTokenFromForm(loginPage.text())

  const response = await client.post('/login', {
    form: {
      email,
      password,
      _csrf: csrfToken,
    },
  })

  return response
}

test.group('Auth', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('login page renders', async ({ assert, client }) => {
    const session = new SessionClient(client)
    const response = await session.get('/login')

    assert.equal(response.status(), 200)
    assert.include(response.text(), 'Continue with Discord')
  })

  test('valid login redirects to dashboard', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'admin@example.com',
    })

    const session = new SessionClient(client)
    const response = await loginAs(session, admin.email, 'password')

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')
  })

  test('unauthenticated users are redirected to login', async ({ assert, client }) => {
    const session = new SessionClient(client)
    const response = await session.get('/dashboard')

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/login')
  })

  test('player is redirected away from admin-only routes', async ({ assert, client }) => {
    const player = await createUser({
      email: 'player@example.com',
    })

    const session = new SessionClient(client)
    await loginAs(session, player.email, 'password')
    const response = await session.get('/players/new')

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')
  })
})
