import { Job } from '../types/job';
import { formatCurrency, formatDate } from './utils';

export function sanitizePhoneNumber(phone: string): string {
  // Remove spaces, dashes, brackets
  let clean = phone.replace(/[\s\-\(\)]/g, '');
  
  // If starts with 03 (Pakistan format e.g. 03001234567), prepend country code 92
  if (clean.startsWith('03')) {
    clean = '92' + clean.substring(1);
  }
  // If starts with +, remove +
  if (clean.startsWith('+')) {
    clean = clean.substring(1);
  }
  return clean;
}

export function generateWhatsAppMessage(
  templateType: 'ready' | 'update' | 'payment_reminder',
  job: Job,
  shopName: string,
  shopMobile: string
): string {
  const token = job.token_number;
  const customer = job.customer_name || 'Valued Customer';
  const device = `${job.job_type.toUpperCase()} - ${job.model || 'Device'}`;
  const charges = formatCurrency(job.charges);
  const paymentStatus = job.payment_status === 'paid' ? 'Paid' : `Due (${charges})`;

  if (templateType === 'ready') {
    return `Hello ${customer},

Your ${device} (Token: *${token}*) repair is COMPLETE and ready for collection at *${shopName}*.

*Payment Status:* ${paymentStatus}
*Charges:* ${charges}

Please visit our center or call us at ${shopMobile} for any queries.
Thank you!`;
  }

  if (templateType === 'payment_reminder') {
    return `Hello ${customer},

This is a gentle payment reminder from *${shopName}* regarding your repair job *${token}* (${device}).

*Outstanding Amount:* ${charges}
*Payment Status:* Pending (Due)

Kindly arrange payment at your earliest convenience.
Contact: ${shopMobile}`;
  }

  // Repair update
  return `Hello ${customer},

Update regarding your ${device} repair at *${shopName}* (Token: *${token}*):

Our technician has inspected your device.
*Symptoms:* ${job.symptoms || 'Under diagnosis'}
*Estimated Return Date:* ${formatDate(job.return_date)}
*Estimated Charges:* ${charges}

Feel free to reply if you have any questions!`;
}

export function openWhatsAppDeeplink(phone: string, message: string): void {
  const cleanPhone = sanitizePhoneNumber(phone);
  const encodedText = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
