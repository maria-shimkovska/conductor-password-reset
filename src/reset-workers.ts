import { worker, TaskHandler, OrkesClients } from '@io-orkes/conductor-javascript';
import type { Task } from '@io-orkes/conductor-javascript';
import crypto from 'crypto';

// Step 1: Invalidate any existing tokens for this email
// (ensures there's never two valid tokens at the same time)
async function invalidateOldTokens(task: Task) {
  const { email } = task.inputData as { email: string };
  // Replace with your real DB call: DELETE FROM tokens WHERE email = ?
  console.log(`[CLEANUP] Cleared old tokens for ${email}`);
  return {
    status: 'COMPLETED' as const,
    outputData: { cleaned: true },
  };
}
worker({ taskDefName: 'invalidate_old_tokens' })(invalidateOldTokens);

// Step 2: Generate a new token and save it to the DB
// This runs exactly once — retries of step 3 reuse this token
async function generateResetToken(task: Task) {
  const { email } = task.inputData as { email: string };
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  // Replace with your real DB write: INSERT INTO tokens ...
  console.log(`[TOKEN] Generated for ${email}: ${token.slice(0, 8)}...`);
  return {
    status: 'COMPLETED' as const,
    outputData: { token, expiresAt, email },
  };
}
worker({ taskDefName: 'generate_reset_token' })(generateResetToken);

// Step 3: Send the reset email with the link
// Receives the token from step 2 — never regenerates it on retry
async function sendResetEmail(task: Task) {
  const { email, token } = task.inputData as { email: string; token: string };

  // Uncomment to simulate an email provider outage and watch Conductor retry:
  // throw new Error('Email provider returned 503 — service unavailable');

  const resetUrl = `https://myapp.com/reset?token=${token}`;
  // Replace with your real email provider: SendGrid, Resend, Postmark, etc.
  console.log(`[EMAIL] Reset link sent to ${email}: ${resetUrl}`);
  return {
    status: 'COMPLETED' as const,
    outputData: { sent: true, resetUrl },
  };
}
worker({ taskDefName: 'send_reset_email', concurrency: 5 })(sendResetEmail);

// Start polling for tasks
// OrkesClients.from() reads CONDUCTOR_SERVER_URL from env (defaults to http://localhost:8080/api)
// CONDUCTOR_AUTH_KEY / CONDUCTOR_AUTH_SECRET warnings are expected for local OSS — auth is not required
export async function startWorkers() {
  const clients = await OrkesClients.from();
  const handler = new TaskHandler({
    client: clients.getClient(),
    scanForDecorated: true,
  });
  await handler.startWorkers();
  console.log('Workers are polling for tasks. Press Ctrl+C to stop.');

  process.on('SIGTERM', async () => {
    await handler.stopWorkers();
    process.exit(0);
  });
}

startWorkers().catch(console.error);
