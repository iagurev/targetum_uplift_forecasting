# 0. Описание MVP

**Система для оптимизации маркетинговых кампаний через uplift-моделирование и оценку финансовой эффективности.**

> система помогает выбрать аудиторию кампании, заранее оценить ожидаемую прибыль, запустить кампанию на тестовой среде и сравнить результат с baseline-стратегиями.

---

MVP не обучает новые модели.
MVP использует заранее сохраненные uplift-модели.
MVP работает в offline/simulation режиме.
MVP не отправляет реальные коммуникации пользователям.
MVP работает только с simulation_test.csv и получает данные только из него
Launch promo = создание записи кампании + прогон на simulation dataset.

# 1. Выбранные модели и шаблоны кода

В качестве двух основных моделей выбираем:

- `Class Transformation` (Classiс ML подход на основе бустинга). При этом предсказанное значение uplift для модели не откалибровано, она может использоваться только при ранжировании
- `CFRNet + MMD Loss` (DL подход для более сложных зависимостей и сильных различиях Test/Control)
- На этапе MVP приложения попробуем `DR-Learner`, показавший самый высокий uplift на top-5% клиентов (но менее стабильный на остальных)

Модели сохранены в формате .pkl папке uplift_final_models

# Вкладка 1. Campaign Setup / Launch Promo

## Назначение

Вкладка предназначена для настройки маркетинговой кампании, отбора целевой аудитории, оценки ожидаемого uplift и финансового эффекта, а также запуска промоакции на выбранной подвыборке клиентов.

Вкладка состоит из четырёх последовательных этапов:

1. **Campaign Configuration**
2. **Audience Filtering & Ranking**
3. **Uplift Value Prediction & Financial Forecast**
4. **Promo Launch**

---

## 1. Campaign Configuration

Цель этапа - Задать параметры кампании, ограничения отбора и стратегию формирования аудитории.

**Входные параметры**

### 1.1. Параметры кампании

Пользователь задаёт:

| Параметр         | Описание                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `campaign_name`        | Название кампании                                                                                              |
| `campaign_description` | Краткое описание кампании                                                                               |
| `conversion_value`     | Финансовая ценность одной конверсии                                                            |
| `treatment_cost`       | Стоимость воздействия на одного пользователя                                           |
| `budget`               | Общий бюджет кампании, опционально                                                               |
| `max_reach`            | Максимальное количество пользователей для воздействия, опционально |
| `min_reach`            | Минимальный допустимый размер аудитории, опционально                            |

---

### 1.2. Фильтры по данным

Пользователь может задать произвольные фильтры на признаки пользователей.

Запрещено использовать response_att и group на этапе фильтрации и ранжирования.
Они используются только для simulation/evaluation.

### Набор фильтров для MVP

| Блок                  | Фильтры                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Basic**           | `age`,`gender`,`children`,`months_from_register`,`main_format`                                                                                                                                                |
| **Activity**        | total `cheque_count_3m`,`cheque_count_6m`,`cheque_count_12m`; total `sale_sum_3m`,`sale_sum_6m`,`sale_sum_12m`                                                                                              |
| **Promo**           | `promo_share_15d`;`mean_discount_depth_15d`;`disc_sum_6m_g34`;`food_share_15d`,`food_share_1m`                                                                                                                |
| **Crazy campaigns** | `crazy_purchases_cheque_count_1m`,`crazy_purchases_cheque_count_3m`,`crazy_purchases_cheque_count_6m`,`crazy_purchases_cheque_count_12m`;`crazy_purchases_goods_count_6m`,`crazy_purchases_goods_count_12m` |
| **Visits**          | `k_var_days_between_visits_15d`,`k_var_days_between_visits_1m`,`k_var_days_between_visits_3m`;`stdev_days_between_visits_15d`;`perdelta_days_between_visits_15_30d`                                           |
| **Basket**          | `k_var_cheque_15d`,`k_var_cheque_3m`;`k_var_cheque_category_width_15d`;`k_var_cheque_group_width_15d`                                                                                                           |
| **Presets**         | `active`,`promo_sensitive`,`at_risk`,`high_value`,`category_specific`                                                                                                                                         |

