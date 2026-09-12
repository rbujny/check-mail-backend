export const renderDashboardHtml = (): string => {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CheckMail Admin | Security Telemetry Console</title>
  
  <!-- Typography: Inter (UI Sans) + JetBrains Mono (Technical Monospace) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">

  <!-- Core Libraries: React 18, ReactDOM 18, Babel Standalone, Chart.js -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

  <!-- Tailwind CSS CDN with Strict Technical Color Tokens -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
            mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
          },
          colors: {
            brand: {
              steel: '#3b82f6',
            },
            status: {
              phishing: '#dc2626',      /* Deep vermilion / brick red */
              'phishing-subtle': 'rgba(220, 38, 38, 0.12)',
              'phishing-border': 'rgba(220, 38, 38, 0.3)',
              warning: '#d97706',       /* Muted industrial amber */
              'warning-subtle': 'rgba(217, 119, 6, 0.12)',
              'warning-border': 'rgba(217, 119, 6, 0.3)',
              safe: '#16a34a',          /* Restrained forest emerald */
              'safe-subtle': 'rgba(22, 163, 74, 0.12)',
              'safe-border': 'rgba(22, 163, 74, 0.3)',
            }
          }
        }
      }
    };
  </script>

  <style>
    /* Reset & Base System */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #09090b;
      color: #f4f4f5;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overflow-x: hidden;
    }

    /* Enforce tabular alignment for numbers across metrics and logs */
    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }

    /* Hairline technical scrollbar */
    ::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    ::-webkit-scrollbar-track {
      background: #09090b;
    }
    ::-webkit-scrollbar-thumb {
      background: #27272a;
      border-radius: 2px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #3f3f46;
    }

    /* Chart tooltips reset */
    .chartjs-tooltip {
      font-family: 'JetBrains Mono', monospace !important;
      font-size: 11px !important;
    }
  </style>
