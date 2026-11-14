import type { ReactNode } from 'react';

export const renderLegalText = (content: string): ReactNode[] => {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s{4}/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s{4}/.test(lines[index])) {
        items.push(lines[index].trim());
        index += 1;
      }
      blocks.push(
        <ul key={`list-${index}`}>
          {items.map((item, itemIndex) => <li key={`${index}-${itemIndex}`}>{item}</li>)}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      blocks.push(<h2 key={index}>{line}</h2>);
      index += 1;
      continue;
    }

    const subsection = line.match(/^(\d+(?:\.\d+)+\.)\s*(.*)$/);
    if (subsection) {
      blocks.push(
        <p key={index}>
          <strong>{subsection[1]}</strong> {subsection[2]}
        </p>,
      );
      index += 1;
      continue;
    }

    blocks.push(<p key={index}>{line}</p>);
    index += 1;
  }

  return blocks;
};
