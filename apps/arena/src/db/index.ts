import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

function createDB() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set")
  }

  const client = postgres(url)
  return drizzle(client, { schema })
}

let _db: ReturnType<typeof createDB> | null = null

export function getDB() {
  if (!_db) {
    _db = createDB()
  }
  return _db
}

export type DB = ReturnType<typeof createDB>
