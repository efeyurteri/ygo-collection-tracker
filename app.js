const CSV_FILE = 'YuGiOh_Collection_Tracker.csv';

let baseCollection = [];
let localAdditions = JSON.parse(localStorage.getItem('ygo_local_additions')) || [];
let ygoDatabase = []; 

const grid = document.getElementById('cardGrid');
const form = document.getElementById('addCardForm');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const clearLocalBtn = document.getElementById('clearLocalBtn');
const addStatus = document.getElementById('addStatus');

// Modal Elements
const modal = document.getElementById("cardModal");
const closeBtn = document.querySelector(".close-btn");

async function init() {
    try {
        const response = await fetch(CSV_FILE);
        if (response.ok) {
            const csvText = await response.text();
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    baseCollection = results.data;
                    renderCards(); 
                    fetchDatabase(); 
                }
            });
        } else {
            renderCards();
            fetchDatabase();
        }
    } catch (err) {
        renderCards();
        fetchDatabase();
    }
}

async function fetchDatabase() {
    try {
        const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
        const data = await response.json();
        ygoDatabase = data.data;
        renderCards(searchInput.value); 
    } catch (err) {
        console.warn("Background database fetch failed.");
    }
}

function getCollection() {
    return [...localAdditions, ...baseCollection];
}

function getCardDataFromName(cardName) {
    if (!cardName) return null;
    const lowerName = cardName.toLowerCase();
    return ygoDatabase.find(c => c.name.toLowerCase() === lowerName);
}

function openModal(cardEntry, apiData) {
    if (apiData) {
        document.getElementById("modalImage").src = `https://images.ygoprodeck.com/images/cards/${apiData.id}.jpg`;
        document.getElementById("modalName").textContent = apiData.name;
        document.getElementById("modalDesc").textContent = apiData.desc;
        document.getElementById("modalRace").textContent = apiData.race || "N/A";
        document.getElementById("modalType").textContent = apiData.type || "N/A";
        
        const attrEl = document.getElementById("modalAttribute");
        const levelEl = document.getElementById("modalLevel");
        
        if (apiData.attribute) {
            attrEl.textContent = apiData.attribute;
            attrEl.style.display = "inline-block";
        } else {
            attrEl.style.display = "none";
        }
        
        if (apiData.level || apiData.level === 0) {
            levelEl.textContent = `Level/Rank: ${apiData.level}`;
            levelEl.style.display = "inline-block";
        } else if (apiData.linkval) {
            levelEl.textContent = `Link-${apiData.linkval}`;
            levelEl.style.display = "inline-block";
        } else {
            levelEl.style.display = "none";
        }

        const statsDiv = document.querySelector(".modal-stats");
        if (apiData.atk !== undefined) {
            statsDiv.style.display = "flex";
            document.getElementById("modalAtk").textContent = apiData.atk;
            const defContainer = document.getElementById("defContainer");
            if (apiData.def !== undefined) {
                defContainer.style.display = "inline";
                document.getElementById("modalDef").textContent = apiData.def;
            } else {
                defContainer.style.display = "none";
            }
        } else {
            statsDiv.style.display = "none";
        }
    } else {
        document.getElementById("modalImage").src = `https://images.ygoprodeck.com/images/cards/back_high.jpg`;
        document.getElementById("modalName").textContent = cardEntry['Card Name'];
        document.getElementById("modalDesc").textContent = "Custom card or detailed database entry loading...";
        document.getElementById("modalRace").textContent = "N/A";
        document.getElementById("modalType").textContent = "Card";
        document.getElementById("modalAttribute").style.display = "none";
        document.getElementById("modalLevel").style.display = "none";
        document.querySelector(".modal-stats").style.display = "none";
    }

    document.getElementById("modalProduct").textContent = cardEntry['Product'] || 'Custom Add';
    document.getElementById("modalCode").textContent = cardEntry['Set Code'] || 'N/A';
    
    modal.style.display = "block";
}

closeBtn.onclick = function() { modal.style.display = "none"; }
window.onclick = function(event) { if (event.target == modal) { modal.style.display = "none"; } }

