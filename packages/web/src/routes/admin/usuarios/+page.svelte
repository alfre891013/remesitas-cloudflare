<script lang="ts">
  import { browser } from '$app/environment';
  import Header from '$components/layout/Header.svelte';
  import { Table, Badge, Modal, Button, Select, Input, ConfirmModal } from '$components/ui';
  import { apiHelpers } from '$utils/api';
  import { formatDateTime, getRolLabel, formatCurrency, formatNumber } from '$utils/format';
  import { toast } from '$stores/toast';

  interface Usuario {
    id: number;
    username: string;
    nombre: string;
    telefono: string;
    rol: string;
    activo: boolean;
    fecha_creacion: string;
    saldo_usd?: number;
    saldo_cup?: number;
    saldo_pendiente?: number;
    comision_revendedor?: number;
    usa_logistica?: boolean;
  }

  let usuarios: Usuario[] = [];
  let isLoading = true;
  let error: string | null = null;
  let total = 0;

  // Filters
  let rol = '';
  let search = '';
  let limit = 20;
  let offset = 0;

  // Modal state
  let showModal = false;
  let editingUser: Usuario | null = null;
  let isSubmitting = false;
  let formError = '';

  // Form data
  let form = {
    username: '',
    password: '',
    nombre: '',
    telefono: '',
    rol: 'repartidor',
    activo: true,
    comision_revendedor: 2,
    usa_logistica: true,
  };

  // Confirm modal state
  let showConfirm = false;
  let confirmUser: Usuario | null = null;
  let isDeleting = false;

  const rolOptions = [
    { value: '', label: 'Todos' },
    { value: 'admin', label: 'Administrador' },
    { value: 'repartidor', label: 'Repartidor' },
    { value: 'revendedor', label: 'Revendedor' },
  ];

  const rolFormOptions = [
    { value: 'admin', label: 'Administrador' },
    { value: 'repartidor', label: 'Repartidor' },
    { value: 'revendedor', label: 'Revendedor' },
  ];

  // Load on client-side
  if (browser) {
    loadUsuarios();
  }

  async function loadUsuarios() {
    isLoading = true;
    error = null;

    const params: Record<string, any> = { limit, offset };
    if (rol) params.rol = rol;
    if (search) params.search = search;

    const response = await apiHelpers.getUsers(params);

    if (response.success && response.data) {
      usuarios = response.data.items;
      total = response.data.total;
    } else {
      error = response.message || 'Error al cargar usuarios';
    }

    isLoading = false;
  }

  function handleFilterChange() {
    offset = 0;
    loadUsuarios();
  }

  function openCreateModal() {
    editingUser = null;
    form = {
      username: '',
      password: '',
      nombre: '',
      telefono: '',
      rol: 'repartidor',
      activo: true,
      comision_revendedor: 2,
      usa_logistica: true,
    };
    formError = '';
    showModal = true;
  }

  function openEditModal(user: Usuario) {
    editingUser = user;
    form = {
      username: user.username,
      password: '',
      nombre: user.nombre,
      telefono: user.telefono || '',
      rol: user.rol,
      activo: user.activo,
      comision_revendedor: user.comision_revendedor || 2,
      usa_logistica: user.usa_logistica ?? true,
    };
    formError = '';
    showModal = true;
  }

  async function handleSubmit() {
    formError = '';

    // Validation
    if (!form.nombre || !form.username) {
      formError = 'Nombre y usuario son requeridos';
      return;
    }
    if (!editingUser && !form.password) {
      formError = 'La contraseña es requerida para nuevos usuarios';
      return;
    }

    isSubmitting = true;

    const data: Record<string, any> = {
      username: form.username,
      nombre: form.nombre,
      telefono: form.telefono || undefined,
      rol: form.rol,
      activo: form.activo,
    };

    if (form.password) {
      data.password = form.password;
    }

    if (form.rol === 'revendedor') {
      data.comision_revendedor = form.comision_revendedor;
      data.usa_logistica = form.usa_logistica;
    }

    let response;
    if (editingUser) {
      response = await apiHelpers.updateUser(editingUser.id, data);
    } else {
      response = await apiHelpers.createUser(data);
    }

    if (response.success) {
      showModal = false;
      await loadUsuarios();
    } else {
      formError = response.message || 'Error al guardar';
    }

    isSubmitting = false;
  }

  function handleDelete(user: Usuario) {
    confirmUser = user;
    showConfirm = true;
  }

  async function confirmDelete() {
    if (!confirmUser) return;
    isDeleting = true;

    const response = await apiHelpers.deleteUser(confirmUser.id);

    if (response.success) {
      toast.success(`Usuario ${confirmUser.nombre} eliminado`);
      showConfirm = false;
      confirmUser = null;
      await loadUsuarios();
    } else {
      toast.error(response.message || 'Error al eliminar');
    }

    isDeleting = false;
  }

  async function toggleActive(user: Usuario) {
    const response = await apiHelpers.updateUser(user.id, { activo: !user.activo });

    if (response.success) {
      toast.success(`Usuario ${user.activo ? 'desactivado' : 'activado'}`);
      await loadUsuarios();
    } else {
      toast.error(response.message || 'Error al actualizar');
    }
  }

  function prevPage() {
    if (offset >= limit) {
      offset -= limit;
      loadUsuarios();
    }
  }

  function nextPage() {
    if (offset + limit < total) {
      offset += limit;
      loadUsuarios();
    }
  }
</script>

<svelte:head>
  <title>Usuarios - Admin</title>
</svelte:head>

<Header title="Usuarios">
  <Button variant="primary" on:click={openCreateModal}>
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
      />
    </svg>
    Nuevo Usuario
  </Button>
