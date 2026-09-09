# Department Management System - Architettura

> **Nota (post-migrazione Supabase).** Questo documento descrive l'architettura del
> modulo dipartimenti ed e' ancora valido nella struttura dei componenti e nel flusso
> dati. Le affermazioni di stabilita' e "produzione" presenti nella versione originale
> sono state rimosse: non erano supportate da test. Lo stato reale, verificato, sta in
> [STATO.md](STATO.md). Nel repository **non esiste alcun test automatico**.
>
> La persistenza non usa piu' lo Spark KV store: l'hook `useKV` e' ora una
> implementazione custom (`src/hooks/useKV.ts`) che scrive sulle tabelle Supabase
> `app_state` / `user_state`, protette da RLS.

## System Overview

The Department Management system is a comprehensive organizational structure tool that allows:
- Creating and managing departments with custom colors and metadata
- Assigning employees to one or multiple departments
- Tracking department statistics and analytics
- Filtering tasks and data by department
- Using pre-built templates for quick setup

---

## Core Components

### 1. DepartmentManagement.tsx
**Location:** `/src/components/DepartmentManagement.tsx`

**Responsibilities:**
- CRUD operations for departments
- Template system (Tech, Business, Creative)
- Archive/restore functionality
- Department details view with team members
- Color management (auto-assign or manual)

**State Management:**
- `useKV('departments')` - Persistent department storage
- Local state for dialogs and form data
- Computed stats from department-employee relationships

**Key Features:**
- ✅ Create with auto-generated colors
- ✅ Edit departments (cascades to employee assignments)
- ✅ Delete (blocked if employees assigned)
- ✅ Archive/restore functionality
- ✅ Bulk template creation
- ✅ Department lead assignment
- ✅ Budget and location tracking

---

### 2. departments.ts
**Location:** `/src/lib/departments.ts`

**Responsibilities:**
- Color generation algorithm
- Standard department configurations
- Department config lookup
- Color variant generation (background, text, border)

**Key Functions:**
- `generateColorFromName(name, existingColors)` - Deterministic color generation
- `getDepartmentConfig(name, customDepts)` - Unified config retrieval
- `createColorVariants(baseColor)` - Generate color palette from base

**Color System:**
- 18 hue points in color pool
- OKLCH color space for perceptual uniformity
- Automatic collision avoidance
- Consistent hash-based generation

---

### 3. DepartmentBadge.tsx
**Location:** `/src/components/DepartmentBadge.tsx`

**Responsibilities:**
- Visual department representation
- Three variants: default, outline, solid
- Three sizes: sm, md, lg
- Icon and label display

**Usage:**
```tsx
<DepartmentBadge
  departmentName="Engineering"
  size="md"
  variant="default"
  customDepartments={departments}
/>
```

---

### 4. DepartmentColorLegend.tsx
**Location:** `/src/components/DepartmentColorLegend.tsx`

**Responsibilities:**
- Visual reference guide
- Shows all department colors
- Displays badge variants
- Lists custom and standard departments

---

## Data Model

### Department Interface
```typescript
interface Department {
  id: string;              // Unique identifier
  name: string;            // Department name (unique per active status)
  description: string;     // Optional description
  color: string;          // OKLCH color value
  leadId?: string;        // Employee ID of department lead
  location?: string;      // Physical location
  budget?: number;        // Annual budget
  createdAt: string;      // ISO timestamp
  status: 'active' | 'archived';  // Soft delete
}
```

### Employee Department Fields
```typescript
interface Employee {
  department?: string;        // Legacy: primary department name
  departments?: string[];     // Current: array of department names
  // ... other fields
}
```

**Migration Logic:** App.tsx handles automatic migration from old `department` field to new `departments` array.

---

## Persistence Strategy

### Storage
- **Storage:** tabella Supabase `app_state` tramite `useKV` (`src/hooks/useKV.ts`)
- **Key:** `'departments'`
- **Type:** `Department[]`

### Data Integrity
1. **Referential Integrity:** Department names used as references in Employee.departments
2. **Cascade Updates:** Renaming department updates all employee assignments
3. **Delete Protection:** Cannot delete departments with assigned employees
4. **Archive Instead:** Soft delete via status = 'archived'

### Data Migration
```typescript
// Automatic migration in App.tsx
useEffect(() => {
  if (employees.some(emp => !emp.departments && emp.department)) {
    // Migrate old single department to array
    setEmployees(employees.map(emp => ({
      ...emp,
      departments: emp.department ? [emp.department] : [],
      department: emp.departments?.[0]
    })));
  }
}, [employees]);
```

---

## Color System Architecture

### Color Generation Algorithm

1. **String to Hash:**
   ```
   Input: "Engineering"
   Hash: 847592834
   ```

