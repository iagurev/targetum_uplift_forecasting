from __future__ import annotations

import html
import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import Any

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from uplift_app.config import (
    MODEL_REGISTRY,
    NUMERIC_FILTER_GROUPS,
    USER_ID_COL,
)
from uplift_app.data import (
    available_product_groups,
    load_dataset,
    numeric_bounds,
)
from uplift_app.filters import apply_filters
from uplift_app.metrics import (
    aggregate_forecast_quality,
    baseline_comparison,
    break_even_uplift,
    build_forecast_quality_frame,
    calculate_forecast,
    calculate_forecast_errors,
    calculate_simulation_metrics,
)
from uplift_app.models import load_model, model_options_for_forecast, model_options_for_ranking, predict_uplift
from uplift_app.selection import select_audience
from uplift_app.storage import (
    delete_campaigns,
    get_campaign,
    get_metrics,
    get_selected_audience,
    init_db,
    list_campaigns,
    list_forecast_quality_campaigns,
    save_campaign,
)
from uplift_app.style import APP_CSS


st.set_page_config(page_title="Targetum", layout="wide")
st.markdown(APP_CSS, unsafe_allow_html=True)


EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


FEATURE_LABELS = {
    "campaign_id": "ID кампании",
    USER_ID_COL: "ID пользователя",
    "age": "Возраст",
    "gender": "Пол",
    "children": "Количество детей",
    "months_from_register": "Кол-во месяцев в сервисе",
    "main_format": "Предпочитаемый формат магазина",
    "total_cheque_count_3m": "Количество чеков за последние 3 месяца",
    "total_cheque_count_6m": "Количество чеков за последние 6 месяцев",
    "total_cheque_count_12m": "Количество чеков за последние 12 месяцев",
    "total_sale_sum_3m": "Сумма покупок за последние 3 месяца",
    "total_sale_sum_6m": "Сумма покупок за последние 6 месяцев",
    "total_sale_sum_12m": "Сумма покупок за последние 12 месяцев",
    "promo_share_15d": "Доля промо за последние 15 дней",
    "mean_discount_depth_15d": "Средняя глубина скидки за 15 дней",
    "food_share_15d": "Доля покупок grocery за последние 15 дней",
    "food_share_1m": "Доля покупок grocery за последний месяц",
    "crazy_purchases_cheque_count_1m": "Чеков в crazy-кампаниях за последний месяц",
    "crazy_purchases_cheque_count_3m": "Чеков в crazy-кампаниях за последние 3 месяца",
    "crazy_purchases_cheque_count_6m": "Чеков в crazy-кампаниях за последние 6 месяцев",
    "crazy_purchases_cheque_count_12m": "Чеков в crazy-кампаниях за последние 12 месяцев",
    "crazy_purchases_goods_count_6m": "Товаров в crazy-кампаниях за последние 6 месяцев",
    "crazy_purchases_goods_count_12m": "Товаров в crazy-кампаниях за последние 12 месяцев",
    "k_var_days_between_visits_15d": "Дисперсия # дней между визитами за последние 15 дней",
    "k_var_days_between_visits_1m": "Дисперсия # дней между визитами за последний месяц",
    "k_var_days_between_visits_3m": "Дисперсия # дней между визитами за последние 3 месяца",
    "stdev_days_between_visits_15d": "std # дней между визитами за последние 15 дней",
    "perdelta_days_between_visits_15_30d": "Изменение интервала между визитами, между за последние 15 и 30 дней",
    "k_var_cheque_15d": "Дисперсия размера чека за 15 дней",
    "k_var_cheque_3m": "Дисперсия размера чека за 3 месяца",
    "k_var_cheque_category_width_15d": "Дисперсия числа категорий в чеке за 15 дней",
    "k_var_cheque_group_width_15d": "Дисперсия числа товарных групп в чеке за 15 дней",
    "rank": "Ранг",
    "predicted_uplift": "Прогноз Uplift",
    "expected_value": "Ожидаемая ценность",
    "predicted_incremental_conversions": "Прогноз дополнительных конверсий",
    "predicted_incremental_revenue": "Прогноз дополнительной выручки",
    "campaign_cost": "Стоимость кампании",
    "predicted_profit": "Прогноз прибыли",
    "predicted_roi": "Прогноз ROI",
    "treatment_cost": "Стоимость контакта",
    "selected_flag": "Выбран",
}

FILTER_GROUP_LABELS = {
    "Activity": "Активность",
    "Promo": "Промо",
    "Crazy campaigns": "Покупки в crazy-кампаниях",
    "Visits": "Визиты",
    "Basket": "Корзина",
}

PRESET_LABELS = {
    "active": "Активные клиенты",
    "promo_sensitive": "Чувствительные к промо",
    "at_risk": "Риск оттока",
    "high_value": "High-value клиенты",
}

MODEL_NOTE_LABELS = {
    "class_transformation": "Лучшая для ранкинга. Нельзя использовать для прогнозирования",
    "dr_learner": "Хорошо работает при узком таргетинге на top-5%",
    "cfrnet_mmd": "Универсальная и стабильная. Рекомендуется использовать одновременно для ранкинга и прогноза",
}

STRATEGY_LABELS = {
    "top_k_percent": "Лучшие k% по оценке",
    "top_n": "Лучшие N пользователей по оценке",
    "budget_constrained": "В рамках бюджета",
    "max_reach_constrained": "В рамках максимального размера аудитории",
}

STATUS_LABELS = {
    "draft": "черновик",
    "ranked": "аудитория сформирована",
    "forecasted": "прогноз рассчитан",
    "launched": "запущена",
    "evaluated": "завершена",
    "failed": "ошибка",
    "unknown": "неизвестно",
}

ERROR_LABELS = {
    "empty audience": "пустая аудитория",
    "missing simulation columns": "нет необходимых столбцов для моделирования",
    "missing treatment or control group": "нет тестовой или контрольной группы",
}

CATEGORY_VALUE_LABELS = {
    "gender": {
        0: "Ж",
        1: "М",
    },
    "main_format": {
        0: "Супермаркет",
        1: "Минимаркет",
    },
}


