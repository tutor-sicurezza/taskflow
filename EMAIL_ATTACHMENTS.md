# Email Attachment Support for Task Notifications

> **AVVERTENZA (post-migrazione Supabase).** La funzionalita' descritta qui **non e'
> stata verificata** dopo la migrazione. Inoltre `src/lib/emailAttachments.ts` invia
> ancora le email direttamente dal client invece di passare dalla funzione serverless
> `api/email/send.ts`: quel percorso e' da rivedere e non va considerato quello
> supportato. L'unico invio email verificato (senza allegati) passa da
> `api/email/send.ts` con Resend, configurato via `RESEND_API_KEY` ed `EMAIL_FROM`
> lato server. Vedi [STATO.md](STATO.md).

## Overview

TaskFlow now supports sending task attachments via email notifications. When users receive email notifications about tasks (assignments, updates, comments, etc.), any files attached to the task can be automatically included in the email.

## Features

### 1. Automatic Attachment Inclusion
- Task attachments are automatically included in email notifications
- Supports all common file types (images, PDFs, documents, spreadsheets, etc.)
- Smart filtering to ensure emails stay within size limits

### 2. Configurable Settings
Super admins can configure email attachment behavior:

- **Include/Exclude Attachments**: Toggle whether to include attachments in emails
- **Maximum Single File Size**: Set limit for individual attachments (1-10 MB)
- **Maximum Total Email Size**: Set limit for all attachments per email (5-25 MB)
- **Exclusion Notifications**: Alert users when attachments are too large to include

### 3. Smart Filtering
The system automatically:
- Filters out files that exceed the size limit
- Prioritizes smaller files when total size would exceed limits
- Notifies recipients when attachments are excluded
- Provides file summaries in emails

### 4. Security Features
- Automatically blocks executable files (.exe, .bat, .sh)
- Validates file types and sizes
- Uses secure base64 encoding for transmission
- Complies with email provider limits (SendGrid, Resend)

## Configuration

### For Super Admins

1. **Access Email Attachment Settings**
   - Click on "Email Attachments" button in the admin toolbar
   - Configure size limits and preferences
   - Save settings

2. **Email Service Setup** (Required)
   - Configure SendGrid or Resend in Super Admin Settings
   - Enter API key and sender information
   - Test the email configuration
   - Enable email notifications

### Size Recommendations

| Setting | Recommended Value | Maximum |
|---------|------------------|---------|
| Single Attachment | 5 MB | 10 MB |
| Total Per Email | 10 MB | 25 MB |

### Best Practices

1. **File Size Management**
   - Keep individual files under 5 MB for reliable delivery
   - Total email size should stay under 10 MB
   - Compress files when possible

2. **Large File Handling**
   - For files over 10 MB, use cloud storage links instead
   - Consider archiving multiple small files into a single ZIP

3. **File Types**
   - Images: JPG, PNG, GIF (optimized)
   - Documents: PDF, DOC, DOCX, TXT
   - Spreadsheets: XLS, XLSX, CSV
   - Avoid: EXE, BAT, SH (blocked for security)

## Technical Implementation

### Email Attachment Flow

```
1. Task Notification Triggered
   ↓
2. Check Email Attachment Settings
   ↓
3. Filter Attachments by Size
   ↓
4. Convert to Email Format (base64)
   ↓
5. Send via Provider (SendGrid/Resend)
   ↓
6. Log Result & Update Stats
```

### File Size Calculations

Attachments are encoded in base64, which increases size by ~33%. The system accounts for this:

```
Original File: 5 MB
Base64 Encoded: ~6.65 MB
Email Overhead: ~0.35 MB
Total: ~7 MB
```

### Supported Email Providers

#### SendGrid
- Maximum attachment size: 25 MB (total)
- Maximum 10 attachments per email
- Supports all MIME types
- Free tier: 100 emails/day

#### Resend
- Maximum attachment size: 25 MB (total)
- Maximum 20 attachments per email
- Supports all MIME types
- Free tier: 100 emails/day

## Email Template

Emails with attachments include:

1. **Task Details**
   - Title, description, priority, status
   - Due date and task ID
   - Assignee information

2. **Attachment List**
   - File names with icons
   - File sizes
   - File count and total size

