"use client";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ctScansApi, reportsApi, api, handleApiError } from "@/lib/api";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import {
  Upload, Zap, FileText, X, ImageIcon,
  AlertCircle, CheckCircle, ScanLine, Info, AlertTriangle,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfidenceBarChart } from "@/components/charts/BarChartComponent";
import { formatDateTime } from "@/lib/utils";

interface PredictionResult {
  prediction: string;
  confidence: number;
  class_probabilities: Record<string, number>;
  heatmap_generated: boolean;
}

function getPredictionColor(p: string) {
  if (p === "No Cancer" || p === "Normal") return "text-green-600 dark:text-green-400";
  return "text-red-600 dark:text-red-400";
}

export default function CTScansPage() {
  const qc = useQueryClient();
  const [selectedScan, setSelectedScan]   = useState<any>(null);
  const [prediction, setPrediction]       = useState<PredictionResult | null>(null);
  const [predictionId, setPredictionId]   = useState<string | null>(null);
  const [showUpload, setShowUpload]       = useState(false);
  const [notes, setNotes]                 = useState("");
  const [reportCreated, setReportCreated] = useState(false);
  const [uploadError, setUploadError]     = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-scans"],
    queryFn:  () => ctScansApi.list({ page_size: 50 }),
  });
  const scans = data?.data?.scans ?? [];

  // ── Mutations ──────────────────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: ({ scanId, file }: { scanId: string; file: File }) =>
      ctScansApi.upload(scanId, file),
    onSuccess: (res) => {
      setUploadError(null);
      toast.success("CT image validated and uploaded successfully");
      setShowUpload(false);
      setSelectedScan((prev: any) =>
        prev ? { ...prev, status: "processing", file_name: res.data.file_name } : prev
      );
      qc.invalidateQueries({ queryKey: ["my-scans"] });
    },
    onError: (e) => {
      const msg = handleApiError(e);
      setUploadError(msg);
      // Don't show toast — show inline error instead
    },
  });

  const predictMutation = useMutation({
    mutationFn: (scanId: string) => ctScansApi.predict(scanId),
    onSuccess: (res) => {
      setPrediction(res.data);
      ctScansApi.get(selectedScan.id).then(r => setPredictionId(r.data.prediction_id));
      toast.success(`AI Prediction: ${res.data.prediction} (${res.data.confidence.toFixed(1)}%)`);
      qc.invalidateQueries({ queryKey: ["my-scans"] });
    },
    onError: (e) => toast.error(handleApiError(e)),
  });

  const createReportMutation = useMutation({
    mutationFn: () => reportsApi.create({
      ct_scan_id:    selectedScan.id,
      prediction_id: predictionId,
      junior_notes:  notes,
    }),
    onSuccess: () => {
      toast.success("Report created");
      setReportCreated(true);
      qc.invalidateQueries({ queryKey: ["my-scans"] });
    },
    onError: (e) => toast.error(handleApiError(e)),
  });

  const submitReportMutation = useMutation({
    mutationFn: (reportId: string) =>
      reportsApi.submit(reportId, { junior_notes: notes }),
    onSuccess: () => {
      toast.success("Report submitted to Senior Doctor for review");
      setPrediction(null);
      setSelectedScan(null);
      setPredictionId(null);
      setNotes("");
      setReportCreated(false);
      qc.invalidateQueries({ queryKey: ["my-scans"] });
    },
    onError: (e) => toast.error(handleApiError(e)),
  });

  // ── Dropzone ──────────────────────────────────────────────────────────

  const onDrop = useCallback((files: File[]) => {
    if (!selectedScan || !files[0]) return;
    setUploadError(null);
    uploadMutation.mutate({ scanId: selectedScan.id, file: files[0] });
  }, [selectedScan, uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png"], "application/octet-stream": [".dcm"] },
    maxFiles: 1,
    disabled: !showUpload || uploadMutation.isPending,
  });

  const selectScan = (scan: any) => {
    setSelectedScan(scan);
    setPrediction(null);
    setPredictionId(null);
    setShowUpload(scan.status === "assigned" || scan.status === "pending");
    setNotes("");
    setReportCreated(false);
    setUploadError(null);
  };

  const canUpload      = selectedScan && (selectedScan.status === "assigned" || selectedScan.status === "pending");
  const canPredict     = selectedScan && (selectedScan.status === "processing" || selectedScan.status === "predicted");
  const canCreateReport= prediction && predictionId && !reportCreated;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">CT Scan Management</h1>
        <p className="text-muted-foreground text-sm">
          Upload lung CT images · Run AI prediction · Submit reports
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Scan list ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">Assigned Scans ({scans.length})</h3>

          {isLoading ? <LoadingSpinner /> : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {scans.map((scan: any) => (
                <button key={scan.id} onClick={() => selectScan(scan)}
                  className={`w-full text-left p-3 border rounded-xl transition ${
                    selectedScan?.id === scan.id
                      ? "border-[#1a3c5e] bg-[#1a3c5e]/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {scan.file_name || "CT Scan Request"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateTime(scan.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-end flex-shrink-0">
                      <StatusBadge status={scan.priority} />
                      <StatusBadge status={scan.status} />
                    </div>
                  </div>
                </button>
              ))}

              {scans.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <ScanLine className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
                  <p className="text-sm font-medium text-muted-foreground">No scans assigned yet</p>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-left">
                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      CT scan requests are created by the <strong>Receptionist</strong>. Once assigned to you they will appear here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Action panel ───────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {!selectedScan ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center space-y-3">
              <ScanLine className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="font-medium">Select a scan from the list</p>
              <p className="text-sm text-muted-foreground">
                Step 1: Upload the lung CT image<br />
                Step 2: Run AI prediction<br />
                Step 3: Write notes &amp; submit report
              </p>
            </div>
          ) : (
            <>
              {/* Scan info */}
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{selectedScan.file_name || "CT Scan Request"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Patient: {selectedScan.patient_id?.slice(-8)}</p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={selectedScan.priority} />
                    <StatusBadge status={selectedScan.status} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                  {canUpload && (
                    <button onClick={() => { setShowUpload(!showUpload); setUploadError(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {showUpload ? "Hide Upload" : "Upload CT Image"}
                    </button>
                  )}
                  {canPredict && (
                    <button onClick={() => predictMutation.mutate(selectedScan.id)}
                      disabled={predictMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-100 transition disabled:opacity-60"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {predictMutation.isPending ? "Analyzing..." : "Run AI Prediction"}
                    </button>
                  )}
                </div>
              </div>

              {/* Upload dropzone */}
              {showUpload && (
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Upload CT Scan Image</h3>
                    <button onClick={() => { setShowUpload(false); setUploadError(null); }}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>

                  {/* CT scan requirements info */}
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-3 text-xs text-blue-700 dark:text-blue-300">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">Upload Requirements</p>
                      <p>Only valid lung CT scan images are accepted. The image must be <strong>grayscale/near-grayscale</strong> (as produced by a CT scanner). Regular color photos, screenshots, or X-rays will be rejected.</p>
                      <p className="mt-1">Accepted formats: <strong>JPG, PNG, DICOM (.dcm)</strong></p>
                    </div>
                  </div>

                  {/* Upload error */}
                  {uploadError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg mb-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">Invalid Image Rejected</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{uploadError}</p>
                        <p className="text-xs text-red-500 mt-1">Please upload a valid lung CT scan image and try again.</p>
                      </div>
                    </div>
                  )}

                  <div {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                      uploadError
                        ? "border-red-300 bg-red-50/30 dark:border-red-700 dark:bg-red-900/10"
                        : isDragActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/20"
                    }`}
                  >
                    <input {...getInputProps()} />
                    {uploadError ? (
                      <AlertTriangle className="w-10 h-10 mx-auto text-red-400 mb-3" />
                    ) : (
                      <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    )}
                    <p className="text-sm font-medium">
                      {isDragActive
                        ? "Drop it here..."
                        : uploadError
                          ? "Try again — drop a valid CT scan image"
                          : "Drop lung CT scan image here or click to browse"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">JPG · PNG · DICOM (.dcm)</p>
                    {uploadMutation.isPending && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-primary text-sm">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Uploading and validating...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Prediction result */}
              {prediction && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-600" /> AI Prediction Result
                  </h3>

                  <div className={`text-center p-4 rounded-xl mb-4 border ${
                    prediction.prediction === "No Cancer" || prediction.prediction === "Normal"
                      ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                      : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                  }`}>
                    <p className={`text-xl font-bold ${getPredictionColor(prediction.prediction)}`}>
                      {prediction.prediction}
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {prediction.confidence.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">AI Confidence Score</p>
                  </div>

                  <div className="h-44 mb-4">
                    <ConfidenceBarChart
                      label={prediction.prediction}
                      confidence={prediction.confidence}
                      classProbs={prediction.class_probabilities}
                    />
                  </div>

                  {prediction.prediction !== "No Cancer" && prediction.prediction !== "Normal" ? (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4 text-xs text-amber-700 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Cancer indicators detected — Type: {prediction.prediction}</p>
                        <p>Document your clinical observations and submit for Senior Doctor review.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-4 text-xs text-green-700 dark:text-green-300">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">No cancer detected</p>
                        <p>Submit a report with healthy lifestyle recommendations for the patient.</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Clinical Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                      placeholder="Document your clinical observations, patient symptoms, relevant history..."
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  {canCreateReport && (
                    <button onClick={() => createReportMutation.mutate()}
                      disabled={createReportMutation.isPending || !notes.trim()}
                      className="w-full mt-3 py-2.5 bg-[#1a3c5e] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a42] transition disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {createReportMutation.isPending
                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</>
                        : <><FileText className="w-4 h-4" />Create Report</>}
                    </button>
                  )}

                  {reportCreated && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-700 dark:text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        Report created. Submit to Senior Doctor for final review and publication.
                      </div>
                      <button
                        onClick={() =>
                          ctScansApi.get(selectedScan.id).then(r => {
                            if (r.data.report_id) submitReportMutation.mutate(r.data.report_id);
                            else toast.error("Report ID not found — refresh and try again");
                          })
                        }
                        disabled={submitReportMutation.isPending}
                        className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {submitReportMutation.isPending
                          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</>
                          : <><CheckCircle className="w-4 h-4" />Submit to Senior Doctor</>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
