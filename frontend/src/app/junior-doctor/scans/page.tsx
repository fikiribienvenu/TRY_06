"use client";
import { useState, useCallback, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ctScansApi, reportsApi, api, handleApiError } from "@/lib/api";
import { useDropzone } from "react-dropzone";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  Upload, Zap, FileText, X, ImageIcon, AlertCircle,
  CheckCircle, ScanLine, Info, Microscope, Eye, Filter,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfidenceBarChart } from "@/components/charts/BarChartComponent";
import { formatDateTime } from "@/lib/utils";
import { CANCER_CRITERIA } from "@/lib/cancer-criteria";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PredictionResult {
  prediction_id: string;
  prediction: string;
  confidence: number;
  class_probabilities: Record<string, number>;
  heatmap_generated: boolean;
  heatmap_url: string | null;
}

function getPredictionColor(p: string) {
  if (p === "No Cancer" || p === "Normal") return "text-green-600 dark:text-green-400";
  return "text-red-600 dark:text-red-400";
}

function CTScansPageInner() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const patientIdFromUrl = searchParams.get("patient_id");

  const [selectedScan, setSelectedScan]     = useState<any>(null);
  const [prediction, setPrediction]         = useState<PredictionResult | null>(null);
  const [predictionId, setPredictionId]     = useState<string | null>(null);
  const [showUpload, setShowUpload]         = useState(false);
  const [notes, setNotes]                   = useState("");
  const [reportCreated, setReportCreated]   = useState(false);
  const [showAllScans, setShowAllScans]     = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-scans"],
    queryFn:  () => ctScansApi.list({ page_size: 50 }),
  });
  const allScans: any[] = data?.data?.scans ?? [];

  // When a patient_id filter is active, show only that patient's scans
  // unless the user toggled "show all"
  const scans = patientIdFromUrl && !showAllScans
    ? allScans.filter((s: any) => s.patient_id === patientIdFromUrl)
    : allScans;

  // Auto-select when scans load and a patient_id is in the URL
  useEffect(() => {
    if (!patientIdFromUrl || selectedScan || allScans.length === 0) return;
    const match = allScans.find((s: any) => s.patient_id === patientIdFromUrl);
    if (match) selectScan(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allScans.length, patientIdFromUrl]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: ({ scanId, file }: { scanId: string; file: File }) =>
      ctScansApi.upload(scanId, file),
    onSuccess: (res) => {
      toast.success("CT image uploaded");
      setShowUpload(false);
      setSelectedScan((prev: any) =>
        prev ? { ...prev, status: "processing", file_name: res.data.file_name } : prev
      );
      qc.invalidateQueries({ queryKey: ["my-scans"] });
    },
    onError: (e) => toast.error(handleApiError(e)),
  });

  const predictMutation = useMutation({
    mutationFn: (scanId: string) => ctScansApi.predict(scanId),
    onSuccess: (res) => {
      setPrediction(res.data);
      setPredictionId(res.data.prediction_id ?? null);
      toast.success(`Prediction: ${res.data.prediction} (${res.data.confidence.toFixed(1)}%)`);
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
      toast.success("Report submitted for Senior Doctor review");
      setPrediction(null);
      setSelectedScan(null);
      setPredictionId(null);
      setNotes("");
      setReportCreated(false);
      qc.invalidateQueries({ queryKey: ["my-scans"] });
    },
    onError: (e) => toast.error(handleApiError(e)),
  });

  // ── Dropzone ──────────────────────────────────────────────────────────────

  const onDrop = useCallback((files: File[]) => {
    if (!selectedScan || !files[0]) return;
    uploadMutation.mutate({ scanId: selectedScan.id, file: files[0] });
  }, [selectedScan, uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png"], "application/octet-stream": [".dcm"] },
    maxFiles: 1,
    disabled: !showUpload,
  });

  const selectScan = (scan: any) => {
    setSelectedScan(scan);
    setPrediction(null);
    setPredictionId(null);
    setShowUpload(scan.status === "assigned" || scan.status === "pending");
    setNotes("");
    setReportCreated(false);
  };

  const canUpload      = selectedScan && (selectedScan.status === "assigned" || selectedScan.status === "pending");
  const canPredict     = selectedScan && (selectedScan.status === "processing" || selectedScan.status === "predicted");
  const canCreateReport= prediction && predictionId && !reportCreated;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">CT Scan Management</h1>
        <p className="text-muted-foreground text-sm">
          Upload lung CT images, run AI prediction, and submit reports for senior review
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left: Scan list ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">
              {patientIdFromUrl && !showAllScans
                ? `Patient's Scans (${scans.length})`
                : `All Assigned Scans (${allScans.length})`}
            </h3>
            {patientIdFromUrl && (
              <button
                onClick={() => setShowAllScans(v => !v)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Filter className="w-3 h-3" />
                {showAllScans ? "This patient only" : "Show all"}
              </button>
            )}
          </div>

          {/* Active filter banner */}
          {patientIdFromUrl && !showAllScans && (
            <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
              <Filter className="w-3 h-3 flex-shrink-0" />
              Showing scans for selected patient
            </div>
          )}

          {isLoading ? <LoadingSpinner /> : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {scans.map((scan: any) => (
                <button
                  key={scan.id}
                  onClick={() => selectScan(scan)}
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

              {scans.length === 0 && patientIdFromUrl && !showAllScans ? (
                <div className="text-center py-8 space-y-3">
                  <ScanLine className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No scan assigned for this patient yet
                  </p>
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-left">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      The <strong>Receptionist</strong> must create a CT scan request for this patient
                      and assign it to you before you can upload and analyze it.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAllScans(true)}
                    className="text-xs text-primary underline"
                  >
                    View all assigned scans
                  </button>
                </div>
              ) : scans.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <ScanLine className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
                  <p className="text-sm font-medium text-muted-foreground">No scans assigned yet</p>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-left">
                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      CT scan requests are created by the <strong>Receptionist</strong>.
                      Once created and assigned to you, they will appear here for upload and analysis.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Right: Action panel ──────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {!selectedScan ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center space-y-3">
              <ScanLine className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="font-medium">Select a scan from the list</p>
              <p className="text-sm text-muted-foreground">
                Step 1: Upload the CT image<br />
                Step 2: Run AI prediction<br />
                Step 3: Write notes &amp; submit report
              </p>
            </div>
          ) : (
            <>
              {/* Scan info bar */}
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {selectedScan.file_name || "CT Scan Request"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Patient ID: {selectedScan.patient_id?.slice(-8)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={selectedScan.priority} />
                    <StatusBadge status={selectedScan.status} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                  {canUpload && (
                    <button
                      onClick={() => setShowUpload(!showUpload)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {showUpload ? "Hide Upload" : "Upload CT Image"}
                    </button>
                  )}
                  {canPredict && (
                    <button
                      onClick={() => predictMutation.mutate(selectedScan.id)}
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
                    <h3 className="font-semibold text-sm">Upload CT Image</h3>
                    <button onClick={() => setShowUpload(false)}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                      isDragActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/20"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">
                      {isDragActive ? "Drop it here" : "Drop CT image here or click to browse"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supported: JPG, PNG, DICOM (.dcm)
                    </p>
                    {uploadMutation.isPending && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-primary text-sm">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Prediction result */}
              {prediction && (() => {
                const criteria = CANCER_CRITERIA[prediction.prediction];
                const isNormal = prediction.prediction === "No Cancer" || prediction.prediction === "Normal";
                return (
                <div className="space-y-4">

                  {/* ── Result card ── */}
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-purple-600" /> AI Prediction Result
                    </h3>

                    <div className={`text-center p-4 rounded-xl mb-4 border ${
                      isNormal
                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                        : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                    }`}>
                      <p className={`text-xl font-bold ${getPredictionColor(prediction.prediction)}`}>
                        {prediction.prediction}
                      </p>
                      <p className="text-3xl font-bold text-foreground mt-1">
                        {prediction.confidence.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">AI Confidence</p>
                    </div>

                    {/* Confidence chart */}
                    <div className="h-44 mb-4">
                      <ConfidenceBarChart
                        label={prediction.prediction}
                        confidence={prediction.confidence}
                        classProbs={prediction.class_probabilities}
                      />
                    </div>

                    {/* Grad-CAM heatmap */}
                    {prediction.heatmap_url && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> Grad-CAM Attention Map
                        </p>
                        <img
                          src={`${API_URL}${prediction.heatmap_url}`}
                          alt="Grad-CAM heatmap — highlighted regions show where the model focused"
                          className="w-full rounded-lg border border-border"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Warm colours (red/yellow) = regions the model weighted most heavily in its decision.
                        </p>
                      </div>
                    )}

                    {!isNormal ? (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Cancer indicators detected — Type: {prediction.prediction}</p>
                          <p>Document your clinical observations and submit for senior doctor review.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-700 dark:text-green-300">
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">No cancer detected</p>
                          <p>Submit a report including healthy lifestyle recommendations for the patient.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Model decision basis ── */}
                  {criteria && (
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                      <h3 className="font-semibold mb-1 flex items-center gap-2 text-sm">
                        <Microscope className="w-4 h-4 text-blue-600" />
                        Model Classification Basis
                        <span className="ml-auto text-xs font-normal text-muted-foreground">
                          What the AI was trained to detect
                        </span>
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">{criteria.description}</p>

                      <div className="space-y-1.5 mb-3">
                        {criteria.features.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px] ${
                              isNormal ? "bg-green-500" : "bg-[#1a3c5e]"
                            }`}>
                              {i + 1}
                            </span>
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>

                      <div className={`p-2.5 rounded-lg text-xs border ${
                        isNormal
                          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                          : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                      }`}>
                        <strong>Imaging note:</strong> {criteria.imagingClue}
                      </div>

                      <p className="text-xs text-muted-foreground mt-2 italic">
                        Use these criteria in your clinical notes to help the Senior Doctor verify the model's reasoning.
                      </p>
                    </div>
                  )}

                  {/* ── Notes + submit ── */}
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">

                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Clinical Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Document observations, symptoms, relevant patient history..."
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  {canCreateReport && (
                    <button
                      onClick={() => createReportMutation.mutate()}
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
                        Report created. Submit it to the Senior Doctor for final review.
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
              </div>
              );
            })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CTScansPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><LoadingSpinner /></div>}>
      <CTScansPageInner />
    </Suspense>
  );
}
