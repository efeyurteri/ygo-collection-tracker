const CSV_FILE = 'YuGiOh_Collection_Tracker.csv';

let baseCollection = [];
let localAdditions = JSON.parse(localStorage.getItem('ygo_local_additions')) || [];
let ygoDatabase = [];
let ygoSets = []; // NEW: Secondary database specifically for set release dates

// DOM Elements
const grid = document.getElementById('cardGrid');
const form = document.getElementById('addCardForm');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const attributeFilter = document.getElementById('attributeFilter');
const levelFilter = document.getElementById('levelFilter');
const sortFilter = document.getElementById('sortFilter');
const exportBtn = document.getElementById('exportBtn');
const clearLocalBtn = document.getElementById('clearLocalBtn');
const totalValueDisplay = document.getElementById('totalValue');
const cardCountDisplay = document.getElementById('cardCount');
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
const modalAttribute = document.getElementById("modalAttribute");
const modalRace = document.getElementById("modalRace");
const modalType = document.getElementById("modalType");
const modalLevel = document.getElementById("modalLevel");
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

function decodeHTML(text) {
    if (!text) return "";
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

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

// THE FIX: Fetching both the Card Database AND the Set Timeline
async function fetchDatabase() {
    try {
        const [cardsRes, setsRes] = await Promise.all([
            fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php'),
            fetch('https://db.ygoprodeck.com/api/v7/cardsets.php')
        ]);
        
        const cardsData = await cardsRes.json();
        const setsData = await setsRes.json();
        
        ygoDatabase = cardsData.data;
        ygoSets = setsData; // Load the historical set dates
        
        renderCards();
    } catch (err) {
        console.error("Failed to fetch YGO databases:", err);
    }
}

function getCollection() {
    return [...localAdditions, ...baseCollection];
}

// Render Logic & Advanced Filtering
function renderCards() {
    if (!grid) return;
    grid.innerHTML = '';
    const fullCollection = getCollection();
    
    let totalValue = 0;
    let totalCards = 0;

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const typeVal = typeFilter ? typeFilter.value : 'All';
    const attrVal = attributeFilter ? attributeFilter.value : 'All';
    const lvlVal = levelFilter ? levelFilter.value : 'All';
    const sortVal = sortFilter ? sortFilter.value : 'name_asc';

    let displayData = fullCollection.map(item => {
        const dbCard = ygoDatabase.find(c => decodeHTML(c.name).toLowerCase() === decodeHTML(item['Card Name']).toLowerCase());
        let price = 0;
        if (dbCard && dbCard.card_prices && dbCard.card_prices[0]) {
            price = parseFloat(dbCard.card_prices[0].tcgplayer_price) || 0;
        }
        const qty = parseInt(item.Quantity) || 1;
        totalValue += (price * qty);
        return { item, dbCard, price, qty };
    });

    displayData = displayData.filter(data => {
        const cardName = decodeHTML(data.item['Card Name']).toLowerCase();
        const cardCode = (data.item['Set Code'] || '').toLowerCase();
        const matchesSearch = cardName.includes(searchTerm) || cardCode.includes(searchTerm);

        let matchesType = true;
        let matchesAttr = true;
        let matchesLvl = true;

        if (data.dbCard) {
            if (typeVal !== 'All') matchesType = data.dbCard.type.includes(typeVal);
            if (attrVal !== 'All') matchesAttr = (data.dbCard.attribute === attrVal);
            if (lvlVal !== 'All') {
                const cardLvl = data.dbCard.level || data.dbCard.linkval || -1;
                matchesLvl = (cardLvl.toString() === lvlVal);
            }
        } else {
            if (typeVal !== 'All' || attrVal !== 'All' || lvlVal !== 'All') return false; 
        }

        return matchesSearch && matchesType && matchesAttr && matchesLvl;
    });

    displayData.sort((a, b) => {
        if (sortVal === 'name_asc') return a.item['Card Name'].localeCompare(b.item['Card Name']);
        if (sortVal === 'name_desc') return b.item['Card Name'].localeCompare(a.item['Card Name']);
        if (sortVal === 'price_desc') return b.price - a.price;
        
        if (sortVal === 'atk_desc') {
            const atkA = (a.dbCard && a.dbCard.atk !== undefined) ? a.dbCard.atk : -1;
            const atkB = (b.dbCard && b.dbCard.atk !== undefined) ? b.dbCard.atk : -1;
            return atkB - atkA;
        }
        if (sortVal === 'def_desc') {
            const defA = (a.dbCard && a.dbCard.def !== undefined) ? a.dbCard.def : -1;
            const defB = (b.dbCard && b.dbCard.def !== undefined) ? b.dbCard.def : -1;
            return defB - defA;
        }
        return 0;
    });

    displayData.forEach(data => {
        const { item, dbCard, qty } = data;
        totalCards += qty;

        const cardDiv = document.createElement('div');
        cardDiv.className = 'card-item';
        cardDiv.style.cursor = 'pointer';
        cardDiv.style.background = '#2a2a2a';
        cardDiv.style.padding = '10px';
        cardDiv.style.borderRadius = '8px';
        cardDiv.style.border = '1px solid #444';
        cardDiv.style.transition = 'transform 0.2s';
        
        cardDiv.onmouseover = () => cardDiv.style.transform = 'scale(1.02)';
        cardDiv.onmouseout = () => cardDiv.style.transform = 'scale(1)';

        const imgUrl = dbCard ? dbCard.card_images[0].image_url_small : `images/${item['Set Code']}.jpg`;

        cardDiv.innerHTML = `
            <div style="position: relative; display: inline-block; width: 100%;">
                <img src="${imgUrl}" alt="${item['Card Name']}" onerror="this.src='https://images.ygoprodeck.com/images/cards/back_high.jpg'" style="width:100%; border-radius:4px; display:block;">
                <div style="position: absolute; top: -8px; right: -8px; background: #4caf50; color: #1a1a1a; width: 26px; height: 26px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 0.9em; box-shadow: 0 2px 4px rgba(0,0,0,0.5); border: 2px solid #1a1a1a;">${qty}</div>
            </div>
            <div style="margin-top: 10px; text-align: center;">
                <h3 style="font-size:0.9em; margin:0 0 5px 0; color: #fff;">${item['Card Name']}</h3>
                <p style="font-size:0.8em; color:#aaa; margin:0;">${item['Set Code']}</p>
            </div>
        `;

        cardDiv.addEventListener('click', () => openModal(item, dbCard));
        grid.appendChild(cardDiv);
    });

    if (totalValueDisplay) totalValueDisplay.textContent = `$${totalValue.toFixed(2)}`;
    if (cardCountDisplay) cardCountDisplay.textContent = totalCards;
}

function getBanlistStatus(status) {
    if (!status) return "3 / Unlim.";
    if (status === "Banned") return "0 / Banned";
    if (status === "Limited") return "1 / Limited";
    if (status === "Semi-Limited") return "2 / Semi-Lim.";
    return status;
}

// Blended Modal Logic
function openModal(item, dbCard) {
    try {
        if (modalImage) {
            modalImage.src = dbCard ? dbCard.card_images[0].image_url : `images/${item['Set Code']}.jpg`;
            modalImage.onerror = () => { modalImage.src = 'https://images.ygoprodeck.com/images/cards/back_high.jpg'; };
        }
        
        if (modalName) modalName.textContent = decodeHTML(item['Card Name']);
        if (modalAttribute) modalAttribute.textContent = dbCard && dbCard.attribute ? `${dbCard.attribute}` : "";
        if (modalRace) modalRace.textContent = dbCard ? (dbCard.race || "Unknown") : "N/A";
        if (modalType) modalType.textContent = dbCard ? (dbCard.type || "Custom") : "Custom / Unreleased";
        
        if (modalLevel) {
            let lvlStr = "";
            if (dbCard) {
                if (dbCard.type.includes("XYZ")) {
                    lvlStr = ` | Rank ${dbCard.level}`;
                } else if (dbCard.type.includes("Link")) {
                    lvlStr = ` | Link-${dbCard.linkval}`;
                } else if (dbCard.level !== undefined) {
                    lvlStr = ` | Level ${dbCard.level}`;
                }
            }
            modalLevel.textContent = lvlStr;
        }

        if (modalDesc) modalDesc.textContent = dbCard ? decodeHTML(dbCard.desc || "No description available.") : "Card details not currently available in the official YGOPRODeck database.";

        if (modalPrice) modalPrice.textContent = (dbCard && dbCard.card_prices && dbCard.card_prices[0]) ? `$${dbCard.card_prices[0].tcgplayer_price}` : "N/A";
        if (modalTCG) modalTCG.textContent = (dbCard && dbCard.card_prices) ? `$${dbCard.card_prices[0].tcgplayer_price}` : "N/A";
        if (modalCM) modalCM.textContent = (dbCard && dbCard.card_prices) ? `€${dbCard.card_prices[0].cardmarket_price}` : "N/A";

        const banlist = dbCard ? (dbCard.banlist_info || {}) : {};
        if (banTcg) banTcg.textContent = `TCG: ${getBanlistStatus(banlist.ban_tcg)}`;
        if (banOcg) banOcg.textContent = `OCG: ${getBanlistStatus(banlist.ban_ocg)}`;
        
        let mdStatus = getBanlistStatus(banlist.ban_md);
        if (dbCard) {
            if (dbCard.name === 'Maxx "C"') mdStatus = "1 / Limited";
            if (dbCard.name === "Pre-Preparation of Rites") mdStatus = "3 / Unlim.";
        }
        if (banMd) banMd.textContent = `MD: ${mdStatus}`;

        const isSpellTrap = dbCard ? (dbCard.type.includes("Spell") || dbCard.type.includes("Trap")) : false;
        
        if (isSpellTrap || !dbCard) {
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

        // THE FIX: Reliable Release Dates cross-referenced against the secondary API
        let mySetInfo = item['Product'] || "Unknown Product";
        let firstSetInfo = "N/A";

        // Extract the prefix (e.g., "L26D" from "L26D-ENS01")
        const mySetPrefix = (item['Set Code'] || "").split('-')[0];
        let mySetDate = "Unknown Date";
        
        // Handle custom 2026 sets manually, otherwise search the API timeline
        if (mySetPrefix === "L26D") {
            mySetDate = "2026"; 
        } else if (ygoSets.length > 0) {
            const foundSet = ygoSets.find(s => s.set_code === mySetPrefix);
            if (foundSet && foundSet.tcg_date) {
                mySetDate = foundSet.tcg_date;
            }
        }
        mySetInfo = `${mySetInfo} (${mySetDate})`;

        if (dbCard) {
            let earliestSet = "Unknown Set";
            let earliestDate = "9999-99-99";
            
            const officialFirstDate = (dbCard.misc_info && dbCard.misc_info[0] && dbCard.misc_info[0].tcg_date) ? dbCard.misc_info[0].tcg_date : null;

            // Search the timeline to find the absolute oldest printing of this specific card
            if (dbCard.card_sets && ygoSets.length > 0) {
                dbCard.card_sets.forEach(cs => {
                    const prefix = cs.set_code.split('-')[0];
                    const setInfo = ygoSets.find(s => s.set_code === prefix);
                    if (setInfo && setInfo.tcg_date) {
                        if (setInfo.tcg_date < earliestDate) {
                            earliestDate = setInfo.tcg_date;
                            earliestSet = cs.set_name;
                        }
                    }
                });
            }
            
            if (earliestDate !== "9999-99-99") {
                firstSetInfo = `${earliestSet} (${earliestDate})`;
            } else if (officialFirstDate) {
                firstSetInfo = `First Release (${officialFirstDate})`;
            }
        }

        if (modalProduct) modalProduct.textContent = mySetInfo;
        if (modalCode) modalCode.textContent = item['Set Code'] || "Unknown Code";
        if (modalFirstRelease) modalFirstRelease.textContent = firstSetInfo;

        if (modal) modal.style.display = "block";

    } catch (error) {
        console.error("Critical error building modal: ", error);
    }
}

if (closeBtn) closeBtn.addEventListener('click', () => { if (modal) modal.style.display = "none"; });
window.addEventListener('click', (e) => { if (e.target == modal) modal.style.display = "none"; });

if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('codeInput').value.trim();
        const quantity = document.getElementById('quantityInput').value;

        let foundCard = ygoDatabase.find(c =>
            decodeHTML(c.name).toLowerCase() === input.toLowerCase() ||
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
            'Card Name': decodeHTML(foundCard.name),
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

if (searchInput) searchInput.addEventListener('input', renderCards);
if (typeFilter) typeFilter.addEventListener('change', renderCards);
if (attributeFilter) attributeFilter.addEventListener('change', renderCards);
if (levelFilter) levelFilter.addEventListener('change', renderCards);
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

// --- 3D TILT EFFECT LOGIC (INTENSIFIED) ---
const tiltImage = document.getElementById("modalImage");
const tiltContainer = document.querySelector(".modal-image-container");

if (tiltContainer && tiltImage) {
    let isDragging = false;

    tiltContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault(); 
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        tiltImage.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
        tiltImage.style.transition = `transform 0.5s ease-out`;
    });

    tiltContainer.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        tiltImage.style.transition = 'none';

        const rect = tiltContainer.getBoundingClientRect();
        
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        // THE FIX: Cranked intensity from 40 to 75 and increased depth scale
        const rotateY = x * 75; 
        const rotateX = -(y * 75); 

        tiltImage.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.15)`;
    });

    tiltContainer.addEventListener('mouseleave', () => {
         if(isDragging) {
             isDragging = false;
             tiltImage.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
             tiltImage.style.transition = `transform 0.5s ease-out`;
         }
    });
}

// Boot up
init();
