from __future__ import annotations


APP_CSS = """
<style>
:root {
  color-scheme: dark;
  --pilot-primary: #ff4b4b;
  --pilot-primary-soft: rgba(255, 75, 75, 0.16);
  --pilot-secondary: #7dd3fc;
  --pilot-success: #2dd4bf;
  --pilot-warning: #fbbf24;
  --pilot-danger: #fb7185;
  --pilot-bg: #0e1117;
  --pilot-bg-elevated: #171923;
  --pilot-bg-control: #262833;
  --pilot-bg-control-hover: #303341;
  --pilot-border: #343845;
  --pilot-border-strong: #4b5163;
  --pilot-text-primary: #f8fafc;
  --pilot-text-secondary: #d6dae5;
  --pilot-text-muted: #9ca3af;
  --pilot-shadow: rgba(0, 0, 0, 0.32) 0 14px 32px -10px;
}

html,
body,
.stApp,
[data-testid="stAppViewContainer"],
[data-testid="stHeader"],
[data-testid="stToolbar"] {
  background: var(--pilot-bg) !important;
  color: var(--pilot-text-primary) !important;
}

[data-testid="stHeader"] {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

section.main > div {
  padding-top: 1.25rem;
}

.block-container {
  max-width: 1440px;
}

.stApp,
.stApp p,
.stApp span,
.stApp label,
.stApp div,
.stApp h1,
.stApp h2,
.stApp h3,
.stApp h4,
.stApp h5,
.stApp h6 {
  color: var(--pilot-text-primary);
}

.uplift-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.uplift-title h1 {
  margin: 0;
  color: var(--pilot-text-primary);
  font-size: 1.65rem;
  font-weight: 700;
}

.uplift-title p,
.stApp [data-testid="stCaptionContainer"],
.stApp .small-muted {
  margin: 4px 0 0;
  color: var(--pilot-text-muted) !important;
  font-size: 0.92rem;
}

.stApp [data-testid="stMarkdownContainer"] p,
.stApp [data-testid="stWidgetLabel"] p,
.stApp label p {
  color: var(--pilot-text-secondary) !important;
  font-weight: 650;
}

.stApp [data-testid="stWidgetLabel"] {
  min-height: 1.4rem;
}

.stApp input,
.stApp textarea,
.stApp select,
.stApp [contenteditable="true"],
.stApp div[data-baseweb="input"],
.stApp div[data-baseweb="textarea"],
.stApp div[data-baseweb="select"],
.stApp div[data-baseweb="input"] > div,
.stApp div[data-baseweb="textarea"] > div,
.stApp div[data-baseweb="select"] > div,
.stApp [data-baseweb="tag"] {
  background: var(--pilot-bg-control) !important;
  color: var(--pilot-text-primary) !important;
  border-color: var(--pilot-border-strong) !important;
  box-shadow: none !important;
}

.stApp input,
.stApp textarea {
  caret-color: var(--pilot-primary) !important;
  -webkit-text-fill-color: var(--pilot-text-primary) !important;
}

.stApp input::placeholder,
.stApp textarea::placeholder {
  color: var(--pilot-text-muted) !important;
  opacity: 1 !important;
}

.stApp div[data-baseweb="input"]:hover,
.stApp div[data-baseweb="textarea"]:hover,
.stApp div[data-baseweb="select"]:hover,
.stApp div[data-baseweb="input"]:focus-within,
.stApp div[data-baseweb="textarea"]:focus-within,
.stApp div[data-baseweb="select"]:focus-within {
  background: var(--pilot-bg-control-hover) !important;
  border-color: rgba(255, 75, 75, 0.78) !important;
  box-shadow: 0 0 0 3px rgba(255, 75, 75, 0.14) !important;
}

.stApp [data-testid="stNumberInput"] button {
  background: #20222d !important;
  color: var(--pilot-text-secondary) !important;
  border-left: 1px solid var(--pilot-border) !important;
}

.stApp [data-testid="stNumberInput"] button:hover {
  background: #343845 !important;
  color: var(--pilot-text-primary) !important;
}

.stApp button,
.stApp div[data-baseweb="button"] {
  background: var(--pilot-bg-control) !important;
  color: var(--pilot-text-primary) !important;
  border-color: var(--pilot-border-strong) !important;
}

.stApp button:hover {
  background: var(--pilot-bg-control-hover) !important;
  color: var(--pilot-text-primary) !important;
  border-color: rgba(255, 75, 75, 0.78) !important;
}

.stApp [data-testid="baseButton-primary"],
.stApp button[kind="primary"] {
  background: var(--pilot-primary) !important;
  color: #ffffff !important;
  border-color: var(--pilot-primary) !important;
}

.stApp [data-testid="stCheckbox"] label,
.stApp [data-testid="stCheckbox"] p {
  color: var(--pilot-text-secondary) !important;
}

.stApp div[data-baseweb="checkbox"] span,
.stApp [data-testid="stCheckbox"] span {
  border-color: var(--pilot-border-strong) !important;
}

.stApp div[data-baseweb="checkbox"] [aria-checked="true"] span,
.stApp [data-testid="stCheckbox"] [aria-checked="true"] span {
  background-color: var(--pilot-primary) !important;
  border-color: var(--pilot-primary) !important;
}

.stApp [data-baseweb="tab-list"] {
  gap: 16px;
  border-bottom: 1px solid var(--pilot-border);
}

.stApp [data-baseweb="tab"] {
  background: transparent !important;
  border-radius: 0 !important;
  color: var(--pilot-text-muted) !important;
  font-weight: 700 !important;
  padding-left: 10px !important;
  padding-right: 10px !important;
}

.stApp [data-baseweb="tab"]:hover,
.stApp [data-baseweb="tab"][aria-selected="true"] {
  color: var(--pilot-primary) !important;
}

.stApp [data-baseweb="tab-highlight"] {
  background-color: var(--pilot-primary) !important;
  left: 10px !important;
  width: calc(100% - 20px) !important;
}

.stApp [data-testid="stExpander"] {
  background: var(--pilot-bg-elevated) !important;
  border: 1px solid var(--pilot-border) !important;
  border-radius: 8px !important;
  box-shadow: var(--pilot-shadow);
}

.stApp [data-testid="stExpander"] summary,
.stApp [data-testid="stExpander"] summary p,
.stApp [data-testid="stExpander"] svg {
  color: var(--pilot-text-primary) !important;
  fill: var(--pilot-text-primary) !important;
  font-weight: 700 !important;
}

.stApp [data-baseweb="popover"],
.stApp [data-baseweb="menu"],
.stApp [role="listbox"] {
  background: var(--pilot-bg-control) !important;
  color: var(--pilot-text-primary) !important;
  border: 1px solid var(--pilot-border-strong) !important;
  box-shadow: var(--pilot-shadow) !important;
}

.stApp [role="option"] {
  background: var(--pilot-bg-control) !important;
  color: var(--pilot-text-primary) !important;
}

.stApp [role="option"]:hover,
.stApp [aria-selected="true"] {
  background: var(--pilot-primary-soft) !important;
  color: var(--pilot-text-primary) !important;
}

.stApp [data-baseweb="slider"] div,
.stApp [data-testid="stSlider"] div {
  color: var(--pilot-text-secondary) !important;
}

.stApp [data-testid="stSliderTickBar"],
.stApp [data-testid="stSliderTickBarMin"],
.stApp [data-testid="stSliderTickBarMax"] {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

.stApp [data-testid="stSliderThumbValue"] {
  display: inline-flex !important;
  visibility: visible !important;
}

.stApp [data-testid="stSlider"] {
  padding-bottom: 0 !important;
}

.stApp [data-baseweb="tag"] {
  background: var(--pilot-primary) !important;
  border-radius: 6px !important;
}

.stApp [data-baseweb="tag"] span {
  color: #ffffff !important;
}

.kpi-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin: 12px 0 18px;
}

.kpi-card,
div[data-testid="stMetric"] {
  background: var(--pilot-bg-elevated) !important;
  border: 1px solid var(--pilot-border) !important;
  border-radius: 8px;
  box-shadow: var(--pilot-shadow);
}

.kpi-card {
  padding: 14px 16px;
}

.kpi-label {
  margin: 0;
  color: var(--pilot-text-muted) !important;
  font-size: 0.78rem;
  font-weight: 700;
}

.kpi-value {
  margin: 6px 0 0;
  color: var(--pilot-text-primary) !important;
  font-size: 1.28rem;
  font-weight: 800;
}

div[data-testid="stMetric"] {
  padding: 14px 16px;
}

div[data-testid="stDataFrame"] {
  border: 1px solid var(--pilot-border);
  border-radius: 8px;
  overflow: hidden;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1;
}

.status-evaluated { background: rgba(45, 212, 191, 0.16); color: #5eead4; }
.status-launched { background: rgba(125, 211, 252, 0.16); color: #7dd3fc; }
.status-forecasted { background: rgba(255, 75, 75, 0.16); color: #ff8a8a; }
.status-ranked { background: rgba(251, 191, 36, 0.16); color: #fbbf24; }
.status-failed { background: rgba(251, 113, 133, 0.16); color: #fb7185; }

.small-muted {
  color: var(--pilot-text-muted);
  font-size: 0.82rem;
}
</style>
"""
