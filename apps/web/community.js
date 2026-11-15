const $ = (selector, root = document) => root.querySelector(selector);
const params = new URLSearchParams(location.search);
const dateText = (value) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
const dateTimeText = (value) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const reasonText = { spam: '광고 / 스팸', abuse: '모욕 / 괴롭힘', other: '기타' };
const draftKey = 'community-post-draft';
let user = null;
let openedPost = null;
let openedProfile = null;
let profileCursor = null;
let uploadsEnabled = false;
let inboxCursor = null;
let editPostId = null;
let postCursor = null;
let commentCursor = null;
let reportTarget = null;
let loginNext = null;
let resetToken = null;

async function request(path, { method = 'GET', body, file } = {}) {
  const response = await fetch(`/api/community${path}`, {
    method,
    credentials: 'same-origin',
    headers: file ? { 'Content-Type': file.type } : body ? { 'Content-Type': 'application/json' } : undefined,
    body: file ?? (body ? JSON.stringify(body) : undefined),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(' ') : data.message;
    const error = new Error(message || '요청을 처리하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function status(selector, message, state = '') {
  const element = $(selector);
  element.textContent = message;
  element.dataset.state = state;
}

function button(text, onClick, className = 'text-btn') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = text;
  element.addEventListener('click', onClick);
  return element;
}

// 버튼을 보이거나 숨기는 데만 씀. 실제 허용 여부는 서버가 요청마다 역할로 다시 확인함
const can = (permission) => Boolean(user?.permissions?.includes(permission));

function showSection(which) {
  for (const id of ['feed-section', 'post-section', 'profile-section', 'admin-section', 'editor-section']) {
    $(`#${id}`).hidden = id !== which;
  }
}

// 사진이 없으면 포스트잇 색 위에 이름 첫 글자를 손글씨로 씀. 색은 사용자마다 고정
function avatar(person, className = 'avatar') {
  const box = document.createElement('span');
  box.className = className;
  box.setAttribute('aria-hidden', 'true');
  const sticky = [...person.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4 + 1;
  box.style.setProperty('--avatar-bg', `var(--sticky-${sticky})`);
  if (person.avatarUrl) {
    const image = document.createElement('img');
    image.src = person.avatarUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    box.append(image);
  } else {
    box.textContent = [...person.name.trim()][0] ?? '?';
  }
  return box;
}

function authorLink(item) {
  const link = document.createElement('a');
  link.className = 'community-author';
  link.href = `community.html?user=${encodeURIComponent(item.authorId)}`;
  const name = document.createElement('span');
  name.textContent = item.authorName;
  link.append(avatar({ id: item.authorId, name: item.authorName, avatarUrl: item.authorAvatarUrl }), name);
  return link;
}

function metaLine(element, items) {
  element.replaceChildren();
  for (const item of items) {
    if (typeof item === 'string') {
      const span = document.createElement('span');
      span.textContent = item;
      element.append(span);
    } else {
      element.append(item);
    }
  }
}

function updateUser() {
  $('#auth-open').hidden = Boolean(user);
  $('#me-link').hidden = !user;
  $('#user-label').textContent = user ? `${user.name}님` : '';
  $('#comment-form').hidden = !user;
  $('#comment-login').hidden = Boolean(user);
  if (user) {
    $('#me-link').href = `community.html?user=${encodeURIComponent(user.id)}`;
    $('#me-avatar').replaceChildren(avatar(user));
    $('#account-email').textContent = user.email;
  }
  $('#admin-link').hidden = !can('messages:read');
  if (can('messages:read')) loadAdminSummary();
}

async function loadAdminSummary() {
  try {
    const { unreadMessages } = await request('/admin/summary');
    setUnread(unreadMessages);
  } catch { /* 배지만 못 보여 줄 뿐 다른 화면에는 영향 없음 */ }
}
function setUnread(count) {
  const badge = $('#admin-badge');
  badge.hidden = !count;
  badge.textContent = count > 99 ? '99+' : String(count);
  $('#admin-link').setAttribute('aria-label', count ? `관리실, 새 쪽지 ${count}개` : '관리실');
}

const lamp = $('#lamp');
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === 'dark' : darkQuery.matches;
function syncLamp() {
  const dark = isDark();
  lamp.setAttribute('aria-pressed', String(!dark));
  $('#lamp-text').textContent = dark ? '스탠드 켜기' : '스탠드 끄기';
}
lamp.addEventListener('click', () => {
  const dark = !isDark();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('lamp', JSON.stringify(dark ? 'off' : 'on')); } catch {}
  syncLamp();
});
darkQuery.addEventListener('change', syncLamp);
syncLamp();

function openAuth(next = null) {
  loginNext = next;
  $('#auth-dialog').showModal();
  authTab('login');
}
function closeAuth() { $('#auth-dialog').close(); }
$('#auth-open').addEventListener('click', () => openAuth());
$('#auth-close').addEventListener('click', closeAuth);
$('#comment-login-button').addEventListener('click', () => openAuth());
$('#auth-dialog').addEventListener('click', (event) => {
  if (event.target === $('#auth-dialog')) closeAuth();
});

function authTab(which) {
  const login = which === 'login';
  $('#login-form').hidden = !login;
  $('#register-form').hidden = which !== 'register';
  $('#reset-request-form').hidden = which !== 'forgot';
  $('#login-tab').setAttribute('aria-selected', String(login));
  $('#register-tab').setAttribute('aria-selected', String(which === 'register'));
  $('#auth-title').textContent = login ? '피드 로그인' : which === 'register' ? '피드 가입' : '비밀번호 찾기';
  $('#resend-open').hidden = true;
  status('#auth-status', '');
  $(login ? '#login-email' : which === 'register' ? '#register-email' : '#reset-request-email').focus();
}
$('#login-tab').addEventListener('click', () => authTab('login'));
$('#register-tab').addEventListener('click', () => {
  if (!$('#register-tab').disabled) authTab('register');
});
$('#forgot-open').addEventListener('click', () => {
  $('#reset-request-email').value = $('#login-email').value;
  authTab('forgot');
});
$('#resend-open').addEventListener('click', async () => {
  const form = $('#login-form');
  if (!form.reportValidity()) return;
  try {
    await request('/auth/resend', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    status('#auth-status', '가입한 주소라면 확인 메일을 다시 보냈습니다.', 'ok');
  } catch (error) { status('#auth-status', error.message, 'error'); }
});

for (const [formId, route] of [['login-form', '/auth/login'], ['register-form', '/auth/register']]) {
  $(`#${formId}`).addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const submit = $('button[type="submit"]', form);
    submit.disabled = true;
    status('#auth-status', route.endsWith('register') ? '계정을 만드는 중입니다.' : '로그인하는 중입니다.');
    try {
      const result = await request(route, { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      if (route.endsWith('register')) {
        status('#auth-status', '가입할 수 있는 주소라면 확인 메일을 보냈습니다. 메일의 링크를 열어 가입을 완료해 주세요.', 'ok');
        form.reset();
        return;
      }
      const signedIn = result.user;
      user = signedIn;
      updateUser();
      closeAuth();
      form.reset();
      if (loginNext) location.href = loginNext;
      else if (openedPost) {
        renderPostActions(openedPost);
        loadComments(openedPost.id, true);
      } else if (openedProfile) renderProfile();
    } catch (error) {
      status('#auth-status', error.message, 'error');
      $('#resend-open').hidden = error.status !== 403;
    } finally {
      submit.disabled = false;
    }
  });
}

$('#reset-request-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = $('button[type="submit"]', form);
  submit.disabled = true;
  try {
    await request('/auth/reset-request', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    status('#auth-status', '등록된 주소라면 비밀번호 재설정 링크를 보냈습니다.', 'ok');
  } catch (error) { status('#auth-status', error.message, 'error'); }
  finally { submit.disabled = false; }
});

$('#verification-close').addEventListener('click', () => $('#verification-dialog').close());
$('#reset-close').addEventListener('click', () => $('#reset-dialog').close());
$('#reset-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity() || !resetToken) return;
  const submit = $('button[type="submit"]', form);
  submit.disabled = true;
  try {
    await request('/auth/reset', { method: 'POST', body: { token: resetToken, newPassword: $('#reset-password').value } });
    resetToken = null;
    user = null;
    updateUser();
    form.reset();
    status('#reset-status', '비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.', 'ok');
  } catch (error) { status('#reset-status', error.message, 'error'); }
  finally { submit.disabled = false; }
});
$('#password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = $('button[type="submit"]', form);
  submit.disabled = true;
  try {
    await request('/auth/password', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    form.reset();
    status('#account-status', '비밀번호를 변경했습니다. 다른 기기의 로그인은 해제됩니다.', 'ok');
  } catch (error) {
    status('#account-status', error.message, 'error');
  } finally {
    submit.disabled = false;
  }
});
$('#logout').addEventListener('click', async () => {
  try {
    await request('/auth/logout', { method: 'POST' });
    user = null;
    updateUser();
    if (editPostId || params.has('write') || params.has('admin')) location.href = 'community.html';
    else if (openedPost) renderPostActions(openedPost);
    else if (openedProfile) renderProfile();
  } catch (error) {
    status('#account-status', error.message, 'error');
  }
});

$('#write-open').addEventListener('click', () => {
  if (!user) openAuth('community.html?write=1');
  else location.href = 'community.html?write=1';
});

function postRow(post, { showAuthor = true } = {}) {
  const article = document.createElement('article');
  article.className = 'community-post';
  const link = document.createElement('a');
  link.href = `community.html?post=${encodeURIComponent(post.id)}`;
  link.textContent = post.title;
  const excerpt = document.createElement('p');
  excerpt.textContent = post.excerpt.length >= 220 ? `${post.excerpt}…` : post.excerpt;
  const meta = document.createElement('div');
  meta.className = 'community-meta';
  metaLine(meta, [...(showAuthor ? [authorLink(post)] : []), dateText(post.createdAt), `댓글 ${post.commentCount}`]);
  article.append(link, excerpt, meta);
  return article;
}

async function loadPosts() {
  const list = $('#post-list');
  try {
    const query = postCursor ? `?before=${encodeURIComponent(postCursor)}` : '';
    const data = await request(`/posts${query}`);
    if (!postCursor) list.replaceChildren();
    if (!data.posts.length && !postCursor) {
      const empty = document.createElement('p');
      empty.className = 'community-empty';
      empty.textContent = '아직 글이 없습니다. 첫 글을 남겨 주세요.';
      list.append(empty);
    }
    for (const post of data.posts) list.append(postRow(post));
    postCursor = data.nextCursor;
    $('#posts-more').hidden = !postCursor;
  } catch {
    if (!postCursor) list.replaceChildren();
    const message = document.createElement('p');
    message.className = 'community-empty';
    message.textContent = '지금은 글을 불러오지 못합니다. 잠시 뒤에 다시 시도해 주세요.';
    list.append(message, button('다시 시도', () => { postCursor = null; loadPosts(); }));
  }
}
$('#posts-more').addEventListener('click', loadPosts);

function beginReport(targetType, targetId) {
  if (!user) return openAuth();
  reportTarget = { targetType, targetId };
  status('#report-status', '');
  $('#report-dialog').showModal();
}
$('#report-close').addEventListener('click', () => $('#report-dialog').close());
$('#report-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await request('/reports', { method: 'POST', body: { ...reportTarget, reason: $('#report-reason').value } });
    status('#report-status', '신고를 접수했습니다.', 'ok');
  } catch (error) {
    status('#report-status', error.message, 'error');
  }
});

