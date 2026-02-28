/**
 * Converts markdown text to a basic HTML structure suitable for .doc export.
 * Uses Word-compatible HTML wrapping so the file opens natively in MS Word / LibreOffice.
 */
function markdownToHtml(md: string): string {
  let html = md
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr/>')
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Line breaks → paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap loose <li> in <ul>
  html = html.replace(/((?:<li>.*?<\/li>\s*(?:<br\/>)?)+)/g, '<ul>$1</ul>');

  return `<p>${html}</p>`;
}

export function exportMarkdownToDoc(markdown: string, filename: string) {
  const htmlBody = markdownToHtml(markdown);

  const doc = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; margin: 2cm; }
        h1 { font-size: 18pt; color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 4pt; }
        h2 { font-size: 14pt; color: #16213e; margin-top: 16pt; }
        h3 { font-size: 12pt; color: #0f3460; margin-top: 12pt; }
        h4 { font-size: 11pt; color: #333; font-style: italic; }
        ul { margin-left: 20pt; }
        li { margin-bottom: 4pt; }
        hr { border: none; border-top: 1px solid #ccc; margin: 12pt 0; }
        p { margin: 6pt 0; }
      </style>
    </head>
    <body>${htmlBody}</body>
    </html>
  `;

  const blob = new Blob([doc], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
