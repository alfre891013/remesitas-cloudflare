<script lang="ts">
  import { apiHelpers } from '$utils/api';
  import { formatCurrency, formatNumber } from '$utils/format';

  let step = 1;
  let isLoading = false;
  let error: string | null = null;
  let successCode: string | null = null;

  // Form data
  let formData = {
    monto_envio: 100,
    tipo_entrega: 'MN' as 'MN' | 'USD',
    remitente_nombre: '',
    remitente_telefono: '',
    beneficiario_nombre: '',
    beneficiario_telefono: '',
    beneficiario_direccion: '',
    beneficiario_provincia: '',
    beneficiario_municipio: '',
    notas: '',
  };

  // Calculation result
  let calculation: {
    monto_envio: number;
    monto_entrega: number;
    moneda_entrega: string;
    tasa_cambio: number;
    total_comision: number;
    total_cobrado: number;
  } | null = null;

  // Cuban provinces
  const provincias = [
    'Pinar del Río', 'Artemisa', 'La Habana', 'Mayabeque', 'Matanzas',
    'Cienfuegos', 'Villa Clara', 'Sancti Spíritus', 'Ciego de Ávila',
    'Camagüey', 'Las Tunas', 'Holguín', 'Granma', 'Santiago de Cuba',
    'Guantánamo', 'Isla de la Juventud'
  ];

  let calcDebounce: ReturnType<typeof setTimeout>;

  async function calculateAmount() {
    if (formData.monto_envio <= 0) return;

    const response = await apiHelpers.calculatePublic(formData.monto_envio, formData.tipo_entrega);

    if (response.success && response.data) {
      calculation = response.data;
    }
  }

  function handleMontoChange() {
    clearTimeout(calcDebounce);
    calcDebounce = setTimeout(calculateAmount, 300);
  }

  async function handleSubmit() {
    isLoading = true;
    error = null;

    const data = {
      ...formData,
      beneficiario_direccion: formData.beneficiario_municipio
        ? `${formData.beneficiario_direccion}, ${formData.beneficiario_municipio}`
        : formData.beneficiario_direccion,
    };

    const response = await apiHelpers.submitRequest(data);

    if (response.success && response.data) {
      successCode = response.data.codigo;
      step = 4; // Success step
    } else {
      error = response.message || 'Error al enviar la solicitud';
    }

    isLoading = false;
  }

  function nextStep() {
    if (step < 3) step++;
  }

  function prevStep() {
    if (step > 1) step--;
  }

  $: if (formData.monto_envio > 0) {
    handleMontoChange();
  }
</script>

<svelte:head>
  <title>Enviar Dinero a Cuba - Remesitas</title>
</svelte:head>

