import './style.css';

if (!window.isSecureContext) {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'VModel requires HTTPS or localhost. For access from another computer, use trusted HTTPS. Then select Start camera.';
  document.querySelector('#app')!.replaceChildren(message);
} else {
  void import('./main');
}
