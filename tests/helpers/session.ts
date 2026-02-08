import type { ApiResponse } from '@japa/api-client'
import { SessionClient, extractCsrfTokenFromForm, extractCsrfTokenFromMeta } from './api_client.js'

export const submitLogin = async (
  client: SessionClient,
  email: string,
  password: string
): Promise<ApiResponse> => {
  const loginPage = await client.get('/login')
  const csrfToken = extractCsrfTokenFromForm(loginPage.text())

  return client.post('/login', {
    form: {
      email,
      password,
      _csrf: csrfToken,
    },
  })
}

export const loginAs = async (client: SessionClient, email: string, password: string) => {
  await submitLogin(client, email, password)
  return client
}

export const getCsrfTokenFromAppPage = async (client: SessionClient, path: string) => {
  const response = await client.get(path)
  return extractCsrfTokenFromMeta(response.text())
}
