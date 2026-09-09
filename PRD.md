# Planning Guide (PRD)

> **Nota.** Documento di prodotto: descrive cosa l'applicazione deve fare, non cosa e'
> stato verificato. Per lo stato reale (cosa funziona davvero e cosa no) vedi
> [STATO.md](STATO.md). Alcuni riferimenti risalgono al template GitHub Spark: lo
> stack attuale e' React 19 + Vite + Supabase, con le funzioni server su Vercel in
> `api/`.

A collaborative task management system that enables teams to assign, track, and complete work across employees with clear visibility into workload and progress.

**Experience Qualities**: 
1. **Efficient** - Information is dense but organized, allowing managers to quickly scan team status and take action
2. **Transparent** - Everyone can see who's working on what, fostering accountability and preventing duplicate work
3. **Empowering** - Simple interactions make it easy to update status, reassign work, and celebrate completions

**Complexity Level**: Light Application (multiple features with basic state)
This is a task management tool with standard CRUD operations, filtering, and assignment features - more complex than a simple list but not requiring advanced workflows or multiple distinct views.

## Essential Features

### Create Task
- **Functionality**: Add new tasks with title, description, assignee, priority, and due date
- **Purpose**: Capture work that needs to be done and assign responsibility
- **Trigger**: Click "Add Task" button
- **Progression**: Click button → Modal opens → Fill form fields → Click "Create" → Task appears in list
- **Success criteria**: Task persists, appears correctly filtered, shows assigned employee

### Assign/Reassign Employee
- **Functionality**: Change which employee is responsible for a task
- **Purpose**: Distribute workload and adapt to changing team capacity
- **Trigger**: Click employee dropdown on task card
- **Progression**: Click dropdown → Select employee → Assignment updates immediately
- **Success criteria**: Task moves to correct employee's section, change persists on refresh

### Update Task Status
- **Functionality**: Move tasks between Not Started, In Progress, and Completed states
- **Purpose**: Track progress and maintain accurate team workload view
- **Trigger**: Click status dropdown on task card
- **Progression**: Click dropdown → Select new status → Visual state updates
- **Success criteria**: Task appearance changes, filters work correctly, completion metrics update

### Filter and Sort
- **Functionality**: View tasks by employee, priority, status, or due date
- **Purpose**: Focus on relevant subset of work and identify urgent items
- **Trigger**: Select filter/sort options in toolbar
- **Progression**: Click filter → Options appear → Select criteria → List updates instantly
- **Success criteria**: Only matching tasks visible, sort order reflects selection

### Delete Task
- **Functionality**: Remove tasks that are no longer relevant
- **Purpose**: Keep the workspace clean and focused on active work
- **Trigger**: Click delete icon on task card
- **Progression**: Click delete → Confirmation dialog → Confirm → Task removed
- **Success criteria**: Task disappears immediately and doesn't return on refresh

### User Management
- **Functionality**: Add, edit, and remove team members from the workspace
- **Purpose**: Maintain accurate team roster and enable proper task assignment
- **Trigger**: Click "Manage Users" button in header
- **Progression**: Click button → Dialog opens with user list → Add/Edit/Delete users → Changes persist immediately
- **Success criteria**: Users persist across sessions, deleted users' tasks become unassigned, edited user info updates everywhere

### Edit Task Details
- **Functionality**: Update existing task information (title, description, assignee, priority, due date)
- **Purpose**: Adapt tasks as requirements change without recreating them
- **Trigger**: Click edit icon on task card
- **Progression**: Click edit → Modal opens with pre-filled form → Update fields → Save → Changes reflected immediately
- **Success criteria**: All changes persist, activity history tracks what changed

### Bulk Operations
- **Functionality**: Select multiple tasks and perform actions on all at once (complete, change status, delete)
- **Purpose**: Efficiently manage multiple related tasks
- **Trigger**: Click "Bulk Select" button to enter bulk mode
- **Progression**: Enter bulk mode → Select tasks → Choose action → Confirm → All tasks update
- **Success criteria**: All selected tasks update correctly, appropriate feedback shown

### Comments and Activity History
- **Functionality**: Add comments to tasks and view complete audit trail of changes
- **Purpose**: Enable team collaboration and maintain transparency on task evolution
- **Trigger**: Click on task card to open details dialog
- **Progression**: Open details → View activity tab → Add comment or see history → Changes tracked automatically
- **Success criteria**: Comments persist, activity log shows all changes with timestamps and user attribution

