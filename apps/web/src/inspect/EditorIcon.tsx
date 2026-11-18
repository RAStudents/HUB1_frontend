export function EditorIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    upload: 'M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6', file: 'M6 3h8l4 4v14H6V3zm8 0v5h4', chart: 'M4 20h17M7 16v-5m5 5V5m5 11V8', users: 'M16 20v-3c0-4-12-4-12 0v3m10-12a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4 4c3 0 4 2 4 5', download: 'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
    search: 'M15 15l6 6m-3-11a7 7 0 1 1-14 0 7 7 0 0 1 14 0', filter: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6', panels: 'M3 4h18v16H3zM15 4v16',
    back: 'M14 6l-6 6 6 6M8 12h12', eye: 'M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    hand: 'M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2',
    select: 'M5 3l14 10-7 1-3 7L5 3z', box: 'M4 4h16v16H4z', polygon: 'M4 8l8-5 9 8-4 10H5L4 8z', comment: 'M4 4h16v13H9l-5 4V4z',
    redo: 'M15 5l5 5-5 5M20 10h-9c-5 0-7 3-7 8',
    undo: 'M9 5l-5 5 5 5M4 10h9c5 0 7 3 7 8', delete: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
    send: 'M4 12h15m-6-6 6 6-6 6', check: 'M5 12l4 4L19 6', shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3zm-4 9 3 3 5-6',
  };
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.box} /></svg>;
}
