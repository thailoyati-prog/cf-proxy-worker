addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  const config = {
    uuid: "a1b2c3d4-e5f6-7890-abcd-1234567890ab", // 这个UUID可以先用着，后面再改
    path: "/proxy" // 路径也可以先用这个
  };

  if (url.pathname === config.path) {
    return new Response("Worker Running!", { status: 200 });
  }
  return new Response("Not Found", { status: 404 });
}
