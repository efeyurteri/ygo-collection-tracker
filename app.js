const CSV_FILE = 'YuGiOh_Collection_Tracker.csv';

let baseCollection = [];
let localAdditions = JSON.parse(localStorage.getItem('ygo_local_additions')) || [];
let ygoDatabase = []; // Will hold the official API data

const grid = document.getElementById('cardGrid');
const form = document.getElementById('addCardForm');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const clearLocalBtn = document.getElementById('clearLocalBtn');
const addStatus = document.getElementById('addStatus');

// 1. Fetch the Official YGOPRODECK Database
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

// 2. Fetch the CSV
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

function getCardIdFromName(cardName) {
    if (!cardName) return null;
    const lowerName = cardName.toLowerCase();
    const found = ygoDatabase.find(c => c.name.toLowerCase() === lowerName);
    return found ? found.id : null;
}

// 3. Render the grid
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
        
        let cardId = getCardIdFromName(name);

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
        grid.appendChild(cardEl);
    });
}

// 4. Handle Add Card Form using Set Code OR Exact Name
form.addEventListener('submit', (e) => {
    e.preventDefault();
    addStatus.textContent = '';
    
    const input = document.getElementById('codeInput').value.trim();
    
    let foundCard = null;
    let foundSet = null;

    // Search Strategy A: Try to match the exact Set Code
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

    // Search Strategy B: Fallback to exact Card Name
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

// Boot up!
fetchDatabase();
