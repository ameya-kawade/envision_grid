# ML Blueprint: Environmental Risk Prediction

> **Status:** This document specifies the full ML pipeline. Current production uses a `PlaceholderRiskModel` that mimics this behaviour deterministically.

## 1. Data Schema

### Input Tables
| Table | Key Fields | Role |
|-------|-----------|------|
| `violations` | violation_id, timestamp, grid_id, violation_type, severity, source | Primary risk signal |
| `complaints` | complaint_id, timestamp, grid_id, complaint_type, intensity | Early warning signal |
| `sensors` | sensor_id, timestamp, grid_id, aqi, temperature, humidity, gas_index | Validation layer |

### Training Dataset (per grid_id × date)
Each row = one grid cell on one day, with features computed from rolling windows.

## 2. Feature Engineering

All features computed in `src/features.py`:

| Feature | Window | Description |
|---------|--------|-------------|
| `violation_count_{1,3,7}d` | 1/3/7 days | Event frequency |
| `severity_weighted_score_{1,3,7}d` | 1/3/7 days | severity² sum |
| `max_severity_{1,3,7}d` | 1/3/7 days | Peak severity |
| `recency_decay_score` | All | Exponential decay × severity |
| `complaint_count_{1,3,7}d` | 1/3/7 days | Complaint volume |
| `complaint_trend` | 3d/7d | Recent vs. baseline ratio |
| `repeat_offender_score_7d` | 7 days | Repeat source frequency |
| `violation_diversity` | All | Distinct violation types |
| `neighbor_spillover_3d` | 3 days | Mean neighbor severity score |
| `sensor_aqi_mean_1d` | 1 day | Recent AQI average |
| `sensor_aqi_trend_3d` | 3 days | AQI trend (delta) |
| `sensor_spike_flag` | All | Binary — AQI > 150 |

## 3. Target Definition

**Binary target:** Did a severity ≥ 4 event occur in the next `horizon` hours?

**Regression target:** Max severity in next `horizon` hours (normalized to [0,1]).

## 4. Model Architecture

### Recommended: Gradient Boosted Trees (XGBoost / LightGBM)
- Handles mixed feature types well
- Interpretable feature importances
- Fast inference on CPU

### Alternative: Simple MLP
- 2 hidden layers (64, 32), ReLU, dropout 0.3
- For if tree models plateau

### Placeholder (Current)
- Weighted sum of features → sigmoid → risk_score
- Weights in `src/config.py` mirror expected learned coefficients

## 5. Training Loop (Pseudocode)

```python
# 1. Build dataset
df = build_training_set(violations, complaints, sensors, lookback=90)
X = df[FEATURE_COLUMNS]
y = df["target_severity_72h"]

# 2. Train/Val Split (temporal)
X_train, X_val = temporal_split(X, y, test_size=0.2)

# 3. Train
model = XGBRegressor(max_depth=6, n_estimators=200, learning_rate=0.05)
model.fit(X_train, y_train, eval_set=[(X_val, y_val)], early_stopping_rounds=20)

# 4. Calibrate
calibrator = IsotonicRegression()
calibrator.fit(model.predict(X_val), y_val)

# 5. Save
joblib.dump({"model": model, "calibrator": calibrator}, "model_artifact.joblib")
```

## 6. Evaluation Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| AUC-ROC | > 0.80 | Discrimination |
| Brier Score | < 0.15 | Calibration |
| Precision@0.6 | > 0.70 | Alert quality |
| RMSE | < 0.20 | Score accuracy |

## 7. Inference Integration

```python
class TrainedRiskModel(ModelAdapter):
    def __init__(self, artifact_path):
        bundle = joblib.load(artifact_path)
        self.model = bundle["model"]
        self.calibrator = bundle["calibrator"]

    def predict(self, features, risk_type, horizon, use_sensors):
        X = pd.DataFrame([features])[FEATURE_COLUMNS]
        raw = self.model.predict(X)[0]
        risk_score = self.calibrator.predict([raw])[0]
        # ... rest same as PlaceholderRiskModel
```

Swap in `api.py`:
```python
_model = TrainedRiskModel("model_artifact.joblib")
```

No API or UI changes required.
