self.addEventListener('push', function(event) {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      image: data.image,
      actions: data.actions,
      vibrate: data.vibrate,
      tag: data.tag,
      renotify: data.renotify,
      requireInteraction: data.requireInteraction,
      silent: data.silent,
      timestamp: data.timestamp,
      data: data.data,
    })
  );
});
