<script lang="ts">
  const lastUpdated = "20 de Enero, 2026";
</script>

<svelte:head>
  <title>Terminos y Condiciones - Remesitas</title>
  <meta name="description" content="Terminos y condiciones del servicio de envio de remesas a Cuba de Remesitas." />
</svelte:head>

<main class="max-w-4xl mx-auto px-4 py-12">
  <h1 class="text-3xl font-bold text-gray-900 mb-2">Terminos y Condiciones</h1>
  <p class="text-gray-500 mb-8">Ultima actualizacion: {lastUpdated}</p>

  <div class="prose prose-gray max-w-none">
    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">1. Aceptacion de los Terminos</h2>
      <p class="text-gray-600 mb-4">
        Al utilizar los servicios de Remesitas, usted acepta estos terminos y condiciones en su totalidad.
        Si no esta de acuerdo con alguna parte de estos terminos, no debe utilizar nuestros servicios.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">2. Descripcion del Servicio</h2>
      <p class="text-gray-600 mb-4">
        Remesitas proporciona servicios de transferencia de dinero a Cuba. Nuestro servicio permite
        enviar dinero que sera entregado en efectivo (CUP o USD) a beneficiarios en Cuba.
      </p>
      <ul class="list-disc list-inside text-gray-600 space-y-2">
        <li>Monto minimo de envio: $10 USD</li>
        <li>Monto maximo de envio: $10,000 USD por transaccion</li>
        <li>Tiempo de entrega estimado: 24-48 horas</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">3. Requisitos del Usuario</h2>
      <p class="text-gray-600 mb-4">Para utilizar nuestros servicios, usted debe:</p>
      <ul class="list-disc list-inside text-gray-600 space-y-2">
        <li>Ser mayor de 18 anos</li>
        <li>Proporcionar informacion veraz y exacta</li>
        <li>Tener capacidad legal para realizar transacciones financieras</li>
        <li>Cumplir con todas las leyes aplicables</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">4. Proceso de Envio</h2>
      <p class="text-gray-600 mb-4">
        El proceso de envio incluye los siguientes pasos:
      </p>
      <ol class="list-decimal list-inside text-gray-600 space-y-2">
        <li>El usuario solicita el envio proporcionando los datos del beneficiario</li>
        <li>Se confirma la tasa de cambio y el monto a entregar</li>
        <li>El usuario realiza el pago segun el metodo acordado</li>
        <li>Una vez confirmado el pago, se procesa la entrega</li>
        <li>El beneficiario recibe el dinero en su domicilio</li>
      </ol>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">5. Tasas y Comisiones</h2>
      <p class="text-gray-600 mb-4">
        Las tasas de cambio se actualizan periodicamente basandose en el mercado informal cubano.
        Las comisiones varian segun el tipo de entrega:
      </p>
      <ul class="list-disc list-inside text-gray-600 space-y-2">
        <li>Entregas en CUP: Tasa de cambio menos 15 CUP por USD</li>
        <li>Entregas en USD: 5% de comision sobre el monto enviado</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">6. Responsabilidades y Limitaciones</h2>
      <p class="text-gray-600 mb-4">
        Remesitas se compromete a realizar las entregas de manera oportuna y segura. Sin embargo:
      </p>
      <ul class="list-disc list-inside text-gray-600 space-y-2">
        <li>No somos responsables de retrasos causados por informacion incorrecta proporcionada por el usuario</li>
        <li>No garantizamos tiempos de entrega en zonas de dificil acceso</li>
        <li>Las fluctuaciones en la tasa de cambio entre el momento del pago y la entrega son responsabilidad del usuario</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">7. Cancelaciones y Reembolsos</h2>
      <p class="text-gray-600 mb-4">
        Las solicitudes de cancelacion deben realizarse antes de que se procese la entrega.
        Una vez iniciado el proceso de entrega, no se aceptan cancelaciones.
        Los reembolsos, cuando apliquen, se procesaran dentro de 5-10 dias habiles.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">8. Disputas</h2>
      <p class="text-gray-600 mb-4">
        En caso de problemas con una entrega, el usuario puede reportar una disputa a traves
        de nuestra plataforma. Nos comprometemos a investigar y resolver las disputas en un
        plazo razonable.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">9. Modificaciones</h2>
      <p class="text-gray-600 mb-4">
        Nos reservamos el derecho de modificar estos terminos en cualquier momento.
        Los cambios entraran en vigor inmediatamente despues de su publicacion en esta pagina.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">10. Contacto</h2>
      <p class="text-gray-600 mb-4">
        Para preguntas sobre estos terminos, contactenos a traves de nuestra
        <a href="/contacto" class="text-primary-600 hover:underline">pagina de contacto</a>.
      </p>
    </section>
  </div>
</main>