function renderPostActions(post) {
  const actions = $('#post-actions');
  actions.replaceChildren();
  if (user?.id === post.authorId) {
    actions.append(
      button('수정', () => { location.href = `community.html?edit=${encodeURIComponent(post.id)}`; }),
      button('삭제', async () => {
        if (!confirm('이 글과 댓글을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.')) return;
        try {
          await request(`/posts/${post.id}`, { method: 'DELETE' });
          location.href = 'community.html';
        } catch (error) { status('#comment-status', error.message, 'error'); }
      }),
    );
  } else {
    actions.append(button('신고', () => beginReport('post', post.id)));
    if (can('content:moderate')) {
      actions.append(button('관리자 삭제', async () => {
        if (!confirm('관리자 권한으로 이 글과 댓글을 삭제할까요? 되돌릴 수 없습니다.')) return;
        try {
          await request(`/admin/posts/${post.id}`, { method: 'DELETE' });
          location.href = 'community.html';
        } catch (error) { status('#comment-status', error.message, 'error'); }
      }, 'text-btn text-btn-danger'));
    }
  }
  $('#comment-form').hidden = !user;
  $('#comment-login').hidden = Boolean(user);
}

function renderPostMeta(post) {
  metaLine($('#post-meta'), [authorLink(post), dateText(post.createdAt), `댓글 ${post.commentCount}`]);
}

