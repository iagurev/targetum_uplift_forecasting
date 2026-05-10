from __future__ import annotations

import io
import pickle
from typing import Any

import numpy as np
import pandas as pd

from .config import MODEL_REGISTRY, ModelSpec
from .data import feature_frame


def _patch_torch_cpu_deserialization() -> None:
    import torch
    import torch.storage

    def _load_from_bytes_cpu(payload: bytes):
        return torch.load(io.BytesIO(payload), map_location="cpu", weights_only=False)

    torch.storage._load_from_bytes = _load_from_bytes_cpu


def load_model(model_key: str) -> Any:
    spec = MODEL_REGISTRY[model_key]
    if model_key == "cfrnet_mmd":
        _patch_torch_cpu_deserialization()
    with spec.path.open("rb") as fh:
        model = pickle.load(fh)
    return model


def predict_uplift(
    model_key: str,
    model: Any,
    df: pd.DataFrame,
    features: list[str],
    batch_size: int = 8192,
) -> np.ndarray:
    X = feature_frame(df, features)
    if model_key == "class_transformation":
        return _predict_class_transformation(model, X)
    if model_key == "dr_learner":
        return _predict_dr_learner(model, X)
    if model_key == "cfrnet_mmd":
        return _predict_cfrnet_mmd(model, X, batch_size=batch_size)
    raise ValueError(f"Unknown model: {model_key}")


def _predict_class_transformation(model: Any, X: pd.DataFrame) -> np.ndarray:
    probabilities = model.model.predict_proba(X)
    return np.asarray(2.0 * probabilities[:, 1] - 1.0, dtype=float)


def _predict_dr_learner(model: Any, X: pd.DataFrame) -> np.ndarray:
    return np.asarray(model.final_model.predict(X), dtype=float)


def _predict_cfrnet_mmd(model: Any, X: pd.DataFrame, batch_size: int = 8192) -> np.ndarray:
    import torch

    model.model.to("cpu")
    model.model.eval()
    transformed = model.preprocessor.transform(X)
    if hasattr(transformed, "toarray"):
        transformed = transformed.toarray()
    transformed = np.asarray(transformed, dtype=np.float32)

    outputs: list[np.ndarray] = []
    with torch.no_grad():
        for start in range(0, len(transformed), batch_size):
            batch = torch.as_tensor(transformed[start : start + batch_size], dtype=torch.float32)
            backbone = model.model.backbone.net if hasattr(model.model.backbone, "net") else model.model.backbone
            representation = backbone(batch)
            y0_logit = model.model.head_control(representation).squeeze(-1)
            y1_logit = model.model.head_treat(representation).squeeze(-1)
            uplift = torch.sigmoid(y1_logit) - torch.sigmoid(y0_logit)
            outputs.append(uplift.cpu().numpy())
    return np.concatenate(outputs).astype(float)


def model_options_for_ranking() -> list[ModelSpec]:
    return [spec for spec in MODEL_REGISTRY.values() if spec.supports_ranking]


def model_options_for_forecast() -> list[ModelSpec]:
    return [spec for spec in MODEL_REGISTRY.values() if spec.supports_absolute_uplift]

