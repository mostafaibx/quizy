'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Brain,
  Calendar,
  ChevronRight,
  Hash,
  Globe,
  Sparkles,
  FileText,
  Edit,
  Trash2,
} from 'lucide-react';
import { useQuiz } from '@/hooks/use-quiz';
import { formatDistanceToNow as formatDistance } from 'date-fns';

interface QuizListProps {
  fileId: string;
  onQuizSelect?: (quizId: string) => void;
  onGenerateNew?: () => void;
}

export function QuizList({ fileId, onQuizSelect, onGenerateNew }: QuizListProps) {
  const t = useTranslations('quiz');
  const { quizzes, isLoading, error, fetchFileQuizzes } = useQuiz({ fileId });

  useEffect(() => {
    fetchFileQuizzes(fileId);
  }, [fileId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-destructive">{t('errors.loadFailed')}</p>
        </CardContent>
      </Card>
    );
  }

  if (!quizzes || quizzes.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">{t('list.noQuizzes')}</p>
          <p className="text-sm text-muted-foreground mb-6">{t('list.generateFirst')}</p>
          {onGenerateNew && (
            <Button onClick={onGenerateNew}>
              <Sparkles className="mr-2 h-4 w-4" />
              {t('generation.generate')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {quizzes.map((quiz) => (
        <Card
          key={quiz.id}
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onQuizSelect?.(quiz.id)}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  {quiz.metadata?.subject || t('list.untitled')}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDistance(new Date(quiz.createdAt))}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {quiz.questions.length} {t('list.questions')}
                  </span>
                  {quiz.config.language && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {quiz.config.language.toUpperCase()}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(quiz.status)}>
                  {t(`status.${quiz.status}`)}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              {quiz.metadata.fromPage && quiz.metadata.toPage && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {t('list.pages', { from: quiz.metadata.fromPage, to: quiz.metadata.toPage })}
                </span>
              )}
              {quiz.config.difficulty && (
                <Badge variant="secondary" className="text-xs">
                  {t(`generation.difficulties.${quiz.config.difficulty}`)}
                </Badge>
              )}
              {quiz.metadata.model && (
                <Badge variant="outline" className="text-xs">
                  {quiz.metadata.model}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'ready':
      return 'default' as const;
    case 'draft':
      return 'secondary' as const;
    case 'archived':
      return 'outline' as const;
    default:
      return 'default' as const;
  }
}

// Helper function to format relative time
function formatDistanceToNow(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}