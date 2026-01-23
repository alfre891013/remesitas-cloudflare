<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { Table, Badge, Modal, Button, Input, ConfirmModal } from '$components/ui';
  import { apiHelpers } from '$utils/api';
  import { formatCurrency, formatNumber } from '$utils/format';
  import { toast } from '$stores/toast';

  interface Comision {
    id: number;
    nombre: string;
    rango_minimo: number;
    rango_maximo: number | null;
    porcentaje: number;
    monto_fijo: number;
    activa: boolean;
  }

  let comisiones: Comision[] = [];
  let isLoading = true;
  let error: string | null = null;

  // Modal state
  let showModal = false;
  let editingComision: Comision | null = null;
  let isSubmitting = false;
  let formError = '';

  // Confirm modal state
  let showConfirm = false;
  let confirmComision: Comision | null = null;
  let isDeleting = false;

  // Form data
  let form = {
    nombre: '',
    rango_minimo: 0,
    rango_maximo: null as number | null,
    porcentaje: 3,
    monto_fijo: 2,
    activa: true,
  };

  // Load on client-side
  if (browser) {
    loadComisiones();
  }

  async function loadComisiones() {
    isLoading = true;
    error = null;

    const response = await apiHelpers.getCommissions();

    if (response.success && response.data) {
      comisiones = response.data;
    } else {
      error = response.message || 'Error al cargar comisiones';
    }

    isLoading = false;
  }

  function openCreateModal() {
    editingComision = null;
    form = {
      nombre: '',
      rango_minimo: 0,
      rango_maximo: null,
      porcentaje: 3,
      monto_fijo: 2,
      activa: true,
    };
    formError = '';
    showModal = true;
  }

  function openEditModal(comision: Comision) {
    editingComision = comision;
    form = {
      nombre: comision.nombre,
      rango_minimo: comision.rango_minimo,
      rango_maximo: comision.rango_maximo,
      porcentaje: comision.porcentaje,
      monto_fijo: comision.monto_fijo,
      activa: comision.activa,
    };
    formError = '';
    showModal = true;
  }

  async function handleSubmit() {
    formError = '';

    if (!form.nombre) {
      formError = 'El nombre es requerido';
      return;
    }

    isSubmitting = true;

    const data = {
      nombre: form.nombre,
      rango_minimo: form.rango_minimo,
      rango_maximo: form.rango_maximo || undefined,
      porcentaje: form.porcentaje,
      monto_fijo: form.monto_fijo,
      activa: form.activa,
    };

    let response;
    if (editingComision) {
      response = await apiHelpers.updateCommission(editingComision.id, data);
    } else {
      response = await apiHelpers.createCommission(data);
    }

    if (response.success) {
      showModal = false;
      await loadComisiones();
    } else {
      formError = response.message || 'Error al guardar';
    }

    isSubmitting = false;
  }

  function handleDelete(comision: Comision) {
    confirmComision = comision;
    showConfirm = true;
  }

  async function confirmDelete() {
    if (!confirmComision) return;
    isDeleting = true;

    const response = await apiHelpers.deleteCommission(confirmComision.id);

    if (response.success) {
      toast.success(`Comisión "${confirmComision.nombre}" eliminada`);
      showConfirm = false;
      confirmComision = null;
      await loadComisiones();
    } else {
      toast.error(response.message || 'Error al eliminar');
    }

    isDeleting = false;
  }

  async function toggleActive(comision: Comision) {
    const response = await apiHelpers.updateCommission(comision.id, { activa: !comision.activa });

    if (response.success) {
      toast.success(`Comisión ${comision.activa ? 'desactivada' : 'activada'}`);
      await loadComisiones();
    } else {
      toast.error(response.message || 'Error al actualizar');
    }
  }

  // Calculate example
  function calculateExample(monto: number): { porcentaje: number; fija: number; total: number } {
    // Find applicable commission
    const comision = comisiones.find(
      (c) =>
        c.activa &&
        monto >= c.rango_minimo &&
        (c.rango_maximo === null || monto <= c.rango_maximo)
    );

    if (!comision) {
      return { porcentaje: 0, fija: 0, total: 0 };
    }

    const porcentaje = monto * (comision.porcentaje / 100);
    const fija = comision.monto_fijo;
    return { porcentaje, fija, total: porcentaje + fija };
  }

  // Example amounts
  const examples = [50, 100, 200, 500, 1000];
</script>

<svelte:head>
  <title>Comisiones - Admin</title>
</svelte:head>

<Header title="Comisiones">
  <Button variant="primary" on:click={openCreateModal}>
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
    Nueva Comisión
  </Button>
</Header>

