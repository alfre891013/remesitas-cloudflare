import { eq, and, desc } from 'drizzle-orm';
import { tasasCambio } from '../db/schema';
import type { Database } from '../types';

export interface ExternalRates {
  USD?: number;
  EUR?: number;
  MLC?: number;
  CAD?: number;
  MXN?: number;
  BRL?: number;
  ZELLE?: number;
  CLA?: number;
}

export interface FetchResult {
  success: boolean;
  rates?: ExternalRates;
  source?: string;
  error?: string;
}

export class ScraperService {
  constructor(
    private db: Database,
    private elToqueJwt: string,
    private cambioCubaToken: string,
    private cache?: KVNamespace
  ) {}

  // Fetch rates from ElToque API (primary source)
  async fetchElToque(): Promise<FetchResult> {
    try {
      // First, get a fresh token if needed
      let jwt = this.elToqueJwt;

      // If no stored JWT, we might need to request one
      // The token endpoint is at tasas-token.eltoque.com
      // For now, assume JWT is provided via environment

      const response = await fetch('https://tasas.eltoque.com/v1/trmi', {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`ElToque API returned ${response.status}`);
      }

      const data = (await response.json()) as Record<string, string>;

      // ElToque returns rates in a specific format
      // Parse and map to our format
      const rates: ExternalRates = {};

      if (data.USD) rates.USD = parseFloat(data.USD);
      if (data.EUR) rates.EUR = parseFloat(data.EUR);
      if (data.MLC) rates.MLC = parseFloat(data.MLC);
      if (data.CAD) rates.CAD = parseFloat(data.CAD);
      if (data.MXN) rates.MXN = parseFloat(data.MXN);
      if (data.BRL) rates.BRL = parseFloat(data.BRL);
      if (data.ZELLE) rates.ZELLE = parseFloat(data.ZELLE);

      // Handle CLA (Clasica MLC) if available
      if (data.CLA || data.ECU) {
        rates.CLA = parseFloat(data.CLA || data.ECU);
      }

      return {
        success: true,
        rates,
        source: 'eltoque',
      };
    } catch (error) {
      console.error('ElToque fetch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Fetch rates from CambioCuba API (fallback source)
  async fetchCambioCuba(): Promise<FetchResult> {
    try {
      const response = await fetch(
        'https://api.cambiocuba.money/api/v2/x-rates',
        {
          headers: {
            Authorization: `Bearer ${this.cambioCubaToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`CambioCuba API returned ${response.status}`);
      }

      const data = (await response.json()) as {
        rates?: Array<{ currency?: string; code?: string; rate?: string; value?: string; buy?: string }>;
      };

      // Parse CambioCuba response format
      const rates: ExternalRates = {};

      // CambioCuba typically returns array of rate objects
      if (Array.isArray(data.rates || data)) {
        const rateArray = data.rates || (data as unknown as Array<{ currency?: string; code?: string; rate?: string; value?: string; buy?: string }>);
        for (const rate of rateArray) {
          const currency = rate.currency || rate.code;
          const value = rate.rate || rate.value || rate.buy;

          if (currency && value) {
            switch (currency.toUpperCase()) {
              case 'USD':
                rates.USD = parseFloat(value);
                break;
              case 'EUR':
                rates.EUR = parseFloat(value);
                break;
              case 'MLC':
                rates.MLC = parseFloat(value);
                break;
              case 'CAD':
                rates.CAD = parseFloat(value);
                break;
              case 'MXN':
                rates.MXN = parseFloat(value);
                break;
              case 'BRL':
                rates.BRL = parseFloat(value);
                break;
              case 'ZELLE':
                rates.ZELLE = parseFloat(value);
                break;
              case 'CLA':
              case 'ECU':
                rates.CLA = parseFloat(value);
                break;
            }
          }
        }
      }

      return {
        success: true,
        rates,
        source: 'cambiocuba',
      };
    } catch (error) {
      console.error('CambioCuba fetch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Fetch from primary with fallback
  async fetchRates(): Promise<FetchResult> {
    // Try ElToque first
    const elToqueResult = await this.fetchElToque();
    if (elToqueResult.success) {
      return elToqueResult;
    }

    console.log('ElToque failed, trying CambioCuba fallback');

    // Fallback to CambioCuba
    const cambioCubaResult = await this.fetchCambioCuba();
    if (cambioCubaResult.success) {
      return cambioCubaResult;
    }

    return {
      success: false,
      error: `All sources failed. ElToque: ${elToqueResult.error}, CambioCuba: ${cambioCubaResult.error}`,
    };
  }

  // Update rates in database
  async updateRates(
    rates: ExternalRates,
    source: string,
    _userId?: number
  ): Promise<{ updated: string[]; errors: string[] }> {
    const updated: string[] = [];
    const errors: string[] = [];

    // Map currency codes to moneda_origen (what we're converting FROM to CUP)
    const currencyMap: Record<string, string> = {
      USD: 'USD',
      EUR: 'EUR',
      MLC: 'MLC',
      CAD: 'CAD',
      MXN: 'MXN',
      BRL: 'BRL',
      ZELLE: 'ZELLE',
      CLA: 'CLA',
    };

    for (const [currency, rate] of Object.entries(rates)) {
      if (rate === undefined || rate === null || isNaN(rate)) continue;

      const monedaOrigen = currencyMap[currency];
      if (!monedaOrigen) continue;

      try {
        // Get current rate
        const [current] = await this.db
          .select()
          .from(tasasCambio)
          .where(
            and(
              eq(tasasCambio.moneda_origen, monedaOrigen),
              eq(tasasCambio.moneda_destino, 'CUP')
            )
          )
          .limit(1);

        if (!current) {
          // Insert new rate
          await this.db.insert(tasasCambio).values({
            moneda_origen: monedaOrigen,
            moneda_destino: 'CUP',
            tasa: rate,
            activa: true,
            fecha_actualizacion: new Date().toISOString(),
          });
          updated.push(currency);
          continue;
        }

        // Skip if rate hasn't changed significantly
        if (Math.abs(current.tasa - rate) < 0.01) {
          continue;
        }

        // Update rate
        await this.db
          .update(tasasCambio)
          .set({
            tasa: rate,
            fecha_actualizacion: new Date().toISOString(),
          })
          .where(
            and(
              eq(tasasCambio.moneda_origen, monedaOrigen),
              eq(tasasCambio.moneda_destino, 'CUP')
            )
          );

        updated.push(currency);
      } catch (error) {
        console.error(`Error updating ${currency}:`, error);
        errors.push(
          `${currency}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return { updated, errors };
  }

  // Full update cycle: fetch and save
  async runUpdate(userId?: number): Promise<{
    success: boolean;
    source?: string;
    updated?: string[];
    errors?: string[];
    error?: string;
  }> {
    const fetchResult = await this.fetchRates();

    if (!fetchResult.success || !fetchResult.rates) {
      return {
        success: false,
        error: fetchResult.error,
      };
    }

    const updateResult = await this.updateRates(
      fetchResult.rates,
      fetchResult.source!,
      userId
    );

    // Cache the result for quick access
    if (this.cache) {
      await this.cache.put(
        'latest_rates',
        JSON.stringify({
          rates: fetchResult.rates,
          source: fetchResult.source,
          timestamp: new Date().toISOString(),
        }),
        { expirationTtl: 3600 } // 1 hour cache
      );
    }

    return {
      success: true,
      source: fetchResult.source,
      updated: updateResult.updated,
      errors: updateResult.errors.length > 0 ? updateResult.errors : undefined,
    };
  }

  // Get all current rates
  async getCurrentRates(): Promise<
    Record<string, { tasa: number; fecha_actualizacion: string }>
  > {
    const rates = await this.db
      .select()
      .from(tasasCambio)
      .where(eq(tasasCambio.activa, true))
      .orderBy(desc(tasasCambio.fecha_actualizacion));

    const result: Record<
      string,
      { tasa: number; fecha_actualizacion: string }
    > = {};
    for (const rate of rates) {
      result[rate.moneda_origen] = {
        tasa: rate.tasa,
        fecha_actualizacion: rate.fecha_actualizacion,
      };
    }

    return result;
  }
}
