import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { useKV } from '@/hooks/useKV';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Palette } from '@phosphor-icons/react';
import { getAllDepartments, getDepartmentConfig, DEPARTMENT_CONFIGS } from '@/lib/departments';
import { DepartmentBadge } from '@/components/DepartmentBadge';

interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  status: 'active' | 'archived';
}

export function DepartmentColorLegend() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [customDepartments, setCustomDepartments] = useKV<Department[]>('departments', []);
  const standardDepartments = getAllDepartments();

  const customDepartmentsForBadge = (customDepartments || []).map(d => ({
    name: d.name,
    color: d.color
  }));

  const activeDepartments = (customDepartments || []).filter(d => d.status === 'active');

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Palette className="mr-2 h-4 w-4" weight="fill" />{t('Department Colors')}</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" weight="fill" />{t('Department Color Guide')}</DialogTitle>
            <DialogDescription>
              {t('Visual reference for department color coding and icons used throughout the app')}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(85vh-120px)] pr-4">
            <div className="space-y-6">
              {activeDepartments.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-lg">{t('Custom Departments')}</h3>
                    <Badge variant="secondary">{activeDepartments.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {activeDepartments.map((dept) => {
                      const config = getDepartmentConfig(dept.name, customDepartmentsForBadge);
                      const Icon = config.icon;

                      return (
                        <Card key={dept.id} className="p-4">
                          <div className="flex items-start gap-4">
                            <div 
                              className="p-3 rounded-lg flex-shrink-0"
                              style={{ backgroundColor: config.bgColor }}
                            >
                              <Icon 
                                className="h-6 w-6" 
                                weight="fill"
                                style={{ color: config.color }}
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{dept.name}</h3>
                              </div>
                              
                              <p className="text-sm text-muted-foreground mb-3">
                                {dept.description || `${dept.name} department`}
                              </p>
                              
                              <div className="flex flex-wrap gap-2">
                                <DepartmentBadge 
                                  departmentName={dept.name}
                                  size="sm"
                                  variant="default"
                                  customDepartments={customDepartmentsForBadge}
                                />
                                <DepartmentBadge 
                                  departmentName={dept.name}
                                  size="sm"
                                  variant="outline"
                                  customDepartments={customDepartmentsForBadge}
                                />
                                <DepartmentBadge 
                                  departmentName={dept.name}
                                  size="sm"
                                  variant="solid"
                                  customDepartments={customDepartmentsForBadge}
                                />
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeDepartments.length > 0 && <Separator />}

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-lg">{t('Standard Departments')}</h3>
                  <Badge variant="secondary">{standardDepartments.length}</Badge>
                </div>
                <div className="space-y-3">
                  {standardDepartments.map((deptName) => {
                    const config = DEPARTMENT_CONFIGS[deptName];
                    const Icon = config.icon;

                    return (
                      <Card key={deptName} className="p-4">
                        <div className="flex items-start gap-4">
                          <div 
                            className="p-3 rounded-lg flex-shrink-0"
                            style={{ backgroundColor: config.bgColor }}
                          >
                            <Icon 
                              className="h-6 w-6" 
                              weight="fill"
                              style={{ color: config.color }}
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{deptName}</h3>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-3">
                              {config.description}
                            </p>
                            
                            <div className="flex flex-wrap gap-2">
                              <DepartmentBadge 
                                departmentName={deptName}
                                size="sm"
                                variant="default"
                              />
                              <DepartmentBadge 
                                departmentName={deptName}
                                size="sm"
                                variant="outline"
                              />
                              <DepartmentBadge 
                                departmentName={deptName}
                                size="sm"
                                variant="solid"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
