'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Sparkles } from 'lucide-react';
import { quizRpc } from '@/lib/rpc/quiz';
import { toast } from 'sonner';

interface QuizGenerationDialogProps {
  fileId: string;
  fileName: string;
  totalPages?: number;
  isOpen: boolean;
  onClose: () => void;
  onQuizGenerated?: (quizId: string) => void;
}

export function QuizGenerationDialog({
  fileId,
  fileName,
  totalPages = 1,
  isOpen,
  onClose,
  onQuizGenerated,
}: QuizGenerationDialogProps) {
  const t = useTranslations('quiz');

  const [isGenerating, setIsGenerating] = useState(false);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(totalPages);
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [language, setLanguage] = useState('en');
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [questionTypes, setQuestionTypes] = useState({
    'multiple-choice': true,
    'true-false': true,
    'short-answer': false,
  });

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);

      // Prepare selected question types
      const selectedTypes = Object.entries(questionTypes)
        .filter(([_, selected]) => selected)
        .map(([type]) => type) as Array<'multiple-choice' | 'true-false' | 'short-answer'>;

      if (selectedTypes.length === 0) {
        toast.error(t('errors.selectQuestionTypes'));
        return;
      }

      // Generate quiz
      const response = await quizRpc.generateQuiz({
        fileId,
        fromPage,
        toPage,
        config: {
          numQuestions,
          difficulty,
          questionTypes: selectedTypes,
          language,
          includeExplanations,
        },
      });

      toast.success(t('generation.started'));

      // Poll for job status
      const pollJobStatus = async (jobId: string) => {
        const maxAttempts = 60; // 5 minutes max
        let attempts = 0;

        const checkStatus = async (): Promise<void> => {
          try {
            const status = await quizRpc.getJobStatus(jobId);

            if (status.data.status === 'completed') {
              toast.success(t('generation.completed'));
              if (status.data.metadata?.quizId && onQuizGenerated) {
                onQuizGenerated(status.data.metadata.quizId);
              }
              onClose();
              return;
            }

            if (status.data.status === 'failed') {
              toast.error(status.data.error || t('errors.generationFailed'));
              setIsGenerating(false);
              return;
            }

            // Continue polling if still processing
            if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkStatus, 5000); // Check every 5 seconds
            } else {
              toast.error(t('errors.timeout'));
              setIsGenerating(false);
            }
          } catch (error) {
            console.error('Error checking job status:', error);
            toast.error(t('errors.statusCheckFailed'));
            setIsGenerating(false);
          }
        };

        // Start polling after 2 seconds
        setTimeout(checkStatus, 2000);
      };

      await pollJobStatus(response.jobId);

    } catch (error) {
      console.error('Error generating quiz:', error);
      toast.error(error instanceof Error ? error.message : t('errors.generationFailed'));
      setIsGenerating(false);
    }
  };

  const handlePageChange = (type: 'from' | 'to', value: string) => {
    const page = parseInt(value, 10);
    if (isNaN(page)) return;

    if (type === 'from') {
      setFromPage(Math.max(1, Math.min(page, totalPages)));
      if (page > toPage) {
        setToPage(page);
      }
    } else {
      setToPage(Math.max(1, Math.min(page, totalPages)));
      if (page < fromPage) {
        setFromPage(page);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t('generation.title')}
          </DialogTitle>
          <DialogDescription>
            {t('generation.description', { fileName })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Page Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="from-page">{t('generation.fromPage')}</Label>
              <Input
                id="from-page"
                type="number"
                min={1}
                max={totalPages}
                value={fromPage}
                onChange={(e) => handlePageChange('from', e.target.value)}
                disabled={isGenerating}
              />
            </div>
            <div>
              <Label htmlFor="to-page">{t('generation.toPage')}</Label>
              <Input
                id="to-page"
                type="number"
                min={1}
                max={totalPages}
                value={toPage}
                onChange={(e) => handlePageChange('to', e.target.value)}
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Number of Questions */}
          <div>
            <Label htmlFor="num-questions">{t('generation.numQuestions')}</Label>
            <Input
              id="num-questions"
              type="number"
              min={5}
              max={50}
              value={numQuestions}
              onChange={(e) => setNumQuestions(parseInt(e.target.value, 10) || 10)}
              disabled={isGenerating}
            />
          </div>

          {/* Difficulty */}
          <div>
            <Label htmlFor="difficulty">{t('generation.difficulty')}</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)} disabled={isGenerating}>
              <SelectTrigger id="difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">{t('generation.difficulties.easy')}</SelectItem>
                <SelectItem value="medium">{t('generation.difficulties.medium')}</SelectItem>
                <SelectItem value="hard">{t('generation.difficulties.hard')}</SelectItem>
                <SelectItem value="mixed">{t('generation.difficulties.mixed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div>
            <Label htmlFor="language">{t('generation.language')}</Label>
            <Select value={language} onValueChange={setLanguage} disabled={isGenerating}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Question Types */}
          <div>
            <Label>{t('generation.questionTypes')}</Label>
            <div className="space-y-2 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="multiple-choice"
                  checked={questionTypes['multiple-choice']}
                  onCheckedChange={(checked) =>
                    setQuestionTypes(prev => ({ ...prev, 'multiple-choice': checked as boolean }))
                  }
                  disabled={isGenerating}
                />
                <Label htmlFor="multiple-choice" className="font-normal cursor-pointer">
                  {t('generation.types.multipleChoice')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="true-false"
                  checked={questionTypes['true-false']}
                  onCheckedChange={(checked) =>
                    setQuestionTypes(prev => ({ ...prev, 'true-false': checked as boolean }))
                  }
                  disabled={isGenerating}
                />
                <Label htmlFor="true-false" className="font-normal cursor-pointer">
                  {t('generation.types.trueFalse')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="short-answer"
                  checked={questionTypes['short-answer']}
                  onCheckedChange={(checked) =>
                    setQuestionTypes(prev => ({ ...prev, 'short-answer': checked as boolean }))
                  }
                  disabled={isGenerating}
                />
                <Label htmlFor="short-answer" className="font-normal cursor-pointer">
                  {t('generation.types.shortAnswer')}
                </Label>
              </div>
            </div>
          </div>

          {/* Include Explanations */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="explanations"
              checked={includeExplanations}
              onCheckedChange={(checked) => setIncludeExplanations(checked as boolean)}
              disabled={isGenerating}
            />
            <Label htmlFor="explanations" className="font-normal cursor-pointer">
              {t('generation.includeExplanations')}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('generation.generating')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {t('generation.generate')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}