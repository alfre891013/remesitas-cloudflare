<script lang="ts">
  interface FAQ {
    question: string;
    answer: string;
  }

  const faqs: FAQ[] = [
    {
      question: "Como funciona el servicio de Remesitas?",
      answer: "Remesitas ofrece un servicio rapido y seguro de envio de dinero a Cuba. Usted realiza el pago en USD y nosotros nos encargamos de entregar el dinero a su beneficiario en Cuba, ya sea en CUP o USD segun prefiera."
    },
    {
      question: "Cuanto tiempo tarda la entrega?",
      answer: "La mayoria de las entregas se realizan en menos de 24 horas una vez confirmado el pago. En zonas remotas puede tardar hasta 48 horas."
    },
    {
      question: "Cual es el monto minimo y maximo?",
      answer: "El monto minimo es de $10 USD y el maximo es de $10,000 USD por transaccion. Para montos mayores, contactenos directamente."
    },
    {
      question: "Que necesito para enviar dinero?",
      answer: "Solo necesita el nombre completo, numero de telefono y direccion del beneficiario en Cuba. No se requiere documentacion adicional para el receptor."
    },
    {
      question: "Como puedo pagar?",
      answer: "Aceptamos pagos via Zelle, transferencia bancaria, y efectivo. Contactenos para conocer las opciones disponibles en su area."
    },
    {
      question: "Puedo rastrear mi envio?",
      answer: "Si, cada envio tiene un codigo unico que le permite rastrear el estado de su remesa en tiempo real a traves de nuestra pagina web."
    },
    {
      question: "Que pasa si hay un problema con la entrega?",
      answer: "Contamos con un sistema de garantia. Si hay algun problema con la entrega, trabajaremos para resolverlo rapidamente. Puede reportar cualquier incidencia a traves de nuestro sistema de disputas."
    },
    {
      question: "Como se calcula la tasa de cambio?",
      answer: "Utilizamos tasas de cambio competitivas basadas en el mercado informal cubano (elTOQUE). Las tasas se actualizan automaticamente varias veces al dia."
    },
    {
      question: "Puedo enviar en USD en lugar de CUP?",
      answer: "Si, ofrecemos entregas tanto en CUP como en USD fisico. Las entregas en USD tienen una comision del 5%."
    },
    {
      question: "Es seguro usar Remesitas?",
      answer: "Absolutamente. Utilizamos tecnologia de encriptacion para proteger sus datos y contamos con un equipo de repartidores verificados para garantizar entregas seguras."
    }
  ];

  let openIndex: number | null = $state(null);

  function toggleFAQ(index: number) {
    openIndex = openIndex === index ? null : index;
  }
</script>

<svelte:head>
  <title>Preguntas Frecuentes - Remesitas</title>
  <meta name="description" content="Respuestas a las preguntas mas frecuentes sobre el servicio de envio de dinero a Cuba de Remesitas." />
</svelte:head>

<main class="max-w-4xl mx-auto px-4 py-12">
  <h1 class="text-3xl font-bold text-gray-900 text-center mb-2">Preguntas Frecuentes</h1>
  <p class="text-gray-600 text-center mb-12">Encuentra respuestas a las preguntas mas comunes sobre nuestro servicio</p>

  <div class="space-y-4">
    {#each faqs as faq, index}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <button
          onclick={() => toggleFAQ(index)}
          class="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span class="font-medium text-gray-900">{faq.question}</span>
          <svg
            class="w-5 h-5 text-gray-500 transition-transform {openIndex === index ? 'rotate-180' : ''}"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {#if openIndex === index}
          <div class="px-6 pb-4">
            <p class="text-gray-600">{faq.answer}</p>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- CTA Section -->
  <div class="mt-12 bg-primary-50 rounded-xl p-8 text-center">
    <h2 class="text-xl font-semibold text-gray-900 mb-2">No encontraste tu respuesta?</h2>
    <p class="text-gray-600 mb-4">Contactanos y te ayudaremos con cualquier duda</p>
    <a href="/contacto" class="btn-primary">
      Contactar Soporte
    </a>
  </div>
</main>
