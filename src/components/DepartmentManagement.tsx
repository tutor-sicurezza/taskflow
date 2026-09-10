import { useState, useMemo } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { useKV } from '@/hooks/useKV';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Buildings, Plus, PencilSimple, Trash, Users, ListChecks, ChartBar, X as XIcon, UserCircle, MapPin, CheckCircle, Warning, Star, Code, Briefcase, PaintBrush, Sparkle } from '@phosphor-icons/react';
import { generateColorFromName } from '@/lib/departments';
import { Employee } from '@/lib/types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { newId } from '@/lib/utils';

export interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  leadId?: string;
  location?: string;
  budget?: number;
  createdAt: string;
  status: 'active' | 'archived';
}

interface DepartmentManagementProps {
  employees: Employee[];
  onEmployeeUpdate: (id: string, updates: Omit<Employee, 'id'>) => void;
}

const DEPARTMENT_COLORS = [
  { name: 'Blue', value: 'oklch(0.55 0.18 240)' },
  { name: 'Green', value: 'oklch(0.60 0.16 145)' },
  { name: 'Purple', value: 'oklch(0.55 0.18 280)' },
  { name: 'Orange', value: 'oklch(0.65 0.18 45)' },
  { name: 'Red', value: 'oklch(0.60 0.20 25)' },
  { name: 'Teal', value: 'oklch(0.58 0.14 195)' },
  { name: 'Pink', value: 'oklch(0.65 0.18 350)' },
  { name: 'Yellow', value: 'oklch(0.75 0.16 85)' },
  { name: 'Indigo', value: 'oklch(0.50 0.18 265)' },
  { name: 'Cyan', value: 'oklch(0.60 0.14 210)' },
];

interface DepartmentTemplate {
  id: string;
  category: 'tech' | 'business' | 'creative';
  categoryLabel: string;
  icon: typeof Code;
  departments: Array<{
    name: string;
    description: string;
    suggestedColor: string;
  }>;
}

const DEPARTMENT_TEMPLATES: DepartmentTemplate[] = [
  {
    id: 'tech',
    category: 'tech',
    categoryLabel: 'Technology',
    icon: Code,
    departments: [
      {
        name: 'Engineering',
        description: 'Software development and technical implementation',
        suggestedColor: 'oklch(0.55 0.18 240)',
      },
      {
        name: 'DevOps',
        description: 'Infrastructure, deployment, and system operations',
        suggestedColor: 'oklch(0.50 0.18 265)',
      },
      {
        name: 'QA & Testing',
        description: 'Quality assurance and software testing',
        suggestedColor: 'oklch(0.58 0.14 195)',
      },
      {
        name: 'IT Support',
        description: 'Technical support and system maintenance',
        suggestedColor: 'oklch(0.60 0.14 210)',
      },
      {
        name: 'Data Science',
        description: 'Data analysis, machine learning, and analytics',
        suggestedColor: 'oklch(0.55 0.18 280)',
      },
      {
        name: 'Security',
        description: 'Information security and cybersecurity operations',
        suggestedColor: 'oklch(0.60 0.20 25)',
      },
    ],
  },
  {
    id: 'business',
    category: 'business',
    categoryLabel: 'Business',
    icon: Briefcase,
    departments: [
      {
        name: 'Sales',
        description: 'Client acquisition and revenue generation',
        suggestedColor: 'oklch(0.60 0.16 145)',
      },
      {
        name: 'Marketing',
        description: 'Brand strategy, campaigns, and growth marketing',
        suggestedColor: 'oklch(0.65 0.18 45)',
      },
      {
        name: 'Customer Success',
        description: 'Client relationships and support services',
        suggestedColor: 'oklch(0.58 0.14 195)',
      },
      {
        name: 'Finance',
        description: 'Financial planning, accounting, and reporting',
        suggestedColor: 'oklch(0.50 0.18 265)',
      },
      {
        name: 'Human Resources',
        description: 'Talent management and employee relations',
        suggestedColor: 'oklch(0.65 0.18 350)',
      },
      {
        name: 'Operations',
        description: 'Business operations and process management',
        suggestedColor: 'oklch(0.55 0.18 280)',
      },
      {
        name: 'Legal',
        description: 'Legal compliance and contract management',
        suggestedColor: 'oklch(0.55 0.18 240)',
      },
    ],
  },
  {
    id: 'creative',
    category: 'creative',
    categoryLabel: 'Creative',
    icon: PaintBrush,
    departments: [
      {
        name: 'Design',
        description: 'UI/UX design and visual design work',
        suggestedColor: 'oklch(0.65 0.18 350)',
      },
      {
        name: 'Content',
        description: 'Content creation, writing, and editorial',
        suggestedColor: 'oklch(0.65 0.18 45)',
      },
      {
        name: 'Video Production',
        description: 'Video creation, editing, and multimedia',
        suggestedColor: 'oklch(0.60 0.20 25)',
      },
      {
        name: 'Brand & Creative',
        description: 'Brand identity and creative direction',
        suggestedColor: 'oklch(0.55 0.18 280)',
      },
      {
        name: 'Social Media',
        description: 'Social media management and community engagement',
        suggestedColor: 'oklch(0.60 0.14 210)',
      },
      {
        name: 'Product Design',
        description: 'Product strategy and user experience design',
        suggestedColor: 'oklch(0.55 0.18 240)',
      },
    ],
  },
];

