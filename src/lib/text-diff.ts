export interface TextDiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

/** Simple line-based diff for prompt version comparison. */
export function diffLines(oldText: string, newText: string): TextDiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: TextDiffLine[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i += 1) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === newLine) {
      if (oldLine !== undefined) result.push({ type: 'unchanged', text: oldLine });
    } else {
      if (oldLine !== undefined) result.push({ type: 'removed', text: oldLine });
      if (newLine !== undefined) result.push({ type: 'added', text: newLine });
    }
  }

  return result;
}
