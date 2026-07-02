import crypto from "crypto";
import bcrypt from "bcryptjs";

export function generarPasswordTemporal() {
  return crypto.randomBytes(6).toString("base64url");
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
