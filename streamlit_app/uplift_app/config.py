from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = PROJECT_ROOT / "streamlit_app"
APP_DATA_DIR = APP_ROOT / "app_data"
DB_PATH = APP_DATA_DIR / "uplift_campaigns.db"
DATA_PATH = PROJECT_ROOT / "simulation_test.csv"
MODELS_DIR = PROJECT_ROOT / "uplift_final_models"
METADATA_PATH = MODELS_DIR / "metadata.json"

TARGET_COL = "target"
TREATMENT_COL = "treatment"
USER_ID_COL = "user_id"

RANDOM_SEED = 42


@dataclass(frozen=True)
class ModelSpec:
    key: str
    display_name: str
    filename: str
    supports_ranking: bool
    supports_absolute_uplift: bool
    note: str

    @property
    def path(self) -> Path:
        return MODELS_DIR / self.filename


MODEL_REGISTRY: dict[str, ModelSpec] = {
    "class_transformation": ModelSpec(
        key="class_transformation",
        display_name="Class Transformation",
        filename="class_transformation.pkl",
        supports_ranking=True,
        supports_absolute_uplift=False,
        note="Ranking only: raw uplift score is not calibrated.",
    ),
    "dr_learner": ModelSpec(
        key="dr_learner",
        display_name="DR-Learner",
        filename="dr_learner.pkl",
        supports_ranking=True,
        supports_absolute_uplift=True,
        note="Available for ranking and simulation forecast.",
    ),
    "cfrnet_mmd": ModelSpec(
        key="cfrnet_mmd",
        display_name="CFRNet + MMD Loss",
        filename="cfrnet_mmd.pkl",
        supports_ranking=True,
        supports_absolute_uplift=True,
        note="Loaded with CPU-safe torch deserialization.",
    ),
}


NUMERIC_FILTER_GROUPS: dict[str, list[str]] = {
    "Activity": [
        "total_cheque_count_3m",
        "total_cheque_count_6m",
        "total_cheque_count_12m",
        "total_sale_sum_3m",
        "total_sale_sum_6m",
        "total_sale_sum_12m",
    ],
    "Promo": [
        "promo_share_15d",
        "mean_discount_depth_15d",
        "food_share_15d",
        "food_share_1m",
    ],
    "Crazy campaigns": [
        "crazy_purchases_cheque_count_1m",
        "crazy_purchases_cheque_count_3m",
        "crazy_purchases_cheque_count_6m",
        "crazy_purchases_cheque_count_12m",
        "crazy_purchases_goods_count_6m",
        "crazy_purchases_goods_count_12m",
    ],
    "Visits": [
        "k_var_days_between_visits_15d",
        "k_var_days_between_visits_1m",
        "k_var_days_between_visits_3m",
        "stdev_days_between_visits_15d",
        "perdelta_days_between_visits_15_30d",
    ],
    "Basket": [
        "k_var_cheque_15d",
        "k_var_cheque_3m",
        "k_var_cheque_category_width_15d",
        "k_var_cheque_group_width_15d",
    ],
}
