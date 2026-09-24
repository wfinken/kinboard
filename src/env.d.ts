/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    session?: import('@auth/core/types').Session | null;
  }
}

declare module '@auth/core/types' {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
