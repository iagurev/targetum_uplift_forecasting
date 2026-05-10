from __future__ import annotations

from typing import Any

import pandas as pd


def _range_mask(df: pd.DataFrame, column: str, bounds: list[float] | tuple[float, float]) -> pd.Series:
    low, high = bounds
    return df[column].between(low, high, inclusive="both")


def _gt_zero(df: pd.DataFrame, column: str) -> pd.Series:
    if column not in df.columns:
        return pd.Series(False, index=df.index)
    return df[column].fillna(0) > 0


def _positive_range_mask(
    df: pd.DataFrame,
    column: str,
    bounds: list[float] | tuple[float, float] | None,
) -> pd.Series:
    result = _gt_zero(df, column)
    if bounds is not None and column in df.columns:
        result &= _range_mask(df, column, bounds)
    return result


def apply_filters(
    df: pd.DataFrame,
    filter_config: dict[str, Any],
    thresholds: dict[str, float],
) -> pd.DataFrame:
    mask = pd.Series(True, index=df.index)

    for column, bounds in filter_config.get("ranges", {}).items():
        if column in df.columns:
            mask &= _range_mask(df, column, bounds)

    for column, values in filter_config.get("values", {}).items():
        if column in df.columns and values:
            mask &= df[column].isin(values)

    for preset in filter_config.get("presets", []):
        if preset == "active":
            mask &= _gt_zero(df, "total_cheque_count_3m") | _gt_zero(df, "total_sale_sum_3m")
        elif preset == "promo_sensitive":
            preset_mask = pd.Series(False, index=df.index)
            for col in ("promo_share_15d", "mean_discount_depth_15d"):
                if col in df.columns and col in thresholds:
                    preset_mask |= df[col] > thresholds[col]
            mask &= preset_mask
        elif preset == "at_risk":
            preset_mask = pd.Series(False, index=df.index)
            if "perdelta_days_between_visits_15_30d" in df.columns:
                preset_mask |= df["perdelta_days_between_visits_15_30d"] > 0
            if "k_var_days_between_visits_1m" in df.columns and "k_var_days_between_visits_1m" in thresholds:
                preset_mask |= df["k_var_days_between_visits_1m"] > thresholds["k_var_days_between_visits_1m"]
            mask &= preset_mask
        elif preset == "high_value":
            if "total_sale_sum_12m" in df.columns and "months_from_register" in df.columns:
                mask &= (df["total_sale_sum_12m"] > thresholds.get("total_sale_sum_12m", 0)) & (
                    df["months_from_register"] >= 12
                )
            else:
                mask &= False

    category = filter_config.get("category_specific") or {}
    if category.get("enabled"):
        group = category.get("group")
        window = category.get("window")
        metric = category.get("metric", "sale_or_cheque")
        sale_col = f"sale_sum_{window}_{group}"
        cheque_col = f"cheque_count_{window}_{group}"
        category_ranges = category.get("ranges") or {}
        if metric == "sale_sum":
            mask &= _positive_range_mask(df, sale_col, category_ranges.get("sale_sum"))
        elif metric == "cheque_count":
            mask &= _positive_range_mask(df, cheque_col, category_ranges.get("cheque_count"))
        else:
            category_mask = _gt_zero(df, sale_col) | _gt_zero(df, cheque_col)
            if "sale_sum" in category_ranges and sale_col in df.columns:
                category_mask &= _range_mask(df, sale_col, category_ranges["sale_sum"])
            if "cheque_count" in category_ranges and cheque_col in df.columns:
                category_mask &= _range_mask(df, cheque_col, category_ranges["cheque_count"])
            mask &= category_mask

    return df.loc[mask].copy()


def summarize_filters(filter_config: dict[str, Any]) -> str:
    parts: list[str] = []
    parts.extend(filter_config.get("presets", []))
    parts.extend(f"{key}: {value[0]:.3g}-{value[1]:.3g}" for key, value in filter_config.get("ranges", {}).items())
    parts.extend(f"{key}: {value}" for key, value in filter_config.get("values", {}).items() if value)
    category = filter_config.get("category_specific") or {}
    if category.get("enabled"):
        range_parts = [
            f"{key}: {value[0]:.3g}-{value[1]:.3g}"
            for key, value in (category.get("ranges") or {}).items()
        ]
        suffix = f" ({'; '.join(range_parts)})" if range_parts else ""
        parts.append(f"category {category.get('window')} {category.get('group')} {category.get('metric')}{suffix}")
    return ", ".join(parts) if parts else "No filters"
