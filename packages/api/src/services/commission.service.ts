import { eq, and } from 'drizzle-orm';
import { comisiones, tasasCambio } from '../db/schema';
import type { Database } from '../types';
import type { Currency } from '@remesitas/shared';

export interface CalculationResult {
  cantidad_usd: number;
  tasa_cambio: number;
  cantidad_cup: number;
  comision: number;
  total_pagar: number;
  moneda: Currency;
}

export class CommissionService {
  constructor(private db: Database) {}

  // Get active commission
  async getActiveCommission(): Promise<{ porcentaje: number; fijo: number } | null> {
    const [commission] = await this.db
      .select()
      .from(comisiones)
      .where(eq(comisiones.activa, true))
      .limit(1);

    if (!commission) return null;

    return {
      porcentaje: commission.porcentaje,
      fijo: commission.monto_fijo,
    };
  }

  // Get exchange rate for currency
  async getExchangeRate(currency: Currency = 'USD'): Promise<number | null> {
    const [rate] = await this.db
      .select()
      .from(tasasCambio)
      .where(and(eq(tasasCambio.moneda_origen, currency), eq(tasasCambio.activa, true)))
      .limit(1);

    return rate?.tasa ?? null;
  }

  // Calculate amounts for a remittance
  async calculate(
    cantidadUsd: number,
    moneda: Currency = 'USD',
    customRate?: number
  ): Promise<CalculationResult | { error: string }> {
    // Get commission
    const commission = await this.getActiveCommission();
    if (!commission) {
      return { error: 'No hay comisión activa configurada' };
    }

    // Get exchange rate
    let tasaCambio = customRate;
    if (!tasaCambio) {
      const rate = await this.getExchangeRate(moneda);
      if (!rate) {
        return { error: `No hay tasa configurada para ${moneda}` };
      }
      tasaCambio = rate;
    }

    // Calculate commission
    const comisionPorcentaje = (cantidadUsd * commission.porcentaje) / 100;
    const comisionTotal = comisionPorcentaje + commission.fijo;

    // Calculate CUP amount
    const cantidadCup = cantidadUsd * tasaCambio;

    // Total to pay (USD + commission)
    const totalPagar = cantidadUsd + comisionTotal;

    return {
      cantidad_usd: cantidadUsd,
      tasa_cambio: tasaCambio,
      cantidad_cup: cantidadCup,
      comision: Math.round(comisionTotal * 100) / 100,
      total_pagar: Math.round(totalPagar * 100) / 100,
      moneda,
    };
  }

  // Calculate for reseller (with custom commission percentage)
  async calculateReseller(
    cantidadUsd: number,
    comisionRevendedor: number,
    moneda: Currency = 'USD',
    customRate?: number
  ): Promise<CalculationResult & { comision_revendedor: number } | { error: string }> {
    const baseResult = await this.calculate(cantidadUsd, moneda, customRate);

    if ('error' in baseResult) {
      return baseResult;
    }

    // Reseller commission is a percentage of the USD amount
    const comisionRevendedorAmount = (cantidadUsd * comisionRevendedor) / 100;

    return {
      ...baseResult,
      comision_revendedor: Math.round(comisionRevendedorAmount * 100) / 100,
    };
  }

  // Calculate delivery amount (what the beneficiary receives)
  async calculateDelivery(
    cantidadUsd: number,
    moneda: Currency = 'USD'
  ): Promise<{ cantidad_cup: number; tasa_cambio: number } | { error: string }> {
    const rate = await this.getExchangeRate(moneda);
    if (!rate) {
      return { error: `No hay tasa configurada para ${moneda}` };
    }

    return {
      cantidad_cup: cantidadUsd * rate,
      tasa_cambio: rate,
    };
  }
}