</head>
<body class="bg-[#09090b] text-zinc-100 min-h-screen">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    // Formatting Utilities
    const formatNumber = (num) => new Intl.NumberFormat().format(num || 0);

    const formatTime = (dateStr) => {
      try {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit', 
          month: 'short', 
          day: 'numeric' 
        });
      } catch (e) {
        return dateStr;
      }
    };

    // --- Header Component ---
    function Header({ statusData, fetchError, range, onRangeChange, onRefresh, isRefreshing, lastRefreshed }) {
      const dbStatus = statusData?.dbStatus || (fetchError ? 'error' : null);
      const statusConfig = (() => {
        if (fetchError) return { dot: 'bg-red-500', label: 'DB_ERROR', title: fetchError };
        if (!statusData) return { dot: 'bg-blue-500 animate-pulse', label: 'LOADING', title: 'Fetching telemetry...' };
        switch (dbStatus) {
          case 'connected': return { dot: 'bg-emerald-500', label: 'LIVE', title: 'Connected to Cloud SQL' };
          case 'connected_empty': return { dot: 'bg-zinc-400', label: 'NO_DATA', title: 'Connected — table is empty. Send some emails through /process.' };
          case 'no_config': return { dot: 'bg-amber-500', label: 'NO_DB_CONFIG', title: 'DB env vars not set (local mode)' };
          case 'error': return { dot: 'bg-red-500', label: 'DB_ERROR', title: statusData?.error || 'Database query failed' };
          default: return { dot: 'bg-zinc-500', label: 'UNKNOWN', title: 'Unknown database status' };
        }
      })();

      return (
        <header class="sticky top-0 z-30 h-12 border-b border-zinc-800 bg-[#09090b] px-4 flex items-center justify-between select-none">
          <div class="flex items-center gap-3">
            {/* Minimalist terminal/shield brand glyph */}
            <div class="w-6 h-6 rounded-[4px] border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="font-mono text-xs font-semibold tracking-wider text-zinc-100 uppercase">
                CHECKMAIL_ADMIN
              </span>
              <span class="hidden md:inline font-mono text-[10px] text-zinc-400 tracking-wider">
                // TELEMETRY & SECURITY OPS
              </span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            {/* Database Connection Status Indicator */}
            <div class="inline-flex items-center gap-1.5 px-2 py-0.5 border border-zinc-800 rounded-[4px] bg-zinc-900/90 text-[11px] font-mono text-zinc-300 cursor-help" title={statusConfig.title}>
              <span class={'w-1.5 h-1.5 rounded-full ' + statusConfig.dot}></span>
              <span>{statusConfig.label}</span>
            </div>

            {/* Time Window Switcher */}
            <div class="inline-flex border border-zinc-800 rounded-[4px] p-0.5 bg-zinc-950">
              {['all', '30d', '7d', '24h'].map((r) => (
                <button
                  key={r}
                  onClick={() => onRangeChange(r)}
                  class={'px-2 py-0.5 text-[11px] font-mono uppercase rounded-[3px] transition-colors ' +
                    (range === r 
                      ? 'bg-zinc-800 text-zinc-100 font-medium' 
                      : 'text-zinc-300 hover:text-zinc-100')}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Sync / Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Poll telemetry data"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono border border-zinc-700 hover:border-zinc-500 active:bg-zinc-800 bg-zinc-900 text-zinc-200 rounded-[4px] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <svg 
                class={'w-3 h-3 ' + (isRefreshing ? 'animate-spin text-zinc-300' : 'text-zinc-400')} 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              <span>{isRefreshing ? 'SYNCING' : 'REFRESH'}</span>
            </button>
          </div>
        </header>
      );
    }

    // --- High-Density KPI Card ---
    function MetricCard({ label, value, subLeft, subRight, variant }) {
      const valueColor = 
        variant === 'danger' ? 'text-red-400' :
        variant === 'warning' ? 'text-amber-400' :
        variant === 'safe' ? 'text-emerald-400' :
        'text-zinc-100';

      return (
        <div class="border border-zinc-800 bg-[#121215] p-2.5 rounded-[4px] flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div class="flex items-center justify-between text-[10px] tracking-wider text-zinc-400 uppercase font-mono mb-1">
            <span>{label}</span>
          </div>
          <div class={'text-xl font-semibold font-mono tracking-tight tabular-nums my-0.5 ' + valueColor}>
            {value}
          </div>
          <div class="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/60 mt-1">
            <span>{subLeft}</span>
            {subRight && <span class="text-zinc-400">{subRight}</span>}
          </div>
        </div>
      );
    }

    // --- Scan Activity Timeline Chart (Stacked Squares, Hairline Grid) ---
    function TimelineChart({ timeline }) {
      const canvasRef = useRef(null);
      const chartInstance = useRef(null);

      useEffect(() => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (chartInstance.current) chartInstance.current.destroy();

        const labels = (timeline || []).map(t => t.date);

        chartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Phishing',
                data: (timeline || []).map(t => t.phishing),
                backgroundColor: '#dc2626',
                borderColor: '#09090b',
                borderWidth: 1,
                borderRadius: 0,
                stack: 'stack'
              },
              {
                label: 'Warning',
                data: (timeline || []).map(t => t.warning),
                backgroundColor: '#d97706',
                borderColor: '#09090b',
                borderWidth: 1,
                borderRadius: 0,
                stack: 'stack'
              },
              {
                label: 'Safe',
                data: (timeline || []).map(t => t.ok),
                backgroundColor: '#16a34a',
                borderColor: '#09090b',
                borderWidth: 1,
                borderRadius: 0,
                stack: 'stack'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
              x: {
                stacked: true,
                grid: { display: false },
                ticks: { 
                  color: '#71717a', 
                  font: { family: 'JetBrains Mono', size: 10 } 
                }
              },
              y: {
                stacked: true,
                beginAtZero: true,
                grid: { 
                  color: 'rgba(255, 255, 255, 0.04)', 
                  borderDash: [3, 3],
                  drawBorder: false
                },
                ticks: { 
                  color: '#71717a', 
                  font: { family: 'JetBrains Mono', size: 10 } 
                }
              }
            },
            plugins: {
              legend: {
                position: 'top',
                align: 'end',
                labels: { 
                  color: '#a1a1aa', 
                  boxWidth: 10, 
                  boxHeight: 10, 
                  font: { family: 'JetBrains Mono', size: 11 },
                  padding: 12
                }
              },
              tooltip: {
                backgroundColor: '#18181b',
                borderColor: '#27272a',
                borderWidth: 1,
                titleColor: '#f4f4f5',
                bodyColor: '#a1a1aa',
                titleFont: { family: 'JetBrains Mono', size: 11 },
                bodyFont: { family: 'JetBrains Mono', size: 11 },
                padding: 8,
                cornerRadius: 4
              }
            }
          }
        });

        return () => {
          if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
          }
        };
      }, [timeline]);

      return (
        <div class="border border-zinc-800 bg-[#121215] p-3 rounded-[4px] flex flex-col h-[320px]">
          <div class="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-[2px] bg-zinc-500"></span>
              <span class="text-[11px] font-semibold tracking-wider text-zinc-200 uppercase font-mono">
                SCAN_ACTIVITY_TIMELINE
              </span>
            </div>
            <span class="text-[10px] font-mono text-zinc-400">STACKED DISPOSITION</span>
          </div>
          <div class="relative flex-1 w-full min-h-0">
            <canvas ref={canvasRef}></canvas>
          </div>
        </div>
      );
    }

    // --- Verdict Distribution (Horizontal Segmented Bar + Tabular Breakdown) ---
    function VerdictDistributionCard({ overview }) {
      const o = overview || { okCount: 0, warningCount: 0, phishingCount: 0, totalScans: 0, okRate: 0, warningRate: 0, phishingRate: 0 };
      const total = o.totalScans || 1;
      const okPct = o.totalScans ? ((o.okCount / total) * 100).toFixed(1) : '0.0';
      const warnPct = o.totalScans ? ((o.warningCount / total) * 100).toFixed(1) : '0.0';
      const phishPct = o.totalScans ? ((o.phishingCount / total) * 100).toFixed(1) : '0.0';

      const canvasRef = useRef(null);
      const chartInstance = useRef(null);

      useEffect(() => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (chartInstance.current) chartInstance.current.destroy();

        chartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Safe', 'Warning', 'Phishing'],
            datasets: [{
              data: [o.okCount, o.warningCount, o.phishingCount],
              backgroundColor: ['#16a34a', '#d97706', '#dc2626'],
              borderColor: '#09090b',
              borderWidth: 2,
              hoverOffset: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            cutout: '84%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#18181b',
                borderColor: '#27272a',
                borderWidth: 1,
                titleFont: { family: 'JetBrains Mono', size: 11 },
                bodyFont: { family: 'JetBrains Mono', size: 11 },
                padding: 8,
                cornerRadius: 4
              }
            }
          }
        });

        return () => {
          if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
          }
        };
      }, [o.okCount, o.warningCount, o.phishingCount]);

      return (
        <div class="border border-zinc-800 bg-[#121215] p-3 rounded-[4px] flex flex-col justify-between h-[320px]">
          <div>
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80">
              <span class="text-[11px] font-semibold tracking-wider text-zinc-200 uppercase font-mono">
                VERDICT_DISTRIBUTION
              </span>
              <span class="text-[10px] font-mono text-zinc-400">RATIO RATINGS</span>
            </div>

            {/* Segmented Horizontal Distribution Bar */}
            <div class="mb-4">
              <div class="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1">
                <span>SEGMENTED PROPORTIONS</span>
                <span>{formatNumber(o.totalScans)} TOTAL</span>
              </div>
              <div class="w-full h-2 rounded-[2px] bg-zinc-900 flex overflow-hidden border border-zinc-800">
                <div style={{ width: okPct + '%' }} class="bg-status-safe h-full" title={'Safe: ' + okPct + '%'}></div>
                <div style={{ width: warnPct + '%' }} class="bg-status-warning h-full" title={'Warning: ' + warnPct + '%'}></div>
                <div style={{ width: phishPct + '%' }} class="bg-status-phishing h-full" title={'Phishing: ' + phishPct + '%'}></div>
              </div>
            </div>

            {/* Mini Donut + Tabular Alignment */}
            <div class="grid grid-cols-2 gap-2 items-center my-2">
              <div class="h-28 relative flex items-center justify-center">
                <canvas ref={canvasRef}></canvas>
                <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span class="text-[10px] font-mono text-zinc-400">TOTAL</span>
                  <span class="font-mono text-xs font-semibold text-zinc-200 tabular-nums">{formatNumber(o.totalScans)}</span>
                </div>
              </div>

              <div class="space-y-1.5 text-xs font-mono">
                <div class="flex items-center justify-between border-b border-zinc-800/60 pb-1">
                  <span class="flex items-center gap-1.5 text-emerald-400">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Safe
                  </span>
                  <span class="tabular-nums text-zinc-300">{formatNumber(o.okCount)} ({okPct}%)</span>
                </div>
                <div class="flex items-center justify-between border-b border-zinc-800/60 pb-1">
                  <span class="flex items-center gap-1.5 text-amber-400">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Warning
                  </span>
                  <span class="tabular-nums text-zinc-300">{formatNumber(o.warningCount)} ({warnPct}%)</span>
                </div>
                <div class="flex items-center justify-between border-b border-zinc-800/60 pb-1">
                  <span class="flex items-center gap-1.5 text-red-400">
                    <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    Phishing
                  </span>
                  <span class="tabular-nums text-zinc-300">{formatNumber(o.phishingCount)} ({phishPct}%)</span>
                </div>
              </div>
            </div>
          </div>

          <div class="text-[10px] font-mono text-zinc-400 border-t border-zinc-800/80 pt-2 flex justify-between">
            <span>LLM BYPASS SHIELD</span>
            <span class="text-zinc-300 font-semibold">{o.heuristicShieldRate || 0}% TRAFFIC</span>
          </div>
        </div>
      );
    }

    // --- Model Breakdown & Inference Latency (Crisp Bar + Thin 1.5px Line) ---
    function ModelLatencyChart({ models }) {
      const canvasRef = useRef(null);
      const chartInstance = useRef(null);

      useEffect(() => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (chartInstance.current) chartInstance.current.destroy();

        const labels = (models || []).map(m => m.model);

        chartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Scans Handled',
                data: (models || []).map(m => m.count),
                backgroundColor: '#3b82f6',
                borderRadius: 0,
                yAxisID: 'y',
                barPercentage: 0.5
              },
              {
                label: 'Latency (ms)',
                data: (models || []).map(m => m.avgDurationMs),
                type: 'line',
                borderColor: '#d4d4d8',
                backgroundColor: '#d4d4d8',
                borderWidth: 1.5,
                pointRadius: 2.5,
                pointHoverRadius: 4,
                tension: 0,
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: '#71717a', font: { family: 'JetBrains Mono', size: 10 } }
              },
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.04)', borderDash: [3, 3], drawBorder: false },
                ticks: { color: '#71717a', font: { family: 'JetBrains Mono', size: 10 } },
                title: { display: true, text: 'Requests', color: '#71717a', font: { family: 'JetBrains Mono', size: 10 } }
              },
              y1: {
                beginAtZero: true,
                position: 'right',
                grid: { drawOnChartArea: false },
                ticks: { color: '#d4d4d8', font: { family: 'JetBrains Mono', size: 10 } },
                title: { display: true, text: 'Latency (ms)', color: '#d4d4d8', font: { family: 'JetBrains Mono', size: 10 } }
              }
            },
            plugins: {
              legend: {
                position: 'top',
                align: 'end',
                labels: { color: '#a1a1aa', boxWidth: 10, font: { family: 'JetBrains Mono', size: 11 } }
              },
              tooltip: {
                backgroundColor: '#18181b',
                borderColor: '#27272a',
                borderWidth: 1,
                titleFont: { family: 'JetBrains Mono', size: 11 },
                bodyFont: { family: 'JetBrains Mono', size: 11 },
                padding: 8,
                cornerRadius: 4
              }
            }
          }
        });

        return () => {
          if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
          }
        };
      }, [models]);

      return (
        <div class="border border-zinc-800 bg-[#121215] p-3 rounded-[4px] flex flex-col h-[280px]">
          <div class="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80">
            <span class="text-[11px] font-semibold tracking-wider text-zinc-200 uppercase font-mono">
              INFERENCE_ENGINE_METRICS
            </span>
            <span class="text-[10px] font-mono text-zinc-400">VOLUME VS INFERENCE LATENCY</span>
          </div>
          <div class="relative flex-1 w-full min-h-0">
            <canvas ref={canvasRef}></canvas>
          </div>
        </div>
      );
    }

    // --- Top Security Signals (Tabular hits with 2px hairline spark-meters) ---
    function TopSignalsCard({ findings }) {
      const list = findings || [];
      const maxCount = useMemo(() => Math.max(...list.map(f => f.count), 1), [list]);

      return (
        <div class="border border-zinc-800 bg-[#121215] p-3 rounded-[4px] flex flex-col h-[280px]">
          <div class="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80">
            <span class="text-[11px] font-semibold tracking-wider text-zinc-200 uppercase font-mono">
              SECURITY_RULES_TRIGGERED
            </span>
            <span class="text-[10px] font-mono text-zinc-400">FREQUENCY RANK</span>
          </div>

          <div class="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {list.length === 0 ? (
              <div class="text-zinc-500 text-xs font-mono py-8 text-center">
                NO_SECURITY_TRIGGERS_RECORDED
              </div>
            ) : (
              list.map((sig, idx) => {
                const pct = Math.min(100, Math.round((sig.count / maxCount) * 100));
                return (
                  <div key={sig.code || idx} class="flex flex-col gap-1">
                    <div class="flex items-center justify-between text-xs">
                      <div class="flex items-center gap-2 truncate pr-2">
                        <span class="font-mono text-[11px] text-zinc-400">[{sig.code}]</span>
                        <span class="text-zinc-200 truncate text-[11px]">{sig.label}</span>
                      </div>
                      <span class="font-mono tabular-nums text-zinc-300 text-[11px] shrink-0 font-medium">
                        {sig.count} <span class="text-zinc-400 font-normal">hits</span>
                      </span>
                    </div>
                    {/* Ultra-thin 2px progress bar with squared corners */}
                    <div class="w-full h-[2px] bg-zinc-800 rounded-none overflow-hidden">
                      <div 
                        style={{ width: pct + '%' }} 
                        class="h-full bg-zinc-300"
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    }

    // --- Live Scans Feed & Table (36px high-density rows, border-only badges) ---
    function ScansFeed({ scans, onInspect }) {
      const [filter, setFilter] = useState('ALL');
      const [search, setSearch] = useState('');

      const filteredScans = useMemo(() => {
        let result = scans || [];
        if (filter !== 'ALL') {
          result = result.filter(s => s.finalResult === filter);
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          result = result.filter(s => 
            (s.id && s.id.toLowerCase().includes(q)) ||
            (s.comment && s.comment.toLowerCase().includes(q)) ||
            (s.model && s.model.toLowerCase().includes(q))
          );
        }
        return result;
      }, [scans, filter, search]);

      const handleExport = () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredScans, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', 'checkmail-audit-' + new Date().toISOString().slice(0, 10) + '.json');
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      };

      return (
        <div class="border border-zinc-800 bg-[#121215] rounded-[4px] overflow-hidden flex flex-col">
          {/* Table Header & Toolbar */}
          <div class="px-3 py-2 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2.5 bg-zinc-900/40">
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-semibold tracking-wider text-zinc-200 uppercase font-mono">
                TELEMETRY_LOG_FEED
              </span>
              <span class="text-[10px] font-mono text-zinc-400">
                ({filteredScans.length} RECORDS)
              </span>
            </div>

            <div class="flex items-center flex-wrap gap-2">
              {/* Verdict Filter Segmented Group */}
              <div class="inline-flex border border-zinc-800 rounded-[3px] p-0.5 bg-zinc-950">
                {['ALL', 'PHISHING', 'WARNING', 'OK'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    class={'px-2 py-0.5 text-[10px] font-mono uppercase rounded-[2px] transition-colors ' +
                      (filter === tab 
                        ? 'bg-zinc-800 text-zinc-100 font-medium' 
                        : 'text-zinc-300 hover:text-zinc-100')}
                  >
                    {tab === 'OK' ? 'SAFE' : tab}
                  </button>
                ))}
              </div>

              {/* Text Search Field */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search comment or ID..."
                class="h-7 px-2 text-[11px] font-mono bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-[3px] text-zinc-200 placeholder:text-zinc-600 outline-none w-48 transition-colors"
              />

              {/* JSON Export Action */}
              <button
                onClick={handleExport}
                class="h-7 px-2.5 text-[11px] font-mono border border-zinc-700 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 rounded-[3px] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>EXPORT</span>
              </button>
            </div>
          </div>

          {/* Compressed High-Density Log Table */}
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr class="h-8 border-b border-zinc-800 bg-zinc-950 text-[10px] font-mono text-zinc-400 uppercase tracking-wider select-none">
                  <th class="px-3">TIMESTAMP</th>
                  <th class="px-3">DISPOSITION</th>
                  <th class="px-3">ROUTE</th>
                  <th class="px-3">SCORE</th>
                  <th class="px-3">MODEL</th>
                  <th class="px-3">CONF</th>
                  <th class="px-3">LATENCY</th>
                  <th class="px-3">ASSESSMENT_SUMMARY</th>
                  <th class="px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/40">
                {filteredScans.length === 0 ? (
                  <tr>
                    <td colSpan="9" class="h-16 text-center text-zinc-500 font-mono text-xs">
                      NO_RECORDS_FOUND
                    </td>
                  </tr>
                ) : (
                  filteredScans.map((scan) => {
                    const isPhish = scan.finalResult === 'PHISHING';
                    const isWarn = scan.finalResult === 'WARNING';
                    const isOk = scan.finalResult === 'OK';

                    const verdictStyle = 
                      isPhish ? 'border-red-900/60 text-red-400 bg-red-950/20' :
                      isWarn ? 'border-amber-900/60 text-amber-400 bg-amber-950/20' :
                      'border-emerald-900/60 text-emerald-400 bg-emerald-950/20';

                    const dotColor = 
                      isPhish ? 'bg-red-500' :
                      isWarn ? 'bg-amber-500' :
                      'bg-emerald-500';

                    const routeStyle = scan.route === 'heuristic'
                      ? 'border-zinc-700 text-zinc-300'
                      : 'border-blue-900/60 text-blue-300 bg-blue-950/20';

                    const confFormatted = scan.confidence !== null && scan.confidence !== undefined 
                      ? Math.round(scan.confidence * 100) + '%' 
                      : '-';

                    return (
                      <tr 
                        key={scan.id} 
                        class="h-9 hover:bg-zinc-900/50 transition-colors group"
                      >
                        <td class="px-3 font-mono text-[11px] text-zinc-400 tabular-nums whitespace-nowrap">
                          {formatTime(scan.createdAt)}
                        </td>
                        <td class="px-3 whitespace-nowrap">
                          <span class={'inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-mono border rounded-[3px] ' + verdictStyle}>
                            <span class={'w-1.5 h-1.5 rounded-full ' + dotColor}></span>
                            {scan.finalResult}
                          </span>
                        </td>
                        <td class="px-3 whitespace-nowrap">
                          <span class={'px-1.5 py-0.5 text-[10px] font-mono border rounded-[3px] ' + routeStyle}>
                            {scan.route === 'heuristic' ? 'HEURISTIC' : 'LLM'}
                          </span>
                        </td>
                        <td class="px-3 font-mono text-[11px] text-zinc-300 tabular-nums">
                          {scan.heuristicScore}
                        </td>
                        <td class="px-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                          {scan.model || (scan.route === 'heuristic' ? 'rule_filter' : '-')}
                        </td>
                        <td class="px-3 font-mono text-[11px] text-zinc-300 tabular-nums">
                          {confFormatted}
                        </td>
                        <td class="px-3 font-mono text-[11px] text-zinc-400 tabular-nums">
                          {scan.durationMs}ms
                        </td>
                        <td class="px-3 max-w-xs truncate text-[11px] text-zinc-300 font-sans" title={scan.comment}>
                          {scan.comment}
                        </td>
                        <td class="px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => onInspect(scan)}
                            class="px-2 py-0.5 text-[10px] font-mono border border-zinc-700 hover:border-zinc-500 rounded-[3px] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                          >
                            INSPECT
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // --- Grounded Inspection Modal ---
    function InspectorModal({ scan, onClose }) {
      const [copied, setCopied] = useState(false);

      useEffect(() => {
        const handleKeyDown = (e) => {
          if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, [onClose]);

      if (!scan) return null;

      const findings = scan.details?.heuristic?.findings || [];
      const llmAssessment = scan.details?.llm?.assessment;
      const ragInfo = scan.details?.rag;

      const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(scan, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      };

      return (
        <div 
          onClick={onClose}
          class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            class="bg-[#0e0e11] border border-zinc-800 rounded-[4px] max-w-3xl w-full max-h-[85vh] flex flex-col shadow-none"
          >
            {/* Modal Header */}
            <div class="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-[2px] bg-zinc-500"></span>
                <span class="font-mono text-xs font-semibold text-zinc-200">
                  SCAN_AUDIT_INSPECTOR
                </span>
                <span class="font-mono text-[10px] text-zinc-400">
                  // {scan.id}
                </span>
              </div>
              <button 
                onClick={onClose}
                class="text-zinc-400 hover:text-zinc-200 text-lg leading-none px-1.5 py-0.5 cursor-pointer font-mono"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div class="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Disposition Summary Header */}
              <div class="border border-zinc-800 bg-zinc-950 p-3 rounded-[3px] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div class="text-[10px] font-mono text-zinc-400 uppercase mb-0.5">FINAL VERDICT</div>
                  <div class="text-sm font-semibold font-mono text-zinc-100 flex items-center gap-2">
                    <span class={'w-2 h-2 rounded-full ' + (scan.finalResult === 'PHISHING' ? 'bg-red-500' : scan.finalResult === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500')}></span>
                    {scan.finalResult}
                  </div>
                </div>
                <div>
                  <div class="text-[10px] font-mono text-zinc-400 uppercase mb-0.5">ROUTE</div>
                  <div class="font-mono text-zinc-200">{scan.route.toUpperCase()}</div>
                </div>
                <div>
                  <div class="text-[10px] font-mono text-zinc-400 uppercase mb-0.5">SCORE</div>
                  <div class="font-mono text-zinc-200 tabular-nums">{scan.heuristicScore}</div>
                </div>
                <div>
                  <div class="text-[10px] font-mono text-zinc-400 uppercase mb-0.5">DURATION</div>
                  <div class="font-mono text-zinc-200 tabular-nums">{scan.durationMs}ms</div>
                </div>
                <div>
                  <div class="text-[10px] font-mono text-zinc-400 uppercase mb-0.5">ENGINE</div>
                  <div class="font-mono text-zinc-200">{scan.model || '-'}</div>
                </div>
              </div>

              {/* Assessment Explanation */}
              <div class="border border-zinc-800/80 bg-zinc-950 p-3 rounded-[3px]">
                <div class="text-[10px] font-mono text-zinc-400 uppercase mb-1">EVALUATION COMMENT</div>
                <p class="text-zinc-200 font-sans leading-relaxed">{scan.comment}</p>
              </div>

              {/* Heuristic Rule Trigger Breakdown */}
              <div class="border border-zinc-800/80 bg-zinc-950 p-3 rounded-[3px]">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[10px] font-mono text-zinc-400 uppercase">
                    HEURISTIC RULES TRIGGERED ({findings.length})
                  </span>
                  <span class="text-[10px] font-mono text-zinc-400">SCORE DELTA</span>
                </div>
                {findings.length === 0 ? (
                  <div class="text-zinc-500 font-mono text-[11px]">No heuristic trigger patterns flagged.</div>
                ) : (
                  <div class="space-y-1.5 font-mono text-[11px]">
                    {findings.map((f, idx) => (
                      <div key={idx} class="flex items-center justify-between border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 rounded-[3px]">
                        <div class="flex items-center gap-2">
                          <span class="text-red-400 font-semibold">[{f.code}]</span>
                          <span class="text-zinc-300 font-sans">{f.message}</span>
                        </div>
                        <span class="tabular-nums text-zinc-400">
                          {f.score > 0 ? '+' : ''}{f.score}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LLM Synthesis Info (if executed) */}
              {scan.route === 'llm' && llmAssessment && (
                <div class="border border-zinc-800/80 bg-zinc-950 p-3 rounded-[3px] space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-mono text-zinc-400 uppercase">
                      LLM VERDICT ASSESSMENT ({scan.model || 'Model'})
                    </span>
                    <span class="text-[10px] font-mono text-blue-400">
                      CONFIDENCE: {Math.round(llmAssessment.confidence * 100)}%
                    </span>
                  </div>
                  <p class="text-zinc-200 font-sans leading-relaxed">{llmAssessment.comment}</p>
                  <div class="flex items-center gap-4 text-[10px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/60">
                    <span>TOKENS: {scan.tokens?.input || 0} IN / {scan.tokens?.output || 0} OUT</span>
                    <span>RAG_HITS: {ragInfo?.hitCount || 0}</span>
                    <span>VERSION: {scan.details?.rag?.corpusVersion || 'v1'}</span>
                  </div>
                </div>
              )}

              {/* Raw JSON Audit Inspector */}
              <div class="border border-zinc-800/80 bg-zinc-950 p-3 rounded-[3px]">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[10px] font-mono text-zinc-400 uppercase">RAW AUDIT PAYLOAD</span>
                  <button 
                    onClick={handleCopyJson}
                    class="text-[10px] font-mono border border-zinc-700 hover:border-zinc-500 px-2 py-0.5 rounded-[2px] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {copied ? 'COPIED!' : 'COPY_JSON'}
                  </button>
                </div>
                <pre class="font-mono text-[11px] text-zinc-300 bg-[#050507] border border-zinc-800 p-2.5 rounded-[3px] overflow-x-auto max-h-48">
                  {JSON.stringify(scan, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // --- Main Dashboard Container ---
    function DashboardApp() {
      const [range, setRange] = useState('all');
      const [statsData, setStatsData] = useState(null);
      const [scansData, setScansData] = useState([]);
      const [selectedScan, setSelectedScan] = useState(null);
      const [isRefreshing, setIsRefreshing] = useState(false);
      const [lastRefreshed, setLastRefreshed] = useState(new Date());
      const [fetchError, setFetchError] = useState(null);

      const fetchTelemetry = useCallback(async (r) => {
        setIsRefreshing(true);
        try {
          const apiBase = window.location.pathname.replace(/\/+$/, '');
          const statsRes = await fetch(apiBase + '/api/stats?range=' + (r || range));
          if (statsRes.ok) {
            const data = await statsRes.json();
            setStatsData(data);
            setFetchError(null);
          } else {
            const errBody = await statsRes.json().catch(() => ({}));
            setFetchError(errBody.error || 'HTTP ' + statsRes.status + ': Failed to load stats');
            // Still set statsData with dbStatus for the header badge
            setStatsData({ dbStatus: errBody.dbStatus || 'error', error: errBody.error });
          }

          const scansRes = await fetch(apiBase + '/api/scans?limit=50');
          if (scansRes.ok) {
            const data = await scansRes.json();
            setScansData(data.scans || []);
          }

          setLastRefreshed(new Date());
        } catch (err) {
          console.error('Telemetry polling error:', err);
          setFetchError('Network error: ' + (err.message || 'Unable to reach dashboard API'));
        } finally {
          setIsRefreshing(false);
        }
      }, [range]);

      useEffect(() => {
        fetchTelemetry(range);
        const timer = setInterval(() => {
          fetchTelemetry(range);
        }, 20000); // 20s live sync
        return () => clearInterval(timer);
      }, [range, fetchTelemetry]);

      const o = statsData?.overview || {
        totalScans: 0,
        phishingCount: 0,
        warningCount: 0,
        okCount: 0,
        phishingRate: 0,
        warningRate: 0,
        okRate: 0,
        heuristicRouteCount: 0,
        heuristicShieldRate: 0,
        avgDurationMs: 0,
        avgHeuristicDurationMs: 0,
        avgLlmDurationMs: 0,
        estimatedCostUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0
      };

      return (
        <div class="min-h-screen flex flex-col bg-[#09090b]">
          <Header
            statusData={statsData}
            fetchError={fetchError}
            range={range}
            onRangeChange={(newRange) => {
              setRange(newRange);
              fetchTelemetry(newRange);
            }}
            onRefresh={() => fetchTelemetry(range)}
            isRefreshing={isRefreshing}
            lastRefreshed={lastRefreshed}
          />

          <main class="flex-1 max-w-[1560px] w-full mx-auto p-4 flex flex-col gap-4">
            {/* KPI Metric Overview Row */}
            <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
              <MetricCard
                label="Total Scanned"
                value={formatNumber(o.totalScans)}
                subLeft="Ingress volume"
                subRight="plugin"
              />
              <MetricCard
                label="Phishing"
                value={formatNumber(o.phishingCount)}
                subLeft={(o.phishingRate || 0) + '% rate'}
                subRight="quarantine"
                variant="danger"
              />
              <MetricCard
                label="Warnings"
                value={formatNumber(o.warningCount)}
                subLeft={(o.warningRate || 0) + '% rate'}
                subRight="caution"
                variant="warning"
              />
              <MetricCard
                label="Clean & Safe"
                value={formatNumber(o.okCount)}
                subLeft={(o.okRate || 0) + '% rate'}
                subRight="verified"
                variant="safe"
              />
              <MetricCard
                label="Heuristic Shield"
                value={(o.heuristicShieldRate || 0) + '%'}
                subLeft={formatNumber(o.heuristicRouteCount) + ' bypassed'}
                subRight="$0 cost"
              />
              <MetricCard
                label="Avg Latency"
                value={o.avgDurationMs + ' ms'}
                subLeft={'Heur: ' + o.avgHeuristicDurationMs + 'ms'}
                subRight={'LLM: ' + o.avgLlmDurationMs + 'ms'}
              />
              <MetricCard
                label="AI Token Cost"
                value={'$' + (o.estimatedCostUsd ? o.estimatedCostUsd.toFixed(4) : '0.0000')}
                subLeft={formatNumber(o.totalInputTokens) + ' in'}
                subRight={formatNumber(o.totalOutputTokens) + ' out'}
              />
            </section>

            {/* Primary Visualizations Row */}
            <section class="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div class="lg:col-span-2">
                <TimelineChart timeline={statsData?.timeline || []} />
              </div>
              <div class="lg:col-span-1">
                <VerdictDistributionCard overview={o} />
              </div>
            </section>

            {/* Secondary Visualizations Row */}
            <section class="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <ModelLatencyChart models={statsData?.models || []} />
              <TopSignalsCard findings={statsData?.topHeuristicFindings || []} />
            </section>

            {/* Audit Log Table Feed */}
            <section>
              <ScansFeed 
                scans={scansData} 
                onInspect={(scan) => setSelectedScan(scan)} 
              />
            </section>
          </main>

          {/* Inspection Modal */}
          {selectedScan && (
            <InspectorModal 
              scan={selectedScan} 
              onClose={() => setSelectedScan(null)} 
            />
          )}
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<DashboardApp />);
  </script>
</body>
</html>`;
};
