import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './application/auth.service.js';
import { MemberAdminService } from './application/member-admin.service.js';
import { ProfileService } from './application/profile.service.js';
import { UserDirectory } from './application/user-directory.js';
import { IdentityMailer, MailTokenRepository, PasswordHasher, SessionRepository, UserRepository } from './domain/identity.ports.js';
import { MailIdentityMailer } from './infrastructure/mail-identity-mailer.js';
import {
  CommunitySession, CommunitySessionSchema, CommunityToken, CommunityTokenSchema, CommunityUser, CommunityUserSchema,
} from './infrastructure/persistence/identity.schemas.js';
import { MongoMailTokenRepository, MongoSessionRepository } from './infrastructure/persistence/mongo-session.repository.js';
import { MongoUserRepository } from './infrastructure/persistence/mongo-user.repository.js';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher.js';
import { AuthController } from './presentation/auth.controller.js';
import { CurrentUser } from './presentation/current-user.js';
import { MembersAdminController } from './presentation/members-admin.controller.js';
import { PermissionGuard } from './presentation/permission.guard.js';
import { ProfileController } from './presentation/profile.controller.js';

// 계정 영역: 가입, 로그인, 세션, 역할과 권한, 프로필 사진, 관리실 회원 목록. 피드와 블로그가 같은 계정을 씀
@Module({
  imports: [MongooseModule.forFeature([
    { name: CommunityUser.name, schema: CommunityUserSchema },
    { name: CommunitySession.name, schema: CommunitySessionSchema },
    { name: CommunityToken.name, schema: CommunityTokenSchema },
  ])],
  controllers: [AuthController, ProfileController, MembersAdminController],
  providers: [
    AuthService, ProfileService, MemberAdminService, UserDirectory, CurrentUser, PermissionGuard,
    { provide: UserRepository, useClass: MongoUserRepository },
    { provide: SessionRepository, useClass: MongoSessionRepository },
    { provide: MailTokenRepository, useClass: MongoMailTokenRepository },
    { provide: PasswordHasher, useClass: ScryptPasswordHasher },
    { provide: IdentityMailer, useClass: MailIdentityMailer },
  ],
  exports: [CurrentUser, PermissionGuard, UserDirectory, ProfileService],
})
export class IdentityModule {}
