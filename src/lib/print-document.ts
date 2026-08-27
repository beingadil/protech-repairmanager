import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { InvoiceData, InvoicePaper } from './invoice';
import { InvoiceDocument } from '../features/print/InvoiceDocument';

/**
 * Document preparation layer of the print engine.
 *
 * ONE source of truth: the same <InvoiceDocument/> that paints the on-screen
 * preview is rendered to static HTML here and wrapped in a self-contained
 * shell (own @page rules, base typography, no app CSS dependency). The shell
 * is what the Electron main process loads into a hidden window for native
 * printing (webContents.print) and PDF generation (printToPDF).
 *
 * Business data + presentation live ONLY here; app/main/print.ts stays a
 * generic printer driver with zero template knowledge.
 */

export type NativePaperFormat = 'a4' | 'thermal80' | 'thermal58';

export interface PaperSpec {
  /** Windows driver page size in microns (1mm = 1000µm). */
  pageWidthMicrons: number;
  pageHeightMicrons: number | null; // null = measure content at print time
  /** @page rule embedded in the standalone document. */
  pageRule: string;
  /** @page rule used by the in-app window.print() fallback. */
  fallbackPageRule: string;
}

export const PAPER_SPECS: Record<NativePaperFormat, PaperSpec> = {
  a4: {
    pageWidthMicrons: 210_000,
    pageHeightMicrons: 297_000,
    pageRule: '@page { size: 210mm 297mm; margin: 11mm; }',
    fallbackPageRule: '@page { size: A4 portrait; margin: 6mm; }'
  },
  // Thermal: media width page, content already constrained to printable width.
  thermal80: {
    pageWidthMicrons: 80_000,
    pageHeightMicrons: null,
    pageRule: '@page { size: 80mm auto; margin: 2mm; }',
    fallbackPageRule: '@page { size: 80mm auto; margin: 0; }'
  },
  thermal58: {
    pageWidthMicrons: 58_000,
    pageHeightMicrons: null,
    pageRule: '@page { size: 58mm auto; margin: 1.5mm; }',
    fallbackPageRule: '@page { size: 58mm auto; margin: 0; }'
  }
};

export function paperToFormat(paper: InvoicePaper): NativePaperFormat {
  if (paper === 'a4') return 'a4';
  return paper === '80' ? 'thermal80' : 'thermal58';
}

/**
 * Wrap rendered document markup into the standalone HTML string handed to the
 * main process. Fully offline — system font stacks only.
 */
export function buildStandaloneHtml(data: InvoiceData): string {
  const format = paperToFormat(data.paper);
  const spec = PAPER_SPECS[format];
  const body = renderToStaticMarkup(createElement(InvoiceDocument, { data }));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${data.repair?.token ?? 'ProTech'} - ProTech Services</title>
<style>
  ${spec.pageRule}
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    /* Physical font stack — avoids webfont deps inside the hidden print window. */
    font-family: "Segoe UI", Roboto, Arial, sans-serif;
    margin: 0;
    padding: ${format === 'a4' ? '0' : '2mm'};
    display: flex;
    justify-content: center;
    min-height: 100vh;
  }
  .doc-root { display: flex; flex-direction: column; align-items: center; width: 100%; }
  img, svg { max-width: 100%; }
</style>
</head>
<body><div class="doc-root">${body}</div></body>
</html>`;
}