### File Attachments
- **Functionality**: Upload and attach files to tasks (images, documents, etc.)
- **Purpose**: Keep task-related resources organized and accessible
- **Trigger**: Click attachment button in task details dialog
- **Progression**: Open details → Click attach → Select file → Upload → File appears in attachments list
- **Success criteria**: Files persist, can be downloaded, and can be deleted by authorized users

### Team Performance Analytics
- **Functionality**: Visualize team performance metrics with interactive charts and dashboards
- **Purpose**: Provide managers with insights into task completion rates, workload distribution, and team member performance
- **Trigger**: Click "Analytics" button in main header
- **Progression**: Click Analytics → View dashboard with charts → Switch between Overview/Team Performance/Trends tabs → Analyze data
- **Success criteria**: Charts update in real-time, show accurate metrics, and provide actionable insights about team performance

### AI Assistant
- **Functionality**: Conversational AI interface that provides intelligent task management assistance
- **Purpose**: Enable natural language interactions for task creation, analysis, and recommendations
- **Trigger**: Click "AI Assistant" button in header
- **Progression**: Open dialog → Ask questions or request actions → Review AI suggestions → Apply recommended changes
- **Success criteria**: AI responds contextually, generates actionable suggestions, and successfully applies changes when approved

### AI-Powered Insights
- **Functionality**: Automatically generated team performance insights and recommendations
- **Purpose**: Proactively identify issues like workload imbalances, overdue patterns, and productivity opportunities
- **Trigger**: Displays automatically in Analytics view, refreshable on demand
- **Progression**: View Analytics → See AI insights card → Read recommendations → Take action based on insights
- **Success criteria**: Insights are relevant, specific, and actionable with clear priorities

### AI Auto-Assignment
- **Functionality**: Intelligently assign unassigned tasks based on workload, skills, and priorities
- **Purpose**: Optimize task distribution across the team automatically
- **Trigger**: Click "AI Auto-Assign" button (appears when unassigned tasks exist)
- **Progression**: Click button → AI analyzes tasks and team → Review assignment suggestions → Apply all or cancel
- **Success criteria**: Assignments balance workload, consider priority and deadlines, persist correctly

### Department Management
- **Functionality**: Create and manage organizational departments with comprehensive details including leads, budgets, and locations
- **Purpose**: Organize team structure, track departmental information, and assign employees to multiple departments
- **Trigger**: Click "Departments" button in header
- **Progression**: Click button → View all departments → Add/Edit/Archive departments → Assign department leads → View department details with team roster
- **Success criteria**: Departments persist with all metadata, color-coding displays consistently, employee assignments update across the system, archived departments remain accessible but hidden from active use, department details show accurate team member counts and lead information

### Email Template Customization
- **Functionality**: Customize email notification templates for all automated task notifications with HTML and plain text versions
- **Purpose**: Allow super admins to tailor email communications to match company branding and communication style
- **Trigger**: Click "Email Templates" button in header (admin only)
- **Progression**: Open dialog → Select notification type → Edit subject line → Modify HTML/plain text content → Insert variables → Preview changes → Save template
- **Success criteria**: Templates persist across sessions, variables automatically populate with actual values, reset to default option available, preview accurately represents final output, active/inactive toggle controls template usage

### SendGrid Email Integration
- **Functionality**: Configure and manage live email delivery via SendGrid or Resend with full SMTP support and attachment capabilities
- **Purpose**: Enable real-time email notifications for task assignments, updates, and system alerts with professional email delivery including task files
- **Trigger**: Navigate to Super Admin Settings → Email tab
- **Progression**: Select provider (SendGrid/Resend) → Enter API key → Test connection → Configure sender details → Send test email → Enable service → Monitor statistics
- **Success criteria**: API connection validates successfully, test emails deliver correctly, all task notifications send automatically, delivery statistics track sent/delivered/failed counts, email logs persist for audit trail, configuration persists across sessions

### Email Attachment Support
- **Functionality**: Include task file attachments in email notifications with configurable size limits and smart filtering
- **Purpose**: Ensure recipients receive all relevant task files directly in their email for offline access and convenience
- **Trigger**: Click "Email Attachments" button in admin toolbar (super admin only)
- **Progression**: Open settings → Toggle attachment inclusion → Set maximum single file size (1-10 MB) → Set maximum total email size (5-25 MB) → Configure exclusion notifications → Save settings
- **Success criteria**: Attachments included in emails up to configured limits, large files automatically excluded with notification, file types validated for security, settings persist across sessions, email delivery respects provider limits (25 MB for SendGrid/Resend)

