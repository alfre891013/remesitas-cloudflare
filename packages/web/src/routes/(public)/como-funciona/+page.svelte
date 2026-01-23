<script lang="ts">
  const steps = [
    {
      number: 1,
      title: 'Solicita tu Envio',
      description: 'Completa el formulario con los datos del remitente y beneficiario. Solo necesitas nombre, telefono y direccion de entrega en Cuba.',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      details: ['Sin documentacion adicional', 'Proceso 100% online', 'Disponible 24/7']
    },
    {
      number: 2,
      title: 'Confirma la Tasa',
      description: 'Te mostramos la tasa de cambio actual y el monto exacto que recibira tu beneficiario. Sin sorpresas ni cargos ocultos.',
      icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      details: ['Tasas actualizadas en tiempo real', 'Calculo transparente', 'Confirmacion antes de pagar']
    },
    {
      number: 3,
      title: 'Realiza el Pago',
      description: 'Elige tu metodo de pago preferido: Zelle, transferencia bancaria o efectivo. Te confirmaremos la recepcion inmediatamente.',
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      details: ['Zelle (instantaneo)', 'Transferencia bancaria', 'Efectivo en ubicaciones selectas']
    },
    {
      number: 4,
      title: 'Seguimiento en Tiempo Real',
      description: 'Recibe un codigo unico para rastrear tu envio. Te notificamos cada cambio de estado via SMS o WhatsApp.',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      details: ['Codigo de rastreo unico', 'Notificaciones automaticas', 'Soporte por WhatsApp']
    },
    {
      number: 5,
      title: 'Entrega a Domicilio',
      description: 'Nuestro repartidor entrega el dinero directamente en la direccion indicada. El beneficiario recibe CUP o USD segun tu preferencia.',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      details: ['Entrega en 24-48 horas', 'CUP o USD disponible', 'Confirmacion con foto']
    }
  ];

  const benefits = [
    {
      title: 'Rapido y Seguro',
      description: 'Entregamos en menos de 48 horas con confirmacion fotografica',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z'
    },
    {
      title: 'Mejores Tasas',
      description: 'Tasas competitivas basadas en el mercado informal actualizado',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      title: 'Sin Complicaciones',
      description: 'Proceso simple, sin documentacion compleja para el beneficiario',
      icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z'
    },
    {
      title: 'Soporte 24/7',
      description: 'Equipo de soporte disponible por telefono, email y WhatsApp',
      icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z'
    }
  ];
</script>

<svelte:head>
  <title>Como Funciona - Remesitas</title>
  <meta name="description" content="Aprende como enviar dinero a Cuba con Remesitas. Proceso simple en 5 pasos: solicita, confirma, paga, rastrea y entrega a domicilio." />
</svelte:head>

