const CSV_FILE = 'YuGiOh_Collection_Tracker.csv';

let baseCollection = [];
let localAdditions = JSON.parse(localStorage.getItem('ygo_local_additions')) || [];
let ygoDatabase = []; 

const grid = document.getElementById('cardGrid');
const form = document.getElementById('addCardForm');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter') || { value: 'All' };
const sortFilter = document.getElementById('sortFilter') || { value: 'name_asc' };
const exportBtn = document.getElementById('exportBtn');
const clearLocalBtn = document.getElementById('clearLocalBtn');
const totalValueDisplay = document.getElementById('totalValue') || { textContent: '' };
const modal = document.getElementById("cardModal");
const closeBtn = document.querySelector(".close-btn");

async function init() {
    try {
        const response = await fetch(CSV_FILE);
        if (response.ok) {
            const csvText = await response.text();
            Papa.parse(csvText, {
                header: true, skipEmptyLines: true,
                complete: function(results) {
                    baseCollection = results.data;
                    renderCards(); 
                    fetchDatabase(); 
                }
            });
        } else { renderCards(); fetchDatabase(); }
    } catch (err) { renderCards(); fetchDatabase(); }
}

async function fetchDatabase() {
    try {
        const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes');
        const data = await response.json();
        ygoDatabase = data.data;
        renderCards(); 
    } catch (err) { console.warn("Background database fetch failed."); }
}

function getCollection() {
    return [...localAdditions, ...baseCollection];
}

function getCardDataFromCodeOrName(code, name) {
    if (code && code !== 'N/A' && code !== 'No Code') {
        const cleanCode = code.trim().toUpperCase();
        for (const card of ygoDatabase) {
            if (card.card_sets && card.card_sets.some(s => s.set_code.toUpperCase() === cleanCode)) {
                return card;
            }
        }
    }
    if (name) {
        const lowerName = name.trim().toLowerCase();
        let found = ygoDatabase.find(c => c.name.toLowerCase() === lowerName);
        if (found) return found;
    }
    return null;
}

function getSpecificSetData(apiData, setCode) {
    if (!apiData || !apiData.card_sets || !setCode) return null;
    const cleanCode = setCode.trim().toUpperCase();
    return apiData.card_sets.find(s => s.set_code.toUpperCase() === cleanCode);
}

function getCardPrice(apiData, setCode) {
    if (!apiData) return 0;
    const setData = getSpecificSetData(apiData, setCode);
    if (setData && setData.set_price && parseFloat(setData.set_price) > 0) {
        return parseFloat(setData.set_price);
    }
    if (apiData.card_prices && apiData.card_prices.length > 0) {
        let tcg = parseFloat(apiData.card_prices[0].tcgplayer_price);
        let cm = parseFloat(apiData.card_prices[0].cardmarket_price);
        if (!isNaN(tcg) && tcg > 0) return tcg;
        if (!isNaN(cm) && cm > 0) return cm;
    }
    return 0;
}

function formatPrice(priceNum) {
    return isNaN(priceNum) ? "$0.00" : "$" + priceNum.toFixed(2);
}

function getBanStatus(apiData, format) {
    if (!apiData) return "Unlimited";
    if (format === "md") {
        if (apiData.name === 'Maxx "C"') return "Limited";
        if (apiData.name === 'Pre-Preparation of Rites') return "Unlimited";
    }
    if (!apiData.banlist_info) return "Unlimited";
    let status = apiData.banlist_info[`ban_${format}`];
    return status ? status : "Unlimited";
}

function formatBanStatus(status) {
    if(status === "Banned") return "🚫 Banned";
    if(status === "Limited") return "1️⃣ Limited";
    if(status === "Semi-Limited") return "2️⃣ Semi-Lim.";
    return "3️⃣ Unlim.";
}

