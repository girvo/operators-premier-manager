import type { ApiClient, ApiRequest, ApiResponse } from '@japa/api-client'

type UploadFile = {
  field: string
  path: string
  filename?: string
  contentType?: string
}

type RequestOptions = {
  headers?: Record<string, string>
  form?: Record<string, any>
  multipart?: Record<string, any>
  files?: UploadFile[]
  redirects?: number
}

type CookieJar = Record<string, string>

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

const applyOptions = (request: ApiRequest, options: RequestOptions | undefined) => {
  request.redirects(options?.redirects ?? 0)

  if (!options) return

  if (options.headers) {
    request.headers(options.headers)
  }

  if (options.multipart) {
    request.fields(options.multipart)
  } else if (options.form) {
    request.form(options.form)
  }

  if (options.files) {
    for (const file of options.files) {
      request.file(file.field, file.path, {
        filename: file.filename,
        contentType: file.contentType,
      })
    }
  }
}

const applyCookies = (request: ApiRequest, jar: CookieJar) => {
  const cookieValues = Object.values(jar)
  if (cookieValues.length === 0) return
  request.header('cookie', cookieValues.join('; '))
}

const updateCookies = (jar: CookieJar, response: ApiResponse) => {
  const setCookieHeader = response.header('set-cookie')
  if (!setCookieHeader) return

  const setCookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
  for (const cookieString of setCookies) {
    const rawCookie = cookieString.split(';', 1)[0]
    const separatorIndex = rawCookie.indexOf('=')
    if (separatorIndex === -1) continue
    const cookieName = rawCookie.slice(0, separatorIndex)
    jar[cookieName] = rawCookie
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
  const csrfInput = html.match(/<input[^>]*name=['"]_csrf['"][^>]*>/i)?.[0]
  const token = csrfInput?.match(/value=['"]([^'"]+)['"]/i)?.[1]
  if (!token) {
    throw new Error('Unable to find CSRF token in form')
  }
  return decodeHtmlEntities(token)
}

export const extractCsrfTokenFromMeta = (html: string): string => {
  const csrfMeta = html.match(/<meta[^>]*name=['"]csrf-token['"][^>]*>/i)?.[0]
  const token = csrfMeta?.match(/content=['"]([^'"]+)['"]/i)?.[1]
  if (!token) {
    throw new Error('Unable to find CSRF token meta tag')
  }
  return decodeHtmlEntities(token)
}
