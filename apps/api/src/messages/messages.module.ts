import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { Message, MessageSchema } from './schemas/message.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }])],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
