# AI Risk Manager

A production-ready platform for **AI model risk assessment, compliance checking, and monitoring** with LLM-powered analysis (Gemini/OpenAI/Anthropic), real-time dashboard, and multi-channel alerting.

## 🚀 Features

| Category | Capabilities |
|----------|--------------|
| **Risk Assessment** | 12-category LLM-powered analysis (bias, security, privacy, robustness, explainability, drift, ethics, compliance, performance, safety, transparency, governance) |
| **Compliance Checking** | 12 frameworks: EU AI Act, NIST AI RMF, ISO 42001, GDPR, CCPA, HIPAA, SOC2, ISO 27001, Algorithmic Accountability, Model Cards, Data Sheets, Responsible AI |
| **Model Cards** | Auto-generate FAT*/Model Card documentation per industry standards |
| **Dashboard** | Real-time metrics, interactive Plotly charts, model registry, search/filter, assessment modal |
| **Alerting** | Multi-channel (Email, Slack, Webhook, PagerDuty, OpsGenie, In-App) with rules engine |
| **Authentication** | JWT-based auth with role-based access (admin, analyst, viewer) |
| **Data Persistence** | MongoDB Atlas with models, assessments, alerts, users |

---

## 🏗 Architecture

```
gixy/
├── .env                 # Environment config (copy from .env.example)
├── public/
│   └── index.html       # Single-file dashboard (Framer Motion + Plotly + Lucide)
├── src/
│   ├── index.mjs        # Express server entry point (ESM)
│   ├── config/          # Configuration (DB, LLM providers, alerts)
│   ├── llm/             # LLM providers (Gemini, OpenAI, Anthropic) + engines
│   │   ├── GeminiProvider.js
│   │   ├── OpenAIProvider.js
│   │   ├── AnthropicProvider.js
│   │   ├── RiskAnalysisEngine.js
│   │   ├── ComplianceChecker.js
│   │   ├── ModelCardGenerator.js
│   │   └── LLMProviderFactory.js
│   ├── alerts/          # Alerting system
│   │   ├── AlertRulesEngine.js
│   │   ├── AlertStore.js (Mongo + Memory)
│   │   ├── NotificationManager.js
│   │   └── channels/ (Email, Slack, Webhook, PagerDuty, OpsGenie, InApp)
│   ├── api/
│   │   └── routes.js    # REST API routes
│   ├── models/          # Mongoose models (User, Model, Assessment, Alert)
│   ├── engine/          # Heuristic risk engine (fallback)
│   └── validation/      # Joi schemas
├── tests/               # Jest unit tests (130+ passing)
└── package.json
```

---

## 📋 Prerequisites

- **Node.js** >= 18.x
- **npm** >= 10.x
- **MongoDB** (local or Atlas URI)
- **LLM API Key** (at least one): Gemini (free), OpenAI, or Anthropic

---

## ⚡ Quick Start

```bash
# 1. Clone & install
git clone https://github.com/your-org/gixy.git
cd gixy
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your keys (see Configuration below)

# 3. Start server (port 3007)
npm run dev
# or production:
npm start

# 4. Open dashboard
open http://localhost:3007/dashboard
```

---

## ⚙️ Configuration (`.env`)

```env
# ============================================
# SERVER
# ============================================
PORT=3007
NODE_ENV=development
JWT_SECRET=your-32-char-random-string  # generate: openssl rand -base64 32

# ============================================
# DATABASE (MongoDB Atlas recommended)
# ============================================
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/gixy

# ============================================
# LLM PROVIDERS (at least ONE required)
# ============================================

# Google Gemini (FREE tier: 15 RPM, 1M tokens/day)
# Get key: https://aistudio.google.com/apikey
GEMINI_API_KEY=your-gemini-key
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_DEFAULT_MODEL=gemini-3.6-flash

# OpenAI (optional fallback)
# OPENAI_API_KEY=sk-your-openai-key
# OPENAI_DEFAULT_MODEL=gpt-4o-mini

# Anthropic (optional fallback)
# ANTHROPIC_API_KEY=sk-ant-your-key
# ANTHROPIC_DEFAULT_MODEL=claude-3-5-haiku-20241022

# Default provider for engines
RISK_ANALYSIS_PROVIDER=gemini
COMPLIANCE_CHECKER_PROVIDER=gemini
MODEL_CARD_GENERATOR_PROVIDER=gemini

# ============================================
# ALERTING CHANNELS (optional)
# ============================================
# Email (SMTP)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=alerts@yourorg.com
# SMTP_PASS=your-app-password
# ALERT_FROM_EMAIL=alerts@yourorg.com

# Slack
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# PagerDuty
# PAGERDUTY_ROUTING_KEY=your-routing-key

# OpsGenie
# OPSGENIE_API_KEY=your-api-key
# OPSGENIE_REGION=us  # or eu

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info
```

---

## 🌐 API Endpoints

### Health & Public
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | ❌ | Server health |
| GET | `/api/v1/health` | ❌ | API health + DB status |
| POST | `/api/public/risk/quick-check` | ❌ | Quick heuristic risk assessment |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| GET | `/api/v1/auth/me` | Get current user (requires JWT) |

### LLM-Powered Risk Analysis (requires JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/risk/assess-llm` | Full 12-category risk assessment |
| POST | `/api/v1/compliance/check-llm` | Compliance check (12 frameworks) |
| POST | `/api/v1/model-cards/generate` | Generate FAT* model card |

### Heuristic Risk Engine (requires JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/risk/assess` | Heuristic risk assessment |
| POST | `/api/v1/compliance/check` | Heuristic compliance check |
| GET | `/api/v1/risk/history` | Assessment history |

