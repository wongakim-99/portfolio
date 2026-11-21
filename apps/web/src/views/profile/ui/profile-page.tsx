'use client';

import { useEffect, useState } from 'react';
import { routes } from '@shared/config';
import { cx, formatDate, useDocumentTitle } from '@shared/lib';
import { BackLink, FormStatus, NO_STATUS, Sheet, type Status } from '@shared/ui';
import { PostList } from '@widgets/post-list';
import { useLogout } from '@features/auth';
import { AvatarActions } from '@features/change-avatar';
import { PasswordForm } from '@features/change-password';
import { ProfileForm } from '@features/edit-profile';
import { Avatar, getProfile, useSession, type Profile } from '@entities/user';
import './profile-page.css';

/** 회원 페이지. 내 페이지면 사진, 이름, 소개를 고치고 비밀번호 변경과 로그아웃을 함 */
export function ProfilePage({ userId }: { userId: string }) {
  const { user, setUser, config } = useSession();
  const logout = useLogout();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missing, setMissing] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<Status>(NO_STATUS);
  const [accountStatus, setAccountStatus] = useState<Status>(NO_STATUS);
  useDocumentTitle(profile ? `${profile.name} | 김가원 피드` : null);

  useEffect(() => {
    let active = true;
    // 없는 회원과 연결 실패를 같은 안내로 보여 줌
    getProfile(userId).then(
      (value) => active && setProfile(value),
      () => active && setMissing(true),
    );
    return () => {
      active = false;
    };
  }, [userId]);

  const mine = Boolean(user && profile && user.id === profile.id);
  const photoNote: Status = !mine ? NO_STATUS : config.uploadsEnabled ? avatarStatus : { message: '사진 올리기는 저장소 설정을 마친 뒤 열립니다.' };

  function changeAvatar(avatarUrl: string | null) {
    setProfile((value) => value && { ...value, avatarUrl });
    setUser((value) => value && { ...value, avatarUrl });
  }

  function saveProfile(next: Profile) {
    setProfile(next);
    setUser((value) => value && { ...value, name: next.name });
  }

  return (
    <Sheet clip className="community-sheet" aria-labelledby="profile-name">
      <BackLink href={routes.feed}>모든 글</BackLink>
      <div className="profile-card">
        <div className="profile-photo-wrap">
          {!missing && <figure className="profile-photo">{profile && <Avatar person={profile} />}</figure>}
          {mine && config.uploadsEnabled && profile && (
            <AvatarActions hasPhoto={Boolean(profile.avatarUrl)} onChange={changeAvatar} onStatus={setAvatarStatus} />
          )}
        </div>
        <div className="profile-text">
          <p className="hand profile-hand">{profile ? (mine ? '내 페이지' : `${profile.name}님의 페이지`) : ''}</p>
          <div className="profile-name-row">
            <h2 id="profile-name">{missing ? '사용자를 찾을 수 없습니다' : profile?.name}</h2>
            {profile?.role === 'admin' && <span className="profile-role">운영자</span>}
            {profile?.role === 'owner' && <span className="profile-role">주인장</span>}
          </div>
          {missing && <p className="profile-bio">탈퇴했거나 아직 이메일 확인을 마치지 않은 계정입니다.</p>}
          {profile && (profile.bio || mine) && (
            <p className={cx('profile-bio', !profile.bio && 'is-empty')}>
              {profile.bio || '아직 소개가 없습니다. 아래 프로필 고치기에서 한 줄 남겨 보세요.'}
            </p>
          )}
          {profile && (
            <p className="community-meta profile-stats">
              <span>{formatDate(profile.createdAt)} 가입</span>
              <span>글 {profile.postCount}</span>
              <span>댓글 {profile.commentCount}</span>
            </p>
          )}
          <FormStatus status={photoNote} />
        </div>
      </div>

      {mine && profile && user && (
        <div className="profile-owner">
          <section className="profile-block" aria-labelledby="profile-edit-title">
            <h3 id="profile-edit-title">프로필 고치기</h3>
            <ProfileForm profile={profile} onSaved={saveProfile} />
          </section>
          <section className="profile-block" aria-labelledby="account-title">
            <h3 id="account-title">계정</h3>
            <p className="community-meta">
              로그인 이메일 <b>{user.email}</b>
              <br />
              이메일은 나에게만 보입니다.
            </p>
            <PasswordForm onStatus={setAccountStatus} />
            <FormStatus status={accountStatus} />
            <button className="text-btn profile-logout" type="button" onClick={() => logout((message) => setAccountStatus({ message, tone: 'error' }))}>
              로그아웃
            </button>
          </section>
        </div>
      )}

      {!missing && (
        <section className="profile-posts" aria-labelledby="profile-posts-title">
          <h3 id="profile-posts-title">{mine ? '내가 쓴 글' : '쓴 글'}</h3>
          {profile && (
            <PostList
              author={profile.id}
              emptyText={mine ? '아직 쓴 글이 없습니다. 첫 글을 남겨 보세요.' : '아직 쓴 글이 없습니다.'}
              errorText="글 목록을 불러오지 못했습니다."
            />
          )}
        </section>
      )}
    </Sheet>
  );
}

