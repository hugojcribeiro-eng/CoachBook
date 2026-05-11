document.addEventListener("DOMContentLoaded", () => {
    // Register Service Worker for Offline Support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrado!', reg))
            .catch(err => console.log('Erro ao registrar Service Worker', err));
    }
    // ---- State ----
    let matches = JSON.parse(localStorage.getItem("coachbook_matches")) || [];
    let savedGkNames = JSON.parse(localStorage.getItem("coachbook_gk_names")) || [];
    let currentMatchId = null;
    let editingPlayerId = null;
    let editingMatchId = null;
    let tabCategoryChart = null;

    // ---- Elements ----
    const viewList = document.getElementById("match-list-view");
    const viewDetail = document.getElementById("match-detail-view");
    const matchesGrid = document.getElementById("matches-grid");
    
    // Modal
    const modalMatch = document.getElementById("modal-match");
    const btnNewMatch = document.getElementById("btn-new-match");
    const btnCloseModal = document.getElementById("btn-close-modal");
    const btnSaveMatch = document.getElementById("btn-save-match");
    
    // Detail View Header
    const btnBack = document.getElementById("btn-back");
    const titleMatch = document.getElementById("detail-match-title");
    const dateMatch = document.getElementById("detail-match-date");
    const btnEditMatch = document.getElementById("btn-edit-match");
    const btnDeleteMatch = document.getElementById("btn-delete-match");

    // Modal Player
    const modalPlayer = document.getElementById("modal-player");
    const btnAddPlayer = document.getElementById("btn-add-player");
    const btnCloseModalPlayer = document.getElementById("btn-close-modal-player");
    const btnSavePlayer = document.getElementById("btn-save-player");
    const gkList = document.getElementById("gk-list");

    // Report
    const modalReport = document.getElementById("modal-report");
    const btnShowReport = document.getElementById("btn-show-report");
    const btnCloseModalReport = document.getElementById("btn-close-modal-report");
    const btnPrintReport = document.getElementById("btn-print-report");
    const reportContainer = document.getElementById("report-container");

    // Tabs
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");



    // Events
    const gkSelector = document.getElementById("gk-selector");
    const eventsList = document.getElementById("events-list");

    const gkActiveStatus = document.getElementById("gk-active-status");

    // Stopwatch
    const swDisplay = document.getElementById("stopwatch-display");
    const btnSwStart = document.getElementById("btn-sw-start");
    const btnSwPause = document.getElementById("btn-sw-pause");
    const btnSwReset = document.getElementById("btn-sw-reset");
    let stopwatchInterval = null;
    let stopwatchSeconds = 0;

    // Subcategories toggle
    const cardDefesaBaliza = document.getElementById("card-defesa-baliza");
    const subcatDefesaBaliza = document.getElementById("subcat-defesa-baliza");
    const subcatDefesaEspaco = document.getElementById("subcat-defesa-espaco");
    const subcatEquipaPosse = document.getElementById("subcat-equipa-posse");

    // (Drag and Drop removido)

    // Init
    renderGkNamesList();
    renderMatches();

    // ---- Event Listeners ----

    // Stopwatch
    function updateStopwatchDisplay() {
        const m = Math.floor(stopwatchSeconds / 60).toString().padStart(2, "0");
        const s = (stopwatchSeconds % 60).toString().padStart(2, "0");
        swDisplay.textContent = `${m}:${s}`;
    }

    btnSwStart.addEventListener("click", () => {
        if (stopwatchInterval) return;
        stopwatchInterval = setInterval(() => {
            stopwatchSeconds++;
            updateStopwatchDisplay();
        }, 1000);
    });

    btnSwPause.addEventListener("click", () => {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
    });

    btnSwReset.addEventListener("click", () => {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        stopwatchSeconds = 0;
        updateStopwatchDisplay();
    });

    gkSelector.addEventListener("change", (e) => {
        const gkName = e.target.value;
        gkActiveStatus.value = "";
        if(currentMatchId && gkName) {
            const match = getMatch(currentMatchId);
            const allGks = [...match.xi.starting, ...match.xi.subs];
            const found = allGks.find(p => p.name === gkName);
            if(found) {
                // If the player status is not Titular or Suplente Utilizado, we might need to handle it.
                // For now, it will set to the closest option or blank if not found in the dropdown.
                gkActiveStatus.value = found.status;
            }
        }
    });

    gkActiveStatus.addEventListener("change", (e) => {
        const gkName = gkSelector.value;
        if(currentMatchId && gkName) {
            const match = getMatch(currentMatchId);
            const allGks = [...match.xi.starting, ...match.xi.subs];
            const found = allGks.find(p => p.name === gkName);
            if(found) {
                found.status = e.target.value;
                saveData();
                renderPlayers(); // update the "Dados do Jogo" list
            }
        }
    });

    // Toggle Subcategories
    const cardDefesaEspaco = document.getElementById("card-defesa-espaco");
    const cardEquipaPosse = document.getElementById("card-equipa-posse");

    if(cardDefesaBaliza) {
        cardDefesaBaliza.addEventListener("click", () => {
            const isHidden = subcatDefesaBaliza.classList.contains("hidden");
            hideAllEventBoxes();
            if(isHidden) {
                subcatDefesaBaliza.classList.remove("hidden");
                cardDefesaBaliza.classList.add("active-card");
            }
        });
    }

    if(cardDefesaEspaco) {
        cardDefesaEspaco.addEventListener("click", () => {
            const isHidden = subcatDefesaEspaco.classList.contains("hidden");
            hideAllEventBoxes();
            if(isHidden) {
                subcatDefesaEspaco.classList.remove("hidden");
                cardDefesaEspaco.classList.add("active-card");
            }
        });
    }

    if(cardEquipaPosse) {
        cardEquipaPosse.addEventListener("click", () => {
            const isHidden = subcatEquipaPosse.classList.contains("hidden");
            hideAllEventBoxes();
            if(isHidden) {
                subcatEquipaPosse.classList.remove("hidden");
                cardEquipaPosse.classList.add("active-card");
            }
        });
    }

    function hideAllEventBoxes() {
        subcatDefesaBaliza.classList.add("hidden");
        subcatDefesaEspaco.classList.add("hidden");
        subcatEquipaPosse.classList.add("hidden");
        cardDefesaBaliza.classList.remove("active-card");
        cardDefesaEspaco.classList.remove("active-card");
        cardEquipaPosse.classList.remove("active-card");
    }

    // Integrated Event Logging for Defesa da Baliza (with Outcomes)
    document.querySelectorAll(".event-btn, .sub-sub-btn, .outcome-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const gkName = gkSelector.value;
            if(!gkName) { alert("Selecione um Guarda-Redes primeiro!"); return; }
            
            let eventLabel = btn.getAttribute("data-event");
            const outcome = btn.getAttribute("data-outcome");
            
            if(outcome) {
                eventLabel = `${eventLabel} - ${outcome}`;
            }

            const matchPart = document.getElementById("gk-match-part").value;
            const currentMin = Math.floor(stopwatchSeconds / 60) || 1;

            const match = getMatch(currentMatchId);
            match.events.push({
                id: Date.now().toString(),
                gkName: gkName,
                minute: currentMin,
                label: eventLabel,
                matchPart: matchPart
            });

            match.events.sort((a,b) => parseInt(a.minute) - parseInt(b.minute));
            saveData();
            renderEvents();
            
            btn.style.transform = "scale(0.95)";
            setTimeout(() => btn.style.transform = "", 100);
        });
    });

    // Modal
    btnNewMatch.addEventListener("click", () => {
        editingMatchId = null;
        document.getElementById("input-home-team").value = "";
        document.getElementById("input-away-team").value = "";
        document.getElementById("input-date").value = "";
        document.getElementById("input-time").value = "";
        document.getElementById("input-competition").value = "";
        document.getElementById("input-matchday").value = "";
        document.getElementById("input-field-type").value = "Relvado Sintético";
        modalMatch.classList.remove("hidden");
    });
    btnCloseModal.addEventListener("click", () => modalMatch.classList.add("hidden"));

    btnSaveMatch.addEventListener("click", () => {
        const homeTeam = document.getElementById("input-home-team").value;
        const awayTeam = document.getElementById("input-away-team").value;
        const date = document.getElementById("input-date").value;
        const time = document.getElementById("input-time").value;
        const comp = document.getElementById("input-competition").value;
        const matchday = document.getElementById("input-matchday").value;
        const fieldType = document.getElementById("input-field-type").value;

        if(!homeTeam || !awayTeam || !date) {
            alert("Preenche Equipa Visitada, Equipa Visitante e Data");
            return;
        }

        if(editingMatchId) {
            const matchIndex = matches.findIndex(m => m.id === editingMatchId);
            if(matchIndex !== -1) {
                matches[matchIndex] = {
                    ...matches[matchIndex],
                    homeTeam: homeTeam,
                    awayTeam: awayTeam,
                    date: date,
                    time: time || "15:00",
                    competition: comp || "Amigável",
                    matchday: matchday,
                    fieldType: fieldType
                };
            }
            if(currentMatchId === editingMatchId) {
                openMatch(editingMatchId);
            }
        } else {
            const newMatch = {
                id: Date.now().toString(),
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                date: date,
                time: time || "15:00",
                competition: comp || "Amigável",
                matchday: matchday,
                fieldType: fieldType,
                xi: { starting: [], subs: [] },
                strategy: { offense: "", defense: "" },
                events: []
            };
            matches.push(newMatch);
        }

        saveData();
        modalMatch.classList.add("hidden");
        
        renderMatches();
    });

    btnBack.addEventListener("click", () => {
        currentMatchId = null;
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        stopwatchSeconds = 0;
        updateStopwatchDisplay();

        viewDetail.classList.remove("active");
        viewDetail.classList.add("hidden");
        viewList.classList.remove("hidden");
        viewList.classList.add("active");
        renderMatches();
    });

    btnEditMatch.addEventListener("click", () => {
        if(!currentMatchId) return;
        const match = getMatch(currentMatchId);
        if(!match) return;
        editingMatchId = match.id;
        document.getElementById("input-home-team").value = match.homeTeam || "";
        document.getElementById("input-away-team").value = match.awayTeam || "";
        document.getElementById("input-date").value = match.date || "";
        document.getElementById("input-time").value = match.time || "";
        document.getElementById("input-competition").value = match.competition || "";
        document.getElementById("input-matchday").value = match.matchday || "";
        document.getElementById("input-field-type").value = match.fieldType || "Relvado Sintético";
        modalMatch.classList.remove("hidden");
    });

    btnDeleteMatch.addEventListener("click", () => {
        if(!currentMatchId) return;
        if(confirm("Tem a certeza que deseja apagar este jogo? Esta ação não pode ser desfeita.")) {
            matches = matches.filter(m => m.id !== currentMatchId);
            saveData();
            currentMatchId = null;
            viewDetail.classList.remove("active");
            viewDetail.classList.add("hidden");
            viewList.classList.remove("hidden");
            viewList.classList.add("active");
            renderMatches();
        }
    });

    // Player Modal
    btnAddPlayer.addEventListener("click", () => {
        editingPlayerId = null;
        document.getElementById("input-player-number").value = "";
        document.getElementById("input-player-name").value = "";
        document.getElementById("input-player-status").value = "Titular";
        document.getElementById("input-player-minutes").value = "";
        document.getElementById("input-player-goals").value = "";
        document.getElementById("input-player-rating").value = "1";
        modalPlayer.classList.remove("hidden");
    });
    btnCloseModalPlayer.addEventListener("click", () => modalPlayer.classList.add("hidden"));

    btnSavePlayer.addEventListener("click", () => {
        if(!currentMatchId) return;
        const number = document.getElementById("input-player-number").value;
        const name = document.getElementById("input-player-name").value;
        const status = document.getElementById("input-player-status").value;
        const minutes = document.getElementById("input-player-minutes").value || "0";
        const goals = document.getElementById("input-player-goals").value || "0";
        const rating = document.getElementById("input-player-rating").value;

        if(!name) {
            alert("Preencha o nome do guarda-redes");
            return;
        }

        // Save GK name to history if new
        if(!savedGkNames.includes(name)) {
            savedGkNames.push(name);
            localStorage.setItem("coachbook_gk_names", JSON.stringify(savedGkNames));
            renderGkNamesList();
        }

        const match = getMatch(currentMatchId);
        
        if(editingPlayerId) {
            const playerIndex = match.xi.starting.findIndex(p => p.id === editingPlayerId);
            if(playerIndex !== -1) {
                match.xi.starting[playerIndex] = {
                    ...match.xi.starting[playerIndex],
                    number: number,
                    name: name,
                    status: status,
                    minutes: minutes,
                    goals: goals,
                    rating: rating
                };
            }
        } else {
            const playerObj = { 
                id: Date.now().toString(), 
                number: number,
                name: name,
                status: status,
                minutes: minutes,
                goals: goals,
                rating: rating
            };
            match.xi.starting.push(playerObj);
        }

        saveData();
        modalPlayer.classList.add("hidden");
        document.getElementById("input-player-number").value = "";
        document.getElementById("input-player-name").value = "";
        document.getElementById("input-player-status").value = "Titular";
        document.getElementById("input-player-minutes").value = "";
        document.getElementById("input-player-goals").value = "";
        document.getElementById("input-player-rating").value = "1";
        
        renderPlayers();
    });




    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabPanes.forEach(p => {
                p.classList.remove("active");
                p.classList.add("hidden");
            });
            
            const target = e.target.getAttribute("data-target");
            e.target.classList.add("active");
            const pane = document.getElementById(target);
            pane.classList.remove("hidden");
            pane.classList.add("active");

            if(target === "tab-report-view") {
                renderReportTab();
            }
        });
    });

    // Report Events
    btnShowReport.addEventListener("click", () => {
        if(!currentMatchId) return;
        generateReport();
        modalReport.classList.remove("hidden");
    });

    btnCloseModalReport.addEventListener("click", () => {
        modalReport.classList.add("hidden");
    });

    btnPrintReport.addEventListener("click", () => {
        window.print();
    });

    // ---- Functions ----

    function saveData() {
        localStorage.setItem("coachbook_matches", JSON.stringify(matches));
    }

    function getMatch(id) {
        return matches.find(m => m.id === id);
    }

    function renderMatches() {
        matchesGrid.innerHTML = "";
        matches.forEach(m => {
            const home = m.homeTeam || "Equipa da Casa";
            const away = m.awayTeam || m.opponent || "Adversário";
            const time = m.time || "--:--";
            const field = m.fieldType || "Não definido";
            
            const card = document.createElement("div");
            card.className = "match-card glass-panel";
            card.innerHTML = `
                <div class="match-date">
                    ${formatDate(m.date)} &bull; ${time}
                </div>
                <h3>${home} <br><small>vs</small> ${away}</h3>
                <div class="match-comp">${m.competition} ${m.matchday ? `- Jornada ${m.matchday}` : ""}</div>
                <div class="match-field badge">${field}</div>
            `;
            card.addEventListener("click", () => openMatch(m.id));
            matchesGrid.appendChild(card);
        });
    }

    function openMatch(id) {
        currentMatchId = id;
        const match = getMatch(id);

        const home = match.homeTeam || "Equipa da Casa";
        const away = match.awayTeam || match.opponent || "Adversário";
        const time = match.time || "--:--";
        const field = match.fieldType || "Não definido";

        titleMatch.textContent = `${home} vs ${away}`;
        dateMatch.textContent = formatDate(match.date);

        // Load Match Info Grid
        document.getElementById("info-comp").textContent = match.competition || "Amigável";
        document.getElementById("info-matchday").textContent = match.matchday || "-";
        document.getElementById("info-home").textContent = home;
        document.getElementById("info-away").textContent = away;
        document.getElementById("info-date").textContent = formatDate(match.date);
        document.getElementById("info-time").textContent = time;
        document.getElementById("info-field").textContent = field;



        // Load Events & Players
        renderPlayers();
        renderEvents();

        // Reset stopwatch
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        stopwatchSeconds = 0;
        updateStopwatchDisplay();
        gkActiveStatus.value = "--";

        // Switch View
        viewList.classList.remove("active");
        viewList.classList.add("hidden");
        viewDetail.classList.remove("hidden");
        viewDetail.classList.add("active");
    }

    function renderPlayers() {
        const match = getMatch(currentMatchId);
        const gkListElem = document.getElementById("gk-list");
        if(gkListElem) gkListElem.innerHTML = "";

        const allGks = [...match.xi.starting, ...match.xi.subs];

        allGks.forEach(p => {
            if(gkListElem) gkListElem.appendChild(createPlayerElement(p));
        });

        // Update GK Selector Options
        gkSelector.innerHTML = '<option value="">Selecionar Atleta...</option>';
        allGks.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.name;
            opt.textContent = p.name;
            gkSelector.appendChild(opt);
        });
    }

    function renderGkNamesList() {
        const dataList = document.getElementById("gk-names-list");
        if(dataList) {
            dataList.innerHTML = "";
            savedGkNames.forEach(name => {
                const opt = document.createElement("option");
                opt.value = name;
                dataList.appendChild(opt);
            });
        }
    }

    function createPlayerElement(player) {
        const li = document.createElement("li");
        li.dataset.id = player.id;
        li.className = "gk-card";

        const r = parseInt(player.rating || "1");
        let ratingColor = "rating-gray";
        let ratingText = "Não Utilizado";
        if(r >= 1 && r <= 2) { ratingColor = "rating-red"; ratingText = "Muito Fraco"; }
        else if(r >= 3 && r <= 4) { ratingColor = "rating-orange"; ratingText = "Fraco"; }
        else if(r >= 5 && r <= 6) { ratingColor = "rating-yellow"; ratingText = "Mediano"; }
        else if(r >= 7 && r <= 8) { ratingColor = "rating-green"; ratingText = "Bom"; }
        else if(r >= 9 && r <= 10) { ratingColor = "rating-blue"; ratingText = "Jogador Chave"; }

        const colorMap = {
            "rating-gray": "#9ca3af",
            "rating-red": "#b91c1c",
            "rating-orange": "#c2410c",
            "rating-yellow": "#a16207",
            "rating-green": "#15803d",
            "rating-blue": "#1d4ed8"
        };
        li.style.borderLeft = `16px solid ${colorMap[ratingColor]}`;

        const numberDisplay = player.number ? `#${player.number}` : "";
        const statusDisplay = player.status ? ` &bull; ${player.status}` : "";

        li.innerHTML = `
            <div class="gk-info">
                <span class="gk-drag-handle" style="cursor:grab;">&#9776;</span>
                <div class="gk-details">
                    <strong>${numberDisplay} ${player.name} <small style="color:var(--text-muted);font-weight:normal;">${statusDisplay}</small></strong>
                    <div class="gk-stats">
                        <span>Tempo: ${player.minutes || 0} min</span>
                        <span>&bull;</span>
                        <span>Golos: ${player.goals || 0}</span>
                    </div>
                </div>
            </div>
            <div class="gk-actions" style="display:flex;align-items:center;gap:0.75rem;">
                <span class="badge ${ratingColor}">Nota: ${player.rating || "0"} - ${ratingText}</span>
                <button class="btn-edit" style="background:transparent;border:none;color:var(--primary);cursor:pointer;font-size:1.2rem;">&#9998;</button>
                <button class="btn-delete" style="background:transparent;border:none;color:var(--danger);cursor:pointer;font-size:1.2rem;">&times;</button>
            </div>
        `;

        li.querySelector(".btn-edit").addEventListener("click", () => {
            editingPlayerId = player.id;
            document.getElementById("input-player-number").value = player.number || "";
            document.getElementById("input-player-name").value = player.name || "";
            document.getElementById("input-player-status").value = player.status || "Titular";
            document.getElementById("input-player-minutes").value = player.minutes || "";
            document.getElementById("input-player-goals").value = player.goals || "";
            document.getElementById("input-player-rating").value = player.rating || "0";
            modalPlayer.classList.remove("hidden");
        });
        
        li.querySelector(".btn-delete").addEventListener("click", () => {
            const match = getMatch(currentMatchId);
            match.xi.starting = match.xi.starting.filter(p => p.id !== player.id);
            match.xi.subs = match.xi.subs.filter(p => p.id !== player.id);
            saveData();
            renderPlayers();
        });
        return li;
    }

    function renderEvents() {
        const match = getMatch(currentMatchId);
        eventsList.innerHTML = "";
        match.events.forEach(ev => {
            const li = document.createElement("li");
            const partStr = ev.matchPart ? ` <span style="color:var(--text-muted);font-size:0.85rem;">(${ev.matchPart})</span>` : "";
            li.innerHTML = `
                <span class="time">${ev.minute}'</span>
                <span class="desc"><strong>${ev.gkName}</strong>${partStr} - ${ev.label}</span>
                <button class="btn-delete" style="background:transparent;border:none;color:var(--danger);cursor:pointer;">&times;</button>
            `;
            li.querySelector(".btn-delete").addEventListener("click", () => {
                match.events = match.events.filter(e => e.id !== ev.id);
                saveData();
                renderEvents();
            });
            eventsList.appendChild(li);
        });
    }

    function formatDate(dateString) {
        const opt = { day: '2-digit', month: 'short', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('pt-PT', opt);
    }

    function generateReport() {
        const match = getMatch(currentMatchId);
        if(!match) return;

        const home = match.homeTeam || "Equipa da Casa";
        const away = match.awayTeam || "Adversário";
        const allGks = [...match.xi.starting, ...match.xi.subs];

        let html = `
            <div class="report-section">
                <h4>1. Dados do Jogo</h4>
                <div class="report-header-info">
                    <div class="report-header-item">
                        <span class="report-header-label">Equipas</span>
                        <span class="report-header-value">${home} vs ${away}</span>
                    </div>
                    <div class="report-header-item">
                        <span class="report-header-label">Competição</span>
                        <span class="report-header-value">${match.competition || "Amigável"} ${match.matchday ? `(Jornada ${match.matchday})` : ""}</span>
                    </div>
                    <div class="report-header-item">
                        <span class="report-header-label">Data e Hora</span>
                        <span class="report-header-value">${formatDate(match.date)} &bull; ${match.time || "--:--"}</span>
                    </div>
                    <div class="report-header-item">
                        <span class="report-header-label">Campo</span>
                        <span class="report-header-value">${match.fieldType || "Não definido"}</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h4>2. Dados do Guarda-Redes</h4>
                <div class="report-gk-grid">
        `;

        allGks.forEach(p => {
            const r = parseInt(p.rating || "1");
            let ratingText = "Não Utilizado";
            if(r >= 1 && r <= 2) ratingText = "Muito Fraco";
            else if(r >= 3 && r <= 4) ratingText = "Fraco";
            else if(r >= 5 && r <= 6) ratingText = "Mediano";
            else if(r >= 7 && r <= 8) ratingText = "Bom";
            else if(r >= 9 && r <= 10) ratingText = "Jogador Chave";

            html += `
                <div class="report-gk-card">
                    <div class="gk-name">${p.number ? `#${p.number} ` : ""}${p.name}</div>
                    <div class="report-gk-stats-row">
                        <span>Condição:</span>
                        <span>${p.status || "Titular"}</span>
                    </div>
                    <div class="report-gk-stats-row">
                        <span>Tempo Jogo:</span>
                        <span>${p.minutes || 0} min</span>
                    </div>
                    <div class="report-gk-stats-row">
                        <span>Golos Sofridos:</span>
                        <span>${p.goals || 0}</span>
                    </div>
                    <div class="report-gk-stats-row" style="margin-top:0.5rem; font-weight:700; color:var(--primary);">
                        <span>Nota:</span>
                        <span>${p.rating || "0"} - ${ratingText}</span>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>

            <div class="report-section">
                <h4>3. Análise Estatística</h4>
                <div class="report-stats-grid">
                    <div class="chart-box">
                        <canvas id="chart-moments"></canvas>
                    </div>
                    <div class="chart-box">
                        <canvas id="chart-categories"></canvas>
                    </div>
                </div>
                <div id="report-stats-table-container">
                    <!-- Stats table generated here -->
                </div>
            </div>

            <div class="report-section">
                <h4>4. Histórico do Jogo</h4>
                <ul class="report-history-list">
        `;

        if(match.events.length === 0) {
            html += `<li class="report-history-item">Nenhum evento registado.</li>`;
        } else {
            match.events.forEach(ev => {
                const partStr = ev.matchPart ? ` (${ev.matchPart})` : "";
                html += `
                    <li class="report-history-item">
                        <span class="time">${ev.minute}'</span>
                        <span class="desc"><strong>${ev.gkName}</strong>${partStr} - ${ev.label}</span>
                    </li>
                `;
            });
        }

        html += `
                </ul>
            </div>
        `;

        reportContainer.innerHTML = html;

        // Process and render stats
        setTimeout(() => {
            const stats = processMatchStats(match);
            renderReportCharts(stats);
            document.getElementById("report-stats-table-container").innerHTML = generateStatsTableHTML(stats);
        }, 100);
    }

    function processMatchStats(match) {
        const stats = {
            total: match.events.length,
            moments: {},
            hierarchy: {}
        };

        match.events.forEach(ev => {
            // Moment count
            const m = ev.matchPart || "Não especificado";
            stats.moments[m] = (stats.moments[m] || 0) + 1;

            // Hierarchy count: Moment -> Category -> Subcat -> ...
            const parts = [m, ...ev.label.split(" - ")];
            let current = stats.hierarchy;

            parts.forEach((part, index) => {
                if(!current[part]) {
                    current[part] = { count: 0, subs: {} };
                }
                current[part].count++;
                current = current[part].subs;
            });
        });

        return stats;
    }

    function renderReportCharts(stats) {
        const ctxMoments = document.getElementById('chart-moments').getContext('2d');
        const ctxCats = document.getElementById('chart-categories').getContext('2d');

        const momentColors = {
            "1ª Parte": "#3b82f6",
            "2ª Parte": "#8b5cf6",
            "Prolongamento": "#f43f5e",
            "Penaltis": "#ec4899"
        };
        const defaultMomentColor = "#94a3b8";

        const categoryColors = {
            "Defesa Baliza": "#ef4444",
            "Defesa Espaço": "#f97316",
            "Posse Bola": "#10b981"
        };
        const defaultCategoryColor = "#334155";

        new Chart(ctxMoments, {
            type: 'doughnut',
            data: {
                labels: Object.keys(stats.moments),
                datasets: [{
                    data: Object.values(stats.moments),
                    backgroundColor: Object.keys(stats.moments).map(m => momentColors[m] || defaultMomentColor)
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Ações por Momento' },
                    legend: { position: 'bottom' }
                }
            }
        });

        // Top categories for second chart
        const catLabels = Object.keys(stats.hierarchy);
        const catData = catLabels.map(l => stats.hierarchy[l].count);

        new Chart(ctxCats, {
            type: 'bar',
            data: {
                labels: catLabels,
                datasets: [{
                    label: 'Total de Ações',
                    data: catData,
                    backgroundColor: catLabels.map(l => categoryColors[l] || defaultCategoryColor)
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Ações por Categoria' },
                    legend: { display: false }
                }
            }
        });
    }

    function generateStatsTableHTML(stats) {
        let html = `
            <table class="report-stats-table">
                <thead>
                    <tr>
                        <th>Estrutura (Momento > Categoria > Ação)</th>
                        <th style="width: 100px; text-align: center;">Qtd</th>
                        <th style="width: 150px;">Distribuição</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const momentColors = {
            "1ª Parte": "#3b82f6",
            "2ª Parte": "#8b5cf6",
            "Prolongamento": "#f43f5e",
            "Penaltis": "#ec4899"
        };

        const categoryColors = {
            "Defesa Baliza": "#ef4444",
            "Defesa Espaço": "#f97316",
            "Posse Bola": "#10b981"
        };
        const defaultColor = "#334155";

        function walk(node, level = 0, parentColor = "") {
            const sortedKeys = Object.keys(node).sort((a, b) => node[b].count - node[a].count);
            
            sortedKeys.forEach(key => {
                const item = node[key];
                const percent = Math.round((item.count / stats.total) * 100);
                
                let currentColor = parentColor || defaultColor;
                
                if (level === 0) { // Moment level
                    currentColor = momentColors[key] || "#64748b";
                } else if (level === 1) { // Category level
                    currentColor = categoryColors[key] || currentColor;
                }

                html += `
                    <tr class="level-${level}">
                        <td style="color: ${level <= 1 ? currentColor : 'inherit'}; font-weight: ${level <= 1 ? '800' : 'normal'}">${key}</td>
                        <td style="text-align: center;"><span class="count-badge" style="background-color: ${currentColor}">${item.count}</span></td>
                        <td>
                            <div class="stat-bar-container">
                                <div class="stat-bar-fill" style="width: ${percent}%; background-color: ${currentColor}"></div>
                            </div>
                        </td>
                    </tr>
                `;
                walk(item.subs, level + 1, currentColor);
            });
        }

        walk(stats.hierarchy);

        html += `
                </tbody>
            </table>
        `;
        return html;
    }

    // ---- Report Tab Functions ----

    function renderReportTab() {
        const match = getMatch(currentMatchId);
        if (!match) return;

        const events = match.events;
        const total = events.length;

        const categories = {
            "Defesa Baliza": { count: 0, color: "#ef4444", success: 0 },
            "Defesa Espaço": { count: 0, color: "#f97316", success: 0 },
            "Posse Bola": { count: 0, color: "#10b981", success: 0 }
        };

        events.forEach(ev => {
            const parts = ev.label.split(" - ");
            const cat = parts[0];
            const outcome = parts[parts.length - 1];

            if (categories[cat]) {
                categories[cat].count++;
                
                // Simple success logic
                if (cat === "Defesa Baliza" || cat === "Defesa Espaço") {
                    if (outcome === "Receção" || outcome === "Desvio" || outcome === "Sem Intervir") {
                        categories[cat].success++;
                    }
                } else if (cat === "Posse Bola") {
                    if (outcome === "Equipa" || outcome === "Golo Marcado") {
                        categories[cat].success++;
                    }
                }
            }
        });

        // Update Stats Cards
        const container = document.getElementById("tab-report-stats-container");
        let cardsHtml = `
            <div class="stat-card">
                <span class="stat-value">${total}</span>
                <span class="stat-label">Ações Totais</span>
            </div>
        `;

        for (const [name, data] of Object.entries(categories)) {
            const percentage = total > 0 ? Math.round((data.count / total) * 100) : 0;
            cardsHtml += `
                <div class="stat-card" style="border-bottom: 4px solid ${data.color}">
                    <span class="stat-value">${data.count}</span>
                    <span class="stat-label">${name} (${percentage}%)</span>
                </div>
            `;
        }
        container.innerHTML = cardsHtml;

        // Render Efficacy
        renderEfficacyBars(categories);

        // Render Distribution Table (The "Quadro" requested)
        const distributionTableContainer = document.getElementById("tab-report-distribution-table");
        distributionTableContainer.innerHTML = generateDistributionQuadroHTML(events);

        // Render Detailed Table (The one below, keep for full breakdown if still wanted, or merge)
        const detailedTableContainer = document.getElementById("tab-report-detailed-table");
        detailedTableContainer.innerHTML = generateDetailedTableHTML(events);
    }

    function renderEfficacyBars(categories) {
        const efficacyContainer = document.getElementById("tab-report-efficacy-bars");
        let efficacyHtml = "";
        for (const [name, data] of Object.entries(categories)) {
            const perc = data.count > 0 ? Math.round((data.success / data.count) * 100) : 0;
            efficacyHtml += `
                <div class="efficacy-item">
                    <div class="efficacy-info">
                        <span>${name}</span>
                        <span>${perc}% de Eficácia</span>
                    </div>
                    <div class="efficacy-bar-bg">
                        <div class="efficacy-bar-fill" style="width: ${perc}%; background: ${data.color}"></div>
                    </div>
                </div>
            `;
        }
        efficacyContainer.innerHTML = efficacyHtml;
    }

    function generateDistributionQuadroHTML(events) {
        if (events.length === 0) return "<p>Sem eventos.</p>";

        const hierarchy = {};
        const total = events.length;

        events.forEach(ev => {
            const parts = ev.label.split(" - ");
            let current = hierarchy;
            parts.forEach(part => {
                if (!current[part]) {
                    current[part] = { count: 0, subs: {} };
                }
                current[part].count++;
                current = current[part].subs;
            });
        });

        const categoryColors = {
            "Defesa Baliza": "#ef4444",
            "Defesa Espaço": "#f97316",
            "Posse Bola": "#10b981"
        };

        let html = `
            <div class="distribution-quadro">
                <table class="quadro-table">
                    <thead>
                        <tr>
                            <th>Categoria / Ação</th>
                            <th>Total</th>
                            <th>%</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        function walk(node, level = 0, parentColor = "") {
            const sortedKeys = Object.keys(node).sort((a, b) => node[b].count - node[a].count);
            sortedKeys.forEach(key => {
                const item = node[key];
                const percent = Math.round((item.count / total) * 100);
                let currentColor = level === 0 ? (categoryColors[key] || "#334155") : parentColor;

                html += `
                    <tr class="quadro-row level-${level}" style="border-left: 4px solid ${level === 0 ? currentColor : 'transparent'}">
                        <td class="quadro-name" style="padding-left: ${level * 1.2 + 0.5}rem; ${level === 0 ? 'font-weight: 800; color:' + currentColor : ''}">
                            ${level > 0 ? '↳ ' : ''}${key}
                        </td>
                        <td class="quadro-count">${item.count}</td>
                        <td class="quadro-percent">${percent}%</td>
                    </tr>
                `;
                walk(item.subs, level + 1, currentColor);
            });
        }

        walk(hierarchy);
        html += `</tbody></table></div>`;
        return html;
    }

    function generateDetailedTableHTML(events) {
        if (events.length === 0) return "<p style='padding:1rem; color:var(--text-muted);'>Nenhum evento registado para este jogo.</p>";

        const hierarchy = {};
        const total = events.length;

        events.forEach(ev => {
            const parts = ev.label.split(" - ");
            let current = hierarchy;
            parts.forEach(part => {
                if (!current[part]) {
                    current[part] = { count: 0, subs: {} };
                }
                current[part].count++;
                current = current[part].subs;
            });
        });

        const categoryColors = {
            "Defesa Baliza": "#ef4444",
            "Defesa Espaço": "#f97316",
            "Posse Bola": "#10b981"
        };
        const defaultColor = "#334155";

        let html = `
            <table class="detailed-report-table">
                <thead>
                    <tr>
                        <th>Estrutura (Categoria > Sub-Categoria > Ação)</th>
                        <th style="width: 80px; text-align: center;">Qtd</th>
                        <th style="width: 120px;">Frequência</th>
                    </tr>
                </thead>
                <tbody>
        `;

        function walk(node, level = 0, parentColor = "") {
            const sortedKeys = Object.keys(node).sort((a, b) => node[b].count - node[a].count);
            sortedKeys.forEach(key => {
                const item = node[key];
                const percent = Math.round((item.count / total) * 100);
                let currentColor = level === 0 ? (categoryColors[key] || defaultColor) : parentColor;

                html += `
                    <tr class="level-${level}">
                        <td style="padding-left: ${level * 20 + 10}px; color: ${level === 0 ? currentColor : 'inherit'}; font-weight: ${level === 0 ? '800' : 'normal'}">
                            ${level > 0 ? '<span style="color:var(--text-muted); margin-right:5px;">↳</span>' : ''}${key}
                        </td>
                        <td style="text-align: center;">
                            <span class="count-badge-tab" style="background: ${currentColor}">${item.count}</span>
                        </td>
                        <td>
                            <div class="mini-bar-bg">
                                <div class="mini-bar-fill" style="width: ${percent}%; background: ${currentColor}"></div>
                            </div>
                            <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">${percent}%</div>
                        </td>
                    </tr>
                `;
                walk(item.subs, level + 1, currentColor);
            });
        }

        walk(hierarchy);
        html += `</tbody></table>`;

        // Adicionando a seção de "Contadores Rápidos" (Quick Counters) solicitada
        let quickCountersHtml = `
            <div class="quick-counters-section" style="margin-top: 2rem;">
                <h4>Listagem Completa de Contadores</h4>
                <div class="quick-counters-grid">
        `;

        function walkFlat(node, currentPath = "", level = 0) {
            const keys = Object.keys(node).sort((a, b) => node[b].count - node[a].count);
            keys.forEach(key => {
                const path = currentPath ? `${currentPath} - ${key}` : key;
                const count = node[key].count;
                
                quickCountersHtml += `
                    <div class="quick-counter-item level-${level}">
                        <span class="qc-label">Quantidade de <strong>${path}</strong>:</span>
                        <span class="qc-value">${count}</span>
                    </div>
                `;
                
                walkFlat(node[key].subs, path, level + 1);
            });
        }

        walkFlat(hierarchy);
        quickCountersHtml += `</div></div>`;

        return html + quickCountersHtml;
    }

    function renderTabChart(categories) {
        const ctx = document.getElementById('chart-tab-categories').getContext('2d');
        
        if (tabCategoryChart) {
            tabCategoryChart.destroy();
        }

        const labels = Object.keys(categories);
        const data = Object.values(categories).map(c => c.count);
        const colors = Object.values(categories).map(c => c.color);

        tabCategoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 12
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

});