function commentRow(comment) {
  const article = document.createElement('article');
  article.className = 'community-comment';
  const meta = document.createElement('p');
  meta.className = 'community-meta';
  metaLine(meta, [authorLink(comment), dateText(comment.createdAt)]);
  const body = document.createElement('p');
  body.textContent = comment.body;
  const actions = document.createElement('div');
  actions.className = 'community-inline-actions';
  if (user?.id === comment.authorId) {
    actions.append(
      button('수정', () => {
        const form = document.createElement('form');
        form.className = 'community-form';
        const input = document.createElement('textarea');
        input.value = comment.body;
        input.required = true;
        input.minLength = 2;
        input.maxLength = 2000;
        const controls = document.createElement('div');
        controls.className = 'community-inline-actions';
        const save = document.createElement('button');
        save.type = 'submit';
        save.className = 'tape';
        save.textContent = '저장';
        controls.append(save, button('취소', () => form.replaceWith(body)));
        form.append(input, controls);
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!form.reportValidity()) return;
          save.disabled = true;
          try {
            await request(`/comments/${comment.id}`, { method: 'PATCH', body: { body: input.value } });
            comment.body = input.value.trim();
            body.textContent = comment.body;
            form.replaceWith(body);
          } catch (error) { status('#comment-status', error.message, 'error'); }
          finally { save.disabled = false; }
        });
        body.replaceWith(form);
        input.focus();
      }),
      button('삭제', async () => {
        if (!confirm('이 댓글을 삭제할까요?')) return;
        try {
          await request(`/comments/${comment.id}`, { method: 'DELETE' });
          article.remove();
          openedPost.commentCount = Math.max(0, openedPost.commentCount - 1);
          renderPostMeta(openedPost);
        } catch (error) { status('#comment-status', error.message, 'error'); }
      }),
    );
  } else {
    actions.append(button('신고', () => beginReport('comment', comment.id)));
    if (can('content:moderate')) {
      actions.append(button('관리자 삭제', async () => {
        if (!confirm('관리자 권한으로 이 댓글을 삭제할까요?')) return;
        try {
          await request(`/admin/comments/${comment.id}`, { method: 'DELETE' });
          article.remove();
          openedPost.commentCount = Math.max(0, openedPost.commentCount - 1);
          renderPostMeta(openedPost);
        } catch (error) { status('#comment-status', error.message, 'error'); }
      }, 'text-btn text-btn-danger'));
    }
  }
  article.append(meta, body, actions);
  return article;
}

async function loadComments(postId, reset = false) {
  if (reset) commentCursor = null;
  const list = $('#comment-list');
  try {
    const query = commentCursor ? `?after=${encodeURIComponent(commentCursor)}` : '';
    const data = await request(`/posts/${postId}/comments${query}`);
    if (reset) list.replaceChildren();
    if (!data.comments.length && !commentCursor) {
      const empty = document.createElement('p');
      empty.className = 'community-empty';
      empty.textContent = '아직 댓글이 없습니다.';
      list.append(empty);
    }
    for (const comment of data.comments) list.append(commentRow(comment));
    commentCursor = data.nextCursor;
    $('#comments-more').hidden = !commentCursor;
  } catch {
    status('#comment-status', '댓글을 불러오지 못했습니다. 다시 시도해 주세요.', 'error');
  }
}
$('#comments-more').addEventListener('click', () => loadComments(openedPost.id));

async function showPost(id) {
  showSection('post-section');
  try {
    const post = await request(`/posts/${encodeURIComponent(id)}`);
    openedPost = post;
    $('#post-title').textContent = post.title;
    renderPostMeta(post);
    $('#post-body').textContent = post.body;
    document.title = `${post.title} | 김가원 피드`;
    renderPostActions(post);
    await loadComments(post.id, true);
  } catch {
    $('#post-title').textContent = '글을 찾을 수 없습니다';
    $('#post-body').textContent = '삭제되었거나 지금은 읽을 수 없는 글입니다.';
    $('#comment-form').hidden = true;
    $('#comment-login').hidden = true;
  }
}

