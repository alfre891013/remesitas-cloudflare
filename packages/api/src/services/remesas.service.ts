import { eq, and, desc, like, or, sql, gte, lte } from 'drizzle-orm';
import {
  remesas,
  usuarios,
  comisiones,
  movimientosContables,
  movimientosEfectivo,
} from '../db/schema';
import type { Database } from '../types';
import type { Remesa, RemesaInsert, Usuario } from '../db/schema';
import { TasasService } from './tasas.service';

// Constants matching Flask app
const COMISION_USD = 0.05; // 5% for USD delivery
const DESCUENTO_MN = 15;   // 15 CUP discount per USD for MN delivery

export interface CalculoRemesa {
  monto_envio: number;
  monto_entrega: number;
  moneda_entrega: 'CUP' | 'USD';
  tasa_cambio: number;
  comision_porcentaje: number;
  comision_fija: number;
  total_comision: number;
  total_cobrado: number;
}

export interface CalculoRevendedor extends CalculoRemesa {
  comision_plataforma: number;
}

/**
 * Generate unique remittance code
 * Format: REM-{8 hex chars}
 */
function generarCodigo(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `REM-${hex}`;
}

export class RemesasService {
  private tasasService: TasasService;

  constructor(private db: Database) {
    this.tasasService = new TasasService(db);
  }

  /**
   * Calculate remittance amounts (admin/general)
   */
  async calcular(
    monto: number,
    tipoEntrega: 'MN' | 'USD'
  ): Promise<CalculoRemesa> {
    const tasa = await this.tasasService.obtenerTasaActual('USD', 'CUP');

    if (tipoEntrega === 'USD') {
      // USD delivery: 5% commission, deliver USD
      const comision_porcentaje = COMISION_USD * 100;
      const total_comision = monto * COMISION_USD;
      return {
        monto_envio: monto,
        monto_entrega: monto, // Deliver same USD amount
        moneda_entrega: 'USD',
        tasa_cambio: tasa,
        comision_porcentaje,
        comision_fija: 0,
        total_comision,
        total_cobrado: monto + total_comision,
      };
    } else {
      // MN delivery: tasa - 15 CUP discount, deliver CUP
      const tasaAplicada = tasa - DESCUENTO_MN;
      const monto_entrega = monto * tasaAplicada;
      return {
        monto_envio: monto,
        monto_entrega,
        moneda_entrega: 'CUP',
        tasa_cambio: tasaAplicada,
        comision_porcentaje: 0,
        comision_fija: 0,
        total_comision: 0, // Implicit in rate
        total_cobrado: monto,
      };
    }
  }

  /**
   * Calculate for public solicitation
   */
  async calcularPublico(
    monto: number,
    tipoEntrega: 'MN' | 'USD'
  ): Promise<CalculoRemesa> {
    const tasa = await this.tasasService.obtenerTasaActual('USD', 'CUP');

    if (tipoEntrega === 'USD') {
      const comision_porcentaje = COMISION_USD * 100;
      const total_comision = monto * COMISION_USD;
      return {
        monto_envio: monto,
        monto_entrega: monto,
        moneda_entrega: 'USD',
        tasa_cambio: tasa,
        comision_porcentaje,
        comision_fija: 0,
        total_comision,
        total_cobrado: monto + total_comision,
      };
    } else {
      // Public MN: tasa - 15 as discount
      const tasaAplicada = tasa - DESCUENTO_MN;
      const monto_entrega = monto * tasaAplicada;
      return {
        monto_envio: monto,
        monto_entrega,
        moneda_entrega: 'CUP',
        tasa_cambio: tasaAplicada,
        comision_porcentaje: 0,
        comision_fija: 0,
        total_comision: 0,
        total_cobrado: monto,
      };
    }
  }

  /**
   * Calculate for reseller
   */
  async calcularRevendedor(
    monto: number,
    tipoEntrega: 'MN' | 'USD',
    comisionRevendedorPct: number
  ): Promise<CalculoRevendedor> {
    const tasa = await this.tasasService.obtenerTasaActual('USD', 'CUP');

    // Platform commission on monto_envio
    const comision_plataforma = monto * (comisionRevendedorPct / 100);

    if (tipoEntrega === 'USD') {
      return {
        monto_envio: monto,
        monto_entrega: monto,
        moneda_entrega: 'USD',
        tasa_cambio: tasa,
        comision_porcentaje: 0,
        comision_fija: 0,
        total_comision: 0,
        total_cobrado: monto,
        comision_plataforma,
      };
    } else {
      const monto_entrega = monto * tasa;
      return {
        monto_envio: monto,
        monto_entrega,
        moneda_entrega: 'CUP',
        tasa_cambio: tasa,
        comision_porcentaje: 0,
        comision_fija: 0,
        total_comision: 0,
        total_cobrado: monto,
        comision_plataforma,
      };
    }
  }

