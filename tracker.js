const CSV_FILE = 'YuGiOh_Collection_Tracker.csv';

let baseCollection = [];
let localAdditions = JSON.parse(localStorage.getItem('ygo_local_additions')) || [];
let ygoDatabase = [];
let ygoSets = [];
let processedCollection = []; 

// DOM Elements
const grid = document.getElementById('cardGrid');
const form = document.getElementById('addCardForm');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const attributeFilter = document.getElementById('attributeFilter');
const levelFilter = document.getElementById('levelFilter');
const sortFilter = document.getElementById('sortFilter');
const foilSelect = document.getElementById('foilSelect');
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
const modalTyping = document.getElementById("modalTyping"); 
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

// --------------------------------------------------------
// DATA FETCHING & PRE-PROCESSING
// --------------------------------------------------------
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
        const [cardsRes, setsRes] = await Promise.all([
            fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php'),
            fetch('https://db.ygoprodeck.com/api/v7/cardsets.php')
        ]);
        
        const cardsData = await cardsRes.json();
        const setsData = await setsRes.json();
        
        ygoDatabase = cardsData.data;
        ygoSets = setsData;
        
        buildProcessedCollection(); 
        renderCards();
    } catch (err) {
        console.error("Failed to fetch YGO databases:", err);
    }
}

function getCollection() {
    return [...localAdditions, ...baseCollection];
}

function buildProcessedCollection() {
    const fullCollection = getCollection();
    const dbMap = new Map();
    ygoDatabase.forEach(c => {
        dbMap.set(decodeHTML(c.name).toLowerCase(), c);
    });

    processedCollection = fullCollection.map(item => {
        const decodedName = decodeHTML(item['Card Name']);
        const searchName = decodedName.toLowerCase();
        const dbCard = dbMap.get(searchName);
        
        let price = 0;
        if (dbCard && dbCard.card_prices && dbCard.card_prices[0]) {
            price = parseFloat(dbCard.card_prices[0].tcgplayer_price) || 0;
        }

        let cardLevel = 0;
        if (dbCard) { cardLevel = dbCard.level || dbCard.linkval || 0; }

        let earliestDate = "9999-99-99"; 
        if (dbCard && dbCard.card_sets && ygoSets.length > 0) {
            dbCard.card_sets.forEach(cs => {
                const prefix = cs.set_code.split('-')[0];
                const setInfo = ygoSets.find(s => s.set_code === prefix);
                if (setInfo && setInfo.tcg_date && setInfo.tcg_date < earliestDate) {
                    earliestDate = setInfo.tcg_date;
                }
            });
        }
        if (earliestDate === "9999-99-99" && dbCard && dbCard.misc_info && dbCard.misc_info[0]) {
            earliestDate = dbCard.misc_info[0].tcg_date || "9999-99-99";
        }
        
        return { 
            item, 
            dbCard, 
            price, 
            qty: parseInt(item.Quantity) || 1,
            searchString: (searchName + " " + (item['Set Code'] || "").toLowerCase()),
            cardLevel: cardLevel,
            earliestDate: earliestDate
        };
    });
}