// NEW FUNCTION: Handle + and - clicks
function changeQuantity(cardEntry, delta, event) {
    event.stopPropagation(); // Stops the modal from opening when you click the buttons
    
    let newQty = parseInt(cardEntry['Quantity']) + delta;

    if (newQty <= 0) {
        if (confirm(`Remove ${cardEntry['Card Name']} entirely from your tracking list?`)) {
            // Find and remove the card from whichever array it lives in
            const localIdx = localAdditions.indexOf(cardEntry);
            if (localIdx > -1) {
                localAdditions.splice(localIdx, 1);
                localStorage.setItem('ygo_local_additions', JSON.stringify(localAdditions));
            } else {
                const baseIdx = baseCollection.indexOf(cardEntry);
                if (baseIdx > -1) baseCollection.splice(baseIdx, 1);
            }
        } else {
            return; // Canceled deletion
        }
    } else {
        cardEntry['Quantity'] = newQty;
        // If it was a manually added local card, update local storage so it persists
        if (localAdditions.includes(cardEntry)) {
            localStorage.setItem('ygo_local_additions', JSON.stringify(localAdditions));
        }
    }
    renderCards(searchInput.value);
}

function renderCards(filterText = '') {
    grid.innerHTML = '';
    const collection = getCollection();
    
    const filtered = collection.filter(card => {
        const name = card['Card Name'] ? String(card['Card Name']).toLowerCase() : '';
        const code = card['Set Code'] ? String(card['Set Code']).toLowerCase() : '';
        const search = filterText.toLowerCase();
        return name.includes(search) || code.includes(search);
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #aaa; padding: 20px;">No cards match your search.</div>';
        return;
    }

    filtered.forEach(card => {
        const name = card['Card Name'];
        const qty = card['Quantity'];
        
        let apiData = getCardDataFromName(name);
        
        const imgUrl = apiData 
            ? `https://images.ygoprodeck.com/images/cards/${apiData.id}.jpg`
            : `https://images.ygoprodeck.com/images/cards/${encodeURIComponent(name)}.jpg`;

        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.innerHTML = `
            <div class="card-qty">x${qty}</div>
            <img src="${imgUrl}" alt="${name}" onerror="this.src='https://images.ygoprodeck.com/images/cards/back_high.jpg'" loading="lazy">
            <div class="card-info">
                <h3 class="card-title" title="${name}">${name}</h3>
                <div class="card-meta">${card['Product'] || 'Collection'} • ${card['Set Code'] || 'No Code'}</div>
            </div>
            <div class="qty-controls">
                <button class="qty-btn minus-btn">-</button>
                <button class="qty-btn plus-btn">+</button>
            </div>
        `;
        
        // Open Modal Listener
        cardEl.addEventListener('click', () => openModal(card, apiData));
        
        // Plus/Minus Listeners
        cardEl.querySelector('.minus-btn').addEventListener('click', (e) => changeQuantity(card, -1, e));
        cardEl.querySelector('.plus-btn').addEventListener('click', (e) => changeQuantity(card, 1, e));

        grid.appendChild(cardEl);
    });
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    addStatus.textContent = '';
    const input = document.getElementById('codeInput').value.trim();
    
    let foundCard = null;
    let foundSet = null;

    for (const card of ygoDatabase) {
        if (card.card_sets) {
            const match = card.card_sets.find(s => s.set_code.toUpperCase() === input.toUpperCase());
            if (match) {
                foundCard = card;
                foundSet = match;
                break;
            }
        }
    }

    if (!foundCard) {
        foundCard = ygoDatabase.find(c => c.name.toLowerCase() === input.toLowerCase());
    }
    
    const newCard = {
        'Product': foundSet ? foundSet.set_name : 'Custom Add',
        'Theme/Deck': foundCard ? (foundCard.archetype || 'None') : 'Custom',
        'Card Name': foundCard ? foundCard.name : input, 
        'Set Code': foundSet ? foundSet.set_code : (input.includes('-') ? input.toUpperCase() : 'N/A'),
        'Quantity': document.getElementById('quantityInput').value
    };
    
    localAdditions.unshift(newCard); 
    localStorage.setItem('ygo_local_additions', JSON.stringify(localAdditions));
    
    form.reset();
    renderCards(searchInput.value);
});

searchInput.addEventListener('input', (e) => {
    renderCards(e.target.value);
});

exportBtn.addEventListener('click', () => {
    const fullCollection = getCollection();
    const csv = Papa.unparse(fullCollection);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'YuGiOh_Collection_Tracker.csv';
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

clearLocalBtn.addEventListener('click', () => {
    if(confirm('Did you upload your exported CSV to GitHub yet?')) {
        localAdditions = [];
        localStorage.removeItem('ygo_local_additions');
        renderCards(searchInput.value);
    }
});

init();
