'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { QuestionEditor } from './question-editor';
import { useQuiz } from '@/hooks/use-quiz';
import type { QuizDocument } from '@/types/quiz.types';
import type { AIQuestion } from '@/types/ai.types';
import { Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface QuizEditorProps {
  quiz: QuizDocument;
  onSave: () => void;
  onCancel: () => void;
  onChanges: () => void;
}

export function QuizEditor({ quiz, onSave, onCancel, onChanges }: QuizEditorProps) {
  const [editedQuiz, setEditedQuiz] = useState<QuizDocument>(quiz);
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const t = useTranslations('quiz');
  const { updateQuiz, updateQuestion, addQuestion, deleteQuestion } = useQuiz({ quizId: quiz.id });

  const handleMetadataChange = (field: string, value: string | string[] | number | boolean) => {
    setEditedQuiz(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [field]: value,
      },
    }));
    onChanges();
  };

  const handleQuestionUpdate = useCallback(async (questionIndex: number, updates: Partial<AIQuestion>) => {
    try {
      setSavingStates(prev => ({ ...prev, [`q-${questionIndex}`]: true }));
      await updateQuestion(quiz.id, questionIndex, updates);

      // Update local state
      setEditedQuiz(prev => ({
        ...prev,
        questions: prev.questions.map((q, i) =>
          i === questionIndex ? { ...q, ...updates } : q
        ),
      }));

      toast.success(t('editor.questionUpdated'));
    } catch (error) {
      toast.error(t('editor.updateFailed'));
    } finally {
      setSavingStates(prev => ({ ...prev, [`q-${questionIndex}`]: false }));
    }
  }, [quiz.id, updateQuestion, t]);

  const handleQuestionDelete = useCallback(async (questionIndex: number) => {
    if (!confirm(t('editor.confirmDeleteQuestion'))) {
      return;
    }

    try {
      setSavingStates(prev => ({ ...prev, [`q-${questionIndex}`]: true }));
      await deleteQuestion(quiz.id, questionIndex);

      // Update local state
      setEditedQuiz(prev => ({
        ...prev,
        questions: prev.questions.filter((_, i) => i !== questionIndex),
      }));

      toast.success(t('editor.questionDeleted'));
    } catch (error) {
      toast.error(t('editor.deleteFailed'));
    } finally {
      setSavingStates(prev => ({ ...prev, [`q-${questionIndex}`]: false }));
    }
  }, [quiz.id, deleteQuestion, t]);

  const handleAddQuestion = useCallback(async () => {
    const newQuestion: Omit<AIQuestion, 'id'> = {
      type: 'multiple-choice',
      question: t('editor.newQuestionTitle'),
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: '',
      difficulty: 'medium',
    };

    try {
      setSavingStates(prev => ({ ...prev, 'add-question': true }));
      const response = await addQuestion(quiz.id, newQuestion);

      // Update local state
      setEditedQuiz(prev => ({
        ...prev,
        questions: [...prev.questions, { ...newQuestion, id: response.questionId }],
      }));

      toast.success(t('editor.questionAdded'));
      onChanges();
    } catch (error) {
      toast.error(t('editor.addFailed'));
    } finally {
      setSavingStates(prev => ({ ...prev, 'add-question': false }));
    }
  }, [quiz.id, addQuestion, t, onChanges]);

  const handleSaveMetadata = async () => {
    try {
      setSavingStates(prev => ({ ...prev, 'metadata': true }));
      await updateQuiz(quiz.id, { metadata: editedQuiz.metadata });
      toast.success(t('editor.metadataUpdated'));
      onSave();
    } catch (error) {
      toast.error(t('editor.saveFailed'));
    } finally {
      setSavingStates(prev => ({ ...prev, 'metadata': false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Quiz Metadata Editor */}
      <Card>
        <CardHeader>
          <CardTitle>{t('editor.quizDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="subject">{t('editor.subject')}</Label>
              <Input
                id="subject"
                value={editedQuiz.metadata?.subject || ''}
                onChange={(e) => handleMetadataChange('subject', e.target.value)}
                placeholder={t('editor.subjectPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="grade">{t('editor.grade')}</Label>
              <Input
                id="grade"
                value={editedQuiz.metadata?.grade || ''}
                onChange={(e) => handleMetadataChange('grade', e.target.value)}
                placeholder={t('editor.gradePlaceholder')}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">{t('editor.description')}</Label>
            <Input
              id="description"
              value={editedQuiz.metadata?.description || ''}
              onChange={(e) => handleMetadataChange('description', e.target.value)}
              placeholder={t('editor.descriptionPlaceholder')}
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveMetadata}
              disabled={savingStates['metadata']}
            >
              <Save className="w-4 h-4 mr-2" />
              {savingStates['metadata'] ? t('editor.saving') : t('editor.saveDetails')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Questions Editor */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t('editor.questions')} ({editedQuiz.questions.length})
          </h2>
          <Button
            size="sm"
            onClick={handleAddQuestion}
            disabled={savingStates['add-question']}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('editor.addQuestion')}
          </Button>
        </div>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {editedQuiz.questions.map((question, index) => (
              <QuestionEditor
                key={question.id}
                question={question}
                questionNumber={index + 1}
                onUpdate={(updates) => handleQuestionUpdate(index, updates)}
                onDelete={() => handleQuestionDelete(index)}
                isSaving={savingStates[`q-${index}`]}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}