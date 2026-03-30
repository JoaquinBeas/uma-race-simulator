import { useCallback, useRef } from 'react';

export function useGrabScroll() {
  const cleanupRef = useRef<(() => void) | null>(null);

  const refCallback = useCallback((el: HTMLDivElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!el) return;

    let isDown = false;
    let startX: number;
    let startY: number;
    let scrollLeft: number;
    let scrollTop: number;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const y = e.pageY - el.offsetTop;
      const walkX = (x - startX) * 2;
      const walkY = (y - startY) * 2;
      el.scrollLeft = scrollLeft - walkX;
      el.scrollTop = scrollTop - walkY;
    };

    const onMouseUp = () => {
      isDown = false;
      el.classList.remove('active');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      el.classList.add('active');
      startX = e.pageX - el.offsetLeft;
      startY = e.pageY - el.offsetTop;
      scrollLeft = el.scrollLeft;
      scrollTop = el.scrollTop;

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    el.addEventListener('mousedown', onMouseDown);

    cleanupRef.current = () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return refCallback;
}
