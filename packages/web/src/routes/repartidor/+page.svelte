<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$components/layout/Header.svelte';
  import { Badge, Modal, Button, Textarea } from '$components/ui';
  import { apiHelpers } from '$utils/api';
  import { formatCurrency, formatNumber, formatDateTime, formatPhone, getEstadoLabel } from '$utils/format';

  interface DashboardStats {
    entregas_pendientes: number;
    entregas_hoy: number;
    total_entregas: number;
    saldo_usd: number;
    saldo_cup: number;
  }

  interface Remesa {
    id: number;
    codigo: string;
    estado: string;
    tipo_entrega: string;
    beneficiario_nombre: string;
    beneficiario_telefono: string;
    beneficiario_direccion: string;
    monto_envio: number;
    monto_entrega: number;
    moneda_entrega: string;
    fecha_creacion: string;
    notas: string | null;
  }

  let stats: DashboardStats | null = null;
  let remesasPendientes: Remesa[] = [];
  let isLoading = true;
  let error: string | null = null;

  // Delivery modal
  let showDeliveryModal = false;
  let selectedRemesa: Remesa | null = null;
  let deliveryNotes = '';
  let deliveryPhoto: File | null = null;
  let isDelivering = false;

  // Tab state
  let activeTab: 'pendientes' | 'historial' = 'pendientes';
  let historial: Remesa[] = [];

  onMount(loadData);

  async function loadData() {
    isLoading = true;
    error = null;

    const [dashboardRes, remesasRes] = await Promise.all([
      apiHelpers.getRepartidorDashboard(),
      apiHelpers.getRepartidorRemesas({ estado: 'en_proceso' }),
    ]);

    if (dashboardRes.success && dashboardRes.data) {
      stats = dashboardRes.data;
    }

    if (remesasRes.success && remesasRes.data) {
      remesasPendientes = remesasRes.data;
    } else {
      error = remesasRes.message || 'Error al cargar datos';
    }

    isLoading = false;
  }

  async function loadHistorial() {
    const response = await apiHelpers.getRepartidorHistory({ limit: 50 });
    if (response.success && response.data) {
      historial = response.data;
    }
  }

  function handleTabChange(tab: typeof activeTab) {
    activeTab = tab;
    if (tab === 'historial' && historial.length === 0) {
      loadHistorial();
    }
  }

  function openDeliveryModal(remesa: Remesa) {
    selectedRemesa = remesa;
    deliveryNotes = '';
    deliveryPhoto = null;
    showDeliveryModal = true;
  }

  function handlePhotoChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      deliveryPhoto = target.files[0];
    }
  }

  async function handleDelivery() {
    if (!selectedRemesa) return;

    isDelivering = true;

    // First mark as delivered
    const response = await apiHelpers.markDelivered(selectedRemesa.id, deliveryNotes || undefined);

    if (!response.success) {
      alert(response.message || 'Error al marcar como entregada');
      isDelivering = false;
      return;
    }

    // Upload photo if provided
    if (deliveryPhoto) {
      const formData = new FormData();
      formData.append('foto', deliveryPhoto);
      await apiHelpers.uploadDeliveryPhoto(selectedRemesa.id, formData);
    }

    showDeliveryModal = false;
    await loadData();
    isDelivering = false;
  }

  function openWhatsApp(phone: string, remesa: Remesa) {
    // Format phone for Cuba (+53)
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('53') ? cleanPhone : `53${cleanPhone}`;
    const message = encodeURIComponent(
      `Hola, soy el repartidor de Remesitas. Voy en camino con su envío de ${formatNumber(remesa.monto_entrega, 0)} ${remesa.moneda_entrega}. Código: ${remesa.codigo}`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  }

  function openMaps(direccion: string) {
    const query = encodeURIComponent(direccion + ', Cuba');
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  }
</script>

<svelte:head>
  <title>Panel Repartidor - Remesitas</title>
</svelte:head>

<Header title="Panel Repartidor" />

<main class="p-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="spinner border-primary-600 h-8 w-8"></div>
    </div>
  {:else if error}
    <div class="p-4 bg-error-50 border border-error-200 rounded-lg mb-6">
      <p class="text-error-600">{error}</p>
      <Button variant="secondary" on:click={loadData} class="mt-2">Reintentar</Button>
    </div>
  {:else if stats}
    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="stat-card">
        <p class="stat-label">Pendientes</p>
        <p class="stat-value text-warning-600">{stats.entregas_pendientes}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Hoy</p>
        <p class="stat-value text-success-600">{stats.entregas_hoy}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Saldo USD</p>
        <p class="stat-value text-primary-600">${formatNumber(stats.saldo_usd, 0)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Saldo CUP</p>
        <p class="stat-value">{formatNumber(stats.saldo_cup, 0)}</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="flex gap-4">
        <button
          on:click={() => handleTabChange('pendientes')}
          class="px-4 py-2 font-medium text-sm border-b-2 transition-colors {activeTab === 'pendientes'
            ? 'text-primary-600 border-primary-600'
            : 'text-gray-500 border-transparent hover:text-gray-700'}"
        >
          Entregas Pendientes ({remesasPendientes.length})
        </button>
        <button
          on:click={() => handleTabChange('historial')}
          class="px-4 py-2 font-medium text-sm border-b-2 transition-colors {activeTab === 'historial'
            ? 'text-primary-600 border-primary-600'
            : 'text-gray-500 border-transparent hover:text-gray-700'}"
        >
          Historial
        </button>
      </nav>
    </div>

    <!-- Pendientes Tab -->
    {#if activeTab === 'pendientes'}
      {#if remesasPendientes.length === 0}
        <div class="text-center py-12">
          <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-gray-500 text-lg">No hay entregas pendientes</p>
          <p class="text-gray-400 text-sm mt-1">Las nuevas asignaciones aparecerán aquí</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each remesasPendientes as remesa}
            <div class="card p-4">
              <div class="flex items-start justify-between mb-3">
                <div>
                  <span class="font-mono text-sm text-gray-500">{remesa.codigo}</span>
                  <h3 class="font-semibold text-lg">{remesa.beneficiario_nombre}</h3>
                </div>
                <div class="text-right">
                  <p class="text-2xl font-bold text-primary-600">
                    {formatNumber(remesa.monto_entrega, remesa.moneda_entrega === 'USD' ? 2 : 0)}
                    <span class="text-sm font-normal text-gray-500">{remesa.moneda_entrega}</span>
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p class="text-sm text-gray-500">Teléfono</p>
                  <p class="font-medium">{formatPhone(remesa.beneficiario_telefono)}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500">Dirección</p>
                  <p class="font-medium">{remesa.beneficiario_direccion}</p>
                </div>
              </div>

              {#if remesa.notas}
                <div class="p-3 bg-warning-50 rounded-lg mb-4">
                  <p class="text-sm text-warning-800">
                    <strong>Nota:</strong>
                    {remesa.notas}
                  </p>
                </div>
              {/if}

              <div class="flex flex-wrap gap-2">
                <Button variant="primary" on:click={() => openDeliveryModal(remesa)}>
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Marcar Entregada
                </Button>
                <Button variant="secondary" on:click={() => openWhatsApp(remesa.beneficiario_telefono, remesa)}>
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  WhatsApp
                </Button>
                <Button variant="ghost" on:click={() => openMaps(remesa.beneficiario_direccion)}>
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Mapa
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Historial Tab -->
    {#if activeTab === 'historial'}
      <div class="space-y-3">
        {#each historial as remesa}
          <div class="card p-4 flex items-center justify-between">
            <div>
              <span class="font-mono text-xs text-gray-500">{remesa.codigo}</span>
              <p class="font-medium">{remesa.beneficiario_nombre}</p>
              <p class="text-sm text-gray-500">{formatDateTime(remesa.fecha_creacion)}</p>
            </div>
            <div class="text-right">
              <p class="font-semibold">
                {formatNumber(remesa.monto_entrega, remesa.moneda_entrega === 'USD' ? 2 : 0)}
                {remesa.moneda_entrega}
              </p>
              <Badge variant="success">Entregada</Badge>
            </div>
          </div>
        {:else}
          <p class="text-center text-gray-500 py-8">No hay entregas en el historial</p>
        {/each}
      </div>
    {/if}
  {/if}
</main>

<!-- Delivery Modal -->
<Modal bind:open={showDeliveryModal} title="Confirmar Entrega" size="md">
  {#if selectedRemesa}
    <div class="space-y-4">
      <div class="p-4 bg-primary-50 rounded-lg">
        <div class="flex justify-between items-center">
          <div>
            <p class="text-sm text-gray-500">Beneficiario</p>
            <p class="font-semibold">{selectedRemesa.beneficiario_nombre}</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-500">Monto</p>
            <p class="text-xl font-bold text-primary-600">
              {formatNumber(selectedRemesa.monto_entrega, selectedRemesa.moneda_entrega === 'USD' ? 2 : 0)}
              {selectedRemesa.moneda_entrega}
            </p>
          </div>
        </div>
      </div>

      <Textarea
        label="Notas de entrega (opcional)"
        bind:value={deliveryNotes}
        placeholder="Ej: Entregado a familiar, firmó recibo..."
        rows={3}
      />

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Foto de entrega (opcional)
        </label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          on:change={handlePhotoChange}
          class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
        />
        {#if deliveryPhoto}
          <p class="text-sm text-success-600 mt-2">Foto seleccionada: {deliveryPhoto.name}</p>
        {/if}
      </div>
    </div>
  {/if}

  <svelte:fragment slot="footer">
    <Button variant="primary" on:click={handleDelivery} loading={isDelivering}>
      Confirmar Entrega
    </Button>
    <Button variant="secondary" on:click={() => (showDeliveryModal = false)}>Cancelar</Button>
  </svelte:fragment>
</Modal>