</Header>

<main class="p-6">
  <!-- Filters -->
  <div class="card p-4 mb-6">
    <div class="flex flex-wrap items-end gap-4">
      <div class="w-48">
        <Select label="Rol" bind:value={rol} options={rolOptions} on:change={handleFilterChange} />
      </div>
      <div class="flex-1 min-w-[200px]">
        <Input
          type="search"
          label="Buscar"
          placeholder="Nombre, usuario, teléfono..."
          bind:value={search}
          on:change={handleFilterChange}
        />
      </div>
      <Button variant="secondary" on:click={loadUsuarios}>
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
  <Table loading={isLoading} isEmpty={usuarios.length === 0} emptyMessage="No hay usuarios">
    <svelte:fragment slot="head">
      <th class="th">Usuario</th>
      <th class="th">Nombre</th>
      <th class="th">Rol</th>
      <th class="th">Estado</th>
      <th class="th">Balance</th>
      <th class="th">Fecha</th>
      <th class="th">Acciones</th>
    </svelte:fragment>

    {#each usuarios as user}
      <tr class="hover:bg-gray-50">
        <td class="td">
          <span class="font-mono text-sm">{user.username}</span>
        </td>
        <td class="td">
          <div class="font-medium">{user.nombre}</div>
          {#if user.telefono}
            <div class="text-xs text-gray-500">{user.telefono}</div>
          {/if}
        </td>
        <td class="td">
          <Badge
            variant={user.rol === 'admin' ? 'purple' : user.rol === 'repartidor' ? 'blue' : 'primary'}
          >
            {getRolLabel(user.rol)}
          </Badge>
        </td>
        <td class="td">
          <Badge variant={user.activo ? 'success' : 'gray'}>
            {user.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        </td>
        <td class="td">
          {#if user.rol === 'repartidor'}
            <div class="text-xs">
              <span class="text-success-600">${formatNumber(user.saldo_usd || 0, 0)}</span> /
              <span class="text-primary-600">{formatNumber(user.saldo_cup || 0, 0)} CUP</span>
            </div>
          {:else if user.rol === 'revendedor'}
            <div class="text-xs">
              <span class="text-warning-600">${formatNumber(user.saldo_pendiente || 0, 2)} pend.</span>
              <span class="text-gray-400">({user.comision_revendedor}%)</span>
            </div>
          {:else}
            <span class="text-gray-400">-</span>
          {/if}
        </td>
        <td class="td-muted">{formatDateTime(user.fecha_creacion)}</td>
        <td class="td">
          <div class="flex items-center gap-2">
            <button
              on:click={() => openEditModal(user)}
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
              on:click={() => toggleActive(user)}
              class={user.activo ? 'text-warning-600 hover:text-warning-800' : 'text-success-600 hover:text-success-800'}
              title={user.activo ? 'Desactivar' : 'Activar'}
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {#if user.activo}
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
            {#if user.rol !== 'admin'}
              <button
                on:click={() => handleDelete(user)}
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
            {/if}
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

<!-- User Modal -->
<Modal bind:open={showModal} title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'} size="md">
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    {#if formError}
      <div class="p-3 bg-error-50 border border-error-200 rounded-lg">
        <p class="text-sm text-error-700">{formError}</p>
      </div>
    {/if}

    <div class="grid grid-cols-2 gap-4">
      <Input label="Usuario" bind:value={form.username} required disabled={!!editingUser} />
      <Input
        label={editingUser ? 'Nueva contraseña' : 'Contraseña'}
        type="password"
        bind:value={form.password}
        required={!editingUser}
        placeholder={editingUser ? 'Dejar vacío para mantener' : ''}
      />
    </div>

    <Input label="Nombre completo" bind:value={form.nombre} required />

    <div class="grid grid-cols-2 gap-4">
      <Input label="Teléfono" type="tel" bind:value={form.telefono} />
      <Select label="Rol" bind:value={form.rol} options={rolFormOptions} />
    </div>

    {#if form.rol === 'revendedor'}
      <div class="p-4 bg-gray-50 rounded-lg space-y-4">
        <h4 class="font-medium text-gray-700">Configuración de Revendedor</h4>
        <div class="grid grid-cols-2 gap-4">
          <Input
            label="Comisión (%)"
            type="number"
            bind:value={form.comision_revendedor}
            min={0}
            max={10}
            step="0.5"
          />
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Usa logística</label>
            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={form.usa_logistica} class="rounded border-gray-300" />
              <span class="text-sm text-gray-600">Sí, usa nuestra logística</span>
            </label>
          </div>
        </div>
      </div>
    {/if}

    <div>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={form.activo} class="rounded border-gray-300" />
        <span class="text-sm text-gray-700">Usuario activo</span>
      </label>
    </div>
  </form>

  <svelte:fragment slot="footer">
    <Button variant="primary" on:click={handleSubmit} loading={isSubmitting}>
      {editingUser ? 'Guardar cambios' : 'Crear usuario'}
    </Button>
    <Button variant="secondary" on:click={() => (showModal = false)}>Cancelar</Button>
  </svelte:fragment>
</Modal>

<!-- Delete Confirm Modal -->
<ConfirmModal
  bind:open={showConfirm}
  title="Eliminar usuario"
  message={confirmUser ? `¿Está seguro de eliminar a ${confirmUser.nombre}?` : ''}
  confirmText="Eliminar"
  variant="danger"
  loading={isDeleting}
  on:confirm={confirmDelete}
  on:cancel={() => { showConfirm = false; confirmUser = null; }}
/>
