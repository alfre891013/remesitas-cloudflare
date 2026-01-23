<script lang="ts">
  import { apiClient } from '$utils/api';

  interface Asunto {
    id: number;
    codigo: string;
    nombre: string;
    descripcion: string | null;
  }

  let nombre = $state('');
  let email = $state('');
  let telefono = $state('');
  let asunto = $state('');
  let mensaje = $state('');
  let isSubmitting = $state(false);
  let submitSuccess = $state(false);
  let submitError = $state('');
  let ticketNumber = $state('');
  let asuntos: Asunto[] = $state([]);
  let loadingAsuntos = $state(true);

  // Load contact subjects on mount
  $effect(() => {
    loadAsuntos();
  });

  async function loadAsuntos() {
    try {
      const response = await apiClient.get<{ data: Asunto[] }>('/api/mensajes/asuntos');
      if (response.success && response.data) {
        asuntos = response.data;
      }
    } catch (e) {
      console.error('Error loading contact subjects:', e);
      // Fallback to hardcoded subjects
      asuntos = [
        { id: 1, codigo: 'consulta', nombre: 'Consulta general', descripcion: null },
        { id: 2, codigo: 'envio', nombre: 'Problema con un envio', descripcion: null },
        { id: 3, codigo: 'pago', nombre: 'Consulta sobre pagos', descripcion: null },
        { id: 4, codigo: 'cuenta', nombre: 'Problema con mi cuenta', descripcion: null },
        { id: 5, codigo: 'sugerencia', nombre: 'Sugerencia', descripcion: null },
        { id: 6, codigo: 'otro', nombre: 'Otro', descripcion: null },
      ];
    } finally {
      loadingAsuntos = false;
    }
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    isSubmitting = true;
    submitError = '';

    try {
      const response = await apiClient.post<{ data: { numero: string }; message: string }>(
        '/api/mensajes/contacto',
        {
          nombre,
          email,
          telefono: telefono || undefined,
          asunto,
          mensaje,
        }
      );

      if (response.success) {
        submitSuccess = true;
        ticketNumber = response.data?.numero || '';
        // Reset form
        nombre = '';
        email = '';
        telefono = '';
        asunto = '';
        mensaje = '';
      } else {
        submitError = response.message || 'Error al enviar el mensaje. Intenta de nuevo.';
      }
    } catch (e) {
      submitError = 'Error de conexion. Verifica tu internet e intenta de nuevo.';
    } finally {
      isSubmitting = false;
    }
  }

  function resetForm() {
    submitSuccess = false;
    ticketNumber = '';
    submitError = '';
  }
</script>

<svelte:head>
  <title>Contacto - Remesitas</title>
  <meta name="description" content="Contacta al equipo de Remesitas. Estamos aqui para ayudarte con cualquier pregunta sobre nuestro servicio de envio de dinero a Cuba." />
</svelte:head>

