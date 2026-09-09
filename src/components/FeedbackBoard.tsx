import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Star, ArrowUp, Lightbulb, Bug, ChartBar, Heart, ChatCircleDots, CheckCircle, Clock, CircleDashed, XCircle, Funnel } from '@phosphor-icons/react';
import { toast } from 'sonner';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'rating'>('recent');

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
      toast.error('You must be logged in to upvote');
      return;
    }
    onUpvote(feedbackId);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Feedback</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
          <div className="text-sm text-muted-foreground">New</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.planned}</div>
          <div className="text-sm text-muted-foreground">Planned</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-muted-foreground">Completed</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-accent">{stats.avgRating}</div>
          <div className="text-sm text-muted-foreground">Avg Rating</div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Funnel className="h-4 w-4 text-muted-foreground" weight="bold" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="feature">Feature Requests</SelectItem>
              <SelectItem value="bug">Bug Reports</SelectItem>
              <SelectItem value="improvement">Improvements</SelectItem>
              <SelectItem value="praise">Praise</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <Funnel className="h-4 w-4 text-muted-foreground" weight="bold" />
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredAndSortedFeedback.length === 0 ? (
          <Card className="p-12 text-center">
            <ChatCircleDots className="h-16 w-16 mx-auto mb-4 text-muted-foreground" weight="light" />
            <h3 className="text-lg font-medium mb-2">No feedback yet</h3>
            <p className="text-muted-foreground">Be the first to share your thoughts!</p>
          </Card>
        ) : (
          filteredAndSortedFeedback.map((item) => (
            <Card key={item.id} className="p-6 hover:border-primary/50 transition-colors">
              <div className="flex gap-4">
                <button
                  onClick={() => handleUpvote(item.id)}
                  disabled={!currentUserId}
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
                      <span className="ml-1">{categoryIcons[item.category].label}</span>
                    </Badge>
                    <Badge variant="outline" className={statusConfig[item.status].color}>
                      {statusConfig[item.status].icon}
                      <span className="ml-1">{statusConfig[item.status].label}</span>
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
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {isAdmin && onStatusChange && (
                      <Select
                        value={item.status}
                        onValueChange={(value) => onStatusChange(item.id, value as FeedbackItem['status'])}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="reviewing">Reviewing</SelectItem>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
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
