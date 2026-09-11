// Retire the former Flutter worker on deployment so existing visitors receive the new site.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  await Promise.all(['flutter-app-cache','flutter-temp-cache','flutter-app-manifest'].map(name => caches.delete(name)));
  await self.clients.claim();
  await self.registration.unregister();
  for (const client of await self.clients.matchAll({type:'window'})) client.navigate(client.url);
})()));
