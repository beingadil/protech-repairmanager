import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const PX_TO_MM = 0.264583;

/**
 * Export the prepared print document (#printable-content) to PDF.
 *
 * The page size is derived from the rendered element's physical dimensions so
 * that A4, 80mm and 58mm documents each produce a correctly-shaped PDF instead
 * of being forced onto an A4 sheet.
 */
export async function exportElementToPDF(
  elementId: string,
  fileName: string = 'ProTech_Invoice.pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found for PDF export.`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const widthMm = Math.max(28, element.offsetWidth * PX_TO_MM);
    const heightMm = Math.max(40, element.offsetHeight * PX_TO_MM);

    // Page exactly matches the document — no scaling / clipping.
    const pdf = new jsPDF({
      orientation: widthMm >= heightMm ? 'l' : 'p',
      unit: 'mm',
      format: [widthMm, heightMm]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
    pdf.save(fileName);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

export function triggerPrintWindow(elementId: string): void {
  // Direct window.print triggers native browser print dialog
  // @media print CSS rules in index.css automatically isolate #printable-content
  window.print();
}