  /**
   * Create new remittance
   */
  async crear(
    data: Omit<RemesaInsert, 'codigo' | 'creado_por'>,
    userId: number
  ): Promise<Remesa> {
    // Generate unique code
    let codigo: string;
    let attempts = 0;
    do {
      codigo = generarCodigo();
      const [existing] = await this.db
        .select({ id: remesas.id })
        .from(remesas)
        .where(eq(remesas.codigo, codigo))
        .limit(1);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    // Insert remittance
    const [result] = await this.db
      .insert(remesas)
      .values({
        ...data,
        codigo,
        creado_por: userId,
      })
      .returning();

    // Create accounting movement for commission (if any)
    if (data.total_comision && data.total_comision > 0) {
      await this.db.insert(movimientosContables).values({
        tipo: 'ingreso',
        concepto: `Comisión remesa ${codigo}`,
        monto: data.total_comision,
        remesa_id: result.id,
        usuario_id: userId,
      });
    }

    return result;
  }

  /**
   * Get remittance by ID
   */
  async obtenerPorId(id: number): Promise<Remesa | null> {
    const [result] = await this.db
      .select()
      .from(remesas)
      .where(eq(remesas.id, id))
      .limit(1);
    return result || null;
  }

  /**
   * Get remittance by code
   */
  async obtenerPorCodigo(codigo: string): Promise<Remesa | null> {
    const [result] = await this.db
      .select()
      .from(remesas)
      .where(eq(remesas.codigo, codigo.toUpperCase()))
      .limit(1);
    return result || null;
  }

  /**
   * List remittances with filters
   */
  async listar(filters: {
    estado?: string;
    facturada?: boolean;
    buscar?: string;
    repartidorId?: number;
    revendedorId?: number;
    fechaInicio?: string;
    fechaFin?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];

    if (filters.estado) {
      conditions.push(eq(remesas.estado, filters.estado as any));
    }
    if (filters.facturada !== undefined) {
      conditions.push(eq(remesas.facturada, filters.facturada));
    }
    if (filters.buscar) {
      conditions.push(
        or(
          like(remesas.codigo, `%${filters.buscar}%`),
          like(remesas.remitente_nombre, `%${filters.buscar}%`),
          like(remesas.beneficiario_nombre, `%${filters.buscar}%`)
        )
      );
    }
    if (filters.repartidorId) {
      conditions.push(eq(remesas.repartidor_id, filters.repartidorId));
    }
    if (filters.revendedorId) {
      conditions.push(eq(remesas.revendedor_id, filters.revendedorId));
    }
    if (filters.fechaInicio) {
      conditions.push(gte(remesas.fecha_creacion, filters.fechaInicio));
    }
    if (filters.fechaFin) {
      conditions.push(lte(remesas.fecha_creacion, filters.fechaFin));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(remesas)
        .where(where)
        .orderBy(desc(remesas.fecha_creacion))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(remesas)
        .where(where),
    ]);

    return {
      items,
      total: countResult[0]?.count || 0,
    };
  }

  /**
   * Assign remittance to distributor
   */
  async asignar(
    id: number,
    repartidorId: number,
    adminId: number
  ): Promise<Remesa | null> {
    const remesa = await this.obtenerPorId(id);
    if (!remesa) return null;

    // Verify distributor exists and is active
    const [repartidor] = await this.db
      .select()
      .from(usuarios)
      .where(
        and(
          eq(usuarios.id, repartidorId),
          eq(usuarios.rol, 'repartidor'),
          eq(usuarios.activo, true)
        )
      )
      .limit(1);

    if (!repartidor) return null;

    // Update remittance
    const [updated] = await this.db
      .update(remesas)
      .set({
        repartidor_id: repartidorId,
        estado: 'en_proceso',
      })
      .where(eq(remesas.id, id))
      .returning();

    return updated;
  }

