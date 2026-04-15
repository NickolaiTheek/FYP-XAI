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
  scorecard: ScorecardItem[];
  stats: {
    trust_score: number; real: number; fakes: number; total: number;
    google_rating: number; genuine_positive: number; genuine_neutral: number; genuine_negative: number;
  };
  reviews: Review[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'search' | 'live'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanDepth, setScanDepth] = useState<number>(20); // NEW: Scan depth state
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
      // NEW: Pass the scanDepth limit to the backend
      const res = await axios.get(`${API_URL}/search?query=${encodeURIComponent(searchQuery)}&limit=${scanDepth}`);
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

  const getScoreColor = (score: number) => {
    if (score >= 4.0) return 'bg-green-500';
    if (score >= 2.5) return 'bg-yellow-400';
    if (score > 0) return 'bg-red-500';
    return 'bg-gray-300';
  };

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
            <div className="w-full max-w-2xl mx-auto mb-12">
              <div className="bg-white rounded-full shadow-2xl p-2 flex items-center border border-blue-50 transition-transform hover:scale-[1.01]">
                <Search className="text-gray-400 ml-5" size={22} />
                <input type="text" placeholder=" " className="flex-1 bg-transparent border-none outline-none text-gray-700 text-lg px-4 py-3 placeholder-gray-400" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                <button onClick={handleSearch} disabled={!searchQuery} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-md disabled:opacity-50">Search</button>
              </div>

              {/* NEW: Scan Depth Selector */}
              <div className="mt-5 flex justify-center items-center gap-3 animate-fade-in-up">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Scan Depth:</span>
                <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <button onClick={() => setScanDepth(10)} className={`px-4 py-2 text-xs font-bold transition-colors ${scanDepth === 10 ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>Quick (10)</button>
                  <div className="w-px bg-gray-200"></div>
                  <button onClick={() => setScanDepth(20)} className={`px-4 py-2 text-xs font-bold transition-colors ${scanDepth === 20 ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>Standard (20)</button>
                  <div className="w-px bg-gray-200"></div>
                  <button onClick={() => setScanDepth(50)} className={`px-4 py-2 text-xs font-bold transition-colors ${scanDepth === 50 ? 'bg-blue-50 text-blue-700 flex items-center gap-1' : 'text-gray-600 hover:bg-gray-50 flex items-center gap-1'}`}>Deep (50)</button>
                </div>
              </div>
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-[98%] xl:max-w-7xl mx-auto mb-8 flex justify-between items-center animate-fade-in">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setData(null); setLiveReport(null); }}>
          <ShieldCheck size={28} className="text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">TrustXplain Dashboard</h1>
        </div>
        <button onClick={() => { setData(null); setLiveReport(null); }} className="text-sm font-bold text-gray-500 hover:text-blue-600">Start New Search</button>
      </div>

      {loading && (
        <div className="text-center mt-32 animate-fade-in">
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
        <main className="max-w-[98%] xl:max-w-7xl mx-auto animate-fade-in w-full">
          <div className="mb-8">
            <h2 className="text-4xl font-black text-gray-900">{data.restaurant_name}</h2>
            <p className="text-gray-500 mt-2 font-medium flex items-center gap-2">
              <Sparkles size={16} className="text-blue-500" /> Summary.
            </p>
          </div>

          {/* SCORECARD GRID */}
          {data.scorecard && data.scorecard.length > 0 && (
            <div className="mb-10">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {data.scorecard.map((item, idx) => {
                  const numScore = item.score !== "N/A" ? parseFloat(item.score.split('/')[0]) : 0;
                  const pct = (numScore / 5) * 100;
                  const barColor = getScoreColor(numScore);

                  return (
                    <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-extrabold text-gray-800 text-sm">{item.aspect}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.confidence === 'High' ? 'bg-blue-50 text-blue-600' :
                            item.confidence === 'Medium' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'
                            }`}>
                            {item.confidence}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="font-black text-2xl text-gray-900">{item.score !== "N/A" ? numScore.toFixed(1) : "-"}</span>
                          {item.score !== "N/A" && <span className="text-gray-400 text-sm font-bold">/5</span>}
                        </div>

                        {item.score !== "N/A" && (
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                            <div className={`${barColor} h-1.5 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }}></div>
                          </div>
                        )}
                      </div>

                      {/* Authentic Quote Box */}
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mt-2">
                        <p className="text-sm text-gray-700 font-medium line-clamp-3 leading-snug italic">
                          {item.evidence}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MIDDLE SECTION: Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 border-t border-b border-gray-200 py-8">
            <MetricCard label="Google Rating" value={`⭐ ${data.stats.google_rating}`} icon={<Star className="text-yellow-500" />} color="yellow" />

            <MetricCard
              label="Organic Sentiment"
              value={
                <div className="flex items-center justify-center gap-2">
                  <span className="text-green-600">{data.stats.genuine_positive} Pos</span>
                  <span className="text-gray-300 text-2xl font-light">|</span>
                  <span className="text-yellow-500">{data.stats.genuine_neutral} Neu</span>
                  <span className="text-gray-300 text-2xl font-light">|</span>
                  <span className="text-red-500">{data.stats.genuine_negative} Neg</span>
                </div>
              }
              icon={<CheckCircle className="text-green-600" />}
              color="green"
            />

            <MetricCard label="High Risk / Synthetic" value={data.stats.fakes} icon={<XCircle className="text-red-600" />} color="red" />
            <MetricCard label="Mismatched Sentiment" value={data.reviews.filter(r => r.is_mismatch).length} icon={<AlertTriangle className="text-orange-600" />} color="orange" />
          </div>

          {/* BOTTOM SECTION: Full Width Raw Feed */}
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-extrabold text-gray-800">Raw Data Feed ({data.stats.total} recent reviews)</h3>
            </div>
            <div className="space-y-6">
              {data.reviews.map((review, idx) => <ReviewCard key={idx} review={review} apiUrl={API_URL} />)}
            </div>
          </div>
        </main>
      )}

      {liveReport && !loading && (
        <main className="max-w-4xl mx-auto animate-fade-in w-full mt-10">
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-xl">
            <div className="mb-6 p-4 bg-gray-50 rounded-lg italic text-gray-700 border-l-4 border-blue-400 shadow-sm text-lg">"{liveText}"</div>
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
      <div className="text-3xl font-extrabold text-gray-900 mb-2">{value}</div>
      <div className="text-[11px] text-gray-500 uppercase font-black tracking-widest">{label}</div>
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
    <div className={`bg-white p-6 rounded-2xl border shadow-sm transition-all ${review.is_fake ? 'border-red-200 bg-red-50/20' : 'border-gray-200 hover:border-blue-200'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider shadow-sm ${review.is_fake ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
            {review.is_fake ? "⚠️ High Risk / Promotional" : "✅ Verified Organic"}
          </span>
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (<Star key={i} size={16} fill={i < review.stars ? "currentColor" : "none"} />))}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold text-gray-800">{review.author}</span>
          {review.date && (
            <span className="text-xs font-medium text-gray-400 mt-1">{review.date}</span>
          )}
        </div>
      </div>
      {!report && <p className="text-gray-700 mb-5 leading-relaxed text-[15px]">{review.text}</p>}
      {report && <div className="mt-4"><AuditResultView report={report} onClose={() => setReport(null)} isStatic={false} /></div>}
      {!report && (
        <button onClick={handleExplain} disabled={loading} className="text-sm font-bold text-blue-600 flex items-center gap-2 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-lg transition-colors">
          {loading ? <BrainCircuit size={16} className="animate-spin" /> : <BrainCircuit size={16} />} Run Deep XAI Audit
        </button>
      )}
    </div>
  );
}

function AuditResultView({ report, onClose, isStatic }: { report: AuditReport, onClose: () => void, isStatic: boolean }) {
  const theme = {
    red: { border: "border-red-200", bg: "bg-red-50/50", headerBg: "bg-red-100/80", headerText: "text-red-900", icon: <ShieldAlert size={18} /> },
    orange: { border: "border-yellow-200", bg: "bg-yellow-50/50", headerBg: "bg-yellow-100/80", headerText: "text-yellow-900", icon: <AlertTriangle size={18} /> },
    green: { border: "border-green-200", bg: "bg-green-50/50", headerBg: "bg-green-100/80", headerText: "text-green-900", icon: <ShieldCheck size={18} /> }
  }[report.verdict_color] || { border: "border-gray-200", bg: "bg-gray-50", headerBg: "bg-gray-100", headerText: "text-gray-900", icon: <Info size={18} /> };

  return (
    <div className={`rounded-xl border overflow-hidden mb-2 shadow-inner ${theme.border} ${theme.bg}`}>
      <div className={`p-4 border-b flex justify-between items-center ${theme.headerBg} ${theme.border}`}>
        <h4 className={`font-black text-sm uppercase flex items-center gap-2 tracking-wide ${theme.headerText}`}>{theme.icon} {report.verdict}</h4>
        {!isStatic && <button onClick={onClose} className="text-[10px] font-black tracking-wider text-gray-500 hover:text-gray-900 uppercase bg-white/50 px-2 py-1 rounded">CLOSE</button>}
      </div>
      <div className="p-5 bg-white/80">
        <div className="mb-5 text-sm font-medium text-gray-800 leading-relaxed border-l-2 border-gray-300 pl-3">{report.summary}</div>
        <div>
          <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Search size={14} className="text-gray-400" /> Evidence Highlights (Hover)</h5>
          <div className="text-gray-800 text-[15px] leading-[2.2] bg-white p-5 rounded-lg border border-gray-100 font-mono shadow-sm">
            {report.raw_explanation?.map((item, i) => {
              if (item.score > 0.05) return <HighlightWithTooltip key={i} word={item.word} colorClass="bg-red-100 text-red-900 border-b-2 border-red-400 font-bold" tooltipText={`+${Math.round(item.score * 100)}% risk factor`} />;
              if (item.score < -0.05) return <HighlightWithTooltip key={i} word={item.word} colorClass="bg-green-100 text-green-900 border-b-2 border-green-400" tooltipText={`+${Math.round(Math.abs(item.score) * 100)}% authenticity`} />;
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
      <span className={`px-1.5 py-0.5 rounded-sm ${colorClass}`}>{word}</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-gray-900 text-white text-[11px] font-bold tracking-wide rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {tooltipText}
      </span><span> </span>
    </span>
  );
}