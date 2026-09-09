# Department Management - Piano di test MANUALE

> **AVVERTENZA.** Questo e' un piano di test **da eseguire a mano**, non un rapporto di
> risultati. **Non e' mai stato eseguito integralmente e non esiste alcun test
> automatico nel repository.** Le spunte ✅ che compaiono nel documento sono
> *risultati attesi*, non risultati ottenuti. Non usarle come prova che qualcosa
> funzioni. Lo stato realmente verificato dell'applicazione e' in [STATO.md](STATO.md).

## Overview
Questo documento elenca le operazioni del modulo dipartimenti e i controlli da fare
manualmente su ciascuna.

---

## Test 1: Department Creation

### 1.1 Basic Department Creation
**Steps:**
1. Click "Departments" button in the header
2. Click "Add Department" button
3. Fill in department name (e.g., "Engineering")
4. Add description (optional)
5. Select a color or leave as default
6. Click "Create Department"

**Expected Result:**
- ✅ Department is created successfully
- ✅ Toast notification appears: "Department '[name]' created successfully!"
- ✅ Department appears in the active departments list
- ✅ Form resets after creation

**Edge Cases:**
- ❌ Empty name: Should show error "Department name is required"
- ❌ Duplicate name: Should show error "A department with this name already exists"
- ✅ Special characters in name: Should be allowed
- ✅ Very long names: Should be handled gracefully

### 1.2 Department Creation with Auto-Color
**Steps:**
1. Open Add Department dialog
2. Select "Auto-assign color" from color dropdown
3. Enter department name
4. Preview shows generated color
5. Create department

**Expected Result:**
- ✅ Color is auto-generated based on department name
- ✅ Preview displays correct color
- ✅ Each department gets a unique color
- ✅ Color is consistent if same name is used again

### 1.3 Department Creation with Full Details
**Steps:**
1. Fill in all fields:
   - Name
   - Description
   - Color
   - Department Lead (select from employees)
   - Location
   - Annual Budget
2. Create department

**Expected Result:**
- ✅ All details are saved correctly
- ✅ Lead is assigned properly
- ✅ Budget is stored as number
- ✅ Location is saved

---

## Test 2: Department Templates

### 2.1 View Templates
**Steps:**
1. Open Department Management dialog
2. Click "Templates" button

**Expected Result:**
- ✅ Templates dialog opens
- ✅ Three categories shown: Technology, Business, Creative
- ✅ Each category shows available departments
- ✅ Already existing departments are marked

### 2.2 Apply Single Template
**Steps:**
1. Open Templates dialog
2. Click "Use Template" on any department
3. Review pre-filled form
4. Click "Create Department"

**Expected Result:**
- ✅ Form is pre-filled with template data
- ✅ Name, description, and color are populated
- ✅ Can modify before creating
- ✅ Department is created successfully

### 2.3 Bulk Create from Template
**Steps:**
1. Open Templates dialog
2. Click "Create All (X)" for a category
3. Confirm creation

**Expected Result:**
- ✅ All non-existing departments in category are created
- ✅ Toast shows count: "Created X [category] departments!"
- ✅ Already existing departments are skipped
- ✅ All departments appear in active list

### 2.4 Template with Existing Departments
**Steps:**
1. Create "Engineering" manually
2. Open Templates dialog
3. Try to use "Engineering" template or bulk create Tech category

**Expected Result:**
- ✅ Template shows "Already exists" badge
- ✅ "Use Template" button is disabled for existing departments
- ✅ Bulk create skips existing departments
- ✅ Toast shows correct count of new departments created

---

## Test 3: Department Editing

### 3.1 Edit Department Name
**Steps:**
1. Click edit icon on a department
2. Change department name
3. Save changes

**Expected Result:**
- ✅ Department name is updated
- ✅ All employees assigned to old name are updated to new name
- ✅ Toast notification appears
- ✅ Changes reflect immediately in UI

### 3.2 Edit Department Details
**Steps:**
1. Edit a department
2. Change description, color, lead, location, budget
3. Save changes

**Expected Result:**
- ✅ All changes are saved
- ✅ Color updates throughout the UI
- ✅ Lead change is reflected
- ✅ No data loss

### 3.3 Edit Department to Duplicate Name
**Steps:**
1. Create "Engineering" and "Sales"
2. Try to edit "Sales" name to "Engineering"
3. Attempt to save

**Expected Result:**
- ❌ Error message: "A department with this name already exists"
- ✅ Changes are not saved
- ✅ Original name remains

---

## Test 4: Department Deletion and Archiving

### 4.1 Delete Empty Department
**Steps:**
1. Create a new department
2. Don't assign any employees
3. Click delete icon
4. Confirm deletion

**Expected Result:**
- ✅ Confirmation dialog appears
- ✅ Department is deleted successfully
- ✅ Removed from active list
- ✅ Toast notification appears