<main class="max-w-2xl mx-auto py-12 px-4">
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Envía Dinero a Cuba</h1>
    <p class="mt-2 text-gray-600">Rápido, seguro y con las mejores tasas</p>
  </div>

  {#if successCode}
    <!-- Success State -->
    <div class="card p-8 text-center">
      <div class="mx-auto h-16 w-16 bg-success-50 rounded-full flex items-center justify-center mb-6">
        <svg class="h-8 w-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Solicitud Enviada</h2>
      <p class="text-gray-600 mb-6">Tu código de seguimiento es:</p>
      <div class="bg-gray-100 rounded-lg p-4 mb-6">
        <span class="text-2xl font-mono font-bold text-primary-600">{successCode}</span>
      </div>
      <p class="text-sm text-gray-500 mb-6">
        Guarda este código para rastrear tu envío. Nos pondremos en contacto contigo pronto.
      </p>
      <div class="flex gap-4 justify-center">
        <a href="/rastrear?codigo={successCode}" class="btn-primary">
          Rastrear Envío
        </a>
        <a href="/solicitar" class="btn-secondary" on:click={() => {
          step = 1;
          successCode = null;
          calculation = null;
          formData = {
            monto_envio: 100,
            tipo_entrega: 'MN',
            remitente_nombre: '',
            remitente_telefono: '',
            beneficiario_nombre: '',
            beneficiario_telefono: '',
            beneficiario_direccion: '',
            beneficiario_provincia: '',
            beneficiario_municipio: '',
            notas: '',
          };
        }}>
          Nuevo Envío
        </a>
      </div>
    </div>
  {:else}
    <!-- Progress Steps -->
    <div class="flex items-center justify-center mb-8">
      {#each [1, 2, 3] as s}
        <div class="flex items-center">
          <div class={`h-10 w-10 rounded-full flex items-center justify-center font-medium ${
            s <= step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {s}
          </div>
          {#if s < 3}
            <div class={`w-16 h-1 ${s < step ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="card p-6">
      {#if error}
        <div class="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
          <p class="text-sm text-error-600">{error}</p>
        </div>
      {/if}

      {#if step === 1}
        <!-- Step 1: Amount -->
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Cantidad a Enviar</h2>

        <div class="space-y-4 mb-6">
          <div>
            <label for="cantidad" class="label">Cantidad en USD</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                id="cantidad"
                bind:value={formData.monto_envio}
                on:input={handleMontoChange}
                class="input pl-8 text-lg"
                min="20"
                max="5000"
                step="10"
              />
            </div>
          </div>

          <fieldset>
            <legend class="label">Moneda de entrega</legend>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                class="p-4 border-2 rounded-lg text-left transition-colors {formData.tipo_entrega === 'MN' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}"
                on:click={() => { formData.tipo_entrega = 'MN'; calculateAmount(); }}
              >
                <span class="font-medium">Pesos Cubanos (CUP)</span>
                <p class="text-sm text-gray-500">Mayor cantidad recibida</p>
              </button>
              <button
                type="button"
                class="p-4 border-2 rounded-lg text-left transition-colors {formData.tipo_entrega === 'USD' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}"
                on:click={() => { formData.tipo_entrega = 'USD'; calculateAmount(); }}
              >
                <span class="font-medium">Dólares (USD)</span>
                <p class="text-sm text-gray-500">Moneda estable</p>
              </button>
            </div>
          </fieldset>
        </div>

        {#if calculation}
          <div class="bg-primary-50 rounded-lg p-4 mb-6">
            <div class="flex justify-between items-center mb-2">
              <span class="text-gray-600">El beneficiario recibe:</span>
              <span class="text-2xl font-bold text-primary-700">
                {formatNumber(calculation.monto_entrega, calculation.moneda_entrega === 'USD' ? 2 : 0)}
                <span class="text-base font-normal">{calculation.moneda_entrega}</span>
              </span>
            </div>
            <div class="flex justify-between text-sm text-gray-500">
              <span>Tasa: {formatNumber(calculation.tasa_cambio, 0)} CUP/USD</span>
              <span>Comisión: {formatCurrency(calculation.total_comision)}</span>
            </div>
            <div class="border-t border-primary-200 mt-3 pt-3">
              <div class="flex justify-between font-medium">
                <span>Total a pagar:</span>
                <span>{formatCurrency(calculation.total_cobrado)}</span>
              </div>
            </div>
          </div>
        {/if}

        <button on:click={nextStep} class="btn-primary w-full" disabled={!calculation}>
          Continuar
        </button>
      {:else if step === 2}
        <!-- Step 2: Sender Info -->
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Tus Datos (Remitente)</h2>

        <div class="space-y-4">
          <div>
            <label for="rem_nombre" class="label">Nombre Completo</label>
            <input
              type="text"
              id="rem_nombre"
              bind:value={formData.remitente_nombre}
              class="input"
              placeholder="Tu nombre completo"
              required
            />
          </div>
          <div>
            <label for="rem_telefono" class="label">Teléfono</label>
            <input
              type="tel"
              id="rem_telefono"
              bind:value={formData.remitente_telefono}
              class="input"
              placeholder="+1 (555) 123-4567"
              required
            />
          </div>
        </div>

        <div class="flex gap-4 mt-6">
          <button on:click={prevStep} class="btn-secondary flex-1">
            Atrás
          </button>
          <button
            on:click={nextStep}
            class="btn-primary flex-1"
            disabled={!formData.remitente_nombre || !formData.remitente_telefono}
          >
            Continuar
          </button>
        </div>
      {:else if step === 3}
        <!-- Step 3: Recipient Info -->
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Datos del Beneficiario</h2>

        <div class="space-y-4">
          <div>
            <label for="ben_nombre" class="label">Nombre Completo</label>
            <input
              type="text"
              id="ben_nombre"
              bind:value={formData.beneficiario_nombre}
              class="input"
              placeholder="Nombre del beneficiario"
              required
            />
          </div>
          <div>
            <label for="ben_telefono" class="label">Teléfono en Cuba</label>
            <input
              type="tel"
              id="ben_telefono"
              bind:value={formData.beneficiario_telefono}
              class="input"
              placeholder="+53 5X XXX XXXX"
              required
            />
          </div>
          <div>
            <label for="ben_provincia" class="label">Provincia</label>
            <select
              id="ben_provincia"
              bind:value={formData.beneficiario_provincia}
              class="input"
            >
              <option value="">Seleccionar provincia</option>
              {#each provincias as provincia}
                <option value={provincia}>{provincia}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="ben_municipio" class="label">Municipio</label>
            <input
              type="text"
              id="ben_municipio"
              bind:value={formData.beneficiario_municipio}
              class="input"
              placeholder="Municipio"
            />
          </div>
          <div>
            <label for="ben_direccion" class="label">Dirección Completa</label>
            <textarea
              id="ben_direccion"
              bind:value={formData.beneficiario_direccion}
              class="input"
              rows="2"
              placeholder="Calle, número, entre calles, reparto..."
              required
            ></textarea>
          </div>
          <div>
            <label for="notas" class="label">Notas adicionales (opcional)</label>
            <textarea
              id="notas"
              bind:value={formData.notas}
              class="input"
              rows="2"
              placeholder="Instrucciones especiales..."
            ></textarea>
          </div>
        </div>

        <div class="flex gap-4 mt-6">
          <button on:click={prevStep} class="btn-secondary flex-1">
            Atrás
          </button>
          <button
            on:click={handleSubmit}
            class="btn-primary flex-1"
            disabled={isLoading || !formData.beneficiario_nombre || !formData.beneficiario_telefono || !formData.beneficiario_direccion}
          >
            {#if isLoading}
              <span class="spinner"></span>
              Enviando...
            {:else}
              Enviar Solicitud
            {/if}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</main>
