/**
 * PDF Generation Service for Remesitas
 *
 * Generates HTML templates for receipts, invoices, and reports
 * that can be converted to PDF client-side or via external service.
 * Stores generated documents in R2.
 */

import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import type { Database } from '../types';
import * as schema from '../db/schema';

// Company information for invoices/receipts
export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo?: string;
}

// Default company info (can be overridden from configuration)
const DEFAULT_COMPANY: CompanyInfo = {
  name: 'Remesitas',
  address: 'Miami, FL, USA',
  phone: '+1 (305) 555-0100',
  email: 'soporte@remesitas.com',
  website: 'www.remesitas.com',
};

// Invoice/Receipt line item
export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Receipt data
export interface ReceiptData {
  remesa: {
    codigo: string;
    fecha_creacion: string;
    fecha_entrega?: string | null;
    remitente_nombre: string;
    remitente_telefono: string;
    beneficiario_nombre: string;
    beneficiario_telefono: string;
    beneficiario_direccion: string;
    monto_envio: number;
    tasa_cambio: number;
    monto_entrega: number;
    moneda_entrega: string;
    tipo_entrega: string;
    total_comision: number;
    total_cobrado: number;
    notas?: string | null;
    estado: string;
    repartidor_nombre?: string;
  };
  company: CompanyInfo;
}

// Invoice data
export interface InvoiceData {
  numero: string;
  fecha_emision: string;
  fecha_vencimiento?: string | null;
  cliente: {
    nombre: string;
    telefono?: string | null;
    direccion?: string;
  };
  lineas: LineItem[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  moneda: string;
  notas?: string | null;
  condiciones?: string | null;
  company: CompanyInfo;
}

// Report data
export interface ReportData {
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string;
  generado_por: string;
  generado_en: string;
  resumen: {
    total_remesas: number;
    total_usd: number;
    total_cup: number;
    comisiones: number;
  };
  detalle: Array<{
    codigo: string;
    fecha: string;
    remitente: string;
    beneficiario: string;
    monto_usd: number;
    monto_entrega: number;
    moneda: string;
    estado: string;
    comision: number;
  }>;
  company: CompanyInfo;
}

/**
 * PDF Service for generating receipts, invoices, and reports
 */
export class PDFService {
  constructor(
    private db: Database,
    private storage?: R2Bucket
  ) {}

  /**
   * Get company information from database or use defaults
   */
  async getCompanyInfo(): Promise<CompanyInfo> {
    try {
      const configs = await this.db
        .select()
        .from(schema.configuracion)
        .where(
          sql`${schema.configuracion.clave} IN ('company_name', 'company_address', 'company_phone', 'company_email', 'company_website', 'company_logo')`
        );

      const configMap: Record<string, string> = {};
      configs.forEach((c) => {
        configMap[c.clave] = c.valor;
      });

      return {
        name: configMap['company_name'] || DEFAULT_COMPANY.name,
        address: configMap['company_address'] || DEFAULT_COMPANY.address,
        phone: configMap['company_phone'] || DEFAULT_COMPANY.phone,
        email: configMap['company_email'] || DEFAULT_COMPANY.email,
        website: configMap['company_website'] || DEFAULT_COMPANY.website,
        logo: configMap['company_logo'],
      };
    } catch {
      return DEFAULT_COMPANY;
    }
  }

  /**
   * Generate HTML for delivery receipt
   */
  async generateReceiptHTML(remesaId: number): Promise<string> {
    // Get remesa data
    const [remesa] = await this.db
      .select()
      .from(schema.remesas)
      .where(eq(schema.remesas.id, remesaId))
      .limit(1);

    if (!remesa) {
      throw new Error('Remesa no encontrada');
    }

    // Get repartidor name if assigned
    let repartidorNombre = '';
    if (remesa.repartidor_id) {
      const [repartidor] = await this.db
        .select({ nombre: schema.usuarios.nombre })
        .from(schema.usuarios)
        .where(eq(schema.usuarios.id, remesa.repartidor_id))
        .limit(1);
      repartidorNombre = repartidor?.nombre || '';
    }

    const company = await this.getCompanyInfo();

    const data: ReceiptData = {
      remesa: {
        codigo: remesa.codigo,
        fecha_creacion: remesa.fecha_creacion,
        fecha_entrega: remesa.fecha_entrega,
        remitente_nombre: remesa.remitente_nombre,
        remitente_telefono: remesa.remitente_telefono,
        beneficiario_nombre: remesa.beneficiario_nombre,
        beneficiario_telefono: remesa.beneficiario_telefono,
        beneficiario_direccion: remesa.beneficiario_direccion,
        monto_envio: remesa.monto_envio,
        tasa_cambio: remesa.tasa_cambio,
        monto_entrega: remesa.monto_entrega,
        moneda_entrega: remesa.moneda_entrega,
        tipo_entrega: remesa.tipo_entrega,
        total_comision: remesa.total_comision,
        total_cobrado: remesa.total_cobrado,
        notas: remesa.notas,
        estado: remesa.estado,
        repartidor_nombre: repartidorNombre,
      },
      company,
    };

    return this.renderReceiptTemplate(data);
  }

