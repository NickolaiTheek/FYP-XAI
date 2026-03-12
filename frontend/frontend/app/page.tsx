"use client";
import axios from 'axios';
import { AlertTriangle, BrainCircuit, CheckCircle, Info, Search, ShieldAlert, ShieldCheck, Sparkles, Star, XCircle, Zap } from 'lucide-react';
import { useState } from 'react';

// --- TYPE DEFINITIONS ---
interface Review {
  author: string;
  date?: string;
  text: string;
  stars: number;
  is_fake: boolean;
  is_mismatch: boolean;
}

interface EvidenceItem { word: string; impact: string; color: string; }
interface RawExplanationItem { word: string; score: number; }
interface TrustBadge { label: string; type: string; icon: string; }

// 🔥 NEW SCORECARD INTERFACE 🔥
interface ScorecardItem {
  aspect: string;
  score: string;
  confidence: string;
  evidence: string;
}

interface AuditReport {
  risk_score: number; verdict: string; verdict_color: string; summary: string;
  trust_badges: TrustBadge[]; sentiment_score: number; rating_score: number;
  consistency_gap: number; evidence: EvidenceItem[]; raw_explanation: RawExplanationItem[];
}

interface DashboardData {
  restaurant_name: string;
  scorecard: ScorecardItem[]; // 🔥 REPLACED AI_SUMMARY WITH SCORECARD ARRAY
  stats: {
    trust_score: number; real: number; fakes: number; total: number;
    google_rating: number; genuine_positive: number; genuine_negative: number; // 🔥 UPDATED TO GOOGLE RATING
  };
  reviews: Review[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'search' | 'live'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);

  const [liveText, setLiveText] = useState('');
  const [liveStars, setLiveStars] = useState(5);
  const [liveReport, setLiveReport] = useState<AuditReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_URL = "https://nickolaitheek-trustxplain-backend.hf.space";
  const isLanding = !data && !liveReport && !loading;

  const handleSearch = async () => {
    if (!searchQuery) return;
    setLoading(true); setError(''); setData(null);
    try {
      const res = await axios.get(`${API_URL}/search?query=${encodeURIComponent(searchQuery)}`);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Could not fetch live reviews. Please try again.");
    }
    setLoading(false);
  };

  const handleLiveAudit = async () => {
    if (!liveText) return;
    setLoading(true); setLiveReport(null); setError('');
    try {
      const res = await axios.post(`${API_URL}/explain`, { text: liveText, stars: liveStars });
      setLiveReport(res.data);
    } catch (err) {
      setError("Analysis failed. Backend might be warming up.");
    }
    setLoading(false);
  }

