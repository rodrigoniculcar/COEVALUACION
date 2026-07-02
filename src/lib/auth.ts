import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// En producción se DEBERÍA definir NEXTAUTH_SECRET en las variables de entorno
// de Vercel. Este respaldo evita que la app se caiga con un "server-side
// exception" cuando la variable no está configurada. Es funcional pero menos
// seguro que un secreto propio (permitiría forjar sesiones si alguien conoce
// este valor), así que se recomienda igualmente definir NEXTAUTH_SECRET.
const authSecret =
  process.env.NEXTAUTH_SECRET ??
  process.env.AUTH_SECRET ??
  "coevaluacion-fallback-secret-define-NEXTAUTH_SECRET-en-produccion";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      // La verificación de credenciales ocurre en el servidor: nunca se
      // compara ni transporta la contraseña en texto plano fuera de esta
      // función, solo el hash almacenado en base de datos.
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user) return null;
        // Cuenta desactivada por un administrador: no puede iniciar sesión,
        // aunque la contraseña sea correcta.
        if (!user.activo) return null;

        const passwordValida = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!passwordValida) return null;

        return {
          id: user.id,
          name: user.nombre,
          email: user.email,
          rol: user.rol,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as "ADMINISTRADOR" | "DOCENTE" | "ESTUDIANTE";
      }
      return session;
    },
  },
  secret: authSecret,
};
