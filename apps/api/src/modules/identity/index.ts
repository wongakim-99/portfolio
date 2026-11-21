// 계정 영역의 공개 창구. 다른 영역은 이 파일로만 가져다 씀 (안쪽 폴더를 직접 import 하지 않음)
export { IdentityModule } from './identity.module.js';
export { ProfileService } from './application/profile.service.js';
export { UserDirectory } from './application/user-directory.js';
export type { Permission, Role } from './domain/role.js';
export type { Identity, Person, PublicProfile } from './domain/user.js';
export { CurrentUser } from './presentation/current-user.js';
export { ProfileDto } from './presentation/identity.dto.js';
export { PermissionGuard, RequirePermission } from './presentation/permission.guard.js';
