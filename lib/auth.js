import { cookies } from "next/headers";

export const AUTH_COOKIE = "laurel_woods_admin";

export function getAdminPassword() {
  return process.env.LAUREL_WOODS_ADMIN_PASSWORD || "laurelwoods";
}

export function isAuthenticated() {
  return cookies().get(AUTH_COOKIE)?.value === "1";
}
