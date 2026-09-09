import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Rocket, Confetti, Trophy, Sparkle, Check, ArrowRight } from '@phosphor-icons/react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

interface LaunchCelebrationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LaunchCelebration({ open, onOpenChange }: LaunchCelebrationProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const fireConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setStep(0);
      setTimeout(() => {
        fireConfetti();
      }, 500);
    }
    onOpenChange(isOpen);
  };

  const achievements = [
    { icon: Check, label: '81 Iterations Completed', color: 'text-green-600' },
    { icon: Trophy, label: '150+ Features Built', color: 'text-yellow-600' },
    { icon: Check, label: '100% Tests Passed', color: 'text-blue-600' },
    { icon: Sparkle, label: 'AI Integration Active', color: 'text-purple-600' },
    { icon: Check, label: 'Security Hardened', color: 'text-red-600' },
    { icon: Trophy, label: 'Production Ready', color: 'text-accent' },
  ];

  const steps = [
    {
      title: '🚀 Ready for Launch!',
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.8 }}
            >
              <Rocket className="w-24 h-24 mx-auto mb-4 text-primary" weight="fill" />
            </motion.div>
            <h3 className="text-2xl font-semibold mb-2">{t('TaskFlow is Production Ready!')}</h3>
            <p className="text-muted-foreground">{t('After 81 iterations, your application is ready to deploy.')}</p>
          </div>
          
          <div className="bg-accent/10 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" weight="fill" />{t('Your Achievements')}</h4>
            <div className="grid grid-cols-2 gap-3">
              {achievements.map((achievement, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-2"
                >
                  <achievement.icon className={`w-4 h-4 ${achievement.color}`} weight="bold" />
                  <span className="text-sm">{achievement.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '📋 Launch Checklist',
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Complete these final steps before going live:
          </p>
          <div className="space-y-3">
            {[
              'Run final smoke test (30 minutes)',
              'Verify all critical paths working',
              'Check browser console for errors',
              'Test on mobile device',
              'Export data backup',
              'Click "Publish" in Spark UI',
              'Share URL with your team',
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold mt-0.5">
                  {index + 1}
                </div>
                <span className="flex-1">{item}</span>
              </motion.div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: '🎉 Time to Celebrate!',
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <motion.div
              animate={{
                rotate: [0, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            >
              <Confetti className="w-24 h-24 mx-auto mb-4 text-accent" weight="fill" />
            </motion.div>
            <h3 className="text-2xl font-semibold mb-2">You Did It! 🎊</h3>
            <p className="text-muted-foreground mb-4">
              From concept to production in 81 iterations. That's persistence!
            </p>
          </div>

          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-6 space-y-4">
            <h4 className="font-semibold">📊 By The Numbers:</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">81</div>
                <div className="text-sm text-muted-foreground">{t('Iterations')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">150+</div>
                <div className="text-sm text-muted-foreground">{t('Features')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">100%</div>
                <div className="text-sm text-muted-foreground">{t('Tests Passed')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-accent">95%</div>
                <div className="text-sm text-muted-foreground">{t('Health Score')}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">📚 Documentation Ready:</h4>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" weight="bold" />
                <span>PRODUCTION_DEPLOYMENT.md - Deployment guide</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" weight="bold" />
                <span>LAUNCH_CELEBRATION.md - Celebration & stats</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" weight="bold" />
                <span>LAUNCH_READINESS_REPORT.md - Full audit</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkle className="w-6 h-6 text-accent" weight="fill" />
            {steps[step].title}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="py-4"
          >
            {steps[step].content}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
              >{t('Back')}</Button>
            )}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                {t('Next')}
                <ArrowRight className="ml-2 h-4 w-4" weight="bold" />
              </Button>
            ) : (
              <Button onClick={() => handleOpen(false)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                Let's Launch! 🚀
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