---

### Как считать total-фичи по группам товаров

Для activity-блока в данных признаки заданы по товарным группам `g*`, поэтому для UI лучше завести агрегаты:

```text
total_cheque_count_3m = sum(cheque_count_3m_g*)
total_cheque_count_6m = sum(cheque_count_6m_g*)
total_cheque_count_12m = sum(cheque_count_12m_g*)

total_sale_sum_3m = sum(sale_sum_3m_g*)
total_sale_sum_6m = sum(sale_sum_6m_g*)
total_sale_sum_12m = sum(sale_sum_12m_g*)
```

Если нужны category-specific фильтры, тогда отдельно разрешаем выбирать конкретную группу `gX`:

```text
sale_sum_3m_gX
sale_sum_6m_gX
sale_sum_12m_gX

cheque_count_3m_gX
cheque_count_6m_gX
cheque_count_12m_gX
```

---

### Структура в UI

**Basic filters**

| Фильтр                                   | Поле                 |
| ---------------------------------------------- | ------------------------ |
| Возраст                                 | `age`                  |
| Пол                                         | `gender`               |
| Наличие детей                      | `children`             |
| Стаж клиента                        | `months_from_register` |
| Основной формат магазина | `main_format`          |

---

**Activity filters**

| Фильтр                    | Временные окна |
| ------------------------------- | --------------------------- |
| Количество чеков | `3m`,`6m`,`12m`       |
| Сумма покупок       | `3m`,`6m`,`12m`       |

Поля:

```text
total_cheque_count_3m
total_cheque_count_6m
total_cheque_count_12m

total_sale_sum_3m
total_sale_sum_6m
total_sale_sum_12m
```

---

**Promo filters**

| Фильтр                                      | Временные окна |
| ------------------------------------------------- | --------------------------- |
| Доля промо                               | `15d`                     |
| Средняя глубина скидки        | `15d`                     |
| Сумма скидок по группе `g34` | `6m`                      |
| Доля food-покупок                      | `15d`,`1m`              |

Поля:

```text
promo_share_15d
mean_discount_depth_15d
disc_sum_6m_g34
food_share_15d
food_share_1m
```

---

**Crazy campaigns filters**

| Фильтр                                           | Временные окна  |
| ------------------------------------------------------ | ---------------------------- |
| Количество чеков в crazy campaigns     | `1m`,`3m`,`6m`,`12m` |
| Количество товаров в crazy campaigns | `6m`,`12m`               |

Поля:

```text
crazy_purchases_cheque_count_1m
crazy_purchases_cheque_count_3m
crazy_purchases_cheque_count_6m
crazy_purchases_cheque_count_12m

crazy_purchases_goods_count_6m
crazy_purchases_goods_count_12m
```

---

**Visits filters**

| Фильтр                                                                     | Временные окна |
| -------------------------------------------------------------------------------- | --------------------------- |
| Коэффициент вариации дней между визитами     | `15d`,`1m`,`3m`       |
| Стандартное отклонение дней между визитами | `15d`                     |
| Изменение интервала между визитами                | `15d vs 30d`              |

Поля:

```text
k_var_days_between_visits_15d
k_var_days_between_visits_1m
k_var_days_between_visits_3m
stdev_days_between_visits_15d
perdelta_days_between_visits_15_30d
```

---

**Basket filters**

| Фильтр                                                     | Временные окна |
| ---------------------------------------------------------------- | --------------------------- |
| Вариативность размера чека               | `15d`,`3m`              |
| Разнообразие категорий в чеке          | `15d`                     |
| Разнообразие товарных групп в чеке | `15d`                     |

Поля:

```text
k_var_cheque_15d
k_var_cheque_3m
k_var_cheque_category_width_15d
k_var_cheque_group_width_15d
```

---

**Presets**

