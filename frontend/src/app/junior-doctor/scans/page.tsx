"use client";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ctScansApi, reportsApi, handleApiError } from "@/lib/api";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { Upload, Zap, FileText, X, ImageIcon, AlertCircle, CheckCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfidenceBarChart } from "@/components/charts/BarChartComponent";
import { formatDateTime, getPredictionColor } from "@/lib/utils";

interface PredictionResult {
  prediction: string;
  confidence: number;
  class_probabilities: Record<string, number>;
  heatmap_generated: boolean;
  timestamp: string;
}

export default function CTScansPage() {
  const qc = useQueryClient();
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [uploadingScanId, setUploadingScanId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-scans"],
    queryFn: () => ctScansApi.list({ page_size: 50 }),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ scanId, file }: { scanId: string; file: File }) =>
      ctScansApi.upload(scanId, file),
    onSuccess: () => {
      toast.success("CT scan uploaded successfully");
      qc.invalidateQueries({ queryKey: ["my-scans"] });
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const predictMutation = useMutation({
    mutationFn: (scanId: string) => ctScansApi.predict(scanId),
    onSuccess: (res) => {
      setPrediction(res.data);
      toast.success(`Prediction: ${res.data.prediction} (${res.data.confidence.toFixed(1)}%)`);
      qc.invalidateQueries({ queryKey: ["my-scans"] });
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const createReportMutation = useMutation({
    mutationFn: ({ scanId, predictionId }: { scanId: string; predictionId: string }) =>
      reportsApi.create({ ct_scan_id: scanId, prediction_id: predictionId, junior_notes: notes }),
    onSuccess: () => {
      toast.success("Report created and submitted for review");
      qc.invalidateQueries({ queryKey: ["my-reports"] });
      setPrediction(null);
      setSelectedScanId(null);
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!uploadingScanId || !acceptedFiles[0]) return;
    uploadMutation.mutate({ scanId: uploadingScanId, file: acceptedFiles[0] });
    setUploadingScanId(null);
  }, [uploadingScanId, uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png"], "application/octet-stream": [".dcm"] },
    maxFiles: 1,
    disabled: !uploadingScanId,
  });

  const scans = data?.data?.scans ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">CT Scan Management</h1>
        <p className="text-muted-foreground text-sm">Upload images and run AI predictions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan List */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-4">Assigned Scans ({scans.length})</h3>
          {isLoading ? <LoadingSpinner /> : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scans.map((scan: any) => (
                <div
                  key={scan.id}
                  className={`p-4 border rounded-xl cursor-pointer transition ${
                    selectedScanId === scan.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                  onClick={() => { setSelectedScanId(scan.id); setPrediction(null); }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{scan.file_name || "Scan Request"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(scan.created_at)}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <StatusBadge status={scan.priority} />
                      <StatusBadge status={scan.status} />
                    </div>
                  </div>

                  {selectedScanId === scan.id && (
                    <div className="mt-3 pt-3 border-t border-border flex gap-2 flex-wrap">
                      {scan.status === "assigned" || scan.status === "pending" ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setUploadingScanId(scan.id); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload Image
                        </button>
                      ) : null}
                      {scan.status === "processing" || scan.status === "predicted" ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); predictMutation.mutate(scan.id); }}
                          disabled={predictMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 rounded-lg text-xs font-medium hover:bg-purple-100 transition disabled:opacity-60"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {predictMutation.isPending ? "Analyzing..." : "Run AI Prediction"}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
              {scans.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">No CT scans assigned</p>
              )}
            </div>
          )}
        </div>

        {/* Right panel: Upload or Prediction */}
        <div className="space-y-4">
          {/* Upload Dropzone */}
          {uploadingScanId && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Upload CT Image</h3>
                <button onClick={() => setUploadingScanId(null)}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                  isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-sm">Drop CT scan image here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports: JPG, PNG, DICOM (.dcm)
                </p>
                {uploadMutation.isPending && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-primary">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prediction Results */}
          {prediction && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                AI Prediction Result
              </h3>

              <div className="text-center p-4 bg-muted/30 rounded-xl mb-4">
                <p className={`text-2xl font-bold ${getPredictionColor(prediction.prediction)}`}>
                  {prediction.prediction}
                </p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {prediction.confidence.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Confidence Score</p>
              </div>

              <div className="h-40 mb-4">
                <ConfidenceBarChart
                  label={prediction.prediction}
                  confidence={prediction.confidence}
                  classProbs={prediction.class_probabilities}
                />
              </div>

              {prediction.prediction !== "No Cancer" && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Cancer detected. Prepare a detailed report for senior doctor review.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">Clinical Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add your clinical observations..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <button
                onClick={() => {
                  // In real flow, we'd have prediction ID from the scan
                  toast("Please use the scan's predict result ID to create report.");
                }}
                className="w-full mt-3 py-2.5 bg-[#1a3c5e] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a42] transition flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" /> Create & Submit Report
              </button>
            </div>
          )}

          {!uploadingScanId && !prediction && (
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm text-center">
              <Scan className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Select a scan to get started</p>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a scan from the list, upload the image, then run AI prediction
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Scan({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  );
}
