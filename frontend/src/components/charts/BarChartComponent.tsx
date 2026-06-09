"use client";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Title,
  Tooltip, Legend, ArcElement, LineElement, PointElement, Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { useTheme } from "next-themes";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title,
  Tooltip, Legend, ArcElement, LineElement, PointElement, Filler
);

interface MonthlyChartProps {
  data: Array<{ month: string; scans: number; patients: number }>;
}

export function MonthlyActivityChart({ data }: MonthlyChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const textColor = isDark ? "#9ca3af" : "#6b7280";
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

  return (
    <Bar
      data={{
        labels: data.map((d) => d.month),
        datasets: [
          {
            label: "CT Scans",
            data: data.map((d) => d.scans),
            backgroundColor: "rgba(37, 99, 235, 0.7)",
            borderRadius: 4,
          },
          {
            label: "New Patients",
            data: data.map((d) => d.patients),
            backgroundColor: "rgba(16, 185, 129, 0.7)",
            borderRadius: 4,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, boxRadius: 4 } },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true },
        },
      }}
    />
  );
}

interface CancerDistProps {
  data: Array<{ type: string; count: number }>;
}

const CANCER_COLORS = [
  "rgba(16, 185, 129, 0.8)",
  "rgba(239, 68, 68, 0.8)",
  "rgba(245, 158, 11, 0.8)",
  "rgba(139, 92, 246, 0.8)",
  "rgba(59, 130, 246, 0.8)",
];

export function CancerDistributionChart({ data }: CancerDistProps) {
  return (
    <Doughnut
      data={{
        labels: data.map((d) => d.type),
        datasets: [{
          data: data.map((d) => d.count),
          backgroundColor: CANCER_COLORS,
          borderWidth: 2,
          borderColor: "transparent",
          hoverOffset: 6,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { padding: 16, boxWidth: 12, boxRadius: 4 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw as number) / total * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
              },
            },
          },
        },
        cutout: "65%",
      }}
    />
  );
}

interface ConfidenceChartProps {
  label: string;
  confidence: number;
  classProbs: Record<string, number>;
}

export function ConfidenceBarChart({ label, confidence, classProbs }: ConfidenceChartProps) {
  const entries = Object.entries(classProbs).sort(([, a], [, b]) => b - a);
  const colors = entries.map(([cls]) =>
    cls === label ? "rgba(37, 99, 235, 0.8)" : "rgba(156, 163, 175, 0.5)"
  );

  return (
    <Bar
      data={{
        labels: entries.map(([cls]) => cls),
        datasets: [{
          label: "Confidence (%)",
          data: entries.map(([, v]) => v),
          backgroundColor: colors,
          borderRadius: 4,
        }],
      }}
      options={{
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => ` ${(ctx.raw as number).toFixed(1)}%` },
          },
        },
        scales: {
          x: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } },
        },
      }}
    />
  );
}