$('#comment-body').addEventListener('input', () => {
  $('#comment-count').textContent = `${$('#comment-body').value.length.toLocaleString('ko-KR')} / 2,000`;
});
$('#comment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity() || !openedPost) return;
  const submit = $('button[type="submit"]', form);
  submit.disabled = true;
  try {
    await request(`/posts/${openedPost.id}/comments`, { method: 'POST', body: { body: $('#comment-body').value } });
    openedPost.commentCount += 1;
    renderPostMeta(openedPost);
    form.reset();
    $('#comment-count').textContent = '0 / 2,000';
    status('#comment-status', '댓글을 등록했습니다.', 'ok');
    await loadComments(openedPost.id, true);
  } catch (error) { status('#comment-status', error.message, 'error'); }
  finally { submit.disabled = false; }
});

function renderProfile() {
  const profile = openedProfile;
  const mine = user?.id === profile.id;
  $('#profile-hand').textContent = mine ? '내 페이지' : `${profile.name}님의 페이지`;
  $('#profile-name').textContent = profile.name;
  $('#profile-role').hidden = profile.role !== 'admin';
  $('#profile-photo').replaceChildren(avatar(profile));
  const bio = $('#profile-bio');
  bio.textContent = profile.bio || (mine ? '아직 소개가 없습니다. 아래 프로필 고치기에서 한 줄 남겨 보세요.' : '');
  bio.classList.toggle('is-empty', !profile.bio);
  bio.hidden = !profile.bio && !mine;
  metaLine($('#profile-stats'), [`${dateText(profile.createdAt)} 가입`, `글 ${profile.postCount}`, `댓글 ${profile.commentCount}`]);
  $('#avatar-actions').hidden = !mine || !uploadsEnabled;
  $('#avatar-remove').hidden = !profile.avatarUrl;
  $('#profile-owner').hidden = !mine;
  $('#profile-posts-title').textContent = mine ? '내가 쓴 글' : '쓴 글';
  if (mine) {
    $('#profile-name-input').value = profile.name;
    $('#profile-bio-input').value = profile.bio;
  }
  if (!mine) status('#avatar-status', '');
  else if (!uploadsEnabled) status('#avatar-status', '사진 올리기는 저장소 설정을 마친 뒤 열립니다.');
}

async function loadProfilePosts() {
  const list = $('#profile-post-list');
  try {
    const query = new URLSearchParams({ author: openedProfile.id });
    if (profileCursor) query.set('before', profileCursor);
    const data = await request(`/posts?${query}`);
    if (!profileCursor) list.replaceChildren();
    if (!data.posts.length && !profileCursor) {
      const empty = document.createElement('p');
      empty.className = 'community-empty';
      empty.textContent = user?.id === openedProfile.id ? '아직 쓴 글이 없습니다. 첫 글을 남겨 보세요.' : '아직 쓴 글이 없습니다.';
      list.append(empty);
    }
    for (const post of data.posts) list.append(postRow(post, { showAuthor: false }));
    profileCursor = data.nextCursor;
    $('#profile-posts-more').hidden = !profileCursor;
  } catch {
    const message = document.createElement('p');
    message.className = 'community-empty';
    message.textContent = '글 목록을 불러오지 못했습니다.';
    list.replaceChildren(message);
  }
}
$('#profile-posts-more').addEventListener('click', loadProfilePosts);

async function showProfile(id) {
  showSection('profile-section');
  try {
    openedProfile = await request(`/users/${encodeURIComponent(id)}`);
    document.title = `${openedProfile.name} | 김가원 피드`;
    renderProfile();
    profileCursor = null;
    await loadProfilePosts();
  } catch {
    $('#profile-name').textContent = '사용자를 찾을 수 없습니다';
    $('#profile-bio').textContent = '탈퇴했거나 아직 이메일 확인을 마치지 않은 계정입니다.';
    $('#profile-photo').hidden = true;
    $('.profile-posts').hidden = true;
  }
}

$('#profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = $('button[type="submit"]', form);
  submit.disabled = true;
  try {
    const { user: profile } = await request('/me/profile', { method: 'PATCH', body: Object.fromEntries(new FormData(form)) });
    openedProfile = profile;
    user = { ...user, name: profile.name };
    updateUser();
    renderProfile();
    document.title = `${profile.name} | 김가원 피드`;
    status('#profile-status', '프로필을 저장했습니다.', 'ok');
  } catch (error) { status('#profile-status', error.message, 'error'); }
  finally { submit.disabled = false; }
});

// 고른 사진을 가운데 기준 정사각형으로 잘라 512px 이하로 다시 그림
// 다시 그리면서 촬영 위치 같은 사진 속 정보(EXIF)는 빠지고 파일도 작아짐
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이 사진은 열 수 없습니다. JPG나 PNG 사진으로 골라 주세요.')); };
    image.src = url;
  });
}
async function squarePhoto(file) {
  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const size = Math.min(512, side);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size);
  const encode = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode('image/webp', 0.86);
  return webp?.type === 'image/webp' ? webp : encode('image/jpeg', 0.88);
}

