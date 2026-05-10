# Targetum

Сервис для Uplift-моделирования
и офлайн-запуска маркетинговых кампаний.

# Навигация

`ModelSelection.md` - Предварительное исследование, имплементация и сравнение подходов из Uplift-моделирования

`ModelSelection.ipynb` - Jupyter Notebook с кодом исследования

`Targetum.pdf` - Короткая презентация приложения. Рекомендуется предварительно ознакомиться с исследованием

`Documentation.md` - Описание основных принципов работы приложения

Тестируемые модели

| Уровень | Модель |
|---|---|
| 0. Baseline | Random |
| 0. Baseline | Response Model |
| 1. Базовые подходы | S-Learner |
| 1. Базовые подходы | T-Learner |
| 1. Базовые подходы | Class Transformation |
| 2. Продвинутые подходы | Transformed Outcome |
| 2. Продвинутые подходы | X-Learner |
| 2. Продвинутые подходы | DR-Learner |
| 2. Продвинутые подходы | Uplift Random Forest |
| 3. Deep Learning | TARNet |
| 3. Deep Learning | CFRNet + MMD Loss |
| 3. Deep Learning | DragonNet |

# Запуск

Для корректной работы нужно скачать файл из архива `simulation_test.csv.zip` в корневую папку

Запустить из корня репозитория:

```bash
streamlit run streamlit_app/app.py
```

История сохраняется локально в `streamlit_app/app_data/uplift_campaigns.db`. На данный момент предзагружены результаты основных экспериментов
