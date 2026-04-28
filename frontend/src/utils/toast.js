/**
 * Lightweight toasts using SweetAlert2 (toast mode). Use for success/error/info feedback.
 */
import Swal from 'sweetalert2';

const defaultToastOptions = {
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
};

export function toastSuccess(message, title = '') {
  return Swal.fire({ ...defaultToastOptions, icon: 'success', title: title || 'Done', text: message });
}

export function toastError(message, title = 'Error') {
  return Swal.fire({ ...defaultToastOptions, icon: 'error', title, text: message, timer: 5000 });
}

export function toastInfo(message, title = '') {
  return Swal.fire({ ...defaultToastOptions, icon: 'info', title: title || 'Info', text: message });
}
