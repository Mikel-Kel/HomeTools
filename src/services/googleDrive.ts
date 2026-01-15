let accessToken: string | null = null
let tokenClient: google.accounts.oauth2.TokenClient | null = null
let hasRequestedConsent = false

const CLIENT_ID =
  "713055283393-r9mah7jpvpuutdc7lv280uuufk3v3vhc.apps.googleusercontent.com"

const SCOPES = "https://www.googleapis.com/auth/drive"

export function connectToDrive(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject("Google Identity Services not loaded")
      return
    }

    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp: google.accounts.oauth2.TokenResponse) => {
          if (resp.error) {
            reject(resp.error)
            return
          }
          accessToken = resp.access_token
          resolve()
        },
      })
    }

    const client = tokenClient
    if (!client) {
      reject("Token client not initialized")
      return
    }

    client.requestAccessToken({
      prompt: hasRequestedConsent ? "" : "consent",
    })

    hasRequestedConsent = true
  })
}
async function driveFetch(url: string, options: RequestInit = {}) {
  if (!accessToken) throw new Error("Not authenticated")

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  })
}

/* =========================
   Write file
========================= */
export async function saveJSON(filename: string, content: string) {
  if (!accessToken) throw new Error("Not connected to Drive")

  console.log("Saving to Drive...")

  const metadata = {
    name: filename,
    mimeType: "application/json",
    parents: ["root"],
  }

  const form = new FormData()
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], {
      type: "application/json",
    })
  )
  form.append(
    "file",
    new Blob([content], {
      type: "application/json",
    })
  )

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  )

  const result = await res.json()
  console.log("Response status:", res.status)
  console.log("Drive response:", result)
}

/* =========================
   Read file (first match)
========================= */
export async function loadJSON(filename: string): Promise<string | null> {
  if (!accessToken) throw new Error("Not connected to Drive")

  console.log("Searching file:", filename)

  const search = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${filename}'&fields=files(id,name)`
  ).then((r) => r.json())

  console.log("Search result:", search)

  if (!search.files?.length) {
    console.warn("File not found in Drive")
    return null
  }

  const fileId = search.files[0].id
  console.log("Loading file id:", fileId)

  const content = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  ).then((r) => r.text())

  console.log("File content loaded")

  return content
}