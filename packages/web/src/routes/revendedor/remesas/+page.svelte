<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { Table, Badge, Modal, Button, Select, Input } from '$components/ui';
  import { apiHelpers } from '$utils/api';
  import { formatCurrency, formatNumber, formatDateTime, getEstadoLabel, formatPhone } from '$utils/format';

  interface Remesa {
    id: number;
    codigo: string;
    estado: string;
    remitente_nombre: string;
    remitente_telefono: string;
    beneficiario_nombre: string;
    beneficiario_telefono: string;
    beneficiario_direccion: string;
    beneficiario_provincia: string;
    monto_envio: number;
    monto_entrega: number;
    moneda_entrega: string;
    tasa_usada: number;
    comision_plataforma: number;
    comision_revendedor: number;
    notas: string | null;
    fecha_creacion: string;
    fecha_entrega: string | null;
    repartidor_nombre: string | null;
  }

  let remesas: Remesa[] = [];
  let isLoading = true;
  let error: string | null = null;
  let total = 0;

  // Filters
  let estado = '';
  let search = '';
  let limit = 20;
  let offset = 0;

  // Detail modal
  let showDetailModal = false;
  let selectedRemesa: Remesa | null = null;

  const estadoOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en_proceso', label: 'En Proceso' },
    { value: 'entregada', label: 'Entregada' },
    { value: 'cancelada', label: 'Cancelada' },
  ];

  // Load on client-side
  if (browser) {
    loadRemesas();
  }

  async function loadRemesas() {
    isLoading = true;
    error = null;

    const params: Record<string, any> = { limit, offset };
    if (estado) params.estado = estado;
    if (search) params.search = search;

    const response = await apiHelpers.getRevendedorRemesas(params);

    if (response.success && response.data) {
      remesas = response.data.items || response.data;
      total = response.data.total || remesas.length;
    } else {
      error = response.message || 'Error al cargar remesas';
    }

    isLoading = false;
  }

  function handleFilterChange() {
    offset = 0;
    loadRemesas();
  }

  function openDetailModal(remesa: Remesa) {
    selectedRemesa = remesa;
    showDetailModal = true;
  }

  function getEstadoVariant(estado: string): 'warning' | 'blue' | 'success' | 'error' | 'gray' {
    switch (estado) {
      case 'pendiente': return 'warning';
      case 'en_proceso': return 'blue';
      case 'entregada': return 'success';
      case 'cancelada': return 'error';
      default: return 'gray';
    }
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

  function openWhatsApp(phone: string, nombre: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('53') ? cleanPhone : `53${cleanPhone}`;
    const message = encodeURIComponent(
      `Hola ${nombre}, soy de Remesitas. Me comunico para coordinar su envío.`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  }
</script>

<svelte:head>
  <title>Mis Remesas - Revendedor</title>
</svelte:head>

<Header title="Mis Remesas">
  <a href="/revendedor/nueva" class="btn-primary">
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
    Nueva Remesa
  </a>
</Header>

<main class="p-6">
  {#if error}
    <div class="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
      <p class="text-error-700">{error}</p>
    </div>
  {/if}

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
          placeholder="Nombre, código, teléfono..."
          bind:value={search}
          on:change={handleFilterChange}
        />
      </div>
      <Button variant="secondary" on:click={loadRemesas}>
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Actualizar
      </Button>
    </div>
  </div>

  <!-- Table -->
  <Table loading={isLoading} isEmpty={remesas.length === 0} emptyMessage="No tienes remesas">
    <svelte:fragment slot="head">
      <th class="th">Código</th>
      <th class="th">Beneficiario</th>
      <th class="th text-right">Envío</th>
      <th class="th text-right">Entrega</th>
      <th class="th text-right">Tu Comisión</th>
      <th class="th">Estado</th>
      <th class="th">Fecha</th>
      <th class="th">Acciones</th>
    </svelte:fragment>

    {#each remesas as remesa}
      <tr class="hover:bg-gray-50 cursor-pointer" on:click={() => openDetailModal(remesa)}>
        <td class="td">
          <span class="font-mono text-sm text-primary-600">{remesa.codigo}</span>
        </td>
        <td class="td">
          <div class="font-medium">{remesa.beneficiario_nombre}</div>
          <div class="text-xs text-gray-500">{remesa.beneficiario_provincia}</div>
        </td>
        <td class="td text-right font-mono">
          <span class="text-success-600">${formatNumber(remesa.monto_envio, 2)}</span>
        </td>
        <td class="td text-right font-mono">
          {formatNumber(remesa.monto_entrega, remesa.moneda_entrega === 'USD' ? 2 : 0)}
          <span class="text-xs text-gray-500">{remesa.moneda_entrega}</span>
        </td>
        <td class="td text-right font-mono">
          <span class="text-accent-600">${formatNumber(remesa.comision_revendedor, 2)}</span>
        </td>
        <td class="td">
          <Badge variant={getEstadoVariant(remesa.estado)}>{getEstadoLabel(remesa.estado)}</Badge>
        </td>
        <td class="td-muted">{formatDateTime(remesa.fecha_creacion)}</td>
        <td class="td">
          <button
            on:click|stopPropagation={() => openWhatsApp(remesa.beneficiario_telefono, remesa.beneficiario_nombre)}
            class="text-success-600 hover:text-success-800"
            title="WhatsApp"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
          </button>
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
          <Button variant="secondary" size="sm" disabled={offset + limit >= total} on:click={nextPage}>
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
      <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <span class="font-mono text-lg text-primary-600">{selectedRemesa.codigo}</span>
          <Badge variant={getEstadoVariant(selectedRemesa.estado)} class="ml-2">
            {getEstadoLabel(selectedRemesa.estado)}
          </Badge>
        </div>
        <span class="text-sm text-gray-500">{formatDateTime(selectedRemesa.fecha_creacion)}</span>
      </div>

      <!-- Parties -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 class="font-medium text-gray-700 mb-2">Remitente</h4>
          <div class="p-4 bg-gray-50 rounded-lg">
            <p class="font-semibold">{selectedRemesa.remitente_nombre}</p>
            {#if selectedRemesa.remitente_telefono}
              <p class="text-sm text-gray-500">{formatPhone(selectedRemesa.remitente_telefono)}</p>
            {/if}
          </div>
        </div>
        <div>
          <h4 class="font-medium text-gray-700 mb-2">Beneficiario</h4>
          <div class="p-4 bg-gray-50 rounded-lg">
            <p class="font-semibold">{selectedRemesa.beneficiario_nombre}</p>
            <p class="text-sm text-gray-500">{formatPhone(selectedRemesa.beneficiario_telefono)}</p>
            <p class="text-sm text-gray-500">{selectedRemesa.beneficiario_direccion}</p>
            <p class="text-sm text-gray-500">{selectedRemesa.beneficiario_provincia}</p>
          </div>
        </div>
      </div>

      <!-- Financial -->
      <div>
        <h4 class="font-medium text-gray-700 mb-2">Detalles Financieros</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-3 bg-success-50 rounded-lg text-center">
            <p class="text-sm text-gray-500">Envío</p>
            <p class="text-lg font-bold text-success-600">${formatNumber(selectedRemesa.monto_envio, 2)}</p>
          </div>
          <div class="p-3 bg-primary-50 rounded-lg text-center">
            <p class="text-sm text-gray-500">Entrega</p>
            <p class="text-lg font-bold text-primary-600">
              {formatNumber(selectedRemesa.monto_entrega, selectedRemesa.moneda_entrega === 'USD' ? 2 : 0)}
              <span class="text-xs">{selectedRemesa.moneda_entrega}</span>
            </p>
          </div>
          <div class="p-3 bg-gray-50 rounded-lg text-center">
            <p class="text-sm text-gray-500">Tasa</p>
            <p class="text-lg font-bold">{formatNumber(selectedRemesa.tasa_usada, 0)}</p>
          </div>
          <div class="p-3 bg-accent-50 rounded-lg text-center">
            <p class="text-sm text-gray-500">Tu Comisión</p>
            <p class="text-lg font-bold text-accent-600">${formatNumber(selectedRemesa.comision_revendedor, 2)}</p>
          </div>
        </div>
      </div>

      <!-- Status Timeline -->
      {#if selectedRemesa.repartidor_nombre}
        <div>
          <h4 class="font-medium text-gray-700 mb-2">Repartidor Asignado</h4>
          <div class="p-3 bg-blue-50 rounded-lg">
            <p class="font-medium text-blue-700">{selectedRemesa.repartidor_nombre}</p>
          </div>
        </div>
      {/if}

      {#if selectedRemesa.fecha_entrega}
        <div>
          <h4 class="font-medium text-gray-700 mb-2">Fecha de Entrega</h4>
          <div class="p-3 bg-success-50 rounded-lg">
            <p class="font-medium text-success-700">{formatDateTime(selectedRemesa.fecha_entrega)}</p>
          </div>
        </div>
      {/if}

      {#if selectedRemesa.notas}
        <div>
          <h4 class="font-medium text-gray-700 mb-2">Notas</h4>
          <div class="p-3 bg-warning-50 rounded-lg">
            <p class="text-warning-800">{selectedRemesa.notas}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={() => (showDetailModal = false)}>Cerrar</Button>
  </svelte:fragment>
</Modal>

<style>
  .btn-primary {
    @apply inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors;
  }
</style>
