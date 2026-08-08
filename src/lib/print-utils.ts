import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportElementToPDF(
  elementId: string,
  fileName: string = 'ProData_Invoice.pdf'
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
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
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
