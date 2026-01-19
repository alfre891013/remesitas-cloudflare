// Number formatting
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: currency === 'CUP' ? 'CUP' : 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('es-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Date formatting
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return formatDate(d);
}

// Status translations
export const estadoLabels: Record<string, string> = {
  solicitud: 'Solicitud',
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  entregada: 'Entregada',
  facturada: 'Facturada',
  cancelada: 'Cancelada',
};

export function getEstadoLabel(estado: string): string {
  return estadoLabels[estado] || estado;
}

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'blue' | 'purple' | 'gray';

export const estadoColors: Record<string, BadgeVariant> = {
  solicitud: 'warning',
  pendiente: 'primary',
  en_proceso: 'blue',
  entregada: 'success',
  facturada: 'purple',
  cancelada: 'error',
};

export function getEstadoColor(estado: string): BadgeVariant {
  return estadoColors[estado] || 'gray';
}

// Role translations
export const rolLabels: Record<string, string> = {
  admin: 'Administrador',
  repartidor: 'Repartidor',
  revendedor: 'Revendedor',
};

export function getRolLabel(rol: string): string {
  return rolLabels[rol] || rol;
}

// Phone formatting
export function formatPhone(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  // Format based on length
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.startsWith('53') && digits.length === 10) {
    return `+53 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return phone;
}

// Truncate text
export function truncate(text: string, length: number = 50): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

// Generate initials
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
