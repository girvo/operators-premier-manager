import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import Match from '#models/match'
import MatchAvailability from '#models/match_availability'
import MatchNotification from '#models/match_notification'
import { createMatch, createUser } from '../helpers/factories.js'
import {
  beginTransaction,
  rollbackTransaction,
  runMigrationsOnce,
  runAceCommand,
} from '../helpers/test_setup.js'

test.group('Prune pending matches command', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('dry-run does not delete any matches', async ({ assert }) => {
    const pastPending = await createMatch({
      scheduledAt: DateTime.now().minus({ days: 2 }),
      opponentName: 'Dry Run Test',
    })

    await runAceCommand('matches:prune-pending', ['--dry-run'])

    // Verify nothing was deleted
    const stillExists = await Match.find(pastPending.id)
    assert.isNotNull(stillExists)
  })

  test('force actually deletes past pending matches', async ({ assert }) => {
    const pastPending = await createMatch({
      scheduledAt: DateTime.now().minus({ days: 2 }),
      opponentName: 'Delete Me',
    })

    await runAceCommand('matches:prune-pending', ['--force'])

    const deleted = await Match.find(pastPending.id)
    assert.isNull(deleted)
  })

  test('related records are cascade deleted', async ({ assert }) => {
    const pastPending = await createMatch({
      scheduledAt: DateTime.now().minus({ days: 2 }),
      opponentName: 'Cascade Test Opponent',
    })
    const user = await createUser({
      email: 'cascade-test@example.com',
    })

    // Create related records
    await MatchAvailability.create({
      matchId: pastPending.id,
      userId: user.id,
      status: 'yes',
    })
    await MatchNotification.create({
      matchId: pastPending.id,
      notificationType: '24h',
      sentAt: DateTime.now(),
    })

    await runAceCommand('matches:prune-pending', ['--force'])

    // Verify match is deleted
    const deleted = await Match.find(pastPending.id)
    assert.isNull(deleted)

    // Verify related records are cascade deleted
    const availDeleted = await MatchAvailability.query().where('matchId', pastPending.id).first()
    assert.isNull(availDeleted)

    const notifDeleted = await MatchNotification.query().where('matchId', pastPending.id).first()
    assert.isNull(notifDeleted)
  })

  test('future pending matches are not deleted', async ({ assert }) => {
    const futurePending = await createMatch({
      scheduledAt: DateTime.now().plus({ days: 5 }),
      opponentName: 'Future Opponent',
    })

    await runAceCommand('matches:prune-pending', ['--force'])

    const stillExists = await Match.find(futurePending.id)
    assert.isNotNull(stillExists)
  })

  test('completed matches (with result) are not deleted', async ({ assert }) => {
    const pastCompleted = await createMatch({
      scheduledAt: DateTime.now().minus({ days: 1 }),
      opponentName: 'Completed Opponent',
      result: 'win',
    })

    await runAceCommand('matches:prune-pending', ['--force'])

    const stillExists = await Match.find(pastCompleted.id)
    assert.isNotNull(stillExists)
  })

  test('dry-run is default behavior', async ({ assert }) => {
    const pastPending = await createMatch({
      scheduledAt: DateTime.now().minus({ days: 1 }),
      opponentName: 'Dry Run Default',
    })

    // Run without --dry-run flag (should default to dry-run)
    await runAceCommand('matches:prune-pending', [])

    // Verify nothing was deleted
    const stillExists = await Match.find(pastPending.id)
    assert.isNotNull(stillExists)
  })

  test('deletes multiple matches in one run', async ({ assert }) => {
    await createMatch({
      scheduledAt: DateTime.now().minus({ days: 1 }),
      opponentName: 'Multi Delete 1',
    })
    await createMatch({
      scheduledAt: DateTime.now().minus({ days: 2 }),
      opponentName: 'Multi Delete 2',
    })
    await createMatch({
      scheduledAt: DateTime.now().minus({ days: 3 }),
      opponentName: 'Multi Delete 3',
    })

    await runAceCommand('matches:prune-pending', ['--force'])

    const remaining = await Match.query()
      .whereNull('result')
      .where('scheduledAt', '<', DateTime.now().toSQL()!)
    assert.lengthOf(remaining, 0)
  })

  test('only deletes past pending matches, not all matches', async ({ assert }) => {
    const pastPending = await createMatch({
      scheduledAt: DateTime.now().minus({ days: 1 }),
      opponentName: 'Past Pending',
    })
    const pastCompleted = await createMatch({
      scheduledAt: DateTime.now().minus({ days: 2 }),
      opponentName: 'Past Completed',
      result: 'loss',
    })
    const futurePending = await createMatch({
      scheduledAt: DateTime.now().plus({ days: 1 }),
      opponentName: 'Future Pending',
    })

    await runAceCommand('matches:prune-pending', ['--force'])

    // Only past pending should be deleted
    assert.isNull(await Match.find(pastPending.id))
    assert.isNotNull(await Match.find(pastCompleted.id))
    assert.isNotNull(await Match.find(futurePending.id))
  })
})

test.group('Prune pending matches command - flags', (group) => {
  group.setup(async () => {
    await runMigrationsOnce()
  })

  group.each.setup(async () => {
    await beginTransaction()
  })

  group.each.teardown(async () => {
    await rollbackTransaction()
  })

  test('--force with --production flag works', async ({ assert }) => {
    const pastPending = await createMatch({
      scheduledAt: DateTime.now().minus({ days: 1 }),
      opponentName: 'Production Force Test',
    })

    await runAceCommand('matches:prune-pending', ['--force', '--production'])

    const deleted = await Match.find(pastPending.id)
    assert.isNull(deleted)
  })
})
