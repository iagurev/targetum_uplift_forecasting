# !pip install scikit-uplift catboost econml causalml

from sklift.datasets import fetch_lenta
from sklift.models import ClassTransformation
from sklift.metrics import uplift_at_k
from sklearn.model_selection import train_test_split
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from catboost import CatBoostClassifier
import seaborn as sns
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import StratifiedKFold
from sklearn.impute import SimpleImputer
import sklearn.utils
from sklearn.utils._optional_dependencies import check_matplotlib_support
sklearn.utils.check_matplotlib_support = check_matplotlib_support

import copy
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

def set_torch_seed(seed=42):
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


from catboost import CatBoostClassifier, CatBoostRegressor

from sklift.metrics import (
    uplift_at_k,
    qini_auc_score,
    uplift_auc_score
)

from sklift.viz import (
    plot_qini_curve,
    plot_uplift_curve,
)


# Сравнить распределение признаков в test/control
def balance_table(df, features, treatment_col='treatment'):
    results = []

    control = df[df[treatment_col] == 0]
    test = df[df[treatment_col] == 1]

    for col in features:
        row = {}
        row['feature'] = col

        x_control = control[col].dropna()
        x_test = test[col].dropna()

        unique_vals = df[col].dropna().unique()
        is_binary = len(unique_vals) == 2

        ctrl_mean = x_control.mean()
        test_mean = x_test.mean()

        abs_diff = test_mean - ctrl_mean

        if ctrl_mean != 0:
            rel_diff = abs_diff / ctrl_mean
        else:
            rel_diff = np.nan

        if is_binary:
            row['type'] = 'binary'

            pooled_p = (ctrl_mean + test_mean) / 2
            denom = np.sqrt(pooled_p * (1 - pooled_p))

            if denom != 0:
                std_diff = abs_diff / denom
            else:
                std_diff = np.nan

        else:
            row['type'] = 'numeric'

            ctrl_var = x_control.var()
            test_var = x_test.var()
            pooled_std = np.sqrt((ctrl_var + test_var) / 2)

            if pooled_std != 0:
                std_diff = abs_diff / pooled_std
            else:
                std_diff = np.nan

        row['control'] = ctrl_mean
        row['test'] = test_mean
        row['abs_diff'] = abs_diff
        row['relative_diff'] = rel_diff
        row['std_diff'] = std_diff

        results.append(row)

    res = pd.DataFrame(results)

    return res.sort_values('std_diff', ascending=False)

# Посмотреть uplift по бинам признаков
def uplift_by_feature_bins(
    df,
    feature,
    treatment_col='treatment',
    target_col='target',
    n_bins=5,
    min_bin_size=100
):
    data = df[[feature, treatment_col, target_col]].copy()
    data = data.dropna(subset=[feature, treatment_col, target_col])

    unique_vals = data[feature].nunique()

    if unique_vals <= 5:
        data['feature_bin'] = data[feature].astype(str)

    else:
        data['feature_bin'] = pd.qcut(
            data[feature],
            q=n_bins,
            duplicates='drop'
        )

    grouped = (
        data
        .groupby('feature_bin', observed=True)
        .apply(lambda x: pd.Series({
            'n_control': (x[treatment_col] == 0).sum(),
            'n_test': (x[treatment_col] == 1).sum(),
            'response_control': x.loc[x[treatment_col] == 0, target_col].mean(),
            'response_test': x.loc[x[treatment_col] == 1, target_col].mean(),
        }))
        .reset_index()
    )

    grouped['uplift'] = grouped['response_test'] - grouped['response_control']
    grouped['feature'] = feature
    grouped['n_total'] = grouped['n_control'] + grouped['n_test']

    grouped = grouped[
        [
            'feature',
            'feature_bin',
            'n_control',
            'n_test',
            'response_control',
            'response_test',
            'uplift',
            'n_total'
        ]
    ]

    grouped = grouped[grouped['n_total'] >= min_bin_size]

    return grouped


## Вспомогательные функции
def get_cat_features(X):
    return X.select_dtypes(include=["object", "category"]).columns.tolist()

def profit_at_k(
    y_true,
    treatment,
    uplift_pred,
    k,
    contact_cost=CONTACT_COST,
    value_per_visit=VALUE_PER_VISIT
):
    data = pd.DataFrame({
        "y": y_true,
        "treatment": treatment,
        "uplift_pred": uplift_pred
    })

    data = data.sort_values("uplift_pred", ascending=False)

    n_selected = int(len(data) * k)
    selected = data.head(n_selected)

    response_test = selected.loc[selected["treatment"] == 1, "y"].mean()
    response_control = selected.loc[selected["treatment"] == 0, "y"].mean()

    uplift = response_test - response_control

    incremental_visits = uplift * n_selected
    gross_profit = incremental_visits * value_per_visit
    communication_cost = n_selected * contact_cost
    profit = gross_profit - communication_cost

    return {
        f"profit@{int(k * 100)}": profit,
        f"uplift_profit@{int(k * 100)}": uplift,
        f"n_selected@{int(k * 100)}": n_selected,
        f"incremental_visits@{int(k * 100)}": incremental_visits,
    }


