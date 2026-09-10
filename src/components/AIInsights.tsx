import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Task, Employee } from '@/lib/types';
import { Sparkle, TrendUp, WarningCircle, CheckCircle, LightbulbFilament } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAI } from '@/lib/ai';
import { dataScadenza, eInRitardo } from '@/lib/scadenze';

// Con lo schema il formato della risposta e' garantito dall'API, non solo
// richiesto nel prompt: il modello non puo' restituire una forma diversa.
const INSIGHTS_SCHEMA = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['warning', 'success', 'tip', 'opportunity'] },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['type', 'title', 'description', 'priority'],
        additionalProperties: false,
      },
    },
  },
  required: ['insights'],
  additionalProperties: false,
};

interface AIInsightsProps {
  tasks: Task[];
  employees: Employee[];
}

interface Insight {
  type: 'warning' | 'success' | 'tip' | 'opportunity';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export function AIInsights({ tasks, employees }: AIInsightsProps) {
  const { t } = useTranslation();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { ask } = useAI();

  const generateInsights = async () => {
    setIsLoading(true);
    try {
      const activeEmployees = employees.filter(e => e.status === 'active');
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const overdueTasks = tasks.filter(t => 
        eInRitardo(t)
      );
      const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed');
      
      const workloadByEmployee = activeEmployees.map(emp => ({
        name: emp.name,
        taskCount: tasks.filter(t => t.assigneeId === emp.id && t.status !== 'completed').length,
      }));

      const prompt = `You are an AI assistant analyzing team task management data.

Current Statistics:
- Total tasks: ${tasks.length}
- Completed: ${completedTasks}
- Overdue: ${overdueTasks.length}
- High priority incomplete: ${highPriorityTasks.length}
- Active team members: ${activeEmployees.length}

Workload distribution:
${workloadByEmployee.map(w => `${w.name}: ${w.taskCount} active tasks`).join('\n')}

Overdue tasks:
${overdueTasks.slice(0, 5).map(t => `- ${t.title} (due: ${dataScadenza(t)?.toLocaleDateString() ?? 'n/d'})`).join('\n')}

Generate 3-5 actionable insights about the team's performance and task management. Each insight needs a brief title and a detailed description with specific recommendations.

Focus on:
- Workload imbalances
- Overdue task patterns
- Team productivity trends
- Specific actionable recommendations`;

      const response = await ask(prompt, { json: true, schema: INSIGHTS_SCHEMA });
      const data = JSON.parse(response);
      
      if (data.insights && Array.isArray(data.insights)) {
        setInsights(data.insights);
        setLastUpdate(new Date());
        toast.success(t('Insights updated!'));
      }
    } catch (error) {
      // Il messaggio reale distingue chiave mancante o richiesta rifiutata da
      // un errore generico.
      toast.error(error instanceof Error ? error.message : 'Impossibile generare gli insight');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tasks.length > 0 && employees.length > 0 && !lastUpdate) {
      generateInsights();
    }
  }, [tasks.length, employees.length]);

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'warning':
        return <WarningCircle className="w-5 h-5" weight="fill" />;
      case 'success':
        return <CheckCircle className="w-5 h-5" weight="fill" />;
      case 'tip':
        return <LightbulbFilament className="w-5 h-5" weight="fill" />;
      case 'opportunity':
        return <TrendUp className="w-5 h-5" weight="fill" />;
    }
  };

  const getInsightColor = (type: Insight['type']) => {
    switch (type) {
      case 'warning':
        return 'text-destructive bg-destructive/10';
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'tip':
        return 'text-blue-600 bg-blue-50';
      case 'opportunity':
        return 'text-purple-600 bg-purple-50';
    }
  };

  if (tasks.length === 0 || employees.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkle className="w-4 h-4 text-white" weight="fill" />
          </div>
          <div>
            <h3 className="font-semibold">{t('AI Insights')}</h3>
            {lastUpdate && (
              <p className="text-xs text-muted-foreground">
                Updated {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={generateInsights}
          disabled={isLoading}
        >
          {isLoading ? (
            <Sparkle className="w-4 h-4 animate-spin" weight="fill" />
          ) : (
            <>
              <Sparkle className="w-4 h-4 mr-2" weight="fill" />{t('Refresh')}</>
          )}
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {isLoading && insights.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        ) : insights.length > 0 ? (
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className={`rounded-lg p-4 ${getInsightColor(insight.type)}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {getInsightIcon(insight.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{insight.title}</h4>
                        <Badge 
                          variant={insight.priority === 'high' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {insight.priority}
                        </Badge>
                      </div>
                      <p className="text-sm opacity-90">{insight.description}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkle className="w-12 h-12 mx-auto mb-3 opacity-20" weight="light" />
            <p className="text-sm">{t('No insights available yet')}</p>
          </div>
        )}
      </AnimatePresence>
    </Card>
  );
}
