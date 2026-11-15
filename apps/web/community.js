const $ = (selector, root = document) => root.querySelector(selector);
const params = new URLSearchParams(location.search);
const dateText = (value) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
const draftKey = 'community-post-draft';
let user = null;
let openedPost = null;
let openedProfile = null;
let profileCursor = null;
let uploadsEnabled = false;
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

function showSection(which) {
  for (const id of ['feed-section', 'post-section', 'profile-section', 'editor-section']) {
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
    if (editPostId || params.has('write')) location.href = 'community.html';
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
  else if (params.has('edit')) await showEditor(params.get('edit'));
  else if (params.has('write')) await showEditor();
  else { showSection('feed-section'); await loadPosts(); }
})();