| Preset                | Условие                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `active`            | `total_cheque_count_3m > 0`или `total_sale_sum_3m > 0`                                           |
| `promo_sensitive`   | `promo_share_15d > P75`или `mean_discount_depth_15d > P75`или `disc_sum_6m_g34 > P75`       |
| `at_risk`           | `perdelta_days_between_visits_15_30d > 0`или `k_var_days_between_visits_1m > P75`                |
| `high_value`        | `total_sale_sum_12m > P75`и `months_from_register >= 12`                                           |
| `category_specific` | `sale_sum_{window}_gX > 0`или `cheque_count_{window}_gX > 0`, где `window ∈ {3m, 6m, 12m}` |

---

Результатом применения фильтров является `filtered_audience` - подвыборка клиентов из simulation_test.csv.

---

### 1.3. Стратегия выбора пользователей

Пользователь выбирает одну стратегию:

| Strategy                  | Описание                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `top_k_percent`         | Выбрать top-k% пользователей по ranking score                                                           |
| `top_n`                 | Выбрать top-N пользователей по ranking score                                                            |
| `budget_constrained`    | Выбрать максимально возможное число пользователей в рамках бюджета |
| `max_reach_constrained` | Выбрать пользователей с учётом `max_reach`                                                       |

Для стратегии `budget_constrained`:

```text
max_users_by_budget = floor(budget / treatment_cost)
```

Итоговое ограничение:

```text
selected_users_count = min(max_users_by_budget, max_reach, available_users_after_filtering)
```

---

## 2. Audience Filtering & Ranking

Цель этапа - Сформировать итоговую аудиторию кампании на основе фильтров, ranking-модели и стратегии выбора пользователей.

### 2.1. Выбор модели для ранжирования

Пользователь выбирает `ranking_model`.

На этом этапе доступны  **все сохранённые uplift-модели** , включая модели, которые не дают калиброванную абсолютную оценку uplift.

Пример моделей:

| Model                    | Доступность на этапе ranking |
| ------------------------ | ---------------------------------------------- |
| `Class Transformation` | Да                                           |
| `CFRNet + MMD Loss`    | Да                                           |
| `DR-Learner`           | Да                                           |

На этом этапе `uplift_score` используется только как  **ranking score** .

Важно:

```text
uplift_score на этом этапе не интерпретируется как абсолютный uplift,
если модель не помечена как calibrated.
```

---

### 2.2. Последовательность обработки

Система выполняет следующие действия:

**Шаг 1. Применение первичных фильтров**

```text
candidate_audience -> filters -> filtered_audience
```

На выходе:

```text
filtered_audience
```

---

**Шаг 2. Скоринг пользователей**

Для каждого пользователя из `filtered_audience` модель рассчитывает:

```text
uplift_score_i = ranking_model.predict(user_features_i)
```

На выходе:

```text
scored_audience = [
    user_id,
    features,
    uplift_score
]
```

---

**Шаг 3. Ранжирование**

Пользователи сортируются по убыванию `uplift_score`:

```text
ranked_audience = sort(scored_audience, by=uplift_score, descending=True)
```

---

**Шаг 4. Выбор итоговой подвыборки**

На основе выбранной стратегии система формирует:

```text
selected_audience
```

Примеры:

```text
top_k_percent:
selected_audience = top k% from ranked_audience
```

```text
top_n:
selected_audience = top N from ranked_audience
```

```text
budget_constrained:
selected_audience = top floor(budget / treatment_cost) users
```

С учётом дополнительных ограничений:

```text
selected_users_count <= max_reach
selected_users_count <= available_users_after_filtering
campaign_cost <= budget
```

---

### 2.3. Выходные данные этапа

После выполнения ranking-этапа система отображает:

### Метрики отбора

| Метрика           | Описание                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `initial_users_count`  | Размер исходной выборки                                                               |
| `filtered_users_count` | Размер выборки после фильтров                                                    |
| `selected_users_count` | Размер итоговой аудитории                                                           |
| `selection_rate`       | Доля выбранных пользователей от размера исходной выборки |
| `budget_used`          | Использованный бюджет                                                                  |
| `campaign_cost`        | Стоимость воздействия на выбранную аудиторию                       |
| `remaining_budget`     | Остаток бюджета                                                                              |

