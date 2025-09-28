import { PdfUpload } from "@/components/pdf-upload";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center">
      <div className="container py-8 md:py-12">
        <div className="flex flex-col items-center space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
              Quizy
            </h1>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
              Transform your PDF documents into interactive quizzes with the power of AI.
              Upload, analyze, and learn smarter.
            </p>
          </div>
          <PdfUpload />
          <div className="flex gap-4">
            <Link href="/files">
              <Button variant="outline" size="lg">
                <FolderOpen className="w-4 h-4 mr-2" />
                View All Files
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
