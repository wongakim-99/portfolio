// 방문 수와 메시지 폼. API 가 실패해도 페이지 내용은 그대로 보이게 둠
const postJson = (path, body) =>
  fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

const viewCount = document.getElementById('view-count');
postJson('/views')
  .then((res) => (res.ok ? res.json() : Promise.reject(res)))
  .then(({ total }) => {
    viewCount.textContent = ` / 방문 ${total.toLocaleString('ko-KR')}`;
    viewCount.hidden = false;
  })
  .catch(() => {});

const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');
const FALLBACK = '지금은 보낼 수 없어요. 메일로 연락해 주세요.';
const STATUS_TEXT = {
  201: '보냈어요. 남겨 주셔서 고맙습니다.',
  400: '입력한 내용을 다시 확인해 주세요. 메시지는 5자 이상이어야 해요.',
  429: '잠시 뒤에 다시 보내 주세요.',
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const button = form.querySelector('button');
  button.disabled = true;
  status.dataset.state = '';
  status.textContent = '보내는 중...';
  try {
    const res = await postJson('/messages', Object.fromEntries(new FormData(form)));
    status.textContent = STATUS_TEXT[res.status] ?? FALLBACK;
    status.dataset.state = res.ok ? 'ok' : 'error';
    if (res.ok) form.reset();
  } catch {
    status.textContent = FALLBACK;
    status.dataset.state = 'error';
  } finally {
    button.disabled = false;
  }
});
