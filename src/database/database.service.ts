import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres, { Sql } from 'postgres';
import type { Environment } from '../config/environment';
import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly client: Sql;
  readonly db: PostgresJsDatabase<typeof schema>;

  constructor(config: ConfigService<Environment, true>) {
    this.client = postgres(config.get('DATABASE_URL', { infer: true }), {
      max: 10,
      idle_timeout: 20,
    });
    this.db = drizzle(this.client, { schema });
  }

  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