@st.cache_resource(show_spinner=False)
def cached_model(model_key: str) -> Any:
    return load_model(model_key)


def fmt_number(value: Any, digits: int = 2) -> str:
    if value is None or pd.isna(value):
        return "-"
    return f"{float(value):,.{digits}f}"


def fmt_int(value: Any) -> str:
    if value is None or pd.isna(value):
        return "-"
    return f"{int(value):,}"


def fmt_money(value: Any) -> str:
    if value is None or pd.isna(value):
        return "-"
    return f"{float(value):,.2f} ₽"


def fmt_pct(value: Any, digits: int = 2) -> str:
    if value is None or pd.isna(value):
        return "-"
    return f"{float(value) * 100:.{digits}f}%"


def label_feature(field: str) -> str:
    return FEATURE_LABELS.get(field, field)


def _category_key(value: Any) -> Any:
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, str):
        stripped = value.strip()
        try:
            numeric = float(stripped)
        except ValueError:
            return stripped
        if numeric.is_integer():
            return int(numeric)
        return numeric
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def format_category_value(field: str, value: Any) -> Any:
    if value is None or pd.isna(value):
        return "-"
    labels = CATEGORY_VALUE_LABELS.get(field)
    if not labels:
        return value
    return labels.get(_category_key(value), value)


def category_multiselect(field: str, options: list[Any]) -> list[Any]:
    label_to_value: dict[str, Any] = {}
    labels: list[str] = []
    for option in options:
        label = str(format_category_value(field, option))
        label_to_value[label] = option
        labels.append(label)
    selected_labels = st.multiselect(
        label_feature(field),
        labels,
        default=labels,
        key=f"flt_{field}_ru_v2",
    )
    return [label_to_value[label] for label in selected_labels]


def display_table(df: pd.DataFrame, labels: dict[str, str] | None = None) -> pd.DataFrame:
    mapping = {column: label_feature(column) for column in df.columns}
    if labels:
        mapping.update(labels)
    return df.rename(columns=mapping)


def dataframe_to_excel_bytes(df: pd.DataFrame, sheet_name: str) -> bytes:
    export_df = df.copy()
    for column in export_df.select_dtypes(include=["datetimetz"]).columns:
        export_df[column] = export_df[column].dt.tz_localize(None)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        export_df.to_excel(writer, index=False, sheet_name=sheet_name)
    return output.getvalue()


def format_display_values(
    df: pd.DataFrame,
    money_columns: tuple[str, ...] = (),
    pct_columns: tuple[str, ...] = (),
) -> pd.DataFrame:
    result = df.copy()
    for column in CATEGORY_VALUE_LABELS:
        if column in result.columns:
            result[column] = result[column].map(lambda value, field=column: format_category_value(field, value))
    for column in money_columns:
        if column in result.columns:
            result[column] = result[column].map(fmt_money)
    for column in pct_columns:
        if column in result.columns:
            result[column] = result[column].map(fmt_pct)
    return result


def translate_error(value: Any) -> Any:
    return ERROR_LABELS.get(value, value)


def summarize_filters_ru(filter_config: dict[str, Any]) -> str:
    parts: list[str] = []
    parts.extend(PRESET_LABELS.get(preset, preset) for preset in filter_config.get("presets", []))
    parts.extend(
        f"{label_feature(field)}: {bounds[0]:.3g}-{bounds[1]:.3g}"
        for field, bounds in filter_config.get("ranges", {}).items()
    )
    parts.extend(
        f"{label_feature(field)}: {', '.join(str(format_category_value(field, value)) for value in values)}"
        for field, values in filter_config.get("values", {}).items()
        if values
    )
    category = filter_config.get("category_specific") or {}
    if category.get("enabled"):
        metric_label = {
            "sale_or_cheque": "покупки или чеки",
            "sale_sum": "сумма покупок",
            "cheque_count": "количество чеков",
        }.get(category.get("metric"), category.get("metric"))
        range_labels = {
            "sale_sum": "сумма покупок",
            "cheque_count": "количество чеков",
        }
        range_parts = [
            f"{range_labels.get(field, field)}: {bounds[0]:.3g}-{bounds[1]:.3g}"
            for field, bounds in (category.get("ranges") or {}).items()
        ]
        range_suffix = f", диапазон ({'; '.join(range_parts)})" if range_parts else ""
        parts.append(
            f"товарная группа {category.get('group')}, период {category.get('window')}, "
            f"{metric_label}{range_suffix}"
        )
    return ", ".join(parts) if parts else "Фильтры не заданы"