### Models & Registry (requires JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/models` | List registered models |
| POST | `/api/v1/models` | Register new model |
| GET | `/api/v1/models/:id` | Get model details |
| PUT | `/api/v1/models/:id` | Update model |
| DELETE | `/api/v1/models/:id` | Delete model |

### Alerting (requires JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/alerts` | List alerts (with filters) |
| GET | `/api/v1/alerts/:id` | Get alert details |
| PATCH | `/api/v1/alerts/:id/acknowledge` | Acknowledge alert |
| PATCH | `/api/v1/alerts/:id/resolve` | Resolve alert |
| PATCH | `/api/v1/alerts/:id/suppress` | Suppress alert |
| GET | `/api/v1/alerts/stats/summary` | Alert statistics |
| POST | `/api/v1/alerts/rules` | Create alert rule |
| GET | `/api/v1/alerts/rules` | List alert rules |
| PATCH | `/api/v1/alerts/rules/:id` | Update rule |
| POST | `/api/v1/alerts/rules/:id/trigger` | Manually trigger rule |
| POST | `/api/v1/alerts/channels` | Create notification channel |
| GET | `/api/v1/alerts/channels` | List channels |

---

## 🧪 Example API Usage

```bash
# 1. Register & login
curl -X POST http://localhost:3007/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@company.com","password":"Secure123","name":"Your Name"}'

TOKEN=$(curl -s -X POST http://localhost:3007/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@company.com","password":"Secure123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])")

# 2. Quick risk check (no auth needed)
curl -X POST http://localhost:3007/api/public/risk/quick-check \
  -H "Content-Type: application/json" \
  -d '{"modelId":"fraud-v3","modelName":"Fraud Detector","modelConfig":{"type":"classification","framework":"xgboost"},"metrics":{"accuracy":0.94,"precision":0.91,"recall":0.89}}'

# 3. LLM Risk Assessment (12 categories)
curl -X POST http://localhost:3007/api/v1/risk/assess-llm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modelId":"fraud-v3","modelName":"Fraud Detector v3","modelConfig":{"type":"classification","framework":"xgboost","version":"1.3.0"},"trainingData":{"size":500000,"features":45,"stats":{"demographic_parity":0.72}},"metrics":{"accuracy":0.94,"precision":0.91,"recall":0.89,"f1":0.90,"auc_roc":0.96}}'

# 4. Compliance Check (EU AI Act)
curl -X POST http://localhost:3007/api/v1/compliance/check-llm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modelId":"fraud-v3","framework":"eu-ai-act","modelDetails":{"riskCategory":"high","intendedUse":"Fraud detection for financial transactions"}}'

# 5. Generate Model Card
curl -X POST http://localhost:3007/api/v1/model-cards/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modelId":"fraud-v3","modelName":"Fraud Detector v3","modelConfig":{"type":"classification","framework":"xgboost"},"metrics":{"accuracy":0.94,"precision":0.91,"recall":0.89},"intendedUse":"Real-time fraud detection","limitations":"Reduced performance on new merchant categories"}'
```

---

## 📊 Dashboard

Open `http://localhost:3007/dashboard` for a **professional single-page dashboard** with:

- **4 Metric Cards**: Total Models, Avg Risk Score, Critical Alerts, Assessments Run
- **4 Interactive Charts**: Bias Radar, Security Radar, Performance Bars, Risk Trend (Plotly.js)
- **Models Table**: Search, filter by risk level, sortable, paginated
- **New Assessment Modal**: Full form with model config, metrics, risk factors, LLM toggle
- **Framer Motion Animations**: Staggered entrance, hover micro-interactions, smooth transitions
- **3-Color Professional Palette**: Deep Navy, Elevated Surface, Cyan-500 accent
- **Responsive**: Works on desktop, tablet, mobile
- **Accessible**: Reduced motion support, keyboard navigation, ARIA labels

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- tests/unit/alerts.test.js

# Watch mode
npm test -- --watch
```

**Test Coverage**: 130+ tests passing (types, channels, engine, store, manager, config, LLM providers)

---

## 🐳 Docker

```bash
# Build
docker build -t gixy .

# Run with docker-compose
docker-compose up -d

# Or run directly
docker run -p 3007:3007 --env-file .env gixy
```

---

## 📁 Project Scripts

```json
{
  "scripts": {
    "start": "node --experimental-vm-modules src/index.mjs",
    "dev": "node --experimental-vm-modules -r dotenv/config src/index.mjs",
    "test": "node --experimental-vm-modules -r dotenv/config node_modules/.bin/jest",
    "test:watch": "npm test -- --watch"
  }
}
```

---

## 🔧 Development

### Adding a New LLM Provider

1. Create `src/llm/NewProvider.js` extending `LLMProvider` base class
2. Implement: `generate()`, `getAvailableModels()`, `validateConfig()`, `getDefaultModel()`
3. Register in `src/llm/LLMProviderFactory.js`
4. Add config in `src/llm/config.js`

### Adding an Alert Channel

1. Create `src/alerts/channels/NewChannel.js` extending `AlertChannel`
2. Implement: `send(notification)`, `validateConfig()`, `testConnection()`
3. Export in `src/alerts/channels/index.js`

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Dashboard blank | Check browser console; Framer Motion CDN may be blocked - content still works |
| MongoDB connection failed | Verify `MONGODB_URI` in `.env`, check Atlas IP whitelist |
| LLM calls fail | Verify API key in `.env`, check rate limits, check model name |
| Port 3007 busy | Change `PORT` in `.env` or kill existing: `pkill -f "node.*src/index.mjs"` |
| JWT errors | Ensure `JWT_SECRET` is 32+ chars, same across restarts |

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📞 Support

For issues, open a GitHub issue or check the `/health` endpoint for system status.