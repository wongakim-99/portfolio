import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GuardModule } from '../guard/index.js';
import { IdentityModule } from '../identity/index.js';
import { MessagesService } from './application/messages.service.js';
import { MessageRepository } from './domain/message.js';
import { Message, MessageSchema } from './infrastructure/message.schema.js';
import { MongoMessageRepository } from './infrastructure/mongo-message.repository.js';
import { MessagesAdminController } from './presentation/messages-admin.controller.js';
import { MessagesController } from './presentation/messages.controller.js';

// 쪽지 영역: 홈 엽서와 mail gawon 으로 받는 쪽지, 관리실 쪽지함
@Module({
  imports: [IdentityModule, GuardModule, MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }])],
  controllers: [MessagesController, MessagesAdminController],
  providers: [MessagesService, { provide: MessageRepository, useClass: MongoMessageRepository }],
  exports: [MessagesService],
})
export class MessagesModule {}