### User Onboarding & Help
- **Functionality**: Interactive welcome guide for first-time users and comprehensive in-app documentation
- **Purpose**: Help new users understand all features and navigate the system effectively
- **Trigger**: Automatically displays on first visit, accessible via "Help" button
- **Progression**: Welcome guide shows 5-step tour of key features → Users can skip or complete → Help documentation provides detailed guides organized by feature category
- **Success criteria**: Guide shows once per user, help documentation covers all features with clear examples, searchable by topic

### Data Backup & Restore
- **Functionality**: Export all application data as JSON backup, import from previous backups, clear all data
- **Purpose**: Protect user data and enable migration between systems or recovery from mistakes
- **Trigger**: Click "Backup & Restore" button in header
- **Progression**: Open dialog → Choose export (downloads JSON file), import (upload JSON file), or clear data (with double confirmation) → Changes take effect immediately
- **Success criteria**: Backups include all tasks, employees, announcements, notifications with timestamps, imports validate file format, clear data requires confirmation, export generates timestamped filenames

## Edge Case Handling
- **Empty States**: When no tasks exist or filters return no results, show encouraging message with quick action to add first task
- **Overdue Tasks**: Automatically highlight tasks past due date with visual indicator (red accent)
- **Unassigned Tasks**: Allow tasks without assignee, group in "Unassigned" section
- **Long Text**: Truncate long titles/descriptions with ellipsis, expand on hover or in detail view
- **No Employees**: If employee list is empty, show empty state in user management with prominent "Add User" action
- **Delete Employee with Tasks**: Warn user when deleting an employee who has assigned tasks, automatically unassign those tasks
- **Large File Uploads**: Limit file attachments to 10MB, show clear error message if exceeded
- **Empty Comments**: Prevent submission of blank comments
- **No Data Analytics**: When no tasks exist, show empty state encouraging user to create tasks to see analytics
- **Single Team Member**: Analytics still display meaningfully with just one team member
- **AI Failures**: If AI requests fail, show friendly error message and allow retry without breaking app
- **No Unassigned Tasks**: Auto-assign button only appears when there are unassigned tasks to distribute
- **Department Name Conflicts**: Prevent creating departments with duplicate names among active departments
- **Delete Department with Employees**: Prevent deletion of departments that have assigned employees, require reassignment first
- **Archive Department with Employees**: Prevent archiving departments that have assigned employees
- **Department Rename**: When renaming a department, automatically update all employee assignments to reference new name
- **No Departments**: Show empty state with encouragement to create first department
- **Invalid Email Template Variables**: If template contains variables that don't exist for that notification type, they display as-is without replacement
- **Missing Subject Line**: Prevent saving template without a subject line
- **Template Reset Confirmation**: Warn users before resetting to default that all customizations will be lost
- **First Time User**: Welcome guide automatically shows on first visit, can be skipped
- **Help Access**: Help documentation always accessible via header button, organized by feature category
- **Export Filename**: Backup files automatically named with date (e.g., taskflow-backup-2024-01-15.json)
- **Invalid Import File**: Show clear error if imported file is not valid JSON or missing required fields
- **Confirm Data Clear**: Require double confirmation before clearing all data to prevent accidents
- **Large Backup Files**: Handle backups efficiently even with thousands of tasks and employees

## Design Direction
Professional yet approachable workspace tool that feels organized without being sterile. Should evoke a sense of control and clarity, like a well-organized desk. Modern corporate aesthetic with warm touches.

## Color Selection
A sophisticated palette balancing professionalism with energy, using deep teals and warm accents.

- **Primary Color**: Deep teal `oklch(0.45 0.12 210)` - Communicates trust, stability, and focus. Used for primary actions and active states
- **Secondary Colors**: Soft slate `oklch(0.92 0.01 220)` for backgrounds and muted navy `oklch(0.35 0.08 230)` for secondary text - Creates professional, calm foundation
- **Accent Color**: Coral orange `oklch(0.68 0.18 35)` - Energizing highlight for important actions, overdue items, and completion celebrations
- **Foreground/Background Pairings**: 
  - Background (White `oklch(0.99 0 0)`): Foreground `oklch(0.25 0.02 230)` - Ratio 12.1:1 ✓
  - Primary (Deep Teal `oklch(0.45 0.12 210)`): White text `oklch(0.99 0 0)` - Ratio 7.2:1 ✓
  - Accent (Coral `oklch(0.68 0.18 35)`): Dark text `oklch(0.25 0.02 230)` - Ratio 6.8:1 ✓
  - Card (Light slate `oklch(0.97 0.005 220)`): Foreground `oklch(0.25 0.02 230)` - Ratio 13.5:1 ✓

