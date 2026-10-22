export function pathwayIcon(id) {
  const common = 'viewBox="0 0 120 120" aria-hidden="true" focusable="false"';
  if (id === 'science-tech') return `<svg ${common}><path d="M42 16h36M49 16v27L26 82a17 17 0 0 0 15 25h38a17 17 0 0 0 15-25L71 43V16M39 75h42"/></svg>`;
  if (id === 'computer-science') return `<svg ${common}><rect x="21" y="23" width="78" height="57" rx="8"/><path d="M60 80v17M42 98h36"/></svg>`;
  return `<svg ${common}><path d="m44 52-24 24a13 13 0 0 0 18 18l25-25M44 52l19 17M43 50V35L30 19h21l27 24v13l12 12-14 14-13-13M78 56l-15 13"/></svg>`;
}
