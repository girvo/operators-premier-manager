import { test } from '@japa/runner'
import { createAdminUser, createUser } from '../helpers/factories.js'
import { SessionClient } from '../helpers/api_client.js'
import { getCsrfTokenFromAppPage, loginAs, submitLogin } from '../helpers/session.js'
import { beginTransaction, rollbackTransaction, runMigrationsOnce } from '../helpers/test_setup.js'

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
    assert.include(response.text(), 'href="/auth/discord"')
    assert.include(response.text(), 'action="/login"')
    assert.include(response.text(), 'hx-boost="false"')
  })

  test('valid login redirects to dashboard', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'admin@example.com',
    })

    const session = new SessionClient(client)
    const response = await submitLogin(session, admin.email, 'password')

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/dashboard')
  })

  test('invalid login shows an error on the login page', async ({ assert, client }) => {
    await createAdminUser({
      email: 'admin-invalid@example.com',
    })

    const session = new SessionClient(client)
    const loginResponse = await submitLogin(session, 'admin-invalid@example.com', 'wrong-password')

    assert.equal(loginResponse.status(), 302)
    assert.equal(loginResponse.header('location'), '/login')

    const loginPage = await session.get('/login')
    assert.equal(loginPage.status(), 200)
    assert.include(loginPage.text(), 'Invalid email or password')
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

  test('logged-in users are redirected away from login page', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'admin-guest-route@example.com',
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const response = await session.get('/login')
    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/')
  })

  test('user needing onboarding is redirected to onboarding from protected routes', async ({
    assert,
    client,
  }) => {
    const user = await createUser({
      email: 'needs-onboarding@example.com',
      needsOnboarding: true,
      approvalStatus: 'approved',
    })

    const session = new SessionClient(client)
    await loginAs(session, user.email, 'password')

    const response = await session.get('/dashboard')
    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/onboarding')
  })

  test('pending user is redirected to pending approval', async ({ assert, client }) => {
    const user = await createUser({
      email: 'pending-user@example.com',
      needsOnboarding: false,
      approvalStatus: 'pending',
    })

    const session = new SessionClient(client)
    await loginAs(session, user.email, 'password')

    const response = await session.get('/dashboard')
    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/pending-approval')
  })

  test('rejected user is logged out and redirected to login', async ({ assert, client }) => {
    const user = await createUser({
      email: 'rejected-user@example.com',
      needsOnboarding: false,
      approvalStatus: 'rejected',
    })

    const session = new SessionClient(client)
    await loginAs(session, user.email, 'password')

    const rejectedResponse = await session.get('/dashboard')
    assert.equal(rejectedResponse.status(), 302)
    assert.equal(rejectedResponse.header('location'), '/login')

    const nextResponse = await session.get('/dashboard')
    assert.equal(nextResponse.status(), 302)
    assert.equal(nextResponse.header('location'), '/login')
  })

  test('logout clears the session and redirects to login', async ({ assert, client }) => {
    const admin = await createAdminUser({
      email: 'admin-logout@example.com',
    })

    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const dashboardPage = await session.get('/dashboard')
    assert.equal(dashboardPage.status(), 200)
    assert.include(dashboardPage.text(), 'action="/logout"')
    assert.include(dashboardPage.text(), 'hx-boost="false"')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/dashboard')
    const logoutResponse = await session.post('/logout', {
      headers: {
        'x-csrf-token': csrfToken,
      },
    })

    assert.equal(logoutResponse.status(), 302)
    assert.equal(logoutResponse.header('location'), '/login')

    const protectedResponse = await session.get('/dashboard')
    assert.equal(protectedResponse.status(), 302)
    assert.equal(protectedResponse.header('location'), '/login')
  })
})
