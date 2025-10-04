'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Circle, Info } from 'lucide-react';
import type { AIQuestion } from '@/types/ai.types';

interface QuestionViewerProps {
  question: AIQuestion;
  questionNumber: number;
  showExplanation?: boolean;
}

export function QuestionViewer({ question, questionNumber, showExplanation }: QuestionViewerProps) {
  const getQuestionTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      'multiple-choice': 'default',
      'true-false': 'secondary',
      'short-answer': 'outline',
    };
    return variants[type] || 'default';
  };

  const renderAnswer = () => {
    if (question.type === 'multiple-choice') {
      return (
        <div className="space-y-2">
          {question.options?.map((option, index) => {
            const isCorrect = question.correctAnswer === option;
            return (
              <div
                key={index}
                className={`flex items-start gap-2 p-3 rounded-lg border ${
                  isCorrect ? 'bg-green-50 border-green-300' : 'bg-background'
                }`}
              >
                {isCorrect ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />
                )}
                <span className={isCorrect ? 'font-medium' : ''}>{option}</span>
              </div>
            );
          })}
        </div>
      );
    }

    if (question.type === 'true-false') {
      const isTrue = (question.correctAnswer as string).toLowerCase() === 'true';
      return (
        <div className="flex gap-4">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              isTrue ? 'bg-green-50 border-green-300' : 'bg-background'
            }`}
          >
            {isTrue ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
            <span className={isTrue ? 'font-medium' : ''}>True</span>
          </div>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              !isTrue ? 'bg-green-50 border-green-300' : 'bg-background'
            }`}
          >
            {!isTrue ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
            <span className={!isTrue ? 'font-medium' : ''}>False</span>
          </div>
        </div>
      );
    }

    if (question.type === 'short-answer') {
      return (
        <div className="p-3 rounded-lg bg-green-50 border border-green-300">
          <p className="text-sm font-medium text-green-900">Expected Answer:</p>
          <p className="mt-1">{question.correctAnswer}</p>
        </div>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-muted-foreground">
                Question {questionNumber}
              </span>
              <Badge variant={getQuestionTypeBadge(question.type)}>
                {question.type.replace('-', ' ')}
              </Badge>
              {question.difficulty && (
                <Badge variant="outline">{question.difficulty}</Badge>
              )}
            </div>
            <p className="text-base font-medium">{question.question}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderAnswer()}

        {showExplanation && question.explanation && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">Explanation</p>
                <p className="text-sm text-blue-800">{question.explanation}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}