function updateDashboardTotal(collection) {
    if (!totalValueDisplay.tagName) return;
    let total = 0;
    collection.forEach(card => {
        const qty = parseInt(card['Quantity']) || 0;
        const apiData = getCardDataFromCodeOrName(card['Set Code'], card['Card Name']);
        total += getCardPrice(apiData, card['Set Code']) * qty;
    });
    totalValueDisplay.textContent = formatPrice(total);
}

function openModal(cardEntry, apiData) {
    if(!modal) return;
    if (apiData) {
        document.getElementById("modalImage").src = `https://images.ygoprodeck.com/images/cards/${apiData.id}.jpg`;
        document.getElementById("modalName").textContent = apiData.name;
        document.getElementById("modalDesc").textContent = apiData.desc;
        
        const raceEl = document.getElementById("modalRace");
        if(raceEl) raceEl.textContent = apiData.race || "N/A";
        const typeEl = document.getElementById("modalType");
        if(typeEl) typeEl.textContent = apiData.type || "N/A";
        
        const attrEl = document.getElementById("modalAttribute");
        const levelEl = document.getElementById("modalLevel");
        
        if (attrEl) {
            if (apiData.attribute) {
                attrEl.textContent = apiData.attribute;
                attrEl.style.display = "inline-block";
            } else { attrEl.style.display = "none"; }
        }
        
        if (levelEl) {
            if (apiData.type.includes("XYZ")) {
                levelEl.textContent = `Rank ${apiData.level}`;
                levelEl.style.display = "inline-block";
            } else if (apiData.type.includes("Link")) {
                levelEl.textContent = `Link-${apiData.linkval}`;
                levelEl.style.display = "inline-block";
            } else if (apiData.level) {
                levelEl.textContent = `Level ${apiData.level}`;
                levelEl.style.display = "inline-block";
            } else { levelEl.style.display = "none"; }
        }

        const atkContainer = document.getElementById("atkContainer");
        const defContainer = document.getElementById("defContainer");
        if (atkContainer && apiData.atk !== undefined) {
            atkContainer.style.display = "inline";
            document.getElementById("modalAtk").textContent = apiData.atk;
            if (defContainer && apiData.def !== undefined) {
                defContainer.style.display = "inline";
                document.getElementById("modalDef").textContent = apiData.def;
            } else if (defContainer) { defContainer.style.display = "none"; }
        } else {
            if(atkContainer) atkContainer.style.display = "none";
            if(defContainer) defContainer.style.display = "none";
        }

        const banTcg = document.getElementById("banTcg");
        if(banTcg) banTcg.innerHTML = `TCG: ${formatBanStatus(getBanStatus(apiData, "tcg"))}`;
        const banOcg = document.getElementById("banOcg");
        if(banOcg) banOcg.innerHTML = `OCG: ${formatBanStatus(getBanStatus(apiData, "ocg"))}`;
        const banMd = document.getElementById("banMd");
        if(banMd) banMd.innerHTML = `MD: ${formatBanStatus(getBanStatus(apiData, "md"))}`;

        const tcgDate = apiData.misc_info && apiData.misc_info[0].tcg_date ? apiData.misc_info[0].tcg_date : "Unknown";
        const ocgDate = apiData.misc_info && apiData.misc_info[0].ocg_date ? apiData.misc_info[0].ocg_date : "Unknown";
        const firstSetName = apiData.card_sets ? apiData.card_sets[0].set_name : "Unknown Set";
        const firstRel = document.getElementById("modalFirstRelease");
        if(firstRel) firstRel.textContent = `TCG: ${tcgDate} | OCG: ${ocgDate} (${firstSetName})`;
        
        const tcgPrice = apiData.card_prices ? parseFloat(apiData.card_prices[0].tcgplayer_price) : 0;
        const cmPrice = apiData.card_prices ? parseFloat(apiData.card_prices[0].cardmarket_price) : 0;
        const mTcg = document.getElementById("modalTCG");
        if(mTcg) mTcg.textContent = formatPrice(tcgPrice);
        const mCm = document.getElementById("modalCM");
        if(mCm) mCm.textContent = "€" + (cmPrice || "0.00");

        const setData = getSpecificSetData(apiData, cardEntry['Set Code']);
        const rarityEl = document.getElementById("modalRarity");
        
        if (rarityEl) {
            if (setData && setData.set_rarity) {
                rarityEl.textContent = `Rarity: ${setData.set_rarity}`;
                rarityEl.style.display = "inline-block";
            } else {
                let fallbackRarity = apiData.card_sets ? apiData.card_sets[0].set_rarity : null;
                if (fallbackRarity) {
                     rarityEl.textContent = `Rarity: ${fallbackRarity.replace('(est)','').replace('(Est)','').trim()}`;
                     rarityEl.style.display = "inline-block";
                } else {
                     rarityEl.textContent = `Rarity: Unknown`;
                     rarityEl.style.display = "inline-block";
                }
            }
        }
        
        const mPrice = document.getElementById("modalPrice");
        if(mPrice) mPrice.textContent = formatPrice(getCardPrice(apiData, cardEntry['Set Code']));

    } else {
        document.getElementById("modalImage").src = `https://images.ygoprodeck.com/images/cards/back_high.jpg`;
        document.getElementById("modalName").textContent = cardEntry['Card Name'];
        document.getElementById("modalDesc").textContent = "Card data loading or not indexed in API...";
        const mPrice = document.getElementById("modalPrice");
        if(mPrice) mPrice.textContent = "$0.00";
        const mAttr = document.getElementById("modalAttribute");
        if(mAttr) mAttr.style.display = "none";
        const mLvl = document.getElementById("modalLevel");
        if(mLvl) mLvl.style.display = "none";
        
        const rarityEl = document.getElementById("modalRarity");
        if(rarityEl) {
            rarityEl.textContent = `Rarity: Unknown`;
            rarityEl.style.display = "inline-block";
        }
        
        const fRel = document.getElementById("modalFirstRelease");
        if(fRel) fRel.textContent = "Unknown";
    }

    const mProd = document.getElementById("modalProduct");
    if(mProd) mProd.textContent = cardEntry['Product'] || 'Custom Add';
    const mCode = document.getElementById("modalCode");
    if(mCode) mCode.textContent = cardEntry['Set Code'] || 'N/A';
    
    modal.style.display = "block";
}

