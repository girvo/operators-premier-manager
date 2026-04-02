import { test } from '@japa/runner'
import { RateLimiter } from '#services/valorant_api_service'

test.group('RateLimiter', () => {
  test('allows requests under limit without waiting', async ({ assert }) => {
    const limiter = new RateLimiter(5, 1000) // 5 requests per second
    const startTime = Date.now()

    for (let i = 0; i < 5; i++) {
      await limiter.waitForSlot()
    }

    const elapsed = Date.now() - startTime
    assert.isTrue(elapsed < 50, 'Should complete quickly when under limit')
  })

  test('waits when limit is reached', async ({ assert }) => {
    const limiter = new RateLimiter(3, 100) // 3 requests per 100ms - very short window for testing
    const startTime = Date.now()

    // First 3 should be instant
    for (let i = 0; i < 3; i++) {
      await limiter.waitForSlot()
    }

    const afterFirstThree = Date.now() - startTime
    assert.isTrue(afterFirstThree < 20, 'First 3 requests should be instant')

    // 4th request should wait until oldest falls out of window (~100ms)
    await limiter.waitForSlot()

    const elapsed = Date.now() - startTime
    assert.isTrue(elapsed >= 100, 'Should wait when limit reached')
    assert.isTrue(elapsed < 250, 'Should not wait too long')
  })

  test('sliding window expires old requests', async ({ assert }) => {
    const limiter = new RateLimiter(2, 100) // 2 requests per 100ms

    await limiter.waitForSlot()
    await limiter.waitForSlot()

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 150))

    const startTime = Date.now()
    await limiter.waitForSlot()
    const elapsed = Date.now() - startTime

    assert.isTrue(elapsed < 20, 'Should be instant after window expires')
  })

  test('clear resets all recorded requests', async ({ assert }) => {
    const limiter = new RateLimiter(2, 100)

    await limiter.waitForSlot()
    await limiter.waitForSlot()

    limiter.clear()

    const startTime = Date.now()
    await limiter.waitForSlot()
    const elapsed = Date.now() - startTime

    assert.isTrue(elapsed < 20, 'Should be instant after clear')
  })
})
