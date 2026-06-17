export function openInNewWindow(path: string) {
  const w    = Math.min(1200, window.screen.width - 100);
  const h    = Math.min(800, window.screen.height - 100);
  const left = Math.round((window.screen.width - w) / 2);
  const top  = Math.round((window.screen.height - h) / 2);

  window.open(
    path,
    'erp_' + Date.now(),
    [
      'width=' + w,
      'height=' + h,
      'left=' + left,
      'top=' + top,
      'resizable=yes',
      'scrollbars=yes',
      'toolbar=no',
      'menubar=no',
      'location=no',
    ].join(','),
  );
}
