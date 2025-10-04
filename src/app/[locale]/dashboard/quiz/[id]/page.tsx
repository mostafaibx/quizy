import { QuizPage } from '@/components/quiz/quiz-page';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id, locale } = await params;

  return <QuizPage quizId={id} locale={locale} />;
}