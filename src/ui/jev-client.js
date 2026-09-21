export async function requestJevDecision(snapshot) {
  const response = await fetch('/api/jev/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  const body = await response.json();

  if (!response.ok) {
    const error = new Error(body.message || 'Jev 请求失败');
    error.code = body.error;
    error.status = response.status;
    throw error;
  }
  return body;
}
