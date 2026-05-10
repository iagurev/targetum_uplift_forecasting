from __future__ import annotations

import math
from typing import Any

import pandas as pd


def _budget_limit(budget: float | None, treatment_cost: float) -> int | None:
    if budget is None:
        return None
    if treatment_cost <= 0:
        return None
    return max(0, int(math.floor(budget / treatment_cost)))


def select_audience(
    scored_df: pd.DataFrame,
    strategy: str,
    strategy_params: dict[str, Any],
    treatment_cost: float,
    budget: float | None,
    max_reach: int | None,
    min_reach: int | None,
    initial_users_count: int,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    ranked = scored_df.sort_values("ranking_score", ascending=False).reset_index(drop=True)
    available = len(ranked)

    if available == 0:
        selected_count = 0
    elif strategy == "top_k_percent":
        percent = max(0.0, float(strategy_params.get("top_k_percent", 10.0)))
        selected_count = int(math.ceil(available * percent / 100.0))
    elif strategy == "top_n":
        selected_count = int(strategy_params.get("top_n", 1000))
    elif strategy == "budget_constrained":
        selected_count = _budget_limit(budget, treatment_cost) or available
    elif strategy == "max_reach_constrained":
        selected_count = max_reach if max_reach is not None else available
    else:
        selected_count = available

    selected_count = max(0, selected_count)
    budget_limit = _budget_limit(budget, treatment_cost)
    if budget_limit is not None:
        selected_count = min(selected_count, budget_limit)
    if max_reach is not None:
        selected_count = min(selected_count, max_reach)
    selected_count = min(selected_count, available)

    selected = ranked.head(selected_count).copy()
    if selected_count:
        selected["rank"] = range(1, selected_count + 1)
    else:
        selected["rank"] = pd.Series(dtype="int64")
    selected["selected_flag"] = True

    campaign_cost = float(selected_count * treatment_cost)
    remaining_budget = None if budget is None else float(budget - campaign_cost)
    metrics = {
        "initial_users_count": int(initial_users_count),
        "filtered_users_count": int(available),
        "selected_users_count": int(selected_count),
        "selection_rate": selected_count / initial_users_count if initial_users_count else None,
        "campaign_cost": campaign_cost,
        "budget_used": campaign_cost,
        "remaining_budget": remaining_budget,
        "min_reach_met": min_reach is None or selected_count >= min_reach,
    }
    return selected, metrics
