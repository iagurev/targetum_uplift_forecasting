from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .config import DATA_PATH, METADATA_PATH, TARGET_COL, TREATMENT_COL, USER_ID_COL


def _cache_data(func):
    try:
        import streamlit as st

        return st.cache_data(show_spinner=False)(func)
    except Exception:
        return func


def load_metadata(path: str | Path = METADATA_PATH) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8") as fh:
        return json.load(fh)


def aggregate_total_features(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    for window in ("3m", "6m", "12m"):
        cheque_cols = [
            col for col in result.columns if re.fullmatch(rf"cheque_count_{window}_g\d+", col)
        ]
        sale_cols = [col for col in result.columns if re.fullmatch(rf"sale_sum_{window}_g\d+", col)]
        result[f"total_cheque_count_{window}"] = (
            result[cheque_cols].sum(axis=1) if cheque_cols else 0.0
        )
        result[f"total_sale_sum_{window}"] = result[sale_cols].sum(axis=1) if sale_cols else 0.0
    return result


def add_stable_user_id(df: pd.DataFrame) -> pd.DataFrame:
    if USER_ID_COL in df.columns:
        return df
    result = df.copy()
    result.insert(0, USER_ID_COL, np.arange(len(result), dtype=np.int64))
    return result


def compute_p75_thresholds(df: pd.DataFrame) -> dict[str, float]:
    fields = [
        "promo_share_15d",
        "mean_discount_depth_15d",
        "k_var_days_between_visits_1m",
        "total_sale_sum_12m",
    ]
    thresholds: dict[str, float] = {}
    for field in fields:
        if field in df.columns:
            thresholds[field] = float(df[field].quantile(0.75))
    return thresholds


@_cache_data
def load_dataset(
    csv_path: str | Path = DATA_PATH,
    metadata_path: str | Path = METADATA_PATH,
) -> tuple[pd.DataFrame, dict[str, Any], dict[str, float]]:
    metadata = load_metadata(metadata_path)
    df = pd.read_csv(csv_path)
    df = add_stable_user_id(df)
    df = aggregate_total_features(df)
    thresholds = compute_p75_thresholds(df)
    return df, metadata, thresholds


def feature_frame(df: pd.DataFrame, features: list[str]) -> pd.DataFrame:
    missing = [feature for feature in features if feature not in df.columns]
    if missing:
        raise ValueError(f"Missing model features: {', '.join(missing[:8])}")
    return df.loc[:, features]


def numeric_bounds(df: pd.DataFrame, column: str) -> tuple[float, float]:
    series = pd.to_numeric(df[column], errors="coerce").dropna()
    if series.empty:
        return 0.0, 0.0
    return float(series.min()), float(series.max())


def available_product_groups(columns: list[str] | pd.Index) -> list[str]:
    groups: set[str] = set()
    for col in columns:
        match = re.search(r"_g(\d+)$", col)
        if match:
            groups.add(f"g{match.group(1)}")
    return sorted(groups, key=lambda item: int(item[1:]))


def ensure_simulation_columns(df: pd.DataFrame) -> None:
    missing = [col for col in (TARGET_COL, TREATMENT_COL) if col not in df.columns]
    if missing:
        raise ValueError(f"Missing simulation columns: {', '.join(missing)}")