---

### Break-even метрика

Система рассчитывает минимальный фактический uplift, необходимый для окупаемости кампании:

```text
break_even_uplift = treatment_cost / conversion_value
```

Интерпретация:

```text
Кампания становится прибыльной, если фактический uplift в выбранной аудитории выше break_even_uplift.
```

---

### Выходная выборка

Система формирует таблицу:

```text
selected_audience = [
    user_id,
    rank,
    selected_flag,
    campaign_id
]
```

Эта выборка используется на следующих этапах.

---

## 3. Uplift Value Prediction & Financial Forecast

Цель этапа - Получить абсолютную оценку uplift для выбранной аудитории и рассчитать ожидаемый финансовый эффект кампании.

Этот этап является отдельным от ranking-этапа.

---

### 3.1. Выбор модели для абсолютного uplift

Пользователь выбирает `uplift_value_model`.

На этом этапе доступны только модели с признаком:

```text
supports_absolute_uplift = true
```

или:

```text
is_calibrated = true
```

Модели, которые не поддерживают абсолютную оценку uplift:

* отображаются в списке;
* недоступны для выбора;
* помечены как `ranking only`.

Пример:

| Model                    | Доступность для absolute uplift |
| ------------------------ | --------------------------------------------- |
| `Class Transformation` | Нет, ranking only                          |
| `CFRNet + MMD Loss`    | Да, если откалибрована     |
| `DR-Learner`           | Да, если откалибрована     |

---

### 3.2. Последовательность обработки

**Шаг 1. Получение выбранной аудитории**

На вход этапа поступает:

```text
selected_audience
```

---

**Шаг 2. Предсказание абсолютного uplift**

Для каждого пользователя:

```text
predicted_uplift_i = uplift_value_model.predict(user_features_i)
```

Здесь `predicted_uplift_i` интерпретируется как:

```text
ожидаемый индивидуальный incremental conversion probability
```

---

**Шаг 3. Расчёт expected value на пользователя**

```text
expected_value_i = predicted_uplift_i * conversion_value - treatment_cost
```

---

**Шаг 4. Расчёт агрегированных метрик**

```text
predicted_incremental_conversions = sum(predicted_uplift_i)
```

```text
predicted_incremental_revenue = predicted_incremental_conversions * conversion_value
```

```text
campaign_cost = selected_users_count * treatment_cost
```

```text
predicted_profit = predicted_incremental_revenue - campaign_cost
```

```text
predicted_roi = predicted_profit / campaign_cost
```

---

### 3.3. Выходные метрики этапа

| Метрика                        | Описание                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| `predicted_incremental_conversions` | Ожидаемое количество дополнительных конверсий |
| `predicted_incremental_revenue`     | Ожидаемая дополнительная выручка                          |
| `campaign_cost`                     | Стоимость кампании                                                     |
| `predicted_profit`                  | Ожидаемая прибыль                                                       |
| `predicted_roi`                     | Ожидаемый ROI                                                                  |
| `avg_predicted_uplift`              | Средний абсолютный uplift в выбранной аудитории     |
| `median_predicted_uplift`           | Медианный absolute uplift                                                      |
| `negative_uplift_share`             | Доля пользователей с отрицательным uplift                |
| `positive_expected_value_share`     | Доля пользователей с `expected_value_i > 0`                         |

---

### 3.4. Выходная таблица

После этапа absolute uplift prediction система дополняет выбранную аудиторию:

```text
selected_audience_with_forecast = [
    user_id,
    rank,
    predicted_uplift,
    expected_value,
    predicted_incremental_revenue,
    treatment_cost,
    selected_flag
]
```

---

## 4. Promo Launch

Цель этапа - Зафиксировать запуск промоакции на выбранной аудитории.

В MVP запуск означает создание записи кампании и сохранение итоговой аудитории для последующей offline-оценки.

---

### 4.1. Условия запуска

Кнопка `Launch promo` доступна, если выполнены условия:

