import { connect } from 'cloudflare:sockets';

// 这里改成你自己的 UUID
const UUID = 'a1b2c3d4-e5f6-7890-abcd-1234567890ab';
// 代理路径，和你客户端配置里的 path 保持一致
const PROXY_PATH = '/proxy';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 路径校验，只允许访问代理路径
    if (url.pathname !== PROXY_PATH) {
      return new Response('Not Found', { status: 404 });
    }

    // 处理 WebSocket 连接
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    handleWebSocket(server, new URL(request.url), env);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};

async function handleWebSocket(ws, url, env) {
  ws.addEventListener('message', async ({ data }) => {
    try {
      const { host, port, target } = parseVlessHeader(data, UUID);
      const socket = connect({ hostname: host, port: Number(port) });
      const writer = socket.writable.getWriter();
      const reader = socket.readable.getReader();

      // 把目标数据转发给客户端
      ws.addEventListener('message', async ({ data }) => {
        writer.write(data);
      });

      // 把服务器数据转发给客户端
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        ws.send(value);
      }
    } catch (err) {
      ws.close(1011, 'Proxy error');
    }
  });
}

function parseVlessHeader(buffer, uuid) {
  const data = new Uint8Array(buffer);
  if (data[0] !== 0 || data[1] !== 0) throw new Error('Invalid version');

  const uuidHex = Array.from(data.subarray(1, 17))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  if (uuidHex !== uuid.replace(/-/g, '')) throw new Error('Invalid UUID');

  const addrLen = data[17];
  const host = new TextDecoder().decode(data.subarray(18, 18 + addrLen));
  const port = new DataView(data.buffer).getUint16(18 + addrLen);

  return { host, port, target: `${host}:${port}` };
}
