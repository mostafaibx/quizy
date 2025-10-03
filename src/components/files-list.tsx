"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  FileText,
  Download,
  Trash2,
  MoreVertical,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileIcon,
  Calendar,
  HardDrive,
  FileCheck,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { fileRpc } from "@/lib/rpc";
import type { ListFilesResponse } from "@/lib/rpc/files";
import { useTranslations } from "next-intl";

interface FilesListProps {
  userId?: string;
  onFileSelect?: (fileId: string) => void;
  showActions?: boolean;
}

export function FilesList({
  userId = "test-user-001",
  onFileSelect,
  showActions = true
}: FilesListProps) {
  const [files, setFiles] = useState<ListFilesResponse["files"]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);
  const limit = 12;
  const t = useTranslations('files');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fileRpc.listFiles(userId, {
        limit,
        offset,
        status: statusFilter === "all" ? undefined : statusFilter,
      });

      setFiles(response.files);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to fetch files:", err);

      // Handle 404 as empty state, not an error
      if (err instanceof Error && err.message.includes('404')) {
        setFiles([]);
        setTotal(0);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load files");
      }
    } finally {
      setLoading(false);
    }
  }, [userId, offset, statusFilter]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async (fileId: string) => {
    if (!confirm(t('confirmDelete'))) return;

    setDeletingFiles((prev) => new Set(prev).add(fileId));
    try {
      await fileRpc.deleteFile(fileId);
      await fetchFiles();
    } catch (err) {
      console.error("Failed to delete file:", err);
      alert(t('deleteFailed'));
    } finally {
      setDeletingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const fileData = await fileRpc.getFileById(fileId);
      if (fileData.content) {
        // Create a blob with the file content
        const blob = new Blob([fileData.content.text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName.replace(/\.[^/.]+$/, "") + "_content.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to download file:", err);
      alert(t('downloadFailed'));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return t('minutesAgo', { count: diffMins });
    } else if (diffHours < 24) {
      return t('hoursAgo', { count: diffHours });
    } else if (diffHours < 168) {
      const diffDays = Math.floor(diffHours / 24);
      return t('daysAgo', { count: diffDays });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
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

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) {
      return <FileText className="w-8 h-8 text-red-500" />;
    } else if (mimeType.includes("word") || mimeType.includes("document")) {
      return <FileText className="w-8 h-8 text-blue-500" />;
    } else if (mimeType.includes("text")) {
      return <FileIcon className="w-8 h-8 text-gray-500" />;
    }
    return <FileIcon className="w-8 h-8 text-muted-foreground" />;
  };

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileClick = (fileId: string) => {
    const locale = pathname.split('/')[1];
    router.push(`/${locale}/dashboard/files/${fileId}`);
    onFileSelect?.(fileId);
  };

  if (loading && files.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchFiles} className="mt-4">
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>
                {t('filesCount', { count: total })}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full sm:w-[200px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t('filterStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allFiles')}</SelectItem>
                  <SelectItem value="completed">{t('completed')}</SelectItem>
                  <SelectItem value="processing">{t('processing')}</SelectItem>
                  <SelectItem value="pending">{t('pending')}</SelectItem>
                  <SelectItem value="error">{t('error')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <FileIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? t('noFilesMatchSearch')
                  : t('noFiles')}
              </p>
              {!searchQuery && (
                <p className="text-sm text-muted-foreground mt-2">
                  {t('uploadDescription')}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFiles.map((file) => (
                <Card
                  key={file.id}
                  className="group hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => handleFileClick(file.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.mime)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusIcon(file.status)}
                            <Badge
                              variant={getStatusColor(file.status)}
                              className="text-xs"
                            >
                              {t(file.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {showActions && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              disabled={deletingFiles.has(file.id)}
                            >
                              {deletingFiles.has(file.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{tCommon('actions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {file.hasContent && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(file.id, file.name);
                                }}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                {t('downloadContent')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileClick(file.id);
                              }}
                            >
                              <FileCheck className="mr-2 h-4 w-4" />
                              {t('viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(file.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {tCommon('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          <span>{formatFileSize(file.sizeBytes)}</span>
                        </div>
                        {file.pageCount && (
                          <div className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            <span>{t('pagesCount', { count: file.pageCount })}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(file.createdAt)}</span>
                      </div>
                      {file.hasContent && (
                        <div className="flex items-center gap-1 text-green-600">
                          <FileCheck className="w-3 h-3" />
                          <span>{t('contentAvailable')}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {total > limit && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                {tCommon('previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('pageInfo', { current: Math.floor(offset / limit) + 1, total: Math.ceil(total / limit) })}
              </span>
              <Button
                variant="outline"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
              >
                {tCommon('next')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}