```text
selected_audience is not empty
campaign_cost <= budget
selected_users_count > 0
campaign_name is not empty
```

Если пользователь хочет запуск с финансовым прогнозом, дополнительно требуется:

```text
uplift_value_model is selected
predicted_profit is calculated
```

Но сам запуск может быть доступен и без absolute uplift prediction, если задача — только запустить кампанию на отранжированной аудитории.

---

### 4.2. Что сохраняется при запуске

Система создаёт объект `CampaignRun`.

```text
CampaignRun:
    campaign_id
    campaign_name
    created_at
    campaign_status
    filters_config
    ranking_model_name
    ranking_strategy
    uplift_value_model_name
    budget
    treatment_cost
    conversion_value
    max_reach
    selected_users_count
    campaign_cost
    predicted_incremental_conversions
    predicted_incremental_revenue
    predicted_profit
    predicted_roi
    selected_audience_path
```

Если absolute uplift prediction не выполнялся:

```text
predicted_incremental_conversions = null
predicted_incremental_revenue = null
predicted_profit = null
predicted_roi = null
uplift_value_model_name = null
```

---

### 4.3. Статусы кампании

Минимальный набор статусов:

| Status         | Описание                                                |
| -------------- | --------------------------------------------------------------- |
| `draft`      | Кампания настроена, но не запущена |
| `ranked`     | Аудитория сформирована                     |
| `forecasted` | Посчитан финансовый прогноз            |
| `launched`   | Промоакция запущена                           |
| `evaluated`  | Получены результаты offline-оценки      |

---

## 5. Итоговый flow вкладки

```text
1. User sets campaign parameters and filters
2. System applies filters to candidate audience
3. User selects ranking model
4. System scores and ranks users
5. System selects final audience according to strategy
6. System shows ranking-stage metrics and selected audience
7. User optionally selects calibrated uplift value model
8. System predicts absolute uplift for selected users
9. System calculates financial forecast
10. User launches promo on selected audience
11. System saves CampaignRun and selected audience
```

# Вкладка 2. Campaign Runs / Reports

## Назначение

Вкладка предназначена для просмотра запущенных кампаний, анализа результатов offline simulation и сравнения предсказанных метрик с фактическими метриками на simulation dataset.

Вкладка состоит из трёх блоков:

1. **Campaign Runs Table**
2. **Campaign Details Dashboard**
3. **Simulation Report**

---

## 1. Campaign Runs Table

Цель блока - Показать список всех запущенных кампаний и ключевые итоговые метрики.

### Источник данных

Таблица строится на основе сохранённых объектов:

```text
CampaignRun
CampaignMetrics
```

### Поля таблицы

| Поле                 | Описание                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `campaign_id`          | Уникальный идентификатор кампании                      |
| `campaign_name`        | Название кампании                                                     |
| `created_at`           | Дата и время запуска                                                 |
| `status`               | Статус кампании                                                         |
| `ranking_model`        | Модель, использованная для ранжирования            |
| `uplift_value_model`   | Модель для absolute uplift prediction, если использовалась |
| `selected_users_count` | Размер выбранной аудитории                                    |
| `campaign_cost`        | Стоимость кампании                                                   |
| `predicted_profit`     | Предсказанная прибыль до запуска                         |
| `realized_profit`      | Прибыль по результатам simulation                                 |
| `realized_roi`         | ROI по результатам simulation                                            |

Версия таблицы для MVP:

| Campaign          |           Date |            Audience size |              ROI |
| ----------------- | -------------: | -----------------------: | ---------------: |
| `campaign_name` | `created_at` | `selected_users_count` | `realized_roi` |

и в нее еще добавить Статус:

draft

ranked

forecasted

launched

evaluated

failed

---

## 2. Simulation после запуска кампании

Цель - После запуска каждая кампания автоматически оценивается на `simulation dataset`.

### Входные данные

```text
selected_audience
simulation_dataset
campaign_config
predicted_metrics
```

`simulation_dataset` лежит в simulation_test.csv

---

### Логика оценки

Система находит пользователей из `selected_audience` в `simulation_dataset`.