3. **Exclusion Notice** (if applicable)
   - Number of excluded files
   - Reason for exclusion
   - Link to view full task

4. **Call to Action**
   - Button to view task in TaskFlow
   - Access to all attachments

## API Integration

### Sending Email with Attachments

```typescript
import { sendTaskNotificationEmail, getEmailConfig, getEmailAttachmentSettings } from '@/lib/emailNotifications';

// Get configuration
const config = await getEmailConfig();
const attachmentSettings = await getEmailAttachmentSettings();

// Send email
const result = await sendTaskNotificationEmail(
  task,              // Task object with attachments
  recipient,         // Employee object with email
  'task_assigned',   // Notification type
  'New task assigned to you',  // Message
  'John Doe',        // Action by (optional)
  config,            // Email config
  attachmentSettings // Attachment settings
);

if (result.success) {
  console.log('Email sent successfully');
} else {
  console.error('Email failed:', result.error);
}
```

### Utility Functions

```typescript
import { 
  convertTaskAttachmentsToEmailAttachments,
  filterAttachmentsForEmail,
  getAttachmentSummary,
  formatFileSize
} from '@/lib/emailAttachments';

// Convert task attachments to email format
const emailAttachments = convertTaskAttachmentsToEmailAttachments(task.attachments);

// Filter by size
const { included, excluded } = filterAttachmentsForEmail(
  task.attachments,
  10 * 1024 * 1024  // 10 MB limit
);

// Get summary
const summary = getAttachmentSummary(task.attachments);
// "3 attachments (12.5 MB)"

// Format file size
const size = formatFileSize(5242880);
// "5 MB"
```

## Troubleshooting

### Attachments Not Being Sent

**Check:**
1. Email service is configured and enabled
2. "Include attachments in emails" is enabled
3. Attachments don't exceed size limits
4. Email provider API key is valid
5. Recipient has a valid email address

### Emails Fail to Send

**Possible Causes:**
1. Total size exceeds 25 MB (reduce size or exclude files)
2. Invalid API key (reconfigure email service)
3. Network connectivity issues
4. Email provider rate limits reached
5. Invalid recipient email address

### Files Are Excluded

**Reasons:**
1. Individual file exceeds max single file size
2. Total attachments exceed max email size
3. File type is blocked for security
4. Insufficient space after including other files

**Solutions:**
- Increase size limits (up to 25 MB total)
- Compress large files
- Split into multiple emails
- Use cloud storage links for large files

## Monitoring

### Email Delivery Analytics

Access in Super Admin Settings:
- Total emails sent
- Delivery success rate
- Failed emails count
- Attachment statistics
- Provider performance

### Audit Log

All email sending attempts are logged:
- Timestamp
- Recipient
- Task details
- Attachments included/excluded
- Success/failure reason

## Privacy & Security

### Data Protection
- Attachments are transmitted securely via HTTPS
- Base64 encoding protects binary data
- No attachments stored on third-party servers
- Emails deleted per provider retention policy

### Access Control
- Only super admins can configure settings
- Users control their notification preferences
- Recipient must have valid email to receive
- Attachments follow task permissions

### Compliance
Nessuna verifica di conformita' (GDPR o altro) e' mai stata svolta su questo progetto.
Le voci seguenti descrivono intenzioni di design, non requisiti verificati:
- Gli utenti possono disattivare le notifiche email
- La retention dei dati e' configurabile nelle impostazioni di sistema

## Future Enhancements

Planned features:
- [ ] Cloud storage integration (Google Drive, Dropbox)
- [ ] Attachment preview in emails
- [ ] Selective attachment inclusion
- [ ] Compression before sending
- [ ] Virus scanning for uploads
- [ ] Email template customization for attachments
- [ ] Per-user attachment preferences
- [ ] Attachment download tracking

## Support

For issues or questions:
1. Check the Help Documentation in TaskFlow
2. Review email service logs in Super Admin Settings
3. Test email delivery with test emails
4. Verify attachment settings configuration
5. Contact your system administrator

## Version History

### v1.0 (Current) - implementato, non verificato
- Initial email attachment support
- Size limit configuration
- Smart filtering
- Exclusion notifications
- SendGrid and Resend integration
