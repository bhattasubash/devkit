// app.js — Locked out of scope by .devkit/scope.json
export function renderUserBanner(name) {
  const target = document.getElementById('banner');
  target.innerHTML = name;
}
