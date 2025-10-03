"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fileRpc } from "@/lib/rpc";
import type { FileStatusResponse, ParsedContent } from "@/lib/rpc/files";

interface UploadedFile {
  id: string;
  file: File;
  status: "uploading" | "processing" | "success" | "error";
  progress: number;
  message?: string;
  dbFileId?: string;
  parsedContent?: ParsedContent;
}

interface PdfUploadProps {
  onUploadComplete?: () => void;
}

export function PdfUpload({ onUploadComplete }: PdfUploadProps = {}) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const uploadFile = useCallback(async (uploadedFile: UploadedFile) => {
    try {
      // Start upload
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? { ...f, status: "uploading", progress: 10, message: "Uploading file..." }
            : f
        )
      );

      // Upload and wait for processing
      const result = await fileRpc.uploadAndWait(uploadedFile.file, {
        userId: "test-user-001", // Using test user ID for development
        onProgress: (status: FileStatusResponse) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? {
                    ...f,
                    status: status.status === "completed" ? "success" : "processing",
                    progress: status.progress,
                    message: status.message,
                    dbFileId: status.id,
                  }
                : f
            )
          );
        },
      });

      // Update with final result
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? {
                ...f,
                status: "success",
                progress: 100,
                message: "File processed successfully",
                dbFileId: result.file.id,
                parsedContent: result.content,
              }
            : f
        )
      );

      // Call the upload complete callback if provided
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadedFile.id
            ? {
                ...f,
                status: "error",
                progress: 0,
                message: error instanceof Error ? error.message : "Upload failed",
              }
            : f
        )
      );
    }
  }, [onUploadComplete]);

  const processFiles = useCallback(async (fileList: FileList) => {
    const validFiles = Array.from(fileList).filter((file) => {
      const validTypes = [
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024;
    });

    if (validFiles.length === 0) {
      alert("Please upload valid files (PDF, TXT, DOC, DOCX) under 10MB");
      return;
    }

    const newFiles: UploadedFile[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: "uploading" as const,
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Process each file
    for (const uploadedFile of newFiles) {
      await uploadFile(uploadedFile);
    }
  }, [uploadFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const fileList = e.dataTransfer.files;
      processFiles(fileList);
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  const removeFile = useCallback(async (uploadedFile: UploadedFile) => {
    // If file was uploaded, delete from server
    if (uploadedFile.dbFileId && uploadedFile.status === "success") {
      try {
        await fileRpc.deleteFile(uploadedFile.dbFileId);
      } catch (error) {
        console.error("Failed to delete file from server:", error);
      }
    }

    setFiles((prev) => prev.filter((f) => f.id !== uploadedFile.id));
  }, []);

  const generateQuiz = useCallback(async () => {
    setIsGeneratingQuiz(true);

    try {
      const successfulFiles = files.filter(f => f.status === "success" && f.parsedContent);

      // Here you would call your quiz generation API
      // For now, just log the parsed content
      console.log("Generating quiz from files:", successfulFiles.map(f => ({
        fileId: f.dbFileId,
        fileName: f.file.name,
        content: f.parsedContent
      })));

      // Simulate quiz generation
      await new Promise(resolve => setTimeout(resolve, 2000));

      alert("Quiz generation would happen here with the parsed content!");
    } catch (error) {
      console.error("Failed to generate quiz:", error);
      alert("Failed to generate quiz");
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [files]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "default";
      case "error":
        return "destructive";
      case "processing":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Upload your PDF, TXT, DOC, or DOCX files to generate interactive quizzes using AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              multiple
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="file-upload"
            />
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  Drag and drop files here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse from your computer
                </p>
              </div>
              <Button variant="secondary" className="pointer-events-none">
                Select Files
              </Button>
              <p className="text-xs text-muted-foreground">
                PDF, TXT, DOC, DOCX • Max 10MB per file
              </p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Uploaded Files ({files.length})
              </h3>
              <div className="space-y-2">
                {files.map((uploadedFile) => (
                  <div
                    key={uploadedFile.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {uploadedFile.file.name}
                        </p>
                        <Badge
                          variant={getStatusColor(uploadedFile.status)}
                          className="text-xs"
                        >
                          {uploadedFile.status === "uploading" || uploadedFile.status === "processing"
                            ? `${uploadedFile.progress}%`
                            : uploadedFile.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadedFile.file.size)}
                        {uploadedFile.message && ` • ${uploadedFile.message}`}
                      </p>
                      {(uploadedFile.status === "uploading" || uploadedFile.status === "processing") && (
                        <div className="mt-2 w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-primary h-full transition-all duration-300 ease-out"
                            style={{ width: `${uploadedFile.progress}%` }}
                          />
                        </div>
                      )}
                      {uploadedFile.status === "success" && uploadedFile.parsedContent && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {uploadedFile.parsedContent.pageCount} pages • {(uploadedFile.parsedContent.metadata?.wordCount as number) || 0} words
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {uploadedFile.status === "success" && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {uploadedFile.status === "error" && (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      )}
                      {uploadedFile.status === "processing" && (
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadedFile)}
                        className="h-8 w-8 p-0"
                        disabled={uploadedFile.status === "uploading" || uploadedFile.status === "processing"}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setFiles([])}
                  disabled={files.some((f) => f.status === "uploading" || f.status === "processing")}
                >
                  Clear All
                </Button>
                <Button
                  onClick={generateQuiz}
                  disabled={
                    isGeneratingQuiz ||
                    files.length === 0 ||
                    files.some((f) => f.status !== "success") ||
                    !files.some((f) => f.status === "success")
                  }
                >
                  {isGeneratingQuiz ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Quiz"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}