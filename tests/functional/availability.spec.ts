import { test } from '@japa/runner'
import WeeklyAvailability from '#models/weekly_availability'
import { createUser } from '../helpers/factories.js'
import { SessionClient } from '../helpers/api_client.js'
import { getCsrfTokenFromAppPage, loginAs } from '../helpers/session.js'
import { beginTransaction, rollbackTransaction, runMigrationsOnce } from '../helpers/test_setup.js'

test.group('Availability', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('htmx availability update returns toggle button html and persists', async ({
    assert,
    client,
  }) => {
    const user = await createUser({
      email: 'availability-update@example.com',
    })

    const session = new SessionClient(client)
    await loginAs(session, user.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/availability')
    const response = await session.put('/availability', {
      headers: {
        'HX-Request': 'true',
        'x-csrf-token': csrfToken,
      },
      form: {
        dayOfWeek: '1',
        hour: '18',
        isAvailable: 'true',
      },
    })

    assert.equal(response.status(), 200)
    assert.include(response.text(), 'hx-put="/availability"')
    assert.include(response.text(), 'htmx-indicator')
    assert.include(response.text(), '✓')
    assert.notInclude(response.text(), '<!DOCTYPE html>')

    const availability = await WeeklyAvailability.query()
      .where('userId', user.id)
      .where('dayOfWeek', 1)
      .where('hour', 18)
      .first()
    assert.isNotNull(availability)
    assert.equal(Boolean(availability!.isAvailable), true)
  })
})
