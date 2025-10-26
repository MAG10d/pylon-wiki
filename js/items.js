// 全域 Map 儲存模型數據（避免 JSON 序列化問題）
window.pylonModelData = new Map();

// HTML 轉義函數，防止 XSS 攻擊
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 圖片路徑解析器
async function getImageUrl(imagePath, useModelResolver = false) {
    if (imagePath.startsWith('pylon:')) {
        const path = imagePath.replace('pylon:', '');
        
        if (path.includes('.png') || path.startsWith('block/') || path.startsWith('item/')) {
            return `https://cdn.jsdelivr.net/gh/pylonmc/pylon-resource-pack@pack-generator/input/assets/pylonbase/textures/${path}`;
        }
        
        if (useModelResolver && typeof modelResolver !== 'undefined') {
            try {
                const resolvedPath = await modelResolver.resolve(`pylon:${path}`);
                
                if (resolvedPath && typeof resolvedPath === 'object' && resolvedPath.type === 'pylon-model') {
                    return { type: 'pylon-model', data: resolvedPath };
                }
            } catch (error) {
                console.warn('Pylon model resolution failed:', error);
            }
        }
        
        return `https://cdn.jsdelivr.net/gh/pylonmc/pylon-resource-pack@pack-generator/input/assets/pylonbase/textures/${path}`;
    } else if (imagePath.startsWith('minecraft:')) {
        const path = imagePath.replace('minecraft:', '');
        const isTexturePath = path.includes('.png');
        
        if (useModelResolver && !isTexturePath && typeof modelResolver !== 'undefined') {
            try {
                const resolvedPath = await modelResolver.resolve(path);
                
                if (resolvedPath && typeof resolvedPath === 'object' && resolvedPath.type === 'pylon-model') {
                    return { type: 'pylon-model', data: resolvedPath };
                }
                
                if (resolvedPath && typeof resolvedPath === 'string' && resolvedPath !== path) {
                    return `https://assets.mcasset.cloud/1.21.8/assets/minecraft/textures/${resolvedPath}?height=40`;
                }
            } catch (error) {
                console.warn('Model resolution failed, using direct path:', error);
            }
        }
        
        return `https://assets.mcasset.cloud/1.21.8/assets/minecraft/textures/${path}?height=40`;
    }
    return imagePath;
}

// 快速渲染卡片（使用佔位符）
function renderItemCardPlaceholder(item) {
    const safeName = escapeHtml(item.name || '');
    const safeNameEn = escapeHtml(item.nameEn || '');
    const safeDescription = escapeHtml(item.description || '');
    const safeTag = escapeHtml(item.tag || '');
    
    return `
        <div class="item-card" data-item-id="${escapeHtml(item.id || '')}">
            <div class="item-card-header">
                <div class="item-icon">
                    <!-- 空白佔位符 -->
                </div>
                <h4>${safeName}<br><small style="color: var(--text-light); font-weight: normal;">${safeNameEn}</small></h4>
            </div>
            <p>${safeDescription}</p>
            <span class="item-tag">${safeTag}</span>
        </div>
    `;
}

