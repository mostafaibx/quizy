"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { FilesList } from "@/components/files-list";
import { PdfUpload } from "@/components/pdf-upload";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FolderOpen, Home } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("files");
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('dashboard');

  const handleFileSelect = (fileId: string) => {
    // Navigate to file details or quiz generation page
    router.push(`/${locale}/dashboard/files/${fileId}`);
  };

  const handleUploadComplete = () => {
    // Switch to files tab and refresh the list
    setActiveTab("files");
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${locale}`}>
            <Button variant="ghost" size="sm">
              <Home className="w-4 h-4 mr-2" />
              {t('backToHome')}
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="files" className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            {t('myFiles')}
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {t('uploadNew')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-6">
          <FilesList
            key={refreshKey}
            onFileSelect={handleFileSelect}
            showActions={true}
          />
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          <div className="flex justify-center">
            <div className="w-full max-w-4xl">
              <PdfUpload onUploadComplete={handleUploadComplete} />
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("files")}
                  className="mt-4"
                >
                  {t('viewAllFiles')}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}