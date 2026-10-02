/**
 * Converts markdown text to a basic HTML structure suitable for .doc export.
 * Uses Word-compatible HTML wrapping so the file opens natively in MS Word / LibreOffice.
 */
const MAGENTA = '#82005E';
const GRIS = '#6B6C6E';

const NIVELES: { re: RegExp; bg: string; fg: string; hl: string }[] = [
  { re: /Satisfactori[oa]/i, bg: '#2E7D32', fg: '#FFFFFF', hl: 'green' },
  { re: /Aceptable/i, bg: '#F9A825', fg: '#000000', hl: 'yellow' },
  { re: /Mejorable/i, bg: '#EF6C00', fg: '#FFFFFF', hl: 'darkYellow' },
  { re: /Insuficiente|Deficiente|Cr[ií]tic[oa]/i, bg: '#C62828', fg: '#FFFFFF', hl: 'red' },
];
const EMOJI: Record<string, string> = { '🟢': '#2E7D32', '🟡': '#F9A825', '🟠': '#EF6C00', '🔴': '#C62828', '⚪': '#98999B' };

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(raw: string): string {
  return esc(raw)
    .replace(/`([^`]+)`/g, '<span style="font-family:Consolas,monospace;color:#82005E">$1</span>')
    .replace(/\*\*\*(.+?)\*\*\*/g, `<b style="color:${MAGENTA}"><i>$1</i></b>`)
    .replace(/\*\*(.+?)\*\*/g, `<b style="color:${MAGENTA}">$1</b>`)
    .replace(/(^|[^*])\*([^*]+?)\*/g, '$1<i>$2</i>')
    // Emoji semáforo → círculo coloreado (Word pinta los emoji en gris)
    .replace(/(🟢|🟡|🟠|🔴|⚪)\uFE0F?/gu, (e) => `<span style="font-family:Arial;color:${EMOJI[e.replace('\uFE0F', '')]};font-size:12pt">&#9679;</span>`)
    .replace(/\b(ALTA|CR[IÍ]TICA|URGENTE)\b/g, '<span style="color:#FFFFFF;background:#C62828;mso-highlight:red;font-weight:bold">&nbsp;$1&nbsp;</span>')
    .replace(/\b(MEDIA)\b/g, '<span style="color:#000000;background:#F9A825;mso-highlight:yellow;font-weight:bold">&nbsp;$1&nbsp;</span>')
    .replace(/\b(BAJA)\b/g, '<span style="color:#FFFFFF;background:#2E7D32;mso-highlight:green;font-weight:bold">&nbsp;$1&nbsp;</span>');
}

/** Celda de valoración: se rellena entera con el color del nivel. */
function nivelCelda(raw: string) {
  const plain = raw.replace(/[🟢🟡🟠🔴⚪\uFE0F*]/gu, '').trim();
  if (plain.length > 30) return null;
  return NIVELES.find((n) => n.re.test(plain)) ?? null;
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
      const fs = head.length >= 7 ? '7.5pt' : head.length >= 5 ? '8.5pt' : '9.5pt';
      const cellBase = `border:1px solid #D9C2D2;padding:3pt 4pt;font-size:${fs};vertical-align:top;word-wrap:break-word`;
      let t = '<table border="1" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;width:100%;table-layout:fixed;mso-table-layout-alt:fixed">';
      // Anchos proporcionales al contenido para que las palabras no se partan
      const body: string[][] = [];
      for (let k = i; k < lines.length && /^\s*\|.*\|\s*$/.test(lines[k]); k++) body.push(cells(lines[k]));
      const peso = head.map((h, ci) => {
        const longest = (txt: string) => Math.max(...txt.split(/\s+/).map((w) => w.length), 4);
        return Math.max(longest(h) * 0.9, ...body.map((r) => Math.min(longest(r[ci] ?? ''), 22)), 5);
      });
      const tot = peso.reduce((a, b) => a + b, 0);
      t += '<colgroup>' + peso.map((w) => `<col width="${Math.round((w / tot) * 100)}%"/>`).join('') + '</colgroup>';
      t += '<tr>' + head.map((h, ci) => `<td width="${Math.round((peso[ci] / tot) * 100)}%" bgcolor="${MAGENTA}" style="${cellBase};background:${MAGENTA};mso-shading:${MAGENTA}"><b><font color="#FFFFFF" style="color:#FFFFFF">${esc(h.replace(/\*/g, ''))}</font></b></td>`).join('') + '</tr>';
      let n = 0;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const bg = n++ % 2 ? '#F7EAF3' : '#FFFFFF';
        t += '<tr>' + cells(lines[i]).map((c) => {
          const lv = nivelCelda(c);
          if (lv) return `<td bgcolor="${lv.bg}" style="${cellBase};background:${lv.bg};mso-shading:${lv.bg};color:${lv.fg};font-weight:bold;text-align:center">${esc(c.replace(/[🟢🟡🟠🔴⚪\uFE0F*]/gu, '').trim())}</td>`;
          return `<td bgcolor="${bg}" style="${cellBase};background:${bg}">${inline(c)}</td>`;
        }).join('') + '</tr>';
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
        @page WordSection1 { size: 21cm 29.7cm; margin: 1.5cm 1.5cm 1.5cm 1.5cm; mso-page-orientation: portrait; }
        div.WordSection1 { page: WordSection1; }
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
    <body><div class="WordSection1">${htmlBody}</div></body>
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
