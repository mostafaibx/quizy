'use client';

import { useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QuizList } from '@/components/quiz-list';
import { QuizGenerationDialog } from '@/components/quiz-generation-dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function QuizzesPage({ params }: PageProps) {
  const { locale } = use(params);
  const t = useTranslations('quiz');
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = searchParams.get('fileId');
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  if (!fileId) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">No file selected</p>
          <Button
            className="mt-4"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleQuizSelect = (quizId: string) => {
    router.push(`/${locale}/dashboard/quiz/${quizId}`);
  };

  const handleGenerateNew = () => {
    setShowGenerateDialog(true);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t('list.title')}</h1>
            <p className="text-muted-foreground">
              {t('list.description')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleGenerateNew}>
              <Sparkles className="mr-2 h-4 w-4" />
              {t('generation.generate')}
            </Button>
          </div>
        </div>
      </div>

      <QuizList
        fileId={fileId}
        onQuizSelect={handleQuizSelect}
        onGenerateNew={handleGenerateNew}
      />

      <QuizGenerationDialog
        fileId={fileId}
        fileName="Document"
        isOpen={showGenerateDialog}
        onClose={() => setShowGenerateDialog(false)}
        onQuizGenerated={(quizId: string) => {
          setShowGenerateDialog(false);
          router.push(`/${locale}/dashboard/quiz/${quizId}`);
        }}
      />
    </div>
  );
}