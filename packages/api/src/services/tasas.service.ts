import { eq, and, desc } from 'drizzle-orm';
import { tasasCambio } from '../db/schema';
import type { Database } from '../types';

export interface TasasExternas {
  usd: number;
  eur: number;
  mlc: number;
}

// Rate validation ranges (same as Flask app)
const RATE_RANGES = {
  usd: { min: 300, max: 600 },
  eur: { min: 300, max: 700 },
  mlc: { min: 200, max: 500 },
};

// Fallback ratios when EUR/MLC can't be scraped
const FALLBACK_RATIOS = {
  eur: 1.05, // EUR = USD * 1.05
  mlc: 0.7,  // MLC = USD * 0.70
};

/**
 * Scrape exchange rates from CiberCuba website
 * This is the real implementation matching tasas_externas.py
 */
export async function obtenerTasasCiberCuba(): Promise<TasasExternas | null> {
  try {
    // Fetch the CiberCuba page
    const response = await fetch('https://www.cibercuba.com/noticias/economia', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      console.error('CiberCuba fetch failed:', response.status);
      return null;
    }

    const html = await response.text();

    // Extract rates using regex patterns (same as Flask app)
    // Pattern: "1 USD = XXX CUP" or "Dólar: XXX CUP"
    const usdPatterns = [
      /1\s*USD\s*=?\s*(\d+(?:[.,]\d+)?)\s*CUP/i,
      /dólar[:\s]+(\d+(?:[.,]\d+)?)\s*CUP/i,
      /USD[:\s]+(\d+(?:[.,]\d+)?)/i,
      /tasa.*informal.*(\d{3,})/i,
    ];

    const eurPatterns = [
      /1\s*EUR\s*=?\s*(\d+(?:[.,]\d+)?)\s*CUP/i,
      /euro[:\s]+(\d+(?:[.,]\d+)?)\s*CUP/i,
      /EUR[:\s]+(\d+(?:[.,]\d+)?)/i,
    ];

    const mlcPatterns = [
      /1\s*MLC\s*=?\s*(\d+(?:[.,]\d+)?)\s*CUP/i,
      /MLC[:\s]+(\d+(?:[.,]\d+)?)\s*CUP/i,
      /MLC[:\s]+(\d+(?:[.,]\d+)?)/i,
    ];

    let usd: number | null = null;
    let eur: number | null = null;
    let mlc: number | null = null;

    // Try each pattern for USD
    for (const pattern of usdPatterns) {
      const match = html.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(',', '.'));
        if (value >= RATE_RANGES.usd.min && value <= RATE_RANGES.usd.max) {
          usd = value;
          break;
        }
      }
    }

    // Try each pattern for EUR
    for (const pattern of eurPatterns) {
      const match = html.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(',', '.'));
        if (value >= RATE_RANGES.eur.min && value <= RATE_RANGES.eur.max) {
          eur = value;
          break;
        }
      }
    }

    // Try each pattern for MLC
    for (const pattern of mlcPatterns) {
      const match = html.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(',', '.'));
        if (value >= RATE_RANGES.mlc.min && value <= RATE_RANGES.mlc.max) {
          mlc = value;
          break;
        }
      }
    }

    // If USD not found, return null (can't continue without base rate)
    if (!usd) {
      console.error('Could not extract USD rate from CiberCuba');
      return null;
    }

    // Use fallback ratios if EUR or MLC not found
    if (!eur) {
      eur = Math.round(usd * FALLBACK_RATIOS.eur);
    }
    if (!mlc) {
      mlc = Math.round(usd * FALLBACK_RATIOS.mlc);
    }

    return { usd, eur, mlc };
  } catch (error) {
    console.error('CiberCuba scraping error:', error);
    return null;
  }
}

/**
 * Alternative: Try to get rates from ElToque API
 */
