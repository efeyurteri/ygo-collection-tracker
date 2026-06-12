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

async function fetchDatabase() {
    try {
        const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
        const data = await response.json();
        ygoDatabase = data.data;
        initCSV(); 
    } catch (err) {
        grid.innerHTML = '<div style="color: red;">Failed to load Yu-Gi-Oh! database. Check internet connection.</div>';
    }
}

async function initCSV() {
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
                }
            });
        } else {
            renderCards();
        }
    } catch (err) {
        renderCards();
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

// Open the Modal and populate data
function openModal(cardEntry, apiData) {
    document.getElementById("modalImage").src = `https://images.ygoprodeck.com/images/cards/${apiData.id}.jpg`;
    document.getElementById("modalName").textContent = apiData.name;
    document.getElementById("modalDesc").textContent = apiData.desc;
    
    document.getElementById("modalRace").textContent = apiData.race || "N/A";
    document.getElementById("modalType").textContent = apiData.type || "N/A";
    
    // Hide attribute/level if it's a spell/trap
    const attrEl = document.getElementById("modalAttribute");
    const levelEl = document.getElementById("modalLevel");
    if(apiData.attribute) {
        attrEl.textContent = apiData.attribute;
        attrEl.style.display = "inline-block";
    } else {
        attrEl.style.display = "none";
    }
    
    if(apiData.level || apiData.level === 0) {
        levelEl.textContent = `Level/Rank/Link: ${apiData.level || apiData.linkval}`;
        levelEl.style.display = "inline-block";
    } else {
        levelEl.style.display = "none";
    }

    // Hide ATK/DEF if not a monster
    const statsDiv = document.querySelector(".modal-stats");
    if(apiData.atk !== undefined) {
        statsDiv.style.display = "flex";
        document.getElementById("modalAtk").textContent = apiData.atk;
        const defContainer = document.getElementById("defContainer");
        if(apiData.def !== undefined) {
            defContainer.style.display = "inline";
            document.getElementById("modalDef").textContent = apiData.def;
        } else {
             // Link monsters have no DEF
            defContainer.style.display = "none";
        }
    } else {
        statsDiv.style.display = "none";
    }

    document.getElementById("modalProduct").textContent = cardEntry['Product'] || 'Custom Add';
    document.getElementById("modalCode").textContent = cardEntry['Set Code'] || 'N/A';
    
    modal.style.display = "block";
}

// Close Modal
closeBtn.onclick = function() {
    modal.style.display = "none";
}
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

function renderCards(filterText = '') {
    grid.innerHTML = '';
    const collection = getCollection();
    
    const filtered = collection.filter(card => {
        const nameMatch = card['Card Name'] && card['Card Name'].toLowerCase().includes(filterText.toLowerCase());
        const codeMatch = card['Set Code'] && String(card['Set Code']).toLowerCase().includes(filterText.toLowerCase());
        return nameMatch || codeMatch;
    });

    filtered.forEach(card => {
        const name = card['Card Name'];
        const qty = card['Quantity'];
        
        let apiData = getCardDataFromName(name);
        let cardId = apiData ? apiData.id : null;

        const imgUrl = cardId 
            ? `https://images.ygoprodeck.com/images/cards/${cardId}.jpg`
            : 'https://images.ygoprodeck.com/images/cards/back_high.jpg';

        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.innerHTML = `
            <div class="card-qty">x${qty}</div>
            <img src="${imgUrl}" alt="${name}" onerror="this.src='https://images.ygoprodeck.com/images/cards/back_high.jpg'" loading="lazy">
            <div class="card-info">
                <h3 class="card-title" title="${name}">${name}</h3>
                <div class="card-meta">${card['Product'] || 'Custom Add'} • ${card['Set Code'] || 'No Code'}</div>
            </div>
        `;
        
        // Add click listener to open modal
        if(apiData) {
            cardEl.addEventListener('click', () => openModal(card, apiData));
        }

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
    
    if (!foundCard) {
        addStatus.textContent = 'Could not find that Set Code or Card Name in the database.';
        return;
    }
    
    const newCard = {
        'Product': foundSet ? foundSet.set_name : 'Unknown Product',
        'Theme/Deck': foundCard.archetype || 'None',
        'Card Name': foundCard.name, 
        'Set Code': foundSet ? foundSet.set_code : input,
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

fetchDatabase();
