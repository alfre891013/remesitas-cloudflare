<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$components/layout/Header.svelte';
  import { Table, Badge, Modal, Button, Select, Input } from '$components/ui';
  import { apiHelpers } from '$utils/api';
  import {
    formatCurrency,
    formatNumber,
    formatDateTime,
    getEstadoLabel,
    getEstadoColor,
    formatPhone,
  } from '$utils/format';

  interface Remesa {
    id: number;
    codigo: string;
    estado: string;
    tipo_entrega: string;
    remitente_nombre: string;
    remitente_telefono: string;
    beneficiario_nombre: string;
    beneficiario_telefono: string;
    beneficiario_direccion: string;
    monto_envio: number;
    monto_entrega: number;
    moneda_entrega: string;
    tasa_cambio: number;
    total_comision: number;
    total_cobrado: number;
    fecha_creacion: string;
    fecha_entrega: string | null;
    repartidor_id: number | null;
    revendedor_id: number | null;
    notas: string | null;
  }

  interface Repartidor {
    id: number;
    nombre: string;
    saldo_usd: number;
    saldo_cup: number;
  }

  let remesas: Remesa[] = [];
  let repartidores: Repartidor[] = [];
  let isLoading = true;
  let error: string | null = null;
  let total = 0;

  // Filters
  let estado = '';
  let search = '';
  let limit = 20;
  let offset = 0;

  // Modals
  let selectedRemesa: Remesa | null = null;
  let showDetailModal = false;
  let showAssignModal = false;
  let selectedRepartidorId = '';
  let actionLoading = false;

  const estadoOptions = [
    { value: '', label: 'Todos' },
    { value: 'solicitud', label: 'Solicitud' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en_proceso', label: 'En proceso' },
    { value: 'entregada', label: 'Entregada' },
    { value: 'facturada', label: 'Facturada' },
    { value: 'cancelada', label: 'Cancelada' },
  ];

  onMount(async () => {
    await Promise.all([loadRemesas(), loadRepartidores()]);
  });

  async function loadRemesas() {
    isLoading = true;
    error = null;

    const params: Record<string, any> = { limit, offset };
    if (estado) params.estado = estado;
    if (search) params.search = search;

    const response = await apiHelpers.getRemesas(params);

    if (response.success && response.data) {
      remesas = response.data.items;
      total = response.data.total;
    } else {
      error = response.message || 'Error al cargar remesas';
    }

    isLoading = false;
  }

  async function loadRepartidores() {
    const response = await apiHelpers.getRepartidores();
    if (response.success && response.data) {
      repartidores = response.data;
    }
  }

  function handleFilterChange() {
    offset = 0;
    loadRemesas();
  }

  function openDetail(remesa: Remesa) {
    selectedRemesa = remesa;
    showDetailModal = true;
  }

  function openAssign(remesa: Remesa) {
    selectedRemesa = remesa;
    selectedRepartidorId = '';
    showAssignModal = true;
  }

  async function handleAssign() {
    if (!selectedRemesa || !selectedRepartidorId) return;

    actionLoading = true;
    const response = await apiHelpers.assignRemesa(
      selectedRemesa.id,
      parseInt(selectedRepartidorId)
    );

    if (response.success) {
      showAssignModal = false;
      await loadRemesas();
    } else {
      alert(response.message || 'Error al asignar');
    }
    actionLoading = false;
  }

  async function handleApprove(remesa: Remesa) {
    if (!confirm('¿Aprobar esta solicitud?')) return;

    actionLoading = true;
    const response = await apiHelpers.approveRemesa(remesa.id);

    if (response.success) {
      await loadRemesas();
    } else {
      alert(response.message || 'Error al aprobar');
    }
    actionLoading = false;
  }

  async function handleCancel(remesa: Remesa) {
    if (!confirm('¿Está seguro de cancelar esta remesa?')) return;

    actionLoading = true;
    const response = await apiHelpers.cancelRemesa(remesa.id);

    if (response.success) {
      await loadRemesas();
      showDetailModal = false;
    } else {
      alert(response.message || 'Error al cancelar');
    }
    actionLoading = false;
  }

  async function handleInvoice(remesa: Remesa) {
    if (!confirm('¿Marcar como facturada?')) return;

    actionLoading = true;
    const response = await apiHelpers.invoiceRemesa(remesa.id);

    if (response.success) {
      await loadRemesas();
      showDetailModal = false;
    } else {
      alert(response.message || 'Error al facturar');
    }
    actionLoading = false;
  }

  function prevPage() {
    if (offset >= limit) {
      offset -= limit;
      loadRemesas();
    }
  }

  function nextPage() {
    if (offset + limit < total) {
      offset += limit;
      loadRemesas();
    }
  }
</script>

<svelte:head>
  <title>Remesas - Admin</title>
</svelte:head>

<Header title="Remesas">
  <a href="/admin/remesas/nueva" class="btn-primary">
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
    Nueva Remesa
  </a>
</Header>

<main class="p-6">
  <!-- Filters -->
  <div class="card p-4 mb-6">
    <div class="flex flex-wrap items-end gap-4">
      <div class="w-48">
        <Select
          label="Estado"
          bind:value={estado}
          options={estadoOptions}
          on:change={handleFilterChange}
        />
      </div>
      <div class="flex-1 min-w-[200px]">
        <Input
          type="search"
          label="Buscar"
          placeholder="Código, nombre, teléfono..."
          bind:value={search}
          on:change={handleFilterChange}
        />
      </div>
      <Button variant="secondary" on:click={loadRemesas}>
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Actualizar
      </Button>
    </div>
  </div>

  <!-- Table -->
  <Table loading={isLoading} isEmpty={remesas.length === 0} emptyMessage="No hay remesas">
    <svelte:fragment slot="head">
      <th class="th">Código</th>
      <th class="th">Estado</th>
      <th class="th">Remitente</th>
      <th class="th">Beneficiario</th>
      <th class="th text-right">Monto USD</th>
      <th class="th text-right">Entrega</th>
      <th class="th">Fecha</th>
      <th class="th">Acciones</th>
    </svelte:fragment>

    {#each remesas as remesa}
      <tr class="hover:bg-gray-50">
        <td class="td">
          <button
            on:click={() => openDetail(remesa)}
            class="font-mono text-primary-600 hover:text-primary-800 hover:underline"
          >
            {remesa.codigo}
          </button>
        </td>
        <td class="td">
          <Badge variant={getEstadoColor(remesa.estado)}>{getEstadoLabel(remesa.estado)}</Badge>
        </td>
        <td class="td">
          <div class="font-medium">{remesa.remitente_nombre}</div>
          <div class="text-xs text-gray-500">{formatPhone(remesa.remitente_telefono)}</div>
        </td>
        <td class="td">
          <div class="font-medium">{remesa.beneficiario_nombre}</div>
          <div class="text-xs text-gray-500">{formatPhone(remesa.beneficiario_telefono)}</div>
        </td>
        <td class="td text-right font-mono">{formatCurrency(remesa.monto_envio)}</td>
        <td class="td text-right">
          <span class="font-mono">{formatNumber(remesa.monto_entrega, 0)}</span>
          <span class="text-xs text-gray-500">{remesa.moneda_entrega}</span>
        </td>
        <td class="td-muted">{formatDateTime(remesa.fecha_creacion)}</td>
        <td class="td">
          <div class="flex items-center gap-2">
            {#if remesa.estado === 'solicitud'}
              <button
                on:click={() => handleApprove(remesa)}
                class="text-success-600 hover:text-success-800"
                title="Aprobar"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
            {/if}
            {#if remesa.estado === 'pendiente'}
              <button
                on:click={() => openAssign(remesa)}
                class="text-primary-600 hover:text-primary-800"
                title="Asignar"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
              </button>
            {/if}
            {#if remesa.estado === 'entregada'}
              <button
                on:click={() => handleInvoice(remesa)}
                class="text-purple-600 hover:text-purple-800"
                title="Facturar"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </button>
            {/if}
            <button
              on:click={() => openDetail(remesa)}
              class="text-gray-400 hover:text-gray-600"
              title="Ver detalles"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    {/each}

    <svelte:fragment slot="footer">
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-500">
          Mostrando {offset + 1} - {Math.min(offset + limit, total)} de {total}
        </p>
        <div class="flex gap-2">
          <Button variant="secondary" size="sm" disabled={offset === 0} on:click={prevPage}>
            Anterior
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={offset + limit >= total}
            on:click={nextPage}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </svelte:fragment>
  </Table>
</main>

<!-- Detail Modal -->
<Modal bind:open={showDetailModal} title="Detalle de Remesa" size="lg">
  {#if selectedRemesa}
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-xl font-mono font-bold">{selectedRemesa.codigo}</h3>
          <Badge variant={getEstadoColor(selectedRemesa.estado)} size="md">
            {getEstadoLabel(selectedRemesa.estado)}
          </Badge>
        </div>
        <div class="text-right">
          <p class="text-2xl font-bold text-primary-600">
            {formatCurrency(selectedRemesa.monto_envio)}
          </p>
          <p class="text-sm text-gray-500">
            Cobra: {formatCurrency(selectedRemesa.total_cobrado)}
          </p>
        </div>
      </div>

      <!-- Details Grid -->
      <div class="grid grid-cols-2 gap-4">
        <div class="p-4 bg-gray-50 rounded-lg">
          <h4 class="text-sm font-medium text-gray-500 mb-2">Remitente</h4>
          <p class="font-medium">{selectedRemesa.remitente_nombre}</p>
          <p class="text-sm text-gray-600">{formatPhone(selectedRemesa.remitente_telefono)}</p>
        </div>
        <div class="p-4 bg-gray-50 rounded-lg">
          <h4 class="text-sm font-medium text-gray-500 mb-2">Beneficiario</h4>
          <p class="font-medium">{selectedRemesa.beneficiario_nombre}</p>
          <p class="text-sm text-gray-600">{formatPhone(selectedRemesa.beneficiario_telefono)}</p>
          <p class="text-sm text-gray-600 mt-1">{selectedRemesa.beneficiario_direccion}</p>
        </div>
      </div>

      <!-- Financial Details -->
      <div class="p-4 bg-primary-50 rounded-lg">
        <h4 class="text-sm font-medium text-primary-700 mb-3">Detalles Financieros</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p class="text-gray-500">Tipo Entrega</p>
            <p class="font-medium">{selectedRemesa.tipo_entrega}</p>
          </div>
          <div>
            <p class="text-gray-500">Tasa Cambio</p>
            <p class="font-medium">{formatNumber(selectedRemesa.tasa_cambio, 0)} CUP</p>
          </div>
          <div>
            <p class="text-gray-500">Monto Entrega</p>
            <p class="font-medium">
              {formatNumber(selectedRemesa.monto_entrega, 0)}
              {selectedRemesa.moneda_entrega}
            </p>
          </div>
          <div>
            <p class="text-gray-500">Comisión</p>
            <p class="font-medium">{formatCurrency(selectedRemesa.total_comision)}</p>
          </div>
        </div>
      </div>

      <!-- Dates -->
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-gray-500">Fecha Creación</p>
          <p class="font-medium">{formatDateTime(selectedRemesa.fecha_creacion)}</p>
        </div>
        {#if selectedRemesa.fecha_entrega}
          <div>
            <p class="text-gray-500">Fecha Entrega</p>
            <p class="font-medium">{formatDateTime(selectedRemesa.fecha_entrega)}</p>
          </div>
        {/if}
      </div>

      {#if selectedRemesa.notas}
        <div>
          <p class="text-sm text-gray-500 mb-1">Notas</p>
          <p class="text-sm bg-gray-50 p-3 rounded">{selectedRemesa.notas}</p>
        </div>
      {/if}
    </div>
  {/if}

  <svelte:fragment slot="footer">
    {#if selectedRemesa}
      {#if selectedRemesa.estado === 'solicitud'}
        <Button variant="primary" on:click={() => handleApprove(selectedRemesa)} loading={actionLoading}>
          Aprobar
        </Button>
      {/if}
      {#if selectedRemesa.estado === 'pendiente'}
        <Button
          variant="primary"
          on:click={() => {
            showDetailModal = false;
            openAssign(selectedRemesa);
          }}
        >
          Asignar Repartidor
        </Button>
      {/if}
      {#if selectedRemesa.estado === 'entregada'}
        <Button variant="primary" on:click={() => handleInvoice(selectedRemesa)} loading={actionLoading}>
          Facturar
        </Button>
      {/if}
      {#if !['entregada', 'facturada', 'cancelada'].includes(selectedRemesa.estado)}
        <Button variant="danger" on:click={() => handleCancel(selectedRemesa)} loading={actionLoading}>
          Cancelar
        </Button>
      {/if}
    {/if}
    <Button variant="secondary" on:click={() => (showDetailModal = false)}>Cerrar</Button>
  </svelte:fragment>
</Modal>

<!-- Assign Modal -->
<Modal bind:open={showAssignModal} title="Asignar Repartidor" size="sm">
  {#if selectedRemesa}
    <div class="space-y-4">
      <p class="text-sm text-gray-600">
        Asignar repartidor a la remesa <strong>{selectedRemesa.codigo}</strong>
      </p>

      <Select
        label="Repartidor"
        bind:value={selectedRepartidorId}
        options={repartidores.map((r) => ({
          value: r.id,
          label: `${r.nombre} (USD: ${formatNumber(r.saldo_usd, 0)}, CUP: ${formatNumber(r.saldo_cup, 0)})`,
        }))}
        placeholder="Seleccionar repartidor..."
        required
      />
    </div>
  {/if}

  <svelte:fragment slot="footer">
    <Button
      variant="primary"
      on:click={handleAssign}
      loading={actionLoading}
      disabled={!selectedRepartidorId}
    >
      Asignar
    </Button>
    <Button variant="secondary" on:click={() => (showAssignModal = false)}>Cancelar</Button>
  </svelte:fragment>
</Modal>
