// app.js

let rows, cols;
let grid = [];
let agentPos = { r: 1, c: 1 };
let kb = new KnowledgeBase();
let totalInferenceSteps = 0;
let visited = new Set();
let safeCells = new Set();
let knownPits = new Set();
let knownWumpus = new Set();
let isAutoRunning = false;
let autoInterval;

// DOM Elements
const gridContainer = document.getElementById('grid-container');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('cols');
const btnStart = document.getElementById('btn-start');
const btnStep = document.getElementById('btn-step');
const btnAuto = document.getElementById('btn-auto');
const locDisplay = document.getElementById('agent-location');
const perceptsDisplay = document.getElementById('agent-percepts');
const stepsDisplay = document.getElementById('inference-steps');
const statusDisplay = document.getElementById('agent-status');
const godModeInput = document.getElementById('god-mode');

// Initialize Environment
btnStart.addEventListener('click', generateEnvironment);
btnStep.addEventListener('click', () => { if (!isAutoRunning) stepAgent(); });
btnAuto.addEventListener('click', toggleAutoRun);
godModeInput.addEventListener('change', renderGrid);

function posStr(r, c) { return `${r}_${c}`; }

function generateEnvironment() {
    rows = parseInt(rowsInput.value);
    cols = parseInt(colsInput.value);
    if(rows < 2 || cols < 2) {
        alert("Min grid size 2x2");
        return;
    }
    
    // reset state
    totalInferenceSteps = 0;
    visited.clear();
    safeCells.clear();
    knownPits.clear();
    knownWumpus.clear();
    kb = new KnowledgeBase();
    agentPos = { r: 1, c: 1 }; // start at 1,1
    visited.add(posStr(1, 1));
    safeCells.add(posStr(1, 1));
    stepsDisplay.innerText = "0";
    statusDisplay.innerText = "Environment generated.";
    
    // Stop auto if running
    if(isAutoRunning) toggleAutoRun();
    
    // Init Grid structure
    grid = [];
    for(let r=1; r<=rows; r++) {
        let row = [];
        for(let c=1; c<=cols; c++) {
            row.push({
                r, c,
                hasWumpus: false,
                hasPit: false
            });
        }
        grid.push(row);
    }
    
    // Place Wumpus (not 1,1)
    let wumpusPlaced = false;
    while(!wumpusPlaced) {
        let wr = Math.floor(Math.random() * rows) + 1;
        let wc = Math.floor(Math.random() * cols) + 1;
        if(wr !== 1 || wc !== 1) {
            getGridCell(wr, wc).hasWumpus = true;
            wumpusPlaced = true;
        }
    }
    
    // Place Pits (not 1,1) ~20% chance
    for(let r=1; r<=rows; r++) {
        for(let c=1; c<=cols; c++) {
            if(r === 1 && c === 1) continue;
            if(!getGridCell(r, c).hasWumpus && Math.random() < 0.20) {
                getGridCell(r, c).hasPit = true;
            }
        }
    }
    
    // Init KB Physics (Breeze and Stench rules)
    for(let r=1; r<=rows; r++) {
        for(let c=1; c<=cols; c++) {
            let adj = getAdjacent(r, c);
            
            // Breeze physics: B_r_c <=> P_a1 v P_a2 ...
            // 1. !B_r_c v P_a1 v P_a2 ...
            let bClause = [`!B_${r}_${c}`];
            for(let a of adj) {
                bClause.push(`P_${a.r}_${a.c}`);
                // 2. !P_a v B_r_c
                kb.addClause([`!P_${a.r}_${a.c}`, `B_${r}_${c}`]);
            }
            kb.addClause(bClause);
            
            // Stench physics: S_r_c <=> W_a1 v W_a2 ...
            let sClause = [`!S_${r}_${c}`];
            for(let a of adj) {
                sClause.push(`W_${a.r}_${a.c}`);
                kb.addClause([`!W_${a.r}_${a.c}`, `S_${r}_${c}`]);
            }
            kb.addClause(sClause);
        }
    }
    
    // Known fact: 1,1 is safe
    kb.addClause([`!P_1_1`]);
    kb.addClause([`!W_1_1`]);
    
    renderGrid();
    updateDashboard();
    
    btnStep.disabled = false;
    btnAuto.disabled = false;
}