  /**
   * Mark remittance as delivered
   */
  async entregar(
    id: number,
    repartidorId: number,
    notas?: string,
    fotoEntrega?: string
  ): Promise<Remesa | null> {
    const remesa = await this.obtenerPorId(id);
    if (!remesa) return null;
    if (remesa.estado !== 'en_proceso') return null;
    if (remesa.repartidor_id !== repartidorId) return null;

    // Get distributor current balance
    const [repartidor] = await this.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, repartidorId))
      .limit(1);

    if (!repartidor) return null;

    const moneda = remesa.moneda_entrega;
    const saldoAnterior =
      moneda === 'USD' ? repartidor.saldo_usd : repartidor.saldo_cup;
    const saldoNuevo = saldoAnterior - remesa.monto_entrega;

    // Update remittance
    const [updated] = await this.db
      .update(remesas)
      .set({
        estado: 'entregada',
        fecha_entrega: new Date().toISOString(),
        notas: notas || remesa.notas,
        foto_entrega: fotoEntrega || remesa.foto_entrega,
      })
      .where(eq(remesas.id, id))
      .returning();

    // Create cash movement
    await this.db.insert(movimientosEfectivo).values({
      repartidor_id: repartidorId,
      tipo: 'entrega',
      moneda: moneda,
      monto: remesa.monto_entrega,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo,
      remesa_id: id,
      notas: `Entrega remesa ${remesa.codigo}`,
      registrado_por: repartidorId,
    });

    // Update distributor balance
    if (moneda === 'USD') {
      await this.db
        .update(usuarios)
        .set({ saldo_usd: saldoNuevo })
        .where(eq(usuarios.id, repartidorId));
    } else {
      await this.db
        .update(usuarios)
        .set({ saldo_cup: saldoNuevo })
        .where(eq(usuarios.id, repartidorId));
    }

    return updated;
  }

  /**
   * Mark as billed/paid
   */
  async facturar(id: number): Promise<Remesa | null> {
    const [updated] = await this.db
      .update(remesas)
      .set({
        facturada: true,
        fecha_facturacion: new Date().toISOString(),
      })
      .where(eq(remesas.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Unmark as billed
   */
  async desfacturar(id: number): Promise<Remesa | null> {
    const [updated] = await this.db
      .update(remesas)
      .set({
        facturada: false,
        fecha_facturacion: null,
      })
      .where(eq(remesas.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Approve public solicitation
   */
  async aprobar(id: number): Promise<Remesa | null> {
    const [updated] = await this.db
      .update(remesas)
      .set({
        estado: 'pendiente',
        es_solicitud: false,
        fecha_aprobacion: new Date().toISOString(),
      })
      .where(
        and(eq(remesas.id, id), eq(remesas.estado, 'solicitud'))
      )
      .returning();

    return updated || null;
  }

  /**
   * Reject/cancel remittance
   */
  async cancelar(id: number): Promise<Remesa | null> {
    const [updated] = await this.db
      .update(remesas)
      .set({ estado: 'cancelada' })
      .where(eq(remesas.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Delete remittance (only if no delivery)
   */
  async eliminar(id: number): Promise<boolean> {
    const remesa = await this.obtenerPorId(id);
    if (!remesa) return false;
    if (remesa.estado === 'entregada' || remesa.estado === 'facturada') {
      return false;
    }

    // Delete related accounting movements
    await this.db
      .delete(movimientosContables)
      .where(eq(movimientosContables.remesa_id, id));

    // Delete remittance
    await this.db.delete(remesas).where(eq(remesas.id, id));

    return true;
  }

  /**
   * Get autocomplete suggestions for remitters
   */
  async buscarRemitentes(query: string, limit: number = 10) {
    return this.db
      .selectDistinct({
        nombre: remesas.remitente_nombre,
        telefono: remesas.remitente_telefono,
      })
      .from(remesas)
      .where(
        or(
          like(remesas.remitente_nombre, `%${query}%`),
          like(remesas.remitente_telefono, `%${query}%`)
        )
      )
      .orderBy(desc(remesas.fecha_creacion))
      .limit(limit);
  }

  /**
   * Get autocomplete suggestions for beneficiaries
   */
  async buscarBeneficiarios(query: string, limit: number = 10) {
    return this.db
      .selectDistinct({
        nombre: remesas.beneficiario_nombre,
        telefono: remesas.beneficiario_telefono,
        direccion: remesas.beneficiario_direccion,
      })
      .from(remesas)
      .where(
        or(
          like(remesas.beneficiario_nombre, `%${query}%`),
          like(remesas.beneficiario_telefono, `%${query}%`)
        )
      )
      .orderBy(desc(remesas.fecha_creacion))
      .limit(limit);
  }

  /**
   * List recent unique remitters
   */
  async listarRemitentes(limit: number = 20) {
    return this.db
      .selectDistinct({
        nombre: remesas.remitente_nombre,
        telefono: remesas.remitente_telefono,
      })
      .from(remesas)
      .orderBy(desc(remesas.fecha_creacion))
      .limit(limit);
  }

  /**
   * List recent unique beneficiaries
   */
  async listarBeneficiarios(limit: number = 20) {
    return this.db
      .selectDistinct({
        nombre: remesas.beneficiario_nombre,
        telefono: remesas.beneficiario_telefono,
        direccion: remesas.beneficiario_direccion,
      })
      .from(remesas)
      .orderBy(desc(remesas.fecha_creacion))
      .limit(limit);
  }

  /**
   * Get remittances by remitter phone
   */
  async obtenerPorTelefonoRemitente(telefono: string, limit: number = 10) {
    // Clean phone - get last 10 digits
    const cleaned = telefono.replace(/\D/g, '').slice(-10);

    return this.db
      .select()
      .from(remesas)
      .where(like(remesas.remitente_telefono, `%${cleaned}%`))
      .orderBy(desc(remesas.fecha_creacion))
      .limit(limit);
  }
}
