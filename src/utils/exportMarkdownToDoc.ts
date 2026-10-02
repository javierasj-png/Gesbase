/**
 * Converts markdown text to a basic HTML structure suitable for .doc export.
 * Uses Word-compatible HTML wrapping so the file opens natively in MS Word / LibreOffice.
 */
const MAGENTA = '#82005E';
const GRIS = '#6B6C6E';

function inline(t: string): string {
  return t
    .replace(/\*\*\*(.+?)\*\*\*/g, `<b style="color:${MAGENTA}"><i>$1</i></b>`)
    .replace(/\*\*(.+?)\*\*/g, `<b style="color:${MAGENTA}">$1</b>`)
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/\b(ALTA|CR[IÍ]TICA|URGENTE|VENCID[AO]S?)\b/g, '<span style="color:#FFFFFF;background:#C62828;mso-highlight:red;font-weight:bold;padding:0 3pt">$1</span>')
    .replace(/\b(MEDIA)\b/g, '<span style="color:#000000;background:#F9A825;mso-highlight:yellow;font-weight:bold;padding:0 3pt">$1</span>')
    .replace(/\b(BAJA)\b/g, '<span style="color:#FFFFFF;background:#2E7D32;mso-highlight:green;font-weight:bold;padding:0 3pt">$1</span>');
}

/** Converts markdown to Word-compatible HTML with inline colours (Word ignores many CSS rules). */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  while (i < lines.length) {
    const l = lines[i];
    // Tables
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      closeList();
      const cells = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(l);
      i += 2;
      let t = '<table style="border-collapse:collapse;width:100%"><tr>' + head.map((h) => `<th style="background:${MAGENTA};color:#FFFFFF;border:1px solid ${MAGENTA};padding:4pt 6pt;font-size:10pt;text-align:left">${inline(h).replace(/color:#82005E/g, 'color:#FFFFFF')}</th>`).join('') + '</tr>';
      let n = 0;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const bg = n++ % 2 ? '#F7EAF3' : '#FFFFFF';
        t += '<tr>' + cells(lines[i]).map((c) => `<td style="background:${bg};border:1px solid #D9C2D2;padding:4pt 6pt;font-size:10pt">${inline(c)}</td>`).join('') + '</tr>';
        i++;
      }
      out.push(t + '</table>');
      continue;
    }
    let m;
    if ((m = l.match(/^(#{1,4}) (.+)$/))) {
      closeList();
      const lvl = m[1].length;
      const st = lvl === 1
        ? `font-size:18pt;color:${MAGENTA};border-bottom:2px solid ${MAGENTA};padding-bottom:4pt`
        : lvl === 2
        ? `font-size:14pt;color:#FFFFFF;background:${MAGENTA};padding:3pt 6pt;margin-top:16pt`
        : lvl === 3
        ? `font-size:12pt;color:${MAGENTA};border-left:4px solid ${GRIS};padding-left:6pt;margin-top:12pt`
        : `font-size:11pt;color:${GRIS};font-style:italic`;
      out.push(`<h${lvl} style="${st}">${inline(m[2]).replace(lvl === 2 ? /color:#82005E/g : /$^/, 'color:#FFFFFF')}</h${lvl}>`);
    } else if (/^---+$/.test(l.trim())) {
      closeList();
      out.push(`<hr style="border:none;border-top:1px solid ${GRIS}"/>`);
    } else if ((m = l.match(/^\s*(?:[-*]|\d+\.) (.+)$/))) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if (l.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(l)}</p>`);
    }
    i++;
  }
  closeList();
  return out.join('\n');
}

export function exportMarkdownToDoc(markdown: string, filename: string) {
  const htmlBody = markdownToHtml(markdown);

  const doc = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page { margin: 1.5cm 1.5cm 1.5cm 1.5cm; size: A4; }
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #222; margin: 0; padding: 0; }
        h1 { font-size: 18pt; color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 4pt; }
        h2 { font-size: 14pt; color: #16213e; margin-top: 16pt; }
        h3 { font-size: 12pt; color: #0f3460; margin-top: 12pt; }
        h4 { font-size: 11pt; color: #333; font-style: italic; }
        ul { margin-left: 20pt; }
        li { margin-bottom: 4pt; }
        hr { border: none; border-top: 1px solid #ccc; margin: 12pt 0; }
        p { margin: 6pt 0; }
        table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
        th, td { border: 1px solid #ccc; padding: 4pt 6pt; font-size: 10pt; text-align: left; }
        th { background-color: #f0f0f0; font-weight: bold; }
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
