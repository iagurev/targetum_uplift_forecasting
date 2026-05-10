from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from uplift_app.data import aggregate_total_features
from uplift_app.filters import apply_filters
from uplift_app.metrics import (
    aggregate_forecast_quality,
    build_forecast_quality_frame,
    calculate_simulation_metrics,
    safe_divide,
)
from uplift_app.selection import select_audience
from uplift_app.storage import (
    delete_campaigns,
    get_campaign,
    init_db,
    list_campaigns,
    list_forecast_quality_campaigns,
    save_campaign,
)


def test_aggregate_total_features() -> None:
    df = pd.DataFrame(
        {
            "cheque_count_3m_g1": [1, 2],
            "cheque_count_3m_g2": [3, 4],
            "sale_sum_12m_g1": [10.0, 20.0],
            "sale_sum_12m_g2": [1.5, 2.5],
        }
    )
    result = aggregate_total_features(df)
    assert result["total_cheque_count_3m"].tolist() == [4, 6]
    assert result["total_sale_sum_12m"].tolist() == [11.5, 22.5]
    assert result["total_sale_sum_6m"].tolist() == [0.0, 0.0]


def test_select_audience_respects_budget_and_max_reach() -> None:
    scored = pd.DataFrame({"user_id": range(10), "ranking_score": range(10)})
    selected, metrics = select_audience(
        scored,
        strategy="top_n",
        strategy_params={"top_n": 9},
        treatment_cost=5.0,
        budget=20.0,
        max_reach=3,
        min_reach=2,
        initial_users_count=10,
    )
    assert len(selected) == 3
    assert selected["ranking_score"].tolist() == [9, 8, 7]
    assert metrics["campaign_cost"] == 15.0
    assert metrics["min_reach_met"] is True


def test_category_filter_supports_metric_ranges() -> None:
    df = pd.DataFrame(
        {
            "user_id": [1, 2, 3, 4],
            "sale_sum_3m_g1": [0.0, 50.0, 120.0, 80.0],
            "cheque_count_3m_g1": [0.0, 1.0, 4.0, 9.0],
        }
    )

    sale_filtered = apply_filters(
        df,
        {
            "category_specific": {
                "enabled": True,
                "group": "g1",
                "window": "3m",
                "metric": "sale_sum",
                "ranges": {"sale_sum": [40.0, 100.0]},
            }
        },
        thresholds={},
    )
    assert sale_filtered["user_id"].tolist() == [2, 4]

    cheque_filtered = apply_filters(
        df,
        {
            "category_specific": {
                "enabled": True,
                "group": "g1",
                "window": "3m",
                "metric": "cheque_count",
                "ranges": {"cheque_count": [2.0, 8.0]},
            }
        },
        thresholds={},
    )
    assert cheque_filtered["user_id"].tolist() == [3]


def test_roi_corner_cases() -> None:
    assert safe_divide(10.0, 0.0) is None
    audience = pd.DataFrame({"target": [1, 0, 1], "treatment": [1, 1, 1]})
    metrics = calculate_simulation_metrics(audience, conversion_value=100.0, treatment_cost=0.0)
    assert metrics["available"] is False
    assert metrics["error"] == "missing treatment or control group"


def test_storage_roundtrip(tmp_path: Path) -> None:
    db_path = tmp_path / "campaigns.db"
    init_db(db_path)
    save_campaign(
        {
            "campaign_id": "cmp_test",
            "campaign_name": "Test",
            "campaign_description": "",
            "created_at": "2026-05-08T00:00:00",
            "status": "evaluated",
            "filters_config": {"presets": ["active"]},
            "filters_summary": "active",
            "ranking_model_name": "DR-Learner",
            "ranking_strategy": "top_n",
            "uplift_value_model_name": "DR-Learner",
            "budget": 100.0,
            "treatment_cost": 1.0,
            "conversion_value": 10.0,
            "max_reach": None,
            "min_reach": None,
            "initial_users_count": 3,
            "filtered_users_count": 3,
            "selected_users_count": 1,
            "selection_rate": 1 / 3,
            "campaign_cost": 1.0,
            "budget_used": 1.0,
            "remaining_budget": 99.0,
            "break_even_uplift": 0.1,
            "predicted_profit": 4.0,
            "predicted_roi": 4.0,
        },
        pd.DataFrame({"user_id": [1], "rank": [1], "selected_flag": [True]}),
        {
            "campaign_id": "cmp_test",
            "campaign_cost": 1.0,
            "realized_profit": 5.0,
            "realized_roi": 5.0,
            "baseline_metrics": {},
            "forecast_errors": {},
            "evaluated_at": "2026-05-08T00:00:01",
        },
        db_path=db_path,
    )
    campaigns = list_campaigns(db_path)
    assert campaigns.iloc[0]["campaign_id"] == "cmp_test"
    campaign = get_campaign("cmp_test", db_path)
    assert campaign is not None
    assert campaign["filters_config"] == {"presets": ["active"]}
    quality_campaigns = list_forecast_quality_campaigns(db_path)
    assert quality_campaigns.iloc[0]["campaign_id"] == "cmp_test"
    deleted_count = delete_campaigns(["cmp_test"], db_path)
    assert deleted_count == 1
    assert list_campaigns(db_path).empty
    assert get_campaign("cmp_test", db_path) is None


def test_forecast_quality_frame_and_aggregates() -> None:
    raw = pd.DataFrame(
        {
            "campaign_id": ["a", "b", "c"],
            "campaign_name": ["A", "B", "C"],
            "created_at": ["2026-05-08T00:00:00", "2026-05-09T00:00:00", "2026-05-10T00:00:00"],
            "ranking_model": ["DR", "DR", "DR"],
            "uplift_value_model": ["DR", "DR", "DR"],
            "selected_users_count": [10, 20, 30],
            "predicted_profit": [100.0, 50.0, None],
            "realized_profit": [80.0, 75.0, 10.0],
            "predicted_roi": [1.0, 0.5, 0.1],
            "realized_roi": [0.8, 0.7, 0.2],
        }
    )
    frame = build_forecast_quality_frame(raw)
    assert frame["campaign_id"].tolist() == ["a", "b"]
    assert frame["profit_error"].tolist() == [-20.0, 25.0]
    assert frame["roi_error"].round(6).tolist() == [-0.2, 0.2]
    assert frame["include_in_metrics"].tolist() == [True, True]

    aggregates = aggregate_forecast_quality(frame)
    assert aggregates["campaigns_count"] == 2
    assert aggregates["mean_profit_error"] == 2.5
    assert aggregates["mean_absolute_profit_error"] == 22.5
    assert aggregates["forecast_bias"] == 2.5

    visible_editor_frame = frame.drop(columns=["absolute_profit_error", "absolute_percentage_error"])
    editor_aggregates = aggregate_forecast_quality(visible_editor_frame)
    assert editor_aggregates["campaigns_count"] == 2
    assert editor_aggregates["mean_absolute_profit_error"] == 22.5