function getGridCell(r, c) {
    if(r >= 1 && r <= rows && c >= 1 && c <= cols) {
        return grid[r-1][c-1];
    }
    return null;
}

function getAdjacent(r, c) {
    let adj = [];
    if(r > 1) adj.push({r: r-1, c});
    if(r < rows) adj.push({r: r+1, c});
    if(c > 1) adj.push({r, c: c-1});
    if(c < cols) adj.push({r, c: c+1});
    return adj;
}

function renderGrid() {
    if(!rows || !cols) return;
    gridContainer.innerHTML = '';
    const gridDiv = document.createElement('div');
    gridDiv.className = 'grid';
    // Use css grid layout
    gridDiv.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridDiv.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    
    let showSecrets = godModeInput.checked;

    for(let r=rows; r>=1; r--) {
        for(let c=1; c<=cols; c++) {
            let cellDiv = document.createElement('div');
            cellDiv.className = 'cell';
            let id = posStr(r,c);
            
            let label = document.createElement('div');
            label.className = 'cell-label';
            label.innerText = `(${c},${r})`;
            cellDiv.appendChild(label);
            
            let content = document.createElement('div');
            content.className = 'cell-content';
            
            let pStr = "";
            let cell = getGridCell(r,c);
            
            if(showSecrets || knownWumpus.has(id)) {
                if(cell.hasWumpus) pStr += "👹";
            }
            if(showSecrets || knownPits.has(id)) {
                if(cell.hasPit) pStr += "🕳️";
            }
            
            content.innerText = pStr;
            cellDiv.appendChild(content);
            
            if(visited.has(id)) {
                cellDiv.classList.add('visited');
            } else if(safeCells.has(id)) {
                cellDiv.classList.add('safe');
            } else if(knownPits.has(id) || knownWumpus.has(id)) {
                cellDiv.classList.add('danger');
            }
            
            if(r === agentPos.r && c === agentPos.c) {
                let agent = document.createElement('div');
                agent.className = 'agent';
                cellDiv.appendChild(agent);
            }
            
            gridDiv.appendChild(cellDiv);
        }
    }
    gridContainer.appendChild(gridDiv);
}

function updateDashboard() {
    locDisplay.innerText = `(${agentPos.c}, ${agentPos.r})`;
    stepsDisplay.innerText = totalInferenceSteps;
    
    let percepts = [];
    
    // Check percepts at current location
    let adj = getAdjacent(agentPos.r, agentPos.c);
    for(let a of adj) {
        let ac = getGridCell(a.r, a.c);
        if(ac.hasPit) percepts.push("Breeze");
        if(ac.hasWumpus) percepts.push("Stench");
    }
    
    // Dedup
    percepts = [...new Set(percepts)];
    
    if(percepts.length === 0) perceptsDisplay.innerText = "None";
    else perceptsDisplay.innerText = percepts.join(", ");
}

function getPercepts(r, c) {
    let hasBreeze = false;
    let hasStench = false;
    let adj = getAdjacent(r, c);
    for(let a of adj) {
        let ac = getGridCell(a.r, a.c);
        if(ac.hasPit) hasBreeze = true;
        if(ac.hasWumpus) hasStench = true;
    }
    return { hasBreeze, hasStench };
}

