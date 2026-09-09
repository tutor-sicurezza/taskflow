import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/contexts/LanguageContext';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useEffect, useRef } from 'react';
import { Clock, Circle, CircleHalf, CheckCircle, ChatCircle, ClockCounterClockwise, User, Calendar, Flag, FileText, ArrowsLeftRight, PaperPlaneTilt, File, FilePdf, FileImage, FileDoc, UploadSimple, DownloadSimple, Trash, Paperclip, PencilSimple, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Task, Employee, TaskActivity, TaskAttachment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Sanitizer } from '@/lib/sanitization';

interface TaskDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  employees: Employee[];
  currentUser: { id: string; name: string; avatar: string } | null;
  onAddComment: (taskId: string, content: string) => void;
  onEditComment?: (taskId: string, commentId: string, content: string) => void;
  onDeleteComment?: (taskId: string, commentId: string) => void;
  onAddAttachment: (taskId: string, file: File) => void;
  onDeleteAttachment: (taskId: string, attachmentId: string) => void;
}

export function TaskDetailsDialog({ 
  open, 
  onOpenChange, 
  task, 
  employees, 
  currentUser, 
  onAddComment,
  onEditComment,
  onDeleteComment,
  onAddAttachment,
  onDeleteAttachment 
}: TaskDetailsDialogProps) {
  const { t } = useTranslation();
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState('comments');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setCommentText('');
      setActiveTab('comments');
      setEditingCommentId(null);
      setEditingCommentText('');
    }
  }, [open]);

  if (!task) return null;

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    const sanitizedComment = Sanitizer.comment(commentText);
    if (!sanitizedComment) return;
    onAddComment(task.id, sanitizedComment);
    setCommentText('');
  };

  const handleEditComment = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId);
    setEditingCommentText(currentContent);
  };

  const handleSaveEdit = () => {
    if (!editingCommentId || !editingCommentText.trim() || !onEditComment) return;
    const sanitizedComment = Sanitizer.comment(editingCommentText);
    if (!sanitizedComment) return;
    onEditComment(task.id, editingCommentId, sanitizedComment);
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleDeleteComment = (commentId: string) => {
    if (!onDeleteComment) return;
    if (confirm('Are you sure you want to delete this comment?')) {
      onDeleteComment(task.id, commentId);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddAttachment(task.id, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadAttachment = (attachment: TaskAttachment) => {
    const link = document.createElement('a');
    link.href = attachment.fileData;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return FilePdf;
    if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg')) return FileImage;
    if (fileType.includes('doc')) return FileDoc;
    return File;
  };

  const assignee = task.assigneeId ? employees.find(e => e.id === task.assigneeId) : null;
  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'completed';

  const priorityColors = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    low: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  };

  const StatusIcon = task.status === 'completed' ? CheckCircle : task.status === 'in-progress' ? CircleHalf : Circle;

  const getActivityIcon = (type: TaskActivity['type']) => {
    switch (type) {
      case 'created':
        return CheckCircle;
      case 'status_changed':
        return ArrowsLeftRight;
      case 'assignee_changed':
        return User;
      case 'due_date_changed':
        return Calendar;
      case 'priority_changed':
        return Flag;
      case 'title_changed':
      case 'description_changed':
        return FileText;
      case 'comment_added':
        return ChatCircle;
      case 'attachment_added':
        return Paperclip;
      case 'attachment_removed':
        return Trash;
      default:
        return ClockCounterClockwise;
    }
  };

  const getActivityMessage = (activity: TaskActivity) => {
    switch (activity.type) {
      case 'created':
        return 'created this task';
      case 'status_changed':
        return `changed status from ${activity.oldValue} to ${activity.newValue}`;
      case 'assignee_changed':
        return activity.oldValue 
          ? `reassigned from ${activity.oldValue} to ${activity.newValue || 'Unassigned'}`
          : `assigned to ${activity.newValue}`;
      case 'due_date_changed':
        return `changed due date from ${activity.oldValue} to ${activity.newValue}`;
      case 'priority_changed':
        return `changed priority from ${activity.oldValue} to ${activity.newValue}`;
      case 'title_changed':
        return 'updated the title';
      case 'description_changed':
        return 'updated the description';
      case 'comment_added':
        return 'added a comment';
      case 'attachment_added':
        return `attached ${activity.details}`;
      case 'attachment_removed':
        return `removed attachment ${activity.details}`;
      default:
        return activity.details || 'made a change';
    }
  };

  const comments = task.comments || [];
  const activities = task.activities || [];
  const attachments = task.attachments || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{task.title}</DialogTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={cn('text-xs', priorityColors[task.priority])}>
                  {task.priority.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <StatusIcon weight="fill" className="w-3 h-3" />
                  {task.status.replace('-', ' ').toUpperCase()}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock weight="bold" className="w-3.5 h-3.5" />
                  <span className={cn(isOverdue && 'text-destructive font-medium')}>
                    {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            {assignee && (
              <Avatar className="w-12 h-12">
                <AvatarImage src={assignee.avatar} alt={assignee.name} />
                <AvatarFallback>{assignee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {task.description}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 w-auto">
            <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
            <TabsTrigger value="attachments">Attachments ({attachments.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="flex-1 overflow-hidden mt-4 px-6 flex flex-col">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 pb-6">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ChatCircle className="w-12 h-12 mx-auto mb-2 opacity-50" weight="light" />
                    <p className="text-sm">{t('No comments yet')}</p>
                  </div>
                ) : (
                  comments.map((comment) => {
                    const isEditing = editingCommentId === comment.id;
                    const isOwnComment = currentUser && comment.userId === currentUser.id;
                    
                    return (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={comment.userAvatar} alt={comment.userName} />
                          <AvatarFallback className="text-xs">{comment.userName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="bg-muted rounded-lg p-3">
                              <Textarea
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                className="min-h-[80px] resize-none mb-2"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleSaveEdit}
                                  disabled={!editingCommentText.trim()}
                                >{t('Save')}</Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                >
                                  <X className="w-4 h-4 mr-1" weight="bold" />{t('Cancel')}</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-muted rounded-lg p-3 group">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{comment.userName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                  </span>
                                </div>
                                {isOwnComment && onEditComment && onDeleteComment && (
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => handleEditComment(comment.id, comment.content)}
                                    >
                                      <PencilSimple className="w-3.5 h-3.5" weight="bold" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => handleDeleteComment(comment.id)}
                                    >
                                      <Trash className="w-3.5 h-3.5" weight="bold" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {currentUser && (
              <div className="pt-4 pb-6 flex-shrink-0">
                <div className="flex gap-2">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                    <AvatarFallback className="text-xs">{currentUser.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-2">
                    <Textarea
                      placeholder={t('Add a comment...')}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="min-h-[80px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                      size="icon"
                      className="flex-shrink-0"
                    >
                      <PaperPlaneTilt className="w-4 h-4" weight="bold" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 ml-10">
                  Press ⌘+Enter to post
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="attachments" className="flex-1 overflow-hidden mt-4 px-6 flex flex-col">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-3 pb-6">
                {attachments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Paperclip className="w-12 h-12 mx-auto mb-2 opacity-50" weight="light" />
                    <p className="text-sm">{t('No attachments yet')}</p>
                  </div>
                ) : (
                  attachments.map((attachment) => {
                    const FileIcon = getFileIcon(attachment.fileType);
                    return (
                      <div key={attachment.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <div className="flex-shrink-0 w-10 h-10 bg-background rounded flex items-center justify-center">
                          <FileIcon className="w-5 h-5 text-muted-foreground" weight="bold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{attachment.fileName}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{formatFileSize(attachment.fileSize)}</span>
                            <span>•</span>
                            <span>by {attachment.uploadedByName}</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(attachment.uploadedAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDownloadAttachment(attachment)}
                          >
                            <DownloadSimple className="w-4 h-4" weight="bold" />
                          </Button>
                          {currentUser && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onDeleteAttachment(task.id, attachment.id)}
                            >
                              <Trash className="w-4 h-4" weight="bold" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            {currentUser && (
              <div className="pt-4 pb-6 flex-shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <UploadSimple className="mr-2 h-4 w-4" weight="bold" />{t('Upload Attachment')}</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-hidden mt-4 px-6">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-3 pb-6">
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClockCounterClockwise className="w-12 h-12 mx-auto mb-2 opacity-50" weight="light" />
                    <p className="text-sm">{t('No activity yet')}</p>
                  </div>
                ) : (
                  activities.map((activity) => {
                    const ActivityIcon = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <ActivityIcon className="w-4 h-4 text-muted-foreground" weight="bold" />
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="text-sm">
                            <span className="font-medium">{activity.userName}</span>
                            {' '}
                            <span className="text-muted-foreground">{getActivityMessage(activity)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