export async function obtenerTasasElToque(jwt?: string): Promise<TasasExternas | null> {
  if (!jwt) return null;

  try {
    const response = await fetch('https://tasas.eltoque.com/v1/trmi', {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as any;

    // ElToque returns rates directly
    const usd = data.USD ? parseFloat(data.USD) : null;
    const eur = data.EUR ? parseFloat(data.EUR) : null;
    const mlc = data.MLC ? parseFloat(data.MLC) : null;

    if (!usd) return null;

    return {
      usd,
      eur: eur || Math.round(usd * FALLBACK_RATIOS.eur),
      mlc: mlc || Math.round(usd * FALLBACK_RATIOS.mlc),
    };
  } catch (error) {
    console.error('ElToque API error:', error);
    return null;
  }
}

/**
 * Get rates from any available source
 */
export async function obtenerTasasExternas(elToqueJwt?: string): Promise<TasasExternas | null> {
  // Try ElToque first (more reliable API)
  let rates = await obtenerTasasElToque(elToqueJwt);
  if (rates) {
    console.log('Rates obtained from ElToque');
    return rates;
  }

  // Fallback to CiberCuba scraping
  rates = await obtenerTasasCiberCuba();
  if (rates) {
    console.log('Rates obtained from CiberCuba');
    return rates;
  }

  console.error('All rate sources failed');
  return null;
}

/**
 * Service class for exchange rate operations
 */
export class TasasService {
  constructor(private db: Database) {}

  /**
   * Get current active rate for a currency pair
   */
  async obtenerTasaActual(
    monedaOrigen: string = 'USD',
    monedaDestino: string = 'CUP'
  ): Promise<number> {
    const [rate] = await this.db
      .select()
      .from(tasasCambio)
      .where(
        and(
          eq(tasasCambio.moneda_origen, monedaOrigen),
          eq(tasasCambio.moneda_destino, monedaDestino),
          eq(tasasCambio.activa, true)
        )
      )
      .orderBy(desc(tasasCambio.fecha_actualizacion))
      .limit(1);

    return rate?.tasa ?? 435; // Default fallback
  }

  /**
   * Get all active rates
   */
  async obtenerTodasLasTasas(): Promise<{ usd: number; eur: number; mlc: number }> {
    const rates = await this.db
      .select()
      .from(tasasCambio)
      .where(eq(tasasCambio.activa, true))
      .orderBy(desc(tasasCambio.fecha_actualizacion));

    const result = { usd: 435, eur: 470, mlc: 300 };

    for (const rate of rates) {
      if (rate.moneda_origen === 'USD' && rate.moneda_destino === 'CUP') {
        result.usd = rate.tasa;
      } else if (rate.moneda_origen === 'EUR' && rate.moneda_destino === 'CUP') {
        result.eur = rate.tasa;
      } else if (rate.moneda_origen === 'MLC' && rate.moneda_destino === 'CUP') {
        result.mlc = rate.tasa;
      }
    }

    return result;
  }

  /**
   * Get recent rate history
   */
  async obtenerHistorial(limit: number = 20) {
    return this.db
      .select()
      .from(tasasCambio)
      .orderBy(desc(tasasCambio.fecha_actualizacion))
      .limit(limit);
  }

  /**
   * Add a new rate (deactivates old ones of same currency)
   */
  async agregarTasa(
    monedaOrigen: string,
    monedaDestino: string,
    tasa: number
  ): Promise<number> {
    // Deactivate old rates of same currency pair
    await this.db
      .update(tasasCambio)
      .set({ activa: false })
      .where(
        and(
          eq(tasasCambio.moneda_origen, monedaOrigen),
          eq(tasasCambio.moneda_destino, monedaDestino)
        )
      );

    // Insert new rate
    const result = await this.db
      .insert(tasasCambio)
      .values({
        moneda_origen: monedaOrigen,
        moneda_destino: monedaDestino,
        tasa,
        activa: true,
      })
      .returning({ id: tasasCambio.id });

    return result[0].id;
  }

  /**
   * Update rates from external source
   */
  async sincronizarTasas(elToqueJwt?: string): Promise<{
    success: boolean;
    rates?: TasasExternas;
    error?: string;
  }> {
    const rates = await obtenerTasasExternas(elToqueJwt);

    if (!rates) {
      return { success: false, error: 'No se pudieron obtener las tasas externas' };
    }

    // Get current rates to check if changed
    const current = await this.obtenerTodasLasTasas();

    // Only update if changed
    if (rates.usd !== current.usd) {
      await this.agregarTasa('USD', 'CUP', rates.usd);
    }
    if (rates.eur !== current.eur) {
      await this.agregarTasa('EUR', 'CUP', rates.eur);
    }
    if (rates.mlc !== current.mlc) {
      await this.agregarTasa('MLC', 'CUP', rates.mlc);
    }

    return { success: true, rates };
  }

  /**
   * Update all rates manually
   */
  async actualizarTodas(usd: number, eur: number, mlc: number): Promise<void> {
    await this.agregarTasa('USD', 'CUP', usd);
    await this.agregarTasa('EUR', 'CUP', eur);
    await this.agregarTasa('MLC', 'CUP', mlc);
  }

  /**
   * Update rates from external source (alias for route compatibility)
   */
  async actualizarDesdeExterno(elToqueJwt?: string): Promise<{
    success: boolean;
    source?: string;
    updated?: string[];
    error?: string;
  }> {
    const result = await this.sincronizarTasas(elToqueJwt);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const updated: string[] = [];
    if (result.rates?.usd) updated.push('USD');
    if (result.rates?.eur) updated.push('EUR');
    if (result.rates?.mlc) updated.push('MLC');

    return {
      success: true,
      source: 'external',
      updated,
    };
  }

  /**
   * Get external rates without saving (preview)
   */
  async obtenerTasasExternas(elToqueJwt?: string): Promise<{
    success: boolean;
    source?: string;
    rates?: TasasExternas;
    error?: string;
  }> {
    const rates = await obtenerTasasExternas(elToqueJwt);

    if (!rates) {
      return { success: false, error: 'No se pudieron obtener las tasas externas' };
    }

    return {
      success: true,
      source: 'external',
      rates,
    };
  }
}