<main>
  <!-- Hero Section -->
  <section class="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-16 md:py-24">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <h1 class="text-3xl md:text-5xl font-bold mb-4">
        Enviar Dinero a Cuba es Facil
      </h1>
      <p class="text-lg md:text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
        Con Remesitas, tu dinero llega a Cuba en menos de 48 horas.
        Proceso simple, tasas competitivas y entrega a domicilio.
      </p>
      <a href="/solicitar" class="inline-flex items-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition-colors shadow-lg hover:shadow-xl">
        Enviar Dinero Ahora
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </a>
    </div>
  </section>

  <!-- Steps Section -->
  <section class="py-16 md:py-24 bg-white">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-16">
        <h2 class="text-3xl font-bold text-gray-900 mb-4">5 Pasos Simples</h2>
        <p class="text-gray-600 text-lg max-w-2xl mx-auto">
          Enviar dinero a Cuba nunca fue tan facil. Sigue estos pasos y tu familiar recibira el dinero rapidamente.
        </p>
      </div>

      <div class="space-y-12 md:space-y-0 md:grid md:grid-cols-1 md:gap-0">
        {#each steps as step, index}
          <div class="relative">
            <!-- Connection line (except last) -->
            {#if index < steps.length - 1}
              <div class="hidden md:block absolute left-1/2 top-full h-12 w-0.5 bg-primary-200 -translate-x-1/2"></div>
            {/if}

            <div class="flex flex-col md:flex-row md:items-center gap-6 {index % 2 === 1 ? 'md:flex-row-reverse' : ''}">
              <!-- Number & Icon -->
              <div class="flex-shrink-0 flex justify-center md:w-1/3">
                <div class="relative">
                  <div class="w-20 h-20 md:w-24 md:h-24 bg-primary-100 rounded-full flex items-center justify-center">
                    <svg class="w-10 h-10 md:w-12 md:h-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={step.icon} />
                    </svg>
                  </div>
                  <div class="absolute -top-2 -right-2 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {step.number}
                  </div>
                </div>
              </div>

              <!-- Content -->
              <div class="flex-1 text-center md:text-left {index % 2 === 1 ? 'md:text-right' : ''}">
                <h3 class="text-xl md:text-2xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p class="text-gray-600 mb-4">{step.description}</p>
                <ul class="flex flex-wrap gap-2 justify-center {index % 2 === 1 ? 'md:justify-end' : 'md:justify-start'}">
                  {#each step.details as detail}
                    <li class="inline-flex items-center gap-1 text-sm text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      {detail}
                    </li>
                  {/each}
                </ul>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Benefits Section -->
  <section class="py-16 md:py-24 bg-gray-50">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-16">
        <h2 class="text-3xl font-bold text-gray-900 mb-4">Por Que Elegir Remesitas</h2>
        <p class="text-gray-600 text-lg max-w-2xl mx-auto">
          Miles de familias confian en nosotros para enviar dinero a sus seres queridos en Cuba.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {#each benefits as benefit}
          <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={benefit.icon} />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900 mb-2">{benefit.title}</h3>
            <p class="text-gray-600 text-sm">{benefit.description}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Delivery Options -->
  <section class="py-16 md:py-24 bg-white">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-16">
        <h2 class="text-3xl font-bold text-gray-900 mb-4">Opciones de Entrega</h2>
        <p class="text-gray-600 text-lg max-w-2xl mx-auto">
          Elige como prefieres que tu beneficiario reciba el dinero.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <!-- CUP Option -->
        <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 border border-green-200">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <span class="text-2xl font-bold text-green-600">CUP</span>
            </div>
            <div>
              <h3 class="text-xl font-semibold text-gray-900">Pesos Cubanos</h3>
              <p class="text-green-600 text-sm font-medium">Mejor tasa de cambio</p>
            </div>
          </div>
          <ul class="space-y-3 mb-6">
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-gray-700">Tasa actualizada del mercado informal</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-gray-700">Ideal para gastos diarios en Cuba</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-gray-700">Descuento de 15 CUP por USD</span>
            </li>
          </ul>
          <a href="/tasas" class="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium">
            Ver tasa actual
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        <!-- USD Option -->
        <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border border-blue-200">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <span class="text-2xl font-bold text-blue-600">USD</span>
            </div>
            <div>
              <h3 class="text-xl font-semibold text-gray-900">Dolares Americanos</h3>
              <p class="text-blue-600 text-sm font-medium">Efectivo en dolares</p>
            </div>
          </div>
          <ul class="space-y-3 mb-6">
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-gray-700">Entrega en efectivo USD</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-gray-700">Ideal para ahorros o compras grandes</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-gray-700">Comision: 5% del monto</span>
            </li>
          </ul>
          <a href="/solicitar" class="inline-flex items-center gap-2 text-blue-700 hover:text-blue-800 font-medium">
            Solicitar envio
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- Coverage Section -->
  <section class="py-16 md:py-24 bg-gray-50">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900 mb-4">Cobertura Nacional</h2>
        <p class="text-gray-600 text-lg max-w-2xl mx-auto">
          Entregamos en todas las provincias de Cuba, desde Pinar del Rio hasta Guantanamo.
        </p>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
        {#each ['La Habana', 'Santiago', 'Holguin', 'Camaguey', 'Villa Clara', 'Granma', 'Las Tunas', 'Matanzas', 'Cienfuegos', 'Pinar del Rio', 'Sancti Spiritus', 'Ciego de Avila', 'Guantanamo', 'Artemisa', 'Mayabeque', 'I. de la Juventud'] as provincia}
          <div class="bg-white rounded-lg py-3 px-2 shadow-sm border border-gray-100">
            <span class="text-sm text-gray-700">{provincia}</span>
          </div>
        {/each}
      </div>

      <p class="text-center text-gray-500 text-sm mt-6">
        * Zonas rurales y de dificil acceso pueden tener tiempos de entrega extendidos.
      </p>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="py-16 md:py-24 bg-primary-600 text-white">
    <div class="max-w-4xl mx-auto px-4 text-center">
      <h2 class="text-3xl md:text-4xl font-bold mb-4">
        Listo para Enviar Dinero a Cuba?
      </h2>
      <p class="text-lg text-primary-100 mb-8 max-w-2xl mx-auto">
        Comienza ahora y tu familiar recibira el dinero en menos de 48 horas.
        Sin complicaciones, sin documentacion adicional.
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/solicitar" class="inline-flex items-center justify-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-50 transition-colors shadow-lg">
          Enviar Dinero
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
        <a href="/tasas" class="inline-flex items-center justify-center gap-2 bg-primary-700 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary-800 transition-colors">
          Ver Tasas de Hoy
        </a>
      </div>
    </div>
  </section>

  <!-- FAQ Preview -->
  <section class="py-16 bg-white">
    <div class="max-w-4xl mx-auto px-4 text-center">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Tienes Preguntas?</h2>
      <p class="text-gray-600 mb-6">
        Encuentra respuestas a las preguntas mas frecuentes sobre nuestro servicio.
      </p>
      <a href="/faq" class="btn-secondary">
        Ver Preguntas Frecuentes
      </a>
    </div>
  </section>
</main>
