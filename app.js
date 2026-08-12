// --- SETTINGS ---
    // Change this to your Render URL! (No trailing slash)
    let API_BASE_URL;
    
    // "Am I currently opened on a laptop's local hard drive?"
    if (window.location.hostname === "localhost" || window.location.protocol === "file:") {
        // YES: Connect to the Sandbox (Local uvicorn server)
        API_BASE_URL = "http://localhost:8000"; 
    } else {
        // NO: I must be live on the internet! Connect to the Live Stage (Render)
        API_BASE_URL = "https://flo-api.onrender.com"; 
    }
    
    let categoryMap = {}; // Cheat sheet for category IDs to Names

    // --- AUTHENTICATION UI TOGGLE ---
    function toggleAuth(view) {
        if (view === 'register') {
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('register-form').style.display = 'block';
        } else {
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
        }
    }

    // --- APP LOGIC ---
    // Check if we are already logged in when the app opens
    window.onload = () => {
        if (localStorage.getItem("token")) {
            showApp();
        }
    };

    // --- USER REGISTRATION LOGIC ---
    async function registerUser() {
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        // 1. Basic Validation
        if (!email || !password) {
            alert("Please fill in both an email and a password.");
            return;
        }

        try {
            // 2. Send the data to your backend
            // NOTE: You might need to change '/users/' to match your exact backend route!
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: email, password: password })
            });

            // 3. Handle the response
            if (response.ok) {
                alert("Account created successfully! Please log in.");
                
                // Flip the UI back to the login screen automatically
                toggleAuth('login');
                
                // UX trick: Auto-fill the email they just used so they don't have to type it twice
                document.getElementById('email').value = email;
                document.getElementById('password').value = ""; // clear password field
                document.getElementById('reg-password').value = ""; 
                
            } else {
                // If the backend rejects it (e.g., email already exists)
                const errorData = await response.json();
                alert("Registration failed: " + (errorData.detail || JSON.stringify(errorData)));
            }
        } catch (error) {
            console.error("Registration crash:", error);
            alert("Network error. Make sure your Python backend is running!");
        }
    }

    async function login() {
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        // OAuth2 requires form data, not JSON!
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem("token", data.access_token); // Save the Visitor Badge
            localStorage.setItem("refresh_token", data.refresh_token); // Save the Vault Key
            // Wipe the inputs so Chrome stops snooping!
            document.getElementById("email").value = ""; 
            document.getElementById("password").value = "";
            showApp();
        } else {
            alert("Login failed! Check credentials.");
        }
    }

    function showApp() {
        document.getElementById("login-screen").classList.add("hidden");
        document.getElementById("app-screen").classList.remove("hidden");
        fetchCategories();
        fetchTransactions();
        fetchDashboardAnalytics();
    }

    async function fetchAnalytics() {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/analytics/rolling-average`, {
            headers: { "Authorization": `Bearer ${token}` }
        }); 
        if (response.ok) {
            const data = await response.json();
            document.getElementById("total-spent").innerText = `₹${data.total_spent_in_window.toFixed(2)}`;
        }
    }

    async function fetchTransactions() {
        let token = localStorage.getItem("token");
        if (!token) return;

        let response = await fetch(`${API_BASE_URL}/transactions/?skip=0&limit=200`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.status === 401) {
            const refreshSuccess = await refreshAccessToken();
            if (refreshSuccess) {
                token = localStorage.getItem("token");
                response = await fetch(`${API_BASE_URL}/transactions/?skip=0&limit=50`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
            } else {
                localStorage.removeItem("token");
                localStorage.removeItem("refresh_token");
                alert("Session expired. Please log in again.");
                window.location.reload();
                return;
            }
        }

        if (response.ok) {
            const transactions = await response.json();
            const list = document.getElementById("transaction-list");
            list.innerHTML = "";

            // 1. Get exact local dates (Timezone safe)
            const now = new Date();
            const todayStr = now.toLocaleDateString('en-CA'); 

            // 2. Calculate the date of this past Monday
            const dayOfWeek = now.getDay(); // Sunday is 0, Monday is 1, etc.
            const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
            const monday = new Date(now);
            monday.setDate(now.getDate() - daysSinceMonday);
            const mondayStr = monday.toLocaleDateString('en-CA');

            // 3. Filter and Calculate
            let dailyTotal = 0;
            let weeklyTotal = 0;

            // Calculate weekly total by checking if the date falls between Monday and Today
            transactions.forEach(t => {
                if (t.transaction_date >= mondayStr && t.transaction_date <= todayStr) {
                    weeklyTotal += t.amount;
                }
            });

            // Filter the list for the UI to ONLY show today's items
            const todaysTransactions = transactions.filter(t => t.transaction_date === todayStr);

            // 4. Build Today's HTML List
            if (todaysTransactions.length === 0) {
                list.innerHTML = "<p style='text-align: center; color: gray; font-style: italic;'>No expenses logged today. Great job!</p>";
            } else {
                todaysTransactions.forEach(t => {
                    dailyTotal += t.amount; // Add to our daily total
                    
                    const catName = categoryMap[t.category_id] || 'Uncategorized';
                    
                    const li = document.createElement("li");
                    li.style.display = "flex";
                    li.style.justifyContent = "space-between";
                    li.style.padding = "10px 0";
                    li.style.borderBottom = "1px solid #eee";
                    
                    li.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box; padding: 10px 0; border-bottom: 1px solid #eee;">
                        
                            <div style="flex: 1; padding-right: 15px; word-break: break-word;">
                                <strong>${t.description}</strong><br>
                                <small style="color: gray; font-size: 12px;">${catName}</small>
                            </div>
                            
                            <div style="display: flex; align-items: center; flex-shrink: 0;">
                                <span style="font-weight: bold; color: #dc3545; margin-right: 10px;">-₹${t.amount.toFixed(2)}</span>
                                <span style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; transition: background 0.2s;" 
                                    onmouseover="this.style.backgroundColor='#e9ecef'" 
                                    onmouseout="this.style.backgroundColor='transparent'"
                                    onclick='openTxModal(${t.id}, ${t.amount}, "${t.description}", "${t.transaction_date}", ${t.category_id})'>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 20h9"></path>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                    </svg>
                                </span>
                            </div>

                        </div>
                    `;
                    list.appendChild(li);
                });
            }

            // 5. Update BOTH badges!
            document.getElementById("weekly-total").innerText = `₹${weeklyTotal.toFixed(2)}`;
            document.getElementById("daily-total").innerText = `₹${dailyTotal.toFixed(2)}`;
        }
    }

    async function fetchHistory() {
        let token = localStorage.getItem("token");
        
        // 1. The URL now specifically asks the backend dial for 50 items
        let response = await fetch(`${API_BASE_URL}/transactions/?limit=50`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        // 2. The same silent security trap we built earlier!
        if (response.status === 401) {
            const refreshSuccess = await refreshAccessToken();
            if (refreshSuccess) {
                token = localStorage.getItem("token"); 
                response = await fetch(`${API_BASE_URL}/transactions/?limit=50`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
            } else {
                localStorage.removeItem("token");
                localStorage.removeItem("refresh_token");
                alert("Your secure session has expired. Please log in again.");
                window.location.reload();
                return;
            }
        }

        const list = document.getElementById("history-list");

        if (response.ok) {
            const transactions = await response.json();
            list.innerHTML = ""; 
            
            if (transactions.length === 0) {
                list.innerHTML = "<p style='color: gray; text-align: center;'>No history found.</p>";
                return;
            }

            // Loop through all 50 items and display them
            transactions.forEach(t => {
                // 1. Look up the name in our cheat sheet, or default to Uncategorized
                const catName = categoryMap[t.category_id] || 'Uncategorized';

                // 2. Build the HTML with the Edit Button injected!
                list.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                        
                        <div style="flex: 1; padding-right: 15px; word-break: break-word;">
                            <strong>${t.description}</strong><br>
                            <small style="color: gray; font-size: 12px;">${catName}</small>
                        </div>
                        
                        <div style="display: flex; align-items: center; flex-shrink: 0;">
                            <span style="font-weight: bold; color: #dc3545; margin-right: 10px;">-₹${t.amount.toFixed(2)}</span>
                            <span style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; transition: background 0.2s;" 
                                  onmouseover="this.style.backgroundColor='#e9ecef'" 
                                  onmouseout="this.style.backgroundColor='transparent'"
                                  onclick='openTxModal(${t.id}, ${t.amount}, "${t.description}", "${t.transaction_date}", ${t.category_id})'>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 20h9"></path>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                </svg>
                            </span>
                        </div>

                    </div>
                `;
            });
        } else {
            list.innerHTML = "<p style='color: red; text-align: center;'>Failed to load history.</p>";
        }
    }

    // Global variables to hold chart instances
    let spendingChartInstance = null;
    let trendChartInstance = null;

    // --- MAIN DASHBOARD ANALYTICS LOADER ---
    async function fetchDashboardAnalytics() {
        let token = localStorage.getItem("token");
        if (!token) return;

        // Fetch only the 4 main analytics dashboard endpoints (No AI query call here)
        await Promise.all([
            fetchKpis(),
            fetchBudgetVsActual(),
            fetchTrends(),
            fetchStatsAndOutliers(),
            fetchChartData()
        ]);
    }

    async function fetchKpis() {
        let token = localStorage.getItem("token");
        try {
            let res = await fetch(`${API_BASE_URL}/analytics/kpis`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.status === 401) {
                if (await refreshAccessToken()) return fetchKpis();
                return;
            }
            if (res.ok) {
                const data = await res.json();
                const inc = data.total_income || 0;
                const exp = data.total_expense || 0;
                const bal = data.net_balance !== undefined ? data.net_balance : (inc - exp);
                
                document.getElementById("kpi-income").innerText = `₹${inc.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
                document.getElementById("kpi-expense").innerText = `₹${exp.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
                
                const balEl = document.getElementById("kpi-balance");
                balEl.innerText = `₹${bal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
                balEl.style.color = bal >= 0 ? "var(--success)" : "var(--danger)";

                const monthlyAvg = data.monthly_avg_spending !== undefined ? data.monthly_avg_spending : exp;
                document.getElementById("kpi-monthly-avg").innerText = `₹${monthlyAvg.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
                document.getElementById("kpi-tx-count").innerText = `${data.expense_transactions_count || 0} expense txs`;
            }
        } catch (e) {
            console.error("Error fetching KPIs:", e);
        }
    }

    async function fetchBudgetVsActual() {
        let token = localStorage.getItem("token");
        try {
            let res = await fetch(`${API_BASE_URL}/analytics/budget-vs-actual`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.status === 401) {
                if (await refreshAccessToken()) return fetchBudgetVsActual();
                return;
            }
            if (res.ok) {
                const data = await res.json();
                const listEl = document.getElementById("budget-list");
                const utilEl = document.getElementById("budget-overall-util");

                if (data.totals) {
                    utilEl.innerText = `${data.totals.overall_utilization_pct || 0}% Used`;
                }

                if (!data.categories || data.categories.length === 0) {
                    listEl.innerHTML = `<div class="empty-state">No category budgets set yet. Edit categories to assign monthly limits!</div>`;
                    return;
                }

                let html = "";
                data.categories.forEach(cat => {
                    const isOver = cat.is_over_budget;
                    const util = Math.min(cat.utilization_pct || 0, 100);
                    const barColor = isOver ? "var(--danger)" : (cat.utilization_pct > 80 ? "var(--warning)" : "var(--primary)");
                    
                    html += `
                        <div class="budget-item">
                            <div class="budget-header">
                                <span>
                                    ${cat.category_name}
                                    ${isOver ? '<span class="over-budget-tag">OVER BUDGET</span>' : ''}
                                </span>
                                <span>₹${(cat.actual || 0).toLocaleString('en-IN')} / ${cat.budget > 0 ? '₹' + cat.budget.toLocaleString('en-IN') : 'No Limit'}</span>
                            </div>
                            <div class="budget-bar-bg">
                                <div class="budget-bar-fill" style="width: ${cat.budget > 0 ? util : 0}%; background-color: ${barColor};"></div>
                            </div>
                            <div class="budget-meta">
                                <span>${cat.budget > 0 ? cat.utilization_pct + '% utilized' : 'Uncapped'}</span>
                                <span>${cat.budget > 0 ? (cat.remaining >= 0 ? '₹' + cat.remaining.toLocaleString('en-IN') + ' left' : '₹' + Math.abs(cat.remaining).toLocaleString('en-IN') + ' over') : ''}</span>
                            </div>
                        </div>
                    `;
                });
                listEl.innerHTML = html;
            }
        } catch (e) {
            console.error("Error fetching Budget vs Actual:", e);
        }
    }

    async function fetchTrends() {
        let token = localStorage.getItem("token");
        try {
            let res = await fetch(`${API_BASE_URL}/analytics/trends`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.status === 401) {
                if (await refreshAccessToken()) return fetchTrends();
                return;
            }
            if (res.ok) {
                const data = await res.json();
                
                const momBadge = document.getElementById("mom-badge");
                const momSubtext = document.getElementById("mom-subtext");
                const curr = data.current_month_spending || 0;
                const prev = data.previous_month_spending || 0;
                const pct = data.mom_change_pct || 0;

                momSubtext.innerText = `This month: ₹${curr.toLocaleString('en-IN')} | Last month: ₹${prev.toLocaleString('en-IN')}`;
                if (pct >= 0) {
                    momBadge.className = "mom-pill up";
                    momBadge.innerText = `+${pct}% MoM`;
                } else {
                    momBadge.className = "mom-pill down";
                    momBadge.innerText = `${pct}% MoM`;
                }

                const trends = data.daily_trends || [];
                const canvas = document.getElementById("trend-chart");
                const emptyEl = document.getElementById("trend-empty-state");

                if (trends.length === 0) {
                    canvas.style.display = "none";
                    emptyEl.style.display = "block";
                    return;
                }

                canvas.style.display = "block";
                emptyEl.style.display = "none";

                const labels = trends.map(t => t.date);
                const values = trends.map(t => t.amount);

                const ctx = canvas.getContext("2d");
                if (trendChartInstance) {
                    trendChartInstance.destroy();
                }

                trendChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Daily Spending (₹)',
                            data: values,
                            borderColor: '#007AFF',
                            backgroundColor: 'rgba(0, 122, 255, 0.08)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 4,
                            pointBackgroundColor: '#007AFF'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                            y: { ticks: { font: { size: 10 } } }
                        }
                    }
                });
            }
        } catch (e) {
            console.error("Error fetching Trends:", e);
        }
    }

    async function fetchStatsAndOutliers() {
        let token = localStorage.getItem("token");
        try {
            let res = await fetch(`${API_BASE_URL}/analytics/stats-and-outliers`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.status === 401) {
                if (await refreshAccessToken()) return fetchStatsAndOutliers();
                return;
            }
            if (res.ok) {
                const data = await res.json();
                const listEl = document.getElementById("outliers-list");
                const outliers = data.outliers || [];

                if (outliers.length === 0) {
                    listEl.innerHTML = `<div class="empty-state">No unusually large transactions detected.</div>`;
                    return;
                }

                let html = "";
                outliers.forEach(out => {
                    html += `
                        <div class="outlier-item">
                            <div>
                                <strong>${out.description}</strong><br>
                                <small style="color: var(--text-muted); font-size: 11px;">${out.category_name} • ${out.transaction_date}</small>
                            </div>
                            <div style="font-weight: 700; color: var(--danger);">
                                ₹${out.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                            </div>
                        </div>
                    `;
                });
                listEl.innerHTML = html;
            }
        } catch (e) {
            console.error("Error fetching Outliers:", e);
        }
    }

    function setAiQuery(promptText) {
        document.getElementById("ai-query-input").value = promptText;
        submitAiQuery();
    }

    async function submitAiQuery() {
        const inputEl = document.getElementById("ai-query-input");
        const query = inputEl.value.trim();
        if (!query) return;

        const containerEl = document.getElementById("ai-response-container");
        const loadingEl = document.getElementById("ai-loading");
        const textEl = document.getElementById("ai-response-text");
        const submitBtn = document.getElementById("ai-submit-btn");

        containerEl.style.display = "block";
        loadingEl.style.display = "block";
        textEl.style.display = "none";
        submitBtn.disabled = true;

        let token = localStorage.getItem("token");
        try {
            let res = await fetch(`${API_BASE_URL}/ai/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ query: query })
            });

            if (res.status === 401) {
                if (await refreshAccessToken()) return submitAiQuery();
                alert("Session expired. Please log in again.");
                return;
            }

            if (res.ok) {
                const data = await res.json();
                loadingEl.style.display = "none";
                textEl.style.display = "block";
                let formatted = (data.response || data.answer || "No response generated.")
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                textEl.innerHTML = formatted;
            } else {
                const errData = await res.json().catch(() => ({}));
                loadingEl.style.display = "none";
                textEl.style.display = "block";
                textEl.innerHTML = `<span style="color: #FF453A;">Error: ${errData.detail || "Unable to process AI query"}</span>`;
            }
        } catch (err) {
            console.error("AI query error:", err);
            loadingEl.style.display = "none";
            textEl.style.display = "block";
            textEl.innerHTML = `<span style="color: #FF453A;">Network error. Please try again.</span>`;
        } finally {
            submitBtn.disabled = false;
        }
    }

    async function fetchChartData() {
        const token = localStorage.getItem("token");
        try {
            const response = await fetch(`${API_BASE_URL}/analytics/summary`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            const canvas = document.getElementById("analytics-chart");
            const emptyEl = document.getElementById("category-empty-state");

            if (response.ok) {
                const rawData = await response.json();

                if (!rawData || rawData.length === 0) {
                    if (canvas) canvas.style.display = "none";
                    if (emptyEl) emptyEl.style.display = "block";
                    return;
                }

                if (canvas) canvas.style.display = "block";
                if (emptyEl) emptyEl.style.display = "none";

                const chartLabels = rawData.map(item => item.category_name);
                const chartValues = rawData.map(item => item.total_spent);
                const totalSpentSum = chartValues.reduce((a, b) => a + b, 0);

                const totalBadge = document.getElementById("category-total-badge");
                if (totalBadge) {
                    totalBadge.innerText = `Total: ₹${totalSpentSum.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
                }

                const ctx = canvas.getContext("2d");

                if (spendingChartInstance) {
                    spendingChartInstance.destroy();
                }

                spendingChartInstance = new Chart(ctx, {
                    type: 'doughnut', 
                    data: {
                        labels: chartLabels,
                        datasets: [{
                            label: 'Total Spent (₹)',
                            data: chartValues,
                            backgroundColor: [
                                '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#5856D6', '#AF52DE', '#FF2D55', '#5AC8FA'
                            ],
                            borderWidth: 2,
                            borderColor: '#FFFFFF'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { 
                                position: 'bottom',
                                labels: {
                                    boxWidth: 12,
                                    padding: 10,
                                    font: { size: 11 }
                                }
                            }
                        }
                    }
                });
            }
        } catch (e) {
            console.error("Error fetching chart data:", e);
        }
    }

    async function addTransaction() {
        const token = localStorage.getItem("token");
        const amount = document.getElementById("amount").value;
        const desc = document.getElementById("desc").value;
        const categoryId = document.getElementById("category-select").value;
        
        const payload = {
            amount: parseFloat(amount),
            type: "Expense",
            description: desc,
            transaction_date: new Date().toISOString().split('T')[0],
            category_id: parseInt(categoryId)
        };

        const response = await fetch(`${API_BASE_URL}/transactions/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            document.getElementById("amount").value = "";
            document.getElementById("desc").value = "";
            fetchTransactions();
            fetchDashboardAnalytics();
        } else {
            alert("Failed to save transaction.");
        }
    }

    async function fetchCategories() {
        let token = localStorage.getItem("token");
        if (!token) return;

        try {
            let response = await fetch(`${API_BASE_URL}/transactions/categories`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            // Handle token refresh safely
            if (response.status === 401) {
                const refreshSuccess = await refreshAccessToken();
                if (refreshSuccess) {
                    token = localStorage.getItem("token");
                    response = await fetch(`${API_BASE_URL}/transactions/categories`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                } else {
                    return; // Let the main fetchTransactions handle the logout alert
                }
            }

            if (response.ok) {
                const categories = await response.json();
                const select = document.getElementById("category-select");

                // 1. ALWAYS start with the default placeholder
                let optionsHTML = '<option value="">Select a category...</option>';

                // 2. Loop through the database categories and add them
                categories.forEach(c => {
                    categoryMap[c.id] = c.name;
                    optionsHTML += `<option value="${c.id}">${c.name}</option>`;
                });

                // 3. Add the "Create New" option at the absolute bottom
                optionsHTML += `<option value="create_new" style="font-weight: bold; color: #007bff;">+ Add New Category</option>`;

                // 4. Inject the completely built list into the dropdown
                select.innerHTML = optionsHTML;
            }
        } catch (error) {
            console.error("Critical error fetching categories:", error);
        }
    }
    
    // --- INLINE CATEGORY LOGIC ---
    // --- CATEGORY UI LOGIC ---
    // --- CATEGORY UI LOGIC (WITH DIAGNOSTICS) ---
    function handleCategoryChange(selectElement) {
        console.log("1. Dropdown changed! Selected value:", selectElement.value);

        const createForm = document.getElementById("inline-category-form");
        const editLink = document.getElementById("edit-cat-link-container");
        const editBox = document.getElementById("edit-category-box");

        // Safety Check: Did we accidentally delete or rename one of the HTML boxes?
        if (!createForm || !editLink || !editBox) {
            console.error("UI CRASH: I cannot find one of the HTML boxes!");
            console.log("Does createForm exist?", !!createForm);
            console.log("Does editLink exist?", !!editLink);
            console.log("Does editBox exist?", !!editBox);
            alert("UI Error: Check the console. An HTML ID is missing.");
            return; 
        }

        console.log("2. All HTML elements found. Toggling visibility...");

        // Reset everything to hidden first
        createForm.style.display = "none";
        editBox.style.display = "none";
        editLink.style.display = "none";

        // Decide what to show
        if (selectElement.value === "create_new") {
            console.log("3. Opening Create Form!");
            createForm.style.display = "block";
        } else if (selectElement.value !== "") {
            console.log("3. Showing Edit Link!");
            editLink.style.display = "block";
        }
    }
    // --- EDIT / DELETE TOGGLES ---
    function openEditCategory() {
        document.getElementById("edit-cat-link-container").style.display = "none";
        document.getElementById("edit-category-box").style.display = "block";
        document.getElementById("edit-cat-inputs").style.display = "block";
        document.getElementById("delete-warning-box").style.display = "none";
        
        // Grab the current name from the dropdown to pre-fill the input
        const select = document.getElementById("category-select");
        const currentName = select.options[select.selectedIndex].text;
        document.getElementById("edit-cat-name").value = currentName;
    }

    function showDeleteWarning() {
        document.getElementById("edit-cat-inputs").style.display = "none";
        document.getElementById("delete-warning-box").style.display = "block";
    }

    function cancelCategoryEdit() {
        document.getElementById("edit-category-box").style.display = "none";
        document.getElementById("edit-cat-link-container").style.display = "block";
    }

    // --- 1. SAVE THE EDITED CATEGORY ---
    async function saveCategoryEdit() {
        const select = document.getElementById("category-select");
        const categoryId = select.value; // The ID is secretly stored in the dropdown value!
        
        const newName = document.getElementById("edit-cat-name").value;
        const newKeywords = document.getElementById("edit-cat-keywords").value;

        if (!newName) {
            alert("Category name cannot be empty.");
            return;
        }

        let token = localStorage.getItem("token");
        const payload = { name: newName, keywords: newKeywords || "", monthly_limit: null };

        let response = await fetch(`${API_BASE_URL}/transactions/categories/${categoryId}`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });

        // The Silent Token Refresh Trap
        if (response.status === 401) {
            const refreshSuccess = await refreshAccessToken();
            if (refreshSuccess) {
                token = localStorage.getItem("token");
                response = await fetch(`${API_BASE_URL}/transactions/categories/${categoryId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            } else {
                localStorage.removeItem("token"); localStorage.removeItem("refresh_token");
                alert("Session expired. Please log in again."); window.location.reload(); return;
            }
        }

        if (response.ok) {
            cancelCategoryEdit(); // Hide the edit box
            await fetchCategories(); // Refresh the dropdown list from the database
            document.getElementById("category-select").value = categoryId; // Re-select the newly named category
            
            // If they are on the home screen, refresh the recent list so the new name appears immediately!
            fetchTransactions(); 
        } else {
            alert("Failed to update category.");
        }
    }

    // --- 2. EXECUTE THE DELETE (WITH CRASH LOGGING) ---
    async function confirmDeleteCategory() {
        console.log("1. Delete button clicked!"); 
        
        try {
            const select = document.getElementById("category-select");
            const categoryId = select.value;
            console.log("2. Attempting to delete Category ID:", categoryId);

            let token = localStorage.getItem("token");

            let response = await fetch(`${API_BASE_URL}/transactions/categories/${categoryId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            // The Silent Token Refresh Trap
            if (response.status === 401) {
                console.log("3. Token expired. Attempting refresh...");
                const refreshSuccess = await refreshAccessToken();
                if (refreshSuccess) {
                    token = localStorage.getItem("token");
                    response = await fetch(`${API_BASE_URL}/transactions/categories/${categoryId}`, {
                        method: "DELETE",
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                } else {
                    localStorage.removeItem("token"); localStorage.removeItem("refresh_token");
                    alert("Session expired. Please log in again."); window.location.reload(); return;
                }
            }

            if (response.ok) {
                console.log("4. Backend confirmed deletion! Updating UI...");
                cancelCategoryEdit(); // Hide the UI
                document.getElementById("category-select").value = ""; // Reset dropdown to default
                await fetchCategories(); // Refresh the dropdown
                fetchTransactions(); // Refresh recent list
            } else {
                // If the backend threw a 500 or 404 error
                const errorData = await response.json();
                console.error("Backend Error Data:", errorData);
                alert("Backend refused the delete: " + (errorData.detail || "Check console"));
            }

        } catch (error) {
            // If the browser crashed before the fetch could even finish (CORS, network drop, etc)
            console.error("Critical JS or Network Crash:", error);
            alert("App crashed! Check the developer console: " + error.message);
        }
    }

    function cancelCategory() {
        document.getElementById("inline-category-form").style.display = "none";
        document.getElementById("category-select").value = ""; // Reset dropdown
    }

    // --- CREATE NEW CATEGORY (WITH CRASH LOGGING) ---
    async function addCategory() {
        console.log("1. Add Category Save button clicked!");
        
        try {
            const name = document.getElementById("new-cat-name").value;
            const keywords = document.getElementById("new-cat-keywords").value;

            if (!name) {
                alert("Please provide at least a category name.");
                return;
            }

            let token = localStorage.getItem("token");
            const payload = { name: name, keywords: keywords || "", monthly_limit: null };
            console.log("2. Sending payload to backend:", payload);

            let response = await fetch(`${API_BASE_URL}/transactions/categories`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify(payload)
            });

            // The Silent Token Refresh Trap
            if (response.status === 401) {
                console.log("3. Token expired. Attempting refresh...");
                const refreshSuccess = await refreshAccessToken();
                if (refreshSuccess) {
                    token = localStorage.getItem("token");
                    response = await fetch(`${API_BASE_URL}/transactions/categories`, {
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}` 
                        },
                        body: JSON.stringify(payload)
                    });
                } else {
                    localStorage.removeItem("token"); localStorage.removeItem("refresh_token");
                    alert("Session expired. Please log in again."); window.location.reload(); return;
                }
            }

            if (response.ok) {
                const data = await response.json();
                console.log("4. Backend confirmed creation! New ID:", data.category_id);
                
                // Hide form and clear inputs
                document.getElementById("inline-category-form").style.display = "none";
                document.getElementById("new-cat-name").value = "";
                document.getElementById("new-cat-keywords").value = "";
                
                // Refresh dropdown and auto-select
                await fetchCategories(); 
                document.getElementById("category-select").value = data.category_id;
            } else {
                // If the backend threw a 500 or 422 error
                const errorData = await response.json();
                console.error("Backend Error Data:", errorData);
                alert("Backend refused the creation: " + (errorData.detail || JSON.stringify(errorData)));
            }

        } catch (error) {
            // If the browser crashed before the fetch could even finish
            console.error("Critical JS or Network Crash:", error);
            alert("App crashed! Check the developer console: " + error.message);
        }
    }

    function logout() {
        localStorage.removeItem("token");
        document.getElementById("login-screen").classList.remove("hidden");
        document.getElementById("app-screen").classList.add("hidden");
    }

    // --- TAB NAVIGATION LOGIC ---
    function switchTab(tabId) {
        // 1. Hide all tab containers
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // 2. Show the specific tab the user clicked
        document.getElementById(tabId).classList.add('active');

        // 3. Remove the blue highlight from all buttons
        const buttons = document.querySelectorAll('.nav-btn');
        buttons.forEach(btn => btn.classList.remove('active'));

        // 4. Add the blue highlight ONLY to the button that was just clicked
        const clickedBtn = Array.from(buttons).find(btn => btn.getAttribute('onclick').includes(tabId));
        if (clickedBtn) {
            clickedBtn.classList.add('active');
        }

        // --- NEW AUTO-LOAD TRIGGER ---
        if (tabId === 'history') {
            document.getElementById("history-list").innerHTML = "<p style='color: gray; text-align: center;'>Loading history...</p>";
            fetchHistory();
        } else if (tabId === 'analytics') {
            fetchDashboardAnalytics();
        }
    }


    async function refreshAccessToken() {
        const refreshToken = localStorage.getItem("refresh_token");
        
        // If we don't even have a vault key, there is nothing to refresh
        if (!refreshToken) {
            return false; 
        }

        try {
            // Run to the backend Security Desk
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (response.ok) {
                // Success! We got a brand new 30-minute badge. Save it over the old dead one.
                const data = await response.json();
                localStorage.setItem("token", data.access_token);
                return true; // Tell the app "We fixed it!"
            } else {
                // The Vault Key was fake or expired. 
                return false; 
            }
        } catch (error) {
            console.error("Failed to refresh token:", error);
            return false;
        }
    }

    // --- TRANSACTION EDIT/DELETE LOGIC ---

    function openTxModal(id, amount, description, date, categoryId) {
        // 1. Copy the categories from our cheat sheet so they can pick a new one
        const editSelect = document.getElementById("edit-tx-category");
        editSelect.innerHTML = `<option value="null">Uncategorized</option>`;
        for (const [catId, catName] of Object.entries(categoryMap)) {
            editSelect.innerHTML += `<option value="${catId}">${catName}</option>`;
        }

        // 2. Pre-fill the modal with the exact typo they made
        document.getElementById("edit-tx-id").value = id;
        document.getElementById("edit-tx-amount").value = amount;
        document.getElementById("edit-tx-desc").value = description;
        document.getElementById("edit-tx-date").value = date;
        document.getElementById("edit-tx-category").value = categoryId || "null";

        // 3. Reset the UI and show the modal
        document.getElementById("tx-edit-buttons").style.display = "flex";
        document.getElementById("tx-delete-warning").style.display = "none";
        document.getElementById("transaction-edit-modal").style.display = "flex";
    }

    function closeTxModal() {
        document.getElementById("transaction-edit-modal").style.display = "none";
    }

    function showTxDeleteWarning() {
        document.getElementById("tx-edit-buttons").style.display = "none";
        document.getElementById("tx-delete-warning").style.display = "block";
    }

    function cancelTxDelete() {
        document.getElementById("tx-delete-warning").style.display = "none";
        document.getElementById("tx-edit-buttons").style.display = "flex";
    }

    async function saveTransactionEdit() {
        const id = document.getElementById("edit-tx-id").value;
        let token = localStorage.getItem("token");

        // Grab the updated values
        let catValue = document.getElementById("edit-tx-category").value;
        
        const payload = {
            amount: parseFloat(document.getElementById("edit-tx-amount").value),
            description: document.getElementById("edit-tx-desc").value,
            transaction_date: document.getElementById("edit-tx-date").value,
            category_id: catValue === "null" ? null : parseInt(catValue),
            type: "Expense" // <--- THE MISSING PIECE! FastAPI demands this.
        };

        try {
            let response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                closeTxModal();
                fetchTransactions(); // Refresh the feed to show the fix instantly!
                fetchHistory();
                fetchDashboardAnalytics();
            } else {
                // Let's actually read what FastAPI is complaining about instead of a generic alert
                const errorData = await response.json();
                console.error("Backend Validation Error:", errorData);
                
                // FastAPI validation errors are usually stored in an array called 'detail'
                let errorMessage = "Failed to update.";
                if (errorData.detail && Array.isArray(errorData.detail)) {
                    errorMessage = `Missing or invalid field: ${errorData.detail[0].loc.join(" -> ")}`;
                } else if (errorData.detail) {
                    errorMessage = errorData.detail;
                }
                
                alert(errorMessage);
            }
        } catch (error) {
            console.error("Crash during edit:", error);
            alert("Network error. Check console.");
        }
    }

    async function confirmTransactionDelete() {
        const id = document.getElementById("edit-tx-id").value;
        let token = localStorage.getItem("token");

        try {
            let response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.ok) {
                closeTxModal();
                fetchTransactions(); // Refresh the feed (the item will be gone)
                fetchHistory();
                fetchDashboardAnalytics();
            } else {
                alert("Failed to delete transaction.");
            }
        } catch (error) {
            console.error("Crash during delete:", error);
        }
    }