Далее внутри выбранной аудитории рассчитываются:

```text
response_rate_treatment = mean(response_att | group = treatment)
```

```text
response_rate_control = mean(response_att | group = control)
```

```text
realized_uplift = response_rate_treatment - response_rate_control
```

```text
incremental_conversions = selected_users_count * realized_uplift
```

```text
incremental_revenue = incremental_conversions * conversion_value
```

```text
campaign_cost = selected_users_count * treatment_cost
```

```text
realized_profit = incremental_revenue - campaign_cost
```

```text
realized_roi = realized_profit / campaign_cost
```

---

## 3. Campaign Details Dashboard

Цель блока - показать подробный отчет по выбранной кампании.

Пользователь выбирает кампанию из таблицы и открывает детальный dashboard.

---

### 3.1. Campaign Parameters

Показываются параметры, заданные до запуска.

| Поле                 | Описание                                           |
| ------------------------ | ---------------------------------------------------------- |
| `campaign_name`        | Название кампании                          |
| `campaign_description` | Описание кампании                          |
| `created_at`           | Дата запуска                                    |
| `ranking_model`        | Модель ранжирования                      |
| `uplift_value_model`   | Модель absolute uplift prediction                    |
| `selection_strategy`   | Стратегия выбора пользователей |
| `filters_config`       | Использованные фильтры                |
| `budget`               | Бюджет                                               |
| `treatment_cost`       | Стоимость контакта                        |
| `conversion_value`     | Ценность конверсии                        |
| `max_reach`            | Максимальный охват                        |
| `selected_users_count` | Размер итоговой аудитории           |

---

### 3.2. Pre-launch Forecast

Показывается то, что было рассчитано перед запуском.

Если использовалась calibrated uplift-модель:

| Метрика                        | Описание                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `predicted_incremental_conversions` | Предсказанные дополнительные конверсии       |
| `predicted_incremental_revenue`     | Предсказанная дополнительная выручка           |
| `predicted_profit`                  | Предсказанная прибыль                                        |
| `predicted_roi`                     | Предсказанный ROI                                                   |
| `avg_predicted_uplift`              | Средний predicted uplift                                                  |
| `positive_expected_value_share`     | Доля пользователей с положительным expected value |

Если absolute uplift prediction не использовался:

```text
predicted_incremental_conversions = null
predicted_incremental_revenue = null
predicted_profit = null
predicted_roi = null
```

В UI отображается:

```text
Financial forecast was not calculated.
Campaign was launched using ranking-only audience selection.
```

---

### 3.3. Simulation Results

Показываются фактические результаты offline simulation.

| Метрика              | Описание                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `response_rate_treatment` | Доля отклика в treatment-группе выбранной аудитории |
| `response_rate_control`   | Доля отклика в control-группе выбранной аудитории   |
| `realized_uplift`         | Фактический uplift                                                           |
| `incremental_conversions` | Фактические дополнительные конверсии                  |
| `incremental_revenue`     | Фактическая дополнительная выручка                      |
| `campaign_cost`           | Стоимость кампании                                                     |
| `realized_profit`         | Фактическая прибыль                                                   |
| `realized_roi`            | Фактический ROI                                                              |

---

### 3.4. Forecast vs Simulation

Если перед запуском был рассчитан финансовый прогноз, система сравнивает forecast и simulation.

| Метрика                    | Формула                                                           |
| --------------------------------- | ------------------------------------------------------------------------ |
| `profit_error`                  | `realized_profit - predicted_profit`                                   |
| `roi_error`                     | `realized_roi - predicted_roi`                                         |
| `incremental_conversions_error` | `realized_incremental_conversions - predicted_incremental_conversions` |
| `profit_error_pct`              | `(realized_profit - predicted_profit) / abs(predicted_profit)`         |

Если прогноз не был рассчитан, блок не отображается.

---

## 4. Baseline Comparison

Цель - Показать, лучше ли выбранная uplift-policy работает относительно простых стратегий.

### Baseline-стратегии

