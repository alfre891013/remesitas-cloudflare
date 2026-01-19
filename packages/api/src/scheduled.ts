import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
import { ScraperService } from './services/scraper.service';
import type { Env } from './types';

export async function scheduledHandler(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
) {
  console.log('Scheduled task triggered:', new Date().toISOString());

  const db = drizzle(env.DB, { schema });

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
    console.error('Scheduled task error:', error);
  }
}
