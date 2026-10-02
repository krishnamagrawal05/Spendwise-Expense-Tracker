/**
 * Spendwise frontend.
 * The file is split into small sections so each feature is easy to find:
 * settings, API helpers, toasts, modals, theme, then page loaders.
 */

const CATEGORIES = {
    food: { name: "Food", icon: "fa-utensils", color: "#F97316" },
    shopping: { name: "Shopping", icon: "fa-bag-shopping", color: "#EC4899" },
    transport: { name: "Transport", icon: "fa-car", color: "#3B82F6" },
    entertainment: { name: "Entertainment", icon: "fa-film", color: "#8B5CF6" },
    bills: { name: "Bills", icon: "fa-lightbulb", color: "#EAB308" },
    education: { name: "Education", icon: "fa-book", color: "#06B6D4" },
    health: { name: "Health", icon: "fa-heart", color: "#F43F5E" },
    travel: { name: "Travel", icon: "fa-plane", color: "#14B8A6" },
    salary: { name: "Salary", icon: "fa-money-bill-wave", color: "#22C55E" },
    other: { name: "Other", icon: "fa-box", color: "#94A3B8" },
};

const CURRENCY_MAP = {
    INR: { locale: "en-IN", currency: "INR" },
    USD: { locale: "en-US", currency: "USD" },
    EUR: { locale: "de-DE", currency: "EUR" },
    GBP: { locale: "en-GB", currency: "GBP" },
};

const settings = {
    theme: localStorage.getItem("spendwise-theme") || "dark",
    currency: localStorage.getItem("spendwise-currency") || "INR",
    name: localStorage.getItem("spendwise-name") || "Krishnam",
    notifyToasts: localStorage.getItem("spendwise-toasts") !== "off",
    notifyInsights: localStorage.getItem("spendwise-insights") !== "off",
    soundEffects: localStorage.getItem("spendwise-sounds") !== "off",
    voiceSummary: localStorage.getItem("spendwise-voice-summary") !== "off",
};

const charts = {};
let pendingDeleteId = null;

function saveSetting(key, value) {
    localStorage.setItem(key, value);
}

function applyTheme(theme) {
    settings.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    saveSetting("spendwise-theme", theme);
    Object.values(charts).forEach((chart) => {
        if (chart) {
            applyChartTheme(chart);
            chart.update();
        }
    });
}

function initials(name) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "KR";
}

function applyProfile() {
    document.querySelectorAll("#profileName").forEach((el) => {
        el.textContent = settings.name;
    });
    document.querySelectorAll("#profileAvatar").forEach((el) => {
        el.textContent = initials(settings.name);
    });
}

function formatMoney(amount) {
    const config = CURRENCY_MAP[settings.currency] || CURRENCY_MAP.INR;
    return new Intl.NumberFormat(config.locale, {
        style: "currency",
        currency: config.currency,
        maximumFractionDigits: 2,
    }).format(amount || 0);
}

function formatDate(iso) {
    if (!iso) return "";
    const date = new Date(`${iso}T00:00:00`);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    if (sameDay) return "Today";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function greetingText() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning 👋";
    if (hour < 17) return "Good afternoon 👋";
    return "Good evening 👋";
}

function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Something went wrong");
    }
    return data;
}

