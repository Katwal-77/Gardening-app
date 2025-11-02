// This service worker handles notification click events.
self.addEventListener('notificationclick', (event) => {
  // Close the notification pop-up
  event.notification.close();

  // See if the app is already open and focus it
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        // Find the focused window or fall back to the first one
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      // If the app isn't open, open a new window
      return clients.openWindow('/');
    })
  );
});
