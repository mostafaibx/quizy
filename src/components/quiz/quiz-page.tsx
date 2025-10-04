'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Save, X } from 'lucide-react';
import { QuizViewer } from './quiz-viewer';
import { QuizEditor } from './quiz-editor';
import { useQuiz } from '@/hooks/use-quiz';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QuizPageProps {
  quizId: string;
  locale: string;
}

export function QuizPage({ quizId, locale }: QuizPageProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const router = useRouter();
  const t = useTranslations('quiz');
  const tCommon = useTranslations('common');

  const { quiz, isLoading, error, fetchQuiz } = useQuiz({ quizId });

  useEffect(() => {
    if (quizId) {
      fetchQuiz(quizId);
    }
  }, [quizId, fetchQuiz]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (!confirm(t('editor.unsavedChanges'))) {
        return;
      }
    }
    router.back();
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (!confirm(t('editor.unsavedChanges'))) {
        return;
      }
    }
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    // Refresh quiz data to discard changes
    fetchQuiz(quizId);
  };

  const handleSave = async () => {
    try {
      toast.success(t('editor.saveSuccess'));
      setIsEditMode(false);
      setHasUnsavedChanges(false);
      // Refresh to get latest data
      await fetchQuiz(quizId);
    } catch (error) {
      toast.error(t('editor.saveFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <Button onClick={handleBack} variant="outline" className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {tCommon('back')}
        </Button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Alert>
          <AlertDescription>{t('errors.quizNotFound')}</AlertDescription>
        </Alert>
        <Button onClick={handleBack} variant="outline" className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {tCommon('back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Button onClick={handleBack} variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {tCommon('back')}
        </Button>

        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <Button onClick={handleCancelEdit} variant="outline" size="sm">
                <X className="w-4 h-4 mr-2" />
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleSave} size="sm">
                <Save className="w-4 h-4 mr-2" />
                {tCommon('save')}
              </Button>
            </>
          ) : (
            <Button onClick={handleEdit} size="sm">
              <Edit className="w-4 h-4 mr-2" />
              {t('editor.editQuiz')}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {isEditMode ? (
        <QuizEditor
          quiz={quiz}
          onSave={handleSave}
          onCancel={handleCancelEdit}
          onChanges={() => setHasUnsavedChanges(true)}
        />
      ) : (
        <QuizViewer quiz={quiz} />
      )}
    </div>
  );
}