function showToast(message, type = "success") {
    if (!settings.notifyToasts && type === "success") return;
    const stack = document.getElementById("toastStack");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

function categoryMeta(id) {
    return CATEGORIES[id] || CATEGORIES.other;
}

function iconBadge(categoryId) {
    const meta = categoryMeta(categoryId);
    return `<span class="cat-icon" style="background:${meta.color}" aria-hidden="true"><i class="fa-solid ${meta.icon}"></i></span>`;
}

function animateValue(element, endValue) {
    const start = 0;
    const duration = 650;
    const startTime = performance.now();
    function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const value = start + (endValue - start) * progress;
        element.textContent = formatMoney(value);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function emptyState(title, text, actionLabel) {
    return `
        <div class="empty-state">
            <div class="empty-icon"><i class="fa-solid fa-wallet"></i></div>
            <h3>${title}</h3>
            <p class="muted">${text}</p>
            ${actionLabel ? `<button class="btn primary" type="button" data-open-add>${actionLabel}</button>` : ""}
        </div>
    `;
}

function openModal() {
    const modal = document.getElementById("txModal");
    modal.hidden = false;
    document.getElementById("txAmount").focus();
}

function closeModal() {
    document.getElementById("txModal").hidden = true;
    document.getElementById("txForm").reset();
    document.getElementById("txId").value = "";
    document.getElementById("txModalTitle").textContent = "Add Transaction";
    document.getElementById("txSubmit").textContent = "Add Transaction";
    setType("income");
}

function setType(type) {
    document.querySelectorAll(".type-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.type === type);
    });
}

function currentType() {
    const active = document.querySelector(".type-btn.is-active");
    return active ? active.dataset.type : "income";
}

function fillForm(item) {
    document.getElementById("txId").value = item.id;
    document.getElementById("txTitle").value = item.title;
    document.getElementById("txAmount").value = item.amount;
    document.getElementById("txCategory").value = item.category;
    document.getElementById("txDate").value = item.date;
    document.getElementById("txDescription").value = item.description || "";
    setType(item.type);
    document.getElementById("txModalTitle").textContent = "Edit Transaction";
    document.getElementById("txSubmit").textContent = "Save changes";
    openModal();
}

function openConfirm(id) {
    pendingDeleteId = id;
    document.getElementById("confirmModal").hidden = false;
}

function closeConfirm() {
    pendingDeleteId = null;
    document.getElementById("confirmModal").hidden = true;
}

function toggleSidebar(open) {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    sidebar.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
}

function applyChartTheme(chart) {
    const text = cssVar("--muted");
    const grid = cssVar("--border");
    Chart.defaults.color = text;
    Chart.defaults.borderColor = grid;
    Chart.defaults.font.family = "Plus Jakarta Sans";
    if (chart.options.plugins && chart.options.plugins.legend) {
        chart.options.plugins.legend.labels.color = text;
    }
    if (chart.options.scales) {
        Object.values(chart.options.scales).forEach((scale) => {
            if (scale.ticks) scale.ticks.color = text;
            if (scale.grid) scale.grid.color = grid;
        });
    }
}

function upsertChart(key, ctx, config) {
    if (charts[key]) charts[key].destroy();
    charts[key] = new Chart(ctx, config);
    applyChartTheme(charts[key]);
    charts[key].update();
}

function renderRecent(items) {
    const root = document.getElementById("recentList");
    if (!root) return;
    if (!items.length) {
        root.innerHTML = emptyState("No transactions yet", "Start tracking your finances by adding your first transaction.", "+ Add Transaction");
        return;
    }
    root.innerHTML = items.map((item) => {
        const sign = item.type === "income" ? "+" : "-";
        return `
            <div class="recent-item tx-main">
                ${iconBadge(item.category)}
                <div>
                    <strong>${escapeHtml(item.title)}</strong>
                    <div class="muted">${categoryMeta(item.category).name} · ${formatDate(item.date)}</div>
                </div>
                <strong class="amount ${item.type}" style="margin-left:auto">${sign}${formatMoney(item.amount)}</strong>
            </div>
        `;
    }).join("");
}

function deltaMarkup(value) {
    const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
    const prefix = value > 0 ? "+" : "";
    return `<div class="delta ${direction}">${prefix}${value}% <span class="muted">vs last month</span></div>`;
}

function renderStats(data) {
    const cards = [
        { label: "Total Balance", value: data.balance, change: data.changes.balance, icon: "fa-wallet", color: "#5B8CFF" },
        { label: "Total Income", value: data.income, change: data.changes.income, icon: "fa-arrow-trend-up", color: "#22C55E" },
        { label: "Total Expenses", value: data.expenses, change: data.changes.expenses, icon: "fa-arrow-trend-down", color: "#F43F5E" },
        { label: "Savings", value: data.savings, change: data.changes.savings, icon: "fa-piggy-bank", color: "#14B8A6" },
    ];
    const grid = document.getElementById("statGrid");
    grid.innerHTML = cards.map((card, index) => `
        <article class="stat-card" style="animation-delay:${index * 60}ms">
            <div class="stat-icon" style="background:${card.color}22;color:${card.color}"><i class="fa-solid ${card.icon}"></i></div>
            <h4>${card.label}</h4>
            <div class="amount" data-count="${card.value}">${formatMoney(0)}</div>
            ${deltaMarkup(card.change)}
        </article>
    `).join("");
    grid.querySelectorAll("[data-count]").forEach((el) => {
        animateValue(el, Number(el.dataset.count));
    });

    document.getElementById("summaryMonth").textContent = data.month_label;
    document.getElementById("monthlySummary").innerHTML = `
        <div class="summary-item"><span>Income</span><strong>${formatMoney(data.income)}</strong></div>
        <div class="summary-item"><span>Expenses</span><strong>${formatMoney(data.expenses)}</strong></div>
        <div class="summary-item"><span>Savings</span><strong>${formatMoney(data.savings)}</strong></div>
        <div class="summary-item"><span>Savings rate</span><strong>${data.savings_rate}%</strong></div>
    `;
}

function renderInsights(items) {
    const root = document.getElementById("insightList");
    if (!settings.notifyInsights) {
        root.innerHTML = `<p class="muted">Insights are hidden in Settings.</p>`;
        return;
    }
    if (!items.length) {
        root.innerHTML = `<p class="muted">Add a few transactions to unlock insights.</p>`;
        return;
    }
    root.innerHTML = items.map((item) => `
        <div class="insight ${item.tone}">
            <i class="fa-solid ${item.icon}"></i>
            <span>${item.text}</span>
        </div>
    `).join("");
}

async function loadDashboard() {
    const monthSelect = document.getElementById("monthSelect");
    if (!monthSelect) return;
    const greeting = document.getElementById("greeting");
    if (greeting) greeting.textContent = greetingText();
    if (!monthSelect.value) monthSelect.value = new Date().toISOString().slice(0, 7);
    const data = await api(`/api/stats?month=${encodeURIComponent(monthSelect.value)}`);
    renderStats(data);
    renderRecent(data.recent);
    const insights = await api("/api/insights");
    renderInsights(insights.insights);
    await renderBudget(monthSelect.value);
}

function transactionRow(item) {
    const sign = item.type === "income" ? "+" : "-";
    return `
        <tr>
            <td>${iconBadge(item.category)}</td>
            <td>
                <strong>${escapeHtml(item.title)}</strong>
                <div class="muted">${escapeHtml(item.description || "No description")}</div>
            </td>
            <td>${categoryMeta(item.category).name}</td>
            <td>${formatDate(item.date)}</td>
            <td><span class="badge ${item.type}">${item.type}</span></td>
            <td class="amount ${item.type}">${sign}${formatMoney(item.amount)}</td>
            <td>
                <button class="icon-btn" type="button" data-edit="${item.id}" aria-label="Edit ${item.title}"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn" type="button" data-delete="${item.id}" aria-label="Delete ${item.title}"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `;
}

function transactionCard(item) {
    const sign = item.type === "income" ? "+" : "-";
    return `
        <article class="tx-card">
            <div class="tx-main">
                ${iconBadge(item.category)}
                <div>
                    <strong>${escapeHtml(item.title)}</strong>
                    <div class="muted">${categoryMeta(item.category).name} · ${formatDate(item.date)}</div>
                </div>
                <strong class="amount ${item.type}" style="margin-left:auto">${sign}${formatMoney(item.amount)}</strong>
            </div>
            <div class="button-row" style="margin-top:12px">
                <span class="badge ${item.type}">${item.type}</span>
                <div>
                    <button class="icon-btn" type="button" data-edit="${item.id}" aria-label="Edit ${item.title}"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn" type="button" data-delete="${item.id}" aria-label="Delete ${item.title}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </article>
    `;
}

async function loadTransactions() {
    const form = document.getElementById("txFilters");
    if (!form) return;
    const params = new URLSearchParams(new FormData(form));
    const data = await api(`/api/transactions?${params.toString()}`);
    const tableWrap = document.getElementById("txTableWrap");
    const cardList = document.getElementById("txCardList");
    if (!data.transactions.length) {
        const empty = emptyState("No transactions yet", "Start tracking your finances by adding your first transaction.", "+ Add Transaction");
        tableWrap.innerHTML = empty;
        cardList.innerHTML = empty;
        return;
    }
    tableWrap.innerHTML = `
        <table class="tx-table">
            <thead>
                <tr>
                    <th>Icon</th>
                    <th>Transaction</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${data.transactions.map(transactionRow).join("")}</tbody>
        </table>
    `;
    cardList.innerHTML = data.transactions.map(transactionCard).join("");
}

function setChartVisibility(hasData) {
    document.querySelectorAll(".chart-box").forEach((box) => {
        box.style.display = hasData ? "block" : "none";
    });
}

async function loadAnalytics() {
    const tabs = document.getElementById("periodTabs");
    if (!tabs) return;
    const active = tabs.querySelector(".is-active");
    const period = active ? active.dataset.period : "this_month";
    const customFrom = document.getElementById("customFrom").value;
    const customTo = document.getElementById("customTo").value;
    const query = new URLSearchParams({ period, from: customFrom, to: customTo });
    const data = await api(`/api/analytics?${query.toString()}`);

    const stats = document.getElementById("analyticsStats");
    stats.innerHTML = [
        ["Income", data.income, "income"],
        ["Expenses", data.expenses, "expense"],
        ["Savings", data.savings, data.savings >= 0 ? "income" : "expense"],
        ["Transactions", data.count, ""],
    ].map(([label, value, klass]) => `
        <article class="stat-card">
            <h4>${label}</h4>
            <div class="amount ${klass}">${label === "Transactions" ? value : formatMoney(value)}</div>
        </article>
    `).join("");

    const emptyRoot = document.getElementById("analyticsEmpty");
    const categoryNote = document.getElementById("categoryChartNote");
    const categoryCanvas = document.getElementById("categoryChart");
    if (!data.count) {
        setChartVisibility(false);
        if (emptyRoot) {
            emptyRoot.innerHTML = emptyState("No analytics yet", "Add transactions or load demo data to see charts.", "+ Add Transaction");
        }
        return;
    }
    if (emptyRoot) emptyRoot.innerHTML = "";
    setChartVisibility(true);
    const categoryRows = data.expense_by_category.length
        ? data.expense_by_category
        : [{ name: "No expenses", amount: 1, color: "#94A3B8" }];
    if (categoryNote) {
        categoryNote.hidden = data.expense_by_category.length > 0;
        categoryNote.textContent = "No expenses in this period.";
    }

    upsertChart("category", categoryCanvas, {
        type: "doughnut",
        data: {
            labels: categoryRows.map((item) => item.name),
            datasets: [{
                data: categoryRows.map((item) => item.amount),
                backgroundColor: categoryRows.map((item) => item.color),
            }],
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    });

    upsertChart("incomeExpense", document.getElementById("incomeExpenseChart"), {
        type: "bar",
        data: {
            labels: ["Income", "Expense"],
            datasets: [{
                data: [data.income_vs_expense.income, data.income_vs_expense.expense],
                backgroundColor: [cssVar("--success"), cssVar("--danger")],
            }],
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });

    upsertChart("monthly", document.getElementById("monthlyChart"), {
        type: "line",
        data: {
            labels: data.monthly.map((item) => item.month),
            datasets: [
                { label: "Income", data: data.monthly.map((item) => item.income), borderColor: cssVar("--success"), tension: 0.35 },
                { label: "Expense", data: data.monthly.map((item) => item.expense), borderColor: cssVar("--danger"), tension: 0.35 },
            ],
        },
        options: { maintainAspectRatio: false },
    });

    upsertChart("daily", document.getElementById("dailyChart"), {
        type: "bar",
        data: {
            labels: data.daily.map((item) => item.date.slice(5)),
            datasets: [{
                label: "Spending",
                data: data.daily.map((item) => item.expense),
                backgroundColor: cssVar("--primary"),
            }],
        },
        options: { maintainAspectRatio: false },
    });

    upsertChart("savings", document.getElementById("savingsChart"), {
        type: "line",
        data: {
            labels: data.monthly.map((item) => item.month),
            datasets: [{
                label: "Savings",
                data: data.monthly.map((item) => item.savings),
                borderColor: cssVar("--primary"),
                backgroundColor: "rgba(91,140,255,0.18)",
                fill: true,
                tension: 0.35,
            }],
        },
        options: { maintainAspectRatio: false },
    });
}

async function loadCategories() {
    const root = document.getElementById("categoryGrid");
    if (!root) return;
    const data = await api("/api/category-totals");
    if (!data.categories.length) {
        root.innerHTML = emptyState("No categories", "Categories will appear here.");
        return;
    }
    const hasAny = data.categories.some((item) => item.count > 0);
    root.innerHTML = data.categories.map((item) => `
        <article class="category-card">
            <div class="tx-main">
                ${iconBadge(item.id)}
                <div>
                    <strong>${item.name}</strong>
                    <div class="count">${item.count} transaction${item.count === 1 ? "" : "s"}</div>
                </div>
            </div>
            <p class="amount expense" style="margin:12px 0 0">${formatMoney(item.expense)}</p>
            <p class="muted">Income ${formatMoney(item.income)}</p>
        </article>
    `).join("");
    if (!hasAny) {
        root.insertAdjacentHTML("afterbegin", emptyState("No spending yet", "Add transactions to see category totals.", "+ Add Transaction"));
    }
}

function bindSettingsPage() {
    const currency = document.getElementById("currencySelect");
    if (!currency) return;
    currency.value = settings.currency;
    document.getElementById("settingsName").value = settings.name;
    document.getElementById("notifyToasts").checked = settings.notifyToasts;
    document.getElementById("notifyInsights").checked = settings.notifyInsights;
    const sound = document.getElementById("soundEffects");
    const voice = document.getElementById("voiceSummary");
    if (sound) sound.checked = settings.soundEffects;
    if (voice) voice.checked = settings.voiceSummary;
    const budgetMonth = document.getElementById("budgetMonth");
    if (budgetMonth) budgetMonth.value = new Date().toISOString().slice(0, 7);
    loadBudgetIntoSettings();

    currency.addEventListener("change", () => {
        settings.currency = currency.value;
        saveSetting("spendwise-currency", currency.value);
        showToast("✓ Currency updated");
        refreshCurrentPage();
    });
    document.getElementById("saveProfile").addEventListener("click", () => {
        const name = document.getElementById("settingsName").value.trim() || "Krishnam";
        settings.name = name;
        saveSetting("spendwise-name", name);
        applyProfile();
        showToast("✓ Profile saved");
        playSound("success");
    });
    document.getElementById("notifyToasts").addEventListener("change", (event) => {
        settings.notifyToasts = event.target.checked;
        saveSetting("spendwise-toasts", event.target.checked ? "on" : "off");
    });
    document.getElementById("notifyInsights").addEventListener("change", (event) => {
        settings.notifyInsights = event.target.checked;
        saveSetting("spendwise-insights", event.target.checked ? "on" : "off");
    });
    if (sound) sound.addEventListener("change", (event) => {
        settings.soundEffects = event.target.checked;
        saveSetting("spendwise-sounds", event.target.checked ? "on" : "off");
        if (settings.soundEffects) playSound("click");
    });
    if (voice) voice.addEventListener("change", (event) => {
        settings.voiceSummary = event.target.checked;
        saveSetting("spendwise-voice-summary", event.target.checked ? "on" : "off");
    });
    document.getElementById("loadDemo").addEventListener("click", async () => {
        const result = await api("/api/demo-data", { method: "POST" });
        showToast(`✓ ${result.message}`);
        playSound("success");
        await refreshCurrentPage();
    });
    document.getElementById("resetDemo").addEventListener("click", async () => {
        const result = await api("/api/reset-demo", { method: "POST" });
        showToast(`✓ ${result.message}`);
        playSound("success");
        await refreshCurrentPage();
    });
    document.getElementById("clearAll").addEventListener("click", () => {
        document.getElementById("confirmTitle").textContent = "Clear all transactions?";
        document.getElementById("confirmText").textContent = "This deletes every transaction, including demo data.";
        pendingDeleteId = "ALL";
        document.getElementById("confirmModal").hidden = false;
    });
    const saveBudgetBtn = document.getElementById("saveBudget");
    if (saveBudgetBtn) saveBudgetBtn.addEventListener("click", saveBudgetFromSettings);
    const removeBudgetBtn = document.getElementById("removeBudget");
    if (removeBudgetBtn) removeBudgetBtn.addEventListener("click", removeBudgetFromSettings);
    if (budgetMonth) budgetMonth.addEventListener("change", loadBudgetIntoSettings);
}

function playSound(kind = "click") {
    if (!settings.soundEffects || !window.AudioContext && !window.webkitAudioContext) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = window.__spendwiseAudio || new AudioCtx();
        window.__spendwiseAudio = ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        const tones = { click: 520, success: 740, delete: 260, warning: 360 };
        osc.frequency.setValueAtTime(tones[kind] || 520, now);
        osc.type = kind === "delete" ? "sawtooth" : "sine";
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
    } catch (_) {}
}

function speakTransaction(item) {
    if (!settings.voiceSummary || !("speechSynthesis" in window) || !item) return;
    window.speechSynthesis.cancel();
    const sign = item.type === "income" ? "Income" : "Expense";
    const text = `${sign} of ${formatMoney(item.amount)} added for ${item.title}. Category ${categoryMeta(item.category).name}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

function startVoiceInput(targetId, buttonId) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const button = document.getElementById(buttonId);
    const target = document.getElementById(targetId);
    if (!SpeechRecognition || !button || !target) {
        showToast("Voice input is not supported in this browser.", "warning");
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    button.classList.add("is-listening");
    showToast("Listening… speak now");
    playSound("click");
    recognition.onresult = (event) => {
        target.value = event.results[0][0].transcript;
        target.dispatchEvent(new Event("input", { bubbles: true }));
    };
    recognition.onerror = () => showToast("I couldn't hear that. Please try again.", "warning");
    recognition.onend = () => button.classList.remove("is-listening");
    recognition.start();
}

async function renderBudget(month) {
    const panel = document.getElementById("budgetPanel");
    if (!panel) return;
    const data = await api(`/api/budget?month=${encodeURIComponent(month)}`);
    const progress = document.getElementById("budgetProgress");
    const spent = document.getElementById("budgetSpent");
    const limit = document.getElementById("budgetLimit");
    const status = document.getElementById("budgetStatusText");
    if (!data.has_budget) {
        panel.classList.remove("is-warning", "is-over");
        progress.style.width = "0%";
        spent.textContent = formatMoney(data.spent);
        limit.textContent = "No limit set";
        status.textContent = "Set a limit to keep spending on track.";
        return;
    }
    progress.style.width = `${Math.min(data.percent, 100)}%`;
    spent.textContent = `${formatMoney(data.spent)} spent`;
    limit.textContent = `of ${formatMoney(data.limit)}`;
    panel.classList.toggle("is-warning", data.percent >= 80 && !data.over);
    panel.classList.toggle("is-over", data.over);
    status.textContent = data.over
        ? `Budget exceeded by ${formatMoney(Math.abs(data.remaining))}.`
        : `${formatMoney(data.remaining)} remaining this month.`;
}

async function loadBudgetIntoSettings() {
    const month = document.getElementById("budgetMonth")?.value;
    if (!month) return;
    try {
        const data = await api(`/api/budget?month=${encodeURIComponent(month)}`);
        const input = document.getElementById("budgetAmount");
        if (input) input.value = data.has_budget ? data.limit : "";
    } catch (error) { showToast(`⚠ ${error.message}`, "warning"); }
}

async function saveBudgetFromSettings() {
    const month = document.getElementById("budgetMonth")?.value;
    const amount = document.getElementById("budgetAmount")?.value;
    try {
        const result = await api("/api/budget", { method: "POST", body: JSON.stringify({ month, amount }) });
        showToast(`✓ ${result.message}`);
        playSound("success");
        await refreshCurrentPage();
    } catch (error) { showToast(`⚠ ${error.message}`, "warning"); playSound("warning"); }
}

async function removeBudgetFromSettings() {
    const month = document.getElementById("budgetMonth")?.value;
    try {
        await api(`/api/budget?month=${encodeURIComponent(month)}`, { method: "DELETE" });
        document.getElementById("budgetAmount").value = "";
        showToast("✓ Budget removed");
        playSound("delete");
        await refreshCurrentPage();
    } catch (error) { showToast(`⚠ ${error.message}`, "warning"); }
}

function initEnhancedUI() {
    const editBudget = document.getElementById("editBudgetBtn");
    if (editBudget) editBudget.addEventListener("click", () => {
        window.location.href = "/settings";
    });
    const titleVoice = document.getElementById("voiceTitleBtn");
    const descVoice = document.getElementById("voiceDescriptionBtn");
    if (titleVoice) titleVoice.addEventListener("click", () => startVoiceInput("txTitle", "voiceTitleBtn"));
    if (descVoice) descVoice.addEventListener("click", () => startVoiceInput("txDescription", "voiceDescriptionBtn"));

    document.querySelectorAll(".btn, .icon-btn, .chip-btn, .nav-link, .type-btn").forEach((el) => {
        el.addEventListener("click", () => { if (!el.classList.contains("field-action")) playSound("click"); });
    });

    window.addEventListener("mousemove", (event) => {
        document.documentElement.style.setProperty("--mx", `${event.clientX}px`);
        document.documentElement.style.setProperty("--my", `${event.clientY}px`);
    }, { passive: true });

    const dot = document.getElementById("cursorDot");
    const ring = document.getElementById("cursorRing");
    if (dot && ring && matchMedia("(pointer:fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        let x = -100, y = -100, rx = -100, ry = -100;
        window.addEventListener("mousemove", (event) => {
            x = event.clientX; y = event.clientY;
            dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        });
        const follow = () => {
            rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
            ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
            requestAnimationFrame(follow);
        };
        follow();
        document.addEventListener("mouseover", (event) => {
            const interactive = event.target.closest("button, a, input, select, textarea");
            document.body.classList.toggle("cursor-hover", Boolean(interactive));
        });
    }
}

async function refreshCurrentPage() {
    try {
        if (document.getElementById("statGrid")) await loadDashboard();
        if (document.getElementById("txFilters")) await loadTransactions();
        if (document.getElementById("periodTabs")) await loadAnalytics();
        if (document.getElementById("categoryGrid")) await loadCategories();
    } catch (error) {
        showToast(`⚠ ${error.message}`, "warning");
    }
}

function bindGlobalEvents() {
    document.getElementById("headerDate").textContent = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
    applyTheme(settings.theme);
    applyProfile();

    document.querySelectorAll(".theme-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
            applyTheme(settings.theme === "dark" ? "light" : "dark");
        });
    });

    document.getElementById("menuToggle").addEventListener("click", () => toggleSidebar(true));
    document.getElementById("sidebarBackdrop").addEventListener("click", () => toggleSidebar(false));
    document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => toggleSidebar(false)));

    document.getElementById("openAddModal").addEventListener("click", () => {
        document.getElementById("txDate").value = new Date().toISOString().slice(0, 10);
        openModal();
    });
    document.querySelectorAll("[data-close-modal]").forEach((btn) => btn.addEventListener("click", closeModal));
    document.querySelectorAll("[data-close-confirm]").forEach((btn) => btn.addEventListener("click", closeConfirm));

    document.querySelectorAll(".type-btn").forEach((btn) => {
        btn.addEventListener("click", () => setType(btn.dataset.type));
    });

    document.getElementById("txForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = {
            title: document.getElementById("txTitle").value,
            amount: document.getElementById("txAmount").value,
            type: currentType(),
            category: document.getElementById("txCategory").value,
            date: document.getElementById("txDate").value,
            description: document.getElementById("txDescription").value,
        };
        try {
            const id = document.getElementById("txId").value;
            const result = id
                ? await api(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(payload) })
                : await api("/api/transactions", { method: "POST", body: JSON.stringify(payload) });
            showToast(id ? "✓ Transaction updated successfully" : "✓ Transaction added successfully");
            playSound(id ? "click" : "success");
            if (!id) speakTransaction(result.transaction);
            closeModal();
            await refreshCurrentPage();
            return result;
        } catch (error) {
            showToast(`⚠ ${error.message}`, "warning");
        }
    });

    document.getElementById("confirmDelete").addEventListener("click", async () => {
        try {
            if (pendingDeleteId === "ALL") {
                await api("/api/clear", { method: "POST", body: JSON.stringify({ confirm: "delete" }) });
                showToast("✓ All transactions deleted");
            } else if (pendingDeleteId) {
                await api(`/api/transactions/${pendingDeleteId}`, { method: "DELETE" });
                showToast("✓ Transaction deleted");
                playSound("delete");
            }
            closeConfirm();
            document.getElementById("confirmTitle").textContent = "Delete this transaction?";
            document.getElementById("confirmText").textContent = "This action cannot be undone.";
            await refreshCurrentPage();
        } catch (error) {
            showToast(`⚠ ${error.message}`, "warning");
        }
    });

    document.body.addEventListener("click", async (event) => {
        const addBtn = event.target.closest("[data-open-add]");
        if (addBtn) {
            document.getElementById("txDate").value = new Date().toISOString().slice(0, 10);
            openModal();
        }
        const editBtn = event.target.closest("[data-edit]");
        if (editBtn) {
            const item = await api(`/api/transactions/${editBtn.dataset.edit}`);
            fillForm(item.transaction);
        }
        const deleteBtn = event.target.closest("[data-delete]");
        if (deleteBtn) openConfirm(deleteBtn.dataset.delete);
    });

    document.getElementById("globalSearchForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const query = document.getElementById("globalSearch").value.trim();
        window.location.href = `/transactions?q=${encodeURIComponent(query)}`;
    });

    document.getElementById("notifyBtn").addEventListener("click", () => {
        showToast(settings.notifyInsights ? "Insights are enabled on the dashboard." : "Notifications are muted in Settings.");
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeModal();
            closeConfirm();
            toggleSidebar(false);
        }
        if ((event.key === "n" || event.key === "N") && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) && !event.ctrlKey && !event.metaKey) {
            document.getElementById("txDate").value = new Date().toISOString().slice(0, 10);
            openModal();
        }
    });
}

function bindPageEvents() {
    const monthSelect = document.getElementById("monthSelect");
    if (monthSelect) {
        monthSelect.value = new Date().toISOString().slice(0, 7);
        monthSelect.addEventListener("change", loadDashboard);
    }

    const filters = document.getElementById("txFilters");
    if (filters) {
        const params = new URLSearchParams(window.location.search);
        if (params.get("q")) filters.q.value = params.get("q");
        filters.addEventListener("input", loadTransactions);
        filters.addEventListener("change", loadTransactions);
    }

    const tabs = document.getElementById("periodTabs");
    if (tabs) {
        const custom = document.getElementById("customRange");
        tabs.addEventListener("click", (event) => {
            const button = event.target.closest("[data-period]");
            if (!button) return;
            tabs.querySelectorAll(".chip-btn").forEach((item) => item.classList.remove("is-active"));
            button.classList.add("is-active");
            custom.hidden = button.dataset.period !== "custom";
            if (button.dataset.period !== "custom") loadAnalytics();
        });
        document.getElementById("applyCustom").addEventListener("click", loadAnalytics);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    bindGlobalEvents();
    initEnhancedUI();
    bindPageEvents();
    bindSettingsPage();
    await refreshCurrentPage();
});