### 4.2 Attempt to Delete Department with Employees
**Steps:**
1. Create department
2. Assign employees to it
3. Try to delete department

**Expected Result:**
- ❌ Error message: "Cannot delete department with X assigned employee(s)"
- ✅ Department is NOT deleted
- ✅ Employees remain assigned

### 4.3 Archive Department
**Steps:**
1. Create department with no employees
2. Click archive icon (warning icon)
3. Confirm

**Expected Result:**
- ✅ Department moves to "Archived Departments" section
- ✅ Shows "Archived" badge
- ✅ Opacity reduced
- ✅ Toast notification appears

### 4.4 Archive Department with Employees
**Steps:**
1. Try to archive department with assigned employees

**Expected Result:**
- ❌ Error message: "Cannot archive department with X assigned employee(s)"
- ✅ Department remains active

### 4.5 Restore Archived Department
**Steps:**
1. Archive a department
2. Click "Restore" button in archived section
3. Confirm

**Expected Result:**
- ✅ Department moves back to active list
- ✅ Status changes from archived to active
- ✅ Toast notification appears
- ✅ Full functionality restored

---

## Test 5: Department Details View

### 5.1 View Department Details
**Steps:**
1. Click list icon on any department
2. View details dialog

**Expected Result:**
- ✅ Shows department name and color
- ✅ Displays total members count
- ✅ Displays active members count
- ✅ Shows lead, location, budget if set
- ✅ Lists all assigned employees

### 5.2 View Empty Department Details
**Steps:**
1. View details of department with no employees

**Expected Result:**
- ✅ Shows "No employees assigned to this department"
- ✅ Counts show 0
- ✅ No errors

---

## Test 6: Employee-Department Integration

### 6.1 Assign Employee to Department
**Steps:**
1. Open Users Management
2. Add or edit an employee
3. Assign to existing department
4. Save

**Expected Result:**
- ✅ Employee is assigned successfully
- ✅ Department stats update (employee count)
- ✅ Employee appears in department details
- ✅ Department badge shows on employee card

### 6.2 Assign Employee to Multiple Departments
**Steps:**
1. Edit employee
2. Assign to multiple departments
3. Save

**Expected Result:**
- ✅ All departments are saved in `departments` array
- ✅ Primary department is set to first one
- ✅ Employee appears in all assigned departments
- ✅ All department stats update

### 6.3 Remove Employee from Department
**Steps:**
1. Edit employee
2. Remove department assignment
3. Save

**Expected Result:**
- ✅ Department is removed from employee
- ✅ Department stats update
- ✅ Employee no longer appears in department details

### 6.4 Department Name Change Updates Employees
**Steps:**
1. Create department "Sales"
2. Assign employees to "Sales"
3. Edit department name to "Sales Team"
4. Save

**Expected Result:**
- ✅ All employees' department arrays are updated
- ✅ Old name "Sales" is replaced with "Sales Team"
- ✅ Employees still show correct department
- ✅ No orphaned references

---

## Test 7: Department Statistics

### 7.1 Active Departments Count
**Steps:**
1. View department management dialog header

**Expected Result:**
- ✅ Shows correct count of active departments
- ✅ Updates when departments are added
- ✅ Updates when departments are archived
- ✅ Does not include archived departments

### 7.2 Total Employees Count
**Steps:**
1. View department stats in header

**Expected Result:**
- ✅ Shows sum of all employees across departments
- ✅ Updates when employees are assigned
- ✅ Counts active employees only

### 7.3 Departments with Leads Count
**Steps:**
1. Assign leads to some departments
2. View stats

**Expected Result:**
- ✅ Shows count of departments with assigned leads
- ✅ Updates when leads are assigned/removed

---

## Test 8: Department Color System

### 8.1 Color Assignment
**Steps:**
1. Create multiple departments with different colors

**Expected Result:**
- ✅ Each department has unique visible color
- ✅ Color appears in department card
- ✅ Color appears in badges
- ✅ Color appears in employee cards
- ✅ OKLCH colors render correctly

### 8.2 Color Picker
**Steps:**
1. Open add/edit department dialog
2. Test color picker dropdown

**Expected Result:**
- ✅ Shows color preview swatch
- ✅ Lists 10 predefined colors
- ✅ Color name displayed
- ✅ Selected color updates preview

### 8.3 Auto-Color Generation
**Steps:**
1. Select "Auto-assign color"
2. Enter department name
3. Observe preview

**Expected Result:**
- ✅ Color is generated deterministically
- ✅ Same name = same color
- ✅ Different names = different colors
- ✅ No color collisions with existing departments

---

## Test 9: Data Persistence

### 9.1 Department Data Persists
**Steps:**
1. Create several departments
2. Refresh the page
3. Check departments

**Expected Result:**
- ✅ All departments are retained
- ✅ All details are intact (name, description, color, etc.)
- ✅ Relationships with employees maintained
- ✅ Archived status preserved

