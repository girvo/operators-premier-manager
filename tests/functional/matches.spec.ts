import { test } from '@japa/runner'
import Match from '#models/match'
import { createAdminUser, createMatch } from '../helpers/factories.js'
import {
  SessionClient,
  extractCsrfTokenFromForm,
  extractCsrfTokenFromMeta,
} from '../helpers/api_client.js'
import {
  beginTransaction,
  rollbackTransaction,
  runMigrationsOnce,
} from '../helpers/test_setup.js'

const loginAdmin = async (client: SessionClient, email: string, password: string) => {
  const loginPage = await client.get('/login')
  const csrfToken = extractCsrfTokenFromForm(loginPage.text())

  await client.post('/login', {
    form: {
      email,
      password,
      _csrf: csrfToken,
    },
  })

  return client
}

const getCsrfTokenFromAppPage = async (client: SessionClient, path: string) => {
  const response = await client.get(path)
  return extractCsrfTokenFromMeta(response.text())
}

test.group('Matches', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('htmx delete removes the match and returns empty response', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-delete@example.com' })
    const match = await createMatch()
    const session = new SessionClient(client)
    await loginAdmin(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.delete(`/matches/${match.id}`, {
      headers: {
        'HX-Request': 'true',
        'x-csrf-token': csrfToken,
      },
    })

    assert.equal(response.status(), 204)
    assert.equal(response.text(), '')

    const deleted = await Match.find(match.id)
    assert.isNull(deleted)
  })

  test('htmx result update returns the status badge', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-result@example.com' })
    const match = await createMatch({
      result: null,
    })
    const session = new SessionClient(client)
    await loginAdmin(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/matches')
    const response = await session.put(`/matches/${match.id}/result`, {
      headers: {
        'HX-Request': 'true',
        'x-csrf-token': csrfToken,
      },
      form: {
        result: 'win',
      },
    })

    assert.equal(response.status(), 200)
    assert.include(response.text(), 'WIN')

    await match.refresh()
    assert.equal(match.result, 'win')
  })
})