| Baseline             | Описание                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `random_same_size` | Случайный выбор такого же количества пользователей, используй класс RandomModel |
| `target_all`       | Воздействие на всех пользователей из filtered audience                                                     |
| `no_treatment`     | Никого не таргетировать                                                                                               |

---

### Метрики сравнения

Для каждой стратегии считаются:

| Метрика              | Описание                                |
| --------------------------- | ----------------------------------------------- |
| `realized_uplift`         | Фактический uplift                   |
| `incremental_conversions` | Дополнительные конверсии |
| `incremental_revenue`     | Дополнительная выручка     |
| `campaign_cost`           | Стоимость кампании             |
| `realized_profit`         | Прибыль                                  |
| `realized_roi`            | ROI                                             |

Дополнительно для uplift-policy:

```text
profit_delta_vs_random = uplift_policy_profit - random_same_size_profit
```

```text
roi_delta_vs_random = uplift_policy_roi - random_same_size_roi
```

```text
profit_delta_vs_target_all = uplift_policy_profit - target_all_profit
```

```text
roi_delta_vs_target_all = uplift_policy_roi - target_all_roi
```

---

## 5. Recommended Dashboard Layout

### Верхний блок: KPI cards

Карточки:

| Card                    | Значение            |
| ----------------------- | --------------------------- |
| Realized Profit         | `realized_profit`         |
| Realized ROI            | `realized_roi`            |
| Realized Uplift         | `realized_uplift`         |
| Incremental Conversions | `incremental_conversions` |
| Campaign Cost           | `campaign_cost`           |

---

### Средний блок: Campaign setup

Таблица параметров:

```text
model
strategy
filters
budget
cost
conversion value
audience size
```

---

### Средний блок: Forecast vs Simulation

Таблица:

| Metric                  |                             Predicted |                    Realized |                             Error |
| ----------------------- | ------------------------------------: | --------------------------: | --------------------------------: |
| Profit                  |                  `predicted_profit` |         `realized_profit` |                  `profit_error` |
| ROI                     |                     `predicted_roi` |            `realized_roi` |                     `roi_error` |
| Incremental conversions | `predicted_incremental_conversions` | `incremental_conversions` | `incremental_conversions_error` |

---

### Нижний блок: Baseline comparison

Таблица:

| Strategy         |              Audience size |                Uplift |                Profit |                ROI |
| ---------------- | -------------------------: | --------------------: | --------------------: | -----------------: |
| Uplift policy    |   `selected_users_count` |   `realized_uplift` |   `realized_profit` |   `realized_roi` |
| Random same-size |     `random_users_count` |     `random_uplift` |     `random_profit` |     `random_roi` |
| Target all       | `target_all_users_count` | `target_all_uplift` | `target_all_profit` | `target_all_roi` |
| No treatment     |                      `0` |                 `0` |                 `0` |              `0` |

---

## 6. Что сохраняется после simulation

После запуска и оценки кампания получает статус:

```text
evaluated
```

Система сохраняет:

```text
CampaignMetrics:
    campaign_id
    response_rate_treatment
    response_rate_control
    realized_uplift
    incremental_conversions
    incremental_revenue
    campaign_cost
    realized_profit
    realized_roi
    baseline_metrics
    forecast_errors
    evaluated_at
```

---

## 7. Итоговый flow вкладки

```text
1. User opens Campaign Runs table
2. System displays all launched campaigns with key metrics
3. User selects a campaign
4. System opens Campaign Details Dashboard
5. Dashboard shows campaign parameters
6. Dashboard shows pre-launch forecast, if available
7. Dashboard shows realized metrics from simulation dataset
8. Dashboard compares uplift-policy with baselines
9. Dashboard shows forecast vs simulation errors, if forecast exists
```

# Вкладка 3. Качество прогнозов

Назначение

Вкладка оценивает, насколько точно предварительные прогнозы промоакций совпали с фактическими результатами simulation.

В расчёт включаются только кампании, у которых есть и forecast-метрики, и realized-метрики.

---

## Структура вкладки

### 1. Верхний блок: ключевые метрики

