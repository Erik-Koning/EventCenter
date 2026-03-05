"use client";

interface DocumentViewerProps {
  fileName: string;
  sasUrl: string;
  contentType: string;
  onClose: () => void;
}

export function DocumentViewer({
  fileName,
  sasUrl,
  contentType,
  onClose,
}: DocumentViewerProps) {
  const isPdf = contentType === "application/pdf";

  // Office Online viewer needs the URL encoded
  const viewerUrl = isPdf
    ? sasUrl
    : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sasUrl)}`;

  return (
    <div className="mt-4 rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>
      <iframe
        src={viewerUrl}
        className="w-full rounded-b-xl"
        style={{ height: 600 }}
        title={fileName}
        allowFullScreen
      />
    </div>
  );
}
