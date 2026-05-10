from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from .config import TARGET_COL, TREATMENT_COL


def safe_divide(numerator: float, denominator: float) -> float | None:
    if denominator == 0 or pd.isna(denominator):
        return None
    return float(numerator / denominator)


def break_even_uplift(treatment_cost: float, conversion_value: float) -> float | None:
    return safe_divide(treatment_cost, conversion_value)


def calculate_forecast(
    selected_df: pd.DataFrame,
    predicted_uplift: np.ndarray,
    conversion_value: float,
    treatment_cost: float,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    audience = selected_df.copy()
    audience["predicted_uplift"] = predicted_uplift.astype(float)
    audience["expected_value"] = audience["predicted_uplift"] * conversion_value - treatment_cost
    audience["predicted_incremental_revenue"] = audience["predicted_uplift"] * conversion_value
    audience["treatment_cost"] = treatment_cost

    selected_count = len(audience)
    predicted_incremental_conversions = float(audience["predicted_uplift"].sum())
    predicted_incremental_revenue = predicted_incremental_conversions * conversion_value
    campaign_cost = selected_count * treatment_cost
    predicted_profit = predicted_incremental_revenue - campaign_cost

    metrics = {
        "predicted_incremental_conversions": predicted_incremental_conversions,
        "predicted_incremental_revenue": float(predicted_incremental_revenue),
        "campaign_cost": float(campaign_cost),
        "predicted_profit": float(predicted_profit),
        "predicted_roi": safe_divide(predicted_profit, campaign_cost),
        "avg_predicted_uplift": float(audience["predicted_uplift"].mean()) if selected_count else None,
        "median_predicted_uplift": float(audience["predicted_uplift"].median()) if selected_count else None,
        "negative_uplift_share": float((audience["predicted_uplift"] < 0).mean()) if selected_count else None,
        "positive_expected_value_share": float((audience["expected_value"] > 0).mean()) if selected_count else None,
    }
    return audience, metrics


def calculate_simulation_metrics(
    audience_df: pd.DataFrame,
    conversion_value: float,
    treatment_cost: float,
) -> dict[str, Any]:
    selected_count = len(audience_df)
    base = {
        "audience_size": int(selected_count),
        "campaign_cost": float(selected_count * treatment_cost),
        "available": False,
        "error": None,
    }
    if selected_count == 0:
        base["error"] = "empty audience"
        return base
    if TARGET_COL not in audience_df.columns or TREATMENT_COL not in audience_df.columns:
        base["error"] = "missing simulation columns"
        return base

    treatment_mask = audience_df[TREATMENT_COL] == 1
    control_mask = audience_df[TREATMENT_COL] == 0
    if not treatment_mask.any() or not control_mask.any():
        base["error"] = "missing treatment or control group"
        return base

    response_rate_treatment = float(audience_df.loc[treatment_mask, TARGET_COL].mean())
    response_rate_control = float(audience_df.loc[control_mask, TARGET_COL].mean())
    realized_uplift = response_rate_treatment - response_rate_control
    incremental_conversions = selected_count * realized_uplift
    incremental_revenue = incremental_conversions * conversion_value
    campaign_cost = selected_count * treatment_cost
    realized_profit = incremental_revenue - campaign_cost

    return {
        **base,
        "available": True,
        "response_rate_treatment": response_rate_treatment,
        "response_rate_control": response_rate_control,
        "realized_uplift": float(realized_uplift),
        "incremental_conversions": float(incremental_conversions),
        "incremental_revenue": float(incremental_revenue),
        "realized_profit": float(realized_profit),
        "realized_roi": safe_divide(realized_profit, campaign_cost),
    }


def calculate_forecast_errors(
    forecast_metrics: dict[str, Any] | None,
    simulation_metrics: dict[str, Any],
) -> dict[str, Any] | None:
    if not forecast_metrics or not simulation_metrics.get("available"):
        return None

    predicted_profit = forecast_metrics.get("predicted_profit")
    predicted_roi = forecast_metrics.get("predicted_roi")
    predicted_conversions = forecast_metrics.get("predicted_incremental_conversions")
    realized_profit = simulation_metrics.get("realized_profit")
    realized_roi = simulation_metrics.get("realized_roi")
    realized_conversions = simulation_metrics.get("incremental_conversions")

    errors = {
        "profit_error": None if predicted_profit is None else realized_profit - predicted_profit,
        "roi_error": None if predicted_roi is None or realized_roi is None else realized_roi - predicted_roi,
        "incremental_conversions_error": None
        if predicted_conversions is None
        else realized_conversions - predicted_conversions,
    }
    if predicted_profit not in (None, 0):
        errors["profit_error_pct"] = errors["profit_error"] / abs(predicted_profit)
    else:
        errors["profit_error_pct"] = None
    return errors


def baseline_comparison(
    policy_metrics: dict[str, Any],
    filtered_df: pd.DataFrame,
    selected_users_count: int,
    conversion_value: float,
    treatment_cost: float,
    random_state: int = 42,
) -> dict[str, dict[str, Any]]:
    random_count = min(selected_users_count, len(filtered_df))
    random_df = (
        filtered_df.sample(n=random_count, random_state=random_state)
        if random_count > 0
        else filtered_df.head(0)
    )
    baselines = {
        "uplift_policy": policy_metrics,
        "random_same_size": calculate_simulation_metrics(random_df, conversion_value, treatment_cost),
        "target_all": calculate_simulation_metrics(filtered_df, conversion_value, treatment_cost),
        "no_treatment": {
            "available": True,
            "audience_size": 0,
            "realized_uplift": 0.0,
            "incremental_conversions": 0.0,
            "incremental_revenue": 0.0,
            "campaign_cost": 0.0,
            "realized_profit": 0.0,
            "realized_roi": 0.0,
        },
    }

    policy_profit = policy_metrics.get("realized_profit")
    random_profit = baselines["random_same_size"].get("realized_profit")
    target_all_profit = baselines["target_all"].get("realized_profit")
    if policy_profit is not None and random_profit is not None:
        baselines["uplift_policy"]["profit_delta_vs_random"] = policy_profit - random_profit
    if policy_profit is not None and target_all_profit is not None:
        baselines["uplift_policy"]["profit_delta_vs_target_all"] = policy_profit - target_all_profit

    policy_roi = policy_metrics.get("realized_roi")
    random_roi = baselines["random_same_size"].get("realized_roi")
    target_all_roi = baselines["target_all"].get("realized_roi")
    if policy_roi is not None and random_roi is not None:
        baselines["uplift_policy"]["roi_delta_vs_random"] = policy_roi - random_roi
    if policy_roi is not None and target_all_roi is not None:
        baselines["uplift_policy"]["roi_delta_vs_target_all"] = policy_roi - target_all_roi

    return baselines


FORECAST_QUALITY_REQUIRED_COLUMNS = [
    "predicted_profit",
    "realized_profit",
    "predicted_roi",
    "realized_roi",
]


def build_forecast_quality_frame(campaigns: pd.DataFrame) -> pd.DataFrame:
    if campaigns.empty:
        return campaigns.copy()

    result = campaigns.copy()
    for column in FORECAST_QUALITY_REQUIRED_COLUMNS:
        result[column] = pd.to_numeric(result[column], errors="coerce")

    result = result.dropna(subset=FORECAST_QUALITY_REQUIRED_COLUMNS).copy()
    if result.empty:
        return result

    result["created_at"] = pd.to_datetime(result["created_at"], errors="coerce")
    result["profit_error"] = result["realized_profit"] - result["predicted_profit"]
    result["profit_error_pct"] = result["profit_error"] / result["predicted_profit"].abs().replace(0, np.nan)
    result["roi_error"] = result["realized_roi"] - result["predicted_roi"]
    result["absolute_profit_error"] = result["profit_error"].abs()
    result["absolute_percentage_error"] = result["profit_error_pct"].abs()
    result["include_in_metrics"] = True
    return result.sort_values("created_at", ascending=True).reset_index(drop=True)


def aggregate_forecast_quality(campaigns: pd.DataFrame) -> dict[str, Any]:
    if campaigns.empty:
        return {
            "campaigns_count": 0,
            "mean_profit_error": None,
            "mean_absolute_profit_error": None,
            "mean_absolute_percentage_error": None,
            "mean_roi_error": None,
            "forecast_bias": None,
        }

    campaigns = campaigns.copy()
    if "profit_error" not in campaigns.columns:
        campaigns["profit_error"] = campaigns["realized_profit"] - campaigns["predicted_profit"]
    if "profit_error_pct" not in campaigns.columns:
        campaigns["profit_error_pct"] = (
            campaigns["profit_error"] / campaigns["predicted_profit"].abs().replace(0, np.nan)
        )
    if "roi_error" not in campaigns.columns:
        campaigns["roi_error"] = campaigns["realized_roi"] - campaigns["predicted_roi"]
    if "absolute_profit_error" not in campaigns.columns:
        campaigns["absolute_profit_error"] = campaigns["profit_error"].abs()
    if "absolute_percentage_error" not in campaigns.columns:
        campaigns["absolute_percentage_error"] = campaigns["profit_error_pct"].abs()

    mean_profit_error = campaigns["profit_error"].mean()
    return {
        "campaigns_count": int(len(campaigns)),
        "mean_profit_error": float(mean_profit_error),
        "mean_absolute_profit_error": float(campaigns["absolute_profit_error"].mean()),
        "mean_absolute_percentage_error": float(campaigns["absolute_percentage_error"].mean()),
        "mean_roi_error": float(campaigns["roi_error"].mean()),
        "forecast_bias": float(mean_profit_error),
    }
