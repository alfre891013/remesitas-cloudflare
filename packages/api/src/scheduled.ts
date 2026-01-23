import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
import { ScraperService } from './services/scraper.service';
import { createNotificationService } from './services/notificaciones-v2.service';
import type { Env, Database } from './types';

export async function scheduledHandler(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
) {
  console.log('Scheduled task triggered:', new Date().toISOString());

  const db = drizzle(env.DB, { schema }) as Database;

  // Run tasks in parallel
  const tasks: Promise<void>[] = [];

  // Task 1: Update exchange rates
  tasks.push(updateExchangeRates(db, env));

  // Task 2: Process notification retry queue
  tasks.push(processNotificationQueue(db, env));

  // Wait for all tasks to complete
  await Promise.allSettled(tasks);

  console.log('Scheduled tasks completed');
}

/**
 * Update exchange rates from external sources
 */
async function updateExchangeRates(db: Database, env: Env): Promise<void> {
  // Check if auto-update is enabled globally
  const [config] = await db
    .select()
    .from(schema.configuracion)
    .where(eq(schema.configuracion.clave, 'auto_update_tasas'))
    .limit(1);

  if (config?.valor !== 'true') {
    console.log('Auto-update is disabled globally. Skipping rate update.');
    return;
  }

  // Run the scraper
  const scraper = new ScraperService(
    db,
    env.ELTOQUE_JWT,
    env.CAMBIOCUBA_TOKEN,
    env.CACHE
  );

  try {
    const result = await scraper.runUpdate();

    if (result.success) {
      console.log('Rate update successful:', {
        source: result.source,
        updated: result.updated,
      });
    } else {
      console.error('Rate update failed:', result.error);
    }
  } catch (error) {
    console.error('Rate update error:', error);
  }
}

/**
 * Process pending and failed notifications for retry
 */
async function processNotificationQueue(db: Database, env: Env): Promise<void> {
  try {
    const notificationService = createNotificationService(db, env);
    const result = await notificationService.processRetryQueue();

    console.log('Notification queue processed:', {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Notification queue processing error:', error);
  }
}
