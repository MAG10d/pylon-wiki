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

function renderItemCard(item, imageUrl, fallbackUrl = '', renderType = 'flat', modelData = null) {
    const actualImageUrl = renderType === 'pylon-3d' && fallbackUrl ? fallbackUrl : imageUrl;
    
    const safeName = escapeHtml(item.name || '');
    const safeNameEn = escapeHtml(item.nameEn || '');
    const safeDescription = escapeHtml(item.description || '');
    const safeTag = escapeHtml(item.tag || '');
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
    
    return `
        <div class="item-card">
            <div class="item-card-header">
                <div class="item-icon">
                    <img src="${safeImageUrl}" 
                         alt="${safeNameEn}" 
                         ${errorHandler}
                         ${dataRenderType}
                         ${dataModelId}
                         class="item-image">
                </div>
                <h4>${safeName}<br><small style="color: var(--text-light); font-weight: normal;">${safeNameEn}</small></h4>
            </div>
            <p>${safeDescription}</p>
            <span class="item-tag">${safeTag}</span>
        </div>
    `;
}

async function renderCategory(category) {
    const itemPromises = category.items.map(async item => {
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
        
        return renderItemCard(item, imageUrl, fallbackUrl, renderType, modelData);
    });
    
    const items = await Promise.all(itemPromises);
    const safeCategoryName = escapeHtml(category.name || '');
    
    return `
        <h2><span class="category-badge">${safeCategoryName}</span></h2>
        <div class="items-grid">
            ${items.join('')}
        </div>
    `;
}

// 漸進式載入所有物品
async function loadItems() {
    try {
        const container = document.getElementById('items-container');
        if (!container) return;
        
        container.innerHTML = '';
        const categoriesResponse = await fetch('data/items/_categories.json');
        const categoriesData = await categoriesResponse.json();
        
        for (const file of categoriesData.files) {
            try {
                const category = await fetch(`data/items/${file}`).then(res => res.json());
                const html = await renderCategory(category);
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                
                while (tempDiv.firstChild) {
                    container.appendChild(tempDiv.firstChild);
                }
            } catch (err) {
                console.error(`Failed to load ${file}:`, err);
            }
        }
        
        setTimeout(() => post3DRender(), 100);
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