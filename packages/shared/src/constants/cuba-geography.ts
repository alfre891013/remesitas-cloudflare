/**
 * Cuba Geography Constants
 * 15 provinces + 1 special municipality (Isla de la Juventud)
 * 168 total municipalities
 */

export interface Provincia {
  id: number;
  nombre: string;
  codigo: string;
}

export interface Municipio {
  id: number;
  provinciaId: number;
  nombre: string;
}

/**
 * Cuba's 16 provinces (15 regular + 1 special municipality)
 * IDs match database for referential integrity
 */
export const PROVINCIAS: readonly Provincia[] = [
  { id: 1, nombre: 'Pinar del Río', codigo: 'PR' },
  { id: 2, nombre: 'Artemisa', codigo: 'AR' },
  { id: 3, nombre: 'La Habana', codigo: 'LH' },
  { id: 4, nombre: 'Mayabeque', codigo: 'MY' },
  { id: 5, nombre: 'Matanzas', codigo: 'MT' },
  { id: 6, nombre: 'Cienfuegos', codigo: 'CF' },
  { id: 7, nombre: 'Villa Clara', codigo: 'VC' },
  { id: 8, nombre: 'Sancti Spíritus', codigo: 'SS' },
  { id: 9, nombre: 'Ciego de Ávila', codigo: 'CA' },
  { id: 10, nombre: 'Camagüey', codigo: 'CM' },
  { id: 11, nombre: 'Las Tunas', codigo: 'LT' },
  { id: 12, nombre: 'Holguín', codigo: 'HO' },
  { id: 13, nombre: 'Granma', codigo: 'GR' },
  { id: 14, nombre: 'Santiago de Cuba', codigo: 'SC' },
  { id: 15, nombre: 'Guantánamo', codigo: 'GT' },
  { id: 16, nombre: 'Isla de la Juventud', codigo: 'IJ' },
] as const;

/**
 * Map of province ID to province data
 */
export const PROVINCIAS_MAP = new Map(PROVINCIAS.map((p) => [p.id, p]));

/**
 * Map of province code to province data
 */
export const PROVINCIAS_BY_CODE = new Map(PROVINCIAS.map((p) => [p.codigo, p]));

/**
 * Municipalities organized by province
 * Note: Full list is in database, this is for client-side quick access
 */
export const MUNICIPIOS_POR_PROVINCIA: Record<number, readonly string[]> = {
  // Pinar del Río (11)
  1: [
    'Pinar del Río',
    'Sandino',
    'Mantua',
    'Minas de Matahambre',
    'Viñales',
    'La Palma',
    'Bahía Honda',
    'Candelaria',
    'San Cristóbal',
    'Los Palacios',
    'Consolación del Sur',
  ],
  // Artemisa (11)
  2: [
    'Artemisa',
    'Bahía Honda',
    'Candelaria',
    'Mariel',
    'Guanajay',
    'Caimito',
    'Bauta',
    'San Antonio de los Baños',
    'Güira de Melena',
    'Alquízar',
    'San Cristóbal',
  ],
  // La Habana (15)
  3: [
    'Playa',
    'Plaza de la Revolución',
    'Centro Habana',
    'La Habana Vieja',
    'Regla',
    'La Habana del Este',
    'Guanabacoa',
    'San Miguel del Padrón',
    'Diez de Octubre',
    'Cerro',
    'Marianao',
    'La Lisa',
    'Boyeros',
    'Arroyo Naranjo',
    'Cotorro',
  ],
  // Mayabeque (11)
  4: [
    'San José de las Lajas',
    'Bejucal',
    'Quivicán',
    'Melena del Sur',
    'Batabanó',
    'Güines',
    'San Nicolás',
    'Madruga',
    'Nueva Paz',
    'Santa Cruz del Norte',
    'Jaruco',
  ],
  // Matanzas (13)
  5: [
    'Matanzas',
    'Cárdenas',
    'Varadero',
    'Martí',
    'Colón',
    'Perico',
    'Jovellanos',
    'Pedro Betancourt',
    'Limonar',
    'Unión de Reyes',
    'Ciénaga de Zapata',
    'Jagüey Grande',
    'Calimete',
  ],
  // Cienfuegos (8)
  6: [
    'Cienfuegos',
    'Palmira',
    'Rodas',
    'Lajas',
    'Cruces',
    'Cumanayagua',
    'Abreus',
    'Aguada de Pasajeros',
  ],
  // Villa Clara (13)
  7: [
    'Santa Clara',
    'Caibarién',
    'Camajuaní',
    'Cifuentes',
    'Corralillo',
    'Encrucijada',
    'Manicaragua',
    'Placetas',
    'Quemado de Güines',
    'Ranchuelo',
    'Remedios',
    'Sagua la Grande',
    'Santo Domingo',
  ],
  // Sancti Spíritus (8)
  8: [
    'Sancti Spíritus',
    'Trinidad',
    'Cabaiguán',
    'Fomento',
    'Jatibonico',
    'La Sierpe',
    'Taguasco',
    'Yaguajay',
  ],
  // Ciego de Ávila (10)
  9: [
    'Ciego de Ávila',
    'Morón',
    'Bolivia',
    'Chambas',
    'Ciro Redondo',
    'Florencia',
    'Majagua',
    'Primero de Enero',
    'Baraguá',
    'Venezuela',
  ],
  // Camagüey (13)
  10: [
    'Camagüey',
    'Carlos Manuel de Céspedes',
    'Esmeralda',
    'Florida',
    'Guáimaro',
    'Jimaguayú',
    'Minas',
    'Najasa',
    'Nuevitas',
    'Santa Cruz del Sur',
    'Sibanicú',
    'Sierra de Cubitas',
    'Vertientes',
  ],
  // Las Tunas (8)
  11: [
    'Las Tunas',
    'Puerto Padre',
    'Jesús Menéndez',
    'Manatí',
    'Majibacoa',
    'Jobabo',
    'Colombia',
    'Amancio',
  ],
  // Holguín (14)
  12: [
    'Holguín',
    'Gibara',
    'Rafael Freyre',
    'Banes',
    'Antilla',
    'Báguanos',
    'Calixto García',
    'Cacocum',
    'Urbano Noris',
    'Cueto',
    'Mayarí',
    'Frank País',
    'Sagua de Tánamo',
    'Moa',
  ],
  // Granma (13)
  13: [
    'Bayamo',
    'Manzanillo',
    'Campechuela',
    'Media Luna',
    'Niquero',
    'Pilón',
    'Bartolomé Masó',
    'Buey Arriba',
    'Guisa',
    'Jiguaní',
    'Cauto Cristo',
    'Río Cauto',
    'Yara',
  ],
  // Santiago de Cuba (9)
  14: [
    'Santiago de Cuba',
    'Palma Soriano',
    'Contramaestre',
    'Mella',
    'San Luis',
    'Segundo Frente',
    'Songo-La Maya',
    'Tercer Frente',
    'Guamá',
  ],
  // Guantánamo (10)
  15: [
    'Guantánamo',
    'Baracoa',
    'El Salvador',
    'Imías',
    'Maisí',
    'Manuel Tames',
    'Niceto Pérez',
    'San Antonio del Sur',
    'Caimanera',
    'Yateras',
  ],
  // Isla de la Juventud (1)
  16: ['Nueva Gerona'],
};