$('#avatar-pick').addEventListener('click', () => $('#avatar-file').click());
$('#avatar-file').addEventListener('change', async (event) => {
  const input = event.currentTarget;
  const [file] = input.files;
  input.value = '';
  if (!file) return;
  const pick = $('#avatar-pick');
  pick.disabled = true;
  status('#avatar-status', '사진을 다듬어 올리는 중입니다.');
  try {
    if (file.size > 40 * 1024 * 1024) throw new Error('40MB 이하 사진을 골라 주세요.');
    const photo = await squarePhoto(file);
    if (!photo) throw new Error('사진을 변환하지 못했습니다. 다른 사진으로 골라 주세요.');
    const { avatarUrl } = await request('/me/avatar', { method: 'PUT', file: photo });
    openedProfile.avatarUrl = avatarUrl;
    user = { ...user, avatarUrl };
    updateUser();
    renderProfile();
    status('#avatar-status', '프로필 사진을 바꿨습니다.', 'ok');
  } catch (error) {
    status('#avatar-status', error.status === 413 ? '사진이 너무 큽니다. 다른 사진으로 골라 주세요.' : error.message, 'error');
  } finally { pick.disabled = false; }
});
$('#avatar-remove').addEventListener('click', async () => {
  if (!confirm('프로필 사진을 지울까요?')) return;
  try {
    await request('/me/avatar', { method: 'DELETE' });
    openedProfile.avatarUrl = null;
    user = { ...user, avatarUrl: null };
    updateUser();
    renderProfile();
    status('#avatar-status', '프로필 사진을 지웠습니다.', 'ok');
  } catch (error) { status('#avatar-status', error.message, 'error'); }
});

function inboxCard(item) {
  const article = document.createElement('article');
  article.className = 'inbox-card';
  const head = document.createElement('header');
  head.className = 'inbox-head';
  const from = document.createElement('p');
  from.className = 'inbox-from';
  const name = document.createElement('b');
  name.textContent = item.name;
  from.append(name);
  if (!item.readAt) {
    const fresh = document.createElement('span');
    fresh.className = 'inbox-new';
    fresh.textContent = '새 쪽지';
    head.append(from, fresh);
  } else {
    head.append(from);
  }
  const body = document.createElement('p');
  body.className = 'inbox-body';
  body.textContent = item.message;
  const foot = document.createElement('div');
  foot.className = 'community-meta inbox-foot';
  const when = document.createElement('span');
  when.textContent = dateTimeText(item.createdAt);
  foot.append(when);
  if (item.email) {
    const reply = document.createElement('a');
    reply.className = 'text-btn';
    reply.href = `mailto:${item.email}?subject=${encodeURIComponent('[김가원 포트폴리오] 쪽지 답장')}`;
    reply.textContent = `${item.email}로 답장`;
    foot.append(reply);
  } else {
    const none = document.createElement('span');
    none.textContent = '답장 메일 없음';
    foot.append(none);
  }
  if (can('messages:delete')) {
    foot.append(button('삭제', async () => {
      if (!confirm(`${item.name}님의 쪽지를 삭제할까요?`)) return;
      try {
        await request(`/admin/messages/${item.id}`, { method: 'DELETE' });
        article.remove();
        if (!$('#inbox-list').children.length) emptyLine($('#inbox-list'), '받은 쪽지가 없습니다.');
      } catch (error) { status('#admin-status', error.message, 'error'); }
    }));
  }
  article.append(head, body, foot);
  return article;
}

function emptyLine(list, text) {
  const empty = document.createElement('p');
  empty.className = 'community-empty';
  empty.textContent = text;
  list.replaceChildren(empty);
}

async function loadInbox() {
  const list = $('#inbox-list');
  try {
    const data = await request(`/admin/messages${inboxCursor ? `?before=${encodeURIComponent(inboxCursor)}` : ''}`);
    if (!inboxCursor) {
      list.replaceChildren();
      $('#inbox-meta').textContent = data.unread ? `새 쪽지 ${data.unread}개` : '모두 읽음';
      if (!data.messages.length) emptyLine(list, '받은 쪽지가 없습니다. 홈의 엽서로 쪽지가 오면 여기에 쌓입니다.');
      // 지금 화면에는 '새 쪽지' 표시를 남겨 두고, 다음에 열 때부터는 읽은 것으로 봄
      if (data.unread) request('/admin/messages/read', { method: 'POST' }).then(() => setUnread(0), () => {});
    }
    for (const item of data.messages) list.append(inboxCard(item));
    inboxCursor = data.nextCursor;
    $('#inbox-more').hidden = !inboxCursor;
  } catch (error) { emptyLine(list, error.message); }
}
$('#inbox-more').addEventListener('click', loadInbox);

function reportRow(report) {
  const article = document.createElement('article');
  article.className = 'admin-report';
  const head = document.createElement('p');
  head.className = 'community-meta';
  metaLine(head, [reasonText[report.reason] ?? report.reason, report.targetType === 'post' ? '글' : '댓글', dateTimeText(report.createdAt)]);
  const target = document.createElement('p');
  target.className = 'admin-report-target';
  if (report.target) {
    const link = document.createElement('a');
    link.href = `community.html?post=${encodeURIComponent(report.target.postId)}`;
    link.textContent = report.target.text;
    const by = document.createElement('span');
    by.textContent = ` (${report.target.authorName})`;
    target.append(link, by);
  } else {
    target.textContent = '이미 지워진 내용입니다.';
  }
  const actions = document.createElement('div');
  actions.className = 'community-inline-actions';
  const run = async (path, done) => {
    try {
      await request(path, { method: 'DELETE' });
      done();
    } catch (error) { status('#admin-status', error.message, 'error'); }
  };
  if (report.target && can('content:moderate')) {
    const kind = report.targetType === 'post' ? '글' : '댓글';
    actions.append(button(`${kind} 삭제`, () => {
      if (!confirm(`신고된 ${kind}을 삭제할까요? 되돌릴 수 없습니다.`)) return;
      run(`/admin/${report.targetType}s/${report.targetId}`, () => { status('#admin-status', `${kind}을 삭제했습니다.`, 'ok'); loadReports(); });
    }, 'text-btn text-btn-danger'));
  }
  if (can('reports:dismiss')) {
    actions.append(button('신고 닫기', () => run(`/admin/reports/${report.id}`, () => {
      article.remove();
      if (!$('#admin-report-list').children.length) emptyLine($('#admin-report-list'), '처리할 신고가 없습니다.');
    })));
  }
  article.append(head, target, actions);
  return article;
}

