import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import * as fs from 'node:fs'
import User from '#models/user'
import { createUser } from '../helpers/factories.js'
import { SessionClient } from '../helpers/api_client.js'
import { getCsrfTokenFromAppPage, loginAs } from '../helpers/session.js'
import { beginTransaction, rollbackTransaction, runMigrationsOnce } from '../helpers/test_setup.js'

const validProfilePayload = {
  'fullName': 'Settings Test User',
  'timezone': 'Australia/Sydney',
  'trackerggUsername': '',
  'agents[]': ['jett'],
}

test.group('Settings', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('profile settings form keeps hx-boost disabled for multipart upload', async ({
    assert,
    client,
  }) => {
    const user = await createUser({
      email: 'settings-hx-boost@example.com',
    })
    const session = new SessionClient(client)
    await loginAs(session, user.email, 'password')

    const response = await session.get('/settings/profile')
    assert.equal(response.status(), 200)
    assert.include(response.text(), 'action="/settings/profile?_method=PUT"')
    assert.include(response.text(), 'hx-boost="false"')
    assert.include(response.text(), 'enctype="multipart/form-data"')
  })

  test('settings validation rejects profile update without agents', async ({ assert, client }) => {
    const user = await createUser({
      email: 'settings-validation@example.com',
      fullName: 'Before Validation',
    })
    const session = new SessionClient(client)
    await loginAs(session, user.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/settings/profile')
    const response = await session.put('/settings/profile', {
      headers: {
        'x-csrf-token': csrfToken,
        'referer': '/settings/profile',
      },
      form: {
        fullName: 'After Validation',
        timezone: 'Australia/Sydney',
        trackerggUsername: '',
      },
    })

    assert.equal(response.status(), 302)

    const redirectedForm = await session.get(response.header('location')!)
    assert.equal(redirectedForm.status(), 200)
    assert.include(redirectedForm.text(), 'Please fix the following errors:')
    assert.match(redirectedForm.text(), /agents/i)

    await user.refresh()
    assert.equal(user.fullName, 'Before Validation')
  })

  test('profile logo upload persists new filename', async ({ assert, client }) => {
    const user = await createUser({
      email: 'settings-upload@example.com',
      fullName: 'Uploader',
    })
    const session = new SessionClient(client)
    await loginAs(session, user.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/settings/profile')
    const response = await session.post('/settings/profile?_method=PUT', {
      headers: {
        'x-csrf-token': csrfToken,
      },
      multipart: validProfilePayload,
      files: [
        {
          field: 'logo',
          path: app.makePath('tests/fixtures/logo.png'),
          filename: 'logo.png',
          contentType: 'image/png',
        },
      ],
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), '/settings/profile')

    await user.refresh()
    assert.isNotNull(user.logoFilename)

    const logoPath = app.makePath('storage/uploads/players', user.logoFilename!)
    assert.isTrue(fs.existsSync(logoPath))

    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath)
    }
  })

  test('re-uploading profile logo removes old file', async ({ assert, client }) => {
    const user = await createUser({
      email: 'settings-reupload@example.com',
      fullName: 'Reupload',
    })
    const session = new SessionClient(client)
    await loginAs(session, user.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/settings/profile')
    await session.post('/settings/profile?_method=PUT', {
      headers: {
        'x-csrf-token': csrfToken,
      },
      multipart: validProfilePayload,
      files: [
        {
          field: 'logo',
          path: app.makePath('tests/fixtures/logo.png'),
          filename: 'logo.png',
          contentType: 'image/png',
        },
      ],
    })

    await user.refresh()
    const firstLogoFilename = user.logoFilename
    assert.isNotNull(firstLogoFilename)
    const firstLogoPath = app.makePath('storage/uploads/players', firstLogoFilename!)
    assert.isTrue(fs.existsSync(firstLogoPath))

    const secondCsrf = await getCsrfTokenFromAppPage(session, '/settings/profile')
    const secondResponse = await session.post('/settings/profile?_method=PUT', {
      headers: {
        'x-csrf-token': secondCsrf,
      },
      multipart: validProfilePayload,
      files: [
        {
          field: 'logo',
          path: app.makePath('tests/fixtures/logo2.png'),
          filename: 'logo2.png',
          contentType: 'image/png',
        },
      ],
    })
    assert.equal(secondResponse.status(), 302)
    assert.equal(secondResponse.header('location'), '/settings/profile')

    await user.refresh()
    assert.isNotNull(user.logoFilename)
    assert.notEqual(user.logoFilename, firstLogoFilename)

    const secondLogoPath = app.makePath('storage/uploads/players', user.logoFilename!)
    assert.isFalse(fs.existsSync(firstLogoPath))
    assert.isTrue(fs.existsSync(secondLogoPath))

    if (fs.existsSync(secondLogoPath)) {
      fs.unlinkSync(secondLogoPath)
    }
  })

  test('htmx logo delete returns profile partial and clears filename', async ({
    assert,
    client,
  }) => {
    const user = await createUser({
      email: 'settings-delete-logo@example.com',
      fullName: 'Delete Logo',
    })
    const session = new SessionClient(client)
    await loginAs(session, user.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, '/settings/profile')
    await session.post('/settings/profile?_method=PUT', {
      headers: {
        'x-csrf-token': csrfToken,
      },
      multipart: validProfilePayload,
      files: [
        {
          field: 'logo',
          path: app.makePath('tests/fixtures/logo.png'),
          filename: 'logo.png',
          contentType: 'image/png',
        },
      ],
    })

    await user.refresh()
    const logoFilename = user.logoFilename
    assert.isNotNull(logoFilename)
    const logoPath = app.makePath('storage/uploads/players', logoFilename!)
    assert.isTrue(fs.existsSync(logoPath))

    const deleteCsrf = await getCsrfTokenFromAppPage(session, '/settings/profile')
    const response = await session.delete('/settings/profile/logo', {
      headers: {
        'HX-Request': 'true',
        'x-csrf-token': deleteCsrf,
      },
    })

    assert.equal(response.status(), 200)
    assert.include(response.text(), 'id="user-profile-pic-display"')
    assert.notInclude(response.text(), 'hx-delete="/settings/profile/logo"')

    const reloadedUser = await User.findOrFail(user.id)
    assert.isNull(reloadedUser.logoFilename)
    assert.isFalse(fs.existsSync(logoPath))
  })
})