## Font Selection
Typography should feel corporate-professional yet modern and readable - conveying organization and competence.

- **Typographic Hierarchy**: 
  - H1 (Page Title): Work Sans SemiBold/32px/tight tracking (-0.02em)
  - H2 (Section Headers): Work Sans Medium/20px/tight tracking (-0.01em)
  - H3 (Task Titles): Work Sans Medium/16px/normal tracking
  - Body (Descriptions): Inter Regular/14px/relaxed leading (1.6)
  - Labels (Meta info): Inter Medium/12px/wide tracking (0.02em)/uppercase

## Animations
Animations reinforce status changes and provide feedback without slowing workflow.

- **Task State Changes**: Smooth 200ms color fade when status updates
- **Task Creation**: Modal slides up with 300ms spring ease, new task fades in to list
- **Hover States**: Subtle 150ms lift on task cards (2px translate + soft shadow)
- **Completion**: Brief scale pulse (1.05x) and confetti-style particle burst for completed tasks
- **Drag Interactions**: If implementing drag-to-reorder, smooth 250ms position transitions

## Component Selection

- **Components**: 
  - Dialog: Task creation/editing modal with form fields
  - Card: Task display with elevated styling and hover states
  - Select: Employee and status dropdowns with search
  - Badge: Priority levels (High/Medium/Low) with color coding
  - Button: Primary actions (Add Task) using filled primary color, secondary actions (Cancel) using ghost variant
  - Input/Textarea: Form fields with floating labels
  - Separator: Dividing sections and grouping related tasks
  - Alert Dialog: Delete confirmation to prevent accidents
  - Tabs: Switching between "All Tasks", "My Tasks", "Team View"
  - Avatar: Employee profile pictures in assignments and headers

- **Customizations**: 
  - Custom task card with status indicator stripe on left edge (4px width, color-coded by priority)
  - Employee selector with avatar thumbnails in dropdown
  - Empty state illustrations (simple SVG icons)
  - Priority badges with custom colors (High: coral, Medium: amber, Low: slate)

- **States**: 
  - Buttons: Default with solid bg → Hover lifts with deeper shadow → Active depresses slightly → Disabled grays out at 40% opacity
  - Task Cards: Default elevated subtle → Hover lifts more → Selected has primary color border → Overdue has pulsing red accent glow
  - Inputs: Default with border → Focus gets primary ring and label animates → Filled shows check icon → Error shows red ring and message
  - Dropdowns: Closed shows current value → Opens with slide-down 200ms → Hover highlights options with secondary bg → Selected shows check mark

- **Icon Selection**: 
  - Plus (add task)
  - UserCircle (assign employee)
  - Users (manage team members)
  - UserPlus (add new user)
  - PencilSimple (edit)
  - Clock (due dates)
  - CheckCircle (completed)
  - Circle (not started)
  - CircleHalf (in progress)
  - ArrowsDownUp (sort)
  - FunnelSimple (filter)
  - Trash (delete)
  - CalendarBlank (date picker trigger)
  - ChatCircle (comments)
  - Paperclip (attachments)
  - CheckSquare (bulk select)
  - ChartBar (analytics view)
  - ListChecks (tasks view)
  - TrendUp (performance indicators)
  - Target (goals/metrics)
  - Sparkle (AI features icon)

- **Spacing**: 
  - Page padding: p-6 (24px)
  - Card padding: p-4 (16px)
  - Card gap: gap-4 (16px) between cards
  - Section gap: gap-8 (32px) between major sections
  - Form field gap: gap-3 (12px) vertically
  - Button padding: px-4 py-2 (16px/8px)

- **Mobile**: 
  - Stack filters vertically instead of horizontal toolbar
  - Task cards full width with slightly reduced padding (p-3)
  - Dialog becomes full-screen sheet on mobile
  - Tabs scroll horizontally if needed
  - Reduce typography scale by 10% for smaller screens
  - Avatar sizes reduce from 40px to 32px
