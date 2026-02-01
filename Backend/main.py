from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from transformers_interpret import SequenceClassificationExplainer
from fastapi.middleware.cors import CORSMiddleware
from textblob import TextBlob
import os

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. LOAD DATA ---
try:
    df = pd.read_csv("final_app_database.csv")
    df['text'] = df['text'].astype(str)
    print(" Database loaded successfully")
except Exception as e:
    print(f" Database Error: {e}")
    df = pd.DataFrame()

# --- 2. LOAD AI MODEL ---
try:
    model_path = "Models" # Ensure this folder exists and has model files
    tokenizer = DistilBertTokenizer.from_pretrained(model_path)
    model = DistilBertForSequenceClassification.from_pretrained(model_path)
    # Using the explainer for XAI
    explainer = SequenceClassificationExplainer(model, tokenizer)
    print(" AI Models loaded successfully")
except Exception as e:
    print(f" Model Error: {e}")
    explainer = None

# --- HELPER FUNCTIONS ---

def clean_token(word):
    """Removes special BERT characters"""
    return word.replace("##", "").strip()

def analyze_risk_factors(explanation_list):
    """Extracts top 3 words that carry positive (Fake) signal."""
    suspicious_words = [
        (clean_token(word), score) for word, score in explanation_list 
        if score > 0.05 and len(clean_token(word)) > 2 and word not in ["[CLS]", "[SEP]"]
    ]
    suspicious_words.sort(key=lambda x: x[1], reverse=True)
    
    evidence = []
    seen = set()
    for word, score in suspicious_words:
        if word in seen: continue
        seen.add(word)
        if len(evidence) >= 3: break
        
        impact = "Medium"
        color = "orange"
        if score > 0.15: # Higher threshold for "Red" impact
            impact = "High"
            color = "red"
            
        evidence.append({
            "word": word,
            "impact": impact,
            "color": color,
            "reason": "Generic / Filler" if impact == "High" else "Unusual Phrasing"
        })
    return evidence

# --- API ENDPOINTS ---

@app.get("/")
def home():
    return {"message": "TrustXplain API is Online 🛡️"}

@app.get("/restaurants")
def get_restaurants():
    if df.empty: return []
    return df['name'].unique().tolist()

@app.get("/search")
def search_restaurant(name: str):
    if df.empty: raise HTTPException(status_code=500, detail="Database not loaded")
    
    subset = df[df['name'] == name]
    if subset.empty: raise HTTPException(status_code=404, detail="Restaurant not found")
    
    total = len(subset)
    fakes = len(subset[subset['deception_prediction'] == 'deceptive'])
    real = total - fakes
    trust_score = int(((total - fakes) / total) * 100) if total > 0 else 0
    
    reviews_data = []
    for _, row in subset.head(10).iterrows():
        reviews_data.append({
            "text": row['text'],
            "stars": int(row['stars']),
            "is_fake": True if row['deception_prediction'] == 'deceptive' else False,
            "is_mismatch": bool(row['inconsistency_flag'])
        })
        
    return {
        "stats": {"total": total, "fakes": fakes, "real": real, "trust_score": trust_score},
        "reviews": reviews_data
    }

class ExplainRequest(BaseModel):
    text: str
    stars: int 