<main class="p-6">
  {#if error}
    <div class="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
      <p class="text-error-700">{error}</p>
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Commission Table -->
    <div class="lg:col-span-2">
      <Table
        loading={isLoading}
        isEmpty={comisiones.length === 0}
        emptyMessage="No hay comisiones configuradas"
      >
        <svelte:fragment slot="head">
          <th class="th">Nombre</th>
          <th class="th">Rango USD</th>
          <th class="th text-right">Porcentaje</th>
          <th class="th text-right">Fijo</th>
          <th class="th">Estado</th>
          <th class="th">Acciones</th>
        </svelte:fragment>

        {#each comisiones as comision}
          <tr class="hover:bg-gray-50">
            <td class="td font-medium">{comision.nombre}</td>
            <td class="td">
              <span class="font-mono text-sm">
                {formatCurrency(comision.rango_minimo)} -
                {comision.rango_maximo ? formatCurrency(comision.rango_maximo) : '∞'}
              </span>
            </td>
            <td class="td text-right font-mono">{comision.porcentaje}%</td>
            <td class="td text-right font-mono">{formatCurrency(comision.monto_fijo)}</td>
            <td class="td">
              <Badge variant={comision.activa ? 'success' : 'gray'}>
                {comision.activa ? 'Activa' : 'Inactiva'}
              </Badge>
            </td>
            <td class="td">
              <div class="flex items-center gap-2">
                <button
                  on:click={() => openEditModal(comision)}
                  class="text-primary-600 hover:text-primary-800"
                  title="Editar"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  on:click={() => toggleActive(comision)}
                  class={comision.activa ? 'text-warning-600' : 'text-success-600'}
                  title={comision.activa ? 'Desactivar' : 'Activar'}
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {#if comision.activa}
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    {:else}
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    {/if}
                  </svg>
                </button>
                <button
                  on:click={() => handleDelete(comision)}
                  class="text-error-600 hover:text-error-800"
                  title="Eliminar"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </Table>
    </div>

    <!-- Calculator Preview -->
    <div class="lg:col-span-1">
      <div class="card p-6 sticky top-6">
        <h3 class="font-semibold text-gray-900 mb-4">Calculadora de Comisiones</h3>
        <p class="text-sm text-gray-500 mb-4">
          Vista previa de las comisiones aplicadas a diferentes montos
        </p>

        <div class="space-y-3">
          {#each examples as monto}
            {@const calc = calculateExample(monto)}
            <div class="p-3 bg-gray-50 rounded-lg">
              <div class="flex justify-between items-center mb-2">
                <span class="font-medium">{formatCurrency(monto)}</span>
                <span class="text-primary-600 font-semibold">{formatCurrency(calc.total)}</span>
              </div>
              <div class="text-xs text-gray-500">
                {formatCurrency(calc.porcentaje)} (%) + {formatCurrency(calc.fija)} (fijo)
              </div>
            </div>
          {/each}
        </div>

        <div class="mt-6 p-4 bg-primary-50 rounded-lg">
          <h4 class="font-medium text-primary-800 mb-2">Fórmula</h4>
          <p class="text-sm text-primary-700">
            Comisión = (Monto × Porcentaje%) + Monto Fijo
          </p>
        </div>
      </div>
    </div>
  </div>
</main>

<!-- Commission Modal -->
<Modal bind:open={showModal} title={editingComision ? 'Editar Comisión' : 'Nueva Comisión'} size="md">
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    {#if formError}
      <div class="p-3 bg-error-50 border border-error-200 rounded-lg">
        <p class="text-sm text-error-700">{formError}</p>
      </div>
    {/if}

    <Input label="Nombre" bind:value={form.nombre} placeholder="Ej: Comisión estándar" required />

    <div class="grid grid-cols-2 gap-4">
      <Input
        label="Rango mínimo (USD)"
        type="number"
        bind:value={form.rango_minimo}
        min={0}
        step="0.01"
      />
      <Input
        label="Rango máximo (USD)"
        type="number"
        bind:value={form.rango_maximo}
        min={0}
        step="0.01"
        placeholder="Sin límite"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <Input
        label="Porcentaje (%)"
        type="number"
        bind:value={form.porcentaje}
        min={0}
        max={100}
        step="0.1"
      />
      <Input
        label="Monto fijo (USD)"
        type="number"
        bind:value={form.monto_fijo}
        min={0}
        step="0.01"
      />
    </div>

    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={form.activa} class="rounded border-gray-300" />
      <span class="text-sm text-gray-700">Comisión activa</span>
    </label>
  </form>

  <svelte:fragment slot="footer">
    <Button variant="primary" on:click={handleSubmit} loading={isSubmitting}>
      {editingComision ? 'Guardar cambios' : 'Crear comisión'}
    </Button>
    <Button variant="secondary" on:click={() => (showModal = false)}>Cancelar</Button>
  </svelte:fragment>
</Modal>

<!-- Delete Confirm Modal -->
<ConfirmModal
  bind:open={showConfirm}
  title="Eliminar comisión"
  message={confirmComision ? `¿Eliminar la comisión "${confirmComision.nombre}"?` : ''}
  confirmText="Eliminar"
  variant="danger"
  loading={isDeleting}
  on:confirm={confirmDelete}
  on:cancel={() => { showConfirm = false; confirmComision = null; }}
/>
