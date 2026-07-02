import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: "ADMINISTRADOR" | "DOCENTE" | "ESTUDIANTE";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    rol: "ADMINISTRADOR" | "DOCENTE" | "ESTUDIANTE";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    rol: "ADMINISTRADOR" | "DOCENTE" | "ESTUDIANTE";
  }
}
