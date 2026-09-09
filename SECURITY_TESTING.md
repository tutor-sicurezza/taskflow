# Security Testing Guide - XSS Protection (procedura MANUALE)

> **AVVERTENZA.** Questa e' una **procedura da eseguire a mano**, non un rapporto.
> **Non e' mai stata eseguita integralmente**, e nel repository **non esiste alcun
> test automatico di sicurezza**. Nessun audit di sicurezza indipendente e' mai stato
> svolto su questo progetto: i vecchi documenti che lo affermavano sono stati
> cancellati perche' falsi. Stato reale: [STATO.md](STATO.md).
>
> Il codice di sanitizzazione a cui si riferisce questa guida esiste
> (`src/lib/sanitization.ts`, `src/hooks/use-sanitized-input.ts`), ma il fatto che
> esista non dimostra che funzioni: va verificato eseguendo i casi qui sotto.

## Quick Security Audit Checklist

Usa questa guida per verificare manualmente la protezione XSS sui campi di input.

---

## Test Suite 1: Task Management

### Test 1.1: Task Title XSS Protection
**Location**: Create Task Dialog

**Test Cases**:
```
1. Input: <script>alert('XSS')</script>
   Expected: Title is empty or text-only without script

2. Input: Task <img src=x onerror=alert(1)> Title
   Expected: "Task  Title" (image tag removed)

3. Input: <b>Bold Title</b>
   Expected: "Bold Title" (HTML removed for title)
```

**How to Test**:
1. Click "Add Task" button
2. Paste test input into "Task Title" field
3. Click "Create Task"
4. Verify the task card shows sanitized text only

---

### Test 1.2: Task Description XSS Protection
**Location**: Create Task Dialog

**Test Cases**:
```
1. Input: <script>alert('XSS')</script>
   Expected: Script removed, safe content only

2. Input: <p>Safe paragraph</p>
   Expected: Paragraph tag allowed (renders with formatting)

3. Input: <iframe src="evil.com"></iframe>
   Expected: Iframe completely removed

4. Input: <a href="javascript:alert(1)">Click</a>
   Expected: Link removed or href sanitized
```

**How to Test**:
1. Click "Add Task"
2. Enter test input in "Description" field
3. Create task and view details
4. Verify only safe HTML is rendered

---

### Test 1.3: Task Comments XSS Protection
**Location**: Task Details Dialog

**Test Cases**:
```
1. Input: <script>console.log('hacked')</script>
   Expected: Script removed

2. Input: Comment with <strong>bold</strong> text
   Expected: Bold formatting preserved

3. Input: <img src=x onerror=alert('xss')>
   Expected: Image tag removed
```

**How to Test**:
1. Open any task details
2. Scroll to comments section
3. Enter test input in comment field
4. Submit comment
5. Verify sanitized output in comment list

---

## Test Suite 2: User Management

### Test 2.1: Employee Name XSS Protection
**Location**: Users Management Dialog

**Test Cases**:
```
1. Input: <script>alert('XSS')</script>
   Expected: Empty or text-only

2. Input: John<img src=x onerror=alert(1)>Doe
   Expected: "JohnDoe" (tag removed)

3. Input: Jane <b>Bold</b> Smith
   Expected: "Jane  Smith" (HTML removed)
```

**How to Test**:
1. Click "Users" icon in header
2. Click "Add Team Member"
3. Enter test input in "Name" field
4. Submit form
5. Verify name displays sanitized text only

---

### Test 2.2: Employee Email Validation
**Location**: Users Management Dialog

**Test Cases**:
```
1. Input: test@example.com<script>alert(1)</script>
   Expected: Invalid email error or script removed

2. Input: javascript:alert(1)@example.com
   Expected: Invalid email error

3. Input: valid@example.com
   Expected: Email accepted
```

**How to Test**:
1. Add/Edit team member
2. Enter test email
3. Verify validation and sanitization

---

### Test 2.3: Employee Bio/Description
**Location**: Users Management Dialog

**Test Cases**:
```
1. Input: <script>alert('XSS')</script>
   Expected: Script removed

2. Input: Bio with <a href="http://safe.com">link</a>
   Expected: Safe link preserved

3. Input: <style>body{display:none}</style>
   Expected: Style tag removed
```

---

## Test Suite 3: Announcements

### Test 3.1: Announcement Title
**Location**: Announcements Dialog

**Test Cases**:
```
1. Input: <script>alert('Announcement XSS')</script>
   Expected: Script removed

2. Input: URGENT<img src=x onerror=alert(1)>
   Expected: "URGENT" (image removed)
```

**How to Test**:
1. Click "Announcements" megaphone icon
2. Go to "Create" tab
3. Enter test input in title field
4. Create announcement
5. View in announcements list

---

### Test 3.2: Announcement Message
**Location**: Announcements Dialog

**Test Cases**:
```
1. Input: Message with <script>evil()</script>
   Expected: Script removed

2. Input: <p>Formatted message</p>
   Expected: Paragraph formatting preserved

3. Input: <iframe src="evil"></iframe>
   Expected: Iframe removed
```

---

## Test Suite 4: File Uploads

