<script lang="ts">
  // Public layout - no auth required
</script>

<div class="min-h-screen bg-gradient-to-br from-primary-50 to-white">
  <!-- Public Navigation -->
  <nav class="bg-white shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <a href="/" class="flex items-center gap-3">
            <div class="h-10 w-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span class="text-xl font-bold text-gray-900">Remesitas</span>
          </a>
        </div>

        <div class="flex items-center gap-6">
          <a href="/solicitar" class="text-sm font-medium text-gray-600 hover:text-primary-600">
            Enviar Dinero
          </a>
          <a href="/rastrear" class="text-sm font-medium text-gray-600 hover:text-primary-600">
            Rastrear
          </a>
          <a href="/tasas" class="text-sm font-medium text-gray-600 hover:text-primary-600">
            Tasas
          </a>
          <a href="/login" class="btn-primary btn-sm">
            Iniciar Sesión
          </a>
        </div>
      </div>
    </div>
  </nav>

  <slot />

  <!-- Footer -->
  <footer class="bg-white border-t border-gray-200 mt-auto">
    <div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-sm text-gray-500">
          2026 Remesitas. Todos los derechos reservados.
        </p>
        <div class="flex gap-6">
          <a href="/terminos" class="text-sm text-gray-500 hover:text-gray-700">
            Términos
          </a>
          <a href="/privacidad" class="text-sm text-gray-500 hover:text-gray-700">
            Privacidad
          </a>
          <a href="/contacto" class="text-sm text-gray-500 hover:text-gray-700">
            Contacto
          </a>
        </div>
      </div>
    </div>
  </footer>
</div>
