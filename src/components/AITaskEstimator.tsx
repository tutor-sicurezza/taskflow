import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkle, Clock, CalendarBlank, TrendUp, CheckCircle } from '@phosphor-icons/react';
import { TaskPriority, Task, Employee } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAI } from '@/lib/ai';

interface AITaskEstimatorProps {
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId: string | null;
  employees: Employee[];
  tasks?: Task[];
  onApplySuggestion: (suggestedDate: Date, estimatedDuration: number) => void;
}

interface EstimateResult {
  estimatedDurationDays: number;
  estimatedDurationHours: number;
  suggestedDeadline: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  factors: string[];
}

/**
 * Rispecchia `EstimateResult` campo per campo. Tutti i campi sono obbligatori
 * anche nell'interfaccia, quindi lo schema strict (additionalProperties: false
 * + required completo) e' esprimibile senza compromessi.
 */
const ESTIMATE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    estimatedDurationDays: { type: 'number' },
    estimatedDurationHours: { type: 'number' },
    suggestedDeadline: { type: 'string', description: 'Data nel formato YYYY-MM-DD' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string' },
    factors: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'estimatedDurationDays',
    'estimatedDurationHours',
    'suggestedDeadline',
    'confidence',
    'reasoning',
    'factors',
  ],
  additionalProperties: false,
};

export function AITaskEstimator({
  title,
  description,
  priority,
  assigneeId,
  employees,
  tasks = [],
  onApplySuggestion,
}: AITaskEstimatorProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const { ask } = useAI();

  const generateEstimate = async () => {
    if (!title.trim()) {
      toast.error(t('Please enter a task title first'));
      return;
    }

    setIsLoading(true);
    setEstimate(null);

    try {
      const assignee = assigneeId ? employees.find(e => e.id === assigneeId) : null;
      const assigneeTasks = assignee ? tasks.filter(t => t.assigneeId === assigneeId) : [];
      
      const completedTasks = assigneeTasks.filter(t => t.status === 'completed');
      const avgCompletionTime = completedTasks.length > 0
        ? completedTasks.reduce((sum, task) => {
            const created = new Date(task.createdAt).getTime();
            const completed = new Date(task.dueDate).getTime();
            return sum + (completed - created);
          }, 0) / completedTasks.length / (1000 * 60 * 60 * 24)
        : null;

      const prompt = `You are an expert project manager analyzing task complexity to estimate duration and suggest optimal deadlines.

Task Details:
- Title: ${title}
- Description: ${description || 'No description provided'}
- Priority: ${priority}
- Assigned to: ${assignee ? `${assignee.name} (${assignee.role})` : 'Unassigned'}

Context:
${assignee ? `- Assignee currently has ${assigneeTasks.length} tasks assigned` : '- No assignee selected yet'}
${avgCompletionTime ? `- Assignee's average task completion time: ${avgCompletionTime.toFixed(1)} days` : ''}
- Current date: ${new Date().toLocaleDateString()}

Analyze the task complexity, priority, and context to provide:
1. Estimated duration in days (be realistic: 1-30 days range)
2. Estimated hours per day needed (1-8 hours)
3. Suggested deadline date
4. Confidence level (high/medium/low)
5. Brief reasoning (1-2 sentences)
6. Key factors influencing the estimate (3-5 bullet points)

Consider:
- Task complexity based on title and description
- Priority level impact on focus time
- Current workload of assignee
- Standard development/business task timelines
- Buffer time for reviews and iterations

The suggested deadline must be an absolute date in YYYY-MM-DD format.`;

      // Il codice originale usava di proposito 'gpt-4o' (modello piu' forte) qui,
      // non 'gpt-4o-mini' come altrove. Ora il modello lo sceglie il server: se la
      // qualita' della stima dovesse calare, questo e' il punto dove reintrodurre
      // un override per-chiamata con l'opzione `model`.
      const response = await ask(prompt, { json: true, schema: ESTIMATE_SCHEMA });
      const result = JSON.parse(response) as EstimateResult;

      setEstimate(result);
      toast.success(t('AI estimate generated!'));
    } catch (error) {
      console.error('Error generating estimate:', error);
      // Il messaggio reale (chiave API mancante, sessione scaduta, rifiuto del
      // modello) e' piu' utile del generico "riprova".
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate estimate. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!estimate) return;
    
    const suggestedDate = new Date(estimate.suggestedDeadline);
    onApplySuggestion(suggestedDate, estimate.estimatedDurationDays);
    toast.success(t('Applied AI suggestion!'));
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkle className="h-4 w-4 text-purple-600" weight="fill" />
          <span className="text-sm font-medium">{t('AI Duration & Deadline Estimate')}</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={generateEstimate}
          disabled={isLoading || !title.trim()}
          className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-300 hover:from-purple-500/20 hover:to-pink-500/20"
        >
          {isLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkle className="mr-2 h-4 w-4" weight="fill" />
              </motion.div>{t('Analyzing...')}</>
          ) : (
            <>
              <Sparkle className="mr-2 h-4 w-4" weight="fill" />{t('Generate Estimate')}</>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {estimate && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-4 bg-gradient-to-br from-purple-50/50 to-pink-50/50 border-purple-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendUp className="h-4 w-4 text-purple-600" weight="bold" />
                    <span className="font-medium text-sm">{t('AI Recommendation')}</span>
                  </div>
                  <Badge variant="outline" className={getConfidenceColor(estimate.confidence)}>
                    {estimate.confidence} confidence
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/60 rounded-lg p-3 border border-purple-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-purple-600" weight="bold" />
                      <span className="text-xs text-muted-foreground">{t('Estimated Duration')}</span>
                    </div>
                    <div className="text-lg font-semibold text-purple-900">
                      {estimate.estimatedDurationDays} {estimate.estimatedDurationDays === 1 ? 'day' : 'days'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ~{estimate.estimatedDurationHours}h per day
                    </div>
                  </div>

                  <div className="bg-white/60 rounded-lg p-3 border border-purple-100">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarBlank className="h-4 w-4 text-purple-600" weight="bold" />
                      <span className="text-xs text-muted-foreground">{t('Suggested Deadline')}</span>
                    </div>
                    <div className="text-lg font-semibold text-purple-900">
                      {new Date(estimate.suggestedDeadline).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {Math.ceil(
                        (new Date(estimate.suggestedDeadline).getTime() - new Date().getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      days from now
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 rounded-lg p-3 border border-purple-100">
                  <div className="text-xs font-medium text-purple-900 mb-2">{t('Analysis')}</div>
                  <p className="text-xs text-gray-700 leading-relaxed mb-3">{estimate.reasoning}</p>
                  
                  <div className="text-xs font-medium text-purple-900 mb-2">{t('Key Factors')}</div>
                  <ul className="space-y-1.5">
                    {estimate.factors.map((factor, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs text-gray-700">
                        <CheckCircle className="h-3.5 w-3.5 text-purple-600 mt-0.5 flex-shrink-0" weight="fill" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  type="button"
                  onClick={handleApply}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="sm"
                >
                  <CheckCircle className="mr-2 h-4 w-4" weight="bold" />{t('Apply This Suggestion')}</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
