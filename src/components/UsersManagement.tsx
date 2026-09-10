import { useState, useMemo } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { PencilSimple, Trash, UserPlus, Users, MagnifyingGlass, Briefcase, Buildings, EnvelopeSimple, Phone, CheckCircle, XCircle, UserCircle, MapPin, Star, CheckSquare, Download, X as XIcon, SquaresFour, ListBullets, CaretDown, CaretUp, TrendUp, Calendar, ShieldCheck, Plus, Key } from '@phosphor-icons/react';
import { RoleManagementDialog } from '@/components/RoleManagementDialog';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { Employee } from '@/lib/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Sanitizer } from '@/lib/sanitization';

interface UsersManagementProps {
  employees: Employee[];
  onAddEmployee: (employee: Omit<Employee, 'id'>) => void;
  onEditEmployee: (id: string, updates: Omit<Employee, 'id'>) => void;
  onDeleteEmployee: (id: string) => void;
  taskCounts: Map<string, number>;
  /**
   * L'elenco e' visibile a tutti i membri, le AZIONI no.
   *
   * Senza questi flag i pulsanti di aggiunta, modifica, eliminazione e
   * gestione ruoli comparivano a chiunque potesse vedere la lista. Modifica
   * ed eliminazione toccano app_state, dove is_org_writer ammette anche i
   * 'member': non erano quindi rifiutate dal database, e un membro poteva
   * cancellare i colleghi dall'anagrafica dell'organizzazione.
   * Default a false: chi non passa il permesso non lo ottiene per sbaglio.
   */
  canAddEmployee?: boolean;
  canEditEmployee?: boolean;
  canDeleteEmployee?: boolean;
  canManageRoles?: boolean;
  /** Assegna una nuova password provvisoria; assente = pulsante nascosto. */
  onResetPassword?: (employee: Employee) => void;
}

