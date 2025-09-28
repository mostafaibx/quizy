"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FilesList } from "@/components/files-list";
import { PdfUpload } from "@/components/pdf-upload";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FolderOpen, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function FilesPage() {
  const [activeTab, setActiveTab] = useState("files");
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/files");
    }
  }, [status, router]);

  const handleFileSelect = (fileId: string) => {
    // Navigate to file details or quiz generation page
    router.push(`/files/${fileId}`);
  };

  const handleUploadComplete = () => {
    // Switch to files tab and refresh the list
    setActiveTab("files");
    setRefreshKey((prev) => prev + 1);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">File Manager</h1>
              <p className="text-muted-foreground">
                Manage your uploaded documents and generate quizzes
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              My Files
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload New
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
                <PdfUpload />
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("files")}
                    className="mt-4"
                  >
                    View All Files
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}