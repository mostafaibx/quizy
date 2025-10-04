'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Save, Trash2, Plus, X } from 'lucide-react';
import type { AIQuestion } from '@/types/ai.types';

interface QuestionEditorProps {
  question: AIQuestion;
  questionNumber: number;
  onUpdate: (updates: Partial<AIQuestion>) => void;
  onDelete: () => void;
  isSaving?: boolean;
}

export function QuestionEditor({
  question,
  questionNumber,
  onUpdate,
  onDelete,
  isSaving = false,
}: QuestionEditorProps) {
  const [editedQuestion, setEditedQuestion] = useState<AIQuestion>(question);
  const [hasChanges, setHasChanges] = useState(false);
  const t = useTranslations('quiz');

  const handleChange = (field: keyof AIQuestion, value: string | string[] | number | boolean) => {
    setEditedQuestion(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...(editedQuestion.options || [])];
    newOptions[index] = value;
    handleChange('options', newOptions);
  };

  const handleAddOption = () => {
    const newOptions = [...(editedQuestion.options || []), `Option ${(editedQuestion.options?.length || 0) + 1}`];
    handleChange('options', newOptions);
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = (editedQuestion.options || []).filter((_, i) => i !== index);
    handleChange('options', newOptions);

    // Update correct answer if it was removed
    if (editedQuestion.correctAnswer === editedQuestion.options?.[index]) {
      handleChange('correctAnswer', newOptions[0] || '');
    }
  };

  const handleSave = () => {
    onUpdate(editedQuestion);
    setHasChanges(false);
  };

  const renderAnswerEditor = () => {
    if (editedQuestion.type === 'multiple-choice') {
      return (
        <div className="space-y-4">
          <Label>{t('editor.options')}</Label>
          <RadioGroup
            value={editedQuestion.correctAnswer as string}
            onValueChange={(value: string) => handleChange('correctAnswer', value)}
          >
            {editedQuestion.options?.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <RadioGroupItem value={option} id={`option-${index}`} />
                <Input
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="flex-1"
                  placeholder={`Option ${index + 1}`}
                />
                {(editedQuestion.options?.length || 0) > 2 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveOption(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </RadioGroup>
          {(editedQuestion.options?.length || 0) < 6 && (
            <Button size="sm" variant="outline" onClick={handleAddOption}>
              <Plus className="h-4 w-4 mr-2" />
              {t('editor.addOption')}
            </Button>
          )}
        </div>
      );
    }

    if (editedQuestion.type === 'true-false') {
      return (
        <div>
          <Label>{t('editor.correctAnswer')}</Label>
          <RadioGroup
            value={(editedQuestion.correctAnswer as string)?.toLowerCase()}
            onValueChange={(value: string) => handleChange('correctAnswer', value)}
            className="flex gap-4 mt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id="true" />
              <Label htmlFor="true">True</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id="false" />
              <Label htmlFor="false">False</Label>
            </div>
          </RadioGroup>
        </div>
      );
    }

    if (editedQuestion.type === 'short-answer') {
      return (
        <div>
          <Label htmlFor="correct-answer">{t('editor.expectedAnswer')}</Label>
          <Textarea
            id="correct-answer"
            value={editedQuestion.correctAnswer}
            onChange={(e) => handleChange('correctAnswer', e.target.value)}
            placeholder={t('editor.expectedAnswerPlaceholder')}
            rows={3}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              Question {questionNumber}
            </span>
            <Badge>{editedQuestion.type.replace('-', ' ')}</Badge>
            {hasChanges && (
              <Badge variant="outline" className="bg-yellow-50">
                {t('editor.unsaved')}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? t('editor.saving') : t('common.save')}
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={onDelete}
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Question Type */}
        <div>
          <Label htmlFor={`type-${questionNumber}`}>{t('editor.questionType')}</Label>
          <Select
            value={editedQuestion.type}
            onValueChange={(value: string) => handleChange('type', value)}
          >
            <SelectTrigger id={`type-${questionNumber}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple-choice">{t('generation.types.multipleChoice')}</SelectItem>
              <SelectItem value="true-false">{t('generation.types.trueFalse')}</SelectItem>
              <SelectItem value="short-answer">{t('generation.types.shortAnswer')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Question Text */}
        <div>
          <Label htmlFor={`question-${questionNumber}`}>{t('editor.questionText')}</Label>
          <Textarea
            id={`question-${questionNumber}`}
            value={editedQuestion.question}
            onChange={(e) => handleChange('question', e.target.value)}
            placeholder={t('editor.questionPlaceholder')}
            rows={3}
          />
        </div>

        {/* Answer Editor */}
        {renderAnswerEditor()}

        {/* Explanation */}
        <div>
          <Label htmlFor={`explanation-${questionNumber}`}>{t('editor.explanation')}</Label>
          <Textarea
            id={`explanation-${questionNumber}`}
            value={editedQuestion.explanation || ''}
            onChange={(e) => handleChange('explanation', e.target.value)}
            placeholder={t('editor.explanationPlaceholder')}
            rows={2}
          />
        </div>

        {/* Difficulty */}
        <div>
          <Label htmlFor={`difficulty-${questionNumber}`}>{t('editor.difficulty')}</Label>
          <Select
            value={editedQuestion.difficulty || 'medium'}
            onValueChange={(value: string) => handleChange('difficulty', value)}
          >
            <SelectTrigger id={`difficulty-${questionNumber}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">{t('generation.difficulties.easy')}</SelectItem>
              <SelectItem value="medium">{t('generation.difficulties.medium')}</SelectItem>
              <SelectItem value="hard">{t('generation.difficulties.hard')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}