async function loadReports() {
  const list = $('#admin-report-list');
  try {
    const { reports } = await request('/admin/reports');
    $('#reports-meta').textContent = reports.length ? `${reports.length}건` : '';
    if (!reports.length) return emptyLine(list, '처리할 신고가 없습니다.');
    list.replaceChildren(...reports.map(reportRow));
  } catch (error) { emptyLine(list, error.message); }
}

// 관리실 '지금 서버'. 실제 요청, DB 명령, 사진 저장소 작업을 2초마다 받아 일어난 간격 그대로 점으로 흘려보냄
// 페이지 요청은 방문자에서 api 까지 들어갔다가 응답 색으로 돌아오고, DB 와 저장소 작업은 api 에서 오감
const topology = (() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const LAYOUTS = {
    wide: {
      view: [960, 300], box: [124, 58], host: [330, 22, 612, 256], hostLabel: 'top',
      at: { visitors: [70, 150], funnel: [245, 150], web: [425, 150], api: [605, 150], mongo: [845, 84], minio: [845, 216] },
    },
    tall: {
      view: [360, 630], box: [140, 54], host: [14, 214, 332, 404], hostLabel: 'bottom',
      at: { visitors: [180, 44], funnel: [180, 140], web: [180, 262], api: [180, 380], mongo: [95, 548], minio: [265, 548] },
    },
  };
  const NODES = [
    ['visitors', '방문자'], ['funnel', 'Funnel'], ['web', 'web (Caddy)'],
    ['api', 'api (NestJS)'], ['mongo', 'mongo'], ['minio', 'minio'],
  ];
  const EDGES = [['visitors', 'funnel', 'http'], ['funnel', 'web', 'http'], ['web', 'api', 'http'], ['api', 'mongo', 'db'], ['api', 'minio', 'storage']];
  const ROUTES = { http: ['visitors', 'funnel', 'web', 'api'], db: ['api', 'mongo'], storage: ['api', 'minio'] };
  const LAG_MS = 2200;
  const clock = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const packets = new Set();
  const pulses = new Map();
  const recent = [];
  let stage = null;
  let svg = null;
  let packetLayer = null;
  let layout = null;
  let last = null;
  let cursor = null;
  let skew = 0;
  let timer = null;
  let frame = null;
  let running = false;

  const node = (name, attrs = {}, parent = null) => {
    const element = document.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    parent?.append(element);
    return element;
  };
  const duration = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return days ? `${days}일 ${hours}시간` : hours ? `${hours}시간 ${minutes}분` : `${minutes}분`;
  };

  function build() {
    const next = LAYOUTS[stage.clientWidth < 640 ? 'tall' : 'wide'];
    if (svg && next === layout) return;
    layout = next;
    for (const packet of packets) packet.dot.remove();
    packets.clear();
    svg = node('svg', {
      viewBox: `0 0 ${layout.view.join(' ')}`, class: 'topology-svg', role: 'img',
      'aria-label': '서버 구성도. 방문자가 Tailscale Funnel, Caddy, NestJS 를 거쳐 MongoDB 와 MinIO 로 이어짐',
    });
    const [hx, hy, hw, hh] = layout.host;
    node('rect', { x: hx, y: hy, width: hw, height: hh, rx: 14, class: 'topology-host-box' }, svg);
    const labelY = layout.hostLabel === 'top' ? hy + 20 : hy + hh - 12;
    node('text', { x: hx + 14, y: labelY, class: 'topology-host-label' }, svg).textContent = 'gawon-dev 노트북 / Docker';
    const edges = node('g', {}, svg);
    packetLayer = node('g', {}, svg);
    const boxes = node('g', {}, svg);
    for (const [from, to, kind] of EDGES) {
      const [x1, y1] = layout.at[from];
      const [x2, y2] = layout.at[to];
      node('line', { x1, y1, x2, y2, class: 'topology-edge' }, edges);
      // 선의 한쪽 옆에 분당 횟수를 적음. 세로선이면 오른쪽, 가로선이면 위
      const length = Math.hypot(x2 - x1, y2 - y1);
      const [nx, ny] = [(y2 - y1) / length, -(x2 - x1) / length];
      node('text', {
        x: (x1 + x2) / 2 + nx * 12, y: (y1 + y2) / 2 + ny * 12 + 4, class: 'topology-rate', 'data-rate': kind,
        'text-anchor': nx > 0.5 ? 'start' : nx < -0.5 ? 'end' : 'middle',
      }, edges);
    }
    const [width, height] = layout.box;
    for (const [key, title] of NODES) {
      const [cx, cy] = layout.at[key];
      const group = node('g', { class: `topology-node${key === 'visitors' ? ' is-outside' : ''}`, 'data-node': key, transform: `translate(${cx} ${cy})` }, boxes);
      const body = node('g', { class: 'topology-node-body' }, group);
      node('rect', { x: -width / 2, y: -height / 2, width, height, rx: 9 }, body);
      node('text', { x: -width / 2 + 12, y: -4, class: 'topology-title' }, body).textContent = title;
      node('text', { x: -width / 2 + 12, y: 15, class: 'topology-stat', 'data-stat': key }, body);
      node('circle', { cx: width / 2 - 12, cy: -height / 2 + 12, r: 4.5, class: 'topology-led', 'data-led': key, 'data-state': 'unknown' }, body);
    }
    stage.replaceChildren(svg);
    if (last) render(last);
  }

  function pulse(key) {
    const group = svg?.querySelector(`[data-node="${key}"]`);
    if (!group) return;
    group.classList.add('is-hit');
    clearTimeout(pulses.get(key));
    pulses.set(key, setTimeout(() => group.classList.remove('is-hit'), 220));
  }

  function launch(event) {
    const route = ROUTES[event.kind];
    if (!svg || !route) return;
    if (reduced.matches) return pulse(route.at(-1));
    if (packets.size > 80) return;
    const dot = node('circle', { r: event.kind === 'http' ? 5 : 4, class: `topology-packet is-${event.kind}` }, packetLayer);
    const response = event.status >= 500 ? 'is-error' : event.status >= 400 ? 'is-warn' : event.kind === 'http' ? 'is-ok' : '';
    packets.add({
      dot, response, path: [...route, ...route.slice(0, -1).reverse()], turn: route.length - 1,
      hop: event.kind === 'http' ? 380 : 280, start: performance.now(), reached: -1,
    });
    frame ??= requestAnimationFrame(tick);
  }

  function tick(now) {
    for (const packet of packets) {
      const progress = (now - packet.start) / packet.hop;
      const index = Math.floor(progress);
      if (index >= packet.path.length - 1) {
        packet.dot.remove();
        packets.delete(packet);
        pulse(packet.path.at(-1));
        continue;
      }
      if (index !== packet.reached) {
        packet.reached = index;
        pulse(packet.path[index]);
        if (index === packet.turn && packet.response) packet.dot.classList.add(packet.response);
      }
      const [x1, y1] = layout.at[packet.path[index]];
      const [x2, y2] = layout.at[packet.path[index + 1]];
      const t = progress - index;
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      packet.dot.setAttribute('cx', x1 + (x2 - x1) * eased);
      packet.dot.setAttribute('cy', y1 + (y2 - y1) * eased);
    }
    frame = packets.size ? requestAnimationFrame(tick) : null;
  }

  // 서버에서 일어난 시각에 LAG_MS 를 더한 때에 재생해서, 2초마다 받아도 실제 간격대로 흘러감
  function replay(events) {
    events.slice(-80).forEach((event, index) => {
      const wait = Math.max(index * 35, event.at + skew + LAG_MS - Date.now());
      setTimeout(() => launch(event), Math.min(wait, 4000));
    });
  }

  function remember(events) {
    for (const event of events) if (event.kind === 'http') recent.unshift(event);
    recent.splice(12);
    $('#topology-log').replaceChildren(...recent.map((event) => {
      const item = document.createElement('li');
      item.className = event.status >= 500 ? 'is-error' : event.status >= 400 ? 'is-warn' : '';
      for (const text of [clock.format(event.at), event.label, String(event.status), `${event.ms}ms`]) {
        const span = document.createElement('span');
        span.textContent = text;
        item.append(span);
      }
      return item;
    }));
    if (!recent.length) {
      const item = document.createElement('li');
      item.textContent = '아직 들어온 요청이 없습니다.';
      $('#topology-log').append(item);
    }
  }

  function render(data) {
    last = data;
    const { nodes, rates } = data;
    const set = (key, text, state) => {
      svg.querySelector(`[data-stat="${key}"]`).textContent = text;
      svg.querySelector(`[data-led="${key}"]`).dataset.state = state;
    };
    const ms = (value) => (value === null ? '' : `, ${value}ms`);
    set('visitors', `5분 안 ${data.visitors}명`, data.visitors ? 'ok' : 'idle');
    set('funnel', 'Tailscale :443', 'ok');
    set('web', nodes.web.proxied ? '리버스 프록시' : '로컬 개발', 'ok');
    set('api', `${rates.http}/분${ms(nodes.api.httpMs)}`, 'ok');
    set('mongo', nodes.mongo.up ? `${rates.db}/분${ms(nodes.mongo.ms)}` : '연결 끊김', nodes.mongo.up ? (nodes.mongo.ms > 200 ? 'warn' : 'ok') : 'down');
    set('minio', !nodes.minio ? '설정 안 됨' : nodes.minio.up ? `${rates.storage}/분, ${nodes.minio.ms}ms` : '응답 없음',
      !nodes.minio ? 'idle' : nodes.minio.up ? 'ok' : 'down');
    for (const label of svg.querySelectorAll('[data-rate]')) label.textContent = `${rates[label.dataset.rate]}/분`;

    const { host } = data;
    const battery = host.battery
      ? `${host.battery.percent}% ${host.battery.charging ? '충전 중' : host.battery.pluggedIn ? '전원 연결' : '배터리 사용'}` : '없음';
    const rows = [
      ['CPU 온도', host.cpuTemp === null ? '센서 없음' : `${host.cpuTemp}°C`],
      ['부하 (1분)', `${host.load} / ${host.cores}코어`],
      ['메모리', `${host.memoryUsedPercent}%`],
      ['배터리', battery],
      ['노트북 가동', duration(host.uptime)],
      ['api 가동', `${duration(nodes.api.uptime)}, ${nodes.api.memoryMb}MB`],
      ['배포 버전', host.release?.commit ?? '로컬'],
    ];
    $('#topology-host').replaceChildren(...rows.map(([term, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = term;
      dd.textContent = value;
      row.append(dt, dd);
      return row;
    }));
  }

  async function poll() {
    timer = null;
    try {
      const data = await request(`/admin/topology${cursor === null ? '' : `?since=${cursor}`}`);
      skew = Date.now() - data.now;
      if (cursor !== null) replay(data.events);
      remember(data.events);
      cursor = data.cursor;
      render(data);
      $('#topology-meta').textContent = `2초마다 갱신, ${clock.format(Date.now())}`;
    } catch (error) {
      $('#topology-meta').textContent = error.status === 403 ? '이 계정에는 권한이 없습니다.' : '서버에 닿지 않습니다. 다시 시도하는 중';
      for (const led of svg?.querySelectorAll('[data-led]') ?? []) led.dataset.state = 'down';
    } finally {
      if (running && !document.hidden) timer = setTimeout(poll, 2000);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      stage = $('#topology-stage');
      build();
      new ResizeObserver(() => build()).observe(stage);
      // 다른 탭을 보는 동안에는 묻지 않고, 돌아오면 바로 다시 받음
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { clearTimeout(timer); timer = null; } else if (!timer) poll();
      });
      poll();
    },
  };
})();

