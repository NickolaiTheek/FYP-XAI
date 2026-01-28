"use client";
import axios from 'axios';
import { AlertTriangle, BrainCircuit, Search, ShieldAlert, ShieldCheck, Star } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <header className="max-w-5xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🛡️ TrustXplain</h1>
        <p className="text-gray-500">AI-Powered Restaurant Credibility Inspector</p>
      </header>

      <div className="max-w-2xl mx-auto mb-12">
        <div className="relative">
          <select
            className="w-full p-4 pl-12 rounded-xl border border-gray-200 shadow-sm text-lg appearance-none bg-white focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
            onChange={(e) => handleSearch(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>🔍 Select a Restaurant to Analyze...</option>
            {restaurants.map((r, i) => <option key={i} value={r}>{r}</option>)}
          </select>
          <Search className="absolute left-4 top-4.5 text-gray-400" size={24} />
        </div>
      </div>

      {loading && <div className="text-center text-gray-500 animate-pulse">Analyzing reviews... 🤖</div>}
      {error && <div className="text-center text-red-500 bg-red-50 p-4 rounded-lg border border-red-100">{error}</div>}

      {data && (
        <main className="max-w-5xl mx-auto animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <MetricCard label="Trust Score" value={`${data.stats.trust_score}/100`} icon={<ShieldCheck className="text-blue-500" />} color="blue" />
            <MetricCard label="Genuine Reviews" value={data.stats.real} icon={<ShieldCheck className="text-green-500" />} color="green" />
            <MetricCard label="Suspicious Reviews" value={data.stats.fakes} icon={<ShieldAlert className="text-red-500" />} color="red" />
            <MetricCard
              label="Rating Mismatches"
              value={data.reviews.filter(r => r.is_mismatch).length}
              icon={<AlertTriangle className="text-orange-500" />}
              color="orange"
            />
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-6">📝 Review Analysis</h2>
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
  const colors: any = { blue: "bg-blue-50 border-blue-100", green: "bg-green-50 border-green-100", red: "bg-red-50 border-red-100", orange: "bg-orange-50 border-orange-100" };
  return (
    <div className={`p-6 rounded-2xl border ${colors[color]} text-center shadow-sm`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="text-3xl font-bold text-gray-800 mb-1">{value}</div>
      <div className="text-sm text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

// --- REVIEW CARD (WITH UPDATED AUDIT UI) ---
function ReviewCard({ review, apiUrl }: { review: Review, apiUrl: string }) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);

  // Pass Text AND Stars to backend
  const handleExplain = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${apiUrl}/explain`, { text: review.text, stars: review.stars });
      setReport(res.data);
    } catch (err) {
      alert("Analysis failed. Please try again.");
    }
    setLoading(false);
  };

  const isReportValid = report && report.summary && report.verdict;

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* HEADER */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${review.is_fake ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {review.is_fake ? "🚨 SUSPICIOUS" : "✅ GENUINE"}
          </span>
          <div className="flex items-center text-yellow-500">
            {[...Array(5)].map((_, i) => (<Star key={i} size={16} fill={i < review.stars ? "currentColor" : "none"} />))}
          </div>
        </div>
      </div>

      {!report && <p className="text-gray-700 mb-4 leading-relaxed">{review.text}</p>}

      {/* 👇 NEW AUDIT UI */}
      {report && isReportValid && (
        <div className="bg-white rounded-lg border border-gray-300 overflow-hidden animate-fade-in mb-4">

          {/* A. EXECUTIVE HEADER */}
          <div className={`p-4 border-b border-gray-200 flex justify-between items-center ${report.verdict_color === 'red' ? 'bg-red-50' : 'bg-green-50'}`}>
            <h4 className={`font-black text-sm uppercase tracking-wider flex items-center gap-2 ${report.verdict_color === 'red' ? 'text-red-800' : 'text-green-800'}`}>
              🛡️ Credibility Audit: {report.verdict}
            </h4>
            <button onClick={() => setReport(null)} className="text-xs font-bold text-gray-500 hover:text-black">CLOSE XAI</button>
          </div>

          <div className="p-5">
            {/* 🆕 B. TRUST BADGES (Quick Scan) */}
            <div className="flex flex-wrap gap-2 mb-6">
              {report.trust_badges?.map((badge, i) => (
                <span key={i} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase border 
                        ${badge.type === 'green' ? 'bg-green-100 text-green-700 border-green-200' :
                    badge.type === 'blue' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      badge.type === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                        'bg-red-100 text-red-700 border-red-200'
                  }`}>
                  <span>{badge.icon}</span> {badge.label}
                </span>
              ))}
            </div>

            {/* C. ANALYSIS SUMMARY */}
            <div className="mb-6">
              <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">💡 Analysis Summary</h5>
              <p className="text-sm text-gray-800 leading-relaxed font-medium">{report.summary}</p>
            </div>

            {/* 🆕 D. VISUAL MISMATCH BAR */}
            <div className="mb-8 bg-gray-50 p-4 rounded border border-gray-200">
              <div className="flex justify-between items-end mb-2">
                <h5 className="text-xs font-bold text-gray-400 uppercase">Consistency Check</h5>
                {report.consistency_gap > 35 && (
                  <span className="text-xs font-bold text-red-600 flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={12} /> Mismatch Detected
                  </span>
                )}
              </div>

              {/* Star Rating Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                  <span>Star Rating ({report.rating_score}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: `${report.rating_score}%` }}></div>
                </div>
              </div>

              {/* Text Sentiment Bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                  <span>Text Sentiment ({report.sentiment_score}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${report.sentiment_score}%` }}></div>
                </div>
              </div>
            </div>

            {/* E. ANNOTATED REVIEW TEXT (INTERACTIVE) */}
            <div>
              <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">📄 Annotated Review Text (Hover to Inspect)</h5>
              <div className="text-gray-700 text-sm leading-7 bg-white p-4 rounded border border-gray-200 font-mono shadow-sm">
                {report.raw_explanation?.map((item, i) => {
                  // Fake Logic: Positive score = Red Highlight
                  if (item.score > 0.05) return (
                    <span key={i} className="bg-red-100 text-red-800 border-b-2 border-red-300 px-0.5 cursor-help transition-colors hover:bg-red-200" title={`Impact: +${Math.round(item.score * 100)}% towards Fake`}>
                      {item.word}{" "}
                    </span>
                  );
                  // Genuine Logic: Negative score = Green Highlight
                  if (item.score < -0.05) return (
                    <span key={i} className="bg-green-100 text-green-800 border-b-2 border-green-300 px-0.5 cursor-help transition-colors hover:bg-green-200" title={`Impact: +${Math.round(Math.abs(item.score) * 100)}% towards Genuine`}>
                      {item.word}{" "}
                    </span>
                  );
                  return <span key={i}>{item.word} </span>;
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* BUTTON */}
      {!report && (
        <button onClick={handleExplain} disabled={loading} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors">
          {loading ? "Running Audit..." : <><BrainCircuit size={18} /> Run Analysis</>}
        </button>
      )}
    </div>
  );
}