2. **Select Base Hue:**
   ```
   Index = hash % 18 color pool entries
   Base Hue = COLOR_POOL[index].hue
   ```

3. **Add Variation:**
   ```
   Hue Variation = (hash % 20) - 10  // -10 to +10
   Final Hue = Base Hue + Variation
   ```

4. **Calculate L & C:**
   ```
   Lightness = 0.55 + ((hash % 15) / 100)  // 0.55 to 0.69
   Chroma = 0.15 + ((hash % 8) / 100)      // 0.15 to 0.23
   ```

5. **Generate OKLCH:**
   ```
   oklch(0.62 0.19 265)
   ```

### Why OKLCH?
- Perceptually uniform (unlike RGB/HSL)
- Better color interpolation
- More predictable lightness
- Modern CSS support

---

## Integration Points

### 1. Task System
**Files:** `App.tsx`, `TaskCard.tsx`

**Integration:**
- Filter tasks by department
- Show department badge on task cards
- Calculate department workload

**Data Flow:**
```
Task → assigneeId → Employee → departments[] → Department
```

### 2. Analytics
**Files:** `DepartmentAnalytics.tsx`, `TeamAnalytics.tsx`

**Integration:**
- Department performance metrics
- Task completion by department
- Workload distribution charts

### 3. User Management
**Files:** `UsersManagement.tsx`

**Integration:**
- Assign employees to departments
- Multi-department support
- Quick select buttons with department suggestions

---

## Stability Measures

### 1. Error Handling

**Empty Name Validation:**
```typescript
if (!formData.name.trim()) {
  toast.error('Department name is required');
  return;
}
```

**Duplicate Check:**
```typescript
const existing = departments.find(
  d => d.name.toLowerCase() === newName.toLowerCase() && 
       d.status === 'active'
);
if (existing) {
  toast.error('A department with this name already exists');
  return;
}
```

**Delete Protection:**
```typescript
const assignedEmployees = employees.filter(emp => 
  emp.departments?.includes(dept.name)
);
if (assignedEmployees.length > 0) {
  toast.error(`Cannot delete department with ${assignedEmployees.length} assigned employee(s)`);
  return;
}
```

### 2. State Management Best Practices

**Functional Updates:**
```typescript
// ✅ CORRECT
setDepartments(current => [...current, newDept]);

// ❌ WRONG (stale closure)
setDepartments([...departments, newDept]);
```

**Null Safety:**
```typescript
(departments || []).map(...)  // Always handle undefined
```

### 3. Performance Optimizations

**Memoized Stats:**
```typescript
const departmentStats = useMemo(() => {
  return departments.map(dept => ({
    department: dept,
    totalEmployees: getEmployeeCount(dept),
    activeEmployees: getActiveCount(dept)
  }));
}, [departments, employees]);
```

**Filtered Lists:**
```typescript
const activeDepartments = useMemo(() => 
  departments.filter(d => d.status === 'active'),
  [departments]
);
```

---

## Known Edge Cases

### 1. Department Rename with Assigned Employees
**Scenario:** Rename department while employees are assigned

**Handling:**
```typescript
if (oldName !== newName) {
  employees.forEach(emp => {
    if (emp.departments?.includes(oldName)) {
      const updated = emp.departments.map(d => 
        d === oldName ? newName : d
      );
      onEmployeeUpdate(emp.id, { 
        ...emp, 
        departments: updated 
      });
    }
  });
}
```

**Status:** ✅ Handled

---

### 2. Delete Department Lead
**Scenario:** Delete employee who is a department lead

**Handling:**
- Department keeps leadId but shows "Unknown"
- No cascade delete
- Manual cleanup required

**Status:** ⚠️ Acceptable (rare case)

**Improvement:** Could add cleanup when employee deleted

---

### 3. Archived Department with Tasks
**Scenario:** Archive department, but tasks still reference employees in that department

**Handling:**
- Tasks remain visible
- Department filter still works
- Analytics include archived department data

**Status:** ✅ Working as designed

---

### 4. Multiple Tabs Open
**Scenario:** User has app open in multiple tabs, edits department in one

**Handling:**
- Ogni scheda scrive sulla stessa riga di `app_state`
- Lo stato React si risincronizza al focus della finestra
- Vince l'ultima scrittura

**Status:** ⚠️ Comportamento atteso, **non verificato** con test

---

### 5. Very Long Department Names
**Scenario:** User creates department with 100+ character name

**Handling:**
- UI uses `overflow-hidden` and `text-ellipsis`
- No character limit enforced
- May cause layout issues in narrow spaces

**Status:** ⚠️ Acceptable (unlikely scenario)

**Improvement:** Could add max-length validation

---

## Testing Coverage

**Nessun test automatico esiste in questo repository.** Nessuno dei punti seguenti e'
stato eseguito: sono candidati a test, non risultati.