def evaluate_uplift_predictions(
    y_true,
    treatment,
    uplift_pred,
    strategy="overall"
):
    y_true = np.asarray(y_true)
    treatment = np.asarray(treatment)
    uplift_pred = np.asarray(uplift_pred)

    metrics = {
        "uplift@5": uplift_at_k(
            y_true=y_true,
            uplift=uplift_pred,
            treatment=treatment,
            strategy=strategy,
            k=0.05
        ),
        "uplift@10": uplift_at_k(
            y_true=y_true,
            uplift=uplift_pred,
            treatment=treatment,
            strategy=strategy,
            k=0.10
        ),
        "uplift@30": uplift_at_k(
            y_true=y_true,
            uplift=uplift_pred,
            treatment=treatment,
            strategy=strategy,
            k=0.30
        ),
        "qini_auc": qini_auc_score(
            y_true=y_true,
            uplift=uplift_pred,
            treatment=treatment
        ),
        "uplift_auc": uplift_auc_score(
            y_true=y_true,
            uplift=uplift_pred,
            treatment=treatment
        ),
    }

    metrics.update(
        profit_at_k(
            y_true=y_true,
            treatment=treatment,
            uplift_pred=uplift_pred,
            k=0.05
        )
    )

    metrics.update(
        profit_at_k(
            y_true=y_true,
            treatment=treatment,
            uplift_pred=uplift_pred,
            k=0.10
        )
    )

    metrics.update(
        profit_at_k(
            y_true=y_true,
            treatment=treatment,
            uplift_pred=uplift_pred,
            k=0.30
        )
    )

    return metrics

def test_uplift_model(
    model_name,
    model,
    X_train,
    y_train,
    treatment_train,
    X_test,
    y_test,
    treatment_test,
    plot=True
):
    print(f"\n===== {model_name} =====")

    model.fit(X_train, y_train, treatment_train)

    uplift_pred = model.predict_uplift(X_test)

    metrics = evaluate_uplift_predictions(
        y_true=y_test,
        treatment=treatment_test,
        uplift_pred=uplift_pred
    )

    metrics["model"] = model_name

    print(f"uplift@5:   {metrics['uplift@5']:.5f}")
    print(f"uplift@10:   {metrics['uplift@10']:.5f}")
    print(f"uplift@30:   {metrics['uplift@30']:.5f}")
    print(f"Qini AUC:    {metrics['qini_auc']:.5f}")
    print(f"Uplift AUC:  {metrics['uplift_auc']:.5f}")
    print(f"profit@5:   {metrics['profit@5']:.2f}")
    print(f"profit@10:   {metrics['profit@10']:.2f}")
    print(f"profit@30:   {metrics['profit@30']:.2f}")


    if plot:
        fig, ax = plt.subplots(figsize=(7, 5))


        plot_qini_curve(
            y_true=y_test,
            treatment=treatment_test,
            uplift=uplift_pred,
            perfect=False,
            name=model_name,
            ax=ax
        )
        ax.set_xlim(0, len(y_test))
        ax.set_ylim(0, 1500)
        handles, labels = ax.get_legend_handles_labels()
        labels[0] = f"{model_name} (AUC={metrics['qini_auc']:.4f})"
        ax.legend(handles, labels)
        ax.set_title(f"Qini curve — {model_name}")

        fig, ax = plt.subplots(figsize=(7, 5))
        plot_uplift_curve(
            y_true=y_test,
            treatment=treatment_test,
            uplift=uplift_pred,
            perfect=False,
            name=model_name,
            ax = ax

        )
        ax.set_xlim(0, len(y_test))
        ax.set_ylim(0, 1500)
        handles, labels = ax.get_legend_handles_labels()
        labels[0] = f"{model_name} (AUC={metrics['uplift_auc']:.4f})"
        ax.legend(handles, labels)
        ax.set_title(f"Uplift curve — {model_name}")


    return {
        "model": model,
        "uplift_pred": uplift_pred,
        "metrics": metrics,
    }

## Шаблоны-классы моделей
class RandomUpliftModel:
    def __init__(self, random_state=RANDOM_STATE):
        self.random_state = random_state

    def fit(self, X, y, treatment):
        return self

    def predict_uplift(self, X):
        rng = np.random.default_rng(self.random_state)
        return rng.normal(size=len(X))
    

def make_cb_classifier_with_params(params, random_state=42):
    return CatBoostClassifier(
        loss_function="Logloss",
        eval_metric="AUC",
        random_seed=random_state,
        verbose=False,
        task_type="GPU",
        devices="0",
        allow_writing_files=False,
        **params
    )


