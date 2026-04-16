import "dotenv/config";
import { z } from "zod";

const boolFromString = z
  .string()
  .transform((v) => v === "true")
  .default(false);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  SERVER_PORT: z.coerce.number().int().positive().default(3000),

  DB_HOST: z.string().min(1, "DB_HOST is required"),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USERNAME: z.string().min(1, "DB_USERNAME is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_DATABASE: z.string().min(1, "DB_DATABASE is required"),

  DB_SSL: boolFromString,
  DB_LOGGING: boolFromString,
  DB_MIGRATIONS_RUN: boolFromString,

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const lines = result.error.issues
    .map((issue) => `  [${issue.path.join(".")}] ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${lines}`);
}

export const env = result.data;
export type Env = typeof env;
