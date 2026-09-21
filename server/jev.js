export function createJevHandler() {
  return async (_request, response) => {
    response.status(503).json({ error: 'JEV_NOT_CONFIGURED', message: 'Jev 服务尚未配置' });
  };
}