export function DepartmentManagement({ employees, onEmployeeUpdate }: DepartmentManagementProps) {
  const { t } = useTranslation();
  const [departments, setDepartments] = useKV<Department[]>('departments', []);
  const [open, setOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [viewingDepartment, setViewingDepartment] = useState<Department | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: DEPARTMENT_COLORS[0].value,
    leadId: '',
    location: '',
    budget: '',
  });

  const departmentStats = useMemo(() => {
    return (departments || []).map(dept => {
      const deptEmployees = (employees || []).filter(emp => {
        const empDepts = emp.departments && emp.departments.length > 0 
          ? emp.departments 
          : emp.department 
            ? [emp.department] 
            : [];
        return empDepts.includes(dept.name);
      });

      const activeEmployees = deptEmployees.filter(e => e.status === 'active').length;
      const lead = dept.leadId ? employees.find(e => e.id === dept.leadId) : null;

      return {
        department: dept,
        totalEmployees: deptEmployees.length,
        activeEmployees,
        lead,
      };
    });
  }, [departments, employees]);

  const activeDepartments = useMemo(() => {
    return (departments || []).filter(d => d.status === 'active');
  }, [departments]);

  const archivedDepartments = useMemo(() => {
    return (departments || []).filter(d => d.status === 'archived');
  }, [departments]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: DEPARTMENT_COLORS[0].value,
      leadId: '',
      location: '',
      budget: '',
    });
  };

  const handleAddDepartment = () => {
    if (!formData.name.trim()) {
      toast.error(t('Department name is required'));
      return;
    }

    const existingDept = (departments || []).find(
      d => d.name.toLowerCase() === formData.name.trim().toLowerCase() && d.status === 'active'
    );

    if (existingDept) {
      toast.error(t('A department with this name already exists'));
      return;
    }

    const existingColors = (departments || []).map(d => d.color);
    const autoColor = formData.color === 'auto' 
      ? generateColorFromName(formData.name.trim(), existingColors)
      : formData.color;

    const newDepartment: Department = {
      id: newId(),
      name: formData.name.trim(),
      description: formData.description.trim(),
      color: autoColor,
      leadId: formData.leadId || undefined,
      location: formData.location.trim() || undefined,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    setDepartments((currentDepartments) => [...(currentDepartments || []), newDepartment]);
    toast.success(`Department "${newDepartment.name}" created successfully!`);
    resetForm();
    setAddDialogOpen(false);
  };

  const openEditDialog = (dept: Department) => {
    setEditingDepartment(dept);
    setFormData({
      name: dept.name,
      description: dept.description,
      color: dept.color,
      leadId: dept.leadId || '',
      location: dept.location || '',
      budget: dept.budget?.toString() || '',
    });
    setEditDialogOpen(true);
  };

  const handleEditDepartment = () => {
    if (!editingDepartment) return;

    if (!formData.name.trim()) {
      toast.error(t('Department name is required'));
      return;
    }

    const existingDept = (departments || []).find(
      d => d.name.toLowerCase() === formData.name.trim().toLowerCase() && 
           d.id !== editingDepartment.id && 
           d.status === 'active'
    );

    if (existingDept) {
      toast.error(t('A department with this name already exists'));
      return;
    }

    const oldName = editingDepartment.name;
    const newName = formData.name.trim();

    setDepartments((currentDepartments) =>
      (currentDepartments || []).map(dept =>
        dept.id === editingDepartment.id
          ? {
              ...dept,
              name: newName,
              description: formData.description.trim(),
              color: formData.color,
              leadId: formData.leadId || undefined,
              location: formData.location.trim() || undefined,
              budget: formData.budget ? parseFloat(formData.budget) : undefined,
            }
          : dept
      )
    );

    if (oldName !== newName) {
      (employees || []).forEach(emp => {
        const empDepts = emp.departments && emp.departments.length > 0 
          ? emp.departments 
          : emp.department 
            ? [emp.department] 
            : [];
        
        if (empDepts.includes(oldName)) {
          const updatedDepts = empDepts.map(d => d === oldName ? newName : d);
          onEmployeeUpdate(emp.id, {
            ...emp,
            departments: updatedDepts,
            department: updatedDepts[0],
          });
        }
      });
    }

    toast.success(`Department "${newName}" updated successfully!`);
    resetForm();
    setEditingDepartment(null);
    setEditDialogOpen(false);
  };

  const openDeleteDialog = (dept: Department) => {
    setDeletingDepartment(dept);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDepartment = () => {
    if (!deletingDepartment) return;

    const deptEmployees = (employees || []).filter(emp => {
      const empDepts = emp.departments && emp.departments.length > 0 
        ? emp.departments 
        : emp.department 
          ? [emp.department] 
          : [];
      return empDepts.includes(deletingDepartment.name);
    });

    if (deptEmployees.length > 0) {
      toast.error(`Cannot delete department with ${deptEmployees.length} assigned employee${deptEmployees.length > 1 ? 's' : ''}`);
      setDeleteDialogOpen(false);
      setDeletingDepartment(null);
      return;
    }

    setDepartments((currentDepartments) =>
      (currentDepartments || []).filter(dept => dept.id !== deletingDepartment.id)
    );

    toast.success(`Department "${deletingDepartment.name}" deleted successfully`);
    setDeletingDepartment(null);
    setDeleteDialogOpen(false);
  };

  const handleArchiveDepartment = (deptId: string) => {
    const dept = (departments || []).find(d => d.id === deptId);
    if (!dept) return;

    const deptEmployees = (employees || []).filter(emp => {
      const empDepts = emp.departments && emp.departments.length > 0 
        ? emp.departments 
        : emp.department 
          ? [emp.department] 
          : [];
      return empDepts.includes(dept.name);
    });

    if (deptEmployees.length > 0) {
      toast.error(`Cannot archive department with ${deptEmployees.length} assigned employee${deptEmployees.length > 1 ? 's' : ''}`);
      return;
    }

    setDepartments((currentDepartments) =>
      (currentDepartments || []).map(d =>
        d.id === deptId ? { ...d, status: 'archived' as const } : d
      )
    );

    toast.success(`Department "${dept.name}" archived`);
  };

  const handleRestoreDepartment = (deptId: string) => {
    const dept = (departments || []).find(d => d.id === deptId);
    if (!dept) return;

    setDepartments((currentDepartments) =>
      (currentDepartments || []).map(d =>
        d.id === deptId ? { ...d, status: 'active' as const } : d
      )
    );

    toast.success(`Department "${dept.name}" restored`);
  };

  const openViewDetails = (dept: Department) => {
    setViewingDepartment(dept);
    setViewDetailsOpen(true);
  };

  const handleApplyTemplate = (templateDept: { name: string; description: string; suggestedColor: string }) => {
    const existingDept = (departments || []).find(
      d => d.name.toLowerCase() === templateDept.name.toLowerCase() && d.status === 'active'
    );

    if (existingDept) {
      toast.error(`Department "${templateDept.name}" already exists`);
      return;
    }

    setFormData({
      name: templateDept.name,
      description: templateDept.description,
      color: templateDept.suggestedColor,
      leadId: '',
      location: '',
      budget: '',
    });

    setTemplatesDialogOpen(false);
    setAddDialogOpen(true);
    toast.success(`Template applied! Review and create "${templateDept.name}"`);
  };

  const handleBulkCreateFromTemplate = (templateId: string) => {
    const template = DEPARTMENT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    let createdCount = 0;
    const existingColors = (departments || []).map(d => d.color);

    template.departments.forEach((templateDept) => {
      const existingDept = (departments || []).find(
        d => d.name.toLowerCase() === templateDept.name.toLowerCase() && d.status === 'active'
      );

      if (!existingDept) {
        const newDepartment: Department = {
          id: newId(),
          name: templateDept.name,
          description: templateDept.description,
          color: templateDept.suggestedColor,
          createdAt: new Date().toISOString(),
          status: 'active',
        };

        setDepartments((currentDepartments) => [...(currentDepartments || []), newDepartment]);
        createdCount++;
      }
    });

    if (createdCount > 0) {
      toast.success(`Created ${createdCount} ${template.categoryLabel.toLowerCase()} department${createdCount > 1 ? 's' : ''}!`);
      setTemplatesDialogOpen(false);
      setSelectedTemplate(null);
    } else {
      toast.info(`All ${template.categoryLabel.toLowerCase()} departments already exist`);
    }
  };

  const getDepartmentEmployees = (deptName: string) => {
    return (employees || []).filter(emp => {
      const empDepts = emp.departments && emp.departments.length > 0 
        ? emp.departments 
        : emp.department 
          ? [emp.department] 
          : [];
      return empDepts.includes(deptName);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Buildings className="mr-2 h-5 w-5" weight="fill" />{t('Departments')}</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Buildings className="h-6 w-6" weight="fill" />{t('Department Management')}</DialogTitle>
            <DialogDescription>{t('Create and manage departments, assign leads, and track team organization')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-3 gap-4 flex-1">
                <div className="bg-card rounded-lg p-3 border">
                  <div className="text-2xl font-semibold mb-1">{activeDepartments.length}</div>
                  <div className="text-sm text-muted-foreground">{t('Active Departments')}</div>
                </div>
                <div className="bg-card rounded-lg p-3 border">
                  <div className="text-2xl font-semibold mb-1 text-primary">
                    {departmentStats.reduce((sum, stat) => sum + stat.activeEmployees, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('Total Employees')}</div>
                </div>
                <div className="bg-card rounded-lg p-3 border">
                  <div className="text-2xl font-semibold mb-1 text-accent">
                    {departmentStats.filter(s => s.lead).length}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('With Leads')}</div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button variant="outline" onClick={() => setTemplatesDialogOpen(true)}>
                  <Sparkle className="mr-2 h-5 w-5" weight="fill" />{t('Templates')}</Button>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-5 w-5" weight="bold" />{t('Add Department')}</Button>
              </div>
            </div>

            <Separator />

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {activeDepartments.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" weight="fill" />{t('Active Departments')}</h3>
                    <div className="grid gap-4">
                      {departmentStats
                        .filter(stat => stat.department.status === 'active')
                        .map(({ department, totalEmployees, activeEmployees, lead }) => (
                          <motion.div
                            key={department.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                          >
                            <Card className="p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div
                                      className="w-4 h-4 rounded-full"
                                      style={{ backgroundColor: department.color }}
                                    />
                                    <h4 className="text-lg font-semibold">{department.name}</h4>
                                    <Badge variant="secondary" className="ml-auto">
                                      <Users className="mr-1 h-3 w-3" />
                                      {activeEmployees} active
                                    </Badge>
                                  </div>
                                  
                                  {department.description && (
                                    <p className="text-sm text-muted-foreground mb-3">
                                      {department.description}
                                    </p>
                                  )}

                                  <div className="flex flex-wrap gap-4 text-sm">
                                    {lead && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <UserCircle className="h-4 w-4" />
                                        <span>Lead: {lead.name}</span>
                                      </div>
                                    )}
                                    {department.location && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <MapPin className="h-4 w-4" />
                                        <span>{department.location}</span>
                                      </div>
                                    )}
                                    {department.budget && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <ChartBar className="h-4 w-4" />
                                        <span>Budget: ${department.budget.toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openViewDetails(department)}
                                  >
                                    <ListChecks className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(department)}
                                  >
                                    <PencilSimple className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleArchiveDepartment(department.id)}
                                  >
                                    <Warning className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDeleteDialog(department)}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                        ))}
                    </div>
                  </div>
                )}

                {archivedDepartments.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Warning className="h-5 w-5 text-muted-foreground" weight="fill" />{t('Archived Departments')}</h3>
                    <div className="grid gap-4">
                      {departmentStats
                        .filter(stat => stat.department.status === 'archived')
                        .map(({ department }) => (
                          <Card key={department.id} className="p-4 opacity-60">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: department.color }}
                                />
                                <h4 className="font-semibold">{department.name}</h4>
                                <Badge variant="outline">{t('Archived')}</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRestoreDepartment(department.id)}
                                >{t('Restore')}</Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDeleteDialog(department)}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                    </div>
                  </div>
                )}

                {activeDepartments.length === 0 && archivedDepartments.length === 0 && (
                  <div className="text-center py-12">
                    <Buildings className="w-16 h-16 mx-auto mb-4 text-muted-foreground" weight="light" />
                    <h3 className="text-lg font-medium mb-2">{t('No departments yet')}</h3>
                    <p className="text-muted-foreground mb-4">{t('Create your first department to start organizing your team')}</p>
                    <Button onClick={() => setAddDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />{t('Add Department')}</Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        {/* max-h + overflow: DialogContent e' `fixed` e centrato, quindi senza
            tetto d'altezza su uno schermo basso il contenuto esce sopra e sotto,
            la testata e i pulsanti in fondo diventano irraggiungibili e la pagina
            non scorre perche' l'elemento e' fuori dal flusso. */}
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Add New Department')}</DialogTitle>
            <DialogDescription>{t('Create a new department to organize your team structure')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dept-name">Department Name *</Label>
              <Input
                id="dept-name"
                placeholder={t('Engineering, Sales, Marketing...')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dept-description">{t('Description')}</Label>
              <Textarea
                id="dept-description"
                placeholder={t('Brief description of this department...')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="dept-color">{t('Department Color')}</Label>
              <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                <SelectTrigger id="dept-color">
                  <div className="flex items-center gap-2">
                    {formData.color === 'auto' ? (
                      <>
                        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                        <span>{t('Auto-assign color')}</span>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: formData.color }} />
                        <SelectValue />
                      </>
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />{t('Auto-assign color')}</div>
                  </SelectItem>
                  <Separator className="my-1" />
                  {DEPARTMENT_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color.value }} />
                        {color.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.color === 'auto' && formData.name.trim() && (
                <div className="mt-2 p-2 bg-muted rounded-md flex items-center gap-2 text-sm">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: generateColorFromName(formData.name.trim(), (departments || []).map(d => d.color)) }}
                  />
                  <span className="text-muted-foreground">Preview: This color will be auto-assigned based on the department name</span>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="dept-lead">{t('Department Lead')}</Label>
              <Select value={formData.leadId || 'none'} onValueChange={(value) => setFormData({ ...formData, leadId: value === 'none' ? '' : value })}>
                <SelectTrigger id="dept-lead">
                  <SelectValue placeholder={t('Select a team lead (optional)')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('None')}</SelectItem>
                  {(employees || [])
                    .filter(e => e.status === 'active')
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} - {emp.role}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dept-location">{t('Location')}</Label>
                <Input
                  id="dept-location"
                  placeholder={t('New York, Remote...')}
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dept-budget">{t('Annual Budget')}</Label>
                <Input
                  id="dept-budget"
                  type="number"
                  placeholder="100000"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddDialogOpen(false);
              resetForm();
            }}>{t('Cancel')}</Button>
            <Button onClick={handleAddDepartment}>{t('Create Department')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        {/* max-h + overflow: DialogContent e' `fixed` e centrato, quindi senza
            tetto d'altezza su uno schermo basso il contenuto esce sopra e sotto,
            la testata e i pulsanti in fondo diventano irraggiungibili e la pagina
            non scorre perche' l'elemento e' fuori dal flusso. */}
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Edit Department')}</DialogTitle>
            <DialogDescription>{t('Update department information and settings')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-dept-name">Department Name *</Label>
              <Input
                id="edit-dept-name"
                placeholder={t('Engineering, Sales, Marketing...')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-dept-description">{t('Description')}</Label>
              <Textarea
                id="edit-dept-description"
                placeholder={t('Brief description of this department...')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-dept-color">{t('Department Color')}</Label>
              <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                <SelectTrigger id="edit-dept-color">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: formData.color }} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color.value }} />
                        {color.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-dept-lead">{t('Department Lead')}</Label>
              <Select value={formData.leadId || 'none'} onValueChange={(value) => setFormData({ ...formData, leadId: value === 'none' ? '' : value })}>
                <SelectTrigger id="edit-dept-lead">
                  <SelectValue placeholder={t('Select a team lead (optional)')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('None')}</SelectItem>
                  {(employees || [])
                    .filter(e => e.status === 'active')
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} - {emp.role}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-dept-location">{t('Location')}</Label>
                <Input
                  id="edit-dept-location"
                  placeholder={t('New York, Remote...')}
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-dept-budget">{t('Annual Budget')}</Label>
                <Input
                  id="edit-dept-budget"
                  type="number"
                  placeholder="100000"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false);
              setEditingDepartment(null);
              resetForm();
            }}>{t('Cancel')}</Button>
            <Button onClick={handleEditDepartment}>{t('Save Changes')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Department?')}</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingDepartment?.name}". This action cannot be undone.
              {deletingDepartment && getDepartmentEmployees(deletingDepartment.name).length > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: This department has {getDepartmentEmployees(deletingDepartment.name).length} assigned employee(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setDeletingDepartment(null);
            }}>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDepartment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >{t('Delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        {/* max-h + overflow: DialogContent e' `fixed` e centrato, quindi senza
            tetto d'altezza su uno schermo basso il contenuto esce sopra e sotto,
            la testata e i pulsanti in fondo diventano irraggiungibili e la pagina
            non scorre perche' l'elemento e' fuori dal flusso. */}
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingDepartment && (
                <>
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: viewingDepartment.color }}
                  />
                  {viewingDepartment.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {viewingDepartment?.description || 'Department details and team members'}
            </DialogDescription>
          </DialogHeader>

          {viewingDepartment && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card rounded-lg p-4 border">
                  <div className="text-2xl font-semibold mb-1">
                    {getDepartmentEmployees(viewingDepartment.name).length}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('Total Members')}</div>
                </div>
                <div className="bg-card rounded-lg p-4 border">
                  <div className="text-2xl font-semibold mb-1 text-green-600">
                    {getDepartmentEmployees(viewingDepartment.name).filter(e => e.status === 'active').length}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('Active Members')}</div>
                </div>
              </div>

              {(viewingDepartment.leadId || viewingDepartment.location || viewingDepartment.budget) && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">{t('Department Information')}</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {viewingDepartment.leadId && (
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4" />
                        <span>Lead: {employees.find(e => e.id === viewingDepartment.leadId)?.name || 'Unknown'}</span>
                      </div>
                    )}
                    {viewingDepartment.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{viewingDepartment.location}</span>
                      </div>
                    )}
                    {viewingDepartment.budget && (
                      <div className="flex items-center gap-2">
                        <ChartBar className="h-4 w-4" />
                        <span>Budget: ${viewingDepartment.budget.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">{t('Team Members')}</h4>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {getDepartmentEmployees(viewingDepartment.name).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">{t('No employees assigned to this department')}</div>
                    ) : (
                      getDepartmentEmployees(viewingDepartment.name).map((emp) => (
                        <Card key={emp.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <img
                                src={emp.avatar}
                                alt={emp.name}
                                className="w-10 h-10 rounded-full"
                              />
                              <div>
                                <div className="font-medium">{emp.name}</div>
                                <div className="text-sm text-muted-foreground">{emp.role}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {emp.teamLead && (
                                <Badge variant="secondary">
                                  <Star className="mr-1 h-3 w-3" weight="fill" />{t('Lead')}</Badge>
                              )}
                              <Badge variant={emp.status === 'active' ? 'default' : 'outline'}>
                                {emp.status}
                              </Badge>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Sparkle className="h-6 w-6 text-purple-600" weight="fill" />{t('Department Templates')}</DialogTitle>
            <DialogDescription>{t('Quick-start templates for common department types. Choose individual departments or create entire categories at once.')}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {DEPARTMENT_TEMPLATES.map((template) => {
                const Icon = template.icon;
                const existingDepts = template.departments.filter(td =>
                  (departments || []).some(d => 
                    d.name.toLowerCase() === td.name.toLowerCase() && d.status === 'active'
                  )
                );
                const availableDepts = template.departments.length - existingDepts.length;

                return (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="p-5 border-2 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-primary/10">
                            <Icon className="h-6 w-6 text-primary" weight="fill" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold">{template.categoryLabel}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.departments.length} departments available
                              {existingDepts.length > 0 && (
                                <span className="text-primary ml-2">
                                  · {existingDepts.length} already created
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {availableDepts > 0 && (
                          <Button
                            size="sm"
                            onClick={() => handleBulkCreateFromTemplate(template.id)}
                            className="shrink-0"
                          >
                            <Plus className="mr-1 h-4 w-4" weight="bold" />
                            Create All ({availableDepts})
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-3">
                        {template.departments.map((dept) => {
                          const exists = (departments || []).some(
                            d => d.name.toLowerCase() === dept.name.toLowerCase() && d.status === 'active'
                          );

                          return (
                            <div
                              key={dept.name}
                              className={`flex items-start justify-between p-3 rounded-lg border ${
                                exists ? 'bg-muted/50 opacity-60' : 'bg-background hover:bg-muted/30'
                              } transition-colors`}
                            >
                              <div className="flex items-start gap-3 flex-1">
                                <div
                                  className="w-3 h-3 rounded-full mt-1 shrink-0"
                                  style={{ backgroundColor: dept.suggestedColor }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium">{dept.name}</h4>
                                    {exists && (
                                      <Badge variant="outline" className="text-xs">
                                        <CheckCircle className="mr-1 h-3 w-3" weight="fill" />{t('Already exists')}</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {dept.description}
                                  </p>
                                </div>
                              </div>
                              {!exists && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApplyTemplate(dept)}
                                  className="shrink-0 ml-2"
                                >{t('Use Template')}</Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setTemplatesDialogOpen(false);
              setSelectedTemplate(null);
            }}>{t('Close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
