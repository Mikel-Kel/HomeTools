/* Google Identity Services – minimal typing */

declare global {
  interface Window {
    google: any
  }

  namespace google {
    namespace accounts.oauth2 {
      interface TokenResponse {
        access_token: string
        error?: string
      }

      interface TokenClient {
        requestAccessToken(options?: { prompt?: string }): void
      }

      function initTokenClient(config: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
      }): TokenClient
    }
  }
}

export {}