export function UsersManagement({
  employees,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  taskCounts,
  canAddEmployee = false,
  canEditEmployee = false,
  canDeleteEmployee = false,
  canManageRoles = false,
  onResetPassword,
}: UsersManagementProps) {
  const { t, lingua } = useTranslation();
  const [open, setOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterTeamLead, setFilterTeamLead] = useState<'all' | 'yes' | 'no'>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [bulkDepartmentDialogOpen, setBulkDepartmentDialogOpen] = useState(false);
  const [bulkDepartmentMode, setBulkDepartmentMode] = useState<'add' | 'replace'>('add');
  const [bulkDepartments, setBulkDepartments] = useState<string[]>([]);
  const [bulkDepartmentInput, setBulkDepartmentInput] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'tasks' | 'joined'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [roleManagementDialogOpen, setRoleManagementDialogOpen] = useState(false);
  const [managingRoleEmployee, setManagingRoleEmployee] = useState<Employee | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    avatar: '',
    email: '',
    department: '',
    departments: [] as string[],
    phone: '',
    location: '',
    bio: '',
    skills: '',
    status: 'active' as 'active' | 'inactive',
    teamLead: false,
  });
  const [newDepartmentInput, setNewDepartmentInput] = useState('');

  const departments = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach(emp => {
      if (emp.departments && emp.departments.length > 0) {
        emp.departments.forEach(dept => depts.add(dept));
      } else if (emp.department) {
        depts.add(emp.department);
      }
    });
    return Array.from(depts).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let filtered = [...employees];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(emp => {
        const empDepts = emp.departments && emp.departments.length > 0 
          ? emp.departments 
          : emp.department 
            ? [emp.department] 
            : [];
        
        return emp.name.toLowerCase().includes(query) ||
          emp.role.toLowerCase().includes(query) ||
          emp.email?.toLowerCase().includes(query) ||
          empDepts.some(dept => dept.toLowerCase().includes(query)) ||
          emp.location?.toLowerCase().includes(query) ||
          emp.skills?.some(skill => skill.toLowerCase().includes(query));
      });
    }

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(emp => {
        const empDepts = emp.departments && emp.departments.length > 0 
          ? emp.departments 
          : emp.department 
            ? [emp.department] 
            : [];
        return empDepts.includes(filterDepartment);
      });
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(emp => emp.status === filterStatus);
    }

    if (filterTeamLead !== 'all') {
      filtered = filtered.filter(emp => 
        filterTeamLead === 'yes' ? emp.teamLead === true : !emp.teamLead
      );
    }

    if (activeTab !== 'all') {
      if (activeTab === 'active') {
        filtered = filtered.filter(emp => emp.status === 'active');
      } else if (activeTab === 'inactive') {
        filtered = filtered.filter(emp => emp.status === 'inactive');
      } else if (activeTab === 'leads') {
        filtered = filtered.filter(emp => emp.teamLead === true);
      }
    }

    const sorted = filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'role':
          comparison = a.role.localeCompare(b.role);
          break;
        case 'tasks': {
          const aTasks = taskCounts.get(a.id) || 0;
          const bTasks = taskCounts.get(b.id) || 0;
          comparison = aTasks - bTasks;
          break;
        }
        case 'joined':
          comparison = new Date(a.joinedDate).getTime() - new Date(b.joinedDate).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [employees, searchQuery, filterDepartment, filterStatus, filterTeamLead, activeTab, sortBy, sortOrder, taskCounts]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => e.status === 'active').length;
    const inactive = employees.filter(e => e.status === 'inactive').length;
    const teamLeads = employees.filter(e => e.teamLead === true).length;
    const withTasks = Array.from(taskCounts.values()).filter(count => count > 0).length;
    const totalTasks = Array.from(taskCounts.values()).reduce((sum, count) => sum + count, 0);
    const avgTasksPerUser = total > 0 ? (totalTasks / total).toFixed(1) : '0';
    
    const recentlyJoined = employees.filter(e => {
      const joinedDate = new Date(e.joinedDate);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return joinedDate >= thirtyDaysAgo;
    }).length;
    
    return { total, active, inactive, teamLeads, withTasks, totalTasks, avgTasksPerUser, recentlyJoined };
  }, [employees, taskCounts]);

  const toggleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      role: '',
      avatar: '',
      email: '',
      department: '',
      departments: [],
      phone: '',
      location: '',
      bio: '',
      skills: '',
      status: 'active',
      teamLead: false,
    });
    setNewDepartmentInput('');
  };

  const handleAddEmployee = () => {
    if (!formData.name.trim() || !formData.role.trim()) {
      toast.error(t('Name and role are required'));
      return;
    }

    // L'email non e' piu' facoltativa: e' l'identificativo con cui viene
    // creato l'account. Senza, si tornerebbe a inserire in elenco una persona
    // che non puo' accedere e a cui non si puo' assegnare nulla di reale.
    if (!formData.email.trim()) {
      toast.error(t('Email is required: the account is created from this address'));
      return;
    }

    if (!isValidEmail(formData.email)) {
      toast.error(t('Please enter a valid email address'));
      return;
    }

    const sanitizedName = Sanitizer.userName(formData.name.trim());
    const sanitizedRole = Sanitizer.role(formData.role.trim());
    const sanitizedEmail = formData.email.trim() ? Sanitizer.email(formData.email.trim()) : undefined;
    const sanitizedPhone = formData.phone.trim() ? Sanitizer.text(formData.phone.trim()) : undefined;
    const sanitizedLocation = formData.location.trim() ? Sanitizer.text(formData.location.trim()) : undefined;
    const sanitizedBio = formData.bio.trim() ? Sanitizer.text(formData.bio.trim()) : undefined;
    
    if (!sanitizedName || !sanitizedRole) {
      toast.error(t('Invalid name or role'));
      return;
    }

    const avatarUrl = formData.avatar.trim() 
      ? Sanitizer.url(formData.avatar.trim()) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sanitizedName}`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${sanitizedName}`;
    
    const skillsArray = formData.skills.trim() 
      ? Sanitizer.array(formData.skills.split(',').map(s => s.trim()).filter(s => s))
      : undefined;

    const departmentsArray = formData.departments.length > 0 
      ? Sanitizer.array(formData.departments)
      : undefined;
    const primaryDept = departmentsArray && departmentsArray.length > 0 ? departmentsArray[0] : undefined;

    onAddEmployee({
      name: sanitizedName,
      role: sanitizedRole,
      avatar: avatarUrl,
      email: sanitizedEmail,
      department: primaryDept,
      departments: departmentsArray,
      phone: sanitizedPhone,
      location: sanitizedLocation,
      bio: sanitizedBio,
      skills: skillsArray,
      status: formData.status,
      teamLead: formData.teamLead,
      joinedDate: new Date().toISOString(),
    });

    resetForm();
    setAddDialogOpen(false);
  };

  const handleEditEmployee = () => {
    if (!editingEmployee) return;
    
    if (!formData.name.trim() || !formData.role.trim()) {
      toast.error(t('Name and role are required'));
      return;
    }

    if (formData.email && !isValidEmail(formData.email)) {
      toast.error(t('Please enter a valid email address'));
      return;
    }

    const sanitizedName = Sanitizer.userName(formData.name.trim());
    const sanitizedRole = Sanitizer.role(formData.role.trim());
    const sanitizedEmail = formData.email.trim() ? Sanitizer.email(formData.email.trim()) : undefined;
    const sanitizedPhone = formData.phone.trim() ? Sanitizer.text(formData.phone.trim()) : undefined;
    const sanitizedLocation = formData.location.trim() ? Sanitizer.text(formData.location.trim()) : undefined;
    const sanitizedBio = formData.bio.trim() ? Sanitizer.text(formData.bio.trim()) : undefined;
    
    if (!sanitizedName || !sanitizedRole) {
      toast.error(t('Invalid name or role'));
      return;
    }

    const avatarUrl = formData.avatar.trim() 
      ? Sanitizer.url(formData.avatar.trim()) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sanitizedName}`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${sanitizedName}`;
    
    const skillsArray = formData.skills.trim() 
      ? Sanitizer.array(formData.skills.split(',').map(s => s.trim()).filter(s => s))
      : undefined;

    const departmentsArray = formData.departments.length > 0 
      ? Sanitizer.array(formData.departments)
      : undefined;
    const primaryDept = departmentsArray && departmentsArray.length > 0 ? departmentsArray[0] : undefined;

    onEditEmployee(editingEmployee.id, {
      name: sanitizedName,
      role: sanitizedRole,
      avatar: avatarUrl,
      email: sanitizedEmail,
      department: primaryDept,
      departments: departmentsArray,
      phone: sanitizedPhone,
      location: formData.location.trim() || undefined,
      bio: formData.bio.trim() || undefined,
      skills: skillsArray,
      status: formData.status,
      teamLead: formData.teamLead,
      joinedDate: editingEmployee.joinedDate,
    });

    resetForm();
    setEditingEmployee(null);
    setEditDialogOpen(false);
  };

  const handleDeleteEmployee = () => {
    if (!deletingEmployee) return;
    
    onDeleteEmployee(deletingEmployee.id);
    setDeletingEmployee(null);
    setDeleteDialogOpen(false);
  };

  const handleBulkDelete = () => {
    if (selectedUsers.size === 0) return;
    
    selectedUsers.forEach(id => onDeleteEmployee(id));
    toast.success(t('Users removed: {count}', { count: selectedUsers.size }));
    setSelectedUsers(new Set());
    setBulkMode(false);
    setBulkDeleteDialogOpen(false);
  };

  const handleToggleUserSelect = (userId: string) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const visibleUserIds = filteredEmployees.map(e => e.id);
    setSelectedUsers(new Set(visibleUserIds));
  };

  const handleDeselectAll = () => {
    setSelectedUsers(new Set());
  };

  const handleBulkStatusChange = (status: 'active' | 'inactive') => {
    if (selectedUsers.size === 0) return;
    
    selectedUsers.forEach(id => {
      const employee = employees.find(e => e.id === id);
      if (employee) {
        onEditEmployee(id, { ...employee, status });
      }
    });
    
    toast.success(
      t('{count} users set to {status}', {
        count: selectedUsers.size,
        status: t(status === 'active' ? 'Active' : 'Inactive'),
      })
    );
    setSelectedUsers(new Set());
    setBulkMode(false);
  };

  const handleBulkDepartmentAssignment = () => {
    if (selectedUsers.size === 0 || bulkDepartments.length === 0) return;
    
    selectedUsers.forEach(id => {
      const employee = employees.find(e => e.id === id);
      if (employee) {
        let newDepartments: string[];
        
        if (bulkDepartmentMode === 'replace') {
          newDepartments = [...bulkDepartments];
        } else {
          const existingDepts = employee.departments && employee.departments.length > 0 
            ? employee.departments 
            : employee.department 
              ? [employee.department] 
              : [];
          
          const deptSet = new Set([...existingDepts, ...bulkDepartments]);
          newDepartments = Array.from(deptSet);
        }
        
        const primaryDept = newDepartments.length > 0 ? newDepartments[0] : undefined;
        
        onEditEmployee(id, {
          ...employee,
          departments: newDepartments,
          department: primaryDept,
        });
      }
    });
    
    toast.success(
      bulkDepartmentMode === 'replace'
        ? t('Departments replaced for {users} users: {departments} in total', {
            users: selectedUsers.size,
            departments: bulkDepartments.length,
          })
        : t('Departments added to {users} users: {departments} in total', {
            users: selectedUsers.size,
            departments: bulkDepartments.length,
          })
    );
    setSelectedUsers(new Set());
    setBulkDepartments([]);
    setBulkDepartmentInput('');
    setBulkDepartmentDialogOpen(false);
    setBulkMode(false);
  };

  const handleExportUsers = () => {
    const csv = [
      [t('Name'), t('Role'), t('Department'), t('Email'), t('Phone'), t('Location'), t('Status'), t('Team Lead'), t('Joined Date'), t('Skills')],
      ...filteredEmployees.map(emp => [
        emp.name,
        emp.role,
        emp.department || '',
        emp.email || '',
        emp.phone || '',
        emp.location || '',
        emp.status,
        emp.teamLead ? t('Yes') : t('No'),
        new Date(emp.joinedDate).toLocaleDateString(lingua),
        emp.skills?.join('; ') || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-members-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t('User data exported successfully!'));
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    const empDepartments = employee.departments && employee.departments.length > 0 
      ? employee.departments 
      : employee.department 
        ? [employee.department] 
        : [];
    
    setFormData({
      name: employee.name,
      role: employee.role,
      avatar: employee.avatar,
      email: employee.email || '',
      department: employee.department || '',
      departments: empDepartments,
      phone: employee.phone || '',
      location: employee.location || '',
      bio: employee.bio || '',
      skills: employee.skills?.join(', ') || '',
      status: employee.status,
      teamLead: employee.teamLead || false,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (employee: Employee) => {
    setDeletingEmployee(employee);
    setDeleteDialogOpen(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Era fisso su 'en-US' e restava in inglese anche con l'interfaccia in
    // tedesco o spagnolo. I codici lingua del progetto sono tag BCP-47 validi.
    return date.toLocaleDateString(lingua, { month: 'short', year: 'numeric' });
  };

  const renderEmployeeCard = (employee: Employee) => {
    const taskCount = taskCounts.get(employee.id) || 0;
    const isSelected = selectedUsers.has(employee.id);

    // L'onClick sulla Card era una zona cliccabile senza role ne' tabIndex: da
    // tastiera non si raggiungeva. Invece di trasformare tutta la scheda in un
    // pulsante (che avrebbe annidato dentro di se' altri comandi, cosa che
    // l'ARIA non ammette) la selezione resta alla Checkbox, che e' gia' li', e'
    // gia' un controllo vero e ha gia' il suo fuoco da tastiera.
    return (
      <Card
        key={employee.id}
        className={`p-4 transition-colors ${
          bulkMode ? 'hover:bg-accent/50' : ''
        } ${isSelected ? 'ring-2 ring-primary' : ''}`}
      >
        <div className="flex items-start gap-4">
          {bulkMode && (
            <div className="pt-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggleUserSelect(employee.id)}
                aria-label={t('Select {name}', { name: employee.name })}
              />
            </div>
          )}
          
          <Avatar className="h-12 w-12 border-2 border-background flex-shrink-0">
            <AvatarImage src={employee.avatar} alt={employee.name} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(employee.name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-semibold text-base truncate">{employee.name}</h4>
                  {employee.teamLead && (
                    <Badge variant="outline" className="flex-shrink-0 bg-amber-500/10 text-amber-700 border-amber-300">
                      <Star className="w-3 h-3 mr-1" weight="fill" />{t('Team Lead')}</Badge>
                  )}
                  <Badge variant={employee.status === 'active' ? 'default' : 'secondary'} className="flex-shrink-0">
                    {employee.status === 'active' ? (
                      <CheckCircle className="w-3 h-3 mr-1" weight="fill" />
                    ) : (
                      <XCircle className="w-3 h-3 mr-1" weight="fill" />
                    )}
                    {t(employee.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Briefcase className="w-4 h-4 flex-shrink-0" weight="bold" />
                  <span className="truncate">{employee.role}</span>
                </div>
                {((employee.departments && employee.departments.length > 0) || employee.department) && (
                  <div className="flex items-center gap-2 text-sm mb-1 flex-wrap">
                    {employee.departments && employee.departments.length > 0 ? (
                      employee.departments.map((dept, idx) => (
                        <DepartmentBadge 
                          key={idx} 
                          departmentName={dept}
                          size="sm"
                          variant="default"
                        />
                      ))
                    ) : (
                      <DepartmentBadge 
                        departmentName={employee.department}
                        size="sm"
                        variant="default"
                      />
                    )}
                  </div>
                )}
                {employee.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <MapPin className="w-4 h-4 flex-shrink-0" weight="bold" />
                    <span className="truncate">{employee.location}</span>
                  </div>
                )}
                {employee.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <EnvelopeSimple className="w-4 h-4 flex-shrink-0" weight="bold" />
                    <span className="truncate">{employee.email}</span>
                  </div>
                )}
                {employee.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Phone className="w-4 h-4 flex-shrink-0" weight="bold" />
                    <span>{employee.phone}</span>
                  </div>
                )}
                {employee.skills && employee.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {employee.skills.slice(0, 3).map((skill, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {employee.skills.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{employee.skills.length - 3} {t('more')}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="text-right">
                  <div className="text-lg font-semibold">{taskCount}</div>
                  <div className="text-xs text-muted-foreground">
                    {taskCount === 1 ? t('task') : t('tasks')}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('Joined')} {formatDate(employee.joinedDate)}
                </div>
              </div>
            </div>
            {employee.bio && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {employee.bio}
              </p>
            )}
          </div>

          {!bulkMode && (
            <div className="flex gap-2 flex-shrink-0">
              {/*
                Il dialog di gestione ruoli esisteva ed era montato, ma
                `setRoleManagementDialogOpen(true)` non veniva chiamato da
                nessuna parte: non c'era modo di aprirlo dall'interfaccia.
                Cambiare il ruolo di qualcuno era semplicemente impossibile.
              */}
              {canManageRoles && (
                <Button
                  variant="ghost"
                  size="sm"
                  title={t('Manage Role & Permissions')}
                  aria-label={t('Configure access level and permissions for {name}', { name: employee.name })}
                  onClick={() => {
                    setManagingRoleEmployee(employee);
                    setRoleManagementDialogOpen(true);
                  }}
                >
                  <ShieldCheck className="h-4 w-4" weight="bold" />
                </Button>
              )}
              {canManageRoles && onResetPassword && employee.email && (
                <Button
                  variant="ghost"
                  size="sm"
                  title={t('Assegna una nuova password provvisoria')}
                  aria-label={t("Reset {name}'s password", { name: employee.name })}
                  onClick={() => onResetPassword(employee)}
                >
                  <Key className="h-4 w-4" weight="bold" />
                </Button>
              )}
              {canEditEmployee && (
                <Button
                  variant="ghost"
                  size="sm"
                  title={t('Edit employee details')}
                  aria-label={t('Edit {name}', { name: employee.name })}
                  onClick={() => openEditDialog(employee)}
                >
                  <PencilSimple className="h-4 w-4" weight="bold" />
                </Button>
              )}
              {canDeleteEmployee && (
                <Button
                  variant="ghost"
                  size="sm"
                  title={t('Remove from team')}
                  aria-label={t('Remove {name}', { name: employee.name })}
                  onClick={() => openDeleteDialog(employee)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash className="h-4 w-4" weight="bold" />
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Users className="mr-2 h-5 w-5" weight="bold" />{t('Manage Users')}</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">{t('User Management')}</DialogTitle>
            <DialogDescription>{t('Manage your team members, roles, and departments')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <UserCircle className="w-5 h-5 text-primary" weight="bold" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">{t('Total')}</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle className="w-5 h-5 text-green-600" weight="bold" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{stats.active}</div>
                    <div className="text-xs text-muted-foreground">{t('Active')}</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Star className="w-5 h-5 text-amber-600" weight="fill" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{stats.teamLeads}</div>
                    <div className="text-xs text-muted-foreground">{t('Leads')}</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Briefcase className="w-5 h-5 text-blue-600" weight="bold" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{stats.totalTasks}</div>
                    <div className="text-xs text-muted-foreground">{t('Tasks')}</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <TrendUp className="w-5 h-5 text-purple-600" weight="bold" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{stats.avgTasksPerUser}</div>
                    <div className="text-xs text-muted-foreground">{t('Avg/User')}</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <Calendar className="w-5 h-5 text-cyan-600" weight="bold" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{stats.recentlyJoined}</div>
                    <div className="text-xs text-muted-foreground">{t('New 30d')}</div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" weight="bold" />
                  <Input
                    aria-label={t('Search team members')}
                    placeholder={t('Search by name, role, email, department, skills...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleExportUsers} 
                  disabled={filteredEmployees.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" weight="bold" />{t('Export')}</Button>
                <Button 
                  variant={bulkMode ? "secondary" : "outline"} 
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    setSelectedUsers(new Set());
                  }}
                  className="w-full sm:w-auto"
                >
                  <CheckSquare className="mr-2 h-4 w-4" weight={bulkMode ? "fill" : "regular"} />{t('Bulk')}</Button>
                {canAddEmployee && (
                  <Button
                    onClick={() => setAddDialogOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <UserPlus className="mr-2 h-4 w-4" weight="bold" />{t('Add User')}</Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger className="w-full sm:w-[180px]" aria-label={t('Filter by department')}>
                    <Buildings className="mr-2 h-4 w-4" weight="bold" />
                    <SelectValue placeholder={t('Department')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Departments')}</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterTeamLead} onValueChange={(value) => setFilterTeamLead(value as typeof filterTeamLead)}>
                  <SelectTrigger className="w-full sm:w-[150px]" aria-label={t('Filter by role')}>
                    <Star className="mr-2 h-4 w-4" weight="bold" />
                    <SelectValue placeholder={t('Role')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Members')}</SelectItem>
                    <SelectItem value="yes">{t('Team Leads')}</SelectItem>
                    <SelectItem value="no">{t('Team Members')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2 flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSort('name')}
                    className={sortBy === 'name' ? 'bg-accent' : ''}
                  >
                    {t('Name')}
                    {sortBy === 'name' && (
                      sortOrder === 'asc' ? <CaretUp className="ml-1 h-3 w-3" weight="bold" /> : <CaretDown className="ml-1 h-3 w-3" weight="bold" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSort('role')}
                    className={sortBy === 'role' ? 'bg-accent' : ''}
                  >
                    {t('Role')}
                    {sortBy === 'role' && (
                      sortOrder === 'asc' ? <CaretUp className="ml-1 h-3 w-3" weight="bold" /> : <CaretDown className="ml-1 h-3 w-3" weight="bold" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSort('tasks')}
                    className={sortBy === 'tasks' ? 'bg-accent' : ''}
                  >
                    {t('Tasks')}
                    {sortBy === 'tasks' && (
                      sortOrder === 'asc' ? <CaretUp className="ml-1 h-3 w-3" weight="bold" /> : <CaretDown className="ml-1 h-3 w-3" weight="bold" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleSort('joined')}
                    className={sortBy === 'joined' ? 'bg-accent' : ''}
                  >
                    {t('Joined')}
                    {sortBy === 'joined' && (
                      sortOrder === 'asc' ? <CaretUp className="ml-1 h-3 w-3" weight="bold" /> : <CaretDown className="ml-1 h-3 w-3" weight="bold" />
                    )}
                  </Button>
                </div>
                <div className="flex border rounded-lg ml-auto">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-r-none"
                    aria-label={t('List view')}
                  >
                    <ListBullets className="h-4 w-4" weight={viewMode === 'list' ? 'fill' : 'regular'} />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-l-none"
                    aria-label={t('Grid view')}
                  >
                    <SquaresFour className="h-4 w-4" weight={viewMode === 'grid' ? 'fill' : 'regular'} />
                  </Button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {bulkMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-primary/10 border-2 border-primary rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium">
                        {t('Selected users: {count}', { count: selectedUsers.size })}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleSelectAll}>{t('Select All')}</Button>
                        <Button size="sm" variant="outline" onClick={handleDeselectAll}>{t('Deselect All')}</Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBulkDepartmentDialogOpen(true)}
                        disabled={selectedUsers.size === 0}
                        className="bg-blue-500/10 border-blue-300 hover:bg-blue-500/20"
                      >
                        <Buildings className="mr-1 h-4 w-4" weight="bold" />{t('Departments')}</Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleBulkStatusChange('active')}
                        disabled={selectedUsers.size === 0}
                      >
                        <CheckCircle className="mr-1 h-4 w-4" weight="bold" />{t('Set Active')}</Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleBulkStatusChange('inactive')}
                        disabled={selectedUsers.size === 0}
                      >
                        <XCircle className="mr-1 h-4 w-4" weight="bold" />{t('Set Inactive')}</Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setBulkDeleteDialogOpen(true)}
                        disabled={selectedUsers.size === 0}
                      >
                        <Trash className="mr-1 h-4 w-4" weight="bold" />{t('Delete')}</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">{t('All')} ({employees.length})</TabsTrigger>
                <TabsTrigger value="active">{t('Active')} ({stats.active})</TabsTrigger>
                <TabsTrigger value="inactive">{t('Inactive')} ({stats.inactive})</TabsTrigger>
                <TabsTrigger value="leads">{t('Team Leads')} ({stats.teamLeads})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {filteredEmployees.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" weight="light" />
                    <h3 className="text-lg font-medium mb-2">
                      {employees.length === 0 ? t('No team members yet') : t('No team members found')}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {employees.length === 0
                        ? t('Add your first team member to get started')
                        : t('Try adjusting your search or filters')}
                    </p>
                    {employees.length === 0 && canAddEmployee && (
                      <Button onClick={() => setAddDialogOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" weight="bold" />{t('Add User')}</Button>
                    )}
                  </div>
                ) : (
                  <motion.div 
                    layout
                    className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'grid gap-3'}
                  >
                    {filteredEmployees.map(renderEmployeeCard)}
                  </motion.div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Add Team Member')}</DialogTitle>
            <DialogDescription>{t('Add a new member to your team')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="add-name">{t('Full Name *')}</Label>
              <Input
                id="add-name"
                placeholder={t('John Doe')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-role">{t('Job Title *')}</Label>
              <Input
                id="add-role"
                placeholder={t('Senior Developer')}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="add-departments">{t('Departments')}</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="add-departments"
                    placeholder={t('Enter department name or select existing')}
                    value={newDepartmentInput}
                    onChange={(e) => setNewDepartmentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newDepartmentInput.trim()) {
                        e.preventDefault();
                        const inputDept = newDepartmentInput.trim();
                        const existingDept = departments.find(
                          d => d.toLowerCase() === inputDept.toLowerCase()
                        );
                        const deptToAdd = existingDept || inputDept;
                        
                        if (!formData.departments.some(d => d.toLowerCase() === deptToAdd.toLowerCase())) {
                          setFormData({ ...formData, departments: [...formData.departments, deptToAdd] });
                          setNewDepartmentInput('');
                        } else {
                          toast.error(t('Department already added'));
                        }
                      }
                    }}
                    list="add-departments-list"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const inputDept = newDepartmentInput.trim();
                      if (!inputDept) return;
                      
                      const existingDept = departments.find(
                        d => d.toLowerCase() === inputDept.toLowerCase()
                      );
                      const deptToAdd = existingDept || inputDept;
                      
                      if (!formData.departments.some(d => d.toLowerCase() === deptToAdd.toLowerCase())) {
                        setFormData({ ...formData, departments: [...formData.departments, deptToAdd] });
                        setNewDepartmentInput('');
                      } else {
                        toast.error(t('Department already added'));
                      }
                    }}
                  >
                    {t('Add')}
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">
                    {t('Common departments:')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Product', 'Design', 'Customer Support'].map(dept => (
                      <Button
                        key={dept}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (!formData.departments.some(d => d.toLowerCase() === dept.toLowerCase())) {
                            setFormData({ ...formData, departments: [...formData.departments, dept] });
                          } else {
                            toast.error(t('Department already added'));
                          }
                        }}
                        disabled={formData.departments.some(d => d.toLowerCase() === dept.toLowerCase())}
                        className="text-xs h-7"
                      >
                        <Buildings className="w-3 h-3 mr-1" weight="bold" />
                        {dept}
                      </Button>
                    ))}
                  </div>
                </div>
                {departments.length > 0 && (
                  <>
                    <datalist id="add-departments-list">
                      {departments.map(dept => (
                        <option key={dept} value={dept} />
                      ))}
                    </datalist>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-medium">
                        {t('Quick select existing departments:')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {departments.map(dept => (
                          <Button
                            key={dept}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!formData.departments.some(d => d.toLowerCase() === dept.toLowerCase())) {
                                setFormData({ ...formData, departments: [...formData.departments, dept] });
                              } else {
                                toast.error(t('Department already added'));
                              }
                            }}
                            disabled={formData.departments.some(d => d.toLowerCase() === dept.toLowerCase())}
                            className="text-xs h-7"
                          >
                            <Plus className="w-3 h-3 mr-1" weight="bold" />
                            {dept}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {formData.departments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.departments.map((dept, idx) => (
                      <Badge key={idx} variant="secondary" className="text-sm gap-1">
                        {dept}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              departments: formData.departments.filter((_, i) => i !== idx)
                            });
                          }}
                          aria-label={t('Remove {name}', { name: dept })}
                          className="ml-1 hover:text-destructive"
                        >
                          <XIcon className="w-3 h-3" weight="bold" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-email">{t('Email Address *')}</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-phone">{t('Phone Number')}</Label>
              <Input
                id="add-phone"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-location">{t('Location')}</Label>
              <Input
                id="add-location"
                placeholder={t('San Francisco, CA')}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-status">{t('Status')}</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as 'active' | 'inactive' })}>
                <SelectTrigger id="add-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('Active')}</SelectItem>
                  <SelectItem value="inactive">{t('Inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="add-bio">{t('Bio')}</Label>
              <Textarea
                id="add-bio"
                placeholder={t('Brief description about the team member...')}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="add-skills">{t('Skills (comma-separated)')}</Label>
              <Input
                id="add-skills"
                placeholder={t('React, TypeScript, Node.js')}
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="add-avatar">{t('Avatar URL')}</Label>
              <Input
                id="add-avatar"
                placeholder="https://example.com/avatar.jpg"
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t('Leave blank to auto-generate an avatar')}</p>
            </div>
            <div className="flex items-center space-x-2 sm:col-span-2">
              <Switch
                id="add-team-lead"
                checked={formData.teamLead}
                onCheckedChange={(checked) => setFormData({ ...formData, teamLead: checked })}
              />
              <Label htmlFor="add-team-lead" className="cursor-pointer">{t('Designate as Team Lead')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddDialogOpen(false);
              resetForm();
            }}>{t('Cancel')}</Button>
            <Button onClick={handleAddEmployee}>{t('Add User')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditingEmployee(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Edit Team Member')}</DialogTitle>
            <DialogDescription>{t('Update team member information')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-name">{t('Full Name *')}</Label>
              <Input
                id="edit-name"
                placeholder={t('John Doe')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">{t('Job Title *')}</Label>
              <Input
                id="edit-role"
                placeholder={t('Senior Developer')}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-departments">{t('Departments')}</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="edit-departments"
                    placeholder={t('Enter department name or select existing')}
                    value={newDepartmentInput}
                    onChange={(e) => setNewDepartmentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newDepartmentInput.trim()) {
                        e.preventDefault();
                        const inputDept = newDepartmentInput.trim();
                        const existingDept = departments.find(
                          d => d.toLowerCase() === inputDept.toLowerCase()
                        );
                        const deptToAdd = existingDept || inputDept;
                        
                        if (!formData.departments.some(d => d.toLowerCase() === deptToAdd.toLowerCase())) {
                          setFormData({ ...formData, departments: [...formData.departments, deptToAdd] });
                          setNewDepartmentInput('');
                        } else {
                          toast.error(t('Department already added'));
                        }
                      }
                    }}
                    list="edit-departments-list"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const inputDept = newDepartmentInput.trim();
                      if (!inputDept) return;
                      
                      const existingDept = departments.find(
                        d => d.toLowerCase() === inputDept.toLowerCase()
                      );
                      const deptToAdd = existingDept || inputDept;
                      
                      if (!formData.departments.some(d => d.toLowerCase() === deptToAdd.toLowerCase())) {
                        setFormData({ ...formData, departments: [...formData.departments, deptToAdd] });
                        setNewDepartmentInput('');
                      } else {
                        toast.error(t('Department already added'));
                      }
                    }}
                  >
                    {t('Add')}
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">
                    {t('Common departments:')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Product', 'Design', 'Customer Support'].map(dept => (
                      <Button
                        key={dept}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (!formData.departments.some(d => d.toLowerCase() === dept.toLowerCase())) {
                            setFormData({ ...formData, departments: [...formData.departments, dept] });
                          } else {
                            toast.error(t('Department already added'));
                          }
                        }}
                        disabled={formData.departments.some(d => d.toLowerCase() === dept.toLowerCase())}
                        className="text-xs h-7"
                      >
                        <Buildings className="w-3 h-3 mr-1" weight="bold" />
                        {dept}
                      </Button>
                    ))}
                  </div>
                </div>
                {departments.length > 0 && (
                  <>
                    <datalist id="edit-departments-list">
                      {departments.map(dept => (
                        <option key={dept} value={dept} />
                      ))}
                    </datalist>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-medium">
                        {t('Quick select existing departments:')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {departments.map(dept => (
                          <Button
                            key={dept}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!formData.departments.some(d => d.toLowerCase() === dept.toLowerCase())) {
                                setFormData({ ...formData, departments: [...formData.departments, dept] });
                              } else {
                                toast.error(t('Department already added'));
                              }
                            }}
                            disabled={formData.departments.some(d => d.toLowerCase() === dept.toLowerCase())}
                            className="text-xs h-7"
                          >
                            <Plus className="w-3 h-3 mr-1" weight="bold" />
                            {dept}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {formData.departments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.departments.map((dept, idx) => (
                      <Badge key={idx} variant="secondary" className="text-sm gap-1">
                        {dept}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              departments: formData.departments.filter((_, i) => i !== idx)
                            });
                          }}
                          aria-label={t('Remove {name}', { name: dept })}
                          className="ml-1 hover:text-destructive"
                        >
                          <XIcon className="w-3 h-3" weight="bold" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">{t('Email Address')}</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">{t('Phone Number')}</Label>
              <Input
                id="edit-phone"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">{t('Location')}</Label>
              <Input
                id="edit-location"
                placeholder={t('San Francisco, CA')}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">{t('Status')}</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as 'active' | 'inactive' })}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('Active')}</SelectItem>
                  <SelectItem value="inactive">{t('Inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-bio">{t('Bio')}</Label>
              <Textarea
                id="edit-bio"
                placeholder={t('Brief description about the team member...')}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-skills">{t('Skills (comma-separated)')}</Label>
              <Input
                id="edit-skills"
                placeholder={t('React, TypeScript, Node.js')}
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-avatar">{t('Avatar URL')}</Label>
              <Input
                id="edit-avatar"
                placeholder="https://example.com/avatar.jpg"
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2 sm:col-span-2">
              <Switch
                id="edit-team-lead"
                checked={formData.teamLead}
                onCheckedChange={(checked) => setFormData({ ...formData, teamLead: checked })}
              />
              <Label htmlFor="edit-team-lead" className="cursor-pointer">{t('Designate as Team Lead')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false);
              setEditingEmployee(null);
              resetForm();
            }}>{t('Cancel')}</Button>
            <Button onClick={handleEditEmployee}>{t('Save Changes')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Team Member?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to remove {name} from your team?', { name: deletingEmployee?.name ?? '' })}
              {taskCounts.get(deletingEmployee?.id || '') ? (
                <span className="block mt-2 text-amber-600 dark:text-amber-500 font-medium">
                  ⚠️ {t('This user has {count} assigned tasks. Those tasks will become unassigned.', { count: taskCounts.get(deletingEmployee?.id || '') ?? 0 })}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setDeletingEmployee(null);
            }}>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmployee} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('Delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete {count} users?', { count: selectedUsers.size })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to remove {count} team members from your team?', { count: selectedUsers.size })}{' '}
              {t('This action cannot be undone and any assigned tasks will become unassigned.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('Delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={bulkDepartmentDialogOpen} onOpenChange={(open) => {
        setBulkDepartmentDialogOpen(open);
        if (!open) {
          setBulkDepartments([]);
          setBulkDepartmentInput('');
          setBulkDepartmentMode('add');
        }
      }}>
        {/* max-h + overflow: DialogContent e' `fixed` e centrato, quindi senza
            tetto d'altezza su uno schermo basso il contenuto esce sopra e sotto,
            la testata e i pulsanti in fondo diventano irraggiungibili e la pagina
            non scorre perche' l'elemento e' fuori dal flusso. */}
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Assign departments to {count} users', { count: selectedUsers.size })}</DialogTitle>
            <DialogDescription>{t('Choose departments to assign to the selected team members')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-assignment-mode">{t('Assignment Mode')}</Label>
              <Select 
                value={bulkDepartmentMode} 
                onValueChange={(value) => setBulkDepartmentMode(value as 'add' | 'replace')}
              >
                <SelectTrigger id="bulk-assignment-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">{t('Add to existing departments')}</SelectItem>
                  <SelectItem value="replace">{t('Replace all departments')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {bulkDepartmentMode === 'add'
                  ? t("Selected departments will be added to each user's current departments")
                  : t('Selected departments will replace all current departments for each user')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-departments-input">{t('Departments')}</Label>
              <div className="flex gap-2">
                <Input
                  id="bulk-departments-input"
                  placeholder={t('Enter department name or select existing')}
                  value={bulkDepartmentInput}
                  onChange={(e) => setBulkDepartmentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && bulkDepartmentInput.trim()) {
                      e.preventDefault();
                      const inputDept = bulkDepartmentInput.trim();
                      const existingDept = departments.find(
                        d => d.toLowerCase() === inputDept.toLowerCase()
                      );
                      const deptToAdd = existingDept || inputDept;
                      
                      if (!bulkDepartments.some(d => d.toLowerCase() === deptToAdd.toLowerCase())) {
                        setBulkDepartments([...bulkDepartments, deptToAdd]);
                        setBulkDepartmentInput('');
                      } else {
                        toast.error(t('Department already added'));
                      }
                    }
                  }}
                  list="bulk-departments-list"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const inputDept = bulkDepartmentInput.trim();
                    if (!inputDept) return;
                    
                    const existingDept = departments.find(
                      d => d.toLowerCase() === inputDept.toLowerCase()
                    );
                    const deptToAdd = existingDept || inputDept;
                    
                    if (!bulkDepartments.some(d => d.toLowerCase() === deptToAdd.toLowerCase())) {
                      setBulkDepartments([...bulkDepartments, deptToAdd]);
                      setBulkDepartmentInput('');
                    } else {
                      toast.error(t('Department already added'));
                    }
                  }}
                >
                  {t('Add')}
                </Button>
              </div>
              {departments.length > 0 && (
                <>
                  <datalist id="bulk-departments-list">
                    {departments.map(dept => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                  <div className="text-xs text-muted-foreground">
                    {t('Existing departments: {list}', { list: departments.join(', ') })}
                  </div>
                </>
              )}
              {bulkDepartments.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-3 p-3 bg-muted rounded-lg">
                  {bulkDepartments.map((dept, idx) => (
                    <Badge key={idx} variant="secondary" className="text-sm gap-1">
                      {dept}
                      <button
                        type="button"
                        onClick={() => {
                          setBulkDepartments(bulkDepartments.filter((_, i) => i !== idx));
                        }}
                        aria-label={t('Remove {name}', { name: dept })}
                        className="ml-1 hover:text-destructive"
                      >
                        <XIcon className="w-3 h-3" weight="bold" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
                  <Buildings className="w-12 h-12 mx-auto mb-2 text-muted-foreground" weight="light" />
                  <p className="text-sm text-muted-foreground">{t('No departments selected. Add departments above.')}</p>
                </div>
              )}
            </div>

            <div className="bg-blue-500/10 border border-blue-300 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Buildings className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" weight="bold" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">
                    {t('Users affected: {count}', { count: selectedUsers.size })}
                  </p>
                  <p className="text-blue-700">
                    {bulkDepartments.length === 0
                      ? t('Select at least one department to continue')
                      : bulkDepartmentMode === 'add'
                        ? t('{count} departments will be added to the existing ones', { count: bulkDepartments.length })
                        : t('All existing departments will be replaced with {count} new ones', { count: bulkDepartments.length })
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setBulkDepartmentDialogOpen(false);
              setBulkDepartments([]);
              setBulkDepartmentInput('');
              setBulkDepartmentMode('add');
            }}>{t('Cancel')}</Button>
            <Button 
              onClick={handleBulkDepartmentAssignment}
              disabled={bulkDepartments.length === 0}
            >
              <Buildings className="mr-2 h-4 w-4" weight="bold" />{t('Assign Departments')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {managingRoleEmployee && (
        <RoleManagementDialog
          open={roleManagementDialogOpen}
          onOpenChange={setRoleManagementDialogOpen}
          employee={managingRoleEmployee}
          onUpdateEmployee={(id, updates) => {
            const employee = employees.find(e => e.id === id);
            if (employee) {
              onEditEmployee(id, { ...employee, ...updates });
            }
          }}
          canManageRoles={canManageRoles}
        />
      )}
    </>
  );
}
