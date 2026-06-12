const CSV_FILE = 'YuGiOh_Collection_Tracker.csv';

// Base collection loaded from GitHub's CSV file
let baseCollection = [];

// Temporarily added cards stored in your local browser cache
let localAdditions = JSON.parse(localStorage.getItem('ygo_local_additions')) || [];

// DOM Elements
const grid = document.getElementById('cardGrid');
const form = document.getElementById('addCardForm');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const clearLocalBtn = document.getElementById('clearLocalBtn');

// Initialize App: Fetch the CSV and merge it with local additions
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
                }
            });
        } else {
            console.error("Could not load CSV. You might need to run this on a local server or GitHub pages.");
            renderCards();
        }
    } catch (err) {
        console.error(err);
        renderCards();
    }
}

// Combine the permanent CSV data with your local unsaved pulls
function getCollection() {
    return [...localAdditions, ...baseCollection];
}

// Render the grid
function renderCards(filterText = '') {
    grid.innerHTML = '';
    const collection = getCollection();
    
    // Filter by name
    const filtered = collection.filter(card => 
        card['Card Name'] && card['Card Name'].toLowerCase().includes(filterText.toLowerCase())
    );

    filtered.forEach(card => {
        const name = card['Card Name'];
        const qty = card['Quantity'];
        
        // ** THE API MAGIC ** // This automatically fetches the official artwork based on the exact name you typed.
        const imgUrl = `https://images.ygoprodeck.com/images/cards/${encodeURIComponent(name)}.jpg`;

        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        // Note the onerror handler: if you mistype a name, it falls back to a card back image.
        cardEl.innerHTML = `
            <div class="card-qty">x${qty}</div>
            <img src="${imgUrl}" alt="${name}" onerror="this.src='https://images.ygoprodeck.com/images/cards/back_high.jpg'">
            <div class="card-info">
                <h3 class="card-title" title="${name}">${name}</h3>
                <div class="card-meta">${card['Product']} • ${card['Theme/Deck']}</div>
            </div>
        `;
        grid.appendChild(cardEl);
    });
}

// Handle Add Card Form
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const newCard = {
        'Product': document.getElementById('productInput').value,
        'Theme/Deck': document.getElementById('themeInput').value,
        'Card Name': document.getElementById('cardNameInput').value,
        'Quantity': document.getElementById('quantityInput').value
    };
    
    // Add to Local Storage
    localAdditions.unshift(newCard); 
    localStorage.setItem('ygo_local_additions', JSON.stringify(localAdditions));
    
    form.reset();
    renderCards(searchInput.value);
});

// Handle Search Typing
searchInput.addEventListener('input', (e) => {
    renderCards(e.target.value);
});

// Handle Export to CSV (Merge and Download)
exportBtn.addEventListener('click', () => {
    const fullCollection = getCollection();
    const csv = Papa.unparse(fullCollection);
    
    // Create a temporary hidden link to trigger the download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'YuGiOh_Collection_Tracker.csv'); // Keeps the same name for easy replacement
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('Export Successful!\n\n1. Take the downloaded CSV file.\n2. Replace the old CSV file in your GitHub Repository.\n3. Click "Clear Local Additions" on the site to prevent duplicates.');
});

// Handle Clearing Local Storage after GitHub update
clearLocalBtn.addEventListener('click', () => {
    if(confirm('WARNING: Have you uploaded the newly exported CSV to GitHub yet?\n\nIf you clear this before uploading to GitHub, you will lose your newly added cards! Proceed?')) {
        localAdditions = [];
        localStorage.removeItem('ygo_local_additions');
        renderCards(searchInput.value);
    }
});

// Start the app
init();
