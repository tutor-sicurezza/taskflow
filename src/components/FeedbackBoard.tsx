import { useState, useMemo } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Star, ArrowUp, Lightbulb, Bug, ChartBar, Heart, ChatCircleDots, CheckCircle, Clock, CircleDashed, XCircle, Funnel } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { dataEstesa } from '@/lib/tempoRelativo';

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

interface FeedbackBoardProps {
  feedback: FeedbackItem[];
  currentUserId: string | undefined;
  isAdmin: boolean;
  onUpvote: (feedbackId: string) => void;
  onStatusChange?: (feedbackId: string, status: FeedbackItem['status']) => void;
}

export function FeedbackBoard({ feedback, currentUserId, isAdmin, onUpvote, onStatusChange }: FeedbackBoardProps) {
  const { t, lingua } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'rating'>('recent');

  // `label` e' la CHIAVE di traduzione, non il testo da mostrare: queste due
  // tabelle vengono ricostruite a ogni rendering, ma tradurre qui legherebbe
  // comunque la scelta al punto di definizione invece che al punto d'uso.
  const categoryIcons = {
    feature: { icon: <Lightbulb className="h-4 w-4" weight="fill" />, label: 'Feature Request', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
    bug: { icon: <Bug className="h-4 w-4" weight="fill" />, label: 'Bug Report', color: 'bg-red-500/10 text-red-700 border-red-200' },
    improvement: { icon: <ChartBar className="h-4 w-4" weight="fill" />, label: 'Improvement', color: 'bg-purple-500/10 text-purple-700 border-purple-200' },
    praise: { icon: <Heart className="h-4 w-4" weight="fill" />, label: 'Praise', color: 'bg-pink-500/10 text-pink-700 border-pink-200' },
    other: { icon: <Star className="h-4 w-4" weight="fill" />, label: 'Other', color: 'bg-gray-500/10 text-gray-700 border-gray-200' },
  };

  const statusConfig = {
    new: { icon: <CircleDashed className="h-4 w-4" weight="bold" />, label: 'New', color: 'bg-blue-500/10 text-blue-700' },
    reviewing: { icon: <Clock className="h-4 w-4" weight="fill" />, label: 'Reviewing', color: 'bg-yellow-500/10 text-yellow-700' },
    planned: { icon: <ChatCircleDots className="h-4 w-4" weight="fill" />, label: 'Planned', color: 'bg-purple-500/10 text-purple-700' },
    completed: { icon: <CheckCircle className="h-4 w-4" weight="fill" />, label: 'Completed', color: 'bg-green-500/10 text-green-700' },
    declined: { icon: <XCircle className="h-4 w-4" weight="fill" />, label: 'Declined', color: 'bg-gray-500/10 text-gray-700' },
  };

  const filteredAndSortedFeedback = useMemo(() => {
    let filtered = [...feedback];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(f => f.category === selectedCategory);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(f => f.status === selectedStatus);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.upvotes.length - a.upvotes.length;
        case 'rating':
          return b.rating - a.rating;
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [feedback, selectedCategory, selectedStatus, sortBy]);

  const stats = useMemo(() => {
    return {
      total: feedback.length,
      new: feedback.filter(f => f.status === 'new').length,
      planned: feedback.filter(f => f.status === 'planned').length,
      completed: feedback.filter(f => f.status === 'completed').length,
      avgRating: feedback.length > 0 
        ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
        : '0',
    };
  }, [feedback]);

  const handleUpvote = (feedbackId: string) => {
    if (!currentUserId) {
      toast.error(t('You must be logged in to upvote'));
      return;
    }
    onUpvote(feedbackId);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">{t('Total Feedback')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
          <div className="text-sm text-muted-foreground">{t('New')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.planned}</div>
          <div className="text-sm text-muted-foreground">{t('Planned')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-muted-foreground">{t('Completed')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-accent">{stats.avgRating}</div>
          <div className="text-sm text-muted-foreground">{t('Avg Rating')}</div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Funnel className="h-4 w-4 text-muted-foreground" weight="bold" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label={t('Filter by category')}>
              <SelectValue placeholder={t('Category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Categories')}</SelectItem>
              <SelectItem value="feature">{t('Feature Requests')}</SelectItem>
              <SelectItem value="bug">{t('Bug Reports')}</SelectItem>
              <SelectItem value="improvement">{t('Improvements')}</SelectItem>
              <SelectItem value="praise">{t('Praise')}</SelectItem>
              <SelectItem value="other">{t('Other')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <Funnel className="h-4 w-4 text-muted-foreground" weight="bold" />
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label={t('Filter by status')}>
              <SelectValue placeholder={t('Status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Status')}</SelectItem>
              <SelectItem value="new">{t('New')}</SelectItem>
              <SelectItem value="reviewing">{t('Reviewing')}</SelectItem>
              <SelectItem value="planned">{t('Planned')}</SelectItem>
              <SelectItem value="completed">{t('Completed')}</SelectItem>
              <SelectItem value="declined">{t('Declined')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label={t('Sort by')}>
              <SelectValue placeholder={t('Sort by')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{t('Most Recent')}</SelectItem>
              <SelectItem value="popular">{t('Most Popular')}</SelectItem>
              <SelectItem value="rating">{t('Highest Rated')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredAndSortedFeedback.length === 0 ? (
          <Card className="p-12 text-center">
            <ChatCircleDots className="h-16 w-16 mx-auto mb-4 text-muted-foreground" weight="light" />
            <h3 className="text-lg font-medium mb-2">{t('No feedback yet')}</h3>
            <p className="text-muted-foreground">{t('Be the first to share your thoughts!')}</p>
          </Card>
        ) : (
          filteredAndSortedFeedback.map((item) => (
            <Card key={item.id} className="p-6 hover:border-primary/50 transition-colors">
              <div className="flex gap-4">
                <button
                  onClick={() => handleUpvote(item.id)}
                  disabled={!currentUserId}
                  aria-label={t('Upvote {title}', { title: item.title })}
                  className="flex flex-col items-center gap-1 min-w-[48px] group"
                >
                  <ArrowUp
                    className={`h-6 w-6 transition-all ${
                      currentUserId && item.upvotes.includes(currentUserId)
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-primary group-hover:scale-110'
                    }`}
                    weight={currentUserId && item.upvotes.includes(currentUserId) ? 'fill' : 'regular'}
                  />
                  <span className={`text-sm font-medium ${
                    currentUserId && item.upvotes.includes(currentUserId)
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}>
                    {item.upvotes.length}
                  </span>
                </button>

                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(item.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-accent" weight="fill" />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    <Badge variant="outline" className={categoryIcons[item.category].color}>
                      {categoryIcons[item.category].icon}
                      <span className="ml-1">{t(categoryIcons[item.category].label)}</span>
                    </Badge>
                    <Badge variant="outline" className={statusConfig[item.status].color}>
                      {statusConfig[item.status].icon}
                      <span className="ml-1">{t(statusConfig[item.status].label)}</span>
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={item.userAvatar} alt={item.userName} />
                        <AvatarFallback>{item.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">{item.userName}</span>
                      <span className="text-sm text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">
                        {dataEstesa(item.createdAt, lingua)}
                      </span>
                    </div>

                    {isAdmin && onStatusChange && (
                      <Select
                        value={item.status}
                        onValueChange={(value) => onStatusChange(item.id, value as FeedbackItem['status'])}
                      >
                        <SelectTrigger className="w-[140px] h-8" aria-label={t('Change status for {title}', { title: item.title })}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">{t('New')}</SelectItem>
                          <SelectItem value="reviewing">{t('Reviewing')}</SelectItem>
                          <SelectItem value="planned">{t('Planned')}</SelectItem>
                          <SelectItem value="completed">{t('Completed')}</SelectItem>
                          <SelectItem value="declined">{t('Declined')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
