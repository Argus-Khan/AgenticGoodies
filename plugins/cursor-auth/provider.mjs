// Loaded by the provider package `aisdk:file://...provider.mjs`.
// OpenCode calls createCursor(), then languageModel(id).doStream().
// The request goes to Magpie, which runs it on Cursor's agent API.
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { CursorAuthPlugin } = require("@magpie-community/opencode-cursor-auth")

const hooks = await CursorAuthPlugin({})
const loader = hooks.auth.loader

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

function authOf(token) {
  // A browser sign-in arrives as a JWT. An API key does not.
  return token.split(".").length === 3 ? { type: "oauth", access: token, expires: expiry(token) } : { type: "api", key: token }
}

function textOf(value) {
  if (typeof value === "string") return value
  if (!value) return ""
  if (typeof value.value === "string") return value.value
  try {
    return JSON.stringify(value.value ?? value)
  } catch {
    return ""
  }
}

function dataUrl(part) {
  const media = part.mediaType || "application/octet-stream"
  const raw = part.data ?? part.image
  if (typeof raw === "string") return raw.startsWith("data:") ? raw : `data:${media};base64,${raw}`
  if (raw instanceof Uint8Array) return `data:${media};base64,${Buffer.from(raw).toString("base64")}`
  return ""
}

// OpenCode's v3 prompt -> the chat body Magpie already accepts.
function messagesOf(prompt) {
  const out = []
  for (const message of prompt ?? []) {
    if (message.role === "system") {
      out.push({ role: "system", content: message.content })
      continue
    }
    if (message.role === "user") {
      const content = []
      for (const part of message.content ?? []) {
        if (part.type === "text" && part.text) content.push({ type: "text", text: part.text })
        else if (part.mediaType?.startsWith("image/")) {
          const url = dataUrl(part)
          if (url) content.push({ type: "image_url", image_url: { url } })
        }
      }
      if (content.length) out.push({ role: "user", content })
      continue
    }
    if (message.role === "assistant" || message.role === "tool") {
      const text = []
      const calls = []
      for (const part of message.content ?? []) {
        if (part.type === "text" && part.text) text.push(part.text)
        else if (part.type === "tool-call") {
          calls.push({
            id: part.toolCallId,
            type: "function",
            function: { name: part.toolName, arguments: JSON.stringify(part.input ?? {}) },
          })
        } else if (part.type === "tool-result") {
          out.push({ role: "tool", tool_call_id: part.toolCallId, content: textOf(part.output) })
        }
      }
      if (text.length || calls.length) out.push({ role: "assistant", content: text.join(""), ...(calls.length ? { tool_calls: calls } : {}) })
    }
  }
  return out
}

function toolsOf(tools) {
  return (tools ?? []).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.inputSchema ?? { type: "object", properties: {} },
    },
  }))
}

function model(id, fetch) {
  return {
    specificationVersion: "v3",
    provider: "cursor",
    modelId: id,
    supportedUrls: {},
    async doGenerate(options) {
      const { stream } = await this.doStream(options)
      let text = ""
      const reader = stream.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value.type === "text-delta") text += value.delta
        else if (value.type === "error") throw value.error
      }
      return {
        content: text ? [{ type: "text", text }] : [],
        finishReason: { unified: "stop", raw: "stop" },
        usage: { inputTokens: { total: undefined }, outputTokens: { total: undefined } },
        warnings: [],
      }
    },
    async doStream(options) {
      const wrote = { text: "", calls: 0 }
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (part) => controller.enqueue(part)
          emit({ type: "stream-start", warnings: [] })
          emit({ type: "response-metadata", modelId: id })
          let textId = ""
          let reasoningId = ""
          const take = (block) => {
            const line = block.trim()
            if (!line.startsWith("data:")) return
            const data = line.slice(5).trim()
            if (!data || data === "[DONE]") return
            const json = JSON.parse(data)
            if (json.error?.message) throw new Error(json.error.message)
            const delta = json.choices?.[0]?.delta ?? {}
            if (delta.content) {
              wrote.text += delta.content
              if (!textId) {
                textId = "text-0"
                emit({ type: "text-start", id: textId })
              }
              emit({ type: "text-delta", id: textId, delta: delta.content })
            }
            if (delta.reasoning_content) {
              if (!reasoningId) {
                reasoningId = "reasoning-0"
                emit({ type: "reasoning-start", id: reasoningId })
              }
              emit({ type: "reasoning-delta", id: reasoningId, delta: delta.reasoning_content })
            }
            for (const call of delta.tool_calls ?? []) {
              const callId = call.id
              const name = call.function?.name
              if (!callId || !name) continue
              wrote.calls += 1
              const input = call.function?.arguments
              emit({
                type: "tool-call",
                toolCallId: String(callId),
                toolName: String(name),
                input: typeof input === "string" && input ? input : "{}",
              })
            }
          }
          // Magpie ends a Run Cursor leaves quiet (60s idle, 4min of
          // heartbeats). One continuation, only after some text and no tool
          // call. A quiet run that wrote nothing still fails.
          let continued = false
          const messages = messagesOf(options.prompt)
          try {
            for (;;) {
              const res = await fetch("https://cursor.local/chat/completions", {
                method: "POST",
                body: JSON.stringify({
                  model: id,
                  stream: true,
                  messages,
                  tools: toolsOf(options.tools),
                }),
                signal: options.abortSignal,
              })
              if (!res.ok || !res.body) {
                const detail = await res.text().catch(() => "")
                throw new Error(detail.slice(0, 300) || `Cursor request failed (${res.status})`)
              }
              const incoming = res.body.getReader()
              const decoder = new TextDecoder()
              let carry = ""
              let quiet = null
              try {
                for (;;) {
                  const { done, value } = await incoming.read()
                  if (done) break
                  carry += decoder.decode(value, { stream: true })
                  const blocks = carry.split("\n\n")
                  carry = blocks.pop() ?? ""
                  for (const block of blocks) take(block)
                }
                if (carry.trim()) take(carry)
              } catch (error) {
                if (!/went quiet/i.test(error?.message ?? "")) throw error
                quiet = error
              }
              if (!quiet || continued || !wrote.text || wrote.calls) {
                if (quiet) throw quiet
                break
              }
              continued = true
              messages.push({ role: "assistant", content: wrote.text })
              messages.push({ role: "user", content: [{ type: "text", text: "Continue from where you stopped. Do not repeat what you already wrote." }] })
            }
            if (textId) emit({ type: "text-end", id: textId })
            if (reasoningId) emit({ type: "reasoning-end", id: reasoningId })
            emit({ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: undefined }, outputTokens: { total: undefined } } })
            controller.close()
          } catch (error) {
            controller.enqueue({ type: "error", error })
            controller.close()
          }
        },
      })
      return { stream }
    },
  }
}

export function createCursor(options = {}) {
  const token = typeof options.apiKey === "string" ? options.apiKey : ""
  if (!token) throw new Error("Cursor is not signed in")
  let inner = null
  const ready = loader(async () => authOf(token)).then((loaded) => {
    inner = loaded.fetch
  })
  const fetch = async (url, init) => {
    await ready
    return inner(url, init)
  }
  const languageModel = (id) => model(id, fetch)
  return Object.assign(languageModel, { languageModel, chat: languageModel })
}