В верхней части вкладки показать KPI-карточки с агрегированными ошибками прогноза:

- `campaigns_count` — количество кампаний, участвующих в расчёте;
- `mean_profit_error` — средняя ошибка прибыли;
- `mean_absolute_profit_error` — средняя абсолютная ошибка прибыли;
- `mean_absolute_percentage_error` — средняя абсолютная процентная ошибка прибыли;
- `mean_roi_error` — средняя ошибка ROI;
- `forecast_bias` — среднее систематическое смещение прогноза.

Названия карточек в UI:

- Кампаний в расчёте
- Средняя ошибка прибыли
- MAE прибыли
- MAPE прибыли
- Средняя ошибка ROI
- Смещение прогноза

---

### 2. График ошибки прогноза во времени

Временной barchart по дате запуска кампании.

Ось X:

- `created_at`

Ось Y:

- `profit_error = realized_profit - predicted_profit`

Также есть аналогичный режим для ROI для этого графика:

- `roi_error = realized_roi - predicted_roi`

---

### 3. Таблица кампаний для фильтрации

Ниже графика - таблица кампаний.

Пользователь должен иметь возможность включать или исключать кампании из расчёта агрегированных метрик.

Колонки таблицы:

- `include_in_metrics`
- `campaign_name`
- `created_at`
- `ranking_model`
- `uplift_value_model`
- `selected_users_count`
- `predicted_profit`
- `realized_profit`
- `profit_error`
- `profit_error_pct`
- `predicted_roi`
- `realized_roi`
- `roi_error`

При изменении `include_in_metrics` нужно пересчитывать KPI-карточки и графики только по выбранным кампаниям.

---

## Правила отбора данных

Вкладка использует только кампании, у которых заполнены:

```python
predicted_profit is not None
realized_profit is not None
predicted_roi is not None
realized_roi is not None
```

Если подходящих кампаний нет, показать сообщение:

```text
Нет кампаний, у которых одновременно есть прогноз и результаты simulation.
```

---

## Формулы

```python
profit_error = realized_profit - predicted_profit
profit_error_pct = profit_error / abs(predicted_profit)
roi_error = realized_roi - predicted_roi
absolute_profit_error = abs(profit_error)
absolute_percentage_error = abs(profit_error_pct)
```

Агрегированные метрики:

```python
mean_profit_error = mean(profit_error)
mean_absolute_profit_error = mean(abs(profit_error))
mean_absolute_percentage_error = mean(abs(profit_error_pct))
mean_roi_error = mean(roi_error)
forecast_bias = mean(profit_error)
```

---

# Формулы метрик

Для forecast:
predicted_incremental_conversions = sum(predicted_uplift_i)
predicted_incremental_revenue = predicted_incremental_conversions * conversion_value
campaign_cost = selected_users_count * treatment_cost
predicted_profit = predicted_incremental_revenue - campaign_cost
predicted_roi = predicted_profit / campaign_cost

Для simulation:
response_rate_treatment = mean(response_att | group = treatment)
response_rate_control = mean(response_att | group = control)
realized_uplift = response_rate_treatment - response_rate_control
incremental_conversions = selected_users_count * realized_uplift
incremental_revenue = incremental_conversions * conversion_value
realized_profit = incremental_revenue - campaign_cost
realized_roi = realized_profit / campaign_cost

И отдельно обработать corner cases:
campaign_cost = 0 → ROI не считается
нет treatment/control внутри selected audience → realized uplift не считается
selected_users_count = 0 → launch запрещен

# Обработка ошибок

| Ситуация                                           | Поведение системы                           |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| После фильтров 0 пользователей   | Показать ошибку, ranking недоступен |
| Budget меньше treatment_cost                         | Показать ошибку, launch недоступен  |
| Модель не поддерживает absolute uplift | Disabled на этапе forecast                           |
| Нет treatment/control в selected audience              | Simulation metrics unavailable                              |
| Нет обязательных признаков         | Модель disabled                                       |
| predicted_profit отсутствует                    | В отчете forecast-блок скрыт                |
