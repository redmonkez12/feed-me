import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { Environment } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Environment, true>);
  const port = config.get('PORT', { infer: true });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

  await app.listen(port);
  Logger.log(`Food Delivery API is listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  Logger.error(`Application failed to start: ${message}`, 'Bootstrap');
  process.exitCode = 1;
});