# This Endpoint handles BOTH Database reviews AND Live Custom reviews
@app.post("/explain")
def explain_review(request: ExplainRequest):
    if not explainer:
        raise HTTPException(status_code=500, detail="Model not active")
    
    # 1. LIVE INFERENCE: Run DistilBERT on the text immediately
    inputs = tokenizer(request.text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    
    probs = torch.nn.functional.softmax(outputs.logits, dim=1)
    fake_prob = probs[0][1].item() # Probability of Class 1 (Fake)
    
    # 2. CALCULATE RISK SCORE
    risk_percent = int(fake_prob * 100)
    is_high_risk = risk_percent > 65  # Increased threshold for "High Risk" label

    # 3. LIVE XAI: Run LIME/SHAP via the explainer
    word_attributions = explainer(request.text, class_name="LABEL_1")

    # 4. LIVE INCONSISTENCY CHECK: Run TextBlob immediately
    try:
        blob = TextBlob(request.text)
        sentiment_val = blob.sentiment.polarity
        sentiment_score = int((sentiment_val + 1) * 50) # Convert -1..1 to 0..100
    except:
        sentiment_score = 50 

    rating_score = int((request.stars / 5) * 100)
    consistency_gap = abs(rating_score - sentiment_score)
    is_mismatch = consistency_gap > 40 

    # 5. Generate Badges
    badges = []
    evidence = analyze_risk_factors(word_attributions)

    if risk_percent > 65: # High Risk
        if len(evidence) > 0:
            badges.append({"label": "Generic Keywords", "type": "yellow", "icon": "⚠️"})
        if is_mismatch:
            badges.append({"label": "High Inconsistency", "type": "red", "icon": "⛔"})
        else:
            badges.append({"label": "Deceptive Patterns", "type": "red", "icon": "🚨"})
    elif risk_percent > 45: # Ambiguous / Grey Area
        badges.append({"label": "Mixed Signals", "type": "yellow", "icon": "🤔"})
        if is_mismatch:
            badges.append({"label": "Tone Mismatch", "type": "red", "icon": "📉"})
    else: # Genuine
        badges.append({"label": "Consistent Rating", "type": "green", "icon": "✅"})
        if sentiment_score > 60:
            badges.append({"label": "Positive Sentiment", "type": "blue", "icon": "👍"})
        if risk_percent < 15:
             badges.append({"label": "Specific Details", "type": "green", "icon": "🛡️"})

    # 6. IMPROVED SUMMARY LOGIC (Human-Centric UX)
    # Get top 3 suspicious words for the dynamic sentence
    suspicious_word_list = [item['word'] for item in evidence[:3]]
    suspicious_str = ", ".join(f"'{w}'" for w in suspicious_word_list)

    summary = ""
    verdict = ""
    verdict_color = ""

    # LOGIC:
    # 0% - 45%  : GENUINE (Green)
    # 45% - 65% : AMBIGUOUS / MIXED SIGNALS (Orange) -> The "Safe" Zone
    # 65% - 100%: SUSPICIOUS (Red)

    if risk_percent > 65:
        # High Confidence Fake
        verdict = "CRITICAL ISSUES FOUND"
        verdict_color = "red"
        if suspicious_str:
            summary = (f"This review is flagged as **High Risk** ({risk_percent}% confidence). "
                       f"The model detected an over-reliance on generic promotional buzzwords like **{suspicious_str}**. "
                       "This linguistic pattern is statistically common in paid or non-authentic content.")
        else:
            summary = (f"This review is flagged as **High Risk** ({risk_percent}%). "
                       "While it mimics genuine syntax, the AI detected subtle structural anomalies often found in generated or paid reviews.")

    elif risk_percent > 45:
        # The "Grey Zone" (Inconclusive)
        verdict = "INCONCLUSIVE / MIXED SIGNALS"
        verdict_color = "orange" 
        summary = (f"The analysis is **Inconclusive** ({risk_percent}% risk score). "
                   "The review contains a mix of specific details and generic phrasing. "
                   "It may be a genuine review written in a generic style, or a sophisticated fake. Proceed with caution.")
    
    else:
        # Genuine
        verdict = "AUTHENTICITY VERIFIED"
        verdict_color = "green"
        summary = (f"This review appears **Authentic** ({100 - risk_percent}% confidence). "
                   "The language contains specific, personal details (contextual usage) that align with genuine customer feedback patterns.")

    # 7. Clean Data for Tooltips
    clean_raw_data = []
    for word, score in word_attributions:
        if word not in ["[CLS]", "[SEP]"]:
            clean_raw_data.append({"word": clean_token(word), "score": round(score, 3)})

    return {
        "risk_score": risk_percent,
        "verdict": verdict,
        "verdict_color": verdict_color,
        "summary": summary,
        "trust_badges": badges,
        "sentiment_score": sentiment_score,
        "rating_score": rating_score,
        "consistency_gap": consistency_gap,
        "evidence": evidence,
        "raw_explanation": clean_raw_data
    }