### 9.2 Concurrent Edits
**Steps:**
1. Edit a department
2. While dialog is open, have another user edit same department
3. Save changes

**Expected Result:**
- ✅ Last save wins (expected behavior)
- ✅ No data corruption
- ✅ No errors thrown

---

## Test 10: Error Handling

### 10.1 Invalid Data
**Steps:**
1. Try to create department with:
   - Empty name
   - Negative budget
   - Invalid characters

**Expected Result:**
- ✅ Appropriate error messages
- ✅ Form validation prevents submission
- ✅ No system crashes

### 10.2 Missing References
**Steps:**
1. Assign lead to department
2. Delete the lead employee
3. View department

**Expected Result:**
- ✅ Handles missing lead gracefully
- ✅ Shows "Unknown" or empty for missing lead
- ✅ No errors thrown

---

## Test 11: UI/UX Tests

### 11.1 Responsive Dialog
**Steps:**
1. Open department management on various screen sizes

**Expected Result:**
- ✅ Dialog is readable on mobile
- ✅ Scroll areas work properly
- ✅ Buttons are accessible
- ✅ No content overflow

### 11.2 Search and Filter
**Steps:**
1. Create many departments
2. Scroll through list

**Expected Result:**
- ✅ Scroll area works smoothly
- ✅ All departments are accessible
- ✅ Active/Archived sections clearly separated

### 11.3 Animations
**Steps:**
1. Create, edit, archive departments

**Expected Result:**
- ✅ Smooth animations on create
- ✅ Smooth animations on archive/restore
- ✅ No layout shifts
- ✅ Framer motion animations work

---

## Test 12: Integration Tests

### 12.1 Department Filtering in Tasks
**Steps:**
1. Create departments
2. Assign employees to departments
3. Create tasks assigned to those employees
4. Use department filter in tasks view

**Expected Result:**
- ✅ Filter dropdown shows all departments
- ✅ Filtering works correctly
- ✅ Shows tasks for employees in selected department
- ✅ "All Departments" shows all tasks

### 12.2 Department Analytics
**Steps:**
1. Navigate to Analytics view
2. Switch to "Departments" tab

**Expected Result:**
- ✅ Shows all departments with stats
- ✅ Task counts are accurate
- ✅ Completion rates calculate correctly
- ✅ Charts render properly

### 12.3 Department Badges in Task Cards
**Steps:**
1. View tasks list
2. Check task cards for employees with departments

**Expected Result:**
- ✅ Department badge appears on task cards
- ✅ Shows correct color
- ✅ Displays department name
- ✅ Multiple departments handled (shows primary)

---

## Critical Stability Checks

### ✅ Must Pass Before Go-Live

1. **No Data Loss**
   - Creating/editing/deleting departments doesn't affect unrelated data
   - Employee assignments are maintained correctly
   - Archived departments can be restored without data loss

2. **No Crashes**
   - All operations complete without errors
   - Edge cases handled gracefully
   - No undefined/null reference errors

3. **Performance**
   - Dialog opens quickly (<500ms)
   - Large lists (50+ departments) render smoothly
   - No memory leaks on repeated operations

4. **Consistency**
   - Department colors consistent across all views
   - Employee counts always accurate
   - Archived departments properly hidden/shown

5. **User Experience**
   - Clear error messages
   - Success confirmations
   - No confusing states
   - Intuitive workflows

---

## Known Issues & Fixes

### Issue 1: Form Reset on Dialog Close
**Status:** ✅ FIXED
**Fix:** Added `resetForm()` calls in dialog onOpenChange handlers

### Issue 2: Auto-Color Initial Value
**Status:** ✅ FIXED  
**Fix:** Changed default form color from 'auto' to first predefined color

### Issue 3: Employee Department Migration
**Status:** ✅ HANDLED
**Fix:** Migration logic in App.tsx handles old `department` field → `departments` array

---

## Test Execution Checklist

Before going live, execute all tests in order and mark:
- ✅ Pass
- ⚠️ Warning (works but has minor issue)
- ❌ Fail (blocks go-live)

Any ❌ must be fixed before deployment.
Any ⚠️ should be documented and prioritized for future fix.

---

## Additional Recommendations

1. **Backup Before Go-Live**
   - Export all data using Data Management
   - Store backup file safely
   - Test restore process

2. **User Training**
   - Document department management workflows
   - Share with team leads
   - Create quick start guide

3. **Monitoring**
   - Watch for errors in first week
   - Collect user feedback
   - Monitor performance metrics

4. **Gradual Rollout**
   - Start with one or two departments
   - Add more incrementally
   - Allow time for adoption

---

## Contact & Support

For issues or questions during testing:
- Review error messages carefully
- Check browser console for details
- Use Data Management export as backup
- Document steps to reproduce issues

---

**Version:** 2.0 (revisione post-migrazione Supabase)
**Status:** piano di test manuale - mai eseguito integralmente