async function showAdmin() {
  showSection('admin-section');
  document.title = '관리실 | 김가원 피드';
  if (!user) return openAuth(location.href);
  if (!can('messages:read') && !can('reports:read')) {
    $('#admin-lead').textContent = '관리자 권한이 있는 계정만 볼 수 있습니다.';
    $('#inbox-block').hidden = true;
    $('#reports-block').hidden = true;
    return;
  }
  $('#inbox-block').hidden = !can('messages:read');
  $('#reports-block').hidden = !can('reports:read');
  $('#topology-block').hidden = !can('server:read');
  if (can('server:read')) topology.start();
  await Promise.all([can('messages:read') && loadInbox(), can('reports:read') && loadReports()]);
}

function readDraft() {
  try { return JSON.parse(localStorage.getItem(draftKey)) ?? null; } catch { return null; }
}
function saveDraft() {
  if (editPostId) return;
  try { localStorage.setItem(draftKey, JSON.stringify({ title: $('#editor-heading').value, body: $('#editor-body').value })); } catch {}
}
for (const field of ['editor-heading', 'editor-body']) $(`#${field}`).addEventListener('input', saveDraft);
$('#editor-body').addEventListener('input', () => {
  $('#editor-count').textContent = `${$('#editor-body').value.length.toLocaleString('ko-KR')} / 20,000`;
});