if(closeBtn) closeBtn.onclick = function() { modal.style.display = "none"; }
window.onclick = function(event) { if (event.target == modal) { modal.style.display = "none"; } }

function changeQuantity(cardEntry, delta, event) {
    event.stopPropagation(); 
    let newQty = parseInt(cardEntry['Quantity']) + delta;

    if (newQty <= 0) {
        if (confirm(`Remove ${cardEntry['Card Name']} from your list?`)) {
            const localIdx = localAdditions.indexOf(cardEntry);
            if (localIdx > -1) {
                localAdditions.splice(localIdx, 1);
                localStorage.setItem('ygo_local_additions', JSON.stringify(localAdditions));
            } else {
                const baseIdx = baseCollection.indexOf(cardEntry);
                if (baseIdx > -1) baseCollection.splice(baseIdx, 1);
            }
        } else return;
    } else {
        cardEntry['Quantity'] = newQty;
        if (localAdditions.includes(cardEntry)) {
            localStorage.setItem('ygo_local_additions', JSON.stringify(localAdditions));
        }
    }
    renderCards();
}

function renderCards() {
    if(!grid) return;
    grid.innerHTML = '';
    const collection = getCollection();
    updateDashboardTotal(collection);
    
    const searchText = searchInput ? searchInput.value.toLowerCase() : '';
    const typeMode = typeFilter.value || "All";
    const sortMode = sortFilter.value || "name_asc";

    let filtered = collection.filter(card => {
        const name = card['Card Name'] ? String(card['Card Name']).toLowerCase() : '';
        const code = card['Set Code'] ? String(card['Set Code']).toLowerCase() : '';
        const apiData = getCardDataFromCodeOrName(card['Set Code'], card['Card Name']);
        
        const matchesSearch = name.includes(searchText) || code.includes(searchText);
        let matchesType = true;
        if (typeMode !== "All" && apiData) {
            matchesType = apiData.type.includes(typeMode);
        }
        return matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
        const apiA = getCardDataFromCodeOrName(a['Set Code'], a['Card Name']);
        const apiB = getCardDataFromCodeOrName(b['Set Code'], b['Card Name']);

        if (sortMode === "name_asc") {
            return a['Card Name'].localeCompare(b['Card Name']);
        }
        if (sortMode === "qty_desc") {
            return parseInt(b['Quantity']) - parseInt(a['Quantity']);
        }
        if (sortMode === "atk_desc") {
            const atkA = apiA && apiA.atk !== undefined ? apiA.atk : -1;
            const atkB = apiB && apiB.atk !== undefined ? apiB.atk : -1;
            return atkB - atkA;
        }
        if (sortMode === "level_desc") {
            const lvlA = apiA ? (apiA.level || apiA.linkval || 0) : 0;
            const lvlB = apiB ? (apiB.level || apiB.linkval || 0) : 0;
            return lvlB - lvlA;
        }
        if (sortMode === "price_desc") {
            const priceA = getCardPrice(apiA, a['Set Code']);
            const priceB = getCardPrice(apiB, b['Set Code']);
            return priceB - priceA; 
        }
        return 0;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #aaa; padding: 20px;">No cards match your filters.</div>';
        return;
    }

    filtered.forEach(card => {
        const name = card['Card Name'];
        const qty = card['Quantity'];
        let apiData = getCardDataFromCodeOrName(card['Set Code'], name);
        
        const imgUrl = apiData 
            ? `https://images.ygoprodeck.com/images/cards/${apiData.id}.jpg`
            : `https://images.ygoprodeck.com/images/cards/back_high.jpg`;

        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.innerHTML = `
            <div class="card-qty">x${qty}</div>
            <img src="${imgUrl}" alt="${name}" loading="lazy">
            <div class="card-info">
                <h3 class="card-title" title="${name}">${name}</h3>
                <div class="card-meta">${card['Set Code'] || 'No Code'}</div>
            </div>
            <div class="qty-controls">
                <button class="qty-btn minus-btn">-</button>
                <button class="qty-btn plus-btn">+</button>
            </div>
        `;
        
        cardEl.addEventListener('click', () => openModal(card, apiData));
        const mBtn = cardEl.querySelector('.minus-btn');
        if(mBtn) mBtn.addEventListener('click', (e) => changeQuantity(card, -1, e));
        const pBtn = cardEl.querySelector('.plus-btn');
        if(pBtn) pBtn.addEventListener('click', (e) => changeQuantity(card, 1, e));

        grid.appendChild(cardEl);
    });
}

if(searchInput) searchInput.addEventListener('input', () => renderCards());
if(typeFilter && typeFilter.addEventListener) typeFilter.addEventListener('change', () => renderCards());
if(sortFilter && sortFilter.addEventListener) sortFilter.addEventListener('change', () => renderCards());

if(form) {
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
            addStatus.textContent = "Card not found in database.";
            return;
        }

        const newCard = {
            'Product': foundSet ? foundSet.set_name : 'Custom Add',
            'Theme/Deck': foundCard.archetype || 'None',
            'Card Name': foundCard.name, 
            'Set Code': foundSet ? foundSet.set_code : input,
            'Quantity': document.getElementById('quantityInput').value
        };
        
        localAdditions.unshift(newCard); 
        localStorage.setItem('ygo_local_additions', JSON.stringify(localAdditions));
        
        form.reset();
        renderCards();
    });
}

if(exportBtn) {
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
}

if(clearLocalBtn) {
    clearLocalBtn.addEventListener('click', () => {
        if(confirm('Did you upload your exported CSV to GitHub yet?')) {
            localAdditions = [];
            localStorage.removeItem('ygo_local_additions');
            renderCards();
        }
    });
}

init();