### Test 4.1: Malicious File Names
**Location**: Task Details - Attachments

**Test Cases**:
```
1. Filename: <script>alert(1)</script>.pdf
   Expected: Sanitized to safe characters

2. Filename: ../../../../etc/passwd
   Expected: Path traversal characters removed

3. Filename: file"';.pdf
   Expected: Special characters sanitized
```

**How to Test**:
1. Open task details
2. Click attachments tab
3. Try uploading file with malicious name
4. Verify filename is sanitized in display

---

## Test Suite 5: Search & Filters

### Test 5.1: Search Query XSS
**Location**: Users Management Search

**Test Cases**:
```
1. Input: <script>alert('search')</script>
   Expected: Script removed, search works normally

2. Input: <img src=x onerror=alert(1)>
   Expected: Tag removed, search continues
```

**How to Test**:
1. Open Users Management
2. Enter test input in search field
3. Verify results are filtered safely

---

## Test Suite 6: Department Management

### Test 6.1: Department Name XSS
**Location**: Department Management Dialog

**Test Cases**:
```
1. Input: <script>alert('dept')</script>
   Expected: Script removed

2. Input: IT<img src=x>Department
   Expected: "ITDepartment" (tag removed)
```

**How to Test**:
1. Open Department Management
2. Create new department with test input
3. Verify department name is sanitized

---

## Automated Testing Script

### Browser Console Test
Open browser console and run:

```javascript
// Test 1: Verify DOMPurify is loaded
console.log('DOMPurify loaded:', typeof window.DOMPurify !== 'undefined');

// Test 2: Quick XSS test
const testInput = '<script>alert("XSS")</script>';
const sanitized = window.DOMPurify.sanitize(testInput);
console.log('Input:', testInput);
console.log('Sanitized:', sanitized);
console.log('Safe:', !sanitized.includes('<script>'));
```

---

## Security Regression Tests

Run these tests after any major update:

### Checklist
- [ ] Task title injection blocked
- [ ] Task description allows safe HTML only
- [ ] Comments sanitized properly
- [ ] User names are plain text only
- [ ] Emails validated and sanitized
- [ ] URLs validated (http/https only)
- [ ] File names sanitized
- [ ] Announcement content sanitized
- [ ] Search queries sanitized
- [ ] Department names sanitized
- [ ] No console errors during sanitization
- [ ] Performance acceptable (< 100ms)

---

## Common XSS Payloads to Test

Use these payloads across all input fields:

```html
1. <script>alert('XSS')</script>
2. <img src=x onerror=alert(1)>
3. <svg onload=alert('XSS')>
4. <iframe src="javascript:alert('XSS')">
5. <body onload=alert('XSS')>
6. <input onfocus=alert('XSS') autofocus>
7. <select onfocus=alert('XSS') autofocus>
8. <textarea onfocus=alert('XSS') autofocus>
9. <marquee onstart=alert('XSS')>
10. <div style="background:url('javascript:alert(1)')">
11. "><script>alert('XSS')</script>
12. '><script>alert('XSS')</script>
13. <scr<script>ipt>alert('XSS')</scr</script>ipt>
14. %3Cscript%3Ealert('XSS')%3C/script%3E
15. &lt;script&gt;alert('XSS')&lt;/script&gt;
```

**Expected Result**: ALL payloads should be sanitized and not execute.

---

## Reporting Security Issues

If you find a bypass or vulnerability:

1. **DO NOT** disclose publicly
2. Document the exact steps to reproduce
3. Note which sanitizer function failed
4. Include the malicious payload that worked
5. Report through secure channel
6. Include browser/OS information

### Report Template
```
## Security Vulnerability Report

**Component**: [e.g., Task Creation Dialog]
**Field**: [e.g., Task Description]
**Severity**: [Critical/High/Medium/Low]

**Payload**:
```
[malicious input that bypassed sanitization]
```

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [etc.]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Impact**:
[Potential security impact]

**Browser/Environment**:
- Browser: [Chrome 120, Firefox 121, etc.]
- OS: [Windows 11, macOS 14, etc.]
- TaskFlow Version: [1.0]
```

---

## Security Best Practices Reminder

1. ✅ Always sanitize user input
2. ✅ Use most restrictive sanitizer appropriate for the data
3. ✅ Validate data types before sanitization
4. ✅ Test with real XSS payloads
5. ✅ Keep DOMPurify updated
6. ✅ Review code changes for sanitization coverage
7. ✅ Monitor for new XSS vectors
8. ✅ Log sanitization failures for security review

---

## Quick Pass/Fail Test

### 5-Minute Security Check

1. **Task Title**: Try `<script>alert(1)</script>` → Should see empty or plain text ✓/✗
2. **Comment**: Try `<img src=x onerror=alert(1)>` → Should not execute ✓/✗
3. **User Name**: Try `<b>test</b>` → Should see "test" plain text ✓/✗
4. **Email**: Try `test@test.com<script>` → Should validate/reject ✓/✗
5. **Announcement**: Try `<iframe src=x>` → Should be removed ✓/✗

**All 5 must pass** for basic XSS protection to be working.

---

**Last Updated**: January 2025
**Test Version**: 1.0
