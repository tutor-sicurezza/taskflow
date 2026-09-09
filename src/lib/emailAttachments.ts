import { TaskAttachment } from './types';

export interface EmailAttachment {
  content: string;
  filename: string;
  type: string;
  disposition: 'attachment' | 'inline';
}

export function convertTaskAttachmentsToEmailAttachments(
  taskAttachments: TaskAttachment[]
): EmailAttachment[] {
  return taskAttachments.map(attachment => {
    let content = attachment.fileData;
    
    if (content.startsWith('data:')) {
      content = content.split(',')[1];
    }
    
    return {
      content,
      filename: attachment.fileName,
      type: attachment.fileType || 'application/octet-stream',
      disposition: 'attachment',
    };
  });
}

export function filterAttachmentsForEmail(
  attachments: TaskAttachment[],
  maxTotalSize: number = 10 * 1024 * 1024
): { included: TaskAttachment[]; excluded: TaskAttachment[] } {
  const included: TaskAttachment[] = [];
  const excluded: TaskAttachment[] = [];
  let currentSize = 0;

  for (const attachment of attachments) {
    if (currentSize + attachment.fileSize <= maxTotalSize) {
      included.push(attachment);
      currentSize += attachment.fileSize;
    } else {
      excluded.push(attachment);
    }
  }

  return { included, excluded };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getAttachmentSummary(attachments: TaskAttachment[]): string {
  if (attachments.length === 0) return 'No attachments';
  if (attachments.length === 1) return `1 attachment (${formatFileSize(attachments[0].fileSize)})`;
  
  const totalSize = attachments.reduce((sum, att) => sum + att.fileSize, 0);
  return `${attachments.length} attachments (${formatFileSize(totalSize)})`;
}

export function createAttachmentListHtml(attachments: TaskAttachment[]): string {
  if (attachments.length === 0) return '';
  
  return `
    <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #374151;">Attachments (${attachments.length})</h3>
      <ul style="margin: 0; padding-left: 20px; list-style: none;">
        ${attachments.map(att => `
          <li style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 20px; height: 20px; background-color: #3b82f6; border-radius: 4px; text-align: center; line-height: 20px; color: white; font-size: 12px;">📎</span>
            <span style="color: #1f2937; font-size: 14px;">
              <strong>${att.fileName}</strong> 
              <span style="color: #6b7280; font-size: 12px;">(${formatFileSize(att.fileSize)})</span>
            </span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

export interface EmailWithAttachments {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  from: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  provider: 'sendgrid' | 'resend';
  tenantId?: string;
}

export async function sendEmailWithAttachments(
  emailData: EmailWithAttachments,
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { provider, ...emailPayload } = emailData;
    
    if (provider === 'sendgrid') {
      return await sendViaSendGrid(emailPayload, apiKey);
    } else if (provider === 'resend') {
      return await sendViaResend(emailPayload, apiKey);
    }
    
    return { success: false, error: 'Unsupported email provider' };
  } catch (error) {
    console.error('Email sending error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function sendViaSendGrid(
  emailData: Omit<EmailWithAttachments, 'provider'>,
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const payload = {
    personalizations: [{
      to: [{ email: emailData.to }],
    }],
    from: { 
      email: emailData.from.match(/<(.+)>/)?.[1] || emailData.from,
      name: emailData.from.match(/^(.+)<.+>$/)?.[1]?.trim() || emailData.from,
    },
    reply_to: emailData.replyTo ? { email: emailData.replyTo } : undefined,
    subject: emailData.subject,
    content: [
      {
        type: 'text/plain',
        value: emailData.textContent,
      },
      {
        type: 'text/html',
        value: emailData.htmlContent,
      },
    ],
    attachments: emailData.attachments?.map(att => ({
      content: att.content,
      filename: att.filename,
      type: att.type,
      disposition: att.disposition,
    })),
  };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    const messageId = response.headers.get('X-Message-Id');
    return { success: true, messageId: messageId || undefined };
  }

  const errorData = await response.json().catch(() => ({}));
  return { 
    success: false, 
    error: errorData.errors?.[0]?.message || `SendGrid error: ${response.status}` 
  };
}

async function sendViaResend(
  emailData: Omit<EmailWithAttachments, 'provider'>,
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const payload = {
    from: emailData.from,
    to: [emailData.to],
    reply_to: emailData.replyTo,
    subject: emailData.subject,
    html: emailData.htmlContent,
    text: emailData.textContent,
    attachments: emailData.attachments?.map(att => ({
      content: att.content,
      filename: att.filename,
      content_type: att.type,
    })),
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    const data = await response.json();
    return { success: true, messageId: data.id };
  }

  const errorData = await response.json().catch(() => ({}));
  return { 
    success: false, 
    error: errorData.message || `Resend error: ${response.status}` 
  };
}
