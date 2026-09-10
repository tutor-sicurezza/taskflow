import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, PaperPlaneTilt, Lightbulb, Bug, Heart, ChartBar } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useSanitizedInput } from '@/hooks/use-sanitized-input';

interface FeedbackItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  category: 'feature' | 'bug' | 'improvement' | 'praise' | 'other';
  rating: number;
  title: string;
  description: string;
  createdAt: string;
  status: 'new' | 'reviewing' | 'planned' | 'completed' | 'declined';
  upvotes: string[];
}

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: { id: string; name: string; avatar: string } | null;
  onSubmitFeedback: (feedback: Omit<FeedbackItem, 'id' | 'createdAt' | 'status' | 'upvotes'>) => void;
}

export function FeedbackDialog({ open, onOpenChange, currentUser, onSubmitFeedback }: FeedbackDialogProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<FeedbackItem['category']>('improvement');
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  // useSanitizedInput non espone `sanitizedValue`: restituisce { value, rawValue,
  // setValue, reset }, dove `value` E' gia' il testo sanificato. Destrutturare un
  // campo inesistente rendeva sanitizedTitle undefined, e il .trim() al submit
  // lanciava un TypeError che l'ErrorBoundary trasformava nella schermata di
  // errore: l'invio di feedback era impossibile al 100%.
  const { value: title, setValue: setTitle } = useSanitizedInput('');
  const { value: description, setValue: setDescription } = useSanitizedInput('');
  const sanitizedTitle = title;
  const sanitizedDescription = description;

  const handleSubmit = () => {
    if (!currentUser) {
      toast.error(t('You must be logged in to submit feedback'));
      return;
    }

    if (!sanitizedTitle.trim()) {
      toast.error(t('Please provide a title'));
      return;
    }

    if (!sanitizedDescription.trim()) {
      toast.error(t('Please provide a description'));
      return;
    }

    onSubmitFeedback({
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      category,
      rating,
      title: sanitizedTitle,
      description: sanitizedDescription,
    });

    setTitle('');
    setDescription('');
    setRating(5);
    setCategory('improvement');
    onOpenChange(false);
    toast.success(t('Thank you for your feedback! 🎉'));
  };

  const categoryIcons = {
    feature: <Lightbulb className="h-5 w-5" weight="fill" />,
    bug: <Bug className="h-5 w-5" weight="fill" />,
    improvement: <ChartBar className="h-5 w-5" weight="fill" />,
    praise: <Heart className="h-5 w-5" weight="fill" />,
    other: <Star className="h-5 w-5" weight="fill" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <PaperPlaneTilt className="h-6 w-6 text-primary" weight="fill" />{t('Share Your Feedback')}</DialogTitle>
          <DialogDescription>{t('Help us improve TaskFlow by sharing your thoughts, suggestions, or reporting issues.')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>{t('How would you rate your experience?')}</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className="h-8 w-8 transition-colors"
                    weight={(hoveredRating || rating) >= star ? 'fill' : 'regular'}
                    style={{
                      color: (hoveredRating || rating) >= star
                        ? 'oklch(0.68 0.18 35)'
                        : 'oklch(0.50 0.02 230)',
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-category">{t('Feedback Type')}</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as FeedbackItem['category'])}>
              <SelectTrigger id="feedback-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feature">
                  <div className="flex items-center gap-2">
                    {categoryIcons.feature}
                    <span>{t('Feature Request')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="bug">
                  <div className="flex items-center gap-2">
                    {categoryIcons.bug}
                    <span>{t('Bug Report')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="improvement">
                  <div className="flex items-center gap-2">
                    {categoryIcons.improvement}
                    <span>{t('Improvement Suggestion')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="praise">
                  <div className="flex items-center gap-2">
                    {categoryIcons.praise}
                    <span>{t('Praise & Thanks')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="other">
                  <div className="flex items-center gap-2">
                    {categoryIcons.other}
                    <span>{t('Other')}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-title">{t('Title')}</Label>
            <input
              id="feedback-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t('Brief summary of your feedback')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-description">{t('Description')}</Label>
            <Textarea
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder={t('Please provide as much detail as possible...')}
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">Tips for great feedback:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Be specific about what you experienced</li>
              <li>• Include steps to reproduce (for bugs)</li>
              <li>• Describe the impact on your workflow</li>
              <li>• Suggest potential solutions if you have ideas</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button onClick={handleSubmit} className="bg-primary">
            <PaperPlaneTilt className="mr-2 h-4 w-4" weight="fill" />{t('Submit Feedback')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
