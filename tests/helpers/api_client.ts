import type { ApiClient, ApiRequest, ApiResponse } from '@japa/api-client'

type RequestOptions = {
  headers?: Record<string, string>
  form?: Record<string, string>
}

type CookieJar = Record<string, string>

const applyOptions = (request: ApiRequest, options: RequestOptions | undefined) => {
  if (!options) return
  if (options.headers) {
    request.headers(options.headers)
  }
  if (options.form) {
    request.form(options.form)
  }
}

const applyCookies = (request: ApiRequest, jar: CookieJar) => {
  if (Object.keys(jar).length === 0) return
  request.cookies(jar)
}

const updateCookies = (jar: CookieJar, response: ApiResponse) => {
  const cookies = response.cookies()
  for (const cookie of Object.values(cookies)) {
    jar[cookie.name] = cookie.value
  }
}

export class SessionClient {
  #client: ApiClient
  #cookies: CookieJar = {}

  constructor(client: ApiClient) {
    this.#client = client
  }

  async get(path: string, options?: RequestOptions) {
    const request = this.#client.get(path)
    applyCookies(request, this.#cookies)
    applyOptions(request, options)
    const response = await request.send()
    updateCookies(this.#cookies, response)
    return response
  }

  async post(path: string, options?: RequestOptions) {
    const request = this.#client.post(path)
    applyCookies(request, this.#cookies)
    applyOptions(request, options)
    const response = await request.send()
    updateCookies(this.#cookies, response)
    return response
  }

  async put(path: string, options?: RequestOptions) {
    const request = this.#client.put(path)
    applyCookies(request, this.#cookies)
    applyOptions(request, options)
    const response = await request.send()
    updateCookies(this.#cookies, response)
    return response
  }

  async delete(path: string, options?: RequestOptions) {
    const request = this.#client.delete(path)
    applyCookies(request, this.#cookies)
    applyOptions(request, options)
    const response = await request.send()
    updateCookies(this.#cookies, response)
    return response
  }
}

export const extractCsrfTokenFromForm = (html: string): string => {
  const match = html.match(/name=\"_csrf\" value=\"([^\"]+)\"/)
  if (!match) {
    throw new Error('Unable to find CSRF token in form')
  }
  return match[1]
}

export const extractCsrfTokenFromMeta = (html: string): string => {
  const match = html.match(/name=\"csrf-token\" content=\"([^\"]+)\"/)
  if (!match) {
    throw new Error('Unable to find CSRF token meta tag')
  }
  return match[1]
}
