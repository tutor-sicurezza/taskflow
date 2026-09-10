import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users, ListChecks, ChartBar, Sparkle, X } from '@phosphor-icons/react';

interface WelcomeGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function WelcomeGuide({ open, onOpenChange, onComplete }: WelcomeGuideProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to TaskFlow! 🎉',
      description: 'Your complete employee task management solution',
      icon: CheckCircle,
      content: 'TaskFlow helps teams organize work, track progress, and collaborate effectively. Let\'s take a quick tour of the key features.',
    },
    {
      title: 'Manage Your Team',
      description: 'Add and organize team members',
      icon: Users,
      content: 'Start by adding your team members. Click the "Users" button in the header to add employees, assign departments, and set roles (Admin, Manager, or Member).',
    },
    {
      title: 'Create and Assign Tasks',
      description: 'Organize your team\'s work',
      icon: ListChecks,
      content: 'Click "Add Task" to create new tasks. Assign them to team members, set priorities, due dates, and track status. Use bulk operations to manage multiple tasks at once.',
    },
    {
      title: 'Track Performance',
      description: 'Monitor team analytics',
      icon: ChartBar,
      content: 'Switch to the Analytics view to see team performance metrics, workload distribution, and department insights. Export reports as PDF or CSV.',
    },
    {
      title: 'AI-Powered Features',
      description: 'Smart task management',
      icon: Sparkle,
      content: 'Use AI Assistant for intelligent task suggestions, auto-assignment based on workload, and insights about team performance and bottlenecks.',
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
      onOpenChange(false);
    }
  };

  const handleSkip = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h + overflow: DialogContent e' `fixed` e centrato, quindi senza
          tetto d'altezza su uno schermo basso il contenuto esce sopra e sotto,
          la testata e i pulsanti in fondo diventano irraggiungibili e la pagina
          non scorre perche' l'elemento e' fuori dal flusso. */}
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Icon className="h-6 w-6 text-primary" weight="duotone" />
              </div>
              <div>
                <DialogTitle className="text-xl">{t(currentStep.title)}</DialogTitle>
                <DialogDescription>{t(currentStep.description)}</DialogDescription>
              </div>
            </div>
            {/*
              Solo icona: senza aria-label il lettore di schermo annunciava
              "pulsante" e basta, sull'unico comando che chiude la guida.
            */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="h-10 w-10 sm:h-8 sm:w-8"
              aria-label={t('Skip tour')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="py-6">
          <p className="text-sm text-foreground leading-relaxed">
            {t(currentStep.content)}
          </p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                index === step ? 'bg-primary' : index < step ? 'bg-primary/50' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleSkip}>{t('Skip Tour')}</Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>{t('Previous')}</Button>
            )}
            <Button onClick={handleNext}>
              {step < steps.length - 1 ? t('Next') : t('Get Started')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
