/// <reference types="@sveltejs/kit" />

declare global {
  namespace App {
    interface Locals {
      user?: {
        id: number;
        username: string;
        nombre: string;
        rol: 'admin' | 'repartidor' | 'revendedor';
      };
    }
    interface PageData {
      user?: {
        id: number;
        username: string;
        nombre: string;
        rol: 'admin' | 'repartidor' | 'revendedor';
      };
    }
    interface Platform {
      env?: {
        API_URL?: string;
      };
    }
  }
}

export {};
