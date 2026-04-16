#  TrustXplain: Explainable AI for Deceptive Opinion Spam Detection



TrustXplain is a real-time, explainable AI system engineered to detect deceptive opinion spam, specifically targeting sophisticated fake reviews written by paid humans that bypass standard keyword filters. 

To overcome the limitations of traditional "black box" models, TrustXplain utilizes a novel "Smart Data Fusion" approach. It integrates a fine-tuned DistilBERT transformer model to process the semantic meaning of review text alongside numerical behavioral metadata (such as star ratings and word counts) to uncover structural clues of deception. This hybrid methodology achieves a highly robust **91% detection accuracy**. 

Furthermore, TrustXplain prioritizes digital trust through visual transparency. By incorporating SHAP, the system provides word-level attributions to visually explain its classification decisions, while leveraging Gemini LLMs to generate hallucination-free, aspect-based sentiment summaries.

---

## ✨ Key Features

* **🧠 Smart Metadata Fusion:** Combines raw review text with structural metadata (ratings, length, etc.) to catch sophisticated, human-written fake reviews.
* **🔍 Deep XAI Audits:** Utilizes SHAP (SHapley Additive exPlanations) to shatter the AI black box, highlighting exactly which words and data points influenced the classification.
* **⚡ Live Data Pipeline:** Moves beyond static datasets by using SerpApi to fetch and analyze real-world restaurant and business reviews in real-time.
* **📊 LLM-Powered Summaries:** Uses Gemini AI to generate accurate, aspect-based sentiment scorecards (Food, Service, Atmosphere) directly from organic reviews.

---

## 🛠️ System Architecture & Tech Stack

TrustXplain is built on a decoupled, high-performance 4-tier architecture:

### 1. Presentation Tier (Frontend)
* **Framework:** Next.js, React
* **Language:** TypeScript
* **Styling:** Tailwind CSS

### 2. Application Tier (Backend)
* **Framework:** FastAPI
* **Language:** Python
* **Caching:** Redis

### 3. Machine Learning Tier
* **Core Model:** DistilBERT (Hugging Face)
* **Deep Learning:** PyTorch
* **Explainability:** SHAP
* **Summarization:** Gemini LLM API

### 4. Data Tier
* **Live Fetching:** SerpApi (Google Maps Reviews)
* **Training Data:** Deceptive Opinion Spam Corpus & Filtered Yelp Datasets

---

## 🚀 Installation & Setup

To run TrustXplain locally, you will need to start both the FastAPI backend and the Next.js frontend.

### Prerequisites
* Python 3.9+
* Node.js 18+
* API Keys for SerpApi and Gemini

### 1. Backend Setup (FastAPI & ML)
Navigate to the backend directory and install the required Python packages.

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install -r requirements.txt
