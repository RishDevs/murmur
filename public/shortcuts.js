export function shortcutAction(event) {
  if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return null;
  const target = event.target;
  if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '')) return null;
  return { s: 'start', p: 'pause', r: 'reset' }[event.key.toLowerCase()] || null;
}
