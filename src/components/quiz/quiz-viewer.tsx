'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { QuestionViewer } from './question-viewer';
import type { QuizDocument } from '@/types/quiz.types';
import { Brain, Calendar, FileText, Globe, Hash, Clock } from 'lucide-react';

interface QuizViewerProps {
  quiz: QuizDocument;
}

export function QuizViewer({ quiz }: QuizViewerProps) {
  const t = useTranslations('quiz');

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Brain className="h-6 w-6" />
                {quiz.metadata?.subject || t('viewer.untitledQuiz')}
              </CardTitle>
              <CardDescription className="mt-2">
                {quiz.metadata?.description || t('viewer.noDescription')}
              </CardDescription>
            </div>
            <Badge variant={quiz.status === 'ready' ? 'default' : 'secondary'}>
              {t(`status.${quiz.status}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span>{quiz.questions.length} {t('viewer.questions')}</span>
            </div>
            {quiz.config.difficulty && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{t(`generation.difficulties.${quiz.config.difficulty}`)}</span>
              </div>
            )}
            {quiz.config.language && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span>{quiz.config.language.toUpperCase()}</span>
              </div>
            )}
            {quiz.metadata?.fromPage && quiz.metadata?.toPage && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Pages {quiz.metadata.fromPage}-{quiz.metadata.toPage}</span>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              <span>{t('viewer.createdOn', { date: formatDate(quiz.createdAt) })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('viewer.questions')}</h2>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {quiz.questions.map((question, index) => (
              <QuestionViewer
                key={question.id}
                question={question}
                questionNumber={index + 1}
                showExplanation={quiz.config.includeExplanations}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}