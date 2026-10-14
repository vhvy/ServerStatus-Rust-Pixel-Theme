import { useTemplateRef, watch, onUnmounted } from 'vue';

// Keep native modal behavior, focus restoration and scroll locking together.
export function useDialog(
  isOpen: () => boolean,
  afterClose: () => void,
  options: { lockScroll?: boolean; fallback?: () => void } = {},
) {
  const dialog = useTemplateRef<HTMLDialogElement>('dialog');
  let opener: HTMLElement | null = null;

  function close() {
    dialog.value?.close();
  }

  function onClose() {
    if (options.lockScroll) {
      document.documentElement.classList.remove('node-details-open');
    }
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    else options.fallback?.();
    opener = null;
    afterClose();
  }

  function closeOutside(event: MouseEvent) {
    const element = dialog.value;
    if (!element || event.target !== element) return;
    const bounds = element.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      close();
    }
  }

  watch(
    isOpen,
    (open) => {
      const element = dialog.value;
      if (!element) return;
      if (open && !element.open) {
        opener =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        element.showModal();
        element.scrollTop = 0;
        if (options.lockScroll) {
          document.documentElement.classList.add('node-details-open');
        }
      } else if (!open) close();
    },
    { flush: 'post' },
  );

  onUnmounted(() => {
    close();
    if (options.lockScroll) {
      document.documentElement.classList.remove('node-details-open');
    }
  });

  return { dialog, close, closeOutside, onClose };
}
