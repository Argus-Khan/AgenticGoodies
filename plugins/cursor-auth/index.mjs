// OpenCode 2 does not run a v1 plugin's auth hook, so `opencode auth login`
// never lists Cursor. This file is the v2 plugin: it adds the integration
// (browser sign-in, the flow cursor-agent uses) and wraps Magpie so the
// stored token is what its loader already accepts.
import { createHash, randomBytes, randomUUID } from "node:crypto"

const ID = "cursor"
const API = "https://api2.cursor.sh"
const WEBSITE = "https://cursor.com"
const BROWSER = "browser"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function expiry(tok) {
  const parts = String(tok ?? "").split(".")
  if (parts.length !== 3) return 0
  try {
    const exp = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))?.exp
    return typeof exp === "number" && exp > 0 ? exp * 1000 : 0
  } catch {
    return 0
  }
}

// Same PKCE login cursor-agent does: open the page, poll until the browser
// has signed in. Returns the credential OpenCode stores. Never logs the token.
async function browserLogin() {
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const uuid = randomUUID()
  const url = new URL("/loginDeepControl", WEBSITE)
  url.searchParams.set("challenge", challenge)
  url.searchParams.set("uuid", uuid)
  url.searchParams.set("mode", "login")
  url.searchParams.set("redirectTarget", "cli")
  const headers = { "Content-Type": "application/json" }
  // mode "auto" wants a Promise, not a function. OpenCode does
  // `Promise.resolve(callback).then(...)`, and a function has no `.then`.
  const callback = (async () => {
    let errors = 0
    for (let r = 0; r < 150; r++) {
      const wait = Math.min(1000 * 1.2 ** r, 10_000)
      let res
      try {
        res = await fetch(`${API}/auth/poll?uuid=${uuid}&verifier=${verifier}`, {
          headers,
          signal: AbortSignal.timeout(15_000),
        })
      } catch {
        if (++errors >= 3) throw new Error("couldn't reach Cursor")
        await sleep(wait)
        continue
      }
      if (res.status === 404) {
        errors = 0
        await sleep(wait)
        continue
      }
      if (!res.ok) {
        if (res.status === 403 || ++errors >= 3)
          throw new Error(res.status === 403 ? "Cursor refused the sign-in" : `Cursor's sign-in answered HTTP ${res.status}`)
        await sleep(wait)
        continue
      }
      const j = await res.json().catch(() => null)
      if (!j?.accessToken) throw new Error("Cursor sent back no token")
      return {
        type: "oauth",
        methodID: BROWSER,
        access: j.accessToken,
        refresh: j.refreshToken || "none",
        expires: expiry(j.accessToken) || Date.now() + 30 * 24 * 3600 * 1000,
      }
    }
    throw new Error("the sign-in timed out")
  })()
  return {
    url: url.toString(),
    instructions: "Sign in to Cursor in the browser. This finishes by itself.",
    mode: "auto",
    callback,
  }
}

export default {
  id: "cursor-auth",
  async setup(context) {
    if (!context?.integration?.transform) return

    await context.integration.transform((editor) => {
      editor.update(ID, (integration) => {
        integration.name = "Cursor"
      })
      editor.method.update({
        integrationID: ID,
        method: { id: BROWSER, type: "oauth", label: "Cursor (browser)" },
        authorize: browserLogin,
      })
    })

    // Same registration as cursor-opencode-auth: an `aisdk:` package is
    // loaded as that file and its create* export becomes the client. A
    // normal npm package never reaches that path, which is why the fetch
    // hook never ran.
    if (!context.provider?.transform) return
    const pkg = `aisdk:${new URL("./provider.mjs", import.meta.url).href}`
    await context.provider.transform((editor) => {
      editor.update(ID, (provider) => {
        provider.name = "Cursor"
        provider.package = pkg
        if (provider.activation === "auto") provider.activation = "enabled"
      })
    })
  },
}
