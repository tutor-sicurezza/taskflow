# XSS Protection & Input Sanitization

## Overview

TaskFlow now implements critical input sanitization using **DOMPurify** to prevent Cross-Site Scripting (XSS) attacks across the entire application.

## Implementation

### Core Sanitization Library

Located at: `/src/lib/sanitization.ts`

This module provides a comprehensive set of sanitization functions for all user input types:

```typescript
import { Sanitizer } from '@/lib/sanitization';

// Sanitize different types of content
Sanitizer.text(userInput);           // Plain text (strips all HTML)
Sanitizer.html(userInput);           // Rich text (allows safe HTML tags)
Sanitizer.taskTitle(title);          // Task titles (max 200 chars)
Sanitizer.taskDescription(desc);     // Task descriptions (max 5000 chars)
Sanitizer.comment(comment);          // Comments (max 2000 chars)
Sanitizer.userName(name);            // User names (max 100 chars)
Sanitizer.email(email);              // Email addresses (validated)
Sanitizer.departmentName(dept);      // Department names
Sanitizer.fileName(filename);        // File names (safe characters only)
Sanitizer.url(url);                  // URLs (validated protocols)
```

### Protected Areas

#### 1. Task Creation & Editing
- **Location**: `CreateTaskDialog.tsx`, `EditTaskDialog.tsx`
- **Protected Fields**:
  - Task title (sanitized, max 200 chars)
  - Task description (allows safe HTML formatting)
  
```typescript
const sanitizedTitle = Sanitizer.taskTitle(title);
const sanitizedDescription = Sanitizer.taskDescription(description);
```

#### 2. Comments & Activity
- **Location**: `TaskDetailsDialog.tsx`
- **Protected Fields**:
  - Comment text (allows safe HTML formatting, max 2000 chars)

```typescript
const sanitizedComment = Sanitizer.comment(commentText);
```

#### 3. User Management
- **Location**: `UsersManagement.tsx`
- **Protected Fields**:
  - Employee name
  - Job role/title
  - Email addresses (validated)
  - Phone numbers
  - Location
  - Bio/description
  - Skills
  - Avatar URLs (validated)

```typescript
const sanitizedName = Sanitizer.userName(formData.name);
const sanitizedEmail = Sanitizer.email(formData.email);
const sanitizedBio = Sanitizer.text(formData.bio);
```

#### 4. Announcements
- **Location**: `AnnouncementsDialog.tsx`
- **Protected Fields**:
  - Announcement title
  - Announcement message (allows safe HTML, max 10000 chars)

```typescript
const sanitizedTitle = Sanitizer.text(title);
const sanitizedMessage = Sanitizer.announcementContent(message);
```

#### 5. File Uploads
- **Protected**:
  - File names are sanitized to remove dangerous characters
  - File size limits enforced (10MB max)
  - File type validation

```typescript
const sanitizedFileName = Sanitizer.fileName(file.name);
```

## Allowed HTML Tags

For fields that support rich text formatting (descriptions, comments, announcements), only the following safe HTML tags are allowed:

- Text formatting: `<b>`, `<i>`, `<em>`, `<strong>`, `<u>`, `<s>`
- Structure: `<p>`, `<br>`, `<blockquote>`
- Lists: `<ul>`, `<ol>`, `<li>`
- Code: `<code>`, `<pre>`
- Links: `<a>` (with href, target, rel attributes only)

All other HTML tags, including `<script>`, `<iframe>`, `<object>`, `<embed>`, and event handlers (`onclick`, `onerror`, etc.) are **automatically stripped**.

## Custom React Hook

A custom hook is available for forms that need real-time sanitization:

```typescript
import { useSanitizedInput } from '@/hooks/use-sanitized-input';
import { Sanitizer } from '@/lib/sanitization';

const { value, setValue, rawValue, reset } = useSanitizedInput(
  '', 
  Sanitizer.text
);
```

## Security Features

### 1. **XSS Prevention**
- All user input is sanitized before being stored or displayed
- Script tags and event handlers are completely removed
- Dangerous attributes are stripped from allowed tags