class ClassTransformationModelTuned:
    def __init__(self, cat_features=None, cb_params=None):
        self.cat_features = cat_features or []
        self.cb_params = cb_params or {}
        self.model = make_cb_classifier_with_params(self.cb_params)

    def fit(self, X, y, treatment):
        y = pd.Series(y, index=X.index)
        treatment = pd.Series(treatment, index=X.index)

        z = (
            ((treatment == 1) & (y == 1)) |
            ((treatment == 0) & (y == 0))
        ).astype(int)

        p_treat = treatment.mean()

        sample_weight = np.where(
            treatment == 1,
            0.5 / p_treat,
            0.5 / (1 - p_treat)
        )

        self.model.fit(
            X,
            z,
            sample_weight=sample_weight,
            cat_features=self.cat_features
        )

        return self

    def predict_uplift(self, X):
        p_z = self.model.predict_proba(X)[:, 1]
        return 2 * p_z - 1


def make_cb_regressor_with_params(params, random_state=42):
    return CatBoostRegressor(
        loss_function="RMSE",
        random_seed=random_state,
        verbose=False,
        task_type="GPU",
        devices="0",
        allow_writing_files=False,
        **params
    )


class DRLearnerManualTuned:
    def __init__(self, cat_features=None, outcome_params=None, tau_params=None):
        self.cat_features = cat_features or []

        self.outcome_params = outcome_params or {}
        self.tau_params = tau_params or {}

        self.model_treat = make_cb_classifier_with_params(self.outcome_params)
        self.model_control = make_cb_classifier_with_params(self.outcome_params)
        self.final_model = make_cb_regressor_with_params(self.tau_params)

        self.propensity_ = None

    def fit(self, X, y, treatment):
        y = pd.Series(y, index=X.index)
        treatment = pd.Series(treatment, index=X.index)

        mask_t = treatment == 1
        mask_c = treatment == 0

        e = treatment.mean()
        e = np.clip(e, 1e-3, 1 - 1e-3)
        self.propensity_ = e

        self.model_treat.fit(
            X.loc[mask_t],
            y.loc[mask_t],
            cat_features=self.cat_features
        )

        self.model_control.fit(
            X.loc[mask_c],
            y.loc[mask_c],
            cat_features=self.cat_features
        )

        m1 = self.model_treat.predict_proba(X)[:, 1]
        m0 = self.model_control.predict_proba(X)[:, 1]

        tau_dr = (
            m1 - m0
            + treatment * (y - m1) / e
            - (1 - treatment) * (y - m0) / (1 - e)
        )

        self.final_model.fit(
            X,
            tau_dr,
            cat_features=self.cat_features
        )

        return self

    def predict_uplift(self, X):
        return self.final_model.predict(X)


def rbf_mmd_loss(x_treat, x_control, sigmas=(1.0, 2.0, 5.0, 10.0)):
    if len(x_treat) < 2 or len(x_control) < 2:
        return torch.tensor(0.0, device=x_treat.device)

    xx = torch.cdist(x_treat, x_treat, p=2) ** 2
    yy = torch.cdist(x_control, x_control, p=2) ** 2
    xy = torch.cdist(x_treat, x_control, p=2) ** 2

    loss = 0.0

    for sigma in sigmas:
        gamma = 1.0 / (2.0 * sigma ** 2)

        k_xx = torch.exp(-gamma * xx).mean()
        k_yy = torch.exp(-gamma * yy).mean()
        k_xy = torch.exp(-gamma * xy).mean()

        loss = loss + k_xx + k_yy - 2.0 * k_xy

    return loss / len(sigmas)


def sample_for_mmd(representation, treatment, max_samples=512):
    mask_t = treatment == 1
    mask_c = treatment == 0

    rep_t = representation[mask_t]
    rep_c = representation[mask_c]

    if len(rep_t) > max_samples:
        idx = torch.randperm(len(rep_t), device=representation.device)[:max_samples]
        rep_t = rep_t[idx]

    if len(rep_c) > max_samples:
        idx = torch.randperm(len(rep_c), device=representation.device)[:max_samples]
        rep_c = rep_c[idx]

    return rep_t, rep_c

class CFRNetMMDUpliftModel(BaseDeepUpliftModel):
    def __init__(
        self,
        mmd_weight=0.1,
        mmd_sample_size=512,
        mmd_sigmas=(1.0, 2.0, 5.0, 10.0),
        **kwargs
    ):
        super().__init__(**kwargs)

        self.mmd_weight = mmd_weight
        self.mmd_sample_size = mmd_sample_size
        self.mmd_sigmas = mmd_sigmas

    def _build_model(self, input_dim):
        return TARNet(
            input_dim=input_dim,
            hidden_dims=self.hidden_dims,
            dropout=self.dropout
        )

    def _compute_loss(self, outputs, y, treatment):
        y0_logit = outputs["y0_logit"]
        y1_logit = outputs["y1_logit"]
        representation = outputs["representation"]

        factual_logit = torch.where(
            treatment == 1,
            y1_logit,
            y0_logit
        )

        outcome_loss = nn.functional.binary_cross_entropy_with_logits(
            factual_logit,
            y
        )

        rep_t, rep_c = sample_for_mmd(
            representation=representation,
            treatment=treatment,
            max_samples=self.mmd_sample_size
        )

        mmd_loss = rbf_mmd_loss(
            rep_t,
            rep_c,
            sigmas=self.mmd_sigmas
        )

        return outcome_loss + self.mmd_weight * mmd_loss