<main class="max-w-4xl mx-auto px-4 py-12">
  <h1 class="text-3xl font-bold text-gray-900 text-center mb-2">Contactanos</h1>
  <p class="text-gray-600 text-center mb-12">Estamos aqui para ayudarte. Envianos tu mensaje y te responderemos pronto.</p>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
    <!-- Contact Form -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {#if submitSuccess}
        <div class="text-center py-8">
          <div class="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Mensaje Enviado</h2>
          <p class="text-gray-600 mb-2">Gracias por contactarnos. Te responderemos pronto.</p>
          {#if ticketNumber}
            <p class="text-sm text-gray-500 mb-4">
              Numero de ticket: <span class="font-mono font-medium text-primary-600">{ticketNumber}</span>
            </p>
          {/if}
          <button onclick={resetForm} class="btn-primary">
            Enviar otro mensaje
          </button>
        </div>
      {:else}
        <form onsubmit={handleSubmit}>
          <div class="mb-4">
            <label for="nombre" class="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo <span class="text-error-500">*</span>
            </label>
            <input
              type="text"
              id="nombre"
              bind:value={nombre}
              class="input"
              required
              minlength="2"
              maxlength="100"
              placeholder="Tu nombre"
              disabled={isSubmitting}
            />
          </div>

          <div class="mb-4">
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
              Correo Electronico <span class="text-error-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              bind:value={email}
              class="input"
              required
              placeholder="tu@email.com"
              disabled={isSubmitting}
            />
          </div>

          <div class="mb-4">
            <label for="telefono" class="block text-sm font-medium text-gray-700 mb-1">
              Telefono <span class="text-gray-400">(opcional)</span>
            </label>
            <input
              type="tel"
              id="telefono"
              bind:value={telefono}
              class="input"
              placeholder="+1 (555) 123-4567"
              disabled={isSubmitting}
            />
          </div>

          <div class="mb-4">
            <label for="asunto" class="block text-sm font-medium text-gray-700 mb-1">
              Asunto <span class="text-error-500">*</span>
            </label>
            <select
              id="asunto"
              bind:value={asunto}
              class="input"
              required
              disabled={isSubmitting || loadingAsuntos}
            >
              <option value="">Selecciona un asunto</option>
              {#each asuntos as a}
                <option value={a.codigo}>{a.nombre}</option>
              {/each}
            </select>
          </div>

          <div class="mb-6">
            <label for="mensaje" class="block text-sm font-medium text-gray-700 mb-1">
              Mensaje <span class="text-error-500">*</span>
            </label>
            <textarea
              id="mensaje"
              bind:value={mensaje}
              class="input"
              rows="5"
              required
              minlength="10"
              maxlength="5000"
              placeholder="Escribe tu mensaje aqui..."
              disabled={isSubmitting}
            ></textarea>
            <p class="text-xs text-gray-400 mt-1">{mensaje.length}/5000 caracteres</p>
          </div>

          {#if submitError}
            <div class="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg">
              <p class="text-error-600 text-sm">{submitError}</p>
            </div>
          {/if}

          <button type="submit" class="btn-primary w-full" disabled={isSubmitting}>
            {#if isSubmitting}
              <span class="spinner border-white h-4 w-4 mr-2"></span>
              Enviando...
            {:else}
              Enviar Mensaje
            {/if}
          </button>
        </form>
      {/if}
    </div>

    <!-- Contact Info -->
    <div>
      <div class="bg-primary-50 rounded-xl p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Informacion de Contacto</h2>
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <div class="p-2 bg-white rounded-lg">
              <svg class="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900">Email</p>
              <a href="mailto:soporte@remesitas.com" class="text-primary-600 hover:underline">soporte@remesitas.com</a>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="p-2 bg-white rounded-lg">
              <svg class="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900">Telefono</p>
              <a href="tel:+17865550123" class="text-gray-600 hover:text-primary-600">+1 (786) 555-0123</a>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="p-2 bg-white rounded-lg">
              <svg class="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900">WhatsApp</p>
              <a href="https://wa.me/17865550123" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-primary-600">
                +1 (786) 555-0123
              </a>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="p-2 bg-white rounded-lg">
              <svg class="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900">Horario de Atencion</p>
              <p class="text-gray-600">Lunes a Sabado: 9am - 6pm EST</p>
              <p class="text-gray-500 text-sm">Domingos y feriados: Cerrado</p>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Preguntas Frecuentes</h2>
        <p class="text-gray-600 mb-4">
          Antes de contactarnos, revisa nuestra seccion de preguntas frecuentes.
          Puede que encuentres la respuesta que buscas.
        </p>
        <a href="/faq" class="btn-secondary w-full text-center">
          Ver Preguntas Frecuentes
        </a>
      </div>

      <!-- Response Time Info -->
      <div class="bg-gray-50 rounded-xl p-6">
        <div class="flex items-center gap-3 mb-3">
          <div class="p-2 bg-white rounded-lg">
            <svg class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="font-medium text-gray-900">Tiempo de Respuesta</h3>
        </div>
        <p class="text-gray-600 text-sm">
          Respondemos la mayoria de los mensajes en menos de <strong>24 horas</strong> durante dias laborables.
          Para asuntos urgentes, recomendamos llamar directamente.
        </p>
      </div>
    </div>
  </div>
</main>
