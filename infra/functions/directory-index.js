function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Resolve directories before the cache lookup; keep asset requests intact.
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!uri.includes('.')) {
    request.uri += '/index.html';
  }

  return request;
}
