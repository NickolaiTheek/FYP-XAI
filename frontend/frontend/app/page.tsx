"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ShieldAlert, ShieldCheck, Star, AlertTriangle, BrainCircuit } from 'lucide-react';

export default function Home() {
  // State Variables
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Load Restaurant List on Start
  useEffect(() => {
    // Try both localhost and 127.0.0.1 to be safe
    axios.get('http://127.0.0.1:8000/restaurants')
      .then(res => setRestaurants(res.data))
      .catch(err => {
          console.error("Trying localhost...", err);
          axios.get('http://localhost:8000/restaurants')
            .then(res => setRestaurants(res.data))
            .catch(e => console.error("Backend completely offline", e));
      });
  }, []);

  // 2. Handle Search
  const handleSearch = async (name) => {
    setSelectedRestaurant(name);
    setLoading(true);
    setError('');
    setData(null);
    try {
      // Encode the name to handle spaces (e.g., "Fries Rebellion")
      const res = await axios.get(`http://127.0.0.1:8000/search?name=${encodeURIComponent(name)}`);
      setData(res.data);
    } catch (err) {
      setError("Could not load data. Ensure Python Backend is running on port 8000.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      {/* HEADER */}
      <header className="max-w-5xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🛡️ TrustXplain</h1>
        <p className="text-gray-500">AI-Powered Restaurant Credibility Inspector</p>
      </header>

      {/* SEARCH SECTION */}
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

      {/* DASHBOARD CONTENT */}
      {loading && <div className="text-center text-gray-500 animate-pulse">Analyzing reviews... 🤖</div>}
      {error && <div className="text-center text-red-500 bg-red-50 p-4 rounded-lg border border-red-100">{error}</div>}

      {data && (
        <main className="max-w-5xl mx-auto animate-fade-in">
          
          {/* 1. SCORECARDS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <MetricCard 
              label="Trust Score" 
              value={`${data.stats.trust_score}/100`} 
              icon={<ShieldCheck className="text-blue-500" />} 
              color="blue"
            />
            <MetricCard 
              label="Genuine Reviews" 
              value={data.stats.real} 
              icon={<ShieldCheck className="text-green-500" />} 
              color="green"
            />
            <MetricCard 
              label="Suspicious Reviews" 
              value={data.stats.fakes} 
              icon={<ShieldAlert className="text-red-500" />} 
              color="red"
            />
            <MetricCard 
              label="Rating Mismatches" 
              value={data.stats.total - data.stats.real - data.stats.fakes || "0"} 
              icon={<AlertTriangle className="text-orange-500" />} 
              color="orange"
            />
          </div>

          {/* 2. REVIEW LIST */}
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📝 Review Analysis</h2>
          <div className="space-y-6">
            {data.reviews.map((review, idx) => (
              <ReviewCard key={idx} review={review} />
            ))}
          </div>
        </main>
      )}
    </div>
  );
}

// --- COMPONENT: METRIC CARD ---
function MetricCard({ label, value, icon, color }) {
  const colors = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    red: "bg-red-50 border-red-100",
    orange: "bg-orange-50 border-orange-100",
  };
  return (
    <div className={`p-6 rounded-2xl border ${colors[color]} text-center shadow-sm`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="text-3xl font-bold text-gray-800 mb-1">{value}</div>
      <div className="text-sm text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

// --- COMPONENT: REVIEW CARD + XAI LOGIC ---
function ReviewCard({ review }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleExplain = async () => {
    setLoading(true);
    try {
      const res = await axios.post('http://127.0.0.1:8000/explain', { text: review.text });
      setExplanation(res.data.explanation);
    } catch (err) {
      alert("Backend Error: Could not generate explanation.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${review.is_fake ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {review.is_fake ? "🚨 SUSPICIOUS" : "✅ GENUINE"}
          </span>
          <div className="flex items-center text-yellow-500">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={16} fill={i < review.stars ? "currentColor" : "none"} />
            ))}
          </div>
        </div>
        {review.is_mismatch && (
          <span className="flex items-center gap-1 text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded border border-orange-100">
            <AlertTriangle size={14} /> Mismatch Detected
          </span>
        )}
      </div>

      {/* CONTENT AREA */}
      <div className="mb-4 text-gray-700 leading-relaxed text-lg">
        {explanation ? (
          // RENDER HIGHLIGHTED TEXT (XAI)
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
             <div className="flex justify-between items-center mb-3">
               <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI Analysis Mode</p>
               <button onClick={() => setExplanation(null)} className="text-xs text-blue-500 hover:underline">Close XAI</button>
             </div>
             
             <div className="leading-8">
              {explanation.map((item, i) => {
                let style = {};
                // Highlight Logic: Fake signals = Red, Genuine signals = Green
                if (item.score > 0.1) style = { backgroundColor: "#fee2e2", color: "#991b1b", padding: "2px 4px", fontWeight: "500" }; 
                if (item.score < -0.1) style = { backgroundColor: "#dcfce7", color: "#166534", padding: "2px 4px", fontWeight: "500" };
                
                return <span key={i} style={style} className="rounded mx-0.5 transition-colors">{item.word} </span>;
              })}
             </div>
             
             <div className="mt-4 pt-3 border-t border-gray-200 flex gap-6 text-xs text-gray-500">
                <span className="flex items-center gap-2"><div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div> Words indicating Deception</span>
                <span className="flex items-center gap-2"><div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div> Words indicating Authenticity</span>
             </div>
          </div>
        ) : (
          // RENDER PLAIN TEXT
          <p>{review.text}</p>
        )}
      </div>

      {/* ACTION BUTTON */}
      {!explanation && (
        <button 
          onClick={handleExplain} 
          disabled={loading}
          className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg"
        >
          {loading ? "Analyzing..." : <><BrainCircuit size={18} /> Explain Why</>}
        </button>
      )}
    </div>
  );
}