function renderCards() {
    if (!grid) return;
    grid.innerHTML = '';
    
    let totalValue = 0;
    let totalCards = 0;

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const typeVal = typeFilter ? typeFilter.value : 'All';
    const attrVal = attributeFilter ? attributeFilter.value : 'All';
    const sortVal = sortFilter ? sortFilter.value : 'name_asc';

    let displayData = processedCollection.filter(data => {
        const matchesSearch = data.searchString.includes(searchTerm);
        let matchesType = true;
        let matchesAttr = true;

        if (data.dbCard) {
            if (typeVal !== 'All') matchesType = data.dbCard.type.includes(typeVal);
            if (attrVal !== 'All') matchesAttr = (data.dbCard.attribute === attrVal);
        } else {
            if (typeVal !== 'All' || attrVal !== 'All') return false; 
        }
        return matchesSearch && matchesType && matchesAttr;
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
        if (sortVal === 'level_desc') return b.cardLevel - a.cardLevel;
        if (sortVal === 'level_asc') return a.cardLevel - b.cardLevel;
        if (sortVal === 'date_desc') return b.earliestDate.localeCompare(a.earliestDate);
        if (sortVal === 'date_asc') return a.earliestDate.localeCompare(b.earliestDate);
        return 0;
    });

    displayData.forEach(data => {
        const { item, dbCard, qty, price } = data;
        totalCards += qty;
        totalValue += (price * qty);

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

// --------------------------------------------------------
// DYNAMIC FOIL MASK GENERATOR 
// --------------------------------------------------------
function applyCardMask(dbCard) {
    const foilLayer = document.getElementById("foilLayer");
    const tiltWrapper = document.getElementById("tiltWrapper");
    if (!foilLayer || !tiltWrapper) return;
    
    // Maske matematiği için tam oran kilitlenir
    tiltWrapper.style.aspectRatio = "354 / 516";
    
    let maskImages = [];
    let maskSizes = [];
    let maskPositions = [];

    // 1. Resim Kutusu
    maskImages.push('linear-gradient(#000, #000)');
    maskSizes.push('76.27% 52.32%'); 
    maskPositions.push('50% 37.8%');

    // 2. Özellik (Attribute) Sembolü
    if (dbCard && (dbCard.attribute || dbCard.type.includes("Spell") || dbCard.type.includes("Trap"))) {
        maskImages.push('radial-gradient(ellipse, #000 68%, transparent 70%)');
        maskSizes.push('9.03% 6.2%');
        maskPositions.push('91.92% 4.95%');
    }

    // 3. Yıldızlar (Boşluk hesaplaması 23.2px'e daraltıldı)
    if (dbCard && dbCard.level !== undefined && !dbCard.type.includes("Link")) {
        let numStars = dbCard.level;
        let isXyz = dbCard.type.includes("XYZ");
        
        for (let i = 0; i < numStars; i++) {
            maskImages.push('radial-gradient(ellipse, #000 68%, transparent 70%)');
            maskSizes.push('6.21% 4.26%');
            
            // Xyz (siyah) yıldızlar soldan başlar, diğerleri sağdan. 
            // 23.2 boşluk oranı boşlukların tam oturmasını sağlar.
            let offsetX = isXyz ? (43 + (i * 23.2)) : (296 - (i * 23.2));
            let xPercent = (offsetX / 354) * 100;
            
            maskPositions.push(`${xPercent}% 12.75%`);
        }
    }

    const maskImageStr = maskImages.join(', ');
    const maskSizeStr = maskSizes.join(', ');
    const maskPositionStr = maskPositions.join(', ');
    const maskRepeatStr = maskImages.map(() => 'no-repeat').join(', ');

    foilLayer.style.webkitMaskImage = maskImageStr;
    foilLayer.style.webkitMaskSize = maskSizeStr;
    foilLayer.style.webkitMaskPosition = maskPositionStr;
    foilLayer.style.webkitMaskRepeat = maskRepeatStr;
    
    foilLayer.style.maskImage = maskImageStr;
    foilLayer.style.maskSize = maskSizeStr;
    foilLayer.style.maskPosition = maskPositionStr;
    foilLayer.style.maskRepeat = maskRepeatStr;
}

// --------------------------------------------------------
// MODAL LOGIC
// --------------------------------------------------------
function openModal(item, dbCard) {
    try {
        if (modalImage) {
            modalImage.src = dbCard ? dbCard.card_images[0].image_url : `images/${item['Set Code']}.jpg`;
            modalImage.onerror = () => { modalImage.src = 'https://images.ygoprodeck.com/images/cards/back_high.jpg'; };
        }
        
        // Dinamik maskeyi bas
        applyCardMask(dbCard);
        
        const foilLayer = document.getElementById("foilLayer");
        if (foilLayer && foilSelect) {
            if (foilSelect.value !== 'none') {
                foilLayer.className = `foil-layer foil-${foilSelect.value}`;
                foilLayer.style.setProperty('--o', '0.4'); 
            } else {
                foilLayer.className = `foil-layer`;
                foilLayer.style.setProperty('--o', '0');
            }
        }
        
        if (modalName) modalName.textContent = decodeHTML(item['Card Name']);
        
        if (modalTyping) {
            let typingStr = "Custom / Unreleased";
            if (dbCard) {
                const isSpellTrap = dbCard.type.includes("Spell") || dbCard.type.includes("Trap");
                if (isSpellTrap) {
                    const mainType = dbCard.type.toUpperCase().replace(" CARD", "");
                    typingStr = `${mainType} / ${dbCard.race}`; 
                } else {
                    const attr = dbCard.attribute ? dbCard.attribute : "UNKNOWN";
                    const race = dbCard.race || "Unknown";
                    const type = dbCard.type ? dbCard.type.replace(" Monster", "") : "Effect";
                    typingStr = `${attr} / ${race} / ${type}`; 
                }
            }
            modalTyping.textContent = typingStr;
        }
        
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

        let mySetInfo = item['Product'] || "Unknown Product";
        let firstSetInfo = "N/A";
        const mySetPrefix = (item['Set Code'] || "").split('-')[0];
        let mySetDate = "Unknown Date";
        
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

// --------------------------------------------------------
// FORMS & EVENT LISTENERS
// --------------------------------------------------------
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
        buildProcessedCollection(); 
        renderCards();
    });
}

let searchTimeout;
if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderCards, 150);
    });
}