// 異步載入單個物品的圖片
async function loadItemImage(card, item) {
    try {
        const imageUrlResult = await getImageUrl(item.image, true);
        const fallbackUrl = item.fallback ? await getImageUrl(item.fallback, false) : '';
        
        let renderType = 'flat';
        let imageUrl = imageUrlResult;
        let modelData = null;
        
        if (imageUrlResult && typeof imageUrlResult === 'object' && imageUrlResult.type === 'pylon-model') {
            renderType = 'pylon-3d';
            modelData = imageUrlResult.data;
            imageUrl = fallbackUrl;
        } else if (item.image.includes('skeleton_skull') || item.image.includes('wither_skeleton_skull')) {
            renderType = 'head';
        }
        
        const actualImageUrl = renderType === 'pylon-3d' && fallbackUrl ? fallbackUrl : imageUrl;
        const safeNameEn = escapeHtml(item.nameEn || '');
        const safeImageUrl = escapeHtml(actualImageUrl);
        const safeFallbackUrl = escapeHtml(fallbackUrl);
        
        const errorHandler = fallbackUrl ? `onerror="this.src='${safeFallbackUrl}'"` : '';
        const dataRenderType = renderType !== 'flat' ? `data-render="${escapeHtml(renderType)}"` : '';
        
        let dataModelId = '';
        if (modelData) {
            const modelId = `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            window.pylonModelData.set(modelId, modelData);
            dataModelId = `data-model-id="${modelId}"`;
        }
        
        // 替換佔位符為真實圖片
        const iconDiv = card.querySelector('.item-icon');
        if (iconDiv) {
            iconDiv.innerHTML = `
                <img src="${safeImageUrl}" 
                     alt="${safeNameEn}" 
                     ${errorHandler}
                     ${dataRenderType}
                     ${dataModelId}
                     class="item-image"
                     style="opacity: 0; transition: opacity 0.3s;">
            `;
            
            // 圖片載入後淡入
            const img = iconDiv.querySelector('img');
            if (img) {
                img.onload = () => {
                    img.style.opacity = '1';
                };
                // 如果圖片已經快取，立即顯示
                if (img.complete) {
                    img.style.opacity = '1';
                }
            }
        }
        
        return { card, renderType, modelData };
    } catch (error) {
        console.error('Failed to load item image:', error);
        return null;
    }
}

// 快速渲染分類（帶佔位符）
function renderCategoryPlaceholder(category) {
    const safeCategoryName = escapeHtml(category.name || '');
    const placeholderCards = category.items.map(item => renderItemCardPlaceholder(item)).join('');
    
    return `
        <h2><span class="category-badge">${safeCategoryName}</span></h2>
        <div class="items-grid" data-category="${escapeHtml(category.id || '')}">
            ${placeholderCards}
        </div>
    `;
}

// 獲取正確的基礎路徑
function getBasePath() {
    // 判斷是否在子目錄中
    const isInSubDir = window.location.pathname.includes('/items/') || 
                       window.location.pathname.includes('/guide/') ||
                       window.location.pathname.includes('/machines/');
    return isInSubDir ? '../' : '';
}

// 漸進式載入所有物品
async function loadItems() {
    try {
        const container = document.getElementById('items-container');
        if (!container) return;
        
        container.innerHTML = '<p style="text-align: center; color: var(--text-light);">正在載入物品...</p>';
        
        const basePath = getBasePath();
        const categoriesResponse = await fetch(`${basePath}data/items/_categories.json`);
        const categoriesData = await categoriesResponse.json();
        
        // 第一階段：快速顯示所有卡片框架
        container.innerHTML = '';
        const allCategories = [];
        
        for (const file of categoriesData.files) {
            try {
                const category = await fetch(`${basePath}data/items/${file}`).then(res => res.json());
                allCategories.push(category);
                
                // 立即插入帶佔位符的卡片
                const html = renderCategoryPlaceholder(category);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                
                while (tempDiv.firstChild) {
                    container.appendChild(tempDiv.firstChild);
                }
            } catch (err) {
                console.error(`Failed to load ${file}:`, err);
            }
        }
        
        // 第二階段：異步載入所有圖片
        const itemsForRendering = [];
        
        for (const category of allCategories) {
            const cards = container.querySelectorAll(`[data-category="${category.id || ''}"] .item-card`);
            
            category.items.forEach((item, index) => {
                const card = cards[index];
                if (card) {
                    // 異步載入圖片，不阻塞後續處理
                    loadItemImage(card, item).then(result => {
                        if (result && result.renderType !== 'flat') {
                            itemsForRendering.push(result);
                        }
                    });
                }
            });
        }
        
        // 第三階段：等待所有圖片載入後，進行 3D 渲染
        setTimeout(() => post3DRender(), 500);
    } catch (error) {
        console.error('Failed to load items:', error);
        document.getElementById('items-container').innerHTML = 
            '<p style="text-align: center; color: var(--text-light);">載入物品資料時發生錯誤</p>';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(loadItems, 200);
    });
} else {
    setTimeout(loadItems, 200);
}

// 後處理：渲染 3D 物品
async function post3DRender() {
    if (typeof mcRenderer === 'undefined') return;
    
    const images = document.querySelectorAll('img[data-render]');
    
    for (const img of images) {
        const renderType = img.getAttribute('data-render');
        let renderData = img.src;
        
        if (img.hasAttribute('data-model-id')) {
            const modelId = img.getAttribute('data-model-id');
            const modelData = window.pylonModelData.get(modelId);
            if (modelData) {
                renderData = modelData;
            }
        }
        
        try {
            const rendered = await mcRenderer.render(renderType, renderData, 256);
            if (rendered) {
                img.src = rendered;
                img.style.imageRendering = 'auto';
            }
        } catch (error) {
            console.error('3D render failed:', error);
        }
    }
}

// 搜尋功能：隱藏無結果的分類
function searchItems(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
        document.querySelectorAll('.item-card, .category-badge').forEach(el => {
            el.parentElement.style.display = '';
        });
        document.querySelectorAll('.items-grid').forEach(grid => {
            grid.style.display = '';
        });
        return;
    }
    
    const categories = document.querySelectorAll('h2');
    
    categories.forEach(categoryTitle => {
        const itemsGrid = categoryTitle.nextElementSibling;
        if (!itemsGrid || !itemsGrid.classList.contains('items-grid')) return;
        
        const cards = itemsGrid.querySelectorAll('.item-card');
        let hasVisibleItems = false;
        
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                card.style.display = '';
                hasVisibleItems = true;
            } else {
                card.style.display = 'none';
            }
        });
        
        if (hasVisibleItems) {
            categoryTitle.style.display = '';
            itemsGrid.style.display = '';
        } else {
            categoryTitle.style.display = 'none';
            itemsGrid.style.display = 'none';
        }
    });
}