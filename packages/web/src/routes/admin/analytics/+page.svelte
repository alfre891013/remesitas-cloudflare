<script lang="ts">
  /**
   * Analytics Dashboard
   * Comprehensive analytics and KPI visualization
   */
  import { onMount } from 'svelte';
  import Header from '$lib/components/layout/Header.svelte';
  import { api } from '$lib/utils/api';
  import { Card, Skeleton } from '$lib/components/ui';

  // State
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Date filter
  let fechaInicio = $state(getDefaultStartDate());
  let fechaFin = $state(new Date().toISOString().split('T')[0]);

  // Data
  let overview = $state<any>(null);
  let trends = $state<any>(null);
  let top = $state<any>(null);
  let realtime = $state<any>(null);
  let kpis = $state<any>(null);

  function getDefaultStartDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }

  async function loadData() {
    loading = true;
    error = null;

    try {
      const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin };

      const [overviewRes, trendsRes, topRes, realtimeRes, kpisRes] = await Promise.all([
        api.get<any>('/analytics/overview', params),
        api.get<any>('/analytics/trends', params),
        api.get<any>('/analytics/top', params),
        api.get<any>('/analytics/realtime'),
        api.get<any>('/analytics/kpis', params),
      ]);

      if (overviewRes.success) overview = overviewRes.data;
      if (trendsRes.success) trends = trendsRes.data;
      if (topRes.success) top = topRes.data;
      if (realtimeRes.success) realtime = realtimeRes.data;
      if (kpisRes.success) kpis = kpisRes.data;
    } catch (e) {
      error = 'Error al cargar analytics';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function formatCurrency(value: number, currency: string = 'USD'): string {
    if (currency === 'USD') {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${value.toLocaleString('es-ES')} ${currency}`;
  }

  function formatNumber(value: number): string {
    return value.toLocaleString('es-ES');
  }

  function formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }

  function getStatusColor(estado: string): string {
    const colors: Record<string, string> = {
      solicitud: '#f59e0b',
      pendiente: '#3b82f6',
      en_proceso: '#8b5cf6',
      entregada: '#22c55e',
      facturada: '#059669',
      cancelada: '#ef4444',
    };
    return colors[estado] || '#6b7280';
  }

  onMount(() => {
    loadData();
  });
</script>

<svelte:head>
  <title>Analytics - Remesitas Admin</title>
</svelte:head>

<Header title="Analytics" subtitle="Dashboard de metricas y KPIs" />

<div class="analytics-container">
  <!-- Date Filter -->
  <Card>
    <div class="filter-bar">
      <div class="filter-group">
        <label for="fecha_inicio">Desde</label>
        <input
          type="date"
          id="fecha_inicio"
          bind:value={fechaInicio}
          onchange={() => loadData()}
        />
      </div>
      <div class="filter-group">
        <label for="fecha_fin">Hasta</label>
        <input
          type="date"
          id="fecha_fin"
          bind:value={fechaFin}
          onchange={() => loadData()}
        />
      </div>
      <button class="btn-refresh" onclick={() => loadData()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        Actualizar
      </button>
    </div>
  </Card>

  {#if loading}
    <div class="loading-grid">
      <Skeleton height="120px" />
      <Skeleton height="120px" />
      <Skeleton height="120px" />
      <Skeleton height="120px" />
    </div>
  {:else if error}
    <Card>
      <div class="error-state">
        <p>{error}</p>
        <button onclick={() => loadData()}>Reintentar</button>
      </div>
    </Card>
  {:else}
    <!-- Real-time Stats -->
    {#if realtime}
      <div class="realtime-section">
        <h2 class="section-title">
          <span class="live-indicator"></span>
          En Tiempo Real
        </h2>
        <div class="stats-grid">
          <div class="stat-card primary">
            <div class="stat-value">{realtime.hoy.remesas}</div>
            <div class="stat-label">Remesas Hoy</div>
            <div class="stat-secondary">{formatCurrency(realtime.hoy.volumen_usd)}</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">{realtime.hoy.entregas}</div>
            <div class="stat-label">Entregas Hoy</div>
            <div class="stat-secondary">{formatCurrency(realtime.hoy.volumen_entregas)}</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-value">{realtime.cola.solicitudes}</div>
            <div class="stat-label">Solicitudes Pendientes</div>
          </div>
          <div class="stat-card info">
            <div class="stat-value">{realtime.cola.en_proceso}</div>
            <div class="stat-label">En Proceso</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- KPIs -->
    {#if kpis?.kpis}
      <div class="kpis-section">
        <h2 class="section-title">Indicadores Clave</h2>
        <div class="kpis-grid">
          <div class="kpi-card">
            <div class="kpi-icon success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{kpis.kpis.tasa_exito}%</div>
              <div class="kpi-label">Tasa de Exito</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon info">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{kpis.kpis.tiempo_entrega_promedio_horas.toFixed(1)}h</div>
              <div class="kpi-label">Tiempo Promedio de Entrega</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon primary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{formatNumber(kpis.kpis.total_remesas)}</div>
              <div class="kpi-label">Total Remesas</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon danger">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{formatNumber(kpis.kpis.remesas_canceladas)}</div>
              <div class="kpi-label">Canceladas</div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Overview Stats -->
    {#if overview}
      <div class="overview-section">
        <h2 class="section-title">Resumen del Periodo</h2>
        <div class="overview-grid">
          <Card>
            <div class="overview-stat">
              <div class="overview-label">Total Remesas</div>
              <div class="overview-value">{formatNumber(overview.totales.total_remesas)}</div>
              {#if overview.crecimiento}
                <div class="overview-change" class:positive={overview.crecimiento.remesas_percent >= 0} class:negative={overview.crecimiento.remesas_percent < 0}>
                  {formatPercent(overview.crecimiento.remesas_percent)}
                </div>
              {/if}
            </div>
          </Card>
          <Card>
            <div class="overview-stat">
              <div class="overview-label">USD Enviados</div>
              <div class="overview-value">{formatCurrency(overview.totales.total_usd_enviado)}</div>
              {#if overview.crecimiento}
                <div class="overview-change" class:positive={overview.crecimiento.volumen_percent >= 0} class:negative={overview.crecimiento.volumen_percent < 0}>
                  {formatPercent(overview.crecimiento.volumen_percent)}
                </div>
              {/if}
            </div>
          </Card>
          <Card>
            <div class="overview-stat">
              <div class="overview-label">Comisiones</div>
              <div class="overview-value">{formatCurrency(overview.totales.total_comisiones)}</div>
            </div>
          </Card>
          <Card>
            <div class="overview-stat">
              <div class="overview-label">Promedio por Remesa</div>
              <div class="overview-value">{formatCurrency(overview.totales.promedio_envio)}</div>
            </div>
          </Card>
        </div>

        <!-- By Status -->
        {#if overview.por_estado?.length > 0}
          <Card class="mt-4">
            <h3 class="card-title">Por Estado</h3>
            <div class="status-bars">
              {#each overview.por_estado as item}
                <div class="status-bar">
                  <div class="status-info">
                    <span class="status-dot" style="background: {getStatusColor(item.estado)}"></span>
                    <span class="status-name">{item.estado}</span>
                    <span class="status-count">{item.count}</span>
                  </div>
                  <div class="status-bar-bg">
                    <div
                      class="status-bar-fill"
                      style="width: {(item.count / overview.totales.total_remesas) * 100}%; background: {getStatusColor(item.estado)}"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          </Card>
        {/if}

        <!-- By Type -->
        {#if overview.por_tipo?.length > 0}
          <Card class="mt-4">
            <h3 class="card-title">Por Tipo de Entrega</h3>
            <div class="type-cards">
              {#each overview.por_tipo as item}
                <div class="type-card">
                  <div class="type-header">
                    <span class="type-badge" class:mn={item.tipo_entrega === 'MN'} class:usd={item.tipo_entrega === 'USD'}>
                      {item.tipo_entrega}
                    </span>
                  </div>
                  <div class="type-stats">
                    <div class="type-stat">
                      <span class="type-stat-value">{formatNumber(item.count)}</span>
                      <span class="type-stat-label">remesas</span>
                    </div>
                    <div class="type-stat">
                      <span class="type-stat-value">{formatCurrency(item.total_usd)}</span>
                      <span class="type-stat-label">volumen</span>
                    </div>
                    <div class="type-stat">
                      <span class="type-stat-value">{formatCurrency(item.total_comision)}</span>
                      <span class="type-stat-label">comisiones</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </Card>
        {/if}
      </div>
    {/if}

    <!-- Trends Chart (placeholder) -->
    {#if trends?.series?.length > 0}
      <Card class="mt-6">
        <h2 class="section-title">Tendencias</h2>
        <div class="trends-chart">
          <div class="chart-placeholder">
            <div class="chart-bars">
              {#each trends.series.slice(-14) as point, i}
                <div class="chart-bar-container" title="{point.fecha}: {point.remesas} remesas">
                  <div
                    class="chart-bar"
                    style="height: {Math.max(10, (point.remesas / Math.max(...trends.series.map((s: any) => s.remesas || 1))) * 100)}%"
                  ></div>
                  <span class="chart-label">{point.fecha.slice(-5)}</span>
                </div>
              {/each}
            </div>
            <div class="chart-legend">
              <span>Remesas por dia (ultimos 14 dias)</span>
            </div>
          </div>
        </div>
      </Card>
    {/if}

    <!-- Top Performers -->
    {#if top}
      <div class="top-section mt-6">
        <h2 class="section-title">Top Performers</h2>
        <div class="top-grid">
          <!-- Top Repartidores -->
          {#if top.top_repartidores?.length > 0}
            <Card>
              <h3 class="card-title">Top Repartidores</h3>
              <div class="top-list">
                {#each top.top_repartidores.slice(0, 5) as item, i}
                  <div class="top-item">
                    <span class="top-rank">{i + 1}</span>
                    <div class="top-info">
                      <span class="top-name">{item.nombre}</span>
                      <span class="top-detail">{item.entregas} entregas</span>
                    </div>
                    <span class="top-value">{formatCurrency(item.volumen_usd)}</span>
                  </div>
                {/each}
              </div>
            </Card>
          {/if}

          <!-- Top Revendedores -->
          {#if top.top_revendedores?.length > 0}
            <Card>
              <h3 class="card-title">Top Revendedores</h3>
              <div class="top-list">
                {#each top.top_revendedores.slice(0, 5) as item, i}
                  <div class="top-item">
                    <span class="top-rank">{i + 1}</span>
                    <div class="top-info">
                      <span class="top-name">{item.nombre}</span>
                      <span class="top-detail">{item.remesas} remesas</span>
                    </div>
                    <span class="top-value">{formatCurrency(item.volumen_usd)}</span>
                  </div>
                {/each}
              </div>
            </Card>
          {/if}

          <!-- Top Remitentes -->
          {#if top.top_remitentes?.length > 0}
            <Card>
              <h3 class="card-title">Top Remitentes</h3>
              <div class="top-list">
                {#each top.top_remitentes.slice(0, 5) as item, i}
                  <div class="top-item">
                    <span class="top-rank">{i + 1}</span>
                    <div class="top-info">
                      <span class="top-name">{item.nombre}</span>
                      <span class="top-detail">{item.remesas} remesas</span>
                    </div>
                    <span class="top-value">{formatCurrency(item.volumen_usd)}</span>
                  </div>
                {/each}
              </div>
            </Card>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .analytics-container {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .filter-bar {
    display: flex;
    gap: 16px;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-group label {
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
  }

  .filter-group input {
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
  }

  .btn-refresh {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: #1a1a2e;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-refresh:hover {
    background: #16213e;
  }

  .loading-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 24px;
  }

  .error-state {
    text-align: center;
    padding: 40px;
    color: #6b7280;
  }

  .error-state button {
    margin-top: 16px;
    padding: 8px 16px;
    background: #1a1a2e;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .section-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .live-indicator {
    width: 8px;
    height: 8px;
    background: #22c55e;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Realtime Stats */
  .realtime-section {
    margin-top: 24px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .stat-card {
    padding: 20px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    text-align: center;
  }

  .stat-card.primary {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #fff;
    border: none;
  }

  .stat-card.success {
    border-left: 4px solid #22c55e;
  }

  .stat-card.warning {
    border-left: 4px solid #f59e0b;
  }

  .stat-card.info {
    border-left: 4px solid #3b82f6;
  }

  .stat-value {
    font-size: 32px;
    font-weight: 700;
  }

  .stat-label {
    font-size: 14px;
    opacity: 0.8;
    margin-top: 4px;
  }

  .stat-secondary {
    font-size: 14px;
    opacity: 0.7;
    margin-top: 8px;
  }

  /* KPIs */
  .kpis-section {
    margin-top: 32px;
  }

  .kpis-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .kpi-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
  }

  .kpi-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
  }

  .kpi-icon.success { background: #dcfce7; color: #22c55e; }
  .kpi-icon.info { background: #dbeafe; color: #3b82f6; }
  .kpi-icon.primary { background: #e8e8f0; color: #1a1a2e; }
  .kpi-icon.danger { background: #fee2e2; color: #ef4444; }

  .kpi-value {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
  }

  .kpi-label {
    font-size: 14px;
    color: #6b7280;
  }

  /* Overview */
  .overview-section {
    margin-top: 32px;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .overview-stat {
    text-align: center;
  }

  .overview-label {
    font-size: 14px;
    color: #6b7280;
    margin-bottom: 4px;
  }

  .overview-value {
    font-size: 28px;
    font-weight: 700;
    color: #111827;
  }

  .overview-change {
    font-size: 14px;
    font-weight: 500;
    margin-top: 4px;
  }

  .overview-change.positive { color: #22c55e; }
  .overview-change.negative { color: #ef4444; }

  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 16px;
  }

  /* Status Bars */
  .status-bars {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status-bar {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .status-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-name {
    flex: 1;
    text-transform: capitalize;
    color: #374151;
  }

  .status-count {
    font-weight: 600;
    color: #111827;
  }

  .status-bar-bg {
    height: 8px;
    background: #f3f4f6;
    border-radius: 4px;
    overflow: hidden;
  }

  .status-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  /* Type Cards */
  .type-cards {
    display: flex;
    gap: 16px;
  }

  .type-card {
    flex: 1;
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
  }

  .type-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }

  .type-badge.mn { background: #dbeafe; color: #2563eb; }
  .type-badge.usd { background: #dcfce7; color: #16a34a; }

  .type-stats {
    display: flex;
    gap: 16px;
    margin-top: 12px;
  }

  .type-stat {
    display: flex;
    flex-direction: column;
  }

  .type-stat-value {
    font-weight: 600;
    color: #111827;
  }

  .type-stat-label {
    font-size: 12px;
    color: #6b7280;
  }

  /* Trends Chart */
  .trends-chart {
    padding: 20px 0;
  }

  .chart-placeholder {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .chart-bars {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 200px;
    gap: 8px;
    padding: 0 16px;
  }

  .chart-bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    height: 100%;
    justify-content: flex-end;
  }

  .chart-bar {
    width: 100%;
    max-width: 40px;
    background: linear-gradient(180deg, #1a1a2e 0%, #374151 100%);
    border-radius: 4px 4px 0 0;
    transition: height 0.3s ease;
  }

  .chart-bar:hover {
    background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
  }

  .chart-label {
    font-size: 10px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .chart-legend {
    text-align: center;
    font-size: 14px;
    color: #6b7280;
  }

  /* Top Performers */
  .top-section {
    margin-top: 32px;
  }

  .top-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .top-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .top-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;
  }

  .top-rank {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e5e7eb;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 600;
    color: #374151;
  }

  .top-item:nth-child(1) .top-rank { background: #fef3c7; color: #d97706; }
  .top-item:nth-child(2) .top-rank { background: #e5e7eb; color: #4b5563; }
  .top-item:nth-child(3) .top-rank { background: #fed7aa; color: #c2410c; }

  .top-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .top-name {
    font-weight: 500;
    color: #111827;
  }

  .top-detail {
    font-size: 12px;
    color: #6b7280;
  }

  .top-value {
    font-weight: 600;
    color: #1a1a2e;
  }

  .mt-4 { margin-top: 16px; }
  .mt-6 { margin-top: 24px; }

  /* Responsive */
  @media (max-width: 1024px) {
    .stats-grid,
    .kpis-grid,
    .overview-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .top-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .stats-grid,
    .kpis-grid,
    .overview-grid,
    .loading-grid {
      grid-template-columns: 1fr;
    }

    .filter-bar {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-refresh {
      width: 100%;
      justify-content: center;
    }

    .type-cards {
      flex-direction: column;
    }
  }
</style>