/**
 * Get province by ID
 */
export function getProvinciaById(id: number): Provincia | undefined {
  return PROVINCIAS_MAP.get(id);
}

/**
 * Get province by code
 */
export function getProvinciaByCodigo(codigo: string): Provincia | undefined {
  return PROVINCIAS_BY_CODE.get(codigo.toUpperCase());
}

/**
 * Get municipalities for a province
 */
export function getMunicipiosForProvincia(provinciaId: number): readonly string[] {
  return MUNICIPIOS_POR_PROVINCIA[provinciaId] || [];
}

/**
 * Get total count of municipalities
 */
export function getTotalMunicipios(): number {
  return Object.values(MUNICIPIOS_POR_PROVINCIA).reduce((sum, arr) => sum + arr.length, 0);
}

/**
 * Search provinces by name (case-insensitive, partial match)
 */
export function searchProvincias(query: string): Provincia[] {
  if (!query) return [...PROVINCIAS];
  const lowerQuery = query.toLowerCase();
  return PROVINCIAS.filter(
    (p) =>
      p.nombre.toLowerCase().includes(lowerQuery) ||
      p.codigo.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search municipalities by name within a province (case-insensitive, partial match)
 */
export function searchMunicipios(provinciaId: number, query: string): string[] {
  const municipios = MUNICIPIOS_POR_PROVINCIA[provinciaId] || [];
  if (!query) return [...municipios];
  const lowerQuery = query.toLowerCase();
  return municipios.filter((m) => m.toLowerCase().includes(lowerQuery));
}

/**
 * Capital municipalities (for quick selection)
 */
export const CAPITALES_PROVINCIALES: Record<number, string> = {
  1: 'Pinar del Río',
  2: 'Artemisa',
  3: 'La Habana Vieja', // Historic center
  4: 'San José de las Lajas',
  5: 'Matanzas',
  6: 'Cienfuegos',
  7: 'Santa Clara',
  8: 'Sancti Spíritus',
  9: 'Ciego de Ávila',
  10: 'Camagüey',
  11: 'Las Tunas',
  12: 'Holguín',
  13: 'Bayamo',
  14: 'Santiago de Cuba',
  15: 'Guantánamo',
  16: 'Nueva Gerona',
};

/**
 * Most populated municipalities (for priority in UI)
 */
export const MUNICIPIOS_POPULARES = [
  { provinciaId: 3, nombre: 'Plaza de la Revolución' },
  { provinciaId: 3, nombre: 'Diez de Octubre' },
  { provinciaId: 3, nombre: 'Centro Habana' },
  { provinciaId: 3, nombre: 'Playa' },
  { provinciaId: 3, nombre: 'Cerro' },
  { provinciaId: 14, nombre: 'Santiago de Cuba' },
  { provinciaId: 12, nombre: 'Holguín' },
  { provinciaId: 10, nombre: 'Camagüey' },
  { provinciaId: 7, nombre: 'Santa Clara' },
  { provinciaId: 5, nombre: 'Matanzas' },
];