  /**
   * Generate HTML for invoice
   */
  async generateInvoiceHTML(facturaId: number): Promise<string> {
    // Get factura data
    const [factura] = await this.db
      .select()
      .from(schema.facturas)
      .where(eq(schema.facturas.id, facturaId))
      .limit(1);

    if (!factura) {
      throw new Error('Factura no encontrada');
    }

    // Get line items
    const lineas = await this.db
      .select()
      .from(schema.lineasFactura)
      .where(eq(schema.lineasFactura.factura_id, facturaId))
      .orderBy(schema.lineasFactura.orden);

    // Get customer info
    let cliente = { nombre: 'Cliente', telefono: '', direccion: '' };
    if (factura.usuario_id) {
      const [user] = await this.db
        .select({ nombre: schema.usuarios.nombre, telefono: schema.usuarios.telefono })
        .from(schema.usuarios)
        .where(eq(schema.usuarios.id, factura.usuario_id))
        .limit(1);
      if (user) {
        cliente = { nombre: user.nombre, telefono: user.telefono || '', direccion: '' };
      }
    }

    const company = await this.getCompanyInfo();

    const data: InvoiceData = {
      numero: factura.numero,
      fecha_emision: factura.fecha_emision,
      fecha_vencimiento: factura.fecha_vencimiento,
      cliente,
      lineas: lineas.map((l) => ({
        description: l.descripcion,
        quantity: l.cantidad,
        unitPrice: l.precio_unitario,
        total: l.subtotal,
      })),
      subtotal: factura.subtotal,
      descuento: factura.descuento,
      impuesto: factura.impuesto,
      total: factura.total,
      moneda: factura.moneda,
      notas: factura.notas,
      condiciones: factura.condiciones,
      company,
    };

    return this.renderInvoiceTemplate(data);
  }

  /**
   * Generate HTML for daily/period report
   */
  async generateReportHTML(
    fechaInicio: string,
    fechaFin: string,
    generadoPor: string
  ): Promise<string> {
    // Get remesas in the period
    const remesasData = await this.db
      .select({
        codigo: schema.remesas.codigo,
        fecha_creacion: schema.remesas.fecha_creacion,
        remitente_nombre: schema.remesas.remitente_nombre,
        beneficiario_nombre: schema.remesas.beneficiario_nombre,
        monto_envio: schema.remesas.monto_envio,
        monto_entrega: schema.remesas.monto_entrega,
        moneda_entrega: schema.remesas.moneda_entrega,
        estado: schema.remesas.estado,
        total_comision: schema.remesas.total_comision,
      })
      .from(schema.remesas)
      .where(
        and(
          gte(schema.remesas.fecha_creacion, fechaInicio),
          lte(schema.remesas.fecha_creacion, fechaFin + 'T23:59:59')
        )
      )
      .orderBy(desc(schema.remesas.fecha_creacion));

    // Calculate totals
    let totalUSD = 0;
    let totalCUP = 0;
    let totalComisiones = 0;

    const detalle = remesasData.map((r) => {
      totalUSD += r.monto_envio;
      if (r.moneda_entrega === 'CUP') {
        totalCUP += r.monto_entrega;
      } else {
        totalUSD += r.monto_entrega;
      }
      totalComisiones += r.total_comision;

      return {
        codigo: r.codigo,
        fecha: r.fecha_creacion.split('T')[0],
        remitente: r.remitente_nombre,
        beneficiario: r.beneficiario_nombre,
        monto_usd: r.monto_envio,
        monto_entrega: r.monto_entrega,
        moneda: r.moneda_entrega,
        estado: r.estado,
        comision: r.total_comision,
      };
    });

    const company = await this.getCompanyInfo();

    const data: ReportData = {
      titulo: `Reporte de Remesas`,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      generado_por: generadoPor,
      generado_en: new Date().toISOString(),
      resumen: {
        total_remesas: remesasData.length,
        total_usd: totalUSD,
        total_cup: totalCUP,
        comisiones: totalComisiones,
      },
      detalle,
      company,
    };

    return this.renderReportTemplate(data);
  }

