"use client";

import { useCallback, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@common/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@common/components/ui/Table";
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type ImportType = "attendees" | "sessions";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
  eventId: string;
  onSuccess: () => void;
}

const ATTENDEE_COLUMNS = ["name", "email", "title", "company", "initials", "isSpeaker", "bio"] as const;
const SESSION_COLUMNS = ["title", "date", "startTime", "endTime", "description", "location", "track", "speakers"] as const;
const REQUIRED_ATTENDEE = ["name", "email", "title", "company"];
const REQUIRED_SESSION = ["title", "date", "startTime", "endTime"];

// Friendly display names for CSV template headers
const ATTENDEE_TEMPLATE_HEADERS: Record<string, string> = {
  name: "Name",
  email: "Email",
  title: "Job Title",
  company: "Company",
  initials: "Initials (2 chars)",
  isSpeaker: "Speaker (TRUE/FALSE)",
  bio: "Bio",
};
const SESSION_TEMPLATE_HEADERS: Record<string, string> = {
  title: "Session Title",
  date: "Date (YYYY-MM-DD)",
  startTime: "Start Time (HH:MM)",
  endTime: "End Time (HH:MM)",
  description: "Description",
  location: "Room / Location",
  track: "Track (Leadership|Technology|Strategy|Innovation|Culture)",
  speakers: "Speakers (comma-separated full names)",
};

// Map friendly header names back to API field names
const HEADER_ALIASES: Record<string, string> = {};
for (const [key, friendly] of Object.entries({ ...ATTENDEE_TEMPLATE_HEADERS, ...SESSION_TEMPLATE_HEADERS })) {
  HEADER_ALIASES[friendly.toLowerCase()] = key;
}

interface ImportResult {
  imported: number;
  skipped?: number;
  errors: string[];
}

export function ImportDialog({ open, onOpenChange, type, eventId, onSuccess }: ImportDialogProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [validationError, setValidationError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const expectedColumns = type === "attendees" ? ATTENDEE_COLUMNS : SESSION_COLUMNS;
  const requiredColumns = type === "attendees" ? REQUIRED_ATTENDEE : REQUIRED_SESSION;

  const reset = () => {
    setRows([]);
    setColumns([]);
    setFileName("");
    setValidationError("");
    setResult(null);
  };

  const validateColumns = (headers: string[]): string | null => {
    const normalized = headers.map((h) => h.trim().toLowerCase());
    const missing = requiredColumns.filter(
      (req) => !normalized.includes(req.toLowerCase())
    );
    if (missing.length > 0) {
      return `Missing required columns: ${missing.join(", ")}`;
    }
    return null;
  };

  const normalizeHeaders = (headers: string[]): string[] => {
    return headers.map((h) => {
      const lower = h.trim().toLowerCase();
      // Map common variations
      const match = [...expectedColumns].find((c) => c.toLowerCase() === lower);
      return match ?? h.trim();
    });
  };

  const processData = (rawRows: Record<string, string>[], rawHeaders: string[]) => {
    const headers = normalizeHeaders(rawHeaders);
    const error = validateColumns(headers);
    if (error) {
      setValidationError(error);
      setRows([]);
      setColumns([]);
      return;
    }
    setValidationError("");

    // Re-key rows with normalized headers
    const normalized = rawRows.map((row) => {
      const out: Record<string, string> = {};
      rawHeaders.forEach((origKey, i) => {
        out[headers[i]] = row[origKey] ?? "";
      });
      return out;
    }).filter((row) => Object.values(row).some((v) => v.trim() !== ""));

    setColumns(headers);
    setRows(normalized);
  };

  const handleFile = useCallback((file: File) => {
    reset();
    setFileName(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields ?? [];
          processData(results.data as Record<string, string>[], headers);
        },
        error: () => {
          setValidationError("Failed to parse CSV file.");
        },
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
          const headers = json.length > 0 ? Object.keys(json[0]) : [];
          processData(json, headers);
        } catch {
          setValidationError("Failed to parse Excel file.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setValidationError("Unsupported file type. Please use .csv, .xlsx, or .xls files.");
    }
  }, [type]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const headers = [...expectedColumns].join(",");
    const blob = new Blob([headers + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    setImporting(true);
    setResult(null);

    try {
      const endpoint =
        type === "attendees"
          ? "/api/admin/attendees/import"
          : "/api/admin/sessions/import";

      const payload =
        type === "attendees"
          ? { eventId, attendees: rows }
          : { eventId, sessions: rows };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data: ImportResult = await res.json();
        setResult(data);
        if (data.imported > 0) {
          onSuccess();
        }
      } else {
        const errData = await res.json().catch(() => null);
        setResult({
          imported: 0,
          errors: [errData?.message ?? `Import failed (${res.status})`],
        });
      }
    } catch {
      setResult({ imported: 0, errors: ["Network error. Please try again."] });
    } finally {
      setImporting(false);
    }
  };

  const previewRows = rows.slice(0, 5);
  const displayColumns = columns.filter((c) =>
    [...expectedColumns].map((e) => e.toLowerCase()).includes(c.toLowerCase())
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl rounded-lg max-h-[85vh] overflow-y-auto space-y-4">
        <DialogHeader>
          <DialogTitle>
            Import {type === "attendees" ? "Attendees" : "Sessions"}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to bulk import{" "}
            {type === "attendees" ? "attendees" : "sessions"}.
          </DialogDescription>
        </DialogHeader>

        {/* Template download */}
        <button
          type="button"
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline space-y-4"
        >
          <Download className="h-3.5 w-3.5" />
          Download CSV template
        </button>

        {/* Drop zone */}
        {!result && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            {fileName ? (
              <>
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium">{fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {rows.length} rows parsed. Click to replace.
                </span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Drag & drop a .csv, .xlsx, or .xls file here
                </span>
                <span className="text-xs text-muted-foreground">or click to browse</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        )}

        {/* Validation error */}
        {validationError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {validationError}
          </div>
        )}

        {/* Preview table */}
        {previewRows.length > 0 && !result && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Preview ({Math.min(5, rows.length)} of {rows.length} rows)
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {displayColumns.map((col) => (
                      <TableHead key={col} className="text-xs whitespace-nowrap">
                        {col}
                        {requiredColumns.includes(col) && (
                          <span className="text-destructive">*</span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {displayColumns.map((col) => (
                        <TableCell key={col} className="text-xs max-w-[150px] truncate">
                          {row[col] || "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Result summary */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>
                Imported <strong>{result.imported}</strong>
                {result.skipped ? `, Skipped ${result.skipped}` : ""}
              </span>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/50 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Issues:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="justify-center">
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={rows.length === 0 || importing || !!validationError}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${rows.length} ${type === "attendees" ? "Attendees" : "Sessions"}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