async function showEditor(id = null) {
  showSection('editor-section');
  if (!user) return openAuth(location.href);
  if (id) {
    try {
      const post = await request(`/posts/${encodeURIComponent(id)}`);
      if (post.authorId !== user.id) return location.replace(`community.html?post=${encodeURIComponent(id)}`);
      editPostId = id;
      $('#editor-title').textContent = '글 수정하기';
      $('#editor-heading').value = post.title;
      $('#editor-body').value = post.body;
      $('#post-form button[type="submit"]').textContent = '수정 저장';
      $('#editor-count').textContent = `${post.body.length.toLocaleString('ko-KR')} / 20,000`;
    } catch { status('#editor-status', '글을 불러오지 못했습니다.', 'error'); }
  } else {
    const draft = readDraft();
    if (draft) {
      $('#editor-heading').value = draft.title ?? '';
      $('#editor-body').value = draft.body ?? '';
      $('#editor-count').textContent = `${$('#editor-body').value.length.toLocaleString('ko-KR')} / 20,000`;
    }
  }
}

$('#post-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = $('button[type="submit"]', form);
  submit.disabled = true;
  status('#editor-status', editPostId ? '수정하는 중입니다.' : '글을 올리는 중입니다.');
  try {
    const path = editPostId ? `/posts/${editPostId}` : '/posts';
    const method = editPostId ? 'PATCH' : 'POST';
    const { post } = await request(path, { method, body: { title: $('#editor-heading').value, body: $('#editor-body').value } });
    if (!editPostId) try { localStorage.removeItem(draftKey); } catch {}
    location.href = `community.html?post=${encodeURIComponent(post.id)}`;
  } catch (error) { status('#editor-status', error.message, 'error'); }
  finally { submit.disabled = false; }
});

(async () => {
  try {
    const config = await request('/auth/config');
    $('#register-tab').disabled = !config.registrationEnabled;
    $('#signup-note').hidden = config.registrationEnabled;
    uploadsEnabled = Boolean(config.uploadsEnabled);
  } catch {
    $('#register-tab').disabled = true;
    $('#signup-note').hidden = false;
  }
  const mailLink = new URLSearchParams(location.hash.slice(1));
  const verifyToken = mailLink.get('verify');
  resetToken = mailLink.get('reset');
  if (verifyToken || resetToken) history.replaceState(null, '', location.pathname + location.search);
  if (verifyToken) {
    $('#verification-dialog').showModal();
    try {
      user = (await request('/auth/verify', { method: 'POST', body: { token: verifyToken } })).user;
      status('#verification-status', '이메일 확인을 마쳤습니다. 이제 글과 댓글을 남길 수 있어요.', 'ok');
    } catch (error) { status('#verification-status', error.message, 'error'); }
  }
  if (!user) try { user = (await request('/auth/me')).user; } catch { user = null; }
  updateUser();
  if (resetToken) $('#reset-dialog').showModal();
  if (params.has('post')) await showPost(params.get('post'));
  else if (params.has('user')) await showProfile(params.get('user'));
  else if (params.has('admin')) await showAdmin();
  else if (params.has('edit')) await showEditor(params.get('edit'));
  else if (params.has('write')) await showEditor();
  else { showSection('feed-section'); await loadPosts(); }
})();