  /**
   * Store generated HTML/PDF in R2
   */
  async storeDocument(
    key: string,
    content: string,
    contentType: string = 'text/html'
  ): Promise<string> {
    if (!this.storage) {
      throw new Error('Storage not configured');
    }

    await this.storage.put(key, content, {
      httpMetadata: { contentType },
    });

    return key;
  }

  /**
   * Get document from R2
   */
  async getDocument(key: string): Promise<string | null> {
    if (!this.storage) {
      throw new Error('Storage not configured');
    }

    const obj = await this.storage.get(key);
    if (!obj) return null;

    return obj.text();
  }

  // ============ Template Renderers ============

  private renderReceiptTemplate(data: ReceiptData): string {
    const { remesa, company } = data;
    const fechaCreacion = new Date(remesa.fecha_creacion).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const fechaEntrega = remesa.fecha_entrega
      ? new Date(remesa.fecha_entrega).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Pendiente';

    const estadoLabel = {
      solicitud: 'Solicitud',
      pendiente: 'Pendiente',
      en_proceso: 'En Proceso',
      entregada: 'Entregada',
      facturada: 'Facturada',
      cancelada: 'Cancelada',
    }[remesa.estado] || remesa.estado;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo - ${remesa.codigo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1f2937;
      background: #fff;
      padding: 20px;
    }
    .receipt {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      padding: 24px;
      text-align: center;
    }
    .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .header .codigo { font-size: 18px; font-weight: 500; opacity: 0.9; }
    .header .fecha { font-size: 14px; opacity: 0.8; margin-top: 8px; }
    .status {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      margin-top: 12px;
      background: ${remesa.estado === 'entregada' || remesa.estado === 'facturada' ? '#22c55e' : remesa.estado === 'cancelada' ? '#ef4444' : '#f59e0b'};
    }
    .content { padding: 24px; }
    .section { margin-bottom: 24px; }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    .party-info {
      display: flex;
      gap: 32px;
    }
    .party {
      flex: 1;
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
    }
    .party h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #374151; }
    .party p { margin: 4px 0; color: #4b5563; }
    .party .name { font-weight: 600; color: #111827; font-size: 16px; }
    .amounts-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .amount-box {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .amount-box.primary {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      grid-column: span 2;
    }
    .amount-box .label { font-size: 12px; opacity: 0.7; margin-bottom: 4px; }
    .amount-box .value { font-size: 24px; font-weight: 700; }
    .amount-box.primary .value { font-size: 32px; }
    .footer {
      background: #f9fafb;
      padding: 20px 24px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer .company { font-weight: 600; color: #374151; margin-bottom: 4px; }
    .footer .contact { font-size: 12px; color: #6b7280; }
    .notes {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      margin-top: 16px;
    }
    .notes-title { font-weight: 600; color: #92400e; margin-bottom: 4px; }
    .signature-area {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 2px dashed #e5e7eb;
      display: flex;
      justify-content: space-around;
    }
    .signature {
      text-align: center;
      width: 200px;
    }
    .signature-line {
      border-bottom: 1px solid #374151;
      height: 60px;
      margin-bottom: 8px;
    }
    .signature-label { font-size: 12px; color: #6b7280; }
    @media print {
      body { padding: 0; }
      .receipt { border: none; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>Recibo de Remesa</h1>
      <div class="codigo">${remesa.codigo}</div>
      <div class="fecha">${fechaCreacion}</div>
      <div class="status">${estadoLabel}</div>
    </div>

    <div class="content">
      <div class="section">
        <div class="section-title">Informacion de las Partes</div>
        <div class="party-info">
          <div class="party">
            <h3>Remitente</h3>
            <p class="name">${remesa.remitente_nombre}</p>
            <p>${remesa.remitente_telefono}</p>
          </div>
          <div class="party">
            <h3>Beneficiario</h3>
            <p class="name">${remesa.beneficiario_nombre}</p>
            <p>${remesa.beneficiario_telefono}</p>
            <p>${remesa.beneficiario_direccion}</p>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Detalles de la Transaccion</div>
        <div class="amounts-grid">
          <div class="amount-box primary">
            <div class="label">Monto a Entregar</div>
            <div class="value">${this.formatCurrency(remesa.monto_entrega, remesa.moneda_entrega)}</div>
          </div>
          <div class="amount-box">
            <div class="label">Monto Enviado</div>
            <div class="value">${this.formatCurrency(remesa.monto_envio, 'USD')}</div>
          </div>
          <div class="amount-box">
            <div class="label">Tasa de Cambio</div>
            <div class="value">${remesa.tasa_cambio.toFixed(2)} CUP/USD</div>
          </div>
          <div class="amount-box">
            <div class="label">Comision</div>
            <div class="value">${this.formatCurrency(remesa.total_comision, 'USD')}</div>
          </div>
          <div class="amount-box">
            <div class="label">Total Cobrado</div>
            <div class="value">${this.formatCurrency(remesa.total_cobrado, 'USD')}</div>
          </div>
        </div>
      </div>

      ${remesa.notas ? `
      <div class="notes">
        <div class="notes-title">Notas</div>
        <p>${remesa.notas}</p>
      </div>
      ` : ''}

      ${remesa.estado === 'entregada' || remesa.estado === 'facturada' ? `
      <div class="section">
        <div class="section-title">Entrega</div>
        <p><strong>Fecha de Entrega:</strong> ${fechaEntrega}</p>
        ${remesa.repartidor_nombre ? `<p><strong>Entregado por:</strong> ${remesa.repartidor_nombre}</p>` : ''}
      </div>

      <div class="signature-area">
        <div class="signature">
          <div class="signature-line"></div>
          <div class="signature-label">Firma del Beneficiario</div>
        </div>
        <div class="signature">
          <div class="signature-line"></div>
          <div class="signature-label">Firma del Repartidor</div>
        </div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <div class="company">${company.name}</div>
      <div class="contact">${company.address} | ${company.phone} | ${company.email}</div>
    </div>
  </div>
</body>
</html>`;
  }

  private renderInvoiceTemplate(data: InvoiceData): string {
    const { numero, fecha_emision, fecha_vencimiento, cliente, lineas, subtotal, descuento, impuesto, total, moneda, notas, condiciones, company } = data;

    const fechaEmisionFormatted = new Date(fecha_emision).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const fechaVencimientoFormatted = fecha_vencimiento
      ? new Date(fecha_vencimiento).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null;

    const lineasHtml = lineas.map((l) => `
      <tr>
        <td>${l.description}</td>
        <td class="number">${l.quantity}</td>
        <td class="number">${this.formatCurrency(l.unitPrice, moneda)}</td>
        <td class="number">${this.formatCurrency(l.total, moneda)}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura - ${numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1f2937;
      background: #fff;
      padding: 40px;
    }
    .invoice {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 2px solid #1a1a2e;
    }
    .company-info h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    .company-info p { color: #6b7280; font-size: 13px; }
    .invoice-info { text-align: right; }
    .invoice-info .label { color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .invoice-info .numero { font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 4px 0 16px; }
    .invoice-info .fechas { font-size: 13px; }
    .parties {
      display: flex;
      gap: 48px;
      margin-bottom: 40px;
    }
    .party h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .party .name { font-size: 16px; font-weight: 600; color: #111827; }
    .party p { color: #4b5563; margin: 2px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      background: #f3f4f6;
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      color: #374151;
      font-weight: 600;
    }
    th.number, td.number { text-align: right; }
    td {
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals {
      display: flex;
      justify-content: flex-end;
    }
    .totals-table {
      width: 280px;
    }
    .totals-table tr td {
      padding: 8px 16px;
      border: none;
    }
    .totals-table .label { color: #6b7280; }
    .totals-table .value { text-align: right; font-weight: 500; }
    .totals-table .total-row td {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a2e;
      padding-top: 16px;
      border-top: 2px solid #1a1a2e;
    }
    .notes {
      margin-top: 40px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .notes h4 { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
    .footer {
      margin-top: 60px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
    @media print {
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="company-info">
        <h1>${company.name}</h1>
        <p>${company.address}</p>
        <p>${company.phone}</p>
        <p>${company.email}</p>
      </div>
      <div class="invoice-info">
        <div class="label">Factura</div>
        <div class="numero">${numero}</div>
        <div class="fechas">
          <p><strong>Fecha:</strong> ${fechaEmisionFormatted}</p>
          ${fechaVencimientoFormatted ? `<p><strong>Vence:</strong> ${fechaVencimientoFormatted}</p>` : ''}
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <h3>Facturar a</h3>
        <p class="name">${cliente.nombre}</p>
        ${cliente.telefono ? `<p>${cliente.telefono}</p>` : ''}
        ${cliente.direccion ? `<p>${cliente.direccion}</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Descripcion</th>
          <th class="number">Cantidad</th>
          <th class="number">Precio Unitario</th>
          <th class="number">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineasHtml}
      </tbody>
    </table>

    <div class="totals">
      <table class="totals-table">
        <tr>
          <td class="label">Subtotal</td>
          <td class="value">${this.formatCurrency(subtotal, moneda)}</td>
        </tr>
        ${descuento > 0 ? `
        <tr>
          <td class="label">Descuento</td>
          <td class="value">-${this.formatCurrency(descuento, moneda)}</td>
        </tr>
        ` : ''}
        ${impuesto > 0 ? `
        <tr>
          <td class="label">Impuesto</td>
          <td class="value">${this.formatCurrency(impuesto, moneda)}</td>
        </tr>
        ` : ''}
        <tr class="total-row">
          <td>Total</td>
          <td class="value">${this.formatCurrency(total, moneda)}</td>
        </tr>
      </table>
    </div>

    ${notas || condiciones ? `
    <div class="notes">
      ${notas ? `<h4>Notas</h4><p>${notas}</p>` : ''}
      ${condiciones ? `<h4>Condiciones</h4><p>${condiciones}</p>` : ''}
    </div>
    ` : ''}

    <div class="footer">
      <p>Gracias por su preferencia</p>
      <p>${company.website}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private renderReportTemplate(data: ReportData): string {
    const { titulo, fecha_inicio, fecha_fin, generado_por, generado_en, resumen, detalle, company } = data;

    const estadoColors: Record<string, string> = {
      solicitud: '#f59e0b',
      pendiente: '#3b82f6',
      en_proceso: '#8b5cf6',
      entregada: '#22c55e',
      facturada: '#059669',
      cancelada: '#ef4444',
    };

    const detalleHtml = detalle.map((d) => `
      <tr>
        <td>${d.codigo}</td>
        <td>${d.fecha}</td>
        <td>${d.remitente}</td>
        <td>${d.beneficiario}</td>
        <td class="number">$${d.monto_usd.toFixed(2)}</td>
        <td class="number">${d.monto_entrega.toFixed(2)} ${d.moneda}</td>
        <td><span class="status" style="background: ${estadoColors[d.estado] || '#6b7280'}">${d.estado}</span></td>
        <td class="number">$${d.comision.toFixed(2)}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      background: #fff;
      padding: 30px;
    }
    .report { max-width: 1100px; margin: 0 auto; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #1a1a2e;
    }
    .header h1 { font-size: 24px; color: #1a1a2e; }
    .header .period { color: #6b7280; margin-top: 4px; }
    .meta { text-align: right; font-size: 11px; color: #9ca3af; }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card.primary {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
    }
    .summary-card .label { font-size: 11px; text-transform: uppercase; opacity: 0.7; }
    .summary-card .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th {
      background: #f3f4f6;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      color: #374151;
      font-size: 10px;
    }
    th.number, td.number { text-align: right; }
    td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
    .status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      color: #fff;
      font-size: 10px;
      font-weight: 500;
      text-transform: capitalize;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 11px;
    }
    @media print {
      body { padding: 15px; font-size: 10px; }
      .summary-card .value { font-size: 18px; }
      table { font-size: 9px; }
    }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <div>
        <h1>${titulo}</h1>
        <div class="period">Periodo: ${fecha_inicio} al ${fecha_fin}</div>
      </div>
      <div class="meta">
        <p>Generado por: ${generado_por}</p>
        <p>${new Date(generado_en).toLocaleString('es-ES')}</p>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card primary">
        <div class="label">Total Remesas</div>
        <div class="value">${resumen.total_remesas}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total USD Enviados</div>
        <div class="value">$${resumen.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <div class="label">Total CUP Entregados</div>
        <div class="value">${resumen.total_cup.toLocaleString('es-ES', { minimumFractionDigits: 2 })} CUP</div>
      </div>
      <div class="summary-card">
        <div class="label">Comisiones</div>
        <div class="value">$${resumen.comisiones.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Codigo</th>
          <th>Fecha</th>
          <th>Remitente</th>
          <th>Beneficiario</th>
          <th class="number">USD Enviado</th>
          <th class="number">Entrega</th>
          <th>Estado</th>
          <th class="number">Comision</th>
        </tr>
      </thead>
      <tbody>
        ${detalleHtml}
      </tbody>
    </table>

    <div class="footer">
      <p>${company.name} | ${company.website}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private formatCurrency(amount: number, currency: string): string {
    if (currency === 'USD') {
      return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
}

/**
 * Create PDF service instance
 */
export function createPDFService(db: Database, storage?: R2Bucket): PDFService {
  return new PDFService(db, storage);
}