def render_title() -> None:
    st.markdown(
        """
        <div class="uplift-title">
          <div>
            <h1>Targetum</h1>
            <p>Сервис для Uplift-моделирования и офлайн-запуска маркетинговых кампаний.</p>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_kpi_cards(items: list[tuple[str, str]]) -> None:
    cards = ["<div class='kpi-grid'>"]
    for label, value in items:
        cards.append(
            "<div class='kpi-card'>"
            f"<p class='kpi-label'>{html.escape(label)}</p>"
            f"<p class='kpi-value'>{html.escape(value)}</p>"
            "</div>"
        )
    cards.append("</div>")
    st.markdown("".join(cards), unsafe_allow_html=True)


def status_chip(status: str) -> str:
    safe = html.escape(status or "unknown")
    label = html.escape(STATUS_LABELS.get(status, status or "неизвестно"))
    return f"<span class='status-chip status-{safe}'>{label}</span>"


def _native_options(values: pd.Series) -> list[Any]:
    result = []
    for value in sorted(values.dropna().unique().tolist()):
        if hasattr(value, "item"):
            value = value.item()
        result.append(value)
    return result


def _add_range_if_changed(
    ranges: dict[str, list[float]],
    df: pd.DataFrame,
    column: str,
    selected: tuple[float, float] | list[float],
) -> None:
    low, high = numeric_bounds(df, column)
    if float(selected[0]) > low or float(selected[1]) < high:
        ranges[column] = [float(selected[0]), float(selected[1])]


def _range_slider(
    label: str,
    df: pd.DataFrame,
    column: str,
    key: str,
    show_label: bool = False,
) -> tuple[float, float] | None:
    low, high = numeric_bounds(df, column)
    if low == high:
        st.caption(f"{label}: постоянное значение {fmt_number(low)}")
        return None

    min_input_key = f"{key}_min_input"
    max_input_key = f"{key}_max_input"

    def _clamp_range(min_value: float, max_value: float) -> tuple[float, float]:
        min_value = min(max(float(min_value), float(low)), float(high))
        max_value = min(max(float(max_value), float(low)), float(high))
        if min_value > max_value:
            min_value, max_value = max_value, min_value
        return min_value, max_value

    current_low, current_high = _clamp_range(
        st.session_state.get(min_input_key, float(low)),
        st.session_state.get(max_input_key, float(high)),
    )
    st.session_state[min_input_key] = current_low
    st.session_state[max_input_key] = current_high
    if show_label:
        st.markdown(f"**{label}**")

    manual_cols = st.columns(2)
    with manual_cols[0]:
        min_value = st.number_input(
            "От",
            min_value=float(low),
            max_value=float(high),
            step=0.01,
            format="%.2f",
            key=min_input_key,
        )
    with manual_cols[1]:
        max_value = st.number_input(
            "До",
            min_value=float(low),
            max_value=float(high),
            step=0.01,
            format="%.2f",
            key=max_input_key,
        )

    return _clamp_range(min_value, max_value)


def build_filter_config(df: pd.DataFrame) -> dict[str, Any]:
    ranges: dict[str, list[float]] = {}
    values: dict[str, list[Any]] = {}

    st.subheader("Фильтры для аудитории")
    with st.expander("Общие", expanded=True):
        col1, col2, col3 = st.columns(3)
        with col1:
            age_range = _range_slider(label_feature("age"), df, "age", "flt_age", show_label=True)
            if age_range:
                _add_range_if_changed(ranges, df, "age", age_range)
            months_range = _range_slider(
                label_feature("months_from_register"),
                df,
                "months_from_register",
                "flt_months",
                show_label=True,
            )
            if months_range:
                _add_range_if_changed(ranges, df, "months_from_register", months_range)
        with col2:
            gender_options = _native_options(df["gender"])
            gender_selected = category_multiselect("gender", gender_options)
            if len(gender_selected) != len(gender_options):
                values["gender"] = gender_selected
            main_format_options = _native_options(df["main_format"])
            main_format_selected = category_multiselect("main_format", main_format_options)
            if len(main_format_selected) != len(main_format_options):
                values["main_format"] = main_format_selected
        with col3:
            children_range = _range_slider(label_feature("children"), df, "children", "flt_children", show_label=True)
            if children_range:
                _add_range_if_changed(ranges, df, "children", children_range)

    for group_name, fields in NUMERIC_FILTER_GROUPS.items():
        with st.expander(FILTER_GROUP_LABELS.get(group_name, group_name)):
            cols = st.columns(2)
            for index, field in enumerate(fields):
                if field not in df.columns:
                    continue
                with cols[index % 2]:
                    enabled = st.checkbox(f"{label_feature(field)}", key=f"enable_{field}")
                    if enabled:
                        selected = _range_slider(label_feature(field), df, field, f"range_{field}")
                        if selected:
                            ranges[field] = [float(selected[0]), float(selected[1])]

    with st.expander("Сохраненные сегменты и фильтр по товарной группе"):
        presets = st.multiselect(
            "Пресеты",
            ["active", "promo_sensitive", "at_risk", "high_value"],
            default=[],
            format_func=lambda key: PRESET_LABELS.get(key, key),
        )
        category_enabled = st.checkbox("Включить фильтр по товарной группе")
        groups = available_product_groups(df.columns)
        category = {"enabled": False}
        if category_enabled and groups:
            c1, c2, c3 = st.columns(3)
            with c1:
                group = st.selectbox("Товарная группа", groups, index=0)
            with c2:
                window = st.selectbox("Период", ["3m", "6m", "12m"], index=0)
            with c3:
                metric = st.selectbox(
                    "Метрика",
                    ["sale_or_cheque", "sale_sum", "cheque_count"],
                    index=0,
                    format_func=lambda value: {
                        "sale_or_cheque": "Покупки или чеки",
                        "sale_sum": "Сумма покупок",
                        "cheque_count": "Количество чеков",
                    }[value],
                )
            sale_col = f"sale_sum_{window}_{group}"
            cheque_col = f"cheque_count_{window}_{group}"
            category_ranges: dict[str, list[float]] = {}
            range_controls = []
            if metric in ("sale_sum", "sale_or_cheque"):
                range_controls.append(("sale_sum", sale_col, "Сумма покупок"))
            if metric in ("cheque_count", "sale_or_cheque"):
                range_controls.append(("cheque_count", cheque_col, "Количество чеков"))

            if range_controls:
                range_cols = st.columns(len(range_controls))
                for index, (range_key, column, label) in enumerate(range_controls):
                    with range_cols[index]:
                        if column not in df.columns:
                            st.caption(f"{label}: данных нет")
                            continue
                        selected = _range_slider(
                            f"{label} в выбранной товарной группе",
                            df,
                            column,
                            f"range_category_{range_key}_{window}_{group}",
                            show_label=True,
                        )
                        if selected:
                            category_ranges[range_key] = [float(selected[0]), float(selected[1])]

            category = {
                "enabled": True,
                "group": group,
                "window": window,
                "metric": metric,
                "ranges": category_ranges,
            }

    return {
        "ranges": ranges,
        "values": values,
        "presets": presets,
        "category_specific": category,
    }


def strategy_controls(budget: float | None, max_reach: int | None) -> tuple[str, dict[str, Any]]:
    strategy = st.selectbox(
        "Стратегия выбора аудитории",
        list(STRATEGY_LABELS.keys()),
        format_func=lambda key: STRATEGY_LABELS[key],
    )
    params: dict[str, Any] = {}
    if strategy == "top_k_percent":
        params["top_k_percent"] = st.slider("Доля лучших пользователей, %", 1.0, 100.0, 10.0, 1.0)
    elif strategy == "top_n":
        params["top_n"] = st.number_input("Количество лучших пользователей", min_value=1, value=5000, step=500)
    elif strategy == "budget_constrained" and budget is None:
        st.warning("Добавьте ограничение бюджета, чтобы использовать эту стратегию.")
    elif strategy == "max_reach_constrained" and max_reach is None:
        st.warning("Добавьте ограничение на размер аудитории, чтобы использовать эту стратегию.")
    return strategy, params


def rank_audience(
    df: pd.DataFrame,
    metadata: dict[str, Any],
    thresholds: dict[str, float],
    filter_config: dict[str, Any],
    ranking_model_key: str,
    strategy: str,
    strategy_params: dict[str, Any],
    treatment_cost: float,
    budget: float | None,
    max_reach: int | None,
    min_reach: int | None,
) -> None:
    filtered = apply_filters(df, filter_config, thresholds)
    if filtered.empty:
        st.error("После применения фильтров не осталось клиентов. Ранжирование недоступно.")
        return

    with st.spinner("Считаем оценки аудитории..."):
        model = cached_model(ranking_model_key)
        scores = predict_uplift(ranking_model_key, model, filtered, metadata["features"])

    scored = filtered.copy()
    scored["ranking_score"] = scores
    selected, selection_metrics = select_audience(
        scored,
        strategy,
        strategy_params,
        treatment_cost=treatment_cost,
        budget=budget,
        max_reach=max_reach,
        min_reach=min_reach,
        initial_users_count=len(df),
    )

    st.session_state["ranking_result"] = {
        "filtered": filtered,
        "scored": scored,
        "selected": selected,
        "selection_metrics": selection_metrics,
        "filter_config": filter_config,
        "filters_summary": summarize_filters_ru(filter_config),
        "ranking_model_key": ranking_model_key,
        "strategy": strategy,
        "strategy_params": strategy_params,
    }
    st.session_state.pop("forecast_result", None)


def render_ranking_result() -> None:
    result = st.session_state.get("ranking_result")
    if not result:
        return
    metrics = result["selection_metrics"]
    render_kpi_cards(
        [
            ("Пользователей всего", fmt_int(metrics["initial_users_count"])),
            ("После фильтрации", fmt_int(metrics["filtered_users_count"])),
            ("Выбрано пользователей", fmt_int(metrics["selected_users_count"])),
            ("Доля аудитории от всех пользователей", fmt_pct(metrics["selection_rate"])),
            ("Стоимость кампании", fmt_money(metrics["campaign_cost"])),
            ("Остаток бюджета", fmt_money(metrics["remaining_budget"])),
        ]
    )
    if not metrics["min_reach_met"]:
        st.warning("Размер выбранной аудитории ниже заданного минимального размера.")

    selected = result["selected"][[USER_ID_COL, "rank"]].head(200)
    st.dataframe(display_table(selected), use_container_width=True, hide_index=True)


def render_forecast_controls(metadata: dict[str, Any], conversion_value: float, treatment_cost: float) -> None:
    result = st.session_state.get("ranking_result")
    if not result or result["selected"].empty:
        return

    st.subheader("Финансовый прогноз")
    eligible = model_options_for_forecast()
    forecast_model_key = st.selectbox(
        "Модель для абсолютного Uplift",
        [spec.key for spec in eligible],
        format_func=lambda key: MODEL_REGISTRY[key].display_name,
    )
    st.dataframe(
        pd.DataFrame(
            [
                {
                    "Модель": spec.display_name,
                    "Ранжирование": "доступно" if spec.supports_ranking else "недоступно",
                    "Прогноз": "доступен" if spec.supports_absolute_uplift else "недоступно, только ранжирование",
                    "Комментарий": MODEL_NOTE_LABELS.get(spec.key, spec.note),
                }
                for spec in MODEL_REGISTRY.values()
            ]
        ),
        use_container_width=True,
        hide_index=True,
    )

    if st.button("Рассчитать прогноз", type="secondary"):
        with st.spinner("Считаем прогноз абсолютного Uplift..."):
            model = cached_model(forecast_model_key)
            predicted = predict_uplift(
                forecast_model_key,
                model,
                result["selected"],
                metadata["features"],
            )
            audience, forecast_metrics = calculate_forecast(
                result["selected"],
                predicted,
                conversion_value=conversion_value,
                treatment_cost=treatment_cost,
            )
        st.session_state["forecast_result"] = {
            "audience": audience,
            "forecast_metrics": forecast_metrics,
            "model_key": forecast_model_key,
        }

    forecast = st.session_state.get("forecast_result")
    if forecast:
        metrics = forecast["forecast_metrics"]
        render_kpi_cards(
            [
                ("Прогноз дополнительных конверсий", fmt_number(metrics["predicted_incremental_conversions"])),
                ("Прогноз дополнительной выручки", fmt_money(metrics["predicted_incremental_revenue"])),
                ("Прогноз прибыли", fmt_money(metrics["predicted_profit"])),
                ("Прогноз ROI", fmt_pct(metrics["predicted_roi"])),
                ("Усредненный прогноз Uplift", fmt_pct(metrics["avg_predicted_uplift"])),
                ("Доля клиентов с положительной ценностью", fmt_pct(metrics["positive_expected_value_share"])),
            ]
        )
        preview_cols = [USER_ID_COL, "rank", "predicted_uplift", "expected_value"]
        preview = format_display_values(
            forecast["audience"][preview_cols].head(200),
            money_columns=("expected_value",),
            pct_columns=("predicted_uplift",),
        )
        st.dataframe(
            display_table(preview),
            use_container_width=True,
            hide_index=True,
        )


def launch_campaign(
    campaign_name: str,
    campaign_description: str,
    budget: float | None,
    max_reach: int | None,
    min_reach: int | None,
    treatment_cost: float,
    conversion_value: float,
) -> None:
    ranking = st.session_state["ranking_result"]
    forecast = st.session_state.get("forecast_result")
    selected = forecast["audience"] if forecast else ranking["selected"]
    forecast_metrics = forecast["forecast_metrics"] if forecast else {}
    forecast_model_name = MODEL_REGISTRY[forecast["model_key"]].display_name if forecast else None

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    campaign_id = f"cmp_{uuid.uuid4().hex[:10]}"

    simulation_metrics = calculate_simulation_metrics(
        selected,
        conversion_value=conversion_value,
        treatment_cost=treatment_cost,
    )
    forecast_errors = calculate_forecast_errors(forecast_metrics, simulation_metrics)
    baselines = baseline_comparison(
        dict(simulation_metrics),
        ranking["filtered"],
        selected_users_count=len(selected),
        conversion_value=conversion_value,
        treatment_cost=treatment_cost,
    )
    status = "evaluated" if simulation_metrics.get("available") else "failed"
    selection_metrics = ranking["selection_metrics"]

    campaign_run = {
        "campaign_id": campaign_id,
        "campaign_name": campaign_name,
        "campaign_description": campaign_description,
        "created_at": now,
        "status": status,
        "filters_config": ranking["filter_config"],
        "filters_summary": ranking["filters_summary"],
        "ranking_model_name": MODEL_REGISTRY[ranking["ranking_model_key"]].display_name,
        "ranking_strategy": ranking["strategy"],
        "uplift_value_model_name": forecast_model_name,
        "budget": budget,
        "treatment_cost": treatment_cost,
        "conversion_value": conversion_value,
        "max_reach": max_reach,
        "min_reach": min_reach,
        "break_even_uplift": break_even_uplift(treatment_cost, conversion_value),
        **selection_metrics,
        **forecast_metrics,
    }
    metric_record = {
        "campaign_id": campaign_id,
        "response_rate_treatment": simulation_metrics.get("response_rate_treatment"),
        "response_rate_control": simulation_metrics.get("response_rate_control"),
        "realized_uplift": simulation_metrics.get("realized_uplift"),
        "incremental_conversions": simulation_metrics.get("incremental_conversions"),
        "incremental_revenue": simulation_metrics.get("incremental_revenue"),
        "campaign_cost": simulation_metrics.get("campaign_cost"),
        "realized_profit": simulation_metrics.get("realized_profit"),
        "realized_roi": simulation_metrics.get("realized_roi"),
        "baseline_metrics": baselines,
        "forecast_errors": forecast_errors,
        "evaluated_at": now,
        "error": simulation_metrics.get("error"),
    }

    save_campaign(campaign_run, selected, metric_record)
    st.success(f"Кампания запущена и сохранена: {campaign_id}")


def campaign_setup_tab(df: pd.DataFrame, metadata: dict[str, Any], thresholds: dict[str, float]) -> None:
    st.subheader("Настройка кампании")
    c1, c2, c3 = st.columns([1.2, 1.0, 1.0])
    with c1:
        campaign_name = st.text_input("Название кампании", value="Майская промо-кампания")
        campaign_description = st.text_area("Описание", value="", height=86)
    with c2:
        conversion_value = st.number_input("Revenue per User, ₽", min_value=0.0, value=500.0, step=10.0)
        treatment_cost = st.number_input("Cost per User, ₽", min_value=0.0, value=10.0, step=1.0)
    with c3:
        use_budget = st.checkbox("Ограничить бюджет", value=True)
        budget = (
            st.number_input("Бюджет", min_value=0.0, value=100000.0, step=1000.0)
            if use_budget
            else None
        )
        use_max_reach = st.checkbox("Ограничить сверху размер аудитории", value=True)
        max_reach = (
            int(st.number_input("Максимальный размер аудитории", min_value=1, value=10000, step=500))
            if use_max_reach
            else None
        )
        use_min_reach = st.checkbox("Ограничить снизу размер аудитории", value=False)
        min_reach = (
            int(st.number_input("Минимальный размер аудитории", min_value=1, value=1000, step=100))
            if use_min_reach
            else None
        )

    filter_config = build_filter_config(df)

    st.subheader("Ранжирование и выбор аудитории")
    c1, c2 = st.columns(2)
    with c1:
        ranking_options = model_options_for_ranking()
        ranking_model_key = st.selectbox(
            "Модель для ранжирования",
            [spec.key for spec in ranking_options],
            format_func=lambda key: MODEL_REGISTRY[key].display_name,
        )
        st.caption(MODEL_NOTE_LABELS.get(ranking_model_key, MODEL_REGISTRY[ranking_model_key].note))
    with c2:
        strategy, strategy_params = strategy_controls(budget, max_reach)

    if conversion_value <= 0:
        st.error("Конверсия должна быть больше нуля.")
    if budget is not None and treatment_cost > budget:
        st.warning("Бюджет меньше стоимости CPC. Выборка будет пустой.")

    if st.button("Применить фильтры и отранжировать аудиторию", type="primary"):
        rank_audience(
            df,
            metadata,
            thresholds,
            filter_config,
            ranking_model_key,
            strategy,
            strategy_params,
            treatment_cost,
            budget,
            max_reach,
            min_reach,
        )

    render_ranking_result()
    render_forecast_controls(metadata, conversion_value, treatment_cost)

    ranking = st.session_state.get("ranking_result")
    selected_count = ranking["selection_metrics"]["selected_users_count"] if ranking else 0
    can_launch = bool(
        ranking
        and campaign_name.strip()
        and selected_count > 0
        and ranking["selection_metrics"]["min_reach_met"]
        and conversion_value > 0
    )
    if st.button("Запустить промо", type="primary", disabled=not can_launch):
        launch_campaign(
            campaign_name=campaign_name.strip(),
            campaign_description=campaign_description.strip(),
            budget=budget,
            max_reach=max_reach,
            min_reach=min_reach,
            treatment_cost=treatment_cost,
            conversion_value=conversion_value,
        )


def _baseline_frame(baselines: dict[str, dict[str, Any]]) -> pd.DataFrame:
    rows = []
    labels = {
        "uplift_policy": "Uplift-стратегия",
        "random_same_size": "Случайная выборка того же размера",
        "target_all": "Промо на всех",
        "no_treatment": "Все без промо",
    }
    for key, value in baselines.items():
        rows.append(
            {
                "Стратегия": labels.get(key, key),
                "Размер аудитории": value.get("audience_size"),
                "Uplift": fmt_pct(value.get("realized_uplift")),
                "Прибыль": fmt_money(value.get("realized_profit")),
                "ROI": fmt_pct(value.get("realized_roi")),
                "Статус": "доступно" if value.get("available") else translate_error(value.get("error")),
            }
        )
    return pd.DataFrame(rows)


def campaign_reports_tab() -> None:
    init_db()
    campaigns = list_campaigns()
    st.subheader("Запуски кампаний")
    if campaigns.empty:
        st.info("Пока нет запущенных кампаний.")
        return

    raw_table = campaigns.copy()
    raw_table["delete_campaign"] = False
    if "created_at" in raw_table.columns:
        raw_table["created_at"] = pd.to_datetime(raw_table["created_at"], errors="coerce").dt.strftime("%Y-%m-%d %H:%M")
    if "status" in raw_table.columns:
        raw_table["status"] = raw_table["status"].map(lambda value: STATUS_LABELS.get(value, value))
    raw_table = format_display_values(
        raw_table,
        money_columns=("campaign_cost", "predicted_profit", "realized_profit"),
        pct_columns=("realized_roi",),
    )
    table_labels = {
        "delete_campaign": "Удалить",
        "campaign_id": "ID кампании",
        "campaign_name": "Название кампании",
        "created_at": "Дата запуска",
        "status": "Статус",
        "ranking_model_name": "Модель ранжирования",
        "uplift_value_model_name": "Модель прогноза Uplift",
        "selected_users_count": "Размер аудитории",
        "campaign_cost": "Стоимость кампании",
        "predicted_profit": "Прогноз прибыли",
        "realized_profit": "Фактическая прибыль",
        "realized_roi": "Фактический ROI",
    }
    table_columns = [
        "campaign_id",
        "campaign_name",
        "created_at",
        "status",
        "selected_users_count",
        "campaign_cost",
        "predicted_profit",
        "realized_profit",
        "realized_roi",
        "ranking_model_name",
        "uplift_value_model_name",
        "delete_campaign",
    ]
    edited_table = st.data_editor(
        raw_table[table_columns],
        key="campaign_runs_editor",
        use_container_width=True,
        hide_index=True,
        disabled=[column for column in table_columns if column != "delete_campaign"],
        column_config={
            "delete_campaign": st.column_config.CheckboxColumn(table_labels["delete_campaign"]),
            "campaign_id": st.column_config.TextColumn(table_labels["campaign_id"]),
            "campaign_name": st.column_config.TextColumn(table_labels["campaign_name"]),
            "created_at": st.column_config.TextColumn(table_labels["created_at"]),
            "status": st.column_config.TextColumn(table_labels["status"]),
            "ranking_model_name": st.column_config.TextColumn(table_labels["ranking_model_name"]),
            "uplift_value_model_name": st.column_config.TextColumn(table_labels["uplift_value_model_name"]),
            "selected_users_count": st.column_config.NumberColumn(table_labels["selected_users_count"], format="%d"),
            "campaign_cost": st.column_config.TextColumn(table_labels["campaign_cost"]),
            "predicted_profit": st.column_config.TextColumn(table_labels["predicted_profit"]),
            "realized_profit": st.column_config.TextColumn(table_labels["realized_profit"]),
            "realized_roi": st.column_config.TextColumn(table_labels["realized_roi"]),
        },
    )
    export_columns = [column for column in table_columns if column != "delete_campaign"]
    export_labels = {column: label for column, label in table_labels.items() if column != "delete_campaign"}
    export_table = display_table(raw_table[export_columns], export_labels)
    st.download_button(
        "Выгрузить кампании в Excel",
        data=dataframe_to_excel_bytes(export_table, "campaign_runs"),
        file_name="campaign_runs.xlsx",
        mime=EXCEL_MIME,
        key="download_campaign_runs",
    )
    delete_ids = edited_table.loc[edited_table["delete_campaign"], "campaign_id"].tolist()
    if delete_ids:
        st.warning(f"Выбрано кампаний для удаления: {len(delete_ids)}")
        if st.button("Удалить выбранные кампании", type="secondary"):
            deleted_count = delete_campaigns(delete_ids)
            st.success(f"Удалено кампаний: {deleted_count}")
            st.rerun()

    options = campaigns["campaign_id"].tolist()
    lookup = campaigns.set_index("campaign_id")
    selected_id = st.selectbox(
        "Открыть кампанию",
        options,
        format_func=lambda campaign_id: (
            f"{lookup.loc[campaign_id, 'campaign_name']} | "
            f"{lookup.loc[campaign_id, 'created_at']} | {campaign_id}"
        ),
    )
    campaign = get_campaign(selected_id)
    metrics = get_metrics(selected_id)
    audience = get_selected_audience(selected_id)
    if not campaign or not metrics:
        st.error("Информация о кампании неполная.")
        return

    st.markdown(status_chip(campaign["status"]), unsafe_allow_html=True)
    render_kpi_cards(
        [
            ("Фактическая прибыль", fmt_money(metrics.get("realized_profit"))),
            ("Фактический ROI", fmt_pct(metrics.get("realized_roi"))),
            ("Фактический Uplift", fmt_pct(metrics.get("realized_uplift"))),
            ("Дополнительные конверсии", fmt_number(metrics.get("incremental_conversions"))),
            ("Стоимость кампании", fmt_money(metrics.get("campaign_cost"))),
        ]
    )

    setup_cols = st.columns(2)
    with setup_cols[0]:
        st.subheader("Параметры кампании")
        params = pd.DataFrame(
            [
                ("Название", campaign["campaign_name"]),
                ("Дата запуска", campaign["created_at"]),
                ("Модель ранжирования", campaign["ranking_model_name"]),
                ("Модель прогноза Uplift", campaign.get("uplift_value_model_name") or "-"),
                ("Стратегия", STRATEGY_LABELS.get(campaign["ranking_strategy"], campaign["ranking_strategy"])),
                ("Размер аудитории", fmt_int(campaign["selected_users_count"])),
                ("Бюджет", fmt_money(campaign.get("budget"))),
                ("Стоимость контакта", fmt_money(campaign["treatment_cost"])),
                ("Ценность конверсии", fmt_money(campaign["conversion_value"])),
            ],
            columns=["Параметр", "Значение"],
        )
        st.dataframe(params, use_container_width=True, hide_index=True)
    with setup_cols[1]:
        st.subheader("Прогноз до запуска")
        if campaign.get("predicted_profit") is None:
            st.info("Финансовый прогноз не рассчитывался. Кампания запущена только по аудитории, выбранной ранжированием.")
        else:
            forecast_df = pd.DataFrame(
                [
                    ("Прогноз дополнительных конверсий", fmt_number(campaign.get("predicted_incremental_conversions"))),
                    ("Прогноз дополнительной выручки", fmt_money(campaign.get("predicted_incremental_revenue"))),
                    ("Прогноз прибыли", fmt_money(campaign.get("predicted_profit"))),
                    ("Прогноз ROI", fmt_pct(campaign.get("predicted_roi"))),
                    ("Средний Uplift", fmt_pct(campaign.get("avg_predicted_uplift"))),
                    ("Доля с положительной ценностью", fmt_pct(campaign.get("positive_expected_value_share"))),
                ],
                columns=["Метрика", "Значение"],
            )
            st.dataframe(forecast_df, use_container_width=True, hide_index=True)

    st.subheader("Результаты промоакции")
    if metrics.get("error"):
        st.warning(f"Метрики промоакции недоступны: {translate_error(metrics['error'])}")
    simulation_df = pd.DataFrame(
        [
            ("Доля отклика в тестовой группе", fmt_pct(metrics.get("response_rate_treatment"))),
            ("Доля отклика в контрольной группе", fmt_pct(metrics.get("response_rate_control"))),
            ("Фактический Uplift", fmt_pct(metrics.get("realized_uplift"))),
            ("Дополнительные конверсии", fmt_number(metrics.get("incremental_conversions"))),
            ("Дополнительная выручка", fmt_money(metrics.get("incremental_revenue"))),
            ("Фактическая прибыль", fmt_money(metrics.get("realized_profit"))),
            ("Фактический ROI", fmt_pct(metrics.get("realized_roi"))),
        ],
        columns=["Метрика", "Значение"],
    )
    st.dataframe(simulation_df, use_container_width=True, hide_index=True)

    if metrics.get("forecast_errors"):
        st.subheader("Сравнение прогноза и факта")
        errors = metrics["forecast_errors"]
        comparison_df = pd.DataFrame(
            [
                (
                    "Прибыль",
                    fmt_money(campaign.get("predicted_profit")),
                    fmt_money(metrics.get("realized_profit")),
                    fmt_money(errors.get("profit_error")),
                ),
                (
                    "ROI",
                    fmt_pct(campaign.get("predicted_roi")),
                    fmt_pct(metrics.get("realized_roi")),
                    fmt_pct(errors.get("roi_error")),
                ),
                (
                    "Дополнительные конверсии",
                    fmt_number(campaign.get("predicted_incremental_conversions")),
                    fmt_number(metrics.get("incremental_conversions")),
                    fmt_number(errors.get("incremental_conversions_error")),
                ),
            ],
            columns=["Метрика", "Прогноз", "Факт", "Ошибка"],
        )
        st.dataframe(comparison_df, use_container_width=True, hide_index=True)

    st.subheader("Сравнение с baseline стратегиями")
    baselines = metrics.get("baseline_metrics") or {}
    if baselines:
        st.dataframe(_baseline_frame(baselines), use_container_width=True, hide_index=True)

    st.subheader("Выбранная аудитория")
    audience_display = format_display_values(
        audience.head(500),
        money_columns=("expected_value", "predicted_incremental_revenue", "treatment_cost"),
        pct_columns=("predicted_uplift",),
    )
    st.dataframe(display_table(audience_display), use_container_width=True, hide_index=True)


def _forecast_quality_chart(campaigns: pd.DataFrame, metric_mode: str) -> go.Figure:
    if metric_mode == "ROI":
        y_col = "roi_error"
        y_title = "Ошибка для ROI"
        y_format = ".2%"
    else:
        y_col = "profit_error"
        y_title = "Ошибка для прибыли"
        y_format = ",.0f"

    plot_df = campaigns.sort_values("created_at").copy()
    max_abs_error = pd.to_numeric(plot_df[y_col], errors="coerce").abs().max()
    y_axis_limit = float(max_abs_error) * 1.08 if pd.notna(max_abs_error) and max_abs_error > 0 else 1.0
    bar_colors = ["#2dd4bf" if value >= 0 else "#fb7185" for value in plot_df[y_col]]
    customdata = plot_df[
        [
            "campaign_name",
            "created_at",
            "predicted_profit",
            "realized_profit",
            "profit_error",
            "roi_error",
        ]
    ].to_numpy()

    fig = go.Figure()
    fig.add_trace(
        go.Bar(
            x=plot_df["created_at"],
            y=plot_df[y_col],
            marker={"color": bar_colors, "line": {"color": "#0e1117", "width": 1}},
            customdata=customdata,
            hovertemplate=(
                "Кампания: %{customdata[0]}<br>"
                "Дата запуска: %{customdata[1]|%Y-%m-%d %H:%M}<br>"
                "Прогноз прибыли: %{customdata[2]:,.2f} ₽<br>"
                "Фактическая прибыль: %{customdata[3]:,.2f} ₽<br>"
                "Ошибка для прибыли: %{customdata[4]:,.2f} ₽<br>"
                "Ошибка для ROI: %{customdata[5]:.2%}<br>"
                "<extra></extra>"
            ),
        )
    )
    fig.add_hline(y=0, line_dash="dash", line_color="#9ca3af", opacity=0.75)
    fig.update_layout(
        bargap=0.28,
        height=420,
        margin={"l": 20, "r": 20, "t": 36, "b": 20},
        paper_bgcolor="#0e1117",
        plot_bgcolor="#171923",
        font={"color": "#f8fafc"},
        title={"text": f"{y_title} во времени", "font": {"size": 16}},
        xaxis={
            "title": "Дата запуска",
            "gridcolor": "#343845",
            "linecolor": "#343845",
            "zerolinecolor": "#9ca3af",
        },
        yaxis={
            "title": y_title,
            "tickformat": y_format,
            "ticksuffix": "" if metric_mode == "ROI" else " ₽",
            "range": [-y_axis_limit, y_axis_limit],
            "gridcolor": "#343845",
            "linecolor": "#343845",
            "zerolinecolor": "#9ca3af",
        },
        hoverlabel={"bgcolor": "#262833", "bordercolor": "#4b5163", "font": {"color": "#f8fafc"}},
    )
    return fig


def forecast_quality_tab() -> None:
    init_db()
    raw_campaigns = list_forecast_quality_campaigns()
    quality = build_forecast_quality_frame(raw_campaigns)
    if quality.empty:
        st.info("Нет кампаний, у которых одновременно есть прогноз и результаты.")
        return

    kpi_slot = st.container()
    chart_slot = st.container()
    table_slot = st.container()

    table_columns = [
        "include_in_metrics",
        "campaign_name",
        "created_at",
        "selected_users_count",
        "predicted_profit",
        "realized_profit",
        "profit_error",
        "profit_error_pct",
        "predicted_roi",
        "realized_roi",
        "roi_error",
        "ranking_model",
        "uplift_value_model",
    ]
    table_labels = {
        "include_in_metrics": "Выбрать",
        "campaign_name": "Название кампании",
        "created_at": "Дата запуска",
        "ranking_model": "Модель ранжирования",
        "uplift_value_model": "Модель прогноза Uplift",
        "selected_users_count": "Размер аудитории",
        "predicted_profit": "Прогноз прибыли",
        "realized_profit": "Фактическая прибыль",
        "profit_error": "Ошибка для прибыли",
        "profit_error_pct": "Ошибка для прибыли, %",
        "predicted_roi": "Прогноз ROI",
        "realized_roi": "Фактический ROI",
        "roi_error": "Ошибка для ROI",
    }
    quality_display = quality[table_columns].copy()
    pct_columns = ["profit_error_pct", "predicted_roi", "realized_roi", "roi_error"]
    quality_display[pct_columns] = quality_display[pct_columns] * 100
    with table_slot:
        st.subheader("Кампании для расчета")
        edited = st.data_editor(
            quality_display,
            key="forecast_quality_campaigns_editor",
            use_container_width=True,
            hide_index=True,
            disabled=[column for column in table_columns if column != "include_in_metrics"],
            column_config={
                "include_in_metrics": st.column_config.CheckboxColumn(table_labels["include_in_metrics"]),
                "campaign_name": st.column_config.TextColumn(table_labels["campaign_name"]),
                "created_at": st.column_config.DatetimeColumn(table_labels["created_at"], format="YYYY-MM-DD HH:mm"),
                "ranking_model": st.column_config.TextColumn(table_labels["ranking_model"]),
                "uplift_value_model": st.column_config.TextColumn(table_labels["uplift_value_model"]),
                "selected_users_count": st.column_config.NumberColumn(table_labels["selected_users_count"], format="%d"),
                "predicted_profit": st.column_config.NumberColumn(table_labels["predicted_profit"], format="%.2f ₽"),
                "realized_profit": st.column_config.NumberColumn(table_labels["realized_profit"], format="%.2f ₽"),
                "profit_error": st.column_config.NumberColumn(table_labels["profit_error"], format="%.2f ₽"),
                "profit_error_pct": st.column_config.NumberColumn(table_labels["profit_error_pct"], format="%.2f%%"),
                "predicted_roi": st.column_config.NumberColumn(table_labels["predicted_roi"], format="%.2f%%"),
                "realized_roi": st.column_config.NumberColumn(table_labels["realized_roi"], format="%.2f%%"),
                "roi_error": st.column_config.NumberColumn(table_labels["roi_error"], format="%.2f%%"),
            },
        )
        export_columns = [column for column in table_columns if column != "include_in_metrics"]
        export_labels = {column: label for column, label in table_labels.items() if column != "include_in_metrics"}
        export_table = display_table(quality_display[export_columns], export_labels)
        st.download_button(
            "Выгрузить кампании в Excel",
            data=dataframe_to_excel_bytes(export_table, "forecast_quality"),
            file_name="forecast_quality_campaigns.xlsx",
            mime=EXCEL_MIME,
            key="download_forecast_quality_campaigns",
        )

    selected = quality.loc[edited.index[edited["include_in_metrics"]]].copy()
    aggregates = aggregate_forecast_quality(selected)
    with kpi_slot:
        st.subheader("Качество прогнозов")
        render_kpi_cards(
            [
                ("Кампаний в расчёте", fmt_int(aggregates["campaigns_count"])),
                ("Средняя ошибка для прибыли", fmt_money(aggregates["mean_profit_error"])),
                ("MAE для прибыли", fmt_money(aggregates["mean_absolute_profit_error"])),
                ("MAE % ошибка для прибыли", fmt_pct(aggregates["mean_absolute_percentage_error"])),
                ("Средняя ошибка для ROI", fmt_pct(aggregates["mean_roi_error"])),
                ("Смещение прогноза", fmt_money(aggregates["forecast_bias"])),
            ]
        )

    with chart_slot:
        st.subheader("Ошибка прогноза во времени")
        if selected.empty:
            st.info("Выберите хотя бы одну кампанию в таблице ниже.")
        else:
            metric_mode = st.radio(
                "Режим графика",
                ["Прибыль", "ROI"],
                horizontal=True,
                key="forecast_quality_chart_mode",
            )
            st.plotly_chart(
                _forecast_quality_chart(selected, "ROI" if metric_mode == "ROI" else "Profit"),
                use_container_width=True,
                config={"displayModeBar": False},
            )


def main() -> None:
    render_title()
    with st.spinner("Загружаем данные симуляции и метаданные моделей..."):
        df, metadata, thresholds = load_dataset()

    tab_setup, tab_reports, tab_quality = st.tabs(
        ["Настройка кампании / запуск промо", "Запуски кампаний / отчеты", "Качество прогнозов"]
    )
    with tab_setup:
        campaign_setup_tab(df, metadata, thresholds)
    with tab_reports:
        campaign_reports_tab()
    with tab_quality:
        forecast_quality_tab()


if __name__ == "__main__":
    main()