async function stepAgent() {
    statusDisplay.innerText = "Reasoning...";
    
    // 1. Perceive and update KB
    let { hasBreeze, hasStench } = getPercepts(agentPos.r, agentPos.c);
    if(hasBreeze) kb.addClause([`B_${agentPos.r}_${agentPos.c}`]);
    else kb.addClause([`!B_${agentPos.r}_${agentPos.c}`]);
    
    if(hasStench) kb.addClause([`S_${agentPos.r}_${agentPos.c}`]);
    else kb.addClause([`!S_${agentPos.r}_${agentPos.c}`]);
    
    // Allow UI to update before heavy inference blocks the thread
    await new Promise(res => setTimeout(res, 50));
    
    // 2. Infer safety for all adjacent unknowns (Frontier)
    let frontier = new Set();
    for(let v of visited) {
        let [vr, vc] = v.split('_').map(Number);
        for(let a of getAdjacent(vr, vc)) {
            let aStr = posStr(a.r, a.c);
            if(!visited.has(aStr) && !safeCells.has(aStr) && !knownPits.has(aStr) && !knownWumpus.has(aStr)) {
                frontier.add(aStr);
            }
        }
    }
    
    for(let f of frontier) {
        let [fr, fc] = f.split('_').map(Number);
        
        // Prove safe: Prove !P and !W
        let pRes = kb.prove([`P_${fr}_${fc}`]); // negation of !P is P
        totalInferenceSteps += pRes.steps;
        
        let wRes = kb.prove([`W_${fr}_${fc}`]); // negation of !W is W
        totalInferenceSteps += wRes.steps;
        
        if(pRes.proven && wRes.proven) {
            safeCells.add(f);
            kb.addClause([`!P_${fr}_${fc}`]);
            kb.addClause([`!W_${fr}_${fc}`]);
            continue; // if safe, it's not a pit or wumpus
        }
        
        // Prove Pit
        if(!pRes.proven) {
            let ppRes = kb.prove([`!P_${fr}_${fc}`]); // negation of P is !P
            totalInferenceSteps += ppRes.steps;
            if(ppRes.proven) {
                knownPits.add(f);
                kb.addClause([`P_${fr}_${fc}`]);
            }
        }
        
        // Prove Wumpus
        if(!wRes.proven) {
            let pwRes = kb.prove([`!W_${fr}_${fc}`]); // negation of W is !W
            totalInferenceSteps += pwRes.steps;
            if(pwRes.proven) {
                knownWumpus.add(f);
                kb.addClause([`W_${fr}_${fc}`]);
            }
        }
    }
    
    // 3. Move to an adjacent unvisited safe cell
    let moved = false;
    let adj = getAdjacent(agentPos.r, agentPos.c);
    
    // Try adjacent unvisited safe
    for(let a of adj) {
        let str = posStr(a.r, a.c);
        if(safeCells.has(str) && !visited.has(str)) {
            agentPos = { r: a.r, c: a.c };
            visited.add(str);
            moved = true;
            break;
        }
    }
    
    // If no adjacent safe unvisited cell, use BFS to find the closest reachable one
    if(!moved) {
        let path = findPathToUnvisitedSafe();
        if(path && path.length > 0) {
            agentPos = path[0]; // just take one step along path towards it
            visited.add(posStr(agentPos.r, agentPos.c));
            moved = true;
        }
    }
    
    if(!moved) {
        statusDisplay.innerText = "No safe unvisited cells reachable. Exploration finished!";
        if(isAutoRunning) toggleAutoRun();
        btnStep.disabled = true;
    } else {
        statusDisplay.innerText = "Agent moved successfully.";
    }
    
    renderGrid();
    updateDashboard();
}

// Simple BFS to find path to nearest unvisited safe cell through visited cells
function findPathToUnvisitedSafe() {
    let q = [[ {r: agentPos.r, c: agentPos.c} ]];
    let localVis = new Set();
    localVis.add(posStr(agentPos.r, agentPos.c));
    
    while(q.length > 0) {
        let path = q.shift();
        let curr = path[path.length-1];
        
        let adj = getAdjacent(curr.r, curr.c);
        for(let a of adj) {
            let aStr = posStr(a.r, a.c);
            if(!localVis.has(aStr)) {
                localVis.add(aStr);
                
                if(safeCells.has(aStr) && !visited.has(aStr)) {
                    // found! return first step from agent
                    return path.slice(1).concat([a]);
                }
                
                // only traverse through visited cells to ensure safety
                if(visited.has(aStr)) {
                    q.push([...path, a]);
                }
            }
        }
    }
    return null;
}

function toggleAutoRun() {
    isAutoRunning = !isAutoRunning;
    if(isAutoRunning) {
        btnAuto.innerText = "Stop Auto Run";
        btnAuto.classList.remove('btn-secondary');
        btnAuto.classList.add('btn-primary');
        btnStep.disabled = true;
        autoInterval = setInterval(stepAgent, 1000);
    } else {
        btnAuto.innerText = "Auto Run";
        btnAuto.classList.add('btn-secondary');
        btnAuto.classList.remove('btn-primary');
        btnStep.disabled = false;
        clearInterval(autoInterval);
    }
}
