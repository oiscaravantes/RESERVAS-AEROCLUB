import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!databaseUrl || !supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan DATABASE_URL, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
}

const { Client } = pg;

async function runSql(fileName) {
  const sql = await fs.readFile(path.join(root, "supabase", fileName), "utf8");
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function supabaseAdmin(pathname, options = {}) {
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body?.msg || body?.message || text || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }

  return body;
}

async function listUsers() {
  const body = await supabaseAdmin("/auth/v1/admin/users?per_page=200");
  return body?.users ?? [];
}

async function upsertUser(email, password, metadata) {
  const users = await listUsers();
  const existing = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    await supabaseAdmin(`/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: metadata,
      }),
    });
    return;
  }

  await supabaseAdmin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
  });
}

console.log("Creando esquema y datos iniciales...");
await runSql("schema.sql");

console.log("Creando usuarios de prueba...");
await upsertUser("admin@aeroclub.com", "Admin2025!", {
  full_name: "Administrador Aeroclub",
  member_code: "PILOTO-ADMIN",
  role: "admin",
});
await upsertUser("socio@aeroclub.com", "Socio2025!", {
  full_name: "Socio de Prueba",
  member_code: "PILOTO-001",
  role: "socio",
});

console.log("Asignando roles...");
await runSql("test-users.sql");

console.log("Supabase quedó configurado.");
