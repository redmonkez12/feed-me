import { Module } from '@nestjs/common';
import { DishRankingService } from './dish-ranking.service';
import { OrderQueueService } from './order-queue.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderQueueService, DishRankingService],
  exports: [OrdersService, OrderQueueService, DishRankingService],
})
export class OrdersModule {}
