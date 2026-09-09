import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Task, Employee } from '@/lib/types';
import { useAI } from '@/lib/ai';
import { Sparkle, PaperPlaneTilt } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface AIAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  employees: Employee[];
  onSuggestionApply: (suggestion: AISuggestion) => void;
}

export interface AISuggestion {
  type: 'create_task' | 'reassign' | 'priority_change' | 'insight';
  title: string;
  description: string;
  action?: {
    taskId?: string;
    newAssigneeId?: string;
    newPriority?: 'low' | 'medium' | 'high';
    taskData?: Omit<Task, 'id' | 'status' | 'createdAt' | 'comments' | 'activities'>;
  };
}

export function AIAssistant({ open, onOpenChange, tasks, employees, onSuggestionApply }: AIAssistantProps) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const { ask } = useAI();

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;

    const userMessage = prompt.trim();
    setPrompt('');
    setIsLoading(true);

    setConversationHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const activeEmployees = employees.filter(e => e.status === 'active');
      const overdueTasks = tasks.filter(t => 
        new Date(t.dueDate) < new Date() && t.status !== 'completed'
      );
      const tasksByEmployee = activeEmployees.map(emp => ({
        name: emp.name,
        id: emp.id,
        taskCount: tasks.filter(t => t.assigneeId === emp.id && t.status !== 'completed').length,
      }));

      const contextPrompt = `You are an AI assistant for TaskFlow, a team task management application.

Current Context:
- Total tasks: ${tasks.length}
- Active employees: ${activeEmployees.length}
- Overdue tasks: ${overdueTasks.length}
- Tasks by employee: ${JSON.stringify(tasksByEmployee)}

Recent tasks:
${tasks.slice(-5).map(t => `- ${t.title} (${t.status}, priority: ${t.priority}, assigned to: ${employees.find(e => e.id === t.assigneeId)?.name || 'Unassigned'})`).join('\n')}

User request: ${userMessage}

Analyze the user's request and provide helpful insights or suggestions. You can:
1. Suggest creating new tasks
2. Recommend reassigning tasks for better workload balance
3. Suggest priority changes
4. Provide insights about team performance or workload

Respond in a conversational, helpful manner. If suggesting actions, be specific about what should be done and why.`;

      const response = await ask(contextPrompt);
      
      setConversationHistory(prev => [...prev, { role: 'assistant', content: response }]);

      const suggestionsPrompt = `Based on this conversation and the user's request, extract actionable suggestions.

User request: ${userMessage}
AI response: ${response}

Available employees: ${JSON.stringify(activeEmployees.map(e => ({ id: e.id, name: e.name })))}
Current tasks: ${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, assigneeId: t.assigneeId, priority: t.priority })))}

Return a JSON object with a "suggestions" property containing an array of suggestion objects. Each suggestion should have:
{
  "type": "create_task" | "reassign" | "priority_change" | "insight",
  "title": "Brief title of the suggestion",
  "description": "Detailed explanation",
  "action": {
    "taskId": "task id if applicable",
    "newAssigneeId": "employee id if reassigning",
    "newPriority": "low|medium|high if changing priority",
    "taskData": {
      "title": "task title",
      "description": "task description",
      "assigneeId": "employee id or null",
      "priority": "low|medium|high",
      "dueDate": "ISO date string"
    }
  }
}

If there are no actionable suggestions (just general advice/insights), return an empty array.`;

      const suggestionsResponse = await ask(suggestionsPrompt, { json: true });
      const parsedSuggestions = JSON.parse(suggestionsResponse);
      
      if (parsedSuggestions.suggestions && Array.isArray(parsedSuggestions.suggestions)) {
        setSuggestions(parsedSuggestions.suggestions);
      }

    } catch (error) {
      // Il messaggio reale distingue chiave mancante, sessione scaduta o
      // rifiuto del modello da un generico fallimento.
      const message = error instanceof Error ? error.message : 'Failed to get AI response';
      toast.error(message);
      setConversationHistory(prev => [...prev, {
        role: 'assistant',
        content: `I apologize, but I encountered an error processing your request: ${message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySuggestion = (suggestion: AISuggestion) => {
    onSuggestionApply(suggestion);
    setSuggestions(prev => prev.filter(s => s !== suggestion));
    toast.success(t('Suggestion applied!'));
  };

  const handleClearConversation = () => {
    setConversationHistory([]);
    setSuggestions([]);
    setPrompt('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkle className="w-6 h-6 text-white" weight="fill" />
              </div>
              <div>
                <DialogTitle>{t('AI Assistant')}</DialogTitle>
                <DialogDescription>{t('Get intelligent insights and suggestions for your tasks')}</DialogDescription>
              </div>
            </div>
            {conversationHistory.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearConversation}>{t('Clear')}</Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 min-h-[300px]">
          {conversationHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkle className="w-16 h-16 mx-auto mb-4 opacity-20" weight="light" />
              <p className="text-sm">{t('Ask me anything about your tasks and team!')}</p>
              <div className="mt-6 space-y-2 text-xs">
                <p className="font-medium text-foreground">Try asking:</p>
                <p>"How can I balance the workload across my team?"</p>
                <p>"Which tasks should I prioritize this week?"</p>
                <p>"Create a task for the upcoming product launch"</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {conversationHistory.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <Sparkle className="w-4 h-4 text-white" weight="fill" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-foreground'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <Sparkle className="w-4 h-4 text-white animate-spin" weight="fill" />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <p className="text-sm font-medium">Actionable Suggestions:</p>
              <AnimatePresence mode="popLayout">
                {suggestions.map((suggestion, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-accent/10 border border-accent/30 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{suggestion.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{suggestion.description}</p>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => handleApplySuggestion(suggestion)}
                        className="flex-shrink-0"
                      >{t('Apply')}</Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('Ask me anything about your tasks...')}
            className="resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button 
            onClick={handleSubmit} 
            disabled={!prompt.trim() || isLoading}
            className="flex-shrink-0"
            size="lg"
          >
            <PaperPlaneTilt className="w-5 h-5" weight="fill" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
