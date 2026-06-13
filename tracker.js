const CSV_FILE = 'YuGiOh_Collection_Tracker.csv';

let baseCollection = [];
let localAdditions = JSON.parse(localStorage.getItem('ygo_local_additions')) || [];
let ygoDatabase = [];

// DOM Elements
const grid = document.getElementById('cardGrid');
const form = document.getElementById('addCardForm');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const sortFilter = document.getElementById('sortFilter');
const exportBtn = document.getElementById('exportBtn');
const clearLocalBtn = document.getElementById('clearLocalBtn');
const totalValueDisplay = document.getElementById('totalValue');
const addStatus = document.getElementById('addStatus');

// Modal Elements
const modal = document.getElementById("cardModal");
const closeBtn = document.querySelector(".close-btn");
const modalImage = document.getElementById("modalImage");
const modalName = document.getElementById("modalName");
const modalPrice = document.getElementById("modalPrice");
const banTcg = document.getElementById("banTcg");
const banOcg = document.getElementById("banOcg");
const banMd = document.getElementById("banMd");
const modalRace = document.getElementById("modalRace");
const modalType = document.getElementById("modalType");
const modalDesc = document.getElementById("modalDesc");
const atkContainer = document.getElementById("atkContainer");
const modalAtk = document.getElementById("modalAtk");
const defContainer = document.getElementById("defContainer");
const modalDef = document.getElementById("modalDef");
const modalProduct = document.getElementById("modalProduct");
const modalCode = document.getElementById("modalCode");
const modalFirstRelease = document.getElementById("modalFirstRelease");
const modalTCG = document.getElementById("modalTCG");
const modalCM = document.getElementById("modalCM");

// Initialize Data
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
                    fetchDatabase();
                }
            });
        } else { fetchDatabase(); }
    } catch (err) { fetchDatabase(); }
}

async function fetchDatabase() {
    try {
        const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php');
        const data = await response.json();
        ygoDatabase = data.data;
        renderCards();
    } catch (err) {
        console.error("Failed to fetch YGO database:", err);
    }
}

function getCollection() {
    return [...localAdditions, ...baseCollection];
}

// Render Logic
function renderCards() {
    if (!grid) return;
    grid.innerHTML = '';
    const fullCollection = getCollection();
    let totalValue = 0;

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const typeVal = typeFilter ? typeFilter.value : 'All';
    const sortVal = sortFilter ? sortFilter.value : 'name_asc';

    let displayData = fullCollection.map(item => {
        // Strict mapping by EXACT Card Name ensures custom/future set codes don't break the lookup
        const dbCard = ygoDatabase.find(c => c.name.toLowerCase() === item['Card Name'].toLowerCase());
        let price = 0;
        if (dbCard && dbCard.card_prices && dbCard.card_prices[0]) {
            price = parseFloat(dbCard.card_prices[0].tcgplayer_price) || 0;
        }
        totalValue += (price * (parseInt(item.Quantity) || 1));
        return { item, dbCard, price };
    });

    if (totalValueDisplay) totalValueDisplay.textContent = `$${totalValue.toFixed(2)}`;

    // Filters
    displayData = displayData.filter(data => {
        const cardName = data.item['Card Name'].toLowerCase();
        const cardCode = (data.item['Set Code'] || '').toLowerCase();
        const matchesSearch = cardName.includes(searchTerm) || cardCode.includes(searchTerm);

        let matchesType = true;
        if (typeVal !== 'All' && data.dbCard) {
            matchesType = data.dbCard.type.includes(typeVal);
        }
        return matchesSearch && matchesType;
    });

    // Sorting
    displayData.sort((a, b) => {
        if (sortVal === 'name_asc') return a.item['Card Name'].localeCompare(b.item['Card Name']);
        if (sortVal === 'name_desc') return b.item['Card Name'].localeCompare(a.item['Card Name']);
        if (sortVal === 'price_desc') return b.price - a.price;
        return 0;
    });

    displayData.forEach(data => {
        const { item, dbCard } = data;
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card-item';
        cardDiv.style.cursor = 'pointer';
        cardDiv.style.background = '#1e1e1e';
        cardDiv.style.padding = '10px';
        cardDiv.style.borderRadius = '8px';

        const imgUrl = dbCard ? dbCard.card_images[0].image_url_small : 'https://images.ygoprodeck.com/images/cards/back_high.jpg';

        cardDiv.innerHTML = `
            <img src="${imgUrl}" alt="${item['Card Name']}" style="width:100%; border-radius:4px; display:block;">
            <div style="margin-top: 10px;">
                <h3 style="font-size:1em; margin:0 0 5px 0;">${item['Card Name']}</h3>
                <p style="font-size:0.8em; color:#aaa; margin:0;">${item['Set Code']} (x${item.Quantity})</p>
            </div>
        `;

        cardDiv.addEventListener('click', () => openModal(item, dbCard));
        grid.appendChild(cardDiv);
    });
}

function getBanlistStatus(status) {
    if (!status) return "3 / Unlim.";
    if (status === "Banned") return "0 / Banned";
    if (status === "Limited") return "1 / Limited";
    if (status === "Semi-Limited") return "2 / Semi-Lim.";
    return status;
}

