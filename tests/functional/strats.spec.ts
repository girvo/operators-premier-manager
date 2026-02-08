import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import * as fs from 'node:fs'
import StratBook from '#models/strat_book'
import StratImage from '#models/strat_image'
import { createAdminUser, createMap } from '../helpers/factories.js'
import { SessionClient } from '../helpers/api_client.js'
import { getCsrfTokenFromAppPage, loginAs } from '../helpers/session.js'
import { beginTransaction, rollbackTransaction, runMigrationsOnce } from '../helpers/test_setup.js'

test.group('Strats', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('strat image upload persists image record and file', async ({ assert, client }) => {
    const admin = await createAdminUser({ email: 'admin-strat-upload@example.com' })
    const map = await createMap({
      name: `Upload Map ${Date.now()}`,
      slug: `ascent-strat-upload-${Date.now()}`,
    })
    const strat = await StratBook.create({
      mapId: map.id,
      title: 'A Site Split',
      description: 'Test strat',
      valoplantUrl: null,
      sortOrder: 1,
    })
    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const csrfToken = await getCsrfTokenFromAppPage(session, `/strats/${map.slug}/${strat.id}/edit`)
    const response = await session.post(`/strats/${map.slug}/${strat.id}/images`, {
      headers: {
        'x-csrf-token': csrfToken,
      },
      files: [
        {
          field: 'image',
          path: app.makePath('tests/fixtures/logo.png'),
          filename: 'strat-upload.png',
          contentType: 'image/png',
        },
      ],
    })

    assert.equal(response.status(), 302)
    assert.equal(response.header('location'), `/strats/${map.slug}/${strat.id}/edit`)

    const image = await StratImage.query().where('stratBookId', strat.id).first()
    assert.isNotNull(image)
    assert.equal(image?.originalName, 'strat-upload.png')

    const uploadedPath = app.makePath('storage/uploads/strats', image!.filename)
    assert.isTrue(fs.existsSync(uploadedPath))

    if (fs.existsSync(uploadedPath)) {
      fs.unlinkSync(uploadedPath)
    }
  })

  test('htmx strat image delete returns empty response and removes file', async ({
    assert,
    client,
  }) => {
    const admin = await createAdminUser({ email: 'admin-strat-delete@example.com' })
    const map = await createMap({
      name: `Delete Map ${Date.now()}`,
      slug: `bind-strat-delete-${Date.now()}`,
    })
    const strat = await StratBook.create({
      mapId: map.id,
      title: 'B Long Exec',
      description: 'Delete path test',
      valoplantUrl: null,
      sortOrder: 1,
    })
    const session = new SessionClient(client)
    await loginAs(session, admin.email, 'password')

    const uploadCsrf = await getCsrfTokenFromAppPage(
      session,
      `/strats/${map.slug}/${strat.id}/edit`
    )
    await session.post(`/strats/${map.slug}/${strat.id}/images`, {
      headers: {
        'x-csrf-token': uploadCsrf,
      },
      files: [
        {
          field: 'image',
          path: app.makePath('tests/fixtures/logo2.png'),
          filename: 'strat-delete.png',
          contentType: 'image/png',
        },
      ],
    })

    const image = await StratImage.query().where('stratBookId', strat.id).firstOrFail()
    const uploadedPath = app.makePath('storage/uploads/strats', image.filename)
    assert.isTrue(fs.existsSync(uploadedPath))

    const deleteCsrf = await getCsrfTokenFromAppPage(
      session,
      `/strats/${map.slug}/${strat.id}/edit`
    )
    const response = await session.delete(`/strat-images/${image.id}`, {
      headers: {
        'HX-Request': 'true',
        'x-csrf-token': deleteCsrf,
      },
    })

    assert.equal(response.status(), 204)
    assert.equal(response.text(), '')

    const deleted = await StratImage.find(image.id)
    assert.isNull(deleted)
    assert.isFalse(fs.existsSync(uploadedPath))
  })
})
