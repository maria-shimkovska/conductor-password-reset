# Conductor Password Reset Demo

Companion project for **[The Conductor CLI: The Fastest Way to Build and Manage Your Workflows from the Terminal](https://orkes.io)** by Maria Shimkovska.

A password reset workflow built with [Conductor OSS](https://github.com/conductor-oss/conductor) that demonstrates proper step ordering, token reuse on retry, and failure recovery — all from the terminal.

## What this does

Three steps run in a specific order:

1. **Invalidate old tokens** — ensures only one valid token exists at a time
2. **Generate a new token** — runs once; retries of step 3 reuse this token
3. **Send the reset email** — receives the token from step 2's output

## Prerequisites

- Node.js 18+
- Java 21+ (required by the Conductor server)
- [Conductor CLI](https://www.npmjs.com/package/@conductor-oss/conductor-cli)

## Quick start

```bash
# 1. Install the Conductor CLI
npm install -g @conductor-oss/conductor-cli

# 2. Start a local Conductor server (downloads ~100MB JAR on first run)
conductor server start
# Open http://localhost:8080 to see the UI

# 3. Clone this repo and install dependencies
git clone https://github.com/maria-shimkovska/conductor-password-reset.git
cd conductor-password-reset
npm install

# 4. Register the task definitions and workflow
conductor task create definitions/task-definitions.json
conductor workflow create definitions/password_reset.json

# 5. Start the workers (in a separate terminal)
npm start

# 6. Trigger a workflow run
conductor workflow start \
  --workflow password_reset \
  --input '{"email": "you@example.com"}'
```

Open http://localhost:8080 and click into the execution to watch each step complete.

## Try breaking it

Open `src/reset-workers.ts` and uncomment the line in `sendResetEmail`:

```typescript
throw new Error('Email provider returned 503 — service unavailable');
```

Restart the workers and trigger another run. Watch the email step retry and fail. Notice that the token is **not** regenerated on each retry — step 2 ran once and its output is stored.

Retry the failed execution from the CLI (no new workflow started):

```bash
conductor workflow retry <workflow-id>
```

Fix the error, restart workers, and retry again. Conductor picks up from the failed step with the same token.

## Useful CLI commands

```bash
# Search executions
conductor workflow search --workflow password_reset --status COMPLETED
conductor workflow search --workflow password_reset --status FAILED

# Synchronous run (blocks until complete — useful in scripts)
conductor workflow start \
  --workflow password_reset \
  --input '{"email": "you@example.com"}' \
  --sync

# Tag with a correlation ID so you can find it later
conductor workflow start \
  --workflow password_reset \
  --input '{"email": "you@example.com"}' \
  --correlation reset-you-1234

# Pause / resume / restart
conductor workflow pause <workflow-id>
conductor workflow resume <workflow-id>
conductor workflow restart <workflow-id>

# Skip a stuck step and continue
conductor workflow skip-task <workflow-id> email_ref \
  --task-output '{"sent": false, "skipped": true}'

# Bulk retry after an outage
conductor workflow search \
  --workflow password_reset \
  --status FAILED \
  --json 2>/dev/null \
  | jq -r '.[].workflowId' \
  | xargs -I{} conductor workflow retry {}
```

## Use with Orkes Developer Edition

Point the CLI at an [Orkes Developer Edition](https://developer.orkescloud.com/) cluster (free, no credit card) to unlock LLM tasks and for a Cloud hosted developer version. 

```bash
conductor config save --profile orkes-dev
# Server URL:  https://developer.orkescloud.com/api
# Auth key:    your-key
# Auth secret: your-secret
# Server type: Enterprise

# All the same commands work with --profile orkes-dev
conductor --profile orkes-dev workflow create definitions/password_reset.json
conductor --profile orkes-dev workflow start \
  --workflow password_reset \
  --input '{"email": "you@example.com"}'
```

## Project structure

```
conductor-password-reset/
├── src/
│   └── reset-workers.ts       # Three workers with step logic
├── definitions/
│   ├── password_reset.json    # Workflow definition (step order + data wiring)
│   └── task-definitions.json  # Task definitions (retry counts, timeouts)
├── .env.example               # CONDUCTOR_SERVER_URL and auth vars
└── package.json
```