// Modal Logic (The Fix)
function openModal(item, dbCard) {
    if (!dbCard) return alert("Card details not found in the database.");

    try {
        // Image & Core Data
        if (modalImage) modalImage.src = dbCard.card_images[0].image_url;
        if (modalName) modalName.textContent = dbCard.name;
        if (modalRace) modalRace.textContent = dbCard.race || "Unknown";
        if (modalType) modalType.textContent = dbCard.type || "Unknown";
        if (modalDesc) modalDesc.textContent = dbCard.desc || "No description available.";

        // Prices
        if (modalPrice) {
            modalPrice.textContent = (dbCard.card_prices && dbCard.card_prices[0]) 
                ? `$${dbCard.card_prices[0].tcgplayer_price}` : "N/A";
        }
        if (modalTCG && dbCard.card_prices) modalTCG.textContent = `$${dbCard.card_prices[0].tcgplayer_price}`;
        if (modalCM && dbCard.card_prices) modalCM.textContent = `€${dbCard.card_prices[0].cardmarket_price}`;

        // Banlist Logic (Handles standard sync + silent Master Duel accuracy overrides)
        const banlist = dbCard.banlist_info || {};
        if (banTcg) banTcg.textContent = `TCG: ${getBanlistStatus(banlist.ban_tcg)}`;
        if (banOcg) banOcg.textContent = `OCG: ${getBanlistStatus(banlist.ban_ocg)}`;
        
        let mdStatus = getBanlistStatus(banlist.ban_md);
        if (dbCard.name === 'Maxx "C"') mdStatus = "1 / Limited";
        if (dbCard.name === "Pre-Preparation of Rites") mdStatus = "3 / Unlim.";
        if (banMd) banMd.textContent = `MD: ${mdStatus}`;

        // The ATK/DEF Bug Fix: Check card type BEFORE checking for stats
        if (dbCard.type.includes("Spell") || dbCard.type.includes("Trap")) {
            if (atkContainer) atkContainer.style.display = 'none';
            if (defContainer) defContainer.style.display = 'none';
        } else {
            if (atkContainer) {
                atkContainer.style.display = 'inline';
                modalAtk.textContent = dbCard.atk !== undefined ? dbCard.atk : '?';
            }
            if (defContainer) {
                if (dbCard.type.includes("Link")) {
                    defContainer.style.display = 'none';
                } else {
                    defContainer.style.display = 'inline';
                    modalDef.textContent = dbCard.def !== undefined ? dbCard.def : '?';
                }
            }
        }

        // Footer Info
        if (modalProduct) modalProduct.textContent = item['Product'] || "Unknown";
        if (modalCode) modalCode.textContent = item['Set Code'] || "Unknown";
        if (modalFirstRelease) modalFirstRelease.textContent = (dbCard.misc_info && dbCard.misc_info[0]) ? dbCard.misc_info[0].tcg_date : "N/A";

        if (modal) modal.style.display = "block";

    } catch (error) {
        console.error("Critical error building modal, state protected: ", error);
    }
}

// Close Modal
if (closeBtn) closeBtn.addEventListener('click', () => { if (modal) modal.style.display = "none"; });
window.addEventListener('click', (e) => { if (e.target == modal) modal.style.display = "none"; });

// Form Submit
if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('codeInput').value.trim();
        const quantity = document.getElementById('quantityInput').value;

        let foundCard = ygoDatabase.find(c =>
            c.name.toLowerCase() === input.toLowerCase() ||
            (c.card_sets && c.card_sets.some(s => s.set_code.toLowerCase() === input.toLowerCase()))
        );

        if (!foundCard) {
            addStatus.textContent = "Card not found in database.";
            addStatus.style.color = "var(--danger, #cf6679)";
            return;
        }

        let foundSet = null;
        if (foundCard.card_sets) foundSet = foundCard.card_sets.find(s => s.set_code.toLowerCase() === input.toLowerCase());

        const newCard = {
            'Product': foundSet ? foundSet.set_name : 'Custom Add',
            'Theme/Deck': foundCard.archetype || 'None',
            'Card Name': foundCard.name,
            'Set Code': foundSet ? foundSet.set_code : input.toUpperCase(),
            'Quantity': quantity
        };

        localAdditions.unshift(newCard);
        localStorage.setItem('ygo_local_additions', JSON.stringify(localAdditions));

        form.reset();
        addStatus.textContent = "Card added successfully!";
        addStatus.style.color = "#4caf50";
        renderCards();
    });
}

// Listeners
if (searchInput) searchInput.addEventListener('input', renderCards);
if (typeFilter) typeFilter.addEventListener('change', renderCards);
if (sortFilter) sortFilter.addEventListener('change', renderCards);

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const csv = Papa.unparse(getCollection());
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'YuGiOh_Collection_Tracker.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

if (clearLocalBtn) {
    clearLocalBtn.addEventListener('click', () => {
        if(confirm('Did you upload your exported CSV to GitHub yet?')) {
            localAdditions = [];
            localStorage.removeItem('ygo_local_additions');
            renderCards();
        }
    });
}

// Boot up
init();
