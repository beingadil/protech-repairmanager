import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const PX_TO_MM = 0.264583;

/**
 * Find the printable content element. Tries the exact ID first, then falls
 * back to the first element with data-paper attribute (the InvoiceDocument
 * root) so the function works in both the old and new rendering paths.
 */
function findPrintableElement(elementId: string): HTMLElement | null {
  return (
    document.getElementById(elementId) ??
    document.querySelector('[data-paper]') ??
    document.querySelector('.doc-root')
  );
}

/**
 * Export the prepared print document to PDF.
 *
 * The page size is derived from the rendered element's physical dimensions so
 * that A4, 80mm and 58mm documents each produce a correctly-shaped PDF instead
 * of being forced onto an A4 sheet.
 */
export async function exportElementToPDF(
  elementId: string,
  fileName: string = 'ProTech_Invoice.pdf'
): Promise<void> {
  const element = findPrintableElement(elementId);
  if (!element) {
    throw new Error(
      `Print preview element not found. Make sure the invoice is rendered on screen before saving.`
    );
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

    // Center the image on a standard A4 page instead of using a tiny
    // custom-sized page that many PDF viewers render at unreadable scale.
    const pageWidth = Math.max(widthMm, 210); // at least A4 width
    const pageHeight = Math.max(heightMm, 297); // at least A4 height
    const pdf = new jsPDF({
      orientation: widthMm >= heightMm ? 'l' : 'p',
      unit: 'mm',
      format: 'a4'
    });

    // Center the invoice image on the page
    const offsetX = (pageWidth - widthMm) / 2;
    const offsetY = (pageHeight - heightMm) / 2;
    pdf.addImage(imgData, 'PNG', offsetX, offsetY, widthMm, heightMm);
    pdf.save(fileName);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

export function triggerPrintWindow(_elementId: string): void {
  window.print();
}