  if (isLanding) {
    return (
      <div className="min-h-screen font-sans bg-[url('/hero-bg.png')] bg-cover bg-bottom bg-no-repeat flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-5xl px-4 -mt-20 animate-fade-in-up w-full">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-600/20">
              <ShieldCheck className="text-white" size={32} strokeWidth={2} />
            </div>
            <h1 className="text-4xl font-bold text-blue-600 tracking-tight">TrustXplain</h1>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-blue-900 mb-8 leading-tight drop-shadow-sm">AI Credibility Inspector</h2>
          <div className="flex justify-center mb-8">
            <div className="bg-white p-1 rounded-full shadow-md border border-gray-200 inline-flex">
              <button onClick={() => setActiveTab('search')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                <Search size={16} /> Live Search
              </button>
              <button onClick={() => setActiveTab('live')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'live' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                <Zap size={16} /> Single Audit
              </button>
            </div>
          </div>
          {activeTab === 'search' ? (
            <div className="max-w-2xl mx-auto bg-white rounded-full shadow-2xl p-2 flex items-center border border-blue-50 mb-12 transition-transform hover:scale-[1.01]">
              <Search className="text-gray-400 ml-5" size={22} />
              <input type="text" placeholder=" " className="flex-1 bg-transparent border-none outline-none text-gray-700 text-lg px-4 py-3 placeholder-gray-400" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              <button onClick={handleSearch} disabled={!searchQuery} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-md disabled:opacity-50">Search</button>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl p-6 border border-blue-50 mb-12 text-left">
              <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Paste Any Review Text</label>
              <textarea className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none mb-4" placeholder="Paste a review here..." onChange={(e) => setLiveText(e.target.value)}></textarea>
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Star Rating</label>
                  <div className="flex gap-1 text-yellow-400 cursor-pointer">
                    {[1, 2, 3, 4, 5].map(star => <Star key={star} size={24} fill={star <= liveStars ? "currentColor" : "none"} onClick={() => setLiveStars(star)} />)}
                  </div>
                </div>
                <button onClick={handleLiveAudit} disabled={!liveText} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2">
                  <Zap size={18} /> Analyze
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans antialiased">
      <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center animate-fade-in">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setData(null); setLiveReport(null); }}>
          <ShieldCheck size={28} className="text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">TrustXplain</h1>
        </div>
        <button onClick={() => { setData(null); setLiveReport(null); }} className="text-sm font-bold text-gray-500 hover:text-blue-600">Start New Search</button>
      </div>

      {loading && (
        <div className="text-center mt-20 animate-fade-in">
          <div className="inline-flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
            <BrainCircuit className="animate-spin text-blue-600" size={48} />
            <span className="text-lg font-medium text-gray-600">Extracting data & analyzing authenticity...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-xl mx-auto mt-8 text-center bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm animate-fade-in">
          <AlertTriangle className="mx-auto text-red-500 mb-2" size={32} />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      {data && !loading && (
        <main className="max-w-5xl mx-auto animate-fade-in w-full">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-6">{data.restaurant_name}</h2>

          {/* 🔥 NEW ASPECT SCORECARD TABLE 🔥 */}
          {data.scorecard && data.scorecard.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-blue-800">
                <Sparkles size={20} className="text-blue-600" />
                <h3 className="text-lg font-extrabold">Aspect-Based Scorecard</h3>
              </div>
              <p className="text-sm text-gray-500 mb-6 italic"></p>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="pb-3 px-4 font-bold">Aspect</th>
                      <th className="pb-3 px-4 font-bold">Score</th>
                      <th className="pb-3 px-4 font-bold">Confidence</th>
                      <th className="pb-3 px-4 font-bold">Main Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-gray-800">
                    {data.scorecard.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 font-semibold text-gray-900">{item.aspect}</td>
                        <td className="py-4 px-4 font-mono font-medium">{item.score}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${item.confidence === 'High' ? 'bg-green-100 text-green-700' :
                            item.confidence === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                            {item.confidence}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-600 italic">"{item.evidence}"</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            {/* 🔥 UPDATED METRICS DASHBOARD FOR SIMPLICITY 🔥 */}
            <MetricCard label="Review Honesty (%)" value={`${data.stats.trust_score}%`} icon={<ShieldCheck className="text-blue-600" />} color="blue" />
            <MetricCard label="Google Rating" value={`⭐ ${data.stats.google_rating}`} icon={<Star className="text-yellow-500" />} color="yellow" />
            <MetricCard label="Verified Happy vs Unhappy Customers" value={`${data.stats.genuine_positive} 😊 | ${data.stats.genuine_negative} 😠`} icon={<CheckCircle className="text-green-600" />} color="green" />
            <MetricCard label="Likely Fake Reviews" value={data.stats.fakes} icon={<XCircle className="text-red-600" />} color="red" />
          </div>

          <div className="max-w-xl mx-auto text-center bg-gray-100 p-6 rounded-xl border border-gray-200 shadow-sm animate-fade-in mb-6">
            <MetricCard label="Star & Comment Mismatches" value={data.reviews.filter(r => r.is_mismatch).length} icon={<AlertTriangle className="text-orange-600" />} color="orange" />
          </div>

          <h3 className="text-lg font-bold text-gray-800 mb-4">Raw Data Feed ({data.stats.total} recent reviews)</h3>
          <div className="space-y-6">
            {data.reviews.map((review, idx) => <ReviewCard key={idx} review={review} apiUrl={API_URL} />)}
          </div>
        </main>
      )}

      {liveReport && !loading && (
        <main className="max-w-3xl mx-auto animate-fade-in w-full">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-md">
            <div className="mb-6 p-4 bg-gray-50 rounded-lg italic text-gray-700 border-l-4 border-blue-400">"{liveText}"</div>
            <AuditResultView report={liveReport} onClose={() => { }} isStatic={true} />
          </div>
        </main>
      )}
    </div>
  );
}

// --- COMPONENTS ---
function MetricCard({ label, value, icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    red: "bg-red-50 border-red-200",
    orange: "bg-orange-50 border-orange-200",
    yellow: "bg-yellow-50 border-yellow-200"
  };
  return (
    <div className={`p-6 rounded-2xl border ${colors[color]} text-center shadow-sm`}>
      <div className="flex justify-center mb-3 scale-110">{icon}</div>
      <div className="text-3xl font-extrabold text-gray-900 mb-1">{value}</div>
      <div className="text-xs text-gray-600 uppercase font-bold">{label}</div>
    </div>
  );
}

function ReviewCard({ review, apiUrl }: { review: Review, apiUrl: string }) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExplain = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${apiUrl}/explain`, { text: review.text, stars: review.stars });
      setReport(res.data);
    } catch (err) { alert("Analysis failed."); }
    setLoading(false);
  };

  return (
    <div className={`bg-white p-6 rounded-xl border shadow-sm ${review.is_fake ? 'border-red-100 opacity-80' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${review.is_fake ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {review.is_fake ? "Fake Reviews or AI Generated" : "✅ Verified Genuine"}
          </span>
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (<Star key={i} size={18} fill={i < review.stars ? "currentColor" : "none"} />))}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold text-gray-600">{review.author}</span>
          {review.date && (
            <span className="text-xs font-medium text-gray-400 mt-0.5">{review.date}</span>
          )}
        </div>
      </div>
      {!report && <p className="text-gray-700 mb-4">{review.text}</p>}
      {report && <AuditResultView report={report} onClose={() => setReport(null)} isStatic={false} />}
      {!report && (
        <button onClick={handleExplain} disabled={loading} className="text-sm font-bold text-blue-600 flex items-center gap-2">
          {loading ? <BrainCircuit size={16} className="animate-spin" /> : <BrainCircuit size={16} />} Run Deep Audit
        </button>
      )}
    </div>
  );
}

function AuditResultView({ report, onClose, isStatic }: { report: AuditReport, onClose: () => void, isStatic: boolean }) {
  const theme = {
    red: { border: "border-red-200", bg: "bg-red-50/30", headerBg: "bg-red-100/80", headerText: "text-red-900", icon: <ShieldAlert size={18} /> },
    orange: { border: "border-yellow-200", bg: "bg-yellow-50/30", headerBg: "bg-yellow-100/80", headerText: "text-yellow-900", icon: <AlertTriangle size={18} /> },
    green: { border: "border-green-200", bg: "bg-green-50/30", headerBg: "bg-green-100/80", headerText: "text-green-900", icon: <ShieldCheck size={18} /> }
  }[report.verdict_color] || { border: "border-gray-200", bg: "bg-gray-50", headerBg: "bg-gray-100", headerText: "text-gray-900", icon: <Info size={18} /> };

  return (
    <div className={`rounded-lg border overflow-hidden mb-4 ${theme.border} ${theme.bg}`}>
      <div className={`p-4 border-b flex justify-between items-center ${theme.headerBg} ${theme.border}`}>
        <h4 className={`font-black text-sm uppercase flex items-center gap-2 ${theme.headerText}`}>{theme.icon} {report.verdict}</h4>
        {!isStatic && <button onClick={onClose} className="text-xs font-bold text-gray-500 hover:text-gray-800">CLOSE</button>}
      </div>
      <div className="p-5 bg-white/60">
        <div className="mb-4 text-sm font-medium text-gray-800">{report.summary}</div>
        <div>
          <h5 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Search size={14} /> Evidence Highlights (Hover)</h5>
          <div className="text-gray-800 text-[15px] leading-8 bg-white p-5 rounded-lg border font-mono shadow-sm">
            {report.raw_explanation?.map((item, i) => {
              if (item.score > 0.05) return <HighlightWithTooltip key={i} word={item.word} colorClass="bg-red-100 text-red-900 border-b-2 border-red-400" tooltipText={`+${Math.round(item.score * 100)}% to FAKE`} />;
              if (item.score < -0.05) return <HighlightWithTooltip key={i} word={item.word} colorClass="bg-green-100 text-green-900 border-b-2 border-green-400" tooltipText={`+${Math.round(Math.abs(item.score) * 100)}% to GENUINE`} />;
              return <span key={i}>{item.word} </span>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightWithTooltip({ word, colorClass, tooltipText }: { word: string, colorClass: string, tooltipText: string }) {
  return (
    <span className="group relative inline-block cursor-help">
      <span className={`px-1 rounded-sm ${colorClass}`}>{word}</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {tooltipText}
      </span><span> </span>
    </span>
  );
}