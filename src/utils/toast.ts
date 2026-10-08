export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

export function showToast(message: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent('vigilytics-toast', {
    detail: {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
    },
  });
  window.dispatchEvent(event);
}
