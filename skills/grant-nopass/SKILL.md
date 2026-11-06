---
name: grant-nopass
description: MANDATORY gate before any sudo command. Use when a command needs sudo/root privileges, when a sudo command fails or hangs on a password prompt, or when the user says "grant nopass", "enable nopass", "sudo without password", or "trigger polkit". You MUST run the grant-nopass script and verify it succeeded BEFORE running any sudo command. You must NEVER handle the user's password yourself. You must NEVER run sudo without verifying NOPASSWD is active first.
---
> <span style="color:red"><strong>Warning.</strong> This skill lets an agent run commands as root without a password for a short time. Only install it on a machine you control. Anyone who can drive the agent while the grant is active can run root commands. Do not install it on a shared computer. The `grant-nopass` program that writes the sudoers rule is not in this repo. You install that yourself.</span>

# Grant NOPASSWD Sudo

Temporarily enables passwordless sudo so the agent can run root commands.
The agent **never** handles the password. The agent **never** runs `sudo`
without first verifying NOPASSWD is active.

## When to use

- **Before any `sudo` command** that might prompt for a password.
- **When a `sudo` command fails** or hangs waiting for a password.
- **When the user asks** to "grant nopass", "enable nopass", "sudo without
  password", or mentions triggering polkit.

## MANDATORY procedure

Follow this checklist in order. Do not skip steps. Do not improvise.

### Step 1: Verify current state

```bash
if sudo -n true 2>/dev/null; then echo ACTIVE; else echo INACTIVE; fi
```

- `sudo -n true` is the **only** reliable test.
- Do NOT check for sudoers files directly (`[[ -f /etc/sudoers.d/... ]]`).
  That directory is root-only (750) — a non-root user always gets "not found"
  even when the grant is active.
- **If ACTIVE:** skip to Step 3. The grant works. You can run `sudo -n` commands.
- **If INACTIVE:** continue to Step 2.

### Step 2: Activate the grant

Run the script. It handles authentication through secure channels you
cannot access (polkit dialog, terminal prompt, or password file):

```bash
grant-nopass [timeout_minutes]
```

The script tries these authentication methods in order:
1. **Password file** — if the user placed their password in `~/.grant-nopass-password`
2. **pkexec** — polkit GUI dialog (desktop sessions)
3. **pkttyagent** — text-mode polkit prompt in a terminal (no GUI needed)
4. **Terminal emulator** — opens kitty/alacritty/wezterm/ghostty/tilix window

The script will tell you which method succeeded. If all methods fail,
it exits with an error and tells the user how to fix it.

**You must tell the user what happened:**
- If a polkit dialog appeared: "A password dialog appeared on your screen.
  Please enter your password there."
- If a terminal window opened: "A terminal window opened. Please enter your
  password there."
- If the script says to create a password file: tell the user to run:
  `echo 'yourpassword' > ~/.grant-nopass-password && chmod 600 ~/.grant-nopass-password`
  Then re-run `grant-nopass`.

### SSH mode

When running over SSH without a TTY (agent context), the script detects
this and provides special handling:

1. **If password file exists** (`~/.grant-nopass-password`): Uses it normally
2. **If no password file**: Prints clear instructions and exits (doesn't try polkit/terminal methods)

**If the script says "SSH mode detected":**
Tell the user they need to create the password file on the remote machine.
They can do this by:
1. SSHing in with a TTY: `ssh -t user@host`
2. Then running: `echo 'yourpassword' > ~/.grant-nopass-password && chmod 600 ~/.grant-nopass-password`
3. Then re-running: `grant-nopass`

Alternatively, they can SSH in with a TTY and run `grant-nopass` interactively
(it will use polkit/terminal methods instead of the password file).

**Important:** The password file is read once and immediately deleted by the
script. The agent never sees the password.

### Step 3: Verify the grant works

```bash
if sudo -n true 2>/dev/null; then echo "NOPASSWD active"; else echo "FAILED"; fi
```

- **If ACTIVE:** you may now run `sudo -n <command>` for any root commands.
- **If FAILED:** report the failure to the user. Do NOT fall back to
  interactive `sudo` — it will hang.

### Step 4: Run your commands

Use `sudo -n` for every root command:

```bash
sudo -n <your-command>
```

The grant auto-revokes after the timeout (default 15 minutes).

## FORBIDDEN actions

These actions are **never allowed**:

1. **NEVER run `sudo` without `-n` flag.** Interactive sudo prompts will hang
   the agent. Always use `sudo -n`.

2. **NEVER ask the user for their password in chat.** The password must never
   appear in the conversation. The script handles authentication through
   secure channels (polkit, terminal, password file).

3. **NEVER write the password to a file that persists.** The only acceptable
   password file is `~/.grant-nopass-password` which the script reads once
   and immediately deletes.

4. **NEVER skip the verification step.** Always run `sudo -n true` to confirm
   the grant is active before proceeding.

5. **NEVER run `sudo` commands as a fallback when `grant-nopass` fails.**
   If the grant fails, report it and stop. Do not try interactive sudo.

6. **NEVER use `--stdin` or pipe the password.** This mode has been removed.
   It exposed the password to the agent process tree.

## Error handling

If `grant-nopass` fails:

1. Report the error to the user.
2. Tell them the fix (usually: create the password file or run pkttyagent).
3. **Stop.** Do not attempt alternative approaches.

## Notes

- The grant auto-revokes after the timeout via a detached background revoker
  (`setsid`-detached, so it survives terminal close and agent session cleanup).
- The sudoers file is `/etc/sudoers.d/${USER}-nopasswd`.
- While active, conflicting password-required sudoers.d rules are stashed
  to `~/.cache/grant-nopass-stash-${USER}/` and restored on revoke.
- The script detects available terminals (kitty, alacritty, wezterm, ghostty,
  tilix) and uses the first one found.
- Re-running `grant-nopass` extends the timeout (kills old revoker, starts new).