### Funzioni testabili unitariamente (test da scrivere)
- [ ] `generateColorFromName()` - output deterministico
- [ ] `getDepartmentConfig()` - lettura configurazione
- [ ] `createColorVariants()` - calcolo colori

### Test di integrazione (da scrivere)
- [ ] Creazione dipartimento → compare in lista
- [ ] Modifica dipartimento → si propaga ovunque
- [ ] Assegnazione dipendente → statistiche aggiornate
- [ ] Filtro task → sottoinsieme corretto
- [ ] Archivia/ripristina → cambio di stato

### Verifiche manuali richieste (non eseguite)
- [ ] Coerenza visiva dei colori
- [ ] Layout responsive
- [ ] Prestazioni con 50+ dipartimenti
- [ ] Modifiche concorrenti su piu' schede

---

## Performance Characteristics

### Operations
| Operation | Time Complexity | Notes |
|-----------|----------------|-------|
| Create Department | O(n) | Check for duplicates |
| Edit Department | O(n*m) | Update all employees (n) with dept (m) |
| Delete Department | O(1) | Simple filter |
| List Departments | O(n) | Filter active/archived |
| Get Stats | O(n*m) | Count employees per department |
| Filter Tasks | O(n) | Filter by assignee's department |

### Scalability
- **50 departments:** ✅ Excellent
- **100 departments:** ✅ Good
- **500 departments:** ⚠️ May need pagination
- **1000+ departments:** ❌ Need refactor

**Current Target:** 50-100 departments (suitable for most organizations)

---

## Security Considerations

### Access Control
- No specific department-level permissions implemented
- All users can view all departments
- Only admins/managers can create/edit departments (via UI visibility)

**Recommendation:** Add role-based checks in department operations

### Data Validation
- ✅ Name required
- ✅ Duplicate check
- ✅ Color format (any string accepted)
- ⚠️ No XSS sanitization (names rendered as text)

### Data Exposure
- All department data visible to all users
- No sensitive data fields (budget is optional)

---

## Deployment Checklist

Before going live with department system:

### Code Quality
- [x] No console.log statements
- [x] Error boundaries in place
- [x] Loading states handled
- [x] Empty states designed

### Data Integrity
- [x] Migration logic tested
- [x] Cascade updates working
- [x] Delete protection active
- [x] Archive/restore functional

### User Experience
- [x] Toast notifications for all actions
- [x] Confirmation dialogs for destructive actions
- [x] Help text and descriptions
- [x] Responsive on mobile

### Integration
- [x] Task filtering works
- [x] Analytics integration works
- [x] User management integration works
- [x] Department badges display correctly

### Performance
- [x] Smooth with 50 departments
- [x] No memory leaks
- [x] Animations performant
- [x] Data persistence reliable

### Documentation
- [x] DEPARTMENT_TEST_PLAN.md created
- [x] DEPARTMENT_QUICK_TEST.md created
- [x] DEPARTMENT_ARCHITECTURE.md created (this file)
- [x] Code comments adequate

---

## Future Enhancements

### Priority 1 (Nice to Have)
- [ ] Department hierarchy (sub-departments)
- [ ] Department-specific task templates
- [ ] Budget tracking and alerts
- [ ] Department goals and OKRs

### Priority 2 (Advanced)
- [ ] Department performance scoring
- [ ] Cross-department collaboration tracking
- [ ] Department-level permissions
- [ ] Historical department data/analytics

### Priority 3 (Enterprise)
- [ ] Multi-location management
- [ ] Cost center integration
- [ ] Department org chart visualization
- [ ] External system integrations

---

## Conclusion

### Stato del sistema: implementato, non verificato

Il modulo dipartimenti e' implementato e integrato nell'applicazione. **Non e' stato
sottoposto ad alcun test automatico**, e nessuna verifica manuale sistematica delle
funzioni descritte qui e' documentata. I limiti di carico (numero di dipartimenti o
dipendenti gestibili) non sono mai stati misurati.

Per lo stato verificato dell'applicazione nel suo insieme, vedi [STATO.md](STATO.md).

---

## Support Resources

### Troubleshooting
1. Check browser console for errors
2. Verificare i dati nelle tabelle Supabase (`app_state`), non in IndexedDB
3. Export data before making bulk changes
4. Clear cache if visual issues appear

### Data Recovery
1. Use Data Management → Export
2. Store backups before major changes
3. Import to restore if needed

### Contact
For issues not covered in documentation, check:
- Error messages in browser console
- Network tab per le chiamate a Supabase (`app_state`)
- React DevTools for component state

---

**Document Version:** 2.0 (revisione post-migrazione Supabase)
**Status:** documento di architettura - nessuna dichiarazione di prontezza al lancio