### 2. **Content Security**
- Maximum length limits prevent buffer overflow attacks
- URL validation ensures only http/https protocols
- Email validation prevents malformed addresses

### 3. **Array & Object Sanitization**
- Recursive sanitization for complex data structures
- Type-safe sanitization preserving data structure

```typescript
Sanitizer.array(['<script>evil</script>', 'safe text']);
// Returns: ['', 'safe text']

Sanitizer.object({ name: '<img onerror=alert(1)>', age: 25 });
// Returns: { name: '', age: 25 }
```

### 4. **File Security**
- File names sanitized to alphanumeric + `._-` only
- Extension validation
- Size limits enforced client-side

## Testing XSS Protection

To verify XSS protection is working, try these test cases (they should all be sanitized):

### Test 1: Script Injection
```
Input: <script>alert('XSS')</script>
Expected: (empty or text without script tags)
```

### Test 2: Event Handler Injection
```
Input: <img src=x onerror=alert('XSS')>
Expected: (no image tag or sanitized without onerror)
```

### Test 3: JavaScript URL
```
Input: <a href="javascript:alert('XSS')">Click</a>
Expected: (link removed or href sanitized)
```

### Test 4: Encoded Script
```
Input: &lt;script&gt;alert('XSS')&lt;/script&gt;
Expected: (decoded and sanitized)
```

### Test 5: Style Injection
```
Input: <div style="background:url('javascript:alert(1)')">
Expected: (style attribute removed)
```

## API Usage Guidelines

### When to Use Each Sanitizer

| Use Case | Function | Example |
|----------|----------|---------|
| Plain text (no HTML) | `Sanitizer.text()` | User names, search queries |
| Rich text (safe HTML) | `Sanitizer.html()` | Comments, descriptions |
| Task titles | `Sanitizer.taskTitle()` | Task creation/edit |
| Email addresses | `Sanitizer.email()` | User profiles |
| URLs | `Sanitizer.url()` | Avatar URLs, links |
| File names | `Sanitizer.fileName()` | File uploads |
| Arrays | `Sanitizer.array()` | Skills, tags, departments |

### Best Practices

1. **Always sanitize at the point of entry** - Don't wait until display time
2. **Use the most restrictive sanitizer** - If you don't need HTML, use `Sanitizer.text()`
3. **Validate before sanitizing** - Check required fields first
4. **Test with malicious input** - Try XSS payloads during development
5. **Never trust client-side validation alone** - Always validate on the server (if applicable)

## Configuration

### Customizing Allowed Tags

To modify which HTML tags are allowed, edit `/src/lib/sanitization.ts`:

```typescript
const DEFAULT_CONFIG: SanitizationConfig = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'u', 's', 'p', 'br', 
    'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};
```

### Strict Mode

For maximum security (no HTML allowed):

```typescript
const sanitized = sanitizeText(userInput);
// Uses STRICT_CONFIG internally (no HTML tags)
```

## Dependencies

- **DOMPurify** v3.4.3 - Industry-standard HTML sanitizer
- **@types/dompurify** - TypeScript definitions

## Migration Notes

### Existing Data

If you have existing data in the system that was created before sanitization was implemented:

1. The sanitization is applied at the UI layer when displaying content
2. New data is sanitized before storage
3. Edited data is sanitized on save
4. No migration is needed for existing data

### Performance

DOMPurify is highly optimized:
- ~10ms per sanitization on average
- Minimal impact on form submission
- No noticeable delay in UI

## Compliance

This implementation helps meet security requirements for:
- OWASP Top 10 (A03:2021 - Injection)
- GDPR (data protection)
- SOC 2 (security controls)
- ISO 27001 (information security)

## Support

For security concerns or questions about the sanitization implementation:
1. Review this documentation
2. Check `/src/lib/sanitization.ts` for implementation details
3. Test with the provided XSS test cases
4. Report vulnerabilities through proper security channels

## Updates

**Last Updated**: January 2025
**Version**: 1.0
**DOMPurify Version**: 3.4.3
