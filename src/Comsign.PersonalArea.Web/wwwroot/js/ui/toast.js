const container = () => document.getElementById('toasts');

/** התראה קצרה בפינת המסך. variant: "info" | "ok" */
export function toast(message, variant = 'info', ttl = 4200) {
  const host = container();
  if (!host) return;

  const element = document.createElement('div');
  element.className = `toast${variant === 'ok' ? ' toast--ok' : ''}`;
  element.textContent = message;
  host.append(element);

  setTimeout(() => {
    element.style.opacity = '0';
    element.style.transition = 'opacity .3s ease';
    setTimeout(() => element.remove(), 320);
  }, ttl);
}
