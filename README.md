# AgenticGoodies

Small pieces for OpenCode. MIT licensed.

## Cursor for OpenCode 2

`plugins/cursor-auth` uses a Cursor subscription (Pro, Pro+, Ultra, Teams) as an OpenCode 2 model. Sign in with the browser. A Teams plan does not need an API key.

OpenCode does not talk to Cursor itself. The plugin stores the browser sign-in, then [Magpie's Cursor plugin](https://github.com/magpie-community/plugins) (MIT) runs each chat on the same agent API `cursor-agent` uses. Text, images, and tool calls come back as a normal stream.

### Install

Requires OpenCode 2.2 or newer, and Node 22.

```bash
git clone https://github.com/Argus-Khan/AgenticGoodies.git
cd AgenticGoodies/plugins/cursor-auth
npm install
mkdir -p ~/.config/opencode/plugins
ln -s "$PWD" ~/.config/opencode/plugins/cursor-auth
```

Add the plugin to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugins": ["./plugins/cursor-auth"]
}
```

Restart OpenCode, then:

```bash
opencode auth login
```

Pick **Cursor**, then **Cursor (browser)**, and finish the sign-in in the browser. Select `cursor/auto`.

`auto` is the model this ships with. To add another, list it under `provider.cursor.models` in the same config. Give it `modalities.input` of `["text", "image"]` or OpenCode will drop pasted images.

### Quiet replies

Cursor sometimes thinks for a long time and sends nothing. Magpie closes that run after 60 seconds of silence, or 4 minutes of heartbeats. If some text was already written and no tool was called, this plugin asks Cursor once to continue from where it stopped. A run that wrote nothing still fails.

### Not included

- OpenCode 1. The v1 plugin API is a different shape.
- Account switching. OpenCode keeps one Cursor sign-in.

## Skills

OpenCode skills live in `skills/`, one folder each with a `SKILL.md`. Point `skills.paths` at that folder, or symlink the ones you want into `~/.config/opencode/skills/`.

| Skill | What it does |
| --- | --- |
| `browser-bridge` | Drive a browser for reading and testing pages. Browsepal drives the real browser. An isolated Chrome exposes DevTools. |
| `lesson-creation` | Build voice-narrated lesson pages with quizzes and coding exercises. |

A skill that changes a machine's privileges, such as passwordless sudo, is not in this repo.
