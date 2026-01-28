"use client";
import axios from 'axios';
import { AlertTriangle, BrainCircuit, CheckCircle, Info, Search, ShieldAlert, ShieldCheck, Star, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

// --- TYPE DEFINITIONS ---
interface Review {
  text: string;
  stars: number;
  is_fake: boolean;
  is_mismatch: boolean;
}

interface EvidenceItem {
  word: string;
  impact: string;
  color: string;
}

interface RawExplanationItem {
  word: string;
  score: number;
}

interface TrustBadge {
  label: string;
  type: string;
  icon: string;
}

interface AuditReport {
  risk_score: number;
  verdict: string;
  verdict_color: string;
  summary: string;
  trust_badges: TrustBadge[];
  sentiment_score: number;
  rating_score: number;
  consistency_gap: number;
  evidence: EvidenceItem[];
  raw_explanation: RawExplanationItem[];
}

interface DashboardData {
  stats: {
    trust_score: number;
    real: number;
    fakes: number;
    total: number;
  };
  reviews: Review[];
}

export default function Home() {
  const [restaurants, setRestaurants] = useState<string[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // CHANGE THIS TO YOUR LIVE BACKEND URL
  const API_URL = "https://nickolaitheek-trustxplain-backend.hf.space";

  useEffect(() => {
    axios.get(`${API_URL}/restaurants`)
      .then(res => setRestaurants(res.data))
      .catch(err => {
        console.error("Backend Error:", err);
        setError("Backend is waking up... please wait 30s and refresh.");
      });
  }, []);

  const handleSearch = async (name: string) => {
    setSelectedRestaurant(name);
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await axios.get(`${API_URL}/search?name=${encodeURIComponent(name)}`);
      setData(res.data);
    } catch (err) {
      setError("Could not load data. The backend might be busy.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans antialiased">
      <header className="max-w-5xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">🛡️ TrustXplain</h1>
        <p className="text-lg text-gray-600">AI-Powered Restaurant Credibility Inspector</p>
      </header>

      <div className="max-w-2xl mx-auto mb-12">
        <div className="relative group">
          <select
            className="w-full p-4 pl-12 rounded-xl border border-gray-300 shadow-sm text-lg appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700 transition-all"
            onChange={(e) => handleSearch(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>🔍 Select a Restaurant to Analyze...</option>
            {restaurants.map((r, i) => <option key={i} value={r}>{r}</option>)}
          </select>
          <Search className="absolute left-4 top-4.5 text-gray-400 group-hover:text-blue-500 transition-colors" size={24} />
        </div>
      </div>

      {loading && <div className="text-center text-blue-600 font-medium animate-pulse flex justify-center items-center gap-2"><BrainCircuit className="animate-spin" /> Analyzing reviews...</div>}
      {error && <div className="max-w-2xl mx-auto text-center text-red-600 bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">{error}</div>}

      {data && (
        <main className="max-w-5xl mx-auto animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <MetricCard label="Trust Score" value={`${data.stats.trust_score}/100`} icon={<ShieldCheck className="text-blue-600" />} color="blue" />
            <MetricCard label="Genuine Reviews" value={data.stats.real} icon={<CheckCircle className="text-green-600" />} color="green" />
            <MetricCard label="Suspicious Reviews" value={data.stats.fakes} icon={<XCircle className="text-red-600" />} color="red" />
            <MetricCard
              label="Rating Mismatches"
              value={data.reviews.filter(r => r.is_mismatch).length}
              icon={<AlertTriangle className="text-orange-600" />}
              color="orange"
            />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">📝 Review Analysis</h2>
          <div className="space-y-6">
            {data.reviews.map((review, idx) => (
              <ReviewCard key={idx} review={review} apiUrl={API_URL} />
            ))}
          </div>
        </main>
      )}
    </div>
  );
}

// --- METRIC CARD ---
function MetricCard({ label, value, icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 border-blue-200 hover:border-blue-300",
    green: "bg-green-50 border-green-200 hover:border-green-300",
    red: "bg-red-50 border-red-200 hover:border-red-300",
    orange: "bg-orange-50 border-orange-200 hover:border-orange-300"
  };
  return (
    <div className={`p-6 rounded-2xl border transition-all duration-200 ${colors[color]} text-center shadow-sm hover:shadow-md`}>
      <div className="flex justify-center mb-3 scale-110 transform">{icon}</div>
      <div className="text-3xl font-extrabold text-gray-900 mb-1">{value}</div>
      <div className="text-xs text-gray-600 uppercase tracking-wider font-bold">{label}</div>
    </div>
  );
}

// --- REVIEW CARD (WITH PROFESSIONAL AUDIT UI) ---
function ReviewCard({ review, apiUrl }: { review: Review, apiUrl: string }) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExplain = async () => {
    setLoading(true);
    try {
      // Important: Send both text and stars
      const res = await axios.post(`${apiUrl}/explain`, { text: review.text, stars: review.stars });
      setReport(res.data);
    } catch (err) {
      alert("Analysis failed. Please try again.");
    }
    setLoading(false);
  };

  const isReportValid = report && report.summary && report.verdict;
  const isHighRisk = report?.verdict_color === 'red';

  return (
    <div className={`bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 ${isHighRisk ? 'border-red-100' : 'border-gray-200'}`}>
      {/* HEADER */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${review.is_fake ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
            {review.is_fake ? "🚨 Suspicious" : "✅ Genuine"}
          </span>
          <div className="flex items-center text-yellow-400">
            {[...Array(5)].map((_, i) => (<Star key={i} size={18} fill={i < review.stars ? "currentColor" : "none"} strokeWidth={1.5} />))}
          </div>
        </div>
      </div>

      {!report && <p className="text-gray-700 mb-4 leading-relaxed text-[15px]">{review.text}</p>}

      {/* 👇 PROFESSIONAL AUDIT REPORT UI */}
      {report && isReportValid && (
        <div className={`rounded-lg border overflow-hidden animate-fade-in mb-4 shadow-inner ${isHighRisk ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}`}>

          {/* A. EXECUTIVE HEADER */}
          <div className={`p-4 border-b flex justify-between items-center ${isHighRisk ? 'bg-red-100/80 border-red-200' : 'bg-green-100/80 border-green-200'}`}>
            <h4 className={`font-black text-sm uppercase tracking-wider flex items-center gap-2 ${isHighRisk ? 'text-red-900' : 'text-green-900'}`}>
              {isHighRisk ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
              Credibility Audit: {report.verdict}
            </h4>
            <button onClick={() => setReport(null)} className="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors">CLOSE XAI</button>
          </div>

          <div className="p-5 bg-white/60 backdrop-blur-sm">
            {/* B. TRUST BADGES (Quick Scan chips) */}
            <div className="flex flex-wrap gap-2 mb-6">
              {report.trust_badges?.map((badge, i) => (
                <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide border shadow-sm
                        ${badge.type === 'green' ? 'bg-green-100 text-green-800 border-green-200' :
                    badge.type === 'blue' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      badge.type === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                        'bg-red-100 text-red-800 border-red-200'
                  }`}>
                  <span className="text-base">{badge.icon}</span> {badge.label}
                </span>
              ))}
            </div>

            {/* C. ANALYSIS SUMMARY */}
            <div className="mb-8">
              <h5 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Info size={14} /> Analysis Summary</h5>
              <p className="text-sm text-gray-800 leading-7 font-medium bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                {report.summary}
              </p>
            </div>

            {/* D. VISUAL CONSISTENCY BAR */}
            <div className="mb-8 bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex justify-between items-end mb-4">
                <h5 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><BrainCircuit size={14} /> Consistency Check</h5>
                {report.consistency_gap > 35 && (
                  <span className="text-xs font-extrabold text-red-600 flex items-center gap-1 bg-red-100 px-2 py-1 rounded-full border border-red-200 animate-pulse">
                    <AlertTriangle size={14} /> Mismatch Detected
                  </span>
                )}
              </div>

              {/* Star Rating Bar */}
              <div className="mb-4 relative">
                <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                  <span>Star Rating Value</span>
                  <span>{report.rating_score}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-300 to-yellow-500 h-3 rounded-full transition-all duration-1000 ease-out" style={{ width: `${report.rating_score}%` }}></div>
                </div>
              </div>

              {/* Text Sentiment Bar */}
              <div className="relative">
                <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                  <span>Text Sentiment Score</span>
                  <span>{report.sentiment_score}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner overflow-hidden">
                  <div className={`h-3 rounded-full transition-all duration-1000 ease-out ${report.sentiment_score < 40 ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`} style={{ width: `${report.sentiment_score}%` }}></div>
                </div>
              </div>
              {report.consistency_gap > 35 && <p className="text-xs text-red-600 mt-3 font-medium text-center">Significant gap detected between rating and text tone.</p>}
            </div>

            {/* E. ANNOTATED REVIEW TEXT (Interactive Tooltips) */}
            <div>
              <h5 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Search size={14} /> Evidence Highlights (Hover to Inspect)</h5>
              <div className="text-gray-800 text-[15px] leading-8 bg-white p-5 rounded-lg border border-gray-200 font-mono shadow-sm">
                {report.raw_explanation?.map((item, i) => {
                  // Positive Score = Contributes to Fake (Red)
                  if (item.score > 0.05) {
                    const impact = Math.round(item.score * 100);
                    return (
                      <HighlightWithTooltip key={i} word={item.word} colorClass="bg-red-100 text-red-900 border-b-2 border-red-400 hover:bg-red-200" tooltipText={`Impact: +${impact}% towards FAKE`} />
                    );
                  }
                  // Negative Score = Contributes to Genuine (Green)
                  if (item.score < -0.05) {
                    const impact = Math.round(Math.abs(item.score) * 100);
                    return (
                      <HighlightWithTooltip key={i} word={item.word} colorClass="bg-green-100 text-green-900 border-b-2 border-green-400 hover:bg-green-200" tooltipText={`Impact: +${impact}% towards AUTHENTIC`} />
                    );
                  }
                  return <span key={i}>{item.word} </span>;
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* BUTTON */}
      {!report && (
        <button onClick={handleExplain} disabled={loading} className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><BrainCircuit size={18} className="animate-spin" /> Running Comprehensive Audit...</> : <><BrainCircuit size={18} /> Run Credibility Analysis</>}
        </button>
      )}
    </div>
  );
}

// --- HELPER: CUSTOM CSS TOOLTIP COMPONENT ---
function HighlightWithTooltip({ word, colorClass, tooltipText }: { word: string, colorClass: string, tooltipText: string }) {
  return (
    <span className="group relative inline-block cursor-help">
      <span className={`px-1 rounded-sm transition-colors ${colorClass}`}>
        {word}
      </span>
      {/* CSS Tooltip */}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-md opacity-0 transform scale-95 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 shadow-lg z-50 whitespace-nowrap">
        {tooltipText}
        {/* Tiny arrow pointing down */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></span>
      </span>
      <span> </span>{/* Space after word */}
    </span>
  );
}