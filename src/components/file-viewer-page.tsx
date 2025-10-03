"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Download,
  Copy,
  ArrowLeft,
  Calendar,
  HardDrive,
  FileIcon,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileCheck,
} from "lucide-react";
import { fileRpc } from "@/lib/rpc";
import type { FileWithContent } from "@/lib/rpc/files";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";

interface FileViewerPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export function FileViewerPage({ params }: FileViewerPageProps) {
  const { id, locale } = use(params);
  const [fileData, setFileData] = useState<FileWithContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('fileViewer');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    fetchFileData();
  }, [id]);

  const fetchFileData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fileRpc.getFileById(id);
      setFileData(data);
    } catch (err) {
      console.error("Failed to fetch file data:", err);
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyContent = async () => {
    if (!fileData?.content?.text) return;

    try {
      await navigator.clipboard.writeText(fileData.content.text);
      toast({
        title: t('copySuccess'),
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: t('copyError'),
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleDownload = () => {
    if (!fileData?.content?.text || !fileData.file.name) return;

    const blob = new Blob([fileData.content.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileData.file.name.replace(/\.[^/.]+$/, "") + "_content.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: t('downloadStarted'),
      duration: 2000,
    });
  };

  const handleBack = () => {
    router.push(`/${locale}/dashboard`);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "error":
        return "destructive";
      case "processing":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={handleBack} variant="outline" className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {tCommon('back')}
        </Button>
      </div>
    );
  }

  if (!fileData) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Button onClick={handleBack} variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {tNav('files')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6" />
                <CardTitle>{fileData.file.name}</CardTitle>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(fileData.file.status)}
                  <Badge variant={getStatusColor(fileData.file.status)}>
                    {t(`status.${fileData.file.status}`)}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  {formatFileSize(fileData.file.sizeBytes)}
                </span>
                {fileData.file.pageCount && (
                  <>
                    <span className="text-sm text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">
                      {t('pages', { count: fileData.file.pageCount })}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {fileData.content && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCopyContent}>
                    <Copy className="w-4 h-4 mr-2" />
                    {tCommon('copy')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    {tCommon('download')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('uploadedAt')}</p>
              <p className="text-sm font-medium">{formatDate(fileData.file.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('updatedAt')}</p>
              <p className="text-sm font-medium">{formatDate(fileData.file.updatedAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('mimeType')}</p>
              <p className="text-sm font-medium">{fileData.file.mimeType}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('fileSize')}</p>
              <p className="text-sm font-medium">{formatFileSize(fileData.file.sizeBytes)}</p>
            </div>
          </div>

          {fileData.content ? (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-3">{t('parsedContent')}</h3>
                <ScrollArea className="h-[500px] w-full rounded-md border p-4 bg-muted/20">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {fileData.content.text}
                  </pre>
                </ScrollArea>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileCheck className="w-3 h-3" />
                <span>{t('parsedAt', { date: formatDate(fileData.content.parsedAt) })}</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 border rounded-lg bg-muted/20">
              {fileData.file.status === 'processing' ? (
                <>
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-lg font-medium">{t('processingContent')}</p>
                  <Button onClick={fetchFileData} variant="outline">
                    {tCommon('refresh')}
                  </Button>
                </>
              ) : fileData.file.status === 'error' ? (
                <>
                  <AlertCircle className="w-12 h-12 text-destructive" />
                  <p className="text-lg font-medium">{t('errorContent')}</p>
                  {fileData.file.message && (
                    <p className="text-sm text-destructive text-center max-w-md">
                      {fileData.file.message}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <FileIcon className="w-12 h-12 text-muted-foreground" />
                  <p className="text-lg font-medium">{t('noContent')}</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}