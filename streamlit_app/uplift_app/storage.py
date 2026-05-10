from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .config import APP_DATA_DIR, DB_PATH, USER_ID_COL


def _json_default(value: Any) -> Any:
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    return str(value)


def _json_dumps(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, default=_json_default)


def _json_loads(value: str | None) -> Any:
    if not value:
        return None
    return json.loads(value)


def get_connection(db_path: str | Path = DB_PATH) -> sqlite3.Connection:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str | Path = DB_PATH) -> None:
    with get_connection(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS campaign_runs (
                campaign_id TEXT PRIMARY KEY,
                campaign_name TEXT NOT NULL,
                campaign_description TEXT,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL,
                filters_config TEXT,
                filters_summary TEXT,
                ranking_model_name TEXT NOT NULL,
                ranking_strategy TEXT NOT NULL,
                uplift_value_model_name TEXT,
                budget REAL,
                treatment_cost REAL NOT NULL,
                conversion_value REAL NOT NULL,
                max_reach INTEGER,
                min_reach INTEGER,
                initial_users_count INTEGER,
                filtered_users_count INTEGER,
                selected_users_count INTEGER NOT NULL,
                selection_rate REAL,
                campaign_cost REAL NOT NULL,
                budget_used REAL,
                remaining_budget REAL,
                break_even_uplift REAL,
                predicted_incremental_conversions REAL,
                predicted_incremental_revenue REAL,
                predicted_profit REAL,
                predicted_roi REAL,
                avg_predicted_uplift REAL,
                median_predicted_uplift REAL,
                negative_uplift_share REAL,
                positive_expected_value_share REAL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS campaign_metrics (
                campaign_id TEXT PRIMARY KEY,
                response_rate_treatment REAL,
                response_rate_control REAL,
                realized_uplift REAL,
                incremental_conversions REAL,
                incremental_revenue REAL,
                campaign_cost REAL,
                realized_profit REAL,
                realized_roi REAL,
                baseline_metrics TEXT,
                forecast_errors TEXT,
                evaluated_at TEXT,
                error TEXT,
                FOREIGN KEY(campaign_id) REFERENCES campaign_runs(campaign_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS selected_audience (
                campaign_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                rank INTEGER,
                predicted_uplift REAL,
                expected_value REAL,
                predicted_incremental_revenue REAL,
                treatment_cost REAL,
                selected_flag INTEGER,
                PRIMARY KEY(campaign_id, user_id),
                FOREIGN KEY(campaign_id) REFERENCES campaign_runs(campaign_id)
            )
            """
        )


def save_campaign(
    campaign_run: dict[str, Any],
    selected_audience: pd.DataFrame,
    campaign_metrics: dict[str, Any],
    db_path: str | Path = DB_PATH,
) -> None:
    init_db(db_path)
    run = dict(campaign_run)
    run["filters_config"] = _json_dumps(run.get("filters_config"))

    run_columns = [
        "campaign_id",
        "campaign_name",
        "campaign_description",
        "created_at",
        "status",
        "filters_config",
        "filters_summary",
        "ranking_model_name",
        "ranking_strategy",
        "uplift_value_model_name",
        "budget",
        "treatment_cost",
        "conversion_value",
        "max_reach",
        "min_reach",
        "initial_users_count",
        "filtered_users_count",
        "selected_users_count",
        "selection_rate",
        "campaign_cost",
        "budget_used",
        "remaining_budget",
        "break_even_uplift",
        "predicted_incremental_conversions",
        "predicted_incremental_revenue",
        "predicted_profit",
        "predicted_roi",
        "avg_predicted_uplift",
        "median_predicted_uplift",
        "negative_uplift_share",
        "positive_expected_value_share",
    ]

    metrics = dict(campaign_metrics)
    metrics["baseline_metrics"] = _json_dumps(metrics.get("baseline_metrics"))
    metrics["forecast_errors"] = _json_dumps(metrics.get("forecast_errors"))
    metric_columns = [
        "campaign_id",
        "response_rate_treatment",
        "response_rate_control",
        "realized_uplift",
        "incremental_conversions",
        "incremental_revenue",
        "campaign_cost",
        "realized_profit",
        "realized_roi",
        "baseline_metrics",
        "forecast_errors",
        "evaluated_at",
        "error",
    ]

    audience_columns = [
        USER_ID_COL,
        "rank",
        "predicted_uplift",
        "expected_value",
        "predicted_incremental_revenue",
        "treatment_cost",
        "selected_flag",
    ]

    with get_connection(db_path) as conn:
        placeholders = ", ".join("?" for _ in run_columns)
        conn.execute(
            f"INSERT OR REPLACE INTO campaign_runs ({', '.join(run_columns)}) VALUES ({placeholders})",
            [run.get(col) for col in run_columns],
        )

        placeholders = ", ".join("?" for _ in metric_columns)
        conn.execute(
            f"INSERT OR REPLACE INTO campaign_metrics ({', '.join(metric_columns)}) VALUES ({placeholders})",
            [metrics.get(col) for col in metric_columns],
        )

        conn.execute("DELETE FROM selected_audience WHERE campaign_id = ?", (run["campaign_id"],))
        rows = []
        for _, item in selected_audience.iterrows():
            rows.append(
                [run["campaign_id"]]
                + [
                    None if pd.isna(item.get(col)) else item.get(col)
                    for col in audience_columns
                ]
            )
        if rows:
            placeholders = ", ".join("?" for _ in range(len(audience_columns) + 1))
            conn.executemany(
                f"""
                INSERT INTO selected_audience
                (campaign_id, user_id, rank, predicted_uplift, expected_value,
                 predicted_incremental_revenue, treatment_cost, selected_flag)
                VALUES ({placeholders})
                """,
                rows,
            )


def list_campaigns(db_path: str | Path = DB_PATH) -> pd.DataFrame:
    init_db(db_path)
    with get_connection(db_path) as conn:
        return pd.read_sql_query(
            """
            SELECT
                r.campaign_id,
                r.campaign_name,
                r.created_at,
                r.status,
                r.ranking_model_name,
                r.uplift_value_model_name,
                r.selected_users_count,
                r.campaign_cost,
                r.predicted_profit,
                m.realized_profit,
                m.realized_roi
            FROM campaign_runs r
            LEFT JOIN campaign_metrics m ON m.campaign_id = r.campaign_id
            ORDER BY r.created_at DESC
            """,
            conn,
        )


def delete_campaigns(campaign_ids: list[str], db_path: str | Path = DB_PATH) -> int:
    init_db(db_path)
    ids = [campaign_id for campaign_id in campaign_ids if campaign_id]
    if not ids:
        return 0

    placeholders = ", ".join("?" for _ in ids)
    with get_connection(db_path) as conn:
        conn.execute(f"DELETE FROM selected_audience WHERE campaign_id IN ({placeholders})", ids)
        conn.execute(f"DELETE FROM campaign_metrics WHERE campaign_id IN ({placeholders})", ids)
        cursor = conn.execute(f"DELETE FROM campaign_runs WHERE campaign_id IN ({placeholders})", ids)
        return int(cursor.rowcount)


def list_forecast_quality_campaigns(db_path: str | Path = DB_PATH) -> pd.DataFrame:
    init_db(db_path)
    with get_connection(db_path) as conn:
        return pd.read_sql_query(
            """
            SELECT
                r.campaign_id,
                r.campaign_name,
                r.created_at,
                r.ranking_model_name AS ranking_model,
                r.uplift_value_model_name AS uplift_value_model,
                r.selected_users_count,
                r.predicted_profit,
                m.realized_profit,
                r.predicted_roi,
                m.realized_roi
            FROM campaign_runs r
            INNER JOIN campaign_metrics m ON m.campaign_id = r.campaign_id
            WHERE
                r.predicted_profit IS NOT NULL
                AND m.realized_profit IS NOT NULL
                AND r.predicted_roi IS NOT NULL
                AND m.realized_roi IS NOT NULL
            ORDER BY r.created_at ASC
            """,
            conn,
        )


def get_campaign(campaign_id: str, db_path: str | Path = DB_PATH) -> dict[str, Any] | None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        row = conn.execute("SELECT * FROM campaign_runs WHERE campaign_id = ?", (campaign_id,)).fetchone()
    if row is None:
        return None
    result = dict(row)
    result["filters_config"] = _json_loads(result.get("filters_config"))
    return result


def get_metrics(campaign_id: str, db_path: str | Path = DB_PATH) -> dict[str, Any] | None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        row = conn.execute("SELECT * FROM campaign_metrics WHERE campaign_id = ?", (campaign_id,)).fetchone()
    if row is None:
        return None
    result = dict(row)
    result["baseline_metrics"] = _json_loads(result.get("baseline_metrics"))
    result["forecast_errors"] = _json_loads(result.get("forecast_errors"))
    return result


def get_selected_audience(campaign_id: str, db_path: str | Path = DB_PATH) -> pd.DataFrame:
    init_db(db_path)
    with get_connection(db_path) as conn:
        return pd.read_sql_query(
            """
            SELECT
                campaign_id,
                user_id,
                rank,
                predicted_uplift,
                expected_value,
                predicted_incremental_revenue,
                treatment_cost,
                selected_flag
            FROM selected_audience
            WHERE campaign_id = ?
            ORDER BY rank
            """,
            conn,
            params=(campaign_id,),
        )