if (typeFilter) typeFilter.addEventListener('change', renderCards);
if (attributeFilter) attributeFilter.addEventListener('change', renderCards);
if (sortFilter) sortFilter.addEventListener('change', renderCards);

// Folyoyu seçildiği an aktifleştiren kod
if (foilSelect) {
    foilSelect.addEventListener('change', () => {
        const foilLayer = document.getElementById("foilLayer");
        if (modal && modal.style.display === "block" && foilLayer) {
            if (foilSelect.value !== 'none') {
                foilLayer.className = `foil-layer foil-${foilSelect.value}`;
                foilLayer.style.setProperty('--o', '0.4'); 
            } else {
                foilLayer.className = `foil-layer`;
                foilLayer.style.setProperty('--o', '0');
            }
        }
    });
}


// --------------------------------------------------------
// THE FOIL & TILT ENGINE
// --------------------------------------------------------
const tiltWrapper = document.getElementById("tiltWrapper");
const tiltContainer = document.querySelector(".modal-image-container");
const foilLayer = document.getElementById("foilLayer");

if (tiltContainer && tiltWrapper && foilLayer) {
    let isDragging = false;

    tiltContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault(); 
        tiltWrapper.style.cursor = "grabbing";
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        tiltWrapper.style.cursor = "grab";
        tiltWrapper.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
        tiltWrapper.style.transition = `transform 0.5s ease-out`;
        
        if (foilSelect && foilSelect.value !== 'none') {
            foilLayer.style.setProperty('--o', '0.4'); 
            foilLayer.style.setProperty('--x', '0px');
            foilLayer.style.setProperty('--y', '0px');
        }
    });

    tiltContainer.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        tiltWrapper.style.transition = 'none';

        const rect = tiltContainer.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const x = e.clientX - rect.left - centerX;
        const y = e.clientY - rect.top - centerY;

        const rotateX = (y / centerY) * -15; 
        const rotateY = (x / centerX) * 15; 
        tiltWrapper.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;

        if (foilSelect && foilSelect.value !== 'none') {
            foilLayer.className = `foil-layer foil-${foilSelect.value}`;
            
            const dxyMax = Math.hypot(centerX, centerY);
            let opacityCalc = Math.min(1, Math.max(0, 1.825 - (Math.hypot(x, y) / dxyMax)));
            
            foilLayer.style.setProperty('--o', opacityCalc);
            foilLayer.style.setProperty('--x', `${x * 1.25}px`);
            foilLayer.style.setProperty('--y', `${y * 1.25}px`);
        } else {
            foilLayer.style.setProperty('--o', '0');
        }
    });

    tiltContainer.addEventListener('mouseleave', () => {
         if(isDragging) {
             isDragging = false;
             tiltWrapper.style.cursor = "grab";
             tiltWrapper.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
             tiltWrapper.style.transition = `transform 0.5s ease-out`;
             
             if (foilSelect && foilSelect.value !== 'none') {
                 foilLayer.style.setProperty('--o', '0.4');
                 foilLayer.style.setProperty('--x', '0px');
                 foilLayer.style.setProperty('--y', '0px');
             }
         }
    });
}

// Boot up
init();
