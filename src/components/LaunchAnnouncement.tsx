import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Rocket, Sparkle, Users, CheckCircle, ChartBar, Heart } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { coriandoli } from '@/lib/coriandoli';
import { useEffect } from 'react';

interface LaunchAnnouncementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGiveFeedback: () => void;
}

export function LaunchAnnouncement({ open, onOpenChange, onGiveFeedback }: LaunchAnnouncementProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (open) {
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = window.setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        coriandoli({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        coriandoli({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [open]);

  const features = [
    {
      icon: <CheckCircle className="h-6 w-6" weight="fill" />,
      title: 'Task Management',
      description: 'Create, assign, and track tasks efficiently',
    },
    {
      icon: <Users className="h-6 w-6" weight="fill" />,
      title: 'Team Collaboration',
      description: 'Work together with departments and roles',
    },
    {
      icon: <ChartBar className="h-6 w-6" weight="fill" />,
      title: 'Analytics Dashboard',
      description: 'Visualize team performance and insights',
    },
    {
      icon: <Sparkle className="h-6 w-6" weight="fill" />,
      title: 'AI Assistant',
      description: 'Smart suggestions and automated workflows',
    },
  ];

  const handleClose = () => {
    onGiveFeedback();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h + overflow: DialogContent e' `fixed` e centrato, quindi senza
          tetto d'altezza su uno schermo basso il contenuto esce sopra e sotto,
          la testata e i pulsanti in fondo diventano irraggiungibili e la pagina
          non scorre perche' l'elemento e' fuori dal flusso. */}
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="flex justify-center mb-4"
          >
            <div className="bg-gradient-to-br from-accent to-accent/60 p-6 rounded-full">
              <Rocket className="h-16 w-16 text-white" weight="fill" />
            </div>
          </motion.div>
          <DialogTitle className="text-center text-3xl sm:text-4xl">
            {t('🎉 TaskFlow is Now Live! 🎉')}
          </DialogTitle>
          <DialogDescription className="text-center text-lg pt-2">{t('Welcome to your new team productivity platform')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg p-6 border border-primary/20"
          >
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Heart className="h-6 w-6 text-primary" weight="fill" />{t('Thank You for Being Part of Our Launch')}</h3>
            <p className="text-muted-foreground leading-relaxed">
              {t("We've built TaskFlow to help teams work smarter, collaborate better, and achieve more together. Your feedback during this launch phase is invaluable and will help us shape the future of this platform.")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="bg-card border rounded-lg p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="text-primary mt-1">{feature.icon}</div>
                  <div>
                    <h4 className="font-semibold mb-1">{t(feature.title)}</h4>
                    <p className="text-sm text-muted-foreground">{t(feature.description)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="bg-accent/10 border border-accent/20 rounded-lg p-6"
          >
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Sparkle className="h-5 w-5 text-accent" weight="fill" />{t('We Need Your Feedback!')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('Your experience matters! Please take a moment to share your thoughts, report any issues, or suggest improvements. Every piece of feedback helps us make TaskFlow better for everyone.')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleClose} className="flex-1 bg-accent hover:bg-accent/90">
                <Heart className="mr-2 h-4 w-4" weight="fill" />{t('Share Feedback Now')}</Button>
              <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">{t("I'll Do It Later")}</Button>
            </div>
          </motion.div>

          <div className="text-center text-sm text-muted-foreground">
            <p>{t('Questions or need help? Check the Help Documentation or contact your administrator.')}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
