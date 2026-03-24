import { worker, TaskHandler, OrkesClients } from '@io-orkes/conductor-javascript';
import type { Task } from '@io-orkes/conductor-javascript';
import crypto from 'crypto';

class Workers {
  @worker({ taskDefName: 'invalidate_old_tokens' })
  async invalidateOldTokens(task: Task) {
    const { email } = task.inputData as { email: string };
    console.log(`[CLEANUP] Cleared old tokens for ${email}`);
    return { status: 'COMPLETED' as const, outputData: { cleaned: true } };
  }

  @worker({ taskDefName: 'generate_reset_token' })
  async generateResetToken(task: Task) {
    const { email } = task.inputData as { email: string };
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    console.log(`[TOKEN] Generated for ${email}`);
    return { status: 'COMPLETED' as const, outputData: { token, expiresAt, email } };
  }

  @worker({ taskDefName: 'send_reset_email', concurrency: 5 })
  async sendResetEmail(task: Task) {
    const { email, token } = task.inputData as { email: string; token: string };
    const resetUrl = `https://myapp.com/reset?token=${token}`;
    console.log(`[EMAIL] Reset link sent to ${email}`);
    return { status: 'COMPLETED' as const, outputData: { sent: true, resetUrl } };
  }
}

export async function startWorkers() {
  void new Workers(); // triggers the decorators

  const clients = await OrkesClients.from();
  const handler = new TaskHandler({
    client: clients.getClient(),
    scanForDecorated: true,
  });
  await handler.startWorkers();

  process.on('SIGTERM', async () => {
    await handler.stopWorkers();
    process.exit(0);
  });
}

startWorkers();
